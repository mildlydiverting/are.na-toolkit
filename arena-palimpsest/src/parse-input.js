// Turns what the user pasted into a block id, or null if it isn't one.
// Accepts a bare id or an are.na block URL (with or without scheme, www, trailing slash, query or anchor).
export function parseBlockInput(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return toId(s);
  try {
    const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!/^(www\.)?are\.na$/i.test(url.hostname)) return null;
    const m = url.pathname.match(/^\/block\/(\d+)\/?$/);
    if (m) return toId(m[1]);
  } catch { /* not a URL */ }
  return null;
}

function toId(digits) {
  const n = parseInt(digits, 10);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
