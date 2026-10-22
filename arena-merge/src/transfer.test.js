import { describe, it, expect, vi } from 'vitest';
import { runMerge } from './transfer.js';

function fakeClient({ failOn = null } = {}) {
  const calls = [];
  return {
    calls,
    request: vi.fn(async (path, q, o) => { calls.push(['request', path, o.body]); if (failOn === o.body.connectable_id) throw new Error('boom'); return {}; }),
    deleteConnection: vi.fn(async id => { calls.push(['delete', id]); }),
    updateChannel: vi.fn(async (slug, f) => { calls.push(['update', slug, f]); }),
  };
}
const items = [
  { id: 1, class: 'Image', title: 'a', connection: { id: 101 } },
  { id: 2, class: 'Channel', title: 'sub', connection: { id: 102 } },
  { id: 3, class: 'Text', content: { plain: 'hi' }, connection: { id: 103 } },
];
const source = { id: 10, slug: 's', title: 'Source', status: 'public' };
const dest = { id: 20, slug: 'd', title: 'Dest', status: 'public' };
const base = { source, dest, contents: items, destIds: new Set() };

describe('runMerge', () => {
  it('adds each block with the right connectable type and dest id', async () => {
    const client = fakeClient();
    const r = await runMerge({ ...base, client });
    expect(r.added).toBe(3);
    expect(client.calls.filter(c => c[0] === 'request').map(c => c[2])).toEqual([
      { connectable_id: 1, connectable_type: 'Block', channel_ids: [20] },
      { connectable_id: 2, connectable_type: 'Channel', channel_ids: [20] },
      { connectable_id: 3, connectable_type: 'Block', channel_ids: [20] },
    ]);
  });
  it('skips blocks already in the destination', async () => {
    const client = fakeClient();
    const r = await runMerge({ ...base, client, destIds: new Set([2]) });
    expect(r.added).toBe(2);
    expect(r.skipped).toBe(1);
  });
  it('also removes blocks already in the destination from the source, without copying them again', async () => {
    const client = fakeClient();
    const r = await runMerge({ ...base, client, destIds: new Set([2]), opts: { deleteFromSource: true } });
    expect(r).toMatchObject({ added: 2, skipped: 1, removed: 3, failed: 0 });
    expect(client.calls.filter(c => c[0] === 'request').map(c => c[2].connectable_id)).toEqual([1, 3]);
    expect(client.calls.filter(c => c[0] === 'delete').map(c => c[1])).toEqual([101, 102, 103]);
  });
  it('leaves already-there blocks in the source when removal is off', async () => {
    const client = fakeClient();
    await runMerge({ ...base, client, destIds: new Set([2]) });
    expect(client.deleteConnection).not.toHaveBeenCalled();
  });
  it('makes no write calls on a dry run but reports the same counts', async () => {
    const client = fakeClient();
    const r = await runMerge({ ...base, client, dryRun: true, opts: { deleteFromSource: true, quietMode: true } });
    expect(client.calls).toEqual([]);
    expect(r.added).toBe(3);
    expect(r.removed).toBe(3);
    expect(r.statusChanged).toBe(true);
  });
  it('removes from source only after a block is added, using its connection id', async () => {
    const client = fakeClient({ failOn: 2 });
    const r = await runMerge({ ...base, client, opts: { deleteFromSource: true } });
    expect(client.calls.filter(c => c[0] === 'delete').map(c => c[1])).toEqual([101, 103]);
    expect(r.failed).toBe(1);
    expect(r.removed).toBe(2);
  });
  it('keeps going after one failure and logs it', async () => {
    const client = fakeClient({ failOn: 1 });
    const log = [];
    const r = await runMerge({ ...base, client, hooks: { onLog: (t, x) => log.push([t, x]) } });
    expect(r.added).toBe(2);
    expect(log.some(([t, x]) => t === 'err' && x.includes('boom'))).toBe(true);
  });
  it('sets the destination private, then restores its status', async () => {
    const client = fakeClient();
    await runMerge({ ...base, client, opts: { quietMode: true } });
    const updates = client.calls.filter(c => c[0] === 'update');
    expect(updates.map(u => u[2])).toEqual([{ status: 'private' }, { status: 'public' }]);
  });
  it('leaves a private destination alone', async () => {
    const client = fakeClient();
    await runMerge({ ...base, client, dest: { ...dest, status: 'private' }, opts: { quietMode: true } });
    expect(client.updateChannel).not.toHaveBeenCalled();
  });
  it('restores status even when blocks fail', async () => {
    const client = fakeClient({ failOn: 1 });
    await runMerge({ ...base, client, opts: { quietMode: true } });
    expect(client.calls.filter(c => c[0] === 'update').length).toBe(2);
  });
  it('stops when asked to cancel, and still restores status', async () => {
    const client = fakeClient();
    let n = 0;
    const r = await runMerge({ ...base, client, opts: { quietMode: true }, hooks: { shouldCancel: () => n++ >= 1 } });
    expect(r.cancelled).toBe(true);
    expect(r.added).toBe(1);
    expect(client.calls.filter(c => c[0] === 'update').length).toBe(2);
  });
  it('reports progress as value of max, including an empty run', async () => {
    const client = fakeClient();
    const seen = [];
    await runMerge({ ...base, client, hooks: { onProgress: p => seen.push([p.value, p.max]) } });
    expect(seen).toEqual([[0, 3], [1, 3], [2, 3], [3, 3]]);
    const empty = [];
    await runMerge({ ...base, client, contents: [], hooks: { onProgress: p => empty.push([p.value, p.max]) } });
    expect(empty).toEqual([[0, 0]]);
  });
  it('counts a missing connection id as a failure to remove, but the block is still added', async () => {
    const client = fakeClient();
    const r = await runMerge({ ...base, client, contents: [{ id: 9, class: 'Image' }], opts: { deleteFromSource: true } });
    expect(r.added).toBe(1);
    expect(r.removed).toBe(0);
    expect(r.failed).toBe(1);
  });
  it('treats a 422 from are.na as already there, not a failure', async () => {
    const client = fakeClient();
    client.request = vi.fn(async () => { throw Object.assign(new Error('exists'), { status: 422 }); });
    const r = await runMerge({ ...base, client, contents: [items[0]], opts: { deleteFromSource: true } });
    expect(r).toMatchObject({ added: 0, skipped: 1, failed: 0, removed: 1 });
    expect(client.deleteConnection).toHaveBeenCalledWith(101);
  });
  it('carries on without quiet mode if the destination cannot be made private', async () => {
    const client = fakeClient();
    client.updateChannel = vi.fn(async () => { throw new Error('nope'); });
    const r = await runMerge({ ...base, client, opts: { quietMode: true } });
    expect(r.added).toBe(3);
    expect(r.statusChanged).toBe(false);
    expect(client.updateChannel).toHaveBeenCalledTimes(1);
  });
});
