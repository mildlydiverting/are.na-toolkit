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

  const { skipped } = planMerge(contents, destIds);
  result.skipped = skipped;
  onCount('total', contents.length);
  onCount('skipped', skipped);
  if (skipped) onLog('info', `${tag}${pluralBlocks(skipped)} already in "${dest.title}": not copied again${opts.deleteFromSource ? ', but still removed from the source' : ''}`);

  if (opts.quietMode && dest.status !== 'private') {
    onPhase('status');
    onLog('info', `${tag}Setting "${dest.title}" to private while the merge runs`);
    try {
      if (!dryRun) await client.updateChannel(dest.slug, { status: 'private' });
      result.statusChanged = true;
    } catch (err) {
      onLog('err', `Couldn't set "${dest.title}" to private: ${err.message}. Carrying on without quiet mode, so followers may be notified.`);
    }
  }

  onPhase('copy');
  const total = contents.length;
  onProgress({ value: 0, max: total, label: 'Copying blocks', detail: '' });

  // Takes the block out of the source (when asked). Runs for added blocks and for ones already in the destination.
  async function removeFromSource(item, name) {
    const connId = item.connection?.id;
    if (!connId) {
      result.failed++;
      onCount('failed', result.failed);
      onLog('err', `${tag}Can't remove ${name} from "${source.title}": no connection id`);
      return;
    }
    if (!dryRun) await client.deleteConnection(connId);
    result.removed++;
    onCount('removed', result.removed);
    onLog('ok', `${tag}Removed ${name} from "${source.title}"`);
  }

  for (let i = 0; i < total; i++) {
    if (shouldCancel()) { result.cancelled = true; onLog('warn', 'Stopped before finishing'); break; }
    const item = contents[i];
    const name = describeBlock(item);
    try {
      let there = destIds.has(item.id);
      if (!there) {
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
        } catch (err) {
          // 422: are.na says it is already connected there (the destination changed since we read it).
          if (err.status !== 422) throw err;
          there = true;
        }
      }
      if (there && !destIds.has(item.id)) {
        result.skipped++;
        onCount('skipped', result.skipped);
        onLog('info', `${tag}Already in "${dest.title}": ${name}`);
      }
      if (opts.deleteFromSource) await removeFromSource(item, name);
    } catch (err) {
      result.failed++;
      onCount('failed', result.failed);
      onLog('err', `${tag}${name}: ${err.message}`);
    }
    onProgress({ value: i + 1, max: total, label: 'Copying blocks', detail: `${i + 1} of ${total}` });
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
