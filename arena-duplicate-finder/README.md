# Duplicate finder

Finds blocks you've saved more than once, such as the same Pinterest or Instagram image imported again and again, across your are.na channels. For each group you choose the block to keep, and the finder moves everything onto it and tidies the rest.

## Using it

1. **Connect to are.na.** Paste a personal access token that can write.
2. **Scope.** Pick the channels to scan. Save the selection under a name to reuse it. **Refresh list** in the picker reloads your channels, for ones you've just made.
3. **Detect.** Choose how duplicates are spotted: same source address, an address in the description, or same title and description.
4. **Scan.** Reads the channels, then checks where each matching block is connected across all of are.na. This only reads.
5. **Review.** One group at a time. Each card shows the picture, owner, date, connection counts (total, yours, others), the channels it is in, and its source. Choose **Keep this one**, **Leave unchanged** or **Merge connections and orphan** for each block. You can edit the keeper's title, description and alt text. **Dry run** is on by default and shows what would happen without changing anything. Untick it to write to are.na, one group at a time. **Undo** takes the last resolution back.
6. **Done.** What changed, a list of orphaned blocks with **Copy all URLs**, a JSON report, and **Scan another set**.

## What Resolve does

For each block set to merge, in every channel of yours it sits in: the keeper is added to the channel if it isn't there, then the duplicate is removed from it, then the duplicate gets a "Duplicate of …" line in its description and `dupe_of` metadata. Nothing is ever deleted. Blocks owned by other people are removed from your channels but never edited. Connections other people have made to a duplicate stay on it.

A duplicate left in no channel of yours is an **orphan**. are.na has no way to delete a block through the API, so tidy those by hand from the Done list.

## Good to know

- Groups where the titles or picture shapes differ get a "may not be duplicates" note. Set such blocks to Leave unchanged.
- For channels you didn't scan, the finder reads the channel only when you resolve a group that touches it, which can take a while for a big channel.
- Your orphan list and undo history are kept in this browser only.

For the build, see `NOTES.md`. Build with `node arena-duplicate-finder/build.js`; tests with `npx vitest run`.
