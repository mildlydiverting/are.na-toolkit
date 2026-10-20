import { describe, it, expect } from 'vitest';
import { clusterBlocks, keysForBlock } from './clustering.js';

const emilyBall = [
  { id: 25195237, source: { url: 'https://www.instagram.com/p/CKwkFh1H2a-/' } },
  { id: 13858507, description: { plain: 'https://www.instagram.com/p/CKwkFh1H2a-/?utm_medium=share_sheet' } },
  { id: 13857023, description: { plain: 'https://www.instagram.com/p/CKwkFh1H2a-/' } },
  { id: 51348562, source: { url: 'https://instagram.com/p/CKwkFh1H2a-' } },
];

const redPrint = [
  { id: 51566599, source: { url: 'https://uk.pinterest.com/pin/256283035039248645/' } },
  { id: 36110074, source: { url: 'https://www.pinterest.com/pin/256283035039248645/?created_at=2024' } },
];

describe('clusterBlocks', () => {
  it('finds the Emily Ball cluster across source and description URLs', () => {
    const clusters = clusterBlocks(emilyBall, { sourceUrl: true, descriptionUrls: true });
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(4);
  });

  it('finds the red print cluster via Pinterest pin id', () => {
    const clusters = clusterBlocks(redPrint, { sourceUrl: true });
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(2);
  });

  it('returns nothing for empty input or blocks with no usable keys', () => {
    expect(clusterBlocks([], { sourceUrl: true })).toEqual([]);
    expect(clusterBlocks([{ id: 1 }, { id: 2 }], { sourceUrl: true, descriptionUrls: true })).toEqual([]);
  });

  it('filters out single-block groups', () => {
    const blocks = [
      { id: 1, source: { url: 'https://example.com/a' } },
      { id: 2, source: { url: 'https://example.com/b' } },
    ];
    expect(clusterBlocks(blocks, { sourceUrl: true })).toEqual([]);
  });

  it('only uses the matchers that are switched on', () => {
    expect(clusterBlocks(emilyBall, { sourceUrl: true })[0]).toHaveLength(2);
    expect(clusterBlocks(emilyBall, { descriptionUrls: true })[0]).toHaveLength(2);
  });

  it('does not treat one block seen in two channels as a duplicate of itself', () => {
    const b = { id: 1, source: { url: 'https://example.com/a' } };
    expect(clusterBlocks([b, b], { sourceUrl: true })).toEqual([]);
  });

  it('skips blocks already marked dupe_of when skipMarked is on', () => {
    const marked = redPrint.map((b, i) => (i === 0 ? { ...b, metadata: { dupe_of: 36110074 } } : b));
    expect(clusterBlocks(marked, { sourceUrl: true, skipMarked: true })).toEqual([]);
    expect(clusterBlocks(marked, { sourceUrl: true })).toHaveLength(1);
  });

  it('matches on title + description only when asked, and ignores short ones', () => {
    const long = { title: 'Red print', description: { plain: 'Linocut, two colours, 2019' } };
    const blocks = [{ id: 1, ...long }, { id: 2, ...long }, { id: 3, title: 'ab', description: { plain: 'short' } }];
    expect(clusterBlocks(blocks, { sourceUrl: true })).toEqual([]);
    expect(clusterBlocks(blocks, { titleDesc: true })[0].map(b => b.id)).toEqual([1, 2]);
  });
});

describe('keysForBlock', () => {
  it('gives one key when source and description point at the same place', () => {
    const b = { source: { url: 'https://instagram.com/p/X/' }, description: { plain: 'https://www.instagram.com/p/X' } };
    expect(keysForBlock(b, { sourceUrl: true, descriptionUrls: true })).toEqual(['instagram.com/p/X']);
  });
});
