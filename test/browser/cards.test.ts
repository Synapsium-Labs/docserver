// Preview cards in a real browser (docserver L2, Task 17): what jsdom cannot show. The card is placed against the real
// boxes of its trigger and the window, through journal.setStyle under the strict policy: below the trigger when it fits
// there, above it (under the bar) when the room below is short, kept 12 px inside each side of the window, never over
// the trigger; it follows the trigger on scroll and hides once the trigger has left the window. And a mouse resting on
// a trigger shows its card after the delay, through the browser's own pointer events.
import { afterAll, expect, it } from 'vitest';
import { GAP, LEAD, EDGE, SHOW_DELAY_MS } from '../../src/enhance/cards.js';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName, type OpenedDoc } from './harness.js';

afterAll(closeBrowsers);

const FILLER = 'A paragraph of plain text that fills the page, so the window can scroll past the table and back.';

/** An ID table, a long run of paragraphs, and mentions of its IDs at the start, in the middle and at the end. */
const DOC = [
  '# Cards in a browser',
  '',
  '## 1. Decisions',
  '',
  '| ID | Decision | Status |',
  '|---|---|---|',
  '| D1 | Keep the fold beside its heading, and say why in a sentence long enough to wrap in the card | Agreed |',
  '| D2 | Mark a section read once it is seen | Pending |',
  '',
  'The first mention of D1 is here.',
  '',
  ...Array.from({ length: 30 }, () => `${FILLER}\n`),
  'A mention of D2 in the middle of the page.',
  '',
  ...Array.from({ length: 30 }, () => `${FILLER}\n`),
  'The last mention, of D1 again.',
].join('\n');

interface Box {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly width: number;
  readonly height: number;
}

interface Seen {
  readonly trigger: Box;
  readonly card: Box | null;
  readonly open: boolean;
  readonly maxHeight: number;
  readonly viewport: { readonly w: number; readonly h: number };
}

/** The n-th `a.xref` of the page (0-based), scrolled so its top sits at `y` in the window, then focused: its card shows. */
async function showAt(doc: OpenedDoc, n: number, y: number): Promise<Seen> {
  await doc.page.evaluate(
    ([i, at]) => {
      const a = document.querySelectorAll('a.xref')[i] as HTMLElement;
      window.scrollTo({ top: Math.max(0, a.getBoundingClientRect().top + window.scrollY - at), behavior: 'instant' });
      a.focus({ preventScroll: true });
    },
    [n, y] as const,
  );
  await frames(doc);
  return seen(doc, n);
}

/** Wait two frames, so a scroll event and its placement have run. */
async function frames(doc: OpenedDoc): Promise<void> {
  await doc.page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

async function seen(doc: OpenedDoc, n: number): Promise<Seen> {
  return doc.page.evaluate((i) => {
    const box = (el: Element): Box => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const a = document.querySelectorAll('a.xref')[i] as HTMLElement;
    const card = document.querySelector('.xcard') as HTMLElement | null;
    return {
      trigger: box(a),
      card: card === null ? null : box(card),
      open: card?.classList.contains('open') === true,
      maxHeight: card === null ? 0 : Number.parseFloat(getComputedStyle(card).maxHeight),
      viewport: { w: window.innerWidth, h: window.innerHeight },
    };
  }, n);
}

/** True when the card's box and the trigger's overlap. */
function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** The card's left as the placement computes it, from the boxes it read. */
function expectedLeft(s: Seen): number {
  const card = s.card as Box;
  return Math.min(Math.max(EDGE, s.trigger.left - LEAD), s.viewport.w - card.width - EDGE);
}

async function withDoc(browser: BrowserName, viewport: { width: number; height: number }, fn: (doc: OpenedDoc) => Promise<void>): Promise<void> {
  const doc = await openDoc(DOC, { folds: false }, { browser, viewport });
  try {
    await fn(doc);
    expect(await doc.violations()).toEqual([]);
  } finally {
    await doc.close();
  }
}

describeBrowsers((browser) => {
  it('below the trigger when the card fits there, its left from the trigger\'s, never over it', async () => {
    await withDoc(browser, { width: 1440, height: 1000 }, async (doc) => {
      const s = await showAt(doc, 0, 200);
      expect(s.open).toBe(true);
      const card = s.card as Box;
      expect(card.top).toBeCloseTo(s.trigger.bottom + GAP, 0);
      expect(card.left).toBeCloseTo(expectedLeft(s), 0);
      expect(card.left).toBeCloseTo(s.trigger.left - LEAD, 0);
      expect(overlaps(card, s.trigger)).toBe(false);
      expect(card.bottom).toBeLessThanOrEqual(s.viewport.h);
    });
  });

  it('above the trigger, under the bar, when the room below is short; never over it', async () => {
    await withDoc(browser, { width: 1440, height: 1000 }, async (doc) => {
      const s = await showAt(doc, 1, 940);
      expect(s.open).toBe(true);
      const card = s.card as Box;
      expect(card.bottom).toBeCloseTo(s.trigger.top - GAP, 0);
      expect(overlaps(card, s.trigger)).toBe(false);
      // under the bar: --bar-h (48 px by default) and 16 px of room
      expect(card.top).toBeGreaterThanOrEqual(48 + 16 - 1);
    });
  });

  it('clamped to the window on a phone: 12 px from each side, never over the trigger', async () => {
    await withDoc(browser, { width: 390, height: 844 }, async (doc) => {
      for (const [n, y] of [
        [0, 150],
        [1, 400],
        [2, 700],
      ] as const) {
        const s = await showAt(doc, n, y);
        const card = s.card as Box;
        expect(s.open, `mention ${String(n)}`).toBe(true);
        expect(card.left, `mention ${String(n)}`).toBeCloseTo(expectedLeft(s), 0);
        expect(card.left).toBeGreaterThanOrEqual(EDGE - 0.5);
        expect(card.right).toBeLessThanOrEqual(s.viewport.w - EDGE + 0.5);
        expect(overlaps(card, s.trigger), `mention ${String(n)}`).toBe(false);
      }
      // the row card is wider than the window allows: it fills it, less 12 px each side
      const wide = await showAt(doc, 0, 150);
      expect((wide.card as Box).left).toBeCloseTo(EDGE, 1);
      expect((wide.card as Box).right).toBeCloseTo(wide.viewport.w - EDGE, 1);
    });
  });

  it('follows the trigger on scroll, and hides once the trigger has left the window', async () => {
    await withDoc(browser, { width: 1440, height: 1000 }, async (doc) => {
      const s = await showAt(doc, 1, 300);
      const top = (s.card as Box).top;
      await doc.page.evaluate(() => {
        window.scrollBy({ top: 100, behavior: 'instant' });
      });
      await frames(doc);
      const after = await seen(doc, 1);
      expect(after.trigger.top).toBeCloseTo(s.trigger.top - 100, 0);
      expect((after.card as Box).top).toBeCloseTo(top - 100, 0);
      expect(after.open).toBe(true);
      await doc.page.evaluate(() => {
        window.scrollBy({ top: 600, behavior: 'instant' });
      });
      await frames(doc);
      expect((await seen(doc, 1)).open).toBe(false);
    });
  });

  it('a mouse resting on a trigger shows its card after the delay; leaving it hides the card', async () => {
    await withDoc(browser, { width: 1440, height: 1000 }, async (doc) => {
      const a = doc.page.locator('a.xref').first();
      await a.hover();
      await doc.page.waitForTimeout(SHOW_DELAY_MS + 250);
      expect((await seen(doc, 0)).open).toBe(true);
      expect(await a.getAttribute('aria-expanded')).toBe('true');
      await doc.page.mouse.move(5, 5);
      await doc.page.waitForTimeout(600);
      expect((await seen(doc, 0)).open).toBe(false);
      expect(await a.getAttribute('aria-expanded')).toBe('false');
    });
  });
});
