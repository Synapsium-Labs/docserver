// The reader stylesheet's scope (docserver L2 prototype). assets/reader.css is loaded into a page the reader does not own,
// so every style rule in it must start with the root attribute, [data-docreader-root], and can touch nothing else.
// The check is rule-aware: a small tokenizer reads comments, strings, parentheses and brackets, nested @media and
// @supports blocks, @font-face and @keyframes, and gives back each style rule with its selectors, so a rule hidden in
// a block, a second selector after a comma or a brace inside a string cannot slip past the way it can in a regex over
// the whole text. The @font-face source URLs must be relative ./fonts/ files that exist.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

/**
 * True when a selector starts with the root attribute and then stays on the root or goes inside it: after the
 * leading compound (the root attribute, then any attributes, classes, pseudo-classes such as :not(i) on the same
 * element) comes the end, a descendant space or a child `>`. A sibling combinator (`~`, `+`) would select the
 * host's elements beside the root, outside it.
 */
function startsWithScope(selector: string): boolean {
  if (!selector.startsWith(SCOPE)) return false;
  let i = SCOPE.length;
  // the rest of the leading compound: [...], (...) after a pseudo-class, and name characters, up to a combinator
  while (i < selector.length) {
    const c = selector[i] ?? '';
    if (c === '[' || c === '(') {
      const close = c === '[' ? ']' : ')';
      let depth = 0;
      for (; i < selector.length; i += 1) {
        const d = selector[i];
        if (d === '"' || d === "'") i = skipString(selector, i) - 1;
        else if (d === c) depth += 1;
        else if (d === close && (depth -= 1) === 0) break;
      }
      i += 1;
    } else if (/[\s>~+]/.test(c)) break;
    else i += 1;
  }
  const rest = selector.slice(i).trimStart();
  return rest === '' || selector[i] === ' ' ? !/^[~+]/.test(rest) : rest.startsWith('>');
}

/** Every reason a sheet escapes its scope or its asset rules, as readable lines; empty when it does not. */
function scopeProblems(css: string, fontsDir: string): string[] {
  const problems: string[] = [];
  const allowedAt = new Set(['@media', '@supports', '@font-face', '@keyframes']);
  for (const node of parseCss(css)) {
    if (node.kind === 'at') {
      if (!allowedAt.has(node.name)) problems.push(`at-rule not allowed: ${node.prelude}`);
      if (node.name === '@keyframes' && !/^@keyframes\s+docreader-[\w-]+$/.test(node.prelude)) {
        problems.push(`keyframes name is not docreader-prefixed: ${node.prelude}`);
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
    expect(scopeProblems('@keyframes spin { to { x: y } }', fontsDir)).toEqual(['keyframes name is not docreader-prefixed: @keyframes spin']);
    expect(scopeProblems('@keyframes doc-spin { to { x: y } }', fontsDir)).toEqual(['keyframes name is not docreader-prefixed: @keyframes doc-spin']);
    expect(scopeProblems('@keyframes docreader-spin { to { x: y } }', fontsDir)).toEqual([]);
  });

  it('flags a selector that leaves the root for its siblings, and passes one that stays on it or goes inside', () => {
    const sel = (s: string): string[] => scopeProblems(`${s} { x: y }`, fontsDir);
    expect(sel(`${SCOPE} ~ p`)).toEqual([`unscoped selector: ${SCOPE} ~ p`]);
    expect(sel(`${SCOPE} + div`)).toEqual([`unscoped selector: ${SCOPE} + div`]);
    expect(sel(`${SCOPE}:not(i) ~ *`)).toEqual([`unscoped selector: ${SCOPE}:not(i) ~ *`]);
    expect(sel(`${SCOPE}[data-theme="a ~ b"]+p`)).toEqual([`unscoped selector: ${SCOPE}[data-theme="a ~ b"]+p`]);
    for (const ok of [SCOPE, `${SCOPE}:not(i)`, `${SCOPE} p ~ p`, `${SCOPE} > h2 + p`, `${SCOPE}>p`, `${SCOPE}[data-theme="dark"] .x`, `${SCOPE} :is(a, b) ~ c`]) {
      expect(sel(ok)).toEqual([]);
    }
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

describe('reader stylesheet: what the host page may not change', () => {
  const css = readFileSync(CSS_PATH, 'utf8');
  const rules = parseCss(css).filter((n): n is Rule => n.kind === 'rule');

  it('sizes nothing in rem: rem follows the host page\'s html font-size, which the reader does not own', () => {
    // A size the layout gave in rem is calc(N * var(--rem)), --rem being declared on the root.
    const rem = rules.filter((r) => /\d(?:\.\d+)?rem\b/.test(r.body)).map((r) => r.selectors[0] ?? '');
    expect(rem).toEqual([]);
    const root = rules.find((r) => r.within.length === 0 && r.selectors.length === 1 && r.selectors[0] === SCOPE && /--rem:/.test(r.body));
    expect(root?.body).toMatch(/--rem:\s*16px;/);
  });

  it('reads no custom property it does not declare, so none inherits in from the host page', () => {
    const read = new Set([...stripComments(css).matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1] ?? ''));
    const declared = new Set(rules.flatMap((r) => [...r.body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1] ?? '')));
    expect([...read].filter((v) => !declared.has(v)).sort()).toEqual([]);
  });

  it('pads the root by its own gutter, never by a percentage, which would be of the host\'s width', () => {
    const own = rules.filter((r) => r.selectors.some((s) => /^(?:\[data-docreader-root\])+(?::not\(i\))?$/.test(s)));
    expect(own.length).toBeGreaterThan(0);
    const pct = own.filter((r) => /(?:^|;)\s*padding(?:-[a-z]+)?\s*:[^;]*%/.test(r.body)).map((r) => r.selectors.join(', '));
    expect(pct).toEqual([]);
  });

  it('hides a diagram\'s source only where the Mermaid feature has marked the root, so an unmarked root shows it', () => {
    const hiding = rules.filter((r) => /color:\s*transparent/.test(r.body) && r.selectors.some((s) => s.includes('pre.mermaid')));
    expect(hiding.length).toBeGreaterThan(0);
    for (const r of hiding) for (const s of r.selectors) expect(s).toMatch(/^\[data-docreader-root\][^ ]*\[data-docreader-mermaid\]/);
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
  });

  it('every woff2 in assets/fonts is one the README lists, with the sha256 it records, and none is missing', () => {
    // The public-ready scan does not read these binary files as text, so this is what pins them: a changed,
    // replaced or extra font fails here.
    const readme = readFileSync(path.join(fontsDir, 'README.md'), 'utf8');
    const listed = Object.fromEntries(
      [...readme.matchAll(/^\|[^|\n]*\|[^|\n]*\|\s*`([^`]+\.woff2)`\s*\|\s*`([0-9a-f]{64})`\s*\|/gm)].map((m) => [m[1], m[2]]),
    );
    const shipped = Object.fromEntries(
      readdirSync(fontsDir)
        .filter((f) => f.endsWith('.woff2'))
        .map((f) => [f, createHash('sha256').update(readFileSync(path.join(fontsDir, f))).digest('hex')]),
    );
    expect(Object.keys(listed)).toHaveLength(4);
    expect(shipped).toEqual(listed);
  });

  it('every @font-face family is the library\'s own (Docreader ...), so no host face of the same name is taken over', () => {
    const families = faces.map((f) => /font-family:\s*"([^"]+)"/.exec(f.body)?.[1] ?? '(none)');
    expect(families).toHaveLength(8);
    expect(families.filter((f) => !f.startsWith('Docreader '))).toEqual([]);
  });
});
