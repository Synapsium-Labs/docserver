// @vitest-environment jsdom
// The quick jump and the keys sheet (docserver L2, Task 16): "/" or Ctrl or Cmd+K opens a finder over the headings,
// tasks, defined IDs and figures (jump.ts, the reference layout's section 21), and "?" opens the sheet of the keys that
// apply now, with the colour key (keysheet.ts, section 25).
//
// The IDs (Task 9), the plan (Task 11) and the figures (Task 15) are built beside this task, so these tests seed
// ctx.index, ctx.plan and ctx.figures with fixtures, as Task 13's do: a probe feature that runs right before the jump.
// The feature list is mocked with a pass-through that leaves out the features that fill those registries (rules, ids,
// plans and figures; each a stub here), so a seed is the only definition whatever those features later build, puts
// the test's probes right before the jump, and its late probes after every feature.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance, type EnhanceOptions } from '../src/enhance/index.js';
import type { Feature } from '../src/enhance/features.js';
import { CHROME_ATTR, chrome } from '../src/enhance/journal.js';
import { CHORD } from '../src/enhance/keys.js';
import { chromeIdsIssued, contextOf } from '../src/enhance/lifecycle.js';
import type { IndexEntry } from '../src/enhance/registry.js';
import type { FeatureContext } from '../src/enhance/types.js';
import { defaultVocabulary } from '../src/enhance/vocab.js';
import { render } from '../src/render/index.js';

const hooks = vi.hoisted(() => ({ seeds: [] as unknown[], late: [] as unknown[] }));

vi.mock('../src/enhance/features.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/enhance/features.js')>();
  const left = ['rules', 'ids', 'plans', 'figures'];
  const features = (): Feature[] => {
    const list = real.features().filter((f) => !left.includes(f.name));
    const at = list.findIndex((f) => f.name === 'jump');
    return [...list.slice(0, at), ...(hooks.seeds as Feature[]), ...list.slice(at), ...(hooks.late as Feature[])];
  };
  return { ...real, features };
});

/** A plan-like document: an "In short" box with an h3 inside it, numbered sections, a task and a figure. */
const DOC = [
  '# Example plan',
  '',
  'Intro paragraph.',
  '',
  '## In short',
  '',
  '- One point.',
  '',
  '### Inside the box',
  '',
  'Box text.',
  '',
  '## 1. Context',
  '',
  'Paragraph alpha.',
  '',
  '## 2. Design',
  '',
  'Paragraph beta.',
  '',
  '### Task 3: Build the parser',
  '',
  'Paragraph gamma.',
  '',
  '### Notes on design',
  '',
  'Paragraph delta.',
  '',
  '```mermaid',
  'graph TD; A-->B',
  '```',
  '',
  '*Figure 1. Flow of the parts.*',
  '',
  '## 3. Rollout',
  '',
  'Paragraph epsilon.',
  '',
].join('\n');

/** The rows DOC's empty query lists: kind and text. */
const DOC_HEADINGS = [
  'Section|In short',
  'Section|1. Context',
  'Section|2. Design',
  'Section|Task 3: Build the parser',
  'Section|Notes on design',
  'Section|3. Rollout',
];

const mounted: HTMLElement[] = [];

function mount(md = DOC): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(md).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((n) => document.importNode(n, true)));
  document.body.append(root);
  mounted.push(root);
  return root;
}

/** Put hand-written html (not render()'s) into a new root. */
function mountHtml(html: string): HTMLElement {
  const root = document.createElement('main');
  root.innerHTML = html;
  document.body.append(root);
  mounted.push(root);
  return root;
}

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
  hooks.seeds.length = 0;
  hooks.late.length = 0;
  vi.restoreAllMocks();
});

function ctxOf(root: HTMLElement): FeatureContext {
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('no context: the root is not enhanced');
  return ctx;
}

/** A probe that runs right before the jump. */
function seed(build: (ctx: FeatureContext) => void): void {
  hooks.seeds.push({ name: 'seed', build });
}

/** A probe that runs after every feature. */
function late(build: (ctx: FeatureContext) => void): void {
  hooks.late.push({ name: 'late', build });
}

/** The first element of the root whose own text is `text` (white space as one space). */
function byText(root: Element, text: string, sel = 'p, h2, h3, li, figure'): HTMLElement {
  const el = Array.from(root.querySelectorAll(sel)).find((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim() === text);
  if (el === undefined) throw new Error(`no element reads ${JSON.stringify(text)}`);
  return el as HTMLElement;
}

/** The heading with this id (render()'s slug). */
function headingById(root: Element, id: string): HTMLElement {
  const h = Array.from(root.querySelectorAll('h2, h3')).find((e) => e.id === id);
  if (h === undefined) throw new Error(`no heading ${id}`);
  return h as HTMLElement;
}

/** An index entry for `define`. */
function entry(id: string, kind: IndexEntry['kind'], title: string, target: Element, group = ''): IndexEntry {
  return { id, kind, title, status: null, group, target, row: null, heads: [] };
}

const jumpOf = (root: Element): HTMLElement | null => root.querySelector('.jump');
const sheetOf = (root: Element): HTMLElement | null => root.querySelector('.keys');
const btnOf = (root: Element): HTMLButtonElement | null => root.querySelector('.jump-btn');
const inputOf = (root: Element): HTMLInputElement => {
  const i = root.querySelector('.jump input');
  if (i === null) throw new Error('no jump field');
  return i as HTMLInputElement;
};
const listOf = (root: Element): HTMLElement => {
  const l = root.querySelector('.jump ul');
  if (l === null) throw new Error('no jump list');
  return l as HTMLElement;
};
const isOpen = (el: Element | null): boolean => el !== null && el.classList.contains('open');

function key(target: EventTarget, k: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}

/** Open the root's jump through its button. */
function openByButton(root: HTMLElement): void {
  const b = btnOf(root);
  if (b === null) throw new Error('no jump button');
  b.focus();
  b.click();
}

/** Type `q` into the open jump's field. */
function type(root: HTMLElement, q: string): void {
  const input = inputOf(root);
  input.value = q;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** The rows listed now, as "<lvl>|<text>" ("<lvl>|<text>|<kind>" for an ID), or ["none|Nothing matches"]. */
function rows(root: HTMLElement): string[] {
  return Array.from(listOf(root).children).map((li) => {
    if (li.classList.contains('none')) return `none|${li.textContent ?? ''}`;
    const parts = [li.querySelector('.lvl'), li.querySelector('.jt'), li.querySelector('.jk')].filter((p) => p !== null);
    return parts.map((p) => p.textContent ?? '').join('|');
  });
}

const selected = (root: HTMLElement): number => Array.from(listOf(root).children).findIndex((li) => li.classList.contains('sel'));

async function enhanced(md = DOC, options: EnhanceOptions = {}): Promise<HTMLElement> {
  const root = mount(md);
  await enhance(root, options);
  return root;
}

describe('the jump: what it lists', () => {
  it('builds a closed dialog at the root\'s end, a button in the bar\'s tray, and binds "/" and the chord', async () => {
    const root = await enhanced();
    const ctx = ctxOf(root);
    const jump = jumpOf(root);
    expect(jump).not.toBeNull();
    expect(isOpen(jump)).toBe(false);
    // In an unstyled chrome wrapper, the root's last child.
    const layer = jump?.parentElement;
    expect(layer?.parentElement).toBe(root);
    expect(layer?.hasAttribute(CHROME_ATTR)).toBe(true);
    expect(layer?.getAttribute('class')).toBeNull();
    const box = jump?.querySelector(':scope > .box');
    expect(box?.getAttribute('role')).toBe('dialog');
    expect(box?.getAttribute('aria-modal')).toBe('true');
    expect(box?.getAttribute('aria-label')).toBe('Jump to');
    const input = inputOf(root);
    const list = listOf(root);
    expect(input.getAttribute('type')).toBe('search');
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-label')).toBe('Jump to');
    expect(input.getAttribute('placeholder')).toBe('Jump to a section, ID (R14, F3, …) or figure');
    expect(list.getAttribute('role')).toBe('listbox');
    expect(list.getAttribute('aria-label')).toBe('Matches');
    expect(list.id).toMatch(/^docreader\.\d+\.jump-list$/);
    expect(input.getAttribute('aria-controls')).toBe(list.id);
    expect(jump?.querySelector('.jump-hint')?.textContent).toBe('Type to filter · ↑ ↓ to choose · Enter to go · Esc to close');
    const btn = btnOf(root);
    expect(btn?.parentElement).toBe(ctx.slots?.tools);
    expect(btn?.getAttribute('type')).toBe('button');
    expect(btn?.getAttribute('aria-haspopup')).toBe('dialog');
    expect(btn?.getAttribute('title')).toBe('Jump to a section, ID or figure (/)');
    expect(btn?.querySelector('.lbl')?.textContent).toBe('Jump to');
    expect(btn?.querySelector('kbd.kb')?.textContent).toBe('/');
    expect(ctx.keys.bindings().map((b) => `${b.key}|${b.label}`)).toContain('/|Jump to a section, ID or figure');
    expect(ctx.keys.bindings().map((b) => b.key)).not.toContain(CHORD);
    expect(ctx.overlays.isOpen('jump')).toBe(false);
  });

  it('an empty query lists the headings: each h2 and h3 with an id, of the "In short" box only its h2, numbers apart', async () => {
    const root = await enhanced();
    openByButton(root);
    expect(isOpen(jumpOf(root))).toBe(true);
    expect(rows(root)).toEqual(DOC_HEADINGS);
  });

  it('four entries or fewer build no jump: no dialog, no button, no key; a fifth builds it', async () => {
    const four = ['# T', '', '## A', '', 'a', '', '## B', '', 'b', '', '### C', '', 'c', '', '### D', '', 'd', ''].join('\n');
    const root = await enhanced(four);
    expect(jumpOf(root)).toBeNull();
    expect(btnOf(root)).toBeNull();
    expect(ctxOf(root).keys.bindings().map((b) => b.key)).not.toContain('/');
    key(document.body, '/');
    expect(root.querySelector('.jump')).toBeNull();
    // A defined ID is an entry too: four headings and one ID build it.
    seed((ctx) => {
      ctx.index.define(entry('R1', 'rule', 'A rule', byText(ctx.root, 'd')));
    });
    const five = await enhanced(four);
    expect(jumpOf(five)).not.toBeNull();
    expect(btnOf(five)).not.toBeNull();
  });

  it('an h3 task of the plan is a Task, an h2 task a Section; a chrome heading, a heading without an id and an h4 are not listed', async () => {
    seed((ctx) => {
      const task = byText(ctx.root, 'Task 3: Build the parser', 'h3');
      ctx.plan.publish({ tasks: [task, headingById(ctx.root, 'task-9-ship-it')], steps: [], yours: 0, outlineable: false });
      const h = chrome(ctx.root.ownerDocument, 'h2', { text: 'Chrome heading', attrs: { id: 'chrome-heading' } });
      ctx.journal.insert(h, ctx.root, byText(ctx.root, 'Paragraph alpha.'));
    });
    const root = await enhanced(`${DOC}\n#### Fourth level\n\nText.\n\n## Task 9: Ship it\n\nText.\n`);
    openByButton(root);
    expect(rows(root)).toEqual([...DOC_HEADINGS.map((r) => (r.endsWith('Task 3: Build the parser') ? 'Task|Task 3: Build the parser' : r)), 'Section|Task 9: Ship it']);
  });

  it('a host\'s own markup is the document\'s: its "short" box hides nothing, its sec-no is no number; an h3 keeps its number; a blank label is no label', async () => {
    const hand = mountHtml(
      [
        '<h1>T</h1><h2>No id</h2><h2 id="a">A</h2><h3 id="c">C</h3>',
        '<div class="short"><h2 id="s">Host box</h2><h3 id="s3">Host sub</h3></div>',
        '<h2 id="n"><span class="sec-no">9</span> Numbered by hand</h2>',
        '<h3 id="f">5. Fifth notes</h3>',
        '<h2 id="sp" aria-label="   ">Spaced label</h2>',
      ].join(''),
    );
    await enhance(hand);
    openByButton(hand);
    expect(rows(hand)).toEqual([
      'Section|A',
      'Section|C',
      'Section|Host box',
      'Section|Host sub',
      'Section|9 Numbered by hand',
      'Section|5. Fifth notes',
      'Section|Spaced label',
    ]);
  });

  it('a heading reads as written, never its chrome: a badge with counts, a button, the controls', async () => {
    seed((ctx) => {
      const doc = ctx.root.ownerDocument;
      const { journal } = ctx;
      // As the plans name and badge a task heading (Task 11): its label first, then its number moved into a badge
      // that holds counts.
      const task = byText(ctx.root, 'Task 3: Build the parser', 'h3');
      journal.setAttribute(task, 'aria-label', 'Task 3: Build the parser');
      const text = task.firstChild as Text;
      const rest = journal.split(text, 'Task 3'.length);
      journal.split(rest, ': '.length);
      const badge = chrome(doc, 'span', { className: 'task-id' });
      journal.wrap([text], badge);
      journal.insert(chrome(doc, 'span', { className: 'tmeta', text: '4 steps' }), badge, null);
      journal.insert(chrome(doc, 'button', { className: 'task-open', text: 'Show all' }), task, null);
      // A heading with controls (headCtl names it), and one with a chrome mark and no label.
      ctx.headCtl(byText(ctx.root, 'Notes on design', 'h3'), 'fold', chrome(doc, 'button', { text: 'Fold' }));
      journal.insert(chrome(doc, 'span', { text: ' (new)' }), headingById(ctx.root, '3-rollout'), null);
      // An h2 whose first child is a chrome badge that is no section number.
      const plain = headingById(ctx.root, 'plain-part');
      journal.setAttribute(plain, 'aria-label', 'Plain part');
      journal.insert(chrome(doc, 'span', { className: 'task-id', text: '9' }), plain, plain.firstChild);
    });
    const root = await enhanced(`${DOC}\n## Plain part\n\nText.\n`);
    openByButton(root);
    expect(rows(root)).toEqual([...DOC_HEADINGS, 'Section|Plain part']);
  });

  it('IDs list their ID, title and kind (Rule, or the group); figures list "Fig N" and the caption; lettered sections and figure IDs not twice', async () => {
    seed((ctx) => {
      const { root } = ctx;
      ctx.index.define(entry('R1', 'rule', 'First rule', byText(root, 'Paragraph alpha.')));
      ctx.index.define(entry('D2', 'row', 'Second decision', byText(root, 'Paragraph beta.'), 'Decisions'));
      ctx.index.define(entry('S9', 'section', 'A lettered section', byText(root, 'Paragraph gamma.')));
      ctx.index.define(entry('figure-1', 'figure', 'Flow of the parts.', byText(root, 'Paragraph delta.')));
      ctx.figures.add({ no: '1', caption: 'Flow of the parts.', figure: root.querySelector('figure') as HTMLElement });
    });
    const root = await enhanced();
    openByButton(root);
    type(root, 'second');
    expect(rows(root)).toEqual(['D2|Second decision|Decisions']);
    type(root, 'first');
    expect(rows(root)).toEqual(['R1|First rule|Rule']);
    type(root, 'lettered');
    expect(rows(root)).toEqual(['none|Nothing matches']);
    type(root, 'flow');
    expect(rows(root)).toEqual(['Fig 1|Flow of the parts.']);
    const id = listOf(root).querySelector('li .lvl');
    expect(id?.className).toBe('lvl');
    type(root, 'r1');
    expect(listOf(root).querySelector('li .lvl')?.className).toBe('lvl id');
  });

  it('every text is cut to 200 code units: a heading, an ID\'s title and group, a caption', async () => {
    const long = Array.from({ length: 80 }, (_, i) => `word${String(i)}`).join(' ');
    seed((ctx) => {
      const { root } = ctx;
      ctx.index.define(entry('R1', 'row', `Title ${long}`, byText(root, 'Paragraph alpha.'), `Group ${long}`));
      ctx.figures.add({ no: '1', caption: `Caption ${long}`, figure: root.querySelector('figure') as HTMLElement });
    });
    const root = await enhanced(`${DOC}\n### Heading ${long}\n\nText.\n`);
    openByButton(root);
    type(root, 'word1');
    const texts = Array.from(listOf(root).querySelectorAll('.jt, .jk')).map((s) => s.textContent ?? '');
    expect(texts.map((t) => t.split(' ')[0])).toEqual(['Heading', 'Title', 'Group', 'Caption']);
    for (const t of texts) {
      expect(t.length).toBeLessThanOrEqual(200);
      expect(t.endsWith('…')).toBe(true);
    }
  });

  it('at most 80 rows: the first 80 headings for an empty query, the best 80 matches for a query', async () => {
    const many = ['# T', '', ...Array.from({ length: 90 }, (_, i) => [`### Part ${String(i + 1)}`, '', 'Text.', '']).flat()].join('\n');
    const root = await enhanced(many);
    openByButton(root);
    expect(rows(root)).toHaveLength(80);
    expect(rows(root)[79]).toBe('Section|Part 80');
    type(root, 'part');
    expect(rows(root)).toHaveLength(80);
    type(root, 'part 9');
    expect(rows(root)).toEqual(['Section|Part 9', 'Section|Part 90']);
  });
});

describe('the jump: the ranking', () => {
  /** Paragraphs p1 to p9 to hang seeded entries on, between headings. */
  const RANK_DOC = [
    '# Ranking',
    '',
    'p1',
    '',
    'p2',
    '',
    'p3',
    '',
    'p4',
    '',
    '### Redesign plan',
    '',
    'p5',
    '',
    '### Notes on design',
    '',
    'p6',
    '',
    '### Design',
    '',
    'p7',
    '',
    '### F1 overview',
    '',
    'p8',
    '',
    '## F1. Scope',
    '',
    'p9',
    '',
  ].join('\n');

  function seedRanking(): void {
    seed((ctx) => {
      const p = (n: number): HTMLElement => byText(ctx.root, `p${String(n)}`);
      // In document order from the lowest score to the highest, so the order a query lists is the scores', not the
      // document's.
      ctx.figures.add({ no: '1', caption: 'Redesigned flow', figure: p(1) });
      ctx.index.define(entry('XDESIGN-1', 'row', 'Other', p(2), 'Rows'));
      ctx.index.define(entry('R2', 'row', 'Predesigned limits', p(3), 'Rows'));
      ctx.figures.add({ no: '2', caption: 'Flow of the design', figure: p(4) });
      ctx.index.define(entry('D2', 'row', 'Keep the design small', p(5), 'Rows'));
      ctx.index.define(entry('DESIGN-9', 'row', 'A row', p(7), 'Rows'));
      ctx.index.define(entry('F10', 'row', 'Tenth', p(8), 'Rows'));
      ctx.index.define(entry('F1', 'rule', 'First', p(9)));
    });
  }

  it('an exact ID (100), a section number (95), an ID prefix (80), a heading that starts with it (70)', async () => {
    seedRanking();
    const root = await enhanced(RANK_DOC);
    openByButton(root);
    type(root, 'F1');
    expect(rows(root)).toEqual(['F1|First|Rule', 'Section|F1. Scope', 'F10|Tenth|Rows', 'Section|F1 overview']);
  });

  it('then a heading word (60), an ID title word (45), a heading that holds it (40), a figure word (30), an ID title that holds it (25), an ID that holds it (20), a caption that holds it (15)', async () => {
    seedRanking();
    const root = await enhanced(RANK_DOC);
    openByButton(root);
    type(root, '  DESIGN  ');
    expect(rows(root)).toEqual([
      'DESIGN-9|A row|Rows',
      'Section|Design',
      'Section|Notes on design',
      'D2|Keep the design small|Rows',
      'Section|Redesign plan',
      'Fig 2|Flow of the design',
      'R2|Predesigned limits|Rows',
      'XDESIGN-1|Other|Rows',
      'Fig 1|Redesigned flow',
    ]);
  });

  it('equal scores keep document order', async () => {
    const root = await enhanced(['# T', '', '### Beta one', '', 'x', '', '### Alpha one', '', 'x', '', '### Gamma one', '', 'x', '', '### Delta', '', 'x', '', '### Epsilon', '', 'x', ''].join('\n'));
    openByButton(root);
    type(root, 'one');
    expect(rows(root)).toEqual(['Section|Beta one', 'Section|Alpha one', 'Section|Gamma one']);
  });

  it('a word starts in any script: a letter after an apostrophe, not one after a letter; a query that opens on a sign needs a word before it', async () => {
    const root = await enhanced(
      ['# T', '', '### Sociétés', '', 'x', '', '### L\'été indien', '', 'x', '', '### Phase -2 notes', '', 'x', '', '### Step-2 plan', '', 'x', '', '### Other', '', 'x', ''].join('\n'),
    );
    openByButton(root);
    // "l'été": "été" starts a word after an apostrophe (60); "sociétés" holds it after a letter (40). Read with ASCII's
    // \b alone, "é" is no word character, and the two would swap.
    type(root, 'été');
    expect(rows(root)).toEqual(['Section|L\'été indien', 'Section|Sociétés']);
    // "-2" opens on a sign: it starts a word after a letter ("Step-2", 60), not after a space ("Phase -2", 40).
    type(root, '-2');
    expect(rows(root)).toEqual(['Section|Step-2 plan', 'Section|Phase -2 notes']);
  });

  it('the character before a match is read whole: a letter beyond the first plane, and the first character of a text', async () => {
    const root = await enhanced(['# T', '', '### 𝐀ab one', '', 'x', '', '### 😀ab two', '', 'x', '', '### Xab', '', 'x', '', '### The ab test', '', 'x', '', '### E', '', 'x', ''].join('\n'));
    openByButton(root);
    // A mathematical capital (a letter of the second plane) before "ab" joins the word, and so does the "x" that opens
    // "xab"; an emoji does not, nor does a space.
    type(root, 'ab');
    expect(rows(root)).toEqual(['Section|😀ab two', 'Section|The ab test', 'Section|𝐀ab one', 'Section|Xab']);
  });

  it('the query is matched as written: metacharacters are themselves', async () => {
    const root = await enhanced(['# T', '', '### abc', '', 'x', '', '### a.c notes', '', 'x', '', '### (x) and [y]', '', 'x', '', '### D', '', 'x', '', '### E', '', 'x', ''].join('\n'));
    openByButton(root);
    type(root, 'a.c');
    expect(rows(root)).toEqual(['Section|a.c notes']);
    type(root, '.*');
    expect(rows(root)).toEqual(['none|Nothing matches']);
    type(root, '(x');
    expect(rows(root)).toEqual(['Section|(x) and [y]']);
    type(root, '[y');
    expect(rows(root)).toEqual(['Section|(x) and [y]']);
    type(root, '\\');
    expect(rows(root)).toEqual(['none|Nothing matches']);
  });

  it('a hostile query of 100,000 characters stays bounded and matches nothing', async () => {
    const root = await enhanced();
    openByButton(root);
    const t0 = performance.now();
    type(root, '(.*+?^${}()|[]\\'.repeat(7000).slice(0, 100_000));
    type(root, 'design '.repeat(15_000).slice(0, 100_000));
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(rows(root)).toEqual(['none|Nothing matches']);
  });
});

describe('the jump: choosing and going', () => {
  it('the arrow keys move the selection, clamped at both ends, with aria-selected and aria-activedescendant', async () => {
    const root = await enhanced();
    openByButton(root);
    const input = inputOf(root);
    const lis = (): HTMLElement[] => Array.from(listOf(root).children) as HTMLElement[];
    const check = (i: number): void => {
      expect(selected(root)).toBe(i);
      expect(lis().map((li) => li.getAttribute('aria-selected'))).toEqual(lis().map((_, k) => String(k === i)));
      expect(lis().every((li) => li.getAttribute('role') === 'option')).toBe(true);
      expect(input.getAttribute('aria-activedescendant')).toBe(lis()[i]?.id);
    };
    check(0);
    expect(key(input, 'ArrowUp').defaultPrevented).toBe(true);
    check(0);
    expect(key(input, 'ArrowDown').defaultPrevented).toBe(true);
    check(1);
    for (let i = 0; i < 10; i += 1) key(input, 'ArrowDown');
    check(DOC_HEADINGS.length - 1);
    key(input, 'ArrowUp');
    check(DOC_HEADINGS.length - 2);
    // Typing ranks again from the first row.
    type(root, 'o');
    check(0);
  });

  it('with nothing listed there is no active descendant, and Enter does nothing', async () => {
    const onHash = vi.fn();
    const root = await enhanced(DOC, { onHash });
    openByButton(root);
    type(root, 'zzz');
    const input = inputOf(root);
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    key(input, 'ArrowDown');
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    expect(key(input, 'Enter').defaultPrevented).toBe(false);
    expect(isOpen(jumpOf(root))).toBe(true);
    expect(onHash).not.toHaveBeenCalled();
  });

  it('each row place has a chrome id of its own, made once: typing never issues more', async () => {
    const root = await enhanced();
    openByButton(root);
    const ids = Array.from(listOf(root).children).map((li) => li.id);
    expect(new Set(ids).size).toBe(DOC_HEADINGS.length);
    for (const id of ids) expect(id).toMatch(/^docreader\.\d+\.jump-option(?:\.\d+)?$/);
    const issued = chromeIdsIssued(document);
    for (const q of ['d', 'de', 'des', 'o', '', 'n', '']) type(root, q);
    expect(chromeIdsIssued(document)).toBe(issued);
    expect(Array.from(listOf(root).children).map((li) => li.id)).toEqual(ids);
  });

  it('Enter goes to the selected entry: the dialog closes, the target has the focus, and the host hears of it', async () => {
    const onHash = vi.fn();
    const root = await enhanced(DOC, { onHash });
    openByButton(root);
    const input = inputOf(root);
    key(input, 'ArrowDown');
    key(input, 'ArrowDown');
    expect(key(input, 'Enter').defaultPrevented).toBe(true);
    const h = headingById(root, '2-design');
    expect(isOpen(jumpOf(root))).toBe(false);
    expect(document.activeElement).toBe(h);
    expect(onHash).toHaveBeenCalledWith(h.id, { push: true, from: null });
  });

  it('a click on a row goes there; on "Nothing matches" nothing happens', async () => {
    const onHash = vi.fn();
    seed((ctx) => {
      ctx.index.define(entry('R1', 'rule', 'First rule', byText(ctx.root, 'Paragraph alpha.')));
    });
    const root = await enhanced(DOC, { onHash });
    openByButton(root);
    type(root, 'first');
    (listOf(root).querySelector('li .jt') as HTMLElement).click();
    expect(isOpen(jumpOf(root))).toBe(false);
    expect(document.activeElement).toBe(byText(root, 'Paragraph alpha.'));
    expect(onHash).toHaveBeenCalledWith('R1', { push: true, from: null });
    openByButton(root);
    type(root, 'zzz');
    (listOf(root).querySelector('li.none') as HTMLElement).click();
    expect(isOpen(jumpOf(root))).toBe(true);
    expect(onHash).toHaveBeenCalledTimes(1);
  });

  it('Tab stays in the field', async () => {
    const root = await enhanced();
    openByButton(root);
    expect(key(inputOf(root), 'Tab').defaultPrevented).toBe(true);
    expect(key(inputOf(root), 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(key(inputOf(root), 'a').defaultPrevented).toBe(false);
  });

  it('opening clears the field, lists the headings and focuses the field; opening again while open does nothing', async () => {
    const root = await enhanced();
    openByButton(root);
    type(root, 'design');
    key(inputOf(root), 'ArrowDown');
    key(inputOf(root), 'Escape');
    expect(isOpen(jumpOf(root))).toBe(false);
    openByButton(root);
    expect(inputOf(root).value).toBe('');
    expect(rows(root)).toEqual(DOC_HEADINGS);
    expect(selected(root)).toBe(0);
    expect(document.activeElement).toBe(inputOf(root));
    type(root, 'design');
    btnOf(root)?.click();
    expect(inputOf(root).value).toBe('design');
  });

  it('Escape and a click outside the box close it and give the focus back; a click inside the box does not', async () => {
    const root = await enhanced();
    const btn = btnOf(root) as HTMLButtonElement;
    openByButton(root);
    expect(document.activeElement).toBe(inputOf(root));
    expect(ctxOf(root).overlays.top()).toBe('jump');
    expect(ctxOf(root).overlays.any()).toBe(true);
    key(inputOf(root), 'Escape');
    expect(isOpen(jumpOf(root))).toBe(false);
    expect(document.activeElement).toBe(btn);
    openByButton(root);
    (root.querySelector('.jump-hint') as HTMLElement).click();
    (root.querySelector('.jump .box') as HTMLElement).click();
    expect(isOpen(jumpOf(root))).toBe(true);
    jumpOf(root)?.click();
    expect(isOpen(jumpOf(root))).toBe(false);
    expect(document.activeElement).toBe(btn);
  });

  it('opened with nothing focused, closing takes the focus out of the hidden dialog', async () => {
    const root = await enhanced();
    expect(document.activeElement).toBe(document.body);
    key(document.body, '/');
    expect(document.activeElement).toBe(inputOf(root));
    key(inputOf(root), 'Escape');
    expect(document.activeElement).toBe(document.body);
    key(document.body, '/');
    jumpOf(root)?.click();
    expect(document.activeElement).toBe(document.body);
  });

  it('opening closes the preview card; going closes the contents drawer, and closing does not', async () => {
    const card = { open: true, close: vi.fn(() => (card.open = false)) };
    const drawer = { open: false, close: vi.fn(() => (drawer.open = false)) };
    seed((ctx) => {
      ctx.overlays.register('card', { isOpen: () => card.open, close: card.close });
      ctx.overlays.register('drawer', { isOpen: () => drawer.open, close: drawer.close });
    });
    const root = await enhanced();
    openByButton(root);
    expect(card.close).toHaveBeenCalledTimes(1);
    drawer.open = true;
    jumpOf(root)?.click();
    expect(drawer.close).not.toHaveBeenCalled();
    openByButton(root);
    key(inputOf(root), 'Enter');
    expect(drawer.close).toHaveBeenCalledTimes(1);
    expect(drawer.open).toBe(false);
  });
});

describe('the jump: keys and options', () => {
  it('"/" opens it; Ctrl or Cmd with K opens it from a field too, where "/" types', async () => {
    const root = await enhanced();
    key(document.body, '/');
    expect(isOpen(jumpOf(root))).toBe(true);
    key(inputOf(root), 'Escape');
    const field = document.createElement('input');
    root.append(field);
    field.focus();
    expect(key(field, '/').defaultPrevented).toBe(false);
    expect(isOpen(jumpOf(root))).toBe(false);
    expect(key(field, 'k', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(isOpen(jumpOf(root))).toBe(true);
    key(inputOf(root), 'Escape');
    expect(document.activeElement).toBe(field);
    expect(key(field, 'K', { metaKey: true }).defaultPrevented).toBe(true);
    expect(isOpen(jumpOf(root))).toBe(true);
  });

  it('keyboard: false: no key opens it, and the button shows no key; the button still opens it', async () => {
    const root = await enhanced(DOC, { keyboard: false });
    key(document.body, '/');
    key(document.body, 'k', { ctrlKey: true });
    expect(isOpen(jumpOf(root))).toBe(false);
    const btn = btnOf(root) as HTMLButtonElement;
    expect(btn.querySelector('kbd')).toBeNull();
    expect(btn.getAttribute('title')).toBe('Jump to a section, ID or figure');
    expect(btn.querySelector('.lbl')?.textContent).toBe('Jump to');
    openByButton(root);
    expect(isOpen(jumpOf(root))).toBe(true);
  });

  it('chrome.bar false: no button; "/" still opens it', async () => {
    const root = await enhanced(DOC, { chrome: { bar: false } });
    expect(btnOf(root)).toBeNull();
    key(document.body, '/');
    expect(isOpen(jumpOf(root))).toBe(true);
  });

  it('RF2: with two roots, "/" opens the focused root\'s jump, and Escape closes only its own', async () => {
    const a = await enhanced();
    const b = await enhanced();
    const ia = inputOf(a);
    const ib = inputOf(b);
    expect(listOf(a).id).not.toBe(listOf(b).id);
    // Neither opens for a key on the page itself: there are two roots.
    key(document.body, '/');
    expect([isOpen(jumpOf(a)), isOpen(jumpOf(b))]).toEqual([false, false]);
    (btnOf(a) as HTMLButtonElement).focus();
    key(btnOf(a) as HTMLButtonElement, '/');
    expect([isOpen(jumpOf(a)), isOpen(jumpOf(b))]).toEqual([true, false]);
    openByButton(b);
    expect([isOpen(jumpOf(a)), isOpen(jumpOf(b))]).toEqual([true, true]);
    expect(new Set([...Array.from(listOf(a).children), ...Array.from(listOf(b).children)].map((li) => li.id)).size).toBe(2 * DOC_HEADINGS.length);
    key(ia, 'Escape');
    expect([isOpen(jumpOf(a)), isOpen(jumpOf(b))]).toEqual([false, true]);
    key(ib, 'Escape');
    expect([isOpen(jumpOf(a)), isOpen(jumpOf(b))]).toEqual([false, false]);
  });

  it('destroy removes the dialog, the button and the keys, and gives back the document as it was', async () => {
    const root = mount();
    const before = root.innerHTML;
    await enhance(root);
    openByButton(root);
    type(root, 'design');
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(before);
    key(document.body, '/');
    key(document.body, '?');
    expect(root.querySelector('[data-docreader-chrome]')).toBeNull();
  });
});

describe('the keys sheet', () => {
  /** The sheet's rows: each dt's keys, then its dd. */
  const sheetRows = (root: Element): string[] => {
    const dl = root.querySelector('.keys dl');
    const out: string[] = [];
    for (const dt of Array.from(dl?.querySelectorAll('dt') ?? [])) {
      const keys = Array.from(dt.querySelectorAll('kbd')).map((k) => k.textContent ?? '');
      out.push(`${keys.join(' ')}|${dt.nextElementSibling?.textContent ?? ''}`);
    }
    return out;
  };

  it('is a closed dialog at the root\'s end, labelled by its heading, with the colour key', async () => {
    const root = await enhanced();
    const sheet = sheetOf(root);
    expect(sheet).not.toBeNull();
    expect(isOpen(sheet)).toBe(false);
    const layer = sheet?.parentElement;
    expect(layer?.parentElement).toBe(root);
    expect(layer?.hasAttribute(CHROME_ATTR)).toBe(true);
    expect(layer?.getAttribute('class')).toBeNull();
    const box = sheet?.querySelector(':scope > .box');
    expect(box?.getAttribute('role')).toBe('dialog');
    expect(box?.getAttribute('aria-modal')).toBe('true');
    const h = box?.querySelector(':scope > .kh > h2');
    expect(h?.textContent).toBe('Keyboard');
    expect(h?.id).toMatch(/^docreader\.\d+\.keys-heading$/);
    expect(box?.getAttribute('aria-labelledby')).toBe(h?.id);
    const close = box?.querySelector(':scope > .kh > button.linkish');
    expect(close?.textContent).toBe('Close');
    expect(close?.getAttribute('type')).toBe('button');
    expect(Array.from(box?.children ?? []).map((c) => c.localName + (c.className === '' ? '' : `.${c.className}`))).toEqual(['div.kh', 'dl', 'h2.kh2', 'ul.ckey']);
    expect(box?.querySelector('.kh2')?.textContent).toBe('Colour key');
    const ckey = Array.from(box?.querySelectorAll('.ckey li') ?? []).map((li) => `${li.querySelector('.sw')?.className ?? ''}|${li.textContent ?? ''}`);
    expect(ckey).toEqual(defaultVocabulary().colourKey.map((e) => `sw k-${e.role}|${e.label}`));
    expect(ckey).toContain('sw k-id|IDs: R14, F3, …');
    expect(ctxOf(root).keys.bindings().map((b) => `${b.key}|${b.label}`)).toContain('?|This sheet');
  });

  it('"?" opens it, listing the keys that apply now in the sheet\'s order, then Esc; the focus goes to Close', async () => {
    const root = await enhanced();
    key(document.body, '?');
    expect(isOpen(sheetOf(root))).toBe(true);
    expect(sheetRows(root)).toEqual(['/|Jump to a section, ID or figure', '?|This sheet', 'Esc|Close']);
    expect(document.activeElement).toBe(root.querySelector('.keys .kh button'));
    expect(ctxOf(root).overlays.top()).toBe('keys');
  });

  it('a key bound by a later feature is listed, in the sheet\'s order; one that does not apply now, or is unlisted, is not', async () => {
    let applies = false;
    late((ctx) => {
      ctx.keys.bind({ key: 'j', label: 'Next / previous section', run: () => undefined });
      ctx.keys.bind({ key: 'x', label: 'A key of a later feature', run: () => undefined });
      ctx.keys.bind({ key: 'k', label: 'Next / previous section', run: () => undefined });
      ctx.keys.bind({ key: 'o', label: 'Outline: step titles only', when: () => applies, run: () => undefined });
      ctx.keys.bind({ key: 'z', label: 'Unlisted', listed: false, run: () => undefined });
    });
    const root = await enhanced();
    key(document.body, '?');
    expect(sheetRows(root)).toEqual(['/|Jump to a section, ID or figure', 'j k|Next / previous section', '?|This sheet', 'x|A key of a later feature', 'Esc|Close']);
    // Read again at each opening: a key that applies now shows.
    key(document.body, 'Escape');
    applies = true;
    key(document.body, '?');
    expect(sheetRows(root)).toEqual([
      '/|Jump to a section, ID or figure',
      'j k|Next / previous section',
      'o|Outline: step titles only',
      '?|This sheet',
      'x|A key of a later feature',
      'Esc|Close',
    ]);
    const dt = root.querySelectorAll('.keys dt')[1];
    expect(Array.from(dt?.childNodes ?? []).map((n) => n.nodeName)).toEqual(['KBD', '#text', 'KBD']);
    expect(dt?.textContent).toBe('j k');
  });

  it('only keys next to each other share a row', async () => {
    late((ctx) => {
      ctx.keys.bind({ key: 'a', label: 'Same', run: () => undefined });
      ctx.keys.bind({ key: 'b', label: 'Between', run: () => undefined });
      ctx.keys.bind({ key: 'c', label: 'Same', run: () => undefined });
    });
    const root = await enhanced();
    key(document.body, '?');
    expect(sheetRows(root)).toEqual(['/|Jump to a section, ID or figure', '?|This sheet', 'a|Same', 'b|Between', 'c|Same', 'Esc|Close']);
  });

  it('Close, a click outside the box and Escape close it and give the focus back; a click inside does not', async () => {
    const root = await enhanced();
    const btn = btnOf(root) as HTMLButtonElement;
    btn.focus();
    key(btn, '?');
    (root.querySelector('.keys .kh button') as HTMLButtonElement).click();
    expect(isOpen(sheetOf(root))).toBe(false);
    expect(document.activeElement).toBe(btn);
    key(btn, '?');
    (root.querySelector('.keys dl') as HTMLElement).click();
    (root.querySelector('.keys .box') as HTMLElement).click();
    expect(isOpen(sheetOf(root))).toBe(true);
    sheetOf(root)?.click();
    expect(isOpen(sheetOf(root))).toBe(false);
    expect(document.activeElement).toBe(btn);
    key(btn, '?');
    key(root.querySelector('.keys .kh button') as HTMLButtonElement, 'Escape');
    expect(isOpen(sheetOf(root))).toBe(false);
    expect(document.activeElement).toBe(btn);
  });

  it('Tab and Shift+Tab stay on its one control; other keys pass', async () => {
    const root = await enhanced();
    key(document.body, '?');
    const close = root.querySelector('.keys .kh button') as HTMLButtonElement;
    expect(key(close, 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
    expect(key(close, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
    expect(key(close, 'a').defaultPrevented).toBe(false);
    // With the focus off the box's ends (the page's), Tab is the browser's.
    close.blur();
    const dl = root.querySelector('.keys dl') as HTMLElement;
    expect(key(dl, 'Tab').defaultPrevented).toBe(false);
    expect(key(dl, 'Tab', { shiftKey: true }).defaultPrevented).toBe(false);
  });

  it('opened with nothing focused, closing takes the focus out of the hidden sheet', async () => {
    const root = await enhanced();
    key(document.body, '?');
    const close = root.querySelector('.keys .kh button') as HTMLButtonElement;
    expect(document.activeElement).toBe(close);
    close.click();
    expect(document.activeElement).toBe(document.body);
    key(document.body, '?');
    key(close, 'Escape');
    expect(document.activeElement).toBe(document.body);
  });

  it('"?" in the jump\'s field types, and no key opens it over a dialog', async () => {
    const root = await enhanced();
    key(document.body, '?');
    const close = root.querySelector('.keys .kh button') as HTMLButtonElement;
    const other = document.createElement('button');
    root.append(other);
    other.focus();
    // The keyboard layer ignores keys while a dialog is open.
    key(other, '?');
    expect(document.activeElement).toBe(other);
    key(close, 'Escape');
    openByButton(root);
    expect(key(inputOf(root), '?').defaultPrevented).toBe(false);
    expect(isOpen(sheetOf(root))).toBe(false);
  });

  it('keyboard: false builds no sheet', async () => {
    const root = await enhanced(DOC, { keyboard: false });
    expect(sheetOf(root)).toBeNull();
    expect(ctxOf(root).keys.bindings().map((b) => b.key)).not.toContain('?');
  });

  it('a document with no jump still has its sheet, without "/"', async () => {
    const root = await enhanced(['# T', '', '## A', '', 'a', ''].join('\n'));
    key(document.body, '?');
    expect(sheetRows(root)).toEqual(['?|This sheet', 'Esc|Close']);
  });

  it('RF2: "?" opens the focused root\'s sheet; Escape closes only its own', async () => {
    const a = await enhanced();
    const b = await enhanced();
    expect(a.querySelector('.keys h2')?.id).not.toBe(b.querySelector('.keys h2')?.id);
    (btnOf(b) as HTMLButtonElement).focus();
    key(btnOf(b) as HTMLButtonElement, '?');
    expect([isOpen(sheetOf(a)), isOpen(sheetOf(b))]).toEqual([false, true]);
    (btnOf(a) as HTMLButtonElement).focus();
    key(btnOf(a) as HTMLButtonElement, '?');
    expect([isOpen(sheetOf(a)), isOpen(sheetOf(b))]).toEqual([true, true]);
    key(a.querySelector('.keys .kh button') as HTMLButtonElement, 'Escape');
    expect([isOpen(sheetOf(a)), isOpen(sheetOf(b))]).toEqual([false, true]);
  });
});
