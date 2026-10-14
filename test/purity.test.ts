// The purity of `./render` (docserver L1, Task 12; architecture section F T12, global constraints 2 and 3).
// Three static walls, each read from the source itself:
// 1. src/render typechecks under tsconfig.render.json (lib ES2022, no ambient types), so a host global used
//    there is a type error. Task 1's render-tsconfig test proves the project rejects host globals; this test
//    proves the real sources pass it, and that no declaration file they reach drags DOM or Node types back in
//    (highlight.js's own types reference the DOM library, so the project maps them to src/types/purity/).
// 2. The import graph of src/render/index.ts, read with TypeScript's own import scanner and followed through
//    every relative import, stays inside src/render, names no Node built-in, and names no package outside the
//    dependency allowlist (BARE_ALLOWED, the judge proper). The imported packages are compared with
//    package.json's dependencies except the @types/* ones, which no source imports by name: a consumer's
//    compiler needs them for the packed declarations (test/package.test.ts pins them).
// 3. No source file in src/render names a host or nondeterministic identifier (network, storage, DOM, Node,
//    clock, randomness, locale, code from strings), or uses a dynamic import(). Comments and strings do not
//    count: the identifiers are read from TypeScript's syntax tree.
// The dynamic wall, the bundle run in an empty VM context, is test/browser-parity.test.ts.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const RENDER_DIR = path.join(ROOT, 'src', 'render');
const ENTRY = path.join(RENDER_DIR, 'index.ts');
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

/** The bare specifiers src/render may import: its dependencies, and highlight.js's core and single languages. */
const BARE_ALLOWED: readonly RegExp[] = [
  /^markdown-it$/,
  /^markdown-it-footnote$/,
  /^js-yaml$/,
  /^highlight\.js\/lib\/core$/,
  /^highlight\.js\/lib\/languages\/[a-z0-9]+$/,
];

/** Identifiers src/render never names: host APIs, clock, randomness, locale-dependent text, code from strings. */
const FORBIDDEN_IDENTIFIERS: readonly string[] = [
  // code from strings, and the global object itself
  'eval', 'Function', 'globalThis', 'window', 'frames', 'parent', 'top',
  // DOM and HTML sinks
  'document', 'navigator', 'location', 'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'DOMParser',
  // network and storage
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'localStorage', 'sessionStorage', 'indexedDB', 'caches',
  // workers and messaging
  'Worker', 'importScripts', 'postMessage',
  // Node
  'process', 'Buffer', 'require', '__dirname', '__filename',
  // host timers, clock, randomness
  'setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask', 'Date', 'performance', 'random', 'crypto',
  // host text APIs and logging
  'TextEncoder', 'TextDecoder', 'structuredClone', 'console',
  // locale-dependent results
  'Intl', 'toLocaleLowerCase', 'toLocaleUpperCase', 'localeCompare', 'toLocaleString',
];

/** Every .ts file under a directory, sorted, as paths relative to ROOT with forward slashes. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...tsFiles(p));
    else if (e.isFile() && e.name.endsWith('.ts')) out.push(p);
  }
  return out.sort();
}

const rel = (p: string): string => path.relative(ROOT, p).split(path.sep).join('/');

/** The module specifiers a source file imports or re-exports, read by TypeScript's own import scanner. */
function specifiers(source: string): string[] {
  return ts.preProcessFile(source, true, true).importedFiles.map((f) => f.fileName);
}

interface Graph {
  /** Every file reached from the entry, relative to ROOT. */
  files: string[];
  /** Every problem found: an import outside src/render, a built-in, an unknown package, a missing file. */
  problems: string[];
  /** The distinct package names of the bare imports. */
  packages: string[];
}

/** Follow the import graph from `entry` through relative imports; judge every bare import against the allowlist. */
function importGraph(entry: string): Graph {
  const seen = new Set<string>();
  const problems: string[] = [];
  const packages = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of specifiers(readFileSync(file, 'utf8'))) {
      const where = `${rel(file)} imports "${spec}"`;
      if (spec.startsWith('.')) {
        const target = path.resolve(path.dirname(file), spec.replace(/\.js$/, '.ts'));
        if (!target.startsWith(RENDER_DIR + path.sep)) problems.push(`${where}: outside src/render`);
        else if (!existsSync(target)) problems.push(`${where}: no such file`);
        else queue.push(target);
      } else if (spec.startsWith('node:') || !BARE_ALLOWED.some((re) => re.test(spec))) {
        problems.push(`${where}: not an allowed dependency`);
      } else {
        packages.add(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : (spec.split('/')[0] as string));
      }
    }
  }
  return { files: [...seen].map(rel).sort(), problems, packages: [...packages].sort() };
}

/** Every forbidden identifier and every dynamic import() in a source text, as "line:column name". */
function forbiddenUses(fileName: string, source: string): string[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const banned = new Set(FORBIDDEN_IDENTIFIERS);
  const out: string[] = [];
  const at = (node: ts.Node, what: string): void => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    out.push(`${line + 1}:${character + 1} ${what}`);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && banned.has(node.text)) at(node, node.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) at(node, 'import()');
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

describe('purity: tsconfig.render.json over the real sources', () => {
  it('typechecks src/render with lib ES2022 and no ambient types (the local tsc exits 0)', () => {
    const r = spawnSync(process.execPath, [TSC, '--noEmit', '--pretty', 'false', '-p', 'tsconfig.render.json'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(`${r.stdout}${r.stderr}`).toBe('');
    expect(r.status).toBe(0);
  });

  it('loads no DOM, worker or Node declarations: only the ES libraries, the sources and their packages', () => {
    const r = spawnSync(process.execPath, [TSC, '--noEmit', '-p', 'tsconfig.render.json', '--listFilesOnly'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(r.status).toBe(0);
    // Matched by name, not by place: node_modules may be a link, and tsc prints the real path.
    const files = r.stdout.split('\n').filter((f) => f !== '').map((f) => f.split(path.sep).join('/'));
    const libs = files.filter((f) => /\/typescript\/lib\/lib\.[^/]+\.d\.ts$/.test(f)).map((f) => path.posix.basename(f));
    expect(libs.length).toBeGreaterThan(0);
    expect(libs.filter((f) => !/^lib\.(?:es5|es20\d\d(?:\.[a-z]+)*|decorators(?:\.legacy)?)\.d\.ts$/.test(f))).toEqual([]);
    expect(files.filter((f) => f.includes('/@types/node/'))).toEqual([]);
  });
});

describe('purity: the import graph of src/render/index.ts', () => {
  const graph = importGraph(ENTRY);
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
  };

  it('reaches every source file of src/render, and nothing else', () => {
    expect(graph.files).toEqual(tsFiles(RENDER_DIR).map(rel));
  });

  it('stays inside src/render and imports only allowed dependencies', () => {
    expect(graph.problems).toEqual([]);
  });

  it('imports every runtime dependency, and only those', () => {
    // The @types packages are dependencies so a consumer's compiler finds the types of the packed declarations
    // (test/package.test.ts pins them); no source file imports them by name.
    const runtime = Object.keys(pkg.dependencies).filter((name) => !name.startsWith('@types/'));
    expect(graph.packages).toEqual(runtime.sort());
  });

  it('the scanner sees every import form, and the judge refuses what it must', () => {
    const probe = [
      "import a from 'markdown-it';",
      "import type { B } from 'js-yaml';",
      "import {\n  c,\n  d,\n} from './c.js';",
      "export { e } from 'highlight.js/lib/languages/python';",
      "export * from './f.js';",
      "import 'node:crypto';",
      "const g = await import('node:fs');",
      "// import h from 'commented-out';",
      "const i = 'import j from \"in-a-string\"';",
    ].join('\n');
    expect(specifiers(probe)).toEqual([
      'markdown-it',
      'js-yaml',
      './c.js',
      'highlight.js/lib/languages/python',
      './f.js',
      'node:crypto',
      'node:fs',
    ]);
    const judged = ['markdown-it-anchor', 'highlight.js', 'highlight.js/lib/languages/../core', 'node:fs', 'fs', 'js-yaml/x'];
    expect(judged.filter((s) => BARE_ALLOWED.some((re) => re.test(s)))).toEqual([]);
  });
});

describe('purity: identifiers in src/render', () => {
  it('no source file names a host, clock, random, locale or code-from-string identifier', () => {
    const uses = tsFiles(RENDER_DIR).flatMap((f) =>
      forbiddenUses(f, readFileSync(f, 'utf8')).map((u) => `${rel(f)}:${u}`),
    );
    expect(uses).toEqual([]);
  });

  it('the scan reads code, not comments or strings, and sees property names and dynamic import()', () => {
    const probe = [
      '// the document and its window are words here',
      "const s = 'This document could not be rendered';",
      'const a = globalThis.localStorage;',
      'const b = x.innerHTML;',
      'const c = Date.now() + Math.random();',
      "const d = new Function('return 1');",
      "const e = import('x');",
      "const f = 'a'.toLocaleLowerCase();",
    ].join('\n');
    expect(forbiddenUses('probe.ts', probe)).toEqual([
      '3:11 globalThis',
      '3:22 localStorage',
      '4:13 innerHTML',
      '5:11 Date',
      '5:29 random',
      '6:15 Function',
      '7:11 import()',
      '8:15 toLocaleLowerCase',
    ]);
  });
});
