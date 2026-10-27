// The content of the sealed reader frame (docserver L3; plan Reference §6.2 step 2, FD3): the seed's rendered html,
// parsed inert by DOMParser, checked against the closed vocabulary, its images rewritten, and adopted into a fresh root.
// The one DOMParser site of the frame runtime. Bundled into the bootstrap, which captures the built-ins this module uses
// at its own start, through contentIntrinsics(), before any authored node exists.
//
// The check (checkVocabulary) reads the whole parsed document before anything is adopted, and any fault refuses the
// whole document; nothing is ever dropped or sanitised silently. The document must be one `html` element holding an
// empty head and a body, none of the three with an attribute (a `<meta>`, `<base>` or `<title>` in the html lands in
// the head; a `<body onload>` lands on the body). Below the body only text and HTML elements: no comment, no other
// namespace (SVG, MathML), every tag in VOCABULARY_TAGS and every attribute name in VOCABULARY_ATTRIBUTES (vocabulary.ts,
// generated from render()'s output over the corpus), and the value rules: `style` only as a table cell's alignment, an
// `input` only as a task list's disabled checkbox, no `on...` attribute and no `name` attribute whatever the lists say.
//
// The image rewrite: an `img` whose src is a ref of the seed's images map gets that data URL as its src; any other
// becomes the missing-image chip, a span marked as the reader's chrome with the alt text and a link to the ref; any
// `srcset` is dropped. The chip's link is routed like any other by the click guard and the reader.
import { INPUT_ATTRIBUTES, STYLE_VALUE_SOURCE, VOCABULARY_ATTRIBUTES, VOCABULARY_TAGS } from './vocabulary.js';

/** The built-ins this module uses, read once at the bootstrap's start (contentIntrinsics). */
export interface ContentIntrinsics {
  readonly Parser: typeof DOMParser;
  readonly appendChild: (this: Node, child: Node) => Node;
}

/** Read the built-ins materialise() uses. Called by the bootstrap in Phase S, before any authored node exists. */
export function contentIntrinsics(): ContentIntrinsics {
  return { Parser: DOMParser, appendChild: Node.prototype.appendChild };
}

/** The missing-image chip's class. */
export const MISSING_CLASS = 'ds-img-missing';

const XHTML = 'http://www.w3.org/1999/xhtml';
const TAGS: ReadonlySet<string> = new Set(VOCABULARY_TAGS);
const ATTRIBUTES: ReadonlySet<string> = new Set(VOCABULARY_ATTRIBUTES);
const STYLE_VALUE = new RegExp(STYLE_VALUE_SOURCE);

export type VocabularyCheck = { readonly ok: true } | { readonly ok: false; readonly why: string };

/** The fault of one element's attributes, or null: every name in the vocabulary, every value inside its rule. */
function attributesWhy(el: Element): string | null {
  const tag = el.localName;
  for (const a of Array.from(el.attributes)) {
    const name = a.name;
    if (/^on/i.test(name) || name === 'name' || !ATTRIBUTES.has(name)) return `<${tag} ${name}>`;
    if (name === 'style' && !STYLE_VALUE.test(a.value)) return `<${tag} style>`;
    if (tag === 'input' && !INPUT_ATTRIBUTES.includes(name)) return `<input ${name}>`;
  }
  if (tag === 'input' && (el.getAttribute('type') !== 'checkbox' || !el.hasAttribute('disabled'))) return '<input> that is not a disabled checkbox';
  return null;
}

/**
 * Check a parsed document against the closed vocabulary (see the header): `{ok: true}`, or the first fault found.
 * Reads only; changes nothing.
 */
export function checkVocabulary(tree: Document): VocabularyCheck {
  const no = (why: string): VocabularyCheck => ({ ok: false, why });
  const html = tree.documentElement;
  if (tree.childNodes.length !== 1 || html === null || html.localName !== 'html') return no('the document is not one html element');
  const head = tree.head;
  const body = tree.body;
  if (head === null || body === null || html.childNodes.length !== 2) return no('the document is not a head and a body');
  if (head.childNodes.length > 0) return no('the head holds a node');
  if (html.attributes.length > 0 || head.attributes.length > 0 || body.attributes.length > 0) return no('an attribute on html, head or body');
  const stack: Node[] = Array.from(body.childNodes);
  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    if (node.nodeType === 3) continue;
    if (node.nodeType !== 1) return no(`a node of type ${String(node.nodeType)}`);
    const el = node as Element;
    if (el.namespaceURI !== XHTML) return no(`<${el.localName}> outside HTML`);
    if (!TAGS.has(el.localName)) return no(`<${el.localName}>`);
    const why = attributesWhy(el);
    if (why !== null) return no(why);
    for (const c of Array.from(el.childNodes)) stack.push(c);
  }
  return { ok: true };
}

/** The chip that stands in for an image the frame cannot show: its alt text and a link to its ref. */
function chip(doc: Document, img: Element): Element {
  const span = doc.createElement('span');
  span.setAttribute('class', MISSING_CLASS);
  span.setAttribute('data-docreader-chrome', '');
  const alt = img.getAttribute('alt') ?? '';
  if (alt !== '') span.append(doc.createTextNode(`${alt} `));
  const a = doc.createElement('a');
  a.setAttribute('href', img.getAttribute('src') ?? '');
  a.append(doc.createTextNode('Image not loaded'));
  span.append(a);
  return span;
}

/** Thrown when the html is outside the vocabulary; the bootstrap reads any throw here as FAILED('render'). */
export class ContentRefused extends Error {}

/**
 * Parse `html` inert (no script runs, no image loads), check it against the vocabulary, rewrite its images by the
 * `images` map (ref to data URL), put it in a new `article` root of `doc` with `lang`, and append the root to the body.
 * Answers the root. Throws ContentRefused when the vocabulary check fails, and an Error when `doc` has no body.
 */
export function materialise(doc: Document, html: string, lang: string, images: ReadonlyMap<string, string>, k: ContentIntrinsics): HTMLElement {
  const parsed = new k.Parser().parseFromString(html, 'text/html');
  const check = checkVocabulary(parsed);
  if (!check.ok) throw new ContentRefused(`docserver frame: ${check.why}`);
  for (const img of Array.from(parsed.body.getElementsByTagName('img'))) {
    const url = images.get(img.getAttribute('src') ?? '');
    if (url === undefined) {
      img.replaceWith(chip(parsed, img));
    } else {
      img.removeAttribute('srcset');
      img.setAttribute('src', url);
    }
  }
  const root = doc.createElement('article');
  root.setAttribute('lang', lang);
  const from = parsed.body;
  for (let n = from.firstChild; n !== null; n = from.firstChild) k.appendChild.call(root, n);
  const body = doc.body;
  if (body === null) throw new Error('docserver frame: the document has no body');
  k.appendChild.call(body, root);
  return root;
}
