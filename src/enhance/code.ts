// Code blocks: Copy buttons and widths (the reference layout, section 9; docserver L2 Task 10). The blocks are
// ctx.blocks' code blocks (registry.ts): each `div.codehilite` of the document outside a figure, in document order.
//
// Copy, built in build(), only when the host gave `copy` (host.present): a `button.code-copy` ("Copy", labelled "Copy
// this code") first in the block, outside the code; on a block of more than TALL_LINES line breaks, a second one at its
// foot (`.end`, "Copy this code (from its foot)") and the class `tall`, which leaves room for it. A click hands the
// code's text (the `pre`'s textContent, read then) to host.copy; the label reads "Copied" once the host's copy
// returned or fulfilled, "Failed" when it threw, rejected or was not called, and "Copy" again COPY_LABEL_MS later (one
// timer per button, through env.timeout, so destroy clears it). Only the reply to a button's latest click writes its
// label: an older copy that settles later, failed say, changes nothing. The label is written inside an operation of
// the instance (ctx.operate), so a copy that settles once the instance is not live writes nothing (RF5).
//
// Widths, measured on every relayout (ctx.onRelayout), as the reference's sizing did: a block whose longest line is
// wider than the reading column takes the class `long` (the stylesheet then lets it take the wide width), and a block
// that still does not fit scrolls sideways, so its `pre` is a labelled region the keyboard reaches (tabindex 0, role
// region, "Code block N, scrolls sideways"), which it loses once it fits. `long` is an estimate: the line is measured
// as text, never laid out: its characters (a tab counts TAB_WIDTH) times the width of one character of the code's
// face, measured on a canvas through env.textWidth (CHAR_W_FALLBACK px without a finite width above 0), plus
// CODE_PAD. The region is the layout's once `long` is written: a `pre` with a layout box is a region when it really
// scrolls (its scroll width more than its client width plus 1), as the reference's check once the layout was real
// did, so a line of wide characters (about one em each, twice the estimate's character) is reached too; a `pre` with
// no box (in a folded section, say) keeps the estimate's answer. So a relayout reads the room, writes `long`, reads
// the pres' widths (one layout), then writes the regions. The room:
//   - the root's final content-box width (its client width less its padding), after any contents-rail reservation in
//     the root padding;
//   - the column: the stylesheet's measure for the prefs (COLUMN_REM rem, less SANS_REM for the sans face), at most
//     that room; LIST_INDENT px less in a list item. The rem is the root's `--rem` when it is a length in px; else the
//     code's computed size (always in px) over CODE_REM, since the stylesheet sets it at CODE_REM rem, so a host's
//     `1.25rem` counts as what it resolves to; else REM_PX. The canvas measures in the code's computed size too;
//   - the wide width: WIDE_PX for the prefs' width, at most that room.
// A phone is a viewport of PHONE_MAX_W px or less (env.viewport().w), as the stylesheet's `@media (max-width: 700px)`
// reads it: there a block's estimate scrolls when it is long, and elsewhere when it is long and needs more than the
// wide width. Each of these numbers is the stylesheet's or the reference's, and a test holds each to it.
// While the root has no layout box (`display: none` on it or around it: no client rects), nothing is measured or
// written and what was measured before stays; the next relayout once it is shown measures it (relayout.ts has no
// trigger for the root's own size).
//
// Writes go through the journal, so destroy undoes them; the buttons are chrome and go with the journal.
//
// Standard files, slug `blocks`: test/enhance-blocks.test.ts, test/browser/blocks.test.ts and the Level 2 cases in
// conformance/layout/blocks/. Registered in features.ts, whose header says where in the build order and why.
import type { Cancel } from './env.js';
import { chrome } from './journal.js';
import type { CodeBlock } from './registry.js';
import type { FeatureContext, Prefs } from './types.js';

/** How long "Copied" or "Failed" shows before the label reads "Copy" again, in milliseconds (the reference's). */
const COPY_LABEL_MS = 1400;

/** A block of more line breaks than this gets a second Copy at its foot (the reference's). */
const TALL_LINES = 36;

/** The widest viewport that is a phone, in px: the stylesheet's `@media (max-width: 700px)`. */
const PHONE_MAX_W = 700;

/** The reading column, in rem, by the prefs' width: the stylesheet's `--measure`. */
const COLUMN_REM: Readonly<Record<Prefs['width'], number>> = { standard: 44, wide: 52 };

/** What the sans face takes off the column, in rem: the stylesheet's `--measure` under `data-font="sans"`. */
const SANS_REM = 2;

/** The wide width, in px, by the prefs' width: the stylesheet's `--wide`. */
const WIDE_PX: Readonly<Record<Prefs['width'], number>> = { standard: 1120, wide: 1200 };

/** The layout's rem, in px, when the root's `--rem` is not a length in px: the stylesheet's. */
const REM_PX = 16;

/** The code's size, in rem: the stylesheet's `.codehilite pre`. */
const CODE_REM = 0.78;

/** The code's faces: the stylesheet's `--mono`. */
const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';

/** One character's width, in px, when there is no canvas to measure it on (the reference's). */
const CHAR_W_FALLBACK = 7.5;

/** What a line needs beyond its characters, in px: the block's padding, as the reference reckoned it. */
const CODE_PAD = 42;

/** How much less room a block in a list item has, in px (the reference's). */
const LIST_INDENT = 48;

/** How many characters a tab counts (the reference's: itself and 7 more). */
const TAB_WIDTH = 8;

/** The text measured for one character's width: 40 digits. */
const SAMPLE = '0123456789012345678901234567890123456789';

/** The room a relayout measures the blocks against. */
interface CodeRoom {
  /** The viewport's width. */
  readonly w: number;
  /** The root's final content-box width. */
  readonly box: number;
  readonly prefs: Readonly<Pick<Prefs, 'width' | 'font'>>;
  /** The layout's rem, in px. */
  readonly rem: number;
  /** One character's width, in px. */
  readonly charW: number;
}

/** The characters of a code text's longest line, a tab counting TAB_WIDTH. */
function longestLine(text: string): number {
  let most = 0;
  for (const line of text.split('\n')) {
    const tabs = line.split('\t').length - 1;
    const n = line.length + tabs * (TAB_WIDTH - 1);
    if (n > most) most = n;
  }
  return most;
}

/** Whether a block of `chars` characters is long, and whether it scrolls sideways, in `room` (see the header). */
function codeFit(room: CodeRoom, chars: number, inList: boolean): { readonly long: boolean; readonly scrolls: boolean } {
  const phone = room.w <= PHONE_MAX_W;
  const avail = room.box;
  const measure = COLUMN_REM[room.prefs.width] - (room.prefs.font === 'sans' ? SANS_REM : 0);
  const col = Math.min(measure * room.rem, avail);
  const wide = Math.min(WIDE_PX[room.prefs.width], avail);
  const fits = inList ? col - LIST_INDENT : col;
  const need = chars * room.charW + CODE_PAD;
  const long = need > fits;
  // The reference's question, `need > (long ? wide : fits)` off a phone and `need > fits` on one: a block that is not
  // long never scrolls, even where the column is wider than the wide width (a large --rem).
  return { long, scrolls: long && (phone || need > wide) };
}

/** A computed length in px, or null when the value is not one. */
function px(value: string): number | null {
  const m = /^(-?\d*\.?\d+)px$/.exec(value);
  return m === null ? null : Number(m[1]);
}

/** `n` to a thousandth. */
const thousandths = (n: number): number => Math.round(n * 1000) / 1000;

/** A length in px above 0, or null. */
function positive(value: string): number | null {
  const n = px(value);
  return n !== null && n > 0 ? n : null;
}

/** Read the room now: the viewport, final root box, prefs, rem and code character (see the header). */
function readRoom(ctx: FeatureContext, pre: HTMLPreElement): CodeRoom {
  const { root, env } = ctx;
  const w = env.viewport().w;
  const box = root.clientWidth - (px(env.computed(root, 'padding-left')) ?? 0) - (px(env.computed(root, 'padding-right')) ?? 0);
  const remRead = positive(env.computed(root, '--rem'));
  const size = positive(env.computed(pre, 'font-size'));
  const rem = remRead ?? (size === null ? REM_PX : thousandths(size / CODE_REM));
  const width = env.textWidth(SAMPLE, `${String(size ?? thousandths(CODE_REM * rem))}px ${MONO}`);
  const charW = width !== null && Number.isFinite(width) && width > 0 ? width / SAMPLE.length : CHAR_W_FALLBACK;
  const { width: pw, font } = ctx.state.prefs;
  return { w, box, prefs: { width: pw, font }, rem, charW };
}

/** Whether a list item holds `el`: its ancestors up to the root, never past it. */
function inList(el: Element, root: Element): boolean {
  for (let n = el.parentElement; n !== null && n !== root; n = n.parentElement) if (n.localName === 'li') return true;
  return false;
}

/** The two Copy buttons of a block (see the header). */
function addCopy(ctx: FeatureContext, c: CodeBlock, pre: HTMLPreElement): void {
  const { journal } = ctx;
  const doc = ctx.root.ownerDocument;
  const button = (end: boolean): HTMLButtonElement => {
    const b = chrome(doc, 'button', {
      className: end ? 'code-copy end' : 'code-copy',
      text: 'Copy',
      attrs: { type: 'button', 'aria-label': end ? 'Copy this code (from its foot)' : 'Copy this code' },
    });
    let reset: Cancel | null = null;
    /** The number of this button's latest click: only its reply writes the label. */
    let clicks = 0;
    journal.listen(b, 'click', () => {
      clicks += 1;
      const click = clicks;
      void ctx.host.copy(pre.textContent ?? '').then((answer) => {
        ctx.operate(() => {
          if (click !== clicks) return;
          b.textContent = answer === undefined ? 'Copied' : 'Failed';
          reset?.();
          reset = ctx.env.timeout(() => {
            reset = null;
            b.textContent = 'Copy';
          }, COPY_LABEL_MS);
        });
      });
    });
    return b;
  };
  journal.insert(button(false), c.el, c.el.firstChild);
  if (((pre.textContent ?? '').match(/\n/g) ?? []).length > TALL_LINES) {
    journal.insert(button(true), c.el, null);
    journal.toggleClass(c.el, 'tall', true);
  }
}

/** One block as the relayout sizes it. */
interface Sized {
  readonly c: CodeBlock;
  readonly pre: HTMLPreElement;
  /** Its number among the document's code blocks, from 1. */
  readonly no: number;
  readonly chars: number;
  readonly inList: boolean;
}

/** Size every block again (see the header): the room, then `long`, then the layout, then the regions. */
function size(ctx: FeatureContext, blocks: readonly Sized[]): void {
  const { journal } = ctx;
  const first = blocks[0];
  if (first === undefined || ctx.root.getClientRects().length === 0) return;
  const room = readRoom(ctx, first.pre);
  const fit = blocks.map((b) => codeFit(room, b.chars, b.inList));
  blocks.forEach((b, i) => {
    journal.toggleClass(b.c.el, 'long', fit[i]?.long === true);
  });
  const scrolls = blocks.map((b, i) => (b.pre.getClientRects().length === 0 ? fit[i]?.scrolls === true : b.pre.scrollWidth > b.pre.clientWidth + 1));
  blocks.forEach((b, i) => {
    if (scrolls[i] === true) {
      journal.setAttribute(b.pre, 'tabindex', '0');
      journal.setAttribute(b.pre, 'role', 'region');
      journal.setAttribute(b.pre, 'aria-label', `Code block ${String(b.no)}, scrolls sideways`);
    } else if (b.pre.getAttribute('role') === 'region') {
      journal.setAttribute(b.pre, 'tabindex', null);
      journal.setAttribute(b.pre, 'role', null);
      journal.setAttribute(b.pre, 'aria-label', null);
    }
  });
}

/** Build this feature during startup: the Copy buttons now, the widths on every relayout. */
export function build(ctx: FeatureContext): void {
  const codes = ctx.blocks.filter((b): b is CodeBlock => b.kind === 'code');
  const sized: Sized[] = [];
  codes.forEach((c, i) => {
    if (c.pre !== null) sized.push({ c, pre: c.pre, no: i + 1, chars: longestLine(c.pre.textContent ?? ''), inList: inList(c.el, ctx.root) });
  });
  if (ctx.host.present.has('copy')) for (const b of sized) addCopy(ctx, b.c, b.pre);
  ctx.onRelayout(() => {
    size(ctx, sized);
  });
}
