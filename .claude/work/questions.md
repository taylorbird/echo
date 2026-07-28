# Open Questions

<!-- Things uncertain, need revisiting, or blocked on -->

- Should we create a proper theming system for user-configurable colors?
- When to start matrix-rust-sdk integration for mobile support?
- Should same-origin media/download links (target="_blank") be made to work inside Tauri? Currently they do nothing; sending them to the system browser would fail auth.
- Should the Rooms/DMs grouping keep Rooms above Direct messages, and is per-group recency ordering (vs the old single global recency list) the desired behaviour?
- Should the right panel adopt the cool dark palette to fix sender-colour contrast for member names? Saturated sender colours currently fall to ~3.1-4.2:1 against the still-warm `#4a4553` right panel, below the 4.5:1 AA threshold.
- Should `--room-header-background` get its own cool value rather than borrowing the room-list token? It currently lands nearly identical to the cool chat pane despite sharing a token name with the room list.
- Should there be a room-less settings variant so Cmd+, works with no active room?
- Does the room-list-wrapper's outer raise shadow escape `contain: strict`? (still unverified)
- Should the pre-existing 11 eslint errors in untouched files (`WebAuthLogin.tsx`, `MessageComposer.tsx`, `useSecondaryItems.tsx`, `TimelineEvent.tsx`) be cleaned up?

## Blockers / Limitations
- Claude cannot see the app visually in this environment: `screencapture` fails ("could not create image from display" — terminal lacks macOS Screen Recording permission), the chrome-devtools MCP cannot attach (no Chrome running with a debug port), and `osascript`/System Events reports 0 windows for the transparent Tauri window (an Accessibility quirk, not a render failure). Granting the terminal Screen Recording permission would unblock visual self-review. Mitigated this session by the user pasting two actual screenshots, which closed the loop better than the previous "Vite HMR + user's eyes only" pattern, but Claude still cannot self-verify by taking its own screenshot.

## Resolved
- Production build workflow: signing, notarization, distribution? — Substantially answered for App Store purposes: the user explicitly waived App Store distribution ("basically a private app for me"), and `macOSPrivateApi: true` is now in use, which would block App Store acceptance anyway. The signing/notarization mechanics themselves (outside the App Store) remain unaddressed and could be reopened as a separate question if needed.
- Do external links now actually open in the system browser? — Opener plugin was built in an earlier session; not re-tested this session, so this remains formally unverified by direct observation even though the code path is believed correct.
- Is drag-drop image upload working correctly? — RESOLVED: root cause was `dragDropEnabled` defaulting to `true` in `tauri.conf.json`, which let Tauri's native handler consume the drop before the webview saw it. Fixed by setting `"dragDropEnabled": false`. User confirmed drag-and-drop from CleanShot X now works.
- What exactly does "contrast on the reading screen" mean? — RESOLVED: it became a full palette and text-hierarchy overhaul across the whole session (room list vs. chat pane tinting, palette reversals, chat text hierarchy rework). The chat pane ended up cool near-black (`#16181f`), now the darkest surface in the app rather than the lightest.
