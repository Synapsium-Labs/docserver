// Section folding, ported from the reference reader's heading controls and its setFold.
//
// Each level-2 heading that is a child of the root, has an id and has blocks after it (up to the next level-2
// heading, or a block that holds one) gets a control: an `.h-fold` button in the heading's controls (headCtl's `fold`
// slot, after the section link and the read mark), and a `.fold-note` button right after the heading ("Folded", the
// section's reading time, "Show") that is visible only while the section is folded. Folding hides the section's
// blocks with hidden="until-found", so find-in-page still reaches them and opens the fold (`beforematch`). Only blocks
// the library hid are ever shown again: a block the author hid stays as the author left it. Printing shows folded
// sections; they fold again after.
//
// Only a document (ResolvedInfo.isDocument) gets folds, and `folds: false` turns them off (checked here: the
// lifecycle builds every feature through features.ts). The folded headings are
// per-document state, a JSON array of heading ids in document order under docreader:doc:<storageKey>:folds; an id
// that no longer names a heading is dropped at the next write.
//
// A fold action changes the local state first, writes it behind (the host's set() may run there, and may destroy
// the instance), and only then, if the instance is still live, changes the DOM, and asks for a relayout ('folds').
//
// The shared services (docserver L2, Task 7b): the fold is a revealer (ctx.onReveal), so reveal() unfolds the section
// that holds what it shows; and `ctx.folds` is the members API other features use (the settings' collapse and expand
// all, the lens's detail bars, which join the section of the block they follow):
//   headings()          each folding section's heading, in document order (empty without folds);
//   isFolded(h), setFold(h, on);
//   setAll(on)          fold or unfold every section: one write of the state, one relayout (a caller that keeps the
//                       reader's place wraps it in position.keep);
//   sectionOf(node)     the heading of the folding section whose blocks hold `node`, or null;
//   join(node, member)  make `node` (a root child the feature inserted) a block of `member`'s section: hidden while it
//                       is folded, and opening it from find-in-page; false when `member` is in no folding section, or
//                       `node` is joined already. Throws for a `node` that is not a child of the root or not chrome (a
//                       block of the document, a section's heading among them, is never a feature's to join), so a
//                       fold never writes hidden outside the root.
// The API exists from the start (the lifecycle makes it with createFolds); it answers empty until buildFolds has run.
import { headingText } from './headctl.js';
import { CHROME_ATTR, chrome } from './journal.js';
import { formatMinutes, sectionMinutes } from './reading.js';
import type { FeatureContext } from './types.js';

/** The per-document state name of the folds. */
export const FOLDS = 'folds';

// The reading-time helpers moved to reading.ts; re-exported here for the callers that import them from folds.
export { formatMinutes, sectionMinutes } from './reading.js';

/** The folds' members API (see the header). */
export interface Folds {
  headings(): readonly HTMLElement[];
  isFolded(h: Element): boolean;
  setFold(h: Element, on: boolean): void;
  setAll(on: boolean): void;
  sectionOf(node: Node): HTMLElement | null;
  join(node: Element, member: Element): boolean;
}

/** Each Folds the lifecycle made, and where its build puts the real implementation. */
let builds: WeakMap<Folds, (impl: Folds) => void> | undefined;

/** The folds' API of one instance: empty until buildFolds runs for it. */
export function createFolds(): Folds {
  let impl: Folds | null = null;
  const api: Folds = Object.freeze({
    headings: () => impl?.headings() ?? [],
    isFolded: (h: Element) => impl?.isFolded(h) ?? false,
    setFold: (h: Element, on: boolean) => {
      impl?.setFold(h, on);
    },
    setAll: (on: boolean) => {
      impl?.setAll(on);
    },
    sectionOf: (node: Node) => impl?.sectionOf(node) ?? null,
    join: (node: Element, member: Element) => impl?.join(node, member) ?? false,
  });
  (builds ??= new WeakMap()).set(api, (i) => {
    impl = i;
  });
  return api;
}

interface Section {
  readonly heading: HTMLElement;
  readonly id: string;
  /** Its blocks: the root's children after the heading, then any a feature joined. */
  readonly members: Element[];
  readonly btn: HTMLButtonElement;
  readonly note: HTMLButtonElement;
  folded: boolean;
  /** The members this library hid. */
  readonly hid: Set<Element>;
}

/** Every chrome node is left out of a section's name. */
const isChrome = (el: Element): boolean => el.hasAttribute(CHROME_ATTR);

export function buildFolds(ctx: FeatureContext): void {
  const { root, journal, state } = ctx;
  if (!ctx.options.folds || !ctx.info.isDocument) return;
  const doc = root.ownerDocument;
  const sections: Section[] = [];
  /** The section each member (and joined node) belongs to. */
  const sectionOfMember = new Map<Element, Section>();

  /** Hide or show one member as its section is folded or not. */
  const showMember = (s: Section, m: Element): void => {
    if (s.folded) {
      if (!m.hasAttribute('hidden')) {
        journal.setAttribute(m, 'hidden', 'until-found');
        s.hid.add(m);
      }
    } else if (s.hid.has(m)) {
      s.hid.delete(m);
      if (m.getAttribute('hidden') === 'until-found') journal.setAttribute(m, 'hidden', null);
    }
  };

  /** Put a section's fold state on the DOM. Calls no host code; its callers check live() before it. */
  const show = (s: Section): void => {
    const on = s.folded;
    for (const m of s.members) showMember(s, m);
    journal.toggleClass(s.heading, 'folded', on);
    s.note.hidden = !on;
    s.btn.textContent = on ? 'Unfold' : 'Fold';
    s.btn.setAttribute('aria-expanded', String(!on));
  };

  /** Write the folded headings behind; false when the host's set() destroyed the instance. */
  const save = (): boolean => {
    const ids = sections.filter((x) => x.folded).map((x) => x.id);
    state.writeDoc(FOLDS, ids.length > 0 ? [...new Set(ids)] : null);
    return ctx.live(); // the host's set() ran: it may have destroyed the instance
  };

  /** Fold or unfold one section: local state, then the write-behind, then (still live) the DOM and a relayout. */
  const setFold = (s: Section, on: boolean): void => {
    if (s.folded === on) return;
    s.folded = on;
    if (!save()) return;
    show(s);
    ctx.relayout('folds');
  };

  /** Fold or unfold every section: one write, then (still live) the DOM and one relayout. */
  const setAll = (on: boolean): void => {
    const changed = sections.filter((s) => s.folded !== on);
    if (changed.length === 0) return;
    for (const s of changed) s.folded = on;
    if (!save()) return;
    for (const s of changed) show(s);
    ctx.relayout('folds');
  };

  /** The folding section whose blocks hold `node`: through the root's child that holds it. */
  const holding = (node: Node): Section | null => {
    let top: Node | null = node;
    while (top !== null && top.parentNode !== root) top = top.parentNode;
    return top !== null && top.nodeType === 1 ? (sectionOfMember.get(top as Element) ?? null) : null;
  };

  const listenFind = (s: Section, m: Element): void => {
    journal.listen(m, 'beforematch', () => {
      setFold(s, false);
    });
  };

  for (const h of Array.from(root.children) as HTMLElement[]) {
    if (h.localName !== 'h2' || h.id === '') continue;
    const members: Element[] = [];
    for (let n = h.nextElementSibling; n !== null && n.localName !== 'h2' && n.querySelector('h2') === null; n = n.nextElementSibling) {
      members.push(n);
    }
    if (members.length === 0) continue;
    const bare = headingText(h, isChrome).replace(/^[A-Z]?\d+[a-z]?\.\s+/, '');
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
    for (const m of members) sectionOfMember.set(m, s);
    journal.insert(note, root, h.nextSibling);
    // The heading is named by its own text, not by the controls inside it: headCtl labels it (aria-label) as it makes
    // the controls, unless the heading has a label already.
    ctx.headCtl(h, 'fold', btn);
    journal.listen(btn, 'click', (e) => {
      e.preventDefault();
      setFold(s, !s.folded);
    });
    journal.listen(note, 'click', () => {
      setFold(s, false);
    });
    for (const m of members) listenFind(s, m);
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

  // Reveal unfolds the section that holds what it shows.
  ctx.onReveal((el) => {
    const s = holding(el);
    if (s !== null) setFold(s, false);
  });

  const bySection = new Map<Element, Section>(sections.map((s) => [s.heading, s]));
  builds?.get(ctx.folds)?.(
    Object.freeze({
      headings: () => Object.freeze(sections.map((s) => s.heading)),
      isFolded: (h: Element) => bySection.get(h)?.folded ?? false,
      setFold: (h: Element, on: boolean) => {
        const s = bySection.get(h);
        if (s !== undefined) setFold(s, on);
      },
      setAll,
      sectionOf: (node: Node) => holding(node)?.heading ?? null,
      join: (node: Element, member: Element) => {
        if (node.parentNode !== root || !node.hasAttribute(CHROME_ATTR)) {
          throw new Error('docreader: folds.join takes a node the feature put in the root, as a child of it');
        }
        const s = sectionOfMember.get(member);
        if (s === undefined || sectionOfMember.has(node)) return false;
        s.members.push(node);
        sectionOfMember.set(node, s);
        listenFind(s, node);
        showMember(s, node);
        return true;
      },
    }),
  );

  // Print shows everything, whatever is folded (the root's window, through env).
  ctx.env.onPrint((printing) => {
    for (const s of sections) {
      if (!s.folded) continue;
      for (const m of s.hid) {
        if (printing && m.getAttribute('hidden') === 'until-found') journal.setAttribute(m, 'hidden', null);
        else if (!printing && !m.hasAttribute('hidden')) journal.setAttribute(m, 'hidden', 'until-found');
      }
    }
  });
}
