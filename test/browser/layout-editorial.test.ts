import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const DOC = '# Title\n\n## In short\n\nSummary.\n\n## 1. First\n\nText.\n\n## 2. Second\n\nText.\n\n## Where things stand\n\n### Agreed\n\n- Done.\n\n### Later\n\n- Next.\n';

afterAll(closeBrowsers);
describeBrowsers((browser) => {
  for (const layout of ['classic', 'editorial'] as const) {
    it(`${layout}: drawer Close is accessible, trapped, and restores focus`, async () => {
      const doc = await openDoc(DOC, { appearance: { skin: { controlRow: '56px' } } }, { browser, layout, viewport: { width: 412, height: 915 }, hasTouch: true });
      try {
        const { page } = doc;
        const opener = page.getByRole('button', { name: 'Contents' });
        await opener.click();
        const drawer = page.getByRole('dialog', { name: 'Contents' });
        const close = drawer.getByRole('button', { name: 'Close', exact: true });
        expect(await close.isVisible()).toBe(true);
        const pointer = await page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, fine: matchMedia('(pointer: fine)').matches }));
        expect(pointer).toEqual({ coarse: true, fine: false });
        expect((await close.boundingBox())!.height, `touch ${JSON.stringify(pointer)}`).toBe(44);
        await drawer.getByRole('link').last().focus();
        await page.keyboard.press('Tab');
        expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true);
        await close.focus();
        await page.keyboard.press('Tab');
        expect(await drawer.getByRole('link').first().evaluate((el) => el === document.activeElement)).toBe(true);
        await close.focus();
        await page.keyboard.press('Enter');
        expect(await opener.getAttribute('aria-expanded')).toBe('false');
        expect(await opener.evaluate((el) => el === document.activeElement)).toBe(true);
        await page.setViewportSize({ width: 1280, height: 800 });
        expect(await page.getByRole('navigation', { name: 'Contents' }).getByRole('button', { name: 'Close' }).isVisible()).toBe(false);
      } finally { await doc.close(); }
    });

    it(`${layout}: drawer Close responds to hosted controlRow on a fine pointer`, async () => {
      for (const height of [40, 56]) {
        const doc = await openDoc(DOC, { appearance: { skin: { controlRow: `${height}px` } } }, { browser, layout, viewport: { width: 412, height: 915 }, hasTouch: false });
        try {
          const { page } = doc;
          await page.getByRole('button', { name: 'Contents' }).click();
          const close = page.getByRole('dialog', { name: 'Contents' }).getByRole('button', { name: 'Close', exact: true });
          const pointer = await page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, fine: matchMedia('(pointer: fine)').matches }));
          expect(pointer).toEqual({ coarse: false, fine: true });
          expect((await close.boundingBox())!.height, `controlRow ${height}px ${JSON.stringify(pointer)}`).toBe(height);
        } finally { await doc.close(); }
      }
    });

    it(`${layout}: hidden headings do not become current and details changes refresh the spy`, async () => {
      const markdown = `${DOC}\n\n## First\n\n${'Filler text.\n\n'.repeat(80)}## Hidden\n\n${'Filler text.\n\n'.repeat(8)}## Last\n\n${'Filler text.\n\n'.repeat(80)}`;
      const doc = await openDoc(markdown, {}, { browser, layout, viewport: { width: 1280, height: 800 }, html: (html) => html.replace(/(<h2[^>]*id="hidden"[^>]*>.*?<\/h2>)/, '<details><summary>More</summary>$1</details>') });
      try {
        const { page } = doc;
        const hidden = page.locator('.doc-toc a[href="#hidden"]');
        expect(await hidden.count()).toBe(1);
        await page.locator('details').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 80));
        await expect.poll(() => page.locator('.doc-toc a[href="#first"]').getAttribute('aria-current')).toBe('location');
        expect(await hidden.getAttribute('aria-current')).toBeNull();
        await page.locator('summary').click();
        await expect.poll(() => hidden.getAttribute('aria-current')).toBe('location');
        await page.locator('summary').click();
        await expect.poll(() => page.locator('.doc-toc a[href="#first"]').getAttribute('aria-current')).toBe('location');
      } finally { await doc.close(); }
    });

    it(`${layout}: a boxless heading stays linked but is not current`, async () => {
      const markdown = `${DOC}\n\n## Visible\n\n${'Text.\n\n'.repeat(70)}## Boxless\n\n${'Text.\n\n'.repeat(10)}## After\n\n${'Text.\n\n'.repeat(70)}`;
      const doc = await openDoc(markdown, {}, { browser, layout, viewport: { width: 1280, height: 800 }, html: (html) => html.replace('id="boxless"', 'id="boxless" hidden') });
      try {
        const { page } = doc;
        const boxless = page.locator('.doc-toc a[href="#boxless"]');
        expect(await boxless.count()).toBe(1);
        await page.locator('#after').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 500));
        await expect.poll(() => page.locator('.doc-toc a[href="#visible"]').getAttribute('aria-current')).toBe('location');
        expect(await boxless.getAttribute('aria-current')).toBeNull();
      } finally { await doc.close(); }
    });

    it(`${layout}: only ordinary fragment clicks dismiss the drawer`, async () => {
      const doc = await openDoc(DOC, {}, { browser, layout, viewport: { width: 412, height: 915 } });
      try {
        const { page } = doc;
        await page.getByRole('button', { name: 'Contents' }).click();
        const drawer = page.getByRole('dialog', { name: 'Contents' });
        const link = drawer.locator('a[href="#1-first"]');
        for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
          await link.dispatchEvent('click', init);
          expect(await drawer.isVisible()).toBe(true);
        }
        await link.click();
        expect(await drawer.isVisible()).toBe(false);
        await page.locator('h2[id="1-first"].flash').waitFor();
      } finally { await doc.close(); }
    });
  }

  it('counts ordered task steps in editorial task metadata', async () => {
    const doc = await openDoc('# Title\n\n## Plan\n\n### Task 1: Build\n\n1. [ ] **Step 1:** One\n2. [x] **Step 2:** Two\n', {}, { browser, layout: 'editorial' });
    try {
      expect(await doc.page.locator('h3.task .tmeta').allTextContents()).toContain('2 steps');
    } finally { await doc.close(); }
  });

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
