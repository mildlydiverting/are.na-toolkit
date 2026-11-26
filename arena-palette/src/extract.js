// extract.js: Color Thief wrapper — base palette, semantic swatches, proportion floor.
import { STORE_DEFAULT_EXTRACT } from './storage.js';

export function qualityValue(q) {
  return q === 'hi' ? 1 : q === 'lo' ? 30 : 10;
}

// ── COLOUR EXTRACTION ────────────────────────────────────────────────────────
// `s` is S.extract: { count, quality, colorSpace, ignoreWhite, minSaturation, … }.
export function extractPalette(imgEl, s = STORE_DEFAULT_EXTRACT) {
  const colors = ColorThief.getPaletteSync(imgEl, {
    colorCount:    s.count,
    quality:       qualityValue(s.quality),
    colorSpace:    s.colorSpace,
    ignoreWhite:   s.ignoreWhite,
    minSaturation: s.minSaturation,
  });
  if (!colors) return [];
  const totalPop = colors.reduce((sum, c) => sum + c.population, 0) || 1;
  return colors.map(c => ({
    rgb:        c.array(),
    proportion: c.population / totalPop
  }));
}

// ── SWATCH EXTRACTION ─────────────────────────────────────────────────────────
export const SWATCH_ROLES = ['Vibrant', 'DarkVibrant', 'LightVibrant', 'Muted', 'DarkMuted', 'LightMuted'];

export function extractSwatches(imgEl) {
  try {
    return ColorThief.getSwatchesSync(imgEl) || {};
  } catch(e) {
    return {};
  }
}

export function swatchProportions(swatchMap, paletteData) {
  const result = [];
  SWATCH_ROLES.forEach(role => {
    const sw = swatchMap[role];
    if (!sw) return;
    const rgb = sw.color.array();
    let best = 0, bestDist = Infinity;
    paletteData.forEach(({ rgb: pr }, i) => {
      const d = (rgb[0]-pr[0])**2 + (rgb[1]-pr[1])**2 + (rgb[2]-pr[2])**2;
      if (d < bestDist) { bestDist = d; best = i; }
    });
    result.push({
      role,
      hex:        rgbToHex(rgb),
      tc:         sw.color.textColor,
      proportion: paletteData[best].proportion,
    });
  });
  return applyFloor(result, 0.05);
}

export function applyFloor(items, minProp) {
  const raw = items.reduce((s, r) => s + r.proportion, 0) || 1;
  items.forEach(r => r.proportion = r.proportion / raw);
  let deficit = 0;
  items.forEach(r => { if (r.proportion < minProp) deficit += minProp - r.proportion; });
  if (deficit > 0) {
    const donors = items.filter(r => r.proportion > minProp);
    const donorTotal = donors.reduce((s, r) => s + r.proportion, 0);
    donors.forEach(r => { r.proportion -= deficit * (r.proportion / donorTotal); });
    items.forEach(r => { if (r.proportion < minProp) r.proportion = minProp; });
  }
  return items;
}
