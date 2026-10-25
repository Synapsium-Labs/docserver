// The Task 18 rail is physical layout: the root keeps its own box while a wide
// viewport reserves one 308 px source-column allocation for the 272 px rail.
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName } from './harness.js';

afterAll(closeBrowsers);

const MARKDOWN = [
  '# Rail',
  '',
  'The source column is deliberately wider than the reading measure.',
  '',
  '## In short',
  '',
  'A short opening section gives the contents rail a real source heading.',
  '',
  '## First',
  '',
  'One section is enough to build the real contents rail.',
  '',
  '## Second',
  '',
  'A third level-two heading makes this a document.',
  '',
  '## Third',
  '',
  'The source column still begins at the reserved rail boundary.',
  '',
  '```text',
  'x'.repeat(120),
  '```',
  '',
  ...Array.from({ length: 80 }, (_, index) => `Long-document rail check ${String(index + 1)} keeps the sticky footer at the rail edge.`),
  '',
].join('\n');

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface WideMetrics {
  readonly root: Rect;
  readonly rail: Rect;
  readonly railInnerWidth: number;
  readonly railHeight: string;
  readonly railMarker: string;
  readonly railListPadding: string;
  readonly railListMarginTop: string;
  readonly railListMarginBottom: string;
  readonly railItemMargin: string;
  readonly foot: Rect;
  readonly source: Rect;
  readonly bar: Rect;
  readonly railWidth: string;
  readonly grid: string;
  readonly railDisplay: string;
  readonly openerDisplay: string;
  readonly barColumn: string;
  readonly progressColumn: string;
  readonly runningHeadPadding: string;
}

async function wideMetrics(browser: BrowserName, width: number): Promise<WideMetrics> {
  const doc = await openDoc(MARKDOWN, { chrome: { rail: true } }, { browser, viewport: { width, height: 900 } });
  try {
    return await doc.page.evaluate(() => {
      const root = document.querySelector('main[data-harness-root]') as HTMLElement;
      const rail = root.querySelector('.doc-toc') as HTMLElement;
      const source = root.querySelector('.codehilite') as HTMLElement;
      const bar = root.querySelector('.topbar') as HTMLElement;
      const progress = root.querySelector('.doc-progress') as HTMLElement;
      const head = root.querySelector('.running-head') as HTMLElement;
      const opener = root.querySelector('.toc-btn') as HTMLButtonElement;
      const list = rail.querySelector('ul') as HTMLUListElement;
      const item = list.querySelector('li') as HTMLLIElement;
      const foot = rail.querySelector('.toc-foot') as HTMLElement;
      const rect = (element: Element): Rect => {
        const { x, y, width: measuredWidth, height } = (element as HTMLElement).getBoundingClientRect();
        return { x, y, width: measuredWidth, height };
      };
      const rootStyle = getComputedStyle(root);
      return {
        root: rect(root),
        rail: rect(rail),
        railInnerWidth: rail.clientWidth - 34,
        railHeight: getComputedStyle(rail).height,
        railMarker: getComputedStyle(item, '::marker').content,
        railListPadding: getComputedStyle(list).paddingLeft,
        railListMarginTop: getComputedStyle(list).marginTop,
        railListMarginBottom: getComputedStyle(list).marginBottom,
        railItemMargin: getComputedStyle(item).marginBottom,
        foot: rect(foot),
        source: rect(source),
        bar: rect(bar),
        railWidth: rootStyle.getPropertyValue('--rail-w').trim(),
        grid: rootStyle.gridTemplateColumns,
        railDisplay: getComputedStyle(rail).display,
        openerDisplay: getComputedStyle(opener).display,
        barColumn: getComputedStyle(bar).gridColumn,
        progressColumn: getComputedStyle(progress).gridColumn,
        runningHeadPadding: getComputedStyle(head).paddingLeft,
      };
    });
  } finally {
    await doc.close();
  }
}

describeBrowsers((browser) => {
  it('at 1440 the real rail reserves 308 px once, while the bar spans the root', async () => {
    const got = await wideMetrics(browser, 1440);
    expect(got.railWidth).toBe('308px');
    expect(got.railDisplay).toBe('flex');
    expect(Math.abs(got.root.width - 1440)).toBeLessThan(0.1);
    expect(Math.abs(got.rail.x - 40)).toBeLessThan(0.1);
    expect(Math.abs(got.rail.width - 306)).toBeLessThan(0.1);
    expect(Math.abs(got.railInnerWidth - 272)).toBeLessThan(0.1);
    expect(got.railHeight).toBe('838px');
    expect(Math.abs(got.foot.y + got.foot.height - (got.rail.y + got.rail.height))).toBeLessThan(0.1);
    expect(got.railMarker).toBe('normal');
    expect(got.railListPadding).toBe('0px');
    expect(got.railListMarginTop).toBe('0px');
    expect(got.railListMarginBottom).toBe('0px');
    expect(got.railItemMargin).toBe('0px');
    expect(got.openerDisplay).toBe('none');
    expect(Math.abs(got.source.x - 348)).toBeLessThan(0.1);
    expect(Math.abs(got.source.width - 1052)).toBeLessThan(0.1);
    expect(Math.abs(got.bar.x - got.root.x)).toBeLessThan(0.1);
    expect(Math.abs(got.bar.width - got.root.width)).toBeLessThan(0.1);
    expect(got.grid).toBe('308px 1052px');
    expect(got.barColumn).toBe('1 / -1');
    expect(got.progressColumn).toBe('1 / -1');
    expect(got.runningHeadPadding).toBe('192px');
  });

  it('turns the real rail and its code fit on exactly at 1240 px', async () => {
    const narrow = await wideMetrics(browser, 1239);
    const wide = await wideMetrics(browser, 1240);
    expect(narrow.railWidth).toBe('');
    expect(narrow.railDisplay).toBe('none');
    expect(Math.abs(narrow.source.width - 1120)).toBeLessThan(0.1);
    expect(wide.railWidth).toBe('308px');
    expect(wide.railDisplay).toBe('flex');
    expect(Math.abs(wide.source.x - 348)).toBeLessThan(0.1);
    expect(Math.abs(wide.source.width - 852)).toBeLessThan(0.1);
  });

  it('keeps the full-width topbar in the first grid row before and after scrolling at both desktop widths', async () => {
    for (const width of [1240, 1440]) {
      const doc = await openDoc(MARKDOWN, { chrome: { rail: true } }, { browser, viewport: { width, height: 900 } });
      try {
        for (const scrollY of [0, 150]) {
          await doc.page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), scrollY);
          const got = await doc.page.evaluate(() => {
            const root = document.querySelector('main[data-harness-root]') as HTMLElement;
            const bar = root.querySelector('.topbar') as HTMLElement;
            const heading = root.querySelector('h1') as HTMLElement;
            const source = root.querySelector('.codehilite') as HTMLElement;
            const progress = root.querySelector('.doc-progress') as HTMLElement;
            const rect = (element: HTMLElement): Rect => {
              const { x, y, width, height } = element.getBoundingClientRect();
              return { x, y, width, height };
            };
            return { bar: rect(bar), heading: rect(heading), source: rect(source), progress: rect(progress) };
          });
          expect(Math.abs(got.bar.y)).toBeLessThan(0.1);
          expect(Math.abs(got.bar.x)).toBeLessThan(0.1);
          expect(Math.abs(got.bar.width - width)).toBeLessThan(0.1);
          expect(Math.abs(got.progress.y)).toBeLessThan(0.1);
          expect(Math.abs(got.source.x - 348)).toBeLessThan(0.1);
          expect(Math.abs(got.source.width - (width - 388))).toBeLessThan(0.1);
          if (scrollY === 0) expect(Math.abs(got.heading.y - got.bar.height)).toBeLessThan(0.1);
        }
      } finally {
        await doc.close();
      }
    }
  });

  it('prints without a reserved rail column or an open mobile drawer', async () => {
    const wide = await openDoc(MARKDOWN, { chrome: { rail: true } }, { browser, viewport: { width: 1440, height: 900 } });
    try {
      await wide.page.emulateMedia({ media: 'print' });
      const heading = await wide.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const title = root.querySelector('h1') as HTMLElement;
        const { x, width } = title.getBoundingClientRect();
        return { x, width, rootDisplay: getComputedStyle(root).display };
      });
      expect(heading.rootDisplay).not.toBe('grid');
      expect(Math.abs(heading.x)).toBeLessThan(0.1);
      expect(Math.abs(heading.width - 1440)).toBeLessThan(0.1);
    } finally {
      await wide.close();
    }

    const phone = await openDoc(MARKDOWN, { chrome: { rail: true } }, { browser, viewport: { width: 390, height: 900 } });
    try {
      await phone.page.click('main[data-harness-root] .toc-btn');
      await phone.page.emulateMedia({ media: 'print' });
      const overlay = await phone.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const rail = root.querySelector('.doc-toc') as HTMLElement;
        const scrim = root.querySelector('.toc-scrim') as HTMLElement;
        return { rail: getComputedStyle(rail).display, scrim: getComputedStyle(scrim).display };
      });
      expect(overlay).toEqual({ rail: 'none', scrim: 'none' });
    } finally {
      await phone.close();
    }
  });

  it('at 390 the closed rail is a button, then opens a root-local drawer and scrim', async () => {
    const doc = await openDoc(MARKDOWN, { chrome: { rail: true } }, { browser, viewport: { width: 390, height: 900 } });
    try {
      const before = await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const rail = root.querySelector('.doc-toc') as HTMLElement;
        const button = root.querySelector('.toc-btn') as HTMLButtonElement;
        return { display: getComputedStyle(rail).display, button: getComputedStyle(button).display, open: root.classList.contains('toc-open') };
      });
      expect(before).toEqual({ display: 'none', button: 'flex', open: false });
      await doc.page.click('main[data-harness-root] .toc-btn');
      const after = await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const rail = root.querySelector('.doc-toc') as HTMLElement;
        const scrim = root.querySelector('.toc-scrim') as HTMLElement;
        const rect = (element: Element): Rect => {
          const { x, y, width, height } = (element as HTMLElement).getBoundingClientRect();
          return { x, y, width, height };
        };
        return {
          rail: rect(rail),
          railInnerWidth: rail.clientWidth - 34,
          scrim: rect(scrim),
          railPosition: getComputedStyle(rail).position,
          scrimPosition: getComputedStyle(scrim).position,
          open: root.classList.contains('toc-open'),
          scrimParent: scrim.parentElement === root,
        };
      });
      expect(after.open).toBe(true);
      expect(after.scrimParent).toBe(true);
      expect(after.railPosition).toBe('fixed');
      expect(after.scrimPosition).toBe('fixed');
      expect(Math.abs(after.rail.width - 374)).toBeLessThan(0.1);
      expect(Math.abs(after.railInnerWidth - 340)).toBeLessThan(0.1);
      expect(Math.abs(after.rail.x)).toBeLessThan(0.1);
      expect(Math.abs(after.scrim.width - 390)).toBeLessThan(0.1);
      expect(Math.abs(after.scrim.height - 900)).toBeLessThan(0.1);
    } finally {
      await doc.close();
    }
  });
});
