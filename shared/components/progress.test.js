import { describe, it, expect } from 'vitest';
import { progressModel, plainText, spokenProgress } from './progress.js';

describe('progressModel', () => {
  it('is finite with a value and a positive max', () => {
    expect(progressModel({ value: 16, max: 20 })).toEqual({ indeterminate: false, pct: 80, now: 16, max: 20 });
  });
  it('is indeterminate with no value', () => {
    expect(progressModel({}).indeterminate).toBe(true);
    expect(progressModel({ value: null, max: 20 }).indeterminate).toBe(true);
  });
  it('falls back to indeterminate when max is zero, negative or not a number', () => {
    expect(progressModel({ value: 3, max: 0 }).indeterminate).toBe(true);
    expect(progressModel({ value: 3, max: -5 }).indeterminate).toBe(true);
    expect(progressModel({ value: 3, max: NaN }).indeterminate).toBe(true);
    expect(progressModel({ value: NaN, max: 10 }).indeterminate).toBe(true);
  });
  it('clamps a value outside 0..max', () => {
    expect(progressModel({ value: 30, max: 20 }).pct).toBe(100);
    expect(progressModel({ value: -4, max: 20 }).pct).toBe(0);
  });
  it('shows a finished bar as 100 and an unstarted one as 0', () => {
    expect(progressModel({ value: 1, max: 1 }).pct).toBe(100);
    expect(progressModel({ value: 0, max: 10 })).toEqual({ indeterminate: false, pct: 0, now: 0, max: 10 });
  });
});

describe('spokenProgress', () => {
  it('joins label and detail', () => {
    expect(spokenProgress({ label: 'Dry run: merging', detail: '16 of 20' })).toBe('Dry run: merging, 16 of 20');
  });
  it('skips what is empty', () => {
    expect(spokenProgress({ label: 'Working', detail: '' })).toBe('Working');
    expect(spokenProgress({})).toBe('');
  });
  it('reads a node by its text', () => {
    expect(spokenProgress({ label: 'Scanning', detail: { textContent: '3 groups' } })).toBe('Scanning, 3 groups');
    expect(plainText(null)).toBe('');
  });
});
