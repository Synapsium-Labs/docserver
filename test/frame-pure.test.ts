// The build-free rows of Task 7 (docserver L3; plan Reference §1, FD12, the Global Constraints' purity walls): the
// Mermaid gate (`mermaidGate`, src/frame/gate.ts), the identifier wall and the import graph of `./frame` (rows L3.M8,
// L3.M9 and L3.M9b). They read source and call pure functions only, so they live apart from
// test/frame-document.test.ts, which builds every frame asset in memory before its first row.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { MERMAID_GATE_DEFAULTS, mermaidGate } from '../src/frame/index.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

describe('L3.M8 the Mermaid gate', () => {
  it('MERMAID_GATE_DEFAULTS: 24 fences, 16384 code units per fence, 131072 in all; frozen', () => {
    expect(MERMAID_GATE_DEFAULTS).toEqual({ maxFences: 24, maxFenceChars: 16384, maxTotalChars: 131072 });
    expect(Object.isFrozen(MERMAID_GATE_DEFAULTS)).toBe(true);
  });

  // A scanRefs().mermaid of `fences` fences of `chars` three-byte characters each (U+4E00), bytes and code units both.
  const scan = (fences: number, chars: number): { fences: number; largestChars: number; totalChars: number; largestBytes: number; totalBytes: number } => ({
    fences,
    largestChars: chars,
    totalChars: fences * chars,
    largestBytes: 3 * chars,
    totalBytes: 3 * fences * chars,
  });
  // The layout shows a fence as its source when `text.length > maxTextSize` (src/enhance/diagrams.ts).
  const drawn = (fence: string, maxTextSize: number): boolean => !(fence.length > maxTextSize);

  it('a fence of 16384 code units of three-byte characters (49152 UTF-8 bytes) passes; 16385 does not: the per-fence cap travels as maxTextSize', () => {
    const at = '\u4e00'.repeat(16384);
    expect(Buffer.byteLength(at, 'utf8')).toBe(49152);
    const g = mermaidGate(scan(1, 16384));
    expect(g).toEqual({ inline: true, maxTextSize: 16384 });
    expect(drawn(at, g.maxTextSize)).toBe(true);
    expect(drawn(`${at}\u4e00`, mermaidGate(scan(1, 16385)).maxTextSize)).toBe(false);
  });

  it('the verdict ignores the largest fence: a document whose one fence is over the per-fence cap still inlines Mermaid, and the layout shows that fence as its source (deviation 1, the first consumer\'s spec §4.6)', () => {
    expect(mermaidGate(scan(1, 16385))).toEqual({ inline: true, maxTextSize: 16384 });
    expect(mermaidGate({ ...scan(3, 100), largestChars: 131072 })).toEqual({ inline: true, maxTextSize: 16384 });
    expect(mermaidGate(scan(1, 101), { maxFenceChars: 100 })).toEqual({ inline: true, maxTextSize: 100 });
  });

  it('counts in code units: 8 fences of 16384 three-byte characters (393216 bytes, 131072 code units) inline; one code unit more does not', () => {
    expect(mermaidGate(scan(8, 16384)).inline).toBe(true);
    expect(mermaidGate({ ...scan(8, 16384), totalChars: 131073 }).inline).toBe(false);
  });

  it('inlines nothing without a fence, and nothing over 24 fences', () => {
    expect(mermaidGate(scan(0, 0)).inline).toBe(false);
    expect(mermaidGate(scan(24, 10)).inline).toBe(true);
    expect(mermaidGate(scan(25, 10)).inline).toBe(false);
  });

  it('a host cap only tightens: below its default it binds; above it is a RangeError; not an integer from 1, RangeError', () => {
    expect(mermaidGate(scan(3, 10), { maxFences: 2 }).inline).toBe(false);
    expect(mermaidGate(scan(2, 10), { maxFences: 2 }).inline).toBe(true);
    expect(mermaidGate(scan(1, 100), { maxTotalChars: 99 }).inline).toBe(false);
    expect(mermaidGate(scan(1, 100), { maxFenceChars: 50 })).toEqual({ inline: true, maxTextSize: 50 });
    for (const [k, v] of Object.entries(MERMAID_GATE_DEFAULTS)) {
      expect(mermaidGate(scan(1, 1), { [k]: v }).inline, k).toBe(true);
      expect(() => mermaidGate(scan(1, 1), { [k]: v + 1 }), k).toThrow(RangeError);
      for (const bad of [0, -1, 1.5, Number.NaN]) expect(() => mermaidGate(scan(1, 1), { [k]: bad }), `${k} ${String(bad)}`).toThrow(RangeError);
      expect(() => mermaidGate(scan(1, 1), { [k]: '1' as unknown as number }), k).toThrow(TypeError);
    }
    expect(() => mermaidGate(scan(1, 1), { maxBytes: 1 } as unknown as { maxFences: number })).toThrow(TypeError);
  });

  it('a count or a cap behind a getter is a TypeError, the getter never called', () => {
    let calls = 0;
    const getter = (): number => ((calls += 1), 1);
    expect(() => mermaidGate(Object.defineProperty({ ...scan(1, 1) }, 'totalChars', { get: getter }))).toThrow(TypeError);
    expect(() => mermaidGate(scan(1, 1), Object.defineProperty({}, 'maxFences', { get: getter, enumerable: true }))).toThrow(TypeError);
    expect(calls).toBe(0);
  });

  it('counts that are not non-negative integers are a TypeError', () => {
    for (const bad of [-1, 1.5, Number.NaN, '1']) {
      expect(() => mermaidGate({ ...scan(1, 1), totalChars: bad as number }), String(bad)).toThrow(TypeError);
    }
    expect(() => mermaidGate(null as unknown as ReturnType<typeof scan>)).toThrow(TypeError);
    expect(() => mermaidGate(scan(1, 1), null as unknown as { maxFences: number })).toThrow(TypeError);
    expect(() => mermaidGate(scan(1, 1), [] as unknown as { maxFences: number })).toThrow(TypeError);
    expect(() => mermaidGate(scan(1, 1), 5 as unknown as { maxFences: number })).toThrow(TypeError);
  });
});

describe('L3.M9 pure: no file of the ./frame import graph reads a host, the clock or randomness', () => {
  // The identifiers no file of the ./frame import graph names: host APIs, the clock, randomness, locale and code from
  // strings (test/purity.test.ts's list for ./render).
  const FORBIDDEN = [
    'eval', 'Function', 'globalThis', 'window', 'self', 'frames', 'parent', 'top', 'document', 'navigator', 'location', 'DOMParser',
    'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'Worker',
    'importScripts', 'postMessage', 'process', 'Buffer', 'require', '__dirname', '__filename', 'setTimeout', 'setInterval',
    'setImmediate', 'queueMicrotask', 'Date', 'performance', 'random', 'crypto', 'TextEncoder', 'TextDecoder', 'structuredClone',
    'console', 'Intl', 'toLocaleLowerCase', 'toLocaleUpperCase', 'localeCompare', 'toLocaleString',
  ];

  it('no file of the ./frame import graph names a host, clock, random or locale identifier, or a dynamic import()', () => {
    const graph = frameGraph();
    expect(graph.files).toContain('src/frame/document.ts');
    expect(graph.files).toContain('src/frame/gate.ts');
    const found: string[] = [];
    for (const rel of graph.files) {
      const sf = ts.createSourceFile(rel, readFileSync(path.join(ROOT, rel), 'utf8'), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
      const visit = (n: ts.Node): void => {
        if (ts.isIdentifier(n) && FORBIDDEN.includes(n.text)) found.push(`${rel}: ${n.text}`);
        if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) found.push(`${rel}: import()`);
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
    expect(found).toEqual([]);
  });

  it('the scan sees a forbidden identifier in a planted source (its control)', () => {
    const sf = ts.createSourceFile('x.ts', 'export const t = Date.now() + Math.random();', ts.ScriptTarget.ES2022, true);
    const names: string[] = [];
    const visit = (n: ts.Node): void => {
      if (ts.isIdentifier(n) && FORBIDDEN.includes(n.text)) names.push(n.text);
      ts.forEachChild(n, visit);
    };
    visit(sf);
    expect(names).toEqual(['Date', 'random']);
  });
});

/** The ./frame import graph, from src/frame/index.ts through relative imports (type-only ones included). */
function frameGraph(): { files: string[]; bare: string[] } {
  const seen = new Set<string>();
  const bare = new Set<string>();
  const queue = [path.join(ROOT, 'src', 'frame', 'index.ts')];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const f of ts.preProcessFile(readFileSync(file, 'utf8'), true, true).importedFiles) {
      const spec = f.fileName;
      if (spec.startsWith('.')) queue.push(path.resolve(path.dirname(file), spec.replace(/\.js$/, '.ts')));
      else bare.add(spec);
    }
  }
  return { files: [...seen].map((p) => path.relative(ROOT, p).split(path.sep).join('/')).sort(), bare: [...bare].sort() };
}

describe('L3.M9b the ./frame import graph: no typescript, and no bare specifier outside the dependencies', () => {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
  const packageOf = (spec: string): string => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : (spec.split('/')[0] as string));

  it('every bare specifier names a package of package.json\'s dependencies; none is typescript or a Node built-in', () => {
    const { files, bare } = frameGraph();
    expect(files).toEqual(expect.arrayContaining(['src/frame/index.ts', 'src/frame/document.ts', 'src/frame/bytes.ts', 'src/frame/seed.ts', 'src/frame/gate.ts']));
    expect(bare.filter((s) => s.startsWith('node:') || packageOf(s) === 'typescript')).toEqual([]);
    expect(bare.filter((s) => !Object.hasOwn(pkg.dependencies, packageOf(s)))).toEqual([]);
  });

  it('typescript is a devDependency, so the wall would see it (its control)', () => {
    expect(Object.hasOwn(pkg.dependencies, 'typescript')).toBe(false);
    expect(ts.preProcessFile("import ts from 'typescript';", true, true).importedFiles.map((f) => f.fileName)).toEqual(['typescript']);
  });
});
