# arena-duplicate-finder: handoff notes

Agent-facing. Last updated 2026-10-22. Read `CLAUDE.md` and `AGENTS.md` first, then `_claude/arena-duplicate-finder-build-plan.md` (the original spec, kept local; this file records where the build has departed from it).

## State

All six steps are built and have been tried live by Kim against her test channels (`zz-test-channel`, `zz-test-channel-two`): Connect, Scope, Detect, Scan, Review (with live Resolve and Undo), Done. The one exception is Done, which is built but not yet tried by her. **Shipped 2026-10-22:** `docs/arena-duplicate-finder.html`, a card on `docs/index.html`, and a preview image (the Connect screen only; replace it with a Review screenshot). 267 tests green.

| Piece | Where |
|---|---|
| URL normaliser (`normaliseUrl`, `extractUrls`) | `shared/api/url-normalise.js` |
| Client: reads `getChannelContents`, `getUserContents`; writes `updateBlock`, `createConnection`, `deleteConnection` | `shared/api/arena-client.js` |
| Auth: `requireWrite` (write-scope check), `panel` (arena-merge-style Connect) | `shared/widgets/auth-step.js` |
| Multi-select channel picker, with optional **Refresh list** (`onRefresh`) | `shared/widgets/channel-picker.js` |
| Saved scan sets, offenders, pruning | `src/scan-sets.js` |
| Clustering (union-find; merges overlapping groups; honours `skipMarked`) | `src/clustering.js` |
| Scan: reads channels, records connection ids, builds clusters, pause/resume | `src/scan.js` |
| **Connections lookup** (per-block channels, total, own; unscanned places; `findConnectionId`) | `src/connections.js` |
| Review rules (defaults, keeper, edits, image facts, "looks different") | `src/review.js` |
| Review view (cards, three radios, details, dry-run section, shortcuts) | `src/review-view.js` |
| Resolve: plan, dry-run description, execute, undo | `src/resolve.js` |
| Orphans and undo history (localStorage) | `src/history.js` |
| Done: summary, orphan URLs, report JSON | `src/done.js` |
| Shell, stepper, step wiring | `src/app.js`, `src/index.html`, `src/styles.css` |
| (none: Checkbox, Radio, Progress, Toast and Notice are all in `shared/ui`) | |

## How it works (the parts that aren't obvious)

- **Scan is two phases.** (1) Read the chosen channels and group duplicates (records `{channel, connection.id}` for every block). (2) For every block in a group, `GET /blocks/{id}/connections` (one call for the total via `per=1`, then `filter=OWN` pages for your channels). Channels of yours the scan didn't read are added to each block's `places` with `unscanned: true` and no connection id.
- **Resolve** (per group, live or dry run). For each duplicate set to merge, in each of your channels it sits in: add the keeper if missing, then remove the duplicate's connection, then mark the duplicate. For unscanned places, the connection id is found only at that moment by paging the channel's contents (`findConnectionId`). The keeper is never removed from anywhere, and a duplicate is never removed from a channel if adding the keeper there failed.
- **Marking:** description gets `Duplicate of [id](https://www.are.na/block/id) — marked YYYY-MM-DD`, then `---`, then the original. Metadata: `dupe_of` (a **number**), `dupe_marked`, `dupe_tool`. Blocks you don't own (`can.manage` false) are unlinked from your channels but never edited, and are not listed as orphans.
- **Orphans** are duplicates left with no connection in your channels. They are listed on Done (and kept in `localStorage` `arena_dupefinder_orphans`); are.na has no block delete, so tidying is manual.
- **Undo** keeps the last 20 resolutions (`arena_dupefinder_undo`) and restores descriptions, metadata and connections.
- **Review card actions** are three radios: Keep this one / Leave unchanged / Merge connections and orphan (the default). On the keeper the other two are disabled; to move the keeper, keep another card.
- **Dry run** is on by default. Untick it and a confirm modal appears; the whole action section then gets a blue frame.
- **"May not be duplicates" note** appears when titles differ or aspect ratios differ by more than 2%. Advice only.

## Departures from the plan

- **Delete takes a connection id.** `DELETE /v3/connections/{id}`, not channel + block. `GET /blocks/{id}/connections` returns plain channels with no connection id; the id appears only as `connection.id` on `GET /channels/{id}/contents` items (and in `createConnection` results).
- **Create** is `POST /v3/connections` with `{connectable_id, connectable_type: 'Block', channels: [{id}]}`. `moveConnection` only reorders; not used.
- **`PUT /v3/blocks/{id}` is owner-only.** `PUT /v3/connections/{id}` exists but is not used.
- **`image.src` is are.na's own copy** (the URL contains the block id), so it can't identify duplicates. The only original address is `source.url`. `image.filename` is a file hash: shown as a hover hint, not used for matching.
- **Write-scope check** is `DELETE /connections/0` (403 = read-only, 404 = can write), as in arena-merge.
- **Source `.js` files are ES modules;** the build strips `import`/`export` and inlines everything into one global scope. Avoid top-level name clashes. macOS `sed` has no `\b`: use `perl -pi -e`.
- **Design:** `shared/ui` is the one design language. Warnings use two patterns taken from are.na: a navy **Toast** at bottom left (dismissable; now in `shared/ui`) and a pale inline `.atk-note` box. Red = private channel only; orange = warning.
- Naming: "connection" means only are.na's connection object. The token step is "Connect to are.na".

## Next

1. Kim to try the Done step and the unscanned-channel flow (e.g. blocks 39753062 and 39753053 with `teaching-tablescape` outside the scan).
2. Error paths: auth failures mid-run, missing permissions, 429 during Resolve.
3. Replace the preview jpg with a Review screenshot. After any change: `node arena-duplicate-finder/build.js --docs` (rule 5).
4. Later: keyboard shortcut polish, keyboard shortcut polish.

## Ideas for later

- **Orphanage channel.** When a keeper is chosen and the other blocks lose their connections, offer to move those connections to a channel called "orphanage" instead of just deleting them. That preserves the old blocks (and anything others have linked to them) in one findable place. Needs: find-or-create the channel (`createChannel`; add to `arena-client.js` after checking v3), then `createConnection` into it before `deleteConnection` from the originals. Off by default; surfaces beside the merge action and in the dry run. (Kim, 2026-10-21.)
- Connections other people made to a duplicate stay on it. The orphanage idea would help there too.

## Rules that bite

- Kim asks for a plan or approval before new files over ~50 lines or anything with several reasonable approaches; one short question at a time; British English; concise.
- `CLAUDE.md` rule 9: writing to are.na needs her go-ahead each time; bulk writes need a dry run or review step first. Live testing on one small cluster only.
- `CLAUDE.md` rule 8: `shared/ui/` mirrors the design-system artifact.
- Supporter tier: no `POST /blocks/batch`; single POSTs only.
- Commits end with the attribution lines from the session reminder.

## Housekeeping

- Untracked `_claude/` and `.claude/` are not part of this work. Don't sweep them into commits.
- Sources: <https://www.are.na/developers/explore/connection/connection>, `/channel/channel`, `/block/block`; spec at <https://api.are.na/v3/openapi.json>.
