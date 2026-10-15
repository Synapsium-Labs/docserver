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
  private: boolean;
  type: string;
  license: string;
  sideEffects: boolean;
  engines: { node: string };
  exports: Record<string, unknown>;
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
  it('exposes exactly ./render, ./conformance and ./package.json', () => {
    expect(Object.keys(pkg.exports).sort()).toEqual(['./conformance', './package.json', './render']);
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
  it('is the private, MIT, ESM package @synapsium-labs/docserver', () => {
    expect(pkg.name).toBe('@synapsium-labs/docserver');
    expect(pkg.private).toBe(true);
    expect(pkg.type).toBe('module');
    expect(pkg.license).toBe('MIT');
    expect(pkg.sideEffects).toBe(false);
  });

  it('engines.node is >=22', () => {
    expect(pkg.engines.node).toBe('>=22');
  });

  it('typecheck runs both the whole-tree and the render-purity projects', () => {
    expect(pkg.scripts['typecheck']).toBe(
      'tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.render.json',
    );
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
