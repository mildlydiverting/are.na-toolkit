# Are.na Palimpsest

Paste an are.na block URL or ID and see everything the API knows about it: the block's own fields, its custom metadata, and the channels it is connected to (with each channel's metadata). For blocks you own, you can edit the custom metadata.

**[Try it](https://mildlydiverting.github.io/are.na-toolkit/arena-palimpsest.html)**

A palimpsest is a manuscript where newer writing sits over scraped-off older text, with the earlier layer still faintly visible. This tool shows the same thing for a block: every layer of metadata that has built up around it, including the markers written by other tools in the toolkit.

## Using it

- Paste a block ID (`13857023`) or URL (`https://www.are.na/block/13857023`) and press Enter or **Inspect**.
- Public blocks work without signing in. For private channels, or your own private blocks, click **Connect →** and paste a [personal access token](https://www.are.na/settings/personal-access-tokens). Read access is enough.
- The block appears as a framed thumbnail (the border shows its visibility: grey public, red private, dotted orphan) beside its metadata and fields. Metadata values that are web addresses are links.
- Connected channels are coloured bars. Click one to open it. Use **Sort** above the list to order them by most recent, oldest, most blocks or most metadata (the dates are when each channel was created).
- The palette button at the top right changes the theme: Light, Dusk, Dark, Dawn, or System (follows your device).
- The last ten lookups appear as chips under the input.
- Your token and lookup history stay in this browser (`localStorage`). The token is only ever sent to are.na.

## What it can't show

are.na doesn't expose connection details (position, who connected a block, when, or connection metadata) from a block's side, so you see the channels themselves.

## Editing custom metadata

Looking is read-only. Editing writes to are.na, and only on blocks you own.

1. Click **Edit** beside **Custom Metadata**. If you are not connected, or your token is read-only, you are asked to connect with a token that has **write** access. Blocks you don't own show "Read-only" instead.
2. Each property is a row with a type (**Text**, **Number**, **Checkbox** or **List**), a value and a **⋯** menu (change type, copy value, remove). **+ Add property** adds one. Names use letters, numbers and underscores, up to 40 characters; a value is up to 2000 characters; a block can hold 50 properties.
3. **Review changes** shows what was added, changed and removed, and the exact request that will be sent. Nothing is written until you press **Save**. **Cancel** discards your edits.
4. Only the properties you changed are sent, and each keeps its type: a number stays a number.
5. Keys starting `dupe_` are written by arena-duplicate-finder and are locked until you press **Edit anyway**.

**Tags** use the key `tags` (or any List property). are.na values are single strings, so a list is stored as a JSON array written as text, for example `["journal", "silly thing"]`. In are.na's own JSON view the quotes look escaped (`"[\"journal\", ...]"`): that is just how JSON shows a string containing quotes; the stored text has no backslashes. Older `- tag` bullet lists are still read, and become JSON the next time you edit them.

Keyboard: Tab moves through the rows, Enter opens a row's menu, the arrow keys move within it and Escape closes it.

## Building

```bash
npm install
node arena-palimpsest/build.js          # src/ → dist/arena-palimpsest.html
node arena-palimpsest/build.js --watch  # rebuild on save
node arena-palimpsest/build.js --docs   # also copy to docs/ for GitHub Pages
npm test
```

Agent notes are in `NOTES.md`.
