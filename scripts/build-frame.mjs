// The sealed reader frame's assets (docserver L3; design §5 and §11).
//
//   node scripts/build-frame.mjs                  build, check and write the frame assets (npm run build:frame)
//   node scripts/build-frame.mjs --check          build in memory; exit 1 when a committed output differs
//   ... [--out <dir>]                             write to, or check, <dir> instead of the package root
//
// Four classic strict IIFEs, each built by esbuild with target es2022 and a "use strict" banner:
// assets/frame/guard.js unminified and assets/frame/bootstrap.js minified (charset ascii; the bootstrap reads its
// free-global list from the define DOCSERVER_FREE_GLOBALS, an interim `[]` until Task 6's scan supplies it),
// assets/frame/enhance.js minified with
// its legal comments at the end and the free-global define set (charset ascii), and assets/mermaid/mermaid.frame.js,
// which scripts/build-mermaid.mjs's buildMermaidFrame() builds from the same option object, pinned input and elk
// stand-in as assets/mermaid/mermaid.mjs, with the define set. And assets/frame/reader.css: the OFL notice, the frame's prelude,
// then assets/reader.css with each font url replaced by the font itself as a data: URL. Every output passes the byte
// rules (src/frame/bytes.ts, the same functions frameDocument runs). Then the manifests: assets/assets.json (the frame
// files only, in the prototype) and src/frame/manifest.generated.ts, which frameDocument and frameCsp read.
//
// Committed: assets/assets.json and src/frame/manifest.generated.ts, so every hash move shows in a review. The frame
// files themselves are git-ignored build outputs. `--check` compares the two committed files, and each frame file that
// exists, with a fresh in-memory build.
//
// The build is reproducible: the same inputs give the same bytes (inputs are named relative to the package root).
//
// Prototype scope: no `<!--` token scanner, no free-global scan (the bootstrap pins the interim empty list), no
// budgets; the Mermaid frame file is git-ignored with the rest of assets/mermaid/ and its notices are the plan's.
//
// Exit codes: 0 built (or checked equal); 1 the build failed or an output differs (the reason on stderr); 2 a usage
// error. Dev tooling, never shipped; what the tests use is exported (types in build-frame.d.mts).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { buildMermaidFrame, FRAME_ENTRY, FREE_DEFINES } from './build-mermaid.mjs';

/** The free-global define set (plan Reference §5.5), defined once in scripts/build-mermaid.mjs. */
export { FREE_DEFINES };

/** The package root this script belongs to. */
const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** The frame files, by asset name: paths under assets/. */
export const FRAME_FILES = Object.freeze({
  guard: 'frame/guard.js',
  bootstrap: 'frame/bootstrap.js',
  enhance: 'frame/enhance.js',
  css: 'frame/reader.css',
  mermaid: 'mermaid/mermaid.frame.js',
});

/** The Mermaid frame build's entry, from the package root (scripts/build-mermaid.mjs's FRAME_ENTRY). */
export const MERMAID_FRAME_ENTRY = FRAME_ENTRY;

/** The committed outputs, from the package root. */
export const ASSETS_JSON = 'assets/assets.json';
export const MANIFEST_TS = 'src/frame/manifest.generated.ts';

/** The scripts' entries, from the package root. */
const ENTRIES = Object.freeze({
  guard: 'src/frame-runtime/guard.ts',
  bootstrap: 'src/frame-runtime/bootstrap.ts',
  enhance: 'src/frame-runtime/enhance-entry.ts',
});

/** The first line of the frame stylesheet: the fonts it inlines travel under their licence. */
const OFL = '/*! fonts: SIL OFL 1.1, see fonts/OFL.txt */\n';

/** The frame's own rules, before the reader's stylesheet. */
const PRELUDE =
  'html,body{margin:0}\n' +
  '.ds-img-missing{display:inline-block;padding:0 .3em;border:1px dashed currentColor;border-radius:3px;font-size:.9em}\n';

/** A font url of assets/reader.css. */
const FONT_URL = /url\("\.\/fonts\/([a-z0-9-]+\.woff2)"\)/g;

let rules;

/**
 * The byte rules, loaded from src/frame/bytes.ts: bundled in memory by esbuild and imported, so the build and
 * frameDocument run the same functions.
 */
export async function byteRules(root = ROOT) {
  if (rules !== undefined) return rules;
  const r = await build({
    entryPoints: [path.join(root, 'src/frame/bytes.ts')],
    absWorkingDir: root,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    logLevel: 'silent',
  });
  const text = r.outputFiles[0]?.text ?? '';
  rules = await import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
  return rules;
}

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest();

/**
 * The esbuild options of the frame script `name` ('guard', 'bootstrap' or 'enhance'), as the build uses them: exported
 * so a test can build the same bundle with its names kept and read what it holds.
 */
export function scriptOptions(name, root = ROOT) {
  return {
    entryPoints: [ENTRIES[name]],
    absWorkingDir: root,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    charset: 'ascii',
    banner: { js: '"use strict";' },
    // The bootstrap is minified like enhance (its names too): unminified, Task 5's runtime is about 47.6 KB, over its
    // 32 KiB budget (Reference §12 step 5), and Task 6 adds the free-global list to it. The three parts are named, not
    // `minify`, so a caller can turn one off (`minify` would override it).
    minifyWhitespace: name !== 'guard',
    minifySyntax: name !== 'guard',
    minifyIdentifiers: name !== 'guard',
    legalComments: name === 'enhance' ? 'eof' : 'none',
    ...(name === 'enhance' ? { define: { ...FREE_DEFINES } } : {}),
    // Task 5's interim list: Task 6 replaces it with the free-global scan of the four bundled files (Reference §5.5).
    ...(name === 'bootstrap' ? { define: { DOCSERVER_FREE_GLOBALS: '[]' } } : {}),
    metafile: true,
    write: false,
    logLevel: 'silent',
  };
}

async function script(root, name) {
  const result = await build(scriptOptions(name, root));
  const [file] = result.outputFiles;
  if (file === undefined || result.outputFiles.length !== 1) throw new Error(`build-frame: ${name}: esbuild made ${String(result.outputFiles.length)} files`);
  return { text: file.text, inputs: Object.keys(result.metafile.inputs).sort() };
}

function stylesheet(root) {
  const css = readFileSync(path.join(root, 'assets', 'reader.css'), 'utf8');
  const inlined = css.replace(FONT_URL, (_, file) => {
    const b64 = readFileSync(path.join(root, 'assets', 'fonts', file)).toString('base64');
    return `url(data:font/woff2;base64,${b64})`;
  });
  return OFL + PRELUDE + inlined;
}

/**
 * Build every frame output in memory; nothing is written. Throws when an output breaks a byte rule. Resolves with the
 * files (path under assets/, text, bytes, sha256 hex, CSP hash source or null), the assets.json text and the
 * manifest.generated.ts text.
 */
export async function buildFrame({ root = ROOT } = {}) {
  const { scriptHazards, cssHazards } = await byteRules(root);
  const scripts = {
    guard: await script(root, 'guard'),
    bootstrap: await script(root, 'bootstrap'),
    enhance: await script(root, 'enhance'),
  };
  const texts = {
    guard: scripts.guard.text,
    bootstrap: scripts.bootstrap.text,
    enhance: scripts.enhance.text,
    css: stylesheet(root),
    mermaid: await buildMermaidFrame(root),
  };
  const files = {};
  for (const [name, text] of Object.entries(texts)) {
    const hazards = name === 'css' ? cssHazards(text) : scriptHazards(text);
    if (hazards.length > 0) throw new Error(`build-frame: ${FRAME_FILES[name]} holds ${hazards.join(', ')}`);
    const digest = sha256(text);
    files[name] = {
      path: FRAME_FILES[name],
      text,
      bytes: Buffer.byteLength(text, 'utf8'),
      sha256: digest.toString('hex'),
      csp: name === 'css' ? null : `'sha256-${digest.toString('base64')}'`,
      kind: name === 'css' ? 'style' : 'script',
      ...(name in scripts ? { inputs: scripts[name].inputs } : {}),
    };
  }
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const listed = Object.values(files)
    .map((f) => ({ path: f.path, sha256: f.sha256, bytes: f.bytes, kind: f.kind, ...(f.csp === null ? {} : { csp: f.csp }) }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const assetsJson = `${JSON.stringify({ manifest: 1, package: pkg.name, version: pkg.version, bridgeProtocol: 1, files: listed }, null, 2)}\n`;
  const entry = (f) =>
    `  ${f.name}: { path: ${JSON.stringify(f.path)}, sha256: ${JSON.stringify(f.sha256)}, bytes: ${String(f.bytes)}, csp: ${f.csp === null ? 'null' : JSON.stringify(f.csp)} },`;
  const manifestTs = [
    '// Generated by scripts/build-frame.mjs from the frame assets it builds: do not edit by hand. Each asset\'s path under',
    "// assets/, the sha256 of its text's UTF-8 bytes, its length in bytes, and, for a script, its CSP hash source.",
    'export const FRAME_MANIFEST = {',
    ...Object.entries(files).map(([name, f]) => entry({ name, ...f })),
    '} as const;',
    '',
  ].join('\n');
  return { files, assetsJson, manifestTs };
}

/** Every output of `built` as [path from the root, text]. */
function outputs(built) {
  return [
    ...Object.values(built.files).map((f) => [`assets/${f.path}`, f.text]),
    [ASSETS_JSON, built.assetsJson],
    [MANIFEST_TS, built.manifestTs],
  ];
}

/** Write `built` under `out`. */
export function writeFrame(built, out = ROOT) {
  for (const [rel, text] of outputs(built)) {
    mkdirSync(path.join(out, path.dirname(rel)), { recursive: true });
    writeFileSync(path.join(out, rel), text);
  }
}

/**
 * The outputs under `out` that differ from `built`: the two committed files always (a missing one differs), and each
 * frame file that exists.
 */
export function checkFrame(built, out = ROOT) {
  const differ = [];
  for (const [rel, text] of outputs(built)) {
    const at = path.join(out, rel);
    const committed = rel === ASSETS_JSON || rel === MANIFEST_TS;
    if (!existsSync(at)) {
      if (committed) differ.push(rel);
      continue;
    }
    if (readFileSync(at, 'utf8') !== text) differ.push(rel);
  }
  return differ;
}

async function main(argv) {
  let check = false;
  let out = ROOT;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') check = true;
    else if (argv[i] === '--out' && argv[i + 1] !== undefined) out = path.resolve(argv[++i]);
    else {
      console.error('usage: node scripts/build-frame.mjs [--check] [--out <dir>]');
      return 2;
    }
  }
  try {
    const built = await buildFrame({ root: ROOT });
    if (check) {
      const differ = checkFrame(built, out);
      if (differ.length > 0) {
        console.error(`build-frame: differs from a fresh build: ${differ.join(', ')}`);
        return 1;
      }
      console.log('build-frame: --check: the outputs equal a fresh build');
      return 0;
    }
    writeFrame(built, out);
    for (const f of Object.values(built.files)) console.log(`build-frame: assets/${f.path}, ${String(f.bytes)} bytes, sha256 ${f.sha256}`);
    return 0;
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
