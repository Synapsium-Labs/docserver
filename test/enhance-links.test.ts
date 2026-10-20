// @vitest-environment jsdom
// Cross-references and the glossary (docserver L2, Task 13): the first mention of a defined ID in each block links to
// it (xrefs.ts, the reference layout's section 12), and the first mention of each glossary term in each section is a
// quiet link to its definition (glossary.ts, section 12b); the walk both share (mentions.ts).
//
// Task 9 (ID rows and rules, which fill ctx.index) is built beside this one, so these tests seed the index with
// fixtures: a probe feature that runs right before xrefs defines a row entry for each table row whose first cell is an
// ID, as ID rows will. Terms come from the glossary's own tables, or from a probe that defines them before the glossary
// builds.
//
// The feature list and the vocabulary are mocked with pass-throughs: features() is the real list with a test's probes
// put before xrefs, between xrefs and the glossary, and right after the glossary; createVocab() compiles a test's word
// lists when one is set, else the real defaults, and can count the ID scans and record what the qualifier reads.
import v8 from 'node:v8';
import vm from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';
import type { Feature } from '../src/enhance/features.js';
import { termMatcher } from '../src/enhance/glossary.js';
import { CHROME_ATTR, chrome } from '../src/enhance/journal.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import type { FeatureContext } from '../src/enhance/types.js';
import { defaultVocabulary, type VocabularyWords } from '../src/enhance/vocab.js';
import { render } from '../src/render/index.js';
import { LARGE_PLAN_COUNTS, largePlan } from './fixtures/large-plan.js';

const hooks = vi.hoisted(() => ({
  /** Probes run right before xrefs. */
  seeds: [] as unknown[],
  /** Probes run between xrefs and the glossary. */
  between: [] as unknown[],
  /** Probes run right after the glossary. */
  after: [] as unknown[],
  /** A test's word lists, or null for the defaults. */
  words: null as unknown,
  /** When set: how many ID scans the vocabulary handed out, and the length of each text the qualifier read. */
  spy: null as { scans: number; qualifier: number[] } | null,
}));

vi.mock('../src/enhance/features.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/enhance/features.js')>();
  const features = (): Feature[] => {
    const list = [...real.features()];
    const x = list.findIndex((f) => f.name === 'xrefs');
    const g = list.findIndex((f) => f.name === 'glossary');
    return [
      ...list.slice(0, x),
      ...(hooks.seeds as Feature[]),
      ...list.slice(x, g),
      ...(hooks.between as Feature[]),
      ...list.slice(g, g + 1),
      ...(hooks.after as Feature[]),
      ...list.slice(g + 1),
    ];
  };
  return { ...real, features };
});

vi.mock('../src/enhance/vocab.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/enhance/vocab.js')>();
  const createVocab = (options: Parameters<typeof real.createVocab>[0]): ReturnType<typeof real.createVocab> => {
    const v = hooks.words === null ? real.createVocab(options) : real.compileVocab(hooks.words as VocabularyWords);
    if (hooks.spy === null) return v;
    const spy: { scans: number; qualifier: number[] } = hooks.spy;
    class Recorded extends RegExp {
      override test(s: string): boolean {
        spy.qualifier.push(s.length);
        return super.test(s);
      }
    }
    return Object.freeze({
      ...v,
      idScan: () => {
        spy.scans += 1;
        return v.idScan();
      },
      qualifier: new Recorded(v.qualifier.source, v.qualifier.flags),
    });
  };
  return { ...real, createVocab };
});

const mounted: HTMLElement[] = [];

/** Render `md` into a new root in the document. */
function mount(md: string): HTMLElement {
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

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
  hooks.seeds.length = 0;
  hooks.between.length = 0;
  hooks.after.length = 0;
  hooks.words = null;
  hooks.spy = null;
  vi.restoreAllMocks();
});

function ctxOf(root: HTMLElement): FeatureContext {
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('no context: the root is not enhanced');
  return ctx;
}

const squash = (s: string | null): string => (s ?? '').replace(/\s+/g, ' ').trim();

/** A probe run right before xrefs. */
function seed(fn: (ctx: FeatureContext) => void): void {
  hooks.seeds.push({ name: 'seed', build: fn } satisfies Feature);
}

/**
 * The index as ID rows will fill it (Task 9), for these tests: each table row whose first cell is exactly an ID (the
 * vocabulary's grammar) defines that ID, its target the row; the first definition wins.
 */
function seedIdRows(): void {
  seed((ctx) => {
    for (const b of ctx.blocks) {
      if (b.kind !== 'table') continue;
      for (const row of b.rows) {
        const first = squash(row.cells[0]?.textContent ?? '');
        const m = ctx.vocab.id.exec(first);
        if (m === null || m[1] !== first) continue;
        ctx.index.define({ id: first, kind: 'row', title: squash(row.cells[1]?.textContent ?? ''), status: null, group: '', target: row, row, heads: b.heads });
      }
    }
  });
}

/** The first element in `root` matching a static selector. */
function find(root: Element, selector: string): HTMLElement {
  const el = root.querySelector(selector);
  if (el === null) throw new Error(`nothing matches ${selector}`);
  return el as HTMLElement;
}

/** The paragraph (or other element) of `root` whose text starts with `start`. */
function para(root: Element, start: string, tag = 'p'): HTMLElement {
  const el = Array.from(root.querySelectorAll(tag)).find((p) => squash(p.textContent).startsWith(start));
  if (el === undefined) throw new Error(`no ${tag} starting ${JSON.stringify(start)}`);
  return el as HTMLElement;
}

/** The nearest block around `el` that a mention is counted in. */
const boxOf = (el: Element): Element | null => el.parentElement?.closest('p, li, td, dd, blockquote') ?? null;

/** Every link of a class, as `<box tag>:<text>` in document order. */
function linked(root: Element, cls: 'xref' | 'term'): string[] {
  return Array.from(root.querySelectorAll(`a.${cls}`)).map((a) => `${boxOf(a)?.localName ?? 'none'}:${a.textContent ?? ''}`);
}

/** Click `el`; whether the default was prevented once the root's handlers ran (the browser's default is then stopped). */
function click(el: Element, init: MouseEventInit = {}): { prevented: boolean } {
  let prevented = false;
  const after = (e: Event): void => {
    prevented = e.defaultPrevented;
    e.preventDefault(); // jsdom would follow the link
  };
  document.addEventListener('click', after);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }));
  document.removeEventListener('click', after);
  return { prevented };
}

// ── Cross-references ─────────────────────────────────────────────────────────────────────────────────────────────

const XREF_DOC = [
  '# Cross-references',
  '',
  '**Spec** · 2026-10-20 · Status: Draft',
  '',
  '## 1. Decisions',
  '',
  '| ID | What | Status |',
  '|---|---|---|',
  '| R1 | Keep the fold, beside R2 and R2 again | Agreed |',
  '| R2 | Mark what was read; see R1 | Pending |',
  '| R3 | Show the read marks | Deferred |',
  '',
  'R1 is named twice in this paragraph: R1. So is R2, here: R2.',
  '',
  'R1 links again in a new paragraph, and R9 is not defined.',
  '',
  '- R3 in a list item, and R3 again.',
  '- R3 in the next item.',
  '',
  '> R2 in a quote.',
  '',
].join('\n');

describe('xrefs: the first mention of a defined ID in each block (the reference layout, section 12)', () => {
  it('links the first mention of each defined ID per block: a paragraph, a list item, a cell, a quote', async () => {
    const root = mount(XREF_DOC);
    seedIdRows();
    await enhance(root);
    expect(linked(root, 'xref')).toEqual(['td:R2', 'td:R1', 'p:R1', 'p:R2', 'p:R1', 'li:R3', 'li:R3', 'p:R2']);
    // R9 is not defined; the second mention in a block is left as text
    expect(squash(para(root, 'R1 links again').textContent)).toBe('R1 links again in a new paragraph, and R9 is not defined.');
    expect(para(root, 'R1 is named twice').querySelectorAll('a.xref')).toHaveLength(2);
  });

  it('a link is chrome around the source text: a.xref, href #<ID>, data-ref, aria-haspopup="dialog", aria-expanded="false"', async () => {
    const root = mount(XREF_DOC);
    const p = para(root, 'R1 is named twice');
    const firstText = p.firstChild;
    seedIdRows();
    await enhance(root);
    const a = find(p, 'a.xref');
    expect(a.parentElement).toBe(p);
    expect(a.firstChild).toBe(firstText); // the source text node itself, split at the ID, moved into the link
    expect([a.className, a.getAttribute('href'), a.getAttribute('data-ref'), a.getAttribute('aria-haspopup'), a.getAttribute('aria-expanded')]).toEqual([
      'xref',
      '#R1',
      'R1',
      'dialog',
      'false',
    ]);
    expect(a.hasAttribute(CHROME_ATTR)).toBe(true);
    expect(a.childNodes).toHaveLength(1);
    expect(a.textContent).toBe('R1');
    expect(squash(p.textContent)).toBe('R1 is named twice in this paragraph: R1. So is R2, here: R2.');
  });

  it('a mention inside its own target is not linked; a mention of another ID there is', async () => {
    const root = mount(XREF_DOC);
    seedIdRows();
    await enhance(root);
    const [r1, r2] = Array.from(root.querySelectorAll('tbody tr')) as HTMLTableRowElement[];
    expect(Array.from(r1?.querySelectorAll('a.xref') ?? []).map((a) => a.textContent)).toEqual(['R2']);
    expect(Array.from(r2?.querySelectorAll('a.xref') ?? []).map((a) => a.textContent)).toEqual(['R1']);
    expect(r1?.cells[0]?.querySelector('a')).toBeNull();
  });

  it('skips the document\'s own markup: code, kbd, links, headings, table heads, figures and code blocks, even inside a block', async () => {
    const root = mount(
      [
        '# Skips',
        '',
        '## 1. Table',
        '',
        '| ID | What |',
        '|---|---|',
        '| R2 | The one defined ID |',
        '',
        '## 2. Markup',
        '',
        'Inline `R2` code, <kbd>R2</kbd>, a [link to R2](#1-table), then R2 itself.',
        '',
        '- An item.',
        '',
        '  ```mermaid',
        '  graph TD; A-->B',
        '  ```',
        '',
        '  *Figure 1. A figure naming R2.*',
        '',
        '- Another item.',
        '',
        '  | Head R2 | Other |',
        '  |---|---|',
        '  | cell | x |',
        '',
        '- A third item.',
        '',
        '  ```text',
        '  R2 in a block',
        '  ```',
        '',
        '> ## A quoted heading, R2',
        '>',
        '> Quoted text.',
        '',
      ].join('\n'),
    );
    seedIdRows();
    await enhance(root);
    expect(linked(root, 'xref')).toEqual(['p:R2']);
    expect(find(root, 'a.xref').previousSibling?.textContent).toBe(', then ');
  });

  it('a heading of any level inside a list item is skipped; a front-matter strip still shown is read', async () => {
    const root = mount(
      [
        '---',
        'rules: [R2]',
        '---',
        '',
        '# Levels',
        '',
        '| ID | What |',
        '|---|---|',
        '| R2 | Defined |',
        '',
        '- # One R2',
        '- ## Two R2',
        '- ### Three R2',
        '- #### Four R2',
        '- ##### Five R2',
        '- ###### Six R2',
        '- Then R2 itself.',
        '',
      ].join('\n'),
    );
    seedIdRows();
    await enhance(root); // no info: render()'s front-matter strip stays shown
    expect(find(root, 'dl.doc-meta').hasAttribute('hidden')).toBe(false);
    expect(linked(root, 'xref')).toEqual(['dd:R2', 'li:R2']);
  });

  it('in hand-written html: text straight in a quote is in a block, and a pre without code is skipped', async () => {
    const root = mountHtml(
      [
        '<h1>Hand-written</h1>',
        '<div class="table-wrapper"><table><thead><tr><th>ID</th><th>What</th></tr></thead><tbody><tr><td>R2</td><td>Defined</td></tr></tbody></table></div>',
        '<blockquote>R2 straight in a quote.</blockquote>',
        '<ul><li>An item with <pre>R2 in a pre</pre> and then R2.</li></ul>',
      ].join(''),
    );
    seedIdRows();
    await enhance(root);
    expect(linked(root, 'xref')).toEqual(['blockquote:R2', 'li:R2']);
    expect(find(root, 'pre').querySelector('a')).toBeNull();
  });

  it('what a fold hides until found is still read; what the layout hid is not', async () => {
    const root = mount(['# Folded', '', '| ID | What |', '|---|---|', '| R2 | Defined |', '', 'Folded away, R2.', '', 'Hidden away, R2.', '', 'Shown, R2.', ''].join('\n'));
    seedIdRows();
    seed((ctx) => {
      ctx.journal.setAttribute(para(ctx.root, 'Folded away'), 'hidden', 'until-found');
      ctx.journal.setAttribute(para(ctx.root, 'Hidden away'), 'hidden', '');
    });
    await enhance(root);
    expect(Array.from(root.querySelectorAll('a.xref')).map((a) => squash(a.parentElement?.textContent ?? ''))).toEqual(['Folded away, R2.', 'Shown, R2.']);
  });

  it('text outside a block is not linked: a summary, a figure\'s caption, a table head, the eyebrow', async () => {
    const root = mount(
      [
        '---',
        'type: R2',
        '---',
        '',
        '# Outside',
        '',
        '## 1. Table',
        '',
        '| ID | What |',
        '|---|---|',
        '| R2 | The one defined ID |',
        '',
        '| Head R2 | Other |',
        '|---|---|',
        '| a | b |',
        '',
        '```mermaid',
        'graph TD; A-->B',
        '```',
        '',
        '*Figure 1. A figure naming R2.*',
        '',
        '<details>',
        '<summary>Summary R2</summary>',
        '',
        'Inside, R2.',
        '',
        '</details>',
        '',
      ].join('\n'),
    );
    seedIdRows();
    await enhance(root, { info: { frontList: [{ key: 'type', list: false, vals: ['R2'] }] } });
    expect(find(root, '.eyebrow').textContent).toBe('R2');
    expect(linked(root, 'xref')).toEqual(['p:R2']);
    expect(squash(para(root, 'Inside').textContent)).toBe('Inside, R2.');
  });

  it('the eyebrow holds no mention when the title, and so the eyebrow, sits in a block (a quote or a list item)', async () => {
    for (const lead of ['> ', '- ']) {
      const root = mount(
        [
          `${lead}# Quoted title`,
          '',
          '## 1. Table',
          '',
          '| ID | What |',
          '|---|---|',
          '| R2 | The one defined ID |',
          '',
          '## Glossary',
          '',
          '| Term | Meaning |',
          '|---|---|',
          '| Lantern | A light |',
          '',
          '## 2. Text',
          '',
          'Then R2 and a lantern.',
          '',
        ].join('\n'),
      );
      seedIdRows();
      await enhance(root, { info: { frontList: [{ key: 'type', list: false, vals: ['R2'] }, { key: 'area', list: false, vals: ['Lantern'] }] } });
      const eyebrow = find(root, '.eyebrow');
      expect(eyebrow.parentElement?.localName, lead).toBe(lead === '> ' ? 'blockquote' : 'li');
      expect(squash(eyebrow.textContent), lead).toBe('R2Lantern');
      expect(eyebrow.querySelector('a'), lead).toBeNull();
      expect(linked(root, 'xref'), lead).toEqual(['p:R2']);
      expect(linked(root, 'term'), lead).toEqual(['p:lantern']);
      await destroyEnhancement(root);
      hooks.seeds.length = 0;
    }
  });

  it('the Where things stand index holds no mention, even in a quote: all its words are links', async () => {
    const root = mount(
      [
        '# Standing',
        '',
        '| ID | What |',
        '|---|---|',
        '| R2 | The one defined ID |',
        '',
        '## Glossary',
        '',
        '| Term | Meaning |',
        '|---|---|',
        '| Lantern | A light |',
        '',
        '> ## Where things stand',
        '>',
        '> ### Agreed on R2 and the lantern',
        '>',
        '> - A lantern, agreed.',
        '>',
        '> ### Waiting on R2',
        '>',
        '> - R2, waiting.',
        '',
      ].join('\n'),
    );
    seedIdRows();
    await enhance(root);
    const index = find(root, '.stand-index');
    expect(index.parentElement?.localName).toBe('blockquote');
    expect(squash(index.textContent)).toBe('1Agreed on R2 and the lantern1Waiting on R2');
    expect(index.querySelectorAll('a.xref, a.term')).toHaveLength(0);
    expect(linked(root, 'xref')).toEqual(['li:R2']);
    expect(linked(root, 'term')).toEqual(['li:lantern']);
  });

  it('skips the layout\'s own parts: the byline, the hidden meta line and front-matter strip, the facts panel, a rule head, a step number, a button', async () => {
    const root = mount(
      [
        '---',
        'rules: [R2]',
        '---',
        '',
        '# Layout parts',
        '',
        '**R2** · 2026-10-20 · Status: Waiting on R2',
        '',
        '## 1. Table',
        '',
        '| ID | What |',
        '|---|---|',
        '| R2 | The one defined ID |',
        '',
        '## 2. Parts',
        '',
        'A rule paragraph about R2.',
        '',
        '- [ ] A step about R2.',
        '',
        'A paragraph with a button, then R2.',
        '',
      ].join('\n'),
    );
    const doc = root.ownerDocument;
    seedIdRows();
    seed((ctx) => {
      // What Tasks 9, 10 and 11 build there: the rules index in the facts panel, a rule head, a step number, a button.
      ctx.page.facts.block(chrome(doc, 'ol', { className: 'rules-index' }, [chrome(doc, 'li', { text: 'R2 The one rule' })]));
      const rule = para(ctx.root, 'A rule paragraph');
      ctx.journal.insert(chrome(doc, 'span', { className: 'rule-head', text: 'R2 ' }), rule, rule.firstChild);
      const step = para(ctx.root, 'A step about', 'li');
      ctx.journal.insert(chrome(doc, 'span', { className: 'step-no', text: 'Step R2 ' }), step, step.firstChild);
      const withButton = para(ctx.root, 'A paragraph with a button');
      ctx.journal.insert(chrome(doc, 'button', { text: 'R2' }), withButton, withButton.firstChild);
    });
    const frontList = [{ key: 'rules', list: true, vals: ['R2'] }];
    await enhance(root, { info: { frontList } });
    expect(find(root, '.byline').textContent).toContain('Waiting on R2');
    expect(find(root, 'dl.doc-meta').hasAttribute('hidden')).toBe(true);
    expect(find(root, '.doc-facts').textContent).toContain('R2 The one rule');
    expect(linked(root, 'xref')).toEqual(['p:R2', 'li:R2', 'p:R2']);
    for (const sel of ['.byline', '.doc-facts', '.rule-head', '.step-no', 'button', 'p[hidden]', 'dl.doc-meta']) {
      expect(root.querySelector(`${sel} a.xref`), sel).toBeNull();
    }
    // each link is the source mention after the part
    for (const a of Array.from(root.querySelectorAll('a.xref'))) expect(a.previousSibling?.textContent).toMatch(/about $|then $/);
  });

  it('a comment node in a block is passed over, and the text around it is read', async () => {
    const root = mount(['# Comments', '', '| ID | What |', '|---|---|', '| R2 | Defined |', '', '## Glossary', '', '| Term | Meaning |', '|---|---|', '| Lantern | A light |', '', '## 1. Text', '', 'Before the comment, after it R2 and a lantern.', ''].join('\n'));
    seedIdRows();
    seed((ctx) => {
      const p = para(ctx.root, 'Before the comment');
      ctx.journal.insert(ctx.root.ownerDocument.createComment(' R2 and a lantern '), p, p.firstChild);
    });
    await enhance(root);
    expect(linked(root, 'xref')).toEqual(['p:R2']);
    expect(linked(root, 'term')).toEqual(['p:lantern']);
    expect(para(root, 'Before the comment').firstChild?.nodeType).toBe(8);
  });

  it('an ID that is not defined, or that a qualifier word just before names as another document\'s, is not linked', async () => {
    hooks.words = { ...defaultVocabulary(), qualifiers: ['annex', "partner's"] };
    const root = mount(
      [
        '# Qualifiers',
        '',
        '| ID | What |',
        '|---|---|',
        '| R2 | Defined |',
        '| R3 | Defined |',
        '',
        'See the annex R2, then R2 itself.',
        '',
        'The Annex  R3 is not ours, nor the partner\'s R3; R4 is not defined; this R3 is.',
        '',
        'An annexed R2 is ours.',
        '',
      ].join('\n'),
    );
    seedIdRows();
    await enhance(root);
    expect(linked(root, 'xref')).toEqual(['p:R2', 'p:R3', 'p:R2']);
    expect(find(root, 'a.xref').previousSibling?.textContent).toBe('See the annex R2, then ');
    expect(para(root, 'The Annex').querySelector('a.xref')?.previousSibling?.textContent).toMatch(/R4 is not defined; this $/);
  });

  it('the qualifier is read only in a window before the mention: its longest word and 24 more code units', async () => {
    hooks.words = { ...defaultVocabulary(), qualifiers: ['annex', 'a much longer qualifier'] };
    hooks.spy = { scans: 0, qualifier: [] };
    const filler = 'word '.repeat(200);
    const root = mount(['# Window', '', '| ID | What |', '|---|---|', '| R2 | Defined |', '', `${filler} R2, and ${filler} the a much longer qualifier R2.`, ''].join('\n'));
    seedIdRows();
    await enhance(root);
    const window = 24 + 'a much longer qualifier'.length;
    expect(hooks.spy.qualifier.length).toBeGreaterThan(0);
    expect(Math.max(...hooks.spy.qualifier)).toBe(window);
    expect(linked(root, 'xref')).toEqual(['p:R2']);
  });

  it('with no defined ID, no text is scanned; with one, each text is scanned once', async () => {
    hooks.spy = { scans: 0, qualifier: [] };
    const none = mount(XREF_DOC);
    await enhance(none);
    expect(hooks.spy.scans).toBe(0);
    expect(linked(none, 'xref')).toEqual([]);
    const some = mount(XREF_DOC);
    seedIdRows();
    await enhance(some);
    expect(hooks.spy.scans).toBeGreaterThan(0);
  });

  it('xrefs and the glossary find the root\'s blocks by walking its children, never through its live children list', async () => {
    const root = mount(`${XREF_DOC}\n${GLOSSARY_DOC.replace('# Glossary', '## 4. Glossary part')}`);
    const own = Object.getOwnPropertyDescriptor(Element.prototype, 'children');
    let reads = 0;
    let counting = false;
    Object.defineProperty(root, 'children', {
      configurable: true,
      get(this: Element) {
        if (counting) reads += 1;
        return own?.get?.call(this) as HTMLCollection;
      },
    });
    seedIdRows();
    seed(() => {
      counting = true;
    });
    hooks.after.push({ name: 'stop', build: () => void (counting = false) } satisfies Feature);
    await enhance(root);
    expect(root.querySelectorAll('a.xref').length).toBeGreaterThan(0);
    expect(root.querySelectorAll('a.term').length).toBeGreaterThan(0);
    expect(reads).toBe(0);
  });

  it('a click on a cross-reference goes to its target through nav, and tells the host its ID', async () => {
    const root = mount(XREF_DOC);
    seedIdRows();
    const onHash = vi.fn();
    await enhance(root, { onHash });
    const a = find(para(root, 'R1 links again'), 'a.xref');
    expect(click(a).prevented).toBe(true);
    const row = root.querySelectorAll('tbody tr')[0];
    expect(document.activeElement).toBe(row);
    expect(onHash).toHaveBeenCalledWith('R1', { push: true, from: null });
  });

  it('an ID whose text needs escaping in a fragment is written escaped, and nav decodes it', async () => {
    hooks.words = { ...defaultVocabulary(), ids: { prefixes: ['Q%'] } };
    const root = mount(['# Escaped', '', '| ID | What |', '|---|---|', '| Q%7 | Defined |', '', 'See Q%7 here.', ''].join('\n'));
    seed((ctx) => {
      const row = ctx.root.querySelector('tbody tr') as HTMLElement;
      ctx.index.define({ id: 'Q%7', kind: 'row', title: 'Defined', status: null, group: '', target: row, row, heads: ['ID', 'What'] });
    });
    const onHash = vi.fn();
    await enhance(root, { onHash });
    const a = find(root, 'a.xref');
    expect(a.getAttribute('href')).toBe('#Q%257');
    expect(click(a).prevented).toBe(true);
    expect(onHash).toHaveBeenCalledWith('Q%7', { push: true, from: null });
  });
});

// ── The glossary ──────────────────────────────────────────────────────────────────────────────────────────────────

const GLOSSARY_DOC = [
  '# Glossary',
  '',
  '**Spec** · 2026-10-20 · Status: Draft',
  '',
  '## In short',
  '',
  'The fold and the read mark, each named once here.',
  '',
  '## 1. Reading',
  '',
  'A fold hides a section. Folds come back. The read mark notes what was read, and read  marks add up.',
  '',
  'The fold is not linked again in this section.',
  '',
  '## 2. Words used here',
  '',
  '| Word | What it says |',
  '|---|---|',
  '| Fold | A section shown as its heading only, beside a read mark |',
  '| Read mark (marker) | A mark on a section the reader has read |',
  '| Box, Pill and Tag | Small labels |',
  '| Rule (for plans) | A numbered rule of a plan |',
  '| Rule (the) | Its second meaning |',
  '',
  '## 3. Elsewhere',
  '',
  'A fold again in a new section, and a marker. Boxes and pills, but a box and a pill in lower case are not; Tag is.',
  '',
].join('\n');

describe('glossary: what makes a glossary, and its terms (the reference layout, section 12b)', () => {
  it('a table under "Words used here" is a glossary: glossary on its wrapper, termcell on each first cell, its block flagged', async () => {
    const root = mount(GLOSSARY_DOC);
    await enhance(root);
    const wrapper = find(root, '.table-wrapper');
    expect(wrapper.classList.contains('glossary')).toBe(true);
    const firsts = Array.from(wrapper.querySelectorAll('tbody tr')).map((r) => (r as HTMLTableRowElement).cells[0]);
    expect(firsts.every((c) => c?.classList.contains('termcell') === true)).toBe(true);
    expect(wrapper.querySelectorAll('td.termcell')).toHaveLength(5);
    const block = ctxOf(root).blocks[0];
    expect(block?.kind === 'table' && block.glossary).toBe(true);
  });

  it('defines one term per name: "A (alias)" adds the alias; "A (for x)" and "A (the)" qualify; "A, B and C" are exact names', async () => {
    const root = mount(GLOSSARY_DOC);
    await enhance(root);
    const { terms } = ctxOf(root);
    const rows = Array.from(root.querySelectorAll('tbody tr')) as HTMLTableRowElement[];
    expect(terms.all().map((t) => [t.name, t.exact, t.section])).toEqual([
      ['Fold', false, 'Words used here'],
      ['Read mark', false, 'Words used here'],
      ['marker', false, 'Words used here'],
      ['Tag', true, 'Words used here'],
      ['Pill', true, 'Words used here'],
      ['Box', true, 'Words used here'],
      ['Rule', false, 'Words used here'],
    ]);
    expect(terms.get('marker')?.target).toBe(rows[1]);
    expect(terms.get('rule')?.defs.map((d) => [d.qual, d.row, d.cell])).toEqual([
      ['for plans', rows[3], rows[3]?.cells[1]],
      ['the', rows[4], rows[4]?.cells[1]],
    ]);
    expect(terms.get('read mark')?.defs.map((d) => d.qual)).toEqual(['']);
  });

  it('a two-column table headed like Term | Meaning is a glossary anywhere; three columns, or other heads elsewhere, are not', async () => {
    const root = mount(
      [
        '# Heads',
        '',
        '## 1. Anything',
        '',
        '| Term | Meaning |',
        '|---|---|',
        '| Lantern | A light |',
        '',
        '| Name | Definition |',
        '|---|---|',
        '| Beacon | A signal |',
        '',
        '| Word | Says |',
        '|---|---|',
        '| Kettle | Not a term: these heads are no glossary\'s |',
        '',
        '| Thing | Meaning |',
        '|---|---|',
        '| Anvil | Not a term either |',
        '',
        '## 2. Glossary',
        '',
        '| Term | Meaning | Note |',
        '|---|---|---|',
        '| Anchor | Three columns | never a glossary |',
        '',
        '## 3. Terms used, again',
        '',
        '| A | B |',
        '|---|---|',
        '| Rudder | By the section\'s name |',
        '',
        'A lantern, a beacon, a kettle, an anvil, an anchor and a rudder.',
        '',
      ].join('\n'),
    );
    await enhance(root);
    expect(ctxOf(root).terms.all().map((t) => t.name)).toEqual(['Lantern', 'Beacon', 'Rudder']);
    expect(Array.from(root.querySelectorAll('.table-wrapper')).map((w) => w.classList.contains('glossary'))).toEqual([true, true, false, false, false, true]);
    expect(linked(root, 'term')).toEqual(['p:lantern', 'p:beacon', 'p:rudder']);
  });

  it('with no term, the glossary reads no text', async () => {
    const real = Element.prototype.getAttribute;
    let reads = 0;
    let counting = false;
    vi.spyOn(Element.prototype, 'getAttribute').mockImplementation(function (this: Element, name: string) {
      if (counting) reads += 1;
      return real.call(this, name);
    });
    hooks.between.push({ name: 'start', build: () => void (counting = true) } satisfies Feature);
    hooks.after.push({ name: 'stop', build: () => void (counting = false) } satisfies Feature);
    const none = mount(XREF_DOC);
    await enhance(none);
    expect(reads).toBe(0);
    const some = mount(GLOSSARY_DOC);
    await enhance(some);
    expect(reads).toBeGreaterThan(0);
  });

  it('a table\'s section: the first heading of an In short or Where things stand box before it, and never a heading without an id', async () => {
    const root = mount(
      [
        '# Boxes',
        '',
        '## In short',
        '',
        'A summary.',
        '',
        '---',
        '',
        '| Term | Meaning |',
        '|---|---|',
        '| Lantern | After the In short box |',
        '',
        '## Where things stand',
        '',
        '### Agreed',
        '',
        '- One thing.',
        '',
        '---',
        '',
        '| Term | Meaning |',
        '|---|---|',
        '| Beacon | After the Agreed box |',
        '',
        '## Words used here',
        '',
        '## ...',
        '',
        '| Part | Use |',
        '|---|---|',
        '| Rudder | Under a heading with no id: the section is the one before |',
        '',
        'A lantern, a beacon and a rudder.',
        '',
      ].join('\n'),
    );
    await enhance(root);
    expect(ctxOf(root).terms.all().map((t) => [t.name, t.section])).toEqual([
      ['Lantern', 'In short'],
      ['Beacon', 'Agreed'],
      ['Rudder', 'Words used here'],
    ]);
    expect(Array.from(root.querySelectorAll('a.term')).map((a) => a.getAttribute('href'))).toEqual(['#in-short', '#agreed', '#words-used-here']);
  });

  it('a table nested in a list item finds its section above the list; a heading id is escaped in the href', async () => {
    const root = mount(['# Nested', '', '## Words used here', '', '- The words:', '', '  | Part | Use |', '  |---|---|', '  | Lantern | A light |', '', '## 1. Use', '', 'A lantern.', ''].join('\n'));
    await enhance(root);
    expect(ctxOf(root).terms.all().map((t) => [t.name, t.section])).toEqual([['Lantern', 'Words used here']]);
    expect(find(root, 'a.term').getAttribute('href')).toBe('#words-used-here');
    const hand = mountHtml(
      '<h1>Hand-written</h1><h2 id="words used">Words used here</h2><div class="table-wrapper"><table><thead><tr><th>Part</th><th>Use</th></tr></thead><tbody><tr><td>Beacon</td><td>A signal</td></tr></tbody></table></div><h2 id="next">Next</h2><p>A beacon.</p>',
    );
    await enhance(hand);
    expect(find(hand, 'a.term').getAttribute('href')).toBe('#words%20used');
  });

  it('in hand-written html, a glossary row with one cell names no term', async () => {
    const root = mountHtml(
      '<h1>Hand-written</h1><h2 id="glossary">Glossary</h2><div class="table-wrapper"><table><thead><tr><th>Term</th><th>Meaning</th></tr></thead><tbody><tr><td>Lantern</td></tr><tr><td>Beacon</td><td>A signal</td></tr></tbody></table></div><h2 id="use">Use</h2><p>A lantern and a beacon.</p>',
    );
    await enhance(root);
    expect(ctxOf(root).terms.all().map((t) => t.name)).toEqual(['Beacon']);
    expect(root.querySelectorAll('td.termcell')).toHaveLength(1);
    expect(linked(root, 'term')).toEqual(['p:beacon']);
  });

  it('in hand-written html, a term cell is read as its words: white space at its ends and line breaks inside count as one space', async () => {
    const root = mountHtml(
      '<h1>Hand-written</h1><h2 id="glossary">Glossary</h2><div class="table-wrapper"><table><thead><tr><th>Term</th><th>Meaning</th></tr></thead><tbody>' +
        '<tr><td>\n  Codes\n</td><td>Not a term</td></tr><tr><td>Read\n  mark (marker)</td><td>A mark</td></tr></tbody></table></div>' +
        '<h2 id="use">Use</h2><p>Codes, a read mark and a marker.</p>',
    );
    await enhance(root);
    expect(ctxOf(root).terms.all().map((t) => [t.name, t.exact])).toEqual([
      ['Read mark', false],
      ['marker', false],
    ]);
    expect(linked(root, 'term')).toEqual(['p:read mark', 'p:marker']);
  });

  it('a numbered or lettered heading counts by its words, and a glossary under an h3 by the h3', async () => {
    const root = mount(
      [
        '# Numbered',
        '',
        '## A1. Glossary of parts',
        '',
        '| Part | Use |',
        '|---|---|',
        '| Lantern | A light |',
        '',
        '## 2. Other',
        '',
        '### Words used here',
        '',
        '| Part | Use |',
        '|---|---|',
        '| Beacon | A signal |',
        '',
      ].join('\n'),
    );
    await enhance(root);
    expect(ctxOf(root).terms.all().map((t) => [t.name, t.section])).toEqual([
      ['Lantern', 'Glossary of parts'],
      ['Beacon', 'Words used here'],
    ]);
  });

  it('refuses a name shorter than three characters, a cell over 48, an "IDs" or "Codes" cell, an ID and a rule ID', async () => {
    const root = mount(
      [
        '# Refused',
        '',
        '## Glossary',
        '',
        '| Term | Meaning |',
        '|---|---|',
        '| UX | Too short |',
        `| ${'Long '.repeat(8)}longnames | Over 48 characters |`,
        `| ${'Long '.repeat(8)}longname | 48 characters exactly |`,
        '| IDs used here | Not a term |',
        '| Codes | Not a term |',
        '| R17 | An ID |',
        '| AB-CD | A rule ID |',
        '| Okay (UI) | The alias is too short; the name is not |',
        '',
      ].join('\n'),
    );
    await enhance(root);
    expect(ctxOf(root).terms.all().map((t) => t.name)).toEqual([`${'Long '.repeat(8)}longname`, 'Okay']);
    expect(root.querySelectorAll('td.termcell')).toHaveLength(8);
  });

  it('a section\'s words leave out a button the layout put in its heading', async () => {
    const root = mount(['# Button', '', '## Words used here', '', '| Part | Use |', '|---|---|', '| Lantern | A light |', ''].join('\n'));
    seed((ctx) => {
      const h = find(ctx.root, 'h2');
      ctx.journal.insert(chrome(ctx.root.ownerDocument, 'button', { text: 'Show all' }), h, null);
    });
    await enhance(root);
    expect(ctxOf(root).terms.all().map((t) => [t.name, t.section])).toEqual([['Lantern', 'Words used here']]);
  });

  it('a cell of several names keeps each name exact; a part of four words or more keeps the cell one name', async () => {
    const root = mount(
      [
        '# Names',
        '',
        '## Glossary',
        '',
        '| Term | Meaning |',
        '|---|---|',
        '| Lamp / Wick | Two names, by a slash |',
        '| Open floor space plan and Desk | A part of four words |',
        '| Lantern, | A trailing comma: one name, as written |',
        '',
        'A lamp, a Wick, the open floor space plan and desk.',
        '',
      ].join('\n'),
    );
    await enhance(root);
    expect(ctxOf(root).terms.all().map((t) => [t.name, t.exact])).toEqual([
      ['Wick', true],
      ['Lamp', true],
      ['Open floor space plan and Desk', false],
      ['Lantern,', false],
    ]);
    expect(linked(root, 'term')).toEqual(['p:Wick', 'p:open floor space plan and desk']);
  });
});

describe('glossary: the first mention of each term in each section', () => {
  it('links the first mention per section; an h2 starts a new one, and so does the In short box', async () => {
    const root = mount(GLOSSARY_DOC);
    await enhance(root);
    expect(linked(root, 'term')).toEqual(['p:fold', 'p:read mark', 'p:fold', 'p:read mark', 'p:fold', 'p:marker', 'p:Boxes', 'p:Tag']);
    expect(find(root, '.short').querySelectorAll('a.term')).toHaveLength(2);
    expect(para(root, 'The fold is not').querySelector('a.term')).toBeNull();
    expect(find(root, '.glossary').querySelector('a.term')).toBeNull();
  });

  it('a term link is chrome around the source text: a.term, data-term, aria-haspopup="dialog", aria-expanded="false", href to the glossary\'s heading', async () => {
    const root = mount(GLOSSARY_DOC);
    const p = para(root, 'A fold hides');
    await enhance(root);
    const a = find(p, 'a.term');
    expect([a.className, a.getAttribute('data-term'), a.getAttribute('aria-haspopup'), a.getAttribute('aria-expanded'), a.getAttribute('href')]).toEqual([
      'term',
      'fold',
      'dialog',
      'false',
      '#2-words-used-here',
    ]);
    expect(a.hasAttribute(CHROME_ATTR)).toBe(true);
    expect(a.childNodes).toHaveLength(1);
    expect(a.firstChild?.nodeType).toBe(3);
    expect(squash(p.textContent)).toBe('A fold hides a section. Folds come back. The read mark notes what was read, and read marks add up.');
    expect(ctxOf(root).terms.get(a.getAttribute('data-term') ?? '')?.name).toBe('Fold');
  });

  it('a mention before the In short box is in a section of its own: the box starts the next one', async () => {
    const root = mount(
      [
        '# Before the box',
        '',
        'A lantern, named before the box.',
        '',
        '## In short',
        '',
        'A lantern again, inside the box.',
        '',
        '## Glossary',
        '',
        '| Term | Meaning |',
        '|---|---|',
        '| Lantern | A light |',
        '',
      ].join('\n'),
    );
    await enhance(root);
    expect(find(root, '.short').querySelectorAll('a.term')).toHaveLength(1);
    expect(linked(root, 'term')).toEqual(['p:lantern', 'p:lantern']);
  });

  it('the first mention is the first in document order: across the texts of one block, and across the items of one list', async () => {
    const root = mount(
      [
        '# Order',
        '',
        '| ID | What |',
        '|---|---|',
        '| R1 | Defined |',
        '',
        '## Glossary',
        '',
        '| Term | Meaning |',
        '|---|---|',
        '| Lantern | A light |',
        '| Wick | A thread |',
        '',
        '## 1. Text',
        '',
        'R1 first, a lantern *then* R1 again and a lantern again.',
        '',
        '- A wick in the first item.',
        '- A wick in the second item.',
        '',
      ].join('\n'),
    );
    seedIdRows();
    await enhance(root);
    const p = para(root, 'R1 first');
    expect(p.firstChild).toBe(find(p, 'a.xref'));
    expect(find(p, 'a.term').nextSibling?.textContent).toBe(' ');
    expect(find(p, 'a.term').previousSibling?.textContent).toBe(' first, a ');
    expect(linked(root, 'term')).toEqual(['p:lantern', 'li:wick']);
    expect(para(root, 'A wick in the first', 'li').querySelector('a.term')).not.toBeNull();
  });

  it('the search goes on after the whole of a mention it leaves, so a shorter term inside it is not linked there', async () => {
    const root = mount(['# Resume', '', '## Glossary', '', '| Term | Meaning |', '|---|---|', '| Read mark | A mark |', '| Mark | Another |', '', '## 1. Use', '', 'A read mark, then a read mark again, and a mark.', ''].join('\n'));
    await enhance(root);
    expect(linked(root, 'term')).toEqual(['p:read mark', 'p:mark']);
    expect(find(root, 'a.term:last-of-type').previousSibling?.textContent).toBe(', then a read mark again, and a ');
  });

  it('plurals in s and es; a whole word on both sides; white space runs inside a name; any case unless exact', async () => {
    const root = mount(
      [
        '# Plurals',
        '',
        '## Glossary',
        '',
        '| Term | Meaning |',
        '|---|---|',
        '| Box | A container |',
        '| Read mark | A mark |',
        '| Lamp, Wick | Exact names |',
        '',
        '## 1. One',
        '',
        'An unboxed thing, a box-shaped one, a box_x, then BOXES.',
        '',
        'The READ   MARKS, and lamps but Lamps.',
        '',
        '## 2. Two',
        '',
        'Two boxs read marks; then a wick, a Wicks, and the Wick.',
        '',
      ].join('\n'),
    );
    await enhance(root);
    expect(linked(root, 'term')).toEqual(['p:BOXES', 'p:READ   MARKS', 'p:Lamps', 'p:boxs', 'p:read marks', 'p:Wicks']);
  });

  it('a mention the pattern finds but no term is spelled as is left: the micro sign and mu fold together only in a pattern', async () => {
    const root = mount(['# Micro', '', '## Glossary', '', '| Term | Meaning |', '|---|---|', '| \u03bceter | A made-up unit |', '', '## 1. Use', '', 'A \u00b5eter, then a \u03bceter.', ''].join('\n'));
    await enhance(root);
    expect(linked(root, 'term')).toEqual(['p:\u03bceter']);
    expect(find(root, 'a.term').previousSibling?.textContent).toBe('A \u00b5eter, then a ');
  });

  it('skips the glossary itself, links, code, headings, table heads, figures, the byline and the facts panel', async () => {
    const root = mount(
      [
        '---',
        'tags: [lantern]',
        '---',
        '',
        '# Skips',
        '',
        '**Spec** · 2026-10-20 · Status: Lantern lit',
        '',
        '## Glossary',
        '',
        '| Term | Meaning |',
        '|---|---|',
        '| Lantern | A light; a lantern names itself here |',
        '',
        '## 1. Markup',
        '',
        '- An item.',
        '',
        '  ```mermaid',
        '  graph TD; A-->B',
        '  ```',
        '',
        '  *Figure 1. A lantern figure.*',
        '',
        '- Another item.',
        '',
        '  | Lantern head | Other |',
        '  |---|---|',
        '  | cell | x |',
        '',
        '> ### A lantern heading',
        '>',
        '> Quoted text.',
        '',
        'A `lantern`, <kbd>lantern</kbd>, a [lantern link](#glossary), then the lantern itself.',
        '',
      ].join('\n'),
    );
    seed((ctx) => {
      const doc = ctx.root.ownerDocument;
      ctx.page.facts.block(chrome(doc, 'ol', {}, [chrome(doc, 'li', { text: 'A lantern rule' })]));
    });
    await enhance(root, { info: { frontList: [{ key: 'tags', list: true, vals: ['lantern'] }] } });
    expect(find(root, '.byline').textContent).toContain('Lantern lit');
    expect(linked(root, 'term')).toEqual(['p:lantern']);
    expect(find(root, 'a.term').previousSibling?.textContent).toBe(', then the ');
  });

  it('skips a rule head, a step number and a button, and hidden text', async () => {
    const root = mount(
      [
        '# Parts',
        '',
        '**Lantern** · 2026-10-20 · Status: Draft',
        '',
        '## Glossary',
        '',
        '| Term | Meaning |',
        '|---|---|',
        '| Lantern | A light |',
        '',
        '## 1. Rules',
        '',
        'A rule about it, then a lantern.',
        '',
        '## 2. Steps',
        '',
        '- [ ] A step about it, then a lantern.',
        '',
        '## 3. Buttons',
        '',
        'A paragraph with a button, then a lantern.',
        '',
      ].join('\n'),
    );
    seed((ctx) => {
      const doc = ctx.root.ownerDocument;
      const rule = para(ctx.root, 'A rule about');
      ctx.journal.insert(chrome(doc, 'span', { className: 'rule-head', text: 'Lantern rule ' }), rule, rule.firstChild);
      const step = para(ctx.root, 'A step about', 'li');
      ctx.journal.insert(chrome(doc, 'span', { className: 'step-no', text: 'Lantern step ' }), step, step.firstChild);
      const withButton = para(ctx.root, 'A paragraph with a button');
      ctx.journal.insert(chrome(doc, 'button', { text: 'Lantern' }), withButton, withButton.firstChild);
    });
    await enhance(root);
    expect(find(root, 'p[hidden]').textContent).toContain('Lantern');
    expect(linked(root, 'term')).toEqual(['p:lantern', 'li:lantern', 'p:lantern']);
  });

  it('an xref and a term never overlap: the glossary reads no link, and an ID is never a term', async () => {
    const root = mount(
      [
        '# Overlap',
        '',
        '## 1. Table',
        '',
        '| ID | What |',
        '|---|---|',
        '| R2 | The second rule |',
        '',
        '## Glossary',
        '',
        '| Term | Meaning |',
        '|---|---|',
        '| Read mark | A mark |',
        '| R2 mark | Shaped like an ID, never a term |',
        '| R7 | An ID |',
        '',
        '## 2. Text',
        '',
        'The R2 read mark, and the R2 mark; R7 and R7 again.',
        '',
      ].join('\n'),
    );
    seedIdRows();
    await enhance(root);
    expect(ctxOf(root).terms.all().map((t) => t.name)).toEqual(['Read mark']);
    // R7's glossary row defines it as an ID (the fixture's ID rows), so its first mention links, as an xref only.
    expect(linked(root, 'xref')).toEqual(['td:R2', 'p:R2', 'p:R7']);
    expect(linked(root, 'term')).toEqual(['p:read mark']);
    expect(root.querySelector('a.xref a, a.term a')).toBeNull();
  });

  it('terms defined before the glossary builds (seeded) are linked too, their href the heading before their target', async () => {
    const root = mount(['# Seeded', '', '## 1. Where it is defined', '', 'A lamp is defined here.', '', '## 2. Use', '', 'The lamp, used.', ''].join('\n'));
    seed((ctx) => {
      const p = para(ctx.root, 'A lamp is defined');
      ctx.terms.define({ name: 'Lamp', exact: false, section: '', target: p, def: { qual: '', cell: p, row: p } });
    });
    await enhance(root);
    expect(linked(root, 'term')).toEqual(['p:lamp', 'p:lamp']);
    expect(Array.from(root.querySelectorAll('a.term')).map((a) => a.getAttribute('href'))).toEqual(['#1-where-it-is-defined', '#1-where-it-is-defined']);
  });

  it('a term with no heading before its target, in the root, has the empty fragment for its href', async () => {
    const root = mount(['A lamp first, before any heading.', '', '# Title', '', 'The lamp again.', ''].join('\n'));
    const outside = document.createElement('h2');
    outside.id = 'outside';
    outside.textContent = 'A heading outside the root';
    root.before(outside);
    seed((ctx) => {
      const p = para(ctx.root, 'A lamp first');
      ctx.terms.define({ name: 'Lamp', exact: false, section: '', target: p, def: { qual: '', cell: p, row: p } });
    });
    await enhance(root);
    expect(Array.from(root.querySelectorAll('a.term')).map((a) => a.getAttribute('href'))).toEqual(['#']);
  });
});

describe('glossary: the term link goes to its definition', () => {
  it('a plain click goes to the term\'s row (focused), not the heading its href names; the host hears no id', async () => {
    const root = mount(GLOSSARY_DOC);
    const onHash = vi.fn();
    await enhance(root, { onHash });
    const a = find(para(root, 'A fold hides'), 'a.term');
    expect(click(a).prevented).toBe(true);
    const row = root.querySelector('tbody tr');
    expect(document.activeElement).toBe(row);
    expect(row?.getAttribute('tabindex')).toBe('-1');
    expect(onHash).not.toHaveBeenCalled();
  });

  it('a modified click, another button, or a click a handler already took, is left alone', async () => {
    const root = mount(GLOSSARY_DOC);
    await enhance(root);
    const a = find(para(root, 'A fold hides'), 'a.term');
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      expect(click(a, init).prevented, JSON.stringify(init)).toBe(false);
      expect(document.activeElement).toBe(document.body);
    }
    const taken = (e: Event): void => e.preventDefault();
    root.addEventListener('click', taken, true);
    click(a);
    root.removeEventListener('click', taken, true);
    expect(document.activeElement).toBe(document.body);
  });

  it('after destroy a click does nothing', async () => {
    const root = mount(GLOSSARY_DOC);
    await enhance(root);
    const a = find(para(root, 'A fold hides'), 'a.term');
    await destroyEnhancement(root);
    expect(a.isConnected).toBe(false);
    expect(click(a).prevented).toBe(false);
  });
});

describe('links: destroy, two roots', () => {
  it('destroy restores every text node, byte for byte', async () => {
    const md = `${XREF_DOC}\n${GLOSSARY_DOC.replace('# Glossary', '## 4. Glossary part')}`;
    const root = mount(md);
    const before = root.innerHTML;
    const texts = (): string[] => {
      const out: string[] = [];
      const walk = (n: Node): void => {
        if (n.nodeType === 3) out.push((n as Text).data);
        n.childNodes.forEach(walk);
      };
      walk(root);
      return out;
    };
    const textsBefore = texts();
    seedIdRows();
    await enhance(root);
    expect(root.querySelectorAll('a.xref').length).toBeGreaterThan(5);
    expect(root.querySelectorAll('a.term').length).toBeGreaterThan(5);
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(before);
    expect(texts()).toEqual(textsBefore);
  });

  it('RF2: two roots link each to its own IDs and terms', async () => {
    const a = mount(['# A', '', '| ID | What |', '|---|---|', '| R1 | In A |', '', '## Glossary', '', '| Term | Meaning |', '|---|---|', '| Lantern | In A |', '', '## 1. Text', '', 'R1, R2, a lantern and a beacon.', ''].join('\n'));
    const b = mount(['# B', '', '| ID | What |', '|---|---|', '| R2 | In B |', '', '## Glossary', '', '| Term | Meaning |', '|---|---|', '| Beacon | In B |', '', '## 1. Text', '', 'R1, R2, a lantern and a beacon.', ''].join('\n'));
    seedIdRows();
    await enhance(a);
    await enhance(b);
    expect([...linked(a, 'xref'), ...linked(a, 'term')]).toEqual(['p:R1', 'p:lantern']);
    expect([...linked(b, 'xref'), ...linked(b, 'term')]).toEqual(['p:R2', 'p:beacon']);
    const go = find(a, 'a.term');
    click(go);
    expect(a.contains(document.activeElement)).toBe(true);
  });
});

// ── The term matcher ────────────────────────────────────────────────────────────────────────────────────────────────

/** The reference's pattern for a set of term keys: an oracle for termMatcher. */
function referencePattern(keys: readonly string[]): RegExp {
  const alts = [...keys].sort((x, y) => y.length - x.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
  return new RegExp(`(?<![\\w-])(${alts.join('|')})(?:s|es)?(?![\\w-])`, 'gi');
}

/** A seeded generator, so a failure repeats. */
function prng(seedValue: number): () => number {
  let s = seedValue >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('the term matcher (glossary.ts)', () => {
  it('finds what the reference\'s pattern finds, on random keys and texts, from any start', () => {
    const rnd = prng(13);
    const pick = (chars: string, n: number): string => Array.from({ length: n }, () => chars[Math.floor(rnd() * chars.length)]).join('');
    // Case, the plural letters, word and dash boundaries, white space of several kinds, and characters whose case maps
    // oddly (the Kelvin sign, sharp s and its capital, dotted capital I, micro and mu, the three sigmas). The long s is
    // left out: the language's rule keeps it apart from "s", as V8 does for one letter, but V8 folds them together
    // inside an alternation, so the reference's own pattern answers differently by engine there.
    const keyChars = 'abseSE-. _\u212a\u00df\u0130\u00b5\u03bck\u03c3';
    const textChars = 'aAbBsSeE-. _\t\n\u00a0\u212ak\u00df\u1e9e\u0130\u00b5\u03bc\u03a3\u03c3\u03c21,';
    let found = 0;
    for (let trial = 0; trial < 4000; trial += 1) {
      const keys = [...new Set(Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => pick(keyChars, 1 + Math.floor(rnd() * 4)).replace(/\s+/g, ' ').trim().toLowerCase()))].filter((k) => k !== '');
      if (keys.length === 0) continue;
      const text = pick(textChars, Math.floor(rnd() * 24));
      const find = termMatcher(keys);
      const re = referencePattern(keys);
      for (let from = 0; from <= text.length; from += 1 + Math.floor(rnd() * 3)) {
        re.lastIndex = from;
        const m = re.exec(text);
        const want = m === null ? null : { start: m.index, keyEnd: m.index + (m[1] ?? '').length, end: m.index + m[0].length };
        expect(find(text, from), JSON.stringify({ keys, text, from })).toEqual(want);
        if (want !== null) found += 1;
      }
    }
    expect(found).toBeGreaterThan(1000);
  });

  it('reads every code unit as the language\'s pattern does: white space, the edges of a word, and case', () => {
    const one = (keys: readonly string[], text: string): ReturnType<ReturnType<typeof termMatcher>> => {
      const re = referencePattern(keys);
      const m = re.exec(text);
      return m === null ? null : { start: m.index, keyEnd: m.index + (m[1] ?? '').length, end: m.index + m[0].length };
    };
    const space = termMatcher(['a b']);
    const edge = termMatcher(['ab']);
    const bad: string[] = [];
    for (let c = 0; c <= 0xffff; c += 1) {
      const ch = String.fromCharCode(c);
      const hex = c.toString(16);
      if (JSON.stringify(space(`a${ch}b`, 0)) !== JSON.stringify(one(['a b'], `a${ch}b`))) bad.push(`space ${hex}`);
      if (JSON.stringify(edge(`${ch}ab`, 0)) !== JSON.stringify(one(['ab'], `${ch}ab`))) bad.push(`before ${hex}`);
      if (JSON.stringify(edge(`ab${ch}`, 0)) !== JSON.stringify(one(['ab'], `ab${ch}`))) bad.push(`after ${hex}`);
      const key = ch.toLowerCase().replace(/\s+/g, ' ').trim();
      if (key === '') continue;
      const find = termMatcher([key]);
      // The character, its cases, and the first unit of its upper case (a letter whose upper case is two units).
      for (const text of [ch, ch.toUpperCase(), ch.toLowerCase(), ch.toUpperCase()[0] ?? '']) {
        if (JSON.stringify(find(text, 0)) !== JSON.stringify(one([key], text))) bad.push(`case ${hex} in ${JSON.stringify(text)}`);
      }
    }
    expect(bad).toEqual([]);
  }, 120_000);

  it('a longer term wins at the same place, and a shorter one is tried when the longer one\'s end is inside a word', () => {
    const find = termMatcher(['read', 'read mark']);
    expect(find('the read mark here', 0)).toEqual({ start: 4, keyEnd: 13, end: 13 });
    expect(find('the read markers', 0)).toEqual({ start: 4, keyEnd: 8, end: 8 });
    expect(find('the read marks', 0)).toEqual({ start: 4, keyEnd: 13, end: 14 });
    expect(find('a box', 0)).toBeNull();
    expect(termMatcher([])('anything', 0)).toBeNull();
  });
});

// ── RF3: the large plan ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The budget for xrefs and the glossary on the large plan under jsdom, in ms: about six times the slowest best run
 * measured on a loaded build box (3.4 s).
 */
const BUDGET_MS = 20_000;

/**
 * How many rounds of the large plan, then the plan twice as large, the time is the best of: enough that on a loaded
 * box each best is rarely a slowed round, since the ratio's bound leaves little room (2.0 to 2.4 measured, bound 2.5).
 */
const ROUNDS = 5;

/**
 * No round starts once the rounds have taken this long, in ms, so a matcher whose cost grows with the number of terms
 * is judged on the rounds it finished (one at least) rather than outrunning the test's own timeout. Five honest
 * rounds take a fraction of it.
 */
const ROUNDS_MS = 240_000;

/**
 * A full garbage collection, when the runtime will give one: the garbage of parsing a large document then lands
 * before the timed window, not in it. (Node gives `gc` to a context once the flag is set.)
 */
const collect: () => void = (() => {
  try {
    v8.setFlagsFromString('--expose-gc');
    const gc: unknown = vm.runInNewContext('gc');
    return typeof gc === 'function' ? (gc as () => void) : () => undefined;
  } catch {
    return () => undefined;
  }
})();

/** Each scale's rendered html, rendered once. */
const planHtml = new Map<number, string>();

/** The time xrefs and the glossary take on a large plan at `scale`, with the index seeded first, and what they made. */
async function timeLinks(scale: number): Promise<{ ms: number; xrefs: number; terms: number }> {
  let html = planHtml.get(scale);
  if (html === undefined) planHtml.set(scale, (html = render(largePlan(scale).markdown).html));
  // Set through innerHTML, not a parser of its own: jsdom keeps each parsed document alive, and the heap they would
  // add up to slows every later round.
  const root = document.createElement('main');
  root.innerHTML = html;
  document.body.append(root);
  let t0 = 0;
  let t1 = 0;
  seedIdRows();
  seed(() => {
    collect();
    t0 = performance.now();
  });
  hooks.after.push({
    name: 'stop',
    build: () => {
      t1 = performance.now();
    },
  } satisfies Feature);
  try {
    await enhance(root, { folds: false });
    return { ms: t1 - t0, xrefs: root.querySelectorAll('a.xref').length, terms: root.querySelectorAll('a.term').length };
  } finally {
    await destroyEnhancement(root);
    root.remove();
    hooks.seeds.length = 0;
    hooks.after.length = 0;
  }
}

describe('RF3: the large plan', () => {
  it('xrefs and the glossary stay within their budget on the large plan, and a plan twice as large takes at most 2.5 times as long', async () => {
    const one: number[] = [];
    const two: number[] = [];
    let counts1 = { xrefs: 0, terms: 0 };
    let counts2 = { xrefs: 0, terms: 0 };
    const start = performance.now();
    for (let round = 0; round < ROUNDS && (round === 0 || performance.now() - start < ROUNDS_MS); round += 1) {
      const a = await timeLinks(1);
      one.push(a.ms);
      counts1 = a;
      const b = await timeLinks(2);
      two.push(b.ms);
      counts2 = b;
    }
    // Every ID row names one other ID; the steps and the notes name IDs and terms.
    expect(counts1.xrefs).toBeGreaterThan(LARGE_PLAN_COUNTS.ids);
    expect(counts1.terms).toBeGreaterThan(LARGE_PLAN_COUNTS.terms);
    expect(counts2.xrefs).toBeGreaterThan(1.8 * counts1.xrefs);
    expect(counts2.terms).toBeGreaterThan(1.5 * counts1.terms);
    const best1 = Math.min(...one);
    const best2 = Math.min(...two);
    const said = `${one.map((x) => x.toFixed(0)).join(', ')} ms, then ${two.map((x) => x.toFixed(0)).join(', ')} ms`;
    expect(best1, `large plan: ${said}`).toBeLessThan(BUDGET_MS);
    expect(best2 / best1, said).toBeLessThanOrEqual(2.5);
  }, 900_000);
});
