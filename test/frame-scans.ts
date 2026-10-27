// The library's own srcdoc scans and the labelled srcdoc mutants (docserver L3, Task 7; plan Reference §2 and §3; the
// first consumer's rows M8.3, M8.4 and M8.8). Shared by test/frame-document.test.ts, which runs the scans on real
// frameDocument output and checks the committed clean template against it, and test/frame-mutants.test.ts, which checks
// every committed mutant against the clean template and its row's scan. Not a test file itself.
//
// The three scans, each answering its problems (an empty list passes):
// - scanPrefix (M8.3, row L3.M1's checks): the string starts literally with the CSP meta; the head holds exactly the
//   meta, the guard, the seed, the bootstrap, the style, enhance and optionally Mermaid, in that order, each once, with
//   no attribute beyond the meta's two and the seed's type, no text or comment node between them, no id anywhere; the
//   body is empty.
// - scanUrls (M8.4, row L3.M2's checks): outside script bodies (the seed's included), no src, href, srcset or other URL
//   attribute, no link or base element, no @import, and every url( in the stylesheet is url(data:.
// - scanSeed (M8.8): exactly one seed, a script whose only attribute is type="application/json", immediately before the
//   bootstrap and after the guard; its text holds no `<` and no raw U+2028 or U+2029, and parses as one JSON object.
//
// The mutants (conformance/frame-mutants/): clean.html is frameDocument's output for FIXTURE_MARKDOWN with the policy
// and every asset text replaced by a placeholder (`{{docserver:<name>}}`), so the files do not move with every asset
// hash and do not carry megabytes of script. A consumer expands the placeholders with its own pinned texts (frameCsp()
// and the files under assets/). Every other file is clean.html with one defect, made by MUTANTS below; index.json names
// each file's row. With UPDATE_FRAME_MUTANTS=1 (exactly), test/frame-document.test.ts writes clean.html and
// test/frame-mutants.test.ts writes every mutant from it.
import { parse, type DefaultTreeAdapterMap } from 'parse5';

type Node = DefaultTreeAdapterMap['node'];
export type Element = DefaultTreeAdapterMap['element'];

export const isElement = (n: Node): n is Element => 'tagName' in n;
export const attr = (e: Element, name: string): string | null => e.attrs.find((a) => a.name === name)?.value ?? null;
export const textOf = (e: Element): string => e.childNodes.map((c) => ('value' in c && c.nodeName === '#text' ? c.value : '')).join('');

/** The head, the body and every element of a srcdoc, as parse5 builds them. */
export function tree(srcdoc: string): { head: Element; body: Element; all: Element[] } {
  const doc = parse(srcdoc);
  const html = doc.childNodes.find(isElement);
  if (html === undefined) throw new Error('no html element');
  const [head, body] = html.childNodes.filter(isElement);
  if (head === undefined || body === undefined) throw new Error('no head or body');
  const all: Element[] = [];
  const walk = (n: Node): void => {
    if (isElement(n)) all.push(n);
    if ('childNodes' in n) for (const c of n.childNodes) walk(c);
  };
  walk(doc);
  return { head, body, all };
}

export const META_PREFIX = '<meta http-equiv="Content-Security-Policy" content="';

/** An element's shape: its tag and every attribute name, sorted, with the value of `type` and `http-equiv`. */
function shapeOf(e: Element): string {
  const attrs = e.attrs.map((a) => (a.name === 'type' || a.name === 'http-equiv' ? `${a.name}=${a.value}` : a.name)).sort();
  return attrs.length === 0 ? e.tagName : `${e.tagName}[${attrs.join(' ')}]`;
}

const SKELETON = ['meta[content http-equiv=Content-Security-Policy]', 'script', 'script[type=application/json]', 'script', 'style', 'script'];

/** M8.3: the prefix and the skeleton (Reference §2). */
export function scanPrefix(srcdoc: string): string[] {
  const out: string[] = [];
  if (!srcdoc.startsWith(META_PREFIX)) out.push('the string does not start with the CSP meta');
  const { head, body, all } = tree(srcdoc);
  for (const n of head.childNodes) if (!isElement(n)) out.push(`a ${n.nodeName} node in the head`);
  const shape = head.childNodes.filter(isElement).map(shapeOf);
  const want = shape.length === SKELETON.length + 1 ? [...SKELETON, 'script'] : SKELETON;
  if (JSON.stringify(shape) !== JSON.stringify(want)) out.push(`the head holds ${JSON.stringify(shape)}, not ${JSON.stringify(want)} (and an optional Mermaid script)`);
  if (body.childNodes.length > 0) out.push(`the body holds ${String(body.childNodes.length)} nodes`);
  for (const e of all) if (attr(e, 'id') !== null) out.push(`a ${e.tagName} carries an id`);
  return out;
}

/** Attributes that load or name a URL. */
const URL_ATTRS = ['src', 'href', 'srcset', 'xlink:href', 'action', 'formaction', 'poster', 'data', 'background', 'ping'];

/** M8.4: no URL outside the script bodies (Reference §2's "never emitted"). */
export function scanUrls(srcdoc: string): string[] {
  const out: string[] = [];
  for (const e of tree(srcdoc).all) {
    for (const a of e.attrs) if (URL_ATTRS.includes(a.name)) out.push(`a ${e.tagName} carries ${a.name}="${a.value}"`);
    if (e.tagName === 'link' || e.tagName === 'base') out.push(`a ${e.tagName} element`);
    if (e.tagName === 'style') {
      const css = textOf(e);
      if (/@import/i.test(css)) out.push('an @import in the stylesheet');
      const urls = css.match(/url\(/gi)?.length ?? 0;
      const data = css.match(/url\(data:/gi)?.length ?? 0;
      if (urls !== data) out.push(`${String(urls - data)} url( in the stylesheet that is not url(data:`);
    }
  }
  return out;
}

/** M8.8: the seed's placement and its serialisation. */
export function scanSeed(srcdoc: string): string[] {
  const out: string[] = [];
  const kids = tree(srcdoc).head.childNodes.filter(isElement);
  const seeds = kids.filter((e) => e.tagName === 'script' && attr(e, 'type') !== null);
  if (seeds.length !== 1) return [`${String(seeds.length)} typed scripts in the head, not one seed`];
  const seed = seeds[0] as Element;
  if (attr(seed, 'type') !== 'application/json' || seed.attrs.length !== 1) out.push(`the seed is ${shapeOf(seed)}`);
  const at = kids.indexOf(seed);
  const next = kids[at + 1];
  const prev = kids[at - 1];
  if (next === undefined || next.tagName !== 'script' || next.attrs.length !== 0) out.push('the element after the seed is not the bootstrap');
  if (prev === undefined || prev.tagName !== 'script' || prev.attrs.length !== 0) out.push('the element before the seed is not the guard');
  const text = textOf(seed);
  if (text.includes('<')) out.push('the seed text holds a "<"');
  if (/[\u2028\u2029]/.test(text)) out.push('the seed text holds a raw U+2028 or U+2029');
  try {
    const v: unknown = JSON.parse(text);
    if (typeof v !== 'object' || v === null || Array.isArray(v)) out.push('the seed is not a JSON object');
  } catch {
    out.push('the seed text is not JSON');
  }
  return out;
}

export type Row = 'M8.3' | 'M8.4' | 'M8.8';
export const SCANS: Readonly<Record<Row, (srcdoc: string) => string[]>> = { 'M8.3': scanPrefix, 'M8.4': scanUrls, 'M8.8': scanSeed };

// -- the clean template --

/** The placeholders of clean.html, in the order the srcdoc holds them. */
export const PLACEHOLDER_NAMES = ['csp', 'guard', 'bootstrap', 'css', 'enhance', 'mermaid'] as const;
export type PlaceholderName = (typeof PLACEHOLDER_NAMES)[number];
export const placeholder = (name: PlaceholderName): string => `{{docserver:${name}}}`;
const PLACEHOLDER = /\{\{docserver:(csp|guard|bootstrap|css|enhance|mermaid)\}\}/g;

/**
 * The document every template is made from: a title holding `</script><script>` and U+2028 (so a raw serialiser breaks
 * out of the seed), an external link and an external image (so markup emitted as such carries URLs).
 */
export const FIXTURE_MARKDOWN =
  '# Notes `</script><script>alert(1)</script>` & more \u2028 end\n\n' +
  'See [the example](https://example.com/page) and ![a picture](https://example.com/pic.png).\n\n' +
  'A line separator \u2028 and a paragraph separator \u2029.\n';

/** The nonce clean.html carries. */
export const FIXTURE_NONCE = '0123456789abcdef0123456789abcdef';

/** `srcdoc` with the policy and each asset text, at its one place, replaced by its placeholder. */
export function templateOf(srcdoc: string, values: Readonly<Record<PlaceholderName, string>>): string {
  let out = srcdoc;
  const swap = (whole: string, name: PlaceholderName, open: string, close: string): void => {
    const find = `${open}${values[name]}${close}`;
    const at = out.indexOf(find);
    if (at < 0 || out.indexOf(find, at + 1) >= 0) throw new Error(`templateOf: ${whole} is not in the srcdoc exactly once`);
    out = out.slice(0, at) + open + placeholder(name) + close + out.slice(at + find.length);
  };
  swap('the policy', 'csp', META_PREFIX, '">');
  swap('the guard', 'guard', '<meta http-equiv="Content-Security-Policy" content="{{docserver:csp}}"><script>', '</script>');
  swap('the bootstrap', 'bootstrap', '</script><script>', '</script><style>');
  swap('the stylesheet', 'css', '<style>', '</style>');
  swap('enhance', 'enhance', '</style><script>', '</script>');
  if (out.includes(values.mermaid)) swap('Mermaid', 'mermaid', '</script><script>', '</script>');
  return out;
}

/** A template with every placeholder replaced by its text. */
export function expand(template: string, values: Readonly<Record<PlaceholderName, string>>): string {
  return template.replace(PLACEHOLDER, (_m, name: PlaceholderName) => values[name]);
}

// -- the mutants --

/** The one element of `t` that starts with `open` and ends at the first `close` after it. */
function element(t: string, open: string, close = '</script>'): string {
  const at = t.indexOf(open);
  if (at < 0) throw new Error(`no ${open}`);
  const end = t.indexOf(close, at);
  return t.slice(at, end + close.length);
}

const once = (t: string, find: string, replace: string): string => {
  const at = t.indexOf(find);
  if (at < 0 || t.indexOf(find, at + 1) >= 0) throw new Error(`the mutation's anchor is not in the template exactly once: ${find}`);
  return t.slice(0, at) + replace + t.slice(at + find.length);
};

const SEED_OPEN = '<script type="application/json">';
const seedOf = (t: string): string => element(t, SEED_OPEN);
const GUARD = `<script>${placeholder('guard')}</script>`;
const BOOTSTRAP = `<script>${placeholder('bootstrap')}</script>`;
const STYLE = `<style>${placeholder('css')}</style>`;
const metaOf = (t: string): string => element(t, '<meta ', '>');

/** The seed's value, as the clean template carries it. */
const seedValue = (t: string): Record<string, unknown> => JSON.parse(seedOf(t).slice(SEED_OPEN.length, -'</script>'.length)) as Record<string, unknown>;

export interface Mutant {
  /** The file under conformance/frame-mutants/. */
  readonly file: string;
  /** The first consumer's row it must trip. */
  readonly row: Row;
  /** What differs from clean.html. */
  readonly mutation: string;
  readonly make: (clean: string) => string;
}

/** Every mutant, in index.json's order. Each changes clean.html once. */
export const MUTANTS: readonly Mutant[] = [
  { file: 'meta-appended.html', row: 'M8.3', mutation: 'the CSP meta comes last instead of first', make: (t) => once(t, metaOf(t), '') + metaOf(t) },
  { file: 'guard-missing.html', row: 'M8.3', mutation: 'the click guard is left out', make: (t) => once(t, GUARD, '') },
  { file: 'style-before-guard.html', row: 'M8.3', mutation: 'the stylesheet comes before the click guard', make: (t) => once(once(t, STYLE, ''), GUARD, STYLE + GUARD) },
  {
    file: 'element-between-seed-and-bootstrap.html',
    row: 'M8.3',
    mutation: 'an element sits between the seed and the bootstrap',
    make: (t) => once(t, seedOf(t) + BOOTSTRAP, `${seedOf(t)}<template></template>${BOOTSTRAP}`),
  },
  { file: 'content-before-guard.html', row: 'M8.3', mutation: 'authored markup comes before the click guard', make: (t) => once(t, GUARD, `<h1>Notes</h1>${GUARD}`) },
  { file: 'bootstrap-before-seed.html', row: 'M8.3', mutation: 'the bootstrap comes before the seed', make: (t) => once(t, seedOf(t) + BOOTSTRAP, BOOTSTRAP + seedOf(t)) },
  { file: 'bootstrap-twice.html', row: 'M8.3', mutation: 'the bootstrap appears twice', make: (t) => once(t, BOOTSTRAP, BOOTSTRAP + BOOTSTRAP) },
  {
    file: 'script-src.html',
    row: 'M8.4',
    mutation: 'the click guard keeps a CDN src',
    make: (t) => once(t, GUARD, `<script src="https://cdn.example.com/docserver/guard.js">${placeholder('guard')}</script>`),
  },
  {
    file: 'modulepreload.html',
    row: 'M8.4',
    mutation: 'a modulepreload link to a CDN follows the scripts',
    make: (t) => `${t}<link rel="modulepreload" href="https://cdn.example.com/docserver/enhance.mjs">`,
  },
  { file: 'preconnect.html', row: 'M8.4', mutation: 'a preconnect link to a CDN follows the scripts', make: (t) => `${t}<link rel="preconnect" href="https://cdn.example.com">` },
  {
    file: 'css-import.html',
    row: 'M8.4',
    mutation: 'the stylesheet opens with an @import of a remote stylesheet',
    make: (t) => once(t, STYLE, `<style>@import url("https://fonts.example.com/reader.css");${placeholder('css')}</style>`),
  },
  {
    file: 'css-remote-font.html',
    row: 'M8.4',
    mutation: 'the stylesheet ends with a font loaded from a protocol-relative URL',
    make: (t) => once(t, STYLE, `<style>${placeholder('css')}@font-face{font-family:Remote;src:url(//cdn.example.com/remote.woff2)}</style>`),
  },
  {
    file: 'html-as-markup.html',
    row: 'M8.4',
    mutation: "the document's html is emitted as markup after the scripts, its link and image with it",
    // Its line separators as character references, so the committed file holds none raw (ruling R6).
    make: (t) => `${t}${String(seedValue(t)['html']).replace(/\u2028/g, '&#x2028;').replace(/\u2029/g, '&#x2029;')}`,
  },
  {
    file: 'seed-raw-json.html',
    row: 'M8.8',
    mutation: 'the seed is JSON.stringify\'s text with no <, > or & escaped (only U+2028 and U+2029), so the title ends the seed early',
    make: (t) => once(t, seedOf(t), `${SEED_OPEN}${JSON.stringify(seedValue(t)).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')}</script>`),
  },
  {
    file: 'seed-raw-line-separators.html',
    row: 'M8.8',
    mutation: 'the seed writes U+2028 and U+2029 raw (the one committed file that holds them raw, on purpose)',
    make: (t) => once(t, seedOf(t), seedOf(t).replace(/\\u2028/g, '\u2028').replace(/\\u2029/g, '\u2029')),
  },
  {
    file: 'seed-with-id.html',
    row: 'M8.8',
    mutation: 'the seed carries an id, as for a lookup by id',
    make: (t) => once(t, SEED_OPEN, '<script type="application/json" id="docserver-seed">'),
  },
];

/** True only when the environment asks for the committed files to be written: UPDATE_FRAME_MUTANTS is exactly "1". */
export const updateRequested = (env: NodeJS.ProcessEnv): boolean => env['UPDATE_FRAME_MUTANTS'] === '1';
