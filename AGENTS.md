# are.na-toolkit — Guide for an incoming model

*Last compiled 20 October 2026. For detail on any one tool, see its folder.*

---

## 1. State of play

Six browser tools shipped and live on GitHub Pages (four standalone; palimpsest and arena-duplicate-finder, shipped 2026-10-22, on the new build pipeline). One Python migration tool half-built. Repo on `main`.

| Tool | Path | Status |
|---|---|---|
| **Hypernormalisation** slideshow | `arena-hypernormalisation/` | Shipped. Single file. See `arena-hypernormalisation/NOTES.md` for state architecture. |
| **Palette** extractor | `arena-palette/` | Shipped at v1.24; v1.25 patch drafted. See `arena-palette/CONTEXT.md` and `HANDOFF-ase-gpl-procreate.md`. |
| **Picks** random browser | synced from sibling repo | Shipped. Source at github.com/mildlydiverting/are.na-picks; copy at `docs/arena-picks.html`. |
| **Merge** channel copier | `arena-merge/` | Shipped. Single file (`index.html`), still on the old shape; copy at `docs/arena-merge.html`. Writes to are.na, so it needs a write-scope token. |
| **Palimpsest** block inspector | `arena-palimpsest/` | Shipped (v1.1, read-only). First tool on the shared build pipeline; its look comes from the shared design-system components. See `arena-palimpsest/NOTES.md`. |
| **Duplicate finder** | `arena-duplicate-finder/` | Shipped 2026-10-22 (live at `docs/arena-duplicate-finder.html`, card 6 on the index; the preview image is only the Connect screen, so swap in a Review screenshot). Scan, connection lookup across all your channels, Review with dry run, Resolve and Undo, Done. See `arena-duplicate-finder/NOTES.md` and `README.md`. Plan: `_claude/arena-duplicate-finder-build-plan.md`. |
| **Arena Uploader** (Pinterest → are.na) | `arena-uploader/` | Prototype only. Still on v2 API; credentials still inline. Not production-ready. |

Live directory: <https://mildlydiverting.github.io/are.na-toolkit/>
Repo: <https://github.com/mildlydiverting/are.na-toolkit>

---

## 2. Hard rules

See `CLAUDE.md`.

---

## 3. Setup

- Repo root: `~/Development/are.na-toolkit/`
- venv: `.venv/` inside the repo
- Python: `/usr/local/opt/python@3.14/bin/python3.14`
- Activate + install:
  ```bash
  cd ~/Development/are.na-toolkit
  source .venv/bin/activate
  pip install -r requirements.txt
  ```
- Node tooling (≥20): `npm install`, then `npm test` (Vitest) and `npm run build` (every tool with a `build.js`; add `--docs` to copy to `docs/`).
- Serve locally (needed for canvas PNG export — `file://` fails CORS):
  ```bash
  python3 -m http.server 8080
  ```
- Preview a built tool (what the live site serves): `python3 -m http.server 8000 --directory docs`, then open `http://localhost:8000/arena-palimpsest.html`. Run `node <tool>/build.js --docs` after each change so `docs/` is current. Add `?theme=light|dusk|dark|dawn` to check a theme.

---

## 4. Open work

- **arena-palette v1.25** (drafted, not applied) — ASE, GPL, Procreate exports. See `arena-palette/HANDOFF-ase-gpl-procreate.md`.
- **arena-hypernormalisation** — small deferred items, see `arena-hypernormalisation/NOTES.md`.
- **arena-uploader** — needs v2→v3 API migration, credential extraction, dry-run mode before any live run.
- **Toolkit architecture migration** — started. The shared build pipeline exists (`scripts/include-resolver.js`, `scripts/build-all.js`, Vitest, `shared/`), and palimpsest is the first tool on it. The other tools migrate when next touched. Plan in `_claude/toolkit-architecture-plan.md`; where the build departs from it (ES-module sources, `--watch` instead of dev mode), see `arena-palimpsest/NOTES.md`.
- **arena-duplicate-finder** — what's left (error paths, a better preview image, orphanage-channel idea) is in `arena-duplicate-finder/NOTES.md`; original design in `_claude/arena-duplicate-finder-build-plan.md`.
- **arena-palimpsest v2: metadata editing, then a tagging tool** — **Phase 1 (block metadata editor) built and live-tested 21 Oct 2026; Phase 2 (design-system pattern), the tagging tool and the optional index not started:** `_claude/arena-palimpsest-v2-editing-and-tagging-plan.md`. Decisions already made: an Edit toggle with a Review step and one Save; tags stored as a JSON array written as text (`["a", "b"]`) in one string value under `tags`; blocks first. Ask Kim before starting each next phase, as always. Also in that plan: a goby.garden comparison (connection-scoped metadata) and an assessment of the official `@aredotna/sdk` (recommendation: keep our own client for Phase 1; run a short spike before the tagging tool).
- **arena-palimpsest v1.x leftovers** — JSON/Markdown export, channel URLs as input, and a list of manual checks never done (private block or channel, a `dupe_of` block, phone width, every theme across the whole page). See `arena-palimpsest/NOTES.md`.
- **Design-system snapshot** — the Dropbox copy of the artifact (`…/_references-design-languages/arena-toolkit/`) is behind the live artifact. Re-syncing it is a one-prompt task (see `md-design-system/handoff-themes-and-patterns.md` §4.2).

---

## 5. The design system (Arena Toolkit)

The visual language for every tool. **The master is a claude.ai artifact**: <https://claude.ai/artifact/Ejq8nu3Z6tSKU8b4E8Cghn> (a "Design System" artifact type, edited live by Kim in the page and by Claude sessions). `shared/ui/` in this repo is a copy that tools include at build time.

- `shared/ui/tokens.css` (four themes: light, dusk, dark, dawn; generated from the artifact's `tokens.json`), `bundle.css` and `bundle.js` (`window.ArenaToolkit`). `bundle.js` and `bundle.css` must stay **byte-identical** to the artifact's `project/components/` files; `tokens.css` must match `tokens.json`.
- Components: Button, Input, Link, Card (unfilled by default; `variant: 'filled'`), Badge, Block, Modal, Menu, KeyChip, Select, Textarea, Tabs, Stepper, **ThemeChooser** (Light, Dusk, Dark, Dawn, System), **ChannelRow**, **ChannelList**. Docs and previews for the last three are in `shared/ui/<Component>/`; the others are documented in the artifact.
- Colours follow are.na's own variables. The channel-row fills are tokens (`channel-bar-*`, `channel-badge-*`); the bars were verified against are.na's Light, Dawn, Dark and Dusk values.
- **Changing it:** read `shared/ui/README.md` first. The short version: change the artifact and this folder together, never one alone, and never publish an old copy of a file over a newer one (Kim edits the artifact live).

---

## 6. Where to read next

1. `README.md` — tool-by-tool user-facing reference, keyboard shortcuts, setup
2. Each tool's own folder — `README.md`, plus `NOTES.md` or `CONTEXT.md` where relevant
3. `arena-uploader/handoff - pinterest scraper are.na migration tool.md` — Python tool state
4. `CLAUDE.md` — the hard rules
5. `shared/ui/README.md` — how the design system is kept in step with its artifact
6. `_claude/` plan documents (only the two Palimpsest plans are committed; the duplicate-finder, architecture and extraction-candidates plans are kept **local** by Kim's choice, so on another machine they may be missing, and Project knowledge holds copies): `arena-palimpsest-build-plan.md` (the v1 plan, with an "As built" section at the top), `arena-palimpsest-v2-editing-and-tagging-plan.md` (what comes next), `arena-duplicate-finder-build-plan.md`, `toolkit-architecture-plan.md`

Author channels on are.na: <https://www.are.na/kim-plowright/channels>. Default content channels: `hypernormalisation-images`, `hypernormalisation-text`.

---

## 7. are.na API facts that cost time to find

Checked against <https://api.are.na/v3/openapi.json> and by testing. Details and sources in `arena-palimpsest/NOTES.md`.

- **Search does not index block metadata** (Kim tested, 20 October 2026). Do not build links or features that rely on searching metadata.
- **Connection details** (position, who connected, when, metadata) are absent from a block's side (`GET /blocks/{id}/connections` returns channels only). They appear on items in `GET /channels/{id}/contents`.
- **Metadata values are scalars** (string up to 2000 characters, number, boolean; `null` deletes a key). No arrays. Keys: letters, numbers, underscores, up to 40 characters. At most 50 keys and 32KB. Updates merge.
- **Writing a block's metadata needs the block's owner** (`can.manage` on a full block response) and a write-scope token. Connection metadata may be writable by people who do not own the block (not yet verified).
- Guest reads are limited to 30 requests a minute; tiers go up to 600. Writes have their own budgets (the SDK names `write-minute` and `write-hour`); the numbers still need confirming before any bulk write tool.
- The duplicate-finder writes `dupe_of` as a **number**; never change a metadata value's type when editing.

