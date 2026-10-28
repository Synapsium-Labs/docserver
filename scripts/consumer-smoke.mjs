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
// `/enhance` in Node (it is import-inert) and checks its five exports, resolves the stylesheet, the font licence and
// the Mermaid file through `./assets/*` and imports the Mermaid file there (its one export, the default, is Mermaid's
// API, with `startOnLoad` false, so the file is import-inert), refuses a deep import of the enhance build, and runs
// runCorpus(render, { scanRefs }).
// Since L3 (Task 12) it also checks the frame layer as a consumer gets it: the installed exports map is exactly the
// public surface; `./frame`, `./host` and `./highlight` import in Node, each import-inert (no new global, no timer),
// `./host` reading no DOM name at import, each imported alone in a fresh process with its traps set before any of the
// package's modules loads (so a module the entry reaches is judged, not only the entry file), and each exports exactly
// its names; deep imports of their builds and of the
// frame runtime are refused; every assets/assets.json entry resolves through `./assets/*` into the install and re-hashes
// to its sha256 and bytes, and every installed asset is listed; frameDocument over two corpus documents, one with
// Mermaid and one without, with the installed asset texts and frameCsp(), inlines the installed files byte for byte, in
// order; the library's srcdoc scans (scripts/frame-scans.mjs, rows M8.3, M8.4 and M8.8) pass on those srcdocs and on
// the shipped clean mutant template, and every labelled frame mutant the package ships fails its own row's scan; the
// installed frame/reader.css and each srcdoc's style element hold the font notice with its OFL line; and bridgeCases()
// loads.
// Before that it typechecks, with this checkout's own typescript, a consumer file that imports every code entry
// together with every packed declaration file (dist/**/*.d.ts, including those no entry reaches), under
// the flags a strict consumer uses (strict, nodenext, skipLibCheck: false), so a packed declaration whose imports
// a consumer cannot resolve fails the smoke; the consumer gets no Node types, because the packed declarations
// reference none, and the DOM library, because `./enhance`'s and `./host`'s declarations name DOM types. A second
// project typechecks `./frame` and `./highlight` with every one of their declaration files and no DOM library and no
// ambient types, as a worker or a server would. It exits 0 only when every case passes, 1 when the check or
// the typecheck fails, 2 on a usage error. Without --deps-from, `npm install` fetches the package's dependencies
// from the registry, as a real consumer would, with `--before` set MIN_AGE_DAYS back from the moment it runs, so
// the transitive dependencies the lock does not pin obey the same age rule as every direct pin; with it, the
// tarball is unpacked as the package and its dependencies are linked from an installed tree, and nothing touches
// the network. --time-scale multiplies every verdict's maxMs, for a busy machine (the test passes one; CI does
// not). Node built-ins only, apart from the srcdoc scans, which the check imports from this checkout's
// scripts/frame-scans.mjs (they parse with this checkout's parse5, as the typecheck uses its typescript); dev tooling,
// never shipped.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE = '@synapsium-labs/docserver';

/** The installed exports map's keys, sorted: the whole public surface. */
const EXPORT_KEYS = ['./assets/*', './conformance', './enhance', './frame', './highlight', './host', './package.json', './render'];

/** The runtime exports of each L3 entry, sorted. */
const ENTRY_API = {
  frame: [
    'BRIDGE_LIMITS', 'BRIDGE_PROTOCOL', 'CSP_REFUSALS', 'DOC_FIELDS', 'ERROR_WHY', 'FRAGMENT_ID_GRAMMAR', 'FRAME_MANIFEST',
    'FrameError', 'MAX_SRCDOC_CHARS_DEFAULT', 'MERMAID_GATE_DEFAULTS', 'MERMAID_LIMIT_CEILINGS', 'OP_KEYS', 'PREF_KEYS',
    'SEED_HTML_MAX_CHARS', 'SEED_SCHEMA', 'checkFrameCsp', 'frameCsp', 'frameDocument', 'isFragmentId', 'mermaidGate',
  ],
  host: ['mountDocFrame'],
  highlight: ['HIGHLIGHT_ENGINE', 'LANGUAGES', 'MAX_DOCUMENT_CHARS', 'MAX_LINE_CHARS', 'MAX_WHOLE_BLOCK_CHARS', 'createHighlighter', 'resolveLanguage'],
};

/** A dependency version must be at least this many days old, the rule every pin follows. */
const MIN_AGE_DAYS = 14;

/** The `--before` cutoff for an install made at `now` (a Date): MIN_AGE_DAYS back, as an ISO timestamp. */
function installCutoff(now) {
  return new Date(now.getTime() - MIN_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/** The typescript compiler of the checkout this script lives in; the consumer never installs one. */
const TSC = fileURLToPath(new URL('../node_modules/typescript/bin/tsc', import.meta.url));

/** The library's srcdoc scans, in this checkout (the consumer never installs their parser). */
const SCANS_URL = new URL('./frame-scans.mjs', import.meta.url).href;

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

/**
 * The second consumer project (L3 Task 12): `./frame` and `./highlight`, whose declarations name no DOM type, read with
 * every one of their packed declaration files by a project with no DOM library and no ambient types (a worker's or a
 * server's), so a declaration that reaches for the DOM fails the smoke.
 */
const PURE_TSCONFIG = {
  compilerOptions: { ...CONSUMER_TSCONFIG.compilerOptions, lib: ['es2022'], types: [] },
  include: ['check-pure.ts', `node_modules/${PACKAGE}/dist/frame/**/*.d.ts`, `node_modules/${PACKAGE}/dist/highlight/**/*.d.ts`],
};

/** The consumer's typed file: a value and a type from each entry, so every packed declaration is read. */
const CHECK_TS = `import { ALLOWLIST, render } from '${PACKAGE}/render';
import type { RenderResult } from '${PACKAGE}/render';
import { bridgeCases, runCorpus } from '${PACKAGE}/conformance';
import type { BridgeCases, CorpusRun } from '${PACKAGE}/conformance';
import { destroyEnhancement, enhance, EnhanceError, goToHash, setEnhancementPrefs } from '${PACKAGE}/enhance';
import type { EnhanceOptions } from '${PACKAGE}/enhance';
import { frameCsp, frameDocument } from '${PACKAGE}/frame';
import type { FrameOptions, RenderInput } from '${PACKAGE}/frame';
import { mountDocFrame } from '${PACKAGE}/host';
import type { DocFrame, HostAdapters } from '${PACKAGE}/host';
import { createHighlighter } from '${PACKAGE}/highlight';
import type { Highlighter } from '${PACKAGE}/highlight';

export const result: RenderResult = render('# title');
export const run: CorpusRun = runCorpus(render, { timeScale: 1 });
export const cases: BridgeCases = bridgeCases();
export const allowlist: unknown = ALLOWLIST;
export const options: EnhanceOptions = { prefs: { theme: 'dark' }, folds: true };
export const layout: unknown[] = [enhance, destroyEnhancement, setEnhancementPrefs, EnhanceError];
export function navigate(root: HTMLElement): void {
  goToHash(root, 'section');
  goToHash(root, null, 'from-token');
}
export function srcdoc(input: RenderInput, o: FrameOptions): string {
  return frameDocument(input, { ...o, csp: frameCsp() });
}
export function mount(el: HTMLElement, document: RenderInput, adapters: HostAdapters): DocFrame {
  return mountDocFrame(el, { document, adapters });
}
export const highlighter: Highlighter = createHighlighter();
`;

/** The pure consumer's typed file: `./frame` and `./highlight` only, with no DOM library. */
const CHECK_PURE_TS = `import { frameCsp, frameDocument, mermaidGate } from '${PACKAGE}/frame';
import type { FrameOptions, RenderInput } from '${PACKAGE}/frame';
import { createHighlighter } from '${PACKAGE}/highlight';
import type { HighlightResult } from '${PACKAGE}/highlight';

export function srcdoc(input: RenderInput, o: FrameOptions): string {
  const gate = mermaidGate({ fences: 0, largestChars: 0, totalChars: 0 });
  return frameDocument(input, { ...o, csp: frameCsp(), mermaid: gate.inline ? { maxTextSize: gate.maxTextSize } : null });
}
export const code: HighlightResult = createHighlighter().highlight('let a = 1;', 'js');
`;

/** Runs inside the consumer project; every specifier resolves from there. */
const check = (timeScale) => `import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, scanRefs } from '${PACKAGE}/render';
import { bridgeCases, loadCorpus, runCorpus } from '${PACKAGE}/conformance';
import { isElement, SCANS, textOf, tree } from '${SCANS_URL}';

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
if (enhanceApi === 'EnhanceError, destroyEnhancement, enhance, goToHash, setEnhancementPrefs') {
  say(\`${PACKAGE}/enhance imports in Node and exports exactly \${enhanceApi}\`);
} else {
  ok = false;
  say(\`${PACKAGE}/enhance exports \${enhanceApi}\`);
}

const assets = ['assets/reader.css', 'assets/fonts/OFL.txt', 'assets/mermaid/mermaid.mjs'].map((a) => [a, import.meta.resolve(\`${PACKAGE}/\${a}\`)]);
const stray = assets.filter(([a, url]) => !url.endsWith(\`/node_modules/${PACKAGE}/\${a}\`) || !existsSync(fileURLToPath(url)));
if (stray.length === 0) say('the stylesheet, the font licence and the Mermaid file resolve through ./assets/* into node_modules');
else {
  ok = false;
  for (const [a, url] of stray) say(\`\${a} resolves to \${url}, which is not the installed file\`);
}

try {
  const mermaidFile = await import('${PACKAGE}/assets/mermaid/mermaid.mjs');
  const api = mermaidFile.default;
  const names = Object.keys(mermaidFile).join(', ');
  if (names === 'default' && ['initialize', 'run', 'render'].every((f) => typeof api?.[f] === 'function') && api.startOnLoad === false) {
    say("the Mermaid file imports through ./assets/*, and its one export is Mermaid's API, its start-on-load off");
  } else {
    ok = false;
    say(\`the Mermaid file exports \${names} (startOnLoad \${String(api?.startOnLoad)}), which is not Mermaid's API alone with its start-on-load off\`);
  }
} catch (e) {
  ok = false;
  say(\`the Mermaid file did not import: \${String(e)}\`);
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

${FRAME_CHECK}
const run = runCorpus(render, { scanRefs, timeScale: ${timeScale} });
say(\`\${run.passed} of \${run.total} cases passed\`);
for (const r of run.results) if (!r.ok) say(\`\${r.id}: \${r.failures.join(' | ')}\`);
process.exitCode = ok && run.ok ? 0 : 1;
`;

/**
 * The frame layer's checks (L3 Task 12), run inside the consumer's check after the L2 ones; each case says one line
 * when it holds and names what is wrong when it does not.
 */
const FRAME_CHECK = `// ── the frame layer (L3) ──
const pkgDir = path.dirname(fileURLToPath(import.meta.resolve('${PACKAGE}/package.json')));
const installed = JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
const exportKeys = Object.keys(installed.exports ?? {}).sort().join(', ');
const EXPORT_KEYS = ${JSON.stringify(EXPORT_KEYS)}.join(', ');
if (exportKeys === EXPORT_KEYS) say(\`the exports map is exactly \${exportKeys}\`);
else {
  ok = false;
  say(\`the exports map is \${exportKeys}, not \${EXPORT_KEYS}\`);
}

// Import-inert: each entry imported alone, in a fresh process (inert.mjs), with its traps set before any module of
// the package loads; this process has already loaded ./render and ./conformance, and with them modules the entries
// share, which a trap set here would never see run (review EV1). No new global and no timer, and ./host reads no DOM
// name at import.
const inertProblems = [];
const INERT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'inert.mjs');
for (const [name, dom] of [['frame', false], ['highlight', false], ['host', true]]) {
  const r = spawnSync(process.execPath, [INERT, \`${PACKAGE}/\${name}\`, dom ? 'dom' : 'no-dom'], { encoding: 'utf8' });
  let got = null;
  try {
    got = JSON.parse(r.stdout);
  } catch {
    got = null;
  }
  if (r.status !== 0 || got === null) inertProblems.push(\`${PACKAGE}/\${name}: the fresh-process import probe exited \${String(r.status)}: \${r.stderr.trim()}\`);
  else if (got.error !== null) inertProblems.push(\`${PACKAGE}/\${name} did not import in a fresh process: \${got.error}\`);
  else if (got.touched.length > 0 || got.added.length > 0) {
    inertProblems.push(\`${PACKAGE}/\${name}, imported alone in a fresh process, read \${got.touched.join(', ') || 'nothing'} and added the globals \${got.added.join(', ') || 'none'}\`);
  }
}
if (inertProblems.length === 0) {
  say('${PACKAGE}/frame, /host and /highlight import in Node and are import-inert, each imported alone in a fresh process: no new global and no timer, and /host reads no DOM name at import');
} else {
  ok = false;
  for (const p of inertProblems) say(p);
}
const entries = {
  frame: await import('${PACKAGE}/frame'),
  highlight: await import('${PACKAGE}/highlight'),
  host: await import('${PACKAGE}/host'),
};

const API = ${JSON.stringify(ENTRY_API)};
for (const [name, want] of Object.entries(API)) {
  const got = Object.keys(entries[name]).sort().join(', ');
  if (got === want.join(', ')) say(\`${PACKAGE}/\${name} exports exactly \${got}\`);
  else {
    ok = false;
    say(\`${PACKAGE}/\${name} exports \${got}\`);
  }
}

const deep = [];
for (const spec of ['dist/frame/index.js', 'dist/host/index.js', 'dist/highlight/index.js', 'frame-runtime']) {
  try {
    await import(\`${PACKAGE}/\${spec}\`);
    deep.push(\`\${spec} resolved\`);
  } catch (e) {
    if (e?.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') deep.push(\`\${spec} failed for another reason: \${String(e)}\`);
  }
}
if (deep.length === 0) say('deep imports of the frame, host and highlight builds and of ./frame-runtime are refused (ERR_PACKAGE_PATH_NOT_EXPORTED)');
else {
  ok = false;
  for (const d of deep) say(\`a deep import: \${d}\`);
}

// Every assets.json entry, through ./assets/*, against its sha256 and bytes; every installed asset listed.
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifestUrl = import.meta.resolve('${PACKAGE}/assets/assets.json');
const manifest = JSON.parse(readFileSync(fileURLToPath(manifestUrl), 'utf8'));
const assetsDir = path.dirname(fileURLToPath(manifestUrl));
const assetProblems = [];
if (manifest.package !== '${PACKAGE}' || manifest.version !== installed.version || manifest.bridgeProtocol !== entries.frame.BRIDGE_PROTOCOL) {
  assetProblems.push(\`assets.json names \${manifest.package} \${manifest.version}, protocol \${manifest.bridgeProtocol}\`);
}
for (const f of manifest.files) {
  const url = import.meta.resolve(\`${PACKAGE}/assets/\${f.path}\`);
  if (!url.endsWith(\`/node_modules/${PACKAGE}/assets/\${f.path}\`) || !existsSync(fileURLToPath(url))) {
    assetProblems.push(\`\${f.path} resolves to \${url}, which is not an installed file\`);
    continue;
  }
  const bytes = readFileSync(fileURLToPath(url));
  if (bytes.length !== f.bytes || sha256(bytes) !== f.sha256) assetProblems.push(\`\${f.path} does not re-hash to its sha256 and bytes\`);
}
const listed = new Set(manifest.files.map((f) => f.path));
const onDisk = readdirSync(assetsDir, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => path.relative(assetsDir, path.join(d.parentPath, d.name)).split(path.sep).join('/'))
  .filter((p) => p !== 'assets.json');
for (const p of onDisk) if (!listed.has(p)) assetProblems.push(\`\${p} is installed but not listed in assets.json\`);
if (assetProblems.length === 0) {
  say(\`every one of the \${manifest.files.length} assets.json entries resolves through ./assets/* into node_modules and re-hashes to its sha256 and bytes, and it lists every installed asset\`);
} else {
  ok = false;
  for (const p of assetProblems) say(\`assets: \${p}\`);
}

// frameDocument over a document with Mermaid and one without, from the installed texts, under frameCsp().
const { frameCsp, frameDocument, mermaidGate } = entries.frame;
const assetPath = (rel) => fileURLToPath(import.meta.resolve(\`${PACKAGE}/assets/\${rel}\`));
const ASSET_FILES = { guard: 'frame/guard.js', bootstrap: 'frame/bootstrap.js', enhance: 'frame/enhance.js', css: 'frame/reader.css', mermaid: 'mermaid/mermaid.frame.js' };
const assetBytes = Object.fromEntries(Object.entries(ASSET_FILES).map(([k, rel]) => [k, readFileSync(assetPath(rel))]));
const assetTexts = Object.fromEntries(Object.entries(assetBytes).map(([k, b]) => [k, b.toString('utf8')]));
const corpus = loadCorpus();
const srcdocs = [];
const frameProblems = [];
for (const [id, withMermaid] of [['mermaid-figures', true], ['headings', false]]) {
  const c = corpus.find((x) => x.id === id);
  const result = render(c.input, c.options);
  const scan = scanRefs(c.input);
  const gate = mermaidGate(scan.mermaid);
  if (gate.inline !== withMermaid) frameProblems.push(\`\${id}: the Mermaid gate answers \${String(gate.inline)}\`);
  let srcdoc = '';
  try {
    srcdoc = frameDocument({ result, scan }, { csp: frameCsp(), nonce: '0123456789abcdef0123456789abcdef', assets: assetTexts, mermaid: gate.inline ? { maxTextSize: gate.maxTextSize } : null });
  } catch (e) {
    frameProblems.push(\`\${id}: frameDocument threw \${String(e)}\`);
    continue;
  }
  srcdocs.push([id, srcdoc]);
  const kids = tree(srcdoc).head.childNodes.filter(isElement);
  const scripts = kids.filter((e) => e.tagName === 'script' && e.attrs.length === 0).map(textOf);
  const want = withMermaid ? ['guard', 'bootstrap', 'enhance', 'mermaid'] : ['guard', 'bootstrap', 'enhance'];
  const same = scripts.length === want.length && want.every((k, i) => Buffer.from(scripts[i], 'utf8').equals(assetBytes[k]));
  const styles = kids.filter((e) => e.tagName === 'style').map(textOf);
  if (!same) frameProblems.push(\`\${id}: the scripts are not \${want.join(', ')} byte for byte, in order\`);
  if (styles.length !== 1 || !Buffer.from(styles[0], 'utf8').equals(assetBytes.css)) frameProblems.push(\`\${id}: the style is not frame/reader.css byte for byte\`);
}
if (frameProblems.length === 0) {
  say('frameDocument over mermaid-figures (with Mermaid) and headings (without), from the installed files and frameCsp(), inlines those files byte for byte, in order');
} else {
  ok = false;
  for (const p of frameProblems) say(\`frameDocument: \${p}\`);
}

// The srcdoc scans on both outputs and on the shipped clean template; each labelled mutant fails its own row's scan.
const mutantsDir = path.join(pkgDir, 'conformance', 'frame-mutants');
const index = JSON.parse(readFileSync(path.join(mutantsDir, 'index.json'), 'utf8'));
const values = { csp: frameCsp(), ...assetTexts };
const expand = (t) => t.replace(/\\{\\{docserver:(csp|guard|bootstrap|css|enhance|mermaid)\\}\\}/g, (_m, name) => values[name]);
const scanProblems = [];
const clean = expand(readFileSync(path.join(mutantsDir, index.clean), 'utf8'));
for (const [label, srcdoc] of [...srcdocs, [index.clean, clean]]) {
  for (const [row, scan] of Object.entries(SCANS)) {
    const found = scan(srcdoc);
    if (found.length > 0) scanProblems.push(\`\${label} fails the \${row} scan: \${found.join('; ')}\`);
  }
}
for (const m of index.mutants) {
  const scan = SCANS[m.row];
  if (scan === undefined) {
    scanProblems.push(\`\${m.file} names an unknown row \${m.row}\`);
    continue;
  }
  if (scan(expand(readFileSync(path.join(mutantsDir, m.file), 'utf8'))).length === 0) scanProblems.push(\`\${m.file} passes the \${m.row} scan it must fail\`);
}
if (index.mutants.length === 0) scanProblems.push('the package ships no frame mutant');
if (scanProblems.length === 0) {
  say(\`the M8.3, M8.4 and M8.8 scans pass on both srcdocs and on the clean template, and each of the \${index.mutants.length} labelled frame mutants fails its own row's scan\`);
} else {
  ok = false;
  for (const p of scanProblems) say(\`scans: \${p}\`);
}

// The font notice: in the installed frame stylesheet, and in each srcdoc's style element.
const OFL_LINE = 'Licensed under the SIL Open Font License 1.1, see fonts/OFL.txt';
const noticed = (css) => css.startsWith('/*! Fonts: ') && css.slice(0, css.indexOf('*/')).includes(OFL_LINE);
const unnoticed = [['frame/reader.css', assetTexts.css], ...srcdocs.map(([id, srcdoc]) => [\`\${id}'s style\`, tree(srcdoc).head.childNodes.filter(isElement).filter((e) => e.tagName === 'style').map(textOf).join('')])]
  .filter(([, css]) => !noticed(css))
  .map(([label]) => label);
if (unnoticed.length === 0) say("the installed frame/reader.css and each srcdoc's style element hold the font notice with its OFL line");
else {
  ok = false;
  say(\`no font notice with its OFL line in \${unnoticed.join(', ')}\`);
}

try {
  const cases = bridgeCases();
  if (cases.bridgeProtocol === entries.frame.BRIDGE_PROTOCOL && cases.messages.length > 0 && cases.sequences.length > 0) {
    say(\`bridgeCases() loads the bridge fixtures of protocol \${cases.bridgeProtocol}\`);
  } else {
    ok = false;
    say(\`bridgeCases() answers protocol \${cases.bridgeProtocol} with \${cases.messages.length} messages and \${cases.sequences.length} sequences\`);
  }
} catch (e) {
  ok = false;
  say(\`bridgeCases() threw: \${String(e)}\`);
}
`;

/**
 * The import probe (review EV1), run by the check once per entry in a fresh process: `node inert.mjs <specifier>
 * dom|no-dom`. It traps every timer (and, with `dom`, every DOM name) on globalThis before anything else loads, imports
 * that one entry, and prints what was read and which globals were added, as JSON. Nothing else is imported first, so
 * every module the entry reaches is evaluated under the traps.
 */
const INERT_PROBE = `const [spec, dom] = process.argv.slice(2);
const globalsBefore = new Set(Reflect.ownKeys(globalThis));
const TIMERS = ['setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask'];
const DOM_NAMES = ['window', 'document', 'self', 'navigator', 'location', 'HTMLElement', 'Element', 'Node', 'MessageChannel', 'crypto', 'localStorage'];
const touched = new Set();
const saved = new Map();
const trap = (names, onRead) => {
  for (const name of names) {
    const d = Object.getOwnPropertyDescriptor(globalThis, name);
    saved.set(name, d);
    // The original is read only when the name is: reading some of Node's globals has effects of its own.
    const original = () => (d === undefined ? undefined : 'value' in d ? d.value : d.get?.call(globalThis));
    Object.defineProperty(globalThis, name, { configurable: true, get: () => onRead(name, original()), set: () => undefined });
  }
};
trap(TIMERS, (name, fn) => (...args) => {
  touched.add(name);
  return fn(...args);
});
if (dom === 'dom') {
  trap(DOM_NAMES, (name, value) => {
    touched.add(name);
    return value;
  });
}
let error = null;
try {
  await import(spec);
} catch (e) {
  error = String(e);
} finally {
  for (const [name, d] of saved) {
    if (d === undefined) delete globalThis[name];
    else Object.defineProperty(globalThis, name, d);
  }
}
const added = Reflect.ownKeys(globalThis).filter((k) => !globalsBefore.has(k)).map(String);
process.stdout.write(JSON.stringify({ touched: [...touched], added, error }));
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
    writeFileSync(path.join(dir, 'tsconfig.pure.json'), `${JSON.stringify(PURE_TSCONFIG, null, 2)}\n`);
    writeFileSync(path.join(dir, 'check-pure.ts'), CHECK_PURE_TS);
    run(process.execPath, [TSC, '-p', 'tsconfig.pure.json'], dir);
    console.log('consumer-smoke: the frame and highlight declarations typecheck with no DOM library and no ambient types');
    writeFileSync(path.join(dir, 'inert.mjs'), INERT_PROBE);
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
