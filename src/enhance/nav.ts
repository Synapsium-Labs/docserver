// Navigation and the reading position's seam (docserver L2, Task 7b; completed by Task 14), from the reference
// layout's sections 18 and 27.
//
//   nav.byId(id)       the element a link `#id` goes to: an element of the document with that id, else the target of
//                      the ID `id` in the index (LD6: rows and rules carry no id). The document's ids are read once,
//                      by a walk when the instance starts (before any chrome exists, so no chrome id, and no id that
//                      Mermaid or a clone writes later, is ever an answer); the first element in document order holds
//                      an id, as an id lookup would answer. A document id wins over a defined ID of the same text. The
//                      ids are Map keys, so `__proto__` or `toString` is never a lookup of the language's (RF1).
//   nav.idOf(el)       the id a link to `el` names: its own document id, else the ID it defines, else null.
//   nav.goTo(el, how)  go to `el` (push, focus and flash default true): note the place being left (the `from` token,
//                      below), reveal `el` (reveal.ts), hold the bar (position.holdBar), bring it to the top of the
//                      reading area (smoothly unless the reader asked for reduced motion or it is more than two
//                      screens away; a jump made at once is pinned, below), flash it, focus it (with a journaled
//                      tabindex="-1" when it takes no focus of its own), then tell the host
//                      (`onHash(idOf(el), { push, from })`, LD7) when it has an id.
//   nav.goToHash(id, from)  the host's history moved to an entry of this document (the export goToHash, routed by the
//                      lifecycle): with a `from` token this instance gave, back to that place; otherwise to `id`
//                      (revealed, brought to the top at once and flashed, but not focused, as the reference's popstate
//                      did), or to the top for no id. It calls no onHash: the host's history has moved already.
//   one click listener on the root, delegated, for the document's links and the chrome's:
//                      - a link whose href starts with `#`, clicked with the main button and no modifier, goes to its
//                        target through goTo with push true, when byId finds one;
//                      - any other link (another document, an outside address, a hash link clicked with a modifier, and
//                        a hash link this root cannot resolve), when the host gave onLink (`host.present`): the default
//                        is prevented and the host gets the href as written, and newTab true for a click with Ctrl,
//                        Cmd or Shift; without onLink the browser follows it, as the reference left it.
//                      A click whose default is already prevented (a feature's own handler on the link, which runs
//                      first) is left alone, so a feature closes its own overlay or routes its own links there.
//
// Where a target goes (the reference's scrollIntoView with the stylesheet's scroll margins): an element with an id is
// scrolled into view by the browser, which applies the stylesheet's `[id]` (and `tr[id]`) scroll margin. A target with
// no id (a row or a rule, LD6) gets the margin it would have with one, computed here, and the window is scrolled
// (env.scrollTo): the `[id]` margin (`--bar-h` + ID_GAP), as the browser resolves it on the document's first heading
// (whatever unit the host gave `--bar-h`); for a table row, the bar's height that margin implies (never below 0) plus
// the table head's height (`--thead-h`, HEAD_GAP when unset), as `tr[id]`'s margin is. With no heading, the bar's height
// is `--bar-h` read as a length in px (0 when it is not one).
//
// The position seam (`ctx.position`, for every feature):
//   position.keep(fn)  run `fn`, keeping the reader's place across what it changes: the block at the reading line
//                      is anchored before (`anchor()`, below) and brought back to the same offset after; at the top of
//                      the page (nothing above can move) nothing is anchored; while a pin holds, the pin is applied
//                      after instead; and for SMOOTH_MS after a smooth jump began nothing is anchored or restored,
//                      since a scroll made then would stop it halfway. A keep inside a keep only runs `fn`. Relayout
//                      runs inside it.
//   position.holdBar() keep the phone bar shown for BAR_HOLD_MS (a jump just moved the page); position.barHeld()
//                      says whether that hold is still on (scroll.ts reads it).
// And, for the reading position (position.ts) and goToHash, through placeOf(ctx.position):
//   anchor()           the reader's place: the first block hit at the reading line (the bar's bottom plus 12 px, then
//                      every 24 px down to 240 px, a third into the reading column, at most 240 px in): an element the
//                      document had when the instance started that carries a `data-line`, or one with a document id,
//                      as { line: its data-line or its id, offset: its top in the viewport, y: the scroll position };
//                      { line: null, offset: 0, y } when no block is hit; null when none is hit at the very top.
//   restore(a)         back to an anchor: its block at the same offset when the block is shown, else the scroll
//                      position `y`. At once.
//   pin(apply)         apply now, and again after every relayout (keep) and whenever the root's size changes, until
//                      the reader acts (a wheel, a touch, a key or a pointer press anywhere in the document), another
//                      pin or jump replaces it, PIN_MS pass, or the instance is destroyed: while blocks above the
//                      target are measured, drawn or loaded, the reader stays on it (the reference held its pin until
//                      the page was ready, which this library has no gate for: LD5).
//   barBottom()        the bottom of the bar in the viewport (0 without the bar, or with it hidden: `bar-hidden`).
//   reach(el, smooth)  bring `el` to the top of the reading area, as goTo does (no pin, no flash, no focus).
// A `from` token is an anchor as JSON text: `{ "line", "offset", "y" }`. It is opaque to the host, and checked like a
// stored position (checkAnchor) when it comes back: an object with `line` null, a data-line (`12` or `12-14`) or an
// id of letters, digits, `_` and `-` (never a selector character) of at most TOKEN.line code units; `offset` and `y`
// finite, within TOKEN.coord, `y` not negative. The token itself is at most TOKEN.from code units. Anything else is no
// token.
//
// Import-inert: declarations only.
import type { Cancel, Env } from './env.js';
import type { Host } from './host.js';
import type { Journal } from './journal.js';
import type { IdIndex } from './registry.js';

/** How long a jump keeps the phone bar shown, in milliseconds (the reference's). */
export const BAR_HOLD_MS = 1600;

/** How long the flash class stays on a target, in milliseconds (the reference's; its animation takes 1.8 s). */
export const FLASH_MS = 1900;

/** The longest a pin holds, in milliseconds: as long as the reader's faces are waited for (relayout.ts). */
export const PIN_MS = 10_000;

/** How long a smooth jump is left to finish, in milliseconds: keep() restores no place meanwhile, which would stop it. */
export const SMOOTH_MS = 1000;

/** The stylesheet's gap between the bar and a target with an id: `[id] { scroll-margin-top: calc(var(--bar-h) + 14px) }`. */
export const ID_GAP = 14;

/** The table head's height a row's margin counts when `--thead-h` is unset: `tr[id]`'s `var(--thead-h, 40px)`. */
export const HEAD_GAP = 40;

/** The events that end a pin: the reader acting (the reference's). */
export const PIN_RELEASE = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

/** The bounds of a position token: its `line`, its text, and `offset` and `y`. */
export const TOKEN = { line: 1024, from: 4096, coord: 10_000_000 } as const;

/** How many of the document's first blocks the reading column is looked for in (a hidden meta line or front matter comes first). */
const COLUMN_SCAN = 16;

/** A block's source lines, as render() writes data-line. */
const LINE = /^\d{1,9}(?:-\d{1,9})?$/;

/** An id a token may name: render()'s heading and anchor alphabet, so never a selector character. */
const ID_SHAPE = /^[\p{L}\p{N}_-]+$/u;

/** The reader's place: a block's data-line or id, its top in the viewport, and the scroll position. */
export interface Anchor {
  readonly line: string | null;
  readonly offset: number;
  readonly y: number;
}

/** A stored position or a token's parse, checked (see the header): the anchor, or null for anything else. */
export function checkAnchor(v: unknown): Anchor | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  if (!Object.hasOwn(r, 'line') || !Object.hasOwn(r, 'offset') || !Object.hasOwn(r, 'y')) return null;
  const { line, offset, y } = r;
  if (line !== null && !(typeof line === 'string' && line.length <= TOKEN.line && (LINE.test(line) || ID_SHAPE.test(line)))) return null;
  if (typeof offset !== 'number' || !Number.isFinite(offset) || Math.abs(offset) > TOKEN.coord) return null;
  if (typeof y !== 'number' || !Number.isFinite(y) || y < 0 || y > TOKEN.coord) return null;
  return Object.freeze({ line, offset, y });
}

/** An anchor as a token's text; null for none. */
export function tokenOf(a: Anchor | null): string | null {
  return a === null ? null : JSON.stringify({ line: a.line, offset: a.offset, y: a.y });
}

/** A token's anchor: null for anything that is not a token this library writes. */
export function parseToken(text: unknown): Anchor | null {
  if (typeof text !== 'string' || text.length > TOKEN.from) return null;
  try {
    return checkAnchor(JSON.parse(text));
  } catch {
    return null;
  }
}

export interface GoToHow {
  /** A new entry in the host's history (true), or a replaced one (false). Default true. */
  readonly push?: boolean;
  /** Move the focus to the target. Default true. */
  readonly focus?: boolean;
  /** Flash the target. Default true. */
  readonly flash?: boolean;
}

export interface Nav {
  byId(id: string): Element | null;
  idOf(el: Element): string | null;
  goTo(el: Element, how?: GoToHow): void;
  /** The host's history moved here: back to `from`'s place, else to `id`, else (null) to the top. */
  goToHash(id: string | null, from: string | null): void;
}

export interface Position {
  /** Run `fn`, keeping the reader's place across what it changes; answers what `fn` answers. */
  keep<T>(fn: () => T): T;
  /** Keep the bar shown for BAR_HOLD_MS. */
  holdBar(): void;
  /** Whether the bar is held now. */
  barHeld(): boolean;
}

/** The reading position's own calls (see the header), for position.ts and goToHash. */
export interface Place {
  anchor(): Anchor | null;
  restore(a: Anchor): void;
  pin(apply: () => void): void;
  barBottom(): number;
  reach(el: Element, smooth: boolean): void;
}

/** Each instance's place, by its position seam. */
let places: WeakMap<Position, Place> | undefined;

/** The place of an instance, by its `ctx.position`. Throws for a position createNavigation did not make. */
export function placeOf(position: Position): Place {
  const place = places?.get(position);
  if (place === undefined) throw new Error('docreader: placeOf takes the position of an instance');
  return place;
}

export interface NavArgs {
  readonly root: HTMLElement;
  readonly journal: Journal;
  readonly host: Host;
  readonly env: Env;
  readonly index: IdIndex;
  readonly reveal: (el: Element) => void;
  readonly live: () => boolean;
  readonly operate: <T>(fn: () => T) => T | undefined;
  /** The bar (`slots.bar`), or null without chrome.bar. */
  readonly bar: HTMLElement | null;
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

/** True for an element that takes focus without a tabindex of the library's (the skip link uses it too, bar.ts). */
export function focusable(el: Element): boolean {
  return el.matches('a[href], button, input, select, textarea, [tabindex]');
}

/** A computed length in px (`12px`, `-3.5px`, `0`), or null for anything else. */
function px(value: string): number | null {
  if (value === '0') return 0;
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(value);
  return m === null ? null : Number(m[1]);
}

/** Navigation and the position seam of one instance: reads the document's ids and lines now, and listens for clicks on the root. */
export function createNavigation(args: NavArgs): { readonly nav: Nav; readonly position: Position } {
  const { root, journal, host, env, index, reveal, live, operate, bar } = args;
  const doc = root.ownerDocument;
  /** The document's ids and its blocks' lines, read once, before any chrome exists: the first element with each. */
  const ids = new Map<string, Element>();
  const lines = new Map<string, Element>();
  for (const el of Array.from(root.querySelectorAll('[id], [data-line]'))) {
    if (el.hasAttribute('id') && !ids.has(el.id)) ids.set(el.id, el);
    const line = el.getAttribute('data-line');
    if (line !== null && LINE.test(line) && !lines.has(line)) lines.set(line, el);
  }

  const byId = (id: string): Element | null => {
    if (id === '') return null;
    const el = ids.get(id);
    if (el !== undefined && root.contains(el)) return el;
    const entry = index.get(id);
    return entry !== undefined && root.contains(entry.target) ? entry.target : null;
  };

  /** `el`'s own id, when it is the document's element of that id. */
  const docId = (el: Element): string | null => (el.id !== '' && ids.get(el.id) === el ? el.id : null);

  const idOf = (el: Element): string | null => docId(el) ?? index.of(el)?.id ?? null;

  // ── the bar's hold
  let heldUntil = 0;
  const holdBar = (): void => {
    heldUntil = env.now() + BAR_HOLD_MS;
  };

  const barBottom = (): number => {
    if (bar === null || !root.contains(bar) || root.classList.contains('bar-hidden')) return 0;
    return Math.max(0, bar.getBoundingClientRect().bottom);
  };

  // ── where a target goes
  /** The scroll margin of a target with no id, as the stylesheet would give it one (see the header). */
  const marginOf = (el: Element): number => {
    /** The `[id]` margin, as the stylesheet resolves it on the document's first heading. */
    let idMargin: number | null = null;
    for (const [, h] of ids) {
      if (!/^h[1-6]$/.test(h.localName) || !root.contains(h)) continue;
      idMargin = px(env.computed(h, 'scroll-margin-top'));
      break;
    }
    const barH = idMargin === null ? (px(env.computed(root, '--bar-h')) ?? 0) : Math.max(0, idMargin - ID_GAP);
    if (el.localName === 'tr') return barH + (px(env.computed(el, '--thead-h')) ?? HEAD_GAP);
    return idMargin ?? barH + ID_GAP;
  };

  const reach = (el: Element, smooth: boolean): void => {
    if (!live() || !root.contains(el)) return;
    const target = el as HTMLElement;
    if (el.hasAttribute('id')) {
      // The stylesheet's [id] margin applies; a browser without scrollIntoView skips it.
      if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
      return;
    }
    env.scrollTo(el.getBoundingClientRect().top + env.viewport().scrollY - marginOf(el), smooth);
  };

  // ── the reader's place
  /** The block a hit lies in: the nearest element from it up that the document had with a data-line or an id. */
  const blockAt = (hit: Element | null): { readonly el: Element; readonly line: string } | null => {
    for (let n = hit; n !== null && n !== root; n = n.parentElement) {
      const line = n.getAttribute('data-line');
      if (line !== null && lines.get(line) === n) return { el: n, line };
      const id = docId(n);
      if (id !== null && id.length <= TOKEN.line && ID_SHAPE.test(id)) return { el: n, line: id };
    }
    return null;
  };

  /**
   * Where the reading line is read across: a third into the reading column, at most 240 px in (the reference's, whose
   * root was its column). The root owns a wider box (C43), so the column is the first of the document's blocks that
   * has a box (of the first COLUMN_SCAN), else the root.
   */
  const readingX = (w: number): number => {
    let r: DOMRect | null = null;
    let seen = 0;
    for (const [, b] of lines) {
      if (seen >= COLUMN_SCAN) break;
      seen += 1;
      if (!root.contains(b)) continue;
      const box = b.getBoundingClientRect();
      if (box.width > 0) {
        r = box;
        break;
      }
    }
    r ??= root.getBoundingClientRect();
    return Math.min(w - 4, Math.max(4, r.left + Math.min(240, r.width / 3)));
  };

  const anchor = (): Anchor | null => {
    const { w, scrollY } = env.viewport();
    const top = barBottom() + 12;
    const x = readingX(w);
    for (let dy = 0; dy < 240; dy += 24) {
      const b = blockAt(env.elementFromPoint(x, top + dy));
      if (b !== null) return Object.freeze({ line: b.line, offset: b.el.getBoundingClientRect().top, y: scrollY });
    }
    return scrollY > 0 ? Object.freeze({ line: null, offset: 0, y: scrollY }) : null;
  };

  /** Whether `el` is shown: nothing up to the root hides it, and in a laid-out page it has a box. */
  const shown = (el: Element): boolean => {
    for (let n: Element | null = el; n !== null && n !== root; n = n.parentElement) if (n.hasAttribute('hidden')) return false;
    return el.getClientRects().length > 0 || root.getClientRects().length === 0;
  };

  /** The block an anchor names: by its line, else by an id (the document's, or a defined ID). */
  const blockOf = (line: string): Element | null => {
    const el = LINE.test(line) ? lines.get(line) : undefined;
    if (el !== undefined && root.contains(el)) return el;
    return byId(line);
  };

  const restore = (a: Anchor): void => {
    const el = a.line === null ? null : blockOf(a.line);
    if (el !== null && shown(el)) env.scrollTo(el.getBoundingClientRect().top + env.viewport().scrollY - a.offset);
    else env.scrollTo(a.y);
  };

  // ── the pin, and a smooth jump under way
  let pinned: (() => void) | null = null;
  /** Until when a smooth jump is left to finish (env.now()); a pin ends it. */
  let smoothUntil = 0;
  /** What ends the pin that holds: its listeners, its timer, its observer. */
  const ends: Cancel[] = [];
  const release = (): void => {
    pinned = null;
    for (const end of ends.splice(0)) end();
  };
  journal.defer(release);
  const hold = (): void => {
    const apply = pinned;
    if (apply === null || !live()) return;
    try {
      apply();
    } catch {
      release();
    }
  };
  /** The reader acting ends the pin; heard in the capture phase, before any handler of the page. */
  const onAct = (): void => {
    operate(release);
  };
  const pin = (apply: () => void): void => {
    release();
    if (!live()) return;
    smoothUntil = 0;
    pinned = apply;
    for (const type of PIN_RELEASE) doc.addEventListener(type, onAct, { capture: true, passive: true });
    ends.push(() => {
      for (const type of PIN_RELEASE) doc.removeEventListener(type, onAct, { capture: true });
    });
    ends.push(env.timeout(release, PIN_MS));
    const watch = env.observeResize(hold);
    if (watch !== null) {
      watch.observe(root);
      ends.push(watch.cancel);
    }
    hold();
  };

  // ── keep
  let keeping = 0;
  const keep = <T>(fn: () => T): T => {
    if (keeping > 0) return fn();
    const at = pinned !== null || env.now() < smoothUntil || env.viewport().scrollY < 1 ? null : anchor();
    keeping += 1;
    try {
      return fn();
    } finally {
      keeping -= 1;
      if (pinned !== null) hold();
      else if (at !== null && live()) restore(at);
    }
  };

  // ── the flash
  const flashes = new WeakMap<Element, Cancel>();
  const flash = (el: Element): void => {
    flashes.get(el)?.();
    journal.toggleClass(el, 'flash', false);
    void (el as HTMLElement).offsetWidth; // a style recalc between the two, so the animation starts again
    journal.toggleClass(el, 'flash', true);
    flashes.set(
      el,
      env.timeout(() => {
        journal.toggleClass(el, 'flash', false);
      }, FLASH_MS),
    );
  };

  /** Bring `el` to the top: smoothly, or at once and pinned there. */
  const jump = (el: Element, smooth: boolean): void => {
    if (smooth) {
      release();
      smoothUntil = env.now() + SMOOTH_MS;
      reach(el, true);
    } else {
      pin(() => {
        reach(el, false);
      });
    }
  };

  const goTo = (el: Element, how: GoToHow = {}): void => {
    if (!root.contains(el)) return;
    const push = how.push ?? true;
    const focus = how.focus ?? true;
    const id = idOf(el);
    // The place being left, measured before anything moves; only for a host that hears it.
    const from = id !== null && host.present.has('onHash') ? tokenOf(anchor()) : null;
    reveal(el); // does nothing once the instance is not live
    if (!live()) return; // destroyed before, or by a revealer (which may call the host)
    holdBar();
    const far = Math.abs(el.getBoundingClientRect().top) > env.viewport().h * 2;
    jump(el, !(env.reducedMotion() || far));
    if (how.flash ?? true) flash(el);
    if (focus) {
      if (!focusable(el)) journal.setAttribute(el, 'tabindex', '-1');
      (el as HTMLElement).focus({ preventScroll: true });
    }
    if (id !== null) host.onHash(id, { push, from });
  };

  const goToHash = (id: string | null, from: string | null): void => {
    if (!live()) return;
    const back = parseToken(from);
    if (back !== null) {
      holdBar();
      pin(() => {
        restore(back);
      });
      return;
    }
    if (id === null || id === '') {
      release();
      smoothUntil = 0;
      env.scrollTo(0);
      return;
    }
    const target = byId(id);
    if (target === null) return;
    reveal(target);
    if (!live()) return;
    holdBar();
    jump(target, false);
    flash(target);
  };

  journal.listen(root, 'click', (event) => {
    const e = event as MouseEvent;
    if (e.defaultPrevented || e.button !== 0) return;
    const a = (e.target as Element).closest('a[href]');
    if (a === null || !root.contains(a)) return;
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith('#') && !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) {
      const target = byId(hashId(href));
      if (target !== null) {
        e.preventDefault();
        goTo(target, { push: true });
        return;
      }
    }
    if (!host.present.has('onLink')) return;
    e.preventDefault();
    host.onLink(href, { newTab: e.ctrlKey || e.metaKey || e.shiftKey });
  });

  const position: Position = Object.freeze({
    keep,
    holdBar,
    barHeld: (): boolean => env.now() < heldUntil,
  });
  (places ??= new WeakMap()).set(position, Object.freeze({ anchor, restore, pin, barBottom, reach }));
  return Object.freeze({ nav: Object.freeze({ byId, idOf, goTo, goToHash }), position });
}
