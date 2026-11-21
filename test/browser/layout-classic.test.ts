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

  it('restores focus to Contents even when pointer activation did not focus the button', async () => {
    const doc = await openDoc(DOC, {}, { browser, layout: 'classic', viewport: { width: 412, height: 915 } });
    try {
      const { page } = doc;
      const button = page.getByRole('button', { name: 'Contents' });
      for (const dismiss of ['Escape', 'scrim']) {
        await page.locator('.chips a').first().focus();
        // HTMLElement.click does not move focus, as with pointer activation on browsers that do not focus buttons.
        await button.evaluate((el) => (el as HTMLButtonElement).click());
        expect(await page.getByRole('dialog', { name: 'Contents' }).count()).toBe(1);
        if (dismiss === 'Escape') await page.keyboard.press('Escape');
        else await page.locator('.toc-scrim').click({ position: { x: 400, y: 400 } });
        expect(await button.evaluate((el) => el === document.activeElement), dismiss).toBe(true);
      }
    } finally { await doc.close(); }
  });

  it('traps drawer focus and closes on widening', async () => {
    const doc = await openDoc(DOC, {}, { browser, layout: 'classic', viewport: { width: 412, height: 915 } });
    try {
      const { page } = doc;
      const button = page.locator('.toc-btn');
      await button.click();
      await page.keyboard.press('Shift+Tab');
      expect(await page.locator('.doc-toc a:visible').last().evaluate((el) => el === document.activeElement)).toBe(true);
      await page.keyboard.press('Tab');
      expect(await page.getByRole('button', { name: 'Collapse' }).evaluate((el) => el === document.activeElement)).toBe(true);
      await page.setViewportSize({ width: 1240, height: 915 });
      await expect.poll(() => button.getAttribute('aria-expanded')).toBe('false');
      await page.setViewportSize({ width: 412, height: 915 });
      expect(await page.locator('.doc-toc').isVisible()).toBe(false);
      await button.click();
      await page.locator('.toc-scrim').click({ position: { x: 400, y: 400 } });
      expect(await page.locator('.doc-toc').isVisible()).toBe(false);
      expect(await button.evaluate((el) => el === document.activeElement)).toBe(true);
    } finally { await doc.close(); }
  });

  it('preserves numbered accessible names in contents and chips', async () => {
    const doc = await openDoc(DOC.replace('1. First', '1. Repeat').replace('2. Second', '2. Repeat'), {}, { browser, layout: 'classic', viewport: { width: 412, height: 915 } });
    try {
      const { page } = doc;
      expect(await page.locator('.chips a').allTextContents()).toEqual(['In short', '1. Repeat', '2. Repeat', 'Where things stand']);
      await page.getByRole('button', { name: 'Contents' }).click();
      const drawer = page.getByRole('dialog', { name: 'Contents' });
      expect(await drawer.getByRole('link', { name: '1. Repeat', exact: true }).count()).toBe(1);
      expect(await drawer.getByRole('link', { name: '2. Repeat', exact: true }).count()).toBe(1);
      await page.setViewportSize({ width: 1920, height: 1080 });
      const docked = page.getByRole('navigation', { name: 'Contents' });
      await expect.poll(() => docked.getByRole('link', { name: '1. Repeat', exact: true }).count()).toBe(1);
      expect(await docked.getByRole('link', { name: '2. Repeat', exact: true }).count()).toBe(1);
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

  it('follows the active subsection when the phone drawer reopens', async () => {
    const markdown = `${DOC}\n\n${Array.from({ length: 30 }, (_, i) => `## Section ${i}\n\n${FILL}\n\n### Subsection ${i}\n\n${FILL}`).join('\n\n')}`;
    const doc = await openDoc(markdown, {}, { browser, layout: 'classic', viewport: { width: 412, height: 915 } });
    try {
      const { page } = doc;
      await page.locator('#subsection-25').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 200));
      const active = page.locator('.doc-toc a[href="#subsection-25"]');
      await expect.poll(() => active.getAttribute('aria-current')).toBe('location');
      const y = await page.evaluate(() => window.scrollY);
      await page.locator('.toc-btn').dispatchEvent('click');
      await page.getByRole('button', { name: 'Collapse' }).click();
      await page.keyboard.press('Escape');
      await page.locator('.toc-btn').dispatchEvent('click');
      expect(await active.isVisible()).toBe(true);
      expect(await active.evaluate((el) => {
        const r = el.closest('.doc-toc')!.getBoundingClientRect();
        const a = el.getBoundingClientRect();
        return a.top >= r.top && a.bottom <= r.bottom;
      })).toBe(true);
      expect(await page.evaluate(() => [window.scrollY, location.hash])).toEqual([y, '']);
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

  it('applies hosted type and row slots to the drawer but not the docked rail', async () => {
    const appearance = { mode: 'dark', skin: { controlRow: '44px', sectionSize: '14px', sectionWeight: '500', sectionTracking: '0.08em', sectionCase: 'none' } };
    const doc = await openDoc(DOC, { appearance }, { browser, layout: 'classic', csp: 'reader', viewport: { width: 412, height: 915 } });
    try {
      const { page } = doc;
      const measure = () => page.locator('.doc-toc').evaluate((rail) => {
        const title = getComputedStyle(rail.querySelector('.toc-title')!);
        return { size: title.fontSize, weight: title.fontWeight, tracking: title.letterSpacing, textCase: title.textTransform,
          row: rail.querySelector('a')!.getBoundingClientRect().height };
      });
      await page.getByRole('button', { name: 'Contents' }).click();
      const drawer = await measure();
      expect(drawer).toMatchObject({ size: '14px', weight: '500', textCase: 'none' });
      expect(Number.parseFloat(drawer.tracking)).toBeCloseTo(1.12);
      expect(drawer.row).toBeGreaterThanOrEqual(44);
      await page.setViewportSize({ width: 1280, height: 800 });
      await expect.poll(() => page.getByRole('dialog', { name: 'Contents' }).count()).toBe(0);
      const docked = await measure();
      expect(docked).toMatchObject({ size: '11.5px', weight: '700', textCase: 'uppercase' });
      expect(docked.row).toBeLessThan(44);
    } finally { await doc.close(); }
  });

  it('keeps coarse-pointer drawer controls at least 44px without skin slots', async () => {
    const doc = await openDoc(DOC, {}, { browser, layout: 'classic', viewport: { width: 412, height: 915 }, hasTouch: true });
    try {
      const { page } = doc;
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
      await page.getByRole('button', { name: 'Contents' }).click();
      const drawer = page.getByRole('dialog', { name: 'Contents' });
      for (const control of [drawer.getByRole('link', { name: '1. First' }), drawer.getByRole('button', { name: 'Collapse' })]) {
        expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      }
    } finally { await doc.close(); }
  });

  it('reveals a below-fold table synchronously on navigation to a cell, before intersection', async () => {
    const doc = await openDoc(LONG_DOC.replace('Summary.', '[Read the row](#row-target).'), {}, {
      browser, layout: 'classic', html: (html) => html.replace('<td>Row 1</td>', '<td id="row-target">Row 1</td>'),
    });
    try {
      const outcome = await doc.page.getByRole('link', { name: 'Read the row' }).evaluate((link) => {
        const table = document.querySelector('.table-wrapper')!;
        const before = table.classList.contains('reveal') && !table.classList.contains('in');
        (link as HTMLAnchorElement).click();
        return { before, after: table.classList.contains('in') };
      });
      expect(outcome).toEqual({ before: true, after: true });
    } finally { await doc.close(); }
  });

  it('keeps below-fold content visible from the start with reduced motion', async () => {
    const doc = await openDoc(LONG_DOC, {}, { browser, layout: 'classic', enhance: false });
    try {
      await doc.page.emulateMedia({ reducedMotion: 'reduce' });
      await doc.enhance();
      const table = doc.page.locator('.table-wrapper');
      expect(await table.evaluate((el) => ({ hiddenByReveal: el.classList.contains('reveal'), opacity: getComputedStyle(el).opacity })))
        .toEqual({ hiddenByReveal: false, opacity: '1' });
    } finally { await doc.close(); }
  });

  it('restores original boxed and numbered nodes after closing an open enhancement with queued work', async () => {
    const doc = await openDoc(LONG_DOC, {}, { browser, layout: 'classic', enhance: false, viewport: { width: 412, height: 915 } });
    try {
      const { page } = doc;
      const original = await page.evaluateHandle(() => {
        const root = window.__docreaderHarness!.root;
        return { markup: root.outerHTML, nodes: Array.from(root.querySelectorAll('*')), numberText: root.querySelector('h2[id="1-first"]')!.firstChild };
      });
      const unchanged = () => page.evaluate(({ markup, nodes, numberText }) => {
        const root = window.__docreaderHarness!.root;
        const current = Array.from(root.querySelectorAll('*'));
        return root.outerHTML === markup && current.length === nodes.length
          && current.every((el, i) => el === nodes[i]) && root.querySelector('h2[id="1-first"]')?.firstChild === numberText;
      }, original);
      await doc.enhance();
      expect(await page.locator('.short h2, .callout h3, h2 .sec-no').count()).toBe(4);
      expect(await page.locator('.table-wrapper.reveal:not(.in)').count()).toBe(1);
      await page.getByRole('button', { name: 'Contents' }).click();
      expect(await page.getByRole('dialog', { name: 'Contents' }).count()).toBe(1);
      await page.evaluate(async () => {
        // Both events are in this turn: a rail update is pending and the below-fold table remains observed.
        window.dispatchEvent(new Event('scroll'));
        await window.__docreaderHarness!.destroy();
        await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
      });
      expect(await unchanged()).toBe(true);
      await doc.enhance();
      expect(await page.locator('.chips').count()).toBe(1);
      expect(await page.getByRole('button', { name: 'Contents' }).getAttribute('aria-expanded')).toBe('false');
      await page.evaluate(() => window.__docreaderHarness!.destroy());
      expect(await unchanged()).toBe(true);
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
