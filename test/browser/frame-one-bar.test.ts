// One header bar, in real browsers, on the frame's release bytes (docserver batch 1.1, Task 8; ledger C108). The host
// page of frame-host-page.ts mounts a document through `./host` with the reader's own bar turned off, and its two
// buttons, which sit outside the iframe, call DocFrame.command(name) as a first consumer's header bar would. The
// frame's attempts run from the parent's side through Playwright's frame access; no row adds an init script.
//
//   B8.1  a host button's press with command('settings') opens the Aa menu and leaves the focus inside the frame (the
//         button took it first: DocFrame.command focuses the iframe). B8.1b: the button's second press closes the menu
//         again, though its mousedown took the focus out of the frame (ruling T6-c); see the note at that row.
//   B8.2  with the bar off `--bar-h` computes to 0px and an anchor jump lands the target at the top, one gap below it;
//         with the bar on `--bar-h` stays 48px and the target lands below the bar.
//   B8.3  command('contents') opens the drawer on a 390 px viewport and a second command closes it; where the rail is
//         shown (1440 px) it opens nothing, and the focus still moved to the frame: the host's call, with no tool to
//         move it after (the one row that sees the focus call alone; every tool that opens moves the focus itself).
//   B8.4  onProgress is given values within 0 to 1, and scrolling to the end reports 1 last.
//   B8.5  a measurement, not an assertion: pixels from the iframe's top to the title's top at 390 px wide, with
//         chrome.topSpace true and false (bar off), and with the bar on for reference. Printed as `host-measure:` lines.
//
// Waits are polls on a condition with a load-tolerant cap; no fixed sleep stands in for an event.
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { FrameAssets } from '../../src/frame/index.js';
import { render } from '../../src/render/index.js';
import { openLibHost, type LibHost, type LibMountSpec, type LibRecord } from './frame-host-page.js';
import { input, loadFrame, sleep } from './frame-shared.js';
import { browserFor, closeBrowsers, describeBrowsers, type BrowserName } from './harness.js';

let assets: FrameAssets;

beforeAll(async () => {
  assets = (await loadFrame()).assets;
}, 300_000);

afterAll(closeBrowsers);

const PARA = 'A paragraph of plain text that fills the reading column, so the page is long enough to scroll through. '.repeat(6);
const DOC = [
  '# One header bar',
  '',
  '**Spec** · 2026-11-05 · Status: Draft',
  '',
  ...[1, 2, 3, 4, 5, 6].flatMap((n) => [`## ${String(n)}. Section ${String(n)}`, '', ...Array.from({ length: 6 }, () => [PARA, '']).flat()]),
].join('\n');

/** The id of the fourth section's heading, as the renderer wrote it. */
function targetId(): string {
  const r = render(DOC);
  if (r.outcome !== 'rendered') throw new Error('the document did not render');
  const ids = Array.from(r.html.matchAll(/<h2 id="([^"]+)"/g), (m) => m[1] ?? '');
  const id = ids[3];
  if (id === undefined || id === '') throw new Error('no fourth section heading with an id');
  return id;
}

const NO_BAR = { chrome: { bar: false } };
const NO_BAR_NO_SPACE = { chrome: { bar: false, topSpace: false } };

/** Poll `fn` until it answers true, or fail the row (an assertion) after `capMs`. */
async function until(fn: () => Promise<boolean>, label: string, capMs = 30_000): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (await fn().catch(() => false)) return;
    if (Date.now() - start > capMs) expect.fail(`${label}: not within ${String(capMs)} ms`);
    await sleep(50);
  }
}

interface Opened {
  readonly host: LibHost;
  lib(): Promise<LibRecord>;
}

/**
 * Mount DOC through the library at `width`, with `features`; wait for its ready; put two buttons above the iframe, a
 * host's header bar in miniature, each calling DocFrame.command. The iframe is as wide as the page and as tall as what
 * is left under the buttons.
 */
async function open(browser: BrowserName, width: number, features: unknown, over: Partial<LibMountSpec> = {}): Promise<Opened> {
  const host = await openLibHost(await browserFor(browser));
  const height = 844;
  await host.page.setViewportSize({ width, height });
  await host.mount({
    document: { ...input(DOC), initialHash: null },
    assets,
    watchdogMs: 60_000,
    features,
    callbacks: ['onProgress'],
    ...over,
  });
  await until(async () => (await host.lib()).events.some((e) => e.kind === 'ready'), 'the frame is ready');
  await host.page.evaluate((h) => {
    const bar = document.createElement('div');
    bar.style.cssText = 'height:40px;display:flex;gap:8px;align-items:center';
    for (const name of ['settings', 'contents']) {
      const b = document.createElement('button');
      b.id = `host-${name}`;
      b.textContent = name;
      b.addEventListener('click', () => (window.__libHost as unknown as { command(n: string): void }).command(name));
      bar.append(b);
    }
    document.body.prepend(bar);
    const f = document.querySelector('iframe') as HTMLIFrameElement;
    f.style.width = '100%';
    f.style.height = `${String(h - 40)}px`;
  }, height);
  return { host, lib: () => host.lib() };
}

const menuOpen = (host: LibHost): Promise<boolean> =>
  host.frame().evaluate(() => {
    const m = document.querySelector('.aa-menu');
    return m !== null && !m.hasAttribute('hidden');
  });

const drawerOpen = (host: LibHost): Promise<boolean> => host.frame().evaluate(() => document.querySelector('[data-docreader-root]')?.classList.contains('toc-open') === true);

const barH = (host: LibHost): Promise<string> =>
  host.frame().evaluate(() => getComputedStyle(document.querySelector('[data-docreader-root]') as Element).getPropertyValue('--bar-h'));

describeBrowsers((browser: BrowserName) => {
  it('B8.1: a host button\'s press runs command(settings): the Aa menu opens and the focus is inside the frame', async () => {
    const { host } = await open(browser, 1200, NO_BAR);
    try {
      expect(await menuOpen(host)).toBe(false);
      await host.page.click('#host-settings');
      await until(() => menuOpen(host), 'the menu opens');
      // The press gave the button the focus; the command moved it into the frame.
      await until(() => host.frame().evaluate(() => document.hasFocus()), 'the frame has the focus');
      expect(await host.page.evaluate(() => document.activeElement?.tagName)).toBe('IFRAME');
      expect((await host.lib()).events.map((e) => e.kind).filter((k) => k !== 'onProgress')).toEqual(['ready']);
    } finally {
      await host.close();
    }
  }, 240_000);

  // Ruling T6-c, made to hold on Chromium by ruling T6-j: the Aa menu in a frame does not close when the focus leaves the
  // document, so a host button's second press, whose mousedown takes the focus out of the frame, closes it through the
  // command. Measured red on Chromium before T6-j: `document.hasFocus()` was still true while the menu's focusout ran, so
  // the menu closed at the mousedown and the release's command opened it again. Under T6-j a focusout naming no element
  // never closes the menu, whatever `hasFocus()` reports.
  it('B8.1b: the host button\'s second press closes the menu although its mousedown took the focus out of the frame', async () => {
    const { host } = await open(browser, 1200, NO_BAR);
    try {
      await host.page.click('#host-settings');
      await until(() => menuOpen(host), 'the menu opens');
      const box = await host.page.locator('#host-settings').boundingBox();
      if (box === null) throw new Error('the host button has no box');
      await host.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await host.page.mouse.down();
      await until(async () => !(await host.frame().evaluate(() => document.hasFocus())), 'the press took the focus out of the frame');
      // The menu stays open while the focus is away: nothing closes it but the command.
      expect(await menuOpen(host)).toBe(true);
      await host.page.mouse.up();
      await until(async () => !(await menuOpen(host)), 'the second press closes the menu');
      await sleep(300);
      expect(await menuOpen(host)).toBe(false);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('B8.2: with the bar off --bar-h is 0px and an anchor jump lands the target one gap below the top; with the bar on it stays 48px', async () => {
    const id = targetId();
    for (const [features, bar] of [[NO_BAR, false], [{}, true]] as const) {
      const { host } = await open(browser, 1200, features, { document: { ...input(DOC), initialHash: id } });
      try {
        await until(async () => (await barH(host)) === (bar ? '48px' : '0px'), `--bar-h settles at ${bar ? '48' : '0'}px`);
        const landed = (): Promise<number> => host.frame().evaluate((i) => (document.getElementById(i) as HTMLElement).getBoundingClientRect().top, id);
        // The jump is the stylesheet's scroll margin: the bar's height (0 without it) plus one gap of 14 px.
        const want = bar ? 62 : 14;
        await until(async () => Math.abs((await landed()) - want) <= 1.5, `the target lands near ${String(want)}px`);
        expect(await barH(host)).toBe(bar ? '48px' : '0px');
        expect(await host.frame().evaluate(() => document.querySelector('[data-docreader-root] .topbar') !== null)).toBe(bar);
      } finally {
        await host.close();
      }
    }
  }, 240_000);

  it('B8.3: command(contents) opens the drawer at 390 px and a second command closes it; at 1440 px, where the rail is shown, it opens nothing', async () => {
    const narrow = await open(browser, 390, NO_BAR);
    try {
      expect(await drawerOpen(narrow.host)).toBe(false);
      await narrow.host.page.click('#host-contents');
      await until(() => drawerOpen(narrow.host), 'the first command opens the drawer');
      await narrow.host.page.click('#host-contents');
      await until(async () => !(await drawerOpen(narrow.host)), 'the second command closes the drawer');
    } finally {
      await narrow.host.close();
    }
    const wide = await open(browser, 1440, NO_BAR);
    try {
      await wide.host.page.click('#host-contents');
      // The command answers false here and changes nothing, but the host cannot know: it focused the iframe first, and
      // no tool of the frame moved the focus afterwards, so this is the focus call alone.
      await until(() => wide.host.frame().evaluate(() => document.hasFocus()), 'the frame has the focus');
      expect(await wide.host.page.evaluate(() => document.activeElement?.tagName)).toBe('IFRAME');
      await sleep(500);
      expect(await drawerOpen(wide.host)).toBe(false);
      expect(await wide.host.frame().evaluate(() => document.querySelector('[data-docreader-root]')?.classList.contains('toc-open'))).toBe(false);
    } finally {
      await wide.host.close();
    }
  }, 240_000);

  it('B8.4: onProgress is given shares within 0 to 1 and scrolling to the end reports 1 last', async () => {
    const { host } = await open(browser, 1200, NO_BAR);
    try {
      const shares = async (): Promise<number[]> => (await host.lib()).events.filter((e) => e.kind === 'onProgress').map((e) => e.value as number);
      await until(async () => (await shares()).length > 0, 'a first progress report');
      expect((await shares())[0]).toBe(0);
      await host.frame().evaluate(() => {
        const s = document.scrollingElement ?? document.documentElement;
        s.scrollTo(0, s.scrollHeight);
      });
      await until(async () => (await shares()).at(-1) === 1, 'the last report is 1');
      // Nothing follows the end's report.
      await sleep(800);
      const all = await shares();
      expect(all.at(-1)).toBe(1);
      expect(all.every((v) => typeof v === 'number' && v >= 0 && v <= 1)).toBe(true);
      expect(all.length).toBeGreaterThanOrEqual(2);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('B8.5 (a measurement): the title\'s top below the iframe\'s top at 390 px, with topSpace true and false', async () => {
    const rows: Record<string, { title: number; padding: string; aboveTitle: string }> = {};
    for (const [name, features] of [['bar off, topSpace true', NO_BAR], ['bar off, topSpace false', NO_BAR_NO_SPACE], ['bar on (reference)', {}]] as const) {
      const { host } = await open(browser, 390, features);
      try {
        // Settled: the reader has written its root classes and the fonts are in; read twice until the figure holds.
        let last = Number.NaN;
        await until(async () => {
          const now = await host.frame().evaluate(() => (document.querySelector('h1') as HTMLElement).getBoundingClientRect().top);
          const same = now === last;
          last = now;
          return same;
        }, `${name}: the title holds still`);
        rows[name] = await host.frame().evaluate(() => ({
          title: (document.querySelector('h1') as HTMLElement).getBoundingClientRect().top,
          padding: getComputedStyle(document.querySelector('[data-docreader-root]') as Element).paddingTop,
          // What the root holds before the title: each element's tag and class, and its top.
          aboveTitle: Array.from((document.querySelector('[data-docreader-root]') as Element).children)
            .filter((el) => el.compareDocumentPosition(document.querySelector('h1') as Element) & Node.DOCUMENT_POSITION_FOLLOWING)
            .map((el) => `${el.tagName.toLowerCase()}.${el.className}@${String(Math.round(el.getBoundingClientRect().top * 10) / 10)}`)
            .join(' '),
        }));
      } finally {
        await host.close();
      }
    }
    console.warn(`host-measure: ${JSON.stringify({ row: 'B8.5', browser, viewportWidth: 390, titleTopFromIframeTop: rows })}`);
    for (const r of Object.values(rows)) expect(Number.isFinite(r.title)).toBe(true);
  }, 240_000);
});
