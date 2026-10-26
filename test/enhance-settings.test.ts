// @vitest-environment jsdom
// Reading settings and attention (docserver L2, Task 19): the reader-wide prefs menu,
// its root-local radio groups and close behavior, fold controls, Product lens peeks, and
// the marks that direct a reader to the document's pending work.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance, setEnhancementPrefs } from '../src/enhance/index.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import type { ReaderStorage } from '../src/enhance/types.js';
import { render } from '../src/render/index.js';

const DOC = [
  '# Settings example',
  '',
  '**Spec** · 2026-10-21 · Status: Draft',
  '',
  '## 1. Review',
  '',
  '| ID | Status | Owner | Note |',
  '|---|---|---|---|',
  '| R1 | Awaiting | other | Clear |',
  '| R2 | Accepted | you | Clear |',
  '| R3 | Accepted | other | Blocking work |',
  '| R4 | Diverges | other | Clear |',
  '',
  '| Question | Answer |',
  '|---|---|',
  '| What remains? | TBD |',
  '',
  '`src/feature.ts`',
  '',
  '```ts',
  'one',
  'two',
  'three',
  'four',
  'five',
  '```',
  '',
  '## 2. More',
  '',
  'Closing text.',
  '',
  '## 3. End',
  '',
  'Final text.',
].join('\n');

const mounted: HTMLElement[] = [];

function mount(md = DOC, into: Document = document): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(md).html}`, 'text/html');
  const root = into.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((n) => into.importNode(n, true)));
  into.body.append(root);
  mounted.push(root);
  return root;
}

function click(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
}

function choose(input: HTMLInputElement): void {
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function key(el: EventTarget, value: string): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
}

function tool(root: Element): HTMLButtonElement {
  const found = root.querySelector('.aa-btn');
  if (found === null) throw new Error('no reading settings button');
  return found as HTMLButtonElement;
}

function menu(root: Element): HTMLElement {
  const found = root.querySelector('.aa-menu');
  if (found === null) throw new Error('no reading settings menu');
  return found as HTMLElement;
}

function radio(root: Element, pref: string, value: string): HTMLInputElement {
  const found = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find((input) => input.getAttribute('data-pref') === pref && input.value === value);
  if (found === undefined) throw new Error(`no ${pref}/${value} radio`);
  return found as HTMLInputElement;
}

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('reading settings', () => {
  it('does not build settings chrome when that chrome is disabled', async () => {
    const root = mount();
    await enhance(root, { chrome: { settings: false } });

    expect(root.querySelectorAll('.aa-wrap, .aa-menu, .aa-btn')).toHaveLength(0);
  });

  it('mirrors host-set prefs in root-local radios and stores a reader choice', async () => {
    const sets: [string, string | null][] = [];
    const storage: ReaderStorage = { set: (key, value) => { sets.push([key, value]); } };
    const root = mount();
    await enhance(root, { storage });

    setEnhancementPrefs(root, { theme: 'dark', font: 'sans', width: 'wide', lens: 'product' });

    expect([radio(root, 'theme', 'dark').checked, radio(root, 'font', 'sans').checked, radio(root, 'width', 'wide').checked, radio(root, 'lens', 'product').checked]).toEqual([true, true, true, true]);
    choose(radio(root, 'theme', 'light'));
    expect(root.getAttribute('data-theme')).toBe('light');
    choose(radio(root, 'font', 'serif'));
    choose(radio(root, 'width', 'standard'));
    choose(radio(root, 'lens', 'all'));
    expect([root.getAttribute('data-font'), root.getAttribute('data-width'), root.classList.contains('lens-product')]).toEqual(['serif', 'standard', false]);
    expect(sets).toContainEqual(['docreader:prefs', JSON.stringify({ theme: 'light', font: 'sans', width: 'wide', lens: 'product' })]);
  });

  it('closes the menu on Escape, outside pointer and focus leaving its own root', async () => {
    const root = mount();
    await enhance(root);
    const button = tool(root);
    click(button);
    expect(menu(root).hidden).toBe(false);
    key(radio(root, 'theme', 'auto'), 'Escape');
    expect([menu(root).hidden, document.activeElement]).toEqual([true, button]);

    click(button);
    radio(root, 'theme', 'auto').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(menu(root).hidden).toBe(false);
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(menu(root).hidden).toBe(true);

    click(button);
    const outside = document.createElement('button');
    document.body.append(outside);
    radio(root, 'theme', 'auto').dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
    expect(menu(root).hidden).toBe(true);
  });

  it('closes for a pointer target from its own foreign DOM realm', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const foreign = frame.contentDocument;
    if (foreign === null) throw new Error('iframe has no document');
    const root = mount(DOC, foreign);
    const outside = foreign.createElement('button');
    foreign.body.append(outside);
    await enhance(root);

    click(tool(root));
    outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(menu(root).hidden).toBe(true);
    frame.remove();
  });

  it('treats a non-node pointer target as outside the menu without throwing', async () => {
    const root = mount();
    await enhance(root);
    click(tool(root));
    const outside = new Event('pointerdown', { bubbles: true });
    Object.defineProperty(outside, 'target', { value: { nodeType: 1 } });

    document.dispatchEvent(outside);

    expect(menu(root).hidden).toBe(true);
  });

  it('leaves Escape to the shared overlay router when a higher-priority overlay is open, even with shortcuts disabled', async () => {
    for (const keyboard of [true, false]) {
      const root = mount();
      await enhance(root, { keyboard });
      const ctx = contextOf(root);
      if (ctx === undefined) throw new Error('root was not enhanced');
      let figureOpen = true;
      ctx.overlays.register('figure', { isOpen: () => figureOpen, close: () => { figureOpen = false; } });

      click(tool(root));
      key(radio(root, 'theme', 'auto'), 'Escape');

      expect([figureOpen, menu(root).hidden]).toEqual([false, false]);
    }
  });

  it('treats a spoofed focus target as outside the menu without throwing', async () => {
    const root = mount();
    await enhance(root);
    click(tool(root));
    const leave = new Event('focusout', { bubbles: true });
    Object.defineProperty(leave, 'relatedTarget', { value: { nodeType: 1 } });

    radio(root, 'theme', 'auto').dispatchEvent(leave);

    expect(menu(root).hidden).toBe(true);
  });

  it('does not take focus back when the host moved it outside the open settings menu', async () => {
    const root = mount();
    const hostFocus = document.createElement('button');
    document.body.append(hostFocus);
    await enhance(root);
    const button = tool(root);
    button.focus();
    click(button);
    expect(document.activeElement).toBe(radio(root, 'theme', 'auto'));

    hostFocus.focus();
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));

    expect([menu(root).hidden, document.activeElement]).toEqual([true, hostFocus]);
  });

  it('collapses and expands every fold in one write while keeping the reader position', async () => {
    const sets: [string, string | null][] = [];
    const storage: ReaderStorage = { snapshot: {}, set: (key, value) => { sets.push([key, value]); } };
    const root = mount();
    await enhance(root, { storageKey: 'settings', storage });
    const ctx = contextOf(root);
    if (ctx === undefined) throw new Error('root was not enhanced');

    click(tool(root));
    const controls = Array.from(root.querySelectorAll<HTMLButtonElement>('.aa-btns button'));
    const collapse = controls.find((button) => button.textContent === 'Collapse all');
    const expand = controls.find((button) => button.textContent === 'Expand all');
    if (collapse === undefined || expand === undefined) throw new Error('no fold controls');
    click(collapse);

    expect(ctx.folds.headings().every((heading) => ctx.folds.isFolded(heading))).toBe(true);
    expect(sets.filter(([key]) => key === 'docreader:doc:settings:folds')).toHaveLength(1);
    expect([collapse.disabled, expand.disabled]).toEqual([true, false]);
    click(expand);
    expect(ctx.folds.headings().every((heading) => !ctx.folds.isFolded(heading))).toBe(true);
    expect(sets.filter(([key]) => key === 'docreader:doc:settings:folds')).toHaveLength(2);
    expect([collapse.disabled, expand.disabled]).toEqual([false, true]);
  });

  it('keeps radio groups separate across roots and builds lens peeks only when product is chosen', async () => {
    const a = mount();
    const b = mount();
    await enhance(a);
    await enhance(b);

    expect(radio(a, 'theme', 'auto').name).not.toBe(radio(b, 'theme', 'auto').name);
    expect(a.querySelector('.peek-bar')).toBeNull();
    choose(radio(a, 'lens', 'product'));
    expect([a.classList.contains('lens-product'), a.querySelectorAll('.peek-bar').length, b.classList.contains('lens-product')]).toEqual([true, 1, false]);
    const peek = a.querySelector('.peek-bar') as HTMLElement;
    const code = a.querySelector('.codehilite') as HTMLElement;
    const ctx = contextOf(a);
    if (ctx === undefined) throw new Error('root was not enhanced');
    expect(ctx.folds.sectionOf(peek)).toBe(ctx.folds.sectionOf(code));
    const toggle = peek.querySelector('button');
    if (toggle === null) throw new Error('no engineering-detail toggle');
    expect([toggle.getAttribute('aria-expanded'), code.classList.contains('peek-open')]).toEqual(['false', false]);
    click(toggle);
    expect([toggle.getAttribute('aria-expanded'), code.classList.contains('peek-open')]).toEqual(['true', true]);
    click(toggle);
    expect([toggle.getAttribute('aria-expanded'), code.classList.contains('peek-open')]).toEqual(['false', false]);
  });

  it('applies the product lens from initial and changed prefs without settings chrome', async () => {
    const explicit = mount();
    const stored = mount();
    const changed = mount();
    const chrome = { bar: false, settings: false };
    await enhance(explicit, { prefs: { lens: 'product' }, chrome });
    await enhance(stored, { storage: { snapshot: { 'docreader:prefs': JSON.stringify({ lens: 'product' }) } }, chrome });
    await enhance(changed, { chrome });

    expect([
      explicit.classList.contains('lens-product'), explicit.querySelectorAll('.peek-bar').length,
      stored.classList.contains('lens-product'), stored.querySelectorAll('.peek-bar').length,
      changed.classList.contains('lens-product'),
    ]).toEqual([true, 1, true, 1, false]);

    setEnhancementPrefs(changed, { lens: 'product' });
    expect([changed.classList.contains('lens-product'), changed.querySelectorAll('.peek-bar').length]).toEqual([true, 1]);
    setEnhancementPrefs(changed, { lens: 'all' });
    expect(changed.classList.contains('lens-product')).toBe(false);

    await destroyEnhancement(explicit);
    expect(explicit.classList.contains('lens-product')).toBe(false);
  });

  it('restores a pre-existing product lens class after destroy', async () => {
    const root = mount();
    root.classList.add('lens-product');
    await enhance(root, { chrome: { bar: false, settings: false } });

    expect(root.classList.contains('lens-product')).toBe(false);
    await destroyEnhancement(root);
    expect(root.classList.contains('lens-product')).toBe(true);
  });

  it('leaves a host preference-class edit made after enhancement in place on destroy', async () => {
    const hostWins = mount();
    const untouched = mount();
    const chrome = { bar: false, settings: false };
    await enhance(hostWins, { prefs: { lens: 'all' }, chrome });
    await enhance(untouched, { prefs: { lens: 'product' }, chrome });

    hostWins.classList.add('lens-product');
    await destroyEnhancement(hostWins);
    await destroyEnhancement(untouched);

    expect([hostWins.classList.contains('lens-product'), untouched.classList.contains('lens-product')]).toEqual([true, false]);
  });
});

describe('attention', () => {
  it('marks each pending-work rule, risks, paths and engineering detail', async () => {
    const root = mount();
    await enhance(root);
    const rows = Array.from(root.querySelectorAll<HTMLTableRowElement>('tbody tr'));
    const byId = (id: string): HTMLTableRowElement => {
      const row = rows.find((candidate) => candidate.cells[0]?.textContent?.trim() === id);
      if (row === undefined) throw new Error(`no ${id} row`);
      return row as HTMLTableRowElement;
    };

    expect([byId('R1').classList.contains('attn'), byId('R2').classList.contains('attn'), byId('R3').classList.contains('attn'), byId('R4').classList.contains('risk')]).toEqual([true, true, true, true]);
    expect(rows.find((row) => row.cells[0]?.textContent?.trim() === 'What remains?')?.classList.contains('attn')).toBe(true);
    expect(root.querySelector('code.path')?.textContent).toBe('src/feature.ts');
    expect(root.querySelector('.codehilite')?.classList.contains('tech')).toBe(true);
  });

  it('reads only a rule head\'s first status pill for risk and open attention', async () => {
    const root = mount([
      '# Rules',
      '',
      '`AB-1` — _rejected diverges_.',
      '',
      '`AB-2` — This prose diverges but has no status.',
      '',
      '`AB-3` — _awaiting_.',
      '',
      '`AB-4` — _accepted diverges_ but the body is awaiting a follow-up.',
      '',
      '`AB-5` — _accepted_ (awaiting).',
      '',
      '`AB-6` — _awaiting **review**_.',
      '',
      'Ordinary prose is awaiting a follow-up.',
    ].join('\n'));
    await enhance(root, { rules: true });
    const ctx = contextOf(root);
    if (ctx === undefined) throw new Error('missing indexed rules');
    const rule = (id: string): HTMLElement => {
      const entry = ctx.index.get(id);
      if (entry === undefined || !(entry.target instanceof HTMLElement)) throw new Error(`no ${id} rule`);
      return entry.target;
    };

    expect([ctx.index.get('AB-1')?.status, ctx.index.get('AB-2')?.status, ctx.index.get('AB-3')?.status]).toEqual(['no', null, 'wait']);
    expect([rule('AB-1').classList.contains('risk'), rule('AB-2').classList.contains('risk'), rule('AB-3').classList.contains('attn')]).toEqual([true, false, true]);
    expect([rule('AB-4').classList.contains('risk'), rule('AB-4').classList.contains('attn'), rule('AB-5').classList.contains('attn')]).toEqual([false, false, false]);
    const words = (element: Element): string => (element.textContent ?? '').replace(/\s+/g, ' ').trim();
    const inlineStatus = rule('AB-6').querySelector('.rule-head .pill');
    if (inlineStatus === null) throw new Error('no inline status pill');
    expect([Array.from(rule('AB-5').querySelectorAll('.rule-head .pill')).map(words), words(inlineStatus), rule('AB-6').classList.contains('attn')]).toEqual([['accepted', 'awaiting'], 'awaiting review', true]);
    expect(Array.from(root.querySelectorAll('p:not(.rule)')).some((paragraph) => paragraph.textContent?.includes('awaiting') && paragraph.classList.contains('attn'))).toBe(false);
  });

  it('uses the supplied rule open-status words as a literal replacement', async () => {
    const root = mount([
      '# Rules',
      '',
      '`AB-1` — _awaiting_.',
      '',
      '`AB-2` — _queued_.',
    ].join('\n'));
    await enhance(root, { rules: true, vocabulary: { status: { wait: ['awaiting', 'queued'] }, attention: { openStatus: ['queued'] } } });
    const ctx = contextOf(root);
    if (ctx === undefined) throw new Error('missing indexed rules');

    expect([ctx.index.get('AB-1')?.target.classList.contains('attn'), ctx.index.get('AB-2')?.target.classList.contains('attn')]).toEqual([false, true]);
  });

  it('uses named status and owner headers after the ID column and ignores group rows', async () => {
    const root = mount([
      '| ID | Status note | Owner |',
      '|---|---|---|',
      '| R1 | Clear | you |',
      '| R2 | Awaiting | other |',
      '| Group | | |',
    ].join('\n'));
    await enhance(root);
    const rows = Array.from(root.querySelectorAll<HTMLTableRowElement>('tbody tr'));

    expect(rows.map((row) => [row.classList.contains('group'), row.classList.contains('attn')])).toEqual([[false, true], [false, true], [true, false]]);
  });

  it('does not treat an ID-column status header as the attention status column', async () => {
    const root = mount(['| Status | Note | Owner |', '|---|---|---|', '| Awaiting | Clear | other |'].join('\n'));
    await enhance(root);

    expect(root.querySelector('tbody tr')?.classList.contains('attn')).toBe(false);
  });

  it('does not treat an ID-column owner header as the attention owner column', async () => {
    const root = mount(['| Owner | Status | Note |', '|---|---|---|', '| you | Clear | Clear |'].join('\n'));
    await enhance(root);

    expect(root.querySelector('tbody tr')?.classList.contains('attn')).toBe(false);
  });

  it('does not mark a grouped row even when its cells otherwise match attention predicates', async () => {
    const root = mount(['| ID | Status | Owner |', '|---|---|---|', '| Group | Awaiting | you |'].join('\n'));
    const row = root.querySelector<HTMLTableRowElement>('tbody tr');
    if (row === null) throw new Error('missing group row');
    row.classList.add('group');
    await enhance(root);

    expect(row.classList.contains('attn')).toBe(false);
  });

  it('marks only unanswered question rows from the answer column', async () => {
    const root = mount([
      '| Question | Answer |',
      '|---|---|',
      '| What remains? | TBD |',
      '| What changed? | Settled |',
      '',
      '| Prompt | Answer |',
      '|---|---|',
      '| What remains? | TBD |',
    ].join('\n'));
    await enhance(root);
    const rows = Array.from(root.querySelectorAll<HTMLTableRowElement>('tbody tr'));

    expect(rows.map((row) => row.classList.contains('attn'))).toEqual([true, false, false]);
  });

  it('classifies technical tables by code share or technical headers and skips excluded tables', async () => {
    const root = mount([
      '## 1. Engineering',
      '',
      '| Topic | Detail |',
      '|---|---|',
      '| `one` | `two` |',
      '| `three` | `four` |',
      '| `five` | plain |',
      '',
      '| File | Path |',
      '|---|---|',
      '| prose | prose |',
      '| prose | prose |',
      '| prose | prose |',
      '',
      '| Term | Meaning |',
      '|---|---|',
      '| `one` | `two` |',
      '| `three` | `four` |',
      '| `five` | `six` |',
      '',
      '| File | Detail |',
      '|---|---|',
      '| `one` | `two` |',
      '| `three` | `four` |',
      '',
      '| ID | Decision | File |',
      '|---|---|---|',
      '| R1 | Keep | `one` |',
      '| R2 | Fold | `two` |',
      '| R3 | Drop | `three` |',
      '',
      '## Where things stand',
      '',
      '### Agreed',
      '',
      '| File | Path |',
      '|---|---|',
      '| `one` | `two` |',
      '| `three` | `four` |',
      '| `five` | `six` |',
      '',
      '| ID | Decision |',
      '|---|---|',
      '| R1 | Keep |',
      '| R2 | Fold |',
      '| R3 | Drop |',
    ].join('\n'));
    await enhance(root);
    const tables = Array.from(root.querySelectorAll<HTMLElement>('.table-wrapper'));

    expect(tables.map((table) => table.classList.contains('tech'))).toEqual([true, true, false, false, false, false, false]);
  });

  it('skips grouped table rows, preformatted paths and short code from attention marks', async () => {
    const root = mount([
      '| ID | Status | Owner | Note |',
      '|---|---|---|---|',
      '| Group | Awaiting | you | Blocking work |',
      '| R5 | Accepted | other | Clear |',
      '',
      '`src/plain.ts`',
      '',
      '```ts',
      'src/preformatted.ts',
      '```',
      '',
      '```ts',
      'one',
      'two',
      'three',
      'four',
      '```',
    ].join('\n'));
    const group = root.querySelector('tbody tr') as HTMLTableRowElement;
    group.classList.add('group');
    const list = document.createElement('ul');
    const item = document.createElement('li');
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = 'src/preformatted.ts';
    pre.append(code);
    item.append(pre);
    list.append(item);
    root.append(list);
    await enhance(root);

    expect([group.classList.contains('attn'), code.classList.contains('path'), root.querySelectorAll('.codehilite.tech').length]).toEqual([false, false, 0]);
    expect(root.querySelector('p code.path')?.textContent).toBe('src/plain.ts');
  });

  // Kills M40 (fresh M39 replay): settings.ts must retain its conditional focus return.
  it('keeps settings open when host capture suppresses focusout, then closes outside without stealing focus', async () => {
    const root = mount();
    const outside = document.createElement('button');
    document.body.append(outside);
    await enhance(root);
    const button = tool(root);
    button.focus();
    click(button);
    expect([menu(root).hidden, document.activeElement]).toEqual([false, radio(root, 'theme', 'auto')]);

    let captured = 0;
    let bubbled = 0;
    const suppress = (event: FocusEvent): void => {
      expect(event.target).toBe(radio(root, 'theme', 'auto'));
      expect(event.relatedTarget).toBe(outside);
      captured += 1;
      event.stopPropagation();
    };
    const observe = (): void => { bubbled += 1; };
    root.addEventListener('focusout', suppress, true);
    root.addEventListener('focusout', observe);
    try {
      outside.focus();
      expect([captured, bubbled, menu(root).hidden, document.activeElement]).toEqual([1, 0, false, outside]);
    } finally {
      root.removeEventListener('focusout', suppress, true);
      root.removeEventListener('focusout', observe);
    }

    outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect([menu(root).hidden, button.getAttribute('aria-expanded'), document.activeElement]).toEqual([true, 'false', outside]);
    click(button);
    expect(menu(root).hidden).toBe(false);
    outside.focus();
    expect([menu(root).hidden, document.activeElement]).toEqual([true, outside]);
  });

  // Kills M41: attention.ts must retain statusCell's inner `index > 0 &&` findIndex guard.
  it('uses the later status header after an ID header that literal replacement also matches', async () => {
    const source = [
      '| ID | Status | Owner |',
      '|---|---|---|',
      '| R1 | Awaiting | other |',
      '| R2 | Accepted | other |',
      '| R3 | Accepted | other |',
    ].join('\n');
    const root = mount(source);
    await enhance(root, { vocabulary: { attention: { status: ['ID', 'Status'] } } });
    const ctx = contextOf(root);
    if (ctx === undefined || ctx.blocks[0]?.kind !== 'table') throw new Error('no indexed table');
    const table = ctx.blocks[0];
    const first = table.rows[0];
    if (first === undefined) throw new Error('no first table row');

    expect(table.isIndex).toBe(true);
    expect(table.heads).toEqual(['ID', 'Status', 'Owner']);
    expect([ctx.index.get('R1')?.kind, ctx.index.get('R1')?.target, ctx.index.get('R1')?.status]).toEqual(['row', first, 'wait']);
    expect(first.cells[1]?.querySelector('.pill')?.classList.contains('wait')).toBe(true);
    expect(table.rows.map((row) => [row.classList.contains('group'), row.classList.contains('attn')])).toEqual([[false, true], [false, false], [false, false]]);

    const idOnly = mount(source);
    await enhance(idOnly, { vocabulary: { attention: { status: ['ID'] } } });
    expect(Array.from(idOnly.querySelectorAll('tbody tr')).map((row) => row.classList.contains('attn'))).toEqual([false, false, false]);
  });

  // Kills M42: attention.ts must retain ownerCell's inner `index > 0 &&` findIndex guard.
  it('uses the later owner header after an ID header that literal replacement also matches', async () => {
    const source = [
      '| ID | Status | Owner |',
      '|---|---|---|',
      '| R1 | Accepted | you |',
      '| R2 | Accepted | other |',
      '| R3 | Accepted | other |',
    ].join('\n');
    const root = mount(source);
    await enhance(root, { vocabulary: { attention: { who: ['ID', 'Owner'] } } });
    const ctx = contextOf(root);
    if (ctx === undefined || ctx.blocks[0]?.kind !== 'table') throw new Error('no indexed table');
    const table = ctx.blocks[0];
    const first = table.rows[0];
    if (first === undefined) throw new Error('no first table row');

    expect(table.isIndex).toBe(true);
    expect(table.heads).toEqual(['ID', 'Status', 'Owner']);
    expect([ctx.index.get('R1')?.kind, ctx.index.get('R1')?.target, ctx.index.get('R1')?.status]).toEqual(['row', first, 'ok']);
    expect(first.cells[1]?.querySelector('.pill')?.classList.contains('ok')).toBe(true);
    expect(table.rows.map((row) => [row.classList.contains('group'), row.classList.contains('attn')])).toEqual([[false, true], [false, false], [false, false]]);

    const idOnly = mount(source);
    await enhance(idOnly, { vocabulary: { attention: { who: ['ID'] } } });
    expect(Array.from(idOnly.querySelectorAll('tbody tr')).map((row) => row.classList.contains('attn'))).toEqual([false, false, false]);
  });

  // Kills M43: attention.ts must read only text(pill), not text(entry.target), after its negative-status guard.
  it('keeps negative role rules without risk words in their status out of risk despite risk words in body or note', async () => {
    const root = mount([
      '# Rules',
      '',
      '`AB-8` — _rejected_ body diverges.',
      '',
      '`AB-9` — _rejected_ (diverges) body is otherwise clear.',
    ].join('\n'));
    await enhance(root, { rules: true });
    const ctx = contextOf(root);
    if (ctx === undefined) throw new Error('missing indexed rules');
    const rule = (id: string): HTMLElement => {
      const entry = ctx.index.get(id);
      if (entry === undefined || !(entry.target instanceof HTMLElement)) throw new Error(`no ${id} rule`);
      return entry.target;
    };

    expect([ctx.index.get('AB-8')?.status, ctx.index.get('AB-9')?.status]).toEqual(['no', 'no']);
    expect([rule('AB-8').querySelector('.rule-head .pill')?.textContent, rule('AB-9').querySelector('.rule-head .pill')?.textContent]).toEqual(['rejected', 'rejected']);
    expect([rule('AB-8').classList.contains('risk'), rule('AB-9').classList.contains('risk')]).toEqual([false, false]);
  });

  // Kills M44: attention.ts must normalize the rule pill with text(pill), not raw trimmed textContent.
  it('normalizes internal rule-status whitespace before matching a supplied multiword open status', async () => {
    const root = mount([
      '# Rules',
      '',
      '`AB-10` — _queued **for**<br> review_.',
    ].join('\n'));
    await enhance(root, {
      rules: true,
      vocabulary: { status: { wait: ['queued'] }, attention: { openStatus: ['queued for review'] } },
    });
    const ctx = contextOf(root);
    const entry = ctx?.index.get('AB-10');
    if (entry === undefined || !(entry.target instanceof HTMLElement)) throw new Error('no queued rule');
    const pill = entry.target.querySelector('.rule-head .pill');
    if (pill === null) throw new Error('no queued status pill');

    expect(entry.status).toBe('wait');
    expect(pill.querySelector('br')).not.toBeNull();
    expect(entry.target.classList.contains('attn')).toBe(true);
  });
});
