// URL normaliser for spotting the same link saved twice. Pinterest- and Instagram-aware.
// Returns a comparison key (not a fetchable URL); unparseable input comes back unchanged.
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'igshid', 'ref', 'si', 'feature', 'mc_cid', 'mc_eid',
];

export function normaliseUrl(u) {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    TRACKING_PARAMS.forEach(k => url.searchParams.delete(k));

    if (host.endsWith('pinterest.com')) {
      const m = url.pathname.match(/^\/pin\/(\d+)/);
      if (m) return `pinterest.com/pin/${m[1]}`;
    }
    // Shortcodes are case-sensitive, so this returns before the final lowercase.
    if (host === 'instagram.com') {
      const m = url.pathname.match(/^\/p\/([^/]+)/);
      if (m) return `instagram.com/p/${m[1]}`;
    }
    return (host + url.pathname + url.search).replace(/\/$/, '').toLowerCase();
  } catch {
    return u;
  }
}

// Every http(s) URL in a piece of text, normalised. Trailing punctuation is trimmed,
// so "see https://x.com/a)." doesn't key differently from "https://x.com/a".
export function extractUrls(text) {
  if (!text) return [];
  return (text.match(/https?:\/\/\S+/gi) || []).map(raw => normaliseUrl(raw.replace(/[)\]>.,;:!?'"]+$/, '')));
}
