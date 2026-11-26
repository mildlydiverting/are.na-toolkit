import { describe, it, expect } from 'vitest';
import { planGridSlots, GRID_SIZE } from './grid.js';

const ch = { kind: 'channel' };
const bl = { kind: 'block' };

describe('planGridSlots', () => {
  it('gives one channel the whole grid', () => {
    expect(planGridSlots([ch])).toEqual([{ index: 0, kind: 'channel', count: GRID_SIZE }]);
  });

  it('shares slots evenly, earlier channels taking the extra', () => {
    const counts = planGridSlots([ch, ch, ch, ch]).map(s => s.count);
    expect(counts).toEqual([3, 3, 3, 3]);
    expect(planGridSlots([ch, ch, ch], 10).map(s => s.count)).toEqual([4, 3, 3]);
  });

  it('gives each block one slot and splits the rest between channels', () => {
    expect(planGridSlots([bl, ch, ch, bl]).map(s => [s.kind, s.count])).toEqual([['block', 1], ['channel', 5], ['channel', 5], ['block', 1]]);
  });

  it('plans only the block when that is all there is', () => {
    expect(planGridSlots([bl])).toEqual([{ index: 0, kind: 'block', count: 1 }]);
  });

  it('plans nothing for no sources', () => {
    expect(planGridSlots([])).toEqual([]);
  });
});
