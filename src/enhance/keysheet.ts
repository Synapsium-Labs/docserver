// The keys sheet (docserver L2, Task 16), ported from the reference layout's section 25: "?" opens a dialog that lists
// the keys that apply now, and the colour key. The keyboard layer itself is keys.ts (Task 7b).
//
// The rows are read from ctx.keys.bindings() each time the sheet opens, never kept: every key a feature bound, that
// applies now and is listed, in the sheet's order (keys.ts's SHEET_ORDER, then any other in the order bound), so a key
// a later feature binds shows here with no edit to this file, and a key whose `when` does not hold now (a key of the
// outline on a short plan, of the changes when none are shown) does not. Two keys next to each other share one row,
// their keys side by side, when they are one of the reference sheet's pairs (PAIRS: "j k", next and previous section;
// "n p", next and previous change), the row then reading the pair's label whatever labels the two bindings carry, or
// when their labels are equal. The last row is always "Esc", "Close" (keys.ts closes the top dialog with it, whatever
// the binding). A key is shown as bound ("/", "?").
//
// The dialog, chrome at the end of the root, in an unstyled wrapper of its own (jump.ts's header says why):
//   div.keys > div.box[role=dialog][aria-modal=true][aria-labelledby=<the heading's id>] holding
//     div.kh: h2 "Keyboard" (its id a chrome id of this instance, C48) and button.linkish "Close";
//     dl: per row a dt of kbd elements (a space between two) and a dd of the label;
//     h2.kh2 "Colour key", and the colour key (ctx.text.colourKey: the vocabulary's entries, whose labels are the
//     format contract, C48).
// `.keys.open` shows it (the stylesheet's).
//
// Opening it (the "?" key, through ctx.keys, so never in a field, never while a dialog is open, and never with
// `keyboard: false`) remembers the element that had the focus (the root document's activeElement), lists the rows,
// and focuses Close. The focus stays inside the box: its one control is Close, Tab and Shift+Tab from it do nothing
// (the reference's trap, which moved the focus from the box's last control to its first and back, for a box of one
// control), and a press inside the box but off a button takes no focus (its mousedown's default prevented), so the
// focus never falls to the page behind it, where Tab would leave the sheet and, with two roots, Escape would reach
// neither (keys.ts, RF2). Close, a click outside the box, and Escape (overlays.ts, 'keys', in the order Task 7b fixed)
// close it and give the focus back to the element that had it, or, when that cannot take it (the page itself had the
// focus), take it out of the hidden sheet. A destroy while it is open closes it first, so the focus goes back before
// the sheet goes.
//
// With `keyboard: false` no key opens it, but the sheet is still built for the reference's contents rail "Keys"
// button (Task 18), which opens it through showKeys(ctx).
//
// Standard files, slug `jump`: test/enhance-jump.test.ts, test/browser/jump.test.ts, conformance/layout/jump/.
// Registered in features.ts, whose header says where in the build order and why.
import { chrome } from './journal.js';
import type { FeatureContext } from './types.js';

let sheets: WeakMap<FeatureContext, () => void> | undefined;

/** Show this root's keys sheet when the feature built one. */
export function showKeys(ctx: FeatureContext): void {
  sheets?.get(ctx)?.();
}

/** The reference sheet's pairs: two keys on one row, read with the pair's label (the reference's words). */
const PAIRS: readonly { readonly first: string; readonly second: string; readonly label: string }[] = [
  { first: 'j', second: 'k', label: 'Next / previous section' },
  { first: 'n', second: 'p', label: 'Next / previous change' },
];

/** The last row: Escape, which keys.ts gives to the top dialog. */
const ESCAPE_ROW = { keys: ['Esc'], label: 'Close' } as const;

/** Build this feature during startup: the sheet, closed, and its key. */
export function build(ctx: FeatureContext): void {
  const { root, journal } = ctx;
  const doc = root.ownerDocument;

  const headingId = ctx.chromeId('keys-heading');
  const closeBtn = chrome(doc, 'button', { className: 'linkish', text: 'Close', attrs: { type: 'button' } });
  const dl = chrome(doc, 'dl');
  const box = chrome(doc, 'div', { className: 'box', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': headingId } }, [
    chrome(doc, 'div', { className: 'kh' }, [chrome(doc, 'h2', { text: 'Keyboard', attrs: { id: headingId } }), closeBtn]),
    dl,
    chrome(doc, 'h2', { className: 'kh2', text: 'Colour key' }),
    ctx.text.colourKey(doc),
  ]);
  const sheet = chrome(doc, 'div', { className: 'keys' }, [box]);
  journal.insert(chrome(doc, 'div', {}, [sheet]), root, null);

  /** What had the focus when the sheet opened. */
  let opener: Element | null = null;

  /** The rows of the keys that apply now: keys side by side that are a pair, or have one label, share one; Escape last. */
  const fill = (): void => {
    const groups: { keys: string[]; label: string }[] = [];
    for (const b of ctx.keys.bindings()) {
      const last = groups[groups.length - 1];
      const pair = last === undefined ? undefined : PAIRS.find((p) => p.first === last.keys[last.keys.length - 1] && p.second === b.key);
      if (last !== undefined && pair !== undefined) {
        last.keys.push(b.key);
        last.label = pair.label;
      } else if (last !== undefined && last.label === b.label) last.keys.push(b.key);
      else groups.push({ keys: [b.key], label: b.label });
    }
    groups.push({ keys: [...ESCAPE_ROW.keys], label: ESCAPE_ROW.label });
    const items: HTMLElement[] = [];
    for (const g of groups) {
      const keys: Node[] = [];
      g.keys.forEach((k, i) => {
        if (i > 0) keys.push(doc.createTextNode(' '));
        keys.push(chrome(doc, 'kbd', { text: k }));
      });
      items.push(chrome(doc, 'dt', {}, keys), chrome(doc, 'dd', { text: g.label }));
    }
    dl.replaceChildren(...items);
  };

  const isOpen = (): boolean => sheet.classList.contains('open');

  const close = (): void => {
    sheet.classList.remove('open');
    if (opener !== null) (opener as HTMLElement).focus({ preventScroll: true });
    // Nothing took it back (the page itself had it): the focus leaves the hidden dialog, so no key goes there.
    const now = doc.activeElement;
    if (now !== null && box.contains(now)) (now as HTMLElement).blur();
  };

  const openSheet = (): void => {
    if (!ctx.live()) return;
    opener = doc.activeElement;
    fill();
    sheet.classList.add('open');
    closeBtn.focus();
  };

  // A destroy while it is open closes it first (teardown runs in reverse), so the focus goes back before the box goes.
  journal.defer(() => {
    if (isOpen()) close();
  });

  journal.listen(sheet, 'click', (e) => {
    if (e.target === sheet) close();
  });
  // A press inside the box but off a button takes no focus, so the focus never leaves the sheet for the page.
  journal.listen(box, 'mousedown', (e) => {
    if ((e.target as Element).closest('button') === null) e.preventDefault();
  });
  journal.listen(closeBtn, 'click', () => {
    close();
  });
  journal.listen(sheet, 'keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Tab' && doc.activeElement === closeBtn) e.preventDefault();
  });

  ctx.overlays.register('keys', { isOpen, close });
  const registry = sheets ??= new WeakMap<FeatureContext, () => void>();
  journal.defer(() => {
    registry.delete(ctx);
  });
  registry.set(ctx, openSheet);
  if (ctx.options.keyboard) ctx.keys.bind({ key: '?', label: 'This sheet', run: openSheet });
}
