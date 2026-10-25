import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/tests/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    server: {
      deps: {
        external: [/^node:/, 'node:sqlite', 'sqlite'],
      },
    },
  },
});
