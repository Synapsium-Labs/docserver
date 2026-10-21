// Scrolling in a real browser (docserver L2, Task 12): the bar's place in the root (sticky at the window's top, as
// wide as the root, the reading column where it would be under a page-level bar), the progress line at three
// positions, the running head and `scrolled`, the phone bar at 390 px (hides scrolling down past 300 px, returns
// scrolling up, stays while a dialog is open or the bar is held), the bar above the text scrolling under it, two roots'
// progress lines, the measured --bar-h, the 'spy' events, and RF3's bound on rect reads per frame on the large plan,
// counted in the page. What jsdom cannot show: layout, stickiness,
// real scrolling and frames.
//
// The public entry and the lifecycle's test hook (contextOf) are bundled here on their own and evaluated in the page
// after it loaded, as the services' browser case does; the page's own script is not used to enhance.
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { largePlan } from '../fixtures/large-plan.js';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName, type OpenedDoc } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const PARA = 'A paragraph of plain text that fills the reading column, so the page is long enough to scroll through. '.repeat(6);

/** A document long enough to scroll: a title, then five numbered sections of six paragraphs each. */
const DOC = [
  '# Scrolling example',
  '',
  '**Spec** · 2026-10-20 · Status: Draft',
  '',
  ...[1, 2, 3, 4, 5].flatMap((n) => [`## ${String(n)}. Section ${String(n)}`, '', ...Array.from({ length: 6 }, () => [PARA, '']).flat()]),
].join('\n');

const ENTRY = [
  "import { enhance } from './src/enhance/index.ts';",
  "import { contextOf } from './src/enhance/lifecycle.ts';",
  "import { chrome } from './src/enhance/journal.ts';",
  '(window as unknown as { __scroll: unknown }).__scroll = { enhance, contextOf, chrome };',
].join('\n');

let script = '';

beforeAll(async () => {
  const r = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'scroll-entry.ts', loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
  });
  script = r.outputFiles[0]?.text ?? '';
});

afterAll(closeBrowsers);

interface Ctx {
  readonly root: HTMLElement;
  readonly sections: readonly { heading: HTMLElement }[];
  readonly plan: { readonly outlineable: boolean; readonly tasks: readonly HTMLElement[] };
  readonly slots: { readonly bar: HTMLElement; readonly running: HTMLElement; readonly progress: HTMLElement } | null;
  readonly events: { on(name: string, fn: (p: { section: HTMLElement | null; unit: HTMLElement | null }) => void): unknown };
  readonly overlays: { register(kind: string, h: { isOpen(): boolean; close(): void }): unknown };
  readonly position: { holdBar(): void };
  relayout(reason: string): void;
}

type Win = {
  __scroll: {
    enhance(root: HTMLElement, options?: unknown): Promise<void>;
    contextOf(root: Element): Ctx | undefined;
    chrome(doc: Document, tag: string, init?: { className?: string; text?: string }): HTMLElement;
  };
  __ctx: Ctx;
  __spy: (string | null)[];
};

/** Open `md` in `browser`, enhance it with this file's bundle and `options`, and keep its context on the window. */
async function open(md: string, browser: BrowserName, viewport: { width: number; height: number }, options: unknown = {}): Promise<OpenedDoc> {
  const doc = await openDoc(md, {}, { browser, viewport, csp: 'strict', enhance: false });
  await doc.page.evaluate(script);
  await doc.page.evaluate(async (opts) => {
    const w = window as unknown as Win;
    const root = document.querySelector('main[data-harness-root]') as HTMLElement;
    await w.__scroll.enhance(root, opts);
    await document.fonts.ready;
    const ctx = w.__scroll.contextOf(root);
    if (ctx === undefined) throw new Error('not enhanced');
    w.__ctx = ctx;
    w.__spy = [];
    ctx.events.on('spy', (p) => w.__spy.push(p.section?.id ?? null));
  }, options);
  await frames(doc.page);
  return doc;
}

/** Let two frames run (and a little time, for the scroll event before them). */
async function frames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => {
        setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => r())), 20);
      }),
  );
}

/** Scroll the window to `y` at once, then let the spy's frame run. */
async function scrollTo(page: Page, y: number): Promise<void> {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  await frames(page);
}

/** Boxes, read in the page: the root's, the bar's, its row's, the progress line's, the title's. */
async function boxes(page: Page): Promise<Record<'root' | 'bar' | 'row' | 'progress' | 'title', { top: number; bottom: number; left: number; width: number; height: number }>> {
  return page.evaluate(() => {
    const root = document.querySelector('main[data-harness-root]') as HTMLElement;
    const box = (el: Element | null) => {
      const r = (el as Element).getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, width: r.width, height: r.height };
    };
    return {
      root: box(root),
      bar: box(root.querySelector('.topbar')),
      row: box(root.querySelector('.topbar-inner')),
      progress: box(root.querySelector('.doc-progress')),
      title: box(root.querySelector('h1')),
    };
  });
}

/** The top of the root's first child past the skip link, the bar and the progress line: the document's first block. */
const firstBlock = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const root = document.querySelector('main[data-harness-root]') as HTMLElement;
    const first = Array.from(root.children).find((c) => !['skip-link', 'topbar', 'doc-progress'].some((k) => c.classList.contains(k)));
    return (first as Element).getBoundingClientRect().top;
  });

/**
 * The sticky tops of a fitted table's head and of a figure's tools, the parts that clear the bar: made here as the
 * table and figure features will make them (a table wrapper with `fits`, a Mermaid figure with its `.tools`).
 */
const stickyTops = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const root = document.querySelector('main[data-harness-root]') as HTMLElement;
    let th = root.querySelector('.probe-fits th');
    let tools = root.querySelector('.probe-figure .tools');
    if (th === null || tools === null) {
      const wrap = document.createElement('div');
      wrap.className = 'table-wrapper fits probe-fits';
      const table = document.createElement('table');
      th = table.createTHead().insertRow().appendChild(document.createElement('th'));
      wrap.append(table);
      const figure = document.createElement('figure');
      figure.className = 'mermaid-figure probe-figure';
      tools = figure.appendChild(document.createElement('div'));
      tools.className = 'tools';
      root.append(wrap, figure);
    }
    return [getComputedStyle(th).top, getComputedStyle(tools).top];
  });

const classes = (page: Page): Promise<string[]> =>
  page.evaluate(() => Array.from((document.querySelector('main[data-harness-root]') as HTMLElement).classList).filter((c) => c === 'scrolled' || c === 'bar-hidden'));

describeBrowsers((browser) => {
  it('the bar is the root\'s sticky top, as wide as the root; the column starts 49 px lower than without it, desktop and phone', async () => {
    for (const [viewport, pad] of [
      [{ width: 1440, height: 1000 }, 52],
      [{ width: 390, height: 844 }, 28],
    ] as const) {
      const without = await open(DOC, browser, viewport, { chrome: { bar: false } });
      let bare: number;
      try {
        bare = await firstBlock(without.page);
      } finally {
        await without.close();
      }
      const doc = await open(DOC, browser, viewport);
      try {
        const b = await boxes(doc.page);
        expect([b.bar.top, b.bar.left, b.bar.width]).toEqual([b.root.top, b.root.left, b.root.width]);
        expect([b.row.top, b.row.height, b.row.width]).toEqual([0, 48, b.root.width]);
        expect(bare).toBe(pad); // the root's own top padding
        expect(await firstBlock(doc.page)).toBe(bare + 49); // the row and the line under it, then that padding
        expect(b.progress.width).toBe(0);
        // Below a host's own header of 100 px, at the top of the page: the bar sits at the root's top edge, not above it.
        await doc.page.evaluate(() => {
          const header = document.createElement('div');
          header.style.height = '100px'; // the CSSOM, which the strict policy allows
          document.body.prepend(header);
        });
        await frames(doc.page);
        const h = await boxes(doc.page);
        expect([h.root.top, h.bar.top, h.row.top]).toEqual([100, 100, 100]);
        await scrollTo(doc.page, 1500);
        await scrollTo(doc.page, 1400); // up: on a phone, scrolling down hid the bar
        await doc.page.waitForTimeout(350); // its slide
        const s = await boxes(doc.page);
        expect([s.root.top < -1000, s.bar.top, s.row.top]).toEqual([true, 0, 0]); // stuck at the window's top
        // The padding below the row lets the pointer through: the text under it takes the click; the row takes it.
        const hit = (y: number): Promise<string> =>
          doc.page.evaluate((at) => {
            const el = document.elementFromPoint(200, at);
            return el === null ? 'none' : el.closest('.topbar') === null ? el.localName : 'bar';
          }, y);
        expect(await hit(70)).not.toBe('bar');
        expect(await hit(24)).toBe('bar');
      } finally {
        await doc.close();
      }
    }
  });

  it('the bar is above the text that scrolls under it: its row takes the pointer over a section heading', async () => {
    const doc = await open(DOC, browser, { width: 1440, height: 1000 });
    try {
      const top = await doc.page.evaluate(() => (document.querySelectorAll('h2')[1] as Element).getBoundingClientRect().top);
      await scrollTo(doc.page, top - 10); // the second section's heading 10 px down: under the row
      const hit = await doc.page.evaluate(() => {
        const h = document.querySelectorAll('h2')[1] as Element;
        const r = h.getBoundingClientRect();
        const x = r.left + Math.min(40, r.width / 2); // inside the reading column, on the heading
        const el = document.elementFromPoint(x, 24);
        return { under: r.top < 24 && r.bottom > 24, at: el === null ? 'none' : el.closest('.topbar') === null ? el.localName : 'bar' };
      });
      expect(hit).toEqual({ under: true, at: 'bar' });
    } finally {
      await doc.close();
    }
  });

  it('two roots in one page: a root wholly scrolled past draws no line over the line of the root being read', async () => {
    const doc = await openDoc(DOC, {}, { browser, viewport: { width: 1440, height: 1000 }, csp: 'strict', enhance: false });
    try {
      await doc.page.evaluate(script);
      const out = await doc.page.evaluate(async () => {
        const w = window as unknown as Win;
        const a = document.querySelector('main[data-harness-root]') as HTMLElement;
        const b = a.cloneNode(true) as HTMLElement;
        b.removeAttribute('data-harness-root');
        a.after(b);
        await w.__scroll.enhance(a, {});
        await w.__scroll.enhance(b, {});
        await document.fonts.ready;
        const settle = (): Promise<void> =>
          new Promise<void>((r) => {
            setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => r())), 20);
          });
        await settle();
        const box = b.getBoundingClientRect();
        window.scrollTo({ top: box.top + window.scrollY + box.height / 4, behavior: 'instant' });
        await settle();
        const width = (root: Element): number => (root.querySelector('.doc-progress') as Element).getBoundingClientRect().width;
        return { aGone: a.getBoundingClientRect().bottom <= 0, a: width(a), b: width(b), full: document.documentElement.clientWidth };
      });
      expect(out.aGone).toBe(true);
      expect(out.a).toBe(0);
      expect(out.b).toBeGreaterThan(out.full / 10);
      expect(out.b).toBeLessThan(out.full / 2);
    } finally {
      await doc.close();
    }
  });

  it('the progress line: 0 at the top, the share scrolled in the middle, the window\'s width at the end', async () => {
    const doc = await open(DOC, browser, { width: 1440, height: 1000 });
    try {
      const { root } = await boxes(doc.page);
      const room = root.height - 1000;
      expect(room).toBeGreaterThan(3000);
      // The line is fixed: its 100% is the window's width less any scroll bar.
      const full = await doc.page.evaluate(() => document.documentElement.clientWidth);
      expect((await boxes(doc.page)).progress.width).toBe(0);
      await scrollTo(doc.page, 1234);
      expect((await boxes(doc.page)).progress.width).toBeCloseTo((full * 1234) / room, 1);
      await scrollTo(doc.page, root.height);
      // The end: a browser may stop a fraction of a pixel short of the root's fractional height (WebKit does).
      expect((await boxes(doc.page)).progress.width).toBeCloseTo(full, 0);
      await scrollTo(doc.page, 0);
      expect((await boxes(doc.page)).progress.width).toBe(0);
    } finally {
      await doc.close();
    }
  });

  it('scrolled past the title: the root class, the running head with "§ n" and the section, and one spy event per section', async () => {
    const doc = await open(DOC, browser, { width: 1440, height: 1000 });
    try {
      const head = (): Promise<{ text: string; b: string | null; opacity: string }> =>
        doc.page.evaluate(() => {
          const r = document.querySelector('.running-head') as HTMLElement;
          return { text: r.textContent ?? '', b: r.querySelector('b')?.textContent ?? null, opacity: getComputedStyle(r).opacity };
        });
      const line = (): Promise<string> => doc.page.evaluate(() => getComputedStyle(document.querySelector('.topbar-inner') as Element).boxShadow);
      expect(await classes(doc.page)).toEqual([]);
      expect(await head()).toEqual({ text: 'Scrolling example', b: null, opacity: '0' });
      expect(await line()).toBe('rgb(252, 251, 248) 0px 1px 0px 0px'); // the bar's own colour
      const tops = await doc.page.evaluate(() => Array.from(document.querySelectorAll('h2')).map((h) => h.getBoundingClientRect().top));
      const second = tops[1] as number;
      await scrollTo(doc.page, second - 200); // the second section's heading 200 px down: above the 300 px line
      await doc.page.waitForTimeout(400); // the running head's fade
      expect(await classes(doc.page)).toEqual(['scrolled']);
      expect(await head()).toEqual({ text: '§ 2Section 2', b: '§ 2', opacity: '1' });
      expect(await line()).toBe('rgb(225, 221, 211) 0px 1px 0px 0px'); // the border colour
      await scrollTo(doc.page, (tops[4] as number) - 100);
      const log = await doc.page.evaluate(() => (window as unknown as Win).__spy);
      expect(log).toContain('2-section-2');
      expect(log.at(-1)).toBe('5-section-5');
      expect(new Set(log).size).toBe(log.length); // once per change
      await scrollTo(doc.page, 0);
      expect(await classes(doc.page)).toEqual([]);
      expect((await head()).text).toBe('Scrolling example');
    } finally {
      await doc.close();
    }
  });

  it('at 390 px the bar hides scrolling down past 300 px and returns scrolling up; it stays while a dialog is open or the bar is held', async () => {
    const doc = await open(DOC, browser, { width: 390, height: 844 });
    try {
      const shown = async (): Promise<boolean> => {
        await doc.page.waitForTimeout(350); // the slide
        const b = await boxes(doc.page);
        return b.row.bottom > 0;
      };
      await scrollTo(doc.page, 200);
      await scrollTo(doc.page, 290);
      expect([await classes(doc.page), await shown()]).toEqual([['scrolled'], true]);
      await scrollTo(doc.page, 900);
      expect([await classes(doc.page), await shown()]).toEqual([['scrolled', 'bar-hidden'], false]);
      const row = (await boxes(doc.page)).row;
      expect([row.top, row.bottom]).toEqual([-49, -1]); // the row and its line, out of view
      expect(await stickyTops(doc.page)).toEqual(['0px', '6px']); // a fitted table's head and a figure's tools move up
      await scrollTo(doc.page, 800);
      expect([await classes(doc.page), await shown()]).toEqual([['scrolled'], true]);
      expect(await stickyTops(doc.page)).toEqual(['48px', '54px']);
      // A dialog open (the quick jump, Task 16): scrolling down leaves the bar as it is.
      await doc.page.keyboard.press('/');
      await doc.page.waitForSelector('main[data-harness-root] .jump.open');
      await scrollTo(doc.page, 1500);
      expect(await shown()).toBe(true);
      await doc.page.keyboard.press('Escape');
      await doc.page.waitForFunction(() => document.querySelector('main[data-harness-root] .jump.open') === null);
      await scrollTo(doc.page, 2000);
      expect(await shown()).toBe(false);
      await scrollTo(doc.page, 1900);
      expect(await shown()).toBe(true);
      // Held (a jump just moved the page): it shows, and stays.
      await doc.page.evaluate(() => {
        (window as unknown as Win).__ctx.position.holdBar();
      });
      await scrollTo(doc.page, 2600);
      expect([await classes(doc.page), await shown()]).toEqual([['scrolled'], true]);
    } finally {
      await doc.close();
    }
  });

  it('--bar-h is measured: a bar made taller sets it on the root, and back', async () => {
    const doc = await open(DOC, browser, { width: 1440, height: 1000 });
    try {
      const barH = (): Promise<[string, string]> =>
        doc.page.evaluate(() => {
          const root = document.querySelector('main[data-harness-root]') as HTMLElement;
          return [root.style.getPropertyValue('--bar-h'), getComputedStyle(root).getPropertyValue('--bar-h').trim()];
        });
      expect(await barH()).toEqual(['', '48px']);
      await doc.page.evaluate(() => {
        const w = window as unknown as Win;
        // A banner one line tall: the root's 18 px at a line height of 1.62, 29.16 px.
        const extra = w.__scroll.chrome(document, 'div', { className: 'probe-banner', text: 'A banner' });
        extra.setAttribute('data-probe', '');
        w.__ctx.slots?.bar.append(extra);
        w.__ctx.relayout('content');
      });
      await frames(doc.page);
      expect(await barH()).toEqual(['77px', '77px']);
      await doc.page.evaluate(() => {
        const w = window as unknown as Win;
        w.__ctx.slots?.bar.querySelector('[data-probe]')?.remove();
        w.__ctx.relayout('content');
      });
      await frames(doc.page);
      expect((await barH())[1]).toBe('48px');
    } finally {
      await doc.close();
    }
  });

  it('print leaves the bar out', async () => {
    const doc = await open(DOC, browser, { width: 1440, height: 1000 });
    try {
      const display = (): Promise<string> => doc.page.evaluate(() => getComputedStyle(document.querySelector('.topbar') as Element).display);
      expect(await display()).toBe('block');
      await doc.page.emulateMedia({ media: 'print' });
      expect(await display()).toBe('none');
    } finally {
      await doc.close();
    }
  });

  it('RF3: on the large plan, the rect reads of a frame stay at or below 2⌈log₂ n⌉ + 4, counted in the page', async () => {
    const plan = largePlan();
    const doc = await open(plan.markdown, browser, { width: 1440, height: 1000 });
    try {
      const n = await doc.page.evaluate(() => {
        const { sections, plan: p } = (window as unknown as Win).__ctx;
        return sections.length + (p.outlineable ? p.tasks.filter((h) => h.localName === 'h3' && h.id !== '').length : 0);
      });
      expect(n).toBeGreaterThanOrEqual(plan.counts.sections);
      const height = (await boxes(doc.page)).root.height;
      await doc.page.evaluate(() => {
        const w = window as unknown as { __reads: number[]; __stop: boolean };
        const read = Element.prototype.getBoundingClientRect;
        const readAll = Element.prototype.getClientRects;
        let count = 0;
        Element.prototype.getBoundingClientRect = function (this: Element): DOMRect {
          count += 1;
          return read.call(this);
        };
        Element.prototype.getClientRects = function (this: Element): DOMRectList {
          count += 1;
          return readAll.call(this);
        };
        w.__reads = [];
        w.__stop = false;
        let last = 0;
        const tick = (): void => {
          w.__reads.push(count - last);
          last = count;
          if (!w.__stop) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      for (let k = 1; k <= 12; k += 1) await scrollTo(doc.page, Math.round((height * k) / 13));
      const reads = await doc.page.evaluate(() => {
        const w = window as unknown as { __reads: number[]; __stop: boolean };
        w.__stop = true;
        return w.__reads;
      });
      const spied = await doc.page.evaluate(() => (window as unknown as Win).__spy.length);
      expect(spied).toBeGreaterThan(5); // the spy ran, and found sections all the way down
      const worst = Math.max(...reads);
      expect(worst).toBeGreaterThan(0);
      expect(worst).toBeLessThanOrEqual(2 * Math.ceil(Math.log2(n)) + 4);
    } finally {
      await doc.close();
    }
  });
});
