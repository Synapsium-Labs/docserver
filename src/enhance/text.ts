// Text helpers every feature shares (docserver L2, Task 7a), ported from the reference layout's prelude: clip a text
// for a title or a preview, hash a text for a fingerprint, compare two nodes' document order, and build the colour
// key, the one builder of it (Tasks 16 and 19 show it). Features reach them as `ctx.text`.
//
// Pure, and import-inert: no state, no DOM but the colour key's chrome, which is made with chrome() (journal.ts) and
// returned unattached, for the feature to insert through its journal.
import { chrome } from './journal.js';
import { defaultVocabulary, type ColourKeyEntry, type Vocab } from './vocab.js';

/** The bit of compareDocumentPosition that says the other node follows (Node.DOCUMENT_POSITION_FOLLOWING). */
const FOLLOWING = 4;

/** True when `c` is the first half of a surrogate pair. */
const isHighSurrogate = (c: number): boolean => c >= 0xd800 && c <= 0xdbff;

/**
 * `s` with its runs of white space as one space, trimmed, and cut to at most `n` code units: whole when it fits;
 * else at the last space past 60% of `n`, or else at `n - 1`, with trailing punctuation and spaces dropped and an
 * ellipsis added. A cut never splits a surrogate pair.
 */
export function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const space = t.lastIndexOf(' ', n - 1);
  let end = space > n * 0.6 ? space : n - 1;
  if (end > 0 && isHighSurrogate(t.charCodeAt(end - 1))) end -= 1;
  return `${t.slice(0, Math.max(0, end)).replace(/[\s,;:(—–-]+$/, '')}…`;
}

/** The 32-bit FNV-1a hash of `s`'s code units, in base 36: a short fingerprint, not a secure one. */
export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** True when `a` comes before `b` in document order (false for the same node). */
export function before(a: Node, b: Node): boolean {
  return a !== b && (a.compareDocumentPosition(b) & FOLLOWING) !== 0;
}

/** The nodes, in a new array, in document order. */
export function inOrder<T extends Node>(nodes: readonly T[]): T[] {
  return [...nodes].sort((a, b) => (a === b ? 0 : before(a, b) ? -1 : 1));
}

/**
 * The colour key, as chrome of `doc`: a `ul.ckey` with one item per colour role, each a swatch (`span.sw.k-<role>`,
 * hidden from assistive technology, since the label says it) and its label. The entries are the vocabulary's: a
 * feature calls `ctx.text.colourKey(doc)`, which passes its instance's (`ctx.vocab.colourKey`); without them, the
 * defaults. Unattached: the caller inserts it.
 */
export function colourKey(doc: Document, entries: readonly Readonly<ColourKeyEntry>[] = defaultVocabulary().colourKey): HTMLUListElement {
  const items = entries.map((e) =>
    chrome(doc, 'li', {}, [chrome(doc, 'span', { className: `sw k-${e.role}`, attrs: { 'aria-hidden': 'true' } }), doc.createTextNode(e.label)]),
  );
  return chrome(doc, 'ul', { className: 'ckey' }, items);
}

/** The helpers, as the context carries them. */
export interface TextTools {
  readonly clip: typeof clip;
  readonly hash: typeof hash;
  readonly before: typeof before;
  readonly inOrder: typeof inOrder;
  /** The colour key of the instance's vocabulary. */
  readonly colourKey: (doc: Document) => HTMLUListElement;
}

/** The helpers for one instance's context, frozen: the shared functions, and the colour key of `vocab`. */
export function textTools(vocab: Vocab): TextTools {
  return Object.freeze({ clip, hash, before, inOrder, colourKey: (doc: Document) => colourKey(doc, vocab.colourKey) });
}
