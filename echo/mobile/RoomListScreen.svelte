<!-- echo's room list on a phone (PhoneShell.svelte's first screen). The rows are
     echo's (echo/design/SPEC.md §4.3–4.4): a round avatar, the name with its
     kind glyph and the time, a "Sender: text" line in the sender's colour, and
     the unread dot or badge in echo's colours. Where to look — everything,
     direct messages, rooms or one space — is a strip of chips under the title
     rather than echo's desktop rail: a rail would take a fifth of a phone's
     width from every row, and a bottom tab bar has no room for a list of
     spaces of any length. Sable's own bottom bar (UserQuickTools) stays below
     for the app-level pages: search, inbox, account. Data, unread counts,
     invites and navigation are Sable's. Styles: echo/styles/mobile.css. -->
<script lang="ts">
  import type { RoomListItemView } from '#src/generated/protocol';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import NotePencilIcon from 'phosphor-svelte/lib/NotePencilIcon';
  import { useCoreClient } from '#lib/core/context.js';
  import { goToPage } from '#lib/features/room/room-navigation.js';
  import { isDeclining } from '#lib/rooms/invites.svelte.js';
  import { dismissedInvites } from '#lib/rooms/dismissed-invites.svelte.js';
  import { roomSectionPath } from '#lib/rooms/permalink.js';
  import {
    roomAvatarUrl,
    roomLabel,
    roomPathParam,
    useRoomList,
  } from '#lib/rooms/room-list.svelte.js';
  import { addUnread } from '#lib/rooms/spaces.js';
  import { hasUnread, type UnreadCount } from '#lib/rooms/unread.js';
  import { i18n } from '#lib/i18n.js';
  import { PeerProfiles } from '#lib/features/sidebar/peer-profiles.svelte.js';
  import { isActiveSpace, spaceDescendantRooms } from '#lib/features/sidebar/nav-rooms.js';
  import RoomInvites from '#lib/features/sidebar/RoomInvites.svelte';
  import Avatar from '#lib/ui/primitives/Avatar.svelte';
  import RoomIcon from '#lib/ui/primitives/RoomIcon.svelte';
  import TypingDots from '#lib/ui/primitives/TypingDots.svelte';
  import UnreadBadge from '#lib/ui/primitives/UnreadBadge.svelte';
  import { whenVisible } from '#lib/ui/when-visible.js';
  import EchoRoomPreview from '../components/RoomPreview.svelte';
  import { readPlace, writePlace, type Place } from './place.js';
  import { listTime } from './time.js';

  const core = useCoreClient();
  const roomList = useRoomList();
  const profiles = new PeerProfiles(core);

  let place = $state<Place>(readPlace());

  let chats = $derived(
    roomList.rooms.filter(
      (room) => room.state === 'joined' && !room.is_tombstoned && room.room_kind !== 'space'
    )
  );
  let spaces = $derived(roomList.rooms.filter(isActiveSpace));
  let spaceId = $derived(place.kind === 'space' ? place.spaceId : null);
  let space = $derived(spaces.find((room) => room.room_id === spaceId));

  function placeRooms(target: Place): RoomListItemView[] {
    if (target.kind === 'dms') return chats.filter((room) => room.is_direct);
    if (target.kind === 'rooms') return chats.filter((room) => !room.is_direct);
    if (target.kind === 'space') {
      const inside = new Set(
        spaceDescendantRooms(roomList.rooms, target.spaceId).map((room) => room.room_id)
      );
      return chats.filter((room) => inside.has(room.room_id));
    }
    return chats;
  }

  // Newest first, as echo's Recent: a phone shows one list, not sections.
  let rows = $derived(
    placeRooms(space === undefined && place.kind === 'space' ? { kind: 'all' } : place).toSorted(
      (left, right) => (right.latest_event?.timestamp ?? 0) - (left.latest_event?.timestamp ?? 0)
    )
  );

  let invites = $derived.by(() => {
    const pending = roomList.rooms.filter(
      (room) =>
        room.state === 'invited' &&
        !isDeclining(room.room_id) &&
        !dismissedInvites.has(room.room_id)
    );
    if (place.kind === 'dms') return pending.filter((room) => room.is_direct);
    if (place.kind === 'rooms') return pending.filter((room) => !room.is_direct);
    if (place.kind === 'space') {
      const children = new Set(space?.space_children.map((child) => child.room_id) ?? []);
      return pending.filter((room) => children.has(room.room_id));
    }
    return pending;
  });

  function placeUnread(target: Place): UnreadCount {
    return placeRooms(target).reduce(
      (total, room) => addUnread(total, roomList.badgeUnreadFor(room)),
      { unread: 0, highlight: 0 }
    );
  }

  let title = $derived.by(() => {
    if (place.kind === 'dms') return i18n.t('common.directMessages');
    if (place.kind === 'rooms') return i18n.t('nav.rooms');
    if (place.kind === 'space') return space?.name ?? i18n.t('nav.space');
    return i18n.t('nav.home');
  });

  function choose(next: Place): void {
    place = next;
    writePlace(next);
  }

  function href(room: RoomListItemView): string {
    if (place.kind === 'space' && space !== undefined) {
      return resolve('/(app)/space/[spaceId]/[roomId]', {
        spaceId: roomPathParam(space, roomList.rooms),
        roomId: roomPathParam(room, roomList.rooms),
      });
    }
    return roomSectionPath(roomList.rooms, room.room_id);
  }

  function open(event: MouseEvent, target: string): void {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    goToPage(target);
  }

  // Sable's "New chat" form lives at /direct, behind its list on a phone.
  function newChat(): void {
    void goto(resolve('direct'), { state: { mobileDrawer: 'closed' } });
  }

  function peerOf(room: RoomListItemView): string | null {
    if (!room.is_direct || room.direct_targets.length !== 1) return null;
    return room.direct_targets[0];
  }

  function badgeLabel(counts: UnreadCount): string {
    if (counts.highlight > 0) return i18n.t('nav.unreadMentions', { count: counts.highlight });
    if (counts.unread > 0) return i18n.t('nav.unreadMessages', { count: counts.unread });
    return i18n.t('nav.markedUnread');
  }

  const PLACES: { place: Place; label: string }[] = [
    { place: { kind: 'all' }, label: 'inbox.filterAll' },
    { place: { kind: 'dms' }, label: 'inbox.filterDirect' },
    { place: { kind: 'rooms' }, label: 'nav.rooms' },
  ];

  function same(left: Place, right: Place): boolean {
    if (left.kind !== right.kind) return false;
    return left.kind !== 'space' || right.kind !== 'space' || left.spaceId === right.spaceId;
  }

  let openRoomId = $derived(page.params.roomId);
</script>

{#snippet chip(target: Place, label: string, avatar?: RoomListItemView)}
  {@const selected = same(place, target)}
  <button
    type="button"
    class={['echo-m-chip', { selected, unread: !selected && hasUnread(placeUnread(target)) }]}
    aria-pressed={selected}
    onclick={() => {
      choose(target);
    }}
  >
    {#if avatar}
      <Avatar
        class="echo-m-chip-avatar"
        id={avatar.room_id}
        src={avatar.avatar_url}
        name={avatar.name}
        size="tiny"
      />
    {/if}
    <span class="echo-m-chip-label">{label}</span>
  </button>
{/snippet}

<div class="echo-m-rooms">
  <header class="echo-m-rooms-header">
    <h1>{title}</h1>
    <button
      type="button"
      class="echo-m-icon-button"
      aria-label={i18n.t('nav.newChat')}
      onclick={newChat}
    >
      <NotePencilIcon />
    </button>
  </header>

  <nav class="echo-m-places" aria-label={i18n.t('nav.primary')}>
    {#each PLACES as entry (entry.place.kind)}
      {@render chip(entry.place, i18n.t(entry.label))}
    {/each}
    {#each spaces as item (item.room_id)}
      {@render chip({ kind: 'space', spaceId: item.room_id }, item.name ?? item.room_id, item)}
    {/each}
  </nav>

  <div class="echo-m-scroll">
    <RoomInvites {invites} />
    {#if rows.length === 0 && invites.length === 0}
      <p class="echo-m-empty">
        {roomList.settled ? i18n.t('nav.chatsEmpty') : i18n.t('nav.roomsUnavailable')}
      </p>
    {/if}
    <ul class="echo-m-room-list" aria-label={title}>
      {#each rows as room (room.room_id)}
        {@const target = href(room)}
        {@const counts = roomList.badgeUnreadFor(room)}
        {@const name = roomLabel(room)}
        {@const avatar = roomAvatarUrl(room)}
        {@const peer = peerOf(room)}
        {@const typing = roomList.typingUserIds(room.room_id).length > 0}
        {@const time = listTime(room.latest_event?.timestamp)}
        <li
          class={[
            'echo-m-room',
            {
              unread: hasUnread(counts),
              dm: room.is_direct,
              mention: counts.highlight > 0,
              notify: (counts.notifying ?? 0) > 0,
            },
          ]}
          {@attach peer === null
            ? undefined
            : whenVisible(() => {
                profiles.request(peer);
              })}
          {@attach whenVisible(
            () => {
              roomList.warm(room.room_id);
            },
            '0px',
            300
          )}
        >
          <!-- eslint-disable svelte/no-navigation-without-resolve -- href() resolves the route itself -->
          <a
            class="echo-m-room-link"
            href={target}
            aria-current={openRoomId !== undefined &&
            [room.room_id, room.canonical_alias].includes(decodeURIComponent(openRoomId))
              ? 'page'
              : undefined}
            onclick={(event) => {
              open(event, target);
            }}
          >
            <!-- eslint-enable svelte/no-navigation-without-resolve -->
            <span class="echo-m-room-avatar">
              {#if avatar || room.is_direct}
                <Avatar id={room.room_id} src={avatar} {name} size="medium" uniform />
              {:else}
                <span class="avatar-root echo-m-glyph" aria-hidden="true">
                  <RoomIcon roomKind={room.room_kind} joinRule={room.join_rule} />
                </span>
              {/if}
            </span>
            <span class="echo-m-room-text">
              <span class="echo-m-room-name">{name}</span>
              <EchoRoomPreview {room} {profiles} />
              {#if time}<time class="echo-m-room-time" datetime={time.iso}>{time.label}</time>{/if}
              <span class="echo-m-room-status">
                {#if typing}
                  <TypingDots />
                {:else}
                  <UnreadBadge
                    {counts}
                    dm={room.is_direct}
                    role="img"
                    aria-label={badgeLabel(counts)}
                  />
                {/if}
              </span>
            </span>
          </a>
        </li>
      {/each}
    </ul>
  </div>
</div>
