// The test runner's configuration. Run it with `./node_modules/.bin/vitest run [file]`, never a bare `npx vitest`.
// The setup file refuses every network call before any test file loads (test/setup/no-network.ts).
// Four groups run one after another: every test file but those of the next three, then the browser bundle's, then
// the packed tarball's, then the real-browser layout tests. The two middle ones build (esbuild, tsc, npm pack) and
// run the corpus, whose verdicts bound each render's time, so each runs alone rather than beside the other timed
// corpus runs. The layout tests (test/browser/, LD2) drive Chromium and WebKit, so they run last, by themselves,
// with a longer hook timeout: each selected browser's block launches its browser in a beforeAll hook
// (test/browser/harness.ts, describeBrowsers), so a slow start is bounded there and not by the first test.
import { defineConfig } from 'vitest/config';

const BROWSER = 'test/browser-parity.test.ts';
const PACK = 'test/pack.test.ts';
const LAYOUT = 'test/browser/**/*.test.ts';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['test/setup/no-network.ts'],
    testTimeout: 60_000,
    projects: [
      { extends: true, test: { name: 'unit', include: ['test/**/*.test.ts'], exclude: [BROWSER, PACK, LAYOUT, 'test/enhance-since.test.ts'], sequence: { groupOrder: 0 } } },
      { extends: true, test: { name: 'since-unit', include: ['test/enhance-since.test.ts'], env: { TZ: 'Asia/Kolkata' }, pool: 'forks', isolate: true, sequence: { groupOrder: 0 } } },
      { extends: true, test: { name: 'browser', include: [BROWSER], sequence: { groupOrder: 1 } } },
      { extends: true, test: { name: 'pack', include: [PACK], sequence: { groupOrder: 2 } } },
      { extends: true, test: { name: 'layout', include: [LAYOUT], hookTimeout: 60_000, sequence: { groupOrder: 3 } } },
    ],
  },
});
