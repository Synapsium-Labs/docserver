// Navigation and the reading position's seam (docserver L2, Task 7b; Task 14 completes both), from the reference
// layout's sections 18 and 27.
//
//   nav.byId(id)       the element a link `#id` goes to: an element of the document with that id, else the target of
//                      the ID `id` in the index (LD6: rows and rules carry no id). The document's ids are read once,
//                      by a walk when the instance starts (before any chrome exists, so no chrome id, and no id that
//                      Mermaid or a clone writes later, is ever an answer); the first element in document order holds
//                      an id, as an id lookup would answer. A document id wins over a defined ID of the same text. The
//                      ids are Map keys, so `__proto__` or `toString` is never a lookup of the language's (RF1).
//   nav.idOf(el)       the id a link to `el` names: its own document id, else the ID it defines, else null.
//   nav.goTo(el, how)  go to `el` (default push true, focus true): reveal it (reveal.ts), hold the bar
//                      (position.holdBar), scroll it into view (smoothly unless the reader asked for reduced motion or
//                      it is more than two screens away; a browser without scrollIntoView skips it), focus it (with a
//                      journaled tabindex="-1" when it takes no focus of its own), then tell the host
//                      (`onHash(idOf(el), { push, from })`, LD7) when it has an id. `from` is null here: the position
//                      token for the place being left is Task 14's, as are the flash and the pin.
//   one click listener on the root, delegated, for the document's links and the chrome's:
//                      - a link whose href starts with `#` (a plain click with the main button) goes to its target,
//                        through goTo with push true, when byId finds one; otherwise, or with a modifier key, it is
//                        left to the browser;
//                      - any other link, when the host gave onLink (`host.present`): the default is prevented and the
//                        host gets the href as written, and newTab true for a click with Ctrl, Cmd or Shift (C47);
//                        without onLink the browser follows it.
//                      A click whose default is already prevented (a feature's own handler on the link, which runs
//                      first) is left alone, so a feature closes its own overlay or routes its own links there.
//   position.keep(fn)  run `fn`, keeping the reader's place across what it changes; here it only runs `fn` and
//                      answers its result (Task 14 anchors before and restores after). Relayout runs inside it.
//   position.holdBar() keep the phone bar shown for BAR_HOLD_MS (a jump just moved the page); position.barHeld()
//                      says whether that hold is still on (scroll.ts reads it).
//
// Import-inert: declarations only.
import type { Env } from './env.js';
import type { Host } from './host.js';
import type { Journal } from './journal.js';
import type { IdIndex } from './registry.js';

/** How long a jump keeps the phone bar shown, in milliseconds (the reference's). */
export const BAR_HOLD_MS = 1600;

export interface GoToHow {
  /** A new entry in the host's history (true), or a replaced one (false). Default true. */
  readonly push?: boolean;
  /** Move the focus to the target. Default true. */
  readonly focus?: boolean;
}

export interface Nav {
  byId(id: string): Element | null;
  idOf(el: Element): string | null;
  goTo(el: Element, how?: GoToHow): void;
}

export interface Position {
  /** Run `fn`, keeping the reader's place across what it changes; answers what `fn` answers. */
  keep<T>(fn: () => T): T;
  /** Keep the bar shown for BAR_HOLD_MS. */
  holdBar(): void;
  /** Whether the bar is held now. */
  barHeld(): boolean;
}

/** The position seam of one instance. */
export function createPosition(env: Env): Position {
  let heldUntil = 0;
  return Object.freeze({
    keep: <T>(fn: () => T): T => fn(),
    holdBar: (): void => {
      heldUntil = env.now() + BAR_HOLD_MS;
    },
    barHeld: (): boolean => env.now() < heldUntil,
  });
}

export interface NavArgs {
  readonly root: HTMLElement;
  readonly journal: Journal;
  readonly host: Host;
  readonly env: Env;
  readonly index: IdIndex;
  readonly reveal: (el: Element) => void;
  readonly position: Position;
  readonly live: () => boolean;
}

/** `href` after its `#`, decoded; as written when it does not decode. */
function hashId(href: string): string {
  const raw = href.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** True for an element that takes focus without a tabindex of the library's. */
function focusable(el: Element): boolean {
  return el.matches('a[href], button, input, select, textarea, [tabindex]');
}

/** Navigation for one instance: reads the document's ids now, and listens for clicks on the root. */
export function createNav(args: NavArgs): Nav {
  const { root, journal, host, env, index, reveal, position, live } = args;
  /** The document's ids, read once, before any chrome exists: the first element with each. */
  const ids = new Map<string, Element>();
  for (const el of Array.from(root.querySelectorAll('[id]'))) {
    if (!ids.has(el.id)) ids.set(el.id, el);
  }

  const byId = (id: string): Element | null => {
    if (typeof id !== 'string' || id === '') return null;
    const el = ids.get(id);
    if (el !== undefined && root.contains(el)) return el;
    const entry = index.get(id);
    return entry !== undefined && root.contains(entry.target) ? entry.target : null;
  };

  const idOf = (el: Element): string | null => {
    if (el.id !== '' && ids.get(el.id) === el) return el.id;
    return index.of(el)?.id ?? null;
  };

  const goTo = (el: Element, how: GoToHow = {}): void => {
    if (!live() || !root.contains(el)) return;
    const push = how.push ?? true;
    const focus = how.focus ?? true;
    reveal(el);
    if (!live()) return; // a revealer may call the host, which may destroy
    position.holdBar();
    const target = el as HTMLElement;
    if (typeof target.scrollIntoView === 'function') {
      const far = Math.abs(target.getBoundingClientRect().top) > env.viewport().h * 2;
      target.scrollIntoView({ block: 'start', behavior: env.reducedMotion() || far ? 'auto' : 'smooth' });
    }
    if (focus && typeof target.focus === 'function') {
      if (!focusable(el)) journal.setAttribute(el, 'tabindex', '-1');
      target.focus({ preventScroll: true });
    }
    const id = idOf(el);
    if (id !== null) host.onHash(id, { push, from: null });
  };

  journal.listen(root, 'click', (event) => {
    const e = event as MouseEvent;
    if (e.defaultPrevented || e.button !== 0) return;
    const t = e.target as Node | null;
    const from = t !== null && t.nodeType === 1 ? (t as Element) : (t?.parentElement ?? null);
    const a = from?.closest('a[href]') ?? null;
    if (a === null || !root.contains(a)) return;
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith('#')) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const target = byId(hashId(href));
      if (target === null) return;
      e.preventDefault();
      goTo(target, { push: true });
      return;
    }
    if (!host.present.has('onLink')) return;
    e.preventDefault();
    host.onLink(href, { newTab: e.ctrlKey || e.metaKey || e.shiftKey });
  });

  return Object.freeze({ byId, idOf, goTo });
}
