ThemeChooser — a palette button that opens a Menu of themes (Light, Dusk, Dark, Dawn) plus System.

Sits in a page header, usually beside the Connect link or user chip. Choosing a theme sets `data-theme` on `<html>` and remembers the choice in `localStorage` under `arena_toolkit_theme`. Every tool served from the same origin shares that key, so one choice carries across the toolkit.

## Which theme applies

1. `?theme=dawn` in the URL. Applied but **not** saved, so it is handy for checking all four.
2. The saved choice.
3. **System** (the default when nothing is saved): Dark if the operating system prefers dark, otherwise Light. While System is selected the page follows the operating system live, with no reload.

Choosing System saves `'system'` under the same key, so it survives a reload and other tools read it as "follow the system". The tick in the menu shows what the person chose (System, not the Light or Dark it resolves to).

The component applies the theme as soon as it is created. Mount it early in the page (the header) to keep any flash of the wrong theme short.

## Options

- `themes` — `[{ id, label }]`. Default: Light, Dusk, Dark, Dawn. Each `id` must have a matching `[data-theme]` block in the tokens.
- `system` — `false` to leave out the System entry. Default `true`; it sits below a separator.
- `storageKey` — default `arena_toolkit_theme`.
- `onChange(id)` — called when the person picks a theme (not on first load). `id` can be `'system'`.

## Behaviour

- The button is `aria-haspopup="menu"` with `aria-expanded`. The menu items are `menuitemradio` with `aria-checked`; the current theme also shows a tick.
- Opening focuses the current theme. Arrow keys move, Escape closes and returns focus to the button, and a click outside closes.
- `localStorage` can be unavailable (private windows). The theme still applies for the visit; it just isn't remembered.

## Usage

```js
header.append(ArenaToolkit.ThemeChooser());

// custom
ArenaToolkit.ThemeChooser({ onChange: (id) => console.log(id) });

// pure helpers, for tests or an early inline script
ArenaToolkit.ThemeChooser.resolve({ asked: null, saved: 'dusk', prefersDark: false }); // 'dusk': the data-theme to apply
ArenaToolkit.ThemeChooser.resolve({ asked: null, saved: 'system', prefersDark: true }); // 'dark'
ArenaToolkit.ThemeChooser.choice({ asked: null, saved: null }); // 'system': which menu entry is selected
```

## Icon

The palette is the system's own `Icons/Theme.svg`, inlined so it takes the text colour (an `<img>` would not).
