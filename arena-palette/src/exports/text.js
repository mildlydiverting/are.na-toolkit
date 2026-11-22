// exports/text.js: filenames, labels and the text exports (hex, RGB, HSL, CSS, SCP, GPL).

import { rgbToHex, hexToRgb, rgbToHsl, makeTintsShades, TINT_STEPS, SHADE_STEPS } from '../colour.js';

// ── EXPORTS ───────────────────────────────────────────────────────────────────
export function downloadText(content, filename) {
  const a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
  a.download = filename;
  a.click();
}

export function slugName() {
  return currentImageObj ? currentImageObj.channel : 'palette';
}

// Export filename base: strip the Are.na hash suffix from the channel slug
// and append the block id. e.g. "chromatic-vwdupl8d0lk" + id 44858120
// => "chromatic-block-44858120"
export function exportSlug() {
  if (!currentImageObj) return 'palette';
  const channel = currentImageObj.channel.replace(/-(?=[a-z0-9]{7,}$)[a-z0-9]*[0-9][a-z0-9]*$/i, '');
  const id = currentImageObj.id || '';
  return id ? `${channel}-block-${id}` : channel;
}

export function colourTitle(index, hex) {
  const name = currentColorNames[hex.slice(1).toLowerCase()];
  return name
    ? `Colour ${index + 1} — ${hex} — ${name}`
    : `Colour ${index + 1} — ${hex}`;
}

// Consistent label: #hex [Name] [(xx%)] [tint N / shade N]
// Pass null/undefined for fields to omit.
export function swatchLabel(hex, name, pct, suffix) {
  const parts = [hex];
  if (name) parts.push(name);
  if (pct != null) parts.push(`(${pct}%)`);
  if (suffix) parts.push(suffix);
  return parts.join(' ');
}

// CSS variable name slug: "Warm Cinnabar" → "warm-cinnabar"
export function cssSlug(name, fallback) {
  if (!name) return fallback;
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
}

export function exportHeader(ctx) {
  const title = ctx.title;
  const url   = ctx.blockUrl;
  const lines = ['arena-palette export'];
  if (title) lines.push(`Image:  ${title}`);
  if (url)   lines.push(`Source: ${url}`);
  lines.push('---');
  return lines.join('\n') + '\n\n';
}

export function buildHex(ctx) {
  const palette = ctx.palette;
  const out = [exportHeader(ctx)];

  // 1. Palette
  out.push('/* Palette */\n');
  palette.forEach((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = ctx.names[hex.slice(1).toLowerCase()];
    const pct  = Math.round((ctx.proportions[i] ?? 0) * 100);
    out.push(`/* ${swatchLabel(hex, name, pct || null)} */\n${hex}\n`);
  });

  // 2. Semantic palette
  if (ctx.semantic.length) {
    out.push('/* Semantic palette */\n');
    ctx.semantic.forEach(({ role, hex, proportion }) => {
      const pct = Math.round((proportion ?? 0) * 100);
      out.push(`/* ${swatchLabel(hex, role, pct || null)} */\n${hex}\n`);
    });
  }

  // 3. Tints and Shades
  out.push('/* Tints and Shades */\n');
  palette.forEach((rgb) => {
    const hex  = rgbToHex(rgb);
    const name = ctx.names[hex.slice(1).toLowerCase()];
    const { tints, shades } = makeTintsShades(rgb);
    out.push(`/* ${swatchLabel(hex, name)} */`); // block header
    tints.forEach((c, ti) => {
      const th = rgbToHex(c);
      out.push(`/* ${swatchLabel(th, name, null, `tint ${TINT_STEPS - ti}`)} */\n${th}`);
    });
    out.push(`/* ${swatchLabel(hex, name)} */\n${hex}`);
    shades.forEach((c, si) => {
      const sh = rgbToHex(c);
      out.push(`/* ${swatchLabel(sh, name, null, `shade ${si + 1}`)} */\n${sh}`);
    });
    out.push('');
  });

  return out.join('\n');
}

export function buildRgb(ctx) {
  const palette = ctx.palette;
  const out = [exportHeader(ctx)];

  // 1. Palette
  out.push('/* Palette */\n');
  palette.forEach((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = ctx.names[hex.slice(1).toLowerCase()];
    const pct  = Math.round((ctx.proportions[i] ?? 0) * 100);
    out.push(`/* ${swatchLabel(hex, name, pct || null)} */\nrgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})\n`);
  });

  // 2. Semantic palette
  if (ctx.semantic.length) {
    out.push('/* Semantic palette */\n');
    ctx.semantic.forEach(({ role, hex, proportion }) => {
      const rgb = hexToRgb(hex);
      const pct = Math.round((proportion ?? 0) * 100);
      out.push(`/* ${swatchLabel(hex, role, pct || null)} */\nrgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})\n`);
    });
  }

  // 3. Tints and Shades
  out.push('/* Tints and Shades */\n');
  palette.forEach((rgb) => {
    const hex  = rgbToHex(rgb);
    const name = ctx.names[hex.slice(1).toLowerCase()];
    const { tints, shades } = makeTintsShades(rgb);
    out.push(`/* ${swatchLabel(hex, name)} */`);
    tints.forEach((c, ti) => {
      const th = rgbToHex(c);
      out.push(`/* ${swatchLabel(th, name, null, `tint ${TINT_STEPS - ti}`)} */\nrgb(${c[0]}, ${c[1]}, ${c[2]})`);
    });
    out.push(`/* ${swatchLabel(hex, name)} */\nrgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
    shades.forEach((c, si) => {
      const sh = rgbToHex(c);
      out.push(`/* ${swatchLabel(sh, name, null, `shade ${si + 1}`)} */\nrgb(${c[0]}, ${c[1]}, ${c[2]})`);
    });
    out.push('');
  });

  return out.join('\n');
}

export function buildHsl(ctx) {
  const palette = ctx.palette;
  const out = [exportHeader(ctx)];

  // 1. Palette
  out.push('/* Palette */\n');
  palette.forEach((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = ctx.names[hex.slice(1).toLowerCase()];
    const pct  = Math.round((ctx.proportions[i] ?? 0) * 100);
    const [h,s,l] = rgbToHsl(rgb);
    out.push(`/* ${swatchLabel(hex, name, pct || null)} */\nhsl(${h}, ${s}%, ${l}%)\n`);
  });

  // 2. Semantic palette
  if (ctx.semantic.length) {
    out.push('/* Semantic palette */\n');
    ctx.semantic.forEach(({ role, hex, proportion }) => {
      const rgb = hexToRgb(hex);
      const [h,s,l] = rgbToHsl(rgb);
      const pct = Math.round((proportion ?? 0) * 100);
      out.push(`/* ${swatchLabel(hex, role, pct || null)} */\nhsl(${h}, ${s}%, ${l}%)\n`);
    });
  }

  // 3. Tints and Shades
  out.push('/* Tints and Shades */\n');
  palette.forEach((rgb) => {
    const hex  = rgbToHex(rgb);
    const name = ctx.names[hex.slice(1).toLowerCase()];
    const { tints, shades } = makeTintsShades(rgb);
    out.push(`/* ${swatchLabel(hex, name)} */`);
    tints.forEach((c, ti) => {
      const th = rgbToHex(c);
      const [h,s,l] = rgbToHsl(c);
      out.push(`/* ${swatchLabel(th, name, null, `tint ${TINT_STEPS - ti}`)} */\nhsl(${h}, ${s}%, ${l}%)`);
    });
    const [bh,bs,bl] = rgbToHsl(rgb);
    out.push(`/* ${swatchLabel(hex, name)} */\nhsl(${bh}, ${bs}%, ${bl}%)`);
    shades.forEach((c, si) => {
      const sh = rgbToHex(c);
      const [h,s,l] = rgbToHsl(c);
      out.push(`/* ${swatchLabel(sh, name, null, `shade ${si + 1}`)} */\nhsl(${h}, ${s}%, ${l}%)`);
    });
    out.push('');
  });

  return out.join('\n');
}

export function buildCss(ctx) {
  const palette = ctx.palette;
  const header = `/*\n * arena-palette export\n * ${ctx.title}\n * ${ctx.blockUrl}\n */\n\n`;
  const varLines = [];

  // 1. Palette — one var per base colour, named by slug
  varLines.push('  /* Palette */');
  palette.forEach((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = ctx.names[hex.slice(1).toLowerCase()];
    const slug = cssSlug(name, `color-${i + 1}`);
    const pct  = Math.round((ctx.proportions[i] ?? 0) * 100);
    const [h,s,l] = rgbToHsl(rgb);
    varLines.push(`  --${slug}: hsl(${h}, ${s}%, ${l}%); /* ${swatchLabel(hex, null, pct || null)} */`);
  });
  varLines.push('');

  // 2. Semantic palette
  if (ctx.semantic.length) {
    varLines.push('  /* Semantic palette */');
    ctx.semantic.forEach(({ role, hex, proportion }) => {
      const rgb = hexToRgb(hex);
      const [h,s,l] = rgbToHsl(rgb);
      const pct = Math.round((proportion ?? 0) * 100);
      const key = role.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
      varLines.push(`  --semantic-${key}: hsl(${h}, ${s}%, ${l}%); /* ${swatchLabel(hex, null, pct || null)} */`);
    });
    varLines.push('');
  }

  // 3. Tints & shades — --slug-tint-N / --slug-base / --slug-shade-N
  varLines.push('  /* Tints & shades */');
  palette.forEach((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = ctx.names[hex.slice(1).toLowerCase()];
    const slug = cssSlug(name, `color-${i + 1}`);
    const { tints, shades } = makeTintsShades(rgb);
    tints.forEach((c, ti) => {
      const th = rgbToHex(c);
      const [h,s,l] = rgbToHsl(c);
      varLines.push(`  --${slug}-tint-${TINT_STEPS - ti}: hsl(${h}, ${s}%, ${l}%); /* ${th} */`);
    });
    const [bh,bs,bl] = rgbToHsl(rgb);
    varLines.push(`  --${slug}-base: hsl(${bh}, ${bs}%, ${bl}%); /* ${hex} */`);
    shades.forEach((c, si) => {
      const sh = rgbToHex(c);
      const [h,s,l] = rgbToHsl(c);
      varLines.push(`  --${slug}-shade-${si + 1}: hsl(${h}, ${s}%, ${l}%); /* ${sh} */`);
    });
    varLines.push('');
  });

  while (varLines[varLines.length - 1] === '') varLines.pop();

  return header + `:root {\n${varLines.join('\n')}\n}`;
}

export function buildScp(ctx) {
  const palette = ctx.palette;
  const paletteEntries = palette.map((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = ctx.names[hex.slice(1).toLowerCase()];
    const pct  = Math.round((ctx.proportions[i] ?? 0) * 100);
    return { hex, ...(name ? { name } : {}), ...(pct ? { proportion: pct / 100 } : {}) };
  });

  const semanticEntries = ctx.semantic.map(({ role, hex, proportion }) => {
    const pct = Math.round((proportion ?? 0) * 100);
    return { role, hex, ...(pct ? { proportion: pct / 100 } : {}) };
  });

  const tintsShades = palette.map((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = ctx.names[hex.slice(1).toLowerCase()];
    const { tints, shades } = makeTintsShades(rgb);
    return {
      hex,
      ...(name ? { name } : {}),
      tints:  tints.map((c, ti) => ({ hex: rgbToHex(c), label: `tint ${TINT_STEPS - ti}` })),
      shades: shades.map((c, si) => ({ hex: rgbToHex(c), label: `shade ${si + 1}` })),
    };
  });

  const payload = {
    name:        ctx.title || ctx.channel,
    sourceUrl:   ctx.blockUrl,
    palette:     paletteEntries,
    semantic:    semanticEntries,
    tintsShades,
  };
  return JSON.stringify(payload, null, 2);
}

// ── EXPORT — GPL (GIMP palette) ───────────────────────────────────────────────
export function buildGpl(ctx) {
  const palette = ctx.palette;
  const title = ctx.title || ctx.slug;
  const lines = [
    'GIMP Palette',
    `Name: ${title}`,
    `Columns: ${1 + TINT_STEPS + SHADE_STEPS}`,
    '#',
  ];

  // 1. Base colours
  lines.push('# Base colours');
  palette.forEach((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = ctx.names[hex.slice(1).toLowerCase()];
    const pct  = Math.round((ctx.proportions[i] ?? 0) * 100);
    lines.push(`${rgb[0]}\t${rgb[1]}\t${rgb[2]}\t${swatchLabel(hex, name, pct || null)}`);
  });

  // 2. Semantic palette
  if (ctx.semantic.length) {
    lines.push('# Semantic palette');
    ctx.semantic.forEach(({ role, hex, proportion }) => {
      const rgb = hexToRgb(hex);
      const pct = Math.round((proportion ?? 0) * 100);
      lines.push(`${rgb[0]}\t${rgb[1]}\t${rgb[2]}\t${swatchLabel(hex, role, pct || null)}`);
    });
  }

  // 3. Tints & shades per colour
  palette.forEach((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = ctx.names[hex.slice(1).toLowerCase()];
    const pct  = Math.round((ctx.proportions[i] ?? 0) * 100);
    lines.push(`# ${swatchLabel(hex, name, pct || null)}`);
    const { tints, shades } = makeTintsShades(rgb);
    tints.forEach((c, ti) => {
      const th = rgbToHex(c);
      lines.push(`${c[0]}\t${c[1]}\t${c[2]}\t${swatchLabel(th, name, null, `tint ${TINT_STEPS - ti}`)}`);
    });
    lines.push(`${rgb[0]}\t${rgb[1]}\t${rgb[2]}\t${swatchLabel(hex, name)}`);
    shades.forEach((c, si) => {
      const sh = rgbToHex(c);
      lines.push(`${c[0]}\t${c[1]}\t${c[2]}\t${swatchLabel(sh, name, null, `shade ${si + 1}`)}`);
    });
  });

  return lines.join('\n');
}

// Everything the builders need, gathered from the page's globals. Builders take this
// and return the file contents, so they stay pure and testable.
export function exportContext(palette) {
  return {
    palette,
    proportions: (currentPalette || []).map(p => p.proportion),
    names:       currentColorNames,
    semantic:    currentSwatchData,
    title:       currentImageObj?.title || '',
    blockUrl:    currentImageObj?.blockUrl || '',
    channel:     slugName(),
    slug:        exportSlug(),
  };
}

export function exportHex(palette) {
  downloadText(buildHex(exportContext(palette)), `${exportSlug()}-hex.txt`);
}

export function exportRgb(palette) {
  downloadText(buildRgb(exportContext(palette)), `${exportSlug()}-rgb.txt`);
}

export function exportHsl(palette) {
  downloadText(buildHsl(exportContext(palette)), `${exportSlug()}-hsl.txt`);
}

export function exportCss(palette) {
  downloadText(buildCss(exportContext(palette)), `${exportSlug()}-vars.css`);
}

export function exportScp(palette) {
  downloadText(buildScp(exportContext(palette)), `${exportSlug()}.color-palette`);
}

export function exportGpl(palette) {
  downloadText(buildGpl(exportContext(palette)), `${exportSlug()}.gpl`);
}
