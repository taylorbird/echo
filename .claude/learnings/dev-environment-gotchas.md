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

## Patterns That Work
- To confirm a Tauri webview is alive without visual access: check for an ESTABLISHED TCP connection from the `com.apple.WebKit.WebContent` process to the Vite dev port, e.g. `lsof -nP -iTCP:6173 -sTCP:ESTABLISHED`. Combined with Vite's HMR (so changes appear live) and the user directly looking at the screen and reporting back, this closes the feedback loop fast enough to iterate on visual changes despite having no screenshot capability.
