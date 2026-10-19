import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['shared/**/*.test.js', 'scripts/**/*.test.js', 'arena-*/src/**/*.test.js'],
  },
});
