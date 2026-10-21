// Review view: one cluster at a time. DOM only; the rules live in review.js.
// items: orderClusters() output; decisions: { [clusterId]: decision }, filled in as the person works.
// Resolving writes to are.na through the callbacks below; with dryRun on (the default) it only shows what would happen.
//   onResolve({ item, decision, dryRun }) -> Promise<{ lines, notes, done, failed, undo }>
//   onUndo(undo) -> Promise<{ failed }>
//   getConnectionCount(blockId) -> Promise<number>: every channel the block is in, not just the scanned ones

// Only the card row runs on to the right-hand edge of the window; the rest of the pane keeps the content column.
// Negative right margin pulls the scroller out to the edge, matching padding keeps the last card clear of it.
function fitCardsToWindow(cards) {
  const fit = () => {
    if (!cards.isConnected) { window.removeEventListener('resize', fit); return; }
    cards.style.marginRight = cards.style.paddingRight = '';
    const spare = Math.max(0, document.documentElement.clientWidth - cards.getBoundingClientRect().right);
    cards.style.marginRight = `-${spare}px`;
    cards.style.paddingRight = `${spare}px`;
  };
  window.addEventListener('resize', fit);
  requestAnimationFrame(fit);
}

function createReviewView({ items, decisions, onFinish, onResolve, onUndo, getConnectionCount = null, myUserId = null }) {
  const ATK = window.ArenaToolkit;
  const h = (tag, attrs, kids) => ATK._el(tag, attrs, kids);

  let index = nextPending(items, decisions, -1, 1) ?? 0;
  const undoStack = [];
  let helpOpen = null;
  let dryRun = true;
  let busy = false;
  let report = null; // { dry, lines, notes, failed } for the group on screen

  const root = h('div', { className: 'review' });
  const live = h('p', { className: 'visually-hidden', role: 'status', 'aria-live': 'polite' });

  const decisionFor = (item) => decisions[item.cluster.id] || (decisions[item.cluster.id] = defaultDecision(item.cluster));
  const dateOf = (b) => (b.created_at ? new Date(b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const link = (href, children) => { const a = ATK.Link({ href, children }); a.target = '_blank'; a.rel = 'noopener'; return a; };
  const trim = (text, n) => (text.length > n ? `${text.slice(0, n).trimEnd()}…` : text);

  /* ── Cards ─────────────────────────────────────────────────── */
  function thumb(b) {
    const src = b.image?.medium?.src || b.image?.square?.src || b.embed?.thumbnail_url;
    if (src) return ATK.Block({ variant: 'image', src, alt: blockAlt(b) || blockTitle(b) });
    return ATK.Block({ variant: 'text', children: b.content?.plain || blockDescription(b) || blockTitle(b) });
  }

  function card(item, b, i, d) {
    const keeper = b.id === d.canonicalId;
    const places = item.cluster.places[b.id] || [];
    const chooser = ATK.Radio({
      label: keeper ? 'Keeping this one' : 'Keep this one', value: b.id, name: `keep-${item.cluster.id}`, checked: keeper,
      onChange: () => chooseKeeper(b.id),
    });
    let action = h('span', { className: 'muted' }, 'Other blocks merge into this one');
    if (!keeper) {
      action = ATK.Select({
        options: [{ value: 'merge', label: 'Merge connections' }, { value: 'leave', label: 'Leave alone' }],
        value: d.actions[b.id],
        onChange: (e) => { d.actions[b.id] = e.target.value; },
      });
      action.setAttribute('aria-label', `What to do with block ${b.id}`);
    }
    return h('div', { className: `review-card${keeper ? ' is-keeper' : ''}${isOwned(b, myUserId) === false ? ' is-foreign' : ''}` }, [
      h('div', { className: 'review-card__thumb' }, [thumb(b), h('span', { className: 'review-card__num', 'aria-hidden': 'true' }, String(i + 1))]),
      h('div', { className: 'review-card__title' }, blockTitle(b)),
      h('dl', { className: 'review-card__facts' }, [
        fact('Owner', ownerLine(b)),
        fact('Added', dateOf(b)),
        getConnectionCount ? fact('Connections', h('span', { 'data-connections': String(b.id) }, connectionText(b.id))) : null,
        fact('In', places.length ? h('span', { className: 'review-card__channels' }, places.map(p =>
          h('a', { href: `https://www.are.na/channel/${p.channelSlug}`, target: '_blank', rel: 'noopener' }, ATK.Badge({ children: p.channelTitle })))) : null),
        hasAlt(b) ? fact('Alt text', blockAlt(b) || h('span', { className: 'muted' }, 'None')) : null,
        fact('Source', sourceLine(b)),
      ].filter(Boolean)),
      descriptionEl(b),
      link(`https://www.are.na/block/${b.id}`, 'View on are.na'),
      chooser,
      action,
    ].filter(Boolean));
  }

  // Total connections come from are.na one block at a time, fetched when a group is shown and then remembered.
  const connectionCounts = new Map();
  const connectionText = (id) => (connectionCounts.has(id) ? connectionCounts.get(id) : '…');
  function loadConnectionCounts(item) {
    if (!getConnectionCount) return;
    for (const b of item.cluster.blocks) {
      if (connectionCounts.has(b.id)) continue;
      connectionCounts.set(b.id, '…');
      getConnectionCount(b.id)
        .then((n) => `${n} in total`, () => '?')
        .then((text) => {
          connectionCounts.set(b.id, text);
          root.querySelectorAll(`[data-connections="${b.id}"]`).forEach(el => { el.textContent = text; });
        });
    }
  }

  const fact = (label, value) => (value ? h('div', { className: 'review-card__fact' }, [h('dt', null, label), h('dd', null, value)]) : null);

  function ownerLine(b) {
    if (!b.user) return null;
    const owned = isOwned(b, myUserId);
    if (owned === true) return `${ownerName(b)} (you)`;
    if (owned === false) return h('span', { className: 'review-card__owner' }, [ownerName(b), ' ', ATK.Badge({ children: 'Not yours' })]);
    return ownerName(b);
  }

  function sourceLine(b) {
    const url = b.source?.url;
    if (!url) return null;
    let host = url;
    try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { /* show the raw text */ }
    return link(url, b.source.title || host);
  }

  // Long descriptions are cut short, with a toggle to read the rest.
  const DESCRIPTION_LIMIT = 140;
  const expanded = new Set();
  function descriptionEl(b) {
    const text = (b.description?.plain ?? blockDescription(b)).trim();
    if (!text) return null;
    const long = text.length > DESCRIPTION_LIMIT;
    const body = h('div', { className: 'review-card__description' }, long && !expanded.has(b.id) ? trim(text, DESCRIPTION_LIMIT) : text);
    if (!long) return body;
    const toggle = h('button', { type: 'button', className: 'review-card__more', 'aria-expanded': String(expanded.has(b.id)) }, expanded.has(b.id) ? 'less' : 'more >');
    toggle.addEventListener('click', () => {
      if (expanded.has(b.id)) expanded.delete(b.id); else expanded.add(b.id);
      body.textContent = expanded.has(b.id) ? text : trim(text, DESCRIPTION_LIMIT);
      toggle.textContent = expanded.has(b.id) ? 'less' : 'more >';
      toggle.setAttribute('aria-expanded', String(expanded.has(b.id)));
    });
    return h('div', null, [body, toggle]);
  }

  /* ── Keeper's details ──────────────────────────────────────── */
  function field(item, d, name, label, control) {
    const copies = copyOptions(item.cluster, d, name).map(o => ATK.Button({
      variant: 'ghost', size: 'sm', children: `Copy from block ${o.blockId}`,
      onClick: () => { d.edits[name] = o.value; render(); },
    }));
    return h('div', { className: 'stack' }, [h('label', { className: 'field-label' }, label), control, copies.length ? h('div', { className: 'row' }, copies) : null].filter(Boolean));
  }

  function details(item, d) {
    const keeper = item.cluster.blocks.find(b => b.id === d.canonicalId);
    if (isOwned(keeper, myUserId) === false) {
      return h('div', { className: 'review-details' }, [
        h('h3', { className: 'review-subhead' }, `Details for the block you keep (${keeper.id})`),
        h('p', { className: 'muted' }, `This block belongs to ${ownerName(keeper)}, so its title and description can't be edited. Consider keeping one of your own blocks instead.`),
      ]);
    }
    const title = ATK.Input({ placeholder: 'Title' });
    title.value = d.edits.title;
    title.addEventListener('input', () => { d.edits.title = title.value; });
    const desc = ATK.Textarea({ rows: 3, placeholder: 'Description' });
    desc.value = d.edits.description;
    desc.addEventListener('input', () => { d.edits.description = desc.value; });
    const parts = [field(item, d, 'title', 'Title', title), field(item, d, 'description', 'Description', desc)];
    if (hasAlt(keeper)) {
      const alt = ATK.Input({ placeholder: 'Alt text' });
      alt.value = d.edits.alt_text;
      alt.addEventListener('input', () => { d.edits.alt_text = alt.value; });
      parts.push(field(item, d, 'alt_text', 'Alt text', alt));
    }
    return h('div', { className: 'review-details' }, [h('h3', { className: 'review-subhead' }, `Details for the block you keep (${keeper.id})`), ...parts]);
  }

  /* ── Frame ─────────────────────────────────────────────────── */
  function statusBadge(d) {
    if (d.status === 'resolved' && d.problems?.length) return ATK.Badge({ variant: 'alert', children: 'Resolved with problems' });
    if (d.status === 'resolved') return ATK.Badge({ variant: 'success', children: 'Resolved' });
    if (d.status === 'skipped') return ATK.Badge({ children: 'Skipped' });
    return null;
  }

  function render() {
    closeHelp();
    const t = tally(items, decisions);
    if (!items.length) { root.replaceChildren(h('p', null, 'No groups to review.')); return; }
    if (index >= items.length) index = items.length - 1;
    const item = items[index];
    const d = decisionFor(item);
    const blocks = item.cluster.blocks;

    const header = h('div', { className: 'review-head' }, [
      h('h2', null, `Group ${index + 1} of ${items.length} · ${blocks.length} blocks · ${item.label}`),
      statusBadge(d),
    ].filter(Boolean));
    const progress = h('p', { className: 'muted' }, `${t.resolved} resolved · ${t.skipped} skipped · ${t.pending} to go`);
    const dryToggle = ATK.Checkbox({
      label: 'Dry run', description: 'Show what Resolve would do, and change nothing in are.na.',
      checked: dryRun, disabled: busy, onChange: (on) => (on ? setDryRun(true) : confirmLive()),
    });
    const cards = h('div', { className: 'review-cards' }, blocks.map((b, i) => card(item, b, i, d)));
    fitCardsToWindow(cards);

    const finishNow = ATK.Button({ variant: t.pending ? 'secondary' : 'primary', children: t.pending ? 'Finish early →' : 'Finish →', disabled: !t.resolved, onClick: () => onFinish() });
    const pager = h('div', { className: 'row' }, [
      ATK.Button({ variant: 'ghost', children: '← Previous', disabled: index === 0, onClick: () => move(-1) }),
      ATK.Button({ variant: 'ghost', children: 'Next →', disabled: index === items.length - 1, onClick: () => move(1) }),
    ]);
    const liveNote = dryRun ? null : h('p', { className: 'atk-note', role: 'status' }, 'Dry run is off: Resolve group writes to are.na straight away.');
    const actions = h('div', { className: 'step-nav' }, [
      dryToggle,
      h('div', { className: 'row' }, [
        ATK.Button({ variant: 'ghost', children: 'Undo', disabled: busy || !undoStack.length, onClick: undo }),
        ATK.Button({ variant: 'secondary', children: 'Skip group', disabled: busy, onClick: () => decide('skipped') }),
        ATK.Button({ variant: 'primary', children: busy ? 'Working…' : dryRun ? 'Preview resolve' : 'Resolve group', disabled: busy, onClick: resolve }),
      ]),
    ]);

    root.replaceChildren(
      header, progress, pager, cards, details(item, d),
      liveNote, actions, reportEl(),
      h('div', { className: 'row' }, [finishNow, ATK.Button({ variant: 'ghost', size: 'sm', children: 'Keyboard shortcuts (?)', onClick: openHelp })]),
      live,
    );
    loadConnectionCounts(item);
  }

  /* ── Actions ───────────────────────────────────────────────── */
  function chooseKeeper(id) {
    const item = items[index];
    decisions[item.cluster.id] = chooseCanonical(item.cluster, decisionFor(item), id);
    render();
  }

  function move(delta) {
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    index = next;
    render();
  }

  function moveOn() {
    const next = nextPending(items, decisions, index, 1) ?? nextPending(items, decisions, index, -1);
    if (next !== null) index = next;
  }

  // Skip only records the choice. Resolve is below, because it writes.
  function decide(status) {
    if (busy) return;
    const item = items[index];
    const d = decisionFor(item);
    undoStack.push({ clusterId: item.cluster.id, previous: JSON.parse(JSON.stringify(d)), index, written: null });
    decisions[item.cluster.id] = { ...d, status };
    report = null;
    live.textContent = 'Group skipped.';
    moveOn();
    render();
  }

  async function resolve() {
    if (busy) return;
    const item = items[index];
    const d = decisionFor(item);
    busy = true;
    report = null;
    render();
    let out;
    try {
      out = await onResolve({ item, decision: d, dryRun });
    } catch (err) {
      out = { lines: [], notes: [], done: [], failed: [{ message: err?.message || String(err) }], undo: null };
    }
    busy = false;
    if (dryRun) {
      report = { dry: true, lines: out.lines, notes: out.notes, failed: [] };
      live.textContent = 'Preview ready.';
      render();
      return;
    }
    const failed = out.failed || [];
    undoStack.push({ clusterId: item.cluster.id, previous: JSON.parse(JSON.stringify(d)), index, written: out.undo });
    decisions[item.cluster.id] = { ...d, status: 'resolved', problems: failed.map(f => f.message) };
    report = { dry: false, lines: out.done, notes: out.notes, failed };
    live.textContent = failed.length ? 'Group resolved, with problems.' : 'Group resolved.';
    if (!failed.length) moveOn();
    render();
  }

  async function undo() {
    if (busy) return;
    const last = undoStack.pop();
    if (!last) return;
    busy = true;
    render();
    let failed = [];
    if (last.written) {
      try { failed = (await onUndo(last.written)).failed || []; } catch (err) { failed = [{ message: err?.message || String(err) }]; }
    }
    busy = false;
    decisions[last.clusterId] = last.previous;
    index = last.index;
    report = failed.length ? { dry: false, lines: [], notes: [], failed } : null;
    live.textContent = failed.length ? 'Undone, with problems.' : 'Undone.';
    render();
  }

  function setDryRun(on) {
    dryRun = on;
    report = null;
    render();
  }

  // Going live changes the account, so it takes a deliberate yes.
  function confirmLive() {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const close = () => { document.removeEventListener('keydown', onKey); modal.remove(); render(); };
    const ok = ATK.Button({ variant: 'primary', children: 'Switch off dry run', onClick: () => { document.removeEventListener('keydown', onKey); modal.remove(); setDryRun(false); } });
    const modal = ATK.Modal({
      title: 'Switch off dry run?',
      children: h('p', null, 'Resolve will then change your are.na account straight away: it adds the block you keep to the channels the others are in, removes the others from those channels, and marks them as duplicates. The blocks themselves are not deleted, and each group can be undone.'),
      footer: [ATK.Button({ variant: 'ghost', children: 'Keep dry run on', onClick: close }), ok],
      onClose: () => document.removeEventListener('keydown', onKey),
    });
    document.addEventListener('keydown', onKey);
    document.body.append(modal);
    ok.focus();
  }

  function reportEl() {
    if (!report) return null;
    const parts = [];
    if (report.dry) parts.push(h('h3', { className: 'review-subhead' }, 'Dry run: nothing was changed'));
    else parts.push(h('h3', { className: 'review-subhead' }, report.failed.length ? 'Done, with problems' : 'Done'));
    if (report.lines.length) parts.push(h('ul', null, report.lines.map(l => h('li', null, l))));
    if (report.failed.length) parts.push(h('ul', { role: 'alert', className: 'atk-note review-problems' }, report.failed.map(f => h('li', null, f.message))));
    if (report.notes?.length) parts.push(h('ul', { className: 'muted' }, report.notes.map(n => h('li', null, n))));
    if (report.dry) parts.push(h('p', { className: 'muted' }, 'Happy with that? Switch off Dry run above, then Resolve group.'));
    return h('div', { className: 'review-report' }, parts);
  }

  /* ── Keyboard ──────────────────────────────────────────────── */
  const SHORTCUTS = [
    ['j or →', 'Next group'], ['k or ←', 'Previous group'], ['1 – 9', 'Keep that block'],
    ['Enter', 'Resolve group (or preview, in a dry run)'], ['S', 'Skip group'], ['U', 'Undo'], ['?', 'This list'],
  ];

  function openHelp() {
    if (helpOpen) return;
    helpOpen = ATK.Modal({
      title: 'Keyboard shortcuts',
      children: h('dl', { className: 'review-keys' }, SHORTCUTS.flatMap(([k, what]) => [h('dt', null, ATK.KeyChip ? ATK.KeyChip({ children: k }) : k), h('dd', null, what)])),
      onClose: () => { helpOpen = null; },
    });
    document.body.append(helpOpen);
  }

  function closeHelp() {
    helpOpen?.remove();
    helpOpen = null;
  }

  function handleKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(tag) || e.target?.isContentEditable) return;
    if (e.key === 'Escape') { closeHelp(); return; }
    if (e.key === '?') { openHelp(); return; }
    if (helpOpen || busy) return;
    const k = e.key.toLowerCase();
    if (k === 'j' || e.key === 'ArrowRight') move(1);
    else if (k === 'k' || e.key === 'ArrowLeft') move(-1);
    else if (/^[1-9]$/.test(e.key)) { const b = items[index].cluster.blocks[Number(e.key) - 1]; if (b) chooseKeeper(b.id); }
    else if (e.key === 'Enter') resolve();
    else if (k === 's') decide('skipped');
    else if (k === 'u') undo();
    else return;
    e.preventDefault();
  }

  render();
  return { element: root, handleKey, destroy: closeHelp };
}
