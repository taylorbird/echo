# Current State

## Project
echo (gomuks fork; renamed from Seabug 2026-08-25, repository `taylorbird/echo` on GitHub, bundle ID `dev.tbird.echo`)

## Objective
Fork gomuks and redo the frontend to make it more visually appealing, wrapped as a native macOS app plus an iOS companion app (forked Element X scaffold; design language as cross-platform contract, not shared code; Android out of scope)

## Current Focus
Batch 1 fixes (rail avatar, preference description, toReversed() floor, Recent header removal) DONE and verified in source. Unread-colour retune (blue neon family, glow removed from dot) DONE. Loading + signed-out redesign (SyncBox, SignedOut surface, WebAuthLogin rewrite, LoginScreen Plain, skeleton loading) DONE, designed via artifacts, implemented, uncommitted, tsc+eslint clean. Seven new durable constraints recorded. Nothing committed — HEAD is still f9795a08 and the tree carries all of the above; zero tsc/eslint maintained. Next: commit batch 1 + redesign, retest visually (Claude cannot see the app), resolve visual questions from tester's screenshot, version decision + release. Dev app was found fully down at session start; relaunched with fresh 24h backend token minted ~08:29 PDT (expires ~08:29 on 2026-09-22), all prior uncommitted work intact.

## Last Checkpoint
2026-09-21 08:33 PDT

## Constraints
See `.claude/work/constraints.md` for full ledger. Quick reference (new 2026-09-20 marked with ★):
- Sender colours are room-aware: `getSenderColor(roomID, userID)` only (media.ts); `--sender-color` inline on `div.timeline-event`; storage key `echo.room_sender_colors`
- Palette size changes touch six places (media.ts FALLBACK_COLOR_COUNT, index.css dark/light lists, TimelineEvent.css, ReplyBody.css, cool-graphite.css)
- Room names white (dark mode only) everywhere, per-room accents removed; kind glyph keeps `room_list_color` (#bd93f9)
- ★ Recent is a rail sub-filter (narrows nothing, single section, newest-first, no Unread); its section is headerless and can never be collapsed, which also neutralises a stale `recent` entry in `echo.collapsed_room_list_sections`
- ★ Unread blue family: #5cbbff (message) / #85d6ff (notified) with --unread-counter-blue-text: #10233a for digits; base-tier dot has no glow (fill brightness only), bars/badges keep halos
- Resting rows not dimmed (emphasis = wash + bars + badge); no title bar band — rail reserves --traffic-light-strip 2rem + .5rem, other panes run to top edge
- Typography: Inter only, no Space Grotesk; --display-font-stack token preserved (role survives, just no second face)
- ★ Batch 1 fixes: rail avatar fetches profile once, preference description updated, toReversed()→reverse(), Recent header gone
- ★ Pre-app screens on one surface (div.pre-main.signed-out); no app shell behind sign-in; .signin-column shared styles in SignedOut.css
- ★ Backend session token: 24h mint-once; any app running >24h lands on unanswered credentials form; remedy is relaunch; ★ --inverted-text-color resolves at :root, must be restated where --background-color re-scoped; ★ never use `npm run tauri dev` (no such script), use `./node_modules/.bin/tauri dev`
- ★ Signal colours via alias not direct reference: --progress-color aliases --unread-counter-message-bg so progress/focus ring sever from badge palette in one edit
- Mock-up artifacts: one card per variant, current first, exact CSS deltas per card; builders must not launch browsers, start bg tasks, or call TaskStop
- Vite port 6173 strictPort, IPv6 only ([::1]), all macOS CSS scoped to `html[data-tauri]`, reading surfaces opaque
- Light edge lines on dark surfaces; Reduce motion ON (animations need data-ignore-reduce-motion absent); square panes, modals .625rem over blur
- Encrypted previews never auto-fetch; webview preview tier click-only; room-list entries get NO content-visibility:auto/contain:strict
- useSyncExternalStore snapshots need stable empty refs; Tauri crate minor ↔ @tauri-apps/api npm minor lockstep
- Clipboard writes via util/clipboard.ts; Zero-lint/zero-tsc baseline 2026-08-21; prod webview loads http://localhost:29325 same-origin
- Frontend→prod: npm run build → go build ./cmd/gomuks → npx tauri build; capabilities/default.json remote.urls mandatory
- New `#[tauri::command]` in both build.rs + capabilities/default.json; opener needs both permissions; external-link clicks CAPTURE phase
- Sidecar storage via GOMUKS_*_HOME; In web/ use npm (pnpm migration pending); Release: rewrite RELEASE_NOTES.md BEFORE release.sh
- Glow pill = active view, one visible; animations CSS+JS reduce-motion gates; Rail changes verified via Playwright harness
- iOS app = owned Element X fork; consistency via design-language doc, not shared code; Android out of scope

## Next Actions (Desktop)
1. Commit batch 1 + redesign (all uncommitted work is ready, tsc+eslint clean)
2. Retest loading/signed-out screens visually (Claude cannot see app; user's eye needed)
3. Resolve tester's visual questions (lavender header colour, preview sender colours quiet?)
4. Version decision (patch 0.5.2 vs minor 0.6.0) and run `scripts/release.sh`
5. Reproduce tester's three unknowns if time (spaces-reload-only first, URL-preview scroll, composer expand)

## Next Actions (iOS)
7. Write the echo design-language document (tokens and rules, no CSS): warm-tint-derived palette, Inter throughout (single face — Space Grotesk dropped 2026-09-17), blue unread vs red+@ mention with separation in hue and badge shape never motion, mixed-case room names, house motion curve cubic-bezier(.32,.72,0,1) with close at half open speed, light edge lines on dark surfaces, square panes / .625rem modal radius, opaque reading surface, glow pill = active view, All chats/Rooms/DMs/Recent sub-filter concept, settings as categories with search first.
8. Fork Element X iOS, build on stock build, run on user's own phone, confirm baseline behaviour, note screen-structure differences.
9. Build new room list + timeline screens against design doc; token-restyle remaining screens. Update README.md lines 70-71 (iOS/Android planned → iOS-only).
