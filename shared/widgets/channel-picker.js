// Multi-select channel picker, lifted from arena-merge's single-select dialog.
// Knows nothing about what the channels are for: give it channels and the ids already
// chosen, get the new ids back through onConfirm. Built from ArenaToolkit components.

// Case-insensitive match on title or slug. An empty query matches everything.
export function filterChannels(channels, query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return channels;
  return channels.filter(c => (c.title || '').toLowerCase().includes(q) || (c.slug || '').toLowerCase().includes(q));
}

// Returns a new array with id added or removed, keeping the order picked.
export function toggleId(ids, id) {
  return ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
}

// What a click on a row does: in multiple mode it toggles; in single mode it chooses just that one.
export function selectId(ids, id, multiple = true) {
  return multiple ? toggleId(ids, id) : [id];
}

function blockCount(c) {
  return c.counts?.contents ?? c.counts?.blocks ?? c.length ?? null;
}

// channels: [{ id, slug, title, visibility, counts }]; selected: [id]
// onRefresh (optional): async () => fresh channels array. Adds a Refresh button that reloads the list and keeps the ticks.
// disabledIds (optional): ids shown greyed out and unselectable.
// multiple (default true): false makes it a pick-one list (radio buttons, no Clear); onConfirm still gets an array, of one id.
// Returns { element, open(), close() }; the element is a Modal you append to document.body.
export function openChannelPicker({ channels, selected = [], title = 'Pick channels', confirmLabel = 'Use', multiple = true, disabledIds = [], onConfirm, onCancel = null, onRefresh = null }) {
  const ATK = window.ArenaToolkit;
  const disabledSet = new Set(disabledIds);
  let chosen = multiple ? [...selected] : selected.slice(0, 1);
  let query = '';

  const filter = ATK.Input({ type: 'search', placeholder: 'Filter by name or slug' });
  filter.setAttribute('aria-label', 'Filter channels');
  filter.addEventListener('input', () => { query = filter.value; renderList(); });

  const list = document.createElement('div');
  Object.assign(list.style, { display: 'flex', flexDirection: 'column', maxHeight: '50vh', overflowY: 'auto' });

  const confirm = ATK.Button({ variant: 'primary', children: confirmLabel, onClick: () => { done(); onConfirm(chosen); } });

  function updateConfirm() {
    confirm.textContent = multiple ? `${confirmLabel} ${chosen.length} channel${chosen.length === 1 ? '' : 's'}` : confirmLabel;
    confirm.disabled = chosen.length === 0;
  }

  function renderList() {
    const matches = filterChannels(channels, query);
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = query ? `No channels match "${query}".` : 'No channels to show.';
      list.replaceChildren(empty);
    } else {
      list.replaceChildren(...matches.map(row));
    }
    updateConfirm();
  }

  // Uses ArenaToolkit.Checkbox / Radio (shared/components), so the ticks match the rest of the toolkit.
  function row(c) {
    const n = blockCount(c);
    const common = {
      label: c.title || c.slug,
      description: `${n ?? '?'} block${n === 1 ? '' : 's'} · ${c.slug}`,
      checked: chosen.includes(c.id),
      disabled: disabledSet.has(c.id),
    };
    const control = multiple
      ? ATK.Checkbox({ ...common, onChange: () => { chosen = selectId(chosen, c.id, multiple); updateConfirm(); } })
      : ATK.Radio({ ...common, name: 'atk-channel-pick', value: c.id, onChange: () => { chosen = selectId(chosen, c.id, multiple); updateConfirm(); } });
    control.style.flex = '1';
    control.style.minWidth = '0';

    const line = document.createElement('div');
    Object.assign(line.style, {
      display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
      padding: 'var(--space-2) var(--space-1)', borderBottom: '1px solid var(--border-card)',
    });
    line.append(control);
    if (c.visibility && c.visibility !== 'public') {
      line.append(ATK.Badge({ variant: c.visibility === 'private' ? 'private' : 'default', children: c.visibility }));
    }
    return line;
  }

  const clear = ATK.Button({ variant: 'ghost', children: 'Clear', onClick: () => { chosen = []; renderList(); } });
  const cancel = ATK.Button({ variant: 'secondary', children: 'Cancel', onClick: () => { done(); if (onCancel) onCancel(); } });

  const status = document.createElement('p');
  status.className = 'muted';
  status.setAttribute('role', 'status');
  status.hidden = true;

  const refresh = onRefresh && ATK.Button({
    variant: 'secondary', children: 'Refresh list',
    onClick: async () => {
      refresh.disabled = true;
      refresh.textContent = 'Refreshing…';
      status.hidden = true;
      try {
        channels = await onRefresh();
        status.textContent = `${channels.length} channel${channels.length === 1 ? '' : 's'} loaded.`;
        renderList();
      } catch (err) {
        status.textContent = `Couldn't refresh the list: ${err?.message || err}`;
      }
      status.hidden = false;
      refresh.disabled = false;
      refresh.textContent = 'Refresh list';
    },
  });

  const top = document.createElement('div');
  Object.assign(top.style, { display: 'flex', gap: 'var(--space-2)', alignItems: 'center' });
  Object.assign(filter.style, { flex: '1', minWidth: '0' });
  top.append(...[filter, refresh].filter(Boolean));

  const body = document.createElement('div');
  Object.assign(body.style, { display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' });
  body.append(top, status, list);

  const footer = document.createElement('div');
  Object.assign(footer.style, { display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', width: '100%' });
  const right = document.createElement('div');
  Object.assign(right.style, { display: 'flex', gap: 'var(--space-2)' });
  right.append(cancel, confirm);
  footer.append(multiple ? clear : document.createElement('span'), right);

  const modal = ATK.Modal({ title, children: body, footer, onClose: () => { if (onCancel) onCancel(); } });
  function done() { modal.remove(); }

  renderList();
  document.body.append(modal);
  setTimeout(() => filter.focus(), 50);
  return { element: modal, close: done };
}
