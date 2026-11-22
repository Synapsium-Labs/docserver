// The guided layout's layers (the reference's direction C): each level-2 section shows its heading, its reading time and
// its opening intro, and folds the rest behind one button; the reading tools in the bar put the reader's lens beside
// "Expand all" and "Collapse all".
//
// A section's intro is the reference's: up to two paragraphs and about fifty words (an alert that opens the section comes
// with them), and a paragraph that ends in a colon takes the short list after it. What follows folds, with its summary
// (what is left to read, and what it holds), the subsections it holds as links, and a "Fold this section" button after it.
// A section folds only when what follows the intro is worth a click: a few minutes of reading, a figure, a table or code.
// "Where things stand" and a section with nothing worth folding are shown as they are.
//
// The members are the root's own children, so nothing is wrapped: folding sets hidden="until-found" on each (through the
// journal, only on a block the author had not hidden), so find-in-page still reaches a folded block and opens its section
// (`beforematch`), as src/enhance/folds.ts does for the default layout. A jump, a link or a quick-jump hit opens the section
// that holds its target through the reveal service. The state is the folds' own field, `folds`: the folded sections'
// ids, so a document read in either layout keeps one answer; an expand or collapse writes the whole list, and the
// reader's choice of layers is the UI memory's `layers` ('full' or 'guided'), which decides a document with nothing
// remembered: with none, one of at least FULL_BELOW minutes opens guided and a shorter one in full.
//
// The reading tools are one group in the bar's tray (the changes stepper's place, which this layout does not build): the
// lens (the reader's `lens` pref: Product quiets implementation detail, Engineering is "all") and, with layers, the two
// buttons. Only with the bar. Print shows everything the reader had folded.
//
// Built after `attention` (the lens's classes and peek bars) and `scroll`. A page that is not a document, or a host that
// asked for no folds, gets no layers and no lens control.
import { CHROME_ATTR, chrome } from '../../journal.js';
import { formatMinutes, memberContribution, words, type ReadingContribution } from '../../reading.js';
import type { FeatureContext } from '../../types.js';
import { bare, isStand, membersOf, stops } from './sections.js';
import { contributionOf, stamp } from './times.js';

/** The per-document field the default layout's folds keep (src/enhance/folds.ts): the ids of the folded sections. */
const FOLDS = 'folds';

/** The UI memory's field for the reader's choice of layers. */
const LAYERS = 'layers';

/** The reading time, in minutes, from which a document with nothing remembered opens guided. */
const FULL_BELOW = 15;

/** The subsections a folded section lists, at most. */
const INSIDE_MAX = 6;

interface Cost {
  readonly prose: number;
  readonly code: number;
  readonly figures: number;
  readonly tables: number;
}

/** What a run of blocks holds, by reading.ts's contributions, and how many tables. */
function cost(nodes: readonly Element[]): Cost {
  let prose = 0;
  let code = 0;
  let figures = 0;
  let tables = 0;
  for (const n of nodes) {
    const [p, c, f] = memberContribution(n);
    prose += p;
    code += c;
    figures += f;
    if (n.classList.contains('table-wrapper') || n.querySelector('.table-wrapper') !== null) tables += 1;
  }
  return { prose, code, figures, tables };
}

/** A time and its word, with the separator before what follows when something does: "3 min read · 2 tables". */
const saying = (time: string, word: string, more: boolean): string => (time === '' ? '' : `${time} ${word}${more ? ' · ' : ''}`);

const plural = (n: number, one: string): string => `${String(n)} ${one}${n === 1 ? '' : 's'}`;

/** What a run of blocks holds, as words: "1 figure · 2 tables". */
function contents(c: Cost, subsections: number): string[] {
  return [
    c.figures > 0 ? plural(c.figures, 'figure') : '',
    c.tables > 0 ? plural(c.tables, 'table') : '',
    c.code > 0 ? 'code' : '',
    subsections > 0 ? plural(subsections, 'subsection') : '',
  ].filter((s) => s !== '');
}

/**
 * How many of a section's members are its intro: the reference's cut. A paragraph that ends in a colon introduces the
 * block after it: with a short list after it, the two stay together; otherwise the colon line opens the section only
 * when nothing else does.
 */
export function introCount(members: readonly Element[]): number {
  let i = 0;
  let w = 0;
  let paragraphs = 0;
  while (i < members.length && paragraphs < 2 && w < 55) {
    const n = members[i] as Element;
    if (n.localName === 'p' && n.querySelector('img') === null) {
      const text = n.textContent ?? '';
      if (/:\s*$/.test(text)) {
        const next = members[i + 1];
        if (next !== undefined && (next.localName === 'ul' || next.localName === 'ol') && words(next.textContent ?? '') <= 120) return i + 2;
        return i === 0 ? 1 : i;
      }
      w += words(text);
      paragraphs += 1;
      i += 1;
    } else if (n.classList.contains('gh-alert') && paragraphs === 0) i += 1;
    else break;
  }
  return i;
}

interface Layer {
  readonly id: string;
  readonly name: string;
  readonly first: Element;
  /** The members that fold: the blocks of the document after the intro, as they were at the build. */
  readonly members: ReadonlySet<Element>;
  /** The row after the last of them. */
  readonly endRow: Element;
  readonly btn: HTMLButtonElement;
  readonly label: HTMLElement;
  readonly bar: HTMLElement;
  /** The members this layout hid. */
  readonly hid: Set<Element>;
  folded: boolean;
}

/** Build the layers and the reading tools. */
export function build(ctx: FeatureContext): void {
  const { root, journal, state } = ctx;
  if (!ctx.info.isDocument) return;
  const doc = root.ownerDocument;
  const units = new Map(ctx.sections.map((u) => [u.heading, u] as const));

  const remembered = state.readDoc(FOLDS);
  // What the default layout's folds (or an earlier guided read) left: ids that are not guided's layers are kept in every write.
  const others: unknown[] = Array.isArray(remembered) ? remembered : [];
  const kept = Array.isArray(remembered) ? new Set(remembered) : null;
  const chosen = state.readUi(LAYERS);
  const guided = chosen === 'guided' ? true : chosen === 'full' ? false : ctx.sections.reduce((t, u) => t + u.minutes, 0) >= FULL_BELOW;

  const layers: Layer[] = [];

  /** Put a layer's state on the page: the members hidden or shown, the button and its bar. */
  const paint = (l: Layer): void => {
    if (l.folded) {
      // Its members, its own end row and the peek bars of its members: never what another step put at the root's end.
      for (let n: Element | null = l.first; n !== null && !stops(n); n = n.nextElementSibling) {
        const mine = l.members.has(n) || n === l.endRow || (n.classList.contains('peek-bar') && n.hasAttribute(CHROME_ATTR) && l.members.has(n.previousElementSibling as Element));
        if (mine && !n.hasAttribute('hidden')) {
          journal.setAttribute(n, 'hidden', 'until-found');
          l.hid.add(n);
        }
      }
    } else {
      for (const n of l.hid) if (n.getAttribute('hidden') === 'until-found') journal.setAttribute(n, 'hidden', null);
      l.hid.clear();
    }
    journal.toggleClass(l.bar, 'open', !l.folded);
    l.btn.setAttribute('aria-expanded', String(!l.folded));
    const say = l.folded ? 'Read the whole section' : 'Show less';
    l.label.textContent = say;
    l.btn.setAttribute('aria-label', `${say}: ${l.name}`);
  };
  let sync = (): void => {};
  /**
   * The state changed. Only the reader's own act (a fold, an unfold, Expand all, Collapse all) is written behind, and then with
   * every id the layers do not own as it was, so the default layout's folds are never dropped; a reveal or a find leaves
   * the page as the reader's act left it, and the stored answer with it.
   */
  const commit = (persist: boolean): void => {
    if (persist) {
      const mine = new Set(layers.map((l) => l.id));
      state.writeDoc(FOLDS, [...others.filter((v) => !mine.has(v as string)), ...layers.filter((l) => l.folded).map((l) => l.id)]);
    }
    for (const l of layers) paint(l);
    sync();
    ctx.relayout('folds');
  };
  const setFold = (l: Layer, on: boolean, persist: boolean): void => {
    l.folded = on;
    commit(persist);
  };
  const setAll = (on: boolean): void => {
    for (const l of layers) l.folded = on;
    state.writeUi(LAYERS, on ? 'guided' : 'full');
    commit(true);
  };

  for (const heading of ctx.options.folds ? (Array.from(root.children) as HTMLElement[]) : []) {
    const unit = units.get(heading);
    if (unit === undefined || isStand(ctx, heading)) continue;
    const members = membersOf(heading);
    const all = cost(members);
    // What the section holds, under its heading, when it is long or holds more than prose.
    if (unit.minutes >= 1 || all.figures > 0 || all.tables > 0) {
      const what = contents(all, members.filter((m) => m.localName === 'h3').length);
      const holds = what.join(' · ');
      const time = stamp(ctx, chrome(doc, 'span', { className: 'gd-time' }), contributionOf(ctx, heading), (m) => saying(formatMinutes(m), 'read', holds !== ''));
      journal.insert(chrome(doc, 'p', { className: 'gd-meta' }, [time, doc.createTextNode(holds)]), root, heading.nextSibling);
    }
    const detail = members.slice(introCount(members));
    const rest = cost(detail);
    if (!(rest.prose + rest.code >= 300 || rest.figures > 0 || rest.tables > 0 || rest.code > 0)) continue;
    const first = detail[0] as Element;
    const name = bare(heading);
    const detailContribution: ReadingContribution = [rest.prose, rest.code, rest.figures];
    const subs = detail.filter((m) => m.localName === 'h3' && m.id !== '');
    const label = chrome(doc, 'span', { className: 'gd-label' });
    const holdsMore = contents(rest, subs.length).join(' · ');
    const left = stamp(ctx, chrome(doc, 'span', { className: 'gd-time' }), detailContribution, (m) => saying(formatMinutes(m), 'more', holdsMore !== ''));
    const btn = chrome(doc, 'button', { className: 'gd-btn', attrs: { type: 'button', 'aria-expanded': 'true' } }, [
      chrome(doc, 'span', { className: 'gd-chev', attrs: { 'aria-hidden': 'true' } }),
      label,
      chrome(doc, 'span', { className: 'gd-sum' }, [left, doc.createTextNode(holdsMore)]),
    ]);
    const bar = chrome(doc, 'div', { className: 'gd-bar' }, [btn]);
    if (subs.length > 1) {
      const inside = chrome(doc, 'nav', { className: 'gd-inside', attrs: { 'aria-label': `In ${name}` } }, [chrome(doc, 'span', { className: 'gd-inside-k', text: 'Inside' })]);
      for (const s of subs.slice(0, INSIDE_MAX)) inside.append(chrome(doc, 'a', { text: bare(s), attrs: { href: `#${s.id}` } }));
      if (subs.length > INSIDE_MAX) inside.append(chrome(doc, 'span', { className: 'gd-inside-more', text: `+${String(subs.length - INSIDE_MAX)} more` }));
      bar.append(inside);
    }
    const end = chrome(doc, 'button', { className: 'gd-end', text: 'Fold this section', attrs: { type: 'button', 'aria-label': `Fold this section: ${name}` } });
    const endRow = chrome(doc, 'div', { className: 'gd-end-row' }, [end]);
    journal.insert(bar, root, first);
    journal.insert(endRow, root, (detail[detail.length - 1] as Element).nextSibling);
    const layer: Layer = { id: heading.id, name, first, members: new Set(detail), endRow, btn, label, bar, hid: new Set(), folded: kept === null ? guided : kept.has(heading.id) };
    layers.push(layer);
    journal.listen(btn, 'click', () => {
      setFold(layer, !layer.folded, true);
    });
    journal.listen(end, 'click', () => {
      setFold(layer, true, true);
      ctx.nav.goTo(heading, { push: false, focus: false, flash: false });
      btn.focus({ preventScroll: true });
    });
  }

  for (const l of layers) paint(l);

  /** The layer that holds `node`: the one whose hidden member the node is in. */
  const holding = (node: Node | null): Layer | undefined => {
    let top = node;
    while (top !== null && top.parentNode !== root) top = top.parentNode;
    return layers.find((l) => l.hid.has(top as Element));
  };
  ctx.onReveal((element) => {
    const l = holding(element);
    if (l !== undefined) setFold(l, false, false);
  });
  journal.listen(root, 'beforematch', (event) => {
    const l = holding(event.target as Node);
    if (l !== undefined) setFold(l, false, false);
  });
  // Print shows everything the reader had folded, as the default layout's folds do: the blocks this layout hid are shown for the
  // printing and hidden again after it (a browser that knows no hidden="until-found" would print nothing of them otherwise).
  ctx.env.onPrint((printing) => {
    for (const l of layers) {
      if (!printing) paint(l);
      else for (const n of l.hid) if (n.getAttribute('hidden') === 'until-found') journal.setAttribute(n, 'hidden', null);
    }
  });
  // A member a feature adds after this build (the lens's peek bars) joins a folded section, so it never shows alone.
  journal.defer(ctx.events.on('prefs', () => {
    for (const l of layers) paint(l);
  }));

  const slots = ctx.slots;
  if (slots === null) return;
  const lens = (name: 'all' | 'product', long: string, short: string, hint: string): HTMLButtonElement => {
    const b = chrome(doc, 'button', { attrs: { type: 'button', title: hint } }, [chrome(doc, 'span', { className: 'gd-lg', text: long }), chrome(doc, 'span', { className: 'gd-sm', text: short })]);
    journal.listen(b, 'click', () => {
      ctx.position.keep(() => {
        ctx.setPrefs({ lens: name });
        ctx.relayout('prefs');
      });
    });
    return b;
  };
  const product = lens('product', 'Product', 'Prod.', 'Product lens: quiets code, file paths and technical tables (nothing is hidden)');
  const engineering = lens('all', 'Engineering', 'Eng.', 'Engineering lens: everything at full strength');
  const paintLens = (): void => {
    product.setAttribute('aria-pressed', String(ctx.state.prefs.lens === 'product'));
    engineering.setAttribute('aria-pressed', String(ctx.state.prefs.lens !== 'product'));
  };
  paintLens();
  journal.defer(ctx.events.on('prefs', paintLens));
  const group = chrome(doc, 'div', { className: 'gd-tools' }, [
    chrome(doc, 'span', { className: 'gd-tools-k', text: 'Lens' }),
    chrome(doc, 'div', { className: 'gd-seg', attrs: { role: 'group', 'aria-label': 'Reading lens' } }, [product, engineering]),
  ]);
  if (layers.length > 0) {
    const expand = chrome(doc, 'button', { className: 'gd-all', text: 'Expand all', attrs: { type: 'button' } });
    const collapse = chrome(doc, 'button', { className: 'gd-all', text: 'Collapse all', attrs: { type: 'button' } });
    journal.listen(expand, 'click', () => {
      ctx.position.keep(() => {
        setAll(false);
      });
    });
    journal.listen(collapse, 'click', () => {
      ctx.position.keep(() => {
        setAll(true);
      });
    });
    sync = (): void => {
      expand.disabled = layers.every((l) => !l.folded);
      collapse.disabled = layers.every((l) => l.folded);
    };
    sync();
    group.append(expand, collapse);
  }
  slots.tool('changes', group);
}
