// The quick jump (docserver L2, Task 16), ported from the reference layout's section 21: "/" or Ctrl or Cmd+K opens a
// finder over the document's headings, tasks, defined IDs and numbered figures; typing ranks them, the arrow keys
// choose, Enter or a click goes there (nav.goTo, a new entry in the host's history), and Escape or a click outside the
// box closes it, the focus going back to where it was.
//
// What it lists, read once, when it builds (after every feature that defines what it lists, features.ts):
//   headings   each h2 and h3 of the document with an id (the reference's list of section 15): a chrome heading never,
//              and of the headings inside the "In short" box (editorial.ts's `div.short`) only its own h2. Its kind is
//              "Task" for an h3 the plan names as a task (ctx.plan.tasks), else "Section". Its text is its label (below);
//              an h2 shows without its leading section number ("3. " of "3. Design"), and an h2 that editorial.ts
//              numbered (its first child a chrome `span.sec-no`) carries that number, shown as "3. Design".
//   IDs        each entry of ctx.index but the kinds 'section' (a lettered section is its heading, listed already) and
//              'figure' (listed from ctx.figures): its ID, its title, and its kind shown as "Rule" for a rule, else its
//              group (the heading of its table).
//   figures    each entry of ctx.figures: "Fig 3", and its caption.
// each list in document order, the headings first. (Only entries of one kind can tie in the ranking below, so a tie
// keeps document order, and no order across the three lists is ever seen.) With four entries or fewer it builds
// nothing: no button, no keys, no dialog.
//
// A heading's label is the text it was written with, before any feature put chrome in it: its aria-label when it has
// one (editorial.ts names a heading it numbers by its whole text, the plans name a task heading by its own text before
// its badge exists, and headCtl names a heading by its text as it makes its controls), else its text with every
// chrome element left out (headctl.ts's headingText). Each text is cut to TEXT_MAX code units (text.ts's clip), so no
// heading, title or caption makes a row, or a query's work, unbounded.
//
// The ranking, the reference's, for a query cut of its white space at both ends and lower-cased, against each entry's
// lower-cased text and tag (an ID, or a heading's section number); the first that holds gives the score:
//   100  an ID equal to the query          95  a heading's section number equal to it      80  an ID that starts with it
//   a heading: 70 its text starts with the query, 60 a word of it does, 40 the text holds it anywhere;
//   a figure:  30 a word of its caption starts with it, 15 the caption holds it;
//   an ID:     45 a word of its title starts with it, 25 the title holds it, 20 the ID holds it;
// and 0 is no match. The matches, best first and in document order within a score, are listed, at most ROWS_MAX; an
// empty query lists the first ROWS_MAX headings. The query is matched as written, character by character, never as a
// pattern, so no character of it means more than itself, and its cost is linear in the rows' bounded texts. "A word
// starts with it" is the reference's `\b` before the query, read in any script (C52's whole words): where the
// query's first character is a letter, a mark, a digit or `_` (Unicode's), the character before the match is none of
// those, and where it is anything else, the character before is one of those.
//
// The dialog, chrome at the end of the root (in a wrapper of its own, below):
//   div.jump > div.box[role=dialog][aria-modal=true][aria-label="Jump to"] holding
//     input[type=search][role=combobox][aria-expanded=true][aria-autocomplete=list][aria-controls=<the listbox's id>]
//          [aria-activedescendant=<the selected row's id>, when one is],
//     div.jump-hint, and ul[role=listbox][id], whose rows are li[role=option][aria-selected] (`.sel` the selected one),
//     each a span.lvl (the ID, or "Fig 3", or the kind; `.lvl.id` for an ID), a span.jt (the text) and, for an ID,
//     a span.jk (its kind); or one li.none, "Nothing matches".
// The ids are chrome ids of this instance (ctx.chromeId, C48): the listbox's, and one per row place, made when a row
// first takes that place and kept for every later list, so typing never issues more than ROWS_MAX of them.
// `.jump.open` shows it (the stylesheet's). The jump and its wrapper are the reader's own; no row, id or listener of it
// reaches another root.
//
// The wrapper. The stylesheet puts every child of the root in the reading column (`max-width` and auto side margins on
// `[data-docreader-root] > *`), and a fixed dialog that is the root's child would take that width too, where the
// reference's dialog, a child of the page's body, covers the viewport. So the dialog sits in an unstyled chrome div,
// the root's last child, which takes the column and no height, and the dialog, fixed, covers the viewport from inside it.
//
// The button and the keys: `.jump-btn` ("Jump to", and the "/" key with `keyboard`) goes in the bar's tray through
// slots.tool('jump'), without `chrome.bar` nowhere; "/" and the Ctrl or Cmd+K chord are bound through ctx.keys (the
// chord kept off the keys sheet, as the reference's sheet left it out), which ignores them while a dialog is open, in a
// field (but the chord), and with `keyboard: false`. The overlay is registered as 'jump' (overlays.ts), so Escape
// closes it in the order Task 7b fixed (keys.ts routes the key to the root that holds its target, RF2).
//
// Opening it closes the preview card (overlays.close('card')), remembers the element that had the focus (the root
// document's activeElement), clears the field and lists the headings, and focuses the field. In the field: the arrow
// keys move the selection, clamped at both ends, and keep the selected row in view (scrollIntoView, where the browser
// has it); Enter goes to the selected entry; Tab stays (the field is the dialog's one control); typing ranks again from
// the first row. Going closes the dialog and the contents drawer (overlays.close('drawer')), then nav.goTo(target,
// { push: true }), which reveals, scrolls, focuses and tells the host; closing in any other way gives the focus back to
// the element that had it, and when that cannot take it (the page itself had the focus), takes it out of the hidden
// dialog, so the next key is the page's, not the field's.
//
// Ambient APIs replaced: `document.activeElement` is the root document's; body classes are overlays.isOpen and close;
// `scrollIntoView` is guarded; listeners go through the journal (one per element, the rows' clicks delegated to the
// list), and a row knows its entry through a WeakMap, never an expando.
//
// Standard files, slug `jump`: test/enhance-jump.test.ts, test/browser/jump.test.ts, conformance/layout/jump/.
// Registered in features.ts, whose header says where in the build order and why.
import { headingText } from './headctl.js';
import { CHROME_ATTR, chrome } from './journal.js';
import { CHORD } from './keys.js';
import type { FeatureContext } from './types.js';

/** With this many entries or fewer the jump is not built (the reference's). */
const MIN_ENTRIES = 4;

/** The most rows a list shows (the reference's). */
const ROWS_MAX = 80;

/** The longest text a row shows, and a query is matched against, in code units. */
const TEXT_MAX = 200;

/** A leading section number, as editorial.ts reads one ("3. ", "F2a. "). */
const SECTION_NUMBER = /^[A-Z]?\d+[a-z]?\.\s+/;

/** A text that opens, and one that ends, on a character that makes a word, in any script: a letter, a mark, a digit or `_`. */
const WORD_START = /^[\p{L}\p{M}\p{N}_]/u;
const WORD_END = /[\p{L}\p{M}\p{N}_]$/u;

/** What the button and the "/" key say. */
const LABEL = 'Jump to a section, ID or figure';

/** The field's placeholder, its ID examples neutral (C48's). */
const PLACEHOLDER = 'Jump to a section, ID (R14, F3, …) or figure';

const HINT = 'Type to filter · ↑ ↓ to choose · Enter to go · Esc to close';

interface Entry {
  /** "Section", "Task", "Rule", an ID's group, or "Figure". */
  readonly kind: string;
  /** An ID, or "Fig 3"; '' for a heading. */
  readonly tag: string;
  /** A heading's section number ("3"), or ''. */
  readonly no: string;
  readonly text: string;
  readonly target: Element;
  /** A heading (the empty query lists these). */
  readonly heading: boolean;
  readonly id: boolean;
  readonly fig: boolean;
  /** The text, lower-cased: what a query is matched against. */
  readonly low: string;
  /** The ID or the section number, lower-cased ('' for a figure, whose tag is not matched). */
  readonly lowTag: string;
}

const isChrome = (el: Element): boolean => el.hasAttribute(CHROME_ATTR);

/**
 * True when some match of `q` in `t` starts a word: a `\b` before `q`, read in any script (see the header). The two
 * code units before a match hold the whole character before it (a pair beyond the first plane is one character to
 * the `u` flag; a lone surrogate is none that makes a word).
 */
function wordStart(t: string, q: string): boolean {
  const first = WORD_START.test(q);
  for (let i = t.indexOf(q); i >= 0; i = t.indexOf(q, i + 1)) {
    if (WORD_END.test(t.slice(Math.max(0, i - 2), i)) !== first) return true;
  }
  return false;
}

/** The entry's score for the query (see the header); 0 is no match. */
function score(x: Entry, q: string): number {
  const t = x.low;
  const tag = x.lowTag;
  if (x.id && tag === q) return 100;
  if (x.heading && tag === q) return 95;
  if (x.id && tag.startsWith(q)) return 80;
  if (x.heading) {
    if (t.startsWith(q)) return 70;
    if (wordStart(t, q)) return 60;
    return t.includes(q) ? 40 : 0;
  }
  if (x.fig) {
    if (wordStart(t, q)) return 30;
    return t.includes(q) ? 15 : 0;
  }
  if (wordStart(t, q)) return 45;
  if (t.includes(q)) return 25;
  return tag.includes(q) ? 20 : 0;
}

/** The matches of `q`, best first, in document order within a score; at most ROWS_MAX. */
function rank(entries: readonly Entry[], q: string): Entry[] {
  const hits: { readonly s: number; readonly i: number; readonly x: Entry }[] = [];
  entries.forEach((x, i) => {
    const s = score(x, q);
    if (s > 0) hits.push({ s, i, x });
  });
  hits.sort((a, b) => b.s - a.s || a.i - b.i);
  return hits.slice(0, ROWS_MAX).map((h) => h.x);
}

/** The `div.short` box of the document that holds `h`, inside the root, or null. */
function shortBox(h: Element, root: Element): Element | null {
  for (let n = h.parentElement; n !== null && n !== root; n = n.parentElement) {
    if (n.classList.contains('short') && isChrome(n)) return n;
  }
  return null;
}

/** The text a heading was written with (see the header), its white space runs as one space. */
function labelOf(h: Element): string {
  const given = (h.getAttribute('aria-label') ?? '').trim();
  return given !== '' ? given : headingText(h, isChrome);
}

/** The heading entries, in document order. */
function headingEntries(ctx: FeatureContext): Entry[] {
  const { root } = ctx;
  const tasks = new Set<Element>(ctx.plan.tasks);
  const out: Entry[] = [];
  for (const h of Array.from(root.querySelectorAll('h2[id], h3[id]'))) {
    if (isChrome(h)) continue;
    const box = shortBox(h, root);
    if (box !== null && box.firstElementChild !== h) continue;
    const h2 = h.localName === 'h2';
    const first = h.firstChild;
    const numbered = first !== null && first.nodeType === 1 && isChrome(first as Element) && (first as Element).classList.contains('sec-no');
    const no = numbered ? (first.textContent ?? '').trim() : '';
    const label = labelOf(h);
    const text = ctx.text.clip(h2 ? label.replace(SECTION_NUMBER, '') : label, TEXT_MAX);
    out.push({
      kind: !h2 && tasks.has(h) ? 'Task' : 'Section',
      tag: '',
      no,
      text,
      target: h,
      heading: true,
      id: false,
      fig: false,
      low: text.toLowerCase(),
      lowTag: no.toLowerCase(),
    });
  }
  return out;
}

/** The ID entries (every kind but 'section' and 'figure'), in document order. */
function idEntries(ctx: FeatureContext): Entry[] {
  const out: Entry[] = [];
  for (const e of ctx.index.all()) {
    if (e.kind === 'section' || e.kind === 'figure') continue;
    const text = ctx.text.clip(e.title, TEXT_MAX);
    const tag = e.id;
    out.push({
      kind: e.kind === 'rule' ? 'Rule' : ctx.text.clip(e.group, TEXT_MAX),
      tag,
      no: '',
      text,
      target: e.target,
      heading: false,
      id: true,
      fig: false,
      low: text.toLowerCase(),
      lowTag: tag.toLowerCase(),
    });
  }
  return out;
}

/** The figure entries, in document order. */
function figureEntries(ctx: FeatureContext): Entry[] {
  return ctx.figures.all().map((f) => {
    const text = ctx.text.clip(f.caption, TEXT_MAX);
    return {
      kind: 'Figure',
      tag: `Fig ${f.no}`,
      no: '',
      text,
      target: f.figure,
      heading: false,
      id: false,
      fig: true,
      low: text.toLowerCase(),
      lowTag: '',
    };
  });
}

/** Build this feature during startup: the dialog, its button and its keys, when there are more than four entries. */
export function build(ctx: FeatureContext): void {
  const entries = [...headingEntries(ctx), ...idEntries(ctx), ...figureEntries(ctx)];
  if (entries.length <= MIN_ENTRIES) return;
  const { root, journal } = ctx;
  const doc = root.ownerDocument;

  const listId = ctx.chromeId('jump-list');
  const input = chrome(doc, 'input', {
    attrs: {
      type: 'search',
      placeholder: PLACEHOLDER,
      role: 'combobox',
      'aria-expanded': 'true',
      'aria-controls': listId,
      'aria-autocomplete': 'list',
      'aria-label': 'Jump to',
    },
  });
  const list = chrome(doc, 'ul', { attrs: { role: 'listbox', id: listId, 'aria-label': 'Matches' } });
  const box = chrome(doc, 'div', { className: 'box', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Jump to' } }, [
    input,
    chrome(doc, 'div', { className: 'jump-hint', text: HINT }),
    list,
  ]);
  const jump = chrome(doc, 'div', { className: 'jump' }, [box]);
  journal.insert(chrome(doc, 'div', {}, [jump]), root, null);

  /** The rows shown now, and the selected one's place. */
  let shown: Entry[] = [];
  let rows: HTMLLIElement[] = [];
  let sel = 0;
  /** What had the focus when the dialog opened. */
  let opener: Element | null = null;
  /** Each row's entry. */
  const rowOf = new WeakMap<Element, Entry>();
  /** The chrome id of each row place, made the first time a row takes it. */
  const placeIds: string[] = [];
  const placeId = (i: number): string => (placeIds[i] ??= ctx.chromeId('jump-option'));

  const isOpen = (): boolean => jump.classList.contains('open');

  /** Select row `i` (clamped), mark it, and keep it in view. */
  const select = (i: number): void => {
    const was = rows[sel];
    if (was !== undefined) {
      was.classList.remove('sel');
      was.setAttribute('aria-selected', 'false');
    }
    sel = Math.max(0, Math.min(i, rows.length - 1));
    const now = rows[sel];
    if (now === undefined) {
      input.removeAttribute('aria-activedescendant');
      return;
    }
    now.classList.add('sel');
    now.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', now.id);
    if (typeof now.scrollIntoView === 'function') now.scrollIntoView({ block: 'nearest' });
  };

  /** List the matches of the field's query, the first selected. */
  const render = (): void => {
    const q = input.value.trim().toLowerCase();
    shown = q === '' ? entries.filter((x) => x.heading).slice(0, ROWS_MAX) : rank(entries, q);
    rows = shown.map((x, i) => {
      const lvl = chrome(doc, 'span', { className: x.id ? 'lvl id' : 'lvl', text: x.id || x.fig ? x.tag : x.kind });
      const jt = chrome(doc, 'span', { className: 'jt', text: x.heading && x.no !== '' ? `${x.no}. ${x.text}` : x.text });
      const kids: Node[] = [lvl, jt];
      if (x.id) kids.push(chrome(doc, 'span', { className: 'jk', text: x.kind }));
      const li = chrome(doc, 'li', { attrs: { id: placeId(i), role: 'option', 'aria-selected': 'false' } }, kids);
      rowOf.set(li, x);
      return li;
    });
    list.replaceChildren(...(rows.length > 0 ? rows : [chrome(doc, 'li', { className: 'none', text: 'Nothing matches' })]));
    select(0);
  };

  const close = (): void => {
    jump.classList.remove('open');
    if (opener !== null) (opener as HTMLElement).focus({ preventScroll: true });
    // Nothing took it back (the page itself had it): the focus leaves the hidden dialog, so no key goes there.
    const now = doc.activeElement;
    if (now !== null && box.contains(now)) (now as HTMLElement).blur();
  };

  const go = (x: Entry): void => {
    jump.classList.remove('open');
    ctx.overlays.close('drawer');
    ctx.nav.goTo(x.target, { push: true });
  };

  const openJump = (): void => {
    if (isOpen()) return;
    opener = doc.activeElement;
    ctx.overlays.close('card');
    jump.classList.add('open');
    input.value = '';
    render();
    input.focus();
  };

  journal.listen(jump, 'click', (e) => {
    if (e.target === jump) close();
  });
  journal.listen(list, 'click', (e) => {
    const li = (e.target as Element).closest('li');
    const x = li === null ? undefined : rowOf.get(li);
    if (x !== undefined) go(x);
  });
  journal.listen(input, 'input', () => {
    render();
  });
  journal.listen(input, 'keydown', (event) => {
    const e = event as KeyboardEvent;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      select(sel + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      select(sel - 1);
    } else if (e.key === 'Enter') {
      const x = shown[sel];
      if (x === undefined) return;
      e.preventDefault();
      go(x);
    } else if (e.key === 'Tab') e.preventDefault();
  });

  ctx.overlays.register('jump', { isOpen, close });
  ctx.keys.bind({ key: '/', label: LABEL, run: openJump });
  ctx.keys.bind({ key: CHORD, label: LABEL, listed: false, run: openJump });

  if (ctx.slots !== null) {
    const keyboard = ctx.options.keyboard;
    const btn = chrome(
      doc,
      'button',
      { className: 'jump-btn', attrs: { type: 'button', title: keyboard ? `${LABEL} (/)` : LABEL, 'aria-haspopup': 'dialog' } },
      keyboard ? [chrome(doc, 'span', { className: 'lbl', text: 'Jump to' }), chrome(doc, 'kbd', { className: 'kb', text: '/' })] : [chrome(doc, 'span', { className: 'lbl', text: 'Jump to' })],
    );
    journal.listen(btn, 'click', () => {
      openJump();
    });
    ctx.slots.tool('jump', btn);
  }
}
