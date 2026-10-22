import { describe, it, expect, vi } from 'vitest';
import { lookupBlockConnections, lookupAll, addUnscannedPlaces, findConnectionId, connectionSummary } from './connections.js';

const ch = (id) => ({ id, slug: `s${id}`, title: `T${id}` });

describe('lookupBlockConnections', () => {
  it('gets the total, then your own channels across pages', async () => {
    const client = { request: vi.fn(async (path, p) => {
      if (p.filter !== 'OWN') return { meta: { total_count: 7 } };
      return p.page === 1 ? { data: [ch(1)], meta: { has_more_pages: true } } : { data: [ch(2)], meta: { has_more_pages: false } };
    }) };
    const r = await lookupBlockConnections(client, 5, { per: 1 });
    expect(r).toEqual({ total: 7, own: [{ id: 1, slug: 's1', title: 'T1' }, { id: 2, slug: 's2', title: 'T2' }], others: 5 });
  });
});

describe('lookupAll', () => {
  it('looks each block up once and records a failure without stopping', async () => {
    const client = { request: vi.fn(async (path) => { if (path.includes('/2/')) throw Object.assign(new Error('nope'), { status: 500 }); return { data: [], meta: { total_count: 0 } }; }) };
    const out = await lookupAll(client, [{ id: 1 }, { id: 2 }, { id: 1 }]);
    expect([...out.keys()]).toEqual([1, 2]);
    expect(out.get(2)).toEqual({ error: 'nope' });
  });
  it('stops on a 401', async () => {
    const client = { request: async () => { throw Object.assign(new Error('auth'), { status: 401 }); } };
    await expect(lookupAll(client, [{ id: 1 }])).rejects.toThrow('auth');
  });
});

describe('addUnscannedPlaces', () => {
  it('adds only channels the scan did not see, flagged unscanned', () => {
    const clusters = [{ id: 'c', channelIds: [10], blocks: [{ id: 1 }, { id: 2 }], places: { 1: [{ channelId: 10, connectionId: 5 }], 2: [{ channelId: 10, connectionId: 6 }] } }];
    const info = new Map([[1, { own: [ch(10)] }], [2, { own: [ch(10), ch(20)] }]]);
    const [c] = addUnscannedPlaces(clusters, info);
    expect(c.places[1]).toHaveLength(1);
    expect(c.places[2][1]).toMatchObject({ channelId: 20, connectionId: null, unscanned: true, channelTitle: 'T20' });
    expect(c.channelIds).toEqual([10, 20]);
    expect(clusters[0].places[2]).toHaveLength(1);
  });
});

describe('findConnectionId', () => {
  it('pages until the block is found', async () => {
    const client = { request: vi.fn(async (path, p) => p.page === 1 ? { data: [{ id: 9 }], meta: { has_more_pages: true } } : { data: [{ id: 3, connection: { id: 333 } }], meta: { has_more_pages: false } }) };
    expect(await findConnectionId(client, 20, 3)).toBe(333);
  });
  it('returns null when the block is not in the channel', async () => {
    const client = { request: async () => ({ data: [{ id: 9 }], meta: { has_more_pages: false } }) };
    expect(await findConnectionId(client, 20, 3)).toBeNull();
  });
});

describe('connectionSummary', () => {
  it('reads plainly, and has stand-ins for loading and failure', () => {
    expect(connectionSummary({ total: 7, own: [ch(1), ch(2)], others: 5 })).toBe('7 in total: 2 yours, 5 by others');
    expect(connectionSummary(undefined)).toBe('…');
    expect(connectionSummary({ error: 'x' })).toBe('?');
  });
});
