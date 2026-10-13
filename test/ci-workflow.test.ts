// The first CI workflow, .github/workflows/ci.yml (docserver L1, Task 1). Read as data with js-yaml (YAML 1.2
// core: `on` stays the string "on"). The required-check names branch protection would match are the job
// names, `test (22)` and `test (24)`, so the name template and the matrix are pinned together. Task 12 appends
// the ratchet and the packed-consumer smoke to the step list below, and nothing else.
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

interface Step {
  name?: string;
  uses?: string;
  with?: Record<string, unknown>;
  run?: string;
}
interface Job {
  name?: string;
  'runs-on'?: string;
  'timeout-minutes'?: number;
  permissions?: unknown;
  strategy?: { 'fail-fast'?: boolean; matrix?: { node?: unknown } };
  steps?: Step[];
}
interface Workflow {
  on?: Record<string, unknown>;
  permissions?: unknown;
  jobs?: Record<string, Job>;
}

const TEXT = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const wf = load(TEXT) as Workflow;
const jobs = wf.jobs ?? {};
const test = jobs['test'] ?? {};
const steps = test.steps ?? [];

describe('ci.yml: permissions', () => {
  it('the workflow token is read-only', () => {
    expect(wf.permissions).toEqual({ contents: 'read' });
  });

  it('no job widens the token', () => {
    expect(Object.values(jobs).filter((j) => j.permissions !== undefined)).toEqual([]);
  });
});

describe('ci.yml: triggers', () => {
  it('runs on pushes to main, on pull requests and by hand', () => {
    expect(Object.keys(wf.on ?? {}).sort()).toEqual(['pull_request', 'push', 'workflow_dispatch']);
    expect(wf.on?.['push']).toEqual({ branches: ['main'] });
  });
});

describe('ci.yml: the test job', () => {
  it('is the only job', () => {
    expect(Object.keys(jobs)).toEqual(['test']);
  });

  it('runs on Node 22 and 24, both legs to the end, within 30 minutes', () => {
    expect(test.name).toBe('test (${{ matrix.node }})');
    expect(test['runs-on']).toBe('ubuntu-latest');
    expect(test['timeout-minutes']).toBe(30);
    expect(test.strategy?.['fail-fast']).toBe(false);
    expect(test.strategy?.matrix?.node).toEqual([22, 24]);
  });

  it('checks out full history and sets up the matrix Node with the npm cache', () => {
    expect(steps.filter((s) => s.uses !== undefined).map((s) => [s.uses, s.with])).toEqual([
      ['actions/checkout@v4', { 'fetch-depth': 0 }],
      ['actions/setup-node@v4', { 'node-version': '${{ matrix.node }}', cache: 'npm' }],
    ]);
  });

  it('installs from the lock, typechecks, tests with the local vitest, then builds', () => {
    expect(steps.filter((s) => s.run !== undefined).map((s) => s.run)).toEqual([
      'npm ci --no-audit --no-fund',
      'npm run typecheck',
      './node_modules/.bin/vitest run',
      'npm run build',
    ]);
  });

  it('never runs a bare npx vitest and never sets UPDATE_EXPECTED', () => {
    expect(TEXT).not.toMatch(/npx\s+vitest/);
    expect(TEXT).not.toMatch(/UPDATE_EXPECTED/);
  });
});
