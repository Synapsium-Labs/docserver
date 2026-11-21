// The sealed reader frame's assets (docserver L3, Task 6; plan Reference §3, §5, §10 and §12).
//
//   node scripts/build-frame.mjs                  build, check and write the frame assets (npm run build:frame)
//   node scripts/build-frame.mjs --check          build in memory; exit 1 when an output differs from it
//   ... [--out <dir>]                             write to, or check, <dir> instead of the package root
//
// The outputs, built in memory by esbuild (target es2022, a "use strict" banner, charset ascii), then checked:
// - assets/frame/guard.js, unminified, and assets/frame/bootstrap.js, minified, classic strict IIFEs. The bootstrap
//   carries the free-global list (below) through the define DOCSERVER_FREE_GLOBALS, as a JSON array literal.
// - assets/frame/enhance.js, minified, its legal comments at the end, with the free-global define set (FREE_DEFINES).
// - assets/mermaid/mermaid.frame.js, which scripts/build-mermaid.mjs's buildMermaidFrame() builds from the same option
//   object, pinned input and elk stand-in as assets/mermaid/mermaid.mjs; and assets/mermaid/mermaid.mjs itself, built
//   in memory by buildMermaid() exactly as `npm run build:mermaid` writes it, so assets.json can name its bytes.
// - assets/frame/reader.css: a `/*! … */` notice holding the fonts' copyright lines and reserved font name (read from
//   THIRD-PARTY-NOTICES) and the OFL sentence, so the notice travels inside every srcdoc; the frame's prelude; then
//   assets/reader.css with each font url replaced by the font itself as a data: URL.
//
// The layouts (docserver parity Task 9; plan Design B11 and B12). LAYOUT_TABLE names them in one place. Beside the default
// enhance bundle above, each other layout has:
// - assets/frame/enhance-<name>.js, built from the SAME entry as the default bundle, with the same options, and one esbuild
//   plugin (scripts/layout-plugin.mjs) that substitutes the feature list and nothing else: the lifecycle's import of
//   `./features.js` (src/enhance/lifecycle.ts, the one importer) resolves to src/enhance/layouts/<name>/features.ts, which
//   exports the same `features()`. Every other module is the shared one. The default bundle is built with no plugin, so
//   nothing a default frame inlines (guard, bootstrap, enhance.js, reader.css, Mermaid's frame file) depends on a layout.
// - assets/frame/layout-<name>.css: the text of the tracked assets/layouts/<name>.css, which a frame inlines after
//   reader.css, in the same `<style>` element, after a newline. It holds no font of its own (no `url(`, no `@font-face`) and
//   passes the same byte rules, alone and joined to reader.css.
// Each is a manifest entry (`enhance<Name>`, `css<Name>`) marked with its layout, in both manifests; each bundle has a CSP
// hash source, a stylesheet none. A layout bundle is a frame script: it is byte-checked, comment-checked, scanned for free
// globals and held to enhance's budget, and its stylesheet to css's, like the default's.
//
// The free-global list (Reference §5.5, ruling R2): scripts/free-globals.mjs scans the four bundled scripts (guard,
// bootstrap built once with an empty list, enhance, Mermaid's frame file) for every name they read from the global,
// with the TypeScript binder; the list is that union, less FREE_GLOBALS_ALLOWLIST, and the bootstrap is built again
// carrying it. A name a script writes on the global fails the build unless it is allowlisted, and an allowlisted name is
// never pinned (a pinned name is read-only, so the script's own write would throw). The layout bundles are scanned with
// the others in the second scan, but the list is made from the four alone: a layout bundle that reads a name outside it
// fails the build, naming the name (the bootstrap does not move for a layout).
//
// The checks, every one run on every build before anything is written (checkOutputs): the byte rules of
// src/frame/bytes.ts (the functions frameDocument runs); the HTML-like comment rule on every script
// (scripts/comment-tokens.mjs, TypeScript, build time only); the free-global scan again over the final outputs, which
// must give the same list, and for the bootstrap the same names read and written as before it carried the list (the
// aliases' minified spellings can differ between the two builds and are not compared), with the list embedded
// once; then the size budgets (ASSET_BUDGETS), each moved only by a named ruling. A failing build names every problem.
//
// Then the manifests: assets/assets.json lists every file under assets/ but itself (the tracked ones walked from disk,
// the git-ignored output directories frame/ and mermaid/ taken from this build), sorted by path in code-unit order,
// with its sha256, bytes, kind and, for each frame script, its CSP hash source; and src/frame/manifest.generated.ts
// carries the frame subset as FRAME_MANIFEST, with each asset's UTF-16 length as `chars`, from which
// src/frame/document.ts derives MAX_SRCDOC_CHARS_DEFAULT (Reference §3).
//
// Committed: assets/assets.json and src/frame/manifest.generated.ts, so every hash move shows in a review. The frame
// files and both Mermaid files are git-ignored build outputs. `--check` writes nothing and exits 1 when a committed
// file differs from a fresh in-memory build (a missing one differs), or a built file present under the root does.
// scripts/verify-assets.mjs, npm's prepack, refuses to pack bytes assets.json does not name.
//
// The build is reproducible: the same inputs give the same bytes (inputs are named relative to the package root). The
// doubled "use strict" at the head of guard, bootstrap and enhance (esbuild's own and the banner) stays (P-10).
//
// Exit codes: 0 built (or checked equal); 1 the build failed or an output differs (the reasons on stderr); 2 a usage
// error. Dev tooling, never shipped; what the tests use is exported (types in build-frame.d.mts).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { buildMermaid, buildMermaidFrame, FRAME_ENTRY, FREE_DEFINES } from './build-mermaid.mjs';
import { commentTokenHazards } from './comment-tokens.mjs';
import { freeGlobalList, sameGlobalNames, scanFreeGlobals } from './free-globals.mjs';
import { layoutPlugin } from './layout-plugin.mjs';

/** The free-global define set (plan Reference §5.5), defined once in scripts/build-mermaid.mjs. */
export { FREE_DEFINES };
/** The free-global scan (scripts/free-globals.mjs). */
export { scanFreeGlobals };

/** The package root this script belongs to. */
const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** The frame files every layout shares or that are the default layout's, by asset name: paths under assets/. */
const BASE_FILES = Object.freeze({
  guard: 'frame/guard.js',
  bootstrap: 'frame/bootstrap.js',
  enhance: 'frame/enhance.js',
  css: 'frame/reader.css',
  mermaid: 'mermaid/mermaid.frame.js',
});

const capital = (name) => `${name.charAt(0).toUpperCase()}${name.slice(1)}`;

/** One layout beside `default`: its manifest names, its feature list's module, its stylesheet's source and its two outputs. */
const ownLayout = (name) =>
  Object.freeze({
    enhance: `enhance${capital(name)}`,
    css: `css${capital(name)}`,
    features: `src/enhance/layouts/${name}/features.ts`,
    source: `assets/layouts/${name}.css`,
    bundle: `frame/enhance-${name}.js`,
    stylesheet: `frame/layout-${name}.css`,
  });

/**
 * The layouts, in one place (parity Task 9; plan Design B11): for each, the manifest name of its enhance bundle and of its
 * own stylesheet (null for none), the module that is its feature list (null for `default`, whose bundle is built with no
 * substitution at all), the tracked source of its stylesheet, and the two frame files built from them. `default`'s bundle
 * is `frame/enhance.js` and its rules are `frame/reader.css`, which every layout inlines. The names are mirrored in
 * src/frame/layouts.ts (FRAME_LAYOUTS, LAYOUT_ENTRIES); test/frame-layouts.test.ts holds the two equal.
 *
 * A layout's bundle is built from the same entry as the default (src/frame-runtime/enhance-entry.ts), with one esbuild plugin
 * (scripts/layout-plugin.mjs) that resolves the lifecycle's import of `./features.js` to the layout's feature list; nothing
 * else is substituted. Its stylesheet joins `frame/reader.css` inside the one `<style>` element of the srcdoc, after a newline.
 */
export const LAYOUT_TABLE = Object.freeze({
  default: Object.freeze({ enhance: 'enhance', css: null, features: null, source: null, bundle: BASE_FILES.enhance, stylesheet: null }),
  classic: ownLayout('classic'),
  editorial: ownLayout('editorial'),
  review: ownLayout('review'),
  guided: ownLayout('guided'),
});

/** The layouts besides `default`, in table order. */
const OWN_LAYOUTS = Object.freeze(Object.keys(LAYOUT_TABLE).filter((n) => LAYOUT_TABLE[n].features !== null));

/** The frame files, by asset name: paths under assets/. The base five, then each layout's bundle and stylesheet. */
export const FRAME_FILES = Object.freeze({
  ...BASE_FILES,
  ...Object.fromEntries(
    OWN_LAYOUTS.flatMap((n) => [
      [LAYOUT_TABLE[n].enhance, LAYOUT_TABLE[n].bundle],
      [LAYOUT_TABLE[n].css, LAYOUT_TABLE[n].stylesheet],
    ]),
  ),
});

/** The layout a frame asset belongs to, by its asset name: a layout's bundle or stylesheet, or null (the default bundle is `default`'s). */
export function layoutOfAsset(name) {
  for (const [layout, e] of Object.entries(LAYOUT_TABLE)) if (e.enhance === name || e.css === name) return layout;
  return null;
}

/** True for a frame asset that is a stylesheet (the frame's own, or a layout's). */
const isStyle = (name) => name === 'css' || OWN_LAYOUTS.some((n) => LAYOUT_TABLE[n].css === name);

/** The budget (ASSET_BUDGETS) an asset is held to: a layout's bundle is held to `enhance`'s, its stylesheet to `css`'s. */
const budgetOf = (name) => (isStyle(name) ? 'css' : layoutOfAsset(name) !== null ? 'enhance' : name);

/** The Mermaid module under assets/, which scripts/build-mermaid.mjs writes and this build lists. */
export const MERMAID_MODULE = 'mermaid/mermaid.mjs';

/** The directories under assets/ that hold only build outputs (git-ignored); everything else under assets/ is tracked. */
export const OUTPUT_DIRS = Object.freeze(['frame', 'mermaid']);

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

/** The hazards a build can name, by the kind of output they are checked on (src/frame/bytes.ts, the comment rule). */
export const HAZARDS = Object.freeze({
  script: Object.freeze(['script tag', 'NUL', 'CR', 'BOM', 'HTML comment token']),
  css: Object.freeze(['style end tag', '@import', 'NUL', 'CR', 'BOM', 'url( other than an inlined woff2 font']),
});

/**
 * The size budgets, in UTF-8 bytes (Reference §12 step 5); each moves only by a named ruling. The tarball's is checked
 * by test/pack.test.ts on the packed file.
 */
export const ASSET_BUDGETS = Object.freeze({
  guard: 4 * 1024,
  bootstrap: 32 * 1024,
  enhance: 512 * 1024,
  css: 1024 * 1024,
  mermaid: 4 * 1024 * 1024,
  tarball: 8 * 1024 * 1024,
});

/**
 * The reviewed allowlist of global names a bundled script writes (Reference §5.5): never pinned, so the write lands.
 * Each with the reason it is safe; add one only by a named ruling.
 */
export const FREE_GLOBALS_ALLOWLIST = Object.freeze({
  injected:
    "Mermaid's markdown helpers write `globalThis.injected ??= {…}` while the file evaluates (C90 (5)); the scan sees " +
    'that write. The name is reserved in Phase S as an own, writable, non-configurable property (BD5), so no element id ' +
    'can stand in for it, even when the file evaluates after content exists (C107), and the write still lands.',
  fastdom:
    "Mermaid's bundled fastdom writes `e.fastdom = e.fastdom || …` while the file evaluates, through its IIFE " +
    "parameter `e` (window or globalThis), which the binder cannot prove is the global, so the scan sees neither " +
    'the write nor a read. Listed so that a read the scan does see is never pinned. The name is reserved in Phase S as an ' +
    'own, writable, non-configurable property (BD5), so no element id can stand in for it and the write still lands.',
});

/** The licence sentence of the frame stylesheet's notice. */
export const OFL_NOTICE = 'Licensed under the SIL Open Font License 1.1, see fonts/OFL.txt';

/** The frame's own rules, before the reader's stylesheet. */
const PRELUDE =
  'html,body{margin:0}\n' +
  // C108: with no bar in the root nothing reserves room for one (the reader's own sheet says 48px, for a root with a bar).
  '[data-docreader-root][data-docreader-root]:not(:has(> .topbar)){--bar-h:0px}\n' +
  '.ds-img-missing{display:inline-block;padding:0 .3em;border:1px dashed currentColor;border-radius:3px;font-size:.9em}\n';

/** What joins `frame/reader.css` and a layout's stylesheet inside the srcdoc's one `<style>` element (src/frame/document.ts's STYLE_JOIN). */
export const STYLE_JOIN = '\n';

/** A font url of assets/reader.css. */
const FONT_URL = /url\("\.\/fonts\/([a-z0-9-]+\.woff2)"\)/g;

/** A font's copyright line in THIRD-PARTY-NOTICES: two spaces, the family, a colon, then the notice. */
const FONT_LINE = /^ {2}(Source (?:Serif 4|Sans 3)):\s+(\S.*)$/;

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

const sha256 = (data) => createHash('sha256').update(data).digest();
const order = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The esbuild options of the frame script `name` ('guard', 'bootstrap' or 'enhance'), as the build uses them: exported
 * so a test can build the same bundle with its names kept and read what it holds. The bootstrap's carries the
 * free-global list `freeGlobals` (the build passes the scanned list; empty by default).
 */
export function scriptOptions(name, root = ROOT, freeGlobals = []) {
  // `name` is a key of ENTRIES: a layout's bundle has its own options (layoutScriptOptions), never this call's.
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
    // 32 KiB budget (Reference §12 step 5). The three parts are named, not `minify`, so a caller can turn one off.
    minifyWhitespace: name !== 'guard',
    minifySyntax: name !== 'guard',
    minifyIdentifiers: name !== 'guard',
    legalComments: name === 'enhance' ? 'eof' : 'none',
    ...(name === 'enhance' ? { define: { ...FREE_DEFINES } } : {}),
    ...(name === 'bootstrap' ? { define: { DOCSERVER_FREE_GLOBALS: JSON.stringify(freeGlobals) } } : {}),
    metafile: true,
    write: false,
    logLevel: 'silent',
  };
}

/**
 * The esbuild options of the enhance bundle of `layout` (a name of LAYOUT_TABLE besides `default`): exactly the default
 * bundle's (scriptOptions('enhance')) and the one plugin that substitutes the layout's feature list (scripts/layout-plugin.mjs).
 * Exported so a test can build the same bundle with its names kept.
 */
export function layoutScriptOptions(layout, root = ROOT) {
  const e = LAYOUT_TABLE[layout];
  if (e === undefined || e.features === null) throw new Error(`build-frame: ${String(layout)} is not a layout with its own bundle`);
  return { ...scriptOptions('enhance', root), plugins: [layoutPlugin(root, e.features)] };
}

async function run(options, name) {
  const result = await build(options);
  const [file] = result.outputFiles;
  if (file === undefined || result.outputFiles.length !== 1) throw new Error(`build-frame: ${name}: esbuild made ${String(result.outputFiles.length)} files`);
  return { text: file.text, inputs: Object.keys(result.metafile.inputs).sort() };
}

const script = (root, name, freeGlobals = []) => run(scriptOptions(name, root, freeGlobals), name);

/** A layout's stylesheet: the text of its tracked source, which holds no font of its own (checkOutputs). */
function layoutStylesheet(root, layout) {
  return readFileSync(path.join(root, LAYOUT_TABLE[layout].source), 'utf8');
}

/** The frame stylesheet's notice: the fonts' copyright lines from THIRD-PARTY-NOTICES, then OFL_NOTICE. */
export function fontNotice(root = ROOT) {
  const lines = readFileSync(path.join(root, 'THIRD-PARTY-NOTICES'), 'utf8')
    .split('\n')
    .map((l) => FONT_LINE.exec(l))
    .filter((m) => m !== null)
    .map((m) => `${m[1]}: ${m[2].replace(/\s+/g, ' ')}`);
  if (lines.length !== 2) throw new Error(`build-frame: THIRD-PARTY-NOTICES gives ${String(lines.length)} font copyright lines, not 2`);
  for (const l of lines) {
    if (!l.includes('Reserved Font Name')) throw new Error(`build-frame: a font copyright line names no reserved font name: ${l}`);
    if (l.includes('*/')) throw new Error('build-frame: a font copyright line would end the notice comment');
  }
  return `/*! Fonts: ${lines.join('\n')}\n${OFL_NOTICE} */\n`;
}

function stylesheet(root) {
  const css = readFileSync(path.join(root, 'assets', 'reader.css'), 'utf8');
  const inlined = css.replace(FONT_URL, (_, file) => {
    const b64 = readFileSync(path.join(root, 'assets', 'fonts', file)).toString('base64');
    return `url(data:font/woff2;base64,${b64})`;
  });
  return fontNotice(root) + PRELUDE + inlined;
}

/** The kind assets.json gives a file, by its extension; a file of any other kind fails the build until classified. */
export function assetKind(rel) {
  if (rel.endsWith('.mjs')) return 'module';
  if (rel.endsWith('.js')) return 'script';
  if (rel.endsWith('.css')) return 'style';
  if (rel.endsWith('.woff2')) return 'font';
  if (rel.endsWith('.txt') || rel.endsWith('.md')) return 'text';
  throw new Error(`build-frame: assets/${rel}: no asset kind for this file`);
}

/** The tracked files under assets/: every file but assets.json and the output directories, as paths under assets/, sorted. */
export function staticAssets(root = ROOT) {
  const out = [];
  const walk = (rel) => {
    for (const e of readdirSync(path.join(root, 'assets', rel), { withFileTypes: true })) {
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) {
        if (rel === '' && OUTPUT_DIRS.includes(e.name)) continue;
        walk(r);
      } else if (r !== 'assets.json') out.push(r);
    }
  };
  walk('');
  return out.sort(order);
}

/** The scanned scripts of `texts`: the four base ones, by name, and each layout's bundle by its asset name. */
const scanned = (texts) => ({
  guard: texts.guard,
  bootstrap: texts.bootstrap,
  enhance: texts.enhance,
  mermaid: texts.mermaid,
  ...Object.fromEntries(OWN_LAYOUTS.map((n) => [LAYOUT_TABLE[n].enhance, texts[LAYOUT_TABLE[n].enhance]])),
});

/**
 * Bundle every output in memory, unchecked; nothing is written. Resolves with the texts, the Mermaid module, each frame
 * script's esbuild inputs, and the free-global list with the scan it came from. The list is made from the four base
 * scripts alone, so the bootstrap does not depend on a layout (checkOutputs scans the layout bundles against it).
 */
export async function bundleFrame({ root = ROOT } = {}) {
  const [guard, bootstrap0, enhance, mermaid, mermaidModule, layouts] = await Promise.all([
    script(root, 'guard'),
    script(root, 'bootstrap'),
    script(root, 'enhance'),
    buildMermaidFrame(root),
    buildMermaid({ root }),
    Promise.all(OWN_LAYOUTS.map((n) => run(layoutScriptOptions(n, root), LAYOUT_TABLE[n].enhance))),
  ]);
  const first = scanFreeGlobals({ guard: guard.text, bootstrap: bootstrap0.text, enhance: enhance.text, mermaid });
  const names = freeGlobalList(first, Object.keys(FREE_GLOBALS_ALLOWLIST));
  const bootstrap = await script(root, 'bootstrap', names);
  const texts = { guard: guard.text, bootstrap: bootstrap.text, enhance: enhance.text, css: stylesheet(root), mermaid };
  const inputs = { guard: guard.inputs, bootstrap: bootstrap.inputs, enhance: enhance.inputs };
  OWN_LAYOUTS.forEach((n, i) => {
    const e = LAYOUT_TABLE[n];
    texts[e.enhance] = layouts[i].text;
    texts[e.css] = layoutStylesheet(root, n);
    inputs[e.enhance] = layouts[i].inputs;
  });
  return { texts, mermaidModule: mermaidModule.text, inputs, freeGlobals: { names, first: first.scripts } };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Check a bundle (see the header): the byte rules, the comment rule, the free-global list against a second scan, and
 * the budgets. Throws an Error whose `problems` names every one, each as `<path under assets/>: <reason>` or
 * `free-globals: <reason>`; resolves with the second scan when there is none.
 */
export function checkOutputs(bundle) {
  if (rules === undefined) throw new Error('build-frame: checkOutputs runs after byteRules() has loaded');
  const { scriptHazards, cssHazards } = rules;
  const { texts, freeGlobals } = bundle;
  const problems = [];
  for (const name of Object.keys(FRAME_FILES)) {
    const text = texts[name];
    const where = FRAME_FILES[name];
    if (typeof text !== 'string') {
      problems.push(`${where}: no text was built`);
      continue;
    }
    const hazards = isStyle(name) ? cssHazards(text) : [...scriptHazards(text), ...commentTokenHazards(text).map((h) => `HTML comment token (${h})`)];
    for (const h of hazards) problems.push(`${where}: ${h}`);
  }
  // A layout's stylesheet: no font of its own, and the text a frame inlines, reader.css and the layout's joined by a newline,
  // passes the same byte rules (src/frame/document.ts joins them the same way).
  for (const n of OWN_LAYOUTS) {
    const e = LAYOUT_TABLE[n];
    const sheet = texts[e.css];
    if (typeof sheet !== 'string' || typeof texts.css !== 'string') continue;
    if (/url\(|@font-face/i.test(sheet)) problems.push(`${FRAME_FILES[e.css]}: a font or url( of its own (a layout's stylesheet holds none)`);
    for (const h of cssHazards(`${texts.css}${STYLE_JOIN}${sheet}`)) problems.push(`${FRAME_FILES[e.css]}: joined to frame/reader.css, ${h}`);
  }
  // The free globals: the final outputs scanned again must give the same list, and the bootstrap the same names read and
  // written (never the aliases' spellings, which the minifier may choose differently the second time).
  let second = null;
  try {
    const scan = scanFreeGlobals(scanned(texts));
    second = scan.scripts;
    const names = freeGlobalList(scan, Object.keys(FREE_GLOBALS_ALLOWLIST));
    if (!same(names, freeGlobals.names)) {
      const missing = names.filter((n) => !freeGlobals.names.includes(n));
      const extra = freeGlobals.names.filter((n) => !names.includes(n));
      problems.push(`free-globals: the bootstrap's list is not the outputs' scan (unlisted: ${missing.join(', ') || 'none'}; not read: ${extra.join(', ') || 'none'})`);
    }
    if (!sameGlobalNames(scan.scripts.bootstrap, freeGlobals.first.bootstrap)) {
      problems.push("free-globals: the final bootstrap's second scan differs from its first");
    }
    if (texts.bootstrap.split(JSON.stringify(freeGlobals.names)).length !== 2) {
      problems.push('free-globals: the bootstrap does not carry the list exactly once');
    }
  } catch (e) {
    problems.push(e instanceof Error ? e.message : String(e));
  }
  for (const name of Object.keys(FRAME_FILES)) {
    if (typeof texts[name] !== 'string') continue;
    const bytes = Buffer.byteLength(texts[name], 'utf8');
    const budget = ASSET_BUDGETS[budgetOf(name)];
    if (bytes > budget) problems.push(`${FRAME_FILES[name]}: ${String(bytes)} bytes, over its budget of ${String(budget)}`);
  }
  if (problems.length > 0) {
    const e = new Error(`build-frame: ${problems.join('; ')}`);
    e.problems = problems;
    throw e;
  }
  return { second };
}

/** The assets.json entry of a file under assets/ whose bytes are `data`; `layout` marks a layout's asset with its layout's name. */
function listing(rel, data, frameScript, layout = null) {
  const digest = sha256(data);
  return {
    path: rel,
    sha256: digest.toString('hex'),
    bytes: data.length,
    kind: assetKind(rel),
    ...(frameScript ? { csp: `'sha256-${digest.toString('base64')}'` } : {}),
    ...(layout === null ? {} : { layout }),
  };
}

/** The layout a tracked asset under assets/ is the stylesheet source of, or null. */
function layoutOfSource(rel) {
  return OWN_LAYOUTS.find((n) => LAYOUT_TABLE[n].source === `assets/${rel}`) ?? null;
}

/**
 * Build every output in memory and check it (checkOutputs); nothing is written unless `out` is given. Throws when the
 * build breaks a rule. Resolves with the frame files (path under assets/, text, bytes, chars, sha256, CSP hash source
 * or null), the Mermaid module, assets.json's listing and text, manifest.generated.ts's text and the free-global list
 * with both scans. With `out`, writes the outputs there; with `check`, writes nothing and sets `differ` to what differs
 * under `out`, or under `root` when no `out` is given.
 */
export async function buildFrame({ root = ROOT, check = false, out } = {}) {
  await byteRules(root);
  const bundle = await bundleFrame({ root });
  const { second } = checkOutputs(bundle);
  const files = {};
  for (const [name, rel] of Object.entries(FRAME_FILES)) {
    const text = bundle.texts[name];
    const digest = sha256(text);
    files[name] = {
      path: rel,
      text,
      bytes: Buffer.byteLength(text, 'utf8'),
      chars: text.length,
      sha256: digest.toString('hex'),
      csp: isStyle(name) ? null : `'sha256-${digest.toString('base64')}'`,
      kind: isStyle(name) ? 'style' : 'script',
      layout: layoutOfAsset(name),
      ...(name in bundle.inputs ? { inputs: bundle.inputs[name] } : {}),
    };
  }
  const mermaidModule = {
    path: MERMAID_MODULE,
    text: bundle.mermaidModule,
    bytes: Buffer.byteLength(bundle.mermaidModule, 'utf8'),
    chars: bundle.mermaidModule.length,
    sha256: sha256(bundle.mermaidModule).toString('hex'),
  };
  // Every frame file but the stylesheets is a script the policy hashes; the Mermaid module is not a frame file.
  const frameScripts = new Set(Object.entries(FRAME_FILES).filter(([name]) => !isStyle(name)).map(([, rel]) => rel));
  const listed = [
    ...staticAssets(root).map((rel) => listing(rel, readFileSync(path.join(root, 'assets', rel)), false, layoutOfSource(rel))),
    ...Object.entries(files).map(([name, f]) => listing(f.path, Buffer.from(f.text, 'utf8'), frameScripts.has(f.path), layoutOfAsset(name))),
    listing(MERMAID_MODULE, Buffer.from(bundle.mermaidModule, 'utf8'), false),
  ].sort((a, b) => order(a.path, b.path));
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const assetsJson = `${JSON.stringify({ manifest: 1, package: pkg.name, version: pkg.version, bridgeProtocol: 1, files: listed }, null, 2)}\n`;
  const entry = (name, f) =>
    `  ${name}: { path: ${JSON.stringify(f.path)}, sha256: ${JSON.stringify(f.sha256)}, bytes: ${String(f.bytes)}, chars: ${String(f.chars)}, csp: ${f.csp === null ? 'null' : JSON.stringify(f.csp)}, layout: ${f.layout === null ? 'null' : JSON.stringify(f.layout)} },`;
  const manifestTs = [
    '// Generated by scripts/build-frame.mjs from the frame assets it builds: do not edit by hand. Each asset\'s path under',
    "// assets/, the sha256 of its text's UTF-8 bytes, its length in bytes, its text's length in UTF-16 code units",
    '// (`chars`, from which src/frame/document.ts derives the srcdoc size default), for a script its CSP hash source, and',
    "// its `layout`: the layout's name when the asset is one of a layout's assets (the default enhance bundle is the `default`",
    '// layout\'s), else null. A frame inlines exactly one layout\'s assets; the size contract (test/size-contract.test.ts) counts by it.',
    'export const FRAME_MANIFEST = {',
    ...Object.entries(files).map(([name, f]) => entry(name, f)),
    '} as const;',
    '',
  ].join('\n');
  const built = { files, mermaidModule, listed, assetsJson, manifestTs, freeGlobals: { names: bundle.freeGlobals.names, first: bundle.freeGlobals.first, second } };
  // With `check`, `out` defaults to `root`, as the CLI's does, so a check always sets `differ` (review T6-C1).
  if (check) return { ...built, differ: checkFrame(built, out ?? root) };
  if (out === undefined) return built;
  writeFrame(built, out);
  return built;
}

/** Every output of `built` as [path from the root, text]. */
function outputs(built) {
  return [
    ...Object.values(built.files).map((f) => [`assets/${f.path}`, f.text]),
    [`assets/${built.mermaidModule.path}`, built.mermaidModule.text],
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
 * built file that exists.
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
    const built = await buildFrame({ root: ROOT, check, out });
    if (check) {
      if ((built.differ ?? []).length > 0) {
        console.error(`build-frame: differs from a fresh build: ${(built.differ ?? []).join(', ')}`);
        return 1;
      }
      console.log('build-frame: --check: the outputs equal a fresh build');
      return 0;
    }
    for (const f of [...Object.values(built.files), built.mermaidModule]) console.log(`build-frame: assets/${f.path}, ${String(f.bytes)} bytes, sha256 ${f.sha256}`);
    console.log(`build-frame: ${String(built.freeGlobals.names.length)} free globals pinned by the bootstrap`);
    return 0;
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
