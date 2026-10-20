// The review strip under the byline: what waits on the reader, the decisions' counts and the plan's (the reference
// layout, section 16). Built by L2 Task 20.
//
// Consumes ctx.page (the byline, the waiting items and their box, editorial.ts), ctx.blocks (the tables, with
// ids.ts's `isIndex`), the status pills (status.ts), ctx.plan (plans.ts), ctx.vocab (the decisions table's header
// word, `vocab.decisionTable`, format contract: "status"), ctx.options.rules and ctx.info, nav.goTo and keys (`w`).
// Produces section 16's classes. Its links are chrome anchors handled by goTo: no `waiting-N` ids are written.
//
// The strip, `section.review-strip[aria-label=Review]`, holds:
//   - with waiting items (the first "Waiting" box of "Where things stand"): `div.rs-wait`, a `p.rs-label` ("Waiting on
//     you · N", after a `span.dot`) and an `ol` with one `li` per item, each a link (`a`) holding the item's text,
//     white space as one space, clipped to WAIT_CLIP (text.ts's clip). A click on it (the main button, no modifier) goes
//     to the item through nav.goTo, a new entry in the host's history; its href names the box's heading (`#<id>`), so
//     a link opened elsewhere lands on the box;
//   - `p.rs-facts`, always (the stylesheet hides it empty), its facts joined by a `span.sep` ("·", aria-hidden):
//       the decisions: of the tables that are indexes of definitions (ids.ts) and have a header holding the decisions
//       word, the one with the most body rows, the first of a tie. Its fact (`span.fact`) is a link to its group's
//       heading, the nearest level-2 or level-3 heading with an id before the table (its earlier siblings, then its
//       ancestors'; a box of "In short" or "Where things stand" counts by its heading), else to its first row, reading
//       "N <group>", the group's text after its section number in lower case, "rows" added when that does not end in
//       "s" ("Decisions" with no group): N counts its body rows, group rows (`tr.group`) left out. A heading's text is
//       its aria-label when it has one (editorial.ts and the plans name a heading by its text as written), else its
//       text; white space as one space either way. Then one `span.cnt.<colour>` per status word of the first column whose header holds
//       the decisions word: the first word of each row's first chrome pill there, in lower case, counted, most first,
//       a tie in the order first seen, coloured by that pill's class other than `pill` (a row the host left short of
//       the column has none);
//       the plan: with the outline mode's length (ctx.plan.outlineable), "T tasks · S steps" (the tasks part only with
//       tasks), and "N yours" (`span.cnt.wait`) when steps name the reader.
// It goes right after the byline, else after the title, past any hidden elements that follow (the meta line, when it
// made no byline, so the stylesheet's `.review-strip + h2` sees no hidden paragraph between), else first in the
// root; so it comes before the facts panel, as the stylesheet's `.byline + .review-strip + .doc-facts` expects. Only
// for a document (ResolvedInfo.isDocument) or a rules document, and only when it holds waiting items or a fact.
// A rules document (C53) has `rules: true` and a front-matter list key with values that are all rule IDs (vocab.ruleId);
// no context field is added for it. (The reference placed its strip for its own document kinds as well; their words
// are not ported.)
//
// The key `w` (with waiting items, whether or not the strip is placed, as the reference's): "What is waiting on you",
// goes to the box's level-3 heading through nav.goTo, a new entry in the host's history.
//
// Standard files, slug `changes`: test/enhance-changes.test.ts, test/browser/changes.test.ts and
// conformance/layout/changes/. Registered in features.ts, whose header says where in the build order and why.
import { CHROME_ATTR, chrome } from './journal.js';
import type { TableBlock } from './registry.js';
import { clip } from './text.js';
import type { FeatureContext } from './types.js';

/** The longest text a waiting item's link shows, in code units. */
export const WAIT_CLIP = 92;

/** A section number at the start of a heading's text: "3. ", "F1. ", "4b. ". */
const SEC_NO = /^[A-Z]?\d+[a-z]?\.\s+/;

const isChrome = (el: Element): boolean => el.hasAttribute(CHROME_ATTR);

/**
 * A heading's text as written, white space as one space: its aria-label when it has one (editorial.ts names a numbered
 * heading by its whole text, the plans a task heading, and headCtl a heading by its text before its controls), else its
 * text (a heading with no label has no chrome in it yet).
 */
function labelOf(h: Element): string {
  return (h.getAttribute('aria-label') ?? h.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * The heading a table is grouped under, as ids.ts groups an ID row: the nearest h2 or h3 with an id among its earlier
 * siblings, then its ancestors' (a box of "In short" or "Where things stand" by its heading); null when there is none.
 */
function groupOf(el: Element, root: Element): Element | null {
  for (let n: Element | null = el; n !== null && n !== root; n = n.parentElement) {
    for (let p = n.previousElementSibling; p !== null; p = p.previousElementSibling) {
      if ((p.localName === 'h2' || p.localName === 'h3') && p.id !== '') return p;
      if (p.classList.contains('short') || p.classList.contains('callout')) return p.querySelector('h2, h3'); // a box holds its heading
    }
  }
  return null;
}

/** A link of the strip: it goes to `target` through goTo (see the header). */
function link(ctx: FeatureContext, text: string, href: string, target: Element): HTMLAnchorElement {
  const a = chrome(ctx.root.ownerDocument, 'a', { text, attrs: { href } });
  ctx.journal.listen(a, 'click', (event) => {
    const e = event as MouseEvent;
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    ctx.nav.goTo(target, { push: true });
  });
  return a;
}

/** `#<id>` for a link to `el`: its own id or defined ID (nav.idOf), else empty. */
const hrefTo = (ctx: FeatureContext, el: Element): string => `#${ctx.nav.idOf(el) ?? ''}`;

/** The decisions fact (see the header), or null. */
function decisions(ctx: FeatureContext): HTMLElement | null {
  const doc = ctx.root.ownerDocument;
  const { decisionTable } = ctx.vocab;
  let dec: TableBlock | null = null;
  for (const b of ctx.blocks) {
    if (b.kind !== 'table' || !b.isIndex || !b.heads.some((h) => decisionTable.test(h))) continue;
    if (dec === null || b.rows.length > dec.rows.length) dec = b;
  }
  if (dec === null) return null;
  const si = dec.heads.findIndex((h) => decisionTable.test(h));
  const counts = new Map<string, { n: number; readonly role: string }>();
  let n = 0;
  for (const r of dec.rows) {
    if (r.classList.contains('group')) continue;
    n += 1;
    // A row the host left short of that column has no status there.
    const pill = Array.from(r.cells[si]?.querySelectorAll('.pill') ?? []).find(isChrome);
    if (pill === undefined) continue;
    const word = ((pill.textContent ?? '').trim().split(/\s/)[0] ?? '').toLowerCase();
    const c = counts.get(word);
    // The pill's colour: its class other than `pill` (status.ts gives it one of the four roles).
    if (c === undefined) counts.set(word, { n: 1, role: Array.from(pill.classList).find((x) => x !== 'pill') ?? '' });
    else c.n += 1;
  }
  const g = groupOf(dec.el, ctx.root);
  const name = (g === null ? 'Decisions' : labelOf(g).replace(SEC_NO, '')).toLowerCase();
  const target = g ?? (dec.rows[0] as HTMLTableRowElement); // an index has two rows or more
  const fact = chrome(doc, 'span', { className: 'fact' }, [link(ctx, `${String(n)} ${/s$/.test(name) ? name : `${name} rows`}`, hrefTo(ctx, target), target)]);
  for (const [word, c] of [...counts].sort((x, y) => y[1].n - x[1].n)) {
    fact.appendChild(chrome(doc, 'span', { className: `cnt ${c.role}`, text: `${String(c.n)} ${word}` }));
  }
  return fact;
}

/** The plan fact (see the header), or null. */
function planFact(ctx: FeatureContext): HTMLElement | null {
  const { plan } = ctx;
  if (!plan.outlineable) return null;
  const doc = ctx.root.ownerDocument;
  const t = plan.tasks.length;
  const tasks = t > 0 ? `${String(t)} task${t === 1 ? '' : 's'} · ` : '';
  const fact = chrome(doc, 'span', { className: 'fact' }, [chrome(doc, 'span', { text: `${tasks}${String(plan.steps.length)} steps` })]);
  if (plan.yours > 0) fact.appendChild(chrome(doc, 'span', { className: 'cnt wait', text: `${String(plan.yours)} yours` }));
  return fact;
}

/** A rules document (see the header). */
function isRulesDoc(ctx: FeatureContext): boolean {
  if (!ctx.options.rules) return false;
  return (ctx.info.frontList ?? []).some((f) => f.list && f.vals.length > 0 && f.vals.every((v) => ctx.vocab.ruleId.test(v)));
}

/** Build this feature during startup: the strip, placed when it holds something, and the `w` key. */
export function build(ctx: FeatureContext): void {
  const { root, page } = ctx;
  const doc = root.ownerDocument;
  const waiting = page.waiting;
  const box = page.waitBox;

  const strip = chrome(doc, 'section', { className: 'review-strip', attrs: { 'aria-label': 'Review' } });
  if (waiting.length > 0) {
    // Editorial publishes the items with their box, a callout that its level-3 heading opens.
    const h3 = (box as HTMLElement).querySelector('h3') as HTMLElement;
    ctx.keys.bind({ key: 'w', label: 'What is waiting on you', run: () => ctx.nav.goTo(h3, { push: true }) });
    const href = hrefTo(ctx, h3);
    const ol = chrome(doc, 'ol', {}, waiting.map((li) => chrome(doc, 'li', {}, [link(ctx, clip(li.textContent ?? '', WAIT_CLIP), href, li)])));
    const label = chrome(doc, 'p', { className: 'rs-label' }, [chrome(doc, 'span', { className: 'dot' }), doc.createTextNode(`Waiting on you · ${String(waiting.length)}`)]);
    strip.appendChild(chrome(doc, 'div', { className: 'rs-wait' }, [label, ol]));
  }
  const facts = [decisions(ctx), planFact(ctx)].filter((f): f is HTMLElement => f !== null);
  const tools = chrome(doc, 'p', { className: 'rs-facts' });
  facts.forEach((f, i) => {
    if (i > 0) tools.appendChild(chrome(doc, 'span', { className: 'sep', text: '·', attrs: { 'aria-hidden': 'true' } }));
    tools.appendChild(f);
  });
  strip.appendChild(tools);

  if (!(ctx.info.isDocument || isRulesDoc(ctx)) || (waiting.length === 0 && facts.length === 0)) return;
  let after: Element | null = page.byline ?? root.querySelector('h1');
  for (let n = after?.nextElementSibling ?? null; n !== null && n.hasAttribute('hidden'); n = n.nextElementSibling) after = n;
  if (after === null) ctx.journal.insert(strip, root, root.firstChild);
  else ctx.journal.insert(strip, after.parentNode as Node, after.nextSibling);
}
