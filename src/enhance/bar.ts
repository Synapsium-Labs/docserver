// The bar's skeleton (docserver L2, Task 7b; Task 12 styles it and drives it), from the reference layout's section 13:
// a skip link, the bar with its running head and its tool tray, and the progress line, all chrome inside the root
// (LD10), made only with `chrome.bar` (the default). Unstyled here: until Task 12 places the bar, the running head is
// empty and the tray holds only what features put in it, so the reading column does not move.
//
// The root's children, ahead of the document:
//   a.skip-link        "Skip to the text", the first stop for the keyboard: it scrolls to the document's first node
//                      past the skeleton (the root's first child that is not chrome, usually the title) and focuses
//                      it (a journaled tabindex="-1" when it takes no focus of its own), so the next Tab goes into the
//                      text past the bar's tools. It never focuses the root: the skip link and the bar are inside the
//                      root (LD10), so the next Tab from the root would be the skip link again, then every tool. (The
//                      reference's skip link went to a container after its bar, which this root is not.) With no
//                      document node it focuses the root. It makes no hash and calls no host. Only for a document
//                      (ResolvedInfo.isDocument), as the reference's. It precedes the bar: the stylesheet takes it out
//                      of the flow (fixed, shown on focus), so the bar is still the first box in the root.
//   nav.topbar         the bar (`slots.bar`), holding div.topbar-inner, which holds:
//     div.running-head   the running head (`slots.running`; aria-hidden: it repeats the section's title), and
//     div.bar-tools      the tool tray (`slots.tools`).
//   div.doc-progress   the progress line (`slots.progress`).
// `slots.tool(kind, node)` puts a feature's tool in the tray at its kind's place, in TOOL_ORDER (the order the
// reference's tray ends up in: the changes stepper, the Outline button, the quick jump, the reading settings, the
// Contents button), whatever order the features build in; one tool per kind. A feature that adds to the bar itself
// (the day banner, Task 22) appends to `slots.bar`.
//
// The lifecycle makes the skeleton before the first feature builds, so features put their tools in it during their
// build, and puts it in the root once every feature is built, so no feature's build sees it among the root's children
// (a walk of the document's blocks, a reading time). Everything goes through the journal.
//
// Import-inert: declarations only.
import { CHROME_ATTR, chrome, type Journal } from './journal.js';
import { focusable } from './nav.js';

/** The tray's tools, in their order. */
export const TOOL_ORDER = ['changes', 'outline', 'jump', 'settings', 'contents'] as const;

export type ToolKind = (typeof TOOL_ORDER)[number];

export interface BarSlots {
  /** nav.topbar. */
  readonly bar: HTMLElement;
  /** div.bar-tools. */
  readonly tools: HTMLElement;
  /** div.running-head. */
  readonly running: HTMLElement;
  /** div.doc-progress. */
  readonly progress: HTMLElement;
  /** a.skip-link, or null when the root holds no document. */
  readonly skip: HTMLAnchorElement | null;
  /** Put `node` (new chrome) in the tray at `kind`'s place. Throws for an unknown kind or a second tool of one. */
  tool(kind: ToolKind, node: HTMLElement): void;
}

export interface BarArgs {
  readonly root: HTMLElement;
  readonly journal: Journal;
  /** ResolvedInfo.isDocument: a skip link only for a document. */
  readonly isDocument: boolean;
}

/** The skeleton of one instance, unattached, and how to attach it once every feature is built. */
export function createBar(args: BarArgs): { readonly slots: BarSlots; attach(): void } {
  const { root, journal, isDocument } = args;
  const doc = root.ownerDocument;
  const running = chrome(doc, 'div', { className: 'running-head', attrs: { 'aria-hidden': 'true' } });
  const tools = chrome(doc, 'div', { className: 'bar-tools' });
  const bar = chrome(doc, 'nav', { className: 'topbar' }, [chrome(doc, 'div', { className: 'topbar-inner' }, [running, tools])]);
  const progress = chrome(doc, 'div', { className: 'doc-progress' });
  const skip = isDocument ? chrome(doc, 'a', { className: 'skip-link', text: 'Skip to the text', attrs: { href: '#' } }) : null;
  if (skip !== null) {
    journal.listen(skip, 'click', (e) => {
      e.preventDefault();
      let to: HTMLElement = root;
      for (const c of Array.from(root.children) as HTMLElement[]) {
        if (c.hasAttribute(CHROME_ATTR)) continue;
        to = c;
        break;
      }
      if (!focusable(to)) journal.setAttribute(to, 'tabindex', '-1');
      if (typeof to.scrollIntoView === 'function') to.scrollIntoView({ block: 'start' });
      to.focus({ preventScroll: true });
    });
  }
  const placed = new Map<ToolKind, HTMLElement>();
  const slots: BarSlots = Object.freeze({
    bar,
    tools,
    running,
    progress,
    skip,
    tool(kind: ToolKind, node: HTMLElement): void {
      const rank = TOOL_ORDER.indexOf(kind);
      if (rank < 0) throw new Error(`docreader: a bar tool is one of ${TOOL_ORDER.join(', ')}`);
      if (placed.has(kind)) throw new Error(`docreader: the bar holds one ${kind} tool`);
      let before: HTMLElement | null = null;
      for (const later of TOOL_ORDER.slice(rank + 1)) {
        before = placed.get(later) ?? null;
        if (before !== null) break;
      }
      journal.insert(node, tools, before);
      placed.set(kind, node);
    },
  });
  return Object.freeze({
    slots,
    attach(): void {
      const first = root.firstChild;
      if (skip !== null) journal.insert(skip, root, first);
      journal.insert(bar, root, first);
      journal.insert(progress, root, first);
    },
  });
}
