import { describe, it, expect } from 'vitest';
import { summarise, orphanUrls, buildReport } from './done.js';

const items = [
  { label: 'same source', cluster: { id: 'a', blocks: [{ id: 1, title: 'One' }, { id: 2 }] } },
  { label: 'same source', cluster: { id: 'b', blocks: [{ id: 3 }, { id: 4 }] } },
  { label: 'same source', cluster: { id: 'c', blocks: [{ id: 5 }, { id: 6 }] } },
];
const decisions = {
  a: { status: 'resolved', canonicalId: 1, actions: { 2: 'merge' } },
  b: { status: 'skipped' },
};
const undo = [
  { clusterId: 'a', dupes: [{ id: 2, marked: true, removedFrom: [{ channelTitle: 'X' }, { channelTitle: 'Y' }] }, { id: 9, foreign: true, removedFrom: [{ channelTitle: 'X' }] }] },
  { clusterId: 'old', dupes: [{ id: 7, marked: true, removedFrom: [{}] }] },
];

describe('summarise', () => {
  it('counts groups by status, including ones never reviewed', () => {
    expect(summarise(items, decisions, undo).groups).toEqual({ pending: 1, resolved: 1, skipped: 1 });
  });
  it('totals marks, removed connections and not-yours blocks for this scan only', () => {
    const s = summarise(items, decisions, undo);
    expect(s).toMatchObject({ blocksMarked: 1, connectionsRemoved: 3, notYours: 1 });
  });
  it('ignores stored resolutions whose group was undone or skipped', () => {
    expect(summarise(items, { a: { status: 'pending' } }, undo)).toMatchObject({ blocksMarked: 0, connectionsRemoved: 0 });
  });
  it('counts groups that resolved with problems', () => {
    expect(summarise(items, { a: { status: 'resolved', problems: ['403'] } }, []).withProblems).toBe(1);
  });
});

describe('orphanUrls', () => {
  it('gives an are.na link per block', () => {
    expect(orphanUrls([{ id: 5 }, { id: 8 }])).toEqual(['https://www.are.na/block/5', 'https://www.are.na/block/8']);
  });
});

describe('buildReport', () => {
  it('describes every group, reviewed or not, and tolerates no user', () => {
    const r = buildReport({ now: new Date('2026-10-21T10:00:00Z'), user: null, channels: [{ id: 1, slug: 's', title: 'S', extra: 1 }], detectors: { sourceUrl: true }, items, decisions, summary: {}, orphans: [{ id: 2 }] });
    expect(r.generated_at).toBe('2026-10-21T10:00:00.000Z');
    expect(r.user).toBeNull();
    expect(r.channels).toEqual([{ id: 1, slug: 's', title: 'S' }]);
    expect(r.groups.map(g => g.status)).toEqual(['resolved', 'skipped', 'pending']);
    expect(r.groups[0]).toMatchObject({ canonical: 1, blocks: [{ id: 1, url: 'https://www.are.na/block/1', title: 'One' }, { id: 2, title: null }] });
    expect(r.orphans[0].url).toBe('https://www.are.na/block/2');
  });
});
