import { describe, it, expect } from 'vitest';
import { defaultDecision, chooseCanonical, changedFields, copyOptions, orderClusters, tally, nextPending, blockTitle, imageFacts, looksDifferent } from './review.js';

const block = (id, extra = {}) => ({ id, type: 'Image', title: `T${id}`, description: { plain: `D${id}` }, image: { alt_text: '' }, ...extra });
const cluster = (id, blocks, channelIds = [1], places = {}) => ({ id, blocks, channelIds, scope: channelIds.length > 1 ? 'cross' : 'single', places });

describe('defaultDecision', () => {
  it('keeps the oldest (first) block and merges the rest', () => {
    const d = defaultDecision(cluster('c', [block(1), block(2), block(3)]));
    expect(d.canonicalId).toBe(1);
    expect(d.actions).toEqual({ 2: 'merge', 3: 'merge' });
    expect(d.status).toBe('pending');
    expect(d.edits).toEqual({ title: 'T1', description: 'D1', alt_text: '' });
  });

  it('prefers the markdown source of a description', () => {
    const d = defaultDecision(cluster('c', [block(1, { description: { markdown: '**hi**', plain: 'hi' } }), block(2)]));
    expect(d.edits.description).toBe('**hi**');
  });
});

describe('chooseCanonical', () => {
  const c = cluster('c', [block(1), block(2), block(3)]);

  it('swaps the keeper, makes the old one a merge, and keeps other actions', () => {
    let d = defaultDecision(c);
    d = { ...d, actions: { 2: 'leave', 3: 'merge' } };
    const next = chooseCanonical(c, d, 3);
    expect(next.canonicalId).toBe(3);
    expect(next.actions).toEqual({ 1: 'merge', 2: 'leave' });
    expect(next.edits.title).toBe('T3');
  });

  it('does nothing when the keeper is unchanged', () => {
    const d = defaultDecision(c);
    expect(chooseCanonical(c, d, 1)).toBe(d);
  });

  it('puts a resolved cluster back to pending when the keeper changes', () => {
    const d = { ...defaultDecision(c), status: 'resolved' };
    expect(chooseCanonical(c, d, 2).status).toBe('pending');
  });
});

describe('changedFields', () => {
  const c = cluster('c', [block(1), block(2)]);

  it('is empty when nothing was edited', () => {
    expect(changedFields(c, defaultDecision(c))).toEqual({});
  });

  it('reports only the fields that differ', () => {
    const d = defaultDecision(c);
    d.edits.title = 'New title';
    expect(changedFields(c, d)).toEqual({ title: 'New title' });
  });

  it('ignores alt text for blocks that are not images', () => {
    const t = cluster('t', [block(1, { type: 'Text', image: undefined }), block(2)]);
    const d = defaultDecision(t);
    d.edits.alt_text = 'something';
    expect(changedFields(t, d)).toEqual({});
  });
});

describe('copyOptions', () => {
  it('offers longer values from the other blocks only', () => {
    const c = cluster('c', [block(1, { title: 'Hi' }), block(2, { title: 'A longer title' }), block(3, { title: '' })]);
    const d = defaultDecision(c);
    expect(copyOptions(c, d, 'title')).toEqual([{ blockId: 2, value: 'A longer title' }]);
  });
});

describe('orderClusters', () => {
  it('groups single-channel clusters by channel, then lists cross-channel ones', () => {
    const place = (channelId, channelTitle) => [{ channelId, channelTitle }];
    const a = cluster('a', [block(1)], [1], { 1: place(1, 'Drawing') });
    const x = cluster('x', [block(2)], [1, 2], {});
    const b = cluster('b', [block(3)], [2], { 3: place(2, 'Prints') });
    const c = cluster('c', [block(4)], [1], { 4: place(1, 'Drawing') });
    const out = orderClusters([a, x, b, c]);
    expect(out.map(i => [i.cluster.id, i.label])).toEqual([['a', 'In Drawing'], ['c', 'In Drawing'], ['b', 'In Prints'], ['x', 'Across 2 channels']]);
  });
});

describe('tally and nextPending', () => {
  const items = ['a', 'b', 'c', 'd'].map(id => ({ cluster: { id } }));
  const decisions = { a: { status: 'resolved' }, b: { status: 'skipped' }, d: { status: 'pending' } };

  it('counts statuses, treating no decision as pending', () => {
    expect(tally(items, decisions)).toEqual({ pending: 2, resolved: 1, skipped: 1 });
  });

  it('finds the next and previous pending cluster', () => {
    expect(nextPending(items, decisions, 0, 1)).toBe(2);
    expect(nextPending(items, decisions, 2, 1)).toBe(3);
    expect(nextPending(items, decisions, 3, 1)).toBeNull();
    expect(nextPending(items, decisions, 3, -1)).toBe(2);
    expect(nextPending(items, decisions, 2, -1)).toBeNull();
  });
});

describe('blockTitle', () => {
  it('falls back to the generated title, then the id', () => {
    expect(blockTitle({ id: 5, title: 'Mine' })).toBe('Mine');
    expect(blockTitle({ id: 5, generated_title: 'Gen' })).toBe('Gen');
    expect(blockTitle({ id: 5 })).toBe('Block 5');
  });
});

describe('imageFacts', () => {
  it('reads pixel size, file size and filename', () => {
    expect(imageFacts({ image: { width: 1920, height: 1675, file_size: 566963, filename: 'a.jpg' } })).toEqual({ dimensions: '1920 × 1675', size: '554 KB', filename: 'a.jpg' });
    expect(imageFacts({ image: { file_size: 2 * 1048576 } }).size).toBe('2.0 MB');
  });
  it('is null for blocks that are not images', () => {
    expect(imageFacts({ id: 1 })).toBeNull();
  });
});

describe('looksDifferent', () => {
  it('flags different titles', () => {
    expect(looksDifferent([{ title: 'Terepeza' }, { title: 'Daphne' }])).toEqual(['the titles differ']);
  });
  it('flags different proportions', () => {
    expect(looksDifferent([{ image: { aspect_ratio: 1.1463 } }, { image: { aspect_ratio: 1.3251 } }])).toEqual(['the pictures have different proportions']);
  });
  it('is quiet for the same title and shape, or when titles are missing', () => {
    expect(looksDifferent([{ title: 'Print ', image: { aspect_ratio: 1.5 } }, { title: 'print', image: { aspect_ratio: 1.51 } }])).toEqual([]);
    expect(looksDifferent([{ title: 'Only one' }, {}])).toEqual([]);
  });
});
