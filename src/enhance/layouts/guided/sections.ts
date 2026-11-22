// What the guided layout's modules share about the document's sections: a heading's own words and the one section that
// is never folded or timed, "Where things stand". Pure helpers; no state.
import { headingText } from '../../headctl.js';
import { CHROME_ATTR } from '../../journal.js';
import type { FeatureContext } from '../../types.js';

/** A heading's own words: its text with the reader's chrome left out, which holds the number editorial.ts hung on it. */
export function bare(heading: Element): string {
  return headingText(heading, (el) => el.hasAttribute(CHROME_ATTR));
}

/** True for the "Where things stand" heading: the vocabulary's word for it. */
export function isStand(ctx: FeatureContext, heading: Element): boolean {
  return ctx.vocab.box.stand.test(bare(heading));
}

/**
 * A level-2 section's members: the root's children after the heading, up to the next level-2 heading or a block that holds one.
 * Chrome that other steps append at the root's end (the Contents' scrim, with nothing of the document in it) is not a member
 * of the last section, however far the section reaches.
 */
export function membersOf(heading: Element): Element[] {
  const out: Element[] = [];
  for (let n = heading.nextElementSibling; n !== null && !stops(n); n = n.nextElementSibling) out.push(n);
  while (out.length > 0 && isTail(out[out.length - 1] as Element)) out.pop();
  return out;
}

/**
 * A node of the reader's chrome with none of the document in it: what a step appends at the root's end. The lens's peek bar
 * is the exception: it belongs to the block before it, so it stays a member.
 */
function isTail(node: Element): boolean {
  return node.hasAttribute(CHROME_ATTR) && !node.classList.contains('peek-bar') && node.querySelector(':not([data-docreader-chrome])') === null;
}

/** What ends a section: a level-2 heading, or a box that holds one ("In short"). */
export function stops(node: Element): boolean {
  return node.localName === 'h2' || node.querySelector('h2') !== null;
}
