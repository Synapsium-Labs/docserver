// The glossary: the first mention of each term in each section is underlined (the reference layout, section 12b).
// Built by L2 Task 13.
//
// Consumes ctx.blocks (the tables), ctx.vocab (the glossary contract: its headers, section names, alias stop words and
// the joins between a term cell's names; the ID and rule-ID grammars, which no term may have), ctx.page (the byline
// and the facts panel, which hold no mention), ctx.terms (terms another step defined before this one are linked too)
// and ctx.nav (a term link goes to its definition). Produces ctx.terms entries, the `glossary` class on a glossary's
// wrapper (and the block's `glossary` flag), `termcell` on each first cell of its rows, and `a.term[data-term]` with
// aria-haspopup="dialog" and aria-expanded="false" (for the preview cards, Task 17), chrome around split text: the
// mention's own text node moves into the link. No id is written on any node.
//
// What a glossary is: a table of two columns, headed like `Term | Meaning` (the vocabulary's term and meaning
// headers, exactly), or one in a section whose heading (its words, a section number left out) opens with one of the
// glossary's section names ("Words used here", "Glossary", "Terms used"). A table's section is the nearest h2 or h3
// with an id before it, or the first heading of an "In short" or "Where things stand" box before it, in its parent
// or any ancestor's, up to the root. Each body row whose first cell holds 48 characters or fewer, and does not open
// with one of the vocabulary's not-a-term words ("IDs", "Codes"), names terms:
//   - "Name (x)": x is another name for it when x is one word (letters, digits, `_`, `-`) and not an alias stop word;
//     otherwise x qualifies the definition ("Rule (for plans)"), and the row adds a definition to "Rule".
//   - "A, B and C" or "A / B": when every part has three words or fewer, each part is a name matched only as spelled
//     (`exact`); otherwise the whole cell is one name.
//   - A name shorter than three characters, or one that is an ID or a rule ID, is no term.
// A term's target is its first row; each row with the name adds a definition (its qualifier, its meaning cell, its
// row). Terms are matched case-insensitively, a name's white space as any run of white space.
//
// What it links: in each section (an h2 among the root's children starts one, and so does the "In short" box, which
// holds its h2), the first mention of each term, in the texts of blocks (mentions.ts: what xrefs.ts reads, the
// glossaries left out too). A mention is a whole word or words (no letter, digit, `_` or `-` on either side), and may
// end in "s" or "es"; at one place the longest term wins, and a term already linked in the section, or an exact one
// spelled otherwise, leaves the text there as it is and the search goes on after it. The match is the reference's
// pattern, found in linear time: the terms are a trie, walked from each place a word can start, so the cost grows with
// the text and the longest term, never with the number of terms (RF3). Each glossary's heading is found once, for all
// its rows' links.
//
// The link's href is "#" and the id of the heading before the term's target (the glossary's section), so a link opened
// in a new tab, or copied, lands on the glossary; a plain click goes to the term's own row, through nav.goTo, from a
// listener on the link itself, which runs before nav's delegated one and after any listener on the root that captures
// the click first (a preview card's tap, Task 17). A row has no id (LD6 writes none), so nav tells the host nothing
// then: going to a term makes no entry in the host's history.
//
// Standard files, slug `links`: test/enhance-links.test.ts, and the Level 2 cases in conformance/layout/links/.
// Registered in features.ts, whose header says where in the build order and why.
import { headingText } from './headctl.js';
import { CHROME_ATTR, chrome } from './journal.js';
import { linkMention, mentionTexts, skipsMarkup, topElements } from './mentions.js';
import { words } from './reading.js';
import type { TermEntry } from './registry.js';
import type { FeatureContext } from './types.js';
import type { Vocab } from './vocab.js';

/** The longest term cell, in code units. */
export const TERM_CELL_MAX = 48;

/** The shortest name of a term, in code units. */
export const TERM_NAME_MIN = 3;

/** A section number at the start of a heading's words: "3. ", "A2. ", "4b. ". */
const SEC_NO = /^[A-Z]?\d+[a-z]?\.\s+/;

/** A term cell that ends in "(x)": group 1 the name, group 2 x. */
const PAREN = /^(.*?)\s*\(([^)]+)\)\s*$/;

/** One word, as an alias in brackets is written. */
const ALIAS = /^[a-z][\w-]*$/i;

/** Where a mention of a term was found: its start, the end of the term's own text, and the end with its plural. */
export interface TermHit {
  readonly start: number;
  readonly keyEnd: number;
  readonly end: number;
}

interface TrieNode {
  readonly next: Map<number, TrieNode>;
  /** A term ends here. */
  end: boolean;
}

/** The trie's edge for a run of white space. */
const SPACE = -1;

/** A code unit of the language's `\s`. */
function isSpace(c: number): boolean {
  return (
    c === 32 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) ||
    c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff
  );
}

/** A code unit of `[\w-]`: an ASCII letter or digit, `_` or `-`. */
function isWordOrDash(c: number): boolean {
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95 || c === 45;
}

/**
 * A code unit as a case-insensitive pattern of the language compares it (no `u` flag): its upper case when that is one
 * code unit, except that a unit outside ASCII never becomes an ASCII one.
 */
function canon(c: number): number {
  if (c < 128) return c >= 97 && c <= 122 ? c - 32 : c;
  const u = String.fromCharCode(c).toUpperCase();
  if (u.length !== 1) return c;
  const cu = u.charCodeAt(0);
  return cu < 128 ? c : cu;
}

const S = 83;
const E = 69;

/** The end of a mention whose term ends at `at`: with "s", with "es", or bare; then no `[\w-]` may follow. -1: none. */
function mentionEnd(text: string, at: number): number {
  const n = text.length;
  const free = (i: number): boolean => i >= n || !isWordOrDash(text.charCodeAt(i));
  if (at < n && canon(text.charCodeAt(at)) === S && free(at + 1)) return at + 1;
  if (at + 1 < n && canon(text.charCodeAt(at)) === E && canon(text.charCodeAt(at + 1)) === S && free(at + 2)) return at + 2;
  return free(at) ? at : -1;
}

/**
 * The finder of mentions of `keys` (each term's key: termKey's lower case, white space runs as one space, trimmed):
 * `find(text, from)` answers the first mention at or after `from`, as the reference's pattern finds it (a global,
 * case-insensitive pattern with the keys as alternatives, longest first, each white space run as `\s+`, then an
 * optional "s" or "es", with no `[\w-]` on either side), or null.
 */
export function termMatcher(keys: readonly string[]): (text: string, from: number) => TermHit | null {
  const top: TrieNode = { next: new Map(), end: false };
  for (const key of keys) {
    let node = top;
    for (let i = 0; i < key.length; i += 1) {
      const c = key.charCodeAt(i);
      const edge = isSpace(c) ? SPACE : canon(c);
      let child = node.next.get(edge);
      if (child === undefined) node.next.set(edge, (child = { next: new Map(), end: false }));
      node = child;
    }
    node.end = true;
  }
  return (text, from) => {
    const n = text.length;
    for (let p = from; p < n; p += 1) {
      if (p > 0 && isWordOrDash(text.charCodeAt(p - 1))) continue;
      // Every end of a term along the one path the text takes from p; the deepest is the longest term.
      const ends: number[] = [];
      let node: TrieNode | undefined = top;
      for (let j = p; j < n && node !== undefined; ) {
        const c = text.charCodeAt(j);
        if (isSpace(c)) {
          node = node.next.get(SPACE);
          j += 1;
          while (j < n && isSpace(text.charCodeAt(j))) j += 1;
        } else {
          node = node.next.get(canon(c));
          j += 1;
        }
        if (node?.end === true) ends.push(j);
      }
      for (let k = ends.length - 1; k >= 0; k -= 1) {
        const keyEnd = ends[k] as number;
        const end = mentionEnd(text, keyEnd);
        if (end >= 0) return { start: p, keyEnd, end };
      }
    }
    return null;
  };
}

const squash = (s: string | null): string => (s ?? '').replace(/\s+/g, ' ').trim();

/** A chrome button in a heading (a task's Outline button): never part of its words. */
const isButton = (el: Element): boolean => el.localName === 'button' && el.hasAttribute(CHROME_ATTR);

/** A heading's words: its text without the layout's buttons, its section number left out. */
function headingWords(h: Element): string {
  return headingText(h, isButton).replace(SEC_NO, '');
}

/** The heading a block belongs to (see the header), or null: the reference's group of a table. */
function sectionOf(root: Element, node: Element): Element | null {
  for (let n: Element | null = node; n !== null && n !== root; n = n.parentElement) {
    for (let p = n.previousElementSibling; p !== null; p = p.previousElementSibling) {
      if ((p.localName === 'h2' || p.localName === 'h3') && p.id !== '') return p;
      if (p.classList.contains('short') || p.classList.contains('callout')) {
        const h = p.querySelector('h2, h3');
        if (h !== null) return h;
      }
    }
  }
  return null;
}

/** The names a term cell gives, in the order the reference defines them, and its qualifier. */
function namesOf(raw: string, vocab: Vocab): { readonly names: { readonly name: string; readonly exact: boolean }[]; readonly qual: string } {
  const names: { name: string; exact: boolean }[] = [];
  let qual = '';
  const pm = PAREN.exec(raw);
  const base = pm === null ? raw : (pm[1] ?? '');
  if (pm !== null) {
    const x = pm[2] ?? '';
    if (ALIAS.test(x) && !vocab.glossary.aliasStop.test(x)) names.push({ name: x, exact: false });
    else qual = x;
  }
  const parts = base.split(vocab.glossary.nameSplit).filter((x) => x !== '');
  if (parts.length > 1 && parts.every((x) => words(x) <= 3)) for (const x of parts) names.unshift({ name: x, exact: true });
  else names.unshift({ name: base, exact: false });
  return { names, qual };
}

/** Build this feature during startup. */
export function build(ctx: FeatureContext): void {
  const { root, journal, vocab, terms, page } = ctx;
  /** A link's href, by the term's target: "#" and the id of the heading before it. */
  const hrefs = new Map<Element, string>();
  const hrefOf = (h: Element | null): string => `#${encodeURIComponent(h?.id ?? '')}`;

  // ── The glossaries, and their terms
  for (const b of ctx.blocks) {
    if (b.kind !== 'table' || b.heads.length !== 2) continue;
    const g = sectionOf(root, b.el);
    const section = g === null ? '' : headingWords(g);
    const byHeads = vocab.glossary.term.test(b.heads[0] ?? '') && vocab.glossary.meaning.test(b.heads[1] ?? '');
    if (!byHeads && !vocab.glossary.section.test(section)) continue;
    b.glossary = true;
    journal.toggleClass(b.el, 'glossary', true);
    const href = hrefOf(g);
    for (const row of b.rows) {
      const [cell, meaning] = [row.cells[0], row.cells[1]];
      if (cell === undefined || meaning === undefined) continue;
      journal.toggleClass(cell, 'termcell', true);
      const raw = squash(cell.textContent);
      if (raw.length > TERM_CELL_MAX || vocab.glossary.notTerm.test(raw)) continue;
      const { names, qual } = namesOf(raw, vocab);
      for (const { name, exact } of names) {
        if (name.length < TERM_NAME_MIN || vocab.id.test(name) || vocab.ruleId.test(name)) continue;
        terms.define({ name, exact, section, target: row, def: { qual, cell: meaning, row } });
        hrefs.set(row, href);
      }
    }
  }

  // ── The first mention of each term in each section
  const all = terms.all();
  if (all.length === 0) return;
  const find = termMatcher(all.map((t) => t.key));
  const doc = root.ownerDocument;
  const skip = (el: Element): boolean => skipsMarkup(el, page) || el.classList.contains('glossary');
  const link = (entry: TermEntry): HTMLElement => {
    let href = hrefs.get(entry.target);
    if (href === undefined) hrefs.set(entry.target, (href = hrefOf(sectionOf(root, entry.target))));
    const a = chrome(doc, 'a', {
      className: 'term',
      attrs: { href, 'data-term': entry.key, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' },
    });
    journal.listen(a, 'click', (event) => {
      const e = event as MouseEvent;
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      ctx.nav.goTo(entry.target, { push: true });
    });
    return a;
  };
  let used = new Set<TermEntry>();
  for (const top of topElements(root)) {
    if (top.localName === 'h2' || top.classList.contains('short')) used = new Set();
    for (const { text } of mentionTexts(top, skip)) {
      let rest: Text | null = text;
      while (rest !== null) {
        const s: string = rest.data;
        let hit: { readonly at: TermHit; readonly entry: TermEntry } | null = null;
        for (let at = find(s, 0); at !== null; at = find(s, at.end)) {
          const said = s.slice(at.start, at.keyEnd);
          const entry = terms.get(said);
          if (entry !== undefined && !used.has(entry) && !(entry.exact && said !== entry.name)) {
            hit = { at, entry };
            break;
          }
        }
        if (hit === null) break;
        used.add(hit.entry);
        rest = linkMention(ctx, rest, hit.at.start, hit.at.end - hit.at.start, link(hit.entry));
      }
    }
  }
}
