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
  function mountInputBar() {
    const input = ATK.Input({
      placeholder: 'Paste a block URL or ID (e.g. 13857023 or https://www.are.na/block/13857023)',
    });
    input.id = 'block-input';
    input.autocomplete = 'off';
    input.spellcheck = false;

    const button = ATK.Button({ variant: 'primary', children: 'Inspect', onClick: () => inspect(input.value) });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') inspect(input.value); });

    els.inputBar.append(
      h('label', { for: 'block-input' }, 'Block to inspect'),
      h('div', { className: 'input-bar__row' }, [input, button]),
    );
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

  function inspect(raw) {
    // Wired up in the next phase.
    void raw;
  }

  /* ── Start ───────────────────────────────────────────────────── */
  applyTheme();
  mountHeader();
  mountInputBar();
  renderPlaceholder();
  auth.restore();
})();
