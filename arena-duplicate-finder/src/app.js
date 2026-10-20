// Are.na Duplicate Finder: six-step wizard shell. Steps 2 to 6 are placeholders for now.
// Plain DOM, built from ArenaToolkit components. No framework.
(function () {
  const ATK = window.ArenaToolkit;
  const h = (tag, attrs, kids) => ATK._el(tag, attrs, kids);

  const throttle = createThrottle();
  const client = createArenaClient({ throttle });

  const STEPS = [
    { id: 'connect', label: 'Connect', description: 'Paste a token that can write to your account.' },
    { id: 'scope', label: 'Scope', description: 'Choose the channels to scan.' },
    { id: 'detect', label: 'Detect', description: 'Choose how duplicates are spotted.' },
    { id: 'scan', label: 'Scan', description: 'Read the channels and group the duplicates.' },
    { id: 'review', label: 'Review', description: 'Pick the block to keep in each group.' },
    { id: 'done', label: 'Done', description: 'See what changed.' },
  ];

  const state = { step: 0, furthest: 0, user: null, myChannels: [] };

  const els = {
    header: document.getElementById('header'),
    rail: document.getElementById('step-rail'),
    pane: document.getElementById('step-pane'),
  };

  /* ── Auth ─────────────────────────────────────────────────── */
  const auth = createAuthStep({
    client,
    requireWrite: true,
    panel: true,
    // Loaded at connect time, as arena-merge does, so the Scope step has its list ready.
    loadDetail: async (user) => {
      state.myChannels = (await client.getUserContents(user.id, { type: 'Channel' })).filter(c => c && c.state !== 'deleted');
      const n = state.myChannels.length;
      return `${n} of your channel${n === 1 ? '' : 's'} loaded`;
    },
    onChange: (user) => {
      state.user = user;
      if (!user) { state.furthest = 0; state.step = 0; state.myChannels = []; }
      render();
    },
  });

  /* ── Navigation ───────────────────────────────────────────── */
  // A step can be entered once the one before it has been completed.
  function canEnter(i) {
    return i <= state.furthest;
  }

  function go(i) {
    if (i < 0 || i >= STEPS.length || !canEnter(i)) return;
    state.step = i;
    render();
  }

  function advance() {
    state.furthest = Math.max(state.furthest, state.step + 1);
    go(state.step + 1);
  }

  /* ── Rail ─────────────────────────────────────────────────── */
  function renderRail() {
    const items = STEPS.map((s, i) => ({
      label: s.label,
      description: s.description,
      state: i === state.step ? 'current' : i < state.step ? 'done' : 'upcoming',
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
      back ? ATK.Button({ variant: 'ghost', children: '← Back', onClick: () => go(state.step - 1) }) : h('span'),
      next ? ATK.Button({ variant: 'primary', children: next.label, disabled: next.disabled, onClick: next.onClick }) : h('span'),
    );
    return row;
  }

  function stepConnect() {
    return [
      h('h2', null, 'Connect to are.na'),
      auth.element,
      nav({ back: false, next: { label: 'Continue →', disabled: !state.user, onClick: advance } }),
    ];
  }

  function stepPlaceholder(i) {
    return [
      h('h2', null, `${i + 1}. ${STEPS[i].label}`),
      h('p', { className: 'muted' }, 'Not built yet.'),
      nav({ next: i < STEPS.length - 1 ? { label: 'Continue →', onClick: advance } : null }),
    ];
  }

  function render() {
    renderRail();
    const kids = state.step === 0 ? stepConnect() : stepPlaceholder(state.step);
    els.pane.replaceChildren(...kids);
  }

  /* ── Header ───────────────────────────────────────────────── */
  function mountHeader() {
    const crumbs = h('nav', { className: 'crumbs', 'aria-label': 'Breadcrumb' },
      h('ol', null, [
        h('li', null, ATK.Link({ variant: 'muted', href: 'index.html', children: 'Are.na Tools' })),
        h('li', { 'aria-current': 'page' }, 'Are.na Duplicate Finder'),
      ]));
    els.header.append(crumbs, ATK.ThemeChooser());
  }

  mountHeader();
  render();
  auth.restore();
})();
