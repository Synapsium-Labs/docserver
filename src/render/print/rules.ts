// Rule paragraphs and the rules index (print mode; src/enhance/rules.ts, sections 3 and 4), only with `reader.rules`, as the
// reader builds them only with its `rules` option. A rule paragraph is `p.rule` whose first child is `span.rule-head`: the
// rule IDs' codes, then the status as `span.pill.<role>` (the status em's own nodes) and a note in brackets as `span.pill.info`.
// What the reader hides (the joins between codes, the dash, the emptied em, the brackets and the full stop) is not printed.
// The rules index is the facts panel's: its summary gets "Rules index · N rules" and the status counts, its body an `ol`.
// A rule's entry names no link (print has no anchors to go to), so its lead is a `div` (`div.rlink` for a rule found, whose
// ID, title and status the paragraph gave).
import type { PrintCtx } from './context.js';
import { statusOf } from './status.js';
import { addClass, all, detach, el, insert, isEl, isText, named, nextSibling, run, split, textOf, txt, wrap, append, type ElN, type N, type TextN } from './tree.js';
import type { StatusRole } from './vocab.js';

const TITLE_MAX = 120;
const DASH = /^\s*[—–-]\s/;
const DASH_CUT = /^\s*[—–-]\s*/;
const AFTER = /^\s*(\(([^)]{1,40})\))?\s*[.:]?\s*/;

/** The longest ID a rule defines, as the reader's index takes (src/enhance/registry.ts's NAME_MAX). */
const NAME_MAX = 200;

/** `s` with its runs of white space as one space, trimmed, and cut to at most `n` code units (src/enhance/text.ts's clip). */
export function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const space = t.lastIndexOf(' ', n - 1);
  let end = space > n * 0.6 ? space : n - 1;
  if (end > 0 && t.charCodeAt(end - 1) >= 0xd800 && t.charCodeAt(end - 1) <= 0xdbff) end -= 1;
  return `${t.slice(0, Math.max(0, end)).replace(/[\s,;:(—–-]+$/, '')}…`;
}

interface RuleStatus {
  readonly text: string;
  readonly role: StatusRole;
}
interface Rule {
  readonly title: string;
  readonly status: RuleStatus | null;
}

const isNamed = (n: N | null | undefined, name: string): n is ElN => n !== null && n !== undefined && isEl(n) && n.name === name;

function buildRule(ctx: PrintCtx, p: ElN, rules: Map<string, Rule>): void {
  const { vocab } = ctx;
  const isRuleCode = (n: N | null | undefined): n is ElN => isNamed(n, 'code') && vocab.ruleId.test(textOf(n).trim());
  const firstKid = p.kids[0];
  if (!isRuleCode(firstKid)) return;
  const codes: ElN[] = [];
  const joins: TextN[] = [];
  let n: N | null = firstKid;
  for (; n !== null; n = nextSibling(n)) {
    if (isRuleCode(n)) codes.push(n);
    else if (isText(n) && vocab.ruleIdJoin.test(n.data)) joins.push(n);
    else break;
  }
  if (n === null || !isText(n) || !DASH.test(n.data)) return;
  const dash: TextN = n;
  const cut = (DASH_CUT.exec(dash.data) as RegExpExecArray)[0].length;
  if (cut < dash.data.length) split(dash, cut);

  let marked: { readonly em: ElN; readonly status: RuleStatus } | null = null;
  let note: TextN | null = null;
  let last: N = dash;
  const s = nextSibling(dash);
  if (isNamed(s, 'em')) {
    const hit = statusOf(vocab, textOf(s));
    if (hit !== null) {
      marked = { em: s, status: { text: txt(s), role: hit.role } };
      last = s;
      const after = nextSibling(s);
      if (after !== null && isText(after)) {
        const m = AFTER.exec(after.data) as RegExpExecArray;
        const used = m[0].length;
        if (used > 0) {
          if (used < after.data.length) split(after, used);
          last = after;
          const w = m[2];
          if (w !== undefined) {
            note = split(after, m[0].indexOf('(') + 1);
            last = split(note, w.length);
          }
        }
      }
    }
  }

  const head = wrap(run(firstKid, nextSibling(last)), el('span', 'rule-head'));
  if (marked !== null) {
    const pill = el('span', `pill ${marked.status.role}`);
    insert(head, pill, dash);
    for (const c of [...marked.em.kids]) append(pill, c);
    if (note !== null) {
      const info = el('span', 'pill info');
      insert(head, info, dash);
      append(info, note);
    }
  }
  // Everything the reader hides, the joins and the dash with what follows, goes.
  for (const j of joins) detach(j);
  for (const x of run(dash, null)) {
    if (x.up === head) detach(x);
  }
  addClass(p, 'rule');

  const strong = p.kids.find((c): c is ElN => isEl(c) && c.name === 'strong');
  let title: string;
  if (strong !== undefined) title = txt(strong).replace(/[:.]$/, '');
  else {
    let rest = '';
    for (let c = nextSibling(head); c !== null; c = nextSibling(c)) rest += textOf(c);
    const sentence = rest.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/)[0] ?? '';
    title = clip(sentence.replace(/\.$/, ''), TITLE_MAX);
  }
  const status = marked === null ? null : marked.status;
  for (const c of codes) {
    const id = textOf(c).trim();
    if (id.length > NAME_MAX) continue;
    if (!rules.has(id)) rules.set(id, { title, status });
  }
}

function buildIndex(ctx: PrintCtx, rules: ReadonlyMap<string, Rule>): void {
  const front = ctx.front;
  if (front === null) return;
  const facts = ctx.facts;
  const isRuleKey = (f: { readonly vals: readonly string[] }): boolean => f.vals.every((v) => ctx.vocab.ruleId.test(v));
  const lists = front.filter((f) => f.list);
  lists.forEach((f, i) => {
    if (!isRuleKey(f)) return;
    if (lists.slice(0, i).some((o) => o.key === f.key && !isRuleKey(o))) return;
    const vals = facts.take(f.key);
    if (vals === null) return;
    const n = vals.length;
    const noun = n === 1 ? 'rule' : 'rules';
    const label = f.key === 'rules' ? `Rules index · ${String(n)} ${noun}` : `${f.key.charAt(0).toUpperCase()}${f.key.slice(1)} ${String(n)} ${noun}`;
    facts.summary(el('span', 'fs-k', [label]));
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
      facts.summary(el('span', `cnt ${c.role}`, [`${String(c.n)} ${word}`]));
    }
    const ol = el('ol');
    for (const id of vals) {
      const r = rules.get(id);
      const inner: ElN[] = [el('span', 'rid', [id])];
      if (r !== undefined && r.title !== '') inner.push(el('span', 'rtitle', [r.title]));
      const lead = el('div', r === undefined ? undefined : 'rlink', inner);
      const st = r?.status ?? null;
      const mark = st === null ? el('span') : el('span', `pill ${st.role}`, [st.text]);
      append(ol, el('li', undefined, [lead, mark]));
    }
    facts.block(ol);
  });
}

/** Build only with `reader.rules`. */
export function buildRules(ctx: PrintCtx): void {
  if (!ctx.rules) return;
  const rules = new Map<string, Rule>();
  for (const p of all(ctx.root, named('p'))) buildRule(ctx, p, rules);
  buildIndex(ctx, rules);
}
