// Print mode of render() (docserver parity, Task 7; the first consumer's design, section 6): the blocks the reader's enhance
// step builds on the page's DOM, written statically into the html, so a host can print a document without the browser reader.
// It reads render()'s own finished html as a small DOM-free tree (tree.ts), applies the reader's builders to it in the
// reader's build order (editorial: title block, boxes, section numbers; rules; status labels; plans; strip), and writes it
// again inside one `div.docreader-print`. Nothing from the document is parsed as html beyond render()'s own output, in which
// every character of the document that is `<` or `>` is an entity, so a tag in the Markdown source stays text.
// Every `details` is open, no element is hidden, and only the attributes of KEPT_ATTRS are written (a table cell's
// `text-align` style becomes `align`, a task's checkbox the text of its box, and a figure stays its source).
import type { CheckedReader } from '../reader.js';
import type { FrontEntry } from '../types.js';
import { buildBoxes } from './boxes.js';
import type { PrintCtx } from './context.js';
import { documentMinutes, noFacts } from './facts.js';
import { buildPlans } from './plans.js';
import { buildRules } from './rules.js';
import { buildStatusMarks } from './status.js';
import { buildStrip } from './strip.js';
import { buildTitle } from './title.js';
import { all, attr, detach, el, insert, isEl, named, parse, serialize, setAttr, squash, textOf, type ElN } from './tree.js';
import { printVocab } from './vocab.js';

/** The reader's document check, measured before anything moves. */
function isDocument(root: ElN): boolean {
  let h1 = 0;
  let h2 = 0;
  let h3 = 0;
  for (const c of root.kids) {
    if (!isEl(c)) continue;
    if (c.name === 'h1') h1 += 1;
    else if (c.name === 'h2') h2 += 1;
    else if (c.name === 'h3') h3 += 1;
  }
  return h1 > 0 && (h2 > 2 || (h2 > 0 && h3 >= 4));
}

/** What paper needs of the leftovers: open details, `align` for a style, the text of a checkbox. */
function finish(root: ElN): void {
  for (const d of all(root, named('details'))) setAttr(d, 'open', '');
  for (const c of all(root, named('th', 'td'))) {
    const m = /^\s*text-align:\s*(\w+)\s*;?\s*$/.exec(attr(c, 'style') ?? '');
    if (m !== null) setAttr(c, 'align', m[1] ?? '');
  }
  for (const i of all(root, named('input'))) {
    const checkbox = attr(i, 'type') === 'checkbox';
    if (checkbox && i.up !== null) insert(i.up, el('span', 'task-check', [i.attrs.some((a) => a[0] === 'checked') ? '☑' : '☐']), i);
    detach(i);
  }
}

/** The html of print mode for `html`, which render() made; `front` is its meta.frontList. */
export function printHtml(html: string, checked: CheckedReader, front: readonly FrontEntry[] | null): string {
  const root = parse(html);
  const label = new Map<ElN, string>();
  for (const h of all(root, named('h2', 'h3'))) label.set(h, squash(textOf(h)));
  const ctx: PrintCtx = {
    vocab: printVocab(checked),
    rules: checked.rules,
    root,
    front,
    label,
    isDocument: isDocument(root),
    byline: null,
    facts: noFacts,
    waiting: [],
    waitBox: null,
    plan: { tasks: 0, steps: 0, yours: 0 },
  };
  const minutes = documentMinutes(root);
  buildTitle(ctx, minutes);
  buildBoxes(ctx);
  buildRules(ctx);
  buildStatusMarks(ctx);
  buildPlans(ctx);
  buildStrip(ctx);
  finish(root);
  const out = el('div', 'docreader-print');
  out.kids = root.kids;
  for (const k of out.kids) k.up = out;
  return serialize(out);
}
