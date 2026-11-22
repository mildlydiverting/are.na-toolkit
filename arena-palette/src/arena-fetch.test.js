import { describe, it, expect } from 'vitest';
import { ArenaError, createArenaClient } from '../../shared/api/arena-client.js';
import { createThrottle } from '../../shared/api/throttle.js';
import { fetchChannelImages, fetchChannelMeta, fetchBlockAtPage, MAX_RETRIES, FETCH_RATE_LIMIT_MESSAGE } from './arena-fetch.js';

const image = (id, extra = {}) => ({
  type: 'Image', id, title: `Image ${id}`,
  image: { src: `https://img/${id}.jpg`, small: { src: `https://img/${id}-s.jpg` } },
  ...extra,
});

// A fake client over `blocks` (page n → blocks[n - 1]). `fail` can make a call throw.
function fakeClient({ blocks = [], total = blocks.length, fail = null } = {}) {
  const calls = [];
  return {
    calls,
    getChannel: async slug => {
      calls.push(['getChannel', slug]);
      if (fail?.meta) throw fail.meta;
      return { counts: { contents: total } };
    },
    request: async (path, params) => {
      calls.push(['request', path, params]);
      if (fail?.page) throw fail.page;
      return { data: blocks[params.page - 1] ? [blocks[params.page - 1]] : [] };
    },
  };
}

// 0, 1, 2, … as page choices (rng() * total, floored, plus one).
const stepRng = total => { let i = 0; return () => (i++ % total) / total; };

describe('fetchChannelImages', () => {
  it('returns the requested number of image blocks, mapped to the v1 shape', async () => {
    const client = fakeClient({ blocks: [image(1), image(2), image(3)] });
    const out = await fetchChannelImages(client, 'my-channel', 2, { rng: stepRng(3) });
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      url: 'https://img/1-s.jpg', original: 'https://img/1.jpg', title: 'Image 1', description: '',
      channel: 'my-channel', id: 1, blockUrl: 'https://www.are.na/block/1',
      sourceUrl: '', sourceTitle: '', userName: '', userSlug: '', createdAt: '',
    });
  });

  it('asks for one block at a time, on distinct pages', async () => {
    const client = fakeClient({ blocks: [image(1), image(2), image(3)] });
    await fetchChannelImages(client, 'c', 3, { rng: stepRng(3) });
    const pages = client.calls.filter(c => c[0] === 'request').map(c => c[2].page);
    expect(pages).toEqual([1, 2, 3]);
    expect(client.calls.find(c => c[0] === 'request')[2]).toEqual({ per: 1, page: 1 });
    expect(client.calls.find(c => c[0] === 'request')[1]).toBe('/channels/c/contents');
  });

  it('skips text and other non-image blocks', async () => {
    const client = fakeClient({ blocks: [{ type: 'Text', id: 9 }, { type: 'Link', id: 8 }, image(7)] });
    const out = await fetchChannelImages(client, 'c', 1, { rng: stepRng(3) });
    expect(out.map(b => b.id)).toEqual([7]);
  });

  it('fills description, source and user from the block', async () => {
    const block = image(5, {
      description: { plain: 'A plain note' }, source: { url: 'https://x.test', title: 'X' },
      user: { full_name: 'Kim P', slug: 'kim-p' }, created_at: '2026-01-02T00:00:00Z',
    });
    const [out] = await fetchChannelImages(fakeClient({ blocks: [block] }), 'c', 1, { rng: () => 0 });
    expect(out).toMatchObject({
      description: 'A plain note', sourceUrl: 'https://x.test', sourceTitle: 'X',
      userName: 'Kim P', userSlug: 'kim-p', createdAt: '2026-01-02T00:00:00Z',
    });
  });

  it('says so when the channel is empty', async () => {
    await expect(fetchChannelImages(fakeClient({ blocks: [] }), 'empty', 3)).rejects.toThrow('Channel "empty" appears to be empty');
  });

  it('gives up after MAX_RETRIES attempts per slot when there are no images', async () => {
    const client = fakeClient({ blocks: [{ type: 'Text', id: 1 }] });
    await expect(fetchChannelImages(client, 'texty', 1, { rng: () => 0 }))
      .rejects.toThrow(`No image blocks found in "texty" after ${MAX_RETRIES} attempts`);
    expect(client.calls.filter(c => c[0] === 'request')).toHaveLength(MAX_RETRIES);
  });

  it('keeps v1 wording for a missing channel', async () => {
    const client = fakeClient({ fail: { meta: new ArenaError(404, 'are.na error 404', null) } });
    await expect(fetchChannelImages(client, 'nope', 1)).rejects.toThrow('Channel "nope" not found (404)');
  });

  it('prefers are.na\'s own message when it gives one', async () => {
    const body = { details: { message: 'You need to be signed in' } };
    const client = fakeClient({ fail: { meta: new ArenaError(401, 'x', body) } });
    await expect(fetchChannelImages(client, 'private', 1)).rejects.toThrow('You need to be signed in');
  });

  it('stops at once on a 429 and says so, with status 429', async () => {
    const client = fakeClient({ blocks: [image(1), image(2)], fail: { page: new ArenaError(429, 'Too many', null) } });
    const err = await fetchChannelImages(client, 'c', 5, { rng: stepRng(2) }).catch(e => e);
    expect(err.message).toBe(FETCH_RATE_LIMIT_MESSAGE);
    expect(err.status).toBe(429);
    expect(client.calls.filter(c => c[0] === 'request')).toHaveLength(1);
  });

  it('reports other page failures in v1 wording', async () => {
    const client = fakeClient({ blocks: [image(1)], fail: { page: new ArenaError(500, 'boom', null) } });
    await expect(fetchChannelImages(client, 'c', 1, { rng: () => 0 })).rejects.toThrow('Fetch failed for "c" page 1 (500)');
  });

  it('passes network errors through untouched', async () => {
    const client = fakeClient({ fail: { meta: new TypeError('Failed to fetch') } });
    await expect(fetchChannelImages(client, 'c', 1)).rejects.toThrow('Failed to fetch');
  });
});

describe('fetchChannelMeta / fetchBlockAtPage', () => {
  it('encode the slug', async () => {
    const client = fakeClient({ blocks: [image(1)] });
    await fetchBlockAtPage(client, 'a b/c', 1);
    expect(client.calls[0][1]).toBe('/channels/a%20b%2Fc/contents');
    await fetchChannelMeta(client, 'a b/c');
    expect(client.calls[1]).toEqual(['getChannel', 'a b/c']);
  });
  it('fetchBlockAtPage returns null for an empty page', async () => {
    expect(await fetchBlockAtPage(fakeClient({ blocks: [] }), 'c', 4)).toBeNull();
  });
});

describe('with the real throttle and client', () => {
  const response = (status, body = {}) => ({
    status, ok: status >= 200 && status < 300, headers: { get: () => null }, text: async () => JSON.stringify(body),
  });

  it('spaces requests 150 ms apart', async () => {
    let clock = 0;
    const starts = [];
    const sleep = async ms => { clock += ms; };
    const client = createArenaClient({
      throttle: createThrottle({ sleep, now: () => clock }),
      fetchImpl: async url => {
        starts.push(clock);
        return response(200, url.includes('/contents') ? { data: [image(1)] } : { counts: { contents: 1 } });
      },
    });
    await fetchChannelImages(client, 'c', 2, { rng: () => 0 });
    expect(starts).toEqual([0, 150, 300]); // meta, then one request per slot
  });

  it('backs off 2, 4 and 8 s on 429, then stops with the rate-limit message', async () => {
    let clock = 0;
    const sleeps = [];
    const waits = [];
    const sleep = async ms => { sleeps.push(ms); clock += ms; };
    let fetches = 0;
    const client = createArenaClient({
      throttle: createThrottle({ sleep, now: () => clock, onWait: s => waits.push(s) }),
      fetchImpl: async () => { fetches++; return response(429); },
    });
    const err = await fetchChannelImages(client, 'c', 3).catch(e => e);
    expect(err.message).toBe(FETCH_RATE_LIMIT_MESSAGE);
    expect(err.status).toBe(429);
    expect(waits).toEqual([2, 4, 8]);
    expect(fetches).toBe(4);
  });
});
