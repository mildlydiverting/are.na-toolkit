import { describe, it, expect } from 'vitest';
import { escapeHtml, safeUrl } from './escape.js';

describe('escapeHtml', () => {
  it('escapes the characters that break out of text or attributes', () => {
    expect(escapeHtml(`"><img src=x onerror=alert(1)>`)).toBe('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
    expect(escapeHtml(`a & b's`)).toBe('a &amp; b&#39;s');
  });
  it('copes with null, undefined and numbers', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('safeUrl', () => {
  it('allows http and https', () => {
    expect(safeUrl('https://www.are.na/block/1')).toBe('https://www.are.na/block/1');
    expect(safeUrl(' http://example.com/a ')).toBe('http://example.com/a');
  });
  it('refuses other schemes and junk', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('JaVaScRiPt:alert(1)')).toBe('');
    expect(safeUrl('data:text/html,<script>')).toBe('');
    expect(safeUrl('not a url')).toBe('');
    expect(safeUrl('')).toBe('');
    expect(safeUrl(undefined)).toBe('');
  });
  it('returns an address with quotes percent-encoded so it is safe in an attribute', () => {
    expect(safeUrl('https://x.com/a"b')).not.toContain('"');
  });
});
