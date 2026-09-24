# Current State

## Project
echo (gomuks fork; repository `taylorbird/echo` on GitHub, bundle ID `dev.tbird.echo`)

## Objective
Fork gomuks and redo the frontend to make it more visually appealing, wrapped as a native macOS app plus an iOS companion app (forked Element X scaffold; design language as cross-platform contract, not shared code; Android out of scope)

## Current Focus
0.6.2 (composer mentions, mention pills, space sub-filters, reaction chips rounded) and 0.7.0 (upstream sync through v26.09, Inter 4.1 variable bundled, OAuth device code, Tab accepts predictions, outgoing message fingerprint) shipped and verified live on feed. Upstream merged as separate commits on branch `upstream-sync`, main fast-forwarded to it (HEAD 91d2f022). Tree clean, dev app stopped.

## Last Checkpoint
2026-09-24 10:35 PDT

## Constraints
See `.claude/work/constraints.md` for full ledger. One-liner summary of durable constraints (new 2026-09-24 marked with ★):
- ★ Go backend builds with `-tags goolm,sqlite_fts5` (v26.09 requires both; go.mod minimum go 1.26)
- ★ Vite 8 / rolldown need Node >=22.12; use `fnm exec --using=22.23.1 ...` for npm installs, tauri dev, release.sh
- ★ gh token lacks `workflow` scope; resolve .github/workflows to echo's side before pushing upstream syncs
- ★ Lock @tauri-apps/plugin-updater 2.10.1, @tauri-apps/plugin-opener 2.5.4, @tauri-apps/cli 2.11.4 in package-lock.json
- ★ OAuth device code via homeserver MAS (legacy SSO removed upstream); client registration in LoginScreen
- ★ Inter 4.1 variable bundled (web/src/fonts/); no Google Fonts; supersedes prior "Inter from Google Fonts" note
- ★ DB schema now v27; builds <0.7.0 cannot open upgraded data
- ★ Release logs in ~/Library/Logs/echo-release/; dev logs in ~/Library/Logs/echo-dev/
- ★ PreToolUse hook requires push review before any git push; release.sh pushes internally where hook can't see it
- Release notes (2026-09-23): plain voice; one line per bullet; parser joins wrapped continuations onto bullets
- Skeleton animation: `sk-sweep` app-wide; no per-file shimmer re-add; HairlineWait for unknown shapes
- Disconnected screen opaque skeleton (frozen UI), never blur; box with quick-switcher styling; penguin lockup
- Echo penguin logomark (web/src-tauri/icons/echo.icon); web/public/gomuks*.png upstream leftovers
- release.sh pins gh token to `taylorbird`; manual push use `GH_TOKEN=$(gh auth token --user taylorbird)`
- Reduce Motion gates: @media + data-ignore-reduce-motion override; animations off on user's ON-by-default machine
- Dev/tooling: `./node_modules/.bin/tauri dev` never `npm run tauri dev`; npm not pnpm in web/; backend token 24h mint-once
- Design: Inter only; room names white (dark); unread blue vs red+@; sender colours room-aware; macOS CSS scoped `html[data-tauri]`

## Next Actions (Priority Order)
1. Confirm 0.7.0 update lands on installed app, existing sign-in persists; run OAuth test script
2. Styling pass for next release (reaction tooltip, VerificationScreen, MessageSearch options, EventReactions modal, push rule editor, "(N more)" button; also window.alert in menus)
3. Favicon to penguin (web/index.html → copy under web/public/)
4. Decide DM sub-filter inside spaces (options A–D in questions.md)
5. iOS: design-language document, Element X fork, room list/timeline build
