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

  it('updateBlock PUTs JSON to the block', async () => {
    const { api, fetchImpl } = client([json(200, { id: 7 })]);
    await api.updateBlock(7, { title: 'New', metadata: { dupe_of: 5, old_key: null } });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.are.na/v3/blocks/7');
    expect(init.method).toBe('PUT');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ title: 'New', metadata: { dupe_of: 5, old_key: null } });
  });

  it('createConnection POSTs the structured form and returns the connections', async () => {
    const { api, fetchImpl } = client([json(201, { data: [{ id: 900 }] })]);
    const made = await api.createConnection({ id: 13857023, channels: ['drawing', { id: 42, position: 1 }] });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.are.na/v3/connections');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      connectable_id: 13857023,
      connectable_type: 'Block',
      channels: [{ id: 'drawing' }, { id: 42, position: 1 }],
    });
    expect(made).toEqual([{ id: 900 }]);
  });

  it('deleteConnection DELETEs by connection id and copes with an empty 204', async () => {
    const empty = { ok: true, status: 204, headers: { get: () => null }, text: async () => '' };
    const { api, fetchImpl } = client([empty]);
    await expect(api.deleteConnection(555)).resolves.toBeNull();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.are.na/v3/connections/555');
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
  });

  it('surfaces a 403 on write as an ArenaError', async () => {
    const { api } = client([json(403, { error: 'Forbidden', details: { message: 'Not your block.' } })]);
    await expect(api.updateBlock(1, { title: 'x' })).rejects.toMatchObject({ status: 403, message: 'Not your block.' });
  });

  it('routes requests through the throttle when given one', async () => {
    const throttle = vi.fn(fn => fn());
    const { api } = client([json(200, {})], { throttle });
    await api.getChannel('my-channel');
    expect(throttle).toHaveBeenCalledOnce();
  });
});
