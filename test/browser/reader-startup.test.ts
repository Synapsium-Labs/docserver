// Reader mode asked for while a direct host's enhance() is starting (LX6 review fix F2), in real browsers, in the `default` layout.
// The instance is the page's own (no frame): the harness remounts from the host's own callback, so the new enhance() has no
// context yet and keeps the host's calls (the newest wins), and a document that builds a rail is shown at a width where the
// rail is a column (1400 px).
//
//   S2  the "Changes since" picker sits in the visible review strip: with a reading mode on it is shown and opens its menu, the menu
//       stays open across screens, scroll and off, and Escape still dismisses it (nothing hides or closes it)
//   S1  started in reader mode: the root carries data-reading, the text column is the one a rail-less root has (no rail
//       padding), the rail is built but hidden, and `off` gives the rail and its padding back with the same elements, no remount
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName } from './harness.js';
import type { HarnessApi } from './page/api.js';

afterAll(closeBrowsers);

const DOC = [
  '# Reader start',
  '',
  ...[1, 2, 3, 4, 5, 6].flatMap((n) => [`## ${String(n)}. Section ${String(n)}`, '', 'A paragraph of plain text that fills the reading column. '.repeat(8), '']),
].join('\n');

interface Look {
  readonly reading: string | null;
  readonly hasToc: boolean;
  readonly rail: boolean;
  readonly railShown: boolean;
  readonly padLeft: number;
  readonly textLeft: number;
}

describeBrowsers((browser: BrowserName) => {
  it('S1 (default layout): a mode asked for while a rail-building document starts, at 1400 px, leaves the full text column, and off restores the rail in place', async () => {
    const doc = await openDoc(DOC, { chrome: { rail: true } }, { browser, viewport: { width: 1400, height: 900 }, enhance: false });
    try {
      const look = (): Promise<Look> =>
        doc.page.evaluate(() => {
          const root = (window.__docreaderHarness as HarnessApi).root;
          const rail = root.querySelector('.doc-toc');
          const p = root.querySelector(':scope > p') as HTMLElement;
          return {
            reading: root.getAttribute('data-reading'),
            hasToc: root.classList.contains('has-toc'),
            rail: rail !== null,
            railShown: rail !== null && getComputedStyle(rail).display !== 'none',
            padLeft: parseFloat(getComputedStyle(root).paddingLeft),
            textLeft: p.getBoundingClientRect().left,
          };
        });
      // Three calls while it starts: the newest, `scroll`, is the mode.
      const out = await doc.page.evaluate(() => (window.__docreaderHarness as HarnessApi).enhanceReading(['off', 'screens', 'scroll']));
      expect(out).toEqual({ ok: true });
      const started = await look();
      expect(started.reading).toBe('scroll');
      expect(started.rail, 'the document built a rail').toBe(true);
      expect(started.hasToc, 'the rail class is off while reader mode is on').toBe(false);
      expect(started.railShown, 'the rail is hidden').toBe(false);
      // the column a rail-less root has: the same as the one a root gets by entering reader mode later
      await doc.page.evaluate(() => (window.__docreaderHarness as HarnessApi).setReading('off'));
      const restored = await look();
      expect(restored.reading).toBeNull();
      expect(restored.hasToc, 'off puts the rail class back').toBe(true);
      expect(restored.railShown, 'off shows the rail again').toBe(true);
      expect(restored.padLeft, 'and with it the rail padding').toBeGreaterThan(started.padLeft + 200);
      await doc.page.evaluate(() => (window.__docreaderHarness as HarnessApi).setReading('scroll'));
      const later = await look();
      expect(later.reading).toBe('scroll');
      expect(later.padLeft, 'the same column as one entered later').toBe(started.padLeft);
      expect(later.textLeft).toBe(started.textLeft);
      expect(later.hasToc).toBe(false);
    } finally {
      await doc.close();
    }
  }, 120_000);

  it('S2 (default layout): the Changes since picker is visible with a reading mode on, opens its menu there, keeps it open across every mode change, and Escape still dismisses it', async () => {
    const commits = [
      { sha: 'abcdef1', subject: 'feat: newer change', date: '2026-01-01T18:45:00Z', parents: ['1234567'] },
      { sha: '1234567', subject: 'fix: older change', date: '2026-01-01T18:15:00Z', parents: ['2345678'] },
    ];
    const doc = await openDoc(DOC, { info: { sha: 'abcdef1', commits }, changes: { changed: [] } }, { browser, viewport: { width: 900, height: 900 } });
    try {
      const set = (mode: string): Promise<void> => doc.page.evaluate((m) => (window.__docreaderHarness as HarnessApi).setReading(m), mode);
      const state = (): Promise<{ reading: string | null; trigger: boolean; open: boolean }> =>
        doc.page.evaluate(() => {
          const root = (window.__docreaderHarness as HarnessApi).root;
          const t = root.querySelector('.chg-trig') as HTMLElement | null;
          const m = root.querySelector('.chg-menu') as HTMLElement | null;
          const r = t?.getBoundingClientRect();
          return {
            reading: root.getAttribute('data-reading'),
            trigger: t !== null && getComputedStyle(t).display !== 'none' && r !== undefined && r.width > 0 && r.height > 0,
            open: m !== null && !m.hidden && getComputedStyle(m).display !== 'none',
          };
        });
      await set('screens');
      expect(await state(), 'reading on: the picker is shown, its menu closed').toEqual({ reading: 'screens', trigger: true, open: false });
      await doc.page.locator('.chg-trig').click();
      expect((await state()).open, 'the click opens the menu in reader mode').toBe(true);
      for (const mode of ['scroll', 'off', 'screens']) {
        await set(mode);
        const now = await state();
        expect(now.open, `the menu stays open in ${mode}`).toBe(true);
        expect(now.trigger).toBe(true);
      }
      await doc.page.keyboard.press('Escape');
      expect((await state()).open, 'Escape dismisses the visible menu').toBe(false);
    } finally {
      await doc.close();
    }
  }, 120_000);
});
