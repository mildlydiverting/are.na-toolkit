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

  const state = { step: 0, furthest: 0, user: null, myChannels: [], channelIds: [], setName: '' };

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
      if (!user) { state.furthest = 0; state.step = 0; state.myChannels = []; state.channelIds = []; state.setName = ''; }
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

  /* Scope: which channels to scan, optionally saved under a name. */
  function stepScope() {
    const NEW = '';
    const sets = loadSets(localStorage);
    const byId = new Map(state.myChannels.map(c => [c.id, c]));

    const select = ATK.Select({
      options: [{ value: NEW, label: '— New scan —' }, ...Object.keys(sets).map(n => ({ value: n, label: n }))],
      value: state.setName,
      onChange: (e) => {
        state.setName = e.target.value;
        // Saved ids can outlive their channels, so drop any that have gone.
        state.channelIds = state.setName ? pruneIds(sets[state.setName].channelIds, state.myChannels) : [];
        render();
      },
    });

    const pickBtn = ATK.Button({
      variant: 'secondary',
      children: state.channelIds.length ? 'Change channels' : 'Pick channels',
      onClick: () => {
        const offenders = pruneIds(loadOffenders(localStorage), state.myChannels);
        openChannelPicker({
          channels: state.myChannels,
          selected: state.channelIds.length ? state.channelIds : offenders,
          title: 'Pick channels to scan',
          confirmLabel: 'Scan',
          onConfirm: (ids) => { state.channelIds = ids; render(); },
        });
      },
    });

    const chosen = h('div', { className: 'chosen' }, state.channelIds.map(id => {
      const c = byId.get(id);
      const chip = h('span', { className: 'chosen__item' }, [
        ATK.Badge({ children: c ? (c.title || c.slug) : `#${id}` }),
        h('button', {
          type: 'button', className: 'chosen__remove', 'aria-label': `Remove ${c ? (c.title || c.slug) : id}`,
          onclick: () => { state.channelIds = state.channelIds.filter(x => x !== id); render(); },
        }, '×'),
      ]);
      return chip;
    }));
    if (!state.channelIds.length) chosen.append(h('p', { className: 'muted' }, 'No channels chosen yet.'));

    const nameInput = ATK.Input({ placeholder: 'Name this selection, to use it again' });
    nameInput.value = state.setName;
    const saveBtn = ATK.Button({
      variant: 'secondary', children: 'Save',
      disabled: !state.channelIds.length,
      onClick: () => {
        const name = saveSet(localStorage, nameInput.value, { channelIds: state.channelIds });
        if (name) { state.setName = name; render(); }
      },
    });

    return [
      h('h2', null, 'Choose channels to scan'),
      h('p', null, 'Pick the channels where you suspect duplicates. Blocks are compared across all of them.'),
      h('div', { className: 'stack' }, [
        h('label', { className: 'field-label' }, 'Saved selections'),
        select,
      ]),
      h('div', { className: 'stack' }, [
        h('label', { className: 'field-label' }, `Channels (${state.channelIds.length})`),
        chosen,
        h('div', null, pickBtn),
      ]),
      h('div', { className: 'stack' }, [
        h('label', { className: 'field-label' }, 'Save as'),
        h('div', { className: 'row' }, [nameInput, saveBtn]),
      ]),
      nav({ next: { label: 'Continue →', disabled: !state.channelIds.length, onClick: advance } }),
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
    const kids = state.step === 0 ? stepConnect() : state.step === 1 ? stepScope() : stepPlaceholder(state.step);
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
