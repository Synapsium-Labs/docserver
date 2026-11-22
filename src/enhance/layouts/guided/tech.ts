// The guided layout's quieter prose under the Product lens (the reference's `tech-text`): a paragraph or list item of more
// than sixty characters of which more than about a third (`SHARE`, 0.32) is code is marked, and the stylesheet quietens it when the lens is Product,
// as the shared `attention` quietens code blocks, technical tables and file paths. Nothing is hidden.
//
// A paragraph or item inside a table, the "In short" box or a figure is left alone. An item's own text is what counts, not a
// nested list's or a code block's. Built after `attention`.
import type { FeatureContext } from '../../types.js';

/** The share of a text that is code, above which it is technical, and the least text that can be. */
const SHARE = 0.32;
const LEAST = 60;

/** Mark the technical prose. */
export function build(ctx: FeatureContext): void {
  for (const block of Array.from(ctx.root.querySelectorAll('p, li'))) {
    if (block.closest('table, .short, figure') !== null) continue;
    let total = 0;
    let code = 0;
    for (const node of Array.from(block.childNodes)) {
      const el = node as Element;
      if (node.nodeType === 1 && (el.localName === 'ul' || el.localName === 'ol' || el.classList.contains('codehilite') || el.classList.contains('code-wrap'))) continue;
      const text = node.textContent ?? '';
      total += text.length;
      if (node.nodeType === 1) {
        if (el.localName === 'code') code += text.length;
        else for (const c of Array.from(el.querySelectorAll('code'))) code += (c.textContent ?? '').length;
      }
    }
    if (total > LEAST && code / total > SHARE) ctx.journal.toggleClass(block, 'tech-text', true);
  }
}
