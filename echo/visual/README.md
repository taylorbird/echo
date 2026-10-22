# Visual screenshots

`mise run echo:shots` screenshots the signed-in web app so UI work can be checked against real
screens without touching a real account. It reuses the e2e suite's fixtures
(`tests/e2e/fixtures/continuwuity.ts`, `AuthFlow`) and build:

1. Starts a throwaway Continuwuity homeserver in Docker (`127.0.0.1:18008`, server name
   `test.local`).
2. Seeds it (`seed.ts`): five people with avatars, a "Work" space with general / design /
   random, two rooms outside it (Book club, Weekend plans), two DMs, and a busy #general with a
   reply, an edit, reactions, a mention, a link and a code block. design has an unread mention;
   general, random, Weekend plans and the DM with Alex are unread. Three more rooms carry the
   unread states a real account has: Announcements is muted with unread messages, Releases
   notifies on everything, and Reading list is read but marked unread. Every message is stamped at
   seeding time: backdating needs an appservice, which needs a server admin, and the e2e
   fixture's server never makes one.
3. Builds the app the way `pnpm test:e2e` does (skipped when `dist/` is newer than `src/`,
   `crates/`, `static/`, `echo/`, …) and serves it with `vite preview` on port 4199.
4. Signs in as `loginuser` (shown as Morgan Blake) with the password flow and takes screenshots
   in WebKit.
5. Removes the container and prints the list of screenshots.

Screenshots land in `echo/visual/out/` (gitignored), replaced on every run:

| File | View |
| --- | --- |
| `desktop-{light,dark}-roomlist.png` | home / room list, 1512×982 @2x |
| `desktop-{light,dark}-home.png` | Home (all rooms) with echo's parted rail open |
| `desktop-{light,dark}-home-dms.png` | Home narrowed to direct messages by the rail's sub-filter |
| `desktop-{light,dark}-space.png` | the Work space's room list |
| `desktop-{light,dark}-timeline.png` | #general, members panel closed |
| `desktop-{light,dark}-members.png` | #general with the members panel |
| `desktop-{light,dark}-members-esc.png` | #general after Esc closed the members panel |
| `desktop-{light,dark}-members-next-room.png` | Book club, opened with the members panel open in #general: it stays closed |
| `desktop-{light,dark}-profile.png` | Alex Rivera's profile card |
| `desktop-{light,dark}-settings.png` | settings |
| `desktop-{light,dark}-modal-room-settings.png` | #general's room settings dialog |
| `app-{light,dark}-{home,timeline,members}.png` | the same views with the macOS app's chrome (`data-echo-app`, `data-tauri-os`, `data-client-decorations` set on `<html>` by hand): floating panes, no title band |
| `app-dark-space-{all,rooms,dms,recent}.png` | the Work space in the app with each rail sub-filter selected; the selected row's box goes to `out/.pill-space-<filter>.json`, to check the pill against it |
| `app-dark-home-empty.png` | Home with no room open: echo's empty pane; checks the band's DM tiles open in Home |
| `app-dark-create-menu.png` | the rail's create (+) menu, with New chat |
| `app-dark-space-dm-open.png` | the DM with Alex opened from the Work space's DMs: it stays in the space |
| `phone-light-{roomlist,timeline}.png` | 390×844 @3x |
| `setup-<step>.png`, `setup-<step>-scrolled.png` | each setup step after a fresh sign-in at a short 1280×440 window, before and after a wheel; `out/.setup-scroll.json` records how far each overflowed and scrolled |

A view that can't be reached is skipped with a warning and the rest still run; what was on
screen instead goes to `out/.debug/` (a screenshot and an accessibility snapshot).

First time: `pnpm exec playwright install webkit` (or `chromium` with
`ECHO_SHOTS_BROWSER=chromium`).

## Fast re-runs

Starting and seeding the homeserver is only seconds; rebuilding the app is the slow part, and it
already only happens when sources changed. Keeping the homeserver also skips re-registering
everyone:

```sh
ECHO_SHOTS_KEEP=1 mise run echo:shots   # leaves the homeserver running
ECHO_SHOTS_KEEP=1 mise run echo:shots   # reuses it: no container start, no seeding
mise run echo:shots                     # reuses it once more, then removes it
mise run echo:shots:down                # or remove it without a run
```

The harness answers the app's read receipts itself, so screenshots never mark a room read and a
kept homeserver keeps its unread badges. Message times are fixed at seeding, so a homeserver kept
for days drifts from "yesterday and today".

## Options

| Variable | Effect |
| --- | --- |
| `ECHO_SHOTS_KEEP=1` | Keep the homeserver for the next run. |
| `ECHO_SHOTS_RESEED=1` | Throw away a kept homeserver and seed a fresh one. |
| `ECHO_SHOTS_BUILD=1` / `0` | Always / never rebuild the app, instead of checking timestamps. |
| `ECHO_SHOTS_BROWSER=chromium` | Chromium instead of WebKit. |
| `ECHO_SHOTS_PORT` | Port for `vite preview` (default 4199). |
| `ECHO_SHOTS_LIVE_CSS=1` | Layer `echo/theme.css` as it is on disk over the built app, so CSS-only changes skip the rebuild (pair with `ECHO_SHOTS_BUILD=0`). Rules deleted since the last build still apply until the next one. |
| `ECHO_SHOTS_DOM=1` | Also save each view's rendered HTML next to its screenshot, to write CSS against Sable's real markup. |

Playwright arguments pass through, e.g. `mise run echo:shots --grep phone`.

The homeserver uses the same fixed port as the e2e suite, so don't run both at once: each one
removes a container it finds on port 18008.
