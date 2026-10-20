// Plans in a real browser (docserver L2, Task 11): what the stylesheet makes of the outline mode, which jsdom cannot
// show. On the plan sample, with a stored outline: each task shows as its step titles (its other parts and every
// step's body have no box), a tight step is one row with its number beside its title, "Show all" shows one task whole,
// `o` shows the full plan (the "Show all" buttons gone, every part back), and printing shows everything whatever the
// outline. Under the strict policy, with nothing refused.
import { readFileSync } from 'node:fs';
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const SAMPLE = readFileSync(new URL('../../scripts/demo/samples/plans.md', import.meta.url), 'utf8');

const STORED = { storageKey: 'case', storage: { snapshot: { 'docreader:doc:case:outline': 'true' } } };

afterAll(closeBrowsers);

interface Seen {
  /** Per task, in order: whether each of its parts has a box (lists apart). */
  readonly parts: boolean[][];
  /** Whether each step body (`.step-rest`) has a box. */
  readonly rest: boolean[];
  /** Whether each step's number and title have boxes. */
  readonly titles: boolean[];
  /** Whether each "Show all" button has a box. */
  readonly buttons: boolean[];
  readonly outline: boolean;
  readonly pressed: string | null;
}

/** In the page: what has a box. */
function seen(): Seen {
  const root = document.querySelector('main[data-harness-root]') as HTMLElement;
  const shown = (el: Element): boolean => el.getClientRects().length > 0;
  const tasks = Array.from(root.querySelectorAll('h2.task, h3.task'));
  const parts = tasks.map((h) => {
    const out: boolean[] = [];
    for (let n = h.nextElementSibling; n !== null && n.classList.contains('task-part'); n = n.nextElementSibling) {
      if (!n.classList.contains('contains-task-list')) out.push(shown(n));
    }
    return out;
  });
  return {
    parts,
    rest: Array.from(root.querySelectorAll('.step-rest')).map(shown),
    titles: Array.from(root.querySelectorAll('li.task-list-item')).flatMap((li) => [li.querySelector('.step-no'), li.querySelector('strong')].map((x) => x !== null && shown(x))),
    buttons: Array.from(root.querySelectorAll('.task-open')).map(shown),
    outline: root.classList.contains('outline'),
    pressed: root.querySelector('.outline-btn')?.getAttribute('aria-pressed') ?? null,
  };
}

/** In the page: the first tight step's number and title boxes, as [top, bottom, left, right] each. */
function stepBoxes(): number[][] {
  const li = Array.from(document.querySelectorAll('li.task-list-item')).find((x) => !x.classList.contains('loose')) as Element;
  return [li.querySelector('.step-no'), li.querySelector('strong')].map((x) => {
    const r = (x as Element).getBoundingClientRect();
    return [r.top, r.bottom, r.left, r.right];
  });
}

const all = (list: readonly boolean[], v: boolean): boolean => list.length > 0 && list.every((x) => x === v);

/** Every task's parts (other than its lists) have a box, or none has; a task with no such part passes. */
const everyPart = (list: readonly (readonly boolean[])[], v: boolean): boolean => all(list.flat(), v);

describeBrowsers((browser) => {
  it('a stored outline shows each task as its step titles; "Show all" shows one whole; o the full plan; print everything', async () => {
    const doc = await openDoc(SAMPLE, STORED, { browser, csp: 'strict' });
    try {
      const out = await doc.page.evaluate(seen);
      expect([out.outline, out.pressed]).toEqual([true, 'true']);
      expect(out.parts).toHaveLength(4);
      expect(everyPart(out.parts, false)).toBe(true);
      expect(all(out.rest, false)).toBe(true);
      expect(all(out.titles, true)).toBe(true);
      expect(all(out.buttons, true)).toBe(true);
      // A tight step is one row: its number beside its title.
      const [no, title] = (await doc.page.evaluate(stepBoxes)) as [number[], number[]];
      expect((no[1] as number) > (title[0] as number) && (no[0] as number) < (title[1] as number)).toBe(true);
      expect(no[3] as number).toBeLessThanOrEqual(title[2] as number);

      // "Show all" on the second task: its parts and its steps' bodies show; the others stay outlined.
      await doc.page.locator('.task-open').nth(1).click();
      const open = await doc.page.evaluate(seen);
      expect(open.parts.map((p) => p.length > 0 && p.every(Boolean))).toEqual([false, true, false, false]);
      expect(open.rest.filter(Boolean).length).toBeGreaterThan(0);
      expect(open.rest.filter((x) => !x).length).toBeGreaterThan(0);

      // o: the full plan, every part and body shown, the buttons gone.
      await doc.page.keyboard.press('o');
      const full = await doc.page.evaluate(seen);
      expect([full.outline, full.pressed]).toEqual([false, 'false']);
      expect(everyPart(full.parts, true)).toBe(true);
      expect(all(full.rest, true)).toBe(true);
      expect(all(full.buttons, false)).toBe(true);
      const [fullNo, fullTitle] = (await doc.page.evaluate(stepBoxes)) as [number[], number[]];
      expect(fullNo[1] as number).toBeLessThanOrEqual((fullTitle[0] as number) + 0.5); // the number above the title

      // The outline again, then print: everything shows.
      await doc.page.keyboard.press('o');
      expect((await doc.page.evaluate(seen)).outline).toBe(true);
      await doc.page.emulateMedia({ media: 'print' });
      const printed = await doc.page.evaluate(seen);
      expect(everyPart(printed.parts, true)).toBe(true);
      expect(all(printed.rest, true)).toBe(true);
      await doc.page.emulateMedia({ media: 'screen' });
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  it('without a stored outline the plan opens whole, and the Outline button turns the outline on', async () => {
    const doc = await openDoc(SAMPLE, {}, { browser, csp: 'strict' });
    try {
      const out = await doc.page.evaluate(seen);
      expect([out.outline, out.pressed]).toEqual([false, 'false']);
      expect(everyPart(out.parts, true)).toBe(true);
      await doc.page.locator('.outline-btn').click();
      const after = await doc.page.evaluate(seen);
      expect([after.outline, after.pressed]).toEqual([true, 'true']);
      expect(everyPart(after.parts, false)).toBe(true);
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });
});
