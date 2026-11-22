// Shared fixture for the export tests: the context object exportContext() builds from the page.
export const fixtureCtx = {
  palette:     [[255, 0, 0], [10, 20, 30], [200, 180, 90]],
  proportions: [0.6, 0.3, 0.1],
  names:       { ff0000: 'Red', c8b45a: 'Mustard' },
  semantic: [
    { role: 'Vibrant',   hex: '#ff0000', proportion: 0.7 },
    { role: 'DarkMuted', hex: '#0a141e', proportion: 0.3 },
  ],
  title:    'Test image',
  blockUrl: 'https://www.are.na/block/123',
  channel:  'chromatic-vwdupl8d0lk',
  slug:     'chromatic-block-123',
};
