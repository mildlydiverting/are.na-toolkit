// ── CONFIG & STORAGE ──────────────────────────────────────────────────────────
const STORAGE_KEY = 'arena-palette-v1';
const DEFAULT_CHANNELS = ['chromatic-vwdupl8d0lk'];
const MAX_CHANNELS = 4;
const TINT_STEPS = 3;
const SHADE_STEPS = 3;

// Are.na API v3 — https://www.are.na/developers/explore
const API_BASE = 'https://api.are.na/v3';
const MAX_RETRIES = 12;

// ── COLOUR NAME API ───────────────────────────────────────────────────────────
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
  colorCount:    6,
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
const channelListEl  = document.getElementById('channelList');
const btnAddChannel  = document.getElementById('btnAddChannel');
const tokenInput     = document.getElementById('tokenInput');
const btnFetch       = document.getElementById('btnFetch');
const statusMsg      = document.getElementById('statusMsg');
const imageGrid      = document.getElementById('imageGrid');
const imageArea      = document.getElementById('imageArea');
const analysisArea   = document.getElementById('analysisArea');
const imageColHeading = document.getElementById('image-col-heading');
const channelsToggle = document.getElementById('channelsToggle');
const channelsBody   = document.getElementById('channelsBody');
const scratch        = document.getElementById('scratchCanvas');
const ctx            = scratch.getContext('2d', { willReadFrequently: true });

// ── CHANNELS TOGGLE ───────────────────────────────────────────────────────────
channelsToggle.addEventListener('click', () => {
  const isOpen = channelsToggle.getAttribute('aria-expanded') === 'true';
  channelsToggle.setAttribute('aria-expanded', String(!isOpen));
  channelsBody.classList.toggle('hidden', isOpen);
});

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
        placeholder="URL or slug"
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
    inp.addEventListener('paste', e => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text').trim();
      const slug = parseArenaSlug(pasted);
      e.target.value = slug;
      channels[+e.target.dataset.idx] = slug;
      persistState();
    });
    inp.addEventListener('blur', e => {
      const raw = e.target.value.trim();
      const slug = parseArenaSlug(raw);
      if (slug !== raw) {
        e.target.value = slug;
        channels[+e.target.dataset.idx] = slug;
        persistState();
      }
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
    const inputs = channelListEl.querySelectorAll('input[type="text"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }
});

function persistState() {
  saveState(channels, tokenInput.value);
}

// Extract slug from a full are.na URL, e.g. https://www.are.na/user/channel-slug → channel-slug
function parseArenaSlug(val) {
  const match = val.match(/are\.na\/[^/?#\s]+\/([^/?#\s]+)/);
  return match ? match[1] : val;
}

tokenInput.addEventListener('input', persistState);

let currentSwatchData = [];

// ── THEME ─────────────────────────────────────────────────────────────────────
const THEME_KEY = 'arena-palette-theme-v1';

function setTheme(name) {
  document.body.classList.remove('theme-dark', 'theme-mid', 'theme-light');
  if (name !== 'mid') document.body.classList.add('theme-' + name);
  ['dark', 'mid', 'light'].forEach(t => {
    const btn = document.getElementById('theme-' + t);
    if (btn) btn.classList.toggle('active', t === name);
  });
  try { localStorage.setItem(THEME_KEY, name); } catch(_) {}
}

(function initTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY) || 'mid';
    setTheme(saved);
  } catch(_) { setTheme('mid'); }
})();

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
          url:         block.image.small?.src || block.image.src,
          original:    block.image.src,
          title:       block.title || '',
          description: block.description?.plain || block.description?.markdown || (typeof block.description === 'string' ? block.description : '') || '',
          channel:     slug,
          id:          block.id,
          blockUrl:    `https://www.are.na/block/${block.id}`,
          // Source info
          sourceUrl:   block.source?.url   || '',
          sourceTitle: block.source?.title || '',
          // User who added the block
          userName:    block.user?.full_name || block.user?.slug || '',
          userSlug:    block.user?.slug      || '',
          // Date
          createdAt:   block.created_at || '',
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

  const GRID_SIZE = 12;
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

  // Auto-close channels section now thumbnails are rendered
  channelsToggle.setAttribute('aria-expanded', 'false');
  channelsBody.classList.add('hidden');

  images.forEach((img, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.dataset.idx = i;
    thumb.setAttribute('role', 'button');
    thumb.setAttribute('tabindex', '0');
    thumb.setAttribute('aria-label', `Extract palette from ${img.title || 'image'} (${img.channel})`);
    thumb.innerHTML = `
      <img src="${img.url}" crossorigin="anonymous" loading="lazy"
        alt="${img.title ? img.title + ' from ' + img.channel : 'Image from ' + img.channel}" />
    `;
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

  // Update image column heading — fade via class swap
  updateImageHeading(currentImageObj.title || 'Untitled');

  // Show loading state in image area
  imageArea.innerHTML = `<div class="empty-image" role="status"><span class="analyse-spinner" aria-hidden="true"></span>loading…</div>`;
  analysisArea.innerHTML = `<div class="empty-analysis" role="status"><span class="analyse-spinner" aria-hidden="true"></span>extracting palette…</div>`;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    currentImageEl = img;
    renderImagePanel(currentImageObj);
    runExtraction();
  };
  img.onerror = () => {
    imageArea.innerHTML = `<div class="empty-image" role="alert">could not load image (CORS)</div>`;
  };
  img.src = currentImageObj.original + '?t=' + Date.now();
}

// Update the image column h2 with a graceful opacity transition
function updateImageHeading(title) {
  imageColHeading.style.opacity = '0';
  setTimeout(() => {
    imageColHeading.textContent = title;
    imageColHeading.classList.remove('col-heading--placeholder');
    imageColHeading.style.opacity = '1';
  }, 150);
}

// ── RENDER IMAGE PANEL ────────────────────────────────────────────────────────
function renderImagePanel(imgObj) {
  const desc        = typeof imgObj.description === 'string' ? imgObj.description : imgObj.description?.plain || '';
  const hasDescription = desc.trim().length > 0;
  const hasSource      = imgObj.sourceUrl && imgObj.sourceTitle;
  const hasUser        = imgObj.userName && imgObj.userSlug;
  const createdDate    = imgObj.createdAt
    ? new Date(imgObj.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const descHtml = hasDescription ? `
    <div class="image-description">
      <p class="image-description-text" id="imgDescText">${escapeHtml(desc)}</p>
      <button class="btn-show-more" id="btnShowMore" aria-expanded="false" aria-controls="imgDescText">
        show more ↓
      </button>
    </div>
  ` : '';

  const sourceHtml = hasSource ? `
    <div class="image-meta-row">
      <span class="image-meta-label">source</span>
      <a href="${imgObj.sourceUrl}" target="_blank" rel="noopener">${escapeHtml(imgObj.sourceTitle)}</a>
      ${createdDate ? `<span class="image-meta-label">accessed ${createdDate}</span>` : ''}
    </div>
  ` : createdDate ? `
    <div class="image-meta-row">
      <span class="image-meta-label">accessed</span>
      <span>${createdDate}</span>
    </div>
  ` : '';

  const viaHtml = hasUser ? `
    <div class="image-meta-row">
      <span class="image-meta-label">via</span>
      <a href="https://www.are.na/${imgObj.userSlug}" target="_blank" rel="noopener"
        aria-label="View ${escapeHtml(imgObj.userName)}'s Are.na profile">
        ${escapeHtml(imgObj.userName)}
      </a>
    </div>
  ` : '';

  imageArea.innerHTML = `
    <figure class="image-figure">
      <div class="selected-image-wrap">
        <img src="${currentImageEl.src}"
          alt="${imgObj.title ? escapeHtml(imgObj.title) : 'Selected image'}"
          crossorigin="anonymous" />
      </div>
      <figcaption class="image-meta">
        ${imgObj.title ? `<div class="image-meta-row"><strong>${escapeHtml(imgObj.title)}</strong></div>` : ''}
        ${descHtml}
        ${sourceHtml}
        ${viaHtml}
        <div class="image-meta-row">
          <a href="${imgObj.blockUrl}" target="_blank" rel="noopener"
            aria-label="View ${imgObj.title ? escapeHtml(imgObj.title) : 'this image'} on Are.na (opens in new tab)">
            view on are.na ↗
          </a>
        </div>
      </figcaption>
    </figure>
  `;

  // Show more / show less toggle
  if (hasDescription) {
    const btnShowMore  = document.getElementById('btnShowMore');
    const descText     = document.getElementById('imgDescText');
    btnShowMore.addEventListener('click', () => {
      const isExpanded = btnShowMore.getAttribute('aria-expanded') === 'true';
      descText.classList.toggle('expanded', !isExpanded);
      btnShowMore.setAttribute('aria-expanded', String(!isExpanded));
      btnShowMore.textContent = isExpanded ? 'show more ↓' : 'show less ↑';
    });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── EXTRACTION ────────────────────────────────────────────────────────────────
async function runExtraction() {
  if (!currentImageEl) return;
  const paletteData = extractPalette(currentImageEl);
  const swatches    = extractSwatches(currentImageEl);
  currentSwatchData = swatchProportions(swatches, paletteData);
  currentPalette = paletteData;

  renderAnalysis(paletteData, swatches, currentColorNames);

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
    (data.colors || []).forEach(c => {
      if (c.requestedHex && c.name) map[c.requestedHex.replace('#', '').toLowerCase()] = c.name;
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
    const name = nameMap[hex.slice(1).toLowerCase()];
    el.innerHTML = buildLabelHtml(i, hex, pct, name);
  });

  // Also patch the extracted colours legend items
  document.querySelectorAll('.semantic-legend-item[data-hex]').forEach(btn => {
    const hex  = btn.dataset.hex;
    const name = nameMap[hex.slice(1).toLowerCase()];
    const label = btn.querySelector('.palette-legend-label');
    if (label) label.textContent = name ? `${name} · ${hex}` : hex;
    btn.setAttribute('aria-label', `Copy ${name ? name + ' ' : ''}${hex} to clipboard`);
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

// ── HELPER — needed for rgb+hsl and css exports ───────────────────────────────
// (only add this if hexToRgb doesn't already exist in main.js)
function hexToRgb(hex) {
  const h = hex.replace('#','');
  return [
    parseInt(h.slice(0,2),16),
    parseInt(h.slice(2,4),16),
    parseInt(h.slice(4,6),16),
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
function renderAnalysis(paletteData, swatchMap, nameMap) {
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


  // Extracted palette section — same structure as semantic, sits between prop bar and semantic
  const paletteSectionHtml = (() => {
    const items = applyFloor(
      paletteData.map(({ rgb, proportion }) => ({ hex: rgbToHex(rgb), tc: textColour(rgb), proportion })),
      0.01
    );
    const segments = items.map(({ hex, tc, proportion }) => {
      const pct = Math.round(proportion * 100);
      return `<div class="semantic-segment"
        style="flex:${proportion};background:${hex}"
        title="${hex} · ${pct}%"
        aria-label="${hex}: ${pct}%">
        <span class="semantic-segment-label" style="color:${tc}" aria-hidden="true">${pct > 8 ? pct + '%' : ''}</span>
      </div>`;
    }).join('');
    const legend = paletteData.map(({ rgb }) => {
      const hex  = rgbToHex(rgb);
      const name = nameMap[hex.slice(1).toLowerCase()];
      return `<button class="semantic-legend-item"
        data-hex="${hex}"
        onclick="navigator.clipboard.writeText('${hex}').catch(()=>{})"
        aria-label="Copy ${name ? name + ' ' : ''}${hex} to clipboard">
        <span class="semantic-legend-dot" style="background:${hex}" aria-hidden="true"></span>
        <span class="palette-legend-label">${name ? `${name} · ${hex}` : hex}</span>
      </button>`;
    }).join('');
    return `<div class="semantic-section">
      <div class="semantic-label" id="palette-section-label">extracted colours</div>
      <div class="semantic-bar" role="img" aria-labelledby="palette-section-label">${segments}</div>
      <div class="semantic-legend" role="list">${legend}</div>
    </div>`;
  })();

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
            <select id="sQuality" name="quality">
              <option value="hi"  ${s.quality==='hi' ?'selected':''}>high (slow)</option>
              <option value="med" ${s.quality==='med'?'selected':''}>medium</option>
              <option value="lo"  ${s.quality==='lo' ?'selected':''}>low (fast)</option>
            </select>
          </div>
          <div class="setting-row">
            <label for="sColorSpace">colour space</label>
            <select id="sColorSpace" name="colorSpace">
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
            <select id="sNameList" name="nameList">${nameListOptions}</select>
          </div>
        </div>
      </div>

      ${paletteSectionHtml}
      ${semanticBarHtml}

      <div class="export-bar" role="toolbar" aria-label="Export palette">
        <button class="btn-export" id="expHex"    aria-label="Export hex values as text file">export hex</button>
        <button class="btn-export" id="expRgb"    aria-label="Export RGB values as text file">export rgb</button>
        <button class="btn-export" id="expHsl"    aria-label="Export HSL values as text file">export hsl</button>
        <button class="btn-export" id="expCss"    aria-label="Export CSS custom properties">export css vars</button>
        <button class="btn-export" id="expScp"    aria-label="Export Simple Color Palette file">export .color-palette</button>
        <button class="btn-export" id="expAse"     aria-label="Export Adobe Swatch Exchange file">export .ase</button>
        <button class="btn-export" id="expGpl"     aria-label="Export GIMP palette file">export .gpl</button>
        <button class="btn-export" id="expPalette" aria-label="Export Procreate palette file">export .palette</button>
        <div class="export-png-group" role="group" aria-label="Export PNG">
          <span class="export-png-label">png:</span>
          <button class="btn-export" id="expPngBars"         aria-label="Export reference card PNG (bars layout)">bars</button>
          <button class="btn-export" id="expPngDots"         aria-label="Export dot grid PNG, transparent background">dots</button>
          <button class="btn-export" id="expPngDotsBg"       aria-label="Export dot grid PNG with blurred image background">dots + bg</button>
        </div>
      </div>

      <div class="semantic-section semantic-section--flush">
        <div class="semantic-label">tints &amp; shades</div>
      </div>
      <div class="colour-rows" role="list" aria-label="Extracted colours with tints and shades">${rows}</div>
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

  // Settings toggle
  document.getElementById('settingsToggle').addEventListener('click', () => {
    const body   = document.getElementById('settingsBody');
    const btn    = document.getElementById('settingsToggle');
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    body.classList.toggle('hidden', isOpen);
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
    document.getElementById('colorCountVal').textContent = extractionSettings.colorCount;
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
    document.getElementById('minSatVal').textContent = extractionSettings.minSaturation.toFixed(2);
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
  document.getElementById('expRgb').addEventListener('click',    () => exportRgb(palette));
  document.getElementById('expHsl').addEventListener('click',    () => exportHsl(palette));
  document.getElementById('expCss').addEventListener('click',    () => exportCss(palette));
  document.getElementById('expScp').addEventListener('click',    () => exportScp(palette));
  document.getElementById('expAse').addEventListener('click',     () => exportAse(palette));
  document.getElementById('expGpl').addEventListener('click',     () => exportGpl(palette));
  document.getElementById('expPalette').addEventListener('click', () => exportProcreatePalette(palette));
  document.getElementById('expPngBars').addEventListener('click',   () => exportPngBars());
  document.getElementById('expPngDots').addEventListener('click',   () => exportPngDots(false));
  document.getElementById('expPngDotsBg').addEventListener('click', () => exportPngDots(true));
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────
function downloadText(content, filename) {
  const a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
  a.download = filename;
  a.click();
}

function downloadBinary(buffer, filename) {
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}


function slugName() {
  return currentImageObj ? currentImageObj.channel : 'palette';
}

// Export filename base: strip the Are.na hash suffix from the channel slug
// and append the block id. e.g. "chromatic-vwdupl8d0lk" + id 44858120
// => "chromatic-block-44858120"
function exportSlug() {
  if (!currentImageObj) return 'palette';
  const channel = currentImageObj.channel.replace(/-(?=[a-z0-9]{7,}$)[a-z0-9]*[0-9][a-z0-9]*$/i, '');
  const id = currentImageObj.id || '';
  return id ? `${channel}-block-${id}` : channel;
}

function colourTitle(index, hex) {
  const name = currentColorNames[hex.slice(1).toLowerCase()];
  return name
    ? `Colour ${index + 1} — ${hex} — ${name}`
    : `Colour ${index + 1} — ${hex}`;
}

// Consistent label: #hex [Name] [(xx%)] [tint N / shade N]
// Pass null/undefined for fields to omit.
function swatchLabel(hex, name, pct, suffix) {
  const parts = [hex];
  if (name) parts.push(name);
  if (pct != null) parts.push(`(${pct}%)`);
  if (suffix) parts.push(suffix);
  return parts.join(' ');
}

// CSS variable name slug: "Warm Cinnabar" → "warm-cinnabar"
function cssSlug(name, fallback) {
  if (!name) return fallback;
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || fallback;
}

function exportHeader() {
  const title = currentImageObj?.title || '';
  const url   = currentImageObj?.blockUrl || '';
  const lines = ['arena-palette export'];
  if (title) lines.push(`Image:  ${title}`);
  if (url)   lines.push(`Source: ${url}`);
  lines.push('---');
  return lines.join('\n') + '\n\n';
}

function exportHex(palette) {
  const out = [exportHeader()];

  // 1. Palette
  out.push('/* Palette */\n');
  palette.forEach((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = currentColorNames[hex.slice(1).toLowerCase()];
    const pct  = Math.round((currentPalette[i]?.proportion ?? 0) * 100);
    out.push(`/* ${swatchLabel(hex, name, pct || null)} */\n${hex}\n`);
  });

  // 2. Semantic palette
  if (currentSwatchData.length) {
    out.push('/* Semantic palette */\n');
    currentSwatchData.forEach(({ role, hex, proportion }) => {
      const pct = Math.round((proportion ?? 0) * 100);
      out.push(`/* ${swatchLabel(hex, role, pct || null)} */\n${hex}\n`);
    });
  }

  // 3. Tints and Shades
  out.push('/* Tints and Shades */\n');
  palette.forEach((rgb) => {
    const hex  = rgbToHex(rgb);
    const name = currentColorNames[hex.slice(1).toLowerCase()];
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

  downloadText(out.join('\n'), `${exportSlug()}-hex.txt`);
}

function exportRgb(palette) {
  const out = [exportHeader()];

  // 1. Palette
  out.push('/* Palette */\n');
  palette.forEach((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = currentColorNames[hex.slice(1).toLowerCase()];
    const pct  = Math.round((currentPalette[i]?.proportion ?? 0) * 100);
    out.push(`/* ${swatchLabel(hex, name, pct || null)} */\nrgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})\n`);
  });

  // 2. Semantic palette
  if (currentSwatchData.length) {
    out.push('/* Semantic palette */\n');
    currentSwatchData.forEach(({ role, hex, proportion }) => {
      const rgb = hexToRgb(hex);
      const pct = Math.round((proportion ?? 0) * 100);
      out.push(`/* ${swatchLabel(hex, role, pct || null)} */\nrgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})\n`);
    });
  }

  // 3. Tints and Shades
  out.push('/* Tints and Shades */\n');
  palette.forEach((rgb) => {
    const hex  = rgbToHex(rgb);
    const name = currentColorNames[hex.slice(1).toLowerCase()];
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

  downloadText(out.join('\n'), `${exportSlug()}-rgb.txt`);
}

function exportHsl(palette) {
  const out = [exportHeader()];

  // 1. Palette
  out.push('/* Palette */\n');
  palette.forEach((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = currentColorNames[hex.slice(1).toLowerCase()];
    const pct  = Math.round((currentPalette[i]?.proportion ?? 0) * 100);
    const [h,s,l] = rgbToHsl(rgb);
    out.push(`/* ${swatchLabel(hex, name, pct || null)} */\nhsl(${h}, ${s}%, ${l}%)\n`);
  });

  // 2. Semantic palette
  if (currentSwatchData.length) {
    out.push('/* Semantic palette */\n');
    currentSwatchData.forEach(({ role, hex, proportion }) => {
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
    const name = currentColorNames[hex.slice(1).toLowerCase()];
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

  downloadText(out.join('\n'), `${exportSlug()}-hsl.txt`);
}

function exportCss(palette) {
  const header = `/*\n * arena-palette export\n * ${currentImageObj?.title || ''}\n * ${currentImageObj?.blockUrl || ''}\n */\n\n`;
  const varLines = [];

  // 1. Palette — one var per base colour, named by slug
  varLines.push('  /* Palette */');
  palette.forEach((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = currentColorNames[hex.slice(1).toLowerCase()];
    const slug = cssSlug(name, `color-${i + 1}`);
    const pct  = Math.round((currentPalette[i]?.proportion ?? 0) * 100);
    const [h,s,l] = rgbToHsl(rgb);
    varLines.push(`  --${slug}: hsl(${h}, ${s}%, ${l}%); /* ${swatchLabel(hex, null, pct || null)} */`);
  });
  varLines.push('');

  // 2. Semantic palette
  if (currentSwatchData.length) {
    varLines.push('  /* Semantic palette */');
    currentSwatchData.forEach(({ role, hex, proportion }) => {
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
    const name = currentColorNames[hex.slice(1).toLowerCase()];
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

  downloadText(header + `:root {\n${varLines.join('\n')}\n}`, `${exportSlug()}-vars.css`);
}

function exportScp(palette) {
  const paletteEntries = palette.map((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = currentColorNames[hex.slice(1).toLowerCase()];
    const pct  = Math.round((currentPalette[i]?.proportion ?? 0) * 100);
    return { hex, ...(name ? { name } : {}), ...(pct ? { proportion: pct / 100 } : {}) };
  });

  const semanticEntries = currentSwatchData.map(({ role, hex, proportion }) => {
    const pct = Math.round((proportion ?? 0) * 100);
    return { role, hex, ...(pct ? { proportion: pct / 100 } : {}) };
  });

  const tintsShades = palette.map((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = currentColorNames[hex.slice(1).toLowerCase()];
    const { tints, shades } = makeTintsShades(rgb);
    return {
      hex,
      ...(name ? { name } : {}),
      tints:  tints.map((c, ti) => ({ hex: rgbToHex(c), label: `tint ${TINT_STEPS - ti}` })),
      shades: shades.map((c, si) => ({ hex: rgbToHex(c), label: `shade ${si + 1}` })),
    };
  });

  const payload = {
    name:        currentImageObj?.title || slugName(),
    sourceUrl:   currentImageObj?.blockUrl || '',
    palette:     paletteEntries,
    semantic:    semanticEntries,
    tintsShades,
  };
  downloadText(JSON.stringify(payload, null, 2), `${exportSlug()}.color-palette`);
}

// ── EXPORT — ASE (Adobe Swatch Exchange) ──────────────────────────────────────
function exportAse(palette) {
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
    const name    = currentColorNames[baseHex.slice(1).toLowerCase()];
    const pct     = Math.round((currentPalette[i]?.proportion ?? 0) * 100);
    blocks.push(...colourBlock(swatchLabel(baseHex, name, pct || null), rgb));
    blockCount++;
  });
  blocks.push(...groupEndBlock());
  blockCount++;

  // 2. Semantic group
  if (currentSwatchData.length) {
    blocks.push(...groupStartBlock('Semantic palette'));
    blockCount++;
    currentSwatchData.forEach(({ role, hex, proportion }) => {
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
    const name    = currentColorNames[baseHex.slice(1).toLowerCase()];
    const pct     = Math.round((currentPalette[i]?.proportion ?? 0) * 100);

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

  downloadBinary(out.buffer, `${exportSlug()}.ase`);
}

// ── EXPORT — GPL (GIMP palette) ───────────────────────────────────────────────
function exportGpl(palette) {
  const title = currentImageObj?.title || exportSlug();
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
    const name = currentColorNames[hex.slice(1).toLowerCase()];
    const pct  = Math.round((currentPalette[i]?.proportion ?? 0) * 100);
    lines.push(`${rgb[0]}\t${rgb[1]}\t${rgb[2]}\t${swatchLabel(hex, name, pct || null)}`);
  });

  // 2. Semantic palette
  if (currentSwatchData.length) {
    lines.push('# Semantic palette');
    currentSwatchData.forEach(({ role, hex, proportion }) => {
      const rgb = hexToRgb(hex);
      const pct = Math.round((proportion ?? 0) * 100);
      lines.push(`${rgb[0]}\t${rgb[1]}\t${rgb[2]}\t${swatchLabel(hex, role, pct || null)}`);
    });
  }

  // 3. Tints & shades per colour
  palette.forEach((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = currentColorNames[hex.slice(1).toLowerCase()];
    const pct  = Math.round((currentPalette[i]?.proportion ?? 0) * 100);
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

  downloadText(lines.join('\n'), `${exportSlug()}.gpl`);
}

// ── EXPORT — Procreate .palette ───────────────────────────────────────────────
function exportProcreatePalette(palette) {
  // Procreate palette JSON: array of up to 30 colour objects
  // Each: { name, hue, saturation, brightness, alpha } — all floats 0–1 (HSB)
  // Unfilled slots must be null

  function rgbToHsb([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return [h, max === 0 ? 0 : d / max, max];
  }

  function makeEntry(rgb, name) {
    const [h, s, b] = rgbToHsb(rgb);
    return { name, hue: h, saturation: s, brightness: b, alpha: 1 };
  }

  const swatches = [];

  // 1. Base colours
  palette.forEach((rgb, i) => {
    const hex  = rgbToHex(rgb);
    const name = currentColorNames[hex.slice(1).toLowerCase()];
    const pct  = Math.round((currentPalette[i]?.proportion ?? 0) * 100);
    swatches.push(makeEntry(rgb, swatchLabel(hex, name, pct || null)));
  });

  // 2. Semantic palette
  currentSwatchData.forEach(({ role, hex, proportion }) => {
    const pct = Math.round((proportion ?? 0) * 100);
    swatches.push(makeEntry(hexToRgb(hex), swatchLabel(hex, role, pct || null)));
  });

  // 3. Tints & shades per colour
  palette.forEach((rgb) => {
    const hex  = rgbToHex(rgb);
    const name = currentColorNames[hex.slice(1).toLowerCase()];
    const { tints, shades } = makeTintsShades(rgb);

    tints.forEach((c, ti) => {
      const th = rgbToHex(c);
      swatches.push(makeEntry(c, swatchLabel(th, name, null, `tint ${TINT_STEPS - ti}`)));
    });
    swatches.push(makeEntry(rgb, swatchLabel(hex, name)));
    shades.forEach((c, si) => {
      const sh = rgbToHex(c);
      swatches.push(makeEntry(c, swatchLabel(sh, name, null, `shade ${si + 1}`)));
    });
  });

  // Pad or truncate to exactly 30
  const MAX = 30;
  const trimmed = swatches.slice(0, MAX);
  while (trimmed.length < MAX) trimmed.push(null);

  downloadText(JSON.stringify(trimmed, null, 2), `${exportSlug()}.palette`);
}


// ── PNG RENDERER — shared ─────────────────────────────────────────────────────

// Are.na logo path (SVG viewBox 0 0 13 8)
const LOGO_PATH_D = 'M12.8745 5.60598L11.0723 4.13301C10.962 4.04311 10.962 3.89549 11.0723 3.80532L12.8745 2.33271C12.9852 2.24262 13.0314 2.09042 12.9774 1.99467C12.9233 1.8992 12.7722 1.86521 12.642 1.91915L10.499 2.80685C10.3687 2.86134 10.246 2.78708 10.2265 2.64233L9.90419 0.263056C9.88431 0.118402 9.77971 0 9.67139 0C9.56359 0 9.45908 0.118402 9.43972 0.262966L9.11728 2.64242C9.09757 2.78717 8.97499 2.86125 8.84454 2.80694L6.737 1.93399C6.6063 1.87987 6.39338 1.87987 6.26302 1.93399L4.15514 2.80694C4.02478 2.86125 3.90203 2.78717 3.88249 2.64242L3.56048 0.262966C3.5406 0.118402 3.43617 0 3.32829 0C3.22006 0 3.11538 0.118402 3.09593 0.262966L2.77348 2.64242C2.75395 2.78717 2.63128 2.86125 2.50092 2.80694L0.358028 1.91942C0.227755 1.86521 0.076908 1.89938 0.0227932 1.99476C-0.0312351 2.0906 0.0148402 2.24289 0.125145 2.3328L1.92753 3.80541C2.03792 3.89558 2.03792 4.0432 1.92753 4.13319L0.125145 5.60598C0.0144945 5.69606 -0.0313216 5.85735 0.0226203 5.96415C0.0768216 6.07114 0.227669 6.11411 0.357769 6.05981L2.48147 5.17283C2.612 5.11862 2.73337 5.19243 2.75161 5.33717L3.05798 7.73721C3.07648 7.88169 3.19784 8 3.32769 8C3.45735 8 3.57881 7.88178 3.5974 7.73721L3.90428 5.33717C3.92243 5.19243 4.04432 5.1187 4.17416 5.17283L6.26302 6.0447C6.39321 6.09918 6.60621 6.09918 6.73649 6.0447L8.82501 5.17283C8.95502 5.11862 9.07656 5.19243 9.09515 5.33717L9.40203 7.73721C9.42035 7.88169 9.54181 8 9.67131 8C9.80115 8 9.9226 7.88178 9.94102 7.73721L10.2479 5.33717C10.2666 5.19243 10.3879 5.1187 10.518 5.17283L12.6419 6.05981C12.7716 6.11411 12.9229 6.07105 12.977 5.96424C13.0312 5.85762 12.9851 5.69633 12.8745 5.60625L12.8745 5.60598ZM8.28939 4.15171L6.70225 5.42249C6.59117 5.51149 6.40894 5.51149 6.29821 5.42249L4.71055 4.15171C4.59956 4.06271 4.59869 3.91617 4.70882 3.82581L6.29942 2.52285C6.40955 2.4325 6.59013 2.4325 6.70035 2.52285L8.29095 3.82581C8.40134 3.91608 8.40047 4.06262 8.28922 4.1518L8.28939 4.15171Z';

function drawLogoOnCanvas(ctx, x, y, w, h, colour) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 13, h / 8);
  ctx.fillStyle = colour || '#000000';
  ctx.fill(new Path2D(LOGO_PATH_D));
  ctx.restore();
}

function drawChrome(ctx, blockUrl, logoX, logoY, logoW, logoH, logoColour, textColour) {
  drawLogoOnCanvas(ctx, logoX, logoY, logoW, logoH, logoColour || '#000000');
  ctx.font = '400 28px Karla, sans-serif';
  ctx.fillStyle = textColour || '#000000';
  ctx.textBaseline = 'middle';
  ctx.fillText(blockUrl, logoX + logoW + 16, logoY + logoH / 2 - 2);
}

function loadImageForCanvas(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Map current extraction globals to the renderer data shape.
// makeTintsShades returns tints lightest→darkest (t3 first) and shades
// lightest→darkest (s1 first). Renderers want tints t1→t3 (lightest last)
// and shades s3→s1 (darkest first), so both arrays are reversed.
function buildRendererData() {
  if (!currentPalette || !currentImageObj) return null;

  const palette = currentPalette.map(({ rgb }) => {
    const { tints, shades } = makeTintsShades(rgb);
    return {
      base:   rgbToHex(rgb),
      tints:  [...tints].reverse().map(rgbToHex),   // t1 (darkest tint) → t3 (lightest)
      shades: [...shades].reverse().map(rgbToHex),  // s3 (darkest shade) → s1
    };
  });

  // Build semantic map from currentSwatchData (roles: Vibrant, DarkVibrant, etc.)
  const semMap = {};
  currentSwatchData.forEach(({ role, hex }) => { semMap[role] = hex; });
  const semantic = {
    darkVibrant:  semMap['DarkVibrant']  || null,
    vibrant:      semMap['Vibrant']      || null,
    lightVibrant: semMap['LightVibrant'] || null,
    darkMuted:    semMap['DarkMuted']    || null,
    muted:        semMap['Muted']        || null,
    lightMuted:   semMap['LightMuted']   || null,
  };

  // blockUrl: strip protocol and www  e.g. "are.na/block/12345678"
  const rawUrl = currentImageObj.blockUrl || '';
  const blockUrl = rawUrl.replace(/^https?:\/\/(www\.)?/, '');

  return {
    blockUrl,
    imageUrl: currentImageObj.original || currentImageEl?.src || '',
    palette,
    semantic,
  };
}

// ── PNG RENDERER — BARS 2 ─────────────────────────────────────────────────────

async function renderBars(canvas, data) {
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

function buildDotSequence(palette, semantic) {
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

async function renderDots(canvas, data, withBackground) {
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

function triggerCanvasDownload(canvas, filename) {
  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  });
}

async function exportPngBars() {
  const data = buildRendererData();
  if (!data) return;
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 1200;
  await document.fonts.ready;
  await renderBars(c, data);
  triggerCanvasDownload(c, `${exportSlug()}-bars.png`);
}

async function exportPngDots(withBackground) {
  const data = buildRendererData();
  if (!data) return;
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 1200;
  await document.fonts.ready;
  await renderDots(c, data, withBackground);
  const suffix = withBackground ? 'dots-bg' : 'dots';
  triggerCanvasDownload(c, `${exportSlug()}-${suffix}.png`);
}


// ── UTILS ─────────────────────────────────────────────────────────────────────
function setStatus(html, isError) {
  statusMsg.innerHTML = html;
  statusMsg.className = 'status-msg' + (isError ? ' error' : '');
}
