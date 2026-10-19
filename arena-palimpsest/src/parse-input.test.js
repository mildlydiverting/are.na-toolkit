import { describe, it, expect } from 'vitest';
import { parseBlockInput } from './parse-input.js';

describe('parseBlockInput: accepts', () => {
  it('a bare id', () => expect(parseBlockInput('13857023')).toBe(13857023));
  it('a number', () => expect(parseBlockInput(13857023)).toBe(13857023));
  it('a URL', () => expect(parseBlockInput('https://www.are.na/block/13857023')).toBe(13857023));
  it('a URL with a trailing slash', () => expect(parseBlockInput('https://www.are.na/block/13857023/')).toBe(13857023));
  it('a URL with a query', () => expect(parseBlockInput('https://www.are.na/block/13857023?x=1')).toBe(13857023));
  it('a URL with an anchor', () => expect(parseBlockInput('https://www.are.na/block/13857023#comments')).toBe(13857023));
  it('http as well as https', () => expect(parseBlockInput('http://www.are.na/block/13857023')).toBe(13857023));
  it('a URL without www', () => expect(parseBlockInput('https://are.na/block/13857023')).toBe(13857023));
  it('a URL with no scheme', () => expect(parseBlockInput('www.are.na/block/13857023')).toBe(13857023));
  it('a bare are.na URL with no scheme or www', () => expect(parseBlockInput('are.na/block/13857023')).toBe(13857023));
  it('padding whitespace', () => expect(parseBlockInput('  \n13857023\t ')).toBe(13857023));
  it('a padded URL', () => expect(parseBlockInput('  https://www.are.na/block/13857023  ')).toBe(13857023));
});

describe('parseBlockInput: rejects', () => {
  it('an empty string', () => expect(parseBlockInput('')).toBeNull());
  it('whitespace only', () => expect(parseBlockInput('   ')).toBeNull());
  it('null and undefined', () => {
    expect(parseBlockInput(null)).toBeNull();
    expect(parseBlockInput(undefined)).toBeNull();
  });
  it('non-numeric text', () => expect(parseBlockInput('abc')).toBeNull());
  it('a negative number', () => expect(parseBlockInput('-5')).toBeNull());
  it('a decimal', () => expect(parseBlockInput('12.5')).toBeNull());
  it('zero', () => expect(parseBlockInput('0')).toBeNull());
  it('an id too large to be safe', () => expect(parseBlockInput('99999999999999999999')).toBeNull());
  it('a channel URL', () => expect(parseBlockInput('https://www.are.na/kim-plowright/drawing')).toBeNull());
  it('a block URL with no id', () => expect(parseBlockInput('https://www.are.na/block/')).toBeNull());
  it('a block URL with a non-numeric id', () => expect(parseBlockInput('https://www.are.na/block/abc')).toBeNull());
  it('a block path on another site', () => expect(parseBlockInput('https://example.com/block/13857023')).toBeNull());
  it('a lookalike host', () => expect(parseBlockInput('https://notare.na/block/13857023')).toBeNull());
  it('nonsense', () => expect(parseBlockInput('hello world')).toBeNull());
});
