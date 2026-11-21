import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const DOC = '# Title\n\n**Spec** · 2026-01-01 · Status: Draft\n\n## In short\n\nSummary.\n\n## 1. First\n\nText.\n\n## 2. Second\n\nText.\n\n## Where things stand\n\n### Agreed\n\nDone.\n';

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
      await doc.page.locator('.toc-btn').click();
      expect(await doc.page.locator('.doc-toc').isVisible()).toBe(true);
      await doc.page.keyboard.press('Escape');
      expect(await doc.page.locator('.doc-toc').isVisible()).toBe(false);
      expect(await doc.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally { await doc.close(); }
  });

  it('shows desktop contents and hides phone chips', async () => {
    const doc = await openDoc(DOC, {}, { browser, layout: 'classic', viewport: { width: 1280, height: 800 } });
    try {
      expect(await doc.page.locator('.doc-toc').isVisible()).toBe(true);
      expect(await doc.page.locator('nav.chips').isVisible()).toBe(false);
    } finally { await doc.close(); }
  });

  it('classic keeps the original header without editorial byline or facts', async () => {
    const doc = await openDoc(DOC, {}, { browser, layout: 'classic' });
    try {
      expect(await doc.page.locator('[data-docreader-root]').count()).toBe(1);
      expect(await doc.page.locator('.byline, .facts').count()).toBe(0);
      expect(await doc.page.locator('.short').count()).toBe(1);
    } finally { await doc.close(); }
  });
});
