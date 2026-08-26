# echo design sources

Brand assets for the **echo** app mark: a low-poly, faceted penguin.

## Files

- `echo-penguin-facet.svg` — vector source of the mark. A single silhouette path
  (`#outline`) filled with flat-shaded triangles clipped to it. Edit this file
  when the mark itself changes; everything else is derived from it.
- `echo-icon-facet-split.svg` — the shipping app-icon composition: the mark on
  the "Facet Split" backing (two deep violets split on a corner-to-corner
  diagonal; chosen 2026-08-26 from the echo Icon Backings comparison page).
  Full-bleed unmasked square — macOS applies the squircle mask itself.
- `echo-icon-facet-split.png` — 1024×1024 full-bleed render of the above (via
  `qlmanage -t -s 1024 -o <outdir> echo-icon-facet-split.svg`). Input for a
  future Icon Composer `.icon` package (the OS masks that path itself).
- `echo-icon-facet-split-squircle.svg` / `.png` — the same composition
  pre-masked into the Apple icon-grid squircle (824px rounded rect, r=185,
  100px transparent margin). **This PNG is the input to `npx tauri icon`**,
  which regenerates `web/src-tauri/icons/`. Classic `.icns` icons are NOT
  masked by macOS (verified 2026-08-26: a full-bleed square shows raw in the
  dock), so the shape must be baked in for the icns path.
- `echo-icon-facet-split-backing.png` / `echo-icon-penguin-positioned.png` —
  the two Icon Composer layers (full-bleed backing; transparent penguin,
  pre-positioned via Pillow from echo-penguin-layer.png — qlmanage bakes a
  white background into transparent-SVG renders, so don't rasterize the
  penguin that way). These were composed in Icon Composer (both layers
  glass: true, penguin scale 1.15) and saved as
  `web/src-tauri/icons/echo.icon`, which is the macOS 26 Liquid Glass icon
  the build compiles via actool. PNG layers only — an SVG layer crashes
  actool. The squircle-masked `.icns` remains the fallback for older macOS.
- `echo-penguin-layer.png` — 1024×1024 transparent RGBA render of the SVG.
  This is the input for both icon pipelines:
  - `npx tauri icon ../design/echo-penguin-layer.png` (run from `web/`)
    regenerates the classic icon set in `web/src-tauri/icons/`
    (`.icns`, `.ico`, and the PNG ladder).
  - It is also the layer image dropped into Icon Composer for the Liquid Glass
    `.icon` package used on macOS 26+.

  The render is a full-bleed transparent mark with no plate or background —
  that is intended. Both pipelines supply their own backing.

## Palette

Facets are flat-shaded from two ramps:

- **Violets** (body): `#A78BFA` → `#8B5CF6` → `#7C3AED` → `#6D28D9` → `#5B21B6` → `#4C1D95`
- **Blues** (belly, beak, shadow): `#BFDBFE` → `#93C5FD` → `#60A5FA` → `#3B82F6` → `#2F7CF6` → `#2563EB`

The silhouette fill is `#5B21B6`, so any unclipped edge reads as mid-violet.
