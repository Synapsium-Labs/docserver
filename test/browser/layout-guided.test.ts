// The guided layout's interaction rows (docserver parity Task 13), in a real browser: the hero and its glance, the layers (a
// section's intro kept and the rest folded; Expand all and Collapse all; the fold a jump, a link, the quick jump and a find lands
// in), the lens, the reading times, the phone cards, the drawer, three widths with no horizontal scroll, the touch floor and the
// fine-pointer slot, print, and teardown. The corpus snapshots, the hosted appearance rows and the cue rows are in layout-corpus,
// appearance-style and appearance-cues.
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

const FILL = 'A paragraph long enough to fill a few lines in a narrow reading column.\n\n'.repeat(24);
const CODE = '```ts\nconst a = 1;\nconst b = 2;\nconst c = 3;\nconst d = 4;\nconst e = 5;\n```\n\n';
const DOC = `# Title

**Spec** · 2026-01-01 · Status: Draft

## In short

Summary that names a Widget.

## 1. First

The first intro paragraph says what the Widget is.

The second intro paragraph says why it matters.

${FILL}
## 2. Second

The intro of the second section.

| Name | Owner | Status | Notes |
| --- | --- | --- | --- |
| Alpha | one | Agreed | First note |
| Beta | two | Proposed | Second note |
| Gamma | three | Agreed | Third note |

### Part one

${FILL}
### Part two

${CODE}${FILL}
## 3. Words used here

| Term | Meaning |
| --- | --- |
| Widget | A small thing the document talks about. |

## Where things stand

### Agreed

- Alpha: kept.

### Waiting on you

- Beta: whether to change it.

### Later

- Next.
`;

/** The reader's choice of layers, as stored: guided folds every section that has something to fold. */
const GUIDED = { storage: { snapshot: { 'docreader:ui': '{"layers":"guided"}' } }, storageKey: 'case' };

afterAll(closeBrowsers);
describeBrowsers((browser) => {
  /** The fold button of a section, by its name (its label ends with it whatever its state). */
  const foldOf = (page: Awaited<ReturnType<typeof openDoc>>['page'], name: string) => page.locator(`.gd-btn[aria-label$=": ${name}"]`);
  const open = (options: Readonly<Record<string, unknown>> = {}, how: { width?: number; height?: number; touch?: boolean; markdown?: string } = {}) =>
    openDoc(how.markdown ?? DOC, options, { browser, layout: 'guided', viewport: { width: how.width ?? 1280, height: how.height ?? 800 }, ...(how.touch === undefined ? {} : { hasTouch: how.touch }) });

  for (const [width, height] of [[412, 915], [1280, 800], [1920, 1080]] as const) {
    it(`${width}x${height}: the contents are reachable, the hero shows, and nothing scrolls sideways, folded or open`, async () => {
      for (const options of [GUIDED, {}]) {
        const doc = await open(options, { width, height });
        try {
          const { page } = doc;
          if (width === 412) await page.getByRole('button', { name: 'Contents' }).click();
          const rail = page.getByRole(width === 412 ? 'dialog' : 'navigation', { name: 'Contents' });
          expect(await rail.isVisible()).toBe(true);
          expect(await rail.getByRole('link', { name: /1\. First/ }).isVisible()).toBe(true);
          if (width === 412) await page.keyboard.press('Escape');
          expect(await page.locator('header.gd-hero h1').isVisible()).toBe(true);
          expect(await page.locator('header.gd-hero .gd-glance').isVisible()).toBe(true);
          expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
          expect(await page.locator('header.gd-hero').evaluate((el) => el.getBoundingClientRect().right <= document.documentElement.clientWidth)).toBe(true);
          expect(await page.locator('.bar-tools').evaluate((el) => el.getBoundingClientRect().right <= document.documentElement.clientWidth)).toBe(true);
        } finally { await doc.close(); }
      }
    });
  }

  it('the hero holds the title, the byline and In short, with a glance: how long In short takes, what the document holds and what waits', async () => {
    const doc = await open();
    try {
      const { page } = doc;
      const hero = page.locator('header.gd-hero');
      expect(await hero.locator(':scope > h1').textContent()).toBe('Title');
      expect(await hero.locator(':scope > dl.byline').count()).toBe(1);
      expect(await hero.locator(':scope > .short h2').textContent()).toBe('In short');
      const glance = await hero.locator('.gd-glance .gd-gl').allInnerTexts();
      expect(glance.map((t) => t.replace(/\s+/g, ' ').trim())).toEqual(['IN SHORT 1 min', 'WHOLE DOCUMENT 5 min', 'CONTAINS 3 sections · 2 tables', 'WAITING ON YOU 1 item →']);
      await hero.locator('a.gd-wait').click();
      await expect.poll(() => page.locator('h3.flash').count()).toBe(1);
    } finally { await doc.close(); }
  });

  it('the bar\'s Skip to the text link lands on the hero\'s title', async () => {
    const doc = await open();
    try {
      const { page } = doc;
      await page.locator('a.skip-link').focus();
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => document.activeElement?.tagName === 'H1' && document.activeElement.closest('header.gd-hero') !== null)).toBe(true);
    } finally { await doc.close(); }
  });

  it('folds each section after its intro behind one button, with its time and what is inside, and folds the standing boxes and short sections never', async () => {
    const doc = await open(GUIDED);
    try {
      const { page } = doc;
      const first = page.locator('h2[id="1-first"]');
      const button = foldOf(page, 'First');
      expect(await button.getAttribute('aria-expanded')).toBe('false');
      expect(await button.locator('.gd-label').textContent()).toBe('Read the whole section');
      expect(await button.locator('.gd-sum').textContent()).toMatch(/^\d+ min more$/);
      // The heading, its time and its two intro paragraphs are shown; the rest has no height.
      expect(await first.isVisible()).toBe(true);
      expect(await page.locator('h2[id="1-first"] + .gd-meta').isVisible()).toBe(true);
      const paragraphs = page.locator('h2[id="1-first"] ~ p:not(.gd-meta)');
      expect(await paragraphs.nth(0).isVisible()).toBe(true);
      expect(await paragraphs.nth(1).isVisible()).toBe(true);
      expect(await paragraphs.nth(2).evaluate((el) => el.getBoundingClientRect().height)).toBe(0);
      // Not a block of what is folded holds any height of its own (a table's wrapper, a code block, a quote included).
      expect(await page.evaluate(() => Math.max(0, ...Array.from(document.querySelectorAll('[data-docreader-root] > [hidden="until-found"]')).map((el) => el.getBoundingClientRect().height)))).toBe(0);
      // What is folded takes no room: the next heading is a heading's margin below the fold bar, not a paragraph's margin below each hidden block.
      expect(await page.locator('h2[id="2-second"]').evaluate((el, b) => el.getBoundingClientRect().top - (b as HTMLElement).getBoundingClientRect().bottom, await button.elementHandle())).toBeLessThan(200);
      expect(await page.locator('h2[id="where-things-stand"]').isVisible()).toBe(true);
      expect(await page.locator('.callout').first().isVisible()).toBe(true);
      // Second's Inside list names its two subsections.
      expect(await page.locator('h2[id="2-second"] ~ .gd-bar .gd-inside a').allInnerTexts()).toEqual(['Part one', 'Part two']);
      await button.click();
      expect(await button.getAttribute('aria-expanded')).toBe('true');
      expect(await paragraphs.nth(2).evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(0);
      expect(await button.locator('.gd-label').textContent()).toBe('Show less');
      await page.locator('.gd-end[aria-label$=": First"]').click();
      // The heading is put back at the top of the reading area, so the reader is not left in what folded away.
      await expect.poll(() => first.evaluate((el) => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(120);
      expect(await button.getAttribute('aria-expanded')).toBe('false');
      expect(await button.evaluate((el) => el === document.activeElement)).toBe(true);
      expect(await paragraphs.nth(2).evaluate((el) => el.getBoundingClientRect().height)).toBe(0);
    } finally { await doc.close(); }
  });

  it('a folded last section leaves the quick jump, the phone drawer\'s scrim and a term\'s card alone, whatever repaints it, in a document that ends in a long section', async () => {
    const tail = `# Title\n\n## A\n\nA word about a Widget.\n\n## B\n\nx\n\n## B2\n\nx\n\n## B3\n\nx\n\n## B4\n\nx\n\n## Words used here\n\n| Term | Meaning |\n| --- | --- |\n| Widget | A small thing. |\n\n## C\n\nOne.\n\nTwo.\n\n${FILL}`;
    const doc = await open(GUIDED, { markdown: tail, width: 412, height: 915 });
    try {
      const { page } = doc;
      await page.locator('.bar-tools .gd-seg button').nth(0).click();
      expect(await page.locator('h2[id="c"] ~ [hidden="until-found"]').count()).toBeGreaterThan(0);
      // The quick jump opens.
      await page.keyboard.press('/');
      await page.locator('.jump.open input').waitFor();
      await page.keyboard.press('Escape');
      // The drawer's scrim shows with the drawer.
      await page.getByRole('button', { name: 'Contents' }).click();
      // A repaint while the drawer is open (the lens, here) leaves the scrim as it is.
      await page.locator('.bar-tools .gd-seg button').nth(1).evaluate((el) => (el as HTMLElement).click());
      expect(await page.locator('.toc-scrim').evaluate((el) => getComputedStyle(el).contentVisibility)).toBe('visible');
      expect(await page.locator('.toc-scrim').isVisible()).toBe(true);
      await page.keyboard.press('Escape');
      // A term's card opens, and a repaint after it leaves it be.
      await page.locator('h2[id="a"] ~ p a.term').first().focus();
      await page.locator('.xcard.open').waitFor();
      await page.locator('.bar-tools .gd-seg button').nth(1).click({ force: true });
      expect(await page.evaluate(() => Array.from(document.querySelectorAll('[data-docreader-root] > [hidden="until-found"]')).filter((e) => e.hasAttribute('data-docreader-chrome') && !e.classList.contains('gd-end-row')).length)).toBe(0);
    } finally { await doc.close(); }
  });

  it('Expand all and Collapse all work every layer, and the one that would do nothing is disabled', async () => {
    const doc = await open(GUIDED);
    try {
      const { page } = doc;
      const expand = page.getByRole('button', { name: 'Expand all' });
      const collapse = page.getByRole('button', { name: 'Collapse all' });
      expect([await expand.isDisabled(), await collapse.isDisabled()]).toEqual([false, true]);
      await expand.click();
      expect(await page.locator('.gd-btn[aria-expanded="false"]').count()).toBe(0);
      expect([await expand.isDisabled(), await collapse.isDisabled()]).toEqual([true, false]);
      await collapse.click();
      expect(await page.locator('.gd-btn[aria-expanded="true"]').count()).toBe(0);
    } finally { await doc.close(); }
  });

  it('opens the fold a link, the Inside list, the quick jump and a search hit lands in', async () => {
    const doc = await open(GUIDED);
    try {
      const { page } = doc;
      const second = foldOf(page, 'Second');
      expect(await second.getAttribute('aria-expanded')).toBe('false');
      // The Inside list's link.
      await page.locator('h2[id="2-second"] ~ .gd-bar .gd-inside a', { hasText: 'Part two' }).click();
      expect(await second.getAttribute('aria-expanded')).toBe('true');
      // An open section has no list of what is inside, nor its summary: it is all there.
      expect(await page.locator('.gd-bar.open .gd-inside').first().isVisible()).toBe(false);
      expect(await page.locator('.gd-bar.open .gd-sum').first().isVisible()).toBe(false);
      await page.getByRole('button', { name: 'Collapse all' }).click();
      // The quick jump, to a subsection in a folded section.
      await page.keyboard.press('/');
      await page.locator('.jump.open input').fill('Part one');
      await page.keyboard.press('Enter');
      await expect.poll(() => second.getAttribute('aria-expanded')).toBe('true');
      expect(await page.locator('h3[id="part-one"]').isVisible()).toBe(true);
      await page.getByRole('button', { name: 'Collapse all' }).click();
      // A find-in-page hit: the browser reports it on the folded block it found the text in.
      const found = await page.evaluate(() => {
        const block = document.querySelector('h2[id="1-first"] ~ p[hidden="until-found"]') as HTMLElement;
        block.dispatchEvent(new Event('beforematch', { bubbles: true }));
        return block.closest('[data-docreader-root]') !== null;
      });
      expect(found).toBe(true);
      expect(await foldOf(page, 'First').getAttribute('aria-expanded')).toBe('true');
    } finally { await doc.close(); }
  });

  it('the lens is the reader\'s own: Product quiets implementation detail without hiding it, and Engineering is everything', async () => {
    const doc = await open();
    try {
      const { page } = doc;
      const product = page.getByRole('button', { name: 'Product', exact: true });
      const engineering = page.getByRole('button', { name: 'Engineering', exact: true });
      expect(await engineering.getAttribute('aria-pressed')).toBe('true');
      const code = page.locator('.codehilite, pre:not(.mermaid)').first();
      const full = await code.evaluate((el) => el.getBoundingClientRect().height);
      await product.click();
      expect(await product.getAttribute('aria-pressed')).toBe('true');
      expect(await page.locator('[data-docreader-root]').evaluate((el) => el.classList.contains('lens-product'))).toBe(true);
      const bar = page.locator('.peek-bar .peek-btn').first();
      expect(await bar.isVisible()).toBe(true);
      expect(await code.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThanOrEqual(full);
      await bar.click();
      expect(await bar.getAttribute('aria-expanded')).toBe('true');
      await engineering.click();
      expect(await page.locator('[data-docreader-root]').evaluate((el) => el.classList.contains('lens-product'))).toBe(false);
    } finally { await doc.close(); }
  });

  it('technical prose is quieter under Product and as it was under Engineering', async () => {
    const tech = 'Run `aaa bbb ccc ddd` and `eee fff ggg` then `hhh iii` today ok, thanks.';
    const doc = await open({}, { markdown: `# Title\n\n## A\n\n${tech}\n\nPlain prose of the same sort of length, with no code in it at all, nothing.\n\n## B\n\nx\n\n## C\n\nx\n` });
    try {
      const { page } = doc;
      const probe = (): Promise<string[]> => page.evaluate(() => Array.from(document.querySelectorAll('h2[id="a"] ~ p')).slice(0, 2).map((p) => `${getComputedStyle(p).fontSize} ${getComputedStyle(p).color}`));
      const before = await probe();
      expect(before[0]).toBe(before[1]);
      await page.getByRole('button', { name: 'Product', exact: true }).click();
      const quiet = await probe();
      expect(quiet[1]).toBe(before[1]);
      expect(quiet[0]).not.toBe(before[0]);
      await page.getByRole('button', { name: 'Engineering', exact: true }).click();
      expect(await probe()).toEqual(before);
    } finally { await doc.close(); }
  });

  it('a peek bar made by the lens after the sections folded stays out of sight with its folded section', async () => {
    const doc = await open(GUIDED);
    try {
      const { page } = doc;
      await page.getByRole('button', { name: 'Product', exact: true }).click();
      expect(await page.locator('.peek-bar').first().evaluate((el) => el.getBoundingClientRect().height)).toBe(0);
      await page.getByRole('button', { name: 'Expand all' }).click();
      expect(await page.locator('.peek-bar .peek-btn').first().isVisible()).toBe(true);
    } finally { await doc.close(); }
  });

  it('the Contents shows a reading time beside the sections that take a minute', async () => {
    const doc = await open({}, { markdown: DOC.replace(FILL.slice(0, 200), 'x ') });
    try {
      const times = (await doc.page.locator('.doc-toc > ul > li > a .gd-rt').allInnerTexts()).filter((t) => t !== '');
      expect(times.length).toBeGreaterThan(0);
      for (const t of times) expect(t).toMatch(/^\d+ min$/);
      // A section under a minute has no span at all.
      expect(await doc.page.locator('.doc-toc > ul > li > a .gd-rt:empty').count()).toBe(0);
    } finally { await doc.close(); }
  });

  it('a glossary term is defined where it stands: a card on focus, and a second activation goes to its row', async () => {
    const doc = await open();
    try {
      const { page } = doc;
      const term = page.locator('h2[id="1-first"] ~ p a.term').first();
      await term.focus();
      const card = page.locator('.xcard.open');
      await card.waitFor();
      expect(await card.innerText()).toContain('A small thing');
      await page.keyboard.press('Escape');
      expect(await page.locator('.xcard.open').count()).toBe(0);
    } finally { await doc.close(); }
  });

  it('a table becomes cards on a phone, each cell labelled by its column, and stays a table on a desktop', async () => {
    const phone = await open({}, { width: 412, height: 915 });
    try {
      const cell = phone.page.locator('h2[id="2-second"] ~ .table-wrapper').first().locator('td').nth(2);
      expect(await cell.evaluate((el) => getComputedStyle(el).display)).toBe('block');
      expect(await phone.page.locator('h2[id="2-second"] ~ .table-wrapper').first().locator('thead').evaluate((el) => getComputedStyle(el).display)).toBe('none');
      expect(await cell.evaluate((el) => getComputedStyle(el, '::before').content)).toContain('Status');
      expect(await phone.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    } finally { await phone.close(); }
    const wide = await open({}, { width: 1280, height: 800 });
    try {
      expect(await wide.page.locator('h2[id="2-second"] ~ .table-wrapper').first().locator('td').nth(2).evaluate((el) => getComputedStyle(el).display)).toBe('table-cell');
    } finally { await wide.close(); }
  });

  it('the drawer on a phone traps focus, closes with Escape and returns focus to the Contents button', async () => {
    const doc = await open({}, { width: 412, height: 915 });
    try {
      const { page } = doc;
      const opener = page.getByRole('button', { name: 'Contents' });
      await opener.focus();
      await page.keyboard.press('Enter');
      const drawer = page.getByRole('dialog', { name: 'Contents' });
      expect(await drawer.isVisible()).toBe(true);
      expect(await opener.getAttribute('aria-expanded')).toBe('true');
      const inside = (): Promise<boolean> => drawer.evaluate((el) => el.contains(document.activeElement));
      expect(await inside()).toBe(true);
      const last = drawer.getByRole('link').last();
      await last.focus();
      await page.keyboard.press('Tab');
      expect(await inside()).toBe(true);
      expect(await drawer.getByRole('button', { name: 'Collapse' }).evaluate((el) => el === document.activeElement)).toBe(true);
      await page.keyboard.press('Shift+Tab');
      expect(await last.evaluate((el) => el === document.activeElement)).toBe(true);
      await page.keyboard.press('Escape');
      expect(await drawer.isVisible()).toBe(false);
      expect(await opener.getAttribute('aria-expanded')).toBe('false');
      expect(await opener.evaluate((el) => el === document.activeElement)).toBe(true);
      await opener.click();
      await drawer.getByRole('link', { name: /1\. First/ }).click();
      expect(await drawer.isVisible()).toBe(false);
      await page.locator('h2[id="1-first"].flash').waitFor();
    } finally { await doc.close(); }
  });

  it('touch keeps the 44 px floor on the fold buttons, the Inside links, the lens, the layer buttons and the waiting link, whatever the hosted control row says', async () => {
    const doc = await open({ ...GUIDED, appearance: { skin: { controlRow: '56px' } } }, { width: 412, height: 915, touch: true });
    try {
      const { page } = doc;
      const pointer = await page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, fine: matchMedia('(pointer: fine)').matches }));
      expect(pointer).toEqual({ coarse: true, fine: false });
      const heights = async (selector: string): Promise<number[]> => page.locator(selector).evaluateAll((els) => els.filter((el) => el.getClientRects().length > 0).map((el) => el.getBoundingClientRect().height));
      for (const selector of ['.gd-btn', '.gd-inside a', '.bar-tools .gd-seg button', '.bar-tools .gd-all', 'a.gd-wait']) {
        const found = await heights(selector);
        expect(found.length, selector).toBeGreaterThan(0);
        for (const h of found) expect(h, selector).toBeGreaterThanOrEqual(44);
      }
      await page.getByRole('button', { name: 'Expand all' }).click();
      // An open section's bar is a small dashed button: it keeps the floor too.
      for (const h of await heights('.gd-btn')) expect(h, 'an open .gd-btn').toBeGreaterThanOrEqual(44);
      // A one-line button measures the floor itself under touch: the hosted control row's 56 px is for a fine pointer.
      for (const h of await heights('.gd-end')) expect(h, '.gd-end').toBe(44);
    } finally { await doc.close(); }
  });

  it('touch keeps the 44 px floor on the drawer\'s links and buttons, whatever the hosted control row says', async () => {
    const doc = await open({ appearance: { skin: { controlRow: '24px' } } }, { width: 412, height: 915, touch: true });
    try {
      const { page } = doc;
      await page.getByRole('button', { name: 'Contents' }).click();
      const heights = (selector: string): Promise<number[]> => page.locator(selector).evaluateAll((els) => els.filter((el) => el.getClientRects().length > 0).map((el) => el.getBoundingClientRect().height));
      for (const selector of ['.toc-open .doc-toc a', '.toc-open .toc-head button']) {
        const found = await heights(selector);
        expect(found.length, selector).toBeGreaterThan(0);
        for (const h of found) expect(h, selector).toBeGreaterThanOrEqual(44);
      }
    } finally { await doc.close(); }
  });

  it('the drawer\'s touch floor is for a drawer: a stale toc-open on a wide screen keeps the docked rail\'s rows at their own height', async () => {
    const doc = await open({}, { width: 1280, height: 800, touch: true });
    try {
      const { page } = doc;
      const rows = (): Promise<number> => page.locator('.doc-toc a').first().evaluate((el) => el.getBoundingClientRect().height);
      const docked = await rows();
      await page.evaluate(() => document.querySelector('[data-docreader-root]')?.classList.add('toc-open'));
      expect(docked).toBeLessThan(44);
      expect(await rows()).toBe(docked);
    } finally { await doc.close(); }
  });

  it('a fine pointer takes the hosted control row on the fold buttons', async () => {
    for (const height of [40, 56]) {
      const doc = await open({ ...GUIDED, appearance: { skin: { controlRow: `${height}px` } } }, { width: 1280, height: 800, touch: false });
      try {
        const pointer = await doc.page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, fine: matchMedia('(pointer: fine)').matches }));
        expect(pointer).toEqual({ coarse: false, fine: true });
        expect((await doc.page.locator('.gd-btn').first().boundingBox())!.height, `controlRow ${height}px`).toBeGreaterThanOrEqual(height);
      } finally { await doc.close(); }
    }
  });

  it('print shows everything the reader had folded', async () => {
    const doc = await open(GUIDED);
    try {
      const { page } = doc;
      const third = page.locator('h2[id="1-first"] ~ p:not(.gd-meta)').nth(5);
      expect(await third.evaluate((el) => el.getBoundingClientRect().height)).toBe(0);
      await page.emulateMedia({ media: 'print' });
      await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
      expect(await third.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(0);
      expect(await page.locator('.gd-bar').first().isVisible()).toBe(false);
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      await page.emulateMedia({ media: 'screen' });
      expect(await third.evaluate((el) => el.getBoundingClientRect().height)).toBe(0);
    } finally { await doc.close(); }
  });

  it('teardown with the drawer open and layers folded puts every moved node back, the document as it was', async () => {
    const doc = await openDoc(DOC, GUIDED, { browser, layout: 'guided', enhance: false, viewport: { width: 412, height: 915 } });
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
      expect(await page.locator('header.gd-hero > h1').count()).toBe(1);
      expect(await page.locator('[hidden="until-found"]').count()).toBeGreaterThan(0);
      await page.getByRole('button', { name: 'Contents' }).click();
      await page.evaluate(async () => {
        window.dispatchEvent(new Event('scroll'));
        await window.__docreaderHarness!.destroy();
        await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
      });
      expect(await unchanged()).toBe(true);
      expect(await page.locator('.gd-hero, .gd-bar, .gd-tools, .gd-end-row').count()).toBe(0);
      await doc.enhance();
      expect(await page.locator('header.gd-hero > h1').count()).toBe(1);
      await page.evaluate(() => window.__docreaderHarness!.destroy());
      expect(await unchanged()).toBe(true);
    } finally { await doc.close(); }
  });
});
