// The one fragment grammar (docserver L3, Task 1; plan Reference §9, ruling R1, FD9; row L3.M10). FRAGMENT_ID_GRAMMAR is
// what the frame sends as `hash`, what `./host` accepts, what frameDocument seeds as initialHash, and what
// conformance/bridge-cases.json judges hashes by. It must accept every id the layout can go to:
// - every `id="…"` that render() emits over the whole corpus: the goldens' and the hostile cases' expected outputs as
//   committed, and the generated hostile cases rendered here (heading slugs, anchors, footnote ids with a colon);
// - every defined ID of L2's default ID grammar and every rule ID of its default rule-ID grammar, generated over the
//   grammar's shapes and checked against the grammar itself first, so a shape the grammar does not recognise is never
//   credited.
// Its length is counted in UTF-16 code units, apart from the pattern. Every non-ASCII character in a string is written
// as an escape (ruling R6), the section sign of a title excepted; the last block below scans Task 1's files for one
// written raw.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { loadCorpus } from '../src/conformance/index.js';
import { decodeCharRefs } from '../src/conformance/oracle.js';
import { FRAGMENT_ID_GRAMMAR, isFragmentId } from '../src/frame/index.js';
import { render } from '../src/render/index.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Every `id` attribute value in an HTML string, character references decoded. */
function idsOf(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/\sid="([^"]*)"/g)) out.push(decodeCharRefs(m[1] ?? ''));
  return out;
}

describe('L3.M10 FRAGMENT_ID_GRAMMAR: exactly Reference §9', () => {
  it('is the frozen source, flags and code-unit cap of ruling R1', () => {
    expect(FRAGMENT_ID_GRAMMAR).toEqual({ source: '^[\\p{L}\\p{M}\\p{N}_.:-]+$', flags: 'u', maxCodeUnits: 256 });
    expect(Object.isFrozen(FRAGMENT_ID_GRAMMAR)).toBe(true);
  });
});

describe('L3.M10 isFragmentId: the fixture cases of Reference §9', () => {
  it('accepts a footnote, a slug, an anchor, D2.1a and a 256-code-unit id', () => {
    for (const id of ['fn1', 'fnref1', 'fnref1:1', 'heading-two', 'a_b-c', 'D2.1a', 'x'.repeat(256)]) {
      expect(isFragmentId(id), id).toBe(true);
    }
  });

  it("refuses '', '#x', 'a b', 'a/b', 257 code units and 129 astral letters (258 code units)", () => {
    const astral = '\u{1D400}'.repeat(129);
    expect(astral.length).toBe(258);
    expect([...astral].length).toBe(129);
    for (const id of ['', '#x', 'a b', 'a/b', 'x'.repeat(257), astral]) {
      expect(isFragmentId(id), JSON.stringify(id.slice(0, 12))).toBe(false);
    }
  });

  it('counts code units, not code points: 128 astral letters (256 code units) pass', () => {
    expect(isFragmentId('\u{1D400}'.repeat(128))).toBe(true);
  });

  it('accepts letters, combining marks and numbers of any script, and the four punctuation marks', () => {
    // A Han slug, a decomposed e-acute (e + U+0301), Devanagari with a vowel sign, Arabic-Indic digits.
    const decomposed = 'cafe\u0301';
    // The decomposed case holds a combining mark, so the \p{M} row cannot lose its witness to an NFC rewrite.
    expect(/\p{M}/u.test(decomposed)).toBe(true);
    for (const id of ['\u4e2d\u6587', decomposed, '\u0939\u093f\u0928\u094d\u0926\u0940', '\u0661\u0662', 'a.b:c_d-e']) {
      expect(isFragmentId(id), JSON.stringify(id)).toBe(true);
    }
  });

  it('refuses whitespace, controls, quotes, angle brackets, the percent sign and a lone surrogate', () => {
    for (const id of ['a\tb', 'a\nb', 'a\u00a0b', 'a\u200bb', 'a"b', "a'b", 'a<b', 'a%20b', 'a\ud800', 'a?b', 'a&b']) {
      expect(isFragmentId(id), JSON.stringify(id)).toBe(false);
    }
  });

  it('refuses every non-string, never throwing', () => {
    for (const v of [null, undefined, 1, true, {}, ['a'], Symbol('a')]) expect(isFragmentId(v)).toBe(false);
  });
});

describe('L3.M10 every id render() emits over the corpus passes', () => {
  const cases = loadCorpus();

  // render() writes `id=""` on a heading whose title is empty (headings.md and heading-ids-edge.md pin it). No link can
  // reach an empty id (a `#` alone is the top of the document, never an element), and Reference §9 and FD8 refuse ''
  // outright, so the row reads every non-empty id and pins that the empty ones are exactly empty headings.
  it('every empty id is an empty heading, which nothing can navigate to', () => {
    const empty: string[] = [];
    for (const c of cases) {
      if (c.expected === null) continue;
      for (const m of c.expected.html.matchAll(/<(\w+)\s[^>]*?\bid=""/g)) empty.push(`${c.id}:${m[1] ?? ''}`);
    }
    expect(empty.length).toBeGreaterThan(0);
    expect(empty.filter((e) => !/:h[1-6]$/.test(e))).toEqual([]);
  });

  it('every non-empty id in every committed expected output (goldens and hostile cases, footnotes included)', () => {
    const ids = new Set<string>();
    for (const c of cases) if (c.expected !== null) for (const id of idsOf(c.expected.html)) if (id !== '') ids.add(id);
    // The corpus does carry footnote ids with a colon, Han slugs and anchor ids: the row reads real outputs.
    expect([...ids].some((id) => id.includes(':'))).toBe(true);
    expect([...ids].some((id) => /^fn\d/.test(id))).toBe(true);
    expect(ids.size).toBeGreaterThan(50);
    expect([...ids].filter((id) => !isFragmentId(id))).toEqual([]);
  });

  it('every non-empty id in every generated hostile output, rendered here', () => {
    const generated = cases.filter((c) => c.kind === 'generated');
    expect(generated.length).toBeGreaterThan(20);
    const bad = new Set<string>();
    let seen = 0;
    for (const c of generated) {
      const r = render(c.input, c.options);
      for (const id of idsOf(r.html)) {
        if (id === '') continue;
        seen += 1;
        const ok: boolean = isFragmentId(id);
        if (!ok) bad.add(`${c.id}: ${JSON.stringify(id.slice(0, 40))}`);
      }
    }
    expect(seen).toBeGreaterThan(1000);
    expect([...bad]).toEqual([]);
  });
});

/** The default vocabulary's compiled ID and rule-ID patterns. vocab.ts is DOM-typed, so it is loaded untyped. */
async function defaultGrammars(): Promise<{ id: RegExp; ruleId: RegExp }> {
  const name = 'vocab';
  const mod = (await import(`../src/enhance/${name}.ts`)) as {
    compileVocab(w: unknown): { id: RegExp; ruleId: RegExp };
    defaultVocabulary(): unknown;
  };
  return mod.compileVocab(mod.defaultVocabulary());
}

/** The default ID grammar's shapes: prefix 1 to 4 capitals, dash or none, dotted or dashed parts, a trailing letter. */
function idShapes(): string[] {
  const out: string[] = [];
  for (const prefix of ['R', 'OP', 'ABC', 'WXYZ']) {
    for (const dash of ['', '-']) {
      for (const num of ['1', '14', '2.1', '2-1', '10.2.3', '3-4-5', '1.2-3']) {
        for (const letter of ['', 'a', 'z']) out.push(`${prefix}${dash}${num}${letter}`);
      }
    }
  }
  return out;
}

/** The default rule-ID grammar's shapes: two or more capitals, then dash-separated parts of capitals or digits. */
function ruleIdShapes(): string[] {
  const out: string[] = [];
  for (const head of ['AB', 'ABC', 'ABCDEFG']) {
    for (const tail of ['-1', '-12-C', '-X-9-Z', '-12', '-A1B2']) out.push(`${head}${tail}`);
  }
  return out;
}

describe("L3.M10 every ID shape L2's default ID and rule-ID grammars recognise passes", () => {
  it('the generated ID shapes: each recognised by the default ID grammar, each a fragment id', async () => {
    const { id } = await defaultGrammars();
    const shapes = idShapes();
    expect(shapes.length).toBe(4 * 2 * 7 * 3);
    expect(shapes.filter((s) => id.exec(s)?.[1] !== s)).toEqual([]);
    expect(shapes.filter((s) => !isFragmentId(s))).toEqual([]);
  });

  it('the generated rule-ID shapes: each recognised by the default rule-ID grammar, each a fragment id', async () => {
    const { ruleId } = await defaultGrammars();
    const shapes = ruleIdShapes();
    expect(shapes.filter((s) => !ruleId.test(s))).toEqual([]);
    expect(shapes.filter((s) => !isFragmentId(s))).toEqual([]);
  });

  it("a sample of the corpus's defined IDs: R14, OP-6, D2.1a, AB-12-C", async () => {
    const { id, ruleId } = await defaultGrammars();
    for (const s of ['R14', 'OP-6', 'D2.1a']) expect(id.exec(s)?.[1], s).toBe(s);
    expect(ruleId.test('AB-12-C')).toBe(true);
    for (const s of ['R14', 'OP-6', 'D2.1a', 'AB-12-C']) expect(isFragmentId(s), s).toBe(true);
  });
});

/** Every .ts, .mts, .mjs and .js file under `dir`, from the package root. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...sources(rel));
    else if (/\.(?:ts|mts|mjs|js)$/.test(e.name)) out.push(rel);
  }
  return out;
}

describe('L3.M10 one definition: the pattern lives in src/frame/fragment.ts alone', () => {
  // The class, written as a regex literal (one backslash) or inside a string (two), with its punctuation tail in any
  // order, so a copy by any of those spellings is found. src/enhance/jump.ts's word class (letters, marks, numbers and
  // `_` alone) is another pattern and is not matched.
  const COPY = /\\{1,2}p\{L\}\\{1,2}p\{M\}\\{1,2}p\{N\}[_.:\\-]{4,}/;

  it('the scan finds it in the definition (a control: the scan can see the pattern)', () => {
    expect(COPY.test(readFileSync(path.join(ROOT, 'src/frame/fragment.ts'), 'utf8'))).toBe(true);
  });

  it('no other source file under src/ or scripts/ holds the pattern', () => {
    const files = [...sources('src'), ...sources('scripts')];
    expect(files.length).toBeGreaterThan(50);
    const holders = files.filter((f) => COPY.test(readFileSync(path.join(ROOT, f), 'utf8')));
    expect(holders).toEqual(['src/frame/fragment.ts']);
  });
});

// ───────── ruling R6: visible escapes ─────────

/** Task 1's committed texts that hold test strings or wire values. */
const R6_FILES = [
  'test/frame-fragment.test.ts',
  'test/frame-protocol.test.ts',
  'test/frame-doc-fields.test.ts',
  'conformance/bridge-cases.json',
  'src/frame/fragment.ts',
  'src/frame/protocol.ts',
  'src/frame/doc-fields.generated.ts',
  'scripts/gen-doc-fields.mjs',
  'src/frame/wire-types.ts',
  'test/enhance-frame-wire.test.ts',
  ...readdirSync(path.join(ROOT, 'test/fixtures/doc-fields'), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts'))
    .map((f) => `test/fixtures/doc-fields/${f.split(path.sep).join('/')}`)
    .sort(),
];

/** Characters that cannot be seen where they stand: controls but tab and newline, format characters, spaces but U+0020, marks. */
const INVISIBLE = /[\p{Cc}\p{Cf}\p{Zs}\p{Zl}\p{Zp}\p{M}]/u;

/** The one non-ASCII character a literal may hold raw: the section sign of a test title ("Reference \u00a7 9"), visible as itself. */
const PROSE_SIGN = '\u00a7';

const hex = (ch: string): string => `U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`;

/**
 * Each invisible character anywhere in `text`, and each non-ASCII character but PROSE_SIGN written raw inside a string,
 * template or regular expression literal (read by the TypeScript scanner; a .json file is all literal), with its line.
 */
function rawEscapes(file: string, text: string): string[] {
  const out: string[] = [];
  const lineAt = (pos: number): number => text.slice(0, pos).split('\n').length;
  [...text].reduce((pos, ch) => {
    if (ch !== '\t' && ch !== '\n' && ch !== ' ' && INVISIBLE.test(ch)) out.push(`${lineAt(pos)}: ${hex(ch)} (invisible)`);
    return pos + ch.length;
  }, 0);
  const literals: { pos: number; raw: string }[] = [];
  if (file.endsWith('.json')) literals.push({ pos: 0, raw: text });
  else {
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);
    const visit = (n: ts.Node): void => {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) ||
        ts.isTemplateTail(n) || ts.isRegularExpressionLiteral(n)) {
        literals.push({ pos: n.getStart(sf), raw: n.getText(sf) });
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  for (const { pos, raw } of literals) {
    const bad = [...raw].filter((ch) => (ch.codePointAt(0) ?? 0) > 0x7e && ch !== PROSE_SIGN);
    if (bad.length > 0) out.push(`${lineAt(pos)}: ${bad.map(hex).join(' ')} (in a literal)`);
  }
  return out;
}

describe("ruling R6: Task 1's strings write every non-ASCII character as a visible escape", () => {
  for (const file of R6_FILES) {
    it(file, () => {
      expect(rawEscapes(file, readFileSync(path.join(ROOT, file), 'utf8'))).toEqual([]);
    });
  }

  it('the scan sees a raw no-break space, a zero-width space and a raw letter in a string, not a comment or a title (its control)', () => {
    const nbsp = String.fromCodePoint(0xa0);
    const zwsp = String.fromCodePoint(0x200b);
    const han = String.fromCodePoint(0x4e2d);
    const section = String.fromCodePoint(0xa7);
    expect(rawEscapes('x.ts', `const a = 'x${nbsp}y';\nconst b = \`x${zwsp}y\`;\nconst c = "${han}";\n// prose ${section} is fine\nit('Reference ${section}9', f);\n`)).toEqual([
      '1: U+00A0 (invisible)',
      '2: U+200B (invisible)',
      '1: U+00A0 (in a literal)',
      '2: U+200B (in a literal)',
      '3: U+4E2D (in a literal)',
    ]);
  });
});
