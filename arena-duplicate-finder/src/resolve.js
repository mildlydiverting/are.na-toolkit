// Resolve: turn a decision into are.na writes, run them, and be able to take them back. No DOM.
// For a keeper C and each duplicate D set to "merge":
//   1. (once) edit C if its details were changed
//   2. for each channel D sits in: add C there if it isn't already, then remove D's connection
//   3. mark D: metadata dupe_of / dupe_marked / dupe_tool, and a "Duplicate of …" line on its description
// D is never deleted (are.na has no block delete); once unconnected it becomes an orphan.
// Blocks that belong to someone else can't be edited or marked (the API refuses), so they are only unconnected
// from your channels. Everything written is on the blocks themselves, not on the connections.
import { changedFields, blockTitle } from './review.js';
import { findConnectionId } from './connections.js';

export const DUPE_TOOL = 'arena-duplicate-finder';
const MARKER = /^Duplicate of \[[^\]]*\]\([^)]*\)[^\n]*(\n\s*\n---\s*\n\s*\n?)?/;

// Prepends the "Duplicate of" line, replacing one left by an earlier run rather than stacking.
export function markDescription(original, canonicalId, date) {
  const line = `Duplicate of [${canonicalId}](https://www.are.na/block/${canonicalId}) — marked ${date}`;
  const rest = String(original || '').replace(MARKER, '');
  return rest.trim() ? `${line}\n\n---\n\n${rest}` : line;
}

export const dupeMetadata = (canonicalId, date) => ({ dupe_of: canonicalId, dupe_marked: date, dupe_tool: DUPE_TOOL });
export const clearedDupeMetadata = () => ({ dupe_of: null, dupe_marked: null, dupe_tool: null });

const isoDay = (now) => now.toISOString().slice(0, 10);

// Only a block's owner can change it (PUT /blocks/{id}). The user on a scanned block tells us whose it is:
// true / false, or null when the scan didn't say (then we try, and a 403 is reported as a problem).
export function isOwned(block, myUserId) {
  if (myUserId == null || block?.user?.id == null) return null;
  return block.user.id === myUserId;
}
export const ownerName = (block) => block?.user?.name || block?.user?.username || 'someone else';

// Pure: what would be done for this cluster. Nothing here touches the network.
// `connections` (optional): Map blockId -> lookup result from connections.js, used for the notes about other people's connections.
export function planResolution(cluster, decision, now = new Date(), myUserId = null, connections = null) {
  const date = isoDay(now);
  const canonicalId = decision.canonicalId;
  const canonical = cluster.blocks.find(b => b.id === canonicalId);
  const keeperChannels = new Set((cluster.places[canonicalId] || []).map(p => p.channelId));
  const keeperOwned = isOwned(canonical, myUserId) !== false;
  const fields = keeperOwned ? changedFields(cluster, decision) : {};
  const notes = [];
  if (!keeperOwned) notes.push(`Block ${canonicalId} belongs to ${ownerName(canonical)}, so its details can't be edited.`);
  const merges = [];

  for (const b of cluster.blocks) {
    if (b.id === canonicalId || decision.actions[b.id] !== 'merge') continue;
    const channels = [];
    for (const p of cluster.places[b.id] || []) {
      const addKeeper = !keeperChannels.has(p.channelId);
      if (addKeeper) keeperChannels.add(p.channelId); // the first duplicate in a channel adds the keeper; later ones needn't
      if (p.connectionId == null && !p.unscanned) notes.push(`Block ${b.id} in ${p.channelTitle} has no connection id, so it stays connected there.`);
      channels.push({ ...p, addKeeper });
    }
    const foreign = isOwned(b, myUserId) === false;
    if (foreign) notes.push(`Block ${b.id} belongs to ${ownerName(b)}: it can't be marked as a duplicate, only removed from your channels. It is not deleted or changed.`);
    const others = connections?.get(b.id)?.others || 0;
    if (others) notes.push(`Block ${b.id} is also connected ${others} time${others === 1 ? '' : 's'} by other people. Those connections stay on it.`);
    merges.push({
      blockId: b.id,
      title: blockTitle(b),
      foreign,
      channels,
      originalDescription: b.description?.markdown ?? b.description?.plain ?? '',
      metadata: dupeMetadata(canonicalId, date),
      description: markDescription(b.description?.markdown ?? b.description?.plain ?? '', canonicalId, date),
    });
  }

  return { canonicalId, canonicalTitle: blockTitle(canonical), edit: Object.keys(fields).length ? { blockId: canonicalId, fields } : null, merges, notes };
}

// Plain-language lines for the dry run and the log.
export function describePlan(plan, { dryRun = true } = {}) {
  const say = (s) => (dryRun ? `Would ${s}` : s[0].toUpperCase() + s.slice(1));
  const lines = [];
  if (plan.edit) lines.push(say(`update block ${plan.edit.blockId}: ${Object.keys(plan.edit.fields).join(', ')}`));
  for (const m of plan.merges) {
    for (const c of m.channels) {
      if (c.addKeeper) lines.push(say(`add block ${plan.canonicalId} to ${c.channelTitle}`));
      if (c.connectionId != null || c.unscanned) lines.push(say(`remove block ${m.blockId} from ${c.channelTitle}${c.unscanned ? ' (not in your scan, so it will be looked up)' : ''}`));
    }
    if (!m.foreign) lines.push(say(`mark block ${m.blockId} as a duplicate of ${plan.canonicalId}`));
  }
  if (!plan.edit && !plan.merges.length) lines.push(dryRun ? 'Nothing to do: every other block is set to "Leave unchanged".' : 'Nothing to do.');
  return { lines, notes: plan.notes };
}

// Runs the plan. Each step is tried on its own: a failure is recorded and the rest carries on, except that a
// duplicate is never removed from a channel unless the keeper is (or already was) in it.
// Returns { done: [line], failed: [{ message }], undo } where undo is what undoResolution needs.
export async function executeResolution(client, plan, { onStep = () => {} } = {}) {
  const done = [];
  const failed = [];
  const undo = { canonicalId: plan.canonicalId, dupes: [] };
  const attempt = async (label, fn) => {
    try { await fn(); done.push(label); onStep(label); return true; }
    catch (err) { failed.push({ message: `${label} failed: ${err?.message || err}` }); return false; }
  };

  if (plan.edit) await attempt(`Updated block ${plan.edit.blockId}`, () => client.updateBlock(plan.edit.blockId, plan.edit.fields));

  for (const m of plan.merges) {
    const record = { id: m.blockId, foreign: m.foreign, originalDescription: m.originalDescription, removedFrom: [], marked: false };
    for (const c of m.channels) {
      let ok = true;
      if (c.addKeeper) ok = await attempt(`Added block ${plan.canonicalId} to ${c.channelTitle}`, () => client.createConnection({ id: plan.canonicalId, channels: [c.channelId] }));
      let connectionId = c.connectionId;
      if (ok && connectionId == null && c.unscanned) {
        try { connectionId = await findConnectionId(client, c.channelId, m.blockId); }
        catch (err) { failed.push({ message: `Looking for block ${m.blockId} in ${c.channelTitle} failed: ${err?.message || err}` }); }
        if (connectionId == null) failed.push({ message: `Couldn't find block ${m.blockId} in ${c.channelTitle}, so it stays connected there.` });
      }
      if (ok && connectionId != null) {
        const removed = await attempt(`Removed block ${m.blockId} from ${c.channelTitle}`, () => client.deleteConnection(connectionId));
        if (removed) record.removedFrom.push({ channelId: c.channelId, channelTitle: c.channelTitle });
      }
    }
    if (!m.foreign) record.marked = await attempt(`Marked block ${m.blockId} as a duplicate`, () => client.updateBlock(m.blockId, { metadata: m.metadata, description: m.description }));
    undo.dupes.push(record);
  }
  return { done, failed, undo };
}

// Takes back the duplicates' side of a resolution: clears the mark, restores the description, reconnects.
// The keeper keeps any connections it gained, and any edits (we can't know it wasn't already in a channel).
export async function undoResolution(client, undo) {
  const failed = [];
  for (const d of undo.dupes) {
    if (d.marked) {
      try { await client.updateBlock(d.id, { metadata: clearedDupeMetadata(), description: d.originalDescription }); }
      catch (err) { failed.push({ message: `Couldn't clear the mark on block ${d.id}: ${err?.message || err}` }); }
    }
    for (const c of d.removedFrom) {
      try { await client.createConnection({ id: d.id, channels: [c.channelId] }); }
      catch (err) { failed.push({ message: `Couldn't reconnect block ${d.id} to ${c.channelTitle}: ${err?.message || err}` }); }
    }
  }
  return { failed };
}
