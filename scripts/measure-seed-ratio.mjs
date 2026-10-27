// The seed's html ratio over the golden corpus (docserver L3, Task 3; plan Reference 3, ruling R3, FD17, row L3.M20).
//
//   node scripts/measure-seed-ratio.mjs            print r, the document it was measured on, the top three ratios and
//                                                  the cap ceil(2097152 x r) beside SEED_HTML_MAX_CHARS
//   node scripts/measure-seed-ratio.mjs --check    the same; exit 1 when the cap differs from SEED_HTML_MAX_CHARS
//
// r is the largest ratio, over every golden corpus document, of the html's length as the seed carries it (the escaped
// JSON string body of render().html, without its quotes: escapedHtmlLength in src/frame/seed.ts) to the document's
// markdown UTF-8 bytes. The seed's fixed keys are left out. A document of zero bytes has no ratio and is skipped. Each
// document is read as loadCorpus() reads it (UTF-8, invalid bytes replaced) and rendered with its case's options.
//
// render() and the seed's functions are bundled from source in memory by esbuild and imported; nothing is written.
// Exit codes: 0 printed (or checked equal); 1 the check failed or the corpus would not load; 2 a usage error. Dev
// tooling, never shipped; what the tests use is exported (types in measure-seed-ratio.d.mts).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

/** The package root this script belongs to. */
const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** The spec's document cap, in markdown UTF-8 bytes, which the ratio scales. */
export const DOC_BYTES = 2097152;

/** The golden corpus documents, in manifest order: `{ id, markdown, options }`, read as loadCorpus() reads them. */
export function goldenDocuments(root = ROOT) {
  const manifest = JSON.parse(readFileSync(path.join(root, 'conformance', 'manifest.json'), 'utf8'));
  return manifest
    .filter((e) => e.kind === 'golden')
    .map((e) => ({
      id: e.id,
      markdown: readFileSync(path.join(root, 'conformance', 'corpus', `${e.id}.md`)).toString('utf8'),
      options: e.options ?? {},
    }));
}

/**
 * Each document's ratio, highest first (ties by id): `{ id, bytes, escaped, ratio }`. `render` and
 * `escapedHtmlLength` are the library's own. Throws when a document does not render: a golden always does.
 */
export function seedRatios(docs, render, escapedHtmlLength) {
  const out = [];
  for (const d of docs) {
    const bytes = Buffer.byteLength(d.markdown, 'utf8');
    if (bytes === 0) continue;
    const r = render(d.markdown, d.options);
    if (r.outcome !== 'rendered') throw new Error(`measure-seed-ratio: ${d.id} did not render (${r.outcome})`);
    const escaped = escapedHtmlLength(r.html);
    out.push({ id: d.id, bytes, escaped, ratio: escaped / bytes });
  }
  return out.sort((a, b) => b.ratio - a.ratio || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The cap a ratio gives: ceil(DOC_BYTES x r). */
export function htmlCap(r) {
  return Math.ceil(DOC_BYTES * r);
}

/** render(), escapedHtmlLength() and SEED_HTML_MAX_CHARS, bundled from source in memory and imported. */
export async function loadSeedTools(root = ROOT) {
  const r = await build({
    stdin: {
      contents:
        "export { render } from './src/render/index.ts';\n" +
        "export { escapedHtmlLength, SEED_HTML_MAX_CHARS } from './src/frame/seed.ts';\n",
      resolveDir: root,
      sourcefile: 'measure-seed-ratio-entry.ts',
      loader: 'ts',
    },
    absWorkingDir: root,
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
  });
  const text = r.outputFiles[0]?.text ?? '';
  return import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);
}

async function main(argv) {
  const check = argv.includes('--check');
  const unknown = argv.filter((a) => a !== '--check');
  if (unknown.length > 0) {
    process.stderr.write(`measure-seed-ratio: unknown argument ${unknown[0]}\nusage: node scripts/measure-seed-ratio.mjs [--check]\n`);
    return 2;
  }
  const tools = await loadSeedTools();
  const ratios = seedRatios(goldenDocuments(), tools.render, tools.escapedHtmlLength);
  const [top] = ratios;
  if (top === undefined) {
    process.stderr.write('measure-seed-ratio: the golden corpus has no document with a ratio\n');
    return 1;
  }
  const cap = htmlCap(top.ratio);
  const lines = [
    `r = ${String(top.ratio)} (${top.ratio.toFixed(4)}), measured on ${top.id}.md (${String(top.escaped)} escaped html characters over ${String(top.bytes)} markdown bytes)`,
    'top three:',
    ...ratios.slice(0, 3).map((x, i) => `  ${String(i + 1)}. ${x.id}.md ${x.ratio.toFixed(4)} (${String(x.escaped)} / ${String(x.bytes)})`),
    `ceil(${String(DOC_BYTES)} x r) = ${String(cap)}; SEED_HTML_MAX_CHARS = ${String(tools.SEED_HTML_MAX_CHARS)} (${cap === tools.SEED_HTML_MAX_CHARS ? 'equal' : 'DIFFERS'})`,
    `golden documents with a ratio: ${String(ratios.length)}`,
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
  return check && cap !== tools.SEED_HTML_MAX_CHARS ? 1 : 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      process.stderr.write(`measure-seed-ratio: ${e instanceof Error ? e.message : String(e)}\n`);
      process.exitCode = 1;
    },
  );
}
