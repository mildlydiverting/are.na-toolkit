import { describe, it, expect } from 'vitest';
import { addOrphans, removeOrphans, loadOrphans, pushUndo, dropUndo, loadUndo, UNDO_LIMIT } from './history.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
}
const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
const NOW = new Date('2026-10-21T10:00:00Z');
const dupe = (id, channels = ['Drawing']) => ({ id, removedFrom: channels.map(channelTitle => ({ channelTitle })) });

describe('orphans', () => {
  it('records duplicates with where they were removed from', () => {
    const s = fakeStorage();
    addOrphans(s, 1, [dupe(2, ['Drawing', 'Prints'])], NOW);
    expect(loadOrphans(s)).toEqual([{ id: 2, canonical: 1, resolved_at: NOW.toISOString(), channels_removed_from: ['Drawing', 'Prints'] }]);
  });

  it('replaces an older entry for the same block', () => {
    const s = fakeStorage();
    addOrphans(s, 1, [dupe(2)], NOW);
    addOrphans(s, 9, [dupe(2)], NOW);
    expect(loadOrphans(s).map(o => o.canonical)).toEqual([9]);
  });

  it('removes entries when a resolution is undone', () => {
    const s = fakeStorage();
    addOrphans(s, 1, [dupe(2), dupe(3)], NOW);
    removeOrphans(s, [2]);
    expect(loadOrphans(s).map(o => o.id)).toEqual([3]);
  });

  it('survives corrupt or blocked storage', () => {
    expect(loadOrphans(fakeStorage({ arena_dupefinder_orphans: '{nope' }))).toEqual([]);
    expect(loadOrphans(blocked)).toEqual([]);
    expect(() => addOrphans(blocked, 1, [dupe(2)], NOW)).not.toThrow();
  });
});

describe('undo ring', () => {
  it('keeps only the last 20', () => {
    const s = fakeStorage();
    for (let i = 0; i < UNDO_LIMIT + 5; i++) pushUndo(s, { clusterId: `c${i}` });
    const ids = loadUndo(s).map(e => e.clusterId);
    expect(ids).toHaveLength(UNDO_LIMIT);
    expect(ids[0]).toBe('c5');
  });

  it('drops an entry once it has been undone', () => {
    const s = fakeStorage();
    pushUndo(s, { clusterId: 'a' });
    pushUndo(s, { clusterId: 'b' });
    dropUndo(s, 'a');
    expect(loadUndo(s).map(e => e.clusterId)).toEqual(['b']);
  });
});
