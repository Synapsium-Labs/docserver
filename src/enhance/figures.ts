// Figures: book captions (the reference layout, section 10; docserver L2, Task 15).
//
// Each Mermaid figure of the document (render()'s `figure.mermaid-figure`, in document order) gets a number and a
// caption. A caption render() made (PD7: a `*Figure N. …*` line after the fence) opens with "Figure N.": the caption
// grammar, the format contract. Its first text node is split, never rewritten (journal.split): "Figure N." goes into
// a chrome `span.fig-no` and the rest of the caption, markup and all, into a chrome `span.cap-text`. The white space
// between them stays where it was; when there is none, a chrome space goes between, as the reference always put one.
// White space before "Figure" stays before the number. The number is the caption's ("3", "3a"); a figure whose
// caption does not open that way (the reference's pattern reads ASCII digits only), or whose number is longer than
// NO_MAX, or that has no caption, takes its position among the figures (1, 2, ...), and its caption is its whole text
// (or empty).
//
// Produces:
//   ctx.figures  one entry per figure (registry.ts): { no, caption, figure }, the caption being the text after the
//                number, its white space runs as one space.
//   ctx.index    an entry of kind 'figure' with the id `figure-<no>`, so a link `#figure-3` reaches the figure with
//                no id written on it (LD6), titled by its caption, clipped. It is defined only when nothing answers
//                that id yet: a document id (a heading "Figure 3" has the id figure-3) or an earlier figure of the
//                same number keeps it, as the reference gave a figure the id only when no element held it.
//
// Nothing here calls out or waits: it runs inside the startup operation and writes only through the journal, which
// destroy undoes (the spans go, the text nodes join again).
//
// Standard files, slug `figures`: test/enhance-figures.test.ts and conformance/layout/figures/. The Mermaid file is
// this task's too (scripts/build-mermaid.mjs); drawing is diagrams.ts's.
// Registered in features.ts, whose header says where in the build order and why.
import { chrome, siblingRun, type Journal } from './journal.js';
import type { FeatureContext } from './types.js';

/** A numbered caption's start: white space, then "Figure", white space, the number, a dot; then white space. */
const CAPTION_NO = /^(\s*)(Figure\s+(\d+[a-z]?)\.)(\s*)/;

/** The longest caption number read, in code units; a longer one leaves the caption as it is (a hostile document's). */
const NO_MAX = 32;

/** The longest index title, in code units (the reference's for a section or a row). */
const TITLE_MAX = 90;

/** A node's text, with runs of white space as one space, trimmed. */
const txt = (n: Node): string => (n.textContent ?? '').replace(/\s+/g, ' ').trim();

/**
 * Split a numbered caption: its first text node `first` (matched as `m`) is partitioned so that "Figure N." is a node
 * of its own, wrapped in a chrome span.fig-no; the white space after it stays (or a chrome space is put there); and
 * everything after that, wrapped in a chrome span.cap-text (empty when nothing follows). Returns the span.cap-text.
 */
function splitCaption(journal: Journal, cap: Element, first: Text, m: RegExpExecArray): Element {
  const doc = cap.ownerDocument;
  const lead = m[1] ?? '';
  const label = m[2] ?? '';
  const gap = m[4] ?? '';
  const no = lead.length > 0 ? journal.split(first, lead.length) : first;
  let sep: Node | null = null;
  if (label.length < no.data.length) {
    const after = journal.split(no, label.length);
    if (gap.length > 0) {
      sep = after;
      if (gap.length < after.data.length) journal.split(after, gap.length);
    }
  }
  const number = chrome(doc, 'span', { className: 'fig-no' });
  journal.wrap([no], number);
  if (sep === null) {
    sep = doc.createTextNode(' ');
    journal.insert(sep, cap, number.nextSibling);
  }
  const text = chrome(doc, 'span', { className: 'cap-text' });
  const rest = sep.nextSibling;
  if (rest === null) journal.insert(text, cap, null);
  else journal.wrap(siblingRun(rest, null), text);
  return text;
}

/** Build this feature during startup: number and caption each figure, and define its index entry. */
export function build(ctx: FeatureContext): void {
  const figures = Array.from(ctx.root.querySelectorAll('figure.mermaid-figure')) as HTMLElement[];
  figures.forEach((figure, i) => {
    const cap = figure.querySelector('figcaption');
    let no = String(i + 1);
    let text: Element | null = cap;
    const first = cap?.firstChild ?? null;
    if (cap !== null && first !== null && first.nodeType === 3) {
      const m = CAPTION_NO.exec((first as Text).data);
      const n = m?.[3];
      if (m !== null && n !== undefined && n.length <= NO_MAX) {
        no = n;
        text = splitCaption(ctx.journal, cap, first as Text, m);
      }
    }
    const caption = text === null ? '' : txt(text);
    ctx.figures.add({ no, caption, figure });
    const id = `figure-${no}`;
    if (ctx.nav.byId(id) === null) {
      ctx.index.define({ id, kind: 'figure', title: ctx.text.clip(caption, TITLE_MAX), status: null, group: '', target: figure, row: null, heads: [] });
    }
  });
}
