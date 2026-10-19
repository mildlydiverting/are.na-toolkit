// Arena Palimpsest: inspect a block's metadata, connections and channels (read-only).
// Plain DOM, built from ArenaToolkit components. No framework.
(function () {
  const ATK = window.ArenaToolkit;

  const THEMES = ['light', 'dark', 'dawn', 'dusk'];

  // ?theme=dawn forces a theme (handy for checking all four); otherwise follow the system.
  function applyTheme() {
    const asked = new URLSearchParams(location.search).get('theme');
    const theme = THEMES.includes(asked)
      ? asked
      : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  }

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
  function showWait(seconds) {
    if (!waitBanner) {
      waitBanner = h('p', { className: 'muted', role: 'status' });
      els.inputBar.append(waitBanner);
    }
    waitBanner.textContent = `Waiting ${seconds}s for rate limit…`;
    setTimeout(() => { waitBanner?.remove(); waitBanner = null; }, seconds * 1000);
  }

  /* ── Header and Connect ──────────────────────────────────────── */
  const authSlot = h('div', { className: 'palimpsest-header__auth' });
  let connectModal = null;

  const auth = createAuthStep({
    client,
    onChange: (user) => {
      renderAuthSlot(user);
      if (user) closeConnect();
    },
  });

  function openConnect() {
    if (connectModal) return;
    connectModal = ATK.Modal({
      title: 'Connect to are.na',
      children: auth.element,
      onClose: () => { connectModal = null; },
    });
    document.body.append(connectModal);
  }

  function closeConnect() {
    connectModal?.remove();
    connectModal = null;
  }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeConnect(); });

  function renderAuthSlot(user) {
    authSlot.replaceChildren(
      user
        ? ATK.Badge({ variant: 'success', children: `Connected as @${user.slug}` })
        : ATK.Link({ children: 'Connect →' }),
    );
    const link = authSlot.querySelector('a');
    if (link) link.addEventListener('click', (e) => { e.preventDefault(); openConnect(); });
  }

  function mountHeader() {
    els.header.append(h('h1', null, 'Arena Palimpsest'), authSlot);
    renderAuthSlot(null);
  }

  /* ── Input bar ───────────────────────────────────────────────── */
  let inputEl = null;
  let inspectBtn = null;
  let hintSlot = null;

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

    els.inputBar.append(
      h('label', { for: 'block-input' }, 'Block to inspect'),
      h('div', { className: 'input-bar__row' }, [inputEl, inspectBtn]),
      hintSlot,
    );
  }

  function setHint(text) {
    hintSlot.replaceChildren(...(text ? [ATK.Badge({ variant: 'alert', children: 'Not a block' }), text] : []));
  }

  /* ── Result pane ─────────────────────────────────────────────── */
  function renderPlaceholder() {
    els.resultPane.replaceChildren(
      ATK.Card({
        title: 'Nothing inspected yet',
        children: h('p', { className: 'muted' }, 'Paste a block URL or ID above to see its fields, metadata and connections.'),
      }),
    );
  }

  /* Label/value rows. Values are nodes, so v2 can swap a value cell for an Input. */
  const EMPTY = () => h('span', { className: 'muted' }, '—');

  function valueNode(value) {
    if (value == null || value === '') return EMPTY();
    return typeof value === 'string' || typeof value === 'number' ? document.createTextNode(String(value)) : value;
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

  function metadataSection(metadata) {
    const entries = metadataEntries(metadata);
    return h('div', { className: 'metadata' }, [
      h('h3', { className: 'metadata__title' }, [
        'Metadata ',
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
    return thumb ? h('div', { className: 'block-head__thumb' }, thumb) : null;
  }

  function renderBlock(block) {
    const fields = [
      ['ID', h('span', { className: 'kv__inline' }, [
        String(block.id), copyLink(String(block.id)), extLink('open on are.na', blockUrl(block.id)),
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
    ];
    const thumb = blockThumb(block);
    return ATK.Card({
      title: `Block ${block.id}`,
      children: h('div', { className: 'stack' }, [
        h('div', { className: 'block-head' }, [thumb, kvTable(fields)]),
        metadataSection(block.metadata),
      ]),
    });
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

  async function inspect(raw) {
    const id = parseBlockInput(raw);
    if (id == null) {
      setHint("That doesn't look like a block URL or ID. Try 13857023 or https://www.are.na/block/13857023.");
      return;
    }
    setHint('');
    const run = ++inspectRun;
    inspectBtn.disabled = true;
    els.resultPane.replaceChildren(messageCard(`Block ${id}`, h('p', { className: 'muted' }, 'Loading…')));
    try {
      const block = await client.getBlock(id);
      if (run !== inspectRun) return;
      els.resultPane.replaceChildren(renderBlock(block));
    } catch (err) {
      if (run !== inspectRun) return;
      els.resultPane.replaceChildren(renderBlockError(id, err));
    } finally {
      if (run === inspectRun) inspectBtn.disabled = false;
    }
  }

  /* ── Start ───────────────────────────────────────────────────── */
  applyTheme();
  mountHeader();
  mountInputBar();
  renderPlaceholder();
  auth.restore();
})();
