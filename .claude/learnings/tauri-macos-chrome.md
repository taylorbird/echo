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

## Patterns That Work
- Detect Tauri at runtime via `window.__TAURI_INTERNALS__` (no Tauri JS import needed for this check) and set `document.documentElement.dataset.tauri = "true"` early (e.g. in an inline module script in `index.html`). Scope ALL native-chrome CSS to `html[data-tauri]` so plain-browser use of the same frontend is completely unaffected.
- For a full-width custom title bar, do NOT add it as a spanning grid row in the layout. Instead, make the main content element `position: fixed; inset: 0` and push it down with `top: var(--titlebar-height)`. This avoids breaking responsive layouts that rely on multiple 100%-width grid columns sliding via `translate`.
