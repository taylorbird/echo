# echo — UI design specification

Extracted from the echo (gomuks fork) React frontend so the look can be rebuilt in another codebase (Sable, Svelte).

- **Source of truth:** `/Users/tbird/gomuks/web/src` (paths below are relative to it unless noted). Design rationale comes from `/Users/tbird/gomuks/.claude/work/constraints.md` and `.claude/learnings/{gomuks-frontend-structure,tauri-macos-chrome}.md`.
- **Units:** the root font size is **14px** (`index.css:429`), so `1rem = 14px`. px values in brackets are computed from that.
- **Tags:** **[TAURI]** means the rule only applies inside the macOS app shell, scoped to `html[data-tauri]`. **[DARK]** means `@media (prefers-color-scheme: dark)`. Anything untagged applies in a plain browser and in both schemes.
- **Screenshots:** the reference shots in the session scratchpad (`laptop-*.png`, `card-*.png`, `close-hover-light.png`, `editor-name-dark.png`) were taken in a **plain browser** (no traffic lights, panes not floating). They confirm the browser and light/dark rules, not the TAURI chrome. Where a shot disagrees with the code, it says so inline.

---

## 0. Cross-cutting principles (from constraints.md)

1. **Square panes.** Panes have no corner radius. Separation comes from gaps, shadows and light edge lines (`index.css:688` `--pane-radius: 0`). Modals and pop-ups are the exception and keep a radius.
2. **Dark surfaces separate with light edges.** A black shadow cast on the near-black chat pane is invisible, so every raised edge pairs a 1px light line (`rgba(255,255,255,.07)`) with the dark blur (`index.css:704-717`).
3. **One glow idiom.** A 3px (`.1875rem`) pill with a two-layer halo (`0 0 6px near, 0 0 14px far`) marks "you are here". Exactly one pill marks the active view in the rail at any time.
4. **Unread tiers are carried by hue and shape, never by motion.** Blue dot, then blue count, then red count with "@". The pulse is decoration only.
5. **Reduce motion.** Every animation sits behind `@media (prefers-reduced-motion: reduce)` together with `html:not([data-ignore-reduce-motion])`, so a user preference can override the OS setting. JS state machines that wait for `animationend` must skip the exit state entirely under reduced motion, because the event never fires.
6. **Reading surfaces stay opaque.** Chat and timeline are never translucent. Only the sidebars show macOS vibrancy.
7. **Shared header height.** One `--room-header-height` token sets the room header, the room-list search row and the right-panel header, so their bottom edges form one horizontal line.
8. **Room names are one colour.** White in dark mode, body text colour in light mode. A room's state is carried by its wash, glow bar and badge, never by a per-room tint.

---

## 1. Global

### 1.1 Type (`index.css:1-17, 382-430`)
| Role | Value |
|---|---|
| UI face | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`. Inter 4.1 **variable** woff2 (weights 100–900, roman and italic) is bundled locally, not loaded from Google Fonts. The variable font is needed because weight **600** is used heavily. |
| Display role | `--display-font-stack` = Inter as well. It is kept as a separate named token for names, titles and usernames, but there is no second face. |
| Monospace | `"Fira Code VF", "Fira Code", monospace`, variable 300–700, `font-feature-settings: "cv02","ss03"`, `letter-spacing: -0.0088em` |
| Body | 400 weight, `line-height: 1.5`, `letter-spacing: normal`, no font features (upstream's Inter cv05 tuning is deliberately neutralised) |
| Base size | `html { font-size: 14px }` |
| Small | `--small-font-size: .875rem` (12.25px) |

The type scale actually used:

| Size | Where |
|---|---|
| 1.625rem / 700 / -.01em | profile-card name |
| 1.5rem | h1/h2 in messages, right-panel display name |
| 1.375rem / bold / lh 1.3 | room header title |
| 1.125rem / 600 / lh 1.35 | room-list room name |
| 1.0625rem / 600 / .015em | timeline sender name |
| 1rem / 700 | room-list section header |
| .9rem | room-list preview |
| .875rem | labels, card text |
| .85rem | room topic |
| .8125rem | small meta |
| .75rem | badges, user IDs |
| .7rem | timestamps, "(edited)" |

### 1.2 Colour tokens

The light values are upstream gomuks values and are only lightly tuned. **The dark scheme is the designed one.** Dark mode is "Ferra" warm sidebars, with a cool near-black chat pane under TAURI.

| Token | Light | Dark (`index.css:207-379`) |
|---|---|---|
| `--background-color` | `#fff` | `#28282d` (TAURI html: `#42424c`; TAURI chat pane: `#16181f`) |
| `--text-color` | `#000` | `#efe7e1` (warm off-white; TAURI chat pane `#e6eaf2`) |
| `--secondary-text-color` | `#888` | `#b0acaa` (TAURI chat pane `#98a0b0`) |
| `--tertiary-text-color` | `#9a9a9a` | `#6d7686` |
| `--semisecondary-text-color` | `#555` | `#ffb59a` |
| `--link-text-color` | `#0467dd` | `#ffb59a` |
| `--primary-color` / `-dark` | `#00c853` / `#00b24a` (green) | `#f0e2d8` / `#dcc9bc` (cream) |
| `--inverted-text-color` | = background | = background (restate it wherever `--background-color` is re-scoped) |
| `--error-color` | `red` | `#e06b75` (fill) |
| `--error-text-color` | `darkred` | `#ff8fa3` (≥7:1 as text) |
| `--border-color` | `#ccc` | `#46464e` (TAURI chat `#2f3543`) |
| `--hairline-color` | `rgba(0,0,0,.08)` | `rgba(var(--warm-tint-rgb),.09)` (TAURI chat `rgba(230,234,242,.09)`) |
| `--warm-tint-rgb` | `254,205,178` | `240,226,216` (one knob for all warm tints) |
| `--section-label-color` | = secondary | `rgba(warm,.45)` |
| `--button-hover-color` | `rgba(0,0,0,.2)` | `rgba(warm,.2)` (TAURI chat `rgba(230,234,242,.18)`) |
| `--light-hover-color` | `rgba(0,0,0,.1)` | `rgba(warm,.1)` (TAURI chat `rgba(230,234,242,.08)`) |
| `--composer-background-color` | `#f0f0f0` | `#35353a` (TAURI html `#363640`; TAURI chat `#1e212a`) |
| `--timeline-hover-bg-color` | `#eee` | `#35353a` (TAURI chat `#212530`) |
| `--timeline-highlight-bg-color` | `rgba(255,255,0,.1)` | `rgba(255,228,132,.15)` |
| `--timeline-jump-bg-color` | `rgba(0,255,0,.2)` | `rgba(160,231,200,.2)` |
| `--code-background-color` | `rgba(0,0,0,.15)` | `rgba(53,53,58,.8)` (TAURI chat `rgba(30,33,42,.85)`) |
| `--pill-background-color` | `#ccc` | `#64646e` (TAURI chat `#39404f`) |
| `--url-preview-background-color` | `rgba(0,0,0,.05)` | `#35353a` |
| `--blockquote-border-color` | `#ccc` | `#4d424b` (TAURI chat `#2f3543`) |
| `--chat-surface` | — | `#16181f` |
| `--field-fill` / `--field-ring` | — | `rgba(230,234,242,.05)` / `.13` |
| `--danger-button-bg` / `-ring` | — | `rgba(255,77,109,.16)` / `.42` |
| `--progress-color` | — | alias of `--unread-counter-message-bg` |
| `--dimmed-overlay-background-color` | `rgba(0,0,0,.75)` | same (TAURI `.5`) |
| `--modal-box-shadow-color` | `rgba(0,0,0,.1)` | `rgba(0,0,0,.3)` |

**Accent glows** (both schemes, `index.css:53-65`):
- Yellow, for the space, sub-filter, resize handle and header button: `--accent-glow-color: #ffe484`, near `rgba(255,228,132,.75)`, far `rgba(255,228,132,.35)`.
- Green, for the active room: `--room-glow-color: #85f0a8`, near `rgba(133,240,168,.75)`, far `.35`.
- Constraints.md names the pill colour `#f5d76e`. The code is `#ffe484`; follow the code.

**Sidebar surfaces:**

| Token | Light | Dark | TAURI (both schemes as written) |
|---|---|---|---|
| `--room-list-background` | `#232125` | `#232125` | `rgba(30,30,36,.78)` |
| `--room-list-background-overlay` (room list) | `hsla(0,0%,96%,.9)` | `#202024` | `transparent` (vibrancy shows) |
| `--space-list-background-overlay` (rail) | `hsla(0,0%,96%,.8)` | `#17171b` | `rgba(20,18,22,.85)` |
| `--space-bar-under-layer` (parted band) | `hsla(0,0%,89%,.95)` | `color-mix(in oklab,#2b2b33 85%, rgb(warm))` | `rgba(72,69,74,.9)` |
| `--space-sub-filter-selected-bg` | `rgba(214,168,0,.18)` | `rgba(255,228,132,.16)` | — |
| `--room-list-entry-hover-color` | `rgba(0,0,0,.075)` | `rgba(warm,.1)` | — |
| `--room-list-entry-selected-color` | `rgba(0,0,0,.125)` | `rgba(warm,.15)` | — |

Under TAURI the `--room-list-background` and rail tints are declared outside any colour-scheme query (`index.css:732-740`), so the sidebars render dark-tinted even in light mode. This is inferred from the code; no light-mode TAURI screenshot exists to confirm it.

**Unread palette** (dark, `index.css:293-354`):

| Tier | Badge bg | Ink | Glow near/far |
|---|---|---|---|
| message | `#5cbbff` | `#10233a` (`--unread-counter-blue-text`) | `rgba(92,187,255,.75)` / `.4` |
| notified / marked unread | `#85d6ff` | `#10233a` | same blue |
| highlight (mention) | `#ff4d6d` | `#fff2f4` | `rgba(255,77,109,.9)` / `.45` |
| row wash, unread | `rgba(92,187,255,.06)` | | |
| row wash, highlight | `rgba(255,77,109,.06)` | | |
| space badge message / notified / highlight | `rgba(209,209,224,.8)` / `#a0e7c8` / `#ff9eb5` | | |

Light mode keeps upstream's colours: message `rgba(0,0,0,.35)`, notified `rgba(50,150,0,.7)` (green), highlight `rgba(200,0,0,.7)`. Light mode defines no glow or wash tokens, so those declarations are invalid and render nothing. The blue/red ramp is effectively dark-only.

**Sender palette** (10 slots; the count is coupled across six places in the code, `index.css:150-159, 363-374`):

| idx | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| dark | `#ff5d73` | `#ffa64d` | `#4dd6a8` | `#a78bfa` | `#4db8f5` | `#f0c674` | `#ff7ac6` | `#4de0e0` | `#ff8a65` | `#a3e635` |
| light | `#a4041d` | `#9b2200` | `#803f00` | `#005f00` | `#005c45` | `#00548c` | `#064ab1` | `#5d26cd` | `#822198` | `#9f0850` |

### 1.3 Base elements (`index.css:412-611`)
- **Scrollbars:** `scrollbar-width: thin`. WebKit scrollbars are 6px wide, with a transparent track and a `--border-color` thumb at radius 3px that turns `--secondary-text-color` on hover. The room list uses `scrollbar-color: rgba(warm,.4) rgba(warm,.1)` in dark mode. The rail hides its scrollbar.
- **Buttons:** reset to no background and no border, radius `.25rem`, flex-centred, `cursor: default` (`--clickable-cursor`, so there are no hand cursors). Hover and focus use `--button-hover-color`. `.primary-color-button` is filled `--primary-color` and turns `-dark` on hover.
- **Links:** `--link-text-color`, no underline, underline on hover.
- **Focus:** there is no global focus ring. Components use `:focus-visible` to reuse their hover fill. Inputs in pop-ups switch their border to `--primary-color` on focus (`ProfileEditor.css`).
- **Avatars:** `img.avatar` is 2.5rem (35px) round, `object-fit: cover`. `.small` is 1rem and `.large` is 5rem. Spaces use a squircle `clip-path` (`index.html:36`): `M0 .5C0 0 0 0 .5 0S1 0 1 .5 1 1 .5 1 0 1 0 .5`. Rule of thumb: people are round, places are squircles.

---

## 2. App frame and window (`ui/MainScreen.css`, `index.css:617-938`, `RoomList.css:1-22`)

### 2.1 Grid
`main.matrix-main` is `position: fixed; inset: 0` and uses CSS grid:

```
closed panel: [roomlist var(--room-list-width)] [rh1 0] [roomview 1fr]
open panel:   [roomlist] [rh1 0] [roomview 1fr] [rh2 0] [rightpanel var(--right-panel-width)]
```

- The **space rail lives inside the room-list column.** `div.room-list-wrapper` is its own grid (`RoomList.css:9-13`):

  ```
  "spacebar search"  var(--window-top-margin)
  "spacebar search"  var(--room-header-height)
  "spacebar roomlist" 1fr
  / var(--space-bar-width) 1fr
  ```

- **Room view grid** (`RoomView.css`): rows are header (`--room-header-height`), messageview `1fr`, autocomplete `0`, input `auto`, typing `auto`, blank (bottom safe area). It has `contain: strict`.
- **Widths:**
  - Room list defaults to **440px**, minimum 240, maximum `min(900, max(40vw, 440))`, persisted in localStorage `roomListWidth3` (`MainScreen.tsx:518`). The CSS fallback says 400px (`MainScreen.css:3`); the TSX value wins.
  - Right panel defaults to 300px, minimum 100, maximum as above.
  - Rail is `--space-bar-width` **5.25rem** (73.5px) in the browser and **5.5rem** (77px) under TAURI, which is enough to clear the traffic lights at ~66pt.
- **Header height:** `--room-header-height` is **3.5rem** (49px) in the browser and **4.75rem** (66.5px) under TAURI.

### 2.2 Resize handles (`ui/util/ResizeHandle.css`)
- The handle is zero-width in the grid (`rh1` / `rh2`) at z-index 2.
- The invisible hit area extends `.25rem` on each side and shows `col-resize`.
- A visible `.125rem` (1.75px) bar in `--accent-glow-color` sits inside it, at opacity 0 when idle.
  - Hover: opacity .55 with `0 0 6px far`.
  - Dragging: opacity 1 with `0 0 8px near, 0 0 20px far`.
  - Transition: opacity and box-shadow `.15s ease`, set to `none` under reduced motion.

### 2.3 Breakpoint (`MainScreen.css:20-43`, `index.css:195`)
At `max-width: 45rem` (630px) the grid becomes three 100%-wide columns that slide:
- `.room-selected` sets `translate: -100%`; `.right-panel-open` sets `-200%`.
- Transition `.3s`, `none` under reduced motion.
- `--timeline-horizontal-padding` drops to `.5rem` and `--timeline-status-size` to `2.3rem`.
- The room header's right buttons collapse into a "more" menu below 30rem of container width (`@container`).

### 2.4 macOS chrome [TAURI]
- **Window:** transparent window with NSVisualEffect `sidebar` vibrancy and `titleBarStyle: Overlay`. The traffic lights are native. html and body are `transparent` (`tauri-macos-chrome.md`).
- **No title-bar band.** Every pane runs to the window's top edge (`--window-top-margin: 0px`). Only the rail reserves the traffic-light strip, with `padding-top: calc(var(--traffic-light-strip) + .5rem)`, where `--traffic-light-strip: 2rem` (28px, the standard height that centres the lights without a position override) (`MainScreen.css:80-89`). There is no wordmark in the window.
- **Drag regions:** the search row (`data-tauri-drag-region`), the rail, and the room header. Interactive children don't drag.
- **Floating panes:**
  - `div.room-view` and `div.right-panel` get `margin: 0 var(--pane-gap) var(--pane-gap) 0`. That is a **.5rem gap on the right and bottom only, with the top flush**, so the vibrancy shows through the gaps.
  - `--pane-radius: 0`.
  - `--pane-shadow: 0 0 0 .5px rgba(0,0,0,.45), 0 6px 20px rgba(0,0,0,.3)`.
- **Stacking runs left over right:**
  - The **room list** is raised: z-index 3, `box-shadow: 1px 0 0 rgba(255,255,255,.07), 8px 0 24px rgba(0,0,0,.6)`.
  - The **chat pane** is recessed: its shadow is replaced with `inset 10px 0 10px -10px rgba(0,0,0,.6)`.
  - The **right panel** is raised from the right: z-index 3, `-1px 0 0 rgba(255,255,255,.07), -8px 0 24px rgba(0,0,0,.6)`, no border-left, background `--room-list-background` so it matches the room list.
  - z-order: panes at ≤3, update chip at 5, modals at 100.
- **Tone order, darkest to lightest:** rail `rgba(20,18,22,.85)`, room list `rgba(30,30,36,.78)` over vibrancy, then the chat. In dark mode the chat is the darkest surface (`#16181f`, cool) and is fully opaque.
- **Room header [TAURI]** is painted `--room-list-background` so the two header bands read as one strip. Over the opaque chat it lands darker, and that is accepted.
- **Modal backdrop [TAURI]:** `blur(20px) saturate(115%)` with a `.5` dim. In the browser the blur is 0 and the dim is `.75`.
- **Update chip [TAURI]** (`MainScreen.css:96-144`):
  - Fixed 1rem from the bottom-right corner, radius .5rem, padding `.5rem .5rem .5rem .875rem`, gap .625rem, .875rem text, background `#eceaee` (light) or `#202024` (dark).
  - Edge: `inset 0 0 0 1px rgba(255,255,255,.16), 0 0 0 1px rgba(0,0,0,.5), 0 8px 24px rgba(0,0,0,.35)`.
  - Entrance: `.35s cubic-bezier(.32,.72,0,1)` from opacity 0 and +.5rem Y. Under reduced motion it fades for `.12s`.
- **Linux [TAURI]:** the strip is 0, the rail is 5.25rem, and the ground is opaque (`#e4e2e7` light, `#1c1b20` dark).

### 2.5 House easing
`cubic-bezier(.32,.72,0,1)` is the house curve: front-loaded, then it settles. It is used by the rail drawer and the update chip. Closing animations run at twice the opening duration on the same curve.

---

## 3. Space rail (`RoomList.css:63-452, 929-992`, `RoomList.tsx:417-720`)

### 3.1 Structure (top to bottom)
`div.space-bar` is a flex column with a hairline `border-right: 1px solid var(--hairline-color)`, a hidden scrollbar, and no horizontal padding. Its children, in order:

1. **All chats** tile (home icon). It is lit when no filter is set, because being logged in always means being in a space.
2. **Outside spaces** tile (bubble-network icon). This holds orphan rooms and DMs.
3. One tile per top-level space (squircle avatar). When more than one space exists, a `space-bar-divider` sits above **every** space.
4. A `space-bar-divider`, then the **Unread chats** tile (bell icon). This is a lookup across everything else, not a place to stand, so it can't be parted.
5. `div.space-bar-footer` (sticky to the bottom, `margin-top: auto`) contains the cheat gamepad (only while a cheat is active), the **profile** avatar button, and the **settings** cog. "Bell" in the brief is the Unread tile, item 4.

The open "partable" entry (All chats, Outside spaces, or a space) **parts the rail**. The dark strip splits into segments with a lighter band between them.

### 3.2 Tiles (`div.space-entry`)
- Size 3.125rem square (43.75px), padding .3125rem, margin `.3125rem auto`, radius .78125rem. The avatar inside is exactly 2.5rem.
- Space avatars use radius .625rem with no clip. DM tiles are round (`.rail-dm`).
- Pseudo-space glyphs are 1.75rem, centred with `margin-top: .375rem`, coloured by inheritance.
- Hover and focus fill the tile with `--room-list-entry-hover-color`. Active fills it with `--room-list-entry-selected-color`.
- **Glow pill** (`&.active::before`):
  - Absolute position, `left: -.75rem`, vertically centred.
  - **3px × 21.875px** (`.1875rem × 1.5625rem`), radius 999px.
  - Background `#ffe484`, `box-shadow: 0 0 6px var(--accent-glow-near), 0 0 14px var(--accent-glow-far)`.
- **Tile badge** (`.unread-count.space`):
  - Size .75rem.
  - Absolutely placed on a zero-size anchor at the tile's right, offset `margin-top: .9375rem; margin-right: .3125rem`.
  - Colours from the space palette.
  - Clicking the badge jumps to the newest room with the highest tier.

### 3.3 Parted drawer (band)
- **Segments** (`div.space-bar-segment`):
  - No background of their own; they inherit the rail.
  - z-index 1.
  - They cast onto the band: `.top` gets `0 2px 5px rgba(0,0,0,.45)`, `.bottom` gets `0 -2px 5px …`, and `.between` gets both.
  - Square cut, no radius.
- **Band** (`div.space-bar-under-layer`):
  - Background `--space-bar-under-layer`, z-index 0, `min-height: 0` (load-bearing).
  - `display: grid; grid-template-rows` animates **0fr → 1fr**.
  - Open: `space-bar-part .42s cubic-bezier(.32,.72,0,1)`.
  - Close: `.closing` runs `space-bar-close .84s` on the same curve with `forwards`, plus `pointer-events: none`.
- **Inner wrapper** (`div.space-bar-under-layer-inner`):
  - Flex column, centred, `overflow: hidden`, `min-height: 0`, padding `.375rem 0 .5rem`.
  - Content fades in front-loaded (opacity 0 → 1 by 55%) and fades out by 45% of the close.
- **Band contents, in order:**
  1. The space's own tile. Inside the band the tile's pill is suppressed, because the sub-filter row takes it.
  2. `space-sub-divider`.
  3. Rail DMs (if any), then another sub-divider.
  4. Sub-filter buttons.
- **Closing band:** it renders only the divider and the sub-filters. The space tile moves into the segment above at the same pixel position, so it doesn't collapse with the drawer.
- **Space switch:** the old band closes in place while the new band opens at its own position. At most one closing band is ever mounted. A JS fallback timeout of 1100ms ends a close that never received `animationend`.
- **Reduced motion:** no animation; the rail parts instantly. The JS skips the closing band entirely.

### 3.4 Dividers
"Engraved" dividers: `width 2.5rem; height 1px; background rgba(0,0,0,.4); box-shadow 0 1px 0 rgba(warm,.08)`.
- Rail level (`space-bar-divider`): margin `.5rem auto`.
- In-band (`space-sub-divider`): margin `.4375rem 0 .3125rem`.

### 3.5 Sub-filters (`button.space-sub-filter`)
- Order and icons: **All chats** (layers), **Rooms** (hash), **Direct messages** (user), **Recent** (clock).
- Full rail width (`align-self: stretch`), height 3.125rem, square, no radius. Glyph 1.4375rem (20px), smaller than the tiles on purpose.
- Colour `--secondary-text-color`.
  - Hover or focus-visible: hover fill and `--text-color`.
  - Selected (`aria-pressed=true`): `--text-color` on a `--space-sub-filter-selected-bg` band, with the **same glow pill**, positioned at `left: calc((var(--space-bar-width) - 3.125rem)/2 - .75rem)` so it lines up with the tiles' pill.
- Behaviour:
  - Recent narrows nothing. It shows one headerless list of all rooms, newest first, with no Unread section.
  - Selecting a sub-filter doesn't close the open room.

### 3.6 Rail DM tiles (`RailDMs.tsx`)
- Up to **3** unread one-to-one DMs, newest first, excluding invites. They sit at the top of the open drawer between the sub-divider and the sub-filters. Controlled by preference `rail_unread_dms`, default on.
- Round avatar tile, `title=room name`. **These tiles never take the glow pill.**
- Clicks with `detail > 1` are ignored. While any band is `.closing`, the tiles get `pointer-events: none`.
- The badge uses the **room-list tiers**, not the space palette:
  - message: `#5cbbff` with ink `#10233a` and `0 0 5px near` glow
  - notified: `#85d6ff`
  - highlight: `#ff4d6d` with ink `#fff2f4`
  - DM default (`.dm-mention`): a plain **.5rem red dot**, no glow, digits hidden with `font-size: 0`

### 3.7 Footer (`RoomList.css:929-992`)
- Sticky to the bottom, z-index 2, background equals the rail's, top hairline `0 -1px 0 var(--hairline-color)`, padding `.5rem 0 .625rem`, gap .25rem.
- Buttons are 3.125rem square, radius .78125rem, `--secondary-text-color`; hover gives the hover fill and `--text-color`. Glyphs are 1.75rem. The profile avatar is 2.1875rem.
- The cheat indicator is drawn in `#ffe484` with `drop-shadow(0 0 6px far)`.

---

## 4. Room list (`RoomList.css:455-1186`, `Entry.tsx`, `RoomList.tsx`)

### 4.1 Header / search row (`div.room-search-wrapper`)
- Height `--room-header-height`, transparent under TAURI, drag region.
- Children, in order:
  1. `input` with placeholder "Search rooms": borderless, transparent, height 3rem, `padding-left: 1rem`, `flex: 1`.
  2. **Mark all read** button (material mark-read icon), only when the query is empty and there are unreads. It opens a confirm modal.
  3. **Create room** button (add-circle icon), only when the query is empty.
  4. A search button that turns into a close/clear button while typing.
- Buttons are 2.5rem square, square corners, `--text-color`.
- Keys: Esc clears the query; Enter opens the last match.

### 4.2 Sections
- In All chats the list is grouped, in order: **Unread** (bell icon), **Rooms** (users icon), **Direct messages** (user icon).
  - Unread appears only with preference `unread_section`. A badged room moves into Unread rather than appearing twice.
  - The room you just opened stays pinned in Unread until you leave it.
  - Empty sections are dropped.
- In the Rooms and DMs sub-filters the header is static (`.static`: not a control, no hover). Recent shows a single headerless section (`.headerless { padding-top: .5rem }`).
- **Section header** (`button.room-list-section-header`, `RoomList.css:851-912`):
  - Height 2.25rem, `margin-inline: .5rem` (`--sidebar-inset`), padding `0 .375rem 0 .5rem`, radius .5rem, gap .5rem.
  - Text 1rem / 700, `--text-color`. Dark mode: `color-mix(in oklab, #bd93f9 45%, var(--text-color))`, a lavender ink.
  - Icon 1.125rem at opacity .75. Name ellipsizes.
  - Chevron 1.125rem at opacity .45, pointing down when open and rotated -90° when collapsed, transition `rotate .15s ease` (off under reduced motion).
  - Hover fill. Collapse state persists in localStorage `echo.collapsed_room_list_sections`.
  - Section block: `padding-bottom: .5rem`.

### 4.3 Row (`div.room-entry`)
- **Geometry:**
  - Height **4rem** (56px), flex, `align-items: center`, gap .25rem.
  - Padding `.5rem .5rem .5rem calc(1rem + 10px)`. The left 1rem is the glow-bar lane; the extra 10px only pushes content right.
  - `overflow: hidden; position: relative`.
  - **Do not virtualise** (`content-visibility`), because WebKit delays the repaint of `.active` and two rows end up highlighted.
- **Children, in order:**
  1. `div.room-entry-left`: a 3.5rem lane containing `img.avatar.room-avatar` (2.5rem round, margin .25rem). The skeleton draws this avatar at 3rem; the real rows and the screenshots (~36 CSS px) show 2.5rem.
  2. `div.room-entry-right`: flex column, gap .125rem, `min-width: 0`.
     - `div.room-name`: **1.125rem / 600 / line-height 1.35, mixed case, no tracking**, flex with gap .625rem.
       - `span.room-name-text` ellipsizes.
       - Then a **kind glyph** `svg.room-kind-icon`, .9375rem at opacity .65: `user` for a DM, `users` for an ad-hoc group named after its members, `messages-square` for a named room.
       - Dark mode: glyph colour `var(--room-list-color, #bd93f9)` at opacity .9. This is the only place the accent appears at full strength.
       - Name colour: dark `--room-list-name-color: #ffffff` for every row and every state. Light mode inherits `--text-color`.
     - `div.message-preview`: .9rem, line-height 1.4, opacity .9, nowrap with ellipsis. Dark colour `#b9b3ae`.
       - Format: `Sender: text`. "You" stands for yourself. Names longer than 16 characters are cut to 12 plus "…".
       - `span.sender-name` is weight 500, coloured inline with that sender's **room-aware timeline colour**.
       - The screenshots show these prefixes mostly in palette slot 0 (red), because the first sender seen in each room gets index 0.
  3. Unread badge lane (`div.room-entry-unreads`): 3rem wide, `margin-right: .25rem`, centred.
- There is **no timestamp** in the row (code and screenshots agree).
- **Separators:** each visible row after the first gets `box-shadow: inset 0 1px 0 rgba(warm,.08)`, a light hairline.
- **Hover:** `--room-list-entry-hover-color`.
- **Active (open room):**
  - Background `rgba(warm,.24)`, plus `inset 0 1px 0 rgba(255,255,255,.08), inset 0 -1px 0 rgba(0,0,0,.35)` (lit top edge, dark seam below). The following row drops its hairline.
  - **Green glow bar** `::before`: left `calc((1rem - .1875rem)/2)`, 3px × **2rem**, radius 999px, `#85f0a8` with a `6px/14px` halo.
  - The screenshots show a pale beige wash and a green bar in light mode, which matches.
- Resting rows are **not** dimmed. Every row has the same weight.
- **Context menu:** right click (shift+right click gives the native menu).

### 4.4 Unread tiers: badge rings
echo's own badge (2026-10-30), replacing echo-gomuks's dots and pills. Every state is one **ring** in the badge lane, and each tier differs in what's inside it as well as its colour. Sable still decides whether a row has a badge (its badge modes and "show unread dots"); echo decides the ring's colour and content (`echo/ring.ts`, drawn by `echo/components/RoomRing.svelte`).

- **Ring:** height **2rem**, `min-width: 2rem`, radius 1rem, padding-inline .5rem, so wider content (`1k+`) stretches it into a pill. Centred in the 3rem lane.
- Fill: the tier colour at **18%**. Outline `box-shadow: 0 0 0 1px` tier at **60%**, plus a glow `0 0 12px` tier at **35%** (dark; light mode has no glow).
- Text **.8125rem / 600**, tabular numbers, the tier's ink.
- Counts are Sable's formatting (`formatUnreadCount`): up to `999`, then `1k`, then `1k+`.

| Tier | Ring colour (dark) | Ink | Inside | Row wash / bar |
|---|---|---|---|---|
| unread (any unread, notifying or not, or marked unread) | purple `#b48cff` | `#e9dcff` | the room's **total** unread count; an **8px dot** when there's no count (marked unread) | purple `.06` / purple |
| mention (highlight) | red `#ff4d6d` | `#ffd6dc` | **"@"** only, no number | red `.06` / red |
| DM unread | red | | an **8px red dot**, no number | red `.06` / red |
| muted room with unread (`echo/unread.ts`) | grey `#b0acaa` | `#dedad8` | the count; **no glow** | none / none |
| reaction marker (§4.6, "show reactions as notifications") | blue `#5cbbff` | `#cfeaff` | the reaction's **emoji** (1.0625rem), no count | blue `.06` / blue |

Precedence, one ring per row: mention, then muted, then DM, then unread; a reaction marker only shows when none of those apply. The open room's green bar and wash outrank every tier. The tokens are RGB triplets in `styles/frame.css` (`--echo-ring-*`); light mode uses darker hues of the same tiers, with no glow or wash. Sable's own badge stays in the lane for screen readers, visually hidden. The rail's space badges keep their own look (§3).

### 4.5 Compact mode (preference, `StylePreferences.tsx:116-149`)
Row height 2.75rem, padding .375rem vertical, avatar lane 2rem with a 1.75rem avatar, name 1rem, no preview, bars 1.5rem tall.

### 4.6 Reactions to your messages
Sable's core reports reactions only for open timelines, so `echo/core/reactions.rs` watches sync for a reaction by someone else to a message you sent, in any joined room (decrypted, so encrypted rooms work), and reports it to `echo/reactions.svelte.ts`.

- **Pop (live reactions only):** when the reaction is at most 60s old, its emoji takes the room's ring content for **5s**, with a spring: scale .85 → **1.12** → 1 over .3s, the settle on `cubic-bezier(.34,1.56,.64,1)`. The ring keeps the room's current colour and the row's bar and wash don't change; a room without a ring gets a purple one for the 5s. A newer reaction replaces the emoji and restarts the 5s.
- **Preview:** for the same 5s the row's preview crossfades (.25s) to "*Name* reacted to “excerpt”", the name in the reactor's sender colour at weight 500 (display name, else the localpart). The excerpt is your message's text (reply fallback stripped, 120 bytes), or what it was ("an image", "a file", …).
- **Marker** (with "show reactions as notifications" on): the reaction stays as the blue ring (§4.4), with the latest emoji, until you open the room. Markers are per account, kept in this device's local storage and not synced. A per-account watermark (the last time echo ran) lets reactions that came in while echo was closed leave markers without a pop; an account's first run starts it at now, so old history isn't marked.
- Ignored: your own reactions, reactions to others' messages, muted rooms, and redactions.
- With Sable's Reduce motion on (`echo/motion.ts`), the emoji and preview swap instantly.
- **Settings** (Notifications, desktop only, `echo/components/ReactionSettings.svelte`): "Show reactions in the room list" (on; off turns all of this off) and "Show reactions as notifications" (off).

---

## 5. Room header (`roomview/RoomViewHeader.css`, `RoomViewHeader.tsx`)
- Flex row, `align-items: center`, gap .625rem, `padding-left: .75rem`, height `--room-header-height`, container query enabled.
- z-index 1, so the shadow paints over the timeline. There is **no bottom border**; the separation is the cast shadow `--room-header-shadow: 0 4px 12px rgba(0,0,0,.28)`. The screenshots show the soft shadow under the header.
- Background is transparent in the browser (it sits on the chat surface). TAURI: `--room-list-background`.
- **Children, in order:**
  1. Back button (`arrow-left`). It appears in the browser screenshots even at desktop width.
  2. Room avatar **3rem**.
  3. Name and topic column:
     - Name: **1.375rem bold, line-height 1.3**, white in dark mode, ellipsized.
     - Topic: .85rem, line-height 1.35, secondary colour, one line, ellipsized.
  4. Right buttons, in the order the screenshots show: **pin, members (users), widgets (layout-grid), notifications (bell), search, view source (code), settings (cog)**, with `margin-right: .5rem`. Below a 30rem container width they collapse into a `more-horizontal` menu.
- Buttons are a 2.5rem target with a **1.25rem glyph**. Shrinking the 24px outline icon thins its stroke to ~1.5px.
- **Active panel button:**
  - Background `--room-list-entry-selected-color`, radius .5rem.
  - A yellow glow pill on the **bottom edge**: `bottom .25rem`, centred, 1.25rem × .1875rem, `#ffe484` with the `6px/14px` halo.
  - Visible in `laptop-members.png` on the members button.

---

## 6. Timeline (`timeline/TimelineEvent.css`, `ReplyBody.css`, `ReadReceipts.css`, `content/index.css`, `TimelineView.css`)

### 6.1 Geometry tokens (`index.css:169-188`)
| Token | Value |
|---|---|
| avatar | 2.5rem (35px), margin-top 2px |
| avatar gap | **1rem** |
| message gap (new sender) | **1.5rem** |
| same-sender gap | .35rem |
| small events (membership etc.) | 0 between consecutive ones |
| horizontal padding | **1.5rem** (.5rem at ≤45rem) |
| status column (receipts) | 4rem (2rem when receipts are off) |
| vertical padding | 0 |
| list bottom padding | 2rem; "load more" edge 2.5rem tall |

### 6.2 Event layout (`div.timeline-event`, grid)

```
"cmc    cmc  cmc     empty"  0      ← hover-menu anchor
"avatar gap  sender  sender" auto
"avatar gap  content status" auto
/ 2.5rem 1rem 1fr 4rem
```

- **Sender row:** `min-height: calc(avatar - .25rem)`, flex, centred, so the name sits centred on the avatar and the text starts below it. Gap to the timestamp is .25rem. The name-to-content gap is 0.
- **Sender name:** **1.0625rem / 600 / letter-spacing .015em**, full opacity, `color: var(--sender-color)`. The colour is set inline on the row by `getSenderColor(roomID, userID)`. There is no ring, rail or plate behind names (these were removed on 2026-09-13).
- **Timestamp** next to the name: .7rem, secondary colour, **opacity .5**.
- **Grouping (`.same-sender`):** avatar and name are hidden. A gutter column `avatar+gap` carries a `.event-time-only` timestamp (.7rem, opacity .5, aligned to the bottom). Top margin is .35rem.
- **Small events:** a 1.5rem avatar in the second column, timestamp in the gutter.
- **Hover:** `--timeline-hover-bg-color`. Highlighted (mentions you): `--timeline-highlight-bg-color`, a gold wash in dark mode. Jump target: mint, fading out over `background-color 1s`.
- **Edited marker:** `div.event-edited` below the content, .7rem secondary, e.g. "(edited at 15:36)" (screenshot).
- **Send status:** 1rem icon in the status column, `--sent-ok-color` or `--sent-error-color`.
- **Notices:** opacity .6. **Big emoji:** 3rem.

### 6.3 Sender colour allocation (`api/sendercolor.ts`)
Colours are **room-aware**, not hashed.
- The first time a sender appears in a room, they get the free palette slot whose hue is farthest from every hue already taken in that room. Ties go to the lowest index, so the first sender in a room always gets slot 0.
- The assignment is persisted in localStorage `echo.room_sender_colors` as `{roomID: {userID: index}}` and never reshuffled.
- After 10 senders, newcomers take the least-used slot, with the old hash breaking ties.
- Per-user overrides (custom colour or cheat) win outright and count as taken hues.
- The same colour is reused for the room-list preview prefix, reply sender names and mention pills (`--mention-color`).
- The member list still uses per-user hash colours, so it can disagree with the timeline.

### 6.4 Replies (`ReplyBody.css`)
- **Full quote** (`blockquote.reply-body`):
  - `border-left: 2px solid var(--reply-border-color)`, padding `.25rem .5rem`, margin-bottom .25rem.
  - The spine is a **static neutral**, `color-mix(in oklab, var(--secondary-text-color) 55%, transparent)`, never per-sender.
  - Sender line: a 1rem avatar plus the name in the quoted sender's colour. The screenshot shows the quoted name at body weight, while the timeline name rule sets 600; the exact quoted-name weight wasn't confirmed.
  - Quoted text is clamped to 2 lines (max 5rem) in `--semisecondary-text-color`, turning `--text-color` on hover.
- **Small reply** (`.small`, "small replies" preference):
  - One line at .875rem in a `reply` grid row above the avatar.
  - A curved connector `div.reply-spine`: 2px left and top border, `border-top-left-radius: .5rem`, starting at the avatar centre.
- **Thread messages:** 4px spine.

### 6.5 Reactions (`TimelineEvent.css:319-384`)
- Flex-wrap, gap .25rem, margin `.25rem 0`.
- Chip: background `--background-color`, `1px solid var(--border-color)`, **radius .5rem**, padding `.125rem .5rem`, min-height 2rem. Inner gap .375rem. Emoji image 1.5rem.
- **Own reaction (`.mine`):** border `rgba(warm,.55)`, background `rgba(warm,.12)`; hover `.2`.
- Other states: hover uses `--light-hover-color`; pending uses opacity .55 with `cursor: progress`.
- **"Who reacted" tooltip:** portalled to body, fixed position, centred above the chip. Background and border are the base colours, radius .5rem, shadow `0 4px 12px`, padding `.375rem .625rem`, .875rem text, max 18rem, z-index 20.

### 6.6 Read receipts (`ReadReceipts.css`)
- Placed in the status column, bottom-right, `margin-bottom: .125rem`.
- Overlapping **1rem avatars** with `margin-left: -.35rem`, each with a `1px solid var(--background-color)` border.
- A `+N` overflow count at .75rem in secondary colour sits before them (screenshot: "+5").

### 6.7 Day separator (`TimelineEvent.css:397-407`)
Flex row with gap .5rem and padding `calc(1.5rem/2) 0`: an `hr` (flex 1, **opacity .2**), the centred date text in the body colour (e.g. "Friday, 16 October 2026" in the screenshot), and another `hr`. Controlled by preference `show_date_separators`.

### 6.8 Hover menu (`menu/index.css:1-20`)
- `div.event-hover-menu`, absolutely positioned at `right: .5rem; top: -1.5rem`, overlapping the row above.
- Base background, `1px solid var(--border-color)`, radius .5rem, padding .125rem, gap .25rem, z-index 1.
- Buttons are 2rem square. Shown only on row `:hover` (or force-open).
- Uses the filled Material icon set. The exact buttons are assembled in `menu/EventMenu.tsx` and weren't enumerated here.
- Right-click context menu (`div.context-menu`): fixed, radius .5rem, 1px border, `box-shadow: 0 0 1rem var(--modal-box-shadow-color)`. Items have padding `.5rem .75rem`, a 1.5rem icon and gap .5rem. Destructive items use `--error-color`.

### 6.9 Message content (`content/index.css`)
- **Mention pills:**
  - `--pill-background-color`, **radius .5rem** (the same rounded square as the reaction chips), padding `0 .5rem`, nowrap, max 15rem, ellipsized, inline-block, `vertical-align: bottom`.
  - User pills take `color: var(--mention-color)` on `color-mix(in oklab, var(--mention-color) 18%, transparent)`.
  - `.mention-at::before` adds "@" at opacity .7.
- **Inline code:** `--code-background-color`, radius .25rem, padding `.125rem .25rem`, Fira Code.
- **Code blocks** (`pre`):
  - Full width, `max-height: max(50vh,400px)`, scrolls, `padding-bottom: .5rem`, tab size 4.
  - Syntax colours come from Chroma stylesheets served by the backend. The default theme is "auto": github (light) and github-dark (dark), with `pre.chroma { background: inherit }` (`StylePreferences.tsx`). Line numbers come from `data-linenum`.
- **Blockquote:** 2px left `--blockquote-border-color`, `padding-left: .5rem`.
- **Paragraphs:** gap 1rem. Lists indent 2rem. h1/h2 1.5rem, h3 1.25rem.
- **Custom emoji:** 2rem tall. **Spoilers:** `blur(4px)`, cleared on reveal with `.5s` transition.
- **File card** (`a.file-card`):
  - Fit-content, max `min(24rem,100%)`, padding `.625rem .875rem .625rem .75rem`, 1px border, **radius .75rem**, background `--light-hover-color`.
  - Contents: a type icon (2.25 × 2.8125rem), the name (600, ellipsized), meta (.8125rem secondary), and a 1.25rem download glyph at opacity .6 → 1.
  - Transition `.12s`.

### 6.10 Link previews (`urlpreview/URLPreview.css`, `YouTubeEmbed.css`)
- **Preview card:**
  - Margin `.5rem 0`, radius .5rem, `--url-preview-background-color` (border in the same colour).
  - Grid: title (bold, one line) + actions, then the description (3-line clamp, semisecondary), then the media (bottom radius .5rem).
  - Inline variant: max 20rem × 6rem, media on the left.
- **"Load preview" chip:** inline-flex, .8125rem, padding `.25rem .625rem`, radius .375rem, semisecondary turning to text colour on hover. In encrypted rooms previews are click-only by default.
- **YouTube card:**
  - Width `min(100%, 30rem)` (Shorts: 15rem with a 9:16 frame), radius .5rem, overflow hidden.
  - Header: "YOUTUBE" source label (.6875rem / 600 / .04em uppercase, semisecondary), then a bold ellipsized title, then the author (.8125rem, max 35%).
  - 16:9 frame with a poster image and a centred **3.5rem black play disc** (`rgba(0,0,0,.6)`, hover `.8`, `.15s`) holding a 1.75rem white triangle.
  - Lazy-loaded within 200px of the viewport; only one player plays at a time.

---

## 7. Composer (`composer/MessageComposer.css`, `TypingNotifications.css`)
- **Box** (`div.message-composer`):
  - Margin `1rem var(--timeline-horizontal-padding) .25rem`, background `--composer-background-color`, `1px solid var(--border-color)`, **radius .5rem**.
  - `box-shadow: 0 0 1rem var(--modal-box-shadow-color)`, z-index 1.
  - In the dark chat pane it is *lighter* than the pane (TAURI `#1e212a` on `#16181f`), so it reads as raised.
- **Input area:** flex-wrap, padding .5rem, gap .25rem.
  - The textarea takes a full first line: padding `.5rem 0 .25rem .5rem`, line-height 1.5, borderless. The placeholder is "Send a message (encrypted)" in encrypted rooms (screenshot).
  - Below it is the tool row: **emoji, sticker, GIF, location, mic, attach** (filled Material icons). Buttons are 1.5rem with a 1.25rem glyph and padding .125rem, at **opacity .35 → 1 on hover**.
  - The **send** button is last and pushed right (`margin-left: auto`): 2rem target, 1.5rem glyph, opacity .5.
- **Dragging a file over the composer:** `2px dashed var(--primary-color)`, wash `rgba(254,205,178,.1)`.
- **Pane-wide drop overlay:** `color-mix(background 70%)` with `blur(4px)`, and a dashed 2px box at radius 1rem with padding `2rem 3rem` (`RoomView.css`).
- **Reply-in-composer quote:** margin `.5rem .5rem 0`.
- **Typing line:** height 1.5rem, .9rem text, overlapping avatars (-.35rem). Margin-bottom `.5rem + safe-area`. It always occupies its space, so the composer never jumps.

---

## 8. Right panel (`rightpanel/RightPanel.css`)
- Flex column. Browser: `border-left: 1px solid var(--border-color)`.
- TAURI:
  - No border; background `--room-list-background` with the raised left shadow (§2.4); header bottom edge becomes `--hairline-color`.
  - **Entrance:** `right-panel-slide-in .22s cubic-bezier(.22,.61,.36,1)` from `translate: 100%` to 0. Under reduced motion it fades instead (`.12s ease-out`). The grid column is allocated instantly; only the panel slides.
- **Header:** height `--room-header-height` (aligned with the room header), `border-bottom: 1px solid var(--border-color)`, padding `0 .25rem`. Title is bold with `margin-left: .25rem` (e.g. "Room Members"). The close and back buttons are 2.5rem.
- **Members:**
  - Filter input: borderless, padding 1rem, bottom border, placeholder "Filter members".
  - Rows: grid `2.5rem avatar | name`, height 3rem, padding .25rem, column gap .5rem, hover `--light-hover-color`.
  - On hover the row splits into the name (1.75rem) over the **user ID** (.75rem monospace, opacity .7).
  - Dark-mode names: `color-mix(in oklab, var(--user-accent, text) 70%, #f8f8f2)`.
  - The screenshot shows plain body-coloured names in light mode.
- **User info:**
  - Padding 1rem. The avatar is a square of `panel width - 4rem`.
  - Display name 1.5rem bold, centred, 4-line clamp. User ID centred in monospace.
  - Sections are separated by 1px `--border-color` rules. Verified text uses `--primary-color-dark`.
- **Pinned / notifications / search** reuse timeline events with no status column and zero horizontal padding.

---

## 9. Pop-ups and modals

### 9.1 Overlay and box (`modal/Lightbox.css:1-42`)
- **Overlay** (`div.overlay`): fixed, `inset: 0`, flex-centred.
  - `.dimmed`: `--dimmed-overlay-background-color` + `backdrop-filter: blur(var(--modal-backdrop-blur)) saturate(115%)`. The browser uses 0px blur and `.75` dim; TAURI uses 20px and `.5`.
- **Box** (`div.modal-box`):
  - `--background-color`, **radius 1rem**, padding 1rem, max `min(80rem, 80vw)` × `min(80rem, 80vh)`, overflow hidden.
  - Full-screen on mobile at ≤30rem.
  - Constraints.md records the modal radius as `.625rem`. The code uses `1rem` for the base box, `14px` for the profile card and `.5rem` for the quick switcher; follow the code.
- **macOS edge idiom**, used for floating panels (quick switcher, disconnected box, update chip) where a solid border would vanish into the warm surface:

  ```
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.18),  /* light hairline ring inside the radius */
              0 0 0 1px rgba(0,0,0,.6),              /* dark seam outside */
              0 18px 40px rgba(0,0,0,.45),
              0 55px 120px rgba(0,0,0,.4),
              0 36px 100px rgba(255,228,132,.06);    /* faint accent underglow */
  ```

  (`QuickSwitcher.css:11-33`). The quick switcher uses a lighter backdrop: `rgba(0,0,0,.12)` + `blur(3px) saturate(105%)`, 48rem wide, 11vh from the top.

### 9.2 The two-column "house" pop-up
Used by the download prompt, upload dialog, profile editor, widget permission prompt and nickname override (`DownloadPrompt.css`, `ProfileEditor.css`).

- **Form:** `width: min(32rem, 80vw)`, flex column, gap 1rem.
- **Body:** grid with a **left visual column** (8rem in the profile editor, 9rem in the download prompt), then `1fr`, gap 1.25rem. It collapses to one column at ≤30rem.
  - **Left:** the picture or object, centred, gap .625rem.
    - Profile editor: a **6rem round avatar button** whose hover shows a "Change" scrim (`rgba(0,0,0,.5)`, white .8125rem/600, opacity transition `.12s`). The user ID sits below at .75rem secondary.
    - Download prompt: a file-type icon (4.5 × 5.625rem) with the name (600) below.
  - **Right:** fields or details.
    - Labels: .8125rem secondary.
    - Inputs: `font: inherit`, padding `.5rem .625rem`, `1px solid var(--border-color)`, **radius .5rem**, base background; border turns `--primary-color` on focus.
    - Notes: .8125rem tertiary.
    - Details: a `dl` grid `max-content 1fr`, gap `.4rem 1rem`, `padding-left: 1.25rem` with a `1px` border-left divider, .875rem; `dt` in tertiary.
- **Button pair** (`div.confirm-buttons`): right-aligned, gap .5rem, each button 600 weight, padding `.55rem 1.1rem`, **radius .375rem**.
  - **Cancel** (ringed ghost): `color: var(--text-color); box-shadow: inset 0 0 0 1px var(--button-hover-color)`; hover or focus-visible `background: var(--light-hover-color)`.
  - **Primary** (filled): `background: var(--primary-color); color: var(--inverted-text-color)`; hover `--primary-color-dark`. That is green in light mode and cream `#f0e2d8` with dark ink in dark mode, as the screenshots show ("Save", "Message").
  - The primary button is **never autofocused** in permission prompts, so pressing Enter can't grant everything.
- A tinted info box appears in the nickname editor (`editor-name-dark.png`): a rounded panel with an info icon. Its CSS lives in `ProfileOverrideEditor.css`, which wasn't read here.

### 9.3 Profile card (`profilecard/ProfileCard.css`), the most representative pop-up
- **Box:**
  - `width: min(46rem, 92vw)`, max height `min(44rem, 88vh)`, padding `0 1.5rem 1.5rem`, **radius 14px**.
  - Border `1px solid color-mix(in srgb, var(--text-color) 32%, var(--background-color))`, stronger than `--border-color` so it holds against the dim.
- **Entrance:** `profile-card-in .16s cubic-bezier(.2,.8,.3,1)` from `opacity 0; translateY(.375rem) scale(.98)`. The scrim fades in from transparent over `.16s ease-out`. Both are off under reduced motion.
- **Sticky header:**
  - Padding `.75rem 0 .5rem`, margin-bottom 1rem, hairline bottom border, base background, z-index 3.
  - Title "User profile" at .875rem/600 secondary.
  - Close button: a **2rem round** button in secondary colour; hover `--light-hover-color` + text colour (`close-hover-light.png`).
  - Some screenshots (`card-dark.png`) show no header. They come from an older build or variant; current CSS has the header.
- **Body:** grid `8.5rem | minmax(0,1fr)`, gap 1.5rem. It stacks at ≤34rem, where the identity column becomes a row.
  - **Identity column:**
    - **7.5rem round avatar** (4.5rem when stacked).
    - Local-time line: .875rem secondary, tabular numbers, the time in bold text colour.
    - Optional "[override]" word: monospace .8125rem in `color-mix(#ffe484 80%, text)`.
  - **Details column**, gap 1rem:
    - Name: **h2 1.625rem/700/-.01em, line-height 1.2**.
    - User ID row: monospace .8125rem secondary, followed by 1.625rem copy buttons (radius .375rem, `--link-text-color`, hover with a 14% tint, `.copied` turns `--primary-color-dark`).
    - Pronouns.
    - Bio: .9375rem, 3-line clamp until opened.
    - **Action row** (flex-wrap, gap .5rem) of `button.card-btn`: inline-flex, gap .375rem, padding `.45rem .8rem`, **radius .375rem**, .875rem/600, ring `inset 0 0 0 1px var(--button-hover-color)`, 1rem icon. `.primary` is filled as in §9.2; `.icon` uses padding `.45rem .5rem`. Order in the screenshots: **Message (primary), Mention, Nickname, Picture, "…"**.
    - **More menu:** absolute below the "…" button, min 14rem, padding .375rem, hairline border, radius 10px, `box-shadow: 0 12px 32px, 0 2px 8px` in the modal shadow colour. Items have padding `.45rem .6rem`, radius .375rem, .875rem text.
    - **Folded rows** (`div.card-row`): grid `7rem | 1fr | auto`, min-height 2.75rem, padding `.4rem .25rem`, hairline bottom border; the list has a hairline top border.
      - Label: .875rem secondary.
      - Summary: .9375rem.
      - Chevron toggle: 1.75rem round, rotates 90° when open (`.15s`).
      - Expandable rows get hover fill. Detail panes indent `7.75rem`.
      - Rows: "Shared rooms" (room chips), "Security" ("Trusted on first use · 6 devices"), "In this room" ("Member · power 0").
    - **Room chips:** pill radius 999px, padding `.15rem .55rem .15rem .2rem`, `--light-hover-color`, .875rem/500, 1.25rem round avatar, max 12rem. The overflow chip "+16" is semisecondary.
- **Icons in the card** are 1.125rem. Stroked "modern" icons are forced to `fill: none`.

### 9.4 Other overlays
- **Lightbox:**
  - Same radius-1rem box with shadow `0 0 1rem`.
  - Toolbar has a bottom border; 2rem buttons at radius .5rem and opacity .75 → 1.
  - The stage background is `--light-hover-color`; rotation transition `.2s`.
  - The lightbox renders above every modal. Prompts opened from it render inside it.
- **Disconnected screen:** a full-window skeleton of the app under `filter: blur(3px)` with an `rgba(0,0,0,.55)` tint. The message box uses the §9.1 edge idiom at .5rem radius. The penguin logomark (4rem) and wordmark sit halfway between the box and the bottom edge (constraints.md; `DisconnectedScreen.css` wasn't read in full).

---

## 10. Loading (`loading/Loading.css`, `loading/index.tsx`)
There are exactly two idioms; spinners are banned and `react-spinners` was removed.

1. **Skeleton**, for when the shape is known.
   - Any element with `.sk` gets:

     ```
     --sk-base: rgba(var(--warm-tint-rgb), .07);
     --sk-highlight: rgba(var(--warm-tint-rgb), .16);
     background-color: var(--sk-base);
     background-image: linear-gradient(90deg, base 0%, base 40%, highlight 50%, base 60%, base 100%);
     background-size: 200% 100%;
     animation: sk-sweep 1.6s linear infinite;   /* background-position 200% 0 → -200% 0 */
     ```

   - Weights: names `.11`, avatars `.09`, body lines `.07`.
   - Shapes: `.sk-line` radius .3125rem (default height .625rem), `.sk-name` radius .375rem (height .75rem), `.sk-avatar` round, `.sk-block` fills its box at radius .5rem, and `.sk-edge` is a 2px bar along a button's bottom edge while it fetches.
   - `SkeletonRow` is a 1.5rem circle plus a name bar, gap .5rem.
   - **Reduced motion:** no animation and no gradient; the flat base fill stays.
   - **Room-list placeholder rows** copy the real row geometry exactly (4rem, the same padding, a 3.5rem lane with a 3rem circle, name bar .75rem at a width cycling 39–69%, preview bar .625rem at 54–88%). There are 12 rows, filling only the space real rooms haven't claimed, with no scrollbar. The width cycle is fixed so the rows don't twitch between renders.
2. **Hairline wait**, for when the shape is unknown.
   - `div.hairline-wait` (`role=status`): a label over a **2px `--hairline-color` rule** (radius 1px), gap .75rem, width 28rem centred, .95rem secondary text, **no animation**.
   - `.compact`: auto width, gap .5rem, small font, tertiary colour.
   - Example label: "Getting the messages around this one".

Pre-app screens (sign-in, verification, connecting) share one bare surface, `div.pre-main.signed-out`, on the chat ground `--chat-surface` with the cool chat palette. The "ECHO" wordmark sits in the traffic-light strip at .95rem/600/.14em uppercase in secondary colour (`index.css:550-596`).

---

## 11. Iconography
- **Two sets** (`learnings/gomuks-frontend-structure.md:8`):
  1. **`icons/modern/`**: hand-authored **outline, Lucide-style** icons on a 24×24 grid, `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap/linejoin="round"`. Used in the sidebar, space rail, room header, section headers, sub-filters, kind glyphs, settings and the profile card.
     - Files: arrow-left, bell, bold, braces, bubble-network, chevron-down, clock, code, door-open, gamepad-2, hash, home, italic, key, layers, layout-grid, link, log-out, messages-square, more-horizontal, palette, pin, search, settings, share-2, sliders-horizontal, strikethrough, user, users.
  2. **`icons/*.svg`**: **filled Material Symbols** (`viewBox 0 -960 960 960`, fill rewritten to `currentColor` by svgr). Used everywhere else: composer tools, send, event hover and context menus, room context menu, search/close/add-circle/mark-read in the room-list header, lightbox, and so on.
- **Rendered sizes:**

  | Size | Where |
  |---|---|
  | 1.75rem | rail glyphs, footer |
  | 1.4375rem | sub-filters |
  | 1.25rem | room-header glyphs in a 2.5rem target; composer tools |
  | 1.5rem | send button; context-menu items |
  | 1.125rem | section icon and chevron; profile-card icons |
  | 1rem | card buttons; send status |
  | .9375rem | room-kind glyph; copy buttons |

  Scaling a stroked 24px icon down also scales its stroke (2px becomes ~1.5px at 1.25rem), which is intentional.
- **Logo:** a low-poly faceted penguin in violets and blues. It is not the gomuks gopher.

---

## 12. Known code/screenshot/doc disagreements and gaps
1. **Room-list default width:** 440px in `MainScreen.tsx:518`, but 400px in the `MainScreen.css:3` fallback and its comment.
2. **Room-list avatar:** the real row uses 2.5rem (the default `img.avatar`, confirmed by the screenshots), but the skeleton draws a 3rem circle.
3. **Glow pill colour:** constraints say `#f5d76e`; the code says `#ffe484`.
4. **Modal radius:** constraints say `.625rem`; the code says 1rem for the base box, 14px for the profile card and .5rem for the quick switcher.
5. **Profile card header:** `card-dark.png` has no "User profile" header strip; `close-hover-light.png` and the current CSS do.
6. **TAURI light mode:** sidebar tints are declared without a dark-mode guard, so the sidebars are dark in light mode too. Inferred from the code; not visually verified.
7. **Light-mode unread colours:** never tuned. Glows and washes are undefined, and the "notified" tier is green, not blue.
8. **No TAURI screenshots:** the floating-pane gaps, vibrancy, traffic-light strip and raised/recessed shadows are specified from code only.
9. **Not pinned down:**
   - The exact hover-menu button set (`menu/EventMenu.tsx`).
   - `ProfileOverrideEditor.css` (the nickname info box).
   - `DisconnectedScreen.css` details.
   - `SettingsView.css`.
   - `QuickSwitcher.css` beyond its box.
   - Emoji picker and autocompleter styling (both use `0 0 1rem` modal shadows).
   - Chroma code-theme colours (served by the backend, not in the repo CSS).
