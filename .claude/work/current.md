# Current State

## Project
echo (gomuks fork; renamed from Seabug 2026-08-25, repository `taylorbird/echo` on GitHub, bundle ID `dev.tbird.echo`)

## Objective
Fork gomuks and redo the frontend to make it more visually appealing, wrapped as a native macOS app plus an iOS companion app (forked Element X scaffold; design language as cross-platform contract, not shared code; Android out of scope)

## Current Focus
UI/UX working session (2026-09-17), tauri dev running live (HMR), everything uncommitted, zero tsc/eslint errors maintained. Shipped: macOS title bar unified (band removed, rail reserves the traffic-light strip + .5rem); space rail always-in-a-space fix; unread/mention ramp (blue = information, red + @ = you were named); Inter everywhere with Space Grotesk dropped; per-room colours removed entirely, room names white at 1.125rem; Recent added as a fourth rail sub-filter. Built then DELETED the same day: the per-section sort (mode tag, cycle-on-click, `echo.room_list_sort`) — the user replaced it with the Recent sub-filter. The "One Chip Row" filter-chip design was NOT built and is not planned: putting Recent in the rail resolved the overlap it would have created. Artifacts: Title Bar Tryouts, Where the DM Lands, One Chip Row, Quieting the List, Typeface and Tone. Nothing has been verified visually by Claude — the user is the only one who has seen it.

## Last Checkpoint
2026-09-17 15:53 PDT

## Constraints
See `.claude/work/constraints.md` for full ledger. Quick reference:
- Sender colours are room-aware: `getSenderColor(roomID, userID)` only (media.ts); `--sender-color` inline on `div.timeline-event`; storage key `echo.room_sender_colors`
- Palette size changes touch six places (media.ts FALLBACK_COLOR_COUNT, index.css dark/light lists, TimelineEvent.css, ReplyBody.css, cool-graphite.css)
- Room-list name colour white (dark mode only), all views; per-room hash-derived accents removed entirely
- Room-list kind glyph accent `room_list_color` (default #bd93f9) intentionally retained; only coloured element in the list now
- Recent is a rail sub-filter (narrows nothing, no sections, newest-first, no Unread section) never a sort
- Resting room rows not dimmed; emphasis is wash + bars + badge only
- No separate title bar band; space rail reserves `--traffic-light-strip` 2rem + .5rem breathing room; all other panes run to top edge
- Typography: Inter only via `--display-font-stack` token; names/titles/usernames remain named role but no second face
- Unread tiers: blue = information, red+@ = action; must survive reduced motion AND colour blindness; no collapse back to single colour
- Mock-up comparison artifacts: one card per variant, current first, exact CSS deltas per card; builders must not launch browsers, start bg tasks, or call TaskStop
- Vite port 6173 strictPort, binds IPv6 only ([::1]) so probes must try IPv6; all macOS CSS scoped to `html[data-tauri]`; reading surfaces opaque
- Light edge lines on dark surfaces; Reduce motion ON (animations need `data-ignore-reduce-motion` absent)
- Square panes (modals `.625rem` radius over blur); Quick-switcher reduced frosting via `:has()`
- Encrypted previews never auto-fetch; Webview preview tier click-only
- Room-list entries NO `content-visibility: auto`/`contain: strict` (WebKit repaints deferred)
- `useSyncExternalStore` snapshots need stable empty refs (fresh `[]` = infinite rerender)
- Tauri crate minor ↔ @tauri-apps/api npm minor lockstep (CLI/plugin IPC mismatch)
- Clipboard writes via `util/clipboard.ts` (WKWebView rejects navigator.clipboard)
- Zero-lint/zero-tsc baseline 2026-08-21; new code must maintain it
- Production webview loads http://localhost:29325 same-origin; NEVER revert to static dist serving
- Frontend→prod requires: npm run build → go build ./cmd/gomuks → npx tauri build (sidecar embeds dist)
- capabilities/default.json remote.urls entry for localhost:29325 must stay or all prod IPC silently dies
- Bundler never runs actool: icons/Assets.car pre-compiled by release.sh (ibtoold flakiness; tauri-bundler accepts it as-is)
- No tauri icon / tauri.conf edits while tauri dev runs (watcher restart storms kill sidecar)
- New `#[tauri::command]` must be added to BOTH build.rs AppManifest and capabilities/default.json (remote origin = all app commands ACL-checked)
- opener needs BOTH `opener:allow-open-url` and `opener:allow-default-urls`; external-link clicks stay in the CAPTURE phase (tauri-plugin-shell injects a competing body listener)
- Sidecar storage pinned via GOMUKS_*_HOME in lib.rs; debug builds use a `-dev` profile
- In web/ never run pnpm until migration decided — `npm run …` / `./node_modules/.bin/…`; `npm ci` restores after an accident (see learnings/dev-environment-gotchas.md)
- Release ritual: rewrite RELEASE_NOTES.md BEFORE release.sh (ships verbatim); eject stale /Volumes/echo; stop tauri dev; launch detached (`nohup … &`, harness bg cap is 10 min). GH_TOKEN pinned to taylorbird (never the active gh account); Cargo.lock is a version file — release.sh bumps all four
- Glow pill = active view, exactly one visible at a time; space tile yields pill while parted
- Animations must have CSS `prefers-reduced-motion` gate AND JS skip of exit-animation states (animationend never fires under animation:none)
- Rail/visual changes verified via Playwright-WebKit harness against live dev (recipe in learnings/dev-environment-gotchas.md)
- iOS app = owned Element X fork (no upstream rebases; rust-sdk via Swift package); consistency via design-language doc, not shared code; Android out of scope

## Next Actions (Desktop)
1. Confirm the whole day's UI work looks right in the dev app, then commit (everything is uncommitted)
2. Revisit Cotypist accessibility (see questions.md; needs Accessibility Inspector against the focused composer)
3. Diagnose read receipts not sending (carry forward)
4. Decide whether the room-kind glyph accent (`room_list_color`, default purple #bd93f9) should stay now that it is the only coloured thing in the list — the user flagged that purple as "sticking out" on 2026-09-04

## Next Actions (iOS)
7. Write the echo design-language document (tokens and rules, no CSS): warm-tint-derived palette, Inter throughout (single face — Space Grotesk dropped 2026-09-17), blue unread vs red+@ mention with separation in hue and badge shape never motion, mixed-case room names, house motion curve cubic-bezier(.32,.72,0,1) with close at half open speed, light edge lines on dark surfaces, square panes / .625rem modal radius, opaque reading surface, glow pill = active view, All chats/Rooms/DMs/Recent sub-filter concept, settings as categories with search first.
8. Fork Element X iOS, build on stock build, run on user's own phone, confirm baseline behaviour, note screen-structure differences.
9. Build new room list + timeline screens against design doc; token-restyle remaining screens. Update README.md lines 70-71 (iOS/Android planned → iOS-only).
