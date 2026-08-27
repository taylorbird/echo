# Current State

## Project
echo (gomuks fork; renamed from Seabug 2026-08-25, repository `taylorbird/echo` on GitHub, bundle ID `dev.tbird.echo`)

## Objective
Fork gomuks and redo the frontend to make it more visually appealing, wrapped as a native macOS app (with future iOS/Android support planned)

## Current Focus
Release pipeline complete and production-ready. Eight releases published (0.2.0 through 0.3.7), all verified working. App installs from DMG, data migrations preserved, auto-updates download+verify+install correctly, URL previews and external links work in production, and the Restart button functions. The backend auth issue was fixed so fresh installations no longer prompt for credentials. All work committed; main in sync with origin. Ready for beta users.

## Last Checkpoint
2026-08-27 16:52 PDT

## Constraints
See `.claude/work/constraints.md` for full ledger. Quick reference:
- Vite port 6173 strictPort; All macOS CSS scoped to `html[data-tauri]`; Reading surfaces opaque
- Light edge lines on dark surfaces; Reduce motion ON (animations need `data-ignore-reduce-motion` absent)
- Square panes (modals `.625rem` radius over blur); Quick-switcher reduced frosting via `:has()`
- Encrypted previews never auto-fetch; Webview preview tier click-only
- Room-list entries NO `content-visibility: auto`/`contain: strict` (WebKit repaints deferred)
- `useSyncExternalStore` snapshots need stable empty refs (fresh `[]` = infinite rerender)
- Tauri crate minor ↔ @tauri-apps/api npm minor lockstep (CLI/plugin IPC mismatch)
- Clipboard writes via `util/clipboard.ts` (WKWebView rejects navigator.clipboard)
- Timeline sender colors are classes; per-user overrides via `getUserColorOverride` inline style
- Zero-lint/zero-tsc baseline 2026-08-21; new code must maintain it
- Production webview loads http://localhost:29325 same-origin; NEVER revert to static dist serving
- Frontend→prod requires: npm run build → go build ./cmd/gomuks → npx tauri build (sidecar embeds dist)
- capabilities/default.json remote.urls entry for localhost:29325 must stay or all prod IPC silently dies
- Inter base font, Space Grotesk display font via --display-font-stack (names/titles/usernames only)
- Bundler never runs actool: icons/Assets.car pre-compiled by release.sh (ibtoold flakiness; tauri-bundler accepts it as-is)
- No tauri icon / tauri.conf edits while tauri dev runs (watcher restart storms kill sidecar)
- New `#[tauri::command]` must be added to BOTH build.rs AppManifest and capabilities/default.json (remote origin = all app commands ACL-checked)
- opener needs BOTH `opener:allow-open-url` (command) and `opener:allow-default-urls` (URL scope)
- External-link click handler must stay in the CAPTURE phase — tauri-plugin-shell injects a competing body listener
- Sidecar storage pinned via GOMUKS_*_HOME in lib.rs; debug builds use a `-dev` profile
- Release identity pinned via GH_TOKEN in release.sh — never rely on the active gh account
- Cargo.lock is a version file; release.sh bumps all four

## Next Actions
1. Send the beta link to beta users (README + releases are live and verified)
2. Enable logging in release builds (tauri_plugin_log currently only initialises under cfg!(debug_assertions)) and consider devtools — three bugs today were diagnosed blind
3. Delete the `pre-blob-strip` local git tag and run `git gc` to reclaim ~110MB
4. Delete `~/Library/Application Support/gomuks.backup-pre-migration` now that 0.3.7 is verified healthy
5. Add a screenshot to the README (Claude cannot take one — no Screen Recording permission)
