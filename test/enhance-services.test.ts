// @vitest-environment jsdom
// The shared services of `./enhance` (docserver L2, Task 7b; LD1): the registries (the ID index, terms, blocks,
// figures, the plan, the page), events, reveal, overlays and their Escape order, the keyboard layer, navigation and
// the delegated click, the position seam, relayout (resize, prefs, folds and the fonts), heading controls, the bar's
// skeleton and its slots, the facts panel's seam, the folds' members API, ctx.setPrefs, and RF3's large plan.
//
// The feature list is mocked with a pass-through: features() is the real list followed by the probes a test adds, so
// a probe runs inside a real startup, after every real feature.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance, setEnhancementPrefs, type EnhanceOptions, type ReaderStorage } from '../src/enhance/index.js';
import { TOOL_ORDER, type ToolKind } from '../src/enhance/bar.js';
import type { Feature } from '../src/enhance/features.js';
import { HEAD_SLOTS } from '../src/enhance/headctl.js';
import { CHROME_ATTR, chrome } from '../src/enhance/journal.js';
import { CHORD, SHEET_ORDER } from '../src/enhance/keys.js';
import type { Env } from '../src/enhance/env.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { BAR_HOLD_MS, type Position } from '../src/enhance/nav.js';
import { OVERLAY_ORDER, type OverlayKind } from '../src/enhance/overlays.js';
import { createEvents, createPage, createPlan, createTerms, EVENT_NAMES, termKey, type IndexEntry, type RelayoutReason } from '../src/enhance/registry.js';
import { createRelayout, FONTS_WAIT_MS, RESIZE_DEBOUNCE_MS } from '../src/enhance/relayout.js';
import { docKey } from '../src/enhance/state.js';
import type { FeatureContext } from '../src/enhance/types.js';
import { render } from '../src/render/index.js';
import { LARGE_PLAN_BYTES, LARGE_PLAN_COUNTS, largePlan } from './fixtures/large-plan.js';

const hooks = vi.hoisted(() => ({ probes: [] as unknown[], beforeFolds: [] as unknown[] }));

vi.mock('../src/enhance/features.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/enhance/features.js')>();
  const features = (): Feature[] => {
    const list = [...real.features()];
    const at = list.findIndex((f) => f.name === 'folds');
    return [...list.slice(0, at), ...(hooks.beforeFolds as Feature[]), ...list.slice(at), ...(hooks.probes as Feature[])];
  };
  return { ...real, features };
});

const DOC = [
  '# Example spec',
  '',
  '**Spec** · 2026-10-19 · Status: Draft',
  '',
  '## 1. Scope',
  '',
  'What this example covers, and [the design](#2-design).',
  '',
  '<details>',
  '<summary>More</summary>',
  '',
  'Inside the details: [the plan](#3-plan), [a sibling](other.md) and [a missing one](#nowhere).',
  '',
  '</details>',
  '',
  '## 2. Design',
  '',
  'How it works.',
  '',
  '| ID | What | Status |',
  '|---|---|---|',
  '| R1 | First | Agreed |',
  '| R2 | Second | Pending |',
  '',
  '```js',
  'const a = 1;',
  '```',
  '',
  '## 3. Plan',
  '',
  'Plan text, and [the first row](#R1).',
  '',
  '```mermaid',
  'graph TD; A-->B',
  '```',
  '',
  '*Figure 1. A diagram.*',
  '',
  '## Where things stand',
  '',
  '### Agreed',
  '',
  '- One thing',
  '',
  '### Waiting on you',
  '',
  '- First item',
  '- Second item',
  '',
].join('\n');

const FRONT = [
  { key: 'type', list: false, vals: ['spec'] },
  { key: 'rules', list: true, vals: ['AB-ONE', 'AB-TWO'] },
  { key: 'tags', list: true, vals: ['example', 'demo'] },
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

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
  hooks.probes.length = 0;
  hooks.beforeFolds.length = 0;
  delete (document as unknown as { fonts?: unknown }).fonts;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function ctxOf(root: HTMLElement): FeatureContext {
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('no context: the root is not enhanced');
  return ctx;
}

/** Let queued promise reactions run. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

/** Resolve after `ms` of real time. */
const wait = (ms: number): Promise<void> =>
  new Promise((r) => {
    setTimeout(r, ms);
  });

/** Two frames and a little: what a relayout requested now has run by. */
const frames = (): Promise<void> => wait(60);

/** The child of `root` with this tag and id (a walk, never an id lookup). */
function child(root: Element, tag: string, id: string): HTMLElement {
  const el = Array.from(root.children).find((c) => c.localName === tag && c.id === id);
  if (el === undefined) throw new Error(`no ${tag}#${id}`);
  return el as HTMLElement;
}

/** The first element in `root` matching a static selector. */
function find(root: Element, selector: string): HTMLElement {
  const el = root.querySelector(selector);
  if (el === null) throw new Error(`nothing matches ${selector}`);
  return el as HTMLElement;
}

/** A probe feature that runs `fn` with the context during startup, after every real feature. */
function probe(fn: (ctx: FeatureContext) => void): void {
  hooks.probes.push({ name: 'probe', build: fn } satisfies Feature);
}

/** An index entry for a row of the DOC's table. */
function rowEntry(root: HTMLElement, id: string, n: number): IndexEntry {
  const rows = Array.from(root.querySelectorAll('tbody tr'));
  const row = rows[n] as Element;
  return { id, kind: 'row', title: `Row ${String(n)}`, status: null, group: 'Design', target: row, row, heads: ['ID', 'What', 'Status'] };
}

const key = (target: EventTarget, k: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};

/** Click `el`; what the document saw after the root's handlers (and the browser's default is then stopped). */
function click(el: Element, init: MouseEventInit = {}): { prevented: boolean } {
  let prevented = false;
  const after = (e: Event): void => {
    prevented = e.defaultPrevented;
    e.preventDefault(); // jsdom would try to navigate
  };
  document.addEventListener('click', after);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }));
  document.removeEventListener('click', after);
  return { prevented };
}

describe('registries: the ID index (LD6, RF1)', () => {
  it('the first definition of an ID wins; all() is in document order, whatever the definition order', async () => {
    const root = mount();
    await enhance(root);
    const { index } = ctxOf(root);
    const second = rowEntry(root, 'R2', 1);
    const first = rowEntry(root, 'R1', 0);
    expect(index.define(second)).toBe(true);
    expect(index.define(first)).toBe(true);
    expect(index.define({ ...first, id: 'R2', title: 'again' })).toBe(false);
    expect(index.get('R2')?.title).toBe('Row 1');
    expect(index.all().map((e) => e.id)).toEqual(['R1', 'R2']);
    expect(Object.isFrozen(index.all())).toBe(true);
    expect(Object.isFrozen(index.get('R1'))).toBe(true);
    expect(index.of(first.target)?.id).toBe('R1');
  });

  it('ids such as __proto__, constructor and toString are ordinary keys, and no prototype changes', async () => {
    const root = mount();
    await enhance(root);
    const { index } = ctxOf(root);
    expect(index.get('__proto__')).toBeUndefined();
    expect(index.get('constructor')).toBeUndefined();
    expect(index.get('hasOwnProperty')).toBeUndefined();
    expect(index.define(rowEntry(root, '__proto__', 0))).toBe(true);
    expect(index.define(rowEntry(root, 'toString', 1))).toBe(true);
    expect(index.get('__proto__')?.title).toBe('Row 0');
    expect(index.get('toString')?.title).toBe('Row 1');
    expect(index.get('constructor')).toBeUndefined();
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    expect(({} as Record<string, unknown>)['title']).toBeUndefined();
  });

  it('refuses a malformed entry: an id, a kind, a status, a target that is chrome, the root or outside it, heads', async () => {
    const root = mount();
    await enhance(root);
    const { index } = ctxOf(root);
    const ok = rowEntry(root, 'R1', 0);
    const chromeEl = find(root, `[${CHROME_ATTR}]`);
    const outside = document.createElement('p');
    document.body.append(outside);
    for (const bad of [
      { ...ok, id: '' },
      { ...ok, id: 'x'.repeat(201) },
      { ...ok, kind: 'other' },
      { ...ok, status: 'green' },
      { ...ok, target: chromeEl },
      { ...ok, target: root },
      { ...ok, target: outside },
      { ...ok, row: outside },
      { ...ok, heads: [1] },
      { ...ok, title: null },
    ]) {
      expect(() => index.define(bad as unknown as IndexEntry)).toThrow(/index entry/);
    }
    expect(index.all()).toEqual([]);
    expect(index.define({ ...ok, id: 'x'.repeat(200) })).toBe(true);
  });
});

describe('registries: terms, blocks, figures, the plan and the page', () => {
  it('terms: a new name makes an entry; the same name again, in any case, adds a definition; __proto__ is a key', async () => {
    const root = mount();
    await enhance(root);
    const { terms } = ctxOf(root);
    const [r0, r1] = Array.from(root.querySelectorAll('tbody tr'));
    const def = (row: Element) => ({ qual: '', cell: row.lastElementChild as Element, row });
    const a = terms.define({ name: 'Read  mark', exact: false, section: 'Words used here', target: r0 as Element, def: def(r0 as Element) });
    const again = terms.define({ name: 'read mark', exact: true, section: 'Other', target: r1 as Element, def: def(r1 as Element) });
    expect(again).toBe(a);
    expect(a.name).toBe('Read mark');
    expect(a.key).toBe('read mark');
    expect(a.exact).toBe(false);
    expect(a.defs.map((d) => d.row)).toEqual([r0, r1]);
    expect(terms.get('READ   Mark')).toBe(a);
    const proto = terms.define({ name: '__proto__', exact: false, section: '', target: r0 as Element, def: def(r0 as Element) });
    expect(terms.get('__proto__')).toBe(proto);
    expect(terms.get('constructor')).toBeUndefined();
    expect(terms.all()).toEqual([a, proto]);
    expect(termKey(' A\tB ')).toBe('a b');
    expect(() => terms.define({ name: '', exact: false, section: '', target: r0 as Element, def: def(r0 as Element) })).toThrow(/term/);
  });

  it('blocks: every table and code block in document order, a figure\'s code left out, with their heads and rows', async () => {
    const root = mount();
    await enhance(root);
    const { blocks } = ctxOf(root);
    expect(blocks.map((b) => b.kind)).toEqual(['table', 'code']);
    const [table, code] = blocks;
    if (table?.kind !== 'table' || code?.kind !== 'code') throw new Error('unexpected blocks');
    expect(table.el.classList.contains('table-wrapper')).toBe(true);
    expect(table.heads).toEqual(['ID', 'What', 'Status']);
    expect(table.rows).toHaveLength(2);
    expect([table.isIndex, table.glossary, table.tech, table.filter]).toEqual([false, false, false, null]);
    expect(code.el.classList.contains('codehilite')).toBe(true);
    expect(code.pre?.localName).toBe('pre');
    expect(Object.isFrozen(blocks)).toBe(true);
    table.isIndex = true; // a flag is written by its one feature and read by the rest
    expect(ctxOf(root).blocks[0]).toBe(table);
  });

  it('figures: one entry per figure element, in document order', async () => {
    const root = mount(`${DOC}\n\`\`\`mermaid\ngraph LR; C-->D\n\`\`\`\n\n*Figure 2. Another.*\n`);
    await enhance(root);
    const { figures } = ctxOf(root);
    const [f1, f2] = Array.from(root.querySelectorAll('figure')) as HTMLElement[];
    expect(figures.add({ no: '2', caption: 'Another.', figure: f2 as HTMLElement })).toBe(true);
    expect(figures.add({ no: '1', caption: 'A diagram.', figure: f1 as HTMLElement })).toBe(true);
    expect(figures.add({ no: '9', caption: 'again', figure: f1 as HTMLElement })).toBe(false);
    expect(figures.all().map((f) => f.no)).toEqual(['1', '2']);
    expect(figures.of(f1 as HTMLElement)?.caption).toBe('A diagram.');
    expect(() => figures.add({ no: '', caption: '', figure: f1 as HTMLElement })).toThrow(/figure entry/);
  });

  it('the plan: empty until published, published once', async () => {
    const root = mount();
    await enhance(root);
    const { plan } = ctxOf(root);
    expect([plan.tasks, plan.steps, plan.yours, plan.outlineable, plan.published]).toEqual([[], [], 0, false, false]);
    const h = child(root, 'h2', '3-plan');
    plan.publish({ tasks: [h], steps: [], yours: 2, outlineable: true });
    expect([plan.tasks, plan.yours, plan.outlineable, plan.published]).toEqual([[h], 2, true, true]);
    expect(() => {
      plan.publish({ tasks: [], steps: [], yours: 0, outlineable: false });
    }).toThrow(/once/);
  });

  it('the page: editorial publishes the byline, the waiting items and their box', async () => {
    const root = mount();
    await enhance(root);
    const { page } = ctxOf(root);
    expect(page.published).toBe(true);
    expect(page.byline?.classList.contains('byline')).toBe(true);
    expect(page.waitBox?.classList.contains('waiting')).toBe(true);
    expect(page.waiting.map((li) => li.textContent)).toEqual(['First item', 'Second item']);
    expect(page.facts.panel).toBeNull(); // no front matter given
    expect(page.facts.take('tags')).toBeNull();
    expect(page.facts.summary(document.createElement('span'))).toBe(false);
    expect(() => {
      page.publish({ byline: null, facts: page.facts, waiting: [], waitBox: null });
    }).toThrow(/once/);
  });
});

describe('page.facts: the facts panel as a seam', () => {
  /** The summary's text, with its separators. */
  const summaryText = (root: Element): string => find(root, 'details.doc-facts > summary').textContent ?? '';

  it('take() drops a key\'s dt, dd and summary part and returns its values; summary() and block() go first', async () => {
    const root = mount();
    let seen: { taken: readonly string[] | null; before: string } | null = null;
    probe((ctx) => {
      const before = summaryText(ctx.root);
      const taken = ctx.page.facts.take('rules');
      const doc = ctx.root.ownerDocument;
      expect(ctx.page.facts.summary(chrome(doc, 'span', { className: 'fs-k', text: 'Rules index · 2 rules' }))).toBe(true);
      expect(ctx.page.facts.summary(chrome(doc, 'span', { className: 'cnt ok', text: '2 agreed' }))).toBe(true);
      expect(ctx.page.facts.block(chrome(doc, 'ol', { className: 'probe-rules' }))).toBe(true);
      seen = { taken, before };
    });
    await enhance(root, { info: { title: 'Example spec', frontList: FRONT } });
    expect(seen).toEqual({ taken: ['AB-ONE', 'AB-TWO'], before: '2 rules · 2 tags' });
    expect(summaryText(root)).toBe('Rules index · 2 rules · 2 agreed · 2 tags');
    const body = find(root, '.facts-body');
    expect(Array.from(body.children).map((c) => c.localName)).toEqual(['ol', 'dl']);
    expect(Array.from(find(body, 'dl').children).map((c) => c.textContent)).toEqual(['tags', 'example, demo']);
    expect(ctxOf(root).page.facts.take('rules')).toBeNull(); // taken already
    expect(ctxOf(root).page.facts.take('type')).toBeNull(); // not a list key
    expect(Object.isFrozen(seen === null ? null : (seen as { taken: unknown }).taken)).toBe(true);
  });

  it('taking every key leaves no list; destroy removes the panel and what the plugin put in it', async () => {
    const root = mount();
    probe((ctx) => {
      ctx.page.facts.take('rules');
      ctx.page.facts.take('tags');
      ctx.page.facts.block(chrome(ctx.root.ownerDocument, 'ol'));
    });
    const html = root.innerHTML;
    await enhance(root, { info: { title: 'Example spec', frontList: FRONT } });
    const body = find(root, '.facts-body');
    expect(Array.from(body.children).map((c) => c.localName)).toEqual(['ol']);
    expect(summaryText(root)).toBe('');
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(html);
  });
});

describe('events', () => {
  it('listeners run in order with the payload; a cancel stops one; an unknown name is refused', async () => {
    const root = mount();
    await enhance(root);
    const { events } = ctxOf(root);
    const got: string[] = [];
    events.on('spy', (p) => got.push(`a:${String(p.section?.id)}`));
    const stop = events.on('spy', () => got.push('b'));
    events.on('marks', () => got.push('marks'));
    events.emit('spy', { section: child(root, 'h2', '1-scope'), unit: null });
    stop();
    events.emit('spy', { section: null, unit: null });
    expect(got).toEqual(['a:1-scope', 'b', 'a:undefined']);
    expect(() => events.on('nope' as 'spy', () => undefined)).toThrow(/events.on/);
    expect(EVENT_NAMES).toEqual(['prefs', 'relayout', 'spy', 'marks', 'changes', 'reveal']);
  });

  it('a throwing listener does not stop the next; the first throw is thrown again after all ran', async () => {
    const root = mount();
    await enhance(root);
    const { events } = ctxOf(root);
    const got: string[] = [];
    events.on('changes', () => {
      throw new Error('first');
    });
    events.on('changes', () => {
      got.push('second');
      throw new Error('second');
    });
    events.on('changes', () => got.push('third'));
    expect(() => {
      events.emit('changes', { sections: [] });
    }).toThrow('first');
    expect(got).toEqual(['second', 'third']);
  });

  it('a listener that destroys the instance stops the rest; nothing is emitted or heard after destroy', async () => {
    const root = mount();
    await enhance(root);
    const { events } = ctxOf(root);
    const got: string[] = [];
    events.on('reveal', () => {
      got.push('one');
      void destroyEnhancement(root);
    });
    events.on('reveal', () => got.push('two'));
    events.emit('reveal', { target: root });
    events.emit('reveal', { target: root });
    events.on('reveal', () => got.push('late'));
    events.emit('reveal', { target: root });
    expect(got).toEqual(['one']);
  });
});

describe('reveal', () => {
  it('opens every closed details around the target (undone by destroy), runs the revealers in order, then emits', async () => {
    const root = mount();
    await enhance(root, { folds: false });
    const ctx = ctxOf(root);
    const details = find(root, 'details');
    const inner = find(details, 'p');
    const got: string[] = [];
    ctx.onReveal((el) => got.push(`a:${el.localName}`));
    const stop = ctx.onReveal(() => got.push('b'));
    ctx.events.on('reveal', (p) => got.push(`event:${p.target.localName}`));
    ctx.reveal(inner);
    expect(details.hasAttribute('open')).toBe(true);
    expect(got).toEqual(['a:p', 'b', 'event:p']);
    stop();
    ctx.reveal(inner);
    expect(got.slice(3)).toEqual(['a:p', 'event:p']);
    await destroyEnhancement(root);
    expect(details.hasAttribute('open')).toBe(false);
  });

  it('a revealer that destroys the instance stops the rest; reveal after destroy does nothing', async () => {
    const root = mount();
    await enhance(root, { folds: false });
    const ctx = ctxOf(root);
    const got: string[] = [];
    ctx.onReveal(() => {
      got.push('one');
      void destroyEnhancement(root);
    });
    ctx.onReveal(() => got.push('two'));
    ctx.events.on('reveal', () => got.push('event'));
    ctx.reveal(child(root, 'h2', '2-design'));
    ctx.reveal(find(root, 'details p'));
    expect(got).toEqual(['one']);
    expect(find(root, 'details').hasAttribute('open')).toBe(false);
  });

  it('folds register a revealer: revealing a block of a folded section unfolds it', async () => {
    const root = mount();
    await enhance(root, { storageKey: 'k', storage: { snapshot: { [docKey('k', 'folds')]: '["2-design"]' } } });
    const ctx = ctxOf(root);
    const h = child(root, 'h2', '2-design');
    expect(h.classList.contains('folded')).toBe(true);
    ctx.reveal(find(root, '.codehilite'));
    expect(h.classList.contains('folded')).toBe(false);
    expect(find(root, '.codehilite').hasAttribute('hidden')).toBe(false);
  });
});

describe('overlays: the Escape order', () => {
  /** Register every kind as open; each close records itself and closes it. */
  function openAll(ctx: FeatureContext, kinds: readonly OverlayKind[]): string[] {
    const closed: string[] = [];
    for (const kind of kinds) {
      let open = true;
      ctx.overlays.register(kind, {
        isOpen: () => open,
        close: () => {
          open = false;
          closed.push(kind);
        },
      });
    }
    return closed;
  }

  it('Escape closes figure, keys, jump, settings, changes menu, drawer, card, one per press, in that order', async () => {
    const root = mount();
    await enhance(root);
    const ctx = ctxOf(root);
    expect(OVERLAY_ORDER).toEqual(['figure', 'keys', 'jump', 'settings', 'changes', 'drawer', 'card']);
    const closed = openAll(ctx, [...OVERLAY_ORDER].reverse());
    const tops: (string | null)[] = [];
    for (let i = 0; i < OVERLAY_ORDER.length + 1; i += 1) {
      tops.push(ctx.overlays.top());
      key(child(root, 'h2', '1-scope'), 'Escape');
    }
    expect(closed).toEqual([...OVERLAY_ORDER]);
    expect(tops).toEqual([...OVERLAY_ORDER, null]);
  });

  it('any() counts every overlay but the card; close(kind) closes that one; a kind registers once', async () => {
    const root = mount();
    await enhance(root);
    const ctx = ctxOf(root);
    const closed = openAll(ctx, ['card', 'drawer']);
    expect([ctx.overlays.any(), ctx.overlays.top(), ctx.overlays.isOpen('drawer')]).toEqual([true, 'drawer', true]);
    expect(ctx.overlays.close('drawer')).toBe(true);
    expect(ctx.overlays.close('drawer')).toBe(false);
    expect([ctx.overlays.any(), ctx.overlays.top()]).toEqual([false, 'card']);
    expect(ctx.overlays.close()).toBe(true);
    expect(closed).toEqual(['drawer', 'card']);
    expect(() => ctx.overlays.register('card', { isOpen: () => false, close: () => undefined })).toThrow(/once/);
    expect(() => ctx.overlays.register('popup' as OverlayKind, { isOpen: () => false, close: () => undefined })).toThrow(/overlay/);
  });
});

describe('keys: the keyboard layer', () => {
  /** Bind `k` on the root, recording each run. */
  function bindRecorded(ctx: FeatureContext, k: string, got: string[], when?: () => boolean): void {
    ctx.keys.bind({ key: k, label: `key ${k}`, ...(when === undefined ? {} : { when }), run: () => void got.push(`${ctx.root.dataset['name'] ?? ''}:${k}`) });
  }

  it('a key runs its binding and prevents the default; editable targets, modifiers and keyboard: false are ignored', async () => {
    const root = mount();
    root.append(document.createElement('input'), document.createElement('textarea'), document.createElement('select'));
    await enhance(root);
    const ctx = ctxOf(root);
    const got: string[] = [];
    bindRecorded(ctx, 'j', got);
    bindRecorded(ctx, '?', got);
    const h = child(root, 'h2', '1-scope');
    expect(key(h, 'j').defaultPrevented).toBe(true);
    expect(key(h, '?', { shiftKey: true }).defaultPrevented).toBe(true);
    for (const mod of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) expect(key(h, 'j', mod).defaultPrevented).toBe(false);
    for (const tag of ['input', 'textarea', 'select']) expect(key(find(root, tag), 'j').defaultPrevented).toBe(false);
    const edit = document.createElement('div');
    Object.defineProperty(edit, 'isContentEditable', { value: true });
    root.append(edit);
    expect(key(edit, 'j').defaultPrevented).toBe(false);
    const pre = new KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true });
    pre.preventDefault();
    h.dispatchEvent(pre);
    expect(got).toEqual([':j', ':?']);

    const off = mount();
    await enhance(off, { keyboard: false });
    const offGot: string[] = [];
    bindRecorded(ctxOf(off), 'j', offGot);
    expect(key(child(off, 'h2', '1-scope'), 'j').defaultPrevented).toBe(false);
    expect(offGot).toEqual([]);
  });

  it('Ctrl or Cmd with K runs the chord, from an input too; never with Alt, nor with keyboard: false', async () => {
    const root = mount();
    root.append(document.createElement('input'));
    await enhance(root);
    const got: string[] = [];
    bindRecorded(ctxOf(root), CHORD, got);
    const h = child(root, 'h2', '1-scope');
    expect(key(h, 'k', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(key(h, 'K', { metaKey: true, shiftKey: true }).defaultPrevented).toBe(true);
    expect(key(find(root, 'input'), 'k', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(key(h, 'k', { ctrlKey: true, altKey: true }).defaultPrevented).toBe(false);
    expect(key(h, 'k').defaultPrevented).toBe(false); // a plain k is not the chord
    expect(got).toEqual([`:${CHORD}`, `:${CHORD}`, `:${CHORD}`]);
    const off = mount();
    await enhance(off, { keyboard: false });
    const offGot: string[] = [];
    bindRecorded(ctxOf(off), CHORD, offGot);
    expect(key(child(off, 'h2', '1-scope'), 'k', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(offGot).toEqual([]);
  });

  it('an open overlay stops every key but Escape, which closes it, keyboard: false or not', async () => {
    for (const keyboard of [true, false]) {
      const root = mount();
      await enhance(root, { keyboard });
      const ctx = ctxOf(root);
      const got: string[] = [];
      bindRecorded(ctx, 'j', got);
      bindRecorded(ctx, CHORD, got);
      let open = true;
      ctx.overlays.register('jump', {
        isOpen: () => open,
        close: () => {
          open = false;
        },
      });
      const h = child(root, 'h2', '1-scope');
      expect(key(h, 'j').defaultPrevented).toBe(false);
      expect(key(h, 'k', { ctrlKey: true }).defaultPrevented).toBe(false);
      key(h, 'Escape');
      expect(open).toBe(false);
      key(h, 'j');
      expect(got).toEqual(keyboard ? [':j'] : []);
    }
  });

  it('when() decides whether a key applies; run() returning false leaves the default; bindings() lists what applies, in the sheet\'s order', async () => {
    const root = mount();
    await enhance(root);
    const ctx = ctxOf(root);
    let waiting = false;
    const got: string[] = [];
    bindRecorded(ctx, 'o', got);
    bindRecorded(ctx, 'w', got, () => waiting);
    ctx.keys.bind({ key: 'x', label: 'later key', run: () => undefined });
    ctx.keys.bind({ key: 'n', label: 'nothing to step', run: () => false });
    ctx.keys.bind({ key: CHORD, label: 'jump', listed: false, run: () => undefined });
    bindRecorded(ctx, '/', got);
    bindRecorded(ctx, 'j', got);
    const h = child(root, 'h2', '1-scope');
    expect(key(h, 'w').defaultPrevented).toBe(false);
    expect(key(h, 'n').defaultPrevented).toBe(false);
    expect(ctx.keys.bindings().map((b) => b.key)).toEqual(['/', 'j', 'n', 'o', 'x']);
    waiting = true;
    expect(key(h, 'w').defaultPrevented).toBe(true);
    expect(ctx.keys.bindings().map((b) => b.key)).toEqual(['/', 'j', 'w', 'n', 'o', 'x']);
    expect(ctx.keys.bindings()[0]).toEqual({ key: '/', label: 'key /' });
    expect(got).toEqual([':w']);
    expect(SHEET_ORDER).toEqual(['/', 'j', 'k', 'w', 'i', 'n', 'p', 'm', 'o', '?']);
    expect(() => ctx.keys.bind({ key: 'o', label: 'again', run: () => undefined })).toThrow(/bound/);
    expect(() => ctx.keys.bind({ key: '', label: 'none', run: () => undefined })).toThrow(/key/);
  });

  it('RF2: a key goes to the root holding its target; on the body only to a sole live root; Escape closes only its root\'s overlay', async () => {
    const a = mount();
    a.dataset['name'] = 'a';
    await enhance(a);
    const got: string[] = [];
    bindRecorded(ctxOf(a), 'j', got);
    key(document.body, 'j');
    expect(got).toEqual(['a:j']); // the document's sole live root
    const b = mount();
    b.dataset['name'] = 'b';
    await enhance(b);
    bindRecorded(ctxOf(b), 'j', got);
    key(document.body, 'j'); // two live roots: the body's key goes to neither
    key(child(b, 'h2', '1-scope'), 'j');
    key(child(a, 'h2', '2-design'), 'j');
    const outside = document.createElement('p');
    document.body.append(outside);
    key(outside, 'j'); // host content outside both roots
    expect(got).toEqual(['a:j', 'b:j', 'a:j']);
    const closed: string[] = [];
    for (const [root, name] of [[a, 'a'], [b, 'b']] as const) {
      let open = true;
      ctxOf(root).overlays.register('keys', {
        isOpen: () => open,
        close: () => {
          open = false;
          closed.push(name);
        },
      });
    }
    key(child(b, 'h2', '3-plan'), 'Escape');
    expect(closed).toEqual(['b']);
    await destroyEnhancement(b);
    key(document.body, 'Escape'); // sole live root again
    expect(closed).toEqual(['b', 'a']);
  });

  it('one keydown listener per document, removed once its last root is torn down', async () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const a = mount();
    const b = mount();
    await Promise.all([enhance(a), enhance(b)]);
    expect(add.mock.calls.filter(([t]) => t === 'keydown')).toHaveLength(1);
    await destroyEnhancement(a);
    expect(remove.mock.calls.filter(([t]) => t === 'keydown')).toHaveLength(0);
    await destroyEnhancement(b);
    expect(remove.mock.calls.filter(([t]) => t === 'keydown')).toHaveLength(1);
    const c = mount();
    await enhance(c);
    expect(add.mock.calls.filter(([t]) => t === 'keydown')).toHaveLength(2);
  });

  it('a binding\'s run is an operation: a destroy it asks for waits for it; no key reaches a destroyed root', async () => {
    const root = mount();
    await enhance(root);
    const ctx = ctxOf(root);
    const got: string[] = [];
    ctx.keys.bind({
      key: 'j',
      label: 'j',
      run: () => {
        void destroyEnhancement(root);
        got.push(`live:${String(ctx.live())}`, `marked:${String(root.hasAttribute('data-docreader-root'))}`);
      },
    });
    key(child(root, 'h2', '1-scope'), 'j');
    expect(got).toEqual(['live:false', 'marked:true']);
    expect(root.hasAttribute('data-docreader-root')).toBe(false);
    key(child(root, 'h2', '1-scope'), 'j');
    expect(got).toHaveLength(2);
    expect(ctx.keys.bind({ key: 'q', label: 'q', run: () => undefined })()).toBeUndefined();
  });
});

describe('nav: byId, idOf, goTo and the delegated click', () => {
  it('byId finds the document\'s ids by a walk, never chrome\'s, then the index (LD6); RF1 names are no lookups', async () => {
    const root = mount();
    await enhance(root);
    const ctx = ctxOf(root);
    expect(ctx.nav.byId('2-design')).toBe(child(root, 'h2', '2-design'));
    const chromeEl = chrome(document, 'span');
    chromeEl.id = ctx.chromeId('probe');
    root.append(chromeEl);
    expect(ctx.nav.byId(chromeEl.id)).toBeNull();
    const late = document.createElement('p');
    late.id = 'late';
    root.append(late);
    expect(ctx.nav.byId('late')).toBeNull(); // the document's ids are those it had when enhanced
    ctx.index.define(rowEntry(root, 'R1', 0));
    expect(ctx.nav.byId('R1')).toBe(root.querySelectorAll('tbody tr')[0]);
    ctx.index.define(rowEntry(root, '3-plan', 1));
    expect(ctx.nav.byId('3-plan')).toBe(child(root, 'h2', '3-plan')); // a document id wins over a defined ID
    for (const id of ['__proto__', 'constructor', 'toString', 'jump', 'keys', '']) expect(ctx.nav.byId(id)).toBeNull();
  });

  it('idOf: an element\'s own id, else the ID it defines, else null', async () => {
    const root = mount();
    await enhance(root);
    const ctx = ctxOf(root);
    const e = rowEntry(root, 'R1', 0);
    ctx.index.define(e);
    expect(ctx.nav.idOf(child(root, 'h2', '1-scope'))).toBe('1-scope');
    expect(ctx.nav.idOf(e.target)).toBe('R1');
    expect(ctx.nav.idOf(find(root, 'details p'))).toBeNull();
  });

  it('a hash link: reveal, focus (a journaled tabindex), onHash with push; a missing id or a modified click is left alone', async () => {
    const onHash = vi.fn();
    const root = mount();
    await enhance(root, { onHash, storageKey: 'k', storage: { snapshot: { [docKey('k', 'folds')]: '["2-design"]' } } });
    const ctx = ctxOf(root);
    const design = child(root, 'h2', '2-design');
    const row = root.querySelectorAll('tbody tr')[0] as HTMLElement;
    ctx.index.define(rowEntry(root, 'R1', 0));
    const link = find(root, 'a[href="#R1"]');
    expect(click(link, { ctrlKey: true }).prevented).toBe(false);
    expect(onHash).not.toHaveBeenCalled();
    expect(design.classList.contains('folded')).toBe(true);
    expect(click(link).prevented).toBe(true);
    expect(design.classList.contains('folded')).toBe(false); // the row's section unfolded
    expect(document.activeElement).toBe(row);
    expect(row.getAttribute('tabindex')).toBe('-1');
    expect(onHash.mock.calls).toEqual([['R1', { push: true, from: null }]]);
    expect(Object.isFrozen(onHash.mock.calls[0]?.[1])).toBe(true);
    const toHeading = find(root, 'a[href="#3-plan"]');
    expect(click(toHeading).prevented).toBe(true);
    expect(find(root, 'details').hasAttribute('open')).toBe(false); // the target is outside the details the link sits in
    expect(document.activeElement).toBe(child(root, 'h2', '3-plan'));
    expect(click(find(root, 'a[href="#nowhere"]')).prevented).toBe(false);
    expect(onHash).toHaveBeenCalledTimes(2);
    await destroyEnhancement(root);
    expect(row.hasAttribute('tabindex')).toBe(false);
  });

  it('another link goes to onLink when the host gave one (newTab with a modifier); otherwise the browser follows it', async () => {
    const onLink = vi.fn();
    const root = mount();
    await enhance(root, { onLink });
    const sibling = find(root, 'a[href="other.md"]');
    expect(click(sibling).prevented).toBe(true);
    expect(click(sibling, { metaKey: true }).prevented).toBe(true);
    expect(click(sibling, { ctrlKey: true }).prevented).toBe(true);
    expect(click(sibling, { shiftKey: true }).prevented).toBe(true);
    expect(onLink.mock.calls).toEqual([
      ['other.md', { newTab: false }],
      ['other.md', { newTab: true }],
      ['other.md', { newTab: true }],
      ['other.md', { newTab: true }],
    ]);
    expect(click(sibling, { button: 1 }).prevented).toBe(false); // not the main button
    expect(onLink).toHaveBeenCalledTimes(4);
    const plain = mount();
    await enhance(plain);
    expect(click(find(plain, 'a[href="other.md"]')).prevented).toBe(false);
  });

  it('a click its own handler prevented is left alone; goTo after destroy does nothing', async () => {
    const onHash = vi.fn();
    const root = mount();
    await enhance(root, { onHash });
    const link = find(root, 'a[href="#2-design"]');
    link.addEventListener('click', (e) => {
      e.preventDefault();
    });
    click(link);
    expect(onHash).not.toHaveBeenCalled();
    const ctx = ctxOf(root);
    await destroyEnhancement(root);
    ctx.nav.goTo(child(root, 'h2', '2-design'));
    expect(onHash).not.toHaveBeenCalled();
    expect(child(root, 'h2', '2-design').hasAttribute('tabindex')).toBe(false);
  });

  it('goTo holds the bar, focuses only when asked, and scrolls the target into view where it can', async () => {
    const onHash = vi.fn();
    const root = mount();
    await enhance(root, { onHash });
    const ctx = ctxOf(root);
    const h = child(root, 'h2', '2-design');
    const scrolled: unknown[] = [];
    (h as unknown as { scrollIntoView: (o: unknown) => void }).scrollIntoView = (o) => scrolled.push(o);
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    expect(ctx.position.barHeld()).toBe(false);
    ctx.nav.goTo(h, { push: false, focus: false });
    expect(ctx.position.barHeld()).toBe(true);
    now.mockReturnValue(1_000_000 + BAR_HOLD_MS - 1);
    expect(ctx.position.barHeld()).toBe(true);
    now.mockReturnValue(1_000_000 + BAR_HOLD_MS);
    expect(ctx.position.barHeld()).toBe(false);
    expect(scrolled).toHaveLength(1);
    expect(document.activeElement).not.toBe(h);
    expect(onHash.mock.calls).toEqual([['2-design', { push: false, from: null }]]);
    expect(ctx.position.keep(() => 7)).toBe(7);
  });
});

describe('relayout', () => {
  it('requests in one frame run once, with every reason, then emit relayout', async () => {
    const root = mount();
    await enhance(root);
    await frames();
    const ctx = ctxOf(root);
    const runs: RelayoutReason[][] = [];
    ctx.onRelayout((reasons) => runs.push([...reasons].sort()));
    const events: string[][] = [];
    ctx.events.on('relayout', (p) => events.push([...p.reasons].sort()));
    ctx.relayout('folds');
    ctx.relayout('outline');
    ctx.relayout('folds');
    expect(runs).toEqual([]);
    await frames();
    expect(runs).toEqual([['folds', 'outline']]);
    expect(events).toEqual([['folds', 'outline']]);
  });

  it('a run calls its listeners inside position.keep, and a fonts wait that runs out asks for none (a fake window)', async () => {
    const frameQueue: (() => void)[] = [];
    let fontsDone: (loaded: boolean) => void = () => undefined;
    const env = {
      frame: (fn: () => void) => {
        frameQueue.push(fn);
        return () => undefined;
      },
      timeout: () => () => undefined,
      onResize: () => () => undefined,
      fonts: () =>
        new Promise<boolean>((r) => {
          fontsDone = r;
        }),
    } as unknown as Env;
    const order: string[] = [];
    const position: Position = {
      keep: <T>(fn: () => T): T => {
        order.push('keep:in');
        const v = fn();
        order.push('keep:out');
        return v;
      },
      holdBar: () => undefined,
      barHeld: () => false,
    };
    const events = createEvents(() => true);
    events.on('relayout', () => order.push('event'));
    const rl = createRelayout({ env, events, position, live: () => true });
    rl.onRelayout(() => order.push('listener'));
    rl.relayout('content');
    expect(frameQueue).toHaveLength(1);
    frameQueue.shift()?.();
    expect(order).toEqual(['keep:in', 'listener', 'keep:out', 'event']);
    fontsDone(false);
    await flush();
    expect(frameQueue).toHaveLength(0);
  });

  it('startup asks for one relayout of its own (start)', async () => {
    const root = mount();
    const runs: RelayoutReason[][] = [];
    probe((ctx) => {
      ctx.onRelayout((r) => runs.push([...r]));
    });
    await enhance(root);
    await frames();
    expect(runs).toEqual([['start']]);
  });

  it('a resize is debounced: a burst is one relayout', async () => {
    const root = mount();
    await enhance(root);
    await frames();
    const runs: RelayoutReason[][] = [];
    ctxOf(root).onRelayout((r) => runs.push([...r]));
    for (let i = 0; i < 5; i += 1) window.dispatchEvent(new Event('resize'));
    await wait(RESIZE_DEBOUNCE_MS / 2);
    window.dispatchEvent(new Event('resize'));
    await frames();
    expect(runs).toEqual([]);
    await wait(RESIZE_DEBOUNCE_MS + 60);
    expect(runs).toEqual([['resize']]);
  });

  it('a late fonts promise triggers one relayout; one that settles after destroy, none', async () => {
    let loaded: () => void = () => undefined;
    const pending = new Promise<unknown[]>((r) => {
      loaded = () => r([{ status: 'loaded' }]);
    });
    const load = vi.fn(() => pending);
    Object.defineProperty(document, 'fonts', { configurable: true, value: { load } });
    const root = mount();
    await enhance(root);
    await frames();
    const runs: RelayoutReason[][] = [];
    ctxOf(root).onRelayout((r) => runs.push([...r]));
    expect(load).toHaveBeenCalledTimes(2); // both faces, once
    loaded();
    await flush();
    await frames();
    expect(runs).toEqual([['fonts']]);

    let late: () => void = () => undefined;
    const second = new Promise<unknown[]>((r) => {
      late = () => r([{ status: 'loaded' }]);
    });
    Object.defineProperty(document, 'fonts', { configurable: true, value: { load: () => second } });
    const gone = mount();
    await enhance(gone);
    await frames();
    const goneRuns: RelayoutReason[][] = [];
    ctxOf(gone).onRelayout((r) => goneRuns.push([...r]));
    await destroyEnhancement(gone);
    late();
    await flush();
    await frames();
    expect(goneRuns).toEqual([]);
  });

  it('the fonts wait is bounded, and a wait that runs out asks for no relayout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    const timeouts = vi.spyOn(window, 'setTimeout');
    Object.defineProperty(document, 'fonts', { configurable: true, value: { load: () => new Promise(() => undefined) } });
    const root = mount();
    const runs: RelayoutReason[][] = [];
    probe((ctx) => {
      ctx.onRelayout((r) => runs.push([...r]));
    });
    await enhance(root);
    expect(timeouts.mock.calls.some(([, ms]) => ms === FONTS_WAIT_MS)).toBe(true);
    expect(FONTS_WAIT_MS).toBe(10_000);
    await vi.advanceTimersByTimeAsync(FONTS_WAIT_MS - 100);
    expect(runs).toEqual([['start']]);
    await vi.advanceTimersByTimeAsync(1_000); // the wait ran out
    await vi.advanceTimersByTimeAsync(1_000);
    expect(runs).toEqual([['start']]);
  });

  it('nothing runs after destroy, and onRelayout after destroy hears nothing', async () => {
    const root = mount();
    await enhance(root);
    await frames();
    const ctx = ctxOf(root);
    const runs: string[] = [];
    ctx.onRelayout(() => runs.push('run'));
    ctx.relayout('content');
    await destroyEnhancement(root);
    await frames();
    ctx.relayout('content');
    await frames();
    expect(runs).toEqual([]);
  });
});

describe('headCtl: one .h-ctl per heading, slots in fixed order', () => {
  it('puts each control in its slot\'s place, whatever the call order; labels the heading by its text once', async () => {
    const root = mount();
    const order: string[][] = [];
    probe((ctx) => {
      const h = child(ctx.root, 'h2', '1-scope');
      const ctl = (cls: string): HTMLElement => chrome(ctx.root.ownerDocument, 'button', { className: cls, text: cls });
      const fromFold = ctx.headCtl(h, 'mark', ctl('h-mark'));
      expect(fromFold.classList.contains('h-ctl')).toBe(true);
      expect(ctx.headCtl(h, 'anchor', ctl('h-anchor'))).toBe(fromFold);
      order.push(Array.from(fromFold.children).map((c) => c.className));
      const h3 = find(ctx.root, 'h3');
      ctx.headCtl(h3, 'mark', ctl('h-mark'));
      expect(() => ctx.headCtl(h, 'mark', ctl('h-mark'))).toThrow(/slot/);
      expect(() => ctx.headCtl(h, 'other' as 'mark', ctl('x'))).toThrow(/slot/);
      expect(() => ctx.headCtl(document.createElement('h2'), 'mark', ctl('x'))).toThrow(/heading/);
    });
    await enhance(root);
    const h = child(root, 'h2', '1-scope');
    const ctls = h.querySelectorAll('.h-ctl');
    expect(ctls).toHaveLength(1);
    expect(h.lastElementChild).toBe(ctls[0]);
    expect(order).toEqual([['h-anchor', 'h-mark', 'h-fold']]); // folds, built before the probe, put its control first
    expect(Array.from((ctls[0] as Element).children).map((c) => c.className)).toEqual(['h-anchor', 'h-mark', 'h-fold']);
    expect(HEAD_SLOTS).toEqual(['anchor', 'mark', 'fold']);
    expect(h.getAttribute('aria-label')).toBe('1. Scope');
    const h3 = find(root, 'h3');
    expect(h3.getAttribute('aria-label')).toBe('Agreed');
    expect((h3.lastElementChild as Element).className).toBe('h-ctl');
  });

  it('the label leaves out a chrome button the heading holds already (the plan\'s Outline button), and only that', async () => {
    const root = mount();
    probe((ctx) => {
      const h3 = find(ctx.root, 'h3');
      const doc = ctx.root.ownerDocument;
      ctx.journal.insert(chrome(doc, 'span', { className: 'task-id', text: 'Task 1: ' }), h3, h3.firstChild);
      ctx.journal.insert(chrome(doc, 'button', { className: 'task-open', text: 'Show all' }), h3, null);
      const own = doc.createElement('button');
      own.textContent = 'own';
      h3.append(' ', own); // not chrome: the heading's own (a probe's stand-in)
      ctx.headCtl(h3, 'mark', chrome(doc, 'button', { className: 'h-mark', text: 'Mark read' }));
    });
    await enhance(root);
    expect(find(root, 'h3').getAttribute('aria-label')).toBe('Task 1: Agreed own');
  });

  it('a heading that already has a label keeps it; destroy removes every control and the label', async () => {
    const root = mount();
    const named = find(root, 'h3');
    named.setAttribute('aria-labelledby', 'x');
    const html = root.innerHTML;
    probe((ctx) => {
      ctx.headCtl(named, 'anchor', chrome(ctx.root.ownerDocument, 'a', { className: 'h-anchor' }));
    });
    await enhance(root);
    expect(named.hasAttribute('aria-label')).toBe(false);
    expect(named.querySelector('.h-anchor')).not.toBeNull();
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(html);
  });
});

describe('slots: the bar\'s skeleton', () => {
  it('with chrome.bar (the default): a skip link, then the bar (running head, tools), then the progress, ahead of the document', async () => {
    const root = mount();
    await enhance(root);
    const { slots } = ctxOf(root);
    if (slots === null) throw new Error('no slots');
    const [skip, bar, progress, next] = Array.from(root.children);
    expect(skip).toBe(slots.skip);
    expect(bar).toBe(slots.bar);
    expect(progress).toBe(slots.progress);
    expect(next?.localName).toBe('div'); // the eyebrow, the document's first block
    expect([skip?.localName, skip?.className, skip?.textContent, skip?.getAttribute('href')]).toEqual(['a', 'skip-link', 'Skip to the text', '#']);
    expect([bar?.localName, bar?.className]).toEqual(['nav', 'topbar']);
    const inner = bar?.firstElementChild;
    expect(inner?.className).toBe('topbar-inner');
    expect(Array.from(inner?.children ?? []).map((c) => c.className)).toEqual(['running-head', 'bar-tools']);
    expect(slots.running.getAttribute('aria-hidden')).toBe('true');
    expect(slots.tools.className).toBe('bar-tools');
    expect(progress?.className).toBe('doc-progress');
    for (const el of [skip, bar, inner, slots.running, slots.tools, progress]) expect(el?.hasAttribute(CHROME_ATTR)).toBe(true);
  });

  it('none of it without chrome.bar; no skip link for what is not a document', async () => {
    const root = mount();
    const html = root.innerHTML;
    await enhance(root, { chrome: { bar: false } });
    expect(ctxOf(root).slots).toBeNull();
    expect(root.querySelector('.topbar, .skip-link, .doc-progress, .bar-tools')).toBeNull();
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(html);
    const note = mount('Just a note.\n');
    await enhance(note);
    const { slots } = ctxOf(note);
    expect(slots?.skip).toBeNull();
    expect(Array.from(note.children).map((c) => c.className)).toEqual(['topbar', 'doc-progress', '']);
  });

  it('tool() keeps the tray in a fixed order (changes, outline, jump, settings, contents), whatever the call order', async () => {
    const root = mount();
    probe((ctx) => {
      const order: ToolKind[] = ['contents', 'jump', 'changes', 'settings', 'outline'];
      for (const kind of order) ctx.slots?.tool(kind, chrome(ctx.root.ownerDocument, 'button', { text: kind }));
      expect(() => ctx.slots?.tool('jump', chrome(ctx.root.ownerDocument, 'button'))).toThrow(/tool/);
      expect(() => ctx.slots?.tool('other' as ToolKind, chrome(ctx.root.ownerDocument, 'button'))).toThrow(/tool/);
    });
    await enhance(root);
    expect(TOOL_ORDER).toEqual(['changes', 'outline', 'jump', 'settings', 'contents']);
    expect(Array.from(find(root, '.bar-tools').children).map((c) => c.textContent)).toEqual([...TOOL_ORDER]);
  });

  it('the skip link focuses the document\'s first node past the skeleton (a journaled tabindex), never the root, and makes no hash', async () => {
    const onHash = vi.fn();
    const root = mount();
    await enhance(root, { onHash });
    const h1 = child(root, 'h1', 'example-spec');
    const scrolled: unknown[] = [];
    Object.defineProperty(h1, 'scrollIntoView', { configurable: true, value: (how: unknown) => scrolled.push(how) });
    expect(click(find(root, '.skip-link')).prevented).toBe(true);
    expect(scrolled).toEqual([{ block: 'start' }]);
    delete (h1 as { scrollIntoView?: unknown }).scrollIntoView;
    expect(document.activeElement).toBe(h1);
    expect(h1.getAttribute('tabindex')).toBe('-1');
    expect(root.hasAttribute('tabindex')).toBe(false);
    expect(onHash).not.toHaveBeenCalled();
    await destroyEnhancement(root);
    expect(h1.hasAttribute('tabindex')).toBe(false);
  });
});

describe('folds: the members API', () => {
  const opts = (stored: string[] = []): EnhanceOptions => {
    const set = vi.fn();
    const storage: ReaderStorage = { snapshot: { [docKey('k', 'folds')]: JSON.stringify(stored) }, set };
    return { storageKey: 'k', storage };
  };

  it('headings(), isFolded(), sectionOf(); setAll() folds every section with one write and one relayout', async () => {
    const root = mount();
    const o = opts();
    await enhance(root, o);
    await frames();
    const ctx = ctxOf(root);
    const set = o.storage?.set as ReturnType<typeof vi.fn>;
    const runs: RelayoutReason[][] = [];
    ctx.onRelayout((r) => runs.push([...r]));
    expect(ctx.folds.headings().map((h) => h.id)).toEqual(['1-scope', '2-design', '3-plan', 'where-things-stand']);
    expect(ctx.folds.sectionOf(find(root, '.codehilite'))).toBe(child(root, 'h2', '2-design'));
    expect(ctx.folds.sectionOf(find(root, '.codehilite pre'))).toBe(child(root, 'h2', '2-design'));
    expect(ctx.folds.sectionOf(child(root, 'h1', 'example-spec'))).toBeNull();
    ctx.folds.setAll(true);
    expect(ctx.folds.headings().every((h) => ctx.folds.isFolded(h))).toBe(true);
    expect(set.mock.calls).toEqual([[docKey('k', 'folds'), '["1-scope","2-design","3-plan","where-things-stand"]']]);
    await frames();
    expect(runs).toEqual([['folds']]);
    ctx.folds.setFold(child(root, 'h2', '2-design'), false);
    expect(ctx.folds.isFolded(child(root, 'h2', '2-design'))).toBe(false);
    await frames();
    expect(runs).toEqual([['folds'], ['folds']]);
  });

  it('join() adds a block to a member\'s section: hidden with the fold, shown with it, and found by find-in-page', async () => {
    const root = mount();
    await enhance(root, opts(['2-design']));
    const ctx = ctxOf(root);
    const code = find(root, '.codehilite');
    const bar = chrome(document, 'div', { className: 'peek-bar' });
    ctx.journal.insert(bar, root, code.nextSibling);
    expect(ctx.folds.join(bar, code)).toBe(true);
    expect(bar.getAttribute('hidden')).toBe('until-found');
    ctx.folds.setFold(child(root, 'h2', '2-design'), false);
    expect(bar.hasAttribute('hidden')).toBe(false);
    ctx.folds.setFold(child(root, 'h2', '2-design'), true);
    bar.dispatchEvent(new Event('beforematch'));
    expect(ctx.folds.isFolded(child(root, 'h2', '2-design'))).toBe(false);
    const loose = chrome(document, 'div');
    ctx.journal.insert(loose, root, null);
    expect(ctx.folds.join(loose, child(root, 'h1', 'example-spec'))).toBe(false);
  });

  it('without folds the API answers empty and does nothing', async () => {
    const root = mount();
    await enhance(root, { folds: false });
    const ctx = ctxOf(root);
    expect(ctx.folds.headings()).toEqual([]);
    expect(ctx.folds.sectionOf(find(root, '.codehilite'))).toBeNull();
    ctx.folds.setAll(true);
    expect(root.querySelector('[hidden="until-found"]')).toBeNull();
  });
});

describe('ctx.setPrefs and the prefs event', () => {
  it('applies the prefs to the root, emits prefs, and relayouts for a width, font or lens change', async () => {
    const root = mount();
    await enhance(root);
    await frames();
    const ctx = ctxOf(root);
    const seen: string[] = [];
    const runs: RelayoutReason[][] = [];
    ctx.events.on('prefs', (p) => seen.push(`${p.width}/${p.lens}/${p.theme}`));
    ctx.onRelayout((r) => runs.push([...r].sort()));
    ctx.setPrefs({ width: 'wide' });
    expect(root.getAttribute('data-width')).toBe('wide');
    await frames();
    ctx.setPrefs({ lens: 'product' });
    await frames();
    ctx.setPrefs({ theme: 'dark' });
    await frames();
    ctx.setPrefs({ theme: 'dark' }); // no change: no event
    setEnhancementPrefs(root, { font: 'sans' });
    await frames();
    expect(seen).toEqual(['wide/all/auto', 'wide/product/auto', 'wide/product/dark', 'wide/product/dark']);
    expect(runs).toEqual([['prefs'], ['lens'], ['prefs']]);
    expect(() => {
      ctx.setPrefs({ width: 'huge' as 'wide' });
    }).toThrow();
  });
});

describe('RF3: the large plan (for Tasks 11, 12 and 13)', () => {
  it('holds about 1.5 MB, 2,000 IDs, 300 terms and 1,000 steps in 50 tasks, as rendered; a 2× plan doubles each', () => {
    const plan = largePlan();
    expect(plan.bytes).toBe(plan.markdown.length);
    expect(plan.bytes).toBeGreaterThanOrEqual(LARGE_PLAN_BYTES);
    expect(plan.bytes).toBeLessThan(LARGE_PLAN_BYTES + 4000);
    expect(LARGE_PLAN_COUNTS).toEqual({ ids: 2000, terms: 300, tasks: 50, steps: 1000 });
    const r = render(plan.markdown);
    expect(r.outcome).toBe('rendered');
    const html = r.html;
    const ids = [...html.matchAll(/<tr data-line="[\d-]+">\n<td>(R\d+)<\/td>/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(2000);
    expect(ids).toHaveLength(2000);
    const from = html.indexOf('<h2 id="words-used-here"');
    const glossary = html.slice(from, html.indexOf('<h2', from + 1));
    expect((glossary.match(/<tr data-line=/g) ?? []).length - 1).toBe(300); // less the header row
    expect((html.match(/<li class="task-list-item"/g) ?? []).length).toBe(1000);
    expect((html.match(/<h3 [^>]*>Task \d+: /g) ?? []).length).toBe(50);
    expect((html.match(/<h2 id="/g) ?? []).length).toBe(plan.counts.sections);
    expect(plan.counts).toEqual({ ...LARGE_PLAN_COUNTS, sections: plan.counts.sections });
    expect(plan.counts.sections).toBeGreaterThan(50);
    const double = largePlan(2);
    expect(double.counts).toEqual({ ids: 4000, terms: 600, tasks: 100, steps: 2000, sections: double.counts.sections });
    expect(double.bytes).toBeGreaterThanOrEqual(2 * LARGE_PLAN_BYTES);
    expect(double.markdown.match(/^\| R\d+ \|/gm)).toHaveLength(4000);
    expect(double.markdown.match(/^- \[ \] \*\*Step /gm)).toHaveLength(2000);
    expect(largePlan().markdown).toBe(plan.markdown);
  }, 120_000);
});

describe('registries: refusals, copies and caches', () => {
  it('index: refuses a missing entry, a group that is not text and a target that is not an element; keeps a copy of the heads', async () => {
    const root = mount();
    await enhance(root);
    const { index } = ctxOf(root);
    const ok = rowEntry(root, 'R1', 0);
    expect(() => index.define(null as unknown as IndexEntry)).toThrow(/index\.define/);
    expect(() => index.define({ ...ok, group: 1 } as unknown as IndexEntry)).toThrow(/index entry/);
    expect(() => index.define({ ...ok, target: {} } as unknown as IndexEntry)).toThrow(/index entry/);
    const heads = ['ID', 'What'];
    expect(index.define({ ...ok, heads })).toBe(true);
    heads.push('later');
    expect(index.get('R1')?.heads).toEqual(['ID', 'What']);
    expect(Object.isFrozen(index.get('R1')?.heads)).toBe(true);
  });

  it('index: of() keeps the first entry of a target and finds an entry by its row; all() sees a later definition', async () => {
    const root = mount();
    await enhance(root);
    const { index } = ctxOf(root);
    const rows = Array.from(root.querySelectorAll('tbody tr')) as HTMLTableRowElement[];
    expect(index.define(rowEntry(root, 'R1', 0))).toBe(true);
    expect(index.all().map((e) => e.id)).toEqual(['R1']);
    expect(index.define({ ...rowEntry(root, 'X', 0), id: 'X' })).toBe(true);
    const cell = rows[1]?.cells[0] as HTMLTableCellElement;
    expect(index.define({ ...rowEntry(root, 'R2', 1), target: cell, row: rows[1] as Element })).toBe(true);
    expect(index.of(rows[0] as Element)?.id).toBe('R1');
    expect(index.of(rows[1] as Element)?.id).toBe('R2');
    expect(index.of(cell)?.id).toBe('R2');
    expect(index.all().map((e) => e.id)).toEqual(['R1', 'X', 'R2']);
  });

  it('terms: refuses a missing term, a name too long or blank, exact and section of the wrong type, a target outside, a missing definition', async () => {
    const root = mount();
    await enhance(root);
    const { terms } = ctxOf(root);
    const row = root.querySelector('tbody tr') as Element;
    const ok = { name: 'Read mark', exact: false, section: '', target: row, def: { qual: '', cell: row.lastElementChild as Element, row } };
    const outside = document.createElement('tr');
    for (const bad of [
      null,
      { ...ok, name: 'x'.repeat(201) },
      { ...ok, name: ' \t ' },
      { ...ok, exact: 'yes' },
      { ...ok, section: 1 },
      { ...ok, target: outside },
      { ...ok, def: null },
    ]) {
      expect(() => terms.define(bad as never)).toThrow(/term/);
    }
    expect(terms.all()).toEqual([]);
  });

  it('blocks: a table wrapper with no table, and a code block inside a figure, are left out', async () => {
    const root = mount();
    const empty = document.createElement('div');
    empty.className = 'table-wrapper';
    empty.append(document.createElement('p'));
    root.prepend(empty);
    const code = find(root, '.codehilite');
    const fig = document.createElement('figure');
    code.replaceWith(fig);
    fig.append(code);
    await enhance(root);
    expect(ctxOf(root).blocks.map((b) => b.kind)).toEqual(['table']);
  });

  it('figures: refuses a missing entry, a caption that is not text and a figure outside the root; all() sees a later add', async () => {
    const root = mount();
    await enhance(root);
    const { figures } = ctxOf(root);
    const figure = find(root, 'figure');
    expect(() => figures.add(null as never)).toThrow(/figures\.add/);
    expect(() => figures.add({ no: '1', caption: 2, figure } as never)).toThrow(/figure entry/);
    expect(() => figures.add({ no: '1', caption: '', figure: document.createElement('figure') })).toThrow(/figure entry/);
    expect(figures.all()).toEqual([]);
    figures.add({ no: '1', caption: 'A diagram.', figure });
    expect(figures.all()).toHaveLength(1);
  });

  it('the plan and the page check what they are given, and hold a frozen copy of it', () => {
    const plan = createPlan();
    const h = document.createElement('h3');
    const steps = [document.createElement('li')];
    for (const bad of [
      { tasks: [1], steps: [], yours: 0, outlineable: false },
      { tasks: [], steps: [], yours: -1, outlineable: false },
      { tasks: [], steps: [], yours: 1.5, outlineable: false },
      { tasks: [], steps: [], yours: 0, outlineable: 'yes' },
    ]) {
      expect(() => {
        plan.publish(bad as never);
      }).toThrow(/plan has/);
    }
    plan.publish({ tasks: [h], steps, yours: 1, outlineable: false });
    steps.push(document.createElement('li'));
    expect(plan.steps).toHaveLength(1);
    expect(Object.isFrozen(plan.steps)).toBe(true);
    const page = createPage();
    const facts = page.facts;
    for (const bad of [
      { byline: null, facts: null, waiting: [], waitBox: null },
      { byline: {}, facts, waiting: [], waitBox: null },
      { byline: null, facts, waiting: [], waitBox: 'box' },
      { byline: null, facts, waiting: [2], waitBox: null },
    ]) {
      expect(() => {
        page.publish(bad as never);
      }).toThrow(/page/);
    }
    const waiting = [document.createElement('li')];
    page.publish({ byline: null, facts, waiting, waitBox: null });
    waiting.push(document.createElement('li'));
    expect(page.waiting).toHaveLength(1);
  });
});

describe('events and overlays: the rest of their guards', () => {
  it('events: on() takes a function; a listener that stops itself during an emit does not skip the next', async () => {
    const root = mount();
    await enhance(root);
    const { events } = ctxOf(root);
    expect(() => events.on('spy', 1 as never)).toThrow(/function/);
    const got: string[] = [];
    const stop = events.on('spy', () => {
      got.push('a');
      stop();
    });
    events.on('spy', () => got.push('b'));
    events.emit('spy', { section: null, unit: null });
    events.emit('spy', { section: null, unit: null });
    expect(got).toEqual(['a', 'b', 'b']);
  });

  it('overlays: a handle has isOpen and close; a cancel unregisters; once destroyed nothing registers and nothing closes', async () => {
    const root = mount();
    await enhance(root);
    const { overlays } = ctxOf(root);
    expect(() => overlays.register('card', {} as never)).toThrow(/isOpen and close/);
    const stop = overlays.register('drawer', { isOpen: () => true, close: () => undefined });
    expect(overlays.top()).toBe('drawer');
    stop();
    expect([overlays.top(), overlays.isOpen('drawer')]).toEqual([null, false]);
    let closed = 0;
    overlays.register('keys', {
      isOpen: () => true,
      close: () => {
        closed += 1;
      },
    });
    await destroyEnhancement(root);
    overlays.register('jump', { isOpen: () => true, close: () => undefined });
    expect(overlays.isOpen('jump')).toBe(false);
    expect(overlays.close()).toBe(false);
    expect(closed).toBe(0);
  });
});

describe('keys: the rest of their guards', () => {
  it('a key on the html element or on the document itself goes to the sole live root', async () => {
    const root = mount();
    await enhance(root);
    const got: string[] = [];
    ctxOf(root).keys.bind({ key: 'j', label: 'j', run: () => void got.push('j') });
    key(document.documentElement, 'j');
    key(document, 'j');
    expect(got).toEqual(['j', 'j']);
  });

  it('a root tearing down inside its own key is not live: a page key it dispatches goes to the other, sole live root', async () => {
    const a = mount();
    const b = mount();
    await Promise.all([enhance(a), enhance(b)]);
    const got: string[] = [];
    ctxOf(b).keys.bind({ key: 'q', label: 'q', run: () => void got.push('b:q') });
    ctxOf(a).keys.bind({
      key: 'j',
      label: 'j',
      run: () => {
        void destroyEnhancement(a); // deferred: a's own key is still running
        key(document.body, 'q');
      },
    });
    key(child(a, 'h2', '1-scope'), 'j');
    expect(got).toEqual(['b:q']);
  });

  it('bind() checks the key, label, run, when and listed; once destroyed it binds nothing; its cancel unbinds', async () => {
    const root = mount();
    await enhance(root);
    const ctx = ctxOf(root);
    for (const bad of [
      null,
      { key: 'x'.repeat(33), label: '', run: () => undefined },
      { key: 'x', label: 1, run: () => undefined },
      { key: 'x', label: '', run: 1 },
      { key: 'x', label: '', run: () => undefined, when: true },
      { key: 'x', label: '', run: () => undefined, listed: 'no' },
    ]) {
      expect(() => ctx.keys.bind(bad as never)).toThrow(/bind|key binding/);
    }
    const got: string[] = [];
    const stop = ctx.keys.bind({ key: 'j', label: 'j', run: () => void got.push('j') });
    stop();
    expect(key(child(root, 'h2', '1-scope'), 'j').defaultPrevented).toBe(false);
    expect(ctx.keys.bindings()).toEqual([]);
    await destroyEnhancement(root);
    ctx.keys.bind({ key: 'm', label: 'm', run: () => undefined });
    expect(ctx.keys.bindings()).toEqual([]);
    expect(got).toEqual([]);
  });
});

describe('nav: the rest of its guards', () => {
  it('byId: the first element of a repeated id; never an empty id; an element, or a defined ID\'s target, that left the root is no answer', async () => {
    const root = mount();
    const twin = document.createElement('p');
    twin.id = '2-design';
    root.append(twin);
    const blank = document.createElement('p');
    blank.setAttribute('id', '');
    root.append(blank);
    await enhance(root);
    const ctx = ctxOf(root);
    expect(ctx.nav.byId('2-design')).toBe(child(root, 'h2', '2-design'));
    expect(ctx.nav.byId('')).toBeNull();
    const plan = child(root, 'h2', '3-plan');
    ctx.index.define(rowEntry(root, 'R1', 0));
    const row = root.querySelector('tbody tr') as Element;
    plan.remove();
    row.remove();
    expect(ctx.nav.byId('3-plan')).toBeNull();
    expect(ctx.nav.byId('R1')).toBeNull();
    const chromeEl = chrome(document, 'span');
    chromeEl.id = ctx.chromeId('probe');
    root.append(chromeEl);
    expect(ctx.nav.idOf(chromeEl)).toBeNull();
  });

  it('goTo: push and focus default to true; no onHash without an id; a focusable target gets no tabindex; nothing outside the root', async () => {
    const onHash = vi.fn();
    const root = mount();
    await enhance(root, { onHash });
    const ctx = ctxOf(root);
    const h = child(root, 'h2', '2-design');
    ctx.nav.goTo(h);
    expect(onHash.mock.calls).toEqual([['2-design', { push: true, from: null }]]);
    expect(document.activeElement).toBe(h);
    const p = find(root, 'details p');
    ctx.nav.goTo(p);
    expect(onHash).toHaveBeenCalledTimes(1);
    const link = find(root, 'a[href="#2-design"]');
    ctx.nav.goTo(link);
    expect(document.activeElement).toBe(link);
    expect(link.hasAttribute('tabindex')).toBe(false);
    const outside = document.createElement('p');
    document.body.append(outside);
    ctx.nav.goTo(outside);
    expect(outside.hasAttribute('tabindex')).toBe(false);
    expect(document.activeElement).toBe(link);
  });

  it('goTo does nothing once destroyed, and stops when a revealer destroys the instance', async () => {
    const onHash = vi.fn();
    const root = mount();
    await enhance(root, { onHash });
    const ctx = ctxOf(root);
    const h = child(root, 'h2', '2-design');
    const scrolled: unknown[] = [];
    (h as unknown as { scrollIntoView: (o: unknown) => void }).scrollIntoView = (o) => scrolled.push(o);
    ctx.onReveal(() => {
      void destroyEnhancement(root);
    });
    ctx.nav.goTo(h);
    ctx.nav.goTo(h);
    expect(scrolled).toEqual([]);
    expect(onHash).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(h);
  });

  it('goTo scrolls smoothly unless the reader asked for reduced motion or the target is more than two screens away', async () => {
    const root = mount();
    await enhance(root);
    const ctx = ctxOf(root);
    const h = child(root, 'h2', '2-design');
    const behaviors: string[] = [];
    (h as unknown as { scrollIntoView: (o: { behavior: string }) => void }).scrollIntoView = (o) => behaviors.push(o.behavior);
    ctx.nav.goTo(h, { focus: false });
    const far = vi.spyOn(h, 'getBoundingClientRect').mockReturnValue({ top: window.innerHeight * 2 + 1 } as DOMRect);
    ctx.nav.goTo(h, { focus: false });
    far.mockRestore();
    (window as unknown as { matchMedia: unknown }).matchMedia = (q: string) => ({ matches: q.includes('reduce') });
    try {
      ctx.nav.goTo(h, { focus: false });
    } finally {
      delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    }
    expect(behaviors).toEqual(['smooth', 'auto', 'auto']);
  });

  it('a click under a link around the root is not the root\'s; an encoded id is decoded; a malformed one is no error', async () => {
    const onHash = vi.fn();
    const root = mount('# Title\n\n## Café\n\nGo to [the café](#café).\n\n## Two\n\nText.\n\n## Three\n\nEnd.\n');
    const around = document.createElement('a');
    around.setAttribute('href', '#two');
    root.replaceWith(around);
    around.append(root);
    const bad = document.createElement('a');
    bad.setAttribute('href', '#%E0%A4%A');
    root.append(bad);
    await enhance(root, { onHash });
    expect(click(find(root, 'h2')).prevented).toBe(false);
    const link = find(root, 'p a');
    expect(link.getAttribute('href')).toBe('#caf%C3%A9');
    expect(click(link).prevented).toBe(true);
    expect(onHash.mock.calls).toEqual([['café', { push: true, from: null }]]);
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent): void => {
      errors.push(e.error);
      e.preventDefault();
    };
    window.addEventListener('error', onError);
    expect(click(bad).prevented).toBe(false);
    window.removeEventListener('error', onError);
    expect(errors).toEqual([]);
  });
});

describe('relayout, reveal, headCtl and the bar: the rest of their guards', () => {
  /** A relayout with a window of fakes: frames and timeouts the case runs by hand. */
  function fakeRelayout(live: () => boolean) {
    const frameQueue: (() => void)[] = [];
    const env = {
      frame: (fn: () => void) => {
        frameQueue.push(fn);
        return () => undefined;
      },
      timeout: () => () => undefined,
      onResize: () => () => undefined,
      fonts: () => new Promise<boolean>(() => undefined),
    } as unknown as Env;
    const position: Position = { keep: <T>(fn: () => T): T => fn(), holdBar: () => undefined, barHeld: () => false };
    const events = createEvents(live);
    return { rl: createRelayout({ env, events, position, live }), frameQueue, events };
  }

  it('a listener that throws stops neither the next nor the event, and its throw comes after; one that destroys stops the run', () => {
    let alive = true;
    const { rl, frameQueue, events } = fakeRelayout(() => alive);
    const got: string[] = [];
    rl.onRelayout(() => {
      got.push('one');
      throw new Error('one');
    });
    rl.onRelayout(() => got.push('two'));
    events.on('relayout', () => got.push('event'));
    rl.relayout('content');
    expect(() => frameQueue.shift()?.()).toThrow('one');
    expect(got).toEqual(['one', 'two', 'event']);
    const stopper = fakeRelayout(() => alive);
    stopper.rl.onRelayout(() => {
      alive = false;
    });
    stopper.rl.onRelayout(() => got.push('late'));
    stopper.rl.relayout('content');
    stopper.frameQueue.shift()?.();
    expect(got).toEqual(['one', 'two', 'event']);
  });

  it('onRelayout takes a function, and its cancel stops it', () => {
    const { rl, frameQueue } = fakeRelayout(() => true);
    expect(() => rl.onRelayout(1 as never)).toThrow(/function/);
    const got: string[] = [];
    const stop = rl.onRelayout(() => got.push('run'));
    stop();
    rl.relayout('content');
    frameQueue.shift()?.();
    expect(got).toEqual([]);
  });

  it('reveal: the root itself, or an element outside it, is no target; a details around the root stays closed; a revealer that stops itself does not skip the next', async () => {
    const root = mount();
    const host = document.createElement('details');
    root.replaceWith(host);
    host.append(root);
    await enhance(root, { folds: false });
    const ctx = ctxOf(root);
    const got: string[] = [];
    const stop = ctx.onReveal(() => {
      got.push('a');
      stop();
    });
    ctx.onReveal(() => got.push('b'));
    expect(() => ctx.onReveal(1 as never)).toThrow(/function/);
    ctx.reveal(root);
    ctx.reveal(document.createElement('p'));
    expect(got).toEqual([]);
    ctx.reveal(find(root, ':scope details p')); // :scope, since the host's details matches 'details p' too
    expect(got).toEqual(['a', 'b']);
    expect(host.hasAttribute('open')).toBe(false);
    expect(find(root, 'details').hasAttribute('open')).toBe(true);
  });

  it('headCtl refuses an element that is not a heading', async () => {
    const root = mount();
    await enhance(root);
    expect(() => ctxOf(root).headCtl(find(root, 'p'), 'mark', chrome(document, 'button'))).toThrow(/heading/);
  });

  it('the skip link keeps a tabindex the first node already has; no feature\'s build sees the skeleton', async () => {
    const root = mount();
    child(root, 'h1', 'example-spec').setAttribute('tabindex', '0');
    let seen: string[] = [];
    probe((ctx) => {
      seen = Array.from(ctx.root.children)
        .filter((c) => c.hasAttribute(CHROME_ATTR))
        .map((c) => c.className);
    });
    await enhance(root);
    expect(seen).toContain('byline'); // the probe ran, after every feature
    expect(seen.filter((c) => ['skip-link', 'topbar', 'doc-progress'].includes(c))).toEqual([]);
    expect(root.firstElementChild?.className).toBe('skip-link');
    click(find(root, '.skip-link'));
    expect(child(root, 'h1', 'example-spec').getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(child(root, 'h1', 'example-spec'));
  });
});

describe('folds, the page and the prefs: the rest of their guards', () => {
  it('folds: setAll() with nothing to change writes nothing; join() takes a node once', async () => {
    const set = vi.fn();
    const root = mount();
    await enhance(root, { storageKey: 'k', storage: { set } });
    const ctx = ctxOf(root);
    ctx.folds.setAll(false);
    expect(set).not.toHaveBeenCalled();
    const code = find(root, '.codehilite');
    const bar = chrome(document, 'div');
    ctx.journal.insert(bar, root, code.nextSibling);
    expect(ctx.folds.join(bar, code)).toBe(true);
    expect(ctx.folds.join(bar, find(root, 'figure'))).toBe(false); // a member of another section: joined already
    expect(ctx.folds.sectionOf(bar)).toBe(child(root, 'h2', '2-design'));
  });

  it('the page: the first "Waiting" box alone gives the waiting items', async () => {
    const root = mount(`${DOC}\n### Waiting for review\n\n- Third item\n`);
    await enhance(root);
    const { page } = ctxOf(root);
    expect(page.waiting.map((li) => li.textContent)).toEqual(['First item', 'Second item']);
    expect(page.waitBox?.querySelector('h3')?.textContent).toBe('Waiting on you');
  });

  it('the facts seam takes only new chrome, and nothing once the instance is not live', async () => {
    const root = mount();
    await enhance(root, { info: { title: 'Example spec', frontList: FRONT } });
    const { facts } = ctxOf(root).page;
    const placed = chrome(document, 'span');
    root.append(placed);
    expect(() => facts.summary(placed)).toThrow(/new chrome/);
    expect(() => facts.block(document.createElement('ol'))).toThrow(/new chrome/);
    expect(facts.summary(document.createTextNode('3 more'))).toBe(true);
    await destroyEnhancement(root);
    expect(facts.take('tags')).toBeNull();
    expect(facts.summary(chrome(document, 'span'))).toBe(false);
    expect(facts.block(chrome(document, 'ol'))).toBe(false);
  });

  it('the prefs event carries a frozen copy of the prefs', async () => {
    const root = mount();
    await enhance(root);
    const ctx = ctxOf(root);
    const seen: unknown[] = [];
    ctx.events.on('prefs', (p) => seen.push(p));
    ctx.setPrefs({ width: 'wide' });
    expect(Object.isFrozen(seen[0])).toBe(true);
    expect(seen[0]).not.toBe(ctx.state.prefs);
  });
});

describe('assets/reader.css: the markers later tasks insert at', () => {
  it('holds each of the three markers once', () => {
    const css = readFileSync(path.join(import.meta.dirname, '..', 'assets', 'reader.css'), 'utf8');
    for (const marker of [
      "/* ─── marker: the bar's placement in the root (sticky, with its .scrolled and .bar-hidden states) goes below ─── */",
      "/* ─── marker: the contents rail's placement in the root (a sticky column on a wide screen, a drawer below) goes below ─── */",
      "/* ─── marker: the drawn figure's rules (the plate, and the source while a diagram is drawn) start below ─── */",
    ]) {
      expect(css.split(marker).length - 1, marker).toBe(1);
    }
  });
});

describe('cancels, labels, refusals and sizes: the review round', () => {
  it('a relayout listener\'s cancel, called twice, removes only its own listener', async () => {
    const root = mount();
    await enhance(root);
    await frames();
    const ctx = ctxOf(root);
    const heard: string[] = [];
    const a = ctx.onRelayout(() => heard.push('a'));
    ctx.onRelayout(() => heard.push('b'));
    a();
    a();
    ctx.relayout('content');
    await frames();
    expect(heard).toEqual(['b']);
  });

  it('a revealer\'s cancel, called twice, removes only its own revealer', async () => {
    const root = mount();
    await enhance(root);
    const ctx = ctxOf(root);
    const heard: string[] = [];
    const a = ctx.onReveal(() => heard.push('a'));
    ctx.onReveal(() => heard.push('b'));
    a();
    a();
    ctx.reveal(find(root, '.codehilite'));
    expect(heard).toEqual(['b']);
  });

  it('an event listener\'s cancel, called twice, removes only its own listener', async () => {
    const root = mount();
    await enhance(root);
    const ctx = ctxOf(root);
    const heard: string[] = [];
    const a = ctx.events.on('changes', () => heard.push('a'));
    ctx.events.on('changes', () => heard.push('b'));
    a();
    a();
    ctx.events.emit('changes', { sections: [] });
    expect(heard).toEqual(['b']);
  });

  it('a key binding\'s old cancel leaves the binding made after it', async () => {
    const root = mount();
    await enhance(root);
    const { keys } = ctxOf(root);
    const first = keys.bind({ key: 'x', label: 'first', run: () => undefined });
    first();
    keys.bind({ key: 'x', label: 'second', run: () => undefined });
    first();
    expect(keys.bindings().filter((b) => b.key === 'x').map((b) => b.label)).toEqual(['second']);
  });

  it('an overlay\'s old cancel leaves the overlay registered after it', async () => {
    const root = mount();
    await enhance(root);
    const { overlays } = ctxOf(root);
    const first = overlays.register('jump', { isOpen: () => true, close: () => undefined });
    first();
    overlays.register('jump', { isOpen: () => true, close: () => undefined });
    first();
    expect(overlays.top()).toBe('jump');
  });

  it('ctx.setPrefs does nothing once the instance is not live: no state, attribute, write or event', async () => {
    const set = vi.fn();
    const root = mount();
    await enhance(root, { storageKey: 'k', storage: { set } });
    const ctx = ctxOf(root);
    const seen: unknown[] = [];
    ctx.events.on('prefs', (p) => seen.push(p));
    const before = { ...ctx.state.prefs };
    await destroyEnhancement(root);
    const attrs = Array.from(root.attributes).map((a) => `${a.name}=${a.value}`);
    ctx.setPrefs({ width: 'wide', lens: 'product' });
    expect(ctx.state.prefs).toEqual(before);
    expect(Array.from(root.attributes).map((a) => `${a.name}=${a.value}`)).toEqual(attrs);
    expect(set).not.toHaveBeenCalled();
    expect(seen).toEqual([]);
  });

  it('a heading\'s label keeps its inline text as written: no space before punctuation, none for a text-less child', async () => {
    const root = mount(['# Labels', '', '## Run `npm ci`, then **go**.', '', 'Text.', '', '## Title ![x](a.png)', '', 'More.', '', '## Two  spaces', '', 'End.', ''].join('\n'));
    await enhance(root);
    const [run, title, two] = Array.from(root.children).filter((c) => c.localName === 'h2');
    expect(run?.getAttribute('aria-label')).toBe('Run npm ci, then go.');
    expect(run?.querySelector('.h-fold')?.getAttribute('aria-label')).toBe('Fold or unfold: Run npm ci, then go.');
    expect(title?.getAttribute('aria-label')).toBe('Title');
    expect(title?.querySelector('.h-fold')?.getAttribute('aria-label')).toBe('Fold or unfold: Title');
    expect(two?.getAttribute('aria-label')).toBe('Two spaces');
  });

  it('a fold\'s name leaves out the chrome a feature built before it put in the heading (a read mark\'s control)', async () => {
    const root = mount(['# Labels', '', '## Run `npm ci`, then **go**.', '', 'Text.', '', '## Two', '', 'More.', '', '## Three', '', 'End.', ''].join('\n'));
    hooks.beforeFolds.push({
      name: 'marks-probe',
      build: (ctx: FeatureContext) => {
        const h = Array.from(ctx.root.children).find((c) => c.localName === 'h2') as HTMLElement;
        ctx.headCtl(h, 'mark', chrome(ctx.root.ownerDocument, 'button', { className: 'h-mark', text: 'Mark read' }));
      },
    } satisfies Feature);
    await enhance(root);
    const h = Array.from(root.children).find((c) => c.localName === 'h2');
    expect(h?.querySelector('.h-fold')?.getAttribute('aria-label')).toBe('Fold or unfold: Run npm ci, then go.');
    expect(h?.getAttribute('aria-label')).toBe('Run npm ci, then go.');
  });

  it('folds.join takes only a node the feature put in the root: one outside it, nested, or of the document is refused', async () => {
    const root = mount();
    await enhance(root, { storageKey: 'k', storage: { set: vi.fn() } });
    const ctx = ctxOf(root);
    const code = find(root, '.codehilite');
    const outside = chrome(document, 'div');
    document.body.append(outside);
    expect(() => ctx.folds.join(outside, code)).toThrow(/join/);
    const nested = chrome(document, 'div');
    ctx.journal.insert(nested, code, null);
    expect(() => ctx.folds.join(nested, code)).toThrow(/join/);
    const heading = child(root, 'h2', '3-plan');
    expect(() => ctx.folds.join(heading, code)).toThrow(/join/);
    ctx.folds.setFold(child(root, 'h2', '2-design'), true);
    expect([outside.hasAttribute('hidden'), nested.hasAttribute('hidden'), heading.hasAttribute('hidden')]).toEqual([false, false, false]);
    expect(ctx.folds.sectionOf(heading)).toBeNull();
  });

  it('blocks: a root inside a host\'s figure keeps its code blocks', async () => {
    const root = mount();
    const figure = document.createElement('figure');
    document.body.append(figure);
    figure.append(root);
    await enhance(root);
    expect(ctxOf(root).blocks.map((b) => b.kind)).toEqual(['table', 'code']);
  });

  it('terms: defining is linear; eight times the terms, or eight times one term\'s definitions, takes at most 24 times as long', async () => {
    const root = mount();
    await enhance(root);
    const cell = find(root, 'td');
    const row = cell.closest('tr') as Element;
    const time = (n: number, same: boolean): number => {
      const terms = createTerms(root);
      const start = performance.now();
      for (let i = 0; i < n; i += 1) {
        terms.define({ name: same ? 'term' : `t${String(i)}`, exact: false, section: 'S', target: cell, def: { qual: '', cell, row } });
      }
      const ms = performance.now() - start;
      expect(same ? terms.get('term')?.defs.length : terms.all().length).toBe(n);
      return ms;
    };
    // Three doublings, each allowed three times the time (24 < 27), where copying the list on each definition, as
    // before, costs about four times per doubling (64, measured above 100). The best of three runs, so a pause of the
    // collector or a busy machine does not decide it.
    const best = (n: number, same: boolean): number => Math.min(time(n, same), time(n, same), time(n, same));
    for (const same of [false, true]) {
      best(2_000, same); // warm up
      const once = best(5_000, same);
      const eight = best(40_000, same);
      expect(eight / once, same ? 'one term, its definitions' : 'distinct terms').toBeLessThanOrEqual(24);
    }
    const terms = createTerms(root);
    terms.define({ name: 'a', exact: false, section: 'S', target: cell, def: { qual: '', cell, row } });
    const all = terms.all();
    expect(Object.isFrozen(all)).toBe(true);
    expect(terms.all()).toBe(all); // the same copy until the next definition
    const firstDefs = terms.get('a')?.defs;
    expect(terms.get('a')?.defs).toBe(firstDefs);
    terms.define({ name: 'a', exact: false, section: 'S', target: cell, def: { qual: 'q', cell, row } });
    expect(firstDefs?.map((d) => d.qual)).toEqual(['']); // an earlier answer does not change
    terms.define({ name: 'b', exact: false, section: 'S', target: cell, def: { qual: '', cell, row } });
    expect(all.map((t) => t.name)).toEqual(['a']); // an earlier answer does not change
    expect(terms.all().map((t) => t.name)).toEqual(['a', 'b']);
    const defs = terms.get('a')?.defs;
    expect(Object.isFrozen(defs)).toBe(true);
    expect(defs?.map((d) => d.qual)).toEqual(['', 'q']);
  }, 120_000);
});

describe('env.fonts: a face is loaded only when its load answers a loaded face (LD5)', () => {
  /** A font set whose load answers `answer`, and whose 'loadingdone' listeners the case fires by hand. */
  function fontSet(answer: () => unknown[]) {
    const heard = new Set<() => void>();
    const loads: string[] = [];
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        load: (spec: string) => {
          loads.push(spec);
          return Promise.resolve(answer());
        },
        addEventListener: (type: string, fn: () => void) => {
          if (type === 'loadingdone') heard.add(fn);
        },
        removeEventListener: (type: string, fn: () => void) => {
          if (type === 'loadingdone') heard.delete(fn);
        },
      },
    });
    const fire = (): void => {
      for (const fn of [...heard]) fn();
    };
    return { heard, loads, fire };
  }

  it('a face no stylesheet declares yet answers no face: the wait listens for the next load and asks again', async () => {
    const root = mount();
    await enhance(root);
    let answer: unknown[] = [];
    const set = fontSet(() => answer);
    let result: boolean | undefined;
    void ctxOf(root).env.fonts(5_000).then((v) => (result = v));
    await flush();
    expect(result).toBeUndefined();
    expect(set.heard.size).toBe(1);
    set.fire(); // another font loaded: still none of the reader's
    await flush();
    expect(result).toBeUndefined();
    expect(set.heard.size).toBe(1);
    answer = [{ status: 'unloaded' }]; // declared, not loaded
    set.fire();
    await flush();
    expect(result).toBeUndefined();
    answer = [{ status: 'loaded' }];
    set.fire();
    await flush();
    expect(result).toBe(true);
    expect(set.heard.size).toBe(0);
    expect(set.loads).toHaveLength(8);
  });

  it('a wait that runs out while no face is declared answers false and leaves no listener, nor does a load that answers after it', async () => {
    const root = mount();
    await enhance(root);
    const set = fontSet(() => []);
    expect(await ctxOf(root).env.fonts(30)).toBe(false);
    expect(set.heard.size).toBe(0);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const late = new Set<unknown>();
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        load: () => gate.then(() => []),
        addEventListener: (_t: string, fn: unknown) => late.add(fn),
        removeEventListener: (_t: string, fn: unknown) => late.delete(fn),
      },
    });
    expect(await ctxOf(root).env.fonts(20)).toBe(false);
    release();
    await flush();
    expect(late.size).toBe(0);
  });

  it('an answer that is not a list of faces is no loaded face', async () => {
    const root = mount();
    await enhance(root);
    for (const answer of [undefined, [undefined], [null], ['loaded'], [{}], [{ status: 'error' }]]) {
      Object.defineProperty(document, 'fonts', { configurable: true, value: { load: () => Promise.resolve(answer) } });
      expect(await ctxOf(root).env.fonts(20), JSON.stringify(answer)).toBe(false);
    }
  });

  it('destroy removes the listener of a wait; a load that answers after destroy adds none', async () => {
    const root = mount();
    await enhance(root);
    const env = ctxOf(root).env;
    const set = fontSet(() => []);
    void env.fonts(5_000);
    await flush();
    expect(set.heard.size).toBe(1);
    await destroyEnhancement(root);
    expect(set.heard.size).toBe(0);

    const other = mount();
    await enhance(other);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const late = new Set<unknown>();
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        load: () => gate.then(() => []),
        addEventListener: (_t: string, fn: unknown) => late.add(fn),
        removeEventListener: (_t: string, fn: unknown) => late.delete(fn),
      },
    });
    void ctxOf(other).env.fonts(5_000);
    await destroyEnhancement(other);
    release();
    await flush();
    expect(late.size).toBe(0);
  });

  it('a set that cannot be listened to waits for the bound', async () => {
    const root = mount();
    await enhance(root);
    Object.defineProperty(document, 'fonts', { configurable: true, value: { load: () => Promise.resolve([]) } });
    let result: boolean | undefined;
    void ctxOf(root).env.fonts(40).then((v) => (result = v));
    await flush();
    expect(result).toBeUndefined();
    await wait(80);
    expect(result).toBe(false);
  });
});
