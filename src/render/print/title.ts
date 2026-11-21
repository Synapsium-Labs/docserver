// The title block (print mode; src/enhance/editorial.ts, sections 1, 2 and 4): an eyebrow above the title, a byline of facts
// under it with the reading time, and the facts panel from the front matter. The meta line the byline is made from is not
// hidden but left out, as paper has no hidden. The reader's item links are the host's and have no print: the byline's item
// fact is a fact like any other.
import { findSeparator } from '../separator.js';
import type { PrintCtx } from './context.js';
import { buildFacts, formatLong, noFacts } from './facts.js';
import { addClass, append, detach, el, first, hasClass, insertAfter, insert, isEl, isText, named, nextEl, setAttr, attr, split, textOf, txt, type ElN, type N, type TextN } from './tree.js';

const isBlank = (n: N): boolean => n.k === 't' && n.data.trim() === '';
const isStrong = (n: N | undefined): n is ElN => n !== undefined && isEl(n) && n.name === 'strong';

/** The paragraph under the title that carries the byline: opens on bold text, holds a " · ", does not end on a colon. */
function metaParagraph(h1: ElN): ElN | null {
  for (let n = nextEl(h1); n !== null && n.name !== 'h2'; n = nextEl(n)) {
    if (n.name !== 'p' || !isStrong(n.kids[0])) continue;
    const t = textOf(n);
    if (/ · /.test(t) && !/:\s*$/.test(t)) return n;
  }
  return null;
}

/** Split every text child of `p` at its separators, and return the runs of nodes between them. */
function segments(p: ElN): N[][] {
  const seps = new Set<N>();
  for (const child of [...p.kids]) {
    if (!isText(child)) continue;
    let t: TextN = child;
    for (;;) {
      const m = findSeparator(t.data);
      if (m === null) break;
      const sep = m.index > 0 ? split(t, m.index) : t;
      const rest = m.length < sep.data.length ? split(sep, m.length) : null;
      seps.add(sep);
      if (rest === null) break;
      t = rest;
    }
  }
  const segs: N[][] = [[]];
  for (const n of p.kids) {
    if (seps.has(n)) segs.push([]);
    else segs[segs.length - 1]?.push(n);
  }
  return segs;
}

/** The byline and the document's kind from the meta paragraph, and the reading time. */
function buildByline(metaP: ElN | null, minutes: number): { readonly byline: ElN; readonly kinds: string[] } {
  const byline = el('dl', 'byline');
  const kinds: string[] = [];
  const facts: ElN[] = [];
  const keys = new Set<string>();
  const fact = (dt: string, dd: ElN, wide: boolean): ElN => {
    const d = el('div', wide ? 'wide' : undefined);
    if (dt !== '') {
      append(d, el('dt', undefined, [dt]));
      keys.add(dt);
    }
    append(d, dd);
    return d;
  };
  if (metaP !== null) {
    const segs = segments(metaP);
    const lead = (segs[0] ?? []).filter((n) => !isBlank(n));
    const lone = lead[0];
    if (lead.length === 1 && isStrong(lone) && !/:\s*$/.test(textOf(lone))) {
      kinds.push(txt(lone));
      segs.shift();
    }
    for (const seg of segs) {
      const at = seg.findIndex((n) => !isBlank(n));
      if (at < 0) continue;
      const f = seg[at] as N;
      let moved = seg.slice(at);
      let dt = '';
      if (isStrong(f) && /:\s*$/.test(textOf(f))) {
        dt = txt(f).replace(/:$/, '');
        moved = seg.slice(at + 1);
      } else if (isText(f)) {
        const m = /^\s*([A-Z][A-Za-z ]{0,18}):\s*/.exec(f.data);
        if (m !== null) {
          dt = m[1] ?? '';
          const rest = m[0].length < f.data.length ? split(f, m[0].length) : null;
          moved = rest === null ? seg.slice(at + 1) : [rest, ...seg.slice(at + 1)];
        } else if (/^\s*\d{4}-\d{2}-\d{2}/.test(f.data)) dt = 'Date';
        else if (!keys.has('Status')) dt = 'Status';
      }
      const len = moved.reduce((a, n) => a + textOf(n).length, 0);
      const dd = el('dd');
      for (const n of moved) append(dd, n);
      facts.push(fact(dt, dd, len > 70));
    }
    const line = attr(metaP, 'data-line');
    if (line !== null) setAttr(byline, 'data-line', line);
  }
  const beforeWide = (): number => {
    const wide = facts.findIndex((d) => hasClass(d, 'wide'));
    return wide < 0 ? facts.length : wide;
  };
  if (minutes >= 3) {
    const rt = fact('Reading time', el('dd', undefined, [`≈ ${formatLong(minutes)}`]), false);
    addClass(rt, 'rt');
    facts.splice(beforeWide(), 0, rt);
  }
  for (const d of facts) append(byline, d);
  if (facts.length === 1 && hasClass(facts[0] as ElN, 'rt')) addClass(byline, 'solo');
  return { byline, kinds };
}

/** Steps 1, 2 and 4 of the reader's editorial build, on `ctx.root`: the title block and the facts panel. */
export function buildTitle(ctx: PrintCtx, minutes: number): void {
  const { root } = ctx;
  const strip = first(root, (e) => e.name === 'dl' && hasClass(e, 'doc-meta'));
  if (strip !== null) detach(strip);
  const front = ctx.front !== null && ctx.front.length > 0 ? ctx.front : null;
  ctx.facts = noFacts;
  const h1 = first(root, named('h1'));
  if (h1 === null || h1.up === null) return;
  const up = h1.up;
  const meta = metaParagraph(h1);
  const { byline, kinds } = buildByline(meta, minutes);
  if (meta !== null) detach(meta);
  for (const f of front ?? []) if (!f.list && ctx.vocab.kindKey.test(f.key)) kinds.push(f.vals.join(', '));
  if (kinds.length > 0) insert(up, el('div', 'eyebrow', kinds.map((k) => el('span', undefined, [k]))), h1);
  let after: ElN = h1;
  if (byline.kids.some(isEl)) {
    insertAfter(h1, byline);
    after = byline;
    ctx.byline = byline;
  }
  const lists = (front ?? []).filter((f) => f.list && f.vals.length > 0);
  if (lists.length > 0) {
    const built = buildFacts(lists);
    insertAfter(after, built.panel);
    ctx.facts = built.seam;
  }
}
