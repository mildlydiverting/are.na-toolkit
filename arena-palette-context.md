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
- `currentBlock` global caches the current Are.na block object (has `.id`, `.title`, `.source.url`, `.user.username`, etc.)
- `currentImageEl` caches the loaded HTMLImageElement — also used by PNG export to draw the image onto canvas

**Colour name API:**
- `https://api.color.pizza/v1/` — fetched on every extraction, batched as comma-separated hex values
- Multiple name vocabularies selectable in settings
- Names cached in `currentColorNames` map (`hex.toLowerCase() → name`)
- `requestedHex` field used for lookup (not `hex`) — important gotcha

**CSS system (style.css v1.23):**
- `font-size: 62.5%` on `:root` so `1rem = 10px`
- Colour tokens: `--bg: #8e8e8e`, `--surface: #686868`, `--surface2: #5a5a5a`, `--border: #4a4a4a`, `--text: #000000`, `--muted: #1a1a1a`, `--surface-text: #e8e8e8`, `--input-bg: #e8e8e8`, `--accent: #000000`, `--accent-text: #f0f0f0`
- Fonts: Karla (`--font`, `--font-sans`) for UI; Courier Prime (`--font-mono`) for hex/code output only

---

## What was done in the previous session (2026-04-15)

### PNG export — two new canvas renderers built and signed off

Two standalone HTML test harnesses were built and are working. They need to be integrated into `main.js` as an `exportPng()` replacement. The two files are attached to this chat for reference.

**Bars 2 renderer** (`bars2-renderer.html`) — reference card layout:
- 1200×1200px canvas, transparent background
- Left column: tint/shade grid + bottom palette section
- Right column: image thumbnail (520×950, centre-crop, origin 580,100)
- Export: single PNG (no background toggle needed for bars)

**Dots 1 renderer** (`dots1-renderer.html`) — dot grid layout:
- 1200×1200px canvas, transparent background
- Dots fill l→r, t→b, 10 cols × 9 rows max (90 dots)
- Export: TWO buttons — "transparent" and "with background" (blurred image, 40px blur, 0.6 opacity over white)

Both renderers share:
- Are.na logo SVG (inline Path2D, 65×40px)
- Karla 400 28px for URL text, baseline mid-aligned to logo, nudged -2px
- Logo position: x=100, y=1110 (dots) / x=85, y=1070 (bars)
- URL text: `blockUrl` field (e.g. `are.na/block/15064199`, no https://www.)

### Grid spec — Bars 2

```
Canvas: 1200×1200px
Cell: 50px, gutter: 10px, step: 60px
Double-width cell: 110px, step: 120px
Tint/shade grid origin: (100, 100), 8 cols, max 12 rows

Row layout (each palette colour = one row):
| s3 | s2 | s1 | base·base | t1 | t2 | t3 |
x: 100, 160, 220, 280(double), 400, 460, 520

Bottom section — always at fixed y positions:
Row 1: y=880, Row 2: y=940, Row 3: y=1000

Bottom row layout:
| c01 | c02 | c03 | c04 | smd·smd | svd·svd |
x: 100, 160, 220, 280, 340(double), 460(double)

smd = semantic muted dark, svd = semantic vibrant dark
(rows: dark / mid / light)

Image: 520×950px, origin (580, 100), centre-crop
Logo: 65×40px at (85, 1070)
```

### Grid spec — Dots 1

```
Canvas: 1200×1200px
Grid: 100px cells
Active cols: 1–10 (cols 0 and 11 are empty margins)
Active rows: 1+ (row 0 is empty top margin)
Dot: 60px diameter, centred in cell (20px offset from cell origin)

Dot sequence: for each palette colour → s3, s2, s1, base, t1, t2, t3
Then semantic dots: darkVibrant, vibrant, lightVibrant, darkMuted, muted, lightMuted
Fills l→r, t→b. Max 90 dots (10×9).

Logo: 65×40px at (100, 1110)
```

### Data shape expected by both renderers

```js
{
  blockUrl: 'are.na/block/12345678',   // no protocol, no www
  imageUrl: '...',                      // original image URL for canvas draw

  palette: [                            // up to 12 entries
    {
      base: '#rrggbb',
      shades: ['#dark3', '#dark2', '#dark1'],   // s3→s1, darkest first
      tints:  ['#light1', '#light2', '#light3'] // t1→t3, lightest last
    },
    // ...
  ],

  semantic: {
    darkVibrant:  '#rrggbb',  // may be null
    vibrant:      '#rrggbb',
    lightVibrant: '#rrggbb',
    darkMuted:    '#rrggbb',
    muted:        '#rrggbb',
    lightMuted:   '#rrggbb',
  }
}
```

### What needs doing in this session

1. **Map `currentSwatchData` and friends to the renderer data shape** — the renderers expect `palette[].shades/tints` arrays; need to confirm how tints/shades are currently stored in `main.js` and write the mapping function
2. **Add export UI** to the main tool — a format toggle (dots / bars) and export buttons. Dots gets two buttons (transparent / with background); bars gets one.
3. **Wire `currentBlock`** to `blockUrl` and `imageUrl` fields
4. **Test with real images** — especially blurred background on dots, and centre-crop with portrait/landscape images in bars

### Deferred (not this session)
- Colour sort (hue order) before rendering
- PNG metadata embedding (tEXt/iTXt chunks)
- Cache-bust fix for repeated thumbnail clicks
- `shared/arena-api.js` extraction
- RampenSau tints/shades (set aside — unsatisfactory results)

---

## Working approach

- Iterative, targeted changes — not large rewrites unless necessary
- Version note in file header; changelog as `changelog.md`
- CSS CUBE methodology: https://cube.fyi
- British English
- Karla + Courier Prime (Google Fonts) — already loaded in the tool
- No build step dependencies; Python concat build only
