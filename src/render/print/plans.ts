// Plan marks (print mode; src/enhance/plans.ts): each task heading's `span.task-id` chip ("Task 3") with its `span.tmeta`
// step count and owner, each step's `span.step-no` ("Step 2") with its `span.who` owner, and `li.attn` on a step that names
// the reader. The reader keeps the owner's brackets and the colon in hidden chrome; print does not print them. Outline mode
// never applies in print, so no task is folded and no part is marked.
import type { PrintCtx } from './context.js';
import { addClass, all, append, detach, el, insert, isEl, isText, named, nextEl, split, squash, textOf, wrap, hasClass, type ElN, type TextN } from './tree.js';

const level = (n: ElN): number => (/^h[1-6]$/.test(n.name) ? Number(n.name.slice(1)) : 0);

/** Whether `n` ends the task whose heading is `h`: a heading of its level or above, or "In short"'s box, which holds one. */
function ends(h: ElN, n: ElN): boolean {
  const l = level(n);
  if (l > 0) return l <= level(h);
  return hasClass(n, 'short') && all(n, named('h1', 'h2', 'h3')).some((x) => level(x) <= level(h));
}

export function buildPlans(ctx: PrintCtx): void {
  const { root, vocab } = ctx;

  for (const h of all(root, named('h2', 'h3'))) {
    const t = h.kids[0];
    if (t === undefined || !isText(t)) continue;
    const m = vocab.plan.task.exec(t.data);
    if (m === null) continue;
    const no = m[2] as string;
    let steps = 0;
    let who = '';
    for (let n = nextEl(h); n !== null && !ends(h, n); n = nextEl(n)) {
      if (n.name === 'ul' || n.name === 'ol') {
        for (const li of n.kids) if (isEl(li) && hasClass(li, 'task-list-item')) steps += 1;
      }
      if (who === '' && n.name === 'p') {
        const raw = textOf(n);
        if (vocab.plan.who.test(raw)) who = vocab.plan.who.exec(squash(raw))?.[1] ?? '';
      }
    }
    const idEnd = t.data.indexOf(no, (m[1] as string).length) + no.length;
    if (m[0].length < t.data.length) split(t, m[0].length);
    const sep = split(t, idEnd);
    const badge = wrap([t], el('span', 'task-id'));
    detach(sep);
    if (steps > 0) append(badge, el('span', 'tmeta', [`${String(steps)} ${steps === 1 ? 'step' : 'steps'}`]));
    if (who !== '') append(badge, el('span', vocab.addressee.test(who) ? 'tmeta yours' : 'tmeta', [who]));
    addClass(h, 'task');
    ctx.plan.tasks += 1;
  }

  const items = all(root, (e) => e.name === 'li' && hasClass(e, 'task-list-item'));
  for (const li of items) {
    const box = (c: ElN): boolean => c.name === 'input' && c.attrs.some((a) => a[0] === 'type' && a[1] === 'checkbox');
    const kids = li.kids.filter(isEl);
    const firstP = kids[0]?.name === 'p' ? kids[0] : undefined;
    const cb = kids.find(box) ?? firstP?.kids.filter(isEl).find(box) ?? null;
    const s = kids.find((c) => c.name === 'strong') ?? (cb?.up === null || cb === null ? undefined : cb.up.kids.filter(isEl).find((c) => c.name === 'strong')) ?? null;
    const first = s?.kids[0];
    if (s !== null && s !== undefined && first !== undefined && isText(first)) {
      const m = vocab.plan.step.exec(first.data);
      if (m !== null) {
        const title = m[1] as string;
        const owner = m[2];
        if (m[0].length < first.data.length) split(first, m[0].length);
        const after = split(first, title.length);
        const badge = el('span', 'step-no');
        insert(s.up as ElN, badge, s);
        append(badge, first);
        if (owner === undefined) detach(after);
        else {
          const ownerText: TextN = split(after, after.data.indexOf('(') + 1);
          const tail = split(ownerText, owner.length);
          const whoEl = el('span', 'who');
          append(badge, whoEl);
          append(whoEl, ownerText);
          detach(after);
          detach(tail);
          if (vocab.addresseeAnywhere.test(owner)) {
            ctx.plan.yours += 1;
            addClass(li, 'attn');
          }
        }
      }
    }
    if (s !== null && s !== undefined && s.kids.length === 0) detach(s);
    ctx.plan.steps += 1;
  }
}
