// arena-fetch.js: are.na v3 channel reads — meta, block at page, random image blocks.

// Are.na API v3 — https://www.are.na/developers/explore
export const API_BASE = 'https://api.are.na/v3';
export const MAX_RETRIES = 12;

// ── ARE.NA API v3 ─────────────────────────────────────────────────────────────
export async function fetchChannelMeta(slug, headers) {
  const res = await fetch(`${API_BASE}/channels/${encodeURIComponent(slug)}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.details?.message || `Channel "${slug}" not found (${res.status})`);
  }
  return res.json();
}

export async function fetchBlockAtPage(slug, page, headers) {
  const res = await fetch(
    `${API_BASE}/channels/${encodeURIComponent(slug)}/contents?per=1&page=${page}`,
    { headers }
  );
  if (!res.ok) throw new Error(`Fetch failed for "${slug}" page ${page} (${res.status})`);
  const data = await res.json();
  return data.data?.[0] || null;
}

export async function fetchChannelImages(slug, token, slotsNeeded) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const meta = await fetchChannelMeta(slug, headers);
  const total = meta.counts?.contents ?? 0;
  if (!total) throw new Error(`Channel "${slug}" appears to be empty`);

  const results = [];
  const usedPages = new Set();

  for (let slot = 0; slot < slotsNeeded; slot++) {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let page, tries = 0;
      do {
        page = Math.floor(Math.random() * total) + 1;
        tries++;
      } while (usedPages.has(page) && tries < 20);
      usedPages.add(page);

      const block = await fetchBlockAtPage(slug, page, headers);
      if (block && block.type === 'Image' && block.image) {
        results.push({
          url:         block.image.small?.src || block.image.src,
          original:    block.image.src,
          title:       block.title || '',
          description: block.description?.plain || block.description?.markdown || (typeof block.description === 'string' ? block.description : '') || '',
          channel:     slug,
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
        });
        break;
      }
    }
  }

  if (!results.length) throw new Error(`No image blocks found in "${slug}" after ${MAX_RETRIES} attempts`);
  return results;
}
