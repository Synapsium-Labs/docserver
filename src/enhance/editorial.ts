// The editorial core, ported from the reference reader's sections 0 to 6 (the status marks of section 8 are their own
// step, status.ts): the reading time, the title block (an eyebrow above the title, a byline below it), the facts panel
// from the front matter, the "In short" and "Where things stand" boxes, and the hanging section numbers.
//
// The lifecycle calls buildEditorial once, during startup, inside the startup operation, after the prefs are on the
// root and before folds are built, so folds see the boxes this builds (an "In short" heading inside its box gets no
// fold). It calls no host code, so nothing here can destroy the instance while it runs.
//
// Every DOM write goes through the journal, so destroyEnhancement undoes it. The document's own nodes are only
// moved (journal.wrap, journal.move) or, where a word must be lifted out of a text, partitioned without changing a
// character (journal.split); what the reference removed is hidden instead (a `hidden` attribute through the
// journal), and what it rewrote is shown by new chrome. Chrome is made with chrome() (journal.ts) and carries
// data-docreader-chrome. Class names are the reference's, so assets/reader.css applies.
//
// Departures from the reference, on purpose: no link to an issue tracker, no rules index in the facts panel, no
// document kinds of one product, no "Headlines | Full" switch in "In short", no ids written on the document's
// nodes, and no parsing of front matter that a Markdown renderer left as paragraphs (render() parses it, and the
// host passes it as info.frontList).
import { chrome, siblingRun, type Journal } from './journal.js';
import { documentMinutes, formatLong } from './reading.js';
import type { FeatureContext, FrontListEntry } from './types.js';

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

interface Byline {
  readonly el: HTMLElement;
  readonly kinds: string[];
  /** The meta paragraph the byline was made from (now hidden), or null. */
  readonly meta: Element | null;
}

/**
 * The byline: one fact (a `div` holding an optional `dt` and a `dd`) per segment of the meta paragraph, the
 * segment's nodes moved into the `dd`; and the reading time. The meta paragraph's leading bold word, when it stands
 * alone ("**Spec** · …"), is the document's kind, for the eyebrow. The paragraph is hidden; what is left in it (the
 * kind, the separators and the labels the `dt`s now show) comes back on destroy.
 */
function buildByline(ctx: FeatureContext, h1: Element, minutes: number): Byline {
  const { journal } = ctx;
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
      const dd = chrome(doc, 'dd');
      for (const n of moved) journal.move(n, dd, null);
      facts.push(fact(dt, dd, len > 70));
    }
    const line = metaP.getAttribute('data-line');
    if (line !== null) byline.setAttribute('data-line', line);
    journal.setAttribute(metaP, 'hidden', '');
  }

  if (minutes >= 3) {
    const rt = fact('Reading time', chrome(doc, 'dd', { text: `≈ ${formatLong(minutes)}` }), false);
    rt.classList.add('rt');
    const wide = facts.findIndex((d) => d.classList.contains('wide'));
    facts.splice(wide < 0 ? facts.length : wide, 0, rt);
  }
  for (const d of facts) byline.appendChild(d);
  if (facts.length === 1 && facts[0]?.classList.contains('rt') === true) byline.classList.add('solo');
  return { el: byline, kinds, meta: metaP };
}

/** The facts panel: the front matter's list keys, as a closed `details` whose summary counts each one. */
function buildFacts(doc: Document, lists: readonly FrontListEntry[]): HTMLElement {
  const sum = chrome(doc, 'summary');
  for (const f of lists) {
    if (sum.childNodes.length > 0) sum.appendChild(chrome(doc, 'span', { className: 'sep', text: ' · ', attrs: { 'aria-hidden': 'true' } }));
    sum.appendChild(doc.createTextNode(`${String(f.vals.length)} ${f.key}`));
  }
  const dl = chrome(doc, 'dl');
  for (const f of lists) {
    dl.appendChild(chrome(doc, 'dt', { text: f.key }));
    const dd = chrome(doc, 'dd');
    f.vals.forEach((v, i) => {
      if (i > 0) dd.appendChild(doc.createTextNode(', '));
      dd.appendChild(chrome(doc, 'code', { text: v }));
    });
    dl.appendChild(dd);
  }
  return chrome(doc, 'details', { className: 'doc-facts' }, [sum, chrome(doc, 'div', { className: 'facts-body' }, [dl])]);
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

  // ── 2. title block: eyebrow above the title, byline below it
  const h1 = root.querySelector('h1');
  if (h1 !== null && h1.parentNode !== null) {
    const parent = h1.parentNode;
    let after: Element = h1;
    const { el: byline, kinds, meta } = buildByline(ctx, h1, minutes);
    for (const f of front ?? []) if (!f.list && /^(?:type|area|status|kind)$/i.test(f.key)) kinds.push(f.vals.join(', '));
    if (kinds.length > 0) {
      journal.insert(chrome(doc, 'div', { className: 'eyebrow' }, kinds.map((k) => chrome(doc, 'span', { text: k }))), parent, h1);
    }
    // Right after the title, or after the hidden meta line when that is what follows the title, so the
    // stylesheet's sibling rules (`.byline + .doc-facts`, `.doc-facts + h2`) see no hidden paragraph between.
    if (meta !== null && h1.nextElementSibling === meta) after = meta;
    if (byline.children.length > 0) {
      journal.insert(byline, parent, after.nextSibling);
      after = byline;
    }

    // ── 4. facts panel: the front matter's list keys (no rules index)
    const lists = (front ?? []).filter((f) => f.list && f.vals.length > 0);
    if (lists.length > 0) journal.insert(buildFacts(doc, lists), parent, after.nextSibling);
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
  const short = h2s.find((h) => /^in short$/i.test(labelOf(h)));
  if (short !== undefined) box(short, 'short', ['h1', 'h2', 'hr']);

  const stand = h2s.find((h) => /^where things stand$/i.test(labelOf(h)));
  if (stand !== undefined) {
    const h3s: Element[] = [];
    for (let n = stand.nextElementSibling; n !== null && n.localName !== 'h1' && n.localName !== 'h2'; n = n.nextElementSibling) {
      if (n.localName === 'h3') h3s.push(n);
    }
    const counts = chrome(doc, 'nav', { className: 'stand-index', attrs: { 'aria-label': 'Where things stand' } });
    let firstBox: HTMLElement | null = null;
    for (const h of h3s) {
      const k = labelOf(h).toLowerCase();
      const c = k.startsWith('agreed') ? 'agreed' : k.startsWith('waiting') ? 'waiting' : k.startsWith('later') ? 'later' : 'other';
      const b = box(h, `callout ${c}`, ['h1', 'h2', 'h3', 'hr']);
      firstBox ??= b;
      let items = 0;
      for (const list of Array.from(b.children)) {
        if (list.localName === 'ul' || list.localName === 'ol') items += Array.from(list.children).filter((li) => li.localName === 'li').length;
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
}
