import { describe, it, expect, vi } from 'vitest';
import { scanChannels, buildClusters, splitClusters, createScanControl } from './scan.js';

const D = { sourceUrl: true, descriptionUrls: true, skipMarked: true };
const img = (id, url, connId, extra = {}) => ({ id, type: 'Image', source: { url }, connection: { id: connId }, created_at: `2026-01-0${id % 9 + 1}`, ...extra });
const page = (data, more = false) => ({ data, meta: { has_more_pages: more } });

// A fake client whose request() serves per-channel page lists.
function fakeClient(channelPages) {
  return {
    request: vi.fn(async (path, { page }) => {
      const id = Number(path.match(/channels\/(\d+)\//)[1]);
      const pages = channelPages[id];
      if (pages instanceof Error) throw pages;
      return pages[page - 1];
    }),
  };
}
const ch = (id, slug = `ch${id}`) => ({ id, slug, title: `Channel ${id}` });
const apiError = (status) => Object.assign(new Error(`status ${status}`), { status });

describe('scanChannels', () => {
  it('finds a duplicate within one channel and records connection ids', async () => {
    const client = fakeClient({ 1: [page([img(10, 'https://x.com/a', 501), img(11, 'https://www.x.com/a/', 502), img(12, 'https://x.com/b', 503)])] });
    const out = await scanChannels({ client, channels: [ch(1)], detectors: D });
    expect(out.blocksFetched).toBe(3);
    expect(out.clusters).toHaveLength(1);
    const c = out.clusters[0];
    expect(c.scope).toBe('single');
    expect(c.blocks.map(b => b.id)).toEqual([10, 11]);
    expect(c.places[11]).toEqual([{ channelId: 1, channelSlug: 'ch1', channelTitle: 'Channel 1', connectionId: 502 }]);
  });

  it('treats one block in two channels as one block with two places, not a duplicate', async () => {
    const client = fakeClient({ 1: [page([img(10, 'https://x.com/a', 501)])], 2: [page([img(10, 'https://x.com/a', 601)])] });
    const out = await scanChannels({ client, channels: [ch(1), ch(2)], detectors: D });
    expect(out.uniqueBlocks).toBe(1);
    expect(out.clusters).toEqual([]);
  });

  it('finds duplicates across channels and keeps every place', async () => {
    const client = fakeClient({ 1: [page([img(10, 'https://x.com/a', 501)])], 2: [page([img(11, 'https://x.com/a', 601), img(10, 'https://x.com/a', 602)])] });
    const out = await scanChannels({ client, channels: [ch(1), ch(2)], detectors: D });
    expect(out.clusters).toHaveLength(1);
    expect(out.clusters[0].scope).toBe('cross');
    expect(out.clusters[0].places[10].map(p => p.connectionId)).toEqual([501, 602]);
  });

  it('follows pagination and ignores channels nested in the contents', async () => {
    const client = fakeClient({ 1: [page([img(10, 'https://x.com/a', 1), { id: 99, type: 'Channel' }], true), page([img(11, 'https://x.com/a', 2)])] });
    const out = await scanChannels({ client, channels: [ch(1)], detectors: D });
    expect(client.request).toHaveBeenCalledTimes(2);
    expect(client.request.mock.calls[1][1]).toEqual({ page: 2, per: 100 });
    expect(out.blocksFetched).toBe(2);
    expect(out.clusters).toHaveLength(1);
  });

  it('skips an unreadable channel and carries on', async () => {
    const client = fakeClient({ 1: apiError(403), 2: [page([img(10, 'https://x.com/a', 1)])] });
    const out = await scanChannels({ client, channels: [ch(1), ch(2)], detectors: D });
    expect(out.skipped.map(s => s.channel.id)).toEqual([1]);
    expect(out.uniqueBlocks).toBe(1);
  });

  it('throws on errors that mean the scan cannot continue', async () => {
    const client = fakeClient({ 1: apiError(401) });
    await expect(scanChannels({ client, channels: [ch(1)], detectors: D })).rejects.toMatchObject({ status: 401 });
  });

  it('reports progress, refreshing the cluster count at the end of each channel', async () => {
    const client = fakeClient({ 1: [page([img(10, 'https://x.com/a', 1), img(11, 'https://x.com/a', 2)])] });
    const seen = [];
    await scanChannels({ client, channels: [ch(1)], detectors: D, onProgress: p => seen.push(p) });
    expect(seen[0]).toMatchObject({ channelIndex: 1, channelCount: 1, blocksFetched: 2, clusterCount: 0, channelDone: false });
    expect(seen.at(-1)).toMatchObject({ clusterCount: 1, channelDone: true });
  });

  it('pauses at the next checkpoint and carries on when resumed', async () => {
    const client = fakeClient({ 1: [page([img(10, 'https://x.com/a', 1)], true), page([img(11, 'https://x.com/a', 2)])] });
    const control = createScanControl();
    let paused = false;
    const run = scanChannels({
      client, channels: [ch(1)], detectors: D, control,
      onProgress: () => { if (!paused) { paused = true; control.pause(); } },
    });
    await new Promise(r => setTimeout(r, 10));
    expect(client.request).toHaveBeenCalledTimes(1);
    control.resume();
    const out = await run;
    expect(client.request).toHaveBeenCalledTimes(2);
    expect(out.clusters).toHaveLength(1);
  });
});

describe('buildClusters and splitClusters', () => {
  it('orders a cluster oldest first', () => {
    const blocks = [img(5, 'https://x.com/a', 1, { created_at: '2026-03-01' }), img(6, 'https://x.com/a', 2, { created_at: '2025-01-01' })];
    const places = new Map([[5, []], [6, []]]);
    expect(buildClusters(blocks, places, D)[0].blocks.map(b => b.id)).toEqual([6, 5]);
  });

  it('groups single-channel clusters by channel and lists cross-channel ones apart', () => {
    const mk = (id, scope, channelIds) => ({ id, scope, channelIds });
    const out = splitClusters([mk('a', 'single', [1]), mk('b', 'cross', [1, 2]), mk('c', 'single', [1]), mk('d', 'single', [2])]);
    expect(out.byChannel.map(g => [g.channelId, g.clusters.map(c => c.id)])).toEqual([[1, ['a', 'c']], [2, ['d']]]);
    expect(out.cross.map(c => c.id)).toEqual(['b']);
  });
});
