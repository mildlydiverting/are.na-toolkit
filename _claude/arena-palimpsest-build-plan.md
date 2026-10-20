# Are.na Palimpsest — Build plan

*Written October 2026. Read `AGENTS.md` and `CLAUDE.md` in the repo root first, then `_claude/toolkit-architecture-plan.md`, then `_claude/arena-duplicate-finder-build-plan.md` (as the first tool under the new architecture — this one follows the same pattern), then this top-to-bottom before touching any file.*

---

## As built (v1.1, 20 October 2026)

**Status: shipped.** This section is the current picture; everything below it is the original plan, kept for history. Agent-facing state and open items live in `arena-palimpsest/NOTES.md`; user docs in `arena-palimpsest/README.md`.

### Where the build departed from the plan
- **Layout.** Not three stacked cards. A bordered block frame (image or text, ID caption, "open on are.na") sits beside a text column of metadata then fields. There is one merged "Connected channels" list. The planned Connections section is not possible: are.na's `GET /blocks/{id}/connections` returns channels only; the connection object (position, who connected it, when, metadata) is absent from a block's side.
- **Channels.** The connections call already returns full channel objects, so there is no per-channel `getChannel` fetch (§7 step 4).
- **Channel rows** are accordion bars coloured by visibility (`ChannelRow`, `ChannelList`), with a sort menu (default, most recent, oldest, most blocks, most metadata; dates are the channel's `created_at`).
- **Header.** Navigation only: breadcrumb (Are.na Tools / Are.na Palimpsest), Connect or the user chip, and the theme chooser. The page title and a one-line intro sit below it.
- **Fields.** "Generated title", "Collaboration" and "Follower count" do not exist in the v3 API. Shown instead: block, content and collaborator counts.
- **Design system.** §3.10 allowed extending it, and we did: `ThemeChooser` (Light, Dusk, Dark, Dawn, System), `ChannelRow`, `ChannelList`, a `filled` Card variant (cards are unfilled by default), and `channel-bar-*` / `channel-badge-*` tokens matched to are.na's own colours. All published to the Arena Toolkit artifact. Docs in `shared/ui/<Component>/`.
- **Added beyond the plan:** metadata-count badges, compact counts (`10k`), URL values as links, border colour by block visibility, `format.js` and `history.js` with tests.
- **Theme.** Phase 4 step 22 said to skip a toggle unless one existed. We built one, and `?theme=` still forces a theme without saving it.
- **Name.** "Are.na Palimpsest" in the UI.

### Findings
- Public reads work with no token (guest limit 30 requests a minute).
- `connection.metadata` is absent (§14). `channel.metadata` and `block.metadata` are present.
- are.na search does **not** index metadata keys or values (tested 20 October 2026), so linking metadata to search is not possible.

### Not done or not checked
- Planned v1.1 extras: JSON and Markdown export, channel URLs as input.
- Manual checks from §13: a private block, a private channel (red styling), a block with a duplicate-finder `dupe_of` marker, a phone-width pass, every theme across the whole page, the 401/403 card and a live 429 banner.
- Idea: a channel-scoped metadata search (scan one channel's blocks client-side).

### Next: editing (v2)
See §11 and the "v2 (editing)" section of `NOTES.md`. The API supports it directly: `PUT /v3/blocks/{id}` with `metadata`, merge semantics, `null` deletes a key, owner only, write scope.

---

## 1. What this is

A read-only inspector tool in Kim's are.na-toolkit. Takes an are.na block URL or ID as input and shows everything the API knows about it — the block's own fields, its connections to channels, and the channels those connections point at — with a focus on surfacing all **metadata key/value pairs** at each level.

A diagnostic lens. Not a workflow. Useful when working on other tools (duplicate-finder's dupe markers, merge's provenance notes) and when poking at what are.na actually exposes.

The name — palimpsest, from the manuscript tradition where fresh writing is laid over scraped-off older text with the earlier layer still faintly visible — fits: this tool shows every layer of metadata that has accumulated around a block, including the markers written by the toolkit's own tools (duplicate-finder's `dupe_of`, merge's provenance notes).

**v1 is read-only. v2 (future) adds editing.** v1 is designed so that swapping value cells for inputs later is a straight substitution.

### Precedent tools
- **UI model: arena-palette and arena-hypernormalisation.** Single-screen, no step rail. The tool is a direct lookup, not a workflow.
- **Architecture: arena-duplicate-finder.** Built under the `src/` → `dist/` pattern with `@include` markers, `shared/` imports, Vitest for pure logic. Follow that exact shape.
- **Connect widget: arena-merge.** The PAT connect UX, which should by this point live in `shared/widgets/auth-step.js`.

### Visual language — Arena Toolkit, no exceptions
This tool uses the Arena Toolkit design system (<https://claude.ai/code/artifact/6f41b46a-f00f-4219-8860-e54041c15ac1>) throughout — tokens, components, themes, type stack. **No bespoke components, no custom colours, no new fonts.** It should look and feel of a piece with arena-merge, arena-palette, arena-hypernormalisation and the forthcoming arena-duplicate-finder — a user flipping between them shouldn't notice they've crossed a boundary. See §10 for the components used.

---

## 2. State of play

Nothing exists yet. Build order relative to arena-duplicate-finder matters:

- **If arena-duplicate-finder has shipped first:** `shared/ui/`, `shared/api/arena-client.js`, `shared/api/throttle.js`, `shared/widgets/auth-step.js` all exist. Palimpsest pulls them in via `@include` and only writes its own tool-local files.
- **If palimpsest ships first:** it builds those shared files instead, per the duplicate-finder plan's Phase 1. Everything else below stays the same.

### Expected deliverables (palimpsest-specific)

| Path | What |
|---|---|
| `arena-palimpsest/src/index.html` | shell with `@include` markers |
| `arena-palimpsest/src/app.js` | tool-specific logic (fetch orchestration, rendering) |
| `arena-palimpsest/src/styles.css` | tool-specific styles |
| `arena-palimpsest/src/parse-input.js` | pure: URL/ID parser (plus `parse-input.test.js`) |
| `arena-palimpsest/build.js` | tool build script (uses shared `@include` resolver) |
| `arena-palimpsest/dist/arena-palimpsest.html` | built single file |
| `arena-palimpsest/README.md` | user-facing (short) |
| `arena-palimpsest/NOTES.md` | agent-facing: current state, open items, v2 notes |
| `docs/arena-palimpsest.html` | copy of dist for GitHub Pages |
| `docs/arena-palimpsest-preview.jpg` | screenshot for the toolkit index card |
| `docs/index.html` | updated: add a sixth card |

### Docs to update
| Path | What |
|---|---|
| `AGENTS.md` | add arena-palimpsest to the Tool table (§1) and remove from Open Work (§4) once shipped |

---

## 3. Hard rules (inherited)

See `CLAUDE.md` and `AGENTS.md`. Specific to this tool:

1. **are.na API v3 only** — `https://api.are.na/v3/`.
2. **150 ms between page fetches**; on 429, back off `[2, 4, 8]` seconds, honour `Retry-After`. Via `shared/api/throttle.js`.
3. **Build step with `@include` markers.** Edit in `src/`, run `node build.js`.
4. **Vitest for pure logic.** The input parser gets tests.
5. **Copy `dist/` to `docs/` after any change.**
6. **Ask Kim before changing code.**
7. **British English in UI copy.**
8. **PAT with read scope is enough for v1.** Make this plain in the Connect step. Note that some content (private channels, Kim's own blocks) requires auth even for reads.
9. **Everything stored locally** — PAT and any lookup history go in `localStorage` under `arena_palimpsest_*`. No remote persistence.
10. **Arena Toolkit design language, no deviation.** Every visual element pulls from `shared/ui/` — tokens, components, four-theme behaviour. If a layout needs something the design system doesn't have, propose extending the design system (per the duplicate-finder's new-component path) rather than one-offing it here.

---

## 4. File layout — src/index.html

```html
<!doctype html>
<html data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Arena Palimpsest</title>

  <!-- @include shared/ui/tokens.css -->
  <!-- @include shared/ui/bundle.css -->
  <!-- @include ./styles.css -->
</head>
<body>
  <header class="palimpsest-header">
    <!-- auth status chip mounts here -->
  </header>

  <main class="palimpsest-main">
    <section class="input-bar">
      <!-- Input + Inspect button -->
    </section>

    <section class="result-pane">
      <!-- Block / Connections / Channels sections render here -->
    </section>
  </main>

  <!-- @include shared/ui/bundle.js -->
  <!-- @include shared/api/arena-client.js -->
  <!-- @include shared/api/throttle.js -->
  <!-- @include shared/widgets/auth-step.js -->
  <!-- @include ./parse-input.js -->
  <!-- @include ./app.js -->
</body>
</html>
```

No stepper. No channel picker. Nothing else.

---

## 5. Single-screen UI

### Layout

```
┌───────────────────────────────────────────────────────┐
│ Arena Palimpsest           Connected as @kim-plowright ⌄│  ← header
├───────────────────────────────────────────────────────┤
│  Paste a block URL or ID                              │
│  [https://www.are.na/block/12345____]  [Inspect]      │  ← input bar
│                                                       │
│  Recent: 12345  67890  13857023                       │  ← history chips
├───────────────────────────────────────────────────────┤
│  ┌─ Block 13857023 ───────────────────────────────┐   │
│  │ [thumb] Title           Owner: @kim-plowright  │   │
│  │         Alt text                               │   │
│  │         Description                            │   │
│  │         Source URL                             │   │
│  │                                                │   │
│  │  Metadata                                      │   │
│  │  ┌─────────────┬────────────────────────────┐  │   │
│  │  │ dupe_of     │ 51566599                   │  │   │
│  │  │ dupe_marked │ 2026-10-19                 │  │   │
│  │  └─────────────┴────────────────────────────┘  │   │
│  └────────────────────────────────────────────────┘   │
│                                                       │
│  ┌─ Connections (3) ──────────────────────────────┐   │
│  │ ▸ in "scrapbook"   by @kim-plowright  2024-03  │   │
│  │   Metadata: (none / expands)                   │   │
│  │ ▸ in "drawing"     by @kim-plowright  2024-05  │   │
│  │ ▸ in "shared-mood" by @someone-else   2024-07  │   │
│  └────────────────────────────────────────────────┘   │
│                                                       │
│  ┌─ Connected channels (3) ───────────────────────┐   │
│  │ ▸ scrapbook       by @kim-plowright  public    │   │
│  │   Metadata: (none / expands)                   │   │
│  │ ▸ drawing         by @kim-plowright  closed    │   │
│  │ ▸ shared-mood     by @someone-else   public    │   │
│  └────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────┘
```

### Header
- Compact. `ArenaToolkit.Badge` showing auth state.
  - When signed out: `"Connect →"` as a `Link` that opens a compact modal with the `auth-step.js` widget inside
  - When signed in: `"Connected as @username"` with a dropdown offering "Disconnect"
- No persistent step rail — this isn't a workflow.

### Input bar
- `Input` field, placeholder: `"Paste a block URL or ID (e.g. 13857023 or https://www.are.na/block/13857023)"`
- `Button` labelled "Inspect" (primary)
- `Enter` key submits
- Below: horizontal row of recent lookups as `Badge`s (click to re-inspect), max 10, stored in `arena_palimpsest_history`

### Result pane
Three stacked `Card` sections. Each has a visible heading, count where relevant, and uses the same inner structure.

Each section's metadata is rendered as a two-column table (`[key] [value]`) with hairline row dividers. Empty state: `"No metadata set"` in muted text — not hidden entirely, because knowing it's empty is useful.

Rendered as explicit label/value row pairs (not CSS grid tricks or free prose), so v2 can swap value cells to `Input`s without restructuring.

#### Section 1: Block
Uses `ArenaToolkit.Block` card for the thumbnail+basics header, then a fields table below:

| Field | Value |
|---|---|
| ID | 13857023 (with "copy" and "open on are.na" `Link`s) |
| Class | Image / Text / Link / Attachment / Media |
| Title | ... |
| Generated title | ... (if different) |
| Alt text | ... (image blocks only) |
| Description | ... (preserve line breaks) |
| Source URL | ... (as a `Link`) |
| Source title | ... |
| Owner | @username (as a `Link` to their are.na profile) |
| Created | 2024-03-15 |
| Updated | 2024-03-15 |
| Connected to | 3 channels |

Then a **Metadata** subsection, same table format: every key/value pair from `block.metadata`.

#### Section 2: Connections (n)
Header: `"Connections (3)"`.
One row per connection — a disclosure (`<details>`-ish) that's collapsed by default but opens to show full detail:

Row header (collapsed): channel name + badge for channel visibility + "by @user" + relative timestamp.

Expanded contents:
| Field | Value |
|---|---|
| Connection ID | ... |
| Position | ... (connections carry an ordering position) |
| Channel | name (as `Link`) |
| Connected by | @username (as `Link`) |
| Connected at | ISO date |
| Updated at | ISO date |
| Description | ... (connection-level description if API provides it) |

Then **Metadata** subsection, if `connection.metadata` exists in the v3 API. If verification during build shows it doesn't, this subsection shows: `"Connections don't carry metadata in the are.na API"` once, at the top of the Connections section, not per-row.

#### Section 3: Connected channels (n)
One row per unique channel from §2. Collapsed by default.

Row header: channel title + visibility badge (public / closed / private — use existing `Badge` variants) + "by @owner".

Expanded contents:
| Field | Value |
|---|---|
| Slug | ... |
| ID | ... |
| Owner | @username (as `Link`) |
| Visibility | public / closed / private |
| Collaboration | open / closed / invite-only |
| Block count | ... |
| Follower count | ... |
| Created | ... |
| Updated | ... |

Then **Metadata** subsection: every key/value from `channel.metadata`.

### Error states
- **Invalid input:** inline red hint under the input, no fetch attempted
- **Block not found:** result pane shows a single `Card` with "Block 12345 not found or you don't have access" and a hint about PAT scope
- **Auth required:** if the fetch returns 401, surface "This block requires authentication — connect your account above" and highlight the header's Connect link
- **Rate limit hit:** inline Toast-equivalent (if `shared/widgets/` has Toast by now) or a muted banner "Waiting Ns for rate limit…" — throttle handles the actual backoff

---

## 6. Input parsing — `src/parse-input.js`

Pure function. Accepts:
- raw numeric ID: `"13857023"` → `13857023`
- block URL: `"https://www.are.na/block/13857023"` → `13857023`
- block URL with trailing slash, query, or anchor: strip these
- paste that includes whitespace: trim
- `www.` optional
- `http` or `https`

```js
export function parseBlockInput(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  try {
    const url = new URL(s.startsWith('http') ? s : `https://${s}`);
    const m = url.pathname.match(/^\/block\/(\d+)/);
    if (m) return parseInt(m[1], 10);
  } catch { /* fall through */ }
  return null;
}
```

### Vitest tests (`parse-input.test.js`)
Each case one line. Minimum:
- bare id, URL, URL with trailing slash, URL with query, URL with anchor
- http vs https
- with/without `www.`
- whitespace padding
- rejects: empty string, non-numeric, channel URLs, nonsense

---

## 7. Fetch orchestration — in `src/app.js`

Sequence on Inspect:

```
1. parse input → block id (or show error, stop)
2. arenaClient.getBlock(id) → block object
   - render Section 1 immediately (don't wait for 2 and 3)
3. arenaClient.getBlockConnections(id) → list of connections
   - render Section 2
4. For each unique channel referenced in step 3:
     arenaClient.getChannel(slug_or_id) → channel object
   - render Section 3 progressively (one card at a time) as each resolves
5. Store the lookup in arena_palimpsest_history (dedupe, cap at 10)
```

Pacing is handled by `shared/api/throttle.js` — the per-channel fetches in step 4 go through it, so a block in 20 channels won't blast the API.

If step 2 returns 404 or 401, abort with the appropriate error state.

### What to show while waiting
- Spinner on the Inspect button during step 2
- Each section shows a skeleton row while its own fetch is in flight

---

## 8. Owner display

Several of the displayed fields are user references (block owner, connection author, channel owner). The are.na API returns these as nested `user` objects on the relevant resource — no extra fetch needed. Display as `@slug` linking to `https://www.are.na/{slug}`.

If a resource is missing `user` for some reason, show `"(unknown)"` rather than falling over.

---

## 9. localStorage schema

Namespace all keys `arena_palimpsest_*`:

```js
{
  "arena_palimpsest_history": [
    { "id": 13857023, "title": "Red print study", "at": "2026-10-19T18:22:00Z" },
    ...
  ],  // cap 10, most recent first, deduped by id
  "arena_palimpsest_last_input": "https://www.are.na/block/13857023"  // for repopulating input on reload
}
```

PAT lives under whatever key `shared/widgets/auth-step.js` uses (probably `arena_toolkit_pat`, shared across tools).

5–10 MB quota, as elsewhere. No "clear cache" button needed in v1 given how small the footprint is — can be added if lookups accumulate noise.

---

## 10. Design — Arena Toolkit, in full

Follows the existing design system entirely. **No new components, no bespoke styling, no deviation from tokens.** The tool should be visually indistinguishable in family from arena-merge, arena-palette, arena-hypernormalisation and arena-duplicate-finder — same type stack, same spacing scale, same `Badge` / `Button` / `Input` / `Card` / `Block` / `Modal` / `Menu` / `Link` / `KeyChip` shapes, same four-theme behaviour (Light / Dark / Dawn / Dusk) driven by `data-theme`.

Components used:
- `Badge` — auth status, channel visibility, metadata key count
- `Input`, `Button`, `Link` — input bar, Connect modal, URL cells
- `Card` — section wrappers, error states
- `Block` — thumbnail header on Section 1
- `Modal` — Connect flow
- `Menu` — header dropdown (Disconnect)
- `KeyChip` — if we want to show `Enter` as the shortcut hint next to the Inspect button

If the duplicate-finder has introduced `Toast` and `Progress` into the design system by the time this is built, palimpsest uses `Toast` for 429 waits. Otherwise it falls back to a muted inline banner — not worth building those components just for this tool.

Styles in `src/styles.css` cover only:
- the two-column metadata table layout (uses tokens for borders, spacing, type)
- the header auth-chip positioning
- the result-pane card spacing
- disclosure open/close transitions (if used)

Nothing bespoke beyond that.

---

## 11. v2 — editable metadata (not building, but note the shape)

v2 would:
- Change PAT scope requirement to write
- Add a mode toggle: "Inspect" / "Edit"
- In Edit mode, each metadata value cell becomes an `Input`
- Add "+" rows at the bottom of each metadata subsection to add new key/value pairs
- Add "–" row controls to delete pairs (set value to `null` in the API)
- Confirm bar at the bottom: "Save changes" with dry-run equivalent showing the API calls that would fire
- Only enabled for resources Kim owns (block owner, channel owner, connection author) — surface which ones are read-only in the UI

This is a note for the v1 builder to leave the structure amenable to this change. Not a work item.

Possible v1.1 additions (lower-hanging, if useful):
- Accept channel URLs as input (channel lookup is a natural companion)
- Export the inspection as JSON (one `Button` → download)
- Export as Markdown report (useful for pasting into Obsidian notes)

---

## 12. Build order

### Phase 0 — shared layer (skip if duplicate-finder already shipped)
Per the duplicate-finder plan's Phase 0 and Phase 1:
1. Repo-wide npm/vitest setup if not done
2. Populate `shared/ui/` from the design system artifact
3. Write `shared/api/arena-client.js`, `shared/api/throttle.js` + their tests
4. Write `shared/widgets/auth-step.js`

### Phase 1 — scaffold the tool
5. Create `arena-palimpsest/src/`, `dist/` folders
6. Write `src/index.html` with the full set of `@include` markers (§4)
7. Write `src/styles.css` with header, input-bar, result-pane layout
8. Write minimal `src/app.js` that mounts header + input bar and renders a placeholder result pane
9. Write `build.js`, run it, open `dist/arena-palimpsest.html`. Should show the layout.

### Phase 2 — input + block
10. Write `src/parse-input.js` + `parse-input.test.js`. Confirm tests pass.
11. Wire the input bar: Enter / Inspect button → parse → show error or proceed
12. Call `arenaClient.getBlock(id)` and render Section 1 (fields + metadata table)
13. Handle 404 and 401 error states on the block fetch

### Phase 3 — connections and channels
14. Call `arenaClient.getBlockConnections(id)` and render Section 2
15. Verify `connection.metadata` presence in v3 docs during build. If present: render per-row metadata subsections. If absent: single banner at top of Section 2.
16. For each unique channel, call `arenaClient.getChannel(slug)` and render Section 3 progressively
17. Verify `channel.metadata` presence (likely yes); render accordingly

### Phase 4 — polish
18. History chips: store in localStorage, render below input, click to re-inspect
19. Repopulate input from `arena_palimpsest_last_input` on load
20. Connect widget wired into header modal; auth state chip updates on connect/disconnect
21. Rate-limit visual feedback (banner or Toast as available)
22. Theme toggle (reuse the standard one if it's in `shared/ui/` by now, otherwise skip — matches `data-theme` attribute at page load)

### Phase 5 — ship
23. Final `node build.js`, confirm `dist/arena-palimpsest.html` looks right in all four themes
24. Copy to `docs/arena-palimpsest.html`
25. Take screenshot, save as `docs/arena-palimpsest-preview.jpg`
26. Add sixth card to `docs/index.html`
27. Write `NOTES.md` with current state, open items, v2 pointers
28. Update `AGENTS.md`: add to shipped tool table, remove from Open Work

Each step: build, refresh, confirm, commit.

---

## 13. Testing

### Vitest
Primary targets:
- `shared/api/*` — tests exist from the duplicate-finder phase
- `arena-palimpsest/src/parse-input.test.js` — the input parser's full case matrix

That's it for automated tests. The tool has very little pure logic beyond parsing.

### Manual verification
- Known block ids to check against (Kim can supply from her own channels):
  - a block in one channel, no metadata
  - a block in several channels, some owned by her, some by others
  - a block marked by arena-duplicate-finder (if that's shipped) — verify its `dupe_of` metadata renders cleanly
  - a block in a private channel (requires PAT)
  - a block that doesn't exist (expect clear error)
  - an invalid input (expect inline hint)
- All four themes (Light / Dark / Dawn / Dusk) — scan the result pane for any contrast issues on the metadata tables
- Narrow viewport (mobile width) — stacked sections should remain readable; horizontal scroll on metadata tables acceptable if values are long

---

## 14. Known constraints and to-verify

- **`connection.metadata`** — unclear from the API tool list whether connections carry a free metadata dict (only `description` and position seem definite). Verify during build at <https://dev.are.na/documentation/connections>. If no, Section 2's metadata subsection becomes a one-time banner.
- **`channel.metadata`** — likely present. Verify at <https://dev.are.na/documentation/channels>.
- **`block.metadata`** — confirmed present (the duplicate-finder relies on it).
- **Auth for public content** — v3 requires a PAT for many "public" reads too. If Kim's just inspecting her own blocks this is non-negotiable; the Connect flow should be prominent for unauthenticated users.
- **Rate limit** — one block fetch + one connections fetch + N channel fetches. For a block in 50 channels, that's 52 calls. Well within budget; throttling at 150ms = ~8 seconds. Acceptable.
- **No `getConnection` in the primary path** — `getBlockConnections` already returns the connection objects with their user and timestamp fields. Only call `getConnection(id)` if there's additional detail we want (e.g. position/metadata not included in the list response). Verify during build; prefer fewer calls.

---

## 15. Where to read next

Before writing any code:

1. **`AGENTS.md`** in the repo root — toolkit-wide state of play
2. **`CLAUDE.md`** in the repo root — the hard rules
3. **`_claude/toolkit-architecture-plan.md`** — build pipeline, `@include` spec, `shared/` structure, Vitest conventions
4. **`_claude/arena-duplicate-finder-build-plan.md`** — architectural precedent, especially §12 (build order) which this plan mirrors
5. `arena-palette/src/` and `arena-hypernormalisation/index.html` — single-screen tool UI precedents (how Palette lays out input + progressive result)
6. `arena-merge/index.html` — the Connect/auth UX pattern (now extracted into `shared/widgets/auth-step.js` if duplicate-finder shipped first)
7. are.na v3 API docs — <https://dev.are.na/documentation> — specifically Block, Channel, Connection sections for metadata shape confirmation
8. Design system — <https://claude.ai/code/artifact/6f41b46a-f00f-4219-8860-e54041c15ac1> — read `project/README.md` first, then component READMEs for the pieces listed in §10

Then confirm with Kim before starting file writes.
