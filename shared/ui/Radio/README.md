Radio — one choice from a group, with an optional description underneath.

Radios in a group share a `name`. A native `<input type="radio">` sits inside the label, so arrow keys, focus and screen readers behave as usual. Same look as Checkbox: `--text-muted` resting ring (3:1 or better on every theme), `--accent-primary` fill with a dot when chosen.

## Options

`label` (required), `description`, `value`, `name`, `checked`, `disabled`, `onChange(value)` (fires when this one becomes chosen).

## Usage

```js
['public', 'closed', 'private'].forEach(function (v) {
  list.appendChild(ArenaToolkit.Radio({ label: v, name: 'visibility', value: v, checked: v === 'closed', onChange: set }));
});
```
