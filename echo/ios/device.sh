#!/usr/bin/env bash
#
# Builds the self-contained dev app (dev.tbird.echo.dev, web app built in) for a connected
# iPhone, signs it with your Apple Development identity, installs it and launches it:
#
#   ECHO_IOS_TEAM=<team id> mise run echo:ios:device [device name]
#
# ECHO_IOS_TEAM is your Apple developer team ID (Xcode → Settings → Accounts; the "(…)"
# after a "Developer ID Application" identity in `security find-identity -v -p codesigning`;
# or the OU of the "Apple Development" certificate). The "(…)" after "Apple Development" is
# that certificate's own ID, not the team.
# It is passed in rather than written into the project, which is public. Xcode must be
# signed in to that team: the first build registers the app IDs, the app group and the
# device there (-allowProvisioningUpdates). The phone needs Developer Mode on
# (Settings → Privacy & Security). Without a device name it takes the first paired iPhone.
#
# As in sim.sh, `tauri ios build --open` answers the Xcode project's "Build Rust Code" step,
# with `open` shadowed so no Xcode window appears, and xcodebuild does the build.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NAME="${1:-}"
TEAM="${ECHO_IOS_TEAM:-}"
BUNDLE_ID="dev.tbird.echo.dev"
DERIVED="$ROOT/target/ios-device-derived"
OPTIONS="$ROOT/src-tauri/gen/apple/.tauri/cli-options-server.json"

die() {
	echo "error: $*" >&2
	exit 1
}

[[ -n "$TEAM" ]] || die "set ECHO_IOS_TEAM to your Apple developer team ID"
[[ -d "$ROOT/src-tauri/gen/apple" ]] || die "no iOS project: run 'mise run echo:ios:init' first"

# The same shared, slimmer Rust build as sim.sh.
COMMON="$(cd "$(git -C "$ROOT" rev-parse --git-common-dir)/.." && pwd)"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$COMMON/target}"
export CARGO_INCREMENTAL="${CARGO_INCREMENTAL:-0}"
export CARGO_PROFILE_DEV_DEBUG="${CARGO_PROFILE_DEV_DEBUG:-0}"

# A paired physical iPhone: by name, else the first one.
DEVICES="$(mktemp)"
xcrun devicectl list devices --json-output "$DEVICES" >/dev/null
UDID="$(jq -r --arg name "$NAME" '
	[.result.devices[]
	 | select(.hardwareProperties.reality == "physical")
	 | select(.hardwareProperties.deviceType == "iPhone")
	 | select($name == "" or .deviceProperties.name == $name)][0].hardwareProperties.udid // empty
' "$DEVICES")"
rm -f "$DEVICES"
[[ -n "$UDID" ]] || die "no paired iPhone${NAME:+ named '$NAME'}; connect it and trust this Mac"

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
PATH="$SHIM:$PATH" pnpm --dir "$ROOT" tauri ios build --open --debug --target aarch64 \
	--config echo/tauri.echo.conf.json --config echo/tauri.echo.ios.conf.json &
CLI=$!

kill_tree() {
	local child
	for child in $(pgrep -P "$1" 2>/dev/null); do
		kill_tree "$child"
	done
	kill "$1" 2>/dev/null || true
}
trap 'kill_tree "$CLI"; rm -rf "$SHIM"' EXIT

echo "==> waiting for Tauri's CLI"
until [[ -s "$OPTIONS" ]]; do
	kill -0 "$CLI" 2>/dev/null || die "tauri exited"
	sleep 1
done

echo "==> building for $UDID (team $TEAM)"
xcodebuild -project "$ROOT/src-tauri/gen/apple/app.xcodeproj" -scheme app_iOS \
	-configuration debug -sdk iphoneos -destination "id=$UDID" \
	-derivedDataPath "$DERIVED" -allowProvisioningUpdates \
	DEVELOPMENT_TEAM="$TEAM" CODE_SIGN_STYLE=Automatic ARCHS=arm64 -quiet build

APP="$DERIVED/Build/Products/debug-iphoneos/echo.app"
echo "==> installing"
xcrun devicectl device install app --device "$UDID" "$APP"
xcrun devicectl device process launch --device "$UDID" "$BUNDLE_ID" ||
	echo "note: installed; unlock the phone and open echo (first launch may ask you to trust the developer)"
echo "==> echo is on the phone"
