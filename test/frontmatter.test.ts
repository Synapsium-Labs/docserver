// Front matter (docserver L1, Task 9; architecture section C, the "Front matter" row; contract section 2.12;
// ruling C1's departures PD2, PD3 and PD4). Every expected html string in the first block was produced by
// the reference renderer from the same input and is compared after normaliseForCompare (it only touches
// code blocks). The later blocks pin the three departures, meta.front and meta.frontList, the limits, and
// the rule's place in the engine. Every non-ASCII character is written as a \u escape.
import { describe, expect, it } from 'vitest';
import { normaliseForCompare } from '../src/conformance/normalise.js';
import { checkOutputSafety } from '../src/conformance/oracle.js';
import { createEngine } from '../src/render/engine.js';
import { createEnv } from '../src/render/env.js';
import { FM_MAX_CHARS, frontRecord, parseFrontMatter } from '../src/render/frontMatter.js';
import { cpLength } from '../src/render/pyText.js';
import { render } from '../src/render/index.js';
import type { FrontEntry } from '../src/render/types.js';

type Case = readonly [name: string, src: string, html: string];

function cases(list: readonly Case[]): void {
  for (const [name, src, html] of list) {
    it(name, () => {
      expect(normaliseForCompare(render(src).html)).toBe(html);
    });
  }
}

const dl = (line: string, items: string): string => `<dl class="doc-meta" data-line="${line}">${items}</dl>\n`;
const item = (k: string, v: string): string => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
const scalar = (key: string, v: string): FrontEntry => ({ key, list: false, vals: [v] });
const A1 = dl('1-3', item('a', '1'));

describe('front matter: against the reference', () => {
  cases([
    [
      'a mapping renders the strip; the hidden token puts a line feed before a heading',
      '---\ntitle: T\n---\n# H\n\n```py\nx\n```\n',
      dl('1-3', item('title', 'T')) +
        '\n<h1 id="h" data-line="4-4">H</h1>\n<div class="codehilite" data-line="6-8"><pre>x\n</pre></div>\n',
    ],
    [
      'the line feed comes before a table, a list and a blockquote',
      '---\na: 1\n---\n| a |\n|---|\n| b |\n\n- x\n\n> q\n',
      `${A1}\n<div class="table-wrapper"><table data-line="4-6">\n<thead>\n<tr data-line="4-4">\n<th>a</th>\n</tr>\n` +
        '</thead>\n<tbody>\n<tr data-line="6-6">\n<td>b</td>\n</tr>\n</tbody>\n</table></div>\n' +
        '<ul data-line="8-9">\n<li data-line="8-9">x</li>\n</ul>\n<blockquote data-line="10-10">\n' +
        '<p data-line="10-10">q</p>\n</blockquote>\n',
    ],
    [
      'and not before a figure, a details line or indented code, which render through their own rules',
      '---\na: 1\n---\n```mermaid\nA\n```\n',
      `${A1}<figure class="mermaid-figure" data-line="4-6"><pre class="mermaid">A\n</pre></figure>\n`,
    ],
    [
      'a details line after the block',
      '---\na: 1\n---\n<details>\n<summary>S</summary>\n</details>\n',
      `${A1}<details>\n<summary>S</summary>\n</details>\n`,
    ],
    ['indented code after the block', '---\na: 1\n---\n    code\n', `${A1}<pre data-line="4-4"><code>code\n</code></pre>\n`],
    [
      'a `...` line closes the block and stays in its content',
      '---\na: 1\n...\n# H\n',
      `${A1}\n<h1 id="h" data-line="4-4">H</h1>\n`,
    ],
    [
      'a `...` line with no line after it closes nothing',
      '---\na: 1\n...',
      '<hr data-line="1-1" />\n<p data-line="2-3">a: 1\n...</p>\n',
    ],
    [
      'the closer needs at least as many dashes as the opener; the text between two `---` lines is the block',
      '----\na: 1\n---\nb: 2\n-----\n\nx\n',
      '\n<p data-line="7-7">x</p>\n',
    ],
    [
      'a closer indented four spaces is skipped, three spaces close; the skipped line is YAML text',
      '---\na: 1\n    ---\n   ---\n',
      dl('1-4', item('a', '1 ---')),
    ],
    ['spaces or a tab may follow the closing dashes', '---\na: 1\n---\t\n\nx\n', `${A1}\n<p data-line="5-5">x</p>\n`],
    [
      'anything else after them is no closer, and an unclosed block is no front matter',
      '---\na: 1\n---x\n\nx\n',
      '<hr data-line="1-1" />\n<p data-line="2-3">a: 1\n---x</p>\n<p data-line="5-5">x</p>\n',
    ],
    ['two dashes open nothing', '--\na: 1\n--\n', '<h2 id="--a-1" data-line="1-3">--\na: 1</h2>\n'],
    [
      'only at line 0: a later pair of `---` lines is a thematic break and a setext heading',
      '---\na: 1\n---\n\n---\nb: 2\n---\n',
      `${A1}\n<hr data-line="5-5" />\n<h2 id="b-2" data-line="6-7">b: 2</h2>\n`,
    ],
    [
      'the source must start with a dash: a blockquote at line 0 holds no front matter',
      '> ---\n> a: 1\n> ---\n',
      '<blockquote data-line="1-3">\n<hr data-line="1-1" />\n<h2 id="a-1" data-line="2-3">a: 1</h2>\n</blockquote>\n',
    ],
    [
      'but a list item at line 0 can, inside its own blockquote (the reference reads state.src[0])',
      '- > ---\n  > a: 1\n  > ---\n- b\n',
      '<ul data-line="1-4">\n<li data-line="1-3">\n<blockquote data-line="1-3">' +
        `${A1}</blockquote>\n</li>\n<li data-line="4-4">b</li>\n</ul>\n`,
    ],
    [
      'an empty block, or a block of `...` alone, renders nothing but the line feed',
      '---\n---\n\nx\n',
      '\n<p data-line="4-4">x</p>\n',
    ],
    [
      'a list value joins its items, skipping nested ones; a mapping value is an ellipsis',
      '---\nk: [a, [b], {c: 1}, d]\nm: {x: 1}\n---\n',
      dl('1-4', item('k', 'a, d') + item('m', '\u2026')),
    ],
    [
      'a duplicate key keeps its first place and takes its last value',
      '---\na: 1\nb: 2\na: 3\n---\n',
      dl('1-5', item('a', '3') + item('b', '2')),
    ],
    [
      'the merge key merges, as PyYAML does when it comes first',
      '---\n<<: {z: 1}\nbase: &b {x: 1, y: 2}\nm:\n  <<: *b\n  y: 3\nlist: [*b]\n---\n',
      dl('1-8', item('z', '1') + item('base', '\u2026') + item('m', '\u2026') + item('list', '')),
    ],
    ['an empty mapping renders nothing', '---\n{}\n---\n', ''],
  ]);

  it('meta.frontList equals the reference where its raw-text pattern found the same block', () => {
    expect(render('---\ntitle: T\n---\n# H\n').meta.frontList).toEqual([scalar('title', 'T')]);
    expect(render('---\nk: [a, [b], {c: 1}, d]\nm: {x: 1}\n---\n').meta.frontList).toEqual([
      { key: 'k', list: true, vals: ['a', 'd'] },
    ]);
    expect(render('---\na: 1\nb: 2\na: 3\n---\n').meta.frontList).toEqual([scalar('a', '3'), scalar('b', '2')]);
    expect(render('---\n{}\n---\n').meta.frontList).toEqual([]);
    expect(render('---\nbase: &b {x: 1, y: 2}\nm:\n  <<: *b\n  y: 3\n---\n').meta.frontList).toEqual([]);
  });
});

describe('PD2: scalars render their source text, without Python (rulings C1 and C16)', () => {
  const SRC =
    '---\nn: null\nt: ~\ne:\nb: true\nB: False\ny: yes\nN: no\non: off\nd: 2026-10-12\n' +
    'dt: 2026-10-12 08:00:00\no: 017\ns: 1:30\nl: [~, false]\n---\n';

  it("null is '', booleans are true/false, yes/no/on/off, timestamps, 017 and 1:30 stay as written", () => {
    expect(render(SRC).html).toBe(
      dl(
        '1-15',
        item('n', '') +
          item('t', '') +
          item('e', '') +
          item('b', 'true') +
          item('B', 'false') +
          item('y', 'yes') +
          item('N', 'no') +
          item('on', 'off') +
          item('d', '2026-10-12') +
          item('dt', '2026-10-12 08:00:00') +
          item('o', '017') +
          item('s', '1:30') +
          item('l', ', false'),
      ),
    );
  });

  it('meta skips null values, as the reference did, and lists a null item as an empty string', () => {
    expect(render(SRC).meta.frontList?.map((e) => `${e.key}=${e.vals.join('|')}`)).toEqual([
      'b=true',
      'B=false',
      'y=yes',
      'N=no',
      'on=off',
      'd=2026-10-12',
      'dt=2026-10-12 08:00:00',
      'o=017',
      's=1:30',
      'l=|false',
    ]);
  });

  it('the schema reads a date, yes and a number as strings', () => {
    const data = parseFrontMatter('d: 2026-10-12\ny: yes\nt: 2026-10-12T08:00:00Z\nv: 1.0');
    expect(data).toEqual({ d: '2026-10-12', y: 'yes', t: '2026-10-12T08:00:00Z', v: '1.0' });
    expect(typeof data?.['d']).toBe('string');
    expect(typeof data?.['v']).toBe('string');
  });

  it('numbers render as written (ruling C16): 1.0, .inf, a 20-digit integer, 0o17; true is true, null is empty', () => {
    const src =
      '---\nversion: 1.0\ninf: .inf\nbig: 12345678901234567890\noct: 0o17\nt: true\nn: null\n' +
      'hex: 0x1F\nexp: 1e3\nneg: -.5\nund: 1_000\nl: [1.50, ~, TRUE, .nan]\n---\n';
    const r = render(src);
    expect(r.html).toBe(
      dl(
        '1-13',
        item('version', '1.0') +
          item('inf', '.inf') +
          item('big', '12345678901234567890') +
          item('oct', '0o17') +
          item('t', 'true') +
          item('n', '') +
          item('hex', '0x1F') +
          item('exp', '1e3') +
          item('neg', '-.5') +
          item('und', '1_000') +
          item('l', '1.50, , true, .nan'),
      ),
    );
    expect({ ...r.meta.front }).toEqual({
      version: '1.0',
      inf: '.inf',
      big: '12345678901234567890',
      oct: '0o17',
      t: 'true',
      hex: '0x1F',
      exp: '1e3',
      neg: '-.5',
      und: '1_000',
      l: ['1.50', '', 'true', '.nan'],
    });
  });

  it('tags outside the schema fail the load: the block renders nothing and meta is null', () => {
    for (const v of ['!!int 3', '!!float 1.5', '!!binary aGVsbG8=', '!!set {a, b}', '!!timestamp 2026-10-12', "!!js/function 'f'"]) {
      const r = render(`---\nk: ${v}\n---\n`);
      expect([r.html, r.meta.frontList, r.meta.front]).toEqual(['', null, null]);
    }
  });

  // Ruling C17: the loader differences PD2 also covers. Each case notes what the reference rendered.
  it('C17 (a): integer-like keys are listed first, where the reference kept document order', () => {
    const r = render('---\na: y\n2: x\n---\n');
    expect(r.html).toBe(dl('1-4', item('2', 'x') + item('a', 'y')));
    expect(r.meta.frontList?.map((e) => e.key)).toEqual(['2', 'a']);
  });

  it('C17 (b): a last block scalar keeps its trailing line feed, where the reference dropped it', () => {
    expect(render('---\nk: v\na: |\n  x\n---\n').html).toBe(dl('1-5', item('k', 'v') + item('a', 'x\n')));
  });

  it('C17 (c): a sequence key loads as its items joined by commas, where the reference rendered nothing', () => {
    expect(render('---\n? [a, b]\n: v\n---\n').html).toBe(dl('1-4', item('a,b', 'v')));
  });

  it('C17 (d): nesting deeper than 100 levels fails the load, where the reference read it', () => {
    const nested = (n: number): string => `---\nk: ${'['.repeat(n)}${']'.repeat(n)}\n---\n`;
    expect(render(nested(99)).html).toBe(dl('1-3', item('k', '')));
    const r = render(nested(100));
    expect([r.html, r.meta.frontList]).toEqual(['', null]);
  });

  it('C17 (e): a late merge key puts the merged keys last, where the reference put them first', () => {
    expect(render('---\na: 1\n<<: {b: 2}\n---\n').html).toBe(dl('1-4', item('a', '1') + item('b', '2')));
    expect(render('---\n<<: {b: 2}\na: 1\n---\n').html).toBe(dl('1-4', item('b', '2') + item('a', '1')));
  });

  it("C17 (e): a multi-source `<<` list keeps its sources' order, where the reference reversed the sources", () => {
    // Reference (PyYAML), measured on the same inputs: the keys come out b, a, x for the first and a, b, c for
    // the second.
    const referenceFirst = dl('1-4', item('b', '2') + item('a', '1') + item('x', '0'));
    const referenceSecond = dl('1-3', item('a', '1') + item('b', '2') + item('c', '1'));
    const first = render('---\nx: 0\n<<: [{a: 1}, {b: 2}]\n---\n');
    expect(first.html).toBe(dl('1-4', item('x', '0') + item('a', '1') + item('b', '2')));
    expect(first.html).not.toBe(referenceFirst);
    expect(first.meta.frontList?.map((e) => e.key)).toEqual(['x', 'a', 'b']);
    // Both sources give `a`: the earlier source wins, a=1, in the reference and here; only the order differs.
    const second = render('---\n<<: [{a: 1, c: 1}, {a: 2, b: 2}]\n---\n');
    expect(second.html).toBe(dl('1-3', item('a', '1') + item('c', '1') + item('b', '2')));
    expect(second.html).not.toBe(referenceSecond);
    expect(second.meta.frontList).toEqual([scalar('a', '1'), scalar('c', '1'), scalar('b', '2')]);
  });

  it('C17: U+0085 is not a line break, so this value fails the load, where the reference read two keys', () => {
    const r = render('---\na: x\u0085b: y\n---\n');
    expect([r.html, r.meta.frontList]).toEqual(['', null]);
  });
});

// Ruling C33: a key that is a mapping, or a sequence key that holds one, fails the load, through the same
// path as a tag outside the schema (js-yaml would read it as the text `[object Object]`). The reference
// (PyYAML) cannot hash a mapping and refuses the whole block, so it rendered nothing and meta was null.
describe('PD2: a mapping key fails the load, as in the reference (ruling C33)', () => {
  const failed = (src: string): void => {
    const r = render(src);
    expect([r.html, r.meta.frontList, r.meta.front]).toEqual(['', null, null]);
  };
  const tag = render('---\nk: !!int 3\n---\n');

  it('the failure is the one a tag outside the schema gives: the same html and meta', () => {
    const r = render('---\n? {a: 1}\n: v\n---\n');
    expect([r.html, r.meta.frontList, r.meta.front]).toEqual([tag.html, tag.meta.frontList, tag.meta.front]);
    expect(r.html).toBe('');
  });

  it('a mapping as a key, in block and in flow style', () => {
    failed('---\n? {a: 1}\n: v\n---\n');
    failed('---\n? a: 1\n: v\n---\n');
    failed('---\n? {}\n: v\n---\n');
    failed('---\n{? {a: 1} : v}\n---\n');
  });

  it('a sequence key that holds a mapping', () => {
    failed('---\n? [x, {a: 1}]\n: v\n---\n');
    failed('---\n? [{a: 1}]\n: v\n---\n');
    failed('---\n? [x, y, {}]\n: v\n---\n');
  });

  // Inside a flow sequence, `a: 1` is a single-pair mapping that js-yaml pushes straight into the array; it is
  // never a node's own result. Measured with the reference: each of these four renders nothing, meta null.
  it('a sequence key that holds a single-pair mapping of a flow sequence', () => {
    failed('---\n? [x, a: 1]\n: v\n---\n');
    failed('---\n? [a: 1]\n: v\n---\n');
    failed('---\n{[a: 1]: v}\n---\n');
    failed('---\n? [? a : 1]\n: v\n---\n');
  });

  // js-yaml stores a flow sequence's anchor when the sequence opens, so an alias inside it returns the array
  // while it is still being read. The alias is heard first, with the array short; the pair mappings pushed after
  // it must still be marked when the sequence closes. Measured with the reference: all three render nothing.
  it('a self-aliasing flow sequence used as a key still has its later single-pair mappings refused', () => {
    failed('---\na: &a [c: *a, b: 1]\n? *a\n: v\n---\n');
    failed('---\na: &a [*a : 1, b: 1]\n? *a\n: v\n---\n');
    failed('---\na: &a [? *a , b: 1]\n? *a\n: v\n---\n');
  });

  it('control: the same self-aliasing sequence as a value loads (the reference reads it too)', () => {
    // Reference: <dl><div><dt>a</dt><dd></dd></div><div><dt>z</dt><dd></dd></div></dl>.
    const r = render('---\na: &a [c: *a, b: 1]\nz: *a\n---\n');
    expect(r.html).toBe(dl('1-4', item('a', '') + item('z', '')));
    expect(r.meta.frontList).toEqual([
      { key: 'a', list: true, vals: [] },
      { key: 'z', list: true, vals: [] },
    ]);
  });

  it('controls: the same single-pair mapping as a value, or in a merge, loads as before', () => {
    expect(render('---\nk: [a: 1, b]\n---\n').html).toBe(dl('1-3', item('k', 'b')));
    expect(render('---\nk: [a: 1]\nz: 2\n---\n').html).toBe(dl('1-4', item('k', '') + item('z', '2')));
    expect(render('---\n<<: [{a: 1}]\n---\n').html).toBe(dl('1-3', item('a', '1')));
  });

  it('a mapping key anywhere in the block fails the whole block, among good keys and inside a value', () => {
    failed('---\nq: 1\n? {a: 1}\n: v\n---\n');
    failed('---\n? {a: 1}\n: v\nq: 1\n---\n');
    failed('---\nq: {? {a: 1} : v}\n---\n');
    failed('---\nq: [{? [x, {a: 1}] : v}]\n---\n');
  });

  it('a mapping reached through an alias or an explicit tag is still a mapping key', () => {
    failed('---\nm: &m {a: 1}\n? *m\n: v\n---\n');
    failed('---\n? !!map {a: 1}\n: v\n---\n');
  });

  it('controls: a plain sequence key still loads as joined text (C17 (c)), and mappings elsewhere are untouched', () => {
    expect(render('---\n? [a, b]\n: v\n---\n').html).toBe(dl('1-4', item('a,b', 'v')));
    expect(render('---\nm: {a: 1}\nl: [{b: 2}, c]\n---\n').html).toBe(dl('1-4', item('m', '\u2026') + item('l', 'c')));
    expect(render('---\na: 1\n<<: {b: 2}\n---\n').html).toBe(dl('1-4', item('a', '1') + item('b', '2')));
    expect(render('---\nm: &m {a: 1}\nn: *m\n---\n').html).toBe(dl('1-4', item('m', '\u2026') + item('n', '\u2026')));
  });

  it('the loaded mappings are plain objects again: the marks the load used are gone, at every depth', () => {
    const data = parseFrontMatter('base: &b {x: 1}\nm: {n: {o: 1}}\nl: [{p: 1}]\n<<: *b');
    const walk = (v: unknown): void => {
      if (typeof v !== 'object' || v === null) return;
      expect(Object.getOwnPropertySymbols(v)).toEqual([]);
      if (!Array.isArray(v)) expect(Object.prototype.toString.call(v)).toBe('[object Object]');
      for (const x of Object.values(v)) walk(x);
    };
    walk(data);
    expect(Object.keys(data ?? {})).toEqual(['base', 'm', 'l', 'x']);
  });

  // An alias gives the listener the same sequence again. It is skipped once marked, so the aliases of one
  // large sequence cost one mark each and not one rescan of its elements each. 2000 mappings held 3500
  // times is 7 million marks without the skip: seconds, against a few milliseconds with it.
  it('aliasing one large sequence many times stays cheap: an already marked sequence is not rescanned', () => {
    const src = `---\na: &a [${Array(2000).fill('{}').join(',')}]\nb: [${Array(3500).fill('*a').join(',')}]\n---\n`;
    expect(cpLength(src)).toBeLessThan(FM_MAX_CHARS);
    const started = performance.now();
    const r = render(src);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(r.html).toBe(dl('1-4', item('a', '') + item('b', '')));
    expect(r.meta.frontList).toEqual([
      { key: 'a', list: true, vals: [] },
      { key: 'b', list: true, vals: [] },
    ]);
  });

  it('a key whose text is `[object Object]` is only text, and still loads', () => {
    expect(render('---\n"[object Object]": v\n---\n').html).toBe(dl('1-3', item('[object Object]', 'v')));
  });
});

// Ruling C39: a `<<` merge source that is not a mapping fails the load, through the same path as C33. PyYAML
// reads a merge key's value as one mapping, or a list of mappings, and refuses anything else ("expected a
// mapping for merging"); js-yaml merged a sequence in as a mapping with the keys 0, 1, ... The reference
// (measured on each input below) rendered the empty string and meta was null.
describe('PD2: a merge source that is a sequence fails the load, as in the reference (ruling C39)', () => {
  const reference = { html: '', front: null, frontList: null };
  const refused = (src: string): void => {
    const r = render(src);
    expect({ html: r.html, front: r.meta.front, frontList: r.meta.frontList }).toEqual(reference);
  };

  it('a sequence inside the merge list, through an alias', () => {
    refused('---\ntags: &t [alpha, beta]\n<<: [*t]\ntitle: T\n---\n');
  });

  it('a sequence inside the merge list, written inline, empty or not, in flow and block style', () => {
    refused('---\n<<: [[a, b]]\n---\n');
    refused('---\n<<: [[]]\ntitle: T\n---\n');
    refused('---\n<<:\n  - - a\n    - b\ntitle: T\n---\n');
  });

  it('a mapping and a sequence in one merge list; a list of aliased sequences of mappings', () => {
    refused('---\nx: 0\n<<: [{a: 1}, [b]]\n---\n');
    refused('---\ns: &s [{a: 1}]\n<<: [*s]\ntitle: T\n---\n');
  });

  it('control: a bare alias of a sequence of scalars is refused, as before', () => {
    refused('---\ntags: &t [alpha, beta]\n<<: *t\ntitle: T\n---\n');
  });

  // Reference, same inputs: `<<: *s` (s a sequence of mappings) renders a, s, title; `<<: *m` renders a, m. Here
  // the merged keys follow their `<<` (C17 (e)), so the order differs and nothing else does.
  it('controls: ordinary merges still work: an alias, a list of aliases, a list of inline mappings, an inline mapping', () => {
    expect(render('---\nm: &m {a: 1}\n<<: *m\n---\n').html).toBe(dl('1-4', item('m', '…') + item('a', '1')));
    expect(render('---\ns: &s [{a: 1}]\n<<: *s\ntitle: T\n---\n').html).toBe(
      dl('1-5', item('s', '') + item('a', '1') + item('title', 'T')),
    );
    expect(render('---\nm: &m {a: 1}\nn: &n {b: 2}\n<<: [*m, *n]\ntitle: T\n---\n').html).toBe(
      dl('1-6', item('m', '…') + item('n', '…') + item('a', '1') + item('b', '2') + item('title', 'T')),
    );
    expect(render('---\n<<: [{a: 1}, {b: 2}]\ntitle: T\n---\n').html).toBe(
      dl('1-4', item('a', '1') + item('b', '2') + item('title', 'T')),
    );
    expect(render('---\n<<: {a: 1}\ntitle: T\n---\n').html).toBe(dl('1-4', item('a', '1') + item('title', 'T')));
  });

  it('the merge refusal leaves no mark behind: a sequence from a loaded block is a plain array', () => {
    const data = parseFrontMatter('s: &s [a, [b]]\nt: *s');
    expect(Object.keys(data?.['s'] as unknown[])).toEqual(['0', '1']);
    expect(Object.keys(data?.['t'] as unknown[])).toEqual(['0', '1']);
  });
});

// Ruling C32: PD2 also covers U+2028 and U+2029. PyYAML treats both as line breaks and js-yaml does not, so
// this implementation reads them as ordinary characters of a line. Each case notes what the reference
// rendered, measured with the reference renderer on the same input (its output is not stored in the repo).
describe('PD2: U+2028 and U+2029 are not line breaks (ruling C32)', () => {
  for (const [name, ch] of [
    ['U+2028', '\u2028'],
    ['U+2029', '\u2029'],
  ] as const) {
    it(`${name} in the middle of a line: the load fails, where the reference read two keys`, () => {
      // Reference (measured): two keys, a: x and b: y, in the strip and in meta.
      const reference = { html: dl('1-3', item('a', 'x') + item('b', 'y')), frontList: [scalar('a', 'x'), scalar('b', 'y')] };
      const r = render(`---\na: x${ch}b: y\n---\n`);
      expect([r.html, r.meta.frontList]).toEqual(['', null]);
      expect([r.html, r.meta.frontList]).not.toEqual([reference.html, reference.frontList]);
    });

    it(`${name} at the end of a value is part of the value, where the reference ended the line there`, () => {
      // Reference (measured): the value is `x`, with no trailing character.
      const reference = { html: dl('1-4', item('a', 'x') + item('b', 'y')), frontList: [scalar('a', 'x'), scalar('b', 'y')] };
      const r = render(`---\na: x${ch}\nb: y\n---\n`);
      expect(r.html).toBe(dl('1-4', item('a', `x${ch}`) + item('b', 'y')));
      expect(r.meta.frontList).toEqual([scalar('a', `x${ch}`), scalar('b', 'y')]);
      expect(r.html).not.toBe(reference.html);
      expect(r.meta.frontList).not.toEqual(reference.frontList);
    });

    it(`${name} inside a block scalar is part of its text, where the reference refused the whole block`, () => {
      // Reference (measured): the block renders nothing, and meta is null.
      const reference = { html: '', frontList: null };
      const r = render(`---\na: |\n  x${ch}y\n---\n`);
      expect(r.html).toBe(dl('1-4', item('a', `x${ch}y\n`)));
      expect(r.meta.frontList).toEqual([scalar('a', `x${ch}y\n`)]);
      expect(r.html).not.toBe(reference.html);
      expect(r.meta.frontList).not.toEqual(reference.frontList);
    });

    it(`${name} inside a comment does not end it, where the reference read the key after it`, () => {
      // Reference (measured): the keys b and a, in that order (b: y is read as a key after the comment's break).
      const reference = { html: dl('1-4', item('b', 'y') + item('a', '1')), frontList: [scalar('b', 'y'), scalar('a', '1')] };
      const r = render(`---\n# c${ch}b: y\na: 1\n---\n`);
      expect(r.html).toBe(dl('1-4', item('a', '1')));
      expect(r.meta.frontList).toEqual([scalar('a', '1')]);
      expect(r.html).not.toBe(reference.html);
      expect(r.meta.frontList).not.toEqual(reference.frontList);
    });

    it(`${name} inside a quoted scalar is kept, as in the reference`, () => {
      const r = render(`---\na: "x${ch}y"\n---\n`);
      expect(r.html).toBe(dl('1-3', item('a', `x${ch}y`)));
    });
  }
});

describe('PD3: meta comes from the block the strip renders (ruling C1)', () => {
  for (const [name, src] of [
    ['a four-dash opener and closer', '----\na: 1\n----\n'],
    ['a `...` closer', '---\na: 1\n...\n# H\n'],
    ['text after the opening dashes', '--- x\na: 1\n---\n'],
    ['CRLF line endings', '---\r\na: 1\r\n---\r\n'],
    ['CR line endings', '---\ra: 1\r---\r'],
  ] as const) {
    it(`${name}: the strip and meta.frontList both read a: 1`, () => {
      const r = render(src);
      expect(r.html.startsWith(A1)).toBe(true);
      expect(r.meta.frontList).toEqual([scalar('a', '1')]);
      expect({ ...r.meta.front }).toEqual({ a: '1' });
    });
  }

  it('no front matter, or one that is not a mapping, gives null for both', () => {
    for (const src of ['# H\n', '---\na: 1\n', '---\n- a\n- b\n---\n', '---\n: : bad\n---\n', '---\nplain\n---\n']) {
      const r = render(src);
      expect([r.meta.front, r.meta.frontList]).toEqual([null, null]);
    }
  });
});

describe('PD4: one leading byte order mark is removed (ruling C1)', () => {
  it('a BOM file keeps its front matter, and bytes still counts the BOM', () => {
    const r = render('\ufeff---\na: 1\n---\n');
    expect(r.html).toBe(A1);
    expect(r.meta.frontList).toEqual([scalar('a', '1')]);
    expect(r.bytes).toBe(16);
  });

  it('only one is removed, and only at the start', () => {
    expect(render('\ufeff\ufeff---\na: 1\n---\n').html).toBe('<h2 id="---a-1" data-line="1-3">\ufeff---\na: 1</h2>\n');
    expect(render('\ufeffx\ufeff\n').html).toBe('<p data-line="1-1">x\ufeff</p>\n');
  });
});

describe('meta.front and meta.frontList', () => {
  it('front is a null-prototype record of frontList: a list to its items, a scalar to its value', () => {
    const r = render('---\nkey: [1, 2]\none: x\n---\n');
    expect(Object.getPrototypeOf(r.meta.front)).toBe(null);
    expect({ ...r.meta.front }).toEqual({ key: ['1', '2'], one: 'x' });
    expect(r.meta.frontList).toEqual([{ key: 'key', list: true, vals: ['1', '2'] }, scalar('one', 'x')]);
  });

  it('an own __proto__ key stays an own key, round-trips through JSON and pollutes nothing', () => {
    const r = render('---\n__proto__: polluted\nconstructor: built\ntoString: str\n---\n');
    const front = r.meta.front ?? {};
    expect(Object.keys(front)).toEqual(['__proto__', 'constructor', 'toString']);
    expect(Object.getOwnPropertyDescriptor(front, '__proto__')?.value).toBe('polluted');
    expect(JSON.stringify(front)).toBe('{"__proto__":"polluted","constructor":"built","toString":"str"}');
    const back = JSON.parse(JSON.stringify(front)) as Record<string, unknown>;
    expect(Object.getOwnPropertyDescriptor(back, '__proto__')?.value).toBe('polluted');
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('frontRecord builds every key with defineProperty on a null-prototype object', () => {
    const rec = frontRecord([scalar('__proto__', 'p'), { key: 'l', list: true, vals: [] }]);
    expect(Object.getPrototypeOf(rec)).toBe(null);
    expect(Object.keys(rec)).toEqual(['__proto__', 'l']);
    expect(rec['l']).toEqual([]);
  });

  it('a mapping with no listable value gives an empty frontList and an empty front', () => {
    const r = render('---\nm: {x: 1}\nn: null\n---\n');
    expect(r.meta.frontList).toEqual([]);
    expect(Object.keys(r.meta.front ?? { x: 1 })).toEqual([]);
  });
});

describe('the limits', () => {
  const ASTRAL = '\u{1F600}';

  it('40 keys, the first in document order, in the strip and in meta', () => {
    const src = `---\n${Array.from({ length: 41 }, (_, i) => `k${i}: v`).join('\n')}\n---\n`;
    const r = render(src);
    expect(r.html.split('<dt>').length - 1).toBe(40);
    expect(r.html).not.toContain('<dt>k40</dt>');
    expect(r.meta.frontList).toHaveLength(40);
  });

  it('500 code points of a value, never half an astral character', () => {
    const r = render(`---\nv: ${'a'.repeat(499)}${ASTRAL}b\n---\n`);
    expect(r.html).toBe(dl('1-3', item('v', `${'a'.repeat(499)}${ASTRAL}`)));
    expect(r.meta.frontList).toEqual([scalar('v', `${'a'.repeat(499)}${ASTRAL}`)]);
  });

  it('the strip reads the first 50 items of a list, then skips the nested ones among them', () => {
    const items = ['[n]', ...Array.from({ length: 60 }, (_, i) => String(i + 1))];
    const r = render(`---\nk: [${items.join(', ')}]\n---\n`);
    expect(r.html).toBe(dl('1-3', item('k', Array.from({ length: 49 }, (_, i) => String(i + 1)).join(', '))));
  });

  it('meta reads the first 300 items, then skips nested ones; 300 code points of each', () => {
    const items = ['{m: 1}', `${'b'.repeat(299)}${ASTRAL}c`, ...Array.from({ length: 400 }, (_, i) => `w${i}`)];
    const r = render(`---\nk: [${items.join(', ')}]\n---\n`);
    const vals = r.meta.frontList?.[0]?.vals ?? [];
    expect(vals).toHaveLength(299);
    expect(vals[0]).toBe(`${'b'.repeat(299)}${ASTRAL}`);
    expect(vals.at(-1)).toBe('w297');
  });

  it('YAML of FM_MAX_CHARS code points or more is not read; the count is code points', () => {
    expect(FM_MAX_CHARS).toBe(20000);
    const under = `x: ${ASTRAL.repeat(FM_MAX_CHARS - 4)}`;
    const at = `x: ${ASTRAL.repeat(FM_MAX_CHARS - 3)}`;
    expect(Object.keys(parseFrontMatter(under) ?? {})).toEqual(['x']);
    expect(parseFrontMatter(at)).toBe(null);
    expect(render(`---\n${at}\n---\n`).html).toBe('');
  });

  it('a list of aliases to one list stays cheap (the anchors are shared, never expanded)', () => {
    const rows = ['a: &a [x, x, x, x, x, x, x, x, x]'];
    for (let i = 1; i < 12; i += 1) {
      const p = String.fromCharCode(96 + i);
      rows.push(`${String.fromCharCode(97 + i)}: &${String.fromCharCode(97 + i)} [${Array(9).fill(`*${p}`).join(', ')}]`);
    }
    const started = performance.now();
    const r = render(`---\n${rows.join('\n')}\n---\n`);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(r.meta.frontList).toHaveLength(12);
  });
});

describe('keys are cut to FM_MAX_VALUE code points, as values are (ruling C31, part of PD8)', () => {
  const ASTRAL = '\u{1F600}';
  const cp = (s: string): number => [...s].length;
  const keyOf = (n: number): string => `---\n${'k'.repeat(n)}: v\n---\n`;

  it('an ordinary key of 499 and of 500 code points is unchanged; 501 is cut to 500', () => {
    for (const n of [499, 500]) {
      const r = render(keyOf(n));
      expect(r.html).toBe(dl('1-3', item('k'.repeat(n), 'v')));
      expect(r.meta.frontList).toEqual([scalar('k'.repeat(n), 'v')]);
    }
    const r = render(keyOf(501));
    expect(r.html).toBe(dl('1-3', item('k'.repeat(500), 'v')));
    expect(r.meta.frontList).toEqual([scalar('k'.repeat(500), 'v')]);
    expect(Object.keys(r.meta.front ?? {})).toEqual(['k'.repeat(500)]);
  });

  it('the cut counts code points and never splits an astral character', () => {
    const r = render(`---\n"${'a'.repeat(499)}${ASTRAL}b": v\n---\n`);
    expect(r.html).toBe(dl('1-3', item(`${'a'.repeat(499)}${ASTRAL}`, 'v')));
    expect(r.meta.frontList).toEqual([scalar(`${'a'.repeat(499)}${ASTRAL}`, 'v')]);
  });

  it('the cut key is escaped after the cut, in the strip', () => {
    const r = render(`---\n"${'<'.repeat(501)}": v\n---\n`);
    expect(r.html).toBe(dl('1-3', item('&lt;'.repeat(500), 'v')));
    expect(r.meta.frontList?.[0]?.key).toBe('<'.repeat(500));
  });

  // Two keys that share their first 500 code points: the strip lists both, as it lists two equal keys of a
  // list; meta.frontList keeps both entries in document order, and meta.front (a record) keeps the later one,
  // as a later duplicate key wins in YAML's JSON mode. Nothing throws and nothing reaches a prototype.
  it('two long keys that share their first 500 code points collide: both listed, the later wins in front', () => {
    const head = 'k'.repeat(500);
    const r = render(`---\n${head}x: one\n${head}y: two\n---\n`);
    expect(r.html).toBe(dl('1-4', item(head, 'one') + item(head, 'two')));
    expect(r.meta.frontList).toEqual([scalar(head, 'one'), scalar(head, 'two')]);
    expect(Object.keys(r.meta.front ?? {})).toEqual([head]);
    expect(r.meta.front?.[head]).toBe('two');
  });

  it('a long key that begins with __proto__ is cut to 500 code points like any other: an own key, nothing polluted', () => {
    const r = render(`---\n"__proto__${'_'.repeat(600)}": polluted\n---\n`);
    expect(Object.keys(r.meta.front ?? {})).toEqual([`__proto__${'_'.repeat(491)}`]);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(Object.getPrototypeOf(r.meta.front)).toBe(null);
  });

  it('a key built from aliases (about 20 KB of YAML) is cut in the strip and in meta, in bounded time', () => {
    // `a` is 9990 characters; the sequence key joins 3330 aliases of it into 33 million: the cut runs
    // before the escape, so the strip and meta hold 500 code points of it and not 33 million.
    const src = `---\na: &a "${'<'.repeat(9990)}"\n? [${Array(3330).fill('*a').join(',')}]\n: v\n---\n`;
    expect(cp(src)).toBeLessThan(FM_MAX_CHARS + 20);
    const started = performance.now();
    const r = render(src);
    expect(performance.now() - started).toBeLessThan(3000);
    const list = r.meta.frontList ?? [];
    expect(list.map((e) => e.key.length)).toEqual([1, 500]);
    expect(list[1]?.key).toBe('<'.repeat(500));
    expect(r.html.length).toBeLessThan(5000);
    expect(r.html).toContain(`<dt>${'&lt;'.repeat(500)}</dt>`);
    expect(Object.keys(r.meta.front ?? {}).map((k) => cp(k))).toEqual([1, 500]);
  });
});

describe('the rule in the engine', () => {
  it('one hidden block token at line 0, its content the lines between, its map through the closer', () => {
    const tokens = createEngine().parse('---\na: 1\nb: 2\n---\n\nx\n', createEnv({ lineAttrs: true }));
    const t = tokens[0];
    expect([t?.type, t?.hidden, t?.block, t?.markup, t?.content, t?.map]).toEqual([
      'front_matter',
      true,
      true,
      '---',
      'a: 1\nb: 2',
      [0, 4],
    ]);
    expect(tokens.filter((x) => x.type === 'front_matter')).toHaveLength(1);
  });

  it('lineAttrs: false leaves the strip without data-line', () => {
    expect(render('---\na: 1\n---\n', { lineAttrs: false }).html).toBe(
      '<dl class="doc-meta"><div><dt>a</dt><dd>1</dd></div></dl>\n',
    );
  });

  it("keys and values are escaped with Python's html.escape, and the output passes the oracle", () => {
    const r = render('---\n"<script>it\'s": "<img src=x onerror=1> & \\"q\\""\n---\n');
    expect(r.html).toBe(
      dl('1-3', item('&lt;script&gt;it&#x27;s', '&lt;img src=x onerror=1&gt; &amp; &quot;q&quot;')),
    );
    expect(checkOutputSafety(r.html)).toEqual([]);
  });
});
