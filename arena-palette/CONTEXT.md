# arena-palette: context note for new chat

*Rewritten 26 November 2026 mid-way through the v2.0 migration (branch `arena-palette-v2`). Plan: `_notes/arena-palette-notes/arena-palette-v2-build-plan.md`. This file becomes `NOTES.md` when v2.0 ships.*

## What this is

`arena-palette` is a browser tool that draws images from up to four are.na channels (or single blocks), lets you pick one, extracts a colour palette from it, and exports the result. It is part of `are.na-toolkit` (`~/Development/are.na-toolkit/`, public at <https://github.com/mildlydiverting/are.na-toolkit>).

v2.0 is a **six-step wizard** in the same shape as arena-merge and arena-duplicate-finder: **Source, Pick image, Base palette, Edit, Ramps, Export**. The layout follows the Arena Toolkit design system; none of v1's page layout survives. The live site (`docs/arena-palette.html`) is still v1.31 until v2.0 ships.

## State of the build

| Step | Status |
|---|---|
| 1 Source | Built. Up to four inputs (channel slug, channel link or block link), optional token with "Remember token". Fetch resolves each one. |
| 2 Pick image | Built. Grid of 12 (a pasted block takes one slot, channels share the rest), per-slot Refresh and Lock, Refresh all (keeps locked), credit panel. A lone pasted block skips straight past this step. |
| 3 Base palette | Built. Extraction settings, proportion bar, base swatches with colour names, read-only semantic palette. Click a swatch to copy its hex. |
| 4 Edit | Placeholder. Phase 4. |
| 5 Ramps | Placeholder. Phase 3. |
| 6 Export | Built with v1's formats (hex, RGB, HSL, CSS, ASE, GPL, Procreate, Simple Colour Palette JSON, three PNGs, Copy all hex) and an "Include the semantic palette" tickbox. Tints and shades are always included for now. |

Saved in localStorage: sources, token (only while "Remember token" is ticked), extraction settings, and the theme (Neutral by default). v1's saved values are migrated once. Nothing about the palette itself is saved.

## Files (`arena-palette/src/`, ES modules inlined by `@include` markers in `index.html`)

- `app.js`: the wizard. State lives in one object `S` (sources, token, grid, image, extract, palette, semantic, ramps, export, step, furthest); each step has a `step…()` function that returns its DOM, and `render()` rebuilds the rail and pane. Step 3 redraws only its results panel so the settings controls keep focus.
- `parse-input.js`: `parseSourceInput` (channel / block / invalid) and v1's `parseArenaSlug`
- `arena-fetch.js`: are.na v3 reads: `fetchChannelMeta`, `fetchBlock`, `fetchBlockAtPage`, `fetchChannelImages`, `imageFromBlock`
- `grid.js`: `planGridSlots`, how the 12 slots are shared between sources
- `image-cache.js`: each image loads once
- `extract.js`: Color Thief wrapper (`extractPalette(img, settings)`, `extractSwatches`, `swatchProportions`, `applyFloor`)
- `colour.js`: hex / RGB / HSL conversion, HSL tints and shades, text colour
- `names.js`: color.pizza lookup (`fetchColorNames`, `nameFor`, `nameKey`)
- `storage.js`: keys, `loadPaletteStorage` (with the v1 migration), `savePaletteStorage`
- `escape.js`: `escapeHtml`, `safeUrl`
- `exports/`: `text.js` (hex, RGB, HSL, CSS, SCP, GPL, and `buildExportContext`), `ase.js`, `procreate.js`, `png.js`
- `styles.css`: layout only. `third_party/color-thief.js`: Color Thief 3.5.0 (MIT)
- Tests sit beside the code (`*.test.js`; `npm test` from the repo root)

Top-level names must be unique across all files, because the include resolver inlines them into one script. Build with `node arena-palette/build.js` (`--watch` rebuilds on save, `--docs` also copies to `docs/`). Preview with `python3 -m http.server 8000 --directory arena-palette/dist`.

## What's left (see the plan, section 10)

- **Phase 3, Ramps:** `ramps.js` (OKLCH tone ladders with the extracted colour marked), the Ramps step, `buildExportContext` taking "Base only / Base + ramps".
- **Phase 4:** Edit step (swatch editing, add, remove, reorder, lock), PNG renderers for any ramp length, PNG preview, colour-search links.
- **Phase 5:** breakpoint pass, v2.0 version string and screenshot, README and NOTES.md, update `AGENTS.md`, push.
- Native range sliders are used for two extraction settings because the design system has no Slider; propose one to the artifact before shipping.
- The layout of the extraction settings panel is a "revisit later".

## Architecture facts worth keeping

- Are.na API v3 only (`https://api.are.na/v3`). Never v2.
- Every read goes through the shared throttle (150 ms gap, 429 backoff of 2, 4 and 8 s) via `createArenaClient({ throttle })`; stop on a persistent 429.
- Image URLs: `image.src` (original), `image.small.src` (thumbnail). Colour extraction loads the original with `crossOrigin = 'anonymous'`.
- Random fetch: channel meta for the total count, then `per=1&page={random}` with up to 12 retries to land on an Image block.
- Color Thief v3: use `c.array()` for `[r,g,b]`, not `.rgb` or `._r._g._b`.
- `applyFloor(items, minProp)` normalises proportions (1% floor for the bar, 5% for the semantic roles).
- A palette entry is `{ hex, name, proportion, locked, source }`. `name` is `undefined` until looked up and `''` when color.pizza has no name.
- **Colour names:** `https://api.color.pizza/v1/`, batched as comma-separated hex values without `#`. Maps are keyed lower-case without the `#`; always use `nameFor(nameMap, hex)` and `nameKey(hex)`.
- Exporters take a context from `buildExportContext({ image, palette, semantic })`; builders (`buildHex`, `buildAse`, …) are pure and snapshot-tested. PNG renderers take `buildRendererData({ image, imageEl, palette, semantic })`.
- `exportSlug(image)` strips the are.na hash from the channel slug and adds the block id, e.g. `chromatic-block-44858120`; a pasted block is `block-<id>`.

### Are.na v3 API, confirmed image fields

`image.blurhash` is present in v3. `dominant_color` is not (earlier sources claiming it were wrong). Variants: `small`, `medium`, `large`, `square`, `src` (original), all served from the `images.are.na` CDN. Thumbnail URLs are base64-encoded resize parameter objects, not signed paths.

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

---

## Deferred / known issues

- **Colour sort:** hue-order sort before export, not implemented.
- **PNG metadata:** tEXt/iTXt chunk embedding not implemented.
- **Bars renderer background:** transparent, on purpose for now.
- **ASE / GPL / Procreate labelling:** swatch names could be refined; semantic role names in labels TBD.
- **CORS for PNG export:** some image hosts block cross-origin canvas reads. The Pick step and the PNG export report this; check from a real public origin as well as localhost.
- **`shared/` extraction:** `arena-fetch.js` and `parse-input.js` are ready to move to `shared/api/` the day another tool (picks) needs them.

---

## Working approach

- Iterative, targeted changes, not large rewrites unless necessary.
- Ask before making changes to code. Commit in small steps; never commit `_claude/` or `.claude/`.
- British English in UI copy. CSS CUBE methodology: <https://cube.fyi>.
- No npm runtime dependencies; third-party libraries are copied into `src/third_party/` and inlined. Dev tooling (Vitest) is fine.
