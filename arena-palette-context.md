# arena-palette — context note for new chat

## What we're working on

`arena-palette` is a local single-file HTML tool that fetches images from up to 4 Are.na channels, extracts a colour palette from a selected image, and displays tints/shades plus a semantic palette. It's part of a planned suite of local Are.na browser tools called `are.na-toolkit`, which lives at `~/Development/are.na-toolkit/`.

The repo is public at `https://github.com/mildlydiverting/are.na-toolkit`.

The current built file is `arena-palette.html` (v1.23), located at:
`~/Development/are.na-toolkit/arena-palette/dist/arena-palette.html`

Source files are split into:
- `arena-palette/src/main.js`
- `arena-palette/src/style.css`
- `arena-palette/src/index.html`

Built via `arena-palette/build.py` (Python concat script, no npm).

Companion project: `are.na-picks` (separate public repo, already on GitHub), which shares the same two-step API fetch pattern.

---

## Current file state (v1.23)

**Key dependencies:**
- Color Thief v3 (unpkg CDN) — MMCQ palette + swatch extraction
- JSZip 3.10.1 (cdnjs) — zip export
- Karla + Courier Prime (Google Fonts)

**Architecture — must preserve:**
- Are.na API v3 (`https://api.are.na/v3`). Never v2.
- Image URLs: `image.src` (original), `image.small.src` (thumbnail)
- Two-step random fetch: channel meta for total count → `per=1&page={random}` with up to 12 retries to land on an Image block
- `currentImageEl` caches the loaded `HTMLImageElement` — settings changes call `runExtraction()` directly, never `selectImage()`, so no unnecessary API hits
- Color Thief v3: use `c.array()` for `[r,g,b]`, not `.rgb` or `._r._g._b`
- `applyFloor(items, minProp)` shared helper normalises proportions (1% floor for main bar, 5% for semantic bar)
- `currentSwatchData` global caches the semantic palette (array of `{role, hex, tc, proportion}`) — populated in `runExtraction()` via `swatchProportions()`, used by exports

**Colour name API:**
- `https://api.color.pizza/v1/` — fetched on every extraction, batched as comma-separated hex values
- Multiple name vocabularies selectable in settings (bestOf, japaneseTraditional, sanzoWadaI, wikipedia, werner, ridgway, nbsIscc, thesaurus)
- Names cached in `currentColorNames` map (`hex.toLowerCase() → name`)
- `requestedHex` field used for lookup (not `hex`) — important gotcha
- Names appear in swatch labels and in all exports

**Layout (v1.23 — three-column grid):**
- `grid-template-columns: 24rem 1fr 1fr` — sidebar | image col | palette col
- Responsive: ≤1100px sidebar + stacked cols; ≤600px full stack
- Image: `width:100%; height:auto; max-height:60vh; object-fit:contain`
- `overflow-x:hidden` on body; `min-width:0` on all flex/grid children that need to shrink

**CSS system (style.css v1.23):**
- `font-size: 62.5%` on `:root` so `1rem = 10px`. All sizing in rem. Minimum font size `1.4rem` everywhere.
- Colour tokens: `--bg: #8e8e8e`, `--surface: #686868`, `--surface2: #5a5a5a`, `--border: #4a4a4a`, `--text: #000000`, `--muted: #1a1a1a`, `--surface-text: #e8e8e8`, `--input-bg: #e8e8e8`, `--accent: #000000`, `--accent-text: #f0f0f0`
- Fonts: Karla (`--font`, `--font-sans`) for all UI; Courier Prime (`--font-mono`) for hex/code output only
- No inline styles except dynamic computed values (flex, background, color from palette data)

**Swatch hex reveal:**
- Hex text inside each swatch, colour matches background at rest (invisible)
- On hover/focus, `color` switches to light/dark contrast colour via JS event listeners
- Click copies hex to clipboard

**Image metadata panel:**
- Block title, "view on are.na ↗" link, username link, source URL, date accessed
- Description with show more/less toggle (clamped to 3 lines at rest)

---

## What was done this session (2026-04-14/15)

### Colour naming API integration
- `fetchColorNames()` batches all palette hex values in one API call
- Colour names appear in swatch labels (`01 · #hex · Name · 48%`) and in all exports
- `patchColorLabels()` updates labels in place after async fetch, without re-rendering
- Name vocabulary choosable in extraction settings panel

### Export updates (patch file: `export-functions-patch-v2.js`)
All four text/structured exports updated:

**Shared header block (hex + rgb+hsl):**
```
arena-palette export
Image:  [block title]
Source: https://www.are.na/block/[id]
---
```

**CSS export** — header as comment block at top of file; semantic colours added as a separate `/* semantic palette */` block in `:root` using `--semantic-[role]` custom properties.

**SCP/JSON export** — `sourceUrl` field added; `semanticColors` array added alongside `colors`.

**All exports now include semantic palette colours.** Requires:
1. `let currentSwatchData = [];` global in main.js
2. `currentSwatchData = swatchProportions(swatches, paletteData);` in `runExtraction()`
3. `hexToRgb()` helper (add if not already present)

### PNG export — design exploration (not yet implemented in code)
Two layout directions agreed, to be implemented as `exportPng()` replacement:

**Layout E — image + tint/shade bars:**
- Square canvas, transparent background
- Image fills top ~58%, cropped to width
- Thin semantic colour strip immediately below image
- 7 tint/shade bars below that, one per palette colour, full light→dark ramp, base step 1.6× wider
- No text overlay

**Layout F — image + dot grid:**
- Square canvas, transparent background
- Image full bleed
- 7×N grid of dots overlaid, equally spaced — showing full tint/base/shade ramp per colour (7 cols × rows)
- Semantic colours as a separate final row, visually separated by a faint dashed rule
- No text overlay, no image darkening

Both layouts prototyped as Pillow (Python) scripts for design exploration; final implementation will use HTML Canvas in-browser. Design to be finalised after Photoshop exploration.

**PNG metadata:** PNG tEXt/iTXt chunks to embed Title, Source URL, channel, extraction date — to be added when canvas export is implemented.

**Filename:** `{channel-slug}-{block-id}.png` preferred over sanitised URL slug.

**Colour sorting:** Simple HSL hue sort (no external dependency) to be added before rendering. `colorsort-js` reviewed but not suitable (TypeScript/pnpm, not CDN-friendly).

---

## Known issues / next steps

- PNG export: implement E and F layouts in canvas, replacing current basic export
- PNG export: add colour sort (hue order, light→dark) before rendering
- PNG export: embed PNG metadata (title, source URL)
- Cache-bust fix: repeated thumbnail clicks re-fetch from API (known, not yet fixed)
- Spacing "funkiness" at certain breakpoints — not yet investigated
- RampenSau tints/shades: prototyped, set aside — results unsatisfactory (hue-cycling generator, not exact-colour tint/shade tool)
- `shared/arena-api.js` not yet extracted

---

## Working approach

Kim prefers:
- Iterative, targeted changes — not large rewrites unless necessary
- Version note in file header; changelog as a separate `changelog.md` file
- Screenshots to communicate layout issues
- Understanding the root cause alongside any fix
- Learning as she goes along
- Clean, modular, semantic code; accessible with progressive enhancement
- CSS CUBE methodology: https://cube.fyi
- Atomic design: https://atomicdesign.bradfrost.com/table-of-contents/
- Eleventy / Hugo as SSGs if needed
- GitHub raw URL fetch to share files (repo is public)
- British English
