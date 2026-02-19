# Current State

## Project
Seabug (gomuks fork)

## Objective
Fork gomuks and redo the frontend to make it more visually appealing, wrapped as a native macOS app (with future iOS/Android support planned)

## Current Focus
App icon finalized with custom lobster/seabug image. Production build working with icon. Planning for future mobile support using matrix-rust-sdk.

## Last Checkpoint
2026-02-18 20:20

## Build Notes
Requires libolm and Rust. Build with:
```bash
# Go backend (one-time, for sidecar binary)
export CGO_CFLAGS="-I/opt/homebrew/opt/libolm/include"
export CGO_LDFLAGS="-L/opt/homebrew/opt/libolm/lib"
go build -o web/src-tauri/binaries/gomuks-aarch64-apple-darwin ./...

# Run Tauri dev (no custom icon in dev mode)
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
- Colors: Ferra theme (warm oranges/corals on dark backgrounds)
- Spaces bar: darkest (#1a181c), Room list: dark (#232125), Messages: base (#2b292d)
- Icon: Custom lobster/seabug on blue background

## Future: Mobile Support
Tauri 2.0 supports iOS/Android. Plan to use **matrix-rust-sdk** for the backend:
- Runs natively in Tauri's Rust layer (not a sidecar)
- Works on all platforms
- Used by Element X
- Single codebase for desktop + mobile

## Next Actions
1. Test/fix drag-drop image upload on composer
2. Refine any remaining UI elements as needed
3. Consider theming system for user-configurable colors
4. Explore matrix-rust-sdk integration for mobile support
