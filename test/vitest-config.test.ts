// The test runner's grouping (docserver L1, Task 12). The corpus bounds each render's time, so the two test
// files that build (the browser bundle, the packed tarball) and run the corpus again must not share the machine
// with the other timed corpus runs: vitest.config.ts runs every other file first, then each of the two alone.
import { describe, expect, it } from 'vitest';
import config from '../vitest.config.js';

interface Project {
  extends?: unknown;
  test?: { name?: unknown; include?: unknown; exclude?: unknown; sequence?: { groupOrder?: unknown } };
}

const test = config.test ?? {};
const projects = (test.projects ?? []) as Project[];

describe('vitest.config.ts', () => {
  it('keeps the shared settings: node, the no-network setup file, a 60 s test timeout', () => {
    expect([test.environment, test.setupFiles, test.testTimeout]).toEqual(['node', ['test/setup/no-network.ts'], 60_000]);
  });

  it('runs every other test file first, then the browser bundle alone, then the packed tarball alone', () => {
    expect(
      projects.map((p) => [p.extends, p.test?.name, p.test?.include, p.test?.exclude, p.test?.sequence?.groupOrder]),
    ).toEqual([
      [true, 'unit', ['test/**/*.test.ts'], ['test/browser-parity.test.ts', 'test/pack.test.ts'], 0],
      [true, 'browser', ['test/browser-parity.test.ts'], undefined, 1],
      [true, 'pack', ['test/pack.test.ts'], undefined, 2],
    ]);
  });
});
