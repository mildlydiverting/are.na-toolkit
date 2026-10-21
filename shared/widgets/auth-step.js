// PAT connect widget: paste a token, test it against /me, remember it in localStorage.
// The look is ArenaToolkit.AuthPanel (docs in shared/ui/AuthPanel/). Options for tools that change things:
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

// client: from createArenaClient(). onChange(user | null) fires on connect and disconnect.
// The look is ArenaToolkit.AuthPanel; this keeps the token, the checks and the storage.
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
  let requireWrite = initialRequireWrite;
  let writeMessage = initialWriteMessage;
  const writeGate = createWriteGate(client);
  let user = null;
  let detail = null;
  let remember = true;

  const element = window.ArenaToolkit.AuthPanel({
    panel,
    tokenUrl: AUTH_TOKEN_URL,
    onConnect: (token) => connect(token),
    onDisconnect: () => disconnect(),
    onRememberChange: (value) => { remember = value; },
  });

  // status: null, or { tone: 'error' | 'info', label?, message }
  function render(status = null) {
    element.update({ user, detail, status, requireWrite, writeMessage, remember });
  }

  const failure = (label, message) => ({ tone: 'error', label, message });
  const progress = (message) => ({ tone: 'info', message });

  async function connect(rawToken) {
    const token = String(rawToken || '').trim();
    if (!token) {
      render(failure('No token', 'Paste a token first.'));
      return null;
    }
    render(progress('Checking token…'));
    client.setToken(token);
    writeGate.reset();
    try {
      user = await client.getCurrentUser();
    } catch (err) {
      client.setToken(null);
      render(failure("Couldn't connect", describeConnectError(err)));
      return null;
    }
    if (requireWrite) {
      let writable = false;
      try {
        writable = await checkWriteAccess(client);
      } catch (err) {
        client.setToken(null);
        user = null;
        render(failure("Couldn't connect", describeConnectError(err)));
        return null;
      }
      if (!writable) {
        client.setToken(null);
        user = null;
        render(failure('Read-only token', "This token can't write. Create a new one with the write scope ticked."));
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
      render(progress('Loading your channels…'));
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
    if (enabled && user) disconnect();
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
