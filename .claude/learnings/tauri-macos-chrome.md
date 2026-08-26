# Tauri macOS Native Window Chrome

## Key Facts
- `windowEffects` (vibrancy) requires `transparent: true` on the window.
- macOS transparency/vibrancy requires BOTH the `macos-private-api` Cargo feature (in `src-tauri/Cargo.toml`, on the `tauri` dependency) AND `app.macOSPrivateApi: true` in `tauri.conf.json`.
- `macOSPrivateApi: true` blocks App Store acceptance. Acceptable only when App Store distribution is not a goal.
- Valid `WindowEffect` values include `sidebar` (used for the sidebar/vibrancy look).
- `TitleBarStyle` values: `Visible`, `Transparent`, `Overlay`.
- `macOSPrivateApi` lives under `app` in `tauri.conf.json`, not under `tauri`.

## Gotchas
- Authoritative option names and shapes are in `web/node_modules/@tauri-apps/cli/config.schema.json` for whatever Tauri version is actually installed — read that file rather than recalling config shape from memory or from older Tauri docs; the schema changes across major versions.
- A `2rem` (28px) title bar height keeps native traffic lights vertically centred with no `trafficLightPosition` override needed. A taller title bar band requires an explicit `trafficLightPosition` override, which in turn requires `titleBarStyle: Overlay` plus `decorations: true`.
- Traffic lights run to roughly 66pt from the window's left edge. A left rail/sidebar that must not overlap them needs to be at least ~77px (≈5.5rem) wide.
- `dragDropEnabled` defaults to `true` and must be explicitly set to `false` in `tauri.conf.json` for HTML5 drag-and-drop to work in the webview — per the installed CLI's config schema, "Disabling it is required to use HTML5 drag and drop on the frontend." When left at the default, Tauri's native OS-level drop handler consumes the drop before the webview's JS handlers ever see it, so composer-level HTML5 drag/drop code can be completely correct and still never fire.
- `--room-list-background-overlay` is forced `transparent` inside `html[data-tauri]` (in `index.css`) so macOS vibrancy shows through the room list. Any new surface (e.g. settings section cards) built directly on that token in Tauri mode will render with no background at all — derive new opaque surfaces from `--background-color` via `color-mix` instead.
- A shadow's color still has to have something to contrast against: a black `box-shadow` cast onto an already near-black surface (e.g. `#16181f`) is effectively invisible, since there's no darker tone left for it to add. On dark surfaces, pair a light edge line (e.g. `1px 0 0 rgba(255,255,255,.07)`) with the dark blur rather than relying on the blur alone.
- A plain dimmed modal backdrop (flat black at high opacity) can read as "pasted on" against the app behind it. Adding `backdrop-filter: blur(...) saturate(115%)` to the dim layer, combined with a lighter dim (e.g. `.5` instead of `.75` black), removes that flat-cutout look — but the blur amount should stay `0px` in plain-browser mode and only apply a real value under `html[data-tauri]`, since it's meant to complement vibrancy, not fight a plain page.

## Tauri Version Alignment
- The `tauri` crate version (in `src-tauri/Cargo.toml`) and `@tauri-apps/api` npm version must stay in **lockstep on minor versions**. A mismatch (e.g., tauri 2.10 + @tauri-apps/api 2.11) causes a startup "version mismatch" error and suspected failures in plugin IPC (e.g., external links not opening, clipboard writes failing). Always check the installed CLI's crate version, match the npm package to it, and rebuild both when upgrading. Example: Tauri 2.11.5 + @tauri-apps/api 2.11.1 aligns on minor (2.11); Tauri 2.10.x + @tauri-apps/api 2.11.x does not.

## WKWebView Clipboard Limitations
- macOS WKWebView rejects `navigator.clipboard.writeText()` with a permissions error — there is no `NSPasteboardItemProvider` or similar delegate available for WKWebView's clipboard access. The API call simply fails without triggering a browser permission prompt (unlike Safari or Chrome).
- Workaround: replace all `navigator.clipboard.writeText()` calls with a fallback pattern in `web/src/util/clipboard.ts`:
  1. Try `navigator.clipboard.writeText(text)` (succeeds in browser mode)
  2. On rejection, fall back to `execCommand("copy")` on a hidden textarea with the text selected
  3. Clean up the textarea after the operation
- This pattern works on both macOS WKWebView (where clipboard API fails, execCommand succeeds) and browsers (where clipboard API succeeds, execCommand is redundant). Used in ShareModal, useSecondaryItems (toggle images), and other UI components.

## Patterns That Work
- Detect Tauri at runtime via `window.__TAURI_INTERNALS__` (no Tauri JS import needed for this check) and set `document.documentElement.dataset.tauri = "true"` early (e.g. in an inline module script in `index.html`). Scope ALL native-chrome CSS to `html[data-tauri]` so plain-browser use of the same frontend is completely unaffected.
- For a full-width custom title bar, do NOT add it as a spanning grid row in the layout. Instead, make the main content element `position: fixed; inset: 0` and push it down with `top: var(--titlebar-height)`. This avoids breaking responsive layouts that rely on multiple 100%-width grid columns sliding via `translate`.

## Tauri 2 ACL and Remote Origins
- **Remote origin definition:** When a webview loads an http:// or https:// URL (even http://localhost:29325), Tauri treats it as a REMOTE origin. Local origins are only tauri:// URLs. This distinction is critical for ACL capabilities.
- **Remote capability requirement:** If your app uses a localhost backend server (like a Go sidecar at http://localhost:29325), capabilities/default.json needs a `remote.urls` entry granting permissions for that origin, or ALL IPC calls to Tauri commands fail *silently* — no error, no warning, no visible failure. The app will appear hung or unresponsive.
- **Example:** For a sidecar at http://localhost:29325, add to capabilities/default.json:
  ```json
  "allow-*": [{
    "windows": ["main"],
    "webviews": ["main"],
    "uri": [{"url": "http://localhost:29325", "window": "main"}]
  }],
  "remote": {
    "urls": ["http://localhost:29325"]
  }
  ```
- **Core default excludes:** `core:window:allow-start-dragging` is NOT included in `core:default` capability. If you need window dragging, grant it explicitly even though it seems like a basic feature.
- **Data attributes for window regions:** `data-tauri-drag-region` (bare attribute) fires only when the mousedown target IS that element (children unaffected). `data-tauri-drag-region="deep"` matches the subtree. Interactive elements (BUTTON, INPUT, A, etc.) block drags. Text selection can be suppressed as a side effect of drag-region placement.
- **Dev vs prod:** Dev window loading devUrl (tauri://localhost) gets local origin, bypassing the remote.urls requirement entirely. This is why apps work in dev but fail in production when the change to an http:// backend is made.

## Icon Compiler (actool) and macOS .icon Bundles
- **actool crash on SVG layers with clipPath:** When an Icon Composer .icon file has ONLY an SVG layer (no fallback PNG), and that SVG uses a `<clipPath>` element (common in design tools for silhouetting), actool (Xcode 26.6+) crashes deterministically with "attempt to insert nil object" and produces no .car file. This is not an edge case — it's repeatable, blocking, and requires re-export.
- **Workaround:** Re-export the icon from Icon Composer using the PNG layer as the source instead of SVG. A 1024×1024 transparent RGBA PNG works fine.
- **Tauri integration:** @tauri-apps/cli ≥2.11 bundles .icon files listed in `bundle.icon` via actool → Assets.car (macOS 26+ asset catalog format). Tauri 2.10 and earlier don't support .icon at all.
- **Regeneration:** The canonical approach is to regenerate all icon sizes from a single source PNG via `npx tauri icon <path-to-png>`, which produces icns, ico, and PNG outputs. This is the "safe" path. If you want a .icon package, it must come from Icon Composer with a working PNG layer.
