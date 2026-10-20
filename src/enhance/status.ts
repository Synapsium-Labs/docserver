// Table marks, ported from the reference reader's section 8: a body row whose only filled cell is the first is a group
// heading (`tr.group`); a table of two columns keeps to the reading column (`cols-2`), and one of three or more stacks
// into cards on a phone (`shapeTable`); and status words in table cells (below). In a column
// that reads as a status column, a cell's leading status word ("Agreed", "Pending, see below") is shown as a
// dot-and-word mark, `span.pill.<ok|wait|no|info>`.
//
// The words are the vocabulary's (`ctx.vocab`, vocab.ts): the status words by colour role, and the header words. A
// column qualifies when (a) its header holds a status-header word as a whole word (by default Status, State,
// Result, Verdict, Outcome, each also plural, Stands or Fate: "Current status" does, "Statement" does not), or (b)
// its header names a ruling or asks a question and at least half its filled cells open on a status word, or (c) at
// least 60% of its filled cells (three or more, none over three words) open on one. The first column never does.
// Only the cell's first text (directly, or alone inside a strong, em or b) is read.
//
// The text is never edited: the word's text node is split off (journal.split) and moved into the mark (journal.wrap);
// a comma, semicolon, colon or full stop right after it joins the mark in a `span.pill-wrap`, so it never wraps to
// the next line alone. Destroy joins the text again.
import { chrome, type Journal } from './journal.js';
import { words } from './reading.js';
import type { FeatureContext } from './types.js';
import type { StatusRole, Vocab } from './vocab.js';

/** The status word a text opens with, as the text spells it, and its colour role; null when it opens with none. */
export function statusOf(vocab: Vocab, s: string): { readonly word: string; readonly role: StatusRole } | null {
  const t = s.trim();
  for (const { re, role } of vocab.status) {
    const m = re.exec(t);
    if (m !== null) return { word: m[0], role };
  }
  return null;
}

const txt = (n: Node): string => (n.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The text node a cell's text opens with: its first non-blank child, or the one text inside a leading strong/em/b. */
function leadText(cell: Element): Text | null {
  let f = cell.firstChild;
  while (f !== null && f.nodeType === 3 && (f as Text).data.trim() === '') f = f.nextSibling;
  if (f === null) return null;
  if (f.nodeType === 1) {
    const e = f as Element;
    const only = e.firstChild;
    if (/^(?:strong|em|b)$/.test(e.localName) && e.childNodes.length === 1 && only !== null && only.nodeType === 3) return only as Text;
    return null;
  }
  return f.nodeType === 3 ? (f as Text) : null;
}

/** Put the mark on one cell's leading status word. */
function mark(journal: Journal, vocab: Vocab, doc: Document, node: Text): void {
  const data = node.data;
  const s = data.replace(/^\s+/, '');
  const hit = statusOf(vocab, s);
  if (hit === null) return;
  const cut = s.search(/[,;:(]|\.(\s|$)/);
  let head = (cut > 0 ? s.slice(0, cut) : s).trim();
  if (words(head) > 3 || head.length > 24) head = hit.word;
  const rest = s.slice(head.length);
  const lead = data.length - s.length;
  const word = lead > 0 ? journal.split(node, lead) : node;
  const after = head.length < word.data.length ? journal.split(word, head.length) : null;
  const pill = chrome(doc, 'span', { className: `pill ${hit.role}` });
  journal.wrap([word], pill);
  if (after !== null && /^[,;:.]/.test(rest)) {
    if (after.data.length > 1) journal.split(after, 1);
    journal.wrap([pill, after], chrome(doc, 'span', { className: 'pill-wrap' }));
  }
}

/**
 * The table's shape, for the stylesheet. A body row with more than one cell whose only filled cell is the first is a
 * group heading inside the table (`tr.group`: set in the prose face, never a card of its own on a phone). A table of
 * two columns (Term | Meaning and the like) reads as prose and keeps to the reading column (`cols-2` on the wrapper).
 * A table of three or more columns stacks into cards on a phone (the `.stack` rules, under 701px wide): the wrapper
 * takes the class, and each body cell carries its column's name in `data-label`, which the card shows above the cell.
 */
function shapeTable(wrapper: Element, heads: readonly string[], rows: readonly HTMLTableRowElement[], journal: Journal): void {
  for (const r of rows) {
    const cells = Array.from(r.cells);
    const [first, ...rest] = cells;
    if (first !== undefined && rest.length > 0 && txt(first) !== '' && rest.every((c) => txt(c) === '')) journal.toggleClass(r, 'group', true);
  }
  if (heads.length === 2) journal.toggleClass(wrapper, 'cols-2', true);
  if (heads.length < 3) return;
  journal.toggleClass(wrapper, 'stack', true);
  for (const r of rows) {
    Array.from(r.cells).forEach((c, i) => {
      const label = heads[i];
      if (label !== undefined && label !== '') journal.setAttribute(c, 'data-label', label);
    });
  }
}

/** Mark the status words of every table under the root (render()'s `div.table-wrapper > table`). */
export function buildStatusMarks(ctx: FeatureContext): void {
  const { root, journal, vocab } = ctx;
  const doc = root.ownerDocument;
  for (const w of Array.from(root.querySelectorAll('.table-wrapper'))) {
    const table = w.querySelector('table');
    if (table === null) continue;
    const headRow = table.tHead?.rows[0];
    const heads = headRow === undefined ? [] : Array.from(headRow.cells).map(txt);
    const rows = Array.from(table.querySelectorAll('tbody tr')) as HTMLTableRowElement[];
    shapeTable(w, heads, rows, journal);
    heads.forEach((head, ci) => {
      if (ci === 0) return;
      const cells: Element[] = [];
      for (const r of rows) {
        const c = r.cells[ci];
        if (c !== undefined && txt(c) !== '') cells.push(c);
      }
      if (cells.length === 0) return;
      const hits = cells.filter((c) => {
        const l = leadText(c);
        return l !== null && statusOf(vocab, l.data) !== null;
      });
      const named = vocab.statusHeader.test(head);
      const asked = vocab.rulingHeader.test(head) && hits.length >= cells.length * 0.5;
      const short = hits.length >= cells.length * 0.6 && cells.length >= 3 && cells.every((c) => words(c.textContent ?? '') <= 3);
      if (!named && !asked && !short) return;
      for (const c of hits) {
        const l = leadText(c);
        if (l !== null) mark(journal, vocab, doc, l);
      }
    });
  }
}
