// What changed, in a real browser (docserver L2, Task 20): a step brings the next change into view under the bar and
// flashes it, which jsdom, with no layout and no animations, cannot show. On the changes sample, in both browsers,
// under the strict policy, in a window 700 px high (so a place in the middle of the sample can reach the top): with
// reduced motion the step lands at once, its flash marked but not animated (the stylesheet stops every animation);
// with motion it lands once the smooth scroll ends, the flash animating, and a second flash of the same place starts
// its animation again.
//
// The host is the test's: the harness's page script never enhances here (`enhance: false`); this file serves a script
// of its own from the page's origin (a route on the page, which takes precedence over the harness's context route),
// built from ./enhance with a host whose changes() answers the set the case gives, and showChanges reached through the
// instance's context, as Task 22's menu will reach it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { Page } from 'playwright-core';
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc, ORIGIN, type BrowserName } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SAMPLE = readFileSync(new URL('../../scripts/demo/samples/changes.md', import.meta.url), 'utf8');

afterAll(closeBrowsers);

/** The page script: enhance the root with a comparison, and show a set through showChanges. */
const ENTRY = `
import { enhance } from './src/enhance/index.ts';
import { showChanges } from './src/enhance/changes.ts';
import { contextOf } from './src/enhance/lifecycle.ts';
const root = document.querySelector('main[data-harness-root]');
let set = null;
window.__changesHost = {
  async start() {
    await enhance(root, { info: { sha: 'abcdef1' }, changes: () => Promise.resolve(set) });
    await document.fonts.ready;
  },
  async show(next, how) {
    set = next;
    const out = await showChanges(contextOf(root), next.base, how);
    return JSON.stringify(out);
  },
  native(text) {
    const target = Array.from(root.querySelectorAll('p')).find((el) => el.textContent?.startsWith(text));
    if (!target) throw new Error('no target');
    target.id = 'native-target';
    contextOf(root).nav.goTo(target, { push: false, focus: false });
  },
};
`;

let script: Promise<string> | undefined;

function hostScript(): Promise<string> {
  script ??= build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'changes-host.ts', loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
  }).then((r) => r.outputFiles[0]?.text ?? '');
  return script;
}

interface Host {
  start(): Promise<void>;
  show(set: { base: string; changed: [number, number][] }, how: { what: string; jump?: boolean }): Promise<string>;
  native(text: string): void;
}

/** Open the sample with this file's host, enhanced. */
async function open(browser: BrowserName): Promise<{ page: Page; violations: () => Promise<string[]>; close: () => Promise<void> }> {
  const doc = await openDoc(SAMPLE, {}, { browser, enhance: false, viewport: { width: 1440, height: 700 } });
  const body = await hostScript();
  await doc.page.route(`${ORIGIN}/changes-host.js`, (route) => route.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' }, body }));
  await doc.page.addScriptTag({ url: '/changes-host.js' });
  await doc.page.evaluate(() => (window as unknown as { __changesHost: Host }).__changesHost.start());
  return { page: doc.page, violations: () => doc.violations(), close: () => doc.close() };
}

/** The lines of the first element matching `sel` whose text starts with `text`. */
function linesOf(page: Page, sel: string, text: string): Promise<[number, number]> {
  return page.evaluate(
    ([s, t]) => {
      const el = Array.from(document.querySelectorAll(s as string)).find((e) => (e.textContent ?? '').trim().startsWith(t as string));
      const m = /^(\d+)-(\d+)$/.exec(el?.getAttribute('data-line') ?? '');
      if (m === null) throw new Error(`no ${String(s)} "${String(t)}"`);
      return [Number(m[1]), Number(m[2])] as [number, number];
    },
    [sel, text],
  );
}

interface Landed {
  /** The document scroll offset when the place was measured. */
  readonly scrollY: number;
  /** The place's top, in the viewport. */
  readonly top: number;
  /** The bar's bottom in the viewport, never above its top. */
  readonly bar: number;
  readonly height: number;
  /** The landed change is physically reachable, rather than occluded by the bar. */
  readonly hit: boolean;
  readonly flash: boolean;
  /** The flash animation's current time, or null with none running. */
  readonly time: number | null;
  readonly count: string;
}

/** In the page: where the element whose text starts with `text` sits, and its flash. */
function landed(page: Page, text: string): Promise<Landed> {
  return page.evaluate((t) => {
    const el = Array.from(document.querySelectorAll('main[data-harness-root] p')).find((e) => (e.textContent ?? '').startsWith(t)) as HTMLElement;
    const bar = document.querySelector('main[data-harness-root] .topbar-inner') as HTMLElement;
    // A changed block flashes by the cell's keyframes (the stylesheet's `.chg.flash`), any other by the block's.
    const anim = el.getAnimations().find((a) => /^docreader-flash(?:-cell)?$/.test((a as CSSAnimation).animationName));
    return {
      scrollY: window.scrollY,
      top: el.getBoundingClientRect().top,
      bar: Math.max(0, bar.getBoundingClientRect().bottom),
      height: window.innerHeight,
      hit: document.elementFromPoint(el.getBoundingClientRect().left + 30, el.getBoundingClientRect().top + 3)?.closest('p.chg') === el,
      flash: el.classList.contains('flash'),
      time: anim === undefined || anim.currentTime === null ? null : Number(anim.currentTime),
      count: document.querySelector('main[data-harness-root] .chg-nav .cn')?.textContent ?? '',
    };
  }, text);
}

/** Wait until the page has stopped scrolling: the same scroll position over a few frames, within 5 s. */
async function settled(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let last = -1;
        let same = 0;
        const t0 = performance.now();
        const tick = (): void => {
          same = window.scrollY === last ? same + 1 : 0;
          last = window.scrollY;
          if (same >= 6 || performance.now() - t0 > 5000) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
}

const show = (page: Page, set: { base: string; changed: [number, number][] }): Promise<string> =>
  page.evaluate(([s]) => (window as unknown as { __changesHost: Host }).__changesHost.show(s as { base: string; changed: [number, number][] }, { what: 'Since Monday', jump: false }), [set] as const);

/** The place lands under the bar, near the top of the window, flashing (animated, unless `still`). */
function expectLanded(at: Landed, still = false): void {
  expect(at.top).toBeGreaterThanOrEqual(at.bar - 1);
  expect(at.top).toBeLessThan(at.bar + 100);
  expect(Math.abs(at.top - (at.bar + 14))).toBeLessThanOrEqual(1);
  expect(at.hit).toBe(true);
  expect(at.flash).toBe(true);
  if (still) expect(at.time).toBeNull();
  else expect(at.time).not.toBeNull();
}

describeBrowsers((browser) => {
  it('with reduced motion, a step brings the next change under the bar at once, and flashes it', async () => {
    const doc = await open(browser);
    try {
      await doc.page.emulateMedia({ reducedMotion: 'reduce' });
      const design = await linesOf(doc.page, 'p', 'A file the tool cannot read is listed');
      const notes = await linesOf(doc.page, 'p', 'The walk reads each file');
      expect(await show(doc.page, { base: '1234567', changed: [design, notes] })).toBe('{"places":2}');
      await doc.page.keyboard.press('n');
      const first = await landed(doc.page, 'A file the tool cannot read is listed');
      expectLanded(first, true);
      expect(first.count).toBe('1 of 2');
      await doc.page.keyboard.press('Escape');
      const away = await doc.page.evaluate(() => {
        const target = Array.from(document.querySelectorAll('main[data-harness-root] p')).find((el) => el.textContent?.startsWith('A file the tool cannot read is listed')) as HTMLElement;
        window.scrollTo(0, 700);
        return { scrollY, top: target.getBoundingClientRect().top };
      });
      expect(away.scrollY).not.toBe(first.scrollY);
      expect(Math.abs(away.top - first.top)).toBeGreaterThan(100);
      await doc.page.evaluate(() => {
        const target = Array.from(document.querySelectorAll('main[data-harness-root] p')).find((el) => el.textContent?.startsWith('A file the tool cannot read is listed')) as HTMLElement;
        const original = target.scrollIntoView.bind(target);
        (window as unknown as { __nativeCalls: number }).__nativeCalls = 0;
        target.scrollIntoView = ((options?: ScrollIntoViewOptions) => {
          (window as unknown as { __nativeCalls: number }).__nativeCalls += 1;
          original(options);
        }) as typeof target.scrollIntoView;
      });
      // Capture before a ResizeObserver can reapply the pinned reach after this native dispatch.
      const nativeCalls = await doc.page.evaluate((text) => {
        (window as unknown as { __changesHost: Host }).__changesHost.native(text);
        return (window as unknown as { __nativeCalls: number }).__nativeCalls;
      }, 'A file the tool cannot read is listed');
      expect(nativeCalls).toBe(1);
      const native = await landed(doc.page, 'A file the tool cannot read is listed');
      expectLanded(native, true);
      expect(native.scrollY).not.toBe(away.scrollY);
      expect(Math.abs(native.top - first.top)).toBeLessThanOrEqual(1);
      await doc.page.keyboard.press('n');
      const second = await landed(doc.page, 'The walk reads each file');
      expectLanded(second, true);
      expect(second.count).toBe('2 of 2');
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  it('with motion, the step lands once the smooth scroll ends; a second flash of the place starts again', async () => {
    const doc = await open(browser);
    try {
      await doc.page.emulateMedia({ reducedMotion: 'no-preference' });
      const design = await linesOf(doc.page, 'p', 'The report is one Markdown file');
      expect(await show(doc.page, { base: '1234567', changed: [design] })).toBe('{"places":1}');
      await doc.page.evaluate(() => window.scrollTo(0, 700));
      await settled(doc.page);
      const before = await doc.page.evaluate(() => {
        const target = Array.from(document.querySelectorAll('main p')).find((el) => el.textContent?.startsWith('The report is one Markdown file')) as HTMLElement;
        const original = window.scrollTo.bind(window);
        (window as unknown as { __changeScrolls: ScrollToOptions[] }).__changeScrolls = [];
        window.scrollTo = ((options: ScrollToOptions) => {
          (window as unknown as { __changeScrolls: ScrollToOptions[] }).__changeScrolls.push(options);
          original(options);
        }) as typeof window.scrollTo;
        return { scrollY, top: target.getBoundingClientRect().top, height: innerHeight };
      });
      expect(before.scrollY).toBe(700);
      expect(Math.abs(before.top)).toBeLessThanOrEqual(before.height * 2);
      expect(Math.abs(before.top + before.scrollY)).toBeGreaterThan(before.height * 2);
      await doc.page.keyboard.press('n');
      expect(await doc.page.evaluate(() => (window as unknown as { __changeScrolls: ScrollToOptions[] }).__changeScrolls.some((call) => call.behavior === 'smooth'))).toBe(true);
      await settled(doc.page);
      const at = await landed(doc.page, 'The report is one Markdown file');
      expectLanded(at);
      // Once the flash has run 300 ms (whatever the scroll took), a step to the same place starts it again.
      await doc.page.waitForFunction(() => {
        const el = Array.from(document.querySelectorAll('main[data-harness-root] p.flash')).find((e) => (e.textContent ?? '').startsWith('The report is one'));
        return el?.getAnimations().some((x) => Number(x.currentTime) > 300) === true;
      }, undefined, { timeout: 1500 });
      // One place: the next step is the same place, just visited, so it flashes again from the start.
      await doc.page.keyboard.press('n');
      const again = await landed(doc.page, 'The report is one Markdown file');
      expect(again.flash).toBe(true);
      expect(again.time).not.toBeNull();
      expect(again.time as number).toBeLessThan(300);
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });
});
