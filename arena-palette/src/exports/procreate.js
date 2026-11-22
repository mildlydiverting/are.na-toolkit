// exports/procreate.js: Procreate .palette export.
import { nameFor } from '../names.js';
import { rgbToHex, hexToRgb, makeTintsShades, TINT_STEPS } from '../colour.js';
import { swatchLabel, exportContext, exportSlug, downloadText } from './text.js';

// ── EXPORT — Procreate .palette ───────────────────────────────────────────────
export function buildProcreatePalette(ctx) {
  const palette = ctx.palette;
  // Procreate palette JSON: array of up to 30 colour objects
  // Each: { name, hue, saturation, brightness, alpha } — all floats 0–1 (HSB)
  // Unfilled slots must be null

  function rgbToHsb([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return [h, max === 0 ? 0 : d / max, max];
  }

  function makeEntry(rgb, name) {
    const [h, s, b] = rgbToHsb(rgb);
    return { name, hue: h, saturation: s, brightness: b, alpha: 1 };
  }

  const swatches = [];

  // 1. Base colours
  palette.forEach((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = nameFor(ctx.names, hex);
    const pct  = Math.round((ctx.proportions[i] ?? 0) * 100);
    swatches.push(makeEntry(rgb, swatchLabel(hex, name, pct || null)));
  });

  // 2. Semantic palette
  ctx.semantic.forEach(({ role, hex, proportion }) => {
    const pct = Math.round((proportion ?? 0) * 100);
    swatches.push(makeEntry(hexToRgb(hex), swatchLabel(hex, role, pct || null)));
  });

  // 3. Tints & shades per colour
  palette.forEach((rgb) => {
    const hex  = rgbToHex(rgb);
    const name = nameFor(ctx.names, hex);
    const { tints, shades } = makeTintsShades(rgb);

    tints.forEach((c, ti) => {
      const th = rgbToHex(c);
      swatches.push(makeEntry(c, swatchLabel(th, name, null, `tint ${TINT_STEPS - ti}`)));
    });
    swatches.push(makeEntry(rgb, swatchLabel(hex, name)));
    shades.forEach((c, si) => {
      const sh = rgbToHex(c);
      swatches.push(makeEntry(c, swatchLabel(sh, name, null, `shade ${si + 1}`)));
    });
  });

  // Pad or truncate to exactly 30
  const MAX = 30;
  const trimmed = swatches.slice(0, MAX);
  while (trimmed.length < MAX) trimmed.push(null);

  return JSON.stringify(trimmed, null, 2);
}

export function exportProcreatePalette(palette) {
  downloadText(buildProcreatePalette(exportContext(palette)), `${exportSlug()}.palette`);
}
