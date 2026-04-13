# arena-palette — context note for new chat

## What we're working on

`arena-palette` is a local single-file HTML tool that fetches images from up to 4 Are.na channels, extracts a colour palette from a selected image, and displays tints/shades plus a semantic palette. It's part of a planned suite of local Are.na browser tools called `are.na-toolkit`, which lives at `~/Development/are.na-toolkit/`.

The current file is `arena-palette.html` (v1.19), located at:
`~/Development/are.na-toolkit/arena-palette/dist/arena-palette.html`

Companion project: `are.na-picks` (separate public repo, already on GitHub), which shares the same two-step API fetch pattern.

---

## Current file state (v1.19)

**Key dependencies:**
- Color Thief v3 (unpkg CDN) — MMCQ palette + swatch extraction
- JSZip 3.10.1 (cdnjs) — zip export
- Karla + Courier Prime (Google Fonts)

**Architecture — must preserve:**
- Are.na API v3 (`https://api.are.na/v3`). Never v2.
- Image URLs: `image.src` (original), `image.small.src` (thumbnail)
- Two-step random fetch: channel meta for total count → `per=1&page={random}` with up to 12 retries to land on an Image block
- `currentImageEl` caches the loaded `HTMLImageElement` — settings changes call `runExtraction()` directly, never `selectImage()`, so no unnecessary API hits
- Color Thief v3: use `c.array()` for `[r,g,b]`, not `.rgb` or `._r._g._b`
- `applyFloor(items, minProp)` shared helper normalises proportions (1% floor for main bar, 5% for semantic bar)

**Layout (v1.19 — clean rewrite):**
- Outer layout: flexbox row. Sidebar fixed `22rem`, main `flex:1 min-width:0`
- Responsive: desktop (>1200px) image | palettes side by side; tablet (600–1200px) stacked; mobile (<600px) full stack, sidebar full width, thumbs 3-column
- Image container: no `aspect-ratio` — scales with `width:100%; height:auto; max-height:70vh`
- `overflow-x:hidden` on body; `min-width:0` on all flex/grid children that need to shrink

**CSS system:**
- `font-size: 62.5%` on `:root` so `1rem = 10px`. All sizing in rem.
- Colours: mid-grey palette (`--bg: #808080`, `--surface: #8a8a8a`, `--surface2: #747474`, `--border: #666666`, `--text: #efefef`, `--muted: #b8b8b8`, `--accent: #2a2a2a`)
- Fonts: Karla (`--font-sans`) for all UI text; Courier Prime (`--font`) for hex/code output only (swatch hex reveal, version badge)

**Swatch hex reveal:**
- Hex text sits inside each swatch, coloured to match the swatch background (invisible at rest)
- On hover/focus, `color` switches to the appropriate light/dark text colour via JS event listeners
- Click copies hex to clipboard
- No tooltip overlay — removed in v1.12

**Image caption:**
- Below the selected image (outside the image container), inside `.image-figure`
- Shows block title (if set) and "view on are.na ↗" link to `https://www.are.na/block/{id}`

---

## What was done this session (2026-04-13)

v1.8–v1.19 were all done in one session. Key changes in order:

- **v1.8–v1.9:** Typography update (Karla + Courier Prime), rem unit pass, base font size 16px
- **v1.10:** Mid-grey colour scheme, font pass (Karla for UI, Courier Prime for hex only)
- **v1.11:** "Tints & shades" section heading with rule, matching semantic palette style
- **v1.12:** Replaced swatch tooltip with inline hex reveal
- **v1.13:** Image caption with block title + are.na link
- **v1.14:** Layout restructure — thumbnails to sidebar (2-col grid), main is just image + palette
- **v1.15–v1.18:** Responsive layout fixes (multiple iterations)
- **v1.19:** Clean layout rewrite — flexbox structure, removed aspect-ratio, overflow-x fix

## Done in Claude Code session (2026-04-13)

- The git repo (`are.na-toolkit`) initialised locally and pushed to GitHub
- The build system (Python concat script to assemble from `src/` files) written and working
- Source file split (into `src/style.css`, `src/main.js`, `src/index.html` etc.) 

---

## Known issues / next steps

- Some minor spacing "funkiness" at certain breakpoints — not yet investigated
- RampenSau integration for hue-shifted tints/shades: prototyped previously but set aside — may revisit
- `shared/arena-api.js` not yet extracted from the monolith

## Working approach

Kim prefers:
- Iterative, targeted changes — not large rewrites unless necessary
- Version note in file header
- changelog stored as a seperate changelog.md file
- Screenshots to communicate layout issues
- Understanding the root cause alongside any fix
- Learning as she goes along
- clean, modular, semantic code, accessible with progressive enhancement, CSS CUBE https://cube.fyi , component libraries and design systems https://atomicdesign.bradfrost.com/table-of-contents/ building to style guides
- eleventy https://www.11ty.dev  hugo https://gohugo.io/documentation/ as ssgs if needed
- Uploading the current HTML file to the chat to share it (GitHub raw URL fetch also works once the repo is public)
- British English
