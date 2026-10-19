// PAT connect widget: paste a token, test it against /me, remember it in localStorage.
// Built only from ArenaToolkit components. Read-only for now; a write-scope check
// (see arena-merge's checkWriteAccess) is added when the first writing tool adopts this.
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

export function describeConnectError(err) {
  if (err?.status === 401) return "are.na didn't recognise that token. Check it was copied whole.";
  if (err?.status === 429) return 'are.na is asking us to slow down. Try again in a minute.';
  if (err?.status) return `are.na said: ${err.message}`;
  return "Couldn't reach are.na. Check your connection and try again.";
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
  storageKey = AUTH_STORAGE_KEY,
  onChange = null,
} = {}) {
  const ATK = window.ArenaToolkit;
  let user = null;

  const element = node('div', null, { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' });

  function render(statusNode) {
    element.replaceChildren();
    if (user) {
      const row = node('div', null, { display: 'flex', alignItems: 'center', gap: 'var(--space-2)' });
      row.append(
        ATK.Badge({ variant: 'success', children: `Connected as @${user.slug}` }),
        ATK.Button({ variant: 'ghost', size: 'sm', children: 'Disconnect', onClick: disconnect }),
      );
      element.append(row);
      return;
    }

    const intro = node('p', null, { margin: 0 });
    intro.append(
      'Paste a ',
      ATK.Link({ href: AUTH_TOKEN_URL, children: 'personal access token' }),
      ' with read access. That is all this tool needs. Some content, including private channels, only shows up once you are connected.',
    );
    intro.querySelector('a').target = '_blank';
    intro.querySelector('a').rel = 'noopener';

    const input = ATK.Input({ type: 'password', placeholder: 'Paste your token here' });
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.style.flex = '1';
    const submit = () => connect(input.value);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

    const row = node('div', null, { display: 'flex', gap: 'var(--space-2)' });
    row.append(input, ATK.Button({ variant: 'primary', children: 'Connect', onClick: submit }));

    const note = node('p', 'Your token stays in this browser and is only ever sent to are.na.', {
      margin: 0, color: 'var(--text-muted)', font: 'var(--text-body-sm)',
    });

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
    try {
      user = await client.getCurrentUser();
    } catch (err) {
      client.setToken(null);
      render(statusRow('Couldn\'t connect', describeConnectError(err)));
      return null;
    }
    saveToken(storage, token, storageKey);
    render();
    if (onChange) onChange(user);
    return user;
  }

  // Re-connect with a saved token, if there is one. Returns the user or null.
  async function restore() {
    const saved = readSavedToken(storage, storageKey);
    if (!saved) { render(); return null; }
    const result = await connect(saved);
    if (!result) clearToken(storage, storageKey);
    return result;
  }

  function disconnect() {
    user = null;
    client.setToken(null);
    clearToken(storage, storageKey);
    render();
    if (onChange) onChange(null);
  }

  render();
  return { element, connect, restore, disconnect, getUser: () => user };
}
