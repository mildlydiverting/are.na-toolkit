// Read-only are.na v3 client. Endpoints checked against https://api.are.na/v3/openapi.json.
// Write methods are added by the first tool that needs them.
export const ARENA_API_BASE = 'https://api.are.na/v3';

export class ArenaError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = 'ArenaError';
    this.status = status;
    this.body = body;
  }
}

// throttle: the function from createThrottle(); omit in tests to call fetch directly.
export function createArenaClient({ token = null, fetchImpl = (...a) => globalThis.fetch(...a), throttle = null, base = ARENA_API_BASE } = {}) {
  let currentToken = token;

  async function request(path, params = {}) {
    const url = new URL(base + path);
    for (const [k, v] of Object.entries(params)) {
      if (v != null) url.searchParams.set(k, String(v));
    }
    const doFetch = () => fetchImpl(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    const res = throttle ? await throttle(doFetch) : await doFetch();

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }

    if (!res.ok) {
      const msg = data?.details?.message || data?.error || `are.na error ${res.status}`;
      throw new ArenaError(res.status, msg, data);
    }
    return data;
  }

  // Follows meta.has_more_pages and returns every item in `data`. onPage(items, meta) fires per page.
  async function paginate(path, params = {}, { per = 100, onPage = null } = {}) {
    const all = [];
    for (let page = 1; ; page++) {
      const body = await request(path, { ...params, page, per });
      const items = body?.data || [];
      all.push(...items);
      if (onPage) onPage(items, body?.meta);
      if (!body?.meta?.has_more_pages) return all;
    }
  }

  return {
    setToken(t) { currentToken = t || null; },
    request,
    paginate,
    getCurrentUser: () => request('/me'),
    getBlock: id => request(`/blocks/${encodeURIComponent(id)}`),
    getBlockConnections: (id, opts = {}) => paginate(`/blocks/${encodeURIComponent(id)}/connections`, {}, opts),
    getChannel: idOrSlug => request(`/channels/${encodeURIComponent(idOrSlug)}`),
  };
}
