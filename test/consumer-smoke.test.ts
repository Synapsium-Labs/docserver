// The registry install of scripts/consumer-smoke.mjs (docserver L1 review). Without --deps-from the script runs
// `npm install` against the registry, and Global Constraint "Exact pins" says every version, transitive ones
// included, is at least 14 days old, so that install must carry a `--before` cutoff 14 days back, computed when
// it runs. The real install is CI's; here a stand-in `npm` on PATH records its arguments, so nothing touches a
// network. (test/pack.test.ts runs the offline mode against a real tarball.)
//
// After the install the smoke typechecks a consumer file that imports both entries, under the flags a strict
// consumer uses (strict, nodenext, skipLibCheck: false), so a packed declaration that cannot resolve its own
// imports fails the smoke (review 458, F7). The stand-in `npm` here also writes a tiny fake package into the
// consumer's node_modules, so that step runs against declarations this test controls.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SpawnSyncReturns } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SMOKE = fileURLToPath(new URL('../scripts/consumer-smoke.mjs', import.meta.url));
const DAY = 24 * 60 * 60 * 1000;

const SOURCE = readFileSync(SMOKE, 'utf8');
const PACKAGE = '@synapsium-labs/docserver';

/**
 * A stand-in `npm`: records its arguments, then, when FAKE_KIND is set, installs a fake package into the consumer
 * (its working directory) whose declarations are `clean`; or import a module that does not exist (`dangling`); or
 * lack the conformance entry's `runCorpus` (`no-run-corpus`); omit `goToHash` (`missing-go-to-hash`); give it
 * incompatible parameter types (`wrong-go-to-hash`); or are clean at both entries while a third file, one neither
 * entry reaches, imports a module that does not exist (`dangling-unreached`).
 */
const FAKE_NPM = `#!${process.execPath}
const { appendFileSync, mkdirSync, writeFileSync } = require('node:fs');
appendFileSync(process.env.NPM_ARGS_FILE, process.argv.slice(2).map((a) => a + '\\n').join(''));
const kind = process.env.FAKE_KIND;
if (kind) {
  const dir = process.cwd() + '/node_modules/${PACKAGE}';
  const render = [
    'export interface RenderResult { html: string }',
    'export declare function render(markdown: string): RenderResult;',
    'export declare const ALLOWLIST: readonly string[];',
  ];
  if (kind === 'dangling') render.unshift("import type { Nope } from 'no-such-module';", 'export type Dangling = Nope;');
  if (kind === 'dangling-unreached') {
    mkdirSync(dir + '/dist/render', { recursive: true });
    writeFileSync(dir + '/dist/render/unreached.d.ts', "import type { Nope } from 'no-such-module';\\nexport type Unreached = Nope;\\n");
  }
  const conformance = ['export interface CorpusRun { ok: boolean }'];
  if (kind !== 'no-run-corpus') conformance.push('export declare function runCorpus(render: unknown, o?: { timeScale?: number }): CorpusRun;');
  const enhance = [
    'export interface EnhanceOptions { prefs?: { theme?: string }; folds?: boolean; signal?: AbortSignal }',
    'export declare function enhance(root: Element, o?: EnhanceOptions): Promise<void>;',
    'export declare function destroyEnhancement(root: Element): Promise<void>;',
    'export declare function setEnhancementPrefs(root: Element, p: { theme?: string }): void;',
    'export declare class EnhanceError extends Error {}',
  ];
  if (kind === 'wrong-go-to-hash') enhance.push('export declare function goToHash(root: string, id: number, from?: number): void;');
  else if (kind !== 'missing-go-to-hash') enhance.push('export declare function goToHash(root: HTMLElement, id: string | null, from?: string | null): void;');
  for (const [sub, lines] of [['render', render], ['conformance', conformance], ['enhance', enhance]]) {
    mkdirSync(dir + '/dist/' + sub, { recursive: true });
    writeFileSync(dir + '/dist/' + sub + '/index.d.ts', lines.join('\\n') + '\\n');
    writeFileSync(dir + '/dist/' + sub + '/index.js', '');
  }
  writeFileSync(dir + '/package.json', JSON.stringify({
    name: '${PACKAGE}', version: '0.0.0', type: 'module',
    exports: { './render': { types: './dist/render/index.d.ts', import: './dist/render/index.js' },
               './conformance': { types: './dist/conformance/index.d.ts', import: './dist/conformance/index.js' },
               './enhance': { types: './dist/enhance/index.d.ts', import: './dist/enhance/index.js' } },
  }));
}
`;

let work = '';
let args: string[] = [];
let before = 0;
let after = 0;
const typed = new Map<string, SpawnSyncReturns<string>>();

/** Run the smoke with the stand-in npm installing the fake package of this kind. */
function runTyped(kind: string): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [SMOKE, path.join(work, 'fake.tgz')], {
    cwd: work,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${path.join(work, 'bin')}${path.delimiter}${process.env['PATH'] ?? ''}`,
      NPM_ARGS_FILE: path.join(work, 'npm-args-typed.txt'),
      FAKE_KIND: kind,
    },
  });
}

beforeAll(() => {
  work = mkdtempSync(path.join(tmpdir(), 'docserver-smoke-args-'));
  const bin = path.join(work, 'bin');
  const log = path.join(work, 'npm-args.txt');
  mkdirSync(bin);
  writeFileSync(path.join(bin, 'npm'), FAKE_NPM);
  chmodSync(path.join(bin, 'npm'), 0o755);
  before = Date.now();
  spawnSync(process.execPath, [SMOKE, path.join(work, 'fake.tgz')], {
    cwd: work,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env['PATH'] ?? ''}`, NPM_ARGS_FILE: log },
  });
  after = Date.now();
  args = readFileSync(log, 'utf8').split('\n').filter((l) => l !== '');
  for (const kind of ['clean', 'dangling', 'dangling-unreached', 'no-run-corpus', 'missing-go-to-hash', 'wrong-go-to-hash']) typed.set(kind, runTyped(kind));
}, 120_000);

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

describe('scripts/consumer-smoke.mjs: the registry install', () => {
  it('installs the tarball with npm install, no scripts and no save', () => {
    expect(args.slice(0, 5)).toEqual(['install', '--no-save', '--no-audit', '--no-fund', '--ignore-scripts']);
    expect(args.at(-1)).toBe(path.join(work, 'fake.tgz'));
  });

  it('carries a --before cutoff 14 days back from when it runs, so transitive dependencies obey the age rule', () => {
    const flags = args.filter((a) => a.startsWith('--before='));
    expect(flags).toHaveLength(1);
    const cutoff = (flags[0] ?? '').slice('--before='.length);
    expect(cutoff).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const at = Date.parse(cutoff);
    expect(at).toBeGreaterThanOrEqual(before - 14 * DAY);
    expect(at).toBeLessThanOrEqual(after - 14 * DAY);
  });
});

describe('scripts/consumer-smoke.mjs: the strict consumer typecheck', () => {
  const STRICT = 'consumer-smoke: the packed declarations typecheck under strict, nodenext and skipLibCheck: false';

  it('typechecks a consumer file that imports both entries, with the flags a strict consumer uses', () => {
    expect(typed.get('clean')?.stdout).toContain(`${STRICT}\n`);
    expect(typed.get('clean')?.stderr).not.toMatch(/error TS/);
  });

  it('fails the smoke, naming the error, when a packed declaration cannot resolve its own import', () => {
    const r = typed.get('dangling');
    expect(r?.status).toBe(1);
    expect(r?.stdout).not.toContain(STRICT);
    expect(r?.stderr).toMatch(/dist\/render\/index\.d\.ts\(\d+,\d+\): error TS2307: Cannot find module 'no-such-module'/);
  });

  it('typechecks every packed declaration file, not only the ones the two entries reach', () => {
    const r = typed.get('dangling-unreached');
    expect(r?.status).toBe(1);
    expect(r?.stdout).not.toContain(STRICT);
    expect(r?.stderr).toMatch(/dist\/render\/unreached\.d\.ts\(\d+,\d+\): error TS2307: Cannot find module 'no-such-module'/);
  });

  it('fails the smoke when the conformance entry lacks a value the consumer file uses', () => {
    const r = typed.get('no-run-corpus');
    expect(r?.status).toBe(1);
    expect(r?.stdout).not.toContain(STRICT);
    expect(r?.stderr).toMatch(/check\.ts\(\d+,\d+\): error TS2305: .*runCorpus/);
  });

  it('fails the smoke when the enhance entry omits goToHash', () => {
    const r = typed.get('missing-go-to-hash');
    expect(r?.status).toBe(1);
    expect(r?.stdout).not.toContain(STRICT);
    expect(r?.stderr).toMatch(/check\.ts\(\d+,\d+\): error TS2305: .*goToHash/);
  });

  it('fails the smoke when goToHash cannot accept consumer calls', () => {
    const r = typed.get('wrong-go-to-hash');
    expect(r?.status).toBe(1);
    expect(r?.stdout).not.toContain(STRICT);
    expect(r?.stderr).toMatch(/check\.ts\(\d+,\d+\): error TS2345: .*HTMLElement.*string/);
  });

  it('writes the consumer tsconfig with the strict flags and the check importing both entries', () => {
    expect(SOURCE).toMatch(/strict: true,/);
    expect(SOURCE).toMatch(/module: 'nodenext',/);
    expect(SOURCE).toMatch(/moduleResolution: 'nodenext',/);
    expect(SOURCE).toMatch(/skipLibCheck: false,/);
    expect(SOURCE).toMatch(/noEmit: true,/);
    expect(SOURCE).toContain('include: [\'check.ts\', `node_modules/${PACKAGE}/dist/**/*.d.ts`],');
    expect(SOURCE).toContain("from '${PACKAGE}/render'");
    expect(SOURCE).toContain("from '${PACKAGE}/conformance'");
    expect(SOURCE).toContain("from '${PACKAGE}/enhance'");
    expect(SOURCE).toContain('goToHash(root, \'section\');');
    expect(SOURCE).toContain('goToHash(root, null, \'from-token\');');
    expect(SOURCE).toContain("lib: ['es2022', 'dom'],");
  });
});
