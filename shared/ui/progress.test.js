import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// bundle.js is a classic script that assigns window.ArenaToolkit; load it with a stub window.
const win = {};
new Function('window', readFileSync(new URL('./bundle.js', import.meta.url), 'utf8'))(win);
const { model, spoken } = win.ArenaToolkit.Progress;

describe('Progress.model', () => {
  it('is finite for a value and a positive max, and gives a percentage', () => {
    expect(model({ value: 5, max: 20 })).toEqual({ indeterminate: false, pct: 25, now: 5, max: 20 });
  });
  it('defaults max to 100', () => {
    expect(model({ value: 40 }).pct).toBe(40);
  });
  it('is indeterminate with no value', () => {
    expect(model({}).indeterminate).toBe(true);
    expect(model({ value: null, max: 10 }).indeterminate).toBe(true);
  });
  it('is indeterminate when max is zero, negative or not a number', () => {
    expect(model({ value: 3, max: 0 }).indeterminate).toBe(true);
    expect(model({ value: 3, max: -1 }).indeterminate).toBe(true);
    expect(model({ value: 3, max: NaN }).indeterminate).toBe(true);
  });
  it('clamps the value into 0..max', () => {
    expect(model({ value: 30, max: 20 }).now).toBe(20);
    expect(model({ value: -4, max: 20 }).now).toBe(0);
  });
});

describe('Progress.spoken', () => {
  it('joins label and detail, skipping empty ones', () => {
    expect(spoken({ label: 'Merging', detail: '16 of 20' })).toBe('Merging, 16 of 20');
    expect(spoken({ label: 'Merging' })).toBe('Merging');
    expect(spoken({})).toBe('');
  });
  it('reads the text of a node', () => {
    expect(spoken({ label: 'Merging', detail: { textContent: '3 of 4' } })).toBe('Merging, 3 of 4');
  });
});
