# are.na-toolkit — Guide for an incoming model

*Last compiled October 2026. For detail on any one tool, see its folder.*

---

## 1. State of play

Five browser tools shipped and live on GitHub Pages (four standalone, one — palimpsest — on the new build pipeline). One Python migration tool half-built. Repo on `main`.

| Tool | Path | Status |
|---|---|---|
| **Hypernormalisation** slideshow | `arena-hypernormalisation/` | Shipped. Single file. See `arena-hypernormalisation/NOTES.md` for state architecture. |
| **Palette** extractor | `arena-palette/` | Shipped at v1.24; v1.25 patch drafted. See `arena-palette/CONTEXT.md` and `HANDOFF-ase-gpl-procreate.md`. |
| **Picks** random browser | synced from sibling repo | Shipped. Source at github.com/mildlydiverting/are.na-picks; copy at `docs/arena-picks.html`. |
| **Merge** channel copier | `arena-merge/` | Shipped. Single file (`index.html`), still on the old shape; copy at `docs/arena-merge.html`. Writes to are.na, so it needs a write-scope token. |
| **Palimpsest** block inspector | `arena-palimpsest/` | Shipped (v1, read-only). First tool on the shared build pipeline. See `arena-palimpsest/NOTES.md`. |
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

---

## 4. Open work

- **arena-palette v1.25** (drafted, not applied) — ASE, GPL, Procreate exports. See `arena-palette/HANDOFF-ase-gpl-procreate.md`.
- **arena-hypernormalisation** — small deferred items, see `arena-hypernormalisation/NOTES.md`.
- **arena-uploader** — needs v2→v3 API migration, credential extraction, dry-run mode before any live run.
- **arena-duplicate-finder** — not yet built. Full plan in `_claude/arena-duplicate-finder-build-plan.md`. It can reuse `shared/api/`, `shared/ui/` and `shared/widgets/auth-step.js`; it will need to add write methods to `arena-client.js`, a write-scope check to `auth-step.js`, and `url-normalise.js` and `channel-picker.js`.
- **Toolkit architecture migration** — started. The shared build pipeline exists (`scripts/include-resolver.js`, `scripts/build-all.js`, Vitest, `shared/`), and palimpsest is the first tool on it. The other tools migrate when next touched. Plan in `_claude/toolkit-architecture-plan.md`; where the build departs from it (ES-module sources, `--watch` instead of dev mode), see `arena-palimpsest/NOTES.md`.
- **arena-palimpsest v1.1/v2** — editing metadata (v2) and optional extras (JSON/Markdown export, channel URLs as input, per-channel connection lookup). See `arena-palimpsest/NOTES.md`.

---

## 5. Where to read next

1. `README.md` — tool-by-tool user-facing reference, keyboard shortcuts, setup
2. Each tool's own folder — `README.md`, plus `NOTES.md` or `CONTEXT.md` where relevant
3. `arena-uploader/handoff - pinterest scraper are.na migration tool.md` — Python tool state
4. `CLAUDE.md` — the hard rules

Author channels on are.na: <https://www.are.na/kim-plowright/channels>. Default content channels: `hypernormalisation-images`, `hypernormalisation-text`.
