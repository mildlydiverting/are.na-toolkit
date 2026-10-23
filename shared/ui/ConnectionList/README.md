ConnectionList — a stack of ConnectionListInfo rows with an optional sort menu (formerly ChannelList).

Spacing between rows (`space-1`) and, if you pass `sorts`, a labelled Select above them. The component draws the menu and tells you what was chosen; the sorting itself is yours, because only you know the data. Re-order by calling `list.setRows(nodes)`.

## Options

- `rows` — initial `ConnectionListInfo` elements (or a single message node, such as "Loading…").
- `sorts` — `[{ value, label }]`. Omit for no sort menu.
- `sortValue` — the pre-selected value. Default: the first sort.
- `sortLabel` — label text, default `'Sort'`.
- `onSort(value)` — called when the person picks a sort.

## `list.setRows(nodes)`

Replaces the list's contents. Rows you pass again are **moved, not rebuilt**, so a row the person has opened stays open after a re-sort. The sort menu appears once there are two or more rows, and hides again for a single message node. Call it as pages of data arrive; build each row once and keep it in a Map.

## Usage

```js
var rows = new Map();   // channel -> ConnectionListInfo
var list = ArenaToolkit.ConnectionList({
  sorts: [
    { value: 'default', label: 'Default order' },
    { value: 'recent',  label: 'Most recent first' },
    { value: 'blocks',  label: 'Most blocks' }
  ],
  onSort: function (mode) { list.setRows(sortChannels(channels, mode).map(function (c) { return rows.get(c); })); },
  rows: [loadingMessage]
});
```
