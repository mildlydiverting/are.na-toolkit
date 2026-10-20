# Palimpsest v2 — metadata editing, and a tagging tool

*Written 20 October 2026. Follows `arena-palimpsest-build-plan.md` (see its "As built" section for where v1.1 ended up). Read `AGENTS.md` and `CLAUDE.md` first. Nothing here is built yet; this is the plan to approve.*

---

## 1. Summary

1. **Phase 1:** make a block's metadata editable inside Arena Palimpsest, in an Obsidian-Properties-style editor. An **Edit** toggle turns the rows into inputs; **Review changes** shows what will be sent; **Save** makes one `PUT`.
2. **Phase 2:** extract the editor rows as a pattern in the Arena Toolkit design system, so other tools reuse them.
3. **Phase 3:** a **tagging tool** that adds and removes tags across many blocks. It reuses the Phase 2 pattern.
4. **Phase 4 (optional):** a channel-scoped scan that builds a local index of keys and tags, for suggestions and counts.

**Decisions already made (Kim, 20 October 2026)**
- Edit mode is a **whole-section toggle** with a review step, not edit-in-place row by row.
- **Tags are stored as a YAML bullet list** inside a single string value (spec in §6).
- Blocks first. Channels and connections come later, using the same pattern.

---

## 2. Reference: the Obsidian recording

`…/are.na-toolkit-project/_assets/arena design system screenshots and html/Screen Recording 2026-10-20 at 21.18.04.mov` (about 100 seconds, Obsidian's Properties editor). What it shows, and what we take from it:

| Obsidian | For are.na metadata |
|---|---|
| Row = type icon, key, value. Empty values show a muted "Empty". | Same layout. |
| Click a value to edit it. Date and time pickers. | Text, Number and Checkbox inputs; dates stored as ISO text. |
| "+ Add property" line at the bottom. | Same. |
| Key suggestions while adding ("source", "source-url", "resource"). | Suggestions from keys we have seen (§7). |
| Tags as chips with an ×, plus a dropdown of existing tags. | List type shown as chips (§6). |
| Right-click menu: Property type (Text, Number, Checkbox, Date, Date & time, List), cut/copy/paste, Remove. | A per-row menu with Type, Copy, Remove. A warning when a type change would alter the value. |
| A dialog warns "Your text data is not compatible. It will be adapted…". | Same kind of warning, with Cancel. |
| A source toggle shows the raw YAML. | A **JSON view** of the exact request body, in the review step. |
| Side panels list all tags and all properties with counts; clicking one searches. | Not possible without an index (§3, §7). Phase 4. |

**Where we deliberately differ:** Obsidian saves as you type. We batch: edit freely, review, then one Save. This is real data on are.na, and the API call is one request per block.

---

## 3. What are.na allows (checked against `https://api.are.na/v3/openapi.json`)

- **Write:** `PUT /v3/blocks/{id}` with `{ metadata: { … } }`. Merge semantics: new keys are added, existing keys are updated, **a key set to `null` is removed**. Keys we leave out are untouched.
- **Auth:** bearer token with **write** scope. Only the block owner can update. A full block response carries `can.manage` (and `can.comment`, `can.connect`); use `can.manage` to decide whether to offer Edit.
- **Keys:** letters, numbers and underscores only, at most 40 characters.
- **Values:** string (at most 2000 characters), number, boolean, or `null` (delete). **No arrays, no objects.**
- **Limits:** 50 keys per block, 32KB of metadata in total.
- **Search does not index metadata** (Kim tested 20 October 2026; the API docs only claim titles, descriptions and content). No "find blocks with this key or tag" from are.na itself.
- **Rate limits:** guest 30 a minute, free 120, premium 300, supporter 600. Writes go through `shared/api/throttle.js` (150 ms between requests; on 429 back off 2, 4, 8 seconds and honour `Retry-After`).
- **Already in the code:** `shared/api/arena-client.js` has `updateBlock(id, fields)`. arena-merge has `checkWriteAccess()` (a `DELETE /connections/0` probe: 403 = read-only token, 404 = write-capable).

**Types matter.** The duplicate-finder writes `dupe_of` as a **number** (`51566599`), `dupe_marked` as a date string and `dupe_tool` as a string. The editor must never turn a number into text on save.

---

## 4. Phase 1 — the editor in Palimpsest

### 4.1 Behaviour
1. **Edit** button on the Metadata heading. Shown only when `block.can.manage` is true. If it is false, show nothing and explain in a tooltip ("You can only edit blocks you own").
2. Clicking Edit with no token, or a read-only token, opens the Connect modal with a clear message: **"Editing needs a token with write access."** Read access remains enough for everything else. The write check runs here, not at the first Connect.
3. In edit mode each metadata row becomes: type icon, **key input**, **value input**, a row menu (Type, Copy value, Remove). A **+ Add property** row sits at the end. Keys already on the block are read-only text unless the row is new (renaming = remove + add, to keep the diff honest).
4. **Review changes** (disabled until something differs) opens a panel listing:
   - **Added** keys (with value and type),
   - **Changed** keys (old value → new value),
   - **Removed** keys,
   - a **JSON view** of the exact `PUT` body (changed keys only).
   Buttons: **Save** and **Back to editing**. **Cancel** discards everything and leaves edit mode.
5. **Save** sends one `PUT /v3/blocks/{id}` with only the changed keys (removed keys as `null`). On success, replace the block's data with the response and leave edit mode. On error, stay in the review panel with a plain-language message (401, 403, 404, 422 validation, 429 handled by the throttle).
6. Leaving the page with unsaved edits triggers the browser's standard warning.

### 4.2 Property types
| Type | Stored as | Input | Detected when |
|---|---|---|---|
| Text | string | text input | any string that is not another type |
| Number | number | number input (accepts decimals, negatives) | the API returned a number |
| Checkbox | boolean | checkbox | the API returned a boolean |
| List | string (YAML bullet list, §6) | chip editor | a string made only of `- item` lines |

- **Never retype silently.** Only changed keys are sent, and a value keeps the type it arrived with unless the person changes the type through the menu.
- **Type change warnings** (like Obsidian's dialog): Text → Number is blocked if the text is not a number ("Not a number. Change the value first."); Number or Checkbox → Text converts to its text form; Text → List splits on commas and new lines and shows the result before it is applied; List → Text keeps the bullet text as it is.
- **Very large numbers:** are.na returns long ids (for example Pinterest pin ids) as strings. If a number ever exceeds JavaScript's safe range, treat it as Text and never re-send it unchanged.
- **Tool-managed keys:** keys starting `dupe_` carry a small note ("Written by arena-duplicate-finder") and ask for a second click to edit or remove. They are not forbidden.

### 4.3 Validation (live, before Review is enabled)
- Key: `^[A-Za-z0-9_]{1,40}$`, not already used on the block.
- Value: text up to 2000 characters; numbers finite; no empty key.
- Totals: at most 50 keys; estimated payload under 32KB. Show the first problem next to its row, in words.

### 4.4 Accessibility
- Fully operable from the keyboard: Tab through rows, Enter to open a row menu, Escape closes menus, and a visible focus ring everywhere (design-system focus token).
- Every input has a visible label (the key) or an `aria-label`. Row removals are announced ("Removed pinterest_url, not saved yet").
- Type is shown by icon **and** text label, never by colour alone.
- Respect the four themes and System; check contrast in each.

### 4.5 Testing
- Pure logic with Vitest (§8).
- Manual, on **block 51621626** (Kim's test block) first: add a text key, add a number, add a checkbox, edit one, remove one, add `tags`. Then confirm the result with `GET /v3/blocks/51621626` and in are.na itself.
- Then a block owned by someone else (Edit absent), a read-only token (clear message), a 422 (bad key), and a 429 (banner, no data lost).

---

## 5. Pure logic — `arena-palimpsest/src/metadata-edit.js`

Pure functions, no DOM, with `metadata-edit.test.js`:

- `detectType(value)` → `'text' | 'number' | 'checkbox' | 'list'`.
- `validateKey(key, existingKeys)` → `null` or a message.
- `validateValue(type, raw)` → `{ ok, value }` or `{ ok: false, message }`.
- `coerce(fromType, toType, value)` → `{ value, lossy }` for the type-change warning.
- `buildPatch(original, edited)` → the `metadata` object to send: only added or changed keys, removed keys as `null`, original types preserved. Returns `{}` when nothing changed.
- `diff(original, edited)` → `{ added, changed, removed }` for the review panel.
- `checkLimits(metadata)` → key count and payload size against 50 keys / 32KB.
- `parseList(text)` / `serialiseList(items)` — the tag format (§6).

Tests cover at least: number stays a number; boolean stays a boolean; unchanged keys are omitted; removal gives `null`; a long numeric string is never converted; key rules; limit checks; every type-change path; list parse and serialise round trips, including awkward tags.

---

## 6. Tags as a YAML bullet list

Stored under the key **`tags`** (matching Obsidian) as **one string** whose lines are bullets:

```
tags: "- drawing\n- life drawing\n- reference/anatomy"
```

In an editor or an Obsidian note it reads as:

```yaml
tags:
  - drawing
  - life drawing
  - reference/anatomy
```

**Format rules**
- One tag per line: `- ` then the tag. No leading indent on write; tolerate leading spaces on read.
- Blank lines are ignored on read. No blank lines on write. No trailing newline.
- Tags are trimmed, with inner runs of spaces collapsed to one. Case is kept as typed. Duplicates are removed ignoring case, keeping the first.
- A tag may contain `/` (nested tags, as Obsidian does).
- A tag that would confuse YAML is written in double quotes: it contains `:`, ` #` or `"`, starts with `-`, `[`, `{`, `&`, `*`, `!`, `|`, `>`, `'`, `%`, `@` or a backtick, or has leading or trailing spaces. Inside quotes, `"` is written `\"`. On read, matching single or double quotes are stripped.
- Empty tags are dropped.
- **Also recognised on read:** a JSON array string such as `["drawing","reference"]` (the encoding goby.garden uses for multi-select, §14). It shows as a List, and saving it rewrites it in the bullet-list format after the §4.2 warning. We never write JSON arrays.
- **Limit:** the whole string must fit in 2000 characters. At write time, show "Too many tags for one are.na value (limit 2000 characters)" with the current count.

**Why this works**
- It stays within the API's rules (a string).
- It matches Kim's Obsidian frontmatter, so tags can be copied between are.na and Obsidian notes without translation.
- It reads sensibly when seen raw.

**Costs to be aware of**
- are.na stores it as plain text. Nothing validates it. Another tool could write something else; we then treat the value as Text and offer **Convert to list** (with the §4.2 warning) rather than guessing.
- Editing means rewriting the whole `tags` value. Two people (or two tabs) editing the same block's tags can overwrite each other, last write wins. The tagging tool therefore **re-reads each block immediately before writing** (§9).
- are.na cannot search for a tag. Finding blocks by tag needs our own index (§7).

---

## 7. Suggestions and the local index

There is no are.na index to ask, so suggestions come from what we have seen:
- **Keys** seen on this block, on the channels it is connected to (their metadata), and a remembered list in `localStorage` (`arena_palimpsest_seen_keys`, capped).
- **Tags** seen on blocks we have loaded, plus a remembered list (`arena_toolkit_seen_tags`, capped, shared by Palimpsest and the tagging tool).
- Starts empty, fills as you use the tools. Offered as a dropdown under the input, exactly as in the recording.

**Phase 4 (optional):** a channel-scoped scan. For one chosen channel, page through its contents (the block objects include metadata), count keys and tags, and keep the result locally. That gives tag counts, a tag filter and "blocks with key X" for that channel. Scanning every channel is too slow and rate-limited; keep it per channel, with a progress bar and a Stop button.

---

## 8. Shared code changes

- **`shared/widgets/auth-step.js`:** **already has** `requireWrite` and `checkWriteAccess` (the `DELETE /connections/0` probe), added by the duplicate-finder work, with tests. Palimpsest's job is to use them: when the person clicks Edit with no token or a read-only token, open the Connect modal in `requireWrite` mode. Check how the widget behaves when a read-only token is already saved (it may need a "replace token" path).
- **`shared/api/arena-client.js`:** `updateBlock` exists. No change expected; add a test that a metadata-only `PUT` body contains only the given keys.
- **Design system (Phase 2):** see §10.

---

## 9. Phase 3 — the tagging tool (outline, to be planned in full later)

A separate tool, `arena-tags/`, built on the shared pipeline.

- **Input:** a channel (picked or pasted). Lists its blocks as a grid or list with each block's current tags.
- **Actions on a selection:** add tag(s), remove tag(s), rename a tag (find and replace within the channel).
- **Dry run is the default.** The first screen after choosing an action shows exactly what would change per block ("+ drawing", "− old-tag") and how many requests that is. Nothing is written until **Apply**.
- **Safe writing:**
  - re-fetch each block immediately before writing, rebuild the `tags` value from its current list, then write;
  - skip blocks Kim does not own (`can.manage` false), listed in the summary;
  - paced by the shared throttle; progress bar; a **Stop** button; a summary of done, skipped and failed;
  - **Undo:** keep the previous `tags` value for each changed block (in memory and offered as a downloadable record) so a batch can be reverted.
- **Uses the Phase 2 pattern** for the tag chips and the property rows.
- **Open design question for that plan:** what "most used tags" and tag counts mean without an are.na index (Phase 4's per-channel scan answers it for one channel at a time).

---

## 10. Phase 2 — design-system pattern

Once the editor works in Palimpsest, extract it, as was done for `ChannelRow` and `ThemeChooser`:
- `PropertyRow` (icon, key, value, menu), `PropertyList` (rows + "+ Add property"), and a `TagChips` input (chips, ×, suggestions).
- Docs and a preview in `shared/ui/<Component>/`, types in `index.d.ts`, published to the Arena Toolkit artifact, with the toolkit copy and the artifact kept in step (the "Change the artifact and the toolkit together" note in `NOTES.md`).
- Needs an icon per type. Use existing Icons where they fit; propose additions rather than drawing one-offs.

---

## 11. Build order and done criteria

### Phase 1 — editor (est. one focused session)
1. `metadata-edit.js` with tests (§5). **Done:** tests pass, including the number/boolean/long-id cases.
2. Wire the existing write-access check into the Edit flow (§8). **Done:** read-only token gives the message; write token passes.
3. Edit toggle and rows in Palimpsest, then Review and Save (§4). **Done:** all of §4.5 works on block 51621626, verified with `GET` and in are.na.
4. Accessibility and the four themes plus System checked. **Done:** keyboard-only run-through; contrast checked per theme.
5. Update `NOTES.md`, `README.md` (the "Read-only" section), rebuild `docs/`, commit.

### Phase 2 — pattern
6. Extract and publish (§10). **Done:** previews render; Palimpsest uses the shared components; artifact and toolkit match.

### Phase 3 — tagging tool
7. Write its own build plan (like `arena-duplicate-finder-build-plan.md`), then build.

### Phase 4 — optional index
8. Decide after using Phases 1 to 3.

Each step: build, refresh, confirm, commit. **Ask Kim before changing code**, as always.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Overwriting real metadata | Review step before every save; only changed keys sent; test block first; JSON view of the request. |
| Changing a number into text (breaks the duplicate-finder) | Type-preserving edits; `dupe_` keys flagged; tests. |
| Last write wins on `tags` | Re-read just before writing (tagging tool); in Palimpsest the review step shows the value as of when editing began, and a changed value on the server triggers a warning. |
| Write token stored in the browser | Same as today (`arena_toolkit_pat`); only sent to are.na; plainly stated in the Connect step. |
| Rate limits on bulk tagging | Shared throttle, progress, Stop, resume from the summary. Writes have their own budgets (§15), so the tagging plan must read the real write limits first. |
| Someone else's tags format | Treated as Text; "Convert to list" with a warning. |
| No search to verify results | Verify with `GET` and in are.na; index in Phase 4 if wanted. |

---

## 13. Open questions

1. **Tag normalisation:** keep case as typed (current plan) or lowercase everything like many tag systems? Obsidian treats tags case-insensitively but keeps display case.
2. **Spaces in tags:** Obsidian tags cannot contain spaces. We allow them (§6). Should the editor encourage hyphens, or leave it to the person?
3. **Key name:** `tags` (matches Obsidian). Should the tagging tool allow other list keys later (for example `themes`)?
4. **Channels and connections:** same editor for `PUT /v3/channels/{id}` and `PUT /v3/connections/{id}`. Do after Phase 1, since connections are not visible from a block's side.
5. **Block metadata or connection metadata for tags?** See §14. The block's own metadata travels with the block but only its owner can write it. Connection metadata is scoped to one channel and works for blocks Kim does not own, if are.na lets her write it (to verify).
6. **Where the plan's decisions live next:** once Phase 1 ships, fold the "as built" notes into `arena-palimpsest/NOTES.md` and mark this document as history, as with the v1 plan.

---

## 14. Prior art: goby.garden's channel-scoped metadata

Nico Chilla's experimental client (<https://goby.garden/arena/channel/>, source in `goby-garden/goby-website`, `sveltekit/src/lib/arena-v3.svelte.ts` and `…/channel/goby.d.ts`) uses the same v3 metadata feature for a similar job. Read 20 October 2026; what follows is what its public code shows.

### What it does
- **Per-channel custom fields** on blocks: text, checkbox, single-select, multi-select (tags). It can also override a block's title and description *within one channel*.
- **Values live on the connection**, not the block: `PUT /v3/connections/{id}` with `{ metadata }`. A connection belongs to one channel, so the annotation is that channel's point of view, and it does not show anywhere else the block appears.
- **The field definitions live on the channel**: `PUT /v3/channels/{id}` with `metadata: { goby__schema: <JSON string> }`. The schema lists each field (name, key, type; for selects, single or multiple and the options with colours).
- **Arrays are stored as a JSON string**: a multi-select value is `JSON.stringify(["a","b"])` in one scalar string.
- **Keys are namespaced** with a `goby__` prefix (optional), with a numeric suffix when a key would collide.
- **Not the owner?** Edits are saved in the browser's `localStorage` only, never to are.na.
- **Auth** is OAuth through a small server-side function that holds the client secret. Our tools stay browser-only with a personal access token, so we do not copy this part.

### What it confirms
- Metadata values really are scalar, so a list needs encoding inside a string. Two projects now do it differently (their JSON array, our YAML bullets); §6 reads theirs.
- Connection metadata is reachable only from a **channel's contents**, where each item carries a `connection` object with its `id` and `metadata`. From a block's side it is absent. That fits what we found in v1.

### What it suggests for us
1. **Two scopes for tags.** *Block metadata* travels with the block everywhere but only the block owner can write it. *Connection metadata* is "tags in this channel's view", needs no ownership of the block, and cannot clash with another person's use of the same block. For a tagging tool working across Kim's channels, many of which hold blocks she does not own, connection scope may be the more useful default. **To verify before relying on it:** the API spec only says authentication is required to `PUT /v3/connections/{id}`. goby.garden writes it when the person owns or collaborates on the channel. Test with Kim's token on a block someone else owns, connected into one of her channels.
2. **A shared vocabulary stored on the channel.** goby keeps its schema on the channel. The tagging tool could keep a per-channel **tag list** in channel metadata (a string, so at most 2000 characters, owner only to write). That would give tag suggestions on any device without scanning, and replace the localStorage-only "seen tags" of §7 where the person can write. Watch the 2000-character limit: goby's schema JSON can exceed it for many fields, so the tag list has to stay compact (bullet list, not JSON).
3. **Reserve namespaces.** Keys starting `dupe_` belong to arena-duplicate-finder and `goby__` to goby.garden. Show a small "written by another tool" note on keys with those prefixes (we already do this for `dupe_`). Plain `tags` stays unprefixed for Obsidian parity.
4. **Field kinds beyond ours.** Their "select with fixed options" (single or multiple, coloured) is a possible later type. Not needed for Phase 1.
5. **Local-only fallback.** Saving to the browser when you cannot write is a neat idea for read-only users, but it creates data that exists nowhere else. Out of scope; noted.

### Effect on the phases
- **Phase 1 (block metadata editor)** is unchanged.
- **Phase 3 (tagging tool)** gains a scope choice: block metadata or connection metadata, decided before its own plan is written (§13, question 5).
- **Phase 2** pattern work is unaffected.

---

## 15. The official SDK (`@aredotna/sdk`)

Kim pointed to are.na's official SDK (<https://www.are.na/developers/resources/sdk>; source <https://github.com/aredotna/sdk>). Inspected 20 October 2026 by downloading the published package to a scratch folder (nothing run, nothing added to the repo).

### What it is
- **v0.2.0, MIT, published the same day** (20 October 2026). Very new, so the API of the SDK itself may still change. Pin the exact version if we adopt it.
- **Generated from the v3 OpenAPI spec** (`api.are.na/v3/openapi.json`), so it tracks the API rather than depending on us hand-checking endpoints.
- **ESM only**, Node 20+ or a modern browser. No UMD or CDN build. One runtime dependency (`pkce-challenge`, used only by its OAuth module). About **67KB of JavaScript** unminified (types are the bulk of the 300KB package). It uses no Node-only APIs.
- **Facade methods we would use** (all typed, errors normalised as `ArenaApiError`, `ArenaRateLimitError` and so on):
  - `blocks.get`, `blocks.update` — update body is typed with `metadata` (merge semantics, as in §3)
  - `connections.get`, `connections.update`, `connections.delete`, `connections.create`
  - `channels.get`, `channels.update`, `channels.contents`, `channels.paginateContents` (an async generator over pages)
  - `ping()`. A raw client at `@aredotna/sdk/api` returns `{ data, error, response }` for every operation, including `getBlockConnections` and `getCurrentUser`, which the facade does not wrap.
- **Rate-limit awareness:** `arena.rateLimit` reports the last response's headers (tier, limit, remaining, reset). Errors carry `retryAfter`. Budgets are **`read-minute`, `write-minute` and `write-hour`**. Automatic retry is **off by default**; `retry: { respectRateLimits: true, maxRetries }` waits for `Retry-After` and can be cancelled with an `AbortSignal`.
- Tokens: a string or an async getter; defaults to read scope, writes need write scope. It does not store tokens.

### What matters for us
- **Everything Phases 1 and 3 need exists:** block, connection and channel metadata updates, and channel contents with connection metadata (§14).
- **Write budgets are new information.** Our throttle and §3 only know about per-minute read tiers. A bulk tag across hundreds of blocks may hit `write-minute` or `write-hour`. The real numbers are not in the README; read the developer docs before planning Phase 3.
- **Pacing:** our hard rule is 150 ms between page fetches. The SDK does not pace requests; it retries after the fact. We would keep our throttle in front of it, which needs the SDK to accept a custom `fetch` (the underlying generated client has a `fetch` option; **unconfirmed** whether `createArena` passes it through).
- **Fit with our build:** our tools are single HTML files built by the `@include` resolver as classic scripts. The SDK would have to be **bundled once into a classic script** and vendored (like `shared/ui/bundle.js`), using a bundler such as rolldown or esbuild, committed as a built file. That is a new moving part and a version to watch.

### Recommendation
- **Phase 1 (one `PUT`): keep our own client.** `updateBlock` already exists and is tested; the SDK adds little for a single call.
- **Do not migrate v1's read code now.** It works and is tested.
- **Spike before Phase 3 planning** (about an hour, in a branch): bundle the SDK into an IIFE and record its size; confirm a custom `fetch` can be passed so our throttle stays in front; try `blocks.update` with metadata and `connections.update` on the test block; read the real write limits; compare how much of `shared/api/arena-client.js` it would replace. If it clears those, make `arena-client.js` a thin adapter over the SDK **with the same interface**, so no tool changes, and use `paginateContents` plus its retry and abort for the tagging tool.
- **Revisit in a few weeks.** It is a day old; waiting costs nothing for Phase 1.

