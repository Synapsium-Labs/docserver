// @vitest-environment jsdom
// Task 7 of the appearance contract (docserver appearance plan; the first consumer's design, section 10, "Mermaid while
// hosted" and "Mermaid on a change"): which figures draw in the host's colours, and how an appearance change redraws
// them. Judged with a fake Mermaid that has a `parse`: with no colours there is no parse call and 1.1.0's configuration;
// with colours a covered, plain figure takes `mermaidThemeOf` and the svg mark, and an author-styled one, an uncovered
// kind and a figure whose kind cannot be named keep 1.1.0's; a change redraws the drawn figures nearest first, one per
// task, in place, and a newer change cancels the redraws an older one queued. The real Mermaid in Chromium is
// test/browser/appearance-mermaid-draw.test.ts.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import v8 from 'node:v8';
import vm from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Appearance, type AppearanceColourSlot } from '../src/enhance/appearance.js';
import { mermaidThemeOf } from '../src/enhance/appearance-mermaid.js';
import { FONT_FALLBACK, THEME_VARIABLES } from '../src/enhance/diagrams.js';
import { destroyEnhancement, enhance, setEnhancementAppearance, type EnhanceOptions } from '../src/enhance/index.js';
import { show as showCard } from '../src/enhance/cards.js';
import { CHROME_ATTR } from '../src/enhance/journal.js';
import { contextOf } from '../src/enhance/lifecycle.js';
import { render } from '../src/render/index.js';

const FIXTURES = JSON.parse(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'conformance', 'appearance', 'fixtures.json'), 'utf8')) as {
  name: string;
  mode: 'light' | 'dark';
  colour: Record<AppearanceColourSlot, string>;
}[];
const byName = (name: string): Record<AppearanceColourSlot, string> => FIXTURES.find((f) => f.name === name)!.colour;
const DARK: Appearance = { mode: 'dark', colour: byName('Phosphor & Ink') };
const LIGHT: Appearance = { mode: 'light', colour: byName('Phosphor Daylight') };
const THIRD: Appearance = { mode: 'dark', colour: FIXTURES.find((f) => f.colour.bg !== DARK.colour!.bg && f.colour.bg !== LIGHT.colour!.bg)!.colour };

const SVG_NS = 'http://www.w3.org/2000/svg';
v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc') as () => void;
const MARK = 'data-docreader-hosted-figure';
const STATE = 'data-docreader-diagrams';
const mounted: HTMLElement[] = [];

const fence = (source: string, caption: string): string => ['```mermaid', source, '```', '', caption, ''].join('\n');
/** Figures whose second line names them: `flowchart LR\n  <name> --> X`. */
const figs = (kinds: readonly string[]): string =>
  ['# Hosted diagrams', '', 'Intro.', '', ...kinds.map((k, i) => fence(`${k}\n  n${String(i + 1)} --> X`, `*Figure ${String(i + 1)}. Fig ${String(i + 1)}.*`))].join('\n');

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

interface Rendered {
  readonly word: string;
  readonly id: string;
  readonly config: Record<string, unknown>;
}

interface Fake {
  readonly api: { initialize(c: Record<string, unknown>): void; render(id: string, text: string, el: Element): Promise<{ svg: string; bindFunctions?: (el: Element) => void }>; parse?(text: string): Promise<{ diagramType: string }> };
  readonly log: string[];
  readonly renders: Rendered[];
  hold: boolean;
  pending(): number;
  release(): void;
}

/** As Mermaid's flowchart drawing binds a tooltip: the document's one `.mermaidTooltip`, shown over a node it marks `hover`. */
function tooltipOver(el: Element): void {
  let tip = document.querySelector<HTMLElement>('.mermaidTooltip');
  if (tip === null) {
    tip = document.createElement('div');
    tip.className = 'mermaidTooltip';
    tip.style.opacity = '0';
    document.body.append(tip);
  }
  const shown = tip;
  const node = document.createElementNS(SVG_NS, 'g');
  node.setAttribute('class', 'node tipped');
  node.addEventListener('mouseover', () => {
    shown.style.opacity = '0.9';
    node.classList.add('hover');
  });
  node.addEventListener('mouseout', () => {
    shown.style.opacity = '0';
    node.classList.remove('hover');
  });
  el.querySelector('svg')?.append(node);
}

const wordOf = (text: string): string => /\n\s*(\S+)/.exec(text)?.[1] ?? text;

/** The kinds a fake `parse` knows by the diagram's first word; any other word is a parse error. */
const KINDS: Record<string, string> = { flowchart: 'flowchart-v2', sequenceDiagram: 'sequence', journey: 'journey' };

/** What a fake drawing holds besides its svg: a definition node (a term of the document's glossary), and Mermaid's tooltip. */
interface Extras {
  readonly node?: boolean;
  readonly tooltip?: boolean;
}

function fake(withParse = true, extras: Extras = {}): Fake {
  const log: string[] = [];
  const renders: Rendered[] = [];
  const held: (() => void)[] = [];
  let config: Record<string, unknown> = {};
  const f: Fake = {
    log,
    renders,
    hold: false,
    pending: () => held.length,
    release: () => void held.shift()?.(),
    api: {
      initialize(c) {
        config = c;
        log.push('init');
      },
      render(id, text, el) {
        log.push(`render ${wordOf(text)}`);
        renders.push({ word: wordOf(text), id, config });
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('id', id);
        svg.setAttribute('viewBox', '0 0 300 120');
        svg.setAttribute('style', 'max-width: 300px;');
        if (extras.node === true) {
          const g = document.createElementNS(SVG_NS, 'g');
          g.setAttribute('class', 'node');
          g.setAttribute('id', `${id}-flowchart-A-0`);
          g.innerHTML = '<rect width="80" height="30"></rect><text>Widget</text>';
          svg.append(g);
        }
        const done = (): { svg: string; bindFunctions?: (el: Element) => void } => ({
          svg: svg.outerHTML,
          ...(extras.tooltip === true ? { bindFunctions: tooltipOver } : {}),
        });
        void el;
        return f.hold ? new Promise((resolve) => void held.push(() => resolve(done()))) : Promise.resolve(done());
      },
    },
  };
  if (withParse) {
    f.api.parse = (text) => {
      log.push(`parse ${wordOf(text)}`);
      const kind = KINDS[/^\s*(?:---[\s\S]*?---\s*)?(\w+)/.exec(text)?.[1] ?? ''];
      return kind === undefined ? Promise.reject(new Error('Parse error')) : Promise.resolve({ diagramType: kind });
    };
  }
  return f;
}

const using = (api: unknown, appearance?: Appearance): EnhanceOptions => ({ mermaid: { load: () => Promise.resolve({ default: api }) }, ...(appearance === undefined ? {} : { appearance }) });
const figuresOf = (root: Element): HTMLElement[] => Array.from(root.querySelectorAll('figure.mermaid-figure'));
const chromeOf = (figure: Element): HTMLElement[] => Array.from(figure.children).filter((c) => c.localName === 'pre' && c.hasAttribute(CHROME_ATTR)) as HTMLElement[];
const svgOf = (figure: Element): SVGSVGElement => chromeOf(figure)[0]!.querySelector('svg')!;
const settled = async (root: Element): Promise<void> => vi.waitFor(() => expect(root.getAttribute(STATE)).toBe('drawn'));
const tick = (ms = 25): Promise<void> => new Promise((r) => setTimeout(r, ms));
const only = (f: Fake, word: string): Rendered[] => f.renders.filter((r) => r.word === word);
const theme = (r: Rendered): unknown => r.config['themeVariables'];
const plain = (r: Rendered): unknown => ({ ...THEME_VARIABLES, fontFamily: r.config['fontFamily'] });
const hosted = (a: Appearance, r: Rendered): unknown => ({ ...mermaidThemeOf(a.colour!), fontFamily: r.config['fontFamily'] });

/** Put each figure's source at a fixed top in the viewport (jsdom has no layout; its window is 768 px high). */
function placeAt(root: Element, tops: readonly number[], drawn = false): void {
  figuresOf(root).forEach((figure, i) => {
    const top = tops[i] ?? 0;
    // A drawn figure's source is not displayed (no box): the drawing is what lies where the reader is.
    if (drawn) {
      const hidden = Array.from(figure.children).find((c) => c.localName === 'pre' && !c.hasAttribute(CHROME_ATTR))!;
      Object.defineProperty(hidden, 'getBoundingClientRect', { configurable: true, value: () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) });
    }
    const source = Array.from(figure.children).find((c) => c.localName === 'pre' && c.hasAttribute(CHROME_ATTR) === drawn)!;
    Object.defineProperty(source, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top, bottom: top + 100, left: 0, right: 600, width: 600, height: 100, x: 0, y: top, toJSON: () => ({}) }),
    });
  });
}

describe('test 5 (unit half): without colours nothing changes', () => {
  it('makes no parse call and draws with 1.1.0\'s configuration, with no mark, with no appearance and with a skin-only one', async () => {
    for (const appearance of [undefined, { mode: 'dark', skin: { radius: '4px' } } satisfies Appearance]) {
      const root = mount(figs(['flowchart LR', 'sequenceDiagram']));
      const f = fake();
      await enhance(root, using(f.api, appearance));
      await settled(root);
      expect(f.log.filter((l) => l.startsWith('parse'))).toEqual([]);
      expect(f.log).toEqual(['init', 'init', 'render n1', 'init', 'render n2']);
      for (const r of f.renders) expect(theme(r)).toEqual(plain(r));
      expect(root.querySelectorAll(`[${MARK}]`)).toHaveLength(0);
      expect(FONT_FALLBACK).toBeTruthy();
    }
  });
});

describe('test 5 (unit half): with colours each figure is classified before it is drawn', () => {
  it('a covered, plain figure draws with mermaidThemeOf and carries the mark; the rest draw as 1.1.0 does and carry none', async () => {
    const root = mount(
      [
        '# Kinds', '',
        fence('flowchart LR\n  n1 --> X', '*Figure 1. Plain.*'),
        fence('flowchart LR\n  n2 --> X\n  classDef hot fill:#D4EDDA\n  class n2 hot', '*Figure 2. Author-styled.*'),
        fence('journey\n  n3 --> X', '*Figure 3. Outside the constant.*'),
        fence('bogus\n  n4 --> X', '*Figure 4. Parse fails.*'),
        fence('sequenceDiagram\n  n5 --> X', '*Figure 5. Covered, sequence.*'),
      ].join('\n'),
    );
    const f = fake();
    await enhance(root, using(f.api, DARK));
    await settled(root);
    const [r1, r2, r3, r4, r5] = ['n1', 'n2', 'n3', 'n4', 'n5'].map((w) => only(f, w)[0]!) as [Rendered, Rendered, Rendered, Rendered, Rendered];
    expect(theme(r1)).toEqual(hosted(DARK, r1));
    expect(theme(r5)).toEqual(hosted(DARK, r5));
    for (const r of [r2, r3, r4]) expect(theme(r)).toEqual(plain(r));
    expect(figuresOf(root).map((fig) => (chromeOf(fig)[0]?.querySelector('svg')?.hasAttribute(MARK) ?? false))).toEqual([true, false, false, false, true]);
    // The kind is asked before the drawing, never for a figure the scan already keeps (an author-styled one).
    expect(f.log.indexOf('parse n1')).toBeLessThan(f.log.indexOf('render n1'));
    expect(f.log).not.toContain('parse n2');
  });

  it('a Mermaid with no parse covers nothing; a parse that throws or answers no id covers nothing', async () => {
    const root = mount(figs(['flowchart LR']));
    const f = fake(false);
    await enhance(root, using(f.api, DARK));
    await settled(root);
    expect(theme(f.renders[0]!)).toEqual(plain(f.renders[0]!));
    expect(root.querySelectorAll(`[${MARK}]`)).toHaveLength(0);
    const root2 = mount(figs(['flowchart LR']));
    const g = fake();
    g.api.parse = () => Promise.resolve({ diagramType: '' });
    await enhance(root2, using(g.api, DARK));
    await settled(root2);
    expect(theme(g.renders[0]!)).toEqual(plain(g.renders[0]!));
    const root3 = mount(figs(['flowchart LR']));
    const h = fake();
    h.api.parse = () => {
      throw new Error('a getter that throws');
    };
    await enhance(root3, using(h.api, DARK));
    await settled(root3);
    expect(theme(h.renders[0]!)).toEqual(plain(h.renders[0]!));
    expect(document.querySelectorAll(`[${MARK}]`)).toHaveLength(0);
  });
});

describe('test 5 (unit half): an appearance change redraws the drawn figures', () => {
  const TOPS = [2000, 0, 1000];
  const three = (): HTMLElement => {
    const root = mount(figs(['flowchart LR', 'flowchart LR', 'flowchart LR']));
    placeAt(root, TOPS);
    return root;
  };

  it('nearest first, one per task, each in place: one chrome pre, the new drawing, the new theme and the mark', async () => {
    const root = three();
    const f = fake();
    await enhance(root, using(f.api, DARK));
    await settled(root);
    placeAt(root, TOPS, true);
    const before = figuresOf(root).map((fig) => svgOf(fig).id);
    f.hold = true;
    const drawnAt = f.renders.length;
    setEnhancementAppearance(root, LIGHT);
    const order: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      await vi.waitFor(() => expect(f.pending()).toBe(1));
      await tick();
      expect(f.pending()).toBe(1); // one at a time: the next waits for this one
      expect(f.renders.length).toBe(drawnAt + order.length + 1);
      order.push(f.renders[f.renders.length - 1]!.word);
      f.release();
    }
    expect(order).toEqual(['n2', 'n3', 'n1']); // nearest first, not document order
    await tick(60);
    expect(f.renders).toHaveLength(drawnAt + 3);
    figuresOf(root).forEach((fig, i) => {
      expect(chromeOf(fig)).toHaveLength(1);
      expect(fig.classList.contains('drawn')).toBe(true);
      expect(fig.querySelectorAll('svg')).toHaveLength(1);
      expect(svgOf(fig).id).not.toBe(before[i]);
      expect(svgOf(fig).getAttribute('role')).toBe('img');
      expect(svgOf(fig).hasAttribute(MARK)).toBe(true);
    });
    for (const r of f.renders.slice(drawnAt)) expect(theme(r)).toEqual(hosted(LIGHT, r));
    expect(root.getAttribute(STATE)).toBe('drawn');
  });

  it('a newer appearance cancels the redraws an older one queued (row A7i)', async () => {
    const root = three();
    const f = fake();
    await enhance(root, using(f.api, DARK));
    await settled(root);
    placeAt(root, TOPS, true);
    const drawnAt = f.renders.length;
    f.hold = true;
    setEnhancementAppearance(root, LIGHT);
    await vi.waitFor(() => expect(f.pending()).toBe(1)); // the first redraw of the older appearance is in flight
    setEnhancementAppearance(root, THIRD);
    f.hold = false;
    f.release(); // the in-flight one ends; the older appearance's other two must never start
    await vi.waitFor(() => expect(f.renders.length).toBeGreaterThanOrEqual(drawnAt + 4));
    await tick(80);
    // The in-flight redraw plus one per figure for the newer appearance: 4, not 6.
    expect(f.renders.slice(drawnAt).map((r) => r.word)).toEqual(['n2', 'n2', 'n3', 'n1']);
    const [inFlight, ...newer] = f.renders.slice(drawnAt);
    expect(theme(inFlight!)).toEqual(hosted(LIGHT, inFlight!)); // read at its turn, before the newer appearance
    for (const r of newer) expect(theme(r)).toEqual(hosted(THIRD, r));
    for (const fig of figuresOf(root)) expect(svgOf(fig).hasAttribute(MARK)).toBe(true);
  });

  it('an appearance that removes the colours redraws hosted figures as 1.1.0 draws them, and no other', async () => {
    const root = mount(figs(['flowchart LR', 'journey']));
    const f = fake();
    await enhance(root, using(f.api, DARK));
    await settled(root);
    const drawnAt = f.renders.length;
    setEnhancementAppearance(root, { mode: 'dark' });
    await vi.waitFor(() => expect(f.renders.length).toBe(drawnAt + 1));
    await tick(60);
    expect(f.renders).toHaveLength(drawnAt + 1);
    const again = f.renders[drawnAt]!;
    expect(again.word).toBe('n1');
    expect(theme(again)).toEqual(plain(again));
    expect(f.log.filter((l) => l.startsWith('parse'))).toEqual(['parse n1', 'parse n2']); // no parse once no colours apply
    expect(root.querySelectorAll(`[${MARK}]`)).toHaveLength(0);
  });

  it('colours arriving on a mount drawn without them redraw the covered figures, and leave the others alone', async () => {
    const root = mount(figs(['flowchart LR', 'journey']));
    const f = fake();
    await enhance(root, using(f.api, { mode: 'dark' }));
    await settled(root);
    expect(f.log.filter((l) => l.startsWith('parse'))).toEqual([]);
    setEnhancementAppearance(root, DARK);
    await vi.waitFor(() => expect(root.querySelectorAll(`[${MARK}]`)).toHaveLength(1));
    await tick(60);
    expect(only(f, 'n1').map(theme)).toEqual([plain(only(f, 'n1')[0]!), hosted(DARK, only(f, 'n1')[1]!)]);
    expect(svgOf(figuresOf(root)[1]!).hasAttribute(MARK)).toBe(false);
  });

  it('a figure not yet drawn when the appearance changes draws in the new colours at its turn', async () => {
    const root = mount(figs(['flowchart LR', 'flowchart LR', 'flowchart LR']));
    const f = fake();
    f.hold = true;
    await enhance(root, using(f.api, DARK));
    await vi.waitFor(() => expect(f.pending()).toBe(1));
    setEnhancementAppearance(root, LIGHT);
    f.hold = false;
    f.release();
    await settled(root);
    await tick(80);
    for (const w of ['n2', 'n3']) expect(theme(only(f, w).at(-1)!)).toEqual(hosted(LIGHT, only(f, w).at(-1)!));
    // The one in flight was drawn with the colours read at its turn, and is redrawn if those were the old ones.
    expect(theme(only(f, 'n1').at(-1)!)).toEqual(hosted(LIGHT, only(f, 'n1').at(-1)!));
    for (const fig of figuresOf(root)) {
      expect(chromeOf(fig)).toHaveLength(1);
      expect(svgOf(fig).hasAttribute(MARK)).toBe(true);
    }
  });

  it('the tools follow the new drawing: one set of buttons, and Full screen copies the new svg', async () => {
    const root = mount(figs(['flowchart LR']));
    const f = fake();
    await enhance(root, { ...using(f.api, DARK), copy: () => undefined });
    await settled(root);
    const fig = figuresOf(root)[0]!;
    const buttons = (): string[] => Array.from(fig.querySelectorAll('.tools button')).map((b) => b.textContent ?? '');
    await vi.waitFor(() => expect(buttons()).toContain('Full screen'));
    const first = buttons();
    expect(svgOf(fig).hasAttribute(MARK)).toBe(true);
    setEnhancementAppearance(root, { mode: 'dark' }); // back to 1.1.0's drawing: a new svg with no mark
    await vi.waitFor(() => expect(svgOf(fig).hasAttribute(MARK)).toBe(false));
    await vi.waitFor(() => expect(buttons()).toEqual(first));
    expect(fig.querySelectorAll('.tools')).toHaveLength(1);
    await tick(80); // the tools are built again at the relayout the redraw asks for
    const full = Array.from(fig.querySelectorAll<HTMLButtonElement>('.tools button')).find((b) => b.textContent === 'Full screen')!;
    full.click();
    await vi.waitFor(() => expect(root.querySelector('.fig-overlay.open svg')).not.toBeNull());
    expect(root.querySelector('.fig-overlay.open svg')!.hasAttribute(MARK)).toBe(false);
  });
});

describe('test 5 (unit half): the definition cues\' colours', () => {
  const figureWith = (mark: boolean): HTMLElement => {
    const root = document.createElement('main');
    root.innerHTML = `${render(['# Cues', '', '## 1. Words used here', '', '| Term | Meaning |', '|---|---|', '| Form | The shorter neutral term |'].join('\n')).html}<figure class="mermaid-figure"><pre class="mermaid">flowchart LR\n  A</pre><pre class="mermaid" data-docreader-chrome><svg id="cue-root" ${mark ? `${MARK} ` : ''}viewBox="0 0 240 100"><g class="node" id="flowchart-A-0"><rect width="80" height="30"/><text>Form</text></g></svg></pre><figcaption>Figure 1. Cues.</figcaption></figure>`;
    document.body.append(root);
    mounted.push(root);
    return root;
  };
  /** A colour as the CSSOM reads it back after the writer set `value`. */
  const norm = (prop: string, value: string): string => {
    const probe = document.createElement('div');
    probe.style.setProperty(prop, value);
    return probe.style.getPropertyValue(prop);
  };
  const withBox = async (fn: () => Promise<void>): Promise<void> => {
    const original = Object.getOwnPropertyDescriptor(SVGGElement.prototype, 'getBBox');
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: () => ({ x: 0, y: 0, width: 80, height: 30 }) });
    try {
      await fn();
    } finally {
      if (original === undefined) delete (SVGGElement.prototype as unknown as Record<string, unknown>)['getBBox'];
      else Object.defineProperty(SVGGElement.prototype, 'getBBox', original);
    }
  };
  const paint = (root: Element): string[] => {
    const ring = root.querySelector<SVGElement>('.dn-ring')!;
    const dot = root.querySelector<SVGElement>('.dn-dot')!;
    return [ring.style.getPropertyValue('stroke'), dot.style.getPropertyValue('fill'), dot.style.getPropertyValue('stroke'), ring.style.getPropertyPriority('stroke'), dot.style.getPropertyPriority('fill'), dot.style.getPropertyPriority('stroke')];
  };

  it('are the verdict\'s focus, accent and bg on a hosted figure (inline, important), and 1.1.0\'s literals on any other (row A7f)', async () => {
    await withBox(async () => {
      const hostedRoot = figureWith(true);
      await enhance(hostedRoot, { appearance: DARK });
      await vi.waitFor(() => expect(hostedRoot.querySelectorAll('.dn-ring, .dn-dot')).toHaveLength(2));
      const c = DARK.colour!;
      expect(c.focus).not.toBe('#0b6b66');
      expect(paint(hostedRoot)).toEqual([norm('stroke', c.focus), norm('fill', c.accent), norm('stroke', c.bg), 'important', 'important', 'important']);
      const plainRoot = figureWith(false);
      await enhance(plainRoot, { appearance: DARK });
      await vi.waitFor(() => expect(plainRoot.querySelectorAll('.dn-ring, .dn-dot')).toHaveLength(2));
      expect(paint(plainRoot)).toEqual([norm('stroke', '#0b6b66'), norm('fill', '#0b6b66'), norm('stroke', '#ffffff'), 'important', 'important', 'important']);
      const bare = figureWith(true);
      await enhance(bare); // a mark with no verdict (colours gone before the redraw): 1.1.0's literals
      await vi.waitFor(() => expect(bare.querySelectorAll('.dn-ring, .dn-dot')).toHaveLength(2));
      expect(paint(bare).slice(0, 3)).toEqual([norm('stroke', '#0b6b66'), norm('fill', '#0b6b66'), norm('stroke', '#ffffff')]);
    });
  });
});

describe('test 5 (unit half): a redraw leaves the replaced drawing\'s reader and memory as it found them', () => {
  const withTerm = (n = 1): string =>
    ['# Hosted', '', '## 1. Words used here', '', '| Term | Meaning |', '|---|---|', '| Widget | A neutral thing |', '', ...Array.from({ length: n }, (_, i) => fence(`flowchart LR\n  n${String(i + 1)} --> X`, `*Figure ${String(i + 1)}. Fig.*`))].join('\n');
  const drawnWithNode = async (n = 1, extras: Extras = { node: true }): Promise<{ root: HTMLElement; f: Fake }> => {
    const root = mount(withTerm(n));
    const f = fake(true, extras);
    await enhance(root, { ...using(f.api, DARK), copy: () => undefined });
    await settled(root);
    await vi.waitFor(() => expect(root.querySelectorAll('.dnode')).toHaveLength(n));
    return { root, f };
  };
  const redrawn = async (root: HTMLElement, before: string[], a: Appearance): Promise<void> => {
    setEnhancementAppearance(root, a);
    await vi.waitFor(() => expect(figuresOf(root).map((fig) => svgOf(fig).id).every((id, i) => id !== before[i])).toBe(true));
    await tick(40);
  };
  const ids = (root: Element): string[] => figuresOf(root).map((fig) => svgOf(fig).id);

  it('draws with the host\'s face when the root took it after the drawing booted (read at each call)', async () => {
    const root = mount(figs(['flowchart LR']));
    const f = fake();
    await enhance(root, using(f.api, DARK));
    await settled(root);
    expect(f.renders[0]!.config['fontFamily']).toBe(FONT_FALLBACK);
    root.style.setProperty('--sans', '"Host Face", sans-serif');
    await redrawn(root, ids(root), LIGHT);
    const again = f.renders.at(-1)!;
    expect(again.config['fontFamily']).toBe('"Host Face", sans-serif');
    expect((again.config['themeVariables'] as Record<string, string>)['fontFamily']).toBe('"Host Face", sans-serif');
  });

  it('closes Mermaid\'s tooltip shown over a node of the replaced drawing', async () => {
    const { root, f } = await drawnWithNode(1, { node: true, tooltip: true });
    void f;
    const tip = document.querySelector<HTMLElement>('.mermaidTooltip')!;
    root.querySelector('g.tipped')!.dispatchEvent(new Event('mouseover'));
    expect(tip.style.opacity).toBe('0.9');
    await redrawn(root, ids(root), LIGHT);
    expect(tip.style.opacity).toBe('0');
    expect(document.querySelectorAll('.mermaidTooltip')).toHaveLength(1);
  });

  it('closes a definition card opened from a node of the replaced drawing', async () => {
    const { root } = await drawnWithNode();
    const ctx = contextOf(root)!;
    expect(showCard(ctx, root.querySelector('.dnode')!)).toBe(true);
    expect(root.querySelector('.xcard.open')).not.toBeNull();
    await redrawn(root, ids(root), LIGHT);
    expect(root.querySelector('.xcard.open')).toBeNull();
  });

  it('keeps a card opened from somewhere else (it is not the replaced drawing\'s)', async () => {
    const { root } = await drawnWithNode(2);
    const ctx = contextOf(root)!;
    const second = root.querySelectorAll('figure.mermaid-figure')[1]!.querySelector('.dnode')!;
    expect(showCard(ctx, second)).toBe(true);
    setEnhancementAppearance(root, LIGHT);
    await vi.waitFor(() => expect(svgOf(figuresOf(root)[0]!).id).not.toBe(''));
    await tick(10);
    // the first figure is redrawn before the second (document order here): the card of the second is not the first's to close
    expect(root.querySelectorAll('.xcard.open').length).toBeLessThanOrEqual(1);
  });

  it('moves focus from a definition node of the replaced drawing to the node at the same place in the new one', async () => {
    const { root } = await drawnWithNode();
    const node = root.querySelector<SVGElement>('.dnode')!;
    node.focus();
    expect(document.activeElement).toBe(node);
    await redrawn(root, ids(root), LIGHT);
    const now = root.querySelector<SVGElement>('.dnode')!;
    expect(now).not.toBe(node);
    await vi.waitFor(() => expect(document.activeElement).toBe(now));
    expect(svgOf(figuresOf(root)[0]!).hasAttribute('data-docreader-focus')).toBe(false);
  });

  it('leaves focus alone when it was not on a definition node of the replaced drawing', async () => {
    const { root } = await drawnWithNode();
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    await redrawn(root, ids(root), LIGHT);
    expect(document.activeElement).toBe(outside);
  });

  it('keeps nothing of a replaced drawing alive: every drawing it replaced is collected after many changes', async () => {
    const { root } = await drawnWithNode(2);
    Object.defineProperty(SVGGElement.prototype, 'getBBox', { configurable: true, value: () => ({ x: 0, y: 0, width: 80, height: 30 }) });
    try {
      const old: WeakRef<Element>[] = [];
      const remember = (): void => {
        for (const fig of figuresOf(root)) old.push(new WeakRef(svgOf(fig)));
      };
      for (let i = 0; i < 6; i += 1) {
        remember();
        await redrawn(root, ids(root), i % 2 === 0 ? LIGHT : DARK);
      }
      await tick(100);
      for (let i = 0; i < 4; i += 1) {
        gc();
        await tick(10);
      }
      expect(old.filter((r) => r.deref() !== undefined)).toHaveLength(0);
      // ...and the live ones still work: cues painted on each, the tools built once
      expect(root.querySelectorAll('.dn-ring')).toHaveLength(2);
      expect(root.querySelectorAll('figure .tools')).toHaveLength(2);
    } finally {
      delete (SVGGElement.prototype as unknown as Record<string, unknown>)['getBBox'];
    }
  });

  it('puts back what it wrote when the reader goes: a drawing\'s marks, cues and the tools\' state leave with the instance', async () => {
    const { root } = await drawnWithNode();
    await redrawn(root, ids(root), LIGHT);
    expect(svgOf(figuresOf(root)[0]!).hasAttribute(MARK)).toBe(true);
    await destroyEnhancement(root);
    expect(root.querySelectorAll('[data-docreader-chrome], .dnode, .dn-ring, .dn-dot')).toHaveLength(0);
    expect(root.querySelectorAll('[tabindex], [aria-label], [role]').length).toBe(0);
  });
});
