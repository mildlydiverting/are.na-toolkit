// Escaping for text and addresses that go into HTML built as strings.
// escapeHtml: for text and for double-quoted attribute values.
// safeUrl: returns the address only if it is http or https, else ''.

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeUrl(url) {
  try {
    const u = new URL(String(url ?? '').trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}
