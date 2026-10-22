#!/usr/bin/env bash
#
# Builds echo's macOS desktop app with Sable's Electron shell (electron/), branded as echo:
# identifier, name, icon, permission prompts, copyright and update feed. Sable's packaging
# (electron/package.mjs, electron-builder.yml) does the work; echo only passes overrides, so
# electron/ stays Sable's.
#
# Usage: echo/electron/build.sh [--identifier ID] [--version X.Y.Z] [--skip-frontend]
#                               [-- extra electron-builder args]
#
#   --identifier   bundle ID and data folder name. Default dev.tbird.echo.dev (dev builds);
#                  releases use dev.tbird.echo. The app's data lives in
#                  ~/Library/Application Support/<ID>, the folder Tauri echo used, so a build
#                  with an installed echo's identifier opens that install's session.
#   --version      app version. Default: echo's version (echo/tauri.echo.release.conf.json).
#   --skip-frontend  reuse dist/ as built (it must have been built with the same version).
#
# Anything after `--` goes to electron-builder: release-electron.sh passes signing that way.
# Output: electron/release/echo-<version>-arm64.{dmg,zip} and latest-mac.yml, and
# electron/release/mac-arm64/echo.app.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RELEASE_CONF="$REPO_ROOT/echo/tauri.echo.release.conf.json"

die() {
	echo "error: $*" >&2
	exit 1
}

IDENTIFIER="dev.tbird.echo.dev"
VERSION=""
FRONTEND=1
while [[ $# -gt 0 ]]; do
	case "$1" in
	--identifier)
		IDENTIFIER="${2:?--identifier needs a value}"
		shift 2
		;;
	--version)
		VERSION="${2:?--version needs a value}"
		shift 2
		;;
	--skip-frontend)
		FRONTEND=0
		shift
		;;
	--)
		shift
		break
		;;
	*) die "unknown argument: $1 (electron-builder arguments go after --)" ;;
	esac
done

# echo's main-process hooks (echo/electron/app.ts) switch on for these identifiers only.
[[ "$IDENTIFIER" == "dev.tbird.echo" || "$IDENTIFIER" == dev.tbird.echo.* ]] \
	|| die "not an echo identifier: $IDENTIFIER"
[[ "$IDENTIFIER" != "dev.tbird.echo-dev" ]] \
	|| die "dev.tbird.echo-dev is echo-gomuks's dev data folder"

if [[ -z "$VERSION" ]]; then
	VERSION="$(jq -r '.version' "$RELEASE_CONF")"
fi
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "version is not X.Y.Z: $VERSION"

# Sable's stable flavour forces Sable's own identifier (electron/package.mjs).
unset SABLE_BUILD_FLAVOR
export SABLE_IDENTIFIER="$IDENTIFIER"
export VERSION
export VITE_APP_VERSION="$VERSION"

if [[ "$FRONTEND" == "1" ]]; then
	echo "==> Building the web app (echo $VERSION)"
	pnpm --dir "$REPO_ROOT" build
fi
[[ -f "$REPO_ROOT/dist/index.html" ]] || die "no web app in dist/; build without --skip-frontend"

echo "==> Packaging echo $VERSION as $IDENTIFIER"
# The packaged echo.app is the input to every check after this, so a stale one must not survive a
# failed build.
rm -rf "$REPO_ROOT/electron/release/mac-arm64"
pnpm --dir "$REPO_ROOT/electron" run package --mac --arm64 \
	"-c.appId=$IDENTIFIER" \
	"-c.productName=echo" \
	"-c.copyright=Copyright © SableClient contributors and taylorbird" \
	"-c.publish.provider=generic" \
	"-c.publish.url=https://github.com/taylorbird/echo/releases/latest/download/" \
	"-c.publish.updaterCacheDirName=echo-updater" \
	"-c.mac.artifactName=echo-\${version}-\${arch}.\${ext}" \
	"-c.mac.icon=../echo/icons/echo.icon" \
	"-c.mac.extendInfo.NSCameraUsageDescription=echo needs camera access for video calls, photos and videos." \
	"-c.mac.extendInfo.NSMicrophoneUsageDescription=echo needs microphone access for calls and videos." \
	"-c.mac.extendInfo.NSAudioCaptureUsageDescription=echo captures system audio when sharing your screen with sound." \
	"-c.mac.extendInfo.NSLocalNetworkUsageDescription=echo connects to homeservers and call servers on your local network." \
	"-c.dmg.title=echo \${version}" \
	"$@"

APP="$REPO_ROOT/electron/release/mac-arm64/echo.app"
[[ -d "$APP" ]] || die "electron-builder made no $APP"
BUILT_ID="$(defaults read "$APP/Contents/Info.plist" CFBundleIdentifier)"
[[ "$BUILT_ID" == "$IDENTIFIER" ]] || die "built bundle ID is $BUILT_ID, expected $IDENTIFIER"
BUILT_VERSION="$(defaults read "$APP/Contents/Info.plist" CFBundleShortVersionString)"
[[ "$BUILT_VERSION" == "$VERSION" ]] || die "built version is $BUILT_VERSION, expected $VERSION"
echo "==> Built $APP ($BUILT_ID $BUILT_VERSION)"
