import { describe, it, expect } from 'vitest';
import { normaliseUrl, extractUrls } from './url-normalise.js';

describe('normaliseUrl', () => {
  it('collapses Pinterest pins across subdomains, slashes and query strings', () => {
    const want = 'pinterest.com/pin/256283035039248645';
    expect(normaliseUrl('https://uk.pinterest.com/pin/256283035039248645/')).toBe(want);
    expect(normaliseUrl('https://www.pinterest.com/pin/256283035039248645/?created_at=2024')).toBe(want);
    expect(normaliseUrl('https://pinterest.com/pin/256283035039248645')).toBe(want);
  });

  it('keys Instagram posts on the shortcode, preserving its case', () => {
    const want = 'instagram.com/p/CKwkFh1H2a-';
    expect(normaliseUrl('https://www.instagram.com/p/CKwkFh1H2a-/')).toBe(want);
    expect(normaliseUrl('https://instagram.com/p/CKwkFh1H2a-')).toBe(want);
    expect(normaliseUrl('https://www.instagram.com/p/CKwkFh1H2a-/?utm_medium=share_sheet')).toBe(want);
  });

  it('strips tracking params but keeps meaningful ones', () => {
    expect(normaliseUrl('https://example.com/a?utm_source=x&fbclid=y&igshid=z&ref=q&si=1')).toBe('example.com/a');
    expect(normaliseUrl('https://example.com/a?id=7&utm_source=x')).toBe('example.com/a?id=7');
  });

  it('lowercases the host and path, drops www and a trailing slash', () => {
    expect(normaliseUrl('https://WWW.Example.COM/Some/Path/')).toBe('example.com/some/path');
  });

  it('treats http and https as the same', () => {
    expect(normaliseUrl('http://example.com/a')).toBe(normaliseUrl('https://example.com/a'));
  });

  it('returns unparseable input unchanged', () => {
    expect(normaliseUrl('not a url')).toBe('not a url');
    expect(normaliseUrl('')).toBe('');
  });
});

describe('extractUrls', () => {
  it('returns [] for empty input', () => {
    expect(extractUrls(undefined)).toEqual([]);
    expect(extractUrls('')).toEqual([]);
    expect(extractUrls('no links here')).toEqual([]);
  });

  it('finds and normalises several URLs', () => {
    const text = 'via https://www.instagram.com/p/AbC/ and https://example.com/x/?utm_source=a';
    expect(extractUrls(text)).toEqual(['instagram.com/p/AbC', 'example.com/x']);
  });

  it('trims trailing punctuation', () => {
    expect(extractUrls('(see https://example.com/a).')).toEqual(['example.com/a']);
    expect(extractUrls('https://example.com/a, then more')).toEqual(['example.com/a']);
  });
});
