# Current State

## Project
echo (gomuks fork; repository `taylorbird/echo` on GitHub, bundle ID `dev.tbird.echo`)

## Objective
Fork gomuks and redo the frontend to make it more visually appealing, wrapped as a native macOS app plus an iOS companion app (forked Element X scaffold; design language as cross-platform contract, not shared code; Android out of scope)

## Current Focus
Two releases shipped: 0.6.0 (0.5.1 + batch-1 fixes + redesign in one minor bump; f9795a08) and 0.6.1 (disconnected screen + loading-state sweep + release notes rewrite; d40de040). Both tagged, feed verified. HEAD d40de040, tree clean. Dev app NOT running (no token expiry concern for this session).

## Last Checkpoint
2026-09-21 17:22 PDT

## Constraints
See `.claude/work/constraints.md` for full ledger. One-liner summary of durable constraints (new 2026-09-21 marked with ★):
- ★ Skeleton animation is ONE thing app-wide: `sk-sweep` in `web/src/ui/loading/Loading.css`; new shapes take `.sk` class; legacy pseudo-element skeletons named in Loading.css selector list; never re-add per-file shimmer
- ★ Two loading idioms only: skeleton (shape known) or HairlineWait (shape unknown: text over 2px `--hairline-color`); no spinners; react-spinners gone — do not re-add
- ★ Disconnected screen replaces the app (opaque skeleton), never blurs live content; box uses quick-switcher radius/shadow; blur via `filter` on skeleton layer not `backdrop-filter`
- ★ Echo logomark is the penguin (`web/src/icons/echo-penguin.png`, source in `src-tauri/icons/echo.icon`); `web/public/gomuks*.png` are upstream leftovers
- ★ release.sh pins gh token to `taylorbird`; bare `git push` may 403 if another account active — let release.sh push, or use `GH_TOKEN=$(gh auth token --user taylorbird)`
- ★ Reduce Motion: every new animation gates inside `@media (prefers-reduced-motion: reduce)` with `html:not([data-ignore-reduce-motion])` override
- ★ `--room-list-width` on `main.matrix-main` (400px default, inline override); does not resolve on fixed layers; `--space-bar-width` is on :root
- Dev/tooling (unchanged, bite on resume): `./node_modules/.bin/tauri dev` never `npm run tauri dev`; npm not pnpm in web/; Vite 6173 strictPort IPv6 `[::1]`; backend token is 24h mint-once (relaunch is the remedy); rewrite RELEASE_NOTES.md and commit it BEFORE `scripts/release.sh`; stop dev before releasing
- Design (unchanged): Inter only; room names white in dark; unread blue #5cbbff/#85d6ff vs red+@; sender colours room-aware via `getSenderColor(roomID, userID)`; palette size changes touch six files; macOS CSS scoped to `html[data-tauri]`; mock-ups = one card per variant, current first, exact CSS deltas
- All other constraints: see constraints.md

## Next Actions (Desktop)
1. Confirm 0.6.1 update lands and disconnected screen + loading states behave in production WKWebView build
2. Favicon → penguin (`web/index.html:5`; one line)
3. Decide DM sub-filter inside spaces (options A–D in questions.md)
4. Reproduce tester unknowns (spaces-only-after-reload first)
5. Decide SyncBox bare-vs-box and lavender header / preview sender colours

## Next Actions (iOS)
6. Write the echo design-language document (tokens and rules, no CSS)
7. Fork Element X iOS, build, run on user's own phone, confirm baseline
8. Build new room list + timeline screens; token-restyle remaining screens
