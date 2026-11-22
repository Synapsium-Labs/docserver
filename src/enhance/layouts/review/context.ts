// The review layout's context tool: a read-mark toggle in the sticky bar's tray, for the section being read.
//
// The bar's running head (scroll.ts) already names the section; this adds what the review workbench keeps beside it, one
// button that marks that section read or unread, saying which in its name. It owns no state: it follows the scroll spy's
// `spy` event for the unit being read and the marks' `marks` event for its state, and a click presses the unit's own
// read-mark control (marks.ts), which toggles, stores and emits. So the stored marks, the heading's control, the Contents
// rail's marks and the card's counts are always one answer. The `m` key stays the marks feature's.
//
// Only with the bar (ctx.slots) and read marks; otherwise it builds nothing.
import { chrome } from '../../journal.js';
import type { FeatureContext } from '../../types.js';

/** A heading's label: its accessible label when it has one, else its text. */
function label(heading: Element): string {
  return (heading.getAttribute('aria-label') ?? heading.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Build the context tool. */
export function build(ctx: FeatureContext): void {
  const { slots, root, journal } = ctx;
  if (slots === null || !ctx.info.isDocument || root.querySelector('button.h-mark') === null) return;
  const doc = root.ownerDocument;
  const button = chrome(doc, 'button', { className: 'rv-mark', attrs: { type: 'button', disabled: '' } });
  journal.insert(button, slots.tools, slots.tools.firstChild);
  let unit: HTMLElement | null = null;
  const control = (): HTMLElement | null => unit?.querySelector<HTMLElement>('button.h-mark') ?? null;
  const paint = (): void => {
    const held = control();
    const read = held?.classList.contains('on') === true;
    const stale = held?.classList.contains('changed') === true;
    button.textContent = read ? '✓ Read' : stale ? '● Changed' : '○ Mark read';
    journal.setAttribute(button, 'aria-pressed', read ? 'true' : 'false');
    journal.setAttribute(button, 'disabled', held === null ? '' : null);
    journal.toggleClass(button, 'changed', stale);
    journal.setAttribute(button, 'aria-label', unit === null || held === null ? 'Mark read' : `${read ? 'Mark unread' : 'Mark read'}: ${label(unit)}`);
  };
  journal.listen(button, 'click', () => control()?.click());
  journal.defer(ctx.events.on('spy', ({ unit: now }) => {
    unit = now;
    paint();
  }));
  journal.defer(ctx.events.on('marks', paint));
  paint();
}
