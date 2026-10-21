import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// bundle.js is a classic script that assigns window.ArenaToolkit; load it with a stub window.
const win = {};
new Function('window', readFileSync(new URL('./bundle.js', import.meta.url), 'utf8'))(win);
const { displayName, initials } = win.ArenaToolkit.AccountMenu;

describe('AccountMenu.initials', () => {
  it('uses the API initials when given', () => {
    expect(initials({ name: 'Kim Plowright', initials: 'kp', slug: 'kim-plowright' })).toBe('KP');
  });
  it('works out initials from the name, then the slug', () => {
    expect(initials({ name: 'Kim Plowright' })).toBe('KP');
    expect(initials({ full_name: 'Kim P' })).toBe('KP');
    expect(initials({ slug: 'kim-plowright' })).toBe('K');
  });
  it('caps at two letters and falls back to ?', () => {
    expect(initials({ name: 'Mary Jane Watson' })).toBe('MJ');
    expect(initials(null)).toBe('?');
  });
});

describe('AccountMenu.displayName', () => {
  it('reads name, then full_name, then slug', () => {
    expect(displayName({ name: 'Kim Plowright', slug: 'k' })).toBe('Kim Plowright');
    expect(displayName({ full_name: 'Kim P', slug: 'k' })).toBe('Kim P');
    expect(displayName({ slug: 'kim-plowright' })).toBe('kim-plowright');
    expect(displayName(null)).toBe('');
  });
});
