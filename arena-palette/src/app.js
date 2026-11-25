// app.js: six-step wizard shell for arena-palette v2.0. Steps 1–3 and 6 are placeholders until they are ported
// from legacy-app.js (build plan, Phase 2); Edit and Ramps arrive in Phases 3–4.
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
    sources:  STORE_DEFAULT_SOURCES.map(input => ({ kind: 'channel', input, slug: null, id: null, meta: null })),
    token:    '',
    rememberToken: true,
    grid:     [],                       // [{ block, locked }] × 12
    image:    null,                     // { block, img, credit }
    extract:  { ...STORE_DEFAULT_EXTRACT },
    palette:  [],                       // [{ hex, name, locked, source }]
    semantic: [],                       // [{ role, hex, name }], read-only in v2.0
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

  /* ── Navigation ───────────────────────────────────────────── */
  // A step can be entered once the one before it has been completed.
  function canEnter(i) {
    return i <= S.furthest;
  }

  function go(i) {
    if (i < 0 || i >= STEPS.length || !canEnter(i)) return;
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

  const NOTES = [
    'Coming next: up to four channel or block inputs, and an optional read token.',
    'Coming next: a grid of 12 images to choose from.',
    'Coming next: extraction settings, the base palette and the semantic palette.',
    'Coming in a later phase: edit, add, remove, reorder and lock colours.',
    'Coming in a later phase: tints and shades for each colour.',
    'Coming next: export formats and a PNG preview.',
  ];

  function render() {
    renderRail();
    els.pane.replaceChildren(...stepPlaceholder(S.step, NOTES[S.step]));
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
      themes: [
        { id: 'light', label: 'Light' },
        { id: 'dusk', label: 'Dusk' },
        { id: 'dark', label: 'Dark' },
        { id: 'dawn', label: 'Dawn' },
        { id: 'neutral', label: 'Neutral' },
      ],
    }));
  }

  mountHeader();
  render();
})();
