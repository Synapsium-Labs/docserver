// Tables: bullet cells, the filter and the measured widths (the reference layout, section 8, before its status marks;
// docserver L2 Task 10). The tables are ctx.blocks' (registry.ts): each `div.table-wrapper` with its table, in
// document order.
//
// Built in build(), before the status marks (status.ts, the next step):
//   - Bullet cells. A body cell (`td`) with a `<br>` among its children is read as lines: the runs of its nodes between
//     the `<br>`s. Each run that holds anything (an element, or text that is not white space) is a line, and the
//     cell's nodes are moved into one `span.cell-line` per line (journal.wrap), in order, so the lines are the cell's
//     only children and sit next to each other, as `.cell-line + .cell-line` asks. A run with nothing in it, and the
//     `<br>`s, join the line before them (the first line takes what comes before it). A line whose text opens on a
//     bullet (`•`, `·`, `▪` or `-`, then white space) takes the class `b`, and the bullet, with the white space around
//     it, is split off its text (journal.split) and kept in the line as hidden chrome (`span.cell-bullet[hidden]`),
//     which the status marks read past. The reference removed the bullet's characters and the `<br>`s; here no source
//     node is removed: each `<br>` stays where it was, in a hidden chrome span of its own (`span.cell-br[hidden]`), so
//     it breaks no line (the lines do). The cell's text, read by textContent, is unchanged.
//   - The filter, on a table of FILTER_MIN_ROWS body rows or more: a search field and a live count above the table,
//     in `div.tbl-tools`, the two together with the table's wrapper in `div.tbl-block` (with `cols-2` when the table
//     has two columns). What is typed, trimmed and in any case, is looked for in each body row's text; a row without
//     it gets a journaled `hidden`, and the count reads "<shown> of <rows>" (empty with nothing typed). Only the rows
//     the filter hid are shown again, so a row another feature hid stays hidden. The field is the table's
//     `blocks[].filter`. Revealing an element of a row the filter hid clears the filter (ctx.onReveal), as the
//     reference's navigation did.
// Measured on every relayout (ctx.onRelayout; relayout.ts runs the first at startup's first frame, then on resize,
// prefs, folds, fonts and the rest), all reads first, then all writes, so its reads cost one layout: `fits` drops
// first (it changes the wrapper's overflow); then, per table, whether the table fits its wrapper (its scroll width at
// most the wrapper's client width plus 1) and its head's height; then `fits` again where it does, `--thead-h` (the
// head's height in px, through journal.setStyle) and, on a table that does not fit, a labelled region the keyboard
// reaches (tabindex 0, role region, "Table N, scrolls sideways: <the first three headers>", each header clipped to
// HEAD_LABEL_MAX). A table that stacks into cards on a phone (`stack`, status.ts) is not a region there: its cards
// fit. The phone is a viewport of PHONE_MAX_W px or less (env.viewport().w), as the stylesheet's
// `@media (max-width: 700px)` reads it. A table that fits again loses the region. While the root has no layout box
// (`display: none` on it or around it: no client rects), every size reads 0, so nothing is measured or written and
// what was measured before stays; the next relayout once it is shown measures it (a window resize, a change of the
// prefs, a fold: relayout.ts has no trigger for the root's own size).
//
// Writes go through the journal, so destroy undoes them: the lines and hidden spans are unwrapped and the bullets
// joined to their text again, the filter's hidden rows shown, the classes, the style and the region attributes put
// back. The field, the count and the blocks are chrome and go with the journal.
//
// Standard files, slug `blocks`: test/enhance-blocks.test.ts, test/browser/blocks.test.ts and the Level 2 cases in
// conformance/layout/blocks/. Registered in features.ts, whose header says where in the build order and why.
import { chrome, type Journal } from './journal.js';
import type { TableBlock } from './registry.js';
import type { FeatureContext } from './types.js';

/** A table of this many body rows or more gets a filter (the reference layout's). */
const FILTER_MIN_ROWS = 12;

/** The widest viewport that is a phone, in px: the stylesheet's `@media (max-width: 700px)`. */
const PHONE_MAX_W = 700;

/** The most a header gives a table region's label, in code units (ctx.text.clip). */
const HEAD_LABEL_MAX = 80;

/** A bullet a cell's line may open with, and the white space around it, as the reference stripped it. */
const BULLET = /^\s*[•·▪-]\s+/;

const isBr = (n: Node): boolean => n.nodeType === 1 && (n as Element).localName === 'br';

/** A run of a cell's nodes holds something: an element, or text that is not white space. */
const holds = (run: readonly Node[]): boolean => run.some((n) => n.nodeType === 1 || (n.textContent ?? '').trim() !== '');

/** Split one cell into its lines (see the header); a cell with no `<br>` among its children is left alone. */
function cellLines(journal: Journal, doc: Document, td: HTMLTableCellElement): void {
  const kids = Array.from(td.childNodes);
  if (!kids.some(isBr)) return;
  const runs: Node[][] = [[]];
  for (const n of kids) {
    if (isBr(n)) runs.push([]);
    else (runs[runs.length - 1] as Node[]).push(n);
  }
  for (const n of kids) {
    if (isBr(n)) journal.wrap([n], chrome(doc, 'span', { className: 'cell-br', attrs: { hidden: '' } }));
  }
  const lines = runs.filter(holds);
  /** Where each line starts, once its bullet is split off; and whether it opened on one. */
  const starts: Node[] = [];
  const bullets: boolean[] = [];
  for (const run of lines) {
    const first = run[0] as Node;
    const m = first.nodeType === 3 ? BULLET.exec((first as Text).data) : null;
    if (m === null) {
      starts.push(first);
      bullets.push(false);
      continue;
    }
    const text = first as Text;
    if (m[0].length < text.data.length) journal.split(text, m[0].length);
    const mark = chrome(doc, 'span', { className: 'cell-bullet', attrs: { hidden: '' } });
    journal.wrap([text], mark);
    starts.push(mark);
    bullets.push(true);
  }
  lines.forEach((_, j) => {
    const from = j === 0 ? td.firstChild : starts[j];
    const stop = starts[j + 1] ?? null;
    const nodes: Node[] = [];
    for (let n: Node | null = from ?? null; n !== null && n !== stop; n = n.nextSibling) nodes.push(n);
    journal.wrap(nodes, chrome(doc, 'span', { className: bullets[j] === true ? 'cell-line b' : 'cell-line' }));
  });
}

/** The filter of one table (see the header); its revealer's part: the rows it hid. */
function addFilter(ctx: FeatureContext, t: TableBlock, hiddenBy: Map<Element, () => void>): void {
  const { journal } = ctx;
  const doc = ctx.root.ownerDocument;
  const n = t.rows.length;
  const count = chrome(doc, 'span', { attrs: { 'aria-live': 'polite' } });
  const input = chrome(doc, 'input', { attrs: { type: 'search', placeholder: `Filter ${String(n)} rows`, 'aria-label': `Filter this table's ${String(n)} rows` } });
  const block = chrome(doc, 'div', { className: t.heads.length === 2 ? 'tbl-block cols-2' : 'tbl-block' });
  journal.wrap([t.el], block);
  journal.insert(chrome(doc, 'div', { className: 'tbl-tools' }, [count, input]), block, t.el);
  t.filter = input;
  /** The rows this filter hid. */
  const hid = new Set<Element>();
  const apply = (): void => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    for (const r of t.rows) {
      const ok = (r.textContent ?? '').toLowerCase().includes(q); // every text holds the empty one
      if (ok) {
        shown += 1;
        if (hid.delete(r)) {
          hiddenBy.delete(r);
          if (r.getAttribute('hidden') === '') journal.setAttribute(r, 'hidden', null);
        }
      } else if (!r.hasAttribute('hidden')) {
        journal.setAttribute(r, 'hidden', '');
        hid.add(r);
        hiddenBy.set(r, clear);
      }
    }
    count.textContent = q === '' ? '' : `${String(shown)} of ${String(n)}`;
  };
  const clear = (): void => {
    input.value = '';
    apply();
  };
  journal.listen(input, 'input', apply);
}

/** What a table's measure decides: its region, from whether it fits, whether it stacks and whether this is a phone. */
function tableScrolls(fits: boolean, stack: boolean, phone: boolean): boolean {
  return !fits && (!stack || !phone);
}

/** Measure every table again (see the header): reads first, then writes; nothing while the root has no layout box. */
function measure(ctx: FeatureContext, tables: readonly TableBlock[]): void {
  const { journal } = ctx;
  // A document with no table reads nothing: the root's box is read only when there is a table to measure.
  if (tables.length === 0 || ctx.root.getClientRects().length === 0) return;
  for (const t of tables) if (t.el.classList.contains('fits')) journal.toggleClass(t.el, 'fits', false);
  const read = tables.map((t) => ({ fits: t.table.scrollWidth <= t.el.clientWidth + 1, headH: t.table.tHead?.offsetHeight ?? 0 }));
  const phone = ctx.env.viewport().w <= PHONE_MAX_W;
  tables.forEach((t, i) => {
    const { fits, headH } = read[i] as { fits: boolean; headH: number };
    journal.toggleClass(t.el, 'fits', fits);
    journal.setStyle(t.el, '--thead-h', `${String(headH)}px`);
    if (tableScrolls(fits, t.el.classList.contains('stack'), phone)) {
      const heads = t.heads.length > 0 ? `: ${t.heads.slice(0, 3).map((h) => ctx.text.clip(h, HEAD_LABEL_MAX)).join(', ')}` : '';
      journal.setAttribute(t.el, 'tabindex', '0');
      journal.setAttribute(t.el, 'role', 'region');
      journal.setAttribute(t.el, 'aria-label', `Table ${String(i + 1)}, scrolls sideways${heads}`);
    } else if (t.el.getAttribute('role') === 'region') {
      journal.setAttribute(t.el, 'tabindex', null);
      journal.setAttribute(t.el, 'role', null);
      journal.setAttribute(t.el, 'aria-label', null);
    }
  });
}

/** Build this feature during startup: the bullet cells and the filters now, the measures on every relayout. */
export function build(ctx: FeatureContext): void {
  const tables = ctx.blocks.filter((b): b is TableBlock => b.kind === 'table');
  const doc = ctx.root.ownerDocument;
  // The body rows' cells: render() writes a body cell as a `td`, as the reference read it.
  for (const t of tables) for (const r of t.rows) for (const c of Array.from(r.cells)) cellLines(ctx.journal, doc, c);
  /** Each row a filter hid, and that filter's clear. */
  const hiddenBy = new Map<Element, () => void>();
  for (const t of tables) if (t.rows.length >= FILTER_MIN_ROWS) addFilter(ctx, t, hiddenBy);
  ctx.onReveal((el) => {
    const tr = el.closest('tr');
    if (tr !== null) hiddenBy.get(tr)?.();
  });
  ctx.onRelayout(() => {
    measure(ctx, tables);
  });
}
