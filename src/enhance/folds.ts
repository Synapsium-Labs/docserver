// Section folding, ported from the reference reader's heading controls and its setFold.
//
// Each level-2 heading that is a child of the root, has an id and has blocks after it (up to the next level-2
// heading, or a block that holds one) gets a control: a `.h-ctl` span at the end of the heading holding an
// `.h-fold` button, and a `.fold-note` button right after the heading ("Folded", the section's reading time,
// "Show") that is visible only while the section is folded. Folding hides the section's blocks with
// hidden="until-found", so find-in-page still reaches them and opens the fold (`beforematch`). Only blocks the
// library hid are ever shown again: a block the author hid stays as the author left it. Printing shows folded
// sections; they fold again after.
//
// Only a document (ResolvedInfo.isDocument) gets folds, and `folds: false` turns them off. The folded headings are
// per-document state, a JSON array of heading ids in document order under docreader:doc:<storageKey>:folds; an id
// that no longer names a heading is dropped at the next write.
//
// A fold action changes the local state first, writes it behind (the host's set() may run there, and may destroy
// the instance), and only then, if the instance is still live, changes the DOM.
import { chrome } from './journal.js';
import type { FeatureContext } from './types.js';

/** The per-document state name of the folds. */
export const FOLDS = 'folds';

interface Section {
  readonly heading: Element;
  readonly id: string;
  readonly members: readonly Element[];
  readonly btn: HTMLButtonElement;
  readonly note: HTMLButtonElement;
  folded: boolean;
  /** The members this library hid. */
  readonly hid: Set<Element>;
}

/** Words in a text: runs of characters other than space, tab, line feed, carriage return and no-break space. */
function words(s: string): number {
  let n = 0;
  let inWord = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    const space = c === 32 || c === 10 || c === 9 || c === 13 || c === 160;
    if (!space && !inWord) n += 1;
    inWord = !space;
  }
  return n;
}

/** The reference's reading time of a section, in minutes: prose at 230 words a minute, code at 520, half a minute a figure. */
export function sectionMinutes(heading: Element, members: readonly Element[]): number {
  let prose = words(heading.textContent ?? '');
  let code = 0;
  let figs = 0;
  for (const n of members) {
    if (n.localName === 'script' || n.localName === 'dl') continue;
    if (n.localName === 'figure') {
      figs += 1;
      continue;
    }
    const all = words(n.textContent ?? '');
    if (n.classList.contains('codehilite') || n.localName === 'pre') {
      code += all;
      continue;
    }
    let inner = 0;
    if (n.firstElementChild !== null) {
      for (const x of Array.from(n.querySelectorAll('.codehilite'))) inner += words(x.textContent ?? '');
      figs += n.getElementsByTagName('figure').length;
    }
    code += inner;
    prose += Math.max(0, all - inner);
  }
  return prose / 230 + code / 520 + figs * 0.5;
}

/** "12 min", "1.5 h", or '' under a minute. */
export function formatMinutes(m: number): string {
  if (m < 1) return '';
  return m < 59.5 ? `${String(Math.round(m))} min` : `${String(Math.round(m / 6) / 10)} h`;
}

/** The heading's text: each child's text trimmed, joined by spaces; chrome left out when `withChrome` is false. */
function headingText(h: Element, withChrome: boolean): string {
  const parts: string[] = [];
  for (const n of Array.from(h.childNodes)) {
    if (!withChrome && n.nodeType === 1 && (n as Element).hasAttribute('data-docreader-chrome')) continue;
    const t = (n.textContent ?? '').trim();
    if (t !== '') parts.push(t);
  }
  return parts.join(' ').replace(/\s+/g, ' ');
}

export function buildFolds(ctx: FeatureContext): void {
  const { root, journal, state } = ctx;
  if (!ctx.info.isDocument) return;
  const doc = root.ownerDocument;
  const sections: Section[] = [];

  /** Put a section's fold state on the DOM. Calls no host code; its callers check live() before it. */
  const show = (s: Section): void => {
    const on = s.folded;
    for (const m of s.members) {
      if (on) {
        if (!m.hasAttribute('hidden')) {
          journal.setAttribute(m, 'hidden', 'until-found');
          s.hid.add(m);
        }
      } else if (s.hid.has(m)) {
        s.hid.delete(m);
        if (m.getAttribute('hidden') === 'until-found') journal.setAttribute(m, 'hidden', null);
      }
    }
    journal.toggleClass(s.heading, 'folded', on);
    s.note.hidden = !on;
    s.btn.textContent = on ? 'Unfold' : 'Fold';
    s.btn.setAttribute('aria-expanded', String(!on));
  };

  /** Fold or unfold one section: local state, then the write-behind, then (still live) the DOM. */
  const setFold = (s: Section, on: boolean): void => {
    if (s.folded === on) return;
    s.folded = on;
    const ids = sections.filter((x) => x.folded).map((x) => x.id);
    state.writeDoc(FOLDS, ids.length > 0 ? [...new Set(ids)] : null);
    if (!ctx.live()) return; // the host's set() ran: it may have destroyed the instance
    show(s);
  };

  for (const h of Array.from(root.children)) {
    if (h.localName !== 'h2' || h.id === '') continue;
    const members: Element[] = [];
    for (let n = h.nextElementSibling; n !== null && n.localName !== 'h2' && n.querySelector('h2') === null; n = n.nextElementSibling) {
      members.push(n);
    }
    if (members.length === 0) continue;
    const bare = headingText(h, false).replace(/^[A-Z]?\d+[a-z]?\.\s+/, '');
    const minutes = formatMinutes(sectionMinutes(h, members));
    const btn = chrome(doc, 'button', {
      className: 'h-fold',
      text: 'Fold',
      attrs: { type: 'button', 'aria-expanded': 'true', 'aria-label': `Fold or unfold: ${bare}` },
    });
    const note = chrome(doc, 'button', { className: 'fold-note', attrs: { type: 'button', hidden: '', 'aria-label': `Unfold: ${bare}` } }, [
      chrome(doc, 'span', { className: 'fn-t', text: 'Folded' }),
      ...(minutes === '' ? [] : [chrome(doc, 'span', { className: 'fn-m', text: minutes })]),
      chrome(doc, 'span', { className: 'fn-s', text: 'Show' }),
    ]);
    const s: Section = { heading: h, id: h.id, members, btn, note, folded: false, hid: new Set() };
    sections.push(s);
    // The heading is named by its own text, not by the controls inside it (the reference used aria-labelledby on
    // a wrapper with a made-up id; a label needs no id that could collide with the document's).
    if (!h.hasAttribute('aria-label') && !h.hasAttribute('aria-labelledby')) journal.setAttribute(h, 'aria-label', headingText(h, true));
    journal.insert(note, root, h.nextSibling);
    journal.insert(chrome(doc, 'span', { className: 'h-ctl' }, [btn]), h, null);
    journal.listen(btn, 'click', (e) => {
      e.preventDefault();
      setFold(s, !s.folded);
    });
    journal.listen(note, 'click', () => {
      setFold(s, false);
    });
    for (const m of members) {
      journal.listen(m, 'beforematch', () => {
        setFold(s, false);
      });
    }
  }
  if (sections.length === 0) return;

  // Restore the stored folds. Reading the stored value may run host code.
  const stored = state.readDoc(FOLDS);
  if (!ctx.live()) return;
  const want = new Set(Array.isArray(stored) ? stored.filter((x): x is string => typeof x === 'string') : []);
  for (const s of sections) {
    if (!want.has(s.id)) continue;
    s.folded = true;
    show(s);
  }

  // Print shows everything, whatever is folded.
  const view = doc.defaultView;
  if (view !== null) {
    journal.listen(view, 'beforeprint', () => {
      for (const s of sections) {
        if (!s.folded) continue;
        for (const m of s.hid) if (m.getAttribute('hidden') === 'until-found') journal.setAttribute(m, 'hidden', null);
      }
    });
    journal.listen(view, 'afterprint', () => {
      for (const s of sections) {
        if (!s.folded) continue;
        for (const m of s.hid) if (!m.hasAttribute('hidden')) journal.setAttribute(m, 'hidden', 'until-found');
      }
    });
  }
}
