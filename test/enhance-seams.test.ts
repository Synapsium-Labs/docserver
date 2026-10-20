// @vitest-environment jsdom
// The seams of `./enhance` (docserver L2, Task 7a): the root's window behind one module (env.ts), feature
// registration in the final build order and the second phase (features.ts, the lifecycle), the reading position and
// the reader-wide UI memory in the reader state (LD8), section 0's units and fingerprints, per-instance chrome ids
// (RF2), the text helpers, every word list (vocab.ts) and the status marks reading them, and journal.setStyle (LD11).
//
// The feature list and the vocabulary are mocked with pass-throughs: features() is the real list followed by the
// probes a test adds, and createVocab() compiles a test's word lists when one is set, else the real defaults. So a
// probe feature runs inside a real startup, after every real one.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance, type EnhanceOptions, type ReaderStorage } from '../src/enhance/index.js';
import type { Feature } from '../src/enhance/features.js';
import { CHROME_ATTR, createJournal, IMPORTANT_STYLE_PROPS, STYLE_PROPS } from '../src/enhance/journal.js';
import { chromeIdsIssued, contextOf } from '../src/enhance/lifecycle.js';
import { docKey, posKeyOf, PREFS_KEY, UI_KEY } from '../src/enhance/state.js';
import { statusOf } from '../src/enhance/status.js';
import { sectionMinutes } from '../src/enhance/reading.js';
import { before, clip, colourKey, hash, inOrder } from '../src/enhance/text.js';
import type { FeatureContext } from '../src/enhance/types.js';
import { compileVocab, defaultVocabulary, type VocabularyWords } from '../src/enhance/vocab.js';
import { render } from '../src/render/index.js';

const hooks = vi.hoisted(() => ({ probes: [] as unknown[], words: null as unknown }));

vi.mock('../src/enhance/features.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/enhance/features.js')>();
  return { ...real, features: () => [...real.features(), ...(hooks.probes as Feature[])] };
});

vi.mock('../src/enhance/vocab.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/enhance/vocab.js')>();
  return {
    ...real,
    createVocab: (options: Parameters<typeof real.createVocab>[0]) =>
      hooks.words === null ? real.createVocab(options) : real.compileVocab(hooks.words as VocabularyWords),
  };
});

const ENHANCE_DIR = path.join(import.meta.dirname, '..', 'src', 'enhance');

const DOC = [
  '# Example spec',
  '',
  '**Spec** · 2026-10-19 · Status: Draft',
  '',
  '## 1. Scope',
  '',
  'What this example covers.',
  '',
  '```js',
  'const a = 1;',
  '```',
  '',
  '## 2. Design',
  '',
  'How it works.',
  '',
  '| Item | Status |',
  '|---|---|',
  '| One | Agreed, see above |',
  '| Two | Pending |',
  '',
  '## 3. Plan',
  '',
  'Plan text.',
  '',
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

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
  hooks.probes.length = 0;
  hooks.words = null;
  vi.restoreAllMocks();
});

function ctxOf(root: HTMLElement): FeatureContext {
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('no context: the root is not enhanced');
  return ctx;
}

type View = Window & typeof globalThis;
const viewOf = (root: HTMLElement): View => root.ownerDocument.defaultView as View;
/** The window as a plain record, for a test that adds or removes one of its members. */
const windowRecord = (root: HTMLElement): Record<string, unknown> => root.ownerDocument.defaultView as unknown as Record<string, unknown>;

/** Let queued promise reactions run. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

/** Resolve after `ms` of real time. */
const wait = (ms: number): Promise<void> =>
  new Promise((r) => {
    setTimeout(r, ms);
  });

/** Capture what the window's scheduler is given, without scheduling it: the test runs it by hand. */
function captureScheduler(view: View, set: 'setTimeout' | 'requestAnimationFrame', clear: 'clearTimeout' | 'cancelAnimationFrame') {
  const queued: (() => void)[] = [];
  const cleared: unknown[] = [];
  vi.spyOn(view, set).mockImplementation(((fn: () => void) => {
    queued.push(fn);
    return queued.length;
  }) as never);
  vi.spyOn(view, clear).mockImplementation(((id: number) => {
    cleared.push(id);
  }) as never);
  return { queued, cleared };
}

describe('env: the root\'s window behind one module (RF5)', () => {
  it('timeout, frame and idle run their callback inside an operation of the instance', async () => {
    const root = mount();
    await enhance(root);
    const ctx = ctxOf(root);
    const seen: string[] = [];
    // A destroy requested inside a callback waits for the callback to return: it ran inside an operation.
    ctx.env.timeout(() => {
      void destroyEnhancement(root);
      seen.push(`timeout: still enhanced ${String(root.hasAttribute('data-docreader-root'))}`);
    }, 0);
    await wait(30);
    expect(seen).toEqual(['timeout: still enhanced true']);
    expect(root.hasAttribute('data-docreader-root')).toBe(false);

    const second = mount();
    await enhance(second);
    const c2 = ctxOf(second);
    c2.env.frame(() => {
      void destroyEnhancement(second);
      seen.push(`frame: still enhanced ${String(second.hasAttribute('data-docreader-root'))}`);
    });
    await wait(60);
    expect(seen).toEqual(['timeout: still enhanced true', 'frame: still enhanced true']);

    const third = mount();
    await enhance(third);
    ctxOf(third).env.idle(() => {
      void destroyEnhancement(third);
      seen.push(`idle: still enhanced ${String(third.hasAttribute('data-docreader-root'))}`);
    }, 50);
    await wait(300);
    expect(seen).toEqual(['timeout: still enhanced true', 'frame: still enhanced true', 'idle: still enhanced true']);
  });

  it('destroy cancels every pending timeout, frame and idle callback with the window\'s own cancel', async () => {
    const root = mount();
    await enhance(root);
    const view = viewOf(root);
    const timers = captureScheduler(view, 'setTimeout', 'clearTimeout');
    const frames = captureScheduler(view, 'requestAnimationFrame', 'cancelAnimationFrame');
    const env = ctxOf(root).env;
    const ran: string[] = [];
    env.timeout(() => ran.push('timeout'), 100);
    env.frame(() => ran.push('frame'));
    env.idle(() => ran.push('idle')); // no requestIdleCallback in jsdom: a timeout stands in
    expect([timers.queued.length, frames.queued.length]).toEqual([2, 1]);
    await destroyEnhancement(root);
    expect(timers.cleared.sort()).toEqual([1, 2]);
    expect(frames.cleared).toEqual([1]);
    expect(ran).toEqual([]);
  });

  it('a callback already queued when the instance is destroyed does nothing', async () => {
    const root = mount();
    await enhance(root);
    const view = viewOf(root);
    const timers = captureScheduler(view, 'setTimeout', 'clearTimeout');
    const frames = captureScheduler(view, 'requestAnimationFrame', 'cancelAnimationFrame');
    const env = ctxOf(root).env;
    const ran: string[] = [];
    env.timeout(() => ran.push('timeout'), 10);
    env.frame(() => ran.push('frame'));
    await destroyEnhancement(root);
    for (const fn of [...timers.queued, ...frames.queued]) fn(); // the window ran them anyway
    expect(ran).toEqual([]);
  });

  it('each schedule returns its own cancel, which cancels that one alone', async () => {
    const root = mount();
    await enhance(root);
    const view = viewOf(root);
    const timers = captureScheduler(view, 'setTimeout', 'clearTimeout');
    const env = ctxOf(root).env;
    const ran: string[] = [];
    const cancelA = env.timeout(() => ran.push('a'), 10);
    env.timeout(() => ran.push('b'), 10);
    cancelA();
    expect(timers.cleared).toEqual([1]);
    for (const fn of timers.queued) fn();
    expect(ran).toEqual(['b']);
    // After it ran, its handle is gone: destroy has only nothing left to clear.
    timers.cleared.length = 0;
    await destroyEnhancement(root);
    expect(timers.cleared).toEqual([]);
  });

  it('a timeout delay is clamped to a finite, non-negative number', async () => {
    const root = mount();
    await enhance(root);
    const view = viewOf(root);
    const delays: unknown[] = [];
    vi.spyOn(view, 'setTimeout').mockImplementation(((_fn: () => void, ms: number) => {
      delays.push(ms);
      return delays.length;
    }) as never);
    const env = ctxOf(root).env;
    for (const ms of [-5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 40, 25]) env.timeout(() => undefined, ms);
    expect(delays).toEqual([0, 0, 2 ** 31 - 1, 2 ** 31 - 1, 25]);
  });

  it('idle waits through requestIdleCallback, with its bound, where the window has one', async () => {
    const root = mount();
    await enhance(root);
    const view = windowRecord(root);
    const calls: unknown[] = [];
    const cancelled: unknown[] = [];
    let queued: (() => void) | null = null;
    view['requestIdleCallback'] = (fn: () => void, opts: unknown) => {
      queued = fn;
      calls.push(opts);
      return 7;
    };
    view['cancelIdleCallback'] = (id: unknown) => {
      cancelled.push(id);
    };
    try {
      const ran: string[] = [];
      ctxOf(root).env.idle(() => ran.push('idle'), 1234);
      expect(calls).toEqual([{ timeout: 1234 }]);
      (queued as unknown as () => void)();
      expect(ran).toEqual(['idle']);
      ctxOf(root).env.idle(() => ran.push('again'));
      expect(calls).toEqual([{ timeout: 1234 }, { timeout: 2000 }]);
      await destroyEnhancement(root);
      expect(cancelled).toEqual([7]);
    } finally {
      delete view['requestIdleCallback'];
      delete view['cancelIdleCallback'];
    }
  });

  it('onScroll, onResize, onPrint and onPageHide listen on the window inside operations, and destroy removes them', async () => {
    const root = mount('# Not a document\n\nNo sections, so no folds listen for printing.\n');
    await enhance(root);
    const view = viewOf(root);
    const env = ctxOf(root).env;
    const seen: string[] = [];
    env.onScroll(() => seen.push('scroll'));
    env.onResize(() => seen.push('resize'));
    env.onPrint((printing) => seen.push(`print ${String(printing)}`));
    env.onPageHide(() => seen.push('pagehide'));
    for (const t of ['scroll', 'resize', 'beforeprint', 'afterprint', 'pagehide']) view.dispatchEvent(new Event(t));
    expect(seen).toEqual(['scroll', 'resize', 'print true', 'print false', 'pagehide']);
    const removed: string[] = [];
    const remove = view.removeEventListener.bind(view);
    vi.spyOn(view, 'removeEventListener').mockImplementation(((type: string, fn: EventListener, o?: unknown) => {
      removed.push(type);
      remove(type, fn, o as boolean);
    }) as never);
    await destroyEnhancement(root);
    expect(removed.sort()).toEqual(['afterprint', 'beforeprint', 'pagehide', 'resize', 'scroll']);
    for (const t of ['scroll', 'resize', 'beforeprint', 'afterprint', 'pagehide']) view.dispatchEvent(new Event(t));
    expect(seen).toHaveLength(5);
  });

  it('a window listener cancelled by its own handle stops at once', async () => {
    const root = mount();
    await enhance(root);
    const view = viewOf(root);
    const seen: string[] = [];
    const stop = ctxOf(root).env.onScroll(() => seen.push('scroll'));
    view.dispatchEvent(new Event('scroll'));
    stop();
    view.dispatchEvent(new Event('scroll'));
    expect(seen).toEqual(['scroll']);
  });

  it('a scroll handler that destroys the instance runs to its end first, inside the operation', async () => {
    const root = mount();
    await enhance(root);
    const seen: boolean[] = [];
    ctxOf(root).env.onScroll(() => {
      void destroyEnhancement(root);
      seen.push(root.hasAttribute('data-docreader-root'));
    });
    viewOf(root).dispatchEvent(new Event('scroll'));
    expect(seen).toEqual([true]);
    expect(root.hasAttribute('data-docreader-root')).toBe(false);
  });

  it('matches and reducedMotion read the window\'s media queries; without matchMedia they are false', async () => {
    const root = mount();
    await enhance(root);
    const view = windowRecord(root);
    const env = ctxOf(root).env;
    expect([env.matches('(min-width: 700px)'), env.reducedMotion()]).toEqual([false, false]);
    const asked: string[] = [];
    view['matchMedia'] = (q: string) => {
      asked.push(q);
      return { matches: q === '(prefers-reduced-motion: reduce)' || q === '(min-width: 700px)' };
    };
    try {
      expect([env.matches('(min-width: 700px)'), env.matches('(max-width: 10px)'), env.reducedMotion()]).toEqual([true, false, true]);
      expect(asked).toEqual(['(min-width: 700px)', '(max-width: 10px)', '(prefers-reduced-motion: reduce)']);
    } finally {
      delete view['matchMedia'];
    }
  });

  it('viewport reads the window\'s width, height and scroll position; scrollTo scrolls it, smoothly only when motion is allowed', async () => {
    const root = mount();
    await enhance(root);
    const view = viewOf(root);
    const record = windowRecord(root);
    const env = ctxOf(root).env;
    expect(env.viewport()).toEqual({ w: view.innerWidth, h: view.innerHeight, scrollY: view.scrollY });
    expect(Object.isFrozen(env.viewport())).toBe(true);
    const scrolled: unknown[] = [];
    vi.spyOn(view, 'scrollTo').mockImplementation(((o: unknown) => {
      scrolled.push(o);
    }) as never);
    env.scrollTo(120);
    env.scrollTo(240, true);
    record['matchMedia'] = (q: string) => ({ matches: q === '(prefers-reduced-motion: reduce)' });
    try {
      env.scrollTo(360, true);
    } finally {
      delete record['matchMedia'];
    }
    env.scrollTo(Number.NaN);
    expect(scrolled).toEqual([
      { top: 120, behavior: 'auto' },
      { top: 240, behavior: 'smooth' },
      { top: 360, behavior: 'auto' },
    ]);
  });

  it('fonts: false at once without a font set; true once the faces load; false when the wait runs out', async () => {
    const root = mount();
    await enhance(root);
    const env = ctxOf(root).env;
    expect(await env.fonts(1000)).toBe(false);
    const loads: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    Object.defineProperty(root.ownerDocument, 'fonts', {
      configurable: true,
      value: {
        load: (spec: string) => {
          loads.push(spec);
          return gate.then(() => []);
        },
      },
    });
    try {
      const loaded = env.fonts(5000);
      expect(loads).toEqual(['1em "Docreader Serif"', '1em "Docreader Sans"']);
      release();
      expect(await loaded).toBe(true);
      Object.defineProperty(root.ownerDocument, 'fonts', { configurable: true, value: { load: () => new Promise(() => undefined) } });
      expect(await env.fonts(20)).toBe(false);
      Object.defineProperty(root.ownerDocument, 'fonts', { configurable: true, value: { load: () => Promise.reject(new Error('no face')) } });
      expect(await env.fonts(1000)).toBe(false);
    } finally {
      delete (root.ownerDocument as { fonts?: unknown }).fonts;
    }
  });

  it('fonts: a wait that ends after destroy never settles, so nothing after it runs (RF5)', async () => {
    const root = mount();
    await enhance(root);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    Object.defineProperty(root.ownerDocument, 'fonts', { configurable: true, value: { load: () => gate.then(() => []) } });
    try {
      const env = ctxOf(root).env;
      const loaded = env.fonts(40);
      const timedOut = env.fonts(40);
      let settled = 0;
      void loaded.then(() => (settled += 1));
      void timedOut.then(() => (settled += 1));
      await destroyEnhancement(root);
      release();
      await wait(80);
      await flush();
      expect(settled).toBe(0);
      // and a wait asked for once the instance is gone never settles either
      let late = 0;
      void env.fonts(1).then(() => (late += 1));
      await wait(20);
      expect(late).toBe(0);
    } finally {
      delete (root.ownerDocument as { fonts?: unknown }).fonts;
    }
  });

  it('observeResize and observeIntersection: null without the API; otherwise callbacks inside operations, cancelled by destroy', async () => {
    const root = mount();
    await enhance(root);
    const env = ctxOf(root).env;
    expect([env.observeResize(() => undefined), env.observeIntersection(() => undefined)]).toEqual([null, null]);
    const view = windowRecord(root);
    const made: { kind: string; cb: (entries: unknown[]) => void; init: unknown; observed: Element[]; disconnected: number }[] = [];
    const fake = (kind: string) =>
      class {
        private readonly rec;
        constructor(cb: (entries: unknown[]) => void, init?: unknown) {
          this.rec = { kind, cb, init, observed: [] as Element[], disconnected: 0 };
          made.push(this.rec);
        }
        observe(el: Element): void {
          this.rec.observed.push(el);
        }
        unobserve(el: Element): void {
          this.rec.observed = this.rec.observed.filter((x) => x !== el);
        }
        disconnect(): void {
          this.rec.disconnected += 1;
        }
      };
    view['ResizeObserver'] = fake('resize');
    view['IntersectionObserver'] = fake('intersection');
    try {
      const seen: unknown[] = [];
      const fig = root.querySelector('h2') as Element;
      const ro = env.observeResize((changes) => {
        seen.push(changes);
        void destroyEnhancement(root);
        seen.push(root.hasAttribute('data-docreader-root'));
      });
      const io = env.observeIntersection((changes) => seen.push(changes), { rootMargin: '100px', threshold: 0.5 });
      ro?.observe(fig);
      io?.observe(fig);
      io?.unobserve(fig);
      const [r, i] = made as [(typeof made)[0], (typeof made)[0]];
      expect([r.kind, i.kind, i.init, r.observed.length, i.observed.length]).toEqual(['resize', 'intersection', { rootMargin: '100px', threshold: 0.5 }, 1, 0]);
      i.cb([{ target: fig, isIntersecting: true, intersectionRatio: 0.75 }]);
      expect(seen).toEqual([[{ target: fig, isIntersecting: true, ratio: 0.75 }]]);
      r.cb([{ target: fig, contentRect: { width: 300, height: 40 } }]);
      expect(seen.slice(1)).toEqual([[{ target: fig, width: 300, height: 40 }], true]);
      await flush();
      expect(root.hasAttribute('data-docreader-root')).toBe(false);
      expect([r.disconnected, i.disconnected]).toEqual([1, 1]);
      i.cb([{ target: fig, isIntersecting: false, intersectionRatio: 0 }]); // already queued: does nothing
      expect(seen).toHaveLength(3);
    } finally {
      delete view['ResizeObserver'];
      delete view['IntersectionObserver'];
    }
  });

  it('an observer cancelled by its own handle disconnects once, and destroy leaves it alone', async () => {
    const root = mount();
    await enhance(root);
    const view = windowRecord(root);
    let disconnected = 0;
    view['ResizeObserver'] = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {
        disconnected += 1;
      }
    };
    try {
      const ro = ctxOf(root).env.observeResize(() => undefined);
      ro?.cancel();
      await destroyEnhancement(root);
      expect(disconnected).toBe(1);
    } finally {
      delete view['ResizeObserver'];
    }
  });

  it('textWidth is null without a canvas context, and measures with one', async () => {
    const root = mount();
    await enhance(root);
    const env = ctxOf(root).env;
    const proto = (viewOf(root) as View).HTMLCanvasElement.prototype;
    vi.spyOn(proto, 'getContext').mockImplementation((() => null) as never);
    expect(env.textWidth('0123456789', '12px monospace')).toBeNull();
    vi.restoreAllMocks();
    const second = mount();
    await enhance(second);
    const fonts: string[] = [];
    vi.spyOn(proto, 'getContext').mockImplementation((() => ({
      set font(f: string) {
        fonts.push(f);
      },
      measureText: (t: string) => ({ width: t.length * 7.5 }),
    })) as never);
    expect(ctxOf(second).env.textWidth('0123456789', '12px monospace')).toBe(75);
    expect(fonts).toEqual(['12px monospace']);
  });

  it('now is the clock, and elementFromPoint answers only inside the root', async () => {
    const root = mount();
    await enhance(root);
    const env = ctxOf(root).env;
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    expect(env.now()).toBe(1_700_000_000_000);
    expect(env.elementFromPoint(10, 10)).toBeNull(); // jsdom has no elementFromPoint
    const doc = root.ownerDocument;
    const record = doc as unknown as Record<string, unknown>;
    const inside = root.querySelector('p') as Element;
    const outside = doc.createElement('aside');
    doc.body.append(outside);
    let hit: Element | null = inside;
    record['elementFromPoint'] = () => hit;
    try {
      expect(env.elementFromPoint(10, 10)).toBe(inside);
      hit = outside;
      expect(env.elementFromPoint(10, 10)).toBeNull();
      hit = root;
      expect(env.elementFromPoint(10, 10)).toBe(root);
      hit = null;
      expect(env.elementFromPoint(10, 10)).toBeNull();
    } finally {
      delete record['elementFromPoint'];
    }
  });

  it('computed reads a computed value of an element inside the root', async () => {
    const root = mount();
    await enhance(root);
    const env = ctxOf(root).env;
    expect(env.computed(root, 'display')).toBe('block');
    const outside = root.ownerDocument.createElement('aside');
    root.ownerDocument.body.append(outside);
    expect(env.computed(outside, 'display')).toBe('');
  });

  it('a root in a document with no window: nothing is scheduled or heard, and nothing throws', async () => {
    const doc = document.implementation.createHTMLDocument('no window');
    const root = mount(DOC, doc);
    await enhance(root);
    const env = ctxOf(root).env;
    const ran: string[] = [];
    const cancels = [env.timeout(() => ran.push('t'), 0), env.frame(() => ran.push('f')), env.idle(() => ran.push('i'), 1)];
    const stops = [env.onScroll(() => ran.push('s')), env.onResize(() => ran.push('r')), env.onPrint(() => ran.push('p')), env.onPageHide(() => ran.push('h'))];
    for (const c of [...cancels, ...stops]) c();
    expect([env.matches('(min-width: 1px)'), env.reducedMotion(), env.viewport(), env.observeResize(() => undefined), env.observeIntersection(() => undefined), env.computed(root, 'display')]).toEqual([
      false,
      false,
      { w: 0, h: 0, scrollY: 0 },
      null,
      null,
      '',
    ]);
    env.scrollTo(10);
    expect(await env.fonts(1)).toBe(false);
    await wait(30);
    expect(ran).toEqual([]);
    await destroyEnhancement(root);
  });
});

describe('journal.setStyle (LD11): the only style write, through the CSSOM', () => {
  const journalFor = (live = () => true) => createJournal(live, (fn) => fn());

  it('the closed list is the plan\'s, and fill, stroke and stroke-width go only with important', () => {
    expect([...STYLE_PROPS]).toEqual([
      '--thead-h', '--fig-w', '--bar-h', 'left', 'top', 'right', 'width', 'max-height', 'transform', 'opacity', 'stroke-dasharray', 'stroke-dashoffset',
    ]);
    expect([...IMPORTANT_STYLE_PROPS]).toEqual(['fill', 'stroke', 'stroke-width']);
  });

  it('every listed name is written, and undo restores the element byte for byte (no style attribute left)', () => {
    const { journal, undoAll } = journalFor();
    const el = document.createElement('div');
    const before = el.outerHTML;
    for (const p of STYLE_PROPS) journal.setStyle(el, p, p === 'opacity' ? '0.5' : p === 'transform' ? 'translateX(3px)' : p === 'stroke-dasharray' ? '5 5' : '12px');
    for (const p of IMPORTANT_STYLE_PROPS) journal.setStyle(el, p, p === 'stroke-width' ? '2px' : 'red', true);
    expect(el.style.length).toBe(STYLE_PROPS.length + IMPORTANT_STYLE_PROPS.length);
    expect([el.style.getPropertyValue('--bar-h'), el.style.getPropertyPriority('fill'), el.style.getPropertyPriority('width')]).toEqual(['12px', 'important', '']);
    expect(undoAll()).toEqual([]);
    expect(el.outerHTML).toBe(before);
  });

  it('a value written twice is restored to the original, once', () => {
    const { journal, undoAll } = journalFor();
    const el = document.createElement('div');
    journal.setStyle(el, 'width', '10px');
    journal.setStyle(el, 'width', '20px');
    expect(el.style.getPropertyValue('width')).toBe('20px');
    undoAll();
    expect(el.hasAttribute('style')).toBe(false);
  });

  it('null removes the property; undo puts the original back', () => {
    const { journal, undoAll } = journalFor();
    const el = document.createElement('div');
    el.style.setProperty('left', '4px'); // the host's own
    journal.setStyle(el, 'left', null);
    expect(el.style.getPropertyValue('left')).toBe('');
    undoAll();
    expect(el.style.getPropertyValue('left')).toBe('4px');
  });

  it('restores conditionally: a value or a priority the host changed since stays the host\'s', () => {
    const { journal, undoAll } = journalFor();
    const a = document.createElement('div');
    const b = document.createElement('div');
    journal.setStyle(a, 'width', '10px');
    journal.setStyle(b, 'fill', 'red', true);
    a.style.setProperty('width', '99px');
    b.style.setProperty('fill', 'red'); // same value, priority dropped by the host
    undoAll();
    expect([a.style.getPropertyValue('width'), b.style.getPropertyValue('fill'), b.style.getPropertyPriority('fill')]).toEqual(['99px', 'red', '']);
  });

  it('a host\'s own declarations survive, and the attribute stays when the host had one', () => {
    const { journal, undoAll } = journalFor();
    const el = document.createElement('div');
    el.style.setProperty('color', 'red');
    el.style.setProperty('opacity', '0.25', 'important');
    journal.setStyle(el, 'width', '10px');
    journal.setStyle(el, 'opacity', '0.5');
    undoAll();
    expect([el.style.getPropertyValue('color'), el.style.getPropertyValue('opacity'), el.style.getPropertyPriority('opacity'), el.style.getPropertyValue('width')]).toEqual([
      'red',
      '0.25',
      'important',
      '',
    ]);
    expect(el.hasAttribute('style')).toBe(true);
  });

  it('an element the host gave an inline style after the library\'s first write keeps it, attribute and all', () => {
    const { journal, undoAll } = journalFor();
    const el = document.createElement('div');
    journal.setStyle(el, 'width', '10px');
    el.style.setProperty('color', 'blue');
    undoAll();
    expect([el.style.getPropertyValue('color'), el.style.getPropertyValue('width')]).toEqual(['blue', '']);
  });

  it('refuses a name off the list', () => {
    const { journal } = journalFor();
    const el = document.createElement('div');
    for (const p of ['color', 'background', 'position', 'display', '--x', 'background-image', 'content', 'LEFT', ' width']) {
      expect(() => journal.setStyle(el, p as never, '1px'), p).toThrow(/setStyle/);
    }
    expect(el.hasAttribute('style')).toBe(false);
  });

  it('takes important only for fill, stroke and stroke-width, and those only with it', () => {
    const { journal } = journalFor();
    const el = document.createElement('div');
    for (const p of STYLE_PROPS) expect(() => journal.setStyle(el, p, '1px', true), p).toThrow(/important/);
    for (const p of IMPORTANT_STYLE_PROPS) expect(() => journal.setStyle(el, p, 'red'), p).toThrow(/important/);
    for (const p of IMPORTANT_STYLE_PROPS) expect(() => journal.setStyle(el, p, 'red', false), p).toThrow(/important/);
    expect(el.hasAttribute('style')).toBe(false);
  });

  it('refuses a value that could load a resource, escape or end the declaration, or is over 200 code units', () => {
    const { journal } = journalFor();
    const el = document.createElement('div');
    const bad = [
      'url(x)', 'URL (x)', 'image-set("a" 1x)', '-webkit-image-set(x)', 'image(x)', 'src(x)', 'cross-fade(a, b)', 'element(#a)', 'paint(x)',
      'var(--a) url(x)', '1px\\9', '1px; color: red', '1px }', '{ x', 'x'.repeat(201),
    ];
    for (const v of bad) expect(() => journal.setStyle(el, '--fig-w', v), v).toThrow(/value/);
    journal.setStyle(el, '--fig-w', 'calc(100% - 12px)');
    journal.setStyle(el, 'transform', 'translate(10px, 20px) scale(1.5)');
    journal.setStyle(el, '--thead-h', 'x'.repeat(200));
    expect(el.style.getPropertyValue('transform')).toBe('translate(10px, 20px) scale(1.5)');
  });

  it('writes nothing once the instance is not live', () => {
    let live = true;
    const { journal } = journalFor(() => live);
    const el = document.createElement('div');
    live = false;
    journal.setStyle(el, 'width', '10px');
    expect(el.hasAttribute('style')).toBe(false);
  });

  it('through enhance: a style written by a feature is undone by destroy', async () => {
    const root = mount();
    const before = root.outerHTML;
    hooks.probes.push({
      name: 'probe',
      build: (ctx: FeatureContext) => {
        ctx.journal.setStyle(ctx.root, '--bar-h', '48px');
      },
    });
    await enhance(root);
    expect(root.style.getPropertyValue('--bar-h')).toBe('48px');
    await destroyEnhancement(root);
    expect(root.outerHTML).toBe(before);
  });
});

/** A storage whose snapshot records every key read, and whose set() records every call. */
function recordingStorage(values: Record<string, string> = {}): { storage: ReaderStorage; reads: string[]; calls: [string, string | null][] } {
  const reads: string[] = [];
  const calls: [string, string | null][] = [];
  const snapshot = new Proxy(values, {
    get(t, key) {
      reads.push(String(key));
      return t[String(key)];
    },
  });
  return { storage: { snapshot, set: (k, v) => void calls.push([k, v]) }, reads, calls };
}

describe('reader state: the reading position and the UI memory (LD8)', () => {
  it('the keys: docreader:pos:<posKey> and docreader:ui, beside the prototype\'s two', () => {
    expect([PREFS_KEY, UI_KEY, posKeyOf('project-a:specs:x.md'), docKey('k', 'folds')]).toEqual([
      'docreader:prefs',
      'docreader:ui',
      'docreader:pos:project-a:specs:x.md',
      'docreader:doc:k:folds',
    ]);
  });

  it('each is read from the snapshot during startup, once, and returned as stored (unknown)', async () => {
    const root = mount();
    const { storage, reads } = recordingStorage({
      [posKeyOf('p')]: JSON.stringify({ line: '12-14', offset: 40, y: 900 }),
      [UI_KEY]: JSON.stringify({ sidetab: 'index', other: 7 }),
    });
    const got: unknown[] = [];
    hooks.probes.push({
      name: 'probe',
      build: (ctx: FeatureContext) => {
        got.push(ctx.state.readPos('p'), ctx.state.readPos('p'), ctx.state.readUi('sidetab'), ctx.state.readUi('other'), ctx.state.readUi('none'));
      },
    });
    await enhance(root, { storage, storageKey: 'k' });
    expect(got).toEqual([{ line: '12-14', offset: 40, y: 900 }, { line: '12-14', offset: 40, y: 900 }, 'index', 7, undefined]);
    expect(reads.filter((k) => k === posKeyOf('p') || k === UI_KEY)).toEqual([posKeyOf('p'), UI_KEY]);
  });

  it('after startup a key never read is not read: it reads as absent', async () => {
    const root = mount();
    const { storage, reads } = recordingStorage({ [posKeyOf('p')]: '{"y":1}', [UI_KEY]: '{"sidetab":"index"}' });
    await enhance(root, { storage, storageKey: 'k' });
    const ctx = ctxOf(root);
    expect([ctx.state.readPos('p'), ctx.state.readUi('sidetab')]).toEqual([undefined, undefined]);
    expect(reads).toEqual([PREFS_KEY, docKey('k', 'folds')]);
  });

  it('writePos writes behind, as JSON, under the position key; null deletes it; the local value reads back', async () => {
    const root = mount();
    const { storage, calls } = recordingStorage();
    await enhance(root, { storage });
    const ctx = ctxOf(root);
    ctx.state.writePos('p', { line: '3', offset: 0, y: 10 });
    expect(ctx.state.readPos('p')).toEqual({ line: '3', offset: 0, y: 10 });
    ctx.state.writePos('p', null);
    expect(calls).toEqual([
      [posKeyOf('p'), '{"line":"3","offset":0,"y":10}'],
      [posKeyOf('p'), null],
    ]);
  });

  it('without storage the position and the UI memory are local only', async () => {
    const root = mount();
    await enhance(root);
    const ctx = ctxOf(root);
    ctx.state.writePos('p', { y: 3 });
    ctx.state.writeUi('sidetab', 'index');
    expect([ctx.state.readPos('p'), ctx.state.readUi('sidetab')]).toEqual([{ y: 3 }, 'index']);
  });

  it('writeUi merges one field into the stored object, keeping the fields it does not know; null deletes a field', async () => {
    const root = mount();
    const { storage, calls } = recordingStorage({ [UI_KEY]: JSON.stringify({ later: 'kept', sidetab: 'contents' }) });
    hooks.probes.push({
      name: 'probe',
      build: (ctx: FeatureContext) => {
        ctx.state.readUi('sidetab');
      },
    });
    await enhance(root, { storage });
    const ctx = ctxOf(root);
    ctx.state.writeUi('sidetab', 'index');
    ctx.state.writeUi('sidetab', 'index'); // unchanged: no call
    ctx.state.writeUi('later', null);
    expect(ctx.state.readUi('sidetab')).toBe('index');
    expect(calls).toEqual([
      [UI_KEY, JSON.stringify({ later: 'kept', sidetab: 'index' })],
      [UI_KEY, JSON.stringify({ sidetab: 'index' })],
    ]);
  });

  it('a UI write after startup, with the key never read, stays local: the stored fields it cannot see are never overwritten', async () => {
    const root = mount();
    const { storage, calls } = recordingStorage({ [UI_KEY]: JSON.stringify({ later: 'kept' }) });
    await enhance(root, { storage });
    const ctx = ctxOf(root);
    ctx.state.writeUi('sidetab', 'index');
    expect(ctx.state.readUi('sidetab')).toBe('index');
    expect(calls).toEqual([]);
  });

  it('a field named like a prototype key reads as absent and round-trips as an own field', async () => {
    const root = mount();
    const { storage, calls } = recordingStorage({ [UI_KEY]: '{"__proto__":{"polluted":1},"x":1}' });
    const got: unknown[] = [];
    hooks.probes.push({
      name: 'probe',
      build: (ctx: FeatureContext) => {
        got.push(ctx.state.readUi('constructor'), ctx.state.readUi('toString'), ctx.state.readUi('hasOwnProperty'));
        ctx.state.writeUi('constructor', 'c');
      },
    });
    await enhance(root, { storage });
    expect(got).toEqual([undefined, undefined, undefined]);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(calls).toEqual([[UI_KEY, '{"__proto__":{"polluted":1},"x":1,"constructor":"c"}']]);
  });

  it('a stored UI value that is not an object is ignored, and the first write replaces it', async () => {
    for (const raw of ['not json', '[1,2]', '7', 'null']) {
      const root = mount();
      const { storage, calls } = recordingStorage({ [UI_KEY]: raw });
      hooks.probes.length = 0;
      hooks.probes.push({
        name: 'probe',
        build: (ctx: FeatureContext) => {
          expect(ctx.state.readUi('sidetab')).toBeUndefined();
          ctx.state.writeUi('sidetab', 'index');
        },
      });
      await enhance(root, { storage });
      expect(calls).toEqual([[UI_KEY, '{"sidetab":"index"}']]);
      await destroyEnhancement(root);
    }
  });

  it('two roots on one storage object: a UI field one wrote is never dropped by the other\'s write', async () => {
    const a = mount();
    const b = mount();
    const calls: [string, string | null][] = [];
    const pending: (() => void)[] = [];
    const storage: ReaderStorage = {
      snapshot: { [UI_KEY]: '{"keep":1}' },
      set: (k, v) => {
        calls.push([k, v]);
        return new Promise<void>((r) => pending.push(r));
      },
    };
    const probe = (field: string): Feature => ({
      name: `probe-${field}`,
      build: (ctx: FeatureContext) => {
        ctx.state.readUi(field);
      },
    });
    hooks.probes.push(probe('x'));
    await enhance(a, { storage });
    hooks.probes.length = 0;
    hooks.probes.push(probe('y'));
    await enhance(b, { storage });
    ctxOf(a).state.writeUi('x', 1); // in flight
    ctxOf(b).state.writeUi('y', 2); // waits, merged over a's queued value
    for (let i = 0; i < 3 && pending.length > 0; i += 1) {
      pending.shift()?.();
      await flush();
    }
    expect(calls).toEqual([
      [UI_KEY, '{"keep":1,"x":1}'],
      [UI_KEY, '{"keep":1,"x":1,"y":2}'],
    ]);
  });

  it('the earlier keys keep their behaviour: the prefs are read first, then this document\'s keys as features ask', async () => {
    const root = mount();
    const { storage, reads } = recordingStorage();
    hooks.probes.push({
      name: 'probe',
      build: (ctx: FeatureContext) => {
        ctx.state.readPos('k');
        ctx.state.readUi('a');
      },
    });
    await enhance(root, { storage, storageKey: 'k' });
    expect(reads).toEqual([PREFS_KEY, docKey('k', 'folds'), posKeyOf('k'), UI_KEY]);
  });
});

/** The reference's section 0 text of a unit: the heading's text, then each block's after a separator (script and dl left out). */
function unitText(heading: Element, members: readonly Element[]): string {
  let t = heading.textContent ?? '';
  for (const m of members) if (m.localName !== 'script' && m.localName !== 'dl') t += `\u0001${m.textContent ?? ''}`;
  return t;
}

describe('sections: section 0\'s units, measured before any node moves', () => {
  it('one unit per level-2 heading with an id among the root\'s children, its blocks up to the next h1 or h2', async () => {
    const md = ['# T', '', 'Lead.', '', '## A', '', 'a1', '', 'a2', '', '## B', '', 'b1', '', '# Other', '', 'o1', '', '## C', '', 'c1', ''].join('\n');
    const plain = mount(md);
    const expected = Array.from(plain.querySelectorAll(':scope > h2')).map((h) => {
      const members: Element[] = [];
      for (let n = h.nextElementSibling; n !== null && n.localName !== 'h1' && n.localName !== 'h2'; n = n.nextElementSibling) members.push(n);
      return { id: h.id, members: members.map((m) => m.textContent), fingerprint: hash(unitText(h, members)) };
    });
    const root = mount(md);
    await enhance(root);
    const { sections } = ctxOf(root);
    expect(sections.map((s) => ({ id: s.heading.id, members: s.members.map((m) => m.textContent), fingerprint: s.fingerprint }))).toEqual(expected);
    expect(sections.map((s) => s.heading.id)).toEqual(['a', 'b', 'c']);
  });

  it('a fingerprint ignores chrome text: it is the source\'s, though the fold controls now sit in every heading', async () => {
    const plain = mount();
    const expected = Array.from(plain.querySelectorAll(':scope > h2')).map((h) => {
      const members: Element[] = [];
      for (let n = h.nextElementSibling; n !== null && n.localName !== 'h1' && n.localName !== 'h2'; n = n.nextElementSibling) members.push(n);
      return hash(unitText(h, members));
    });
    const root = mount();
    await enhance(root);
    expect(root.querySelectorAll(`h2 [${CHROME_ATTR}]`).length).toBeGreaterThan(0);
    const { sections } = ctxOf(root);
    expect(sections.map((s) => s.fingerprint)).toEqual(expected);
    // The section number moved into chrome too, and still counts: it is the source's text.
    expect(sections[0]?.heading.textContent).not.toBe('1. Scope');
  });

  it('a heading with no id ends the unit before it and starts none; script and dl count neither in the fingerprint nor the minutes', async () => {
    const root = mount(DOC);
    const h2s = Array.from(root.querySelectorAll(':scope > h2'));
    (h2s[1] as Element).removeAttribute('id');
    const extra = document.createElement('dl');
    extra.append(document.createElement('dt'));
    (extra.firstChild as Element).textContent = 'not counted';
    (h2s[0] as Element).after(extra);
    const members: Element[] = [];
    for (let n = (h2s[0] as Element).nextElementSibling; n !== null && n !== h2s[1]; n = n.nextElementSibling) members.push(n);
    const text = unitText(h2s[0] as Element, members);
    expect(text).not.toContain('not counted');
    await enhance(root);
    const { sections } = ctxOf(root);
    expect(sections.map((s) => s.heading.id)).toEqual(['1-scope', '3-plan']);
    const first = sections[0];
    expect(first?.members).toEqual(members);
    expect(first?.members[0]).toBe(extra);
    expect(first?.fingerprint).toBe(hash(text));
    expect(first?.minutes).toBe(sectionMinutes(h2s[0] as Element, members.slice(1)) + 0);
  });

  it('the units and their member lists are frozen', async () => {
    const root = mount();
    await enhance(root);
    const { sections } = ctxOf(root);
    expect(Object.isFrozen(sections)).toBe(true);
    for (const s of sections) expect([Object.isFrozen(s), Object.isFrozen(s.members)]).toEqual([true, true]);
  });

  it('minutes are the section\'s reading time, measured on the source before the chrome', async () => {
    const plain = mount();
    const expected = Array.from(plain.querySelectorAll(':scope > h2')).map((h) => {
      const members: Element[] = [];
      for (let n = h.nextElementSibling; n !== null && n.localName !== 'h1' && n.localName !== 'h2'; n = n.nextElementSibling) members.push(n);
      return sectionMinutes(h, members);
    });
    const root = mount();
    await enhance(root);
    const { sections } = ctxOf(root);
    expect(sections.map((s) => s.minutes)).toEqual(expected);
    expect(expected.every((m) => m > 0)).toBe(true);
  });
});

describe('chromeId: per instance, unique in the document (RF2)', () => {
  it('two roots in one document get disjoint ids for the same names', async () => {
    const a = mount();
    const b = mount();
    await enhance(a);
    await enhance(b);
    const ids = (root: HTMLElement): string[] => ['jump', 'keys', 'jump'].map((n) => ctxOf(root).chromeId(n));
    const ia = ids(a);
    const ib = ids(b);
    expect(new Set([...ia, ...ib]).size).toBe(6);
    expect(ia[0]).toMatch(/^docreader-\d+-jump$/);
  });

  it('skips an id the document already has, inside the root or outside it, and one another instance issued', async () => {
    const doc = document.implementation.createHTMLDocument('ids');
    const outside = doc.createElement('div');
    outside.id = 'docreader-1-jump';
    doc.body.append(outside);
    const root = mount(DOC, doc);
    const inside = doc.createElement('p');
    inside.id = 'docreader-1-jump-2';
    root.append(inside);
    await enhance(root);
    const ctx = ctxOf(root);
    expect([ctx.chromeId('jump'), ctx.chromeId('jump'), ctx.chromeId('keys')]).toEqual(['docreader-1-jump-3', 'docreader-1-jump-4', 'docreader-1-keys']);
    // the first instance's own name for 'jump-4' collides with what it issued for 'jump': a suffix again
    expect(ctx.chromeId('jump-4')).toBe('docreader-1-jump-4-2');
    const second = mount(DOC, doc);
    await enhance(second);
    expect(ctxOf(second).chromeId('jump')).toBe('docreader-2-jump');
    await destroyEnhancement(second);
    await destroyEnhancement(root);
  });

  it('refuses a name that is not 1 to 32 lower-case letters, digits and dashes, starting with a letter', async () => {
    const root = mount();
    await enhance(root);
    const ctx = ctxOf(root);
    for (const bad of ['', 'Jump', '1a', 'a b', 'a"b', 'a'.repeat(33), '-a', 'a_b']) expect(() => ctx.chromeId(bad), bad).toThrow(/chromeId/);
    expect(ctx.chromeId('a'.repeat(32))).toMatch(/-a{32}$/);
  });

  it('an instance\'s ids are released when it is torn down', async () => {
    const root = mount();
    await enhance(root);
    const before = chromeIdsIssued(document);
    ctxOf(root).chromeId('jump');
    ctxOf(root).chromeId('keys');
    expect(chromeIdsIssued(document)).toBe(before + 2);
    await destroyEnhancement(root);
    expect(chromeIdsIssued(document)).toBe(before);
  });
});

describe('text: clip, hash, document order and the colour key', () => {
  it('clip collapses white space and cuts at a word, with an ellipsis, within n code units', () => {
    expect(clip('  a   short\ntext ', 40)).toBe('a short text');
    expect(clip('The quick brown fox jumps over the lazy dog', 20)).toBe('The quick brown fox…');
    expect(clip('Supercalifragilistic expialidocious', 12)).toBe('Supercalifr…');
    expect(clip('One, two, three, four', 11)).toBe('One, two…');
    for (const [s, n] of [['The quick brown fox jumps over the lazy dog', 20], ['abcdefghij', 5]] as const) expect(clip(s, n).length).toBeLessThanOrEqual(n);
  });

  it('clip never cuts a surrogate pair in two', () => {
    const s = `${'a'.repeat(8)}😀😀😀`;
    const out = clip(s, 10);
    expect(out).toBe(`${'a'.repeat(8)}…`);
    expect(/[\ud800-\udbff](?![\udc00-\udfff])/.test(out)).toBe(false);
  });

  it('hash is the 32-bit FNV-1a of the code units, in base 36', () => {
    expect(hash('')).toBe((0x811c9dc5).toString(36));
    expect(hash('a')).toBe((0xe40c292c).toString(36));
    expect(hash('foobar')).toBe((0xbf9cf968).toString(36));
    expect(hash('A')).not.toBe(hash('a'));
  });

  it('before and inOrder follow document order', () => {
    const root = mount();
    const [h1, p, h2] = [root.querySelector('h1'), root.querySelector('p'), root.querySelector('h2')] as Element[];
    expect([before(h1 as Element, p as Element), before(p as Element, h1 as Element), before(p as Element, p as Element)]).toEqual([true, false, false]);
    expect(inOrder([h2, h1, p] as Element[])).toEqual([h1, p, h2]);
  });

  it('colourKey builds the key as chrome: one item per colour role, with a swatch and a neutral label', () => {
    const ul = colourKey(document);
    expect([ul.localName, ul.className, ul.hasAttribute(CHROME_ATTR), ul.parentNode]).toEqual(['ul', 'ckey', true, null]);
    const items = Array.from(ul.children).map((li) => [li.querySelector('.sw')?.className, li.querySelector('.sw')?.getAttribute('aria-hidden'), li.textContent]);
    expect(items.map((i) => i[0])).toEqual(['sw k-nav', 'sw k-term', 'sw k-id', 'sw k-wait', 'sw k-chg', 'sw k-no', 'sw k-ok', 'sw k-info', 'sw k-code']);
    expect(items.every((i) => i[1] === 'true' && typeof i[2] === 'string' && i[2] !== '')).toBe(true);
    expect(Array.from(ul.querySelectorAll('*')).every((e) => e.hasAttribute(CHROME_ATTR))).toBe(true);
  });

  it('the context carries the helpers, frozen, the same functions', async () => {
    const root = mount();
    await enhance(root);
    const { text } = ctxOf(root);
    expect([text.clip, text.hash, text.before, text.inOrder, text.colourKey]).toEqual([clip, hash, before, inOrder, colourKey]);
    expect(Object.isFrozen(text)).toBe(true);
  });
});

describe('vocab: every word list, with its default (Task 7a\'s table)', () => {
  it('the defaults are the documented lists', () => {
    const w = defaultVocabulary();
    expect(w.status).toEqual({
      ok: ['ruled', 'accepted', 'agreed', 'kept', 'confirmed', 'measured', 'done', 'verified', 'yes', 'implemented', 'approved'],
      wait: ['awaiting', 'proposed', 'pending', 'open', 'waiting', 'partly', 'partial', 'to do', 'in review', 'draft'],
      no: ['rejected', 'withdrawn', 'dropped', 'removed', 'refused', 'no', 'diverges', 'blocked'],
      info: ['changed', 'amended', 'deferred', 'later', 'pinned', 'judgement', 'sourced', 'reported', 'superseded'],
    });
    expect(w.statusHeaders).toEqual(['status', 'statuses', 'state', 'states', 'result', 'results', 'verdict', 'verdicts', 'outcome', 'outcomes', 'stands', 'fate']);
    expect(w.rulingHeaders).toEqual(['ruling', 'ruled', 'answer']);
    expect(w.ids).toEqual({ prefixes: null });
    expect(w.ruleIds).toEqual({ prefixes: null });
    expect([w.qualifiers, w.addressees, w.itemFields, w.itemHeadings]).toEqual([[], ['you'], [], []]);
    expect(w.plan).toEqual({ task: ['Task'], step: ['Step'], who: ['Who'] });
    expect(w.attention).toEqual({
      status: ['status', 'state', 'stands', 'verdict'],
      who: ['who', 'owner', 'by whom', 'who acts'],
      question: ['question'],
      openAnswers: ['open', 'unanswered', 'tbd', 'to be decided', 'waiting'],
      blocking: ['blocking', 'blocker', 'blocks'],
      risk: ['diverge'],
      openStatus: ['open', 'proposed', 'awaiting'],
    });
    expect(w.techHeaders).toEqual(['file', 'path', 'test', 'command', 'module', 'function', 'endpoint', 'field', 'grammar', 'regex', 'schema', 'key', 'route', 'symbol', 'code', 'type', 'constant', 'env']);
    expect(w.decisionHeaders).toEqual(['status', 'ruling', 'decision']);
    expect(w.titleHeaders).toEqual(['what', 'decision', 'title', 'name', 'summary', 'meaning', 'description', 'format', 'choice', 'effect', 'task', 'question', 'proposal', 'rule']);
    expect(w.pathExtensions).toEqual(['ts', 'tsx', 'js', 'mjs', 'cjs', 'py', 'md', 'json', 'yaml', 'yml', 'sh', 'tf', 'html', 'css', 'toml', 'go', 'rs', 'sql']);
    expect(w.glossary).toEqual({
      termHeaders: ['term', 'terms', 'word', 'words', 'name', 'names', 'acronym', 'acronyms', 'glossary'],
      meaningHeaders: ['meaning', 'definition', 'means', 'what it means', 'description'],
      sections: ['words used here', 'glossary', 'terms used'],
      notTerms: ['code', 'codes', 'id', 'ids'],
    });
    expect(w.mergeForms).toEqual(['pull request', 'branch', 'remote-tracking branch', 'tag', 'commit', 'remote branch']);
    expect(w.colourKey.map((e) => e.role)).toEqual(['nav', 'term', 'id', 'wait', 'chg', 'no', 'ok', 'info', 'code']);
  });

  it('the defaults are a fresh object each time, and the compiled vocabulary holds a frozen copy', () => {
    const a = defaultVocabulary();
    const b = defaultVocabulary();
    expect(a).not.toBe(b);
    expect(a.status.ok).not.toBe(b.status.ok);
    a.status.ok.push('mutated');
    const v = compileVocab(a);
    expect(v.words.status.ok).toContain('mutated');
    a.status.ok.push('later');
    expect(v.words.status.ok).not.toContain('later');
    expect([Object.isFrozen(v), Object.isFrozen(v.words), Object.isFrozen(v.words.status), Object.isFrozen(v.words.status.ok), Object.isFrozen(v.words.colourKey[0])]).toEqual([true, true, true, true, true]);
  });

  it('status words: the first a text opens with, as a whole word, any case; the role by list', () => {
    const v = compileVocab(defaultVocabulary());
    expect(statusOf(v, '  Agreed, see above')).toEqual({ word: 'Agreed', role: 'ok' });
    expect(statusOf(v, 'to do: soon')).toEqual({ word: 'to do', role: 'wait' });
    expect(statusOf(v, 'Diverges from the plan')).toEqual({ word: 'Diverges', role: 'no' });
    expect(statusOf(v, 'Superseded by R2')).toEqual({ word: 'Superseded', role: 'info' });
    for (const s of ['Agreement', 'Nothing', 'not done', 'Undone', '']) expect(statusOf(v, s), s).toBeNull();
    expect(statusOf(v, 'Done-ish')).toEqual({ word: 'Done', role: 'ok' }); // a dash ends a word, as in the prototype
  });

  it('status headers: named as a whole word; a ruling header by a word anywhere, or a question', () => {
    const v = compileVocab(defaultVocabulary());
    for (const h of ['Status', 'Current status', 'States', 'Verdicts', 'How it stands', 'Fate']) expect(v.statusHeader.test(h), h).toBe(true);
    for (const h of ['Statement', 'Restated', 'Resultant', 'Note']) expect(v.statusHeader.test(h), h).toBe(false);
    for (const h of ['Ruling', 'Rulings so far', 'Answer', 'Is it done?']) expect(v.rulingHeader.test(h), h).toBe(true);
    for (const h of ['Notes', 'Question mark here']) expect(v.rulingHeader.test(h), h).toBe(false);
  });

  it('a word list is literal: every metacharacter is escaped when it is compiled (LD9)', () => {
    const w = defaultVocabulary();
    w.status.ok = ['a.b', 'c+', '(x)'];
    w.statusHeaders = ['st.t'];
    w.addressees = ['a.b'];
    const v = compileVocab(w);
    expect([statusOf(v, 'a.b now'), statusOf(v, 'axb now'), statusOf(v, 'c+ yes')?.role, statusOf(v, 'cc')]).toEqual([{ word: 'a.b', role: 'ok' }, null, undefined, null]);
    expect(statusOf(v, '(x) here')).toBeNull(); // an entry that ends on a non-word character never meets the word boundary after it
    expect([v.statusHeader.test('st.t'), v.statusHeader.test('stat')]).toEqual([true, false]);
    expect([v.addressee.test('ask a.b now'), v.addressee.test('a.bX'), v.addressee.test('axb')]).toEqual([true, false, false]);
  });

  it('an empty list matches nothing', () => {
    const w = defaultVocabulary();
    w.status = { ok: [], wait: [], no: [], info: [] };
    w.statusHeaders = [];
    w.rulingHeaders = [];
    w.addressees = [];
    const v = compileVocab(w);
    expect([statusOf(v, 'agreed'), v.statusHeader.test('status'), v.rulingHeader.test('ruling'), v.rulingHeader.test('done?'), v.addressee.test('you')]).toEqual([
      null,
      false,
      false,
      true,
      false,
    ]);
    expect(v.qualifier.test('programme ')).toBe(false); // the default qualifiers: none
  });

  it('the ID grammar: 1 to 4 capitals, an optional dash, a number with dotted or dashed parts, an optional letter', () => {
    const v = compileVocab(defaultVocabulary());
    const at = (s: string): string | null => v.id.exec(s)?.[1] ?? null;
    expect(['R14', 'F3, then', 'OP-6: x', 'P0-1 y', 'D2.1.3a', 'ABCD-12)'].map(at)).toEqual(['R14', 'F3', 'OP-6', 'P0-1', 'D2.1.3a', 'ABCD-12']);
    for (const s of ['ABCDE-1', 'r14', 'R', 'R14xy', 'R14-', 'R-14b2', 'R14!']) expect(at(s), s).toBeNull();
    expect(at('R14x')).toBe('R14x'); // one lower-case letter may follow
    const scan = v.idScan();
    expect([...'See R14 and F3, not ABCDE-1 or r2.'.matchAll(scan)].map((m) => m[1])).toEqual(['R14', 'F3']);
    expect(v.idScan()).not.toBe(scan);
    expect(v.idScan().flags).toContain('g');
  });

  it('the ID grammar with prefixes, and off', () => {
    const w = defaultVocabulary();
    w.ids = { prefixes: ['R', 'OP'] };
    const v = compileVocab(w);
    expect(['R14', 'OP-6', 'F3', 'XR14'].map((s) => v.id.exec(s)?.[1] ?? null)).toEqual(['R14', 'OP-6', null, null]);
    expect([...'R1 F2 OP-3'.matchAll(v.idScan())].map((m) => m[1])).toEqual(['R1', 'OP-3']);
    w.ids = false;
    const off = compileVocab(w);
    expect([off.id.test('R14'), [...'R14 F3'.matchAll(off.idScan())].length]).toEqual([false, 0]);
  });

  it('the rule-ID grammar: two or more capitals, then dash-separated parts of capitals or digits; prefixes narrow it', () => {
    const v = compileVocab(defaultVocabulary());
    for (const s of ['AB-1', 'ABC-DEF-2', 'RULE-X9']) expect(v.ruleId.test(s), s).toBe(true);
    for (const s of ['A-1', 'AB', 'ab-1', 'AB-', 'AB-x', 'AB-1 ']) expect(v.ruleId.test(s), s).toBe(false);
    const w = defaultVocabulary();
    w.ruleIds = { prefixes: ['QR'] };
    const p = compileVocab(w);
    expect([p.ruleId.test('QR-1'), p.ruleId.test('AB-1'), p.ruleId.test('QRX-1')]).toEqual([true, false, false]);
  });

  it('qualifiers and addressees, as whole words', () => {
    const w = defaultVocabulary();
    w.qualifiers = ['annex', 'part'];
    const v = compileVocab(w);
    expect([v.qualifier.test('the annex '), v.qualifier.test('in part  '), v.qualifier.test('the annexes '), v.qualifier.test('subpart '), v.qualifier.test('annex')]).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
    expect([v.addressee.test('For you.'), v.addressee.test('YOU'), v.addressee.test('yours'), v.addressee.test('the operator')]).toEqual([true, true, false, false]);
  });

  it('the plan grammars: a task heading, a step title with its owner, and the owner line', () => {
    const v = compileVocab(defaultVocabulary());
    const t = v.plan.task.exec('Task P0-1: Build it');
    expect([t?.[1], t?.[2], t?.[0]]).toEqual(['Task', 'P0-1', 'Task P0-1: ']);
    expect(v.plan.task.exec('Task 3. Then')?.[2]).toBe('3');
    expect(v.plan.task.exec('task 3: lower case')).toBeNull();
    const s = v.plan.step.exec('Step 2 (you): Run it');
    expect([s?.[1], s?.[2], s?.[0]]).toEqual(['Step 2', 'you', 'Step 2 (you): ']);
    expect(v.plan.step.exec('Step 4: no owner')?.[2]).toBeUndefined();
    expect(v.plan.who.exec('Who: the reader. Then more.')?.[1]).toBe('the reader');
    expect(v.plan.who.exec('Whom: x.')).toBeNull();
  });

  it('attention words', () => {
    const { attention: a } = compileVocab(defaultVocabulary());
    expect([a.status.test('Current state'), a.who.test('Owner'), a.who.test('Who acts'), a.who.test('Whoever'), a.question.test('Questions'), a.question.test('A question')]).toEqual([
      true,
      true,
      true,
      false,
      true,
      false,
    ]);
    expect([a.openAnswers.test('TBD'), a.openAnswers.test('To be decided later'), a.openAnswers.test('Opened')]).toEqual([true, true, false]);
    expect([a.blocking.test('  Blocker for R2'), a.blocking.test('Blocked'), a.risk.test('It diverges'), a.openStatus.test('Proposed (draft)')]).toEqual([true, false, true, true]);
  });

  it('technical, decision and title headers; file paths', () => {
    const v = compileVocab(defaultVocabulary());
    expect([v.techHeader.test('Files'), v.techHeader.test('Env vars'), v.techHeader.test('Profile'), v.decisionHeader.test('Decisions'), v.titleHeader.test('Summary of it'), v.titleHeader.test('The name')]).toEqual([
      true,
      true,
      false,
      true,
      true,
      false,
    ]);
    for (const p of ['src/enhance/env.ts', 'README.md', 'a.yml#top', '@scope/pkg/index', 'package.json']) expect(v.path.test(p), p).toBe(true);
    for (const p of ['plain words', 'file.exe', 'a b/c']) expect(v.path.test(p), p).toBe(false);
  });

  it('the glossary contract', () => {
    const { glossary: g } = compileVocab(defaultVocabulary());
    expect([g.term.test('Terms'), g.term.test('Term list'), g.meaning.test('What it means'), g.section.test('Words used here (all)'), g.section.test('Some glossary'), g.notTerm.test('IDs and codes'), g.notTerm.test('Identity')]).toEqual([
      true,
      false,
      true,
      true,
      false,
      true,
      false,
    ]);
  });

  it('git\'s merge subjects, the commit-prefix rule and the item-key shape', () => {
    const v = compileVocab(defaultVocabulary());
    for (const s of ['Merge pull request #13 from a/b', "Merge branch 'main' into x", 'Merge remote-tracking branch \'origin/main\'']) expect(v.merge.test(s), s).toBe(true);
    for (const s of ['merge branch x', 'Merged branch', 'Merge the two lists']) expect(v.merge.test(s), s).toBe(false);
    expect(['docs: a change', 'fix(enhance)!: b', 'A plain subject'].map((s) => s.replace(v.commitPrefix, ''))).toEqual(['a change', 'b', 'A plain subject']);
    for (const k of ['AB-12', 'X1-3', 'ABCDEFGHIJ-1']) expect(v.itemKey.test(k), k).toBe(true);
    for (const k of ['A-12', 'ab-12', 'AB-', 'ABCDEFGHIJK-1']) expect(v.itemKey.test(k), k).toBe(false);
    expect([v.itemField.test('Tracker'), v.itemHeading.test('Delta')]).toEqual([false, false]);
    const w = defaultVocabulary();
    w.itemFields = ['Tracker'];
    w.itemHeadings = ['change delta'];
    const items = compileVocab(w);
    expect([items.itemField.test('Tracker'), items.itemField.test('tracker'), items.itemField.test('Trackers')]).toEqual([true, true, false]);
    expect([items.itemHeading.test('Change delta'), items.itemHeading.test('4. change-delta'), items.itemHeading.test('change delta 2')]).toEqual([true, true, false]);
  });

  it('each instance has its own vocabulary, compiled from the defaults', async () => {
    const a = mount();
    const b = mount();
    await enhance(a);
    await enhance(b);
    expect(ctxOf(a).vocab).not.toBe(ctxOf(b).vocab);
    expect(ctxOf(a).vocab.words).toEqual(defaultVocabulary());
  });
});

describe('status marks read ctx.vocab', () => {
  const TABLE = ['# T', '', '| Item | Status |', '|---|---|', '| One | Agreed, as the note above says |', '| Two | Pending |', '| Three | Settled |', ''].join('\n');

  it('the defaults reproduce the prototype\'s marks', async () => {
    const root = mount(TABLE);
    await enhance(root);
    expect(Array.from(root.querySelectorAll('.pill')).map((p) => `${p.className}: ${p.textContent ?? ''}`)).toEqual(['pill ok: Agreed', 'pill wait: Pending']);
  });

  it('a vocabulary of other words marks those words instead, and the header words decide the column', async () => {
    const w = defaultVocabulary();
    w.status = { ok: ['settled'], wait: [], no: [], info: [] };
    hooks.words = w;
    const root = mount(TABLE);
    await enhance(root);
    expect(Array.from(root.querySelectorAll('.pill')).map((p) => `${p.className}: ${p.textContent ?? ''}`)).toEqual(['pill ok: Settled']);
    const w2 = defaultVocabulary();
    w2.statusHeaders = ['phase'];
    hooks.words = w2;
    const other = mount(TABLE);
    await enhance(other);
    expect(other.querySelectorAll('.pill').length).toBe(0); // "Status" no longer names a status column, and one cell is over three words
  });
});

describe('features: registration in the final build order', () => {
  /** The real list, not the probes. */
  async function realFeatures(): Promise<readonly Feature[]> {
    const real = await vi.importActual<typeof import('../src/enhance/features.js')>('../src/enhance/features.js');
    return real.features();
  }

  const ORDER = [
    'editorial', 'rules', 'ids', 'plans', 'tables', 'code', 'figures', 'xrefs', 'glossary', 'attention', 'marks', 'rail', 'strip', 'scroll',
    'folds', 'cards', 'jump', 'settings', 'changes', 'since', 'keysheet', 'diagrams', 'diagram-tools', 'position',
  ];

  it('lists every feature once, in the reference\'s build order', async () => {
    expect((await realFeatures()).map((f) => f.name)).toEqual(ORDER);
  });

  it('every module of src/enhance that exports build is registered, under its file name, and every stub exports build (and after when it waits on the host)', async () => {
    const files = readdirSync(ENHANCE_DIR).filter((f) => f.endsWith('.ts'));
    const exporting: string[] = [];
    for (const f of files) {
      const src = readFileSync(path.join(ENHANCE_DIR, f), 'utf8');
      if (/^export (?:async )?function build\(/m.test(src)) exporting.push(f.replace(/\.ts$/, ''));
    }
    const names = (await realFeatures()).map((f) => f.name);
    expect(exporting.sort()).toEqual(names.filter((n) => n !== 'editorial' && n !== 'folds').sort());
    const withAfter = (await realFeatures()).filter((f) => f.after !== undefined).map((f) => f.name);
    expect(withAfter).toEqual(['changes', 'since', 'diagrams']);
    for (const name of names.filter((n) => n !== 'editorial' && n !== 'folds')) {
      const mod = (await import(`../src/enhance/${name}.ts`)) as Record<string, unknown>;
      expect(Object.keys(mod).sort(), name).toEqual(withAfter.includes(name) ? ['after', 'build'] : ['build']);
    }
  });

  it('every stub names its section of the reference layout and the task that fills it, and builds nothing yet', async () => {
    const root = mount();
    await enhance(root);
    const html = root.outerHTML;
    const ctx = ctxOf(root);
    for (const f of (await realFeatures()).filter((x) => x.name !== 'editorial' && x.name !== 'folds')) {
      const src = readFileSync(path.join(ENHANCE_DIR, `${f.name}.ts`), 'utf8');
      const lines = src.split('\n');
      const header = lines.slice(0, lines.findIndex((l) => !l.startsWith('//'))).map((l) => l.replace(/^\/\/ ?/, '')).join(' ');
      expect(header, f.name).toMatch(/\(the reference layout, sections? \d+[a-z]?\b/);
      expect(header, f.name).toMatch(/Built by L2 Task \d+; until then a stub that builds nothing\./);
      expect(header, f.name).toMatch(/Consumes|Produces/);
      f.build(ctx);
      await f.after?.(ctx);
    }
    expect(root.outerHTML).toBe(html);
  });

  it('the startup builds through the list, in order, inside the startup operation, and stops once destroyed', async () => {
    const root = mount();
    const seen: string[] = [];
    hooks.probes.push(
      {
        name: 'one',
        build: (ctx: FeatureContext) => {
          seen.push(`one: chrome before ${String(ctx.root.querySelectorAll('button.h-fold').length > 0)}`);
          void destroyEnhancement(root);
          seen.push(`one: live ${String(ctx.live())}`);
        },
      },
      { name: 'two', build: () => void seen.push('two') },
    );
    await expect(enhance(root)).rejects.toMatchObject({ code: 'aborted' });
    expect(seen).toEqual(['one: chrome before true', 'one: live false']);
  });

  it('a feature that throws fails the startup, which rolls back', async () => {
    const root = mount();
    const before = root.outerHTML;
    hooks.probes.push({
      name: 'bad',
      build: () => {
        throw new Error('broken feature');
      },
    });
    await expect(enhance(root)).rejects.toMatchObject({ code: 'initialization' });
    expect(root.outerHTML).toBe(before);
  });
});

describe('the second phase (LD5): after(ctx), once the layout is built', () => {
  it('starts each after in order, once the startup has built every feature, inside an operation', async () => {
    const root = mount();
    const seen: string[] = [];
    hooks.probes.push(
      { name: 'a', build: () => void seen.push('build a'), after: async (ctx: FeatureContext) => {
        void destroyEnhancement(root);
        seen.push(`after a: ${String(ctx.root.hasAttribute('data-docreader-root'))}`);
        await Promise.resolve();
      } },
      { name: 'b', build: () => void seen.push('build b'), after: async () => void seen.push('after b') },
    );
    await enhance(root);
    expect(seen).toEqual(['build a', 'build b', 'after a: true']);
    await flush();
    expect(root.hasAttribute('data-docreader-root')).toBe(false);
  });

  it('enhance resolves without waiting for the second phase', async () => {
    const root = mount();
    let release: () => void = () => undefined;
    const done: string[] = [];
    hooks.probes.push({
      name: 'slow',
      build: () => undefined,
      after: async () => {
        await new Promise<void>((r) => {
          release = r;
        });
        done.push('after');
      },
    });
    await enhance(root);
    expect(done).toEqual([]);
    release();
    await flush();
    expect(done).toEqual(['after']);
  });

  it('a rejected or throwing after is swallowed: no unhandled rejection, and the others still run', async () => {
    const root = mount();
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown): void => {
      unhandled.push(e);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const seen: string[] = [];
      hooks.probes.push(
        { name: 'rejects', build: () => undefined, after: () => Promise.reject(new Error('no reply')) },
        {
          name: 'throws',
          build: () => undefined,
          after: () => {
            throw new Error('sync');
          },
        },
        { name: 'fine', build: () => undefined, after: async () => void seen.push('fine') },
      );
      await enhance(root);
      await wait(20);
      expect([seen, unhandled]).toEqual([['fine'], []]);
      expect(root.hasAttribute('data-docreader-root')).toBe(true);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('no after starts when the startup failed or was destroyed', async () => {
    const root = mount();
    const seen: string[] = [];
    hooks.probes.push(
      { name: 'waits', build: () => undefined, after: async () => void seen.push('after') },
      {
        name: 'aborts',
        build: () => {
          void destroyEnhancement(root);
        },
      },
    );
    await expect(enhance(root)).rejects.toMatchObject({ code: 'aborted' });
    await flush();
    expect(seen).toEqual([]);
  });

  it('a write after an await, once destroyed, is refused (RF5)', async () => {
    const root = mount();
    const before = root.outerHTML;
    let release: () => void = () => undefined;
    hooks.probes.push({
      name: 'late',
      build: () => undefined,
      after: async (ctx: FeatureContext) => {
        await new Promise<void>((r) => {
          release = r;
        });
        ctx.journal.toggleClass(ctx.root, 'late', true);
        ctx.journal.setStyle(ctx.root, '--bar-h', '1px');
      },
    });
    await enhance(root);
    await destroyEnhancement(root);
    release();
    await flush();
    expect(root.outerHTML).toBe(before);
  });
});

describe('options pass-through: setup options reach the seams', () => {
  it('posKey defaults to storageKey and is what a feature passes to readPos', async () => {
    const root = mount();
    const { storage, reads } = recordingStorage({ [posKeyOf('k')]: '{"y":5}' });
    let got: unknown;
    hooks.probes.push({
      name: 'probe',
      build: (ctx: FeatureContext) => {
        got = ctx.options.posKey === null ? null : ctx.state.readPos(ctx.options.posKey);
      },
    });
    const options: EnhanceOptions = { storage, storageKey: 'k' };
    await enhance(root, options);
    expect(got).toEqual({ y: 5 });
    expect(reads).toContain(posKeyOf('k'));
  });
});
