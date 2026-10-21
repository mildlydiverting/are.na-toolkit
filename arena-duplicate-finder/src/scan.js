// Scan: read the chosen channels page by page, remember where every block sits (including the
// connection id that deleteConnection needs), and group the duplicates. No DOM.
import { clusterBlocks } from './clustering.js';

// Pause and resume for a running scan. The scan calls checkpoint() between requests.
export function createScanControl() {
  let paused = false;
  let release = null;
  return {
    pause() { paused = true; },
    resume() { paused = false; if (release) { release(); release = null; } },
    isPaused: () => paused,
    checkpoint() {
      return paused ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
    },
  };
}

const byAge = (a, b) => (a.created_at || '').localeCompare(b.created_at || '') || a.id - b.id;

// blocks: unique blocks; places: Map blockId -> [{ channelId, channelSlug, channelTitle, connectionId }]
// Returns clusters, each with its blocks oldest first (the usual best keeper), where they sit,
// and whether it lives in one channel ('single') or spans several ('cross').
export function buildClusters(blocks, places, detectors) {
  return clusterBlocks(blocks, detectors).map(group => {
    const sorted = [...group].sort(byAge);
    const channelIds = [...new Set(sorted.flatMap(b => (places.get(b.id) || []).map(p => p.channelId)))];
    return {
      id: `c-${sorted.map(b => b.id).join('-')}`,
      blocks: sorted,
      places: Object.fromEntries(sorted.map(b => [b.id, places.get(b.id) || []])),
      channelIds,
      scope: channelIds.length > 1 ? 'cross' : 'single',
    };
  });
}

// Single-channel clusters grouped by channel, then the ones that span channels.
export function splitClusters(clusters) {
  const byChannel = new Map();
  const cross = [];
  for (const c of clusters) {
    if (c.scope === 'cross') { cross.push(c); continue; }
    const id = c.channelIds[0];
    if (!byChannel.has(id)) byChannel.set(id, []);
    byChannel.get(id).push(c);
  }
  return { byChannel: [...byChannel].map(([channelId, list]) => ({ channelId, clusters: list })), cross };
}

// client: from createArenaClient(); channels: [{ id, slug, title }]; detectors: the Detect choices.
// onProgress({ channelIndex, channelCount, channelTitle, blocksFetched, clusterCount, channelDone }) is called after
// each page and again when a channel finishes (channelDone). clusterCount is only refreshed at the end of each channel.
// A channel that can't be read (403, 404) is skipped and reported; anything else (401, network) throws.
export async function scanChannels({ client, channels, detectors, control = createScanControl(), onProgress = () => {}, per = 100 }) {
  const blocks = new Map();
  const places = new Map();
  const skipped = [];
  let blocksFetched = 0;
  let clusterCount = 0;

  for (const [i, ch] of channels.entries()) {
    const title = ch.title || ch.slug;
    for (let page = 1; ; page++) {
      await control.checkpoint();
      let body;
      try {
        body = await client.request(`/channels/${encodeURIComponent(ch.id)}/contents`, { page, per });
      } catch (err) {
        if (err?.status === 403 || err?.status === 404) { skipped.push({ channel: ch, message: err.message }); break; }
        throw err;
      }
      for (const item of body?.data || []) {
        if (!item || item.id == null || item.type === 'Channel' || item.base_type === 'Channel') continue;
        blocksFetched++;
        if (!blocks.has(item.id)) blocks.set(item.id, item);
        if (!places.has(item.id)) places.set(item.id, []);
        places.get(item.id).push({ channelId: ch.id, channelSlug: ch.slug, channelTitle: title, connectionId: item.connection?.id ?? null });
      }
      onProgress({ channelIndex: i + 1, channelCount: channels.length, channelTitle: title, blocksFetched, clusterCount, channelDone: false });
      if (!body?.meta?.has_more_pages) break;
    }
    clusterCount = buildClusters([...blocks.values()], places, detectors).length;
    onProgress({ channelIndex: i + 1, channelCount: channels.length, channelTitle: title, blocksFetched, clusterCount, channelDone: true });
  }

  const clusters = buildClusters([...blocks.values()], places, detectors);
  return { clusters, blocksFetched, uniqueBlocks: blocks.size, skipped };
}
