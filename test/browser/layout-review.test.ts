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

  const CELL = 'A long cell that runs over several lines of the table, so that the row is clipped until the reader opens it, and says enough to need it.';
  const COMPACT = (rows: number, extra = ''): string => `# Title

## 1. First

The decision D3 is the one to read.

## 2. Decisions

| ID | Decision | Why |
| --- | --- | --- |
${Array.from({ length: rows }, (_, i) => `| D${String(i + 1)} | ${CELL} ${CELL} ${i === 2 ? extra : ''} | ${CELL} |`).join('\n')}

## 3. Last

Text.
`;
  const openCompact = (width = 1280, touch?: boolean, options: Readonly<Record<string, unknown>> = {}, rows = 7, extra = '') =>
    openDoc(COMPACT(rows, extra), options, { browser, layout: 'review', viewport: { width, height: 900 }, ...(touch === undefined ? {} : { hasTouch: touch }) });

  it('clips long rows, opens one with its button, and all with Open all rows', async () => {
    const doc = await openCompact();
    try {
      const { page } = doc;
      await page.locator('tr.rv-clipped').first().waitFor();
      expect(await page.locator('tbody tr.rv-clipped').count()).toBe(7);
      const first = page.locator('tbody tr').first();
      const clipped = await first.locator('td .cc').nth(1).evaluate((el) => el.clientHeight);
      const rx = first.locator('button.rx');
      expect(await rx.isVisible()).toBe(true);
      await rx.focus();
      await page.keyboard.press('Enter');
      expect(await rx.getAttribute('aria-expanded')).toBe('true');
      expect(await first.locator('td .cc').nth(1).evaluate((el) => el.clientHeight)).toBeGreaterThan(clipped);
      await page.locator('button.rv-all').click();
      expect(await page.locator('tbody tr.rv-open').count()).toBe(7);
      await page.locator('button.rv-all').click();
      expect(await page.locator('tbody tr.rv-open').count()).toBe(0);
    } finally { await doc.close(); }
  });

  it('clips nothing on a phone, where rows stack as cards', async () => {
    const doc = await openCompact(412);
    try {
      await doc.page.locator('.table-wrapper.rv-compact').waitFor();
      expect(await doc.page.locator('tr.rv-clipped, .cc.over').count()).toBe(0);
      expect(await doc.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    } finally { await doc.close(); }
  });

  it('a relayout while the root is hidden leaves the clip marks and the buttons in place', async () => {
    const doc = await openCompact();
    try {
      const { page } = doc;
      await page.locator('tr.rv-clipped').first().waitFor();
      // The resize is debounced by a timer: a fake clock runs it, and the frame after it, at once.
      await page.clock.install();
      await page.evaluate(() => {
        (document.querySelector('main[data-harness-root]') as HTMLElement).style.display = 'none';
        window.dispatchEvent(new Event('resize'));
      });
      await page.clock.runFor(1000);
      await page.evaluate(() => { (document.querySelector('main[data-harness-root]') as HTMLElement).style.display = ''; });
      expect(await page.locator('tbody tr.rv-clipped').count()).toBe(7);
      expect(await page.locator('tbody tr.rv-clipped button.rx').first().isVisible()).toBe(true);
    } finally { await doc.close(); }
  });

  it('prints the whole row: no clip, no fade, no row button, no hint', async () => {
    const doc = await openCompact();
    try {
      const { page } = doc;
      await page.locator('tr.rv-clipped').first().waitFor();
      // The cell and its button are held before the media change: a relayout in print may take their marks off, and the rules must hold for the marked state.
      const clipped = await page.locator('tbody tr.rv-clipped td .cc.over').first().elementHandle();
      const button = await page.locator('tbody tr.rv-clipped button.rx').first().elementHandle();
      await page.emulateMedia({ media: 'print' });
      const got = await page.evaluate(([cell, rx]) => {
        const cc = getComputedStyle(cell as Element);
        const display = (e: Element | string): string => getComputedStyle(typeof e === 'string' ? (document.querySelector(e) as Element) : e).display;
        return { max: cc.maxHeight, mask: cc.maskImage === '' ? cc.webkitMaskImage : cc.maskImage, rx: display(rx as Element), hint: display('.rv-hint'), all: display('.rv-all') };
      }, [clipped, button] as const);
      expect(got.max).toBe('none');
      expect(got.mask).toBe('none');
      expect([got.rx, got.hint, got.all]).toEqual(['none', 'none', 'none']);
    } finally { await doc.close(); }
  });

  it('an open row has the surface for its ground, whatever the shared table rule says', async () => {
    const doc = await openCompact();
    try {
      const { page } = doc;
      await page.locator('tr.rv-clipped').first().waitFor();
      await page.locator('tbody tr button.rx').first().click();
      await page.mouse.move(2, 2);
      // The shared table rule fades a row's ground over a tenth of a second: read it once those transitions have finished.
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)).then(() => undefined));
      const got = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.style.background = 'var(--surface)';
        (document.querySelector('main[data-harness-root]') as HTMLElement).append(probe);
        const want = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return { want, open: getComputedStyle(document.querySelector('tbody tr.rv-open td') as Element).backgroundColor };
      });
      expect(got.open).toBe(got.want);
    } finally { await doc.close(); }
  });

  it('an open row keeps its button across a phone width and back, and a row closed after its clip was never measured is measured', async () => {
    const doc = await openCompact();
    try {
      const { page } = doc;
      await page.locator('tr.rv-clipped').first().waitFor();
      const first = page.locator('tbody tr').first();
      await first.locator('button.rx').click();
      await page.setViewportSize({ width: 412, height: 900 });
      await expect.poll(() => first.locator('button.rx').isVisible()).toBe(false);
      await page.setViewportSize({ width: 1280, height: 900 });
      await expect.poll(() => first.locator('button.rx').isVisible()).toBe(true);
      await first.locator('button.rx').click();
      expect(await first.evaluate((el) => el.classList.contains('rv-clipped'))).toBe(true);
      // Opened at a phone width (the button is hidden there, so by script), then widened: nothing marked it, and closing measures it.
      await page.setViewportSize({ width: 412, height: 900 });
      await expect.poll(() => page.locator('tr.rv-clipped').count()).toBe(0);
      await page.evaluate(() => (document.querySelector('button.rv-all') as HTMLElement).click());
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.evaluate(() => (document.querySelector('button.rv-all') as HTMLElement).click());
      await expect.poll(() => page.locator('tbody tr.rv-clipped').count()).toBe(7);
      expect(await page.locator('tbody tr.rv-clipped button.rx').first().isVisible()).toBe(true);
    } finally { await doc.close(); }
  });

  it('keeps the first cell clear of the 44 px row button under touch, and hides the hint and Open all on a phone', async () => {
    const touch = await openCompact(1280, true);
    try {
      await touch.page.locator('tr.rv-clipped').first().waitFor();
      expect(await touch.page.locator('tbody tr td:first-child').first().evaluate((el) => getComputedStyle(el).paddingLeft)).toBe('48px');
    } finally { await touch.close(); }
    const phone = await openCompact(412);
    try {
      await phone.page.locator('.table-wrapper.rv-compact').waitFor();
      expect(await phone.page.locator('.rv-hint').evaluate((el) => getComputedStyle(el).display)).toBe('none');
      expect(await phone.page.locator('.rv-all').evaluate((el) => getComputedStyle(el).display)).toBe('none');
    } finally { await phone.close(); }
  });

  it('the filter still matches text a clip hides, and a preview card still copies the cell', async () => {
    const doc = await openCompact(1280, undefined, {}, 12, 'zebra');
    try {
      const { page } = doc;
      await page.locator('.tbl-tools input').fill('zebra');
      expect(await page.locator('tbody tr:visible').count()).toBe(1);
      await page.locator('.tbl-tools input').fill('');
      const chip = page.locator('h2[id="1-first"] ~ p a.xref', { hasText: 'D3' }).first();
      await chip.focus();
      const card = page.locator('.xcard.open');
      await card.waitFor();
      expect(await card.innerText()).toContain('zebra');
      expect(await card.locator('button').count()).toBe(0);
    } finally { await doc.close(); }
  });

  it('the row button and Open all rows keep the 44 px touch floor and take the hosted control row under a fine pointer', async () => {
    const touch = await openCompact(1280, true, { appearance: { skin: { controlRow: '56px' } } });
    try {
      await touch.page.locator('tr.rv-clipped').first().waitFor();
      expect((await touch.page.locator('button.rv-all').boundingBox())!.height).toBe(44);
      expect((await touch.page.locator('tbody tr button.rx').first().boundingBox())!.height).toBe(44);
    } finally { await touch.close(); }
    for (const height of [40, 56]) {
      const fine = await openCompact(1280, false, { appearance: { skin: { controlRow: `${height}px` } } });
      try {
        await fine.page.locator('tr.rv-clipped').first().waitFor();
        expect((await fine.page.locator('button.rv-all').boundingBox())!.height, `controlRow ${height}px`).toBe(height);
        expect((await fine.page.locator('tbody tr button.rx').first().boundingBox())!.height, `row button ${height}px`).toBe(height);
      } finally { await fine.close(); }
    }
  });

  it('the rail\'s waiting link keeps its own border and padding against the shared rail\'s link rule', async () => {
    const doc = await open();
    try {
      const got = await doc.page.locator('.toc-contents > a.rv-wait').evaluate((el) => {
        const s = getComputedStyle(el);
        return { display: s.display, border: s.borderLeftWidth, pad: s.paddingLeft };
      });
      expect(got).toEqual({ display: 'flex', border: '1px', pad: '9px' });
    } finally { await doc.close(); }
  });

  it('the bar\'s Skip to the text link lands on the card\'s title', async () => {
    const doc = await open();
    try {
      const { page } = doc;
      await page.locator('a.skip-link').focus();
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => document.activeElement?.tagName === 'H1' && document.activeElement.closest('header.rv-card') !== null)).toBe(true);
    } finally { await doc.close(); }
  });

  it('n goes to the next unread section and the sheet lists it; the rail leads with a link to what waits and ends with the read count', async () => {
    const doc = await open();
    try {
      const { page } = doc;
      await page.keyboard.press('n');
      await expect.poll(() => page.locator('h2[id="1-first"].flash').count()).toBe(1);
      await page.locator('h2[id="1-first"] .h-mark').click();
      expect(await page.locator('.rv-foot-read').textContent()).toBe('1 of 3 read');
      await page.keyboard.press('?');
      expect(await page.locator('.keys.open').innerText()).toContain('Next unread section');
      await page.keyboard.press('Escape');
      const wait = page.locator('.toc-contents > a.rv-wait');
      expect(await wait.innerText()).toContain('Waiting on you');
      await wait.click();
      await expect.poll(() => page.locator('h3.flash').count()).toBe(1);
    } finally { await doc.close(); }
  });

  it('the card says nothing about changes until a mark has changed', async () => {
    const doc = await open();
    try {
      expect(await doc.page.locator('.rv-changed').evaluate((el) => getComputedStyle(el).display)).toBe('none');
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

  it('an ID in running text previews its row, takes a tint on hover, and its link goes to the row', async () => {
    const doc = await open();
    try {
      const { page } = doc;
      const chip = page.locator('h2[id="1-first"] ~ p a.xref', { hasText: 'D2' }).first();
      const tint = async (): Promise<string> => chip.evaluate((el) => getComputedStyle(el).backgroundColor);
      const rest = await tint();
      await chip.hover();
      expect(await tint(), 'a hover tint').not.toBe(rest);
      await page.mouse.move(2, 2);
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
      for (const row of [page.getByRole('tab', { name: 'Contents' }), page.locator('.toc-contents a.rv-wait'), page.locator('.toc-contents a').nth(1)]) {
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
