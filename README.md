# are.na toolkit

Browser tools for working with [are.na](https://www.are.na). Vanilla JS, no framework, no accounts, no backend. Open a page and go.

**[→ All tools](https://mildlydiverting.github.io/are.na-toolkit/)** · Built by [Kim Plowright](https://www.are.na/kim-plowright/channels)

---

## The tools

Each tool has its own folder with a README: what it does, how to use it and how to build it.

| Tool | What it does | Try it |
|---|---|---|
| **[Hypernormalisation](arena-hypernormalisation/)** | Turns images and text from are.na channels into full-screen intertitle slides, for ambient displays or staring into the void. Optional soundtrack, export any frame as a PNG | [Open](https://mildlydiverting.github.io/are.na-toolkit/arena-hypernormalisation.html) |
| **[Palette](arena-palette/)** | Extracts colour palettes from the images in your channels, names the colours, and exports them in the formats your tools need | [Open](https://mildlydiverting.github.io/are.na-toolkit/arena-palette.html) |
| **[Picks](arena-picks-ref/)** | A random-block browser for finding things you forgot you'd saved. Source lives in its own repo | [Open](https://mildlydiverting.github.io/are.na-toolkit/arena-picks.html) |
| **[Merge](arena-merge/)** | Adds every block from one channel into another in one go, with a dry run first. Needs a write token | [Open](https://mildlydiverting.github.io/are.na-toolkit/arena-merge.html) |
| **[Palimpsest](arena-palimpsest/)** | Paste a block and see everything are.na knows about it, including custom metadata, which you can edit on blocks you own | [Open](https://mildlydiverting.github.io/are.na-toolkit/arena-palimpsest.html) |
| **[Duplicate Finder](arena-duplicate-finder/)** | Finds blocks you've saved more than once, lets you pick the one to keep, and merges the rest onto it. Needs a write token | [Open](https://mildlydiverting.github.io/are.na-toolkit/arena-duplicate-finder.html) |
| **Uploader** (`arena-uploader/`) | A Python prototype for moving Pinterest saves into are.na. Not finished, and not live | — |

---

## What they share

- **Vanilla JS only.** Hypernormalisation and Picks are hand-written single files. Palette is assembled from `src/` by a small Python script. Merge, Palimpsest and Duplicate Finder are built from `src/` by a small Node script. Either way, every tool ships as **one HTML file** you can open directly or serve with `python3 -m http.server`.
- **are.na API v3** (`https://api.are.na/v3/`) only.
- **One look.** The newer tools use the Arena Toolkit design system (four themes: Light, Dusk, Dark, Dawn, plus System). Its code lives in [`shared/ui/`](shared/ui/README.md).
- **Polite to are.na.** Requests are paced, and the tools back off when are.na asks them to slow down.
- **Everything stays in your browser.** Preferences, tokens and cached content go in `localStorage`. There is no tracking, no ads and no account.

### Access tokens

Needed only for private channels, keyword search (a v3 API restriction) and anything that changes your account. Get one at [are.na → Settings → Developers](https://www.are.na/developers/personal-access-tokens). Read access is enough for most tools. **Merge, Duplicate Finder and editing in Palimpsest need write access.** A token is only ever sent to are.na.

---

## Running and building

```bash
python3 -m http.server 8080            # serve the repo; canvas export needs http, not file://
# or serve only what the live site serves:
python3 -m http.server 8000 --directory docs

npm install                            # once
npm test                               # Vitest: pure logic and shared code
node arena-palimpsest/build.js         # src/ → dist/ (also arena-merge, arena-duplicate-finder)
node arena-palimpsest/build.js --docs  # …and copy to docs/ for GitHub Pages
node scripts/build-all.js --docs       # every tool that has a build.js
python3 arena-palette/build.py         # Palette only; copy dist/arena-palette.html to docs/
```

`docs/` is the GitHub Pages root, so copy a tool's built file there after any change.

---

## Repo structure

```
are.na-toolkit/
├── docs/                          # GitHub Pages: the live tools, screenshots, index.html
├── arena-hypernormalisation/      # single-file tool (+ README, NOTES)
├── arena-palette/                 # src/, dist/, build.py
├── arena-picks-ref/               # reference copy of Picks (source: the are.na-picks repo)
├── arena-merge/                   # src/, dist/, build.js
├── arena-palimpsest/              # src/, dist/, build.js
├── arena-duplicate-finder/        # src/, dist/, build.js
├── arena-uploader/                # Python prototype
├── shared/
│   ├── ui/                        # the design system (a copy of the claude.ai artifact; see its README)
│   ├── api/                       # are.na client, request throttle, URL helpers
│   └── widgets/                   # connect (token) step, channel picker and finder
├── scripts/                       # @include resolver and build-all
├── AGENTS.md, CLAUDE.md           # state of play and rules, for people and AI agents picking this up
└── README.md
```

---

## Working on it

Start with [`AGENTS.md`](AGENTS.md) (what exists, what's in progress, how to set up) and [`CLAUDE.md`](CLAUDE.md) (the rules). Each tool's `NOTES.md` or `CONTEXT.md` holds its technical detail.

*Open source under the [MIT licence](https://github.com/mildlydiverting/are.na-toolkit/blob/main/LICENSE): do what you like with it. Found a bug? [Open an issue](https://github.com/mildlydiverting/are.na-toolkit/issues).*
