import { describe, it, expect } from 'vitest';
import {
  formatDate, metadataEntries, userHandle, userUrl, blockUrl,
  ownerLabel, ownerUrl, channelUrl, visibilityVariant,
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

  it('maps visibility to existing badge variants', () => {
    expect(visibilityVariant('public')).toBe('success');
    expect(visibilityVariant('private')).toBe('private');
    expect(visibilityVariant('closed')).toBe('default');
  });
});
