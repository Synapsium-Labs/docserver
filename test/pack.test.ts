// The packed package (docserver L1, Task 12; architecture section F T12). A clean copy of the checkout is built
// and packed in a temporary directory, as CI's `npm run build` and `npm pack` would, so this test never writes
// the checkout's own dist/. The tarball must hold the two entries, their types and the whole corpus a consumer's
// runCorpus reads, and nothing else: no Python references, no scripts, no sources, tests or working papers.
// Then scripts/consumer-smoke.mjs installs the tarball offline (its dependencies linked from this checkout's
// node_modules) and imports it by package name, exactly as CI's registry-installed smoke does; a second tarball
// whose packed golden was changed must fail it, naming the case. npm runs offline here, with its update check off
// and a throwaway cache, so the test touches no network. The smoke runs with --time-scale 10: test/corpus.test.ts
// holds every maxMs at scale 1, and this run judges the package, not the machine.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const SMOKE = path.join(ROOT, 'scripts', 'consumer-smoke.mjs');

const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { name: string; version: string };
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'conformance', 'manifest.json'), 'utf8')) as {
  id: string;
  kind: string;
}[];

/** The file name npm gives the tarball: the scope's @ dropped, its slash a dash, then the version. */
const TARBALL = `${pkg.name.replace(/^@/, '').replace('/', '-')}-${pkg.version}.tgz`;

/** The only places a packed file may live. */
const ALLOWED = [
  /^dist\/(?:render|conformance)\/[A-Za-z]+\.(?:js|d\.ts)$/,
  /^conformance\/(?:manifest|hostile|DEPARTURES)\.json$/,
  /^conformance\/(?:corpus|expected)\/[A-Za-z0-9/_-]+\.(?:md|html|meta\.json)$/,
  /^(?:package\.json|README\.md|LICENSE)$/,
];

interface Packed {
  filename: string;
  files: string[];
}

let work = '';
let packed: Packed = { filename: '', files: [] };
let smoke: SpawnSyncReturns<string> | null = null;
let brokenSmoke: SpawnSyncReturns<string> | null = null;

/** Run scripts/consumer-smoke.mjs with these arguments. */
function runSmoke(args: readonly string[]): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [SMOKE, ...args], { cwd: work, encoding: 'utf8' });
}

/** npm with no network: offline, no update check, no audit or funding calls, a throwaway cache. */
function npm(args: readonly string[], cwd: string): SpawnSyncReturns<string> {
  return spawnSync('npm', [...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_config_offline: 'true',
      npm_config_update_notifier: 'false',
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      npm_config_cache: path.join(work, 'npm-cache'),
    },
  });
}

beforeAll(() => {
  work = mkdtempSync(path.join(tmpdir(), 'docserver-pack-'));
  const stage = path.join(work, 'stage');
  // A clean checkout: everything but git's own files, installs, build output and earlier tarballs.
  cpSync(ROOT, stage, {
    recursive: true,
    filter: (src) => !/(?:^|[\\/])(?:\.git|node_modules|dist|coverage)$|\.tgz$/.test(path.relative(ROOT, src)),
  });
  symlinkSync(realpathSync(path.join(ROOT, 'node_modules')), path.join(stage, 'node_modules'), 'dir');
  const build = spawnSync(process.execPath, [TSC, '-p', 'tsconfig.build.json'], { cwd: stage, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(`build failed: ${build.stdout}${build.stderr}`);
  const pack = npm(['pack', '--json', '--ignore-scripts', '--pack-destination', work], stage);
  if (pack.status !== 0) throw new Error(`npm pack failed: ${pack.stderr}`);
  const [first] = JSON.parse(pack.stdout) as { filename: string; files: { path: string }[] }[];
  packed = { filename: first?.filename ?? '', files: (first?.files ?? []).map((f) => f.path).sort() };
  const deps = realpathSync(path.join(ROOT, 'node_modules'));
  smoke = runSmoke([path.join(work, packed.filename), '--deps-from', deps, '--time-scale', '10']);
  // The same package with one packed golden changed: its own corpus no longer passes.
  const broken = path.join(work, 'broken');
  mkdirSync(broken);
  appendFileSync(path.join(stage, 'conformance', 'expected', 'headings.html'), 'x');
  const repack = npm(['pack', '--json', '--ignore-scripts', '--pack-destination', broken], stage);
  if (repack.status !== 0) throw new Error(`npm pack failed: ${repack.stderr}`);
  brokenSmoke = runSmoke([path.join(broken, packed.filename), '--deps-from', deps, '--time-scale', '10']);
}, 300_000);

afterAll(() => {
  if (work !== '') rmSync(work, { recursive: true, force: true });
});

describe('npm pack', () => {
  it('names the tarball as CI expects it', () => {
    expect(packed.filename).toBe(TARBALL);
    expect(TARBALL).toBe('synapsium-labs-docserver-0.1.0.tgz');
  });

  it('holds both entries with their types, the corpus files, the licence and the readme', () => {
    for (const must of [
      'dist/render/index.js',
      'dist/render/index.d.ts',
      'dist/conformance/index.js',
      'dist/conformance/index.d.ts',
      'conformance/manifest.json',
      'conformance/hostile.json',
      'conformance/DEPARTURES.json',
      'conformance/expected/headings.html',
      'LICENSE',
      'README.md',
      'package.json',
    ]) {
      expect(packed.files).toContain(must);
    }
  });

  it('holds every file runCorpus reads: each case input and its expected html and meta', () => {
    const needed = manifest
      .filter((m) => m.kind !== 'generated')
      .flatMap((m) => [`conformance/corpus/${m.id}.md`, `conformance/expected/${m.id}.html`, `conformance/expected/${m.id}.meta.json`]);
    expect(needed.length).toBe(156);
    expect(needed.filter((f) => !packed.files.includes(f))).toEqual([]);
  });

  it('holds nothing else: no references, scripts, sources, tests, CI files or working papers', () => {
    expect(packed.files.filter((f) => !ALLOWED.some((re) => re.test(f)))).toEqual([]);
    expect(packed.files.filter((f) => /^(?:conformance\/reference|scripts|src|test|docs|\.github)\//.test(f))).toEqual([]);
  });
});

describe('the packed package, imported by name', () => {
  it('passes the whole corpus through the consumer smoke', () => {
    expect(smoke?.stderr).toBe('');
    expect(smoke?.stdout).toBe(
      [
        'consumer-smoke: installed the tarball offline',
        'consumer-smoke: @synapsium-labs/docserver/render resolves into node_modules',
        'consumer-smoke: a deep import is refused (ERR_PACKAGE_PATH_NOT_EXPORTED)',
        'consumer-smoke: 82 of 82 cases passed',
        '',
      ].join('\n'),
    );
    expect(smoke?.status).toBe(0);
  });

  it('fails, naming the case, when the packed corpus does not pass', () => {
    const lines = brokenSmoke?.stdout.split('\n') ?? [];
    expect(lines.slice(0, 4)).toEqual([
      'consumer-smoke: installed the tarball offline',
      'consumer-smoke: @synapsium-labs/docserver/render resolves into node_modules',
      'consumer-smoke: a deep import is refused (ERR_PACKAGE_PATH_NOT_EXPORTED)',
      'consumer-smoke: 81 of 82 cases passed',
    ]);
    expect(lines[4]).toMatch(/^consumer-smoke: headings: html differs at offset \d+/);
    expect(brokenSmoke?.status).toBe(1);
  });
});

describe('scripts/consumer-smoke.mjs: refusals', () => {
  const USAGE = 'usage: node scripts/consumer-smoke.mjs <tarball> [--deps-from <node_modules>] [--time-scale <n>]\n';

  it('a bad command line exits 2 with the usage line', () => {
    const bad = [
      [],
      ['--deps-from', 'x'],
      ['a.tgz', '--deps-from'],
      ['a.tgz', '--other', 'x'],
      ['a.tgz', '--deps-from', 'x', 'y'],
      ['a.tgz', '--deps-from', 'x', '--deps-from', 'y'],
      ['a.tgz', '--time-scale', '0'],
      ['a.tgz', '--time-scale', 'fast'],
    ];
    for (const args of bad) expect(runSmoke(args)).toMatchObject({ status: 2, stdout: '', stderr: USAGE });
  });

  it('a tarball that cannot be unpacked exits 1 and says which command failed', () => {
    const r = runSmoke([path.join(work, 'no-such.tgz'), '--deps-from', path.join(ROOT, 'node_modules')]);
    expect(r.status).toBe(1);
    expect(r.stdout).toBe('');
    expect(r.stderr).toMatch(/^consumer-smoke: tar -xzf \S+no-such\.tgz -C \S+ exited \d+$/m);
  });
});
