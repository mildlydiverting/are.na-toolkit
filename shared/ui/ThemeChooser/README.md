ThemeChooser — a palette button that opens a Menu of themes (Light, Dusk, Dark, Dawn).

Sits in a page header, usually beside the Connect link or user chip. Choosing a theme sets `data-theme` on `<html>` and remembers the choice in `localStorage` under `arena_toolkit_theme`. Every tool served from the same origin shares that key, so one choice carries across the toolkit.

## Which theme applies

1. `?theme=dawn` in the URL. Applied but **not** saved, so it is handy for checking all four.
2. The saved choice.
3. The system setting: Dark if the system prefers dark, otherwise Light.

The component applies the theme as soon as it is created. Mount it early in the page (the header) to keep any flash of the wrong theme short.

## Options

- `themes` — `[{ id, label }]`. Default: Light, Dusk, Dark, Dawn. Each `id` must have a matching `[data-theme]` block in the tokens.
- `storageKey` — default `arena_toolkit_theme`.
- `onChange(id)` — called when the person picks a theme (not on first load).

## Behaviour

- The button is `aria-haspopup="menu"` with `aria-expanded`. The menu items are `menuitemradio` with `aria-checked`; the current theme also shows a tick.
- Opening focuses the current theme. Arrow keys move, Escape closes and returns focus to the button, and a click outside closes.
- `localStorage` can be unavailable (private windows). The theme still applies for the visit; it just isn't remembered.

## Usage

```js
header.append(ArenaToolkit.ThemeChooser());

// custom
ArenaToolkit.ThemeChooser({ onChange: (id) => console.log(id) });

// pure helper, for tests or an early inline script
ArenaToolkit.ThemeChooser.resolve({ asked: null, saved: 'dusk', prefersDark: false }); // 'dusk'
```

## Icon

The palette is the system's own `Icons/Theme.svg`, inlined so it takes the text colour (an `<img>` would not).
