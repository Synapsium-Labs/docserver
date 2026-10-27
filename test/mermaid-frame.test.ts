// The Mermaid frame build (docserver L3 Task 4; plan Reference §5.1, §5.2, §5.5 and §12 step 1; rows L3.M16).
// assets/mermaid/mermaid.frame.js is Mermaid as a classic strict IIFE for the sealed reader frame: the same pinned input,
// elk stand-in, target, minification, legal comments and symlink handling as assets/mermaid/mermaid.mjs, read back
// here from the one option object both builds spread, plus the IIFE format, the "use strict" banner and the
// free-global define set. Both are built in memory by scripts/build-mermaid.mjs, so the test needs no build first.
//
// The checks: the file is one IIFE (no import, export, import.meta or top-level await, measured on the TypeScript
// parser's tree, not on the text); no `typeof` of a defined-away name survives (mermaid.mjs, built without the define
// set, is the control that holds them); `require` is not defined away and no `(void 0)(` call is left (prototype
// finding P-1); no elkjs; within 4 MiB; the same legal comments, inputs and bundled packages as mermaid.mjs (so the
// notices that cover one cover the other); and scripts/build-frame.mjs takes its Mermaid file from
// buildMermaidFrame(), not from a copy of its options.
//
// Then the file runs, in a jsdom document, as a classic script element: it dispatches exactly one
// `docserver:register` on its own element, naming `mermaid` and handing Mermaid's API with start-on-load off, and draws
// nothing when the window's load event comes. A control proves the observation can see a drawing: the same file with
// start-on-load switched back on by a listener does draw on that event.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildFrame, FRAME_FILES, FREE_DEFINES as FRAME_FREE_DEFINES, MERMAID_FRAME_ENTRY } from '../scripts/build-frame.mjs';
import {
  ELK_SIGNATURE,
  FRAME_ENTRY,
  FRAME_OUT_FILE,
  FREE_DEFINES,
  MAX_BYTES,
  OUT_FILE,
  SHARED_OPTIONS,
  STRICT_BANNER,
  buildMermaid,
  buildMermaidFrame,
  bundleMermaidFrame,
  mermaidFrameHazards,
  packagesOf,
  type Built,
} from '../scripts/build-mermaid.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** The names the define set replaces (Reference §5.5): never `require` (prototype finding P-1). */
const DEFINED_AWAY = ['process', 'global', 'module', 'exports', 'define', 'Deno', 'Bun'];

/** The five of them mermaid.mjs reads with `typeof` (measured: the control). */
const READ_IN_MERMAID = ['process', 'module', 'exports', 'define', 'global'];

let esm: Built;
let frame: Built;
let frameText: string;

beforeAll(async () => {
  esm = await buildMermaid({ root: ROOT });
  frame = await bundleMermaidFrame({ root: ROOT });
  frameText = await buildMermaidFrame(ROOT);
}, 300_000);

/** The tree of a classic script: parsed as JavaScript, never as a module. */
function parse(text: string): ts.SourceFile {
  return ts.createSourceFile('file.js', text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
}

/** Each node of `root`, depth first. */
function walk(root: ts.Node, visit: (n: ts.Node) => void): void {
  const stack: ts.Node[] = [root];
  while (stack.length > 0) {
    const n = stack.pop() as ts.Node;
    visit(n);
    ts.forEachChild(n, (c) => {
      stack.push(c);
    });
  }
}

/** Whether `n` sits in an async function (its nearest enclosing function is async). */
function inAsyncFunction(n: ts.Node): boolean {
  for (let p = n.parent; p !== undefined; p = p.parent) {
    if (ts.isFunctionLike(p)) return (ts.getCombinedModifierFlags(p as ts.Declaration) & ts.ModifierFlags.Async) !== 0;
  }
  return false;
}

interface Shape {
  /** The top-level statements: 'directive' for a "use strict" string, 'iife' for a call of a function, else the kind. */
  readonly statements: readonly string[];
  readonly iifeAsync: boolean | null;
  readonly imports: number;
  readonly exports: number;
  readonly importMeta: number;
  readonly dynamicImports: number;
  readonly topLevelAwaits: number;
  readonly parseErrors: number;
}

/** What a script is made of, read from its tree. */
function shape(text: string): Shape {
  const sf = parse(text);
  let iifeAsync: boolean | null = null;
  const statements = sf.statements.map((s) => {
    if (!ts.isExpressionStatement(s)) return ts.SyntaxKind[s.kind];
    if (ts.isStringLiteral(s.expression) && s.expression.text === 'use strict') return 'directive';
    let callee: ts.Expression | null = ts.isCallExpression(s.expression) && s.expression.arguments.length === 0 ? s.expression.expression : null;
    while (callee !== null && ts.isParenthesizedExpression(callee)) callee = callee.expression;
    if (callee !== null && (ts.isArrowFunction(callee) || ts.isFunctionExpression(callee))) {
      iifeAsync = (ts.getCombinedModifierFlags(callee) & ts.ModifierFlags.Async) !== 0;
      return 'iife';
    }
    return ts.SyntaxKind[s.expression.kind];
  });
  let imports = 0;
  let exports = 0;
  let importMeta = 0;
  let dynamicImports = 0;
  let topLevelAwaits = 0;
  walk(sf, (n) => {
    if (ts.isImportDeclaration(n) || ts.isImportEqualsDeclaration(n)) imports++;
    else if (ts.isExportDeclaration(n) || ts.isExportAssignment(n)) exports++;
    else if (ts.isMetaProperty(n) && n.keywordToken === ts.SyntaxKind.ImportKeyword) importMeta++;
    else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) dynamicImports++;
    else if ((ts.isAwaitExpression(n) || (ts.isForOfStatement(n) && n.awaitModifier !== undefined)) && !inAsyncFunction(n)) topLevelAwaits++;
    if (ts.canHaveModifiers(n) && (ts.getModifiers(n) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) exports++;
  });
  const parseErrors = (sf as unknown as { parseDiagnostics: readonly unknown[] }).parseDiagnostics.length;
  return { statements, iifeAsync, imports, exports, importMeta, dynamicImports, topLevelAwaits, parseErrors };
}

/** How many times each name is the operand of `typeof`, as an identifier in the tree (strings never count). */
function typeofReads(text: string, names: readonly string[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(names.map((n) => [n, 0]));
  walk(parse(text), (n) => {
    if (ts.isTypeOfExpression(n) && ts.isIdentifier(n.expression) && names.includes(n.expression.text)) {
      out[n.expression.text] = (out[n.expression.text] ?? 0) + 1;
    }
  });
  return out;
}

/** The legal comments esbuild gathers at the end of a file: from its last `/*! Bundled license information:`. */
function legalTail(text: string): string {
  const at = text.lastIndexOf('/*! Bundled license information:');
  return at < 0 ? '' : text.slice(at);
}

describe('L3.M16: the Mermaid frame file', () => {
  it('is one classic IIFE: the banner, then one call of a function that is not async; no import, export, import.meta or top-level await', () => {
    expect(frame.text.startsWith(`${STRICT_BANNER}\n`)).toBe(true);
    const s = shape(frame.text);
    expect(s.statements.filter((k) => k !== 'directive')).toEqual(['iife']);
    expect(s.statements[0]).toBe('directive');
    expect(s.statements[s.statements.length - 1]).toBe('iife');
    expect(s).toMatchObject({ iifeAsync: false, imports: 0, exports: 0, importMeta: 0, dynamicImports: 0, topLevelAwaits: 0, parseErrors: 0 });
    expect(frame.exports).toEqual([]);
    expect(frame.imports).toEqual([]);
    expect(frame.outputs).toEqual([FRAME_OUT_FILE]);
  });

  it('the shape check sees a module: mermaid.mjs is no IIFE, and it exports', () => {
    const s = shape(esm.text);
    expect(s.statements.filter((k) => k !== 'directive')).not.toEqual(['iife']);
    expect(s.exports).toBeGreaterThan(0);
  });

  it('has the define set applied: no `typeof` of a defined-away name is left, where mermaid.mjs has each of five', () => {
    expect(typeofReads(frame.text, DEFINED_AWAY)).toEqual(Object.fromEntries(DEFINED_AWAY.map((n) => [n, 0])));
    const control = typeofReads(esm.text, READ_IN_MERMAID);
    for (const n of READ_IN_MERMAID) expect(control[n], n).toBeGreaterThan(0);
  });

  it('defines away exactly the seven names, never `require`, and no `(void 0)(` call is left in the file', () => {
    expect(Object.keys(FREE_DEFINES).sort()).toEqual([...DEFINED_AWAY].sort());
    for (const v of Object.values(FREE_DEFINES)) expect(v).toBe('undefined');
    expect(Object.keys(FREE_DEFINES)).not.toContain('require');
    expect(Object.isFrozen(FREE_DEFINES)).toBe(true);
    expect(frame.text.includes('(void 0)(')).toBe(false);
  });

  it('bundles no elkjs and stays within 4 MiB, and the hazard check names either', () => {
    expect(frame.text.split(ELK_SIGNATURE).length - 1).toBe(0);
    expect(frame.inputs).toContain('scripts/mermaid-elk-stub.mjs');
    expect(frame.inputs.filter((i) => /(?:^|\/)node_modules\/elkjs\//.test(i))).toEqual([]);
    expect(frame.bytes).toBeGreaterThan(1_000_000);
    expect(frame.bytes).toBeLessThanOrEqual(MAX_BYTES);
    expect(mermaidFrameHazards(frame.text)).toEqual([]);
    expect(mermaidFrameHazards(`x${ELK_SIGNATURE}x`)).toEqual(['elkjs is bundled']);
    expect(mermaidFrameHazards('a'.repeat(MAX_BYTES))).toEqual([]);
    expect(mermaidFrameHazards('a'.repeat(MAX_BYTES + 1))).toEqual([`${String(MAX_BYTES + 1)} bytes, over ${String(MAX_BYTES)}`]);
    // Counted in UTF-8 bytes, not in characters: U+00E9 is two.
    expect(mermaidFrameHazards('\u00e9'.repeat(MAX_BYTES / 2 + 1))).toEqual([`${String(MAX_BYTES + 2)} bytes, over ${String(MAX_BYTES)}`]);
  });

  it('buildMermaidFrame() refuses a build that bundles elkjs or passes 4 MiB, and resolves a clean one (a fixture root)', async () => {
    // The real build, from a package root that holds only a frame entry of its own: what it bundles is that entry, so
    // each case reaches the refusal itself, not only the predicate it reads.
    const dir = mkdtempSync(path.join(tmpdir(), 'build-mermaid-frame-'));
    const run = async (entry: string): Promise<string> => {
      mkdirSync(path.join(dir, path.dirname(FRAME_ENTRY)), { recursive: true });
      writeFileSync(path.join(dir, FRAME_ENTRY), entry);
      return buildMermaidFrame(dir);
    };
    try {
      const clean = await run('globalThis.x = 1;\n');
      expect(clean.startsWith(`${STRICT_BANNER}\n`)).toBe(true);
      expect(clean).toContain('globalThis.x=1');
      await expect(run(`globalThis.x = ${JSON.stringify(ELK_SIGNATURE)};\n`)).rejects.toThrow(`build-mermaid: ${FRAME_OUT_FILE}: elkjs is bundled`);
      await expect(run(`globalThis.x = ${JSON.stringify('a'.repeat(MAX_BYTES))};\n`)).rejects.toThrow(
        new RegExp(`^build-mermaid: ${FRAME_OUT_FILE.replace(/\./g, '\\.')}: \\d+ bytes, over ${String(MAX_BYTES)}$`),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  it('keeps the same legal comments as mermaid.mjs, gathered at its end', () => {
    const tail = legalTail(frame.text);
    expect(tail).toMatch(/^\/\*! Bundled license information:\n/);
    expect(tail).toContain('lodash-es/lodash.js:');
    expect(tail).toBe(legalTail(esm.text));
  });

  it('shares one option object with mermaid.mjs: input settings, elk stand-in, target, minification, legal comments and symlinks, read back from both builds', () => {
    expect(Object.isFrozen(SHARED_OPTIONS)).toBe(true);
    expect(SHARED_OPTIONS).toMatchObject({ target: 'es2022', minify: true, legalComments: 'eof', preserveSymlinks: true, bundle: true, splitting: false, platform: 'browser' });
    for (const built of [esm, frame]) {
      for (const [key, value] of Object.entries(SHARED_OPTIONS)) expect(built.options[key], `${built.outputs.join()} ${key}`).toEqual(value);
      expect(built.options['absWorkingDir']).toBe(ROOT);
      expect((built.options['plugins'] as readonly { name: string }[]).map((p) => p.name)).toEqual(['elkjs-stub']);
    }
    expect(esm.options).toMatchObject({ format: 'esm', outfile: path.join(ROOT, OUT_FILE) });
    expect(esm.options['define']).toBeUndefined();
    expect(esm.options['banner']).toBeUndefined();
    expect(frame.options).toMatchObject({ format: 'iife', outfile: path.join(ROOT, FRAME_OUT_FILE), entryPoints: [FRAME_ENTRY], banner: { js: STRICT_BANNER } });
    expect(frame.options['define']).toEqual(FREE_DEFINES);
    // Each build's own keys are only these: everything else is the shared object's.
    const own = (o: Readonly<Record<string, unknown>>): string[] => Object.keys(o).filter((k) => !(k in SHARED_OPTIONS)).sort();
    expect(own(esm.options)).toEqual(['absWorkingDir', 'format', 'outfile', 'plugins', 'stdin']);
    expect(own(frame.options)).toEqual(['absWorkingDir', 'banner', 'define', 'entryPoints', 'format', 'outfile', 'plugins']);
  });

  it('bundles the same pinned input as mermaid.mjs: the same files but each build\'s own entry, so the same packages and notices', () => {
    expect(frame.inputs.filter((i) => i !== FRAME_ENTRY)).toEqual(esm.inputs.filter((i) => i !== 'mermaid-entry.mjs'));
    expect(frame.inputs).toContain(FRAME_ENTRY);
    expect(packagesOf(frame.metafile, ROOT)).toEqual(packagesOf(esm.metafile, ROOT));
  });

  it('is the same text from buildMermaidFrame(), from a second build, and from scripts/build-frame.mjs, which re-exports the define set', async () => {
    expect(frameText).toBe(frame.text);
    expect((await buildFrame({ root: ROOT })).files.mermaid.text).toBe(frame.text);
    expect(FRAME_FREE_DEFINES).toBe(FREE_DEFINES);
    expect(MERMAID_FRAME_ENTRY).toBe(FRAME_ENTRY);
    expect(`assets/${FRAME_FILES.mermaid}`).toBe(FRAME_OUT_FILE);
    // build-frame.mjs holds no Mermaid build of its own: no elk stand-in, no symlink setting, a call of buildMermaidFrame.
    const source = readFileSync(path.join(ROOT, 'scripts', 'build-frame.mjs'), 'utf8');
    expect(source).toContain('buildMermaidFrame(root)');
    expect(source).not.toMatch(/\bSTUB\b|preserveSymlinks|elkjs-stub|mermaid-frame-entry/);
  });
});

// --- In a document --------------------------------------------------------------------------------------------------

/** The DOM this file needs, typed here: the unit project's tsconfig has no DOM library, and jsdom ships no types. */
interface DomElement {
  textContent: string | null;
  className: string;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  querySelector(selector: string): DomElement | null;
  appendChild(child: DomElement): DomElement;
}
interface DomEvent {
  readonly type: string;
  readonly target: unknown;
  readonly bubbles: boolean;
  readonly detail: unknown;
}
interface DomWindow {
  readonly document: {
    readonly readyState: string;
    readonly head: DomElement;
    readonly body: DomElement;
    createElement(name: string): DomElement;
    addEventListener(type: string, fn: (e: DomEvent) => void, capture?: boolean): void;
    removeEventListener(type: string, fn: (e: DomEvent) => void, capture?: boolean): void;
  };
  addEventListener(type: string, fn: (e: DomEvent) => void, capture?: boolean): void;
  removeEventListener(type: string, fn: (e: DomEvent) => void, capture?: boolean): void;
  close(): void;
}
type JsdomCtor = new (html: string, options: Readonly<Record<string, unknown>>) => { readonly window: DomWindow };

/** jsdom, loaded through require: esbuild cannot run inside vitest's jsdom environment, so this file runs in Node. */
const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: JsdomCtor };

interface MermaidApi {
  startOnLoad: boolean;
  readonly initialize: unknown;
  readonly run: unknown;
  readonly render: unknown;
}

const SOURCE = 'flowchart LR\n  A[Start here] --> B[Done]';

/** A fresh document holding two diagrams as Mermaid's start-on-load would find them: a `pre.mermaid` and a `div.mermaid`. */
function page(): { win: DomWindow; diagrams: DomElement[] } {
  const win = new JSDOM('<!doctype html><html><head></head><body></body></html>', { runScripts: 'dangerously', pretendToBeVisual: true }).window;
  const diagrams = ['pre', 'div'].map((tag) => {
    const el = win.document.createElement(tag);
    el.className = 'mermaid';
    el.textContent = SOURCE;
    win.document.body.appendChild(el);
    return el;
  });
  return { win, diagrams };
}

const touched = (el: DomElement): boolean => el.hasAttribute('data-processed') || el.querySelector('svg') !== null || el.textContent !== SOURCE;

/** Wait up to `ms` for `done()`, polling every 20 ms; resolves with its last answer. */
async function waitFor(done: () => boolean, ms: number): Promise<boolean> {
  const until = Date.now() + ms;
  while (!done() && Date.now() < until) await new Promise((r) => setTimeout(r, 20));
  return done();
}

interface Ran {
  readonly script: DomElement;
  readonly events: readonly DomEvent[];
  readonly bubbled: number;
  readonly added: readonly string[];
  /** Resolves once the window's own load event has come, after the script ran. */
  readonly loaded: Promise<void>;
}

/**
 * Run `text` as a classic script element in `win`'s document, before the window's load event (the check fails
 * otherwise); `onRegister` sees each register event first.
 */
function runScript(win: DomWindow, text: string, onRegister: (e: DomEvent) => void = () => undefined): Ran {
  expect(win.document.readyState).not.toBe('complete');
  const loaded = new Promise<void>((resolve) => {
    win.addEventListener('load', () => {
      resolve();
    });
  });
  const events: DomEvent[] = [];
  let bubbled = 0;
  const capture = (e: DomEvent): void => {
    events.push(e);
    onRegister(e);
  };
  const bubble = (): void => {
    bubbled++;
  };
  const before = new Set(Object.getOwnPropertyNames(win));
  win.document.addEventListener('docserver:register', capture, true);
  win.addEventListener('docserver:register', bubble);
  const script = win.document.createElement('script');
  script.textContent = text;
  try {
    win.document.head.appendChild(script);
  } finally {
    win.document.removeEventListener('docserver:register', capture, true);
    win.removeEventListener('docserver:register', bubble);
  }
  return { script, events, bubbled, added: Object.getOwnPropertyNames(win).filter((k) => !before.has(k)).sort(), loaded };
}

describe('L3.M16: the Mermaid frame file in a document', () => {
  it('registers once by event on its own script element, start-on-load off, and draws nothing on the load event', async () => {
    const { win, diagrams } = page();
    try {
      const ran = runScript(win, frame.text);
      expect(ran.events.length).toBe(1);
      expect(ran.bubbled).toBe(1);
      const [e] = ran.events;
      expect(e?.type).toBe('docserver:register');
      // Compared as booleans: a jsdom node in an assertion's diff cannot be printed (its window has an opaque origin).
      expect(e?.target === ran.script).toBe(true);
      expect(e?.bubbles).toBe(true);
      expect(Object.isFrozen(e?.detail)).toBe(true);
      const detail = e?.detail as { name: unknown; api: MermaidApi };
      expect(Object.keys(detail)).toEqual(['name', 'api']);
      expect(detail.name).toBe('mermaid');
      expect(detail.api.startOnLoad).toBe(false);
      expect([typeof detail.api.initialize, typeof detail.api.run, typeof detail.api.render]).toEqual(['function', 'function', 'function']);
      // The entry leaves nothing on the window; Mermaid's own code writes two names there (measured): its markdown
      // helpers' static `globalThis.injected ??=`, which the free-global scan reports and its allowlist must take, and
      // fastdom's write through its IIFE parameter, which the scan cannot resolve and which lands before any content
      // exists. The entry's header names the two globals Mermaid reads lazily (mermaidCaptureSizes, __mermaidProfiler).
      expect(ran.added).toEqual(['fastdom', 'injected']);
      await ran.loaded;
      expect(await waitFor(() => diagrams.some(touched), 1000)).toBe(false);
      for (const d of diagrams) expect({ processed: d.getAttribute('data-processed'), svg: d.querySelector('svg') !== null, text: d.textContent }).toEqual({ processed: null, svg: false, text: SOURCE });
    } finally {
      win.close();
    }
  });

  it('control: with start-on-load switched back on before the load event, the same file does draw then', async () => {
    const { win, diagrams } = page();
    try {
      const ran = runScript(win, frame.text, (e) => {
        (e.detail as { api: MermaidApi }).api.startOnLoad = true;
      });
      expect(ran.events.length).toBe(1);
      await ran.loaded;
      expect(await waitFor(() => diagrams.every((d) => d.hasAttribute('data-processed')), 5000)).toBe(true);
    } finally {
      win.close();
    }
  });
});
