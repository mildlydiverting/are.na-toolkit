// are.na v3 client. Endpoints checked against https://api.are.na/v3/openapi.json.
// Writes (updateBlock, createConnection, deleteConnection) need a token with write scope.
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

  // params go in the query string; opts.body (if any) is sent as JSON.
  async function request(path, params = {}, { method = 'GET', body = null } = {}) {
    const url = new URL(base + path);
    for (const [k, v] of Object.entries(params)) {
      if (v != null) url.searchParams.set(k, String(v));
    }
    const doFetch = () => fetchImpl(url.toString(), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
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
    // Every block/channel in a channel. Each item carries `connection.id`, which deleteConnection needs.
    // params: { type } filters to Text, Image, Link, Attachment, Embed, Channel or Block.
    getChannelContents: (idOrSlug, params = {}, opts = {}) => paginate(`/channels/${encodeURIComponent(idOrSlug)}/contents`, params, opts),

    // fields: any of title, description, alt_text (Image blocks), metadata (merged; null deletes a key).
    // Owner only.
    updateBlock: (id, fields) => request(`/blocks/${encodeURIComponent(id)}`, {}, { method: 'PUT', body: fields }),
    // Connects a block (or channel) into one or more channels. Resolves to the created Connection[].
    // channels: ids or slugs, or { id, position?, metadata? } objects.
    createConnection: async ({ id, type = 'Block', channels }) => {
      const res = await request('/connections', {}, {
        method: 'POST',
        body: {
          connectable_id: id,
          connectable_type: type,
          channels: channels.map(c => (typeof c === 'object' ? c : { id: c })),
        },
      });
      return res?.data || [];
    },
    // Takes the *connection* id (from a channel's contents, or createConnection), not a block id.
    // Removes the block from that channel only; the block itself stays. Resolves to null (204).
    deleteConnection: connectionId => request(`/connections/${encodeURIComponent(connectionId)}`, {}, { method: 'DELETE' }),
  };
}
