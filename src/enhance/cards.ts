// Preview cards: what an ID mention, a glossary term or a diagram block names, shown in a card on hover, on focus or on
// a first tap, without going there (the reference layout, section 20). Built by L2 Task 17.
//
// Consumes ctx.index and ctx.terms (what a trigger names), the triggers xrefs.ts and glossary.ts made (`a.xref[data-ref]`
// and `a.term[data-term]`) and the diagram blocks Task 23 will make (`.dnode` with `data-ref` or `data-term`), ctx.nav
// (the card's link, and idOf for its href), ctx.overlays (the card is the overlay `card`, last in the Escape order),
// ctx.events ('reveal': going anywhere closes it), env (its timers, the scroll, the viewport, the clock, --bar-h) and
// journal.setStyle (`left`, `top`, `max-height`). Produces `.xcard`, a dialog in the root, with `.open` and `.is-term`,
// and the module export show(ctx, trigger) (`cards.show`, C49), for diagram blocks.
//
// The card. One per instance: a chrome `div.xcard` (role dialog, a chrome id from ctx.chromeId), made and put at the
// end of the root the first time a card shows (the reference put it at the end of the page; inside the root its fixed
// position is the viewport's unless an ancestor has a transform, a filter, a perspective or a containment, which makes
// that ancestor its frame). Its overlay is registered then too, and the card follows the scroll only while it shows: an instance
// whose reader never asks for a card issues no id, registers no overlay and hears no scroll. Its content is made anew
// for each trigger; the reference stylesheet's rules for `.xcard` lay it out. Showing it for a
// trigger sets the trigger's aria-expanded to "true" and its aria-controls to the card's id, and the card's aria-label to
// "<ID> preview" or "Definition: <name>"; hiding it sets aria-expanded back to "false". Every attribute, class and style
// write goes through the journal, so destroy removes the card and puts the triggers back.
//
// What a trigger names: `data-term` through ctx.terms.get (a term's key), else `data-ref` through ctx.index.get (an
// ID). A trigger names nothing, or sits in a block Play has not revealed yet (`.rv-hide`, Task 23), or is outside the
// root: no card.
// What the card shows (the reference's, from the entry, its target and its pill):
//   - a term: its name and its glossary's section ("Glossary" when it has none); each definition, its qualifier as a
//     label, then a copy of its meaning cell; "Go to definition →".
//   - an ID: the ID, its status words (the text of the target's own pill, C49: an ID row's last pill, a rule head's
//     first; never the index entry, which holds only the colour role) and its group; then
//       a row: each cell under its header, a copy of its content, the first cell left out when it is the ID alone;
//       a rule: a copy of its paragraph without its head (the IDs, the status and what the rule split off);
//       a section: its heading's text after its number, and a copy of the first paragraph after the heading, before the
//       next heading of level 1 to 3;
//       a figure: its caption (the reference had no figure entries);
//     and "Go to <ID> →".
//   The link's href is "#" and the id nav gives the target (nav.idOf: its document id, or the ID it defines), else the
//   id of the heading before it (a term's row: its glossary's section), as glossary.ts's links do. A plain click goes
//   to the target itself, through nav.goTo.
// A copy (cloneNode) never moves the document's nodes. It keeps no id, no form control (input, button, select,
// textarea) and none of render()'s `data-line` marks (so a later feature that finds blocks by their lines never finds
// one in the card); a link the layout made (`a.xref`, `a.term`) becomes its text; a fold's hidden="until-found" on a
// copied paragraph is dropped (its section may be folded); and every copied element is chrome.
//
// When it shows and hides (each delay a timer of env, so destroy cancels it):
//   - a mouse over a trigger shows its card after SHOW_DELAY_MS; leaving it before then shows nothing;
//   - a mouse leaving the trigger shown, or the card, hides it after HIDE_DELAY_MS, unless it goes into the card or
//     back to the trigger; over the card the hide is called off. Leaving another trigger leaves an open card alone. A
//     drag (a button held) that leaves a block in the full-screen figure (`.fig-overlay`, Task 23) keeps the card;
//   - focus on a trigger shows its card at once; focus moving anywhere but the card or its trigger hides it after
//     HIDE_DELAY_MS, unless it left for nothing after a press on the card (its text takes no focus); the focus back on
//     the trigger shown within the delay keeps it;
//   - a click on a trigger, captured on the root before any other listener (glossary.ts's own, nav's), by a pointer
//     other than a mouse: the first tap shows the card and goes nowhere; the next tap on it goes, as a click does. A
//     click's pointer is the last pointerdown's when that came within FRESH_MS and was not a mouse's, whatever the
//     click names (WebKit's click after a tap names 'mouse'); else the click's own pointerType, or the last
//     pointerdown's when it names none. A click with detail 0 (a key's, or a script's) is no tap: it goes. A focus
//     that comes within FRESH_MS of a touch's pointerdown (a tap that focuses the link first, as both engines do)
//     shows the card and leaves the next click a first tap still. A diagram block goes nowhere itself: any click
//     shows its card;
//   - Enter or Space on a diagram block shows its card and moves the focus to the card's last link; on a block that
//     shows no card, the key and the focus are left alone;
//   - Tab on the trigger shown moves into the card; in the card, Shift+Tab on its first stop goes back to the trigger,
//     and Tab on its last hides it and puts the focus back on the trigger, from where the browser moves on;
//   - Escape in the card hides it and puts the focus back on the trigger; Escape elsewhere reaches the card through
//     the keyboard layer (the overlay `card`, last in the Escape order, and no dialog: overlays.any() leaves it out),
//     whose close hides it and puts the focus back on the trigger when it was in the card. Focus put back on a trigger
//     never shows its card again;
//   - a pointer down anywhere in the page but the card and this root's triggers hides it, and so does going anywhere
//     (every nav.goTo reveals its target: the 'reveal' event); a click on a link in the card to a place in the page
//     hides it once the click is done;
//   - while it shows, the card follows its trigger on scroll, and hides once the trigger has left the window or the
//     document.
// Placement (the reference's): below the trigger when the card fits there or there is no less room there than above;
// else above, under the bar. The room below is the window's height less the trigger's bottom less ROOM; above, the
// trigger's top less the bar's height (--bar-h on the root, none while the root has `bar-hidden`) less ROOM. The card's
// max-height is its natural height, at most that room and at least MIN_HEIGHT; its left is the trigger's less LEAD,
// kept EDGE from each side of the window; its top GAP below the trigger, or GAP above it.
//
// show(ctx, trigger): show the card of `trigger` for the instance of `ctx` (its state is kept in a WeakMap keyed by the
// context, C49), inside an operation; for the trigger already shown it places the card again (a block that moved), and
// it calls off a pending hide. It answers true when the card shows for that trigger; false for a trigger outside the
// root, one that names nothing or sits in `.rv-hide`, one out of the window (the card hides at once), a context no
// instance made, and once the instance is not live.
//
// Standard files, slug `cards`: test/enhance-cards.test.ts, test/browser/cards.test.ts and conformance/layout/cards/.
// Registered in features.ts, whose header says where in the build order and why.
import type { Cancel } from './env.js';
import { headingText } from './headctl.js';
import { CHROME_ATTR, chrome } from './journal.js';
import type { IndexEntry, TermEntry } from './registry.js';
import type { FeatureContext } from './types.js';

/** How long a mouse rests on a trigger before its card shows, in milliseconds. */
export const SHOW_DELAY_MS = 250;

/** How long the card stays once the mouse or the focus has left it and its trigger. */
export const HIDE_DELAY_MS = 220;

/** A focus this soon after a touch's pointerdown is that tap's: its click still previews. */
export const FRESH_MS = 800;

/** The room kept below the card, or between the card and the bar, when the side is chosen. */
export const ROOM = 16;

/** The space between the trigger and the card. */
export const GAP = 8;

/** How far left of its trigger the card starts. */
export const LEAD = 16;

/** The least space between the card and either side of the window. */
export const EDGE = 12;

/** The least max-height the card takes, however little room there is. */
export const MIN_HEIGHT = 120;

/** What a trigger names. */
type Named = { readonly kind: 'term'; readonly term: TermEntry } | { readonly kind: 'id'; readonly entry: IndexEntry };

/** One instance's card, as show() reaches it. */
interface CardState {
  show(trigger: Element): boolean;
}

/** Each instance's card, by its context (C49). */
let states: WeakMap<FeatureContext, CardState> | undefined;

/**
 * Show the card of `trigger` (see the header): true when it shows for that trigger. Runs inside an operation of the
 * instance; does nothing once it is not live.
 */
export function show(ctx: FeatureContext, trigger: Element): boolean {
  const state = states?.get(ctx);
  if (state === undefined) return false;
  return ctx.operate(() => state.show(trigger)) === true;
}

/** A text with its white space runs as one space, trimmed. */
const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** An event target as an element: itself, the parent of a text, or null. */
function elementOf(t: EventTarget | null): Element | null {
  const n = t as Node | null;
  if (n === null) return null;
  if (n.nodeType === 1) return n as Element;
  return n.nodeType === 3 ? n.parentElement : null;
}

/** The text under `n`, white space as one space, leaving out hidden chrome (what the layout split off and hides). */
function shownText(n: Node): string {
  let out = '';
  const stack: Node[] = [n];
  while (stack.length > 0) {
    const x = stack.pop() as Node;
    if (x.nodeType === 3) {
      out += (x as Text).data;
      continue;
    }
    if (x.nodeType === 1 && (x as Element).hasAttribute(CHROME_ATTR) && (x as Element).hasAttribute('hidden')) continue;
    for (let c = x.lastChild; c !== null; c = c.previousSibling) stack.push(c);
  }
  return squash(out);
}

/**
 * Make what was copied into `box` fit for the card (see the header): the layout's links become their text, form
 * controls go, and no element keeps an id or a line mark; every element is chrome.
 */
function scrub(box: Element): void {
  for (const a of Array.from(box.querySelectorAll('a.xref, a.term'))) a.replaceWith(...Array.from(a.childNodes));
  for (const c of Array.from(box.querySelectorAll('input, button, select, textarea'))) c.remove();
  for (const el of Array.from(box.querySelectorAll('*'))) {
    el.removeAttribute('id');
    el.removeAttribute('data-line');
    // CHROME_ATTR's value, as a literal: the CSP wall allows a name in a variable only in journal.ts. The content
    // case reads CHROME_ATTR, so the two cannot drift apart unseen.
    el.setAttribute('data-docreader-chrome', '');
  }
}

/** A copy of `el` for the card: a fold's hidden is dropped from it (its section may be folded). */
function copyOf(el: Element): Element {
  const c = el.cloneNode(true) as Element;
  if (c.getAttribute('hidden') === 'until-found') c.removeAttribute('hidden');
  return c;
}

/** Copies of `el`'s children. */
const copiesOf = (el: Element): Node[] => Array.from(el.childNodes, (n) => n.cloneNode(true));

/** The id of the heading a block sits under: an h2 or h3 with an id, or a box's heading, before it or its ancestors'. */
function headingIdBefore(root: Element, node: Element): string {
  for (let n: Element | null = node; n !== null && n !== root; n = n.parentElement) {
    for (let p = n.previousElementSibling; p !== null; p = p.previousElementSibling) {
      if ((p.localName === 'h2' || p.localName === 'h3') && p.id !== '') return p.id;
      if (p.classList.contains('short') || p.classList.contains('callout')) {
        const h = p.querySelector('h2, h3');
        if (h !== null) return h.id;
      }
    }
  }
  return '';
}

/** The pill an entry's status words are read from: an ID row's last chrome pill, a rule head's first; else null. */
function pillOf(entry: IndexEntry): Element | null {
  if (entry.kind === 'row') {
    const pills = Array.from(entry.target.querySelectorAll('.pill')).filter((el) => el.hasAttribute(CHROME_ATTR));
    return pills[pills.length - 1] ?? null;
  }
  return entry.kind === 'rule' ? entry.target.querySelector(':scope > .rule-head > .pill') : null;
}

/** The card's content for an ID (see the header). */
function idCard(ctx: FeatureContext, entry: IndexEntry, href: string): HTMLElement[] {
  const doc = ctx.root.ownerDocument;
  const head = chrome(doc, 'div', { className: 'xc-head' }, [chrome(doc, 'span', { className: 'xc-id', text: entry.id })]);
  const pill = pillOf(entry);
  if (pill !== null) head.appendChild(chrome(doc, 'span', { className: entry.status === null ? 'pill' : `pill ${entry.status}`, text: squash(pill.textContent ?? '') }));
  head.appendChild(chrome(doc, 'span', { className: 'xc-src', text: entry.group }));
  const body = chrome(doc, 'div', { className: 'xc-body' });
  const target = entry.target;
  if (entry.kind === 'row') {
    Array.from((target as Partial<HTMLTableRowElement>).cells ?? []).forEach((cell, i) => {
      if (i === 0 && shownText(cell) === entry.id) return;
      const label = entry.heads[i];
      const row = chrome(doc, 'div', { className: 'xc-row' });
      if (label !== undefined && label !== '') row.appendChild(chrome(doc, 'span', { className: 'xc-k', text: label }));
      row.appendChild(chrome(doc, 'div', { className: 'xc-v' }, copiesOf(cell)));
      body.appendChild(row);
    });
  } else if (entry.kind === 'rule') {
    const p = copyOf(target);
    p.removeAttribute('class');
    for (const h of Array.from(p.children)) if (h.classList.contains('rule-head')) h.remove();
    body.appendChild(p);
  } else if (entry.kind === 'section') {
    // The heading's own text: its number and its controls are chrome.
    body.appendChild(chrome(doc, 'p', { className: 'xc-title', text: headingText(target, (el) => el.hasAttribute(CHROME_ATTR)) }));
    let n = target.nextElementSibling;
    while (n !== null && n.localName !== 'p' && !/^h[1-3]$/.test(n.localName)) n = n.nextElementSibling;
    if (n !== null && n.localName === 'p') body.appendChild(copyOf(n));
  } else {
    body.appendChild(chrome(doc, 'p', { className: 'xc-title', text: ctx.figures.of(target)?.caption ?? entry.title }));
  }
  scrub(body);
  const go = chrome(doc, 'a', { className: 'xc-go', text: `Go to ${entry.id} →`, attrs: { href } });
  return [head, body, chrome(doc, 'div', { className: 'xc-foot' }, [go])];
}

/** The card's content for a term (see the header). */
function termCard(ctx: FeatureContext, term: TermEntry, href: string): HTMLElement[] {
  const doc = ctx.root.ownerDocument;
  const head = chrome(doc, 'div', { className: 'xc-head' }, [
    chrome(doc, 'span', { className: 'xc-term', text: term.name }),
    chrome(doc, 'span', { className: 'xc-src', text: term.section === '' ? 'Glossary' : term.section }),
  ]);
  const body = chrome(doc, 'div', { className: 'xc-body' });
  for (const d of term.defs) {
    const def = chrome(doc, 'div', { className: 'xc-def' });
    if (d.qual !== '') def.appendChild(chrome(doc, 'span', { className: 'xc-k', text: d.qual }));
    def.append(...copiesOf(d.cell));
    body.appendChild(def);
  }
  scrub(body);
  const go = chrome(doc, 'a', { className: 'xc-go', text: 'Go to definition →', attrs: { href } });
  return [head, body, chrome(doc, 'div', { className: 'xc-foot' }, [go])];
}

/** Build this feature during startup: the triggers' listeners. The card, its id and its overlay come when it first shows. */
export function build(ctx: FeatureContext): void {
  const { root, journal, env, nav } = ctx;
  const doc = root.ownerDocument;
  /** The card, made the first time it shows. */
  let card: HTMLElement | null = null;
  /** The trigger whose card shows, or null. */
  let shown: Element | null = null;
  /** Where the card's link goes. */
  let goal: Element | null = null;
  let showTimer: Cancel | null = null;
  let hideTimer: Cancel | null = null;
  /** Following the scroll, while the card shows. */
  let following: Cancel | null = null;
  /** The last pointerdown's pointer, and when it came. */
  let lastPointer = 'mouse';
  let lastDown = 0;
  /** True when the last pointerdown in the root was on the card, until the card hides. */
  let pressedCard = false;
  /** A trigger being given the focus back: its focus shows nothing. */
  let quiet: Element | null = null;
  /** Triggers a tap focused: their next click still previews. */
  const fresh = new WeakSet<Element>();
  const stop = (c: Cancel | null): null => {
    c?.();
    return null;
  };
  /** True within FRESH_MS of a pointerdown that was not a mouse's: a tap is under way. */
  const tapping = (): boolean => lastPointer !== 'mouse' && env.now() - lastDown < FRESH_MS;

  /** The trigger at `t`: a link the layout made or a diagram block, in this root. */
  const triggerOf = (t: EventTarget | null): Element | null => {
    const el = elementOf(t);
    const a = el === null ? null : el.closest('a.xref, a.term, .dnode');
    return a !== null && root.contains(a) ? a : null;
  };

  /** True for an element in the card. */
  const inCard = (el: Element | null): boolean => card !== null && el !== null && card.contains(el);

  const named = (a: Element): Named | null => {
    const data = (a as HTMLElement).dataset;
    const term = data['term'];
    if (term !== undefined && term !== '') {
      const t = ctx.terms.get(term);
      return t === undefined ? null : { kind: 'term', term: t };
    }
    const ref = data['ref'];
    if (ref === undefined) return null;
    const e = ctx.index.get(ref);
    return e === undefined ? null : { kind: 'id', entry: e };
  };

  const barHeight = (): number => {
    if (root.classList.contains('bar-hidden')) return 0;
    const h = Number.parseFloat(env.computed(root, '--bar-h'));
    return Number.isFinite(h) ? h : 0;
  };

  const hide = (now: boolean): void => {
    showTimer = stop(showTimer);
    hideTimer = stop(hideTimer);
    const go = (): void => {
      if (shown === null || card === null) return;
      journal.setAttribute(shown, 'aria-expanded', 'false');
      shown = null;
      pressedCard = false;
      following = stop(following);
      journal.toggleClass(card, 'open', false);
    };
    if (now) go();
    else hideTimer = env.timeout(go, HIDE_DELAY_MS);
  };

  const place = (): void => {
    const a = shown;
    if (a === null || card === null) return;
    if (!root.contains(a)) {
      hide(true);
      return;
    }
    const r = a.getBoundingClientRect();
    const { w, h } = env.viewport();
    if (r.bottom < 0 || r.top > h) {
      hide(true);
      return;
    }
    const below = h - r.bottom - ROOM;
    const above = r.top - barHeight() - ROOM;
    journal.setStyle(card, 'max-height', null);
    const natural = card.offsetHeight;
    const down = natural <= below || below >= above;
    journal.setStyle(card, 'max-height', `${String(Math.max(MIN_HEIGHT, Math.min(natural, down ? below : above)))}px`);
    const x = Math.min(Math.max(EDGE, r.left - LEAD), w - card.offsetWidth - EDGE);
    const y = down ? r.bottom + GAP : r.top - card.offsetHeight - GAP;
    journal.setStyle(card, 'left', `${String(x)}px`);
    journal.setStyle(card, 'top', `${String(y)}px`);
  };

  /** Give `a` the focus back without showing its card again. */
  const quietFocus = (a: Element): void => {
    quiet = a;
    try {
      (a as HTMLElement).focus({ preventScroll: true });
    } finally {
      quiet = null;
    }
  };

  /** The card's stops for Tab: its links (a copy keeps no form control). */
  const stops = (): HTMLElement[] => (card === null ? [] : Array.from(card.querySelectorAll('a[href]')));

  /** The card, its keys, its clicks and its overlay: made once, the first time a card shows. */
  const makeCard = (): HTMLElement => {
    const el = chrome(doc, 'div', { className: 'xcard', attrs: { role: 'dialog', id: ctx.chromeId('card') } });
    journal.listen(el, 'keydown', (event) => {
      const e = event as KeyboardEvent;
      const a = shown;
      if (e.key === 'Escape') {
        e.preventDefault();
        hide(true);
        if (a !== null) quietFocus(a);
        return;
      }
      if (e.key !== 'Tab') return;
      const all = stops();
      const active = doc.activeElement;
      if (e.shiftKey && active === all[0]) {
        e.preventDefault();
        if (a !== null) (a as HTMLElement).focus();
      } else if (!e.shiftKey && active === all[all.length - 1]) {
        hide(true);
        if (a !== null) quietFocus(a); // the browser then moves on from the trigger
      }
    });
    journal.listen(el, 'click', (event) => {
      const e = event as MouseEvent;
      const t = elementOf(e.target);
      if (t === null) return;
      const go = t.closest('a.xc-go');
      if (go !== null && goal !== null && !e.defaultPrevented && e.button === 0 && !(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) {
        e.preventDefault();
        nav.goTo(goal, { push: true }); // going there reveals it, which hides the card ('reveal')
        return;
      }
      const link = t.closest('a[href]');
      if (link !== null && (link.getAttribute('href') ?? '').startsWith('#')) {
        env.timeout(() => {
          hide(true);
        }, 0);
      }
    });
    ctx.overlays.register('card', {
      isOpen: () => shown !== null,
      close: () => {
        const a = shown;
        const back = inCard(doc.activeElement);
        hide(true);
        if (a !== null && back) quietFocus(a);
      },
    });
    return el;
  };

  const showFor = (a: Element): boolean => {
    if (!root.contains(a)) return false;
    const what = named(a);
    if (what === null || a.closest('.rv-hide') !== null) return false;
    hideTimer = stop(hideTimer);
    if (a !== shown) {
      card ??= makeCard();
      if (shown !== null) journal.setAttribute(shown, 'aria-expanded', 'false');
      shown = a;
      goal = what.kind === 'term' ? what.term.target : what.entry.target;
      const href = `#${encodeURIComponent(nav.idOf(goal) ?? headingIdBefore(root, goal))}`;
      card.replaceChildren(...(what.kind === 'term' ? termCard(ctx, what.term, href) : idCard(ctx, what.entry, href)));
      journal.setAttribute(card, 'aria-label', what.kind === 'term' ? `Definition: ${what.term.name}` : `${what.entry.id} preview`);
      journal.toggleClass(card, 'is-term', what.kind === 'term');
      if (card.parentNode === null) journal.insert(card, root, null);
      journal.toggleClass(card, 'open', true);
      journal.setAttribute(a, 'aria-expanded', 'true');
      journal.setAttribute(a, 'aria-controls', card.id);
      following ??= env.onScroll(() => {
        place();
      });
    }
    place();
    return shown === a;
  };

  // ── The triggers, delegated from the root (a diagram block in the full-screen figure is in the root too)
  journal.listen(
    root,
    'pointerdown',
    (event) => {
      const type = (event as PointerEvent).pointerType;
      lastPointer = type === '' ? 'mouse' : type;
      lastDown = env.now();
      pressedCard = inCard(elementOf(event.target));
    },
    true,
  );
  journal.listen(root, 'pointerover', (event) => {
    const e = event as PointerEvent;
    if (e.pointerType !== 'mouse') return;
    const a = triggerOf(e.target);
    if (a !== null) {
      hideTimer = stop(hideTimer);
      showTimer = stop(showTimer);
      showTimer = env.timeout(() => {
        showFor(a);
      }, SHOW_DELAY_MS);
      return;
    }
    if (inCard(elementOf(e.target))) hideTimer = stop(hideTimer);
  });
  journal.listen(root, 'pointerout', (event) => {
    const e = event as PointerEvent;
    if (e.pointerType !== 'mouse') return;
    const t = elementOf(e.target);
    if (t === null) return;
    if (e.buttons !== 0 && t.closest('.fig-overlay') !== null) return; // a drag in the full-screen figure: the card follows its block
    const from = triggerOf(t) ?? (inCard(t) ? card : null);
    if (from === null) return;
    const rt = elementOf(e.relatedTarget);
    const to = rt === null ? null : (triggerOf(rt) ?? (inCard(rt) ? card : null));
    if (to !== null && (to === shown || to === card)) return;
    showTimer = stop(showTimer);
    if (from === shown || from === card) hide(false);
  });
  journal.listen(root, 'focusin', (event) => {
    const a = triggerOf(event.target);
    if (a === null || a === quiet) return;
    if (a === shown) {
      hideTimer = stop(hideTimer); // the focus came back within the delay
      return;
    }
    showFor(a);
    if (tapping()) fresh.add(a);
  });
  journal.listen(root, 'focusout', (event) => {
    const to = elementOf((event as FocusEvent).relatedTarget);
    if (to === null && pressedCard) return; // a press on the card's text, which takes no focus
    if (shown !== null && (to === null || !(to === shown || inCard(to)))) hide(false);
  });
  journal.listen(
    root,
    'click',
    (event) => {
      const e = event as MouseEvent;
      const a = triggerOf(e.target);
      if (a === null) return;
      if (a.matches('.dnode')) {
        // The viewer's pointer-up owns only its own marked open chrome, never host lookalikes.
        const stage = a.closest<HTMLElement>('.fo-stage');
        const overlay = stage?.closest<HTMLElement>('.fig-overlay.open');
        if (stage !== null && overlay !== undefined && overlay !== null && ctx.root.contains(overlay) && overlay.hasAttribute('data-docreader-chrome') && stage.hasAttribute('data-docreader-chrome') && overlay.contains(stage)) return;
        showFor(a);
        return;
      }
      if (e.detail === 0) return; // a key's click (or a script's): it goes
      // During a tap, the tap's pointer, whatever the click names (WebKit's names 'mouse'); else the click's own word,
      // or the last pointerdown's when it names none.
      const own = (e as { pointerType?: unknown }).pointerType;
      const type = tapping() ? lastPointer : typeof own === 'string' && own !== '' ? own : lastPointer;
      if (type !== 'mouse' && (a !== shown || fresh.has(a))) {
        fresh.delete(a);
        e.preventDefault();
        e.stopPropagation();
        showFor(a);
      }
    },
    true,
  );
  journal.listen(root, 'keydown', (event) => {
    const e = event as KeyboardEvent;
    if (e.defaultPrevented) return;
    const t = elementOf(e.target);
    const block = t === null ? null : t.closest('.dnode');
    if (block !== null && (e.key === 'Enter' || e.key === ' ')) {
      if (!showFor(block)) return; // a block that shows no card leaves the key and the focus alone
      e.preventDefault();
      const all = stops();
      all[all.length - 1]?.focus();
      return;
    }
    if (e.key !== 'Tab' || e.shiftKey || e.target !== shown) return;
    const first = stops()[0];
    if (first === undefined) return;
    e.preventDefault();
    first.focus();
  });

  // ── What closes it
  journal.listen(doc, 'pointerdown', (event) => {
    if (shown === null) return;
    const t = elementOf(event.target);
    if (inCard(t) || triggerOf(t) !== null) return;
    hide(true);
  });
  ctx.events.on('reveal', () => {
    hide(true);
  });

  states ??= new WeakMap();
  states.set(ctx, { show: showFor });
}
