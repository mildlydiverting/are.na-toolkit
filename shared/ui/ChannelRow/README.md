ChannelRow — a channel as a coloured bar that opens like an accordion.

One line per channel: visibility badge, name, block count, metadata count, owner, and a caret at the end. Click to open; whatever you pass as `children` fills the panel. Built on a native `<details>`, so keyboard and screen readers work without extra code.

## Colour follows visibility

Fills come from are.na's own channel colours, one set per theme, so the bars match are.na in all four themes.

| visibility | bar | badge | ink, open border |
| --- | --- | --- | --- |
| `public` | `channel-bar-open` (are.na channelPublic1) | `channel-badge-open` | `accent-success` |
| `private` | `channel-bar-private` (are.na channelPrivate1) | `channel-badge-private` | `accent-private` |
| anything else (`closed`) | `surface-card` (are.na channelClosed1) | `channel-badge-closed` | `text-secondary`, grey `border-strong` |

Everything in the bar (badge text, name, counts, owner, caret) takes the same ink. A hairline border in that colour appears on hover and while open. When open, only the bar keeps its fill; the panel sits on the page colour inside the border.

The bar fills are are.na's own variables (`channelPublic1`, `channelPrivate1`, `channelClosed1`), taken from all four of its themes. The badge fills are not an are.na variable: they were sampled from are.na's rendered rows, so treat them as within one step.

## Contrast

These are are.na's colours, kept as they are, and not all of them reach 4.5:1 for the 10px badge text. Ink on bar / on badge:

| | public | closed | private |
| --- | --- | --- | --- |
| Light | 4.7 / 4.4 | 11.8 / 11.0 | 5.1 / 4.7 |
| Dusk | 10.7 / 7.8 | 9.9 / 6.4 | 5.4 / 3.8 |
| Dark | 10.7 / 7.8 | 13.8 / 10.3 | 6.3 / 5.7 |
| Dawn | 4.2 / 3.5 | 7.9 / 6.4 | 3.2 / 2.7 |

Dawn private (3.2 on the bar, 2.7 on the badge) and Dawn public badge (3.5) are the weak spots. The name and owner are 16px, so they are the more readable part of the bar.

## Options

- `title` — the channel name.
- `visibility` — `'public'`, `'closed'` or `'private'`. Sets the colour and the badge text.
- `count` — shown after the name, muted by the bar ink. Pass a string; format large numbers yourself (`'10k'`).
- `metadataCount` — shown as a small badge after the count. `0` is shown; leave it out to hide the badge.
- `owner` — right-aligned, e.g. `'@kim-plowright'`.
- `open` — start open.
- `children` — the panel contents. The panel is a two-column grid (2fr / 3fr) that stacks under 700px, so pass two nodes: metadata first, details second.

## Usage

```js
list.appendChild(ArenaToolkit.ChannelRow({
  title: 'Design',
  visibility: 'public',
  count: '516',
  metadataCount: 2,
  owner: '@brannon-wellington',
  children: [metadataNode, detailsNode]
}));
```

Use inside a [ChannelList](../ChannelList/README.md) to get spacing and sorting.
