import { describe, it, expect } from 'vitest';
import {
  migrateV1Storage, loadPaletteStorage, savePaletteStorage, storeCleanExtract, storeMigrateTheme,
  STORE_V1_STATE_KEY, STORE_V1_SETTINGS_KEY, STORE_V1_THEME_KEY, STORE_V2_STATE_KEY, STORE_V2_SETTINGS_KEY,
} from './storage.js';

// Real v1 payloads (token swapped for a made-up one).
const realV1 = {
  state:    '{"channels":["chromatic-vwdupl8d0lk","practice-aesthetic"],"token":"test-token"}',
  settings: '{"colorCount":6,"quality":"med","colorSpace":"oklch","ignoreWhite":true,"minSaturation":0,"nameList":"sanzoWadaI"}',
  theme:    'dark',
};

function fakeStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
  };
}

describe('migrateV1Storage', () => {
  it('maps a real v1 payload', () => {
    expect(migrateV1Storage(realV1)).toEqual({
      state:    { sources: ['chromatic-vwdupl8d0lk', 'practice-aesthetic'], token: 'test-token', rememberToken: true },
      settings: { extract: { count: 6, quality: 'med', colorSpace: 'oklch', ignoreWhite: true, minSaturation: 0, nameVocabulary: 'sanzoWadaI' } },
      theme:    'dark',
    });
  });

  it('falls back to defaults on missing or broken data', () => {
    for (const bad of [undefined, {}, { state: 'not json', settings: '[1,2]', theme: 7 }]) {
      const out = migrateV1Storage(bad);
      expect(out.state).toEqual({ sources: ['chromatic-vwdupl8d0lk'], token: '', rememberToken: true });
      expect(out.settings.extract.count).toBe(6);
      expect(out.theme).toBeNull();
    }
  });

  it('keeps at most four non-empty channels, trimmed', () => {
    const state = JSON.stringify({ channels: [' a ', '', 'b', 3, 'c', 'd', 'e'] });
    expect(migrateV1Storage({ state }).state.sources).toEqual(['a', 'b', 'c', 'd']);
  });

  it('uses the default channel when the saved list is empty', () => {
    expect(migrateV1Storage({ state: '{"channels":[]}' }).state.sources).toEqual(['chromatic-vwdupl8d0lk']);
  });
});

describe('storeCleanExtract', () => {
  it('renames colorCount and nameList', () => {
    const e = storeCleanExtract({ colorCount: 9, nameList: 'werner' });
    expect(e.count).toBe(9);
    expect(e.nameVocabulary).toBe('werner');
  });
  it('replaces out-of-range or unknown values with defaults', () => {
    expect(storeCleanExtract({
      colorCount: 99, quality: 'ultra', colorSpace: 'lab', ignoreWhite: 'yes', minSaturation: 3, nameList: 'nope',
    })).toEqual({ count: 6, quality: 'med', colorSpace: 'oklch', ignoreWhite: true, minSaturation: 0, nameVocabulary: 'bestOf' });
  });
  it('accepts the edges of each range', () => {
    expect(storeCleanExtract({ colorCount: 4, minSaturation: 0.5, quality: 'hi', colorSpace: 'rgb', ignoreWhite: false }))
      .toMatchObject({ count: 4, minSaturation: 0.5, quality: 'hi', colorSpace: 'rgb', ignoreWhite: false });
  });
});

describe('storeMigrateTheme', () => {
  it('replaces mid with neutral and passes dark and light through', () => {
    expect(storeMigrateTheme('mid')).toBe('neutral');
    expect(storeMigrateTheme('dark')).toBe('dark');
    expect(storeMigrateTheme('light')).toBe('light');
    expect(storeMigrateTheme('purple')).toBeNull();
    expect(storeMigrateTheme(null)).toBeNull();
  });
});

describe('loadPaletteStorage', () => {
  const v1Seed = () => ({
    [STORE_V1_STATE_KEY]: realV1.state, [STORE_V1_SETTINGS_KEY]: realV1.settings, [STORE_V1_THEME_KEY]: realV1.theme,
  });

  it('migrates once, writes the v2 keys and leaves the v1 keys alone', () => {
    const storage = fakeStorage(v1Seed());
    const out = loadPaletteStorage(storage);
    expect(out.migrated).toBe(true);
    expect(out.theme).toBe('dark');
    expect(JSON.parse(storage.data.get(STORE_V2_STATE_KEY))).toEqual(out.state);
    expect(JSON.parse(storage.data.get(STORE_V2_SETTINGS_KEY))).toEqual(out.settings);
    expect(storage.data.get(STORE_V1_STATE_KEY)).toBe(realV1.state);
    expect(storage.data.get(STORE_V1_SETTINGS_KEY)).toBe(realV1.settings);
    expect(storage.data.get(STORE_V1_THEME_KEY)).toBe('dark');
  });

  it('reads the v2 keys afterwards and does not migrate again', () => {
    const storage = fakeStorage(v1Seed());
    const first = loadPaletteStorage(storage);
    storage.data.set(STORE_V1_STATE_KEY, '{"channels":["changed-later"]}');
    const second = loadPaletteStorage(storage);
    expect(second.migrated).toBe(false);
    expect(second.state).toEqual(first.state);
    expect(second.settings).toEqual(first.settings);
  });

  it('gives defaults to a fresh browser and writes nothing', () => {
    const storage = fakeStorage();
    const out = loadPaletteStorage(storage);
    expect(out.migrated).toBe(false);
    expect(out.state.sources).toEqual(['chromatic-vwdupl8d0lk']);
    expect(storage.data.size).toBe(0);
  });

  it('survives storage that throws', () => {
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    expect(loadPaletteStorage(broken).state.sources).toEqual(['chromatic-vwdupl8d0lk']);
  });
});

describe('savePaletteStorage', () => {
  const extract = { count: 8, quality: 'hi', colorSpace: 'rgb', ignoreWhite: false, minSaturation: 0.1, nameVocabulary: 'werner' };

  it('round-trips through loadPaletteStorage', () => {
    const storage = fakeStorage();
    savePaletteStorage(storage, { sources: ['one', 'two'], token: 'tok', rememberToken: true, extract });
    const out = loadPaletteStorage(storage);
    expect(out.state).toEqual({ sources: ['one', 'two'], token: 'tok', rememberToken: true });
    expect(out.settings.extract).toEqual(extract);
  });

  it('does not store the token when remember is off', () => {
    const storage = fakeStorage();
    savePaletteStorage(storage, { sources: ['one'], token: 'secret', rememberToken: false });
    expect(storage.data.get(STORE_V2_STATE_KEY)).not.toContain('secret');
    expect(loadPaletteStorage(storage).state).toMatchObject({ token: '', rememberToken: false });
  });

  it('drops blank sources, caps at four and falls back to the default', () => {
    const storage = fakeStorage();
    savePaletteStorage(storage, { sources: [' a ', '', 'b', 'c', 'd', 'e'] });
    expect(loadPaletteStorage(storage).state.sources).toEqual(['a', 'b', 'c', 'd']);
    savePaletteStorage(storage, { sources: ['', '  '] });
    expect(loadPaletteStorage(storage).state.sources).toEqual(['chromatic-vwdupl8d0lk']);
  });

  it('survives storage that throws', () => {
    const broken = { getItem() { return null; }, setItem() { throw new Error('blocked'); } };
    expect(() => savePaletteStorage(broken, { sources: ['a'] })).not.toThrow();
  });
});
