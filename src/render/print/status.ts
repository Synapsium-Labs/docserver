// Status labels in table cells (print mode; src/enhance/status.ts): in a column that reads as a status column, a cell's
// leading status word is a `span.pill.<ok|wait|no|info>`, and a comma, semicolon, colon or full stop right after it joins it
// in a `span.pill-wrap`. The column rule and the words are the reader's (the vocabulary, vocab.ts).
import type { PrintCtx } from './context.js';
import { words } from './facts.js';
import { all, el, isEl, isText, named, split, textOf, txt, withClass, wrap, type ElN, type N, type TextN } from './tree.js';
import type { PrintVocab, StatusRole } from './vocab.js';

/** A bullet a cell's line may open with: the reader splits it off and reads past it. */
const BULLET = /^\s*[•·▪-]\s+/;

/** The status word a text opens with, as the text spells it, and its colour role; null when it opens with none. */
export function statusOf(vocab: PrintVocab, s: string): { readonly word: string; readonly role: StatusRole } | null {
  const t = s.trim();
  for (const { re, role } of vocab.status) {
    const m = re.exec(t);
    if (m !== null) return { word: m[0], role };
  }
  return null;
}

/** A node the lead text passes over: blank text, or a line break (the reader keeps one in hidden chrome). */
const skipped = (n: N): boolean => (isText(n) ? n.data.trim() === '' : n.name === 'br');

/**
 * The text node a cell's text opens with, and how much of it to read past (a bullet the reader hides, in a cell of lines):
 * its first child not passed over, or the one text inside a leading strong, em or b.
 */
function leadText(cell: ElN): { readonly node: TextN; readonly skip: number } | null {
  const lines = cell.kids.some((c) => isEl(c) && c.name === 'br');
  let f = cell.kids.find((c) => !skipped(c));
  if (f === undefined) return null;
  if (isEl(f)) {
    const only = f.kids[0];
    return /^(?:strong|em|b)$/.test(f.name) && f.kids.length === 1 && only !== undefined && isText(only) ? { node: only, skip: 0 } : null;
  }
  const skip = lines ? (BULLET.exec(f.data)?.[0].length ?? 0) : 0;
  f = f as TextN;
  return { node: f, skip };
}

/** Put the mark on one cell's leading status word. */
function mark(vocab: PrintVocab, node: TextN, skip: number): void {
  const data = node.data;
  const s = data.slice(skip).replace(/^\s+/, '');
  const hit = statusOf(vocab, s);
  if (hit === null) return;
  const cut = s.search(/[,;:(]|\.(\s|$)/);
  let head = (cut > 0 ? s.slice(0, cut) : s).trim();
  if (words(head) > 3 || head.length > 24) head = hit.word;
  const rest = s.slice(head.length);
  const lead = data.length - s.length;
  const word = lead > 0 ? split(node, lead) : node;
  const after = head.length < word.data.length ? split(word, head.length) : null;
  const pill = el('span', `pill ${hit.role}`);
  wrap([word], pill);
  if (after !== null && /^[,;:.]/.test(rest)) {
    if (after.data.length > 1) split(after, 1);
    wrap([pill, after], el('span', 'pill-wrap'));
  }
}

/** Mark the status words of every table under the root (render()'s `div.table-wrapper > table`). */
export function buildStatusMarks(ctx: PrintCtx): void {
  const { root, vocab } = ctx;
  for (const w of all(root, withClass('table-wrapper'))) {
    const table = all(w, named('table'))[0];
    if (table === undefined) continue;
    const thead = table.kids.find((c): c is ElN => isEl(c) && c.name === 'thead');
    const headRow = thead === undefined ? undefined : thead.kids.find((c): c is ElN => isEl(c) && c.name === 'tr');
    const heads = headRow === undefined ? [] : headRow.kids.filter(isEl).map((c) => txt(c));
    const rows = all(table, (e) => e.name === 'tr' && e.up?.name === 'tbody');
    heads.forEach((head, ci) => {
      if (ci === 0) return;
      const cells: ElN[] = [];
      for (const r of rows) {
        const c = r.kids.filter(isEl)[ci];
        if (c !== undefined && txt(c) !== '') cells.push(c);
      }
      if (cells.length === 0) return;
      const hits = cells.filter((c) => {
        const l = leadText(c);
        return l !== null && statusOf(vocab, l.node.data.slice(l.skip)) !== null;
      });
      const named = vocab.statusHeader.test(head);
      const asked = vocab.rulingHeader.test(head) && hits.length >= cells.length * 0.5;
      const short = hits.length >= cells.length * 0.6 && cells.length >= 3 && cells.every((c) => words(textOf(c)) <= 3);
      if (!named && !asked && !short) return;
      for (const c of hits) {
        const l = leadText(c);
        if (l !== null) mark(vocab, l.node, l.skip);
      }
    });
  }
}
