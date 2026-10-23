Checkbox — a yes/no choice, with an optional description underneath.

A native `<input type="checkbox">` sits inside the label, so keyboard, focus and screen readers behave as usual. The box is drawn by the system. Resting border is `--text-muted` (at least 3:1 on every theme); hover darkens it; checked fills with `--accent-primary` and a tick. `indeterminate` shows a bar.

## Options

`label` (required), `description`, `checked`, `disabled`, `indeterminate`, `name`, `id`, `onChange(checked)`.

## Usage

```js
form.appendChild(ArenaToolkit.Checkbox({
  label: 'Quiet mode',
  description: 'Hide the destination while the merge runs.',
  onChange: function (checked) { opts.quiet = checked; }
}));
```

Use Radio when exactly one of several choices applies.
