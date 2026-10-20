// Tables and code blocks in a real browser (docserver L2, Task 10): what jsdom cannot show, the sizes. A table fits
// its wrapper or is a labelled region, and `--thead-h` is its head's height; a code block is `long` when it needs more
// than the reading column, and its `pre` is a region when it still does not fit, decided by the canvas measure of the
// code face, at the viewport thresholds of the stylesheet (a phone at 700 px or less, the rail from 1,240 px); the
// decisions follow a width change and the fonts' arrival; a code block's region is its real overflow once laid out (a
// line of wide characters); a root enhanced while hidden is measured only once shown; a --rem in rem counts as what it
// resolves to; the bullet cells' hidden parts take no box; and the filter hides rows (on a phone, an open point).
//
// The rail is Task 18's: these cases stand in for it with the class `has-toc` and a `--rail-w` on the root, which is
// what the code widths read.
import type { Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName } from './harness.js';

afterAll(closeBrowsers);

const x = (n: number): string => 'x'.repeat(n);

/** The code's face at its size, as the stylesheet sets it (test/enhance-blocks.test.ts holds the code to the same). */
const CODE_FONT = '12.48px ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';

/** What a line needs beyond its characters, in px (the reference's reckoning). */
const PAD = 42;
const fence = (line: string, indent = ''): string => [`${indent}\`\`\``, `${indent}${line}`, `${indent}\`\`\``, ''].join('\n');

/**
 * Four code blocks whose longest lines need about 267, 643, 943 and 1394 px, and one in a list item that needs about
 * 688: the characters for each come from the width of one character of the code face in that browser (`charW`, as
 * the canvas measures it), since the browsers resolve the face's first family, `ui-monospace`, to different fonts.
 */
function codeMd(charW: number): string {
  const line = (need: number): string => x(Math.round((need - PAD) / charW));
  return [
    '# Code',
    '',
    'Blocks of four widths.',
    '',
    fence(line(267)),
    fence(line(643)),
    fence(line(943)),
    fence(line(1394)),
    '- In a list:',
    '',
    fence(line(688), '  '),
  ].join('\n');
}

/** One character of the code face, in px, as this browser's canvas measures it (what the reader measures too). */
async function measureChar(browser: BrowserName): Promise<number> {
  const doc = await openDoc('# Probe\n', {}, { browser, enhance: false });
  try {
    return await doc.page.evaluate((font) => {
      const cx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
      cx.font = font;
      return cx.measureText('0123456789'.repeat(4)).width / 40;
    }, CODE_FONT);
  } finally {
    await doc.close();
  }
}

const WIDE_HEADS = Array.from({ length: 10 }, (_, i) => `Column header ${String(i + 1)}`);

/** The head of a two-column table that is wider than the column, since a table head never wraps. */
const LONG_HEAD = 'A header long enough that it never fits the reading column, as the table head never wraps its text';

/** A narrow table, a table of ten wide headers, and a table of two columns whose head is wider than the column. */
const TABLES = [
  '# Tables',
  '',
  '| Name | Value |',
  '|---|---|',
  '| a | 1 |',
  '',
  `| ${WIDE_HEADS.join(' | ')} |`,
  `|${WIDE_HEADS.map(() => '---').join('|')}|`,
  `| ${WIDE_HEADS.map((_, i) => String(i)).join(' | ')} |`,
  '',
  `| Key | ${LONG_HEAD} |`,
  '|---|---|',
  '| k | v |',
  '',
].join('\n');

/** Let the relayouts that are due run: two frames and a little. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(r, 50);
          });
        });
      }),
  );
}

interface CodeState {
  readonly long: boolean;
  readonly role: string | null;
  readonly tabindex: string | null;
  readonly label: string | null;
  /** The pre scrolls sideways, measured. */
  readonly scrolls: boolean;
  readonly width: number;
}

function codeState(page: Page): Promise<CodeState[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('main[data-harness-root] .codehilite')).map((c) => {
      const pre = c.querySelector('pre') as HTMLPreElement;
      return {
        long: c.classList.contains('long'),
        role: pre.getAttribute('role'),
        tabindex: pre.getAttribute('tabindex'),
        label: pre.getAttribute('aria-label'),
        scrolls: pre.scrollWidth > pre.clientWidth + 1,
        width: c.getBoundingClientRect().width,
      };
    }),
  );
}

interface TableState {
  readonly fits: boolean;
  readonly role: string | null;
  readonly label: string | null;
  readonly theadH: string;
  readonly headHeight: number;
}

function tableState(page: Page): Promise<TableState[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('main[data-harness-root] .table-wrapper')).map((w) => ({
      fits: w.classList.contains('fits'),
      role: w.getAttribute('role'),
      label: w.getAttribute('aria-label'),
      theadH: (w as HTMLElement).style.getPropertyValue('--thead-h'),
      headHeight: (w.querySelector('thead') as HTMLElement).offsetHeight,
    })),
  );
}

/** Open `md` at `width` × 900, with the stand-in rail when `rail`, enhanced and settled. */
async function openAt(browser: BrowserName, md: string, width: number, rail = false): Promise<Awaited<ReturnType<typeof openDoc>>> {
  const doc = await openDoc(md, {}, { browser, viewport: { width, height: 900 }, enhance: false });
  if (rail) {
    await doc.page.evaluate(() => {
      const root = document.querySelector('main[data-harness-root]') as HTMLElement;
      root.classList.add('has-toc');
      root.style.setProperty('--rail-w', '400px');
    });
  }
  await doc.enhance();
  await settle(doc.page);
  return doc;
}

const label = (n: number): string => `Code block ${String(n)}, scrolls sideways`;

describeBrowsers((browser) => {
  let codeDoc = '';
  beforeAll(async () => {
    const charW = await measureChar(browser);
    expect(charW).toBeGreaterThan(4);
    codeDoc = codeMd(charW);
  });

  it('at 1440 a block that needs 643 px is not long and one of 943 is, and takes the wide width; at 390 the column holds neither', async () => {
    const wide = await openAt(browser, codeDoc, 1440);
    try {
      const got = await codeState(wide.page);
      expect(got.map((c) => c.long)).toEqual([false, false, true, true, true]);
      expect(got.map((c) => c.label)).toEqual([null, null, null, label(4), null]);
      // The region is on exactly the blocks that scroll sideways.
      expect(got.map((c) => c.scrolls)).toEqual(got.map((c) => c.role === 'region'));
      const [s, m, l, xl] = got as [CodeState, CodeState, CodeState, CodeState];
      expect(Math.abs(s.width - 704)).toBeLessThan(0.5);
      expect(Math.abs(m.width - 704)).toBeLessThan(0.5);
      expect(Math.abs(l.width - 1120)).toBeLessThan(0.5); // the wide width
      expect(Math.abs(xl.width - 1120)).toBeLessThan(0.5);
    } finally {
      await wide.close();
    }
    const phone = await openAt(browser, codeDoc, 390);
    try {
      const got = await codeState(phone.page);
      expect(got.map((c) => c.long)).toEqual([false, true, true, true, true]);
      expect(got.map((c) => c.label)).toEqual([null, label(2), label(3), label(4), label(5)]);
      expect(got.map((c) => c.tabindex)).toEqual([null, '0', '0', '0', '0']);
      expect(got.map((c) => c.scrolls)).toEqual(got.map((c) => c.role === 'region'));
      for (const c of got.slice(0, 4)) expect(Math.abs(c.width - 358)).toBeLessThan(0.5); // the column, long or not
    } finally {
      await phone.close();
    }
  });

  // The stand-in rail is a --rail-w and nothing else: it takes no room in the layout. So it moves only the estimate,
  // which a laid-out pre no longer uses for its region (the region is its real overflow); at 1240 px the third block
  // fits the wide width as laid out, as at 1239. The rail's arithmetic is held in jsdom (test/enhance-blocks.test.ts).
  it('long and the region at 699, 700, 701, 1239 and 1240 px (the rail standing in from 1240)', async () => {
    const want: Record<number, { long: boolean[]; region: boolean[] }> = {
      699: { long: [false, false, true, true], region: [false, false, true, true] },
      700: { long: [false, false, true, true], region: [false, false, true, true] },
      701: { long: [false, true, true, true], region: [false, true, true, true] },
      1239: { long: [false, false, true, true], region: [false, false, false, true] },
      1240: { long: [false, false, true, true], region: [false, false, false, true] },
    };
    for (const width of [699, 700, 701, 1239, 1240]) {
      const doc = await openAt(browser, codeDoc, width, true);
      try {
        const got = (await codeState(doc.page)).slice(0, 4);
        expect({ width, long: got.map((c) => c.long), region: got.map((c) => c.role === 'region') }).toEqual({ width, ...want[width] });
        expect(got.map((c) => c.label)).toEqual(got.map((c, i) => (c.role === 'region' ? label(i + 1) : null)));
        expect(got.map((c) => c.scrolls)).toEqual(got.map((c) => c.role === 'region'));
      } finally {
        await doc.close();
      }
    }
  });

  it('a table that fits takes fits and is no region; one that does not is a labelled region; --thead-h is its head height', async () => {
    const doc = await openAt(browser, TABLES, 1440);
    try {
      const got = await tableState(doc.page);
      expect(got.map((t) => t.fits)).toEqual([true, false, false]);
      expect(got.map((t) => t.label)).toEqual([
        null,
        'Table 2, scrolls sideways: Column header 1, Column header 2, Column header 3',
        'Table 3, scrolls sideways: Key, A header long enough that it never fits the reading column, as the table head…', // clipped to 80
      ]);
      for (const t of got) {
        expect(t.headHeight).toBeGreaterThan(20);
        expect(t.theadH).toBe(`${String(t.headHeight)}px`);
      }
      const fit = await doc.page.evaluate(() => {
        const w = document.querySelector('main[data-harness-root] .table-wrapper') as HTMLElement;
        return [getComputedStyle(w).overflowX, (w.querySelector('table') as HTMLElement).scrollWidth <= w.clientWidth];
      });
      expect(fit).toEqual(['visible', true]);
    } finally {
      await doc.close();
    }
  });

  it('a table that stacks on a phone is no region at 700 px and is one at 701; one of two columns that overflows is one on a phone too', async () => {
    for (const [width, region] of [
      [700, [false, false, true]],
      [701, [false, true, true]],
    ] as const) {
      const doc = await openAt(browser, TABLES, width);
      try {
        const got = await tableState(doc.page);
        expect({ width, region: got.map((t) => t.role === 'region') }).toEqual({ width, region });
        expect(got[1]?.theadH).toBe(`${String(got[1]?.headHeight ?? -1)}px`);
      } finally {
        await doc.close();
      }
    }
  });

  it('a width change measures again: long, the regions, fits and --thead-h follow the viewport', async () => {
    const doc = await openAt(browser, `${codeDoc}\n${TABLES.replace('# Tables', '## Tables')}`, 1440);
    try {
      expect((await codeState(doc.page)).map((c) => c.long)).toEqual([false, false, true, true, true]);
      expect((await tableState(doc.page)).map((t) => t.role === 'region')).toEqual([false, true, true]);
      await doc.page.setViewportSize({ width: 390, height: 900 });
      await doc.page.waitForTimeout(300);
      await settle(doc.page);
      const code = await codeState(doc.page);
      expect(code.map((c) => c.long)).toEqual([false, true, true, true, true]);
      expect(code.map((c) => c.scrolls)).toEqual(code.map((c) => c.role === 'region'));
      const tables = await tableState(doc.page);
      expect(tables.map((t) => t.role === 'region')).toEqual([false, false, true]);
      expect(tables[1]?.theadH).toBe('0px'); // stacked: the head is not shown
      await doc.page.setViewportSize({ width: 1440, height: 900 });
      await doc.page.waitForTimeout(300);
      await settle(doc.page);
      expect((await codeState(doc.page)).map((c) => [c.long, c.role])).toEqual([
        [false, null],
        [false, null],
        [true, null],
        [true, 'region'],
        [true, null],
      ]);
      expect((await tableState(doc.page)).map((t) => t.theadH === `${String(t.headHeight)}px`)).toEqual([true, true, true]);
    } finally {
      await doc.close();
    }
  });

  it('with the fonts held back, --thead-h and long are measured again once they load', async () => {
    const doc = await openDoc(`${codeDoc}\n${TABLES.replace('# Tables', '## Tables')}`, {}, { browser, viewport: { width: 1440, height: 900 }, enhance: false });
    try {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      let held = 0;
      await doc.page.route('**/assets/fonts/*.woff2', async (route) => {
        held += 1;
        await gate;
        await route.fallback();
      });
      // The harness's enhance() waits for the fonts, which are held: start it, and wait for the first measure.
      void doc.page.evaluate(() => {
        void window.__docreaderHarness?.enhance();
      });
      await doc.page.waitForFunction(() => {
        const w = document.querySelector('main[data-harness-root] .table-wrapper') as HTMLElement | null;
        return w !== null && w.style.getPropertyValue('--thead-h') !== '';
      });
      await settle(doc.page);
      expect(held).toBeGreaterThan(0);
      const before = await tableState(doc.page);
      expect((await codeState(doc.page))[1]?.long).toBe(false);
      // Change what is measured without a resize: a taller head, and a narrower root. Nothing measures yet.
      await doc.page.evaluate(() => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        root.style.setProperty('width', '600px');
        for (const th of Array.from(root.querySelectorAll('th'))) th.style.setProperty('padding-top', '40px');
      });
      await doc.page.waitForTimeout(300);
      await settle(doc.page);
      expect((await tableState(doc.page)).map((t) => t.theadH)).toEqual(before.map((t) => t.theadH));
      expect((await codeState(doc.page))[1]?.long).toBe(false);
      release();
      await doc.page.waitForFunction(
        (old) => {
          const w = document.querySelector('main[data-harness-root] .table-wrapper') as HTMLElement;
          return w.style.getPropertyValue('--thead-h') !== old;
        },
        before[0]?.theadH ?? '',
        { timeout: 15_000 },
      );
      await settle(doc.page);
      const after = await tableState(doc.page);
      for (const t of after) expect(t.theadH).toBe(`${String(t.headHeight)}px`);
      expect(after[0]?.headHeight).toBeGreaterThan((before[0]?.headHeight ?? 0) + 20);
      // 600 px less the root's padding is less room than the second block's 643 px.
      expect((await codeState(doc.page))[1]?.long).toBe(true);
    } finally {
      await doc.close();
    }
  });

  it("a bullet cell's lines are blocks, the second 0.5em below the first; its bullet and its breaks take no box", async () => {
    const md = ['# Cells', '', '| Item | Notes |', '|---|---|', '| One | • first line<br>• second line |', ''].join('\n');
    const doc = await openAt(browser, md, 1440);
    try {
      const got = await doc.page.evaluate(() => {
        const td = document.querySelectorAll('main[data-harness-root] tbody td')[1] as HTMLElement;
        const lines = Array.from(td.querySelectorAll('.cell-line')) as HTMLElement[];
        const hidden = Array.from(td.querySelectorAll('.cell-bullet, .cell-br, br'));
        const [a, b] = lines.map((l) => l.getBoundingClientRect());
        const style = getComputedStyle(lines[1] as Element);
        return {
          lines: lines.length,
          display: lines.map((l) => getComputedStyle(l).display),
          hiddenBoxes: hidden.map((h) => h.getClientRects().length),
          gap: (b?.top ?? 0) - (a?.bottom ?? 0),
          half: parseFloat(style.fontSize) / 2,
          marginTop: parseFloat(style.marginTop),
          dots: lines.map((l) => getComputedStyle(l, '::before').content),
        };
      });
      expect(got.lines).toBe(2);
      expect(got.display).toEqual(['block', 'block']);
      expect(got.hiddenBoxes).toEqual([0, 0, 0, 0]); // two bullets, the break's span and the break
      expect(Math.abs(got.marginTop - got.half)).toBeLessThan(0.01);
      expect(Math.abs(got.gap - got.half)).toBeLessThan(0.5);
      expect(got.dots).toEqual(['""', '""']); // the bullet the stylesheet draws
    } finally {
      await doc.close();
    }
  });

  it('the filter hides the rows without what is typed; clearing it shows them again', async () => {
    const rows = Array.from({ length: 14 }, (_, i) => `| Row ${String(i + 1)} | Item ${String(i + 1)} | note |`);
    const md = ['# Filter', '', '| Row | Item | Note |', '|---|---|---|', ...rows, ''].join('\n');
    const doc = await openAt(browser, md, 1440);
    try {
      const shown = (): Promise<number[]> =>
        doc.page.evaluate(() => Array.from(document.querySelectorAll('main[data-harness-root] tbody tr')).map((r) => r.getClientRects().length));
      await doc.page.fill('main[data-harness-root] .tbl-tools input', 'item 1');
      expect(await shown()).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
      expect(await doc.page.textContent('main[data-harness-root] .tbl-tools span')).toBe('6 of 14');
      await doc.page.fill('main[data-harness-root] .tbl-tools input', '');
      expect(await shown()).toEqual(Array.from({ length: 14 }, () => 1));
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  // OPEN (reported in the PR): a filtered row carries a journaled `hidden`, as the plan asks, and the browser's own
  // `[hidden] { display: none }` loses to the stylesheet's phone rule `.stack tr { display: block }`, so on a phone the
  // rows a stacked table's filter hides still show. The fix is a rule in assets/reader.css (or `display` in LD11's
  // list), which this task does not own. This case pins today's behaviour: the count and the `hidden` attributes are
  // right, and the hidden rows still lay out. Once the fix lands the last expectation turns red, and flips to the
  // desktop case's [1, 0, 0, …].
  it('on a phone the filter of a table that stacks into cards counts and marks the rows, which still show (open: the stylesheet)', async () => {
    const rows = Array.from({ length: 14 }, (_, i) => `| Row ${String(i + 1)} | Item ${String(i + 1)} | note |`);
    const md = ['# Filter', '', '| Row | Item | Note |', '|---|---|---|', ...rows, ''].join('\n');
    const doc = await openAt(browser, md, 390);
    try {
      await doc.page.fill('main[data-harness-root] .tbl-tools input', 'item 1');
      const got = await doc.page.evaluate(() => {
        const trs = Array.from(document.querySelectorAll('main[data-harness-root] tbody tr'));
        return {
          stack: (document.querySelector('main[data-harness-root] .table-wrapper') as Element).classList.contains('stack'),
          count: (document.querySelector('main[data-harness-root] .tbl-tools span') as Element).textContent,
          hidden: trs.map((r) => r.hasAttribute('hidden')),
          boxes: trs.map((r) => r.getClientRects().length),
        };
      });
      expect(got.stack).toBe(true);
      expect(got.count).toBe('6 of 14');
      expect(got.hidden).toEqual([false, true, true, true, true, true, true, true, true, false, false, false, false, false]);
      expect(got.boxes).toEqual(Array.from({ length: 14 }, () => 1)); // the open defect: hidden rows still lay out
    } finally {
      await doc.close();
    }
  });

  it('a root enhanced while hidden is not measured until it is shown and a relayout runs', async () => {
    const md = `${TABLES}\n\`\`\`\n${x(40)}\n\`\`\`\n`;
    const doc = await openDoc(md, {}, { browser, viewport: { width: 1440, height: 900 }, enhance: false });
    try {
      const rootStyle = (display: string | null): Promise<void> =>
        doc.page.evaluate((d) => {
          const root = document.querySelector('main[data-harness-root]') as HTMLElement;
          if (d === null) root.style.removeProperty('display');
          else root.style.setProperty('display', d);
        }, display);
      await rootStyle('none');
      await doc.enhance();
      await settle(doc.page);
      await rootStyle(null);
      await settle(doc.page);
      await doc.page.waitForTimeout(300);
      const before = await tableState(doc.page);
      // Nothing was measured at 0 width: the wide table is not `fits` (which would spill it across the page), and the
      // short code block is neither long nor a region.
      expect(before.map((t) => [t.fits, t.theadH])).toEqual([
        [false, ''],
        [false, ''],
        [false, ''],
      ]);
      expect((await codeState(doc.page)).map((c) => [c.long, c.role])).toEqual([[false, null]]);
      const spill = await doc.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
      expect(spill).toBe(true);
      await doc.page.setViewportSize({ width: 1439, height: 900 });
      await doc.page.waitForTimeout(300);
      await settle(doc.page);
      const after = await tableState(doc.page);
      expect(after.map((t) => t.fits)).toEqual([true, false, false]);
      for (const t of after) expect(t.theadH).toBe(`${String(t.headHeight)}px`);
      expect((await codeState(doc.page)).map((c) => [c.long, c.role])).toEqual([[false, null]]);
    } finally {
      await doc.close();
    }
  });

  it('a line of wide characters, which the estimate takes for narrower, is a region when it really scrolls', async () => {
    // Each wide character is about one em, twice the estimate's character: 84 of them fit the column by the estimate
    // and overflow it laid out; 130 are long by the estimate, fit the wide width by it, and overflow that laid out.
    const md = ['# Wide', '', fence('\u6f22'.repeat(84)), fence('\u6f22'.repeat(130)), fence(x(10))].join('\n');
    const doc = await openAt(browser, md, 1440);
    try {
      const got = await codeState(doc.page);
      expect(got.map((c) => c.long)).toEqual([false, true, false]);
      expect(got.map((c) => c.scrolls)).toEqual([true, true, false]);
      expect(got.map((c) => [c.role, c.tabindex, c.label])).toEqual([
        ['region', '0', label(1)],
        ['region', '0', label(2)],
        [null, null, null],
      ]);
    } finally {
      await doc.close();
    }
  });

  it("a --rem in rem is read through the code's computed size: the column and the canvas follow it", async () => {
    // --rem 1.5rem: the code is 18.72 px and the column 44 × 24 = 1056 px. Lines that need 1046 and 1100 px at that
    // size; read as 16 px, the first would need about 711 px of a 704 px column, and be long.
    const charW = (await measureChar(browser)) * 1.5;
    const line = (need: number): string => x(Math.round((need - PAD) / charW));
    const md = ['# Rem', '', fence(line(1046)), fence(line(1100))].join('\n');
    const doc = await openDoc(md, {}, { browser, viewport: { width: 1440, height: 900 }, enhance: false });
    try {
      await doc.page.evaluate(() => {
        (document.querySelector('main[data-harness-root]') as HTMLElement).style.setProperty('--rem', '1.5rem');
      });
      await doc.enhance();
      await settle(doc.page);
      const got = await codeState(doc.page);
      expect(got.map((c) => c.long)).toEqual([false, true]);
      expect(Math.abs((got[0]?.width ?? 0) - 1056)).toBeLessThan(0.5);
      expect(got.map((c) => c.scrolls)).toEqual(got.map((c) => c.role === 'region'));
    } finally {
      await doc.close();
    }
  });
});
