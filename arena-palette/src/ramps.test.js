import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { toneLadder, rampFor, rampsFor, RAMP_DEFAULTS } from './ramps.js';

// culori is a browser global in the built page; load the same vendored file here.
beforeAll(() => {
  const src = readFileSync(new URL('./third_party/culori.min.js', import.meta.url), 'utf8');
  globalThis.culori = (0, eval)(src + ';culori');
});

const hueGap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

describe('toneLadder', () => {
  it('defaults to 7 tones from 0.95 to 0.20, evenly spaced', () => {
    const l = toneLadder();
    expect(l).toHaveLength(7);
    expect(l[0]).toBeCloseTo(0.95);
    expect(l[6]).toBeCloseTo(0.20);
    expect(l[3]).toBeCloseTo(0.575);
    for (let i = 1; i < l.length; i++) expect(l[i - 1] - l[i]).toBeCloseTo(0.125);
  });
  it('honours tone count and clamps', () => {
    expect(toneLadder({ tones: 3, lMax: 0.9, lMin: 0.3 }).map(v => +v.toFixed(3))).toEqual([0.9, 0.6, 0.3]);
  });
  it('gives one tone halfway between the clamps', () => {
    const l = toneLadder({ tones: 1, lMax: 0.9, lMin: 0.3 });
    expect(l).toHaveLength(1);
    expect(l[0]).toBeCloseTo(0.6);
  });
  it('swaps clamps given the wrong way round, and collapses equal ones', () => {
    expect(toneLadder({ tones: 2, lMax: 0.2, lMin: 0.9 })).toEqual([0.9, 0.2]);
    expect(toneLadder({ tones: 3, lMax: 0.5, lMin: 0.5 })).toEqual([0.5, 0.5, 0.5]);
  });
  it('floors fractional tones and never returns fewer than one', () => {
    expect(toneLadder({ tones: 4.9 })).toHaveLength(4);
    expect(toneLadder({ tones: 0 })).toHaveLength(1);
  });
});

describe('rampFor', () => {
  it('returns one hex per tone', () => {
    const r = rampFor('#3b82f6');
    expect(r.steps).toHaveLength(7);
    r.steps.forEach(h => expect(h).toMatch(/^#[0-9a-f]{6}$/));
  });
  it('marks the nearest tone: a dark colour lands at the dark end', () => {
    expect(rampFor('#1a1a2e').markerIndex).toBe(6);
  });
  it('marks the nearest tone: a pale colour lands at the light end', () => {
    expect(rampFor('#f0e6d2').markerIndex).toBe(0);
  });
  it('marks a mid-tone colour in the middle', () => {
    expect(rampFor('#3b82f6').markerIndex).toBe(3);
  });
  it('keeps the base colour verbatim at the marker', () => {
    for (const hex of ['#3b82f6', '#1a1a2e', '#f0e6d2', '#c8b45a']) {
      const r = rampFor(hex);
      expect(r.steps[r.markerIndex]).toBe(hex);
    }
  });
  it('runs light to dark', () => {
    const l = rampFor('#c8b45a').steps.map(h => culori.oklch(h).l);
    for (let i = 1; i < l.length; i++) expect(l[i]).toBeLessThan(l[i - 1]);
  });
  it('keeps every step inside sRGB', () => {
    for (const hex of ['#ff0000', '#00ff88', '#3b82f6', '#ff00aa']) {
      rampFor(hex, { tones: 9 }).steps.forEach(s => expect(culori.displayable(s)).toBe(true));
    }
  });
  it('never raises chroma above the base', () => {
    const base = culori.oklch('#3b82f6').c;
    rampFor('#3b82f6').steps.forEach(s => expect(culori.oklch(s).c).toBeLessThanOrEqual(base + 0.01));
  });
  it('rotates hue, wrapping at 360', () => {
    const h0 = culori.oklch('#3b82f6').h;
    for (const turn of [60, 120, -300]) {
      const r = rampFor('#3b82f6', { hueRotate: turn });
      [2, 4].forEach(i => expect(hueGap(culori.oklch(r.steps[i]).h, (h0 + turn + 360) % 360)).toBeLessThan(4));
    }
  });
  it('applies hue drift to tints and shades, not the marker', () => {
    const h0 = culori.oklch('#3b82f6').h;
    const r = rampFor('#3b82f6', { hueDrift: { tint: 60, shade: -60 } });
    expect(r.steps[r.markerIndex]).toBe('#3b82f6');
    expect(hueGap(culori.oklch(r.steps[0]).h, h0)).toBeGreaterThan(5);
    expect(hueGap(culori.oklch(r.steps[6]).h, h0)).toBeGreaterThan(5);
  });
  it('handles greys (no hue) without NaN', () => {
    const r = rampFor('#808080');
    r.steps.forEach(h => expect(h).toMatch(/^#[0-9a-f]{6}$/));
  });
  it('handles a single tone: the base itself', () => {
    expect(rampFor('#c8b45a', { tones: 1 })).toEqual({ steps: ['#c8b45a'], markerIndex: 0 });
  });
  it('uses the exported defaults', () => {
    expect(RAMP_DEFAULTS).toMatchObject({ tones: 7, lMax: 0.95, lMin: 0.2, hueRotate: 0 });
  });
});

describe('rampsFor', () => {
  it('makes one ramp per palette colour, in order', () => {
    const pal = [{ hex: '#3b82f6' }, { hex: '#c8b45a' }];
    const out = rampsFor(pal, { tones: 5 });
    expect(out).toHaveLength(2);
    out.forEach((r, i) => expect(r.steps[r.markerIndex]).toBe(pal[i].hex));
    expect(out[0].steps).toHaveLength(5);
  });
  it('returns an empty list for an empty palette', () => {
    expect(rampsFor([])).toEqual([]);
  });
});
