// A small DOM-free tree of render()'s own html, and the writer that serialises it again (print mode, docserver parity
// Task 7). The input is only ever what render() wrote: every `<` and `>` of a value is an entity there, so a tag is a tag
// render() emitted and the document's own text never becomes an element (test/render-print.test.ts holds that). Text is held
// decoded and written escaped; an attribute is written only when `keep` names it.
import { pyEscape } from '../escape.js';

export interface TextN {
  readonly k: 't';
  data: string;
  up: ElN | null;
  /** Where the node was last known to stand in its parent's `kids` (a hint: see `idx`). */
  at: number;
}
export interface ElN {
  readonly k: 'e';
  readonly name: string;
  attrs: [string, string][];
  kids: N[];
  up: ElN | null;
  at: number;
}
export type N = TextN | ElN;

/** Elements with no end tag. */
const VOID = new Set(['br', 'hr', 'img', 'input', 'wbr']);

const ENTITY = /&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi;
const NAMED: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** The text an html text run holds: the entities render() writes read back. */
function decode(s: string): string {
  if (s.indexOf('&') < 0) return s;
  return s.replace(ENTITY, (m, e: string) => {
    if (e.charAt(0) !== '#') return NAMED[e.toLowerCase()] ?? m;
    const n = e.charAt(1).toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return n >= 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : m;
  });
}

const ATTR = /\s([A-Za-z_:][-A-Za-z0-9_:.]*)(?:="([^"]*)")?/g;

export const el = (name: string, classes?: string, kids: (N | string)[] = []): ElN => {
  const e: ElN = { k: 'e', name, attrs: [], kids: [], up: null, at: 0 };
  if (classes !== undefined && classes !== '') e.attrs.push(['class', classes]);
  for (const c of kids) append(e, typeof c === 'string' ? text(c) : c);
  return e;
};
export const text = (data: string): TextN => ({ k: 't', data, up: null, at: 0 });

/** The html as a tree under an unnamed root. A comment is dropped; an end tag closes the nearest open element of its name. */
export function parse(html: string): ElN {
  const root: ElN = { k: 'e', name: '', attrs: [], kids: [], up: null, at: 0 };
  const stack: ElN[] = [root];
  const current = (): ElN => stack[stack.length - 1] ?? root;
  const push = (n: N): void => {
    const p = current();
    n.up = p;
    n.at = p.kids.length;
    p.kids.push(n);
  };
  let i = 0;
  const n = html.length;
  while (i < n) {
    if (html.charCodeAt(i) !== 60) {
      let end = html.indexOf('<', i);
      if (end < 0) end = n;
      push(text(decode(html.slice(i, end))));
      i = end;
      continue;
    }
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      i = end < 0 ? n : end + 3;
      continue;
    }
    const close = html.indexOf('>', i);
    const tag = close < 0 ? null : /^<(\/?)([A-Za-z][A-Za-z0-9]*)([^]*)$/.exec(html.slice(i, close));
    if (tag === null || close < 0) {
      push(text('<'));
      i += 1;
      continue;
    }
    const name = (tag[2] ?? '').toLowerCase();
    if (tag[1] === '/') {
      for (let s = stack.length - 1; s > 0; s -= 1) {
        if (stack[s]?.name === name) {
          stack.length = s;
          break;
        }
      }
    } else {
      const e: ElN = { k: 'e', name, attrs: [], kids: [], up: null, at: 0 };
      for (const m of (tag[3] ?? '').matchAll(ATTR)) e.attrs.push([(m[1] ?? '').toLowerCase(), decode(m[2] ?? '')]);
      push(e);
      if (!VOID.has(name)) stack.push(e);
    }
    i = close + 1;
  }
  return root;
}

// ── reading

export const isEl = (n: N | null | undefined): n is ElN => n !== null && n !== undefined && n.k === 'e';
export const isText = (n: N | null | undefined): n is TextN => n !== null && n !== undefined && n.k === 't';

export const attr = (e: ElN, name: string): string | null => e.attrs.find((a) => a[0] === name)?.[1] ?? null;
export const classes = (e: ElN): string[] => (attr(e, 'class') ?? '').split(/\s+/).filter((c) => c !== '');
export const hasClass = (e: ElN, c: string): boolean => classes(e).includes(c);

export function setAttr(e: ElN, name: string, value: string): void {
  const a = e.attrs.find((x) => x[0] === name);
  if (a === undefined) e.attrs.push([name, value]);
  else a[1] = value;
}
export function addClass(e: ElN, c: string): void {
  if (!hasClass(e, c)) setAttr(e, 'class', [...classes(e), c].join(' '));
}

/** The text content of a node. */
export function textOf(n: N): string {
  if (n.k === 't') return n.data;
  let s = '';
  for (const c of n.kids) s += textOf(c);
  return s;
}

/** A text with its white space runs as one space, trimmed. */
export const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();
/** A node's text, squashed. */
export const txt = (n: N): string => squash(textOf(n));

export const elements = (e: ElN): ElN[] => e.kids.filter(isEl);

/**
 * The position of `n` among its parent's children (-1 when it has none). Each node keeps the position it was last at, so a
 * walk over the children of a block-heavy document costs one look per step; after an insertion or removal the hint is off by
 * the distance the siblings moved, and the search goes outward from it, so it costs that distance, never the document.
 */
function idx(n: N): number {
  const p = n.up;
  if (p === null) return -1;
  const k = p.kids;
  const from = n.at;
  if (k[from] === n) return from;
  for (let d = 1; d < k.length + from; d += 1) {
    if (k[from - d] === n) return (n.at = from - d);
    if (k[from + d] === n) return (n.at = from + d);
  }
  return -1;
}

export function nextEl(n: N): ElN | null {
  const p = n.up;
  if (p === null) return null;
  for (let i = idx(n) + 1; i < p.kids.length; i += 1) {
    const c = p.kids[i];
    if (isEl(c)) return c;
  }
  return null;
}
export function prevEl(n: N): ElN | null {
  const p = n.up;
  if (p === null) return null;
  for (let i = idx(n) - 1; i >= 0; i -= 1) {
    const c = p.kids[i];
    if (isEl(c)) return c;
  }
  return null;
}
export const nextSibling = (n: N): N | null => n.up?.kids[idx(n) + 1] ?? null;

/** Every element under `root` (not `root`) for which `pred` holds, in document order. */
export function all(root: ElN, pred: (e: ElN) => boolean): ElN[] {
  const out: ElN[] = [];
  const walk = (n: ElN): void => {
    for (const c of n.kids) {
      if (!isEl(c)) continue;
      if (pred(c)) out.push(c);
      walk(c);
    }
  };
  walk(root);
  return out;
}
export const first = (root: ElN, pred: (e: ElN) => boolean): ElN | null => all(root, pred)[0] ?? null;
export const named = (...names: string[]) => (e: ElN): boolean => names.includes(e.name);
export const withClass = (c: string) => (e: ElN): boolean => hasClass(e, c);

// ── writing

/** Every child of `p` from position `from` on knows its position again (after a splice moved them). */
function renumber(p: ElN, from: number): void {
  for (let i = from; i < p.kids.length; i += 1) (p.kids[i] as N).at = i;
}

export function detach(n: N): void {
  const p = n.up;
  if (p === null) return;
  const i = idx(n);
  if (i >= 0) {
    p.kids.splice(i, 1);
    renumber(p, i);
  }
  n.up = null;
}
/**
 * Take every node of `nodes` out of its parent in one pass over each parent (compact the children in place, once), not one splice
 * and one renumber per node: a paragraph of k joins costs O(k), not O(k^2). A node already detached is skipped.
 */
export function detachAll(nodes: readonly N[]): void {
  const byParent = new Map<ElN, Set<N>>();
  for (const n of nodes) {
    const p = n.up;
    if (p === null) continue;
    const set = byParent.get(p);
    if (set === undefined) byParent.set(p, new Set([n]));
    else set.add(n);
  }
  for (const [p, gone] of byParent) {
    let w = 0;
    for (const c of p.kids) {
      if (gone.has(c)) continue;
      p.kids[w] = c;
      c.at = w;
      w += 1;
    }
    p.kids.length = w;
    for (const c of gone) c.up = null;
  }
}
export function append(p: ElN, n: N): void {
  detach(n);
  n.up = p;
  n.at = p.kids.length;
  p.kids.push(n);
}
/** Put `n` into `p` before `ref` (at the end when `ref` is null). */
export function insert(p: ElN, n: N, ref: N | null): void {
  detach(n);
  const at = ref === null ? p.kids.length : idx(ref);
  n.up = p;
  n.at = at < 0 ? p.kids.length : at;
  p.kids.splice(n.at, 0, n);
  renumber(p, n.at);
}
/** Put `n` where `after` is, right after it. */
export function insertAfter(after: N, n: N): void {
  const p = after.up as ElN;
  insert(p, n, nextSibling(after));
}
/** Put `wrapper` where the first of `nodes` is and move the nodes (adjacent siblings, in order) into it. */
export function wrap(nodes: readonly N[], wrapper: ElN): ElN {
  const f = nodes[0];
  const p = f?.up;
  if (f === undefined || p === null || p === undefined) return wrapper;
  const i = idx(f);
  // The run is adjacent siblings of one parent, in order: a caller that breaks that would drop siblings silently.
  if (nodes.some((n, j) => n.up !== p || idx(n) !== i + j)) throw new Error('print: wrap takes adjacent siblings of one parent, in order');
  detach(wrapper);
  p.kids.splice(i, nodes.length, wrapper);
  wrapper.up = p;
  renumber(p, i);
  const base = wrapper.kids.length;
  nodes.forEach((n, j) => {
    n.up = wrapper;
    n.at = base + j;
  });
  for (const n of nodes) wrapper.kids.push(n);
  return wrapper;
}
/** Cut a text node at `at`: it keeps the first part, a new text node right after it holds the rest, which is returned. */
export function split(t: TextN, at: number): TextN {
  const rest = text(t.data.slice(at));
  t.data = t.data.slice(0, at);
  insertAfter(t, rest);
  return rest;
}
/** The siblings from `from` up to, not including, `to` (to the end when null). */
export function run(from: N, to: N | null): N[] {
  const p = from.up as ElN;
  const a = idx(from);
  const b = to === null ? p.kids.length : idx(to);
  return p.kids.slice(a, b < 0 ? p.kids.length : b);
}

/** The attributes print mode writes. */
export const KEPT_ATTRS: readonly string[] = ['class', 'id', 'data-line', 'open', 'colspan', 'rowspan', 'align', 'alt', 'title', 'href'];

/**
 * The one attribute an `img` keeps besides KEPT_ATTRS: its `src`, render()'s own image reference exactly as the screen's html carries
 * it (the host resolves it through its image map, and drops a reference it has not loaded). No other element keeps one.
 */
export const KEPT_IMG_ATTRS: readonly string[] = ['src'];

/** The tree as html: text escaped, attributes only those in KEPT_ATTRS (and an img's src) (a void element closes with ` />`). */
export function serialize(n: N, out: string[] = []): string {
  if (n.k === 't') {
    out.push(pyEscape(n.data));
    return out.join('');
  }
  const write = (e: ElN): void => {
    if (e.name !== '') {
      out.push(`<${e.name}`);
      for (const [k, v] of e.attrs) if (KEPT_ATTRS.includes(k) || (e.name === 'img' && KEPT_IMG_ATTRS.includes(k))) out.push(` ${k}="${pyEscape(v)}"`);
      out.push(VOID.has(e.name) ? ' />' : '>');
    }
    if (VOID.has(e.name)) return;
    for (const c of e.kids) {
      if (c.k === 't') out.push(pyEscape(c.data));
      else write(c);
    }
    if (e.name !== '') out.push(`</${e.name}>`);
  };
  write(n);
  return out.join('');
}
