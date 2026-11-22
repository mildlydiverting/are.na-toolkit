# arena-palette — context note for new chat

*Corrected 22 November 2026 during the v2.0 migration (branch `arena-palette-v2`). Plan: `_notes/arena-palette-notes/arena-palette-v2-build-plan.md`. This file becomes `NOTES.md` when v2.0 ships.*

## What we're working on

`arena-palette` is a local single-file HTML tool that fetches images from up to 4 Are.na channels, extracts a colour palette from a selected image, and displays tints/shades plus a semantic palette. It's part of a planned suite of local Are.na browser tools called `are.na-toolkit`, which lives at `~/Development/are.na-toolkit/`.

The repo is public at `https://github.com/mildlydiverting/are.na-toolkit`.

The current built file is `arena-palette.html` (v1.31), located at:
`~/Development/are.na-toolkit/arena-palette/dist/arena-palette.html`

Source files (ES modules, inlined into one page by `@include` markers in `src/index.html`):
- `arena-palette/src/app.js` (state, DOM wiring, rendering), `parse-input.js`, `colour.js`, `arena-fetch.js`, `names.js`, `storage.js` (not yet wired), `image-cache.js`, `extract.js`
- `arena-palette/src/exports/` — `text.js`, `ase.js`, `procreate.js`, `png.js`
- `arena-palette/src/style.css`, `arena-palette/src/third_party/color-thief.js` (Color Thief 3.5.0, MIT)
- Tests sit beside the code (`*.test.js`; run `npm test` from the repo root)

Built with `node arena-palette/build.js --docs` (`--watch` rebuilds on save). `build.py`, `template.html` and `main.js` were retired in commit 3370224 and are in git history.

---

## Current file state (v1.31)

**Key dependencies:**
- Color Thief 3.5.0, inlined from `src/third_party/` — MMCQ palette + swatch extraction
- (JSZip was loaded but never used; removed)
- Karla + Courier Prime (Google Fonts)

**Architecture — must preserve:**
- USE Are.na API v3 (`https://api.are.na/v3`). NEVER v2.
- Image URLs: `image.src` (original), `image.small.src` (thumbnail)
- Two-step random fetch: channel meta for total count → `per=1&page={random}` with up to 12 retries to land on an Image block
- `currentImageEl` caches the loaded `HTMLImageElement` — settings changes call `runExtraction()` directly, never `selectImage()`, so no unnecessary API hits
- Color Thief v3: use `c.array()` for `[r,g,b]`, not `.rgb` or `._r._g._b`
- `applyFloor(items, minProp)` shared helper normalises proportions (1% floor for bars, 5% for semantic bar)
- `currentSwatchData` global caches the semantic palette (array of `{role, hex, tc, proportion}`) — populated in `runExtraction()` via `swatchProportions()`, used by exports. Declared at module scope.
- `currentBlock` / `currentImageObj` global caches the current Are.na block object (has `.id`, `.title`, `.source.url`, `.user.username`, `.channel`, `.original`, etc.)
- `currentImageEl` caches the loaded HTMLImageElement — also used by PNG export to draw the image onto canvas

### Are.na v3 API — confirmed image fields (from live block response)

`image.blurhash` — present and confirmed in v3
`dominant_color` — not present in v3 (earlier sources claiming this were wrong)
Image variants available: `small`, `medium`, `large`, `square`, `src` (original) — all served from `images.are.na` CDN. Thumbnail URLs are base64-encoded resize parameter objects, not signed paths.

### BlurHash — average colour extraction

https://github.com/woltapp/blurhash

The DC component (digits 2–5 of the blurhash string, 0-indexed) encodes the average colour of the image as a 24-bit sRGB value in base 83. Decodable without the full algorithm — just 4 characters, a base-83 lookup, and a bit-shift.

```js
function blurhashDominantColor(blurhash) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';
  const decode83 = str => [...str].reduce((v, c) => v * 83 + chars.indexOf(c), 0);
  const val = decode83(blurhash.slice(2, 6));
  return [(val >> 16) & 0xff, (val >> 8) & 0xff, val & 0xff]; // [r, g, b]
}
```

### Security / public deployment

Token stored in localStorage under `STORAGE_KEY` alongside channel slugs, via `saveState()`. Settings stored separately under `SETTINGS_KEY`. Safe for public static deployment — each visitor's browser has isolated localStorage.

**Colour name API:**
- `https://api.color.pizza/v1/` — fetched when the colours change, batched as comma-separated hex values (WITHOUT `#`)
- Multiple name vocabularies selectable in settings
- Names are cached in the `currentColorNames` map, keyed **without** the `#`, lower-case (`'ff0000'`). Always look names up with `nameFor(nameMap, hex)` from `names.js`, never by hand. Every requested hex has an entry: the name, or `''` if there is none; no entry (`undefined`) means "not looked up yet" and shows the loading dots.
- `patchColorLabels(paletteData, nameMap)` updates both the colour row labels (`colour-label-N`) and the extracted colours legend items (`[data-hex]`).

**CSS system (style.css):**
- `font-size: 62.5%` on `:root` so `1rem = 10px`
- Colour tokens: `--bg: #8e8e8e`, `--surface: #686868`, `--surface2: #5a5a5a`, `--border: #4a4a4a`, `--text: #000000`, `--muted: #1a1a1a`, `--surface-text: #e8e8e8`, `--surface-muted: #b0b0b0`, `--input-bg: #e8e8e8`, `--accent: #000000`, `--accent-text: #f0f0f0`
- Fonts: Karla (`--font`, `--font-sans`) for UI; Courier Prime (`--font-mono`) for hex/code output only

### Layout — three columns

1. **Sidebar** — channels section (collapsible), token input, fetch button, image thumbnail grid
2. **Image column** — selected image + credit block below
3. **Palette column** — extracted colours bar + legend, semantic palette bar + legend, export buttons, tints/shades rows

### Credit block order (`renderImagePanel`)

title (bold) → description (collapsed, conditional) → source/accessed (conditional) → via [username] (conditional) → "view on are.na ↗" (always, own row)

### Palette column order (`renderAnalysis`)

Settings panel → extracted colours section → semantic palette section → export buttons → tints & shades label → colour rows

### Export functions

All exports use `swatchLabel(hex, name, pct, suffix)` for unified label format: `#hex [Name] [(xx%)] [tint/shade N]`
CSS vars use `cssSlug(name, fallback)` for name-slugged var names (e.g. `--cinnabar-base`, `--cinnabar-tint-3`).
Export order everywhere: 1. Base colours, 2. Semantic palette, 3. Tints & shades

| Button | Function | Format |
|---|---|---|
| export hex | `exportHex` | `.txt` |
| export rgb | `exportRgb` | `-rgb.txt` |
| export hsl | `exportHsl` | `-hsl.txt` |
| export css vars | `exportCss` | `.css` |
| export .color-palette | `exportScp` | JSON |
| export .ase | `exportAse` | binary |
| export .gpl | `exportGpl` | plain text |
| export .palette | `exportProcreatePalette` | JSON, 30 HSB slots |
| png: bars | `exportPngBars` | 1200×1200 PNG |
| png: dots | `exportPngDots(false)` | 1200×1200 PNG |
| png: dots + bg | `exportPngDots(true)` | 1200×1200 PNG |

### PNG renderers (`src/exports/png.js`)

- `buildRendererData()` — maps globals to renderer data shape; reverses tints/shades (Color Thief lightest-first → renderers want darkest-first)
- `renderBars(canvas, data)` — bars layout, transparent background
- `renderDots(canvas, data, withBackground)` — dots layout; blurred bg via multi-pass downscale + ping-pong (3× 40px↔100px)
- `exportSlug()` — strips Are.na hash suffix, appends block id (e.g. `chromatic-block-44858120`)

### Channel input URL parsing

`parseArenaSlug(val)` — extracts slug from full URL (`https://www.are.na/user/channel-slug` → `channel-slug`). Applied on `paste` (immediate transform) and `blur` (normalise if URL was typed).

---

## Session history

### 2026-04-16 — PNG export + renderers (v1.x)

Two renderer test harnesses (`bars2-renderer.html`, `dots1-renderer.html`) integrated into `main.js`. Blurred background implemented via multi-pass downscale + ping-pong (40px floor). Export filenames via `exportSlug()`.

### 2026-05-25 — v1.24–v1.29

**v1.24** — ASE, GPL, Procreate exports (`exportAse`, `exportGpl`, `exportProcreatePalette`, `downloadBinary`)

**v1.25** — Credit block reorder, palette column reorder, tokenHint link colour fix

**v1.26** — `swatchLabel` + `cssSlug` helpers; unified label format across all exports; CSS vars name-slugged; SCP JSON restructured (`palette/semantic/tintsShades`); export order standardised (base → semantic → tints/shades); credit block final order (title → desc → source → via → view on are.na)

**v1.27** — Extracted colours section added (proportion bar + legend with names) between existing bar and semantic section

**v1.28** — `exportRgb` and `exportHsl` split from old `exportRgbHsl` (two separate files: `-rgb.txt`, `-hsl.txt`)

**v1.29** — Duplicate proportion bar removed (single "extracted colours" section remains); colour name lookup key fix (`hex.slice(1)` not `hex` — fixes names not appearing); `patchColorLabels` extended to update extracted colours legend; channel slug overlays removed from thumbnail grid; `parseArenaSlug` added for URL → slug parsing on channel inputs

---

## Deferred / known issues

- **11-image fetch bug** — `GRID_SIZE=12`, `MAX_RETRIES=12` (`arena-fetch.js`). Fetching now goes through the shared throttle (150 ms gap, 429 backoff) and stops on a 429. If a slot exhausts retries (sparse image channel), it silently drops. Quick fix: raise `MAX_RETRIES` to 20–25. Proper fix: track failures and retry from a different channel.
- **Colour sort** — hue-order sort before rendering, not yet implemented
- **PNG metadata** — tEXt/iTXt chunk embedding not implemented
- **`shared/arena-api.js` extraction** — Are.na API calls could be pulled into a shared module for the toolkit
- **Bars renderer background** — currently transparent; intentional for now
- **ASE/GPL/Procreate labelling** — swatch names could be further refined; semantic role names in labels TBD
- **CORS test for PNG export** — verify `canvas.toBlob()` works when served from a real public origin (not just `file://`)
- **Colour names stuck on "…"** — fixed 22 November 2026. Row labels looked names up with the `#`; the map is keyed without it, and re-rendering with unchanged colours skipped the patch step. All lookups now use `nameFor`; unnamed colours and failed lookups end up unnamed rather than loading forever.
- **`.channel-tag` CSS** — two rules remain in style.css after the HTML element was removed in v1.29; harmless dead code, can be cleaned up

---

## Working approach

- Iterative, targeted changes — not large rewrites unless necessary
- Version bump + changelog entry in the `src/index.html` header on each change; project notes in this file
- CSS CUBE methodology: https://cube.fyi
- British English
- Karla + Courier Prime (Google Fonts) — already loaded in the tool
- No npm runtime dependencies; third-party libraries are copied into `src/third_party/` and inlined. Dev tooling (Vitest) is fine
- Ask before making changes to code
