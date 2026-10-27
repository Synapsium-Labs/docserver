// `./highlight` and `render(md, {highlight: false})` (docserver L3, Task 11; the first consumer's requests (a) to (c)).
// - (a) src/highlight/index.ts re-exports the code highlighter render() itself uses, the highlight.js version with it:
//   `createHighlighter({maxDocumentChars})` returns a highlighter whose `highlight(code, info)` gives the html, the
//   resolved language, the mode ('whole', 'lines' or 'plain', ruling C24) and the code units it has highlighted so far.
//   L3.R2 holds it to render(): the function is the same object, and over every corpus fence its html is the html
//   render() wrote inside that fence's <code>.
// - (b) RenderOptions.highlight, default true. With false a fence keeps its wrapper, data-line and language class and
//   holds escaped text with no span; everything else is byte for byte what render() writes (L3.R1).
// - (c) xml (and its other names, html and svg) is a private copy of highlight.js's grammar whose script and style
//   modes have no sub-language, so a fence never reaches the javascript or css grammar through them (L3.R3, with the
//   hostile case h-xml-script-style-256k and its html variant under the case's verdict, highlighting on and off).
// Every non-ASCII character is written as a \u escape (ruling R6).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
import core from 'highlight.js/lib/core';
import stockCss from 'highlight.js/lib/languages/css';
import stockJavascript from 'highlight.js/lib/languages/javascript';
import stockXml from 'highlight.js/lib/languages/xml';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { evaluateVerdict, loadCorpus } from '../src/conformance/index.js';
import * as entry from '../src/highlight/index.js';
import {
  createHighlighter,
  HIGHLIGHT_ENGINE,
  LANGUAGES,
  MAX_DOCUMENT_CHARS,
  MAX_LINE_CHARS,
  MAX_WHOLE_BLOCK_CHARS,
  resolveLanguage,
  type Highlighter,
  type HighlighterOptions,
  type HighlightMode,
  type HighlightResult,
} from '../src/highlight/index.js';
import { createEnv } from '../src/render/env.js';
import { codeText, fenceName, MAX_HIGHLIGHT_CHARS, MAX_HIGHLIGHT_LINE, MERMAID } from '../src/render/fence.js';
import * as renderHighlight from '../src/render/highlight.js';
import { render } from '../src/render/index.js';
import { ENGINE, stripBom } from '../src/render/render.js';
import { normaliseForCompare } from '../src/conformance/normalise.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const readText = (rel: string): string => readFileSync(path.join(ROOT, rel), 'utf8');
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

const cases = loadCorpus();

/** One codehilite block of render()'s html: its <code> class and the html inside the <code>. */
interface Block {
  cls: string;
  inner: string;
}

const BLOCK = /<div class="codehilite"(?: data-line="[^"]*")?><pre><code class="([^"]*)">([\s\S]*?)<\/code><\/pre><\/div>\n/g;

function blocks(html: string): Block[] {
  return [...html.matchAll(BLOCK)].map((m) => ({ cls: m[1] ?? '', inner: m[2] ?? '' }));
}

/** render()'s html with each code block's inner html replaced by a marker: what must not move with the option. */
function outsideCode(html: string): string {
  return html.replace(BLOCK, (whole, _cls: string, inner: string) => whole.replace(`>${inner}</code>`, '>\u0000</code>'));
}

/** The code fences of a document in render order: every fence token except a Mermaid figure. */
function codeFences(markdown: string): { info: string; content: string }[] {
  return ENGINE.parse(stripBom(markdown), createEnv({ lineAttrs: true }))
    .filter((t) => t.type === 'fence' && fenceName(t.info) !== MERMAID)
    .map((t) => ({ info: t.info, content: t.content }));
}

const withFences = cases.filter((c) => /^ {0,3}(?:```|~~~)/m.test(c.input));

describe('./highlight: its exports (request (a))', () => {
  it('exports exactly the highlighter, the registry, the three bounds and the engine', () => {
    expect(Object.keys(entry).sort()).toEqual(
      [
        'HIGHLIGHT_ENGINE',
        'LANGUAGES',
        'MAX_DOCUMENT_CHARS',
        'MAX_LINE_CHARS',
        'MAX_WHOLE_BLOCK_CHARS',
        'createHighlighter',
        'resolveLanguage',
      ].sort(),
    );
  });

  it('the bounds are ruling C24 and the fence rule\'s: 256 code units a block, 256 a line, 262144 a document', () => {
    expect(MAX_WHOLE_BLOCK_CHARS).toBe(256);
    expect(MAX_LINE_CHARS).toBe(256);
    expect(MAX_DOCUMENT_CHARS).toBe(262_144);
    expect(MAX_LINE_CHARS).toBe(MAX_HIGHLIGHT_LINE);
    expect(MAX_DOCUMENT_CHARS).toBe(MAX_HIGHLIGHT_CHARS);
  });

  it('HIGHLIGHT_ENGINE names highlight.js and the version installed, pinned and running, frozen', () => {
    const pkg = JSON.parse(readText('package.json')) as { dependencies: Record<string, string> };
    const installed = JSON.parse(readText('node_modules/highlight.js/package.json')) as { version: string };
    expect(HIGHLIGHT_ENGINE).toEqual({ name: 'highlight.js', version: '11.12.0' });
    expect(HIGHLIGHT_ENGINE.version).toBe(pkg.dependencies['highlight.js']);
    expect(HIGHLIGHT_ENGINE.version).toBe(installed.version);
    expect(HIGHLIGHT_ENGINE.version).toBe(core.versionString);
    expect(Object.isFrozen(HIGHLIGHT_ENGINE)).toBe(true);
  });

  it('the registry is the 18 grammars of L1, unchanged (no php, Q8)', () => {
    expect(Object.keys(LANGUAGES)).toHaveLength(18);
    expect(Object.keys(LANGUAGES)).not.toContain('php');
    expect(LANGUAGES).toBe(renderHighlight.LANGUAGES);
    expect(resolveLanguage).toBe(renderHighlight.resolveLanguage);
  });

  it('its types', () => {
    expectTypeOf(createHighlighter).toEqualTypeOf<(o?: HighlighterOptions) => Highlighter>();
    expectTypeOf<keyof HighlighterOptions>().toEqualTypeOf<'maxDocumentChars'>();
    expectTypeOf<Highlighter['highlight']>().toEqualTypeOf<(code: string, info: string) => HighlightResult>();
    expectTypeOf<HighlightResult>().toEqualTypeOf<{
      html: string;
      language: string | null;
      mode: HighlightMode;
      charsUsed: number;
    }>();
    expectTypeOf<HighlightMode>().toEqualTypeOf<'whole' | 'lines' | 'plain'>();
    expectTypeOf(HIGHLIGHT_ENGINE).toEqualTypeOf<Readonly<{ name: 'highlight.js'; version: string }>>();
  });

  it('the entry only re-exports src/render/highlight.ts, so the render purity walls cover what it ships', () => {
    const text = readText('src/highlight/index.ts')
      .replace(/^\/\/.*$/gm, '')
      .trim();
    const statements = text.split(/;\s*/).filter((s) => s !== '');
    expect(statements.length).toBeGreaterThan(0);
    expect(statements.filter((s) => !/^export (?:type )?\{[^}]*\} from '\.\.\/render\/highlight\.js'$/.test(s))).toEqual([]);
  });
});

describe('createHighlighter: one highlighter, one document budget', () => {
  it('a short block is highlighted whole; a long one line by line; the language is the canonical name', () => {
    const h = createHighlighter();
    const short = h.highlight('let a = 1;\n', 'js');
    expect(short).toEqual({
      html: '<span class="hljs-keyword">let</span> a = <span class="hljs-number">1</span>;\n',
      language: 'javascript',
      mode: 'whole',
      charsUsed: 11,
    });
    const long = 'let a = 1;\n'.repeat(30);
    const r = h.highlight(long, 'JavaScript extra words');
    expect(r.mode).toBe('lines');
    expect(r.language).toBe('javascript');
    expect(r.charsUsed).toBe(11 + long.length);
    expect(r.html).toBe(renderHighlight.highlightCode(long, 'javascript'));
  });

  it('an unregistered or absent name, a line over MAX_LINE_CHARS, or a block past the budget is plain escaped text', () => {
    const h = createHighlighter({ maxDocumentChars: 20 });
    expect(h.highlight('<a href="x">\'</a>\n', 'nonsense')).toEqual({
      html: '&lt;a href=&quot;x&quot;&gt;\'&lt;/a&gt;\n',
      language: null,
      mode: 'plain',
      charsUsed: 0,
    });
    expect(h.highlight('x\n', '')).toMatchObject({ language: null, mode: 'plain', charsUsed: 0 });
    const wide = `${'a'.repeat(MAX_LINE_CHARS + 1)}\n`;
    expect(createHighlighter().highlight(wide, 'python')).toMatchObject({ language: 'python', mode: 'plain', charsUsed: 0 });
    expect(createHighlighter().highlight(`${'a'.repeat(MAX_LINE_CHARS)}\n`, 'python').mode).toBe('lines');
    expect(h.highlight('x = 1\n'.repeat(3), 'python')).toMatchObject({ mode: 'whole', charsUsed: 18 });
    expect(h.highlight('x = 1\n', 'python')).toMatchObject({ language: 'python', mode: 'plain', charsUsed: 18 });
    expect(h.highlight('y\n', 'python')).toMatchObject({ mode: 'whole', charsUsed: 20 });
  });

  it('the default budget is MAX_DOCUMENT_CHARS, and each highlighter has its own', () => {
    const block = `${'x = 1\n'.repeat(60)}`;
    const fill = (h: Highlighter): HighlightResult[] =>
      Array.from({ length: Math.ceil(MAX_DOCUMENT_CHARS / block.length) + 1 }, () => h.highlight(block, 'python'));
    const a = fill(createHighlighter());
    const used = Math.floor(MAX_DOCUMENT_CHARS / block.length) * block.length;
    expect(a.at(-1)).toMatchObject({ mode: 'plain', charsUsed: used });
    expect(a.filter((r) => r.mode !== 'plain')).toHaveLength(Math.floor(MAX_DOCUMENT_CHARS / block.length));
    expect(createHighlighter().highlight(block, 'python')).toMatchObject({ mode: 'lines', charsUsed: block.length });
  });

  it('maxDocumentChars 0 highlights nothing; the option must be a non-negative safe integer', () => {
    expect(createHighlighter({ maxDocumentChars: 0 }).highlight('x = 1\n', 'python')).toMatchObject({ mode: 'plain', charsUsed: 0 });
    for (const v of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53]) {
      expect(() => createHighlighter({ maxDocumentChars: v })).toThrow(RangeError);
    }
    for (const v of ['1', null]) {
      expect(() => createHighlighter({ maxDocumentChars: v as unknown as number })).toThrow(RangeError);
    }
  });

  it('refuses a code or info that is not a string', () => {
    const h = createHighlighter();
    expect(() => h.highlight(1 as unknown as string, 'python')).toThrow(TypeError);
    expect(() => h.highlight('x', null as unknown as string)).toThrow(TypeError);
  });
});

describe('L3.R2: ./highlight is the code render() uses', () => {
  it('the same function object, imported by the fence rule and by nothing else in src/render', () => {
    expect(createHighlighter).toBe(renderHighlight.createHighlighter);
    const dir = path.join(ROOT, 'src', 'render');
    const users = readFileSync(path.join(dir, 'env.ts'), 'utf8');
    expect(users).toMatch(/import \{[^}]*\bcreateHighlighter\b[^}]*\} from '\.\/highlight\.js'/);
    const fence = readFileSync(path.join(dir, 'fence.ts'), 'utf8');
    expect(fence).toMatch(/env\.highlighter\.highlight\(/);
    expect(fence).not.toMatch(/\bhighlightCode\b|\bescapeHtml\(/);
    // Nothing else in src/render reaches the colouring code: env.ts alone imports createHighlighter or highlightCode
    // from './highlight.js', and highlight.ts alone imports highlight.js's engine as a value.
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts')).sort();
    expect(files).toContain('tables.ts');
    const importers: string[] = [];
    const engines: string[] = [];
    for (const f of files) {
      const text = readFileSync(path.join(dir, f), 'utf8');
      for (const m of text.matchAll(/^import\s+(type\s+)?([^;]*?)\s+from\s+'([^']+)';/gms)) {
        const [, typeOnly, names = '', from] = m;
        if (from === './highlight.js' && /\b(?:createHighlighter|highlightCode)\b/.test(names)) importers.push(f);
        if (from === 'highlight.js/lib/core' && typeOnly === undefined) engines.push(f);
      }
    }
    expect(importers).toEqual(['env.ts']);
    expect(engines).toEqual(['highlight.ts']);
  });

  it('over every corpus fence, its html is render()\'s, in order, with one highlighter a document', () => {
    let compared = 0;
    const problems: string[] = [];
    for (const c of withFences) {
      const r = render(c.input, c.options);
      if (r.outcome !== 'rendered') continue;
      const got = blocks(r.html);
      const fences = codeFences(c.input);
      if (got.length !== fences.length) {
        problems.push(`${c.id}: ${fences.length} fences, ${got.length} code blocks`);
        continue;
      }
      const h = createHighlighter();
      fences.forEach((f, i) => {
        const mine = h.highlight(codeText(f.content), f.info);
        const theirs = got[i] as Block;
        const cls = mine.language === null ? 'hljs' : `hljs language-${mine.language}`;
        if (mine.html !== theirs.inner || cls !== theirs.cls) problems.push(`${c.id}: fence ${i} differs`);
        compared += 1;
      });
    }
    expect(problems).toEqual([]);
    expect(compared).toBeGreaterThan(40);
  });
});

describe('L3.R1: render(md, {highlight: false})', () => {
  it('equals render() as text over the corpus, keeps every wrapper and class, and writes no span in code', () => {
    const problems: string[] = [];
    let plainFences = 0;
    for (const c of cases) {
      const on = render(c.input, c.options);
      const off = render(c.input, { ...c.options, highlight: false });
      if (off.outcome !== on.outcome) problems.push(`${c.id}: outcome ${off.outcome}, not ${on.outcome}`);
      if (JSON.stringify(off.meta) !== JSON.stringify(on.meta)) problems.push(`${c.id}: meta differs`);
      if (normaliseForCompare(off.html) !== normaliseForCompare(on.html)) problems.push(`${c.id}: text differs`);
      if (outsideCode(off.html) !== outsideCode(on.html)) problems.push(`${c.id}: html outside code differs`);
      const a = blocks(on.html);
      const b = blocks(off.html);
      if (JSON.stringify(a.map((x) => x.cls)) !== JSON.stringify(b.map((x) => x.cls))) problems.push(`${c.id}: classes differ`);
      if (b.some((x) => x.inner.includes('<'))) problems.push(`${c.id}: markup inside a code block`);
      if (a.length === 0 && off.html !== on.html) problems.push(`${c.id}: no fence, and not byte-equal`);
      plainFences += b.length;
    }
    expect(problems).toEqual([]);
    expect(plainFences).toBeGreaterThan(40);
  });

  it('a fence keeps its wrapper, data-line and language class; a Mermaid figure is unaffected', () => {
    const md = '```python\nx = "a" < 1\n```\n\n```mermaid\ngraph TD\nA-->B\n```\n';
    expect(render(md, { highlight: false }).html).toBe(
      '<div class="codehilite" data-line="1-3"><pre><code class="hljs language-python">x = &quot;a&quot; &lt; 1\n</code></pre></div>\n' +
        '<figure class="mermaid-figure" data-line="5-8"><pre class="mermaid">graph TD\nA--&gt;B\n</pre></figure>\n',
    );
    expect(render(md).html).toContain('<span class="hljs-string">');
    expect(render(md, { highlight: true }).html).toBe(render(md).html);
  });

  it('highlight must be a boolean', () => {
    for (const v of ['false', 0, null]) {
      expect(() => render('x', { highlight: v as unknown as boolean })).toThrow(TypeError);
    }
  });
});

/** Every `subLanguage` in a highlight.js language definition, as "path value". */
function subLanguages(definition: object): string[] {
  const out: string[] = [];
  const seen = new Set<object>();
  const walk = (node: unknown, at: string): void => {
    if (typeof node !== 'object' || node === null || seen.has(node)) return;
    seen.add(node);
    for (const [k, v] of Object.entries(node)) {
      if (k === 'subLanguage') out.push(`${at} ${JSON.stringify(v)}`);
      walk(v, `${at}.${k}`);
    }
  };
  walk(definition, '');
  return out.sort();
}

// The copy render() registers, read as the highlight.js language function it is: its exported type names no
// highlight.js type, so that `./highlight`'s declarations stay DOM-free.
const xmlCopy = renderHighlight.xmlWithoutSubLanguages as typeof stockXml;

const JS_OR_CSS = ['class="language-javascript"', 'class="language-css"', 'class="hljs-subst"', 'class="hljs-selector-tag"', 'class="hljs-attribute"'];

describe('L3.R3: xml without its embedded sub-languages (request (c))', () => {
  it('the stock grammar sends script to javascript and style to css; the private copy sends nothing anywhere', () => {
    expect(subLanguages(stockXml(core))).toEqual(['.contains.5.starts "css"', '.contains.6.starts "javascript"']);
    expect(subLanguages(xmlCopy(core))).toEqual([]);
  });

  it('copying leaves the package\'s own grammar alone', () => {
    xmlCopy(core);
    expect(subLanguages(stockXml(core))).toHaveLength(2);
  });

  const SAMPLE = '<script>var a = `${b}`; function f() { return 1; }</script>\n<style>a > b { color: red; }</style>\n';

  for (const name of ['xml', 'html', 'svg', 'HTML']) {
    it(`a ${name} fence: its tags are coloured, its script and style text is not handed to another grammar`, () => {
      const r = createHighlighter().highlight(SAMPLE, name);
      expect(r.language).toBe('xml');
      expect(r.html).toContain('<span class="hljs-tag">');
      expect(JS_OR_CSS.filter((s) => r.html.includes(s))).toEqual([]);
      const html = render(`\`\`\`${name}\n${SAMPLE}\`\`\`\n`).html;
      expect(html).toContain('<code class="hljs language-xml">');
      expect(JS_OR_CSS.filter((s) => html.includes(s))).toEqual([]);
    });
  }

  it('a markdown fence\'s inline tags show no javascript or css class either (a property, not a guard of the copy)', () => {
    const html = createHighlighter().highlight('a <script>var a = 1;</script>\n', 'markdown').html;
    expect(html).toContain('hljs-tag');
    expect(JS_OR_CSS.filter((s) => html.includes(s))).toEqual([]);
  });

  it('the stock grammar does colour the same sample through javascript and css (the probe\'s control)', () => {
    const stock = core.newInstance();
    stock.registerLanguage('javascript', stockJavascript);
    stock.registerLanguage('css', stockCss);
    stock.registerLanguage('xml', stockXml);
    const html = stock.highlight(SAMPLE, { language: 'xml', ignoreIllegals: true }).value;
    expect(JS_OR_CSS.filter((s) => html.includes(s))).toEqual(JS_OR_CSS);
  });

  // The html variant is the committed case's input with the fence named html, judged by the same verdict (the
  // generated inputs' 8 MiB total has no room for a second 256 KiB input, test/hostile-input.test.ts).
  const XML_CASE = cases.find((x) => x.id === 'h-xml-script-style-256k');
  const variants: [string, string][] = [
    ['xml', XML_CASE?.input ?? ''],
    ['html', (XML_CASE?.input ?? '').replace(/^```xml\n/, '```html\n')],
  ];
  for (const [name, input] of variants) {
    it(`h-xml-script-style-256k, fence named ${name}: its verdict holds with highlighting on and off (timeScale 1)`, () => {
      const verdict = XML_CASE?.verdict;
      expect(verdict).toBeDefined();
      if (verdict === undefined || verdict === null) return;
      expect(input.startsWith(`\`\`\`${name}\n`)).toBe(true);
      for (const highlight of [true, false]) {
        const t0 = performance.now();
        const r = render(input, { highlight });
        const ms = performance.now() - t0;
        const lines = evaluateVerdict(r, input, verdict, { ms, scan: null, timeScale: 1 });
        // With highlighting off nothing is coloured, so only the verdict's tag requirement cannot hold there.
        expect(lines.filter((l) => !(highlight === false && l === 'require: the html lacks "<span class=\\"hljs-tag\\">"')), `highlight: ${String(highlight)}`).toEqual([]);
      }
    });
  }
});

describe('./highlight is pure and worker-safe', () => {
  it('the frame project, which holds src/highlight, loads no DOM declarations', () => {
    const r = spawnSync(process.execPath, [TSC, '--noEmit', '-p', 'tsconfig.frame.json', '--listFilesOnly'], { cwd: ROOT, encoding: 'utf8' });
    expect(r.status).toBe(0);
    const files = r.stdout.split('\n').filter((f) => f !== '');
    expect(files.some((f) => f.endsWith('src/highlight/index.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('src/render/highlight.ts'))).toBe(true);
    expect(files.filter((f) => /lib\.(?:dom|webworker)[.\w]*\.d\.ts$|@types\/node\//.test(f))).toEqual([]);
  });

  // The row above reads src/highlight through tsconfig.frame.json's `paths` stubs, which do not ship. This one reads
  // what a consumer gets: the declarations tsc emits for the entry, resolved against highlight.js's real types (whose
  // index.d.ts begins `/// <reference lib="dom" />`) by a worker project with skipLibCheck off. A declaration on the
  // entry's re-export chain that names a highlight.js type brings the DOM library into that worker, which conflicts
  // with lib.webworker.d.ts.
  it('its emitted declarations, read by a worker consumer with highlight.js\'s real types, load no DOM declarations', () => {
    const work = mkdtempSync(path.join(tmpdir(), 'docserver-highlight-dts-'));
    try {
      symlinkSync(path.join(ROOT, 'node_modules'), path.join(work, 'node_modules'), 'dir');
      writeFileSync(
        path.join(work, 'tsconfig.emit.json'),
        JSON.stringify({
          extends: path.join(ROOT, 'tsconfig.build.json'),
          compilerOptions: { rootDir: path.join(ROOT, 'src'), outDir: path.join(work, 'dts'), declaration: true, emitDeclarationOnly: true, types: [] },
          files: [path.join(ROOT, 'src', 'highlight', 'index.ts')],
          include: [],
        }),
      );
      const emit = spawnSync(process.execPath, [TSC, '-p', path.join(work, 'tsconfig.emit.json')], { cwd: work, encoding: 'utf8' });
      expect(emit.stdout + emit.stderr).toBe('');
      expect(emit.status).toBe(0);
      expect(existsSync(path.join(work, 'dts', 'highlight', 'index.d.ts'))).toBe(true);
      writeFileSync(
        path.join(work, 'worker.ts'),
        "import { createHighlighter, HIGHLIGHT_ENGINE } from './dts/highlight/index.js';\n" +
          "export const html: string = createHighlighter().highlight('let a = 1;', 'js').html + HIGHLIGHT_ENGINE.version;\n",
      );
      writeFileSync(
        path.join(work, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            strict: true,
            noEmit: true,
            skipLibCheck: false,
            lib: ['ES2022', 'WebWorker'],
            types: [],
          },
          files: ['worker.ts'],
        }),
      );
      const r = spawnSync(process.execPath, [TSC, '-p', path.join(work, 'tsconfig.json'), '--listFiles'], { cwd: work, encoding: 'utf8' });
      const files = r.stdout.split('\n').filter((f) => f.endsWith('.d.ts') || f.endsWith('.ts'));
      expect(files.some((f) => f.endsWith('dts/render/highlight.d.ts'))).toBe(true);
      expect(files.filter((f) => /lib\.dom[.\w]*\.d\.ts$|node_modules\/highlight\.js\//.test(f))).toEqual([]);
      expect(r.status, r.stdout.split('\n').filter((l) => / error TS\d+/.test(l)).slice(0, 5).join('\n')).toBe(0);
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  }, 180_000);

  it('bundled, it runs in an empty VM context and gives the Node import\'s results', () => {
    const out = buildSync({
      entryPoints: [path.join(ROOT, 'src', 'highlight', 'index.ts')],
      bundle: true,
      write: false,
      platform: 'browser',
      format: 'iife',
      globalName: 'H',
      target: 'es2022',
      logLevel: 'silent',
    });
    expect(out.warnings).toEqual([]);
    const context = vm.createContext(Object.create(null));
    vm.runInContext(out.outputFiles[0]?.text ?? '', context);
    const H = (context as Record<string, unknown>)['H'] as typeof entry;
    const sample = '<script>var a = 1;</script>\nlet b = `${c}`;\n';
    for (const info of ['xml', 'js', 'python', 'nonsense']) {
      const theirs = vm.runInContext(`H.createHighlighter().highlight(${JSON.stringify(sample)}, ${JSON.stringify(info)})`, context) as HighlightResult;
      expect(JSON.parse(JSON.stringify(theirs))).toEqual(createHighlighter().highlight(sample, info));
    }
    expect(H.HIGHLIGHT_ENGINE.version).toBe(HIGHLIGHT_ENGINE.version);
    expect(Object.keys(context as object).sort()).toEqual(['H']);
  });
});
