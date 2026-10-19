// The static walls of `./enhance` (L2 prototype), read from the sources with TypeScript's syntax tree, so
// comments and strings do not count:
// 1. Import inertness: importing src/enhance/index.ts in the node environment (no document) succeeds, creates no
//    global and starts no timer; and no source file runs code at its top level (a call, a `new` or a tagged
//    template outside a function body), so that holds for every file, not only the ones this run reached.
// 2. CSP and purity: no source names an HTML-string sink, code from strings, the network, a storage API, the
//    page's location or history, cookies, the global document or window, or an id lookup; no selector string
//    holds `#`, and no selector is built at run time; no style attribute is written (no `setAttribute('style')`,
//    no `style` key in an attribute map, no `cssText`).
// 3. The import graph stays inside src/enhance.
// The README names every runtime export of the entry.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ENHANCE_DIR = path.join(ROOT, 'src', 'enhance');

function sources(): string[] {
  return readdirSync(ENHANCE_DIR)
    .filter((f) => f.endsWith('.ts'))
    .sort()
    .map((f) => path.join(ENHANCE_DIR, f));
}

const rel = (p: string): string => path.relative(ROOT, p).split(path.sep).join('/');

/** Identifiers src/enhance never names. */
const FORBIDDEN: readonly string[] = [
  // HTML-string sinks and code from strings
  'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'eval', 'Function', 'cssText',
  // network
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon',
  // storage
  'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'cookie',
  // the page around the root
  'location', 'history', 'document', 'window', 'globalThis', 'documentElement',
  // id lookups
  'getElementById',
];

/** Calls whose first argument is a selector. */
const SELECTOR_CALLS: ReadonlySet<string> = new Set(['querySelector', 'querySelectorAll', 'closest', 'matches']);

function parse(fileName: string, source: string): ts.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
}

/** Every wall violation in a source text, as "line:column what". */
function violations(fileName: string, source: string): string[] {
  const sf = parse(fileName, source);
  const banned = new Set(FORBIDDEN);
  const out: string[] = [];
  const at = (node: ts.Node, what: string): void => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    out.push(`${line + 1}:${character + 1} ${what}`);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && banned.has(node.text)) at(node, node.text);
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) at(node, 'import()');
      const callee = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : ts.isIdentifier(node.expression) ? node.expression.text : '';
      const [first] = node.arguments;
      if (SELECTOR_CALLS.has(callee) && first !== undefined) {
        if (!ts.isStringLiteralLike(first)) at(first, `${callee}(<built at run time>)`);
        else if (first.text.includes('#')) at(first, `${callee}('${first.text}')`);
      }
      // Element.setAttribute(name, v) and journal.setAttribute(el, name, v) alike: no attribute named style.
      if (/^(?:setAttribute|setAttributeNS|toggleAttribute)$/.test(callee)) {
        for (const a of node.arguments) if (ts.isStringLiteralLike(a) && a.text.toLowerCase() === 'style') at(a, `${callee}('style')`);
      }
    }
    // An attribute map such as chrome()'s `attrs` never carries a style key.
    if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
      const name = node.name;
      if ((ts.isIdentifier(name) || ts.isStringLiteralLike(name)) && name.text.toLowerCase() === 'style') at(name, 'style key');
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** Code that runs when a file is imported: a call, `new` or tagged template outside every function body. */
function topLevelEffects(fileName: string, source: string): string[] {
  const sf = parse(fileName, source);
  const out: string[] = [];
  const at = (node: ts.Node, what: string): void => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    out.push(`${line + 1}:${character + 1} ${what}`);
  };
  const scan = (node: ts.Node): void => {
    if (ts.isFunctionLike(node) && !ts.isClassStaticBlockDeclaration(node)) return; // runs only when called
    if (ts.isCallExpression(node) || ts.isNewExpression(node) || ts.isTaggedTemplateExpression(node)) at(node, ts.SyntaxKind[node.kind]);
    ts.forEachChild(node, scan);
  };
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isFunctionDeclaration(st)) continue;
    if (ts.isExportDeclaration(st)) continue;
    if (ts.isVariableStatement(st) || ts.isClassDeclaration(st)) {
      scan(st);
      continue;
    }
    at(st, ts.SyntaxKind[st.kind]);
  }
  return out;
}

describe('enhance walls: import inertness', () => {
  it('importing the entry in node (no document) creates no global, starts no timer, and exports exactly the API', async () => {
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
    const names = new Set(Reflect.ownKeys(globalThis));
    const timers = ['setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask'] as const;
    const spies = timers.map((t) => vi.spyOn(globalThis, t));
    vi.resetModules();
    const mod = (await import('../src/enhance/index.js')) as Record<string, unknown>;
    const calls = spies.map((s) => s.mock.calls.length);
    for (const s of spies) s.mockRestore();
    expect(calls).toEqual([0, 0, 0, 0]);
    expect(Reflect.ownKeys(globalThis).filter((k) => !names.has(k))).toEqual([]);
    expect(Object.keys(mod).sort()).toEqual(['EnhanceError', 'destroyEnhancement', 'enhance', 'setEnhancementPrefs']);
  });

  it('no source file runs code at its top level', () => {
    const found = sources().flatMap((f) => topLevelEffects(f, readFileSync(f, 'utf8')).map((u) => `${rel(f)}:${u}`));
    expect(found).toEqual([]);
  });

  it('the top-level scan sees calls, new and statements, and skips function bodies', () => {
    const probe = [
      "import { a } from './a.js';",
      'const ok = { b: [1, 2], c: () => make() };',
      'function f() { return g(); }',
      'const bad = new Map();',
      'let lazy: Map<string, number> | undefined;',
      'register();',
      'export class K { static x = h(); m() { return i(); } }',
    ].join('\n');
    expect(topLevelEffects('probe.ts', probe)).toEqual(['4:13 NewExpression', '6:1 ExpressionStatement', '7:29 CallExpression']);
  });
});

describe('enhance walls: CSP, purity and id lookups', () => {
  it('no source file names a forbidden identifier, a selector with # or built at run time, or a style string', () => {
    const found = sources().flatMap((f) => violations(f, readFileSync(f, 'utf8')).map((u) => `${rel(f)}:${u}`));
    expect(found).toEqual([]);
  });

  it('the scan reads code, not comments or strings, and sees each banned shape', () => {
    const probe = [
      '// innerHTML and document are words in a comment',
      "const s = 'location and history in a string';",
      'el.innerHTML = x;',
      "root.ownerDocument.getElementById('a');",
      'const d = document.cookie;',
      "root.querySelector('#top');",
      'root.querySelectorAll(sel);',
      "el.setAttribute('style', css);",
      'el.style.cssText = css;',
      "const f = new Function('return 1');",
      "fetch('/x'); globalThis.localStorage;",
      "root.querySelector('h2 > .x');",
      "el.setAttribute(name, 'v');",
      "journal.setAttribute(el, 'STYLE', css);",
      "chrome(doc, 'span', { attrs: { style: css, 'Style': css, title: t } });",
    ].join('\n');
    expect(violations('probe.ts', probe)).toEqual([
      '3:4 innerHTML',
      '4:20 getElementById',
      '5:11 document',
      '5:20 cookie',
      "6:20 querySelector('#top')",
      '7:23 querySelectorAll(<built at run time>)',
      "8:17 setAttribute('style')",
      '9:10 cssText',
      '10:15 Function',
      '11:1 fetch',
      '11:14 globalThis',
      '11:25 localStorage',
      "14:26 setAttribute('style')",
      '15:32 style key',
      '15:44 style key',
    ]);
  });
});

describe('enhance walls: the import graph', () => {
  it('every source imports only sibling files of src/enhance', () => {
    const outside = sources().flatMap((f) =>
      ts
        .preProcessFile(readFileSync(f, 'utf8'), true, true)
        .importedFiles.map((i) => i.fileName)
        .filter((spec) => !/^\.\/[a-z]+\.js$/.test(spec))
        .map((spec) => `${rel(f)} imports ${spec}`),
    );
    expect(outside).toEqual([]);
  });
});

describe('README: ./enhance', () => {
  it('names every runtime export of the entry', async () => {
    const README = readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    const mod = (await import('../src/enhance/index.js')) as Record<string, unknown>;
    const names = Object.keys(mod);
    expect(names.length).toBe(4);
    expect(names.filter((n) => !README.includes(`\`${n}\``) && !README.includes(`\`${n}(`))).toEqual([]);
  });
});
