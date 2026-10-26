// The filtered technical table's Product-lens clip and peek bar share its outer root-child wrapper.
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName } from './harness.js';

const rows = Array.from({ length: 12 }, (_, index) => `| Item ${String(index + 1)} | \`src/part-${String(index + 1)}.ts\` |`).join('\n');
const DOC = [
  '# Filtered engineering detail',
  '',
  '**Spec** · 2026-10-21 · Status: Draft',
  '',
  '## 1. Technical table',
  '',
  '| File | Detail |',
  '|---|---|',
  rows,
  '',
  '## 2. Later source section',
  '',
  'This paragraph must stay after the table peek control.',
  '',
  '### 2.1 Detail',
  '',
  'More source prose.',
  '',
  '### 2.2 Detail',
  '',
  'More source prose.',
  '',
  '### 2.3 Detail',
  '',
  'More source prose.',
  '',
  '### 2.4 Detail',
  '',
  'More source prose.',
].join('\n');

interface TableState {
  readonly outerTech: boolean;
  readonly innerTech: boolean;
  readonly nextIsBar: boolean;
  readonly barBeforeLater: boolean;
  readonly clipped: boolean;
  readonly maxHeight: string;
  readonly fontSize: number;
  readonly filterInside: boolean;
  readonly visibleBar: boolean;
  readonly targetHeight: number;
  readonly barTop: number;
  readonly targetBottom: number;
  readonly barBottom: number;
}

async function state(browser: BrowserName, width: number, dark: boolean): Promise<TableState> {
  const doc = await openDoc(DOC, {}, { browser, viewport: { width, height: 900 }, csp: 'strict' });
  try {
    await doc.page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
    await doc.page.locator('main[data-harness-root] .aa-btn').click();
    await doc.page.locator('main[data-harness-root] input[data-pref="lens"][value="product"]').check();
    const before = await doc.page.evaluate(() => {
      const root = document.querySelector('main[data-harness-root]') as HTMLElement;
      const outer = root.querySelector('.tbl-block') as HTMLElement;
      const inner = outer.querySelector('.table-wrapper') as HTMLElement;
      const bar = outer.nextElementSibling as HTMLElement;
      const later = Array.from(root.querySelectorAll('h2')).find((heading) => heading.textContent?.includes('Later source section')) as HTMLElement;
      const outerBox = outer.getBoundingClientRect();
      const barBox = bar.getBoundingClientRect();
      return {
        outerTech: outer.classList.contains('tech'),
        innerTech: inner.classList.contains('tech'),
        nextIsBar: bar.classList.contains('peek-bar'),
        barBeforeLater: Boolean(bar.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING),
        clipped: outer.scrollHeight > outer.clientHeight,
        maxHeight: getComputedStyle(outer).maxHeight,
        fontSize: parseFloat(getComputedStyle(outer).fontSize),
        filterInside: outer.contains(outer.querySelector('.tbl-tools input')),
        visibleBar: getComputedStyle(bar).display !== 'none' && barBox.height > 0,
        targetHeight: outerBox.height,
        barTop: barBox.top,
        targetBottom: outerBox.bottom,
        barBottom: barBox.bottom,
      };
    });
    expect(before.outerTech).toBe(true);
    await doc.page.locator('main[data-harness-root] .tbl-tools input').fill('part-1');
    expect(await doc.page.evaluate(() => Array.from(document.querySelectorAll('main[data-harness-root] .tbl-block tbody tr')).map((row) => row.hasAttribute('hidden')))).toEqual([false, true, true, true, true, true, true, true, true, false, false, false]);
    await doc.page.locator('main[data-harness-root] .peek-btn').click();
    const expanded = await doc.page.evaluate(() => {
      const root = document.querySelector('main[data-harness-root]') as HTMLElement;
      const outer = root.querySelector('.tbl-block') as HTMLElement;
      const inner = outer.querySelector('.table-wrapper') as HTMLElement;
      return { outerOpen: outer.classList.contains('peek-open'), innerOpen: inner.classList.contains('peek-open'), clipped: outer.scrollHeight > outer.clientHeight };
    });
    expect(expanded).toEqual({ outerOpen: true, innerOpen: false, clipped: false });
    await doc.page.locator('main[data-harness-root] .peek-btn').click();
    expect(await doc.page.evaluate(() => (document.querySelector('main[data-harness-root] .tbl-block') as HTMLElement).classList.contains('peek-open'))).toBe(false);
    expect(await doc.violations()).toEqual([]);
    expect(doc.aborted).toEqual([]);
    expect(doc.missing).toEqual([]);
    return before;
  } finally {
    await doc.close();
  }
}

afterAll(closeBrowsers);

describeBrowsers((browser) => {
  for (const width of [1440, 390]) {
    for (const dark of [false, true]) {
      it(`at ${String(width)} px in ${dark ? 'dark' : 'light'} mode clips and expands the outer filtered table`, async () => {
        const got = await state(browser, width, dark);
        expect([got.outerTech, got.innerTech, got.nextIsBar, got.barBeforeLater, got.filterInside, got.visibleBar]).toEqual([true, false, true, true, true, true]);
        const maxHeight = parseFloat(got.maxHeight);
        expect(maxHeight).toBeCloseTo(got.fontSize * 13, 8);
        expect(got.clipped).toBe(true);
        expect(got.targetHeight).toBeLessThanOrEqual(maxHeight);
        expect(got.barTop).toBeGreaterThanOrEqual(got.targetBottom);
        expect(got.barTop - got.targetBottom).toBeLessThanOrEqual(got.fontSize * 2);
      });
    }
  }
});
