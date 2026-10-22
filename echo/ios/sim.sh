#!/usr/bin/env bash
#
# Runs echo's dev build in an iOS Simulator with live reload: `mise run echo:ios:sim [name]`.
#
# `tauri ios dev` picks a simulator only when one runs the same iOS version as Xcode's SDK
# (Xcode 27.1 wants an iOS 27.1 runtime); otherwise it gives up and opens Xcode. This does
# what it would have done with any installed runtime: it starts `tauri ios dev --open`, which
# serves the frontend and answers the Xcode project's "Build Rust Code" step, with `open`
# shadowed so no Xcode window appears, then builds with xcodebuild and installs and launches
# the app in the simulator. Ctrl-C stops the dev server.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAME="${1:-iPhone 16 Pro}"
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

rm -f "$OPTIONS"
PATH="$SHIM:$PATH" pnpm --dir "$ROOT" tauri ios dev --open \
	--config echo/tauri.echo.conf.json --config echo/tauri.echo.ios.conf.json &
DEV=$!
trap 'kill "$DEV" 2>/dev/null; rm -rf "$SHIM"' EXIT

echo "==> waiting for the dev server"
until [[ -s "$OPTIONS" ]]; do
	kill -0 "$DEV" 2>/dev/null || die "tauri ios dev exited"
	sleep 1
done

echo "==> building for $NAME ($UDID)"
xcodebuild -project "$ROOT/src-tauri/gen/apple/app.xcodeproj" -scheme app_iOS \
	-configuration debug -sdk iphonesimulator -destination "id=$UDID" \
	-derivedDataPath "$DERIVED" ARCHS=arm64 -quiet build

xcrun simctl install "$UDID" "$DERIVED/Build/Products/debug-iphonesimulator/echo.app"
xcrun simctl launch "$UDID" "$BUNDLE_ID"
open -a Simulator
echo "==> echo is running; Ctrl-C stops the dev server"
wait "$DEV"
