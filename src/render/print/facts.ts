// The reading time and the facts panel (print mode; src/enhance/reading.ts and editorial.ts's buildFacts). The panel is
// `details.doc-facts` (open: paper cannot open it), a summary that counts each list key of the front matter, and the keys
// in a `dl`; the rules index (rules.ts) takes its keys out and puts its parts and its list in, through the same seam.
import type { FrontEntry } from '../types.js';
import type { FactsSeam } from './context.js';
import { all, append, detach, el, hasClass, insert, isEl, text, textOf, withClass, type ElN, type N } from './tree.js';

/** Words in a text: runs of characters other than space, tab, line feed, carriage return and no-break space. */
export function words(s: string): number {
  let n = 0;
  let inWord = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    const space = c === 32 || c === 10 || c === 9 || c === 13 || c === 160;
    if (!space && !inWord) n += 1;
    inWord = !space;
  }
  return n;
}

type Contribution = readonly [prose: number, code: number, figures: number];

function member(n: ElN): Contribution {
  if (n.name === 'script' || n.name === 'dl') return [0, 0, 0];
  if (n.name === 'figure') return [0, 0, 1];
  const total = words(textOf(n));
  if (hasClass(n, 'codehilite') || n.name === 'pre') return [0, total, 0];
  let code = 0;
  let figures = 0;
  if (n.kids.some(isEl)) {
    for (const x of all(n, withClass('codehilite'))) code += words(textOf(x));
    figures = all(n, (e) => e.name === 'figure').length;
  }
  return [Math.max(0, total - code), code, figures];
}

const minutesOf = (heading: ElN | null, members: readonly ElN[]): number => {
  let prose = heading === null ? 0 : words(textOf(heading));
  let code = 0;
  let figures = 0;
  for (const m of members) {
    const [p, c, f] = member(m);
    prose += p;
    code += c;
    figures += f;
  }
  return prose / 230 + code / 520 + figures * 0.5;
};

/** The reading time of the whole document, in minutes: the root's children cut into sections at every h1 and h2. */
export function documentMinutes(root: ElN): number {
  let total = 0;
  let heading: ElN | null = null;
  let members: ElN[] = [];
  for (const c of root.kids) {
    if (!isEl(c)) continue;
    if (c.name === 'h1' || c.name === 'h2') {
      total += minutesOf(heading, members);
      heading = c;
      members = [];
    } else members.push(c);
  }
  return total + minutesOf(heading, members);
}

/** A document's time, for the byline: "7 min", "1 h", "1 h 20 min". */
export function formatLong(m: number): string {
  const r = Math.max(1, Math.round(m));
  if (r < 60) return `${String(r)} min`;
  const t = Math.round(r / 10) * 10;
  const h = Math.floor(t / 60);
  const mm = t % 60;
  return `${String(h)} h${mm === 0 ? '' : ` ${String(mm)} min`}`;
}

/** The seam of a document with no panel: it takes nothing and holds nothing. */
export const noFacts: FactsSeam = { take: () => null, summary: () => undefined, block: () => undefined };

/** The facts panel of `lists` (the front matter's list keys, each with values), and the seam a plugin builds into. */
export function buildFacts(lists: readonly FrontEntry[]): { readonly panel: ElN; readonly seam: FactsSeam } {
  const sum = el('summary');
  const dl = el('dl');
  const body = el('div', 'facts-body', [dl]);
  const keys: { readonly key: string; readonly part: string; readonly dt: ElN; readonly dd: ElN; readonly vals: readonly string[] }[] = [];
  for (const f of lists) {
    const dt = el('dt', undefined, [f.key]);
    const dd = el('dd');
    f.vals.forEach((v, i) => {
      if (i > 0) append(dd, text(', '));
      append(dd, el('code', undefined, [v]));
    });
    append(dl, dt);
    append(dl, dd);
    keys.push({ key: f.key, part: `${String(f.vals.length)} ${f.key}`, dt, dd, vals: [...f.vals] });
  }
  const plugin: ElN[] = [];
  const paint = (): void => {
    for (const k of [...sum.kids]) detach(k);
    const parts: N[] = [...plugin, ...keys.map((k) => text(k.part))];
    parts.forEach((p, i) => {
      if (i > 0) append(sum, el('span', 'sep', [' · ']));
      append(sum, p);
    });
  };
  paint();
  const panel = el('details', 'doc-facts', [sum, body]);
  const seam: FactsSeam = {
    take(key) {
      const at = keys.findIndex((k) => k.key === key);
      const k = keys[at];
      if (k === undefined) return null;
      keys.splice(at, 1);
      detach(k.dt);
      detach(k.dd);
      if (dl.kids.length === 0) detach(dl);
      paint();
      return k.vals;
    },
    summary(part) {
      plugin.push(part);
      paint();
    },
    block(node) {
      insert(body, node, dl.up === body ? dl : null);
    },
  };
  return { panel, seam };
}
