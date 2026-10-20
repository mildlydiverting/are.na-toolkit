ChannelRow — a channel as a coloured bar that opens like an accordion.

One line per channel: visibility badge, name, block count, metadata count, owner, and a caret at the end. Click to open; whatever you pass as `children` fills the panel. Built on a native `<details>`, so keyboard and screen readers work without extra code.

## Colour follows visibility

| visibility | bar | ink and open border |
| --- | --- | --- |
| `public` | 6% `accent-success` tint | `accent-success` |
| `private` | 6% `accent-private` tint | `accent-private` |
| anything else (`closed`) | `surface-sunken` | `text-secondary`, grey border |

Everything in the bar (badges, name, counts, owner, caret) takes the same ink. A hairline border in that colour appears on hover and while open. When open, only the bar keeps its tint; the panel sits on the page colour inside the border.

Badges sit a tiny step off the bar colour. At this tint strength the green and red text is about 4.6:1 on the bar in Light (public badge 4.35:1, slightly under for 10px text).

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
