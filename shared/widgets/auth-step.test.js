import { describe, it, expect } from 'vitest';
import { checkWriteAccess, createWriteGate, readSavedToken, saveToken, clearToken, describeConnectError, AUTH_STORAGE_KEY } from './auth-step.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
    removeItem: k => { delete data[k]; },
  };
}

const blocked = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
  removeItem() { throw new Error('blocked'); },
};

describe('token storage', () => {
  it('round-trips a token under the shared key', () => {
    const s = fakeStorage();
    saveToken(s, 'abc');
    expect(readSavedToken(s)).toBe('abc');
    expect(AUTH_STORAGE_KEY).toBe('arena_toolkit_pat');
  });

  it('returns null when nothing is saved', () => {
    expect(readSavedToken(fakeStorage())).toBeNull();
  });

  it('clears a saved token', () => {
    const s = fakeStorage({ [AUTH_STORAGE_KEY]: 'abc' });
    clearToken(s);
    expect(readSavedToken(s)).toBeNull();
  });

  it('survives blocked storage without throwing', () => {
    expect(readSavedToken(blocked)).toBeNull();
    expect(() => saveToken(blocked, 'abc')).not.toThrow();
    expect(() => clearToken(blocked)).not.toThrow();
  });
});

describe('describeConnectError', () => {
  it('explains a bad token', () => {
    expect(describeConnectError({ status: 401, message: 'x' })).toMatch(/token/);
  });

  it('explains rate limiting', () => {
    expect(describeConnectError({ status: 429, message: 'x' })).toMatch(/slow down/);
  });

  it('passes through other API messages', () => {
    expect(describeConnectError({ status: 500, message: 'Boom' })).toBe('are.na said: Boom');
  });

  it('treats a status-less error as a network failure', () => {
    expect(describeConnectError(new TypeError('Failed to fetch'))).toMatch(/reach are\.na/);
  });
});

describe('checkWriteAccess', () => {
  const failing = status => ({ deleteConnection: async () => { throw Object.assign(new Error('x'), { status }); } });

  it('is true on 404 (nothing to delete, but allowed to try)', async () => {
    expect(await checkWriteAccess(failing(404))).toBe(true);
  });

  it('is false on 403 (read-only token)', async () => {
    expect(await checkWriteAccess(failing(403))).toBe(false);
  });

  it('is true if the call somehow succeeds', async () => {
    expect(await checkWriteAccess({ deleteConnection: async () => null })).toBe(true);
  });

  it('rethrows anything else, such as 401 or a network error', async () => {
    await expect(checkWriteAccess(failing(401))).rejects.toMatchObject({ status: 401 });
    await expect(checkWriteAccess({ deleteConnection: async () => { throw new TypeError('offline'); } })).rejects.toThrow('offline');
  });
});

describe('createWriteGate', () => {
  const counting = status => {
    const client = { calls: 0, deleteConnection: async () => { client.calls++; throw Object.assign(new Error('x'), { status }); } };
    return client;
  };

  it('probes once and then answers from memory', async () => {
    const client = counting(404);
    const gate = createWriteGate(client);
    expect(await gate.check()).toBe(true);
    expect(await gate.check()).toBe(true);
    expect(client.calls).toBe(1);
  });

  it('reports a read-only token as false', async () => {
    expect(await createWriteGate(counting(403)).check()).toBe(false);
  });

  it('skips the probe when a connect already proved write access', async () => {
    const client = counting(403);
    const gate = createWriteGate(client);
    gate.mark(true);
    expect(await gate.check()).toBe(true);
    expect(client.calls).toBe(0);
  });

  it('probes again after reset (a new token)', async () => {
    const client = counting(404);
    const gate = createWriteGate(client);
    await gate.check();
    gate.reset();
    await gate.check();
    expect(client.calls).toBe(2);
  });

  it('caches nothing when the probe fails', async () => {
    let fail = true;
    const gate = createWriteGate({
      deleteConnection: async () => {
        if (fail) throw Object.assign(new Error('x'), { status: 401 });
        throw Object.assign(new Error('x'), { status: 404 });
      },
    });
    await expect(gate.check()).rejects.toMatchObject({ status: 401 });
    fail = false;
    expect(await gate.check()).toBe(true);
  });
});
