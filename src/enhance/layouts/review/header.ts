// The review layout's header card: the title block (the eyebrow, the title, the byline, the review strip and the facts
// panel the shared editorial and strip features built) moved into one card, and under it the reader's own progress:
// how many sections are read, how many changed since they were, and a button to the next one still unread. The key `n`
// goes to that section too (the reference workbench's next-unread key; this layout has no change stepper, which would
// otherwise hold `n`), and is listed on the keys sheet.
//
// Nothing here reads the document again. The card moves the block's own nodes (journal.wrap) and reads the read marks
// from the shared marks feature's controls (`button.h-mark`, whose classes it paints before it emits `marks`), so the
// counts are the marks' and no state of this layout's own exists: the marks are stored by marks.ts, as the default's.
//
// Built after `strip` (the strip is in the block by then) and after `marks` (the controls exist). A page that is not a
// document gets no card. A document whose headings give the marks nothing to mark (an "In short" box that holds all the
// sub-headings of a one-section page) gets the card without the progress row, and no key. The bar's "Skip to the text" link,
// which the bar sends to the first node that is not chrome, is sent on to the title, which the card now holds.
import { CHROME_ATTR, chrome, siblingRun } from '../../journal.js';
import type { FeatureContext } from '../../types.js';

/** A heading's text as the reader gives it: its label when it has one (numbered headings keep their number in it). */
function label(heading: Element): string {
  return (heading.getAttribute('aria-label') ?? heading.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** The read-mark controls of the root, in document order (the marks feature's: none when it marked nothing). */
export function readControls(root: Element): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('button.h-mark'));
}

/** Build the header card. */
export function build(ctx: FeatureContext): void {
  const { root, journal } = ctx;
  const doc = root.ownerDocument;
  // A document has its title among the root's own children (the lifecycle's check of a document counts them), so one
  // guard serves both: a page that is not a document gets no card.
  const title = ctx.info.isDocument ? Array.from(root.children).find((c) => c.localName === 'h1' && !c.hasAttribute(CHROME_ATTR)) : undefined;
  if (title === undefined) return;
  let first: Element = title;
  const before = title.previousElementSibling;
  if (before !== null && before.classList.contains('eyebrow') && before.hasAttribute(CHROME_ATTR)) first = before;
  let last: Element = title;
  // The parts that follow the title: the byline, the strip and the facts panel, and hidden source nodes (the meta line).
  for (let n = title.nextElementSibling; n !== null; n = n.nextElementSibling) {
    if (n.hasAttribute('hidden') || n.matches('dl.byline, section.review-strip, details.doc-facts')) last = n;
    else break;
  }
  const card = chrome(doc, 'header', { className: 'rv-card' });
  journal.wrap(siblingRun(first, last.nextSibling), card);

  const skip = ctx.slots?.skip ?? null;
  if (skip !== null) {
    journal.listen(skip, 'click', () => {
      journal.setAttribute(title, 'tabindex', '-1');
      title.scrollIntoView({ block: 'start' });
      title.focus({ preventScroll: true });
    });
  }
  if (readControls(root).length === 0) return;
  const count = chrome(doc, 'b', { className: 'rv-n' });
  const of = chrome(doc, 'span', { className: 'rv-of' });
  const changed = chrome(doc, 'span', { className: 'rv-changed' });
  const fill = chrome(doc, 'i');
  const track = chrome(doc, 'span', { className: 'rv-bar', attrs: { 'aria-hidden': 'true' } }, [fill]);
  const next = chrome(doc, 'button', { className: 'rv-next', attrs: { type: 'button' } });
  const progress = chrome(doc, 'div', { className: 'rv-read', attrs: { role: 'group', 'aria-label': 'Your reading' } }, [count, of, changed, track, next]);
  journal.insert(progress, card, null);

  let target: HTMLElement | null = null;
  const paint = (): void => {
    const all = readControls(root);
    const read = all.filter((c) => c.classList.contains('on')).length;
    const stale = all.filter((c) => c.classList.contains('changed')).length;
    target = all.find((c) => !c.classList.contains('on'))?.closest<HTMLElement>('h2, h3, h4, h5, h6') ?? null;
    count.textContent = String(read);
    of.textContent = ` of ${String(all.length)} read`;
    changed.textContent = stale > 0 ? `${String(stale)} changed since you read ${stale > 1 ? 'them' : 'it'}` : '';
    journal.setStyle(fill, 'width', `${String(Math.round((100 * read) / all.length))}%`);
    next.textContent = target === null ? 'All read' : read > 0 || stale > 0 ? `Next unread: ${ctx.text.clip(label(target), 34)}` : 'Start reading';
    journal.setAttribute(next, 'disabled', target === null ? '' : null);
  };
  // The button is disabled, and the key does not apply, when nothing is unread, so neither reaches `goTo` without a target.
  const go = (): void => ctx.nav.goTo(target as HTMLElement, { push: true });
  journal.listen(next, 'click', go);
  ctx.keys.bind({ key: 'n', label: 'Next unread section', when: () => target !== null, run: go });
  journal.defer(ctx.events.on('marks', paint));
  paint();
}
