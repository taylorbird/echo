# echo

echo is a fork of [Sable](https://git.sable.moe/SableClient/Sable-next). Everything that makes
it echo lives in this folder, so that merging Sable's upstream stays cheap: echo changes Sable's
own files only with one-line hooks, listed below. Before adding another hook, see if the change
can live here instead.

## What's here

- `theme.css` — echo's look (palette, Inter / Fira Code) over Sable's design tokens, loaded
  right after `src/styles.css`. Outside `src/` because Sable's theme check allows literal
  colours only in `src/styles.css`. It imports one file per UI area from `styles/`
  (frame, rail, roomlist, timeline, panels, popups, profile, loading), each targeting Sable's own
  markup and written against `design/SPEC.md`. Layout rules are desktop only
  (`width >= 48rem`); the phone layout stays Sable's until echo has its own.
- `components/` — the few pieces of echo's UI that CSS can't draw, each mounted from Sable's
  markup by a one-line hook (below).
- `layout.ts` — echo's desktop geometry that lives in Sable's script (the room list's width, and
  the 14px root the timeline sizes inline media from).
- `active.ts` — whether echo's layer is running (`init.ts` switches it on). Where echo changes
  what Sable shows rather than how it looks (extra DMs in a list, panels starting closed,
  muted-room dots, the rail band) it checks this, so Sable's component tests, which render
  without the app's layout, keep testing Sable.
- `init.ts` — start-up: echo's defaults where they differ from Sable's (Home on in the rail and
  the composer's formatting toolbar open, on desktop; on macOS Sable's own title bar, which puts the window in overlay style so the panes can run to
  the top edge), and in the macOS app (Tauri or Electron) the headers as window drag regions, and `data-echo-app` on
  `<html>`, which the app look in `styles/` keys on.
- `panels.ts` — echo's right panel: each room opens with it closed (Sable reopened a
  remembered members panel in every room), and Esc closes it. Desktop only.
- `space-dms.ts` — which DMs a place lists, as echo decided: a space lists DMs with members of
  it or a space below it, the rooms outside spaces list every DM. Desktop only.
- `places.ts` — where a room opens, as echo-gomuks did it: Home is one more place in the rail,
  so a room opens in the place that's open when it lists the room (Home lists every chat, a
  space its rooms and the DMs `space-dms.ts` adds), otherwise in its space or Home, never in the
  rooms outside spaces or direct messages, whose rail tiles echo hides (`styles/rail.css`).
  Start-up with no room to restore lands in Home, and Sable's flows that open a DM at
  `/direct/<id>` (New chat, a DM invite) go on to it in Home (`components/DirectRoom.svelte`).
  Desktop only.
- `create-menu.ts` — "New chat" in the rail's create (+) menu, since the direct messages section
  that offered it has no tile. Desktop only.
- `folders.ts` — a space folder in the rail is open exactly while one of its spaces is: clicking
  a closed folder opens its last space (or its first), and its caret goes Home. Sable's
  expanded-with-nothing-open step is gone. Desktop only.
- `unread.ts` — echo's unread indicators: a muted room with unread messages still gets its badge
  in the room list and rail (Sable's core clears a muted room's counts). Desktop only.
- `ring.ts` — what a room's badge ring shows (colour and content: count, "@", dot or emoji),
  drawn by `components/RoomRing.svelte` in the room list's badge lane. Desktop only.
- `reactions.svelte.ts` — reactions to your messages in the room list: a 5-second pop of the
  emoji and a "reacted to" preview, and with "show reactions as notifications" on a marker
  until you open the room (kept per account on this device). Fed by `core/reactions.rs`.
- `core/` — echo's Rust in Sable's core, compiled into `crates/sable-core` with `#[path]`
  modules: `reactions.rs` reports reactions to your messages from sync as `echo` core events;
  `brand.rs` is the name servers see (sign-in, new devices, pushers): "echo", in every build,
  and the OAuth `client_uri` for echo's sign-in schemes (see Identity and updates).
- `auth.ts` — the OAuth/SSO redirect in echo's Electron app: the build's own scheme, which the
  preload passes in (`echoRedirectScheme`).
- `settings.ts` — echo's own settings as panels in Sable's settings pages (the reaction
  settings, under Notifications). Kept on this device. Desktop only.
- `branding.ts` — swaps "Sable" for "echo" in every locale bundle as it loads. Strings about
  the Sable project itself keep its name. In tests it follows `active.ts`, so Sable's own
  component tests see Sable's text. `echoAppName` is the name where Sable writes it in markup.
- `brand/logo.svg` — the in-app logo. `icons/` — native app icons, generated with
  `pnpm tauri icon /path/to/echo-icon-facet-split-squircle.png --output echo/icons`.
- `tauri.echo.conf.json` — merged over `src-tauri/tauri.conf.json` by the echo tasks: name,
  bundle ID, window, icons, update feed.
- `tauri.echo.release.conf.json` — merged on top for releases: bundle ID `dev.tbird.echo`, echo's
  version, Developer ID signing and updater artifacts. `release.sh` builds with it.
- `electron/` — the desktop app on Electron (Sable's desktop shell since 2026-10-21; Tauri stays
  for mobile). `build.sh` packages it with Sable's `electron/package.mjs`, passing echo's
  identifier, name, icon (`icons/echo.icon`), permission prompts and update feed as
  electron-builder overrides; `dev.sh` runs it against the Vite dev server. `app.ts` tells the
  main process it is echo (from the identifier it was built with) and which sign-in scheme the
  build has, `updater.ts` points electron-updater at `taylorbird/echo`. None of them import
  Electron: Sable's main process passes in what they need. `electron-builder.echo.ts` is the
  config `build.sh` packages with (Sable's base config and the build's own scheme), and
  `check-url-schemes.sh` fails the build unless the app's Info.plist declares that scheme only.
- `release-electron.sh` — a signed, notarized Electron release with its update feed
  (`latest-mac.yml`). Releases up to 1.3.0 also carried a Tauri updater feed (`latest.json`) for
  Tauri echo 1.0 and echo-gomuks 0.7 installs; 1.4 dropped it.
- `visual/` — `mise run echo:shots`: screenshots of the signed-in web app against a throwaway
  homeserver with fake data. See `visual/README.md`.

Fonts are in `static/fonts/echo/`, since that's where Vite serves static files from.

## Hooks into Sable's files

| File | Hook |
| --- | --- |
| `src/routes/+layout.svelte` | `import '../../echo/theme.css'` after `styles.css` |
| `src/routes/+layout.svelte` | `import '../../echo/init.js'` after the theme |
| `src/lib/locales.ts` | `brandLocale(...)` around the loaded bundle |
| `src/lib/i18n.ts` | `brandLocale(en)` for the built-in English fallback |
| `src/lib/ui/SableBrandMark.svelte` | logo import points at `echo/brand/logo.svg` |
| `src/lib/features/sidebar/AppShell.svelte` | room list starts at `ECHO_ROOM_NAV_WIDTH` (`echo/layout.ts`) instead of 288 |
| `src/lib/features/sidebar/RoomNav.svelte` | `<EchoRoomPreview>` (`echo/components/RoomPreview.svelte`) after each room's name |
| `src/lib/features/sidebar/RoomNav.svelte` | `rooms` wrapped in `echoSectionRooms(…)` (`echo/space-dms.ts`): a space's and the unspaced list's DMs |
| `src/lib/features/sidebar/NavigationRail.svelte` | `<EchoRailBand>` (`echo/components/RailBand.svelte`) after each rail tile: the parted band under the open one |
| `src/lib/features/room/RoomView.svelte` | `const panels = echoRoomPanels(new RoomPanels())` (`echo/panels.ts`) |
| `src/lib/features/room/RoomView.svelte` | `MentionProfile` imported from `echo/components/ProfileModal.svelte`: echo's centred profile modal on desktop, Sable's popover otherwise |
| `src/lib/features/sidebar/RoomNav.svelte` | `MentionProfile` imported from `echo/components/ProfileModal.svelte`, as in `RoomView.svelte` (call participants) |
| `src/lib/ui/primitives/identity-color.ts` | `senderColor` returns through `echoSenderColor(…)` (`echo/sender-color.ts`): echo-gomuks's ten colours and formula |
| `src/lib/features/room/members/members.ts` | your own name takes `echoSenderColor(…)` instead of the plain text colour (two call sites) |
| `src-tauri/src/lib.rs`, `tray.rs`, `webkit.rs`, `Info.plist` | "Sable" → "echo" in the macOS permission prompts, the tray tooltip and the proxy error dialog |
| `src/lib/ui/motion.ts` | `shouldReduceMotion` passes the system query through `echoSystemReducedMotion(…)` (`echo/motion.ts`): Sable's own setting decides |
| `src/lib/rooms/permalink.ts` | `sectionPath` returns `echoRoomPath(…)` (`echo/places.ts`) when echo picks the place (two lines) |
| `src/routes/(app)/+page.svelte` | start-up fallback is `echoStartPath() ?? resolve('/(app)/rooms')` (`echo/places.ts`): Home |
| `src/lib/features/sidebar/RoomNav.svelte` | `roomHref`'s last fallback is `echoRoomPath(…) ?? …/home/…` (`echo/places.ts`): a space's DMs open in the space |
| `src/routes/(app)/home/+page.svelte` | `HomeLanding` imported from `echo/components/EmptyPane.svelte`: an empty pane on desktop |
| `src/routes/(app)/rooms/+page.svelte` | `HomeLanding` imported from `echo/components/EmptyPane.svelte`, as for Home |
| `src/lib/features/room/timeline/timeline-layout.ts` | `ROOT_FONT_PX = echoRootFontPx(16)` (`echo/layout.ts`): 14 on echo's desktop |
| `src/routes/(app)/direct/[roomId]/+page.svelte` | `RoomOrForumPage` imported from `echo/components/DirectRoom.svelte`: on to the room in Home |
| `src/lib/features/sidebar/NavigationRail.svelte` | `folderOpen` returns `echoFolderOpen(…) ?? …`, and the folder's tile and caret try `echoEnterFolder(…)` / `echoLeaveFolder(…)` before Sable's toggle (`echo/folders.ts`) |
| `src/lib/features/sidebar/NavigationRail.svelte` | `...echoCreateEntries()` (`echo/create-menu.ts`) first in the create menu: New chat |
| `src/lib/rooms/room-list.svelte.ts` | `badgeUnreadFor` starts from `echoBadgeCounts(room)` (`echo/unread.ts`) instead of `roomUnread(room)` |
| `electron/src/updater.ts` | `echoUseUpdateFeed(autoUpdater)` after Sable's `setFeedURL` (`echo/electron/updater.ts`): echo's feed in echo builds |
| `electron/src/main.ts` | `echoBranded(…)` around the core's `serviceName` and the screen-recording dialog's text (`echo/electron/app.ts`) |
| `electron/src/main.ts` | `DEEP_LINK_SCHEMES` is `echoDeepLinkSchemes() ?? (…)` (`echo/electron/app.ts`): only the build's own scheme |
| `electron/src/main.ts` | `registerDeepLinks` skips `setAsDefaultProtocolClient` when `ECHO_BUILD`: the Info.plist declaration routes echo's schemes |
| `electron/src/preload.ts` | `echoRedirectScheme: ECHO_SCHEME` (`echo/electron/app.ts`) in the `sableElectron` bridge, and its import (two lines) |
| `electron/package.mjs` | the builder config is `process.env.SABLE_BUILDER_CONFIG ?? …`: `build.sh` passes `echo/electron/electron-builder.echo.ts` |
| `src/lib/auth/redirect.ts` | `nativeRedirectUri` returns `echoNativeRedirectUri(…)` (`echo/auth.ts`) first when there is one, and its import (three lines) |
| `src/lib/features/sidebar/RoomNav.svelte` | `<EchoRoomRing {room} />` (`echo/components/RoomRing.svelte`) first in each row's badge lane (`.room-status`) |
| `src/lib/features/settings/category-panels.ts` | `echoReactionSettings` (`echo/settings.ts`) in the Notifications panels |
| `crates/sable-core/src/lib.rs` | `#[path = "../../../echo/core/reactions.rs"] mod echo_reactions;` (two lines) |
| `crates/sable-core/src/accounts.rs` | `self.echo_watch_reactions(&client, generation);` with Sable's other watchers |
| `crates/sable-core/src/protocol.rs` | a `CoreEvent::Echo { event }` variant carrying echo's own JSON events (five lines; `src/generated/protocol.ts` regenerated with `mise run generate:types`) |
| `vitest.config.ts` | `'echo/**/*.test.ts'` in the node project's `include`, so echo's unit tests run |
| `crates/sable-core/src/lib.rs` | `#[path = "../../../echo/core/brand.rs"] mod echo_brand;` (two lines) |
| `crates/sable-core/src/session.rs` | OAuth `client_name` is `echo_brand::APP_NAME` (`echo/core/brand.rs`) instead of "Sable" |
| `crates/sable-core/src/session.rs` | a native client's `client_uri` is `echo_brand::native_client_uri(scheme)`, falling back to Sable's `reverse_dns_url(scheme)` (one expression, wrapped by rustfmt) |
| `crates/sable-core/src/auth.rs` | `initial_device_display_name(echo_brand::APP_NAME)` for password and SSO sign-in (two lines) |
| `crates/sable-core/src/registration.rs` | the new account's `initial_device_display_name` is `echo_brand::APP_NAME`, and its test expects it |
| `crates/sable-core/src/notifications.rs` | a pusher's fallback name is `echo_brand::APP_NAME`, and its test expects it (three lines) |
| `crates/sable-core/src/media.rs` | the avatar fetcher's `user_agent(echo_brand::APP_NAME)` |
| `src/lib/features/settings/AboutSettings.svelte` | the heading is `echoAppName('Sable')` (`echo/branding.ts`): "echo" |
| `src/lib/ui/TitleBar.svelte` | the title is `echoAppName('Sable')` (`echo/branding.ts`), as on the About page |
| `src/lib/features/room/timeline/TimelineItem.svelte` | not a hook but a fix to Sable: clicking a sender's name mentions them by their room name (`roomIdentity.name`), not your private MSC4529 nickname for them, which went out in the message's text. Upstream has moved this to `message-sender.svelte.ts` (`mention`) with the same bug: carry it there on the next merge |

## Running

- `mise run echo:electron:build` — the branded Electron app (`dev.tbird.echo.dev`, ad-hoc signed)
  in `electron/release/mac-arm64/echo.app`; `-- --identifier dev.tbird.echo.test --version X.Y.Z`
  for other identities.
- `mise run echo:electron:dev` — the Electron app against the Vite dev server.
- `echo/release-electron.sh <version|patch|minor>` — the Electron release (see above).
- `mise run echo:dev` — the branded app for this desktop, with live reload.
- `mise run echo:build` — a branded, unsigned build.
- `echo/release.sh <version|patch|minor>` — a signed, notarized release published to
  `taylorbird/echo` with its updater feed (`latest.json`). Write `echo/RELEASE_NOTES.md` first.

Plain `mise run tauri dev` still runs unbranded Sable.

## Identity and updates

Dev and test builds use the bundle ID `dev.tbird.echo.dev`, so they don't collide with an
installed echo. (Not `dev.tbird.echo-dev`: that was echo-gomuks's dev data folder.) Releases use
`dev.tbird.echo`, which the gomuks-based echo (now
[echo-gomuks](https://github.com/taylorbird/echo-gomuks)) used. Its installed copies, and
Tauri echo 1.0's, check `taylorbird/echo`'s latest release for a `latest.json`, which Electron
releases stopped publishing in 1.4. Installs that took a release carrying it (up to 1.3.0) are
Electron echo now and update through `latest-mac.yml`; any still on Tauri stop finding updates
once 1.4 is the latest release. echo no longer removes the old app's leftover files (dropped
2026-10-30: no compatibility with echo-gomuks is kept).

Sign-in comes back to the app through a URL scheme of its own, mapped from the identifier
(`echo/electron/app.ts`): `dev.tbird.echo` uses `com.github.taylorbird.echo`, and a dev or test
build `com.github.taylorbird.echo<suffix>` (`dev.tbird.echo.dev` →
`com.github.taylorbird.echo.dev`), so an installed release and a dev build never take each
other's sign-in. The OAuth redirect is `<scheme>:/login`, the legacy SSO one `<scheme>://login`.
Each build declares only its own scheme in its Info.plist and doesn't take it over at run time
(no `setAsDefaultProtocolClient`). The core registers these with `client_uri`
`https://github.com/taylorbird/echo` (`echo/core/brand.rs`): MAS requires the scheme to start
with the reversed host (`com.github`) and never fetches the page, so echo needs no website.
Signed-in accounts don't need the old `moe.sable.next` scheme: a re-authentication whose
redirect differs from the stored client's registers a new client for the same device. Echo
builds dropped `moe.sable.next` outright; Tauri builds (`tauri.echo*.json`, mobile) keep it. An
unpackaged `dev.sh` copy declares nothing, so its sign-in ends in the browser at a
`com.github.taylorbird.echo.dev:/login?…` URL to hand to the running copy by hand.

## Upstream

Remotes: `upstream` (Sable's GitHub mirror) and `sable-forgejo`. Merge upstream weekly: in a
replay of Sable's history, echo's layer merged cleanly across 1 to 8 weeks of upstream changes,
but files like `RoomView.svelte` and `TimelineItem.svelte` change ~100 times a month, so keep
hooks in them small and merge often. Sable doesn't accept AI-assisted contributions, so nothing
here goes upstream.

The root `README.md` is echo's, for people installing the app; Sable's lives at
`SABLE_README.md`. When a merge conflicts on `README.md`, keep echo's and carry Sable's changes
into `SABLE_README.md` (its relative links point one folder up, `../`).
