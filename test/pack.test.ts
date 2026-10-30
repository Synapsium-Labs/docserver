// The packed package (docserver L1, Task 12; architecture section F T12). A clean copy of the checkout is built
// and packed in a temporary directory, as CI's `npm run build` and `npm pack` would, so this test never writes
// the checkout's own dist/. The tarball must hold the three code entries, their declarations, the whole corpus
// a consumer's runCorpus reads and the layout's assets (its stylesheet, its fonts, and the licence and notices the
// fonts travel with, and the Mermaid file that scripts/build-mermaid.mjs builds, which the notices also cover), and
// nothing else: no Python references, no scripts, no sources, tests or working papers. Since L3 Task 6 the copy is
// built as `npm run build` builds it (the Mermaid file, the frame build, then tsc), so the frame assets and
// assets/assets.json are required, and it is packed with npm's scripts on, so prepack (scripts/verify-assets.mjs) runs:
// the packed tarball stays within its 8 MiB budget, and a one-byte edit or an unlisted file under assets/ stops the pack. The types those declarations import (@types/markdown-it and @types/js-yaml) are not in it: they are
// dependencies, which a consumer's install brings (review 458, F7).
// Then scripts/consumer-smoke.mjs installs the tarball offline (its dependencies linked from this checkout's
// node_modules) and imports it by package name, exactly as CI's registry-installed smoke does; a second tarball
// whose packed golden was changed must fail it, naming the case. Since L3 Task 12 the tarball also holds ./frame,
// ./host and ./highlight with their declarations, the bridge fixtures and the labelled frame mutants, and the smoke checks
// the frame layer as a consumer gets it (its header lists what). npm runs offline here, with its update check off
// and a throwaway cache, so the test touches no network. The smoke runs with --time-scale 10: test/corpus.test.ts
// holds every maxMs at scale 1, and this run judges the package, not the machine.
// A third tarball (L3 Task 12, reviews EV1 and EV2) carries one defect for each frame-layer check whose passing line
// would print unchanged were the check's body gone: an assets.json that leaves an installed file out, a shipped
// mutant that its own row's scan passes, a timer started at import, and a DOM name read at import, each of the last
// two in a module no entry file is (dist/render/highlight.js, which only ./highlight reaches, and
// dist/frame/protocol.js, which ./frame and ./host reach). The smoke must fail it, naming each defect, and print
// every other line as the passing run does.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ASSET_BUDGETS } from '../scripts/build-frame.mjs';

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

const STRICT_LINE = 'consumer-smoke: the packed declarations typecheck under strict, nodenext and skipLibCheck: false';

/** The runtime exports of each L3 entry, as the smoke lists them (sorted). */
const FRAME_API = [
  'BRIDGE_LIMITS', 'BRIDGE_PROTOCOL', 'CSP_REFUSALS', 'DOC_FIELDS', 'ERROR_WHY', 'FRAGMENT_ID_GRAMMAR', 'FRAME_MANIFEST', 'FrameError',
  'MAX_SRCDOC_CHARS_DEFAULT', 'MERMAID_GATE_DEFAULTS', 'MERMAID_LIMIT_CEILINGS', 'OP_KEYS', 'PREF_KEYS', 'SEED_HTML_MAX_CHARS', 'SEED_SCHEMA',
  'checkFrameCsp', 'frameCsp', 'frameDocument', 'isFragmentId', 'mermaidGate',
];
const HIGHLIGHT_API = ['HIGHLIGHT_ENGINE', 'LANGUAGES', 'MAX_DOCUMENT_CHARS', 'MAX_LINE_CHARS', 'MAX_WHOLE_BLOCK_CHARS', 'createHighlighter', 'resolveLanguage'];

const INERT_LINE =
  'consumer-smoke: @synapsium-labs/docserver/frame, /host and /highlight import in Node and are import-inert, each imported alone in a fresh process: no new global and no timer, and /host reads no DOM name at import';
const ASSETS_LINE =
  'consumer-smoke: every one of the 13 assets.json entries resolves through ./assets/* into node_modules and re-hashes to its sha256 and bytes, and it lists every installed asset';
const SCANS_LINE =
  "consumer-smoke: the M8.3, M8.4 and M8.8 scans pass on both srcdocs and on the clean template, and each of the 16 labelled frame mutants fails its own row's scan";

/** Every line a passing smoke prints before its corpus line, in order. */
const SMOKE_LINES = [
  'consumer-smoke: installed the tarball offline',
  STRICT_LINE,
  'consumer-smoke: the frame and highlight declarations typecheck with no DOM library and no ambient types',
  'consumer-smoke: @synapsium-labs/docserver/render resolves into node_modules',
  'consumer-smoke: a deep import is refused (ERR_PACKAGE_PATH_NOT_EXPORTED)',
  'consumer-smoke: @synapsium-labs/docserver/enhance imports in Node and exports exactly EnhanceError, destroyEnhancement, enhance, goToHash, setEnhancementPrefs',
  'consumer-smoke: the stylesheet, the font licence and the Mermaid file resolve through ./assets/* into node_modules',
  "consumer-smoke: the Mermaid file imports through ./assets/*, and its one export is Mermaid's API, its start-on-load off",
  'consumer-smoke: a deep import of the enhance build is refused (ERR_PACKAGE_PATH_NOT_EXPORTED)',
  // the frame layer (L3 Task 12)
  'consumer-smoke: the exports map is exactly ./assets/*, ./conformance, ./enhance, ./frame, ./highlight, ./host, ./package.json, ./render',
  INERT_LINE,
  `consumer-smoke: @synapsium-labs/docserver/frame exports exactly ${FRAME_API.join(', ')}`,
  'consumer-smoke: @synapsium-labs/docserver/host exports exactly mountDocFrame',
  `consumer-smoke: @synapsium-labs/docserver/highlight exports exactly ${HIGHLIGHT_API.join(', ')}`,
  'consumer-smoke: deep imports of the frame, host and highlight builds and of ./frame-runtime are refused (ERR_PACKAGE_PATH_NOT_EXPORTED)',
  ASSETS_LINE,
  'consumer-smoke: frameDocument over mermaid-figures (with Mermaid) and headings (without), from the installed files and frameCsp(), inlines those files byte for byte, in order',
  SCANS_LINE,
  "consumer-smoke: the installed frame/reader.css and each srcdoc's style element hold the font notice with its OFL line",
  'consumer-smoke: bridgeCases() loads the bridge fixtures of protocol 1',
];

/** The only places a packed file may live. */
const ALLOWED = [
  /^dist\/(?:render|conformance|enhance)\/[A-Za-z]+(?:-[a-z]+)*\.(?:js|d\.ts)$/,
  // ./frame, ./host and ./highlight (L3 Task 12): their modules, the two generated ones and sha256 included.
  /^dist\/(?:frame|host|highlight)\/[a-z][a-z0-9]*(?:-[a-z]+)*(?:\.generated)?\.(?:js|d\.ts)$/,
  /^conformance\/(?:manifest|hostile|DEPARTURES|bridge-cases)\.json$/,
  /^conformance\/frame-mutants\/[a-z-]+\.(?:html|json)$/,
  /^conformance\/(?:corpus|expected)\/[A-Za-z0-9/_-]+\.(?:md|html|meta\.json)$/,
  /^assets\/reader\.css$/,
  /^assets\/fonts\/[A-Za-z0-9._-]+\.(?:woff2|txt|md)$/,
  /^assets\/mermaid\/mermaid\.mjs$/,
  // The frame assets (docserver L3): the committed manifest, the frame files and the Mermaid frame file (Task 6).
  /^assets\/assets\.json$/,
  /^assets\/frame\/(?:guard|bootstrap|enhance)\.js$|^assets\/frame\/reader\.css$/,
  /^assets\/mermaid\/mermaid\.frame\.js$/,
  /^(?:package\.json|README\.md|LICENSE|THIRD-PARTY-NOTICES)$/,
];

interface Packed {
  filename: string;
  files: string[];
}

let work = '';
let packed: Packed = { filename: '', files: [] };
let packedBytes = -1;
const refusedPacks = new Map<string, SpawnSyncReturns<string>>();
let smoke: SpawnSyncReturns<string> | null = null;
let brokenSmoke: SpawnSyncReturns<string> | null = null;
let defectiveSmoke: SpawnSyncReturns<string> | null = null;
const untypedSmokes = new Map<string, SpawnSyncReturns<string>>();

/** Each @types package a consumer needs, with the module whose declaration it supplies and who imports it. */
const UNTYPED: Record<string, { module: string; file: string }> = {
  '@types/markdown-it': { module: 'markdown-it', file: 'allowlist|render|scan' },
  '@types/js-yaml': { module: 'js-yaml', file: 'frontMatter' },
};

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
  // `npm run build`'s three steps, in its order (test/frame-build.test.ts pins the script).
  const mermaid = spawnSync(process.execPath, [path.join('scripts', 'build-mermaid.mjs')], { cwd: stage, encoding: 'utf8' });
  if (mermaid.status !== 0) throw new Error(`the Mermaid build failed: ${mermaid.stdout}${mermaid.stderr}`);
  const frame = spawnSync(process.execPath, [path.join('scripts', 'build-frame.mjs')], { cwd: stage, encoding: 'utf8' });
  if (frame.status !== 0) throw new Error(`the frame build failed: ${frame.stdout}${frame.stderr}`);
  const build = spawnSync(process.execPath, [TSC, '-p', 'tsconfig.build.json'], { cwd: stage, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(`build failed: ${build.stdout}${build.stderr}`);
  // npm's scripts on: prepack checks every byte under assets/ against assets/assets.json first.
  const pack = npm(['pack', '--json', '--pack-destination', work], stage);
  if (pack.status !== 0) throw new Error(`npm pack failed: ${pack.stderr}`);
  const [first] = JSON.parse(pack.stdout) as { filename: string; files: { path: string }[] }[];
  packed = { filename: first?.filename ?? '', files: (first?.files ?? []).map((f) => f.path).sort() };
  packedBytes = statSync(path.join(work, packed.filename)).size;
  const deps = realpathSync(path.join(ROOT, 'node_modules'));
  smoke = runSmoke([path.join(work, packed.filename), '--deps-from', deps, '--time-scale', '10']);
  // The same package with one of the two @types packages back in devDependencies: a consumer's install would
  // not bring it, so the strict typecheck of the packed declarations fails (review 458, F7). Each package has its
  // own run, because the two imports sit in different declaration files.
  const manifestPath = path.join(stage, 'package.json');
  const original = readFileSync(manifestPath, 'utf8');
  type Manifest = { dependencies: Record<string, string>; devDependencies: Record<string, string> };
  for (const name of Object.keys(UNTYPED)) {
    const untyped = JSON.parse(original) as Manifest;
    untyped.devDependencies[name] = untyped.dependencies[name] ?? '';
    delete untyped.dependencies[name];
    writeFileSync(manifestPath, JSON.stringify(untyped, null, 2));
    const untypedDir = path.join(work, `untyped-${name.replace(/\W/g, '-')}`);
    mkdirSync(untypedDir);
    const untypedPack = npm(['pack', '--json', '--ignore-scripts', '--pack-destination', untypedDir], stage);
    if (untypedPack.status !== 0) throw new Error(`npm pack failed: ${untypedPack.stderr}`);
    const tarball = path.join(untypedDir, packed.filename);
    untypedSmokes.set(name, runSmoke([tarball, '--deps-from', deps, '--time-scale', '10']));
  }
  writeFileSync(manifestPath, original);
  // The same package with four defects, one per frame-layer check that a deleted body would leave silent (EV1, EV2).
  const defects: [file: string, change: (text: string) => string][] = [
    [path.join('assets', 'assets.json'), (t) => {
      const m = JSON.parse(t) as { files: { path: string }[] };
      m.files = m.files.filter((x) => x.path !== 'fonts/README.md');
      return `${JSON.stringify(m, null, 2)}\n`;
    }],
    [path.join('conformance', 'frame-mutants', 'meta-appended.html'), () => readFileSync(path.join(stage, 'conformance', 'frame-mutants', 'clean.html'), 'utf8')],
    [path.join('dist', 'render', 'highlight.js'), (t) => `setTimeout(() => undefined, 0);\n${t}`],
    [path.join('dist', 'frame', 'protocol.js'), (t) => `void (typeof document);\n${t}`],
  ];
  const kept = defects.map(([file]) => [file, readFileSync(path.join(stage, file), 'utf8')] as const);
  for (const [file, change] of defects) writeFileSync(path.join(stage, file), change(readFileSync(path.join(stage, file), 'utf8')));
  const defective = path.join(work, 'defective');
  mkdirSync(defective);
  const defectivePack = npm(['pack', '--json', '--ignore-scripts', '--pack-destination', defective], stage);
  for (const [file, text] of kept) writeFileSync(path.join(stage, file), text);
  if (defectivePack.status !== 0) throw new Error(`npm pack failed: ${defectivePack.stderr}`);
  defectiveSmoke = runSmoke([path.join(defective, packed.filename), '--deps-from', deps, '--time-scale', '10']);
  // The same package with one packed golden changed: its own corpus no longer passes.
  const broken = path.join(work, 'broken');
  mkdirSync(broken);
  appendFileSync(path.join(stage, 'conformance', 'expected', 'headings.html'), 'x');
  const repack = npm(['pack', '--json', '--ignore-scripts', '--pack-destination', broken], stage);
  if (repack.status !== 0) throw new Error(`npm pack failed: ${repack.stderr}`);
  brokenSmoke = runSmoke([path.join(broken, packed.filename), '--deps-from', deps, '--time-scale', '10']);
  // prepack refuses bytes assets/assets.json does not name: a one-byte edit of a frame file, then a stray file. Each
  // destination exists, so npm itself would pack into it: only prepack's refusal can stop the pack (review E1).
  mkdirSync(path.join(work, 'refused-edit'));
  mkdirSync(path.join(work, 'refused-stray'));
  const guard = path.join(stage, 'assets', 'frame', 'guard.js');
  const guardText = readFileSync(guard, 'utf8');
  writeFileSync(guard, `${guardText} `);
  refusedPacks.set('a one-byte edit', npm(['pack', '--json', '--pack-destination', path.join(work, 'refused-edit')], stage));
  writeFileSync(guard, guardText);
  writeFileSync(path.join(stage, 'assets', 'frame', 'stray.js'), '');
  refusedPacks.set('an unlisted file', npm(['pack', '--json', '--pack-destination', path.join(work, 'refused-stray')], stage));
}, 300_000);

afterAll(() => {
  if (work !== '') rmSync(work, { recursive: true, force: true });
});

describe('npm pack', () => {
  it('names the tarball as CI expects it', () => {
    expect(packed.filename).toBe(TARBALL);
    expect(TARBALL).toBe('synapsium-labs-docserver-1.0.0.tgz');
  });

  it('holds the six entries with their types, the corpus files, the licence, the readme, the assets and their notices', () => {
    for (const must of [
      'dist/render/index.js',
      'dist/render/index.d.ts',
      'dist/conformance/index.js',
      'dist/conformance/index.d.ts',
      'dist/enhance/index.js',
      'dist/enhance/index.d.ts',
      // the three L3 entries (Task 12), the conformance entry's bridge fixtures and the labelled frame mutants
      'dist/frame/index.js',
      'dist/frame/index.d.ts',
      'dist/frame/manifest.generated.js',
      'dist/host/index.js',
      'dist/host/index.d.ts',
      'dist/highlight/index.js',
      'dist/highlight/index.d.ts',
      'conformance/bridge-cases.json',
      'conformance/frame-mutants/index.json',
      'conformance/frame-mutants/clean.html',
      'conformance/manifest.json',
      'conformance/hostile.json',
      'conformance/DEPARTURES.json',
      'conformance/expected/headings.html',
      'LICENSE',
      'README.md',
      'package.json',
      // the layout's stylesheet, its fonts, and the licence and notices the fonts must travel with
      'assets/reader.css',
      'assets/fonts/source-serif-4-latin-opsz-normal.woff2',
      'assets/fonts/source-serif-4-latin-opsz-italic.woff2',
      'assets/fonts/source-sans-3-latin-wght-normal.woff2',
      'assets/fonts/source-sans-3-latin-wght-italic.woff2',
      'assets/fonts/OFL.txt',
      'assets/fonts/README.md',
      // the Mermaid file, built from the pinned dev dependency, whose bundled packages the notices list
      'assets/mermaid/mermaid.mjs',
      // the frame assets and their manifest (L3 Task 6): required, since the build always makes them
      'assets/assets.json',
      'assets/frame/guard.js',
      'assets/frame/bootstrap.js',
      'assets/frame/enhance.js',
      'assets/frame/reader.css',
      'assets/mermaid/mermaid.frame.js',
      'THIRD-PARTY-NOTICES',
    ]) {
      expect(packed.files).toContain(must);
    }
  });

  it('holds every file runCorpus reads: each case input and its expected html and meta', () => {
    const needed = manifest
      .filter((m) => m.kind !== 'generated')
      .flatMap((m) => [`conformance/corpus/${m.id}.md`, `conformance/expected/${m.id}.html`, `conformance/expected/${m.id}.meta.json`]);
    expect(needed.length).toBe(162);
    expect(needed.filter((f) => !packed.files.includes(f))).toEqual([]);
  });

  it('L3.M18: the tarball is within its 8 MiB budget', () => {
    expect(ASSET_BUDGETS.tarball).toBe(8 * 1024 * 1024);
    expect(packedBytes).toBeGreaterThan(0);
    expect(packedBytes).toBeLessThanOrEqual(ASSET_BUDGETS.tarball);
  });

  it('L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed', () => {
    // Soft, so a log names every claim that fails, each on its own: the exit, the reason, the empty destination.
    const edit = refusedPacks.get('a one-byte edit');
    expect.soft(edit?.status, 'the refused edit exits non-zero').not.toBe(0);
    expect.soft(edit?.stderr).toMatch(/verify-assets: assets\/frame\/guard\.js: /);
    const stray = refusedPacks.get('an unlisted file');
    expect.soft(stray?.status, 'the refused stray file exits non-zero').not.toBe(0);
    expect.soft(stray?.stderr).toContain('verify-assets: assets/frame/stray.js: not listed in assets/assets.json');
    for (const dir of ['refused-edit', 'refused-stray']) {
      expect.soft(existsSync(path.join(work, dir)), `${dir} exists`).toBe(true);
      expect.soft(existsSync(path.join(work, dir, packed.filename)), `nothing is packed into ${dir}`).toBe(false);
    }
  });

  it('holds nothing else: no references, scripts, sources, tests, CI files or working papers', () => {
    expect(packed.files.filter((f) => !ALLOWED.some((re) => re.test(f)))).toEqual([]);
    expect(packed.files.filter((f) => /^(?:conformance\/reference|scripts|src|test|docs|\.github)\//.test(f))).toEqual([]);
  });

  it('ships no frame runtime module: its code ships only as the hashed scripts under assets/frame/', () => {
    expect(packed.files.filter((f) => /frame-runtime/.test(f))).toEqual([]);
  });

  it('holds every labelled frame mutant its index.json lists', () => {
    const index = JSON.parse(readFileSync(path.join(ROOT, 'conformance', 'frame-mutants', 'index.json'), 'utf8')) as { mutants: { file: string }[] };
    const want = index.mutants.map((m) => `conformance/frame-mutants/${m.file}`);
    expect(want.length).toBe(16);
    expect(want.filter((f) => !packed.files.includes(f))).toEqual([]);
  });
});

describe('the packed package, imported by name', () => {
  it('passes the whole corpus through the consumer smoke', () => {
    expect(smoke?.stderr).toBe('');
    expect(smoke?.stdout).toBe([...SMOKE_LINES, 'consumer-smoke: 84 of 84 cases passed', ''].join('\n'));
    expect(smoke?.status).toBe(0);
  });

  it.each(Object.entries(UNTYPED))(
    'typechecks under a strict consumer config: with %s as a devDependency it fails with TS7016',
    (name, { module, file }) => {
      const r = untypedSmokes.get(name);
      expect(r?.status).toBe(1);
      expect(r?.stdout).toBe('consumer-smoke: installed the tarball offline\n');
      const error = new RegExp(
        `dist/render/(?:${file})\\.d\\.ts\\(\\d+,\\d+\\): error TS7016: Could not find a declaration file for module '${module}'`,
      );
      expect(r?.stderr).toMatch(error);
    },
  );

  it('fails, naming the case, when the packed corpus does not pass', () => {
    const lines = brokenSmoke?.stdout.split('\n') ?? [];
    expect(lines.slice(0, SMOKE_LINES.length + 1)).toEqual([...SMOKE_LINES, 'consumer-smoke: 83 of 84 cases passed']);
    expect(lines[SMOKE_LINES.length + 1]).toMatch(/^consumer-smoke: headings: html differs at offset \d+/);
    expect(brokenSmoke?.status).toBe(1);
  });
});

describe('the packed package with a defect for each frame-layer check (reviews EV1, EV2)', () => {
  it('fails, naming each defect, and prints every other line as the passing run does', () => {
    const at = (line: string): number => SMOKE_LINES.indexOf(line);
    const want: string[] = [...SMOKE_LINES];
    // In the order the check prints them: the import probe, then assets.json, then the scans.
    want.splice(at(INERT_LINE), 1,
      'consumer-smoke: @synapsium-labs/docserver/highlight, imported alone in a fresh process, read setTimeout and added the globals none',
      'consumer-smoke: @synapsium-labs/docserver/host, imported alone in a fresh process, read document and added the globals none');
    want.splice(want.indexOf(ASSETS_LINE), 1, 'consumer-smoke: assets: fonts/README.md is installed but not listed in assets.json');
    want.splice(want.indexOf(SCANS_LINE), 1, 'consumer-smoke: scans: meta-appended.html passes the M8.3 scan it must fail');
    expect(defectiveSmoke?.stdout).toBe([...want, 'consumer-smoke: 84 of 84 cases passed', ''].join('\n'));
    expect(defectiveSmoke?.stderr).toBe('');
    expect(defectiveSmoke?.status).toBe(1);
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
