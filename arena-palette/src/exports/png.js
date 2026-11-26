// exports/png.js: canvas renderers (bars, dots) and PNG downloads.

// ── PNG RENDERER — shared ─────────────────────────────────────────────────────

// Are.na logo path (SVG viewBox 0 0 13 8)
export const LOGO_PATH_D = 'M12.8745 5.60598L11.0723 4.13301C10.962 4.04311 10.962 3.89549 11.0723 3.80532L12.8745 2.33271C12.9852 2.24262 13.0314 2.09042 12.9774 1.99467C12.9233 1.8992 12.7722 1.86521 12.642 1.91915L10.499 2.80685C10.3687 2.86134 10.246 2.78708 10.2265 2.64233L9.90419 0.263056C9.88431 0.118402 9.77971 0 9.67139 0C9.56359 0 9.45908 0.118402 9.43972 0.262966L9.11728 2.64242C9.09757 2.78717 8.97499 2.86125 8.84454 2.80694L6.737 1.93399C6.6063 1.87987 6.39338 1.87987 6.26302 1.93399L4.15514 2.80694C4.02478 2.86125 3.90203 2.78717 3.88249 2.64242L3.56048 0.262966C3.5406 0.118402 3.43617 0 3.32829 0C3.22006 0 3.11538 0.118402 3.09593 0.262966L2.77348 2.64242C2.75395 2.78717 2.63128 2.86125 2.50092 2.80694L0.358028 1.91942C0.227755 1.86521 0.076908 1.89938 0.0227932 1.99476C-0.0312351 2.0906 0.0148402 2.24289 0.125145 2.3328L1.92753 3.80541C2.03792 3.89558 2.03792 4.0432 1.92753 4.13319L0.125145 5.60598C0.0144945 5.69606 -0.0313216 5.85735 0.0226203 5.96415C0.0768216 6.07114 0.227669 6.11411 0.357769 6.05981L2.48147 5.17283C2.612 5.11862 2.73337 5.19243 2.75161 5.33717L3.05798 7.73721C3.07648 7.88169 3.19784 8 3.32769 8C3.45735 8 3.57881 7.88178 3.5974 7.73721L3.90428 5.33717C3.92243 5.19243 4.04432 5.1187 4.17416 5.17283L6.26302 6.0447C6.39321 6.09918 6.60621 6.09918 6.73649 6.0447L8.82501 5.17283C8.95502 5.11862 9.07656 5.19243 9.09515 5.33717L9.40203 7.73721C9.42035 7.88169 9.54181 8 9.67131 8C9.80115 8 9.9226 7.88178 9.94102 7.73721L10.2479 5.33717C10.2666 5.19243 10.3879 5.1187 10.518 5.17283L12.6419 6.05981C12.7716 6.11411 12.9229 6.07105 12.977 5.96424C13.0312 5.85762 12.9851 5.69633 12.8745 5.60625L12.8745 5.60598ZM8.28939 4.15171L6.70225 5.42249C6.59117 5.51149 6.40894 5.51149 6.29821 5.42249L4.71055 4.15171C4.59956 4.06271 4.59869 3.91617 4.70882 3.82581L6.29942 2.52285C6.40955 2.4325 6.59013 2.4325 6.70035 2.52285L8.29095 3.82581C8.40134 3.91608 8.40047 4.06262 8.28922 4.1518L8.28939 4.15171Z';

export function drawLogoOnCanvas(ctx, x, y, w, h, colour) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 13, h / 8);
  ctx.fillStyle = colour || '#000000';
  ctx.fill(new Path2D(LOGO_PATH_D));
  ctx.restore();
}

export function drawChrome(ctx, blockUrl, logoX, logoY, logoW, logoH, logoColour, textColour) {
  drawLogoOnCanvas(ctx, logoX, logoY, logoW, logoH, logoColour || '#000000');
  ctx.font = '400 28px Karla, sans-serif';
  ctx.fillStyle = textColour || '#000000';
  ctx.textBaseline = 'middle';
  ctx.fillText(blockUrl, logoX + logoW + 16, logoY + logoH / 2 - 2);
}

export function loadImageForCanvas(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Map the page's state to the renderer data shape. `state` = { image, imageEl, palette, semantic }:
// the v1-shaped image, its loaded element, S.palette ([{ hex, … }]) and S.semantic ([{ role, hex, … }]).
// makeTintsShades returns tints lightest→darkest (t3 first) and shades
// lightest→darkest (s1 first). Renderers want tints t1→t3 (lightest last)
// and shades s3→s1 (darkest first), so both arrays are reversed.
export function buildRendererData(state) {
  if (!state?.palette?.length || !state.image) return null;

  const palette = state.palette.map(({ hex }) => {
    const rgb = hexToRgb(hex);
    const { tints, shades } = makeTintsShades(rgb);
    return {
      base:   rgbToHex(rgb),
      tints:  [...tints].reverse().map(rgbToHex),   // t1 (darkest tint) → t3 (lightest)
      shades: [...shades].reverse().map(rgbToHex),  // s3 (darkest shade) → s1
    };
  });

  // Build semantic map from the semantic colours (roles: Vibrant, DarkVibrant, etc.)
  const semMap = {};
  (state.semantic || []).forEach(({ role, hex }) => { semMap[role] = hex; });
  const semantic = {
    darkVibrant:  semMap['DarkVibrant']  || null,
    vibrant:      semMap['Vibrant']      || null,
    lightVibrant: semMap['LightVibrant'] || null,
    darkMuted:    semMap['DarkMuted']    || null,
    muted:        semMap['Muted']        || null,
    lightMuted:   semMap['LightMuted']   || null,
  };

  // blockUrl: strip protocol and www  e.g. "are.na/block/12345678"
  const rawUrl = state.image.blockUrl || '';
  const blockUrl = rawUrl.replace(/^https?:\/\/(www\.)?/, '');

  return {
    blockUrl,
    imageUrl: state.image.original || state.imageEl?.src || '',
    palette,
    semantic,
  };
}

// ── PNG RENDERER — BARS 2 ─────────────────────────────────────────────────────

export async function renderBars(canvas, data) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 1200, 1200);

  const CELL = 50, GUTTER = 10, STEP = 60, DOUBLE = 110, DSTEP = 120;
  const GRID_X = 100, GRID_Y = 100, BOT_Y = 880;
  const IMG_X = 580, IMG_Y = 100, IMG_W = 520, IMG_H = 950;

  const palette = data.palette.slice(0, 12);
  const sem = data.semantic;

  // Column x positions for tint/shade grid
  const XS3   = GRID_X;
  const XS2   = GRID_X + STEP;
  const XS1   = GRID_X + STEP * 2;
  const XBASE = GRID_X + STEP * 3;
  const XT1   = XBASE + DSTEP;
  const XT2   = XBASE + DSTEP + STEP;
  const XT3   = XBASE + DSTEP + STEP * 2;

  function cell(x, y, w, h, colour) {
    if (!colour) return;
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
  }

  // Tint/shade grid
  palette.forEach((col, i) => {
    const y = GRID_Y + i * STEP;
    cell(XS3,   y, CELL,   CELL, col.shades[0]);
    cell(XS2,   y, CELL,   CELL, col.shades[1]);
    cell(XS1,   y, CELL,   CELL, col.shades[2]);
    cell(XBASE, y, DOUBLE, CELL, col.base);
    cell(XT1,   y, CELL,   CELL, col.tints[0]);
    cell(XT2,   y, CELL,   CELL, col.tints[1]);
    cell(XT3,   y, CELL,   CELL, col.tints[2]);
  });

  // Bottom section — palette colours in groups of 4
  const palCols = [0,1,2,3].map(i => i * STEP + GRID_X);
  const XSEM1 = GRID_X + STEP * 4;
  const XSEM2 = XSEM1 + DSTEP;
  const botRows = [BOT_Y, BOT_Y + STEP, BOT_Y + STEP * 2];

  [[0,1,2,3],[4,5,6,7],[8,9,10,11]].forEach((idxs, rowI) => {
    const y = botRows[rowI];
    idxs.forEach((pi, ci) => {
      if (pi < palette.length) cell(palCols[ci], y, CELL, CELL, palette[pi].base);
    });
  });

  // Semantic colours — dark / mid / light rows
  [
    [sem.darkMuted,  sem.darkVibrant],
    [sem.muted,      sem.vibrant],
    [sem.lightMuted, sem.lightVibrant],
  ].forEach(([left, right], rowI) => {
    const y = botRows[rowI];
    cell(XSEM1, y, DOUBLE, CELL, left);
    cell(XSEM2, y, DOUBLE, CELL, right);
  });

  // Image with centre-crop
  const img = await loadImageForCanvas(data.imageUrl);
  if (img) {
    const srcAspect = img.width / img.height;
    const dstAspect = IMG_W / IMG_H;
    let sx, sy, sw, sh;
    if (srcAspect > dstAspect) {
      sh = img.height; sw = sh * dstAspect;
      sx = (img.width - sw) / 2; sy = 0;
    } else {
      sw = img.width; sh = sw / dstAspect;
      sx = 0; sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, IMG_X, IMG_Y, IMG_W, IMG_H);
  }

  drawChrome(ctx, data.blockUrl, 85, 1070, 65, 40);
}

// ── PNG RENDERER — DOTS 1 ─────────────────────────────────────────────────────

export function buildDotSequence(palette, semantic) {
  const dots = [];
  palette.slice(0, 12).forEach(col => {
    dots.push(col.shades[0], col.shades[1], col.shades[2]);
    dots.push(col.base);
    dots.push(col.tints[0], col.tints[1], col.tints[2]);
  });
  [semantic.darkVibrant, semantic.vibrant, semantic.lightVibrant,
   semantic.darkMuted, semantic.muted, semantic.lightMuted].forEach(c => {
    if (c) dots.push(c);
  });
  return dots;
}

export async function renderDots(canvas, data, withBackground) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 1200, 1200);

  const GRID = 100, DOT_R = 30, DOT_OFFSET = 20, COLS = 10;

  if (withBackground) {
    const img = await loadImageForCanvas(data.imageUrl);
    if (img) {
      // Centre-crop the source image to a square first
      const srcAspect = img.width / img.height;
      let sx, sy, sw, sh;
      if (srcAspect > 1) {
        sh = img.height; sw = sh; sx = (img.width - sw) / 2; sy = 0;
      } else {
        sw = img.width; sh = sw; sx = 0; sy = (img.height - sh) / 2;
      }

      // Multi-pass downscale blur — each halving pass blurs the previous
      // result, giving a smooth gaussian-like wash without blocky artifacts.
      // Single-step approaches (tiny canvas stretched up) always show either
      // pixel grid (too small) or edge stepping (too large).
      const makeCanvas = (w, h) => {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        return c;
      };
      const smoothDraw = (dstCtx, src, dw, dh) => {
        dstCtx.imageSmoothingEnabled = true;
        dstCtx.imageSmoothingQuality = 'high';
        dstCtx.drawImage(src, 0, 0, dw, dh);
      };

      // Step 1 — crop source image to square
      const full = makeCanvas(sw, sh);
      full.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      // Step 2 — downscale to a floor of ~40px.
      // Staying at 40px (not 10px) means diagonals are still represented
      // smoothly — going lower creates a pixel grid too coarse to avoid
      // staircase artifacts when stretched back up.
      let current = full;
      let size = Math.max(sw, sh);
      while (size > 40) {
        size = Math.max(Math.round(size / 2), 40);
        const next = makeCanvas(size, size);
        smoothDraw(next.getContext('2d'), current, size, size);
        current = next;
      }

      // Step 3 — ping-pong: upscale to 300px then back down to 40px,
      // repeated 3 times. Each round-trip smears colour boundaries further
      // without ever going below the 40px resolution floor, so diagonals
      // stay smooth throughout.
      for (let i = 0; i < 3; i++) {
        const up = makeCanvas(100, 100);
        smoothDraw(up.getContext('2d'), current, 100, 100);
        const down = makeCanvas(40, 40);
        smoothDraw(down.getContext('2d'), up, 40, 40);
        current = down;
      }

      // Step 4 — sample luminance from the blurred result
      const lumPx = current.getContext('2d').getImageData(0, 0, current.width, current.height).data;
      let lumSum = 0;
      for (let i = 0; i < lumPx.length; i += 4) {
        lumSum += (0.299 * lumPx[i] + 0.587 * lumPx[i+1] + 0.114 * lumPx[i+2]) / 255;
      }
      const avgLum = lumSum / (lumPx.length / 4);

      // Step 5 — fill base colour matched to image tone
      ctx.fillStyle = avgLum < 0.5 ? '#000000' : '#ffffff';
      ctx.fillRect(0, 0, 1200, 1200);

      // Step 6 — upscale to output via 300px intermediate for a final
      // smoothing pass before the big stretch to 1200px.
      const mid = makeCanvas(100, 100);
      smoothDraw(mid.getContext('2d'), current, 100, 100);

      ctx.save();
      ctx.globalAlpha = avgLum < 0.5 ? 0.65 : 0.80;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(mid, 0, 0, 1200, 1200);
      ctx.restore();
    }
  }

  const dots = buildDotSequence(data.palette, data.semantic);
  dots.forEach((colour, i) => {
    if (!colour) return;
    const col = (i % COLS) + 1;
    const row = Math.floor(i / COLS) + 1;
    const cx = col * GRID + DOT_OFFSET + DOT_R;
    const cy = row * GRID + DOT_OFFSET + DOT_R;
    ctx.beginPath();
    ctx.arc(cx, cy, DOT_R, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();
  });

  drawChrome(ctx, data.blockUrl, 100, 1110, 65, 40);
}

// ── PNG EXPORTS ───────────────────────────────────────────────────────────────

export function triggerCanvasDownload(canvas, filename) {
  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  });
}

export async function exportPngBars(state) {
  const data = buildRendererData(state);
  if (!data) return;
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 1200;
  await document.fonts.ready;
  await renderBars(c, data);
  triggerCanvasDownload(c, `${exportSlug(state.image)}-bars.png`);
}

export async function exportPngDots(state, withBackground) {
  const data = buildRendererData(state);
  if (!data) return;
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 1200;
  await document.fonts.ready;
  await renderDots(c, data, withBackground);
  const suffix = withBackground ? 'dots-bg' : 'dots';
  triggerCanvasDownload(c, `${exportSlug(state.image)}-${suffix}.png`);
}
