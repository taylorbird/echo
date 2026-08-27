# Current State

## Project
echo (gomuks fork; renamed from Seabug 2026-08-25, bundle ID com.tbird.echo)

## Objective
Fork gomuks and redo the frontend to make it more visually appealing, wrapped as a native macOS app (with future iOS/Android support planned)

## Current Focus
Release pipeline complete and verified actool-free. Three files staged uncommitted: web/src-tauri/tauri.conf.json (bundle.icon → Assets.car), scripts/release.sh (car pre-compile retry loop), web/src-tauri/icons/Assets.car (1.4MB binary). Two failed release runs diagnosed (ibtoold wedged daemon, not .icon content) and fixed with pre-compiled Assets.car + killall ibtoold in release.sh. Remaining steps: commit staged files, run release.sh 0.2.0, user verification of DMG install + auto-update flow. Finish in fresh session (cost control).

## Last Checkpoint
2026-08-27 08:50 PDT

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

## Next Actions
1. Commit 3 staged files (message: actool-free icon pipeline via pre-compiled Assets.car)
2. Run release: /Users/tbird/gomuks/scripts/release.sh 0.2.0 (allowlisted, unattended, ~5-15 min)
3. User verifies: DMG downloads + installs, Gatekeeper-clean open, real Facet Split icon, encrypted decrypt, room-list 440, centered title
4. Make trivial change, release 0.2.1, verify 0.2.0→0.2.1 auto-update + restart
5. Deferred: tighten remote capability (drop shell perms); fetch_og_tags ACL fix; seabug→echo localStorage migration shim; light-mode titlebar contrast
