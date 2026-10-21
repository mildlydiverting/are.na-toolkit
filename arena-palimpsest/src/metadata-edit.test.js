import { describe, it, expect } from 'vitest';
import {
  detectType, validateKey, validateValue, coerce, buildPatch, diffMetadata,
  checkLimits, parseList, serialiseList,
} from './metadata-edit.js';

describe('detectType', () => {
  it('detects the four types', () => {
    expect(detectType('hello')).toBe('text');
    expect(detectType(51566599)).toBe('number');
    expect(detectType(-1.5)).toBe('number');
    expect(detectType(true)).toBe('checkbox');
    expect(detectType('- a\n- b')).toBe('list');
  });
  it('treats a number outside the safe range as text', () => {
    expect(detectType(2 ** 60)).toBe('text');
  });
  it('treats a long numeric string as text', () => {
    expect(detectType('1234567890123456789012')).toBe('text');
  });
  it('reads a JSON array string as a list, and older bullet lists too', () => {
    expect(detectType('["drawing","reference"]')).toBe('list');
  });
  it('does not call ordinary text or hyphenated text a list', () => {
    expect(detectType('- not really\nbut mixed')).toBe('text');
    expect(detectType('-3 degrees')).toBe('text');
    expect(detectType('')).toBe('text');
  });
});

describe('validateKey', () => {
  it('accepts letters, numbers and underscores', () => {
    expect(validateKey('dupe_of', [])).toBeNull();
    expect(validateKey('a'.repeat(40), [])).toBeNull();
  });
  it('rejects empty, odd characters and too long', () => {
    expect(validateKey('', [])).toMatch(/name/i);
    expect(validateKey('my key', [])).toMatch(/letters/);
    expect(validateKey('a-b', [])).toMatch(/letters/);
    expect(validateKey('a'.repeat(41), [])).toMatch(/40/);
  });
  it('rejects a key already on the block', () => {
    expect(validateKey('tags', ['tags'])).toMatch(/already/);
  });
});

describe('validateValue', () => {
  it('parses numbers, including decimals and negatives', () => {
    expect(validateValue('number', '3.5')).toEqual({ ok: true, value: 3.5 });
    expect(validateValue('number', '-2')).toEqual({ ok: true, value: -2 });
  });
  it('rejects empty and non-numbers', () => {
    expect(validateValue('number', '').ok).toBe(false);
    expect(validateValue('number', 'abc').ok).toBe(false);
    expect(validateValue('number', 'Infinity').ok).toBe(false);
  });
  it('rejects a whole number too large to be safe', () => {
    const out = validateValue('number', '12345678901234567890');
    expect(out.ok).toBe(false);
    expect(out.message).toMatch(/Text/);
  });
  it('keeps booleans as booleans', () => {
    expect(validateValue('checkbox', true)).toEqual({ ok: true, value: true });
    expect(validateValue('checkbox', 'false')).toEqual({ ok: true, value: false });
  });
  it('limits text to 2000 characters', () => {
    expect(validateValue('text', 'x'.repeat(2000)).ok).toBe(true);
    expect(validateValue('text', 'x'.repeat(2001)).ok).toBe(false);
  });
  it('serialises a list and reports when it is too long', () => {
    expect(validateValue('list', ['a', 'b'])).toEqual({ ok: true, value: '["a", "b"]' });
    const big = validateValue('list', Array.from({ length: 400 }, (_, i) => `tag-number-${i}`));
    expect(big.ok).toBe(false);
    expect(big.message).toMatch(/limit 2000 characters/);
  });
});

describe('parseList and serialiseList', () => {
  it('writes a JSON array with a space after each comma', () => {
    expect(serialiseList(['journal', 'silly thing'])).toBe('["journal", "silly thing"]');
    expect(serialiseList([])).toBe('[]');
  });
  it('round-trips tags, including awkward ones', () => {
    const tags = ['drawing', 'life drawing', 'reference/anatomy', 'note: this', 'say "hi"', '-dash', '[x]', '#lead', 'back\\slash', 'café'];
    expect(parseList(serialiseList(tags))).toEqual(tags);
  });
  it('writes valid JSON that are.na and other tools can read', () => {
    expect(JSON.parse(serialiseList(['a', 'b "c"']))).toEqual(['a', 'b "c"']);
  });
  it('trims, collapses spaces, drops empties, removes duplicates ignoring case', () => {
    expect(serialiseList(['  a   b ', '', 'A B', 'c'])).toBe('["a b", "c"]');
  });
  it('keeps case as typed', () => {
    expect(parseList('["Drawing"]')).toEqual(['Drawing']);
  });
  it('reads a JSON array with or without spaces', () => {
    expect(parseList('["drawing","reference"]')).toEqual(['drawing', 'reference']);
    expect(parseList('["drawing", "reference"]')).toEqual(['drawing', 'reference']);
  });
  it('still reads older bullet lists, tolerating indents and blank lines', () => {
    expect(parseList('- tag-1\n- tag-2\n- tag-3')).toEqual(['tag-1', 'tag-2', 'tag-3']);
    expect(parseList('  - a\n\n  - b\n')).toEqual(['a', 'b']);
    expect(parseList('- "note: this"\n- \'quoted\'')).toEqual(['note: this', 'quoted']);
  });
  it('rewrites an older bullet list as JSON', () => {
    expect(serialiseList(parseList('- tag-1\n- tag-2'))).toBe('["tag-1", "tag-2"]');
  });
  it('handles null and empty', () => {
    expect(parseList(null)).toEqual([]);
    expect(parseList('')).toEqual([]);
    expect(parseList('[]')).toEqual([]);
  });
});

describe('coerce', () => {
  it('does nothing for the same type', () => {
    expect(coerce('number', 'number', 4)).toEqual({ ok: true, value: 4, lossy: false });
  });
  it('Number and Checkbox to Text use their text form', () => {
    expect(coerce('number', 'text', 51566599)).toEqual({ ok: true, value: '51566599', lossy: false });
    expect(coerce('checkbox', 'text', true)).toEqual({ ok: true, value: 'true', lossy: false });
  });
  it('Text to Number works for numbers and is blocked otherwise', () => {
    expect(coerce('text', 'number', '42')).toEqual({ ok: true, value: 42, lossy: false });
    const out = coerce('text', 'number', 'forty-two');
    expect(out.ok).toBe(false);
    expect(out.message).toBe('Not a number. Change the value first.');
  });
  it('never turns a long numeric string into a number', () => {
    expect(coerce('text', 'number', '1234567890123456789012').ok).toBe(false);
  });
  it('Text to Checkbox needs true or false', () => {
    expect(coerce('text', 'checkbox', 'True')).toEqual({ ok: true, value: true, lossy: false });
    expect(coerce('text', 'checkbox', 'maybe').ok).toBe(false);
  });
  it('Number to Checkbox and back is flagged as lossy', () => {
    expect(coerce('number', 'checkbox', 0)).toEqual({ ok: true, value: false, lossy: true });
    expect(coerce('number', 'checkbox', 7)).toEqual({ ok: true, value: true, lossy: true });
    expect(coerce('checkbox', 'number', true)).toEqual({ ok: true, value: 1, lossy: true });
  });
  it('Text to List splits on commas and new lines and flags the change', () => {
    expect(coerce('text', 'list', 'a, b\nc')).toEqual({ ok: true, value: '["a", "b", "c"]', lossy: true });
  });
  it('List to Text keeps the stored text as it is', () => {
    expect(coerce('list', 'text', '- a\n- b')).toEqual({ ok: true, value: '- a\n- b', lossy: false });
  });
  it('Number to List goes through its text', () => {
    expect(coerce('number', 'list', 5)).toEqual({ ok: true, value: '["5"]', lossy: true });
  });
  it('List to Number works only for a single numeric item', () => {
    expect(coerce('list', 'number', '- 5')).toEqual({ ok: true, value: 5, lossy: true });
    expect(coerce('list', 'number', '- a\n- b').ok).toBe(false);
  });
});

describe('buildPatch', () => {
  const original = { dupe_of: 51566599, flagged: true, note: 'hi', id_str: '1234567890123456789012' };

  it('returns {} when nothing changed', () => {
    expect(buildPatch(original, { ...original })).toEqual({});
  });
  it('leaves out unchanged keys, so a number stays a number', () => {
    const patch = buildPatch(original, { ...original, note: 'bye' });
    expect(patch).toEqual({ note: 'bye' });
  });
  it('keeps a boolean as a boolean when it changes', () => {
    expect(buildPatch(original, { ...original, flagged: false })).toEqual({ flagged: false });
  });
  it('does not touch a long numeric string that was not edited', () => {
    expect(buildPatch(original, { ...original, note: 'x' })).not.toHaveProperty('id_str');
  });
  it('sends added keys with their type', () => {
    expect(buildPatch(original, { ...original, count: 3 })).toEqual({ count: 3 });
  });
  it('sends removed keys as null', () => {
    const { note, ...rest } = original;
    expect(buildPatch(original, rest)).toEqual({ note: null });
  });
  it('counts a type change as a change', () => {
    expect(buildPatch({ n: 5 }, { n: '5' })).toEqual({ n: '5' });
  });
  it('copes with null or missing metadata', () => {
    expect(buildPatch(null, { a: 1 })).toEqual({ a: 1 });
    expect(buildPatch({ a: 1 }, null)).toEqual({ a: null });
    expect(buildPatch(undefined, undefined)).toEqual({});
  });
});

describe('diffMetadata', () => {
  it('sorts keys into added, changed and removed', () => {
    const out = diffMetadata({ a: 1, b: 'x', c: true }, { a: 2, b: 'x', d: 'new' });
    expect(out.added).toEqual([{ key: 'd', value: 'new', type: 'text' }]);
    expect(out.changed).toEqual([{ key: 'a', from: 1, to: 2, fromType: 'number', toType: 'number' }]);
    expect(out.removed).toEqual([{ key: 'c', value: true, type: 'checkbox' }]);
  });
  it('is empty when nothing differs', () => {
    expect(diffMetadata({ a: 1 }, { a: 1 })).toEqual({ added: [], changed: [], removed: [] });
  });
});

describe('checkLimits', () => {
  it('passes a small object', () => {
    const out = checkLimits({ a: 'b' });
    expect(out.ok).toBe(true);
    expect(out.keyCount).toBe(1);
  });
  it('flags more than 50 keys', () => {
    const meta = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`k${i}`, 1]));
    const out = checkLimits(meta);
    expect(out.ok).toBe(false);
    expect(out.problems[0]).toMatch(/50/);
  });
  it('flags more than 32KB', () => {
    const meta = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, 'x'.repeat(1900)]));
    const out = checkLimits(meta);
    expect(out.ok).toBe(false);
    expect(out.problems.join(' ')).toMatch(/32KB/);
  });
  it('handles missing metadata', () => {
    expect(checkLimits(null)).toMatchObject({ ok: true, keyCount: 0 });
  });
});
