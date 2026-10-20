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

function blockCount(c) {
  return c.counts?.contents ?? c.counts?.blocks ?? c.length ?? null;
}

// channels: [{ id, slug, title, visibility, counts }]; selected: [id]
// Returns { element, open(), close() }; the element is a Modal you append to document.body.
export function openChannelPicker({ channels, selected = [], title = 'Pick channels', confirmLabel = 'Use', onConfirm, onCancel = null }) {
  const ATK = window.ArenaToolkit;
  let chosen = [...selected];
  let query = '';

  const filter = ATK.Input({ type: 'search', placeholder: 'Filter by name or slug' });
  filter.setAttribute('aria-label', 'Filter channels');
  filter.addEventListener('input', () => { query = filter.value; renderList(); });

  const list = document.createElement('div');
  Object.assign(list.style, { display: 'flex', flexDirection: 'column', maxHeight: '50vh', overflowY: 'auto' });

  const confirm = ATK.Button({ variant: 'primary', children: confirmLabel, onClick: () => { done(); onConfirm(chosen); } });

  function updateConfirm() {
    confirm.textContent = `${confirmLabel} ${chosen.length} channel${chosen.length === 1 ? '' : 's'}`;
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

  function row(c) {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = chosen.includes(c.id);
    box.addEventListener('change', () => { chosen = toggleId(chosen, c.id); updateConfirm(); });

    const n = blockCount(c);
    const text = document.createElement('span');
    Object.assign(text.style, { flex: '1', minWidth: '0' });
    const name = document.createElement('span');
    name.textContent = c.title || c.slug;
    const meta = document.createElement('span');
    meta.textContent = `${n ?? '?'} block${n === 1 ? '' : 's'} · ${c.slug}`;
    Object.assign(meta.style, { display: 'block', color: 'var(--text-muted)', font: 'var(--text-body-sm)' });
    text.append(name, meta);

    const label = document.createElement('label');
    Object.assign(label.style, {
      display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer',
      padding: 'var(--space-2) var(--space-1)', borderBottom: '1px solid var(--border-card)',
    });
    label.append(box, text);
    if (c.visibility && c.visibility !== 'public') {
      label.append(ATK.Badge({ variant: c.visibility === 'private' ? 'private' : 'default', children: c.visibility }));
    }
    return label;
  }

  const clear = ATK.Button({ variant: 'ghost', children: 'Clear', onClick: () => { chosen = []; renderList(); } });
  const cancel = ATK.Button({ variant: 'secondary', children: 'Cancel', onClick: () => { done(); if (onCancel) onCancel(); } });

  const body = document.createElement('div');
  Object.assign(body.style, { display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' });
  body.append(filter, list);

  const footer = document.createElement('div');
  Object.assign(footer.style, { display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', width: '100%' });
  const right = document.createElement('div');
  Object.assign(right.style, { display: 'flex', gap: 'var(--space-2)' });
  right.append(cancel, confirm);
  footer.append(clear, right);

  const modal = ATK.Modal({ title, children: body, footer, onClose: () => { if (onCancel) onCancel(); } });
  function done() { modal.remove(); }

  renderList();
  document.body.append(modal);
  setTimeout(() => filter.focus(), 50);
  return { element: modal, close: done };
}
