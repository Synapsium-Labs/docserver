// The self-hosted Mermaid file (docserver L2, Task 15; LD3, LD4; spec §3.4 and §3.6), and its classic twin for the
// sealed reader frame (docserver L3, Task 4; plan Reference §5.1 and §12 step 1).
//
//   node scripts/build-mermaid.mjs            build assets/mermaid/mermaid.mjs (npm run build:mermaid)
//   node scripts/build-mermaid.mjs --notices  build it, and write the two generated sections of THIRD-PARTY-NOTICES
//
// The frame's file, assets/mermaid/mermaid.frame.js, is written by scripts/build-frame.mjs, which calls
// buildMermaidFrame() here. Both files come from one option object, SHARED_OPTIONS (the pinned input's bundling,
// platform, target, minification, legal comments and symlink handling), with the same elk stand-in: the ESM file adds
// its format and entry; the frame file adds the IIFE format, the "use strict" banner, the free-global define set
// (FREE_DEFINES) and its entry, scripts/mermaid-frame-entry.mjs, which switches start-on-load off and hands Mermaid's
// API to the frame's bootstrap by one `docserver:register` event. test/mermaid-frame.test.ts reads the options back
// from both builds.
//
// esbuild bundles the pinned `mermaid` dev dependency into ONE ESM file whose only export is the default, Mermaid's
// API, with its start-on-load switched off: importing the file draws nothing, and Mermaid draws only when it is asked
// (`run()` or `render()`), never on the window's load event by itself (import-inert). Code splitting is off, so each
// `import()` in Mermaid is bundled in place and nothing loads after the file: a host passes the module itself (LD4,
// `mermaid.load()` resolves with it), and the file needs no URL of its own. Every import of `elkjs` resolves to
// scripts/mermaid-elk-stub.mjs instead: elkjs is EPL-2.0, which §3.6 keeps out, so a diagram that asks for the ELK
// layout fails to draw and shows the reader's failure note. Mermaid 12.1.0's own default configuration asks for it
// (`layout: 'elk'`), so a host that draws with this file sets another layout, such as `dagre`
// (test/browser/mermaid-file.test.ts measures both).
//
// The build is reproducible: the same inputs give the same bytes. Every input path is relative to the package root,
// and symlinks are kept as written, so a checkout whose node_modules is a link to another tree still names only
// `node_modules/...` (in the metafile and in the module keys this build writes; a pre-built dependency keeps the keys
// its own build wrote). Upstream legal comments are collected at the end of the file.
//
// THIRD-PARTY-NOTICES: the build's metafile names every input file. Each package those files belong to
// (`node_modules/<name>` or `node_modules/@<scope>/<name>`, nested ones included; one entry per directory) is listed
// in the generated section, sorted by name, version and directory, with its licence from its package.json and the
// text of each of its licence files (LICENSE, LICENSE.md, license.txt, LICENSE-MPL, COPYING and the like); a
// package.json that gives no licence string is listed as NO_LICENCE_FIELD, its licence file still following. A
// package with no licence file stops `--notices`. The section runs from NOTICES_BEGIN to NOTICES_END; the rest of the
// file is written by hand. test/mermaid-bundle.test.ts holds the section to the metafile exactly, so a dependency
// change that bundles another package fails until `--notices` is run again. The metafile sees packages, not what a
// package's own pre-built file carries inside it: EMBEDDED names those packages and the section lists them, without
// their licence texts yet (the test measures the list against the module keys the bundled files carry).
//
// Both Mermaid files (docserver L3, Task 14): `--notices` builds the frame's file too, in memory, and lists the packages
// of the union of both builds' metafiles (mergeMetafiles), so the section covers mermaid.mjs and mermaid.frame.js
// alike; both bundle one pinned input, so the union is one list (test/mermaid-frame.test.ts holds them equal). It also
// writes a second generated section, from DEPENDENCY_NOTICES_BEGIN to DEPENDENCY_NOTICES_END: the runtime libraries
// (package.json's dependencies but the @types packages, which carry declarations only), which npm installs beside the
// package and no file of it bundles, each with its version, its licence and its licence files' text, read from
// node_modules. test/mermaid-bundle.test.ts and test/public-ready.test.ts hold that section to node_modules exactly.
//
// Exit codes: 0 built; 1 the build or the notices failed (the reason on stderr); 2 a usage error. Dev tooling, never
// shipped; what the tests use is exported (types in build-mermaid.d.mts).
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

/** The package root this script belongs to. */
const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** The built file, from the package root; the package exports it through `./assets/*`. */
export const OUT_FILE = 'assets/mermaid/mermaid.mjs';

/** The stand-in every `elkjs` import resolves to, from the package root. */
export const STUB = 'scripts/mermaid-elk-stub.mjs';

/**
 * The entry: Mermaid's default export, and nothing else, with its start-on-load switched off. Mermaid's own code
 * listens for the window's load event and, while the object's `startOnLoad` is true (its default), draws every
 * `.mermaid` element of the document then; that check reads the object's own property before any configuration, so
 * setting it false here makes the file import-inert, whatever a later initialize() says.
 */
const ENTRY = "import mermaid from 'mermaid';\nmermaid.startOnLoad = false;\nexport default mermaid;\n";

/** The entry's name in the metafile. */
export const ENTRY_NAME = 'mermaid-entry.mjs';

/** The largest the built file may be, in bytes (4 MiB). Measured: about 3.75 MB for Mermaid 12.1.0 without elkjs. */
export const MAX_BYTES = 4 * 1024 * 1024;

/** The frame's Mermaid file, from the package root; scripts/build-frame.mjs writes it. */
export const FRAME_OUT_FILE = 'assets/mermaid/mermaid.frame.js';

/** The frame build's entry, from the package root (and its name in the metafile). */
export const FRAME_ENTRY = 'scripts/mermaid-frame-entry.mjs';

/** The first line of every frame script: a classic script is sloppy unless it says otherwise. */
export const STRICT_BANNER = '"use strict";';

/**
 * Free names third-party code reads lazily (`typeof process`), defined away in the frame's builds (plan Reference
 * §5.5, FD6). Not `require`: esbuild resolves a CommonJS module's `require('./x')` to the bundled module only while
 * `require` is left alone, and a define replaces the call first (measured, prototype finding P-1: Mermaid's bundled
 * sanitize-url then calls `(void 0)("./constants")` and the file throws on evaluation). A free `require` that survives
 * the bundle is the boot-time pin's to close. scripts/build-frame.mjs re-exports this object for its enhance build.
 */
export const FREE_DEFINES = Object.freeze({
  process: 'undefined',
  global: 'undefined',
  module: 'undefined',
  exports: 'undefined',
  define: 'undefined',
  Deno: 'undefined',
  Bun: 'undefined',
});

/**
 * The esbuild options both Mermaid files are built with: one bundle of the pinned input, nothing split off, for the
 * browser, es2022, minified, upstream legal comments gathered at the end, symlinks kept as written, in memory, with a
 * metafile. Each build spreads this object and adds only its own keys (format, entry, output, and for the frame the
 * banner and the define set), so the two cannot drift apart; each build's result carries the options it passed.
 */
export const SHARED_OPTIONS = Object.freeze({
  bundle: true,
  splitting: false,
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'eof',
  preserveSymlinks: true,
  metafile: true,
  write: false,
  logLevel: 'silent',
});

/** A string elkjs's own code holds hundreds of times (its Java packages), and nothing else bundled holds. */
export const ELK_SIGNATURE = 'org.eclipse.elk';

/** The first and last lines of the generated section of THIRD-PARTY-NOTICES. */
export const NOTICES_BEGIN = '[generated by scripts/build-mermaid.mjs --notices, from here to the end marker: do not edit by hand]';
export const NOTICES_END = '[end of the generated section]';

/** A heading line and its underline of dashes, one per character. */
function underlined(title) {
  return `${title}\n${'-'.repeat(title.length)}`;
}

/** The heading the generated section follows, written with it the first time. */
export const NOTICES_HEADING = underlined('Mermaid (assets/mermaid/mermaid.mjs and assets/mermaid/mermaid.frame.js)');

/** The first and last lines of the runtime libraries' generated section, and its heading (L3 Task 14). */
export const DEPENDENCY_NOTICES_BEGIN =
  '[generated by scripts/build-mermaid.mjs --notices for the runtime libraries, from here to their end marker: do not edit by hand]';
export const DEPENDENCY_NOTICES_END = '[end of the runtime libraries]';
export const DEPENDENCY_NOTICES_HEADING = underlined('Runtime libraries (installed beside the package)');

/** A licence file's name: LICENSE, LICENCE, COPYING, with an optional `-<word>` and an optional .md, .txt or .markdown. */
const LICENCE_FILE = /^(?:licen[cs]e|copying)(?:-[a-z0-9]+)?(?:\.(?:md|txt|markdown))?$/i;

/** The package directory an input path belongs to: the last `node_modules/<name>` or `node_modules/@<scope>/<name>`. */
const PACKAGE_DIR = /^((?:.*\/)?node_modules\/(?:@[^/]+\/)?[^/]+)\//;

const RULE = '='.repeat(80);
const THIN = '-'.repeat(80);

/** The esbuild plugin that resolves `elkjs` and every path inside it to the stand-in. */
function elkStub(root) {
  return {
    name: 'elkjs-stub',
    setup(b) {
      b.onResolve({ filter: /^elkjs(?:\/|$)/ }, () => ({ path: path.join(root, STUB) }));
    },
  };
}

/** The options of one Mermaid build: SHARED_OPTIONS, the package root, the elk stand-in, then the build's own keys. */
function optionsOf(root, own) {
  return { ...SHARED_OPTIONS, absWorkingDir: root, plugins: [elkStub(root)], ...own };
}

/** Run one Mermaid build: exactly one output file, read into what the tests and the commands check. */
async function bundle(options, outFile, label) {
  const result = await build(options);
  const [file] = result.outputFiles;
  if (file === undefined || result.outputFiles.length !== 1) throw new Error(`${label}: esbuild made ${String(result.outputFiles.length)} files`);
  const outputs = Object.keys(result.metafile.outputs).sort();
  const out = result.metafile.outputs[outFile];
  return {
    outputs,
    exports: [...(out?.exports ?? [])].sort(),
    imports: (out?.imports ?? []).map((i) => i.path),
    inputs: Object.keys(result.metafile.inputs).sort(),
    text: file.text,
    contents: file.contents,
    bytes: file.contents.length,
    sha256: createHash('sha256').update(file.contents).digest('hex'),
    metafile: result.metafile,
    options,
  };
}

/**
 * Bundle Mermaid in memory; nothing is written. `root` is the package root, whose node_modules holds the pinned
 * Mermaid. Resolves with what the tests and the command check: the outputs, the output's exports and the imports
 * left in it, the inputs, the file's text and bytes, its sha256, the metafile, and the options it was built with.
 */
export async function buildMermaid({ root = ROOT } = {}) {
  const options = optionsOf(root, {
    stdin: { contents: ENTRY, resolveDir: root, sourcefile: ENTRY_NAME, loader: 'js' },
    outfile: path.join(root, OUT_FILE),
    format: 'esm',
  });
  return bundle(options, OUT_FILE, 'build-mermaid');
}

/**
 * Bundle the frame's Mermaid file in memory, unchecked; nothing is written. The same as buildMermaid() but for the
 * build's own keys: the IIFE format, the banner, FREE_DEFINES and FRAME_ENTRY. buildMermaidFrame() is the checked one.
 */
export async function bundleMermaidFrame({ root = ROOT } = {}) {
  const options = optionsOf(root, {
    entryPoints: [FRAME_ENTRY],
    outfile: path.join(root, FRAME_OUT_FILE),
    format: 'iife',
    banner: { js: STRICT_BANNER },
    define: { ...FREE_DEFINES },
  });
  return bundle(options, FRAME_OUT_FILE, 'build-mermaid: frame');
}

/** Why the frame's Mermaid text may not ship: over MAX_BYTES of UTF-8, or holding elkjs's code. Empty when it may. */
export function mermaidFrameHazards(text) {
  const out = [];
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > MAX_BYTES) out.push(`${String(bytes)} bytes, over ${String(MAX_BYTES)}`);
  if (text.includes(ELK_SIGNATURE)) out.push('elkjs is bundled');
  return out;
}

/**
 * The frame's Mermaid file, built in memory and checked: resolves with its text, or throws when mermaidFrameHazards()
 * names a reason. scripts/build-frame.mjs writes it to FRAME_OUT_FILE.
 */
export async function buildMermaidFrame(root = ROOT) {
  const built = await bundleMermaidFrame({ root });
  const hazards = mermaidFrameHazards(built.text);
  if (hazards.length > 0) throw new Error(`build-mermaid: ${FRAME_OUT_FILE}: ${hazards.join(', ')}`);
  return built.text;
}

/** A licence text as the notices carry it: no byte-order mark, LF line ends, no trailing white space, no blank first or last line. */
function tidy(text) {
  return text
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/^\n+|\n+$/g, '');
}

/**
 * The licence files of the package at `dir` (named `label` in errors), sorted by name, each with its tidied text.
 * Throws when the package has none.
 */
export function licenceFiles(dir, label) {
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && LICENCE_FILE.test(e.name))
    .map((e) => e.name)
    .sort();
  if (names.length === 0) throw new Error(`build-mermaid: ${label}: no LICENSE file`);
  return names.map((name) => ({ name, text: tidy(readFileSync(path.join(dir, name), 'utf8')) }));
}

/** What the notices say for a package whose package.json gives no licence string (its licence file follows all the same). */
export const NO_LICENCE_FIELD = 'its package.json gives no licence; see its licence file';

/** A package.json's licence: its `license` string, or NO_LICENCE_FIELD when it gives none. */
function licenceOf(pkg) {
  return typeof pkg.license === 'string' ? pkg.license : NO_LICENCE_FIELD;
}

/**
 * Every package the metafile's inputs come from, read from `root`, one per directory: name, version, licence,
 * directory (from the package root) and licence files; sorted by name, then version, then directory.
 */
export function packagesOf(metafile, root = ROOT) {
  const dirs = new Set();
  for (const input of Object.keys(metafile.inputs)) {
    const m = PACKAGE_DIR.exec(input);
    if (m !== null && m[1] !== undefined) dirs.add(m[1]);
  }
  const out = [...dirs].map((dir) => {
    const at = path.join(root, dir);
    const pkg = JSON.parse(readFileSync(path.join(at, 'package.json'), 'utf8'));
    return { name: String(pkg.name), version: String(pkg.version), licence: licenceOf(pkg), dir, files: licenceFiles(at, dir) };
  });
  const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return out.sort((a, b) => order(a.name, b.name) || order(a.version, b.version) || order(a.dir, b.dir));
}

/**
 * Packages whose code ships inside a pre-built file of a bundled package, so the metafile never names them (measured
 * for Mermaid 12.1.0). `carrier` is the bundled package whose file holds the code; `version` is the one its module keys
 * name (`node_modules/.pnpm/<name>@<version>/`, test/mermaid-bundle.test.ts measures them with embeddedMarkers), or,
 * for roughjs, whose pre-built file names none and imports nothing, the range its package.json declares. Their licence
 * texts are not in the notices yet; the section says so.
 */
export const EMBEDDED = [
  { name: 'chevrotain-allstar', version: '0.5.0', carrier: '@mermaid-js/parser' },
  { name: 'fastdom', version: '1.0.12', carrier: 'mermaid' },
  { name: 'js-yaml', version: '4.3.0', carrier: 'mermaid' },
  { name: 'langium', version: '4.4.0', carrier: '@mermaid-js/parser' },
  { name: 'vscode-jsonrpc', version: '9.0.3', carrier: '@mermaid-js/parser' },
  { name: 'vscode-languageserver-protocol', version: '3.18.4', carrier: '@mermaid-js/parser' },
  { name: 'vscode-languageserver-textdocument', version: '1.0.15', carrier: '@mermaid-js/parser' },
  { name: 'vscode-languageserver-types', version: '3.18.4', carrier: '@mermaid-js/parser' },
  { name: 'vscode-uri', version: '3.1.0', carrier: '@mermaid-js/parser' },
  { name: 'hachure-fill', version: '^0.5.2', carrier: 'roughjs' },
  { name: 'path-data-parser', version: '^0.1.0', carrier: 'roughjs' },
  { name: 'points-on-curve', version: '^0.2.0', carrier: 'roughjs' },
  { name: 'points-on-path', version: '^0.2.1', carrier: 'roughjs' },
];

/** A module key a pre-built file carries: `node_modules/.pnpm/<name>@<version>/` (a scope's `/` written as `+`). */
const PNPM_KEY = /node_modules\/\.pnpm\/((?:@[^/@+]+\+)?[^/@]+)@(\d[^/_]*)(?:_[^/]*)?\//g;

/**
 * Every package a bundled file's module keys name, with the bundled package that carries it, one per name and
 * version, sorted by name then version (the first carrier, by input order). Reads each input under node_modules from
 * `root`.
 */
export function embeddedMarkers(metafile, root = ROOT) {
  const found = new Map();
  for (const input of Object.keys(metafile.inputs).sort()) {
    const m = PACKAGE_DIR.exec(input);
    if (m === null || m[1] === undefined) continue;
    const carrier = String(JSON.parse(readFileSync(path.join(root, m[1], 'package.json'), 'utf8')).name);
    for (const k of readFileSync(path.join(root, input), 'utf8').matchAll(PNPM_KEY)) {
      const name = String(k[1]).replace('+', '/');
      const key = `${name}@${String(k[2])}`;
      if (!found.has(key)) found.set(key, { name, version: String(k[2]), carrier });
    }
  }
  const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return [...found.values()].sort((a, b) => (a.name === b.name ? order(a.version, b.version) : order(a.name, b.name)));
}

/** One metafile whose inputs are the union of the given metafiles' inputs (the first one's entry wins), and no outputs. */
export function mergeMetafiles(...metafiles) {
  const inputs = {};
  for (const m of metafiles) for (const [k, v] of Object.entries(m.inputs)) if (!Object.hasOwn(inputs, k)) inputs[k] = v;
  return { inputs, outputs: {} };
}

/** The generated section for `packages`, from NOTICES_BEGIN to NOTICES_END (no line end after the last). */
export function noticesSection(packages) {
  const mermaid = packages.find((p) => p.name === 'mermaid');
  const version = mermaid === undefined ? '' : ` ${mermaid.version}`;
  const lines = [
    NOTICES_BEGIN,
    `assets/mermaid/mermaid.mjs and assets/mermaid/mermaid.frame.js are Mermaid${version}, bundled twice`,
    'from one pinned input: an ES module, and a classic script for the reader frame. Both hold code',
    `from the ${String(packages.length)} packages the two builds resolved, listed below, each with its version, its`,
    'licence as its package.json gives it, and the text of its licence files as its published copy',
    'carries them.',
    '',
    `They also hold code from ${String(EMBEDDED.length)} more packages, carried inside pre-built files of the packages`,
    'below, which the builds do not see as packages of their own. Their licence texts are not in',
    'this file yet:',
    ...EMBEDDED.map((e) => `  ${e.name} ${e.version}, inside ${e.carrier}`),
    '',
    'elkjs is left out: a stand-in refuses the ELK layout, so a diagram laid out with ELK is not drawn.',
    `Mermaid${version}'s default configuration asks for ELK, globally and for state diagrams, so with`,
    'that default no flowchart or state diagram is drawn; a host sets another layout, such as dagre.',
  ];
  for (const p of packages) {
    lines.push('', RULE, `${p.name} ${p.version} (${p.licence})`);
    for (const f of p.files) lines.push(THIN, `${f.name}:`, '', f.text);
  }
  lines.push(RULE, NOTICES_END);
  return lines.join('\n');
}

/** The generated section of a THIRD-PARTY-NOTICES text, from its first to its last marker; null when it has none. */
export function readNoticesSection(text) {
  const begin = text.indexOf(NOTICES_BEGIN);
  const end = text.indexOf(NOTICES_END);
  if (begin < 0 || end < 0) return null;
  return text.slice(begin, end + NOTICES_END.length);
}

/** `text` with its generated section replaced by `section`, or, when it has none, with the heading and it appended. */
export function withNoticesSection(text, section) {
  const held = readNoticesSection(text);
  if (held !== null) return text.replace(held, () => section);
  return `${text.replace(/\n*$/, '\n')}\n${NOTICES_HEADING}\n${section}\n`;
}

/**
 * The runtime libraries (L3 Task 14): package.json's dependencies but the @types packages, each read from
 * `root`/node_modules with its version, licence and licence files, sorted by name. Throws when one has no licence file.
 */
export function dependencyPackages(root = ROOT) {
  const { dependencies = {} } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  return Object.keys(dependencies)
    .filter((name) => !name.startsWith('@types/'))
    .sort()
    .map((name) => {
      const dir = `node_modules/${name}`;
      const pkg = JSON.parse(readFileSync(path.join(root, dir, 'package.json'), 'utf8'));
      return { name: String(pkg.name), version: String(pkg.version), licence: licenceOf(pkg), dir, files: licenceFiles(path.join(root, dir), dir) };
    });
}

/** The runtime libraries' generated section, from DEPENDENCY_NOTICES_BEGIN to DEPENDENCY_NOTICES_END. */
export function dependencyNoticesSection(packages) {
  const lines = [
    DEPENDENCY_NOTICES_BEGIN,
    "The package's code imports these libraries when it runs. npm installs them beside it, at the",
    'exact versions its package.json pins; no file of the package bundles them. Each is listed with',
    'its version, its licence as its package.json gives it, and the text of its licence files.',
  ];
  for (const p of packages) {
    lines.push('', RULE, `${p.name} ${p.version} (${p.licence})`);
    for (const f of p.files) lines.push(THIN, `${f.name}:`, '', f.text);
  }
  lines.push(RULE, DEPENDENCY_NOTICES_END);
  return lines.join('\n');
}

/** The runtime libraries' section of a THIRD-PARTY-NOTICES text; null when it has none. */
export function readDependencyNoticesSection(text) {
  const begin = text.indexOf(DEPENDENCY_NOTICES_BEGIN);
  const end = text.indexOf(DEPENDENCY_NOTICES_END);
  if (begin < 0 || end < begin) return null;
  return text.slice(begin, end + DEPENDENCY_NOTICES_END.length);
}

/** `text` with the runtime libraries' section replaced, or, when it has none, with its heading and it appended. */
export function withDependencyNoticesSection(text, section) {
  const held = readDependencyNoticesSection(text);
  if (held !== null) return text.replace(held, () => section);
  return `${text.replace(/\n*$/, '\n')}\n${DEPENDENCY_NOTICES_HEADING}\n${section}\n`;
}

async function main(argv) {
  if (argv.length > 1 || (argv.length === 1 && argv[0] !== '--notices')) {
    console.error('usage: node scripts/build-mermaid.mjs [--notices]');
    return 2;
  }
  try {
    const built = await buildMermaid({ root: ROOT });
    mkdirSync(path.join(ROOT, path.dirname(OUT_FILE)), { recursive: true });
    writeFileSync(path.join(ROOT, OUT_FILE), built.contents);
    console.log(`build-mermaid: ${OUT_FILE}, ${String(built.bytes)} bytes, sha256 ${built.sha256}`);
    if (argv[0] === '--notices') {
      const frame = await bundleMermaidFrame({ root: ROOT });
      const packages = packagesOf(mergeMetafiles(built.metafile, frame.metafile), ROOT);
      const libraries = dependencyPackages(ROOT);
      const file = path.join(ROOT, 'THIRD-PARTY-NOTICES');
      const text = withDependencyNoticesSection(withNoticesSection(readFileSync(file, 'utf8'), noticesSection(packages)), dependencyNoticesSection(libraries));
      writeFileSync(file, text);
      console.log(`build-mermaid: THIRD-PARTY-NOTICES lists the ${String(packages.length)} packages both Mermaid files bundle`);
      console.log(`build-mermaid: THIRD-PARTY-NOTICES lists the ${String(libraries.length)} runtime libraries`);
    }
    return 0;
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
