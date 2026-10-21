// PAT connect widget: paste a token, test it against /me, remember it in localStorage.
// Built only from ArenaToolkit components. Options for tools that change things:
//  - requireWrite: the token is checked for write scope before it is accepted or saved.
//  - writeMessage: a line shown above the form, e.g. "Editing needs a token with write access."
//  - For a page that is read-only until asked: leave requireWrite off, call ensureWrite() (true / false /
//    null for not connected), and if it is not true call setRequireWrite(true, message) and open the form.
//  - panel: arena-merge's Connect layout: a labelled field, a "Remember on this computer"
//    checkbox (unticked, the token lives in sessionStorage and goes with the tab), and an
//    account chip once connected. loadDetail(user) can fetch the chip's second line.
export const AUTH_STORAGE_KEY = 'arena_toolkit_pat';
export const AUTH_TOKEN_URL = 'https://www.are.na/settings/personal-access-tokens';

export function readSavedToken(storage, key = AUTH_STORAGE_KEY) {
  try { return storage.getItem(key) || null; } catch { return null; }
}

export function saveToken(storage, token, key = AUTH_STORAGE_KEY) {
  try { storage.setItem(key, token); } catch { /* private window or blocked storage: carry on unsaved */ }
}

export function clearToken(storage, key = AUTH_STORAGE_KEY) {
  try { storage.removeItem(key); } catch { /* nothing to clear */ }
}

// Two letters for the account chip's avatar: "Kim Plowright" -> "KP", "kim-plowright" -> "K".
export function initialsFor(user) {
  const name = String(user?.full_name || user?.slug || '?').trim();
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export function describeConnectError(err) {
  if (err?.status === 401) return "are.na didn't recognise that token. Check it was copied whole.";
  if (err?.status === 429) return 'are.na is asking us to slow down. Try again in a minute.';
  if (err?.status) return `are.na said: ${err.message}`;
  return "Couldn't reach are.na. Check your connection and try again.";
}

// DELETE /connections/0 never matches anything: 403 means a read-only token, 404 means write is allowed.
// (The trick arena-merge and to-arena use; nothing is changed either way.)
export async function checkWriteAccess(client) {
  try {
    await client.deleteConnection(0);
    return true;
  } catch (err) {
    if (err?.status === 403) return false;
    if (err?.status === 404) return true;
    throw err;
  }
}

// Remembers whether the connected token can write, so a page can ask "can I edit?" without a request each time.
// Call reset() when the token changes; mark(true) when a connect has already proved write access.
export function createWriteGate(client) {
  let answer = null;
  return {
    mark(value) { answer = value; },
    reset() { answer = null; },
    // true / false from the cache or one probe. A failed probe (401, offline) throws and caches nothing.
    async check() {
      if (answer === null) answer = await checkWriteAccess(client);
      return answer;
    },
  };
}

function statusRow(label, message) {
  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' });
  row.append(window.ArenaToolkit.Badge({ variant: 'alert', children: label }), message);
  return row;
}

function node(tag, text, style) {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (style) Object.assign(n.style, style);
  return n;
}

// client: from createArenaClient(). onChange(user | null) fires on connect and disconnect.
export function createAuthStep({
  client,
  storage = globalThis.localStorage,
  session = globalThis.sessionStorage,
  storageKey = AUTH_STORAGE_KEY,
  onChange = null,
  requireWrite: initialRequireWrite = false,
  writeMessage: initialWriteMessage = null,
  panel = false,
  loadDetail = null,
} = {}) {
  const ATK = window.ArenaToolkit;
  let requireWrite = initialRequireWrite;
  let writeMessage = initialWriteMessage;
  const writeGate = createWriteGate(client);
  let user = null;
  let detail = null;
  let remember = true;

  const element = node('div', null, { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' });

  function rememberCheck() {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = remember;
    box.addEventListener('change', () => { remember = box.checked; });
    const text = node('span');
    text.append('Remember on this computer', node('br'), node('span', 'Unticked, it is forgotten when you close the tab.', {
      color: 'var(--text-muted)', font: 'var(--text-body-sm)',
    }));
    const label = node('label', null, { display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start', cursor: 'pointer' });
    label.append(box, text);
    return label;
  }

  function accountChip() {
    const avatar = node('div', initialsFor(user), {
      width: '32px', height: '32px', borderRadius: '50%', flexShrink: '0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--accent-primary)', color: 'var(--surface-page)', font: 'var(--text-ui-strong)',
    });
    const who = node('div', null, { flex: '1', minWidth: '0', color: 'var(--text-secondary)' });
    const name = node('strong', user.full_name || user.slug, { color: 'var(--text-primary)' });
    who.append('Signed in as ', name);
    if (detail) who.append(node('br'), node('span', detail, { color: 'var(--text-muted)', font: 'var(--text-body-sm)' }));
    const chip = node('div', null, {
      display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)',
      background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)',
    });
    chip.append(avatar, who, ATK.Button({ variant: 'ghost', size: 'sm', children: 'Disconnect', onClick: disconnect }));
    return chip;
  }

  function render(statusNode) {
    element.replaceChildren();
    if (user && panel) {
      element.append(accountChip());
      return;
    }
    if (user) {
      const row = node('div', null, { display: 'flex', alignItems: 'center', gap: 'var(--space-2)' });
      row.append(
        ATK.Badge({ variant: 'success', children: `Connected as @${user.slug}` }),
        ATK.Button({ variant: 'ghost', size: 'sm', children: 'Disconnect', onClick: disconnect }),
      );
      element.append(row);
      return;
    }

    if (writeMessage) element.append(node('p', writeMessage, { margin: 0, font: 'var(--text-ui-strong)' }));

    const intro = node('p', null, { margin: 0 });
    intro.append(
      panel ? 'Create a ' : 'Paste a ',
      ATK.Link({ href: AUTH_TOKEN_URL, children: 'personal access token' }),
    );
    if (requireWrite) {
      intro.append(panel
        ? ' with read and write ticked, then paste it below. The token stays in your browser only.'
        : ' with the write scope ticked. This tool changes your account: it adds and removes connections and edits blocks, so a read-only token will not work.');
    } else {
      intro.append(' with read access. That is all this tool needs. Some content, including private channels, only shows up once you are connected.');
    }
    intro.querySelector('a').target = '_blank';
    intro.querySelector('a').rel = 'noopener';

    const input = ATK.Input({ type: 'password', placeholder: panel ? 'paste it here' : 'Paste your token here' });
    input.id = 'arena-token';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.style.flex = '1';
    const submit = () => connect(input.value);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

    const row = node('div', null, { display: 'flex', gap: 'var(--space-2)' });
    row.append(input, ATK.Button({ variant: panel ? 'secondary' : 'primary', children: 'Connect', onClick: submit }));

    const note = node('p', 'Your token stays in this browser and is only ever sent to are.na.', {
      margin: 0, color: 'var(--text-muted)', font: 'var(--text-body-sm)',
    });

    if (panel) {
      const label = node('label', 'Personal access token', { font: 'var(--text-ui-strong)', color: 'var(--text-muted)' });
      label.htmlFor = 'arena-token';
      element.append(intro, label, row, rememberCheck());
      if (statusNode) element.append(statusNode);
      return;
    }

    element.append(intro, row, note);
    if (statusNode) element.append(statusNode);
  }

  async function connect(rawToken) {
    const token = String(rawToken || '').trim();
    if (!token) {
      render(statusRow('No token', 'Paste a token first.'));
      return null;
    }
    render(ATK.Badge({ children: 'Checking…' }));
    client.setToken(token);
    writeGate.reset();
    try {
      user = await client.getCurrentUser();
    } catch (err) {
      client.setToken(null);
      render(statusRow('Couldn\'t connect', describeConnectError(err)));
      return null;
    }
    if (requireWrite) {
      let writable = false;
      try {
        writable = await checkWriteAccess(client);
      } catch (err) {
        client.setToken(null);
        user = null;
        render(statusRow('Couldn\'t connect', describeConnectError(err)));
        return null;
      }
      if (!writable) {
        client.setToken(null);
        user = null;
        render(statusRow('Read-only token', 'This token can\'t write. Create a new one with the write scope ticked.'));
        return null;
      }
      writeGate.mark(true);
    }
    // Remembered tokens go to localStorage; otherwise sessionStorage, which goes with the tab.
    clearToken(storage, storageKey);
    clearToken(session, storageKey);
    saveToken(remember ? storage : session, token, storageKey);
    detail = null;
    if (loadDetail) {
      render(node('p', 'Loading your channels…', { margin: 0, color: 'var(--text-muted)' }));
      try { detail = await loadDetail(user); } catch { detail = null; }
    }
    render();
    if (onChange) onChange(user);
    return user;
  }

  // Re-connect with a saved token, if there is one. Returns the user or null.
  async function restore() {
    const inLocal = readSavedToken(storage, storageKey);
    const saved = inLocal || readSavedToken(session, storageKey);
    if (!saved) { render(); return null; }
    remember = !!inLocal;
    const result = await connect(saved);
    if (!result) { clearToken(storage, storageKey); clearToken(session, storageKey); }
    return result;
  }

  // Can the connected token write? true / false, or null when nobody is connected.
  // Checked once per token (the DELETE /connections/0 probe); throws on 401 or a network error.
  async function ensureWrite() {
    if (!user) return null;
    return writeGate.check();
  }

  // Switch to write mode, for a page that is read-only until the person asks to edit.
  // message appears above the form. A connected token is dropped so the form can take a write token.
  // setRequireWrite(false) puts the widget back to its read-only wording.
  function setRequireWrite(enabled = true, message = null) {
    requireWrite = !!enabled;
    writeMessage = enabled ? message : null;
    if (user) disconnect();
    else render();
  }

  function disconnect() {
    user = null;
    detail = null;
    writeGate.reset();
    client.setToken(null);
    clearToken(storage, storageKey);
    clearToken(session, storageKey);
    render();
    if (onChange) onChange(null);
  }

  render();
  return { element, connect, restore, disconnect, ensureWrite, setRequireWrite, getUser: () => user };
}
