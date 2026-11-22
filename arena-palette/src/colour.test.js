import { describe, it, expect } from 'vitest';
import {
  rgbToHex, hexToRgb, rgbToHsl, hslToRgb, makeTintsShades, textColour, TINT_STEPS, SHADE_STEPS,
} from './colour.js';

describe('hex and RGB', () => {
  it('pads single digits and lower-cases', () => {
    expect(rgbToHex([0, 5, 255])).toBe('#0005ff');
    expect(rgbToHex([171, 205, 239])).toBe('#abcdef');
  });
  it('round-trips', () => {
    expect(hexToRgb('#c8b45a')).toEqual([200, 180, 90]);
    expect(hexToRgb(rgbToHex([1, 2, 3]))).toEqual([1, 2, 3]);
  });
  it('accepts hex without the #', () => {
    expect(hexToRgb('ff0000')).toEqual([255, 0, 0]);
  });
});

describe('HSL', () => {
  it('converts the primaries and greys', () => {
    expect(rgbToHsl([255, 0, 0])).toEqual([0, 100, 50]);
    expect(rgbToHsl([0, 255, 0])).toEqual([120, 100, 50]);
    expect(rgbToHsl([0, 0, 255])).toEqual([240, 100, 50]);
    expect(rgbToHsl([128, 128, 128])).toEqual([0, 0, 50]);
    expect(rgbToHsl([0, 0, 0])).toEqual([0, 0, 0]);
    expect(rgbToHsl([255, 255, 255])).toEqual([0, 0, 100]);
  });
  it('converts back', () => {
    expect(hslToRgb(0, 100, 50)).toEqual([255, 0, 0]);
    expect(hslToRgb(240, 100, 50)).toEqual([0, 0, 255]);
    expect(hslToRgb(0, 0, 50)).toEqual([128, 128, 128]);
  });
  it('round-trips within a rounding step', () => {
    const [r, g, b] = hslToRgb(...rgbToHsl([200, 180, 90]));
    expect(Math.abs(r - 200)).toBeLessThanOrEqual(3);
    expect(Math.abs(g - 180)).toBeLessThanOrEqual(3);
    expect(Math.abs(b - 90)).toBeLessThanOrEqual(3);
  });
});

describe('makeTintsShades', () => {
  it('returns three of each, tints lightest first and shades getting darker', () => {
    expect(TINT_STEPS).toBe(3);
    expect(SHADE_STEPS).toBe(3);
    const { tints, shades } = makeTintsShades([200, 80, 40]);
    expect(tints).toHaveLength(3);
    expect(shades).toHaveLength(3);
    const l = c => rgbToHsl(c)[2];
    const base = l([200, 80, 40]);
    expect(l(tints[0])).toBeGreaterThan(l(tints[1]));
    expect(l(tints[1])).toBeGreaterThan(l(tints[2]));
    expect(l(tints[2])).toBeGreaterThan(base);
    expect(l(shades[0])).toBeLessThan(base);
    expect(l(shades[0])).toBeGreaterThan(l(shades[1]));
    expect(l(shades[1])).toBeGreaterThan(l(shades[2]));
  });
  it('keeps hue and clamps lightness to 5–95', () => {
    const { tints, shades } = makeTintsShades([255, 255, 255]);
    expect(rgbToHsl(tints[0])[2]).toBeLessThanOrEqual(100);
    const dark = makeTintsShades([0, 0, 0]);
    expect(rgbToHsl(dark.shades[2])[2]).toBeGreaterThanOrEqual(0);
    expect(tints.every(c => c.length === 3)).toBe(true);
    expect(shades.every(c => c.length === 3)).toBe(true);
  });
});

describe('textColour', () => {
  it('picks dark text on light colours and light text on dark', () => {
    expect(textColour([250, 250, 250])).toBe('#1a1814');
    expect(textColour([10, 10, 10])).toBe('#f5f3ef');
  });
});
