// @vitest-environment jsdom
// Diagrams of `./enhance` (docserver L2, Task 21), ported from the reference layout's section 26 (the drawing) and the
// first-paint steps that concern diagrams, with a fake Mermaid: what the feature asks of the module (initialize before
// each drawing, the configuration it passes, one call at a time per module across roots, and each drawing made as
// Mermaid's run() makes it, through render() under a name of the reader's: docserver L3, Task 8, ledger C95(1)), the
// name's prefix that render() can never write into an id, the order it draws in (the
// figures near the viewport first, in document order, then the rest, nearest first), what it writes (the root's gate
// and state, a chrome `pre.mermaid` beside the source, the figure's class, the fallback note, the drawing's name and
// width), what a destroy stops (RF5), Mermaid's tooltip in the body (removed with the last instance that drew while it
// stood), and the module told not to start on load as soon as it is here. The real file in a real browser is
// test/browser/diagrams.test.ts.
//
// The secure keys are measured against Mermaid 12.1.0's own configuration schema, its generated types in the pinned
// package (`mermaid/dist/config.type.d.ts`), read with TypeScript's parser: every key whose name says it styles the
// drawing is listed, and the list holds nothing the schema does not name.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import { dedent as tsDedent } from 'ts-dedent';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  after as afterDiagrams,
  DRAWING_ID_PREFIX,
  FONT_FALLBACK,
  MAX_EDGES,
  MAX_TEXT_SIZE,
  MERMAID_SECURE,
  mermaidText,
  NOTES,
  secureGroups,
  secureKeys,
  THEME_VARIABLES,
} from '../src/enhance/diagrams.js';
import { destroyEnhancement, enhance, type EnhanceOptions } from '../src/enhance/index.js';
import { CHROME_ATTR } from '../src/enhance/journal.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { clip } from '../src/enhance/text.js';
import { ALLOWLIST, render } from '../src/render/index.js';
import { pySlug } from '../src/render/slug.js';

type Parse5Node = DefaultTreeAdapterMap['node'];

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

/** What Mermaid's render() answers: the SVG text, and (for some kinds) the function that binds its handlers. */
interface Rendered {
  readonly svg: string;
  readonly bindFunctions?: (el: Element) => void;
}

interface FakeApi {
  initialize(config: Record<string, unknown>): void;
  render(id: string, text: string, container: Element): Promise<Rendered>;
}

interface Fake {
  readonly api: FakeApi;
  /** Every call, in order: `init <tag>` (the last secure key, which each case's host adds) and `render <first word>`. */
  readonly log: string[];
  readonly configs: Record<string, unknown>[];
  /** The container each render was given. */
  readonly nodes: HTMLElement[];
  /** The id each render was given. */
  readonly ids: string[];
  /** The text each render was given. */
  readonly texts: string[];
  /** Hold every render until release(). */
  hold: boolean;
  /** Finish the oldest held render; false when none is held. */
  release(): boolean;
}

/** The first word of a diagram's second line: the name each fixture gives its first node. */
const wordOf = (text: string): string => /\n\s*(\S+)/.exec(text)?.[1] ?? text;

/**
 * As Mermaid's flowchart drawing does: take the document's first `.mermaidTooltip`, else put a new one in the body, and
 * bind the drawing's node to show it on mouseover (marking the node `hover`) and close it on mouseout.
 */
function mermaidTooltip(svg: SVGSVGElement, text: string): void {
  let tip = document.querySelector<HTMLElement>('.mermaidTooltip');
  if (tip === null) {
    tip = document.createElement('div');
    tip.className = 'mermaidTooltip';
    tip.style.opacity = '0';
    document.body.append(tip);
  }
  const shown = tip;
  const node = document.createElementNS(SVG_NS, 'g');
  node.setAttribute('class', 'node');
  node.addEventListener('mouseover', () => {
    shown.style.opacity = '0.9';
    shown.textContent = `Tip of ${wordOf(text)}`;
    node.classList.add('hover');
  });
  node.addEventListener('mouseout', () => {
    shown.style.opacity = '0';
    node.classList.remove('hover');
  });
  svg.append(node);
}

function fakeMermaid(
  draw: (text: string) => Draw = () => 'svg',
  decorate: (svg: SVGSVGElement, text: string) => void = () => undefined,
  tooltip = false,
): Fake {
  const log: string[] = [];
  const configs: Record<string, unknown>[] = [];
  const nodes: HTMLElement[] = [];
  const ids: string[] = [];
  const texts: string[] = [];
  const held: (() => void)[] = [];
  const fake: Fake = {
    api: {
      initialize(config) {
        configs.push(config);
        const secure = config['secure'];
        log.push(`init ${Array.isArray(secure) ? String(secure[secure.length - 1]) : '?'}`);
      },
      render(id, text, container) {
        const node = container as HTMLElement;
        nodes.push(node);
        ids.push(id);
        texts.push(text);
        log.push(`render ${wordOf(text)}`);
        // As Mermaid's render() does with a container: it empties it, draws there, takes its working nodes out again
        // and answers the drawing's SVG text (or rejects, on an error, leaving the container empty).
        const finish = (): Rendered => {
          node.textContent = '';
          const how = draw(text);
          if (how === 'empty') throw new Error(`Parse error: ${wordOf(text)}`);
          const svg = document.createElementNS(SVG_NS, 'svg');
          svg.setAttribute('id', id);
          svg.setAttribute('viewBox', '0 0 300 120');
          svg.setAttribute('style', 'max-width: 300.4px;');
          if (how === 'error') svg.setAttribute('aria-roledescription', 'error');
          decorate(svg, text);
          // A flowchart's bindFunctions sets up its tooltip, on the node run() inserted the drawing into.
          const bindFunctions = (el: Element): void => {
            const drawn = el.querySelector('svg');
            if (drawn !== null) mermaidTooltip(drawn, text);
          };
          return tooltip ? { svg: svg.outerHTML, bindFunctions } : { svg: svg.outerHTML };
        };
        const settle = (resolve: (r: Rendered) => void, reject: (e: unknown) => void): void => {
          try {
            resolve(finish());
          } catch (e) {
            reject(e);
          }
        };
        if (!fake.hold) return new Promise<Rendered>(settle);
        return new Promise<Rendered>((resolve, reject) => {
          held.push(() => {
            settle(resolve, reject);
          });
        });
      },
    },
    log,
    configs,
    nodes,
    ids,
    texts,
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

/**
 * The calls of a log, each `init` with the `render` it was made for: without the initialize that tells a module not to
 * start on load as soon as it is here (an `init` no `render` follows).
 */
const calls = (log: readonly string[]): string[] => log.filter((l, i) => !l.startsWith('init') || (log[i + 1]?.startsWith('render') ?? false));

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
    expect(fake.log.filter((l) => l.startsWith('render'))).toEqual([]);
    await settledState(root, 'drawn');
    expect(calls).toBe(1);
    expect(fake.log.filter((l) => l.startsWith('render'))).toHaveLength(3);
  });

  it('a module that is the API itself draws as well as one whose default export is the API', async () => {
    const root = mount();
    const fake = fakeMermaid();
    await enhance(root, drawWith(fake.api));
    await settledState(root, 'drawn');
    expect(fake.log.filter((l) => l.startsWith('render'))).toHaveLength(3);
  });

  it('initialises before each drawing, with the reader\'s configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host\'s', async () => {
    const root = mount();
    const fake = fakeMermaid();
    await enhance(root, drawWith({ default: fake.api }, 'extraKey', { secure: ['themeCSS', 'extraKey'] }));
    await settledState(root, 'drawn');
    expect(calls(fake.log)).toEqual(['init extraKey', 'render one', 'init extraKey', 'render two', 'init extraKey', 'render three']);
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
    // Each drawing is given its own node, a chrome pre, under a name of the reader's, never the same twice.
    expect(fake.nodes.every((n) => n.localName === 'pre' && n.hasAttribute(CHROME_ATTR))).toBe(true);
    expect(new Set(fake.ids).size).toBe(3);
    for (const id of fake.ids) expect(id).toMatch(new RegExp(`^${DRAWING_ID_PREFIX}mermaid-\\d+$`));
    // The library's keys, then the host's that are not among them, each once.
    expect(config['secure']).toEqual([...secureKeys(), 'extraKey']);
    // Each call gets its own configuration object: Mermaid keeps what it is given.
    expect(new Set(fake.configs).size).toBe(fake.configs.length);
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
      // The drawing: a chrome pre.mermaid right after the source, the one Mermaid was given, marked as run() marks it;
      // Mermaid was given the source's text as run() prepares it, and the SVG went in under the reader's name.
      const drawing = drawingOf(figure);
      expect(drawing).toBe(fake.nodes[i]);
      expect(drawing?.previousElementSibling).toBe(source);
      expect(drawing?.className).toBe('mermaid');
      expect(drawing?.getAttribute('data-processed')).toBe('true');
      expect(fake.texts[i]).toBe(mermaidText(source.textContent ?? ''));
      const svg = drawing?.querySelector('svg');
      expect(svg?.id).toBe(fake.ids[i]);
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
    expect(fake.log.filter((l) => l.startsWith('render'))).toEqual([]);
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
      render: (id: string, text: string, c: Element): Promise<Rendered> => {
        const word = wordOf(text);
        seen.push([word, ran]);
        // The near figure's drawing asks for a task; the far figure's sees whether that task came first.
        if (word === 'one') setTimeout(() => (ran = true), 0);
        return fake.api.render(id, text, c);
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

  it('a drawing named by its source skips a leading front-matter block whole, not only its fences', async () => {
    const md = ['# D', '', fence('---\ntitle: A titled flow\nconfig:\n  theme: dark\n---\nflowchart LR\n  one --> A')].join('\n');
    const root = mount(md);
    const fake = fakeMermaid();
    await enhance(root, drawWith({ default: fake.api }));
    await settledState(root, 'drawn');
    const labels = figuresOf(root).map((f) => drawingOf(f)?.querySelector('svg')?.getAttribute('aria-label'));
    expect(labels).toEqual(['Figure 1. flowchart LR']);
  });

  it('a drawing named by its source takes at most 80 characters of its first line', async () => {
    const line = `flowchart LR; ${Array.from({ length: 12 }, (_, i) => `n${String(i)} --> n${String(i + 1)};`).join(' ')}`;
    expect(line.length).toBeGreaterThan(120);
    const root = mount(['# D', '', fence(line)].join('\n'));
    const fake = fakeMermaid();
    await enhance(root, drawWith({ default: fake.api }));
    await settledState(root, 'drawn');
    const label = drawingOf(figuresOf(root)[0] as Element)?.querySelector('svg')?.getAttribute('aria-label') ?? '';
    expect(label).toBe(`Figure 1. ${clip(line, 80)}`);
    expect(label.length).toBeLessThanOrEqual('Figure 1. '.length + 80);
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
    expect(fake.log.filter((l) => l.startsWith('render'))).toEqual(['render one', 'render two', 'render four', 'render three', 'render five']);
  });

  it('serialises the calls per Mermaid module across roots: one root\'s drawing ends before the next initialize', async () => {
    const a = mount();
    const b = mount(['# B', '', fence('flowchart LR\n  bee --> X')].join('\n'));
    const fake = fakeMermaid();
    fake.hold = true;
    await enhance(a, drawWith({ default: fake.api }, 'tagA'));
    await enhance(b, drawWith({ default: fake.api }, 'tagB'));
    await vi.waitFor(() => {
      expect(calls(fake.log)).toEqual(['init tagA', 'render one']);
    });
    // b has queued its first figure behind a's by now: nothing of b runs while a's call is open.
    await new Promise((r) => setTimeout(r, 60));
    expect(calls(fake.log)).toEqual(['init tagA', 'render one']);
    expect(fake.release()).toBe(true);
    await vi.waitFor(() => {
      expect(calls(fake.log)).toEqual(['init tagA', 'render one', 'init tagB', 'render bee']);
    });
    // a's second figure was queued behind b's: one call at a time, in the order they were asked for.
    fake.hold = false;
    expect(fake.release()).toBe(true);
    await settledState(a, 'drawn');
    await settledState(b, 'drawn');
    expect(calls(fake.log)).toEqual(['init tagA', 'render one', 'init tagB', 'render bee', 'init tagA', 'render two', 'init tagA', 'render three']);
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
    expect(calls(free.log)).toEqual(['init tagB', 'render bee']);
    expect(calls(held.log)).toEqual(['init tagA', 'render one']);
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
      render: async (id: string, text: string, c: Element): Promise<Rendered> => {
        const out = await fake.api.render(id, text, c);
        // The second figure's drawing node leaves its figure while Mermaid draws, before the SVG goes in.
        if (fake.nodes.length === 2) away.append(c);
        return out;
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
    expect(calls(fake.log)).toEqual(['init tagA', 'render one']);
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
    // A module with Mermaid's initialize and run but no render is not Mermaid's either: the reader draws through render.
    const runOnly = { initialize: () => undefined, run: () => Promise.resolve() };
    for (const mod of [null, 'x', { default: { initialize: () => undefined } }, { run: () => Promise.resolve() }, runOnly, { default: runOnly }, throwing, REJECTS]) {
      const root = mount();
      const load = (): Promise<unknown> => (mod === REJECTS ? Promise.reject(new Error('gone')) : Promise.resolve(mod));
      await enhance(root, { mermaid: { load } });
      await settledState(root, 'failed');
      expect(figuresOf(root).map((f) => f.className)).toEqual(Array(3).fill('mermaid-figure draw-failed'));
      expect(figuresOf(root).map((f) => f.querySelector('.fig-error > p')?.textContent)).toEqual(Array(3).fill(NOTES.load));
      await destroyEnhancement(root);
    }
  });

  it('a module whose initialize throws leaves that figure to its fallback, and the others draw', async () => {
    const root = mount();
    const fake = fakeMermaid();
    let n = 0;
    const api = {
      initialize: (c: Record<string, unknown>) => {
        n += 1;
        // The first is the one made as the module arrives; the third is the second figure's.
        if (n === 3) throw new Error('refused');
        fake.api.initialize(c);
      },
      render: (id: string, text: string, c: Element) => fake.api.render(id, text, c),
    };
    await enhance(root, drawWith({ default: api }));
    await settledState(root, 'partial');
    expect(figuresOf(root).map((f) => f.classList.contains('drawn'))).toEqual([true, false, true]);
  });

  it('a source the host moved out of its figure: the note or the drawing goes first in the figure, and the pass goes on', async () => {
    const root = mount();
    const fake = fakeMermaid((text) => (text.includes('one') ? 'empty' : 'svg'));
    let resolve: (m: unknown) => void = () => undefined;
    await enhance(root, { mermaid: { load: () => new Promise((r) => (resolve = r)), secure: ['tagA'] } });
    const [one, two] = figuresOf(root) as [HTMLElement, HTMLElement, HTMLElement];
    // Each source now sits before a node that is not in its figure.
    const away = document.createElement('div');
    root.append(away);
    away.append(sourceOf(one), sourceOf(two), document.createElement('span'));
    resolve({ default: fake.api });
    await settledState(root, 'partial');
    expect(figuresOf(root).map((f) => f.className)).toEqual(['mermaid-figure draw-failed', 'mermaid-figure drawn', 'mermaid-figure drawn']);
    expect(one.firstElementChild?.classList.contains('fig-error')).toBe(true);
    expect(one.querySelector('.fig-error > p')?.textContent).toBe(NOTES.error);
    expect(two.firstElementChild).toBe(drawingOf(two));
    expect(drawingOf(two)?.querySelector('svg')?.getAttribute('role')).toBe('img');
  });

  it('an initialize that destroys the instance: the drawing it was made for is never asked for', async () => {
    const root = mount();
    const before = root.innerHTML;
    const fake = fakeMermaid();
    let n = 0;
    const api = {
      initialize: (c: Record<string, unknown>) => {
        n += 1;
        fake.api.initialize(c);
        // The first is the one made as the module arrives; the second is the first figure's.
        if (n === 2) void destroyEnhancement(root);
      },
      render: (id: string, text: string, c: Element) => fake.api.render(id, text, c),
    };
    await enhance(root, drawWith({ default: api }));
    await vi.waitFor(() => {
      expect(n).toBe(2);
    });
    await new Promise((r) => setTimeout(r, 80));
    expect(fake.log.filter((l) => l.startsWith('render'))).toEqual([]);
    expect(root.innerHTML).toBe(before);
    expect(root.hasAttribute(STATE)).toBe(false);
  });

  it('tells the module not to start on load as soon as it is here, before the fonts wait ends', async () => {
    // A font set whose faces never load: the wait runs to its bound, 1.5 s.
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { load: () => new Promise(() => undefined), addEventListener: () => undefined, removeEventListener: () => undefined },
    });
    try {
      const root = mount();
      const fake = fakeMermaid();
      await enhance(root, drawWith({ default: fake.api }));
      await vi.waitFor(() => {
        expect(fake.log).toEqual(['init tagA']);
      });
      expect(fake.configs[0]).toMatchObject({ startOnLoad: false, securityLevel: 'strict', layout: 'dagre' });
      // The drawing still waits for the faces.
      await new Promise((r) => setTimeout(r, 300));
      expect(fake.log).toEqual(['init tagA']);
      await vi.waitFor(
        () => {
          expect(root.getAttribute(STATE)).toBe('drawn');
        },
        { timeout: 4000 },
      );
    } finally {
      Reflect.deleteProperty(document, 'fonts');
    }
  });

  it('an initialize that throws as the module arrives: every figure still draws', async () => {
    const root = mount();
    const fake = fakeMermaid();
    let n = 0;
    const api = {
      initialize: (c: Record<string, unknown>) => {
        n += 1;
        if (n === 1) throw new Error('refused');
        fake.api.initialize(c);
      },
      render: (id: string, text: string, c: Element) => fake.api.render(id, text, c),
    };
    await enhance(root, drawWith({ default: api }));
    await settledState(root, 'drawn');
    expect(calls(fake.log)).toEqual(['init tagA', 'render one', 'init tagA', 'render two', 'init tagA', 'render three']);
  });

  it('the initialize made as a module arrives, queued behind another root\'s call, is never made once its instance is destroyed', async () => {
    const a = mount();
    const fake = fakeMermaid();
    fake.hold = true;
    await enhance(a, drawWith({ default: fake.api }, 'tagA'));
    await vi.waitFor(() => {
      expect(calls(fake.log)).toEqual(['init tagA', 'render one']);
    });
    // b's module arrives while a's call is open: its initialize waits behind it.
    const b = mount(['# B', '', fence('flowchart LR\n  bee --> X')].join('\n'));
    await enhance(b, drawWith({ default: fake.api }, 'tagB'));
    await new Promise((r) => setTimeout(r, 60));
    await destroyEnhancement(b);
    fake.hold = false;
    fake.release();
    await settledState(a, 'drawn');
    expect(fake.log.filter((l) => l.endsWith('tagB'))).toEqual([]);
  });

  it('a destroy during a pass stops it: the call in flight ends, no other is made, nothing is written', async () => {
    const root = mount();
    const before = root.innerHTML;
    const fake = fakeMermaid();
    fake.hold = true;
    await enhance(root, drawWith({ default: fake.api }));
    await vi.waitFor(() => {
      expect(calls(fake.log)).toEqual(['init tagA', 'render one']);
    });
    // The pass waits on the first figure's call by now.
    await new Promise((r) => setTimeout(r, 60));
    const destroyed = destroyEnhancement(root);
    await destroyed;
    expect(root.innerHTML).toBe(before);
    fake.release();
    await new Promise((r) => setTimeout(r, 80));
    expect(calls(fake.log)).toEqual(['init tagA', 'render one']);
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
      expect(calls(fake.log)).toEqual(['init tagA', 'render one']);
    });
    // b and c have queued their first figures behind a's by now.
    await new Promise((r) => setTimeout(r, 60));
    await destroyEnhancement(b);
    fake.hold = false;
    fake.release();
    await settledState(c, 'drawn');
    await settledState(a, 'drawn');
    expect(calls(fake.log).filter((l) => l.endsWith('tagB') || l === 'render bee')).toEqual([]);
    expect(calls(fake.log).slice(0, 4)).toEqual(['init tagA', 'render one', 'init tagC', 'render sea']);
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

const tooltips = (): HTMLElement[] => Array.from(document.querySelectorAll('.mermaidTooltip'));

describe('diagrams: Mermaid\'s tooltip, which its drawings put in the body, outside every root', () => {
  it('goes with the last instance that drew while it stood: the body is as it was', async () => {
    const a = mount();
    const b = mount(['# B', '', fence('flowchart LR\n  bee --> X')].join('\n'));
    const body = Array.from(document.body.childNodes);
    const fake = fakeMermaid(undefined, undefined, true);
    await enhance(a, drawWith({ default: fake.api }, 'tagA'));
    await enhance(b, drawWith({ default: fake.api }, 'tagB'));
    await settledState(a, 'drawn');
    await settledState(b, 'drawn');
    const [tip] = tooltips();
    expect(tooltips()).toHaveLength(1);
    expect(tip?.parentNode).toBe(document.body);
    await destroyEnhancement(a);
    // b still draws with it.
    expect(tip?.isConnected).toBe(true);
    await destroyEnhancement(b);
    expect(tip?.isConnected).toBe(false);
    expect(Array.from(document.body.childNodes)).toEqual(body);
  });

  it('one shown over a node of a root that goes, while another root still draws with it, is closed by Mermaid\'s own mouseout', async () => {
    const a = mount();
    const b = mount(['# B', '', fence('flowchart LR\n  bee --> X')].join('\n'));
    const fake = fakeMermaid(undefined, undefined, true);
    await enhance(a, drawWith({ default: fake.api }, 'tagA'));
    await enhance(b, drawWith({ default: fake.api }, 'tagB'));
    await settledState(a, 'drawn');
    await settledState(b, 'drawn');
    const tip = tooltips()[0] as HTMLElement;
    // The pointer is over a's third figure's node: Mermaid shows the tooltip there.
    a.querySelectorAll('figure g.node')[2]?.dispatchEvent(new Event('mouseover'));
    expect([tip.style.opacity, tip.textContent]).toEqual(['0.9', 'Tip of three']);
    await destroyEnhancement(a);
    expect(tip.isConnected).toBe(true);
    expect(tip.style.opacity).toBe('0');
    // Shown over b's node, it is b's: a root that goes leaves it alone.
    b.querySelector('figure g.node')?.dispatchEvent(new Event('mouseover'));
    const c = mount(['# C', '', fence('flowchart LR\n  sea --> X')].join('\n'));
    await enhance(c, drawWith({ default: fake.api }, 'tagC'));
    await settledState(c, 'drawn');
    await destroyEnhancement(c);
    expect([tip.isConnected, tip.style.opacity, tip.textContent]).toEqual([true, '0.9', 'Tip of bee']);
  });

  it('one the page already had is never removed nor changed', async () => {
    const own = document.createElement('div');
    own.className = 'mermaidTooltip';
    own.style.opacity = '0.9';
    own.textContent = 'the page\'s own';
    document.body.append(own);
    const html = own.outerHTML;
    const root = mount();
    const fake = fakeMermaid(undefined, undefined, true);
    await enhance(root, drawWith({ default: fake.api }));
    await settledState(root, 'drawn');
    expect(tooltips()).toEqual([own]);
    await destroyEnhancement(root);
    expect(tooltips()).toEqual([own]);
    expect(own.outerHTML).toBe(html);
  });

  it('one a call made after its instance was destroyed goes at once', async () => {
    const root = mount();
    const body = Array.from(document.body.childNodes);
    const fake = fakeMermaid(undefined, undefined, true);
    fake.hold = true;
    await enhance(root, drawWith({ default: fake.api }));
    await vi.waitFor(() => {
      expect(calls(fake.log)).toEqual(['init tagA', 'render one']);
    });
    await destroyEnhancement(root);
    expect(fake.release()).toBe(true);
    await new Promise((r) => setTimeout(r, 80));
    expect(tooltips()).toEqual([]);
    expect(Array.from(document.body.childNodes)).toEqual(body);
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

/** Every `.md` under conformance/corpus (the golden and the hostile documents), by path. */
function corpusMarkdown(dir = path.join(ROOT, 'conformance', 'corpus')): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? corpusMarkdown(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : [],
  );
}

/** Every id attribute in an html fragment, read by an HTML parser. */
function idsIn(html: string): string[] {
  const out: string[] = [];
  const visit = (n: Parse5Node): void => {
    if ('attrs' in n) for (const a of n.attrs) if (a.name === 'id') out.push(a.value);
    if ('childNodes' in n) for (const c of n.childNodes) visit(c);
    if ('content' in n) visit(n.content);
  };
  visit(parseFragment(html));
  return out;
}

/**
 * Mermaid 12.1.0's utils.entityDecode (dist/chunks/mermaid.core/chunk-3YJQHVM4.mjs), copied: the test's own copy, with
 * the innerHTML the library's code never names.
 */
function entityDecode(html: string): string {
  const decoder = document.createElement('div');
  decoder.innerHTML = escape(html).replace(/%26/g, '&').replace(/%23/g, '#').replace(/%3B/g, ';');
  return unescape(decoder.textContent);
}

/** What Mermaid 12.1.0's run() hands render() for a node holding `text` (mermaid.core.mjs, runThrowsErrors). */
function runText(text: string): string {
  const node = document.createElement('pre');
  node.textContent = text;
  return tsDedent(entityDecode(node.innerHTML))
    .trim()
    .replace(/<br\s*\/?>/gi, '<br/>');
}

describe("diagrams: the drawing's name and how it is drawn (docserver L3, Task 8; ledger C95(1))", () => {
  /** The code point the prefix holds that render() never writes into an id. */
  const DOT = '·';

  it('the prefix is `docreader` and U+00B7 MIDDLE DOT, a punctuation code point, outside the anchor grammar and the slug alphabet', () => {
    expect(DRAWING_ID_PREFIX).toBe(`docreader${DOT}`);
    expect([...DRAWING_ID_PREFIX].filter((c) => !/^[A-Za-z0-9_-]$/.test(c))).toEqual([DOT]);
    expect(/^\p{Po}$/u.test(DOT)).toBe(true);
    expect(new RegExp(`^${ALLOWLIST.anchorId}$`).test(`a${DOT}b`)).toBe(false);
    // The slug keeps letters, numbers, `_`, `-` and CJK ideographs, of any title, whatever lower-casing makes of it:
    // over every code point but the surrogates, none comes out as the dot.
    let all = '';
    for (let cp = 0; cp <= 0x10ffff; cp++) if (cp < 0xd800 || cp > 0xdfff) all += String.fromCodePoint(cp);
    const slug = pySlug(all);
    expect(slug.length).toBeGreaterThan(100_000);
    expect(slug.includes(DOT)).toBe(false);
    expect(pySlug(`${DOT}a${DOT}`)).toBe('a');
  });

  it("render() writes the dot into no id: not by a heading, an anchor, a footnote or raw HTML, nor in any corpus document", () => {
    const crafted = [
      `# docreader${DOT}mermaid-0`,
      '',
      `## ${DOT}`,
      '',
      `### Mid${DOT}dot ${DOT}${DOT} and ${DOT}x`,
      '',
      `<!-- id:docreader${DOT}mermaid-0 -->`,
      '',
      `<!-- id:a${DOT}b -->`,
      '',
      '<!-- id:docreader-mermaid-0 -->',
      '',
      `<span id="docreader${DOT}mermaid-0">raw</span>`,
      '',
      `A note.[^a${DOT}b] Another.[^${DOT}]`,
      '',
      `[^a${DOT}b]: The note.`,
      `[^${DOT}]: The other.`,
      '',
      '```mermaid',
      `flowchart LR`,
      `  A["docreader${DOT}mermaid-0"] --> B`,
      '```',
      '',
    ].join('\n');
    const docs = [{ name: 'crafted', md: crafted }, ...corpusMarkdown().map((f) => ({ name: path.relative(ROOT, f), md: readFileSync(f, 'utf8') }))];
    expect(docs.length).toBeGreaterThan(50);
    let ids = 0;
    for (const d of docs) {
      const r = render(d.md);
      if (r.outcome !== 'rendered') continue;
      const found = idsIn(r.html);
      ids += found.length;
      expect(found.filter((id) => id.includes(DOT)), d.name).toEqual([]);
      expect(r.meta.headings.filter((h) => h.id.includes(DOT)), d.name).toEqual([]);
    }
    // The crafted document's own ids are there, without the dot: the heading's slug and the anchors the grammar admits.
    const own = idsIn((render(crafted) as { html: string }).html);
    expect(own).toEqual(expect.arrayContaining(['docreadermermaid-0', 'docreader-mermaid-0']));
    expect(ids).toBeGreaterThan(100);
  });

  it("hands render() the source's text exactly as Mermaid's run() does: innerHTML, entities decoded, dedent, trim, <br/>", () => {
    const texts = [
      'flowchart LR\n  A --> B\n',
      '    flowchart LR\n      A --> B\n    ',
      '\n\n  sequenceDiagram\n    A->>B: hi &amp; bye <br> x <BR /> y <br/>\n\t\n',
      'flowchart LR\n  A["a &lt;b&gt; &#35; &amp;amp; %41 %u00e9 %"] --> B[" nbsp "]',
      'graph TD\n\tA --> B\n\t\tB --> C\r\n\tC --> D\r\n',
      'flowchart LR\n  A["é中😀 \ud800 lone"] --> B',
      '%%{init: {"theme": "dark"}}%%\n  flowchart LR\n  A --> B',
      '',
      '   ',
      'one line',
      'a\n b\n  c\n   d',
      `docreader${DOT}mermaid-0 ; # & < >`,
    ];
    for (const t of texts) expect(mermaidText(t), JSON.stringify(t)).toBe(runText(t));
  });

  /** A Mermaid module whose render answers `answer` for every figure, recording what it was given. */
  const answering = (answer: (id: string) => unknown) => {
    const given: { id: string; container: Element }[] = [];
    const api = {
      initialize: (): void => undefined,
      render: (id: string, _text: string, container: Element): Promise<unknown> => {
        given.push({ id, container });
        container.textContent = '';
        return Promise.resolve(answer(id));
      },
    };
    return { api, given };
  };

  it("puts the answered SVG text in the drawing as run()'s innerHTML would, and calls bindFunctions once with the drawing after", async () => {
    const svgOf = (id: string): string =>
      [
        `<svg id="${id}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" style="max-width: 200px;" role="graphics-document document">`,
        `<style>#${id} .node rect{fill:#f3f0e9;}</style>`,
        `<defs><marker id="${id}_flowchart-pointEnd"><path d="M 0 0 L 10 5 z"></path></marker></defs>`,
        `<g class="node" id="${id}-flowchart-A-0"><rect></rect>`,
        '<foreignObject width="40" height="20"><div xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel"><p>A &amp; B<br>c</p></span></div></foreignObject></g>',
        `<path marker-end="url(#${id}_flowchart-pointEnd)"></path>`,
        '</svg>',
      ].join('');
    const bound: { el: Element; held: string }[] = [];
    const { api, given } = answering((id) => ({
      svg: svgOf(id),
      bindFunctions: (el: Element) => {
        bound.push({ el, held: el.querySelector('svg')?.id ?? '' });
      },
    }));
    const root = mount();
    await enhance(root, drawWith({ default: api }));
    await settledState(root, 'drawn');
    expect(given).toHaveLength(3);
    for (const [i, figure] of figuresOf(root).entries()) {
      const drawing = drawingOf(figure);
      const g = given[i];
      if (drawing === null || g === undefined) throw new Error('no drawing');
      expect(g.container).toBe(drawing);
      // run() writes `element.innerHTML = svg`: the same text through innerHTML here, in the test, is the reference.
      const reference = document.createElement('pre');
      reference.innerHTML = svgOf(g.id);
      const svg = drawing.querySelector('svg');
      // The reader names the drawing (role, aria-label) after it goes in: compared without those two.
      svg?.removeAttribute('aria-label');
      svg?.setAttribute('role', 'graphics-document document');
      expect(drawing.innerHTML).toBe(reference.innerHTML);
      expect(drawing.querySelector('foreignObject div')?.namespaceURI).toBe('http://www.w3.org/1999/xhtml');
      expect(svg?.namespaceURI).toBe(SVG_NS);
      expect(bound[i]).toEqual({ el: drawing, held: g.id });
    }
    expect(bound).toHaveLength(3);
  });

  it('a throw of bindFunctions is kept from the page, as run() keeps it: the drawing stays and the figure is drawn', async () => {
    const { api } = answering((id) => ({
      svg: `<svg id="${id}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"></svg>`,
      bindFunctions: () => {
        throw new Error('bind');
      },
    }));
    const root = mount();
    await enhance(root, drawWith({ default: api }));
    await settledState(root, 'drawn');
    expect(figuresOf(root).map((f) => f.classList.contains('drawn'))).toEqual([true, true, true]);
  });

  it('an answer that holds no SVG text leaves its figure to its fallback, with the error note', async () => {
    let n = 0;
    const { api } = answering((id) => {
      n += 1;
      return n === 1 ? { svg: 42 } : n === 2 ? null : { svg: `<svg id="${id}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"></svg>` };
    });
    const root = mount();
    await enhance(root, drawWith({ default: api }));
    await settledState(root, 'partial');
    expect(figuresOf(root).map((f) => f.className)).toEqual(['mermaid-figure draw-failed', 'mermaid-figure draw-failed', 'mermaid-figure drawn']);
    expect(figuresOf(root)[0]?.querySelector('.fig-error > p')?.textContent).toBe(NOTES.error);
  });

  it('each drawing gets a name no drawing of this copy had before, across roots', async () => {
    const { api, given } = answering((id) => ({ svg: `<svg id="${id}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"></svg>` }));
    const a = mount();
    const b = mount();
    await enhance(a, drawWith({ default: api }, 'tagA'));
    await enhance(b, drawWith({ default: api }, 'tagB'));
    await settledState(a, 'drawn');
    await settledState(b, 'drawn');
    const ids = given.map((g) => g.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    const numbers = ids.map((id) => Number(id.slice(`${DRAWING_ID_PREFIX}mermaid-`.length)));
    for (const [i, id] of ids.entries()) expect(id).toBe(`${DRAWING_ID_PREFIX}mermaid-${String(numbers[i])}`);
  });
});
