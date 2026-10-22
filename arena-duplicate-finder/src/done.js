// The Done step: what a Review session changed, as numbers, a list of orphans, and a downloadable report.
import { tally } from './review.js';

const blockUrl = (id) => `https://www.are.na/block/${id}`;

// Counts for this scan only. `undoEntries` are the stored resolutions (see history.js); only those
// for clusters this scan resolved are counted, so older sessions and undone groups don't leak in.
export function summarise(items, decisions, undoEntries) {
  const groups = tally(items, decisions);
  const resolvedIds = new Set(items.filter(i => decisions[i.cluster.id]?.status === 'resolved').map(i => i.cluster.id));
  const entries = undoEntries.filter(e => resolvedIds.has(e.clusterId));
  let blocksMarked = 0, connectionsRemoved = 0, notYours = 0;
  for (const e of entries) {
    for (const d of e.dupes) {
      if (d.marked) blocksMarked++;
      connectionsRemoved += d.removedFrom?.length || 0;
      if (d.foreign) notYours++;
    }
  }
  const withProblems = items.filter(i => decisions[i.cluster.id]?.problems?.length).length;
  return { groups, blocksMarked, connectionsRemoved, notYours, withProblems };
}

// Orphans are blocks that lost every connection we could remove; listed for manual clean-up on are.na.
export function orphanUrls(orphans) {
  return orphans.map(o => blockUrl(o.id));
}

// The JSON for "Export scan report": settings, every group with its decision, and the totals.
export function buildReport({ now = new Date(), user, channels, detectors, items, decisions, summary, orphans }) {
  return {
    tool: 'arena-duplicate-finder',
    generated_at: now.toISOString(),
    user: user ? { id: user.id, slug: user.slug } : null,
    channels: channels.map(c => ({ id: c.id, slug: c.slug, title: c.title })),
    detectors,
    summary,
    groups: items.map(({ cluster, label }) => {
      const d = decisions[cluster.id];
      return {
        id: cluster.id,
        matched_on: label,
        status: d?.status || 'pending',
        canonical: d?.canonicalId ?? null,
        actions: d?.actions ?? null,
        problems: d?.problems ?? [],
        blocks: cluster.blocks.map(b => ({ id: b.id, url: blockUrl(b.id), title: b.title || null })),
      };
    }),
    orphans: orphans.map(o => ({ ...o, url: blockUrl(o.id) })),
  };
}
