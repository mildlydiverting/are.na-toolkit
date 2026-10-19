import { describe, it, expect } from 'vitest';
import { formatDate, metadataEntries, userHandle, userUrl, blockUrl } from './format.js';

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
