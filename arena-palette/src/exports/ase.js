// exports/ase.js: binary download helper and Adobe Swatch Exchange export.

import { rgbToHex, hexToRgb, makeTintsShades, TINT_STEPS } from '../colour.js';
import { swatchLabel, exportContext, exportSlug } from './text.js';

export function downloadBinary(buffer, filename) {
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── EXPORT — ASE (Adobe Swatch Exchange) ──────────────────────────────────────
export function buildAse(ctx) {
  const palette = ctx.palette;
  // ASE binary format — big-endian throughout
  // Spec: https://www.adobe.com/devnet-apps/photoshop/fileformatashtml/

  function writeUTF16BE(str) {
    // null-terminated UTF-16BE string, length-prefixed (uint16 = char count + 1)
    const len = str.length + 1;
    const buf = new ArrayBuffer(2 + len * 2);
    const view = new DataView(buf);
    view.setUint16(0, len, false);
    for (let i = 0; i < str.length; i++) {
      view.setUint16(2 + i * 2, str.charCodeAt(i), false);
    }
    view.setUint16(2 + str.length * 2, 0, false); // null terminator
    return buf;
  }

  function colourBlock(name, rgb) {
    // Block type 0x0001 = colour entry
    const nameBuffer   = writeUTF16BE(name);
    const modelBuffer  = new TextEncoder().encode('RGB '); // 4 bytes
    const valBuffer    = new ArrayBuffer(12); // 3× float32
    const valView      = new DataView(valBuffer);
    valView.setFloat32(0, rgb[0] / 255, false);
    valView.setFloat32(4, rgb[1] / 255, false);
    valView.setFloat32(8, rgb[2] / 255, false);
    const typeBuffer   = new ArrayBuffer(2);
    new DataView(typeBuffer).setUint16(0, 0, false); // 0 = global

    const bodyLen = nameBuffer.byteLength + 4 + 12 + 2;
    const header  = new ArrayBuffer(6);
    const hv      = new DataView(header);
    hv.setUint16(0, 0x0001, false); // block type: colour
    hv.setUint32(2, bodyLen, false);

    return [header, nameBuffer, modelBuffer, valBuffer, typeBuffer];
  }

  function groupStartBlock(name) {
    const nameBuffer = writeUTF16BE(name);
    const header     = new ArrayBuffer(6);
    const hv         = new DataView(header);
    hv.setUint16(0, 0xC001, false); // group start
    hv.setUint32(2, nameBuffer.byteLength, false);
    return [header, nameBuffer];
  }

  function groupEndBlock() {
    const buf = new ArrayBuffer(6);
    const view = new DataView(buf);
    view.setUint16(0, 0xC002, false); // group end
    view.setUint32(2, 0, false);
    return [buf];
  }

  // Assemble blocks — order: base colours, semantic palette, tints/shades per colour
  const blocks = [];
  let blockCount = 0;

  // 1. Base colours group
  blocks.push(...groupStartBlock('Base colours'));
  blockCount++;
  palette.forEach((rgb, i) => {
    const baseHex = rgbToHex(rgb);
    const name    = ctx.names[baseHex.slice(1).toLowerCase()];
    const pct     = Math.round((ctx.proportions[i] ?? 0) * 100);
    blocks.push(...colourBlock(swatchLabel(baseHex, name, pct || null), rgb));
    blockCount++;
  });
  blocks.push(...groupEndBlock());
  blockCount++;

  // 2. Semantic group
  if (ctx.semantic.length) {
    blocks.push(...groupStartBlock('Semantic palette'));
    blockCount++;
    ctx.semantic.forEach(({ role, hex, proportion }) => {
      const pct = Math.round((proportion ?? 0) * 100);
      blocks.push(...colourBlock(swatchLabel(hex, role, pct || null), hexToRgb(hex)));
      blockCount++;
    });
    blocks.push(...groupEndBlock());
    blockCount++;
  }

  // 3. Tints & shades per colour
  palette.forEach((rgb, i) => {
    const baseHex = rgbToHex(rgb);
    const name    = ctx.names[baseHex.slice(1).toLowerCase()];
    const pct     = Math.round((ctx.proportions[i] ?? 0) * 100);

    blocks.push(...groupStartBlock(swatchLabel(baseHex, name)));
    blockCount++;

    const { tints, shades } = makeTintsShades(rgb);
    tints.forEach((c, ti) => {
      const h = rgbToHex(c);
      blocks.push(...colourBlock(swatchLabel(h, name, null, `tint ${TINT_STEPS - ti}`), c));
      blockCount++;
    });
    blocks.push(...colourBlock(swatchLabel(baseHex, name, pct || null), rgb));
    blockCount++;
    shades.forEach((c, si) => {
      const h = rgbToHex(c);
      blocks.push(...colourBlock(swatchLabel(h, name, null, `shade ${si + 1}`), c));
      blockCount++;
    });

    blocks.push(...groupEndBlock());
    blockCount++;
  });

  // File header: magic + version + block count
  const magic   = new TextEncoder().encode('ASEF');
  const fileHdr = new ArrayBuffer(8);
  const fhv     = new DataView(fileHdr);
  fhv.setUint16(0, 1, false); // version major
  fhv.setUint16(2, 0, false); // version minor
  fhv.setUint32(4, blockCount, false);

  // Concatenate all buffers
  const all    = [magic, fileHdr, ...blocks];
  const total  = all.reduce((n, b) => n + b.byteLength, 0);
  const out    = new Uint8Array(total);
  let offset   = 0;
  all.forEach(b => {
    out.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  });

  return out.buffer;
}

export function exportAse(palette) {
  downloadBinary(buildAse(exportContext(palette)), `${exportSlug()}.ase`);
}
