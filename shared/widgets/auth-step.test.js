import { describe, it, expect } from 'vitest';
import { checkWriteAccess, initialsFor, readSavedToken, saveToken, clearToken, describeConnectError, AUTH_STORAGE_KEY } from './auth-step.js';

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

describe('initialsFor', () => {
  it('uses the first letters of a full name', () => {
    expect(initialsFor({ full_name: 'Kim Plowright', slug: 'kim-plowright' })).toBe('KP');
  });
  it('caps at two letters', () => {
    expect(initialsFor({ full_name: 'Mary Jane Watson' })).toBe('MJ');
  });
  it('falls back to the slug, then to ?', () => {
    expect(initialsFor({ slug: 'kim-plowright' })).toBe('K');
    expect(initialsFor({})).toBe('?');
    expect(initialsFor(null)).toBe('?');
  });
});
