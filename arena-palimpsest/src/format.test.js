import { describe, it, expect } from 'vitest';
import {
  formatDate, metadataEntries, userHandle, userUrl, blockUrl,
  ownerLabel, ownerUrl, channelUrl, formatCount, sortChannels,
} from './format.js';

describe('formatDate', () => {
  it('keeps the date part of an ISO timestamp', () => expect(formatDate('2024-03-15T10:30:00Z')).toBe('2024-03-15'));
  it('returns empty for missing or odd input', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('yesterday')).toBe('');
  });
});

describe('metadataEntries', () => {
  it('lists pairs in order, as strings', () => {
    expect(metadataEntries({ dupe_of: 51566599, flagged: true, note: 'hi' }))
      .toEqual([['dupe_of', '51566599'], ['flagged', 'true'], ['note', 'hi']]);
  });
  it('returns an empty list for null or empty metadata', () => {
    expect(metadataEntries(null)).toEqual([]);
    expect(metadataEntries(undefined)).toEqual([]);
    expect(metadataEntries({})).toEqual([]);
  });
});

describe('users and urls', () => {
  it('formats a handle and profile url', () => {
    expect(userHandle({ slug: 'kim-plowright' })).toBe('@kim-plowright');
    expect(userUrl({ slug: 'kim-plowright' })).toBe('https://www.are.na/kim-plowright');
  });
  it('copes with a missing user', () => {
    expect(userHandle(null)).toBe('(unknown)');
    expect(userUrl(undefined)).toBeNull();
  });
  it('builds a block url', () => expect(blockUrl(13857023)).toBe('https://www.are.na/block/13857023'));
});

describe('channels and owners', () => {
  const kim = { type: 'User', slug: 'kim-plowright', name: 'Kim Plowright' };
  const group = { type: 'Group', slug: 'a-group', name: 'A Group' };

  it('labels users and groups', () => {
    expect(ownerLabel(kim)).toBe('@kim-plowright');
    expect(ownerLabel(group)).toBe('A Group (group)');
    expect(ownerLabel(null)).toBe('(unknown)');
  });

  it('links users but not groups', () => {
    expect(ownerUrl(kim)).toBe('https://www.are.na/kim-plowright');
    expect(ownerUrl(group)).toBeNull();
  });

  it('builds channel urls', () => {
    expect(channelUrl({ slug: 'found', owner: kim })).toBe('https://www.are.na/kim-plowright/found');
    expect(channelUrl({ slug: 'found', owner: group })).toBe('https://www.are.na/channel/found');
    expect(channelUrl({})).toBeNull();
  });
});

describe('formatCount', () => {
  it('leaves small numbers alone', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(169)).toBe('169');
    expect(formatCount(999)).toBe('999');
  });
  it('compacts thousands and millions', () => {
    expect(formatCount(1234)).toBe('1.2k');
    expect(formatCount(2000)).toBe('2k');
    expect(formatCount(10400)).toBe('10k');
    expect(formatCount(2500000)).toBe('2.5m');
  });
  it('returns an empty string for missing or invalid counts', () => {
    expect(formatCount(undefined)).toBe('');
    expect(formatCount(null)).toBe('');
    expect(formatCount(NaN)).toBe('');
    expect(formatCount(-1)).toBe('');
  });
});

describe('sortChannels', () => {
  const a = { id: 1, created_at: '2025-01-01T00:00:00Z', counts: { contents: 5 }, metadata: {} };
  const b = { id: 2, created_at: '2026-06-01T00:00:00Z', counts: { contents: 500 }, metadata: { k: 'v', j: 'w' } };
  const c = { id: 3, created_at: '2024-03-01T00:00:00Z', counts: { blocks: 50 }, metadata: { k: 'v' } };
  const undated = { id: 4, counts: { contents: 1 }, metadata: {} };
  const ids = (list) => list.map((x) => x.id);

  it('keeps the original order by default and for unknown modes', () => {
    expect(ids(sortChannels([a, b, c], 'default'))).toEqual([1, 2, 3]);
    expect(ids(sortChannels([a, b, c], 'nonsense'))).toEqual([1, 2, 3]);
  });
  it('sorts by created date, undated channels last either way', () => {
    expect(ids(sortChannels([undated, a, b, c], 'recent'))).toEqual([2, 1, 3, 4]);
    expect(ids(sortChannels([undated, a, b, c], 'oldest'))).toEqual([3, 1, 2, 4]);
  });
  it('sorts by block count, falling back to counts.blocks', () => {
    expect(ids(sortChannels([a, b, c], 'blocks'))).toEqual([2, 3, 1]);
  });
  it('sorts by number of metadata entries, ties keep original order', () => {
    expect(ids(sortChannels([a, undated, c, b], 'metadata'))).toEqual([2, 3, 1, 4]);
  });
  it('does not mutate the input', () => {
    const input = [a, b, c];
    sortChannels(input, 'blocks');
    expect(ids(input)).toEqual([1, 2, 3]);
  });
});
