import { describe, it, expect, vi } from 'vitest';
import { isOwned, markDescription, planResolution, describePlan, executeResolution, undoResolution } from './resolve.js';
import { defaultDecision } from './review.js';

const NOW = new Date('2026-10-21T10:00:00Z');
const block = (id, extra = {}) => ({ id, type: 'Image', title: `T${id}`, description: { plain: `D${id}` }, image: { alt_text: '' }, ...extra });
const place = (channelId, connectionId, title = `Ch${channelId}`) => ({ channelId, channelSlug: `ch${channelId}`, channelTitle: title, connectionId });

// Keeper 1 sits in ch10; dupe 2 sits in ch10 (same channel) and ch20 (keeper not there).
function sample() {
  const cluster = {
    id: 'c', scope: 'cross', channelIds: [10, 20],
    blocks: [block(1), block(2)],
    places: { 1: [place(10, 101)], 2: [place(10, 201), place(20, 202)] },
  };
  return { cluster, decision: defaultDecision(cluster) };
}

describe('markDescription', () => {
  it('prepends the marker above the original, separated by a rule', () => {
    expect(markDescription('Linocut', 5, '2026-10-21')).toBe('Duplicate of [5](https://www.are.na/block/5) — marked 2026-10-21\n\n---\n\nLinocut');
  });
  it('is just the marker when there was no description', () => {
    expect(markDescription('', 5, '2026-10-21')).toBe('Duplicate of [5](https://www.are.na/block/5) — marked 2026-10-21');
  });
  it('replaces a marker from an earlier run instead of stacking', () => {
    const once = markDescription('Linocut', 5, '2026-10-01');
    expect(markDescription(once, 7, '2026-10-21')).toBe('Duplicate of [7](https://www.are.na/block/7) — marked 2026-10-21\n\n---\n\nLinocut');
  });
});

describe('planResolution', () => {
  it('adds the keeper only where it is missing, and removes every scanned connection of the duplicate', () => {
    const { cluster, decision } = sample();
    const plan = planResolution(cluster, decision, NOW);
    expect(plan.merges).toHaveLength(1);
    expect(plan.merges[0].channels.map(c => [c.channelId, c.addKeeper, c.connectionId])).toEqual([[10, false, 201], [20, true, 202]]);
    expect(plan.merges[0].metadata).toEqual({ dupe_of: 1, dupe_marked: '2026-10-21', dupe_tool: 'arena-duplicate-finder' });
    expect(plan.edit).toBeNull();
  });

  it('adds the keeper to a shared channel only once when several duplicates sit there', () => {
    const cluster = {
      id: 'c', blocks: [block(1), block(2), block(3)], channelIds: [20],
      places: { 1: [place(10, 101)], 2: [place(20, 202)], 3: [place(20, 303)] },
    };
    const plan = planResolution(cluster, defaultDecision(cluster), NOW);
    expect(plan.merges.flatMap(m => m.channels).filter(c => c.addKeeper)).toHaveLength(1);
  });

  it('skips duplicates set to leave alone', () => {
    const { cluster, decision } = sample();
    decision.actions[2] = 'leave';
    const plan = planResolution(cluster, decision, NOW);
    expect(plan.merges).toEqual([]);
    expect(describePlan(plan).lines[0]).toMatch(/Nothing to do/);
  });

  it('includes edits to the keeper', () => {
    const { cluster, decision } = sample();
    decision.edits.title = 'Better title';
    expect(planResolution(cluster, decision, NOW).edit).toEqual({ blockId: 1, fields: { title: 'Better title' } });
  });

  it('notes a connection with no id, which it cannot remove', () => {
    const { cluster, decision } = sample();
    cluster.places[2][0].connectionId = null;
    const plan = planResolution(cluster, decision, NOW);
    expect(plan.notes.join(' ')).toMatch(/no connection id/);
  });
});

describe('describePlan', () => {
  it('words the dry run as "Would …" and the log in the past tense', () => {
    const { cluster, decision } = sample();
    const plan = planResolution(cluster, decision, NOW);
    expect(describePlan(plan, { dryRun: true }).lines).toEqual([
      'Would remove block 2 from Ch10',
      'Would add block 1 to Ch20',
      'Would remove block 2 from Ch20',
      'Would mark block 2 as a duplicate of 1',
    ]);
    expect(describePlan(plan, { dryRun: false }).lines[0]).toBe('Remove block 2 from Ch10');
  });
});

function fakeClient(failOn = () => false) {
  const calls = [];
  const wrap = (name) => vi.fn(async (...args) => {
    calls.push([name, ...args]);
    if (failOn(name, args)) throw Object.assign(new Error('nope'), { status: 403 });
    return null;
  });
  return { calls, updateBlock: wrap('updateBlock'), createConnection: wrap('createConnection'), deleteConnection: wrap('deleteConnection') };
}

describe('executeResolution', () => {
  it('adds the keeper before removing the duplicate, then marks the duplicate', async () => {
    const { cluster, decision } = sample();
    const client = fakeClient();
    const out = await executeResolution(client, planResolution(cluster, decision, NOW));
    expect(client.calls.map(c => c[0])).toEqual(['deleteConnection', 'createConnection', 'deleteConnection', 'updateBlock']);
    expect(client.calls[1]).toEqual(['createConnection', { id: 1, channels: [20] }]);
    expect(client.calls[2]).toEqual(['deleteConnection', 202]);
    expect(out.failed).toEqual([]);
    expect(out.undo.dupes[0]).toMatchObject({ id: 2, marked: true, originalDescription: 'D2' });
    expect(out.undo.dupes[0].removedFrom.map(c => c.channelId)).toEqual([10, 20]);
  });

  it('never removes a duplicate from a channel if adding the keeper there failed', async () => {
    const { cluster, decision } = sample();
    const client = fakeClient(name => name === 'createConnection');
    const out = await executeResolution(client, planResolution(cluster, decision, NOW));
    expect(client.calls.some(c => c[0] === 'deleteConnection' && c[1] === 202)).toBe(false);
    expect(out.failed).toHaveLength(1);
    expect(out.undo.dupes[0].removedFrom.map(c => c.channelId)).toEqual([10]);
  });

  it('carries on after a failure and reports it', async () => {
    const { cluster, decision } = sample();
    const client = fakeClient((name, args) => name === 'updateBlock');
    const out = await executeResolution(client, planResolution(cluster, decision, NOW));
    expect(out.failed[0].message).toMatch(/Marked block 2 as a duplicate failed: nope/);
    expect(out.undo.dupes[0].marked).toBe(false);
  });

  it('sends the keeper edit first', async () => {
    const { cluster, decision } = sample();
    decision.edits.description = 'New';
    const client = fakeClient();
    await executeResolution(client, planResolution(cluster, decision, NOW));
    expect(client.calls[0]).toEqual(['updateBlock', 1, { description: 'New' }]);
  });
});

describe('undoResolution', () => {
  it('clears the mark, restores the description and reconnects', async () => {
    const client = fakeClient();
    const undo = { canonicalId: 1, dupes: [{ id: 2, originalDescription: 'D2', marked: true, removedFrom: [{ channelId: 10, channelTitle: 'Ch10' }] }] };
    const out = await undoResolution(client, undo);
    expect(client.calls[0]).toEqual(['updateBlock', 2, { metadata: { dupe_of: null, dupe_marked: null, dupe_tool: null }, description: 'D2' }]);
    expect(client.calls[1]).toEqual(['createConnection', { id: 2, channels: [10] }]);
    expect(out.failed).toEqual([]);
  });

  it('does not touch the description of a duplicate that was never marked, and reports failures', async () => {
    const client = fakeClient(name => name === 'createConnection');
    const undo = { canonicalId: 1, dupes: [{ id: 2, originalDescription: 'D2', marked: false, removedFrom: [{ channelId: 10, channelTitle: 'Ch10' }] }] };
    const out = await undoResolution(client, undo);
    expect(client.calls.map(c => c[0])).toEqual(['createConnection']);
    expect(out.failed[0].message).toMatch(/Couldn't reconnect block 2 to Ch10/);
  });
});

describe('blocks that belong to someone else', () => {
  const ME = 83324;
  const mine = (id) => block(id, { user: { id: ME, name: 'Kim Plowright' } });
  const theirs = (id) => block(id, { user: { id: 2380, name: 'Adam Lucas' } });

  it('isOwned says yes, no, or unknown', () => {
    expect(isOwned(mine(1), ME)).toBe(true);
    expect(isOwned(theirs(1), ME)).toBe(false);
    expect(isOwned(block(1), ME)).toBeNull();
    expect(isOwned(mine(1), null)).toBeNull();
  });

  function foreignDupe() {
    const cluster = { id: 'c', channelIds: [10], blocks: [mine(1), theirs(2)], places: { 1: [place(10, 101)], 2: [place(10, 201)] } };
    return { cluster, decision: defaultDecision(cluster) };
  }

  it('still removes their block from your channel, but does not try to mark it', async () => {
    const { cluster, decision } = foreignDupe();
    const plan = planResolution(cluster, decision, NOW, ME);
    expect(plan.merges[0].foreign).toBe(true);
    expect(plan.notes.join(' ')).toMatch(/belongs to Adam Lucas/);
    expect(describePlan(plan).lines).toEqual(['Would remove block 2 from Ch10']);
    const client = fakeClient();
    const out = await executeResolution(client, plan);
    expect(client.calls).toEqual([['deleteConnection', 201]]);
    expect(out.undo.dupes[0]).toMatchObject({ id: 2, foreign: true, marked: false });
  });

  it('does not edit a keeper that belongs to someone else', () => {
    const cluster = { id: 'c', channelIds: [10], blocks: [theirs(1), mine(2)], places: { 1: [place(10, 101)], 2: [place(10, 201)] } };
    const decision = defaultDecision(cluster);
    decision.edits.title = 'Changed';
    const plan = planResolution(cluster, decision, NOW, ME);
    expect(plan.edit).toBeNull();
    expect(plan.notes.join(' ')).toMatch(/can't be edited/);
  });
});
