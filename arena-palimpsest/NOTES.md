# arena-palimpsest: agent notes

v1 shipped (read-only). Plan: `_claude/arena-palimpsest-build-plan.md`. User docs: `README.md`.

## Shape
- `src/index.html` is the shell with `@include` markers. `app.js` does fetch orchestration and rendering. `parse-input.js`, `format.js` and `history.js` are pure and tested. `styles.css` holds layout only; everything visual comes from `shared/ui/` (Arena Toolkit).
- Build: `node build.js` (`--watch`, `--docs`). `dist/arena-palimpsest.html` is committed; `--docs` copies it to `docs/`.
- `shared/ui/bundle.js` and `bundle.css` match the design-system artifact (published 2026-10-20: ThemeChooser with System, ConnectionListInfo and ConnectionList with their tokens, unfilled Card). Change the artifact and the toolkit together, or a re-sync will overwrite the difference.
- **Not yet in the artifact (21 Oct 2026):** `StatusMessage`, `AccountMenu` and `AuthPanel` (new in `bundle.js`/`bundle.css`, with READMEs and previews here). Until they are published, `bundle.js` and `bundle.css` are ahead of the artifact: a re-sync from it would remove them. Publish with the steps in `shared/ui/README.md`; still needed: `index.d.ts` for each.
- Shared code used: `shared/ui/*`, `shared/api/arena-client.js` and `throttle.js`, `shared/widgets/auth-step.js`.

## Decisions made during the build
- **Source files are ES modules** (so Vitest can import them). `scripts/include-resolver.js` strips `export` and `import … from` when inlining into classic `<script>` tags, so all included files share one global scope: top-level names must be unique. `export default` is refused.
- **No dev mode.** `--watch` rebuilds on save.
- **No Checkbox** in the design system, so the PAT is always remembered (`arena_toolkit_pat`, shared across tools); Disconnect clears it.
- **auth-step is read-only.** Add a write-scope check when the first writing tool adopts it.
- **Errors** use a short alert `Badge` plus a plain sentence. Long text in a Badge is unreadable.
- **Theme chooser** is the `ArenaToolkit.ThemeChooser` component (palette button in the header): Light, Dusk, Dark, Dawn, then System (the default; follows the OS live). Precedence: `?theme=` (not saved) > saved choice (`arena_toolkit_theme`, shared across tools; `'system'` when System is chosen) > System. Docs and preview are in `shared/ui/ThemeChooser/`.
- **Header** is navigation only: breadcrumb "Are.na Tools / Are.na Palimpsest" on the left, Connect and the theme chooser on the right, no border. The page title and a one-line intro sit in `<main>`. The empty state is plain text, not a Card.
- **Main block** is a bordered frame (title + image) beside the text column. Border: public grey, private red, orphan dotted at 40%. Metadata sits in the same column and the `.kv` tables share one label width so values line up.
- **Channel rows** are the shared `ConnectionListInfo` and `ConnectionList` components (docs in `shared/ui/ConnectionListInfo/` and `shared/ui/ConnectionList/`). Colour follows visibility; the open panel is metadata (2fr) then data (3fr). Fills are are.na's own (`channel-bar-*` tokens = channelPublic1/Private1, closed = `surface-card`; `channel-badge-*` sampled), verified against all four themes. Contrast is are.na's, not ours to fix: see the table in `shared/ui/ConnectionListInfo/README.md`.
- **URL values are links:** any metadata or field value that is exactly one http(s) address becomes a link (`webUrl()` in `format.js`, applied in `valueNode()`).
- **Sort** (`CHANNEL_SORTS` / `sortChannels` in `format.js`): default, most recent, oldest, most blocks, most metadata. Dates are the channel's `created_at` (connection dates are not available). Rows are built once and re-ordered with `list.setRows()`, so open panels stay open.
- **Cards are unfilled** by default in the design system now (`variant: 'filled'` for the old look).
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
- Still to check by hand: a private block, a private channel (red styling), a block with a `dupe_of` marker, phone width, every theme across the whole page, the 401/403 card and a live 429 banner.
- are.na search does not index metadata (tested 2026-10-20), so no metadata-to-search links. Possible instead: a channel-scoped scan of block metadata.
- Plan history and what changed since: `_claude/arena-palimpsest-build-plan.md` (see its "As built" section).

## v2 (editing): Phase 1 built (21 Oct 2026)
Full plan: `_claude/arena-palimpsest-v2-editing-and-tagging-plan.md` (Phases 2 to 4 still ahead). Decisions: whole-section Edit toggle with a Review step and one Save; tags stored as a JSON array written as text (`["a", "b"]`) in one string value, older bullet lists still read; blocks first.

- **Files:** `src/metadata-edit.js` (pure rules, tested in `metadata-edit.test.js`) and `src/metadata-editor.js` (DOM: `createMetadataEditor`). `app.js` wires it in through `blockMetadataSection()` and `requestWrite()`.
- **Write access:** Edit calls `auth.ensureWrite()` (shared/widgets/auth-step.js). If the token cannot write it calls `auth.setRequireWrite(true, message)` and opens Connect; after a write token connects, the block is reloaded (so `can` is known) and edit mode starts. `setRequireWrite(true)` drops a connected read-only token.
- **Save:** one `PUT /v3/blocks/{id}` with only changed keys, removals as `null`. Review re-reads the block first and warns if a key changed on are.na meanwhile. Verified live on block 51621626 (21 Oct 2026).
- **Locked keys:** `dupe_` needs "Edit anyway"; `goby__` only carries a note.
- **Not built:** key and tag suggestions from earlier use (plan §7), and editing channel or connection metadata.
- **Accessibility:** keyboard run-through done (Edit moves focus to the first value; Review, Back and Save/Cancel each return focus sensibly; row menus take arrow keys and close on Escape or when focus leaves). Alert orange is below 4.5:1 as text on Light (3.90) and Dawn (3.65), so error text is `--text-primary` with the orange only on a ⚠ icon. `--text-muted` is 3.82:1 on Dawn's page, below AA for small text; this is the design system's value, so it is recorded here, not changed. Other pairs checked all pass (4 themes): text-primary, text-secondary, success.
