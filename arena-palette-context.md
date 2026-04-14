# arena-palette — handoff note
## Current version: v1.23

---

## What this tool is

A local single-file HTML tool that fetches images from up to 4 Are.na channels, extracts a colour palette from a selected image, and displays tints/shades, a semantic palette, and colour proportions. Exports in multiple formats. No server, no build step to run it — just open the HTML file in a browser.

The tool lives at:
`~/Development/are.na-toolkit/arena-palette/dist/arena-palette.html`

Source files are split and built with a Python script:
```
arena-palette/
  src/
    template.html   ← HTML shell with <!-- INJECT:CSS --> and <!-- INJECT:JS --> markers
    style.css       ← all styles
    main.js         ← all JavaScript
  dist/
    arena-palette.html  ← built output (do not edit directly)
  build.py          ← concatenation script
```

To rebuild after editing src files:
```zsh
cd ~/Development/are.na-toolkit
python3 arena-palette/build.py
```

GitHub repo: https://github.com/mildlydiverting/are.na-toolkit

---

## Architecture — must preserve

### Are.na API
- Always use `https://api.are.na/v3` — never v2
- Image URLs: `image.src` (original), `image.small.src` (thumbnail)
- Two-step random fetch: channel metadata for total count → `per=1&page={random}` with up to 12 retries to land on an Image block
- Block data captured per image: `title`, `description` (object with `.plain`/`.html`/`.markdown` — extract `.plain`), `source.url`, `source.title`, `user.full_name` (falls back to `user.slug`), `created_at`, `id`, `blockUrl`

### Color Thief v3 (unpkg CDN, UMD build)
- `c.array()` returns `[r,g,b]` — the correct public API
- `.rgb` returns a CSS string, `._r/_g/_b` are private — don't use either
- `ColorThief.getPaletteSync(imgEl, options)` for palette
- `ColorThief.getSwatchesSync(imgEl)` for semantic swatches

### Colour naming — api.color.pizza
- Endpoint: `https://api.color.pizza/v1/?values={hex,...}&list={listKey}`
- Send hex values without `#`, comma-separated
- Response: `colors[].requestedHex` (exact input hex) and `colors[].name` — use `requestedHex` as the map key, NOT `colors[].hex` (which is the nearest match, not the input)
- Called as a single batch after palette extraction; result cached in `currentColorNames` (hex → name map)
- Re-fetches only when palette hexes or name list changes (fingerprinted in `lastNamedHexKey`)
- Never throws — returns empty map on failure

### Image/extraction separation
- `selectImage(idx)` loads the image and calls `runExtraction()`
- `runExtraction()` is `async` — extracts palette, renders immediately with `…` name placeholders, then patches names in via `patchColorLabels()` once API responds
- Settings changes call `runExtraction()` directly (reuses `currentImageEl`) — never re-fetch from Are.na
- `currentImageEl` is cached; `currentColorNames` and `lastNamedHexKey` track naming state

### `applyFloor` helper
- Shared between proportion bar (1% floor) and semantic bar (5% floor)
- Normalises proportions so no segment falls below the minimum

### localStorage keys
- Channel config: `arena-palette-v1`
- Extraction settings: `arena-palette-settings-v1`

---

## Layout — three columns

```
| col 1: sidebar (24rem fixed) | col 2: image (1fr) | col 3: palette (1fr) |
```

- CSS grid: `grid-template-columns: 24rem 1fr 1fr`
- No top header bar — `h1` branding lives at top of sidebar on dark background
- `h1` (sidebar): `font-size: 1.8rem`, `font-weight: 700`, `color: var(--surface-text)`
- `h2` (col headings): `font-size: 1.8rem`, `font-weight: 300`, `text-transform: uppercase`, truncated to single line with ellipsis
- Image col `h2` starts as "Select an image", fades (150ms opacity transition) to block title on selection
- Responsive: ≤1100px → sidebar + stacked cols (image then palette); ≤600px → full stack

### Sidebar
- `h1` + version number at top
- Channels section: collapsible (`aria-expanded`), open by default, auto-closes when `renderImageGrid()` fires
- Below channels: thumbnail grid (12 images, distributed evenly across channels)

### Image column (`#imageArea`)
- `padding: 1.5rem`, `overflow-y: auto`
- Image fills width, `max-height: 60vh`
- Metadata below image: title (bold), are.na link + "via [userName]", source title + accessed date, description (3-line clamp, show more/less toggle)
- `description` field from API is an object — always extract `.plain` first

### Palette column (`#analysisArea`)
- `padding: 1.5rem`, `overflow-y: auto`
- Contains: extraction settings panel (collapsible), proportion bar, tints & shades rows, semantic palette, export bar

---

## Colour system

```css
--bg:            #8e8e8e;   /* page background — black text, 5.74:1 AA */
--surface:       #686868;   /* sidebar — light text, 4.54:1 AA */
--surface2:      #5a5a5a;   /* settings body — light text, 5.36:1 AA */
--border:        #4a4a4a;   /* borders on interactive elements only */
--text:          #000000;   /* primary text on bg */
--muted:         #1a1a1a;   /* secondary text on bg */
--surface-text:  #e8e8e8;   /* text on dark surfaces */
--surface-muted: #b0b0b0;   /* secondary text on dark surfaces */
--input-bg:      #e8e8e8;   /* form field backgrounds */
--input-text:    #000000;   /* text in fields */
--accent:        #000000;   /* primary button background */
--accent-text:   #f0f0f0;   /* primary button text */
```

**Important:** borders are only used on interactive elements (inputs, buttons, settings panels, thumbnail selection ring, placeholder cells). No borders between page sections/columns.

---

## Button hierarchy

- **Primary** (`.btn-fetch`): dark fill, light text, bold — fetch images only
- **Secondary** (`.btn-export`, `.btn-icon`): transparent, dark border, dark text; hover → dark fill
- **Ghost** (`.btn-add`): dashed border — add channel (optional/additive action)

---

## Extraction settings (persisted to localStorage)

| Setting | Default | Notes |
|---|---|---|
| `colorCount` | 7 | 4–12 |
| `quality` | `'med'` | `'hi'`=1, `'med'`=10, `'lo'`=30 (passed to Color Thief) |
| `colorSpace` | `'oklch'` | `'oklch'` or `'rgb'` |
| `ignoreWhite` | `true` | |
| `minSaturation` | `0` | 0–0.5 |
| `nameList` | `'bestOf'` | See NAME_LISTS below |

### Name lists available
`bestOf`, `japaneseTraditional`, `sanzoWadaI`, `wikipedia`, `werner`, `ridgway`, `nbsIscc`, `thesaurus`

---

## Colour row label format

```
01 · #3a2f1e · Walnut Brown · 12%
```

- Number padded to 2 digits
- Hex in `.colour-hex` (monospace)
- Name in `.colour-name` (font-weight: 500, no italic)
- Loading state: `.colour-name-loading` (opacity 0.4)
- Labels have `id="colour-label-{i}"` so `patchColorLabels()` can update them in place without full re-render

---

## Exports (all include colour name where available)

Format: `Colour N — #hex — Name` (falls back to `Colour N — #hex` if name not loaded)

- **export hex** → `.txt` — hex values for all tints/shades, name in comment header
- **export rgb + hsl** → `.txt` — full values per step, name in section header
- **export css vars** → `.css` — `:root {}` block, name as comment on base var
- **export .color-palette** → JSON (Simple Color Palette format), name in `name` field
- **export png** → canvas render of image + swatch rows; base swatch shows name if available

---

## Known deferred work / TODOs

- **`?t=` cache-bust fix**: repeated clicks on the same thumbnail add a new timestamp to the URL each time, causing unnecessary re-fetches from Are.na. Flagged but not yet fixed.
- **Light/dark mode toggle**: colour system is designed to support this but toggle not yet implemented. The grey bg is intentional — neutral ground for colour judgement.
- **RampenSau integration**: prototyped, set aside. It's a hue-cycling ramp generator, not a tints/shades-of-exact-colour tool — results weren't satisfactory.
- **PNG export redesign**: currently functional but basic. Worth revisiting once light/dark modes are in place.

---

## Dependencies (all CDN, no npm)

```html
<script src="https://unpkg.com/colorthief@3/dist/umd/color-thief.global.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<!-- Google Fonts: Karla (UI) + Courier Prime (mono/hex output) -->
```

---

## Working approach

- Kim prefers targeted changes over large rewrites — always make the minimum change needed
- Always explain root cause alongside any fix
- Version comments in file headers; changelog entries in `template.html`
- Bump version in both `template.html` comment block AND the `<span class="version">` in the HTML body
- No inline styles in HTML or JS except for dynamic computed values (`flex`, `background`, `color` from palette data) — these must remain inline
- CSS classes for all layout/spacing/typography concerns
- `style.css` uses `/* ── v1.xx ── */` version comment at top
- `font-size: 62.5%` on `:root` so `1rem = 10px` throughout
- Minimum font size: `1.4rem` (14px) everywhere
- Test cautiously — Kim will build and test before confirming changes work
