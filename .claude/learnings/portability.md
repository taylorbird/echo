# Cross-Platform Portability

Assessment findings from evaluating iOS/Android and Linux/Windows ports of echo.

## The Go backend: CGO dependency on SQLite

- **CGO is required only for SQLite:** Driver is registered as `"sqlite3-fk-wal"` via a blank import of `go.mau.fi/util/dbutil/litestream`, whose `register.go` is gated `//go:build cgo` and registers the driver through `github.com/mattn/go-sqlite3` (a C binding). That is the only hard CGO dependency.
- **Direct dependency chain:** `pkg/gomuks/gomuks.go:89` registers the driver → blank import of `go.mau.fi/util/dbutil/litestream` at `pkg/hicli/hicli.go:23` → `register.go` is `//go:build cgo` and uses `github.com/mattn/go-sqlite3` (go.mod:26, a direct dep).
- **Inferred:** `CGO_ENABLED=0` compiles without errors but fails at runtime with an unknown-driver error when the app tries to open `gomuks.db`.
- **Cross-compiling the sidecar requires a C cross-toolchain per target** (or per-OS CI runners). Upstream's `.gitlab-ci.yml:124-153` uses per-target Docker images (`dock.mau.dev/tulir/gomuks-build-docker:<target>` for linux/amd64, linux/arm, linux/arm64, windows/amd64).
- **Other CGO dependencies:** HEIC (image format, `media_heic.go`) and cwebp (WebP transcoding, `media_cwebp.go`) are also cgo-gated but degrade gracefully with `//go:build cgo` guards; format is simply unavailable on pure-Go builds.
- **Libolm is already avoided:** Release builds use `-tags goolm,sqlite_fts5` (release.sh; `sqlite_fts5` is required since the gomuks v26.06 merge) to swap the C Olm library for mautrix-go's pure-Go reimplementation (`maunium.net/go/mautrix/crypto/goolm`, selected by the `goolm` build tag).

## The wasmuks path: WASM backend exists, unfit for iOS

- **Upstream includes a complete WASM build:** `cmd/wasmuks/` directory, built with `//go:build js`, runs the entire gomuks backend in a Web Worker. Includes `pkg/sqlite-wasm-js/` (pure-JS SQLite driver).
- **Build via `web/build-wasm.sh`:** Compiles the Go backend to WASM, bundles it with the React frontend, produces a static site deployable to any host.
- **Frontend gate in `index.html`:** When no Tauri runtime is detected (`!window.__TAURI_INTERNALS__`) and no `gomuks-frontend-etag` meta tag, the frontend auto-selects wasmuks and spins up the WASM backend in a Worker. Tauri builds are explicitly excluded from the gate.
- **Unfit for iOS:** (1) iOS suspends background tasks, so sync cannot run when the app is backgrounded. (2) Notifications need decrypted content in the notification body; a WASM backend running in the main JS thread (or any Worker) cannot run inside a notification extension, so push notifications stay encrypted and useless. (3) On-phone performance is unmeasured. (4) Native feel is capped at web-app (no system notifications, no badge counts, no VoIP integration).
- **Viable as a test:** Building wasmuks + hosting statically + testing in mobile Safari (no iOS suspension in browser) is a zero-code way to verify frontend behavior on a phone before committing to a native build.

## Desktop port: macOS vs. Linux/Windows

### Architecture overview
- Tauri 2.0 app (React frontend, Go backend sidecar)
- macOS-specific surfaces (transparent window, vibrancy, traffic lights, native menu, window chrome CSS)
- Release pipeline single-platform (scripts/release.sh hardcoded for macOS)

### Linux/Windows blockers and moderate plumbing

**SQLite cross-compilation:** Already covered under CGO dependency (above). Each target OS needs its own build or a per-target runner with cross-compiler.

**Binary naming:** `scripts/release.sh:242` has hardcoded per-platform binary names like `gomuks-aarch64-apple-darwin`. Supporting a new platform requires adding its triple and recompiling on that OS or with a cross-toolchain.

**Tauri Assets (icon bundling):** `tauri.conf.json:41` references `"icons/Assets.car"` (a macOS Xcode asset catalog, compiled binary format). Tauri Windows/Linux builds do not use Assets.car; they expect individual PNG files. Supporting Windows/Linux requires building separate icon asset chains and conditionally including them in the bundle config.

**Latent Windows data-dir bug:** `web/src-tauri/src/lib.rs:244` uses `cfg!(target_os = "macos")` to make the data directory the same as the config directory. Meanwhile, `pkg/gomuks/gomuks.go:142` does the same check for `windows || darwin`, so the two sides would disagree on Windows: Rust would put config in one place and data in another, while Go would put them together. Needs a coordinated fix (both sides should use the same cfg check).

**macOS-specific window chrome:** 
- `tauri.conf.json:13` has `macOSPrivateApi: true` (required for vibrancy effects)
- `tauri.conf.json:22-29` has `titleBarStyle`, `hiddenTitle`, `windowEffects` (macOS window effects)
- Two CSS blocks scoped to `html[data-tauri]` only (index.css:454-694 ~54 declarations for titlebar/panes/sidebar styling; MainScreen.css:79-113 for mobile slide) — these are macOS-only UI chrome
- Frontend has NO macOS sniffing: keybindings.ts registers Ctrl and Super variants side by side (will work on any platform)

**Release pipeline:** `scripts/release.sh` is entirely macOS-centric:
- Uses macOS tools: `security`, `xcrun actool`, `xcrun stapler`, `xcrun notarytool`, `spctl`, `killall ibtoold`, `codesign`, `hdiutil`
- Pre-compiles `icons/Assets.car` via actool (macOS-only toolchain)
- Signs and notarizes for macOS
- Produces a `.dmg` installer (macOS-only)
- `latest.json` (updater config) has a single platform key: `darwin-aarch64`
- Supporting a new OS requires a new release pipeline branch or conditional logic (not attempted yet)

### Effort estimate
**Moderate plumbing.** No architectural blockers, but incremental work on multiple fronts:
1. Cross-compile SQLite sidecar per target OS (need cross-toolchain setup or per-OS runners)
2. Conditionally include icon assets (separate PNG chains per OS, config changes)
3. Fix latent Windows data-dir mismatch (coordinate Rust + Go config handling)
4. Extract macOS-specific window chrome CSS into a conditional block (or keep it and let it harmlessly fail on other OSes)
5. Build conditional release pipeline (or separate branches)

None of these are blockers individually; the aggregate work is substantial but well-understood.

## Verifiable facts (2026-09-01)

- ✓ gomuks requires CGO for the sqlite3 driver (mattn/go-sqlite3 C binding)
- ✓ wasmuks exists, builds, and can run in a Web Worker
- ✓ wasmuks is unsuitable for iOS (suspension, no notification extension, no native feel)
- ✓ Backend has zero rate-limiting or lockout (grep verified)
- ✓ Tauri assets (Assets.car) are macOS-specific (Windows/Linux need separate asset chains)
- ✓ release.sh is macOS-only (uses Security framework, Xcode tools, DMG creation)
- ✓ Linux/Windows port is moderate effort (no architectural blockers, incremental plumbing)

## Related learnings

- backend-auth.md: authentication mechanics, rate-limiting gap
- dev-environment-gotchas.md: build commands, Vite dev server setup, CGO/goolm
- release-pipeline.md: release workflow, signing, notarization, latest.json generation
