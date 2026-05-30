# Handoff — are.na toolkit, May 2026

---

## Session: 30 May 2026 — Hypernormalisation accessibility, blocklist, alt text

### Changes: arena-hypernormalisation

**Block blocklist**
- `DEFAULT_BLOCKLIST_IDS` — hardcoded `Set` of block IDs permanently excluded (currently: `46541568`). Never shown in UI.
- `S.blocklist` — user-managed array of block IDs, persisted in `localStorage`. UI in Advanced Settings: paste a full `are.na/block/…` URL, shown as removable chips.
- `isBlocklisted(b)` — checks both sets before `extractImages` / `extractTexts` map their blocks.

**Accessibility pass**
- All `<div class="panel-label">` → `<label class="panel-label" for="…">` with `display:block`
- All inputs gained `aria-describedby` pointing to hint paragraphs (which got IDs)
- `#status` → `aria-live="polite"`; `#error-area` → `role="alert" aria-live="assertive"`
- `#audio-status`, `#audio-file-name`, `#speed-val` → `aria-live="polite"`
- Chip containers: `role="list"` + `aria-label`; each chip: `role="listitem"`; each × button: descriptive `aria-label`
- Canvas: `role="img"` + `aria-label` (updated per slide — see alt text below)
- Debug panel: `role="dialog"` + `aria-label`; focus moves to close button on open
- Speed slider: `aria-valuemin/max/now/text` set on init and updated on change
- Toggle buttons (`btn-play`, `btn-audio`, `btn-debug`, `btn-fullscreen`): `aria-pressed` kept in sync; `aria-label` updated to reflect current action
- `<a onclick="clearAllCache()">` → `<button class="cache-note-btn">` (keyboard-focusable, styled identically via CSS)
- `<audio>` → `aria-hidden="true"`; external links got `rel="noopener"`

**Alt text from are.na API**
- `blockAlt(b)` — picks best available text: `image.alt_text` → `title` (if not a bare filename) → first line of `description.plain` → `"Image from are.na"`
- `extractImages` now maps `{ url, alt }` instead of `{ url }`
- `pickEntry` passes `imageAlt` into history entries
- `showEntry` sets `canvas.aria-label` to `"[alt] — [caption text]"` on each slide render

**UI tweaks**
- Advanced settings reordered: API key → Search → Blocklist → Music
- `#status` min-height increased (48px) to hold status messages without layout jump
- Accordion `margin-top` increased (8px → 24px) for breathing room below Go button
- Music now **muted by default** on Go — SC widget prefetches and cues first shuffled track but does not auto-play; user must press ♪ Music. Same for local/MP3 mode.

**Docs**
- `arena-hypernormalisation/HANDOFF.md` replaced with a one-line pointer (this file + README are the canonical reference)

### S object — current shape (additions since last session)
```js
S.blocklist      // number[] — user block IDs to skip; persisted
// allImages items now carry:
// { url, alt, source }
// history entries now carry:
// { imageUrl, imageAlt, imageSrc, text, textSrc, color }
```

### Known issues — updated
- `fetchChannelContents` (old all-pages paginator) still present, now unused — remove on next pass
- Search with no token: v3 requires auth even for public content; error message is clear but UX friction. Could show a warning badge on accordion when search queries saved but no token set
- SoundCloud 30-second preview cap — platform limitation, not fixable without SC auth
- CORS on PNG export — some are.na hosts restrict cross-origin; export may fail or produce blank canvas
- localStorage quota — 5–10MB browser limit; "Clear all cache" in Info panel frees it
- Bug (low) - if a user has added their own channels and removed the two defaults, then clears cache and removes all their channels from setup, the go button greys out - you have to re-add content. Look at a sensible workaround, like button to reselt to defaults?

---

## Session: May 2026 — API migration, pagination, major refactor

This document covers all changes made in the May 2026 session.

---

## Repo

- **Toolkit repo:** `https://github.com/mildlydiverting/are.na-toolkit`
- **Picks repo:** `https://github.com/mildlydiverting/are.na-picks` (sibling)
- **Live tools:** `https://mildlydiverting.github.io/are.na-toolkit/`

**Copy-to-docs rule (established this session):**
```
are.na-picks/index.html                    → docs/arena-picks.html
arena-palette/dist/arena-palette.html      → docs/arena-palette.html
arena-hypernormalisation/index.html        → docs/arena-hypernormalisation.html
```
Always copy after changes. The palette also needs `python3 arena-palette/build.py` before copying.

---

## are.na API — critical constraint

**Always use v3.** `https://api.are.na/v3/` only. v2 is deprecated.

**v3 response shape (channels):**
```json
{ "data": [...blocks], "meta": { "has_more_pages": true, "total_count": 412 } }
```

**v3 block field names** (different from v2):
- `b.type` not `b.class` — values: `"Image"`, `"Text"`, `"Link"`, `"Attachment"`, `"Media"`, `"Channel"`
- `b.image.src` not `b.image.display.url`
- `b.content.plain` not `b.content` (was a string in v2; now an object)

**v3 search requires authentication** — 401 without token even for public content.

---

## Changes: arena-hypernormalisation

The most significant work this session. `arena-hypernormalisation/index.html` is a single file (~2100 lines).

### API migration (v2 → v3)
Full migration. Key changes:
- `fetchChannelContents`: response `json.data` (was `json.contents`), pagination via `json.meta.has_more_pages` (was checking array length)
- `fetchSearch`: `json.data` (was `json.blocks`), now throws a clear error if no API key
- `extractImages`: `b.type === 'Image'` (was `b.class`), `b.image?.src` (was `b.image.display.url`)
- `extractTexts`: `b.type === 'Text'`, `b.content?.plain` (was `b.content`)
- Cache keys updated from `ahyp2_chan_{slug}` → `ahyp2_chan_{slug}_p{page}` (see pagination below)

### Incremental pagination (new architecture)
Previously: `fetchChannelContents` fetched all pages on Go, causing rate limit errors with 8+ channels.

Now:
- `go()` fetches **page 1 only** for each channel — fast, one request per channel
- `channelPageState = { [slug]: { nextPage, exhausted } }` tracks per-channel pagination
- Every 25 slides, `refreshPool(silent=true)` fetches the **next page** of each non-exhausted channel and **appends** items to the live pool/shuffle bags — no interruption to playback
- The slide timer (default 10s) acts as a natural API throttle — top-ups happen ~every 4 minutes
- Manual "↻ Fetch fresh" in the Info panel resets `channelPageState`, clears per-page cache, re-fetches from page 1

Cache keys are now per-page: `ahyp2_chan_{slug}_p1`, `ahyp2_chan_{slug}_p2`, etc.

### Rate limit handling
- `fetchArena(url)`: wrapper around `fetch()` with 429 retry and backoff (2s → 4s → 8s), reads `Retry-After` header if present, shows "Rate limited — retrying in Xs…" in the status bar
- `FETCH_PAGE_DELAY = 150ms`: pause between page requests within a single channel fetch
- Constants: `FETCH_PAGE_DELAY`, `RETRY_DELAYS = [2000, 4000, 8000]`

### SoundCloud prefetching
- `setupSCWidget(playlistUrl)` is now idempotent — guarded by `scSetupUrl` tracker, no-op if same URL already loading
- `go()` calls `setupSCWidget()` immediately on press (before any channel fetching), so the SC iframe loads in parallel
- `tryStartAudio()` checks `scReady` — if already ready, shows "♪ Mute" immediately rather than "♪ Loading…"

### API key persistence
Previously: API key was not saved to `localStorage`, so search queries would fail with 401 on reload.

Now: `apiKey` is included in `savePrefs()` and restored in `loadPrefs()` (also sets the input field value). The token is read-only and stored client-side, same behaviour as the audio URL.

### Advanced settings accordion
Search, Music, and API key sections moved behind a `<details>` accordion, closed by default. Basic users only see channel inputs and the Go button.

Default channels are defined as constants and clearly marked in the code:
```js
// ── DEFAULT CHANNELS ──────────────────────────────────────────────
const DEFAULT_IMAGE_CHANNELS = [...]
const DEFAULT_TEXT_CHANNELS  = [...]
```

### Info panel links
`sourceToArenaUrl(src)` helper converts a source tag to the correct are.na URL:
- Channel slug `public-domain-hciljwrdeai` → `https://www.are.na/channel/public-domain-hciljwrdeai`
- Search query `old photos` → `https://www.are.na/search?q=old%20photos`
- `(recent public)` → `https://www.are.na/explore`

### UI additions
- **Info panel close button**: `×` button (`#debug-close`) in the top-right corner of the panel
- **Fullscreen button**: `⛶ Full` / `✕ Exit Full` toggle in the control strip, using the Fullscreen API with `fullscreenchange` listener

### CSS variable extraction
All hardcoded values extracted to `:root`. 37 custom properties in seven groups: typography, layout, transitions, backgrounds, borders, text (11 steps), links, semantic colours, go button, display overlay controls. See the `:root` block at the top of `<style>` for full documentation.

---

## Changes: arena-palette

**File:** `arena-palette/src/main.js` (rebuild with `build.py` after any change)

### Export colour name fix
All export functions were looking up `currentColorNames[hex.toLowerCase()]` where `hex` included the `#` prefix. The map is keyed without `#`. Fixed globally with `.slice(1)`:
```js
currentColorNames[hex.slice(1).toLowerCase()]
```
Affected: `colourTitle`, `exportHex`, `exportRgb`, `exportHsl`, `exportCss`, `exportScp`, `exportAse`, `exportGpl`, `exportProcreatePalette`.

### Default colour count
`DEFAULT_SETTINGS.colorCount`: 7 → 6.

### Theme toggle position
Moved from sidebar to `position: fixed; top: 1rem; right: 1rem` — always visible regardless of scroll.

---

## Changes: arena-picks

**File:** `are.na-picks/index.html`

### Single-board bug
`settingsBoardSlugs` initialised as `['', '', '', '']` — only one board filled meant only 1 slug saved. Fixed: initialise as `['']`, `applySettings()` reads slugs from DOM:
```js
const boards = Array.from(
  document.querySelectorAll('#board-inputs .settings-text-input')
).map(inp => parseArenaSlug(inp.value.trim())).filter(Boolean);
```

### Rounded corners
Removed `border-radius` from `.card`, `.hdr-btn`, `.lock-btn`, `.card-type`, `.error-card`.

---

## SEO metadata

All four pages (`docs/index.html`, `arena-hypernormalisation.html`, `arena-palette.html`, `arena-picks.html`) now have:
- `<meta name="description">`
- `<link rel="canonical">`
- Full `og:type`, `og:url`, `og:title`, `og:description`, `og:image`
- `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`

OG images use the screenshots in `docs/` via absolute `mildlydiverting.github.io` URLs.

---

## Current state: `channelPageState` and state object

The hypernormalisation state object `S` (current as of 30 May 2026):
```js
const S = {
  imageChannelSlugs,  // string[]
  textChannelSlugs,   // string[]
  searchQueries,      // string[] ('' = recent public)
  blocklist,          // number[] — user block IDs to skip; persisted
  audioUrl,           // string — persisted
  apiKey,             // string — persisted
  allImages,          // {url, alt, source}[]
  allTexts,           // {content, source}[]
  imageSources,       // {label: count}
  textSources,        // {label: count}
  imageBag,           // ShuffleBag
  textBag,            // ShuffleBag
  history,            // {imageUrl, imageAlt, imageSrc, text, textSrc, color}[]
  historyPos,         // number
  loadedImg,          // HTMLImageElement
  currentText,        // string
  currentImageUrl,    // string
  currentImageSrc,    // string — source label (for info panel link)
  currentTextSrc,     // string — source label (for info panel link)
  currentColor,       // hex string
  isPlaying,          // boolean
  playTimer,          // timeout id
  playDelay,          // ms
  controlsTimer,      // timeout id
  transitioning,      // boolean
}
```

Module-level state alongside `S`:
```js
let channelPageState = {};   // { [slug]: { nextPage: number, exhausted: bool } }
let scSetupUrl       = null; // idempotency guard for setupSCWidget
let scWidget         = null;
let scReady          = false;
let audioMode        = 'none'; // 'sc' | 'local' | 'none'
```

---

## Deferred / known issues

See updated list in the 30 May 2026 session above.

---

## Possible extensions (noted in conversation)

- **Crossfade** between slides — re-introduce `fade()` with a longer duration and a back-canvas
- **Adjustable text colour palette** in settings
- **Export as video** — `canvas.captureStream()` + `MediaRecorder`
- **Draggable text position** on the canvas
- **Dark mode for the palette tool** — CSS variables are already in place in hypernormalisation; palette has its own token system

---

*May 2026.*
