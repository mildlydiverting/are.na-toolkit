import { describe, it, expect } from 'vitest';
import { buildProcreatePalette } from './procreate.js';
import { fixtureCtx } from './export-fixture.js';

describe('buildProcreatePalette', () => {
  const slots = JSON.parse(buildProcreatePalette(fixtureCtx));

  it('is exactly 30 slots, padded with null', () => {
    expect(slots).toHaveLength(30);
    // 3 base + 2 semantic + 3 × 7 ramp swatches = 26 filled
    expect(slots.filter(Boolean)).toHaveLength(26);
    expect(slots.slice(26).every(s => s === null)).toBe(true);
  });

  it('writes HSB floats between 0 and 1 with full alpha', () => {
    expect(slots[0]).toEqual({ name: '#ff0000 Red (60%)', hue: 0, saturation: 1, brightness: 1, alpha: 1 });
    for (const s of slots.filter(Boolean)) {
      for (const k of ['hue', 'saturation', 'brightness', 'alpha']) {
        expect(s[k]).toBeGreaterThanOrEqual(0);
        expect(s[k]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('puts base colours first, then semantic, then ramps', () => {
    expect(slots[1].name).toBe('#0a141e (30%)');
    expect(slots[3].name).toBe('#ff0000 Vibrant (70%)');
    expect(slots[5].name).toBe('#ffacac Red tint 3');
  });

  it('silently drops anything past 30 (v1.31 behaviour)', () => {
    const many = { ...fixtureCtx, palette: Array.from({ length: 6 }, (_, i) => [i * 40, 100, 50]), proportions: [] };
    const out = JSON.parse(buildProcreatePalette(many));
    expect(out).toHaveLength(30);
    expect(out.every(Boolean)).toBe(true);
  });
});
