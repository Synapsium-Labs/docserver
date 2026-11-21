// The review strip (print mode; src/enhance/strip.ts, the reference layout's section 16). `section.review-strip` goes right
// after the byline (else after the title, else first), only for a document or a rules document and only when it holds waiting
// items or a fact. It holds:
//   - `div.rs-wait`: `p.rs-label`, "Waiting on you · N", and an `ol` with one `li` per waiting item, each the item's whole
//     text, white space as one space. The screen clips an item to WAIT_CLIP and makes it a link; paper cannot open a clip and
//     has no chrome anchors, so print does neither (the item's own box prints in "Where things stand"). The screen's coloured
//     dot is not printed: the label's words carry it;
//   - `p.rs-facts`, when it has a fact, the facts joined by a `span.sep`: the decisions' ("N <group>", then one
//     `span.cnt.<role>` per status word, each its number and its word) and the plan's ("T tasks · S steps", then
//     `span.cnt.wait` "N yours"), with the screen's words and rules.
import type { PrintCtx } from './context.js';
import { all, append, attr, el, first, hasClass, insert, insertAfter, isEl, named, prevEl, squash, textOf, txt, withClass, type ElN } from './tree.js';

/**
 * The plan fact's gate: the screen builds it only for a plan of the outline mode's length (src/enhance/plans.ts's
 * OUTLINE_MIN_STEPS, 20 steps; strip.ts: `planFact` returns null unless `plan.outlineable`). Print follows that gate (ccrc D-8868);
 * it is one function, so another ruling is a change here alone. test/print-agreement.test.ts holds it to the screen at 19 and 20 steps.
 */
export const PLAN_FACT_MIN_STEPS = 20;
export const planFactApplies = (steps: number): boolean => steps >= PLAN_FACT_MIN_STEPS;

/** A section number at the start of a heading's text: "3. ", "F1. ", "4b. ". */
const SEC_NO = /^[A-Z]?\d+[a-z]?\.\s+/;

const INDEX_ROWS = 2;
const INDEX_SHARE = 0.6;

interface Table {
  readonly el: ElN;
  readonly heads: readonly string[];
  readonly rows: readonly ElN[];
}

function tables(ctx: PrintCtx): Table[] {
  const out: Table[] = [];
  for (const w of all(ctx.root, withClass('table-wrapper'))) {
    const table = first(w, named('table'));
    if (table === null) continue;
    const thead = table.kids.find((c): c is ElN => isEl(c) && c.name === 'thead');
    const headRow = thead?.kids.find((c): c is ElN => isEl(c) && c.name === 'tr');
    out.push({
      el: w,
      heads: headRow === undefined ? [] : headRow.kids.filter(isEl).map((c) => txt(c)),
      rows: all(table, (e) => e.name === 'tr' && e.up?.name === 'tbody'),
    });
  }
  return out;
}

/** The heading a table is grouped under: the nearest h2 or h3 with an id among its earlier siblings, then its ancestors'. */
function groupOf(el: ElN, root: ElN): ElN | null {
  for (let n: ElN | null = el; n !== null && n !== root; n = n.up) {
    for (let p = prevEl(n); p !== null; p = prevEl(p)) {
      if ((p.name === 'h2' || p.name === 'h3') && (attr(p, 'id') ?? '') !== '') return p;
      if (hasClass(p, 'short') || hasClass(p, 'callout')) return first(p, named('h2', 'h3')); // a box holds its heading
    }
  }
  return null;
}

function decisions(ctx: PrintCtx): ElN | null {
  const { vocab } = ctx;
  let dec: Table | null = null;
  for (const t of tables(ctx)) {
    const firsts = t.rows.map((r) => {
      const c = r.kids.find(isEl);
      return c === undefined ? null : txt(c);
    });
    const opening = firsts.map((x) => (x === null ? null : (vocab.id.exec(x)?.[1] ?? null)));
    const isIndex = t.rows.length >= INDEX_ROWS && opening.filter((x) => x !== null).length >= t.rows.length * INDEX_SHARE;
    if (!isIndex || !t.heads.some((h) => vocab.decisionTable.test(h))) continue;
    if (dec === null || t.rows.length > dec.rows.length) dec = t;
  }
  if (dec === null) return null;
  const si = dec.heads.findIndex((h) => vocab.decisionTable.test(h));
  const counts = new Map<string, { n: number; readonly role: string }>();
  let n = 0;
  for (const r of dec.rows) {
    const cells = r.kids.filter(isEl);
    const [head, ...rest] = cells;
    if (head !== undefined && rest.length > 0 && txt(head) !== '' && rest.every((c) => txt(c) === '')) continue; // a group row
    n += 1;
    const cell = cells[si];
    const pill = cell === undefined ? null : first(cell, (e) => e.name === 'span' && hasClass(e, 'pill'));
    if (pill === null) continue;
    const word = (textOf(pill).trim().split(/\s/)[0] ?? '').toLowerCase();
    const c = counts.get(word);
    if (c === undefined) counts.set(word, { n: 1, role: (attr(pill, 'class') ?? '').split(/\s+/).find((x) => x !== 'pill' && x !== '') ?? '' });
    else c.n += 1;
  }
  const g = groupOf(dec.el, ctx.root);
  const label = g === null ? null : (ctx.label.get(g) ?? squash(textOf(g)));
  const name = (label === null ? 'Decisions' : label.replace(SEC_NO, '')).toLowerCase();
  const fact = el('span', 'fact', [`${String(n)} ${/s$/.test(name) ? name : `${name} rows`}`]);
  for (const [word, c] of [...counts].sort((x, y) => y[1].n - x[1].n)) append(fact, el('span', `cnt ${c.role}`, [`${String(c.n)} ${word}`]));
  return fact;
}

function planFact(ctx: PrintCtx): ElN | null {
  const { tasks, steps, yours } = ctx.plan;
  if (!planFactApplies(steps)) return null;
  const head = tasks > 0 ? `${String(tasks)} task${tasks === 1 ? '' : 's'} · ` : '';
  const fact = el('span', 'fact', [el('span', undefined, [`${head}${String(steps)} steps`])]);
  if (yours > 0) append(fact, el('span', 'cnt wait', [`${String(yours)} yours`]));
  return fact;
}

function isRulesDoc(ctx: PrintCtx): boolean {
  if (!ctx.rules) return false;
  return (ctx.front ?? []).some((f) => f.list && f.vals.length > 0 && f.vals.every((v) => ctx.vocab.ruleId.test(v)));
}

export function buildStrip(ctx: PrintCtx): void {
  const strip = el('section', 'review-strip');
  if (ctx.waiting.length > 0) {
    const label = el('p', 'rs-label', [`Waiting on you · ${String(ctx.waiting.length)}`]);
    const ol = el('ol', undefined, ctx.waiting.map((t) => el('li', undefined, [t])));
    append(strip, el('div', 'rs-wait', [label, ol]));
  }
  const facts = [decisions(ctx), planFact(ctx)].filter((f): f is ElN => f !== null);
  if (facts.length > 0) {
    const tools = el('p', 'rs-facts');
    facts.forEach((f, i) => {
      if (i > 0) append(tools, el('span', 'sep', ['·']));
      append(tools, f);
    });
    append(strip, tools);
  }
  if (!(ctx.isDocument || isRulesDoc(ctx)) || strip.kids.length === 0) return;
  const after = ctx.byline ?? first(ctx.root, named('h1'));
  if (after === null) insert(ctx.root, strip, ctx.root.kids[0] ?? null);
  else insertAfter(after, strip);
}
