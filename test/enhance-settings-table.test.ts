// @vitest-environment jsdom
// Filtered technical tables under the Product lens: the chrome wrapper is the visual target while the renderer-owned inner wrapper remains the registry identity.
import { afterEach, expect, it } from 'vitest';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import type { TableBlock } from '../src/enhance/registry.js';
import { render } from '../src/render/index.js';

const rows = Array.from({ length: 12 }, (_, index) => `| Item ${String(index + 1)} | \`src/part-${String(index + 1)}.ts\` |`).join('\n');
const DOC = [
  '# Filtered engineering detail',
  '',
  '**Spec** · 2026-10-21 · Status: Draft',
  '',
  '## 1. Technical table',
  '',
  '| File | Detail |',
  '|---|---|',
  rows,
  '',
  '| File | Detail |',
  '|---|---|',
  '| `src/ordinary-a.ts` | `detail-a` |',
  '| `src/ordinary-b.ts` | `detail-b` |',
  '| `src/ordinary-c.ts` | `detail-c` |',
  '',
  '```ts',
  'one',
  'two',
  'three',
  'four',
  'five',
  '```',
  '',
  '## 2. Later source section',
  '',
  'This paragraph must stay after the table peek control.',
  '',
  '### 2.1 Detail',
  '',
  'More source prose.',
  '',
  '### 2.2 Detail',
  '',
  'More source prose.',
  '',
  '### 2.3 Detail',
  '',
  'More source prose.',
  '',
  '### 2.4 Detail',
  '',
  'More source prose.',
].join('\n');

const roots: HTMLElement[] = [];

function mount(markdown = DOC): HTMLElement {
  const root = document.createElement('main');
  root.innerHTML = render(markdown).html;
  document.body.append(root);
  roots.push(root);
  return root;
}

function click(element: Element): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
}

function choose(input: HTMLInputElement): void {
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function radio(root: Element, value: string): HTMLInputElement {
  const input = root.querySelector<HTMLInputElement>(`input[data-pref="lens"][value="${value}"]`);
  if (input === null) throw new Error(`no lens radio for ${value}`);
  return input;
}

afterEach(async () => {
  for (const root of roots.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

it('keeps a filtered technical table together and inserts its Product peek before later source content', async () => {
  const root = mount();
  const original = root.innerHTML;
  await enhance(root);
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('missing enhancement context');
  const table = ctx.blocks.find((block): block is TableBlock => block.kind === 'table');
  if (table === undefined) throw new Error('missing registered table');
  const inner = table.el;
  const outer = root.querySelector<HTMLElement>('.tbl-block');
  const input = root.querySelector<HTMLInputElement>('.tbl-tools input');
  const later = Array.from(root.querySelectorAll('h2')).find((heading) => heading.textContent?.includes('Later source section'));
  if (outer === null || input === null || later === undefined) throw new Error('missing real filtered table structure');

  expect([table.el, outer.contains(input), outer.contains(inner), inner.parentElement]).toEqual([inner, true, true, outer]);
  expect([table.tech, outer.classList.contains('tech'), inner.classList.contains('tech'), root.querySelector('.peek-bar')]).toEqual([true, true, false, null]);

  choose(radio(root, 'product'));
  const bar = root.querySelector<HTMLElement>('.peek-bar');
  if (bar === null) throw new Error('missing Product peek bar');
  const button = bar.querySelector<HTMLButtonElement>('button');
  if (button === null) throw new Error('missing Product peek button');

  expect([outer.classList.contains('tech'), inner.classList.contains('tech'), outer.nextElementSibling, bar.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING]).toEqual([true, false, bar, Node.DOCUMENT_POSITION_FOLLOWING]);
  input.value = 'part-1';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(Array.from(outer.querySelectorAll('tbody tr')).map((row) => row.hasAttribute('hidden'))).toEqual([false, true, true, true, true, true, true, true, true, false, false, false]);
  expect([button.getAttribute('aria-expanded'), outer.classList.contains('peek-open'), inner.classList.contains('peek-open')]).toEqual(['false', false, false]);
  click(button);
  expect([button.getAttribute('aria-expanded'), outer.classList.contains('peek-open'), inner.classList.contains('peek-open')]).toEqual(['true', true, false]);
  click(button);
  expect([button.getAttribute('aria-expanded'), outer.classList.contains('peek-open'), inner.classList.contains('peek-open')]).toEqual(['false', false, false]);
  expect(ctx.folds.sectionOf(bar)).toBe(ctx.folds.sectionOf(outer));
  const heading = ctx.folds.sectionOf(outer);
  if (heading === null) throw new Error('filtered table has no fold section');
  ctx.folds.setFold(heading, true);
  expect([heading.classList.contains('folded'), outer.getAttribute('hidden'), bar.getAttribute('hidden')]).toEqual([true, 'until-found', 'until-found']);
  bar.dispatchEvent(new Event('beforematch'));
  expect([heading.classList.contains('folded'), outer.hasAttribute('hidden'), bar.hasAttribute('hidden')]).toEqual([false, false, false]);
  ctx.folds.setFold(heading, true);
  ctx.reveal(inner);
  expect([heading.classList.contains('folded'), outer.hasAttribute('hidden'), bar.hasAttribute('hidden')]).toEqual([false, false, false]);
  const ordinary = Array.from(root.querySelectorAll<HTMLElement>('.table-wrapper')).find((candidate) => candidate !== inner);
  const code = root.querySelector<HTMLElement>('.codehilite');
  if (ordinary === undefined || code === null) throw new Error('missing ordinary technical controls');
  expect([ordinary.classList.contains('tech'), code.classList.contains('tech'), ordinary.nextElementSibling?.classList.contains('peek-bar'), code.nextElementSibling?.classList.contains('peek-bar')]).toEqual([true, true, true, true]);

  inner.classList.add('host-changed');
  await destroyEnhancement(root);
  expect([root.querySelector('.table-wrapper'), root.innerHTML.replace(' host-changed', ''), inner.classList.contains('host-changed')]).toEqual([inner, original, true]);
});

interface SourceTable {
  readonly wrapper: HTMLElement;
  readonly table: HTMLTableElement;
}

interface FilteredTable {
  readonly table: TableBlock;
  readonly inner: HTMLElement;
  readonly outer: HTMLElement;
  readonly input: HTMLInputElement;
  readonly later: HTMLElement;
}

function sourceTable(root: HTMLElement): SourceTable {
  const wrapper = root.querySelector<HTMLElement>('.table-wrapper');
  const table = wrapper?.querySelector<HTMLTableElement>('table') ?? null;
  if (wrapper === null || table === null) throw new Error('missing renderer-owned source table');
  return { wrapper, table };
}

function filteredTable(root: HTMLElement): FilteredTable {
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('missing enhancement context');
  const table = ctx.blocks.find((block): block is TableBlock => block.kind === 'table');
  if (table === undefined) throw new Error('missing registered table');
  const inner = table.el;
  const outer = root.querySelector<HTMLElement>('.tbl-block');
  const input = outer?.querySelector<HTMLInputElement>('.tbl-tools input') ?? null;
  const later = Array.from(root.querySelectorAll<HTMLElement>('h2')).find((heading) => heading.textContent?.includes('Later source section'));
  if (outer === null || input === null || later === undefined) throw new Error('missing filtered table presentation target');
  return { table, inner, outer, input, later };
}

function assertProductPath(root: HTMLElement, source: SourceTable): void {
  const { table, inner, outer, input, later } = filteredTable(root);
  const bar = outer.nextElementSibling;
  expect(bar).toBeInstanceOf(HTMLElement);
  if (!(bar instanceof HTMLElement)) return;
  expect(bar.classList.contains('peek-bar')).toBe(true);
  const button = bar.querySelector<HTMLButtonElement>('button');
  expect(button).not.toBeNull();
  if (button === null) return;

  expect([table.el, inner, inner.querySelector('table'), table.tech, inner.parentElement, outer.parentElement, outer.classList.contains('tech'), inner.classList.contains('tech'), outer.contains(input), outer.contains(inner), bar.parentElement, Boolean(bar.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING)]).toEqual([source.wrapper, source.wrapper, source.table, true, outer, root, true, false, true, true, root, true]);
  input.value = 'part-1';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  expect(Array.from(outer.querySelectorAll('tbody tr')).map((row) => row.hasAttribute('hidden'))).toEqual([false, true, true, true, true, true, true, true, true, false, false, false]);
  expect([button.getAttribute('aria-expanded'), outer.classList.contains('peek-open'), inner.classList.contains('peek-open')]).toEqual(['false', false, false]);
  click(button);
  expect([table.el, inner, inner.querySelector('table'), button.getAttribute('aria-expanded'), outer.classList.contains('peek-open'), inner.classList.contains('peek-open')]).toEqual([source.wrapper, source.wrapper, source.table, 'true', true, false]);
  click(button);
  expect([table.el, inner, inner.querySelector('table'), button.getAttribute('aria-expanded'), outer.classList.contains('peek-open'), inner.classList.contains('peek-open')]).toEqual([source.wrapper, source.wrapper, source.table, 'false', false, false]);
}

function siblingState(root: HTMLElement): readonly [boolean, boolean, string | null, string | null, string | null, readonly boolean[]] {
  const { outer, inner } = filteredTable(root);
  return [radio(root, 'all').checked, radio(root, 'product').checked, root.getAttribute('class'), outer.getAttribute('class'), inner.getAttribute('class'), Array.from(outer.querySelectorAll('tbody tr')).map((row) => row.hasAttribute('hidden'))];
}

function assertSiblingUnchanged(root: HTMLElement, before: ReturnType<typeof siblingState>): void {
  expect([siblingState(root), root.querySelector('.peek-bar'), root.querySelector('.peek-open')]).toEqual([before, null, null]);
}

it('covers the explicit Product preference path without crossing into its sibling root', async () => {
  const product = mount();
  const sibling = mount();
  const productSource = sourceTable(product);
  await enhance(sibling);
  const untouched = siblingState(sibling);
  await enhance(product, { prefs: { lens: 'product' } });

  assertSiblingUnchanged(sibling, untouched);
  assertProductPath(product, productSource);
  assertSiblingUnchanged(sibling, untouched);
});

it('covers the stored Product preference path without crossing into its sibling root', async () => {
  const product = mount();
  const sibling = mount();
  const productSource = sourceTable(product);
  await enhance(sibling);
  const untouched = siblingState(sibling);
  await enhance(product, { storage: { snapshot: { 'docreader:prefs': JSON.stringify({ lens: 'product' }) } } });

  assertSiblingUnchanged(sibling, untouched);
  assertProductPath(product, productSource);
  assertSiblingUnchanged(sibling, untouched);
});

it('covers the first Product radio path without crossing into its sibling root', async () => {
  const product = mount();
  const sibling = mount();
  const productSource = sourceTable(product);
  await enhance(sibling);
  const untouched = siblingState(sibling);
  await enhance(product);

  choose(radio(product, 'product'));
  assertProductPath(product, productSource);
  assertSiblingUnchanged(sibling, untouched);
});
