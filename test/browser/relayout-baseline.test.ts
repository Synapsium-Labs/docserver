// C63: a root's first observer width is covered only when start already measured the same eligible content box.
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENTRY = [
  "import { destroyEnhancement, enhance } from './src/enhance/index.ts';",
  "import { contextOf } from './src/enhance/lifecycle.ts';",
  '(window as unknown as { __relayoutBaseline: unknown }).__relayoutBaseline = { destroyEnhancement, enhance, contextOf };',
].join('\n');

const RAIL_DOC = [
  '# Reader',
  '',
  '## In short',
  '',
  'The real contents rail makes the reader root a grid at desktop width.',
  '',
  '## Width',
  '',
  'This section keeps the rail present during the startup measurement.',
  '',
  '## Later',
  '',
  'A final section makes the contents list useful.',
  '',
].join('\n');

const HIDDEN_DOC = [
  '# Hidden',
  '',
  '## Measurements',
  '',
  '| A | B |',
  '|---|---|',
  '| one | two |',
  '',
  '```text',
  'short',
  '```',
  '',
].join('\n');

let script = '';

beforeAll(async () => {
  const result = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'relayout-baseline-entry.ts', loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
  });
  script = result.outputFiles[0]?.text ?? '';
});

afterAll(closeBrowsers);

interface Run {
  readonly reasons: string[];
  readonly loaded: boolean;
}

interface Delivery {
  readonly beforeRuns: number;
  readonly entries: readonly { readonly root: boolean; readonly width: number; readonly height: number }[];
}

interface Geometry {
  readonly display: string;
  readonly boxSizing: string;
  readonly computedWidth: number;
  readonly contentWidth: number;
  readonly rectWidth: number;
}

type ReaderContext = {
  onRelayout(fn: (reasons: ReadonlySet<string>) => void): unknown;
  events: { on(name: 'relayout', fn: (payload: { reasons: readonly string[] }) => void): unknown };
};

type ReaderWindow = Window & {
  __relayoutBaseline: {
    enhance(root: HTMLElement): Promise<void>;
    destroyEnhancement(root: HTMLElement): Promise<void>;
    contextOf(root: Element): ReaderContext | undefined;
  };
  __c63Runs: Run[];
  __c63Deliveries: Delivery[];
  __c63Change: { before: number; after: number } | null;
};

/** Wrap the native observer only to record its real deliveries; entries pass through unchanged. */
async function recordObserver(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as ReaderWindow;
    const Native = window.ResizeObserver;
    if (typeof Native !== 'function') throw new Error('C63 needs ResizeObserver');
    w.__c63Deliveries = [];
    window.ResizeObserver = class extends Native {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => {
          const root = document.querySelector('main[data-harness-root]');
          w.__c63Deliveries.push({
            beforeRuns: w.__c63Runs?.length ?? -1,
            entries: entries.map((entry) => ({ root: entry.target === root, width: entry.contentRect.width, height: entry.contentRect.height })),
          });
          callback(entries, observer);
        });
      }
    };
  });
}

/** Start the real enhancement, and attach its witnesses before the queued start frame can run. */
async function enhanceAndRecord(page: Page, changeAtStart = false): Promise<void> {
  await page.evaluate(async (change) => {
    const w = window as unknown as ReaderWindow;
    const root = document.querySelector('main[data-harness-root]') as HTMLElement;
    const facesLoaded = (): boolean =>
      ['Docreader Serif', 'Docreader Sans'].every((family) =>
        Array.from(document.fonts as unknown as Iterable<FontFace>).some((face) => face.family.replace(/["']/g, '') === family && face.status === 'loaded'),
      );
    w.__c63Runs = [];
    w.__c63Change = null;
    await w.__relayoutBaseline.enhance(root);
    const ctx = w.__relayoutBaseline.contextOf(root);
    if (ctx === undefined) throw new Error('C63 has no context');
    ctx.onRelayout((reasons) => {
      w.__c63Runs.push({ reasons: [...reasons], loaded: facesLoaded() });
    });
    if (change) {
      ctx.events.on('relayout', ({ reasons }) => {
        if (!reasons.includes('start')) return;
        const before = root.getBoundingClientRect().width;
        root.style.setProperty('width', '960.5px');
        w.__c63Change = { before, after: root.getBoundingClientRect().width };
      });
    }
  }, changeAtStart);
}

const runsOf = (page: Page): Promise<Run[]> => page.evaluate(() => (window as unknown as ReaderWindow).__c63Runs);
const deliveriesOf = (page: Page): Promise<Delivery[]> => page.evaluate(() => (window as unknown as ReaderWindow).__c63Deliveries);

function geometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const root = document.querySelector('main[data-harness-root]') as HTMLElement;
    const style = getComputedStyle(root);
    const number = (value: string): number => Number(value.slice(0, -2));
    const width = number(style.width);
    const horizontal = number(style.paddingLeft) + number(style.paddingRight) + number(style.borderLeftWidth) + number(style.borderRightWidth);
    return {
      display: style.display,
      boxSizing: style.boxSizing,
      computedWidth: width,
      contentWidth: style.boxSizing === 'border-box' ? width - horizontal : width,
      rectWidth: root.getBoundingClientRect().width,
    };
  });
}

async function holdFonts(page: Page): Promise<() => void> {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/assets/fonts/*.woff2', async (route) => {
    await gate;
    await route.fallback();
  });
  return release;
}

async function expectClean(doc: Awaited<ReturnType<typeof openDoc>>, violations: readonly string[] = []): Promise<void> {
  expect([await doc.violations(), doc.missing, doc.aborted]).toEqual([violations, [], []]);
}

describeBrowsers((browser) => {
  it('the actual 1440px grid rail covers its first real observer delivery, then fonts relayout once', async () => {
    const doc = await openDoc(RAIL_DOC, {}, { browser, viewport: { width: 1440, height: 900 }, csp: 'strict', enhance: false });
    let release: () => void = () => undefined;
    try {
      release = await holdFonts(doc.page);
      await recordObserver(doc.page);
      await doc.page.evaluate(script);
      await enhanceAndRecord(doc.page);
      await doc.page.waitForFunction(() => (window as unknown as ReaderWindow).__c63Runs.length >= 1);
      await doc.page.waitForFunction(() => (window as unknown as ReaderWindow).__c63Deliveries.length >= 1);
      await doc.page.waitForTimeout(200);
      const [first] = await deliveriesOf(doc.page);
      const root = await geometry(doc.page);
      expect(root).toMatchObject({ display: 'grid', boxSizing: 'border-box', computedWidth: 1440, contentWidth: 1360 });
      expect(Math.abs(root.rectWidth - root.computedWidth)).toBeLessThan(0.1);
      expect(first?.beforeRuns).toBe(1);
      expect(first?.entries).toEqual([{ root: true, width: root.contentWidth, height: expect.any(Number) }]);
      expect(await runsOf(doc.page)).toEqual([{ reasons: ['start'], loaded: false }]);

      release();
      await doc.page.waitForFunction(() => (window as unknown as ReaderWindow).__c63Runs.length >= 2, undefined, { timeout: 15_000 });
      await doc.page.waitForTimeout(200);
      expect(await runsOf(doc.page)).toEqual([
        { reasons: ['start'], loaded: false },
        { reasons: ['fonts'], loaded: true },
      ]);
      await expectClean(doc);
    } finally {
      release();
      await doc.close();
    }
  });

  it('does not blindly drop a changed first grid report after start', async () => {
    const doc = await openDoc(RAIL_DOC, {}, { browser, viewport: { width: 1440, height: 900 }, csp: 'strict', enhance: false });
    let release: () => void = () => undefined;
    try {
      release = await holdFonts(doc.page);
      await recordObserver(doc.page);
      await doc.page.evaluate(script);
      await enhanceAndRecord(doc.page, true);
      await doc.page.waitForFunction(() => (window as unknown as ReaderWindow).__c63Runs.length >= 2);
      await doc.page.waitForFunction(() => (window as unknown as ReaderWindow).__c63Deliveries.length >= 1);
      await doc.page.waitForTimeout(200);
      const changed = await doc.page.evaluate(() => (window as unknown as ReaderWindow).__c63Change);
      const [first] = await deliveriesOf(doc.page);
      expect(changed).not.toBeNull();
      expect(changed?.after).not.toBe(changed?.before);
      expect(first?.beforeRuns).toBe(1);
      expect(first?.entries[0]?.root).toBe(true);
      expect(first?.entries[0]?.width).toBe(await geometry(doc.page).then((root) => root.contentWidth));
      expect(await runsOf(doc.page)).toEqual([
        { reasons: ['start'], loaded: false },
        { reasons: ['resize'], loaded: false },
      ]);
      await expectClean(doc);
    } finally {
      release();
      await doc.close();
    }
  });

  it('uses actual fractional content boxes instead of transformed border rectangles', async () => {
    for (const shape of [
      { name: 'content-box', style: 'box-sizing:content-box;width:601.25px;padding:10.25px;transform:scale(1.5)' },
      { name: 'border-box', style: 'box-sizing:border-box;width:600.5px;padding:10.25px;border-left:1px solid;border-right:1px solid;transform:scale(1.5)' },
    ]) {
      const doc = await openDoc('# Shape\n\nA block root.\n', {}, { browser, viewport: { width: 1440, height: 900 }, csp: 'reader', enhance: false });
      let release: () => void = () => undefined;
      try {
        release = await holdFonts(doc.page);
        await doc.page.evaluate((inline) => {
          (document.querySelector('main[data-harness-root]') as HTMLElement).setAttribute('style', inline);
        }, shape.style);
        await recordObserver(doc.page);
        await doc.page.evaluate(script);
        await enhanceAndRecord(doc.page);
        await doc.page.waitForFunction(() => (window as unknown as ReaderWindow).__c63Runs.length >= 1);
        await doc.page.waitForFunction(() => (window as unknown as ReaderWindow).__c63Deliveries.length >= 1);
        await doc.page.waitForTimeout(200);
        const root = await geometry(doc.page);
        const [first] = await deliveriesOf(doc.page);
        expect(first?.entries, shape.name).toEqual([{ root: true, width: root.contentWidth, height: expect.any(Number) }]);
        expect(Math.abs(root.rectWidth - root.contentWidth), shape.name).toBeGreaterThan(70);
        expect(await runsOf(doc.page), shape.name).toEqual([{ reasons: ['start'], loaded: false }]);
        await expectClean(doc);
      } finally {
        release();
        await doc.close();
      }
    }
  });

  it('keeps a hidden root unknown, measures automatically once visible, and does no further work after destroy', async () => {
    const doc = await openDoc(HIDDEN_DOC, {}, { browser, viewport: { width: 1440, height: 900 }, csp: 'strict', enhance: false });
    let release: () => void = () => undefined;
    try {
      release = await holdFonts(doc.page);
      await doc.page.evaluate(() => {
        (document.querySelector('main[data-harness-root]') as HTMLElement).style.setProperty('display', 'none');
      });
      await recordObserver(doc.page);
      await doc.page.evaluate(script);
      await enhanceAndRecord(doc.page);
      await doc.page.waitForFunction(() => (window as unknown as ReaderWindow).__c63Runs.length >= 1);
      expect(
        await doc.page.evaluate(() => {
          const root = document.querySelector('main[data-harness-root]') as HTMLElement;
          return [root.getClientRects().length, (root.querySelector('.table-wrapper') as HTMLElement).style.getPropertyValue('--thead-h')];
        }),
      ).toEqual([0, '']);

      await doc.page.evaluate(() => {
        (document.querySelector('main[data-harness-root]') as HTMLElement).style.removeProperty('display');
      });
      await doc.page.waitForFunction(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const table = root.querySelector('.table-wrapper') as HTMLElement;
        return (window as unknown as ReaderWindow).__c63Runs.length >= 2 && table.style.getPropertyValue('--thead-h') !== '';
      });
      const visible = await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const table = root.querySelector('.table-wrapper') as HTMLElement;
        return [root.getClientRects().length, root.getBoundingClientRect().width, table.style.getPropertyValue('--thead-h')];
      });
      expect(visible[0]).toBe(1);
      expect(visible[1]).toBeGreaterThan(0);
      expect(visible[2]).not.toBe('');
      const beforeDestroy = await runsOf(doc.page);
      expect(beforeDestroy[0]).toEqual({ reasons: ['start'], loaded: false });
      expect(beforeDestroy.slice(1)).toEqual(expect.arrayContaining([{ reasons: ['resize'], loaded: false }]));

      await doc.page.evaluate(async () => {
        const w = window as unknown as ReaderWindow;
        await w.__relayoutBaseline.destroyEnhancement(document.querySelector('main[data-harness-root]') as HTMLElement);
      });
      await doc.page.evaluate(() => {
        (document.querySelector('main[data-harness-root]') as HTMLElement).style.setProperty('width', '520px');
      });
      release();
      await doc.page.waitForTimeout(300);
      expect(await runsOf(doc.page)).toEqual(beforeDestroy);
      await expectClean(doc);
    } finally {
      release();
      await doc.close();
    }
  });
});
