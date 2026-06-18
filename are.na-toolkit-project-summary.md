# are.na-toolkit — Project Summary

Generated 2026-06-18 from 50 project sessions.

---

## 1. are.na Toolkit (Web Tools)

A suite of browser-based tools for working with are.na channels, built as standalone HTML/JS files deployed to GitHub Pages.

**Sub-areas**

- **Hypernormalisation slideshow** — a full-screen are.na channel slideshow with hard-cut transitions, shuffle bag, audio, cache management, blocklist, and accessibility features (`docs/arena-hypernormalisation.html`)
- **Colour palette tool** — extracts and names colours from are.na channel images; hex key bug identified and documented
- **Landing page** (`index.html`) — card-based directory of all tools with refined typography and link styling
- **README and HANDOFF** — launch documentation updated with setup, features, and deployment instructions

**Chats**

- [Arena hypernormalisation tool](https://claude.ai/chat/bf182ddb-6cf5-401e-ab9b-b96509380157) — cache refresh, hard cuts, handoff doc
- [Arena hypernormalisation blacklist](https://claude.ai/chat/b89cece0-3cf1-4f22-b3c0-6b0ac34bed3d) — blocklist, accessibility, alt text
- [Arena palette updates](https://claude.ai/chat/79054343-00bb-4a04-bf1f-6f9c16857c2c) — hex key bug investigation
- [Are.na tools landing page](https://claude.ai/chat/7a133f7f-e50b-4535-907f-c0d5047d98e0) — styling refinements
- [Arena tools launch updates](https://claude.ai/chat/846953cc-964e-4d5d-8845-d84b3a25d35f) — README and HANDOFF for launch

**Todo**

1. Apply the `patchColorLabels` hex key fix (revert `hex.slice(1)` to `hex`) in the palette tool.
2. Test the blocklist and cache refresh together with a large are.na channel; check for race conditions.
3. Push all deployed files to GitHub Pages and cross-browser test the landing page at mobile widths.

---

## 2. Drawing & Teaching Knowledge Base (dt-knowledge-base)

The largest project: a structured Obsidian vault of drawing exercises extracted from teaching books, with artist database, Wikidata/Getty LOD verification, and a teaching skill for Claude.

### 2a. Book extraction

Exercises extracted from drawing manuals in Kim's voice — paraphrased from in-copyright texts, following a strict 9-section template with ILOs, themes, prerequisites, and quote counts.

**Books extracted (as of last session):** Bargue Drawing Course, Nicolaides, Bridget Woods, Mattesi FORCE (3 chapters), Emily Ball, Kaupelis Experimental Drawing (Chs 1–7), Tyler (complete) — 272 exercises across 10 books.

**Chats**

- [Build drawing instruction knowledge base](https://claude.ai/chat/9ce0abaf-21e3-4391-9d08-3968dcc591f6) — initial setup and SKILL.md
- [Next steps for drawing knowledge base](https://claude.ai/chat/faf18099-49cb-4154-9504-c2eed423cced) — Bargue extraction (3 exercises)
- [Work status check](https://claude.ai/chat/cf0366d4-bb02-42c9-8176-22eddfc9c8db) — Mattesi handoff prompt
- [Mattesi FORCE extraction Chapter 1](https://claude.ai/chat/502a6e01-aa90-4009-acc8-8472325496d5) — 14 exercises
- [Mattesi FORCE Chapter 2 extraction](https://claude.ai/chat/081a265d-dc89-4898-bee2-91d3678d405d) — 8 exercises
- [Mattesi Chapter 3 extraction](https://claude.ai/chat/40f1f797-27b7-4bab-b79b-7fa55b0b761d) — Bases views, SCHEMA update
- [Next book extraction planning](https://claude.ai/chat/1276ff77-a8ab-405d-bea6-c316e8320899) — Emily Ball (14 exercises)
- [Handoff next tasks](https://claude.ai/chat/32ef6f0b-3114-4707-b6ed-fea52259302c) — Kaupelis Ch4, bulk PDF conversion
- [Kaupelis extraction or bulk convert](https://claude.ai/chat/3743cee1-05ca-461d-af0c-38e742a9c251) — HANDOFF housekeeping
- [Kaupelis extraction (Ch5)](https://claude.ai/chat/5f38307b-76e1-4c4f-8b3e-552c37202e09) — 6 exercises
- [Kaupelis extraction (Ch6)](https://claude.ai/chat/db10e23e-0532-4fbf-8617-56a41f32b0da) — 5 exercises
- [Kaupelis chapter 7 extraction](https://claude.ai/chat/aa8faeb6-4a7f-48a5-b4b7-f9bdc60f12be) — 8 exercises
- [Kaupelis chapter extraction](https://claude.ai/chat/132838d8-2c2d-4977-a0b3-1a56a624940a) — Ch9 analysis
- [Kaupelis extraction next steps](https://claude.ai/chat/67c759a7-fc7d-47c0-b150-275bf783357c) — Woods Ch2 (9 exercises)
- [Book extraction workflow](https://claude.ai/chat/bd58df74-6d09-4d2c-b61e-84159e360345) — Tyler (50 exercises, complete)
- [Start next book project](https://claude.ai/chat/d22724a1-2725-4da3-9d7e-561d04355bc8) — next book planning
- [Book extraction workflow setup](https://claude.ai/chat/29ac9304-8d48-4d98-b4cc-435ab3548510) — git index.lock fix
- [Book conversion status](https://claude.ai/chat/ae0eb8f1-825f-4d9e-aa8a-ec50626ef3b9) — JSON→YAML, wikilinks, LOD table

**Todo**

1. Select next book from `EXTRACTION-LOG.md` not-started list (consider Raynes, Bammes, or Aristides; scope for overlap with existing books first).
2. Finish Kaupelis Chs 8–9 extraction; check whether Ch6 and Ch8 need a scoping conversation first.
3. Fix nicolaides duplicate entries and count mismatch in `catalogue.yaml`.

### 2b. Artist database and LOD verification

An artist file for each named exemplar in the exercises, with Wikidata Q numbers, Getty ULAN IDs, and Eagle links, stored in `lod-lookup.yaml`.

**Chats**

- [Artist data enrichment](https://claude.ai/chat/ff7f16c0-418c-4f1d-ae41-d87ed6e297f4) — scripts, WORKFLOW, SCHEMA updates
- [Artist database pages](https://claude.ai/chat/6fbdaed4-fd1b-4100-897c-609bea36b972) — completed ~76-name list
- [Artist pages Eagle Links](https://claude.ai/chat/67803832-0c2b-44a4-b4e1-1be22f714e7b) — Cambiaso page fleshed out
- [Exercise extraction next steps](https://claude.ai/chat/63b2d784-233e-4114-92f5-178e8bc8c1e6) — Warhol, Oldenburg, Lichtenstein pages
- [Code lint and cleanup](https://claude.ai/chat/9f5e8be7-d032-4fa1-bf69-f5f163820381) — LOD sweeps, Met pilot, enrich.md

**Todo**

1. Run the LOD verification sweep on remaining `links_status: unverified` artist files.
2. Prioritise Sickert artist file (appears across multiple books).
3. Delete the duplicate `van-eeden-marcel.md` file.

### 2c. Data quality, schema, and tooling

Scripts, schema definitions, lint reviews, and catalogue consistency work.

**Chats**

- [Drawing knowledge base setup](https://claude.ai/chat/6ddfd7fa-ed9f-4044-86cb-822c3b6bcea2) — requirements.txt, venv
- [Virtual environment package audit](https://claude.ai/chat/7bc3bd7e-e2b7-4841-8bf0-c55666a3069a) — venv audit
- [Drawing knowledge base work](https://claude.ai/chat/a0214c07-7f2f-4e93-90d8-be90eb00b055) — ILOs, 9-section template for 142 exercises
- [Exercise descriptions draft](https://claude.ai/chat/a54acc86-c991-4a42-99c2-e752a8d76406) — description fields, paragraph break fix
- [Linking pass review](https://claude.ai/chat/366296de-f592-4be3-9953-aa7f6046077b) — pilot complete, next book planning

**Todo**

1. Approve deletion of the 10 superseded files flagged in lint §1.
2. Run the linking pass (`skill/prompts/link.md`) in a fresh session — batch proposals before applying.
3. Run `skill/prompts/synthesise.md` now that description fields exist.

### 2d. Teaching skill for Claude

A structured Claude skill (`skill/SKILL.md`) with prompts for diagnosing student difficulties, adapting exercises, and sequencing teaching.

**Chats**

- [Build drawing instruction knowledge base](https://claude.ai/chat/9ce0abaf-21e3-4391-9d08-3968dcc591f6) — initial SKILL.md
- [Project skill design discussion](https://claude.ai/chat/d24e0b4e-8f3c-4199-953f-dd20c73e9ad9) — situation, adapt, diagnose, synthesise prompts
- [Continue teaching materials test](https://claude.ai/chat/905681b3-0d2a-4e92-b358-da62aa36a85b) — pedagogy resources scoped

**Todo**

1. Locate and add four missing pedagogy resources to the pedagogy folder: QAA level descriptors, Fink's taxonomy, practice-based ILO examples, Schön or Kolb.
2. Test the `diagnose` prompt against more student drawings and expand the symptom taxonomy if needed.
3. Once pedagogy resources are in place, build the full skill properly.

---

## 3. md-design-system (Markdown/CSS Design System)

A CSS design system built around 14 named themes drawn from real websites, with a full style guide and accessibility audit.

**Sub-areas**

- CSS token system with 14 themes (`alvarodelara`, `fluxish`, `gardenernyc`, `criticalmedialab`, `handmadeweb`, `fragmentlv`, and 8 others)
- WCAG AA colour audit and background-colour fixes across 6 themes
- Style guide pages (including PAGE 11: article page with prose components)
- Theme tester (font fallback fixes for ROM Condensed)
- Handoff documentation for `main.css` build (step 5)

**Chats**

- [MD design system briefing](https://claude.ai/chat/38d5e2c1-76fb-4265-ab5d-ad58756b92ea) — step 5 handoff
- [Design system theme tester](https://claude.ai/chat/a351ea48-6722-4971-80d4-c6dbe9f09cf9) — font fix (ROM/Helvetica Neue)
- [md-design-system CSS build](https://claude.ai/chat/a6fde83e-08e2-4dbe-9540-1dd51231922b) — background colour fixes, accessibility audit
- [Markdown design system calendar](https://claude.ai/chat/12dbe1c0-fd09-4323-b6c9-f90c7acf81e8) — PAGE 11 article page

**Todo**

1. Begin step 5: compile `main.css` from token inventory and prototype.
2. Review the six updated themes in the style guide browser — confirm background tints feel right.
3. Build remaining style guide pages and test all prose components against real content.

---

## 4. Drawing Biennial 2026 (Image Ingest)

Ingesting artworks from the Drawing Room Biennial 2026 into Eagle and generating structured markdown files for an Obsidian archive.

**Sub-areas**

- 314 markdown files converted to full frontmatter format (title, artist, year, medium, Eagle IDs)
- Image download workflow (blocked by network policy; domains documented)
- Eagle ingest log integration

**Chats**

- [Drawing biennial image ingest](https://claude.ai/chat/ad9e6990-68a0-481c-8228-1b3ffcb0b6ca) — 314 markdown files with frontmatter
- [Drawing Room biennial downloads](https://claude.ai/chat/f090dd0a-54e5-4fa2-9f09-f1ae6dc81f1f) — download attempt, blocked by org policy

**Todo**

1. Add `biennial.drawingroom.org.uk` and `drawingcdn.azureedge.net` to Admin → Capabilities → Network access allowed domains.
2. Retry image download and Eagle import once network access is granted.
3. Review sample markdown files in Obsidian to confirm frontmatter renders as expected.

---

## 5. Tone of Voice and Writing

Developing Kim's documented writing voice for use across professional and public-facing contexts.

**Sub-areas**

- Tone of voice guide: three registers (conversational/reflective, instructional, official/client), with before/after examples and a Claude briefing section
- Website content pulled from mildlydiverting.com (five pages archived as markdown)
- Efficient prompt version (~180 tokens) for automation contexts

**Chats**

- [Kim's tone of voice guide](https://claude.ai/chat/c1f114d0-97a6-47ab-948a-21e66f4eb3d5) — full guide document

**Todo**

1. Add individual Work series pages from mildlydiverting.com to the guide.
2. Use the efficient prompt version (~180 tokens) when wiring the guide into automated workflows.
3. Test the guide by writing a sample class announcement and applying the before/after rubric.

---

## 6. Cultural Education Research

Analysis of a collection of documents on cultural education, place, and arts organisation strategy — likely preparatory research for an arts centre project.

**Sub-areas**

- Place theory synthesis (Goodman, CultureHive, ASELA, Nesta, placemaking literature)
- 5-slide presentation structure: place as cultural production
- *Unlearning Exercises* (Annette Krauss / Casco, 2014): summary and teaching applications

**Chats**

- [Analyze cultural education documents for patterns](https://claude.ai/chat/7b974585-c24f-4ad3-b135-717ac59e66eb) — place theory, 5-slide structure
- [Summarize unlearning exercises for arts education](https://claude.ai/chat/840e8bd4-ff07-49da-8fa5-d758e7f91e84) — Unlearning Exercises summary

**Todo**

1. Develop the 5-slide structure into a full presentation deck.
2. Read further on Mierle Laderman Ukeles (Maintenance Manifesto) — a rich thread for an arts organisation thinking about values.
3. Try the Time Diary exercise (from *Unlearning Exercises*) with a life class or teaching group as a practical test.

---

## 7. Utility and Infrastructure

Miscellaneous scripts and tooling that support other projects.

**Sub-areas**

- File date prepend script (shell + Automator Quick Action)
- Handwritten notes to markdown conversion script (Anthropic API key troubleshooting resolved)
- Development notes vault reorganisation (`_development-notes/` subfolders)

**Chats**

- [File date prepend script](https://claude.ai/chat/29c45a66-572d-4147-a643-5f4fc9fcb2bc) — creation date prefixer
- [Convert handwritten notes to markdown files](https://claude.ai/chat/9725b3f9-708c-4cbe-9bf6-f7e668bf37e6) — API key fix
- [Development notes frontmatter](https://claude.ai/chat/f564eed6-e3ac-4c6a-be81-acfc9a288a32) — vault reorganisation

**Todo**

1. Set up the file date prepend script as an Automator Quick Action in Finder.
2. Rename the `#LLM Knowledge Bases` note to remove the leading `#`.
3. Confirm the handwritten notes conversion script is running cleanly on the full image batch.

---

## 8. Teaching Practice (Ad Hoc)

Brief sessions on immediate teaching needs — not tied to a larger ongoing project.

**Chats**

- [Life class ideas](https://claude.ai/chat/5301e068-9dd6-4ef0-9f56-4f2469299148) — three quick class ideas

**Todo**

1. Pick one of the three ideas (long pose, continuous tone, or negative space) and ask for a timed session plan.
2. Use the knowledge base `diagnose` prompt before the next class to prepare targeted interventions.
3. Document any new exercises that emerge from the class back into the knowledge base.

---

## Notes on ambiguity

- **Timestamps**: session metadata does not expose timestamps, so `last_updated` in the CSV is set to the date this index was generated (2026-06-18). Session ordering in the list reflects recency (most recent first) but exact dates are not available.
- **"Claude Chrome access question"** session had very little transcript content — only two bash calls recorded; summary and next step are approximate.
- **are.na-toolkit as project name**: applied to all rows as instructed, though several sessions (dt-knowledge-base, md-design-system, biennial) are logically separate repositories. The project name reflects the Cowork project context, not the repo.
- **Session `local_bf8e9e0c`** is this session; included in the CSV for completeness.
