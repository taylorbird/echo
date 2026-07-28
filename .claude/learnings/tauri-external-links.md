# External Links in a Tauri Webview

## Key Facts
- The gomuks Go backend's HTML sanitizer writes `target="_blank"` on every link it emits (`pkg/hicli/html.go` lines 228, 243, 409, 417, 442).
- A Tauri webview has nowhere to put a new tab/window, so it silently drops `target="_blank"` navigation requests — links that work fine in a browser appear completely dead in the Tauri app.

## Fix Pattern
- Add the official plugin pair: `tauri-plugin-opener` (Rust, in `src-tauri/Cargo.toml`) + `@tauri-apps/plugin-opener` (JS, in `package.json`).
- Register it in `src-tauri/src/lib.rs` via `.plugin(tauri_plugin_opener::init())`.
- Grant `"opener:allow-open-url"` in `src-tauri/capabilities/default.json`.
- Install a delegated `document` click listener (not per-link handlers) that calls the opener plugin for qualifying links, and no-ops entirely when `window.__TAURI_INTERNALS__` is absent (i.e. plain browser use is untouched).

## Gotchas
- Exclude `matrix:` URIs from the interceptor — they're handled in-app (e.g. `TextMessageBody.tsx:67` jumps to a room/user and calls `preventDefault`/`stopPropagation` itself).
- Bail out on `evt.defaultPrevented` and on non-left-clicks so other handlers (spoiler reveal, matrix: link handling) that already claimed the click keep working.
- Skip same-origin links (except `mailto:`) — they point at the gomuks backend for media/downloads, and the system browser has no session cookie for that origin, so opening them externally would just fail auth.
- Known remaining gap: same-origin media/download links with `target="_blank"` still do nothing inside Tauri. Sending them to the system browser isn't a valid fix (auth failure) — this needs a different approach (e.g. an in-app viewer or a signed short-lived URL) if it's ever prioritized.
