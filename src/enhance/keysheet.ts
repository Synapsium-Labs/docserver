// The keys sheet (docserver L2, Task 16), ported from the reference layout's section 25: "?" opens a dialog that lists
// the keys that apply now, and the colour key. The keyboard layer itself is keys.ts (Task 7b).
//
// The rows are read from ctx.keys.bindings() each time the sheet opens, never kept: every key a feature bound, that
// applies now and is listed, in the sheet's order (keys.ts's SHEET_ORDER, then any other in the order bound), so a key
// a later feature binds shows here with no edit to this file, and a key whose `when` does not hold now (a key of the
// outline on a short plan, of the changes when none are shown) does not. Keys next to each other with the same label
// share one row, their keys side by side, as the reference's "j k" and "n p" rows do: a feature that wants two keys on
// one row gives both the same label. The last row is always "Esc", "Close" (keys.ts closes the top dialog with it,
// whatever the binding). A key is shown as bound ("/", "?").
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
// and focuses Close. The focus stays inside the box: its one control is Close, and Tab and Shift+Tab from it do
// nothing (the reference's trap, which moved the focus from the box's last control to its first and back, for a box of
// one control). Close, a click outside the box, and Escape (overlays.ts, 'keys', in the order Task 7b fixed) close it
// and give the focus back to the element that had it, or, when that cannot take it (the page itself had the focus),
// take it out of the hidden sheet.
//
// With `keyboard: false` nothing could open it, so it is not built.
//
// Standard files, slug `jump`: test/enhance-jump.test.ts, test/browser/jump.test.ts, conformance/layout/jump/.
// Registered in features.ts, whose header says where in the build order and why.
import { chrome } from './journal.js';
import type { FeatureContext } from './types.js';

/** The last row: Escape, which keys.ts gives to the top dialog. */
const ESCAPE_ROW = { keys: ['Esc'], label: 'Close' } as const;

/** Build this feature during startup: the sheet, closed, and its key. */
export function build(ctx: FeatureContext): void {
  if (!ctx.options.keyboard) return;
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

  /** The rows of the keys that apply now: keys side by side with the same label share one; Escape last. */
  const fill = (): void => {
    const groups: { keys: string[]; label: string }[] = [];
    for (const b of ctx.keys.bindings()) {
      const last = groups[groups.length - 1];
      if (last !== undefined && last.label === b.label) last.keys.push(b.key);
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
    opener = doc.activeElement;
    fill();
    sheet.classList.add('open');
    closeBtn.focus();
  };

  journal.listen(sheet, 'click', (e) => {
    if (e.target === sheet) close();
  });
  journal.listen(closeBtn, 'click', () => {
    close();
  });
  journal.listen(sheet, 'keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Tab' && doc.activeElement === closeBtn) e.preventDefault();
  });

  ctx.overlays.register('keys', { isOpen, close });
  ctx.keys.bind({ key: '?', label: 'This sheet', run: openSheet });
}
