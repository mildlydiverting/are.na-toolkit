// app.js: six-step wizard for arena-palette v2.0. Steps 1 (Source), 2 (Pick image, with per-slot refresh and lock), 3 (Base palette) and 6 (Export, v1's formats) are built until
// they are ported from legacy-app.js (build plan, Phase 2); Edit and Ramps arrive in Phases 3–4.
// Plain DOM, built from ArenaToolkit components. No framework.
(function () {
  const ATK = window.ArenaToolkit;
  const h = (tag, attrs, kids) => ATK._el(tag, attrs, kids);

  const STEPS = [
    { id: 'source',  label: 'Source',       description: 'Choose the channels or blocks to draw images from.' },
    { id: 'pick',    label: 'Pick image',   description: 'Choose the image to take colours from.' },
    { id: 'base',    label: 'Base palette', description: 'Extract the colours and check their names.' },
    { id: 'edit',    label: 'Edit',         description: 'Adjust, add, remove or lock colours.' },
    { id: 'ramps',   label: 'Ramps',        description: 'Make tints and shades for each colour.' },
    { id: 'export',  label: 'Export',       description: 'Download or copy the palette.' },
  ];

  // All palette state lives in S, so the stepper can move backwards without losing work (plan §8).
  const S = {
    sources:  STORE_DEFAULT_SOURCES.map(input => ({ kind: 'channel', input, slug: null, id: null, meta: null, error: null })),
    token:    '',
    rememberToken: true,
    grid:     [],                       // [{ block, locked, kind: 'channel'|'block', source, busy }] × up to 12
    image:    null,                     // { index, block, img } once chosen (img is the loaded element)
    extract:  { ...STORE_DEFAULT_EXTRACT },
    palette:  [],                       // [{ hex, name, proportion, locked, source }]; name undefined = not looked up yet, '' = no name
    semantic: [],                       // [{ role, hex, name, proportion }], read-only in v2.0
    ramps:    { enabled: false, tones: 7, lMax: 0.95, lMin: 0.20, hueRotate: 0, drift: { tint: 0, shade: 0 }, result: null },
    export:   { scope: 'base', semantic: true },
    step:     0,
    furthest: 0,
  };

  const els = {
    header: document.getElementById('header'),
    rail: document.getElementById('step-rail'),
    pane: document.getElementById('step-pane'),
  };

  // One throttled are.na client for every read (150 ms apart; backs off on 429).
  const throttle = createThrottle({
    onWait: (seconds) => ATK.Toast.show({ message: `are.na asked us to slow down. Waiting ${seconds}s, then carrying on.`, variant: 'notification', duration: seconds * 1000 }),
  });
  const client = createArenaClient({ throttle });
  const imageCache = createImageCache(loadImageElement);   // each image loads once; asking again reuses it

  // Sources, token (only if "Remember token" is ticked) and extraction settings survive a reload.
  function persist() {
    savePaletteStorage(localStorage, { sources: S.sources.map(s => s.input), token: S.token, rememberToken: S.rememberToken, extract: S.extract });
  }

  let fetching = false;   // Source step: a fetch is in flight
  let gridLoading = false, gridError = null, gridGen = 0;   // Pick step: loading the grid (gen drops stale results)
  let imageLoading = false, imageError = null;               // Pick step: loading the chosen image
  let refreshingAll = false;                                 // Pick step: Refresh all is running
  let autoForward = false;                                   // a lone block source skips straight past Pick

  /* ── Navigation ───────────────────────────────────────────── */
  // A step can be entered once the one before it has been completed.
  function canEnter(i) {
    return i <= S.furthest;
  }

  function go(i) {
    if (i < 0 || i >= STEPS.length || !canEnter(i)) return;
    if (i < S.step) autoForward = false;   // going back cancels a pending skip past Pick
    S.step = i;
    render();
  }

  function advance() {
    S.furthest = Math.max(S.furthest, S.step + 1);
    go(S.step + 1);
  }

  /* ── Rail ─────────────────────────────────────────────────── */
  function renderRail() {
    const items = STEPS.map((s, i) => ({
      label: s.label,
      description: s.description,
      state: i === S.step ? 'current' : i < S.step ? 'done' : 'upcoming',
    }));
    const stepper = ATK.Stepper({ items });
    stepper.querySelectorAll('.atk-stepper__item').forEach((item, i) => {
      if (!canEnter(i)) item.classList.add('is-locked');
      item.addEventListener('click', () => go(i));
    });
    els.rail.replaceChildren(stepper);
  }

  /* ── Steps ────────────────────────────────────────────────── */
  function nav({ back = true, next = null } = {}) {
    const row = h('div', { className: 'step-nav' });
    row.append(
      back ? ATK.Button({ variant: 'ghost', children: '← Back', onClick: () => go(S.step - 1) }) : h('span'),
      next ? ATK.Button({ variant: 'primary', children: next.label, disabled: next.disabled, onClick: next.onClick }) : h('span'),
    );
    return row;
  }

  // Placeholder pane: the step's heading and a note, with Back / Continue so the whole rail can be walked.
  function stepPlaceholder(i, note) {
    const s = STEPS[i];
    return [
      h('h2', null, s.label),
      h('p', { className: 'muted' }, s.description),
      h('p', null, note),
      nav({
        back: i > 0,
        next: i < STEPS.length - 1 ? { label: 'Continue →', onClick: advance } : null,
      }),
    ];
  }


  /* ── Step 1: Source ───────────────────────────────────────── */
  const emptySource = (input = '') => ({ kind: 'channel', input, slug: null, id: null, meta: null, error: null });
  const isResolved = (src) => !!src.meta;
  const hasResolved = () => S.sources.some(isResolved);

  function describeSource(src) {
    if (src.kind === 'block') return `Block ${src.id}: ${src.meta.title || 'Untitled'}`;
    const n = src.meta.counts?.contents;
    return `${src.meta.title || src.slug}${n != null ? `: ${n} block${n === 1 ? '' : 's'}` : ''}`;
  }

  async function fetchSources() {
    const filled = S.sources.filter(src => src.input.trim());
    if (!filled.length) {
      S.sources.forEach(src => { src.error = null; });
      S.sources[0].error = 'Add a channel or block to fetch.';
      return render();
    }
    client.setToken(S.token.trim());
    persist();
    fetching = true;
    // New sources mean a new grid, and anything built from the old one is stale.
    gridGen++;
    Object.assign(S, { grid: [], image: null, palette: [], semantic: [], furthest: 0 });
    gridLoading = false; gridError = null; imageLoading = false; imageError = null;
    render();
    let stop = false;
    for (const src of S.sources) {
      Object.assign(src, { slug: null, id: null, meta: null, error: null });
      if (stop || !src.input.trim()) continue;
      const parsed = parseSourceInput(src.input);
      if (parsed.kind === 'invalid') { src.error = 'That is not a channel slug, channel link or block link.'; continue; }
      try {
        if (parsed.kind === 'channel') {
          src.meta = await fetchChannelMeta(client, parsed.slug);
          Object.assign(src, { kind: 'channel', slug: parsed.slug, id: src.meta.id });
        } else {
          src.meta = await fetchBlock(client, parsed.id);
          Object.assign(src, { kind: 'block', id: parsed.id });
        }
      } catch (err) {
        src.error = err.message;
        if (err.status === 429) stop = true;   // still rate limited after the backoffs: stop, don't hammer
      }
    }
    fetching = false;
    render();
  }

  // A single block needs no choosing, so Pick is passed straight through once the block has loaded.
  function continueFromSource() {
    const resolved = S.sources.filter(isResolved);
    autoForward = resolved.length === 1 && resolved[0].kind === 'block';
    advance();
  }

  function stepSource() {
    const rows = S.sources.map((src, i) => {
      const input = ATK.Input({
        value: src.input,
        placeholder: 'Channel slug, channel link or block link',
        onInput: (e) => {
          Object.assign(src, { input: e.target.value, slug: null, id: null, meta: null, error: null });
          persist();
          refreshActions();
        },
      });
      input.setAttribute('aria-label', `Source ${i + 1}`);
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('spellcheck', 'false');
      // Tidy a pasted channel link down to its slug.
      input.addEventListener('blur', () => {
        const parsed = parseSourceInput(input.value);
        if (parsed.kind === 'channel' && parsed.slug !== input.value.trim()) { input.value = parsed.slug; src.input = parsed.slug; }
      });
      const remove = ATK.Button({
        variant: 'ghost',
        children: '×',
        disabled: fetching || S.sources.length === 1,
        onClick: () => { S.sources.splice(i, 1); persist(); render(); },
      });
      remove.setAttribute('aria-label', `Remove source ${i + 1}`);
      return h('div', { className: 'source-row' }, [input, remove]);
    });

    const add = S.sources.length < STORE_MAX_SOURCES
      ? ATK.Button({
        variant: 'secondary',
        children: 'Add another source',
        disabled: fetching,
        onClick: () => {
          S.sources.push(emptySource());
          render();
          const inputs = els.pane.querySelectorAll('.source-row .atk-input');
          if (inputs.length) inputs[inputs.length - 1].focus();
        },
      })
      : null;

    const token = ATK.Input({
      type: 'password',
      value: S.token,
      placeholder: 'Leave blank for public channels',
      onInput: (e) => { S.token = e.target.value; persist(); },
    });
    token.setAttribute('aria-label', 'are.na access token');
    token.setAttribute('autocomplete', 'off');

    const actions = h('div', { className: 'stack' });
    function refreshActions() {
      const results = S.sources.map((src, i) => {
        if (src.error) return ATK.StatusMessage({ tone: 'error', label: src.input.trim() ? `Couldn't read “${src.input.trim()}”` : `Source ${i + 1}`, children: src.error });
        if (isResolved(src)) return ATK.StatusMessage({ tone: 'success', children: describeSource(src) });
        return null;
      }).filter(Boolean);
      actions.replaceChildren(
        ATK.Button({ variant: 'primary', children: fetching ? 'Fetching…' : 'Fetch', disabled: fetching, onClick: fetchSources }),
        ...results,
        nav({ back: false, next: { label: 'Continue →', disabled: fetching || !hasResolved(), onClick: continueFromSource } }),
      );
    }
    refreshActions();

    return [
      h('h2', null, 'Source'),
      h('p', { className: 'muted' }, 'Paste up to four channels or image blocks to draw from. Channel slugs, channel links and block links all work.'),
      h('div', { className: 'stack' }, [...rows, add].filter(Boolean)),
      h('div', { className: 'stack' }, [
        h('p', { className: 'muted' }, 'are.na access token (optional). Only needed for private channels; read access is enough. It is kept in this browser only while “Remember token” is ticked.'),
        token,
        ATK.Checkbox({ label: 'Remember token in this browser', checked: S.rememberToken, onChange: (checked) => { S.rememberToken = checked; persist(); } }),
      ]),
      actions,
    ];
  }

  /* ── Step 2: Pick image ───────────────────────────────────── */
  async function loadGrid() {
    const gen = ++gridGen;
    gridLoading = true; gridError = null;
    S.grid = [];
    const sources = S.sources.filter(isResolved);
    const errors = [];
    for (const slot of planGridSlots(sources)) {
      if (gen !== gridGen) return;
      const src = sources[slot.index];
      if (slot.kind === 'block') {
        S.grid.push({ block: imageFromBlock(src.meta, ''), locked: true, kind: 'block', source: src, busy: false });
      } else {
        try {
          const imgs = await fetchChannelImages(client, src.slug, slot.count, { meta: src.meta });
          if (gen !== gridGen) return;
          imgs.forEach(block => S.grid.push({ block, locked: false, kind: 'channel', source: src, busy: false }));
        } catch (err) {
          if (gen !== gridGen) return;
          errors.push(err.message);
          if (err.status === 429) break;   // still rate limited after the backoffs: stop, don't hammer
        }
      }
      if (S.step === 1) render();
    }
    gridLoading = false;
    if (!S.grid.length) gridError = errors[0] || 'No images found.';
    else if (errors.length) ATK.Toast.show({ message: `${errors.length} source${errors.length > 1 ? 's' : ''} could not be read: ${errors[0]}`, variant: 'warning', duration: 8000 });
    if (S.step === 1) render();
    if (autoForward && S.grid.length === 1) selectImage(0);
  }

  async function selectImage(i) {
    const entry = S.grid[i];
    if (!entry) return;
    S.image = { index: i, block: entry.block, img: null };
    imageLoading = true; imageError = null;
    // Anything built from an earlier image is stale; the later steps are entered afresh.
    Object.assign(S, { palette: [], semantic: [] });
    S.furthest = Math.min(S.furthest, 1);
    if (S.step === 1) render();
    const chosen = S.image;
    try {
      const img = await imageCache.get(entry.block.original);
      if (S.image !== chosen) return;   // another image was chosen meanwhile
      chosen.img = img;
      imageLoading = false;
      if (autoForward) {
        autoForward = false;
        S.furthest = Math.max(S.furthest, 2);
        return go(2);
      }
    } catch (err) {
      console.error('arena-palette: image load failed', err);
      if (S.image !== chosen) return;
      imageLoading = false;
      imageError = 'Couldn’t load that image. The host may not allow it to be read for colour extraction; try another.';
      autoForward = false;
    }
    if (S.step === 1) render();
  }

  // Picking a different image for a slot that held the chosen one means nothing is chosen any more.
  function dropSelectionIf(entry) {
    if (!S.image || S.grid[S.image.index] !== entry) return;
    S.image = null; imageLoading = false; imageError = null;
    Object.assign(S, { palette: [], semantic: [] });
    S.furthest = Math.min(S.furthest, 1);
  }

  async function refreshSlot(i) {
    const entry = S.grid[i];
    if (!entry || entry.locked || entry.busy || refreshingAll || entry.kind !== 'channel') return;
    const gen = gridGen;
    entry.busy = true;
    if (S.step === 1) render();
    try {
      const exclude = new Set(S.grid.map(e => e.block.id));
      const [block] = await fetchChannelImages(client, entry.source.slug, 1, { meta: entry.source.meta, exclude });
      if (gen !== gridGen) return;
      dropSelectionIf(entry);
      entry.block = block;
    } catch (err) {
      if (gen !== gridGen) return;
      ATK.Toast.show({ message: `Couldn’t refresh that image: ${err.message}`, variant: 'warning', duration: 6000 });
    } finally {
      if (gen === gridGen) { entry.busy = false; if (S.step === 1) render(); }
    }
  }

  // New images for every unlocked channel slot, one source at a time. Locked slots and pasted blocks stay as they are.
  async function refreshAll() {
    if (refreshingAll) return;
    const gen = gridGen;
    const sources = [...new Set(S.grid.filter(e => e.kind === 'channel' && !e.locked).map(e => e.source))];
    if (!sources.length) return;
    refreshingAll = true;
    const exclude = new Set(S.grid.map(e => e.block.id));
    const errors = [];
    for (const src of sources) {
      const slots = S.grid.filter(e => e.kind === 'channel' && !e.locked && e.source === src);
      slots.forEach(e => { e.busy = true; });
      if (S.step === 1) render();
      try {
        const blocks = await fetchChannelImages(client, src.slug, slots.length, { meta: src.meta, exclude });
        if (gen !== gridGen) return;
        blocks.forEach((block, n) => { dropSelectionIf(slots[n]); slots[n].block = block; exclude.add(block.id); });
      } catch (err) {
        if (gen !== gridGen) return;
        errors.push(err.message);
        if (err.status === 429) { slots.forEach(e => { e.busy = false; }); break; }   // still rate limited: stop, don't hammer
      }
      slots.forEach(e => { e.busy = false; });
    }
    if (gen !== gridGen) return;
    refreshingAll = false;
    S.grid.forEach(e => { e.busy = false; });
    if (errors.length) ATK.Toast.show({ message: `Some images couldn’t be refreshed: ${errors[0]}`, variant: 'warning', duration: 6000 });
    if (S.step === 1) render();
  }

  const longDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  // A link that opens in a new tab, only ever to an http(s) address.
  function extLink(href, text, label) {
    const url = safeUrl(href);
    if (!url) return h('span', null, text);
    const a = ATK.Link({ href: url, children: text });
    a.target = '_blank';
    a.rel = 'noopener';
    if (label) a.setAttribute('aria-label', label);
    return a;
  }

  function creditRow(label, ...kids) {
    return h('div', { className: 'credit-row' }, [h('span', { className: 'muted' }, label), ...kids]);
  }

  // Title, description, source, who saved it, and the are.na link: what to credit if the palette is shared.
  function creditBlock(b) {
    const date = longDate(b.createdAt);
    const rows = [];
    if (b.title) rows.push(h('strong', null, b.title));
    if (b.description.trim()) rows.push(h('details', { className: 'credit-description' }, [h('summary', null, 'Description'), h('p', null, b.description)]));
    if (b.sourceUrl && b.sourceTitle) rows.push(creditRow('source', extLink(b.sourceUrl, b.sourceTitle), date ? h('span', { className: 'muted' }, `accessed ${date}`) : null));
    else if (date) rows.push(creditRow('accessed', h('span', null, date)));
    if (b.userName && b.userSlug) rows.push(creditRow('via', extLink(`https://www.are.na/${encodeURIComponent(b.userSlug)}`, b.userName, `View ${b.userName}’s are.na profile (opens in new tab)`)));
    rows.push(creditRow('', extLink(b.blockUrl, 'view on are.na ↗', `View ${b.title || 'this image'} on are.na (opens in new tab)`)));
    return h('div', { className: 'credit' }, rows.filter(Boolean));
  }

  function stepPick() {
    // Start the load after this render finishes, so loadGrid's own renders don't nest inside it.
    if (!S.grid.length && !gridLoading && !gridError) { gridLoading = true; queueMicrotask(loadGrid); }

    const tiles = S.grid.map((entry, i) => {
      const b = entry.block;
      const selected = S.image?.index === i;
      // Pasted blocks are fixed. Channel images can be locked (kept through Refresh all) or swapped for another.
      const actions = entry.kind === 'channel' ? [
        { label: 'Refresh', disabled: entry.locked || entry.busy || refreshingAll, onClick: () => refreshSlot(i) },
        { label: entry.locked ? 'Unlock' : 'Lock', disabled: entry.busy, onClick: () => { entry.locked = !entry.locked; render(); } },
      ] : null;
      const cell = ATK.Block({ variant: 'image', src: safeUrl(b.url), alt: '', label: entry.locked ? 'Locked' : null, actions });
      // A transparent button over the image does the choosing, so Refresh and Lock can sit on top of it.
      const select = h('button', {
        type: 'button',
        className: 'pick-select',
        'aria-pressed': String(selected),
        'aria-label': `Use ${b.title || 'this image'}${b.channel ? ` from ${b.channel}` : ''}`,
        disabled: entry.busy,
        onclick: () => selectImage(i),
      });
      cell.querySelector('img').after(select);
      if (selected) cell.classList.add('is-selected');
      if (entry.busy) cell.classList.add('is-busy');
      return cell;
    });

    const unlocked = S.grid.filter(e => e.kind === 'channel' && !e.locked).length;
    const locked = S.grid.filter(e => e.locked && e.kind === 'channel').length;
    const refreshRow = S.grid.some(e => e.kind === 'channel') && !gridLoading ? h('div', { className: 'pick-tools' }, [
      ATK.Button({ variant: 'secondary', children: refreshingAll ? 'Refreshing…' : 'Refresh all', disabled: refreshingAll || !unlocked, onClick: refreshAll }),
      h('span', { className: 'muted' }, locked ? `${locked} locked image${locked === 1 ? '' : 's'} will stay.` : 'Hover an image to refresh or lock it.'),
    ]) : null;

    const chosen = S.image && !imageLoading && !imageError && S.image.img ? S.image : null;
    return [
      h('h2', null, 'Pick image'),
      h('p', { className: 'muted' }, 'Choose the image to take colours from.'),
      gridError ? ATK.StatusMessage({ tone: 'error', label: 'No images', children: gridError }) : null,
      gridError ? ATK.Button({ variant: 'secondary', children: 'Try again', onClick: () => { gridError = null; render(); } }) : null,
      gridLoading ? ATK.StatusMessage({ tone: 'info', children: S.grid.length ? `Fetching images… ${S.grid.length} so far` : 'Fetching images…' }) : null,
      refreshRow,
      tiles.length ? h('div', { className: 'pick-grid', role: 'group', 'aria-label': 'Images to choose from' }, tiles) : null,
      imageLoading ? ATK.StatusMessage({ tone: 'info', children: 'Loading image…' }) : null,
      imageError ? ATK.StatusMessage({ tone: 'error', label: 'Image', children: imageError }) : null,
      chosen ? h('figure', { className: 'pick-chosen' }, [
        h('img', { src: safeUrl(chosen.img.src), alt: chosen.block.title || 'Selected image', crossOrigin: 'anonymous' }),
        h('figcaption', null, creditBlock(chosen.block)),
      ]) : null,
      nav({ back: true, next: { label: 'Continue →', disabled: !chosen, onClick: advance } }),
    ].filter(Boolean);
  }

  /* ── Step 3: Base palette ─────────────────────────────────── */
  let resultsEl = null;          // the palette panel, redrawn without touching the settings controls
  let continueBtn = null;        // Continue on this step: enabled once there are colours
  let extractError = null;
  let extractTimer = null;
  let nameGen = 0;
  let fieldCount = 0;

  const copyHex = (text, message = `Copied ${text}`) => (navigator.clipboard?.writeText(text) || Promise.reject()).then(
    () => ATK.Toast.show({ message, variant: 'success', duration: 1500 }),
    () => ATK.Toast.show({ message: 'Couldn’t copy. Your browser may have blocked it.', variant: 'warning' }),
  );

  function runExtraction() {
    const img = S.image?.img;
    if (!img) return;
    extractError = null;
    try {
      const data = extractPalette(img, S.extract);
      const semantic = swatchProportions(extractSwatches(img), data);
      S.palette = data.map(d => ({ hex: rgbToHex(d.rgb), name: undefined, proportion: d.proportion, locked: false, source: 'extracted' }));
      S.semantic = semantic.map(({ role, hex, proportion }) => ({ role, hex, name: undefined, proportion }));
    } catch (err) {
      console.error('arena-palette: extraction failed', err);
      S.palette = []; S.semantic = [];
      extractError = 'Couldn’t read the colours from that image. Its host may not allow it; try another image.';
    }
    renderResults();
    if (S.palette.length) loadNames();
  }

  // Names for the base and semantic colours in one request. Late answers for an old palette are dropped.
  async function loadNames() {
    const gen = ++nameGen;
    const all = [...S.palette, ...S.semantic];
    const names = await fetchColorNames([...new Set(all.map(c => c.hex))], S.extract.nameVocabulary);
    if (gen !== nameGen) return;
    all.forEach(c => { c.name = nameFor(names, c.hex); });
    renderResults();
  }

  // Settings that change the colours re-extract (sliders wait a moment); the vocabulary only renames.
  function settingChanged({ renames = false, debounce = false } = {}) {
    persist();
    clearTimeout(extractTimer);
    if (renames) {
      [...S.palette, ...S.semantic].forEach(c => { c.name = undefined; });
      renderResults();
      loadNames();
    } else if (debounce) extractTimer = setTimeout(runExtraction, 400);
    else runExtraction();
  }

  function rangeField({ label, min, max, step, value, format, onInput }) {
    const id = `field-${++fieldCount}`;
    const out = h('span', { className: 'muted' }, format(value));
    const input = h('input', { type: 'range', id, min, max, step, value, className: 'range', 'aria-label': label });
    input.addEventListener('input', () => { out.textContent = format(+input.value); onInput(+input.value); });
    return h('div', { className: 'field' }, [h('label', { for: id }, [label + ': ', out]), input]);
  }

  function selectField(label, options, value, onChange) {
    const id = `field-${++fieldCount}`;
    const select = ATK.Select({ options, value, onChange: (e) => onChange(e.target.value) });
    select.querySelector('button')?.setAttribute('id', id);
    return h('div', { className: 'field' }, [h('label', { for: id }, label), select]);
  }

  function swatchCard(c, subtitle) {
    return h('button', {
      type: 'button',
      className: 'swatch-card',
      'aria-label': `Copy ${c.name ? c.name + ' ' : ''}${c.hex} to clipboard`,
      onclick: () => copyHex(c.hex),
    }, [
      h('span', { className: 'swatch-card__chip', style: { background: c.hex }, 'aria-hidden': 'true' }),
      h('span', { className: 'swatch-card__name' }, c.name === undefined ? h('span', { title: 'Looking up the colour name' }, '…') : c.name),
      h('span', { className: 'swatch-card__meta muted' }, subtitle),
    ]);
  }

  function proportionBar() {
    const items = applyFloor(S.palette.map(c => ({ hex: c.hex, proportion: c.proportion })), 0.01);
    return h('div', { className: 'prop-bar', role: 'img', 'aria-label': `Share of the image each colour covers: ${S.palette.map(c => `${c.hex} ${Math.round(c.proportion * 100)}%`).join(', ')}` },
      items.map(it => h('span', { style: { flex: String(it.proportion), background: it.hex }, title: `${it.hex} · ${Math.round(it.proportion * 100)}%` })));
  }

  function renderResults() {
    if (!resultsEl || !resultsEl.isConnected) return;
    if (continueBtn) continueBtn.disabled = !S.palette.length;
    if (extractError) return resultsEl.replaceChildren(ATK.StatusMessage({ tone: 'error', label: 'Extraction', children: extractError }));
    if (!S.palette.length) {
      return resultsEl.replaceChildren(ATK.StatusMessage({ tone: 'info', children: 'Extracting colours…' }));
    }
    resultsEl.replaceChildren(
      proportionBar(),
      h('div', { className: 'swatch-grid' }, S.palette.map(c => swatchCard(c, `${c.hex} · ${Math.round(c.proportion * 100)}%`))),
      S.semantic.length ? h('h2', null, 'Semantic palette') : null,
      S.semantic.length ? h('p', { className: 'muted' }, 'Six roles picked from the same image. Read-only here; you can include them when you export.') : null,
      S.semantic.length ? h('div', { className: 'swatch-grid' }, S.semantic.map(c => swatchCard(c, `${c.role} · ${c.hex}`))) : null,
    );
  }

  function stepBase() {
    const e = S.extract;
    const chosen = S.image;
    resultsEl = h('div', { className: 'stack stack--loose', 'aria-live': 'polite' });

    const settings = h('details', { className: 'settings', open: true }, [
      h('summary', null, 'Extraction settings'),
      h('div', { className: 'stack' }, [
        rangeField({ label: 'Colours', min: 4, max: 12, step: 1, value: e.count, format: String, onInput: (v) => { e.count = v; settingChanged({ debounce: true }); } }),
        selectField('Quality', [{ value: 'hi', label: 'High (slow)' }, { value: 'med', label: 'Medium' }, { value: 'lo', label: 'Low (fast)' }], e.quality, (v) => { e.quality = v; settingChanged(); }),
        selectField('Colour space', [{ value: 'oklch', label: 'OKLCH (perceptual)' }, { value: 'rgb', label: 'RGB' }], e.colorSpace, (v) => { e.colorSpace = v; settingChanged(); }),
        rangeField({ label: 'Minimum saturation', min: 0, max: 0.5, step: 0.05, value: e.minSaturation, format: (v) => v.toFixed(2), onInput: (v) => { e.minSaturation = v; settingChanged({ debounce: true }); } }),
        ATK.Checkbox({ label: 'Ignore white and near-white pixels', checked: e.ignoreWhite, onChange: (checked) => { e.ignoreWhite = checked; settingChanged(); } }),
        selectField('Colour name vocabulary', Object.entries(NAME_LISTS).map(([value, label]) => ({ value, label })), e.nameVocabulary, (v) => { e.nameVocabulary = v; settingChanged({ renames: true }); }),
        ATK.Button({ variant: 'secondary', children: 'Extract again', onClick: () => settingChanged() }),
      ]),
    ]);

    const left = h('div', { className: 'stack stack--loose' }, [
      chosen?.img ? h('img', { className: 'base-image', src: safeUrl(chosen.img.src), alt: chosen.block.title || 'Selected image' }) : null,
      settings,
    ]);

    const navRow = nav({ back: true, next: { label: 'Continue →', disabled: !S.palette.length, onClick: advance } });
    continueBtn = navRow.lastElementChild;

    if (S.palette.length) {
      renderResults();
      if ([...S.palette, ...S.semantic].some(c => c.name === undefined)) loadNames();
    } else {
      renderResults();                          // shows "Extracting colours…" first
      extractTimer = setTimeout(runExtraction, 30);
    }

    return [
      h('h2', null, 'Base palette'),
      h('p', { className: 'muted' }, 'The colours taken from the image, with their names. Click a colour to copy its hex.'),
      h('div', { className: 'base-layout' }, [left, resultsEl]),
      navRow,
    ];
  }

  /* ── Step 6: Export ───────────────────────────────────────── */
  // Text, swatch-file and PNG exports, as in v1. Base only / Base + ramps, the PNG preview and the colour-search
  // links come with the Ramps step (Phase 3–4); for now tints and shades are always included, as in v1.
  const exportCtx = () => buildExportContext({ image: S.image.block, palette: S.palette, semantic: S.export.semantic ? S.semantic : [] });
  const pngState = () => ({ image: S.image.block, imageEl: S.image.img, palette: S.palette, semantic: S.export.semantic ? S.semantic : [] });

  async function runExport(label, fn) {
    try {
      await fn();
    } catch (err) {
      console.error(`arena-palette: ${label} export failed`, err);
      ATK.Toast.show({ message: `Couldn’t make the ${label} file. ${err.message || ''}`.trim(), variant: 'error', duration: 8000 });
    }
  }

  function exportGroup(title, note, buttons) {
    return h('div', { className: 'export-group' }, [
      h('h3', null, title),
      note ? h('p', { className: 'muted' }, note) : null,
      h('div', { className: 'export-buttons' }, buttons.map(([label, fn]) =>
        ATK.Button({ variant: 'secondary', children: label, onClick: () => runExport(label, fn) }))),
    ]);
  }

  function stepExport() {
    const hasPalette = S.palette.length > 0 && S.image;
    if (!hasPalette) {
      return [h('h2', null, 'Export'), ATK.StatusMessage({ tone: 'info', children: 'Extract a palette first.' }), nav({ back: true })];
    }
    return [
      h('h2', null, 'Export'),
      h('p', { className: 'muted' }, 'Download the palette in the format you need. Files are named after the channel and block.'),
      ATK.Checkbox({
        label: 'Include the semantic palette',
        description: 'Adds the six semantic colours to every file below, including the PNGs.',
        checked: S.export.semantic,
        onChange: (checked) => { S.export.semantic = checked; },
      }),
      exportGroup('Text', 'Each file lists the colours, then their tints and shades.', [
        ['Hex', () => exportHex(exportCtx())],
        ['RGB', () => exportRgb(exportCtx())],
        ['HSL', () => exportHsl(exportCtx())],
        ['CSS variables', () => exportCss(exportCtx())],
      ]),
      exportGroup('Palette files', 'For Adobe apps, GIMP and Inkscape, Procreate, and Simple Colour Palette (a JSON file).', [
        ['Adobe .ase', () => exportAse(exportCtx())],
        ['GIMP .gpl', () => exportGpl(exportCtx())],
        ['Procreate .palette', () => exportProcreatePalette(exportCtx())],
        ['Simple Colour Palette (JSON)', () => exportScp(exportCtx())],
      ]),
      exportGroup('PNG', 'A reference card, or a grid of dots.', [
        ['Bars', () => exportPngBars(pngState())],
        ['Dots', () => exportPngDots(pngState(), false)],
        ['Dots with image background', () => exportPngDots(pngState(), true)],
      ]),
      h('div', { className: 'export-group' }, [
        h('h3', null, 'Copy'),
        h('div', { className: 'export-buttons' }, [
          ATK.Button({ variant: 'secondary', children: 'Copy all hex', onClick: () => copyHex(S.palette.map(c => c.hex).join('\n'), `Copied ${S.palette.length} hex values`) }),
        ]),
      ]),
      nav({ back: true }),
    ];
  }

  const NOTES = [
    '',
    '',
    '',
    'Coming in a later phase: edit, add, remove, reorder and lock colours.',
    'Coming in a later phase: tints and shades for each colour.',
    '',
  ];

  function render() {
    renderRail();
    els.pane.replaceChildren(...(S.step === 0 ? stepSource() : S.step === 1 ? stepPick() : S.step === 2 ? stepBase() : S.step === 5 ? stepExport() : stepPlaceholder(S.step, NOTES[S.step])));
  }

  /* ── Header ───────────────────────────────────────────────── */
  function mountHeader() {
    const crumbs = h('nav', { className: 'crumbs', 'aria-label': 'Breadcrumb' },
      h('ol', null, [
        h('li', null, ATK.Link({ variant: 'muted', href: 'index.html', children: 'Are.na Tools' })),
        h('li', { 'aria-current': 'page' }, 'Are.na Palette'),
      ]));
    // Neutral is palette-only for now, so it is passed in rather than added to ThemeChooser's defaults (plan §5).
    els.header.append(crumbs, ATK.ThemeChooser({
      storageKey: STORE_V2_THEME_KEY,
      themes: [
        { id: 'light', label: 'Light' },
        { id: 'dusk', label: 'Dusk' },
        { id: 'dark', label: 'Dark' },
        { id: 'dawn', label: 'Dawn' },
        { id: 'neutral', label: 'Neutral' },
      ],
    }));
  }

  /* ── Start ────────────────────────────────────────────────── */
  // Saved sources, token and settings; the first run after v1 also brings v1's saved values across.
  const saved = loadPaletteStorage(localStorage);
  S.sources = saved.state.sources.map(input => emptySource(input));
  S.token = saved.state.token;
  S.rememberToken = saved.state.rememberToken;
  Object.assign(S.extract, saved.settings.extract);
  // Neutral is the default theme here. The first time, seed this tool's own theme key (v1's choice if there was one),
  // so the shared toolkit theme setting is left alone.
  try { if (localStorage.getItem(STORE_V2_THEME_KEY) == null) localStorage.setItem(STORE_V2_THEME_KEY, saved.theme || 'neutral'); } catch (e) {}

  mountHeader();
  render();
})();
