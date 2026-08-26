# Current State

## Project
echo (gomuks fork; renamed from Seabug 2026-08-25, bundle ID com.tbird.echo)

## Objective
Fork gomuks and redo the frontend to make it more visually appealing, wrapped as a native macOS app (with future iOS/Android support planned)

## Current Focus
Rebrand to echo complete (name, identifier, icon). Production architecture rewired to same-origin sidecar serving (localhost:29325, no more static dist). ACL fixed (drag regions, external link opener). Room-list width + title bar visible in 19:04 build awaiting user verification. Icon .icon package pending PNG-layer re-export. Next phase: distribution (sign/notarize/DMG/auto-update).

## Last Checkpoint
2026-08-25 23:03 PDT

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

## Next Actions
1. User verifies 19:04 build: window drag, echo title, room-list width, YouTube link
2. User re-exports echo.icon from Icon Composer with PNG layer (SVG layer crashes actool); then rebuild with icons/echo.icon restored
3. Distribution pipeline: Developer ID signing (app + Go sidecar hardened runtime), notarization, DMG on user's website, tauri-plugin-updater auto-update (minisign keys, latest.json)
4. fetch_og_tags ACL fix (app permission file + capability entry) — URL-preview webview tier dead in prod
5. Tighten capabilities (split local/remote; drop shell perms from remote) before distributing to friends
6. Small fixes: light-mode titlebar text contrast; room-list unread emphasis; consider seabug→echo localStorage migration shim
