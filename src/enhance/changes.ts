// What changed since a commit: marks and a stepper (the reference layout, section 24). Built by L2 Task 20.
//
// A comparison is the host's: `changes(base)` (an option, reached through ctx.host) answers the document's changes
// since commit `base`, as a change set `{ changed: [from, to][], removedAfter?: number[] }` in the source lines of the
// version shown (render()'s `data-line`): each `[from, to]` a range of changed lines (one hunk), each `removedAfter`
// entry a line after which lines were removed (0: at the very start). "What changed" exists only for a version that is
// a commit: with info.sha and without info.draft, and only when the host gave `changes`.
//
// The reply is untrusted (RF4), read once per base by readChangeSet:
//   - a reply that is not an object holding a `changed` array is no change set: nothing is shown ('unavailable');
//   - otherwise, any of these reads as no changes (an empty set): more than MAX_RANGES ranges or MAX_DELETIONS
//     deletions, a range that is not a pair of integers (finite, never NaN) with from at most to, a `removedAfter` that
//     is present and not an array of integers. `removedAfter` may be left out (no deletions);
//   - a getter of the reply that throws reads as no change set; the reply is read item by item, by index.
// Lines past the last line a block of the document ends on are read as the line after it: a line past the end marks
// nothing, as an unclamped one would, and no number from the host reaches anything but a comparison.
//
// The blocks are the elements of the root that carry `data-line`, taken when the feature builds (so a preview's or a
// diagram's copy made later is never one), in document order, less those hidden by their own attribute (anything but
// a fold's `until-found`): the meta line the byline replaced and the front-matter strip, which the reference removed
// (the byline carries the meta line's `data-line`, as the reference's did). A block is [a, b] from its `data-line`
// "a-b" (or "a", one line); any other value is no block.
//
// One place (a stop of the stepper) per changed place, the reference's rule: for each range in the host's order, its
// hits are the blocks whose lines meet it, and of those only the innermost (a hit that holds another hit is not one);
// those blocks are marked `chg`, and they join the first stop that already holds one of them, or make a new stop, so
// one hunk across two table rows is one stop. For each `removedAfter` k, the blocks that end on the last line, at or
// before k, that any block ends on, the innermost of them, are marked `chg-del`, each a stop of its own unless a stop
// holds it already. Each stop's blocks, and the stops by their first block, are in document order. The work is
// bounded: past WORK_MAX hits of the ranges in all (a block met by two ranges counts twice), the set reads as no
// changes; a deletion's group is the blocks ending on one line, a handful. Ranges are
// swept in order of their first line, so the blocks a range meets are found from a sorted list and the few that begin
// before it and reach it, never by a scan of every block per range; telling the innermost hits walks up from each hit
// only to a block an earlier walk of that range reached.
//
// showChanges(ctx, base, how) is the one export another feature uses (C49; Task 22's menu, notice and day view): it
// asks the host for the set since `base` (one call per base per instance, its reply kept, at most CACHE_MAX bases; a
// failed call, or a reply that is no change set, is not kept, so the next show of that base asks again; the reference
// kept a failure), checks live() after the reply, and then, inside an operation:
//   - with `how.measure`, marks nothing and answers how many places the set has (the notice's count);
//   - otherwise hides what is shown (calling its onHide), marks the blocks (journal.toggleClass, so destroy clears
//     them), shows the stepper, emits 'changes' with the level-2 sections (ctx.sections) that hold each place's first
//     block, and, with `how.jump` (default true), steps to the first place. A show asked for later wins: a reply that
//     arrives after a later show was asked for marks nothing ('superseded').
// It answers `{ places }`, or `{ skipped }` with why nothing was shown: 'unavailable' (no comparison: no `changes`,
// a draft, no sha, a base that is not a sha, a failed call or a reply that is no change set), 'superseded', or 'gone'
// (the instance is not live). It never throws or rejects: a throw of another feature's code it calls (the onHide of the
// show it replaces, a listener of 'changes', a revealer or a listener of 'reveal' that the step reaches) is caught
// there, and what the show owes after it runs all the same (the event is emitted, the step taken).
//
// The stepper, in the bar's tray (slots.tool('changes'), with `chrome.bar` only): `div.chg-nav[role=group]`, hidden
// until a set is shown, holding `span.what` (how.what, clipped), `span.cn` ("3 changes", then "2 of 3"; aria-live),
// the previous and next buttons (`button.ic`) and `button.hide`. Without the bar, the marks and keys work all the same.
// A step (the buttons, or the keys `n` and `p` through ctx.keys, while a set is shown):
//   - starts from where the reader is when nothing was visited yet, or when the place last visited is more than a
//     screen from the reading line (the bar's bottom plus 60 px) and was not visited within RECENT_MS: the next place
//     is the first whose first block's top is below that line (plus 4 px), wrapping around; the previous one, the place
//     before it. Otherwise it moves one place on from the last, wrapping around;
//   - goes to the place's first block through nav.goTo, with push false and focus false, as a jump to the next
//     section does: goTo reveals it (a fold, a closed details, the outline), keeps the bar shown, scrolls it into view
//     (smoothly unless it is more than two screens away, or the reader asked for less motion) and, when the block has
//     an id or defines an ID, tells the host (onHash, replacing its entry, LD7). (The reference scrolled the block to
//     28% of the window's height, which needs the window's scroll position: here every jump lands alike.) Then it
//     flashes each block of the place (the class `flash`, journaled, removed after FLASH_MS; a new flash of a block
//     restarts it).
// Hide (the button) clears every mark, hides the stepper, emits 'changes' with no sections, and calls the onHide of
// what was shown, each throw of those caught as above (a Hide clicked raises none). after(ctx), the second phase (LD5): for a document, a version
// with info.only is the day view, the changes since `only` marked: shown at once (no step), under the label ONLY_WHAT.
//
// Ambient APIs replaced: fetch of a changes URL → host.changes; the step's scroll → nav.goTo; innerHeight and the
// clock → env; setTimeout → env.timeout; body classes → none (the stepper's own `hidden`); the session's kept
// comparison is not ported (LD8: the comparison in view stays in memory).
//
// Standard files, slug `changes`: test/enhance-changes.test.ts, test/browser/changes.test.ts and
// conformance/layout/changes/. Registered in features.ts, whose header says where in the build order and why.
import type { Cancel } from './env.js';
import { chrome } from './journal.js';
import { isSha } from './options.js';
import { before, clip } from './text.js';
import type { FeatureContext } from './types.js';

/** The most ranges, and the most deletions, a change set holds; more reads as no changes (RF4). */
export const MAX_RANGES = 10_000;
export const MAX_DELETIONS = 10_000;

/** The most blocks one set's marking may visit; past it, the set reads as no changes (RF4). */
export const WORK_MAX = 2_000_000;

/** How many bases' replies an instance keeps. */
export const CACHE_MAX = 32;

/** The longest label the stepper shows, in code units. */
export const WHAT_MAX = 80;

/** The label of the day view's changes (after). */
export const ONLY_WHAT = 'Only that day';

/** How long a flash lasts, and how recent a step must be to move on from it wherever the reader is, in ms. */
const FLASH_MS = 1900;
const RECENT_MS = 1500;

/** A block's `data-line`: a line, or a first and a last line. */
const LINE = /^(\d{1,9})(?:-(\d{1,9}))?$/;

/** A host's change set, checked. */
export interface ChangeSet {
  readonly changed: readonly (readonly [number, number])[];
  readonly removedAfter: readonly number[];
}

/** What showChanges asks for. */
export interface ShowHow {
  /** What the stepper calls the comparison ("Since Monday"); clipped to WHAT_MAX. */
  readonly what: string;
  /** Step to the first place once shown; default true. */
  readonly jump?: boolean;
  /** Only count the places: mark and show nothing; default false. */
  readonly measure?: boolean;
  /** Called once, when what this call showed is hidden (its Hide, or a later show). */
  readonly onHide?: () => void;
}

/** What showChanges came to. */
export type ShowOutcome = { readonly places: number } | { readonly skipped: 'unavailable' | 'superseded' | 'gone' };

/** No changes: what a malformed set reads as. (A literal: no code runs at import.) */
const EMPTY: ChangeSet = { changed: [], removedAfter: [] };

const isInt = (v: unknown): v is number => Number.isInteger(v);

/**
 * The host's reply, checked (see the header): null when it is no change set, EMPTY when it is malformed, else a
 * frozen copy. A getter that throws is no change set.
 */
export function readChangeSet(reply: unknown): ChangeSet | null {
  try {
    if (typeof reply !== 'object') return null; // a primitive, or a function
    const changed: unknown = (reply as { changed?: unknown } | null)?.changed;
    if (!Array.isArray(changed)) return null;
    const removed: unknown = (reply as { removedAfter?: unknown }).removedAfter;
    const n = changed.length;
    if (n > MAX_RANGES) return EMPTY;
    const pairs: (readonly [number, number])[] = [];
    for (let i = 0; i < n; i += 1) {
      const p: unknown = changed[i];
      if (!Array.isArray(p) || p.length !== 2) return EMPTY;
      const from: unknown = p[0];
      const to: unknown = p[1];
      if (!isInt(from) || !isInt(to) || from > to) return EMPTY;
      pairs.push(Object.freeze([from, to] as const));
    }
    const after: number[] = [];
    if (removed !== undefined) {
      if (!Array.isArray(removed)) return EMPTY;
      const m = removed.length;
      if (m > MAX_DELETIONS) return EMPTY;
      for (let i = 0; i < m; i += 1) {
        const k: unknown = removed[i];
        if (!isInt(k)) return EMPTY;
        after.push(k);
      }
    }
    return Object.freeze({ changed: Object.freeze(pairs), removedAfter: Object.freeze(after) });
  } catch {
    return null;
  }
}

/** The blocks of the document, by their lines (see the header). */
interface Lines {
  readonly els: readonly Element[];
  readonly a: readonly number[];
  readonly b: readonly number[];
  /** The nearest block that holds each block, or -1. */
  readonly parent: readonly number[];
  /** Block indices by first line (document order among equals). */
  readonly byA: readonly number[];
  /** Block indices by last line (document order among equals). */
  readonly byB: readonly number[];
  /** The last line any block ends on (0 with none). */
  readonly last: number;
}

/** Hidden by its own attribute (a fold's `until-found` is not hidden: a step reveals it). */
function hiddenByLayout(el: Element): boolean {
  const h = el.getAttribute('hidden');
  return h !== null && h !== 'until-found';
}

/** The document's blocks, read now. */
function readLines(root: Element): Lines {
  const els: Element[] = [];
  const as: number[] = [];
  const bs: number[] = [];
  for (const el of Array.from(root.querySelectorAll('[data-line]'))) {
    const m = LINE.exec(el.getAttribute('data-line') ?? '');
    if (m === null || hiddenByLayout(el)) continue;
    const a = Number(m[1]);
    els.push(el);
    as.push(a);
    bs.push(m[2] === undefined ? a : Number(m[2]));
  }
  const n = els.length;
  const at = new Map<Element, number>();
  els.forEach((el, i) => at.set(el, i));
  const parent = new Array<number>(n).fill(-1);
  for (let i = 0; i < n; i += 1) {
    for (let p = (els[i] as Element).parentElement; p !== null; p = p.parentElement) {
      const k = at.get(p);
      if (k !== undefined) {
        parent[i] = k;
        break;
      }
    }
  }
  // A stable sort of the indices, so blocks on equal lines stay in document order.
  const order = (key: readonly number[]): number[] => [...key.keys()].sort((x, y) => (key[x] as number) - (key[y] as number));
  return {
    els,
    a: as,
    b: bs,
    parent,
    byA: order(as),
    byB: order(bs),
    last: bs.reduce((m, v) => Math.max(m, v), 0),
  };
}

/** The places of a set: the marked blocks and the stops, as block indices in document order. */
interface Places {
  readonly changed: readonly number[];
  readonly removed: readonly number[];
  readonly stops: readonly (readonly number[])[];
}

/** No places: what a set past WORK_MAX reads as. */
const NO_PLACES: Places = { changed: [], removed: [], stops: [] };

/** The places of `set` among `lines` (see the header); NO_PLACES past WORK_MAX. */
function placesOf(lines: Lines, set: ChangeSet): Places {
  const { a, b, parent, byA, byB, last } = lines;
  const n = a.length;
  const clamp = (v: number): number => Math.min(v, last + 1);
  let work = 0;

  // Innermost-ness: a hit holds another hit when a walk up from that other one reaches it. Each walk stops at a block
  // already reached in this round, so a round costs its hits and the blocks above them once.
  const cover = new Array<number>(n).fill(0);
  let round = 0;
  const inner = (hits: readonly number[]): number[] => {
    round += 1;
    for (const h of hits) {
      for (let p = parent[h] as number; p >= 0; p = parent[p] as number) {
        if (cover[p] === round) break;
        cover[p] = round;
      }
    }
    return hits.filter((h) => cover[h] !== round).sort((x, y) => x - y);
  };

  // Each range's innermost hits, swept by first line: `active` holds the blocks that began before the range's first
  // line and may still reach it; the rest of its hits begin within it, a run of byA.
  const ranges = set.changed.map(([x, y]) => [clamp(x), clamp(y)] as const);
  const order = [...ranges.keys()].sort((p, q) => (ranges[p] as readonly [number, number])[0] - (ranges[q] as readonly [number, number])[0]);
  const innerOf: (readonly number[])[] = new Array<readonly number[]>(ranges.length);
  let active: number[] = [];
  let next = 0;
  for (const r of order) {
    const [x, y] = ranges[r] as readonly [number, number];
    while (next < n && (a[byA[next] as number] as number) < x) active.push(byA[next++] as number);
    active = active.filter((i) => (b[i] as number) >= x);
    const hits = [...active];
    for (let j = next; j < n && (a[byA[j] as number] as number) <= y; j += 1) hits.push(byA[j] as number);
    work += hits.length;
    if (work > WORK_MAX) return NO_PLACES;
    innerOf[r] = inner(hits);
  }

  // The stops, in the host's order of ranges: a range's blocks join the first stop that holds one of them. firstStop
  // is the first stop that holds each block, so the first stop holding any of a range's blocks is the least of theirs.
  const firstStop = new Array<number>(n).fill(-1);
  const stops: number[][] = [];
  const changed = new Set<number>();
  for (let r = 0; r < ranges.length; r += 1) {
    const ns = innerOf[r] as readonly number[];
    if (ns.length === 0) continue;
    let j = -1;
    for (const i of ns) {
      changed.add(i);
      const s = firstStop[i] as number;
      if (s >= 0 && (j < 0 || s < j)) j = s;
    }
    if (j < 0) {
      j = stops.length;
      stops.push([]);
    }
    for (const i of ns) {
      (stops[j] as number[]).push(i);
      firstStop[i] = j; // it was in no stop, or in a later one, or in this one
    }
  }

  // Deletions: the innermost blocks that end on the last line, at or before k, that any block ends on.
  const removed = new Set<number>();
  for (const k0 of set.removedAfter) {
    const k = clamp(k0);
    let lo = 0;
    let hi = n; // the first in byB that ends after k
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((b[byB[mid] as number] as number) <= k) lo = mid + 1;
      else hi = mid;
    }
    const end = b[byB[lo - 1] as number]; // undefined when no block ends at or before k: no group
    const group: number[] = [];
    for (let j = lo - 1; j >= 0 && b[byB[j] as number] === end; j -= 1) group.push(byB[j] as number);
    const ns = inner(group);
    for (const i of ns) {
      removed.add(i);
      if ((firstStop[i] as number) >= 0) continue;
      firstStop[i] = stops.length;
      stops.push([i]);
    }
  }

  // Each stop once per block, in document order; the stops by their first block (a stable sort: a tie keeps their order).
  const sorted = (xs: Iterable<number>): number[] => [...new Set(xs)].sort((x, y) => x - y);
  return {
    changed: sorted(changed),
    removed: sorted(removed),
    stops: stops.map(sorted).sort((p, q) => (p[0] as number) - (q[0] as number)),
  };
}

/** What is shown now. */
interface Shown {
  /** Each place's blocks. */
  readonly stops: readonly (readonly Element[])[];
  /** Every block marked, and its class. */
  readonly marks: readonly (readonly [Element, 'chg' | 'chg-del'])[];
  readonly onHide: (() => void) | null;
  /** The place last visited, or -1; when it was visited (env.now()). */
  i: number;
  at: number;
}

/** The stepper's parts, in the bar's tray. */
interface Stepper {
  readonly box: HTMLElement;
  readonly what: HTMLElement;
  readonly count: HTMLElement;
}

/** One instance's "what changed". */
interface State {
  readonly lines: Lines;
  readonly stepper: Stepper | null;
  readonly cache: Map<string, Promise<ChangeSet | null>>;
  readonly flashes: WeakMap<Element, Cancel>;
  shown: Shown | null;
  /** Counts the shows asked for: a reply for an older one marks nothing. */
  asked: number;
}

/** Each instance's state, keyed by its context (C49); made on first use, so importing runs nothing. */
let states: WeakMap<FeatureContext, State> | undefined;

/** The bar's bottom in the viewport, or 0 with no bar shown. */
function barBottom(ctx: FeatureContext): number {
  const bar = ctx.slots?.bar ?? null;
  if (bar === null || ctx.root.classList.contains('bar-hidden')) return 0;
  return Math.max(0, bar.getBoundingClientRect().bottom);
}

/** The stepper's count: "3 changes", then "2 of 3". */
function updateCount(st: State): void {
  const s = st.shown as Shown; // called once a set is shown
  if (st.stepper === null) return;
  const n = s.stops.length;
  st.stepper.count.textContent = s.i < 0 ? `${String(n)} change${n === 1 ? '' : 's'}` : `${String(s.i + 1)} of ${String(n)}`;
}

/** Flash `el`: the class `flash`, restarted, removed after FLASH_MS. */
function flash(ctx: FeatureContext, st: State, el: Element): void {
  st.flashes.get(el)?.();
  ctx.journal.toggleClass(el, 'flash', false);
  void (el as HTMLElement).offsetWidth; // a new animation, not the one already running
  ctx.journal.toggleClass(el, 'flash', true);
  st.flashes.set(
    el,
    ctx.env.timeout(() => {
      st.flashes.delete(el);
      ctx.journal.toggleClass(el, 'flash', false);
    }, FLASH_MS),
  );
}

/** Step `d` places (1 or -1); see the header. */
function step(ctx: FeatureContext, st: State, d: 1 | -1): void {
  const s = st.shown;
  if (s === null || s.stops.length === 0) return;
  const n = s.stops.length;
  const line = barBottom(ctx) + 60;
  const now = ctx.env.now();
  const last = s.i < 0 ? null : ((s.stops[s.i] as readonly Element[])[0] as Element);
  if (last === null || (now - s.at >= RECENT_MS && Math.abs(last.getBoundingClientRect().top - line) > ctx.env.viewport().h)) {
    const idx = s.stops.findIndex((p) => (p[0] as Element).getBoundingClientRect().top > line + 4);
    s.i = d > 0 ? (idx < 0 ? 0 : idx) : ((idx < 0 ? n : idx) - 1 + n) % n;
  } else {
    s.i = (s.i + d + n) % n;
  }
  s.at = now;
  const place = s.stops[s.i] as readonly Element[];
  ctx.nav.goTo(place[0] as Element, { push: false, focus: false });
  if (!ctx.live()) return; // a revealer or the host's onHash may destroy
  for (const b of place) flash(ctx, st, b);
  updateCount(st);
}

/** Clear what is shown: its marks, the stepper; its onHide. Emits nothing. */
function clear(ctx: FeatureContext, st: State): (() => void) | null {
  const s = st.shown;
  if (s === null) return null;
  st.shown = null;
  for (const [el, cls] of s.marks) ctx.journal.toggleClass(el, cls, false);
  if (st.stepper !== null) st.stepper.box.hidden = true;
  return s.onHide;
}

/**
 * Call another feature's code (an onHide, the event's listeners, a step that reveals): a throw there is caught, so what
 * this feature owes after it still runs, and showChanges never rejects (the lifecycle's rule for an `after`).
 */
function attempt(fn: () => void): void {
  try {
    fn();
  } catch {
    // the other feature's fault: nothing of this one's waits on it
  }
}

/** Hide what is shown (the stepper's Hide): every mark goes, and 'changes' is emitted with no sections. */
function hide(ctx: FeatureContext, st: State): void {
  if (st.shown === null) return;
  const onHide = clear(ctx, st);
  attempt(() => ctx.events.emit('changes', { sections: [] }));
  if (onHide !== null && ctx.live()) attempt(onHide);
}

/** The level-2 sections (ctx.sections) holding each place's first block, in order, each once. */
function sectionsOf(ctx: FeatureContext, stops: readonly (readonly Element[])[]): HTMLElement[] {
  const heads = ctx.sections.map((u) => u.heading);
  const out: HTMLElement[] = [];
  let h = -1;
  for (const p of stops) {
    const first = p[0] as Element;
    while (h + 1 < heads.length && (heads[h + 1] === first || before(heads[h + 1] as Element, first))) h += 1;
    const sec = heads[h]; // undefined for a place before every section: it names none
    if (sec !== undefined && !out.includes(sec)) out.push(sec);
  }
  return out;
}

/** Show `set` (checked) as what changed; see the header. */
function show(ctx: FeatureContext, st: State, set: ChangeSet, how: ShowHow): number {
  const places = placesOf(st.lines, set);
  const els = st.lines.els;
  const stops = places.stops.map((p) => Object.freeze(p.map((i) => els[i] as Element)));
  const previous = clear(ctx, st);
  const marks: (readonly [Element, 'chg' | 'chg-del'])[] = [
    ...places.changed.map((i) => [els[i] as Element, 'chg'] as const),
    ...places.removed.map((i) => [els[i] as Element, 'chg-del'] as const),
  ];
  for (const [el, cls] of marks) ctx.journal.toggleClass(el, cls, true);
  st.shown = { stops, marks, onHide: typeof how.onHide === 'function' ? how.onHide : null, i: -1, at: 0 };
  if (st.stepper !== null) {
    const what = clip(how.what, WHAT_MAX);
    st.stepper.what.textContent = what === '' ? 'Changes' : what;
    st.stepper.box.hidden = false;
  }
  updateCount(st);
  if (previous !== null) attempt(previous); // a destroy there: the event emits nothing, and the check after it stops the step
  attempt(() => ctx.events.emit('changes', { sections: sectionsOf(ctx, stops) }));
  if (!ctx.live()) return stops.length; // a listener, or the onHide before it, may destroy
  if (how.jump !== false) attempt(() => step(ctx, st, 1));
  return stops.length;
}

/** The host's set since `base`, once per base per instance while its reply is kept (see the header). */
function fetchSet(ctx: FeatureContext, st: State, base: string): Promise<ChangeSet | null> {
  const kept = st.cache.get(base);
  if (kept !== undefined) return kept;
  const p: Promise<ChangeSet | null> = ctx.host.changes(base).then((reply) => {
    const set = readChangeSet(reply);
    // A failed call, or a reply that is no change set, is not kept: the next show of this base asks again. Only this
    // call's own entry goes (a newer call for the base, made once this one was bounded out, stays).
    if (set === null && st.cache.get(base) === p) st.cache.delete(base);
    return set;
  });
  if (st.cache.size >= CACHE_MAX) st.cache.delete(st.cache.keys().next().value as string);
  st.cache.set(base, p);
  return p;
}

/**
 * Show what changed since commit `base`, or with `how.measure` only count its places; see the header. Never throws or
 * rejects.
 */
export async function showChanges(ctx: FeatureContext, base: string, how: ShowHow): Promise<ShowOutcome> {
  const st = states?.get(ctx);
  if (st === undefined || !isSha(base) || how === null || how === undefined || typeof how.what !== 'string') return { skipped: 'unavailable' };
  const measure = how.measure === true;
  const ticket = measure ? st.asked : (st.asked += 1);
  const set = await fetchSet(ctx, st, base.toLowerCase()); // once not live, the host is not called and this is null
  if (!ctx.live()) return { skipped: 'gone' };
  if (set === null) return { skipped: 'unavailable' };
  if (measure) return { places: placesOf(st.lines, set).stops.length };
  if (ticket !== st.asked) return { skipped: 'superseded' };
  // Live now, and nothing awaited since: the operation runs.
  return { places: ctx.operate(() => show(ctx, st, set, how)) as number };
}

/** Build this feature during startup: the blocks, the stepper and the keys, when a comparison can exist. */
export function build(ctx: FeatureContext): void {
  if (!ctx.host.present.has('changes') || ctx.info.sha === null || ctx.info.draft) return;
  const doc = ctx.root.ownerDocument;
  let stepper: Stepper | null = null;
  if (ctx.slots !== null) {
    const what = chrome(doc, 'span', { className: 'what' });
    const count = chrome(doc, 'span', { className: 'cn', attrs: { 'aria-live': 'polite' } });
    const prev = chrome(doc, 'button', { className: 'ic', text: '\u2039', attrs: { type: 'button', title: 'Previous change (p)', 'aria-label': 'Previous change' } });
    const next = chrome(doc, 'button', { className: 'ic', text: '\u203a', attrs: { type: 'button', title: 'Next change (n)', 'aria-label': 'Next change' } });
    const off = chrome(doc, 'button', { className: 'hide', text: 'Hide', attrs: { type: 'button', title: 'Hide the changes' } });
    const box = chrome(doc, 'div', { className: 'chg-nav', attrs: { hidden: '', role: 'group', 'aria-label': 'Changes' } }, [what, count, prev, next, off]);
    ctx.journal.listen(prev, 'click', () => step(ctx, st, -1));
    ctx.journal.listen(next, 'click', () => step(ctx, st, 1));
    ctx.journal.listen(off, 'click', () => hide(ctx, st));
    ctx.slots.tool('changes', box);
    stepper = { box, what, count };
  }
  const st: State = { lines: readLines(ctx.root), stepper, cache: new Map(), flashes: new WeakMap(), shown: null, asked: 0 };
  (states ??= new WeakMap()).set(ctx, st);
  const shown = (): boolean => st.shown !== null;
  ctx.keys.bind({ key: 'n', label: 'Next change', when: shown, run: () => step(ctx, st, 1) });
  ctx.keys.bind({ key: 'p', label: 'Previous change', when: shown, run: () => step(ctx, st, -1) });
}

/** The second phase (LD5): the day view's changes (info.only), shown at once, without a step. */
export async function after(ctx: FeatureContext): Promise<void> {
  if (!ctx.info.isDocument) return;
  // Without info.only there is nothing to show: '' is no sha, and showChanges asks nothing of the host for it.
  await showChanges(ctx, ctx.info.only ?? '', { what: ONLY_WHAT, jump: false });
}
