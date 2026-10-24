# arena-hypernormalisation — notes

Internal notes for the Hypernormalisation slideshow. For user-facing docs see `README.md` in this folder; this file holds the state architecture, technical details and deferred items.

Extracted from HANDOFF.md (May 2026) during the October 2026 docs tidy-up.

---

## State object `S` (as of 30 May 2026)

The single state object the tool keeps in memory:

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

## Incremental pagination

- `go()` fetches **page 1 only** for each channel.
- `channelPageState` tracks per-channel pagination.
- Every 25 slides, `refreshPool(silent=true)` fetches the next page of each non-exhausted channel and appends items to the live pool / shuffle bags — no interruption to playback.
- The slide timer acts as a natural API throttle — top-ups happen ~every 4 minutes at default 10s/slide.
- "↻ Fetch fresh" in the Info panel resets `channelPageState`, clears per-page cache, re-fetches from page 1.

Cache keys are per-page: `ahyp2_chan_{slug}_p1`, `ahyp2_chan_{slug}_p2`, etc. 24-hour TTL. Stale entries are deleted on read. Search queries are cached per query string, same TTL. Prefs (channels, blocklist, API key and so on) are stored separately in `localStorage` and never expire. The Info panel's "Clear all cache" wipes every cached entry; the next Go re-fetches.

---

## Rate limiting

- `fetchArena(url)` wraps `fetch()` with 429 retry and backoff.
- `FETCH_PAGE_DELAY = 150ms` — pause between page requests within a single channel fetch.
- `RETRY_DELAYS = [2000, 4000, 8000]` — backoff schedule. Reads `Retry-After` header if present.
- Shows "Rate limited — retrying in Xs…" in the status bar during the wait. After three retries it makes one final attempt and then fails.

---

## SoundCloud behaviour

- `setupSCWidget(playlistUrl)` is idempotent — guarded by `scSetupUrl`, no-op if same URL already loading.
- `go()` calls `setupSCWidget()` immediately, so the SC iframe loads in parallel with channel fetching.
- Muted by default on Go — user must press ♪ Music to start playback.
- When exhausted, playlist reshuffles (guaranteed different order).
- Direct MP3/OGG URL or local file plays via a standard `<audio>` element at 50% volume, looping.
- The default audio is a hardcoded SoundCloud playlist (`soundcloud.com/mildlydiverting/sets/are-na-hypernormalisation`); a SoundCloud playlist URL, a direct MP3/OGG URL or a local file overrides it.
- The SoundCloud widget loads in a hidden 1×1px iframe and the SC Widget API controls playback. On load it fetches every track in the playlist and shuffles them; the widget prefetches and cues the first track on Go but does not auto-play.
- The ♪ Music button toggles mute/unmute and is hidden if no audio is configured. Returning to Setup pauses audio.

---

## Alt text

`blockAlt(b)` builds an alt string from the v3 API response, in order of preference:

1. `image.alt_text` (if set by the are.na user)
2. `title` (if not a bare filename like `IMG_4032.jpg`)
3. First line of `description.plain`
4. `"Image from are.na"` as fallback

`extractImages` maps `{ url, alt, source }`. History entries carry `imageAlt`. `showEntry` sets `canvas.aria-label` to `"[alt] — [caption text]"` on each slide render.

Other accessibility work: all form inputs are associated with visible `<label>` elements; dynamic regions (`#status`, `#error-area`, `#audio-status`) use `aria-live`; toggle buttons use `aria-pressed`; chip remove buttons have descriptive `aria-label` values.

---

## v3 API field map (migrated from v2)

- `b.type` not `b.class` — values: `"Image"`, `"Text"`, `"Link"`, `"Attachment"`, `"Media"`, `"Channel"`
- `b.image.src` not `b.image.display.url`
- `b.content.plain` not `b.content` (was a string in v2; now an object)
- Channel response: `{ data: [...blocks], meta: { has_more_pages: true, total_count: 412 } }`
- v3 search requires authentication — 401 without token even for public content

---

## Blocklist

- `DEFAULT_BLOCKLIST_IDS` — hardcoded `Set` of block IDs permanently excluded (currently: `46541568`). Never shown in UI.
- `S.blocklist` — user-managed array of block IDs, persisted in `localStorage`. UI in Advanced Settings: paste a full `are.na/block/…` URL, shown as removable chips.
- `isBlocklisted(b)` — checks both sets before `extractImages` / `extractTexts` map their blocks.
- Block URLs are parsed to extract the integer ID; only the ID is stored.

---

## Deferred / known issues

- `fetchChannelContents` (old all-pages paginator) still present, now unused — remove on next pass.
- Add "Reset defaults" button for the edge case: clear cache + remove all channels → Go greys out.
- Search with no token: v3 requires auth even for public content. Error is clear but UX friction remains.
- SoundCloud 30-second preview cap — platform limitation.
- CORS on PNG export — some are.na hosts restrict cross-origin; export may fail or produce blank canvas.
- `localStorage` quota (5–10 MB) — "Clear all cache" in Info panel frees it.

---

## Possible extensions

- Crossfade transitions between slides (re-introduce `fade()` with a longer duration and a back-canvas)
- Adjustable text colour palette in settings
- Video export via `canvas.captureStream()` + `MediaRecorder`
- Draggable text position on the canvas
