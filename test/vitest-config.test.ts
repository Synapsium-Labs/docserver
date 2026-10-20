// The test runner's grouping (docserver L1, Task 12). The corpus bounds each render's time, so the two test
// files that build (the browser bundle, the packed tarball) and run the corpus again must not share the machine
// with the other timed corpus runs: vitest.config.ts runs every other file first, then each of the two alone.
// L2 Task 6 adds a fourth group, `layout`: the real-browser tests under test/browser/, kept out of `unit` and run
// last, with a hook timeout long enough to launch the browsers.
import { describe, expect, it } from 'vitest';
import config from '../vitest.config.js';

interface Project {
  extends?: unknown;
  test?: { name?: unknown; include?: unknown; exclude?: unknown; hookTimeout?: unknown; sequence?: { groupOrder?: unknown } };
}

const test = config.test ?? {};
const projects = (test.projects ?? []) as Project[];

describe('vitest.config.ts', () => {
  it('keeps the shared settings: node, the no-network setup file, a 60 s test timeout', () => {
    expect([test.environment, test.setupFiles, test.testTimeout]).toEqual(['node', ['test/setup/no-network.ts'], 60_000]);
  });

  it('runs every other test file first, then the browser bundle alone, then the packed tarball alone, then the layout tests', () => {
    expect(
      projects.map((p) => [p.extends, p.test?.name, p.test?.include, p.test?.exclude, p.test?.sequence?.groupOrder]),
    ).toEqual([
      [true, 'unit', ['test/**/*.test.ts'], ['test/browser-parity.test.ts', 'test/pack.test.ts', 'test/browser/**/*.test.ts'], 0],
      [true, 'browser', ['test/browser-parity.test.ts'], undefined, 1],
      [true, 'pack', ['test/pack.test.ts'], undefined, 2],
      [true, 'layout', ['test/browser/**/*.test.ts'], undefined, 3],
    ]);
  });

  it('the layout project, last, waits up to 60 s in a hook (launching a browser); the others keep the default', () => {
    expect(projects.map((p) => p.test?.hookTimeout)).toEqual([undefined, undefined, undefined, 60_000]);
    const orders = projects.map((p) => Number(p.test?.sequence?.groupOrder));
    expect(Math.max(...orders)).toBe(projects.find((p) => p.test?.name === 'layout')?.test?.sequence?.groupOrder);
  });
});
