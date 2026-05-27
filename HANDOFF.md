# Handoff — are.na toolkit, May 2026

This document covers all changes made in the May 2026 session. It supersedes `arena-hypernormalisation/HANDOFF.md`, which is now outdated (references v2 API and old state structure).

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

The hypernormalisation state object `S` now includes:
```js
const S = {
  imageChannelSlugs,  // string[]
  textChannelSlugs,   // string[]
  searchQueries,      // string[] ('' = recent public)
  audioUrl,           // string — persisted
  apiKey,             // string — persisted (new this session)
  allImages,          // {url, source}[]
  allTexts,           // {content, source}[]
  imageSources,       // {label: count}
  textSources,        // {label: count}
  imageBag,           // ShuffleBag
  textBag,            // ShuffleBag
  history,            // entry[]
  historyPos,         // number
  loadedImg,          // HTMLImageElement
  currentText,        // string
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

- **SoundCloud 30-second preview cap** — third-party uploaded tracks are capped at 30s for unauthenticated widget users. Platform limitation, not fixable without SC auth.
- **CORS on PNG export** — some are.na image hosts set restrictive CORS headers; export may fail or produce a blank canvas. Not fixable without a proxy.
- **localStorage quota** — with many large channels the 24h cache can fill the 5–10MB browser quota. "Clear all cache" in the Info panel frees it.
- **Search with no token** — v3 search requires auth even for public content. The error message is clear but it's a UX friction point. Could consider showing a warning badge on the accordion when search queries are saved but no token is set.
- **`fetchChannelContents` (old paginator)** — still present in the file, now unused. Can be removed on the next pass.
- **Hypernormalisation HANDOFF.md** — `arena-hypernormalisation/HANDOFF.md` is outdated. Superseded by this document. Can be replaced with a brief pointer.

---

## Possible extensions (noted in conversation)

- **Crossfade** between slides — re-introduce `fade()` with a longer duration and a back-canvas
- **Adjustable text colour palette** in settings
- **Export as video** — `canvas.captureStream()` + `MediaRecorder`
- **Draggable text position** on the canvas
- **Dark mode for the palette tool** — CSS variables are already in place in hypernormalisation; palette has its own token system

---

*May 2026.*
