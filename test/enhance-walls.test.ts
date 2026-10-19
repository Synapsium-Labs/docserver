// The static walls of `./enhance` (L2 prototype), read from the sources with TypeScript's syntax tree, so
// comments and strings do not count:
// 1. Import inertness: importing src/enhance/index.ts in the node environment (no document) succeeds, creates no
//    global and starts no timer; and no source file runs code at its top level (a call, a `new` or a tagged
//    template outside a function body), so that holds for every file, not only the ones this run reached.
// 2. CSP and purity: no source names an HTML-string sink, code from strings, the network, a storage API, the
//    page's location or history, cookies, the global document or window, or an id lookup, as an identifier or as
//    a string key (`el['innerHTML']`), and no member name is built at run time (`el['outer' + 'HTML']`); no page
//    part outside the root is reached (`.body`, `.head`, `.write`, `.open`, a write to `.title`), and the root's
//    window (`.defaultView`) only at the one site that listens for printing (folds.ts); no selector string holds
//    `#` or an `[id=...]` match, and no selector is built at run time; no attribute that runs code, loads a URL or
//    styles is written (an `on...` name, `src`, `srcset`, `srcdoc`, `style` and the like, by `setAttribute`, in an
//    attribute map or as a property), and outside journal.ts no attribute name is built at run time; no `cssText`.
// 3. The only globals a source names are the language's own (Object, Promise, Map, ...): a TypeScript program over
//    src/enhance with the DOM library resolves every free identifier, and one that the DOM library declares
//    (window, document, parent, top, navigator, Image, DOMParser, setTimeout, ...) is refused unless listed.
//    Everything of the browser the reader uses, it reaches through the root it was given.
// 4. The import graph stays inside src/enhance.
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
  // more HTML-string sinks and parsers, reflection, and what reaches past the root's document
  'DOMParser', 'createContextualFragment', 'setHTMLUnsafe', 'parseHTMLUnsafe', 'writeln', 'srcdoc', 'Reflect',
  'navigator', 'postMessage', 'getRootNode', 'importScripts', 'execCommand',
];

/** Member names src/enhance never uses, by `.name` or by a string key: the page outside the root, and document writes. */
const FORBIDDEN_MEMBERS: readonly string[] = ['body', 'head', 'write', 'open', 'defaultView'];

/** Where a forbidden member is allowed all the same, and how often: the root's window, for the print listener. */
const ALLOWED_SITES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  'src/enhance/folds.ts': { defaultView: 1 },
};

/** Attribute names never written: inline handlers (any `on...`), what loads a URL or a frame, and style. */
const ATTRIBUTE_BANNED = /^(?:on[a-z]+|style|src|srcset|srcdoc|action|formaction|ping|poster|background|data)$/i;

/** Property writes that would do what a banned attribute does: an inline handler, a URL load, the page's title. */
const PROPERTY_WRITE_BANNED = /^(?:on[a-z]+|src|srcset|srcdoc|title)$/;

/** The lib globals src/enhance may name: the language's own objects. */
const GLOBALS: ReadonlySet<string> = new Set([
  'AggregateError', 'Array', 'Error', 'JSON', 'Map', 'Math', 'Number', 'Object', 'Promise', 'RegExp', 'Set', 'String',
  'WeakMap', 'undefined',
]);

/** Calls whose first argument is a selector. */
const SELECTOR_CALLS: ReadonlySet<string> = new Set(['querySelector', 'querySelectorAll', 'closest', 'matches']);

function parse(fileName: string, source: string): ts.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
}

/** True for a key made by joining strings: `'outer' + 'HTML'`, `prefix + 'HTML'`, a template. Index arithmetic is not. */
function builtString(key: ts.Expression): boolean {
  if (ts.isTemplateExpression(key)) return true;
  if (ts.isParenthesizedExpression(key)) return builtString(key.expression);
  if (!ts.isBinaryExpression(key) || key.operatorToken.kind !== ts.SyntaxKind.PlusToken) return false;
  const stringy = (e: ts.Expression): boolean => ts.isStringLiteralLike(e) || builtString(e);
  return stringy(key.left) || stringy(key.right);
}

/** A selector that looks an element up by its id: `#x`, or an attribute match on id (`[id="x"]`, `[id^=x]`). */
const ID_SELECTOR = /#|\[\s*id\s*[~|^$*]?=/i;

/** Every wall violation in a source text, as "line:column what". */
function violations(fileName: string, source: string): string[] {
  const sf = parse(fileName, source);
  const banned = new Set(FORBIDDEN);
  const members = new Set(FORBIDDEN_MEMBERS);
  const genericSetter = rel(fileName) === 'src/enhance/journal.ts';
  const out: string[] = [];
  const at = (node: ts.Node, what: string): void => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    out.push(`${line + 1}:${character + 1} ${what}`);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && banned.has(node.text)) at(node, node.text);
    if (ts.isPropertyAccessExpression(node) && members.has(node.name.text)) at(node.name, `.${node.name.text}`);
    // A string key reads a member as surely as a dot does; a key built at run time could be anything.
    if (ts.isElementAccessExpression(node)) {
      const key = node.argumentExpression;
      if (ts.isStringLiteralLike(key)) {
        if (banned.has(key.text) || members.has(key.text)) at(key, `['${key.text}']`);
      } else if (builtString(key)) at(key, '[<member built at run time>]');
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const left = node.left;
      if (ts.isPropertyAccessExpression(left) && PROPERTY_WRITE_BANNED.test(left.name.text)) at(left.name, `.${left.name.text} =`);
    }
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) at(node, 'import()');
      const callee = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : ts.isIdentifier(node.expression) ? node.expression.text : '';
      const [first] = node.arguments;
      if (SELECTOR_CALLS.has(callee) && first !== undefined) {
        if (!ts.isStringLiteralLike(first)) at(first, `${callee}(<built at run time>)`);
        else if (ID_SELECTOR.test(first.text)) at(first, `${callee}('${first.text}')`);
      }
      // Element.setAttribute(name, v) and journal.setAttribute(el, name, v): the name is the first argument of the
      // one and the second of the other. It is a literal everywhere but journal.ts, and never a banned name.
      if (/^(?:setAttribute|setAttributeNS|toggleAttribute)$/.test(callee) && ts.isPropertyAccessExpression(node.expression)) {
        const onJournal = /(?:^|\.)journal$/.test(node.expression.expression.getText(sf));
        const name = node.arguments[(onJournal ? 1 : 0) + (callee === 'setAttributeNS' ? 1 : 0)];
        if (name !== undefined && ts.isStringLiteralLike(name)) {
          if (ATTRIBUTE_BANNED.test(name.text)) at(name, `${callee}('${name.text}')`);
        } else if (name !== undefined && !genericSetter && !ts.isIdentifier(name)) at(name, `${callee}(<name built at run time>)`);
        else if (name !== undefined && !genericSetter && ts.isIdentifier(name)) at(name, `${callee}(<name in a variable>)`);
      }
    }
    // An attribute map such as chrome()'s `attrs` never carries a banned key either.
    if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
      const name = node.name;
      if ((ts.isIdentifier(name) || ts.isStringLiteralLike(name)) && name.text.toLowerCase() === 'style') at(name, 'style key');
      else if (
        (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) &&
        ATTRIBUTE_BANNED.test(name.text) &&
        ts.isObjectLiteralExpression(node.parent) &&
        ts.isPropertyAssignment(node.parent.parent) &&
        node.parent.parent.name.getText(sf) === 'attrs'
      ) {
        at(name, `attrs key ${name.text}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** What a file may use all the same: drop up to the allowed count of each allowed member from its violations. */
function afterAllowed(file: string, found: readonly string[]): string[] {
  const left = { ...(ALLOWED_SITES[file] ?? {}) };
  return found.filter((v) => {
    const name = /^\d+:\d+ \.(\w+)$/.exec(v)?.[1];
    if (name === undefined || (left[name] ?? 0) === 0) return true;
    left[name] = (left[name] ?? 0) - 1;
    return false;
  });
}

/** True when an identifier stands for a value it names, rather than a member, a key or a declared name. */
function isValueReference(id: ts.Identifier): boolean {
  const p = id.parent;
  if ((ts.isPropertyAccessExpression(p) || ts.isQualifiedName(p)) && (ts.isPropertyAccessExpression(p) ? p.name : p.right) === id) return false;
  if ((ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isPropertySignature(p) || ts.isMethodDeclaration(p) || ts.isMethodSignature(p)) && p.name === id) return false;
  if (ts.isBindingElement(p) && p.propertyName === id) return false;
  if ((ts.isImportSpecifier(p) || ts.isExportSpecifier(p)) && p.propertyName === id) return false;
  return true;
}

/**
 * Every DOM-library global the given sources name, as "file:line:column global X", for the names GLOBALS does not
 * list. A program over the sources (with the DOM library, no Node types) resolves each free identifier; one whose
 * every declaration is in a default library file is a global.
 */
function globalUses(files: readonly { name: string; text: string }[]): string[] {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    types: [],
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options, true);
  const mem = new Map(files.map((f) => [path.resolve(f.name), f.text]));
  const getSourceFile = host.getSourceFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  host.getSourceFile = (name, lang, ...rest) => {
    const text = mem.get(path.resolve(name));
    return text === undefined ? getSourceFile(name, lang, ...rest) : ts.createSourceFile(name, text, lang, true);
  };
  host.fileExists = (name) => mem.has(path.resolve(name)) || fileExists(name);
  host.readFile = (name) => mem.get(path.resolve(name)) ?? readFile(name);
  const program = ts.createProgram([...mem.keys()], options, host);
  const checker = program.getTypeChecker();
  const out: string[] = [];
  for (const sf of program.getSourceFiles()) {
    if (!mem.has(path.resolve(sf.fileName))) continue;
    const visit = (node: ts.Node): void => {
      if (ts.isTypeNode(node)) return; // a type names no value
      if (ts.isIdentifier(node) && isValueReference(node)) {
        const decls = checker.getSymbolAtLocation(node)?.declarations ?? [];
        const isGlobal = decls.length > 0 && decls.every((d) => program.isSourceFileDefaultLibrary(d.getSourceFile()));
        if (isGlobal && !GLOBALS.has(node.text)) {
          const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          out.push(`${rel(sf.fileName)}:${String(line + 1)}:${String(character + 1)} global ${node.text}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
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
    const found = sources().flatMap((f) => afterAllowed(rel(f), violations(f, readFileSync(f, 'utf8'))).map((u) => `${rel(f)}:${u}`));
    expect(found).toEqual([]);
  });

  it('the one allowed site is used exactly as allowed, so the exception cannot widen unseen', () => {
    for (const [file, allowed] of Object.entries(ALLOWED_SITES)) {
      const found = violations(path.join(ROOT, file), readFileSync(path.join(ROOT, file), 'utf8'));
      for (const [name, count] of Object.entries(allowed)) expect(found.filter((v) => v.endsWith(` .${name}`))).toHaveLength(count);
    }
  });

  it('the scan sees string keys, keys built at run time, page members, URL and handler attributes, and id matches', () => {
    const probe = [
      "el['innerHTML'] = html;",
      "el['outer' + 'HTML'] = html;",
      'root.ownerDocument.write(html); root.ownerDocument.open();',
      "doc.defaultView['local' + 'Storage'];",
      'doc.createRange().createContextualFragment(html);',
      "new DOMParser().parseFromString(html, 'text/html');",
      'root.setHTMLUnsafe?.(html);',
      "Reflect.set(root, 'innerHTML', html);",
      "root.setAttribute('onclick', 'alert(1)'); root.setAttribute('srcdoc', html);",
      "img.src = 'https://example.com/beacon';",
      "root.setAttribute('STY' + 'LE', 'x'); root.setAttribute(name, 'x');",
      'doc.body.append(x);',
      "(root.getRootNode() as Document).title = 'x'; doc.title = 'x';",
      "root.querySelector('[id=\"top\"]'); root.querySelector('h2[id]');",
      "journal.setAttribute(el, 'onload', x); chrome(doc, 'img', { attrs: { src: u, href: '#a' } }); el.onclick = f;",
    ].join('\n');
    expect(violations('probe.ts', probe)).toEqual([
      "1:4 ['innerHTML']",
      '2:4 [<member built at run time>]',
      '3:20 .write',
      '3:52 .open',
      '4:17 [<member built at run time>]',
      '4:5 .defaultView',
      '5:19 createContextualFragment',
      '6:5 DOMParser',
      '7:6 setHTMLUnsafe',
      '8:1 Reflect',
      "9:19 setAttribute('onclick')",
      "9:61 setAttribute('srcdoc')",
      '10:5 .src =',
      '11:19 setAttribute(<name built at run time>)',
      '11:57 setAttribute(<name in a variable>)',
      '12:5 .body',
      '13:34 .title =',
      '13:7 getRootNode',
      '13:51 .title =',
      `14:20 querySelector('[id="top"]')`,
      "15:26 setAttribute('onload')",
      '15:70 attrs key src',
      '15:98 .onclick =',
    ]);
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
      '13:17 setAttribute(<name in a variable>)',
      "14:26 setAttribute('STYLE')",
      '15:32 style key',
      '15:44 style key',
    ]);
  });
});

describe('enhance walls: globals', () => {
  it('no source file names a DOM-library global beyond the language\'s own objects', () => {
    expect(globalUses(sources().map((f) => ({ name: f, text: readFileSync(f, 'utf8') })))).toEqual([]);
  });

  it('the global scan resolves names: a global is caught however it is named, a local of the same name is not', () => {
    const probe = [
      'export function f(root: HTMLElement): void {',
      '  parent.postMessage(1, "*");',
      '  const t = top; void self; void navigator.userAgent; void new Image(); setTimeout(() => undefined);',
      '  const ok = new Map<string, number>(); void JSON.stringify([...ok]);',
      '}',
      'export function g(parent: Node, top: Node): Node { return parent.contains(top) ? parent : top; }',
      'export const h = (el: Element): boolean => el instanceof HTMLElement;',
    ].join('\n');
    expect(globalUses([{ name: path.join(ROOT, 'probe-globals.ts'), text: probe }]).map((u) => u.replace(/^[^:]+:/, ''))).toEqual([
      '2:3 global parent',
      '3:13 global top',
      '3:23 global self',
      '3:34 global navigator',
      '3:64 global Image',
      '3:73 global setTimeout',
      '7:58 global HTMLElement',
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
