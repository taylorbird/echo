#!/usr/bin/env bash
#
# Cuts a signed, notarized echo release and publishes it to GitHub with an updater feed.
# Ported from echo-gomuks's scripts/release.sh; the comments that explain its checks are kept.
#
# Usage: echo/release.sh <version|patch|minor>
#
# Installed copies check $GH_REPO_URL/releases/latest/download/latest.json, including
# echo-gomuks 0.7.4 installs (same bundle ID and updater key), so publishing here updates them.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ECHO_CONF="$REPO_ROOT/echo/tauri.echo.conf.json"
RELEASE_CONF="$REPO_ROOT/echo/tauri.echo.release.conf.json"
BUNDLE_DIR="$REPO_ROOT/target/release/bundle"

SIGNING_KEY="$HOME/.tauri/echo.key"
APPLE_ACCOUNT="taylor.bird@gmail.com"
APPLE_TEAM="UFCDGSKCXB"
GH_REPO="taylorbird/echo"
GH_ACCOUNT_REQUIRED="taylorbird"
GH_REPO_URL="https://github.com/$GH_REPO"

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

[[ $# -eq 1 ]] || die "usage: echo/release.sh <version|patch|minor>"
BUMP="$1"

for tool in jq gh pnpm mise security xcrun spctl perl; do
	command -v "$tool" >/dev/null 2>&1 || die "required tool not found on PATH: $tool"
done

# echo's version lives in the release config only: it overrides Sable's own version for the
# bundle and the updater, and Sable's files stay untouched so upstream merges stay clean.
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
RELEASE_NOTES="$(sed -e '/<!--/,/-->/d' -e 's/[[:space:]]*$//' "$RELEASE_NOTES_FILE" \
	| awk 'NF {found = 1} found')"
[[ -n "$(printf '%s' "$RELEASE_NOTES" | tr -d '[:space:]')" ]] \
	|| die "$RELEASE_NOTES_FILE is empty — write what changed before releasing"

[[ -f "$SIGNING_KEY" ]] || die "updater signing key not found: $SIGNING_KEY"

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

# Resolve the keychain secrets up front: they can prompt, and finding out after a long build that
# notarization has no password is a bad trade.
UPDATER_KEY_PASSWORD="$(security find-generic-password -s echo-updater-key -w)" \
	|| die "keychain item 'echo-updater-key' not found"
NOTARY_PASSWORD="$(security find-generic-password -s echo-notary -w)" \
	|| die "keychain item 'echo-notary' not found"

# Updater signing is the very last thing `tauri build` does — after the compile, after Apple has
# notarized. Prove the key and password work now, on a throwaway file.
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

Releasing echo $CUR_VERSION -> $VERSION
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
# 2. Bundle, sign, notarize
# --------------------------------------------------------------------------------------------

APP="$BUNDLE_DIR/macos/echo.app"
TARBALL="$BUNDLE_DIR/macos/echo.app.tar.gz"
SIG_FILE="$TARBALL.sig"

# Clear the artifacts we're about to verify, so a build that fails partway can't leave the
# previous release's tarball in place for every check below to pass on.
case "$APP" in
"$REPO_ROOT/target/release/bundle/"*) ;;
*) die "refusing to delete outside the bundle dir: $APP" ;;
esac
rm -rf "$APP" "$TARBALL" "$SIG_FILE"
rm -f "$BUNDLE_DIR"/dmg/echo_"$VERSION"_*.dmg

step "Bundling, signing and notarizing (this waits on Apple; expect several minutes)"
(
	cd "$REPO_ROOT"
	# Not ..._KEY_PATH: that name is read by nothing. The var takes the key itself.
	export TAURI_SIGNING_PRIVATE_KEY="$(cat "$SIGNING_KEY")"
	export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$UPDATER_KEY_PASSWORD"
	export APPLE_ID="$APPLE_ACCOUNT"
	export APPLE_PASSWORD="$NOTARY_PASSWORD"
	export APPLE_TEAM_ID="$APPLE_TEAM"
	mise run tauri build --config "$ECHO_CONF" --config "$RELEASE_CONF"
)

# --------------------------------------------------------------------------------------------
# 3. Locate + verify artifacts
# --------------------------------------------------------------------------------------------

step "Locating artifacts"
[[ -d "$APP" ]] || die "missing app bundle: $APP"
[[ -f "$TARBALL" ]] || die "missing updater tarball: $TARBALL (is bundle.createUpdaterArtifacts set?)"
[[ -f "$SIG_FILE" ]] || die "missing updater signature: $SIG_FILE"

shopt -s nullglob
DMG_MATCHES=("$BUNDLE_DIR"/dmg/echo_"$VERSION"_*.dmg)
shopt -u nullglob
[[ ${#DMG_MATCHES[@]} -eq 1 ]] \
	|| die "expected exactly one DMG matching echo_${VERSION}_*.dmg, found ${#DMG_MATCHES[@]}"
DMG="${DMG_MATCHES[0]}"

BUILT_ID="$(defaults read "$APP/Contents/Info.plist" CFBundleIdentifier)"
[[ "$BUILT_ID" == "dev.tbird.echo" ]] || die "built bundle ID is $BUILT_ID, expected dev.tbird.echo"
BUILT_VERSION="$(defaults read "$APP/Contents/Info.plist" CFBundleShortVersionString)"
[[ "$BUILT_VERSION" == "$VERSION" ]] || die "built version is $BUILT_VERSION, expected $VERSION"

echo "  app:     $APP"
echo "  tarball: $TARBALL"
echo "  sig:     $SIG_FILE"
echo "  dmg:     $DMG"

step "Verifying notarization"
xcrun stapler validate "$APP" || die "notarization ticket is not stapled to $APP"

# The bundler notarizes and staples the .app, then builds the DMG around it, so the DMG has never
# been submitted in its own right and needs its own round trip.
if ! spctl -a -t open --context context:primary-signature "$DMG"; then
	step "Notarizing the DMG (a second wait on Apple)"
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
# 4. Updater feed
# --------------------------------------------------------------------------------------------

step "Generating latest.json"
LATEST_JSON="$BUNDLE_DIR/latest.json"
TARBALL_NAME="$(basename "$TARBALL")"
# gh rewrites spaces in asset names to dots, so the feed URL points at the name GitHub serves.
ASSET_NAME="${TARBALL_NAME// /.}"
ASSET_NAME_ENCODED="$(jq -rn --arg n "$ASSET_NAME" '$n|@uri')"

# The artifact URL is the *tagged* one, so an old feed never points at a new binary.
jq -n \
	--arg version "$VERSION" \
	--arg pub_date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
	--arg notes "$RELEASE_NOTES" \
	--rawfile signature "$SIG_FILE" \
	--arg url "$GH_REPO_URL/releases/download/$TAG/$ASSET_NAME_ENCODED" \
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
	"$DMG" "$TARBALL" "$SIG_FILE" "$LATEST_JSON" \
	--repo "$GH_REPO" \
	--target "$BRANCH" \
	--title "echo $TAG" \
	--notes "$RELEASE_NOTES

---

Download the DMG below. Existing installs update themselves." \
	--latest

cat <<EOF

==> Released echo $VERSION

  version: $VERSION (was $CUR_VERSION)
  dmg:     $DMG
  release: $GH_REPO_URL/releases/tag/$TAG

The updater feed is served from $GH_REPO_URL/releases/latest/download/latest.json — confirm it
resolves before assuming installed copies can see this release.
EOF
