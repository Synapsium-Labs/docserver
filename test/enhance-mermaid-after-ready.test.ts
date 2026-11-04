// @vitest-environment jsdom
// Mermaid after ready (docserver batch 1.1.0, Task 2; ledger C107): the enhance option `mermaid.draw` takes a third
// value, 'after-ready'. In that mode the second phase sets the root to `waiting` with no gate (so every source stays
// readable text), calls load() once and awaits it, waits for the fonts, and only then sets the gate and `drawing` and
// draws every figure with no tap, nearest first, through the same queue as 'auto'. A null module gives every figure the
// load note and the root `failed`; a figure that throws takes `draw-failed` (root `partial`). Rows B2.1 to B2.6, with a
// deferred fake Mermaid.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyEnhancement, enhance, type EnhanceOptions } from '../src/enhance/index.js';
import { NOTES } from '../src/enhance/diagrams.js';
import { MERMAID_DRAW_VALUES, normalizeOptions } from '../src/enhance/options.js';
import { MERMAID_DRAW } from '../src/frame/seed.js';
import { render } from '../src/render/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const GATE = 'data-docreader-mermaid';
const STATE = 'data-docreader-diagrams';

const fence = (source: string, caption: string): string => ['```mermaid', source, '```', '', caption, ''].join('\n');
const FIVE = [
  '# Diagrams',
  '',
  ...['one', 'two', 'three', 'four', 'five'].map((w, i) => fence(`flowchart LR\n  ${w} --> X`, `*Figure ${String(i + 1)}. The ${w}.*`)),
].join('\n');
const THREE = [
  '# Diagrams',
  '',
  ...['one', 'two', 'three'].map((w, i) => fence(`flowchart LR\n  ${w} --> X`, `*Figure ${String(i + 1)}. The ${w}.*`)),
].join('\n');

const mounted: HTMLElement[] = [];
function mount(md: string): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(md).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes));
  document.body.append(root);
  mounted.push(root);
  return root;
}
afterEach(async () => {
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

const wordOf = (text: string): string => /\n\s*(\S+)/.exec(text)?.[1] ?? text;
const figuresOf = (root: Element): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>('figure.mermaid-figure'));
const svgsIn = (el: Element): number => el.querySelectorAll('svg').length;

/** A fake Mermaid; a word in `fail` throws. `log` records `render <word>` in call order. */
function fakeMermaid(fail: readonly string[] = []): { api: { initialize(c: Record<string, unknown>): void; render(id: string, text: string, el: Element): Promise<{ svg: string }> }; log: string[] } {
  const log: string[] = [];
  return {
    log,
    api: {
      initialize() {},
      render(id, text, container) {
        const word = wordOf(text);
        log.push(`render ${word}`);
        container.textContent = '';
        if (fail.includes(word)) return Promise.reject(new Error('boom'));
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('id', id);
        svg.setAttribute('viewBox', '0 0 300 120');
        return Promise.resolve({ svg: svg.outerHTML });
      },
    },
  };
}

/** A load() the test answers by hand, counting its calls. */
function deferred(): { options: EnhanceOptions; answer(mod: unknown): void; loads: () => number } {
  let loads = 0;
  let answer: (mod: unknown) => void = () => undefined;
  const pending = new Promise<unknown>((resolve) => {
    answer = resolve;
  });
  return {
    options: {
      mermaid: {
        load: () => {
          loads += 1;
          return pending;
        },
        draw: 'after-ready',
      },
    },
    answer: (mod) => {
      answer(mod);
    },
    loads: () => loads,
  };
}

/** Put each figure's source pre at a fixed top in the viewport (jsdom has no layout; its window is 768 px high). */
function placeAt(root: Element, tops: readonly number[]): void {
  figuresOf(root).forEach((figure, i) => {
    const top = tops[i] ?? 0;
    const src = figure.querySelector('pre');
    Object.defineProperty(src, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top, bottom: top + 100, left: 0, right: 600, width: 600, height: 100, x: 0, y: top, toJSON: () => ({}) }),
    });
  });
}

const tick = (ms = 40): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('B2.1: before load() answers, the root waits with no gate and every source readable', () => {
  it('waiting, no gate, a visible code block per figure, no SVG; load() called once', async () => {
    const root = mount(THREE);
    const d = deferred();
    await enhance(root, d.options);
    await tick(80);
    expect(d.loads()).toBe(1);
    expect(root.getAttribute(STATE)).toBe('waiting');
    expect(root.hasAttribute(GATE)).toBe(false);
    expect(svgsIn(root)).toBe(0);
    for (const f of figuresOf(root)) {
      const src = f.querySelector(':scope > pre');
      expect(src?.textContent).toMatch(/flowchart LR/);
      expect(f.classList.contains('drawn')).toBe(false);
    }
    d.answer({ default: fakeMermaid().api });
    await vi.waitFor(() => {
      expect(root.getAttribute(STATE)).toBe('drawn');
    });
    expect(d.loads()).toBe(1);
  });
});

describe('B2.2: once load() answers, every figure is drawn with no tap, nearest first', () => {
  it('draws all, in the near-first order, and the root settles drawn with the gate set', async () => {
    const root = mount(FIVE);
    placeAt(root, [1800, 100, -1500, 1950, 5000]);
    const d = deferred();
    await enhance(root, d.options);
    await tick(80);
    expect(root.getAttribute(STATE)).toBe('waiting');
    const fake = fakeMermaid();
    d.answer({ default: fake.api });
    await vi.waitFor(() => {
      expect(root.getAttribute(STATE)).toBe('drawn');
    });
    expect(root.hasAttribute(GATE)).toBe(true);
    expect(fake.log).toEqual(['render one', 'render two', 'render four', 'render three', 'render five']);
    expect(figuresOf(root).every((f) => f.classList.contains('drawn'))).toBe(true);
    expect(svgsIn(root)).toBe(5);
  });
});

describe('B2.3: a module that is not Mermaid', () => {
  it('every figure shows the load note and the root reads failed', async () => {
    const root = mount(THREE);
    const d = deferred();
    await enhance(root, d.options);
    d.answer({});
    await vi.waitFor(() => {
      expect(root.getAttribute(STATE)).toBe('failed');
    });
    for (const f of figuresOf(root)) {
      expect(f.classList.contains('draw-failed')).toBe(true);
      expect(f.querySelector('.fig-error p')?.textContent).toBe(NOTES.load);
      expect(f.querySelector('pre.fig-src code')).not.toBeNull();
    }
    expect(svgsIn(root)).toBe(0);
  });
});

describe('B2.4: one figure that throws', () => {
  it('takes draw-failed with its note and source, and the root reads partial', async () => {
    const root = mount(THREE);
    const d = deferred();
    await enhance(root, d.options);
    d.answer({ default: fakeMermaid(['two']).api });
    await vi.waitFor(() => {
      expect(root.getAttribute(STATE)).toBe('partial');
    });
    const [a, b, c] = figuresOf(root) as [HTMLElement, HTMLElement, HTMLElement];
    expect(a.classList.contains('drawn')).toBe(true);
    expect(c.classList.contains('drawn')).toBe(true);
    expect(b.classList.contains('draw-failed')).toBe(true);
    expect(b.querySelector('.fig-error p')?.textContent).toBe(NOTES.error);
    expect(b.querySelector('pre.fig-src code')).not.toBeNull();
  });

  it('an over-maxTextSize figure takes the long note through draw(), and the others are drawn (partial)', async () => {
    const root = mount(THREE);
    const d = deferred();
    await enhance(root, { mermaid: { ...(d.options.mermaid as NonNullable<EnhanceOptions['mermaid']>), maxTextSize: 'flowchart LR\n  one --> X\n'.length } });
    const fake = fakeMermaid();
    // The cap fits 'one' and 'two' (equal in length) but not 'three'.
    d.answer({ default: fake.api });
    await vi.waitFor(() => {
      expect(root.getAttribute(STATE)).toBe('partial');
    });
    const [a, b, c] = figuresOf(root) as [HTMLElement, HTMLElement, HTMLElement];
    expect(a.classList.contains('drawn') && b.classList.contains('drawn')).toBe(true);
    expect(c.classList.contains('draw-failed')).toBe(true);
    expect(c.querySelector('.fig-error p')?.textContent).toBe(NOTES.long);
    expect(c.querySelector('pre.fig-src code')).not.toBeNull();
    expect(fake.log).toEqual(['render one', 'render two']);
  });
});

describe('B2.5: the option', () => {
  const load = (): Promise<unknown> => Promise.resolve({});
  /** 'accepted', or the refusal's message. */
  const verdict = (draw: unknown): string => {
    try {
      normalizeOptions({ mermaid: { load, draw } });
      return 'accepted';
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  };
  it("refuses 'lazy', true and null; accepts 'after-ready'; 'auto' and 'on-request' stand", () => {
    for (const draw of ['lazy', true, null]) expect(verdict(draw)).toMatch(/mermaid\.draw must be one of/);
    expect(verdict('after-ready')).toBe('accepted');
    expect(verdict('auto')).toBe('accepted');
    expect(verdict('on-request')).toBe('accepted');
    expect(normalizeOptions({ mermaid: { load, draw: 'after-ready' } }).mermaid?.draw).toBe('after-ready');
    expect(normalizeOptions({ mermaid: { load } }).mermaid?.draw).toBe('auto');
  });
});

describe('B2.6: the draw lists', () => {
  it("the seed's and L2's are equal (C94(2)) and hold 'after-ready'", () => {
    expect([...MERMAID_DRAW_VALUES]).toEqual([...MERMAID_DRAW]);
    expect(MERMAID_DRAW).toContain('after-ready');
    expect(MERMAID_DRAW_VALUES).toContain('after-ready');
    // The seed's acceptance of the value and its refusal of an unknown one: test/frame-seed.test.ts.
  });
});

/** document.fonts as a font set whose faces load when the test says so (jsdom has none). */
function pendingFonts(): { release(): void } {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { load: () => gate.then(() => [{ status: 'loaded' }]), addEventListener: () => undefined, removeEventListener: () => undefined },
  });
  return { release };
}

describe('B2.7: the order is load(), then the fonts, then the gate and drawing', () => {
  it('load() has answered and the fonts are pending: still waiting, no gate; the fonts end: gate and drawing; the first render ends: drawn', async () => {
    const fonts = pendingFonts();
    try {
      const root = mount(THREE);
      const d = deferred();
      await enhance(root, d.options);
      const fake = fakeMermaid();
      // Hold the first render so the intermediate state can be seen.
      let endFirst: () => void = () => undefined;
      const first = new Promise<void>((resolve) => {
        endFirst = resolve;
      });
      const inner = fake.api.render.bind(fake.api);
      let held = false;
      fake.api.render = async (id, text, el) => {
        if (!held) {
          held = true;
          await first;
        }
        return inner(id, text, el);
      };
      d.answer({ default: fake.api });
      await tick(80);
      expect(root.getAttribute(STATE)).toBe('waiting');
      expect(root.hasAttribute(GATE)).toBe(false);
      expect(fake.log).toEqual([]);
      fonts.release();
      await vi.waitFor(() => {
        expect(root.getAttribute(STATE)).toBe('drawing');
      });
      expect(root.hasAttribute(GATE)).toBe(true);
      endFirst();
      await vi.waitFor(() => {
        expect(root.getAttribute(STATE)).toBe('drawn');
      });
      expect(root.hasAttribute(GATE)).toBe(true);
    } finally {
      Reflect.deleteProperty(document, 'fonts');
    }
  });
});

describe('B2.8: destroyed while waiting', () => {
  it('destroyed before load() answers: the state is gone at once; a later answer leaves no gate, no state, no drawing; a fresh enhance still settles', async () => {
    const root = mount(THREE);
    const d = deferred();
    await enhance(root, d.options);
    await tick(40);
    expect(root.getAttribute(STATE)).toBe('waiting');
    await destroyEnhancement(root);
    expect(root.hasAttribute(STATE)).toBe(false);
    const fake = fakeMermaid();
    d.answer({ default: fake.api });
    await tick(100);
    expect(root.hasAttribute(GATE)).toBe(false);
    expect(root.hasAttribute(STATE)).toBe(false);
    expect(svgsIn(root)).toBe(0);
    expect(fake.log).toEqual([]);
    const again = deferred();
    await enhance(root, again.options);
    again.answer({ default: fakeMermaid().api });
    await vi.waitFor(() => {
      expect(root.getAttribute(STATE)).toBe('drawn');
    });
  });

  it('destroyed after load() answers, during the fonts wait: no gate, no state, nothing drawn', async () => {
    const fonts = pendingFonts();
    try {
      const root = mount(THREE);
      const d = deferred();
      await enhance(root, d.options);
      const fake = fakeMermaid();
      d.answer({ default: fake.api });
      await tick(80);
      expect(root.getAttribute(STATE)).toBe('waiting');
      await destroyEnhancement(root);
      fonts.release();
      await tick(100);
      expect(root.hasAttribute(GATE)).toBe(false);
      expect(root.hasAttribute(STATE)).toBe(false);
      expect(svgsIn(root)).toBe(0);
      expect(fake.log).toEqual([]);
    } finally {
      Reflect.deleteProperty(document, 'fonts');
    }
  });
});
