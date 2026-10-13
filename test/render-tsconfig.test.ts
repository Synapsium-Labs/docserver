// The first purity wall of `./render` (docserver L1, Task 1; architecture section B): tsconfig.render.json
// typechecks src/render with lib ES2022 and no ambient types, so a host global (network, storage, DOM, Node)
// referenced there is a type error. A probe file is checked under that exact project, extended from a temporary
// directory: host globals must fail, JS intrinsics must pass. Task 12's purity test adds the import-graph scan.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const RENDER_PROJECT = path.join(ROOT, 'tsconfig.render.json');
const TYPE_ROOTS = path.join(ROOT, 'node_modules', '@types');

interface Checked {
  status: number | null;
  out: string;
}

/** Typecheck probe modules under tsconfig.render.json's compiler options, from a temporary directory. */
function checkProbes(files: Readonly<Record<string, string>>): Checked {
  const dir = mkdtempSync(path.join(tmpdir(), 'docserver-render-probe-'));
  try {
    for (const [name, source] of Object.entries(files)) writeFileSync(path.join(dir, name), source);
    writeFileSync(
      path.join(dir, 'tsconfig.json'),
      // typeRoots points at this repo's @types, so a `types` entry added to the project would resolve here
      // exactly as it does for src/render, and the probe would see what src/render would see.
      JSON.stringify({
        extends: RENDER_PROJECT,
        compilerOptions: { typeRoots: [TYPE_ROOTS] },
        include: Object.keys(files),
      }),
    );
    const r = spawnSync(
      process.execPath,
      [TSC, '--noEmit', '--pretty', 'false', '-p', path.join(dir, 'tsconfig.json')],
      { cwd: dir, encoding: 'utf8' }, // diagnostics then name the probe files relative to `dir`
    );
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The 1-based lines of `file` that carry at least one type error in `out`. */
function errorLines(out: string, file: string): number[] {
  const re = new RegExp(`^${file.replace('.', '\\.')}\\((\\d+),\\d+\\): error TS\\d+:`, 'gm');
  return [...new Set([...out.matchAll(re)].map((m) => Number(m[1])))].sort((a, b) => a - b);
}

/** Host globals that must not typecheck in src/render: one per line, so each error names its own line. */
const HOST_GLOBALS = [
  'fetch',
  'document',
  'window',
  'self',
  'navigator',
  'localStorage',
  'sessionStorage',
  'process',
  'Buffer',
  'require',
  'TextEncoder',
  'setTimeout',
  'structuredClone',
] as const;

/** JS intrinsics only: every line must typecheck. */
const CLEAN = [
  'export const ok = [',
  '  Math.max(1, 2),',
  '  JSON.stringify({ a: 1 }),',
  '  new Map<string, number>().size,',
  "  'x'.codePointAt(0),",
  '  [1, 2].at(-1),',
  "  Object.hasOwn({}, 'a'),",
  "  /a/u.test('a'),",
  '  globalThis === globalThis,',
  '];',
  '',
].join('\n');

/** One host global per line, then a host property read through globalThis: every line must fail. */
const LEAK_LINES = [
  ...HOST_GLOBALS.map((name, i) => `export const p${i} = typeof ${name};`),
  'export const viaGlobalThis = globalThis.localStorage;',
];

describe('tsconfig.render.json', () => {
  let checked: Checked = { status: null, out: '' };
  beforeAll(() => {
    checked = checkProbes({ 'clean.mts': CLEAN, 'leak.mts': `${LEAK_LINES.join('\n')}\n` });
  });

  it('names no ambient types, only lib ES2022, and covers src/render', () => {
    const project = JSON.parse(readFileSync(RENDER_PROJECT, 'utf8')) as {
      extends?: string;
      compilerOptions?: { types?: unknown; lib?: unknown; paths?: unknown };
      include?: unknown;
    };
    expect(project.extends).toBe('./tsconfig.json');
    expect(project.compilerOptions?.types).toEqual([]);
    expect(project.compilerOptions?.lib).toEqual(['ES2022']);
    // highlight.js's own declarations reference lib.dom; the purity project reads a DOM-free slice instead
    // (ruling C18; Task 12's purity test checks that no lib.dom is loaded).
    expect(project.compilerOptions?.paths).toEqual({
      'highlight.js/lib/core': ['./src/types/purity/highlight-core.d.ts'],
      'highlight.js/lib/languages/*': ['./src/types/purity/highlight-language.d.ts'],
    });
    expect(project.include).toEqual(['src/render/**/*.ts', 'src/types/**/*.d.ts']);
  });

  it('accepts a probe that uses only JS intrinsics', () => {
    expect(checked.out).toMatch(/^leak\.mts\(/m); // the checker ran over the probes
    expect(checked.out).not.toMatch(/error TS5\d\d\d:/); // and read the project without a config error
    expect(errorLines(checked.out, 'clean.mts')).toEqual([]);
  });

  it('rejects every host global, and a host property read through globalThis', () => {
    expect(checked.status).not.toBe(0);
    expect(errorLines(checked.out, 'leak.mts')).toEqual(LEAK_LINES.map((_, i) => i + 1));
  });
});
