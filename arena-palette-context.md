# arena-palette — context note for new chat

## What we're working on

`arena-palette` is a local single-file HTML tool that fetches images from up to 4 Are.na channels, extracts a colour palette from a selected image, and displays tints/shades plus a semantic palette. It's part of a planned suite of local Are.na browser tools called `are.na-toolkit`, which lives at `~/Development/are.na-toolkit/`.

The repo is public at `https://github.com/mildlydiverting/are.na-toolkit`.

The current built file is `arena-palette.html` (v1.24), located at:
`~/Development/are.na-toolkit/arena-palette/dist/arena-palette.html`

Source files are split into:
- `arena-palette/src/main.js`
- `arena-palette/src/style.css`
- `arena-palette/src/index.html`

Built via `arena-palette/build.py` (Python concat script, no npm).

---

## Current file state (v1.24)

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
- `currentSwatchData` global caches the semantic palette (array of `{role, hex, tc, proportion}`) — populated in `runExtraction()` via `swatchProportions()`, used by exports. **Now declared at module scope** (was incorrectly inside the `init` IIFE in earlier versions).
- `currentBlock` / `currentImageObj` global caches the current Are.na block object (has `.id`, `.title`, `.source.url`, `.user.username`, `.channel`, `.original`, etc.)
- `currentImageEl` caches the loaded HTMLImageElement — also used by PNG export to draw the image onto canvas

**Colour name API:**
- `https://api.color.pizza/v1/` — fetched on every extraction, batched as comma-separated hex values
- Multiple name vocabularies selectable in settings
- Names cached in `currentColorNames` map (`hex.toLowerCase() → name`)
- `requestedHex` field used for lookup (not `hex`) — important gotcha

**CSS system (style.css v1.24):**
- `font-size: 62.5%` on `:root` so `1rem = 10px`
- Colour tokens: `--bg: #8e8e8e`, `--surface: #686868`, `--surface2: #5a5a5a`, `--border: #4a4a4a`, `--text: #000000`, `--muted: #1a1a1a`, `--surface-text: #e8e8e8`, `--input-bg: #e8e8e8`, `--accent: #000000`, `--accent-text: #f0f0f0`
- Fonts: Karla (`--font`, `--font-sans`) for UI; Courier Prime (`--font-mono`) for hex/code output only

---

## What was done in this session (2026-04-16)

### PNG export — two renderers integrated into main.js

The two standalone renderer test harnesses (`bars2-renderer.html`, `dots1-renderer.html`) from the previous session have been integrated into `main.js`. The old `exportPng` function (simple image + swatch strip) has been removed and replaced.

**New functions in main.js:**

- `buildRendererData()` — maps `currentPalette`, `currentSwatchData`, `currentImageObj` to the renderer data shape. Reverses tints and shades arrays (Color Thief returns tints lightest-first; renderers want darkest-first). Strips protocol/www from `blockUrl`. Reads `currentImageObj.original` for `imageUrl`.
- `drawLogoOnCanvas(ctx, x, y, w, h, colour)` — draws the Are.na logo SVG inline via Path2D
- `drawChrome(ctx, blockUrl, logoX, logoY, logoW, logoH, logoColour, textColour)` — logo + URL text
- `loadImageForCanvas(url)` — Promise-based image loader with crossOrigin
- `renderBars(canvas, data)` — async, 1200×1200, transparent background, bars layout
- `buildDotSequence(palette, semantic)` — flat array of hex strings for dots renderer
- `renderDots(canvas, data, withBackground)` — async, 1200×1200, transparent or blurred-bg
- `triggerCanvasDownload(canvas, filename)` — toBlob → object URL → click
- `exportPngBars()` — wires renderBars to download
- `exportPngDots(withBackground)` — wires renderDots to download

**Export bar UI** — the old single `export png` button is replaced with a grouped cluster:
```
png: | bars | dots | dots + bg |
```
Styled via `.export-png-group`, `.export-png-label`, `.export-png-group .btn-export` in style.css.

**Export filenames** — new `exportSlug()` function:
- Strips the Are.na hash suffix from channel slug (e.g. `chromatic-vwdupl8d0lk` → `chromatic`)
- Regex: `/-(?=[a-z0-9]{7,}$)[a-z0-9]*[0-9][a-z0-9]*$/i` — requires ≥7 chars and at least one digit, so plain English words at end of slug are preserved
- Appends block id: `chromatic-block-44858120`
- Used for all export filenames; `slugName()` kept for the `.color-palette` payload `name` field

### Tints/shades array orientation — verified

`makeTintsShades` returns:
- `tints[0]` = lightest (t3), `tints[2]` = darkest tint (t1) — **lightest first**
- `shades[0]` = lightest shade (s1), `shades[2]` = darkest (s3) — **lightest first**

`buildRendererData()` reverses both arrays so renderers receive:
- `tints: [t1, t2, t3]` — darkest tint first, lightest last
- `shades: [s3, s2, s1]` — darkest shade first

### Blurred background for dots renderer

`css filter: blur()` does not work when applied to a canvas context — it has no effect on `drawImage` operations, only on the canvas element itself as a CSS property. All previous blur attempts (40px, 64px) were silently no-ops.

**Current approach — multi-pass downscale + ping-pong:**

1. Centre-crop source image to square
2. Repeatedly halve down to a **40px floor** (never lower — going below 40px creates a pixel grid too coarse for diagonals, causing staircase artifacts when upscaled)
3. **Ping-pong** 3×: upscale to 100px → downscale to 40px. Each round-trip smears colour boundaries further without going below the safe floor
4. Sample average luminance from the 40px result (standard `0.299R + 0.587G + 0.114B`)
5. Fill base: `#000000` if avgLum < 0.5, `#ffffff` if ≥ 0.5 — keeps dark images dark
6. Upscale via 100px intermediate → stretch to 1200×1200
7. `globalAlpha`: `0.65` for dark images, `0.80` for light — prevents bright hotspots bleeding through on dark-background images

**Tuning levers** (if blur needs adjustment):
- More dissolution: increase ping-pong iterations (3 → 4 or 5)
- Staircase artifacts return: raise the 40px floor, not lower it
- Hotspot bleed on dark images: lower the dark `globalAlpha` (0.65 → 0.50)
- Too much structure surviving: lower ping-pong ceiling (100px → 60px)

---

## Deferred (not this session)

- Colour sort (hue order) before rendering
- PNG metadata embedding (tEXt/iTXt chunks)
- Cache-bust fix for repeated thumbnail clicks
- `shared/arena-api.js` extraction
- RampenSau tints/shades (set aside — unsatisfactory results)
- Bars renderer background (currently transparent — intentional for now)

---

## Working approach

- Iterative, targeted changes — not large rewrites unless necessary
- Version note in file header; changelog as `changelog.md`
- CSS CUBE methodology: https://cube.fyi
- British English
- Karla + Courier Prime (Google Fonts) — already loaded in the tool
- No build step dependencies; Python concat build only
