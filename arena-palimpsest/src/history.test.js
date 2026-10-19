import { describe, it, expect } from 'vitest';
import { updateHistory, cleanHistory, readJson, writeJson, HISTORY_CAP } from './history.js';

const e = (id) => ({ id, title: `t${id}`, at: '2026-10-19T18:22:00Z' });

describe('updateHistory', () => {
  it('puts the newest first', () => {
    expect(updateHistory([e(1)], e(2)).map((x) => x.id)).toEqual([2, 1]);
  });
  it('moves a repeat lookup to the front without duplicating it', () => {
    expect(updateHistory([e(1), e(2), e(3)], e(3)).map((x) => x.id)).toEqual([3, 1, 2]);
  });
  it('caps the list at 10', () => {
    const full = Array.from({ length: 10 }, (_, i) => e(i + 1));
    const out = updateHistory(full, e(99));
    expect(out).toHaveLength(HISTORY_CAP);
    expect(out[0].id).toBe(99);
    expect(out.at(-1).id).toBe(9);
  });
  it('copes with a missing list', () => {
    expect(updateHistory(undefined, e(1))).toEqual([e(1)]);
  });
});

describe('cleanHistory', () => {
  it('drops entries without a numeric id', () => {
    expect(cleanHistory([e(1), { title: 'x' }, null, { id: 'abc' }]).map((x) => x.id)).toEqual([1]);
  });
  it('returns an empty list for non-arrays', () => {
    expect(cleanHistory('nope')).toEqual([]);
  });
});

describe('json storage', () => {
  const store = () => { const d = {}; return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; } }; };
  it('round-trips', () => {
    const s = store();
    writeJson(s, 'k', [1, 2]);
    expect(readJson(s, 'k', null)).toEqual([1, 2]);
  });
  it('falls back on missing or corrupt values', () => {
    const s = store();
    expect(readJson(s, 'k', 'dflt')).toBe('dflt');
    s.setItem('k', '{broken');
    expect(readJson(s, 'k', 'dflt')).toBe('dflt');
  });
  it('survives blocked storage', () => {
    const blocked = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
    expect(readJson(blocked, 'k', 'dflt')).toBe('dflt');
    expect(() => writeJson(blocked, 'k', 1)).not.toThrow();
  });
});
