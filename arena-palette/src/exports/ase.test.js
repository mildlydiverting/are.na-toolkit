import { describe, it, expect } from 'vitest';
import { buildAse } from './ase.js';
import { fixtureCtx } from './export-fixture.js';

// Walks an ASE file and returns its header plus each block { type, name, model?, values? }.
function readAse(buffer) {
  const view = new DataView(buffer);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  const header = { magic, major: view.getUint16(4), minor: view.getUint16(6), count: view.getUint32(8) };
  const blocks = [];
  let at = 12;
  while (at < buffer.byteLength) {
    const type = view.getUint16(at);
    const len = view.getUint32(at + 2);
    const body = at + 6;
    const nameLen = len ? view.getUint16(body) : 0;           // characters, including the terminator
    let name = '';
    for (let i = 0; i < nameLen - 1; i++) name += String.fromCharCode(view.getUint16(body + 2 + i * 2));
    const block = { type, len, name, nameLen };
    if (type === 0x0001) {
      const after = body + 2 + nameLen * 2;
      block.model = String.fromCharCode(...new Uint8Array(buffer, after, 4));
      block.values = [0, 4, 8].map(o => view.getFloat32(after + 4 + o));
      block.colourType = view.getUint16(after + 16);
    }
    blocks.push(block);
    at = body + len;
  }
  return { header, blocks, end: at };
}

describe('buildAse', () => {
  const buf = buildAse(fixtureCtx);
  const ase = readAse(buf);

  it('has the ASEF header, version 1.0 and a correct block count', () => {
    expect(ase.header.magic).toBe('ASEF');
    expect([ase.header.major, ase.header.minor]).toEqual([1, 0]);
    expect(ase.blocks).toHaveLength(ase.header.count);
    expect(ase.header.count).toBe(36); // 5 base + 4 semantic + 3 × 9 ramps
  });

  it('has block lengths that add up exactly to the file size', () => {
    expect(ase.end).toBe(buf.byteLength);
  });

  it('opens and closes every group', () => {
    const starts = ase.blocks.filter(b => b.type === 0xC001).length;
    const ends = ase.blocks.filter(b => b.type === 0xC002).length;
    expect(starts).toBe(5);
    expect(ends).toBe(5);
  });

  it('names the groups', () => {
    const groups = ase.blocks.filter(b => b.type === 0xC001).map(b => b.name);
    expect(groups).toEqual([
      'Base colours', 'Semantic palette', '#ff0000 Red', '#0a141e', '#c8b45a Mustard',
    ]);
  });

  it('writes RGB colours as float32 with a global colour type', () => {
    const red = ase.blocks.find(b => b.type === 0x0001);
    expect(red.name).toBe('#ff0000 Red (60%)');
    expect(red.model).toBe('RGB ');
    expect(red.values).toEqual([1, 0, 0]);
    expect(red.colourType).toBe(0);
  });

  it('names the colours (record of v1.31 naming, to review later)', () => {
    expect(ase.blocks.filter(b => b.type === 0x0001).map(b => b.name)).toMatchSnapshot();
  });
});
