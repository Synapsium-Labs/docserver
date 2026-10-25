// @vitest-environment jsdom
// Preview cards (docserver L2, Task 17; the reference layout, section 20): a card on hover, focus or a first tap for an
// ID mention (`a.xref`), a glossary term (`a.term`) or a diagram block (`.dnode`, Task 23), with its content built from
// the index (ctx.index) and the terms (ctx.terms), its ARIA, its keys, its timers through env, its placement, and the
// module export `show(ctx, trigger)` for diagram blocks.
//
// The documents are rendered by render() and enhanced with the real features: ID rows and lettered sections (ids.ts),
// rule paragraphs (rules.ts, `rules: true`), cross-references (xrefs.ts) and the glossary (glossary.ts) make the
// triggers this feature previews. A diagram block is a chrome element a test puts in the root, as Task 23 will.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance, type EnhanceOptions } from '../src/enhance/index.js';
import { EDGE, FRESH_MS, GAP, HIDE_DELAY_MS, LEAD, MIN_HEIGHT, ROOM, SHOW_DELAY_MS, show } from '../src/enhance/cards.js';
import { CHROME_ATTR, chrome } from '../src/enhance/journal.js';
import { chromeIdsIssued, contextOf } from '../src/enhance/lifecycle.js';
import type { FeatureContext } from '../src/enhance/types.js';
import { render } from '../src/render/index.js';

const fixture = vi.hoisted(() => ({ cardOnlyEffects: false, cardAllocations: [] as string[] }));
vi.mock('../src/enhance/features.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/enhance/features.js')>();
  return {
    ...real,
    features: () => real.features()
      .filter((f) => !fixture.cardOnlyEffects || !['jump', 'keysheet', 'scroll'].includes(f.name))
      .map((feature) => {
        if (!fixture.cardOnlyEffects || feature.name !== 'cards') return feature;
        return {
          ...feature,
          build: (ctx: FeatureContext) => {
            const descriptor = Object.getOwnPropertyDescriptor(ctx, 'chromeId');
            if (descriptor?.configurable !== true || typeof descriptor.value !== 'function') throw new Error('cards allocator is not replaceable');
            const chromeId = descriptor.value as (name: string) => string;
            Object.defineProperty(ctx, 'chromeId', {
              ...descriptor,
              value: (name: string): string => {
                if (name === 'card') fixture.cardAllocations.push(name);
                return chromeId.call(ctx, name);
              },
            });
            ctx.journal.defer(() => {
              Object.defineProperty(ctx, 'chromeId', descriptor);
            });
            feature.build(ctx);
          },
        };
      }),
  };
});

const DOC = [
  '# Card sample',
  '',
  '## 1. Decisions',
  '',
  '| ID | Decision | Status |',
  '|---|---|---|',
  '| D1 | Keep the fold beside its heading | Agreed, after review |',
  '| D2 | Mark a section read once it is seen, as D1 allows | Pending, see below |',
  '| D3 Show the marks | In the contents | Later |',
  '',
  'D1, D2 and D3 are named here, as are AB-1 and F1. A [plain link](#2-rules) is not a trigger.',
  '',
  'D1 again, in a block of its own.',
  '',
  '## F1. Search',
  '',
  'The search finds what the reader asked for.',
  '',
  'A second paragraph.',
  '',
  '## 2. Rules',
  '',
  '`AB-1` — _agreed_ (after review). **Keep the rule short.** Its body says why.',
  '',
  '## 3. Words used here',
  '',
  '| Term | Meaning |',
  '|---|---|',
  '| Fold (for sections) | A section shown as its heading only |',
  '| Read mark (marker) | A mark on a section the reader has seen |',
  '| Fold (for tables) | A table shown as its first rows, as D1 says |',
  '',
  'A fold and a read mark, named after the glossary.',
].join('\n');

const mounted: HTMLElement[] = [];

/** Render `md` into a new root in the document. */
function mount(md: string = DOC): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(md).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((n) => document.importNode(n, true)));
  document.body.append(root);
  mounted.push(root);
  return root;
}

/** Put hand-written html (not render()'s) into a new root in the document. */
function mountHtml(html: string): HTMLElement {
  const root = document.createElement('main');
  root.innerHTML = html;
  document.body.append(root);
  mounted.push(root);
  return root;
}

/** Mount and enhance; rules on, folds off unless the options say. */
async function open(md: string = DOC, options: EnhanceOptions = {}): Promise<HTMLElement> {
  const root = mount(md);
  await enhance(root, { rules: true, folds: false, ...options });
  return root;
}

afterEach(async () => {
  vi.useRealTimers();
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
  vi.restoreAllMocks();
  fixture.cardOnlyEffects = false;
  fixture.cardAllocations.length = 0;
});

function ctxOf(root: HTMLElement): FeatureContext {
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('no context: the root is not enhanced');
  return ctx;
}

const squash = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();

/** The link `a.<cls>` whose text is `text` (the first one). */
function link(root: HTMLElement, cls: 'xref' | 'term', text: string): HTMLAnchorElement {
  const a = Array.from(root.querySelectorAll(`a.${cls}`)).find((x) => squash(x.textContent) === text);
  if (a === undefined) throw new Error(`no a.${cls} "${text}"`);
  return a as HTMLAnchorElement;
}

function cardOf(root: HTMLElement): HTMLElement | null {
  return root.querySelector('.xcard');
}

function theCard(root: HTMLElement): HTMLElement {
  const c = cardOf(root);
  if (c === null) throw new Error('no card');
  return c;
}

const isOpen = (root: HTMLElement): boolean => cardOf(root)?.classList.contains('open') === true;

/** Each child of `el`: its classes, then its text. */
const parts = (el: Element | null): string[] =>
  Array.from(el?.children ?? []).map((c) => `${c.localName}${c.className === '' ? '' : `.${c.className.split(' ').join('.')}`}: ${squash(c.textContent)}`);

/** A row or a definition of the card's body: its label, then the rest of its text, " | " between. */
function labelled(el: Element): string {
  const k = el.querySelector(':scope > .xc-k');
  let rest = '';
  for (const n of Array.from(el.childNodes)) if (n !== k) rest += n.textContent ?? '';
  return `${el.localName}.${el.className}: ${k === null ? '' : `${squash(k.textContent)} | `}${squash(rest)}`;
}

/** What the card shows: its head, its body (a labelled part as `label | text`) and its link. */
function readCard(root: HTMLElement): { head: string[]; body: string[]; go: string; href: string | null } {
  const card = theCard(root);
  const go = card.querySelector('.xc-foot a.xc-go');
  const body = Array.from(card.querySelector('.xc-body')?.children ?? []);
  return {
    head: parts(card.querySelector('.xc-head')),
    body: body.map((c, i) => (c.classList.contains('xc-row') || c.classList.contains('xc-def') ? labelled(c) : (parts(card.querySelector('.xc-body'))[i] as string))),
    go: squash(go?.textContent),
    href: go?.getAttribute('href') ?? null,
  };
}

/** Focus `el` the way a reader does: focusin shows its card at once. */
function focus(el: Element): void {
  (el as HTMLElement).focus();
}

function key(target: Element, k: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}

function pointer(target: EventTarget, type: string, init: PointerEventInit = {}): PointerEvent {
  const e = new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'mouse', ...init });
  target.dispatchEvent(e);
  return e;
}

/** A pointer's click: detail 1 (a key's click has detail 0), and no pointerType (a MouseEvent, as older engines send). */
function click(target: Element, init: MouseEventInit = {}): MouseEvent {
  const e = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, detail: 1, ...init });
  target.dispatchEvent(e);
  return e;
}

/** A click that names its pointer: a PointerEvent, detail 1 unless `init` says otherwise. */
function pclick(target: Element, pointerType: string, init: PointerEventInit = {}): PointerEvent {
  const e = new PointerEvent('click', { bubbles: true, cancelable: true, button: 0, detail: 1, pointerType, ...init });
  target.dispatchEvent(e);
  return e;
}

/**
 * A tap: a touch pointerdown, then the click a touch screen sends. By default that click is WebKit's: a PointerEvent
 * that names 'mouse' (measured in the pinned Playwright WebKit); Chromium's names 'touch'.
 */
function tap(target: Element, says = 'mouse'): MouseEvent {
  pointer(target, 'pointerdown', { pointerType: 'touch' });
  return pclick(target, says);
}

/** A chrome diagram block in the root, as Task 23 makes them: `.dnode` with data-ref or data-term. */
function dnode(root: HTMLElement, data: { ref?: string; term?: string }, parent: Element = root): HTMLElement {
  const ctx = ctxOf(root);
  const attrs: Record<string, string> = { tabindex: '0', role: 'button' };
  if (data.ref !== undefined) attrs['data-ref'] = data.ref;
  if (data.term !== undefined) attrs['data-term'] = data.term;
  const el = chrome(root.ownerDocument, 'span', { className: 'dnode', text: data.ref ?? data.term ?? '', attrs });
  ctx.journal.insert(el, parent, null);
  return el;
}

/** Stub an element's box. */
function boxAt(el: Element, r: { top: number; left: number; height?: number; width?: number }): void {
  const height = r.height ?? 20;
  const width = r.width ?? 40;
  const rect = { top: r.top, left: r.left, bottom: r.top + height, right: r.left + width, width, height, x: r.left, y: r.top, toJSON: () => ({}) };
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);
}

/** Stub the card's measured size: its natural height (capped by its max-height, as layout would) and its width. */
function cardSize(card: HTMLElement, natural: number, width: number): void {
  Object.defineProperty(card, 'offsetHeight', {
    configurable: true,
    get: () => {
      const cap = Number.parseFloat(card.style.getPropertyValue('max-height'));
      return Number.isFinite(cap) ? Math.min(natural, cap) : natural;
    },
  });
  Object.defineProperty(card, 'offsetWidth', { configurable: true, get: () => width });
}

const px = (card: HTMLElement, prop: string): number => Number.parseFloat(card.style.getPropertyValue(prop));

describe('content', () => {
  it('an ID row: its ID, the status words of its pill and its group; each cell under its header, the ID cell left out', async () => {
    const root = await open();
    focus(link(root, 'xref', 'D2'));
    expect(readCard(root)).toEqual({
      head: ['span.xc-id: D2', 'span.pill.wait: Pending', 'span.xc-src: Decisions'],
      body: ['div.xc-row: Decision | Mark a section read once it is seen, as D1 allows', 'div.xc-row: Status | Pending, see below'],
      go: 'Go to D2 →',
      href: '#D2',
    });
    const rows = theCard(root).querySelectorAll('.xc-body > .xc-row');
    expect(Array.from(rows).map((r) => [squash(r.querySelector('.xc-k')?.textContent), squash(r.querySelector('.xc-v')?.textContent)])).toEqual([
      ['Decision', 'Mark a section read once it is seen, as D1 allows'],
      ['Status', 'Pending, see below'],
    ]);
  });

  it('an ID row whose first cell holds more than the ID shows that cell too', async () => {
    const root = await open();
    focus(link(root, 'xref', 'D3'));
    expect(readCard(root).body).toEqual(['div.xc-row: ID | D3 Show the marks', 'div.xc-row: Decision | In the contents', 'div.xc-row: Status | Later']);
  });

  it('a rule: its paragraph without its head, the status words of the head\'s first pill, the group "Rules"', async () => {
    const root = await open();
    focus(link(root, 'xref', 'AB-1'));
    const card = readCard(root);
    expect(card.head).toEqual(['span.xc-id: AB-1', 'span.pill.ok: agreed', 'span.xc-src: Rules']);
    expect(card.body).toEqual(['p: Keep the rule short. Its body says why.']);
    expect(card.go).toBe('Go to AB-1 →');
    const p = theCard(root).querySelector('.xc-body > p') as HTMLElement;
    expect([p.hasAttribute('class'), p.querySelector('.rule-head'), p.hasAttribute('data-line')]).toEqual([false, null, false]);
  });

  it('a rule\'s status words are read as one line, however the document broke them', async () => {
    const root = await open(['# T', '', '`AB-2` — _agreed', 'in full_. **Two.** Its body.', '', 'AB-2 named.'].join('\n'));
    focus(link(root, 'xref', 'AB-2'));
    expect(theCard(root).querySelector('.xc-head .pill')?.textContent).toBe('agreed in full');
  });

  it('a lettered section: its title, and the first paragraph after its heading', async () => {
    const root = await open();
    focus(link(root, 'xref', 'F1'));
    expect(readCard(root)).toEqual({
      head: ['span.xc-id: F1', 'span.xc-src: Decisions'],
      body: ['p.xc-title: Search', 'p: The search finds what the reader asked for.'],
      go: 'Go to F1 →',
      href: '#f1-search',
    });
  });

  it('a section\'s paragraph is found past chrome after the heading, and not past the next heading', async () => {
    const root = await open(['# T', '', '## 1. Intro', '', '## F2. Empty', '', '### Sub', '', 'Not this one.', '', '## 2. More', '', 'F2 named.'].join('\n'), { folds: true });
    focus(link(root, 'xref', 'F2'));
    expect(readCard(root).body).toEqual(['p.xc-title: Empty']);
  });

  it('a hidden bullet in the ID cell is passed over: the cell is still the ID alone', async () => {
    const root = await open();
    const ctx = ctxOf(root);
    const cell = (ctx.index.get('D1')?.target as HTMLTableRowElement).cells[0] as HTMLTableCellElement;
    ctx.journal.insert(chrome(document, 'span', { text: '• ', attrs: { hidden: '' } }), cell, cell.firstChild);
    focus(link(root, 'xref', 'D1'));
    expect(readCard(root).body.map((b) => b.split(' | ')[0])).toEqual(['div.xc-row: Decision', 'div.xc-row: Status']);
  });

  it('a cell other than the first is shown even when it is the ID', async () => {
    const root = await open(['# T', '', '| ID | Same |', '|---|---|', '| Q1 | Q1 |', '| Q2 | x |', '', 'Q1 named.'].join('\n'));
    focus(link(root, 'xref', 'Q1'));
    expect(readCard(root).body).toEqual(['div.xc-row: Same | Q1']);
  });

  it('a cell under an empty header, or past the headers, has no label', async () => {
    const root = mountHtml(
      '<h1>T</h1><div class="table-wrapper"><table><thead><tr><th>ID</th><th></th></tr></thead><tbody>' +
        '<tr><td>R1</td><td>blank head</td><td>extra</td></tr><tr><td>R2</td><td>x</td></tr></tbody></table></div><p>R1 named.</p>',
    );
    await enhance(root, { folds: false });
    focus(link(root, 'xref', 'R1'));
    expect(readCard(root).body).toEqual(['div.xc-row: blank head', 'div.xc-row: extra']);
    expect(theCard(root).querySelector('.xc-k')).toBeNull();
  });

  it('the words are the row\'s last pill\'s; a pill the document wrote is none of the layout\'s', async () => {
    const root = await open(['# T', '', '| ID | Status | Verdict |', '|---|---|---|', '| D1 | Agreed | Rejected |', '| D2 | Pending | Pending |', '', 'D1 named.'].join('\n'));
    focus(link(root, 'xref', 'D1'));
    expect(readCard(root).head).toEqual(['span.xc-id: D1', 'span.pill.no: Rejected', 'span.xc-src: Index']);
    const own = mountHtml(
      '<h1>T</h1><div class="table-wrapper"><table><thead><tr><th>ID</th><th>Status</th><th>Note</th></tr></thead><tbody>' +
        '<tr><td>R1</td><td>Agreed</td><td><span class="pill">mine</span></td></tr><tr><td>R2</td><td>Pending</td><td>x</td></tr></tbody></table></div><p>R1 named.</p>',
    );
    await enhance(own, { folds: false });
    focus(link(own, 'xref', 'R1'));
    expect(readCard(own).head).toEqual(['span.xc-id: R1', 'span.pill.ok: Agreed', 'span.xc-src: Index']);
  });

  it('a pill with no colour role shows as a plain pill', async () => {
    const root = await open(['# T', '', '## 1. A', '', '| ID | What |', '|---|---|', '| Q1 | Ask |', '| Q2 | Ask again |', '', 'Q1 named.'].join('\n'));
    const ctx = ctxOf(root);
    const row = ctx.index.get('Q1')?.target as HTMLTableRowElement;
    ctx.journal.insert(chrome(document, 'span', { className: 'pill', text: 'Asked' }), row.cells[1] as Element, null);
    focus(link(root, 'xref', 'Q1'));
    expect(readCard(root).head).toEqual(['span.xc-id: Q1', 'span.pill: Asked', 'span.xc-src: A']);
  });

  it('a paragraph the document hid stays hidden in its copy: only a fold\'s hidden goes', async () => {
    const root = mountHtml('<h1>T</h1><h2 id="f1-x">F1. X</h2><p hidden>Secret.</p><h2 id="a">A</h2><p>F1 named.</p>');
    await enhance(root, { folds: false });
    focus(link(root, 'xref', 'F1'));
    const p = theCard(root).querySelectorAll('.xc-body > p')[1] as HTMLElement;
    expect([p.textContent, p.getAttribute('hidden')]).toEqual(['Secret.', '']);
  });

  it('a figure: its whole caption', async () => {
    const caption = 'A caption long enough to be clipped in the index, which keeps ninety code units of it and an ellipsis';
    const root = await open(['# T', '', '```mermaid', 'graph TD; A-->B', '```', '', `*Figure 1. ${caption}*`].join('\n'));
    const ctx = ctxOf(root);
    expect(ctx.index.get('figure-1')?.title).not.toBe(caption);
    click(dnode(root, { ref: 'figure-1' }));
    expect(readCard(root)).toMatchObject({ head: ['span.xc-id: figure-1', 'span.xc-src: '], body: [`p.xc-title: ${caption}`], go: 'Go to figure-1 →' });
  });

  it('a term\'s link names the heading before its glossary: an h2 or h3, a box\'s heading, encoded; none: "#"', async () => {
    const table = '<div class="table-wrapper"><table><thead><tr><th>Term</th><th>Meaning</th></tr></thead><tbody><tr><td>Lantern</td><td>A light</td></tr></tbody></table></div><p>A lantern.</p>';
    const hrefIn = async (before: string): Promise<string | null> => {
      const root = mountHtml(`<h1>T</h1>${before}${table}`);
      await enhance(root, { folds: false });
      focus(link(root, 'term', 'lantern'));
      return readCard(root).href;
    };
    expect(await hrefIn('<div class="short"><h2 id="in-short">In short</h2><p>x</p></div>')).toBe('#in-short');
    expect(await hrefIn('<div class="callout"><h3 id="stand">Where it stands</h3><p>x</p></div>')).toBe('#stand');
    expect(await hrefIn('<h3 id="two words">Words</h3>')).toBe('#two%20words');
    expect(await hrefIn('<h4 id="low">Low</h4>')).toBe('#');
    expect(await hrefIn('<h2 id="top">Top</h2><h3>No id</h3><div class="short"><p>No heading</p></div>')).toBe('#top');
  });

  it('a section folded away still shows its paragraph: the fold\'s hidden is not cloned', async () => {
    const root = await open(DOC, { folds: true });
    const ctx = ctxOf(root);
    const h = Array.from(root.querySelectorAll('h2')).find((x) => x.id === 'f1-search') as HTMLElement;
    ctx.operate(() => ctx.folds.setFold(h, true));
    expect((h.nextElementSibling?.nextElementSibling as HTMLElement | null)?.getAttribute('hidden')).toBe('until-found');
    focus(link(root, 'xref', 'F1'));
    const p = theCard(root).querySelectorAll('.xc-body > p')[1] as HTMLElement;
    expect([squash(p.textContent), p.hasAttribute('hidden')]).toEqual(['The search finds what the reader asked for.', false]);
    // the title is the heading's own text: its number and its fold control are chrome
    expect(squash(h.textContent)).toMatch(/Fold|Unfold/);
    expect(readCard(root).body[0]).toBe('p.xc-title: Search');
  });

  it('a term: its name, its glossary\'s section, each definition with its qualifier', async () => {
    const root = await open();
    focus(link(root, 'term', 'fold'));
    expect(readCard(root)).toEqual({
      head: ['span.xc-term: Fold', 'span.xc-src: Words used here'],
      body: ['div.xc-def: for sections | A section shown as its heading only', 'div.xc-def: for tables | A table shown as its first rows, as D1 says'],
      go: 'Go to definition →',
      href: '#3-words-used-here',
    });
    expect(Array.from(theCard(root).querySelectorAll('.xc-def > .xc-k')).map((k) => k.textContent)).toEqual(['for sections', 'for tables']);
    expect(theCard(root).classList.contains('is-term')).toBe(true);
    // a definition's copy is scrubbed too: the glossary's own link to D1 is text in the card
    expect(root.querySelector('.glossary a.xref')?.textContent).toBe('D1');
    const body = theCard(root).querySelector('.xc-body') as HTMLElement;
    expect([body.querySelectorAll('a').length, Array.from(body.querySelectorAll('*')).every((el) => el.hasAttribute(CHROME_ATTR))]).toEqual([0, true]);
  });

  it('a term with no qualifier has no label; a glossary with no section reads "Glossary"', async () => {
    const root = await open(['| Term | Meaning |', '|---|---|', '| Lantern | A light |', '', 'A lantern here.'].join('\n'));
    focus(link(root, 'term', 'lantern'));
    expect(readCard(root)).toMatchObject({ head: ['span.xc-term: Lantern', 'span.xc-src: Glossary'], body: ['div.xc-def: A light'], href: '#' });
    expect(theCard(root).querySelector('.xc-k')).toBeNull();
  });

  it('a clone drops ids, form controls and render()\'s line marks, turns links of the layout into text, and is chrome', async () => {
    const root = mountHtml(
      [
        '<h1>T</h1>',
        '<div class="table-wrapper"><table><thead><tr><th>ID</th><th>What</th></tr></thead><tbody>',
        '<tr data-line="3"><td>R1</td><td data-line="3"><span id="inner">In <b id="deep">R2</b></span> <input type="checkbox" checked> <button>Press</button> <select><option>o</option></select> <textarea>t</textarea> end</td></tr>',
        '<tr><td>R2</td><td>Second</td></tr>',
        '</tbody></table></div>',
        '<p>R1 named.</p>',
      ].join(''),
    );
    await enhance(root, { folds: false });
    const xrefInRow = root.querySelector('tr td:nth-child(2) a.xref');
    expect(xrefInRow?.textContent).toBe('R2'); // the source links R2 in R1's row
    focus(link(root, 'xref', 'R1'));
    const v = theCard(root).querySelector('.xc-v') as HTMLElement;
    expect(squash(v.textContent)).toBe('In R2 end');
    expect(v.querySelectorAll('[id]').length).toBe(0);
    expect(v.querySelectorAll('input, button, select, textarea, option').length).toBe(0);
    expect(v.querySelectorAll('a').length).toBe(0);
    expect(v.querySelectorAll('[data-line]').length).toBe(0);
    expect(Array.from(v.querySelectorAll('*')).every((el) => el.hasAttribute(CHROME_ATTR))).toBe(true);
    expect(v.querySelector('b')?.textContent).toBe('R2');
    // the document's own nodes stay as they were
    expect(root.querySelector('#inner')).not.toBeNull();
    expect(root.querySelector('#deep')?.parentElement?.id).toBe('inner');
    expect(root.querySelectorAll('tbody input, tbody button, tbody select, tbody textarea').length).toBe(4);
    expect(root.querySelector('tbody td[data-line]')).not.toBeNull();
  });

  it('a clone\'s term link becomes text too', async () => {
    const root = await open();
    expect(root.querySelector('tbody tr td:nth-child(2) a.term')?.textContent).toBe('fold');
    focus(link(root, 'xref', 'D1'));
    const v = theCard(root).querySelector('.xc-v') as HTMLElement;
    expect([squash(v.textContent), v.querySelectorAll('a').length]).toEqual(['Keep the fold beside its heading', 0]);
  });

  it('the status words come from the target\'s pill, never from the index entry', async () => {
    const root = await open();
    const ctx = ctxOf(root);
    expect(ctx.index.get('D2')?.status).toBe('wait');
    const pill = root.querySelector('tbody tr:nth-child(2) .pill') as HTMLElement;
    expect(pill.textContent).toBe('Pending');
    focus(link(root, 'xref', 'D2'));
    expect(theCard(root).querySelector('.xc-head .pill')?.textContent).toBe('Pending');
  });

  it('a row with no pill, a section and a term show no pill', async () => {
    const root = await open(['# T', '', '## 1. A', '', '| ID | What |', '|---|---|', '| Q1 | Ask |', '| Q2 | Ask again |', '', 'Q1 named.'].join('\n'));
    focus(link(root, 'xref', 'Q1'));
    expect(readCard(root).head).toEqual(['span.xc-id: Q1', 'span.xc-src: A']);
  });
});

describe('ARIA, and the card in the root', () => {
  it('the card is a dialog in the root, made on first use, labelled for what it shows; the trigger is expanded and controls it', async () => {
    const root = await open();
    expect(cardOf(root)).toBeNull();
    const d1 = link(root, 'xref', 'D1');
    expect(d1.getAttribute('aria-expanded')).toBe('false');
    focus(d1);
    const card = theCard(root);
    expect(card.parentElement).toBe(root);
    expect([card.getAttribute('role'), card.getAttribute('aria-label'), card.hasAttribute(CHROME_ATTR)]).toEqual(['dialog', 'D1 preview', true]);
    expect(card.id).toMatch(/^docreader\.\d+\.card$/);
    expect([d1.getAttribute('aria-expanded'), d1.getAttribute('aria-controls')]).toEqual(['true', card.id]);
    const fold = link(root, 'term', 'fold');
    focus(fold);
    expect([card.getAttribute('aria-label'), d1.getAttribute('aria-expanded'), fold.getAttribute('aria-expanded')]).toEqual(['Definition: Fold', 'false', 'true']);
    focus(link(root, 'xref', 'D2'));
    expect([card.classList.contains('is-term'), fold.getAttribute('aria-expanded')]).toEqual([false, 'false']);
    expect(root.querySelectorAll('.xcard').length).toBe(1);
  });

  it('until a card first shows, the instance makes no card, issues no id, registers no overlay and hears no scroll', async () => {
    fixture.cardOnlyEffects = true;
    const adds = vi.spyOn(window, 'addEventListener');
    const removes = vi.spyOn(window, 'removeEventListener');
    const before = chromeIdsIssued(document);
    const root = await open();
    // Task 18/19 now own their chrome IDs during startup. The card's lazy contract starts after the complete reader has.
    const ids = chromeIdsIssued(document);
    const ctx = ctxOf(root);
    const scrolls = (): number => adds.mock.calls.filter((c) => c[0] === 'scroll').length - removes.mock.calls.filter((c) => c[0] === 'scroll').length;
    expect([cardOf(root), fixture.cardAllocations, scrolls()]).toEqual([null, [], 0]);
    // The overlay is free until the first show; take the stand-in back before measuring card's one registration.
    ctx.overlays.register('card', { isOpen: () => false, close: () => undefined })();
    // The service is frozen, so replace only this context's service reference with a delegating object for the spy.
    const overlays = { ...ctx.overlays };
    Object.defineProperty(ctx, 'overlays', { value: overlays });
    const registrations = vi.spyOn(ctx.overlays, 'register');
    focus(link(root, 'xref', 'D1'));
    const [kind, handler] = registrations.mock.calls[0] ?? [];
    expect(registrations).toHaveBeenCalledTimes(1);
    expect(kind).toBe('card');
    expect(handler?.isOpen()).toBe(true);
    expect([fixture.cardAllocations, chromeIdsIssued(document) - ids, scrolls()]).toEqual([['card'], 1, 1]);
    // hidden: no scroll is heard; shown again: one
    key(link(root, 'xref', 'D1'), 'Escape');
    expect(scrolls()).toBe(0);
    const styles = vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty');
    window.dispatchEvent(new Event('scroll'));
    expect(styles).not.toHaveBeenCalled();
    focus(link(root, 'xref', 'D2'));
    focus(link(root, 'term', 'fold'));
    expect(registrations).toHaveBeenCalledTimes(1);
    expect(registrations).toHaveBeenLastCalledWith('card', handler);
    expect([fixture.cardAllocations, scrolls(), chromeIdsIssued(document) - ids, root.querySelectorAll('.xcard').length]).toEqual([['card'], 1, 1, 1]);
    await destroyEnhancement(root);
    expect([cardOf(root), chromeIdsIssued(document) - before, scrolls()]).toEqual([null, 0, 0]);
  });

  it('destroy removes the card and puts the triggers back as they were', async () => {
    const root = await open();
    const before = link(root, 'xref', 'D1').outerHTML;
    focus(link(root, 'xref', 'D1'));
    expect(link(root, 'xref', 'D1').outerHTML).not.toBe(before);
    const html = mount(DOC).outerHTML; // a fresh copy of the same document, never enhanced
    await destroyEnhancement(root);
    expect(cardOf(root)).toBeNull();
    expect(root.outerHTML).toBe(html);
  });
});

describe('hover, with a mouse', () => {
  it('shows after the delay, and only for a mouse', async () => {
    const root = await open();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const d1 = link(root, 'xref', 'D1');
    pointer(d1, 'pointerover', { pointerType: 'touch' });
    vi.advanceTimersByTime(SHOW_DELAY_MS * 4);
    expect(isOpen(root)).toBe(false);
    pointer(d1, 'pointerover');
    vi.advanceTimersByTime(SHOW_DELAY_MS - 1);
    expect(isOpen(root)).toBe(false);
    vi.advanceTimersByTime(1);
    expect(isOpen(root)).toBe(true);
    expect(SHOW_DELAY_MS).toBe(250);
  });

  it('a pointer that leaves before the delay shows nothing, wherever it goes', async () => {
    const root = await open();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const d1 = link(root, 'xref', 'D1');
    pointer(d1, 'pointerover');
    pointer(d1, 'pointerout', { relatedTarget: d1.parentElement });
    vi.advanceTimersByTime(SHOW_DELAY_MS * 4);
    expect(isOpen(root)).toBe(false);
    pointer(d1, 'pointerover');
    pointer(d1, 'pointerout', { relatedTarget: null });
    vi.advanceTimersByTime(SHOW_DELAY_MS * 4);
    expect(isOpen(root)).toBe(false);
    // the control: a pointer that stays
    pointer(d1, 'pointerover');
    vi.advanceTimersByTime(SHOW_DELAY_MS);
    expect(isOpen(root)).toBe(true);
  });

  it('a second trigger hovered before the delay is the one shown', async () => {
    const root = await open();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    pointer(link(root, 'xref', 'D1'), 'pointerover');
    vi.advanceTimersByTime(SHOW_DELAY_MS / 2);
    pointer(link(root, 'xref', 'D2'), 'pointerover');
    vi.advanceTimersByTime(SHOW_DELAY_MS / 2 + 1);
    expect(isOpen(root)).toBe(false);
    vi.advanceTimersByTime(SHOW_DELAY_MS);
    expect(theCard(root).getAttribute('aria-label')).toBe('D2 preview');
  });

  it('leaving the trigger hides after a delay; the card itself keeps it, and leaving the card hides it', async () => {
    const root = await open();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const d1 = link(root, 'xref', 'D1');
    pointer(d1, 'pointerover');
    vi.advanceTimersByTime(SHOW_DELAY_MS);
    const card = theCard(root);
    // out of the trigger, into the paragraph: hidden after the delay
    pointer(d1, 'pointerout', { relatedTarget: d1.parentElement });
    vi.advanceTimersByTime(HIDE_DELAY_MS - 1);
    expect(isOpen(root)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isOpen(root)).toBe(false);
    expect(HIDE_DELAY_MS).toBe(220);
    // again, but the pointer reaches the card before the delay ends
    pointer(d1, 'pointerover');
    vi.advanceTimersByTime(SHOW_DELAY_MS);
    pointer(d1, 'pointerout', { relatedTarget: d1.parentElement });
    vi.advanceTimersByTime(HIDE_DELAY_MS / 2);
    pointer(card.querySelector('.xc-head') as Element, 'pointerover');
    vi.advanceTimersByTime(HIDE_DELAY_MS * 4);
    expect(isOpen(root)).toBe(true);
    // straight from the trigger into the card: nothing to hide
    pointer(d1, 'pointerout', { relatedTarget: card });
    vi.advanceTimersByTime(HIDE_DELAY_MS * 4);
    expect(isOpen(root)).toBe(true);
    // from the card back onto its trigger: kept
    pointer(card, 'pointerout', { relatedTarget: d1 });
    vi.advanceTimersByTime(HIDE_DELAY_MS * 4);
    expect(isOpen(root)).toBe(true);
    // out of the card: hidden after the delay
    pointer(card.querySelector('.xc-head') as Element, 'pointerout', { relatedTarget: root.querySelector('h1') });
    vi.advanceTimersByTime(HIDE_DELAY_MS);
    expect(isOpen(root)).toBe(false);
  });

  it('the pointer back on the trigger keeps the card; leaving the card again starts the delay again', async () => {
    const root = await open();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const d1 = link(root, 'xref', 'D1');
    pointer(d1, 'pointerover');
    vi.advanceTimersByTime(SHOW_DELAY_MS);
    pointer(d1, 'pointerout', { relatedTarget: d1.parentElement });
    vi.advanceTimersByTime(HIDE_DELAY_MS / 2);
    pointer(d1, 'pointerover');
    // past the hide's delay, and before a new show's could end: the card never closed
    vi.advanceTimersByTime(HIDE_DELAY_MS);
    expect([isOpen(root), d1.getAttribute('aria-expanded')]).toEqual([true, 'true']);
    vi.advanceTimersByTime(HIDE_DELAY_MS * 4);
    expect(isOpen(root)).toBe(true);
    const card = theCard(root);
    const head = card.querySelector('.xc-head') as Element;
    pointer(head, 'pointerout', { relatedTarget: root.querySelector('h1') });
    vi.advanceTimersByTime(HIDE_DELAY_MS - 20);
    pointer(head, 'pointerout', { relatedTarget: root.querySelector('h1') });
    vi.advanceTimersByTime(40);
    expect(isOpen(root)).toBe(true);
    vi.advanceTimersByTime(HIDE_DELAY_MS);
    expect(isOpen(root)).toBe(false);
  });

  it('a pending show waits out a pointer leaving something else, a pointer down, and focus moving elsewhere; going somewhere calls it off', async () => {
    const root = await open();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const d1 = link(root, 'xref', 'D1');
    const h1 = root.querySelector('h1') as Element;
    const plain = root.querySelector('a[href="#2-rules"]') as HTMLElement;
    plain.focus();
    pointer(d1, 'pointerover');
    pointer(h1, 'pointerout', { relatedTarget: root });
    pointer(h1, 'pointerdown');
    (root.querySelector('a[href="#2-rules"]') as HTMLElement).blur();
    vi.advanceTimersByTime(SHOW_DELAY_MS);
    expect(isOpen(root)).toBe(true);
    pointer(document.body, 'pointerdown');
    expect(isOpen(root)).toBe(false);
    pointer(d1, 'pointerover');
    const ctx = ctxOf(root);
    ctx.operate(() => ctx.nav.goTo(h1));
    vi.advanceTimersByTime(SHOW_DELAY_MS * 4);
    expect(isOpen(root)).toBe(false);
  });

  it('an event whose target is the trigger\'s text counts as the trigger\'s', async () => {
    const root = await open();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const d1 = link(root, 'xref', 'D1');
    pointer(d1.firstChild as Node, 'pointerover');
    vi.advanceTimersByTime(SHOW_DELAY_MS);
    expect(theCard(root).getAttribute('aria-label')).toBe('D1 preview');
  });

  it('leaving another trigger leaves an open card alone, and a touch pointer leaving hides nothing', async () => {
    const root = await open();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    focus(link(root, 'xref', 'D1'));
    const d2 = link(root, 'xref', 'D2');
    pointer(d2, 'pointerout', { relatedTarget: d2.parentElement });
    pointer(link(root, 'xref', 'D1'), 'pointerout', { relatedTarget: null, pointerType: 'touch' });
    vi.advanceTimersByTime(HIDE_DELAY_MS * 4);
    expect(theCard(root).getAttribute('aria-label')).toBe('D1 preview');
    expect(isOpen(root)).toBe(true);
  });

  it('dragging in the full-screen figure keeps the card on its block (Task 23)', async () => {
    const root = await open();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const ctx = ctxOf(root);
    const overlay = chrome(document, 'div', { className: 'fig-overlay' });
    ctx.journal.insert(overlay, root, null);
    const block = dnode(root, { ref: 'D1' }, overlay);
    click(block);
    expect(isOpen(root)).toBe(true);
    pointer(block, 'pointerout', { relatedTarget: overlay, buttons: 1 });
    vi.advanceTimersByTime(HIDE_DELAY_MS * 4);
    expect(isOpen(root)).toBe(true);
    pointer(block, 'pointerout', { relatedTarget: overlay, buttons: 0 });
    vi.advanceTimersByTime(HIDE_DELAY_MS);
    expect(isOpen(root)).toBe(false);
    // the same drag outside the full-screen figure hides it
    const plain = dnode(root, { ref: 'D2' });
    click(plain);
    pointer(plain, 'pointerout', { relatedTarget: root, buttons: 1 });
    vi.advanceTimersByTime(HIDE_DELAY_MS);
    expect(isOpen(root)).toBe(false);
  });

  it('does not suppress an ordinary diagram click inside host lookalike viewer wrappers', async () => {
    const root = await open();
    const hostOverlay = document.createElement('div');
    hostOverlay.className = 'fig-overlay open';
    const hostStage = document.createElement('div');
    hostStage.className = 'fo-stage';
    hostOverlay.append(hostStage);
    document.body.removeChild(root);
    hostStage.append(root);
    document.body.append(hostOverlay);
    const block = dnode(root, { ref: 'D1' });

    click(block);

    expect(isOpen(root)).toBe(true);
  });
});

describe('focus', () => {
  it('focus shows at once; focus moving on hides after the delay, and into the card keeps it', async () => {
    const root = await open();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const d1 = link(root, 'xref', 'D1');
    focus(d1);
    expect(isOpen(root)).toBe(true);
    const go = theCard(root).querySelector('a.xc-go') as HTMLElement;
    focus(go);
    vi.advanceTimersByTime(HIDE_DELAY_MS * 4);
    expect(isOpen(root)).toBe(true);
    focus(d1);
    vi.advanceTimersByTime(HIDE_DELAY_MS * 4);
    expect(isOpen(root)).toBe(true);
    focus(root.querySelector('a[href="#2-rules"]') as HTMLElement);
    vi.advanceTimersByTime(HIDE_DELAY_MS - 1);
    expect(isOpen(root)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isOpen(root)).toBe(false);
  });

  it('a press on the card\'s text keeps it, though the focus leaves for nothing; the press is forgotten once it hides', async () => {
    const root = await open();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const d1 = link(root, 'xref', 'D1');
    focus(d1);
    pointer(theCard(root).querySelector('.xc-body') as Element, 'pointerdown');
    d1.blur();
    vi.advanceTimersByTime(HIDE_DELAY_MS * 4);
    expect(isOpen(root)).toBe(true);
    // a press elsewhere in the root is no press on the card: the focus leaving for nothing hides it again
    focus(d1);
    pointer(d1, 'pointerdown');
    d1.blur();
    vi.advanceTimersByTime(HIDE_DELAY_MS);
    expect(isOpen(root)).toBe(false);
    // a press on the card, then the card hidden by a key: the next card hides when the focus leaves for nothing
    focus(d1);
    pointer(theCard(root).querySelector('.xc-body') as Element, 'pointerdown');
    key(d1, 'Escape');
    expect(isOpen(root)).toBe(false);
    d1.blur();
    focus(link(root, 'xref', 'D2'));
    link(root, 'xref', 'D2').blur();
    vi.advanceTimersByTime(HIDE_DELAY_MS);
    expect(isOpen(root)).toBe(false);
  });

  it('the focus back on the trigger shown within the delay keeps its card', async () => {
    const root = await open();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const d1 = link(root, 'xref', 'D1');
    focus(d1);
    d1.blur();
    vi.advanceTimersByTime(HIDE_DELAY_MS - 1);
    focus(d1);
    vi.advanceTimersByTime(HIDE_DELAY_MS * 4);
    expect([isOpen(root), d1.getAttribute('aria-expanded')]).toEqual([true, 'true']);
  });

  it('focus leaving the page (to nothing) hides it', async () => {
    const root = await open();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const d1 = link(root, 'xref', 'D1');
    focus(d1);
    expect(isOpen(root)).toBe(true);
    d1.blur();
    vi.advanceTimersByTime(HIDE_DELAY_MS);
    expect(isOpen(root)).toBe(false);
  });
});

describe('Escape', () => {
  it('Escape on the trigger closes the card, keeps the focus there, and does not open it again', async () => {
    const root = await open();
    const d1 = link(root, 'xref', 'D1');
    focus(d1);
    expect(isOpen(root)).toBe(true);
    const e = key(d1, 'Escape');
    // the keyboard layer closes the top overlay, the card, and leaves the key's default alone, as the reference did
    expect([isOpen(root), document.activeElement === d1, e.defaultPrevented, d1.getAttribute('aria-expanded')]).toEqual([false, true, false, 'false']);
  });

  it('Escape inside the card closes it and returns the focus to its trigger without opening it again', async () => {
    const root = await open();
    const d1 = link(root, 'xref', 'D1');
    focus(d1);
    const go = theCard(root).querySelector('a.xc-go') as HTMLElement;
    focus(go);
    const e = key(go, 'Escape');
    expect([isOpen(root), document.activeElement === d1, e.defaultPrevented]).toEqual([false, true, true]);
  });

  it('Escape with the focus elsewhere closes the card and moves no focus', async () => {
    const root = await open();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    pointer(link(root, 'xref', 'D1'), 'pointerover');
    vi.advanceTimersByTime(SHOW_DELAY_MS);
    const other = root.querySelector('a[href="#2-rules"]') as HTMLElement;
    other.focus();
    expect(isOpen(root)).toBe(true);
    key(other, 'Escape');
    expect([isOpen(root), document.activeElement === other]).toEqual([false, true]);
  });

  it('a key other than Tab and Escape in the card leaves it open', async () => {
    const root = await open();
    focus(link(root, 'xref', 'D1'));
    const go = theCard(root).querySelector('a.xc-go') as HTMLElement;
    focus(go);
    for (const k of ['Enter', 'a', 'ArrowDown']) expect(key(go, k).defaultPrevented, k).toBe(false);
    expect(isOpen(root)).toBe(true);
  });

  it('a trigger given the focus back shows its card again once the focus comes back to it later', async () => {
    const root = await open();
    const d1 = link(root, 'xref', 'D1');
    focus(d1);
    const go = theCard(root).querySelector('a.xc-go') as HTMLElement;
    focus(go);
    key(go, 'Escape');
    expect(isOpen(root)).toBe(false);
    focus(root.querySelector('a[href="#2-rules"]') as HTMLElement);
    focus(d1);
    expect(isOpen(root)).toBe(true);
  });

  it('closing the overlay with the focus in the card puts the focus back on the trigger; with it elsewhere, nowhere', async () => {
    const root = await open();
    const ctx = ctxOf(root);
    const d1 = link(root, 'xref', 'D1');
    focus(d1);
    focus(theCard(root).querySelector('a.xc-go') as HTMLElement);
    ctx.operate(() => ctx.overlays.close('card'));
    expect([isOpen(root), document.activeElement === d1]).toEqual([false, true]);
  });

  it('the card is the overlay "card", last in the Escape order, and no dialog', async () => {
    const root = await open();
    const ctx = ctxOf(root);
    focus(link(root, 'xref', 'D1'));
    expect([ctx.overlays.isOpen('card'), ctx.overlays.top(), ctx.overlays.any()]).toEqual([true, 'card', false]);
    expect(ctx.operate(() => ctx.overlays.close('card'))).toBe(true);
    expect([isOpen(root), ctx.overlays.isOpen('card'), ctx.overlays.top()]).toEqual([false, false, null]);
  });
});

describe('touch: the first tap previews, the second goes', () => {
  it('an ID: the first tap shows the card and goes nowhere; the second goes, and the card closes', async () => {
    const onHash = vi.fn();
    const root = await open(DOC, { onHash });
    const d2 = link(root, 'xref', 'D2');
    const first = tap(d2);
    expect([first.defaultPrevented, isOpen(root), onHash.mock.calls.length]).toEqual([true, true, 0]);
    const second = tap(d2);
    expect([second.defaultPrevented, isOpen(root)]).toEqual([true, false]);
    expect(onHash.mock.calls).toEqual([['D2', { push: true, from: null }]]);
  });

  it('a term: the first tap previews, the second goes to its row', async () => {
    const root = await open();
    const fold = link(root, 'term', 'fold');
    tap(fold);
    expect(isOpen(root)).toBe(true);
    expect(document.activeElement).not.toBe(ctxOf(root).terms.get('fold')?.target);
    tap(fold);
    expect(document.activeElement).toBe(ctxOf(root).terms.get('fold')?.target);
    expect(isOpen(root)).toBe(false);
  });

  it('a tap that focuses the link first (a touch, then focus, then the click) still only previews', async () => {
    const onHash = vi.fn();
    const root = await open(DOC, { onHash });
    const d2 = link(root, 'xref', 'D2');
    pointer(d2, 'pointerdown', { pointerType: 'touch' });
    focus(d2);
    expect(isOpen(root)).toBe(true);
    expect(click(d2).defaultPrevented).toBe(true);
    expect(onHash).not.toHaveBeenCalled();
    tap(d2);
    expect(onHash).toHaveBeenCalledTimes(1);
  });

  it('a focus long after the touch is no tap: its click goes', async () => {
    const onHash = vi.fn();
    const root = await open(DOC, { onHash });
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    const d2 = link(root, 'xref', 'D2');
    pointer(d2, 'pointerdown', { pointerType: 'touch' });
    now.mockReturnValue(1_000_000 + FRESH_MS);
    focus(d2);
    expect(isOpen(root)).toBe(true);
    click(d2);
    expect(onHash).toHaveBeenCalledTimes(1);
    expect(FRESH_MS).toBe(800);
  });

  it('a pointerdown that names no pointer is a mouse\'s', async () => {
    const onHash = vi.fn();
    const root = await open(DOC, { onHash });
    const d2 = link(root, 'xref', 'D2');
    pointer(d2, 'pointerdown', { pointerType: 'touch' });
    pointer(d2, 'pointerdown', { pointerType: '' });
    click(d2);
    expect([onHash.mock.calls.length, isOpen(root)]).toEqual([1, false]);
  });

  it('a pointer\'s click that names no pointer, long after its pointerdown, is read by that pointerdown', async () => {
    const onHash = vi.fn();
    const root = await open(DOC, { onHash });
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    const d2 = link(root, 'xref', 'D2');
    pointer(d2, 'pointerdown', { pointerType: 'mouse' });
    now.mockReturnValue(1_000_000 + FRESH_MS * 2);
    pclick(d2, '');
    expect([onHash.mock.calls.length, isOpen(root)]).toEqual([1, false]);
    pointer(d2, 'pointerdown', { pointerType: 'pen' });
    now.mockReturnValue(1_000_000 + FRESH_MS * 4);
    pclick(d2, '');
    expect([onHash.mock.calls.length, isOpen(root)]).toEqual([1, true]);
  });

  it('a key\'s click (detail 0) goes at once, however lately a touch came down', async () => {
    const onHash = vi.fn();
    const root = await open(DOC, { onHash });
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    const d2 = link(root, 'xref', 'D2');
    pointer(root.querySelector('h1') as Element, 'pointerdown', { pointerType: 'touch' });
    now.mockReturnValue(1_000_000 + 10_000);
    focus(d2);
    key(d2, 'Escape');
    expect(isOpen(root)).toBe(false);
    // Chromium's click for Enter names no pointer; WebKit's may name one: a key's click is told by its detail
    let n = 0;
    for (const says of ['', 'mouse', 'touch']) {
      pointer(root.querySelector('h1') as Element, 'pointerdown', { pointerType: 'touch' });
      pclick(d2, says, { detail: 0 });
      n += 1;
      expect([isOpen(root), onHash.mock.calls.length], `"${says}"`).toEqual([false, n]);
    }
  });

  it('the pointer is heard before the trigger\'s own handlers: one that stops the pointerdown does not make a tap a click', async () => {
    const onHash = vi.fn();
    const root = await open(DOC, { onHash });
    const d2 = link(root, 'xref', 'D2');
    d2.addEventListener('pointerdown', (e) => e.stopPropagation());
    tap(d2);
    expect([onHash.mock.calls.length, isOpen(root)]).toEqual([0, true]);
  });

  it('focus reaching the trigger whose card a tap showed leaves the next tap a click', async () => {
    const onHash = vi.fn();
    const root = await open(DOC, { onHash });
    const d2 = link(root, 'xref', 'D2');
    tap(d2);
    focus(d2);
    tap(d2);
    expect([onHash.mock.calls.length, isOpen(root)]).toEqual([1, false]);
  });

  it('a focus after a mouse\'s pointerdown is no tap: a touch click on its card\'s trigger goes', async () => {
    const onHash = vi.fn();
    const root = await open(DOC, { onHash });
    const d2 = link(root, 'xref', 'D2');
    pointer(d2, 'pointerdown', { pointerType: 'mouse' });
    focus(d2);
    expect(isOpen(root)).toBe(true);
    pclick(d2, 'touch');
    expect(onHash).toHaveBeenCalledTimes(1);
  });

  it('a first tap never reaches the page around the root', async () => {
    const root = await open();
    const heard = vi.fn();
    document.body.addEventListener('click', heard);
    tap(link(root, 'xref', 'D2'));
    document.body.removeEventListener('click', heard);
    expect([heard.mock.calls.length, isOpen(root)]).toEqual([0, true]);
  });

  it('a mouse click goes at once; a click that names touch after a mouse\'s pointerdown is read by its own word', async () => {
    const onHash = vi.fn();
    const root = await open(DOC, { onHash });
    const d2 = link(root, 'xref', 'D2');
    pointer(d2, 'pointerdown', { pointerType: 'mouse' });
    click(d2);
    expect([onHash.mock.calls.length, isOpen(root)]).toEqual([1, false]);
    // a click that says touch, after a mouse pointerdown, previews
    pointer(d2, 'pointerdown', { pointerType: 'mouse' });
    const t = pclick(d2, 'touch');
    expect([onHash.mock.calls.length, isOpen(root), t.defaultPrevented]).toEqual([1, true, true]);
  });

  it('a click within FRESH_MS of a touch is the touch\'s, whatever it names; later, its own word wins', async () => {
    const onHash = vi.fn();
    const root = await open(DOC, { onHash });
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    const d2 = link(root, 'xref', 'D2');
    pointer(d2, 'pointerdown', { pointerType: 'touch' });
    now.mockReturnValue(1_000_000 + FRESH_MS - 1);
    expect([pclick(d2, 'mouse').defaultPrevented, isOpen(root), onHash.mock.calls.length]).toEqual([true, true, 0]);
    key(d2, 'Escape');
    pointer(d2, 'pointerdown', { pointerType: 'touch' });
    now.mockReturnValue(1_000_000 + FRESH_MS * 2 - 1);
    pclick(d2, 'mouse');
    expect([isOpen(root), onHash.mock.calls.length]).toEqual([false, 1]);
  });

  it('a tap previews and the next goes, whatever its click names: WebKit\'s "mouse", Chromium\'s "touch", or none', async () => {
    for (const says of ['mouse', 'touch', '']) {
      const onHash = vi.fn();
      const root = await open(DOC, { onHash });
      const d2 = link(root, 'xref', 'D2');
      expect([tap(d2, says).defaultPrevented, isOpen(root), onHash.mock.calls.length], `"${says}"`).toEqual([true, true, 0]);
      expect([tap(d2, says).defaultPrevented, isOpen(root), onHash.mock.calls.length], `"${says}"`).toEqual([true, false, 1]);
      await destroyEnhancement(root);
    }
  });

  it('WebKit\'s tap: a touch, the focus, then a click that names "mouse"; the first previews, the second goes', async () => {
    const onHash = vi.fn();
    const root = await open(DOC, { onHash });
    const d2 = link(root, 'xref', 'D2');
    pointer(d2, 'pointerdown', { pointerType: 'touch' });
    focus(d2);
    expect([pclick(d2, 'mouse').defaultPrevented, isOpen(root), onHash.mock.calls.length]).toEqual([true, true, 0]);
    tap(d2);
    expect([isOpen(root), onHash.mock.calls.length]).toEqual([false, 1]);
  });
});

describe('Tab into the card and out', () => {
  it('Tab on the trigger enters the card; Shift+Tab on its first stop returns; Tab on its last closes it and returns quietly', async () => {
    const root = await open();
    const d1 = link(root, 'xref', 'D1');
    focus(d1);
    const card = theCard(root);
    const go = card.querySelector('a.xc-go') as HTMLElement;
    const tab = key(d1, 'Tab');
    expect([tab.defaultPrevented, document.activeElement === go]).toEqual([true, true]);
    const back = key(go, 'Tab', { shiftKey: true });
    expect([back.defaultPrevented, document.activeElement === d1, isOpen(root)]).toEqual([true, true, true]);
    key(d1, 'Tab');
    const out = key(go, 'Tab');
    // the browser then moves on from the trigger: the default stays
    expect([out.defaultPrevented, document.activeElement === d1, isOpen(root)]).toEqual([false, true, false]);
  });

  it('Shift+Tab on the trigger, and Tab on a trigger whose card is not open, are the browser\'s', async () => {
    const root = await open();
    const d1 = link(root, 'xref', 'D1');
    focus(d1);
    expect(isOpen(root)).toBe(true);
    expect(key(d1, 'Tab', { shiftKey: true }).defaultPrevented).toBe(false);
    expect([key(d1, 'a').defaultPrevented, document.activeElement === d1]).toEqual([false, true]);
    const d2 = link(root, 'xref', 'D2');
    expect(key(d2, 'Tab').defaultPrevented).toBe(false);
  });

  it('a card with links in its body: Tab goes to the first, and out only from the last', async () => {
    const root = await open(['# T', '', '| ID | What |', '|---|---|', '| L1 | See [the guide](other.md) |', '| L2 | Two |', '', 'L1 named.'].join('\n'));
    const l1 = link(root, 'xref', 'L1');
    focus(l1);
    const stops = Array.from(theCard(root).querySelectorAll('a[href]'));
    expect(stops.map((a) => squash(a.textContent))).toEqual(['the guide', 'Go to L1 →']);
    key(l1, 'Tab');
    expect(document.activeElement).toBe(stops[0]);
    const mid = key(stops[0] as Element, 'Tab');
    expect([mid.defaultPrevented, isOpen(root)]).toEqual([false, true]);
  });
});

describe('closing it', () => {
  it('a pointer down outside the card and the triggers hides it; on the card or a trigger it does not', async () => {
    const root = await open();
    focus(link(root, 'xref', 'D1'));
    pointer(theCard(root).querySelector('.xc-body') as Element, 'pointerdown');
    pointer(link(root, 'xref', 'D2'), 'pointerdown');
    expect(isOpen(root)).toBe(true);
    pointer(root.querySelector('h1') as Element, 'pointerdown');
    expect(isOpen(root)).toBe(false);
    focus(link(root, 'xref', 'D2'));
    pointer(document.body, 'pointerdown');
    expect(isOpen(root)).toBe(false);
  });

  it('going anywhere closes it: a link the reader follows, the card\'s own link, the keys', async () => {
    const root = await open();
    focus(link(root, 'xref', 'D1'));
    expect(isOpen(root)).toBe(true);
    click(root.querySelector('a[href="#2-rules"]') as Element);
    expect(isOpen(root)).toBe(false);
    const ctx = ctxOf(root);
    focus(link(root, 'xref', 'D2'));
    expect(isOpen(root)).toBe(true);
    ctx.operate(() => ctx.nav.goTo(root.querySelector('h1') as Element));
    expect(isOpen(root)).toBe(false);
  });

  it('a link inside the card to a place in the page closes it after the click', async () => {
    const root = await open(['# T', '', '## 1. A', '', '| ID | What |', '|---|---|', '| L1 | See [the top](#1-a) |', '| L2 | Two |', '', 'L1 named.'].join('\n'));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const l1 = link(root, 'xref', 'L1');
    pointer(l1, 'pointerover');
    vi.advanceTimersByTime(SHOW_DELAY_MS);
    const inner = Array.from(theCard(root).querySelectorAll('a')).find((a) => a.textContent === 'the top') as HTMLElement;
    click(inner, { ctrlKey: true }); // left to the browser: nav does not go, so only the card's own timer closes it
    expect(isOpen(root)).toBe(true);
    vi.advanceTimersByTime(0);
    expect(isOpen(root)).toBe(false);
  });

  it('a link inside the card to another document does not close it', async () => {
    const root = await open(['# T', '', '| ID | What |', '|---|---|', '| L1 | See [the guide](other.md) |', '| L2 | Two |', '', 'L1 named.'].join('\n'));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    focus(link(root, 'xref', 'L1'));
    const inner = Array.from(theCard(root).querySelectorAll('a')).find((a) => a.textContent === 'the guide') as HTMLElement;
    inner.addEventListener('click', (e) => e.preventDefault()); // no navigation in the test page
    click(inner);
    vi.advanceTimersByTime(HIDE_DELAY_MS * 4);
    expect(isOpen(root)).toBe(true);
  });
});

describe('the card\'s link', () => {
  it('a plain click goes to the definition through nav: hidden, focused, the host told', async () => {
    const onHash = vi.fn();
    const root = await open(DOC, { onHash });
    focus(link(root, 'xref', 'D2'));
    const go = theCard(root).querySelector('a.xc-go') as HTMLElement;
    const e = click(go);
    const row = ctxOf(root).index.get('D2')?.target;
    expect([e.defaultPrevented, isOpen(root), document.activeElement === row]).toEqual([true, false, true]);
    expect(onHash.mock.calls).toEqual([['D2', { push: true, from: null }]]);
  });

  it('a term\'s link goes to its row', async () => {
    const root = await open();
    focus(link(root, 'term', 'read mark'));
    click(theCard(root).querySelector('a.xc-go') as HTMLElement);
    expect(document.activeElement).toBe(ctxOf(root).terms.get('read mark')?.target);
  });

  it('a modified click, another button, or one already handled, is not the card\'s', async () => {
    const onHash = vi.fn();
    const root = await open(DOC, { onHash });
    focus(link(root, 'xref', 'D2'));
    const go = theCard(root).querySelector('a.xc-go') as HTMLElement;
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      expect(click(go, init).defaultPrevented, JSON.stringify(init)).toBe(false);
    }
    go.addEventListener('click', (ev) => ev.preventDefault(), { once: true });
    click(go);
    expect(onHash).not.toHaveBeenCalled();
    expect(isOpen(root)).toBe(true);
  });
});

describe('placement', () => {
  /** Show the card for `a` with its box and the card's size stubbed. */
  function placed(root: HTMLElement, a: Element, at: { top: number; left: number; height?: number }, natural: number, width = 300): HTMLElement {
    boxAt(a, { height: 20, width: 40, ...at });
    focus(a);
    const card = theCard(root);
    cardSize(card, natural, width);
    window.dispatchEvent(new Event('scroll'));
    return card;
  }

  it('below the trigger when the card fits there', async () => {
    const root = await open();
    const card = placed(root, link(root, 'xref', 'D1'), { top: 100, left: 200 }, 200);
    expect([px(card, 'top'), px(card, 'left'), px(card, 'max-height')]).toEqual([120 + GAP, 200 - LEAD, 200]);
    expect([GAP, LEAD, ROOM, EDGE, MIN_HEIGHT]).toEqual([8, 16, 16, 12, 120]);
  });

  it('above the trigger when below is short and above is longer, under the bar', async () => {
    const root = await open();
    root.style.setProperty('--bar-h', '60px');
    const h = window.innerHeight;
    const card = placed(root, link(root, 'xref', 'D1'), { top: h - 100, left: 200 }, 400);
    // below: 100 - 20 - 16 = 64; above: (h - 100) - 60 - 16
    const above = h - 100 - 60 - ROOM;
    expect([px(card, 'max-height'), px(card, 'top')]).toEqual([Math.min(400, above), h - 100 - Math.min(400, above) - GAP]);
  });

  it('the bar\'s height comes from --bar-h, and is none while the bar is hidden', async () => {
    const root = await open();
    const h = window.innerHeight;
    root.style.setProperty('--bar-h', '300px');
    const card = placed(root, link(root, 'xref', 'D1'), { top: 500, left: 200 }, 2000);
    // below: h - 520 - 16; above: 500 - 300 - 16 = 184
    const below = h - 520 - ROOM;
    expect(px(card, 'max-height')).toBe(Math.max(below, 184));
    root.classList.add('bar-hidden');
    window.dispatchEvent(new Event('scroll'));
    expect(px(card, 'max-height')).toBe(Math.max(below, 500 - ROOM));
  });

  it('below when the card fits there, even with more room above', async () => {
    const root = await open();
    const card = placed(root, link(root, 'xref', 'D1'), { top: 500, left: 200 }, 100);
    expect([px(card, 'top'), px(card, 'max-height')]).toEqual([520 + GAP, MIN_HEIGHT]);
  });

  it('below when the room is equal; the height is never under the floor', async () => {
    const root = await open();
    const h = window.innerHeight;
    // the trigger in the middle, so below and above (no bar) are equal: below wins
    root.style.setProperty('--bar-h', '0px');
    const top = (h - 20) / 2;
    const card = placed(root, link(root, 'xref', 'D1'), { top, left: 200 }, 5000);
    expect([px(card, 'top'), px(card, 'max-height')]).toEqual([top + 20 + GAP, h - (top + 20) - ROOM]);
    // a trigger taller than the window leaves little room either side: the floor holds
    boxAt(link(root, 'xref', 'D1'), { top: 100, left: 200, height: h - 140 });
    window.dispatchEvent(new Event('scroll'));
    expect(px(card, 'max-height')).toBe(MIN_HEIGHT);
  });

  it('with no --bar-h the room above runs to the window\'s top', async () => {
    const root = await open();
    const h = window.innerHeight;
    const card = placed(root, link(root, 'xref', 'D1'), { top: h - 100, left: 200 }, 2000);
    expect(px(card, 'max-height')).toBe(h - 100 - ROOM);
  });

  it('the natural height is measured afresh each time: the last max-height is cleared first', async () => {
    const root = await open();
    const h = window.innerHeight;
    const d1 = link(root, 'xref', 'D1');
    const card = placed(root, d1, { top: 100, left: 200, height: h - 140 }, 400);
    expect(px(card, 'max-height')).toBe(MIN_HEIGHT);
    boxAt(d1, { top: 100, left: 200, height: 20 });
    window.dispatchEvent(new Event('scroll'));
    expect(px(card, 'max-height')).toBe(400);
  });

  it('show() answers false for a trigger out of the window, and calls off a pending hide', async () => {
    const root = await open();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const ctx = ctxOf(root);
    const away = dnode(root, { ref: 'D2' });
    boxAt(away, { top: -50, left: 200 });
    expect([show(ctx, away), isOpen(root)]).toEqual([false, false]);
    const d1 = link(root, 'xref', 'D1');
    focus(d1);
    pointer(d1, 'pointerout', { relatedTarget: null });
    expect(show(ctx, d1)).toBe(true);
    vi.advanceTimersByTime(HIDE_DELAY_MS * 4);
    expect(isOpen(root)).toBe(true);
  });

  it('clamped to the viewport on the left and the right', async () => {
    const root = await open();
    const w = window.innerWidth;
    const card = placed(root, link(root, 'xref', 'D1'), { top: 100, left: 4 }, 100, 300);
    expect(px(card, 'left')).toBe(EDGE);
    boxAt(link(root, 'xref', 'D1'), { top: 100, left: w - 30, height: 20 });
    window.dispatchEvent(new Event('scroll'));
    expect(px(card, 'left')).toBe(w - 300 - EDGE);
  });

  it('follows the trigger on scroll, and hides once the trigger leaves the window or the document', async () => {
    const root = await open();
    const d1 = link(root, 'xref', 'D1');
    const card = placed(root, d1, { top: 100, left: 200 }, 100);
    boxAt(d1, { top: 60, left: 200, height: 20 });
    window.dispatchEvent(new Event('scroll'));
    expect(px(card, 'top')).toBe(80 + GAP);
    boxAt(d1, { top: -25, left: 200, height: 20 });
    window.dispatchEvent(new Event('scroll'));
    expect(isOpen(root)).toBe(false);
    focus(link(root, 'xref', 'D2'));
    boxAt(link(root, 'xref', 'D2'), { top: window.innerHeight + 1, left: 200, height: 20 });
    window.dispatchEvent(new Event('scroll'));
    expect(isOpen(root)).toBe(false);
    // a diagram block removed while its card is open
    const block = dnode(root, { ref: 'D1' });
    click(block);
    expect(isOpen(root)).toBe(true);
    block.remove();
    window.dispatchEvent(new Event('scroll'));
    expect(isOpen(root)).toBe(false);
  });
});

describe('diagram blocks and show(ctx, trigger) (Task 23)', () => {
  it('a click on a block shows its card, by any pointer; the block goes nowhere itself', async () => {
    const root = await open();
    const block = dnode(root, { ref: 'D1' });
    pointer(block, 'pointerdown', { pointerType: 'mouse' });
    const e = click(block);
    expect([isOpen(root), e.defaultPrevented, theCard(root).getAttribute('aria-label')]).toEqual([true, false, 'D1 preview']);
    const term = dnode(root, { term: 'read mark' });
    tap(term);
    expect(theCard(root).getAttribute('aria-label')).toBe('Definition: Read mark');
  });

  it('Enter or Space on a block shows its card and moves into it', async () => {
    const root = await open();
    for (const k of ['Enter', ' ']) {
      const block = dnode(root, { ref: 'D2' });
      const e = key(block, k);
      expect([e.defaultPrevented, isOpen(root), document.activeElement?.classList.contains('xc-go')], k).toEqual([true, true, true]);
      key(document.activeElement as Element, 'Escape');
      block.remove();
    }
    const other = dnode(root, { ref: 'D2' });
    expect(key(other, 'a').defaultPrevented).toBe(false);
  });

  it('a block whose Enter something else took shows nothing', async () => {
    const root = await open();
    const block = dnode(root, { ref: 'D2' });
    block.addEventListener('keydown', (e) => e.preventDefault());
    key(block, 'Enter');
    expect(isOpen(root)).toBe(false);
  });

  it('Enter or Space on a block that shows no card leaves the key and the focus alone, whatever card is open', async () => {
    const root = await open();
    const ctx = ctxOf(root);
    const hidden = chrome(document, 'div', { className: 'rv-hide' });
    ctx.journal.insert(hidden, root, null);
    focus(link(root, 'xref', 'D1'));
    expect(isOpen(root)).toBe(true);
    for (const block of [dnode(root, { ref: 'D2' }, hidden), dnode(root, { ref: 'Z9' })]) {
      for (const k of ['Enter', ' ']) {
        block.focus();
        const e = key(block, k);
        expect([e.defaultPrevented, document.activeElement === block, theCard(root).getAttribute('aria-label')], `${block.textContent} ${k}`).toEqual([
          false,
          true,
          'D1 preview',
        ]);
      }
    }
  });

  it('data-term names a term first; an empty one leaves data-ref to name an ID', async () => {
    const root = await open();
    const ctx = ctxOf(root);
    expect(show(ctx, dnode(root, { term: 'fold', ref: 'D1' }))).toBe(true);
    expect(theCard(root).getAttribute('aria-label')).toBe('Definition: Fold');
    expect(show(ctx, dnode(root, { term: '', ref: 'D1' }))).toBe(true);
    expect(theCard(root).getAttribute('aria-label')).toBe('D1 preview');
  });

  it('show() of a context no instance made answers false', async () => {
    const root = await open();
    expect(show({ ...ctxOf(root) }, link(root, 'xref', 'D1'))).toBe(false);
    expect(cardOf(root)).toBeNull();
  });

  it('a block Play has not revealed yet shows nothing', async () => {
    const root = await open();
    const ctx = ctxOf(root);
    const hidden = chrome(document, 'div', { className: 'rv-hide' });
    ctx.journal.insert(hidden, root, null);
    const block = dnode(root, { ref: 'D1' }, hidden);
    click(block);
    expect(isOpen(root)).toBe(false);
    expect(ctx.operate(() => show(ctx, block))).toBe(false);
  });

  it('show(ctx, trigger) shows a trigger of this root, places it again for the same one, and refuses the rest', async () => {
    const root = await open();
    const ctx = ctxOf(root);
    const block = dnode(root, { ref: 'D1' });
    boxAt(block, { top: 100, left: 200 });
    expect(show(ctx, block)).toBe(true);
    const card = theCard(root);
    expect([isOpen(root), px(card, 'top')]).toEqual([true, 120 + GAP]);
    const content = card.querySelector('.xc-head');
    boxAt(block, { top: 300, left: 200 });
    expect(show(ctx, block)).toBe(true);
    expect(px(card, 'top')).toBe(320 + GAP);
    expect(card.querySelector('.xc-head')).toBe(content); // the same node: placed again, not made again
    expect(show(ctx, link(root, 'term', 'fold'))).toBe(true);
    expect(card.getAttribute('aria-label')).toBe('Definition: Fold');
    // unknown names, a plain element, an element outside the root
    expect(show(ctx, dnode(root, { ref: 'Z9' }))).toBe(false);
    expect(show(ctx, dnode(root, { term: 'nothing here' }))).toBe(false);
    expect(show(ctx, root.querySelector('h1') as Element)).toBe(false);
    const outside = document.createElement('span');
    outside.dataset['ref'] = 'D1';
    document.body.append(outside);
    expect(show(ctx, outside)).toBe(false);
    expect(card.getAttribute('aria-label')).toBe('Definition: Fold');
  });

  it('show() of another root\'s context never reaches this root, and does nothing once destroyed', async () => {
    const a = await open();
    const b = await open();
    const ca = ctxOf(a);
    expect(show(ca, link(b, 'xref', 'D1'))).toBe(false);
    expect([cardOf(a), cardOf(b)]).toEqual([null, null]);
    expect(show(ctxOf(b), link(b, 'xref', 'D1'))).toBe(true);
    expect([cardOf(a), isOpen(b)]).toEqual([null, true]);
    await destroyEnhancement(a);
    expect(show(ca, link(b, 'xref', 'D1'))).toBe(false);
    const fresh = mount();
    expect(show(ca, fresh)).toBe(false);
  });
});

describe('two roots (RF2)', () => {
  it('each root has its own card; Escape closes only the root\'s own', async () => {
    const a = await open();
    const b = await open();
    focus(link(b, 'xref', 'D2'));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    pointer(link(a, 'xref', 'D1'), 'pointerover');
    vi.advanceTimersByTime(SHOW_DELAY_MS);
    expect([isOpen(a), isOpen(b)]).toEqual([true, true]);
    expect(theCard(a).id).not.toBe(theCard(b).id);
    key(link(b, 'xref', 'D2'), 'Escape');
    expect([isOpen(a), isOpen(b)]).toEqual([true, false]);
    // a pointer down on the other root's trigger is outside this root's card and triggers
    pointer(link(b, 'xref', 'D1'), 'pointerdown');
    expect(isOpen(a)).toBe(false);
  });
});

describe('teardown', () => {
  it('after destroy no timer fires: a pending show or hide is cancelled, and does nothing', async () => {
    const root = await open();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const set = vi.spyOn(window, 'setTimeout');
    const clear = vi.spyOn(window, 'clearTimeout');
    /** The window's id of the last timer of `ms`. */
    const timerOf = (ms: number): unknown => {
      const at = set.mock.calls.map((c) => c[1]).lastIndexOf(ms);
      return at < 0 ? undefined : set.mock.results[at]?.value;
    };
    const d1 = link(root, 'xref', 'D1');
    pointer(d1, 'pointerover');
    const showing = timerOf(SHOW_DELAY_MS);
    expect(showing).toBeDefined();
    const writes = vi.spyOn(Element.prototype, 'setAttribute');
    await destroyEnhancement(root);
    expect(clear.mock.calls.some(([id]) => id === showing)).toBe(true);
    writes.mockClear();
    vi.advanceTimersByTime(SHOW_DELAY_MS * 4);
    expect([cardOf(root), writes.mock.calls.length]).toEqual([null, 0]);

    const again = await open();
    const a = link(again, 'xref', 'D1');
    focus(a);
    pointer(a, 'pointerout', { relatedTarget: null });
    const hiding = timerOf(HIDE_DELAY_MS);
    expect(hiding).toBeDefined();
    await destroyEnhancement(again);
    expect(clear.mock.calls.some(([id]) => id === hiding)).toBe(true);
    writes.mockClear();
    vi.advanceTimersByTime(HIDE_DELAY_MS * 4);
    expect([cardOf(again), writes.mock.calls.length]).toEqual([null, 0]);
  });

  it('after destroy the triggers, the document and the window hear nothing', async () => {
    const root = await open();
    const d1 = link(root, 'xref', 'D1');
    focus(d1);
    const card = theCard(root);
    await destroyEnhancement(root);
    const writes = vi.spyOn(Element.prototype, 'setAttribute');
    focus(root.querySelector('p') as HTMLElement);
    pointer(document.body, 'pointerdown');
    window.dispatchEvent(new Event('scroll'));
    key(card, 'Escape');
    expect(writes).not.toHaveBeenCalled();
  });
});
