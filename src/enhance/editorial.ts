// The editorial core, ported from the reference reader's sections 0 to 6 (the status marks of section 8 are their own
// step, status.ts): the reading time, the title block (an eyebrow above the title, a byline below it), the facts panel
// from the front matter, the "In short" and "Where things stand" boxes, and the hanging section numbers.
//
// The lifecycle calls buildEditorial once, during startup, inside the startup operation, after the prefs are on the
// root and before folds are built, so folds see the boxes this builds (an "In short" heading inside its box gets no
// fold). Its one host call is the item link's (below), through `ctx.host.itemLink`: it is made before the nodes it
// concerns are written, and live() is checked after each, so a host that destroys the instance there stops the build.
//
// The words it matches are the vocabulary's (`ctx.vocab`, vocab.ts), all of them the format contract: the boxes'
// headings, the callout kinds' words and the front-matter keys that name the document's kind.
//
// The item link (the reference layout's section 2; docserver L2, Task 8): an item key the document names (`AB-12`)
// becomes a link to what the host's `itemLink(key)` answers, by two routes, and only when the host gave `itemLink`:
//   - the delta route: the first level-2 section (a child of the root) whose heading is one of
//     `vocabulary.itemHeadings` and whose first code block names a key, by its first line that is not blank being
//     `item: <key>`; a section whose first code block names none passes to the next such section, as the reference's
//     section 2 reads it. That key is the
//     document's: the first byline fact labelled with one of `vocabulary.itemFields` shows only that key's link (the
//     fact's own nodes stay in the hidden meta line), or, with no such fact, a fact of its own does (labelled with
//     the first item field, if any), before the wide facts;
//   - the byline route, without a delta key (or when the host gives no link for it): in the first fact labelled with
//     an item field, every key in its text (split off its text node and wrapped, never re-typed) and every code
//     element whose text is a key (wrapped whole). An author's own link is left as the author wrote it.
// The host is asked once per key, for at most ITEM_LINKS.keys keys in a document; a key past them stays text. At most
// ITEM_LINKS.links links are written in a document (one key named many times is many links), the first in document
// order; a key past them stays text. The host's answer is used only when it is a string of 1 to ITEM_LINKS.href code
// units with no white space (any of Unicode's, a byte-order mark included) and no control character (C0, DEL or C1),
// whose scheme, when it names one, is http or https. A link opens in a new tab: a main-button click goes to the
// host's onLink with newTab true when the host gave it (and the browser's own handling is prevented), through one
// click listener on the byline for all its item links; without onLink the browser follows the link, by its target.
// An arrow after the key is chrome, hidden from speech.
//
// Every DOM write goes through the journal, so destroyEnhancement undoes it. The document's own nodes are only
// moved (journal.wrap, journal.move) or, where a word must be lifted out of a text, partitioned without changing a
// character (journal.split); what the reference removed is hidden instead (a `hidden` attribute through the
// journal), and what it rewrote is shown by new chrome. Chrome is made with chrome() (journal.ts) and carries
// data-docreader-chrome. Class names are the reference's, so assets/reader.css applies.
//
// Departures from the reference, on purpose: no address of an issue tracker (the host's itemLink answers the link),
// no rules index in the facts panel, no document kinds of one product, no "Headlines | Full" switch in "In short", no
// ids written on the document's nodes, and no parsing of front matter that a Markdown renderer left as paragraphs
// (render() parses it, and the host passes it as info.frontList). The item link leaves an author's own link alone
// (the reference re-pointed one that was not https), keeps a key's code element in the link (the reference replaced
// it with the bare key), has no third route for a header line older than the meta line, writes at most
// ITEM_LINKS.links links (the reference linked every occurrence), and takes the neutral class `item-link` (the
// reference's named one tracker; no rule of the stylesheet reads either).
//
// It publishes what later features read of the title block (docserver L2, Task 7b): `ctx.page` (registry.ts), once,
// at the end of its build: the byline (or null), the items of the first "Waiting" box of "Where things stand" and that
// box (no `waiting-N` ids: a link to an item is chrome that goes there through nav), and the facts panel as a seam a
// plugin builds into (the rules index, rules.ts, in the reference's order: its parts first in the summary, its list
// before the panel's own):
//   facts.take(key)      takes list key `key` out of the panel: its dt, its dd and its summary part go (all chrome),
//                        and the list goes once it is empty; answers the key's values (frozen), or null when the panel
//                        does not show it;
//   facts.summary(part)  puts `part` first in the summary, after earlier plugin parts, the separators kept between;
//   facts.block(node)    puts `node` in the panel's body before the list, after earlier plugin blocks.
// A part or block is new chrome (a node with no parent; an element made with chrome()), so no source node ever goes
// into the panel. The seam writes only inside the panel, which is chrome that destroy removes whole, and nothing once
// the instance is not live.
import { CHROME_ATTR, chrome, siblingRun, type Journal } from './journal.js';
import { documentMinutes, formatLong } from './reading.js';
import { noFacts, type FactsSeam } from './registry.js';
import type { FeatureContext, FrontListEntry } from './types.js';
import type { Vocab } from './vocab.js';

/**
 * The item link's bounds: the distinct keys asked of the host in one document, the links written in one document,
 * and a link's length in code units.
 */
export const ITEM_LINKS = { keys: 16, links: 64, href: 2048 } as const;

/**
 * What a link from the host may not hold: a control character (C0, DEL or C1: Unicode's Cc) or white space (JavaScript's
 * `\s`: ASCII's, the no-break spaces, the Unicode space separators, the line and paragraph separators, and the
 * byte-order mark).
 */
const HREF_REFUSED = /[\u0000-\u001f\u007f-\u009f\s]/;

/** A link's scheme, when it names one (group 1). */
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

/** A node's text, with runs of white space as one space, trimmed. */
const txt = (n: Node): string => (n.textContent ?? '').replace(/\s+/g, ' ').trim();

const isBlank = (n: Node): boolean => n.nodeType === 3 && (n as Text).data.trim() === '';

const isStrong = (n: Node | null): n is Element => n !== null && n.nodeType === 1 && (n as Element).localName === 'strong';

/** A byline separator: a middle dot with white space on both sides. */
const SEP = /\s+·\s+/;

/** A section number at the start of a heading: "3. ", "A2. ", "4b. ". */
const SEC_NO = /^([A-Z]?\d+[a-z]?)\.\s+/;

/**
 * The paragraph under the title that carries the byline: "**Spec** · 2026-10-19 · Status: Draft". It opens on bold
 * text and holds a " · "; one that ends on a dangling "Label:" introduces a list, and is left alone.
 */
function metaParagraph(h1: Element): Element | null {
  for (let n = h1.nextElementSibling; n !== null && n.localName !== 'h2'; n = n.nextElementSibling) {
    if (n.localName !== 'p' || !isStrong(n.firstChild)) continue;
    const t = n.textContent ?? '';
    if (/ · /.test(t) && !/:\s*$/.test(t)) return n;
  }
  return null;
}

/** Split every text child of `p` at its separators, and return the runs of nodes between them. */
function segments(p: Element, journal: Journal): Node[][] {
  const seps = new Set<Node>();
  for (const child of Array.from(p.childNodes)) {
    if (child.nodeType !== 3) continue;
    let t = child as Text;
    for (;;) {
      const m = SEP.exec(t.data);
      if (m === null) break;
      const sep = m.index > 0 ? journal.split(t, m.index) : t;
      const rest = m[0].length < sep.data.length ? journal.split(sep, m[0].length) : null;
      seps.add(sep);
      if (rest === null) break;
      t = rest;
    }
  }
  const segs: Node[][] = [[]];
  for (const n of Array.from(p.childNodes)) {
    if (seps.has(n)) segs.push([]);
    else segs[segs.length - 1]?.push(n);
  }
  return segs;
}

/** The host's link for an item, when it is one the reader uses (see the header); null otherwise. */
function itemHref(v: unknown): string | null {
  if (typeof v !== 'string' || v.length === 0 || v.length > ITEM_LINKS.href || HREF_REFUSED.test(v)) return null;
  const scheme = SCHEME.exec(v)?.[1]?.toLowerCase();
  return scheme === undefined || scheme === 'http' || scheme === 'https' ? v : null;
}

/**
 * The item link of one build: the host's link per key, asked once each, for at most ITEM_LINKS.keys keys; the links
 * made; and the one click listener that routes them all.
 */
interface ItemLinks {
  /** The link for `key`; null for none, or past the bound. The host may have destroyed the instance: check live(). */
  hrefOf(key: string): string | null;
  /** A new link to `href` for `key`, empty; `arrow()` goes in it last, after what it shows. */
  anchor(key: string, href: string): HTMLAnchorElement;
  /** The arrow after a key, chrome hidden from speech. */
  arrow(): HTMLElement;
  /** One click listener on `on` (the byline), delegated, for every link made: a click on one goes to onLink. */
  route(on: HTMLElement): void;
}

function itemLinks(ctx: FeatureContext): ItemLinks {
  const doc = ctx.root.ownerDocument;
  const asked = new Map<string, string | null>();
  const made = new Map<Element, string>();
  return {
    hrefOf(key) {
      if (asked.has(key)) return asked.get(key) ?? null;
      if (asked.size >= ITEM_LINKS.keys) return null;
      const href = itemHref(ctx.host.itemLink(key));
      asked.set(key, href);
      return href;
    },
    anchor(key, href) {
      const a = chrome(doc, 'a', {
        className: 'item-link',
        attrs: { href, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${key} (opens in a new tab)` },
      });
      made.set(a, href);
      return a;
    },
    route(on) {
      ctx.journal.listen(on, 'click', (event) => {
        const e = event as MouseEvent;
        const n = e.target as Node | null;
        const el = n?.nodeType === 1 ? (n as Element) : (n?.parentElement ?? null); // a click on a text node is its parent's
        const a = el?.closest('a') ?? null;
        const href = a === null ? undefined : made.get(a);
        if (href === undefined || e.defaultPrevented || e.button !== 0 || !ctx.host.present.has('onLink')) return;
        e.preventDefault();
        ctx.host.onLink(href, { newTab: true });
      });
    },
    arrow: () => chrome(doc, 'span', { className: 'item-arrow', text: ' ↗', attrs: { 'aria-hidden': 'true' } }),
  };
}

/**
 * The delta route's key: in the first level-2 section, a child of the root, whose heading is an item heading and whose
 * first code block names a key, that key. A block names one when its first line that is not blank is an item line
 * naming a key; a section whose first code block names none passes to the next such section (the reference's
 * section 2). Read before any node moves; null when there is none.
 */
function deltaKey(root: HTMLElement, vocab: Vocab): string | null {
  for (const h of Array.from(root.children)) {
    if (h.localName !== 'h2' || !vocab.itemHeading.test(txt(h))) continue;
    for (let n = h.nextElementSibling; n !== null && n.localName !== 'h2'; n = n.nextElementSibling) {
      const pre = n.localName === 'pre' ? n : n.classList.contains('codehilite') ? n.querySelector('pre') : null;
      if (pre === null) continue;
      const line = (pre.textContent ?? '').split('\n').find((l) => l.trim() !== '') ?? '';
      const key = vocab.itemLine.exec(line.trim())?.[1];
      if (key !== undefined && vocab.itemKey.test(key)) return key;
      break; // the section's first code block is its delta
    }
  }
  return null;
}

/** A key in a byline value: in a text node at `at`, or a code element whose text is the key. */
type KeySpot = { readonly key: string; readonly text: Text; readonly at: number } | { readonly key: string; readonly code: Element };

/**
 * The byline route: link each item key in `nodes` (the document's own nodes, moved into a byline value). The host is
 * asked for every key first, in document order, and the nodes are written after; false when the host destroyed the
 * instance meanwhile (nothing is written then).
 */
function linkKeys(ctx: FeatureContext, nodes: readonly Node[], links: ItemLinks): boolean {
  const { journal, vocab } = ctx;
  const spots: KeySpot[] = [];
  const walk = (n: Node): void => {
    if (n.nodeType === 3) {
      for (const m of (n as Text).data.matchAll(vocab.itemKeyScan())) spots.push({ key: m[1] ?? '', text: n as Text, at: m.index });
      return;
    }
    if (n.nodeType !== 1) return;
    const el = n as Element;
    if (el.localName === 'a') return; // an author's link stays the author's
    if (el.localName === 'code') {
      if (vocab.itemKey.test(txt(el))) spots.push({ key: txt(el), code: el });
      return;
    }
    for (const c of Array.from(el.childNodes)) walk(c);
  };
  for (const n of nodes) walk(n);
  // The first ITEM_LINKS.links links in document order; the host is asked for no key past them.
  const hrefs = new Map<KeySpot, string>();
  for (const spot of spots) {
    if (hrefs.size >= ITEM_LINKS.links) break;
    const href = links.hrefOf(spot.key);
    if (!ctx.live()) return false;
    if (href !== null) hrefs.set(spot, href);
  }
  // The last key of a text first, so the offsets of the keys before it in that text still hold.
  for (const spot of [...spots].reverse()) {
    const href = hrefs.get(spot);
    if (href === undefined) continue;
    let node: Node;
    if ('code' in spot) node = spot.code;
    else {
      const end = spot.at + spot.key.length;
      if (end < spot.text.data.length) journal.split(spot.text, end);
      node = spot.at > 0 ? journal.split(spot.text, spot.at) : spot.text;
    }
    const a = links.anchor(spot.key, href);
    journal.wrap([node], a);
    journal.insert(links.arrow(), a, null);
  }
  return true;
}

/** The delta route's key and the host's link for it. */
interface Delta {
  readonly key: string;
  readonly href: string;
}

interface Byline {
  readonly el: HTMLElement;
  readonly kinds: string[];
  /** The meta paragraph the byline was made from (now hidden), or null. */
  readonly meta: Element | null;
  /** The document's own nodes in the first fact labelled with an item field, moved into its value; null without one. */
  readonly item: readonly Node[] | null;
}

/**
 * The byline: one fact (a `div` holding an optional `dt` and a `dd`) per segment of the meta paragraph, the
 * segment's nodes moved into the `dd`; and the reading time. The meta paragraph's leading bold word, when it stands
 * alone ("**Spec** · …"), is the document's kind, for the eyebrow. The paragraph is hidden; what is left in it (the
 * kind, the separators and the labels the `dt`s now show) comes back on destroy. With a delta (and `links`), the
 * first fact labelled with an item field shows the delta's link instead of its own nodes, which stay in the hidden
 * paragraph; without such a fact, a fact of its own shows it.
 */
function buildByline(ctx: FeatureContext, h1: Element, minutes: number, delta: Delta | null, links: ItemLinks | null): Byline {
  const { journal, vocab } = ctx;
  const doc = ctx.root.ownerDocument;
  const byline = chrome(doc, 'dl', { className: 'byline' });
  const kinds: string[] = [];
  const facts: HTMLElement[] = [];
  const keys = new Set<string>();
  const fact = (dt: string, dd: HTMLElement, wide: boolean): HTMLElement => {
    const d = chrome(doc, 'div', wide ? { className: 'wide' } : {});
    if (dt !== '') {
      d.appendChild(chrome(doc, 'dt', { text: dt, attrs: { 'data-k': dt } }));
      keys.add(dt);
    }
    d.appendChild(dd);
    return d;
  };

  /** The delta's link, in a new value. */
  const deltaValue = (d: Delta, l: ItemLinks): HTMLElement => {
    const a = l.anchor(d.key, d.href);
    a.append(doc.createTextNode(d.key), l.arrow());
    return chrome(doc, 'dd', {}, [a]);
  };
  let item: Node[] | null = null;
  let itemFact = false;

  const metaP = metaParagraph(h1);
  if (metaP !== null) {
    const segs = segments(metaP, journal);
    const first = (segs[0] ?? []).filter((n) => !isBlank(n));
    const lone = first[0];
    if (first.length === 1 && isStrong(lone ?? null) && lone !== undefined && !/:\s*$/.test(lone.textContent ?? '')) {
      kinds.push(txt(lone));
      segs.shift();
    }
    for (const seg of segs) {
      const at = seg.findIndex((n) => !isBlank(n));
      if (at < 0) continue;
      const f = seg[at] as Node;
      let moved = seg.slice(at);
      let dt = '';
      if (isStrong(f) && /:\s*$/.test(f.textContent ?? '')) {
        dt = txt(f).replace(/:$/, '');
        moved = seg.slice(at + 1); // the label stays behind; its words are the dt
      } else if (f.nodeType === 3) {
        const t = f as Text;
        const m = /^\s*([A-Z][A-Za-z ]{0,18}):\s*/.exec(t.data);
        if (m !== null) {
          dt = m[1] ?? '';
          const rest = m[0].length < t.data.length ? journal.split(t, m[0].length) : null;
          moved = rest === null ? seg.slice(at + 1) : [rest, ...seg.slice(at + 1)];
        } else if (/^\s*\d{4}-\d{2}-\d{2}/.test(t.data)) dt = 'Date';
        else if (!keys.has('Status')) dt = 'Status';
      }
      const len = moved.reduce((a, n) => a + (n.textContent ?? '').length, 0);
      const isItem: boolean = !itemFact && vocab.itemField.test(dt);
      itemFact ||= isItem;
      if (isItem && delta !== null && links !== null) {
        facts.push(fact(dt, deltaValue(delta, links), len > 70)); // its own nodes stay in the hidden paragraph
        continue;
      }
      const dd = chrome(doc, 'dd');
      for (const n of moved) journal.move(n, dd, null);
      if (isItem) item = moved;
      facts.push(fact(dt, dd, len > 70));
    }
    const line = metaP.getAttribute('data-line');
    if (line !== null) byline.setAttribute('data-line', line);
    journal.setAttribute(metaP, 'hidden', '');
  }

  /** Where a fact goes ahead of the wide ones: before the first, or last. */
  const beforeWide = (): number => {
    const wide = facts.findIndex((d) => d.classList.contains('wide'));
    return wide < 0 ? facts.length : wide;
  };
  if (delta !== null && links !== null && !itemFact) facts.splice(beforeWide(), 0, fact(vocab.words.itemFields[0] ?? '', deltaValue(delta, links), false));
  if (minutes >= 3) {
    const rt = fact('Reading time', chrome(doc, 'dd', { text: `≈ ${formatLong(minutes)}` }), false);
    rt.classList.add('rt');
    facts.splice(beforeWide(), 0, rt);
  }
  for (const d of facts) byline.appendChild(d);
  if (facts.length === 1 && facts[0]?.classList.contains('rt') === true) byline.classList.add('solo');
  return { el: byline, kinds, meta: metaP, item };
}

/** One list key of the facts panel: its summary part, its dt and dd, and its values. */
interface FactKey {
  readonly key: string;
  readonly part: Text;
  readonly dt: HTMLElement;
  readonly dd: HTMLElement;
  readonly vals: readonly string[];
}

/**
 * The facts panel: the front matter's list keys, as a closed `details` whose summary counts each one, and the seam a
 * plugin builds into (see the header).
 */
function buildFacts(doc: Document, lists: readonly FrontListEntry[], live: () => boolean): { readonly panel: HTMLElement; readonly seam: FactsSeam } {
  const sum = chrome(doc, 'summary');
  const dl = chrome(doc, 'dl');
  const factsBody = chrome(doc, 'div', { className: 'facts-body' }, [dl]);
  const keys: FactKey[] = [];
  for (const f of lists) {
    const dt = chrome(doc, 'dt', { text: f.key });
    const dd = chrome(doc, 'dd');
    f.vals.forEach((v, i) => {
      if (i > 0) dd.appendChild(doc.createTextNode(', '));
      dd.appendChild(chrome(doc, 'code', { text: v }));
    });
    dl.append(dt, dd);
    keys.push({ key: f.key, part: doc.createTextNode(`${String(f.vals.length)} ${f.key}`), dt, dd, vals: Object.freeze([...f.vals]) });
  }
  const plugin: Node[] = [];
  /** The summary: the plugin's parts, then the keys still shown, with a separator between each two. */
  const paint = (): void => {
    const nodes: Node[] = [];
    for (const part of [...plugin, ...keys.map((k) => k.part)]) {
      if (nodes.length > 0) nodes.push(chrome(doc, 'span', { className: 'sep', text: ' · ', attrs: { 'aria-hidden': 'true' } }));
      nodes.push(part);
    }
    sum.replaceChildren(...nodes);
  };
  paint();
  /** A plugin's node is new chrome: no parent yet, and an element made with chrome(). */
  const adopt = (node: Node): void => {
    if (typeof node !== 'object' || node === null || node.parentNode !== null || (node.nodeType === 1 && !(node as Element).hasAttribute(CHROME_ATTR))) {
      throw new Error('docreader: the facts panel takes a new chrome node');
    }
  };
  const panel = chrome(doc, 'details', { className: 'doc-facts' }, [sum, factsBody]);
  const seam: FactsSeam = Object.freeze({
    panel,
    take(key: string): readonly string[] | null {
      const at = keys.findIndex((k) => k.key === key);
      const k = keys[at];
      if (k === undefined || !live()) return null;
      keys.splice(at, 1);
      k.dt.remove();
      k.dd.remove();
      if (dl.children.length === 0) dl.remove();
      paint();
      return k.vals;
    },
    summary(part: Node): boolean {
      adopt(part);
      if (!live()) return false;
      plugin.push(part);
      paint();
      return true;
    },
    block(node: Node): boolean {
      adopt(node);
      if (!live()) return false;
      factsBody.insertBefore(node, dl.parentNode === factsBody ? dl : null);
      return true;
    },
  });
  return { panel, seam };
}

export function buildEditorial(ctx: FeatureContext): void {
  ctx.journal.setAttribute(ctx.root, 'data-docreader-root', '');
  const { root, journal } = ctx;
  const doc = root.ownerDocument;

  // ── 0. before anything moves: the reading time, and each heading's text
  const minutes = documentMinutes(root);
  const h2s = Array.from(root.querySelectorAll('h2[id]'));
  const label = new Map<Element, string>();
  for (const h of Array.from(root.querySelectorAll('h2, h3'))) label.set(h, txt(h));
  const labelOf = (h: Element): string => label.get(h) ?? txt(h);

  // ── 1. front matter: the host's info.frontList replaces render()'s strip
  const given = ctx.options.info?.frontList;
  if (given !== undefined) {
    const strip = root.querySelector('dl.doc-meta');
    if (strip !== null) journal.setAttribute(strip, 'hidden', '');
  }
  const front = given !== undefined && given !== null && given.length > 0 ? given : null;

  // What ctx.page publishes at the end.
  let bylineEl: HTMLElement | null = null;
  let facts: FactsSeam = noFacts();
  let waitBox: HTMLElement | null = null;
  const waiting: HTMLElement[] = [];

  // ── 2. title block: eyebrow above the title, byline below it, and the item link
  const h1 = root.querySelector('h1');
  if (h1 !== null && h1.parentNode !== null) {
    const parent = h1.parentNode;
    let after: Element = h1;
    // The delta route first, before any node moves: its key, and the host's link for it (a call-out).
    const links = ctx.host.present.has('itemLink') ? itemLinks(ctx) : null;
    let delta: Delta | null = null;
    const key = links === null ? null : deltaKey(root, ctx.vocab);
    if (links !== null && key !== null) {
      const href = links.hrefOf(key);
      if (!ctx.live()) return;
      if (href !== null) delta = { key, href };
    }
    const { el: byline, kinds, meta, item } = buildByline(ctx, h1, minutes, delta, links);
    // The byline route: the keys of the item fact's own nodes (call-outs, then writes). With a delta there are none:
    // the item fact shows the delta's link, and its own nodes stay in the hidden meta line.
    if (links !== null && item !== null && !linkKeys(ctx, item, links)) return;
    links?.route(byline);
    for (const f of front ?? []) if (!f.list && ctx.vocab.kindKey.test(f.key)) kinds.push(f.vals.join(', '));
    if (kinds.length > 0) {
      journal.insert(chrome(doc, 'div', { className: 'eyebrow' }, kinds.map((k) => chrome(doc, 'span', { text: k }))), parent, h1);
    }
    // Right after the title, or after the hidden meta line when that is what follows the title, so the
    // stylesheet's sibling rules (`.byline + .doc-facts`, `.doc-facts + h2`) see no hidden paragraph between.
    if (meta !== null && h1.nextElementSibling === meta) after = meta;
    if (byline.children.length > 0) {
      journal.insert(byline, parent, after.nextSibling);
      after = byline;
      bylineEl = byline;
    }

    // ── 4. facts panel: the front matter's list keys (the rules index is the rules plugin's, through the seam)
    const lists = (front ?? []).filter((f) => f.list && f.vals.length > 0);
    if (lists.length > 0) {
      const built = buildFacts(doc, lists, ctx.live);
      journal.insert(built.panel, parent, after.nextSibling);
      facts = built.seam;
    }
  }

  // ── 5. boxes: In short, Where things stand
  /** Wrap a heading and the siblings after it, up to the first element named in `stops`, in a new `div.<cls>`. */
  const box = (h: Element, cls: string, stops: readonly string[]): HTMLElement => {
    let stop = h.nextElementSibling;
    while (stop !== null && !stops.includes(stop.localName)) stop = stop.nextElementSibling;
    const wrapper = chrome(doc, 'div', { className: cls });
    journal.wrap(siblingRun(h, stop), wrapper);
    return wrapper;
  };
  const short = h2s.find((h) => ctx.vocab.box.short.test(labelOf(h)));
  if (short !== undefined) box(short, 'short', ['h1', 'h2', 'hr']);

  const stand = h2s.find((h) => ctx.vocab.box.stand.test(labelOf(h)));
  if (stand !== undefined) {
    const h3s: Element[] = [];
    for (let n = stand.nextElementSibling; n !== null && n.localName !== 'h1' && n.localName !== 'h2'; n = n.nextElementSibling) {
      if (n.localName === 'h3') h3s.push(n);
    }
    const counts = chrome(doc, 'nav', { className: 'stand-index', attrs: { 'aria-label': 'Where things stand' } });
    let firstBox: HTMLElement | null = null;
    const { callout } = ctx.vocab;
    for (const h of h3s) {
      const k = labelOf(h);
      const c = callout.agreed.test(k) ? 'agreed' : callout.waiting.test(k) ? 'waiting' : callout.later.test(k) ? 'later' : 'other';
      const b = box(h, `callout ${c}`, ['h1', 'h2', 'h3', 'hr']);
      firstBox ??= b;
      const lis: HTMLElement[] = [];
      for (const list of Array.from(b.children)) {
        if (list.localName === 'ul' || list.localName === 'ol') lis.push(...(Array.from(list.children).filter((li) => li.localName === 'li') as HTMLElement[]));
      }
      const items = lis.length;
      if (c === 'waiting' && waitBox === null) {
        waitBox = b;
        waiting.push(...lis);
      }
      if (items > 0 && h.id !== '') {
        counts.appendChild(
          chrome(doc, 'a', { attrs: { href: `#${h.id}` } }, [
            chrome(doc, 'span', { className: `dot ${c}` }),
            chrome(doc, 'b', { text: String(items) }),
            chrome(doc, 'span', { text: labelOf(h) }),
          ]),
        );
      }
    }
    const before = firstBox ?? stand;
    if (counts.children.length > 1 && before.parentNode !== null) journal.insert(counts, before.parentNode, before);
  }

  // ── 6. numbered sections: the number hangs in the margin
  // "3. Design" shows as a `span.sec-no` holding "3" (the stylesheet hangs it, with its "§"), then "Design". The
  // heading's text node is split, never rewritten: "3" moves into the number, ". " into a hidden span. The heading
  // keeps its whole text as its accessible name.
  for (const h of h2s) {
    const t = h.firstChild;
    if (t === null || t.nodeType !== 3) continue;
    const m = SEC_NO.exec((t as Text).data);
    const no = m?.[1];
    if (m === null || no === undefined) continue;
    if (!h.hasAttribute('aria-label') && !h.hasAttribute('aria-labelledby')) journal.setAttribute(h, 'aria-label', labelOf(h));
    const sep = journal.split(t as Text, no.length);
    if (m[0].length - no.length < sep.data.length) journal.split(sep, m[0].length - no.length);
    journal.wrap([t], chrome(doc, 'span', { className: 'sec-no' }));
    journal.wrap([sep], chrome(doc, 'span', { attrs: { hidden: '' } }));
  }

  ctx.page.publish({ byline: bylineEl, facts, waiting, waitBox });
}
