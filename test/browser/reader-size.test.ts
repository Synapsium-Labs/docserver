// The text sizes in the real stylesheet (LX6.3; review fix F3), in real browsers, in the `default` layout, on the page's own
// instance (no frame): the computed body size of s, m, l and xl on each face and device. `m` is the reader's existing
// typography, so it differs by face and device (an approved look kept as it was); s, l and xl are one size everywhere.
//
//   Z1  serif desktop m 18, serif phone (700 px and under) m 17, sans desktop m 17.5, sans phone m 16.5; s 16, l 20 and xl 22
//       on every one of the four; an absent size and a stored size that is none of the four both read as m
import { afterAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName } from './harness.js';

afterAll(closeBrowsers);

const DOC = ['# Sizes', '', 'A paragraph of plain text.', '', '## 1. One', '', 'More text.', '', '## 2. Two', '', 'More text.', '', '## 3. Three', '', 'More text.', ''].join('\n');

/** The computed body size, in px, of each size on each face and device. */
const SIZES = {
  'serif desktop': { s: 16, m: 18, l: 20, xl: 22 },
  'serif phone': { s: 16, m: 17, l: 20, xl: 22 },
  'sans desktop': { s: 16, m: 17.5, l: 20, xl: 22 },
  'sans phone': { s: 16, m: 16.5, l: 20, xl: 22 },
} as const;

const SIZE_NAMES = ['s', 'l', 'xl', 'm'] as const;

describeBrowsers((browser: BrowserName) => {
  for (const [name, px] of Object.entries(SIZES)) {
    it(`Z1 (default layout): ${name}: s ${String(px.s)}, m ${String(px.m)}, l ${String(px.l)}, xl ${String(px.xl)} px of body text; absent and unknown read as m`, async () => {
      const font = name.startsWith('sans') ? 'sans' : 'serif';
      const viewport = name.endsWith('phone') ? { width: 390, height: 844 } : { width: 1400, height: 900 };
      const read = (doc: Awaited<ReturnType<typeof openDoc>>): Promise<{ body: number; size: string | null; checked: string[] }> =>
        doc.page.evaluate(() => {
          const root = document.querySelector('main[data-harness-root]') as HTMLElement;
          return {
            body: parseFloat(getComputedStyle(root).fontSize),
            size: root.getAttribute('data-size'),
            checked: Array.from(root.querySelectorAll<HTMLInputElement>('input[data-pref="size"]')).filter((i) => i.checked).map((i) => i.value),
          };
        });
      // absent: m
      const absent = await openDoc(DOC, { prefs: { font } }, { browser, viewport });
      try {
        expect(await read(absent), 'an absent size reads as m').toEqual({ body: px.m, size: null, checked: ['m'] });
      } finally {
        await absent.close();
      }
      // a stored size that is none of the four: m, the stored value never shown
      const unknown = await openDoc(DOC, { prefs: { font }, storage: { snapshot: { 'docreader:prefs': JSON.stringify({ size: 'huge' }) } } }, { browser, viewport });
      try {
        expect(await read(unknown), 'an unknown stored size reads as m').toEqual({ body: px.m, size: null, checked: ['m'] });
      } finally {
        await unknown.close();
      }
      // the four choices, through the Aa row
      const doc = await openDoc(DOC, { prefs: { font } }, { browser, viewport });
      try {
        for (const size of SIZE_NAMES) {
          await doc.page.evaluate((v) => {
            const input = document.querySelector(`input[data-pref="size"][value="${v}"]`) as HTMLInputElement;
            input.checked = true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }, size);
          await doc.page.waitForFunction(
            ([v]) => document.querySelector('main[data-harness-root]')?.getAttribute('data-size') === (v === 'm' ? null : v),
            [size],
          );
          const r = await read(doc);
          expect(r.body, `${name}, size ${size}`).toBe(px[size]);
          expect(r.checked).toEqual([size]);
        }
      } finally {
        await doc.close();
      }
    }, 120_000);
  }
});
