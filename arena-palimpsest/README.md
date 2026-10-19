# Are.na Palimpsest

Paste an are.na block URL or ID and see everything the API knows about it: the block's own fields, its metadata, and the channels it is connected to (with each channel's metadata).

**[Try it](https://mildlydiverting.github.io/are.na-toolkit/arena-palimpsest.html)**

A palimpsest is a manuscript where newer writing sits over scraped-off older text, with the earlier layer still faintly visible. This tool shows the same thing for a block: every layer of metadata that has built up around it, including the markers written by other tools in the toolkit.

## Using it

- Paste a block ID (`13857023`) or URL (`https://www.are.na/block/13857023`) and press Enter or **Inspect**.
- Public blocks work without signing in. For private channels, or your own private blocks, click **Connect →** and paste a [personal access token](https://www.are.na/settings/personal-access-tokens). Read access is enough.
- The last ten lookups appear as chips under the input.
- Your token and lookup history stay in this browser (`localStorage`). The token is only ever sent to are.na.

## What it can't show

are.na doesn't expose connection details (position, who connected a block, when, or connection metadata) from a block's side, so you see the channels themselves.

## Read-only

This version never writes to are.na.

## Building

```bash
npm install
node arena-palimpsest/build.js          # src/ → dist/arena-palimpsest.html
node arena-palimpsest/build.js --watch  # rebuild on save
node arena-palimpsest/build.js --docs   # also copy to docs/ for GitHub Pages
npm test
```

Agent notes are in `NOTES.md`.
