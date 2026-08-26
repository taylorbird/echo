# Dev Environment Gotchas

## Key Facts
- Vite does NOT reserve its configured/default port — if it's taken, it silently walks forward to the next free one. Combined with a hardcoded Tauri `devUrl`, this once caused the Tauri app window to load a completely different local project's dev server without any error. Always pin the port with `server.strictPort: true` in `vite.config.ts` and keep `devUrl` in `tauri.conf.json` in sync with it — `strictPort` turns a silent wrong-app load into a loud startup failure.

## Gotchas
- Visual verification of the running app is unavailable in this environment:
  - `screencapture` fails with "could not create image from display" — the terminal (ghostty) lacks macOS Screen Recording permission.
  - The chrome-devtools MCP cannot attach without Chrome already running with a debug port; a fresh profile only reaches a login screen.
  - `osascript` System Events reports 0 windows for a transparent Tauri window — this is an Accessibility-API quirk of transparent windows, not evidence the app failed to render.
- Deleting an icon/asset file before updating the import that references it causes a transient Vite "Failed to resolve import" error (and a stale error overlay). Update the import first, or force a full page reload afterward (e.g. by touching `index.html`) to clear it.
- A Bash PreToolUse hook in this environment rejects some compound/looping shell commands — e.g. `for` loops using `lsof`, or chained commands like `screencapture ...; ls`. Use python3 one-liners or separate single-purpose Bash calls instead.
- WebKit defers repaints of elements using `content-visibility: auto` + `contain: strict`. During rapid class changes (e.g., `.active` toggled on two different elements in quick succession), both paint-defers, leaving the old and new states both visually highlighted for ~100ms until a later event loop cycle triggers a repaint. This became visible during fast Alt+↑/↓ room navigation when room-list entries used `content-visibility: auto`. Solution: abandon virtualization for room lists and render entries unconditionally (room lists are small enough that DOM size is acceptable).
- After a Tauri shell rebuild (sidecar recompile), the webview's first `/_gomuks/auth` request can beat the sidecar to port 29325, resulting in ECONNREFUSED (misreported as "auth fail" to the user). FIXED in production 2026-08-25: lib.rs waits for backend TCP readiness before creating the window. Dev can still hit it after a shell rebuild; workaround there: `touch web/index.html` (triggers Vite full reload).

## Patterns That Work
- To confirm a Tauri webview is alive without visual access: check for an ESTABLISHED TCP connection from the `com.apple.WebKit.WebContent` process to the Vite dev port, e.g. `lsof -nP -iTCP:6173 -sTCP:ESTABLISHED`. Combined with Vite's HMR (so changes appear live) and the user directly looking at the screen and reporting back, this closes the feedback loop fast enough to iterate on visual changes despite having no screenshot capability.

## Headless Chrome / Chromium SVG Rendering
- **SVG → PNG export works but hangs on exit:** Headless Chrome (`chromium-browser --headless --screenshot --default-background-color=00000000`) renders SVG correctly to transparent PNG but hangs indefinitely on exit (process never terminates). The hang is not a crash — the process sleeps, possibly waiting for a file handle or resource cleanup.
- **Workaround:** Run headless Chrome in the background with a defined timeout or kill it explicitly after the screenshot is written. Example:
  ```bash
  chromium-browser --headless --screenshot=output.png --default-background-color=00000000 file:///path/to/icon.svg &
  sleep 2 && kill %1
  ```
  The PNG is written promptly (within the first second), and the background job + explicit kill avoids waiting for the hung process to exit naturally.
- **Note:** This hang does not appear in interactive Chrome or in other Headless tools (e.g., Puppeteer with `browser.close()` works fine); it's specific to the command-line headless mode with file:// URLs.

## Build Commands
Requires Rust. **No longer requires libolm or any CGO flags** — the sidecar builds with
`-tags goolm`, which selects mautrix-go's pure-Go olm implementation (available since
mautrix v0.26.3). Without the tag the default is still the libolm cgo binding, so the tag is
not optional: drop it and the Homebrew dependency comes back.

```bash
# Frontend dist FIRST — the sidecar go:embeds web/dist (web/frontend.go), so the
# Go binary must be rebuilt after any frontend change that should ship in prod
cd web && npm run build

# Go backend sidecar (package is ./cmd/gomuks — `./...` does NOT work with -o)
go build -tags goolm -o web/src-tauri/binaries/gomuks-aarch64-apple-darwin ./cmd/gomuks

# Run Tauri dev (loads http://localhost:6173 via Vite proxy, no custom icon in dev)
cd web && npx tauri dev

# Production build. Prod window loads http://localhost:29325 (same-origin with
# sidecar; see lib.rs) after a TCP readiness wait — NOT the static dist.
cd web && npx tauri build

# Open production app
open /Users/tbird/gomuks/web/src-tauri/target/release/bundle/macos/echo.app
```

For an actual **release**, don't run these by hand — use `scripts/release.sh <version|patch|minor>`.
It enforces the build order above, bumps the three version files that must stay in sync
(`web/src-tauri/tauri.conf.json`, `web/package.json`, `web/src-tauri/Cargo.toml`), signs and
notarizes via `npx tauri build`, verifies stapling, generates the updater `latest.json`, and
publishes the GitHub release. It deliberately commits only the three version files, since this
branch carries a lot of unrelated uncommitted work.

## The tauri dev watcher vs the sidecar (restart storms)

`npx tauri dev` watches ALL of `web/src-tauri/` and restarts the app on every changed
file. Two consequences (both observed 2026-08-26):

- **Never run `npx tauri icon` while `tauri dev` is running.** It rewrites dozens of
  files under `src-tauri/icons/`, each triggering its own rebuild+restart. The rapid
  kill/spawn cycles race the sidecar on port 29325 and reliably end with the surviving
  app instance having a dead sidecar.
- **Any `tauri.conf.json` edit restarts the app**, and the backend is down for ~30-60s
  during the handover. During that window the frontend shows misleading errors:
  "authentication failure" (dev vite proxy ECONNRESET) or "Authentication failed:
  Internal Server Error" (vite's own 500 when the upstream is refused). These are NOT
  auth problems.

The sidecar can also die silently in these handovers: it logs "Server started" to
`~/Library/Logs/gomuks/gomuks.log` (rotated per start) and then panics to stderr,
which lib.rs drops (`let (_rx, child) = sidecar.spawn()`). If the app is up but login
fails, check `lsof -nP -iTCP:29325 -sTCP:LISTEN` first. Recovery: stop tauri dev,
pkill leftover `target/debug/app` / `gomuks-aarch64-apple-darwin`, relaunch.
