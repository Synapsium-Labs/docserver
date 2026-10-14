// The linear footnote_tail (docserver L1, ruling C26; src/render/footnotes.ts). markdown-it-footnote 4.0.0's
// own footnote_tail copies the whole token array once per note, so n notes cost O(n^2): 20000 ordinary
// references with their definitions took 32.6 s, and 20000 inline notes 14.3 s. The engine replaces that rule,
// in its place, with a port that appends to one array. These cases pin that the port's token stream is the
// plugin's own, token for token, and that the cost is linear.
//
// The reference engine below is this library's engine with only that one rule put back: the plugin's
// footnote_tail is read from a plain markdown-it instance that uses the plugin, and set into a second
// createEngine() in the port's place. Everything else is the same. The streams are compared as token data
// (type, tag, nesting, meta, content, children), since the two engines hold different Token objects, and the
// html is compared too. The port is a copy of a rule from a pinned dependency (markdown-it-footnote 4.0.0): a
// plugin upgrade must re-run this file, and the seeded differential below in particular, before it is taken.
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import { describe, expect, it } from 'vitest';
import { loadCorpus } from '../src/conformance/index.js';
import { createEngine } from '../src/render/engine.js';
import { createEnv } from '../src/render/env.js';
import { footnoteTail } from '../src/render/footnotes.js';
import { render } from '../src/render/index.js';

interface RuleEntry {
  name: string;
  fn: (state: unknown) => void;
}

/** markdown-it's internal rule list (Ruler.__rules__), which its published types do not declare. */
function rules(ruler: unknown): RuleEntry[] {
  return (ruler as { __rules__: RuleEntry[] }).__rules__;
}

/** The plugin's own footnote_tail, as markdown-it-footnote registers it. */
const pluginTail = ((): RuleEntry['fn'] => {
  const plain = new MarkdownIt('commonmark').use(footnote);
  const rule = rules(plain.core.ruler).find((r) => r.name === 'footnote_tail');
  if (rule === undefined) throw new Error('markdown-it-footnote registers no footnote_tail');
  return rule.fn;
})();

function pluginEngine(): MarkdownIt {
  const md = createEngine();
  md.core.ruler.at('footnote_tail', pluginTail as never);
  return md;
}

interface Plain {
  type: string;
  tag: string;
  nesting: number;
  meta: unknown;
  content: string;
  level: number;
  block: boolean;
  hidden: boolean;
  map: [number, number] | null;
  children: Plain[] | null;
}

function plain(t: import('markdown-it').Token): Plain {
  return {
    type: t.type,
    tag: t.tag,
    nesting: t.nesting,
    meta: t.meta,
    content: t.content,
    level: t.level,
    block: t.block,
    hidden: t.hidden,
    map: t.map,
    children: t.children === null ? null : t.children.map(plain),
  };
}

function stream(md: MarkdownIt, src: string): Plain[] {
  return md.parse(src, createEnv({ lineAttrs: true })).map(plain);
}

function html(md: MarkdownIt, src: string): string {
  return md.render(src, createEnv({ lineAttrs: true }));
}

const SHAPES: readonly (readonly [name: string, src: string])[] = [
  ['references, a second reference to one note, notes of two paragraphs (footnotes.test.ts)', 'a[^b] c[^a] d[^b]\n\n[^a]: first\n[^b]: second\n    continued\n\n    second para\n'],
  ['inline notes; an undefined label, a label with a space, an empty label and an unused note (footnotes.test.ts)', 'x^[inline *em* `c`] y[^zz] z[^a b] w[^]\n\n[^unused]: never shown\n'],
  ['a note defined twice; __proto__ and constructor labels (footnotes.test.ts)', 't[^a] u[^__proto__] v[^constructor]\n\n[^a]: one\n\n[^a]: two\n\n[^__proto__]: p\n[^constructor]: c\n'],
  ['block content in a note (footnotes.test.ts)', 't[^n]\n\n[^n]: # Note\n    > q\n    - [x] t\n\n    | a |\n    |---|\n    | `x\\\\|y` |\n\n# Note\n'],
  ['a note in a blockquote and in a list, with an unclosed details (footnotes.test.ts)', '<details>\n\n> t[^q]\n>\n> [^q]: in a quote\n\n- u[^l]\n\n  [^l]: in a list\n'],
  ['a note whose last paragraph follows a Mermaid fence (footnotes.test.ts)', 't[^x] u[^y]\n\n[^x]: ```mermaid\n    A\n    ```\n    *Figure 1. last*\n\n[^y]: ```mermaid\n    B\n    ```\n    *Figure 2. not last*\n\n    after\n'],
  ['an alert in a note (footnotes.test.ts)', 't[^n]\n\n[^n]: > [!TIP]\n    > in a note\n'],
  ['one label referenced five times: subIds 0 to 4', 'a[^k] b[^k] c[^k] d[^k] e[^k]\n\n[^k]: note\n'],
  ['a definition with no reference, and a reference with no definition', '[^lonely]: nobody cites me\n\ntext[^ghost]\n'],
  ['a definition and no other text', '[^a]: only\n'],
  ['a note that ends in a list, so its last token is not a paragraph', 't[^n]\n\n[^n]: - one\n    - two\n'],
  ['a note that ends in a code block', 't[^n]\n\n[^n]: text\n\n        code\n'],
  ['nested inline notes', 'x^[outer ^[inner] tail] y\n'],
  ['an inline note inside a footnote definition', 't[^n]\n\n[^n]: has ^[an inline one] and more\n'],
  ['a note inside a table cell', '| a | b |\n|---|---|\n| x[^1] | ^[in cell] |\n\n[^1]: cell note\n'],
  ['a note inside a list item and a reference in a nested list', '- a[^1]\n  - b[^1]\n\n[^1]: shared\n'],
  ['inline notes and references mixed, in reverse definition order', 'a^[i1] b[^z] c^[i2] d[^y]\n\n[^y]: Y\n[^z]: Z\n'],
  ['a document with a heading in a note and a heading in the body', 't[^n]\n\n[^n]: # In note\n\n# Body\n'],
  ['no footnotes at all', '# Title\n\nplain text\n'],
];

const CORPUS = loadCorpus().filter((c) => c.input.includes('[^') || c.input.includes('^['));

describe('footnote_tail: the port equals the plugin, token for token', () => {
  it('the engine uses the port, in the plugin rule\'s place', () => {
    const names = rules(createEngine().core.ruler).map((r) => r.name);
    expect(rules(createEngine().core.ruler).find((r) => r.name === 'footnote_tail')?.fn).toBe(footnoteTail);
    expect(names.indexOf('footnote_tail')).toBe(names.indexOf('inline') + 1);
    expect(rules(pluginEngine().core.ruler).find((r) => r.name === 'footnote_tail')?.fn).toBe(pluginTail);
    expect(pluginTail).not.toBe(footnoteTail);
  });

  for (const [name, src] of SHAPES) {
    it(`shape: ${name}`, () => {
      expect(stream(createEngine(), src)).toEqual(stream(pluginEngine(), src));
      expect(html(createEngine(), src)).toBe(html(pluginEngine(), src));
    });
  }

  it('the corpus holds footnote inputs for the comparison below', () => {
    expect(CORPUS.length).toBeGreaterThan(0);
  });

  for (const c of CORPUS) {
    it(`corpus case ${c.id}`, () => {
      expect(stream(createEngine(), c.input)).toEqual(stream(pluginEngine(), c.input));
      expect(html(createEngine(), c.input)).toBe(html(pluginEngine(), c.input));
    });
  }
});

// A seeded random differential against the plugin's own tail. The generator joins blocks drawn from a
// fixed set: paragraphs with references (defined, undefined, repeated, case variants, odd labels) and inline
// notes (nested, with references inside), definitions (one line, several paragraphs, lists, code, quotes,
// alerts), and containers (lists, quotes, alerts, tables, details, headings, Mermaid fences) holding either.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LABELS = ['a', 'b', 'c', 'A', 'long label', 'x_y', '__proto__', 'constructor', 'n1', 'n2', 'zz', ''];

function randomDocument(rand: () => number): string {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
  const label = (): string => pick(LABELS);
  const ref = (): string => `[^${label()}]`;
  const inlineNote = (depth: number): string =>
    `^[${pick(['n', 'with *em*', 'code \`c\`', ref(), depth < 2 ? inlineNote(depth + 1) : 'deep'])}]`;
  const phrase = (): string =>
    pick(['text', 'word', ref(), ref(), inlineNote(0), `a${ref()}b${ref()}`, 'x ^[ open', '[^ ]', '\\[^a]']);
  const paragraph = (): string =>
    Array.from({ length: 1 + Math.floor(rand() * 4) }, phrase).join(pick([' ', ' ', '\n']));
  const definition = (): string => {
    const l = label();
    const body = pick([
      'one line',
      `two\n    lines ${ref()}`,
      `first\n\n    second para ${inlineNote(1)}`,
      '- item\n    - nested',
      '    code block',
      '> quoted',
      '> [!NOTE]\n    > alert in a note',
      '# heading in note',
      '```mermaid\n    A\n    ```\n    *Figure 1. cap*',
      '| h |\n    |---|\n    | c |',
      '',
    ]);
    return `[^${l}]: ${body}`;
  };
  const container = (): string => {
    const inner = pick([paragraph, paragraph, definition])();
    return pick([
      (t: string) => `- ${t.replaceAll('\n', '\n  ')}`,
      (t: string) => `> ${t.replaceAll('\n', '\n> ')}`,
      (t: string) => `> [!NOTE]\n> ${t.replaceAll('\n', '\n> ')}`,
      (t: string) => `1. ${t.replaceAll('\n', '\n   ')}\n2. ${ref()}`,
      (t: string) => `| a | b |\n|---|---|\n| ${t.replaceAll('\n', ' ')} | ${ref()} |`,
      (t: string) => `<details>\n<summary>s</summary>\n\n${t}`,
      (t: string) => `# H ${ref()}\n\n${t}`,
      (t: string) => `\`\`\`mermaid\nA\n\`\`\`\n*Figure 2. cap ${ref()}*\n\n${t}`,
    ])(inner);
  };
  const blocks = Array.from({ length: 1 + Math.floor(rand() * 8) }, () =>
    pick([paragraph, paragraph, definition, definition, container])(),
  );
  return `${blocks.join('\n\n')}\n`;
}

const DIFFERENTIAL_SEED = 20261014;
const DIFFERENTIAL_DOCUMENTS = 300;

describe('footnote_tail: a seeded differential against the plugin', () => {
  it(`${DIFFERENTIAL_DOCUMENTS} random note-heavy documents give the same tokens and html`, () => {
    const rand = mulberry32(DIFFERENTIAL_SEED);
    const mine = createEngine();
    const theirs = pluginEngine();
    let withNotes = 0;
    for (let i = 0; i < DIFFERENTIAL_DOCUMENTS; i += 1) {
      const src = randomDocument(rand);
      if (html(mine, src).includes('class="footnotes"')) withNotes += 1;
      // The messages name the document, so a mismatch can be reproduced from the seed and the index.
      expect(stream(mine, src), `document ${i}`).toEqual(stream(theirs, src));
      expect(html(mine, src), `document ${i}`).toBe(html(theirs, src));
    }
    // The generator really makes notes: most documents hold at least one.
    expect(withNotes).toBeGreaterThan(DIFFERENTIAL_DOCUMENTS / 2);
  });
});

/** Counts the calls of Array.prototype.concat on arrays of at least `min` elements while `f` runs. */
function bigConcats<T>(min: number, f: () => T): { value: T; calls: number; copied: number } {
  const original = Array.prototype.concat;
  let calls = 0;
  let copied = 0;
  Array.prototype.concat = function (this: unknown[], ...items: never[]): never[] {
    if (this.length >= min) {
      calls += 1;
      copied += this.length;
    }
    return original.apply(this, items) as never[];
  } as typeof original;
  try {
    return { value: f(), calls, copied };
  } finally {
    Array.prototype.concat = original;
  }
}

describe('footnote_tail: no copy of the token array per note (deterministic)', () => {
  const NOTES = 2000;
  const src = `${'^[a] '.repeat(NOTES)}\n`;

  it('the port never copies a large token array with concat: zero calls, zero copied elements', () => {
    const run = bigConcats(1000, () => html(createEngine(), src));
    expect(run.value).toContain(`<li id="fn${NOTES}"`);
    expect(run.calls).toBe(0);
    expect(run.copied).toBe(0);
  });

  it("the plugin's own tail copies it once per note, which is what the counter sees", () => {
    const run = bigConcats(1000, () => html(pluginEngine(), src));
    expect(run.value).toContain(`<li id="fn${NOTES}"`);
    expect(run.calls).toBeGreaterThan(NOTES / 2);
    expect(run.copied).toBeGreaterThan(NOTES * 1000);
  });
});

/** The plan's backstop: max(1000, 10 x the median of 5 runs measured on the loaded box), rounded up to 100 ms. */
const MAX_REFS_MS = 4100; // median of 5 runs: 405 ms
const MAX_INLINE_MS = 1900; // median of 5 runs: 186 ms
const MAX_INLINE_100K_MS = 6800; // median of 5 runs: 673 ms

function countOf(haystack: string, needle: string): number {
  let n = 0;
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) n += 1;
  return n;
}

describe('footnote_tail: the cost is linear in the number of notes', () => {
  it('20000 references with their 20000 definitions render within the backstop', () => {
    const refs = Array.from({ length: 20000 }, (_, i) => `r[^n${i}]`).join(' ');
    const defs = Array.from({ length: 20000 }, (_, i) => `[^n${i}]: d\n`).join('');
    const started = performance.now();
    const result = render(`${refs}\n\n${defs}`);
    const ms = performance.now() - started;
    expect(result.outcome).toBe('rendered');
    expect(countOf(result.html, '<li id="fn')).toBe(20000);
    expect(countOf(result.html, 'class="footnote-backref"')).toBe(20000);
    expect(ms).toBeLessThan(MAX_REFS_MS);
  });

  it('20000 inline notes render within the backstop', () => {
    const started = performance.now();
    const result = render(`${'^[a] '.repeat(20000)}\n`);
    const ms = performance.now() - started;
    expect(result.outcome).toBe('rendered');
    expect(countOf(result.html, '<li id="fn')).toBe(20000);
    expect(countOf(result.html, 'class="footnote-backref"')).toBe(20000);
    expect(ms).toBeLessThan(MAX_INLINE_MS);
  });

  it('100000 inline notes (400 KB) render within the backstop', () => {
    // 100000 notes make about 18.5 MB of html, past the 16 MiB default bound (C20), so the bound is raised.
    const started = performance.now();
    const result = render('^[a]'.repeat(100000), { maxHtmlBytes: 67108864 });
    const ms = performance.now() - started;
    expect(result.outcome).toBe('rendered');
    expect(countOf(result.html, '<li id="fn')).toBe(100000);
    expect(ms).toBeLessThan(MAX_INLINE_100K_MS);
  });
});
