// Pure helpers for arena-merge: no DOM, no network.

// A slug, or a full channel URL like https://www.are.na/user/channel-slug, to just the slug.
export function parseSlug(input) {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^https?:\/\/(?:www\.)?are\.na\/[^/]+\/([^/?#]+)/i);
  if (m) return decodeURIComponent(m[1]);
  return trimmed;
}

export function pluralBlocks(n) {
  return `${n} block${n === 1 ? '' : 's'}`;
}

export function truncate(s, n) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// v3 image objects use `.src` (not v2's `.url`); square first because the tiles are square.
export function thumbSrc(item) {
  return item?.image?.square?.src || item?.image?.small?.src || item?.image?.medium?.src
    || item?.embed?.thumbnail_url || null;
}

// What a thumbnail tile shows when there is no picture: a short text label.
export function thumbLabel(item) {
  if (!item) return 'block';
  if (item.class === 'Link') return truncate(item.title || item.source?.url || 'link', 24);
  if (item.class === 'Text') {
    const text = item.content?.plain || (typeof item.content === 'string' ? item.content : '') || 'text';
    return truncate(text, 40);
  }
  if (item.class === 'Channel' || item.type === 'Channel') return `↳ ${truncate(item.title || 'channel', 24)}`;
  return item.class || item.type || 'block';
}

// 'Image "sunset.jpg"' / 'Text #6', for log lines.
export function describeBlock(item) {
  const kind = item.class || item.type || 'block';
  const text = item.content?.plain ?? (typeof item.content === 'string' ? item.content : '');
  const title = item.title || item.generated_title || text?.slice(0, 40) || '';
  return title ? `${kind} "${truncate(title, 40)}"` : `${kind} #${item.id}`;
}

// A channel dropped into another channel is connected as a Channel; everything else as a Block.
export function connectableType(item) {
  return (item.type === 'Channel' || item.class === 'Channel') ? 'Channel' : 'Block';
}

// existingIds: a Set of block ids already in the destination. Returns what a merge would add and skip.
export function planMerge(sourceContents, existingIds) {
  const toAdd = sourceContents.filter(it => !existingIds.has(it.id));
  return { toAdd, skipped: sourceContents.length - toAdd.length };
}

// The plain-language summary lines for the Transfer step, as data the view turns into text.
export function summaryLines({ toAdd, skipped, sourceTitle, destTitle, deleteFromSource, quietMode, destStatus }) {
  const lines = [{ kind: 'add', toAdd, sourceTitle, destTitle }];
  if (skipped > 0) lines.push({ kind: 'skip', skipped });
  if (deleteFromSource) lines.push({ kind: 'remove', sourceTitle });
  if (quietMode && destStatus !== 'private') lines.push({ kind: 'quiet', destStatus });
  return lines;
}
