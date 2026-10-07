# are.na-toolkit — Guide for an incoming model

*Compiled October 2026 from the project's chat history, HANDOFF files, README and git log. Read this first.*

---

## 1. State of play

Three browser tools shipped and live on GitHub Pages. One Python migration tool half-built. Repo on `main`, working tree clean.

| Tool | Path | Status |
|---|---|---|
| **Hypernormalisation** slideshow | `arena-hypernormalisation/index.html` | Shipped. ~2,100 LOC single file. v3 API, incremental pagination, 429 backoff, SoundCloud, blocklist, a11y pass done. |
| **Palette** extractor | `arena-palette/src/*` → `dist/` via `build.py` | Shipped at v1.24. Export: hex, RGB, HSL, CSS, SCP, PNG. **v1.25 patch drafted but not applied** — adds ASE, GPL, Procreate `.palette`. |
| **Picks** random browser | synced from sibling repo | Shipped. Source lives in `github.com/mildlydiverting/are.na-picks`; copy at `docs/arena-picks.html`. |
| **Arena Uploader** (Pinterest → are.na) | `arena-uploader/*.py` | Prototype only. Still on v2 API; credentials still inline. Not production-ready. |

Live directory: <https://mildlydiverting.github.io/are.na-toolkit/>
Repo: <https://github.com/mildlydiverting/are.na-toolkit>

---

## 2. Working assumption: paths unchanged

Everything below is at the same path on the new machine. If it is not, stop and ask Kim.

- Repo root: `/Users/kimplowright/Development/are.na-toolkit/`
- venv: `.venv/` inside the repo
- Python: `/usr/local/opt/python@3.14/bin/python3.14`
- Activate + install:
  ```bash
  cd ~/Development/are.na-toolkit
  source .venv/bin/activate
  pip install -r requirements.txt
  ```
- Serve locally (needed for canvas PNG export — `file://` fails CORS):
  ```bash
  python3 -m http.server 8080
  ```

---

## 3. Hard rules

1. **are.na API v3 only** — `https://api.are.na/v3/`. v2 is dead. (This is the one line in `CLAUDE.md`.)
2. **Polite rate throttling** — 150 ms between page fetches; on 429, back off `[2, 4, 8]` seconds and honour the `Retry-After` header if present.
3. **Vanilla JS, no npm, no bundler.** Palette is the only tool with a build step: `python3 arena-palette/build.py`.
4. **Copy to `docs/` after any change** — `docs/` is the Pages root:
   - `arena-hypernormalisation/index.html` → `docs/arena-hypernormalisation.html`
   - `arena-palette/dist/arena-palette.html` → `docs/arena-palette.html` *(after `build.py`)*
   - `are.na-picks/index.html` *(sibling repo)* → `docs/arena-picks.html`
5. **Ask before changing code.** Project instruction. Be concise; explain when asked.
6. **Keep single-file.** No breaking out into modules unless Kim asks.

---

## 4. Outcomes shipped

### Hypernormalisation
- v2 → v3 API migration (field renames: `b.type`, `b.image.src`, `b.content.plain`)
- Incremental pagination: page 1 on Go, next page every 25 slides, no playback interruption
- 429 handling with exponential backoff and `Retry-After` support
- SoundCloud widget prefetched in parallel with channel fetch; muted by default on Go
- API key persisted to `localStorage`
- Advanced settings accordion: Access token → Search → Blocklist → Music
- User-managed block blocklist (`S.blocklist`) + hidden `DEFAULT_BLOCKLIST_IDS`
- Full a11y pass: labels, `aria-live`, `aria-pressed`, canvas `aria-label` with alt text
- Alt text via `blockAlt(b)` — `image.alt_text` → `title` → first line of description → fallback
- 37 CSS custom properties in `:root`
- Full-screen toggle, Info panel close button, source-tag → are.na URL helper

### Palette (v1.24)
- Export colour name bug fixed (`hex.slice(1)` lookup)
- Default colour count: 6
- Theme toggle moved to fixed top-right

### Picks
- Single-board initialisation bug fixed (DOM-read on apply)
- Rounded corners removed across cards/buttons

### Repo-wide
- Full SEO metadata (OG, Twitter cards) on all four live pages
- Screenshots in `docs/` referenced via absolute URLs

---

## 5. Open work

### arena-palette → v1.25 (drafted, not applied)
Full patch is in `HANDOFF - arena-palette — Add ASE, GPL, and Procr.md`. Four changes:
1. Add `downloadBinary` helper after `downloadText` (~line 891)
2. Add `exportAse`, `exportGpl`, `exportProcreatePalette` after `exportScp`
3. Add three buttons to the export bar in `renderAnalysis`
4. Wire three click listeners (~line 875)

Then: `python3 arena-palette/build.py` → copy `dist/arena-palette.html` → `docs/`.

Format notes: ASE is big-endian binary with magic `ASEF`; groups flat (nesting unreliable). Procreate `.palette` is JSON, exactly 30 slots, HSB floats 0–1, null-pad. GPL columns hint = `1 + TINT_STEPS + SHADE_STEPS` = 7.

### arena-hypernormalisation — deferred
- Remove dead `fetchChannelContents` all-pages paginator
- Add "Reset defaults" button for the clear-cache-then-remove-all-channels edge case (Go greys out)
- Possible: crossfade transitions, adjustable text colour palette, video export via `MediaRecorder`, draggable captions

### arena-uploader — before any live run
- Migrate from v2 → v3 API (match the rest of the toolkit)
- Move credentials to `config.py`; add to `.gitignore`
- Add retry/backoff, dry-run mode, logging
- Set up pyenv + venv per `requirements.txt`

---

## 6. Known issues (unchanged)

- Search without a token: v3 requires auth even for public content — error is clear, UX friction remains
- SoundCloud 30-second preview cap — platform limitation
- CORS on PNG export — some are.na image hosts block cross-origin; export may fail or produce a blank canvas
- `localStorage` quota 5–10 MB — "Clear all cache" in Info panel frees it
- Low-priority bug: clear cache + remove all channels → Go button greys out, must re-add content

---

## 7. Where to read next, in order

1. `README.md` — tool-by-tool reference, keyboard shortcuts, setup table
2. `HANDOFF.md` — session change log, including the full `S` object shape for Hypernormalisation
3. `HANDOFF - arena-palette — Add ASE, GPL, and Procr.md` — the pending v1.25 patch
4. `arena-uploader/handoff - pinterest scraper are.na migration tool.md` — Python tool state
5. `CLAUDE.md` — the one standing rule

---

*Author channels on are.na: <https://www.are.na/kim-plowright/channels>. Default content channels: `hypernormalisation-images`, `hypernormalisation-text`.*
