Progress — a thin bar with a label row, for work that takes a while. It handles both cases: a known amount ("16 of 20") and an unknown one.

**Finite:** pass `value` and a `max` above zero. **Indeterminate:** leave `value` out (or `null`), or give a `max` of zero or less; the bar then slides gently. `update()` can switch between the two at any time, so "Starting…" can become "3 of 20" without rebuilding.

`variant` is `default`, `success` or `alert` and can change after creation. `detail` is text or a node. Motion stops under `prefers-reduced-motion`. The track is a `role="progressbar"` with `aria-valuenow` and `aria-valuemax` (left off while indeterminate) and an `aria-valuetext` made from label and detail, so a screen reader says "Dry run: merging, 16 of 20", not just "80%".

## Usage

```js
var bar = ArenaToolkit.Progress({ label: 'Starting…' });
bar.update({ value: 4, max: 20, label: 'Merging', detail: '4 of 20' });
bar.update({ value: 20, label: 'Done', variant: 'success' });
```

`ArenaToolkit.Progress.model({ value, max })` returns `{ indeterminate, pct, now, max }` and `Progress.spoken({ label, detail })` the spoken text (both pure, for tests).

## Busy text

For a line of text that means "working on it" (no number to show), add the class `atk-busy`: it fades between full and half opacity over six seconds, and stops under `prefers-reduced-motion`. The sign-in panel's progress line ("Checking token…", "Loading your channels…") uses it already.
