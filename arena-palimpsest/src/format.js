// Small pure helpers for turning API values into display values.

// "2024-03-15T10:30:00Z" -> "2024-03-15"; anything else -> ""
export function formatDate(iso) {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(iso || ''));
  return m ? m[1] : '';
}

// Metadata object (or null) -> [[key, display string], …] in the API's order.
export function metadataEntries(metadata) {
  if (!metadata || typeof metadata !== 'object') return [];
  return Object.entries(metadata).map(([k, v]) => [k, String(v)]);
}

// A value that is exactly one web address -> that address; anything else (other schemes, extra text) -> null.
export function webUrl(text) {
  const t = String(text ?? '').trim();
  if (!t || /\s/.test(t)) return null;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

// Embedded user -> "@slug", or "(unknown)" when the API gave us nothing.
export function userHandle(user) {
  return user?.slug ? `@${user.slug}` : '(unknown)';
}

export function userUrl(user) {
  return user?.slug ? `https://www.are.na/${encodeURIComponent(user.slug)}` : null;
}

export function blockUrl(id) {
  return `https://www.are.na/block/${id}`;
}

// Channel owners can be users or groups. Groups have no profile page we can link to safely.
export function ownerLabel(owner) {
  if (!owner) return '(unknown)';
  return owner.type === 'Group' ? `${owner.name || owner.slug} (group)` : userHandle(owner);
}

export function ownerUrl(owner) {
  return owner?.type === 'Group' ? null : userUrl(owner);
}

export function channelUrl(channel) {
  if (!channel?.slug) return null;
  const owner = channel.owner;
  return owner?.type !== 'Group' && owner?.slug
    ? `https://www.are.na/${encodeURIComponent(owner.slug)}/${encodeURIComponent(channel.slug)}`
    : `https://www.are.na/channel/${encodeURIComponent(channel.slug)}`;
}

// Compact count for a row: 169 -> "169", 1234 -> "1.2k", 10400 -> "10k", 2500000 -> "2.5m".
export function formatCount(n) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return '';
  const trim = (x) => String(Math.round(x * 10) / 10);
  if (n < 1000) return String(Math.round(n));
  if (n < 10000) return `${trim(n / 1000)}k`;
  if (n < 1000000) return `${Math.round(n / 1000)}k`;
  return `${trim(n / 1000000)}m`;
}

// Order for the connected-channels list. "recent"/"oldest" use the channel's created date.
// Anything else (including "default") keeps are.na's own order. Ties keep their original order.
export const CHANNEL_SORTS = [
  { value: 'default', label: 'Default order' },
  { value: 'recent', label: 'Most recent first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'blocks', label: 'Most blocks' },
  { value: 'metadata', label: 'Most metadata' },
];

export function sortChannels(channels, mode) {
  const time = (ch) => { const t = Date.parse(ch.created_at); return Number.isNaN(t) ? null : t; };
  const blocks = (ch) => ch.counts?.contents ?? ch.counts?.blocks ?? 0;
  const meta = (ch) => metadataEntries(ch.metadata).length;
  const byDate = (dir) => (a, b) => {
    const x = time(a), y = time(b);
    if (x === null && y === null) return 0;
    if (x === null) return 1; // undated channels go last either way
    if (y === null) return -1;
    return dir * (x - y);
  };
  const compare = {
    recent: byDate(-1),
    oldest: byDate(1),
    blocks: (a, b) => blocks(b) - blocks(a),
    metadata: (a, b) => meta(b) - meta(a),
  }[mode];
  return compare ? [...channels].sort(compare) : [...channels];
}
