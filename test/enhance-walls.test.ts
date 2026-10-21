// The static walls of `./enhance` (L2 prototype, and the seams of L2 Task 7a), read from the sources with
// TypeScript's syntax tree, so comments and strings do not count:
// 1. Import inertness: importing src/enhance/index.ts in the node environment (no document) succeeds, creates no
//    global and starts no timer; and no source file runs code at its top level (a call, a `new` or a tagged
//    template outside a function body), so that holds for every file, not only the ones this run reached.
// 2. CSP and purity: no source names an HTML-string sink, code from strings, the network, a storage API, the
//    page's location or history, cookies, the global document or window, or an id lookup, as an identifier or as
//    a string key (`el['innerHTML']`), and no member name is built at run time (`el['outer' + 'HTML']`); no page
//    part outside the root is reached (`.body`, `.head`, `.write`, `.open`, a write to `.title`); no selector string
//    holds `#` or an `[id=...]` match, and no selector is built at run time; no attribute that runs code, loads a URL
//    or styles is written (an `on...` name, `src`, `srcset`, `srcdoc`, `style` and the like, by `setAttribute`, in an
//    attribute map or as a property), and outside journal.ts no attribute name is built at run time; no `cssText`.
// 3. One module for the window, one for styles (Task 7a): the root's window (`.defaultView`, an event's `.view`, a
//    frame's `.contentWindow`), its timers, frames and idle callbacks, its observers, its media queries, sizes and
//    scroll position (`.scrollingElement` too), a point lookup, computed styles and the document's fonts are reached
//    only in env.ts, and everywhere else only through the Env (`ctx.env.fonts(...)`): a receiver whose type, by the
//    TypeScript checker, is env.ts's Env, and only for a name Env itself declares, so a variable named `env` that
//    holds the document is refused, and so is `ctx.env.defaultView`. The clock (`Date.now`, `Date()`, `new Date()`
//    with no argument) only in env.ts: elsewhere `Date` is named only as `new Date(value)`, as `Date.<member>` other
//    than `now`, or as a type, so it cannot be passed on (`const D = Date`) or read by a key (`Date['now']`). An
//    element's inline style (`.style`) only in journal.ts, whose setStyle is the one style write (LD11), and the
//    other ways to style a page (`attributeStyleMap`, `styleSheets`, `adoptedStyleSheets`, `insertRule`) nowhere.
//    A name is seen as a member (`.x`), as a string key (`['x']`) and as a destructured property (`const { x } = o`,
//    `{ x: y }`). Each of env.ts and journal.ts uses each such name exactly as often as ALLOWED_SITES says, so the
//    exception cannot widen unseen.
// 4. The only globals a source names are the language's own (Object, Promise, Map, Date, ...): a TypeScript program
//    over src/enhance with the DOM library resolves every free identifier, and one that the DOM library declares
//    (window, document, parent, top, navigator, Image, DOMParser, setTimeout, performance, ...) is refused unless
//    listed. Everything of the browser the reader uses, it reaches through the root it was given.
// 5. The import graph stays inside src/enhance: a sibling file, its name lower-case words joined by dashes.
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
const FORBIDDEN_MEMBERS: readonly string[] = ['body', 'head', 'write', 'open'];

/**
 * Member names that reach the root's window or what it schedules and measures: used in env.ts alone, and everywhere
 * else only on `env` itself (`ctx.env.fonts(...)`, `env.elementFromPoint(...)`), the seam that wraps them.
 */
const WINDOW_MEMBERS: readonly string[] = [
  // the window, and a frame's
  'defaultView', 'view', 'contentWindow',
  // timers, frames, idle callbacks
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'requestIdleCallback', 'cancelIdleCallback', 'queueMicrotask',
  // observers
  'ResizeObserver', 'IntersectionObserver', 'MutationObserver', 'PerformanceObserver',
  // the document's fonts, media queries, sizes, scroll position, a point lookup, computed styles
  'fonts', 'matchMedia', 'innerWidth', 'innerHeight', 'scrollX', 'scrollY', 'pageXOffset', 'pageYOffset',
  'scrollingElement', 'elementFromPoint', 'getComputedStyle',
];

/** Member names used in journal.ts alone: an element's inline style, which setStyle alone writes (LD11). */
const STYLE_MEMBERS: readonly string[] = ['style'];

/** Member names never used: the other ways to style an element or the page, around setStyle's closed list. */
const STYLESHEET_MEMBERS: readonly string[] = ['attributeStyleMap', 'styleSheets', 'adoptedStyleSheets', 'insertRule'];

/**
 * Where a refused name is allowed all the same, and how often, by the violation's text: env.ts reaches the window,
 * and journal.ts an element's inline style. Exact counts, so an exception cannot widen unseen.
 */
const ALLOWED_SITES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  'src/enhance/env.ts': {
    '.defaultView': 1,
    '.setTimeout': 3,
    '.clearTimeout': 3,
    '.requestAnimationFrame': 2,
    '.cancelAnimationFrame': 1,
    '.requestIdleCallback': 2,
    '.cancelIdleCallback': 1,
    '.ResizeObserver': 2,
    '.IntersectionObserver': 2,
    '.fonts': 1,
    '.matchMedia': 1,
    '.innerWidth': 1,
    '.innerHeight': 1,
    '.scrollY': 1,
    '.elementFromPoint': 2,
    '.getComputedStyle': 2,
    'Date.now': 1,
  },
  'src/enhance/journal.ts': { '.style': 1 },
};

/** Attribute names never written: inline handlers (any `on...`), what loads a URL or a frame, and style. */
const ATTRIBUTE_BANNED = /^(?:on[a-z]+|style|src|srcset|srcdoc|action|formaction|ping|poster|background|data)$/i;

/** Property writes that would do what a banned attribute does: an inline handler, a URL load, the page's title. */
const PROPERTY_WRITE_BANNED = /^(?:on[a-z]+|src|srcset|srcdoc|title)$/;

/** The lib globals src/enhance may name: the language's own objects (its clock walled apart, rule 3). */
const GLOBALS: ReadonlySet<string> = new Set([
  'AggregateError', 'Array', 'Boolean', 'Date', 'Error', 'Infinity', 'JSON', 'Map', 'Math', 'NaN', 'Number', 'Object',
  'Promise', 'RangeError', 'RegExp', 'Set', 'String', 'Symbol', 'TypeError', 'WeakMap', 'WeakSet', 'decodeURIComponent',
  'encodeURIComponent', 'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'undefined',
]);

/** Calls whose first argument is a selector. */
const SELECTOR_CALLS: ReadonlySet<string> = new Set(['querySelector', 'querySelectorAll', 'closest', 'matches']);

function parse(fileName: string, source: string): ts.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
}

/** The program options of both checker-based scans: the DOM library, no Node types. */
const PROGRAM_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  types: [],
  strict: true,
  noEmit: true,
  skipLibCheck: true,
};

/** Files read from disk (the libraries, src/enhance), parsed once for every program this file makes. */
const diskFiles = new Map<string, ts.SourceFile>();

/** A program over the given texts (a name relative to src/enhance is put there), the rest read from disk. */
function programOf(files: readonly { name: string; text: string }[]): ts.Program {
  const host = ts.createCompilerHost(PROGRAM_OPTIONS, true);
  const mem = new Map(files.map((f) => [path.resolve(ENHANCE_DIR, f.name), f.text]));
  const getSourceFile = host.getSourceFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  host.getSourceFile = (name, lang, ...rest) => {
    const text = mem.get(path.resolve(name));
    if (text !== undefined) return ts.createSourceFile(name, text, lang, true);
    const key = path.resolve(name);
    let sf = diskFiles.get(key);
    if (sf === undefined) {
      sf = getSourceFile(name, lang, ...rest);
      if (sf !== undefined) diskFiles.set(key, sf);
    }
    return sf;
  };
  host.fileExists = (name) => mem.has(path.resolve(name)) || fileExists(name);
  host.readFile = (name) => mem.get(path.resolve(name)) ?? readFile(name);
  return ts.createProgram([...mem.keys()], PROGRAM_OPTIONS, host);
}

/** True for a node inside a type (an annotation, `typeof x` in a type): it names no value at run time. */
function inType(node: ts.Node): boolean {
  for (let n: ts.Node | undefined = node.parent; n !== undefined; n = n.parent) {
    if (ts.isTypeNode(n)) return true;
    if (ts.isStatement(n) || ts.isExpressionStatement(n)) return false;
  }
  return false;
}

/** Every wall violation in each source text, by name, as "line:column what": one program, one checker. */
function scan(files: readonly { name: string; text: string }[]): Map<string, string[]> {
  const program = programOf(files);
  const checker = program.getTypeChecker();
  const out = new Map<string, string[]>();
  for (const f of files) {
    const sf = program.getSourceFile(path.resolve(ENHANCE_DIR, f.name));
    if (sf === undefined) throw new Error(`walls: ${f.name} is not in the program`);
    out.set(f.name, violationsIn(sf, checker));
  }
  return out;
}

/** Every wall violation in one source text (see scan). */
function violations(fileName: string, source: string): string[] {
  return scan([{ name: fileName, text: source }]).get(fileName) ?? [];
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

/** Every wall violation in a source file of a program, as "line:column what". */
function violationsIn(sf: ts.SourceFile, checker: ts.TypeChecker): string[] {
  const banned = new Set(FORBIDDEN);
  const members = new Set([...FORBIDDEN_MEMBERS, ...STYLE_MEMBERS, ...STYLESHEET_MEMBERS]);
  const windowMembers = new Set(WINDOW_MEMBERS);
  const genericSetter = rel(sf.fileName) === 'src/enhance/journal.ts';
  const out: string[] = [];
  const at = (node: ts.Node, what: string): void => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    out.push(`${line + 1}:${character + 1} ${what}`);
  };
  /**
   * True when `name` is one Env declares and `value`'s type is env.ts's Env: the seam that wraps the window; or one
   * Viewport declares on env.ts's Viewport, the frozen answer of `env.viewport()` (its `scrollY`, Task 14).
   */
  const onEnv = (value: ts.Node, name: string): boolean => {
    const type = checker.getTypeAtLocation(value);
    const sym = type.aliasSymbol ?? type.getSymbol();
    const seam = sym?.getName();
    if ((seam !== 'Env' && seam !== 'Viewport') || !(sym?.declarations ?? []).some((d) => rel(d.getSourceFile().fileName) === 'src/enhance/env.ts')) return false;
    return checker.getPropertiesOfType(type).some((p) => p.getName() === name);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && banned.has(node.text)) at(node, node.text);
    if (ts.isPropertyAccessExpression(node) && members.has(node.name.text)) at(node.name, `.${node.name.text}`);
    // The window's members, except a name of the Env, on the Env: `env.fonts(...)`, `ctx.env.elementFromPoint(...)`.
    if (ts.isPropertyAccessExpression(node) && windowMembers.has(node.name.text) && !onEnv(node.expression, node.name.text)) {
      at(node.name, `.${node.name.text}`);
    }
    // The clock: Date.now, Date() and new Date() with no argument read the time; new Date(value) only converts, and
    // Date.parse or Date.UTC read no clock. Any other use of the name could pass the clock on: refused.
    if (ts.isIdentifier(node) && node.text === 'Date' && isValueReference(node) && !inType(node)) {
      const p = node.parent;
      if (ts.isPropertyAccessExpression(p) && p.expression === node) {
        if (p.name.text === 'now') at(p, 'Date.now');
      } else if (ts.isNewExpression(p) && p.expression === node) {
        if ((p.arguments?.length ?? 0) === 0) at(p, 'new Date()');
      } else if (ts.isCallExpression(p) && p.expression === node) at(p, 'Date()');
      else at(node, 'Date');
    }
    // A string key reads a member as surely as a dot does; a key built at run time could be anything.
    if (ts.isElementAccessExpression(node)) {
      const key = node.argumentExpression;
      if (ts.isStringLiteralLike(key)) {
        if (banned.has(key.text) || members.has(key.text) || windowMembers.has(key.text)) at(key, `['${key.text}']`);
      } else if (builtString(key)) at(key, '[<member built at run time>]');
    }
    // A destructured property reads a member too: `const { style } = el`, `const { defaultView: w } = doc`.
    if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      const key = node.propertyName ?? node.name;
      const text = ts.isIdentifier(key) || ts.isStringLiteralLike(key) ? key.text : ts.isComputedPropertyName(key) && ts.isStringLiteralLike(key.expression) ? key.expression.text : null;
      if (text !== null) {
        if (members.has(text) || (windowMembers.has(text) && !onEnv(node.parent, text))) at(key, `{ ${text} }`);
      } else if (ts.isComputedPropertyName(key) && builtString(key.expression)) at(key, '{ [<member built at run time>] }');
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

/** A violation's text without its position: `.style`, `Date.now`. */
const what = (v: string): string => v.replace(/^\d+:\d+ /, '');

/** What a file may use all the same: drop up to the allowed count of each allowed violation from its violations. */
function afterAllowed(file: string, found: readonly string[]): string[] {
  const left: Record<string, number> = { ...(ALLOWED_SITES[file] ?? {}) };
  return found.filter((v) => {
    const key = what(v);
    if ((left[key] ?? 0) === 0) return true;
    left[key] = (left[key] ?? 0) - 1;
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
  const program = programOf(files);
  const mem = new Set(files.map((f) => path.resolve(ENHANCE_DIR, f.name)));
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
    expect(Object.keys(mod).sort()).toEqual(['EnhanceError', 'destroyEnhancement', 'enhance', 'goToHash', 'setEnhancementPrefs']);
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
    const found = [...scan(sources().map((f) => ({ name: f, text: readFileSync(f, 'utf8') })))].flatMap(([f, v]) => afterAllowed(rel(f), v).map((u) => `${rel(f)}:${u}`));
    expect(found).toEqual([]);
  });

  it('each allowed site is used exactly as allowed, so an exception cannot widen unseen', () => {
    expect(Object.keys(ALLOWED_SITES).sort()).toEqual(['src/enhance/env.ts', 'src/enhance/journal.ts']);
    for (const [file, allowed] of Object.entries(ALLOWED_SITES)) {
      const found = violations(path.join(ROOT, file), readFileSync(path.join(ROOT, file), 'utf8'));
      for (const [key, count] of Object.entries(allowed)) expect(found.filter((v) => what(v) === key), `${file} ${key}`).toHaveLength(count);
    }
  });

  it('the scan sees the window, its timers, observers, fonts and sizes, the clock and inline style, and lets env through', () => {
    const probe = [
      'const v = root.ownerDocument.defaultView; v.setTimeout(f, 1); v.requestAnimationFrame(f);',
      "e.view.innerWidth; doc.fonts.ready; el.style.width = '1px'; el['style'];",
      'new v.ResizeObserver(f); new v.IntersectionObserver(f); v.matchMedia(q).matches;',
      'Date.now(); new Date(); Date(); new Date(iso); Date.parse(iso);',
      'ctx.env.fonts(1); env.elementFromPoint(1, 2); ctx.env.timeout(f, 1);',
      "doc.elementFromPoint(1, 2); v.scrollY; v.requestIdleCallback(f); v.getComputedStyle(el); v['matchMedia'];",
      // after every line above, so their positions stay: the Env's type, which lets `env` and `ctx.env` through
      "import type { Env } from './env.js'; import type { FeatureContext } from './types.js';",
      'declare const ctx: FeatureContext; declare const env: Env;',
      // the Viewport's own names on env.viewport()'s answer (Task 14), and nothing else on it
      'ctx.env.viewport().scrollY; const { scrollY: y, w } = env.viewport(); const vp = env.viewport(); vp.scrollY; vp.innerHeight;',
    ].join('\n');
    expect(violations('probe.ts', probe)).toEqual([
      '1:30 .defaultView',
      '1:45 .setTimeout',
      '1:65 .requestAnimationFrame',
      '2:8 .innerWidth',
      '2:3 .view',
      '2:24 .fonts',
      '2:40 .style',
      "2:64 ['style']",
      '3:7 .ResizeObserver',
      '3:32 .IntersectionObserver',
      '3:59 .matchMedia',
      '4:1 Date.now',
      '4:13 new Date()',
      '4:25 Date()',
      '6:5 .elementFromPoint',
      '6:31 .scrollY',
      '6:42 .requestIdleCallback',
      '6:68 .getComputedStyle',
      "6:92 ['matchMedia']",
      '9:113 .innerHeight',
    ]);
  });

  it('the scan sees a destructured member, an alias named env, the other style routes, a frame\'s window and the clock passed on', () => {
    const probe = [
      'const { style } = root; const { defaultView: w } = doc; const { setTimeout: later, innerWidth } = w; later(f, 1);',
      'const env = root.ownerDocument; env.fonts.load(x); env.elementFromPoint(1, 2); env.defaultView;',
      "const D = Date; new D(); new (Date)(); Date['now'](); const { now } = Date; Date.parse(s); new Date(s);",
      "root.attributeStyleMap.set('width', '1px'); doc.styleSheets[0]?.insertRule(r); doc.adoptedStyleSheets = [];",
      "doc.scrollingElement.scrollTop = 100; frame.contentWindow; const { fonts } = doc; const { ['sty' + 'le']: s2 } = root;",
      "const { fonts: f2, elementFromPoint: at } = ctx.env; realEnv.fonts(1); ctx.env.defaultView; const d: Date = new Date(1); void o.Date;",
      "import type { Env } from './env.js'; import type { FeatureContext } from './types.js';",
      'declare const ctx: FeatureContext; declare const realEnv: Env; declare const root: HTMLElement; declare const doc: Document;',
    ].join('\n');
    expect(violations('probe.ts', probe)).toEqual([
      '1:9 { style }',
      '1:33 { defaultView }',
      '1:65 { setTimeout }',
      '1:84 { innerWidth }',
      '2:37 .fonts',
      '2:56 .elementFromPoint',
      '2:84 .defaultView',
      '3:11 Date',
      '3:31 Date',
      '3:40 Date',
      '3:71 Date',
      '4:6 .attributeStyleMap',
      '4:65 .insertRule',
      '4:49 .styleSheets',
      '4:84 .adoptedStyleSheets',
      '5:5 .scrollingElement',
      '5:45 .contentWindow',
      '5:68 { fonts }',
      '5:91 { [<member built at run time>] }',
      '6:80 .defaultView',
    ]);
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
      '9:4 .style',
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

describe('enhance walls: the language\'s own globals', () => {
  it('the language\'s own objects are allowed; the DOM\'s clock and timers are not', () => {
    const probe = [
      'export function f(s: string): unknown {',
      '  void [Date.parse(s), new Date(s), Symbol(s), isFinite(1), parseInt(s, 10), new WeakSet(), Boolean(s), NaN, Infinity];',
      '  void decodeURIComponent(s); void new TypeError(s); void new RangeError(s); void isNaN(1); void parseFloat(s);',
      '  return [performance.now(), requestAnimationFrame(() => undefined)];',
      '}',
    ].join('\n');
    expect(globalUses([{ name: path.join(ROOT, 'probe-language.ts'), text: probe }]).map((u) => u.replace(/^[^:]+:/, ''))).toEqual([
      '4:11 global performance',
      '4:30 global requestAnimationFrame',
    ]);
  });
});

describe('enhance walls: the import graph', () => {
  it('every source imports only sibling files of src/enhance, named in lower-case words joined by dashes', () => {
    const outside = sources().flatMap((f) =>
      ts
        .preProcessFile(readFileSync(f, 'utf8'), true, true)
        .importedFiles.map((i) => i.fileName)
        .filter((spec) => !/^\.\/[a-z]+(?:-[a-z]+)*\.js$/.test(spec))
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
    expect(names.length).toBe(5);
    expect(names.filter((n) => !README.includes(`\`${n}\``) && !README.includes(`\`${n}(`))).toEqual([]);
  });
});
