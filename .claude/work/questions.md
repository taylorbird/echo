# Open Questions

<!-- Things uncertain, need revisiting, or blocked on -->

## New this session (2026-09-17)

- Should the room-kind glyph keep the `room_list_color` accent now that room names are white and the glyph is the only coloured element in the list? The user flagged that purple as "sticking out" on 2026-09-04; now that it is the sole accent, the question resurfaces.
- Should the notification/marked-unread middle tier collapse into the plain blue dot, or keep its count? Currently keeps the count (Claude's judgment call, unconfirmed).
- Halloy uses a monospace (Iosevka Term) for its entire UI. A monospaced room list was raised as a genuinely different direction and not mocked up. Revisit?

## New this session (2026-09-13)

- Should collapsed thread messages get their thread-accent spine back? (Lost as knock-on when reply-quote spine became static neutral; both share the border property. Not yet asked by user; marking as open question.)
- Quote text inside reply blocks renders warm peach (`--semisecondary-text-color: #ffb59a` on dark) on cool chat pane because room-view scope doesn't override it — pre-existing, surfaced by mock-ups; one-token fix if wanted.
- pnpm migration decision: user's global CLAUDE.md mandates pnpm for JS/TS, this repo uses npm (package-lock, scripts/release.sh). Now has concrete cost (2026-09-13 incident): implementer ran `pnpm exec tsc` in web/, triggered full install, generated pnpm-lock.yaml, broke later commands, eslint errors appeared. Global rule actively conflicts with this repo; migrate or exempt?

## New this session (2026-09-04)

- Purple kind glyph beside ink room names "sticks out" (user, 2026-09-04); options: glyph inherits ink at .65, or keep accent. Deferred by user ("we might come back").
- User's "home view" request (2026-09-03: "when I hit the home view I'd like the same view I have on spaces… rooms and DMs, maybe an unread section on each") could not be parsed; asked what differs today between Home and a space view; unanswered.
- Should failed timeline images retry on click or when back online? `useMediaContent.tsx` sets `errored` flag and never retries until remount.
- Member list (right panel) and mention pills still use per-user `getUserColor`, so they disagree with room-aware timeline colours; thread room through?
- Uniform-off path still applies 38% accent mix to resting names (dim look) while uniform-on rows are undimmed; harmonise?
- Light mode: preview line now #b9b3ae only in dark; in light it is inherited text colour at .9 (more prominent than before). Uniform overrides are dark-only.
- Hover-menu React button still sends duplicate reaction (400 → alert) when picking key you already reacted with; route through toggle?
- Timeline timestamps fail AA (2.8:1) because of .5 opacity on --secondary-text-color; fix when touching that area.
- Palette: no true blue (53° sky→grape), green (77° lime→mint), magenta (71°); larger palette would ease >10-sender rooms; count change touches six coupling points.

## Earlier questions

- Should release builds enable tauri_plugin_log and/or devtools for release-only bug diagnosis? (Currently logging and devtools only initialise under cfg!(debug_assertions). Three bugs today were diagnosed blind and required user testing.)
- Should the app ever ship an Intel/universal build, or stay Apple Silicon only? Related: Linux/Windows port assessed 2026-09-01 (see constraints.md); moderate plumbing, no decision taken.
- Should the backend password be stored in the Keychain so browser access to the gomuks web UI is possible, or is discarding it correct? (Currently a random password is generated and discarded immediately — the app authenticates via a session token minted in the webview init script, not HTTP Basic Auth.)
- Should the webview preview tier ever auto-run for recent messages, or stay click-only? (Currently click-only for security — prevents auto-execution of arbitrary posted URLs' JS.)
- Should we create a proper theming system for user-configurable colors?
- Should same-origin media/download links (target="_blank") be made to work inside Tauri? Currently they do nothing; sending them to the system browser would fail auth.
- Should the Rooms/DMs grouping keep Rooms above Direct messages, and is per-group recency ordering (vs the old single global recency list) the desired behaviour?
- Should there be a room-less settings variant so Cmd+, works with no active room?
- Design-language document: where does it live (repo docs/ vs .claude/), and does it also govern the desktop going forward (i.e. becomes the source of truth the CSS tokens derive from)? Raised 2026-09-01.
- Should per-room custom_css come back? Currently removed from preferences (one-line revert if needed).
- Is code_block_line_wrap safe as global-only? (user hasn't objected, most debatable of the 15 scope moves)
- custom_notification_sound has no editor UI anywhere — should we build one? (pre-existing gap, not new)

- SSO consent screen shows the raw redirect URL as the app identity ("Continue to http://localhost:6173/_gomuks/sso?") instead of "echo" with an icon. Verified: mssj.me's well-known advertises `org.matrix.msc2965.authentication` (issuer https://login.synapse.mssj.me/), and its login flows are `m.login.sso` (with `oauth_aware_preferred` and `org.matrix.msc3824.delegated_oidc_compatibility`) plus `m.login.token` — no `m.login.password`. LoginScreen.tsx:57 uses the legacy `/_matrix/client/v3/login/sso/redirect?redirectUrl=` path. Inferred: because that legacy path carries no OIDC client metadata, the Matrix Authentication Service has no `client_name`/`logo_uri` to display and falls back to the redirect URL. Fixing it likely means native OIDC login (MSC2965/2966) with dynamic client registration rather than the legacy redirect — an upstream-sized change, not a local tweak. Cosmetic only; login works. Affects production too (would read localhost:29325 there). Raised 2026-08-28.

- Add real theming support so Ferra and Tempered are both selectable, rather than one being hardcoded. Decided 2026-08-28: the palette was pushed toward Tempered (warm channel `254, 205, 178` → `240, 226, 216`, room-list ground cooled), but the user likes BOTH and wants to come back and make it a choice. Groundwork is already in place — every warm tint in the dark theme now derives from the single `--warm-tint-rgb` token in `web/src/index.css`, so a theme is close to "swap that triplet plus two ground colours". Open sub-questions: does this become a user-facing preference (and where does it persist — the gomuks prefs system, or localStorage like the per-user colour overrides?), does it extend to light mode, and does it subsume the older "proper theming system for user-configurable colors" question below.

- Add a Help menu with "About echo" and "Release notes" entries. Requested 2026-08-30 for a future patch. Groundwork: the release-notes modal already exists and already handles the not-updating case (`modals.releaseNotes(version, notes, canRestart: false)` — ReleaseNotes.tsx), and the version is already resolvable via `useAppVersion()`. What is missing:
  - **No native menu at all.** `web/src-tauri/src/lib.rs` builds none and Cargo.toml has no `menu` feature, so macOS is showing Tauri's default. Needs a real `tauri::menu` Menu built in lib.rs, then an event emitted to the webview on click (an emit avoids the ACL dance a new `#[tauri::command]` would need in both build.rs and capabilities/default.json).
  - **No source for the running version's notes.** The app only ever holds notes for a *pending* update (from the feed) or the one-shot stash, which `claimReleaseNotes` deletes as it reads. Showing them on demand needs one of: bundling `release-notes/<version>.md` into the app at build time (offline, exact, and the archive already exists as of 0.4.0); fetching the GitHub release body on click (network-dependent); or keeping the claimed stash instead of clearing it (simplest, but only ever has the last updated-into version, so a fresh DMG install would have nothing).
  - Bundling the archived notes is the recommended option — it is the only one that is correct for a fresh install and needs no network.

## Blockers / Limitations
- Claude cannot see the app visually in this environment: `screencapture` fails ("could not create image from display" — terminal lacks macOS Screen Recording permission), the chrome-devtools MCP cannot attach (no Chrome running with a debug port), and `osascript`/System Events reports 0 windows for the transparent Tauri window (an Accessibility quirk, not a render failure). Granting the terminal Screen Recording permission would unblock visual self-review. Release-only bugs are particularly hard to diagnose because production builds have NO LOGGING (tauri_plugin_log only initialises under cfg!(debug_assertions)) and no devtools. Three bugs today (restart button, external links, fetch_og_tags) were diagnosed only by user testing, and the root cause (tauri ACL remote-origin denial) was invisible without source-code archaeology. **Recommendation:** enable logging in release builds and consider devtools for faster diagnosis in the future.

### Read receipts not sending (known issue, listed in release notes since 0.4.1)
Room stays unread after reading; clearing from another client works (user confirmed via Element). Gate: TimelineView.tsx ~75-97 requires `scrolledToBottom && focused && newest event`. Prime suspect: util/focus.ts seeds `focused` from `document.hasFocus()` at module load, only updates on window focus/blur events — WKWebView may never fire those on native window activation, leaving `focused: false` forever even when the window is active. **Diagnostic plan:** re-add [read-gate] console.debug logging the gate fields to stderr/log; expect `focused: false` + `documentHasFocus: true` when the window is visibly active. Needs real WKWebView (dev app + native devtools) or Playwright harness pattern applied to real WKWebView.

### DB cleanup offer: 37 stale membership unread_type rows
Root cause fixed in 0.4.2 (membership events no longer drive unread counts), but the 37 existing membership events that were flagged with unread_type=2 remain in the database. User can manually zero them when desired (requires app quit, one-off cleanup query, restart). Cleanup offer documented but not yet offered — awaits explicit user go-ahead.

## Resolved
- Which room-list sort option (A–F, or combination)? — RESOLVED (2026-09-17): option E (per-section sort + mode tag) was implemented, then DELETED the same day. The user rejected cycle-on-click as undiscoverable, and the follow-up "Grouped/Recent switch + filter chips" design (the One Chip Row artifact) was never built either. What actually shipped: Recent is a fourth sub-filter in the space rail — it narrows nothing, drops all sections, shows everything newest-first, and has no Unread section. There is no sort control anywhere in the room list, and no filter chips.
- Should the Rooms/DMs grouping keep Rooms above Direct messages, and is per-group recency ordering (vs the old single global recency list) the desired behaviour? — RESOLVED (2026-09-17): superseded by the Grouped/Recent view switch decision. When in Grouped view, rooms and DMs are separate collapsible sections (order TBD by user preference); when in Recent view, all rooms are one flat list sorted by recency, category-agnostic.
- When to start matrix-rust-sdk integration for mobile support? — RESOLVED (2026-09-01): mobile will be an owned fork of Element X iOS, which brings matrix-rust-sdk with it; no rust-sdk integration into the Tauri app is planned.
- Unread contrast / design (shipped 0.4.0-0.4.1, 2026-08-30): all tiers now red (mention-tier pulses on preference). Earlier gradient (unread=amber, mention=red) rejected in favor of red-only consistency.
- Membership events driving unread counts (shipped 0.4.2, 2026-08-31): fixed in pkg/hicli/pushrules.go by gating evaluatePushRules Notify/Highlight/Sound on m.room.member unless isInviteForMe. User's old-Synapse default had membership events with notify action, lighting 37 events. Events still render in timeline.
- Production build workflow: signing, notarization, distribution? — Substantially answered for App Store purposes: the user explicitly waived App Store distribution ("basically a private app for me"), and `macOSPrivateApi: true` is now in use, which would block App Store acceptance anyway. The signing/notarization mechanics themselves (outside the App Store) remain unaddressed and could be reopened as a separate question if needed.
- Do external links now actually open in the system browser? — RESOLVED (2026-08-27): root cause was tauri-plugin-shell's unconditional injected body listener stealing the click in the bubble phase. Fixed by installing a capture-phase listener with stopPropagation so the shell listener never sees the event. Earlier "resolution" (2026-08-25) incorrectly blamed ACL remote-origin denial as the root cause — that was ALSO broken, but external links failed for a different reason. Both issues have been fixed.
- Do external links + clipboard actually work after Tauri 2.11 alignment and WKWebView fallback? — RESOLVED (2026-08-27): root cause found and fixed (shell plugin competing listener); verified working in all 8 releases (0.2.0–0.3.7) including user testing.
- fetch_og_tags (URL-preview webview tier) dead in prod? — RESOLVED (2026-08-27): root cause was tauri ACL remote-origin denial (the production window loads http://localhost:29325, which tauri treats as remote, and remote origins have all app commands denied unless a capability names them). Fixed by declaring the command in build.rs (generating allow-fetch-og-tags) and granting it in capabilities/default.json under remote.urls. Verified working in releases.
- Should the remote capability be split from the default capability so it loses shell:spawn/kill permissions? — RESOLVED (2026-08-27): the shell permissions were removed entirely (nothing used them, sidecar is spawned from Rust not IPC). Remote capability surface is now minimal (opener, updater, window management). Note: shell plugin is mandatory for sidecar spawning, but shell IPC permissions are not.
- Is drag-drop image upload working correctly? — RESOLVED: root cause was `dragDropEnabled` defaulting to `true` in `tauri.conf.json`, which let Tauri's native handler consume the drop before the webview saw it. Fixed by setting `"dragDropEnabled": false`. User confirmed drag-and-drop from CleanShot X now works.
- What exactly does "contrast on the reading screen" mean? — RESOLVED: it became a full palette and text-hierarchy overhaul across the whole session (room list vs. chat pane tinting, palette reversals, chat text hierarchy rework). The chat pane ended up cool near-black (`#16181f`), now the darkest surface in the app rather than the lightest.
- Should the right panel adopt the cool dark palette to fix sender-colour contrast for member names? — RESOLVED: new `getUserColor` returns high-luminance pastels (capped at L 80%), improving readability on warm background. Right-panel names now have solid contrast; no cool-palette flip needed.
- Should `--room-header-background` get its own cool value rather than borrowing the room-list token? — RESOLVED: it's intentionally shared. Header sits above the chat pane (cool near-black) but the token retrieves the room-list warm background, and it reads correctly. No change needed.
- Does the room-list-wrapper's outer raise shadow escape `contain: strict`? — RESOLVED (indirectly): removed `content-visibility: auto` / `contain: strict` entirely from room-list entries due to WebKit paint-deferral issues. Question moot.
- Should the pre-existing 11 eslint errors in untouched files (`WebAuthLogin.tsx`, `MessageComposer.tsx`, `useSecondaryItems.tsx`, `TimelineEvent.tsx`) be cleaned up? — RESOLVED: all pre-existing errors remain; the project is now at zero tsc/eslint on all touched code (a new baseline 2026-08-21). Pre-existing errors in untouched files are not attributable to this work and can be addressed separately.
- Startup auth retry on ECONNREFUSED (shell rebuild race)? — RESOLVED (2026-08-25 as side effect): TCP readiness wait in lib.rs (500ms connect timeout, 100ms interval, 15s deadline) prevents the old race where the webview's first auth request beat the sidecar to port 29325. Deterministic start order now guaranteed.

## Cotypist (text prediction) does not work in echo — revisit

Raised 2026-09-17. Cotypist's word prediction never engages in the echo window.

**Verified this session:**
- Cotypist is installed and running, and holds Accessibility permission
  (`app.cotypist.Cotypist|2` in `/Library/Application Support/com.apple.TCC/TCC.db`,
  service `kTCCServiceAccessibility`). The grant is not the problem.
- echo's process exposes only an `AXMenuBar` and **0 windows** to the Accessibility
  API (`osascript -e 'tell application "System Events" to tell process "app" to
  get count of windows'`).
- `yaak-app-client`, an unrelated Tauri app, returns the **identical** signature —
  0 windows, `AXMenuBar` only.
- Ghostty (native, AX-permitted) returns 1 window, so the query method is sound
  and the terminal is permitted. Note Finder returns 0 too, but only because it
  had no windows open — that reading briefly looked like a method failure.
- The composer is a real `<textarea id="message-composer">`
  (MessageComposer.tsx:1070), not a contenteditable, so the control type is the
  best case for assistive tools and is not the blocker.

**Inferred:** Cotypist has no text field to attach to because the window and its
contents are absent from the AX tree. Because yaak behaves identically, this is a
Tauri/WRY-wide behaviour, NOT a consequence of echo's `transparent: true` or
`macOSPrivateApi: true`.

**Unknown:** the mechanism in WRY that leaves the NSWindow out of the AX tree, and
whether host-app code can change it. Public reports cover WKWebView AX problems
generally (tauri-apps/wry#1848; Apple developer forums thread 809541) but none
give a host-app fix.

**Next step:** open Accessibility Inspector (ships with Xcode), point it at the
echo window with the composer focused, and see whether the textarea appears. If it
does, the problem is Cotypist-specific and worth raising with them. If the window
is empty there too, it is upstream in WRY and not fixable in our code.
