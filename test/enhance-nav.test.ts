// @vitest-environment jsdom
// Navigation and the reading position (docserver L2, Task 14): the entry's goToHash and its option types, the
// delegated click (a hash link with its `from` token, onLink, a hash link this root cannot resolve), initialHash and
// the stored position (LD7, LD8), RF1's names and RF4's stored values, the position written behind, position.keep, the
// pin and what releases it, the flash, goToHash, `j` and `k`, and the section link.
//
// jsdom has no layout: a stage gives every element a top in a page of its own (`tops`, from the page's start), a
// scroll position (`y`) that window.scrollTo and scrollIntoView move, a viewport height, and the element a point
// lookup answers (`hit`). The feature list is the real one with probes: `before` runs just before the position feature
// (to define IDs it lands on), `after` after every feature.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  destroyEnhancement,
  enhance,
  goToHash,
  type ChromeOptions,
  type CommitEntry,
  type EnhanceOptions,
  type MermaidOptions,
  type VocabularyOptions,
} from '../src/enhance/index.js';
import type { Feature } from '../src/enhance/features.js';
import { CHROME_ATTR } from '../src/enhance/journal.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { checkAnchor, FLASH_MS, HEAD_GAP, ID_GAP, parseToken, PIN_MS, PIN_RELEASE, placeOf, SMOOTH_MS, TOKEN, tokenOf } from '../src/enhance/nav.js';
import type { IndexEntry } from '../src/enhance/registry.js';
import { docKey, posKeyOf } from '../src/enhance/state.js';
import type { FeatureContext } from '../src/enhance/types.js';
import { render } from '../src/render/index.js';

const hooks = vi.hoisted(() => ({ before: [] as unknown[], after: [] as unknown[] }));

vi.mock('../src/enhance/features.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/enhance/features.js')>();
  const features = (): Feature[] => {
    const list = [...real.features()];
    const at = list.findIndex((f) => f.name === 'position');
    return [...list.slice(0, at), ...(hooks.before as Feature[]), ...list.slice(at), ...(hooks.after as Feature[])];
  };
  return { ...real, features };
});

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DOC = [
  '# Navigation sample',
  '',
  '**Spec** · 2026-10-20 · Status: Draft',
  '',
  '## In short',
  '',
  '- One line.',
  '',
  '## 1. Scope',
  '',
  'What this covers: [the design](#2-design), [a sibling](other.md), [a missing one](#nowhere) and [the first row](#R1).',
  '',
  '## 2. Design',
  '',
  '| ID | What | Status |',
  '|---|---|---|',
  '| R1 | First | Agreed |',
  '| R2 | Second | Pending |',
  '',
  '### Details',
  '',
  'Detail text.',
  '',
  '### Details',
  '',
  'A second heading of the same text, so its id repeats with a suffix.',
  '',
  '## 3. Plan',
  '',
  'Plan text.',
  '',
  '## Where things stand',
  '',
  '### Agreed',
  '',
  '- One thing',
  '',
].join('\n');

const mounted: HTMLElement[] = [];

function mount(md = DOC): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(md).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes).map((n) => document.importNode(n, true)));
  document.body.append(root);
  mounted.push(root);
  return root;
}

function ctxOf(root: HTMLElement): FeatureContext {
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('no context: the root is not enhanced');
  return ctx;
}

/** The element of `root` with this tag and id (a walk, never an id lookup). */
function el(root: Element, tag: string, id: string): HTMLElement {
  const found = Array.from(root.querySelectorAll(tag)).find((c) => c.id === id);
  if (found === undefined) throw new Error(`no ${tag}#${id}`);
  return found as HTMLElement;
}

/** The first element in `root` matching a static selector. */
function find(root: Element, selector: string): HTMLElement {
  const found = root.querySelector(selector);
  if (found === null) throw new Error(`nothing matches ${selector}`);
  return found as HTMLElement;
}

/** The first block after the heading `id` that is the document's (folds put a chrome note right after a heading). */
function blockAfter(root: Element, id: string): HTMLElement {
  for (let n = el(root, 'h2', id).nextElementSibling; n !== null; n = n.nextElementSibling) if (!n.hasAttribute(CHROME_ATTR)) return n as HTMLElement;
  throw new Error(`nothing after ${id}`);
}

/** The body row of the document's table that holds `id` in its first cell. */
function row(root: Element, id: string): HTMLElement {
  const found = Array.from(root.querySelectorAll('tbody tr')).find((r) => r.firstElementChild?.textContent === id);
  if (found === undefined) throw new Error(`no row ${id}`);
  return found as HTMLElement;
}

/** Define the ID `id` on its row, just before the position feature builds (as ids.ts will). */
function defineRow(id: string): void {
  hooks.before.push({
    name: 'define',
    build: (ctx: FeatureContext) => {
      const r = row(ctx.root, id);
      const entry: IndexEntry = { id, kind: 'row', title: id, status: null, group: 'Design', target: r, row: r, heads: ['ID', 'What', 'Status'] };
      ctx.index.define(entry);
    },
  } satisfies Feature);
}

/** Click `el`; whether the root's handlers prevented the default (the browser's own is stopped after). */
function click(target: Element, init: MouseEventInit = {}): boolean {
  let prevented = false;
  const after = (e: Event): void => {
    prevented = e.defaultPrevented;
    e.preventDefault(); // jsdom would try to navigate
  };
  document.addEventListener('click', after);
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }));
  document.removeEventListener('click', after);
  return prevented;
}

const key = (target: EventTarget, k: string): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
};

/** A page of the stage's own: tops from the page's start, a scroll position, a viewport, a point lookup. */
interface Stage {
  y: number;
  h: number;
  readonly tops: Map<Element, number>;
  /** An element's left and width, where they are not 0 and 900. */
  readonly boxes: Map<Element, readonly [number, number]>;
  hit: Element | null;
  readonly points: [number, number][];
  /** scrollIntoView calls: the element and its behavior. */
  readonly intoView: [Element, string][];
  /** window.scrollTo calls: the top and the behavior. */
  readonly scrolled: [number, string][];
}

const DESCRIPTORS = ['scrollY', 'innerHeight'].map((name) => [name, Object.getOwnPropertyDescriptor(window, name)] as const);

let current: Stage | null = null;

function stage(): Stage {
  const s: Stage = { y: 0, h: 800, tops: new Map(), boxes: new Map(), hit: null, points: [], intoView: [], scrolled: [] };
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => s.y });
  Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => s.h });
  (document as unknown as { elementFromPoint: (x: number, y: number) => Element | null }).elementFromPoint = (x, y) => {
    s.points.push([x, y]);
    return s.hit;
  };
  (HTMLElement.prototype as unknown as { scrollIntoView: (o?: ScrollIntoViewOptions) => void }).scrollIntoView = function (this: Element, o) {
    s.intoView.push([this, o?.behavior ?? 'auto']);
    s.y = Math.max(0, s.tops.get(this) ?? 0);
  };
  vi.spyOn(window, 'scrollTo').mockImplementation(((o: ScrollToOptions) => {
    s.scrolled.push([o.top ?? 0, o.behavior ?? 'auto']);
    s.y = Math.max(0, o.top ?? 0);
  }) as never);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const top = (s.tops.get(this) ?? 0) - s.y;
    const [left, width] = s.boxes.get(this) ?? [0, 900];
    return { top, bottom: top + 20, left, right: left + width, width, height: 20, x: left, y: top, toJSON: () => ({}) } as DOMRect;
  });
  current = s;
  return s;
}

/** The window's timers, run by hand: each with its delay. */
function timers() {
  const queue: { id: number; fn: () => void; ms: number }[] = [];
  let next = 1;
  vi.spyOn(window, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
    queue.push({ id: next, fn, ms: ms ?? 0 });
    next += 1;
    return next - 1;
  }) as never);
  vi.spyOn(window, 'clearTimeout').mockImplementation(((id: number) => {
    const at = queue.findIndex((t) => t.id === id);
    if (at >= 0) queue.splice(at, 1);
  }) as never);
  return {
    queue,
    /** Run every queued timer of a delay of at most `ms` (and those they queue), in the order queued. */
    run(ms = Number.POSITIVE_INFINITY): void {
      for (let at = queue.findIndex((t) => t.ms <= ms); at >= 0; at = queue.findIndex((t) => t.ms <= ms)) {
        const [t] = queue.splice(at, 1);
        t?.fn();
      }
    },
    /** The delays queued now. */
    delays: (): number[] => queue.map((t) => t.ms),
  };
}

/** A storage that records what is read and written. */
function recording(values: Record<string, string> = {}) {
  const reads: string[] = [];
  const calls: [string, string | null][] = [];
  const snapshot = new Proxy(values, {
    get(t, k) {
      reads.push(String(k));
      return t[String(k)];
    },
  });
  return { storage: { snapshot, set: (k: string, v: string | null) => void calls.push([k, v]) }, reads, calls };
}

beforeEach(() => {
  current = null;
});

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
  hooks.before.length = 0;
  hooks.after.length = 0;
  vi.restoreAllMocks();
  for (const [name, d] of DESCRIPTORS) if (d !== undefined) Object.defineProperty(window, name, d);
  delete (document as unknown as { elementFromPoint?: unknown }).elementFromPoint;
  delete (HTMLElement.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView;
  current = null;
});

describe('the entry: goToHash and the option types by name (C47, C52)', () => {
  it('goToHash is a runtime export; ChromeOptions, MermaidOptions, CommitEntry and VocabularyOptions are type exports', () => {
    expect(typeof goToHash).toBe('function');
    const file = path.join(ROOT, 'src', 'enhance', 'index.ts');
    const program = ts.createProgram([file], { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], noEmit: true, types: [] });
    const checker = program.getTypeChecker();
    const sf = program.getSourceFile(file);
    const mod = sf === undefined ? undefined : checker.getSymbolAtLocation(sf);
    const names = mod === undefined ? [] : checker.getExportsOfModule(mod).map((s) => s.getName());
    expect(names.filter((n) => ['goToHash', 'ChromeOptions', 'MermaidOptions', 'CommitEntry', 'VocabularyOptions'].includes(n)).sort()).toEqual([
      'ChromeOptions',
      'CommitEntry',
      'MermaidOptions',
      'VocabularyOptions',
      'goToHash',
    ]);
    // And they type what the options take (a compile error under npm run typecheck otherwise).
    const chrome: ChromeOptions = { bar: false, rail: true, settings: true };
    const mermaid: MermaidOptions = { load: () => Promise.resolve(null), maxEdges: 10, secure: ['themeCSS'] };
    const commit: CommitEntry = { sha: 'abcdef1', subject: 'A change', date: '2026-10-20', parents: [] };
    const vocabulary: VocabularyOptions = { status: { ok: ['done'] }, plan: { task: ['Task'] } };
    const options: EnhanceOptions = { chrome, mermaid, vocabulary, info: { commits: [commit] } };
    expect(Object.keys(options)).toEqual(['chrome', 'mermaid', 'vocabulary', 'info']);
  });
});

describe('the delegated click (LD7)', () => {
  it('a hash link reveals, brings the target up, flashes and focuses it, and calls onHash with push and the place left', async () => {
    const s = stage();
    const onHash = vi.fn();
    defineRow('R1');
    const root = mount();
    await enhance(root, { onHash, storageKey: 'k', storage: { snapshot: { [docKey('k', 'folds')]: '["2-design"]' } } });
    const para = blockAfter(root, '1-scope');
    s.y = 900;
    s.tops.set(para, 930);
    s.hit = para;
    const r1 = row(root, 'R1');
    s.tops.set(r1, 1200);
    expect(el(root, 'h2', '2-design').classList.contains('folded')).toBe(true);
    expect(click(find(root, 'a[href="#R1"]'))).toBe(true);
    expect(el(root, 'h2', '2-design').classList.contains('folded')).toBe(false); // the row's section unfolded
    expect(r1.classList.contains('flash')).toBe(true);
    expect(document.activeElement).toBe(r1);
    expect(r1.getAttribute('tabindex')).toBe('-1');
    expect(onHash.mock.calls).toEqual([['R1', { push: true, from: JSON.stringify({ line: para.getAttribute('data-line'), offset: 30, y: 900 }) }]]);
    expect(s.scrolled).toEqual([[1200 - HEAD_GAP, 'smooth']]); // a row with no id: below the bar (none here) and a head of HEAD_GAP
  });

  it('a modified click on a hash link, and a sibling document\'s link, go to onLink with newTab; without onLink the browser follows', async () => {
    stage();
    const onLink = vi.fn();
    const onHash = vi.fn();
    const root = mount();
    await enhance(root, { onLink, onHash });
    const toDesign = find(root, 'a[href="#2-design"]');
    expect(click(toDesign, { ctrlKey: true })).toBe(true);
    expect(click(toDesign, { metaKey: true })).toBe(true);
    expect(click(toDesign, { shiftKey: true })).toBe(true);
    expect(click(toDesign, { altKey: true })).toBe(true);
    expect(click(find(root, 'a[href="other.md"]'))).toBe(true);
    expect(onLink.mock.calls).toEqual([
      ['#2-design', { newTab: true }],
      ['#2-design', { newTab: true }],
      ['#2-design', { newTab: true }],
      ['#2-design', { newTab: false }],
      ['other.md', { newTab: false }],
    ]);
    expect(onHash).not.toHaveBeenCalled();
    const plain = mount();
    await enhance(plain, { onHash });
    expect(click(find(plain, 'a[href="#2-design"]'), { ctrlKey: true })).toBe(false);
    expect(click(find(plain, 'a[href="other.md"]'))).toBe(false);
  });

  it('a hash link this root cannot resolve goes to onLink when the host gave it; otherwise the browser follows it', async () => {
    stage();
    const onLink = vi.fn();
    const root = mount();
    await enhance(root, { onLink });
    expect(click(find(root, 'a[href="#nowhere"]'))).toBe(true);
    expect(onLink.mock.calls).toEqual([['#nowhere', { newTab: false }]]);
    const plain = mount();
    await enhance(plain);
    expect(click(find(plain, 'a[href="#nowhere"]'))).toBe(false);
  });

  it('without onHash no place is measured; a target with no id makes no onHash', async () => {
    const s = stage();
    const root = mount();
    await enhance(root);
    s.y = 500;
    s.hit = el(root, 'h2', '3-plan');
    expect(click(find(root, 'a[href="#2-design"]'))).toBe(true);
    expect(s.points).toEqual([]);
    const onHash = vi.fn();
    const other = mount();
    await enhance(other, { onHash });
    ctxOf(other).nav.goTo(find(other, 'li'));
    expect(s.points).toEqual([]);
    expect(onHash).not.toHaveBeenCalled();
  });
});

describe('initialHash and the stored position (LD7, LD8)', () => {
  it('initialHash resolves a heading id: its fold opened, brought to the top at once and pinned; no flash, no focus, no onHash', async () => {
    const s = stage();
    const onHash = vi.fn();
    const root = mount();
    const details = (): HTMLElement => el(root, 'h3', 'details');
    await enhance(root, { onHash, initialHash: 'details', storageKey: 'k', storage: { snapshot: { [docKey('k', 'folds')]: '["2-design"]' } } });
    expect(el(root, 'h2', '2-design').classList.contains('folded')).toBe(false); // the section it sits in unfolded
    expect(s.intoView).toEqual([[details(), 'auto']]);
    expect(details().classList.contains('flash')).toBe(false);
    expect(document.activeElement).not.toBe(details());
    expect(onHash).not.toHaveBeenCalled();
    ctxOf(root).position.keep(() => undefined); // a relayout holds the pin
    expect(s.intoView).toEqual([
      [details(), 'auto'],
      [details(), 'auto'],
    ]);
  });

  it('initialHash resolves an index ID: a row or a paragraph with no id goes to the stylesheet\'s margin, by the window', async () => {
    const s = stage();
    defineRow('R2');
    hooks.before.push({
      name: 'rule',
      build: (ctx: FeatureContext) => {
        const p = blockAfter(ctx.root, '3-plan');
        ctx.index.define({ id: 'P-ONE', kind: 'rule', title: 'One', status: null, group: 'Plan', target: p, row: null, heads: [] });
      },
    } satisfies Feature);
    // The stylesheet's values: a heading's [id] margin is --bar-h + 14px, resolved; --thead-h on one table only.
    let thead = '';
    vi.spyOn(window, 'getComputedStyle').mockImplementation(((target: Element) => ({
      getPropertyValue: (prop: string) => {
        if (prop === 'scroll-margin-top') return /^H[1-6]$/.test(target.tagName) ? '62px' : '0px';
        if (prop === '--thead-h') return thead;
        if (prop === '--bar-h') return '3rem';
        return '';
      },
    })) as never);
    const root = mount();
    s.tops.set(root, 0);
    const r2 = row(root, 'R2');
    s.tops.set(r2, 5000);
    await enhance(root, { initialHash: 'R2' });
    expect(s.scrolled).toEqual([[5000 - 48 - HEAD_GAP, 'auto']]);
    thead = '31px';
    s.y = 0;
    goToHash(root, 'R2');
    expect(s.scrolled.at(-1)).toEqual([5000 - 48 - 31, 'auto']);
    const p = blockAfter(root, '3-plan');
    s.tops.set(p, 7000);
    s.y = 0;
    goToHash(root, 'P-ONE');
    expect(s.scrolled.at(-1)).toEqual([7000 - 48 - ID_GAP, 'auto']);
  });

  it('with no stylesheet in force (every margin 0), a paragraph lands at the top, and a row below the head\'s room', async () => {
    const s = stage();
    vi.spyOn(window, 'getComputedStyle').mockImplementation((() => ({ getPropertyValue: (prop: string) => (prop === 'scroll-margin-top' ? '0px' : '') })) as never);
    hooks.before.push({
      name: 'rule',
      build: (ctx: FeatureContext) => {
        ctx.index.define({ id: 'P-ONE', kind: 'rule', title: 'One', status: null, group: 'Plan', target: blockAfter(ctx.root, '3-plan'), row: null, heads: [] });
      },
    } satisfies Feature);
    defineRow('R1');
    const root = mount();
    s.tops.set(blockAfter(root, '3-plan'), 7000);
    s.tops.set(row(root, 'R1'), 5000);
    await enhance(root, { initialHash: 'P-ONE' });
    expect(s.scrolled).toEqual([[7000, 'auto']]);
    s.y = 0;
    goToHash(root, 'R1');
    expect(s.scrolled.at(-1)).toEqual([5000 - HEAD_GAP, 'auto']);
  });

  it('the [id] margin is read off the first heading, past an anchor that comes before it', async () => {
    const s = stage();
    vi.spyOn(window, 'getComputedStyle').mockImplementation(((target: Element) => ({
      getPropertyValue: (prop: string) => (prop === 'scroll-margin-top' ? (/^H[1-6]$/.test(target.tagName) ? '62px' : '0px') : ''),
    })) as never);
    const root = mount('<!-- id:top -->\n\n# T\n\n| ID | What |\n|---|---|\n| R1 | One |\n');
    s.tops.set(row(root, 'R1'), 3000);
    defineRow('R1');
    await enhance(root, { initialHash: 'R1' });
    expect(s.scrolled).toEqual([[3000 - 48 - HEAD_GAP, 'auto']]);
  });

  it('with no heading to read the bar from, a margin is --bar-h in px, else no bar', async () => {
    const s = stage();
    let bar = '52px';
    vi.spyOn(window, 'getComputedStyle').mockImplementation((() => ({ getPropertyValue: (prop: string) => (prop === '--bar-h' ? bar : '') })) as never);
    const root = mount('Text.\n\n| ID | What |\n|---|---|\n| R1 | One |\n');
    const r1 = row(root, 'R1');
    s.tops.set(r1, 3000);
    defineRow('R1');
    await enhance(root, { initialHash: 'R1' });
    expect(s.scrolled).toEqual([[3000 - 52 - HEAD_GAP, 'auto']]);
    bar = 'calc(10px + 1em)';
    goToHash(root, 'R1');
    expect(s.scrolled.at(-1)).toEqual([3000 - HEAD_GAP, 'auto']);
  });

  it('a revealer that destroys the instance while it lands stops it: no pin, and enhance() rejects', async () => {
    const s = stage();
    hooks.before.push({
      name: 'destroying',
      build: (ctx: FeatureContext) => {
        ctx.onReveal(() => {
          void destroyEnhancement(ctx.root);
        });
      },
    } satisfies Feature);
    const add = vi.spyOn(document, 'addEventListener');
    const root = mount();
    await expect(enhance(root, { initialHash: 'details' })).rejects.toMatchObject({ code: 'aborted' });
    expect(s.intoView).toEqual([]);
    expect(add.mock.calls.filter(([type]) => type === 'wheel')).toEqual([]);
  });

  it('initialHash wins over a stored position; without it the stored position is restored and pinned', async () => {
    const s = stage();
    const pos = JSON.stringify({ line: '30-30', offset: 50, y: 4000 });
    const root = mount();
    await enhance(root, { initialHash: '1-scope', storageKey: 'k', storage: { snapshot: { [posKeyOf('k')]: pos } } });
    expect(s.intoView).toEqual([[el(root, 'h2', '1-scope'), 'auto']]);
    expect(s.scrolled).toEqual([]);
    const again = mount();
    const plan = blockAfter(again, '3-plan');
    expect(plan.getAttribute('data-line')).toBe('30-30');
    s.tops.set(plan, 6000);
    await enhance(again, { storageKey: 'k', storage: { snapshot: { [posKeyOf('k')]: pos } } });
    expect(s.scrolled).toEqual([[6000 - 50, 'auto']]);
    s.tops.set(plan, 6100); // a block above grew
    ctxOf(again).position.keep(() => undefined);
    expect(s.scrolled.at(-1)).toEqual([6100 - 50, 'auto']);
  });

  it('a stored position whose block is gone, or hidden, goes to its scroll position; one naming an id finds it by id', async () => {
    const s = stage();
    const root = mount();
    await enhance(root, { storageKey: 'k', storage: { snapshot: { [posKeyOf('k')]: JSON.stringify({ line: '999-999', offset: 0, y: 1234 }) } } });
    expect(s.scrolled).toEqual([[1234, 'auto']]);
    const folded = mount();
    const plan = blockAfter(folded, '3-plan');
    await enhance(folded, {
      storageKey: 'k',
      storage: { snapshot: { [posKeyOf('k')]: JSON.stringify({ line: plan.getAttribute('data-line'), offset: 10, y: 2222 }), [docKey('k', 'folds')]: '["3-plan"]' } },
    });
    expect(plan.hasAttribute('hidden')).toBe(true);
    expect(s.scrolled.at(-1)).toEqual([2222, 'auto']);
    const byId = mount();
    s.tops.set(el(byId, 'h2', '2-design'), 3000);
    await enhance(byId, { storageKey: 'k', storage: { snapshot: { [posKeyOf('k')]: JSON.stringify({ line: '2-design', offset: 70, y: 1 }) } } });
    expect(s.scrolled.at(-1)).toEqual([3000 - 70, 'auto']);
  });

  it('RF1: __proto__, constructor and an id named like chrome are document ids; an id the document lacks lands nowhere', async () => {
    const s = stage();
    const md = '# Names\n\n## \\_\\_proto\\_\\_\n\nOne.\n\n## constructor\n\nTwo.\n\n## jump\n\nThree.\n\n## toc-contents\n\nFour.\n';
    for (const [hash, id] of [['__proto__', '__proto__'], ['constructor', 'constructor'], ['jump', 'jump'], ['toString', null], ['xcard', null]] as const) {
      const root = mount(md);
      await enhance(root, { initialHash: hash });
      expect(s.intoView.at(-1)?.[0].id ?? null, hash).toBe(id);
      s.intoView.length = 0;
      expect(Array.from(root.querySelectorAll('a.h-anchor')).map((a) => a.getAttribute('href'))).toEqual(['#__proto__', '#constructor', '#jump', '#toc-contents']);
      await destroyEnhancement(root);
    }
    expect(Object.getPrototypeOf({}) === Object.prototype && !Object.hasOwn(Object.prototype, 'line')).toBe(true);
  });

  it('RF4: a stored position of the wrong shape, oversized, or with selector characters is ignored', async () => {
    const s = stage();
    const good = { line: '5-5', offset: 10, y: 100 };
    const bad: unknown[] = [
      null,
      7,
      'x',
      [good],
      { offset: 10, y: 100 },
      { line: '5-5', y: 100 },
      { line: '5-5', offset: 10 },
      { ...good, line: 5 },
      { ...good, line: ['5-5'] },
      { ...good, line: '' },
      { ...good, line: 'a'.repeat(TOKEN.line + 1) },
      { ...good, line: 'h2#x' },
      { ...good, line: '[id="x"]' },
      { ...good, line: 'a b' },
      { ...good, line: '.flash' },
      { ...good, line: 'a"]' },
      { ...good, offset: Number.NaN },
      { ...good, offset: TOKEN.coord + 1 },
      { ...good, offset: '10' },
      { ...good, y: -1 },
      { ...good, y: TOKEN.coord + 1 },
      { ...good, y: Number.POSITIVE_INFINITY },
      { ...good, y: '100' },
    ];
    for (const v of bad) {
      const root = mount();
      await enhance(root, { storageKey: 'k', storage: { snapshot: { [posKeyOf('k')]: JSON.stringify(v) ?? 'undefined' } } });
      expect(s.scrolled, JSON.stringify(v)).toEqual([]);
      await destroyEnhancement(root);
    }
    for (const v of [good, { ...good, line: null }, { ...good, line: 'R2' }, { ...good, line: 'já-2' }, { ...good, offset: -TOKEN.coord, y: TOKEN.coord }]) {
      expect(checkAnchor(v), JSON.stringify(v)).toEqual(v);
    }
    expect([parseToken(tokenOf(good)), parseToken('{'), parseToken(null), parseToken(` ${JSON.stringify(good)}`.padEnd(TOKEN.from + 1))]).toEqual([good, null, null, null]);
    expect(parseToken(JSON.stringify(good).padEnd(TOKEN.from))).toEqual(good);
  });
});

describe('the position written behind (LD8)', () => {
  it('once scrolling stops for 250 ms the place is written under <namespace>:pos:<posKey>; the same place is not written again', async () => {
    const s = stage();
    const t = timers();
    const { storage, calls, reads } = recording();
    const root = mount();
    await enhance(root, { storage, storageKey: 'k', posKey: 'p', namespace: 'notes' });
    expect(reads).toContain('notes:pos:p');
    const para = blockAfter(root, '1-scope');
    s.y = 300;
    s.tops.set(para, 320);
    s.hit = para;
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    expect(t.delays().filter((ms) => ms === 250)).toHaveLength(1); // a burst is one wait
    t.run(250);
    const place = JSON.stringify({ line: para.getAttribute('data-line'), offset: 20, y: 300 });
    expect(calls).toEqual([['notes:pos:p', place]]);
    window.dispatchEvent(new Event('scroll'));
    t.run(250);
    expect(calls).toHaveLength(1);
    s.y = 0;
    s.hit = null;
    window.dispatchEvent(new Event('pagehide'));
    expect(calls).toEqual([
      ['notes:pos:p', place],
      ['notes:pos:p', null],
    ]);
  });

  it('a stored place the reader is still at is not written again; with no position key nothing is read or written', async () => {
    const s = stage();
    const t = timers();
    const root = mount();
    const para = blockAfter(root, '1-scope');
    const place = { line: para.getAttribute('data-line'), offset: 20, y: 300 };
    s.tops.set(para, 320);
    const { storage, calls } = recording({ [posKeyOf('k')]: JSON.stringify(place) });
    await enhance(root, { storage, storageKey: 'k' });
    s.hit = para;
    window.dispatchEvent(new Event('pagehide'));
    expect(calls).toEqual([]);
    const none = recording();
    await enhance(mount(), { storage: none.storage });
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('pagehide'));
    t.run();
    expect(none.reads.filter((k) => k.includes(':pos:'))).toEqual([]);
    expect(none.calls).toEqual([]);
  });

  it('destroy cancels the pending write and the pin', async () => {
    const s = stage();
    const t = timers();
    const { storage, calls } = recording();
    const root = mount();
    await enhance(root, { storage, storageKey: 'k', initialHash: '3-plan' });
    ctxOf(root).position.keep(() => undefined); // as a relayout does
    const plan = el(root, 'h2', '3-plan');
    expect(s.intoView.map(([e]) => e)).toEqual([plan, plan]);
    s.y = 400;
    s.hit = plan;
    window.dispatchEvent(new Event('scroll'));
    await destroyEnhancement(root);
    t.run();
    expect(calls).toEqual([]);
    expect(t.queue).toEqual([]);
    expect(s.intoView).toHaveLength(2);
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const again = mount();
    await enhance(again, { initialHash: '3-plan' });
    /** The pin's listeners: in the capture phase (the keyboard layer's keydown listens in the bubble phase). */
    const pins = (calls: unknown[][]): unknown[] => calls.filter(([type, , o]) => (PIN_RELEASE as readonly string[]).includes(type as string) && (o as { capture?: boolean } | undefined)?.capture === true).map(([type]) => type);
    expect(pins(add.mock.calls)).toEqual([...PIN_RELEASE]);
    await destroyEnhancement(again);
    expect(pins(remove.mock.calls)).toEqual([...PIN_RELEASE]);
  });
});

describe('position.keep', () => {
  it('anchors the block at the reading line and brings it back to the same offset; at the top nothing; a keep inside a keep only runs', async () => {
    const s = stage();
    const root = mount();
    await enhance(root);
    const { position } = ctxOf(root);
    const para = blockAfter(root, '3-plan');
    s.tops.set(para, 1000);
    s.y = 940;
    s.hit = para;
    expect(
      position.keep(() => {
        s.tops.set(para, 1300); // a block above grew by 300
        return position.keep(() => 'inner');
      }),
    ).toBe('inner');
    expect(s.scrolled).toEqual([[1240, 'auto']]);
    expect(s.points[0]).toEqual([240, 12]);
    s.y = 0;
    s.points.length = 0;
    position.keep(() => undefined);
    expect([s.scrolled.length, s.points]).toEqual([1, []]);
  });

  it('nothing hit: back to the scroll position; a throwing fn still restores, then throws', async () => {
    const s = stage();
    const root = mount();
    await enhance(root);
    const { position } = ctxOf(root);
    s.y = 777;
    expect(() =>
      position.keep(() => {
        s.y = 10;
        throw new Error('changed');
      }),
    ).toThrow('changed');
    expect(s.scrolled).toEqual([[777, 'auto']]);
    expect(s.points).toHaveLength(10); // every 24 px down to 240
  });

  it('the reading line is below the bar: a hit is looked for from its bottom', async () => {
    const s = stage();
    const root = mount();
    await enhance(root);
    const bar = find(root, 'nav.topbar');
    s.tops.set(bar, 1000);
    s.y = 990; // the bar's bottom is 30 px down the viewport
    placeOf(ctxOf(root).position).anchor();
    expect(s.points[0]).toEqual([240, 42]);
    root.classList.add('bar-hidden');
    s.points.length = 0;
    placeOf(ctxOf(root).position).anchor();
    expect(s.points[0]).toEqual([240, 12]);
  });

  it('the reading line is read a third into the reading column: the first of the document\'s blocks with a box, at most 240 px in', async () => {
    const s = stage();
    const root = mount();
    await enhance(root);
    const title = find(root, 'h1');
    s.boxes.set(root, [0, 1440]);
    s.boxes.set(title, [370, 300]);
    s.y = 500;
    const { anchor } = placeOf(ctxOf(root).position);
    anchor();
    expect(s.points[0]).toEqual([470, 12]);
    s.boxes.set(title, [370, 900]);
    s.points.length = 0;
    anchor();
    expect(s.points[0]).toEqual([610, 12]);
    s.boxes.set(title, [370, 0]); // the title and the hidden meta line have no box: the next block has
    s.boxes.set(find(root, 'p'), [0, 0]);
    s.boxes.set(find(root, 'h2'), [100, 30]);
    s.points.length = 0;
    anchor();
    expect(s.points[0]).toEqual([110, 12]);
    s.boxes.set(find(root, 'h2'), [-500, 600]); // clamped to the viewport, 4 px in
    s.points.length = 0;
    anchor();
    expect(s.points[0]).toEqual([4, 12]);
    s.boxes.set(find(root, 'h2'), [2000, 900]);
    s.points.length = 0;
    anchor();
    expect(s.points[0]).toEqual([window.innerWidth - 4, 12]);
  });

  it('the column is looked for in the document\'s first 16 blocks only; past them the root stands for it', async () => {
    const s = stage();
    const md = ['# T', '', ...Array.from({ length: 20 }, (_, i) => [`Paragraph ${String(i + 1)}.`, '']).flat()].join('\n');
    const root = mount(md);
    await enhance(root);
    const blocks = Array.from(root.querySelectorAll('[data-line]'));
    for (const b of blocks) s.boxes.set(b, [0, 0]);
    s.boxes.set(blocks[16] as Element, [500, 300]); // the 17th
    s.boxes.set(root, [30, 600]);
    s.y = 100;
    placeOf(ctxOf(root).position).anchor();
    expect(s.points[0]).toEqual([230, 12]);
    s.boxes.set(blocks[15] as Element, [500, 300]); // the 16th
    s.points.length = 0;
    placeOf(ctxOf(root).position).anchor();
    expect(s.points[0]).toEqual([600, 12]);
  });

  it('for SMOOTH_MS after a smooth jump began, keep restores no place (it would stop the jump); a pin ends that wait', async () => {
    const s = stage();
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const root = mount();
    await enhance(root);
    const { nav, position } = ctxOf(root);
    const design = el(root, 'h2', '2-design');
    s.tops.set(design, 300);
    s.y = 100;
    s.hit = design;
    nav.goTo(design, { focus: false });
    expect(s.intoView.at(-1)).toEqual([design, 'smooth']);
    s.points.length = 0;
    now.mockReturnValue(1_000_000 + SMOOTH_MS - 1);
    position.keep(() => undefined);
    expect([s.points, s.scrolled]).toEqual([[], []]);
    now.mockReturnValue(1_000_000 + SMOOTH_MS);
    position.keep(() => undefined);
    expect(s.points.length).toBeGreaterThan(0);
    nav.goTo(design, { focus: false });
    goToHash(root, '3-plan');
    now.mockReturnValue(1_000_000 + SMOOTH_MS + 1);
    position.keep(() => undefined);
    expect(s.intoView.at(-1)?.[0]).toBe(el(root, 'h2', '3-plan')); // the pin held
    // a jump made at once ends the wait: once its pin is released, keep anchors again
    now.mockReturnValue(2_000_000);
    nav.goTo(design, { focus: false });
    now.mockReturnValue(2_000_100);
    goToHash(root, '3-plan');
    document.dispatchEvent(new Event('wheel'));
    s.y = 50;
    s.points.length = 0;
    position.keep(() => undefined);
    expect(s.points.length).toBeGreaterThan(0);
    // and so does going to the top
    now.mockReturnValue(3_000_000);
    nav.goTo(design, { focus: false });
    goToHash(root, null);
    s.y = 50;
    s.points.length = 0;
    position.keep(() => undefined);
    expect(s.points.length).toBeGreaterThan(0);
  });

  it('a footnote reference\'s id holds a colon: the paragraph around it is the anchor', async () => {
    const s = stage();
    const root = mount('# T\n\nA[^1] and again[^1].\n\n[^1]: Note.\n');
    await enhance(root);
    const refs = Array.from(root.querySelectorAll('sup a'));
    const para = refs[1]?.closest('p') as HTMLElement;
    expect(refs.map((a) => a.id)).toEqual(['fnref1', 'fnref1:1']);
    s.tops.set(para, 300);
    s.y = 280;
    s.hit = refs[1] as Element;
    expect(placeOf(ctxOf(root).position).anchor()).toEqual({ line: para.getAttribute('data-line'), offset: 20, y: 280 });
    s.hit = refs[0] as Element;
    s.tops.set(refs[0] as Element, 310);
    expect(placeOf(ctxOf(root).position).anchor()).toEqual({ line: 'fnref1', offset: 30, y: 280 });
  });

  it('a block that left the root since is no place to restore: back to the scroll position', async () => {
    const s = stage();
    const root = mount();
    await enhance(root);
    const para = blockAfter(root, '3-plan');
    s.tops.set(para, 2000);
    const { restore } = placeOf(ctxOf(root).position);
    restore({ line: para.getAttribute('data-line'), offset: 30, y: 1500 });
    expect(s.scrolled.at(-1)).toEqual([1970, 'auto']);
    para.remove();
    restore({ line: para.getAttribute('data-line'), offset: 30, y: 1500 });
    expect(s.scrolled.at(-1)).toEqual([1500, 'auto']);
  });

  it('a chrome element and an element the document did not have are no anchors; the block holding them is', async () => {
    const s = stage();
    const root = mount();
    await enhance(root);
    const para = blockAfter(root, '3-plan');
    const inner = document.createElement('span');
    inner.setAttribute('data-line', '1-1');
    inner.id = 'late';
    const mark = document.createElement('span');
    mark.setAttribute(CHROME_ATTR, '');
    mark.id = 'docreader.9.x';
    mark.append(inner);
    para.append(mark);
    s.tops.set(para, 500);
    s.y = 450;
    s.hit = inner;
    expect(placeOf(ctxOf(root).position).anchor()).toEqual({ line: para.getAttribute('data-line'), offset: 50, y: 450 });
    s.hit = find(root, 'nav.topbar');
    expect(placeOf(ctxOf(root).position).anchor()).toEqual({ line: null, offset: 0, y: 450 });
  });
});

describe('the pin', () => {
  it('holds after every relayout and every keep until the reader acts: a wheel, a touch, a key or a pointer press', async () => {
    const s = stage();
    for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown']) {
      const root = mount();
      await enhance(root, { initialHash: '3-plan' });
      const { position } = ctxOf(root);
      position.keep(() => undefined);
      expect(s.intoView, type).toHaveLength(2);
      document.body.dispatchEvent(new Event(type, { bubbles: true }));
      position.keep(() => undefined);
      expect(s.intoView, type).toHaveLength(2);
      s.intoView.length = 0;
      await destroyEnhancement(root);
    }
  });

  it('a reader act inside another root ends it too; another pin replaces it; it ends after PIN_MS', async () => {
    const s = stage();
    const t = timers();
    const root = mount();
    await enhance(root, { initialHash: '3-plan' });
    const other = mount();
    await enhance(other);
    ctxOf(root).position.keep(() => undefined); // as a relayout does: the pin holds
    expect(s.intoView.map(([e]) => e.id)).toEqual(['3-plan', '3-plan']);
    find(other, 'p').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    ctxOf(root).position.keep(() => undefined);
    expect(s.intoView).toHaveLength(2);
    goToHash(root, '2-design');
    expect(s.intoView.at(-1)?.[0]).toBe(el(root, 'h2', '2-design'));
    ctxOf(root).position.keep(() => undefined);
    expect(s.intoView.map(([e]) => e.id)).toEqual(['3-plan', '3-plan', '2-design', '2-design']);
    expect(t.delays()).toContain(PIN_MS);
    t.run(PIN_MS - 1);
    ctxOf(root).position.keep(() => undefined);
    expect(s.intoView).toHaveLength(5);
    t.run(PIN_MS);
    ctxOf(root).position.keep(() => undefined);
    expect(s.intoView).toHaveLength(5);
  });

  it('a smooth goTo releases a pin; one made at once (reduced motion, or more than two screens away) pins', async () => {
    const s = stage();
    const root = mount();
    await enhance(root, { initialHash: '3-plan' });
    const { nav, position } = ctxOf(root);
    const design = el(root, 'h2', '2-design');
    s.tops.set(design, 100);
    nav.goTo(design, { focus: false });
    expect(s.intoView.at(-1)).toEqual([design, 'smooth']);
    position.keep(() => undefined);
    expect(s.intoView).toHaveLength(2);
    s.y = 0;
    s.tops.set(design, 2 * s.h + 1);
    nav.goTo(design, { focus: false });
    expect(s.intoView.at(-1)).toEqual([design, 'auto']);
    position.keep(() => undefined);
    expect(s.intoView).toHaveLength(4);
    (window as unknown as { matchMedia: unknown }).matchMedia = (q: string) => ({ matches: q.includes('reduce') });
    try {
      s.y = 0;
      s.tops.set(design, 100);
      nav.goTo(design, { focus: false });
      expect(s.intoView.at(-1)).toEqual([design, 'auto']);
      position.keep(() => undefined);
      expect(s.intoView).toHaveLength(6);
    } finally {
      delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    }
  });

  it('a pinned target that left the root is not scrolled to; a pin after destroy listens for nothing', async () => {
    const s = stage();
    defineRow('R2');
    const root = mount();
    const r2 = row(root, 'R2');
    s.tops.set(r2, 4000);
    await enhance(root, { initialHash: 'R2' });
    expect(s.scrolled).toHaveLength(1);
    r2.remove();
    ctxOf(root).position.keep(() => undefined);
    expect(s.scrolled).toHaveLength(1);
    const place = placeOf(ctxOf(root).position);
    await destroyEnhancement(root);
    const add = vi.spyOn(document, 'addEventListener');
    place.pin(() => undefined);
    expect(add).not.toHaveBeenCalled();
  });

  it('a new pin cancels the old one\'s timer: it holds its own PIN_MS', async () => {
    const s = stage();
    const t = timers();
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const root = mount();
    await enhance(root, { initialHash: '1-scope' });
    expect(t.delays().filter((ms) => ms === PIN_MS)).toHaveLength(1);
    now.mockReturnValue(1_005_000);
    goToHash(root, '3-plan');
    expect(t.delays().filter((ms) => ms === PIN_MS)).toHaveLength(1);
    t.run(FLASH_MS);
    s.y = 500;
    ctxOf(root).position.keep(() => undefined);
    expect(s.intoView.at(-1)?.[0]).toBe(el(root, 'h2', '3-plan'));
    expect(s.points).toEqual([]); // with a pin, keep reads no place, wherever the page is
  });

  it('placeOf takes only the position of an instance', () => {
    expect(() => placeOf({ keep: (fn) => fn(), holdBar: () => undefined, barHeld: () => false })).toThrow(/position of an instance/);
  });

  it('a pin whose scroll throws ends there, and the throw goes no further', async () => {
    stage();
    const root = mount();
    await enhance(root, { initialHash: '3-plan' });
    let calls = 0;
    (HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {
      calls += 1;
      throw new Error('cannot scroll');
    };
    expect(() => {
      ctxOf(root).position.keep(() => undefined);
    }).not.toThrow();
    ctxOf(root).position.keep(() => undefined);
    expect(calls).toBe(1);
  });

  it('the root changing size holds it, where the window can observe sizes', async () => {
    const s = stage();
    const observed: Element[] = [];
    let report: (() => void) | null = null;
    let disconnected = 0;
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      constructor(fn: () => void) {
        report = fn;
      }
      observe(target: Element): void {
        observed.push(target);
      }
      unobserve(): void {}
      disconnect(): void {
        disconnected += 1;
      }
    };
    try {
      const root = mount();
      await enhance(root, { initialHash: '3-plan' });
      expect(observed).toEqual([root]);
      (report as unknown as (entries: unknown[]) => void)([]);
      expect(s.intoView).toHaveLength(2);
      document.dispatchEvent(new Event('wheel'));
      expect(disconnected).toBe(1);
    } finally {
      delete (window as unknown as { ResizeObserver?: unknown }).ResizeObserver;
    }
  });
});

describe('the flash', () => {
  it('goTo flashes its target for FLASH_MS; a second flash starts it again; flash: false does not; destroy removes it', async () => {
    stage();
    const t = timers();
    const root = mount();
    await enhance(root);
    const { nav } = ctxOf(root);
    const design = el(root, 'h2', '2-design');
    nav.goTo(design, { focus: false });
    expect(design.classList.contains('flash')).toBe(true);
    expect(t.delays()).toContain(FLASH_MS);
    nav.goTo(design, { focus: false });
    expect(t.delays().filter((ms) => ms === FLASH_MS)).toHaveLength(1); // the first one's timer went
    t.run(FLASH_MS - 1);
    expect(design.classList.contains('flash')).toBe(true);
    t.run(FLASH_MS);
    expect(design.classList.contains('flash')).toBe(false);
    const plan = el(root, 'h2', '3-plan');
    nav.goTo(plan, { focus: false, flash: false });
    expect(plan.classList.contains('flash')).toBe(false);
    nav.goTo(plan, { focus: false });
    await destroyEnhancement(root);
    expect(plan.classList.contains('flash')).toBe(false);
    expect(plan.hasAttribute('class')).toBe(false);
  });
});

describe('goToHash (LD7)', () => {
  it('a from token: back to its place, pinned; it calls no onHash', async () => {
    const s = stage();
    const onHash = vi.fn();
    const root = mount();
    await enhance(root, { onHash });
    const para = blockAfter(root, '1-scope');
    s.tops.set(para, 600);
    s.y = 560;
    s.hit = para;
    click(find(root, 'a[href="#2-design"]'));
    const from = onHash.mock.calls[0]?.[1]?.from as string;
    expect(parseToken(from)).toEqual({ line: para.getAttribute('data-line'), offset: 40, y: 560 });
    s.tops.set(para, 900);
    s.y = 3000;
    goToHash(root, null, from);
    expect(s.scrolled.at(-1)).toEqual([860, 'auto']);
    ctxOf(root).position.keep(() => undefined);
    expect(s.scrolled).toHaveLength(2);
    expect(onHash).toHaveBeenCalledTimes(1);
  });

  it('an id: revealed, brought up at once and flashed, not focused; null or empty: the top; a bad from is no token', async () => {
    const s = stage();
    const onHash = vi.fn();
    const root = mount();
    await enhance(root, { onHash, storageKey: 'k', storage: { snapshot: { [docKey('k', 'folds')]: '["2-design"]' } } });
    const details = el(root, 'h3', 'details');
    goToHash(root, 'details', '{"line": "x y", "offset": 0, "y": 0}');
    expect(el(root, 'h2', '2-design').classList.contains('folded')).toBe(false);
    expect(s.intoView).toEqual([[details, 'auto']]);
    expect(details.classList.contains('flash')).toBe(true);
    expect(document.activeElement).not.toBe(details);
    s.y = 900;
    goToHash(root, null);
    goToHash(root, '');
    expect(s.scrolled).toEqual([
      [0, 'auto'],
      [0, 'auto'],
    ]);
    goToHash(root, 'nowhere');
    goToHash(root, 7 as never);
    goToHash(root, '3-plan', 7 as never);
    expect([s.intoView.length, s.scrolled.length]).toEqual([2, 2]);
    expect(onHash).not.toHaveBeenCalled();
  });

  it('it holds the bar; null ends a pin; a revealer that destroys the instance stops it', async () => {
    const s = stage();
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const root = mount();
    await enhance(root, { initialHash: '3-plan' });
    const { position, onReveal } = ctxOf(root);
    goToHash(root, null, tokenOf({ line: null, offset: 0, y: 10 }));
    expect(position.barHeld()).toBe(true);
    now.mockReturnValue(1_000_000 + 5000);
    goToHash(root, '2-design');
    expect(position.barHeld()).toBe(true);
    goToHash(root, null);
    s.intoView.length = 0;
    s.y = 0;
    position.keep(() => undefined);
    expect(s.intoView).toEqual([]);
    const enhanced: boolean[] = [];
    onReveal(() => {
      void destroyEnhancement(root);
      enhanced.push(root.hasAttribute('data-docreader-root')); // inside goToHash's operation, the teardown waits
    });
    now.mockReturnValue(1_000_000 + 60_000); // the bar's hold is long over
    goToHash(root, 'details');
    expect(enhanced).toEqual([true]);
    expect(s.intoView).toEqual([]);
    expect(el(root, 'h3', 'details').classList.contains('flash')).toBe(false);
    expect(position.barHeld()).toBe(false); // nothing after the destroy, the bar's hold included
  });

  it('a root not enhanced, still starting or destroyed: nothing', async () => {
    const s = stage();
    const root = mount();
    goToHash(root, '3-plan');
    goToHash(document.createTextNode('x') as never, '3-plan');
    hooks.after.push({
      name: 'early',
      build: (ctx: FeatureContext) => {
        goToHash(ctx.root, '3-plan');
      },
    } satisfies Feature);
    await enhance(root);
    expect(s.intoView).toEqual([]);
    await destroyEnhancement(root);
    goToHash(root, '3-plan');
    expect(s.intoView).toEqual([]);
  });
});

describe('j and k', () => {
  function sections(root: HTMLElement, s: Stage): Record<string, HTMLElement> {
    const out: Record<string, HTMLElement> = {};
    for (const [id, top] of [['in-short', 100], ['1-scope', 400], ['2-design', 1000], ['3-plan', 2000], ['where-things-stand', 3000]] as const) {
      out[id] = el(root, 'h2', id);
      s.tops.set(out[id], top);
    }
    return out;
  }

  it('j: the next section; k: this section\'s start, or the previous one within 40 px; nothing past either end; no push', async () => {
    const s = stage();
    const onHash = vi.fn();
    const root = mount();
    await enhance(root, { onHash });
    const h = sections(root, s);
    const at = (): HTMLElement => h['1-scope'] as HTMLElement;
    expect(key(at(), 'j').defaultPrevented).toBe(true);
    expect(s.intoView.at(-1)?.[0]).toBe(h['1-scope']); // from In short, read at the reading line
    expect(key(at(), 'j').defaultPrevented).toBe(true);
    expect(s.intoView.at(-1)?.[0]).toBe(h['2-design']);
    expect(s.y).toBe(1000);
    expect(key(at(), 'k').defaultPrevented).toBe(true); // at its start: the previous section
    expect(s.intoView.at(-1)?.[0]).toBe(h['1-scope']);
    s.y = 1041; // 41 px into Design
    expect(key(at(), 'k').defaultPrevented).toBe(true);
    expect(s.intoView.at(-1)?.[0]).toBe(h['2-design']);
    s.y = 1040; // 40 px: still its start
    expect(key(at(), 'k').defaultPrevented).toBe(true);
    expect(s.intoView.at(-1)?.[0]).toBe(h['1-scope']);
    s.y = 0;
    const before = s.intoView.length;
    expect(key(at(), 'k').defaultPrevented).toBe(false); // In short, at its start: nothing before it
    s.y = 3000;
    expect(key(at(), 'j').defaultPrevented).toBe(false); // the last section: nothing after it
    expect(s.intoView).toHaveLength(before);
    expect(onHash.mock.calls.map(([id, e]) => [id, (e as { push: boolean }).push])).toEqual([
      ['1-scope', false],
      ['2-design', false],
      ['1-scope', false],
      ['2-design', false],
      ['1-scope', false],
    ]);
    expect(ctxOf(root).keys.bindings().filter((b) => b.key === 'j' || b.key === 'k')).toEqual([
      { key: 'j', label: 'Next section' },
      { key: 'k', label: 'Previous section' },
    ]);
  });

  it('the current section is the last spy event\'s once one has come; before the first section, j goes to it', async () => {
    const s = stage();
    const root = mount();
    await enhance(root);
    const h = sections(root, s);
    const { events } = ctxOf(root);
    events.emit('spy', { section: h['3-plan'] as HTMLElement, unit: null });
    key(h['1-scope'] as HTMLElement, 'j');
    expect(s.intoView.at(-1)?.[0]).toBe(h['where-things-stand']);
    events.emit('spy', { section: null, unit: null });
    key(h['1-scope'] as HTMLElement, 'j');
    expect(s.intoView.at(-1)?.[0]).toBe(h['in-short']);
    events.emit('spy', { section: null, unit: null });
    expect(key(h['1-scope'] as HTMLElement, 'k').defaultPrevented).toBe(false);
  });

  it('the reading line is 30% down the viewport, but never above 150 px', async () => {
    const s = stage();
    const root = mount();
    await enhance(root);
    const h = sections(root, s);
    s.h = 300; // 30% would be 90 px
    s.y = 280; // Scope is 120 px down
    key(h['1-scope'] as HTMLElement, 'j');
    expect(s.intoView.at(-1)?.[0]).toBe(h['2-design']);
    s.h = 1000; // 300 px
    s.y = 150; // Scope is 250 px down
    key(h['1-scope'] as HTMLElement, 'j');
    expect(s.intoView.at(-1)?.[0]).toBe(h['2-design']);
  });

  it('k measures from the bar\'s bottom: within 40 px below it is still a section\'s start', async () => {
    const s = stage();
    const root = mount();
    await enhance(root);
    const h = sections(root, s);
    const bar = find(root, 'nav.topbar');
    s.y = 1020; // Design is 20 px above the viewport's top
    s.tops.set(bar, s.y + 10); // the bar's bottom is 30 px down
    key(h['1-scope'] as HTMLElement, 'k');
    expect(s.intoView.at(-1)?.[0]).toBe(h['2-design']);
  });

  it('a document with no sections lists neither key', async () => {
    stage();
    const root = mount('Just text.\n');
    await enhance(root);
    expect(ctxOf(root).keys.bindings().filter((b) => b.key === 'j' || b.key === 'k')).toEqual([]);
    expect(key(find(root, 'p'), 'j').defaultPrevented).toBe(false);
  });
});

describe('the section link', () => {
  it('each level-2 and level-3 heading with its own id gets a # link in the anchor slot; In short and a repeated id get none', async () => {
    stage();
    const root = mount();
    await enhance(root);
    const links = Array.from(root.querySelectorAll('a.h-anchor')).map((a) => [
      a.parentElement?.parentElement?.id,
      a.getAttribute('href'),
      a.textContent,
      a.getAttribute('title'),
      a.getAttribute('aria-label'),
      a.hasAttribute(CHROME_ATTR),
      a.parentElement?.className,
      a === a.parentElement?.firstElementChild,
    ]);
    expect(links).toEqual([
      ['1-scope', '#1-scope', '#', 'Link to this section', 'Link to Scope', true, 'h-ctl', true],
      ['2-design', '#2-design', '#', 'Link to this section', 'Link to Design', true, 'h-ctl', true],
      ['details', '#details', '#', 'Link to this section', 'Link to Details', true, 'h-ctl', true],
      ['details-1', '#details-1', '#', 'Link to this section', 'Link to Details', true, 'h-ctl', true],
      ['3-plan', '#3-plan', '#', 'Link to this section', 'Link to Plan', true, 'h-ctl', true],
      ['where-things-stand', '#where-things-stand', '#', 'Link to this section', 'Link to Where things stand', true, 'h-ctl', true],
      ['agreed', '#agreed', '#', 'Link to this section', 'Link to Agreed', true, 'h-ctl', true],
    ]);
    expect(el(root, 'h2', 'in-short').querySelector('a.h-anchor')).toBeNull();
    expect(el(root, 'h2', '2-design').getAttribute('aria-label')).toBe('2. Design');
    await destroyEnhancement(root);
    expect(root.querySelectorAll('a.h-anchor, .h-ctl')).toHaveLength(0);
  });

  it('a control a feature put in a heading before it (a chrome button) is no part of the link\'s name', async () => {
    stage();
    hooks.before.push({
      name: 'button',
      build: (ctx: FeatureContext) => {
        const b = document.createElement('button');
        b.setAttribute(CHROME_ATTR, '');
        b.textContent = 'Outline';
        ctx.journal.insert(b, el(ctx.root, 'h3', 'details'), null);
      },
    } satisfies Feature);
    const root = mount();
    await enhance(root);
    expect(find(el(root, 'h3', 'details'), 'a.h-anchor').getAttribute('aria-label')).toBe('Link to Details');
  });

  it('a heading whose id another heading holds first gets none; a click on the link goes to its heading with push', async () => {
    stage();
    const onHash = vi.fn();
    const root = mount('# T\n\n## One\n\nText.\n\n<!-- id:two -->\n\n## Two\n\nMore.\n\n## Three\n\nEnd.\n');
    await enhance(root, { onHash });
    expect(Array.from(root.querySelectorAll('a.h-anchor')).map((a) => a.getAttribute('href'))).toEqual(['#one', '#three']);
    click(find(root, 'a.h-anchor'));
    expect(onHash.mock.calls).toEqual([['one', { push: true, from: null }]]);
    expect(document.activeElement).toBe(el(root, 'h2', 'one'));
    expect(current?.intoView.at(-1)?.[0]).toBe(el(root, 'h2', 'one'));
  });
});
