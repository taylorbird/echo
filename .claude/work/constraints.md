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
**Bundle ID: com.tbird.echo** (was app.gomuks.desktop). Window title, productName in tauri.conf.json, SettingsView masthead eyebrow, WebAuthLogin heading ("echo"), index.html <title> all set to "echo" (lowercase brand). localStorage keys `seabug.collapsed_room_list_sections` + `seabug_active_cheats` deliberately NOT renamed (would wipe browser-user state; migration shim is the option if needed later). **Side effect:** Bundle-ID change reset WKWebView storage (custom colors, cheats, collapsed sections) — one-time cost, accepted.

### Icon locked: low-poly faceted penguin
**Source of truth:** design/ folder (echo-penguin-facet.svg exact SVG outline + facets, echo-penguin-layer.png 1024 transparent RGBA). Icon set regenerated via `npx tauri icon design/echo-penguin-layer.png`. @tauri-apps/cli bumped ^2.10.0 → ^2.11.0 (installed 2.11.4; adds .icon/Assets.car bundler support). **Known blocker:** User's Icon Composer .icon (echo.icon, echo penguin side profile, pale-blue belly, violets #A78BFA→#4C1D95, blues #BFDBFE→#2563EB) crashes actool deterministically with "attempt to insert nil object" when its SVG layer uses clipPath. **Workaround:** must re-export using PNG layer instead. Until then, production builds require temporarily removing "icons/echo.icon" from bundle.icon; restore after. The 18:03 build that appeared successful is unexplained (possibly actool cache).
