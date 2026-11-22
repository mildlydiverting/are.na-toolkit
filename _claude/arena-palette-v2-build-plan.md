# arena-palette v2.0 — Build plan

*Written 28 October 2026; checked against the repo 7 November 2026. Lives at `_claude/arena-palette-v2-build-plan.md` (local, uncommitted, like the other plans) with a copy in Project knowledge.*

*Read first, in order: `AGENTS.md`, `CLAUDE.md`, `shared/ui/README.md`, `arena-palimpsest/NOTES.md` (how the build pipeline actually works — supersedes the original architecture plan where they differ), `arena-duplicate-finder/NOTES.md` and its `src/app.js` (the stepped-UI precedent), `arena-palette/CONTEXT.md`, then this top-to-bottom. The original architecture and duplicate-finder plans are not needed; the NOTES files record what was actually built. The starting prompt for the incoming model is in §16.*

---

## 1. What this is

arena-palette v1.24 is a single-screen tool: fetch a grid of images from an are.na channel, click one, extract a palette with tints and shades, export. v2.0 does three things at once, because the architecture plan (§7) says palette migrates the next time it's touched and this is that time:

1. **Migrate** onto the toolkit build pattern — `src/` → `dist/` via Node `build.js` with `@include` markers, `shared/ui/` design system, `shared/api/` client, Vitest for pure logic. Python `build.py` is retired.
2. **Reshape the UI** into the stepped wizard used by arena-merge and arena-duplicate-finder: **Source → Pick image → Base palette → Edit → Ramps → Export**.
3. **Rework ramps and exports** — tints/shades become their own step, normalised in OKLCH, optional at export; the drafted v1.25 formats (ASE, GPL, Procreate) are rolled in.

Important behavioural fact: **palette extracts from one image at a time.** The grid of nine is only for choosing which image. Don't design for multi-image extraction.

### What's in v2.0, v2.1, and backlog

| | Content |
|---|---|
| **v2.0 (this plan)** | migration, six-step UI, Edit (field editing, add/remove/reorder/lock), Ramps step with OKLCH normalisation, v1.25 export formats, base-only / base+ramps export toggle, external colour-search handoffs, the three "Immediate" TODO fixes |
| **v2.1 (next, §14)** | pick-from-image sampling and draggable sample circles; upload back to are.na (write-scope PAT, PNG/ASE blocks with hex metadata, "make a palette channel") |
| **Backlog (NOTES.md)** | everything else from `arena-palette/TODO.taskpaper` — see §14 |

---

## 2. State of play

Read the real files before trusting this table; it's assembled from the handoff docs and `TODO.taskpaper`, not a fresh inspection.

| Thing | Current |
|---|---|
| Source | `arena-palette/src/template.html`, `style.css`, `main.js` (~72 KB); also `bars2-renderer.html` and `dots1-renderer.html` whose use is unknown (fetched at runtime or dead — check) |
| Build | `arena-palette/build.py`, replaces `<!-- INJECT:CSS -->` / `<!-- INJECT:JS -->` in the template |
| Output | `arena-palette/dist/arena-palette.html` → copied to `docs/arena-palette.html` |
| Agent notes | `arena-palette/CONTEXT.md` — read it; becomes `NOTES.md` at the end (or is folded into it) |
| Version | v1.24 shipped. v1.25 patch drafted in `arena-palette/HANDOFF-ase-gpl-procreate.md`, not applied |
| Extraction | Color Thief (does not return pixel positions) |
| Colour names | fetched from color.pizza (`https://api.color.pizza/v1/`) |
| Exports | hex, RGB, HSL, CSS, SCP, PNG |
| Ramps | plain HSL tint/shade scaling, `TINT_STEPS` / `SHADE_STEPS` constants; a RampenSau hue-shift prototype exists somewhere but results were unsatisfactory |
| Known bugs | `?t=` cache-bust causes re-fetch on repeated thumbnail clicks; colour names stripped in the last update; spacing oddities at some breakpoints |
| Backlog | `arena-palette/TODO.taskpaper` — the authoritative list |

### Dependency on `shared/`

Confirmed present on 7 November 2026:

- `scripts/include-resolver.js` (+ tests), `scripts/build-all.js`; root `package.json` with `build`, `build:docs`, `test`; `vitest.config.js`
- `shared/api/arena-client.js`, `throttle.js`, `url-normalise.js` (all tested)
- `shared/ui/tokens.css`, `bundle.css`, `bundle.js`, plus component folders including **ThemeChooser, Checkbox, Radio, Progress, Toast, Notice, StatusMessage, Footer**
- `shared/widgets/auth-step.js`, `channel-picker.js`, `channel-finder.js`

Use these rather than rebuilding anything. A per-tool `build.js` is four lines — copy `arena-duplicate-finder/build.js`.

Palette is read-only in v2.0, so it does **not** need `shared/widgets/auth-step.js`. The existing optional access-token field stays (v3 needs a token for some reads) but it's a plain `Input`, not the write-scope connect flow. That changes in v2.1.

---

## 3. Hard rules

Inherited from `CLAUDE.md` / `AGENTS.md`, plus:

1. **are.na API v3 only.**
2. **150 ms between page fetches; 429 → `[2,4,8]` s backoff honouring `Retry-After`** — via `shared/api/throttle.js`.
3. **Build with `@include` markers.** Edit `src/`, run `node arena-palette/build.js` (`--watch` rebuilds on save; `--docs` copies to `docs/`). There is no dev mode. `build.py` is deleted at the end of the migration, not before the new build is proven.
4. **Vitest for pure logic.** Colour maths, ramp generation, export encoders, input parsing all get `*.test.js`.
5. **Copy `dist/` to `docs/` after any change.** `build.js` does this.
6. **Ask Kim before changing code.** Concise; explain when asked.
7. **British English in UI copy.**
8. **No npm runtime dependencies.** Dev deps (Vitest) are fine. Third-party runtime libraries (Color Thief, culori) are vendored as single files under `src/vendor/` and inlined via `@include`. Check licences and note them in `NOTES.md`.
9. **Arena Toolkit design system, no bespoke components.** If something's missing, propose extending the system rather than one-offing. Any change to `shared/ui/` must also go to the design-system artifact (CLAUDE.md rule 8; read `shared/ui/README.md`) — ask Kim first.
10. **Palette state is held in one plain object `S`** (as hypernormalisation does) so the stepper can move backwards without losing work. Document its shape in `NOTES.md`.

---

## 4. File layout

```
arena-palette/
├── src/
│   ├── index.html              # shell with @include markers (replaces template.html)
│   ├── app.js                  # stepper wiring, state object S, step renderers
│   ├── styles.css              # tool-specific styles only
│   ├── arena-fetch.js          # channel/block fetching (candidate for shared/api/arena-channel.js)
│   ├── extract.js              # Color Thief wrapper → base palette
│   ├── colour.js               # pure: conversions, OKLCH helpers, ΔE, gamut clamp (thin layer over culori)
│   ├── ramps.js                # pure: tone ladder, position marker, hue drift
│   ├── names.js                # color.pizza lookup + cache
│   ├── parse-input.js          # pure: channel slug / are.na URL / block URL → {kind, value}
│   ├── exports/
│   │   ├── text.js             # hex, RGB, HSL, CSS, SCP, GPL
│   │   ├── ase.js              # binary ASE encoder
│   │   ├── procreate.js        # .palette JSON (30 slots, HSB floats)
│   │   ├── png.js              # canvas renderers (existing + E/F layouts if time)
│   │   └── search-links.js     # pure: TinEye / Behance / Designspiration URL builders
│   ├── vendor/
│   │   ├── color-thief.js
│   │   └── culori.js           # single-file build
│   └── *.test.js               # next to the code they test
├── dist/arena-palette.html
├── build.js                    # thin, uses scripts/include-resolver.js
├── README.md                   # user-facing (update)
├── NOTES.md                    # agent-facing: state, S shape, v2.1, backlog
└── TODO.taskpaper              # Kim's list — update, don't replace
```

Delete when done: `build.py`, `src/template.html`, `bars2-renderer.html` / `dots1-renderer.html` *if confirmed dead*.

`src/index.html`:

```html
<!doctype html>
<html data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Arena Palette</title>
  <!-- keep the existing SEO / OG / Twitter metadata block -->
  <!-- @include shared/ui/tokens.css -->
  <!-- @include shared/ui/bundle.css -->
  <!-- @include ./styles.css -->
</head>
<body>
  <main>
    <aside class="step-rail"></aside>
    <section class="step-pane"></section>
  </main>
  <!-- @include shared/ui/bundle.js -->
  <!-- @include ./vendor/color-thief.js -->
  <!-- @include ./vendor/culori.js -->
  <!-- @include shared/api/arena-client.js -->
  <!-- @include shared/api/throttle.js -->
  <!-- @include ./parse-input.js -->
  <!-- @include ./arena-fetch.js -->
  <!-- @include ./colour.js -->
  <!-- @include ./extract.js -->
  <!-- @include ./ramps.js -->
  <!-- @include ./names.js -->
  <!-- @include ./exports/text.js -->
  <!-- @include ./exports/ase.js -->
  <!-- @include ./exports/procreate.js -->
  <!-- @include ./exports/png.js -->
  <!-- @include ./exports/search-links.js -->
  <!-- @include ./app.js -->
</body>
</html>
```

Module convention (as settled in palimpsest — see `arena-palimpsest/NOTES.md`): **source files are ES modules** so Vitest can import them. The include resolver strips `export` and `import … from` when inlining into classic `<script>` tags, so every included file shares one global scope: **top-level names must be unique across all files**, and `export default` is refused. Prefix palette-specific helpers if a name could clash with `shared/`.

---

## 5. Stepped UI — six steps

Mount `ArenaToolkit.Stepper` in the left rail; steps clickable backwards; forward enabled when the step's precondition holds. Theme picker is `ArenaToolkit.ThemeChooser()` in the header, as `arena-duplicate-finder/src/app.js` does it, but passing a `themes` list that adds **Neutral** (`[data-theme="neutral"]`, page `#777777`, perceptual mid-grey L\* 50 — added to `shared/ui/tokens.css` on 22 November 2026 for judging colour work). Neutral is palette-only for now, so it is not in ThemeChooser's default list. It replaces v1's "Mid" theme; ask Kim whether it should be the palette's default. Use the shared Checkbox, Radio, Toast, Notice and Progress components where they fit.

### 1. Source
- `Input` accepting a channel slug, a full are.na channel URL, or a block URL (`parse-input.js` — auto-strip of full URLs already shipped in v1; extend to block URLs, which was a TODO)
- Optional access-token `Input` (type=password, "remember" checkbox, `localStorage` `arena_palette_token`)
- "Fetch" `Button`
- Precondition: channel resolved (meta fetched) **or** block resolved

### 2. Pick image
- Grid of nine `Block` cards from random pages of the channel (existing behaviour, through `arenaClient` + `throttle`)
- **Per-slot refresh** (re-fetch one image) and **per-slot lock** (survives "refresh all") — TODO priority-2 items, natural here
- "Refresh all" respects locks
- If Source was a block URL, this step shows the single block and auto-advances
- Credit block (title / via / source / accessed) shown under the chosen image, as now
- Fixes here: **drop the `?t=` cache-bust**; cache fetched image objects by URL
- Precondition: one image selected

### 3. Base palette
- Chosen image large, left; palette right
- Controls: colour count (default 6), extraction quality
- "Extract again" button
- Names from color.pizza shown under each swatch — **verify the names-stripped regression is fixed here**
- No tints/shades on this step
- Precondition: ≥1 colour

### 4. Edit
v2.0 subset of editability (sampling from the image is v2.1):
- Click swatch → popover (`Modal` or inline `Card`) with hex / RGB / HSL / OKLCH `Input`s and a native `<input type="color">`; edits write back to `S.palette[i]`
- Add swatch (defaults to a neutral mid-grey, then edit) / remove swatch
- Drag to reorder (HTML5 drag or up/down buttons — buttons are fine and more accessible)
- **Lock** a swatch — locked colours survive "Extract again" on step 3
- "Reset to extracted"
- Precondition: none (optional step)

### 5. Ramps
See §6 for the maths.
- "Generate ramps" toggle — off means Export carries base colours only
- Tone count (default 7), top and bottom lightness clamps (sliders, default L 0.95 / 0.20)
- Global hue rotation slider (±30°, default 0)
- Per-ramp hue drift (RampenSau-style, default off) — only if the prototype proves itself on real images during build; otherwise leave the control out and note in NOTES.md
- Display: one horizontal ramp per base colour; the **extracted colour's tone is marked** ("tone 6 of 7")
- Precondition: none

### 6. Export
- **Scope toggle:** "Base only" / "Base + ramps" (disabled if ramps are off)
- Format `Button`s: hex, RGB, HSL, CSS, SCP, GPL, ASE, Procreate, PNG — PNG shows a live canvas preview before download
- "Copy all hex" button (TODO priority-3)
- **Search with these colours:** links that open TinEye Multicolr, Behance, Designspiration with the palette's hex values in the URL (`search-links.js`; each is a pure URL builder, no API). Mark as "opens in a new tab"
- v2.1 hook: leave room in the layout for an "Upload to are.na" panel; don't build it

---

## 6. Ramps — spec for `ramps.js`

All maths in OKLCH via culori ([culori.com](https://culori.com), MIT). Pure, DOM-free, tested.

```js
// tone ladder: evenly spaced lightness values between clamps
export function toneLadder({ tones = 7, lMax = 0.95, lMin = 0.20 }) { … }  // → [0.95, 0.825, …, 0.20]

// one ramp for a base colour
export function rampFor(baseHex, opts) {
  // opts: { tones, lMax, lMin, hueRotate = 0, hueDrift = null }
  // 1. convert base to OKLCH
  // 2. for each L in ladder: { l: L, c: base.c, h: base.h + hueRotate + drift(L) }
  // 3. clamp chroma into sRGB gamut at each step (culori clampChroma)
  // 4. find index whose L is nearest base.l → markerIndex
  // 5. replace that step with the base colour itself (so the extracted colour is in its own ramp verbatim)
  return { steps: [hex…], markerIndex };
}

export function rampsFor(palette, opts) { return palette.map(c => rampFor(c.hex, opts)); }
```

Hue drift, if included: `drift(L) = driftTint * (L - base.l)` for L above base and `driftShade * (base.l - L)` below, with signed degrees — the RampenSau idea without its full curve machinery. Default both 0.

Tests: ladder spacing; marker lands on the right index for a dark and a pale colour; base colour preserved verbatim at the marker; all steps in gamut; hueRotate wraps at 360; `tones = 1` and `lMin ≥ lMax` edge cases.

---

## 7. Exports — `exports/`

- **`text.js`** — existing hex / RGB / HSL / CSS / SCP, plus GPL (columns hint = tone count when ramps are included, else palette length). Each takes a flat colour list `[ {hex, name} ]` plus a `title`, so the base/ramps toggle just decides which list to pass.
- **`ase.js`** — big-endian binary, magic `ASEF`, flat groups (nesting unreliable). From the v1.25 draft; add `downloadBinary`.
- **`procreate.js`** — JSON, exactly 30 slots, HSB floats 0–1, null-padded. If base+ramps exceeds 30, export base colours first then fill with ramps in order, and warn.
- **`png.js`** — the existing canvas renderer, refactored to take the same flat list. The E / F layouts and PNG `tEXt` metadata from the TODO are backlog, not v2.0 — unless the refactor makes them trivial.
- **`search-links.js`** — pure URL builders:
  - TinEye Multicolr: `https://tineye.com/labs/multicolr` — check the live URL scheme for passing colours; if it doesn't accept query params, drop it
  - Behance: `https://www.behance.net/search/projects?color_hex=<hex>` (single colour; link per swatch or first colour)
  - Designspiration: `https://www.designspiration.com/search/saves/?q=%23<hex1>%20%23<hex2>`
  Tests: encode correctly, strip `#`, cap at each site's limit.

Export encoders are the best test targets in the tool — byte-exact assertions for ASE headers, JSON shape for Procreate, string snapshot for GPL/SCP.

---

## 8. State — `S`

```js
S = {
  source:   { kind: 'channel'|'block', slug, id, meta },
  token:    '',                             // also in localStorage if "remember"
  grid:     [ { block, locked: false } × 9 ],
  image:    { block, img, credit },         // the chosen one
  extract:  { count: 6, quality: 10 },
  palette:  [ { hex, name, locked: false, source: 'extracted'|'edited'|'added' } ],
  ramps:    { enabled: false, tones: 7, lMax: 0.95, lMin: 0.20, hueRotate: 0, drift: {tint:0, shade:0}, result: null },
  export:   { scope: 'base'|'all' },
  step:     1
}
```

localStorage keys, all `arena_palette_*`: `token`, `remember`, `last_source`, `theme`, `settings` (extract + ramps options). No palette persistence in v2.0 — reload starts fresh, which matches v1.

---

## 9. Shared-code extraction

Per the promotion rule (architecture plan §4): code moves to `shared/` only when a second tool needs it.

- `arena-fetch.js` (channel meta, block-at-random-page) is wanted by arena-picks too (`TODO.taskpaper` "Future" section). Write it clean inside palette now with a `shared/api/arena-channel.js`-shaped interface, and note in `NOTES.md` that it's ready to promote the day picks migrates. **Don't move it yet.**
- `parse-input.js` overlaps the palimpsest plan's parser; same note.
- Nothing from `colour.js` / `ramps.js` goes shared — palette-specific.

---

## 10. Build order

Each step: `node arena-palette/build.js --docs`, preview with `python3 -m http.server 8000 --directory docs` → `http://localhost:8000/arena-palette.html` (canvas PNG export fails on `file://`; add `?theme=dusk` etc. to check themes), confirm, ask Kim, commit. `npm test` must stay green.

Git hygiene: `_claude/` and `.claude/` are untracked by choice — never sweep them into commits. Check `git status` before the first commit; anything already modified (e.g. `docs/index.html`) that isn't palette work stays out.

### Phase 0 — read and verify (no writes)
1. Read `scripts/include-resolver.js` and `arena-duplicate-finder/build.js`; run `npm test` to confirm the baseline is green
2. Read `arena-palette/src/main.js` end to end. Identify: Color Thief call, color.pizza call, tint/shade code, each export, the `?t=` cache-bust, where names got stripped
3. Check `bars2-renderer.html` / `dots1-renderer.html` — referenced anywhere? If not, flag for deletion
4. Read `arena-palette/HANDOFF-ase-gpl-procreate.md` and `arena-palette/CONTEXT.md`
5. **Report to Kim and wait**, including anything in the real code that contradicts §2

### Phase 1 — migrate, no behaviour change
6. Vendor Color Thief and a single-file culori into `src/vendor/`; note licences
7. Write `build.js` (copy `arena-duplicate-finder/build.js`); `src/index.html` with markers; split `main.js` into the module files of §4 **without changing behaviour**. Keep `build.py` alive in parallel until step 9
8. `npm run test` — add tests for `parse-input.js`, `colour.js`, and the existing text exports (they're already pure)
9. Build, diff against the v1.24 dist behaviour by hand, commit. Delete `build.py` and `template.html`
10. Fix the three "Immediate" bugs: cache-bust, names-stripped, image cache. Commit

### Phase 2 — stepper
11. Replace the single-screen layout with the rail + pane and `ArenaToolkit.Stepper`; port existing UI into steps 1, 2, 3, 6 (Edit and Ramps empty). Swap bespoke CSS for design-system components as you go; keep `styles.css` to layout only
12. Per-slot refresh + lock on step 2
13. `ThemeChooser` in the header, with Neutral added to its `themes` list (§5); remove v1's Dark / Mid / Light toggle and `arena-palette-theme-v1` key; commit

### Phase 3 — Ramps
14. `ramps.js` + tests, green before UI
15. Step 5 UI: toggle, tone count, clamps, hue rotate, ramp display with marker
16. Try hue drift on three real images from Kim's channels; keep or cut
17. Step 6 base/all scope toggle; commit

### Phase 4 — Exports and Edit
18. Apply the v1.25 patch as `exports/ase.js`, `exports/procreate.js`, GPL in `text.js`, with tests
19. PNG preview canvas on step 6; "copy all hex"
20. `search-links.js` + tests; links on step 6
21. Step 4 Edit: swatch popover, add/remove, reorder buttons, lock, reset; commit

### Phase 5 — ship
22. Breakpoint pass (the "spacing funkiness" TODO) — narrow viewport, all five themes (including Neutral)
23. `node arena-palette/build.js --docs` → `docs/arena-palette.html`; new screenshot `docs/arena-palette-preview.jpg`; version string v2.0 in the page
24. `README.md` update; write `NOTES.md` (§15); update `TODO.taskpaper` (strike done, add v2.1); update `AGENTS.md` tool table
25. Commit, push, check GitHub Pages

---

## 11. Testing

**Vitest** (`npm run test` from repo root): `parse-input`, `colour`, `ramps`, `exports/text`, `exports/ase`, `exports/procreate`, `exports/search-links`. Target: every file that has no DOM.

**Manual**: all five themes, including Neutral; a channel with mixed image/text blocks (text blocks must be filtered from the grid); a private channel with token; an image whose palette is mostly pale (marker should land low on the ramp); an image with a near-black colour (chroma clamp should not produce a muddy ramp); open each export in its target app — ASE in Illustrator or Affinity, GPL in Inkscape, Procreate on iPad, SCP in whatever it's for.

---

## 12. Known constraints

- Color Thief gives no pixel positions — fine for v2.0; it's why image sampling (v2.1) needs its own approach
- color.pizza is a third-party API with no auth; cache names by hex in `localStorage` and degrade gracefully if it's down
- Some are.na image hosts block cross-origin canvas reads → PNG export can fail; existing known issue, surface a clear message
- Procreate's 30-slot cap
- Supporter tier — irrelevant in v2.0 (read-only), relevant to v2.1 batch uploads

---

## 13. v2.1 — not building, note the shape

Two features, both deferred deliberately:

**Pick-from-image sampling.** On step 4, click on the image to sample a pixel into the palette; then draggable sample circles on a canvas overlay, re-sampling on release. Needs an image-space colour read (canvas `getImageData`), initial circle placement approximated by nearest-colour search since Color Thief gives no positions. The Adobe Color image tab is the reference.

**Upload to are.na.** Step 6 gains an "Upload" panel: needs the write-scope connect flow (`shared/widgets/auth-step.js`), then (a) PNG export(s) as image blocks in a chosen channel with `metadata` `{ source_block, hex_list, ramps, extracted_at, tool }`, (b) ASE as an attachment block, (c) "make a palette channel" — new channel, original block connected, PNGs, ASE, one block per hex. Single POSTs through `throttle.js` (batch likely 403s on Supporter). Dry-run first, as the duplicate-finder does.

---

## 14. Backlog → `NOTES.md`

Carry these from `TODO.taskpaper` into NOTES.md as the "later" list, so the next agent sees them: PNG layouts E/F and PNG metadata chunks; colour sort before export; Apple CLR export (gist referenced in the TODO); themer.dev handoff; blurhash placeholders; alternative extraction algorithms (img-colors.com, the dev.to article); full RampenSau integration if the simple drift isn't enough; "move extract settings below image" and other layout notes that the stepper may make moot.

---

## 15. `NOTES.md` contents (write at the end)

Current state and version; the `S` shape; module map (one line per file); vendored libraries and licences; what was cut or kept from hue drift and why; the v2.1 spec (§13) and backlog (§14); "where to read next".

---

## 16. Starting prompt for the incoming model

Start Claude Code in `~/Development/are.na-toolkit` and paste this as the first message:

> You're picking up **arena-palette v2.0** in my are.na-toolkit. The plan is `_claude/arena-palette-v2-build-plan.md` (local, untracked — don't commit it). Read its opening paragraph for the reading order, read those files, then read the plan top to bottom.
>
> Then do **Phase 0 only** (§10): read `scripts/include-resolver.js`, run `npm test`, read `arena-palette/src/main.js` end to end, check whether `bars2-renderer.html` / `dots1-renderer.html` are referenced anywhere, and read `arena-palette/HANDOFF-ase-gpl-procreate.md` and `arena-palette/CONTEXT.md`. Don't write or edit any file yet.
>
> Report back with: (1) anything in the real code that contradicts the plan's §2, (2) a one-line-per-function map of `main.js`, (3) the test baseline, and (4) your proposed first commit for Phase 1. Keep it short. Ask me one question at a time if something's unclear. Wait for my go before writing.
>
> Standing rules are in `CLAUDE.md`; the ones that matter most here: ask before changing code; ES-module sources with unique top-level names; Arena Toolkit components only, and no edits to `shared/ui/` without asking; vendored libraries inlined via `@include`, no npm runtime deps; British English in UI copy; `--docs` on every build; never commit `_claude/` or `.claude/`.

Later phases: start each one in a fresh session if the context gets long — "Read `_claude/arena-palette-v2-build-plan.md` and `arena-palette/NOTES.md`, we're on Phase N."
