// Lookup history: most recent first, deduped by id, capped.
export const HISTORY_CAP = 10;

export function updateHistory(list, entry, cap = HISTORY_CAP) {
  const rest = (Array.isArray(list) ? list : []).filter((e) => e && e.id !== entry.id);
  return [entry, ...rest].slice(0, cap);
}

// Whatever came out of storage: keep only entries with a numeric id.
export function cleanHistory(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((e) => e && Number.isInteger(e.id))
    .slice(0, HISTORY_CAP);
}

export function readJson(storage, key, fallback) {
  try {
    const text = storage.getItem(key);
    return text == null ? fallback : JSON.parse(text);
  } catch { return fallback; }
}

export function writeJson(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: carry on unsaved */ }
}
