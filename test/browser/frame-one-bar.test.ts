// One header bar, in real browsers, on the frame's release bytes (docserver batch 1.1, Task 8; ledger C108). The host
// page of frame-host-page.ts (`hostBar`) mounts a document through `./host` with the reader's own bar turned off, and
// its two buttons, which sit outside the iframe, call DocFrame.command(name) as a first consumer's header bar would. The
// viewport is set before the mount, so the frame is laid out at the row's width from its first frame. The frame's
// attempts run from the parent's side through Playwright's frame access; no row adds an init script.
//
// A row that presses a host button first puts the focus on that button and waits until the frame has lost it, so the
// press cannot pass for want of a precondition (the iframe holds the focus after a mount; an engine that does not focus
// a button on a press would leave it there).
//
//   B8.1   a host button's press with command('settings') opens the Aa menu, and the focus is then inside the frame and
//          inside the menu. B8.1 runs with a mouse press and again as a tap in a touch context (risk CR1).
//   B8.1b  the button's second press closes the menu, though its mousedown took the focus out of the frame (rulings T6-c
//          and T6-j).
//   B8.1c  ruling T6-j's other half: with the focus away from the frame the menu stays open, a host command for another
//          tool (contents, at 390 px) is refused and changes nothing, and the settings command still closes the menu.
//   B8.2   with the bar off `--bar-h` computes to 0px and an anchor jump, from the mount's own hash and from a click on
//          an in-document link, lands the target one gap below the top; with the bar on `--bar-h` stays 48px and the
//          target lands below the bar.
//   B8.3   command('contents') opens the drawer at 390 px and a second command closes it; where the rail is shown
//          (1440 px) it opens nothing, and the focus still moved to the frame: the host's call, with no tool to move it
//          after (the one row that sees the focus call alone; every tool that opens moves the focus itself).
//   B8.4   onProgress is given values within 0 to 1, and scrolling to the end reports 1 last.
//   B8.5   a measurement, not an assertion: pixels from the iframe's top to the title's top at 390 px wide, with
//          chrome.topSpace true and false (bar off), and with the bar on for reference. Printed as `host-measure:` lines.
//   B8.6   fix round FR1 (advisory A6), bar off at 390 px wide inside the frame, with a drawn figure and a two-column
//          table (three or more columns stack on a phone, with no head to stick): (a) the open settings menu ends inside the frame's bottom edge (its max-height counts the bar, which
//          `--bar-h: 0` zeroes, so the sticky Aa's own top and height must be counted too), at two frame heights; (b) the
//          sticky Aa covers no control's hit area: at the centre of the stuck figure tools' last button, and of the stuck
//          table head's last cell, the element found is not Aa. The numbers are printed as `host-measure:` lines.
//   B8.7   fix round FR1 (the coordinator's ruling on A6(b)): with the bar off at 390 px, a point sampled every 3 px across
//          the whole width of the stuck figure tools' last button, and of the sticky table head's last cell, finds that
//          control and never Aa; both sit below Aa. A root with the bar on keeps its own tops (the bar's height plus 6 px
//          for the tools, the bar's height for the head; 6 px and 0 while the bar is slid away).
//   B8.8   fix round FR1 (ruling FR1-e): the offset below Aa is a floor, and only for a root that carries Aa. (a) A bar-off
//          root whose host sets `--bar-h: 64px` (its own fixed header, as an ./enhance host does; set here as an inline
//          custom property on the root) keeps the head at 64 px and the tools at 70; (b) a bar-off root with
//          `chrome.settings: false` (no Aa) keeps the head at 0 px and the tools at 6.
//   B8.9   fix round FR2 (review F1): a jump to a table row that has no id, on a bar-off root that carries Aa, at 390 px,
//          lands the row clear of the sticky head, which sticks at the floor below Aa and not at the bar's height (0).
//   B8.10  the same for a row a host gave an id (set here from the frame's side), brought to the top with scrollIntoView, which
//          applies the stylesheet's `tr[id]` scroll margin.
//
// Waits are polls on a condition with a load-tolerant cap, and a row that must see that something did NOT happen ends
// with a command that travels the same port after it (an ordered barrier), never a fixed sleep.
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { FrameAssets } from '../../src/frame/index.js';
import { render, scanRefs } from '../../src/render/index.js';
import { openLibHost, type LibHost, type LibMountSpec } from './frame-host-page.js';
import { input, loadFrame, sleep } from './frame-shared.js';
import { browserFor, closeBrowsers, describeBrowsers, type BrowserName } from './harness.js';

let assets: FrameAssets;
let mermaidText = '';

beforeAll(async () => {
  const built = await loadFrame();
  assets = built.assets;
  mermaidText = built.mermaid;
}, 300_000);

afterAll(closeBrowsers);

const PARA = 'A paragraph of plain text that fills the reading column, so the page is long enough to scroll through. '.repeat(6);
const SECTIONS = [1, 2, 3, 4, 5, 6].flatMap((n) => [`## ${String(n)}. Section ${String(n)}`, '', ...Array.from({ length: 6 }, () => [PARA, '']).flat()]);
const HEAD = ['# One header bar', '', '**Spec** · 2026-11-05 · Status: Draft', ''];

/** The id of the fourth section's heading, as the renderer wrote it. */
function targetId(): string {
  const r = render([...HEAD, ...SECTIONS].join('\n'));
  if (r.outcome !== 'rendered') throw new Error('the document did not render');
  const ids = Array.from(r.html.matchAll(/<h2 id="([^"]+)"/g), (m) => m[1] ?? '');
  const id = ids[3];
  if (id === undefined || id === '') throw new Error('no fourth section heading with an id');
  return id;
}

const ID = targetId();
/** The document: its title, a link to the fourth section in the first paragraph, then the sections. */
const DOC = [...HEAD, `Jump to [section four](#${ID}).`, '', ...SECTIONS].join('\n');

/** The A6 document: a tall drawn figure (its tools row sticks) and a two-column table (a table of three or more columns stacks on a phone and has no head to stick), each between paragraphs. */
const A6_MD = [
  '# A6',
  '',
  PARA,
  '',
  ...['```mermaid', 'flowchart TD', ...Array.from({ length: 14 }, (_, i) => `  N${String(i)} --> N${String(i + 1)}`), '```', '', '*Figure 1. A tall chain.*', ''],
  PARA,
  '',
  ...['| Name | Status |', '|---|---|', ...Array.from({ length: 40 }, (_, i) => `| R${String(i + 1)} | Open |`), ''],
  PARA,
  '',
].join('\n');

/** The B8.9 document: a link to the 14th row of a 40-row two-column table (its rows carry no id), the table, then text. */
const ROW_MD = [
  '# B8.9',
  '',
  'Jump to [row fourteen](#R14).',
  '',
  PARA,
  '',
  ...['| Name | Status |', '|---|---|', ...Array.from({ length: 40 }, (_, i) => `| R${String(i + 1)} | Open |`), ''],
  PARA,
  '',
].join('\n');

const NO_BAR = { chrome: { bar: false } };
const NO_BAR_NO_SPACE = { chrome: { bar: false, topSpace: false } };

/**
 * Poll `fn` until it answers true, or fail the row (an assertion) after `capMs`. The failure names the last error `fn`
 * threw and, when `describe` is given, the value it reads then.
 */
async function until(fn: () => Promise<boolean>, label: string, describe?: () => Promise<unknown>, capMs = 30_000): Promise<void> {
  const start = Date.now();
  let lastError = '';
  for (;;) {
    try {
      if (await fn()) return;
    } catch (e) {
      lastError = e instanceof Error ? e.message.split('\n')[0] ?? '' : String(e);
    }
    if (Date.now() - start > capMs) {
      let seen = '';
      if (describe !== undefined) seen = await describe().then((v) => JSON.stringify(v), (e: unknown) => `unreadable: ${e instanceof Error ? e.message.split('\n')[0] ?? '' : String(e)}`);
      expect.fail(`${label}: not within ${String(capMs)} ms; last value ${seen === '' ? 'not read' : seen}; last error ${lastError === '' ? 'none' : lastError}`);
    }
    await sleep(50);
  }
}

/**
 * Mount DOC through the library at `width`, with `features`, behind the host page's own bar; the viewport is set first,
 * so the frame is laid out at `width` from its first frame; wait for ready.
 */
async function open(browser: BrowserName, width: number, features: unknown, over: Partial<LibMountSpec> = {}, touch = false): Promise<LibHost> {
  const host = await openLibHost(await browserFor(browser), { touch }, { hostBar: true });
  await host.page.setViewportSize({ width, height: 844 });
  await host.mount({
    document: { ...input(DOC), initialHash: null },
    assets,
    watchdogMs: 60_000,
    features,
    callbacks: ['onProgress'],
    ...over,
  });
  await until(async () => (await host.lib()).events.some((e) => e.kind === 'ready'), 'the frame is ready');
  return host;
}

const hasFocus = (host: LibHost): Promise<boolean> => host.frame().evaluate(() => document.hasFocus());
const parentActive = (host: LibHost): Promise<string> => host.page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName || 'none');

const menuOpen = (host: LibHost): Promise<boolean> =>
  host.frame().evaluate(() => {
    const m = document.querySelector('.aa-menu');
    return m !== null && !m.hasAttribute('hidden');
  });

const drawerOpen = (host: LibHost): Promise<boolean> => host.frame().evaluate(() => document.querySelector('[data-docreader-root]')?.classList.contains('toc-open') === true);

const barH = (host: LibHost): Promise<string> =>
  host.frame().evaluate(() => getComputedStyle(document.querySelector('[data-docreader-root]') as Element).getPropertyValue('--bar-h'));

/** The target's top in the frame's viewport. */
const targetTop = (host: LibHost): Promise<number> => host.frame().evaluate((i) => (document.getElementById(i) as HTMLElement).getBoundingClientRect().top, ID);

/** Put the focus on the host button `name` and wait until the frame has lost it: the precondition of a press. */
async function leaveFrame(host: LibHost, name: string): Promise<void> {
  await host.page.focus(`#host-${name}`);
  await until(async () => !(await hasFocus(host)), 'the frame lost the focus', async () => ({ frameHasFocus: await hasFocus(host), parentActive: await parentActive(host) }));
  expect(await parentActive(host)).toBe(`host-${name}`);
}

/** The press of a host button: a mouse press, or a tap. */
async function press(host: LibHost, name: string, how: 'click' | 'tap'): Promise<void> {
  if (how === 'tap') await host.page.tap(`#host-${name}`);
  else await host.page.click(`#host-${name}`);
}

/** The focus after a command that opened something: in the frame (the parent's active element is the iframe), and in `inside`. */
async function expectFocusIn(host: LibHost, inside: string): Promise<void> {
  const state = (): Promise<unknown> => Promise.all([hasFocus(host), parentActive(host)]);
  await until(() => hasFocus(host), 'the frame has the focus', state);
  expect(await parentActive(host)).toBe('IFRAME');
  await until(
    () => host.frame().evaluate((sel) => document.querySelector(sel)?.contains(document.activeElement) === true, inside),
    `the focus is inside ${inside}`,
    () => host.frame().evaluate(() => `${document.activeElement?.tagName ?? 'none'}.${document.activeElement?.className ?? ''}`),
  );
}

describeBrowsers((browser: BrowserName) => {
  for (const how of ['click', 'tap'] as const) {
    it(`B8.1: a host button's ${how === 'tap' ? 'tap' : 'mouse press'} runs command(settings): the Aa menu opens and the focus is inside the frame and the menu`, async () => {
      const host = await open(browser, 1200, NO_BAR, {}, how === 'tap');
      try {
        expect(await menuOpen(host)).toBe(false);
        await leaveFrame(host, 'settings');
        await press(host, 'settings', how);
        await until(() => menuOpen(host), 'the menu opens', async () => ({ open: await menuOpen(host), parentActive: await parentActive(host) }));
        await expectFocusIn(host, '.aa-menu');
        expect((await host.lib()).events.map((e) => e.kind).filter((k) => k !== 'onProgress')).toEqual(['ready']);
      } finally {
        await host.close();
      }
    }, 240_000);
  }

  // Ruling T6-c, made to hold on Chromium by ruling T6-j: the Aa menu in a frame does not close when the focus leaves the
  // document, so a host button's second press, whose mousedown takes the focus out of the frame, closes it through the
  // command. Measured red on Chromium before T6-j: `document.hasFocus()` was still true while the menu's focusout ran, so
  // the menu closed at the mousedown and the release's command opened it again. Under T6-j a focusout naming no element
  // never closes the menu, whatever `hasFocus()` reports.
  it('B8.1b: the host button\'s second press closes the menu although its mousedown took the focus out of the frame', async () => {
    const host = await open(browser, 1200, NO_BAR);
    try {
      await press(host, 'settings', 'click');
      await until(() => menuOpen(host), 'the menu opens');
      const box = await host.page.locator('#host-settings').boundingBox();
      if (box === null) throw new Error('the host button has no box');
      await host.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await host.page.mouse.down();
      await until(async () => !(await hasFocus(host)), 'the press took the focus out of the frame');
      // The menu stays open while the focus is away: nothing closes it but the command.
      expect(await menuOpen(host)).toBe(true);
      await host.page.mouse.up();
      await until(async () => !(await menuOpen(host)), 'the second press closes the menu', async () => ({ open: await menuOpen(host) }));
      await sleep(300);
      expect(await menuOpen(host)).toBe(false);
    } finally {
      await host.close();
    }
  }, 240_000);

  // Ruling T6-j, its other half (README, `command`): focus leaving the frame keeps the menu open, and while it is open
  // a command for another tool is refused. The settings command that follows travels the same port after the refused
  // one, so when it has closed the menu the refused command has been handled: that is the barrier for "changed nothing".
  it('B8.1c: with the focus away the menu stays open; a contents command while it is open changes nothing; the settings command closes it', async () => {
    const host = await open(browser, 390, NO_BAR);
    try {
      await press(host, 'settings', 'click');
      await until(() => menuOpen(host), 'the menu opens');
      await leaveFrame(host, 'contents');
      expect(await menuOpen(host)).toBe(true);
      await press(host, 'contents', 'click');
      await until(() => hasFocus(host), 'the contents press focused the frame');
      expect(await menuOpen(host)).toBe(true);
      expect(await drawerOpen(host)).toBe(false);
      await press(host, 'settings', 'click');
      await until(async () => !(await menuOpen(host)), 'the settings command closes the menu', async () => ({ open: await menuOpen(host) }));
      expect(await drawerOpen(host)).toBe(false);
    } finally {
      await host.close();
    }
  }, 240_000);

  it('B8.2: with the bar off --bar-h is 0px and an anchor jump lands the target one gap below the top; with the bar on it stays 48px', async () => {
    for (const [features, bar] of [[NO_BAR, false], [{}, true]] as const) {
      const host = await open(browser, 1200, features, { document: { ...input(DOC), initialHash: ID } });
      try {
        const want = bar ? 62 : 14; // the stylesheet's scroll margin: the bar's height (0 without it) plus one gap of 14 px
        const near = async (): Promise<boolean> => Math.abs((await targetTop(host)) - want) <= 1.5;
        const state = async (): Promise<unknown> => ({ barH: await barH(host), top: await targetTop(host) });
        await until(async () => (await barH(host)) === (bar ? '48px' : '0px'), `--bar-h settles at ${bar ? '48' : '0'}px`, state);
        await until(near, `the mount's own hash lands the target near ${String(want)}px`, state);
        expect(await barH(host)).toBe(bar ? '48px' : '0px');
        expect(await host.frame().evaluate(() => document.querySelector('[data-docreader-root] .topbar') !== null)).toBe(bar);
        // Back to the top, then a click on the in-document link to the same section: the same landing.
        await host.frame().evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await until(async () => (await targetTop(host)) > 300, 'the page is back at the top', state);
        await host.frame().click(`p a[href="#${ID}"]`);
        await until(near, `the link click lands the target near ${String(want)}px`, state);
      } finally {
        await host.close();
      }
    }
  }, 240_000);

  it('B8.3: command(contents) opens the drawer at 390 px and a second command closes it; at 1440 px, where the rail is shown, it opens nothing', async () => {
    const narrow = await open(browser, 390, NO_BAR);
    try {
      expect(await drawerOpen(narrow)).toBe(false);
      await press(narrow, 'contents', 'click');
      await until(() => drawerOpen(narrow), 'the first command opens the drawer', async () => ({ open: await drawerOpen(narrow) }));
      await press(narrow, 'contents', 'click');
      await until(async () => !(await drawerOpen(narrow)), 'the second command closes the drawer', async () => ({ open: await drawerOpen(narrow) }));
    } finally {
      await narrow.close();
    }
    const wide = await open(browser, 1440, NO_BAR);
    try {
      await leaveFrame(wide, 'contents');
      await press(wide, 'contents', 'click');
      // The command answers false here and changes nothing, but the host cannot know: it focused the iframe first, and
      // no tool of the frame moved the focus afterwards, so this is the focus call alone.
      await until(() => hasFocus(wide), 'the frame has the focus', async () => ({ frameHasFocus: await hasFocus(wide), parentActive: await parentActive(wide) }));
      expect(await parentActive(wide)).toBe('IFRAME');
      // The barrier: the settings command travels the same port after the contents one; when its menu is open the
      // contents command has been handled, and the drawer must still be shut.
      await press(wide, 'settings', 'click');
      await until(() => menuOpen(wide), 'the settings command opens the menu');
      expect(await drawerOpen(wide)).toBe(false);
    } finally {
      await wide.close();
    }
  }, 240_000);

  it('B8.4: onProgress is given shares within 0 to 1 and scrolling to the end reports 1 last', async () => {
    const host = await open(browser, 1200, NO_BAR);
    try {
      const shares = async (): Promise<number[]> => (await host.lib()).events.filter((e) => e.kind === 'onProgress').map((e) => e.value as number);
      await until(async () => (await shares()).length > 0, 'a first progress report', shares);
      expect((await shares())[0]).toBe(0);
      await host.frame().evaluate(() => {
        const s = document.scrollingElement ?? document.documentElement;
        s.scrollTo(0, s.scrollHeight);
      });
      await until(async () => (await shares()).at(-1) === 1, 'the last report is 1', shares);
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
      const host = await open(browser, 390, features);
      try {
        // Settled: the reader has written its root classes and the fonts are in; read twice until the figure holds.
        let last = Number.NaN;
        await until(async () => {
          const now = await host.frame().evaluate(() => (document.querySelector('h1') as HTMLElement).getBoundingClientRect().top);
          const same = now === last;
          last = now;
          return same;
        }, `${name}: the title holds still`, async () => ({ last }));
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
  it('B8.6 (A6): bar off at 390 px, the open menu ends inside the frame and the sticky Aa covers neither the stuck figure tools nor the stuck table head', async () => {
    const md = A6_MD;
    const numbers: Record<string, unknown> = {};
    const overflows: string[] = [];
    for (const [name, height, features] of [['top space', 844, NO_BAR], ['top space', 560, NO_BAR], ['no top space', 560, NO_BAR_NO_SPACE]] as const) {
      const host = await openLibHost(await browserFor(browser), { touch: false }, { hostBar: true });
      try {
        await host.page.setViewportSize({ width: 390, height });
        await host.mount({
          document: { ...input(md), initialHash: null, scan: { mermaid: scanRefs(md).mermaid } },
          assets,
          watchdogMs: 60_000,
          features,
          mermaidDraw: 'after-ready',
          loader: 'immediate',
          mermaidText,
        });
        await until(async () => (await host.lib()).events.some((e) => e.kind === 'ready'), 'the frame is ready');
        const frame = host.frame();
        await until(() => frame.evaluate(() => document.querySelector('[data-docreader-root]')?.getAttribute('data-docreader-diagrams') === 'drawn'), 'the figure is drawn');
        expect(await barH(host)).toBe('0px');
        // (b) the stuck figure tools: scroll into the figure until its tools stick, then find what is at the last button's centre.
        const stuckTools = await frame.evaluate(async () => {
          const fig = document.querySelector('figure.mermaid-figure') as HTMLElement;
          window.scrollTo({ top: window.scrollY + fig.getBoundingClientRect().top + 120, behavior: 'instant' });
          await new Promise((r) => setTimeout(r, 300));
          const tools = fig.querySelector('.tools') as HTMLElement;
          const buttons = Array.from(tools.querySelectorAll('button'));
          const last = buttons.at(-1) as HTMLElement;
          const r = last.getBoundingClientRect();
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const aa = (document.querySelector('.aa-btn') as HTMLElement).getBoundingClientRect();
          return { aa: [aa.left, aa.top, aa.right, aa.bottom].map(Math.round), overlapPx: Math.round(Math.max(0, Math.min(r.right, aa.right) - Math.max(r.left, aa.left))) * Math.round(Math.max(0, Math.min(r.bottom, aa.bottom) - Math.max(r.top, aa.top))), toolsTop: tools.getBoundingClientRect().top, button: last.textContent, rect: [r.left, r.top, r.right, r.bottom].map(Math.round), hit: at === null ? null : `${at.tagName.toLowerCase()}.${String(at.className)}`, coveredByAa: at?.closest('.aa-wrap') != null, buttons: buttons.length };
        });
        // The stuck table head: scroll into the table, then the last head cell's centre.
        const stuckHead = await frame.evaluate(async () => {
          const wrapper = document.querySelector('.table-wrapper') as HTMLElement;
          window.scrollTo({ top: window.scrollY + wrapper.getBoundingClientRect().top + 200, behavior: 'instant' });
          await new Promise((r) => setTimeout(r, 300));
          const ths = Array.from(wrapper.querySelectorAll('th'));
          const last = ths.at(-1) as HTMLElement;
          const r = last.getBoundingClientRect();
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const aa = (document.querySelector('.aa-btn') as HTMLElement).getBoundingClientRect();
          return { aa: [aa.left, aa.top, aa.right, aa.bottom].map(Math.round), overlapPx: Math.round(Math.max(0, Math.min(r.right, aa.right) - Math.max(r.left, aa.left))) * Math.round(Math.max(0, Math.min(r.bottom, aa.bottom) - Math.max(r.top, aa.top))), fits: wrapper.classList.contains('fits'), thTop: r.top, rect: [r.left, r.top, r.right, r.bottom].map(Math.round), hit: at === null ? null : `${at.tagName.toLowerCase()}.${String(at.className)}`, coveredByAa: at?.closest('.aa-wrap') != null };
        });
        // (a) the open menu, from the stuck position and from the top of the document: its bottom against the frame's.
        const menuNow = (): Promise<{ top: number; bottom: number; frameH: number; scrollH: number; clientH: number; aaTop: number; maxHeight: string }> =>
          frame.evaluate(() => {
            const m = document.querySelector('.aa-menu') as HTMLElement;
            const r = m.getBoundingClientRect();
            const aa = (document.querySelector('.aa-wrap') as HTMLElement).getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, frameH: window.innerHeight, scrollH: m.scrollHeight, clientH: m.clientHeight, aaTop: aa.top, maxHeight: getComputedStyle(m).maxHeight };
          });
        const menus: Record<string, Awaited<ReturnType<typeof menuNow>>> = {};
        for (const where of ['stuck', 'top'] as const) {
          if (where === 'top') await frame.evaluate(async () => {
            window.scrollTo({ top: 0, behavior: 'instant' });
            await new Promise((r) => setTimeout(r, 300));
          });
          await host.command('settings');
          await until(() => menuOpen(host), `the menu is open (${where})`);
          menus[where] = await menuNow();
          await host.command('settings');
          await until(async () => !(await menuOpen(host)), `the menu is closed (${where})`);
        }
        numbers[`${name}, frame ${String(height - 40)} px high`] = { stuckTools, stuckHead, menus, pastBottomBy: Object.fromEntries(Object.entries(menus).map(([k, m]) => [k, Math.round((m.bottom - m.frameH) * 10) / 10])) };
        expect(stuckTools.coveredByAa, `the stuck tools: ${JSON.stringify(stuckTools)}`).toBe(false);
        expect(stuckHead.coveredByAa, `the stuck head: ${JSON.stringify(stuckHead)}`).toBe(false);
        for (const [where, m] of Object.entries(menus)) if (m.bottom > m.frameH) overflows.push(`${name}, frame ${String(height - 40)} px high, ${where}: ${JSON.stringify(m)}`);
      } finally {
        console.warn(`host-measure: ${JSON.stringify({ row: 'B8.6', browser, viewportWidth: 390, numbers })}`);
        await host.close();
      }
    }
    expect(overflows, 'a menu runs past the frame\'s bottom edge').toEqual([]);
  }, 300_000);

  it('B8.7 (A6b): bar off at 390 px, points across the stuck figure tools\' last button and the sticky head\'s last cell find the control, never Aa; a bar-on root keeps its tops', async () => {
    const seen: Record<string, unknown> = {};
    for (const [name, features] of [['bar off', NO_BAR], ['bar on', {}]] as const) {
      const host = await openLibHost(await browserFor(browser), { touch: false }, { hostBar: true });
      try {
        await host.page.setViewportSize({ width: 390, height: 844 });
        await host.mount({
          document: { ...input(A6_MD), initialHash: null, scan: { mermaid: scanRefs(A6_MD).mermaid } },
          assets,
          watchdogMs: 60_000,
          features,
          mermaidDraw: 'after-ready',
          loader: 'immediate',
          mermaidText,
        });
        await until(async () => (await host.lib()).events.some((e) => e.kind === 'ready'), 'the frame is ready');
        const frame = host.frame();
        await until(() => frame.evaluate(() => document.querySelector('[data-docreader-root]')?.getAttribute('data-docreader-diagrams') === 'drawn'), 'the figure is drawn');
        /** Scroll `what` into its stuck state, then sample the last control `last` of it across its width, at its vertical centre. */
        const probe = (what: 'tools' | 'head'): Promise<{ top: number; aaBottom: number | null; samples: number; misses: string[]; barH: string; hidden: boolean }> =>
          frame.evaluate(async (w) => {
            const root = document.querySelector('[data-docreader-root]') as HTMLElement;
            const host = (w === 'tools' ? document.querySelector('figure.mermaid-figure') : document.querySelector('.table-wrapper')) as HTMLElement;
            window.scrollTo({ top: window.scrollY + host.getBoundingClientRect().top + (w === 'tools' ? 120 : 200), behavior: 'instant' });
            await new Promise((r) => setTimeout(r, 400));
            const row = (w === 'tools' ? host.querySelector('.tools') : host.querySelector('th')) as HTMLElement;
            const control = (w === 'tools' ? Array.from(host.querySelectorAll('.tools button')).at(-1) : Array.from(host.querySelectorAll('th')).at(-1)) as HTMLElement;
            const r = control.getBoundingClientRect();
            const misses: string[] = [];
            let samples = 0;
            for (let x = Math.ceil(r.left) + 1; x < r.right - 1; x += 3) {
              samples += 1;
              const at = document.elementFromPoint(x, r.top + r.height / 2);
              if (at === null || at.closest(w === 'tools' ? 'button' : 'th') !== control) misses.push(`${String(x)}: ${at === null ? 'none' : `${at.tagName.toLowerCase()}.${String(at.className)}`}`);
            }
            const aa = root.querySelector(':scope > .aa-wrap');
            return {
              top: row.getBoundingClientRect().top,
              aaBottom: aa === null ? null : aa.getBoundingClientRect().bottom,
              samples,
              misses,
              barH: getComputedStyle(root).getPropertyValue('--bar-h'),
              hidden: root.classList.contains('bar-hidden'),
            };
          }, what);
        const tools = await probe('tools');
        const head = await probe('head');
        seen[name] = { tools, head };
        if (name === 'bar off') {
          expect(tools.samples, 'the tools probe sampled').toBeGreaterThan(10);
          expect(head.samples, 'the head probe sampled').toBeGreaterThan(10);
          expect(tools.misses, `Aa takes points of the stuck tools' last button: ${JSON.stringify(tools)}`).toEqual([]);
          expect(head.misses, `Aa takes points of the sticky head's last cell: ${JSON.stringify(head)}`).toEqual([]);
          expect(tools.top, 'the tools row sticks below Aa').toBeGreaterThanOrEqual(tools.aaBottom ?? Number.POSITIVE_INFINITY);
          expect(head.top, 'the head sticks below Aa').toBeGreaterThanOrEqual(head.aaBottom ?? Number.POSITIVE_INFINITY);
        } else {
          // The bar's own tops, unchanged: the bar's height plus 6 px for the tools and its height for the head (6 px and 0 while the bar is slid away).
          expect(tools.top).toBeCloseTo(tools.hidden ? 6 : Number.parseFloat(tools.barH) + 6, 0);
          expect(head.top).toBeCloseTo(head.hidden ? 0 : Number.parseFloat(head.barH), 0);
        }
      } finally {
        console.warn(`host-measure: ${JSON.stringify({ row: 'B8.7', browser, viewportWidth: 390, seen })}`);
        await host.close();
      }
    }
  }, 300_000);

  for (const [label, features, barH, expected] of [
    ["(a) a host's own --bar-h of 64px: the head stays at 64px and the tools at 70px", NO_BAR, '64px', { aa: true, head: 64, tools: 70 }],
    ['(b) chrome.settings false, no Aa: the head stays at 0px and the tools at 6px', { chrome: { bar: false, settings: false } }, null, { aa: false, head: 0, tools: 6 }],
  ] as const) {
    it(`B8.8 ${label}`, async () => {
      const host = await openLibHost(await browserFor(browser), { touch: false }, { hostBar: true });
      try {
        await host.page.setViewportSize({ width: 390, height: 844 });
        await host.mount({
          document: { ...input(A6_MD), initialHash: null, scan: { mermaid: scanRefs(A6_MD).mermaid } },
          assets,
          watchdogMs: 60_000,
          features,
          mermaidDraw: 'after-ready',
          loader: 'immediate',
          mermaidText,
        });
        await until(async () => (await host.lib()).events.some((e) => e.kind === 'ready'), 'the frame is ready');
        const frame = host.frame();
        await until(() => frame.evaluate(() => document.querySelector('[data-docreader-root]')?.getAttribute('data-docreader-diagrams') === 'drawn'), 'the figure is drawn');
        if (barH !== null) await frame.evaluate((v) => (document.querySelector('[data-docreader-root]') as HTMLElement).style.setProperty('--bar-h', v), barH);
        const got = await frame.evaluate(async () => {
          const stuck = async (el: Element, plus: number): Promise<void> => {
            window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top + plus, behavior: 'instant' });
            await new Promise((r) => setTimeout(r, 400));
          };
          await stuck(document.querySelector('figure.mermaid-figure') as Element, 120);
          const tools = (document.querySelector('figure.mermaid-figure .tools') as HTMLElement).getBoundingClientRect().top;
          await stuck(document.querySelector('.table-wrapper') as Element, 200);
          const head = (document.querySelector('.table-wrapper th') as HTMLElement).getBoundingClientRect().top;
          return { aa: document.querySelector('[data-docreader-root] > .aa-wrap') !== null, head: Math.round(head), tools: Math.round(tools) };
        });
        console.warn(`host-measure: ${JSON.stringify({ row: 'B8.8', browser, label, got })}`);
        expect(got).toEqual(expected);
      } finally {
        await host.close();
      }
    }, 300_000);
  }

  it('B8.9 (FR2, F1): bar off with Aa at 390 px, a jump to a table row with no id lands the row clear of the sticky head', async () => {
    const host = await openLibHost(await browserFor(browser), { touch: false }, { hostBar: true });
    try {
      await host.page.setViewportSize({ width: 390, height: 844 });
      await host.mount({ document: { ...input(ROW_MD), initialHash: null }, assets, watchdogMs: 60_000, features: NO_BAR });
      await until(async () => (await host.lib()).events.some((e) => e.kind === 'ready'), 'the frame is ready');
      const frame = host.frame();
      expect(await barH(host)).toBe('0px');
      expect(await frame.evaluate(() => document.querySelector('.table-wrapper')?.classList.contains('fits') === true), 'the table fits, so its head sticks').toBe(true);
      expect(await frame.evaluate(() => document.getElementById('R14')), 'the row has no id').toBeNull();
      await frame.evaluate(() => (document.querySelector('a[href="#R14"]') as HTMLElement).click());
      // The jump may be smooth: wait until the row's top has held still for five samples.
      const rowTop = (): Promise<number> => frame.evaluate(() => (Array.from(document.querySelectorAll('tbody tr')).find((r) => r.querySelector('td')?.textContent?.trim() === 'R14') as HTMLElement).getBoundingClientRect().top);
      let last = Number.NaN;
      let still = 0;
      await until(
        async () => {
          const now = await rowTop();
          still = Math.abs(now - last) < 0.5 ? still + 1 : 0;
          last = now;
          return still >= 5;
        },
        'the jump has settled',
        rowTop,
      );
      const got = await frame.evaluate(() => {
        const row = Array.from(document.querySelectorAll('tbody tr')).find((r) => r.querySelector('td')?.textContent?.trim() === 'R14') as HTMLElement;
        const head = document.querySelector('.table-wrapper th') as HTMLElement;
        const r = row.getBoundingClientRect();
        const h = head.getBoundingClientRect();
        return { rowTop: r.top, rowBottom: r.bottom, headTop: h.top, headBottom: h.bottom, scrollY: window.scrollY };
      });
      console.warn(`host-measure: ${JSON.stringify({ row: 'B8.9', browser, got })}`);
      expect(got.scrollY, 'the page scrolled to the row').toBeGreaterThan(0);
      expect(got.headTop, 'the head is stuck below Aa').toBeGreaterThanOrEqual(49);
      expect(got.rowTop, `the row clears the head: ${JSON.stringify(got)}`).toBeGreaterThanOrEqual(got.headBottom - 1);
    } finally {
      await host.close();
    }
  }, 300_000);

  it('B8.10 (FR2, F1): bar off with Aa at 390 px, a table row with an id of its own scrolled to the top lands clear of the sticky head', async () => {
    const host = await openLibHost(await browserFor(browser), { touch: false }, { hostBar: true });
    try {
      await host.page.setViewportSize({ width: 390, height: 844 });
      await host.mount({ document: { ...input(ROW_MD), initialHash: null }, assets, watchdogMs: 60_000, features: NO_BAR });
      await until(async () => (await host.lib()).events.some((e) => e.kind === 'ready'), 'the frame is ready');
      const got = await host.frame().evaluate(async () => {
        const row = Array.from(document.querySelectorAll('tbody tr')).find((r) => r.querySelector('td')?.textContent?.trim() === 'R14') as HTMLElement;
        row.id = 'host-row';
        row.scrollIntoView({ block: 'start', behavior: 'instant' });
        await new Promise((r) => setTimeout(r, 400));
        const r = row.getBoundingClientRect();
        const h = (document.querySelector('.table-wrapper th') as HTMLElement).getBoundingClientRect();
        return { rowTop: r.top, headTop: h.top, headBottom: h.bottom, margin: getComputedStyle(row).scrollMarginTop, scrollY: window.scrollY };
      });
      console.warn(`host-measure: ${JSON.stringify({ row: 'B8.10', browser, got })}`);
      expect(got.scrollY, 'the page scrolled to the row').toBeGreaterThan(0);
      expect(got.headTop, 'the head is stuck below Aa').toBeGreaterThanOrEqual(49);
      expect(got.rowTop, `the row sits just below the head: ${JSON.stringify(got)}`).toBeLessThan(got.headBottom + 40);
      expect(got.rowTop, `the row clears the head: ${JSON.stringify(got)}`).toBeGreaterThanOrEqual(got.headBottom - 1);
    } finally {
      await host.close();
    }
  }, 300_000);
});
