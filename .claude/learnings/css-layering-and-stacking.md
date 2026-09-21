# CSS Layering and Stacking

## Key Facts
- Paint containment (`contain: strict`) and `overflow: hidden` both clip absolutely-positioned descendants — an element that needs to render a child outside its own box (e.g. a hover tooltip) cannot have that clipping property anywhere in its ancestor chain up to the positioning context.
- A pane that sits flush against a neighbouring pane (no margin between them) and casts an outward drop shadow (e.g. `box-shadow: 6px 0 20px rgba(0,0,0,.3)`) will blur that shadow ONTO the neighbour — this reads as "the neighbour is under this pane," which can be the opposite of the intended visual hierarchy.
- Inset shadows (`box-shadow: inset ...`) are not clipped by the element's own paint containment the way outward shadows can be — they're the reliable half of a "recessed" visual effect when the element also has `contain: strict` or similar.
- An element that is an EARLIER item in a grid/flex layout than its sibling still paints under that sibling by DOM/layout order unless it establishes its own stacking context. A cast shadow meant to fall over a later sibling needs `position: relative` (or similar) plus an explicit `z-index` on the earlier element, or the shadow silently never appears (it's there, but painted underneath).

## Gotchas
- Two selectors of EQUAL CSS specificity are resolved by source order, not intent — a later rule wins even if it's a shorthand that only meant to touch a different property. Concretely: `> div.scope-room_account { padding-left: .5rem }` was being reset to `0` by a LATER `> div.preference { padding: .5rem 0 }` shorthand at equal specificity, because the shorthand implicitly sets `padding-left: 0`. Fix: use the longhand-but-still-shorthand `padding-block` (which doesn't touch `padding-left`/`padding-right`) instead of `padding` when you only mean to set the block axis.
- The same equal-specificity trap applies to `background-color`: a state class (e.g. `.set`) and a structural class (e.g. a column's scope class) competing on `background-color` at equal specificity means whichever comes later in the stylesheet wins outright, with no visual layering. Fix: move the state's styling to `background-image` (e.g. a `linear-gradient`) instead of `background-color` — `background-image` and `background-color` are independent properties and both apply, so the state visually layers over the structural background instead of replacing it.

## Patterns That Work
- When a "which pane is on top" visual bug traces back to a drop shadow crossing onto a neighbour, prefer switching the flush-adjacent pane to an INSET shadow on its own near edge (recess into itself) and giving the pane that should read as "above" a real raise shadow (outward) plus a higher `z-index`. Doing both together (not just one) is what makes the stacking read correctly.
- When debugging "my shadow/pseudo-element isn't visible," check three things in order: (1) is a clipping property (`overflow: hidden`, `contain: strict`) on an ancestor, (2) does the element have its own stacking context (`position` + `z-index`) if a later sibling needs to be painted over, (3) is an equal-specificity rule elsewhere in the stylesheet resetting the property after the fact.
- **Sibling combinator specificity trap:** when a sibling rule (e.g. `div.room-entry:not(.hidden) ~ div.room-entry.active`) has the SAME specificity as a bare rule (e.g. `div.room-entry.active`), the sibling rule is a LATER selector in source order and wins. But the bare rule is more natural to write first (it describes the element itself without context). Fix: write the rule as a compound selector `&.active, &:not(.hidden) ~ &.active` — both branches together will reliably style the active entry whether or not it has a prior sibling. This avoids source-order brittleness and reads as "active in isolation OR active after a visible sibling" (the two cases a list entry needs to handle).

## HttpOnly Cookie Workaround

**Problem:** `document.cookie` cannot read or overwrite `HttpOnly` cookies (a security feature). When the gomuks backend sets an `HttpOnly` session cookie on the `/` path and the frontend later needs to seed an auth cookie on a sub-path (`/_gomuks/auth`), the frontend cannot clear the stale root cookie to prevent interference.

**Gotcha:** an `HttpOnly` cookie from `/` is still sent to requests on `/_gomuks/auth` (all paths under `/` include parent cookies per RFC 6265). If the stale root cookie is set and newer, the browser may prefer it over the sub-path cookie in some contexts, and middleware may see the wrong cookie first.

**Fix:** rely on **path-depth ordering** per RFC 6265 section 5.3.3. The browser sends more-specific paths first (depth-first ordering), so a cookie set on `/_gomuks/auth` is sent in the request list BEFORE the cookie from `/`. Middleware that looks for the auth token via `http.Request.Cookie()` will get the sub-path cookie first and never see the stale root cookie.

**Example:** backend sets `HttpOnly` session cookie on path `/` at login; frontend later needs a fresh auth token on `/_gomuks/auth`. Don't try to clear the root cookie (you can't via document.cookie). Set the sub-path cookie instead; path ordering makes it take precedence.

## Nested CSS `&` Specificity Composition

**Pattern (2026-09-04):** CSS nesting via `&` composes the full parent chain, so specificity includes all ancestor selectors. Example:

```css
div.room-entry {
  &:not(.hidden) ~ &.active {
    /* specificity (0,5,4): two pseudo-classes (:not, implied :active or selectors inside), 
       one class (.active), tag (div) */
  }
  &:not(.hidden) ~ &:not(.hidden) {
    /* Similarly complex specificity from nesting */
  }
}
```

Inside a compound selector (`:not():not(:has())`), the specificity of rules defined inside it gains the ancestor's specificity. This became critical when fixing the room-list uniform colour override, where:
- Resting-rule at (0,5,4) applied 38% accent mix to names, beating the simple override at (0,4,4)
- Solution: nest a copy of the override inside the resting rule, making it (0,6,5), which now beats the old 38% rule

**Room-list uniform override history (2026-09-04):**

1. **0.4.1–0.4.3:** uniform mode was supposed to apply ink names globally, but a specificity bug silently defeated it. The resting-row rule at (0,5,4) (`:not(.hidden) ~ &.active` combined with other selectors) applied a 38% accent mix to `span.event-sender`, which beat the simple global override at (0,4,4). Users on `uniform_room_list_color: false` saw coloured names (per-room accent mix), while `true` users still saw muted names.
2. **Fix applied 2026-09-04:** moved the ink override INSIDE the resting rule via nesting, making it (0,6,5), so it now beats the 38% mix. Verification: tested with both uniform on and off; uniform-on rows now show ink names, uniform-off still shows muted.
3. **Side note:** dark-only by design; light mode inherits text color at .9 (more prominent than before).

## Custom Properties Resolve Where Declared (2026-09-13)

**Pattern:** When a CSS custom property (custom property knob) references another custom property via `var()` on an ancestor, the knob resolves at **declaration time**, not at usage time. If the referenced variable is not set at that ancestor, the knob resolves to the **invalid value** `initial`, and all descendants inherit that invalid value. Example: `.pane { --x: var(--sender-color) }` when `--sender-color` is not set on `.pane` causes all children to inherit `--x: initial`. Names go grey, rings vanish.

**Fix:** declare the knob on the element that **sets** the referenced variable, not an ancestor. Override via specificity if needed: `.pane .ev { --x: var(--sender-color) }` (where `.ev` has `style={{ --sender-color: ... }}`), then `.pane.v-x .ev { --x: someOtherValue }` (more specific descendant selector wins).

**Side note:** related gotcha in mock-up HTML: file:// URLs have no charset, so UTF-8 punctuation (em-dashes, ellipses) mojibake. Use HTML entities (`&#8212;`, `&#8230;`) in artifact HTML instead of literal UTF-8.

## Scoped Custom Properties and Their Fallbacks (2026-09-20)

**Pattern:** A custom property defined at `:root` (e.g., `--inverted-text-color: var(--background-color)`) resolves at declaration time. If another element re-scopes the referenced property (e.g., `div.pre-main.signed-out { --background-color: ... }`), the root-level property still references the old `:root` value — it does NOT automatically follow the scoped override.

**Example:** `div.pre-main.signed-out` re-scopes `--background-color` to a new colour, intending button text to also re-scope via `--inverted-text-color`. But `--inverted-text-color` at `:root` is still `var(--background-color)` = the original root value, so buttons inside the signed-out div read the wrong colour.

**Fix:** Any surface that re-scopes a property used in a fallback chain must **restate both properties together**. Declare them as a pair: `div.pre-main.signed-out { --background-color: ...; --inverted-text-color: ...; }`.

**Class of bug:** Same as the white-on-cream button in 2026-08-25 — a colour-scope mismatch that is invisible until edge-case DOM structure makes it visible. Prevent by restating cascading custom properties whenever a surface overrides a base value.
