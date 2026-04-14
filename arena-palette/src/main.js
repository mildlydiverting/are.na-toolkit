// ── CONFIG & STORAGE ──────────────────────────────────────────────────────────
const STORAGE_KEY = 'arena-palette-v1';
const DEFAULT_CHANNELS = ['', '', ''];
const MAX_CHANNELS = 4;
const IMAGES_PER_CHANNEL = 3;
const TINT_STEPS = 3;
const SHADE_STEPS = 3;

// Are.na API v3 — https://www.are.na/developers/explore
const API_BASE = 'https://api.are.na/v3';
const MAX_RETRIES = 12;

// ── COLOUR NAME API ───────────────────────────────────────────────────────────
// https://api.color.pizza/v1/ — meodai/color-name-api
const COLOR_NAME_API = 'https://api.color.pizza/v1/';

const NAME_LISTS = {
  bestOf:              'best of',
  japaneseTraditional: 'Japanese traditional',
  sanzoWadaI:          'Sanzo Wada I',
  wikipedia:           'Wikipedia',
  werner:              'Werner',
  ridgway:             'Ridgway',
  nbsIscc:             'NBS-ISCC',
  thesaurus:           'Thesaurus',
};

// ── EXTRACTION SETTINGS ──────────────────────────────────────────────────────
const SETTINGS_KEY = 'arena-palette-settings-v1';
const DEFAULT_SETTINGS = {
  colorCount:    7,
  quality:      'med',
  colorSpace:   'oklch',
  ignoreWhite:   true,
  minSaturation: 0,
  nameList:     'bestOf',
};

function qualityValue(q) {
  return q === 'hi' ? 1 : q === 'lo' ? 30 : 10;
}

let extractionSettings = { ...DEFAULT_SETTINGS };

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) extractionSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch(e) {}
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(extractionSettings));
  } catch(e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function saveState(channels, token) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ channels, token }));
  } catch(e) {}
}

// ── DOM REFS ──────────────────────────────────────────────────────────────────
const channelListEl = document.getElementById('channelList');
const btnAddChannel = document.getElementById('btnAddChannel');
const tokenInput    = document.getElementById('tokenInput');
const btnFetch      = document.getElementById('btnFetch');
const statusMsg     = document.getElementById('statusMsg');
const imageGrid     = document.getElementById('imageGrid');
const analysisArea  = document.getElementById('analysisArea');
const scratch       = document.getElementById('scratchCanvas');
const ctx           = scratch.getContext('2d', { willReadFrequently: true });

// ── CHANNEL MANAGEMENT ────────────────────────────────────────────────────────
let channels = [];

function renderChannels() {
  channelListEl.innerHTML = '';
  channels.forEach((slug, i) => {
    const humanN = i + 1;
    const row = document.createElement('div');
    row.className = 'channel-row';
    row.setAttribute('role', 'listitem');
    row.innerHTML = `
      <label for="channel-input-${i}" class="visually-hidden">Channel ${humanN} slug</label>
      <input
        type="text"
        id="channel-input-${i}"
        name="channel-${i}"
        placeholder="channel-slug"
        value="${slug}"
        data-idx="${i}"
        aria-label="Channel ${humanN} slug"
        autocomplete="off"
        spellcheck="false"
      />
      <button
        class="btn-icon"
        data-remove="${i}"
        aria-label="Remove channel ${humanN}"
        title="Remove channel ${humanN}"
      >×</button>
    `;
    channelListEl.appendChild(row);
  });

  channelListEl.querySelectorAll('input[type="text"]').forEach(inp => {
    inp.addEventListener('input', e => {
      channels[+e.target.dataset.idx] = e.target.value.trim();
      persistState();
    });
  });

  channelListEl.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = +e.target.dataset.remove;
      channels.splice(idx, 1);
      renderChannels();
      persistState();
    });
  });

  btnAddChannel.style.display = channels.length >= MAX_CHANNELS ? 'none' : '';
}

btnAddChannel.addEventListener('click', () => {
  if (channels.length < MAX_CHANNELS) {
    channels.push('');
    renderChannels();
    // Focus the new input
    const inputs = channelListEl.querySelectorAll('input[type="text"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }
});

function persistState() {
  saveState(channels, tokenInput.value);
}

tokenInput.addEventListener('input', persistState);

// ── INIT ──────────────────────────────────────────────────────────────────────
(function init() {
  loadSettings();
  const saved = loadState();
  channels = saved?.channels?.length ? saved.channels : [...DEFAULT_CHANNELS];
  if (saved?.token) tokenInput.value = saved.token;
  renderChannels();
})();

// ── ARE.NA API v3 ─────────────────────────────────────────────────────────────
async function fetchChannelMeta(slug, headers) {
  const res = await fetch(`${API_BASE}/channels/${encodeURIComponent(slug)}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.details?.message || `Channel "${slug}" not found (${res.status})`);
  }
  return res.json();
}

async function fetchBlockAtPage(slug, page, headers) {
  const res = await fetch(
    `${API_BASE}/channels/${encodeURIComponent(slug)}/contents?per=1&page=${page}`,
    { headers }
  );
  if (!res.ok) throw new Error(`Fetch failed for "${slug}" page ${page} (${res.status})`);
  const data = await res.json();
  return data.data?.[0] || null;
}

async function fetchChannelImages(slug, token, slotsNeeded) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const meta = await fetchChannelMeta(slug, headers);
  const total = meta.counts?.contents ?? 0;
  if (!total) throw new Error(`Channel "${slug}" appears to be empty`);

  const results = [];
  const usedPages = new Set();

  for (let slot = 0; slot < slotsNeeded; slot++) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let page, tries = 0;
      do {
        page = Math.floor(Math.random() * total) + 1;
        tries++;
      } while (usedPages.has(page) && tries < 20);
      usedPages.add(page);

      const block = await fetchBlockAtPage(slug, page, headers);
      if (block && block.type === 'Image' && block.image) {
        results.push({
          url:      block.image.small?.src || block.image.src,
          original: block.image.src,
          title:    block.title || '',
          channel:  slug,
          id:       block.id,
          blockUrl: `https://www.are.na/block/${block.id}`
        });
        break;
      }
    }
  }

  if (!results.length) throw new Error(`No image blocks found in "${slug}" after ${MAX_RETRIES} attempts`);
  return results;
}

// ── FETCH BUTTON ──────────────────────────────────────────────────────────────
btnFetch.addEventListener('click', async () => {
  const slugs = channels.filter(s => s.trim());
  if (!slugs.length) {
    setStatus('add at least one channel slug', true);
    return;
  }

  btnFetch.disabled = true;
  setStatus('<span class="analyse-spinner" aria-hidden="true"></span>fetching…');
  persistState();

  const token = tokenInput.value.trim();
  let allImages = [];
  const errors = [];

  const GRID_SIZE = 9;
  const baseSlots = Math.floor(GRID_SIZE / slugs.length);
  const extraSlots = GRID_SIZE % slugs.length;

  for (let i = 0; i < slugs.length; i++) {
    const slotsNeeded = baseSlots + (i < extraSlots ? 1 : 0);
    try {
      const imgs = await fetchChannelImages(slugs[i], token, slotsNeeded);
      allImages = allImages.concat(imgs);
    } catch(e) {
      errors.push(e.message);
    }
  }

  btnFetch.disabled = false;

  if (!allImages.length) {
    setStatus(errors[0] || 'no images found', true);
    return;
  }

  const errNote = errors.length ? ` (${errors.length} channel error${errors.length > 1 ? 's' : ''})` : '';
  setStatus(`${allImages.length} images loaded${errNote}`);
  renderImageGrid(allImages);
});

// ── IMAGE GRID ────────────────────────────────────────────────────────────────
let loadedImages = [];

function renderImageGrid(images) {
  loadedImages = images;
  imageGrid.className = 'image-grid';
  imageGrid.innerHTML = '';

  images.forEach((img, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.dataset.idx = i;
    thumb.setAttribute('role', 'listitem');
    thumb.innerHTML = `
      <img src="${img.url}" crossorigin="anonymous" loading="lazy"
        alt="${img.title ? img.title + ' from ' + img.channel : 'Image from ' + img.channel}" />
      <span class="channel-tag" aria-hidden="true">${img.channel}</span>
    `;
    // Make thumb keyboard-accessible
    thumb.setAttribute('tabindex', '0');
    thumb.setAttribute('role', 'button');
    thumb.setAttribute('aria-label', `Extract palette from ${img.title || 'image'} (${img.channel})`);
    thumb.addEventListener('click', () => selectImage(i));
    thumb.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectImage(i); }
    });
    imageGrid.appendChild(thumb);
  });
}

// ── IMAGE SELECTION ───────────────────────────────────────────────────────────
let currentPalette    = null;
let currentImageObj   = null;
let currentImageEl    = null;
let currentColorNames = {};
let lastNamedHexKey   = '';

function selectImage(idx) {
  document.querySelectorAll('.thumb').forEach(t => {
    t.classList.remove('selected');
    t.setAttribute('aria-pressed', 'false');
  });
  const thumb = document.querySelector(`.thumb[data-idx="${idx}"]`);
  if (thumb) {
    thumb.classList.add('selected');
    thumb.setAttribute('aria-pressed', 'true');
  }

  currentImageObj = loadedImages[idx];
  analysisArea.innerHTML = `<div class="empty-analysis" role="status"><span class="analyse-spinner" aria-hidden="true"></span>extracting palette…</div>`;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    currentImageEl = img;
    runExtraction();
  };
  img.onerror = () => {
    analysisArea.innerHTML = `<div class="empty-analysis" role="alert">could not load image for analysis (CORS)</div>`;
  };
  img.src = currentImageObj.original + '?t=' + Date.now();
}

// ── EXTRACTION ────────────────────────────────────────────────────────────────
async function runExtraction() {
  if (!currentImageEl) return;
  const paletteData = extractPalette(currentImageEl);
  const swatches    = extractSwatches(currentImageEl);
  currentPalette = paletteData;

  renderAnalysis(currentImageEl, paletteData, swatches, currentColorNames);

  const hexes  = paletteData.map(d => rgbToHex(d.rgb));
  const hexKey = hexes.join(',') + '|' + extractionSettings.nameList;

  if (hexKey !== lastNamedHexKey) {
    lastNamedHexKey   = hexKey;
    currentColorNames = {};
    patchColorLabels(paletteData, currentColorNames);

    const names = await fetchColorNames(hexes, extractionSettings.nameList);
    if (hexKey === lastNamedHexKey) {
      currentColorNames = names;
      patchColorLabels(paletteData, currentColorNames);
    }
  }
}

// ── COLOUR NAME API ───────────────────────────────────────────────────────────
async function fetchColorNames(hexArray, list) {
  try {
    const values = hexArray.map(h => h.replace('#', '')).join(',');
    const params = new URLSearchParams({ values, list });
    const res = await fetch(`${COLOR_NAME_API}?${params}`);
    if (!res.ok) return {};
    const data = await res.json();
    const map = {};
    // Use requestedHex (exact input hex) not hex (nearest match hex)
    (data.colors || []).forEach(c => {
      if (c.requestedHex && c.name) map[c.requestedHex.toLowerCase()] = c.name;
    });
    return map;
  } catch(e) {
    return {};
  }
}

function patchColorLabels(paletteData, nameMap) {
  paletteData.forEach((d, i) => {
    const el = document.getElementById(`colour-label-${i}`);
    if (!el) return;
    const hex  = rgbToHex(d.rgb);
    const pct  = Math.round(d.proportion * 100);
    const name = nameMap[hex.toLowerCase()];
    el.innerHTML = buildLabelHtml(i, hex, pct, name);
  });
}

function buildLabelHtml(index, hex, pct, name) {
  const num      = String(index + 1).padStart(2, '0');
  const namePart = name === undefined
    ? `<span class="colour-name-loading" aria-label="loading colour name">…</span>`
    : name
      ? `<span class="colour-name">${name}</span>`
      : '';
  return `${num} · <span class="colour-hex">${hex}</span>${namePart ? ' · ' + namePart : ''} · ${pct}%`;
}

// ── COLOUR EXTRACTION ────────────────────────────────────────────────────────
function extractPalette(imgEl) {
  const s = extractionSettings;
  const colors = ColorThief.getPaletteSync(imgEl, {
    colorCount:    s.colorCount,
    quality:       qualityValue(s.quality),
    colorSpace:    s.colorSpace,
    ignoreWhite:   s.ignoreWhite,
    minSaturation: s.minSaturation,
  });
  if (!colors) return [];
  const totalPop = colors.reduce((sum, c) => sum + c.population, 0) || 1;
  return colors.map(c => ({
    rgb:        c.array(),
    proportion: c.population / totalPop
  }));
}

// ── SWATCH EXTRACTION ─────────────────────────────────────────────────────────
const SWATCH_ROLES = ['Vibrant', 'DarkVibrant', 'LightVibrant', 'Muted', 'DarkMuted', 'LightMuted'];

function extractSwatches(imgEl) {
  try {
    return ColorThief.getSwatchesSync(imgEl) || {};
  } catch(e) {
    return {};
  }
}

function swatchProportions(swatchMap, paletteData) {
  const result = [];
  SWATCH_ROLES.forEach(role => {
    const sw = swatchMap[role];
    if (!sw) return;
    const rgb = sw.color.array();
    let best = 0, bestDist = Infinity;
    paletteData.forEach(({ rgb: pr }, i) => {
      const d = (rgb[0]-pr[0])**2 + (rgb[1]-pr[1])**2 + (rgb[2]-pr[2])**2;
      if (d < bestDist) { bestDist = d; best = i; }
    });
    result.push({
      role,
      hex:        rgbToHex(rgb),
      tc:         sw.color.textColor,
      proportion: paletteData[best].proportion,
    });
  });
  return applyFloor(result, 0.05);
}

function applyFloor(items, minProp) {
  const raw = items.reduce((s, r) => s + r.proportion, 0) || 1;
  items.forEach(r => r.proportion = r.proportion / raw);
  let deficit = 0;
  items.forEach(r => { if (r.proportion < minProp) deficit += minProp - r.proportion; });
  if (deficit > 0) {
    const donors = items.filter(r => r.proportion > minProp);
    const donorTotal = donors.reduce((s, r) => s + r.proportion, 0);
    donors.forEach(r => { r.proportion -= deficit * (r.proportion / donorTotal); });
    items.forEach(r => { if (r.proportion < minProp) r.proportion = minProp; });
  }
  return items;
}

// ── COLOUR UTILITIES ──────────────────────────────────────────────────────────
function rgbToHex([r,g,b]) {
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1,3),16),
    parseInt(hex.slice(3,5),16),
    parseInt(hex.slice(5,7),16)
  ];
}

function rgbToHsl([r,g,b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h, s, l = (max+min)/2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch(max) {
      case r: h = ((g-b)/d + (g<b?6:0))/6; break;
      case g: h = ((b-r)/d + 2)/6; break;
      case b: h = ((r-g)/d + 4)/6; break;
    }
  }
  return [Math.round(h*360), Math.round(s*100), Math.round(l*100)];
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h/30) % 12;
  const a = s * Math.min(l, 1-l);
  const f = n => l - a * Math.max(-1, Math.min(k(n)-3, Math.min(9-k(n), 1)));
  return [Math.round(f(0)*255), Math.round(f(8)*255), Math.round(f(4)*255)];
}

function makeTintsShades(rgb) {
  const [h, s, l] = rgbToHsl(rgb);
  const tints = [], shades = [];
  for (let i = TINT_STEPS; i >= 1; i--) {
    const newL = Math.min(95, l + (i * (95 - l) / (TINT_STEPS + 1)));
    tints.push(hslToRgb(h, s, newL));
  }
  for (let i = 1; i <= SHADE_STEPS; i++) {
    const newL = Math.max(5, l - (i * l / (SHADE_STEPS + 1)));
    shades.push(hslToRgb(h, s, newL));
  }
  return { tints, shades };
}

function textColour(rgb) {
  const [r,g,b] = rgb;
  const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
  return lum > 0.5 ? '#1a1814' : '#f5f3ef';
}

// ── RENDER ANALYSIS ───────────────────────────────────────────────────────────
function renderAnalysis(imgEl, paletteData, swatchMap, nameMap) {
  const palette = paletteData.map(d => d.rgb);

  // Semantic bar
  const swatchData = swatchProportions(swatchMap, paletteData);
  const semanticBarHtml = swatchData.length ? (() => {
    const segments = swatchData.map(({ role, hex, tc, proportion }) => {
      const pct = Math.round(proportion * 100);
      return `<div class="semantic-segment"
        style="flex:${proportion};background:${hex}"
        title="${role} · ${hex} · ${pct}%"
        aria-label="${role}: ${hex}, ${pct}%">
        <span class="semantic-segment-label" style="color:${tc}" aria-hidden="true">${pct > 8 ? role : ''}</span>
      </div>`;
    }).join('');
    const legend = swatchData.map(({ role, hex }) =>
      `<button class="semantic-legend-item"
        onclick="navigator.clipboard.writeText('${hex}').catch(()=>{})"
        aria-label="Copy ${role} colour ${hex} to clipboard">
        <span class="semantic-legend-dot" style="background:${hex}" aria-hidden="true"></span>
        <span>${role} · ${hex}</span>
      </button>`
    ).join('');
    return `<div class="semantic-section">
      <div class="semantic-label" id="semantic-label">semantic palette</div>
      <div class="semantic-bar" role="img" aria-labelledby="semantic-label">${segments}</div>
      <div class="semantic-legend" role="list">${legend}</div>
    </div>`;
  })() : '';

  // Proportion bar
  const propBarItems = applyFloor(
    paletteData.map(({ rgb, proportion }) => ({ hex: rgbToHex(rgb), tc: textColour(rgb), proportion })),
    0.01
  );
  const mainPropBar = `<div class="semantic-section semantic-section--prop-bar">
    <div class="semantic-label" id="prop-bar-label">colour proportions</div>
    <div class="semantic-bar" role="img" aria-labelledby="prop-bar-label">${
      propBarItems.map(({ hex, tc, proportion }) => {
        const pct = Math.round(proportion * 100);
        return `<div class="semantic-segment"
          style="flex:${proportion};background:${hex}"
          title="${hex} · ${pct}%"
          aria-label="${hex}: ${pct}%">
          <span class="semantic-segment-label" style="color:${tc}" aria-hidden="true">${pct > 6 ? pct + '%' : ''}</span>
        </div>`;
      }).join('')
    }</div>
  </div>`;

  // Colour rows
  const rows = paletteData.map(({ rgb, proportion }, i) => {
    const { tints, shades } = makeTintsShades(rgb);
    const allSwatches = [...tints, rgb, ...shades];
    const pct  = Math.round(proportion * 100);
    const hex  = rgbToHex(rgb);
    const name = nameMap[hex.toLowerCase()];

    const swatchHtml = allSwatches.map((c, si) => {
      const ch     = rgbToHex(c);
      const isBase = si === TINT_STEPS;
      const tc     = textColour(c);
      const label  = si < TINT_STEPS
        ? `Tint ${TINT_STEPS - si} of colour ${i+1}: ${ch}`
        : isBase
          ? `Base colour ${i+1}: ${ch}${name ? ' (' + name + ')' : ''}`
          : `Shade ${si - TINT_STEPS} of colour ${i+1}: ${ch}`;
      return `<div class="swatch${isBase ? ' base' : ''}"
        style="background:${ch};color:${ch}"
        data-hex="${ch}"
        data-tc="${tc}"
        tabindex="0"
        role="button"
        aria-label="${label} — click to copy">${ch}</div>`;
    }).join('');

    return `<div class="colour-block">
      <div class="colour-label" id="colour-label-${i}">${buildLabelHtml(i, hex, pct, name)}</div>
      <div class="swatch-row" role="list" aria-label="Tints and shades of colour ${i+1}">${swatchHtml}</div>
    </div>`;
  }).join('');

  const s = extractionSettings;

  const nameListOptions = Object.entries(NAME_LISTS).map(([key, label]) =>
    `<option value="${key}" ${s.nameList === key ? 'selected' : ''}>${label}</option>`
  ).join('');

  analysisArea.innerHTML = `
    <div class="analysis-layout">
      <figure class="image-figure">
        <div class="selected-image-wrap">
          <img src="${imgEl.src}" alt="${currentImageObj?.title || 'Selected image'}" crossorigin="anonymous" />
        </div>
        <figcaption class="image-caption">
          ${currentImageObj?.title ? `<span class="image-title">${currentImageObj.title}</span>` : ''}
          <a class="image-link"
            href="${currentImageObj?.blockUrl || '#'}"
            target="_blank"
            rel="noopener"
            aria-label="View ${currentImageObj?.title || 'this image'} on Are.na (opens in new tab)">
            view on are.na ↗
          </a>
        </figcaption>
      </figure>

      <div class="palette-panel">

        <div class="settings-panel">
          <button
            class="settings-toggle"
            id="settingsToggle"
            aria-expanded="false"
            aria-controls="settingsBody"
          >
            extraction settings
            <span class="caret" aria-hidden="true">&#x25BE;</span>
          </button>
          <div class="settings-body hidden" id="settingsBody" role="group" aria-label="Extraction settings">
            <div class="setting-row">
              <label for="sColorCount">
                colours
                <span class="setting-val" id="colorCountVal" aria-live="polite">${s.colorCount}</span>
              </label>
              <input type="range" id="sColorCount" name="colorCount"
                min="4" max="12" step="1" value="${s.colorCount}"
                aria-valuemin="4" aria-valuemax="12" aria-valuenow="${s.colorCount}"
                aria-label="Number of colours to extract">
            </div>
            <div class="setting-row">
              <label for="sQuality">quality</label>
              <select id="sQuality" name="quality" aria-label="Extraction quality">
                <option value="hi"  ${s.quality==='hi' ?'selected':''}>high (slow)</option>
                <option value="med" ${s.quality==='med'?'selected':''}>medium</option>
                <option value="lo"  ${s.quality==='lo' ?'selected':''}>low (fast)</option>
              </select>
            </div>
            <div class="setting-row">
              <label for="sColorSpace">colour space</label>
              <select id="sColorSpace" name="colorSpace" aria-label="Colour space for extraction">
                <option value="oklch" ${s.colorSpace==='oklch'?'selected':''}>oklch (perceptual)</option>
                <option value="rgb"   ${s.colorSpace==='rgb'  ?'selected':''}>rgb</option>
              </select>
            </div>
            <div class="setting-row">
              <label for="sMinSat">
                min saturation
                <span class="setting-val" id="minSatVal" aria-live="polite">${s.minSaturation.toFixed(2)}</span>
              </label>
              <input type="range" id="sMinSat" name="minSaturation"
                min="0" max="0.5" step="0.05" value="${s.minSaturation}"
                aria-valuemin="0" aria-valuemax="0.5" aria-valuenow="${s.minSaturation}"
                aria-label="Minimum saturation threshold">
            </div>
            <div class="setting-row setting-row--full">
              <div class="setting-toggle-row">
                <input type="checkbox" id="sIgnoreWhite" name="ignoreWhite" ${s.ignoreWhite?'checked':''}>
                <label for="sIgnoreWhite">ignore white / near-white pixels</label>
              </div>
            </div>
            <div class="setting-row setting-row--full">
              <label for="sNameList">colour name vocabulary</label>
              <select id="sNameList" name="nameList" aria-label="Colour name vocabulary">
                ${nameListOptions}
              </select>
            </div>
          </div>
        </div>

        ${mainPropBar}
        <div class="semantic-section semantic-section--flush">
          <div class="semantic-label">tints &amp; shades</div>
        </div>
        <div class="colour-rows" role="list" aria-label="Extracted colours with tints and shades">${rows}</div>
        ${semanticBarHtml}

        <div class="export-bar" role="toolbar" aria-label="Export palette">
          <button class="btn-export" id="expHex"    aria-label="Export hex values as text file">export hex</button>
          <button class="btn-export" id="expRgbHsl" aria-label="Export RGB and HSL values as text file">export rgb + hsl</button>
          <button class="btn-export" id="expCss"    aria-label="Export CSS custom properties">export css vars</button>
          <button class="btn-export" id="expScp"    aria-label="Export Simple Color Palette file">export .color-palette</button>
          <button class="btn-export" id="expPng"    aria-label="Export palette as PNG image">export png</button>
        </div>
      </div>
    </div>
  `;

  // Swatch interactions
  document.querySelectorAll('.swatch').forEach(sw => {
    const reveal  = () => sw.style.color = sw.dataset.tc;
    const conceal = () => sw.style.color = sw.dataset.hex;
    sw.addEventListener('mouseenter', reveal);
    sw.addEventListener('mouseleave', conceal);
    sw.addEventListener('focus',      reveal);
    sw.addEventListener('blur',       conceal);
    sw.addEventListener('click', () => {
      navigator.clipboard.writeText(sw.dataset.hex).catch(() => {});
    });
    sw.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigator.clipboard.writeText(sw.dataset.hex).catch(() => {});
      }
    });
  });

  // Settings toggle — uses aria-expanded
  document.getElementById('settingsToggle').addEventListener('click', () => {
    const body    = document.getElementById('settingsBody');
    const btn     = document.getElementById('settingsToggle');
    const isOpen  = !body.classList.contains('hidden');
    body.classList.toggle('hidden');
    btn.setAttribute('aria-expanded', String(!isOpen));
  });

  // Settings controls
  let reExtractTimer = null;
  function reExtract(debounce = false) {
    saveSettings();
    if (debounce) {
      clearTimeout(reExtractTimer);
      reExtractTimer = setTimeout(() => runExtraction(), 400);
    } else {
      runExtraction();
    }
  }

  document.getElementById('sColorCount').addEventListener('input', e => {
    extractionSettings.colorCount = parseInt(e.target.value);
    const val = document.getElementById('colorCountVal');
    val.textContent = extractionSettings.colorCount;
    e.target.setAttribute('aria-valuenow', extractionSettings.colorCount);
    reExtract(true);
  });
  document.getElementById('sQuality').addEventListener('change', e => {
    extractionSettings.quality = e.target.value;
    reExtract();
  });
  document.getElementById('sColorSpace').addEventListener('change', e => {
    extractionSettings.colorSpace = e.target.value;
    reExtract();
  });
  document.getElementById('sMinSat').addEventListener('input', e => {
    extractionSettings.minSaturation = parseFloat(e.target.value);
    const val = document.getElementById('minSatVal');
    val.textContent = extractionSettings.minSaturation.toFixed(2);
    e.target.setAttribute('aria-valuenow', extractionSettings.minSaturation);
    reExtract(true);
  });
  document.getElementById('sIgnoreWhite').addEventListener('change', e => {
    extractionSettings.ignoreWhite = e.target.checked;
    reExtract();
  });
  document.getElementById('sNameList').addEventListener('change', e => {
    extractionSettings.nameList = e.target.value;
    lastNamedHexKey = '';
    reExtract();
  });

  document.getElementById('expHex').addEventListener('click',    () => exportHex(palette));
  document.getElementById('expRgbHsl').addEventListener('click', () => exportRgbHsl(palette));
  document.getElementById('expCss').addEventListener('click',    () => exportCss(palette));
  document.getElementById('expScp').addEventListener('click',    () => exportScp(palette));
  document.getElementById('expPng').addEventListener('click',    () => exportPng(imgEl, palette));
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────
function downloadText(content, filename) {
  const a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
  a.download = filename;
  a.click();
}

function slugName() {
  return currentImageObj ? currentImageObj.channel : 'palette';
}

function colourTitle(index, hex) {
  const name = currentColorNames[hex.toLowerCase()];
  return name
    ? `Colour ${index + 1} — ${hex} — ${name}`
    : `Colour ${index + 1} — ${hex}`;
}

function exportHex(palette) {
  const lines = palette.map((rgb, i) => {
    const { tints, shades } = makeTintsShades(rgb);
    const all = [...tints, rgb, ...shades];
    return `/* ${colourTitle(i, rgbToHex(rgb))} */\n` + all.map(c => rgbToHex(c)).join('\n');
  });
  downloadText(lines.join('\n\n'), `${slugName()}-hex.txt`);
}

function exportRgbHsl(palette) {
  const lines = palette.map((rgb, i) => {
    const { tints, shades } = makeTintsShades(rgb);
    const all = [...tints, rgb, ...shades].map((c, si) => {
      const hex = rgbToHex(c);
      const [h,s,l] = rgbToHsl(c);
      const label = si < TINT_STEPS ? `tint ${TINT_STEPS - si}` : si === TINT_STEPS ? 'base' : `shade ${si - TINT_STEPS}`;
      return `  ${label.padEnd(8)} ${hex}  rgb(${c[0]}, ${c[1]}, ${c[2]})  hsl(${h}, ${s}%, ${l}%)`;
    });
    return `${colourTitle(i, rgbToHex(rgb))}\n${all.join('\n')}`;
  });
  downloadText(lines.join('\n\n'), `${slugName()}-rgb-hsl.txt`);
}

function exportCss(palette) {
  const varLines = [];
  palette.forEach((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = currentColorNames[hex.toLowerCase()];
    const { tints, shades } = makeTintsShades(rgb);
    const all = [...tints, rgb, ...shades];
    all.forEach((c, si) => {
      const label = si < TINT_STEPS ? `tint-${TINT_STEPS - si}` : si === TINT_STEPS ? 'base' : `shade-${si - TINT_STEPS}`;
      const [h,s,l] = rgbToHsl(c);
      const comment = (si === TINT_STEPS && name) ? ` /* ${name} */` : '';
      varLines.push(`  --color-${i+1}-${label}: hsl(${h}, ${s}%, ${l}%);${comment}`);
    });
  });
  downloadText(`:root {\n${varLines.join('\n')}\n}`, `${slugName()}-vars.css`);
}

function exportScp(palette) {
  const colors = palette.map((rgb, i) => {
    const [r,g,b] = rgb.map(v => parseFloat((v/255).toFixed(4)));
    return { name: colourTitle(i, rgbToHex(rgb)), components: [r, g, b] };
  });
  downloadText(JSON.stringify({ name: slugName(), colors }, null, 2), `${slugName()}.color-palette`);
}

function exportPng(imgEl, palette) {
  const SWATCH_H = 60;
  const PAD = 12;
  const imgW = Math.min(imgEl.naturalWidth || imgEl.width, 800);
  const scale = imgW / (imgEl.naturalWidth || imgEl.width);
  const imgH = Math.round((imgEl.naturalHeight || imgEl.height) * scale);

  const COLS = TINT_STEPS + 1 + SHADE_STEPS;
  const swatchW = Math.floor((imgW - PAD * (COLS + 1)) / COLS);
  const totalH = imgH + PAD + palette.length * (SWATCH_H + PAD) + PAD;

  const c = document.createElement('canvas');
  c.width  = imgW + PAD * 2;
  c.height = totalH;
  const cx = c.getContext('2d');

  cx.fillStyle = '#f5f3ef';
  cx.fillRect(0, 0, c.width, c.height);
  cx.drawImage(imgEl, PAD, PAD, imgW, imgH);

  let y = imgH + PAD * 2;

  palette.forEach((rgb, i) => {
    const { tints, shades } = makeTintsShades(rgb);
    const all = [...tints, rgb, ...shades];
    all.forEach((c2, si) => {
      const x    = PAD + si * (swatchW + PAD);
      const h    = si === TINT_STEPS ? SWATCH_H : SWATCH_H - 8;
      const yOff = si === TINT_STEPS ? 0 : 4;
      cx.fillStyle = rgbToHex(c2);
      roundRect(cx, x, y + yOff, swatchW, h, 4);
      cx.fill();

      const isBase = si === TINT_STEPS;
      const name   = isBase ? currentColorNames[rgbToHex(c2).toLowerCase()] : null;
      cx.font      = '10px monospace';
      cx.fillStyle = textColour(c2);
      cx.textAlign = 'center';
      cx.fillText(name || rgbToHex(c2), x + swatchW/2, y + yOff + h - 8);
    });
    y += SWATCH_H + PAD;
  });

  c.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slugName()}-palette.png`;
    a.click();
  });
}

function roundRect(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x + r, y);
  cx.lineTo(x + w - r, y);
  cx.arcTo(x + w, y, x + w, y + r, r);
  cx.lineTo(x + w, y + h - r);
  cx.arcTo(x + w, y + h, x + w - r, y + h, r);
  cx.lineTo(x + r, y + h);
  cx.arcTo(x, y + h, x, y + h - r, r);
  cx.lineTo(x, y + r);
  cx.arcTo(x, y, x + r, y, r);
  cx.closePath();
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function setStatus(html, isError) {
  statusMsg.innerHTML = html;
  statusMsg.className = 'status-msg' + (isError ? ' error' : '');
}
