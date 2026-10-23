// Inline channel finder: a text box that opens your channels as a list right under it.
// Click in and the list opens; type to filter it; paste a slug or are.na URL and press Enter (or paste) to load that instead.
// Knows nothing about what the channel is for. Needs filterChannels from channel-picker.js and ArenaToolkit.Badge.

// A pasted URL (or are.na path) is a reference to load, not a search to run.
export function looksLikeChannelRef(text) {
  return /^https?:\/\//i.test(String(text || '').trim()) || /are\.na\//i.test(String(text || ''));
}

// Move the highlighted row by dir (+1 / -1), wrapping, skipping rows that cannot be chosen. -1 means none highlighted.
export function nextActive(current, enabled, dir) {
  const n = enabled.length;
  if (!n || !enabled.some(Boolean)) return -1;
  let i = current;
  for (let step = 0; step < n; step++) {
    i = i < 0 ? (dir > 0 ? 0 : n - 1) : (i + dir + n) % n;
    if (enabled[i]) return i;
  }
  return -1;
}

// channels: [{ id, slug, title, visibility, counts }]
// onPick(channel): a row was chosen. onSubmit(text): Enter or paste on something that is not a list match (a slug or URL).
// disabled(channel): returns a reason string to grey the row out and make it unselectable, or '' / null to allow it.
// onRefresh(): async, returns a fresh channels array. staleAfterMs: refresh quietly on focus when the list is older than this.
// Returns { element, input, setChannels(list), setValue(text), focus() }.
export function createChannelFinder({
  channels = [], label = 'Channel', placeholder = 'Find one of your channels, or paste a slug or URL',
  onPick, onSubmit = null, disabled = () => '', onRefresh = null, staleAfterMs = 5 * 60 * 1000,
} = {}) {
  const ATK = window.ArenaToolkit;
  const h = ATK._el;
  let list = channels;
  let loadedAt = Date.now();
  let open = false;
  let active = -1;
  let shown = []; // channels currently listed
  const uid = 'atk-finder-' + Math.random().toString(36).slice(2, 8);

  const input = ATK.Input({ placeholder, spellcheck: false, autocomplete: 'off' });
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-label', label);
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', uid);

  const rows = h('div', { className: 'atk-finder__rows', role: 'listbox', id: uid, 'aria-label': `${label} suggestions` });
  const status = h('p', { className: 'atk-finder__status', role: 'status' });
  const refreshBtn = onRefresh ? ATK.Button({ variant: 'ghost', size: 'sm', children: 'Refresh', onClick: () => refresh() }) : null;
  const foot = h('div', { className: 'atk-finder__foot' }, [status, refreshBtn].filter(Boolean));
  const panel = h('div', { className: 'atk-finder__panel', hidden: true }, [rows, foot]);
  const root = h('div', { className: 'atk-finder' }, [input, panel]);

  const count = (c) => c.counts?.contents ?? c.counts?.blocks ?? c.length ?? null;

  function render() {
    const ref = looksLikeChannelRef(input.value);
    shown = ref ? [] : filterChannels(list, input.value);
    const enabled = shown.map(c => !disabled(c));
    if (active >= shown.length || (active >= 0 && !enabled[active])) active = -1;
    if (ref) {
      rows.replaceChildren(h('p', { className: 'atk-finder__hint' }, 'Press Enter to load this channel.'));
    } else if (!shown.length) {
      rows.replaceChildren(h('p', { className: 'atk-finder__hint' }, input.value.trim() ? `No channel of yours matches “${input.value.trim()}”. Press Enter to try it as a slug.` : 'No channels to show.'));
    } else {
      rows.replaceChildren(...shown.map((c, i) => {
        const why = disabled(c);
        const n = count(c);
        const row = h('div', {
          className: 'atk-finder__row' + (i === active ? ' is-active' : '') + (why ? ' is-disabled' : ''),
          role: 'option', id: `${uid}-${i}`, 'aria-selected': i === active ? 'true' : 'false', 'aria-disabled': why ? 'true' : null,
        }, [
          h('span', { className: 'atk-finder__text' }, [
            h('span', { className: 'atk-finder__name' }, c.title || c.slug),
            h('span', { className: 'atk-finder__meta' }, why || `${n ?? '?'} block${n === 1 ? '' : 's'} · ${c.slug}`),
          ]),
          c.visibility && c.visibility !== 'public' ? ATK.Badge({ variant: c.visibility === 'private' ? 'private' : 'default', children: c.visibility }) : null,
        ].filter(Boolean));
        // mousedown, not click: the input's blur would close the list before a click lands.
        row.addEventListener('mousedown', (e) => { e.preventDefault(); if (!why) choose(c); });
        return row;
      }));
    }
    input.setAttribute('aria-activedescendant', active >= 0 ? `${uid}-${active}` : '');
    status.textContent = `${list.length} channel${list.length === 1 ? '' : 's'}`;
  }

  function show() {
    if (open) return;
    open = true;
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    render();
    if (onRefresh && Date.now() - loadedAt > staleAfterMs) refresh(true);
  }
  function hide() {
    open = false;
    panel.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
  }
  function choose(c) {
    input.value = c.slug;
    hide();
    onPick(c);
  }
  async function refresh(quiet = false) {
    if (!onRefresh) return;
    if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.textContent = 'Refreshing…'; }
    try {
      list = await onRefresh();
      loadedAt = Date.now();
      if (open) render();
      status.textContent = `${list.length} channel${list.length === 1 ? '' : 's'} loaded`;
    } catch (err) {
      if (!quiet) status.textContent = `Couldn't refresh: ${err?.message || err}`;
    }
    if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.textContent = 'Refresh'; }
  }

  input.addEventListener('focus', show);
  input.addEventListener('click', show);
  input.addEventListener('input', () => { active = -1; show(); render(); });
  input.addEventListener('paste', () => {
    // Read the pasted value after the browser has put it in the box.
    setTimeout(() => { if (looksLikeChannelRef(input.value) && onSubmit) { hide(); onSubmit(input.value); } }, 0);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      show();
      active = nextActive(active, shown.map(c => !disabled(c)), e.key === 'ArrowDown' ? 1 : -1);
      render();
      rows.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && shown[active]) choose(shown[active]);
      else if (input.value.trim() && onSubmit) { hide(); onSubmit(input.value); }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      hide();
    }
  });
  root.addEventListener('focusout', (e) => { if (!root.contains(e.relatedTarget)) hide(); });
  // The Refresh button is inside the root, so focus moving to it keeps the list open.

  return {
    element: root,
    input,
    setChannels(next) { list = next; loadedAt = Date.now(); if (open) render(); },
    setValue(text) { input.value = text || ''; },
    focus() { input.focus(); },
  };
}
