// The static walls of `./host` (docserver L3, Task 10; plan Global Constraints, Reference §11.4 and FD22; rows L3.H1 and
// L3.H2's source halves), in the style of test/frame-runtime-walls.test.ts: read with TypeScript's syntax tree, so
// comments and strings do not count, and type positions are skipped.
//
// 1. Import-inert: importing the entry in Node (no document) creates no global, starts no timer, and exports exactly
//    mountDocFrame. No module-level state but WeakMaps: at the top level of every src/host file, only imports, exports,
//    types, function declarations and `const` bindings whose initialisers call nothing but Object.freeze (or make a
//    WeakMap); never a `let` or a `var`.
// 2. CSP-safe and inert toward the page: src/host names none of FORBIDDEN as an identifier, a member or a string key
//    (HTML-string sinks, code from strings, inline style, the network, storage, cookies, the clipboard, the page's
//    location, history and top, the global by name); calls no `open`; sets an iframe attribute only from SET_ATTRIBUTES,
//    each by a literal name (never src, name, allow, allowfullscreen, loading, style or a handler).
// 3. No window `message` listener: no addEventListener with 'message' (or with a type built at run time), whether the
//    method is named as a member or by a string key; `onmessage` and `onmessageerror` only on the channel's own port;
//    `postMessage` only at mount.ts's two sites (the hello on the frame's window, and the port), and `contentWindow` and
//    `focus()` once each. Other spellings are seen too: any string whose text is one of GUARDED_STRINGS (an element
//    access, a Reflect.set or Object.defineProperty key, a computed key, a variable later used as a listener type), and
//    any GUARDED_NAMES name outside a member access (an object-literal key, a destructured binding).
// 4. src/host compiles with the DOM library and no ambient types (tsconfig.host.json gives its tests Node's types; the
//    library must not reach them).
// Every rule has a planted control: a probe text that breaks it is seen.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const HOST_DIR = path.join(ROOT, 'src', 'host');

/** src/host's sources, by name relative to src/host. */
function sources(): { name: string; text: string }[] {
  return readdirSync(HOST_DIR)
    .filter((f) => f.endsWith('.ts'))
    .sort()
    .map((f) => ({ name: f, text: readFileSync(path.join(HOST_DIR, f), 'utf8') }));
}

/** Names src/host never uses, as an identifier, a member or a string key. */
const FORBIDDEN: readonly string[] = [
  'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'srcdoc', 'eval', 'Function', 'cssText', 'style',
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon',
  'localStorage', 'sessionStorage', 'indexedDB', 'cookie', 'clipboard', 'execCommand',
  'location', 'history', 'top', 'window', 'self', 'globalThis', 'src', 'allowFullscreen', 'loading',
];

/** Names that reach a window's message handlers or the frame's window: only as a member access, at the allowed sites. */
const GUARDED_NAMES: readonly string[] = ['onmessage', 'onmessageerror', 'postMessage', 'contentWindow'];

/** Strings src/host never holds, whatever node holds them, but a listener type judged by its own rule. */
const GUARDED_STRINGS: readonly string[] = [...GUARDED_NAMES, 'message', 'messageerror', 'addEventListener'];

/** The name a call's callee gives its method: a member, an identifier, or a string key; '' when built at run time. */
const calleeName = (callee: ts.Expression): string =>
  ts.isPropertyAccessExpression(callee)
    ? callee.name.text
    : ts.isIdentifier(callee)
      ? callee.text
      : ts.isElementAccessExpression(callee) && ts.isStringLiteralLike(callee.argumentExpression)
        ? callee.argumentExpression.text
        : '';

/** True for the first argument of an addEventListener call, which rule 3's own check judges. */
const isListenerType = (node: ts.Node): boolean =>
  ts.isCallExpression(node.parent) && node.parent.arguments[0] === node && calleeName(node.parent.expression) === 'addEventListener';

/** The only iframe attributes src/host sets, each by a literal name. */
const SET_ATTRIBUTES: readonly string[] = ['sandbox', 'referrerpolicy', 'csp', 'title', 'srcdoc'];

/** The sites where a guarded use is allowed, by file, with exact counts. */
const ALLOWED_SITES: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  'mount.ts': { postMessage: 2, contentWindow: 1, 'focus()': 1, 'port.onmessage': 2, 'port.onmessageerror': 2 },
};

const parse = (name: string, text: string): ts.SourceFile => ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

/** Every use the walls judge in one file, as "line:col what": violations, and the guarded sites (counted later). */
function scan(name: string, text: string): string[] {
  const sf = parse(name, text);
  const out: string[] = [];
  const at = (node: ts.Node, what: string): void => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    out.push(`${String(line + 1)}:${String(character + 1)} ${what}`);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isTypeNode(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isImportDeclaration(node)) return;
    if (ts.isExportDeclaration(node)) return;
    if (ts.isIdentifier(node) && FORBIDDEN.includes(node.text)) at(node, `forbidden ${node.text}`);
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && ts.isElementAccessExpression(node.parent) && FORBIDDEN.includes(node.text)) {
      at(node, `forbidden ['${node.text}']`);
    }
    if (ts.isIdentifier(node) && GUARDED_NAMES.includes(node.text) && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)) {
      at(node, `name ${node.text}`);
    }
    if (ts.isStringLiteralLike(node) && GUARDED_STRINGS.includes(node.text) && !isListenerType(node)) at(node, `string '${node.text}'`);
    if (ts.isPropertyAccessExpression(node)) {
      const member = node.name.text;
      if (member === 'postMessage') at(node.name, 'postMessage');
      if (member === 'contentWindow') at(node.name, 'contentWindow');
      if (member === 'onmessage' || member === 'onmessageerror') {
        const receiver = node.expression.getText(sf);
        at(node.name, receiver === 'port' ? `port.${member}` : `${member} on ${receiver}`);
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const fn = calleeName(callee);
      const [first] = node.arguments;
      if (fn === 'open') at(node, 'open()');
      if (fn === 'focus') at(node, 'focus()');
      if (fn === 'addEventListener' && first !== undefined) {
        if (!ts.isStringLiteralLike(first)) at(first, 'addEventListener(<type built at run time>)');
        else if (first.text === 'message' || first.text === 'messageerror') at(first, `addEventListener('${first.text}')`);
      }
      if (fn === 'setAttribute' || fn === 'setAttributeNS' || fn === 'toggleAttribute') {
        const nameArg = node.arguments[fn === 'setAttributeNS' ? 1 : 0];
        if (fn !== 'setAttribute' || nameArg === undefined || !ts.isStringLiteralLike(nameArg)) at(node, `${fn}(<not a literal name>)`);
        else if (!SET_ATTRIBUTES.includes(nameArg.text)) at(nameArg, `setAttribute('${nameArg.text}')`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** What a file may use all the same: drop up to the allowed count of each allowed site from its uses. */
function afterAllowed(file: string, found: readonly string[]): string[] {
  const left: Record<string, number> = { ...(ALLOWED_SITES[file] ?? {}) };
  return found.filter((v) => {
    const key = v.replace(/^\d+:\d+ /, '');
    if ((left[key] ?? 0) === 0) return true;
    left[key] = (left[key] ?? 0) - 1;
    return false;
  });
}

/** The guarded sites a file holds, counted. */
function siteCounts(file: string, found: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const allowed = Object.keys(ALLOWED_SITES[file] ?? {});
  for (const v of found) {
    const key = v.replace(/^\d+:\d+ /, '');
    if (allowed.includes(key)) counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** Module-level state or code: anything at a file's top level but imports, exports, types, functions and frozen constants. */
function topLevel(name: string, text: string): string[] {
  const sf = parse(name, text);
  const out: string[] = [];
  const at = (node: ts.Node, what: string): void => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    out.push(`${String(line + 1)}:${String(character + 1)} ${what}`);
  };
  const isFreeze = (c: ts.CallExpression): boolean => c.expression.getText(sf) === 'Object.freeze';
  const scanInit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node)) return; // runs only when called
    if (ts.isCallExpression(node) && !isFreeze(node)) at(node, `call ${node.expression.getText(sf)}`);
    if (ts.isNewExpression(node) && node.expression.getText(sf) !== 'WeakMap') at(node, `new ${node.expression.getText(sf)}`);
    if (ts.isTaggedTemplateExpression(node)) at(node, 'tagged template');
    ts.forEachChild(node, scanInit);
  };
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) || ts.isExportDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isFunctionDeclaration(st)) continue;
    if (ts.isVariableStatement(st)) {
      if ((st.declarationList.flags & ts.NodeFlags.Const) === 0) at(st, 'a module-level let or var');
      for (const d of st.declarationList.declarations) if (d.initializer !== undefined) scanInit(d.initializer);
      continue;
    }
    at(st, ts.SyntaxKind[st.kind]);
  }
  return out;
}

describe('host walls: import inertness and module state', () => {
  it('importing the entry in Node (no document) creates no global, starts no timer, and exports exactly mountDocFrame', async () => {
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined');
    const names = new Set(Reflect.ownKeys(globalThis));
    const timers = ['setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask'] as const;
    const spies = timers.map((t) => vi.spyOn(globalThis, t));
    vi.resetModules();
    const mod = (await import('../src/host/index.js')) as Record<string, unknown>;
    const calls = spies.map((s) => s.mock.calls.length);
    for (const s of spies) s.mockRestore();
    expect(calls).toEqual([0, 0, 0, 0]);
    expect(Reflect.ownKeys(globalThis).filter((k) => !names.has(k))).toEqual([]);
    expect(Object.keys(mod).sort()).toEqual(['mountDocFrame']);
  });

  it('no src/host file keeps module-level state or runs code at its top level (frozen constants and WeakMaps only)', () => {
    const found = sources().flatMap((f) => topLevel(f.name, f.text).map((u) => `${f.name}:${u}`));
    expect(found).toEqual([]);
  });

  it('the top-level scan sees a let, a var, a call, a new and a statement, and allows Object.freeze, WeakMap and function bodies', () => {
    const probe = [
      "import { a } from './a.js';",
      'const ok = Object.freeze({ b: [1, 2], c: () => make() });',
      'const weak = new WeakMap<object, number>();',
      'function f() { return g(); }',
      'let count = 0;',
      'var old = 1;',
      'const bad = new Map();',
      'const called = start();',
      'register();',
    ].join('\n');
    expect(topLevel('probe.ts', probe)).toEqual(['5:1 a module-level let or var', '6:1 a module-level let or var', '7:13 new Map', '8:16 call start', '9:1 ExpressionStatement']);
  });
});

describe('host walls: CSP, the page and the window message listener', () => {
  it('no src/host file names a forbidden name, opens a window, sets an attribute outside the list, or listens for messages; every guarded site is at its allowed count', () => {
    const found = sources().flatMap((f) => afterAllowed(f.name, scan(f.name, f.text)).map((u) => `${f.name}:${u}`));
    expect(found).toEqual([]);
  });

  it('the allowed sites are measured, not assumed: mount.ts holds exactly them', () => {
    const mount = sources().find((f) => f.name === 'mount.ts');
    expect(mount).toBeDefined();
    expect(siteCounts('mount.ts', scan('mount.ts', mount?.text ?? ''))).toEqual(ALLOWED_SITES['mount.ts']);
    for (const f of sources().filter((s) => s.name !== 'mount.ts')) expect(siteCounts('mount.ts', scan(f.name, f.text)), f.name).toEqual({});
  });

  for (const name of FORBIDDEN) {
    it(`a planted ${name} is seen, as an identifier, a member and a string key`, () => {
      expect(scan('p.ts', `export function f(x: any) { return ${name}; }`)).toEqual([`1:36 forbidden ${name}`]);
      expect(scan('p.ts', `export function f(x: any) { return x.${name}; }`)).toEqual([`1:38 forbidden ${name}`]);
      expect(scan('p.ts', `export function f(x: any) { return x['${name}']; }`)).toEqual([`1:38 forbidden ['${name}']`]);
    });
  }

  const PLANTED: readonly (readonly [string, string])[] = [
    ["w.addEventListener('message', h)", "addEventListener('message')"],
    ["w.addEventListener('messageerror', h)", "addEventListener('messageerror')"],
    ['w.addEventListener(kind, h)', 'addEventListener(<type built at run time>)'],
    ['w.onmessage = h', 'onmessage on w'],
    ['w.onmessageerror = h', 'onmessageerror on w'],
    ["f.setAttribute('src', u)", "setAttribute('src')"],
    ["f.setAttribute('name', u)", "setAttribute('name')"],
    ["f.setAttribute('allow', u)", "setAttribute('allow')"],
    ["f.setAttribute('allowfullscreen', '')", "setAttribute('allowfullscreen')"],
    ["f.setAttribute('loading', 'lazy')", "setAttribute('loading')"],
    ["f.setAttribute('style', s)", "setAttribute('style')"],
    ["f.setAttribute('onload', s)", "setAttribute('onload')"],
    ['f.setAttribute(n, s)', 'setAttribute(<not a literal name>)'],
    ["f.toggleAttribute('allowfullscreen')", 'toggleAttribute(<not a literal name>)'],
    ["w.open('https://example.test/')", 'open()'],
    ['open()', 'open()'],
  ];
  for (const [snippet, what] of PLANTED) {
    it(`a planted ${snippet} is seen`, () => {
      const found = scan('p.ts', `export function f(w: any, f: any, h: any, u: any, s: any, n: any, kind: any) { ${snippet}; }`).map((v) => v.replace(/^\d+:\d+ /, ''));
      expect(found).toEqual([what]);
    });
  }

  /** Rule 3 by other spellings: a guarded name as a string anywhere, or as a name outside a member access. */
  const SPELLED: readonly (readonly [string, readonly string[]])[] = [
    ["w['onmessage'] = h", ["string 'onmessage'"]],
    ["w['onmessageerror'] = h", ["string 'onmessageerror'"]],
    ["Reflect.set(w, 'onmessage', h)", ["string 'onmessage'"]],
    ["Object.defineProperty(w, 'onmessageerror', { value: h })", ["string 'onmessageerror'"]],
    ['Object.assign(w, { onmessage: h })', ['name onmessage']],
    ['Object.assign(w, { onmessageerror })', ['name onmessageerror']],
    ["Object.assign(w, { ['onmessage']: h })", ["string 'onmessage'"]],
    ["w['addEventListener']('message', h)", ["addEventListener('message')", "string 'addEventListener'"]],
    ["w['addEventListener'](kind, h)", ['addEventListener(<type built at run time>)', "string 'addEventListener'"]],
    ["const k = 'message'; w.addEventListener(k, h)", ["string 'message'", 'addEventListener(<type built at run time>)']],
    ["const k = 'messageerror'", ["string 'messageerror'"]],
    ["w['postMessage'](1)", ["string 'postMessage'"]],
    ["void f['contentWindow']", ["string 'contentWindow'"]],
    ['const { contentWindow } = f', ['name contentWindow']],
    ['const { postMessage } = w', ['name postMessage']],
  ];
  for (const [snippet, what] of SPELLED) {
    it(`a planted ${snippet} is seen`, () => {
      const found = scan('p.ts', `export function f(w: any, f: any, h: any, kind: any) { ${snippet}; }`).map((v) => v.replace(/^\d+:\d+ /, ''));
      expect(found).toEqual(what);
    });
  }

  it('a planted extra site in mount.ts goes red: a third postMessage, a second contentWindow, a second focus(), a third port.onmessage', () => {
    const mount = sources().find((f) => f.name === 'mount.ts')?.text ?? '';
    for (const extra of ['x.postMessage(1);', 'void f.contentWindow;', 'f.focus();', 'port.onmessage = null;']) {
      const text = `${mount}\nexport function planted(x: any, f: any, port: any) { ${extra} }\n`;
      expect(afterAllowed('mount.ts', scan('mount.ts', text)).length, extra).toBe(1);
    }
  });

  it('comments and strings do not count; a type position does not count', () => {
    expect(scan('p.ts', "// window.open(location)\nexport const s = 'innerHTML';\nexport type W = typeof globalThis;\n")).toEqual([]);
  });
});

describe('host walls: no ambient types', () => {
  it('src/host compiles with the DOM library and no ambient types (no Node API reaches the library)', () => {
    const files = readdirSync(HOST_DIR)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => path.join(HOST_DIR, f));
    const program = ts.createProgram(files, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
      types: [],
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
    });
    const diags = ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    expect(diags).toEqual([]);
  });

  it('the program sees a Node API: a planted Buffer in a host file is a diagnostic', () => {
    const planted = path.join(HOST_DIR, 'planted-probe.ts');
    const host = ts.createCompilerHost({});
    const getSourceFile = host.getSourceFile.bind(host);
    const fileExists = host.fileExists.bind(host);
    host.fileExists = (f) => path.resolve(f) === planted || fileExists(f);
    host.getSourceFile = (f, lang, ...rest) =>
      path.resolve(f) === planted ? ts.createSourceFile(f, 'export const b = Buffer.from("x");\n', lang, true) : getSourceFile(f, lang, ...rest);
    const program = ts.createProgram(
      [planted],
      { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], types: [], noEmit: true, skipLibCheck: true },
      host,
    );
    const diags = ts.getPreEmitDiagnostics(program).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    expect(diags.some((m) => m.includes("Cannot find name 'Buffer'"))).toBe(true);
  });
});
