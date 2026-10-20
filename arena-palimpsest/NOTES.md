# arena-palimpsest: agent notes

v1 shipped (read-only). Plan: `_claude/arena-palimpsest-build-plan.md`. User docs: `README.md`.

## Shape
- `src/index.html` is the shell with `@include` markers. `app.js` does fetch orchestration and rendering. `parse-input.js`, `format.js` and `history.js` are pure and tested. `styles.css` holds layout only; everything visual comes from `shared/ui/` (Arena Toolkit).
- Build: `node build.js` (`--watch`, `--docs`). `dist/arena-palimpsest.html` is committed; `--docs` copies it to `docs/`.
- `shared/ui/bundle.js` and `bundle.css` now differ from the design-system artifact by the ThemeChooser addition. Until it is published back, a re-sync of the artifact would overwrite it.
- Shared code used: `shared/ui/*`, `shared/api/arena-client.js` and `throttle.js`, `shared/widgets/auth-step.js`.

## Decisions made during the build
- **Source files are ES modules** (so Vitest can import them). `scripts/include-resolver.js` strips `export` and `import … from` when inlining into classic `<script>` tags, so all included files share one global scope: top-level names must be unique. `export default` is refused.
- **No dev mode.** `--watch` rebuilds on save.
- **No Checkbox** in the design system, so the PAT is always remembered (`arena_toolkit_pat`, shared across tools); Disconnect clears it.
- **auth-step is read-only.** Add a write-scope check when the first writing tool adopts it.
- **Errors** use a short alert `Badge` plus a plain sentence. Long text in a Badge is unreadable.
- **Theme chooser** is the `ArenaToolkit.ThemeChooser` component (palette button in the header). Precedence: `?theme=` (not saved) > saved choice (`arena_toolkit_theme`, shared across tools) > system. Docs and preview are in `shared/ui/ThemeChooser/`.
- **Header** is navigation only: breadcrumb "Are.na Tools / Are.na Palimpsest" on the left, Connect and the theme chooser on the right, no border. The page title and a one-line intro sit in `<main>`. The empty state is plain text, not a Card.
- **Main block** is a bordered frame (title + image) beside the text column. Border: public grey, private red, orphan dotted at 40%. Metadata sits in the same column and the `.kv` tables share one label width so values line up.
- **Channel rows** are coloured bars (grey closed, green public, red private; the ink and the open-state border follow the colour). Order: badge, name, block count, metadata-count badge, owner, caret. Open panel: heading bar tinted, body on the page colour, metadata (2fr) before channel data (3fr). Tints are 6% so green/red text stays near AA (public badge is 4.35:1 in Light).
- **Sort** (`CHANNEL_SORTS` / `sortChannels` in `format.js`): default, most recent, oldest, most blocks, most metadata. Dates are the channel's `created_at` (connection dates are not available). Rows are built once and re-ordered, so open panels stay open.
- **No card backgrounds** in this tool (`.palimpsest-main .atk-card`); `shared/ui` still has one.
- **Sections 2 and 3 of the plan are merged** into one "Connected channels (n)" section (see below).

## API facts (https://api.are.na/v3/openapi.json is the reliable reference)
- Public reads work with no token. Guest limit is 30 requests a minute (free 120, premium 300, supporter 600).
- `GET /v3/blocks/{id}/connections` returns **channels** only. Verified live: the `connection` object (`id`, `position`, `metadata`, `connected_at`, `connected_by`) is absent, despite the spec. It only appears on items in `GET /v3/channels/{id}/contents`, and a channel can hold 10,000+ items. So per-connection details can't be shown from a block's side.
- `block.metadata` and `channel.metadata` exist. Block has no `generated_title`; alt text is `image.alt_text`.
- Not yet checked in a browser: pagination over several pages, group-owned channels, the 401/403 block card, a live 429 banner.

## localStorage
`arena_toolkit_pat` and `arena_toolkit_theme` (shared), `arena_palimpsest_history` (10 entries, newest first), `arena_palimpsest_last_input`.

## Open items
- v1.1 ideas: JSON and Markdown export, channel URLs as input, an opt-in per-channel connection lookup.
- `docs/arena-palimpsest-preview.jpg` shows block 51566599 in the Light theme.

## v2 (editing)
Fields and metadata render through `kvTable()` as label/value rows whose values are nodes, so a value cell can become an `Input`. Needs write scope, an Inspect/Edit toggle, add/remove rows (set a key to `null` to remove it), a dry-run list of the calls, and owner-only editing (`block.can`). Metadata updates use `PUT /v3/blocks/{id}` and `PUT /v3/connections/{id}`, both with merge semantics.
