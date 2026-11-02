// echo: tells the room list when someone reacts to one of your messages
// (echo/reactions.svelte.ts draws it, echo/design/SPEC.md §4.6). Included from
// crates/sable-core/src/lib.rs with a `#[path]` line and started next to Sable's
// own watchers in accounts.rs.
//
// Sable's core reports reactions only on open timelines (TimelineAggregations),
// so this is a sync handler: it sees every joined room, open or not. The SDK
// hands a handler the decrypted event when sync could decrypt it, so encrypted
// rooms work. It reports every reaction to your messages, however old: the UI
// decides what is live (a pop) and what arrived while echo was closed (a marker).

use std::sync::Arc;

use matrix_sdk::RoomState;
use matrix_sdk::ruma::OwnedUserId;
use matrix_sdk::ruma::events::reaction::OriginalSyncReactionEvent;
use sable_model::truncate::truncate_graphemes;
use serde_json::{Value, json};

use crate::Core;
use crate::protocol::CoreEvent;
use crate::search::ignored_user_ids;

/// The reacted-to message's excerpt is a preview line; the UI ellipsizes it.
const EXCERPT_BYTES: usize = 120;

impl Core {
    pub(crate) fn echo_watch_reactions(
        self: &Arc<Self>,
        client: &matrix_sdk::Client,
        generation: u64,
    ) {
        let own_user_id = client.user_id().map(ToOwned::to_owned);
        let handle = client.add_event_handler({
            let core = self.clone();
            move |event: OriginalSyncReactionEvent, room: matrix_sdk::Room| {
                let core = core.clone();
                let own_user_id = own_user_id.clone();
                async move {
                    let Some(own) = own_user_id else {
                        return;
                    };
                    if event.sender == own || room.state() != RoomState::Joined {
                        return;
                    }
                    if ignored_user_ids(&room.client())
                        .await
                        .contains(&event.sender)
                    {
                        return;
                    }
                    let target = &event.content.relates_to.event_id;
                    let Ok(found) = room.load_or_fetch_event(target, None).await else {
                        return;
                    };
                    let raw = found.raw();
                    let sender = raw.get_field::<OwnedUserId>("sender").ok().flatten();
                    let redacted = raw
                        .get_field::<Value>("unsigned")
                        .ok()
                        .flatten()
                        .is_some_and(|unsigned| unsigned.get("redacted_because").is_some());
                    if sender.as_ref() != Some(&own) || redacted {
                        return;
                    }
                    let event_type = raw
                        .get_field::<String>("type")
                        .ok()
                        .flatten()
                        .unwrap_or_default();
                    let content = raw
                        .get_field::<Value>("content")
                        .ok()
                        .flatten()
                        .unwrap_or(Value::Null);
                    core.emit_if_current(
                        generation,
                        CoreEvent::Echo {
                            event: json!({
                                "kind": "reaction_to_own",
                                "room_id": room.room_id(),
                                "sender": event.sender,
                                "key": event.content.relates_to.key,
                                "target_event_id": target,
                                "excerpt": excerpt(&event_type, &content),
                                "origin_server_ts": event.origin_server_ts.0,
                            }),
                        },
                    );
                }
            }
        });
        self.track_session_handler(client, handle);
    }
}

/// A short line for the reacted-to message: its text, or what it was.
fn excerpt(event_type: &str, content: &Value) -> String {
    let body = content.get("body").and_then(Value::as_str).unwrap_or("");
    let label = match event_type {
        "m.sticker" => Some("a sticker"),
        "m.room.encrypted" => Some("your message"),
        "m.poll.start" | "org.matrix.msc3381.poll.start" => Some("a poll"),
        _ => match content.get("msgtype").and_then(Value::as_str) {
            Some("m.image") => Some("an image"),
            Some("m.video") => Some("a video"),
            Some("m.audio") => Some("an audio clip"),
            Some("m.file") => Some("a file"),
            Some("m.location") => Some("a location"),
            _ => None,
        },
    };
    if let Some(label) = label {
        return label.to_owned();
    }
    let text = without_reply_fallback(body)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if text.is_empty() {
        return "your message".to_owned();
    }
    let cut = truncate_graphemes(&text, EXCERPT_BYTES);
    if cut.len() < text.len() {
        format!("{cut}…")
    } else {
        text
    }
}

/// Older clients quote the replied-to message as "> " lines before a reply.
fn without_reply_fallback(body: &str) -> &str {
    if !body.starts_with("> ") {
        return body;
    }
    body.split_once("\n\n").map_or(body, |(_, rest)| rest)
}

#[cfg(all(test, not(target_family = "wasm")))]
mod tests {
    use std::sync::Arc;

    use matrix_sdk::ruma::{event_id, room_id, user_id};
    use matrix_sdk::test_utils::mocks::MatrixMockServer;
    use matrix_sdk_test::JoinedRoomBuilder;
    use matrix_sdk_test::event_factory::EventFactory;
    use matrix_sdk_ui::sync_service::SyncService;
    use serde_json::{Value, json};

    use super::excerpt;
    use crate::Core;
    use crate::protocol::CoreEvent;
    use crate::session::Session;
    use crate::store::MemorySessionStore;

    #[test]
    fn an_excerpt_is_the_text_or_what_the_message_was() {
        assert_eq!(
            excerpt(
                "m.room.message",
                &json!({"msgtype": "m.text", "body": "hello\n  there"})
            ),
            "hello there"
        );
        assert_eq!(
            excerpt(
                "m.room.message",
                &json!({"msgtype": "m.image", "body": "cat.png"})
            ),
            "an image"
        );
        assert_eq!(excerpt("m.sticker", &json!({"body": "wave"})), "a sticker");
        assert_eq!(excerpt("m.room.encrypted", &json!({})), "your message");
        assert_eq!(
            excerpt(
                "m.room.message",
                &json!({"msgtype": "m.text", "body": "> <@bob:x> hi\n\nmy reply"})
            ),
            "my reply"
        );
        let long = "word ".repeat(60);
        let cut = excerpt(
            "m.room.message",
            &json!({"msgtype": "m.text", "body": long}),
        );
        assert!(cut.ends_with('…'));
        assert!(cut.len() <= super::EXCERPT_BYTES + '…'.len_utf8());
    }

    #[expect(clippy::unwrap_used, reason = "test code")]
    #[tokio::test]
    async fn a_reaction_to_your_message_is_reported_and_others_are_not() {
        let server = MatrixMockServer::new().await;
        let client = server.client_builder().build().await;
        let own = client.user_id().unwrap().to_owned();
        let bob = user_id!("@bob:example.org");
        let room_id = room_id!("!reactions:example.org");
        let mine = event_id!("$mine");
        let theirs = event_id!("$theirs");
        let factory = EventFactory::new().room(room_id);
        server.mock_room_state_encryption().plain().mount().await;
        server
            .sync_room(
                &client,
                JoinedRoomBuilder::new(room_id)
                    .add_timeline_event(factory.text_msg("my words").sender(&*own).event_id(mine))
                    .add_timeline_event(factory.text_msg("bob's").sender(bob).event_id(theirs)),
            )
            .await;
        for (id, sender, body) in [(mine, &*own, "my words"), (theirs, bob, "bob's")] {
            server
                .mock_room_event()
                .match_event_id()
                .ok(factory
                    .text_msg(body)
                    .sender(sender)
                    .event_id(id)
                    .into_event())
                .mount()
                .await;
        }

        let (core, mut events) = Core::new(
            "echo-reactions-test",
            Box::new(MemorySessionStore::default()),
        );
        *core.session.write().await = Some(Session {
            account_id: "test".to_owned(),
            sync_service: Arc::new(SyncService::builder(client.clone()).build().await.unwrap()),
            client: client.clone(),
            homeserver: server.server().uri(),
            oauth: false,
        });
        // A new Core's first session is generation 1, as in Sable's watcher tests.
        core.echo_watch_reactions(&client, 1);

        server
            .sync_room(
                &client,
                JoinedRoomBuilder::new(room_id)
                    // Your own reaction, and one to someone else's message: neither counts.
                    .add_timeline_event(factory.reaction(mine, "🙂").sender(&*own))
                    .add_timeline_event(factory.reaction(theirs, "😂").sender(bob))
                    .add_timeline_event(
                        factory
                            .reaction(mine, "👍")
                            .sender(bob)
                            .server_ts(1_234_u64),
                    ),
            )
            .await;

        let reported = tokio::time::timeout(std::time::Duration::from_secs(3), async {
            loop {
                if let Some(CoreEvent::Echo { event }) = events.recv().await {
                    return event;
                }
            }
        })
        .await
        .unwrap();
        assert_eq!(
            reported,
            json!({
                "kind": "reaction_to_own",
                "room_id": room_id,
                "sender": bob,
                "key": "👍",
                "target_event_id": mine,
                "excerpt": "my words",
                "origin_server_ts": 1_234,
            })
        );
        while let Ok(event) = events.try_recv() {
            assert!(
                !matches!(event, CoreEvent::Echo { .. }),
                "only one reaction counts: {:?}",
                serde_json::to_value(&event).unwrap_or(Value::Null)
            );
        }
    }
}
