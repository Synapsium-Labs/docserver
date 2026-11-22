// The review layout's interaction rows (docserver parity Task 12), in a real browser: the header card and its progress, the bar's
// mark toggle, the rail's two tabs and its drawer, the ID chips and their preview, the keys, three widths with no horizontal
// scroll, the touch floor and the fine-pointer slot, and teardown with work still queued. The corpus snapshots, the hosted
// appearance rows and the cue rows are in layout-corpus, appearance-style and appearance-cues.
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const FILL = 'A paragraph long enough to fill a few lines in a narrow reading column.\n\n'.repeat(24);
const DOC = `# Title

**Spec** · 2026-01-01 · Status: Draft

## In short

Summary that cites D1.

## 1. First

Text that cites D2 and then D1.

${FILL}
## 2. Second

| ID | Decision | Status |
| --- | --- | --- |
| D1 | Keep the card | Agreed |
| D2 | Change the rail | Proposed |

${FILL}
## Where things stand

### Agreed

- D1: kept.

### Waiting on you

- D2: whether to change the rail.

### Later

- Next.
`;

afterAll(closeBrowsers);
describeBrowsers((browser) => {
  const open = (options: Readonly<Record<string, unknown>> = {}, how: { width?: number; height?: number; touch?: boolean } = {}) =>
    openDoc(DOC, options, { browser, layout: 'review', viewport: { width: how.width ?? 1280, height: how.height ?? 800 }, ...(how.touch === undefined ? {} : { hasTouch: how.touch }) });

  for (const [width, height] of [[412, 915], [1280, 800], [1920, 1080]] as const) {
    it(`${width}x${height}: the contents are reachable, the card shows, and nothing scrolls sideways`, async () => {
      const doc = await open({}, { width, height });
      try {
        const { page } = doc;
        if (width === 412) await page.getByRole('button', { name: 'Contents' }).click();
        const rail = page.getByRole(width === 412 ? 'dialog' : 'navigation', { name: 'Contents and index' });
        expect(await rail.isVisible()).toBe(true);
        expect(await rail.getByRole('link', { name: 'First', exact: true }).isVisible()).toBe(true);
        if (width === 412) await page.keyboard.press('Escape');
        expect(await page.locator('header.rv-card h1').isVisible()).toBe(true);
        expect(await page.locator('header.rv-card .rv-read').isVisible()).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
        expect(await page.locator('header.rv-card').evaluate((el) => el.getBoundingClientRect().right <= document.documentElement.clientWidth)).toBe(true);
      } finally { await doc.close(); }
    });
  }

  it('the header card holds the title, the byline and the strip, and counts the reader\'s sections', async () => {
    const doc = await open();
    try {
      const { page } = doc;
      const card = page.locator('header.rv-card');
      expect(await card.locator(':scope > h1').textContent()).toBe('Title');
      expect(await card.locator(':scope > dl.byline').count()).toBe(1);
      expect(await card.locator(':scope > section.review-strip').count()).toBe(1);
      expect(await card.locator('.rv-n').textContent()).toBe('0');
      expect(await card.locator('.rv-of').textContent()).toBe(' of 3 read');
      expect(await card.locator('.rv-next').textContent()).toBe('Start reading');
      await card.locator('.rv-next').click();
      await expect.poll(() => page.locator('h2[id="1-first"].flash').count()).toBe(1);
      await page.locator('h2[id="1-first"] .h-mark').click();
      expect(await card.locator('.rv-n').textContent()).toBe('1');
      expect(await card.locator('.rv-next').textContent()).toBe('Next unread: 2. Second');
      expect(await card.locator('.rv-bar > i').evaluate((el) => (el as HTMLElement).style.width)).toBe('33%');
      await card.locator('.rv-next').click();
      await expect.poll(() => page.locator('h2[id="2-second"].flash').count()).toBe(1);
    } finally { await doc.close(); }
  });

  it('a document with front matter keeps its eyebrow and facts panel in the card', async () => {
    const doc = await openDoc(`---\ntype: spec\narea: reading\nstatus: draft\ntags: [one, two]\n---\n\n${DOC}`, {}, { browser, layout: 'review' });
    try {
      const card = doc.page.locator('header.rv-card');
      expect(await card.locator(':scope > .eyebrow + h1').count()).toBe(1);
      expect(await card.locator(':scope > details.doc-facts').count()).toBe(1);
      expect(await doc.page.locator('[data-docreader-root] > .eyebrow').count()).toBe(0);
    } finally { await doc.close(); }
  });

  it('the bar names the section being read and its toggle marks it read and unread, with the card and the rail in step', async () => {
    const doc = await open();
    try {
      const { page } = doc;
      const toggle = page.locator('.bar-tools button.rv-mark');
      expect(await toggle.isDisabled()).toBe(true);
      await page.locator('h2[id="1-first"]').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 120));
      await expect.poll(() => toggle.isDisabled()).toBe(false);
      expect(await toggle.getAttribute('aria-label')).toBe('Mark read: 1. First');
      expect(await toggle.textContent()).toBe('○ Mark read');
      expect(await page.locator('.running-head').textContent()).toContain('First');
      await toggle.click();
      await expect.poll(() => toggle.getAttribute('aria-pressed')).toBe('true');
      expect(await toggle.getAttribute('aria-label')).toBe('Mark unread: 1. First');
      expect(await page.locator('header.rv-card .rv-n').textContent()).toBe('1');
      expect(await page.locator('.toc-contents a[href="#1-first"]').getAttribute('aria-description')).toBe('read');
      await page.keyboard.press('m');
      await expect.poll(() => toggle.getAttribute('aria-pressed')).toBe('false');
      expect(await page.locator('header.rv-card .rv-n').textContent()).toBe('0');
    } finally { await doc.close(); }
  });

  it('the rail has Contents and Index tabs: the Index lists the defined IDs, the arrows and the i key move between them', async () => {
    const doc = await open();
    try {
      const { page } = doc;
      const contents = page.getByRole('tab', { name: 'Contents' });
      const index = page.getByRole('tab', { name: 'Index' });
      expect(await contents.getAttribute('aria-selected')).toBe('true');
      expect(await page.locator('.toc-index').isVisible()).toBe(false);
      await contents.focus();
      await page.keyboard.press('ArrowRight');
      expect(await index.getAttribute('aria-selected')).toBe('true');
      expect(await page.locator('.toc-index').isVisible()).toBe(true);
      expect(await page.locator('.toc-index').innerText()).toContain('Keep the card');
      await page.keyboard.press('ArrowLeft');
      expect(await contents.getAttribute('aria-selected')).toBe('true');
      await page.locator('body').click({ position: { x: 2, y: 2 } });
      await page.keyboard.press('i');
      expect(await index.getAttribute('aria-selected')).toBe('true');
    } finally { await doc.close(); }
  });

  it('an ID in running text is a chip that previews its row, and its link goes to the row', async () => {
    const doc = await open();
    try {
      const { page } = doc;
      const chip = page.locator('h2[id="1-first"] ~ p a.xref', { hasText: 'D2' }).first();
      const shape = await chip.evaluate((el) => {
        const s = getComputedStyle(el);
        return { border: s.borderTopWidth, radius: parseFloat(s.borderTopLeftRadius) > 8, decoration: s.textDecorationLine };
      });
      expect(shape).toEqual({ border: '1px', radius: true, decoration: 'none' });
      await chip.focus();
      const card = page.locator('.xcard.open');
      await card.waitFor();
      expect(await card.innerText()).toContain('Change the rail');
      await page.keyboard.press('Escape');
      expect(await page.locator('.xcard.open').count()).toBe(0);
      await chip.click();
      await expect.poll(() => page.locator('tr.flash, [id].flash').count()).toBeGreaterThan(0);
    } finally { await doc.close(); }
  });

  it('keeps the reader\'s keys: / and Ctrl+K search, ? lists the keys, and w goes to what waits', async () => {
    const doc = await open();
    try {
      const { page } = doc;
      await page.keyboard.press('/');
      await page.locator('.jump.open input').waitFor();
      await page.locator('.jump input').fill('Second');
      expect(await page.locator('.jump li.sel').innerText()).toContain('Second');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Control+k');
      await page.locator('.jump.open input').waitFor();
      await page.keyboard.press('Escape');
      await page.keyboard.press('?');
      const keys = page.locator('.keys.open');
      await keys.waitFor();
      const text = await keys.innerText();
      for (const label of ['Jump to a section, ID or figure', 'What is waiting on you', 'Open index']) expect(text).toContain(label);
      await page.keyboard.press('Escape');
      await page.keyboard.press('w');
      await expect.poll(() => page.locator('.callout.waiting h3.flash, h3.flash').count()).toBeGreaterThan(0);
    } finally { await doc.close(); }
  });

  it('the drawer on a phone traps focus, closes with Escape and returns focus to the Contents button', async () => {
    const doc = await open({}, { width: 412, height: 915 });
    try {
      const { page } = doc;
      const opener = page.getByRole('button', { name: 'Contents' });
      await opener.focus();
      await page.keyboard.press('Enter');
      const drawer = page.getByRole('dialog', { name: 'Contents and index' });
      expect(await drawer.isVisible()).toBe(true);
      expect(await opener.getAttribute('aria-expanded')).toBe('true');
      const inside = (): Promise<boolean> => drawer.evaluate((el) => el.contains(document.activeElement));
      expect(await inside()).toBe(true);
      const keysButton = drawer.getByRole('button', { name: 'Keys' });
      await keysButton.focus();
      await page.keyboard.press('Tab');
      expect(await inside()).toBe(true);
      expect(await drawer.getByRole('tab', { name: 'Contents' }).evaluate((el) => el === document.activeElement)).toBe(true);
      await page.keyboard.press('Shift+Tab');
      expect(await keysButton.evaluate((el) => el === document.activeElement)).toBe(true);
      await page.keyboard.press('Escape');
      expect(await drawer.isVisible()).toBe(false);
      expect(await opener.getAttribute('aria-expanded')).toBe('false');
      expect(await opener.evaluate((el) => el === document.activeElement)).toBe(true);
      await opener.click();
      await drawer.getByRole('link', { name: 'First', exact: true }).click();
      expect(await drawer.isVisible()).toBe(false);
      await page.locator('h2[id="1-first"].flash').waitFor();
    } finally { await doc.close(); }
  });

  it('touch keeps the 44 px floor on the card button, the bar toggle and the drawer\'s rows, whatever the hosted control row says', async () => {
    const doc = await open({ appearance: { skin: { controlRow: '56px' } } }, { width: 412, height: 915, touch: true });
    try {
      const { page } = doc;
      const pointer = await page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, fine: matchMedia('(pointer: fine)').matches }));
      expect(pointer).toEqual({ coarse: true, fine: false });
      expect((await page.locator('.rv-next').boundingBox())!.height, 'the card button').toBe(44);
      expect((await page.locator('.bar-tools .rv-mark').boundingBox())!.height, 'the bar toggle').toBeGreaterThanOrEqual(44);
      await page.getByRole('button', { name: 'Contents' }).click();
      for (const row of [page.getByRole('tab', { name: 'Contents' }), page.locator('.toc-contents a').first()]) {
        expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await page.getByRole('tab', { name: 'Index' }).click();
      expect((await page.locator('.toc-index a.ix').first().boundingBox())!.height, 'an Index row').toBeGreaterThanOrEqual(44);
    } finally { await doc.close(); }
  });

  it('a fine pointer takes the hosted control row on the card button', async () => {
    for (const height of [40, 56]) {
      const doc = await open({ appearance: { skin: { controlRow: `${height}px` } } }, { width: 1280, height: 800, touch: false });
      try {
        const pointer = await doc.page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, fine: matchMedia('(pointer: fine)').matches }));
        expect(pointer).toEqual({ coarse: false, fine: true });
        expect((await doc.page.locator('.rv-next').boundingBox())!.height, `controlRow ${height}px`).toBe(height);
      } finally { await doc.close(); }
    }
  });

  it('teardown with the drawer open and work queued puts every moved node back, the document as it was', async () => {
    const doc = await openDoc(DOC, {}, { browser, layout: 'review', enhance: false, viewport: { width: 412, height: 915 } });
    try {
      const { page } = doc;
      const original = await page.evaluateHandle(() => {
        const root = window.__docreaderHarness!.root;
        return { markup: root.outerHTML, nodes: Array.from(root.querySelectorAll('*')), title: root.querySelector('h1') };
      });
      const unchanged = () => page.evaluate(({ markup, nodes, title }) => {
        const root = window.__docreaderHarness!.root;
        const current = Array.from(root.querySelectorAll('*'));
        return root.outerHTML === markup && current.length === nodes.length && current.every((el, i) => el === nodes[i]) && root.querySelector('h1') === title && title?.parentElement === root;
      }, original);
      await doc.enhance();
      expect(await page.locator('header.rv-card > h1').count()).toBe(1);
      await page.getByRole('button', { name: 'Contents' }).click();
      await page.evaluate(async () => {
        window.dispatchEvent(new Event('scroll'));
        await window.__docreaderHarness!.destroy();
        await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
      });
      expect(await unchanged()).toBe(true);
      expect(await page.locator('.rv-card, .rv-mark, .rv-read').count()).toBe(0);
      await doc.enhance();
      expect(await page.locator('header.rv-card > h1').count()).toBe(1);
      await page.evaluate(() => window.__docreaderHarness!.destroy());
      expect(await unchanged()).toBe(true);
    } finally { await doc.close(); }
  });
});
