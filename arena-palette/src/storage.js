// storage.js: localStorage keys, the one-time v1 → v2 migration, and saving the v2 keys.
// The mapping is pure (migrateV1Storage); loadPaletteStorage is the thin part that touches storage.
import { NAME_LISTS } from './names.js';

export const STORE_V1_STATE_KEY    = 'arena-palette-v1';
export const STORE_V1_SETTINGS_KEY = 'arena-palette-settings-v1';
export const STORE_V1_THEME_KEY    = 'arena-palette-theme-v1';
export const STORE_V2_STATE_KEY    = 'arena-palette-v2';
export const STORE_V2_SETTINGS_KEY = 'arena-palette-settings-v2';
export const STORE_V2_THEME_KEY    = 'arena-palette-theme-v2';   // ThemeChooser's storageKey for this tool

export const STORE_MAX_SOURCES = 4;
export const STORE_DEFAULT_SOURCES = ['chromatic-vwdupl8d0lk'];
export const STORE_DEFAULT_EXTRACT = {
  count:          6,
  quality:        'med',
  colorSpace:     'oklch',
  ignoreWhite:    true,
  minSaturation:  0,
  nameVocabulary: 'bestOf',
};

const STORE_QUALITIES   = ['hi', 'med', 'lo'];
const STORE_COLOUR_SPACES = ['oklch', 'rgb'];

function storeParse(raw) {
  if (typeof raw !== 'string') return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch (e) { return null; }
}

// v1 and v2 extraction settings differ only in two names (colorCount → count, nameList → nameVocabulary).
// Anything missing or out of range falls back to the default.
export function storeCleanExtract(v1) {
  const d = STORE_DEFAULT_EXTRACT;
  const s = v1 || {};
  const count = Number.isInteger(s.colorCount) && s.colorCount >= 4 && s.colorCount <= 12 ? s.colorCount : d.count;
  const minSat = typeof s.minSaturation === 'number' && s.minSaturation >= 0 && s.minSaturation <= 0.5 ? s.minSaturation : d.minSaturation;
  return {
    count,
    quality:        STORE_QUALITIES.includes(s.quality) ? s.quality : d.quality,
    colorSpace:     STORE_COLOUR_SPACES.includes(s.colorSpace) ? s.colorSpace : d.colorSpace,
    ignoreWhite:    typeof s.ignoreWhite === 'boolean' ? s.ignoreWhite : d.ignoreWhite,
    minSaturation:  minSat,
    nameVocabulary: Object.hasOwn(NAME_LISTS, s.nameList) ? s.nameList : d.nameVocabulary,
  };
}

// v1's "mid" is replaced by Neutral; dark and light carry over; anything else is dropped (null).
export function storeMigrateTheme(v1) {
  if (v1 === 'mid') return 'neutral';
  if (v1 === 'dark' || v1 === 'light') return v1;
  return null;
}

// Raw v1 strings in, v2 objects out. Never throws; the v1 data is not modified.
export function migrateV1Storage({ state, settings, theme } = {}) {
  const s = storeParse(state);
  const channels = Array.isArray(s?.channels)
    ? s.channels.filter(c => typeof c === 'string' && c.trim()).map(c => c.trim()).slice(0, STORE_MAX_SOURCES)
    : [];
  const token = typeof s?.token === 'string' ? s.token : '';
  return {
    state: {
      sources: channels.length ? channels : [...STORE_DEFAULT_SOURCES],
      token,
      rememberToken: true,
    },
    settings: { extract: storeCleanExtract(storeParse(settings)) },
    theme: storeMigrateTheme(theme),
  };
}

// Reads the v2 keys. If there are none, migrates v1 once and writes the v2 keys (v1 keys stay, so a
// rollback still works). A fresh browser gets the defaults and nothing is written. `storage` is
// localStorage in the page; any failure falls back to the defaults.
export function loadPaletteStorage(storage) {
  const get = k => { try { return storage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { storage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  const state = storeParse(get(STORE_V2_STATE_KEY));
  const settings = storeParse(get(STORE_V2_SETTINGS_KEY));
  if (state || settings) {
    return {
      migrated: false,
      state: {
        sources: Array.isArray(state?.sources) && state.sources.length ? state.sources.slice(0, STORE_MAX_SOURCES) : [...STORE_DEFAULT_SOURCES],
        token: typeof state?.token === 'string' ? state.token : '',
        rememberToken: state?.rememberToken !== false,
      },
      settings: { extract: storeCleanExtract({ ...settings?.extract, colorCount: settings?.extract?.count, nameList: settings?.extract?.nameVocabulary }) },
      theme: null,
    };
  }

  const v1 = { state: get(STORE_V1_STATE_KEY), settings: get(STORE_V1_SETTINGS_KEY), theme: get(STORE_V1_THEME_KEY) };
  const out = migrateV1Storage(v1);
  const hadV1 = v1.state !== null || v1.settings !== null;
  if (hadV1) {
    set(STORE_V2_STATE_KEY, out.state);
    set(STORE_V2_SETTINGS_KEY, out.settings);
  }
  return { ...out, migrated: hadV1 };
}

// Writes the v2 keys. The token is only stored while "Remember token" is ticked; unticking clears it.
// Never throws: a blocked localStorage just means nothing is remembered.
export function savePaletteStorage(storage, { sources = [], token = '', rememberToken = true, extract = {} } = {}) {
  const set = (k, v) => { try { storage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const inputs = sources.map(s => String(s ?? '').trim()).filter(Boolean).slice(0, STORE_MAX_SOURCES);
  set(STORE_V2_STATE_KEY, {
    sources: inputs.length ? inputs : [...STORE_DEFAULT_SOURCES],
    token: rememberToken ? String(token ?? '') : '',
    rememberToken: !!rememberToken,
  });
  set(STORE_V2_SETTINGS_KEY, { extract: { ...STORE_DEFAULT_EXTRACT, ...extract } });
}
