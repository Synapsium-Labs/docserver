// The registry install of scripts/consumer-smoke.mjs (docserver L1 review). Without --deps-from the script runs
// `npm install` against the registry, and Global Constraint "Exact pins" says every version, transitive ones
// included, is at least 14 days old, so that install must carry a `--before` cutoff 14 days back, computed when
// it runs. The real install is CI's; here a stand-in `npm` on PATH records its arguments, so nothing touches a
// network. (test/pack.test.ts runs the offline mode against a real tarball.)
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SMOKE = fileURLToPath(new URL('../scripts/consumer-smoke.mjs', import.meta.url));
const DAY = 24 * 60 * 60 * 1000;

let work = '';
let args: string[] = [];
let before = 0;
let after = 0;

beforeAll(() => {
  work = mkdtempSync(path.join(tmpdir(), 'docserver-smoke-args-'));
  const bin = path.join(work, 'bin');
  const log = path.join(work, 'npm-args.txt');
  mkdirSync(bin);
  writeFileSync(path.join(bin, 'npm'), '#!/bin/sh\nprintf \'%s\\n\' "$@" > "$NPM_ARGS_FILE"\nexit 0\n');
  chmodSync(path.join(bin, 'npm'), 0o755);
  before = Date.now();
  spawnSync(process.execPath, [SMOKE, path.join(work, 'fake.tgz')], {
    cwd: work,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env['PATH'] ?? ''}`, NPM_ARGS_FILE: log },
  });
  after = Date.now();
  args = readFileSync(log, 'utf8').split('\n').filter((l) => l !== '');
});

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
