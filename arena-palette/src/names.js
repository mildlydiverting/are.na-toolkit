// names.js: colour names from color.pizza.

// ── COLOUR NAME API ───────────────────────────────────────────────────────────
export const COLOR_NAME_API = 'https://api.color.pizza/v1/';

export const NAME_LISTS = {
  bestOf:              'best of',
  japaneseTraditional: 'Japanese traditional',
  sanzoWadaI:          'Sanzo Wada I',
  wikipedia:           'Wikipedia',
  werner:              'Werner',
  ridgway:             'Ridgway',
  nbsIscc:             'NBS-ISCC',
  thesaurus:           'Thesaurus',
};

// One key format everywhere: lower-case hex without the #.
export function nameKey(hex) {
  return String(hex).replace('#', '').toLowerCase();
}

export function nameFor(nameMap, hex) {
  return nameMap[nameKey(hex)];
}

// Every requested hex gets an entry: its name, or '' if color.pizza had none for it.
// '' means "looked up, no name"; undefined (no entry) means "not looked up yet", which shows the loading dots.
export function buildNameMap(hexArray, colors = []) {
  const map = {};
  hexArray.forEach(h => { map[nameKey(h)] = ''; });
  colors.forEach(c => {
    if (c.requestedHex && c.name) map[nameKey(c.requestedHex)] = c.name;
  });
  return map;
}

// ── COLOUR NAME API ───────────────────────────────────────────────────────────
// If color.pizza is down or answers badly, every colour is simply left without a name.
export async function fetchColorNames(hexArray, list, fetchImpl = (...a) => globalThis.fetch(...a)) {
  try {
    const values = hexArray.map(nameKey).join(',');
    const params = new URLSearchParams({ values, list });
    const res = await fetchImpl(`${COLOR_NAME_API}?${params}`);
    if (!res.ok) return buildNameMap(hexArray);
    const data = await res.json();
    return buildNameMap(hexArray, data.colors);
  } catch(e) {
    return buildNameMap(hexArray);
  }
}
