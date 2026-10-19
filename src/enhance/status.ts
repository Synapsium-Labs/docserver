// Status words in table cells, ported from the reference reader's section 8 (its status marks only): in a column
// that reads as a status column, a cell's leading status word ("Agreed", "Pending, see below") is shown as a
// dot-and-word mark, `span.pill.<ok|wait|no|info>`.
//
// A column qualifies when (a) its header names a status ("Status", "State", "Result", "Verdict", "Outcome",
// "Stands", "Fate"), or (b) its header names a ruling or asks a question and at least half its filled cells open on
// a status word, or (c) at least 60% of its filled cells (three or more, none over three words) open on one. The
// first column never does. Only the cell's first text (directly, or alone inside a strong, em or b) is read.
//
// The text is never edited: the word's text node is split off (journal.split) and moved into the mark (journal.wrap);
// a comma, semicolon, colon or full stop right after it joins the mark in a `span.pill-wrap`, so it never wraps to
// the next line alone. Destroy joins the text again.
import { chrome, type Journal } from './journal.js';
import { words } from './reading.js';

/** The status words, each with its colour role. A word must open the cell's text. */
const STATUS: readonly (readonly [RegExp, string])[] = [
  [/^(ruled|accepted|agreed|kept|confirmed|measured|done|verified|yes|implemented|approved)\b/i, 'ok'],
  [/^(awaiting|proposed|pending|open|waiting|partly|partial|to do|in review|draft)\b/i, 'wait'],
  [/^(rejected|withdrawn|dropped|removed|refused|no|diverges|blocked)\b/i, 'no'],
  [/^(changed|amended|deferred|later|pinned|judgement|sourced|reported|superseded)\b/i, 'info'],
];

/** The status word a text opens with, and its role; null when it opens with none. */
export function statusOf(s: string): { readonly word: string; readonly role: string } | null {
  const t = s.trim();
  for (const [re, role] of STATUS) {
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
function mark(journal: Journal, doc: Document, node: Text): void {
  const data = node.data;
  const s = data.replace(/^\s+/, '');
  const hit = statusOf(s);
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

/** Mark the status words of every table under `root` (render()'s `div.table-wrapper > table`). */
export function buildStatusMarks(root: Element, journal: Journal): void {
  const doc = root.ownerDocument;
  for (const w of Array.from(root.querySelectorAll('.table-wrapper'))) {
    const table = w.querySelector('table');
    if (table === null) continue;
    const headRow = table.tHead?.rows[0];
    const heads = headRow === undefined ? [] : Array.from(headRow.cells).map(txt);
    const rows = Array.from(table.querySelectorAll('tbody tr')) as HTMLTableRowElement[];
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
        return l !== null && statusOf(l.data) !== null;
      });
      const named = /status|state|result|verdict|outcome|stands|fate/i.test(head);
      const asked = /ruling|ruled|answer|\?$/i.test(head) && hits.length >= cells.length * 0.5;
      const short = hits.length >= cells.length * 0.6 && cells.length >= 3 && cells.every((c) => words(c.textContent ?? '') <= 3);
      if (!named && !asked && !short) return;
      for (const c of hits) {
        const l = leadText(c);
        if (l !== null) mark(journal, doc, l);
      }
    });
  }
}
