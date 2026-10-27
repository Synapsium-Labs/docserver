// Verdicts (docserver L1, Task 11; architecture sections D, E and F). Each arm of evaluateVerdict, passing and
// failing, on hand-written html; parseVerdict's refusals; and the verdict key list, which scripts/ratchet.mjs
// keeps a copy of. Every non-ASCII character is written as a \u escape.
import { describe, expect, it } from 'vitest';
import { VERDICT_KEYS as RATCHET_KEYS } from '../scripts/ratchet.mjs';
import {
  evaluateVerdict,
  imbalance,
  parseVerdict,
  tagDepth,
  VERDICT_KEYS,
  type Verdict,
  type VerdictContext,
} from '../src/conformance/verdict.js';
import type { RenderMeta, RenderResult, ScanRefsResult } from '../src/render/types.js';

const META: RenderMeta = {
  front: null,
  frontList: null,
  title: null,
  headings: [],
  figures: 0,
  tables: 0,
  mermaidKinds: [],
};

function result(html: string, over: Partial<RenderResult> = {}): RenderResult {
  return { html, outcome: 'rendered', bytes: 0, meta: META, ...over };
}

/** The failures of `verdict` on `html` (outcome 'rendered', input 'abcd', 1 ms unless given). */
function judge(verdict: Omit<Verdict, 'outcome'> & { outcome?: Verdict['outcome'] }, html: string, ctx: VerdictContext = { ms: 1 }, input = 'abcd'): string[] {
  return evaluateVerdict(result(html), input, { outcome: 'rendered', ...verdict }, ctx);
}

const SCAN: ScanRefsResult = {
  outcome: 'scanned',
  images: Array.from({ length: 512 }, (_, i) => `${i}.png`),
  imagesTruncated: true,
  mermaid: { fences: 0, largestBytes: 0, totalBytes: 0, largestChars: 0, totalChars: 0 },
};

describe('outcome', () => {
  it('must equal the render outcome', () => {
    expect(judge({}, '<p>a</p>')).toEqual([]);
    expect(judge({ outcome: 'failed' }, '<p>a</p>')).toEqual(['outcome: expected "failed", got "rendered"']);
  });

  it('an over-limit render has empty html', () => {
    const over = (html: string): string[] =>
      evaluateVerdict(result(html, { outcome: 'over-limit' }), 'x', { outcome: 'over-limit' }, { ms: 1 });
    expect(over('')).toEqual([]);
    expect(over('<p>')).toEqual(['outcome: an over-limit render has empty html, got 3 characters']);
  });
});

describe('maxMs', () => {
  it('bounds the render time, the bound included', () => {
    expect(judge({ maxMs: 1000 }, '', { ms: 1000 })).toEqual([]);
    expect(judge({ maxMs: 1000 }, '', { ms: 1000.5 })).toEqual(['maxMs: took 1000.5 ms, bound 1000 ms']);
    expect(judge({ maxMs: 1000 }, '', { ms: Number.NaN })).toEqual(['maxMs: took NaN ms, bound 1000 ms']);
  });

  it('timeScale multiplies the bound, never the verdict', () => {
    expect(judge({ maxMs: 1000 }, '', { ms: 1500, timeScale: 2 })).toEqual([]);
    expect(judge({ maxMs: 1000 }, '', { ms: 600, timeScale: 0.5 })).toEqual(['maxMs: took 600.0 ms, bound 500 ms']);
  });
});

describe('maxOutputRatio', () => {
  it('bounds UTF-8 output bytes over UTF-8 input bytes', () => {
    expect(judge({ maxOutputRatio: 2 }, 'x'.repeat(8))).toEqual([]);
    expect(judge({ maxOutputRatio: 2 }, 'x'.repeat(9))).toEqual([
      'maxOutputRatio: output is 2.250 times the input, bound 2',
    ]);
    expect(judge({ maxOutputRatio: 2 }, '\u00e9\u00e9', { ms: 1 }, '\u00e9')).toEqual([]);
    expect(judge({ maxOutputRatio: 2 }, '\u00e9\u00e9a', { ms: 1 }, '\u00e9')).toEqual([
      'maxOutputRatio: output is 2.500 times the input, bound 2',
    ]);
  });

  it('an empty input counts as one byte', () => {
    expect(judge({ maxOutputRatio: 3 }, 'abc', { ms: 1 }, '')).toEqual([]);
    expect(judge({ maxOutputRatio: 3 }, 'abcd', { ms: 1 }, '')).toEqual([
      'maxOutputRatio: output is 4.000 times the input, bound 3',
    ]);
  });
});

describe('maxTagDepth', () => {
  it('is the deepest nesting of one element, siblings and other elements apart', () => {
    expect(tagDepth('<blockquote>\n<blockquote>\n</blockquote>\n</blockquote>\n<blockquote>\n</blockquote>', 'blockquote')).toBe(2);
    expect(tagDepth('<em>a</em><em>b</em><em>c</em>', 'em')).toBe(1);
    expect(tagDepth('<div><p><div data-line="1-1"></div></p></div>', 'div')).toBe(2);
    expect(tagDepth('<details open>\n<details>\n', 'details')).toBe(2);
    expect(tagDepth('<br /><br /><br />', 'br')).toBe(0);
    expect(tagDepth('<p>&lt;em&gt;&lt;em&gt;</p>', 'em')).toBe(0);
    expect(tagDepth('<emph><em></em></emph>', 'em')).toBe(1);
  });

  it('fails each element over its bound', () => {
    const html = '<blockquote><blockquote><em><em>x</em></em></blockquote></blockquote>';
    expect(judge({ maxTagDepth: { blockquote: 2, em: 2 } }, html)).toEqual([]);
    expect(judge({ maxTagDepth: { blockquote: 1, em: 1 } }, html)).toEqual([
      'maxTagDepth: blockquote nests 2 deep, bound 1',
      'maxTagDepth: em nests 2 deep, bound 1',
    ]);
  });
});

describe('forbid', () => {
  it('fails on a forbidden string in any ASCII case', () => {
    expect(judge({ forbid: ['<script'] }, '<p>&lt;script&gt;</p>')).toEqual([]);
    expect(judge({ forbid: ['<script'] }, '<p><SCRIPT>')).toEqual(['forbid: the html contains "<script"']);
    expect(judge({ forbid: ['<SCRIPT', ' onerror="'] }, '<script> <img onError="x">')).toEqual([
      'forbid: the html contains "<SCRIPT"',
      'forbid: the html contains " onerror=\\""',
    ]);
  });

  it('folds ASCII letters only', () => {
    // U+212A KELVIN SIGN lower-cases to k in Unicode, but it is not markup.
    expect(judge({ forbid: ['<kbd'] }, '<p>&lt;\u212abd&gt;</p><\u212abd')).toEqual([]);
  });
});

describe('require', () => {
  it('fails on a missing string, compared exactly', () => {
    expect(judge({ require: ['<p>A</p>'] }, '<p>A</p>')).toEqual([]);
    expect(judge({ require: ['<p>a</p>', '<p>A'] }, '<p>A</p>')).toEqual(['require: the html lacks "<p>a</p>"']);
  });
});

describe('balanced', () => {
  it('passes when every opening tag has its closer, in order', () => {
    expect(imbalance('<details open>\n<details>\n</details>\n</details>\n', 'details')).toBeNull();
    expect(judge({ balanced: ['details', 'div'] }, '<div><details></details></div>')).toEqual([]);
  });

  it('fails on a missing closer and on a closer before its opener', () => {
    expect(judge({ balanced: ['details'] }, '<details>\n<details>\n</details>\n')).toEqual([
      'balanced: details opens 2 times and closes 1 times',
    ]);
    expect(judge({ balanced: ['details'] }, '</details>\n<details>\n')).toEqual([
      'balanced: </details> number 1 comes before its opening tag',
    ]);
  });
});

describe('headingIds', () => {
  const html = '<h1 id="a">a</h1>\n<h2 id="a-1" data-line="3-3">a</h2>\n<h6 id="a-2">a</h6>\n';

  it('the ids are base, base-1, base-2, in order', () => {
    expect(judge({ headingIds: { base: 'a', count: 3 } }, html)).toEqual([]);
    expect(judge({ headingIds: { base: 'a&b', count: 1 } }, '<h1 id="a&amp;b">x</h1>')).toEqual([]);
  });

  it('fails on a count or an id that differs', () => {
    expect(judge({ headingIds: { base: 'a', count: 4 } }, html)).toEqual(['headingIds: expected 4 headings, found 3']);
    expect(judge({ headingIds: { base: 'a', count: 3 } }, html.replace('a-1', 'a-9'))).toEqual([
      'headingIds: heading 1 has id "a-9", expected "a-1"',
    ]);
    expect(judge({ headingIds: { base: 'b', count: 3 } }, html)).toEqual([
      'headingIds: heading 0 has id "a", expected "b"',
    ]);
  });
});

describe('scan', () => {
  const want = { maxImages: 512, imagesTruncated: true };

  it('passes when scanRefs reports at most maxImages and the stated truncation', () => {
    expect(judge({ scan: want }, '', { ms: 1, scan: SCAN })).toEqual([]);
  });

  it('fails without a scanRefs result, and on each field', () => {
    expect(judge({ scan: want }, '', { ms: 1, scan: null })).toEqual([
      'scan: no scanRefs function was given; pass runCorpus(render, { scanRefs })',
    ]);
    expect(judge({ scan: want }, '')).toEqual([
      'scan: no scanRefs function was given; pass runCorpus(render, { scanRefs })',
    ]);
    const wrong: ScanRefsResult = { ...SCAN, outcome: 'over-limit', images: [...SCAN.images, 'x'], imagesTruncated: false };
    expect(judge({ scan: want }, '', { ms: 1, scan: wrong })).toEqual([
      'scan: outcome expected "scanned", got "over-limit"',
      'scan: 513 images, bound 512',
      'scan: imagesTruncated expected true, got false',
    ]);
  });
});

describe('nullPrototypeFront', () => {
  const withFront = (front: RenderMeta['front']): string[] =>
    evaluateVerdict(result('', { meta: { ...META, front } }), 'x', { outcome: 'rendered', nullPrototypeFront: true }, { ms: 1 });

  it('meta.front must be a record with a null prototype', () => {
    const front = Object.create(null) as Record<string, string>;
    front['__proto__'] = 'x';
    expect(withFront(front)).toEqual([]);
    expect(withFront({ a: 'x' })).toEqual(['nullPrototypeFront: meta.front is not a null-prototype record']);
    expect(withFront(null)).toEqual(['nullPrototypeFront: meta.front is not a null-prototype record']);
  });
});

describe('every failed arm is listed, in order', () => {
  it('outcome, maxOutputRatio, forbid, require, balanced', () => {
    const v: Verdict = { outcome: 'failed', maxOutputRatio: 1, forbid: ['<b'], require: ['<i>'], balanced: ['b'] };
    expect(evaluateVerdict(result('<b><b>xx</b>'), 'a', v, { ms: 1 }).map((l) => l.split(':')[0])).toEqual([
      'outcome',
      'maxOutputRatio',
      'forbid',
      'require',
      'balanced',
    ]);
  });
});

describe('parseVerdict', () => {
  it('reads a verdict with every arm', () => {
    const v = {
      outcome: 'rendered',
      maxMs: 1000,
      maxOutputRatio: 2.5,
      maxTagDepth: { blockquote: 20, h1: 0 },
      forbid: ['<script'],
      require: ['<p>'],
      balanced: ['details'],
      exact: true,
      headingIds: { base: 'a', count: 2 },
      scan: { maxImages: 0, imagesTruncated: false },
      nullPrototypeFront: true,
    };
    expect(parseVerdict(v, 'here')).toEqual(v);
  });

  const bad: [string, unknown, RegExp][] = [
    ['not an object', null, /here: the verdict is not an object/],
    ['a list', [], /not an object/],
    ['an unknown key', { outcome: 'rendered', maxDepth: 1 }, /unknown verdict keys: maxDepth/],
    ['no outcome', {}, /outcome must be rendered, over-limit, output-over-limit or failed/],
    ['an unknown outcome', { outcome: 'ok' }, /outcome must be/],
    ['maxMs 0', { outcome: 'rendered', maxMs: 0 }, /maxMs must be a positive integer/],
    ['a fractional maxMs', { outcome: 'rendered', maxMs: 1.5 }, /maxMs/],
    ['a string maxMs', { outcome: 'rendered', maxMs: '1' }, /maxMs/],
    ['maxOutputRatio 0', { outcome: 'rendered', maxOutputRatio: 0 }, /maxOutputRatio must be a positive number/],
    ['an infinite maxOutputRatio', { outcome: 'rendered', maxOutputRatio: Infinity }, /maxOutputRatio/],
    ['an upper-case tag in maxTagDepth', { outcome: 'rendered', maxTagDepth: { EM: 1 } }, /maxTagDepth must map/],
    ['a negative depth', { outcome: 'rendered', maxTagDepth: { em: -1 } }, /maxTagDepth/],
    ['an empty forbidden string', { outcome: 'rendered', forbid: [''] }, /forbid must be a list of non-empty strings/],
    ['a forbidden string twice', { outcome: 'rendered', forbid: ['a', 'a'] }, /forbid lists a value twice/],
    ['a require that is not a list', { outcome: 'rendered', require: '<p>' }, /require must be a list/],
    ['a balanced name that is not a tag', { outcome: 'rendered', balanced: ['<div'] }, /balanced must be a list of non-empty tag names/],
    ['exact false', { outcome: 'rendered', exact: false }, /exact is true or absent/],
    ['nullPrototypeFront 1', { outcome: 'rendered', nullPrototypeFront: 1 }, /nullPrototypeFront is true or absent/],
    ['headingIds without a count', { outcome: 'rendered', headingIds: { base: 'a' } }, /headingIds must be/],
    ['headingIds with count 0', { outcome: 'rendered', headingIds: { base: 'a', count: 0 } }, /headingIds/],
    ['a scan without imagesTruncated', { outcome: 'rendered', scan: { maxImages: 1 } }, /scan must be/],
  ];
  for (const [name, raw, message] of bad) {
    it(`refuses ${name}`, () => {
      expect(() => parseVerdict(raw, 'here')).toThrow(message);
    });
  }
});

describe('VERDICT_KEYS', () => {
  it('lists every arm, and scripts/ratchet.mjs knows exactly these', () => {
    expect([...VERDICT_KEYS]).toEqual([
      'outcome',
      'maxMs',
      'maxOutputRatio',
      'maxTagDepth',
      'forbid',
      'require',
      'balanced',
      'exact',
      'headingIds',
      'scan',
      'nullPrototypeFront',
    ]);
    expect([...RATCHET_KEYS]).toEqual([...VERDICT_KEYS]);
  });
});
