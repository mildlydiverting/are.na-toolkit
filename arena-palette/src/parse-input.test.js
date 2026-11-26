import { describe, it, expect } from 'vitest';
import { parseArenaSlug, parseSourceInput } from './parse-input.js';

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

describe('parseSourceInput', () => {
  it('treats blank input as empty', () => {
    expect(parseSourceInput('')).toEqual({ kind: 'empty' });
    expect(parseSourceInput('   ')).toEqual({ kind: 'empty' });
    expect(parseSourceInput(null)).toEqual({ kind: 'empty' });
  });

  it('reads a bare slug as a channel', () => {
    expect(parseSourceInput('chromatic-vwdupl8d0lk')).toEqual({ kind: 'channel', slug: 'chromatic-vwdupl8d0lk' });
    expect(parseSourceInput('  my_channel  ')).toEqual({ kind: 'channel', slug: 'my_channel' });
  });

  it('reads channel URLs, with or without scheme, query, fragment or trailing slash', () => {
    const want = { kind: 'channel', slug: 'some-channel' };
    expect(parseSourceInput('https://www.are.na/kim-plowright/some-channel')).toEqual(want);
    expect(parseSourceInput('are.na/kim/some-channel')).toEqual(want);
    expect(parseSourceInput('https://are.na/kim/some-channel/?x=1#top')).toEqual(want);
  });

  it('reads block URLs and bare ids as blocks, not channels', () => {
    expect(parseSourceInput('https://www.are.na/block/44858120')).toEqual({ kind: 'block', id: 44858120 });
    expect(parseSourceInput('are.na/block/7/')).toEqual({ kind: 'block', id: 7 });
    expect(parseSourceInput('44858120')).toEqual({ kind: 'block', id: 44858120 });
  });

  it('rejects anything else', () => {
    expect(parseSourceInput('not a slug')).toEqual({ kind: 'invalid' });
    expect(parseSourceInput('https://example.com/kim/chan')).toEqual({ kind: 'invalid' });
    expect(parseSourceInput('https://www.are.na/block/abc')).toEqual({ kind: 'invalid' });
    expect(parseSourceInput('https://www.are.na/kim')).toEqual({ kind: 'invalid' });
    expect(parseSourceInput('0')).toEqual({ kind: 'invalid' });
  });
});
