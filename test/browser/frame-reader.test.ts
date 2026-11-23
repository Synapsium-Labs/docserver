// Reader mode, library half (LX6.1), in real browsers on the frame's release bytes, in the `default` layout: the host page of
// frame-host-page.ts mounts a document through `./host` with `onReader` and switches the mode with DocFrame.setReading.
//
//   R1   setReading('screens') hides the bar, running head, progress line, rail and settings button and trims the top space in
//        place: the iframe, its nonce and its load count are the same, the frame's elements are the same objects (a mark set on
//        the bar before is still there after), and 'off' restores every one of them.
//   R2   while reader mode is on the `settings` command still opens the settings menu, inside the frame's viewport; the Aa button
//        itself stays hidden.
//   R2b  the same at 390 px with the page scrolled down, where the phone bar slides away: the menu is not carried off the top with it.
//   R3   `r` sends toggle while the mode is off and exit while it is on; Escape with no overlay open sends exit; Escape with the
//        quick jump open closes the jump and sends nothing.
//   R4   the acts at ten a second for five seconds never close the bridge: no fallback, at most four acts a second reach the host,
//        the last one arrives, and the frame still answers a later setReading.
//   R5   a table scrolled sideways sends `active` once while the mode is on (the one-a-minute window is the unit rows'),
//        and none while it is off.
//   R6   a frame mounted without onReader leaves `r` unbound and sends no reader op (nothing is counted as refused: no fallback).
//
// Waits are polls on a condition, never a fixed sleep for something that must happen; a row that must see that something did NOT
// happen ends with a command that travels the same port after it (an ordered barrier).
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { FrameAssets } from '../../src/frame/index.js';
import { openLibHost, type LibHost, type LibMountSpec } from './frame-host-page.js';
import { input, loadFrame, sleep } from './frame-shared.js';
import { browserFor, closeBrowsers, describeBrowsers, type BrowserName } from './harness.js';

let assets: FrameAssets;

beforeAll(async () => {
  assets = (await loadFrame()).assets;
}, 300_000);

afterAll(closeBrowsers);

const PARA = 'A paragraph of plain text that fills the reading column, so the page is long enough to scroll through. '.repeat(6);
const WIDE = 'x'.repeat(240);
const DOC = [
  '# Reader mode',
  '',
  ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) => [`## ${String(n)}. Section ${String(n)}`, '', PARA, '']),
  `| One | Two | Three |\n|---|---|---|\n| ${WIDE} | ${WIDE} | ${WIDE} |\n`,
].join('\n');

async function until(fn: () => Promise<boolean>, label: string, capMs = 30_000): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (await fn().catch(() => false)) return;
    if (Date.now() - start > capMs) expect.fail(`${label}: not within ${String(capMs)} ms`);
    await sleep(50);
  }
}

async function open(browser: BrowserName, over: Partial<LibMountSpec> = {}, width = 1200): Promise<LibHost> {
  const host = await openLibHost(await browserFor(browser), {}, { hostBar: true });
  await host.page.setViewportSize({ width, height: 844 });
  await host.mount({ document: input(DOC), assets, watchdogMs: 60_000, callbacks: ['onReader'], ...over });
  await until(async () => (await host.lib()).events.some((e) => e.kind === 'ready'), 'the frame is ready');
  return host;
}

const acts = async (host: LibHost): Promise<string[]> => (await host.lib()).events.filter((e) => e.kind === 'onReader').map((e) => e.value as string);
const reading = (host: LibHost): Promise<string | null> => host.frame().evaluate(() => document.querySelector('[data-docreader-root]')?.getAttribute('data-reading') ?? null);
const press = async (host: LibHost, k: string): Promise<void> => {
  await until(() => host.frame().evaluate(() => document.hasFocus()), 'the frame has the focus');
  await host.page.keyboard.press(k);
};

/** Whether each piece of chrome is shown: the bar has a height, the others are not display: none. */
const shown = (host: LibHost): Promise<Record<string, boolean>> =>
  host.frame().evaluate(() => {
    const on = (sel: string): boolean => {
      const el = document.querySelector(sel);
      return el !== null && getComputedStyle(el).display !== 'none';
    };
    // The bar stays as a box with no size (the settings menu hangs from it); the rest are taken out of the layout.
    const inner = document.querySelector('.topbar-inner')?.getBoundingClientRect();
    return { bar: inner !== undefined && inner.height > 0, running: on('.running-head'), progress: on('.doc-progress'), rail: on('.doc-toc'), aa: on('.aa-btn') };
  });

const titleTop = (host: LibHost): Promise<number> => host.frame().evaluate(() => (document.querySelector('h1') as HTMLElement).getBoundingClientRect().top);

const paddingTop = (host: LibHost): Promise<number> => host.frame().evaluate(() => parseFloat(getComputedStyle(document.querySelector('[data-docreader-root]') as Element).paddingTop));

describeBrowsers((browser: BrowserName) => {
  it('R1 (default layout): setReading hides the chrome and trims the top space in place, with no remount, and off restores it', async () => {
    const host = await open(browser, {}, 1400);
    try {
      const before = await host.lib();
      const nonce = before.iframe?.nonce;
      expect(nonce).not.toBeNull();
      await host.frame().evaluate(() => {
        (document.querySelector('.topbar') as HTMLElement).dataset['mark'] = 'same-object';
      });
      expect(await shown(host)).toEqual({ bar: true, running: true, progress: true, rail: true, aa: true });
      const spaceBefore = await paddingTop(host);
      const titleBefore = await titleTop(host);
      await host.setReading('screens');
      await until(async () => (await reading(host)) === 'screens', 'the root carries data-reading');
      expect(await shown(host)).toEqual({ bar: false, running: false, progress: false, rail: false, aa: false });
      expect(await paddingTop(host)).toBeLessThan(spaceBefore);
      // The bar takes no room either: the title sits well above where it sat under the bar (the root's top space and the bar's own box are both gone).
      expect(await titleTop(host)).toBeLessThan(titleBefore - 80);
      const during = await host.lib();
      expect(during.iframes).toBe(1);
      expect(during.iframe?.nonce).toBe(nonce);
      expect(during.loads).toHaveLength(before.loads.length);
      expect(await host.frame().evaluate(() => (document.querySelector('.topbar') as HTMLElement).dataset['mark'])).toBe('same-object');
      await host.setReading('off');
      await until(async () => (await reading(host)) === null, 'data-reading is gone');
      expect(await shown(host)).toEqual({ bar: true, running: true, progress: true, rail: true, aa: true });
      expect(await paddingTop(host)).toBe(spaceBefore);
      expect(await titleTop(host)).toBe(titleBefore);
      const after = await host.lib();
      expect(after.iframe?.nonce).toBe(nonce);
      expect(after.loads).toHaveLength(before.loads.length);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('R2 (default layout): the settings command still opens the menu while reader mode is on, at the top right inside the viewport, with Aa hidden', async () => {
    const host = await open(browser);
    try {
      await host.setReading('screens');
      await until(async () => (await reading(host)) === 'screens', 'reader mode is on');
      await host.page.click('#host-settings');
      await until(() => host.frame().evaluate(() => document.querySelector('.aa-menu')?.hasAttribute('hidden') === false), 'the menu opens');
      const box = await host.frame().evaluate(() => {
        const r = (document.querySelector('.aa-menu') as HTMLElement).getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, vw: innerWidth, vh: innerHeight, w: r.width, h: r.height };
      });
      expect(box.w).toBeGreaterThan(100);
      expect(box.h).toBeGreaterThan(100);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(box.vw + 1);
      expect(box.bottom).toBeLessThanOrEqual(box.vh + 1);
      expect((await shown(host)).aa).toBe(false);
      await host.page.click('#host-settings');
      await until(() => host.frame().evaluate(() => document.querySelector('.aa-menu')?.hasAttribute('hidden') === true), 'the second command closes it');
    } finally {
      await host.close();
    }
  }, 240_000);

  it('R2b (default layout): at 390 px, with the page scrolled down (the phone bar slid away), the settings menu still opens inside the viewport', async () => {
    const host = await open(browser, {}, 390);
    try {
      await host.setReading('screens');
      await until(async () => (await reading(host)) === 'screens', 'reader mode is on');
      await host.frame().evaluate(() => {
        scrollTo(0, 600);
      });
      await sleep(100);
      await host.frame().evaluate(() => {
        scrollTo(0, 1800);
      });
      await until(() => host.frame().evaluate(() => document.querySelector('[data-docreader-root]')?.classList.contains('bar-hidden') === true), 'the bar slid away');
      await host.page.click('#host-settings');
      await until(() => host.frame().evaluate(() => document.querySelector('.aa-menu')?.hasAttribute('hidden') === false), 'the menu opens');
      const top = await host.frame().evaluate(() => (document.querySelector('.aa-menu') as HTMLElement).getBoundingClientRect().top);
      expect(top).toBeGreaterThanOrEqual(0);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('R3 (default layout): r toggles, r and Escape exit, and Escape with the quick jump open closes it and sends nothing', async () => {
    const host = await open(browser);
    try {
      await press(host, 'r');
      await until(async () => (await acts(host)).length === 1, 'toggle arrives');
      expect(await acts(host)).toEqual(['toggle']);
      await host.setReading('screens');
      await until(async () => (await reading(host)) === 'screens', 'reader mode is on');
      await sleep(300); // past the 250 ms window of the frame's pacer, so the next act is a leading edge
      await press(host, 'r');
      await until(async () => (await acts(host)).length === 2, 'exit arrives');
      await sleep(300);
      await press(host, 'Escape');
      await until(async () => (await acts(host)).length === 3, 'exit arrives');
      expect(await acts(host)).toEqual(['toggle', 'exit', 'exit']);
      await sleep(300);
      await host.page.keyboard.press('/');
      await until(() => host.frame().evaluate(() => document.querySelector('.jump.open, .jump:not([hidden])') !== null && document.activeElement?.closest('.jump') !== null), 'the quick jump is open');
      await press(host, 'Escape');
      await until(() => host.frame().evaluate(() => document.activeElement?.closest('.jump') === null), 'the jump closed');
      // The ordered barrier: a mode change travels the same port after the Escape, and its act (r) comes after.
      await host.setReading('screens');
      await sleep(300);
      expect(await acts(host)).toEqual(['toggle', 'exit', 'exit']);
      expect((await host.lib()).events.some((e) => e.kind === 'fallback')).toBe(false);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('R4 (default layout): acts at ten a second for five seconds never close the bridge, are kept to four a second, and the last arrives', async () => {
    const host = await open(browser);
    try {
      await until(() => host.frame().evaluate(() => document.hasFocus()), 'the frame has the focus');
      const started = Date.now();
      let presses = 0;
      while (Date.now() - started < 5000) {
        await host.page.keyboard.press('r');
        presses += 1;
        await sleep(100);
      }
      const seconds = (Date.now() - started) / 1000;
      await until(async () => !(await host.lib()).events.some((e) => e.kind === 'fallback') && (await acts(host)).length >= 8, 'acts arrive');
      await sleep(600); // the window that ends last
      const record = await host.lib();
      const got = record.events.filter((e) => e.kind === 'onReader');
      expect(presses).toBeGreaterThan(30);
      expect(record.events.some((e) => e.kind === 'fallback')).toBe(false);
      expect(got.length).toBeLessThanOrEqual(Math.ceil(seconds * 4) + 2);
      expect(got.length).toBeGreaterThanOrEqual(Math.floor(seconds * 3));
      // The frame is still served: a mode change after the burst reaches it.
      await host.setReading('scroll');
      await until(async () => (await reading(host)) === 'scroll', 'the frame still answers');
    } finally {
      await host.close();
    }
  }, 240_000);

  it('R5 (default layout): a table scrolled sideways sends active once while the mode is on, and none while it is off', async () => {
    const host = await open(browser, {}, 900);
    try {
      const scrollTable = (left: number): Promise<boolean> =>
        host.frame().evaluate((x) => {
          const box = Array.from(document.querySelectorAll<HTMLElement>('*')).find((el) => el !== document.body && el.scrollWidth > el.clientWidth + 50 && getComputedStyle(el).overflowX !== 'visible' && el.querySelector('table') !== null);
          if (box === undefined) return false;
          box.scrollLeft = x;
          return true;
        }, left);
      expect(await scrollTable(80)).toBe(true);
      await sleep(400);
      expect(await acts(host)).toEqual([]);
      await host.setReading('screens');
      await until(async () => (await reading(host)) === 'screens', 'reader mode is on');
      await scrollTable(160);
      await until(async () => (await acts(host)).includes('active'), 'active arrives');
      await scrollTable(240);
      await scrollTable(40);
      await sleep(600);
      expect((await acts(host)).filter((a) => a === 'active')).toHaveLength(1);
      await host.setReading('off');
      await until(async () => (await reading(host)) === null, 'reader mode is off');
      await scrollTable(120);
      await sleep(400);
      expect((await acts(host)).filter((a) => a === 'active')).toHaveLength(1);
      expect((await host.lib()).events.some((e) => e.kind === 'fallback')).toBe(false);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('R6 (default layout): a frame mounted without onReader leaves r unbound, and reader mode in place sends it nothing', async () => {
    const host = await open(browser, { callbacks: ['onProgress'] });
    try {
      await press(host, 'r');
      await host.setReading('screens');
      await until(async () => (await reading(host)) === 'screens', 'reader mode is on');
      await press(host, 'Escape');
      await sleep(500);
      expect((await host.lib()).events.filter((e) => e.kind === 'onReader')).toEqual([]);
      expect((await host.lib()).events.some((e) => e.kind === 'fallback')).toBe(false);
    } finally {
      await host.close();
    }
  }, 240_000);
});
