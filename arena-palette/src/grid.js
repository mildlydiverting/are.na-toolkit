// grid.js: how the 12-image grid is shared out between sources (pure).

export const GRID_SIZE = 12;

// `sources` are the resolved ones, in order. A block source takes one slot; channel sources share what is
// left evenly, earlier ones getting the extra. → [{ index, kind, count }] (index into `sources`).
export function planGridSlots(sources, size = GRID_SIZE) {
  const blocks = sources.filter(s => s.kind === 'block').length;
  const channels = sources.length - blocks;
  const spare = Math.max(size - blocks, 0);
  const base = channels ? Math.floor(spare / channels) : 0;
  const extra = channels ? spare % channels : 0;
  let seen = 0;
  return sources.map((s, index) => {
    if (s.kind === 'block') return { index, kind: 'block', count: 1 };
    const count = base + (seen < extra ? 1 : 0);
    seen++;
    return { index, kind: 'channel', count };
  }).filter(slot => slot.count > 0);
}
