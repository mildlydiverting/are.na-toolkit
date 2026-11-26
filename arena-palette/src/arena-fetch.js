// arena-fetch.js: are.na v3 channel reads — meta, block at page, random image blocks.
// Every request goes through a client from createArenaClient({ throttle }) (shared/api), which
// paces them 150 ms apart and backs off on 429.
import { ArenaError } from '../../shared/api/arena-client.js';

export const MAX_RETRIES = 12;
export const FETCH_RATE_LIMIT_MESSAGE = 'are.na is asking us to slow down. Wait a minute, then try again.';

// Keeps v1's wording. Rate limiting (still 429 after the throttle's backoffs) gets its own message.
function fetchFailure(err, fallback) {
  if (!(err instanceof ArenaError)) return err;
  if (err.status === 429) return Object.assign(new Error(FETCH_RATE_LIMIT_MESSAGE), { status: 429 });
  return Object.assign(new Error(err.body?.details?.message || fallback(err.status)), { status: err.status });
}

// ── ARE.NA API v3 ─────────────────────────────────────────────────────────────
export async function fetchChannelMeta(client, slug) {
  try {
    return await client.getChannel(slug);
  } catch (err) {
    throw fetchFailure(err, status => `Channel "${slug}" not found (${status})`);
  }
}

// One block by id (a block URL in the Source step). Palette needs an image block.
export async function fetchBlock(client, id) {
  let block;
  try {
    block = await client.getBlock(id);
  } catch (err) {
    throw fetchFailure(err, status => `Block ${id} not found (${status})`);
  }
  if (!block || block.type !== 'Image' || !block.image) throw new Error(`Block ${id} is not an image`);
  return block;
}

export async function fetchBlockAtPage(client, slug, page) {
  try {
    const data = await client.request(`/channels/${encodeURIComponent(slug)}/contents`, { per: 1, page });
    return data?.data?.[0] || null;
  } catch (err) {
    throw fetchFailure(err, status => `Fetch failed for "${slug}" page ${page} (${status})`);
  }
}

// The image shape the rest of palette uses (v1's, kept), from an are.na image block. `channel` is the
// slug the block came from, or '' for a block that was pasted directly.
export function imageFromBlock(block, channel = '') {
  return {
    url:         block.image.small?.src || block.image.src,
    original:    block.image.src,
    title:       block.title || '',
    description: block.description?.plain || block.description?.markdown || (typeof block.description === 'string' ? block.description : '') || '',
    channel,
    id:          block.id,
    blockUrl:    `https://www.are.na/block/${block.id}`,
    // Source info
    sourceUrl:   block.source?.url   || '',
    sourceTitle: block.source?.title || '',
    // User who added the block
    userName:    block.user?.full_name || block.user?.slug || '',
    userSlug:    block.user?.slug      || '',
    // Date
    createdAt:   block.created_at || '',
  };
}

// rng is injectable so tests can choose the pages. `meta` (a channel already fetched) saves a request;
// `exclude` is a Set of block ids not to return again (refreshing one slot).
export async function fetchChannelImages(client, slug, slotsNeeded, { rng = Math.random, meta: knownMeta = null, exclude = null } = {}) {
  const meta = knownMeta || await fetchChannelMeta(client, slug);
  const total = meta.counts?.contents ?? 0;
  if (!total) throw new Error(`Channel "${slug}" appears to be empty`);

  const results = [];
  const usedPages = new Set();

  for (let slot = 0; slot < slotsNeeded; slot++) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let page, tries = 0;
      do {
        page = Math.floor(rng() * total) + 1;
        tries++;
      } while (usedPages.has(page) && tries < 20);
      usedPages.add(page);

      const block = await fetchBlockAtPage(client, slug, page);
      if (block && block.type === 'Image' && block.image && !exclude?.has(block.id)) {
        results.push(imageFromBlock(block, slug));
        break;
      }
    }
  }

  if (!results.length) throw new Error(`No image blocks found in "${slug}" after ${MAX_RETRIES} attempts`);
  return results;
}
