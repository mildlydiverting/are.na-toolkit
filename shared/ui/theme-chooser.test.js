import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// bundle.js is a classic script that assigns window.ArenaToolkit; load it with a stub window.
const win = {};
new Function('window', readFileSync(new URL('./bundle.js', import.meta.url), 'utf8'))(win);
const { resolve, choice } = win.ArenaToolkit.ThemeChooser;

describe('ThemeChooser.resolve', () => {
  it('prefers ?theme= over a saved choice', () => {
    expect(resolve({ asked: 'dawn', saved: 'dark', prefersDark: false })).toBe('dawn');
  });
  it('uses the saved choice when nothing is asked for', () => {
    expect(resolve({ asked: null, saved: 'dusk', prefersDark: false })).toBe('dusk');
  });
  it('ignores unknown values and falls back to the system preference', () => {
    expect(resolve({ asked: 'neon', saved: 'sepia', prefersDark: true })).toBe('dark');
    expect(resolve({ asked: null, saved: null, prefersDark: false })).toBe('light');
  });
  it('falls back to the first theme if the system choice is not offered', () => {
    expect(resolve({ themes: [{ id: 'dawn' }, { id: 'dusk' }], prefersDark: true })).toBe('dawn');
  });
});

describe('ThemeChooser.choice', () => {
  it('selects the ?theme= value, then the saved theme', () => {
    expect(choice({ asked: 'dawn', saved: 'dark' })).toBe('dawn');
    expect(choice({ asked: null, saved: 'dusk' })).toBe('dusk');
  });
  it('selects System when nothing valid is saved, including an explicit "system"', () => {
    expect(choice({ asked: null, saved: null })).toBe('system');
    expect(choice({ asked: null, saved: 'system' })).toBe('system');
    expect(choice({ asked: 'neon', saved: 'sepia' })).toBe('system');
  });
  it('follows the system setting when the saved value is "system"', () => {
    expect(resolve({ asked: null, saved: 'system', prefersDark: true })).toBe('dark');
    expect(resolve({ asked: null, saved: 'system', prefersDark: false })).toBe('light');
  });
});
