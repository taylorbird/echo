#!/usr/bin/env bash
#
# Runs echo in an iOS Simulator: `mise run echo:ios:sim [--bundled] [name]`.
#
# By default it's the dev build with live reload from Vite. With --bundled the web app is
# built into the app (as a release carries it), so it runs with nothing serving it, and the
# script exits once the app is launched.
#
# `tauri ios dev` picks a simulator only when one runs the same iOS version as Xcode's SDK
# (Xcode 27.1 wants an iOS 27.1 runtime); otherwise it gives up and opens Xcode. This does
# what it would have done with any installed runtime: it starts `tauri ios dev --open`, which
# serves the frontend and answers the Xcode project's "Build Rust Code" step, with `open`
# shadowed so no Xcode window appears, then builds with xcodebuild and installs and launches
# the app in the simulator. Ctrl-C stops the dev server.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUNDLED=0
if [[ "${1:-}" == "--bundled" ]]; then
	BUNDLED=1
	shift
fi
NAME="${1:-iPhone 16 Pro}"

# The iOS Rust build is large: every worktree builds into the main checkout's target/, and
# without debug info or incremental output (about 4 GB, against 15 GB with both in a
# worktree of its own). Set any of these to override.
COMMON="$(cd "$(git -C "$ROOT" rev-parse --git-common-dir)/.." && pwd)"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$COMMON/target}"
export CARGO_INCREMENTAL="${CARGO_INCREMENTAL:-0}"
export CARGO_PROFILE_DEV_DEBUG="${CARGO_PROFILE_DEV_DEBUG:-0}"
BUNDLE_ID="dev.tbird.echo.dev"
DERIVED="$ROOT/target/ios-sim-derived"
OPTIONS="$ROOT/src-tauri/gen/apple/.tauri/cli-options-server.json"

die() {
	echo "error: $*" >&2
	exit 1
}

[[ -d "$ROOT/src-tauri/gen/apple" ]] || die "no iOS project: run 'mise run echo:ios:init' first"

UDID="$(xcrun simctl list devices available -j |
	jq -r --arg name "$NAME" '[.devices[][] | select(.name == $name)][0].udid // empty')"
[[ -n "$UDID" ]] || die "no available simulator named '$NAME'"
xcrun simctl boot "$UDID" 2>/dev/null || true

# `open -a Xcode …` becomes a no-op; everything else reaches the real open.
SHIM="$(mktemp -d)"
cat >"$SHIM/open" <<'EOF'
#!/bin/bash
for arg in "$@"; do
	case "$arg" in *Xcode* | *.xcodeproj | *.xcworkspace) exit 0 ;; esac
done
exec /usr/bin/open "$@"
EOF
chmod +x "$SHIM/open"

# Both modes leave Tauri's CLI running to answer the Xcode project's "Build Rust Code" step;
# --open makes it skip its own build, which insists on a simulator matching Xcode's SDK.
CONFIGS=(--config echo/tauri.echo.conf.json --config echo/tauri.echo.ios.conf.json)
rm -f "$OPTIONS"
if ((BUNDLED)); then
	PATH="$SHIM:$PATH" pnpm --dir "$ROOT" tauri ios build --open --debug --target aarch64-sim \
		"${CONFIGS[@]}" &
else
	PATH="$SHIM:$PATH" pnpm --dir "$ROOT" tauri ios dev --open "${CONFIGS[@]}" &
fi
DEV=$!

# Stops a process and everything under it, deepest first. The dev server runs below pnpm
# (pnpm, tauri, then Vite), and killing pnpm alone left Vite serving on the port.
kill_tree() {
	local child
	for child in $(pgrep -P "$1" 2>/dev/null); do
		kill_tree "$child"
	done
	kill "$1" 2>/dev/null || true
}
trap 'kill_tree "$DEV"; rm -rf "$SHIM"' EXIT

echo "==> waiting for Tauri's CLI"
until [[ -s "$OPTIONS" ]]; do
	kill -0 "$DEV" 2>/dev/null || die "tauri exited"
	sleep 1
done

echo "==> building for $NAME ($UDID)"
xcodebuild -project "$ROOT/src-tauri/gen/apple/app.xcodeproj" -scheme app_iOS \
	-configuration debug -sdk iphonesimulator -destination "id=$UDID" \
	-derivedDataPath "$DERIVED" ARCHS=arm64 -quiet build

xcrun simctl install "$UDID" "$DERIVED/Build/Products/debug-iphonesimulator/echo.app"
xcrun simctl launch "$UDID" "$BUNDLE_ID"
# Show the simulator: Xcode 27.2 replaced Simulator.app with Device Hub (bundle id
# com.apple.dt.Devices, in Xcode.app/Contents/Applications); older Xcodes have Simulator.
# Without either the app still runs headless, and `xcrun simctl io booted screenshot` sees it.
open -b com.apple.dt.Devices 2>/dev/null || open -a Simulator 2>/dev/null ||
	echo "note: neither Device Hub nor Simulator.app found; echo runs headless"
if ((BUNDLED)); then
	echo "==> echo is running in $NAME"
	exit 0
fi
echo "==> echo is running; Ctrl-C stops the dev server"
wait "$DEV"
