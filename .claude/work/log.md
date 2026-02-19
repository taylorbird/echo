# Work Log

<!-- Entries prepended, newest first -->

## 2026-02-18 20:20

**Session Summary**: Finalized app icon with custom lobster/seabug image. Iterated through multiple icon versions until finding the right one (seabug.png with transparency). Regenerated all icon sizes and formats (PNG, icns). Confirmed production build shows the icon correctly. Discussed future mobile support - Tauri 2.0 supports iOS/Android, and matrix-rust-sdk is the planned backend approach for cross-platform support.

**Decisions Made**:
- matrix-rust-sdk for mobile: Will replace Go sidecar for iOS/Android support, runs natively in Tauri's Rust layer
- Production build for icon: Dev mode uses cached icon, production build required to see custom icon

**Actions Taken**:
- Regenerated icons from seabug.png (RGBA with transparency)
- Built production Seabug.app with new icon
- Confirmed icon appears correctly in dock

**Context/Thoughts**:
- Tauri dev mode never shows custom icons - this is expected behavior
- For mobile, Go sidecar won't work - need matrix-rust-sdk or similar
- Element X uses matrix-rust-sdk, so it's a proven approach
- Other backend options: matrix-js-sdk (JS), WASM, gomobile (complex)

## 2026-02-18 20:05

**Session Summary**: Major visual redesign of the gomuks frontend. Applied user's custom "Ferra" warm color theme from their Element themes repo. Changed fonts to Lato at 14px. Redesigned room list with better spacing and alignment. Restructured message composer with icons below text input. Added faded timestamps and thinner scrollbars. Implemented custom user color feature with right-click color picker (using react-colorful). Added "Hide/Show images" toggle to message context menu. Changed preferences defaults (show_media_previews: true, show_hidden_events: false). Attempted drag-drop image upload on composer (needs testing). Renamed app to "Seabug" and added custom lobster icon.

**Decisions Made**:
- Lato font over Inter/Fira Code: cleaner look, good readability
- Ferra theme colors: warm oranges/corals (#fecdb2 text, #ffa07a accent) on dark backgrounds
- Three-tone background gradient: spaces bar darkest, room list dark, messages lightest
- Custom user colors stored in localStorage: simple persistence without backend changes
- react-colorful for color wheel: lightweight, works well

**Actions Taken**:
- Updated index.css with Ferra color variables and font changes
- Added Google Fonts link for Lato in index.html
- Restyled RoomList.css: wider space bar, room entry alignment, preview text sizing
- Restyled MessageComposer.css: icons below text, smaller/faded icons, larger send button
- Added 50% opacity to timestamps in TimelineEvent.css
- Added thin scrollbar styles globally (6px)
- Created custom user color system in media.ts (localStorage persistence)
- Added UserColorCard component in TimelineEvent.tsx with color picker
- Added react-colorful dependency
- Added "Hide/Show images" toggle in useSecondaryItems.tsx
- Changed show_media_previews default to true, show_hidden_events to false
- Added drag/drop handlers to MessageComposer.tsx
- Renamed productName and window title to "Seabug" in tauri.conf.json
- Generated all icon sizes from lobster image (RGBA conversion required for Tauri)

**Context/Thoughts**:
- Tauri icons must be RGBA format (not RGB) - build will fail otherwise
- Tauri dev mode doesn't show custom icons - need production build to see them
- Drag/drop on composer may need more testing - was inconsistent during dev
- The app is now distinctly styled and feels like a custom Matrix client

## 2026-02-18 17:15

**Session Summary**: Built a native macOS app using Tauri to wrap the existing React frontend, with the Go backend running as a managed sidecar process. Solved authentication issues by creating a custom WebAuthLogin React component since Tauri's webview doesn't trigger HTTP Basic Auth dialogs like browsers do. Implemented proper lifecycle management so the backend starts with the app and stops when the app closes.

**Decisions Made**:
- Use Tauri over Electron: lighter weight (~10MB vs ~150MB), better performance, uses native webview
- Keep Go backend for now: works well, can migrate to JS later if desired
- Sidecar approach: Go binary bundled with app, spawned on launch, killed on exit
- Custom auth component: Tauri webview doesn't handle HTTP Basic Auth prompts, so we built a React login form

**Actions Taken**:
- Installed Rust via rustup
- Added Tauri to the web project with shell plugin for sidecar support
- Configured tauri.conf.json for Vite dev server integration
- Set up Go binary as sidecar in binaries/gomuks-aarch64-apple-darwin
- Modified lib.rs to spawn sidecar on setup and kill on exit (with proper Rust lifecycle management)
- Updated gomuks config.yaml to allow tauri:// origin and enable insecure_cookies for dev
- Created WebAuthLogin.tsx component with matching CSS
- Modified rpc.ts doAuth() to support credential passing
- Modified client.ts to add retryAuthWithCredentials()
- Modified App.tsx to show WebAuthLogin when AUTH_REQUIRED

**Context/Thoughts**:
- Tauri v2 uses `tauri://localhost` as origin on macOS
- The shell plugin's sidecar spawn returns a CommandChild that must be stored and killed on exit
- Vite proxy handles forwarding /_gomuks/* to localhost:29325 in dev mode
- Session cookies from browser don't transfer to Tauri webview (separate cookie stores)
- For production build, will need to bundle the Go binary properly with correct target triple

## 2026-02-18 12:30

**Session Summary**: Got the gomuks fork fully building and running locally. Installed libolm dependency via Homebrew, configured CGO flags for the Go build, verified both the Go backend and web frontend compile successfully, and confirmed the application runs at localhost:29325.

**Decisions Made**:
- Treat backend and frontend as unified system (gomuks architecture requires both to function)

**Actions Taken**:
- Installed libolm via Homebrew
- Configured CGO_CFLAGS and CGO_LDFLAGS for libolm headers/libs
- Built full Go project successfully
- Built web frontend with Vite
- Started gomuks and verified it runs on localhost:29325

**Context/Thoughts**:
- libolm is deprecated upstream but still works
- Web frontend is Vite + TypeScript + React (in web/src/)
- Ready to start actual frontend redesign work
