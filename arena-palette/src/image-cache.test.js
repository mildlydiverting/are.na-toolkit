import { describe, it, expect } from 'vitest';
import { createImageCache } from './image-cache.js';

describe('createImageCache', () => {
  it('loads a URL once and gives back the same image', async () => {
    let loads = 0;
    const cache = createImageCache(async url => { loads++; return { url }; });
    const a = await cache.get('https://img/1.jpg');
    const b = await cache.get('https://img/1.jpg');
    expect(a).toBe(b);
    expect(loads).toBe(1);
  });

  it('shares one load between simultaneous requests', async () => {
    let loads = 0;
    const cache = createImageCache(async url => { loads++; return { url }; });
    const [a, b] = await Promise.all([cache.get('u'), cache.get('u')]);
    expect(a).toBe(b);
    expect(loads).toBe(1);
  });

  it('keeps different URLs apart', async () => {
    const cache = createImageCache(async url => ({ url }));
    expect((await cache.get('a')).url).toBe('a');
    expect((await cache.get('b')).url).toBe('b');
    expect(cache.has('a') && cache.has('b')).toBe(true);
  });

  it('forgets a failed load so a retry tries again', async () => {
    let attempt = 0;
    const cache = createImageCache(async url => {
      if (++attempt === 1) throw new Error('boom');
      return { url };
    });
    await expect(cache.get('u')).rejects.toThrow('boom');
    expect(cache.has('u')).toBe(false);
    expect((await cache.get('u')).url).toBe('u');
  });

  it('clear() empties it', async () => {
    let loads = 0;
    const cache = createImageCache(async url => { loads++; return { url }; });
    await cache.get('u');
    cache.clear();
    await cache.get('u');
    expect(loads).toBe(2);
  });
});
