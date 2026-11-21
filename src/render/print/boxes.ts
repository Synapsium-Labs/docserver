// The "In short" and "Where things stand" boxes and the hanging section numbers (print mode; src/enhance/editorial.ts,
// sections 5 and 6). The boxes wrap the heading and its siblings in `div.short` and `div.callout.<kind>`; a section number is
// a `span.sec-no` holding the number, and the ". " after it, which the reader hides, is not printed. The "Where things stand"
// link row (`nav.stand-index`) is chrome that goes to the boxes, and paper has no links, so it is not printed. What the review
// strip needs of the first "Waiting" box (the text of its items) is taken here, before anything else moves.
import type { PrintCtx } from './context.js';
import { all, attr, detach, el, isEl, isText, nextEl, run, split, squash, textOf, wrap, type ElN } from './tree.js';

/** A section number at the start of a heading: "3. ", "A2. ", "4b. ". */
const SEC_NO = /^([A-Z]?\d+[a-z]?)\.\s+/;

export function buildBoxes(ctx: PrintCtx): void {
  const { root, vocab } = ctx;
  const labelOf = (h: ElN): string => ctx.label.get(h) ?? squash(textOf(h));
  const h2s = all(root, (e) => e.name === 'h2' && attr(e, 'id') !== null);

  const box = (h: ElN, cls: string, stops: readonly string[]): ElN => {
    let stop = nextEl(h);
    while (stop !== null && !stops.includes(stop.name)) stop = nextEl(stop);
    return wrap(run(h, stop), el('div', cls));
  };
  const short = h2s.find((h) => vocab.box.short.test(labelOf(h)));
  if (short !== undefined) box(short, 'short', ['h1', 'h2', 'hr']);

  const stand = h2s.find((h) => vocab.box.stand.test(labelOf(h)));
  if (stand !== undefined) {
    const h3s: ElN[] = [];
    for (let n = nextEl(stand); n !== null && n.name !== 'h1' && n.name !== 'h2'; n = nextEl(n)) if (n.name === 'h3') h3s.push(n);
    for (const h of h3s) {
      const k = labelOf(h);
      const c = vocab.callout.agreed.test(k) ? 'agreed' : vocab.callout.waiting.test(k) ? 'waiting' : vocab.callout.later.test(k) ? 'later' : 'other';
      const b = box(h, `callout ${c}`, ['h1', 'h2', 'h3', 'hr']);
      if (c === 'waiting' && ctx.waitBox === null) {
        ctx.waitBox = b;
        for (const list of b.kids.filter(isEl)) {
          if (list.name !== 'ul' && list.name !== 'ol') continue;
          for (const li of list.kids.filter(isEl)) if (li.name === 'li') ctx.waiting.push(squash(textOf(li)));
        }
      }
    }
  }

  for (const h of h2s) {
    const t = h.kids[0];
    if (!isText(t)) continue;
    const m = SEC_NO.exec(t.data);
    const no = m?.[1];
    if (m === null || no === undefined) continue;
    const sep = split(t, no.length);
    if (m[0].length - no.length < sep.data.length) split(sep, m[0].length - no.length);
    wrap([t], el('span', 'sec-no'));
    detach(sep);
  }
}
