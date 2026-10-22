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
  markup and written against `design/SPEC.md`. Those layout rules are desktop only
  (`width >= 48rem`); `mobile.css` and `mobile-timeline.css` are the phone's (`width < 48rem`).
- `mobile/` — echo's own phone UI, separate from the desktop's (decided 2026-10-20: phones get
  their own screens, sharing Sable's core and stores). `Shell.svelte` is where Sable mounts its
  phone drawer: on a phone with echo on it mounts `PhoneShell.svelte` instead — the room list
  screen (`RoomListScreen.svelte`) with the open page pushed over it, swiped back from the left
  edge — and anywhere else Sable's drawer as before. The list switches places (all, DMs, rooms,
  a space) with chips under its title; Sable's bottom bar stays for search, inbox and account.
- `ios/` — the iOS app: `prepare.mjs` writes echo's copy of Sable's Xcode template and icon
  catalog before `tauri ios init`; `sim.sh` runs the dev build in a named simulator.
- `tauri.echo.ios.conf.json` — merged after `tauri.echo.conf.json` for iOS: the dev bundle ID,
  echo's Xcode template, no development team, Vite on port 3027.
- `components/` — the few pieces of echo's UI that CSS can't draw, each mounted from Sable's
  markup by a one-line hook (below).
- `layout.ts` — echo's desktop geometry that lives in Sable's script (the room list's width).
- `active.ts` — whether echo's layer is running (`init.ts` switches it on). Where echo changes
  what Sable shows rather than how it looks (extra DMs in a list, panels starting closed,
  muted-room dots, the rail band) it checks this, so Sable's component tests, which render
  without the app's layout, keep testing Sable.
- `init.ts` — start-up: echo's defaults where they differ from Sable's (Home on in the rail, and
  on macOS Sable's own title bar, which puts the window in overlay style so the panes can run to
  the top edge), and in the macOS app the headers as window drag regions.
- `panels.ts` — echo's right panel: each room opens with it closed (Sable reopened a
  remembered members panel in every room), and Esc closes it. Desktop only.
- `space-dms.ts` — which DMs a place lists, as echo decided: a space lists DMs with members of
  it or a space below it, the rooms outside spaces list every DM. Desktop only.
- `places.ts` — where a room opens, as echo-gomuks did it: Home is one more place in the rail,
  so a room opens in the place that's open when it lists the room (Home lists every chat, a
  space its rooms and the DMs `space-dms.ts` adds), otherwise in its space or Home, never in the
  rooms outside spaces or direct messages, whose rail tiles echo hides (`styles/rail.css`).
  Start-up with no room to restore lands in Home. Desktop only.
- `create-menu.ts` — "New chat" in the rail's create (+) menu, since the direct messages section
  that offered it has no tile. Desktop only.
- `unread.ts` — echo's unread indicators: a muted room with unread messages still gets its dot
  in the room list and rail (Sable's core clears a muted room's counts). Desktop only.
- `branding.ts` — swaps "Sable" for "echo" in every locale bundle as it loads. Strings about
  the Sable project itself keep its name.
- `brand/logo.svg` — the in-app logo. `icons/` — native app icons, generated with
  `pnpm tauri icon /path/to/echo-icon-facet-split-squircle.png --output echo/icons`.
- `tauri.echo.conf.json` — merged over `src-tauri/tauri.conf.json` by the echo tasks: name,
  bundle ID, window, icons, update feed.
- `tauri.echo.release.conf.json` — merged on top for releases: bundle ID `dev.tbird.echo`, echo's
  version, Developer ID signing and updater artifacts. `release.sh` builds with it.
- `legacy.rs` — removes echo-gomuks's leftover files (its database, config, media cache and logs)
  at start-up, for installs that updated from it.
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
| `src/lib/features/sidebar/AppShell.svelte` | `MobileNavDrawer` imported from `echo/mobile/Shell.svelte`: echo's phone shell on a phone, Sable's drawer otherwise |
| `src/lib/features/sidebar/RoomNav.svelte` | `<EchoRoomPreview>` (`echo/components/RoomPreview.svelte`) after each room's name |
| `src/lib/features/sidebar/RoomNav.svelte` | `rooms` wrapped in `echoSectionRooms(…)` (`echo/space-dms.ts`): a space's and the unspaced list's DMs |
| `src/lib/features/sidebar/NavigationRail.svelte` | `<EchoRailBand>` (`echo/components/RailBand.svelte`) after each rail tile: the parted band under the open one |
| `src/lib/features/room/RoomView.svelte` | `const panels = echoRoomPanels(new RoomPanels())` (`echo/panels.ts`) |
| `src/lib/features/room/RoomView.svelte` | `MentionProfile` imported from `echo/components/ProfileModal.svelte`: echo's centred profile modal on desktop, Sable's popover otherwise |
| `src/lib/features/sidebar/RoomNav.svelte` | `MentionProfile` imported from `echo/components/ProfileModal.svelte`, as in `RoomView.svelte` (call participants) |
| `src/lib/ui/primitives/identity-color.ts` | `senderColor` returns through `echoSenderColor(…)` (`echo/sender-color.ts`): echo-gomuks's ten colours and formula |
| `src/lib/features/room/members/members.ts` | your own name takes `echoSenderColor(…)` instead of the plain text colour (two call sites) |
| `src-tauri/src/lib.rs` | `#[path] mod echo_legacy;` and `echo_legacy::remove_gomuks_leftovers(…)` first in `setup` (`echo/legacy.rs`) |
| `src-tauri/src/lib.rs`, `tray.rs`, `webkit.rs`, `Info.plist` | "Sable" → "echo" in the macOS permission prompts, the tray tooltip and the proxy error dialog |
| `src/lib/ui/motion.ts` | `shouldReduceMotion` passes the system query through `echoSystemReducedMotion(…)` (`echo/motion.ts`): Sable's own setting decides |
| `src/lib/rooms/permalink.ts` | `sectionPath` returns `echoRoomPath(…)` (`echo/places.ts`) when echo picks the place (two lines) |
| `src/routes/(app)/+page.svelte` | start-up fallback is `echoStartPath() ?? resolve('/(app)/rooms')` (`echo/places.ts`): Home |
| `src/lib/features/sidebar/RoomNav.svelte` | `roomHref`'s last fallback is `echoRoomPath(…) ?? …/home/…` (`echo/places.ts`): a space's DMs open in the space |
| `src/routes/(app)/home/+page.svelte` | `HomeLanding` imported from `echo/components/EmptyPane.svelte`: an empty pane on desktop |
| `src/routes/(app)/rooms/+page.svelte` | `HomeLanding` imported from `echo/components/EmptyPane.svelte`, as for Home |
| `src/lib/features/sidebar/NavigationRail.svelte` | `...echoCreateEntries()` (`echo/create-menu.ts`) first in the create menu: New chat |
| `src/lib/rooms/room-list.svelte.ts` | `badgeUnreadFor` starts from `echoBadgeCounts(room)` (`echo/unread.ts`) instead of `roomUnread(room)` |

## Running

- `mise run echo:dev` — the branded app for this desktop, with live reload.
- `mise run echo:build` — a branded, unsigned build.
- `mise run echo:ios:init` — generate the iOS Xcode project (`src-tauri/gen/apple`, gitignored)
  with echo's name, icon and dev bundle ID. Again after Sable's `src-tauri/ios-project.yml`
  changes.
- `mise run echo:ios "iPhone 16 Pro"` — the iOS app in the Simulator with live reload
  (`tauri ios dev`). Tauri only runs it on a simulator with Xcode's own iOS version; with an
  older runtime it opens Xcode instead. Then use `mise run echo:ios:sim "iPhone 16 Pro"`, which
  builds with xcodebuild and launches it there itself (`ios/sim.sh`).
- `mise run echo:ios:build` — an unsigned debug build for the simulator (same runtime caveat).
- `echo/release.sh <version|patch|minor>` — a signed, notarized release published to
  `taylorbird/echo` with its updater feed (`latest.json`). Write `echo/RELEASE_NOTES.md` first.

Plain `mise run tauri dev` still runs unbranded Sable.

## Identity and updates

Dev and test builds use the bundle ID `dev.tbird.echo.dev`, so they don't collide with an
installed echo. (Not `dev.tbird.echo-dev`: that was echo-gomuks's dev data folder.) Releases use
`dev.tbird.echo`, which the gomuks-based echo (now
[echo-gomuks](https://github.com/taylorbird/echo-gomuks)) used, with the same updater key. Its
installed copies check `taylorbird/echo` for updates, so **every release published here with a
`latest.json` updates echo-gomuks 0.7.x installs into this app.** They sign in again and recover
their keys; `legacy.rs` clears the old app's files.

## Upstream

Remotes: `upstream` (Sable's GitHub mirror) and `sable-forgejo`. Merge upstream weekly: in a
replay of Sable's history, echo's layer merged cleanly across 1 to 8 weeks of upstream changes,
but files like `RoomView.svelte` and `TimelineItem.svelte` change ~100 times a month, so keep
hooks in them small and merge often. Sable doesn't accept AI-assisted contributions, so nothing
here goes upstream.
