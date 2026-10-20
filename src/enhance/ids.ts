// IDs: lettered sections and ID rows (the reference layout, sections 6 and 8), on by default. Built by L2 Task 9.
//
// Consumes ctx.vocab (the ID grammar `vocab.id`, the title-column header words `vocab.titleHeader`), the section
// numbers editorial.ts hung (`span.sec-no`), the status marks (status.ts, built before this step: an ID row's status
// is the role of its last pill) and ctx.blocks. Produces index entries of kinds 'section' and 'row', blocks[].isIndex
// and section 8's class `idcell`. Writes no ids (LD6): a row or a section is found through the index, so a link to
// `#R14` goes to its row through nav.byId.
//
// Section 6, lettered sections: a level-2 heading with an id whose hanging number opens on capitals and a digit
// ("F1. Search" shows `span.sec-no` "F1") defines that number: `{ kind: 'section', title: the heading's text after its
// number (clipped to 90), status: null, group, target: the heading }`, where the group is the text (after its number)
// of the last level-2 heading with an id before it that is not lettered, or "Sections" before any. They are defined
// before the rows, as the reference did, so a row that repeats a section's number never takes it.
//
// Section 8, ID rows, for each table (ctx.blocks): a first cell opens on an ID when its text, read without hidden
// chrome (a bullet the tables step split off), starts with one, followed by its end, white space or , . : ; ). A table
// of two rows or more whose first cells open on an ID in at least 60% of its rows is an index of definitions
// (`isIndex`), and each row whose first cell opens on an ID defines it; in any other table, a row whose first cell is
// exactly an ID of 10 characters or fewer does. Such a first cell takes the class `idcell`, and the row is defined, the
// first definition winning (a rule's or a section's ID is theirs): `{ kind: 'row', title, status, group, target: the
// row, row: the row, heads: the table's header texts }`, where
//   - the title (clipped to 90) is the first cell's text after the ID (and any white space, comma, colon, full stop or
//     dash) when that holds more than two characters and does not open on an ID; else the text of the first column,
//     after the first, whose header opens on a title word; else the second cell's;
//   - the status is the colour role of the row's last pill (a chrome `.pill`, which carries the status words), or null;
//   - the group is the text, after its number, of the nearest level-2 or level-3 heading with an id before the table,
//     looking at the table's earlier siblings and then its ancestors' (a box of "In short" or "Where things stand"
//     counts by its heading), or "Index" when there is none.
// An ID longer than the index takes (200 code units) marks its cell but is not defined.
//
// Standard files, slug `ids`: test/enhance-ids.test.ts, test/browser/ids.test.ts and conformance/layout/ids/.
// Registered in features.ts, whose header says where in the build order and why.
import { CHROME_ATTR } from './journal.js';
import { NAME_MAX } from './registry.js';
import { clip } from './text.js';
import type { FeatureContext } from './types.js';
import type { StatusRole } from './vocab.js';

/** A section number at the start of a heading's text: "3. ", "F1. ", "4b. ". */
const SEC_NO = /^[A-Z]?\d+[a-z]?\.\s+/;

/** A lettered section number: capitals, then a digit. */
const LETTERED = /^[A-Z]+\d/;

/** The longest title an entry keeps. */
const TITLE_MAX = 90;

/** The longest first cell that defines its row outside an index. */
const EXACT_MAX = 10;

/** An index of definitions: this many rows or more, and this share of their first cells opening on an ID. */
const INDEX_ROWS = 2;
const INDEX_SHARE = 0.6;

/** The pill's colour roles. */
const ROLES: readonly StatusRole[] = ['ok', 'wait', 'no', 'info'];

/** A text with its white space runs as one space, trimmed. */
const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** A heading's text after its section number. */
const bare = (h: Element): string => squash(h.textContent ?? '').replace(SEC_NO, '');

/** The text under `n`, white space as one space, leaving out hidden chrome (what the layout split off and hides). */
function shown(n: Node): string {
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

/** The hanging number editorial.ts put first in a heading, or null. */
function numberOf(h: Element): string | null {
  const f = h.firstChild;
  if (f === null || f.nodeType !== 1) return null;
  const el = f as Element;
  return el.classList.contains('sec-no') && el.hasAttribute(CHROME_ATTR) ? squash(el.textContent ?? '') : null;
}

/** Section 6: each lettered level-2 heading defines its number. */
function defineSections(ctx: FeatureContext): void {
  let group = 'Sections';
  for (const h of Array.from(ctx.root.querySelectorAll('h2[id]'))) {
    const no = numberOf(h);
    if (no === null || !LETTERED.test(no)) {
      group = bare(h);
      continue;
    }
    if (no.length > NAME_MAX) continue;
    ctx.index.define({ id: no, kind: 'section', title: clip(bare(h), TITLE_MAX), status: null, group, target: h, row: null, heads: [] });
  }
}

/** The heading a table is grouped under (see the header), or null. */
function groupOf(table: Element, root: Element): Element | null {
  for (let n: Element | null = table; n !== null && n !== root; n = n.parentElement) {
    for (let p = n.previousElementSibling; p !== null; p = p.previousElementSibling) {
      if ((p.localName === 'h2' || p.localName === 'h3') && p.id !== '') return p;
      if (p.classList.contains('short') || p.classList.contains('callout')) {
        const h = p.querySelector('h2, h3');
        if (h !== null) return h;
      }
    }
  }
  return null;
}

/** The colour role of the row's last chrome pill, or null. */
function statusOf(row: Element): StatusRole | null {
  const pills = row.querySelectorAll('.pill[data-docreader-chrome]');
  const last = pills[pills.length - 1];
  return last === undefined ? null : (ROLES.find((r) => last.classList.contains(r)) ?? null);
}

/** Section 8: each table's ID rows (see the header). */
function defineRows(ctx: FeatureContext): void {
  const { journal, vocab, index } = ctx;
  const idAt = (t: string | null): string | null => (t === null ? null : (vocab.id.exec(t)?.[1] ?? null));
  for (const block of ctx.blocks) {
    if (block.kind !== 'table') continue;
    const rows = block.rows;
    const firsts = rows.map((r) => {
      const c = r.cells[0];
      return c === undefined ? null : shown(c);
    });
    const opening = firsts.map(idAt);
    const exact = firsts.map((t) => (t !== null && t.length <= EXACT_MAX && idAt(t) === t ? t : null));
    const isIndex = rows.length >= INDEX_ROWS && opening.filter((x) => x !== null).length >= rows.length * INDEX_SHARE;
    block.isIndex = isIndex;
    const g = groupOf(block.el, ctx.root);
    const group = g === null ? 'Index' : bare(g);
    const titleCol = block.heads.findIndex((h, i) => i > 0 && vocab.titleHeader.test(h));
    rows.forEach((r, i) => {
      const id = (isIndex ? opening[i] : exact[i]) ?? null;
      if (id === null) return;
      journal.toggleClass(r.cells[0] as HTMLTableCellElement, 'idcell', true); // an ID came from it, so it is there
      if (id.length > NAME_MAX) return;
      const rest = (firsts[i] ?? '').slice(id.length).replace(/^[\s,:.-]+/, '');
      const tc = r.cells[titleCol] ?? r.cells[1]; // no title column: titleCol is -1, and that cell undefined
      const title = rest.length > 2 && !vocab.id.test(rest) ? rest : tc === undefined ? '' : shown(tc);
      index.define({ id, kind: 'row', title: clip(title, TITLE_MAX), status: statusOf(r), group, target: r, row: r, heads: block.heads });
    });
  }
}

/** Build this feature during startup: lettered sections first, then ID rows. */
export function build(ctx: FeatureContext): void {
  defineSections(ctx);
  defineRows(ctx);
}
