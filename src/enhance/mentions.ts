// Mentions: the walk the two link features share (docserver L2, Task 13), from the reference layout's sections 12 and
// 12b. xrefs.ts links the first mention of a defined ID in each block, and glossary.ts the first mention of each term
// in each section; both read the same text, and both wrap a mention in a chrome link the same way.
//
//   mentionTexts(top, skip)   the text nodes under `top` (itself an element of the root), in document order, each
//                             with its box: the nearest `p`, `li`, `td`, `dd` or `blockquote` around it, at or below
//                             `top`. A text in no box is left out, and so is all of an element that `skip` answers
//                             true for (`top` included); a comment is passed over. The walk never looks above `top`,
//                             so nothing around the root (a host's list item or figure) makes a text a mention or
//                             hides one.
//   skipsMarkup(el, page)     what both features leave alone: the document's code, keyboard keys, links, headings,
//                             table heads, figures and code blocks; the layout's buttons, a rule's head (Task 9) and
//                             a step's number (Task 11); the byline and the facts panel (ctx.page); and what the layout
//                             hid (a `hidden` attribute other than `until-found`, which a fold sets on what the reader
//                             can still find): the reference removed those parts, where this layout keeps them hidden.
//   topElements(root)         the root's child elements, in order, read by walking its siblings: a live `children`
//                             collection can cost a walk from its start per item, which grows with the square of a long
//                             document's top-level blocks.
//   linkMention(ctx, text, at, length, link)
//                             wrap the mention `text.data.slice(at, at + length)` in `link` (new chrome): the text node
//                             is split around it (journal.split, no character changes) and the mention's own node moved
//                             into the link (journal.wrap), so destroy joins the text again. Answers the text node after
//                             the link, or null when the mention ended the text.
//
// Import-inert: declarations only.
import type { FeatureContext } from './types.js';
import type { PageInfo } from './registry.js';

/** One text to search, and the block a mention in it is counted in. */
export interface Mention {
  readonly text: Text;
  readonly box: Element;
}

/** The elements a mention is counted in: the reference's blocks. */
const BOXES: readonly string[] = ['p', 'li', 'td', 'dd', 'blockquote'];

/** The document's markup that holds no mention, and the layout's buttons. */
const SKIP_TAGS: readonly string[] = ['a', 'code', 'pre', 'kbd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th', 'figure', 'button'];

/** True for what both link features leave alone (see the header). */
export function skipsMarkup(el: Element, page: Pick<PageInfo, 'byline' | 'facts'>): boolean {
  if (SKIP_TAGS.includes(el.localName)) return true;
  if (el === page.byline || el === page.facts.panel) return true;
  if (el.classList.contains('rule-head') || el.classList.contains('step-no')) return true;
  const hidden = el.getAttribute('hidden');
  return hidden !== null && hidden !== 'until-found';
}

/** The texts under `top` that sit in a box, in document order (see the header). An explicit stack: no recursion. */
export function mentionTexts(top: Element, skip: (el: Element) => boolean): Mention[] {
  const out: Mention[] = [];
  if (skip(top)) return out;
  const stack: { node: Node; box: Element | null }[] = [{ node: top, box: BOXES.includes(top.localName) ? top : null }];
  while (stack.length > 0) {
    const { node, box } = stack.pop() as { node: Node; box: Element | null };
    // A text is on the stack only with its box.
    if (node.nodeType === 3) {
      out.push({ text: node as Text, box: box as Element });
      continue;
    }
    // Children in reverse onto the stack, so they come off in document order. A comment is passed over.
    for (let c = node.lastChild; c !== null; c = c.previousSibling) {
      if (c.nodeType === 3) {
        if (box !== null) stack.push({ node: c, box });
        continue;
      }
      if (c.nodeType !== 1 || skip(c as Element)) continue;
      stack.push({ node: c, box: BOXES.includes((c as Element).localName) ? (c as Element) : box });
    }
  }
  return out;
}

/** The root's child elements, in document order (see the header). */
export function topElements(root: Element): Element[] {
  const out: Element[] = [];
  for (let c = root.firstElementChild; c !== null; c = c.nextElementSibling) out.push(c);
  return out;
}

/** Wrap a mention in `link` (see the header); the text node after it, or null. */
export function linkMention(ctx: FeatureContext, text: Text, at: number, length: number, link: HTMLElement): Text | null {
  const { journal } = ctx;
  const mid = at > 0 ? journal.split(text, at) : text;
  const after = length < mid.data.length ? journal.split(mid, length) : null;
  journal.wrap([mid], link);
  return after;
}
