// The library's own srcdoc scans (docserver L3, Tasks 7 and 12; plan Reference §2 and §3; the first consumer's rows
// M8.3, M8.4 and M8.8). One implementation, read by the tests (test/frame-scans.ts re-exports it, for
// test/frame-document.test.ts and test/frame-mutants.test.ts) and by the packed-consumer smoke
// (scripts/consumer-smoke.mjs), which runs them on srcdocs built from an installed tarball and on every labelled frame
// mutant the tarball ships. Each scan answers its problems; an empty list passes.
// - scanPrefix (M8.3): the string starts literally with the CSP meta; the head holds exactly the meta, the guard, the
//   seed, the bootstrap, the style, enhance and optionally Mermaid, in that order, each once, with no attribute beyond
//   the meta's two and the seed's type, no text or comment node between them, no id anywhere; the body is empty.
// - scanUrls (M8.4): outside script bodies (the seed's included), no src, href, srcset or other URL attribute, no link
//   or base element, no @import, and every url( in the stylesheet is url(data:.
// - scanSeed (M8.8): exactly one seed, a script whose only attribute is type="application/json", immediately before the
//   bootstrap and after the guard; its text holds no `<` and no raw U+2028 or U+2029, and parses as one JSON object.
// They read the srcdoc as an HTML parser builds it (parse5, the parser jsdom uses). Dev tooling, never shipped; types in
// frame-scans.d.mts.
import { parse } from 'parse5';

/** Whether a parse5 node is an element. */
export const isElement = (n) => 'tagName' in n;

/** An element's attribute value, or null. */
export const attr = (e, name) => e.attrs.find((a) => a.name === name)?.value ?? null;

/** The text of an element's text children, joined. */
export const textOf = (e) => e.childNodes.map((c) => ('value' in c && c.nodeName === '#text' ? c.value : '')).join('');

/** The head, the body and every element of a srcdoc, as parse5 builds them. */
export function tree(srcdoc) {
  const doc = parse(srcdoc);
  const html = doc.childNodes.find(isElement);
  if (html === undefined) throw new Error('no html element');
  const [head, body] = html.childNodes.filter(isElement);
  if (head === undefined || body === undefined) throw new Error('no head or body');
  const all = [];
  const walk = (n) => {
    if (isElement(n)) all.push(n);
    if ('childNodes' in n) for (const c of n.childNodes) walk(c);
  };
  walk(doc);
  return { head, body, all };
}

export const META_PREFIX = '<meta http-equiv="Content-Security-Policy" content="';

/** An element's shape: its tag and every attribute name, sorted, with the value of `type` and `http-equiv`. */
function shapeOf(e) {
  const attrs = e.attrs.map((a) => (a.name === 'type' || a.name === 'http-equiv' ? `${a.name}=${a.value}` : a.name)).sort();
  return attrs.length === 0 ? e.tagName : `${e.tagName}[${attrs.join(' ')}]`;
}

const SKELETON = ['meta[content http-equiv=Content-Security-Policy]', 'script', 'script[type=application/json]', 'script', 'style', 'script'];

/** M8.3: the prefix and the skeleton (Reference §2). */
export function scanPrefix(srcdoc) {
  const out = [];
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
export function scanUrls(srcdoc) {
  const out = [];
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
export function scanSeed(srcdoc) {
  const out = [];
  const kids = tree(srcdoc).head.childNodes.filter(isElement);
  const seeds = kids.filter((e) => e.tagName === 'script' && attr(e, 'type') !== null);
  if (seeds.length !== 1) return [`${String(seeds.length)} typed scripts in the head, not one seed`];
  const seed = seeds[0];
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
    const v = JSON.parse(text);
    if (typeof v !== 'object' || v === null || Array.isArray(v)) out.push('the seed is not a JSON object');
  } catch {
    out.push('the seed text is not JSON');
  }
  return out;
}

/** Each row's scan, by the first consumer's row id. */
export const SCANS = Object.freeze({ 'M8.3': scanPrefix, 'M8.4': scanUrls, 'M8.8': scanSeed });
