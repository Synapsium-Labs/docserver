// @vitest-environment jsdom
// Scrolling (docserver L2, Task 12; the reference layout's sections 13 and 17), under jsdom with stubbed rects: the
// scroll spy (the section and the read-mark unit at the reading line, sent as 'spy' { section, unit } once per change),
// the running head, the progress line, the root classes `scrolled` and `bar-hidden` (the phone bar), the measured
// `--bar-h`, the bar's landmark, and RF3's bound on rect reads per frame. What only a real browser can show (the bar's
// placement, real scrolling, the phone bar at 390 px, the large plan's count in a page) is in test/browser/scroll.test.ts.
//
// The feature list is mocked with a pass-through: features() is the real list with `beforeScroll` probes run just before
// the scroll feature (a stand-in for the plan feature, which publishes the plan) and `probes` after every real feature.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBar } from '../src/enhance/bar.js';
import { destroyEnhancement, enhance, type EnhanceOptions } from '../src/enhance/index.js';
import type { Feature } from '../src/enhance/features.js';
import { CHROME_ATTR, chrome, createJournal } from '../src/enhance/journal.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { BAR_HOLD_MS } from '../src/enhance/nav.js';
import { HIDE_AFTER, LINE_MIN, LINE_SHARE, SCROLL_SLACK } from '../src/enhance/scroll.js';
import type { FeatureContext } from '../src/enhance/types.js';
import { render } from '../src/render/index.js';

const hooks = vi.hoisted(() => ({ probes: [] as unknown[], beforeScroll: [] as unknown[] }));

vi.mock('../src/enhance/features.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/enhance/features.js')>();
  const features = (): Feature[] => {
    const list = [...real.features()];
    const at = list.findIndex((f) => f.name === 'scroll');
    return [...list.slice(0, at), ...(hooks.beforeScroll as Feature[]), ...list.slice(at), ...(hooks.probes as Feature[])];
  };
  return { ...real, features };
});

const DOC = [
  '# Example title',
  '',
  '**Spec** · 2026-10-20 · Status: Draft',
  '',
  '## In short',
  '',
  '- The point, first.',
  '',
  '## 1. Context',
  '',
  'Why it exists.',
  '',
  '## 2. Design',
  '',
  'How it works.',
  '',
  '## Open questions',
  '',
  'What waits.',
  '',
].join('\n');

/** A plan: twenty steps under two tasks in "2. Tasks", so it takes the outline mode and each task is a unit. */
const PLAN = [
  '# A plan',
  '',
  '## In short',
  '',
  '- What it builds.',
  '',
  '## 1. Scope',
  '',
  'What it covers.',
  '',
  '## 2. Tasks',
  '',
  '### Task 1: First part',
  '',
  ...Array.from({ length: 10 }, (_, i) => `- [ ] **Step ${String(i + 1)}:** Do part ${String(i + 1)}.`),
  '',
  '### Task 2: Second part',
  '',
  ...Array.from({ length: 10 }, (_, i) => `- [ ] **Step ${String(i + 1)}:** Do part ${String(i + 11)}.`),
  '',
  '## 3. Notes',
  '',
  'After the tasks.',
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

/** Rects by element: a stub's top and height (its bottom follows); every other element sits far below the window. */
const rects = new Map<Element, { top: number; height?: number }>();
/** Where an element with no stub sits: far below any window, so nothing is above the reading line by default. */
const FAR = 100_000;
/** How many times a rect was read. */
let reads = 0;

/** The window's height and scroll position, as env reads them. */
function setWindow(h: number, y: number): void {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
}

/** Whether the window is a phone (env.matches reads matchMedia). */
let phone = false;

beforeEach(() => {
  reads = 0;
  phone = false;
  setWindow(768, 0);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    reads += 1;
    const r = rects.get(this) ?? { top: FAR };
    const height = r.height ?? 20;
    return { top: r.top, bottom: r.top + height, height, left: 0, right: 0, width: 0, x: 0, y: r.top, toJSON: () => ({}) } as DOMRect;
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (q: string) => ({ matches: q === '(max-width: 700px)' && phone, media: q }),
  });
});

afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
  hooks.probes.length = 0;
  hooks.beforeScroll.length = 0;
  rects.clear();
  delete (window as { matchMedia?: unknown }).matchMedia;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function ctxOf(root: HTMLElement): FeatureContext {
  const ctx = contextOf(root);
  if (ctx === undefined) throw new Error('no context: the root is not enhanced');
  return ctx;
}

/** Resolve after `ms` of real time. */
const wait = (ms: number): Promise<void> =>
  new Promise((r) => {
    setTimeout(r, ms);
  });

/** Two frames and a little: a frame asked for now has run by then. */
const frames = (): Promise<void> => wait(60);

/** Scroll the window to `y` (each stubbed rect moves with it) and let the spy's frame run. */
async function scrollTo(y: number, place: (y: number) => void): Promise<void> {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
  place(y);
  window.dispatchEvent(new Event('scroll'));
  await frames();
}

/** The root's h2 and h3 headings with this id (a walk, never an id lookup). */
function heading(root: Element, id: string): HTMLElement {
  const el = Array.from(root.querySelectorAll('h2, h3')).find((h) => h.id === id);
  if (el === undefined) throw new Error(`no heading ${id}`);
  return el as HTMLElement;
}

/** Place each heading at its page position less `y`: `at` maps an id to its top on the page. */
function placer(root: Element, at: Readonly<Record<string, number>>): (y: number) => void {
  return (y) => {
    for (const [id, top] of Object.entries(at)) rects.set(heading(root, id), { top: top - y });
  };
}

/** Place every h2 and h3 of the root, in document order, at these page positions less `y`. */
function ladder(root: Element, tops: readonly number[]): (y: number) => void {
  const hs = Array.from(root.querySelectorAll('h2, h3'));
  if (hs.length !== tops.length) throw new Error(`ladder: ${String(hs.length)} headings, ${String(tops.length)} tops`);
  return (y) => {
    hs.forEach((h, i) => rects.set(h, { top: (tops[i] ?? 0) - y }));
  };
}

/** Every 'spy' event the instance sends from now on. */
function spyLog(root: HTMLElement): { section: string | null; unit: string | null }[] {
  const log: { section: string | null; unit: string | null }[] = [];
  ctxOf(root).events.on('spy', (p) => {
    log.push({ section: p.section?.id ?? null, unit: p.unit?.id ?? null });
  });
  return log;
}

/** The running head as text: the number's `b`, a bar, then the title. */
function head(root: HTMLElement): string {
  const running = ctxOf(root).slots?.running;
  if (running === undefined) throw new Error('no bar');
  const b = running.querySelector('b');
  return `${b?.textContent ?? ''}|${Array.from(running.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join('')}`;
}

/** Publish the plan before the scroll feature builds, unless the plan feature already did (a stand-in for it). */
function planProbe(): void {
  hooks.beforeScroll.push({
    name: 'plan-probe',
    build: (ctx: FeatureContext) => {
      if (ctx.plan.published) return;
      const tasks = Array.from(ctx.root.querySelectorAll('h3')).filter((h) => /^Task \d+:/.test(h.textContent ?? '')) as HTMLElement[];
      const steps = Array.from(ctx.root.querySelectorAll('li.task-list-item')) as HTMLElement[];
      ctx.plan.publish({ tasks, steps, yours: 0, outlineable: steps.length >= 20 });
    },
  } satisfies Feature);
}

describe('the reading line and the spy event', () => {
  it('the reading line is 30% of the window, at least 150 px', () => {
    expect([LINE_SHARE, LINE_MIN]).toEqual([0.3, 150]);
  });

  it('the current section is the last heading above the reading line: one spy event per change, { section, unit }, frozen', async () => {
    const root = mount();
    await enhance(root);
    await frames();
    const log = spyLog(root);
    const frozen: boolean[] = [];
    ctxOf(root).events.on('spy', (p) => frozen.push(Object.isFrozen(p)));
    // the reading line: 30% of 768 px = 230.4 px
    const place = placer(root, { 'in-short': 400, '1-context': 800, '2-design': 1200, 'open-questions': 1600 });
    await scrollTo(0, place); // nothing above the line
    expect(log).toEqual([]);
    await scrollTo(200, place); // in-short at 200
    await scrollTo(580, place); // in-short -180, 1-context at 220: above the line (230.4)
    await scrollTo(585, place); // the same section: no event
    await scrollTo(960, place); // 2-design at 240: still 1-context
    await scrollTo(975, place); // 2-design at 225
    await scrollTo(5000, place); // the last
    expect(log).toEqual([
      { section: 'in-short', unit: null }, // In short is no read-mark unit
      { section: '1-context', unit: '1-context' },
      { section: '2-design', unit: '2-design' },
      { section: 'open-questions', unit: 'open-questions' },
    ]);
    expect(frozen).toEqual([true, true, true, true]);
    await scrollTo(0, place); // back above every section
    expect(log.at(-1)).toEqual({ section: null, unit: null });
  });

  it('the reading line is at least 150 px on a short window', async () => {
    setWindow(400, 0); // 30% would be 120
    const root = mount();
    await enhance(root);
    await frames();
    const log = spyLog(root);
    const place = (top: number) => (y: number) => {
      rects.set(heading(root, 'in-short'), { top: top - y });
    };
    await scrollTo(0, place(140));
    expect(log).toEqual([{ section: 'in-short', unit: null }]);
    await scrollTo(0, place(160));
    expect(log.at(-1)).toEqual({ section: null, unit: null });
  });

  it('on a plan, each task is a unit and the section that holds them is not; a hidden task is skipped once relayout ran', async () => {
    planProbe();
    const root = mount(PLAN);
    await enhance(root);
    await frames();
    const log = spyLog(root);
    const place = placer(root, { 'in-short': 300, '1-scope': 600, '2-tasks': 900, 'task-1-first-part': 1000, 'task-2-second-part': 1400, '3-notes': 1800 });
    await scrollTo(400, place); // 1-scope at 200
    expect(log.at(-1)).toEqual({ section: '1-scope', unit: '1-scope' });
    await scrollTo(700, place); // 2-tasks at 200, task 1 at 300: the holder is no unit, so the unit stays 1-scope
    expect(log.at(-1)).toEqual({ section: '2-tasks', unit: '1-scope' });
    await scrollTo(800, place); // task 1 at 200
    expect(log.at(-1)).toEqual({ section: '2-tasks', unit: 'task-1-first-part' });
    await scrollTo(1200, place); // task 2 at 200
    expect(log.at(-1)).toEqual({ section: '2-tasks', unit: 'task-2-second-part' });
    await scrollTo(1700, place); // 3-notes at 100
    expect(log.at(-1)).toEqual({ section: '3-notes', unit: '3-notes' });
    // Task 2 hidden (a folded section's member): skipped from the next relayout on.
    heading(root, 'task-2-second-part').setAttribute('hidden', 'until-found');
    ctxOf(root).relayout('folds');
    await frames();
    await scrollTo(1250, place); // task 2 at 150 (hidden), task 1 at -250
    expect(log.at(-1)).toEqual({ section: '2-tasks', unit: 'task-1-first-part' });
  });

  it('a page that is not a document has sections but no units', async () => {
    const root = mount(['# Note', '', '## One', '', 'Text.', '', '## Two', '', 'Text.', ''].join('\n')); // two h2s: not a document
    await enhance(root);
    expect(ctxOf(root).info.isDocument).toBe(false);
    await frames();
    const log = spyLog(root);
    await scrollTo(100, placer(root, { one: 200, two: 900 }));
    expect(log).toEqual([{ section: 'one', unit: null }]);
  });

  it('spy events come without the bar too (chrome.bar false), and no bar rect is read', async () => {
    const root = mount();
    await enhance(root, { chrome: { bar: false } });
    await frames();
    const log = spyLog(root);
    const place = placer(root, { 'in-short': 400, '1-context': 800, '2-design': 1200, 'open-questions': 1600 });
    const h1 = root.querySelector('h1') as HTMLElement;
    const seen: Element[] = [];
    vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(function (this: Element) {
      seen.push(this);
      const r = rects.get(this) ?? { top: FAR };
      return { top: r.top, bottom: r.top + 20, height: 20, left: 0, right: 0, width: 0, x: 0, y: r.top, toJSON: () => ({}) } as DOMRect;
    });
    await scrollTo(600, place);
    expect(log).toEqual([{ section: '1-context', unit: '1-context' }]);
    expect(seen.includes(root) || seen.includes(h1)).toBe(false);
    expect(root.classList.contains('scrolled')).toBe(false);
  });

  it('nothing after destroy: a scroll then sends no event', async () => {
    const root = mount();
    await enhance(root);
    await frames();
    const log = spyLog(root);
    await destroyEnhancement(root);
    await scrollTo(600, placer(root, { 'in-short': 400, '1-context': 800 }));
    expect(log).toEqual([]);
  });
});

describe('the running head', () => {
  it('shows the title before the first section and in "In short", then "§ n" and the section\'s title', async () => {
    const root = mount();
    await enhance(root);
    expect(head(root)).toBe('|Example title'); // made with the bar, before the first frame
    await frames();
    const place = placer(root, { 'in-short': 400, '1-context': 800, '2-design': 1200, 'open-questions': 1600 });
    await scrollTo(300, place);
    expect(head(root)).toBe('|Example title'); // In short: the title
    await scrollTo(600, place);
    expect(head(root)).toBe('§ 1|Context');
    await scrollTo(1000, place);
    expect(head(root)).toBe('§ 2|Design');
    await scrollTo(1400, place);
    expect(head(root)).toBe('|Open questions'); // no number
    expect(ctxOf(root).slots?.running.getAttribute('aria-hidden')).toBe('true');
    for (const el of Array.from(ctxOf(root).slots?.running.children ?? [])) expect(el.hasAttribute(CHROME_ATTR)).toBe(true);
    await scrollTo(0, place);
    expect(head(root)).toBe('|Example title');
  });

  it('a title the host gives is the running head\'s; a number is the heading\'s own, its title read without the chrome', async () => {
    const root = mount(DOC.replace('## 2. Design', '## 2. Design | and *more*'));
    await enhance(root, { info: { title: 'Given title' } });
    expect(head(root)).toBe('|Given title');
    await frames();
    await scrollTo(1000, ladder(root, [400, 800, 1200, 1600]));
    expect(head(root)).toBe('§ 2|Design | and more');
  });

  it('a heading whose number is not its own text keeps it in the title, as a label without a number', async () => {
    const root = mount(DOC.replace('## 1. Context', '## *1.* Context'));
    await enhance(root);
    await frames();
    await scrollTo(600, ladder(root, [400, 800, 1200, 1600]));
    expect(head(root)).toBe('|Context');
  });

  it('a spy listener that destroys the instance stops the frame: the running head is not written after it', async () => {
    const root = mount();
    await enhance(root);
    await frames();
    const running = ctxOf(root).slots?.running as HTMLElement;
    ctxOf(root).events.on('spy', () => {
      void destroyEnhancement(root);
    });
    await scrollTo(600, ladder(root, [400, 800, 1200, 1600]));
    expect(running.textContent).toBe('Example title');
    expect(contextOf(root)).toBeUndefined();
  });
});

describe('the root classes and the progress line', () => {
  it('scrolled: once the title\'s bottom is above 40 px; without a title, once the root is 80 px past the top', async () => {
    const root = mount();
    await enhance(root);
    await frames();
    const h1 = root.querySelector('h1') as HTMLElement;
    await scrollTo(10, () => rects.set(h1, { top: 0, height: 41 }));
    expect(root.classList.contains('scrolled')).toBe(false);
    await scrollTo(11, () => rects.set(h1, { top: 0, height: 39 }));
    expect(root.classList.contains('scrolled')).toBe(true);
    await scrollTo(0, () => rects.set(h1, { top: 100, height: 40 }));
    expect(root.classList.contains('scrolled')).toBe(false);

    const note = mount(['Just a note.', '', 'More of it.', ''].join('\n'));
    await enhance(note);
    await frames();
    await scrollTo(81, () => rects.set(note, { top: -80, height: 5000 }));
    expect(note.classList.contains('scrolled')).toBe(false);
    await scrollTo(82, () => rects.set(note, { top: -81, height: 5000 }));
    expect(note.classList.contains('scrolled')).toBe(true);
    await destroyEnhancement(note);
    expect(note.classList.contains('scrolled')).toBe(false);
  });

  it('the progress line: the share of the root scrolled past, of what can be, as its width; 0 when the root fits', async () => {
    const root = mount();
    await enhance(root);
    await frames();
    const progress = ctxOf(root).slots?.progress as HTMLElement;
    const at = (top: number, height: number) => () => rects.set(root, { top, height });
    await scrollTo(0, at(0, 4768)); // 4000 px can be scrolled
    expect(progress.style.width).toBe('0%');
    await scrollTo(1000, at(-1000, 4768));
    expect(progress.style.width).toBe('25%');
    await scrollTo(1234, at(-1234, 4768));
    expect(progress.style.width).toBe('30.85%');
    await scrollTo(3000, at(-1000, 3768)); // the root starts 2000 px down the page
    expect(progress.style.width).toBe('33.333%');
    await scrollTo(9000, at(-9000, 4768));
    expect(progress.style.width).toBe('100%');
    await scrollTo(0, at(300, 4768)); // the root below the window's top
    expect(progress.style.width).toBe('0%');
    await scrollTo(0, at(0, 700)); // the root fits the window
    expect(progress.style.width).toBe('0%');
    await destroyEnhancement(root);
    expect(progress.hasAttribute('style')).toBe(false);
  });
});

describe('the phone bar', () => {
  /** A root whose rect follows the scroll, enhanced, past its first frame. */
  async function phoneRoot(options: EnhanceOptions = {}): Promise<{ root: HTMLElement; go: (y: number) => Promise<void> }> {
    const root = mount();
    await enhance(root, options);
    await frames();
    const go = (y: number): Promise<void> => scrollTo(y, () => rects.set(root, { top: -y, height: 10_000 }));
    return { root, go };
  }

  it('hides when scrolling down past 300 px, and returns on scrolling up, or near the top', async () => {
    expect([HIDE_AFTER, SCROLL_SLACK]).toEqual([300, 6]);
    phone = true;
    const { root, go } = await phoneRoot();
    const hidden = (): boolean => root.classList.contains('bar-hidden');
    await go(200);
    await go(290); // down, but not past 300
    expect(hidden()).toBe(false);
    await go(400); // down, past 300
    expect(hidden()).toBe(true);
    await go(405); // down by less than the slack: no change
    expect(hidden()).toBe(true);
    await go(402); // up by less than the slack
    expect(hidden()).toBe(true);
    await go(395); // up by more
    expect(hidden()).toBe(false);
    await go(399); // down by less than the slack
    expect(hidden()).toBe(false);
    await go(600);
    expect(hidden()).toBe(true);
    await go(605);
    await go(299); // back above 300 (and up)
    expect(hidden()).toBe(false);
    await go(700);
    expect(hidden()).toBe(true);
    await destroyEnhancement(root);
    expect(hidden()).toBe(false);
  });

  it('stays while a dialog is open or the day view is on; a held bar shows', async () => {
    phone = true;
    const { root, go } = await phoneRoot();
    const ctx = ctxOf(root);
    const hidden = (): boolean => root.classList.contains('bar-hidden');
    let open = true;
    ctx.overlays.register('jump', { isOpen: () => open, close: () => undefined });
    await go(500);
    await go(900);
    expect(hidden()).toBe(false); // a dialog is open
    open = false;
    await go(1200);
    expect(hidden()).toBe(true);
    open = true;
    await go(1100); // up, with a dialog open: it stays as it is
    expect(hidden()).toBe(true);
    open = false;
    await go(1000);
    expect(hidden()).toBe(false);
    root.classList.add('ver-on'); // the day view (Task 22) keeps the bar
    await go(1500);
    expect(hidden()).toBe(false);
    root.classList.remove('ver-on');
    await go(1800);
    expect(hidden()).toBe(true);
    ctx.position.holdBar(); // a jump just moved the page
    await go(2400);
    expect(hidden()).toBe(false);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + BAR_HOLD_MS + 1); // the hold is over
    await go(2600);
    expect(hidden()).toBe(true);
  });

  it('a card (a preview, not a dialog) does not keep the bar', async () => {
    phone = true;
    const { root, go } = await phoneRoot();
    ctxOf(root).overlays.register('card', { isOpen: () => true, close: () => undefined });
    await go(500);
    await go(900);
    expect(root.classList.contains('bar-hidden')).toBe(true);
  });

  it('never hidden on a wider window: it shows again when the window widens', async () => {
    phone = true;
    const { root, go } = await phoneRoot();
    await go(500);
    await go(900);
    expect(root.classList.contains('bar-hidden')).toBe(true);
    phone = false;
    await go(1300);
    expect(root.classList.contains('bar-hidden')).toBe(false);
  });
});

describe('the bar: --bar-h and its landmark', () => {
  /** getComputedStyle, answering these values by element and property ('' for any other). */
  function computed(values: Map<Element, Record<string, string>>): void {
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (el: Element) => ({ getPropertyValue: (p: string) => values.get(el)?.[p] ?? '' }) as unknown as CSSStyleDeclaration,
    );
  }

  it('--bar-h is the bar\'s measured height without its padding, written on the root only when it differs', async () => {
    const root = mount();
    await enhance(root);
    await frames();
    const ctx = ctxOf(root);
    const bar = ctx.slots?.bar as HTMLElement;
    let height = 100;
    Object.defineProperty(bar, 'clientHeight', { configurable: true, get: () => height });
    const values = new Map<Element, Record<string, string>>([
      [root, { '--bar-h': '48px' }],
      [bar, { 'padding-top': '0px', 'padding-bottom': '52px' }],
    ]);
    computed(values);
    ctx.relayout('content');
    await frames();
    expect(root.hasAttribute('style')).toBe(false); // 100 less 52 is the 48 the stylesheet gives
    height = 130; // a banner of 30 px joined the bar
    ctx.relayout('content');
    await frames();
    expect(root.style.getPropertyValue('--bar-h')).toBe('78px');
    values.set(root, { '--bar-h': '78px' });
    height = 0; // not laid out (printing, or hidden by the host): nothing is measured
    ctx.relayout('content');
    await frames();
    expect(root.style.getPropertyValue('--bar-h')).toBe('78px');
    height = 100.4;
    ctx.relayout('content');
    await frames();
    expect(root.style.getPropertyValue('--bar-h')).toBe('48px');
    await destroyEnhancement(root);
    expect(root.hasAttribute('style')).toBe(false);
  });

  it('a padding the window cannot read counts as none', async () => {
    const root = mount();
    await enhance(root);
    await frames();
    const ctx = ctxOf(root);
    const bar = ctx.slots?.bar as HTMLElement;
    Object.defineProperty(bar, 'clientHeight', { configurable: true, get: () => 60 });
    computed(new Map([[root, { '--bar-h': '48px' }]]));
    ctx.relayout('content');
    await frames();
    expect(root.style.getPropertyValue('--bar-h')).toBe('60px');
  });

  it('no --bar-h without the bar', async () => {
    const root = mount();
    await enhance(root, { chrome: { bar: false } });
    computed(new Map([[root, { '--bar-h': '48px' }]]));
    ctxOf(root).relayout('content');
    await frames();
    expect(root.hasAttribute('style')).toBe(false);
  });

  it('the bar is no landmark while its tray is empty; its first tool makes it a labelled navigation landmark', () => {
    const root = document.createElement('main');
    document.body.append(root);
    const { journal } = createJournal(
      () => true,
      (fn) => fn(),
    );
    const { slots } = createBar({ root, journal, isDocument: true });
    expect([slots.bar.localName, slots.bar.getAttribute('role'), slots.bar.getAttribute('aria-label')]).toEqual(['nav', 'none', null]);
    slots.tool('jump', chrome(document, 'button', { text: 'Jump' }));
    expect([slots.bar.getAttribute('role'), slots.bar.getAttribute('aria-label')]).toEqual([null, 'Document tools']);
    slots.tool('settings', chrome(document, 'button', { text: 'Aa' }));
    expect([slots.bar.getAttribute('role'), slots.bar.getAttribute('aria-label')]).toEqual([null, 'Document tools']);
  });

  it('in a reader: a tool put in the tray during the build makes the bar a labelled landmark', async () => {
    const root = mount();
    hooks.probes.push({
      name: 'tool-probe',
      build: (ctx: FeatureContext) => {
        ctx.slots?.tool('contents', chrome(ctx.root.ownerDocument, 'button', { text: 'Contents' }));
      },
    } satisfies Feature);
    await enhance(root);
    const bar = ctxOf(root).slots?.bar as HTMLElement;
    expect([bar.hasAttribute('role'), bar.getAttribute('aria-label')]).toEqual([false, 'Document tools']);
  });
});

describe('RF3: rect reads per frame', () => {
  /** A document with `n` level-2 sections, each placed 100 px below the last. */
  function many(n: number): { root: HTMLElement; place: (y: number) => void } {
    const md = ['# Many sections', '', ...Array.from({ length: n }, (_, i) => [`## Part ${String(i + 1)}`, '', `Text ${String(i + 1)}.`, '']).flat()].join('\n');
    const root = mount(md);
    const hs = Array.from(root.querySelectorAll('h2'));
    return {
      root,
      place: (y) => {
        hs.forEach((h, i) => rects.set(h, { top: 1000 + 100 * i - y }));
        rects.set(root, { top: -y, height: 1000 + 100 * n + 500 });
      },
    };
  }

  it('the spy reads at most 2⌈log₂ n⌉ + 4 rects a frame, and finds the same section a scan from the top would', async () => {
    const n = 1000;
    const { root, place } = many(n);
    await enhance(root);
    await frames();
    const log = spyLog(root);
    const bound = 2 * Math.ceil(Math.log2(n)) + 4;
    const line = Math.max(LINE_MIN, 768 * LINE_SHARE);
    let worst = 0;
    for (const y of [0, 769, 770, 771, 1000, 12_345, 50_000, 99_000, 99_769, 99_770, 99_771, 120_000]) {
      reads = 0;
      await scrollTo(y, place);
      worst = Math.max(worst, reads);
      // the last heading whose top is above the line, found by a scan
      const k = Math.floor((y + line - 1000 - 1e-9) / 100);
      const expected = k < 0 ? null : `part-${String(Math.min(n, k + 1))}`;
      expect([y, ctxOf(root).sections.length, log.at(-1)?.section ?? null]).toEqual([y, n, expected]);
    }
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThanOrEqual(bound);
  });

  it('on a plan, both searches together stay within the bound', async () => {
    planProbe();
    const tasks = 400;
    const md = [
      '# A long plan',
      '',
      '## 1. Scope',
      '',
      'What it covers.',
      '',
      '## 2. Tasks',
      '',
      ...Array.from({ length: tasks }, (_, i) => [`### Task ${String(i + 1)}: Part ${String(i + 1)}`, '', `- [ ] **Step 1:** Do ${String(i + 1)}.`, '']).flat(),
      '## 3. Notes',
      '',
      'End.',
      '',
    ].join('\n');
    const root = mount(md);
    await enhance(root);
    await frames();
    const hs = Array.from(root.querySelectorAll('h2, h3'));
    const place = (y: number): void => {
      hs.forEach((h, i) => rects.set(h, { top: 1000 + 100 * i - y }));
      rects.set(root, { top: -y, height: 1000 + 100 * hs.length + 500 });
    };
    const log = spyLog(root);
    const n = ctxOf(root).sections.length + tasks;
    let worst = 0;
    for (const y of [0, 900, 20_000, 41_000, 60_000]) {
      reads = 0;
      await scrollTo(y, place);
      worst = Math.max(worst, reads);
    }
    expect(log.length).toBeGreaterThan(2);
    expect(log.some((e) => e.unit !== null && e.unit.startsWith('task-'))).toBe(true);
    expect(worst).toBeLessThanOrEqual(2 * Math.ceil(Math.log2(n)) + 4);
  });
});
