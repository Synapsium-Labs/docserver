// The quick jump and the keys sheet in a real browser (docserver L2, Task 16): what jsdom cannot show, the browser's
// own focus order, layout and scrolling. The keys sheet keeps the focus inside its box; a press inside either box, off
// its control, leaves the focus where it was; the selected row of the jump stays in view of its list as the arrow keys
// move it; both dialogs cover the viewport, whatever the reading column's width (each sits in a wrapper of its own,
// jump.ts's header says why); and Escape gives the focus back to the button.
import { afterAll, expect, it } from 'vitest';
import type { Page } from 'playwright-core';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';

afterAll(closeBrowsers);

/** A document of `n` level-3 headings under a title, each with a line of text. */
const headings = (n: number): string =>
  ['# Example', '', 'Intro.', '', ...Array.from({ length: n }, (_, i) => [`### Part ${String(i + 1)}`, '', `Text of part ${String(i + 1)}.`, '']).flat()].join('\n');

/** The focused element's class and text, or its tag. */
const focused = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const a = document.activeElement;
    return a === null ? 'none' : `${a.localName}.${a.className}|${(a.textContent ?? '').trim()}`;
  });

describeBrowsers((browser) => {
  it('the reading column\'s prose rules stop at the dialogs: the jump\'s rows, the sheet\'s headings and the colour key', async () => {
    // Measured against the reference, which kept these dialogs outside its column (the four resets in reader.css).
    const doc = await openDoc(headings(8), {}, { browser });
    try {
      const { page } = doc;
      await page.keyboard.press('/');
      await page.waitForSelector('.jump.open li');
      const row = await page.evaluate(() => {
        const li = document.querySelector('.jump li') as HTMLElement;
        const cs = getComputedStyle(li);
        return Number.parseFloat(cs.marginBottom) / Number.parseFloat(cs.fontSize);
      });
      expect(row).toBeCloseTo(0.3, 2);
      await page.keyboard.press('Escape');
      await page.keyboard.press('?');
      await page.waitForSelector('.keys.open');
      const sheet = await page.evaluate(() => {
        const h = document.querySelector('.keys h2') as HTMLElement;
        const hs = getComputedStyle(h);
        const key = document.querySelector('.keys .ckey') as HTMLElement;
        const ks = getComputedStyle(key);
        const item = key.querySelector('li') as HTMLElement;
        const is = getComputedStyle(item);
        return {
          position: hs.position,
          lineHeight: Math.round((Number.parseFloat(hs.lineHeight) / Number.parseFloat(hs.fontSize)) * 100) / 100,
          key: [ks.paddingTop, ks.paddingLeft, ks.marginTop, ks.marginBottom],
          item: [is.marginTop, is.marginBottom],
        };
      });
      expect(sheet).toEqual({ position: 'static', lineHeight: 1.3, key: ['0px', '0px', '0px', '0px'], item: ['0px', '0px'] });
    } finally {
      await doc.close();
    }
  });

  it('the keys sheet keeps the focus on its control: Tab and Shift+Tab never leave the box', async () => {
    const doc = await openDoc(headings(8), {}, { browser });
    try {
      const { page } = doc;
      await page.keyboard.press('?');
      await page.waitForSelector('.keys.open');
      expect(await focused(page)).toBe('button.linkish|Close');
      for (const k of ['Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Tab']) {
        await page.keyboard.press(k);
        expect(await focused(page), k).toBe('button.linkish|Close');
      }
      await page.keyboard.press('Escape');
      expect(await page.locator('.keys.open').count()).toBe(0);
    } finally {
      await doc.close();
    }
  });

  it('a press inside either box keeps the focus there: the sheet\'s Tab stays on Close, the jump\'s field keeps typing', async () => {
    const doc = await openDoc(headings(8), {}, { browser });
    try {
      const { page } = doc;
      await page.keyboard.press('?');
      await page.waitForSelector('.keys.open');
      for (const sel of ['.keys dl', '.keys .ckey', '.keys .kh h2']) {
        await page.click(sel);
        expect(await focused(page), sel).toBe('button.linkish|Close');
        await page.keyboard.press('Tab');
        expect(await focused(page), sel).toBe('button.linkish|Close');
      }
      await page.keyboard.press('Escape');
      expect(await page.locator('.keys.open').count()).toBe(0);
      await page.keyboard.press('/');
      await page.waitForSelector('.jump.open');
      await page.click('.jump-hint');
      expect(await focused(page)).toBe('input.|');
      await page.keyboard.type('part 3');
      expect(await page.locator('.jump li .jt').allTextContents()).toEqual(['Part 3']);
      await page.keyboard.press('Escape');
      expect(await page.locator('.jump.open').count()).toBe(0);
    } finally {
      await doc.close();
    }
  });

  it('the selected row stays in view of the list as the arrow keys move it, down and back up', async () => {
    const doc = await openDoc(headings(70), {}, { browser });
    try {
      const { page } = doc;
      await page.keyboard.press('/');
      await page.waitForSelector('.jump.open');
      const inView = (): Promise<{ sel: string; inside: boolean; scrolled: number }> =>
        page.evaluate(() => {
          const list = document.querySelector('.jump ul') as HTMLElement;
          const sel = list.querySelector('li.sel') as HTMLElement;
          const l = list.getBoundingClientRect();
          const r = sel.getBoundingClientRect();
          return { sel: sel.querySelector('.jt')?.textContent ?? '', inside: r.top >= l.top - 0.5 && r.bottom <= l.bottom + 0.5, scrolled: list.scrollTop };
        });
      expect(await page.locator('.jump li').count()).toBe(70);
      expect(await inView()).toEqual({ sel: 'Part 1', inside: true, scrolled: 0 });
      for (let i = 0; i < 45; i += 1) await page.keyboard.press('ArrowDown');
      const down = await inView();
      expect(down.sel).toBe('Part 46');
      expect(down.inside).toBe(true);
      expect(down.scrolled).toBeGreaterThan(0);
      for (let i = 0; i < 45; i += 1) await page.keyboard.press('ArrowUp');
      expect(await inView()).toEqual({ sel: 'Part 1', inside: true, scrolled: 0 });
    } finally {
      await doc.close();
    }
  });

  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    it(`both dialogs cover the viewport at ${String(viewport.width)}×${String(viewport.height)}, not the reading column`, async () => {
      const doc = await openDoc(headings(8), {}, { browser, viewport });
      try {
        const { page } = doc;
        const box = (sel: string): Promise<number[]> =>
          page.evaluate((s) => {
            const r = (document.querySelector(s) as HTMLElement).getBoundingClientRect();
            return [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 10) / 10);
          }, sel);
        await page.keyboard.press('/');
        await page.waitForSelector('.jump.open');
        expect(await box('.jump')).toEqual([0, 0, viewport.width, viewport.height]);
        await page.keyboard.press('Escape');
        await page.keyboard.press('?');
        await page.waitForSelector('.keys.open');
        expect(await box('.keys')).toEqual([0, 0, viewport.width, viewport.height]);
      } finally {
        await doc.close();
      }
    });
  }

  it('the button opens the jump, Escape gives the focus back to it, and Ctrl+K opens it again', async () => {
    const doc = await openDoc(headings(8), {}, { browser });
    try {
      const { page } = doc;
      await page.click('.jump-btn');
      await page.waitForSelector('.jump.open');
      expect(await focused(page)).toBe('input.|');
      await page.keyboard.type('part 7');
      expect(await page.locator('.jump li .jt').allTextContents()).toEqual(['Part 7']);
      await page.keyboard.press('Escape');
      expect(await page.locator('.jump.open').count()).toBe(0);
      expect(await focused(page)).toBe('button.jump-btn|Jump to/');
      await page.keyboard.press('Control+k');
      await page.waitForSelector('.jump.open');
      await page.keyboard.press('Enter');
      expect(await page.locator('.jump.open').count()).toBe(0);
      expect(await page.evaluate(() => document.activeElement?.id)).toBe('part-1');
    } finally {
      await doc.close();
    }
  });
});
