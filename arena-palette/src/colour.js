// colour.js: pure colour maths — hex/RGB/HSL conversion, HSL tints and shades, text colour.

export const TINT_STEPS = 3;
export const SHADE_STEPS = 3;

// ── COLOUR UTILITIES ──────────────────────────────────────────────────────────
export function rgbToHex([r,g,b]) {
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

// ── HELPER — needed for rgb+hsl and css exports ───────────────────────────────
export function hexToRgb(hex) {
  const h = hex.replace('#','');
  return [
    parseInt(h.slice(0,2),16),
    parseInt(h.slice(2,4),16),
    parseInt(h.slice(4,6),16),
  ];
}

export function rgbToHsl([r,g,b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch(max) {
      case r: h = ((g-b)/d + (g<b?6:0))/6; break;
      case g: h = ((b-r)/d + 2)/6; break;
      case b: h = ((r-g)/d + 4)/6; break;
    }
  }
  return [Math.round(h*360), Math.round(s*100), Math.round(l*100)];
}

export function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h/30) % 12;
  const a = s * Math.min(l, 1-l);
  const f = n => l - a * Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n), 1)));
  return [Math.round(f(0)*255), Math.round(f(8)*255), Math.round(f(4)*255)];
}

export function makeTintsShades(rgb) {
  const [h, s, l] = rgbToHsl(rgb);
  const tints = [], shades = [];
  for (let i = TINT_STEPS; i >= 1; i--) {
    const newL = Math.min(95, l + (i * (95 - l) / (TINT_STEPS + 1)));
    tints.push(hslToRgb(h, s, newL));
  }
  for (let i = 1; i <= SHADE_STEPS; i++) {
    const newL = Math.max(5, l - (i * l / (SHADE_STEPS + 1)));
    shades.push(hslToRgb(h, s, newL));
  }
  return { tints, shades };
}

export function textColour(rgb) {
  const [r,g,b] = rgb;
  const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
  return lum > 0.5 ? '#1a1814' : '#f5f3ef';
}
