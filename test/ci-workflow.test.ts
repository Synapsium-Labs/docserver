// The first CI workflow, .github/workflows/ci.yml (docserver L1, Task 1). Read as data with js-yaml (YAML 1.2
// core: `on` stays the string "on"). The required-check names branch protection would match are the job
// names, `test (22)` and `test (24)`, so the name template and the matrix are pinned together. Task 12 appended
// the verdict ratchet (against the pull request's base branch, the push's previous tip, or origin/main by hand)
// and the packed-consumer smoke (npm pack, then scripts/consumer-smoke.mjs on the tarball npm names from
// package.json). L2 Task 6 installs the pinned browsers, with their system libraries, before the tests, so the
// layout project runs in Chromium and WebKit; CI never narrows that with DOCREADER_BROWSERS, and fails when the
// tests leave conformance/layout/ changed. The install command is one constant (scripts/visual/compare.mjs's
// INSTALL, which the layout tests' harness re-exports), and the CI step and the README name it.
//
// L3 Task 17 hardens that install against a stalling package mirror (rows L3.CI1 to L3.CI4): apt retries and
// short timeouts, a browser cache keyed on the runner (its OS, its architecture and its OS release, which together
// pick the browser builds playwright-core downloads) and the pinned playwright-core, at most two bounded install
// attempts inside a step timeout, a 45-minute job, and every remote action pinned by full commit sha with its tag
// in a trailing comment (release.yml reuses this workflow, so it holds no local `uses:`). The three shell steps
// that carry those rules are run here, in bash as GitHub runs a `run:` step (`bash -e`), with fake `sudo`, `tee`
// and `npx` first on PATH, and the version step reading a fixture in place of /etc/os-release, so their behaviour is
// measured rather than their text only.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SpawnSyncReturns } from 'node:child_process';
import { load } from 'js-yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INSTALL } from '../scripts/visual/compare.mjs';

interface Step {
  name?: string;
  id?: string;
  uses?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
  run?: string;
  'timeout-minutes'?: number;
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

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEXT = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const wf = load(TEXT) as Workflow;
const jobs = wf.jobs ?? {};
const test = jobs['test'] ?? {};
const steps = test.steps ?? [];
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  name: string;
  version: string;
  devDependencies?: Record<string, string>;
};

/**
 * The apt configuration file the CI step writes, and the values it sets (L3.CI1). The lock timeout lets the install's
 * second attempt wait for an apt-get the first attempt's timeout left running under sudo, instead of failing at once on
 * the dpkg lock and wasting the retry.
 */
const APT_CONF = '/etc/apt/apt.conf.d/80-docserver-ci';
const APT_LINES = ['Acquire::Retries "5";', 'Acquire::http::Timeout "30";', 'Acquire::https::Timeout "30";', 'DPkg::Lock::Timeout "300";'];
/** The browser directory, as the cache step's path names it: the version step's third output (L3.CI3). */
const BROWSER_DIR = '${{ steps.playwright.outputs.browsers }}';
/**
 * The cache key (L3.CI3). playwright-core picks its browser builds by architecture and by the ID and VERSION_ID of
 * /etc/os-release (a WebKit build for one Ubuntu release is not the build for the next), and an install that finds a
 * restored build never downloads it again; so the key names the runner's architecture and OS release, or a moved
 * `ubuntu-latest` would restore builds made for the release before it.
 */
const CACHE_KEY =
  'ms-playwright-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}';
/** The file the version step reads the OS release from; the behaviour rows give the step a fixture in its place. */
const OS_RELEASE = '/etc/os-release';
/** The ratchet's exact command: its base is the BASE the step's env computes (pull request, push or by hand). */
const RATCHET_RUN = 'node scripts/ratchet.mjs --base "${BASE}"';
/** A remote action reference pinned by a full commit sha: `owner/repo[/path]@<40 hex>`. */
const SHA_PINNED = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[^@\s]+)?@[0-9a-f]{40}$/;

const installAt = steps.findIndex((s) => s.run?.includes(INSTALL) === true);
const install = steps[installAt];
const aptAt = steps.findIndex((s) => s.run?.includes(APT_CONF) === true);
const apt = steps[aptAt];
const cacheAt = steps.findIndex((s) => s.uses?.startsWith('actions/cache@') === true);
const cache = steps[cacheAt];
const versionAt = steps.findIndex((s) => s.run?.includes("devDependencies['playwright-core']") === true);
const version = steps[versionAt];

let work = '';
let bin = '';

/**
 * Runs one step's script as GitHub runs a `run:` step on Linux (`bash -e`), with the fakes first on PATH. A
 * variable given as undefined is removed from the environment.
 */
function runStep(script: string, env: Record<string, string | undefined>, cwd = ROOT): SpawnSyncReturns<string> {
  const all: Record<string, string | undefined> = { ...process.env, PATH: `${bin}${path.delimiter}${process.env['PATH'] ?? ''}`, ...env };
  for (const [k, v] of Object.entries(all)) if (v === undefined) delete all[k];
  return spawnSync('bash', ['-e', '-c', script], { cwd, encoding: 'utf8', timeout: 60_000, env: all });
}

function fake(name: string, body: string): void {
  writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}`);
  chmodSync(path.join(bin, name), 0o755);
}

beforeAll(() => {
  work = mkdtempSync(path.join(tmpdir(), 'docserver-ci-steps-'));
  bin = path.join(work, 'bin');
  mkdirSync(bin);
  // sudo runs its command as the caller; tee records its arguments and what it was given, and writes nothing else.
  fake('sudo', 'exec "$@"\n');
  fake('tee', 'printf \'%s\\n\' "$@" > "$TEE_ARGS"\ncat > "$TEE_IN"\n');
  // npx records each call; FAKE_NPX says whether it succeeds always, never, or from its second call on.
  fake(
    'npx',
    'printf \'%s\\n\' "$*" >> "$NPX_LOG"\n' +
      'n=$(wc -l < "$NPX_LOG")\n' +
      'case "$FAKE_NPX" in ok) exit 0 ;; fail) exit 1 ;; second) [ "$n" -ge 2 ] && exit 0; exit 1 ;; esac\n' +
      'exit 3\n',
  );
});

/** Writes an os-release fixture: the fields /etc/os-release carries, ID and VERSION_ID only when given. */
function osRelease(id: string | undefined, versionId: string | undefined): string {
  const file = mkdtempSync(path.join(work, 'os-release-'));
  const lines = ['NAME="Fixture"', 'PRETTY_NAME="Fixture OS"', 'VERSION="fixture"'];
  if (id !== undefined) lines.push(`ID=${id}`);
  if (versionId !== undefined) lines.push(`VERSION_ID=${versionId}`);
  writeFileSync(path.join(file, 'os-release'), `${lines.join('\n')}\n`);
  return path.join(file, 'os-release');
}

/** The version step's script, reading `file` in place of /etc/os-release, which it names exactly once. */
function versionStep(file: string): string {
  const run = version?.run ?? 'exit 9';
  expect(run.split(OS_RELEASE)).toHaveLength(2);
  return run.replace(OS_RELEASE, () => file);
}

afterAll(() => {
  if (work !== '') rmSync(work, { recursive: true, force: true });
});

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

  it('runs on Node 22 and 24, both legs to the end, within 45 minutes (L3.CI2: two install attempts and the suite fit)', () => {
    expect(test.name).toBe('test (${{ matrix.node }})');
    expect(test['runs-on']).toBe('ubuntu-latest');
    expect(test['timeout-minutes']).toBe(45);
    expect(test.strategy?.['fail-fast']).toBe(false);
    expect(test.strategy?.matrix?.node).toEqual([22, 24]);
  });

  it('checks out full history, keeps no credentials in the workspace, sets up the matrix Node with the npm cache, and caches the browsers, each action pinned by commit sha', () => {
    expect(steps.filter((s) => s.uses !== undefined).map((s) => [s.uses, s.with])).toEqual([
      ['actions/checkout@11d5960a326750d5838078e36cf38b85af677262', { 'fetch-depth': 0, 'persist-credentials': false }],
      ['actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020', { 'node-version': '${{ matrix.node }}', cache: 'npm' }],
      [
        'actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9',
        { path: BROWSER_DIR, key: CACHE_KEY },
      ],
    ]);
  });

  it('installs from the lock, reads the playwright-core pin, restores the browser cache, configures apt, installs the browsers, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball', () => {
    expect(steps.map((s) => s.uses?.replace(/@.*$/, '') ?? s.name ?? s.run)).toEqual([
      'actions/checkout',
      'actions/setup-node',
      'npm ci --no-audit --no-fund',
      "the pinned playwright-core version, the runner's OS release and the browser directory",
      'actions/cache',
      'apt retries and timeouts',
      'install the pinned browsers and their system libraries',
      'npm run typecheck',
      './node_modules/.bin/vitest run',
      'the tests wrote no layout snapshot',
      'npm run build',
      'ratchet',
      'npm pack',
      `node scripts/consumer-smoke.mjs ./${pkg.name.replace(/^@/, '').replace('/', '-')}-${pkg.version}.tgz`,
    ]);
  });

  it('the ratchet reads from the base branch on a pull request, the previous tip on a push, main by hand', () => {
    // A push may add several commits; comparing with HEAD^ alone would read only the last of them. The step is
    // found by its name and its command pinned exactly, so a command that drops the base or ignores the ratchet's
    // result is red, not only an env that changes.
    const ratchet = steps.find((s) => s.name === 'ratchet');
    expect(steps.filter((s) => s.name === 'ratchet' || s.run?.includes('scripts/ratchet.mjs') === true)).toEqual([ratchet]);
    expect(ratchet?.run).toBe(RATCHET_RUN);
    expect(ratchet?.env).toEqual({
      BASE:
        "${{ github.event_name == 'pull_request' && format('origin/{0}', github.base_ref) || " +
        "github.event_name == 'push' && github.event.before != '0000000000000000000000000000000000000000' && " +
        "github.event.before || github.event_name == 'push' && 'HEAD^' || 'origin/main' }}",
    });
    expect(steps.filter((s) => s.env !== undefined)).toHaveLength(1);
  });

  it('installs the browsers with the one install command the harness, the compare script and the README name', () => {
    expect(steps.filter((s) => s.run?.includes(INSTALL) === true)).toHaveLength(1);
    expect(install?.run?.split(INSTALL)).toHaveLength(2);
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    expect(readme).toContain(`\`${INSTALL}\``);
  });

  it('the step after the tests fails when they leave conformance/layout/ changed', () => {
    const at = steps.findIndex((s) => s.run === './node_modules/.bin/vitest run');
    expect(steps[at + 1]).toEqual({ name: 'the tests wrote no layout snapshot', run: 'test -z "$(git status --porcelain -- conformance/layout)"' });
  });

  it('never runs a bare npx vitest, never sets UPDATE_EXPECTED or UPDATE_LAYOUT, and never narrows the browsers', () => {
    expect(TEXT).not.toMatch(/npx\s+vitest/);
    expect(TEXT).not.toMatch(/UPDATE_EXPECTED/);
    expect(TEXT).not.toMatch(/UPDATE_LAYOUT/);
    expect(TEXT.replace(/^\s*#.*$/gm, '')).not.toMatch(/DOCREADER_BROWSERS/);
  });
});

describe('ci.yml: the browser install survives a stalling package mirror (L3 Task 17)', () => {
  it('L3.CI1: an apt step before the install writes the retries and the two timeouts to its own apt configuration file', () => {
    expect(aptAt).toBeGreaterThan(-1);
    expect(aptAt).toBeLessThan(installAt);
    const r = runStep(apt?.run ?? 'exit 9', {
      TEE_ARGS: path.join(work, 'tee-args.txt'),
      TEE_IN: path.join(work, 'tee-in.txt'),
    });
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(path.join(work, 'tee-args.txt'), 'utf8')).toBe(`${APT_CONF}\n`);
    expect(readFileSync(path.join(work, 'tee-in.txt'), 'utf8')).toBe(`${APT_LINES.join('\n')}\n`);
  });

  it('L3.CI2: the install step runs INSTALL under `timeout -k 30 600`, in a loop of exactly two attempts that both fit in its own step timeout', () => {
    expect(installAt).toBeGreaterThan(-1);
    expect(install?.name).toBe('install the pinned browsers and their system libraries');
    expect(install?.run).toContain(`timeout -k 30 600 ${INSTALL}`);
    expect(install?.['timeout-minutes']).toBe(22);
    const bound = /timeout -k (\d+) (\d+) /.exec(install?.run ?? '');
    const perAttempt = Number(bound?.[1]) + Number(bound?.[2]);
    expect(2 * perAttempt).toBeLessThan(22 * 60);
  });

  it.each([
    ['fails twice: two attempts, then the step fails', 'fail', 2, false],
    ['succeeds at once: one attempt', 'ok', 1, true],
    ['fails, then succeeds: two attempts, and the step passes', 'second', 2, true],
  ])('L3.CI2: an install that %s', (_what, mode, attempts, passes) => {
    const log = path.join(work, `npx-${mode}.txt`);
    writeFileSync(log, '');
    const r = runStep(install?.run ?? 'exit 9', { NPX_LOG: log, FAKE_NPX: mode });
    expect(r.status === 0, r.stdout + r.stderr).toBe(passes);
    const calls = readFileSync(log, 'utf8').split('\n').filter((l) => l !== '');
    expect(calls).toEqual(Array.from({ length: attempts }, () => INSTALL.replace(/^npx /, '')));
  });

  it('L3.CI3: the cache step restores the Playwright browser directory before the install, keyed on the runner OS, architecture and OS release and the pinned playwright-core version, with no fallback key', () => {
    expect(cacheAt).toBeGreaterThan(-1);
    expect(cacheAt).toBeLessThan(installAt);
    expect(versionAt).toBeGreaterThan(-1);
    expect(versionAt).toBeLessThan(cacheAt);
    expect(version?.id).toBe('playwright');
    expect(cache?.with?.['path']).toBe(BROWSER_DIR);
    const key = String(cache?.with?.['key']);
    expect(key).toContain('${{ runner.os }}');
    expect(key).toContain('${{ runner.arch }}');
    expect(key).toContain('${{ steps.playwright.outputs.os }}');
    expect(key).toContain('${{ steps.playwright.outputs.version }}');
    expect(Object.keys(cache?.with ?? {}).sort()).toEqual(['key', 'path']);
  });

  it.each([
    ['with XDG_CACHE_HOME unset: .cache/ms-playwright under HOME', undefined, 'home/.cache/ms-playwright'],
    ['with XDG_CACHE_HOME set: ms-playwright under it', 'xdg', 'xdg/ms-playwright'],
  ])('L3.CI3: the version step reads exactly the playwright-core pin from package.json, so the key embeds it, and names the directory playwright-core installs into %s', (_what, xdg, dir) => {
    const pinned = pkg.devDependencies?.['playwright-core'] ?? '';
    expect(pinned).toMatch(/^\d+\.\d+\.\d+$/);
    const out = path.join(work, 'github-output.txt');
    writeFileSync(out, '');
    const r = runStep(versionStep(osRelease('ubuntu', '"24.04"')), {
      GITHUB_OUTPUT: out,
      HOME: path.join(work, 'home'),
      XDG_CACHE_HOME: xdg === undefined ? undefined : path.join(work, xdg),
    });
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(out, 'utf8')).toBe(`version=${pinned}\nos=ubuntu24.04\nbrowsers=${path.join(work, dir)}\n`);
  });

  it.each([
    ['Ubuntu 22.04', 'ubuntu', '"22.04"', 'ubuntu22.04'],
    ['Ubuntu 24.04', 'ubuntu', '"24.04"', 'ubuntu24.04'],
    ['Ubuntu 26.04, unquoted', 'ubuntu', '26.04', 'ubuntu26.04'],
    ['Debian 12', 'debian', '"12"', 'debian12'],
  ])('L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: %s', (_what, id, versionId, os) => {
    const out = path.join(work, 'github-output.txt');
    writeFileSync(out, '');
    const r = runStep(versionStep(osRelease(id, versionId)), { GITHUB_OUTPUT: out, HOME: path.join(work, 'home'), XDG_CACHE_HOME: undefined });
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(out, 'utf8').split('\n').filter((l) => l.startsWith('os='))).toEqual([`os=${os}`]);
  });

  it.each([
    ['a range', '^1.63.0', 'ok'],
    ['a missing pin', undefined, 'ok'],
    ['an OS release with no VERSION_ID', '1.63.0', 'no-version-id'],
    ['an OS release with no ID', '1.63.0', 'no-id'],
    ['no OS release file', '1.63.0', 'absent'],
    ['an OS release with no ID or VERSION_ID, while the environment carries both', '1.63.0', 'empty-env'],
  ])('L3.CI3: the version step fails, and writes no key part, on %s (never a floating key)', (_what, range, release) => {
    expect(version?.run ?? '').toContain("devDependencies['playwright-core']");
    const dir = mkdtempSync(path.join(work, 'pkg-'));
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ devDependencies: range === undefined ? {} : { 'playwright-core': range } }));
    const out = path.join(dir, 'github-output.txt');
    writeFileSync(out, '');
    const file =
      release === 'ok'
        ? osRelease('ubuntu', '"24.04"')
        : release === 'no-version-id'
          ? osRelease('ubuntu', undefined)
          : release === 'no-id'
            ? osRelease(undefined, '"24.04"')
            : release === 'empty-env'
              ? osRelease(undefined, undefined)
              : path.join(dir, 'no-such-os-release');
    // The step reads the two fields from the file alone: values the environment carries never stand in for them.
    const inherited = release === 'empty-env' ? { ID: 'ubuntu', VERSION_ID: '22.04' } : { ID: undefined, VERSION_ID: undefined };
    const r = runStep(versionStep(file), { GITHUB_OUTPUT: out, ...inherited }, dir);
    expect(r.status).not.toBe(0);
    expect(readFileSync(out, 'utf8')).toBe('');
  });

  it('L3.CI4: every remote `uses:` is a full commit sha with its release tag in a trailing comment, and ci.yml holds no local `uses:`', () => {
    const lines = TEXT.split('\n').filter((l) => /^\s*(?:-\s+)?uses:/.test(l));
    expect(lines).toHaveLength(steps.filter((s) => s.uses !== undefined).length);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const m = /^\s*(?:-\s+)?uses:\s+(\S+)\s+#\s+(v\d+\.\d+\.\d+)\s*$/.exec(line);
      expect(m, line).not.toBeNull();
      expect(m?.[1], line).toMatch(SHA_PINNED);
    }
    expect(steps.filter((s) => s.uses?.startsWith('./') === true)).toEqual([]);
    expect(TEXT).not.toMatch(/uses:\s*['"]?\.\//);
  });

  it('L3.CI4: each pin names the release its tag comment names', () => {
    expect(TEXT).toContain('uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0');
    expect(TEXT).toContain('uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0');
    expect(TEXT).toContain('uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0');
  });
});
