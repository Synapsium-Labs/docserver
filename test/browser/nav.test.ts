// Navigation and the reading position in a real browser (docserver L2, Task 14): what jsdom cannot show, since it has
// no layout. The initial hash lands under the bar, at the stylesheet's scroll margin, and a row with no id lands below
// the bar and the table head's room as `tr[id]` would; goToHash with the `from` token onHash gave restores the block's
// offset within 2 px, after a block above it grew; the position written behind survives a reload; the pin holds the
// target while a block above it grows, until the reader presses a key; and with reduced motion a jump is made at once.
//
// The public entry and the lifecycle's test hook (contextOf) are bundled here on their own and evaluated in the page
// after it loaded, as the services' browser case does, so the options can hold functions (onHash, a storage's set).
// The page's own scroll anchoring is turned off where a case measures what a growing block does to the target: with
// it on, Chromium keeps the visible block in place by itself, which would hide whether the pin did.
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** A long document: 24 sections of filler, each linking ahead, and a table of IDs in the third. */
function longDoc(): string {
  const out = ['# Navigation sample', '', '**Spec** · 2026-10-20 · Status: Draft', ''];
  for (let n = 1; n <= 24; n += 1) {
    out.push(`## Section ${String(n)}`, '');
    for (let k = 0; k < 3; k += 1) {
      out.push(`Paragraph ${String(k + 1)} of section ${String(n)}: a sentence of filler that wraps across the reading column so that each section takes room on the page, and then some more words.`, '');
    }
    if (n + 6 <= 24) out.push(`Read on in [section ${String(n + 6)}](#section-${String(n + 6)}), or [the next one](#section-${String(n + 1)}).`, '');
    if (n === 3) {
      out.push('| ID | What | Status |', '|---|---|---|');
      for (let r = 1; r <= 8; r += 1) out.push(`| R${String(r)} | Row ${String(r)} | Agreed |`);
      out.push('');
    }
  }
  return out.join('\n');
}

const DOC = longDoc();

const ENTRY = [
  "import { destroyEnhancement, enhance, goToHash } from './src/enhance/index.ts';",
  "import { contextOf } from './src/enhance/lifecycle.ts';",
  '(window as unknown as { __nav: unknown }).__nav = { enhance, goToHash, destroyEnhancement, contextOf };',
].join('\n');

let script = '';

beforeAll(async () => {
  const r = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'nav-entry.ts', loader: 'ts' },
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

interface Api {
  enhance(root: HTMLElement, options?: unknown): Promise<void>;
  goToHash(root: HTMLElement, id: string | null, from?: string | null): void;
  destroyEnhancement(root: HTMLElement): Promise<void>;
  contextOf(root: Element): { index: { define(e: unknown): boolean } } | undefined;
}

type Win = { __nav: Api; __hashes: [string | null, { push: boolean; from: string | null }][]; __writes: [string, string | null][] };

/** In the page: enhance the root with `options` (and a recording onHash and storage), then wait for the fonts and two frames. */
async function enhanceIn(page: Page, options: Record<string, unknown> = {}, snapshot: Record<string, string> | null = null): Promise<void> {
  await page.evaluate(script);
  await page.evaluate(
    async ({ options: o, snapshot: snap }) => {
      const w = window as unknown as Win;
      w.__hashes = [];
      w.__writes = [];
      const root = document.querySelector('main[data-harness-root]') as HTMLElement;
      const storage = snap === null ? undefined : { snapshot: snap, set: (k: string, v: string | null) => void w.__writes.push([k, v]) };
      await w.__nav.enhance(root, {
        ...o,
        ...(storage === undefined ? {} : { storage, storageKey: 'case' }),
        onHash: (id: string | null, entry: { push: boolean; from: string | null }) => void w.__hashes.push([id, entry]),
      });
      await document.fonts.ready;
    },
    { options, snapshot },
  );
  await frames(page);
}

/** Two frames and a settle in the page. */
async function frames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 50)));
      }),
  );
}

/** The top of the element a walk finds (a heading by its id, or a row by its first cell), in the viewport. */
function topOf(page: Page, what: { id?: string; row?: string; line?: string }): Promise<number> {
  return page.evaluate((w) => {
    const root = document.querySelector('main[data-harness-root]') as HTMLElement;
    let el: Element | undefined;
    if (w.id !== undefined) el = Array.from(root.querySelectorAll('h2')).find((h) => h.id === w.id);
    else if (w.row !== undefined) el = Array.from(root.querySelectorAll('tbody tr')).find((r) => r.firstElementChild?.textContent === w.row);
    else el = Array.from(root.querySelectorAll('[data-line]')).find((e) => e.getAttribute('data-line') === w.line);
    if (el === undefined) throw new Error(`nothing for ${JSON.stringify(w)}`);
    return el.getBoundingClientRect().top;
  }, what);
}

/** The scroll margin the stylesheet gives a heading with an id: --bar-h + 14px, resolved. */
const idMargin = (page: Page): Promise<number> =>
  page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('main[data-harness-root] h2') as Element).scrollMarginTop));

/** Grow the document's paragraph at `line` (a host's change) by `px`, through the CSSOM. */
function grow(page: Page, n: number, px: number): Promise<void> {
  return page.evaluate(
    ({ n: at, px: by }) => {
      const p = document.querySelectorAll('main[data-harness-root] > p')[at] as HTMLElement;
      p.style.paddingBottom = `${String(by)}px`;
    },
    { n, px },
  );
}

/** Turn the page's scroll anchoring off, so a growing block above moves what is in view unless the pin holds it. */
const noAnchoring = (page: Page): Promise<void> =>
  page.evaluate(() => {
    document.documentElement.style.overflowAnchor = 'none';
    document.body.style.overflowAnchor = 'none';
  });

describeBrowsers((browser) => {
  it('the initial hash lands under the bar, at the stylesheet\'s margin; a row with no id lands below the bar and the head\'s room', async () => {
    const doc = await openDoc(DOC, {}, { browser, csp: 'strict', enhance: false });
    try {
      await enhanceIn(doc.page, { initialHash: 'section-14' });
      const margin = await idMargin(doc.page);
      expect(margin).toBeGreaterThan(14);
      expect(Math.abs((await topOf(doc.page, { id: 'section-14' })) - margin)).toBeLessThanOrEqual(1);
      expect(await doc.page.evaluate(() => window.scrollY)).toBeGreaterThan(2000);
      const headRoom = await doc.page.evaluate(() => {
        const w = window as unknown as Win;
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const row = Array.from(root.querySelectorAll('tbody tr')).find((r) => r.firstElementChild?.textContent === 'R5') as Element;
        w.__nav.contextOf(root)?.index.define({ id: 'R5', kind: 'row', title: 'R5', status: null, group: 'Section 3', target: row, row, heads: ['ID', 'What', 'Status'] });
        w.__nav.goToHash(root, 'R5');
        const table = row.closest('table') as HTMLTableElement;
        return (table.tHead as HTMLTableSectionElement).offsetHeight;
      });
      await frames(doc.page);
      // Relayout measures the real head; 40px is only the stylesheet's fallback before that measure. Read the box,
      // not --thead-h, so a missing measurement or a navigation that ignores it still fails this assertion.
      expect(headRoom).toBeGreaterThan(0);
      expect(Math.abs((await topOf(doc.page, { row: 'R5' })) - (margin - 14 + headRoom))).toBeLessThanOrEqual(1);
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  it('goToHash with the from token onHash gave restores the block\'s offset within 2 px, after a block above it grew', async () => {
    const doc = await openDoc(DOC, {}, { browser, csp: 'strict', enhance: false });
    try {
      await enhanceIn(doc.page);
      await noAnchoring(doc.page);
      await doc.page.evaluate(() => {
        window.scrollTo({ top: 3000, behavior: 'instant' });
      });
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
      const [[, entry]] = (await doc.page.evaluate(() => (window as unknown as Win).__hashes)) as [[string, { push: boolean; from: string }]];
      expect(entry.push).toBe(true);
      const from = JSON.parse(entry.from) as { line: string; offset: number; y: number };
      expect(from.line).toMatch(/^\d+-\d+$/);
      expect(Math.abs(from.y - 3000)).toBeLessThanOrEqual(1);
      await grow(doc.page, 3, 500); // a paragraph near the start, far above the place left
      await doc.page.evaluate((f) => {
        const w = window as unknown as Win;
        w.__nav.goToHash(document.querySelector('main[data-harness-root]') as HTMLElement, null, f);
      }, entry.from);
      await frames(doc.page);
      expect(Math.abs((await topOf(doc.page, { line: from.line })) - from.offset)).toBeLessThanOrEqual(2);
      expect(Math.abs((await doc.page.evaluate(() => window.scrollY)) - (from.y + 500))).toBeLessThanOrEqual(2);
      // The block hidden since (a host's style; no hidden attribute): it has no box, so back to the scroll position.
      await doc.page.evaluate(
        ({ f, line }) => {
          const root = document.querySelector('main[data-harness-root]') as HTMLElement;
          const block = Array.from(root.querySelectorAll('[data-line]')).find((e) => e.getAttribute('data-line') === line) as HTMLElement;
          block.style.display = 'none';
          window.scrollTo({ top: 0, behavior: 'instant' });
          (window as unknown as Win).__nav.goToHash(root, null, f);
        },
        { f: entry.from, line: from.line },
      );
      await frames(doc.page);
      expect(Math.abs((await doc.page.evaluate(() => window.scrollY)) - from.y)).toBeLessThanOrEqual(2);
    } finally {
      await doc.close();
    }
  });

  it('the position written behind survives a reload: the block comes back to its offset within 2 px', async () => {
    const doc = await openDoc(DOC, {}, { browser, csp: 'strict', enhance: false });
    try {
      await enhanceIn(doc.page, {}, {});
      await doc.page.evaluate(() => {
        window.scrollTo({ top: 2500, behavior: 'instant' });
      });
      await doc.page.waitForTimeout(700); // the write waits for scrolling to stop (250 ms)
      const writes = await doc.page.evaluate(() => (window as unknown as Win).__writes);
      const last = writes.filter(([k]) => k === 'docreader:pos:case').at(-1)?.[1];
      expect(typeof last).toBe('string');
      const place = JSON.parse(last as string) as { line: string; offset: number; y: number };
      expect(Math.abs(place.y - 2500)).toBeLessThanOrEqual(1);
      await doc.page.reload();
      await doc.page.waitForFunction(() => document.documentElement.getAttribute('data-harness') === 'loaded');
      await enhanceIn(doc.page, {}, { 'docreader:pos:case': last as string });
      expect(Math.abs((await topOf(doc.page, { line: place.line })) - place.offset)).toBeLessThanOrEqual(2);
      expect(Math.abs((await doc.page.evaluate(() => window.scrollY)) - 2500)).toBeLessThanOrEqual(2);
    } finally {
      await doc.close();
    }
  });

  it('the pin holds the target while a block above it grows; once the reader presses a key it no longer does', async () => {
    const doc = await openDoc(DOC, {}, { browser, csp: 'strict', enhance: false });
    try {
      await noAnchoring(doc.page);
      await enhanceIn(doc.page, { initialHash: 'section-16' });
      const margin = await idMargin(doc.page);
      expect(Math.abs((await topOf(doc.page, { id: 'section-16' })) - margin)).toBeLessThanOrEqual(1);
      await grow(doc.page, 2, 400);
      await frames(doc.page);
      expect(Math.abs((await topOf(doc.page, { id: 'section-16' })) - margin)).toBeLessThanOrEqual(1);
      await doc.page.keyboard.press('Shift');
      await grow(doc.page, 4, 300);
      await frames(doc.page);
      expect(Math.abs((await topOf(doc.page, { id: 'section-16' })) - (margin + 300))).toBeLessThanOrEqual(1);
    } finally {
      await doc.close();
    }
  });

  it('a second jump to a target still flashing starts its flash again', async () => {
    const doc = await openDoc(DOC, {}, { browser, csp: 'strict', enhance: false });
    try {
      await enhanceIn(doc.page);
      const times = await doc.page.evaluate(async () => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const link = root.querySelector('a[href="#section-2"]') as HTMLElement;
        const h = Array.from(root.querySelectorAll('h2')).find((x) => x.id === 'section-2') as Element;
        const now = (): number[] => h.getAnimations().map((a) => Number(a.currentTime));
        link.click();
        await new Promise((r) => setTimeout(r, 1000));
        const before = now();
        link.click();
        await new Promise<void>((r) => {
          requestAnimationFrame(() => r());
        });
        return [before, now()];
      });
      expect(times[0]?.length).toBe(1);
      expect(times[0]?.[0]).toBeGreaterThan(700);
      expect(times[1]?.length).toBe(1);
      expect(times[1]?.[0]).toBeLessThan(400);
    } finally {
      await doc.close();
    }
  });

  it('with reduced motion a jump is made at once', async () => {
    const doc = await openDoc(DOC, {}, { browser, csp: 'strict', enhance: false });
    try {
      await doc.page.emulateMedia({ reducedMotion: 'reduce' });
      await enhanceIn(doc.page);
      const margin = await idMargin(doc.page);
      const top = await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        (root.querySelector('a[href="#section-2"]') as HTMLElement).click();
        // read in the same task as the click: a smooth scroll would not have moved yet
        return (Array.from(root.querySelectorAll('h2')).find((h) => h.id === 'section-2') as Element).getBoundingClientRect().top;
      });
      expect(Math.abs(top - margin)).toBeLessThanOrEqual(1);
    } finally {
      await doc.close();
    }
  });
});
