// The code highlighter (docserver L1, Task 6; architecture section C, the "Fence info" row and section F's
// T6 entry). A fixed registry of languages, resolved without case and never from the input's own spelling,
// highlighted by highlight.js on a private instance with illegal lexemes ignored and no auto-detection. The
// reference highlights with Pygments, so nothing here is compared with it (departure PD1); fence.test.ts
// compares the text inside the wrapper.
import { readdirSync, readFileSync } from 'node:fs';
import core from 'highlight.js/lib/core';
import { describe, expect, it } from 'vitest';
import { checkOutputSafety } from '../src/conformance/oracle.js';
import { highlightCode, LANGUAGES, resolveLanguage } from '../src/render/highlight.js';

const REGISTRY = {
  bash: ['sh', 'zsh'],
  shell: ['console'],
  css: [],
  diff: [],
  dockerfile: [],
  go: [],
  ini: ['toml'],
  java: [],
  javascript: ['js', 'jsx'],
  json: [],
  markdown: ['md'],
  python: ['py'],
  rust: [],
  sql: [],
  typescript: ['ts', 'tsx'],
  xml: ['html', 'svg'],
  yaml: ['yml'],
  plaintext: ['text'],
};

/** highlight.js's own escaping of text: & < > " and ' (as &#x27;). */
function hljsEscape(s: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
  return s.replace(/[&<>"']/g, (c) => map[c] ?? c);
}

describe('the language registry', () => {
  it('is exactly these languages and their other names, frozen', () => {
    expect(LANGUAGES).toEqual(REGISTRY);
    expect(Object.keys(LANGUAGES)).toEqual(Object.keys(REGISTRY));
    expect(Object.isFrozen(LANGUAGES)).toBe(true);
    expect(Object.values(LANGUAGES).every((names) => Object.isFrozen(names))).toBe(true);
  });

  it('resolves every name and other name to its canonical name, in any case', () => {
    for (const [name, aliases] of Object.entries(REGISTRY)) {
      for (const n of [name, ...aliases]) {
        expect(resolveLanguage(n)).toBe(name);
        expect(resolveLanguage(n.toUpperCase())).toBe(name);
      }
    }
    expect(resolveLanguage('PyThOn')).toBe('python');
  });

  it("resolves nothing else: not highlight.js's own other names, not object keys, not padded names", () => {
    const others = ['', 'nonsense', 'mermaid', 'gyp', 'ipython', 'patch', 'docker', 'golang', 'rs', 'mjs', 'jsonc'];
    const keys = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'];
    const padded = [' python', 'python ', 'python\t', 'py py', 'language-python'];
    expect([...others, ...keys, ...padded].map((n) => resolveLanguage(n)).filter((r) => r !== null)).toEqual([]);
  });
});

describe('highlightCode', () => {
  const SAMPLE =
    '<&>"\' </code></pre></div><script>alert(1)</script> <!-- c --> ${a} `b` # c // d /* e */ -- f\n' +
    'class A(B):\n  def f(self): return "x" if a <= 1 else \'y\'\n<div onclick="x"><style>a{}</style></div>\n';

  for (const name of Object.keys(REGISTRY)) {
    it(`${name}: the text escaped, and nothing added but highlight.js spans`, () => {
      const html = highlightCode(SAMPLE, name);
      const tags = html.match(/<[^>]*>/g) ?? [];
      expect(tags.filter((t) => !/^<span class="[^"<>&]*">$|^<\/span>$/.test(t))).toEqual([]);
      expect(html.replace(/<[^>]*>/g, '')).toBe(hljsEscape(SAMPLE));
      expect(checkOutputSafety(`<pre><code class="hljs language-${name}">${html}</code></pre>`)).toEqual([]);
    });
  }

  it('xml keeps the text of a script or a style element out of every other grammar (docserver L3, Task 11, request (c))', () => {
    const html = highlightCode(SAMPLE, 'xml');
    expect(html).toContain('<span class="hljs-tag">');
    expect(html.match(/class="language-[a-z]+"/g)).toBeNull();
    expect(html).toContain('&gt;</span>alert(1)<span class="hljs-tag">');
    expect(html).toContain('&gt;</span>a{}<span class="hljs-tag">');
  });

  it('ignores an illegal lexeme instead of giving up on the block', () => {
    expect(highlightCode('x = 1 ?\n', 'python')).toBe('x = <span class="hljs-number">1</span> ?\n');
  });

  it('refuses a name the registry does not hold', () => {
    expect(() => highlightCode('x', 'gyp')).toThrow(RangeError);
    expect(() => highlightCode('x', 'Python')).toThrow(RangeError);
  });

  it("uses its own highlight.js instance: changing the package's shared instance does not move it", () => {
    const before = highlightCode("print('hi')\n", 'python');
    core.configure({ classPrefix: 'changed-' });
    try {
      expect(highlightCode("print('hi')\n", 'python')).toBe(before);
    } finally {
      core.configure({ classPrefix: 'hljs-' });
    }
  });
});

describe('the highlighter in src/render', () => {
  const dir = new URL('../src/render/', import.meta.url);
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ file: f, text: readFileSync(new URL(f, dir), 'utf8') }));

  it('never auto-detects a language', () => {
    expect(sources.filter((s) => s.text.includes('highlightAuto')).map((s) => s.file)).toEqual([]);
  });

  it("imports highlight.js's core and the registered languages only, all in highlight.ts", () => {
    const imports = sources.flatMap((s) =>
      [...s.text.matchAll(/from '(highlight\.js[^']*)'/g)].map((m) => `${s.file} ${m[1] ?? ''}`),
    );
    expect(imports.sort()).toEqual(
      [
        'highlight.ts highlight.js/lib/core',
        ...Object.keys(REGISTRY).map((n) => `highlight.ts highlight.js/lib/languages/${n}`),
      ].sort(),
    );
  });
});
