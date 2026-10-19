// The editorial core: the reference reader's sections 0 to 6 (the document check and reading time, the front
// matter, the title block with its eyebrow and byline, the facts panel, the "In short" and "Where things stand"
// boxes, and the hanging section numbers).
//
// STUB. Today it only sets the root marker that scopes the stylesheet, `data-docreader-root`; the next task fills
// in the rest here. The lifecycle calls buildEditorial once, during startup, inside the startup operation, after
// the prefs are on the root and before folds are built, so folds see the editorial core's wrappers.
//
// What it receives (FeatureContext, types.ts):
//   root       the element enhance() was given. Write inside it only; walk it, and never look an element up by a
//              document id (ids may collide).
//   journal    every DOM write: setAttribute, toggleClass, insert (new chrome), wrap (moves source nodes into a new
//              chrome wrapper; pass adjacent siblings, text nodes included, so undo restores them in place), listen,
//              defer. Destroy undoes them in reverse. Source nodes are only moved, never edited or re-created; make
//              chrome with chrome() from journal.ts, which marks it data-docreader-chrome.
//   state      prefs and per-document state (readDoc/writeDoc), written behind to the host's storage.
//   info       title (info.title or the first h1), frontList (render()'s meta.frontList or null), isDocument (the
//              document check, measured before anything moved).
//   options    the normalized options.
//   live()     false once a destroy was requested: check it after anything that can call out (a host callback,
//              a storage read or write, a dispatched event) and stop when it is false.
//   operate()  run a function as an operation of the instance; handlers registered with journal.listen already do.
// A throw from here rolls the whole startup back and rejects enhance() with 'initialization' (or with the
// EnhanceError thrown).
import type { FeatureContext } from './types.js';

export function buildEditorial(ctx: FeatureContext): void {
  ctx.journal.setAttribute(ctx.root, 'data-docreader-root', '');
}
