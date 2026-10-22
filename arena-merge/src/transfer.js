import { planMerge, pluralBlocks, describeBlock, connectableType } from './helpers.js';

// The merge run itself. Takes an are.na client and reports through hooks, so it has no DOM and can be tested.

// Resolves to { added, skipped, failed, removed, statusChanged, cancelled }.
// source / dest: { id, slug, title, status }. contents: the source's items (each has .id and .connection.id).
// destIds: Set of block ids already in the destination.
// opts: { deleteFromSource, quietMode }.
// hooks: { onPhase(name), onProgress({value,max,label,detail}), onLog(tone,text), onCount(key,value), shouldCancel() }.
export async function runMerge({ client, source, dest, contents, destIds, opts = {}, dryRun = false, hooks = {} }) {
  const { onPhase = () => {}, onProgress = () => {}, onLog = () => {}, onCount = () => {}, shouldCancel = () => false } = hooks;
  const tag = dryRun ? '[dry run] ' : '';
  const result = { added: 0, skipped: 0, failed: 0, removed: 0, statusChanged: false, cancelled: false };

  const { toAdd, skipped } = planMerge(contents, destIds);
  result.skipped = skipped;
  onCount('total', contents.length);
  onCount('skipped', skipped);
  if (skipped) onLog('info', `${tag}${pluralBlocks(skipped)} already in "${dest.title}", skipping`);

  if (opts.quietMode && dest.status !== 'private') {
    onPhase('status');
    onLog('info', `${tag}Setting "${dest.title}" to private while the merge runs`);
    if (!dryRun) await client.updateChannel(dest.slug, { status: 'private' });
    result.statusChanged = true;
  }

  onPhase('copy');
  onProgress({ value: 0, max: toAdd.length, label: 'Copying blocks', detail: '' });
  for (let i = 0; i < toAdd.length; i++) {
    if (shouldCancel()) { result.cancelled = true; onLog('warn', 'Stopped before finishing'); break; }
    const item = toAdd[i];
    const name = describeBlock(item);
    try {
      if (!dryRun) {
        await client.request('/connections', {}, {
          method: 'POST',
          body: { connectable_id: item.id, connectable_type: connectableType(item), channel_ids: [dest.id] },
        });
      }
      result.added++;
      onCount('added', result.added);
      onLog('ok', `${tag}Added ${name}`);
      if (opts.deleteFromSource) {
        const connId = item.connection?.id;
        if (!connId) {
          onLog('warn', `${tag}Could not remove ${name} from "${source.title}": no connection id`);
        } else {
          if (!dryRun) await client.deleteConnection(connId);
          result.removed++;
          onCount('removed', result.removed);
          onLog('ok', `${tag}Removed ${name} from "${source.title}"`);
        }
      }
    } catch (err) {
      result.failed++;
      onCount('failed', result.failed);
      onLog('err', `${tag}${name}: ${err.message}`);
    }
    onProgress({ value: i + 1, max: toAdd.length, label: 'Copying blocks', detail: `${i + 1} of ${toAdd.length}` });
  }

  if (result.statusChanged) {
    onPhase('restore');
    onLog('info', `${tag}Setting "${dest.title}" back to ${dest.status}`);
    try {
      if (!dryRun) await client.updateChannel(dest.slug, { status: dest.status });
    } catch (err) {
      onLog('err', `Could not restore "${dest.title}" to ${dest.status}: ${err.message}. Please check it on are.na.`);
    }
  }

  onPhase('done');
  return result;
}
