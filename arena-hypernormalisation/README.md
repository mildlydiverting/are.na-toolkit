# Are.na Hypernormalisation

![Screenshot from Are.na Hypernormalisation showing a woman performing an acrobatic strech and the words "NO, ITS FINE, REALLY"](../docs/arena-hypernormalisation3.jpg)

**[Try it](https://mildlydiverting.github.io/are.na-toolkit/arena-hypernormalisation.html)**

Pull images and text from are.na channels and combine them into a strangely familiar documentary critique of late capitalism. Inspired by [Adam Curtis](https://www.bbc.co.uk/webarchive/https%3A%2F%2Fwww.bbc.co.uk%2Fblogs%2Fadamcurtis%2Fentries%2F02d9ed3c-d71b-4232-ae17-67da423b5df5), [Tom Scott](https://www.tomscott.com/infinite-adam-curtis/), and [Dan Williams](https://www.iamdanw.com).

Good for full-screen ambient displays, or just staring into the void. Feel free to add to the default [images](https://www.are.na/kim-plowright/hypernormalisation-images) and [text fragments](https://www.are.na/kim-plowright/hypernormalisation-text) channels on are.na.

**What it does:**
- Fetches images and short text blocks from any public are.na channels you specify
- Composites them into full-screen intertitle slides: bold uppercase text over a background image, in white, blue, magenta, or red
- Plays automatically on a timer (3–30 seconds per slide, adjustable)
- Shuffles content so every item appears before any repeats
- Lazily fetches deeper pages in the background as you watch — the slide playback rate acts as a natural API throttle
- Optional SoundCloud or local audio soundtrack
- Export any frame as a 1920×1080 PNG

**Advanced settings** (collapsed by default, in order): access token for private channels, keyword search, block blocklist, custom audio.

**File:** `index.html` in this folder — a single self-contained file, about 2000 lines.

## Setup screen

| Field | What to enter |
|---|---|
| Image channels | are.na channel URLs or slugs — images become backgrounds, default https://www.are.na/kim-plowright/hypernormalisation-images |
| Text channels | are.na channel URLs or slugs — text blocks become captions, default https://www.are.na/kim-plowright/hypernormalisation-text |
| (Advanced) Access token | Optional. Needed for private channels and search. Get it at [are.na → Settings → Developers](https://www.are.na/developers/personal-access-tokens). Saved to `localStorage`. |
| (Advanced) Search are.na | Optional. Keyword(s) to search public are.na blocks; leave blank for recent public blocks. Requires access token. |
| (Advanced) Block blocklist | Optional. Paste are.na block URLs to exclude specific blocks from the canvas. |
| (Advanced) Music | Optional. SoundCloud playlist URL, direct MP3/OGG URL, or local audio file. Muted by default — press ♪ Music to start. |

Enter key submits any text field. Channels accept full URLs (`https://www.are.na/user/slug`) or bare slugs. Settings (channels, searches, audio URL) persist across sessions via `localStorage`.

## Display mode

### Keyboard shortcuts

| Key | Action |
|---|---|
| `→` or `N` | Next slide |
| `←` or `P` | Previous slide |
| `Space` | Play / Pause autoplay |
| `M` | Toggle music |
| `S` | Save PNG |
| `D` | Toggle Info Panel |
| `Escape` | Back to setup |

### Controls bar (bottom)

Fades in on mouse movement, out after ~3 seconds. Click the canvas to toggle.

`⚙ Setup` — returns to settings (stops playback and audio)  
`◈ Info` — opens Pool Inspector panel (right side)  
`◀ Prev` / `▶ Play` / `Next ▶` — navigation and autoplay  
`Speed` — slider, 3–30 seconds per slide  
`♪ Music` — toggle audio (hidden if no audio source set)  
`↓ Save PNG` — exports current frame at 1920×1080

### Info / Pool Inspector / Stats panel

Shows live state of the content pool. Accessible via `◈ Info` button or `D` key.

- **Pool** — "↻ Fetch fresh" button: clears cache for all active sources and re-fetches, merging only new items into the live bags without interrupting playback. "✕ Clear all cache" wipes every cached entry.
- **Images / Texts** — total pool size, items remaining until a full repeat cycle, and per-source breakdown.
- **History** — how many slides have been shown and current position (for back/forward).
- **Cache entries** — each cached key with age, green (fresh) or red (expired). Each has its own `✕` delete button.

## Good to know

- **Caching.** Channel content is kept in your browser for 24 hours, so reloading is quick and are.na isn't asked again. Your settings (channels, blocklist, token) are stored separately and never expire.
- **Polite to are.na.** It waits 150ms between page requests and, if are.na asks it to slow down, backs off (2s, 4s, 8s) with a countdown in the status bar.
- **Music** is muted until you press ♪ Music. Returning to Setup pauses it.
- **Accessibility.** Every slide has a text description for screen readers: the image's alt text if it has one, otherwise its title or the first line of its description, followed by the caption. Form fields have visible labels, status messages are announced, and toggle buttons say whether they are on.

For how it works inside (state, pagination, rate limiting, SoundCloud, blocklist, alt text), see [`NOTES.md`](NOTES.md).
