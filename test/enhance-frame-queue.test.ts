// @vitest-environment jsdom
// C67: reader work shares one root-local physical-frame queue.
import { afterEach, expect, it } from 'vitest';
import { createEnv, queueFrameWork } from '../src/enhance/env.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { destroyEnhancement, enhance } from '../src/enhance/index.js';
import { createJournal } from '../src/enhance/journal.js';
import { render } from '../src/render/index.js';

const DOC = [
  '# Queue example',
  '',
  '## 1. Context',
  '',
  'One.',
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
  '',
  '## 2. Design',
  '',
  'Design.',
].join('\n');

const roots: HTMLElement[] = [];
let restoreFrame: (() => void) | null = null;

type Boundary = {
  readonly count: () => number;
  readonly deliver: () => void;
};

function mount(): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(DOC).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true)));
  document.body.append(root);
  roots.push(root);
  return root;
}

function rect(top: number, bottom: number): DOMRect {
  return { top, bottom, left: 0, right: 100, width: 100, height: bottom - top, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

/** A deterministic browser boundary that delivers every callback due in one physical-frame cohort. */
function frames(): Boundary {
  const queued = new Map<number, FrameRequestCallback>();
  const descriptor = Object.getOwnPropertyDescriptor(window, 'requestAnimationFrame');
  const cancelled = Object.getOwnPropertyDescriptor(window, 'cancelAnimationFrame');
  let next = 1;
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    value: (fn: FrameRequestCallback): number => {
      const id = next;
      next += 1;
      queued.set(id, fn);
      return id;
    },
  });
  Object.defineProperty(window, 'cancelAnimationFrame', {
    configurable: true,
    value: (id: number): void => {
      queued.delete(id);
    },
  });
  restoreFrame = () => {
    if (descriptor === undefined) delete (window as { requestAnimationFrame?: unknown }).requestAnimationFrame;
    else Object.defineProperty(window, 'requestAnimationFrame', descriptor);
    if (cancelled === undefined) delete (window as { cancelAnimationFrame?: unknown }).cancelAnimationFrame;
    else Object.defineProperty(window, 'cancelAnimationFrame', cancelled);
  };
  return {
    count: () => queued.size,
    deliver: () => {
      const cohort = [...queued.values()];
      queued.clear();
      let fault: unknown = undefined;
      let threw = false;
      for (const callback of cohort) {
        try {
          callback(0);
        } catch (error) {
          if (!threw) {
            threw = true;
            fault = error;
          }
        }
      }
      if (threw) throw fault;
    },
  };
}

function directQueue(): { readonly root: HTMLElement; readonly cleanup: () => void } {
  const root = document.createElement('main');
  document.body.append(root);
  roots.push(root);
  let alive = true;
  const control = createJournal(() => alive, (fn) => fn());
  createEnv(root, control.journal, () => alive, (fn) => fn());
  return {
    root,
    cleanup: () => {
      alive = false;
      control.undoAll();
    },
  };
}

afterEach(async () => {
  for (const root of roots.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  restoreFrame?.();
  restoreFrame = null;
  document.body.replaceChildren();
});

it('keeps a real relayout atomic and coalesced before its waiting rail follow', async () => {
  const schedule = frames();
  const root = mount();
  await enhance(root);
  while (schedule.count() > 0) schedule.deliver();
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('missing context');
  const panel = root.querySelector('.toc-contents') as HTMLElement;
  const context = root.querySelector('a[href="#1-context"]') as HTMLAnchorElement;
  const design = root.querySelector('a[href="#2-design"]') as HTMLAnchorElement;
  const headings = Array.from(root.querySelectorAll('h2')) as HTMLElement[];
  const contextHeading = headings.find((heading) => heading.id === '1-context') as HTMLElement;
  const designHeading = headings.find((heading) => heading.id === '2-design') as HTMLElement;
  Object.defineProperty(panel, 'getClientRects', { configurable: true, value: () => ({ length: 1 }) });
  for (const link of [context, design]) Object.defineProperty(link, 'getClientRects', { configurable: true, value: () => ({ length: 1 }) });
  Object.defineProperty(panel, 'getBoundingClientRect', { configurable: true, value: () => rect(0, 300) });
  Object.defineProperty(context, 'getBoundingClientRect', { configurable: true, value: () => rect(400, 420) });
  Object.defineProperty(design, 'getBoundingClientRect', { configurable: true, value: () => rect(500, 520) });
  Object.defineProperty(contextHeading, 'getBoundingClientRect', { configurable: true, value: () => rect(100, 120) });
  Object.defineProperty(designHeading, 'getBoundingClientRect', { configurable: true, value: () => rect(800, 820) });
  let panelTop = 0;
  Object.defineProperty(panel, 'scrollTop', { configurable: true, get: () => panelTop, set: (value: number) => { panelTop = value; } });
  const initialSpies: string[] = [];
  ctx.events.on('spy', (payload) => initialSpies.push(payload.section?.id ?? 'none'));
  window.dispatchEvent(new Event('scroll'));
  schedule.deliver(); // Actual scroll spy selects Context.
  schedule.deliver(); // Its deferred rail follow settles before the measured conflict.
  expect(initialSpies).toEqual(['1-context']);
  panelTop = 0;
  Object.defineProperty(contextHeading, 'getBoundingClientRect', { configurable: true, value: () => rect(800, 820) });
  Object.defineProperty(designHeading, 'getBoundingClientRect', { configurable: true, value: () => rect(100, 120) });
  const order: string[] = [];
  const reasons: string[][] = [];
  ctx.onRelayout((set) => order.push(`measure:${[...set].join(',')}`));
  ctx.events.on('relayout', (payload) => {
    order.push(`event:${payload.reasons.join(',')}`);
    reasons.push([...payload.reasons]);
  });
  ctx.events.on('spy', () => order.push('spy'));
  ctx.relayout('content');
  ctx.relayout('outline');

  expect(schedule.count()).toBe(1);
  schedule.deliver();
  expect([reasons, order, panelTop]).toEqual([[['content', 'outline']], ['measure:content,outline', 'spy', 'event:content,outline'], 0]);
  expect(schedule.count()).toBe(1);
  schedule.deliver();
  expect(panelTop).toBe(350);
});

it('keeps a scroll reentered during synchronous relayout spy after cancelling only the old pending spy', async () => {
  const schedule = frames();
  const root = mount();
  await enhance(root);
  while (schedule.count() > 0) schedule.deliver();
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('missing context');
  const headings = Array.from(root.querySelectorAll('h2')) as HTMLElement[];
  const contextHeading = headings.find((heading) => heading.id === '1-context') as HTMLElement;
  const designHeading = headings.find((heading) => heading.id === '2-design') as HTMLElement;
  Object.defineProperty(contextHeading, 'getBoundingClientRect', { configurable: true, value: () => rect(100, 120) });
  Object.defineProperty(designHeading, 'getBoundingClientRect', { configurable: true, value: () => rect(800, 820) });
  window.dispatchEvent(new Event('scroll'));
  schedule.deliver();
  schedule.deliver();
  Object.defineProperty(contextHeading, 'getBoundingClientRect', { configurable: true, value: () => rect(800, 820) });
  Object.defineProperty(designHeading, 'getBoundingClientRect', { configurable: true, value: () => rect(100, 120) });
  const seen: string[] = [];
  const onSpy = (): void => {
    seen.push('spy');
    window.dispatchEvent(new Event('scroll'));
  };
  ctx.events.on('spy', onSpy);
  ctx.relayout('content');
  schedule.deliver();
  expect(seen).toEqual(['spy']);
  expect(schedule.count()).toBe(1);
  schedule.deliver();
  expect(seen).toEqual(['spy']);
});

it('executes every request order with relayout priority and reader-rail alternation', () => {
  const schedule = frames();
  const orders = [
    ['relayout', 'spy', 'rail'],
    ['relayout', 'rail', 'spy'],
    ['spy', 'relayout', 'rail'],
    ['spy', 'rail', 'relayout'],
    ['rail', 'relayout', 'spy'],
    ['rail', 'spy', 'relayout'],
  ] as const;
  for (const requested of orders) {
    const queue = directQueue();
    const ran: string[] = [];
    for (const kind of requested) queueFrameWork(queue.root, kind, () => ran.push(kind));
    while (schedule.count() > 0) schedule.deliver();
    expect(ran).toEqual(['relayout', 'rail', 'spy']);
    queue.cleanup();
  }
});

it('does not starve rail follow under continuous reader requests', () => {
  const schedule = frames();
  const queue = directQueue();
  const ran: string[] = [];
  queueFrameWork(queue.root, 'rail', () => ran.push('rail'));
  queueFrameWork(queue.root, 'spy', () => ran.push('spy-1'));
  schedule.deliver();
  queueFrameWork(queue.root, 'spy', () => ran.push('spy-2'));
  schedule.deliver();
  schedule.deliver();

  expect(ran).toEqual(['spy-1', 'rail', 'spy-2']);
  queue.cleanup();
});

it('preserves reentrant work and schedules it after a throwing transaction', () => {
  const schedule = frames();
  const queue = directQueue();
  const fault = new Error('relayout fault');
  const ran: string[] = [];
  queueFrameWork(queue.root, 'rail', () => ran.push('rail'));
  queueFrameWork(queue.root, 'relayout', () => {
    ran.push('first');
    queueFrameWork(queue.root, 'relayout', () => ran.push('later-relayout'));
    queueFrameWork(queue.root, 'spy', () => ran.push('later-spy'));
    throw fault;
  });

  expect(() => schedule.deliver()).toThrow(fault);
  schedule.deliver();
  schedule.deliver();
  schedule.deliver();
  expect(ran).toEqual(['first', 'rail', 'later-relayout', 'later-spy']);
  queue.cleanup();
});

it('cancels only its exact entry and leaves replacement, unknown, and nonlive roots isolated', () => {
  const schedule = frames();
  const queue = directQueue();
  const ran: string[] = [];
  const old = queueFrameWork(queue.root, 'spy', () => ran.push('old'));
  const consumed = queueFrameWork(queue.root, 'spy', () => ran.push('new'));
  old();
  schedule.deliver();
  queueFrameWork(queue.root, 'spy', () => ran.push('later'));
  consumed(); // The already-consumed handle must not erase the later replacement.
  schedule.deliver();
  expect(ran).toEqual(['new', 'later']);

  const unknown = document.createElement('main');
  queueFrameWork(unknown, 'rail', () => ran.push('unknown'));
  expect(schedule.count()).toBe(0);
  queue.cleanup();
  queueFrameWork(queue.root, 'rail', () => ran.push('dead'));
  expect(schedule.count()).toBe(0);
});

it('keeps a replacement and sibling queue live after old same-root teardown', () => {
  const schedule = frames();
  const old = directQueue();
  queueFrameWork(old.root, 'rail', () => {
    throw new Error('old queue ran');
  });
  const replacementControl = createJournal(() => true, (fn) => fn());
  createEnv(old.root, replacementControl.journal, () => true, (fn) => fn());
  const sibling = directQueue();
  const ran: string[] = [];
  queueFrameWork(old.root, 'relayout', () => ran.push('replacement'));
  queueFrameWork(sibling.root, 'spy', () => ran.push('sibling'));
  old.cleanup();
  while (schedule.count() > 0) schedule.deliver();

  expect(ran).toEqual(expect.arrayContaining(['replacement', 'sibling']));
  replacementControl.undoAll();
  sibling.cleanup();
});
