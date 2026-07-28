# Work Log

<!-- Entries prepended, newest first -->

## 2026-07-28 15:23

**Session Summary**: A very large visual-design iteration session on the Tauri macOS app (`npx tauri dev` from `web/`, verified only via Vite HMR log lines plus the user's own eyes and two pasted screenshots — Claude still cannot screenshot the Tauri window itself), plus two functional fixes and one new feature. Covered: room-list-vs-chat-pane contrast and pane stacking order, several palette reversals ending on Ferra warm surfaces with a cool near-black chat pane and saturated candy sender colours, room header retokenization and growth, chat text hierarchy rework, header icon resizing, right-panel raise/slide-in, a reduced-motion diagnosis and fix, a dark-surface shadow-visibility diagnosis and fix, a new "ignore reduce motion" preference, a drag-and-drop bug fix, a reaction-hover-tooltip feature, room topic/name tooltips, a full settings-page redesign, a toggle-component redesign, a modal edge/backdrop fix, a corner-radius reversal, and a Cmd+, keyboard shortcut. All work is UNCOMMITTED on branch `main`; a commit is being made right after this checkpoint. `npx tsc -b` and `npx eslint` were clean on every file touched; 11 pre-existing eslint errors remain in files NOT touched this session and are not attributable to this work.

**Decisions Made**:
- Gave the room list and space rail their own high-alpha tints instead of relying on macOS vibrancy alone: `--room-list-background`/`--room-list-background-overlay` were both `transparent` in Tauri, so the sidebar's tone was purely the wallpaper blur and could accidentally match the opaque chat pane exactly depending on the desktop background.
- Replaced the chat pane's sideways-blurring drop shadow (`0 6px 20px`) with an inset recess shadow on its left edge, plus a raise shadow + `z-index: 3` on the room-list wrapper — root cause of the "chat reads as on top" look was the chat pane having no left margin (flush against the room list) so its old shadow blurred onto the room list instead of separating from it.
- Palette went through several user-driven reversals (Ferra warm -> neutral graphite "to cool it down and get the font right" -> back to Ferra with candy pastel accents -> candy *saturated* accents including a real red) before landing on: Ferra warm surfaces, warm off-white body text, a cool near-black chat pane, saturated candy sender colours.
- Tokenised room header height as `--room-header-height` (was hardcoded `3.5rem` in three separate files) rather than fixing the value in place, so the header could be grown to `4.75rem` in Tauri from one place; added `position: relative; z-index: 1` because the header is an earlier grid item than the timeline and its cast shadow would otherwise paint underneath the messages.
- Rebalanced chat text hierarchy: body moved off Ferra's saturated peach (`#fecdb2`) to a warm off-white (`#efe7e1`), secondary text off cool lavender (`#d1d1e0`) to warm gray (`#b8aca6`), and the sender name stepped DOWN in size (`.875rem`, weight 600, `.015em` tracking) to read as a label over the message rather than competing with it — hue alone wasn't enough separation when both lines were the same size and equally chromatic.
- Scoped the cool near-black chat palette (`--background-color: #16181f`) to `div.room-view` only so sidebars keep their Ferra warmth, accepting that this makes the composer (`#1e212a`) lighter than the pane, breaking the earlier "recessed input is always the darkest surface" assumption, and that a black recess shadow becomes nearly invisible on near-black.
- Replaced filled Material icons in the room header with new outlined ones AND shrunk the glyph to `1.25rem` inside the unchanged `2.5rem` tap target — concluded the oversized glyph, not just its fill style, was driving the "clunky" look, since scaling an SVG down also thins its stroke.
- Right panel raised with a mirrored shadow + `z-index: 3` and pointed its background at `--room-list-background` (matches the room list, which shares its window-edge vibrancy situation) rather than at the room-header token, which composites over the opaque chat pane and lands darker despite sharing a token name.
- Diagnosed that NO animation was possible on this machine: macOS "Reduce motion" is ON (`defaults read com.apple.universalaccess reduceMotion` -> `1`), and every reduced-motion CSS rule in the app said `animation: none`/`transition: none`, so the requested right-panel animation could never have appeared regardless of what was written. Changed the reduced-motion branch to a 120ms opacity fade instead of no motion at all, on the principle that reduce-motion should not mean "remove all feedback."
- Diagnosed that shadows were invisible on the near-black chat pane because a black shadow has nothing left to darken on an already near-black surface; replaced both raise shadows with a light edge line plus a dark blur (`1px 0 0 rgba(255,255,255,.07), 8px 0 24px rgba(0,0,0,.6)` and its mirror).
- Built the "ignore reduce motion" escape hatch as an attribute on `<html>` (`data-ignore-reduce-motion`, toggled via a `useEffect` in `StylePreferences.tsx`) rather than trying to conditionally suppress the media query, because CSS cannot un-match `prefers-reduced-motion` — every affected rule now requires the attribute to be ABSENT. Also patched the JS `matchMedia` check in `MainScreen.tsx`'s `activeRoomReducer` so the toggle isn't half-applied on narrow/mobile layouts.
- Fixed drag-and-drop from CleanShot X by setting `"dragDropEnabled": false` in `tauri.conf.json` rather than touching the composer's HTML5 handlers (already correct) — the installed CLI's config schema states this must be false for HTML5 drag-and-drop to reach the frontend; it defaults to `true`, and Tauri's native handler was consuming the drop first.
- Built reaction-hover tooltips on the existing `get_related_events` RPC (relation type `m.annotation`, the same call `EventEditHistory.tsx` already makes for `m.replace`) rather than changing the Go backend, since the backend aggregates `m.reaction` events into bare counts and discards senders (`FillReactionCounts`, `pkg/hicli/database/event.go:225`) and changing that would require a sidecar rebuild. Fetches lazily on first hover; cache invalidated by a `countSignature` of `key:count` pairs. Required moving the reaction pill's ellipsis-clipping `overflow: hidden` from `div.reaction` to a new inner `div.reaction-inner` so it wouldn't clip an absolutely-positioned tooltip.
- Settings page redesign: corrected an early draft that made the room name the headline (read as "settings for this room only") to a "Settings" headline with the room appearing only as a small inline avatar chip inside explanatory sentence text.
- Preference matrix regrouped from four flat, ambiguously-labelled columns (two both called "This room") into a 2x2 with spanning group headers ("Everywhere" / "Only in {room}") over "All devices"/"This device", with both header rows sticky via a `--group-head-height` token.
- Room-scoped half of the matrix given a recessed darker band (`--settings-room-wash: rgba(0,0,0,.26)` for cells, an opaque color-mix for sticky headers so rows can't scroll through them) — the first attempt (`rgba(127,127,127,.07)`) was invisible on an already-gray card, per direct user feedback.
- Dropped the settings modal to `border-radius: 0` early in the session (citing the user's standing square-corner preference), then reversed to `.625rem`/`.375rem` after the user flagged "sharp edges" twice — concluded the square-corner preference is specifically about panes that butt against each other and the window edge, not modals that float over a blurred backdrop where a 90° corner reads as harsh.
- Added `Super+,`/`Ctrl+,` to open settings, matching the user's explicit request for "the Mac native keyboard shortcut."

**Actions Taken**:
- `web/src/index.css`: sidebar tint tokens, chat-pane recess shadow, room-header shadow token, right-panel raise shadow + background token, reduced-motion rule for the right panel gated on `data-ignore-reduce-motion` being absent, modal overlay `backdrop-filter: blur(var(--modal-backdrop-blur)) saturate(115%)` with a `0px`/`20px` token split on `html[data-tauri]`, dim lightened from `.75` to `.5` black.
- `web/src/ui/MainScreen.css` / `MainScreen.tsx`: `--room-header-height` consumption, mobile-slide reduced-motion rule gated the same way, `activeRoomReducer` `matchMedia` check patched for the ignore-reduce-motion escape hatch.
- `web/src/ui/util/ResizeHandle.css` / `ResizeHandle.tsx`: reduced-motion glow rule gated the same way.
- `web/src/ui/roomlist/RoomList.css` / `RoomList.tsx` / `FakeSpace.tsx`: section-chevron reduced-motion rule gated the same way; sidebar tint application.
- Room header CSS/TSX (three files touched to retokenize `--room-header-height`, exact file names not itemized in the brief): height, title size, avatar size, shadow, icon set swap and resize, `title` attributes added to room name and topic for hover-reachable full text.
- `web/src/preferences.ts`: new "Ignore reduce motion" preference, `allowedContexts: globalDeviceSpecific`, default `false`.
- `StylePreferences.tsx`: `useEffect` toggling `data-ignore-reduce-motion` on `<html>`.
- Reaction pill component + CSS: `div.reaction-inner` added as the clipping boundary; new hover-triggered fetch via `get_related_events` (`m.annotation`) with lazy load and `countSignature`-keyed cache invalidation.
- `web/src-tauri/tauri.conf.json`: added `"dragDropEnabled": false`.
- `SettingsView.tsx` / `SettingsView.css`: full rewrite — masthead, section cards with six new outlined icons (sliders-horizontal, palette, braces, key, log-out, door-open), 2x2 preference matrix with sticky spanning headers, room-scoped recessed band, secondary descriptive text surfaced under each preference row, `.set` highlight switched from `background-color` to a layered `background-image` gradient.
- `web/src/icons/modern/`: six new icons added for settings.
- `opener.tsx`: settings modal given its own `boxClass: "settings-view-modal"`.
- `Toggle.css`: rewritten — `2.5em x 1.375em` filled recessed track (was `3.5em x 2em` outlined), white knob with its own shadow at both states, travel via `translate` (was `margin-left`), "on" state uses `--accent-glow-color`, respects the ignore-reduce-motion pattern, `--disabled-color` kept as a fallback.
- `web/src/ui/keybindings.ts`: added `"Super+,"` / `"Ctrl+,"` to `keyDownMap`, opening `modals.settings(this.activeRoom)` via `window.openNestableModal`.
- Verified `npx tsc -b` clean and `npx eslint` clean on every file touched throughout; confirmed the 11 pre-existing eslint errors in `WebAuthLogin.tsx`, `MessageComposer.tsx`, `useSecondaryItems.tsx`, `TimelineEvent.tsx` are unrelated to this session's changes (the `TimelineEvent.tsx` ones sit in code not modified this session, just at shifted line numbers).

**Context/Thoughts**:
- Two CSS specificity bugs were caught and fixed mid-session, worth remembering as a pattern: (1) building settings section cards on `--room-list-background-overlay` would have left them with no surface at all, since `index.css` forces that token `transparent` inside `html[data-tauri]` to let vibrancy show through the room list — fixed by deriving surfaces from `--background-color` via `color-mix` instead; (2) `> div.scope-room_account { padding-left: .5rem }` was being reset to zero by a later `> div.preference { padding: .5rem 0 }` shorthand at equal specificity — fixed by switching to `padding-block`. A related third case: the `.set` highlight was moved from `background-color` to a `background-image` gradient specifically so it layers over the room-scoped band instead of competing with it at equal specificity.
- The reduced-motion diagnosis (rule 10 in the brief) is a good example of "root cause, not just a fix" — the user responds well to being told an animation was blocked by an OS accessibility setting rather than just silently making one appear.
- The composer-lighter-than-pane and shadow-now-invisible consequences of the cool-dark-chat-pane decision were flagged as known follow-on effects, not fully resolved — see Next Actions in current.md.
- The right panel's saturated sender colours against its still-warm background (~3.1-4.2:1, under the 4.5:1 AA threshold for member names) is a contrast regression introduced by this session's colour work and is carried forward as an open question rather than fixed immediately.
- Claude still cannot screenshot the Tauri window directly; this session's visual verification leaned more heavily than before on the user pasting two actual screenshots, which is a meaningfully better feedback loop than the previous "Vite HMR + user's eyes only" pattern.

## 2026-07-27 19:05

**Session Summary**: A large frontend visual redesign of the Tauri macOS app, plus one functional bug fix. Fixed a dev-server port collision that had been silently loading a different project's app into the Seabug window. Implemented full macOS vibrancy/native window chrome (transparent window, sidebar effect, private API), replaced the earlier overlaid-titlebar approach with a solid full-width title bar, restyled the room/chat panes as floating square cards with gaps and shadows modelled on the Reeder RSS app, lightened the chat surface for contrast, split the room list into collapsible Rooms/Direct-messages sections, introduced a new hand-authored outlined icon set for the sidebar and space rail, added yellow glow accents to the active-space indicator and pane resize handles, and fixed a real bug where external links did nothing inside the webview. All work is UNCOMMITTED on branch `main`.

**Decisions Made**:
- Pin Vite dev port to 6173 with `strictPort: true`: the previous hardcoded `devUrl` (5173) plus Vite's silent port-walking meant the Tauri window could load an entirely different local project's dev server — this happened and the user caught it. `strictPort` makes the failure loud instead of silent.
- Full macOS vibrancy over CSS-only: user explicitly chose native vibrancy (`macOSPrivateApi: true`, transparent window, `windowEffects: sidebar`) and explicitly waived the App Store distribution concern ("this is basically a private app for me").
- Verify Tauri config option names against the installed CLI's JSON schema (`web/node_modules/@tauri-apps/cli/config.schema.json`) rather than recalling from memory, since Tauri config surface changes across versions.
- Solid title bar instead of overlay: the prior overlaid-titlebar left a "harsh edge" where the floating chat card's `margin-top: 28px` created a hard boundary line with nothing structural above it. A full solid title bar (2rem tall, matching the standard macOS titlebar height so traffic lights center without a `trafficLightPosition` override) replaced it.
- Title bar implemented as `position:fixed` + `top` offset on `main.matrix-main`, not a grid row: the responsive layout at max-width 45rem uses three 100%-width grid columns and slides via translate; a spanning grid row would have broken that.
- Pane treatment modelled on Reeder (per user screenshot): floating cards separated by gaps + shadow rather than slabs sharing borders. Square corners, not rounded — user explicitly said "I don't want it to be curved" after seeing an initial rounded version. Top margin removed (flush against title bar) per user request ("flush those up"), gap kept only on right/bottom.
- Sidebar/space-rail backgrounds made translucent so vibrancy shows through, but reading surfaces (chat/timeline) stay fully opaque by design so text contrast never depends on the user's wallpaper.
- Chat surface lightened (`--background-color` #38343d, up from #2b292d) per user request for background contrast; composer background moved darker (#2f2c34) in the same change so it still reads as a recessed input against the now-lighter pane.
- Room list grouped into Rooms / Direct messages using `room.dm_user_id` — the same field `DirectChatSpace.include()` already uses — so the new grouping can never disagree with the existing DM pseudo-space logic. Ordering changed from one global recency list to per-group recency (not yet confirmed with user as desired).
- New outlined icon set (`web/src/icons/modern/`) added alongside (not replacing) the existing filled Material Symbols icons, because the old filled glyphs stretched across an entire 35px tile were the source of the "big and blocky" look the user reported; only the sidebar/space rail were repointed at the new set.
- Space rail widened to 5.5rem (from 4.5rem), scoped to `html[data-tauri]` only: macOS traffic lights run to ~66pt from the window edge, and the old rail width was just barely too narrow, making the controls appear to overhang into the room list. Not applied to plain-browser use since there are no window controls there.
- Yellow glow accent (#f5d76e, the Ferra palette yellow) chosen for the active-space indicator and resize handles as a shared, reusable token set rather than one-off colors.
- Added `@tauri-apps/plugin-opener` (+ Rust `tauri-plugin-opener`) to fix dead external links, rather than changing the Go backend's HTML sanitizer, since the `target="_blank"` behavior in `pkg/hicli/html.go` is otherwise reasonable and the fix belongs on the client side that actually lacks a place to open a new tab.
- The link interceptor deliberately excludes `matrix:` URIs (already handled in-app) and same-origin links (they point at the gomuks backend for media/downloads and the system browser has no session cookie for them) — a known gap, not yet resolved.

**Actions Taken**:
- `web/vite.config.ts`: added `server.port: 6173`, `server.strictPort: true`.
- `web/src-tauri/tauri.conf.json`: `devUrl` -> `http://localhost:6173`; added `app.macOSPrivateApi: true`; window config gained `transparent: true`, `titleBarStyle: "Overlay"`, `hiddenTitle: true`, `windowEffects: { effects: ["sidebar"], state: "followsWindowActiveState", radius: 10 }`.
- `web/src-tauri/Cargo.toml`: added the `macos-private-api` Tauri feature; added `tauri-plugin-opener = "2"`.
- `web/index.html`: extended the existing inline module script to set `document.documentElement.dataset.tauri = "true"` when `window.__TAURI_INTERNALS__` exists.
- `web/src/ui/MainScreen.tsx`: added `<div className="app-titlebar" data-tauri-drag-region/>` before `{mainContent}`.
- `web/src/ui/MainScreen.css`: `div.app-titlebar` hidden by default, becomes a fixed full-width bar (`height: var(--titlebar-height)`, `background-color: var(--titlebar-background)`, `z-index: 4`) inside `html[data-tauri]`; `main.matrix-main` gets `top: var(--titlebar-height)`.
- `web/src/index.css`: added `--pane-gap`, `--pane-radius`, `--pane-shadow` tokens; gave `div.room-view` and `div.right-panel` opaque backgrounds, margin-based gaps, radius, and shadow inside `html[data-tauri]`; made sidebar backgrounds translucent (`--room-list-background`, `--space-list-background-overlay`, etc.) and forced `html`/`body` background to transparent; retuned dark-mode tokens `--background-color`, `--composer-background-color`, `--timeline-hover-bg-color`, `--timeline-highlight-hover-bg-color`, `--timeline-jump-hover-bg-color`; added `--accent-glow-color`/`--accent-glow-near`/`--accent-glow-far` tokens; added `--space-bar-width` token (4.5rem default, 5.5rem in Tauri).
- `web/src/ui/roomlist/RoomList.tsx`: grouped the room list into collapsible Rooms/Direct-messages sections keyed on `room.dm_user_id`; removed the `reverseMap` import in favor of walking `roomList` backwards per group; sections with all rooms filtered out return null; added real `<button>` headers with `aria-expanded`, icon, label, rotating chevron; collapse state persisted to `localStorage` key `seabug.collapsed_room_list_sections` with a safe fallback to expanded; imports modern chevron-down/user/users icons.
- `web/src/ui/roomlist/RoomList.css`: resized rail glyphs to `1.375rem` inside the `2.5rem` tap target; restyled tiles (`border-radius: .625rem`, margin, `position: relative`); dropped the squircle `clip-path` on space avatars; added an `&.active::before` left-edge pill indicator recolored to the glow yellow with a two-layer box-shadow glow; switched the hardcoded rail width to `var(--space-bar-width)`.
- `web/src/ui/roomlist/FakeSpace.tsx`: imports modern home/user/bell/hash icons.
- New directory `web/src/icons/modern/`: `home.svg`, `user.svg`, `users.svg`, `bell.svg`, `hash.svg`, `chevron-down.svg` (24px grid, outlined stroke style).
- `web/src/ui/util/ResizeHandle.tsx`: added `isDragging` state, set on mousedown/mouseup, exposed as a `dragging` class.
- `web/src/ui/util/ResizeHandle.css`: rewritten so the hit area stays invisible and a thin `::after` bar lights up on hover/drag with the glow-yellow tokens, respecting `prefers-reduced-motion`; `z-index: 2` added so the glow reads above pane shadows.
- `web/package.json`/`package-lock.json`: added `@tauri-apps/plugin-opener` `^2.5.4` as the project's first Tauri JS runtime dependency.
- `web/src-tauri/src/lib.rs`: registered `.plugin(tauri_plugin_opener::init())`.
- `web/src-tauri/capabilities/default.json`: added `"opener:allow-open-url"` permission.
- New file `web/src/util/externallinks.ts`: `handleExternalLinks()` — a delegated document click listener that opens `http:`/`https:`/`mailto:` links via the Tauri opener when running inside Tauri, no-ops in the browser, and skips `matrix:` URIs, already-prevented clicks, non-left-clicks, and same-origin links.
- `web/src/main.tsx`: calls `handleExternalLinks()` before `createRoot`.
- `web/src/vite-env.d.ts`: added `__TAURI_INTERNALS__?: unknown` to the Window interface.
- Verified `npx tsc -b` and `npx eslint` clean after each change; confirmed the Rust rebuild succeeded (`tauri-plugin-opener v2.5.4` compiled, "Finished dev profile in 10.87s") and the backend/webview relaunched successfully.

**Context/Thoughts**:
- The port collision was a real bug the user caught, not something Claude self-diagnosed — worth remembering that hardcoded dev URLs paired with tools that silently fall back to another port are a recurring risk class.
- An unverified concern remains: `div.room-view` carries `contain: strict`, and it's unconfirmed whether an element's own box-shadow paints outside its own paint-containment clip. If the floating panes show a gap but look flat with no shadow, this is the likely cause.
- Claude could not visually inspect the running app this session: `screencapture` fails (no Screen Recording permission for the terminal), chrome-devtools MCP couldn't attach, and `osascript`/System Events reports 0 windows for the transparent Tauri window (an Accessibility quirk of transparent windows). The working substitute was confirming the webview stayed alive via `lsof` on the established WebKit connection to port 6173, combined with Vite HMR and the user's own eyes — this loop worked well but means none of this session's visual claims are self-verified by Claude.
- The user's last request at pause — "some contrast on the reading screen" — was not yet clarified; the current hypothesis is to darken room-header/composer chrome relative to the message area, but that has not been confirmed with the user.
- Drag-drop image upload (carried over from a previous session) was not touched this session; the untested hypothesis is that Tauri's native OS-level file-drop handler swallows the drop before the webview sees it, since `dragDropEnabled` is not set anywhere and Tauri's default may apply.
- A Bash PreToolUse hook in this environment rejects some compound/looping shell commands (e.g., `for` loops using `lsof`); python3 one-liners or separate single-purpose calls were used instead.

## 2026-02-18 20:20

**Session Summary**: Finalized app icon with custom lobster/seabug image. Iterated through multiple icon versions until finding the right one (seabug.png with transparency). Regenerated all icon sizes and formats (PNG, icns). Confirmed production build shows the icon correctly. Discussed future mobile support - Tauri 2.0 supports iOS/Android, and matrix-rust-sdk is the planned backend approach for cross-platform support.

**Decisions Made**:
- matrix-rust-sdk for mobile: Will replace Go sidecar for iOS/Android support, runs natively in Tauri's Rust layer
- Production build for icon: Dev mode uses cached icon, production build required to see custom icon

**Actions Taken**:
- Regenerated icons from seabug.png (RGBA with transparency)
- Built production Seabug.app with new icon
- Confirmed icon appears correctly in dock

**Context/Thoughts**:
- Tauri dev mode never shows custom icons - this is expected behavior
- For mobile, Go sidecar won't work - need matrix-rust-sdk or similar
- Element X uses matrix-rust-sdk, so it's a proven approach
- Other backend options: matrix-js-sdk (JS), WASM, gomobile (complex)

## 2026-02-18 20:05

**Session Summary**: Major visual redesign of the gomuks frontend. Applied user's custom "Ferra" warm color theme from their Element themes repo. Changed fonts to Lato at 14px. Redesigned room list with better spacing and alignment. Restructured message composer with icons below text input. Added faded timestamps and thinner scrollbars. Implemented custom user color feature with right-click color picker (using react-colorful). Added "Hide/Show images" toggle to message context menu. Changed preferences defaults (show_media_previews: true, show_hidden_events: false). Attempted drag-drop image upload on composer (needs testing). Renamed app to "Seabug" and added custom lobster icon.

**Decisions Made**:
- Lato font over Inter/Fira Code: cleaner look, good readability
- Ferra theme colors: warm oranges/corals (#fecdb2 text, #ffa07a accent) on dark backgrounds
- Three-tone background gradient: spaces bar darkest, room list dark, messages lightest
- Custom user colors stored in localStorage: simple persistence without backend changes
- react-colorful for color wheel: lightweight, works well

**Actions Taken**:
- Updated index.css with Ferra color variables and font changes
- Added Google Fonts link for Lato in index.html
- Restyled RoomList.css: wider space bar, room entry alignment, preview text sizing
- Restyled MessageComposer.css: icons below text, smaller/faded icons, larger send button
- Added 50% opacity to timestamps in TimelineEvent.css
- Added thin scrollbar styles globally (6px)
- Created custom user color system in media.ts (localStorage persistence)
- Added UserColorCard component in TimelineEvent.tsx with color picker
- Added react-colorful dependency
- Added "Hide/Show images" toggle in useSecondaryItems.tsx
- Changed show_media_previews default to true, show_hidden_events to false
- Added drag/drop handlers to MessageComposer.tsx
- Renamed productName and window title to "Seabug" in tauri.conf.json
- Generated all icon sizes from lobster image (RGBA conversion required for Tauri)

**Context/Thoughts**:
- Tauri icons must be RGBA format (not RGB) - build will fail otherwise
- Tauri dev mode doesn't show custom icons - need production build to see them
- Drag/drop on composer may need more testing - was inconsistent during dev
- The app is now distinctly styled and feels like a custom Matrix client

## 2026-02-18 17:15

**Session Summary**: Built a native macOS app using Tauri to wrap the existing React frontend, with the Go backend running as a managed sidecar process. Solved authentication issues by creating a custom WebAuthLogin React component since Tauri's webview doesn't trigger HTTP Basic Auth dialogs like browsers do. Implemented proper lifecycle management so the backend starts with the app and stops when the app closes.

**Decisions Made**:
- Use Tauri over Electron: lighter weight (~10MB vs ~150MB), better performance, uses native webview
- Keep Go backend for now: works well, can migrate to JS later if desired
- Sidecar approach: Go binary bundled with app, spawned on launch, killed on exit
- Custom auth component: Tauri webview doesn't handle HTTP Basic Auth prompts, so we built a React login form

**Actions Taken**:
- Installed Rust via rustup
- Added Tauri to the web project with shell plugin for sidecar support
- Configured tauri.conf.json for Vite dev server integration
- Set up Go binary as sidecar in binaries/gomuks-aarch64-apple-darwin
- Modified lib.rs to spawn sidecar on setup and kill on exit (with proper Rust lifecycle management)
- Updated gomuks config.yaml to allow tauri:// origin and enable insecure_cookies for dev
- Created WebAuthLogin.tsx component with matching CSS
- Modified rpc.ts doAuth() to support credential passing
- Modified client.ts to add retryAuthWithCredentials()
- Modified App.tsx to show WebAuthLogin when AUTH_REQUIRED

**Context/Thoughts**:
- Tauri v2 uses `tauri://localhost` as origin on macOS
- The shell plugin's sidecar spawn returns a CommandChild that must be stored and killed on exit
- Vite proxy handles forwarding /_gomuks/* to localhost:29325 in dev mode
- Session cookies from browser don't transfer to Tauri webview (separate cookie stores)
- For production build, will need to bundle the Go binary properly with correct target triple

## 2026-02-18 12:30

**Session Summary**: Got the gomuks fork fully building and running locally. Installed libolm dependency via Homebrew, configured CGO flags for the Go build, verified both the Go backend and web frontend compile successfully, and confirmed the application runs at localhost:29325.

**Decisions Made**:
- Treat backend and frontend as unified system (gomuks architecture requires both to function)

**Actions Taken**:
- Installed libolm via Homebrew
- Configured CGO_CFLAGS and CGO_LDFLAGS for libolm headers/libs
- Built full Go project successfully
- Built web frontend with Vite
- Started gomuks and verified it runs on localhost:29325

**Context/Thoughts**:
- libolm is deprecated upstream but still works
- Web frontend is Vite + TypeScript + React (in web/src/)
- Ready to start actual frontend redesign work
