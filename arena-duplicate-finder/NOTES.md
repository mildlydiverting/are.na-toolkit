# arena-duplicate-finder: handoff notes

Agent-facing. Last updated 2026-10-21. Read `CLAUDE.md` and `AGENTS.md` first, then `_claude/arena-duplicate-finder-build-plan.md` (the full spec; this file records where the build has departed from it).

## State

Built and committed (`8a2262f` to `d0c5a16`), 144 tests green:

| Piece | Where |
|---|---|
| URL normaliser (`normaliseUrl`, `extractUrls`) | `shared/api/url-normalise.js` |
| Clustering (de-dupes by block id, honours `skipMarked`) | `src/clustering.js` |
| Client writes: `updateBlock`, `createConnection`, `deleteConnection`; reads: `getChannelContents`, `getUserContents` | `shared/api/arena-client.js` |
| Auth: `requireWrite` (write-scope check), `panel` (arena-merge-style Connect: remember checkbox, account chip, `loadDetail`) | `shared/widgets/auth-step.js` |
| Multi-select channel picker | `shared/widgets/channel-picker.js` |
| Saved scan sets, offenders, pruning | `src/scan-sets.js` |
| Shell, stepper rail, steps 1 (Connect) and 2 (Scope) | `src/app.js`, `src/index.html`, `src/styles.css` |

Kim has tried steps 1 and 2 against her real account and they work. Steps 3 to 6 are "Not built yet" placeholders in `app.js`.

## Next

1. Checkbox component, tool-local (`src/components/checkbox.{js,css}`, spec in plan §11). The Connect and picker checkboxes are plain browser ones for now.
2. Step 3 Detect: four options, explanation under each, "How URLs are compared" disclosure; save choices into the selected scan set (`DEFAULT_DETECTORS` in `scan-sets.js`).
3. Progress and Toast, then Step 4 Scan, Radio, Step 5 Review, Step 6 Done, Resolve, keyboard shortcuts, then ship (`docs/` copy, `docs/index.html` card, preview jpg, `AGENTS.md` update).

## Departures from the plan

- **Delete takes a connection id.** `DELETE /v3/connections/{id}`, not channel + block. `GET /blocks/{id}/connections` returns plain channels with no connection id. The id appears only as `connection.id` on items from `GET /channels/{id}/contents` (and in `createConnection` results). So **the Scan step must record `{block, channel, connection.id}`** while paginating. A duplicate sitting in an unscanned channel has no id: leave that connection alone and list it in the summary.
- **Create** is `POST /v3/connections` with `{connectable_id, connectable_type: 'Block', channels: [{id}]}` (up to 20 channels per call). `moveConnection` only reorders within a channel; it is not used.
- **`getChannelContents` is unverified against a live account.** The path and the `connection.id` field come from the OpenAPI schemas, which I couldn't read in full. Check on the first real scan.
- Source `.js` files are ES modules; the build strips `import`/`export` and inlines everything into one global scope. Avoid top-level name clashes (`node`, `statusRow`, `readJson`, `blockCount` already exist).
- Write-scope check is `DELETE /connections/0` (403 = read-only, 404 = can write), as in arena-merge.
- Design: `shared/ui` is the one design language. to-arena's styles match it; nothing to port.

## Rules that bite

- Kim asks for a plan or approval before new files over ~50 lines or anything with several reasonable approaches; one short question at a time; British English; concise.
- `CLAUDE.md` rule 9: writing to are.na needs her go-ahead each time, and bulk writes need a dry run or review step first. Resolve needs a dry-run toggle from the start, and live testing on one small cluster only.
- `CLAUDE.md` rule 8: `shared/ui/` mirrors the design-system artifact. If a component is promoted into `bundle.js`/`bundle.css`, change the artifact too.
- Supporter tier: no `POST /blocks/batch`; single POSTs only.
- Commits end with the attribution lines from the session reminder.

## Housekeeping

- Uncommitted `arena-palimpsest` edits (from another session) and untracked `_claude/`, `.claude/` are not part of this work. Don't sweep them into commits.
- Sources: <https://www.are.na/developers/explore/connection/connection>, `/channel/channel`, `/block/block`; spec at <https://api.are.na/v3/openapi.json>.
