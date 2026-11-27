// exports/text.js: filenames, labels and the text exports (hex, RGB, HSL, CSS, SCP, GPL).
import { nameFor, nameKey } from '../names.js';
import { rgbToHex, hexToRgb, rgbToHsl } from '../colour.js';

// ── EXPORTS ───────────────────────────────────────────────────────────────────
export function downloadText(content, filename) {
  const a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
  a.download = filename;
  a.click();
}

// `image` is the v1-shaped image the palette came from (see imageFromBlock in arena-fetch.js).
export function slugName(image) {
  return image ? image.channel : 'palette';
}

// Export filename base: strip the Are.na hash suffix from the channel slug
// and append the block id. e.g. "chromatic-vwdupl8d0lk" + id 44858120
// => "chromatic-block-44858120"
export function exportSlug(image) {
  if (!image) return 'palette';
  const channel = image.channel.replace(/-(?=[a-z0-9]{7,}$)[a-z0-9]*[0-9][a-z0-9]*$/i, '');
  const id = image.id || '';
  // A block pasted directly has no channel, so its name is just the block.
  if (!channel) return id ? `block-${id}` : 'palette';
  return id ? `${channel}-block-${id}` : channel;
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

// A ramp as an ordered list, light to dark: the tints (numbered counting away from the base), the base itself,
// then the shades. The base sits wherever the extracted colour fell, so ramps can be any length.
export function rampLayout(ramp) {
  const m = ramp.markerIndex;
  return ramp.steps.map((hex, i) => {
    if (i < m) return { hex, kind: 'tint', label: `tint ${m - i}`, key: `tint-${m - i}` };
    if (i > m) return { hex, kind: 'shade', label: `shade ${i - m}`, key: `shade-${i - m}` };
    return { hex, kind: 'base', label: null, key: 'base' };
  });
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
    const name = nameFor(ctx.names, hex);
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

  // 3. Tints and shades, when ramps are included
  if (ctx.ramps) {
    out.push('/* Tints and Shades */\n');
    palette.forEach((rgb, i) => {
      const ramp = ctx.ramps[i];
      if (!ramp) return;
      const name = nameFor(ctx.names, rgbToHex(rgb));
      out.push(`/* ${swatchLabel(rgbToHex(rgb), name)} */`); // block header
      rampLayout(ramp).forEach(step => out.push(`/* ${swatchLabel(step.hex, name, null, step.label)} */\n${step.hex}`));
      out.push('');
    });
  }

  return out.join('\n');
}

export function buildRgb(ctx) {
  const palette = ctx.palette;
  const out = [exportHeader(ctx)];

  // 1. Palette
  out.push('/* Palette */\n');
  palette.forEach((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = nameFor(ctx.names, hex);
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

  // 3. Tints and shades, when ramps are included
  if (ctx.ramps) {
    out.push('/* Tints and Shades */\n');
    palette.forEach((rgb, i) => {
      const ramp = ctx.ramps[i];
      if (!ramp) return;
      const name = nameFor(ctx.names, rgbToHex(rgb));
      out.push(`/* ${swatchLabel(rgbToHex(rgb), name)} */`);
      rampLayout(ramp).forEach(step => {
        const [r, g, b] = hexToRgb(step.hex);
        out.push(`/* ${swatchLabel(step.hex, name, null, step.label)} */\nrgb(${r}, ${g}, ${b})`);
      });
      out.push('');
    });
  }

  return out.join('\n');
}

export function buildHsl(ctx) {
  const palette = ctx.palette;
  const out = [exportHeader(ctx)];

  // 1. Palette
  out.push('/* Palette */\n');
  palette.forEach((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = nameFor(ctx.names, hex);
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

  // 3. Tints and shades, when ramps are included
  if (ctx.ramps) {
    out.push('/* Tints and Shades */\n');
    palette.forEach((rgb, i) => {
      const ramp = ctx.ramps[i];
      if (!ramp) return;
      const name = nameFor(ctx.names, rgbToHex(rgb));
      out.push(`/* ${swatchLabel(rgbToHex(rgb), name)} */`);
      rampLayout(ramp).forEach(step => {
        const [h, s, l] = rgbToHsl(hexToRgb(step.hex));
        out.push(`/* ${swatchLabel(step.hex, name, null, step.label)} */\nhsl(${h}, ${s}%, ${l}%)`);
      });
      out.push('');
    });
  }

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
    const name = nameFor(ctx.names, hex);
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

  // 3. Tints & shades, when ramps are included: --slug-tint-N / --slug-base / --slug-shade-N
  if (ctx.ramps) {
    varLines.push('  /* Tints & shades */');
    palette.forEach((rgb, i) => {
      const ramp = ctx.ramps[i];
      if (!ramp) return;
      const slug = cssSlug(nameFor(ctx.names, rgbToHex(rgb)), `color-${i + 1}`);
      rampLayout(ramp).forEach(step => {
        const [h, s, l] = rgbToHsl(hexToRgb(step.hex));
        varLines.push(`  --${slug}-${step.key}: hsl(${h}, ${s}%, ${l}%); /* ${step.hex} */`);
      });
      varLines.push('');
    });
  }

  while (varLines[varLines.length - 1] === '') varLines.pop();

  return header + `:root {\n${varLines.join('\n')}\n}`;
}

export function buildScp(ctx) {
  const palette = ctx.palette;
  const paletteEntries = palette.map((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = nameFor(ctx.names, hex);
    const pct  = Math.round((ctx.proportions[i] ?? 0) * 100);
    return { hex, ...(name ? { name } : {}), ...(pct ? { proportion: pct / 100 } : {}) };
  });

  const semanticEntries = ctx.semantic.map(({ role, hex, proportion }) => {
    const pct = Math.round((proportion ?? 0) * 100);
    return { role, hex, ...(pct ? { proportion: pct / 100 } : {}) };
  });

  const tintsShades = ctx.ramps ? palette.flatMap((rgb, i) => {
    const ramp = ctx.ramps[i];
    if (!ramp) return [];
    const hex  = rgbToHex(rgb);
    const name = nameFor(ctx.names, hex);
    const steps = rampLayout(ramp);
    const pick = kind => steps.filter(s => s.kind === kind).map(({ hex: h, label }) => ({ hex: h, label }));
    return [{ hex, ...(name ? { name } : {}), tints: pick('tint'), shades: pick('shade') }];
  }) : null;

  const payload = {
    name:        ctx.title || ctx.channel,
    sourceUrl:   ctx.blockUrl,
    palette:     paletteEntries,
    semantic:    semanticEntries,
    ...(tintsShades ? { tintsShades } : {}),
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
    `Columns: ${ctx.ramps?.length ? ctx.ramps[0].steps.length : Math.max(palette.length, 1)}`,
    '#',
  ];

  // 1. Base colours
  lines.push('# Base colours');
  palette.forEach((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = nameFor(ctx.names, hex);
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

  // 3. Tints & shades per colour, when ramps are included
  if (ctx.ramps) palette.forEach((rgb, i) => {
    const ramp = ctx.ramps[i];
    if (!ramp) return;
    const hex  = rgbToHex(rgb);
    const name = nameFor(ctx.names, hex);
    const pct  = Math.round((ctx.proportions[i] ?? 0) * 100);
    lines.push(`# ${swatchLabel(hex, name, pct || null)}`);
    rampLayout(ramp).forEach(step => {
      const [r, g, b] = hexToRgb(step.hex);
      lines.push(`${r}\t${g}\t${b}\t${swatchLabel(step.hex, name, null, step.label)}`);
    });
  });

  return lines.join('\n');
}

// Everything the builders need, from the page's state. Builders take this and return the file
// contents, so they stay pure and testable.
//   image    the v1-shaped image (title, blockUrl, channel, id)
//   palette  S.palette: [{ hex, name, proportion }]
//   semantic S.semantic ([] to leave the semantic colours out): [{ role, hex, proportion }]
//   ramps    one { steps, markerIndex } per palette colour (see ramps.js), or null for base colours only
export function buildExportContext({ image, palette, semantic = [], ramps = null }) {
  const names = {};
  [...palette, ...semantic].forEach(c => { if (c.name) names[nameKey(c.hex)] = c.name; });
  return {
    palette:     palette.map(c => hexToRgb(c.hex)),
    proportions: palette.map(c => c.proportion),
    names,
    semantic:    semantic.map(({ role, hex, proportion }) => ({ role, hex, proportion })),
    ramps:       ramps ? ramps.map(r => ({ steps: [...r.steps], markerIndex: r.markerIndex })) : null,
    title:       image?.title || '',
    blockUrl:    image?.blockUrl || '',
    channel:     slugName(image),
    slug:        exportSlug(image),
  };
}

export function exportHex(ctx) {
  downloadText(buildHex(ctx), `${ctx.slug}-hex.txt`);
}

export function exportRgb(ctx) {
  downloadText(buildRgb(ctx), `${ctx.slug}-rgb.txt`);
}

export function exportHsl(ctx) {
  downloadText(buildHsl(ctx), `${ctx.slug}-hsl.txt`);
}

export function exportCss(ctx) {
  downloadText(buildCss(ctx), `${ctx.slug}-vars.css`);
}

export function exportScp(ctx) {
  downloadText(buildScp(ctx), `${ctx.slug}.color-palette`);
}

export function exportGpl(ctx) {
  downloadText(buildGpl(ctx), `${ctx.slug}.gpl`);
}
