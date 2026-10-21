// Metadata editor for one block: Edit toggle, property rows, Review, Save. DOM only;
// the rules (types, validation, patch, diff) live in metadata-edit.js.
// Plan: _claude/arena-palimpsest-v2-editing-and-tagging-plan.md §4.

let metaRowSeq = 0;

const META_TYPES = [
  { value: 'text', label: 'Text', icon: 'Aa' },
  { value: 'number', label: 'Number', icon: '#' },
  { value: 'checkbox', label: 'Checkbox', icon: '☑' },
  { value: 'list', label: 'List', icon: '≡' },
];
const metaTypeInfo = (type) => META_TYPES.find((t) => t.value === type) || META_TYPES[0];

// Keys other tools write. `lock` asks for a second click before editing or removing.
const META_TOOL_KEYS = [
  { prefix: 'dupe_', by: 'arena-duplicate-finder', lock: true },
  { prefix: 'goby__', by: 'goby.garden', lock: false },
];
const metaToolFor = (key) => META_TOOL_KEYS.find((t) => key.startsWith(t.prefix)) || null;

function metaRawFor(type, value) {
  if (type === 'list') return parseList(value);
  if (type === 'checkbox') return !!value;
  return value == null ? '' : String(value);
}

// How a value reads in the review panel and in warnings.
function metaShow(value) {
  if (value === null || value === undefined || value === '') return '(empty)';
  if (typeof value === 'string' && detectType(value) === 'list') return parseList(value).join(', ');
  return String(value);
}

function metaSaveError(err) {
  if (err?.status === 401) return "are.na didn't accept the token. Connect again, then save.";
  if (err?.status === 403) return "This token can't edit this block. It needs write access, and the block must be yours.";
  if (err?.status === 404) return 'are.na could not find this block any more.';
  if (err?.status === 422) return `are.na rejected the changes: ${err.message}`;
  if (err?.status === 429) return 'are.na is asking us to slow down. Nothing was lost; try Save again in a minute.';
  return describeConnectError(err);
}

// block: the block from are.na. renderView(metadata) -> node for the read-only list.
// requestWrite() -> Promise<{ ok, message? }> (opens Connect when the token cannot write).
// onSaved(block) is told about the saved block.
function createMetadataEditor({ block, client, renderView, requestWrite, onSaved }) {
  const ATK = window.ArenaToolkit;
  const h = (tag, attrs, kids) => ATK._el(tag, attrs, kids);

  let current = block;
  let mode = 'view'; // 'view' | 'edit' | 'review'
  let original = {};
  let rows = [];
  let patch = {};
  let stale = [];
  let notice = '';
  let saveError = '';
  let busy = '';
  let menu = null; // { row, node }
  let focusAfter = null;

  const root = h('div', { className: 'metadata' });
  const live = h('p', { className: 'visually-hidden', role: 'status', 'aria-live': 'polite' });

  /* ── Rows ──────────────────────────────────────────────────── */
  function makeRow(key, value, isNew) {
    const type = isNew ? 'text' : detectType(value);
    const tool = isNew ? null : metaToolFor(key);
    return {
      id: ++metaRowSeq, key, isNew, original: value, type, touched: false,
      unlocked: !(tool && tool.lock), raw: metaRawFor(type, value),
      notice: '', keyError: '', valueError: '',
    };
  }

  // A blank new row is ignored until the person types something.
  const isLive = (row) => !(row.isNew && !row.key && !row.touched);

  function evaluate(row) {
    if (!row.isNew && !row.touched) return { ok: true, value: row.original };
    return validateValue(row.type, row.raw);
  }

  // Sets each row's error text and returns the edited metadata plus any whole-block problems.
  function analyse() {
    const liveRows = rows.filter(isLive);
    const meta = {};
    for (const row of liveRows) {
      const others = liveRows.filter((r) => r !== row).map((r) => r.key).filter(Boolean);
      row.keyError = row.isNew ? validateKey(row.key, others) || '' : '';
      const out = evaluate(row);
      row.valueError = out.ok ? row.notice : out.message;
      if (!row.keyError && out.ok) meta[row.key] = out.value;
    }
    const limits = checkLimits(meta);
    const hasRowError = liveRows.some((r) => r.keyError || r.valueError);
    const changes = buildPatch(original, meta);
    return { meta, limits, hasRowError, changeCount: Object.keys(changes).length };
  }

  const isDirty = () => {
    if (mode === 'view') return false;
    const a = analyse();
    return a.changeCount > 0 || rows.some((r) => r.touched || (r.isNew && r.key));
  };

  /* ── Updating without rebuilding (keeps focus while typing) ── */
  function refresh() {
    const a = analyse();
    for (const row of rows) {
      if (row.keyErrEl) row.keyErrEl.textContent = row.keyError;
      if (row.valErrEl) row.valErrEl.textContent = row.valueError;
    }
    const first = a.limits.problems[0] || '';
    if (limitsEl) limitsEl.textContent = first;
    if (reviewBtn) reviewBtn.disabled = !(a.changeCount > 0 && !a.hasRowError && a.limits.ok);
    if (countEl) countEl.textContent = a.changeCount ? `${a.changeCount} change${a.changeCount === 1 ? '' : 's'}` : 'No changes yet';
  }
  let limitsEl = null;
  let reviewBtn = null;
  let countEl = null;

  /* ── Value controls ────────────────────────────────────────── */
  function touch(row) {
    row.touched = true;
    row.notice = '';
    refresh();
  }

  function listControl(row, id, disabled) {
    const wrap = h('div', { className: 'meta-chips' });
    const input = ATK.Input({ placeholder: 'Add a tag' });
    input.id = id;
    input.disabled = disabled;
    input.autocomplete = 'off';
    function draw() {
      wrap.replaceChildren(
        ...row.raw.map((tag, i) => h('span', { className: 'meta-chip' }, [
          tag,
          h('button', {
            type: 'button', className: 'meta-chip__x', disabled: disabled || null,
            'aria-label': `Remove tag ${tag}`,
            onClick: () => { row.raw = row.raw.filter((_, j) => j !== i); touch(row); draw(); input.focus(); },
          }, '×'),
        ])),
        input,
      );
    }
    function add() {
      const text = input.value.replace(/,+\s*$/, '').trim();
      if (!text) return;
      row.raw = [...row.raw, text];
      input.value = '';
      touch(row);
      draw();
      input.focus();
    }
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    });
    input.addEventListener('blur', add);
    draw();
    return wrap;
  }

  function valueControl(row, id, disabled) {
    const label = `Value of ${row.key || 'new property'}`;
    if (row.type === 'checkbox') {
      const box = h('input', { type: 'checkbox', id, className: 'meta-check', disabled: disabled || null });
      box.checked = !!row.raw;
      const word = h('span', null, row.raw ? 'On' : 'Off');
      box.addEventListener('change', () => { row.raw = box.checked; word.textContent = box.checked ? 'On' : 'Off'; touch(row); });
      return h('label', { className: 'meta-check-label', for: id }, [box, word]);
    }
    if (row.type === 'list') return listControl(row, id, disabled);
    const multiline = row.type === 'text' && (String(row.raw).includes('\n') || String(row.raw).length > 80);
    const control = multiline ? ATK.Textarea({ rows: 3 }) : ATK.Input({ type: row.type === 'number' ? 'number' : 'text' });
    if (row.type === 'number') control.step = 'any';
    control.value = row.raw;
    control.id = id;
    control.disabled = disabled;
    control.setAttribute('aria-label', label);
    control.addEventListener('input', () => { row.raw = control.value; touch(row); });
    return control;
  }

  /* ── Row menu: Type, Copy value, Remove ────────────────────── */
  function closeMenu(returnFocus) {
    if (!menu) return;
    const btn = menu.button;
    menu.node.remove();
    menu = null;
    if (returnFocus) btn?.focus();
  }

  function openMenuFor(row, wrap, button) {
    if (menu && menu.row === row) { closeMenu(true); return; }
    closeMenu();
    const locked = !row.unlocked;
    const items = [];
    if (!locked) {
      META_TYPES.forEach((t) => items.push({
        label: `Type: ${t.label}`, icon: t.value === row.type ? '✓' : '',
        onClick: () => { closeMenu(); changeType(row, t.value); },
      }));
      items.push({ separator: true });
    }
    items.push({ label: 'Copy value', onClick: () => { closeMenu(true); copyValue(row); } });
    if (locked) {
      items.push({ label: 'Unlock to edit or remove', onClick: () => { closeMenu(); row.unlocked = true; focusAfter = `meta-val-${row.id}`; render(); } });
    } else {
      items.push({ label: 'Remove', onClick: () => { closeMenu(); removeRow(row); } });
    }
    const node = h('div', { className: 'meta-menu' }, ATK.Menu({ items }));
    wrap.append(node);
    menu = { row, node, button };
    node.querySelector('button')?.focus();
  }

  async function copyValue(row) {
    const out = evaluate(row);
    try {
      await navigator.clipboard.writeText(metaShow(out.ok ? out.value : row.raw));
      live.textContent = `Copied the value of ${row.key}.`;
    } catch {
      live.textContent = "Couldn't copy the value.";
    }
  }

  function removeRow(row) {
    rows = rows.filter((r) => r !== row);
    live.textContent = `Removed ${row.key || 'new property'}, not saved yet.`;
    focusAfter = 'meta-add';
    render();
  }

  function changeType(row, to) {
    if (to === row.type) return;
    const now = evaluate(row);
    if (!now.ok) { row.notice = 'Fix the value before changing its type.'; refresh(); return; }
    // An empty value has nothing to adapt: just start the new type empty.
    const isEmpty = now.value === '' || now.value == null || (row.type === 'list' && !parseList(now.value).length);
    const out = isEmpty ? { ok: true, value: to === 'checkbox' ? false : '', lossy: false } : coerce(row.type, to, now.value);
    if (!out.ok) { row.notice = out.message; refresh(); return; }
    const apply = () => {
      row.type = to;
      row.raw = metaRawFor(to, out.value);
      row.touched = true;
      row.notice = '';
      focusAfter = `meta-val-${row.id}`;
      render();
    };
    if (!out.lossy) { apply(); return; }
    confirmChange(
      `Change ${row.key || 'this property'} to ${metaTypeInfo(to).label}?`,
      `Your ${metaTypeInfo(row.type).label.toLowerCase()} data is not compatible. It will be adapted to: ${metaShow(out.value)}`,
      apply,
    );
  }

  function confirmChange(title, message, onConfirm) {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const close = () => { document.removeEventListener('keydown', onKey); modal.remove(); };
    const ok = ATK.Button({ variant: 'primary', children: 'Change type', onClick: () => { close(); onConfirm(); } });
    const modal = ATK.Modal({
      title,
      children: h('p', null, message),
      footer: [ATK.Button({ variant: 'ghost', children: 'Cancel', onClick: close }), ok],
      onClose: () => document.removeEventListener('keydown', onKey),
    });
    document.addEventListener('keydown', onKey);
    document.body.append(modal);
    ok.focus();
  }

  /* ── Rendering ─────────────────────────────────────────────── */
  function rowEl(row) {
    const keyId = `meta-key-${row.id}`;
    const valId = `meta-val-${row.id}`;
    const tool = row.isNew ? null : metaToolFor(row.key);
    const locked = !row.unlocked;
    const t = metaTypeInfo(row.type);

    let keyNode;
    if (row.isNew) {
      keyNode = ATK.Input({ placeholder: 'name' });
      keyNode.id = keyId;
      keyNode.value = row.key;
      keyNode.maxLength = 60;
      keyNode.autocomplete = 'off';
      keyNode.spellcheck = false;
      keyNode.setAttribute('aria-label', 'Property name');
      keyNode.addEventListener('input', () => { row.key = keyNode.value; refresh(); });
    } else {
      keyNode = h('label', { className: 'meta-row__name', for: valId }, row.key);
    }
    row.keyErrEl = h('span', { className: 'meta-error', role: 'alert' });
    row.valErrEl = h('span', { className: 'meta-error', role: 'alert' });

    const typeTag = h('span', { className: 'meta-type' }, [h('span', { 'aria-hidden': 'true' }, t.icon), ` ${t.label}`]);
    const noteNodes = [];
    if (tool) {
      noteNodes.push(h('span', { className: 'meta-note' }, `Written by ${tool.by}`));
      if (locked) {
        noteNodes.push(ATK.Button({
          variant: 'ghost', size: 'sm', children: 'Edit anyway',
          onClick: () => { row.unlocked = true; focusAfter = valId; render(); },
        }));
      }
    }

    const menuWrap = h('div', { className: 'meta-menu-wrap' });
    const menuBtn = h('button', {
      type: 'button', className: 'meta-menu-btn', 'aria-haspopup': 'menu',
      'aria-label': `Options for ${row.key || 'new property'}`,
    }, '⋯');
    menuBtn.addEventListener('click', (e) => { e.stopPropagation(); openMenuFor(row, menuWrap, menuBtn); });
    menuWrap.append(menuBtn);

    return h('div', { className: 'meta-row' }, [
      h('div', { className: 'meta-row__key' }, [keyNode, typeTag, row.keyErrEl]),
      h('div', { className: 'meta-row__value' }, [valueControl(row, valId, locked), ...noteNodes, row.valErrEl]),
      menuWrap,
    ]);
  }

  function addRow() {
    const row = makeRow('', '', true);
    rows.push(row);
    focusAfter = `meta-key-${row.id}`;
    render();
  }

  function editBody() {
    limitsEl = h('p', { className: 'meta-error', role: 'alert' });
    countEl = h('span', { className: 'muted' });
    reviewBtn = ATK.Button({ variant: 'primary', children: 'Review changes', disabled: true, onClick: openReview });
    const addBtn = ATK.Button({ variant: 'ghost', size: 'sm', children: '+ Add property', onClick: addRow });
    addBtn.id = 'meta-add';
    const body = h('div', { className: 'meta-edit' }, [
      limitsEl,
      rows.length ? h('div', { className: 'meta-rows' }, rows.map(rowEl)) : h('p', { className: 'muted' }, 'No properties yet.'),
      h('div', null, addBtn),
      h('div', { className: 'meta-actions' }, [
        reviewBtn,
        ATK.Button({ variant: 'ghost', children: 'Cancel', onClick: cancel }),
        countEl,
      ]),
    ]);
    return body;
  }

  function reviewList(title, items, describe) {
    if (!items.length) return null;
    return h('div', { className: 'meta-review__group' }, [
      h('h4', { className: 'meta-review__title' }, `${title} (${items.length})`),
      h('ul', null, items.map((it) => h('li', null, describe(it)))),
    ]);
  }

  function reviewBody() {
    const d = diffMetadata(original, applyPatchTo(original, patch));
    const typeWord = (v) => metaTypeInfo(detectType(v)).label.toLowerCase();
    const body = [];
    if (stale.length) {
      body.push(h('p', { className: 'meta-warning', role: 'alert' },
        `${stale.join(', ')} changed on are.na since you started editing. Saving will overwrite ${stale.length === 1 ? 'it' : 'them'}.`));
    }
    body.push(
      reviewList('Added', d.added, (a) => [h('code', null, a.key), ` = ${metaShow(a.value)} `, h('span', { className: 'muted' }, `(${typeWord(a.value)})`)]),
      reviewList('Changed', d.changed, (c) => [h('code', null, c.key), `: ${metaShow(c.from)} → ${metaShow(c.to)} `,
        c.fromType !== c.toType ? h('span', { className: 'muted' }, `(${c.fromType} → ${c.toType})`) : null]),
      reviewList('Removed', d.removed, (r) => [h('code', null, r.key), ` (was ${metaShow(r.value)})`]),
      h('div', { className: 'meta-review__group' }, [
        h('h4', { className: 'meta-review__title' }, `Request body for PUT /v3/blocks/${current.id}`),
        h('pre', { className: 'meta-json', tabindex: '0' }, JSON.stringify({ metadata: patch }, null, 2)),
      ]),
    );
    if (saveError) body.push(h('p', { className: 'meta-warning', role: 'alert' }, saveError));
    body.push(h('div', { className: 'meta-actions' }, [
      ATK.Button({ variant: 'primary', children: busy === 'saving' ? 'Saving…' : 'Save', disabled: busy === 'saving', onClick: save }),
      ATK.Button({ variant: 'secondary', children: 'Back to editing', disabled: busy === 'saving', onClick: () => { saveError = ''; mode = 'edit'; render(); } }),
      ATK.Button({ variant: 'ghost', children: 'Cancel', disabled: busy === 'saving', onClick: cancel }),
    ]));
    return h('div', { className: 'meta-review' }, body);
  }

  // `original` with the patch applied: null removes a key.
  function applyPatchTo(base, p) {
    const out = { ...base };
    for (const [k, v] of Object.entries(p)) {
      if (v === null) delete out[k]; else out[k] = v;
    }
    return out;
  }

  function headerEl() {
    const count = Object.keys(current.metadata || {}).length;
    const head = [h('h3', { className: 'metadata__title' }, [
      'Metadata ', ATK.Badge({ children: String(count) }),
      mode !== 'view' ? ATK.Badge({ variant: 'focus', children: mode === 'review' ? 'Reviewing' : 'Editing' }) : null,
    ])];
    if (mode === 'view') {
      if (current.can && current.can.manage === false) {
        head.push(h('span', { className: 'muted', title: 'You can only edit blocks you own' }, 'Read-only'));
      } else {
        head.push(ATK.Button({ variant: 'secondary', size: 'sm', children: 'Edit', onClick: startEditing }));
      }
    }
    return h('div', { className: 'metadata__head' }, head);
  }

  function render() {
    closeMenu();
    limitsEl = reviewBtn = countEl = null;
    const body = mode === 'view' ? renderView(current.metadata)
      : mode === 'edit' ? editBody()
      : reviewBody();
    root.replaceChildren(...[
      headerEl(),
      notice ? h('p', { className: 'meta-warning', role: 'alert' }, notice) : null,
      body,
      live,
    ].filter(Boolean));
    if (mode === 'edit') refresh();
    if (focusAfter) {
      document.getElementById(focusAfter)?.focus();
      focusAfter = null;
    }
  }

  /* ── Flow ──────────────────────────────────────────────────── */
  const onDocClick = (e) => { if (menu && !menu.node.parentNode.contains(e.target)) closeMenu(); };
  const onDocKey = (e) => { if (e.key === 'Escape' && menu) closeMenu(true); };
  const onBeforeUnload = (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } };

  function listen(on) {
    const act = on ? 'addEventListener' : 'removeEventListener';
    document[act]('click', onDocClick);
    document[act]('keydown', onDocKey);
    window[act]('beforeunload', onBeforeUnload);
  }

  async function startEditing() {
    if (mode !== 'view') return;
    notice = '';
    const gate = await requestWrite();
    if (!gate.ok) {
      notice = gate.message || '';
      render();
      return;
    }
    original = { ...(current.metadata || {}) };
    rows = Object.entries(original).map(([k, v]) => makeRow(k, v, false));
    mode = 'edit';
    saveError = '';
    listen(true);
    render();
    live.textContent = 'Editing metadata.';
  }

  function leaveEditing() {
    mode = 'view';
    rows = [];
    patch = {};
    stale = [];
    saveError = '';
    busy = '';
    listen(false);
  }

  function cancel() {
    leaveEditing();
    focusAfter = null;
    render();
    live.textContent = 'Edits discarded.';
  }

  async function openReview() {
    const a = analyse();
    if (!(a.changeCount > 0 && !a.hasRowError && a.limits.ok)) return;
    patch = buildPatch(original, a.meta);
    stale = [];
    reviewBtn.disabled = true;
    reviewBtn.textContent = 'Checking…';
    try {
      const fresh = await client.getBlock(current.id);
      const now = fresh.metadata || {};
      stale = Object.keys(patch).filter((k) => !Object.is(now[k], original[k]));
    } catch {
      /* The check is a courtesy; the PUT is a merge either way. */
    }
    saveError = '';
    mode = 'review';
    render();
  }

  async function save() {
    if (busy) return;
    busy = 'saving';
    saveError = '';
    render();
    try {
      const res = await client.updateBlock(current.id, { metadata: patch });
      const saved = res && res.id != null ? res : await client.getBlock(current.id);
      current = { ...current, ...saved };
      leaveEditing();
      notice = '';
      render();
      live.textContent = 'Saved.';
      if (onSaved) onSaved(current);
    } catch (err) {
      busy = '';
      saveError = metaSaveError(err);
      render();
    }
  }

  render();
  return { element: root, startEditing, isDirty };
}
