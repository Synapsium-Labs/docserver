// The content of the sealed reader frame (docserver L3; design §6.2 step 2): the seed's rendered html, parsed inert by
// DOMParser and adopted into a fresh root. The one DOMParser site of the frame runtime. Bundled into the bootstrap.
//
// Prototype scope: no closed vocabulary check and no image rewrite. Every img becomes the missing-image chip, whose
// link the click guard and the reader route like any other.

/** The built-ins this module uses, read by the bootstrap at its start. */
export interface ContentIntrinsics {
  readonly Parser: typeof DOMParser;
  readonly appendChild: (this: Node, child: Node) => Node;
}

/** The missing-image chip's class. */
export const MISSING_CLASS = 'ds-img-missing';

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

/**
 * Parse `html` inert, put it in a new `article` root of `doc` with `lang`, and append the root to doc.body. Answers
 * the root. Throws when the document has no body.
 */
export function materialise(doc: Document, html: string, lang: string, k: ContentIntrinsics): HTMLElement {
  const parsed = new k.Parser().parseFromString(html, 'text/html');
  // TODO(plan): the closed vocabulary check (design §6.2 step 2) goes here, over the inert tree, before anything is
  // adopted: any tag or attribute outside the vocabulary generated from render()'s emitters refuses the whole document.
  for (const img of Array.from(parsed.getElementsByTagName('img'))) img.replaceWith(chip(parsed, img));
  const root = doc.createElement('article');
  root.setAttribute('lang', lang);
  const from = parsed.body;
  for (let n = from.firstChild; n !== null; n = from.firstChild) k.appendChild.call(root, n);
  const body = doc.body;
  if (body === null) throw new Error('docserver frame: the document has no body');
  k.appendChild.call(body, root);
  return root;
}
