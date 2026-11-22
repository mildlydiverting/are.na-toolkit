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

// ── COLOUR NAME API ───────────────────────────────────────────────────────────
export async function fetchColorNames(hexArray, list) {
  try {
    const values = hexArray.map(h => h.replace('#', '')).join(',');
    const params = new URLSearchParams({ values, list });
    const res = await fetch(`${COLOR_NAME_API}?${params}`);
    if (!res.ok) return {};
    const data = await res.json();
    const map = {};
    (data.colors || []).forEach(c => {
      if (c.requestedHex && c.name) map[c.requestedHex.replace('#', '').toLowerCase()] = c.name;
    });
    return map;
  } catch(e) {
    return {};
  }
}
