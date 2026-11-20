// The pure rules of test 8 (test/size-rules.ts), driven with synthetic states: every branch has a case that goes red when its
// guard is removed (docs/superpowers/plans/appearance-mutations/task-8.md). No git, no files.
import { describe, expect, it } from 'vitest';
import {
  GENESIS_SHARES,
  growthOf,
  judge,
  parseManifest,
  parseTable,
  serialiseTable,
  sizeDesignWords,
  sizesOf,
  type Asset,
  type Manifest,
  type Row,
  type State,
} from './size-rules.js';

const A = (sha: string, chars: number, layout: string | null = null): Asset => ({ sha256: sha.repeat(64).slice(0, 64), chars, layout });
/** guard 10, enhance (the default layout's) 100, css 50, mermaid 1000: total 1160, frame 1160. */
const man = (over: Record<string, Asset> = {}): Manifest => ({ guard: A('a', 10), enhance: A('b', 100, 'default'), css: A('c', 50), mermaid: A('d', 1000), ...over });
const table = (rows: readonly Row[]) => parseTable(serialiseTable(rows));
const row = (design: string, total: number, frame = total): Row => ({ design, total, frame });
const state = (shares: readonly Row[] | null, growth: readonly Row[] | null, manifest: Manifest): State => ({
  shares: shares === null ? null : table(shares),
  growth: growth === null ? null : table(growth),
  manifest,
});
const said = (word: string): string => `a landing\n\nSize-Design: ${word}\n`;
const has = (v: string[], part: string): void => expect(v.some((m) => m.includes(part)), `${part} in ${JSON.stringify(v)}`).toBe(true);

const SHARES = [row('x1', 200, 200), row('x2', 300, 300)];
/** A base after genesis: growth baseline 1160 (the 1.1.0 manifest), x1 at 1160 + 40 = 1200 (its own landing). */
const GROWTH = [row('baseline', 1160), row('x1', 1200)];
const baseManifest = man({ css: A('c', 90) }); // 1200
const BASE = state(SHARES, GROWTH, baseManifest);
/** A head that changed the enhance bundle by `d` characters: its sha moves and the totals grow. */
const grown = (d: number): Manifest => man({ css: A('c', 90), enhance: A('e', 100 + d, 'default') });
const at = (d: number): { total: number; frame: number } => sizesOf(grown(d));

describe('the table text and the manifest text', () => {
  it('a table is `[`, one row per line, the comma leading every row but the first, `]`', () => {
    expect(serialiseTable([row('a', 1), row('b', 2)])).toBe('[\n  {"design":"a","total":1,"frame":1}\n, {"design":"b","total":2,"frame":2}\n]\n');
    expect(parseTable(serialiseTable([row('a', 1), row('b', 2)])).lines).toEqual(['{"design":"a","total":1,"frame":1}', '{"design":"b","total":2,"frame":2}']);
  });
  it('an append leaves every earlier line byte-equal (the separator is not on the previous line)', () => {
    const one = serialiseTable([row('a', 1)]).split('\n');
    const two = serialiseTable([row('a', 1), row('b', 2)]).split('\n');
    expect(two.slice(0, 2)).toEqual(one.slice(0, 2));
  });
  it.each([
    ['no final newline', '[\n  {"design":"a","total":1,"frame":1}\n]'],
    ['a trailing comma style', '[\n  {"design":"a","total":1,"frame":1},\n  {"design":"b","total":1,"frame":1}\n]\n'],
    ['an extra key', '[\n  {"design":"a","total":1,"frame":1,"x":0}\n]\n'],
    ['a non-canonical row', '[\n  {"total":1,"design":"a","frame":1}\n]\n'],
    ['a float', '[\n  {"design":"a","total":1.5,"frame":1}\n]\n'],
    ['an empty table', '[\n]\n'],
  ])('refuses %s', (_n, text) => expect(() => parseTable(text)).toThrow());
  it('parses the generated manifest, a missing layout field reading as null', () => {
    const text = [
      'export const FRAME_MANIFEST = {',
      `  guard: { path: "frame/guard.js", sha256: "${'a'.repeat(64)}", bytes: 5, chars: 4, csp: "'x'" },`,
      `  enhance: { path: "frame/enhance.js", sha256: "${'b'.repeat(64)}", bytes: 9, chars: 9, csp: "'y'", layout: "default" },`,
      `  css: { path: "frame/reader.css", sha256: "${'c'.repeat(64)}", bytes: 9, chars: 7, csp: null, layout: null },`,
      '} as const;',
      '',
    ].join('\n');
    expect(parseManifest(text)).toEqual({ guard: A('a', 4), enhance: A('b', 9, 'default'), css: A('c', 7) });
    expect(() => parseManifest(text.replace('chars: 9', 'chars: nine'))).toThrow();
  });
  it('the sizes: total over every entry; frame the non-layout entries plus the largest layout', () => {
    expect(sizesOf(man())).toEqual({ total: 1160, frame: 1160 });
    const two = man({ wide: A('f', 150, 'wide'), wide2: A('g', 20, 'wide') });
    expect(sizesOf(two)).toEqual({ total: 1330, frame: 1060 + 170 });
  });
  it('growth is measured from the row before, for the design named, the first row of the table excepted', () => {
    expect(growthOf([row('baseline', 10), row('x1', 14), row('x2', 20), row('x1', 17)], 'x1')).toEqual({ total: 4 - 3, frame: 4 - 3 });
    expect(growthOf([row('baseline', 10)], 'baseline')).toEqual({ total: 0, frame: 0 });
  });
});

describe('one landing, one line', () => {
  const ok = (): State => state(SHARES, GROWTH, baseManifest);
  it('a text with one line is read, trailers after it change nothing, the word is trimmed of white space and a carriage return', () => {
    expect(sizeDesignWords('t\r\nSize-Design:  x1 \t\r\nCo-Authored-By: a')).toEqual(['x1']);
    expect(judge(BASE, ok(), 'title\n\nSize-Design: none \r\n\nCo-Authored-By: someone\n')).toEqual([]);
  });
  it('two lines red', () => has(judge(BASE, ok(), 'Size-Design: none\nSize-Design: none\n'), '2 "Size-Design: " lines'));
  it('none red', () => has(judge(BASE, ok(), 'no line here\n'), '0 "Size-Design: " lines'));
  it('an empty word reds', () => has(judge(BASE, ok(), 'Size-Design:  \n'), 'word is empty'));
  it('a line not at the start of a line is not a line', () => has(judge(BASE, ok(), 'see Size-Design: none\n'), '0 "Size-Design: " lines'));
});

describe('a design landing', () => {
  const g1 = (d: number): Row[] => [...GROWTH, row('x1', at(d).total, at(d).frame)];
  it('a design that changes assets appends exactly one row naming it, within its share, and is clean', () => {
    expect(judge(BASE, state(SHARES, g1(150), grown(150)), said('x1'))).toEqual([]);
  });
  it('growth over the share reds (and a share at exactly its total is clean)', () => {
    // x1 share 200: its growth so far 40; +160 makes 200 (clean); +161 is over.
    expect(judge(BASE, state(SHARES, g1(160), grown(160)), said('x1'))).toEqual([]);
    has(judge(BASE, state(SHARES, g1(161), grown(161)), said('x1')), 'within the share: x1 grew');
  });
  it('a frame share is held separately from the total share', () => {
    const shares = [row('x1', 1000, 100), row('x2', 300, 300)];
    const b = state(shares, GROWTH, baseManifest);
    has(judge(b, state(shares, g1(100), grown(100)), said('x1')), 'within the share');
  });
  it('a revert with negative growth frees room and is clean', () => {
    const down = (d: number): Row[] => [...GROWTH, row('x1', at(d).total, at(d).frame)];
    expect(judge(BASE, state(SHARES, down(-30), grown(-30)), said('x1'))).toEqual([]);
  });
  it('a design with no share row at the first parent cannot append growth', () => {
    has(judge(BASE, state(SHARES, [...GROWTH, row('x3', at(5).total)], grown(5)), said('x3')), 'no share row at the first parent');
  });
  it('shares are read from the first parent, never from the head: a landing that raises its own share is still over', () => {
    const raised = [row('x1', 9000, 9000), row('x2', 300, 300)];
    // The head's shares table rewrites x1's row (byte-equal fails too); the within-share rule must still use the base's 200.
    const v = judge(BASE, state(raised, g1(500), grown(500)), said('x1'));
    has(v, 'within the share: x1 grew');
    has(v, 'the rule: shares row 1 is not byte-equal');
  });
  it('a design row on a landing that changes no frame asset reds', () => {
    has(judge(BASE, state(SHARES, [...GROWTH, row('x1', 1200)], baseManifest), said('x1')), 'changes no frame asset and appends a growth row');
  });
  it('a design name on an asset-free landing that appends nothing is clean', () => {
    expect(judge(BASE, state(SHARES, GROWTH, baseManifest), said('x1'))).toEqual([]);
  });
  it('a landing that changes assets and appends no row, or two rows, reds', () => {
    has(judge(BASE, state(SHARES, GROWTH, grown(5)), said('x1')), '0 growth rows appended');
    has(judge(BASE, state(SHARES, [...GROWTH, row('x1', 1205), row('x1', at(5).total)], grown(5)), said('x1')), '2 growth rows appended');
  });
  it('the appended row must name the word', () => {
    has(judge(BASE, state(SHARES, [...GROWTH, row('x2', at(5).total)], grown(5)), said('x1')), 'the appended row names "x2"');
  });
  it('a share row under a design word reds', () => {
    has(judge(BASE, state([...SHARES, row('x3', 5)], g1(5), grown(5)), said('x1')), 'a share row lands only under Size-Design: shares');
  });
});

describe('the rule: byte-equal in place, and the newest row is the recomputation', () => {
  it('an edited base row reds, in either table (and a dropped row)', () => {
    has(judge(BASE, state(SHARES, [row('baseline', 1160), row('x1', 1200)].map((r, i) => (i === 1 ? row('x1', 1201) : r)), baseManifest), said('none')), 'growth row 2 is not byte-equal');
    has(judge(BASE, state([row('x1', 201, 200), row('x2', 300, 300)], GROWTH, baseManifest), said('none')), 'shares row 1 is not byte-equal');
    has(judge(BASE, state(SHARES, [GROWTH[0] as Row], baseManifest), said('none')), 'the growth table dropped rows');
  });
  it('a newest row that is not the recomputation reds', () => {
    has(judge(BASE, state(SHARES, [...GROWTH, row('x1', 1210)], grown(11)), said('x1')), 'the newest growth row is not the recomputation');
    has(judge(BASE, state(SHARES, GROWTH, grown(10)), said('x1')), 'the newest growth row is not the recomputation');
  });
  it('a frame total off while the total is right reds', () => {
    has(judge(BASE, state(SHARES, [...GROWTH, row('x1', at(5).total, at(5).frame + 1)], grown(5)), said('x1')), 'not the recomputation');
  });
});

describe('none', () => {
  it('is clean on a landing that changes nothing and appends nothing', () => expect(judge(BASE, state(SHARES, GROWTH, baseManifest), said('none'))).toEqual([]));
  it('reds on a changed asset, an appended growth row or an appended share row', () => {
    has(judge(BASE, state(SHARES, [...GROWTH, row('x1', at(5).total)], grown(5)), said('none')), 'none: the landing changes a frame asset');
    has(judge(BASE, state(SHARES, [...GROWTH, row('x1', 1200)], baseManifest), said('none')), 'none: the landing appends a growth row');
    has(judge(BASE, state([...SHARES, row('x3', 5)], GROWTH, baseManifest), said('none')), 'none: the landing appends a share row');
  });
});

describe('rebaseline', () => {
  const g = (d: number): Row[] => [...GROWTH, row('rebaseline', at(d).total, at(d).frame)];
  it('one row named rebaseline needs no share row and counts against no design', () => {
    expect(judge(BASE, state(SHARES, g(5000), grown(5000)), said('rebaseline'))).toEqual([]);
  });
  it('reds on no row, two rows, a row of another name, or a share row', () => {
    has(judge(BASE, state(SHARES, GROWTH, grown(5)), said('rebaseline')), 'rebaseline: 0 growth rows');
    has(judge(BASE, state(SHARES, [...g(5), row('rebaseline', at(5).total)], grown(5)), said('rebaseline')), 'rebaseline: 2 growth rows');
    has(judge(BASE, state(SHARES, [...GROWTH, row('x1', at(5).total)], grown(5)), said('rebaseline')), 'the appended row is not named rebaseline');
    has(judge(BASE, state([...SHARES, row('x3', 5)], g(5), grown(5)), said('rebaseline')), 'rebaseline: the landing appends a share row');
  });
});

describe('correcting a row', () => {
  // x2 spent 40 that was x1's: the pair lowers x2's row by 40 and puts x1's at the newest again.
  const base = state(SHARES, [row('baseline', 1160), row('x1', 1200), row('x2', 1240)], man({ css: A('c', 130) }));
  const pair = (wrong: Row, right: Row): State => state(SHARES, [...(base.growth as unknown as { rows: Row[] }).rows, wrong, right], man({ css: A('c', 130) }));
  const good = (): State => pair(row('x2', 1200), row('x1', 1240));
  it('a pair that moves growth from the wrong design to the right one is clean', () => expect(judge(base, good(), said('correction'))).toEqual([]));
  it('the second row must equal the first parent\'s newest row on both totals', () => {
    has(judge(base, pair(row('x2', 1200), row('x1', 1241)), said('correction')), "the second row's totals are not the first parent's newest");
    has(judge(base, pair(row('x2', 1200, 1240), row('x1', 1240, 1239)), said('correction')), "the second row's totals are not the first parent's newest");
  });
  it('the second row must equal the recomputation at the judged commit (a landing that changes the assets reds)', () => {
    const moved = state(SHARES, [...(base.growth as unknown as { rows: Row[] }).rows, row('x2', 1200), row('x1', 1240)], man({ css: A('q', 130) }));
    has(judge(base, moved, said('correction')), 'correction: the landing changes a frame asset');
    const off = state(SHARES, [...(base.growth as unknown as { rows: Row[] }).rows, row('x2', 1200), row('x1', 1240)], man({ css: A('c', 131) }));
    has(judge(base, off, said('correction')), 'the second row is not the recomputation');
  });
  it('the first row is lowered, never raised', () => has(judge(base, pair(row('x2', 1250), row('x1', 1240)), said('correction')), 'the first row is not lowered'));
  it('one row, three rows, or the same design twice, red', () => {
    has(judge(base, state(SHARES, [...(base.growth as unknown as { rows: Row[] }).rows, row('x1', 1240)], man({ css: A('c', 130) })), said('correction')), 'correction: 1 growth rows');
    has(judge(base, pair(row('x2', 1200), row('x2', 1240)), said('correction')), 'both rows name the same design');
  });
  it('a row named by another reserved word reds: none, shares, correction, baseline', () => {
    for (const w of ['none', 'shares', 'correction', 'baseline']) {
      has(judge(base, pair(row(w, 1200), row('x1', 1240)), said('correction')), `a row names ${w}, a reserved word`);
      has(judge(base, pair(row('x2', 1200), row(w, 1240)), said('correction')), `a row names ${w}, a reserved word`);
    }
  });
  it('either side may be rebaseline; a side that is a design needs a share row at the first parent', () => {
    expect(judge(base, pair(row('x2', 1200), row('rebaseline', 1240)), said('correction'))).toEqual([]);
    has(judge(base, pair(row('x9', 1200), row('x1', 1240)), said('correction')), '"x9", which has no share row');
  });
  it("the right design's growth stays within its shares", () => {
    const tight = state([row('x1', 70, 70), row('x2', 300, 300)], (base.growth as unknown as { rows: Row[] }).rows.map((r) => r), man({ css: A('c', 130) }));
    has(judge(tight, pair(row('x2', 1200), row('x1', 1240)), said('correction')), 'within the share: x1 grew');
  });
  it('a share row on a correction reds', () => has(judge(base, state([...SHARES, row('x3', 5)], good().growth?.rows ?? [], man({ css: A('c', 130) })), said('correction')), 'correction: the landing appends a share row'));
});

describe('the shares table', () => {
  const sh = (rows: Row[]): State => state(rows, GROWTH, baseManifest);
  it('a shares-only landing appends share rows and nothing else', () => expect(judge(BASE, sh([...SHARES, row('x3', 500, 500)]), said('shares'))).toEqual([]));
  it('a superseding row at or above the design\'s growth is clean, below it reds (total and frame apart)', () => {
    // x1's growth at the base: 40 on both.
    expect(judge(BASE, sh([...SHARES, row('x1', 40, 40)]), said('shares'))).toEqual([]);
    has(judge(BASE, sh([...SHARES, row('x1', 39, 40)]), said('shares')), 'below its growth');
    has(judge(BASE, sh([...SHARES, row('x1', 40, 39)]), said('shares')), 'below its growth');
  });
  it('a shares landing that changes a frame asset, appends a growth row or appends no share row reds', () => {
    has(judge(BASE, state([...SHARES, row('x3', 5)], [...GROWTH, row('x1', at(5).total)], grown(5)), said('shares')), 'shares: the landing changes a frame asset');
    has(judge(BASE, state([...SHARES, row('x3', 5)], [...GROWTH, row('x1', 1200)], baseManifest), said('shares')), 'shares: the landing appends a growth row');
    has(judge(BASE, sh(SHARES), said('shares')), 'shares: the landing appends no share row');
  });
  it('a share row naming a reserved word reds', () => has(judge(BASE, sh([...SHARES, row('none', 5)]), said('shares')), 'none is a reserved word'));
});

describe('reserved words', () => {
  it('baseline is never a word after the genesis landing, nor a row name', () => {
    has(judge(BASE, state(SHARES, GROWTH, baseManifest), said('baseline')), 'baseline is reserved');
    has(judge(BASE, state(SHARES, [...GROWTH, row('baseline', at(5).total)], grown(5)), said('rebaseline')), 'baseline names only the genesis landing');
  });
});

describe('layouts', () => {
  const lay = (wide: number): Manifest => man({ css: A('c', 90), wide: A('w', wide, 'wide') });
  const run = (wide: number): string[] => {
    const m = lay(wide);
    const s = sizesOf(m);
    return judge(BASE, state(SHARES, [...GROWTH, row('rebaseline', s.total, s.frame)], m), said('rebaseline'));
  };
  it('a layout at most the default enhance bundle is clean (frame counts the largest layout once)', () => {
    expect(run(100)).toEqual([]);
    expect(sizesOf(lay(100))).toEqual({ total: 1300, frame: 1200 });
  });
  it('a layout larger than the default reds', () => has(run(101), 'layouts: wide is 101 characters, over the default enhance bundle\'s 100'));
  it("each layout is compared with the enhance entry's chars, not the default layout's sum (the default layout may hold more assets)", () => {
    const m = man({ css: A('c', 90), extra: A('x', 50, 'default'), wide: A('w', 120, 'wide') });
    const s = sizesOf(m);
    has(judge(BASE, state(SHARES, [...GROWTH, row('rebaseline', s.total, s.frame)], m), said('rebaseline')), "layouts: wide is 120 characters, over the default enhance bundle's 100");
  });
  it('a manifest with no default layout reds', () => has(judge(BASE, state(SHARES, GROWTH, man({ css: A('c', 90), enhance: A('b', 100) })), said('none')), 'marks no default layout'));
});

describe('the genesis landing: a first parent with neither table', () => {
  const parentManifest = { guard: A('a', 10), enhance: A('b', 90), css: A('c', 50), mermaid: A('d', 1000) }; // 1150, no layout field
  const parent = state(null, null, parentManifest);
  const headManifest = man();
  const head = sizesOf(headManifest);
  const growth = [row('baseline', 1150), row('x1', head.total, head.frame)];
  const good = (): State => state(GENESIS_SHARES, growth, headManifest);
  it('the shares fixture is this landing\'s own', () => expect(GENESIS_SHARES).toEqual([row('x1', 32768, 32768), row('x2', 1166336, 72704)]));
  it('is clean with the baseline, its own row and the two share rows, under x1', () => expect(judge(parent, good(), said('x1'))).toEqual([]));
  it('the word must be x1', () => has(judge(parent, good(), said('none')), 'the word is "x1"'));
  it('the baseline must equal the first parent\'s own manifest total', () => has(judge(parent, state(GENESIS_SHARES, [row('baseline', 1160), growth[1] as Row], headManifest), said('x1')), 'baseline row'));
  it('its own row must be the recomputation', () => has(judge(parent, state(GENESIS_SHARES, [growth[0] as Row, row('x1', head.total + 1, head.frame)], headManifest), said('x1')), 'its own row'));
  it('exactly two growth rows and exactly two share rows', () => {
    has(judge(parent, state(GENESIS_SHARES, [...growth, row('x1', head.total)], headManifest), said('x1')), 'growth table holds 3 rows');
    has(judge(parent, state(GENESIS_SHARES, [growth[0] as Row], headManifest), said('x1')), 'growth table holds 1 rows');
    has(judge(parent, state([...GENESIS_SHARES, row('x3', 5)], growth, headManifest), said('x1')), 'shares table holds 3 rows');
    has(judge(parent, state([GENESIS_SHARES[0] as Row], growth, headManifest), said('x1')), 'shares table holds 1 rows');
  });
  it('the shares are x1\'s and x2\'s figures', () => has(judge(parent, state([row('x1', 32768, 32768), row('x2', 1166336, 72705)], growth, headManifest), said('x1')), "x1's and x2's figures"));
  it("this landing's own growth is judged against the share rows it adds itself (x1's 32768: at it clean, over it red)", () => {
    const run = (extra: number): string[] => {
      const m = man({ mermaid: A('d', 1000 + extra) }); // the parent is 1150, the head 1160 + extra
      const z = sizesOf(m);
      return judge(parent, state(GENESIS_SHARES, [row('baseline', 1150), row('x1', z.total, z.frame)], m), said('x1'));
    };
    expect(run(32758)).toEqual([]);
    has(run(32759), 'genesis: x1 grew 32769');
  });
  // Review 2906 F6: the frame half of the share check has its own row. The pure rule accepts any first parent, and one with
  // two layouts (the frame counts the larger only) grows its frame without its total when a layout merges into the other.
  it("this landing's own growth: a frame that grows past x1's share with the total unchanged reds on the frame alone", () => {
    const two = { enhance: A('b', 40000, 'default'), wide: A('w', 40000, 'wide') }; // total 80000, frame 40000
    const merged = { enhance: A('e', 80000, 'default') }; // total 80000, frame 80000
    const p = state(null, null, two);
    const z = sizesOf(merged);
    const v = judge(p, state(GENESIS_SHARES, [row('baseline', 80000, 40000), row('x1', z.total, z.frame)], merged), said('x1'));
    expect(v).toEqual(['genesis: x1 grew 0 total and 40000 frame, over its own share of 32768 and 32768']);
  });
  it('a head without the tables, or a parent with only one, reds', () => {
    has(judge(parent, state(null, growth, headManifest), said('x1')), 'lacks the shares table');
    has(judge(state(SHARES, null, parentManifest), good(), said('x1')), 'one of the two tables');
  });
});
