// What the tool has done, kept in localStorage so the Done step (and next time) can see it.
//   arena_dupefinder_orphans: blocks that lost their connections, for manual clean-up on are.na
//   arena_dupefinder_undo: the last 20 resolutions, with what undoResolution needs
export const ORPHANS_KEY = 'arena_dupefinder_orphans';
export const UNDO_KEY = 'arena_dupefinder_undo';
export const UNDO_LIMIT = 20;

function readList(storage, key) {
  try {
    const v = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeList(storage, key, list) {
  try { storage.setItem(key, JSON.stringify(list)); } catch { /* blocked or full: carry on unsaved */ }
}

export const loadOrphans = (storage) => readList(storage, ORPHANS_KEY);
export const loadUndo = (storage) => readList(storage, UNDO_KEY);

// Records the duplicates of one resolution. A block that is resolved again replaces its older entry.
export function addOrphans(storage, canonicalId, dupes, now = new Date()) {
  const ids = new Set(dupes.map(d => d.id));
  const kept = loadOrphans(storage).filter(o => !ids.has(o.id));
  const fresh = dupes.map(d => ({ id: d.id, canonical: canonicalId, resolved_at: now.toISOString(), channels_removed_from: d.removedFrom.map(c => c.channelTitle) }));
  writeList(storage, ORPHANS_KEY, [...kept, ...fresh]);
}

// When a resolution is undone, its duplicates are no longer orphans.
export function removeOrphans(storage, ids) {
  const gone = new Set(ids);
  writeList(storage, ORPHANS_KEY, loadOrphans(storage).filter(o => !gone.has(o.id)));
}

export function pushUndo(storage, entry) {
  writeList(storage, UNDO_KEY, [...loadUndo(storage), entry].slice(-UNDO_LIMIT));
}

export function dropUndo(storage, clusterId) {
  writeList(storage, UNDO_KEY, loadUndo(storage).filter(e => e.clusterId !== clusterId));
}
