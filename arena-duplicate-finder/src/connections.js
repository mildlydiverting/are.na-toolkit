// Where each block sits across all of are.na, not just the scanned channels. Read-only. No DOM.
//   GET /blocks/{id}/connections lists the channels (and a total), but gives no connection id;
//   an id is only found by reading a channel's contents, which resolve.js does at the last moment.

// total: every connection to the block, by anyone. own: the channels you connected it into.
// A failed lookup is stored as { error } so one bad block doesn't stop the rest.
export async function lookupBlockConnections(client, blockId, { per = 100 } = {}) {
  const path = `/blocks/${encodeURIComponent(blockId)}/connections`;
  const first = await client.request(path, { per: 1 });
  const total = first?.meta?.total_count ?? 0;
  const own = [];
  for (let page = 1; ; page++) {
    const body = await client.request(path, { filter: 'OWN', page, per });
    for (const ch of body?.data || []) own.push({ id: ch.id, slug: ch.slug, title: ch.title || ch.slug });
    if (!body?.meta?.has_more_pages) break;
  }
  return { total, own, others: Math.max(0, total - own.length) };
}

// blocks: the blocks in the groups. Returns Map blockId -> lookup result.
// onProgress({ done, count }) fires after each block; control.checkpoint() lets the scan pause between requests.
export async function lookupAll(client, blocks, { control = null, onProgress = () => {} } = {}) {
  const out = new Map();
  const unique = [...new Map(blocks.map(b => [b.id, b])).values()];
  for (const [i, b] of unique.entries()) {
    if (control) await control.checkpoint();
    try {
      out.set(b.id, await lookupBlockConnections(client, b.id));
    } catch (err) {
      if (err?.status === 401) throw err;
      out.set(b.id, { error: err?.message || 'lookup failed' });
    }
    onProgress({ done: i + 1, count: unique.length });
  }
  return out;
}

// Adds the channels you own that the scan didn't read to each group's `places`, flagged `unscanned`
// (no connection id yet). Returns new clusters; the originals are untouched.
export function addUnscannedPlaces(clusters, info) {
  return clusters.map(c => {
    const places = {};
    const channelIds = new Set(c.channelIds);
    for (const b of c.blocks) {
      const known = c.places[b.id] || [];
      const seen = new Set(known.map(p => p.channelId));
      const extra = (info.get(b.id)?.own || [])
        .filter(ch => !seen.has(ch.id))
        .map(ch => ({ channelId: ch.id, channelSlug: ch.slug, channelTitle: ch.title, connectionId: null, unscanned: true }));
      extra.forEach(p => channelIds.add(p.channelId));
      places[b.id] = [...known, ...extra];
    }
    return { ...c, places, channelIds: [...channelIds] };
  });
}

// Reads a channel's contents until the block turns up, and returns its connection id (null if it isn't there).
export async function findConnectionId(client, channelId, blockId, { per = 100 } = {}) {
  for (let page = 1; ; page++) {
    const body = await client.request(`/channels/${encodeURIComponent(channelId)}/contents`, { page, per });
    const hit = (body?.data || []).find(item => item?.id === blockId && item.type !== 'Channel' && item.base_type !== 'Channel');
    if (hit) return hit.connection?.id ?? null;
    if (!body?.meta?.has_more_pages) return null;
  }
}

// "7 in total: 2 yours, 5 by others", or a stand-in while it's unknown.
export function connectionSummary(info) {
  if (!info) return '…';
  if (info.error) return '?';
  const { total, own, others } = info;
  return `${total} in total: ${own.length} yours, ${others} by others`;
}
