// The test runner's configuration. Run it with `./node_modules/.bin/vitest run [file]`, never a bare `npx vitest`.
// The setup file refuses every network call before any test file loads (test/setup/no-network.ts).
// Three groups run one after another: every test file but two, then the browser bundle's, then the packed
// tarball's. Those two build (esbuild, tsc, npm pack) and run the corpus, whose verdicts bound each render's
// time, so each runs alone rather than beside the other timed corpus runs.
import { defineConfig } from 'vitest/config';

const BROWSER = 'test/browser-parity.test.ts';
const PACK = 'test/pack.test.ts';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['test/setup/no-network.ts'],
    testTimeout: 60_000,
    projects: [
      { extends: true, test: { name: 'unit', include: ['test/**/*.test.ts'], exclude: [BROWSER, PACK], sequence: { groupOrder: 0 } } },
      { extends: true, test: { name: 'browser', include: [BROWSER], sequence: { groupOrder: 1 } } },
      { extends: true, test: { name: 'pack', include: [PACK], sequence: { groupOrder: 2 } } },
    ],
  },
});
