// The static walls of the frame runtime (docserver L3, Task 5; plan Reference §5.3, §5.4 and §6, Global Constraints;
// row L3.M19), in the style of test/enhance-walls.test.ts: read with TypeScript's syntax tree and its binder, so comments
// and strings do not count, and a name is judged by what it resolves to, not by its text.
//
// 1. src/frame-runtime names none of FORBIDDEN (HTML-string sinks, the network, storage, cookies, an id lookup, eval) as
//    an identifier, a member or a string key; it calls no selector with a `#` or an id match, or with a selector built
//    at run time; and it reads no member by a key built from strings (`el['inner' + 'HTML']`).
// 2. Code from strings: no call of `eval`, and the identifier `Function` only as `Function.prototype.toString`, at the
//    sites ALLOWED_SITES lists (the bootstrap's captured intrinsic for self-check (d)).
// 3. `open` only as the outbox's own method: defined once in outbox.ts, called once in bootstrap.ts; never a global
//    `open`, `window.open`, `self.open` or `document.open` (every other `.open` is over the count).
// 4. `location`, `history` and `top` never as global references (an identifier the binder resolves to the DOM library,
//    or to nothing) and never as members of the global or of a document (a receiver whose type is Window, Document or
//    `typeof globalThis`).
// 5. `DOMParser` only in content.ts; `postMessage`, and a `'message'` argument (addEventListener('message', ...)), only
//    at the bootstrap's sites.
// 6. The built assets/frame/guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle;
//    assets/frame/enhance.js gets a binder scan for global (not member) references to the forbidden names only (L2's own
//    walls cover its source); and none of the three carries a test marker (`__TEST`, `process.env`, `import.meta.vitest`,
//    or a branch on a name that says test, a member read off the global included; only RegExp's `.test(...)` is exempt).
// Every allowed site has a planted control: one more use at that site goes red, and so does each forbidden name.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildFrame } from '../scripts/build-frame.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const RUNTIME_DIR = path.join(ROOT, 'src', 'frame-runtime');

/** The frame runtime's sources, by name relative to src/frame-runtime. */
function sources(): { name: string; text: string }[] {
  return readdirSync(RUNTIME_DIR)
    .filter((f) => f.endsWith('.ts'))
    .sort()
    .map((f) => ({ name: f, text: readFileSync(path.join(RUNTIME_DIR, f), 'utf8') }));
}

/** Names the frame runtime never uses, as an identifier, a member or a string key. */
const FORBIDDEN: readonly string[] = [
  'innerHTML', 'outerHTML', 'insertAdjacentHTML',
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon',
  'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'cookie',
  'getElementById', 'eval',
];

/** Names never a global reference, and never a member of the global or of a document. */
const PAGE_NAMES: readonly string[] = ['location', 'history', 'top'];

/** Calls whose first argument is a selector. */
const SELECTOR_CALLS: ReadonlySet<string> = new Set(['querySelector', 'querySelectorAll', 'closest', 'matches']);
const ID_SELECTOR = /#|\[\s*id\s*[~|^$*]?=/i;

/**
 * The sites where a guarded name is allowed, by file, with exact counts. A site key is one of:
 * `Function.prototype.toString`, `open()` (the outbox's method, defined), `.open` (a member use), `DOMParser`,
 * `postMessage`, `'message'` (a call argument), `.onmessage`.
 */
const SOURCE_SITES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  'bootstrap.ts': { 'Function.prototype.toString': 1, '.open': 1, postMessage: 1, "'message'": 2, '.onmessage': 1 },
  'content.ts': { DOMParser: 1 },
  'outbox.ts': { 'open()': 1 },
};

/** The same sites in the built scripts: the bootstrap bundles content.ts and outbox.ts. */
const BUILT_SITES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  'guard.js': {},
  'bootstrap.js': { 'Function.prototype.toString': 1, '.open': 1, postMessage: 1, "'message'": 2, '.onmessage': 1, DOMParser: 1, 'open()': 1 },
};

const PROGRAM_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  types: [],
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  allowJs: true,
  checkJs: false,
};

/** The libraries and on-disk files, parsed once for every program this file makes. */
const diskFiles = new Map<string, ts.SourceFile>();

/** A program over in-memory texts at the given absolute paths; everything else read from disk. */
function programOf(files: ReadonlyMap<string, string>): ts.Program {
  const host = ts.createCompilerHost(PROGRAM_OPTIONS, true);
  const getSourceFile = host.getSourceFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  host.getSourceFile = (name, lang, ...rest) => {
    const text = files.get(path.resolve(name));
    if (text !== undefined) return ts.createSourceFile(name, text, lang, true);
    const key = path.resolve(name);
    let sf = diskFiles.get(key);
    if (sf === undefined) {
      sf = getSourceFile(name, lang, ...rest);
      if (sf !== undefined) diskFiles.set(key, sf);
    }
    return sf;
  };
  host.fileExists = (name) => files.has(path.resolve(name)) || fileExists(name);
  host.readFile = (name) => files.get(path.resolve(name)) ?? readFile(name);
  return ts.createProgram([...files.keys()], PROGRAM_OPTIONS, host);
}

/** True for a node inside a type: it names no value at run time. */
function inType(node: ts.Node): boolean {
  for (let n: ts.Node | undefined = node.parent; n !== undefined; n = n.parent) {
    if (ts.isTypeNode(n) || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) return true;
    if (ts.isStatement(n) && !ts.isInterfaceDeclaration(n) && !ts.isTypeAliasDeclaration(n)) return false;
  }
  return false;
}

/** True for a key made by joining strings: `'outer' + 'HTML'`, `prefix + 'HTML'`, a template with substitutions. */
function builtString(key: ts.Expression): boolean {
  if (ts.isTemplateExpression(key)) return true;
  if (ts.isParenthesizedExpression(key)) return builtString(key.expression);
  if (!ts.isBinaryExpression(key) || key.operatorToken.kind !== ts.SyntaxKind.PlusToken) return false;
  const stringy = (e: ts.Expression): boolean => ts.isStringLiteralLike(e) || builtString(e);
  return stringy(key.left) || stringy(key.right);
}

/** True when the identifier, in a value position, resolves to the DOM or ES library or to no binding at all. */
function isGlobalRef(id: ts.Identifier, checker: ts.TypeChecker): boolean {
  const p = id.parent;
  if ((ts.isPropertyAccessExpression(p) && p.name === id) || (ts.isPropertyAssignment(p) && p.name === id) || ts.isMethodDeclaration(p) || ts.isPropertySignature(p) || ts.isMethodSignature(p)) return false;
  if (ts.isBindingElement(p) && p.propertyName === id) return false;
  if (inType(id)) return false;
  const sym = checker.getSymbolAtLocation(id);
  if (sym === undefined) return !(ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isFunctionDeclaration(p) || ts.isBindingElement(p));
  const decls = sym.declarations ?? [];
  return decls.length > 0 && decls.every((d) => d.getSourceFile().isDeclarationFile);
}

/** True when `receiver` is the global or a document: its type is Window, Document or `typeof globalThis`. */
function isPageReceiver(receiver: ts.Expression, checker: ts.TypeChecker): boolean {
  const type = checker.getTypeAtLocation(receiver);
  const name = (type.aliasSymbol ?? type.getSymbol())?.getName();
  if (name === 'Window' || name === 'Document' || name === 'globalThis') return true;
  return ts.isIdentifier(receiver) && ['window', 'self', 'globalThis', 'document', 'parent', 'frames'].includes(receiver.text) && isGlobalRef(receiver, checker);
}

interface Scan {
  readonly violations: string[];
  readonly sites: Record<string, number>;
}

/** Every violation in one source file, and the count of each guarded site. */
function scanFile(sf: ts.SourceFile, checker: ts.TypeChecker): Scan {
  const banned = new Set(FORBIDDEN);
  const out: string[] = [];
  const sites: Record<string, number> = {};
  const site = (k: string): void => {
    sites[k] = (sites[k] ?? 0) + 1;
  };
  const at = (node: ts.Node, what: string): void => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    out.push(`${String(line + 1)}:${String(character + 1)} ${what}`);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && !inType(node)) {
      const t = node.text;
      if (banned.has(t)) at(node, t);
      if (t === 'Function') {
        const p = node.parent;
        const pp = p.parent;
        if (ts.isPropertyAccessExpression(p) && p.expression === node && p.name.text === 'prototype' && ts.isPropertyAccessExpression(pp) && pp.name.text === 'toString') site('Function.prototype.toString');
        else at(node, 'Function');
      }
      // A guarded built-in counts where it is read from the platform (a member, or a global reference), not where a
      // local binding that captured it is used again.
      const fromPlatform = (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) || isGlobalRef(node, checker);
      if (t === 'DOMParser' && fromPlatform) site('DOMParser');
      if (t === 'postMessage' && fromPlatform) site('postMessage');
      if ((PAGE_NAMES.includes(t) || t === 'open') && isGlobalRef(node, checker)) at(node, `global ${t}`);
    }
    if (ts.isPropertyAccessExpression(node)) {
      const name = node.name.text;
      if (name === 'open') site('.open');
      if (name === 'onmessage') site('.onmessage');
      if (PAGE_NAMES.includes(name) && isPageReceiver(node.expression, checker)) at(node.name, `.${name} of the page`);
    }
    if (ts.isElementAccessExpression(node)) {
      const key = node.argumentExpression;
      if (ts.isStringLiteralLike(key)) {
        if (banned.has(key.text)) at(key, `['${key.text}']`);
        if (key.text === 'open') site('.open');
        if (key.text === 'postMessage') site('postMessage');
        if (PAGE_NAMES.includes(key.text) && isPageReceiver(node.expression, checker)) at(key, `['${key.text}'] of the page`);
      } else if (builtString(key)) at(key, '[<member built at run time>]');
    }
    if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      const key = node.propertyName ?? node.name;
      const text = ts.isIdentifier(key) || ts.isStringLiteralLike(key) ? key.text : null;
      if (text !== null && (banned.has(text) || PAGE_NAMES.includes(text) || text === 'open')) at(key, `{ ${text} }`);
      else if (ts.isComputedPropertyName(key) && builtString(key.expression)) at(key, '{ [<member built at run time>] }');
    }
    if ((ts.isMethodDeclaration(node) || ts.isPropertyAssignment(node)) && !inType(node)) {
      const n = node.name;
      if ((ts.isIdentifier(n) || ts.isStringLiteralLike(n)) && n.text === 'open') site('open()');
    }
    if (ts.isCallExpression(node)) {
      const callee = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : ts.isIdentifier(node.expression) ? node.expression.text : '';
      const [first] = node.arguments;
      if (SELECTOR_CALLS.has(callee) && first !== undefined) {
        if (!ts.isStringLiteralLike(first)) at(first, `${callee}(<built at run time>)`);
        else if (ID_SELECTOR.test(first.text)) at(first, `${callee}('${first.text}')`);
      }
      for (const a of node.arguments) if (ts.isStringLiteralLike(a) && a.text === 'message') site("'message'");
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { violations: out, sites };
}

/** The guarded sites over their allowance, as violations: a site with no allowance at all, or one used more often. */
function overSites(sites: Record<string, number>, allowed: Readonly<Record<string, number>>): string[] {
  const out: string[] = [];
  for (const [k, n] of Object.entries(sites)) if (n !== (allowed[k] ?? 0)) out.push(`${k} x${String(n)}, allowed x${String(allowed[k] ?? 0)}`);
  for (const [k, n] of Object.entries(allowed)) if (sites[k] === undefined) out.push(`${k} x0, allowed x${String(n)}`);
  return out;
}

/** Scan texts at paths under `dir`: every violation of each, its sites judged against `allowed`. */
function scanTexts(dir: string, files: readonly { name: string; text: string }[], allowed: Readonly<Record<string, Readonly<Record<string, number>>>>): Map<string, string[]> {
  const program = programOf(new Map(files.map((f) => [path.resolve(dir, f.name), f.text])));
  const checker = program.getTypeChecker();
  const out = new Map<string, string[]>();
  for (const f of files) {
    const sf = program.getSourceFile(path.resolve(dir, f.name));
    if (sf === undefined) throw new Error(`walls: ${f.name} is not in the program`);
    const s = scanFile(sf, checker);
    out.set(f.name, [...s.violations, ...overSites(s.sites, allowed[f.name] ?? {})]);
  }
  return out;
}

/** The sources' violations, with `name`'s text replaced by `text` when given (a planted control). */
function scanSources(name?: string, text?: string): Map<string, string[]> {
  const files = sources().map((f) => (f.name === name && text !== undefined ? { name, text } : f));
  return scanTexts(RUNTIME_DIR, files, SOURCE_SITES);
}

/**
 * Whether a name says test: one of its words (split at `_`, `$`, digits and lower-to-upper case changes) begins with
 * "test", so `isTesting`, `testHook`, `docserverTestHook` and `__TEST` do and `latest` (a member of the reader's own
 * state) does not.
 */
function saysTest(name: string): boolean {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[\s_$0-9]+/)
    .some((w) => /^test/i.test(w));
}

/** A test marker in a built script, by text: what a test-only branch or hook would leave. */
function markers(text: string): string[] {
  const out: string[] = [];
  for (const [what, re] of [
    ['__TEST', /__TEST/i],
    ['process.env', /process\.env/],
    ['import.meta.vitest', /import\.meta\.vitest/],
  ] as const) {
    if (re.test(text)) out.push(what);
  }
  const sf = ts.createSourceFile('built.js', text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const testy = (e: ts.Node): boolean => {
    let hit = false;
    const walk = (n: ts.Node): void => {
      // Any identifier or member whose name says test, but RegExp's own method: a member named exactly `test` that is
      // called (`re.test(s)`; the built enhance.js holds many).
      const regexpTest = n.parent !== undefined && ts.isPropertyAccessExpression(n.parent) && n.parent.name === n && n.parent.name.text === 'test' && ts.isCallExpression(n.parent.parent) && n.parent.parent.expression === n.parent;
      if (ts.isIdentifier(n) && saysTest(n.text) && !regexpTest) hit = true;
      if (ts.isStringLiteralLike(n) && saysTest(n.text) && ts.isElementAccessExpression(n.parent)) hit = true;
      ts.forEachChild(n, walk);
    };
    walk(e);
    return hit;
  };
  const visit = (n: ts.Node): void => {
    if ((ts.isIfStatement(n) || ts.isConditionalExpression(n) || ts.isWhileStatement(n)) && testy(ts.isIfStatement(n) || ts.isWhileStatement(n) ? n.expression : n.condition)) out.push('a test-named branch');
    if (ts.isBinaryExpression(n) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(n.operatorToken.kind) && testy(n.left)) out.push('a test-named branch');
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** Global (not member) references to the forbidden and page names in a built script, by the binder. */
function globalForbidden(name: string, text: string): string[] {
  const file = path.resolve(ROOT, 'built', name);
  const program = programOf(new Map([[file, text]]));
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(file);
  if (sf === undefined) throw new Error('walls: no built file');
  const names = new Set([...FORBIDDEN, ...PAGE_NAMES, 'open', 'Function']);
  const out: string[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isIdentifier(n) && names.has(n.text) && isGlobalRef(n, checker)) out.push(n.text);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

let built: Record<'guard' | 'bootstrap' | 'enhance', string>;

beforeAll(async () => {
  const b = await buildFrame();
  built = { guard: b.files.guard.text, bootstrap: b.files.bootstrap.text, enhance: b.files.enhance.text };
}, 120_000);

const clean = (m: Map<string, string[]>): Record<string, string[]> => Object.fromEntries([...m].filter(([, v]) => v.length > 0));

describe('L3.M19: the frame runtime sources', () => {
  it('no source names a forbidden name, a page name of the global, code from strings, a selector by id, or a member key built from strings; every guarded site is at its allowed count', () => {
    expect(clean(scanSources())).toEqual({});
  });

  it('the allowed sites are measured, not assumed: the counts above are what the sources hold', () => {
    const files = sources();
    const program = programOf(new Map(files.map((f) => [path.resolve(RUNTIME_DIR, f.name), f.text])));
    const checker = program.getTypeChecker();
    const sites: Record<string, Record<string, number>> = {};
    for (const f of files) {
      const sf = program.getSourceFile(path.resolve(RUNTIME_DIR, f.name));
      if (sf === undefined) throw new Error(f.name);
      const s = scanFile(sf, checker).sites;
      if (Object.keys(s).length > 0) sites[f.name] = s;
    }
    expect(sites).toEqual(SOURCE_SITES);
  });

  /** A planted control: `snippet` appended to `file`'s text must add a violation the scan names. */
  const plant = (file: string, snippet: string): string[] => {
    const text = readFileSync(path.join(RUNTIME_DIR, file), 'utf8');
    return scanSources(file, `${text}\n${snippet}\n`).get(file) ?? [];
  };

  for (const name of FORBIDDEN) {
    it(`a planted ${name} is seen, as a call, a member and a string key`, () => {
      expect(plant('adapters.ts', `export const planted1 = (globalThis as any).${name};`).join('\n')).toContain(name);
      expect(plant('adapters.ts', `export const planted2 = (globalThis as any)['${name}'];`).join('\n')).toContain(`['${name}']`);
    });
  }

  for (const [file, snippet, what] of [
    ['bootstrap.ts', 'export const p1 = Function.prototype.toString;', 'Function.prototype.toString x2, allowed x1'],
    ['bootstrap.ts', 'export const p2 = { open: 1 }.open;', '.open x2, allowed x1'],
    ['bootstrap.ts', 'export const p3 = MessagePort.prototype.postMessage;', 'postMessage x2, allowed x1'],
    ['bootstrap.ts', "addEventListener('message', () => undefined);", "'message' x3, allowed x2"],
    ['bootstrap.ts', 'export const p4 = (p: MessagePort): void => { p.onmessage = null; };', '.onmessage x2, allowed x1'],
    ['content.ts', 'export const p5 = DOMParser;', 'DOMParser x2, allowed x1'],
    ['outbox.ts', 'export const p6 = { open(): void {} };', 'open() x2, allowed x1'],
    ['guard.ts', 'export const p7 = Function.prototype.toString;', 'Function.prototype.toString x1, allowed x0'],
    ['adapters.ts', 'export const p8 = DOMParser;', 'DOMParser x1, allowed x0'],
    ['adapters.ts', 'export const p9 = (o: { postMessage(m: unknown): void }): void => o.postMessage(1);', 'postMessage x1, allowed x0'],
    ['adapters.ts', 'export const p10 = (o: { open(): void }): void => o.open();', '.open x1, allowed x0'],
  ] as const) {
    it(`a planted extra use in ${file} goes red: ${what}`, () => {
      expect(plant(file, snippet)).toContain(what);
    });
  }

  for (const [snippet, what] of [
    ["export const q1 = new Function('return 1');", 'Function'],
    ["export const q2 = Function('return 1');", 'Function'],
    ["export const q3 = eval('1');", 'eval'],
    ['export const q4 = open;', 'global open'],
    ["export const q5 = window.open('x');", '.open x1'],
    ["export const q6 = document.open();", '.open x1'],
    ['export const q7 = location.href;', 'global location'],
    ['export const q8 = window.location.href;', '.location of the page'],
    ['export const q9 = document.location;', '.location of the page'],
    ["export const q10 = window['history'];", "['history'] of the page"],
    ['export const q11 = top;', 'global top'],
    ['export const q12 = self.top;', '.top of the page'],
    ["export const q13 = document.querySelector('#seed');", "querySelector('#seed')"],
    ["export const q14 = (k: string): unknown => document.querySelector(k);", 'querySelector(<built at run time>)'],
    ["export const q15 = (el: Element): unknown => (el as unknown as Record<string, unknown>)['inner' + 'HTML'];", '[<member built at run time>]'],
    ['export const q16 = (x: { location: string }): string => x.location;', ''],
  ] as const) {
    it(`a planted ${snippet.slice(snippet.indexOf('=') + 2)} in adapters.ts is ${what === '' ? 'not' : ''} a violation`, () => {
      const got = plant('adapters.ts', snippet);
      if (what === '') expect(got).toEqual([]);
      else expect(got.join('\n')).toContain(what);
    });
  }

  it("a local binding named location, top or open is not a global reference (the binder, not the text)", () => {
    expect(plant('adapters.ts', 'export const r1 = (top: number, open: boolean): unknown => [top, open];')).toEqual([]);
  });
});

describe('L3.M19: the built guard.js, bootstrap.js and enhance.js', () => {
  it('guard.js and bootstrap.js pass the same scan, with the sites of the sources they bundle', () => {
    const got = scanTexts(path.join(ROOT, 'built'), [{ name: 'guard.js', text: built.guard }, { name: 'bootstrap.js', text: built.bootstrap }], BUILT_SITES);
    expect(clean(got)).toEqual({});
  });

  it('a planted extra site in the built bootstrap goes red', () => {
    const got = scanTexts(path.join(ROOT, 'built'), [{ name: 'bootstrap.js', text: `${built.bootstrap}\nvar planted = Function.prototype.toString, p2 = new DOMParser();\n` }], BUILT_SITES);
    expect(got.get('bootstrap.js')).toEqual(expect.arrayContaining(['Function.prototype.toString x2, allowed x1', 'DOMParser x2, allowed x1']));
  });

  it('enhance.js references none of the forbidden or page names as a global', () => {
    expect(globalForbidden('enhance.js', built.enhance)).toEqual([]);
    expect(globalForbidden('enhance.js', `${built.enhance}\nvar planted=location.href+fetch;\n`)).toEqual(['location', 'fetch']);
  });

  it('none of the three carries a test marker', () => {
    for (const name of ['guard', 'bootstrap', 'enhance'] as const) expect(markers(built[name]), name).toEqual([]);
  });

  it('a planted test-only branch is seen, in each of its shapes', () => {
    expect(markers(`${built.guard}\nif (globalThis.__TEST) {}\n`)).toContain('__TEST');
    expect(markers(`${built.guard}\nif (process.env.X) {}\n`)).toContain('process.env');
    expect(markers(`${built.guard}\nif (import.meta.vitest) {}\n`)).toContain('import.meta.vitest');
    // A flag read off the global is a test-named branch too: only RegExp's own `.test(...)` call is exempt.
    expect(markers(`${built.guard}\nif (globalThis.isTesting) {}\n`)).toContain('a test-named branch');
    expect(markers(`${built.guard}\nwindow.docserverTestHook && window.docserverTestHook();\n`)).toContain('a test-named branch');
    expect(markers(`${built.guard}\nif (self.testHook) {}\n`)).toContain('a test-named branch');
    expect(markers(`${built.guard}\nvar o = {}; o.test ? 1 : 2;\n`)).toContain('a test-named branch');
    expect(markers(`${built.guard}\nif (/x/.test(String(1))) {}\n`)).toEqual([]);
    expect(markers(`${built.guard}\nvar s = { latest: 1 }; if (s.latest) {}\n`)).toEqual([]);
    expect(['isTesting', 'testHook', 'docserverTestHook', '__TEST', 'inTest', 'TEST_MODE'].filter((n) => !saysTest(n))).toEqual([]);
    expect(['latest', 'contest', 'LATEST', 'attestation'].filter(saysTest)).toEqual([]);
    expect(markers(`${built.guard}\nvar inTest = false; if (inTest) {}\n`)).toContain('a test-named branch');
    expect(markers(`${built.guard}\nvar testHook = null; testHook && testHook();\n`)).toContain('a test-named branch');
  });
});
