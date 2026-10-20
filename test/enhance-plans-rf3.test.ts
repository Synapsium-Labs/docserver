// @vitest-environment jsdom
// Plans on RF3's large plan (docserver L2, Task 11; review focus RF3): the outline must not grow faster than the plan.
// On the large plan (test/fixtures/large-plan.ts: about 1.5 MB, 1,000 steps in 50 tasks) plans' build and an outline
// toggle stay within a measured budget, and on the plan twice as large each takes at most 2.5 times as long.
//
// A file of its own: it is slow (two large documents, enhanced several times each) and it times what it runs, so the
// cases of test/enhance-plans.test.ts stay quick and untimed. The two sizes are measured in turn, run by run, and each
// keeps its best run: a busy machine slows both sizes alike, rather than one more than the other.
//
// The feature list is mocked with a pass-through that times plans' build.
import { afterEach, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';
import type { Feature } from '../src/enhance/features.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { render } from '../src/render/index.js';
import { largePlan } from './fixtures/large-plan.js';

const hooks = vi.hoisted(() => ({ timed: [] as number[] }));

vi.mock('../src/enhance/features.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/enhance/features.js')>();
  const features = (): Feature[] =>
    real.features().map((f): Feature => {
      if (f.name !== 'plans') return f;
      return {
        ...f,
        build: (ctx) => {
          const t0 = performance.now();
          f.build(ctx);
          hooks.timed.push(performance.now() - t0);
        },
      };
    });
  return { ...real, features };
});

const mounted: HTMLElement[] = [];

function mount(md: string): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(md).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((n) => document.importNode(n, true)));
  document.body.append(root);
  mounted.push(root);
  return root;
}

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

const key = (k: string): void => {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
};

interface Cost {
  build: number;
  toggle: number;
  steps: number;
}

/** One run on `root`: enhance it (plans' build timed), turn the outline on and off with `o` (timed), destroy it. */
async function run(root: HTMLElement, best: Cost): Promise<void> {
  hooks.timed = [];
  await enhance(root);
  best.build = Math.min(best.build, hooks.timed[0] ?? Infinity);
  best.steps = contextOf(root)?.plan.steps.length ?? 0;
  const t0 = performance.now();
  key('o');
  key('o');
  best.toggle = Math.min(best.toggle, performance.now() - t0);
  await destroyEnhancement(root);
}

/** The runs of each size. */
const RUNS = 4;

it('RF3: the build and an outline toggle stay within a measured budget, and a 2× plan takes at most 2.5× the time', async () => {
  const one = mount(largePlan(1).markdown);
  const two = mount(largePlan(2).markdown);
  const a: Cost = { build: Infinity, toggle: Infinity, steps: 0 };
  const b: Cost = { build: Infinity, toggle: Infinity, steps: 0 };
  // One enhanced root at a time (the other destroyed), so the `o` on the page goes to it.
  for (let i = 0; i < RUNS; i += 1) {
    await run(one, a);
    await run(two, b);
  }
  expect([a.steps, b.steps]).toEqual([1000, 2000]);
  // Measured in jsdom on a heavily loaded machine (load average near 60), best of four: the build about 400 ms on the
  // large plan and 750 ms on the plan twice its size (a ratio under 1.9), a toggle about 1 ms at both sizes. The
  // budgets leave room for a slower machine; the ratio is what catches a cost that grows faster than the plan. A toggle
  // is too quick to time closely, so its ratio has a 5 ms floor.
  expect(a.build).toBeLessThan(1500);
  expect(a.toggle).toBeLessThan(50);
  expect(b.build).toBeLessThanOrEqual(2.5 * a.build);
  expect(b.toggle).toBeLessThanOrEqual(Math.max(2.5 * a.toggle, 5));
}, 600_000);
