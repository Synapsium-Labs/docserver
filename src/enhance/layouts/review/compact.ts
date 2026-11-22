// Compact rows (the reference's direction B, section 5): a table of six rows or more whose rows average over 240 characters
// gets rows clipped to a few lines until the reader opens them, one at a time with the button in the row's first cell, or all
// at once with "Open all rows" in the table's tools.
//
// The shared table modules have finished with the cells by the time this runs (they read them by position at build only), so
// the cell's children are moved into a chrome `div.cc` through the journal, which gives the clip a box to cut; teardown moves
// them back. Nothing the shared modules read afterwards is changed by the wrapper: the filter reads a row's text, the rail reads
// status pills by descendant query, and a preview card copies the cell's children (the button has no text and the card drops
// buttons). Whether a cell overflows is measured in the relayout run, reads first and then writes, as tables.ts does; a row that
// is open keeps the state it was last measured in, so its button stays to close it.
//
// Built after `tables`, `status`, `ids`, `xrefs` and `cards`. The stylesheet clips (review.css); on a phone, where rows stack
// as cards, nothing is clipped, so no row is ever marked clipped there.
import { chrome } from '../../journal.js';
import type { TableBlock } from '../../registry.js';
import type { FeatureContext } from '../../types.js';

/** A table is compact at this many rows, when its rows average more characters than the second. */
const ROWS_MIN = 6;
const AVERAGE_MIN = 240;

/** Build the compact rows. */
export function build(ctx: FeatureContext): void {
  const { journal } = ctx;
  const doc = ctx.root.ownerDocument;
  const tables = ctx.blocks.filter(
    (b): b is TableBlock =>
      b.kind === 'table' && b.rows.length >= ROWS_MIN && b.rows.reduce((sum, r) => sum + (r.textContent ?? '').length, 0) / b.rows.length > AVERAGE_MIN,
  );
  const cells = new Map<HTMLTableRowElement, HTMLElement[]>();
  const buttons = new Map<HTMLTableRowElement, HTMLButtonElement>();
  const setRow = (row: HTMLTableRowElement, open: boolean): void => {
    journal.toggleClass(row, 'rv-open', open);
    journal.setAttribute(buttons.get(row) as HTMLButtonElement, 'aria-expanded', open ? 'true' : 'false');
  };
  for (const t of tables) {
    journal.toggleClass(t.el, 'rv-compact', true);
    for (const row of t.rows) {
      const wrapped: HTMLElement[] = [];
      for (const cell of Array.from(row.cells)) {
        // An empty cell has nothing to clip.
        if (cell.firstChild === null) continue;
        const cc = chrome(doc, 'div', { className: 'cc' });
        journal.wrap(Array.from(cell.childNodes), cc);
        wrapped.push(cc);
      }
      cells.set(row, wrapped);
      const id = ctx.text.clip((row.cells[0]?.textContent ?? '').replace(/\s+/g, ' ').trim(), 40);
      const button = chrome(doc, 'button', { className: 'rx', attrs: { type: 'button', 'aria-expanded': 'false', 'aria-label': `Open row ${id}` } });
      buttons.set(row, button);
      journal.insert(button, row.cells[0] as HTMLTableCellElement, row.cells[0]?.firstChild ?? null);
      journal.listen(button, 'click', () => setRow(row, !row.classList.contains('rv-open')));
    }
    const all = chrome(doc, 'button', { className: 'rv-all', text: 'Open all rows', attrs: { type: 'button', 'aria-pressed': 'false' } });
    journal.listen(all, 'click', () => {
      const on = all.getAttribute('aria-pressed') !== 'true';
      journal.setAttribute(all, 'aria-pressed', on ? 'true' : 'false');
      for (const row of t.rows) setRow(row, on);
    });
    const hint = chrome(doc, 'span', { className: 'rv-hint', text: 'Long rows are clipped; open a row to read it.' });
    // The filter's tools when the table has a filter (twelve rows or more), else a bar of its own.
    if (t.filter === null) journal.insert(chrome(doc, 'div', { className: 'tbl-tools' }, [hint, all]), t.el.parentElement as Element, t.el);
    else {
      const tools = t.filter.parentElement as Element;
      journal.insert(hint, tools, null);
      journal.insert(all, tools, null);
    }
  }
  ctx.onRelayout(() => {
    const rows = tables.flatMap((t) => t.rows).filter((r) => !r.classList.contains('rv-open'));
    const read = rows.map((r) => (cells.get(r) as HTMLElement[]).map((cc) => cc.scrollHeight > cc.clientHeight + 2));
    rows.forEach((r, i) => {
      const flags = read[i] as boolean[];
      (cells.get(r) as HTMLElement[]).forEach((cc, j) => journal.toggleClass(cc, 'over', flags[j] === true));
      journal.toggleClass(r, 'rv-clipped', flags.some(Boolean));
    });
  });
}
