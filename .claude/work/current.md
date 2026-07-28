# Current State

## Project
Seabug (gomuks fork)

## Objective
Fork gomuks and redo the frontend to make it more visually appealing, wrapped as a native macOS app (with future iOS/Android support planned)

## Current Focus
The settings page redesign is complete and the user approved it. This session was a long visual-design iteration pass (room list/chat pane contrast and stacking, palette journey, chat text hierarchy, cool dark chat pane, header/icon sizing, right panel, reduced-motion fix, shadows on dark surfaces, full settings page redesign, toggle redesign, modal edge fix, corner-radius reversal, Cmd+, shortcut) plus two functional fixes (drag-and-drop, reaction hover tooltips). The whole session's work is UNCOMMITTED on branch `main` and is about to be committed.

## Last Checkpoint
2026-07-28 15:23 PDT

## Constraints
- Vite dev port is pinned to 6173 with `strictPort: true`; `devUrl` in `web/src-tauri/tauri.conf.json` must match. Never rely on Vite's default port-walking — it silently loaded a different local project's dev server into the Seabug window.
- All macOS-native chrome CSS must stay scoped to `html[data-tauri]` so plain-browser use of the frontend is unaffected.
- App Store distribution is explicitly NOT a constraint for this project (it's a personal app for the user); `macOSPrivateApi: true` is acceptable even though it would block App Store acceptance.
- Reading surfaces (chat/timeline) must stay opaque — text contrast must never depend on the user's desktop wallpaper showing through vibrancy.
- macOS "Reduce motion" is enabled on this machine, so every `prefers-reduced-motion` rule must also require `data-ignore-reduce-motion` to be absent, or the animation will silently never run.
- On the near-black chat pane a pure black shadow is invisible; separation on dark surfaces needs a light edge line, not a darker shadow.
- Square corners apply to the app's panes; modals may use a small radius (they float over a blurred backdrop where a 90° corner reads as harsh).
- Do not build settings/modal surfaces on `--room-list-background-overlay`: it is `transparent` inside `html[data-tauri]`.

## Build Notes
Requires libolm and Rust. The Vite dev server now runs on a pinned port, 6173 (was drifting to whatever port was free, which once caused the Tauri window to load a different project entirely). Build with:
```bash
# Go backend (one-time, for sidecar binary)
export CGO_CFLAGS="-I/opt/homebrew/opt/libolm/include"
export CGO_LDFLAGS="-L/opt/homebrew/opt/libolm/lib"
go build -o web/src-tauri/binaries/gomuks-aarch64-apple-darwin ./...

# Run Tauri dev (loads http://localhost:6173, no custom icon in dev mode)
cd web && npx tauri dev

# Production build (shows custom icon)
cd web && npx tauri build

# Open production app
open /Users/tbird/gomuks/web/src-tauri/target/release/bundle/macos/Seabug.app
```

## Architecture
- **Tauri 2.0** — native macOS app shell (named "Seabug"), supports iOS/Android
- **React frontend** — in web/src/, connects to backend via WebSocket
- **Go backend** — spawned as sidecar, manages Matrix protocol, starts/stops with app
- **Auth** — custom WebAuthLogin component for Tauri (browser uses HTTP Basic Auth)

## Theme
- Font: Lato (400 weight, 14px base)
- Colors: Ferra warm surfaces (room list, space rail, right panel) with a scoped cool near-black chat pane
- Room list / space rail: each given its own high-alpha tint so tone is wallpaper-independent (previously `--room-list-background`/`--room-list-background-overlay` were both `transparent` in Tauri, so the room list had no colour of its own)
- Solid title bar: `--titlebar-background` #232125, 2rem tall, native traffic lights centred, z-index 4
- Chat pane: cool near-black `--background-color: #16181f`, scoped to `div.room-view` only (sidebars keep Ferra warmth); composer `#1e212a` — now LIGHTER than the pane, so the old "recessed input" shadow logic no longer holds and the recess shadow is nearly invisible (black inset on near-black)
- Body text `#efe7e1` (warm off-white, was Ferra's saturated peach `#fecdb2`); secondary text `#b8aca6` (was cool lavender `#d1d1e0`); sender name stepped down to `.875rem`, weight 600, `.015em` tracking so it reads as a label over the message body
- Accent glow: `#ffe484`
- Saturated candy sender colours: `#ff5d73`, `#ffa64d`, `#4dd6a8`, `#a78bfa`, `#4db8f5`, `#ffd93d`, `#ff7ac6`, `#4de0e0`, `#ff8a65`, `#a3e635`
- Room header: `--room-header-height` token (was hardcoded `3.5rem` in three files), now `4.75rem` in Tauri; title `1.375rem` bold; avatar `3rem`; `--room-header-shadow` cast down over the timeline (needs `position: relative; z-index: 1` on the header since it's an earlier grid item than the timeline)
- Right panel: raised over the chat pane (mirrored shadow + `z-index: 3`, slide-in animation), background wears `--room-list-background` so it matches the room list
- Panes: square (no radius, per user preference — "don't want it curved"), floating with `.5rem` gaps and shadow, flush against the title bar (no top gap). Modals are the one exception: given a small radius (`.625rem` modal box, `.375rem` section cards) since they float over a blurred backdrop where a 90° corner reads as harsh, not because the square-pane rule was abandoned
- Icon: Custom lobster/seabug on blue background
- Icon set: hand-authored outlined Lucide-style set in `web/src/icons/modern/` used for sidebar/space rail/room header/settings (old filled Material icons kept for the rest of the app)

## Future: Mobile Support
Tauri 2.0 supports iOS/Android. Plan to use **matrix-rust-sdk** for the backend:
- Runs natively in Tauri's Rust layer (not a sidecar)
- Works on all platforms
- Used by Element X
- Single codebase for desktop + mobile

## Next Actions
1. Commit this session's work (in progress)
2. Consider whether the right panel should also adopt the cool dark palette — saturated sender colours currently fall to ~3.1-4.2:1 against the still-warm `#4a4553` right panel where member names use them, below the 4.5:1 AA threshold
3. Decide whether `--room-header-background` should get its own cool value instead of borrowing the room list's token, which lands nearly identical to the cool chat pane
4. Verify the room-list-wrapper's outer raise shadow actually escapes its `contain: strict`
5. Consider a room-less settings variant so Cmd+, works with no room selected
