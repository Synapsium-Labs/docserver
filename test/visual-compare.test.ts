// The visual comparison script's pure parts (scripts/visual/compare.mjs; docserver L2, Task 6): its command line,
// the 0.1 px tolerance on boxes (x from the column's origin, the gap from the block before, width, height) and
// lengths, exact comparison of every other value (font-family by its generic family), blocks that only one page
// holds, how an --expected file names a difference, and what --offline adds to the launch. The script itself, in a
// real browser, is test/browser/visual-compare.test.ts.
import { describe, expect, it } from 'vitest';
import {
  OFFLINE_ARGS,
  PROPS,
  STATES,
  TOLERANCE,
  USAGE,
  VIEWPORTS,
  classify,
  describeDifference,
  diffBlocks,
  pageUrl,
  parseArgs,
  parseExpected,
  sameValue,
  type Block,
} from '../scripts/visual/compare.mjs';

const style = (over: Record<string, string> = {}): Record<string, string> => ({
  ...Object.fromEntries(PROPS.map((p) => [p, p === 'fontFamily' ? '"Face A", serif' : '0px'])),
  ...over,
});
const block = (key: string, x: number, width = 700, height = 20, over: Record<string, string> = {}, y = 0): Block => ({
  key,
  box: { x, y, width, height },
  style: style(over),
});

describe('compare.mjs: the command line', () => {
  it('takes the two pages, and optionally the states, an expected file, a setup module and --offline', () => {
    expect(parseArgs(['--ours', 'a.html', '--reference', 'http://127.0.0.1:1/x'])).toEqual({
      ours: 'a.html',
      reference: 'http://127.0.0.1:1/x',
      states: ['light', 'dark', 'sans-wide'],
      expected: undefined,
      setup: undefined,
      offline: false,
    });
    expect(parseArgs(['--reference', 'b', '--offline', '--ours', 'a', '--states', 'light, folded', '--expected', 'e.json', '--setup', 's.mjs'])).toEqual({
      ours: 'a',
      reference: 'b',
      states: ['light', 'folded'],
      expected: 'e.json',
      setup: 's.mjs',
      offline: true,
    });
    expect(parseArgs(['--ours', 'a', '--reference', 'b', '--offline']).offline).toBe(true);
  });

  it('--offline maps every host name and address to "not found" in Chromium', () => {
    expect(OFFLINE_ARGS).toEqual(['--host-resolver-rules=MAP * ~NOTFOUND']);
  });

  it('refuses a missing page, an unknown or repeated flag, and a bad state name', () => {
    for (const bad of [
      [],
      ['--ours', 'a'],
      ['--ours', 'a', '--reference'],
      ['--ours', 'a', '--reference', 'b', '--width', '1'],
      ['--ours', 'a', '--ours', 'b', '--reference', 'c'],
      ['--ours', 'a', '--reference', 'b', '--offline', '--offline'],
      ['--offline', 'a', '--ours', 'a', '--reference', 'b'],
    ]) {
      expect(() => parseArgs(bad)).toThrow(USAGE);
    }
    expect(() => parseArgs(['--ours', 'a', '--reference', 'b', '--states', 'Light'])).toThrow('bad state names');
  });

  it('measures at 1440×1000 and 390×844, in light, dark and sans with wide', () => {
    expect(VIEWPORTS).toEqual({ desktop: { width: 1440, height: 1000 }, phone: { width: 390, height: 844 } });
    expect(STATES).toEqual({
      light: { theme: 'light', width: 'standard', font: 'serif' },
      dark: { theme: 'dark', width: 'standard', font: 'serif' },
      'sans-wide': { theme: 'light', width: 'wide', font: 'sans' },
    });
  });

  it('a page is a URL, or a path to a file', () => {
    expect(pageUrl('https://example.invalid/a')).toBe('https://example.invalid/a');
    expect(pageUrl('file:///x/y.html')).toBe('file:///x/y.html');
    expect(pageUrl('y.html')).toMatch(/^file:\/\/.*\/y\.html$/);
  });
});

describe('compare.mjs: what counts as a difference', () => {
  it('lengths within 0.1 px are equal, and further apart are not', () => {
    expect(TOLERANCE).toBe(0.1);
    expect(sameValue('width', '700px', '700.1px')).toBe(true);
    expect(sameValue('width', '700px', '700.11px')).toBe(false);
    expect(sameValue('margin', '1px 2px', '1px 2.05px')).toBe(true);
    expect(sameValue('margin', '1px 2px', '1px')).toBe(false);
  });

  it('any other value is compared as text; font-family by its generic family', () => {
    expect(sameValue('color', 'rgb(0, 0, 0)', 'rgb(0, 0, 1)')).toBe(false);
    expect(sameValue('display', 'block', 'block')).toBe(true);
    expect(sameValue('fontFamily', '"Face A", Georgia, serif', 'Other, serif')).toBe(true);
    expect(sameValue('fontFamily', '"Face A", serif', '"Face A", sans-serif')).toBe(false);
    expect(sameValue('lineHeight', 'normal', '20px')).toBe(false);
  });

  it('boxes are measured from the first block both pages hold, within 0.1 px', () => {
    const ours = [block('h1@1-1', 100), block('p@3-3', 100.1, 700.05), block('p@5-5', 140)];
    const ref = [block('h1@1-1', 300), block('p@3-3', 300, 700), block('p@5-5', 339.8)];
    expect(diffBlocks(ours, ref)).toEqual([{ block: 'p@5-5', prop: 'box.x', ours: 40, reference: 39.8 }]);
  });

  it('the gap from the block before that both pages hold is held to 0.1 px; a shift of the whole column is not a gap', () => {
    const ref = [block('h1@1-1', 0, 700, 20, {}, 100), block('dl@2-2', 0, 700, 20, {}, 130), block('p@3-3', 0, 700, 20, {}, 160)];
    // Our page holds the whole column 300 px lower (chrome above it), and a spacer of 50 px before p@3-3; dl@2-2 is
    // ours only, so p@3-3's gap is measured from h1@1-1 in both pages.
    const ours = [block('h1@1-1', 0, 700, 20, {}, 400), block('p@3-3', 0, 700, 20, {}, 510.05)];
    expect(diffBlocks(ours, ref)).toEqual([
      { block: 'p@3-3', prop: 'box.gap', ours: 110.05, reference: 60 },
      { block: 'dl@2-2', prop: 'present', ours: 'no', reference: 'yes' },
    ]);
    expect(diffBlocks([block('h1@1-1', 0, 700, 20, {}, 400), block('p@3-3', 0, 700, 20, {}, 460.1)], ref).map((d) => d.prop)).toEqual(['present']);
  });

  it('a block with no box (not laid out) has no gap, and the next gap is measured from the block before it', () => {
    // thead@2-2 is hidden in both pages (a 0 by 0 box at the top of each); our column starts 200 px lower.
    const ref = [block('h1@1-1', 0, 700, 20, {}, 100), block('thead@2-2', 0, 0, 0, {}, 0), block('p@3-3', 0, 700, 20, {}, 160)];
    const ours = [block('h1@1-1', 0, 700, 20, {}, 300), block('thead@2-2', 0, 0, 0, {}, 0), block('p@3-3', 0, 700, 20, {}, 360)];
    expect(diffBlocks(ours, ref)).toEqual([]);
    const spaced = [ours[0], ours[1], block('p@3-3', 0, 700, 20, {}, 361)] as Block[];
    expect(diffBlocks(spaced, ref)).toEqual([{ block: 'p@3-3', prop: 'box.gap', ours: 61, reference: 60 }]);
  });

  it('a computed value that differs is named with both values; a block in one page only is "present"', () => {
    const ours = [block('h1@1-1', 0), block('p@3-3', 0, 700, 20, { color: 'rgb(1, 2, 3)' }), block('dl@2-2', 0)];
    const ref = [block('h1@1-1', 0), block('p@3-3', 0, 700, 21.5), block('nav@9-9', 0)];
    expect(diffBlocks(ours, ref).map(describeDifference)).toEqual([
      'p@3-3 box.height: ours=20 reference=21.5',
      'p@3-3 color: ours=rgb(1, 2, 3) reference=0px',
      'dl@2-2 present: ours=yes reference=no',
      'nav@9-9 present: ours=no reference=yes',
    ]);
  });
});

describe('compare.mjs: expected differences', () => {
  const diffs = [
    { block: 'details@5-6', prop: 'borderTopWidth', ours: '0px', reference: '1px' },
    { block: 'details@5-6', prop: 'box.height', ours: 51, reference: 52 },
    { block: 'p@9-9', prop: 'color', ours: 'a', reference: 'b' },
  ];

  it('an entry names the differences it matches, by block, prop and combo patterns; the rest are unexpected', () => {
    const entries = parseExpected(JSON.stringify([{ name: 'a strip not built', blocks: ['details@*'], props: ['border*', 'box.*'], combos: ['desktop-*'] }]));
    const desk = classify('desktop-light', diffs, entries);
    expect(desk.unexpected).toEqual([diffs[2]]);
    expect(desk.expected).toEqual([['a strip not built', [diffs[0], diffs[1]]]]);
    expect([...desk.used]).toEqual(['a strip not built']);
    expect(classify('phone-light', diffs, entries).unexpected).toEqual(diffs);
  });

  it('an entry with no patterns matches everything; with none, every difference is unexpected', () => {
    expect(classify('desktop-dark', diffs, parseExpected('[{"name":"all"}]')).unexpected).toEqual([]);
    expect(classify('desktop-dark', diffs, []).unexpected).toEqual(diffs);
  });

  it('an expected file is a list of named entries with lists of patterns, and nothing else', () => {
    for (const [text, message] of [
      ['{}', 'is a JSON list'],
      ['[1]', 'is not an object'],
      ['[{"blocks":["x"]}]', 'needs a name'],
      ['[{"name":"x","why":"y"}]', 'unknown keys'],
      ['[{"name":"x","props":[]}]', 'props is a non-empty list'],
      ['[{"name":"x","combos":"desktop-*"}]', 'combos is a non-empty list'],
    ] as const) {
      expect(() => parseExpected(text)).toThrow(message);
    }
  });
});
