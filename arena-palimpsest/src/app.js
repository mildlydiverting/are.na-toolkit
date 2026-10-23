// Are.na Palimpsest: inspect a block's metadata, connections and channels; edit a block's own metadata.
// Plain DOM, built from ArenaToolkit components. No framework.
(function () {
  const ATK = window.ArenaToolkit;

  function h(tag, attrs, kids) {
    return ATK._el(tag, attrs, kids);
  }

  const throttle = createThrottle({ onWait: (s) => showWait(s) });
  const client = createArenaClient({ throttle });

  const els = {
    header: document.getElementById('header'),
    inputBar: document.getElementById('input-bar'),
    resultPane: document.getElementById('result-pane'),
  };

  /* ── Rate-limit feedback ─────────────────────────────────────── */
  let waitBanner = null;
  let waitTimer = null;
  function showWait(seconds) {
    if (!waitBanner) {
      waitBanner = h('p', { className: 'muted', role: 'status' });
      els.inputBar.append(waitBanner);
    }
    waitBanner.textContent = `Waiting ${seconds}s for are.na's rate limit…`;
    clearTimeout(waitTimer);
    waitTimer = setTimeout(() => { waitBanner?.remove(); waitBanner = null; }, seconds * 1000 + 500);
  }

  /* ── Header and Connect ──────────────────────────────────────── */
  let connectModal = null;
  const account = ATK.AccountMenu({ onConnect: () => openConnect(), onDisconnect: () => auth.disconnect() });

  // Set when Edit needs a write token: the Connect modal then asks for one, and once it is
  // connected the block is reloaded (so `can` is known) and put straight into edit mode.
  let pendingEditId = null;

  const auth = createAuthStep({
    client,
    onChange: (user) => {
      account.setUser(user);
      if (!user) return;
      closeConnect();
      if (pendingEditId != null) {
        const id = pendingEditId;
        pendingEditId = null;
        inspect(String(id), { autoEdit: true, skipDirtyCheck: true });
      }
    },
  });

  function openConnect() {
    if (connectModal) return;
    connectModal = ATK.Modal({
      title: 'Connect to are.na',
      children: auth.element,
      onClose: () => { connectModal = null; endWriteMode(); },
    });
    document.body.append(connectModal);
  }

  function closeConnect() {
    connectModal?.remove();
    connectModal = null;
    endWriteMode();
  }

  // Back to the read-only Connect wording once the write prompt is over.
  function endWriteMode() {
    if (pendingEditId == null && !writePrompt) return;
    writePrompt = false;
    if (!auth.getUser()) pendingEditId = null;
    auth.setRequireWrite(false);
  }
  let writePrompt = false;

  // Can this token edit? If not, open Connect asking for a write token.
  async function requestWrite(blockId) {
    let writable;
    try {
      writable = await auth.ensureWrite();
    } catch (err) {
      return { ok: false, message: `Couldn't check the token: ${describeConnectError(err)}` };
    }
    if (writable) return { ok: true };
    writePrompt = true;
    pendingEditId = blockId;
    auth.setRequireWrite(true, 'Editing needs a token with write access.');
    openConnect();
    return { ok: false };
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeConnect();
  });

  function mountHeader() {
    const crumbs = h('nav', { className: 'crumbs', 'aria-label': 'Breadcrumb' },
      h('ol', null, [
        h('li', null, ATK.Link({ variant: 'muted', href: 'index.html', children: 'Are.na Tools' })),
        h('li', { 'aria-current': 'page' }, 'Are.na Palimpsest'),
      ]));
    const end = h('div', { className: 'palimpsest-header__end' }, [account, ATK.ThemeChooser()]);
    els.header.append(crumbs, end);
  }

  /* ── Input bar ───────────────────────────────────────────────── */
  let inputEl = null;
  let inspectBtn = null;
  let hintSlot = null;
  let historySlot = null;
  const HISTORY_KEY = 'arena_palimpsest_history';
  const LAST_INPUT_KEY = 'arena_palimpsest_last_input';

  function mountInputBar() {
    inputEl = ATK.Input({
      placeholder: 'Paste a block URL or ID (e.g. 13857023 or https://www.are.na/block/13857023)',
    });
    inputEl.id = 'block-input';
    inputEl.autocomplete = 'off';
    inputEl.spellcheck = false;

    inspectBtn = ATK.Button({ variant: 'primary', children: 'Inspect', onClick: () => inspect(inputEl.value) });
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') inspect(inputEl.value); });
    hintSlot = h('div', { className: 'input-bar__hint', role: 'alert' });
    historySlot = h('div', { className: 'history' });

    inputEl.value = readJson(localStorage, LAST_INPUT_KEY, '') || '';

    els.inputBar.append(
      h('label', { for: 'block-input' }, 'Block to inspect'),
      h('div', { className: 'input-bar__row' }, [inputEl, inspectBtn]),
      hintSlot,
      historySlot,
    );
    renderHistory();
  }

  /* ── History ─────────────────────────────────────────────────── */
  function renderHistory() {
    const list = cleanHistory(readJson(localStorage, HISTORY_KEY, []));
    if (!list.length) { historySlot.replaceChildren(); return; }
    historySlot.replaceChildren(
      h('span', { className: 'muted' }, 'Recent:'),
      ...list.map((entry) => h('button', {
        className: 'chip-button',
        type: 'button',
        title: entry.title || `Block ${entry.id}`,
        onClick: () => { inputEl.value = String(entry.id); inspect(inputEl.value); },
      }, ATK.Badge({ children: String(entry.id) }))),
    );
  }

  function remember(raw, block) {
    writeJson(localStorage, LAST_INPUT_KEY, raw);
    const entry = { id: block.id, title: block.title || '', at: new Date().toISOString() };
    writeJson(localStorage, HISTORY_KEY, updateHistory(cleanHistory(readJson(localStorage, HISTORY_KEY, [])), entry));
    renderHistory();
  }

  function setHint(text) {
    hintSlot.replaceChildren(...(text ? [ATK.Badge({ variant: 'alert', children: 'Not a block' }), text] : []));
  }

  /* ── Result pane ─────────────────────────────────────────────── */
  function renderPlaceholder() {
    els.resultPane.replaceChildren(
      h('p', { className: 'muted' }, 'Nothing inspected yet. Paste a block URL or ID above to see its fields, metadata and connections.'),
    );
  }

  /* Label/value rows. Values are nodes, so v2 can swap a value cell for an Input. */
  const EMPTY = () => h('span', { className: 'muted' }, '—');

  function valueNode(value) {
    if (value == null || value === '') return EMPTY();
    if (typeof value === 'string') {
      const href = webUrl(value);
      return href ? extLink(value, href) : document.createTextNode(value);
    }
    return typeof value === 'number' ? document.createTextNode(String(value)) : value;
  }

  function kvTable(rows) {
    return h('table', { className: 'kv' }, h('tbody', null, rows.map(([label, value]) =>
      h('tr', null, [h('th', { scope: 'row' }, label), h('td', null, valueNode(value))]),
    )));
  }

  function extLink(text, href) {
    const a = ATK.Link({ href, children: text });
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }

  function userLink(user) {
    const href = userUrl(user);
    return href ? extLink(userHandle(user), href) : userHandle(user);
  }

  function copyLink(text) {
    const a = ATK.Link({ variant: 'muted', children: 'copy' });
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(text);
        a.textContent = 'copied';
      } catch {
        a.textContent = "couldn't copy";
      }
      setTimeout(() => { a.textContent = 'copy'; }, 1500);
    });
    return a;
  }

  function metadataView(metadata) {
    const entries = metadataEntries(metadata);
    return entries.length
      ? kvTable(entries)
      : h('p', { className: 'muted' }, 'No metadata set');
  }

  // The block's own metadata, with the Edit toggle.
  let currentEditor = null;
  function blockMetadataSection(block) {
    currentEditor = createMetadataEditor({
      block,
      client,
      renderView: metadataView,
      requestWrite: () => requestWrite(block.id),
      onSaved: (saved) => remember(String(saved.id), saved),
    });
    return currentEditor.element;
  }

  function metadataSection(metadata) {
    const entries = metadataEntries(metadata);
    return h('div', { className: 'metadata' }, [
      h('h3', { className: 'metadata__title' }, [
        'Custom Metadata ',
        ATK.Badge({ children: String(entries.length) }),
      ]),
      entries.length
        ? kvTable(entries)
        : h('p', { className: 'muted' }, 'No metadata set'),
    ]);
  }

  function blockThumb(block) {
    const src = block.image?.medium?.src || block.embed?.thumbnail_url;
    let thumb = null;
    if (src) {
      thumb = ATK.Block({ variant: 'image', src, alt: block.image?.alt_text || block.title || '' });
    } else if (block.type === 'Text') {
      thumb = ATK.Block({ variant: 'text', children: block.content?.plain || '' });
    } else if (block.type === 'Attachment') {
      thumb = ATK.Block({ variant: 'attachment', label: (block.attachment?.file_extension || '').toUpperCase() || null });
    }
    return thumb ? h('div', { className: 'block-frame__thumb' }, thumb) : null;
  }

  let connectedCell = null;

  function renderBlock(block) {
    connectedCell = h('span', { className: 'muted' }, 'loading…');
    const fields = [
      ['ID', h('span', { className: 'kv__inline' }, [
        String(block.id), copyLink(String(block.id)),
      ])],
      ['Class', block.type],
      ['Title', block.title],
      ['Alt text', block.image?.alt_text],
      ['Description', block.description?.markdown ? h('div', { className: 'prewrap' }, block.description.markdown.trim()) : null],
      ['Source URL', block.source?.url ? extLink(block.source.url, block.source.url) : null],
      ['Source title', block.source?.title],
      ['Owner', userLink(block.user)],
      ['Visibility', [block.visibility, block.state && block.state !== 'available' ? block.state : null].filter(Boolean).join(', ')],
      ['Created', formatDate(block.created_at)],
      ['Updated', formatDate(block.updated_at)],
      ['Connected to', connectedCell],
    ];
    const thumb = blockThumb(block);
    const frame = h('div', { className: 'block-frame', 'data-visibility': block.visibility || 'unknown' }, [
      thumb,
      h('h2', { className: 'block-frame__title' }, `Block ${block.id}`),
      h('div', { className: 'block-frame__link' }, extLink('open on are.na', blockUrl(block.id))),
    ]);
    return h('div', { className: 'block-layout' }, [
      frame,
      h('div', { className: 'block-data' }, [
        blockMetadataSection(block),
        h('div', { className: 'metadata' }, [h('h3', { className: 'metadata__title' }, 'Block Metadata'), kvTable(fields)]),
      ]),
    ]);
  }

  function channelRow(ch) {
    const counts = ch.counts || {};
    const url = channelUrl(ch);
    const ownerHref = ownerUrl(ch.owner);
    const fields = [
      ['Channel', url ? extLink(ch.title, url) : ch.title],
      ['Slug', ch.slug],
      ['ID', String(ch.id)],
      ['Owner', ownerHref ? extLink(ownerLabel(ch.owner), ownerHref) : ownerLabel(ch.owner)],
      ['Visibility', ch.visibility],
      ['Description', ch.description?.markdown ? h('div', { className: 'prewrap' }, ch.description.markdown.trim()) : null],
      ['Blocks', counts.blocks],
      ['Contents', counts.contents],
      ['Collaborators', counts.collaborators],
      ['Created', formatDate(ch.created_at)],
      ['Updated', formatDate(ch.updated_at)],
    ];
    return ATK.ConnectionListInfo({
      title: ch.title || ch.slug,
      visibility: ch.visibility || 'unknown',
      count: formatCount(counts.contents ?? counts.blocks),
      metadataCount: metadataEntries(ch.metadata).length,
      owner: ownerLabel(ch.owner),
      children: [metadataSection(ch.metadata), kvTable(fields)],
    });
  }

  async function loadConnections(id, run) {
    const channels = [];
    const rows = new Map();
    let mode = 'default';
    const list = ATK.ConnectionList({
      sorts: CHANNEL_SORTS,
      onSort: (value) => { mode = value; list.setRows(sortChannels(channels, mode).map((ch) => rows.get(ch))); },
      rows: [h('p', { className: 'muted' }, 'Loading channels…')],
    });
    const note = h('p', { className: 'muted' },
      "are.na doesn't show connection details (position, who connected it, when, or connection metadata) from a block's side, so this lists the channels themselves.");
    const card = ATK.Card({ title: 'Connected channels', children: h('div', { className: 'stack' }, [note, list]) });
    const title = card.querySelector('.atk-card__title');
    els.resultPane.append(card);

    let seen = 0;
    try {
      await client.getBlockConnections(id, {
        onPage: (items, meta) => {
          if (run !== inspectRun) return;
          seen += items.length;
          items.forEach((ch) => { channels.push(ch); rows.set(ch, channelRow(ch)); });
          list.setRows(sortChannels(channels, mode).map((ch) => rows.get(ch)));
          title.textContent = `Connected channels (${meta?.total_count ?? seen})`;
        },
      });
      if (run !== inspectRun) return;
      if (!seen) {
        list.setRows([h('p', { className: 'muted' }, 'Not connected to any channel you can see.')]);
        title.textContent = 'Connected channels (0)';
      }
      connectedCell.textContent = `${seen} channel${seen === 1 ? '' : 's'}`;
    } catch (err) {
      if (run !== inspectRun) return;
      list.setRows([h('p', null, `Couldn't load the channels: ${describeConnectError(err)}`)]);
      connectedCell.textContent = 'unknown';
    }
  }

  function messageCard(title, ...kids) {
    return ATK.Card({ title, children: h('div', { className: 'stack' }, kids) });
  }

  function renderBlockError(id, err) {
    if (err.status === 401 || err.status === 403) {
      const link = ATK.Link({ children: 'Connect to are.na' });
      link.addEventListener('click', (e) => { e.preventDefault(); openConnect(); });
      return messageCard(
        'This block requires authentication',
        h('p', null, ['Block ', String(id), ' is private, or in a private channel. ', link, ' with a token that can read it.']),
      );
    }
    if (err.status === 404) {
      return messageCard(
        `Block ${id} not found or you don't have access`,
        h('p', { className: 'muted' }, "If it's in a private channel, connect your account with a token that can read it."),
      );
    }
    return messageCard("Couldn't load that block", h('p', null, describeConnectError(err)));
  }

  let inspectRun = 0;

  async function inspect(raw, { autoEdit = false, skipDirtyCheck = false } = {}) {
    const id = parseBlockInput(raw);
    if (id == null) {
      setHint("That doesn't look like a block URL or ID. Try 13857023 or https://www.are.na/block/13857023.");
      return;
    }
    if (!skipDirtyCheck && currentEditor?.isDirty() && !window.confirm('You have unsaved metadata changes. Discard them?')) return;
    currentEditor = null;
    setHint('');
    const run = ++inspectRun;
    inspectBtn.disabled = true;
    els.resultPane.replaceChildren(messageCard(`Block ${id}`, h('p', { className: 'muted' }, 'Loading…')));
    try {
      const block = await client.getBlock(id);
      if (run !== inspectRun) return;
      els.resultPane.replaceChildren(renderBlock(block));
      remember(raw, block);
      if (autoEdit && !(block.can && block.can.manage === false)) currentEditor?.startEditing();
      await loadConnections(id, run);
    } catch (err) {
      if (run !== inspectRun) return;
      els.resultPane.replaceChildren(renderBlockError(id, err));
    } finally {
      if (run === inspectRun) inspectBtn.disabled = false;
    }
  }

  /* ── Start ───────────────────────────────────────────────────── */
  mountHeader();
  mountInputBar();
  renderPlaceholder();
  auth.restore();
})();
