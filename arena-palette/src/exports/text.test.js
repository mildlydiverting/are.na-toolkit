import { describe, it, expect } from 'vitest';
import {
  swatchLabel, cssSlug, exportHeader, buildHex, buildRgb, buildHsl, buildCss, buildScp, buildGpl,
  buildExportContext, exportSlug, rampLayout,
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

describe('buildExportContext', () => {
  const image = { title: 'Test image', channel: 'chromatic-vwdupl8d0lk', id: 123, blockUrl: 'https://www.are.na/block/123' };
  const palette = [
    { hex: '#ff0000', name: 'Red', proportion: 0.6 },
    { hex: '#0a141e', name: undefined, proportion: 0.3 },
    { hex: '#c8b45a', name: 'Mustard', proportion: 0.1 },
  ];
  const semantic = [
    { role: 'Vibrant', hex: '#ff0000', name: 'Red', proportion: 0.7 },
    { role: 'DarkMuted', hex: '#0a141e', name: '', proportion: 0.3 },
  ];

  it('gives the shape the builders (and their fixture) expect', () => {
    expect(buildExportContext({ image, palette, semantic, ramps: fixtureCtx.ramps })).toEqual(fixtureCtx);
  });

  it('carries no ramps unless they are passed', () => {
    expect(buildExportContext({ image, palette, semantic }).ramps).toBeNull();
  });

  it('leaves the semantic colours out when none are passed', () => {
    expect(buildExportContext({ image, palette }).semantic).toEqual([]);
  });

  it('skips colours with no name yet or no name at all', () => {
    expect(Object.keys(buildExportContext({ image, palette, semantic }).names).sort()).toEqual(['c8b45a', 'ff0000']);
  });
});

describe('rampLayout', () => {
  const ramp = { steps: ['#eee', '#ccc', '#aaa', '#888', '#555'], markerIndex: 2 };
  it('numbers tints and shades away from the base, which keeps no label', () => {
    expect(rampLayout(ramp).map(s => s.label)).toEqual(['tint 2', 'tint 1', null, 'shade 1', 'shade 2']);
    expect(rampLayout(ramp).map(s => s.key)).toEqual(['tint-2', 'tint-1', 'base', 'shade-1', 'shade-2']);
  });
  it('copes with the base at either end', () => {
    expect(rampLayout({ steps: ['#aaa', '#888'], markerIndex: 0 }).map(s => s.kind)).toEqual(['base', 'shade']);
    expect(rampLayout({ steps: ['#eee', '#aaa'], markerIndex: 1 }).map(s => s.kind)).toEqual(['tint', 'base']);
  });
});

describe('text exports, base colours only', () => {
  const base = { ...fixtureCtx, ramps: null };
  it('leave out tints and shades everywhere', () => {
    for (const out of [buildHex(base), buildRgb(base), buildHsl(base)]) expect(out).not.toContain('Tints and Shades');
    expect(buildCss(base)).not.toContain('tint');
    expect(buildGpl(base)).not.toContain('tint');
    expect(Object.keys(JSON.parse(buildScp(base)))).toEqual(['name', 'sourceUrl', 'palette', 'semantic']);
  });
  it('gpl columns follow the palette length', () => {
    expect(buildGpl(base).split('\n')[2]).toBe('Columns: 3');
  });
});

describe('text exports, ramps of any length', () => {
  const five = { ...fixtureCtx, ramps: fixtureCtx.palette.map(() => ({ steps: ['#eeeeee', '#cccccc', '#aaaaaa', '#888888', '#555555'], markerIndex: 2 })) };
  it('gpl columns follow the ramp length', () => {
    expect(buildGpl(five).split('\n')[2]).toBe('Columns: 5');
  });
  it('css names every step from the base outwards', () => {
    const css = buildCss(five);
    for (const v of ['--red-tint-2:', '--red-tint-1:', '--red-base:', '--red-shade-1:', '--red-shade-2:']) expect(css).toContain(v);
    expect(css).not.toContain('--red-tint-3');
  });
  it('scp lists tints and shades from the ramp', () => {
    const scp = JSON.parse(buildScp(five));
    expect(scp.tintsShades[0].tints.map(t => t.label)).toEqual(['tint 2', 'tint 1']);
    expect(scp.tintsShades[0].shades.map(t => t.label)).toEqual(['shade 1', 'shade 2']);
  });
  it('hex lists all five steps under each colour', () => {
    expect(buildHex(five)).toContain('/* #eeeeee Red tint 2 */\n#eeeeee');
  });
});

describe('exportSlug', () => {
  it('drops the are.na hash from a channel slug and adds the block id', () => {
    expect(exportSlug({ channel: 'chromatic-vwdupl8d0lk', id: 44858120 })).toBe('chromatic-block-44858120');
  });

  it('names a block pasted on its own after the block', () => {
    expect(exportSlug({ channel: '', id: 44858120 })).toBe('block-44858120');
  });

  it('falls back to palette with no image', () => {
    expect(exportSlug(null)).toBe('palette');
  });
});
