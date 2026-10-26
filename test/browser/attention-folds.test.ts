// Product controls created before folds complete through settings and remain real fold members.
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName } from './harness.js';

const rows = Array.from({ length: 12 }, (_, index) => `| \`src/module-${String(index + 1)}.ts\` | \`Detail ${String(index + 1)}\` |`).join('\n');
const DOC = [
  '# Product fold browser check',
  '',
  '## 1. Engineering detail',
  '',
  '```ts',
  'const one = 1;',
  'const two = 2;',
  'const three = 3;',
  'const four = 4;',
  'const five = 5;',
  '```',
  '',
  '| File | Detail |',
  '|---|---|',
  rows,
  '',
  '## 2. Survivor',
  '',
  'This section keeps the document foldable.',
  '',
  '## 3. End',
  '',
  'Closing prose.',
].join('\n');

interface ProductState {
  readonly codeHidden: string | null;
  readonly tableHidden: string | null;
  readonly codeBarHidden: string | null;
  readonly tableBarHidden: string | null;
  readonly tableSourceIsInner: boolean;
  readonly tableTargetIsOuter: boolean;
  readonly barAfterCode: boolean;
  readonly barAfterTable: boolean;
  readonly duplicateBars: number;
}

async function state(doc: Awaited<ReturnType<typeof openDoc>>): Promise<ProductState> {
  return doc.page.evaluate(() => {
    const root = document.querySelector('main[data-harness-root]') as HTMLElement;
    const code = root.querySelector('.codehilite') as HTMLElement;
    const outer = root.querySelector('.tbl-block') as HTMLElement;
    const inner = outer.querySelector('.table-wrapper') as HTMLElement;
    const codeBar = code.nextElementSibling as HTMLElement;
    const tableBar = outer.nextElementSibling as HTMLElement;
    return {
      codeHidden: code.getAttribute('hidden'),
      tableHidden: outer.getAttribute('hidden'),
      codeBarHidden: codeBar.getAttribute('hidden'),
      tableBarHidden: tableBar.getAttribute('hidden'),
      tableSourceIsInner: inner.parentElement === outer,
      tableTargetIsOuter: tableBar.previousElementSibling === outer,
      barAfterCode: codeBar.classList.contains('peek-bar'),
      barAfterTable: tableBar.classList.contains('peek-bar'),
      duplicateBars: root.querySelectorAll('.peek-bar').length,
    };
  });
}

async function foldAndRestore(doc: Awaited<ReturnType<typeof openDoc>>): Promise<void> {
  const heading = doc.page.locator('main[data-harness-root] h2').filter({ hasText: '1. Engineering detail' });
  await heading.locator('.h-fold').click();
  expect(await state(doc)).toMatchObject({
    codeHidden: 'until-found',
    tableHidden: 'until-found',
    codeBarHidden: 'until-found',
    tableBarHidden: 'until-found',
  });
  await heading.locator('.h-fold').click();
  expect(await state(doc)).toMatchObject({
    codeHidden: null,
    tableHidden: null,
    codeBarHidden: null,
    tableBarHidden: null,
  });
}

async function assertClean(doc: Awaited<ReturnType<typeof openDoc>>): Promise<void> {
  expect(await doc.violations()).toEqual([]);
  expect(doc.aborted).toEqual([]);
  expect(doc.missing).toEqual([]);
}

afterAll(closeBrowsers);

describeBrowsers((browser: BrowserName) => {
  for (const width of [1440, 390]) {
    it(`at ${String(width)} px, explicit Product controls fold with their ordinary and filtered-table sources`, async () => {
      const doc = await openDoc(DOC, { prefs: { lens: 'product' } }, { browser, viewport: { width, height: 900 }, csp: 'strict' });
      try {
        expect(await state(doc)).toEqual({
          codeHidden: null,
          tableHidden: null,
          codeBarHidden: null,
          tableBarHidden: null,
          tableSourceIsInner: true,
          tableTargetIsOuter: true,
          barAfterCode: true,
          barAfterTable: true,
          duplicateBars: 2,
        });
        await foldAndRestore(doc);
        await doc.page.locator('main[data-harness-root] .tbl-tools input').fill('module-1');
        expect(await doc.page.evaluate(() => Array.from(document.querySelectorAll('main[data-harness-root] .tbl-block tbody tr')).map((row) => row.hasAttribute('hidden')))).toEqual([false, true, true, true, true, true, true, true, true, false, false, false]);
        await assertClean(doc);
      } finally {
        await doc.close();
      }
    });
  }

  it('first creates Product controls through the actual Aa radio without changing an unenhanced host sibling', async () => {
    const doc = await openDoc(DOC, {}, { browser, csp: 'strict', enhance: false });
    try {
      const siblingBefore = await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]');
        if (!(root instanceof HTMLElement)) throw new Error('missing reader root');
        const sibling = root.cloneNode(true) as HTMLElement;
        sibling.removeAttribute('data-harness-root');
        sibling.setAttribute('data-harness-host-sibling', '');
        root.after(sibling);
        return {
          source: sibling.querySelector('.codehilite')?.textContent?.trim(),
          rows: sibling.querySelectorAll('tbody tr').length,
          bars: sibling.querySelectorAll('.peek-bar').length,
          hidden: sibling.querySelectorAll('[hidden]').length,
        };
      });
      expect(siblingBefore).toEqual({ source: 'const one = 1;\nconst two = 2;\nconst three = 3;\nconst four = 4;\nconst five = 5;', rows: 12, bars: 0, hidden: 0 });

      await doc.enhance();
      expect(await doc.page.locator('main[data-harness-root] .peek-bar').count()).toBe(0);
      await doc.page.locator('main[data-harness-root] .aa-btn').click();
      await doc.page.locator('main[data-harness-root] input[data-pref="lens"][value="product"]').check();
      expect(await state(doc)).toMatchObject({ duplicateBars: 2, barAfterCode: true, barAfterTable: true });
      await foldAndRestore(doc);
      expect(await doc.page.evaluate(() => {
        const sibling = document.querySelector('main[data-harness-host-sibling]');
        return {
          source: sibling?.querySelector('.codehilite')?.textContent?.trim(),
          rows: sibling?.querySelectorAll('tbody tr').length,
          bars: sibling?.querySelectorAll('.peek-bar').length,
          hidden: sibling?.querySelectorAll('[hidden]').length,
        };
      })).toEqual(siblingBefore);
      await assertClean(doc);
    } finally {
      await doc.close();
    }
  });
});
