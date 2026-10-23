StatusLog — a disclosure holding a monospace log: success in green, plain messages in grey, warnings in orange, errors in red.

`log.add(tone, text)` appends a line (`success`, `message`, `warning` or `error`) and scrolls to it; `log.clear()` empties it. Colour is never the only signal: success, warning and error lines start with a visually hidden "Success: ", "Warning: " or "Error: " for screen readers. Closed by default; pass `open: true` to start open.

## Contrast

On the sunken fill every theme passes 4.5:1 except Dawn's error (2.76:1) and warning (2.98:1), which keep are.na's own colours. Treat those two as known gaps.

```js
var log = ArenaToolkit.StatusLog({ label: 'Details' });
log.add('success', 'Added Image "sunset"');
```
