import { describe, it, expect } from 'vitest';
import { filterChannels, toggleId, selectId } from './channel-picker.js';

const channels = [
  { id: 1, slug: 'drawing-ideas', title: 'Drawing ideas' },
  { id: 2, slug: 'pinterest-2024', title: 'Saved from Pinterest' },
  { id: 3, slug: 'untitled', title: null },
];

describe('filterChannels', () => {
  it('returns everything for an empty query', () => {
    expect(filterChannels(channels, '')).toBe(channels);
    expect(filterChannels(channels, '   ')).toBe(channels);
    expect(filterChannels(channels, undefined)).toBe(channels);
  });

  it('matches title or slug, ignoring case', () => {
    expect(filterChannels(channels, 'DRAWING').map(c => c.id)).toEqual([1]);
    expect(filterChannels(channels, 'pinterest').map(c => c.id)).toEqual([2]);
    expect(filterChannels(channels, '2024').map(c => c.id)).toEqual([2]);
  });

  it('copes with a missing title', () => {
    expect(filterChannels(channels, 'untitled').map(c => c.id)).toEqual([3]);
  });

  it('returns [] when nothing matches', () => {
    expect(filterChannels(channels, 'zzz')).toEqual([]);
  });
});

describe('toggleId', () => {
  it('adds an id that is missing, at the end', () => {
    expect(toggleId([1, 2], 3)).toEqual([1, 2, 3]);
  });
  it('removes an id that is present', () => {
    expect(toggleId([1, 2, 3], 2)).toEqual([1, 3]);
  });
  it('does not mutate its input', () => {
    const ids = [1];
    toggleId(ids, 2);
    expect(ids).toEqual([1]);
  });
});

describe('selectId', () => {
  it('toggles in multiple mode', () => {
    expect(selectId([1], 2, true)).toEqual([1, 2]);
    expect(selectId([1, 2], 1, true)).toEqual([2]);
  });
  it('replaces the choice in single mode, and keeps it on a second click', () => {
    expect(selectId([1], 2, false)).toEqual([2]);
    expect(selectId([2], 2, false)).toEqual([2]);
  });
  it('defaults to multiple, so existing callers are unchanged', () => {
    expect(selectId([1], 2)).toEqual([1, 2]);
  });
});
