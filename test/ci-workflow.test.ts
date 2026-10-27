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
//
// Task 17's follow-up (rows L3.CI5 to L3.CI7) answers a measured failure: the browser cache hit, but the system
// libraries `--with-deps` installs were downloaded again on every job, from a mirror that stalled; attempt 1 timed out,
// and its `sudo apt-get` outlived the timeout and held the dpkg lock until attempt 2 gave up waiting for it. So apt's
// archive cache now lives in a runner-owned directory (named once, by the version step, under /var/cache, where apt's
// download user can reach it, and made by the apt step before any cache restores into it) that the apt configuration
// file points at and a second sha-pinned cache step restores and saves (a week-rolled key, falling back to the last
// week's entry, so packages Ubuntu updates join the cache), and a step after the install makes its files readable for
// that save; and before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a short wait, then
// KILL, by exact process name, under sudo) and runs `sudo timeout ... dpkg --configure -a`, bounded so that both
// attempts still fit the step limit. The fakes `pkill`, `sleep`, `dpkg` and `date` stand in for those (so no row ever
// signals a real process), and every fake that the apt step or the install's cleanup reaches, `sudo` included, records
// its call in one ordered log.
import { spawnSync } from 'node:child_process';
import { accessSync, chmodSync, constants as fsConstants, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
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
/**
 * The lines the follow-up adds to the same file (L3.CI5): apt-get keeps what it downloads, in the runner-owned archive
 * directory the cache step restores and saves (with a trailing slash, as apt writes a directory).
 */
function archiveLines(dir: string): string[] {
  return ['APT::Keep-Downloaded-Packages "true";', `Dir::Cache::Archives "${dir}/";`];
}
/** The browser directory, as the cache step's path names it: the version step's third output (L3.CI3). */
const BROWSER_DIR = '${{ steps.playwright.outputs.browsers }}';
/** apt's archive directory, as the apt cache step's path and the two steps' ARCHIVES name it: the version step's fourth output (L3.CI5, L3.CI6). */
const ARCHIVES_DIR = '${{ steps.playwright.outputs.archives }}';
/**
 * The directory the version step names (L3.CI5): under /var/cache, apt's own cache root, which apt's download user
 * (`_apt`) can traverse. Under the runner's home (RUNNER_TEMP, say) a home directory closed to other users would make
 * apt drop its download sandbox and fetch every .deb as root. The apt step makes it, owned by the runner, before the
 * cache step restores into it.
 */
const ARCHIVES_PATH = '/var/cache/docserver-apt-archives';
/**
 * The apt cache's restore prefix (L3.CI6): the browser key's inputs, which also decide the system libraries
 * `--with-deps` installs. The key adds the ISO week, so a job in a new week restores the last entry under the prefix
 * and saves a fresh one holding the package versions Ubuntu published since; an exact key alone is saved once and never
 * again, and a warm job would fetch every updated package from the mirror for as long as the pin stood.
 */
const APT_CACHE_PREFIX =
  'apt-archives-${{ runner.os }}-${{ runner.arch }}-${{ steps.playwright.outputs.os }}-playwright-core-${{ steps.playwright.outputs.version }}-';
const APT_CACHE_KEY = `${APT_CACHE_PREFIX}\${{ steps.playwright.outputs.week }}`;
/** The ISO week the fake `date` answers, unless a row gives another. */
const WEEK = '2026-W44';
/** The step after the install that makes the cached files readable for the cache's save (L3.CI6). */
const READABLE = 'the apt archive cache is readable for its save';
/**
 * What the install step does before attempt 2, and only then (L3.CI7), as the fakes record it: each `sudo` call is
 * followed by the command it ran. A leftover apt-get or dpkg is stopped by exact name, TERM first and KILL after a
 * short wait, then dpkg finishes any interrupted configuration, so attempt 2 is not refused by attempt 1's lock. That
 * configuration runs under a `timeout` of its own, inside sudo so the bound reaches the root process, and the bound is
 * counted in the step's budget (L3.CI2).
 */
const STOP = '-x apt-get|dpkg';
const CLEANUP = [
  `sudo pkill -TERM ${STOP}`,
  `pkill -TERM ${STOP}`,
  'sleep 5',
  `sudo pkill -KILL ${STOP}`,
  `pkill -KILL ${STOP}`,
  'sudo timeout -k 5 40 dpkg --configure -a',
  'dpkg --configure -a',
];
/**
 * What the step budget leaves for the two `sudo pkill` calls, the only commands between the attempts that carry no
 * bound of their own (each sends one signal and returns).
 */
const PKILL_ALLOWANCE_S = 10;
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
const cacheAt = steps.findIndex((s) => s.uses?.startsWith('actions/cache@') === true && s.with?.['path'] === BROWSER_DIR);
const cache = steps[cacheAt];
const aptCacheAt = steps.findIndex((s) => s.uses?.startsWith('actions/cache@') === true && s.with?.['path'] === ARCHIVES_DIR);
const aptCache = steps[aptCacheAt];
const readableAt = steps.findIndex((s) => s.name === READABLE);
const readable = steps[readableAt];
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

/**
 * Runs a step that never reads the checkout in a fresh scratch directory instead, so a mutant that lets a relative path
 * through (mkdir -p of a relative archive directory, say) writes nothing into the worktree.
 */
function runIn(script: string, env: Record<string, string | undefined>): SpawnSyncReturns<string> {
  return runStep(script, env, mkdtempSync(path.join(work, 'cwd-')));
}

function fake(name: string, body: string): void {
  writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}`);
  chmodSync(path.join(bin, name), 0o755);
}

beforeAll(() => {
  work = mkdtempSync(path.join(tmpdir(), 'docserver-ci-steps-'));
  bin = path.join(work, 'bin');
  mkdirSync(bin);
  // Each fake below that the apt step, the install's cleanup or the readable step reaches appends its call to CALLS
  // (when set), so a row reads the order of everything the step ran. sudo records itself, then runs its command as
  // the caller; given `-u <user>`, it answers as that user could not when FAKE_SUDO_U=deny, and otherwise runs the
  // command as the caller.
  const record = (name: string): string => `[ -n "$CALLS" ] && printf '%s\\n' "${name} $*" >> "$CALLS"\n`;
  fake('sudo', `${record('sudo')}if [ "$1" = -u ]; then shift 2; [ "$FAKE_SUDO_U" = deny ] && exit 1; fi\nexec "$@"\n`);
  // date answers only the version step's ISO-week call: FAKE_WEEK when set (even empty), else WEEK; any other call fails.
  fake('date', `[ "$*" = '-u +%G-W%V' ] || exit 7\nprintf '%s\\n' "\${FAKE_WEEK-${WEEK}}"\n`);
  // tee records its arguments and what it was given, and writes nothing else.
  fake('tee', 'printf \'%s\\n\' "$@" > "$TEE_ARGS"\ncat > "$TEE_IN"\n');
  // npx records each call; FAKE_NPX says whether it succeeds always, never, or from its second call on.
  fake(
    'npx',
    `${record('npx')}` +
      'printf \'%s\\n\' "$*" >> "$NPX_LOG"\n' +
      'n=$(wc -l < "$NPX_LOG")\n' +
      'case "$FAKE_NPX" in ok) exit 0 ;; fail) exit 1 ;; second) [ "$n" -ge 2 ] && exit 0; exit 1 ;; esac\n' +
      'exit 3\n',
  );
  // pkill signals nothing: it records its call and answers as procps does, 0 when a process matched and 1 when none
  // did (FAKE_PKILL=none). sleep waits for nothing. dpkg configures nothing, and fails when FAKE_DPKG=fail.
  fake('pkill', `${record('pkill')}[ "$FAKE_PKILL" = none ] && exit 1\nexit 0\n`);
  fake('sleep', `${record('sleep')}exit 0\n`);
  fake('dpkg', `${record('dpkg')}[ "$FAKE_DPKG" = fail ] && exit 2\nexit 0\n`);
});

/** A fresh, empty call log for one row. */
function callLog(name: string): string {
  const file = path.join(work, `calls-${name}.txt`);
  writeFileSync(file, '');
  return file;
}

function calls(file: string): string[] {
  return readFileSync(file, 'utf8').split('\n').filter((l) => l !== '');
}

/** A fresh, not yet existing archive directory, standing in for ARCHIVES_PATH: the apt step makes it. */
function archivesDir(): string {
  return path.join(mkdtempSync(path.join(work, 'var-cache-')), path.basename(ARCHIVES_PATH));
}

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
      [
        'actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9',
        { path: ARCHIVES_DIR, key: APT_CACHE_KEY, 'restore-keys': APT_CACHE_PREFIX },
      ],
    ]);
  });

  it('installs from the lock, reads the playwright-core pin, configures apt and makes its archive directory, restores the browser cache and the apt archive cache, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball', () => {
    expect(steps.map((s) => s.uses?.replace(/@.*$/, '') ?? s.name ?? s.run)).toEqual([
      'actions/checkout',
      'actions/setup-node',
      'npm ci --no-audit --no-fund',
      "the pinned playwright-core version, the runner's OS release, the ISO week, the browser directory and apt's archive directory",
      'apt retries and timeouts',
      'actions/cache',
      'actions/cache',
      'install the pinned browsers and their system libraries',
      READABLE,
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
    // The only other env is the apt archive directory, given to the two steps that use it (L3.CI5, L3.CI6).
    expect(steps.filter((s) => s.env !== undefined).map((s) => [s.name, s.env])).toEqual([
      ['apt retries and timeouts', { ARCHIVES: ARCHIVES_DIR }],
      [READABLE, { ARCHIVES: ARCHIVES_DIR }],
      ['ratchet', ratchet?.env],
    ]);
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
    const archives = archivesDir();
    const r = runIn(apt?.run ?? 'exit 9', {
      TEE_ARGS: path.join(work, 'tee-args.txt'),
      TEE_IN: path.join(work, 'tee-in.txt'),
      ARCHIVES: archives,
    });
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(path.join(work, 'tee-args.txt'), 'utf8')).toBe(`${APT_CONF}\n`);
    expect(readFileSync(path.join(work, 'tee-in.txt'), 'utf8')).toBe(`${[...APT_LINES, ...archiveLines(archives)].join('\n')}\n`);
  });

  it('L3.CI2: the install step runs INSTALL under `timeout -k 30 600`, in a loop of exactly two attempts that both fit in its own step timeout, with everything between them bounded and counted', () => {
    expect(installAt).toBeGreaterThan(-1);
    expect(install?.name).toBe('install the pinned browsers and their system libraries');
    const run = install?.run ?? '';
    expect(run).toContain(`timeout -k 30 600 ${INSTALL}`);
    expect(install?.['timeout-minutes']).toBe(22);
    const bound = new RegExp(`timeout -k (\\d+) (\\d+) ${INSTALL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).exec(run);
    const perAttempt = Number(bound?.[1]) + Number(bound?.[2]);
    expect(perAttempt).toBe(630);
    // Between the attempts (L3.CI7): the wait between TERM and KILL, and the bound on `dpkg --configure -a`, which runs
    // only under a `timeout -k` of its own. Every bound in the step other than the attempts' counts against the limit.
    const waits = [...run.matchAll(/\bsleep (\d+)\b/g)].map((m) => Number(m[1]));
    expect(waits).toHaveLength(1);
    const dpkg = run.split('\n').filter((l) => /\bdpkg\b/.test(l) && !/pkill/.test(l));
    expect(dpkg).toHaveLength(1);
    expect(dpkg[0]).toMatch(/\bsudo timeout -k \d+ \d+ dpkg --configure -a\b/);
    const others = [...run.matchAll(/\btimeout -k (\d+) (\d+) (?!npx )/g)].map((m) => Number(m[1]) + Number(m[2]));
    expect(others).toHaveLength(1);
    const between = waits.reduce((a, b) => a + b, 0) + others.reduce((a, b) => a + b, 0);
    // What is left is the allowance for the two signal-only pkill calls, the only unbounded commands in the step.
    expect(2 * perAttempt + between).toBeLessThanOrEqual(22 * 60 - PKILL_ALLOWANCE_S);
  });

  it.each([
    ['fails twice: two attempts, then the step fails', 'fail', 2, false],
    ['succeeds at once: one attempt', 'ok', 1, true],
    ['fails, then succeeds: two attempts, and the step passes', 'second', 2, true],
  ])('L3.CI2: an install that %s', (_what, mode, attempts, passes) => {
    const log = path.join(work, `npx-${mode}.txt`);
    writeFileSync(log, '');
    const r = runIn(install?.run ?? 'exit 9', { NPX_LOG: log, FAKE_NPX: mode });
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
    expect(readFileSync(out, 'utf8')).toBe(
      `version=${pinned}\nos=ubuntu24.04\nweek=${WEEK}\nbrowsers=${path.join(work, dir)}\narchives=${ARCHIVES_PATH}\n`,
    );
  });

  it.each([
    ['Ubuntu 22.04', 'ubuntu', '"22.04"', 'ubuntu22.04'],
    ['Ubuntu 24.04', 'ubuntu', '"24.04"', 'ubuntu24.04'],
    ['Ubuntu 26.04, unquoted', 'ubuntu', '26.04', 'ubuntu26.04'],
    ['Debian 12', 'debian', '"12"', 'debian12'],
  ])('L3.CI3: the version step names the OS release playwright-core picks its builds by, so a new runner release is a new key: %s', (_what, id, versionId, os) => {
    const out = path.join(work, 'github-output.txt');
    writeFileSync(out, '');
    const r = runStep(versionStep(osRelease(id, versionId)), {
      GITHUB_OUTPUT: out,
      HOME: path.join(work, 'home'),
      XDG_CACHE_HOME: undefined,
    });
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

describe("ci.yml: a warm job downloads no system library, and attempt 2 is not refused by attempt 1's leftover apt-get (L3 Task 17, follow-up)", () => {
  it("L3.CI5: the version step names apt's archive directory, a fixed path under /var/cache that apt's download user can traverse, whatever the runner's temporary or home directory says", () => {
    expect(ARCHIVES_PATH.startsWith('/var/cache/')).toBe(true);
    expect(path.dirname(ARCHIVES_PATH)).toBe('/var/cache');
    for (const env of [
      { HOME: path.join(work, 'home'), RUNNER_TEMP: undefined },
      { HOME: path.join(work, 'home'), RUNNER_TEMP: path.join(work, 'runner-temp') },
    ]) {
      const out = path.join(work, 'github-output.txt');
      writeFileSync(out, '');
      const r = runStep(versionStep(osRelease('ubuntu', '"24.04"')), { GITHUB_OUTPUT: out, XDG_CACHE_HOME: undefined, ...env });
      expect(r.status, r.stderr).toBe(0);
      expect(readFileSync(out, 'utf8').split('\n').filter((l) => l.startsWith('archives='))).toEqual([`archives=${ARCHIVES_PATH}`]);
    }
  });

  it.each([
    ['an empty answer', ''],
    ['a week with no year', 'W44'],
    ['a week with no W', '2026-44'],
    ['a week with a quote', '2026-W4"'],
  ])("L3.CI5: the version step fails, and writes no key part, when the ISO week reads as %s", (_what, week) => {
    const out = path.join(work, 'github-output.txt');
    writeFileSync(out, '');
    const r = runStep(versionStep(osRelease('ubuntu', '"24.04"')), { GITHUB_OUTPUT: out, HOME: path.join(work, 'home'), FAKE_WEEK: week });
    expect(r.status).not.toBe(0);
    expect(readFileSync(out, 'utf8')).toBe('');
  });

  it("L3.CI5: the apt step makes the archive directory and its partial/ subdirectory, owned by the runner, checks that apt's download user can reach partial/, then points apt's archive cache there", () => {
    expect(apt?.env).toEqual({ ARCHIVES: ARCHIVES_DIR });
    const archives = archivesDir();
    const log = callLog('apt');
    const r = runIn(apt?.run ?? 'exit 9', {
      TEE_ARGS: path.join(work, 'tee-args-ci5.txt'),
      TEE_IN: path.join(work, 'tee-in-ci5.txt'),
      ARCHIVES: archives,
      CALLS: log,
    });
    expect(r.status, r.stderr).toBe(0);
    const uid = process.getuid?.() ?? -1;
    const gid = process.getgid?.() ?? -1;
    expect(calls(log)).toEqual([
      `sudo install -d -o ${uid} -g ${gid} -m 0755 ${archives} ${archives}/partial`,
      `sudo -u _apt test -x ${archives}/partial`,
      `sudo tee ${APT_CONF}`,
    ]);
    for (const d of [archives, path.join(archives, 'partial')]) {
      const st = statSync(d, { throwIfNoEntry: false });
      expect(st?.isDirectory(), d).toBe(true);
      expect(st?.uid, d).toBe(uid);
      expect((st?.mode ?? 0) & 0o777, d).toBe(0o755);
    }
    const conf = readFileSync(path.join(work, 'tee-in-ci5.txt'), 'utf8').split('\n');
    expect(conf.filter((l) => /^Dir::Cache::Archives /i.test(l))).toEqual([`Dir::Cache::Archives "${archives}/";`]);
    expect(conf).toContain('APT::Keep-Downloaded-Packages "true";');
  });

  it("L3.CI5: the apt step fails, and writes no apt configuration, when apt's download user cannot reach partial/ (apt would then download as root, unsandboxed)", () => {
    const args = path.join(work, 'tee-args-unreachable.txt');
    rmSync(args, { force: true });
    const r = runIn(apt?.run ?? 'exit 9', {
      TEE_ARGS: args,
      TEE_IN: path.join(work, 'tee-in-unreachable.txt'),
      ARCHIVES: archivesDir(),
      FAKE_SUDO_U: 'deny',
    });
    expect(r.status).not.toBe(0);
    expect(() => readFileSync(args, 'utf8')).toThrow();
    expect(r.stdout).toMatch(/^::error::.*_apt/m);
  });

  it.each([
    ['no directory', undefined],
    ['an empty one', ''],
    ['a relative one', 'relative/archives'],
    ['one holding a double quote, which would end the configuration value', 'QUOTE'],
  ])('L3.CI5: the apt step fails, and writes no apt configuration and makes no directory, given %s', (_what, given) => {
    const args = path.join(work, 'tee-args-refused.txt');
    rmSync(args, { force: true });
    const archives = given === 'QUOTE' ? path.join(path.dirname(archivesDir()), 'a"b') : given;
    const log = callLog('apt-refused');
    const r = runIn(apt?.run ?? 'exit 9', { TEE_ARGS: args, TEE_IN: path.join(work, 'tee-in-refused.txt'), ARCHIVES: archives, CALLS: log });
    expect(r.status).not.toBe(0);
    expect(() => readFileSync(args, 'utf8')).toThrow();
    expect(calls(log)).toEqual([]);
  });

  it("L3.CI6: a second cache step, with the browser cache's pinned action, restores and saves apt's archive directory after the apt step made it and before the install, keyed on the runner OS, architecture, OS release, the pinned playwright-core and the ISO week, falling back to the newest entry with the same four", () => {
    expect(aptCacheAt).toBeGreaterThan(versionAt);
    expect(aptCacheAt).toBeGreaterThan(aptAt);
    expect(aptCacheAt).toBeLessThan(installAt);
    expect(aptCache?.uses).toBe(cache?.uses);
    expect(aptCache?.with).toEqual({ path: ARCHIVES_DIR, key: APT_CACHE_KEY, 'restore-keys': APT_CACHE_PREFIX });
    for (const part of ['${{ runner.os }}', '${{ runner.arch }}', '${{ steps.playwright.outputs.os }}', '${{ steps.playwright.outputs.version }}']) {
      expect(APT_CACHE_PREFIX).toContain(part);
    }
    // The fallback is the key without its week, ended by the separator, so it never matches another pin's entries.
    expect(APT_CACHE_PREFIX.endsWith('${{ steps.playwright.outputs.version }}-')).toBe(true);
    expect(APT_CACHE_KEY).toBe(`${APT_CACHE_PREFIX}\${{ steps.playwright.outputs.week }}`);
    // Its own key: the browser cache keeps the entries it already has, and neither restores the other's files.
    expect(APT_CACHE_KEY.startsWith(CACHE_KEY)).toBe(false);
    expect(CACHE_KEY.startsWith(APT_CACHE_PREFIX)).toBe(false);
  });

  it("L3.CI6: right after the install, a step hands apt's archive directory back to the runner and makes everything in it readable, so the cache's save can read what apt wrote as root", () => {
    expect(readableAt).toBe(installAt + 1);
    expect(readable?.env).toEqual({ ARCHIVES: ARCHIVES_DIR });
    const archives = archivesDir();
    mkdirSync(path.join(archives, 'partial'), { recursive: true });
    writeFileSync(path.join(archives, 'lib.deb'), 'deb');
    writeFileSync(path.join(archives, 'lock'), '');
    writeFileSync(path.join(archives, 'partial', 'part.deb'), 'part');
    // apt leaves its lock 0640 to root and partial/ 0700 to its download user, so the runner cannot read them. The
    // stand-in sudo is not root, so here the files' read bits are taken away from their owner instead (the
    // directories stay listable, which a non-root chown -R needs to recurse).
    for (const f of ['lib.deb', 'lock', 'partial/part.deb']) chmodSync(path.join(archives, f), 0o200);
    const log = callLog('readable');
    const r = runIn(readable?.run ?? 'exit 9', { ARCHIVES: archives, CALLS: log });
    expect(r.status, r.stderr).toBe(0);
    const uid = process.getuid?.() ?? -1;
    const gid = process.getgid?.() ?? -1;
    expect(calls(log)).toEqual([`sudo chown -R ${uid}:${gid} ${archives}`]);
    for (const f of ['lib.deb', 'lock', 'partial/part.deb']) {
      expect(() => accessSync(path.join(archives, f), fsConstants.R_OK), f).not.toThrow();
    }
    for (const d of ['', 'partial']) {
      expect(() => accessSync(path.join(archives, d), fsConstants.R_OK | fsConstants.X_OK), d).not.toThrow();
    }
  });

  it('L3.CI6: the readable step fails given no directory, rather than handing a different tree to the runner', () => {
    const log = callLog('readable-none');
    const r = runIn(readable?.run ?? 'exit 9', { ARCHIVES: undefined, CALLS: log });
    expect(r.status).not.toBe(0);
    expect(calls(log)).toEqual([]);
  });

  it.each([
    ['fails twice: the cleanup runs once, between the attempts', 'fail', [INSTALL, ...CLEANUP, INSTALL], false],
    ['fails, then succeeds: the cleanup runs once, before attempt 2', 'second', [INSTALL, ...CLEANUP, INSTALL], true],
    ['succeeds at once: no cleanup at all', 'ok', [INSTALL], true],
  ])("L3.CI7: before attempt 2 only, the install step stops a leftover apt-get or dpkg (TERM, a wait, then KILL, by exact name, under sudo) and finishes dpkg's configuration: an install that %s", (_what, mode, expected, passes) => {
    const log = callLog(`cleanup-${mode}`);
    const npx = path.join(work, `npx-cleanup-${mode}.txt`);
    writeFileSync(npx, '');
    const r = runIn(install?.run ?? 'exit 9', { CALLS: log, NPX_LOG: npx, FAKE_NPX: mode });
    expect(r.status === 0, r.stdout + r.stderr).toBe(passes);
    expect(calls(log)).toEqual(expected);
  });

  it('L3.CI7: with no leftover process to stop, the cleanup goes on to attempt 2 (pkill answering 1 does not end the step)', () => {
    const log = callLog('cleanup-none');
    const npx = path.join(work, 'npx-cleanup-none.txt');
    writeFileSync(npx, '');
    const r = runIn(install?.run ?? 'exit 9', { CALLS: log, NPX_LOG: npx, FAKE_NPX: 'second', FAKE_PKILL: 'none' });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(calls(log)).toEqual([INSTALL, ...CLEANUP, INSTALL]);
  });

  it("L3.CI7: a failing `dpkg --configure -a` is reported, and attempt 2 still runs and decides the step", () => {
    const log = callLog('cleanup-dpkg-fails');
    const npx = path.join(work, 'npx-cleanup-dpkg-fails.txt');
    writeFileSync(npx, '');
    const r = runIn(install?.run ?? 'exit 9', { CALLS: log, NPX_LOG: npx, FAKE_NPX: 'second', FAKE_DPKG: 'fail' });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(calls(log)).toEqual([INSTALL, ...CLEANUP, INSTALL]);
    expect(r.stdout).toMatch(/^::warning::.*dpkg --configure -a/m);
  });
});
