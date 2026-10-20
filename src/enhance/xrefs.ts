// Cross-references: the first mention of a defined ID in each block links to it (the reference layout, section 12).
// Built by L2 Task 13.
//
// Consumes ctx.index (the IDs rules.ts, ids.ts and figures.ts defined), ctx.vocab (the ID grammar and the qualifiers)
// and ctx.page (the byline and the facts panel, which hold no mention). Produces `a.xref[data-ref]` with
// aria-haspopup="dialog" and aria-expanded="false" (for the preview cards, Task 17), chrome around split text: the
// mention's own text node moves into the link, so the document's text never changes. Its href is "#<ID>" (escaped
// for a fragment), which nav resolves (LD6): a document id of that text first, then the ID in the index. So a click
// goes there through nav.goTo, which tells the host the ID (onHash). No id is written on any node.
//
// What it reads (mentions.ts): every text in a block (a paragraph, list item, table cell, description or quote) of
// the root, in document order, outside the document's code, keyboard keys, links, headings, table heads, figures and
// code blocks, and outside the layout's buttons, a rule's head, a step's number, the byline, the facts panel and what
// the layout hid. In each text, the vocabulary's ID scan finds the mentions, as whole words. A mention links when:
//   - the index defines that ID;
//   - it is the first linked mention of that ID in its block (a later one in the same block stays text);
//   - it is not inside the ID's own target (a row does not link to itself);
//   - no qualifier word ends right before it ("the annex R3" names another document's R3). The qualifier is read in a
//     reach before the mention: its longest word and QUAL_WINDOW more code units for the white space between, so a
//     long text costs no more per mention than a short one.
// Nothing is read when the index is empty. A document of n characters costs O(n): one scan per text, a Map per block.
//
// Standard files, slug `links`: test/enhance-links.test.ts, and the Level 2 cases in conformance/layout/links/.
// Registered in features.ts, whose header says where in the build order and why.
import { chrome } from './journal.js';
import { linkMention, mentionTexts, skipsMarkup, topElements } from './mentions.js';
import type { FeatureContext } from './types.js';

/** The white space a qualifier may leave before a mention, beyond its own length, in code units (the reference's 24). */
export const QUAL_WINDOW = 24;

/** Build this feature during startup. */
export function build(ctx: FeatureContext): void {
  const { root, index, vocab, page } = ctx;
  if (index.all().length === 0) return;
  const reach = QUAL_WINDOW + vocab.words.qualifiers.reduce((n, w) => Math.max(n, w.length), 0);
  const doc = root.ownerDocument;
  const skip = (el: Element): boolean => skipsMarkup(el, page);
  /** Per block, the IDs already linked in it. */
  const done = new Map<Element, Set<string>>();
  for (const top of topElements(root)) {
    for (const { text, box } of mentionTexts(top, skip)) {
      let seen = done.get(box);
      if (seen === undefined) done.set(box, (seen = new Set()));
      const s = text.data;
      const found: { readonly at: number; readonly id: string }[] = [];
      const scan = vocab.idScan();
      for (let m = scan.exec(s); m !== null; m = scan.exec(s)) {
        const id = m[1] ?? '';
        const entry = index.get(id);
        if (entry === undefined || seen.has(id)) continue;
        if (entry.target.contains(text)) continue;
        if (vocab.qualifier.test(s.slice(Math.max(0, m.index - reach), m.index))) continue;
        seen.add(id);
        found.push({ at: m.index, id });
      }
      // Last first: each link splits off the end of `text`, which keeps the text before it, where the earlier ones are.
      for (let i = found.length - 1; i >= 0; i -= 1) {
        const { at, id } = found[i] as { readonly at: number; readonly id: string };
        const link = chrome(doc, 'a', {
          className: 'xref',
          attrs: { href: `#${encodeURIComponent(id)}`, 'data-ref': id, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' },
        });
        linkMention(ctx, text, at, id.length, link);
      }
    }
  }
}
