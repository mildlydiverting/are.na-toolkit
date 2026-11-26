// parse-input.js: channel slug from a pasted are.na URL (pure).

// Extract slug from a full are.na URL, e.g. https://www.are.na/user/channel-slug → channel-slug
export function parseArenaSlug(val) {
  const match = val.match(/are\.na\/[^/?#\s]+\/([^/?#\s]+)/);
  return match ? match[1] : val;
}

// What one Source row holds: a channel slug, a channel URL or a block URL (pure).
// → { kind: 'empty' } | { kind: 'channel', slug } | { kind: 'block', id } | { kind: 'invalid' }
// A bare number is a block id (are.na channel slugs always carry a suffix). Block URLs are checked
// first, because /block/123 would otherwise look like a /<user>/<channel> path.
export function parseSourceInput(raw) {
  const s = raw == null ? '' : String(raw).trim();
  if (!s) return { kind: 'empty' };
  if (/^\d+$/.test(s)) return blockResult(s);

  if (/are\.na\//i.test(s)) {
    try {
      const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
      if (/^(www\.)?are\.na$/i.test(url.hostname)) {
        const block = url.pathname.match(/^\/block\/(\d+)\/?$/);
        if (block) return blockResult(block[1]);
        if (/^\/block(\/|$)/.test(url.pathname)) return { kind: 'invalid' };   // /block/<not an id> is not a user's channel
        const channel = url.pathname.match(/^\/[^/]+\/([^/]+)\/?$/);
        if (channel) return { kind: 'channel', slug: channel[1] };
      }
    } catch { /* fall through to invalid */ }
    return { kind: 'invalid' };
  }

  return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(s) ? { kind: 'channel', slug: s } : { kind: 'invalid' };
}

function blockResult(digits) {
  const id = parseInt(digits, 10);
  return Number.isSafeInteger(id) && id > 0 ? { kind: 'block', id } : { kind: 'invalid' };
}
