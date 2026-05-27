# Arena Hypernormalisation — Handoff Document

*Single-file HTML tool. No build step, no dependencies, no server. Open in a browser and go.*

---

## What it does

Pulls images and short texts from are.na channels (and/or are.na keyword search), then composites them into full-screen Adam Curtis–style intertitle slides: bold uppercase text over a background image, in white, blue, magenta, or red. Slides advance automatically or manually. Export any frame as a 1920×1080 PNG.

---

## File

```
arena-hypernormalisation/index.html
```

One self-contained HTML file (~1500 lines). All CSS, JS, and markup are inline. No npm, no bundler, no backend.

---

## How to run

Double-click `index.html`, or serve it locally (required for some browsers' CORS policies on canvas export):

```bash
cd arena-hypernormalisation
python3 -m http.server 8080
# open http://localhost:8080
```

---

## Setup screen

| Field | What to enter |
|---|---|
| Image channels | are.na channel URLs or slugs — images become backgrounds |
| Text channels | are.na channel URLs or slugs — text blocks become captions |
| Search are.na | Keyword(s) to search public are.na blocks; leave blank for recent public blocks |
| Music | SoundCloud playlist URL, direct MP3/OGG URL, or local audio file |
| Access token | Optional. Needed for private channels. Get it at are.na → Settings → Developers. **Not saved to localStorage.** |

Enter key submits any text field. Channels accept full URLs (`https://www.are.na/user/slug`) or bare slugs. Settings (channels, searches, audio URL) persist across sessions via `localStorage`.

---

## Display mode

### Keyboard shortcuts

| Key | Action |
|---|---|
| `→` or `N` | Next slide |
| `←` or `P` | Previous slide |
| `Space` | Play / Pause autoplay |
| `M` | Toggle music |
| `S` | Save PNG |
| `D` | Toggle Stats / Pool Inspector |
| `Escape` | Back to setup |

### Controls bar (bottom)

Fades in on mouse movement, out after ~3 seconds. Click the canvas to toggle.

`◈ Stats` — opens Pool Inspector panel (right side)  
`⚙ Setup` — returns to settings (stops playback and audio)  
`◀ Prev` / `▶ Play` / `Next ▶` — navigation and autoplay  
`Speed` — slider, 3–30 seconds per slide  
`♪ Music` — toggle audio (hidden if no audio source set)  
`↓ Save PNG` — exports current frame at 1920×1080

---

## Pool Inspector (Stats panel)

Shows live state of the content pool. Accessible via `◈ Stats` button or `D` key.

- **Pool** — "↻ Fetch fresh" button: clears cache for all active sources and re-fetches, merging only new items into the live bags without interrupting playback. "✕ Clear all cache" wipes every cached entry.
- **Images / Texts** — total pool size, items remaining until a full repeat cycle, and per-source breakdown.
- **History** — how many slides have been shown and current position (for back/forward).
- **Cache entries** — each cached key with age, green (fresh) or red (expired). Each has its own `✕` delete button.

---

## Content loading

### are.na API

Base URL: `https://api.are.na/v2/`

- Channel contents: `GET /channels/{slug}/contents?per=100&page=N`
- Search: `GET /search?q={query}&per=100&page=N`
- Paginated: fetches all pages (up to 500 for search)
- Auth header: `Authorization: Bearer {token}` (only sent if a token is provided)

### Caching

All fetched data is cached in `localStorage` for 24 hours using the prefix `ahyp2_`. Cache keys:

| Key | Content |
|---|---|
| `ahyp2_chan_{slug}` | Full block array for a channel |
| `ahyp2_srch_{query}` | Full block array for a search |
| `ahyp2_prefs` | User settings (not a cache entry — never expires) |

### Deduplication

After all sources are fetched, images are deduped by URL and texts by content string.

### Block filtering

**Images:** blocks with `class === 'Image'` or `class === 'Link'` where an image object is present. URL priority: `image.display.url` → `image.large.url` → `image.original.url`.

**Texts:** blocks with `class === 'Text'` and `content` present, ≤ 30 words (after stripping HTML), length > 3 characters.

---

## Shuffle bag

Every image and every text is shown once before any repeats (Fisher-Yates shuffle, dealt from a bag). Images and texts are paired independently. When a bag empties it is reshuffled from the full source list.

Auto top-up: every 25 new slides, the pool silently re-fetches all sources (bypassing cache) and injects any new items directly into the current bags. New items appear at the front of the remaining queue.

---

## Rendering

### Display canvas

Sized to fill the viewport at 16:9, letterboxed on black. Resizes on window resize. Rendered with Canvas 2D API.

### Image compositing

Cover-fit: the image is cropped to fill the canvas aspect ratio, centred.

### Text

- Uppercase, bold Arial
- Base font size: 9.6% of canvas height (~104px at 1080p)
- Steps down to 7.6% if > 3 lines, 6.0% if > 5 lines
- Max column width: 82% of canvas width
- Short text (≤ 2 lines): anchored at 55% down; longer: 63% down
- Crisp 2px hard drop shadow (no blur), offset 2×2px
- Colour chosen randomly from: `#FFFFFF`, `#4499FF`, `#FF00CC`, `#FF2222`

### PNG export

Renders to an offscreen 1920×1080 canvas using the same `renderFrame()` function. Re-fetches the image with `crossOrigin: 'anonymous'` to allow `toDataURL()`. Falls back to the already-loaded image if re-fetch fails (canvas will be tainted and export may error on some images).

### Transition

Near-instant cut: black overlay fades to opaque in 60ms, image switches, overlay fades out in 80ms.

---

## Audio

Priority order when Go is pressed:

1. **SoundCloud** — if the audio URL contains `soundcloud.com`, or if no audio URL is set (defaults to the built-in playlist).
2. **Direct URL** — if a non-SoundCloud URL is set, treated as a direct MP3/OGG stream and assigned to an `<audio>` element.
3. **Local file** — if the user selected a local file via the file picker, that object URL is used.

### SoundCloud widget

Loaded via hidden iframe (`width:1px; height:1px; opacity:0`). On `READY`, fetches all track indices via `getSounds()`, Fisher-Yates shuffles them, and calls `skip()` to jump to the first shuffled track. On each `FINISH`, advances to the next track in the shuffled order; reshuffles when exhausted.

SoundCloud 30-second preview limit: third-party uploaded tracks cap at 30s for unauthenticated users — this is a platform limitation and cannot be worked around without API authentication.

Default playlist: `https://soundcloud.com/mildlydiverting/sets/are-na-hypernormalisation`

---

## State object

```javascript
const S = {
  imageChannelSlugs,  // string[]
  textChannelSlugs,   // string[]
  searchQueries,      // string[] ('' = recent public)
  audioUrl,           // string
  apiKey,             // string (never persisted)
  allImages,          // {url}[]
  allTexts,           // {content}[]
  imageSources,       // {label: count} — for debug panel
  textSources,        // {label: count} — for debug panel
  imageBag,           // ShuffleBag instance
  textBag,            // ShuffleBag instance
  history,            // entry[] — for back/forward
  historyPos,         // number
  loadedImg,          // HTMLImageElement
  currentText,        // string
  currentColor,       // hex string
  isPlaying,          // boolean
  playTimer,          // timeout id
  playDelay,          // ms
  controlsTimer,      // timeout id
  transitioning,      // boolean — guards against overlap
}
```

---

## Known limitations

- **CORS on export:** some are.na image hosts set restrictive CORS headers. Export will still work but the downloaded image may lack the background, or show a browser alert.
- **SoundCloud previews:** 30-second cap on third-party tracks without auth.
- **are.na API rate limits:** the API is unauthenticated and may throttle on large fetches. The 24h cache and pagination limit (500 blocks per search) are designed to keep requests reasonable.
- **localStorage quota:** browsers typically allow 5–10MB. With many large channels the cache can fill up; the "Clear all cache" button in the Stats panel frees it.

---

## Possible extensions

- Crossfade between slides rather than a hard cut (re-introduce the fade with a longer duration)
- Adjustable text colour palette in settings
- Support for are.na Link blocks (fetching the Open Graph image from the URL)
- Export as video (canvas `captureStream()` + `MediaRecorder`)
- Draggable text position on the canvas
- Multiple simultaneous text overlays

---

*Built May 2026. Open source, no licence restrictions — do what you like with it.*
