// Are.na Merge: five-step wizard. Plain DOM, built from ArenaToolkit components.
(function () {
  const ATK = window.ArenaToolkit;
  const h = (tag, attrs, kids) => ATK._el(tag, attrs, kids);

  const throttle = createThrottle({
    writeGap: 600,
    onWait: (seconds) => notify(`are.na asked us to slow down. Waiting ${seconds}s, then carrying on.`),
  });
  const client = createArenaClient({ throttle });

  const STEPS = [
    { id: 'connect', label: 'Connect', description: 'Paste a token with write access.' },
    { id: 'source', label: 'Source', description: 'Pick the channel to copy from.' },
    { id: 'destination', label: 'Destination', description: 'Pick the channel to copy into.' },
    { id: 'options', label: 'Options', description: 'Choose how the merge runs.' },
    { id: 'transfer', label: 'Transfer', description: 'Check the summary, then run it.' },
  ];

  const state = {
    step: 0, furthest: 0, user: null, myChannels: [],
    source: null, dest: null, // { id, slug, title, status, user, contents }
    opts: { deleteFromSource: false, quietMode: false },
    status: { source: null, dest: null }, // { tone, text }
    typed: { source: '', dest: '' },
    run: null,
  };

  const els = {
    header: document.getElementById('header'),
    rail: document.getElementById('step-rail'),
    pane: document.getElementById('step-pane'),
  };

  // A short, polite notice in the live region at the top of the pane (rate limit waits).
  let noticeTimer = null;
  function notify(text) {
    const live = document.getElementById('notice');
    live.textContent = text;
    live.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { live.hidden = true; }, 6000);
  }

  async function loadChannels(user = state.user) {
    state.myChannels = (await client.getUserContents(user.id, { type: 'Channel' })).filter(c => c && c.state !== 'deleted');
    return state.myChannels;
  }

  /* ── Auth ─────────────────────────────────────────────────── */
  const auth = createAuthStep({
    client,
    requireWrite: true,
    panel: true,
    loadDetail: async (user) => {
      await loadChannels(user);
      const n = state.myChannels.length;
      return `${n} of your channel${n === 1 ? '' : 's'} loaded`;
    },
    onChange: (user) => {
      state.user = user;
      account.setUser(user);
      accountSlot.hidden = !user;
      if (!user) {
        Object.assign(state, { furthest: 0, step: 0, myChannels: [], source: null, dest: null, run: null, status: { source: null, dest: null }, typed: { source: '', dest: '' } });
      }
      render();
    },
  });

  /* ── Navigation ───────────────────────────────────────────── */
  const canEnter = (i) => i <= state.furthest;

  function go(i) {
    if (i < 0 || i >= STEPS.length || !canEnter(i)) return;
    state.step = i;
    render();
  }

  function advance() {
    state.furthest = Math.max(state.furthest, state.step + 1);
    go(state.step + 1);
  }

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

  function nav({ back = true, next = null, extra = [] } = {}) {
    const row = h('div', { className: 'step-nav' });
    const right = h('div', { className: 'step-nav__right' }, extra.concat(
      next ? [ATK.Button({ variant: next.variant || 'primary', children: next.label, disabled: next.disabled, onClick: next.onClick })] : []));
    row.append(back ? ATK.Button({ variant: 'ghost', children: '← Back', onClick: () => go(state.step - 1) }) : h('span'), right);
    return row;
  }

  /* ── Connect ──────────────────────────────────────────────── */
  function stepConnect() {
    return [
      h('h2', null, 'Connect to are.na'),
      auth.element,
      nav({ back: false, next: { label: 'Continue →', disabled: !state.user, onClick: advance } }),
    ];
  }

  /* ── Source and destination ───────────────────────────────── */
  const ROLES = {
    source: {
      key: 'source', index: 1, title: 'Source channel', field: 'Source channel',
      intro: [h('span', null, 'The channel you want to copy blocks '), h('strong', null, 'from'), h('span', null, '. Pick one of your channels, or paste a slug or full are.na URL.')],
      pickTitle: 'Pick the source channel',
    },
    dest: {
      key: 'dest', index: 2, title: 'Destination channel', field: 'Destination channel',
      intro: [h('span', null, 'The channel to add blocks '), h('strong', null, 'into'), h('span', null, '. You must own it or be a collaborator.')],
      pickTitle: 'Pick the destination channel',
    },
  };

  function setStatus(role, tone, text) {
    state.status[role] = text ? { tone, text } : null;
  }

  // Loads a channel and its contents, then stores it as the source or destination.
  async function loadChannel(role, rawInput) {
    state.typed[role] = rawInput;
    const slug = parseSlug(rawInput);
    if (!slug) { setStatus(role, 'error', 'Paste a slug or URL.'); return render(); }
    if (role === 'dest' && state.source && slug === state.source.slug) {
      setStatus(role, 'error', 'Source and destination are the same channel.');
      return render();
    }
    state[role] = null;
    state.run = null;
    state.furthest = Math.min(state.furthest, ROLES[role].index);
    setStatus(role, 'info', 'Fetching channel…');
    render();
    try {
      const ch = await client.getChannel(slug);
      setStatus(role, 'info', 'Fetching blocks…');
      render();
      const contents = await client.getChannelContents(slug);
      state[role] = { id: ch.id, slug: ch.slug, title: ch.title, status: ch.status, user: ch.user, contents, existingIds: new Set(contents.map(c => c.id)) };
      const n = contents.length;
      if (role === 'source') {
        setStatus(role, n ? 'success' : 'error', n ? `Found ${pluralBlocks(n)}.` : 'That channel has no blocks to copy.');
      } else {
        const mine = state.myChannels.some(c => c.id === ch.id);
        state.dest.writable = mine;
        setStatus(role, mine ? 'success' : 'info',
          mine ? `Found ${pluralBlocks(n)}. You can write to this channel.`
               : `“${ch.title}” isn't among your ${state.myChannels.length} channels. If you collaborate on it you can still continue; the merge will fail with a clear error if you don't have access.`);
      }
    } catch (err) {
      state[role] = null;
      setStatus(role, 'error', `Couldn't load: ${describeConnectError(err)}`);
    }
    render();
  }

  function channelCard(ch) {
    const thumbs = ch.contents.slice(0, 10).map(item => {
      const src = thumbSrc(item);
      return src
        ? h('div', { className: 'thumb' }, h('img', { src, alt: '', loading: 'lazy' }))
        : h('div', { className: 'thumb' }, thumbLabel(item));
    });
    return ATK.Card({
      children: [
        h('div', { className: 'card-title' }, ch.title),
        h('div', { className: 'card-meta' }, `by ${ch.user?.full_name || ch.user?.name || ch.user?.slug || 'unknown'} · ${pluralBlocks(ch.contents.length)}`),
        thumbs.length ? h('div', { className: 'thumbs' }, thumbs) : null,
      ].filter(Boolean),
    });
  }

  function stepChannel(role) {
    const r = ROLES[role];
    const otherKey = role === 'source' ? 'dest' : 'source';
    const finder = createChannelFinder({
      channels: state.myChannels,
      label: r.field,
      // Once one channel is chosen, the other box can't pick it again.
      disabled: (c) => state[otherKey] && c.id === state[otherKey].id
        ? `Already chosen as the ${role === 'source' ? 'destination' : 'source'}` : '',
      onRefresh: loadChannels,
      onPick: (c) => loadChannel(role, c.slug),
      onSubmit: (text) => loadChannel(role, text),
    });
    finder.setValue(state.typed[role] || (state[role] ? state[role].slug : ''));

    const st = state.status[role];
    const ch = state[role];
    const ready = role === 'source' ? !!ch && ch.contents.length > 0 : !!ch;
    return [
      h('h2', null, r.title),
      h('p', null, r.intro),
      h('div', { className: 'stack' }, [
        h('label', { className: 'field-label' }, r.field),
        finder.element,
      ]),
      st ? ATK.StatusMessage({ tone: st.tone, children: st.text }) : null,
      ch ? channelCard(ch) : null,
      nav({ next: { label: 'Continue →', disabled: !ready, onClick: advance } }),
    ].filter(Boolean);
  }

  /* ── Options ──────────────────────────────────────────────── */
  function stepOptions() {
    return [
      h('h2', null, 'Options'),
      h('p', null, 'Choose how the merge runs.'),
      h('div', { className: 'stack stack--loose' }, [
        ATK.Checkbox({
          label: 'Remove blocks from source after merging',
          description: 'Empties the source: every block ends up only in the destination, including blocks that were already there. The blocks themselves survive; only their connection to the source channel goes.',
          checked: state.opts.deleteFromSource,
          onChange: (v) => { state.opts.deleteFromSource = v; state.run = null; },
        }),
        ATK.Checkbox({
          label: 'Quiet mode: hide destination during transfer',
          description: "Temporarily sets the destination to private so followers aren't notified for each block, then restores its original status at the end. Skipped on dry runs and when the channel is already private.",
          checked: state.opts.quietMode,
          onChange: (v) => { state.opts.quietMode = v; state.run = null; },
        }),
      ]),
      nav({ next: { label: 'Continue →', onClick: advance } }),
    ];
  }

  /* ── Transfer ─────────────────────────────────────────────── */
  function newRun() {
    return {
      status: 'idle', dry: true, cancel: false,
      progress: ATK.Progress({ label: 'Preparing…' }),
      stats: ATK.StatGrid({ items: [
        { key: 'added', label: 'Added' }, { key: 'skipped', label: 'Already there' },
        { key: 'removed', label: 'Removed' }, { key: 'failed', label: 'Failed' },
      ] }),
      log: ATK.StatusLog({ label: 'Details' }),
      result: null,
    };
  }

  const LOG_TONES = { ok: 'success', info: 'message', warn: 'warning', err: 'error' };

  async function runTransfer(dryRun) {
    const run = state.run = newRun();
    run.status = 'running';
    run.dry = dryRun;
    render();
    const word = dryRun ? 'dry run' : 'merge';
    run.log.add('message', `Starting ${word}: ${pluralBlocks(state.source.contents.length)}.`);
    const phases = { status: 'Making the destination private…', copy: dryRun ? 'Dry run: merging…' : 'Merging…', restore: 'Restoring the destination…', done: 'Finished' };
    try {
      run.result = await runMerge({
        client, source: state.source, dest: state.dest,
        contents: state.source.contents, destIds: state.dest.existingIds,
        opts: state.opts, dryRun,
        hooks: {
          onPhase: (p) => run.progress.update({ label: phases[p] || p }),
          onProgress: (p) => run.progress.update(p),
          onLog: (tone, text) => run.log.add(LOG_TONES[tone] || 'message', text),
          onCount: (key, value) => run.stats.update({ [key]: value }),
          shouldCancel: () => run.cancel,
        },
      });
      run.status = 'done';
      run.progress.update({ label: dryRun ? 'Dry run complete' : 'Transfer complete', variant: run.result.failed ? 'alert' : 'success' });
    } catch (err) {
      run.status = 'error';
      run.error = describeConnectError(err);
      run.log.add('error', run.error);
      run.progress.update({ label: 'Stopped', variant: 'alert' });
    }
    if (state.run === run) render();
  }

  function confirmFullTransfer(returnFocus) {
    const toAdd = planMerge(state.source.contents, state.dest.existingIds).toAdd.length;
    const text = `This will add ${pluralBlocks(toAdd)} from “${state.source.title}” into “${state.dest.title}” on are.na`
      + (state.opts.deleteFromSource ? `, then remove them from “${state.source.title}”` : '')
      + '. The blocks themselves are not deleted.';
    const close = () => { document.removeEventListener('keydown', onKey); modal.remove(); returnFocus?.focus(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const ok = ATK.Button({ variant: 'primary', children: 'Run Full Merge', onClick: () => { document.removeEventListener('keydown', onKey); modal.remove(); runTransfer(false); } });
    const modal = ATK.Modal({
      title: 'Run Full Merge?',
      children: h('p', null, text),
      footer: [ATK.Button({ variant: 'ghost', children: 'Cancel', onClick: close }), ok],
      onClose: () => document.removeEventListener('keydown', onKey),
    });
    document.addEventListener('keydown', onKey);
    document.body.append(modal);
    ok.focus();
  }

  function summaryNode() {
    const { toAdd, skipped } = planMerge(state.source.contents, state.dest.existingIds);
    const s = (t) => h('strong', null, t);
    const lines = summaryLines({
      toAdd: toAdd.length, skipped, sourceTitle: state.source.title, destTitle: state.dest.title,
      deleteFromSource: state.opts.deleteFromSource, quietMode: state.opts.quietMode, destStatus: state.dest.status,
    });
    return h('div', { className: 'summary-box' }, lines.map(l => h('p', null,
      l.kind === 'add' ? ['Add ', s(String(l.toAdd)), ` block${l.toAdd === 1 ? '' : 's'} from `, s(l.sourceTitle), ' into ', s(l.destTitle), '.']
      : l.kind === 'skip' ? `${l.skipped} already there. Those will not be copied again${state.opts.deleteFromSource ? ', but will still be removed from the source' : ''}.`
      : l.kind === 'remove' ? ['Remove every block from ', s(l.sourceTitle), ' once it is in the destination.']
      : ['A full merge will set the destination to ', s('private'), ' while it runs and restore it to ', s(l.destStatus), ' at the end.'])));
  }

  function finishNode(run) {
    const r = run.result;
    if (!r) return null;
    const dest = `https://www.are.na/${state.user.slug}/${state.dest.slug}`;
    const src = `https://www.are.na/${state.source.user?.slug || state.user.slug}/${state.source.slug}`;
    if (run.dry) {
      return ATK.Card({ children: [
        h('div', { className: 'card-title' }, 'Dry run complete'),
        h('div', { className: 'card-meta' }, `${r.added} would be added, ${r.skipped} already there, ${r.failed} failed. Nothing on are.na has changed.`),
        h('p', { className: 'action-hint' }, ['If that looks right, choose ', h('strong', null, 'Run Full Merge'), '.']),
      ] });
    }
    return ATK.Card({ children: [
      h('div', { className: 'card-title' }, r.cancelled ? 'Transfer stopped' : 'Transfer complete'),
      h('div', { className: 'card-meta' }, `${r.added} added · ${r.skipped} already there · ${r.removed} removed · ${r.failed} failed`),
      h('div', { className: 'row row--wrap' }, [
        ATK.Button({ variant: 'secondary', children: `View ${state.dest.title} on are.na →`, onClick: () => window.open(dest, '_blank', 'noopener') }),
        ATK.Button({ variant: 'secondary', children: 'View source channel →', onClick: () => window.open(src, '_blank', 'noopener') }),
      ]),
    ] });
  }

  function stepTransfer() {
    const run = state.run;
    const running = run?.status === 'running';
    const fullDone = run?.status === 'done' && !run.dry;
    // Emphasis follows the next sensible move: Dry Run first, then Run Full Merge once a dry run has been seen.
    const dryDone = run?.status === 'done' && run.dry;
    let realBtn;
    const dryBtn = ATK.Button({ variant: dryDone || fullDone ? 'secondary' : 'primary', children: 'Dry Run', disabled: running, onClick: () => runTransfer(true) });
    realBtn = ATK.Button({ variant: dryDone ? 'primary' : 'secondary', children: 'Run Full Merge', disabled: running, onClick: () => confirmFullTransfer(realBtn) });
    const stopBtn = running ? ATK.Button({ variant: 'ghost', children: 'Stop', onClick: () => { run.cancel = true; } }) : null;

    return [
      h('h2', null, 'Review and transfer'),
      summaryNode(),
      h('div', { className: 'row row--wrap' }, [dryBtn, realBtn, stopBtn].filter(Boolean)),
      h('p', { className: 'action-hint' }, 'Dry Run shows what would happen and changes nothing on are.na. Run Full Merge writes to your account.'),
      h('details', { className: 'how' }, [
        h('summary', null, 'How the merge works'),
        h('ul', null, [
          'Blocks are matched by their are.na id. A block already in the destination is not copied again.',
          'With "Remove blocks from source", every block leaves the source, including ones that were already in the destination. Only the connection is removed; the block itself is never deleted.',
          'Blocks are handled one at a time: copy, then remove. If a run stops part-way, the blocks done so far stay done and the rest are untouched.',
          'A block that fails is reported and the run carries on. A failed copy is never removed from the source.',
          'Quiet mode sets the destination to private while a full merge runs, then restores it. A dry run never changes it.',
          'Blocks are not compared by URL or image yet, only by id.',
        ].map(t => h('li', null, t))),
      ]),
      run && run.status !== 'idle' ? h('div', { className: 'run' }, [run.progress, run.stats, finishNode(run), run.log].filter(Boolean)) : null,
      nav({ next: null }),
    ].filter(Boolean);
  }

  /* ── Render and header ────────────────────────────────────── */
  function render() {
    renderRail();
    const kids = [stepConnect, () => stepChannel('source'), () => stepChannel('dest'), stepOptions, stepTransfer][state.step]();
    els.pane.replaceChildren(...kids);
  }

  // Signed-in name and Disconnect, shown beside the theme chooser once connected.
  const account = ATK.AccountMenu({ onDisconnect: () => auth.disconnect() });
  const accountSlot = h('div', { className: 'account-slot', hidden: true }, account);

  function mountHeader() {
    const crumbs = h('nav', { className: 'crumbs', 'aria-label': 'Breadcrumb' },
      h('ol', null, [
        h('li', null, ATK.Link({ variant: 'muted', href: 'index.html', children: 'Are.na Tools' })),
        h('li', { 'aria-current': 'page' }, 'Are.na Merge'),
      ]));
    els.header.append(crumbs, h('div', { className: 'header-tools' }, [accountSlot, ATK.ThemeChooser()]));
  }

  mountHeader();
  render();
  auth.restore();
})();
