import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const DOC = '# Title\n\n**Spec** · 2026-01-01 · Status: Draft\n\n## In short\n\nSummary.\n\n## 1. First\n\nText.\n\n## 2. Second\n\nText.\n\n## Where things stand\n\n### Agreed\n\nDone.\n';
const TABLE = (n: number): string => [
  '| Item | Status |', '| --- | --- |',
  ...Array.from({ length: n }, (_, i) => `| Row ${i + 1} | Agreed |`),
].join('\n');
const FILL = 'A paragraph long enough to fill a few lines in a narrow reading column.\n\n'.repeat(32);
const LONG_DOC = `${DOC.replaceAll('Text.', FILL)}\n\n${FILL}${TABLE(12)}\n\n${FILL}`;

afterAll(closeBrowsers);
describeBrowsers((browser) => {
  it('classic contents has no tab interface', async () => {
    const doc = await openDoc(DOC, {}, { browser, layout: 'classic' });
    try {
      expect(await doc.page.getByRole('tab', { name: /contents/i }).count()).toBe(0);
    } finally { await doc.close(); }
  });

  it('shows phone chips and opens the contents drawer on narrow screens', async () => {
    const doc = await openDoc(DOC, {}, { browser, layout: 'classic', viewport: { width: 412, height: 915 } });
    try {
      expect(await doc.page.locator('nav.chips a').count()).toBe(4);
      await doc.page.locator('.toc-btn').focus();
      await doc.page.keyboard.press('Enter');
      expect(await doc.page.locator('.doc-toc').isVisible()).toBe(true);
      await doc.page.keyboard.press('Escape');
      expect(await doc.page.locator('.doc-toc').isVisible()).toBe(false);
      expect(await doc.page.locator('.toc-btn').evaluate((button) => button === document.activeElement)).toBe(true);
      await doc.page.locator('.toc-btn').click();
      await doc.page.locator('.doc-toc a[href="#1-first"]').click();
      expect(await doc.page.locator('.doc-toc').isVisible()).toBe(false);
      await doc.page.locator('h2[id="1-first"].flash').waitFor();
    } finally { await doc.close(); }
  });

  for (const [width, height] of [[412, 915], [1280, 800], [1920, 1080]] as const) {
    it(`${width}×${height}: contents is reachable without horizontal page scroll`, async () => {
      const doc = await openDoc(LONG_DOC, {}, { browser, layout: 'classic', viewport: { width, height } });
      try {
        const overflow = () => doc.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(await overflow()).toBe(0);
        expect(await doc.page.locator('nav.chips').isVisible()).toBe(width === 412);
        if (width === 412) await doc.page.getByRole('button', { name: 'Contents' }).click();
        await doc.page.locator('.doc-toc a', { hasText: 'First' }).waitFor();
        expect(await overflow()).toBe(0);
      } finally { await doc.close(); }
    });
  }

  it('following a phone chip flashes the heading, updates the contents spy and advances progress', async () => {
    const doc = await openDoc(LONG_DOC, {}, { browser, layout: 'classic', viewport: { width: 412, height: 915 } });
    try {
      const { page } = doc;
      const chip = page.locator('.chips a', { hasText: 'Second' });
      const href = await chip.getAttribute('href');
      expect(href).toBe('#2-second');
      await chip.click();
      await page.locator('h2[id="2-second"].flash').waitFor();
      await expect.poll(() => page.locator('.doc-toc a[href="#2-second"]').getAttribute('aria-current')).toBe('location');
      await expect.poll(() => page.locator('.doc-progress').evaluate((el) => Number.parseFloat((el as HTMLElement).style.width))).toBeGreaterThan(0);
    } finally { await doc.close(); }
  });

  it('tracks subsections and follows the active link inside the rail', async () => {
    const markdown = `# Title\n\n**Spec** · 2026-01-01 · Status: Draft\n\n${Array.from({ length: 50 }, (_, i) => `## Section ${i}\n\n${FILL}\n\n### Subsection ${i}\n\n${FILL}`).join('\n\n')}`;
    const doc = await openDoc(markdown, {}, { browser, layout: 'classic', viewport: { width: 1280, height: 800 } });
    try {
      const { page } = doc;
      const expectedY = await page.locator('#subsection-45').evaluate((el) => {
        const y = el.getBoundingClientRect().top + window.scrollY - 200;
        window.scrollTo(0, y);
        return y;
      });
      await expect.poll(() => page.locator('.doc-toc a[href="#subsection-45"]').getAttribute('aria-current')).toBe('location');
      const state = await page.evaluate(() => {
        const rail = document.querySelector<HTMLElement>('.doc-toc')!;
        const link = rail.querySelector<HTMLElement>('a[href="#subsection-45"]')!;
        const r = rail.getBoundingClientRect();
        const a = link.getBoundingClientRect();
        return { scrollTop: rail.scrollTop, visible: a.top >= r.top && a.bottom <= r.bottom, y: window.scrollY, hash: location.hash };
      });
      expect(state.scrollTop).toBeGreaterThan(0);
      expect(state.visible).toBe(true);
      expect(state.hash).toBe('');
      expect(Math.abs(state.y - expectedY)).toBeLessThan(2);
      await page.getByRole('button', { name: 'Collapse' }).click();
      await page.evaluate(() => window.scrollBy(0, 10));
      await page.waitForTimeout(100);
      expect(await page.locator('.doc-toc a[href="#section-45"]').locator('..').evaluate((el) => el.classList.contains('open'))).toBe(false);
    } finally { await doc.close(); }
  });

  it('only a table with at least 12 rows gets a filter; its visible rows and count update', async () => {
    const doc = await openDoc(`${DOC}\n\n${TABLE(11)}\n\n${TABLE(12)}`, {}, { browser, layout: 'classic' });
    try {
      const { page } = doc;
      const filter = page.getByRole('searchbox');
      expect(await filter.count()).toBe(1);
      expect(await page.locator('td .pill').count()).toBe(23);
      await filter.fill('Row 12');
      expect(await page.locator('.tbl-tools').innerText()).toContain('1 of 12');
      expect(await page.locator('tbody').last().locator('tr:not([hidden])').innerText()).toContain('Row 12');
      await filter.fill('');
      expect(await page.locator('tbody').last().locator('tr:not([hidden])').count()).toBe(12);
    } finally { await doc.close(); }
  });

  it('reveals a below-the-fold table when it enters the viewport', async () => {
    const doc = await openDoc(LONG_DOC, {}, { browser, layout: 'classic', viewport: { width: 1280, height: 800 } });
    try {
      const table = doc.page.locator('.table-wrapper');
      expect(await table.evaluate((el) => el.classList.contains('reveal') && !el.classList.contains('in'))).toBe(true);
      await table.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await doc.page.locator('.table-wrapper.reveal.in').waitFor();
    } finally { await doc.close(); }
  });

  it('classic keeps its original header and ignores a switch it does not draw', async () => {
    const doc = await openDoc(DOC, { inShort: true }, { browser, layout: 'classic' });
    try {
      expect(await doc.page.locator('[data-docreader-root]').count()).toBe(1);
      expect(await doc.page.locator('.byline, .facts').count()).toBe(0);
      expect(await doc.page.locator('.short').innerText()).toContain('Summary.');
      expect(await doc.page.locator('.short-view').count()).toBe(0);
    } finally { await doc.close(); }
  });
});
