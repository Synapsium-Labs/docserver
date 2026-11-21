import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const DOC = '# Title\n\n**Spec** · 2026-01-01 · Status: Draft\n\n## In short\n\nSummary.\n\n## 1. First\n\nText.\n\n## 2. Second\n\nText.\n\n## Where things stand\n\n### Agreed\n\nDone.\n';

afterAll(closeBrowsers);
describeBrowsers((browser) => {
  it('classic keeps the original header without editorial byline or facts', async () => {
    const doc = await openDoc(DOC, {}, { browser, layout: 'classic' });
    try {
      expect(await doc.page.locator('.byline, .facts').count()).toBe(0);
      expect(await doc.page.locator('.short').count()).toBe(1);
    } finally { await doc.close(); }
  });
});
