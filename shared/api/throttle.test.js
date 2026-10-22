import { describe, it, expect, vi } from 'vitest';
import { createThrottle } from './throttle.js';

const res = (status, retryAfter) => ({
  status,
  headers: { get: name => (name === 'retry-after' && retryAfter != null ? String(retryAfter) : null) },
});

// A fake clock: sleep() advances time instead of waiting.
function fakeClock() {
  let t = 1000;
  const sleeps = [];
  return {
    now: () => t,
    sleep: async ms => { sleeps.push(ms); t += ms; },
    sleeps,
  };
}

describe('createThrottle', () => {
  it('passes a successful response straight through', async () => {
    const c = fakeClock();
    const throttled = createThrottle(c);
    expect((await throttled(async () => res(200))).status).toBe(200);
  });

  it('spaces consecutive calls by the gap', async () => {
    const c = fakeClock();
    const throttled = createThrottle(c);
    const starts = [];
    for (let i = 0; i < 3; i++) await throttled(async () => { starts.push(c.now()); return res(200); });
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(150);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(150);
  });

  it('queues concurrent calls rather than firing them together', async () => {
    // Real timers here: a shared fake clock can't model overlapping sleeps.
    const throttled = createThrottle({ gap: 20 });
    const starts = [];
    await Promise.all([1, 2, 3].map(() => throttled(async () => { starts.push(Date.now()); return res(200); })));
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(15);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(15);
  });

  it('backs off 2, 4, 8 s on repeated 429s, then returns the 429', async () => {
    const c = fakeClock();
    const throttled = createThrottle(c);
    const doFetch = vi.fn(async () => res(429));
    const out = await throttled(doFetch);
    expect(out.status).toBe(429);
    expect(doFetch).toHaveBeenCalledTimes(4);
    expect(c.sleeps.filter(ms => ms >= 2000)).toEqual([2000, 4000, 8000]);
  });

  it('recovers when a retry succeeds', async () => {
    const c = fakeClock();
    const throttled = createThrottle(c);
    const statuses = [429, 200];
    const out = await throttled(async () => res(statuses.shift()));
    expect(out.status).toBe(200);
  });

  it('honours Retry-After over the default backoff', async () => {
    const c = fakeClock();
    const throttled = createThrottle(c);
    const queue = [res(429, 7), res(200)];
    await throttled(async () => queue.shift());
    expect(c.sleeps).toContain(7000);
    expect(c.sleeps).not.toContain(2000);
  });

  it('reports each wait through onWait', async () => {
    const c = fakeClock();
    const onWait = vi.fn();
    const throttled = createThrottle({ ...c, onWait });
    const queue = [res(429), res(429), res(200)];
    await throttled(async () => queue.shift());
    expect(onWait.mock.calls).toEqual([[2, 1], [4, 2]]);
  });
});

describe('createThrottle writeGap', () => {
  it('waits the write gap after a write, and the plain gap after a read', async () => {
    const c = fakeClock();
    const throttled = createThrottle({ ...c, gap: 150, writeGap: 600 });
    const starts = [];
    const go = (write) => throttled(async () => { starts.push(c.now()); return res(200); }, { write });
    await go(true);   // write
    await go(true);   // write again: should have waited 600
    await go(false);  // read after a write: waits the write gap too (the safe side)
    await go(false);  // read after a read: just 150
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(600);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(600);
    expect(starts[3] - starts[2]).toBeGreaterThanOrEqual(150);
    expect(starts[3] - starts[2]).toBeLessThan(600);
  });

  it('defaults writeGap to gap, so existing callers are unchanged', async () => {
    const c = fakeClock();
    const throttled = createThrottle({ ...c, gap: 150 });
    const starts = [];
    for (const write of [true, true]) await throttled(async () => { starts.push(c.now()); return res(200); }, { write });
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(150);
    expect(starts[1] - starts[0]).toBeLessThan(600);
  });
});
