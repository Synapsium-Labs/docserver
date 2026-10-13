// The test runner's configuration. Run it with `./node_modules/.bin/vitest run [file]`, never a bare `npx vitest`.
// The setup file refuses every network call before any test file loads (test/setup/no-network.ts).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['test/setup/no-network.ts'],
    testTimeout: 60_000,
  },
});
