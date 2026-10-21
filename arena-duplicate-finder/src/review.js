// Review: the pure rules behind the cluster-at-a-time workspace. No DOM.
// A decision is { status: 'pending' | 'resolved' | 'skipped', canonicalId, actions: { [blockId]: 'merge' | 'leave' }, edits: { title, description, alt_text } }.
import { splitClusters } from './scan.js';

export const blockTitle = b => b.title || b.generated_title || `Block ${b.id}`;
export const blockDescription = b => b.description?.markdown ?? b.description?.plain ?? '';
export const blockAlt = b => b.image?.alt_text ?? '';
export const hasAlt = b => b.type === 'Image';

const FIELD_READERS = { title: b => b.title || '', description: blockDescription, alt_text: blockAlt };

function editsFor(block) {
  return { title: FIELD_READERS.title(block), description: FIELD_READERS.description(block), alt_text: FIELD_READERS.alt_text(block) };
}

// Oldest block is the default keeper (it usually has the most connections); the rest default to merge.
export function defaultDecision(cluster, canonicalId = cluster.blocks[0].id, actions = {}) {
  const canonical = cluster.blocks.find(b => b.id === canonicalId);
  return {
    status: 'pending',
    canonicalId,
    actions: Object.fromEntries(cluster.blocks.filter(b => b.id !== canonicalId).map(b => [b.id, actions[b.id] || 'merge'])),
    edits: editsFor(canonical),
  };
}

// Choosing a different keeper keeps the other per-block actions, and starts the edit fields from the new keeper.
export function chooseCanonical(cluster, decision, id) {
  if (id === decision.canonicalId) return decision;
  return { ...defaultDecision(cluster, id, decision.actions), status: decision.status === 'resolved' ? 'pending' : decision.status };
}

// Only the fields the person changed on the keeper: this is what an update would send.
export function changedFields(cluster, decision) {
  const canonical = cluster.blocks.find(b => b.id === decision.canonicalId);
  const out = {};
  for (const [field, read] of Object.entries(FIELD_READERS)) {
    if (field === 'alt_text' && !hasAlt(canonical)) continue;
    if ((decision.edits[field] ?? '') !== read(canonical)) out[field] = decision.edits[field] ?? '';
  }
  return out;
}

// Other blocks with a longer value for this field than the keeper's current text, to offer "copy from".
export function copyOptions(cluster, decision, field) {
  const read = FIELD_READERS[field];
  const current = (decision.edits[field] ?? '').trim();
  return cluster.blocks
    .filter(b => b.id !== decision.canonicalId)
    .map(b => ({ blockId: b.id, value: read(b) }))
    .filter(o => o.value.trim().length > current.length);
}

// Review order: single-channel clusters grouped by channel, then the cross-channel ones.
// Each item is { cluster, label } where label names the group.
export function orderClusters(clusters) {
  const { byChannel, cross } = splitClusters(clusters);
  const items = [];
  for (const g of byChannel) {
    const title = g.clusters[0].places[g.clusters[0].blocks[0].id]?.find(p => p.channelId === g.channelId)?.channelTitle || `Channel ${g.channelId}`;
    for (const cluster of g.clusters) items.push({ cluster, label: `In ${title}` });
  }
  for (const cluster of cross) items.push({ cluster, label: `Across ${cluster.channelIds.length} channels` });
  return items;
}

export function tally(items, decisions) {
  const t = { pending: 0, resolved: 0, skipped: 0 };
  for (const { cluster } of items) t[decisions[cluster.id]?.status || 'pending']++;
  return t;
}

// The nearest pending cluster after (dir = 1) or before (dir = -1) `from`, or null.
export function nextPending(items, decisions, from, dir = 1) {
  for (let i = from + dir; i >= 0 && i < items.length; i += dir) {
    if ((decisions[items[i].cluster.id]?.status || 'pending') === 'pending') return i;
  }
  return null;
}
