# Constraints Ledger

Each constraint is dated with its origin and rationale. One-liners live in current.md for quick reference; full details here.

## 2026-07-28 (migrated from prior current.md)

### Architecture
**Tauri 2.0** — native macOS app shell (named "Seabug"), supports iOS/Android. **React frontend** in web/src/, connects to backend via WebSocket. **Go backend** spawned as sidecar, manages Matrix protocol, starts/stops with app. **Auth** via custom WebAuthLogin component for Tauri (browser uses HTTP Basic Auth).

### Theme
- Font: Lato (400 weight, 14px base)
- Surfaces (room list, space rail, right panel): Ferra warm with high-alpha tints (was transparent in Tauri, so tone would match the opaque chat pane)
- Chat pane: cool near-black `#16181f`, scoped to `div.room-view` only; composer `#1e212a` (lighter than pane)
- Body text: warm off-white `#efe7e1` (was saturated peach `#fecdb2`); secondary `#b8aca6` (was cool lavender `#d1d1e0`); sender name `.875rem` weight-600 tracking `.015em` (label over message, not competing)
- Accent glow: `#ffe484`
- Saturated candy sender colours: `#ff5d73`, `#ffa64d`, `#4dd6a8`, `#a78bfa`, `#4db8f5`, `#ffd93d`, `#ff7ac6`, `#4de0e0`, `#ff8a65`, `#a3e635`
- Room header: `--room-header-height` token (macOS: 4.75rem), title 1.375rem bold, avatar 3rem
- Right panel: raised over chat pane (mirrored shadow, z-index 3), background matches room-list
- Panes: square corners (no radius), floating with `.5rem` gaps, shadow, flush against title bar. Modals exception: `.625rem` box radius, `.375rem` section cards (blur backdrop makes sharp corners harsh)
- Icon: custom lobster/seabug on blue background
- Icon set: hand-authored outlined Lucide-style in `web/src/icons/modern/` for sidebar/space-rail/room-header/settings; filled Material Symbols for rest of app

### Technology
- Vite dev port pinned to 6173 with `strictPort: true` — otherwise port-walking could load a different local project into Seabug. `devUrl` in `tauri.conf.json` must match.
- All macOS-native chrome CSS scoped to `html[data-tauri]` so plain-browser use is unaffected
- App Store distribution NOT a constraint; `macOSPrivateApi: true` acceptable
- Reading surfaces (chat/timeline) stay fully opaque — text contrast never depends on wallpaper showing through vibrancy
- macOS "Reduce motion" is ON by default on this machine — every `prefers-reduced-motion` rule must require `data-ignore-reduce-motion` to be absent, or animation will never run
- Dark surfaces need light edge lines, not darker shadows — a pure black shadow is invisible on the near-black chat pane, so separation on dark surfaces comes from a light edge line
- Single `--room-header-height` token shared by room header, room-list search row, and right-panel header — keeps top edges aligned
- Do NOT build modal/settings surfaces on `--room-list-background-overlay` — forced `transparent` inside `html[data-tauri]` to show vibrancy; derive from `--background-color` via `color-mix` instead

### Mobile plans
Tauri 2.0 supports iOS/Android. Plan to use **matrix-rust-sdk** for backend:
- Runs natively in Tauri's Rust layer (not a sidecar)
- Works on all platforms
- Used by Element X
- Single codebase for desktop + mobile

## 2026-08-06 (URL previews + Quick Switcher)

### Modal edge idiom
On warm modal surfaces, solid `border` lines in theme colors are INVISIBLE. Working edge treatment: `inset 0 0 0 1px rgba(255,255,255,.18)` hairline ring (light) + `0 0 0 1px rgba(0,0,0,.6)` dark seam + two-layer neutral drop shadow + faint accent underglow `0 36px 100px rgba(255,228,132,.06)`.

### Quick Switcher reduced frosting
Transient launcher gets less blur than other modals — scoped via `div.overlay.modal:has(> div.modal-box.quick-switcher-modal)` override: `blur(3px)`, `rgba(0,0,0,.12)` vs app-wide `20px`/`.5`.

### Section dividers in quick switcher
Edge-to-edge 1px lines under search and above actions use `--quick-switcher-divider: color-mix(in srgb, var(--semisecondary-text-color) 40%, transparent)`. The 40% value chosen so the line optically matches the weight of small ROOMS/ACTIONS label text — full-strength 1px line reads brighter than small text in same ink.

### E2EE URL preview privacy
Encrypted rooms never auto-fetch URL previews by default (new preference `auto_load_encrypted_url_previews`, default false) — fetching leaks URLs to the homeserver, exposing reading activity.

### Webview preview tier is click-only
Hidden-webview OG fetches deliberately never auto-run — not even for recent messages. Auto mode would execute arbitrary posted URLs' JS on the local machine. Click-only so user explicitly opts into fetches.

## 2026-08-21 (candy color + room-list redesign, space dashboard, cheat console, platform alignment)

### Room-list virtualization prohibited
Room-list entries (`div.room-entry`) must NOT use `content-visibility: auto` / `contain: strict`. Reason: WebKit defers repaints of these elements until the next browser event loop cycle. During fast Alt+↑/↓ navigation, the old room's `.active` class removal and the new room's `.active` class addition both paint-defer, leaving two rooms visually highlighted for ~100ms until HMR or user interaction triggers another repaint. The `useContentVisibility` React hook depends on the `contentvisibilityautostatechange` event firing on the element itself, so the CSS property and the hook must be removed together. Entries now render unconditionally (no lazy mounting), trading memory for reliable visual state.

### useSyncExternalStore snapshot stability
`useSyncExternalStore` snapshot getters (e.g., `RoomStateStore.getMembers()`) must return stable references for empty collections. Returning a fresh `[]` on each call — even when the collection is logically empty — causes an infinite re-render loop because React sees the snapshot change (new `[]` object !== old `[]` object) on every render cycle. Solution: use a module-level `emptyMembers` constant that all empty cases return. This latent bug was exposed by the dashboard rendering member-related hooks on freshly-opened spaces before the space had any member state loaded.

### Tauri version lockstep requirement
The `tauri` crate minor version in `src-tauri/Cargo.toml` must stay in lockstep with the `@tauri-apps/api` npm package minor version. Mismatched minors (e.g., tauri 2.10 + @tauri-apps/api 2.11) cause a version-mismatch error at startup and suspected failures in plugin IPC (external links, clipboard, etc.). Always align them when upgrading — check the installed CLI's crate version, match the npm package, and rebuild both.

### Clipboard write fallback for WKWebView
WKWebView on macOS rejects `navigator.clipboard.writeText()` with no permission delegate available (unlike UIWebView on iOS or full Safari). Replace all bare `navigator.clipboard.writeText()` calls with `web/src/util/clipboard.ts` `copyToClipboard()`, which tries the Clipboard API first and falls back to `execCommand("copy")` on a hidden textarea if the promise rejects. This is used in ShareModal, useSecondaryItems (toggle images), and elsewhere.

### Timeline sender colors and per-user overrides
Sender names in the timeline use per-color `sender-color-N` CSS classes (generated via `getUserColorIndex()` from palette). Custom user colors and cheat overrides apply via `getUserColorOverride()` returning an inline `style={{ color: overrideColor }}` on the text element itself, not via class. This is necessary because the timeline's `sender-color-N` classes live on the `span` containing the name, and inline styles have higher specificity than classes — without this, custom color settings never take effect. The same pattern applies in ReplyBody.tsx.

### Preference category declaration required
Every preference must declare a `category` field (`appearance` / `chat` / `media` / `input` / `notifications` / `advanced`, with `advanced` as the fallback). The decision rule for scope is: "Would a reasonable person set this differently per room vs. globally, or per device vs. globally?" If yes, keep it scoped to the narrower context; if no, move it to global (anyGlobalContext). In 2026-08-21, 15 preferences were moved to global (code_block_theme, code_block_line_wrap, pointer_cursor, uniform_room_list_color, custom_css, favicon, small_replies, show_date_separators, upload_dialog, map_provider, leaflet_tile_template, gif_provider, message_context_menu, ctrl_enter_send, ctrl_arrow_reply). Stored values in removed scopes are ignored (not deleted) so reverting is safe.

### Zero-lint / zero-tsc baseline
As of 2026-08-21, the project compiles with zero TypeScript errors and zero eslint errors across all touched files. This baseline must be maintained: new code must pass `npx tsc -b` and `npx eslint` clean, with no passing of `--fix` or `--ignore-errors` flags. Pre-existing errors in untouched files are not attributable to new work and may be addressed separately.

## 2026-08-25 (production architecture, ACL discovery, font/timeline revisions, rebrand)

### Production webview architecture
**Prod webview loads http://localhost:29325 directly** — the same-origin backend URL, NOT the static dist served via tauri://. Root cause analysis found cross-origin tauri://localhost → http://localhost:29325 is impossible without server changes: Go server has no CORS middleware (exhttp.AutoAllowCORS=false in cmd/gomuks/main.go), and gomuks_auth cookie is SameSite=Lax (insecure_cookies strips Secure, incompatible with SameSite=None). **Never revert to static dist serving in prod.** Implementation: `src-tauri/src/lib.rs` waits for backend TCP readiness (500ms connect timeout, 100ms interval, 15s deadline) then builds the window with url overridden to the backend origin; dev branch unchanged (cfg!(debug_assertions)); `tauri.conf.json` windows[0] got `"create": false`. Frontend plumbing kept from earlier cross-origin attempt (web/src/api/backend.ts: BACKEND_URL/BACKEND_WS_URL/isTauri exports; all _gomuks call sites routed through it; gomuksWebWasm guarded with !window.__TAURI_INTERNALS__) — harmless same-origin, keeps dev working. **Consequence:** sidecar go:embeds web/dist, so any frontend change shipping to prod requires npm run build → go build ./cmd/gomuks → npx tauri build, in that order.

### Tauri ACL remote-origin discovery
**capabilities/default.json must have a `remote.urls` entry for http://localhost:29325 or ALL prod IPC is silently denied.** When a window loads an http:// URL (even localhost), Tauri treats it as REMOTE origin. Capabilities need an explicit `remote.urls` block or every IPC call fails silently. Dev is exempt because devUrl is the app URL (local origin). Also: `core:window:allow-start-dragging` is NOT in core:default and must be granted explicitly. **Side effect fixed:** external link opening via opener plugin now works in prod. **Known gap:** fetch_og_tags app command still needs an app permission file + capability entry (URL-preview webview tier dead in prod, needs follow-up work).

### Fonts: Inter base + Space Grotesk display
**Base font: Inter 400-700 via Google Fonts.** **Display font: Space Grotesk 400-700 via --display-font-stack token,** applied to: sidebar room names (RoomList.css), room header title (RoomViewHeader.css), space dashboard masthead/section titles/member names/room names (SpaceView.css), timeline sender names (TimelineEvent.css `span.event-sender` — also covers reply senders via shared class). Zero references to Lato remain. Lato fully replaced 2026-08-24.

### Timeline sender styling refresh
Sender row gets `min-height: calc(var(--timeline-avatar-size) - .25rem)` so the name centers on the avatar and text starts below it. `--timeline-sender-name-content-gap` back to 0. Sender names dimmed via `opacity: .75` on span.event-sender (opacity chosen over color tokens so per-user overrides/cheats dim equally). All sender names now .875rem/600/.015em tracking ("label" treatment). `--timeline-avatar-gap` doubled .5rem → 1rem. Dark-mode `--sender-color-5` changed #ffd93d → #f0c674 (honey gold; pure yellow mustardy under 75% dim).

### Rebrand: Seabug → echo
**Bundle ID: com.tbird.echo** (was app.gomuks.desktop). Window title, productName in tauri.conf.json, SettingsView masthead eyebrow, WebAuthLogin heading ("echo"), index.html <title> all set to "echo" (lowercase brand). localStorage keys `seabug.collapsed_room_list_sections` + `seabug_active_cheats` deliberately NOT renamed (would wipe browser-user state; migration shim is the option if needed later). **Side effect:** Bundle-ID change reset WKWebView storage (custom colors, cheats, collapsed sections) — one-time cost, accepted. **SUPERSEDED 2026-08-27:** Bundle ID changed again to `dev.tbird.echo` to match debug-profile naming convention (dev builds use `-dev` suffix). This reset WKWebView a second time (acceptable, already reset in 0.3.1). Data now lives under `~/Library/{Application Support,Caches,Logs}/dev.tbird.echo/`.

### Icon locked: low-poly faceted penguin
**Source of truth:** design/ folder (echo-penguin-facet.svg exact SVG outline + facets, echo-penguin-layer.png 1024 transparent RGBA). Icon set regenerated via `npx tauri icon design/echo-penguin-layer.png`. @tauri-apps/cli bumped ^2.10.0 → ^2.11.0 (installed 2.11.4; adds .icon/Assets.car bundler support). **Known blocker:** User's Icon Composer .icon (echo.icon, echo penguin side profile, pale-blue belly, violets #A78BFA→#4C1D95, blues #BFDBFE→#2563EB) crashes actool deterministically with "attempt to insert nil object" when its SVG layer uses clipPath. **Workaround:** must re-export using PNG layer instead. Until then, production builds require temporarily removing "icons/echo.icon" from bundle.icon; restore after. The 18:03 build that appeared successful is unexplained (possibly actool cache).

## 2026-08-27 (release pipeline, icon actool fix, TAC, external links, auth, storage, release.sh bugs)

### Bundler must never run actool — icons/Assets.car pre-compiled by release.sh
**Blocker root cause:** The "attempt to insert nil object" crash is a wedged ibtoold daemon (actool's persistent daemon), not .icon content or SVG layers. Once wedged, EVERY .icon compile fails — same package, any path, any layer type — and the identical command that succeeded minutes earlier fails. `killall ibtoold` fixes it deterministically. **Solution:** tauri-bundler (tauri-cli 2.11.4 confirmed in source code) accepts a pre-compiled Assets.car in bundle.icon and skips actool entirely — it copies .car files as-is. **Implementation:** scripts/release.sh pre-compiles icons/Assets.car with `xcrun actool` before every `npx tauri build`, with a 5-attempt retry loop (killall ibtoold between attempts). tauri.conf.json bundle.icon lists "icons/Assets.car" first (echo.icon stays on disk as the source of truth; release.sh recompiles the car each release). **Consequence:** the Icon Composer .icon package (user's approved Facet Split design) can stay in place; the SVG-layer-crashes-actool issue is moot now that actool never runs.

### No tauri icon / tauri.conf edits while tauri dev runs (watcher restart storms kill sidecar)
**Gotcha:** `npx tauri dev` watches ALL of `web/src-tauri/` and restarts the app on every changed file. Running `npx tauri icon` while dev is running rewrites dozens of files under `src-tauri/icons/`, each triggering its own rebuild+restart. Rapid kill/spawn cycles race the sidecar on port 29325 and reliably end with a dead backend. Similarly, any `tauri.conf.json` edit restarts the app, and the backend is down for ~30-60s during handover. **Prevention:** Stop `tauri dev` before running release.sh (which invokes both `npx tauri icon` internally and `tauri build`). For dev-only icon tweaks, edit/test without tauri dev running, or set up a separate branch that commits icon changes.

### Tauri ACL: remote-origin commands require explicit app manifest + capability entries
**Root cause:** Tauri treats http:// URLs (including localhost) as **remote** origins. When a window loads a remote origin, every app-defined command (`#[tauri::command]`) is ACL-checked and denied unless a capability names it — unlike dev, where local origins bypass the check. This silently killed `restart_for_update` and `fetch_og_tags` in production (0.3.0–0.3.5) because commands were declared in Rust but had no capability entries. **Fix:** (1) Declare commands in `build.rs` via `tauri_build::AppManifest::new().commands(&[...])` to generate `allow-<kebab-command>` identifiers; (2) grant those generated identifiers in `capabilities/default.json` under the `remote.urls` block. The `remote.urls` block itself is also mandatory — without it, ALL IPC to remote origins is denied. Also: declaring an app manifest makes ALL app commands ACL-checked **including** local origins in dev, so this must be done correctly or both dev and prod break. **Consequence:** any new `#[tauri::command]` must be added to both build.rs and capabilities/default.json or it silently fails in both environments.

### opener plugin needs both command permission AND URL scope permission
**Gotcha:** `@tauri-apps/plugin-opener`'s permission set is split: `opener:allow-open-url` grants the COMMAND, while `opener:allow-default-urls` grants the URL SCOPE (http:/*, https:/*, mailto:*, tel:*). Having only the command permission causes all `openUrl` calls to fail silently with `ForbiddenUrl` error (swallowed to console.error). **Fix:** include both permissions in `capabilities/default.json`. Other plugins may split permissions similarly — check the plugin source code and the generated `allow-<command>` identifiers.

### External-link click handler must stay in CAPTURE phase
**Root cause:** `tauri-plugin-shell` unconditionally injects a body click listener via an init script (`js_init_script`, lib.rs:105, no opt-out). This listener captures `target="_blank"` links and calls `plugin:shell|open` — a command that was never granted. All three link-handler components (`tauri-plugin-opener`, `@tauri-apps/plugin-shell`, and custom handlers) compete in the bubble phase. The shell listener fires second (after custom handlers due to event source ordering) but `preventDefault()` gets called first, then the shell listener sees `defaultPrevented` and bails. **Fix:** install the custom handler in the **CAPTURE** phase on an ancestor (`document`). Capture listeners always fire before bubble listeners on the same element, so the custom handler fires first, calls `stopPropagation()`, and the shell listener never sees the event. **Side effect:** capture phase runs before the spoiler-reveal handler in `TextMessageBody`, so an explicit unrevealed-spoiler guard was added — otherwise clicking a spoiler would open the link it was hiding.

### Sidecar storage isolated via GOMUKS_*_HOME environment variables
**Problem:** The gomuks sidecar picked its own directories keyed on the name "gomuks", which collided with a real gomuks install on the user's machine. `tauri dev` shared both the SQLite database AND port 29325 with the production app. **Fix:** `lib.rs` passes `GOMUKS_CONFIG_HOME`, `GOMUKS_DATA_HOME`, `GOMUKS_CACHE_HOME`, `GOMUKS_LOGS_HOME` at sidecar spawn, resolved from Tauri's path API (keyed on the bundle identifier `dev.tbird.echo`). Debug builds get a `-dev` suffixed profile, so `tauri dev` can never touch installed-app data. **Migration:** one-time fs::rename of three directories with fallback to old directory if rename fails ("postpone tidiness rather than risk losing state"). Verified live: all three directories moved, database byte-identical, crypto operations worked immediately after. **Data locations:** `~/Library/{Application Support,Caches,Logs}/dev.tbird.echo/` (production); `~/Library/{Application Support,Caches,Logs}/dev.tbird.echo-dev/` (dev). A backup at `~/Library/Application Support/gomuks.backup-pre-migration` can be deleted once 0.3.7 is confirmed healthy.

### Backend auth fixed: no stdin prompts on fresh installs
**Problem:** `pkg/gomuks/config.go:139` prompts on stdin if auth is enabled and credentials are blank. A Tauri sidecar gets pipes, not a TTY, so the prompt fails with EOF and the backend exits before binding its port. echo ≤0.3.0 could not start for anyone without a pre-existing gomuks config. Note: the config key `disable_auth_because_i_want_my_account_to_be_hacked` does NOT avoid this — the prompt is gated on `DisableAuth`, not the config value. **Fix:** `ensure_backend_config` in `lib.rs` writes random bcrypt-hashed credentials before the sidecar spawns, discards the plaintext immediately. Nothing can log in with it (the password is never stored) and nothing needs to. The app authenticates by minting its own session token via the webview initialization script. Verified end-to-end on a genuinely fresh profile: backend starts cleanly, session token 200s, invalid tokens 401s.

### WebKit store is deliberately NOT migrated between bundle IDs
**Rationale:** The bundle ID changed from `com.tbird.echo` to `dev.tbird.echo` in 0.3.1, which cleared the WebKit-managed localStorage/sessionStorage (user colors, cheats, collapsed sections, all UI state). This was a one-time cost, accepted over the risk of corrupting the store with a rename operation on an undocumented container (macOS owns it, layout is not a public contract). **Consequence:** users see a re-login and reset UI prefs after 0.3.1. Backup exists at `~/Library/Application Support/gomuks.backup-pre-migration` for data recovery if needed.

### insecure_cookies: true is deliberate but NOT strictly required
**Rationale:** The config key `insecure_cookies: true` clears the `Secure` flag on HTTP cookies (`server.go:234`). Over `http://localhost:29325` a Secure cookie would not be sent at all; removing the flag allows SameSite-protected cookies to work. The cookie stays `HttpOnly` and `SameSite=Lax`, so the security posture remains: only code running on localhost:29325 can read the cookie, and it's safe against CSRF from other localhost ports. **Epistemic status:** verified the code behavior (what the flag does); did NOT empirically test whether WKWebView sends Secure cookies to localhost without it. "Strictly required" is inference, not proof. Kept deliberately to be safe.

### Assets.car and sidecar binary are gitignored build artifacts
**Rationale:** `web/src-tauri/icons/Assets.car` (~1.4MB) and `web/src-tauri/binaries/gomuks-aarch64-apple-darwin` (55MB) are regenerated on each release and tagged with git history. Earlier attempt to commit both cost 110MB in the push payload. Both are now in `.gitignore` with `.gitkeep` placeholders; release.sh regenerates them. Old commits with embedded binaries can be reclaimed by running `git gc` after deleting the `pre-blob-strip` local tag.

### shell:* permissions deliberately removed — never re-add them
**Note:** `shell:allow-spawn`, `shell:allow-kill`, `shell:allow-stdin-write` were granted to the remote origin but nothing used them (no @tauri-apps/plugin-shell calls in web/src). The sidecar is spawned from Rust, not from IPC. These permissions were removed to reduce remote-origin capability surface. If shell operations are needed in the future, they must come from Rust code, not IPC grants to the webview.

### release.sh has four latent bugs that bite only on release
(1) **TAURI_SIGNING_PRIVATE_KEY env var name is wrong.** Tauri uses `TAURI_SIGNING_PRIVATE_KEY` (contents, not path); the old name `TAURI_SIGNING_PRIVATE_KEY_PATH` is ignored. Signing fails silently after a full build + Apple notarization (the most expensive step). **Fix:** preflight that signs a throwaway file before building, so key+password are proven valid upfront. (2) **Cargo.lock is a fourth version file.** cargo build rewrites it automatically; release.sh bumped 3 files (tauri.conf.json, package.json, Cargo.toml) but not Cargo.lock. A failed release stranded Cargo.lock at the new version while the other 3 stayed old; a successful one tagged a commit with disagreement between manifest and lock file. **Fix:** bumped, verified, restored on abort, committed with the other 3. (3) **DMG notarization:** tauri notarizes and staples the `.app`, then builds the DMG around it — but the DMG itself was never notarized/stapled. `stapler staple` on it failed "Record not found". **Fix:** separate `notarytool submit` round trip for the DMG itself. (4) **gh account drift:** the active `gh` account changed mid-build (ADMIN→READ), so preflight passed as the right user and `gh release create` failed as the wrong one. `gh` reported it misleadingly as "workflow scope may be required". **Fix:** resolve a token for a required account upfront, export `GH_TOKEN`, which pins both `gh release create` and `git push` (credential helper is `gh auth git-credential`).

### Git history blob strip: git filter-branch to remove 110MB binary
**Done 2026-08-27:** Rewrote commits `c1529c6c..HEAD` (4 unpushed commits only) to strip `web/src-tauri/binaries/gomuks-aarch64-apple-darwin` (55MB, committed twice). Verified `git diff` between pre-rewrite and rewritten tip was EMPTY (identical tree). Upstream commits at/below `c1529c6c` untouched, so fork relationship + future `git merge upstream/main` still work. Backup tag `pre-blob-strip` still exists (can be deleted + `git gc` run to reclaim disk). Push payload went 110MB → 7.6MB.
