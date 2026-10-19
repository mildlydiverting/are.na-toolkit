# arena-palimpsest: agent notes

Interim notes, written mid-build. Rewritten at ship. Plan: `_claude/arena-palimpsest-build-plan.md`.

## Status
Phases 0 to 4 done and committed (tooling, shared layer, scaffold, input and Block section, connected channels, polish). Phase 5 onwards: see the plan's §12.

## Decisions made during the build
- **Source files are ES modules** (so Vitest can import them). `scripts/include-resolver.js` strips `export` and `import … from` when inlining into classic `<script>` tags, so everything shares one global scope. Top-level names must be unique across included files. `export default` is refused.
- **No dev mode.** `node build.js --watch` rebuilds on save. `--docs` copies the build to `docs/`; only use it when shipping.
- **No Checkbox** in the design system, so the PAT is always remembered (`arena_toolkit_pat`) and Disconnect clears it.
- **auth-step is read-only.** Add a write-scope check when the first writing tool adopts it.
- **Errors** use a short alert `Badge` plus a plain sentence. Long text in a Badge is unreadable.
- **`?theme=light|dark|dawn|dusk`** forces a theme, for checking all four.

## API facts (checked against https://api.are.na/v3/openapi.json)
- Public reads work with no token. Guest limit is 30 requests a minute (free 120, premium 300, supporter 600).
- `GET /v3/blocks/{id}/connections` returns **channels** only. Verified live: the `connection` object (`id`, `position`, `pinned`, `metadata`, `connected_at`, `connected_by`) is **absent** from that response, despite the spec's schema. It only appears on items inside `GET /v3/channels/{id}/contents`.
- `channel.metadata` and `block.metadata` exist. `connection.metadata` exists but is only reachable through a channel's contents; a channel can hold 10,000+ items, so finding one block's connection means paging the lot. `GET /v3/connections/{id}` needs the connection id, which the block side never gives you.
- Block has no `generated_title`. Alt text is `image.alt_text`.

## Plan changes agreed with Kim
- **Sections 2 and 3 are merged** into one "Connected channels (n)" section, one `<details>` row per channel (fields plus channel metadata). A single note says connection details aren't exposed from a block's side. Per-channel connection lookup (paging a channel's contents) was left out; it could be a v1.1 opt-in button.
- The Block table has a "Connected to N channels" row, filled when the channels load. There is no "Generated title" row (the API has no such field) and there is a "Visibility" row.

## Testing
`npm test` runs Vitest. Visual checks: build, then open `dist/arena-palimpsest.html`, or screenshot with headless Chrome.

## v2 (editing)
Metadata and fields render through `kvTable()` as label/value rows with node values, so a value cell can be swapped for an `Input`.
