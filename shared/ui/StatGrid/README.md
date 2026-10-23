StatGrid — a row of labelled counts, such as Added, Already there, Removed, Failed under a progress bar.

Wraps on narrow screens. Each item has a `key`, a `label` and a starting `value` (default 0). Change counts in place with `grid.update({ added: 3 })`; keys that do not exist are ignored.

```js
var grid = ArenaToolkit.StatGrid({ items: [{ key: 'added', label: 'Added' }, { key: 'failed', label: 'Failed' }] });
grid.update({ added: 3 });
```
