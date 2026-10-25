// @vitest-environment jsdom
// C67: a spy updates Contents state now and follows its active link on a later frame.
import { afterEach, expect, it } from 'vitest';
import { contextOf } from '../src/enhance/lifecycle.js';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';
import { render } from '../src/render/index.js';

const DOC = [
  '# Rail example',
  '',
  '## In short',
  '',
  'Summary.',
  '',
  '## 1. Context',
  '',
  'One.',
  '',
  '## 2. Design',
  '',
  'Two.',
  '',
  '## 3. Notes',
  '',
  'Three.',
  '',
  '| ID | Status | Decision |',
  '| --- | --- | --- |',
  '| R1 | Agreed | Keep it local. |',
].join('\n');

const SMALL_DOC = [
  '# Small rail example',
  '',
  '## 1. Context',
  '',
  'One section.',
  '',
  '### One',
  '',
  'One.',
  '',
  '### Two',
  '',
  'Two.',
  '',
  '### Three',
  '',
  'Three.',
  '',
  '### Four',
  '',
  'Four.',
].join('\n');

const roots: HTMLElement[] = [];
let restoreFrame: (() => void) | null = null;

function mount(markdown = DOC): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(markdown).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)));
  document.body.append(root);
  roots.push(root);
  return root;
}

function frames(): { readonly runAll: () => void } {
  const queued = new Map<number, FrameRequestCallback>();
  const descriptor = Object.getOwnPropertyDescriptor(window, 'requestAnimationFrame');
  const cancelled = Object.getOwnPropertyDescriptor(window, 'cancelAnimationFrame');
  let next = 1;
  Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: (fn: FrameRequestCallback): number => { const id = next; next += 1; queued.set(id, fn); return id; } });
  Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: (id: number): void => { queued.delete(id); } });
  restoreFrame = () => {
    if (descriptor === undefined) delete (window as { requestAnimationFrame?: unknown }).requestAnimationFrame;
    else Object.defineProperty(window, 'requestAnimationFrame', descriptor);
    if (cancelled === undefined) delete (window as { cancelAnimationFrame?: unknown }).cancelAnimationFrame;
    else Object.defineProperty(window, 'cancelAnimationFrame', cancelled);
  };
  return {
    runAll: () => {
      while (queued.size > 0) {
        const entry = queued.entries().next().value as [number, FrameRequestCallback] | undefined;
        if (entry === undefined) return;
        queued.delete(entry[0]);
        entry[1](0);
      }
    },
  };
}

function heading(root: Element, id: string): HTMLElement {
  const found = Array.from(root.querySelectorAll('h2')).find((element) => element.id === id);
  if (found === undefined) throw new Error(`missing ${id}`);
  return found as HTMLElement;
}

function rect(top: number, bottom: number): DOMRect {
  return { top, bottom, left: 0, right: 100, width: 100, height: bottom - top, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

afterEach(async () => {
  for (const root of roots.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  restoreFrame?.();
  restoreFrame = null;
  document.body.replaceChildren();
});

it('keeps a small eligible reader within its three-read rail follow budget', async () => {
  const schedule = frames();
  const root = mount(SMALL_DOC);
  let reads = 0;
  const counted = (value: () => DOMRect): (() => DOMRect) => () => {
    reads += 1;
    return value();
  };
  await enhance(root);
  schedule.runAll();
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('missing context');
  const panel = root.querySelector('.toc-contents') as HTMLElement;
  const link = root.querySelector('a[href="#1-context"]') as HTMLAnchorElement;
  Object.defineProperty(panel, 'getClientRects', { configurable: true, value: counted(() => ({ length: 1 }) as unknown as DOMRect) });
  Object.defineProperty(link, 'getClientRects', { configurable: true, value: counted(() => ({ length: 1 }) as unknown as DOMRect) });
  Object.defineProperty(panel, 'getBoundingClientRect', { configurable: true, value: counted(() => rect(0, 300)) });
  Object.defineProperty(link, 'getBoundingClientRect', { configurable: true, value: counted(() => rect(100, 120)) });

  ctx.events.emit('spy', Object.freeze({ section: null, unit: null }));
  reads = 0;
  ctx.events.emit('spy', Object.freeze({ section: heading(root, '1-context'), unit: null }));
  schedule.runAll();

  expect(reads).toBeLessThanOrEqual(Math.ceil(Math.log2(1 + 1)) + 2);
});

it('defers the latest active Contents link follow while updating ARIA synchronously', async () => {
  const schedule = frames();
  const root = mount();
  await enhance(root);
  schedule.runAll();
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('missing context');
  const panel = root.querySelector('.toc-contents') as HTMLElement;
  const context = root.querySelector('a[href="#1-context"]') as HTMLAnchorElement;
  const design = root.querySelector('a[href="#2-design"]') as HTMLAnchorElement;
  Object.defineProperty(panel, 'getClientRects', { configurable: true, value: () => ({ length: 1 }) });
  Object.defineProperty(context, 'getClientRects', { configurable: true, value: () => ({ length: 1 }) });
  Object.defineProperty(design, 'getClientRects', { configurable: true, value: () => ({ length: 1 }) });
  Object.defineProperty(panel, 'getBoundingClientRect', { configurable: true, value: () => rect(0, 300) });
  Object.defineProperty(context, 'getBoundingClientRect', { configurable: true, value: () => rect(400, 420) });
  Object.defineProperty(design, 'getBoundingClientRect', { configurable: true, value: () => rect(500, 520) });
  const writes: number[] = [];
  Object.defineProperty(panel, 'scrollTop', { configurable: true, get: () => 5, set: (value: number) => { writes.push(value); } });

  ctx.events.emit('spy', Object.freeze({ section: heading(root, '1-context'), unit: null }));
  ctx.events.emit('spy', Object.freeze({ section: heading(root, '2-design'), unit: null }));

  expect([design.getAttribute('aria-current'), writes]).toEqual(['location', []]);
  schedule.runAll();
  expect(writes).toEqual([355]);
});

it.each(['index', 'drawer', 'removed-anchor', 'removed-panel'] as const)('does not follow an invalidated pending Contents target: %s', async (mode) => {
  const schedule = frames();
  const root = mount();
  await enhance(root);
  schedule.runAll();
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('missing context');
  const panel = root.querySelector('.toc-contents') as HTMLElement;
  const design = root.querySelector('a[href="#2-design"]') as HTMLAnchorElement;
  Object.defineProperty(panel, 'getClientRects', { configurable: true, value: () => ({ length: 1 }) });
  Object.defineProperty(design, 'getClientRects', { configurable: true, value: () => ({ length: 1 }) });
  let geometry = 0;
  Object.defineProperty(panel, 'getBoundingClientRect', { configurable: true, value: () => { geometry += 1; return rect(0, 300); } });
  Object.defineProperty(design, 'getBoundingClientRect', { configurable: true, value: () => { geometry += 1; return rect(400, 420); } });
  let writes = 0;
  Object.defineProperty(panel, 'scrollTop', { configurable: true, get: () => 0, set: () => { writes += 1; } });
  ctx.events.emit('spy', Object.freeze({ section: heading(root, '2-design'), unit: null }));

  if (mode === 'index') (root.querySelector('[role="tab"][aria-controls$="toc-index"]') as HTMLButtonElement).click();
  if (mode === 'drawer') (root.querySelector('.toc-btn') as HTMLButtonElement).click();
  if (mode === 'removed-anchor') design.remove();
  if (mode === 'removed-panel') panel.remove();
  schedule.runAll();

  expect([geometry, writes]).toEqual([0, 0]);
});

it('stops before later geometry when the first anchor box method destroys its pending follow', async () => {
  const schedule = frames();
  const root = mount();
  const sibling = mount();
  await Promise.all([enhance(root), enhance(sibling)]);
  schedule.runAll();
  const ctx = contextOf(root);
  const siblingContext = contextOf(sibling);
  if (ctx === undefined || siblingContext === undefined) throw new Error('missing context');
  const panel = root.querySelector('.toc-contents') as HTMLElement;
  const design = root.querySelector('a[href="#2-design"]') as HTMLAnchorElement;
  let anchorClientRects = 0;
  let anchorRects = 0;
  let panelRects = 0;
  let writes = 0;
  Object.defineProperty(design, 'getClientRects', { configurable: true, value: () => { anchorClientRects += 1; void destroyEnhancement(root); return ({ length: 1 }) as unknown as DOMRect; } });
  Object.defineProperty(panel, 'getBoundingClientRect', { configurable: true, value: () => { panelRects += 1; return rect(0, 300); } });
  Object.defineProperty(design, 'getBoundingClientRect', { configurable: true, value: () => { anchorRects += 1; return rect(400, 420); } });
  Object.defineProperty(panel, 'scrollTop', { configurable: true, get: () => 0, set: () => { writes += 1; } });
  ctx.events.emit('spy', Object.freeze({ section: heading(root, '2-design'), unit: null }));
  schedule.runAll();

  const siblingRuns: string[][] = [];
  siblingContext.onRelayout((reasons) => siblingRuns.push([...reasons]));
  siblingContext.relayout('content');
  schedule.runAll();
  expect([anchorClientRects, anchorRects, panelRects, writes, siblingRuns]).toEqual([1, 0, 0, 0, [['content']]]);
});

it.each(['anchor-rect', 'panel-rect', 'scroll-top'] as const)('stops rail geometry at the destructive %s callout', async (boundary) => {
  const schedule = frames();
  const root = mount();
  await enhance(root);
  schedule.runAll();
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('missing context');
  const panel = root.querySelector('.toc-contents') as HTMLElement;
  const design = root.querySelector('a[href="#2-design"]') as HTMLAnchorElement;
  Object.defineProperty(panel, 'getClientRects', { configurable: true, value: () => ({ length: 1 }) });
  Object.defineProperty(design, 'getClientRects', { configurable: true, value: () => ({ length: 1 }) });
  let panelRects = 0;
  let anchorRects = 0;
  let writes = 0;
  const destroy = (): void => { void destroyEnhancement(root); };
  Object.defineProperty(design, 'getBoundingClientRect', {
    configurable: true,
    value: () => {
      anchorRects += 1;
      if (boundary === 'anchor-rect') destroy();
      return rect(400, 420);
    },
  });
  Object.defineProperty(panel, 'getBoundingClientRect', {
    configurable: true,
    value: () => {
      panelRects += 1;
      if (boundary === 'panel-rect') destroy();
      return rect(0, 300);
    },
  });
  Object.defineProperty(panel, 'scrollTop', {
    configurable: true,
    get: () => {
      if (boundary === 'scroll-top') destroy();
      return 0;
    },
    set: () => { writes += 1; },
  });
  ctx.events.emit('spy', Object.freeze({ section: heading(root, '2-design'), unit: null }));
  schedule.runAll();

  expect(writes).toBe(0);
  if (boundary === 'anchor-rect') expect([anchorRects, panelRects]).toEqual([1, 0]);
  if (boundary === 'panel-rect') expect([anchorRects, panelRects]).toEqual([1, 1]);
  if (boundary === 'scroll-top') expect([anchorRects, panelRects]).toEqual([1, 1]);
});

it.each(['moved-anchor', 'moved-panel', 'zero-height', 'destroyed'] as const)('releases a pending follow without later geometry: %s', async (mode) => {
  const schedule = frames();
  const root = mount();
  await enhance(root);
  schedule.runAll();
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('missing context');
  const panel = root.querySelector('.toc-contents') as HTMLElement;
  const design = root.querySelector('a[href="#2-design"]') as HTMLAnchorElement;
  const host = document.createElement('div');
  document.body.append(host);
  let anchorRects = 0;
  let panelRects = 0;
  let writes = 0;
  Object.defineProperty(panel, 'getClientRects', { configurable: true, value: () => ({ length: 1 }) });
  Object.defineProperty(design, 'getClientRects', { configurable: true, value: () => ({ length: 1 }) });
  Object.defineProperty(design, 'getBoundingClientRect', { configurable: true, value: () => { anchorRects += 1; return rect(400, 420); } });
  Object.defineProperty(panel, 'getBoundingClientRect', { configurable: true, value: () => { panelRects += 1; return mode === 'zero-height' ? rect(0, 0) : rect(0, 300); } });
  Object.defineProperty(panel, 'scrollTop', { configurable: true, get: () => 0, set: () => { writes += 1; } });
  ctx.events.emit('spy', Object.freeze({ section: heading(root, '2-design'), unit: null }));
  if (mode === 'moved-anchor') host.append(design);
  if (mode === 'moved-panel') host.append(panel);
  if (mode === 'destroyed') await destroyEnhancement(root);
  schedule.runAll();

  if (mode === 'zero-height') expect([anchorRects, panelRects, writes]).toEqual([1, 1, 0]);
  else expect([anchorRects, panelRects, writes]).toEqual([0, 0, 0]);
});
