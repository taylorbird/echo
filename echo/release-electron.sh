#!/usr/bin/env bash
#
# Cuts a signed, notarized echo release of the Electron desktop app and publishes it to GitHub
# with two update feeds. Successor to echo/release.sh (the Tauri app's release, kept for
# reference); the preflight and its comments are carried over from it.
#
# Usage: echo/release-electron.sh <version|patch|minor>
#
# Feeds, both served from $GH_REPO_URL/releases/latest/download/:
#   latest-mac.yml  electron-updater's feed, read by Electron echo (1.1 onward). Points at the
#                   update ZIP (and its blockmap) on the tagged release.
#   latest.json     the Tauri updater's feed, read by Tauri echo 1.0.x and echo-gomuks 0.7.x
#                   installs (same bundle ID and updater key). Points at a minisign-signed
#                   tarball of the Electron echo.app: the Tauri updater unpacks it over the
#                   installed app and relaunches it, which moves those installs to Electron.
#                   They keep their data folder, so 1.0 installs stay signed in.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# echo's version lives here, as for the Tauri releases (echo/electron/build.sh reads it too).
RELEASE_CONF="$REPO_ROOT/echo/tauri.echo.release.conf.json"
OUT_DIR="$REPO_ROOT/electron/release"
APP="$OUT_DIR/mac-arm64/echo.app"
IDENTIFIER="dev.tbird.echo"

SIGNING_KEY="$HOME/.tauri/echo.key"
SIGNING_IDENTITY="Taylor Bird (UFCDGSKCXB)"
APPLE_ACCOUNT="taylor.bird@gmail.com"
APPLE_TEAM="UFCDGSKCXB"
GH_REPO="taylorbird/echo"
GH_ACCOUNT_REQUIRED="taylorbird"
GH_REPO_URL="https://github.com/$GH_REPO"
# Homebrew tap (`brew install --cask taylorbird/echo/echo`); bumped after the release is published.
TAP_REPO="taylorbird/homebrew-echo"
TAP_CASK="Casks/echo.rb"

die() {
	echo "error: $*" >&2
	exit 1
}

step() {
	echo
	echo "==> $*"
}

# --------------------------------------------------------------------------------------------
# Argument + preflight checks
# --------------------------------------------------------------------------------------------

[[ $# -eq 1 ]] || die "usage: echo/release-electron.sh <version|patch|minor>"
BUMP="$1"

for tool in jq gh pnpm mise security xcrun spctl perl codesign tar openssl ditto shasum base64; do
	command -v "$tool" >/dev/null 2>&1 || die "required tool not found on PATH: $tool"
done

read_version() { jq -r '.version' "$RELEASE_CONF"; }
CUR_VERSION="$(read_version)"
[[ "$CUR_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "current version is not semver: $CUR_VERSION"

IFS=. read -r CUR_MAJOR CUR_MINOR CUR_PATCH <<<"$CUR_VERSION"
case "$BUMP" in
patch) VERSION="$CUR_MAJOR.$CUR_MINOR.$((CUR_PATCH + 1))" ;;
minor) VERSION="$CUR_MAJOR.$((CUR_MINOR + 1)).0" ;;
*)
	[[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "not a semver version or patch/minor: $BUMP"
	VERSION="$BUMP"
	;;
esac
TAG="v$VERSION"

BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
[[ "$BRANCH" != "HEAD" ]] || die "detached HEAD — check out a branch before releasing"

# The release commit adds only the version file and the notes. Anything already staged would be
# swept into it.
git -C "$REPO_ROOT" diff --cached --quiet \
	|| die "there are staged changes; unstage them (git reset) so the release commit stays clean"

git -C "$REPO_ROOT" rev-parse -q --verify "refs/tags/$TAG" >/dev/null \
	&& die "tag $TAG already exists locally"
if git -C "$REPO_ROOT" ls-remote --exit-code --tags origin "$TAG" >/dev/null 2>&1; then
	die "tag $TAG already exists on origin"
fi

# Notes for the release being cut. One file, rewritten each time: whatever is in it now describes
# this version. Read here rather than at publish time so a missing or empty file fails in
# preflight instead of after the build and two notarization round trips.
RELEASE_NOTES_FILE="$REPO_ROOT/echo/RELEASE_NOTES.md"
[[ -f "$RELEASE_NOTES_FILE" ]] || die "no release notes at $RELEASE_NOTES_FILE"
# Comments are stripped by a non-greedy match: a sed line range would read a one-line
# <!-- … --> as an unclosed comment and drop everything after it.
RELEASE_NOTES="$(perl -0pe 's/<!--.*?-->//gs; s/[ \t]+$//mg' "$RELEASE_NOTES_FILE" \
	| awk 'NF {found = 1} found')"
[[ -n "$(printf '%s' "$RELEASE_NOTES" | tr -d '[:space:]')" ]] \
	|| die "$RELEASE_NOTES_FILE is empty — write what changed before releasing"

[[ -f "$SIGNING_KEY" ]] || die "updater signing key not found: $SIGNING_KEY"

# grep reads all its input (no -q): under pipefail, -q exiting at the first match can SIGPIPE the
# writer and fail the pipeline.
security find-identity -v -p codesigning | grep -F "Developer ID Application: $SIGNING_IDENTITY" >/dev/null \
	|| die "no 'Developer ID Application: $SIGNING_IDENTITY' certificate in the keychain"

# Pin the identity for the whole run instead of inheriting whichever account happens to be active:
# `gh auth switch` is global state, and on 2026-08-27 the active account flipped to a read-only
# one mid-release. GH_TOKEN pins every gh call below, and the git credential helper
# (`gh auth git-credential`) honours it too, so the push is pinned to the same account.
GH_TOKEN="$(gh auth token --user "$GH_ACCOUNT_REQUIRED" 2>/dev/null || true)"
[[ -n "$GH_TOKEN" ]] \
	|| die "no gh token for $GH_ACCOUNT_REQUIRED; run: gh auth login --user $GH_ACCOUNT_REQUIRED"
export GH_TOKEN

# GitHub answers a permission-denied write with 404 rather than 403, so without this the failure
# surfaces as a baffling "not found" at `gh release create` — after the build and notarization.
GH_ACCOUNT="$(gh api user -q .login 2>/dev/null || echo "unknown")"
[[ "$GH_ACCOUNT" == "$GH_ACCOUNT_REQUIRED" ]] \
	|| die "pinned gh token resolves to $GH_ACCOUNT, expected $GH_ACCOUNT_REQUIRED"
GH_PERMISSION="$(gh repo view "$GH_REPO" --json viewerPermission -q .viewerPermission 2>/dev/null || true)"
case "$GH_PERMISSION" in
ADMIN | MAINTAIN | WRITE) ;;
"") die "cannot read $GH_REPO as $GH_ACCOUNT — is that account still a collaborator?" ;;
*) die "$GH_ACCOUNT has $GH_PERMISSION on $GH_REPO and cannot publish a release" ;;
esac
TAP_PERMISSION="$(gh repo view "$TAP_REPO" --json viewerPermission -q .viewerPermission 2>/dev/null || true)"
case "$TAP_PERMISSION" in
ADMIN | MAINTAIN | WRITE) ;;
*) die "$GH_ACCOUNT cannot write $TAP_REPO (permission: ${TAP_PERMISSION:-none}), so the cask bump would fail" ;;
esac

# Resolve the keychain secrets up front: they can prompt, and finding out after a long build that
# notarization has no password is a bad trade.
UPDATER_KEY_PASSWORD="$(security find-generic-password -s echo-updater-key -w)" \
	|| die "keychain item 'echo-updater-key' not found"
NOTARY_PASSWORD="$(security find-generic-password -s echo-notary -w)" \
	|| die "keychain item 'echo-notary' not found"

# The Tauri feed's signature is made after the build and notarization. Prove the key and
# password work now, on a throwaway file.
SIGNER_PROBE="$(mktemp -d)"
echo "probe" >"$SIGNER_PROBE/probe.txt"
if ! TAURI_SIGNING_PRIVATE_KEY="$(cat "$SIGNING_KEY")" \
	TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$UPDATER_KEY_PASSWORD" \
	pnpm --dir "$REPO_ROOT" exec tauri signer sign "$SIGNER_PROBE/probe.txt" \
	>"$SIGNER_PROBE/log" 2>&1; then
	cat "$SIGNER_PROBE/log" >&2
	rm -rf "${SIGNER_PROBE:?}"
	die "the updater signing key or its password did not work; see log above"
fi
rm -rf "${SIGNER_PROBE:?}"

cat <<EOF

Releasing echo $CUR_VERSION -> $VERSION (Electron)
  branch: $BRANCH
  tag:    $TAG

EOF

if [[ -n "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=no)" ]]; then
	cat <<EOF
NOTE: this tree has uncommitted changes. They are built into the artifacts but will NOT be part
of the tagged commit, so $TAG will not reproduce this build from source.

$(git -C "$REPO_ROOT" status --short --untracked-files=no)
EOF
fi

# --------------------------------------------------------------------------------------------
# 1. Version bump
# --------------------------------------------------------------------------------------------

write_version() {
	local to="$1"
	perl -0pi -e "s/(\"version\":\s*\")[^\"]*(\")/\${1}$to\${2}/" "$RELEASE_CONF"
	[[ "$(read_version)" == "$to" ]] || die "failed to write version to $RELEASE_CONF"
}

# Put the version back if anything after the bump fails, so an aborted release leaves no stray edit.
VERSION_BUMPED=0
restore_version() {
	if [[ "$VERSION_BUMPED" == "1" ]]; then
		echo >&2
		echo "release aborted — restoring $RELEASE_CONF to $CUR_VERSION" >&2
		write_version "$CUR_VERSION"
	fi
}
trap restore_version EXIT

if [[ "$VERSION" != "$CUR_VERSION" ]]; then
	step "Bumping version to $VERSION"
	write_version "$VERSION"
	VERSION_BUMPED=1
fi

# --------------------------------------------------------------------------------------------
# 2. Build, sign, notarize
# --------------------------------------------------------------------------------------------

ZIP_NAME="echo-$VERSION-arm64.zip"
DMG_NAME="echo-$VERSION-arm64.dmg"
ZIP="$OUT_DIR/$ZIP_NAME"
BLOCKMAP="$ZIP.blockmap"
DMG="$OUT_DIR/$DMG_NAME"
FEED_DIR="$OUT_DIR/feed"
TARBALL="$FEED_DIR/echo.app.tar.gz"
SIG_FILE="$TARBALL.sig"

# Clear the artifacts we're about to verify, so a build that fails partway can't leave a previous
# build's files in place for every check below to pass on.
case "$OUT_DIR" in
"$REPO_ROOT/electron/release") ;;
*) die "refusing to delete outside electron/release: $OUT_DIR" ;;
esac
rm -rf "$APP" "$FEED_DIR" "$ZIP" "$BLOCKMAP" "$DMG" "$DMG.blockmap" "$OUT_DIR/latest-mac.yml"

step "Building, signing and notarizing (this waits on Apple; expect several minutes)"
(
	cd "$REPO_ROOT"
	# electron-builder notarizes the app when these three are set.
	export APPLE_ID="$APPLE_ACCOUNT"
	export APPLE_APP_SPECIFIC_PASSWORD="$NOTARY_PASSWORD"
	export APPLE_TEAM_ID="$APPLE_TEAM"
	mise exec -- echo/electron/build.sh --identifier "$IDENTIFIER" --version "$VERSION" -- \
		"-c.mac.identity=$SIGNING_IDENTITY" \
		-c.mac.hardenedRuntime=true \
		-c.forceCodeSigning=true
)

# --------------------------------------------------------------------------------------------
# 3. Locate + verify artifacts
# --------------------------------------------------------------------------------------------

step "Locating artifacts"
[[ -d "$APP" ]] || die "missing app bundle: $APP"
[[ -f "$ZIP" ]] || die "missing update ZIP: $ZIP"
[[ -f "$BLOCKMAP" ]] || die "missing update blockmap: $BLOCKMAP"
[[ -f "$DMG" ]] || die "missing DMG: $DMG"

BUILT_ID="$(defaults read "$APP/Contents/Info.plist" CFBundleIdentifier)"
[[ "$BUILT_ID" == "$IDENTIFIER" ]] || die "built bundle ID is $BUILT_ID, expected $IDENTIFIER"
BUILT_VERSION="$(defaults read "$APP/Contents/Info.plist" CFBundleShortVersionString)"
[[ "$BUILT_VERSION" == "$VERSION" ]] || die "built version is $BUILT_VERSION, expected $VERSION"

echo "  app:  $APP"
echo "  zip:  $ZIP"
echo "  dmg:  $DMG"

step "Verifying the signature and notarization"
codesign --verify --deep --strict "$APP" || die "$APP fails codesign --verify"
codesign -dv "$APP" 2>&1 | grep -F "TeamIdentifier=$APPLE_TEAM" >/dev/null || die "$APP is not signed by team $APPLE_TEAM"
xcrun stapler validate "$APP" || die "notarization ticket is not stapled to $APP"
spctl -a -t exec -vv "$APP" || die "Gatekeeper rejects $APP"

# What electron-updater installs is the app inside the ZIP, so check that one too.
ZIP_CHECK="$(mktemp -d)"
ditto -x -k "$ZIP" "$ZIP_CHECK"
[[ -d "$ZIP_CHECK/echo.app" ]] || die "$ZIP has no echo.app at its root"
codesign --verify --deep --strict "$ZIP_CHECK/echo.app" || die "the app in $ZIP fails codesign --verify"
rm -rf "${ZIP_CHECK:?}"

# electron-builder notarizes the app, then builds the DMG around it, so the DMG has never been
# submitted in its own right and needs its own round trip.
if ! spctl -a -t open --context context:primary-signature "$DMG"; then
	step "Signing and notarizing the DMG (a second wait on Apple)"
	codesign --force --timestamp --sign "Developer ID Application: $SIGNING_IDENTITY" "$DMG" \
		|| die "failed to sign $DMG"
	xcrun notarytool submit "$DMG" \
		--apple-id "$APPLE_ACCOUNT" \
		--password "$NOTARY_PASSWORD" \
		--team-id "$APPLE_TEAM" \
		--wait || die "notarytool rejected $DMG"
	xcrun stapler staple "$DMG" || die "failed to staple $DMG"
	spctl -a -t open --context context:primary-signature "$DMG" \
		|| die "$DMG still rejected by Gatekeeper after notarizing and stapling"
fi

# --------------------------------------------------------------------------------------------
# 4. Update feeds
# --------------------------------------------------------------------------------------------

mkdir -p "$FEED_DIR"
PUB_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
# Download URLs are the *tagged* ones, so an old feed never points at a new binary.
TAG_URL="$GH_REPO_URL/releases/download/$TAG"

step "Generating latest-mac.yml (Electron echo)"
# Written from scratch rather than rewriting electron-builder's: signing the DMG above changed
# its checksum, and electron-updater on macOS only ever downloads the ZIP. JSON is YAML, and
# electron-updater's YAML parser reads it.
ZIP_SHA512="$(openssl dgst -sha512 -binary "$ZIP" | openssl base64 -A)"
ZIP_SIZE="$(stat -f %z "$ZIP")"
LATEST_MAC="$FEED_DIR/latest-mac.yml"
jq -n \
	--arg version "$VERSION" \
	--arg url "$TAG_URL/$ZIP_NAME" \
	--arg sha512 "$ZIP_SHA512" \
	--argjson size "$ZIP_SIZE" \
	--arg date "$PUB_DATE" \
	--arg notes "$RELEASE_NOTES" \
	'{
		version: $version,
		files: [{url: $url, sha512: $sha512, size: $size}],
		path: $url,
		sha512: $sha512,
		releaseDate: $date,
		releaseNotes: $notes,
	}' >"$LATEST_MAC"
echo "  wrote $LATEST_MAC"

step "Packing and signing the Tauri bridge (echo 1.0 and echo-gomuks installs)"
# The Tauri updater drops the first path component of every entry and unpacks the rest over the
# installed app, so echo.app must be the archive's top component. Symlinks (Electron's
# frameworks are full of them) are archived as links; no AppleDouble or extended-attribute
# entries, which the updater would unpack as files and which would break the signature.
COPYFILE_DISABLE=1 tar --no-mac-metadata --no-xattrs -czf "$TARBALL" -C "$(dirname "$APP")" echo.app
[[ "$(tar -tzf "$TARBALL" | head -1)" == echo.app/* ]] || die "$TARBALL does not start with echo.app/"
TAURI_SIGNING_PRIVATE_KEY="$(cat "$SIGNING_KEY")" \
	TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$UPDATER_KEY_PASSWORD" \
	pnpm --dir "$REPO_ROOT" exec tauri signer sign "$TARBALL" >/dev/null
[[ -f "$SIG_FILE" ]] || die "missing updater signature: $SIG_FILE"

LATEST_JSON="$FEED_DIR/latest.json"
jq -n \
	--arg version "$VERSION" \
	--arg pub_date "$PUB_DATE" \
	--arg notes "$RELEASE_NOTES" \
	--rawfile signature "$SIG_FILE" \
	--arg url "$TAG_URL/$(basename "$TARBALL")" \
	'{
		version: $version,
		pub_date: $pub_date,
		notes: $notes,
		platforms: {
			"darwin-aarch64": {
				signature: ($signature | rtrimstr("\n")),
				url: $url,
			},
		},
	}' >"$LATEST_JSON"
echo "  wrote $LATEST_JSON"

# --------------------------------------------------------------------------------------------
# 5. Commit, tag, publish
# --------------------------------------------------------------------------------------------

mkdir -p "$REPO_ROOT/echo/release-notes"
printf '%s\n' "$RELEASE_NOTES" >"$REPO_ROOT/echo/release-notes/$VERSION.md"

step "Committing the release"
git -C "$REPO_ROOT" add echo/tauri.echo.release.conf.json "echo/release-notes/$VERSION.md"
git -C "$REPO_ROOT" commit -s -m "Release $TAG"
VERSION_BUMPED=0
git -C "$REPO_ROOT" tag "$TAG"

step "Pushing $BRANCH and $TAG to origin"
git -C "$REPO_ROOT" push origin "$BRANCH"
git -C "$REPO_ROOT" push origin "refs/tags/$TAG"

step "Creating the GitHub release"
gh release create "$TAG" \
	"$DMG" "$ZIP" "$BLOCKMAP" "$LATEST_MAC" \
	"$TARBALL" "$SIG_FILE" "$LATEST_JSON" \
	--repo "$GH_REPO" \
	--target "$BRANCH" \
	--title "echo $TAG" \
	--notes "$RELEASE_NOTES

---

Download the DMG below. Existing installs update themselves." \
	--latest

# The release is already public here, so a failed bump warns with the fix instead of dying: brew
# installs keep getting the previous version (which then updates itself) until the cask is bumped.
step "Bumping the Homebrew cask in $TAP_REPO"
DMG_SHA256="$(shasum -a 256 "$DMG" | cut -d' ' -f1)"
if CASK_JSON="$(gh api "repos/$TAP_REPO/contents/$TAP_CASK")" \
	&& CASK="$(jq -r .content <<<"$CASK_JSON" | base64 -d \
		| sed -E "s/^  version \"[^\"]*\"/  version \"$VERSION\"/; s/^  sha256 \"[^\"]*\"/  sha256 \"$DMG_SHA256\"/")" \
	&& grep -F "version \"$VERSION\"" <<<"$CASK" >/dev/null \
	&& grep -F "sha256 \"$DMG_SHA256\"" <<<"$CASK" >/dev/null \
	&& jq -n --arg message "echo $VERSION" --arg content "$(base64 <<<"$CASK")" \
		--arg sha "$(jq -r .sha <<<"$CASK_JSON")" '{message: $message, content: $content, sha: $sha}' \
	| gh api -X PUT "repos/$TAP_REPO/contents/$TAP_CASK" --input - >/dev/null; then
	echo "  cask: echo $VERSION, sha256 $DMG_SHA256"
else
	echo "warning: cask bump failed; set version \"$VERSION\" and sha256 \"$DMG_SHA256\" in $TAP_REPO/$TAP_CASK by hand" >&2
fi

cat <<EOF

==> Released echo $VERSION

  version: $VERSION (was $CUR_VERSION)
  dmg:     $DMG
  release: $GH_REPO_URL/releases/tag/$TAG

Both feeds are served from $GH_REPO_URL/releases/latest/download/ (latest-mac.yml for Electron
echo, latest.json for Tauri echo and echo-gomuks) — confirm they resolve before assuming
installed copies can see this release.
EOF
