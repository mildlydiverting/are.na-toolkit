import { describe, it, expect } from 'vitest';
import { parseSlug, truncate, thumbSrc, thumbLabel, describeBlock, connectableType, planMerge, summaryLines, pluralBlocks } from './helpers.js';

describe('parseSlug', () => {
  it('returns a bare slug unchanged, trimmed', () => {
    expect(parseSlug('  my-channel ')).toBe('my-channel');
  });
  it('takes the channel slug from a full URL, with or without www and query', () => {
    expect(parseSlug('https://www.are.na/kim-plowright/drawing-ideas')).toBe('drawing-ideas');
    expect(parseSlug('http://are.na/kim/ideas?x=1#top')).toBe('ideas');
  });
  it('decodes an encoded slug', () => {
    expect(parseSlug('https://www.are.na/kim/caf%C3%A9')).toBe('café');
  });
  it('returns null for nothing', () => {
    expect(parseSlug('')).toBeNull();
    expect(parseSlug('   ')).toBeNull();
    expect(parseSlug(null)).toBeNull();
  });
});

describe('thumbSrc', () => {
  it('prefers the square image, then small, then medium (v3 uses .src)', () => {
    expect(thumbSrc({ image: { square: { src: 'a' }, medium: { src: 'c' } } })).toBe('a');
    expect(thumbSrc({ image: { small: { src: 'b' }, medium: { src: 'c' } } })).toBe('b');
    expect(thumbSrc({ image: { medium: { src: 'c' } } })).toBe('c');
  });
  it('falls back to an embed thumbnail', () => {
    expect(thumbSrc({ embed: { thumbnail_url: 'e' } })).toBe('e');
  });
  it('ignores the old v2 .url fields', () => {
    expect(thumbSrc({ image: { thumb: { url: 'x' }, square: { url: 'y' } } })).toBeNull();
  });
  it('returns null with no picture', () => {
    expect(thumbSrc({ class: 'Text' })).toBeNull();
    expect(thumbSrc(null)).toBeNull();
  });
});

describe('thumbLabel', () => {
  it('labels each kind of block without a picture', () => {
    expect(thumbLabel({ class: 'Link', title: 'A link' })).toBe('A link');
    expect(thumbLabel({ class: 'Link', source: { url: 'https://x.test' } })).toBe('https://x.test');
    expect(thumbLabel({ class: 'Text', content: { plain: 'hello' } })).toBe('hello');
    expect(thumbLabel({ class: 'Channel', title: 'Sub' })).toBe('↳ Sub');
    expect(thumbLabel({ class: 'Image' })).toBe('Image');
  });
  it('truncates long text', () => {
    expect(thumbLabel({ class: 'Text', content: { plain: 'x'.repeat(100) } }).length).toBe(40);
  });
});

describe('describeBlock', () => {
  it('uses the title, then the text, then the id', () => {
    expect(describeBlock({ class: 'Image', title: 'sunset.jpg', id: 1 })).toBe('Image "sunset.jpg"');
    expect(describeBlock({ class: 'Text', content: { plain: 'hello world' }, id: 5 })).toBe('Text "hello world"');
    expect(describeBlock({ class: 'Text', content: { plain: '' }, id: 6 })).toBe('Text #6');
    expect(describeBlock({ class: 'Image', id: 7 })).toBe('Image #7');
  });
  it('does not throw when content is an object with no text (v3), or a string (v2)', () => {
    expect(describeBlock({ class: 'Text', content: {}, id: 8 })).toBe('Text #8');
    expect(describeBlock({ class: 'Text', content: 'plain string', id: 9 })).toBe('Text "plain string"');
  });
});

describe('connectableType', () => {
  it('is Channel for a channel, Block otherwise', () => {
    expect(connectableType({ class: 'Channel' })).toBe('Channel');
    expect(connectableType({ type: 'Channel' })).toBe('Channel');
    expect(connectableType({ class: 'Image' })).toBe('Block');
  });
});

describe('planMerge', () => {
  it('adds what is not already there and counts the rest as skipped', () => {
    const plan = planMerge([{ id: 1 }, { id: 2 }, { id: 3 }], new Set([2]));
    expect(plan.toAdd.map(b => b.id)).toEqual([1, 3]);
    expect(plan.skipped).toBe(1);
  });
  it('handles an empty destination and an empty source', () => {
    expect(planMerge([{ id: 1 }], new Set()).skipped).toBe(0);
    expect(planMerge([], new Set([1])).toAdd).toEqual([]);
  });
});

describe('summaryLines', () => {
  const base = { toAdd: 2, skipped: 0, sourceTitle: 'A', destTitle: 'B', deleteFromSource: false, quietMode: false, destStatus: 'public' };
  it('always has the add line', () => {
    expect(summaryLines(base).map(l => l.kind)).toEqual(['add']);
  });
  it('adds skip, remove and quiet lines when they apply', () => {
    expect(summaryLines({ ...base, skipped: 1, deleteFromSource: true, quietMode: true }).map(l => l.kind)).toEqual(['add', 'skip', 'remove', 'quiet']);
  });
  it('leaves out the quiet line when the destination is already private', () => {
    expect(summaryLines({ ...base, quietMode: true, destStatus: 'private' }).map(l => l.kind)).toEqual(['add']);
  });
});

describe('small formatters', () => {
  it('pluralises blocks', () => {
    expect(pluralBlocks(1)).toBe('1 block');
    expect(pluralBlocks(0)).toBe('0 blocks');
  });
  it('truncates with an ellipsis', () => {
    expect(truncate('abcdef', 4)).toBe('abc…');
    expect(truncate('abc', 4)).toBe('abc');
    expect(truncate(null, 4)).toBe('');
  });
});
