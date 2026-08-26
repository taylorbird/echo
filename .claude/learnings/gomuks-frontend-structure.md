# gomuks Frontend Internals

## Key Facts
- `RoomListEntry.dm_user_id` is the canonical signal for "this room is a DM." It's the same field `DirectChatSpace.include()` uses in `web/src/api/statestore/space.ts:80`, so any UI grouping keyed on it will always agree with the app's built-in DM pseudo-space.
- `roomList` (in the room-list state) is stored oldest-first. `reverseMap` (`web/src/util/reversemap.ts`) is the existing helper used to render it newest-first.
- Filtered-out rooms are NOT unmounted from the DOM — they get a `hidden` class, which is `display: none !important` (defined in `web/src/index.css`). Counting/finding "visible" rooms therefore requires applying `client.store.roomListFilterFunc` yourself rather than checking DOM visibility.
- `MainScreen.tsx:197` locates room entries with a GLOBAL selector, `document.querySelector('div.room-entry[data-room-id=...]')`, not a scoped child selector — so restructuring the room list DOM (e.g. wrapping entries in section containers) is safe and won't break scroll-into-view behavior.
- Icons in `web/src/icons/` are Material Symbols, filled style: `viewBox="0 -960 960 960"`, `fill="#5f6368"`, which the project's svgr config (in `vite.config.ts`) rewrites to `currentColor`. A newer outlined Lucide-style set (24px grid, `viewBox="0 0 24 24"`, `stroke="currentColor"`, `fill="none"`) lives alongside it in `web/src/icons/modern/`, currently used only by the sidebar and space rail.
- `--window-top-margin` (defined in `index.css` as `env(safe-area-inset-top, 0px)`) is plumbed through the room list grid, the search wrapper, the room-view grid, and the room header — it's the single lever for adjusting top inset across the app.
- Modals are `z-index: 100` (`web/src/index.css`) — anything meant to sit above the app chrome but below modals should stay under that value.
- Reaction sender identities are NOT sent to the frontend at all — the Go backend aggregates `m.reaction` events down to bare `Record<string, number>` counts and discards the underlying senders (`FillReactionCounts` in `pkg/hicli/database/event.go:225` throws away `GetReactionsResult.Events`). To get sender names client-side without a backend/sidecar change, use the existing `get_related_events` RPC with relation type `m.annotation` — the same call `EventEditHistory.tsx` already makes for `m.replace` relations.
- The settings preference matrix is driven by declaration order in `web/src/preferences.ts` and rendered by `SettingsView.tsx` — adding a new preference there is enough for it to appear in the matrix; no separate registration step in the view component is needed.
- `--room-header-height` is a single token shared by the room header, the room-list search row, and the right-panel header, so changing it keeps all three panes' top edges aligned. It was previously hardcoded as `3.5rem` independently in three separate files, which is a real drift risk if only one file is edited.

## Timeline Sender Colors and Custom Overrides
- Sender names use `sender-color-N` CSS classes generated via `getUserColorIndex()` (deterministic hash of user ID modulo palette size). These apply a pre-defined color palette (saturated candy colors: reds, oranges, greens, purples, blues, etc.).
- Custom user colors (user-set via right-click color picker) and cheat overrides (e.g., `raam-green` cheat) **do not** apply as classes — they apply as inline styles via `style={{ color: getUserColorOverride(userID) }}` on the `span` containing the sender name.
- Why inline styles? The timeline renders `sender-color-N` classes on the name element. A custom CSS class with a custom color would have the same specificity as the existing color class, so a later one would win (source order). Inline styles have higher specificity and reliably override class-based colors.
- This pattern is used in `TimelineEvent.tsx` (sender name) and `ReplyBody.tsx` (replied-to sender name in the reply prefix).

## useSyncExternalStore Snapshot Stability
- Snapshot getter functions passed to `useSyncExternalStore` must return a **stable reference** for empty collections. If a getter returns a fresh `[]` on every call (even when the collection is logically empty), React detects a snapshot change (new `[]` !== old `[]`) and re-renders. If the getter returns the same `[]` reference every time it's empty, there's no change to detect.
- Symptom: infinite re-render loop with "Maximum update depth exceeded" error.
- Example bug: `RoomStateStore.getMembers()` returned `this.#fillMembersCache() || []`, which creates a fresh `[]` when the cache is empty. Fix: use a module-level `const emptyMembers = []` and return that reference in all empty cases.
- This latent bug became visible in 2026-08-21 when rendering member-related hooks on freshly-opened spaces before member state was loaded.

## Content-Visibility and Paint Deferral
- `content-visibility: auto` with `contain: strict` (used for room-list virtualization) causes WebKit to defer repaints of those elements until the next browser event loop cycle.
- During rapid Alt+↑/↓ room navigation, the old room's `.active` class removal and the new room's `.active` class addition both defer, leaving two rooms visually highlighted for ~100ms until a later repaint triggers (HMR, user input, etc.).
- `useContentVisibility` React hook depends on the `contentvisibilityautostatechange` event firing on the element itself, so if you remove the CSS property, you must also remove the hook — they're coupled.
- Solution for room lists: render all entries unconditionally (trade memory for visual correctness). Room lists are typically <200 entries even in large workspaces, so the DOM size is acceptable.

## Quick Switcher (Cmd+K launcher)
- Component lives at `web/src/ui/QuickSwitcher.tsx` (.css styles)
- Opened via `modals.quickSwitcher(store, mainScreen)` from `"Super+k"` keybinding in `web/src/ui/keybindings.ts`
- 48rem panel at 11vh, 1.375rem search input with dark background
- ROOMS section: 10 recency-ranked results, ranking: prefix match (0) > substring (1) > subsequence (2) over `search_name` field, stable by recency
- ACTIONS section: pinned at bottom (Settings — only when room active, New room)
- Navigation: arrow keys span rooms→actions, Enter activates, Cmd+K/Esc closes
- Room entries use `roomList.current` (oldest-activity-first); search performed via `search_name` normalized string (`util/searchablestring.ts`)
- Modal system: `window.openModal`/`window.openNestableModal` set in `ui/modal/Modal.tsx`; overlay base styles in `ui/modal/Lightbox.css` (div.overlay); scoped CSS override for reduced frosting via `:has(> div.modal-box.quick-switcher-modal)` — blur(3px), darker overlay vs app-wide 20px/0.5

## gomuks Go Backend Details
- **CORS not available:** The Go server (cmd/gomuks) uses `exhttp.AutoAllowCORS=false` in main.go. The only CORS-adjacent logic is `origin_patterns` config, which only checks WebSocket origin (it does NOT unlock HTTP CORS). For a cross-origin frontend (tauri:// → http://localhost:29325), CORS middleware would need to be added to cmd/gomuks/main.go, which is outside the frontend's control.
- **Cookie same-site and insecure_cookies:** gomuks_auth cookie is SameSite=Lax. When `insecure_cookies` is enabled (dev mode), the Secure flag is stripped; it becomes SameSite=Lax + non-Secure, which forbids sending to HTTPS URLs. Critically, SameSite=Lax + cross-origin is impossible — the browser will never send the cookie. The only way to fix this server-side is to set SameSite=None + Secure, but that requires HTTPS. **Practical implication:** Tauri's http:// localhost origin (even with insecure_cookies enabled) cannot auth against a SameSite=Lax cookie. Same-origin is required (tauri:// to tauri:// OR http:// to http:// with matching port).
- **Frontend etag check:** gomuks backend injects a `<meta name="gomuks-frontend-etag" ...>` tag (populated from a BuildTime variable in cmd/gomuks/main.go). The frontend's `index.html` reads this and runs `checkUpdate()` to fetch bundled assets only if the etag matches. When etag is empty (plain `go build` without maubuild), the meta tag still exists (empty value), and `checkUpdate()` safely bails early — no corruption, just skips the update check. Etag is purely an optimization for hot-reload detection; missing it is benign.

## useResizeHandle localStorage Write Timing
- `useResizeHandle` hook (web/src/ui/util/ResizeHandle.tsx) persists the width to localStorage in a `useEffect` whenever the width changes. Critically, React's strict mode in development calls effects twice, and the hook runs on MOUNT to read the persisted value and set it as the initial state.
- **Gotcha:** If you change the default width constant (e.g., `const DEFAULT_WIDTH = 350` → `const DEFAULT_WIDTH = 400`), existing users will NOT see the new default. Their old value is already persisted in localStorage and will be read on mount, overriding the constant.
- **Fix:** Bump the localStorage key name (e.g., `roomListWidth` → `roomListWidth2`). This creates a "fresh" entry that falls through to the new default constant. Old persisted values are left untouched (no data loss), just orphaned.
- **Related pattern:** Any hook that reads localStorage on mount and writes to localStorage on state change can have this problem. The localStorage key is the only lever for invalidating old defaults.
