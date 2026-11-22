// The review layout's context tool: a read-mark toggle in the sticky bar's tray, for the section being read.
//
// The bar's running head (scroll.ts) already names the section; this adds what the review workbench keeps beside it, one
// button that marks that section read or unread, saying which in its name. It owns no state: it follows the scroll spy's
// `spy` event for the unit being read and the marks' `marks` event for its state, and a click presses the unit's own
// read-mark control (marks.ts), which toggles, stores and emits. So the stored marks, the heading's control, the Contents
// rail's marks and the card's counts are always one answer. The `m` key stays the marks feature's.
//
// Only with the bar (ctx.slots), for a document whose sections the marks feature marked; otherwise it builds nothing. The
// tool takes the tray's first slot (the one the change stepper has in the default, which this layout leaves out).
import { chrome } from '../../journal.js';
import type { FeatureContext } from '../../types.js';
import { readControls } from './header.js';

/** A heading's label: its accessible label when it has one, else its text. */
function label(heading: Element): string {
  return (heading.getAttribute('aria-label') ?? heading.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** Build the context tool. */
export function build(ctx: FeatureContext): void {
  const { slots, root, journal } = ctx;
  if (slots === null || !ctx.info.isDocument || readControls(root).length === 0) return;
  const doc = root.ownerDocument;
  const button = chrome(doc, 'button', { className: 'rv-mark', attrs: { type: 'button', disabled: '' } });
  // The tray's slot for the change stepper, which this layout does not build: `tool` keeps the bar's landmark in step.
  slots.tool('changes', button);
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
  // The button is disabled while no unit is being read, so a click always has a control.
  journal.listen(button, 'click', () => (control() as HTMLElement).click());
  journal.defer(ctx.events.on('spy', ({ unit: now }) => {
    unit = now;
    paint();
  }));
  journal.defer(ctx.events.on('marks', paint));
  paint();
}
