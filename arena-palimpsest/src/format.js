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
