# echo

echo is a fork of [Sable](https://git.sable.moe/SableClient/Sable-next). Everything that makes
it echo lives in this folder, so that merging Sable's upstream stays cheap: echo changes Sable's
own files only with one-line hooks, listed below. Before adding another hook, see if the change
can live here instead.

## What's here

- `theme.css` — echo's look (palette, Inter / Fira Code) over Sable's design tokens, loaded
  right after `src/styles.css`. Outside `src/` because Sable's theme check allows literal
  colours only in `src/styles.css`. It imports one file per UI area from `styles/`
  (frame, rail, roomlist, timeline, panels, popups, loading), each targeting Sable's own
  markup and written against `design/SPEC.md`. Layout rules are desktop only
  (`width >= 48rem`); the phone layout stays Sable's until echo has its own.
- `components/` — the few pieces of echo's UI that CSS can't draw, each mounted from Sable's
  markup by a one-line hook (below).
- `layout.ts` — echo's desktop geometry that lives in Sable's script (the room list's width).
- `unread.ts` — echo's unread indicators: a muted room with unread messages still gets its dot
  in the room list and rail (Sable's core clears a muted room's counts). Desktop only.
- `branding.ts` — swaps "Sable" for "echo" in every locale bundle as it loads. Strings about
  the Sable project itself keep its name.
- `brand/logo.svg` — the in-app logo. `icons/` — native app icons, generated with
  `pnpm tauri icon /path/to/echo-icon-facet-split-squircle.png --output echo/icons`.
- `tauri.echo.conf.json` — merged over `src-tauri/tauri.conf.json` by the echo tasks: name,
  bundle ID, window, icons, update feed.
- `visual/` — `mise run echo:shots`: screenshots of the signed-in web app against a throwaway
  homeserver with fake data. See `visual/README.md`.

Fonts are in `static/fonts/echo/`, since that's where Vite serves static files from.

## Hooks into Sable's files

| File | Hook |
| --- | --- |
| `src/routes/+layout.svelte` | `import '../../echo/theme.css'` after `styles.css` |
| `src/lib/locales.ts` | `brandLocale(...)` around the loaded bundle |
| `src/lib/i18n.ts` | `brandLocale(en)` for the built-in English fallback |
| `src/lib/ui/SableBrandMark.svelte` | logo import points at `echo/brand/logo.svg` |
| `src/lib/features/sidebar/AppShell.svelte` | room list starts at `ECHO_ROOM_NAV_WIDTH` (`echo/layout.ts`) instead of 288 |
| `src/lib/features/sidebar/RoomNav.svelte` | `<EchoRoomPreview>` (`echo/components/RoomPreview.svelte`) after each room's name |
| `src/lib/features/sidebar/NavigationRail.svelte` | `<EchoRailBand>` (`echo/components/RailBand.svelte`) after each rail tile: the parted band under the open one |
| `src/lib/rooms/room-list.svelte.ts` | `badgeUnreadFor` starts from `echoBadgeCounts(room)` (`echo/unread.ts`) instead of `roomUnread(room)` |

## Running

- `mise run echo:dev` — the branded app for this desktop, with live reload.
- `mise run echo:build` — a branded, unsigned build.

Plain `mise run tauri dev` still runs unbranded Sable.

## Identity and updates

Dev and test builds use the bundle ID `dev.tbird.echo.dev`, so they don't collide with an
installed echo. (Not `dev.tbird.echo-dev`: that was echo-gomuks's dev data folder.) Releases will use `dev.tbird.echo`, which the gomuks-based echo (now
[echo-gomuks](https://github.com/taylorbird/echo-gomuks)) used: installed copies of that app
check `taylorbird/echo` for updates, so **don't publish a release with a `latest.json` here until
this app can replace it.**

## Upstream

Remotes: `upstream` (Sable's GitHub mirror) and `sable-forgejo`. Merge upstream weekly: in a
replay of Sable's history, echo's layer merged cleanly across 1 to 8 weeks of upstream changes,
but files like `RoomView.svelte` and `TimelineItem.svelte` change ~100 times a month, so keep
hooks in them small and merge often. Sable doesn't accept AI-assisted contributions, so nothing
here goes upstream.
