// The package manifest, the lockfile's root and the npm settings (docserver L1, Task 1).
// A consumer pins one exact version of this package; the package pins exact versions of its own dependencies,
// so the same corpus input always meets the same parser. The exports map is the whole public surface.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../', import.meta.url);
const readText = (rel: string): string => readFileSync(new URL(rel, ROOT), 'utf8');
const readJson = (rel: string): unknown => JSON.parse(readText(rel));

type Deps = Record<string, string>;
interface Manifest {
  name: string;
  type: string;
  license: string;
  sideEffects: boolean | string[];
  engines: { node: string };
  exports: Record<string, unknown>;
  files: string[];
  scripts: Record<string, string>;
  dependencies: Deps;
  devDependencies: Deps;
}
interface Lock {
  lockfileVersion: number;
  packages: Record<string, { version?: string; dev?: boolean; dependencies?: Deps; devDependencies?: Deps }>;
}

const pkg = readJson('package.json') as Manifest;
const lock = readJson('package-lock.json') as Lock;
const EXACT = /^\d+\.\d+\.\d+$/;

describe('package.json: exact pins', () => {
  it('every dependency and devDependency is an exact x.y.z version', () => {
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(pkg.dependencies).length).toBeGreaterThan(0);
    expect(Object.keys(pkg.devDependencies).length).toBeGreaterThan(0);
    const loose = Object.entries(all).filter(([, v]) => !EXACT.test(v));
    expect(loose).toEqual([]);
  });

  it("the lockfile's root records the same exact pins", () => {
    const root = lock.packages[''];
    expect(root?.dependencies).toEqual(pkg.dependencies);
    expect(root?.devDependencies).toEqual(pkg.devDependencies);
  });

  it('the lockfile resolves each direct dependency to its pinned version', () => {
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    const resolved = Object.fromEntries(
      Object.keys(all).map((name) => [name, lock.packages[`node_modules/${name}`]?.version]),
    );
    expect(resolved).toEqual(all);
  });
});

describe('package.json: the types the packed declarations import', () => {
  // dist/render/*.d.ts import 'markdown-it' and 'js-yaml', whose types come only from these two packages. A
  // consumer installs dependencies, never devDependencies, so a strict consumer (skipLibCheck: false) resolves
  // the packed declarations only if these are dependencies (review 458, F7; test/pack.test.ts runs that check).
  const TYPES = { '@types/js-yaml': '4.0.9', '@types/markdown-it': '14.2.0' };

  it('@types/markdown-it and @types/js-yaml are exact-pinned dependencies, not devDependencies', () => {
    const entries = Object.entries(pkg.dependencies);
    const typesDeps = Object.fromEntries(entries.filter(([name]) => name.startsWith('@types/')));
    expect(typesDeps).toEqual(TYPES);
    for (const name of Object.keys(TYPES)) expect(pkg.devDependencies).not.toHaveProperty(name);
  });

  it('the lockfile marks them, and the @types they pull in, as production packages', () => {
    const marked = Object.entries(lock.packages)
      .filter(([key]) => /^node_modules\/@types\/(?:js-yaml|markdown-it|linkify-it|mdurl)$/.test(key))
      .map(([key, p]) => [key, p.dev === true]);
    expect(marked.length).toBeGreaterThanOrEqual(4);
    expect(marked.filter(([, dev]) => dev)).toEqual([]);
  });
});

describe('package.json: exports keys', () => {
  it('exposes exactly ./render, ./conformance, ./enhance, ./frame, ./host, ./highlight, ./assets/* and ./package.json', () => {
    expect(Object.keys(pkg.exports).sort()).toEqual([
      './assets/*',
      './conformance',
      './enhance',
      './frame',
      './highlight',
      './host',
      './package.json',
      './render',
    ]);
  });

  it('./frame, ./host and ./highlight (docserver L3, Task 12; plan Reference §12) each name their types first and their ESM build second', () => {
    for (const entry of ['frame', 'host', 'highlight']) {
      const value = pkg.exports[`./${entry}`];
      expect(value, entry).toEqual({ types: `./dist/${entry}/index.d.ts`, import: `./dist/${entry}/index.js` });
      expect(Object.keys(value as object), entry).toEqual(['types', 'import']);
    }
  });

  it('exports no frame runtime: its scripts ship only as the hashed files under ./assets/*', () => {
    expect(Object.keys(pkg.exports).filter((k) => k.includes('runtime'))).toEqual([]);
  });

  it("the README's exports sentence names exactly those keys", () => {
    const sentence = readText('README.md').split('\n').find((l) => l.startsWith('The package exports exactly ')) ?? '';
    const named = [...sentence.matchAll(/`([^`]+)`/g)].map((m) => m[1]).sort();
    expect(named).toEqual(Object.keys(pkg.exports).sort());
  });

  it('./enhance names its types first and its ESM build second; ./assets/* maps to the assets directory', () => {
    expect(pkg.exports['./enhance']).toEqual({
      types: './dist/enhance/index.d.ts',
      import: './dist/enhance/index.js',
    });
    expect(pkg.exports['./assets/*']).toBe('./assets/*');
  });

  it('ships the assets directory', () => {
    expect(pkg.files).toContain('assets');
  });

  it('ships the bridge fixtures and the labelled frame mutants (plan Reference §12)', () => {
    expect(pkg.files).toContain('conformance/bridge-cases.json');
    expect(pkg.files).toContain('conformance/frame-mutants');
  });

  it('each code entry names its types first and its ESM build second', () => {
    expect(pkg.exports['./render']).toEqual({
      types: './dist/render/index.d.ts',
      import: './dist/render/index.js',
    });
    expect(pkg.exports['./conformance']).toEqual({
      types: './dist/conformance/index.d.ts',
      import: './dist/conformance/index.js',
    });
    expect(pkg.exports['./package.json']).toBe('./package.json');
  });
});

describe('package.json: identity', () => {
  // Whether the package is private is pinned once, in test/public-ready.test.ts (L3 Task 14), so the v1 release PR
  // flips exactly one pin.
  it('is the MIT, ESM package @synapsium-labs/docserver', () => {
    expect(pkg.name).toBe('@synapsium-labs/docserver');
    expect(pkg.type).toBe('module');
    expect(pkg.license).toBe('MIT');
  });

  it('declares its modules free of side effects, but not its stylesheets', () => {
    // A bundler drops a bare import of a file the package calls side-effect free, so with `false` webpack would
    // drop `import '@synapsium-labs/docserver/assets/reader.css'` and ship no stylesheet. No module of the
    // package has a side effect on import (test/enhance-walls.test.ts and the render purity tests hold that).
    expect(pkg.sideEffects).toEqual(['*.css']);
  });

  it('engines.node is >=22', () => {
    expect(pkg.engines.node).toBe('>=22');
  });

  it('typecheck runs the whole-tree, the render-purity, the enhance (DOM), the frame runtime (DOM), the frame (no DOM) and the host (DOM) projects', () => {
    expect(pkg.scripts['typecheck']).toBe(
      'tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.render.json && tsc --noEmit -p tsconfig.enhance.json && tsc --noEmit -p tsconfig.frame-runtime.json && tsc --noEmit -p tsconfig.frame.json && tsc --noEmit -p tsconfig.host.json',
    );
  });

  // Until Task 12 exported them, these two rows pinned src/host and src/highlight OUT of the build (ledger C88(6),
  // C92(3)); with ./frame, ./host and ./highlight exported they are in it, and only the frame runtime stays out: its
  // code ships as the hashed scripts under assets/frame/, never as a module a consumer could import.
  it('the package build includes src/frame and src/host, which ./frame and ./host export (Task 12), and leaves src/frame-runtime out', () => {
    const cfg = readJson('tsconfig.build.json') as { include: string[]; exclude: string[] };
    expect(cfg.include).toEqual(['src']);
    expect(cfg.exclude).not.toContain('src/frame');
    expect(cfg.exclude).not.toContain('src/host');
    expect(cfg.exclude).toContain('src/frame-runtime');
  });

  it('the package build includes src/highlight, which ./highlight exports (Task 12); it excludes only the tests and the frame runtime', () => {
    const cfg = readJson('tsconfig.build.json') as { exclude: string[] };
    expect(cfg.exclude).not.toContain('src/highlight');
    expect(cfg.exclude).toEqual(['test', 'src/frame-runtime']);
  });
});

describe('.npmrc', () => {
  const lines = readText('.npmrc')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));

  it('has save-exact=true', () => {
    expect(lines).toContain('save-exact=true');
  });

  it('has engine-strict=true', () => {
    expect(lines).toContain('engine-strict=true');
  });
});
