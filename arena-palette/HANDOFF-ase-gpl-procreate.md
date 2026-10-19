# Handoff: arena-palette — Add ASE, GPL, and Procreate .palette export

## Context
- **Repo**: https://github.com/mildlydiverting/are.na-toolkit
- **File(s) being worked on**: `arena-palette/src/main.js`, `arena-palette/src/index.html` (export bar only)
- **Current version**: v1.24 — next version should be v1.25

## What we built last session

Designed and wrote three new swatch export functions (`exportAse`, `exportGpl`, `exportProcreatePalette`) plus a `downloadBinary` helper. The code was planned and written in chat but **has not yet been applied to the source files** — the next agent needs to paste the changes in, rebuild, and test.

## What to do this session

Apply the four changes below to `main.js` and the export bar HTML, then rebuild with `build.py` and test all three exports in the browser.

---

### Change 1 — add `downloadBinary` helper

Insert immediately after `downloadText` (around line 891):

```js
function downloadBinary(buffer, filename) {
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
```

### Change 2 — add three export functions

Insert after `exportScp` and before the `// ── PNG RENDERER` section. Full function bodies are in the chat above. Functions are:

- `exportAse(palette)` — binary ASE, RGB float32, grouped by palette colour (tints → base → shades), with a final Semantic palette group. Swatch names: `Name — #hex — XX%` for base colours; `Name tint N` / `Name shade N` for derivatives. Uses `downloadBinary`.
- `exportGpl(palette)` — plain text GIMP palette. Tab-separated `R G B name` rows. Section comments for each colour group and semantic palette. Uses `downloadText`.
- `exportProcreatePalette(palette)` — JSON array of exactly 30 slots (null-padded). Each entry: `{ name, hue, saturation, brightness, alpha }` in HSB 0–1 floats. Truncates silently at 30 if palette + tints/shades + semantic exceeds that. Uses `downloadText`.

### Change 3 — add buttons to export bar HTML

In `renderAnalysis`, after the `expScp` button line, add:

```html
<button class="btn-export" id="expAse"     aria-label="Export Adobe Swatch Exchange file">export .ase</button>
<button class="btn-export" id="expGpl"     aria-label="Export GIMP palette file">export .gpl</button>
<button class="btn-export" id="expPalette" aria-label="Export Procreate palette file">export .palette</button>
```

### Change 4 — wire event listeners

In the listener block (around line 875), add after the `expScp` listener:

```js
document.getElementById('expAse').addEventListener('click',     () => exportAse(palette));
document.getElementById('expGpl').addEventListener('click',     () => exportGpl(palette));
document.getElementById('expPalette').addEventListener('click', () => exportProcreatePalette(palette));
```

---

## Technical constraints and decisions

- **No npm** — vanilla JS, Python concat build only (`build.py`)
- **ASE spec**: magic `ASEF`, big-endian throughout, block types `0x0001` (colour), `0xC001` (group start), `0xC002` (group end). Colour model is `RGB ` (4 bytes with trailing space — this is correct per spec). Colour type byte `0x0000` = global.
- **ASE group nesting**: spec supports nesting but Illustrator/Photoshop only honour one level — all groups are flat top-level
- **ASE swatch naming**: `colourTitle`-style — colour name from `currentColorNames` if available, otherwise hex. Format: `Name — #hex — XX%` for base; no percentage for tints/shades
- **GPL columns hint**: set to `1 + TINT_STEPS + SHADE_STEPS` (currently 7)
- **Procreate .palette format**: underdocumented, community reverse-engineered. Confirmed working in Procreate 5.x+. Must be exactly 30 slots; unfilled = `null`. Values are HSB (not HSL), 0–1 floats
- **`currentPalette[i].proportion`** is used for percentage in ASE/GPL — this is the float from `paletteData`, same as used by other exports
- **`currentColorNames`** map is keyed by `hex.toLowerCase()` (no `#`) — same lookup pattern as `exportCss`
- **`currentSwatchData`** fields used: `role`, `hex`, `proportion` — same as existing exports
- `TINT_STEPS` and `SHADE_STEPS` are both `3` (constants at top of file)

## Known issues / deferred things

- Procreate 30-slot truncation is silent — if 4 colours × 7 swatches = 28 + semantic swatches exceed 30, the last semantic entries are dropped. Could add a console warning
- `.palette` format should be tested in Procreate — open to adjustment if the HSB values are off
- ASE should be tested in Illustrator and Affinity Designer — group display may vary by app
- CLR (Apple colour list) is **not implemented** — not feasible in-browser without native tooling. If needed later, the GPL export can be converted to CLR via third-party tools

## Files to attach

- [x] `arena-palette/src/main.js` (v1.24 — the one to modify)
- [ ] `arena-palette/src/index.html` (only needed if build.py requires it separately — check build script)
- [ ] `arena-palette/src/style.css` (no changes needed this session)

---
*Template: ~/Development/are.na-toolkit/handoff-template.md*