StatusMessage — one inline line for progress, success and errors.

Replaces the filled Badge that used to sit beside error text. Colour is only on a small icon, so the words stay readable in every theme. Merge and To Arena have their own versions of this pattern; moving them here is a later job.

## Options

- `tone` — `'info'` (default, quiet grey, no icon), `'success'` (✓ in the success green) or `'error'` (⚠ in the alert orange).
- `label` — a short bold lead-in. A full stop is added: `label: "Couldn't connect"` shows **Couldn't connect.**
- `children` — the sentence (a string, a node, or an array of them).

## Behaviour

- `error` has `role="alert"` so it is announced at once; the other tones use `role="status"`.
- The icon is `aria-hidden`. The tone is never carried by colour alone: the label and sentence say what happened.

## Usage

```js
ArenaToolkit.StatusMessage({ tone: 'error', label: "Couldn't connect", children: "are.na didn't recognise that token." });
ArenaToolkit.StatusMessage({ tone: 'info', children: 'Checking token…' });
```
