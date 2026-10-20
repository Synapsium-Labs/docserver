// @vitest-environment jsdom
// Diagrams of `./enhance` (docserver L2, Task 21), ported from the reference layout's section 26 (the drawing) and the
// first-paint steps that concern diagrams, with a fake Mermaid: what the feature asks of the module (initialize before
// each run, the configuration it passes, one call at a time per module across roots), the order it draws in (the
// figures near the viewport first, in document order, then the rest, nearest first), what it writes (the root's gate
// and state, a chrome `pre.mermaid` beside the source, the figure's class, the fallback note, the drawing's name and
// width), and what a destroy stops (RF5). The real file in a real browser is test/browser/diagrams.test.ts.
//
// The secure keys are measured against Mermaid 12.1.0's own configuration schema, its generated types in the pinned
// package (`mermaid/dist/config.type.d.ts`), read with TypeScript's parser: every key whose name says it styles the
// drawing is listed, and the list holds nothing the schema does not name.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  after as afterDiagrams,
  FONT_FALLBACK,
  MAX_EDGES,
  MAX_TEXT_SIZE,
  MERMAID_SECURE,
  NOTES,
  secureGroups,
  secureKeys,
  THEME_VARIABLES,
} from '../src/enhance/diagrams.js';
import { destroyEnhancement, enhance, type EnhanceOptions } from '../src/enhance/index.js';
import { CHROME_ATTR } from '../src/enhance/journal.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { render } from '../src/render/index.js';

const hooks = vi.hoisted(() => ({
  /** Each position.keep() while `watch` is on: how many figures were drawn or failed before and after it ran. */
  kept: [] as [number, number][],
  watch: false,
}));

vi.mock('../src/enhance/nav.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/enhance/nav.js')>();
  const done = (): number => document.querySelectorAll('figure.drawn, figure.draw-failed').length;
  return {
    ...real,
    createPosition: (env: Parameters<typeof real.createPosition>[0]) => {
      const p = real.createPosition(env);
      return Object.freeze({
        ...p,
        keep: <T,>(fn: () => T): T => {
          if (!hooks.watch) return p.keep(fn);
          const was = done();
          const out = p.keep(fn);
          hooks.kept.push([was, done()]);
          return out;
        },
      });
    },
  };
});

const ROOT = path.join(import.meta.dirname, '..');
const SVG_NS = 'http://www.w3.org/2000/svg';
const GATE = 'data-docreader-mermaid';
const STATE = 'data-docreader-diagrams';

/** A Mermaid fence, then its caption line (none when empty). */
const fence = (source: string, caption = ''): string => ['```mermaid', source, '```', '', caption, ''].join('\n');

/** Three figures, each a flowchart whose first node names it. */
const DOC = [
  '# Diagrams',
  '',
  'Intro.',
  '',
  fence('flowchart LR\n  one --> A', '*Figure 1. The first.*'),
  fence('flowchart LR\n  two --> B', '*Figure 2. The second.*'),
  fence('flowchart LR\n  three --> C', '*Figure 3. The third.*'),
].join('\n');

const mounted: HTMLElement[] = [];

function mount(md: string = DOC): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(md).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes));
  document.body.append(root);
  mounted.push(root);
  return root;
}

afterEach(async () => {
  hooks.watch = false;
  hooks.kept.length = 0;
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

/** What the fake makes of a source: a drawing, nothing (an error, as Mermaid leaves it), or Mermaid's error drawing. */
type Draw = 'svg' | 'empty' | 'error';

interface RunOptions {
  readonly nodes: readonly HTMLElement[];
  readonly suppressErrors?: boolean;
}

interface FakeApi {
  initialize(config: Record<string, unknown>): void;
  run(options: RunOptions): Promise<void>;
}

interface Fake {
  readonly api: FakeApi;
  /** Every call, in order: `init <tag>` (the last secure key, which each case's host adds) and `run <first word>`. */
  readonly log: string[];
  readonly configs: Record<string, unknown>[];
  /** The node each run was given. */
  readonly nodes: HTMLElement[];
  /** Each run's suppressErrors. */
  readonly suppressed: unknown[];
  /** Hold every run until release(). */
  hold: boolean;
  /** Finish the oldest held run; false when none is held. */
  release(): boolean;
}

/** The first word of a diagram's second line: the name each fixture gives its first node. */
const wordOf = (text: string): string => /\n\s*(\S+)/.exec(text)?.[1] ?? text;

function fakeMermaid(draw: (text: string) => Draw = () => 'svg', decorate: (svg: SVGSVGElement, text: string) => void = () => undefined): Fake {
  const log: string[] = [];
  const configs: Record<string, unknown>[] = [];
  const nodes: HTMLElement[] = [];
  const suppressed: unknown[] = [];
  const held: (() => void)[] = [];
  const fake: Fake = {
    api: {
      initialize(config) {
        configs.push(config);
        const secure = config['secure'];
        log.push(`init ${Array.isArray(secure) ? String(secure[secure.length - 1]) : '?'}`);
      },
      run(options) {
        const node = options.nodes[0] as HTMLElement;
        nodes.push(node);
        suppressed.push(options.suppressErrors);
        // As Mermaid does: mark the node, read its text, then replace it with the drawing (or nothing, on an error).
        node.setAttribute('data-processed', 'true');
        const text = node.textContent ?? '';
        log.push(`run ${wordOf(text)}`);
        const finish = (): void => {
          node.textContent = '';
          const how = draw(text);
          if (how === 'empty') return;
          const svg = document.createElementNS(SVG_NS, 'svg');
          svg.setAttribute('id', `mermaid-${String(nodes.length)}`);
          svg.setAttribute('viewBox', '0 0 300 120');
          svg.setAttribute('style', 'max-width: 300.4px;');
          if (how === 'error') svg.setAttribute('aria-roledescription', 'error');
          decorate(svg, text);
          node.append(svg);
        };
        if (!fake.hold) {
          finish();
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          held.push(() => {
            finish();
            resolve();
          });
        });
      },
    },
    log,
    configs,
    nodes,
    suppressed,
    hold: false,
    release() {
      const next = held.shift();
      if (next === undefined) return false;
      next();
      return true;
    },
  };
  return fake;
}

/** Options that draw with `mod` (resolved by load), tagged by a secure key the host adds. */
function drawWith(mod: unknown, tag = 'tagA', extra: Partial<NonNullable<EnhanceOptions['mermaid']>> = {}): EnhanceOptions {
  return { mermaid: { load: () => Promise.resolve(mod), secure: [tag], ...extra } };
}

const figuresOf = (root: Element): HTMLElement[] => Array.from(root.querySelectorAll('figure.mermaid-figure'));

/** The figure's own source pre (render()'s), never chrome. */
const sourceOf = (figure: Element): HTMLElement => {
  const pre = Array.from(figure.children).find((c) => c.localName === 'pre' && !c.hasAttribute(CHROME_ATTR));
  if (pre === undefined) throw new Error('no source pre');
  return pre as HTMLElement;
};

/** The chrome pre the drawing went into, or null. */
const drawingOf = (figure: Element): HTMLElement | null =>
  (Array.from(figure.children).find((c) => c.localName === 'pre' && c.hasAttribute(CHROME_ATTR)) as HTMLElement | undefined) ?? null;

const settledState = async (root: Element, state: string): Promise<void> => {
  await vi.waitFor(() => {
    expect(root.getAttribute(STATE)).toBe(state);
  });
};

/** Put each figure's source pre at a fixed top in the viewport (jsdom has no layout; its window is 768 px high). */
function placeAt(root: Element, tops: readonly number[]): void {
  figuresOf(root).forEach((figure, i) => {
    const top = tops[i] ?? 0;
    Object.defineProperty(sourceOf(figure), 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top, bottom: top + 100, left: 0, right: 600, width: 600, height: 100, x: 0, y: top, toJSON: () => ({}) }),
    });
  });
}

describe('diagrams: drawing (a fake Mermaid)', () => {
  it('draws nothing without the mermaid option: no gate, no state, each figure keeps its source', async () => {
    const root = mount();
    const before = root.innerHTML;
    await enhance(root);
    await new Promise((r) => setTimeout(r, 50));
    expect(root.hasAttribute(GATE)).toBe(false);
    expect(root.hasAttribute(STATE)).toBe(false);
    expect(figuresOf(root).map((f) => drawingOf(f))).toEqual([null, null, null]);
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(before);
  });

  it('asks the host for the module once, as drawing starts, with the gate and the state set before anything is drawn', async () => {
    const root = mount();
    const fake = fakeMermaid();
    let calls = 0;
    let atLoad: [string | null, string | null] = [null, null];
    await enhance(root, {
      mermaid: {
        load: () => {
          calls += 1;
          atLoad = [root.getAttribute(GATE), root.getAttribute(STATE)];
          return Promise.resolve({ default: fake.api });
        },
      },
    });
    // enhance() resolved with the layout built: the drawing comes after, in the second phase (LD5).
    expect(atLoad).toEqual(['', 'drawing']);
    expect(fake.log).toEqual([]);
    await settledState(root, 'drawn');
    expect(calls).toBe(1);
    expect(fake.log.filter((l) => l.startsWith('run'))).toHaveLength(3);
  });

  it('a module that is the API itself draws as well as one whose default export is the API', async () => {
    const root = mount();
    const fake = fakeMermaid();
    await enhance(root, drawWith(fake.api));
    await settledState(root, 'drawn');
    expect(fake.log.filter((l) => l.startsWith('run'))).toHaveLength(3);
  });

  it('initialises before each run, with the reader\'s configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host\'s', async () => {
    const root = mount();
    const fake = fakeMermaid();
    await enhance(root, drawWith({ default: fake.api }, 'extraKey', { secure: ['themeCSS', 'extraKey'] }));
    await settledState(root, 'drawn');
    expect(fake.log).toEqual(['init extraKey', 'run one', 'init extraKey', 'run two', 'init extraKey', 'run three']);
    const config = fake.configs[0] ?? {};
    expect(config).toMatchObject({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      layout: 'dagre',
      theme: 'base',
      maxTextSize: 50_000,
      maxEdges: 500,
      fontFamily: FONT_FALLBACK,
    });
    expect(config['themeVariables']).toEqual({ ...THEME_VARIABLES, fontFamily: FONT_FALLBACK });
    // A label's own markup loses its style elements, and its style and class attributes.
    expect(config['dompurifyConfig']).toEqual({ FORBID_TAGS: ['style'], FORBID_ATTR: ['style', 'class'] });
    // Each run is given its node alone, and asked to keep its errors to itself.
    expect(fake.suppressed).toEqual([true, true, true]);
    expect(fake.nodes.every((n) => n.localName === 'pre' && n.hasAttribute(CHROME_ATTR))).toBe(true);
    // The library's keys, then the host's that are not among them, each once.
    expect(config['secure']).toEqual([...secureKeys(), 'extraKey']);
    // Each call gets its own configuration object: Mermaid keeps what it is given.
    expect(new Set(fake.configs).size).toBe(3);
  });

  it('the host\'s limits replace the pinned defaults', async () => {
    const root = mount();
    const fake = fakeMermaid();
    await enhance(root, drawWith({ default: fake.api }, 'tagA', { maxTextSize: 1234, maxEdges: 7 }));
    await settledState(root, 'drawn');
    expect(fake.configs[0]).toMatchObject({ maxTextSize: 1234, maxEdges: 7 });
  });

  it('pins the limits at Mermaid 12.1.0\'s defaults, and its own secure keys first', () => {
    expect([MAX_TEXT_SIZE, MAX_EDGES]).toEqual([50_000, 500]);
    expect(MERMAID_SECURE).toEqual(['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'suppressErrorRendering', 'maxEdges']);
    expect(secureKeys().slice(0, 6)).toEqual(MERMAID_SECURE);
    expect(new Set(secureKeys()).size).toBe(secureKeys().length);
  });

  it('takes the font family from the root\'s --sans when it is a plain list of families, and its own otherwise', async () => {
    const plain = mount();
    plain.style.setProperty('--sans', '"Some Sans", Arial, sans-serif');
    const fakeA = fakeMermaid();
    await enhance(plain, drawWith({ default: fakeA.api }));
    await settledState(plain, 'drawn');
    expect(fakeA.configs[0]).toMatchObject({ fontFamily: '"Some Sans", Arial, sans-serif' });
    expect((fakeA.configs[0]?.['themeVariables'] as Record<string, unknown>)['fontFamily']).toBe('"Some Sans", Arial, sans-serif');

    // A value that could end the CSS rule Mermaid writes it into falls back to the library's own.
    const hostile = mount();
    hostile.style.setProperty('--sans', 'x} svg { position: fixed');
    const fakeB = fakeMermaid();
    await enhance(hostile, drawWith({ default: fakeB.api }));
    await settledState(hostile, 'drawn');
    expect(fakeB.configs[0]).toMatchObject({ fontFamily: FONT_FALLBACK });
  });

  it('draws into a chrome pre.mermaid beside the source, which is never written into, then marks the figure drawn and names the drawing', async () => {
    const root = mount();
    const fake = fakeMermaid();
    const before = root.innerHTML;
    const sources = figuresOf(root).map((f) => sourceOf(f));
    const texts = sources.map((s) => s.innerHTML);
    await enhance(root, drawWith({ default: fake.api }));
    await settledState(root, 'drawn');
    expect(root.hasAttribute(GATE)).toBe(true);
    for (const [i, figure] of figuresOf(root).entries()) {
      const source = sources[i] as HTMLElement;
      expect(figure.classList.contains('drawn')).toBe(true);
      expect(figure.classList.contains('draw-failed')).toBe(false);
      // The source: the same node, its text and attributes as written.
      expect(sourceOf(figure)).toBe(source);
      expect(source.innerHTML).toBe(texts[i]);
      expect(source.hasAttribute('data-processed')).toBe(false);
      // The drawing: a chrome pre.mermaid right after the source, the one Mermaid was given.
      const drawing = drawingOf(figure);
      expect(drawing).toBe(fake.nodes[i]);
      expect(drawing?.previousElementSibling).toBe(source);
      expect(drawing?.className).toBe('mermaid');
      const svg = drawing?.querySelector('svg');
      expect(svg?.getAttribute('role')).toBe('img');
      expect(svg?.getAttribute('aria-label')).toBe(`Figure ${String(i + 1)}. The ${['first', 'second', 'third'][i] ?? ''}.`);
      // The figure is as wide as its drawing: the drawing's own width, its plate's padding and border, rounded up.
      expect(figure.style.getPropertyValue('--fig-w')).toBe('353px');
    }
    expect(root.querySelector('.fig-error')).toBe(null);
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(before);
    expect(root.hasAttribute(GATE)).toBe(false);
    expect(root.hasAttribute(STATE)).toBe(false);
  });

  it('marks each figure inside position.keep, so the reader keeps their place, and asks for a relayout for its content', async () => {
    const root = mount(['# D', '', fence('flowchart LR\n  one --> A'), fence('flowchart LR\n  two --> B')].join('\n'));
    const fake = fakeMermaid((text) => (text.includes('two') ? 'empty' : 'svg'));
    hooks.watch = true;
    await enhance(root, drawWith({ default: fake.api }));
    const ctx = contextOf(root);
    if (ctx === undefined) throw new Error('no context');
    const reasons: string[] = [];
    ctx.events.on('relayout', (e) => {
      reasons.push(...e.reasons);
    });
    await settledState(root, 'partial');
    // Each figure's mark, the drawn one's and the failed one's, is made inside a keep (relayout runs in its own).
    expect(hooks.kept.filter(([was, now]) => was !== now)).toEqual([
      [0, 1],
      [1, 2],
    ]);
    await vi.waitFor(() => {
      expect(reasons).toContain('content');
    });
  });

  it('draws nothing before the next frame, so the page is painted first', async () => {
    const root = mount();
    const fake = fakeMermaid();
    await enhance(root, drawWith({ default: fake.api }));
    // The fonts wait and the load settle at once here; a task later, the frame (16 ms in jsdom) has not come.
    await new Promise((r) => setTimeout(r, 0));
    expect(fake.log).toEqual([]);
    await settledState(root, 'drawn');
  });

  it('lets the page run a task between the near figures and the rest', async () => {
    const md = ['# D', '', fence('flowchart LR\n  one --> A'), fence('flowchart LR\n  two --> B')].join('\n');
    const root = mount(md);
    placeAt(root, [100, 5000]);
    const fake = fakeMermaid();
    let ran = false;
    const seen: [string, boolean][] = [];
    const api = {
      initialize: (c: Record<string, unknown>) => {
        fake.api.initialize(c);
      },
      run: (o: RunOptions): Promise<void> => {
        const word = wordOf(o.nodes[0]?.textContent ?? '');
        seen.push([word, ran]);
        // The near figure's run asks for a task; the far figure's run sees whether that task came first.
        if (word === 'one') setTimeout(() => (ran = true), 0);
        return fake.api.run(o);
      },
    };
    await enhance(root, drawWith({ default: api }));
    await settledState(root, 'drawn');
    expect(seen).toEqual([
      ['one', false],
      ['two', true],
    ]);
  });

  it('names a drawing by its caption, else by its own title, else by the first line of its source', async () => {
    const md = ['# D', '', fence('flowchart LR\n  one --> A', '*Figure 1. Named.*'), fence('%% a note\nflowchart LR\n  two --> B'), fence('flowchart LR\n  three --> C')].join('\n');
    const root = mount(md);
    // The third drawing carries a title of its own, as a diagram's accTitle gives it.
    const fake = fakeMermaid(undefined, (svg, text) => {
      if (!text.includes('three')) return;
      const title = document.createElementNS(SVG_NS, 'title');
      title.textContent = 'Its own title';
      svg.prepend(title);
    });
    await enhance(root, drawWith({ default: fake.api }));
    await settledState(root, 'drawn');
    const labels = figuresOf(root).map((f) => drawingOf(f)?.querySelector('svg')?.getAttribute('aria-label'));
    expect(labels).toEqual(['Figure 1. Named.', 'Figure 2. flowchart LR', 'Figure 3. Its own title']);
  });

  it('draws the figures near the viewport first, in document order, then the rest, nearest first', async () => {
    const md = ['# D', '', ...['one', 'two', 'three', 'four', 'five'].map((w) => fence(`flowchart LR\n  ${w} --> X`))].join('\n');
    const root = mount(md);
    // The window is 768 px high: near means less than 1.5 screens (1152 px) away from it.
    placeAt(root, [1800, 100, -1500, 1950, 5000]);
    const fake = fakeMermaid();
    await enhance(root, drawWith({ default: fake.api }));
    await settledState(root, 'drawn');
    // one (1032 px below the window) and two (in it) are near, in document order; then the rest, nearest first:
    // four (1182 below), three (1400 above, its bottom being 1400 px over the window's top), five (4232 below).
    expect(fake.log.filter((l) => l.startsWith('run'))).toEqual(['run one', 'run two', 'run four', 'run three', 'run five']);
  });

  it('serialises the calls per Mermaid module across roots: one root\'s run ends before the next initialize', async () => {
    const a = mount();
    const b = mount(['# B', '', fence('flowchart LR\n  bee --> X')].join('\n'));
    const fake = fakeMermaid();
    fake.hold = true;
    await enhance(a, drawWith({ default: fake.api }, 'tagA'));
    await enhance(b, drawWith({ default: fake.api }, 'tagB'));
    await vi.waitFor(() => {
      expect(fake.log).toEqual(['init tagA', 'run one']);
    });
    // b and c have queued their first figures behind a's by now.
    await new Promise((r) => setTimeout(r, 60));
    // b's first figure waits behind a's first: nothing of b runs while a's call is open.
    await new Promise((r) => setTimeout(r, 60));
    expect(fake.log).toEqual(['init tagA', 'run one']);
    expect(fake.release()).toBe(true);
    await vi.waitFor(() => {
      expect(fake.log).toEqual(['init tagA', 'run one', 'init tagB', 'run bee']);
    });
    // a's second figure was queued behind b's: one call at a time, in the order they were asked for.
    fake.hold = false;
    expect(fake.release()).toBe(true);
    await settledState(a, 'drawn');
    await settledState(b, 'drawn');
    expect(fake.log).toEqual(['init tagA', 'run one', 'init tagB', 'run bee', 'init tagA', 'run two', 'init tagA', 'run three']);
  });

  it('two Mermaid modules have a queue each: a call on one never waits for the other', async () => {
    const a = mount();
    const b = mount(['# B', '', fence('flowchart LR\n  bee --> X')].join('\n'));
    const held = fakeMermaid();
    held.hold = true;
    const free = fakeMermaid();
    await enhance(a, drawWith({ default: held.api }, 'tagA'));
    await enhance(b, drawWith({ default: free.api }, 'tagB'));
    await settledState(b, 'drawn');
    expect(free.log).toEqual(['init tagB', 'run bee']);
    expect(held.log).toEqual(['init tagA', 'run one']);
  });

  it('a figure Mermaid could not draw falls back: draw-failed, and a note holding its source in a details', async () => {
    const root = mount();
    const before = root.innerHTML;
    const fake = fakeMermaid((text) => (text.includes('two') ? 'empty' : 'svg'));
    await enhance(root, drawWith({ default: fake.api }));
    await settledState(root, 'partial');
    const [one, two] = figuresOf(root) as [HTMLElement, HTMLElement, HTMLElement];
    expect(one.className).toBe('mermaid-figure drawn');
    expect(two.className).toBe('mermaid-figure draw-failed');
    expect(two.style.getPropertyValue('--fig-w')).toBe('');
    const note = two.querySelector('.fig-error');
    // The note goes before the source, which stays as it was (the stylesheet hides it).
    expect(note?.nextElementSibling).toBe(sourceOf(two));
    expect(note?.hasAttribute(CHROME_ATTR)).toBe(true);
    expect(note?.getAttribute('role')).toBe('note');
    expect(note?.querySelector(':scope > p')?.textContent).toBe(NOTES.error);
    expect(note?.querySelector(':scope > details > summary')?.textContent).toBe('Show its Mermaid source');
    const src = note?.querySelector(':scope > details > pre.fig-src');
    expect(src?.getAttribute('tabindex')).toBe('0');
    expect(src?.querySelector(':scope > code')?.textContent).toBe(sourceOf(two).textContent);
    expect(one.querySelector('.fig-error')).toBe(null);
    await destroyEnhancement(root);
    expect(root.innerHTML).toBe(before);
  });

  it('a drawing Mermaid made of its own error counts as failed', async () => {
    const root = mount();
    const fake = fakeMermaid(() => 'error');
    await enhance(root, drawWith({ default: fake.api }));
    await settledState(root, 'failed');
    expect(figuresOf(root).map((f) => f.classList.contains('draw-failed'))).toEqual([true, true, true]);
  });

  it('a drawing that left its figure (the host moved it) counts as failed', async () => {
    const root = mount();
    const away = document.createElement('div');
    document.body.append(away);
    const fake = fakeMermaid();
    const api = {
      initialize: (c: Record<string, unknown>) => {
        fake.api.initialize(c);
      },
      run: async (o: RunOptions): Promise<void> => {
        await fake.api.run(o);
        const node = o.nodes[0];
        if (node !== undefined && (node.textContent ?? '') === '' && fake.nodes.length === 2) away.append(node);
      },
    };
    await enhance(root, drawWith({ default: api }));
    await settledState(root, 'partial');
    expect(figuresOf(root).map((f) => f.classList.contains('drawn'))).toEqual([true, false, true]);
  });

  it('takes the figure\'s width from the drawing\'s viewBox when Mermaid gave it no max-width, and none past 100000 px', async () => {
    const root = mount();
    const fake = fakeMermaid(undefined, (svg, text) => {
      if (text.includes('one')) svg.removeAttribute('style');
      if (text.includes('three')) svg.setAttribute('style', 'max-width: 100000.5px;');
    });
    await enhance(root, drawWith({ default: fake.api }));
    await settledState(root, 'drawn');
    expect(figuresOf(root).map((f) => f.style.getPropertyValue('--fig-w'))).toEqual(['352px', '353px', '']);
  });

  it('a source longer than maxTextSize is never handed to Mermaid: its note says it is too long', async () => {
    const root = mount(['# D', '', fence('flowchart LR\n  one --> A'), fence(`flowchart LR\n  two --> B\n  %% ${'x'.repeat(200)}`)].join('\n'));
    const fake = fakeMermaid();
    await enhance(root, drawWith({ default: fake.api }, 'tagA', { maxTextSize: 100 }));
    await settledState(root, 'partial');
    expect(fake.log).toEqual(['init tagA', 'run one']);
    const [, long] = figuresOf(root) as [HTMLElement, HTMLElement];
    expect(long.classList.contains('draw-failed')).toBe(true);
    expect(drawingOf(long)).toBe(null);
    expect(long.querySelector('.fig-error > p')?.textContent).toBe(NOTES.long);
  });

  it('a source of exactly maxTextSize characters is drawn', async () => {
    const source = 'flowchart LR\n  one --> A';
    const root = mount(['# D', '', fence(source)].join('\n'));
    const fake = fakeMermaid();
    await enhance(root, drawWith({ default: fake.api }, 'tagA', { maxTextSize: (sourceOf(figuresOf(root)[0] as Element).textContent ?? '').length }));
    await settledState(root, 'drawn');
  });

  it('a module that does not load, or is not Mermaid\'s, leaves every figure to its fallback with the load note', async () => {
    const REJECTS = Symbol('rejects');
    const throwing = Object.defineProperty({}, 'default', {
      get() {
        throw new Error('no default');
      },
    });
    for (const mod of [null, 'x', { default: { initialize: () => undefined } }, { run: () => Promise.resolve() }, throwing, REJECTS]) {
      const root = mount();
      const load = (): Promise<unknown> => (mod === REJECTS ? Promise.reject(new Error('gone')) : Promise.resolve(mod));
      await enhance(root, { mermaid: { load } });
      await settledState(root, 'failed');
      expect(figuresOf(root).map((f) => f.className)).toEqual(Array(3).fill('mermaid-figure draw-failed'));
      expect(figuresOf(root).map((f) => f.querySelector('.fig-error > p')?.textContent)).toEqual(Array(3).fill(NOTES.load));
      await destroyEnhancement(root);
    }
  });

  it('a module whose initialize or run throws leaves that figure to its fallback, and the others draw', async () => {
    const root = mount();
    const fake = fakeMermaid();
    let n = 0;
    const api = {
      initialize: (c: Record<string, unknown>) => {
        n += 1;
        if (n === 2) throw new Error('refused');
        fake.api.initialize(c);
      },
      run: (o: RunOptions) => fake.api.run(o),
    };
    await enhance(root, drawWith({ default: api }));
    await settledState(root, 'partial');
    expect(figuresOf(root).map((f) => f.classList.contains('drawn'))).toEqual([true, false, true]);
  });

  it('a destroy during a pass stops it: the call in flight ends, no other is made, nothing is written', async () => {
    const root = mount();
    const before = root.innerHTML;
    const fake = fakeMermaid();
    fake.hold = true;
    await enhance(root, drawWith({ default: fake.api }));
    await vi.waitFor(() => {
      expect(fake.log).toEqual(['init tagA', 'run one']);
    });
    // b and c have queued their first figures behind a's by now.
    await new Promise((r) => setTimeout(r, 60));
    const destroyed = destroyEnhancement(root);
    await destroyed;
    expect(root.innerHTML).toBe(before);
    fake.release();
    await new Promise((r) => setTimeout(r, 80));
    expect(fake.log).toEqual(['init tagA', 'run one']);
    expect(root.innerHTML).toBe(before);
    expect(root.hasAttribute(STATE)).toBe(false);
  });

  it('a destroyed root\'s queued call is never made, and the queue moves on to the next root', async () => {
    const a = mount();
    const b = mount(['# B', '', fence('flowchart LR\n  bee --> X')].join('\n'));
    const c = mount(['# C', '', fence('flowchart LR\n  sea --> X')].join('\n'));
    const fake = fakeMermaid();
    fake.hold = true;
    await enhance(a, drawWith({ default: fake.api }, 'tagA'));
    await enhance(b, drawWith({ default: fake.api }, 'tagB'));
    await enhance(c, drawWith({ default: fake.api }, 'tagC'));
    await vi.waitFor(() => {
      expect(fake.log).toEqual(['init tagA', 'run one']);
    });
    // b and c have queued their first figures behind a's by now.
    await new Promise((r) => setTimeout(r, 60));
    await destroyEnhancement(b);
    fake.hold = false;
    fake.release();
    await settledState(c, 'drawn');
    await settledState(a, 'drawn');
    expect(fake.log.filter((l) => l.endsWith('tagB') || l === 'run bee')).toEqual([]);
    expect(fake.log.slice(0, 4)).toEqual(['init tagA', 'run one', 'init tagC', 'run sea']);
  });

  it('RF5: a load() that resolves after a destroy draws nothing', async () => {
    const root = mount();
    const before = root.innerHTML;
    const fake = fakeMermaid();
    let resolve: (m: unknown) => void = () => undefined;
    await enhance(root, { mermaid: { load: () => new Promise((r) => (resolve = r)) } });
    expect(root.getAttribute(STATE)).toBe('drawing');
    await destroyEnhancement(root);
    resolve({ default: fake.api });
    await new Promise((r) => setTimeout(r, 80));
    expect(fake.log).toEqual([]);
    expect(root.innerHTML).toBe(before);
  });

  it('the feature\'s second phase, run for an instance that is no longer live, asks for nothing and writes nothing', async () => {
    const root = mount();
    const fake = fakeMermaid();
    let calls = 0;
    await enhance(root, {
      mermaid: {
        load: () => {
          calls += 1;
          return Promise.resolve({ default: fake.api });
        },
      },
    });
    await settledState(root, 'drawn');
    const ctx = contextOf(root);
    if (ctx === undefined) throw new Error('no context');
    await destroyEnhancement(root);
    const before = root.innerHTML;
    const log = fake.log.length;
    await Promise.race([afterDiagrams(ctx), new Promise((r) => setTimeout(r, 80))]);
    expect(root.innerHTML).toBe(before);
    expect([calls, fake.log.length]).toEqual([1, log]);
    expect(root.hasAttribute(GATE)).toBe(false);
  });

  it('a document without figures asks for nothing: the host\'s load is never called', async () => {
    const root = mount('# D\n\nNo figures here.\n');
    let calls = 0;
    await enhance(root, {
      mermaid: {
        load: () => {
          calls += 1;
          return Promise.resolve(null);
        },
      },
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBe(0);
    expect(root.hasAttribute(GATE)).toBe(false);
    expect(root.hasAttribute(STATE)).toBe(false);
  });
});

/** Every property name of Mermaid's configuration types, read with TypeScript's parser. */
function schemaKeys(): Set<string> {
  const file = path.join(ROOT, 'node_modules', 'mermaid', 'dist', 'config.type.d.ts');
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true);
  const out = new Set<string>();
  const visit = (n: ts.Node): void => {
    if (ts.isPropertySignature(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name))) out.add(n.name.text);
    ts.forEachChild(n, visit);
  };
  visit(source);
  return out;
}

/** The rule the list follows: a key styles the drawing when its name names a theme, CSS, a style, a font, a colour, a fill, a stroke, the look or dark mode. */
const STYLE_BEARING = /theme|css|style|font|colou?r|fill|stroke|look|darkmode/i;

describe('diagrams: the secure keys, measured against Mermaid 12.1.0\'s configuration schema', () => {
  it('reads the pinned package\'s schema', () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'node_modules', 'mermaid', 'package.json'), 'utf8')) as { version: string };
    expect(pkg.version).toBe('12.1.0');
    expect(schemaKeys().size).toBeGreaterThan(300);
  });

  it('lists every style-bearing key of the schema', () => {
    const listed = new Set(secureKeys());
    const styling = [...schemaKeys()].filter((k) => STYLE_BEARING.test(k)).sort();
    expect(styling.length).toBe(193);
    expect(styling.filter((k) => !listed.has(k))).toEqual([]);
  });

  it('lists nothing else but Mermaid\'s own secure keys', () => {
    const schema = schemaKeys();
    const extra = secureKeys().filter((k) => !(schema.has(k) && STYLE_BEARING.test(k)));
    expect(extra).toEqual(MERMAID_SECURE);
  });

  it('keeps the groups apart: each key in one group, the groups in the list\'s order', () => {
    const groups = secureGroups();
    expect(Object.keys(groups)).toEqual(['mermaid', 'theme', 'styles', 'fonts', 'colours', 'c4']);
    const all = Object.values(groups).flat();
    expect(all).toEqual(secureKeys());
    expect(new Set(all).size).toBe(all.length);
    expect(groups.c4).toHaveLength(120);
  });
});
