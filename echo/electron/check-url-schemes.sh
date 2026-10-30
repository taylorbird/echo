#!/usr/bin/env bash
#
# Fails unless a packaged app declares exactly one URL scheme, the given one. Each echo build
# signs in through its own scheme (echo/electron/app.ts) and declares only that in its
# Info.plist, so it never claims another build's (or Sable's moe.sable.next). build.sh runs this
# on every build, release-electron.sh's included. Reads the bundle with PlistBuddy only.
#
# Usage: echo/electron/check-url-schemes.sh <path/to/App.app> <scheme>
set -euo pipefail

APP="${1:?usage: check-url-schemes.sh <app> <scheme>}"
EXPECTED="${2:?usage: check-url-schemes.sh <app> <scheme>}"
PLIST="$APP/Contents/Info.plist"
[[ -f "$PLIST" ]] || {
	echo "error: no $PLIST" >&2
	exit 1
}

plist() {
	/usr/libexec/PlistBuddy -c "Print :$1" "$PLIST" 2>/dev/null
}

SCHEMES=()
type=0
while plist "CFBundleURLTypes:$type" >/dev/null; do
	scheme=0
	while value="$(plist "CFBundleURLTypes:$type:CFBundleURLSchemes:$scheme")"; do
		SCHEMES+=("$value")
		scheme=$((scheme + 1))
	done
	type=$((type + 1))
done

if [[ "${#SCHEMES[@]}" -ne 1 || "${SCHEMES[0]}" != "$EXPECTED" ]]; then
	echo "error: $APP declares URL schemes [${SCHEMES[*]-}], expected only $EXPECTED" >&2
	exit 1
fi
