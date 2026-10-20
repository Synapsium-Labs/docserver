// Scrolling: the progress line, the running head, the phone bar and the scroll spy (docserver L2, Task 12), from the
// reference layout's section 17, with the bar's skeleton (bar.ts) placed by the stylesheet's bar block.
//
// One frame per burst of scroll events (env.onScroll, then env.frame), and one right after every relayout (the
// 'relayout' event: sizes moved, so the place did; the first one, 'start', is the first frame after startup):
//   the spy      the section being read: the last level-2 section (ctx.sections, in document order) whose heading's
//                top is above the reading line, max(LINE_MIN, LINE_SHARE of the window's height) from the window's
//                top; null before the first. And the read-mark unit there (Task 18's): on a plan whose tasks take the
//                outline mode (ctx.plan.outlineable), each task heading (an h3 with an id) is a unit, and so is each
//                section but "In short" and the sections that hold tasks; the unit is the last one above the line
//                that is not hidden (a folded section's member). Elsewhere the unit is the section itself, but never
//                "In short", and a page that is not a document (ResolvedInfo.isDocument) has none. Each search is a
//                binary search over headings in document order, whose tops only grow down the page (a hidden task
//                heading is left out of its list, which is made again at every relayout), so a frame reads at most
//                about 2 log2(n) rects, the RF3 bound (a scan from the top read every heading above the line, every
//                frame). When the section or the unit changes, the frame sends events.emit('spy', { section, unit })
//                (frozen; the payload C49 fixed). A listener may destroy the instance, so the frame then checks
//                live() and stops.
//   the bar      only with chrome.bar (ctx.slots): the progress line's width (journal.setStyle) is the share of the
//                root scrolled past, of what can be (0 when the root fits the window); the root class `scrolled`
//                once the title's bottom is above TITLE_GONE px (with no title, once the root is SCROLLED_NO_TITLE px
//                past the window's top); the running head: "§ n" and the section's title, or the document's title
//                before the first section and in "In short". The phone bar: in a window of at most 700 px, the root
//                class `bar-hidden` comes on when the reader scrolls down by more than SCROLL_SLACK px past HIDE_AFTER
//                px, and goes when they scroll up by more than that, or above HIDE_AFTER; how far the reader has
//                scrolled is how far the root's top is above the window's (the page's scroll position, for a root at
//                the page's top; the walls keep the window's own scrollY in env.ts). It stays as it is while a
//                dialog is open (overlays.any(): the preview card is no dialog) or the day view is on (the root
//                class DAY_VIEW, Task 22's), and it shows while position.barHeld() (a jump just moved the page). In a
//                wider window it never hides. Each write happens only when its value changes.
//   --bar-h      at every relayout, with chrome.bar: the bar's height without its padding (the stylesheet pads the
//                bar below with the root's own top padding, so the reading column starts where it would without the
//                bar: see the bar block of reader.css), written on the root (journal.setStyle) only when it differs
//                from what the root holds, so the stylesheet's 48px stands until something (the day view's banner,
//                Task 22) makes the bar taller. A bar that is not laid out (printing) measures nothing.
// The running head's text for each section is read once, when the feature builds: the heading's own accessible name
// when the layout gave it one (editorial.ts names a numbered heading by its whole text), else its text without the
// layout's chrome; less a leading number ("3. "), as the reference's `bare`; and the number from the heading's
// `span.sec-no` (editorial.ts). The document's title is ResolvedInfo.title (the host's info.title, else the h1's text).
// The running head is set at build to the title, so it is never empty; the first frame corrects it.
//
// A host that scrolls an inner element (not the window) is out of scope for L2: the spy listens to the window's
// scroll, and the bar sticks to the window's top.
//
// Ambient APIs replaced: the window's scroll listener, innerHeight and matchMedia → env, and scrollY → the root's own
// rect (the progress line's and the phone bar's scroll position, read with the progress line's rect); Date.now →
// position.barHeld(); the body's classes → the root's (journaled); the progress element's style → journal.setStyle.
//
// Standard files, slug `scroll`: test/enhance-scroll.test.ts, test/browser/scroll.test.ts, conformance/layout/scroll/.
// Registered in features.ts, after the rail it keeps in step (Task 18 listens to 'spy') and before folds.
//
// Import-inert: declarations only.
import { headingText } from './headctl.js';
import { CHROME_ATTR, chrome } from './journal.js';
import type { FeatureContext } from './types.js';

/** The reading line: at least this far from the window's top, in px. */
export const LINE_MIN = 150;

/** The reading line: this share of the window's height from its top. */
export const LINE_SHARE = 0.3;

/** The phone bar never hides within this far from the top, in px. */
export const HIDE_AFTER = 300;

/** A scroll counts as down or up only past this far from the last frame, in px. */
export const SCROLL_SLACK = 6;

/** The title is scrolled past once its bottom is above this, in px from the window's top. */
export const TITLE_GONE = 40;

/** With no title, the root is scrolled once its top is this far above the window's, in px. */
export const SCROLLED_NO_TITLE = 80;

/** The day view's root class (Task 22): while it is on, the phone bar stays as it is. */
export const DAY_VIEW = 'ver-on';

/** A leading section number, as editorial.ts reads one ("3. ", "F2. "): the running head leaves it out of the title. */
const SEC_NO = /^[A-Z]?\d+[a-z]?\.\s+/;

/** A text with its runs of white space as one space, trimmed. */
const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** True for an element the layout made. */
const isChrome = (el: Element): boolean => el.hasAttribute(CHROME_ATTR);

/** What the running head shows for a section: its number (or null) and its title; or, in "In short", the document's title. */
interface Head {
  readonly no: string | null;
  readonly title: string;
  readonly inShort: boolean;
}

/** Whether `el` sits in the layout's "In short" box (editorial.ts's chrome `div.short`), below `root`. */
function inShort(el: Element, root: Element): boolean {
  for (let n = el.parentElement; n !== null && n !== root; n = n.parentElement) {
    if (n.classList.contains('short') && isChrome(n)) return true;
  }
  return false;
}

/** The running head of a section's heading, read now. */
function headOf(h: HTMLElement, root: Element): Head {
  let no: string | null = null;
  for (const c of Array.from(h.children)) {
    if (c.classList.contains('sec-no') && isChrome(c)) {
      no = squash(c.textContent ?? '');
      break;
    }
  }
  const label = h.getAttribute('aria-label') ?? headingText(h, isChrome);
  return { no: no === '' ? null : no, title: squash(label).replace(SEC_NO, ''), inShort: inShort(h, root) };
}

/** The index of the last heading in `list` whose top is above `line`, or -1: a binary search, one rect read a probe. */
function lastAbove(list: readonly Element[], line: number): number {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((list[mid] as Element).getBoundingClientRect().top < line) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

/** A number read from a computed value ("52px"), or 0 when it holds none. */
function px(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Build the spy and the bar's scrolling for one instance. */
export function build(ctx: FeatureContext): void {
  const { root, journal, env, slots, events, overlays, position } = ctx;
  const doc = root.ownerDocument;
  const sections = ctx.sections.map((s) => s.heading);
  const heads = new Map<HTMLElement, Head>();
  for (const h of sections) heads.set(h, headOf(h, root));
  const title = ctx.info.title ?? '';
  const h1 = root.querySelector('h1');

  // The read-mark units (Task 18 marks them): the reference layout's section 14.
  const tasks = ctx.plan.outlineable ? ctx.plan.tasks.filter((h) => h.localName === 'h3' && h.id !== '') : [];
  const holders = new Set(ctx.sections.filter((s) => tasks.some((t) => s.members.includes(t))).map((s) => s.heading));
  const units: readonly HTMLElement[] = ctx.info.isDocument
    ? ctx.text.inOrder([...sections.filter((h) => !(heads.get(h)?.inShort ?? false) && !holders.has(h)), ...tasks])
    : [];
  const isUnit = new Set(units);
  /** The units the search reads: every unit, less the hidden ones on a plan with tasks; made again at every relayout. */
  let shown: readonly HTMLElement[] = units;
  const reshow = (): void => {
    shown = tasks.length > 0 ? units.filter((u) => u.closest('[hidden]') === null) : units;
  };
  reshow();

  let section: HTMLElement | null = null;
  let unit: HTMLElement | null = null;
  let lastY = 0;
  // What each write last wrote, so a frame writes only what changed.
  let width = '';
  let scrolled = false;
  let hidden = false;
  let running = `\u0000${title}`;
  if (slots !== null && title !== '') slots.running.replaceChildren(doc.createTextNode(title));

  const hide = (on: boolean): void => {
    if (on === hidden) return;
    hidden = on;
    journal.toggleClass(root, 'bar-hidden', on);
  };

  let ticking = false;
  const spy = (): void => {
    ticking = false;
    const vh = env.viewport().h;
    if (slots !== null) {
      const box = root.getBoundingClientRect();
      // How far the reader has scrolled: the root's top above the window's (the page's scroll, for a root at its top).
      const y = -box.top;
      const room = box.height - vh;
      const share = room > 0 ? Math.min(100, Math.max(0, (100 * y) / room)) : 0;
      const w = `${String(Math.round(share * 1000) / 1000)}%`;
      if (w !== width) {
        width = w;
        journal.setStyle(slots.progress, 'width', w);
      }
      const past = h1 !== null ? h1.getBoundingClientRect().bottom < TITLE_GONE : y > SCROLLED_NO_TITLE;
      if (past !== scrolled) {
        scrolled = past;
        journal.toggleClass(root, 'scrolled', past);
      }
      // A phone: a window of at most 700 px (a literal: the walls refuse a query built at run time).
      if (!env.matches('(max-width: 700px)')) hide(false);
      else if (position.barHeld()) hide(false);
      else if (!overlays.any() && !root.classList.contains(DAY_VIEW)) {
        if (y > lastY + SCROLL_SLACK && y > HIDE_AFTER) hide(true);
        else if (y < lastY - SCROLL_SLACK || y < HIDE_AFTER) hide(false);
      }
      lastY = y;
    }

    const line = Math.max(LINE_MIN, vh * LINE_SHARE);
    const sec = sections[lastAbove(sections, line)] ?? null;
    let u: HTMLElement | null;
    if (tasks.length > 0) u = shown[lastAbove(shown, line)] ?? null;
    else u = sec !== null && isUnit.has(sec) ? sec : null;
    if (sec !== section || u !== unit) {
      section = sec;
      unit = u;
      events.emit('spy', Object.freeze({ section: sec, unit: u }));
      if (!ctx.live()) return; // a listener destroyed the instance
    }

    if (slots === null) return;
    const cur = sec === null ? undefined : heads.get(sec);
    const no = cur !== undefined && !cur.inShort ? cur.no : null;
    const text = cur !== undefined && !cur.inShort ? cur.title : title;
    const key = `${no ?? ''}\u0000${text}`;
    if (key === running) return;
    running = key;
    slots.running.replaceChildren(...(no === null ? [] : [chrome(doc, 'b', { text: `§ ${no}` })]), doc.createTextNode(text));
  };

  env.onScroll(() => {
    if (ticking) return;
    ticking = true;
    env.frame(spy);
  });
  events.on('relayout', () => {
    reshow();
    spy();
  });

  if (slots === null) return;
  const bar = slots.bar;
  ctx.onRelayout(() => {
    const h = Math.round(bar.clientHeight - px(env.computed(bar, 'padding-top')) - px(env.computed(bar, 'padding-bottom')));
    if (!(h > 0)) return;
    if (Math.abs(parseFloat(env.computed(root, '--bar-h')) - h) < 0.5) return;
    journal.setStyle(root, '--bar-h', `${String(h)}px`);
  });
}
