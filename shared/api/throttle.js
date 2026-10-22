// Polite pacing for are.na: 150 ms between requests, and on 429 back off [2, 4, 8] s,
// honouring Retry-After. Wraps a function that returns a fetch Response.
export const THROTTLE_GAP_MS = 150;
export const THROTTLE_BACKOFF_S = [2, 4, 8];

// onWait(seconds, attempt) is called before each backoff sleep, so the UI can say so.
// writeGap (default: same as gap) is the pause after a write, for tools that want to be gentler when
// changing an account. Call throttled(doFetch, { write: true }) for writes; everything else is a read.
export function createThrottle({
  gap = THROTTLE_GAP_MS,
  writeGap = gap,
  backoff = THROTTLE_BACKOFF_S,
  sleep = ms => new Promise(r => setTimeout(r, ms)),
  now = () => Date.now(),
  onWait = null,
} = {}) {
  let nextSlot = 0;

  // Reserve the next start time synchronously, so concurrent callers queue up in order.
  async function takeSlot(spacing) {
    const start = Math.max(now(), nextSlot);
    nextSlot = start + spacing;
    const wait = start - now();
    if (wait > 0) await sleep(wait);
  }

  return async function throttled(doFetch, { write = false } = {}) {
    for (let attempt = 0; ; attempt++) {
      await takeSlot(write ? writeGap : gap);
      const res = await doFetch();
      if (res.status !== 429 || attempt >= backoff.length) return res;
      const retryAfter = Number(res.headers?.get?.('retry-after'));
      const seconds = retryAfter > 0 ? retryAfter : backoff[attempt];
      if (onWait) onWait(seconds, attempt + 1);
      await sleep(seconds * 1000);
    }
  };
}
