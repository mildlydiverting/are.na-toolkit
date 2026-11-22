import { describe, it, expect } from 'vitest';
import { nameKey, nameFor, buildNameMap, fetchColorNames, COLOR_NAME_API } from './names.js';

describe('nameKey / nameFor', () => {
  it('uses one key format: lower-case, no #', () => {
    expect(nameKey('#FF0000')).toBe('ff0000');
    expect(nameKey('ff0000')).toBe('ff0000');
  });
  it('finds a name whether or not the hex has a # or capitals', () => {
    const map = { ff0000: 'Red' };
    expect(nameFor(map, '#ff0000')).toBe('Red');
    expect(nameFor(map, '#FF0000')).toBe('Red');
    expect(nameFor(map, 'ff0000')).toBe('Red');
  });
  it('gives undefined for a colour not looked up yet', () => {
    expect(nameFor({}, '#ff0000')).toBeUndefined();
  });
});

describe('buildNameMap', () => {
  it('names what color.pizza returned and marks the rest as looked up with no name', () => {
    const map = buildNameMap(['#ff0000', '#0a141e'], [{ requestedHex: '#ff0000', name: 'Red' }, { requestedHex: '#0a141e' }]);
    expect(map).toEqual({ ff0000: 'Red', '0a141e': '' });
  });
  it('is all empty strings with no response', () => {
    expect(buildNameMap(['#ff0000', '#00ff00'])).toEqual({ ff0000: '', '00ff00': '' });
  });
});

describe('fetchColorNames', () => {
  const ok = body => async () => ({ ok: true, json: async () => body });

  it('asks for the hexes without #, comma-separated, with the list', async () => {
    let url;
    await fetchColorNames(['#ff0000', '#0a141e'], 'werner', async u => { url = u; return { ok: true, json: async () => ({ colors: [] }) }; });
    expect(url).toBe(`${COLOR_NAME_API}?values=ff0000%2C0a141e&list=werner`);
  });
  it('keys names so that nameFor finds them from a # hex', async () => {
    const map = await fetchColorNames(['#ff0000'], 'bestOf', ok({ colors: [{ requestedHex: '#ff0000', name: 'Red' }] }));
    expect(nameFor(map, '#ff0000')).toBe('Red');
  });
  it('leaves every colour without a name (not stuck loading) when the request fails', async () => {
    const down = await fetchColorNames(['#ff0000'], 'bestOf', async () => ({ ok: false }));
    expect(nameFor(down, '#ff0000')).toBe('');
    const offline = await fetchColorNames(['#ff0000'], 'bestOf', async () => { throw new TypeError('Failed to fetch'); });
    expect(nameFor(offline, '#ff0000')).toBe('');
    const garbage = await fetchColorNames(['#ff0000'], 'bestOf', async () => ({ ok: true, json: async () => { throw new SyntaxError('bad'); } }));
    expect(nameFor(garbage, '#ff0000')).toBe('');
  });
});
