// Saved scan configurations: a name, the channels to scan and the detector switches.
// Stored under one localStorage key, as { [name]: { channelIds, detectors, created_at, last_run } }.
export const SETS_KEY = 'arena_dupefinder_sets';
export const OFFENDERS_KEY = 'arena_dupefinder_offenders';

export const DEFAULT_DETECTORS = { sourceUrl: true, descriptionUrls: true, titleDesc: false, skipMarked: true };

function readJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); } catch { /* blocked storage: carry on unsaved */ }
}

export function loadSets(storage) {
  const sets = readJson(storage, SETS_KEY, {});
  return sets && typeof sets === 'object' && !Array.isArray(sets) ? sets : {};
}

// Saves (or overwrites) a named set. Returns the trimmed name, or null if the name is empty.
export function saveSet(storage, name, { channelIds, detectors = DEFAULT_DETECTORS }, now = new Date()) {
  const key = String(name || '').trim();
  if (!key) return null;
  const sets = loadSets(storage);
  sets[key] = { channelIds: [...channelIds], detectors: { ...detectors }, created_at: sets[key]?.created_at || now.toISOString(), last_run: sets[key]?.last_run || null };
  writeJson(storage, SETS_KEY, sets);
  return key;
}

export function deleteSet(storage, name) {
  const sets = loadSets(storage);
  delete sets[name];
  writeJson(storage, SETS_KEY, sets);
}

// Channels where duplicates turned up before, to pre-tick next time.
export function loadOffenders(storage) {
  const ids = readJson(storage, OFFENDERS_KEY, []);
  return Array.isArray(ids) ? ids : [];
}

export function addOffenders(storage, ids) {
  writeJson(storage, OFFENDERS_KEY, [...new Set([...loadOffenders(storage), ...ids])]);
}

// Drops ids for channels that no longer exist in `channels` (deleted, or not yours any more).
export function pruneIds(ids, channels) {
  const known = new Set(channels.map(c => c.id));
  return ids.filter(id => known.has(id));
}
