// The packed-consumer smoke (docserver L1; architecture section F, Task 12).
//
//   node scripts/consumer-smoke.mjs <tarball>                            install from the registry (CI)
//   node scripts/consumer-smoke.mjs <tarball> --deps-from <node_modules>  offline (test/pack.test.ts)
//   ... [--time-scale <n>]                                               runCorpus's timeScale (default 1)
//
// It makes a throwaway consumer project, installs the packed tarball there, and runs a check from inside that
// project, so every import resolves by package name through the tarball's own exports map, never through this
// checkout. The check imports `@synapsium-labs/docserver/render` and `/conformance`, confirms the entry
// resolved into the consumer's node_modules and that a deep import past the exports map is refused, imports
// `/enhance` in Node (it is import-inert) and checks its four exports, resolves the stylesheet and the font licence
// through `./assets/*`, refuses a deep import of the enhance build, and runs runCorpus(render, { scanRefs }).
// Before that it typechecks, with this checkout's own typescript, a consumer file that imports the three code
// entries together with every packed declaration file (dist/**/*.d.ts, including those no entry reaches), under
// the flags a strict consumer uses (strict, nodenext, skipLibCheck: false), so a packed declaration whose imports
// a consumer cannot resolve fails the smoke; the consumer gets no Node types, because the packed declarations
// reference none, and the DOM library, because `./enhance`'s declarations name DOM types. It exits 0 only when every case passes, 1 when the check or
// the typecheck fails, 2 on a usage error. Without --deps-from, `npm install` fetches the package's dependencies
// from the registry, as a real consumer would, with `--before` set MIN_AGE_DAYS back from the moment it runs, so
// the transitive dependencies the lock does not pin obey the same age rule as every direct pin; with it, the
// tarball is unpacked as the package and its dependencies are linked from an installed tree, and nothing touches
// the network. --time-scale multiplies every verdict's maxMs, for a busy machine (the test passes one; CI does
// not). Node built-ins only; dev tooling, never shipped.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE = '@synapsium-labs/docserver';

/** A dependency version must be at least this many days old, the rule every pin follows. */
const MIN_AGE_DAYS = 14;

/** The `--before` cutoff for an install made at `now` (a Date): MIN_AGE_DAYS back, as an ISO timestamp. */
function installCutoff(now) {
  return new Date(now.getTime() - MIN_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** The typescript compiler of the checkout this script lives in; the consumer never installs one. */
const TSC = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));

/** The consumer's tsconfig: what a strict consumer of a package with declarations sets. skipLibCheck stays off. */
const CONSUMER_TSCONFIG = {
  compilerOptions: {
    strict: true,
    module: 'nodenext',
    moduleResolution: 'nodenext',
    skipLibCheck: false,
    noEmit: true,
    target: 'es2022',
    // ./enhance's declarations name DOM types (Element, Node, AbortSignal): its consumers need the DOM library.
    lib: ['es2022', 'dom'],
  },
  // Every packed declaration file is listed by pattern, because `import("js-yaml")` in frontMatter.d.ts is
  // reached by neither entry's imports.
  include: ['check.ts', `node_modules/${PACKAGE}/dist/**/*.d.ts`],
};

/** The consumer's typed file: a value and a type from each entry, so every packed declaration is read. */
const CHECK_TS = `import { ALLOWLIST, render } from '${PACKAGE}/render';
import type { RenderResult } from '${PACKAGE}/render';
import { runCorpus } from '${PACKAGE}/conformance';
import type { CorpusRun } from '${PACKAGE}/conformance';
import { destroyEnhancement, enhance, EnhanceError, setEnhancementPrefs } from '${PACKAGE}/enhance';
import type { EnhanceOptions } from '${PACKAGE}/enhance';

export const result: RenderResult = render('# title');
export const run: CorpusRun = runCorpus(render, { timeScale: 1 });
export const allowlist: unknown = ALLOWLIST;
export const options: EnhanceOptions = { prefs: { theme: 'dark' }, folds: true };
export const layout: unknown[] = [enhance, destroyEnhancement, setEnhancementPrefs, EnhanceError];
`;

/** Runs inside the consumer project; every specifier resolves from there. */
const check = (timeScale) => `import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { render, scanRefs } from '${PACKAGE}/render';
import { runCorpus } from '${PACKAGE}/conformance';

const say = (line) => console.log(\`consumer-smoke: \${line}\`);
let ok = true;

const resolved = import.meta.resolve('${PACKAGE}/render');
if (resolved.endsWith('/node_modules/${PACKAGE}/dist/render/index.js')) {
  say('${PACKAGE}/render resolves into node_modules');
} else {
  ok = false;
  say(\`${PACKAGE}/render resolves outside the installed package: \${resolved}\`);
}

try {
  await import('${PACKAGE}/dist/render/index.js');
  ok = false;
  say('a deep import resolved: the exports map must be the whole public surface');
} catch (e) {
  if (e?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') say('a deep import is refused (ERR_PACKAGE_PATH_NOT_EXPORTED)');
  else {
    ok = false;
    say(\`a deep import failed for another reason: \${String(e)}\`);
  }
}

const enhanceApi = Object.keys(await import('${PACKAGE}/enhance')).sort().join(', ');
if (enhanceApi === 'EnhanceError, destroyEnhancement, enhance, setEnhancementPrefs') {
  say(\`${PACKAGE}/enhance imports in Node and exports exactly \${enhanceApi}\`);
} else {
  ok = false;
  say(\`${PACKAGE}/enhance exports \${enhanceApi}\`);
}

const assets = ['assets/reader.css', 'assets/fonts/OFL.txt'].map((a) => [a, import.meta.resolve(\`${PACKAGE}/\${a}\`)]);
const stray = assets.filter(([a, url]) => !url.endsWith(\`/node_modules/${PACKAGE}/\${a}\`) || !existsSync(fileURLToPath(url)));
if (stray.length === 0) say('the stylesheet and the font licence resolve through ./assets/* into node_modules');
else {
  ok = false;
  for (const [a, url] of stray) say(\`\${a} resolves to \${url}, which is not the installed file\`);
}

try {
  await import('${PACKAGE}/dist/enhance/index.js');
  ok = false;
  say('a deep import of the enhance build resolved: the exports map must be the whole public surface');
} catch (e) {
  if (e?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') say('a deep import of the enhance build is refused (ERR_PACKAGE_PATH_NOT_EXPORTED)');
  else {
    ok = false;
    say(\`a deep import of the enhance build failed for another reason: \${String(e)}\`);
  }
}

const run = runCorpus(render, { scanRefs, timeScale: ${timeScale} });
say(\`\${run.passed} of \${run.total} cases passed\`);
for (const r of run.results) if (!r.ok) say(\`\${r.id}: \${r.failures.join(' | ')}\`);
process.exitCode = ok && run.ok ? 0 : 1;
`;

function usage() {
  console.error('usage: node scripts/consumer-smoke.mjs <tarball> [--deps-from <node_modules>] [--time-scale <n>]');
  return 2;
}

/** Run a command to completion; its output goes to stderr, so stdout carries only the smoke's own lines. */
function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) {
    process.stderr.write(`${r.stdout ?? ''}${r.stderr ?? ''}`);
    throw new Error(`consumer-smoke: ${cmd} ${args.join(' ')} exited ${String(r.status)}`);
  }
}

/** Unpack the tarball as node_modules/<PACKAGE> and link each of its dependencies from `depsFrom`. */
function installOffline(tarball, depsFrom, dir) {
  const scope = path.join(dir, 'node_modules', path.dirname(PACKAGE));
  mkdirSync(scope, { recursive: true });
  run('tar', ['-xzf', tarball, '-C', scope], dir);
  const target = path.join(dir, 'node_modules', PACKAGE);
  renameSync(path.join(scope, 'package'), target);
  const { dependencies = {} } = JSON.parse(readFileSync(path.join(target, 'package.json'), 'utf8'));
  for (const name of Object.keys(dependencies)) {
    const link = path.join(dir, 'node_modules', name);
    mkdirSync(path.dirname(link), { recursive: true });
    symlinkSync(path.join(depsFrom, name), link, 'dir');
  }
}

/** The command line: the tarball, then each option at most once, each with its value; null when malformed. */
function parseArgs(argv) {
  const [tarball, ...rest] = argv;
  if (tarball === undefined || tarball.startsWith('--') || rest.length % 2 !== 0) return null;
  const options = new Map();
  for (let i = 0; i < rest.length; i += 2) {
    const [flag, value] = [rest[i], rest[i + 1]];
    if (!['--deps-from', '--time-scale'].includes(flag) || options.has(flag)) return null;
    options.set(flag, value);
  }
  const timeScale = Number(options.get('--time-scale') ?? '1');
  if (!(Number.isFinite(timeScale) && timeScale > 0)) return null;
  const deps = options.get('--deps-from');
  return { tarball: path.resolve(tarball), depsFrom: deps === undefined ? null : path.resolve(deps), timeScale };
}

function main(argv) {
  const args = parseArgs(argv);
  if (args === null) return usage();
  const { tarball, depsFrom, timeScale } = args;
  const dir = mkdtempSync(path.join(tmpdir(), 'docserver-consumer-'));
  try {
    const project = { name: 'docserver-consumer-smoke', version: '0.0.0', private: true, type: 'module' };
    writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(project, null, 2)}\n`);
    if (depsFrom === null) {
      const before = `--before=${installCutoff(new Date())}`;
      run('npm', ['install', '--no-save', '--no-audit', '--no-fund', '--ignore-scripts', before, tarball], dir);
      console.log('consumer-smoke: installed the tarball from the registry');
    } else {
      installOffline(tarball, depsFrom, dir);
      console.log('consumer-smoke: installed the tarball offline');
    }
    writeFileSync(path.join(dir, 'tsconfig.json'), `${JSON.stringify(CONSUMER_TSCONFIG, null, 2)}\n`);
    writeFileSync(path.join(dir, 'check.ts'), CHECK_TS);
    run(process.execPath, [TSC, '-p', 'tsconfig.json'], dir);
    console.log('consumer-smoke: the packed declarations typecheck under strict, nodenext and skipLibCheck: false');
    writeFileSync(path.join(dir, 'check.mjs'), check(timeScale));
    const r = spawnSync(process.execPath, ['check.mjs'], { cwd: dir, stdio: 'inherit' });
    return r.status === 0 ? 0 : 1;
  } catch (e) {
    console.error(String(e instanceof Error ? e.message : e));
    return 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

process.exitCode = main(process.argv.slice(2));
