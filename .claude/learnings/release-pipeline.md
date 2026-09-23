# Release Pipeline

## Key Facts
- Release script: `scripts/release.sh <version|patch|minor>` — bumps 4 version files (tauri.conf.json, package.json, Cargo.toml, **Cargo.lock**), builds dist/sidecar/app/DMG, signs and notarizes via Apple servers, generates updater `latest.json`, commits version-only, tags, pushes to GitHub, creates release with artifacts.
- Four latent bugs catch only on release (each costs a full 30-60min build cycle) — see [dev-environment-gotchas.md](./dev-environment-gotchas.md) for details: wrong signing env var name, Cargo.lock not bumped, DMG not notarized, gh account drift.
- Version files (2026-09-01): tauri.conf.json, package.json, Cargo.toml, Cargo.lock must be bumped together and committed together, or manifest/lock disagree and rebuilds/updates fail.

## RELEASE_NOTES.md Statelessness

**Critical gotcha:** `RELEASE_NOTES.md` at the repo root is read by `scripts/release.sh` preflight, embedded verbatim in `latest.json` as the `notes` field, and rendered in-app by the typed release-notes parser. Unlike version files that reset per release, release notes are **completely stateless** — the file is shipped exactly as-written at preflight time.

**Discipline:** rewrite `RELEASE_NOTES.md` **BEFORE** every `release.sh` run. If the script re-runs with the same file, old notes ship again (happened twice: 0.4.2 notes shipped with 0.4.3, and 0.4.3 notes nearly shipped with the wrong version).

**Archive:** old notes are committed to `release-notes/<version>.md` at the same time as the version bump (release.sh does this). Future releases should compare `RELEASE_NOTES.md` against `release-notes/<prev-version>.md` in a preflight guard to catch the "same notes" trap.

**Format:** simple Markdown, parsed by web/src/util/releasenotes.ts (typed strict parser):
- Headings (`## heading`)
- Unordered lists (`- item`)
- Bold (`**bold**`)
- Inline code (`` `code` ``)
- Links (`[text](https://url)` — http(s) only, no markdown links without protocol)
- **Never:** HTML, raw `<a>` tags, or protocol-relative links (`//example.com`)

## Stale /Volumes/echo Mount

**Gotcha:** if a volume named "echo" is already mounted (leftover from a previous DMG install), `bundle_dmg.sh` fails when trying to create a volume with the same name — the hdiutil create command sees "Device busy" or "volume with that name already exists."

**When it happens:** DMG bundling is the last step of `npx tauri build`. If this step fails, you have a complete `.app` but no DMG, and you cannot retry `tauri build` until the mount is ejected.

**Fix:** eject and retry:
```bash
hdiutil detach /Volumes/echo
scripts/release.sh <version|patch|minor>
```

Version-restore trap handles rollback on any subsequent failure.

## DMG Notarization

**Gotcha:** Tauri's build pipeline notarizes and staples the `.app` bundle, then wraps it in a DMG. The DMG file itself is not notarized, so users downloading it see "can't be opened because it hasn't been notarized" when trying to extract or mount it.

**Root cause:** Tauri notarizes the `.app`, but `bundle_dmg.sh` then creates the DMG from the already-stapled `.app`. The DMG is a new file with a new hash, so it needs its own notary round-trip.

**Fix (already in scripts/release.sh):** after the DMG is built, run:
```bash
notarytool submit <dmg-path> --keychain-profile "<profile>"
stapler staple <dmg-path>
```

Verify both commands succeed (check stapler output for "Staple successful!") before uploading the DMG to GitHub.

## Release Identity: GH_TOKEN Pinning

**Gotcha:** `gh` CLI uses the currently-active authenticated account. If you're logged in to multiple GitHub accounts (e.g., taylorbird personal + org), the active account can drift after a browser session becomes active mid-build. When `git push` and `gh release create` run, they use the active account at that moment. If it's not the one with write access to the repo, you get 403 errors (misreported as 404 by GitHub).

**Fix:** resolve the token upfront and export it:
```bash
export GH_TOKEN="$(gh auth token --user taylorbird)"
scripts/release.sh <version|patch|minor>
```

This pins both `git push` (via credential helper `gh auth git-credential`) and `gh release create` to the correct token, independent of the active CLI account.

**In release.sh:** the script already exports `GH_TOKEN` upfront (before any build), so manual pushes are the primary concern.

## Notes Parser: http(s)-only Links

The release-notes parser in `web/src/util/releasenotes.ts` is deliberately strict to prevent XSS:
- Headings, lists, bold, inline code → rendered as React nodes
- Links: only `[text](https://url)` or `[text](http://url)` — protocol required, http(s) only
- **Forbidden:** raw HTML, `<a>` tags, protocol-relative `//example.com`, `javascript:` URLs

The parser reads each line and applies regexes for the allowed patterns. Anything that doesn't match a pattern is rendered as plain text. This is safer than `dangerouslySetInnerHTML` or markdown libraries that might interpret HTML.

## Launching release.sh from Claude Code: detach it

Claude Code's Bash tool caps a background command at 10 minutes (600000 ms), and a
signed, notarized release runs 25–35 minutes (two waits on Apple). Launching
`scripts/release.sh` as a harness background task risks it being killed mid-notarization.
Verified 2026-09-04: a first attempt was stopped at the frontend build stage by hand;
the abort trap restored all four version files to the prior version and left the tree
clean, so an early stop is safe. Run it detached instead and watch the log:

```bash
nohup scripts/release.sh minor > <scratch>/release-<version>.log 2>&1 &
# then Monitor the log for '^==>' step lines and error/Accepted/Invalid markers
```

The `tauri dev` process must be stopped first: release.sh rewrites tauri.conf.json and
Cargo.toml for the bump, and the dev watcher restarts on both (restart storm, dead
sidecar). Kill by port (`lsof -ti :6173`, `lsof -ti :29325`) plus `pkill -f target/debug/app`.

## 0.5.0 Released 2026-09-04

**Version:** 0.5.0 (minor bump) shipped 2026-09-04 with reaction toggle, room-aware sender colours, Unread section, and room-list colour system fixes. GitHub release with embedded notes; updater feed verified serving 0.5.0 and latest.json.

## 0.5.1 Released 2026-09-13

**Version:** 0.5.1 (patch) shipped 2026-09-13: timeline sender rail, avatar ring and name plate
removed; sender names 1.0625rem at full colour; avatar gutter back to 1rem; reply-quote spine a
neutral grey (`color-mix` of `--secondary-text-color`), no longer the quoted sender's colour.
Ritual as documented: notes rewritten first, dev stopped, `npm ci` to undo an accidental pnpm
install, feature commit d8fc2245 then release.sh detached; both notarizations Accepted; feed
verified serving 0.5.1 with the new notes. Wall time about 30 minutes.

## 2026-09-21 (beforeBuildCommand vs sidecar embed; spctl expected line; account pinning)

### Tauri beforeBuildCommand vs go:embed sidecar (2026-09-21)
**Gotcha clarified:** `tauri.conf.json` has `beforeBuildCommand: "npm run build"` which re-runs the frontend build during `npx tauri build`. However, the shipped UI in production comes from the Go sidecar's `//go:embed dist` directive, which was compiled much earlier in release.sh (during `go build ./cmd/gomuks`). **Consequence:** editing `web/src` after the Go build runs and before `tauri build` completes makes the bundled app and sidecar disagree — the `web/dist` folder has new assets, but the Go binary carries old ones. **Prevention:** don't touch `web/src` while release.sh is running. The `beforeBuildCommand` rebuilds dist, but the sidecar was already built with an older embedded copy.

### DMG notarization: spctl "rejected" is expected sequencing
**Fact:** `spctl` is the command-line tool for Apple's Gatekeeper security policy. When `npx tauri build` creates the DMG and release.sh runs `spctl assess -v ...` on it, the output includes lines like "rejected" — this appears to be part of the assessment process, not a failure indicator. The actual failure would be a non-zero exit code or a line like "invalid". The notarization round-trip that follows is the authoritative gate: a successfully notarized DMG will staple cleanly; a rejected one fails at the staple step with "Record not found." So seeing "rejected" in spctl output does not mean the build is bad; wait for notarization and stapling to complete.

### Manual push: GH_TOKEN pinning to taylorbird (2026-09-21 reiterated)
**Pattern:** After release.sh completes, a bare `git push` may fail 403 if another GitHub account has become active in the meantime (e.g., a browser session to an org account). The credential helper `gh auth git-credential` uses the currently-active `gh auth` account. **Prevention:** explicitly set the token upfront before any push:
```bash
GH_TOKEN="$(gh auth token --user taylorbird)" && git push
```
This pins both `git push` (via the credential helper) and any subsequent `gh` CLI commands to the taylorbird account, independent of what `gh auth` reports as active.

## Wrapped bullets broke the notes parser (fixed 2026-09-23)

`parseReleaseNotes` in `web/src/util/releasenotes.ts` used to close the list on any line not starting with `- `. Every hard-wrapped bullet from 0.4.0 to 0.6.1 therefore rendered in the "What's new" panel as a one-line bullet followed by the rest of the sentence as a separate paragraph. Now a plain line straight after a bullet continues that bullet (covered by a test). Installed builds up to 0.6.1 still have the old parser, which is why notes are written with one line per bullet. Editing past notes without cutting a release is covered in constraints.md (2026-09-23).
