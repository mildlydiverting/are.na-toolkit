// app.js: state, DOM wiring and rendering for the single-screen v1 layout.

// ── CONFIG & STORAGE ──────────────────────────────────────────────────────────
const STORAGE_KEY = 'arena-palette-v1';
const DEFAULT_CHANNELS = ['chromatic-vwdupl8d0lk'];
const MAX_CHANNELS = 4;

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

// One throttled are.na client for every API read (150 ms apart; backs off on 429).
const arenaThrottle = createThrottle({
  onWait: seconds => setStatus(`<span class="analyse-spinner" aria-hidden="true"></span>are.na asked us to slow down. Waiting ${seconds}s, then carrying on.`),
});
const arenaClient = createArenaClient({ throttle: arenaThrottle });

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

  arenaClient.setToken(tokenInput.value.trim());
  let allImages = [];
  const errors = [];

  const GRID_SIZE = 12;
  const baseSlots = Math.floor(GRID_SIZE / slugs.length);
  const extraSlots = GRID_SIZE % slugs.length;

  for (let i = 0; i < slugs.length; i++) {
    const slotsNeeded = baseSlots + (i < extraSlots ? 1 : 0);
    try {
      const imgs = await fetchChannelImages(arenaClient, slugs[i], slotsNeeded);
      allImages = allImages.concat(imgs);
    } catch(e) {
      errors.push(e.message);
      if (e.status === 429) break; // still rate limited after the backoffs: stop, don't hammer
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

// ── UTILS ─────────────────────────────────────────────────────────────────────
function setStatus(html, isError) {
  statusMsg.innerHTML = html;
  statusMsg.className = 'status-msg' + (isError ? ' error' : '');
}
