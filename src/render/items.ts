// The item values of a document (docserver parity, Task 4; the first consumer's design, section 6): the keys the reader
// would ask its host `itemLink` for, read from the html render() made, so a host can resolve them before it mounts the frame.
// Pure: it reads the html as text, with a small tree of its own, never a DOM.
//
// The reader (src/enhance/editorial.ts) asks `itemLink` for a key by two routes, and this file reads exactly those, over
// the same words (the vocabulary's `itemFields` and `itemHeadings`) and the same grammars:
//   - the byline route: the meta paragraph under the document's first level-1 heading (its first child a `strong`, a " · "
//     in its text, not ending on a colon) is split at its " · " separators into facts; the first fact labelled with an item
//     field ("Tracker: AB-12") gives every key in its text (outside a link) and every `code` element whose text is a key;
//   - the delta route: the first level-2 section, a child of the root, whose heading is an item heading and whose first code
//     block opens (its first line that is not blank) with `item: <key>`; a section whose first code block names none passes
//     to the next one.
// The reader asks for the delta key first, and for the byline's keys only when the host gave no link for it; a host cannot be
// told which, so both routes are listed, in document order (the byline's keys, then the delta's key, as the document has
// them). The reader asks for at most 16 distinct keys and writes at most 64 links; the list holds up to 50 (a host that
// resolves more than the reader draws loses nothing). A document that names none, or a render with no `reader`, answers [].
//
// Regexes here are copies of src/enhance/vocab.ts's (the grammar is the format's, the words are the host's, matched as
// words, never as patterns); test/render-items.test.ts holds each copy equal to its original. Everything the reader would
// not see stays unread: a key in the body, in a heading or in a table is no item.

/** The most item values `meta.items` lists. */
export const MAX_ITEMS = 50;
/** The longest item value, in code units; a longer key is left out, never cut. */
export const ITEM_VALUE_MAX_CODE_UNITS = 100;
/** The most words in a vocabulary list, and the longest word: src/enhance/options.ts's LIMITS.words and LIMITS.word. */
const LIST_MAX = 200;
const WORD_MAX = 64;

/** An item key: a capital, 1 to 9 capitals or digits, a dash, a number (src/enhance/vocab.ts's ITEM_KEY). */
export const ITEM_KEY_SOURCE = '[A-Z][A-Z0-9]{1,9}-\\d+';
const ITEM_KEY = new RegExp(`^${ITEM_KEY_SOURCE}$`);

/** A fresh global scan for the keys of a text, with no word character or dash on either side. Group 1 is the key. */
export const itemKeyScan = (): RegExp => new RegExp(`(?<![\\w-])(${ITEM_KEY_SOURCE})(?![\\w-])`, 'g');

/** A delta block's item line, the whole line (src/enhance/vocab.ts's itemLine). */
export const ITEM_LINE = /^item:\s*(\S+)$/;

/** The keys a vocabulary may hold: the shape of ReaderVocabulary. */
const VOCABULARY_KEYS: readonly string[] = [
  'status', 'statusHeaders', 'rulingHeaders', 'attention', 'ids', 'ruleIds', 'qualifiers', 'plan', 'addressees', 'itemFields', 'itemHeadings',
];

/** A word with every pattern metacharacter escaped, so it matches itself and nothing else. */
const literal = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** One alternation group of the words, each literal; a pattern that never matches when there are none. */
const anyOf = (words: readonly string[]): string => (words.length === 0 ? '(?!)' : `(?:${words.map(literal).join('|')})`);

/** A heading's words: each part literal, a space or a dash between parts (src/enhance/vocab.ts's heading()). */
const headingOf = (words: readonly string[]): string =>
  words.length === 0 ? '(?!)' : `(?:${words.map((h) => h.split(/[- ]+/).map(literal).join('[- ]')).join('|')})`;

/** The two patterns the item routes read, compiled from the host's words. Exported for the test that holds them to the reader's. */
export interface ItemPatterns {
  readonly field: RegExp;
  readonly heading: RegExp;
}

export function itemPatterns(fields: readonly string[], headings: readonly string[]): ItemPatterns {
  return {
    field: new RegExp(`^${anyOf(fields)}$`, 'i'),
    heading: new RegExp(`^(?:\\d+\\.\\s*)?${headingOf(headings)}$`, 'i'),
  };
}

/** The item lists of a `reader` option, checked: a TypeError for a shape that is not one, else the two lists (empty when absent). */
export function readerItemWords(reader: unknown): { readonly fields: readonly string[]; readonly headings: readonly string[] } {
  if (reader === undefined) return { fields: [], headings: [] };
  const proto: unknown = typeof reader === 'object' && reader !== null && !Array.isArray(reader) ? Object.getPrototypeOf(reader) : undefined;
  if (typeof reader !== 'object' || reader === null || (proto !== Object.prototype && proto !== null)) {
    throw new TypeError('render: reader must be a plain object');
  }
  const lists: Record<string, readonly string[]> = { itemFields: [], itemHeadings: [] };
  for (const k of Object.getOwnPropertyNames(reader)) {
    if (!VOCABULARY_KEYS.includes(k)) throw new TypeError(`render: reader has an unknown key ${k}`);
    const d = Object.getOwnPropertyDescriptor(reader, k);
    if (d === undefined || !('value' in d)) throw new TypeError(`render: reader.${k} must be a plain value, not a getter`);
    if (k !== 'itemFields' && k !== 'itemHeadings') continue;
    const v: unknown = d.value;
    if (v === undefined) continue;
    if (!Array.isArray(v) || v.length > LIST_MAX) throw new TypeError(`render: reader.${k} must be a list of at most ${String(LIST_MAX)} words`);
    const words: string[] = [];
    for (let i = 0; i < v.length; i += 1) {
      const w: unknown = Object.getOwnPropertyDescriptor(v, String(i))?.value;
      if (typeof w !== 'string' || w.length < 1 || w.length > WORD_MAX || w.trim() !== w) {
        throw new TypeError(`render: reader.${k} holds a word that is not 1 to ${String(WORD_MAX)} code units without outer white space`);
      }
      words.push(w);
    }
    lists[k] = words;
  }
  return { fields: lists['itemFields'] ?? [], headings: lists['itemHeadings'] ?? [] };
}

// ── a small tree of the html, as the browser's parser would make it from render()'s own output

interface TextNode {
  readonly k: 't';
  readonly data: string;
  /** Where the node comes in document order (a preorder count), and the offset of its first character in the source text. */
  readonly at: number;
  readonly off: number;
}
interface ElNode {
  readonly k: 'e';
  readonly name: string;
  readonly classes: readonly string[];
  readonly kids: Node[];
  readonly at: number;
}
interface CommentNode {
  readonly k: 'c';
}
type Node = TextNode | ElNode | CommentNode;

/** Elements with no end tag. */
const VOID = new Set(['br', 'hr', 'img', 'input', 'wbr']);

const ENTITY = /&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi;
const NAMED: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** The text of an html text run: the entities render() writes read back (numeric ones and the five named). */
function decode(s: string): string {
  if (s.indexOf('&') < 0) return s;
  return s.replace(ENTITY, (m, e: string) => {
    if (e.charAt(0) !== '#') return NAMED[e.toLowerCase()] ?? m;
    const n = e.charAt(1).toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return n >= 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : m;
  });
}

/** A tag's `class` attribute as words; render() writes attribute values quoted and escaped, so a plain read is exact. */
function classesOf(attrs: string): readonly string[] {
  const m = /\sclass="([^"]*)"/.exec(attrs);
  return m === null ? [] : decode(m[1] ?? '').split(/\s+/).filter((c) => c !== '');
}

/**
 * The html as a tree: a tag runs to the next `>` (render() escapes every `>` and `<` in a value), a comment to its `-->`,
 * and an end tag closes the nearest open element of its name. Text between two tags is one node (a comment, being its
 * own node, splits it, as it does in a browser).
 */
function parse(html: string): ElNode {
  let at = 0;
  const root: ElNode = { k: 'e', name: '', classes: [], kids: [], at: at++ };
  const stack: ElNode[] = [root];
  const current = (): ElNode => stack[stack.length - 1] ?? root;
  let i = 0;
  const n = html.length;
  while (i < n) {
    if (html.charCodeAt(i) !== 60) {
      let end = html.indexOf('<', i);
      if (end < 0) end = n;
      current().kids.push({ k: 't', data: decode(html.slice(i, end)), at: at++, off: 0 });
      i = end;
      continue;
    }
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      current().kids.push({ k: 'c' });
      i = end < 0 ? n : end + 3;
      continue;
    }
    const close = html.indexOf('>', i);
    const tag = close < 0 ? null : /^<(\/?)([A-Za-z][A-Za-z0-9]*)([^]*)$/.exec(html.slice(i, close));
    if (tag === null || close < 0) {
      // Not a tag: its `<` is text.
      current().kids.push({ k: 't', data: '<', at: at++, off: 0 });
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
      const el: ElNode = { k: 'e', name, classes: classesOf(tag[3] ?? ''), kids: [], at: at++ };
      current().kids.push(el);
      if (!VOID.has(name)) stack.push(el);
    }
    i = close + 1;
  }
  return root;
}

const isEl = (n: Node | undefined): n is ElNode => n !== undefined && n.k === 'e';
const isText = (n: Node | undefined): n is TextNode => n !== undefined && n.k === 't';

/** A node's text content (comments hold none). */
function textOf(n: Node): string {
  if (n.k === 't') return n.data;
  if (n.k === 'c') return '';
  let s = '';
  for (const c of n.kids) s += textOf(c);
  return s;
}

/** A node's text, runs of white space as one space, trimmed (editorial.ts's txt). */
const txt = (n: Node): string => textOf(n).replace(/\s+/g, ' ').trim();

const isBlank = (n: Node): boolean => n.k === 't' && n.data.trim() === '';
const isStrong = (n: Node | undefined): n is ElNode => isEl(n) && n.name === 'strong';

/** The first element named `name` in document order, with the elements around it; null when there is none. */
function find(n: ElNode, name: string): { readonly el: ElNode; readonly container: ElNode } | null {
  for (const c of n.kids) {
    if (!isEl(c)) continue;
    if (c.name === name) return { el: c, container: n };
    const inner = find(c, name);
    if (inner !== null) return inner;
  }
  return null;
}

/** The first descendant element named `name`, or null. */
const descendant = (n: ElNode, name: string): ElNode | null => find(n, name)?.el ?? null;

// ── the byline route

/** A separator of the meta line: a middle dot with white space on both sides. */
const SEP = /\s+·\s+/;

/** The paragraph under the title that carries the byline (editorial.ts's metaParagraph), among the title's following siblings. */
function metaParagraph(siblings: readonly ElNode[], after: number): ElNode | null {
  for (let i = after + 1; i < siblings.length; i += 1) {
    const n = siblings[i];
    if (n === undefined || n.name === 'h2') return null;
    if (n.name !== 'p' || !isStrong(n.kids[0])) continue;
    const t = textOf(n);
    if (/ · /.test(t) && !/:\s*$/.test(t)) return n;
  }
  return null;
}

/** Split every text child of `p` at its separators, and return the runs of nodes between them (editorial.ts's segments). */
function segments(p: ElNode): Node[][] {
  const segs: Node[][] = [[]];
  const last = (): Node[] => segs[segs.length - 1] as Node[];
  for (const c of p.kids) {
    if (!isText(c)) {
      last().push(c);
      continue;
    }
    let rest = c.data;
    let base = 0;
    for (;;) {
      const m = SEP.exec(rest);
      if (m === null) {
        if (rest !== '') last().push({ k: 't', data: rest, at: c.at, off: base });
        break;
      }
      if (m.index > 0) last().push({ k: 't', data: rest.slice(0, m.index), at: c.at, off: base });
      segs.push([]);
      rest = rest.slice(m.index + m[0].length);
      base += m.index + m[0].length;
    }
  }
  return segs;
}

/** A key the document names, and where, for the document order. */
interface Spot {
  readonly key: string;
  readonly at: number;
  readonly off: number;
}

/** The keys of the nodes of an item fact: in each text (outside a link), and each `code` element whose text is a key. */
function keysIn(nodes: readonly Node[], out: Spot[]): void {
  const walk = (n: Node): void => {
    if (n.k === 't') {
      for (const m of n.data.matchAll(itemKeyScan())) out.push({ key: m[1] ?? '', at: n.at, off: n.off + m.index });
      return;
    }
    if (n.k !== 'e' || n.name === 'a') return; // an author's link stays the author's
    if (n.name === 'code') {
      if (ITEM_KEY.test(txt(n))) out.push({ key: txt(n), at: n.at, off: 0 });
      return;
    }
    for (const c of n.kids) walk(c);
  };
  for (const n of nodes) walk(n);
}

/** The byline's item fact, and the keys in it (editorial.ts's buildByline, to the point where it names its item nodes). */
function bylineKeys(p: ElNode, field: RegExp, out: Spot[]): void {
  const segs = segments(p);
  const first = (segs[0] ?? []).filter((n) => !isBlank(n));
  const lone = first[0];
  if (first.length === 1 && isStrong(lone) && !/:\s*$/.test(textOf(lone))) segs.shift(); // the document's kind: no fact
  const labels = new Set<string>();
  for (const seg of segs) {
    const at = seg.findIndex((n) => !isBlank(n));
    if (at < 0) continue;
    const f = seg[at] as Node;
    let moved = seg.slice(at);
    let dt = '';
    if (isStrong(f) && /:\s*$/.test(textOf(f))) {
      dt = txt(f).replace(/:$/, '');
      moved = seg.slice(at + 1); // the label stays behind; its words are the dt
    } else if (isText(f)) {
      const m = /^\s*([A-Z][A-Za-z ]{0,18}):\s*/.exec(f.data);
      if (m !== null) {
        dt = m[1] ?? '';
        const rest = m[0].length < f.data.length ? ({ k: 't', data: f.data.slice(m[0].length), at: f.at, off: f.off + m[0].length } as const) : null;
        moved = rest === null ? seg.slice(at + 1) : [rest, ...seg.slice(at + 1)];
      } else if (/^\s*\d{4}-\d{2}-\d{2}/.test(f.data)) dt = 'Date';
      else if (!labels.has('Status')) dt = 'Status';
    }
    if (dt !== '') labels.add(dt);
    if (field.test(dt)) {
      keysIn(moved, out);
      return; // the first fact labelled with an item field is the item fact
    }
  }
}

// ── the delta route

/** The delta route's key: see the header. Null when there is none. */
function deltaKey(rootKids: readonly ElNode[], heading: RegExp): Spot | null {
  for (let i = 0; i < rootKids.length; i += 1) {
    const h = rootKids[i];
    if (h === undefined || h.name !== 'h2' || !heading.test(txt(h))) continue;
    for (let j = i + 1; j < rootKids.length; j += 1) {
      const n = rootKids[j];
      if (n === undefined || n.name === 'h2') break;
      const pre = n.name === 'pre' ? n : n.classes.includes('codehilite') ? descendant(n, 'pre') : null;
      if (pre === null) continue;
      const line = textOf(pre).split('\n').find((l) => l.trim() !== '') ?? '';
      const key = ITEM_LINE.exec(line.trim())?.[1];
      if (key !== undefined && ITEM_KEY.test(key)) return { key, at: pre.at, off: 0 };
      break; // the section's first code block is its delta
    }
  }
  return null;
}

/**
 * The item values of `html`, which render() made: both routes, in document order, each value once, at most MAX_ITEMS of at
 * most ITEM_VALUE_MAX_CODE_UNITS code units (a longer one is left out, and does not count). Empty when `fields` and
 * `headings` are. Never throws: what cannot be read gives none.
 */
export function collectItems(html: string, fields: readonly string[], headings: readonly string[]): readonly string[] {
  if (fields.length === 0 && headings.length === 0) return [];
  try {
    const patterns = itemPatterns(fields, headings);
    const root = parse(html);
    const h1 = find(root, 'h1');
    if (h1 === null) return [];
    const spots: Spot[] = [];
    const siblings = h1.container.kids.filter(isEl);
    const meta = metaParagraph(siblings, siblings.indexOf(h1.el));
    if (meta !== null) bylineKeys(meta, patterns.field, spots);
    const delta = deltaKey(root.kids.filter(isEl), patterns.heading);
    if (delta !== null) spots.push(delta);
    spots.sort((a, b) => a.at - b.at || a.off - b.off);
    const out: string[] = [];
    for (const { key } of spots) {
      if (out.length >= MAX_ITEMS) break;
      if (key.length > ITEM_VALUE_MAX_CODE_UNITS || out.includes(key)) continue;
      out.push(key);
    }
    return out;
  } catch {
    return [];
  }
}
