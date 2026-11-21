// The reader's half of the host's Back, in a real browser (docserver parity T3): a jump the reader reports, its `from`
// handed back through the `goto` command, lands on the place left within a pixel (which jsdom, with no layout, cannot
// show); a `from` the reader rejects lands on the id alone. The wire's own limits are unit cases
// (test/enhance-frame-wire.test.ts); the figure overlay's report and `close-overlay` need no layout and are there too.
//
// The public entry is bundled on its own and evaluated in the page after it loaded (as nav.test.ts does), so the
// options can hold functions. Scroll anchoring is off, so what the command restores is the command's, not the page's.
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { isAnchorToken } from '../../src/frame/anchor.js';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** 24 sections of filler, each linking ahead. */
function longDoc(): string {
  const out = ['# Places sample', '', '**Spec** · 2026-10-20 · Status: Draft', ''];
  for (let n = 1; n <= 24; n += 1) {
    out.push(`## Section ${String(n)}`, '');
    for (let k = 0; k < 3; k += 1) {
      out.push(`Paragraph ${String(k + 1)} of section ${String(n)}: a sentence of filler that wraps across the reading column so that each section takes room on the page, and then some more words.`, '');
    }
    if (n + 6 <= 24) out.push(`Read on in [section ${String(n + 6)}](#section-${String(n + 6)}).`, '');
  }
  return out.join('\n');
}

const DOC = longDoc();

const ENTRY = [
  "import { destroyEnhancement, enhance, runEnhancementCommand } from './src/enhance/index.ts';",
  '(window as unknown as { __places: unknown }).__places = { enhance, destroyEnhancement, runEnhancementCommand };',
].join('\n');

let script = '';

beforeAll(async () => {
  const r = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'places-entry.ts', loader: 'ts' },
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

type Win = {
  __places: {
    enhance(root: HTMLElement, options?: unknown): Promise<void>;
    runEnhancementCommand(root: HTMLElement, name: string, args?: { id: string; from?: string }): boolean;
  };
  __hashes: [string | null, { push: boolean; from: string | null }][];
};

async function frames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 50)))));
}

describeBrowsers((browser) => {
  it("a real jump's from, passed back through goto, lands on the place left within a pixel; a rejected from lands on the id", async () => {
    const doc = await openDoc(DOC, {}, { browser, csp: 'strict', enhance: false });
    try {
      await doc.page.evaluate(script);
      await doc.page.evaluate(async () => {
        const w = window as unknown as Win;
        w.__hashes = [];
        document.documentElement.style.overflowAnchor = 'none';
        document.body.style.overflowAnchor = 'none';
        await w.__places.enhance(document.querySelector('main[data-harness-root]') as HTMLElement, {
          onHash: (id: string | null, entry: { push: boolean; from: string | null }) => void w.__hashes.push([id, entry]),
        });
        await document.fonts.ready;
      });
      await frames(doc.page);
      await doc.page.evaluate(() => window.scrollTo({ top: 3000, behavior: 'instant' }));
      await frames(doc.page);
      await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const link = Array.from(root.querySelectorAll('a[href^="#section-"]')).find((a) => {
          const top = a.getBoundingClientRect().top;
          return top > 100 && top < 700 && a.textContent?.startsWith('section') === true;
        }) as HTMLElement;
        link.click();
      });
      await doc.page.waitForTimeout(1500); // the smooth scroll, if it was one
      const hashes = await doc.page.evaluate(() => (window as unknown as Win).__hashes);
      expect(hashes).toHaveLength(1);
      const [id, entry] = hashes[0] as [string, { push: boolean; from: string }];
      expect(entry.push).toBe(true);
      expect(isAnchorToken(entry.from)).toBe(true);
      const from = JSON.parse(entry.from) as { line: string; offset: number; y: number };
      const place = (): Promise<{ top: number; y: number }> =>
        doc.page.evaluate((line) => {
          const el = Array.from(document.querySelectorAll('main[data-harness-root] [data-line]')).find((e) => e.getAttribute('data-line') === line) as Element;
          return { top: el.getBoundingClientRect().top, y: window.scrollY };
        }, from.line);
      expect((await place()).y).toBeGreaterThan(from.y + 100); // the jump moved us on
      const ran = await doc.page.evaluate(
        ({ target, f }) => (window as unknown as Win).__places.runEnhancementCommand(document.querySelector('main[data-harness-root]') as HTMLElement, 'goto', { id: target, from: f }),
        { target: id, f: entry.from },
      );
      expect(ran).toBe(true);
      await frames(doc.page);
      const back = await place();
      expect(Math.abs(back.top - from.offset)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.y - from.y)).toBeLessThanOrEqual(1);
      expect(await doc.page.evaluate(() => (window as unknown as Win).__hashes.length)).toBe(1); // Back is not a jump: no onHash

      // A from the reader rejects: the id alone, under the bar, as the initial hash lands.
      await doc.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await frames(doc.page);
      await doc.page.evaluate(
        ({ target }) => (window as unknown as Win).__places.runEnhancementCommand(document.querySelector('main[data-harness-root]') as HTMLElement, 'goto', { id: target, from: '{"line":"x y","offset":0,"y":0}' }),
        { target: id },
      );
      await frames(doc.page);
      const landed = await doc.page.evaluate((target) => {
        const h = Array.from(document.querySelectorAll('main[data-harness-root] h2')).find((e) => e.id === target) as Element;
        return { top: h.getBoundingClientRect().top, margin: parseFloat(getComputedStyle(h).scrollMarginTop) };
      }, id);
      expect(Math.abs(landed.top - landed.margin)).toBeLessThanOrEqual(1);
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });
});
