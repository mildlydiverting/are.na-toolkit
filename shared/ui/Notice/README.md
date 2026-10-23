Notice — a message that sits in the page flow, in the same navy box as are.na's own corner message.

Use it where something needs to be seen before the person carries on (for example "this tool needs a token with write access"). For a brief message that should not move the page, use Toast. For one quiet line of progress, use StatusMessage.

## Options

- `variant` — `'info'` (default, no icon), `'success'` (✓), `'warning'` (⚠) or `'error'` (⚠). Colour is the same for all four; the icon and the words carry the meaning, so it reads in every theme.
- `title` — a short bold lead-in. A full stop is added.
- `children` — the sentence (a string, a node, or an array of them).
- `onDismiss` — if given, a × button appears and calls it. The caller removes the box.

## Behaviour

- `error` has `role="alert"`; the others use `role="status"`.
- The icon is `aria-hidden`.
- Text and background are `surface-page` on `accent-primary`, the same pairing as the primary button.

## Usage

```js
ArenaToolkit.Notice({ variant: 'warning', title: 'Write access needed', children: 'This tool adds and removes blocks, so a read-only token will not work.' });
```
