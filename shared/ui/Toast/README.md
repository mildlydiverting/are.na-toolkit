Toast — a short message in the corner of the screen that goes away by itself. It is a Notice in a fixed stack.

Use it for things that happened ("Copied 3 URLs.", "are.na asked us to slow down."). Anything the person must act on belongs in the page as a Notice.

## API

- `Toast.show({ message, title?, variant?, duration? })` — returns `{ dismiss }`. `variant` is as for Notice (`info`, `success`, `warning`, `error`; the older `default`, `notification` and `alert` still work). `duration` is in milliseconds, default 4000; `0` keeps it until dismissed.
- `Toast.dismissAll()`
- `Toast.setPosition('left' | 'right')` — default `'left'`. are.na itself uses the bottom right.

## Behaviour

- The timer pauses while the pointer is over a toast or focus is inside it. Esc or × dismisses it.
- Messages that matter should not rely on the timer alone: use `duration: 0` for errors the person needs to read.
- Motion is switched off for `prefers-reduced-motion`.

## Usage

```js
ArenaToolkit.Toast.show({ message: 'Copied 3 URLs.', variant: 'success' });
ArenaToolkit.Toast.show({ message: "Couldn't read that channel, so it was skipped.", variant: 'error', duration: 8000 });
```
