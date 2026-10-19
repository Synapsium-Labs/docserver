// The reader stylesheet's scope (docserver L2 prototype). assets/reader.css is loaded into a page the reader does not own,
// so every style rule in it must start with the root attribute, [data-docreader-root], and can touch nothing else.
// The check is rule-aware: a small tokenizer reads comments, strings, parentheses and brackets, nested @media and
// @supports blocks, @font-face and @keyframes, and gives back each style rule with its selectors, so a rule hidden in
// a block, a second selector after a comma or a brace inside a string cannot slip past the way it can in a regex over
// the whole text. The @font-face source URLs must be relative ./fonts/ files that exist.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CSS_PATH = path.join(ROOT, 'assets', 'reader.css');
const SCOPE = '[data-docreader-root]';

/** One node of the sheet: a style rule, or an at-rule with its block (children) or without (a statement). */
interface Rule {
  readonly kind: 'rule';
  readonly selectors: readonly string[];
  readonly body: string;
  /** The at-rule preludes this rule sits inside, outermost first (for example `@media (max-width: 700px)`). */
  readonly within: readonly string[];
}
interface AtRule {
  readonly kind: 'at';
  readonly name: string;
  readonly prelude: string;
  readonly body: string;
  readonly within: readonly string[];
}
type Node = Rule | AtRule;

/** Index just past the end of a string literal that opens at `i` (the quote). Throws when it never closes. */
function skipString(css: string, i: number): number {
  const quote = css[i];
  let j = i + 1;
  while (j < css.length) {
    const c = css[j];
    if (c === '\\') j += 2;
    else if (c === quote) return j + 1;
    else if (c === '\n') throw new Error(`unterminated string at ${i}`);
    else j += 1;
  }
  throw new Error(`unterminated string at ${i}`);
}

/** Index just past the end of a comment that opens at `i`. Throws when it never closes. */
function skipComment(css: string, i: number): number {
  const end = css.indexOf('*/', i + 2);
  if (end < 0) throw new Error(`unterminated comment at ${i}`);
  return end + 2;
}

/** Split `text` on top-level commas: not inside (), [], strings or comments. Empty pieces are dropped. */
function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'") i = skipString(text, i);
    else if (c === '/' && text[i + 1] === '*') i = skipComment(text, i);
    else {
      if (c === '(' || c === '[') depth += 1;
      else if (c === ')' || c === ']') depth -= 1;
      else if (c === ',' && depth === 0) {
        out.push(text.slice(start, i));
        start = i + 1;
      }
      i += 1;
    }
  }
  out.push(text.slice(start));
  return out.map((s) => s.trim().replace(/\s+/g, ' ')).filter((s) => s !== '');
}

/** Remove every comment, keeping strings intact. */
function stripComments(css: string): string {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === '"' || c === "'") {
      const end = skipString(css, i);
      out += css.slice(i, end);
      i = end;
    } else if (c === '/' && css[i + 1] === '*') i = skipComment(css, i);
    else {
      out += c;
      i += 1;
    }
  }
  return out;
}

/** Parse a sheet into its flat list of style rules and at-rules, descending into @media, @supports and the like. */
function parseCss(source: string): Node[] {
  const css = stripComments(source);
  const nodes: Node[] = [];
  const walk = (text: string, within: readonly string[]): void => {
    let i = 0;
    while (i < text.length) {
      while (i < text.length && /\s/.test(text[i] ?? '')) i += 1;
      if (i >= text.length) break;
      // The prelude runs to the next top-level `{` or `;`.
      let j = i;
      let paren = 0;
      while (j < text.length) {
        const c = text[j];
        if (c === '"' || c === "'") {
          j = skipString(text, j);
          continue;
        }
        if (c === '(' || c === '[') paren += 1;
        else if (c === ')' || c === ']') paren -= 1;
        else if ((c === '{' || c === ';') && paren === 0) break;
        else if (c === '}' && paren === 0) throw new Error(`unexpected "}" at ${j}`);
        j += 1;
      }
      if (j >= text.length) throw new Error(`a prelude never ends: ${text.slice(i, i + 40)}`);
      const prelude = text.slice(i, j).trim();
      if (text[j] === ';') {
        if (prelude.startsWith('@')) nodes.push({ kind: 'at', name: (/^@[\w-]+/.exec(prelude)?.[0] ?? '@'), prelude, body: '', within });
        else throw new Error(`a statement that is not an at-rule: ${prelude}`);
        i = j + 1;
        continue;
      }
      // A block: find its matching `}`.
      let depth = 1;
      let k = j + 1;
      while (k < text.length && depth > 0) {
        const c = text[k];
        if (c === '"' || c === "'") {
          k = skipString(text, k);
          continue;
        }
        if (c === '{') depth += 1;
        else if (c === '}') depth -= 1;
        k += 1;
      }
      if (depth !== 0) throw new Error(`an unclosed block: ${prelude}`);
      const body = text.slice(j + 1, k - 1);
      if (prelude.startsWith('@')) {
        const name = /^@[\w-]+/.exec(prelude)?.[0] ?? '@';
        nodes.push({ kind: 'at', name, prelude, body, within });
        // @media and @supports hold rules of their own; @font-face and @keyframes hold declarations or keyframes.
        if (name === '@media' || name === '@supports') walk(body, [...within, prelude]);
      } else {
        nodes.push({ kind: 'rule', selectors: splitTopLevel(prelude), body, within });
      }
      i = k;
    }
  };
  walk(css, []);
  return nodes;
}

/** True when a selector starts with the root attribute, as a whole attribute selector. */
function startsWithScope(selector: string): boolean {
  return selector.startsWith(SCOPE);
}

/** Every reason a sheet escapes its scope or its asset rules, as readable lines; empty when it does not. */
function scopeProblems(css: string, fontsDir: string): string[] {
  const problems: string[] = [];
  const allowedAt = new Set(['@media', '@supports', '@font-face', '@keyframes']);
  for (const node of parseCss(css)) {
    if (node.kind === 'at') {
      if (!allowedAt.has(node.name)) problems.push(`at-rule not allowed: ${node.prelude}`);
      if (node.name === '@keyframes' && !/^@keyframes\s+doc-[\w-]+$/.test(node.prelude)) {
        problems.push(`keyframes name is not doc-prefixed: ${node.prelude}`);
      }
      if (node.name === '@font-face') {
        for (const m of node.body.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/g)) {
          const url = m[1] ?? m[2] ?? m[3] ?? '';
          if (!/^\.\/fonts\/[\w.-]+\.woff2$/.test(url)) problems.push(`@font-face url is not a relative ./fonts/ woff2: ${url}`);
          else if (!existsSync(path.join(fontsDir, url.slice('./fonts/'.length)))) problems.push(`@font-face file is missing: ${url}`);
        }
      }
      continue;
    }
    // A style rule. Keyframe steps (from, to, 50%) live inside an @keyframes block, which is not walked.
    if (node.selectors.length === 0) problems.push('a style rule with no selector');
    for (const s of node.selectors) {
      if (!startsWithScope(s)) problems.push(`unscoped selector: ${s}${node.within.length > 0 ? `  (inside ${node.within.join(' > ')})` : ''}`);
      if (/#[A-Za-z_-]/.test(s.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, ''))) problems.push(`id selector: ${s}`);
    }
  }
  // Any url() outside @font-face is an external reference this sheet must not make.
  const outside = parseCss(css)
    .filter((n) => n.kind === 'rule')
    .some((n) => /url\(/.test((n as Rule).body));
  if (outside) problems.push('a url() in a style rule');
  return problems;
}

const fontsDir = path.join(ROOT, 'assets', 'fonts');

describe('reader stylesheet: the rule parser', () => {
  it('reads a comment, a string that holds braces and a nested media block without losing a rule', () => {
    const nodes = parseCss(`
      /* a } comment { with braces */
      [data-docreader-root] a::before { content: "}{"; }
      @media (max-width: 10px) { [data-docreader-root] b { x: y } @supports (display: grid) { [data-docreader-root] c { z: 1 } } }
    `);
    const rules = nodes.filter((n): n is Rule => n.kind === 'rule');
    expect(rules.map((r) => r.selectors.join('|'))).toEqual([
      '[data-docreader-root] a::before',
      '[data-docreader-root] b',
      '[data-docreader-root] c',
    ]);
    expect(rules[2]?.within).toEqual(['@media (max-width: 10px)', '@supports (display: grid)']);
  });

  it('splits selectors only at top-level commas', () => {
    const [rule] = parseCss('[data-docreader-root] :is(a, b), [data-docreader-root] [title="x,y"], [data-docreader-root] c { x: y }');
    expect(rule?.kind === 'rule' && rule.selectors).toEqual([
      '[data-docreader-root] :is(a, b)',
      '[data-docreader-root] [title="x,y"]',
      '[data-docreader-root] c',
    ]);
  });

  it('refuses a sheet it cannot read rather than guessing', () => {
    expect(() => parseCss('a { x: y')).toThrow(/unclosed block/);
    expect(() => parseCss('/* never ends')).toThrow(/unterminated comment/);
    expect(() => parseCss('a { content: "never ends }')).toThrow(/unterminated string/);
    expect(() => parseCss('} a { x: y }')).toThrow(/unexpected "}"/);
  });
});

describe('reader stylesheet: scope', () => {
  const css = readFileSync(CSS_PATH, 'utf8');

  it('the shipped sheet has no scope problem', () => {
    expect(scopeProblems(css, fontsDir)).toEqual([]);
  });

  it('the shipped sheet has style rules in the plain and in the media blocks (the check is not vacuous)', () => {
    const rules = parseCss(css).filter((n): n is Rule => n.kind === 'rule');
    expect(rules.length).toBeGreaterThan(500);
    expect(rules.some((r) => r.within.length > 0)).toBe(true);
    expect(rules.some((r) => r.within.some((w) => w.includes('prefers-color-scheme: dark')))).toBe(true);
  });

  it('flags an unscoped rule, at the top level, in a second selector and inside a media block', () => {
    const base = `${SCOPE} p { x: y }\n`;
    expect(scopeProblems(`${base}body { x: y }`, fontsDir)).toEqual(['unscoped selector: body']);
    expect(scopeProblems(`${base}${SCOPE} a, b { x: y }`, fontsDir)).toEqual(['unscoped selector: b']);
    expect(scopeProblems(`${base}@media print { p { x: y } }`, fontsDir)).toEqual(['unscoped selector: p  (inside @media print)']);
    expect(scopeProblems(`${base}:where(${SCOPE}) p { x: y }`, fontsDir)).toHaveLength(1);
    expect(scopeProblems(`${base}[data-docreader-rootless] p { x: y }`, fontsDir)).toHaveLength(1);
  });

  it('flags an id selector, an @import, an @charset, an undeclared at-rule and a url() in a style rule', () => {
    expect(scopeProblems(`${SCOPE} #jump { x: y }`, fontsDir)).toEqual([`id selector: ${SCOPE} #jump`]);
    expect(scopeProblems(`@import url("x.css");\n${SCOPE} p { x: y }`, fontsDir)).toEqual(['at-rule not allowed: @import url("x.css")']);
    expect(scopeProblems(`@namespace svg url(x);\n${SCOPE} p { x: y }`, fontsDir)).toEqual(['at-rule not allowed: @namespace svg url(x)']);
    expect(scopeProblems(`@page { margin: 0 }`, fontsDir)).toEqual(['at-rule not allowed: @page']);
    expect(scopeProblems(`${SCOPE} p { background: url("x.png") }`, fontsDir)).toEqual(['a url() in a style rule']);
  });

  it('flags a keyframes name that is not prefixed, because keyframe names are global', () => {
    expect(scopeProblems('@keyframes spin { to { x: y } }', fontsDir)).toEqual(['keyframes name is not doc-prefixed: @keyframes spin']);
    expect(scopeProblems('@keyframes doc-spin { to { x: y } }', fontsDir)).toEqual([]);
  });

  it('declares the colour tokens on the root, with the dark block guarded and an explicit dark block', () => {
    const rules = parseCss(css).filter((n): n is Rule => n.kind === 'rule');
    const decl = (selector: string, within = ''): string =>
      rules.find((r) => r.selectors.includes(selector) && r.within.join(' ').includes(within))?.body ?? '';
    expect(decl(SCOPE)).toMatch(/--bg:\s*#fcfbf8/);
    expect(decl(`${SCOPE}:not([data-theme="light"])`, 'prefers-color-scheme: dark')).toMatch(/--bg:\s*#161514/);
    expect(decl(`${SCOPE}[data-theme="dark"]`)).toMatch(/--bg:\s*#161514/);
    expect(decl(`${SCOPE}[data-theme="light"]`)).toMatch(/color-scheme:\s*light/);
  });
});

describe('reader stylesheet: fonts', () => {
  const css = readFileSync(CSS_PATH, 'utf8');
  const faces = parseCss(css).filter((n): n is AtRule => n.kind === 'at' && n.name === '@font-face');

  it('has the four web faces by relative URL and the four local fallback faces', () => {
    const urls = faces.flatMap((f) => [...f.body.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]));
    expect(urls.sort()).toEqual([
      './fonts/source-sans-3-latin-wght-italic.woff2',
      './fonts/source-sans-3-latin-wght-normal.woff2',
      './fonts/source-serif-4-latin-opsz-italic.woff2',
      './fonts/source-serif-4-latin-opsz-normal.woff2',
    ]);
    const local = faces.filter((f) => !f.body.includes('url('));
    expect(local).toHaveLength(4);
    for (const f of local) expect(f.body).toMatch(/src:\s*local\(/);
    for (const f of local) expect(f.body).toMatch(/font-family:\s*"Docreader (Serif|Sans) Fallback /);
  });

  it('ships the licence, the notices and a hash for every font file', () => {
    expect(existsSync(path.join(fontsDir, 'OFL.txt'))).toBe(true);
    expect(existsSync(path.join(ROOT, 'THIRD-PARTY-NOTICES'))).toBe(true);
    const readme = readFileSync(path.join(fontsDir, 'README.md'), 'utf8');
    for (const f of faces.flatMap((x) => [...x.body.matchAll(/url\("\.\/fonts\/([^"]+)"\)/g)].map((m) => m[1] ?? ''))) {
      expect(readme).toContain(f);
    }
    expect(readme.match(/\b[0-9a-f]{64}\b/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});
