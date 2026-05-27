# are.na toolkit

Browser tools for working with [are.na](https://www.are.na). Vanilla JS, no build step, no accounts — open a file and go.

**[→ All tools](https://mildlydiverting.github.io/are.na-toolkit/)** · Built by [Kim Plowright](https://www.are.na/kim-plowright/channels)

---

## Are.na Hypernormalisation

![Screenshot from Are.na Hypernormalisation showing a monochrome photograph with bold white text overlay reading "NOBODY KNOWS WHAT THEY ARE DOING"](docs/arena-hypernormalisation3.jpg)

**[Try it](https://mildlydiverting.github.io/are.na-toolkit/arena-hypernormalisation.html)**

Pull images and text from are.na channels and combine them into a strangely familiar documentary critique of late capitalism. Inspired by [Adam Curtis](https://www.bbc.co.uk/webarchive/https%3A%2F%2Fwww.bbc.co.uk%2Fblogs%2Fadamcurtis%2Fentries%2F02d9ed3c-d71b-4232-ae17-67da423b5df5), [Tom Scott](https://www.tomscott.com/infinite-adam-curtis/), and [Dan Williams](https://www.iamdanw.com).

Good for full-screen ambient displays, or just staring into the void.

**What it does:**
- Fetches images and short text blocks from any public are.na channels you specify
- Composites them into full-screen intertitle slides: bold uppercase text over a background image, in white, blue, magenta, or red
- Plays automatically on a timer (3–30 seconds per slide, adjustable)
- Shuffles content so every item appears before any repeats
- Lazily fetches deeper pages in the background as you watch — the slide playback rate acts as a natural API throttle
- Optional SoundCloud or local audio soundtrack
- Export any frame as a 1920×1080 PNG

**Keyboard shortcuts:** `→`/`N` next · `←`/`P` prev · `Space` play/pause · `M` music · `S` save PNG · `D` info panel · `Esc` back to setup

**Advanced settings** (collapsed by default): keyword search, custom audio, access token for private channels.

**File:** `arena-hypernormalisation/index.html` — single self-contained file, ~2000 lines.

---

## Are.na Palette

![Screenshot from Are.na Palette showing a three-column layout with image thumbnails, a selected photograph, and an extracted colour palette with tints and shades](docs/arena-palette.jpg)

**[Try it](https://mildlydiverting.github.io/are.na-toolkit/arena-palette.html)**

Extract colour palettes from images in your are.na channels. Click an image to pull its dominant colours, name them, and export in whatever format your tools need.

**What it does:**
- Fetches image blocks from one or more are.na channels
- Extracts dominant colours using [Color Thief](https://lokeshdhakar.com/projects/color-thief/)
- Names each colour via the [color.pizza API](https://github.com/meodai/color-name-api)
- Generates tints and shades for each colour
- Builds a semantic palette: dominant, accent, background, highlight, contrast
- Proportion bar showing the visual weight of each colour
- Dark / mid / light theme toggle for previewing palettes in context

**Export formats:** hex list · RGB · HSL · CSS custom properties · SCP JSON · Adobe Swatch Exchange (.ase) · GIMP palette (.gpl) · Procreate palette (.palette) · PNG swatch sheet

**Build:** `arena-palette/src/` contains `template.html`, `main.js`, and `style.css`. Run `python3 arena-palette/build.py` to produce `arena-palette/dist/arena-palette.html` and copy to `docs/`.

---

## Are.na Picks

![Screenshot from Are.na Picks showing a grid of images and text blocks from are.na channels](docs/arena-picks.jpg)

**[Try it](https://mildlydiverting.github.io/are.na-toolkit/arena-picks.html)**

A random-block browser for are.na channels. Good for creative inspiration, serendipitous juxtaposition, and finding things you forgot you'd saved.

**What it does:**
- Shows a configurable grid of random blocks from one or more are.na channels
- Lock the blocks you want to keep, then shuffle the rest
- Mix images, text, links, and attachments in the same grid
- Export a zip file of your favourite combinations
- Settings panel for channels and display options, persisted in localStorage

**File:** `are.na-picks/index.html` — standalone single file, lives in the sibling `are.na-picks` repo.

---

## Technical notes

All three tools share the same constraints:

- **Vanilla JS only** — no npm, no bundler, no backend
- **Single HTML files** — open directly in a browser or serve with `python3 -m http.server`
- **are.na REST API v3** — `https://api.are.na/v3/` — all API calls use v3 exclusively
- **localStorage** — channel preferences, access tokens, and fetched content (24h TTL) are all stored client-side
- **No tracking, no ads, no accounts** — tools work with your browser and are.na's public API

### Running locally

```bash
# any tool
python3 -m http.server 8080
# open http://localhost:8080/arena-hypernormalisation/
```

CORS on canvas export requires the page to be served (not opened as `file://`).

### are.na access token

Required only for private channels and keyword search (v3 API restriction). Get one at [are.na → Settings → Developers](https://www.are.na/developers/personal-access-tokens). Read-only access is sufficient.

### Palette build

```bash
python3 arena-palette/build.py
# → arena-palette/dist/arena-palette.html
# copy to docs/ manually or cp arena-palette/dist/arena-palette.html docs/arena-palette.html
```

---

## Repo structure

```
are.na-toolkit/
├── docs/                          # GitHub Pages — live tools + screenshots
│   ├── index.html                 # Tool directory
│   ├── arena-hypernormalisation.html
│   ├── arena-palette.html
│   ├── arena-picks.html
│   └── *.jpg                      # Screenshots
├── arena-hypernormalisation/
│   └── index.html                 # Single-file tool
├── arena-palette/
│   ├── src/                       # Source files (template, JS, CSS)
│   ├── dist/                      # Built output
│   └── build.py                   # Concat builder
└── are.na-picks/                  # Sibling repo (submodule or separate clone)
    └── index.html
```

---

*Open source — do what you like with it. Found a bug? [Open an issue](https://github.com/mildlydiverting/are.na-toolkit/issues).*
