import { describe, it, expect } from 'vitest';
import {
  swatchLabel, cssSlug, exportHeader, buildHex, buildRgb, buildHsl, buildCss, buildScp, buildGpl,
} from './text.js';
import { fixtureCtx } from './export-fixture.js';

describe('swatchLabel', () => {
  it('joins hex, name, percentage and suffix, skipping what is missing', () => {
    expect(swatchLabel('#ff0000')).toBe('#ff0000');
    expect(swatchLabel('#ff0000', 'Red', 60)).toBe('#ff0000 Red (60%)');
    expect(swatchLabel('#ff0000', 'Red', null, 'tint 2')).toBe('#ff0000 Red tint 2');
    expect(swatchLabel('#ff0000', undefined, 0)).toBe('#ff0000 (0%)');
  });
});

describe('cssSlug', () => {
  it('makes a custom-property-safe slug', () => {
    expect(cssSlug('Warm Cinnabar', 'color-1')).toBe('warm-cinnabar');
    expect(cssSlug("Gray's  Gray!", 'color-1')).toBe('gray-s-gray');
  });
  it('falls back when there is no usable name', () => {
    expect(cssSlug(undefined, 'color-2')).toBe('color-2');
    expect(cssSlug('***', 'color-3')).toBe('color-3');
  });
});

describe('exportHeader', () => {
  it('lists title and source when present', () => {
    expect(exportHeader(fixtureCtx)).toBe(
      'arena-palette export\nImage:  Test image\nSource: https://www.are.na/block/123\n---\n\n');
  });
  it('omits them when absent', () => {
    expect(exportHeader({ title: '', blockUrl: '' })).toBe('arena-palette export\n---\n\n');
  });
});

// Characterisation snapshots: these record v1.31's output so the Phase 4 rework can be compared with it.
describe('text exports (v1.31 output)', () => {
  it('hex', () => expect(buildHex(fixtureCtx)).toMatchSnapshot());
  it('rgb', () => expect(buildRgb(fixtureCtx)).toMatchSnapshot());
  it('hsl', () => expect(buildHsl(fixtureCtx)).toMatchSnapshot());
  it('css', () => expect(buildCss(fixtureCtx)).toMatchSnapshot());
  it('scp', () => expect(buildScp(fixtureCtx)).toMatchSnapshot());
  it('gpl', () => expect(buildGpl(fixtureCtx)).toMatchSnapshot());
});

describe('text exports, structure', () => {
  it('scp is valid JSON with the three sections', () => {
    const scp = JSON.parse(buildScp(fixtureCtx));
    expect(Object.keys(scp)).toEqual(['name', 'sourceUrl', 'palette', 'semantic', 'tintsShades']);
    expect(scp.palette).toHaveLength(3);
    expect(scp.palette[0]).toEqual({ hex: '#ff0000', name: 'Red', proportion: 0.6 });
    expect(scp.tintsShades[0].tints).toHaveLength(3);
  });
  it('scp falls back to the channel when there is no title', () => {
    expect(JSON.parse(buildScp({ ...fixtureCtx, title: '' })).name).toBe('chromatic-vwdupl8d0lk');
  });
  it('gpl starts with the GIMP header, 7 columns, tab-separated rows', () => {
    const lines = buildGpl(fixtureCtx).split('\n');
    expect(lines.slice(0, 4)).toEqual(['GIMP Palette', 'Name: Test image', 'Columns: 7', '#']);
    expect(lines.find(l => l.startsWith('255\t0\t0\t'))).toBe('255\t0\t0\t#ff0000 Red (60%)');
  });
  it('gpl names the file after the slug when there is no title', () => {
    expect(buildGpl({ ...fixtureCtx, title: '' }).split('\n')[1]).toBe('Name: chromatic-block-123');
  });
  it('leaves out the semantic section when there is none', () => {
    expect(buildHex({ ...fixtureCtx, semantic: [] })).not.toContain('Semantic palette');
    expect(buildGpl({ ...fixtureCtx, semantic: [] })).not.toContain('Semantic palette');
  });
  it('css names variables by colour name, with a numbered fallback', () => {
    const css = buildCss(fixtureCtx);
    expect(css).toContain('--red:');
    expect(css).toContain('--color-2:');
    expect(css).toContain('--mustard-tint-3:');
    expect(css).toContain('--semantic-dark-muted:');
  });
});
