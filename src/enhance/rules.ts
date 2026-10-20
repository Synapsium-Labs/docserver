// Rule paragraphs and the rules index (the reference layout, sections 3 and 4): a plugin, built only with `rules:
// true` (default false). Built by L2 Task 9. Its words are the vocabulary's: the rule-ID grammar (`vocab.ruleId`, by
// default two or more capitals, then dash-separated parts of capitals or digits: `AB-1`, `ABC-DEF-9`; a host gives
// its own prefixes through Task 8's option) and a list's joins (`vocab.ruleIdJoin`: a comma, "and", or both).
//
// Consumes options.rules, ctx.vocab, statusOf (status.ts), ctx.info.frontList, ctx.page.facts (`take` for the
// rule-ID list keys; `summary` for the "Rules index · N rules" part and the status counts, first; `block` for the
// rules `ol`, before the panel's own `dl`; `panel` to open it) and env.matches. Produces index entries of kind 'rule'
// and section 3 and 4's classes. Writes no ids (LD6): a rule is found through the index, so a link to `#AB-1` goes to
// its paragraph through nav.byId.
//
// Section 3, a rule paragraph: a `p` whose first node is a `code` holding a rule ID, then more such codes joined by a
// list's joins, then a text that opens on a dash (an em dash, an en dash or a hyphen) and white space. Its title is its
// first bold child (without a trailing colon or full stop), else its first sentence after the head (without its full
// stop, clipped to 120). Right after the dash, an `em` that opens on a status word is the rule's status, and a note in
// brackets of 1 to 40 characters right after it is the status's note. The paragraph takes the class `rule`; its codes
// move into a new `span.rule-head`, its first child, which also holds:
//   - the status as `span.pill.<role>`, the em's own nodes moved into it, so the pill carries the status words (the
//     words a preview or an attention mark reads: a rule's status pill is the first `.pill` of its `.rule-head`; a
//     note's pill, `span.pill.info`, comes after it). Those nodes are the document's, as written: an inline element
//     in the em (a code, a bold) is in the pill too, and so is a line break, so a reader of the words squashes white
//     space, as the rules index does for its own copy (where the reference made the pill of the em's text alone);
//   - what the reference removed, split off and moved into hidden chrome spans (`hidden`), never edited: each join
//     between two codes, and the dash with what follows it up to the body (the em, left empty, its brackets and its
//     full stop or colon); the text after a note, its closing bracket, has a hidden span of its own.
// The text is never rewritten: a text node is only split (journal.split) and moved, so destroy joins it again, byte
// for byte. No two parts split from one text are left side by side in chrome, so a host that normalizes the root
// while it is enhanced cannot join them out of order. Each ID is defined once, the first definition winning (rules
// are built before ID rows, so a rule's ID is the rule): `{ kind: 'rule', title (clipped to 110), status: the pill's
// role or null, group: 'Rules', target: the paragraph }`. An ID longer than the index takes (200 code units) is not
// defined, so nothing can link to it: the rules index lists it by its ID alone, with no link and no pill, and does
// not count its status.
//
// Section 4, the rules index: a list key of the front matter (info.frontList) whose every value is a rule ID is a rule
// key ("rules: [AB-1, AB-2]", "refines: [AB-3]"). Each is taken out of the facts panel and shown first: in the
// summary, its label ("Rules index · N rules" for the key `rules`, else the key with a capital, "Refines 1 rule"),
// then its rules' statuses counted by their first word in lower case (`span.cnt.<role>`, most first, a tie in the
// order first seen); in the panel's body, before the panel's own keys, an `ol` with one item per value: a link
// `a.rlink` to the rule (`#<ID>`) holding `span.rid` and `span.rtitle`, then the rule's status as a pill (an empty
// span when it has none); a value with no rule paragraph shows its ID in a `div`, with no link. A rule key that an
// earlier list key of the same name, not a rule key, would hide is left in the panel. The panel opens with 1 to 6
// rules, or with up to 24 on a viewport 700 px wide or more (env.matches('(min-width: 700px)'), the reference's
// innerWidth). Document kinds are not built here: no kind is computed or published, and the review strip (Task 20),
// which the reference placed by its document kind, derives what it needs from the options and the front matter. The
// reference's product-specific kinds are not ported.
//
// Standard files, slug `ids`: test/enhance-ids.test.ts, test/browser/ids.test.ts and conformance/layout/ids/.
// Registered in features.ts, whose header says where in the build order and why.
import { chrome, siblingRun } from './journal.js';
import { NAME_MAX } from './registry.js';
import { statusOf } from './status.js';
import { clip } from './text.js';
import type { FeatureContext, FrontListEntry } from './types.js';
import type { StatusRole } from './vocab.js';

/** The group a rule's index entry is listed under. */
const GROUP = 'Rules';

/** The longest title taken from a rule's first sentence, and the longest an index entry keeps. */
const TITLE_MAX = 120;
const ENTRY_TITLE_MAX = 110;

/** The rules index opens with this many rules or fewer; on a viewport 700 px wide or more, with up to WIDE_MAX. */
const OPEN_MAX = 6;
const WIDE_MAX = 24;

/** The text after a rule's IDs: a dash, then white space. */
const DASH = /^\s*[—–-]\s/;

/** The part of that text split off: the dash and all the white space after it. */
const DASH_CUT = /^\s*[—–-]\s*/;

/** After the status em: an optional note in brackets (1 to 40 characters), then an optional full stop or colon. */
const AFTER = /^\s*(\(([^)]{1,40})\))?\s*[.:]?\s*/;

/** A rule's status: its words, as the pill shows them, and their colour role. */
interface RuleStatus {
  readonly text: string;
  readonly role: StatusRole;
}

/** What the rules index shows of a rule: the first paragraph that defines its ID. */
interface Rule {
  readonly title: string;
  readonly status: RuleStatus | null;
}

/** A node's text, with runs of white space as one space, trimmed. */
const txt = (n: Node): string => (n.textContent ?? '').replace(/\s+/g, ' ').trim();

const isElement = (n: Node | null, name: string): n is Element => n !== null && n.nodeType === 1 && (n as Element).localName === name;

/** A hidden chrome span: what the reference removed goes in one, still in the document. */
const hiddenSpan = (doc: Document): HTMLSpanElement => chrome(doc, 'span', { attrs: { hidden: '' } });

/** Build the rule paragraph `p`, when it is one: its head, its pills and its index entries; record its IDs in `rules`. */
function buildRule(ctx: FeatureContext, p: HTMLElement, rules: Map<string, Rule>): void {
  const { journal, vocab } = ctx;
  const doc = ctx.root.ownerDocument;
  const isRuleCode = (n: Node | null): n is Element => isElement(n, 'code') && vocab.ruleId.test((n.textContent ?? '').trim());

  const first = p.firstChild;
  if (!isRuleCode(first)) return;
  const codes: Element[] = [];
  const joins: Text[] = [];
  let n: Node | null = first;
  for (; n !== null; n = n.nextSibling) {
    if (isRuleCode(n)) codes.push(n);
    else if (n.nodeType === 3 && vocab.ruleIdJoin.test(n.textContent ?? '')) joins.push(n as Text);
    else break;
  }
  if (n === null || n.nodeType !== 3 || !DASH.test(n.textContent ?? '')) return;
  const dash = n as Text;

  // The dash and the white space after it, split off; the rest of that text (if any) is the body's first text.
  const cut = (DASH_CUT.exec(dash.data) as RegExpExecArray)[0].length;
  if (cut < dash.data.length) journal.split(dash, cut);

  // A status: an em right after the dash that opens on a status word, and a note in brackets after it. (When the
  // dash's text goes on, the node after the dash is that text, never an em.)
  let marked: { readonly em: Element; readonly status: RuleStatus } | null = null;
  let note: Text | null = null;
  let last: Node = dash; // the last node the head takes
  const s = dash.nextSibling;
  if (isElement(s, 'em')) {
    const hit = statusOf(vocab, s.textContent ?? '');
    if (hit !== null) {
      marked = { em: s, status: { text: txt(s), role: hit.role } };
      last = s;
      const after = s.nextSibling;
      if (after !== null && after.nodeType === 3) {
        const t = after as Text;
        const m = AFTER.exec(t.textContent ?? '') as RegExpExecArray;
        const used = m[0].length;
        if (used > 0) {
          if (used < t.data.length) journal.split(t, used);
          last = t;
          const words = m[2];
          if (words !== undefined) {
            note = journal.split(t, m[0].indexOf('(') + 1);
            last = journal.split(note, words.length);
          }
        }
      }
    }
  }

  const head = chrome(doc, 'span', { className: 'rule-head' });
  journal.wrap(siblingRun(first, last.nextSibling), head);
  for (const j of joins) journal.wrap([j], hiddenSpan(doc));
  if (marked !== null) {
    const pill = chrome(doc, 'span', { className: `pill ${marked.status.role}` });
    journal.insert(pill, head, dash);
    for (const c of Array.from(marked.em.childNodes)) journal.move(c, pill, null);
    if (note !== null) {
      const info = chrome(doc, 'span', { className: 'pill info' });
      journal.insert(info, head, dash);
      journal.move(note, info, null);
    }
  }
  // The dash, the em (now empty) and its brackets and full stop: adjacent now, hidden. With a note, the text before it
  // and the text after it were one text, so each has its own span (a host's normalize() would join two neighbours).
  const close = note === null ? null : siblingRun(last, null);
  journal.wrap(siblingRun(dash, note === null ? null : last), hiddenSpan(doc));
  if (close !== null) journal.wrap(close, hiddenSpan(doc));
  journal.toggleClass(p, 'rule', true);

  const strong = Array.from(p.children).find((c) => c.localName === 'strong');
  let title: string;
  if (strong !== undefined) {
    title = txt(strong).replace(/[:.]$/, '');
  } else {
    let rest = '';
    for (let c = head.nextSibling; c !== null; c = c.nextSibling) rest += c.textContent ?? '';
    const sentence = rest.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/)[0] ?? '';
    title = clip(sentence.replace(/\.$/, ''), TITLE_MAX);
  }

  const status = marked === null ? null : marked.status;
  for (const c of codes) {
    const id = (c.textContent ?? '').trim();
    if (id.length > NAME_MAX) continue;
    if (!rules.has(id)) rules.set(id, { title, status });
    const role = status === null ? null : status.role;
    ctx.index.define({ id, kind: 'rule', title: clip(title, ENTRY_TITLE_MAX), status: role, group: GROUP, target: p, row: null, heads: [] });
  }
}

/** The rules index: each rule key of the front matter, taken out of the facts panel and shown first (see the header). */
function buildIndex(ctx: FeatureContext, rules: ReadonlyMap<string, Rule>): void {
  const facts = ctx.page.facts;
  const front = ctx.info.frontList;
  if (front === null) return;
  const doc = ctx.root.ownerDocument;
  const isRuleKey = (f: FrontListEntry): boolean => f.vals.every((v) => ctx.vocab.ruleId.test(v));
  // The list keys, as the panel holds them (an empty one it does not show, and take() answers null for it).
  const lists = front.filter((f) => f.list);
  let total = 0;
  lists.forEach((f, i) => {
    if (!isRuleKey(f)) return;
    // take() takes the first key of that name still shown: an earlier one that is not a rule key would be taken instead.
    if (lists.slice(0, i).some((o) => o.key === f.key && !isRuleKey(o))) return;
    const vals = facts.take(f.key);
    if (vals === null) return;
    const n = vals.length;
    total += n;
    const noun = n === 1 ? 'rule' : 'rules';
    const label = f.key === 'rules' ? `Rules index · ${String(n)} ${noun}` : `${f.key.charAt(0).toUpperCase()}${f.key.slice(1)} ${String(n)} ${noun}`;
    facts.summary(chrome(doc, 'span', { className: 'fs-k', text: label }));
    const counts = new Map<string, { n: number; readonly role: StatusRole }>();
    for (const id of vals) {
      const st = rules.get(id)?.status ?? null;
      if (st === null) continue;
      const word = (st.text.split(/[\s(]/)[0] ?? '').toLowerCase();
      const c = counts.get(word);
      if (c === undefined) counts.set(word, { n: 1, role: st.role });
      else c.n += 1;
    }
    for (const [word, c] of [...counts].sort((a, b) => b[1].n - a[1].n)) {
      facts.summary(chrome(doc, 'span', { className: `cnt ${c.role}`, text: `${String(c.n)} ${word}` }));
    }
    const ol = chrome(doc, 'ol');
    for (const id of vals) {
      const r = rules.get(id);
      const inner: HTMLElement[] = [chrome(doc, 'span', { className: 'rid', text: id })];
      if (r !== undefined && r.title !== '') inner.push(chrome(doc, 'span', { className: 'rtitle', text: r.title }));
      const lead = r === undefined ? chrome(doc, 'div', {}, inner) : chrome(doc, 'a', { className: 'rlink', attrs: { href: `#${id}` } }, inner);
      const st = r?.status ?? null;
      const mark = st === null ? chrome(doc, 'span') : chrome(doc, 'span', { className: `pill ${st.role}`, text: st.text });
      ol.appendChild(chrome(doc, 'li', {}, [lead, mark]));
    }
    facts.block(ol);
  });
  // A key was taken, so the panel exists.
  if (total > 0 && (total <= OPEN_MAX || (total <= WIDE_MAX && ctx.env.matches('(min-width: 700px)')))) {
    ctx.journal.setAttribute(facts.panel as HTMLElement, 'open', '');
  }
}

/** Build this feature during startup: only with `rules: true`. */
export function build(ctx: FeatureContext): void {
  if (!ctx.options.rules) return;
  const rules = new Map<string, Rule>();
  for (const p of Array.from(ctx.root.querySelectorAll('p')) as HTMLElement[]) buildRule(ctx, p, rules);
  buildIndex(ctx, rules);
}
