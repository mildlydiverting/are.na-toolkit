import { describe, it, expect } from 'vitest';
import { loadSets, saveSet, deleteSet, loadOffenders, addOffenders, pruneIds, SETS_KEY, DEFAULT_DETECTORS } from './scan-sets.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
    removeItem: k => { delete data[k]; },
  };
}

const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

describe('scan sets', () => {
  it('starts empty', () => {
    expect(loadSets(fakeStorage())).toEqual({});
  });

  it('saves and loads a named set with defaults', () => {
    const s = fakeStorage();
    const now = new Date('2026-10-20T10:00:00Z');
    expect(saveSet(s, '  Pinterest imports ', { channelIds: [1, 2] }, now)).toBe('Pinterest imports');
    expect(loadSets(s)['Pinterest imports']).toEqual({
      channelIds: [1, 2], detectors: DEFAULT_DETECTORS, created_at: now.toISOString(), last_run: null,
    });
  });

  it('overwriting keeps the original created_at', () => {
    const s = fakeStorage();
    saveSet(s, 'a', { channelIds: [1] }, new Date('2026-01-01T00:00:00Z'));
    saveSet(s, 'a', { channelIds: [1, 2] }, new Date('2026-02-02T00:00:00Z'));
    expect(loadSets(s).a.channelIds).toEqual([1, 2]);
    expect(loadSets(s).a.created_at).toBe('2026-01-01T00:00:00.000Z');
  });

  it('refuses an empty name', () => {
    const s = fakeStorage();
    expect(saveSet(s, '   ', { channelIds: [1] })).toBeNull();
    expect(loadSets(s)).toEqual({});
  });

  it('deletes a set', () => {
    const s = fakeStorage();
    saveSet(s, 'a', { channelIds: [1] });
    deleteSet(s, 'a');
    expect(loadSets(s)).toEqual({});
  });

  it('survives corrupt or blocked storage', () => {
    expect(loadSets(fakeStorage({ [SETS_KEY]: '{nope' }))).toEqual({});
    expect(loadSets(fakeStorage({ [SETS_KEY]: '[1,2]' }))).toEqual({});
    expect(loadSets(blocked)).toEqual({});
    expect(() => saveSet(blocked, 'a', { channelIds: [1] })).not.toThrow();
  });
});

describe('offenders and pruning', () => {
  it('accumulates offender ids without repeats', () => {
    const s = fakeStorage();
    addOffenders(s, [1, 2]);
    addOffenders(s, [2, 3]);
    expect(loadOffenders(s)).toEqual([1, 2, 3]);
  });

  it('prunes ids that are no longer channels you have', () => {
    expect(pruneIds([1, 2, 3], [{ id: 1 }, { id: 3 }])).toEqual([1, 3]);
  });
});
