import { describe, it, expect } from 'vitest';
import { parseArenaSlug } from './parse-input.js';

describe('parseArenaSlug', () => {
  it('takes the channel slug from a full are.na URL', () => {
    expect(parseArenaSlug('https://www.are.na/kim-plowright/chromatic-vwdupl8d0lk')).toBe('chromatic-vwdupl8d0lk');
    expect(parseArenaSlug('https://are.na/kim-plowright/some-channel')).toBe('some-channel');
  });

  it('ignores query strings, fragments and trailing slashes', () => {
    expect(parseArenaSlug('https://www.are.na/kim/chan?x=1')).toBe('chan');
    expect(parseArenaSlug('https://www.are.na/kim/chan#top')).toBe('chan');
    expect(parseArenaSlug('https://www.are.na/kim/chan/')).toBe('chan');
  });

  it('leaves a bare slug alone', () => {
    expect(parseArenaSlug('chromatic-vwdupl8d0lk')).toBe('chromatic-vwdupl8d0lk');
    expect(parseArenaSlug('')).toBe('');
  });

  // v1 behaviour, kept until block URLs are handled properly (plan §5, step 1).
  it('currently mistakes a block URL for a channel slug', () => {
    expect(parseArenaSlug('https://www.are.na/block/44858120')).toBe('44858120');
  });
});
