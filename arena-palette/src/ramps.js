// ramps.js: pure tone ramps in OKLCH. Needs the global `culori` (vendored, inlined before this file).
// Each ramp keeps a colour's hue and chroma, steps its lightness from light to dark, and pulls chroma back
// into sRGB at every step. The extracted colour is kept verbatim at its own position.

export const RAMP_DEFAULTS = { tones: 7, lMax: 0.95, lMin: 0.20, hueRotate: 0, hueDrift: null };

// Evenly spaced lightness values, light to dark. Tolerant of odd input: tones is floored and at least 1,
// and lMax/lMin are swapped if the wrong way round (a single tone sits halfway).
export function toneLadder({ tones = RAMP_DEFAULTS.tones, lMax = RAMP_DEFAULTS.lMax, lMin = RAMP_DEFAULTS.lMin } = {}) {
  const n = Math.max(1, Math.floor(tones));
  const hi = Math.max(lMax, lMin), lo = Math.min(lMax, lMin);
  if (n === 1) return [(hi + lo) / 2];
  const step = (hi - lo) / (n - 1);
  // the last tone is exactly the dark clamp, not hi minus accumulated rounding
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? lo : hi - step * i));
}

// Hue drift in degrees per 1.0 of lightness, signed: tint applies above the base's lightness, shade below.
function rampDrift(l, baseL, drift) {
  if (!drift) return 0;
  return l > baseL ? (drift.tint || 0) * (l - baseL) : (drift.shade || 0) * (baseL - l);
}

const wrapHue = h => ((h % 360) + 360) % 360;

// One ramp for one colour → { steps: [hex…], markerIndex }
export function rampFor(baseHex, opts = {}) {
  const o = { ...RAMP_DEFAULTS, ...opts };
  const base = culori.oklch(baseHex);
  const baseH = base.h === undefined ? 0 : base.h; // greys have no hue
  const ladder = toneLadder(o);

  let markerIndex = 0;
  ladder.forEach((l, i) => {
    if (Math.abs(l - base.l) < Math.abs(ladder[markerIndex] - base.l)) markerIndex = i;
  });

  const steps = ladder.map(l => {
    const h = wrapHue(baseH + o.hueRotate + rampDrift(l, base.l, o.hueDrift));
    const clamped = culori.clampChroma({ mode: 'oklch', l, c: base.c, h }, 'oklch');
    return culori.formatHex(clamped);
  });
  steps[markerIndex] = culori.formatHex(baseHex);
  return { steps, markerIndex };
}

export function rampsFor(palette, opts = {}) {
  return palette.map(c => rampFor(c.hex, opts));
}
