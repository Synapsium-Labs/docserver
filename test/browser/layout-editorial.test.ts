import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const DOC = '# Title\n\n## In short\n\nSummary.\n\n## 1. First\n\nText.\n\n## 2. Second\n\nText.\n\n## Where things stand\n\n### Agreed\n\n- Done.\n\n### Later\n\n- Next.\n';

afterAll(closeBrowsers);
describeBrowsers((browser) => {
  it('editorial uses a contents drawer without tabs or phone chips', async () => {
    const doc = await openDoc(DOC, {}, { browser, layout: 'editorial', viewport: { width: 412, height: 915 } });
    try {
      expect(await doc.page.getByRole('tab').count()).toBe(0);
      expect(await doc.page.locator('.chips').count()).toBe(0);
      await doc.page.getByRole('button', { name: 'Contents' }).click();
      expect(await doc.page.getByRole('dialog', { name: 'Contents' }).isVisible()).toBe(true);
      await doc.page.keyboard.press('Escape');
      expect(await doc.page.getByRole('button', { name: 'Contents' }).getAttribute('aria-expanded')).toBe('false');
    } finally { await doc.close(); }
  });

  for (const [width, height] of [[412, 915], [1280, 800], [1920, 1080]] as const) {
    it(`${width}×${height}: contents is reachable without horizontal overflow`, async () => {
      const doc = await openDoc(DOC, {}, { browser, layout: 'editorial', viewport: { width, height } });
      try {
        if (width === 412) await doc.page.getByRole('button', { name: 'Contents' }).click();
        expect(await doc.page.getByRole(width === 412 ? 'dialog' : 'navigation', { name: 'Contents' }).isVisible()).toBe(true);
        expect(await doc.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
      } finally { await doc.close(); }
    });
  }

  it('labels long plans without outline controls or state', async () => {
    const steps = Array.from({ length: 20 }, (_, i) => `- [ ] **Step ${i + 1} (you):** Do work`).join('\n');
    const markdown = `${DOC}\n\n## Plan\n\n### Task 7: Build\n\nWho: The team.\n\n${steps}\n`;
    const doc = await openDoc(markdown, {}, { browser, layout: 'editorial' });
    try {
      expect(await doc.page.locator('h3.task .task-id').count()).toBe(1);
      expect(await doc.page.locator('li.task-list-item .step-no').count()).toBe(20);
      expect(await doc.page.locator('.outline-btn, .task-open').count()).toBe(0);
      await doc.page.keyboard.press('o');
      expect(await doc.page.locator('[data-docreader-root].outline').count()).toBe(0);
      expect(await doc.page.locator('li.task-list-item input').first().getAttribute('aria-label')).toContain('Step 1');
    } finally { await doc.close(); }
  });

  it('filters and stacks shared tables on phones', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => `| Item ${i + 1} | Agreed | Note ${i + 1} |`).join('\n');
    const markdown = `${DOC}\n\n| Item | Status | Note |\n| --- | --- | --- |\n${rows}\n`;
    const doc = await openDoc(markdown, {}, { browser, layout: 'editorial', viewport: { width: 412, height: 915 } });
    try {
      expect(await doc.page.locator('.table-wrapper.stack').count()).toBe(1);
      expect(await doc.page.locator('tbody .pill').count()).toBe(12);
      await doc.page.locator('.tbl-tools input').fill('Item 12');
      expect(await doc.page.locator('.tbl-tools span').textContent()).toBe('1 of 12');
      expect(await doc.page.locator('tbody tr:visible').count()).toBe(1);
    } finally { await doc.close(); }
  });

  it('quick jump finds configured rules without an Index tab', async () => {
    const markdown = `---\nrules: [AB-1]\n---\n\n${DOC}\n\n## Rules\n\n\`AB-1\` — **A sample rule.** Text.\n`;
    const doc = await openDoc(markdown, { rules: true }, { browser, layout: 'editorial' });
    try {
      expect(await doc.page.locator('p.rule').count()).toBe(1);
      expect(await doc.page.getByRole('tab').count()).toBe(0);
      await doc.page.keyboard.press('/');
      await doc.page.locator('.jump input').fill('AB-1');
      expect(await doc.page.locator('.jump li').first().innerText()).toContain('AB-1');
      await doc.page.keyboard.press('Enter');
      await expect.poll(() => doc.page.locator('p.rule.flash').count()).toBe(1);
    } finally { await doc.close(); }
  });

  it('quick jump reaches a table row and a captioned figure without definition previews', async () => {
    const markdown = `${DOC}\n\n## Decisions\n\n| ID | Meaning |\n|---|---|\n| R7 | A sample decision |\n\n\`\`\`mermaid\nflowchart LR\nA[Start] --> B[End]\n\`\`\`\n\n*Figure 3. A sample drawing.*\n`;
    const doc = await openDoc(markdown, {}, { browser, layout: 'editorial' });
    try {
      const { page } = doc;
      for (const [query, target] of [['R7', 'tr.flash'], ['sample drawing', 'figure.flash']] as const) {
        await page.keyboard.press('/');
        await page.locator('.jump input').fill(query);
        expect(await page.locator('.jump li.sel').innerText()).toContain(query);
        await page.keyboard.press('Enter');
        await page.locator(target).waitFor();
      }
      expect(await page.locator('.xcard, .toc-index').count()).toBe(0);
    } finally { await doc.close(); }
  });

  it('reveals below-fold callouts without hiding tables', async () => {
    const fill = 'A paragraph long enough to leave the next section below the running head.\n\n'.repeat(65);
    const markdown = DOC.replace('## Where things stand', `${fill}| Item | Note |\n| --- | --- |\n| One | Two |\n\n## Where things stand`);
    const doc = await openDoc(markdown, {}, { browser, layout: 'editorial', viewport: { width: 1280, height: 800 } });
    try {
      const { page } = doc;
      expect(await page.locator('.table-wrapper.reveal').count()).toBe(0);
      const agreed = page.locator('.callout.agreed.reveal');
      expect(await agreed.count()).toBe(1);
      expect(await agreed.evaluate((el) => el.classList.contains('in'))).toBe(false);
      await agreed.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.locator('.callout.agreed.reveal.in').waitFor();
    } finally { await doc.close(); }
  });

  it('builds linked callout counts and section anchors without AB controls', async () => {
    const doc = await openDoc(DOC, {}, { browser, layout: 'editorial' });
    try {
      expect(await doc.page.locator('.stand-index a').count()).toBe(2);
      expect(await doc.page.locator('h2:not(.short h2) .h-anchor').count()).toBe(3);
      expect(await doc.page.locator('h3 .h-anchor').count()).toBe(2);
      expect(await doc.page.locator('.short .h-anchor').count()).toBe(0);
      expect(await doc.page.getByRole('tab').count()).toBe(0);
    } finally { await doc.close(); }
  });
});
