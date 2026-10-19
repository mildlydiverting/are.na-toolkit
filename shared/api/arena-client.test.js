import { describe, it, expect, vi } from 'vitest';
import { createArenaClient, ArenaError } from './arena-client.js';

const json = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  text: async () => JSON.stringify(body),
});

function client(responses, extra = {}) {
  const queue = [...responses];
  const fetchImpl = vi.fn(async () => queue.shift());
  return { api: createArenaClient({ token: 'tok', fetchImpl, ...extra }), fetchImpl };
}

describe('createArenaClient', () => {
  it('builds v3 URLs and sends the bearer token', async () => {
    const { api, fetchImpl } = client([json(200, { id: 1 })]);
    await api.getBlock(13857023);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.are.na/v3/blocks/13857023');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.credentials).toBe('omit');
  });

  it('omits the Authorization header with no token', async () => {
    const fetchImpl = vi.fn(async () => json(200, {}));
    await createArenaClient({ fetchImpl }).getCurrentUser();
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.are.na/v3/me');
  });

  it('uses the token set later', async () => {
    const fetchImpl = vi.fn(async () => json(200, {}));
    const api = createArenaClient({ fetchImpl });
    api.setToken('later');
    await api.getCurrentUser();
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer later');
  });

  it('throws ArenaError with status and the API message', async () => {
    const { api } = client([json(404, { error: 'Not Found', code: 404, details: { message: 'No such block.' } })]);
    await expect(api.getBlock(1)).rejects.toMatchObject({ name: 'ArenaError', status: 404, message: 'No such block.' });
  });

  it('falls back to a generic message when the body is not JSON', async () => {
    const bad = { ok: false, status: 502, headers: { get: () => null }, text: async () => '<html>' };
    const { api } = client([bad]);
    await expect(api.getBlock(1)).rejects.toBeInstanceOf(ArenaError);
  });

  it('getBlockConnections follows pagination to the end', async () => {
    const { api, fetchImpl } = client([
      json(200, { data: [{ id: 1 }, { id: 2 }], meta: { has_more_pages: true } }),
      json(200, { data: [{ id: 3 }], meta: { has_more_pages: false } }),
    ]);
    const all = await api.getBlockConnections(99);
    expect(all.map(c => c.id)).toEqual([1, 2, 3]);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.are.na/v3/blocks/99/connections?page=1&per=100');
    expect(fetchImpl.mock.calls[1][0]).toContain('page=2');
  });

  it('routes requests through the throttle when given one', async () => {
    const throttle = vi.fn(fn => fn());
    const { api } = client([json(200, {})], { throttle });
    await api.getChannel('my-channel');
    expect(throttle).toHaveBeenCalledOnce();
  });
});
