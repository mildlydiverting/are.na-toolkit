// Pure clustering: group blocks that share a normalised URL (or, optionally, title + description).
import { normaliseUrl, extractUrls } from '../../shared/api/url-normalise.js';

export function keysForBlock(b, opts) {
  const keys = new Set();
  if (opts.sourceUrl && b.source?.url) keys.add(normaliseUrl(b.source.url));
  if (opts.descriptionUrls) extractUrls(b.description?.plain).forEach(k => keys.add(k));
  if (opts.titleDesc) {
    const t = (b.title || '').trim().toLowerCase();
    const d = (b.description?.plain || '').trim().toLowerCase().slice(0, 200);
    if (t.length > 3 && d.length > 10) keys.add(`td:${t}|${d}`);
  }
  return [...keys];
}

// Blocks sharing any key land in the same bucket; buckets of 2+ are clusters.
// A block connected into several channels appears once per channel in a scan, so de-dupe by id first.
// With opts.skipMarked, blocks already carrying metadata.dupe_of are left out.
export function clusterBlocks(blocks, opts) {
  const seen = new Set();
  const buckets = new Map();
  for (const b of blocks) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    if (opts.skipMarked && b.metadata?.dupe_of != null) continue;
    for (const k of keysForBlock(b, opts)) {
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(b);
    }
  }
  return [...buckets.values()].filter(cluster => cluster.length >= 2);
}
