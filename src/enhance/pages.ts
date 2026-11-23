// Screen pages (reader mode LX6.2): a Kindle-like turn on top of the one scroll underneath. Active only while ctx.reader.mode() is
// `screens`, except the top band, which sends `menu` in `screens` and `scroll` and never while `off`. Nothing is drawn or measured
// until a turn; the listeners and keys check the mode first.
//
//   A turn          forward: the first line not wholly visible at the bottom edge (a caret at the edge, its line box) goes to the top of
//                   the reading area; back: the first wholly visible line below the pinned top becomes the first line below the bottom
//                   edge, then the top is snapped to a whole line. A block (image, figure, table row, code) met at the edge: its top is
//                   aligned, or, taller than the screen, the turn moves one screen less one line. A turn moves at least a third of a
//                   screen, else one screen less two lines. Instant (`behavior: 'instant'`), never smooth, reduced motion or not.
//                   A turn that moves nothing (forward at the bottom, back at the top) changes nothing: no band, no new place.
//   The top         the lowest bottom edge among the elements stuck at the top (computed sticky or fixed, over the text column, at their
//                   own offset: a table head, a figure's tools, a card's head; not overlays at z-index 1000 and up, not what lets
//                   pointers through), measured before the scroll and again after it (a table head pins only once the table reaches
//                   the top); the target is corrected once.
//   The band        one element of the reader's ground over the line the bottom edge cuts, from its top to the bottom, until the next
//                   scroll; drawn only when that line's top is inside the reading area and the line is under a third of a screen, so a
//                   block stepped through is never covered. It lets pointers through, so a caret at the edge sees the line under it.
//   Taps, Figure 4  a primary pointer up within 10 px and 500 ms of its down; not on an interactive target (`interactive`), not with a
//                   non-empty selection (now, or when the press began), not while an overlay is open (when the press began: it may be that press which closes it). The top band (the top 15% of
//                   the view, at least 48 px) sends `menu`; the left third turns back, the rest forward.
//   Swipes          touch, at least 48 px, at least twice as wide as tall, under 600 ms: right to left forward, left to right back; not
//                   from inside a box that scrolls sideways (a wide table, a block of code), whose own scroll it is.
//   Keys            ArrowRight, PageDown, Space forward; ArrowLeft, PageUp, Shift+Space back (unlisted); a key on an interactive target
//                   or with Shift (but Space) is the browser's.
//   After a layout  a resize, a rotation, a width or face change (the relayout reasons resize and prefs): the place the reader held
//                   before the change (nav's anchor, noted at each scroll that stopped, each turn and the mode change) is restored after
//                   layout and the top snapped to a whole line.
//
// Made by the lifecycle (createPages), with the other shared services, so it is in every layout's bundle (reader mode reads only in the default).
// The caret is caretPositionFromPoint, or caretRangeFromPoint where only that exists (WebKit). Standard files, slug `pages`:
// test/browser/frame-pages.test.ts (real browsers, in the default layout).
import type { Cancel } from './env.js';
import { chrome } from './journal.js';
import { placeOf, type Anchor } from './nav.js';
import type { FeatureContext } from './types.js';

/** A tap: at most this far and this long. */
const TAP_PX = 10;
const TAP_MS = 500;
/** A swipe: at least this far, under this long. */
const SWIPE_PX = 48;
const SWIPE_MS = 600;
/** The top band: the larger of this many px and this share of the view. */
const BAND_PX = 48;
const BAND_SHARE = 0.15;
/** Overlays sit at this z-index and above (the stylesheet's); nothing at or above it is pinned text chrome. */
const OVERLAY_Z = 1000;
/** How long scrolling must stop before the place is noted, in milliseconds. */
const IDLE_MS = 120;

/**
 * A line of text (`k` false) or a block (`k` true) at a point: its top and bottom in the viewport and its line height; `n` is the
 * element that follows it when it ends its block (the gap before that element holds no line to find, and the element's top is
 * where the next page starts).
 */
interface Item {
  readonly t: number;
  readonly b: number;
  readonly k: boolean;
  readonly lh: number;
  readonly n: Element | null;
}

interface Caret {
  caretPositionFromPoint?(x: number, y: number): { readonly offsetNode: Node; readonly offset: number } | null;
  caretRangeFromPoint?(x: number, y: number): Range | null;
}

/** Make the service for one instance (see the header); the lifecycle calls it before any feature builds. */
export function createPages(ctx: FeatureContext): void {
  const { root, journal, env, reader, overlays, keys, events } = ctx;
  const doc = root.ownerDocument;
  const place = placeOf(ctx.nav);
  const on = (): boolean => reader.mode() === 'screens';
  /** What a tap, a swipe or a key leaves to the control (one selector list; Mermaid's Render button is a button). */
  const interactive = (n: EventTarget | null): boolean =>
    (n as Element | null)?.closest?.('a[href],button,summary,input,select,textarea,label,[role=button],[role=menu],[role=dialog],[tabindex]:not([tabindex="-1"]),.tools,.tbl-tools,.xcard') != null;
  const selected = (): boolean => doc.getSelection()?.isCollapsed === false;

  // ── the band
  let band: HTMLElement | null = null;
  let bandY = -1;
  const hide = (): void => {
    if (band !== null) journal.setAttribute(band, 'hidden', '');
    bandY = -1;
  };
  const show = (top: number): void => {
    if (band === null) {
      band = chrome(doc, 'div', { className: 'page-band', attrs: { hidden: '' } });
      journal.insert(band, root, null);
    }
    journal.setStyle(band, 'top', `${String(top)}px`);
    journal.setAttribute(band, 'hidden', null);
    bandY = env.viewport().scrollY;
  };

  /** The text column's left and right edges: those of a paragraph of the document's own, else of the root. */
  const column = (): { readonly l: number; readonly r: number } => {
    const c = (root.querySelector(':scope > p') ?? root).getBoundingClientRect();
    return c.width > 0 ? { l: c.left, r: c.right } : { l: 0, r: env.viewport().w };
  };

  // ── what is pinned at the top: the elements computed sticky or fixed, found again when the document's element count changes
  let stuck: { readonly n: number; readonly list: readonly Element[] } | null = null;
  const pinned = (): number => {
    const all = root.querySelectorAll('*');
    if (stuck === null || stuck.n !== all.length) stuck = { n: all.length, list: Array.from(all).filter((e) => /^(?:sticky|fixed)$/.test(env.computed(e, 'position'))) };
    const { l, r } = column();
    let m = 0;
    for (const e of stuck.list) {
      const b = e.getBoundingClientRect();
      const s = (p: string): string => env.computed(e, p);
      if (b.right <= l || b.left >= r || !(Math.abs(b.top - parseFloat(s('top'))) < 1.5) || Number(s('z-index')) >= OVERLAY_Z || s('pointer-events') === 'none') continue;
      m = Math.max(m, b.bottom, ...Array.from(e.children, (c) => c.getBoundingClientRect().bottom));
    }
    return m;
  };

  // ── the line or block at a height of the viewport
  const lhOf = (el: Element): number => parseFloat(env.computed(el, 'line-height')) || (parseFloat(env.computed(el, 'font-size')) || 16) * 1.4;
  const at1 = (x: number, y: number): Item | null => {
    const el = env.elementFromPoint(x, y);
    if (el === null) return null;
    const blk = el.closest('img,figure,tr,pre');
    if (blk !== null) {
      const r = blk.getBoundingClientRect();
      return { t: r.top, b: r.bottom, k: true, lh: lhOf(blk), n: blk.nextElementSibling };
    }
    const d = doc as unknown as Caret;
    const p = d.caretPositionFromPoint?.(x, y);
    const q = p == null ? d.caretRangeFromPoint?.(x, y) : null;
    const node = (p?.offsetNode ?? q?.startContainer) as Text | undefined;
    const off = p?.offset ?? q?.startOffset ?? 0;
    if (node?.nodeType !== 3 || node.parentElement === null) return null;
    // the line box: lines tile the block's content box at its line height, so the character's middle names its line
    let bl = node.parentElement;
    while (/^inline/.test(env.computed(bl, 'display')) && bl.parentElement !== null) bl = bl.parentElement;
    const lh = lhOf(bl);
    const px = (p: string): number => parseFloat(env.computed(bl, p)) || 0;
    const ct = bl.getBoundingClientRect().top + px('padding-top') + px('border-top-width');
    if (off >= node.length) return null; // the end of the text: a short last line, where the column's edge finds it
    const g = doc.createRange();
    g.setStart(node, off);
    g.setEnd(node, off + 1);
    const r = g.getClientRects()[0];
    if (r === undefined || r.height === 0) return null;
    const t = ct + Math.floor((r.top + r.height / 2 - ct) / lh) * lh;
    const end = bl.getBoundingClientRect().bottom - px('padding-bottom') - px('border-bottom-width');
    return y >= t - 0.5 && y < t + lh + 0.5 ? { t, b: t + lh, k: false, lh, n: t + lh >= end - 1 ? bl.nextElementSibling : null } : null;
  };

  /** The line or block at height `y`: read in the middle of the view, and at the column's left edge where a block there is narrower (an image). */
  const at = (y: number): Item | null => {
    const x = env.viewport().w / 2;
    return at1(x, y) ?? at1(column().l + 8, y);
  };
  /** The first line or block from `y` on in steps of `s` px (a gap between blocks holds none): up to ten steps. */
  const find = (y: number, s: number): Item | null => {
    for (let i = 0; i < 10; i += 1) {
      const it = at(y + i * s);
      if (it !== null) return it;
    }
    return null;
  };

  // ── the place, noted when scrolling stops (a turn notes it too), so a layout change finds where the reader was before it
  let last: Anchor | null = null;
  let idle: Cancel | null = null;
  const note = (): void => {
    if (on()) last = place.anchor();
  };
  /** The scroll listener, added when reader mode is first on (an instance that never reads in it hears no scroll). */
  let listening = false;
  const listen = (): void => {
    if (listening) return;
    listening = true;
    env.onScroll(() => {
      if (band !== null && bandY >= 0 && Math.abs(env.viewport().scrollY - bandY) > 0.5) hide();
      idle?.();
      idle = env.timeout(note, IDLE_MS);
    });
  };

  // ── a turn
  /** Scroll to `y`, rounded down: a scroll position is whole pixels, and the line then lands at or just below its mark, never cut by it. */
  const go = (y: number): void => {
    env.scrollTo(Math.floor(y), 'instant');
  };
  /** Show the whole line the top edge cuts (a block is stepped through, never snapped). */
  const snap = (): void => {
    const t = pinned();
    const it = at(t + 2);
    if (it !== null && !it.k && it.t < t - 0.5) go(env.viewport().scrollY + it.t - t);
  };
  const turn = (dir: 1 | -1): void => {
    const { h, scrollY } = env.viewport();
    const t0 = pinned();
    const area = h - t0;
    let it: Item | null;
    let d: number | null = null;
    if (dir > 0) {
      it = find(h - 1, -6);
      if (it !== null) d = it.b <= h + 1 ? Math.max(it.b, it.n?.getBoundingClientRect().top ?? 0) - t0 : it.k && it.t <= t0 + area / 3 && it.b - it.t > area ? area - it.lh : it.t - t0;
    } else {
      it = find(t0 + 2, 6);
      for (let i = 0; it !== null && it.t < t0 - 0.5 && i < 3; i += 1) {
        if (it.k && it.b - it.t > area) {
          d = it.lh - area;
          break;
        }
        it = find(it.b + 2, 6);
      }
      if (d === null && it !== null) d = it.t - h;
    }
    if (d === null || d * dir < h / 3) d = dir * Math.max(area - 2 * (it?.lh ?? 24), h / 3);
    go(scrollY + d);
    if (env.viewport().scrollY === scrollY) return; // the end, or the start: nothing moved, so nothing else changes
    const t1 = pinned();
    if (dir < 0) snap();
    else if (Math.abs(t0 - t1) > 0.5) go(scrollY + d + t0 - t1); // the target again, by the unrounded scroll
    const cut = at(h - 1);
    if (cut !== null && !cut.k && cut.b > h + 1 && cut.t >= pinned() && cut.b - cut.t < h / 3) show(cut.t);
    else hide();
    last = place.anchor();
  };

  // ── taps
  let down: { readonly x: number; readonly y: number; readonly t: number; readonly s: boolean } | null = null;
  // in the capture phase, so a menu that this very press closes is still open when it is read
  journal.listen(
    doc,
    'pointerdown',
    (ev) => {
      const e = ev as PointerEvent;
      down = reader.mode() !== 'off' && e.isPrimary && e.button === 0 && !interactive(e.target) ? { x: e.clientX, y: e.clientY, t: e.timeStamp, s: selected() || overlays.any() } : null;
    },
    true,
  );
  journal.listen(doc, 'pointerup', (ev) => {
    const e = ev as PointerEvent;
    const d = down;
    down = null;
    if (d === null || interactive(e.target) || d.s || selected() || Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_PX || e.timeStamp - d.t > TAP_MS) return;
    const { w, h } = env.viewport();
    if (e.clientY < Math.max(BAND_PX, h * BAND_SHARE)) reader.act('menu');
    else if (on()) turn(e.clientX < w / 3 ? -1 : 1);
  });

  // ── swipes
  let swipe: { readonly x: number; readonly y: number; readonly t: number } | null = null;
  /** Whether `n` is in a box that scrolls sideways. */
  const sideways = (n: Element | null): boolean => {
    for (; n !== null && root.contains(n); n = n.parentElement) if (n.scrollWidth > n.clientWidth + 1 && /^(?:auto|scroll)$/.test(env.computed(n, 'overflow-x'))) return true;
    return false;
  };
  journal.listen(
    doc,
    'touchstart',
    (ev) => {
      const e = ev as TouchEvent;
      const c = (e.touches as TouchList | undefined)?.[0];
      swipe = on() && c !== undefined && e.touches.length === 1 && !overlays.any() && !sideways(e.target as Element) ? { x: c.clientX, y: c.clientY, t: e.timeStamp } : null;
    },
    { passive: true },
  );
  journal.listen(doc, 'touchcancel', () => {
    swipe = null;
  });
  journal.listen(
    doc,
    'touchend',
    (ev) => {
      const e = ev as TouchEvent;
      const s = swipe;
      const c = (e.changedTouches as TouchList | undefined)?.[0];
      swipe = null;
      if (s === null || c === undefined) return;
      const dx = c.clientX - s.x;
      if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) >= 2 * Math.abs(c.clientY - s.y) && e.timeStamp - s.t < SWIPE_MS) turn(dx < 0 ? 1 : -1);
    },
    { passive: true },
  );

  // ── keys
  for (const [key, dir] of [['ArrowRight', 1], ['PageDown', 1], ['ArrowLeft', -1], ['PageUp', -1], [' ', 1]] as const) {
    keys.bind({
      key,
      label: 'Turn the page',
      listed: false,
      when: on,
      run: (e) => {
        if ((e.shiftKey && key !== ' ') || interactive(e.target)) return false;
        turn(key === ' ' && e.shiftKey ? -1 : dir);
      },
    });
  }

  // ── after a layout change, and when the mode changes
  events.on('relayout', (e) => {
    if (!on()) return;
    if (e.reasons.some((r) => r === 'resize' || r === 'prefs')) {
      if (last !== null) place.restore(last);
      snap();
      hide();
    }
    last = place.anchor();
  });
  events.on('reading', (mode) => {
    hide();
    if (mode !== 'off') {
      listen();
      last = place.anchor();
    }
  });
}
