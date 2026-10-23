import { describe, it, expect } from 'vitest';
import { looksLikeChannelRef, nextActive } from './channel-finder.js';

describe('looksLikeChannelRef', () => {
  it('treats URLs and are.na paths as references, plain words as searches', () => {
    expect(looksLikeChannelRef('https://www.are.na/kim/ideas')).toBe(true);
    expect(looksLikeChannelRef('  http://are.na/kim/ideas')).toBe(true);
    expect(looksLikeChannelRef('are.na/kim/ideas')).toBe(true);
    expect(looksLikeChannelRef('drawing ideas')).toBe(false);
    expect(looksLikeChannelRef('')).toBe(false);
    expect(looksLikeChannelRef(null)).toBe(false);
  });
});

describe('nextActive', () => {
  it('starts at the first or last enabled row when nothing is highlighted', () => {
    expect(nextActive(-1, [true, true, true], 1)).toBe(0);
    expect(nextActive(-1, [true, true, true], -1)).toBe(2);
  });
  it('wraps round the ends', () => {
    expect(nextActive(2, [true, true, true], 1)).toBe(0);
    expect(nextActive(0, [true, true, true], -1)).toBe(2);
  });
  it('skips disabled rows', () => {
    expect(nextActive(0, [true, false, true], 1)).toBe(2);
    expect(nextActive(2, [true, false, true], -1)).toBe(0);
  });
  it('returns -1 when nothing can be chosen', () => {
    expect(nextActive(-1, [false, false], 1)).toBe(-1);
    expect(nextActive(-1, [], 1)).toBe(-1);
  });
});
