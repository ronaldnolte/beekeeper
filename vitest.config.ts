import { defineConfig } from 'vitest/config';

// FORMULAS §0: all engine dates are UTC. A non-UTC run drops the final day and changes every
// value, so every test worker runs in UTC regardless of this computer's time zone.
process.env.TZ = 'UTC';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    env: { TZ: 'UTC' },
  },
});
