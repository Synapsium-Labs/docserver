// The shared services in a real browser (docserver L2, Task 7b): relayout measures again once the reader's faces load
// (LD5; relayout.ts). The font files are held back by a route of the page's own until the case lets them go, so the
// startup's own relayout ('start') runs on the fallback faces, and a second one ('fonts') runs once both faces have
// loaded, and no more. When the reader's stylesheet arrives after enhance(), its real content width changes before the
// held faces release: the fallback resize precedes the one loaded-font run. Whether a face loaded is read from the font set's own faces (their
// status), never from check(), which answers true for a family nothing declares. And the skip link skips the bar: the
// next Tab after it goes into the text. What jsdom cannot show: the browser's own font loading, its frames and its
// focus order.
//
// The public entry and the lifecycle's test hook (contextOf) are bundled here on their own and evaluated in the page
// after it loaded, as the seams' browser case does; the page's own script is not used to enhance.
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const DOC = ['# Example', '', '## 1. One', '', 'Text of the first section.', '', '## 2. Two', '', 'More.', '', '## 3. Three', '', 'End.', ''].join('\n');

const ENTRY = [
  "import { enhance } from './src/enhance/index.ts';",
  "import { contextOf } from './src/enhance/lifecycle.ts';",
  '(window as unknown as { __services: unknown }).__services = { enhance, contextOf };',
].join('\n');

let script = '';

beforeAll(async () => {
  const r = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'services-entry.ts', loader: 'ts' },
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

interface Run {
  readonly reasons: string[];
  readonly loaded: boolean;
}

type Win = {
  __services: {
    enhance(root: HTMLElement): Promise<void>;
    contextOf(root: Element): { onRelayout(fn: (reasons: ReadonlySet<string>) => void): unknown; slots: { tool(kind: string, node: HTMLElement): void } | null } | undefined;
  };
  __runs: Run[];
  __contentWidths: number[];
};

/** In the page: enhance the root, then record each relayout with whether both reader faces had loaded by then. */
async function enhanceAndRecord(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const w = window as unknown as Win;
    const root = document.querySelector('main[data-harness-root]') as HTMLElement;
    w.__runs = [];
    await w.__services.enhance(root);
    // A face is loaded when the font set holds it with the status 'loaded' (check() answers true for a family that
    // nothing declares, so it cannot tell).
    const faces = (): boolean =>
      ['Docreader Serif', 'Docreader Sans'].every((family) =>
        Array.from(document.fonts as unknown as Iterable<FontFace>).some((f) => f.family.replace(/["']/g, '') === family && f.status === 'loaded'),
      );
    w.__services.contextOf(root)?.onRelayout((reasons) => {
      w.__runs.push({ reasons: [...reasons], loaded: faces() });
    });
  });
}

const runsOf = (page: Page): Promise<Run[]> => page.evaluate(() => (window as unknown as Win).__runs);

describeBrowsers((browser) => {
  it('relayout runs once the fonts load: the start on the fallback faces, then one for the fonts, and no more', async () => {
    const doc = await openDoc(DOC, {}, { browser, csp: 'strict', enhance: false });
    try {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      const held: string[] = [];
      // A route of the page's own runs before the context's, which serves the files once this one falls back to it.
      await doc.page.route('**/assets/fonts/*.woff2', async (route) => {
        held.push(new URL(route.request().url()).pathname);
        await gate;
        await route.fallback();
      });
      await doc.page.evaluate(script);
      await enhanceAndRecord(doc.page);
      await doc.page.waitForFunction(() => (window as unknown as Win).__runs.length >= 1);
      await doc.page.waitForTimeout(300);
      expect(await runsOf(doc.page)).toEqual([{ reasons: ['start'], loaded: false }]);
      expect(held.length).toBeGreaterThan(0); // the faces were asked for, and are held
      release();
      await doc.page.waitForFunction(() => (window as unknown as Win).__runs.length >= 2, undefined, { timeout: 15_000 });
      await doc.page.waitForTimeout(300);
      expect(await runsOf(doc.page)).toEqual([
        { reasons: ['start'], loaded: false },
        { reasons: ['fonts'], loaded: true },
      ]);
    } finally {
      await doc.close();
    }
  });

  it('a stylesheet that arrives after enhance() resizes on fallback, then runs fonts once they load', async () => {
    const doc = await openDoc(DOC, { chrome: { rail: true } }, { browser, csp: 'strict', enhance: false });
    let release: () => void = () => undefined;
    try {
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await doc.page.route('**/assets/fonts/*.woff2', async (route) => {
        await gate;
        await route.fallback();
      });
      await doc.page.evaluate(script);
      // The reader's stylesheet leaves the page before enhance(), so no @font-face declares the faces yet.
      await doc.page.evaluate(() => {
        const link = document.querySelector('link[href="/assets/reader.css"]') as HTMLLinkElement;
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const w = window as unknown as Win & { __sheet: HTMLLinkElement };
        w.__sheet = link;
        w.__contentWidths = [];
        link.remove();
        const Native = window.ResizeObserver;
        window.ResizeObserver = class extends Native {
          constructor(callback: ResizeObserverCallback) {
            super((entries, observer) => {
              w.__contentWidths.push(...entries.filter((entry) => entry.target === root).map((entry) => entry.contentRect.width));
              callback(entries, observer);
            });
          }
        };
      });
      await enhanceAndRecord(doc.page);
      await doc.page.waitForFunction(() => (window as unknown as Win).__runs.length >= 1);
      await doc.page.waitForTimeout(300);
      expect(await runsOf(doc.page)).toEqual([{ reasons: ['start'], loaded: false }]);
      await doc.page.evaluate(() => {
        document.head.append((window as unknown as Win & { __sheet: HTMLLinkElement }).__sheet);
      });
      await doc.page.waitForFunction(() => (window as unknown as Win).__contentWidths.includes(1052));
      await doc.page.waitForFunction(() => (window as unknown as Win).__runs.length >= 2);
      const width = await doc.page.evaluate(() => (window as unknown as Win).__contentWidths);
      expect(width[0]).toBe(1440);
      expect(width).toContain(1052);
      expect(width.slice(1).every((receipt) => receipt === 1052)).toBe(true);
      expect(await runsOf(doc.page)).toEqual([
        { reasons: ['start'], loaded: false },
        { reasons: ['resize'], loaded: false },
      ]);
      release();
      await doc.page.waitForFunction(() => (window as unknown as Win).__runs.length >= 3, undefined, { timeout: 15_000 });
      await doc.page.waitForTimeout(300);
      expect(await runsOf(doc.page)).toEqual([
        { reasons: ['start'], loaded: false },
        { reasons: ['resize'], loaded: false },
        { reasons: ['fonts'], loaded: true },
      ]);
    } finally {
      release();
      await doc.close();
    }
  });

  it('the skip link skips the bar: the next Tab after it goes into the text, past every tool', async () => {
    const doc = await openDoc(DOC, {}, { browser, csp: 'strict', enhance: false });
    try {
      await doc.page.evaluate(script);
      await doc.page.evaluate(async () => {
        const w = window as unknown as Win;
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        await w.__services.enhance(root);
        const tool = document.createElement('button');
        tool.className = 'jump-btn';
        tool.textContent = 'Jump';
        tool.setAttribute('data-docreader-chrome', '');
        w.__services.contextOf(root)?.slots?.tool('jump', tool);
      });
      const where = (): Promise<{ cls: string; inBar: boolean; afterTitle: boolean }> =>
        doc.page.evaluate(() => {
          const a = document.activeElement as Element;
          const h1 = document.querySelector('main[data-harness-root] > h1') as Element;
          return {
            cls: `${a.localName}.${a.className}`,
            inBar: a.closest('.topbar') !== null || a.classList.contains('skip-link'),
            afterTitle: a === h1 || (h1.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
          };
        });
      await doc.page.keyboard.press('Tab');
      expect((await where()).cls).toBe('a.skip-link');
      await doc.page.keyboard.press('Enter');
      expect(await where()).toEqual({ cls: expect.stringMatching(/^h1\./) as unknown, inBar: false, afterTitle: true });
      await doc.page.keyboard.press('Tab');
      const next = await where();
      expect([next.inBar, next.afterTitle]).toEqual([false, true]);
    } finally {
      await doc.close();
    }
  });
});
