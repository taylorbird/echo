# Open Questions

<!-- Things uncertain, need revisiting, or blocked on -->

- Should the webview preview tier ever auto-run for recent messages, or stay click-only? (Currently click-only for security — prevents auto-execution of arbitrary posted URLs' JS.)
- Should we create a proper theming system for user-configurable colors?
- When to start matrix-rust-sdk integration for mobile support?
- Should same-origin media/download links (target="_blank") be made to work inside Tauri? Currently they do nothing; sending them to the system browser would fail auth.
- Should the Rooms/DMs grouping keep Rooms above Direct messages, and is per-group recency ordering (vs the old single global recency list) the desired behaviour?
- Should there be a room-less settings variant so Cmd+, works with no active room?
- Should per-room custom_css come back? Currently removed from preferences (one-line revert if needed).
- Is code_block_line_wrap safe as global-only? (user hasn't objected, most debatable of the 15 scope moves)
- custom_notification_sound has no editor UI anywhere — should we build one? (pre-existing gap, not new)
- Should the remote capability (http://localhost:29325 sidecar origin) be split from the default capability so it loses shell:spawn/kill permissions before distributing to friends?

## Blockers / Limitations
- Claude cannot see the app visually in this environment: `screencapture` fails ("could not create image from display" — terminal lacks macOS Screen Recording permission), the chrome-devtools MCP cannot attach (no Chrome running with a debug port), and `osascript`/System Events reports 0 windows for the transparent Tauri window (an Accessibility quirk, not a render failure). Granting the terminal Screen Recording permission would unblock visual self-review. Mitigated this session by the user pasting two actual screenshots, which closed the loop better than the previous "Vite HMR + user's eyes only" pattern, but Claude still cannot self-verify by taking its own screenshot.
- fetch_og_tags (URL-preview webview tier) is dead in prod because the app permission file + capability entry for the command are missing from capabilities/default.json. Needs follow-up work (next-actions item 4).

## Resolved
- Production build workflow: signing, notarization, distribution? — Substantially answered for App Store purposes: the user explicitly waived App Store distribution ("basically a private app for me"), and `macOSPrivateApi: true` is now in use, which would block App Store acceptance anyway. The signing/notarization mechanics themselves (outside the App Store) remain unaddressed and could be reopened as a separate question if needed.
- Do external links now actually open in the system browser? — RESOLVED (2026-08-25): root cause was ACL remote-origin denial (capabilities/default.json missing `remote.urls` entry for http://localhost:29325). Fixed by adding remote.urls block + core:window:allow-start-dragging. Opener plugin works in prod 19:04 build; user verification pending.
- Do external links + clipboard actually work after Tauri 2.11 alignment and WKWebView fallback? — RESOLVED (2026-08-25): root cause found (ACL remote-origin denial), fixed in prod build 19:04, user verification pending (YouTube link, Share→Copy).
- Is drag-drop image upload working correctly? — RESOLVED: root cause was `dragDropEnabled` defaulting to `true` in `tauri.conf.json`, which let Tauri's native handler consume the drop before the webview saw it. Fixed by setting `"dragDropEnabled": false`. User confirmed drag-and-drop from CleanShot X now works.
- What exactly does "contrast on the reading screen" mean? — RESOLVED: it became a full palette and text-hierarchy overhaul across the whole session (room list vs. chat pane tinting, palette reversals, chat text hierarchy rework). The chat pane ended up cool near-black (`#16181f`), now the darkest surface in the app rather than the lightest.
- Should the right panel adopt the cool dark palette to fix sender-colour contrast for member names? — RESOLVED: new `getUserColor` returns high-luminance pastels (capped at L 80%), improving readability on warm background. Right-panel names now have solid contrast; no cool-palette flip needed.
- Should `--room-header-background` get its own cool value rather than borrowing the room-list token? — RESOLVED: it's intentionally shared. Header sits above the chat pane (cool near-black) but the token retrieves the room-list warm background, and it reads correctly. No change needed.
- Does the room-list-wrapper's outer raise shadow escape `contain: strict`? — RESOLVED (indirectly): removed `content-visibility: auto` / `contain: strict` entirely from room-list entries due to WebKit paint-deferral issues. Question moot.
- Should the pre-existing 11 eslint errors in untouched files (`WebAuthLogin.tsx`, `MessageComposer.tsx`, `useSecondaryItems.tsx`, `TimelineEvent.tsx`) be cleaned up? — RESOLVED: all pre-existing errors remain; the project is now at zero tsc/eslint on all touched code (a new baseline 2026-08-21). Pre-existing errors in untouched files are not attributable to this work and can be addressed separately.
- Startup auth retry on ECONNREFUSED (shell rebuild race)? — RESOLVED (2026-08-25 as side effect): TCP readiness wait in lib.rs (500ms connect timeout, 100ms interval, 15s deadline) prevents the old race where the webview's first auth request beat the sidecar to port 29325. Deterministic start order now guaranteed.
