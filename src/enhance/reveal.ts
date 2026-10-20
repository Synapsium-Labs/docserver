// Reveal (docserver L2, Task 7b): show an element whatever hides it, from the reference layout's section 18 (its
// reveal). Navigation calls it before it scrolls (nav.goTo), and so do the features that step through the document.
//
//   reveal(el)     first opens every closed `<details>` between `el` and the root (the author's, and a chrome one such
//                  as the facts panel), each through the journal (destroy closes it again, unless the reader has
//                  toggled it since); then runs every revealer, in the order they registered; then emits 'reveal'.
//                  It stops once the instance is not live (a revealer that writes state may call the host's set(),
//                  which may destroy it). `el` outside the root does nothing.
//   onReveal(fn)   register a revealer: `fn(el)` undoes whatever its feature hides that holds `el` (folds.ts unfolds
//                  the section; later, the outline opens a task, the table filter clears, the lens opens its detail).
//                  Its cancel removes it. Each revealer acts only on its own hiding, so their order does not matter.
//
// Import-inert: declarations only.
import type { Cancel } from './env.js';
import type { Journal } from './journal.js';
import type { Events } from './registry.js';

export interface Reveal {
  reveal(el: Element): void;
  onReveal(fn: (el: Element) => void): Cancel;
}

export interface RevealArgs {
  readonly root: HTMLElement;
  readonly journal: Journal;
  readonly events: Events;
  readonly live: () => boolean;
}

/** Reveal for one instance. */
export function createReveal(args: RevealArgs): Reveal {
  const { root, journal, events, live } = args;
  const revealers: ((el: Element) => void)[] = [];
  return Object.freeze({
    reveal(el: Element): void {
      if (!live() || el === root || !root.contains(el)) return;
      for (let n: Element | null = el; n !== null && n !== root; n = n.parentElement) {
        if (n.localName === 'details' && !n.hasAttribute('open')) journal.setAttribute(n, 'open', '');
      }
      for (const fn of [...revealers]) {
        fn(el);
        if (!live()) return;
      }
      events.emit('reveal', { target: el });
    },
    onReveal(fn: (el: Element) => void): Cancel {
      if (typeof fn !== 'function') throw new Error('docreader: onReveal takes a function');
      revealers.push(fn);
      return () => {
        const at = revealers.indexOf(fn);
        if (at >= 0) revealers.splice(at, 1);
      };
    },
  });
}
