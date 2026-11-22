// What the guided layout's modules share about the document's sections: a heading's own words and the one section that
// is never folded or timed, "Where things stand". Pure helpers; no state.
import { headingText } from '../../headctl.js';
import { CHROME_ATTR } from '../../journal.js';
import type { FeatureContext } from '../../types.js';

/** A section number at the start of a heading's words: "3. ", "A2. ", "4b. ". */
const SECTION_NUMBER = /^[A-Z]?\d+[a-z]?\.\s+/;

/** A heading's words without its number: its accessible label when it has one, else its text with the reader's chrome left out. */
export function bare(heading: Element): string {
  return (heading.getAttribute('aria-label') ?? headingText(heading, (el) => el.hasAttribute(CHROME_ATTR))).replace(SECTION_NUMBER, '');
}

/** True for the "Where things stand" heading: the vocabulary's word for it. */
export function isStand(ctx: FeatureContext, heading: Element): boolean {
  return ctx.vocab.box.stand.test(bare(heading));
}

/** A level-2 section's members: the root's children after the heading, up to the next level-2 heading or a block that holds one. */
export function membersOf(heading: Element): Element[] {
  const out: Element[] = [];
  for (let n = heading.nextElementSibling; n !== null && !stops(n); n = n.nextElementSibling) out.push(n);
  return out;
}

/** What ends a section: a level-2 heading, or a box that holds one ("In short"). */
export function stops(node: Element): boolean {
  return node.localName === 'h2' || node.querySelector('h2') !== null;
}
