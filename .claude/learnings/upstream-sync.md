# Upstream Sync Procedure

## Overview

This file documents how to merge upstream gomuks releases into echo (a downstream fork). The procedure keeps history readable, ensures incremental future syncs, and applies a clear conflict resolution rule.

## Key Facts

- Upstream repository: `https://github.com/tulir/gomuks` (main branch, releases tagged `v0.2603.0`, `v0.2609.0`, etc.)
- Sync method: merge by tag with `--no-ff`, one commit per release (not cherry-picks)
- Conflict rule: keep echo's visual design, take upstream's behaviour changes
- Verified after merge: go build -tags goolm,sqlite_fts5, tsc, npm run lint, vitest, production build
- Next sync baseline: always start from the last-merged tag

## Before You Start

1. **Fetch latest upstream:** `git fetch upstream` (assuming `upstream` remote is configured as `https://github.com/tulir/gomuks`)
2. **Check current head:** `git log --oneline -1` — echo main should be at a known commit or tag
3. **Identify merge range:** List upstream's new tags since the last sync:
   ```bash
   git tag -l --sort=-version:refname | grep "v0\." | head -10
   ```
   Find the last tag echo merged (e.g., v0.2609.0), then identify new tags forward from there.

## Merge by Tag (no cherry-picks)

For each upstream tag in chronological order (oldest first), merge with `--no-ff`:

```bash
git merge --no-ff upstream/v0.2609.0 -m "Merge upstream v0.2609.0"
git merge --no-ff upstream/v0.2610.0 -m "Merge upstream v0.2610.0"
# ... and so on
```

**Why `--no-ff`:** The merge commits preserve the release boundaries in history, making it easy to see when each version was integrated and what changed in each. Cherry-picks flatten the history and lose the tag identity.

## Conflict Resolution Rule

When merge conflicts appear:

**Visual design changes (echo keeps its version):**
- Theme colors, palette tokens
- Room name styling (size, weight, color)
- Padding, margins, spacing
- Inter vs other font choices
- CSS animations or effects

**Behaviour changes (take upstream's version):**
- Protocol changes, library upgrades
- Matrix API changes, new endpoints
- Go backend changes, database schema
- Library dependency versions (in upstream's code)
- Bug fixes in Matrix protocol handling

**Example:** if upstream changed `--room-name-color: #999` to `#aaa`, echo keeps its own value (which may be white `#ffffff` by echo's design). If upstream added a new matrix-rust-sdk-based feature, take it.

## Locking npm Packages to Cargo.lock

After each merge, if `Cargo.lock` changed:

1. Run `npm install` to resolve dependencies according to package.json ranges
2. In web/package-lock.json, RESTORE the four pinned versions:
   - `@tauri-apps/plugin-updater@2.10.1`
   - `@tauri-apps/plugin-opener@2.5.4`
   - `@tauri-apps/cli@2.11.4`
   - `react-colorful@5.6.1`
3. Commit the updated package-lock.json with a note: "restore echo's @tauri-apps pinned versions"

These versions must match Cargo.lock exactly to avoid version mismatches at runtime.

## Special Files to Watch

### .github/workflows/*

The `gh` token lacks `workflow` scope, so pushes that touch `.github/workflows/go.yml` or `.github/workflows/js.yml` are rejected. **Resolution:** resolve these files to echo's side (ours, not theirs) before pushing. Echo doesn't use GitHub Actions; the workflows are upstream's CI only.

### pkg/hicli/pushrules.go

Echo has a divergence: the `isInviteForMe` gate that excludes membership events from unread counts. On merge, KEEP echo's version.

### web/src/fonts/

As of 0.7.0, echo bundles Inter 4.1 variable fonts and removed the Google Fonts link. If upstream changed font handling, resolve to echo's bundled approach.

## Build Verification (Do This After Every Merge)

After resolving conflicts and before committing, verify the merge doesn't break anything:

```bash
# Frontend
npm run build

# Go backend (BOTH tags required)
go build -tags goolm,sqlite_fts5 -o web/src-tauri/binaries/gomuks-aarch64-apple-darwin ./cmd/gomuks
go vet -tags goolm,sqlite_fts5 ./...

# TypeScript
tsc

# Linting
npm run lint

# Tests (if any exist)
npm run test

# Production build
npm run build
```

If any verification fails, investigate the merge conflict resolution. A common cause is missing the behaviour changes in upstream (e.g., new struct fields in the Matrix protocol layer).

## Rebuild Dev Sidecar

After the full merge completes and is committed:

```bash
go build -tags goolm,sqlite_fts5 -o web/src-tauri/binaries/gomuks-aarch64-apple-darwin ./cmd/gomuks
```

This ensures `tauri dev` picks up the merged changes.

## Release and Push

Once verified, the merged commits can be released as a new version:

1. Rewrite `RELEASE_NOTES.md` (plain voice, one line per bullet, describe what changed for the user)
2. Run `scripts/release.sh` (handles version bumps, build, sign, notarize, push, GitHub release)
3. Verify the feed serves the new version via `latest.json`

**Important:** resolve .github/workflows/* to echo's side BEFORE releasing. The release.sh push will be rejected if those files are in conflict state.

## Next Sync Baseline

After a successful sync and release, **note the last merged tag** (e.g., v0.2609.0) for the next session. The next sync starts by fetching upstream and identifying tags that come after this one.

Example: if echo is at v0.2609.0 merge commit, and upstream now has v0.2610.0 through v0.2612.0 tagged, the next sync merges those three, in order, starting from v0.2610.0.

## When Upstream Has Unreleased Commits

If there are 19+ commits on upstream/main after the last tag, they are not merged during the sync (they will be picked up on the next sync when they're tagged). This keeps the sync based on release boundaries, making the history clearer and future syncs more predictable.

If critical fixes are urgently needed before a new upstream release, they can be cherry-picked individually (outside the normal sync procedure). Document them clearly in commit messages.

## Example: 0.7.0 Sync (2026-09-24)

- Echo was at 0.6.2 (commit d40de040)
- Upstream had releases v0.2603.0 through v0.2609.0
- Merged: `git merge --no-ff upstream/v0.2603.0`, then v0.2604.0 through v0.2609.0 (7 commits)
- Resolved conflicts: kept echo's visual, took upstream's behaviour
- Verified: go build -tags goolm,sqlite_fts5, tsc, npm run lint, vitest, production build — all clean
- Rebuilt sidecar: `go build -tags goolm,sqlite_fts5 -o web/src-tauri/binaries/gomuks-aarch64-apple-darwin ./cmd/gomuks`
- Resolved .github/workflows to echo's side
- Pushed main (head 91d2f022), released 0.7.0
- Feed served 0.7.0 with latest.json
- 19 unreleased commits on upstream/main (not merged; will pick them up next sync)
