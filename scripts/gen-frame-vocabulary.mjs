// The frame's closed content vocabulary (docserver L3, Task 5; plan Reference §6.2 step 2, FD3).
//
//   node scripts/gen-frame-vocabulary.mjs            render the corpus and write src/frame-runtime/vocabulary.ts
//   node scripts/gen-frame-vocabulary.mjs --check    the same in memory; exit 1 when the committed file differs
//
// The bootstrap materialises the seed's html by an inert DOMParser parse and then checks the parsed tree against this
// vocabulary before anything is adopted (src/frame-runtime/content.ts): a tag or an attribute outside it, or a value
// outside its rule, refuses the whole document into the fallback, never sanitised silently. The lists are what render()
// emits, read from its output for every case of the shipped corpus: each golden and hostile document
// (conformance/corpus/<id>.md) and each generated input (conformance/hostile.json's specs), rendered with its case's
// options and parsed with parse5, the HTML standard's parser, as a document, the way DOMParser parses it. Every element
// of the body is read: its tag name and its attribute names. The tags are joined with the conformance oracle's TAGS
// (src/conformance/oracle.ts, "the elements the renderer may emit", which checkOutputSafety holds every corpus output
// to), because the corpus holds no heading below h3: a scan of the corpus alone would refuse every document with an h4,
// h5 or h6. A tag the corpus shows outside the oracle's list fails the generator.
//
// The value rules are written here, not read: `style` only as `text-align:` left, right or center; an `input` only as
// a disabled checkbox (a task list's: type, disabled, checked optional, class); `details` may carry `open`. The generator checks that every
// output meets them, so a rule never refuses a document render() wrote, and it fails when the lists would admit a
// `name` attribute, an `on...` attribute, or an `embed`, `form`, `iframe` or `object` element (named properties on
// `document` come only from those, design §5.5).
//
// render() and the corpus helpers are bundled from source in memory by esbuild and imported; nothing but the output
// file is written. Exit codes: 0 written (or checked equal); 1 the corpus broke a rule, or the file differs (the reason
// on stderr); 2 a usage error. Dev tooling, never shipped; what the tests use is exported (types in
// gen-frame-vocabulary.d.mts).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { parse } from 'parse5';

/** The package root this script belongs to. */
const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** The generated file, from the package root. */
export const VOCABULARY_TS = 'src/frame-runtime/vocabulary.ts';

/** The one style value render() writes, on a table cell: its alignment. */
export const STYLE_VALUE_SOURCE = '^text-align:(?:left|right|center)$';

/** Elements the vocabulary never admits, whatever the corpus shows: each can name a property of `document`. */
export const NEVER_TAGS = Object.freeze(['embed', 'form', 'iframe', 'object']);

/** The attributes a task list's checkbox carries (render()'s tasklists): an input is only ever this. */
export const INPUT_ATTRIBUTES = Object.freeze(['type', 'disabled', 'checked', 'class']);

/** Attributes the vocabulary never admits: `name` names a property of `document`; an `on...` runs code. */
const NEVER_ATTRIBUTE = /^(?:name|on.*)$/i;

/** render(), buildInput(), parseHostile() and the oracle's TAGS, bundled from source in memory and imported. */
export async function loadTools(root = ROOT) {
  const r = await build({
    stdin: {
      contents:
        "export { render } from './src/render/index.ts';\n" +
        "export { buildInput, parseHostile } from './src/conformance/hostile.ts';\n" +
        "export { TAGS } from './src/conformance/oracle.ts';\n",
      resolveDir: root,
      sourcefile: 'gen-frame-vocabulary-entry.ts',
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

/** Every case of the shipped corpus, in manifest order: `{ id, markdown, options }`. */
export function corpusInputs(tools, root = ROOT) {
  const manifest = JSON.parse(readFileSync(path.join(root, 'conformance', 'manifest.json'), 'utf8'));
  const hostile = tools.parseHostile(JSON.parse(readFileSync(path.join(root, 'conformance', 'hostile.json'), 'utf8')));
  const specs = new Map(hostile.filter((e) => e.input !== undefined).map((e) => [e.id, e.input]));
  return manifest.map((e) => {
    const spec = specs.get(e.id);
    const markdown =
      spec !== undefined ? tools.buildInput(spec) : readFileSync(path.join(root, 'conformance', 'corpus', `${e.id}.md`)).toString('utf8');
    return { id: e.id, markdown, options: e.options ?? {} };
  });
}

/** What one parsed document holds: tags, attribute names, style values, input attribute sets, other node kinds. */
function walk(html, into) {
  const doc = parse(html);
  const htmlEl = doc.childNodes.find((n) => n.nodeName === 'html');
  const head = htmlEl?.childNodes.find((n) => n.nodeName === 'head');
  const body = htmlEl?.childNodes.find((n) => n.nodeName === 'body');
  if (doc.childNodes.length !== 1 || head === undefined || body === undefined) into.problems.push('the document is not one html element');
  if (head !== undefined && head.childNodes.length > 0) into.problems.push(`the head holds ${head.childNodes.map((n) => n.nodeName).join(', ')}`);
  const visit = (node) => {
    for (const c of node.childNodes ?? []) {
      if (c.nodeName === '#text') continue;
      if (c.nodeName === '#comment' || c.tagName === undefined) {
        into.problems.push(`a ${c.nodeName} node`);
        continue;
      }
      if (c.namespaceURI !== 'http://www.w3.org/1999/xhtml') into.problems.push(`<${c.tagName}> in ${c.namespaceURI}`);
      into.tags.add(c.tagName);
      for (const a of c.attrs) {
        into.attributes.add(a.name);
        if (a.name === 'style') into.styles.add(a.value);
      }
      if (c.tagName === 'input') into.inputs.add(c.attrs.map((a) => `${a.name}=${a.value}`).sort().join(' '));
      if (c.tagName === 'template') into.problems.push('a template element');
      visit(c);
    }
  };
  if (body !== undefined) visit(body);
}

/**
 * The vocabulary of render()'s output over the corpus: `{ tags, attributes, problems }`, each list sorted. `problems`
 * names every output that breaks a value rule or that the lists could not admit; the generator fails on any.
 */
export function scanVocabulary(cases, render, oracleTags) {
  const into = { tags: new Set(), attributes: new Set(), styles: new Set(), inputs: new Set(), problems: [] };
  for (const c of cases) {
    const r = render(c.markdown, c.options);
    if (r.outcome !== 'rendered') continue;
    const before = into.problems.length;
    walk(r.html, into);
    for (let i = before; i < into.problems.length; i++) into.problems[i] = `${c.id}: ${into.problems[i]}`;
  }
  const style = new RegExp(STYLE_VALUE_SOURCE);
  for (const s of into.styles) if (!style.test(s)) into.problems.push(`a style value outside the rule: ${JSON.stringify(s)}`);
  for (const i of into.inputs) {
    const names = i.split(' ').map((p) => p.slice(0, p.indexOf('=')));
    if (!i.split(' ').includes('type=checkbox') || !names.includes('disabled') || names.some((n) => !INPUT_ATTRIBUTES.includes(n))) {
      into.problems.push(`an input outside the rule: ${i}`);
    }
  }
  for (const t of into.tags) if (!oracleTags.has(t)) into.problems.push(`the corpus emits <${t}>, outside the oracle's TAGS`);
  for (const t of oracleTags) into.tags.add(t);
  for (const t of NEVER_TAGS) if (into.tags.has(t)) into.problems.push(`the vocabulary would admit <${t}>`);
  for (const a of into.attributes) if (NEVER_ATTRIBUTE.test(a)) into.problems.push(`the corpus emits the attribute ${a}`);
  const sorted = (s) => [...s].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return { tags: sorted(into.tags), attributes: sorted(into.attributes), problems: into.problems };
}

/** The text of src/frame-runtime/vocabulary.ts for these lists. */
export function vocabularyModule(tags, attributes) {
  const list = (xs) => xs.map((x) => `'${x}'`).join(', ');
  return [
    '// Generated by scripts/gen-frame-vocabulary.mjs: do not edit. Regenerate with `node scripts/gen-frame-vocabulary.mjs`;',
    '// the tests run it with `--check`.',
    '//',
    "// The frame's closed content vocabulary (plan Reference §6.2 step 2): every tag and every attribute name render() emits",
    "// over the shipped corpus, read from its output with the HTML standard's parser, and the value rules the generator",
    '// checks every output against. content.ts refuses a document with anything else. No `name` attribute, no `on...`',
    '// attribute, and none of `embed`, `form`, `iframe` or `object`, whatever the corpus shows (the generator fails first).',
    `export const VOCABULARY_TAGS: readonly string[] = [${list(tags)}];`,
    '',
    `export const VOCABULARY_ATTRIBUTES: readonly string[] = [${list(attributes)}];`,
    '',
    '/** The one style value admitted: a table cell\'s alignment. */',
    `export const STYLE_VALUE_SOURCE = '${STYLE_VALUE_SOURCE}';`,
    '',
    "/** The attributes an input may carry: a task list's disabled checkbox (type checkbox and disabled required). */",
    `export const INPUT_ATTRIBUTES: readonly string[] = [${list(INPUT_ATTRIBUTES)}];`,
    '',
  ].join('\n');
}

/** Scan the corpus and build the module text: `{ text, problems }`. */
export async function generate(root = ROOT) {
  const tools = await loadTools(root);
  const scan = scanVocabulary(corpusInputs(tools, root), tools.render, tools.TAGS);
  return { text: vocabularyModule(scan.tags, scan.attributes), problems: scan.problems, scan };
}

async function main(argv) {
  let check = false;
  for (const a of argv) {
    if (a === '--check') check = true;
    else {
      console.error('usage: node scripts/gen-frame-vocabulary.mjs [--check]');
      return 2;
    }
  }
  const { text, problems } = await generate(ROOT);
  if (problems.length > 0) {
    for (const p of problems) console.error(`gen-frame-vocabulary: ${p}`);
    return 1;
  }
  const at = path.join(ROOT, VOCABULARY_TS);
  if (check) {
    if (!existsSync(at) || readFileSync(at, 'utf8') !== text) {
      console.error(`gen-frame-vocabulary: ${VOCABULARY_TS} differs from a fresh scan`);
      return 1;
    }
    console.log(`gen-frame-vocabulary: --check: ${VOCABULARY_TS} equals a fresh scan`);
    return 0;
  }
  writeFileSync(at, text);
  console.log(`gen-frame-vocabulary: wrote ${VOCABULARY_TS}`);
  return 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
