// exports/procreate.js: Procreate .palette export.
import { nameFor } from '../names.js';
import { rgbToHex, hexToRgb } from '../colour.js';
import { swatchLabel, rampLayout, downloadText } from './text.js';

export const PROCREATE_SLOTS = 30;

// How many swatches the file would hold before Procreate's limit: base, then semantic, then ramps.
export function countProcreateSwatches(ctx) {
  return ctx.palette.length + ctx.semantic.length + (ctx.ramps ? ctx.ramps.reduce((n, r) => n + r.steps.length, 0) : 0);
}

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

  // 3. Tints & shades per colour, when ramps are included
  if (ctx.ramps) palette.forEach((rgb, i) => {
    const ramp = ctx.ramps[i];
    if (!ramp) return;
    const name = nameFor(ctx.names, rgbToHex(rgb));
    rampLayout(ramp).forEach(step => swatches.push(makeEntry(hexToRgb(step.hex), swatchLabel(step.hex, name, null, step.label))));
  });

  // Pad or truncate to exactly 30
  const MAX = PROCREATE_SLOTS;
  const trimmed = swatches.slice(0, MAX);
  while (trimmed.length < MAX) trimmed.push(null);

  return JSON.stringify(trimmed, null, 2);
}

export function exportProcreatePalette(ctx) {
  downloadText(buildProcreatePalette(ctx), `${ctx.slug}.palette`);
}
