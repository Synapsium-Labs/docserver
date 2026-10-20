// Heading controls (docserver L2, Task 7b), from the reference layout's section 19: one `span.h-ctl` at the end of a
// heading, holding its controls as direct children (the stylesheet's `.h-ctl > *` rules), in a fixed order whatever
// order the features build in: the section link (`anchor`, position.ts, built last), the read mark (`mark`,
// marks.ts) and the fold (`fold`, folds.ts).
//
//   headCtl(h, slot, control)  put `control` (new chrome) into `h`'s `.h-ctl` at its slot's place, making the `.h-ctl`
//                              (as `h`'s last child) on the first call for `h`; answers the `.h-ctl`, so a feature
//                              that adds to the heading later can keep its node before the controls. One control per
//                              slot per heading. `h` is a heading (h1 to h6) inside the root. Everything goes through
//                              the journal, so destroy removes it; nothing is written once the instance is not live.
//   The first call for a heading also names it: a heading with neither aria-label nor aria-labelledby gets an
//   aria-label of its own text, read before the controls exist (each child's text trimmed, joined by spaces), so its
//   accessible name is its title and never a control's label. (The reference wrapped the title in a span with a made-up
//   id and pointed aria-labelledby at it; a label needs no id that could collide with the document's.)
// The controls of a heading are kept in a WeakMap, never in an expando on the element.
//
// Import-inert: declarations only.
import { chrome, type Journal } from './journal.js';

/** The slots of a heading's controls, in their order. */
export const HEAD_SLOTS = ['anchor', 'mark', 'fold'] as const;

export type HeadSlot = (typeof HEAD_SLOTS)[number];

export type HeadCtl = (h: HTMLElement, slot: HeadSlot, control: HTMLElement) => HTMLElement;

export interface HeadCtlArgs {
  readonly root: HTMLElement;
  readonly journal: Journal;
}

/** A heading's text: each child's text trimmed, joined by spaces. */
function headingText(h: Element): string {
  const parts: string[] = [];
  for (const n of Array.from(h.childNodes)) {
    const t = (n.textContent ?? '').trim();
    if (t !== '') parts.push(t);
  }
  return parts.join(' ').replace(/\s+/g, ' ');
}

/** The heading controls of one instance. */
export function createHeadCtl(args: HeadCtlArgs): HeadCtl {
  const { root, journal } = args;
  const held = new WeakMap<Element, { readonly ctl: HTMLElement; readonly bySlot: Map<HeadSlot, HTMLElement> }>();
  return (h, slot, control) => {
    const rank = HEAD_SLOTS.indexOf(slot);
    if (rank < 0) throw new Error(`docreader: a heading control's slot is one of ${HEAD_SLOTS.join(', ')}`);
    if (typeof h !== 'object' || h === null || h.nodeType !== 1 || !/^h[1-6]$/.test(h.localName) || !root.contains(h)) {
      throw new Error('docreader: headCtl takes a heading inside the root');
    }
    let rec = held.get(h);
    if (rec === undefined) {
      const ctl = chrome(root.ownerDocument, 'span', { className: 'h-ctl' });
      if (!h.hasAttribute('aria-label') && !h.hasAttribute('aria-labelledby')) journal.setAttribute(h, 'aria-label', headingText(h));
      journal.insert(ctl, h, null);
      rec = { ctl, bySlot: new Map() };
      held.set(h, rec);
    }
    if (rec.bySlot.has(slot)) throw new Error(`docreader: the ${slot} slot of this heading is taken`);
    let before: HTMLElement | null = null;
    for (const later of HEAD_SLOTS.slice(rank + 1)) {
      before = rec.bySlot.get(later) ?? null;
      if (before !== null) break;
    }
    journal.insert(control, rec.ctl, before);
    rec.bySlot.set(slot, control);
    return rec.ctl;
  };
}
