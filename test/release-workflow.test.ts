// The release lane, .github/workflows/release.yml (docserver L3, Task 14; plan Reference §13, FD21; rows L3.W1 to
// L3.W9 and L3.W11, L3.W10 being test/public-ready.test.ts's). Read as data with js-yaml (YAML 1.2 core: `on` stays the
// string "on"), and, for the steps that decide, run: each verify-tag check, the sha256 re-check before attest and
// publish, and the publish command run in bash as GitHub runs a `run:` step (`bash -e`), with fake `git`, `gh` and
// `npm` first on PATH where the step would reach the network, so their behaviour is measured rather than their text
// only. Nothing here reaches a network or GitHub: the fakes answer from what each row gives them.
//
// The lane: a signed annotated tag `vX.Y.Z` (or `vX.Y.Z-rc.N`) starts verify-tag; ci.yml runs in full through
// `workflow_call`; build packs one tarball twice from two clean copies and compares them; attest attests it; publish,
// behind the operator-approved `npm-release` environment, publishes that same file through npm trusted publishing
// with provenance; github-release attaches it; post-verify runs the README's five verification commands. A
// `workflow_dispatch` run is a dry run: verify-tag's tag-free checks, test and build run, and every job from attest on
// is skipped (L3.W11).
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SpawnSyncReturns } from 'node:child_process';
import { load } from 'js-yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

interface Step {
  name?: string;
  id?: string;
  if?: string;
  uses?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
  run?: string;
  'working-directory'?: string;
  'timeout-minutes'?: number;
}
interface Job {
  name?: string;
  needs?: string | string[];
  if?: string;
  uses?: string;
  with?: Record<string, unknown>;
  environment?: unknown;
  'runs-on'?: string;
  'timeout-minutes'?: number;
  permissions?: Record<string, string>;
  outputs?: Record<string, string>;
  steps?: Step[];
}
interface Workflow {
  name?: string;
  on?: Record<string, unknown>;
  permissions?: unknown;
  concurrency?: unknown;
  jobs?: Record<string, Job>;
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FILE = path.join(ROOT, '.github', 'workflows', 'release.yml');
/** The workflow's text; empty while it does not exist, so each row fails on its own assertion rather than on loading. */
const TEXT = existsSync(FILE) ? readFileSync(FILE, 'utf8') : '';
const wf = (load(TEXT) ?? {}) as Workflow;
const jobs = wf.jobs ?? {};
const CI_TEXT = readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
const ci = load(CI_TEXT) as Workflow;
const README = readFileSync(path.join(ROOT, 'README.md'), 'utf8');

/** The jobs, in the order the lane runs them (Reference §13, figure 2). */
const JOBS = ['verify-tag', 'test', 'build', 'attest', 'publish', 'github-release', 'post-verify'];
/** The jobs a `workflow_dispatch` dry run skips, each behind this exact condition (L3.W11). */
const TAG_ONLY = "github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')";
const OUTWARD = ['attest', 'publish', 'github-release', 'post-verify'];
/** Each job's own grant (L3.W1, L3.W2); the top level grants nothing. */
const PERMISSIONS: Record<string, Record<string, string>> = {
  'verify-tag': { contents: 'read', actions: 'read' },
  test: { contents: 'read' },
  build: { contents: 'read' },
  attest: { 'id-token': 'write', attestations: 'write' },
  publish: { 'id-token': 'write', contents: 'read' },
  'github-release': { contents: 'write' },
  'post-verify': { contents: 'read', attestations: 'read' },
};
/** Each job's `needs` (L3.W7): verify-tag first, every other job naming it and the job before it. */
const NEEDS: Record<string, string[] | undefined> = {
  'verify-tag': undefined,
  test: ['verify-tag'],
  build: ['verify-tag', 'test'],
  attest: ['verify-tag', 'build'],
  publish: ['verify-tag', 'build', 'attest'],
  'github-release': ['verify-tag', 'build', 'attest', 'publish'],
  'post-verify': ['verify-tag', 'github-release'],
};
/** Every remote action the lane uses, each pinned by the full commit sha of its release (L3.W8). */
const PINS = [
  'actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0',
  'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0',
  'actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2',
  'actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2',
  'actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4.2.2',
];
/** A remote action reference pinned by a full commit sha: `owner/repo[/path]@<40 hex>`. */
const SHA_PINNED = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[^@\s]+)?@[0-9a-f]{40}$/;
/** The one local `uses:` allowed, in the test job (Global Constraints). */
const LOCAL_CI = './.github/workflows/ci.yml';
/** The exact Node every job that runs Node sets up, and the exact npm publish installs (Reference §13 steps 3 and 5). */
const NODE = '22.23.3';
const NPM = '11.21.0';
/** The artifact that carries the one tarball, and the directory each job downloads it into (L3.W6). */
const ARTIFACT = 'release';
const TARBALL_OUT = '${{ needs.build.outputs.tarball }}';
const SHA256_OUT = '${{ needs.build.outputs.sha256 }}';
/** The re-check each job that reads the tarball runs before using it (L3.W6). */
const RECHECK = 'the downloaded tarball is the one build packed';

/** verify-tag's steps, by name: the two tag-free checks, then the tag step and the six tag-only checks (Reference §13 step 1). */
const V_VERSION = "package.json's version equals assets.json's version";
const V_SIGNERS_MAIN = ".github/release-signers equals main's copy";
const V_TAG = 'the pushed ref names a release tag, fetched as the object it is';
const V_ANNOTATED = '1. the tag is an annotated tag object';
const V_SIGNED = '2. the tag is signed by a release-signer key line of the signers file';
const V_VERSION_TAG = "3. the tag is v + package.json's version";
const V_ON_MAIN = '4. the tag is on main';
const V_PUBLIC = '5. package.json is not private';
const V_ENVIRONMENT = '6. the npm-release environment needs a reviewer, prevents self-review and deploys v* tags only';
const TAG_FREE = [V_VERSION, V_SIGNERS_MAIN];
const TAG_STEPS = [V_TAG, V_ANNOTATED, V_SIGNED, V_VERSION_TAG, V_ON_MAIN, V_PUBLIC, V_ENVIRONMENT];

const job = (id: string): Job => jobs[id] ?? {};
const stepsOf = (id: string): Step[] => job(id).steps ?? [];
const stepNamed = (id: string, name: string): Step | undefined => stepsOf(id).find((s) => s.name === name);
const needsOf = (j: Job): string[] => (j.needs === undefined ? [] : Array.isArray(j.needs) ? j.needs : [j.needs]);
/** Every `uses:` line of a workflow text, comments included as written. */
const usesLines = (text: string): string[] => text.split('\n').filter((l) => /^\s*(?:-\s+)?uses:/.test(l));
/** The README's Release verification commands, one per line (test/readme.test.ts pins them). */
function readmeCommands(): string[] {
  const at = README.indexOf('\n## Release verification\n');
  const section = README.slice(at, README.indexOf('\n## ', at + 1));
  const block = /```sh\n([\s\S]*?)```/.exec(section)?.[1] ?? '';
  return block.split('\n').filter((l) => l !== '');
}

let work = '';
let bin = '';

/** Runs one step's script as GitHub runs a `run:` step on Linux (`bash -e`), with the fakes first on PATH unless `real`. */
function runStep(script: string, env: Record<string, string>, cwd: string, real = false): SpawnSyncReturns<string> {
  const PATH = real ? (process.env['PATH'] ?? '') : `${bin}${path.delimiter}${process.env['PATH'] ?? ''}`;
  const all: Record<string, string> = { HOME: work, PATH, LANG: 'C', ...env };
  return spawnSync('bash', ['-e', '-c', script], { cwd, encoding: 'utf8', timeout: 60_000, env: all });
}

function fake(name: string, body: string): void {
  writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}`);
  chmodSync(path.join(bin, name), 0o755);
}

/** A fresh directory under the scratch root. */
const scratch = (prefix: string): string => mkdtempSync(path.join(work, `${prefix}-`));

beforeAll(() => {
  work = mkdtempSync(path.join(tmpdir(), 'docserver-release-steps-'));
  bin = path.join(work, 'bin');
  mkdirSync(bin);
  // git records each call (one line of arguments) to GIT_LOG; `cat-file -t` answers FAKE_CAT (the object's type);
  // `rev-parse --verify` answers FAKE_TAG_COMMIT for a tag's peeled commit, FAKE_HEAD for HEAD, and for any other
  // `<id>^{commit}` FAKE_PEEL, or the id itself when FAKE_PEEL is unset (a commit peels to itself); anything else exits
  // FAKE_GIT_RC (0 unless set).
  fake(
    'git',
    'printf \'%s\\n\' "$*" >> "$GIT_LOG"\n' +
      'case "$*" in *"cat-file -t"*) printf \'%s\\n\' "$FAKE_CAT"; exit 0 ;; esac\n' +
      'case "$*" in "rev-parse --verify refs/tags/"*"^{commit}") printf \'%s\\n\' "$FAKE_TAG_COMMIT"; exit 0 ;; esac\n' +
      'case "$*" in "rev-parse --verify HEAD") printf \'%s\\n\' "$FAKE_HEAD"; exit 0 ;; esac\n' +
      'case "$*" in "rev-parse --verify "*"^{commit}") id="${3%^\\{commit\\}}"; printf \'%s\\n\' "${FAKE_PEEL-$id}"; exit 0 ;; esac\n' +
      'exit "${FAKE_GIT_RC:-0}"\n',
  );
  // gh records each call and answers `api <path>` from the file FAKE_GH_DIR/<path with / as _>.json, failing (exit 1)
  // when that file is missing, as gh does on an HTTP error; `release create` creates nothing and exits 0.
  fake(
    'gh',
    'printf \'%s\\n\' "$*" >> "$GH_LOG"\n' +
      '[ "$1 $2" = "release create" ] && exit 0\n' +
      '[ "$1" = api ] || exit 9\n' +
      'f="$FAKE_GH_DIR/$(printf \'%s\' "$2" | tr \'/\' \'_\').json"\n' +
      '[ -f "$f" ] || { echo "gh: Not Found (HTTP 404)" >&2; exit 1; }\n' +
      'cat "$f"\n',
  );
  // npm records each call; it publishes nothing.
  fake('npm', 'printf \'%s\\n\' "$*" >> "$NPM_LOG"\nexit 0\n');
});

afterAll(() => {
  if (work !== '') rmSync(work, { recursive: true, force: true });
});

describe('release.yml: triggers and the job graph', () => {
  it('runs on a pushed release tag (vX.Y.Z or vX.Y.Z-rc.N) and by hand as a dry run, and on nothing else', () => {
    expect(Object.keys(wf.on ?? {}).sort()).toEqual(['push', 'workflow_dispatch']);
    expect(wf.on?.['push']).toEqual({ tags: ['v[0-9]+.[0-9]+.[0-9]+', 'v[0-9]+.[0-9]+.[0-9]+-rc.[0-9]+'] });
  });

  it('holds exactly the seven jobs of the lane, in order, never cancelling a release in flight', () => {
    expect(Object.keys(jobs)).toEqual(JOBS);
    expect(wf.concurrency).toEqual({ group: 'release-${{ github.ref }}', 'cancel-in-progress': false });
    // ci.yml keys its own group on the calling workflow's name, so the release's call of it never shares a group with
    // main's own CI (test/ci-workflow.test.ts pins that group).
    expect([wf.name, ci.name]).toEqual(['release', 'ci']);
  });

  it('L3.W7: verify-tag needs nothing and every other job needs verify-tag and the job before it, so verify-tag precedes every job', () => {
    for (const id of JOBS) expect([id, job(id).needs]).toEqual([id, NEEDS[id]]);
    // Transitively too: walking `needs` from any job reaches verify-tag, and verify-tag reaches nothing.
    const reaches = (id: string, seen = new Set<string>()): Set<string> => {
      for (const n of needsOf(job(id))) if (!seen.has(n)) reaches(n, seen.add(n));
      return seen;
    };
    expect(JOBS.filter((id) => id !== 'verify-tag' && !reaches(id).has('verify-tag'))).toEqual([]);
    expect([...reaches('verify-tag')]).toEqual([]);
  });

  it('no expression is interpolated into a script: every `${{ }}` a step uses reaches it through env', () => {
    for (const id of JOBS) for (const s of stepsOf(id)) expect([id, s.name, s.run?.includes('${{') ?? false]).toEqual([id, s.name, false]);
  });
});

describe('release.yml: permissions (L3.W1, L3.W2)', () => {
  it('L3.W1: the top-level token grants nothing', () => {
    expect(wf.permissions).toEqual({});
  });

  it('L3.W1: each job asks for exactly its own permissions', () => {
    for (const id of JOBS) expect([id, job(id).permissions]).toEqual([id, PERMISSIONS[id]]);
  });

  it("L3.W1: the test job, which calls ci.yml, grants at least every permission ci.yml declares (a called workflow can only narrow its caller's grant)", () => {
    const rank = (v: string | undefined): number => ['none', 'read', 'write'].indexOf(v ?? 'none');
    const declared: [string, string][] = [
      ...Object.entries((ci.permissions ?? {}) as Record<string, string>),
      ...Object.values(ci.jobs ?? {}).flatMap((j) => Object.entries(j.permissions ?? {})),
    ];
    expect(declared.length).toBeGreaterThan(0);
    const grant = job('test').permissions ?? {};
    expect(declared.filter(([k, v]) => rank(grant[k]) < rank(v))).toEqual([]);
  });

  it('L3.W2: id-token: write is granted in attest and publish only; contents: write in github-release only', () => {
    expect(JOBS.filter((id) => job(id).permissions?.['id-token'] === 'write')).toEqual(['attest', 'publish']);
    expect(JOBS.filter((id) => job(id).permissions?.['contents'] === 'write')).toEqual(['github-release']);
    expect(TEXT.match(/^\s*id-token:\s*write\s*$/gm)).toHaveLength(2);
    expect(TEXT.match(/^\s*contents:\s*write\s*$/gm)).toHaveLength(1);
  });
});

describe('release.yml: no token for npm (L3.W3)', () => {
  /** Every workflow file of the repository, with its text. */
  const workflows = (): [string, string][] =>
    readdirSync(path.join(ROOT, '.github', 'workflows'))
      .filter((f) => /\.ya?ml$/.test(f))
      .map((f) => [f, readFileSync(path.join(ROOT, '.github', 'workflows', f), 'utf8')]);
  const TOKEN_NAMES = /NPM_TOKEN|NODE_AUTH_TOKEN/;

  it('L3.W3: no workflow of the repository names NPM_TOKEN or NODE_AUTH_TOKEN, and the release reads no secret', () => {
    const files = workflows();
    expect(files.map(([f]) => f).sort()).toEqual(['ci.yml', 'release.yml']);
    expect(files.filter(([, t]) => TOKEN_NAMES.test(t)).map(([f]) => f)).toEqual([]);
    expect(TEXT).not.toMatch(/\bsecrets\./);
  });

  it("L3.W3: no setup-node step sets registry-url, which would write a NODE_AUTH_TOKEN reference into the job's .npmrc", () => {
    const setups = JOBS.flatMap((id) => stepsOf(id)).filter((s) => s.uses?.startsWith('actions/setup-node@') === true);
    expect(setups.length).toBeGreaterThan(0);
    expect(setups.filter((s) => s.with?.['registry-url'] !== undefined || s.with?.['always-auth'] !== undefined)).toEqual([]);
  });

  it('control: the scan finds a planted token name', () => {
    expect(TOKEN_NAMES.test(['NODE', 'AUTH', 'TOKEN'].join('_'))).toBe(true);
    expect(TOKEN_NAMES.test(`env: { ${['NPM', 'TOKEN'].join('_')}: x }`)).toBe(true);
  });
});

describe('release.yml: verify-tag (L3.W7, L3.W11)', () => {
  it('checks out the whole history (main and the tags) with no credentials kept, then runs its two tag-free checks and its tag step and six tag-only checks, in order', () => {
    const steps = stepsOf('verify-tag');
    expect(steps[0]).toEqual({
      uses: 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
      with: { 'fetch-depth': 0, 'persist-credentials': false },
    });
    expect(steps.slice(1).map((s) => s.name)).toEqual([...TAG_FREE, ...TAG_STEPS]);
    expect(job('verify-tag').outputs).toEqual({
      version: '${{ steps.version.outputs.version }}',
      prerelease: '${{ steps.version.outputs.prerelease }}',
    });
  });

  it("L3.W11: the tag step and the six tag-only checks run only on a pushed tag; the two tag-free checks run on a dispatch too", () => {
    for (const name of TAG_STEPS) expect([name, stepNamed('verify-tag', name)?.if]).toEqual([name, TAG_ONLY]);
    for (const name of TAG_FREE) expect([name, stepNamed('verify-tag', name)?.if]).toEqual([name, undefined]);
    expect(job('verify-tag').if).toBeUndefined();
  });

  /** A working directory holding a package.json and an assets/assets.json with the given fields. */
  function packageDir(pkg: Record<string, unknown>, assetsVersion: string): string {
    const dir = scratch('pkg');
    mkdirSync(path.join(dir, 'assets'));
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: '@synapsium-labs/docserver', ...pkg }));
    writeFileSync(path.join(dir, 'assets', 'assets.json'), JSON.stringify({ manifest: 1, version: assetsVersion }));
    return dir;
  }
  /** Runs a verify-tag step by name in `cwd`, with GITHUB_OUTPUT and RUNNER_TEMP fresh; resolves its result, outputs and the fakes' calls. */
  function verify(name: string, cwd: string, env: Record<string, string> = {}, real = false): { r: SpawnSyncReturns<string>; out: string[]; git: string[]; gh: string[] } {
    const step = stepNamed('verify-tag', name);
    const out = path.join(scratch('out'), 'output');
    const logs = scratch('logs');
    writeFileSync(out, '');
    for (const f of ['git', 'gh']) writeFileSync(path.join(logs, f), '');
    const stepEnv: Record<string, string> = {};
    for (const k of Object.keys(step?.env ?? {})) stepEnv[k] = '';
    const r = runStep(step?.run ?? 'exit 99', { ...stepEnv, GITHUB_OUTPUT: out, RUNNER_TEMP: scratch('runner'), GIT_LOG: path.join(logs, 'git'), GH_LOG: path.join(logs, 'gh'), ...env }, cwd, real);
    const lines = (f: string): string[] => readFileSync(f, 'utf8').split('\n').filter((l) => l !== '');
    return { r, out: lines(out), git: lines(path.join(logs, 'git')), gh: lines(path.join(logs, 'gh')) };
  }

  it("the version check hands on package.json's version and whether it is a release candidate, when assets.json names the same version", () => {
    expect(stepNamed('verify-tag', V_VERSION)?.id).toBe('version');
    const a = verify(V_VERSION, packageDir({ version: '1.0.0' }, '1.0.0'));
    expect([a.r.status, a.out]).toEqual([0, ['version=1.0.0', 'prerelease=false']]);
    const b = verify(V_VERSION, packageDir({ version: '1.1.0-rc.2' }, '1.1.0-rc.2'));
    expect([b.r.status, b.out]).toEqual([0, ['version=1.1.0-rc.2', 'prerelease=true']]);
  });

  it.each([
    ['assets.json names another version', '1.0.0', '1.0.1'],
    ['the version is not a release version', '1.0.0-beta.1', '1.0.0-beta.1'],
    ['the version is not a version at all', 'x', 'x'],
  ])('the version check fails, handing on nothing, when %s', (_what, version, assets) => {
    const v = verify(V_VERSION, packageDir({ version }, assets));
    expect([v.r.status === 0, v.out]).toEqual([false, []]);
  });

  /** A real git repository whose origin/main holds `main` as .github/release-signers and whose checkout holds `here`. */
  function signersRepo(main: string, here: string): string {
    const dir = scratch('repo');
    const git = (...args: string[]): void => {
      const r = spawnSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=noreply@example.invalid', '-c', 'commit.gpgsign=false', ...args], {
        cwd: dir,
        encoding: 'utf8',
        env: { ...process.env, HOME: work, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
      });
      expect(r.status, r.stderr).toBe(0);
    };
    git('init', '-q', '-b', 'main');
    mkdirSync(path.join(dir, '.github'));
    writeFileSync(path.join(dir, '.github', 'release-signers'), main);
    git('add', '.github/release-signers');
    git('commit', '-q', '-m', 'signers');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    writeFileSync(path.join(dir, '.github', 'release-signers'), here);
    return dir;
  }

  it("the signers check passes only when the checkout's .github/release-signers is main's copy, byte for byte, and keeps main's copy for the signature check", () => {
    const same = '# principal release-signer\n';
    const ok = verify(V_SIGNERS_MAIN, signersRepo(same, same), {}, true);
    expect(ok.r.status, ok.r.stderr).toBe(0);
    const moved = verify(V_SIGNERS_MAIN, signersRepo(same, `${same}release-signer ssh-ed25519 AAAAC3Nz\n`), {}, true);
    expect(moved.r.status).not.toBe(0);
    const step = stepNamed('verify-tag', V_SIGNERS_MAIN)?.run ?? '';
    expect(step).toContain('git show origin/main:.github/release-signers');
  });

  /** The pushed commit, as GitHub gives it in GITHUB_SHA, and another commit. */
  const PUSHED = 'a'.repeat(40);
  const OTHER = 'b'.repeat(40);

  it('the tag step names the tag from a pushed release ref and fetches it as the object it is; any other ref fails before any fetch', () => {
    const ok = verify(V_TAG, scratch('tag'), { REF: 'refs/tags/v1.2.3-rc.4', GITHUB_SHA: PUSHED, FAKE_TAG_COMMIT: PUSHED, FAKE_HEAD: PUSHED });
    expect([ok.r.status, ok.out]).toEqual([0, ['tag=v1.2.3-rc.4']]);
    expect(ok.git).toEqual([
      'fetch --no-tags --force origin +refs/tags/v1.2.3-rc.4:refs/tags/v1.2.3-rc.4',
      `rev-parse --verify ${PUSHED}^{commit}`,
      'rev-parse --verify refs/tags/v1.2.3-rc.4^{commit}',
      'rev-parse --verify HEAD',
    ]);
    // GitHub may give the tag object rather than the commit: it is peeled before the comparison.
    const tagObject = verify(V_TAG, scratch('tag'), { REF: 'refs/tags/v1.0.0', GITHUB_SHA: OTHER, FAKE_PEEL: PUSHED, FAKE_TAG_COMMIT: PUSHED, FAKE_HEAD: PUSHED });
    expect([tagObject.r.status, tagObject.out]).toEqual([0, ['tag=v1.0.0']]);
    for (const ref of ['refs/heads/main', 'refs/tags/v1.2', 'refs/tags/v1.2.3-beta.1', 'refs/tags/v1.2.3;x', '']) {
      const bad = verify(V_TAG, scratch('tag'), { REF: ref, GITHUB_SHA: PUSHED, FAKE_TAG_COMMIT: PUSHED, FAKE_HEAD: PUSHED });
      expect([ref, bad.r.status === 0, bad.out, bad.git]).toEqual([ref, false, [], []]);
    }
  });

  it.each([
    ['the fetched tag now points at another commit (moved, or deleted and pushed again, after this run was queued)', OTHER, PUSHED],
    ['the checkout is not the pushed commit', PUSHED, OTHER],
    ['git names no commit for the tag', '', PUSHED],
    ['git names no commit for the tag or the checkout', '', ''],
  ])('the tag step fails, handing on no tag, when %s: every check reads the commit that test and build use', (_what, tagCommit, head) => {
    const v = verify(V_TAG, scratch('tag'), { REF: 'refs/tags/v1.0.0', GITHUB_SHA: PUSHED, FAKE_TAG_COMMIT: tagCommit, FAKE_HEAD: head });
    expect([v.r.status === 0, v.out]).toEqual([false, []]);
    expect(v.r.stdout).toContain('::error::');
  });

  it('the tag step fails when GitHub gave no pushed commit, or one git cannot peel to a commit', () => {
    const none = verify(V_TAG, scratch('tag'), { REF: 'refs/tags/v1.0.0', GITHUB_SHA: '', FAKE_TAG_COMMIT: '', FAKE_HEAD: '' });
    expect([none.r.status === 0, none.out]).toEqual([false, []]);
    const unpeeled = verify(V_TAG, scratch('tag'), { REF: 'refs/tags/v1.0.0', GITHUB_SHA: PUSHED, FAKE_PEEL: '', FAKE_TAG_COMMIT: '', FAKE_HEAD: '' });
    expect([unpeeled.r.status === 0, unpeeled.out]).toEqual([false, []]);
  });

  it('1. the annotated-tag check fails on a lightweight tag (git answers commit)', () => {
    expect(verify(V_ANNOTATED, scratch('t'), { TAG: 'v1.0.0', FAKE_CAT: 'tag' }).r.status).toBe(0);
    const light = verify(V_ANNOTATED, scratch('t'), { TAG: 'v1.0.0', FAKE_CAT: 'commit' });
    expect(light.r.status).not.toBe(0);
    expect(light.git).toEqual(['cat-file -t refs/tags/v1.0.0']);
  });

  /** A checkout holding `signers` as .github/release-signers. */
  function signersDir(signers: string): string {
    const dir = scratch('signers');
    mkdirSync(path.join(dir, '.github'));
    writeFileSync(path.join(dir, '.github', 'release-signers'), signers);
    return dir;
  }
  const HEADER = '# Principal: release-signer. The key line is the operator\'s.\n\n';
  const KEY = 'release-signer ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFixtureKeyMaterialOnlyForTests0000000000 fixture\n';

  it('2. the signature check verifies the tag with git, against the signers file, as SSH, once the file holds a release-signer key line', () => {
    const v = verify(V_SIGNED, signersDir(`${HEADER}${KEY}`), { TAG: 'v1.0.0' });
    expect(v.r.status, v.r.stderr).toBe(0);
    expect(v.git).toEqual(['-c gpg.format=ssh -c gpg.ssh.allowedSignersFile=.github/release-signers verify-tag v1.0.0']);
    expect(verify(V_SIGNED, signersDir(`${HEADER}${KEY}`), { TAG: 'v1.0.0', FAKE_GIT_RC: '1' }).r.status).not.toBe(0);
  });

  const NO_KEY = '::error::.github/release-signers holds no key line';
  const NOT_PRINCIPAL = '::error::every key line of .github/release-signers names the principal release-signer, then a key';
  it.each([
    ['the file holds only its header (no key line)', HEADER, NO_KEY],
    ['the file is empty', '', NO_KEY],
    ['a key line names another principal', `${HEADER}${KEY}${KEY.replace('release-signer', 'someone-else')}`, NOT_PRINCIPAL],
    ['a key line carries no key', `${HEADER}release-signer\n`, NOT_PRINCIPAL],
  ])('2. the signature check fails, verifying nothing and saying why, when %s', (_what, signers, why) => {
    const v = verify(V_SIGNED, signersDir(signers), { TAG: 'v1.0.0' });
    expect([v.r.status === 0, v.git]).toEqual([false, []]);
    expect(v.r.stdout.split('\n').filter((l) => l.startsWith('::error::')).map((l) => l.slice(0, why.length))).toEqual([why]);
  });

  it("3. the version check passes only when the tag is v + package.json's version", () => {
    expect(verify(V_VERSION_TAG, scratch('v'), { TAG: 'v1.0.0', VERSION: '1.0.0' }).r.status).toBe(0);
    expect(verify(V_VERSION_TAG, scratch('v'), { TAG: 'v1.0.1', VERSION: '1.0.0' }).r.status).not.toBe(0);
    expect(verify(V_VERSION_TAG, scratch('v'), { TAG: 'v1.0.0', VERSION: '' }).r.status).not.toBe(0);
    expect(stepNamed('verify-tag', V_VERSION_TAG)?.env).toEqual({ TAG: '${{ steps.tag.outputs.tag }}', VERSION: '${{ steps.version.outputs.version }}' });
  });

  it('4. the main check asks git whether the tag is an ancestor of origin/main, and fails when it is not', () => {
    const ok = verify(V_ON_MAIN, scratch('m'), { TAG: 'v1.0.0' });
    expect([ok.r.status, ok.git]).toEqual([0, ['merge-base --is-ancestor refs/tags/v1.0.0 origin/main']]);
    expect(verify(V_ON_MAIN, scratch('m'), { TAG: 'v1.0.0', FAKE_GIT_RC: '1' }).r.status).not.toBe(0);
  });

  it('5. the private check fails while package.json carries private, in any value', () => {
    expect(verify(V_PUBLIC, packageDir({ version: '1.0.0' }, '1.0.0'), {}, true).r.status).toBe(0);
    for (const value of [true, false]) expect(verify(V_PUBLIC, packageDir({ version: '1.0.0', private: value }, '1.0.0'), {}, true).r.status).not.toBe(0);
  });

  /** The two answers GitHub gives for the environment and its deployment policies; each row changes one. */
  const ENVIRONMENT = {
    name: 'npm-release',
    protection_rules: [
      { id: 1, type: 'required_reviewers', prevent_self_review: true, reviewers: [{ type: 'User', reviewer: { login: 'operator-a' } }] },
      { id: 2, type: 'branch_policy' },
    ],
    deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
  };
  const POLICIES = { total_count: 1, branch_policies: [{ id: 3, name: 'v*', type: 'tag' }] };
  /** Runs check 6 against the given answers (undefined: GitHub refuses that read). */
  function environment(env: unknown, policies: unknown): { r: SpawnSyncReturns<string>; gh: string[] } {
    const dir = scratch('gh');
    const write = (p: string, v: unknown): void => {
      if (v !== undefined) writeFileSync(path.join(dir, `${p.split('/').join('_')}.json`), typeof v === 'string' ? v : JSON.stringify(v));
    };
    write('repos/owner-a/repo-a/environments/npm-release', env);
    write('repos/owner-a/repo-a/environments/npm-release/deployment-branch-policies', policies);
    const v = verify(V_ENVIRONMENT, scratch('e'), { REPO: 'owner-a/repo-a', GH_TOKEN: 'fixture', FAKE_GH_DIR: dir });
    return { r: v.r, gh: v.gh };
  }

  it("6. the environment check reads the environment and its deployment policies with the job's token, and passes on the protected environment", () => {
    const { r, gh } = environment(ENVIRONMENT, POLICIES);
    expect(r.status, r.stderr).toBe(0);
    expect(gh).toEqual(['api repos/owner-a/repo-a/environments/npm-release', 'api repos/owner-a/repo-a/environments/npm-release/deployment-branch-policies']);
    expect(stepNamed('verify-tag', V_ENVIRONMENT)?.env).toEqual({ GH_TOKEN: '${{ github.token }}', REPO: '${{ github.repository }}' });
  });

  const rule = (patch: Record<string, unknown>): unknown => ({ ...ENVIRONMENT, protection_rules: [{ ...ENVIRONMENT.protection_rules[0], ...patch }, ENVIRONMENT.protection_rules[1]] });
  it.each([
    ['GitHub refuses the environment read (it does not exist, or the token cannot read it)', undefined, POLICIES],
    ['GitHub refuses the policies read', ENVIRONMENT, undefined],
    ['the answer is not JSON', '<html>', POLICIES],
    ['no required-reviewers rule', { ...ENVIRONMENT, protection_rules: [ENVIRONMENT.protection_rules[1]] }, POLICIES],
    ['no protection rules at all', { ...ENVIRONMENT, protection_rules: [] }, POLICIES],
    ['self-review is allowed', rule({ prevent_self_review: false }), POLICIES],
    ['self-review is not stated', rule({ prevent_self_review: undefined }), POLICIES],
    ['the reviewers list is empty', rule({ reviewers: [] }), POLICIES],
    ['deployments are open to every branch', { ...ENVIRONMENT, deployment_branch_policy: null }, POLICIES],
    ['deployments follow protected branches', { ...ENVIRONMENT, deployment_branch_policy: { protected_branches: true, custom_branch_policies: false } }, POLICIES],
    ['the policy names a branch, not a tag', ENVIRONMENT, { total_count: 1, branch_policies: [{ name: 'v*', type: 'branch' }] }],
    ['the policy admits every tag', ENVIRONMENT, { total_count: 1, branch_policies: [{ name: '*', type: 'tag' }] }],
    ['a second policy admits a branch too', ENVIRONMENT, { total_count: 2, branch_policies: [{ name: 'v*', type: 'tag' }, { name: 'main', type: 'branch' }] }],
    ['no policy at all', ENVIRONMENT, { total_count: 0, branch_policies: [] }],
  ])('6. the environment check fails closed when %s', (_what, env, policies) => {
    expect(environment(env, policies).r.status).not.toBe(0);
  });
});

describe('release.yml: test and build', () => {
  it('L3.W8: the test job is the one local `uses:`, ci.yml at the same commit, run in full', () => {
    expect(job('test').uses).toBe(LOCAL_CI);
    expect(job('test').with).toBeUndefined();
    expect(JOBS.filter((id) => job(id).uses !== undefined)).toEqual(['test']);
  });

  it('build: exact Node 22, a clean install, the registry signatures, the build and its two checks, then the double pack, the smoke and the upload', () => {
    const steps = stepsOf('build');
    expect(steps.map((s) => s.uses?.replace(/@.*$/, '') ?? s.name ?? s.run)).toEqual([
      'actions/checkout',
      'actions/setup-node',
      'npm ci --no-audit --no-fund',
      'npm audit signatures',
      'npm run build',
      'node scripts/build-frame.mjs --check',
      'git diff --exit-code',
      'pack twice, from two clean copies, and compare',
      'consumer smoke on the packed tarball',
      'actions/upload-artifact',
    ]);
    expect(steps[0]?.with).toEqual({ 'persist-credentials': false });
    expect(steps[1]?.with).toEqual({ 'node-version': NODE });
    expect(job('build').outputs).toEqual({
      tarball: '${{ steps.pack.outputs.tarball }}',
      sha256: '${{ steps.pack.outputs.sha256 }}',
      integrity: '${{ steps.pack.outputs.integrity }}',
    });
  });

  it('build packs twice, each from a clean copy of the commit built from scratch, and fails unless both tarballs have one name and one sha256; it writes SHA256SUMS and checks the sha512 integrity npm gave', () => {
    const pack = stepNamed('build', 'pack twice, from two clean copies, and compare');
    expect(pack?.id).toBe('pack');
    const run = pack?.run ?? '';
    expect(run).toContain('for copy in a b; do');
    expect(run).toContain('git archive --format=tar HEAD | tar -x -C "$dir"');
    expect(run).toContain('(cd "$dir" && npm ci --no-audit --no-fund && npm run build && npm pack --json --pack-destination "$RUNNER_TEMP/pack-$copy" > "$RUNNER_TEMP/pack-$copy.json")');
    expect(run).toContain('test "$sha_a" = "$sha_b"');
    expect(run).toContain('test "$name_a" = "$name_b"');
    expect(run).toContain('(cd "$release" && sha256sum -- "$name_a" > SHA256SUMS)');
    expect(run).toContain('test "$integrity" = "$(field integrity "$RUNNER_TEMP/pack-a.json")"');
    expect(run).toContain('cp -- assets/assets.json "$release/assets.json"');
    expect(run).toContain('printf \'%s\\n\' "tarball=$name_a" "sha256=$sha_a" "integrity=$integrity" >> "$GITHUB_OUTPUT"');
  });

  it('build runs the smoke on the release tarball and uploads exactly the tarball, SHA256SUMS and assets.json as the release artifact', () => {
    expect(stepNamed('build', 'consumer smoke on the packed tarball')).toEqual({
      name: 'consumer smoke on the packed tarball',
      env: { TARBALL: '${{ steps.pack.outputs.tarball }}' },
      run: 'node scripts/consumer-smoke.mjs "${RUNNER_TEMP:?}/release/${TARBALL:?}"',
    });
    const upload = stepsOf('build').at(-1);
    expect(upload?.with).toEqual({ name: ARTIFACT, path: '${{ runner.temp }}/release/', 'if-no-files-found': 'error', 'retention-days': 30 });
  });
});

describe('release.yml: one tarball, attested and published (L3.W4, L3.W5, L3.W6, L3.W11)', () => {
  it('L3.W11: attest, publish, github-release and post-verify each run only on a pushed tag; verify-tag, test and build run on a dispatch too', () => {
    for (const id of OUTWARD) expect([id, job(id).if]).toEqual([id, TAG_ONLY]);
    for (const id of ['verify-tag', 'test', 'build']) expect([id, job(id).if]).toEqual([id, undefined]);
  });

  it('L3.W6: attest and publish each download the release artifact into release/ and re-check it before using it; attest attests the file publish publishes', () => {
    for (const id of ['attest', 'publish', 'github-release']) {
      const steps = stepsOf(id);
      const download = steps.find((s) => s.uses?.startsWith('actions/download-artifact@') === true && s.with?.['name'] === ARTIFACT);
      expect([id, download?.with]).toEqual([id, { name: ARTIFACT, path: 'release' }]);
      const recheck = steps.findIndex((s) => s.name === RECHECK);
      expect([id, recheck]).toEqual([id, steps.indexOf(download ?? {}) + 1]);
      expect(steps[recheck]?.['working-directory']).toBe('release');
      expect(steps[recheck]?.env).toEqual({ TARBALL: TARBALL_OUT, SHA256: SHA256_OUT });
    }
    const attest = stepsOf('attest').find((s) => s.uses?.startsWith('actions/attest-build-provenance@') === true);
    expect(attest?.with).toEqual({ 'subject-path': `release/${TARBALL_OUT}` });
    expect(stepsOf('attest').indexOf(attest ?? {})).toBeGreaterThan(stepsOf('attest').findIndex((s) => s.name === RECHECK));
    const publish = stepNamed('publish', 'publish the tarball with provenance');
    expect(publish?.env).toEqual({ TARBALL: TARBALL_OUT, PRERELEASE: '${{ needs.verify-tag.outputs.prerelease }}' });
    expect(publish?.run?.match(/npm publish "\.\/release\/\$\{TARBALL:\?\}"/g)).toHaveLength(2);
    expect(stepsOf('publish').indexOf(publish ?? {})).toBeGreaterThan(stepsOf('publish').findIndex((s) => s.name === RECHECK));
  });

  /** Runs the re-check in a release/ directory holding `bytes` as the tarball and `sums` as SHA256SUMS. */
  function recheck(bytes: string, sums: (sha: string) => string, sha256?: string): SpawnSyncReturns<string> {
    const step = stepNamed('publish', RECHECK);
    const dir = scratch('release');
    const name = 'synapsium-labs-docserver-1.0.0.tgz';
    writeFileSync(path.join(dir, name), bytes);
    const sha = spawnSync('sha256sum', [name], { cwd: dir, encoding: 'utf8' }).stdout.split(' ')[0] ?? '';
    writeFileSync(path.join(dir, 'SHA256SUMS'), sums(sha));
    return runStep(step?.run ?? 'exit 99', { TARBALL: name, SHA256: sha256 ?? sha }, dir, true);
  }

  it('L3.W6: the re-check passes on the tarball build packed, and fails on a changed byte, a changed SHA256SUMS or a sha256 build did not hand on', () => {
    const name = 'synapsium-labs-docserver-1.0.0.tgz';
    expect(recheck('bytes', (sha) => `${sha}  ${name}\n`).status).toBe(0);
    // The file changed after SHA256SUMS was written (the sums name the original bytes).
    const original = spawnSync('sha256sum', [], { input: 'bytes', encoding: 'utf8' }).stdout.split(' ')[0] ?? '';
    expect(recheck('bytez', () => `${original}  ${name}\n`, original).status).not.toBe(0);
    // Both the file and SHA256SUMS changed together: build's own sha256 still refuses them.
    expect(recheck('bytez', (sha) => `${sha}  ${name}\n`, original).status).not.toBe(0);
    // SHA256SUMS names nothing.
    expect(recheck('bytes', () => '').status).not.toBe(0);
  });

  it('L3.W5: publish runs in the npm-release environment, the operator-approved one; no other job names an environment', () => {
    expect(job('publish').environment).toBe('npm-release');
    expect(JOBS.filter((id) => job(id).environment !== undefined)).toEqual(['publish']);
  });

  it('publish installs an exact npm that publishes through trusted publishing, on exact Node 22, and checks the version it got', () => {
    const steps = stepsOf('publish');
    expect(steps.map((s) => s.uses?.replace(/@.*$/, '') ?? s.name)).toEqual([
      'actions/download-artifact',
      RECHECK,
      'actions/setup-node',
      `npm ${NPM}, which publishes through trusted publishing`,
      'publish the tarball with provenance',
    ]);
    expect(steps[2]?.with).toEqual({ 'node-version': NODE });
    expect(steps[3]?.run).toBe(`npm install --global --no-audit --no-fund npm@${NPM}\ntest "$(npm --version)" = ${NPM}\n`);
  });

  /** Runs the publish step with the fake npm; resolves its result and npm's arguments. */
  function publish(prerelease: string): { r: SpawnSyncReturns<string>; npm: string[] } {
    const log = path.join(scratch('npm'), 'log');
    writeFileSync(log, '');
    const r = runStep(stepNamed('publish', 'publish the tarball with provenance')?.run ?? 'exit 99', { TARBALL: 'x-1.0.0.tgz', PRERELEASE: prerelease, NPM_LOG: log }, scratch('p'));
    return { r, npm: readFileSync(log, 'utf8').split('\n').filter((l) => l !== '') };
  }

  it('L3.W4: publish publishes the tarball with provenance, for the public; a release candidate goes to the next dist-tag', () => {
    const release = publish('false');
    expect([release.r.status, release.npm]).toEqual([0, ['publish ./release/x-1.0.0.tgz --provenance --access public']]);
    const rc = publish('true');
    expect([rc.r.status, rc.npm]).toEqual([0, ['publish ./release/x-1.0.0.tgz --provenance --access public --tag next']]);
    const unknown = publish('');
    expect([unknown.r.status === 0, unknown.npm]).toEqual([false, []]);
  });

  it('attest keeps its attestation bundle as an artifact, under the tarball\'s name, for the GitHub release', () => {
    const steps = stepsOf('attest');
    expect(steps.map((s) => s.uses?.replace(/@.*$/, '') ?? s.name)).toEqual([
      'actions/download-artifact',
      RECHECK,
      'actions/attest-build-provenance',
      'the attestation bundle, named for the tarball',
      'actions/upload-artifact',
    ]);
    expect(steps[2]?.id).toBe('attest');
    expect(steps[3]?.env).toEqual({ BUNDLE: '${{ steps.attest.outputs.bundle-path }}', TARBALL: TARBALL_OUT });
    expect(steps[4]?.with).toEqual({ name: 'attestation', path: 'attestation/', 'if-no-files-found': 'error', 'retention-days': 30 });
  });

  it('github-release creates the release from the verified tag, carrying the tarball, SHA256SUMS, assets.json and the attestation bundle', () => {
    const steps = stepsOf('github-release');
    expect(steps.map((s) => s.uses?.replace(/@.*$/, '') ?? s.name)).toEqual([
      'actions/download-artifact',
      RECHECK,
      'actions/download-artifact',
      'create the GitHub release',
    ]);
    expect(steps[2]?.with).toEqual({ name: 'attestation', path: 'release' });
    const create = steps[3];
    expect(create?.env).toEqual({
      GH_TOKEN: '${{ github.token }}',
      REPO: '${{ github.repository }}',
      TAG: '${{ github.ref_name }}',
      TARBALL: TARBALL_OUT,
      PRERELEASE: '${{ needs.verify-tag.outputs.prerelease }}',
    });
    expect(create?.['working-directory']).toBe('release');
    expect(create?.run).toContain('gh release create "$TAG" --verify-tag --repo "$REPO"');
    expect(create?.run).toContain('-- "$TARBALL" SHA256SUMS assets.json "$TARBALL.sigstore.json"');
  });

  /** Runs the create step with the fake gh; resolves its result and gh's arguments. */
  function createRelease(tag: string, prerelease: string): { r: SpawnSyncReturns<string>; gh: string[] } {
    const log = path.join(scratch('gh'), 'log');
    writeFileSync(log, '');
    const env = { GH_TOKEN: 'fixture', REPO: 'owner-a/repo-a', TAG: tag, TARBALL: 'x-1.0.0.tgz', PRERELEASE: prerelease, GH_LOG: log };
    const r = runStep(stepNamed('github-release', 'create the GitHub release')?.run ?? 'exit 99', env, scratch('c'));
    return { r, gh: readFileSync(log, 'utf8').split('\n').filter((l) => l !== '') };
  }
  const NOTES = "--notes The changes are in CHANGELOG.md at this tag. Verify the tarball as the README's Release verification section says.";
  const FILES = '-- x-1.0.0.tgz SHA256SUMS assets.json x-1.0.0.tgz.sigstore.json';

  it('github-release marks a release candidate as a GitHub prerelease, and only a release candidate', () => {
    const release = createRelease('v1.0.0', 'false');
    expect([release.r.status, release.gh]).toEqual([0, [`release create v1.0.0 --verify-tag --repo owner-a/repo-a --title v1.0.0 ${NOTES} ${FILES}`]]);
    const rc = createRelease('v1.1.0-rc.1', 'true');
    expect([rc.r.status, rc.gh]).toEqual([0, [`release create v1.1.0-rc.1 --verify-tag --repo owner-a/repo-a --title v1.1.0-rc.1 ${NOTES} --prerelease ${FILES}`]]);
  });

  it.each([
    ['prerelease is empty', 'v1.0.0', ''],
    ['prerelease is neither true nor false', 'v1.0.0', 'yes'],
    ['the tag is not a release tag', 'v1.0', 'false'],
  ])('github-release creates nothing when %s', (_what, tag, prerelease) => {
    const v = createRelease(tag, prerelease);
    expect([v.r.status === 0, v.gh]).toEqual([false, []]);
  });
});

describe('release.yml: post-verify (L3.W9)', () => {
  it("L3.W9: post-verify runs the README's five verification commands, verbatim, in a scratch directory, with the released version", () => {
    const commands = readmeCommands();
    expect(commands).toHaveLength(5);
    const step = stepNamed('post-verify', "the consumer's verification commands (README, Release verification)");
    expect(step?.run?.split('\n').filter((l) => l !== '')).toEqual(commands);
    expect(step?.['working-directory']).toBe('${{ runner.temp }}/post-verify');
    expect(step?.env).toEqual({ VERSION: '${{ needs.verify-tag.outputs.version }}', GH_TOKEN: '${{ github.token }}' });
  });

  it('post-verify makes its scratch directory and waits, bounded, for the registry to serve the version before the commands run', () => {
    const steps = stepsOf('post-verify');
    expect(steps.map((s) => s.uses?.replace(/@.*$/, '') ?? s.name)).toEqual([
      'actions/setup-node',
      'a scratch directory, once the registry serves the version',
      "the consumer's verification commands (README, Release verification)",
    ]);
    expect(steps[0]?.with).toEqual({ 'node-version': NODE });
    const wait = steps[1]?.run ?? '';
    expect(wait).toContain('mkdir -p -- "${RUNNER_TEMP:?}/post-verify"');
    expect(wait).toMatch(/for attempt in \$\(seq 1 20\); do/);
    expect(wait).toContain('exit 1');
  });
});

describe('release.yml: pinned actions (L3.W8)', () => {
  it('L3.W8: every remote `uses:` is a full commit sha with its release tag in a trailing comment; the only local one is ci.yml, in the test job', () => {
    const lines = usesLines(TEXT);
    expect(lines.length).toBeGreaterThan(5);
    const local = lines.filter((l) => /uses:\s*['"]?\.\//.test(l));
    expect(local.map((l) => l.trim())).toEqual([`uses: ${LOCAL_CI}`]);
    for (const line of lines.filter((l) => !local.includes(l))) {
      const m = /^\s*(?:-\s+)?uses:\s+(\S+)\s+#\s+(v\d+\.\d+\.\d+)\s*$/.exec(line);
      expect(m, line).not.toBeNull();
      expect(m?.[1], line).toMatch(SHA_PINNED);
    }
    const stepUses = JOBS.flatMap((id) => stepsOf(id)).filter((s) => s.uses !== undefined);
    expect(lines).toHaveLength(stepUses.length + 1);
  });

  it('L3.W8: each pin names the release its tag comment names, and ci.yml pins the same sha for the same action', () => {
    const pinned = [...new Set(usesLines(TEXT).map((l) => l.replace(/^\s*(?:-\s+)?uses:\s+/, '').trim()).filter((u) => !u.startsWith('./')))].sort();
    expect(pinned).toEqual([...PINS].sort());
    for (const line of usesLines(CI_TEXT).map((l) => l.replace(/^\s*(?:-\s+)?uses:\s+/, '').trim())) {
      const action = line.replace(/@.*$/, '');
      const ours = PINS.find((p) => p.startsWith(`${action}@`));
      if (ours !== undefined) expect(line).toBe(ours);
    }
  });
});
