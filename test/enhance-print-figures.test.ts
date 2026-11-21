// @vitest-environment jsdom
// Print figures of `./enhance` (docserver parity T6; the first consumer's parity design, section 4.6 stage 2, under section 6's caps),
// with a fake Mermaid and a fake canvas and image (jsdom has neither): what the `print-figures` command asks of the module, the order
// and the count of what it hands the host, what it skips, the caps, the cancel by a second command, and that no figure on screen
// changes. The real Mermaid and the real canvas are test/browser/print-figures.test.ts; the frame's side (the adapter, the pacer,
// the host's parser) is test/enhance-frame-wire.test.ts, test/frame-outbox.test.ts and test/host-mount.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BRIDGE_LIMITS } from '../src/frame/protocol.js';
import { COMMAND_NAMES } from '../src/enhance/commands.js';
import { destroyEnhancement, enhance, runEnhancementCommand, type EnhanceOptions, type PrintFigure } from '../src/enhance/index.js';
import {
  base64Bytes,
  createPrintRunner,
  figurePlace,
  FIGURES_MAX,
  isPrintPng,
  PNG_MAX_BYTES,
  PRINT_FONT,
  printConfigOf,
  printSize,
  SIDE_MAX,
  sizedSvg,
} from '../src/enhance/print-figures.js';
import { render } from '../src/render/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Base64 text of a PNG-shaped figure of `bytes` (at least 9) decoded bytes: the signature, a zero, then zeros. */
function pngOf(bytes: number): string {
  const rest = bytes - 9;
  return 'iVBORw0KGgoA' + 'AAAA'.repeat(Math.floor(rest / 3)) + (rest % 3 === 0 ? '' : rest % 3 === 1 ? 'AA==' : 'AAA=');
}

const fence = (source: string): string => ['```mermaid', source, '```', '', ''].join('\n');

/** `n` figures, each a flowchart whose first node is `f<index>`. */
const docOf = (n: number): string => ['# Diagrams', '', ...Array.from({ length: n }, (_, i) => fence(`flowchart LR\n  f${String(i)} --> A`))].join('\n');

const mounted: HTMLElement[] = [];

function mount(md: string): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${render(md).html}`, 'text/html');
  const root = document.createElement('main');
  root.append(...Array.from(parsed.body.childNodes));
  document.body.append(root);
  mounted.push(root);
  return root;
}

/** The first word of a diagram's second line: the name each fixture gives its first node. */
const wordOf = (text: string): string => /\n\s*(\S+)/.exec(text)?.[1] ?? text;

interface Render {
  readonly id: string;
  readonly text: string;
  readonly container: HTMLElement;
  readonly config: Record<string, unknown>;
}

interface Fake {
  readonly api: {
    initialize(config: Record<string, unknown>): void;
    render(id: string, text: string, container: Element): Promise<{ svg: string }>;
  };
  /** Every render, in order, with the configuration it was initialised with. */
  readonly renders: Render[];
  /** The print renders alone (their container is the reader's offscreen stage). */
  prints(): Render[];
  /** Which sources fail to draw (a rejection, as Mermaid's own on a syntax error). */
  fails: (word: string) => boolean;
  /** The viewBox each drawing has. */
  box: (word: string) => string;
  /** Hold every print render until release(). */
  hold: boolean;
  /** Hold every render, the screen's too, until release(). */
  holdAll: boolean;
  release(): boolean;
}

function fakeMermaid(): Fake {
  let config: Record<string, unknown> = {};
  const renders: Render[] = [];
  const held: (() => void)[] = [];
  const fake: Fake = {
    api: {
      initialize(c) {
        config = c;
      },
      render(id, text, container) {
        const node = container as HTMLElement;
        renders.push({ id, text, container: node, config });
        const word = wordOf(text);
        const settle = (resolve: (r: { svg: string }) => void, reject: (e: unknown) => void): void => {
          node.textContent = '';
          if (fake.fails(word)) {
            reject(new Error(`Parse error: ${word}`));
            return;
          }
          const svg = document.createElementNS(SVG_NS, 'svg');
          svg.setAttribute('id', id);
          svg.setAttribute('width', '100%');
          svg.setAttribute('viewBox', fake.box(word));
          svg.setAttribute('style', 'max-width: 300px;');
          svg.setAttribute('data-word', word);
          resolve({ svg: svg.outerHTML });
        };
        const isPrint = node.classList.contains('print-stage');
        if (!((fake.hold && isPrint) || fake.holdAll)) return new Promise((resolve, reject) => settle(resolve, reject));
        return new Promise((resolve, reject) => {
          held.push(() => settle(resolve, reject));
        });
      },
    },
    renders,
    prints: () => renders.filter((r) => r.container.classList.contains('print-stage')),
    fails: () => false,
    box: () => '0 0 300 120',
    hold: false,
    holdAll: false,
    release() {
      const next = held.shift();
      if (next === undefined) return false;
      next();
      return true;
    },
  };
  return fake;
}

/** What the fake image and canvas saw and answer. */
interface Raster {
  /** The data URL of each image the reader loaded. */
  srcs: string[];
  /** The size of each canvas an image was drawn on. */
  drawn: { w: number; h: number }[];
  /** Whether the image at this index fails to load. */
  errors: (k: number) => boolean;
  /** Whether the canvas of the drawing at this index is tainted. */
  taints: (k: number) => boolean;
  /** The PNG text the canvas of the drawing at this index answers. */
  png: (k: number) => string;
  /** A whole data URL to answer in place of the PNG's (a canvas of no size answers `data:,`), or null for the PNG's. */
  raw: (k: number) => string | null;
}

const raster: Raster = { srcs: [], drawn: [], errors: () => false, taints: () => false, png: () => pngOf(200), raw: () => null };
let srcDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  raster.srcs = [];
  raster.drawn = [];
  raster.errors = () => false;
  raster.taints = () => false;
  raster.png = () => pngOf(200);
  raster.raw = () => null;
  srcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    get: () => '',
    set(this: HTMLImageElement, v: unknown) {
      const k = raster.srcs.length;
      raster.srcs.push(String(v));
      setTimeout(() => {
        this.dispatchEvent(new Event(raster.errors(k) ? 'error' : 'load'));
      }, 0);
    },
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    const canvas = this;
    return {
      font: '',
      measureText: () => ({ width: 1 }),
      drawImage: () => {
        raster.drawn.push({ w: canvas.width, h: canvas.height });
      },
    } as unknown as CanvasRenderingContext2D;
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation((() => {
    const k = raster.drawn.length - 1;
    if (raster.taints(k)) throw new DOMException('The canvas has been tainted', 'SecurityError');
    return raster.raw(k) ?? `data:image/png;base64,${raster.png(k)}`;
  }) as never);
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (srcDescriptor !== undefined) Object.defineProperty(HTMLImageElement.prototype, 'src', srcDescriptor);
  else Reflect.deleteProperty(HTMLImageElement.prototype, 'src');
  for (const root of mounted.splice(0)) await destroyEnhancement(root).catch(() => undefined);
  document.body.replaceChildren();
});

interface Setup {
  readonly root: HTMLElement;
  readonly fake: Fake;
  readonly got: PrintFigure[];
}

/** A mounted document of `n` figures, enhanced with the fake Mermaid and (unless `flag` is false) an onPrintFigure that keeps what it gets. */
async function setup(n: number, extra: Partial<EnhanceOptions> = {}, flag = true, tune: (f: Fake) => void = () => undefined, mermaidExtra: object = {}): Promise<Setup> {
  const fake = fakeMermaid();
  tune(fake);
  const root = mount(docOf(n));
  const got: PrintFigure[] = [];
  const options: EnhanceOptions = {
    mermaid: { load: () => Promise.resolve(fake.api), secure: ['tagA'], draw: 'on-request', ...mermaidExtra },
    ...(flag ? { onPrintFigure: (f: PrintFigure) => void got.push(f) } : {}),
    ...extra,
  };
  await enhance(root, options);
  return { root, fake, got };
}

const settled = (ms = 0): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('the constants are the wire\'s', () => {
  it('FIGURES_MAX, SIDE_MAX and PNG_MAX_BYTES equal BRIDGE_LIMITS', () => {
    expect(FIGURES_MAX).toBe(BRIDGE_LIMITS.printFiguresMax);
    expect(SIDE_MAX).toBe(BRIDGE_LIMITS.printFigureSideMaxPx);
    expect(PNG_MAX_BYTES).toBe(BRIDGE_LIMITS.printFigurePngMaxBytes);
  });

  it('print-figures is a command the reader knows', () => {
    expect(COMMAND_NAMES).toContain('print-figures');
  });
});

describe('printSize: print scale 2, shrunk to fit 2048 px a side', () => {
  it('doubles an ordinary drawing, keeps its proportions and never passes SIDE_MAX', () => {
    expect(printSize(300, 120)).toEqual({ w: 600, h: 240 });
    expect(printSize(1024, 100)).toEqual({ w: 2048, h: 200 });
    expect(printSize(5000, 100)).toEqual({ w: 2048, h: 41 });
    expect(printSize(100, 5000)).toEqual({ w: 41, h: 2048 });
    expect(printSize(0.1, 0.1)).toEqual({ w: 1, h: 1 });
  });

  it('refuses a size that is no size', () => {
    for (const [w, h] of [[0, 10], [10, 0], [-1, 10], [Number.NaN, 10], [10, Number.POSITIVE_INFINITY]] as const) expect(printSize(w, h), `${String(w)}x${String(h)}`).toBeNull();
  });
});

describe('sizedSvg: Mermaid\'s text with an absolute size', () => {
  const tag = (attrs: string): string => `<svg ${attrs}><g/></svg>`;

  it('replaces width="100%", height and max-width by the canvas size of the viewBox, and keeps the rest', () => {
    const got = sizedSvg(tag('id="d" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 300px; background-color: white;" viewBox="0 0 300 120"'));
    expect(got).not.toBeNull();
    expect(got).toMatchObject({ w: 600, h: 240 });
    expect(got?.svg.startsWith('<svg width="600" height="240" id="d" xmlns="http://www.w3.org/2000/svg" style="')).toBe(true);
    expect(got?.svg.endsWith('viewBox="0 0 300 120"><g/></svg>')).toBe(true);
    expect(got?.svg).toContain('background-color: white;');
    expect(got?.svg).not.toMatch(/max-width|width="100%"/);
    expect(got?.svg).toContain('viewBox="0 0 300 120"');
  });

  it('accepts an XML declaration first and a viewBox with commas', () => {
    expect(sizedSvg(`<?xml version="1.0"?><svg viewBox="0,0,100,50"></svg>`)).toMatchObject({ w: 200, h: 100 });
  });

  it('is null for text that is no SVG, has no usable viewBox, or is Mermaid\'s error drawing', () => {
    for (const text of ['', 'hello', '<div viewBox="0 0 1 1"></div>', tag('width="10"'), tag('viewBox="0 0 0 10"'), tag('viewBox="0 0 10"'), tag('viewBox="a b c d"'), tag('aria-roledescription="error" viewBox="0 0 10 10"')]) {
      expect(sizedSvg(text), text).toBeNull();
    }
  });
});

describe('PNG text: size and signature', () => {
  it('base64Bytes reads the decoded size and refuses text that is not base64', () => {
    expect(base64Bytes('')).toBe(0);
    expect(base64Bytes('AAAA')).toBe(3);
    expect(base64Bytes('AAA=')).toBe(2);
    expect(base64Bytes('AA==')).toBe(1);
    for (const bad of ['A', 'AAA', 'A===', 'AA=A', '!!!!', 'AAAA\n']) expect(base64Bytes(bad), bad).toBe(-1);
  });

  it('isPrintPng takes the signature and at most 1 MiB', () => {
    expect(isPrintPng('iVBORw0KGgo=')).toBe(true);
    expect(isPrintPng(pngOf(PNG_MAX_BYTES))).toBe(true);
    expect(isPrintPng(pngOf(PNG_MAX_BYTES + 1))).toBe(false);
    expect(isPrintPng(pngOf(PNG_MAX_BYTES + 3))).toBe(false);
    for (const bad of ['', 'QQ==', 'AAAAAAAA', '/9j/4AAQSkZJRg==', 'iVBORw0KGgo']) expect(isPrintPng(bad), bad).toBe(false);
  });

  it('figurePlace takes integers with 0 <= i < n <= 64', () => {
    expect(figurePlace(0, 1)).toBe(true);
    expect(figurePlace(63, 64)).toBe(true);
    for (const [i, n] of [[0, 65], [64, 64], [3, 3], [4, 3], [-1, 3], [0, 0], [1.5, 3], [0, 2.5], [Number.NaN, 3], [0, Number.NaN]] as const) {
      expect(figurePlace(i, n), `${String(i)} of ${String(n)}`).toBe(false);
    }
  });
});

describe('printConfigOf: the screen\'s configuration, made print\'s', () => {
  const screen = { theme: 'base', themeVariables: { primaryColor: '#abcdef', fontFamily: 'X' }, secure: ['theme'], fontFamily: 'X', securityLevel: 'strict' };

  it('turns HTML labels off at the top and in the flowchart, puts the one usable font on, and makes htmlLabels secure', () => {
    const got = printConfigOf(screen);
    expect(got['htmlLabels']).toBe(false);
    expect(got['flowchart']).toEqual({ htmlLabels: false });
    expect(got['fontFamily']).toBe(PRINT_FONT);
    expect(got['themeVariables']).toEqual({ primaryColor: '#abcdef', fontFamily: PRINT_FONT });
    expect(got['secure']).toEqual(['theme', 'htmlLabels']);
    expect(got['securityLevel']).toBe('strict');
    expect(screen.secure).toEqual(['theme']);
  });
});

describe('the print-figures command through the reader', () => {
  it('hands every figure over in document order, with n their count, as a PNG of the canvas, and answers true', async () => {
    const { root, got, fake } = await setup(3);
    expect(runEnhancementCommand(root, 'print-figures')).toBe(true);
    await vi.waitFor(() => {
      expect(got).toHaveLength(3);
    });
    expect(got.map((f) => [f.i, f.n])).toEqual([[0, 3], [1, 3], [2, 3]]);
    expect(got.every((f) => f.png === pngOf(200))).toBe(true);
    expect(fake.prints().map((r) => wordOf(r.text))).toEqual(['f0', 'f1', 'f2']);
    expect(Object.isFrozen(got[0])).toBe(true);
  });

  it('draws for print apart from the screen: HTML labels off, the one font, htmlLabels secure, in the offscreen stage', async () => {
    const { root, got, fake } = await setup(1);
    runEnhancementCommand(root, 'print-figures');
    await vi.waitFor(() => {
      expect(got).toHaveLength(1);
    });
    const [print] = fake.prints();
    expect(print?.container.className).toBe('print-stage');
    expect(print?.config['htmlLabels']).toBe(false);
    expect(print?.config['flowchart']).toEqual({ htmlLabels: false });
    expect(print?.config['fontFamily']).toBe(PRINT_FONT);
    expect((print?.config['secure'] as string[]).includes('htmlLabels')).toBe(true);
    expect((print?.config['secure'] as string[]).includes('tagA')).toBe(true);
    expect(print?.config['startOnLoad']).toBe(false);
    expect(print?.config['securityLevel']).toBe('strict');
    expect(print?.id.startsWith('docreader·mermaid-')).toBe(true);
  });

  it('rasterises each drawing at print scale: an absolute-size SVG as a data URL, on a canvas of its size', async () => {
    const { root, got, fake } = await setup(2, {}, true, (f) => {
      f.box = (w) => (w === 'f1' ? '0 0 5000 100' : '0 0 300 120');
    });
    runEnhancementCommand(root, 'print-figures');
    await vi.waitFor(() => {
      expect(got).toHaveLength(2);
    });
    expect(raster.drawn).toEqual([{ w: 600, h: 240 }, { w: 2048, h: 41 }]);
    expect(raster.srcs).toHaveLength(2);
    const svg = decodeURIComponent((raster.srcs[0] ?? '').replace(/^data:image\/svg\+xml;charset=utf-8,/, ''));
    expect(svg).toMatch(/^<svg width="600" height="240" /);
    expect(svg).not.toMatch(/max-width|width="100%"/);
    expect(fake.prints()).toHaveLength(2);
  });

  it('skips a figure that does not draw: its i is never handed over, and the figures after it go on', async () => {
    const { root, got } = await setup(4, {}, true, (f) => {
      f.fails = (w) => w === 'f2';
    });
    runEnhancementCommand(root, 'print-figures');
    await vi.waitFor(() => {
      expect(got).toHaveLength(3);
    });
    await settled(20);
    expect(got.map((f) => [f.i, f.n])).toEqual([[0, 4], [1, 4], [3, 4]]);
  });

  it('skips a figure whose image fails to load, whose canvas is tainted, or whose PNG is over 1 MiB, and one that is no PNG', async () => {
    // figure 0's image fails to load (no canvas); the canvases of figures 1, 2 and 3 are the 0th, 1st and 2nd drawn
    raster.errors = (k) => k === 0;
    raster.taints = (k) => k === 0;
    raster.png = (k) => (k === 1 ? pngOf(PNG_MAX_BYTES + 1) : k === 2 ? 'QQ==' : pngOf(300));
    const { root, got } = await setup(6);
    runEnhancementCommand(root, 'print-figures');
    await vi.waitFor(() => {
      expect(got).toHaveLength(2);
    });
    await settled(20);
    expect(got.map((f) => [f.i, f.n, f.png.length])).toEqual([[4, 6, pngOf(300).length], [5, 6, pngOf(300).length]]);
  });

  it('skips a figure whose canvas answers no PNG data URL (a canvas of no size answers data:,)', async () => {
    raster.raw = (k) => (k === 0 ? 'data:,' : k === 1 ? 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' : null);
    const { root, got } = await setup(3);
    runEnhancementCommand(root, 'print-figures');
    await vi.waitFor(() => {
      expect(got).toHaveLength(1);
    });
    await settled(20);
    expect(got.map((f) => f.i)).toEqual([2]);
  });

  it('a PNG of exactly 1 MiB is handed over', async () => {
    raster.png = () => pngOf(PNG_MAX_BYTES);
    const { root, got } = await setup(1);
    runEnhancementCommand(root, 'print-figures');
    await vi.waitFor(() => {
      expect(got).toHaveLength(1);
    });
  });

  it('skips a source longer than Mermaid takes (the host\'s maxTextSize), and asks Mermaid nothing for it', async () => {
    const { root, got, fake } = await setup(12, {}, true, () => undefined, { maxTextSize: 24 });
    runEnhancementCommand(root, 'print-figures');
    await vi.waitFor(() => {
      expect(got).toHaveLength(10);
    });
    await settled(20);
    expect(got.map((f) => f.i)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(got.every((f) => f.n === 12)).toBe(true);
    expect(fake.prints()).toHaveLength(10);
  });

  it('caps the run at 64 figures: n is 64 and a 65th is never drawn', async () => {
    const { root, got, fake } = await setup(70);
    runEnhancementCommand(root, 'print-figures');
    await vi.waitFor(
      () => {
        expect(got).toHaveLength(64);
      },
      { timeout: 10_000 },
    );
    await settled(20);
    expect(got).toHaveLength(64);
    expect(got.every((f) => f.n === 64)).toBe(true);
    expect(got.map((f) => f.i)).toEqual(Array.from({ length: 64 }, (_, i) => i));
    expect(fake.prints()).toHaveLength(64);
  }, 20_000);

  it('hands figures over in ascending i, one at a time: the next is not drawn until the host\'s promise settles', async () => {
    const release: (() => void)[] = [];
    const seen: number[] = [];
    const { root, fake } = await setup(3, {
      onPrintFigure: (f: PrintFigure) =>
        new Promise<void>((resolve) => {
          seen.push(f.i);
          release.push(resolve);
        }),
    });
    runEnhancementCommand(root, 'print-figures');
    await vi.waitFor(() => {
      expect(seen).toEqual([0]);
    });
    await settled(30);
    expect(seen).toEqual([0]);
    expect(fake.prints()).toHaveLength(1);
    release.shift()?.();
    await vi.waitFor(() => {
      expect(seen).toEqual([0, 1]);
    });
    release.shift()?.();
    await vi.waitFor(() => {
      expect(seen).toEqual([0, 1, 2]);
    });
  });

  it('a second print-figures cancels the first run: its remaining figures are neither drawn nor handed over', async () => {
    const { root, got, fake } = await setup(4, {}, true, (f) => {
      f.hold = true;
    });
    runEnhancementCommand(root, 'print-figures');
    await vi.waitFor(() => {
      expect(fake.prints()).toHaveLength(1);
    });
    runEnhancementCommand(root, 'print-figures');
    fake.hold = false;
    expect(fake.release()).toBe(true);
    await vi.waitFor(() => {
      expect(got).toHaveLength(4);
    });
    await settled(30);
    // the first run's figure 0 was in flight when the second began: it hands nothing, and nothing else of that run is asked for
    expect(got.map((f) => f.i)).toEqual([0, 1, 2, 3]);
    expect(fake.prints().map((r) => wordOf(r.text))).toEqual(['f0', 'f0', 'f1', 'f2', 'f3']);
  });

  it('a figure of the cancelled run still queued behind another call is never drawn: Mermaid is asked for nothing on its behalf', async () => {
    const { root, got, fake } = await setup(3, {}, true, (f) => {
      f.holdAll = true;
    }, { draw: 'auto' });
    // the screen's first drawing is in flight (held), and the module's queue is one call at a time
    await vi.waitFor(() => {
      expect(fake.renders).toHaveLength(1);
    });
    runEnhancementCommand(root, 'print-figures');
    await settled(20); // the first run's figure 0 is now queued behind the screen's drawing
    runEnhancementCommand(root, 'print-figures');
    fake.holdAll = false;
    for (let k = 0; k < 20; k += 1) {
      fake.release();
      await settled(5);
    }
    await vi.waitFor(() => {
      expect(got).toHaveLength(3);
    });
    await settled(20);
    expect(got.map((f) => f.i)).toEqual([0, 1, 2]);
    expect(fake.prints().map((r) => wordOf(r.text))).toEqual(['f0', 'f1', 'f2']);
  });

  it('a second command cancels a run waiting on the host: the figure after the one handed over is never drawn for it', async () => {
    const seen: number[] = [];
    const release: (() => void)[] = [];
    const { root, fake } = await setup(3, {
      onPrintFigure: (f: PrintFigure) =>
        new Promise<void>((resolve) => {
          seen.push(f.i);
          release.push(resolve);
        }),
    });
    runEnhancementCommand(root, 'print-figures');
    await vi.waitFor(() => {
      expect(seen).toEqual([0]);
    });
    runEnhancementCommand(root, 'print-figures');
    release.shift()?.();
    await vi.waitFor(() => {
      expect(seen).toEqual([0, 0]);
    });
    expect(fake.prints().map((r) => wordOf(r.text))).toEqual(['f0', 'f0']);
  });

  it('answers false and does nothing without onPrintFigure: no print render, no image, no canvas', async () => {
    const { root, got, fake } = await setup(3, {}, false);
    const before = fake.renders.length;
    expect(runEnhancementCommand(root, 'print-figures')).toBe(false);
    await settled(30);
    expect(got).toEqual([]);
    expect(fake.renders).toHaveLength(before);
    expect(raster.srcs).toEqual([]);
    expect(raster.drawn).toEqual([]);
  });

  it('answers false for a document with no figure, and for a root that is not enhanced', async () => {
    const fake = fakeMermaid();
    const root = mount('# No figure\n\nText.\n');
    await enhance(root, { mermaid: { load: () => Promise.resolve(fake.api), secure: [] }, onPrintFigure: () => undefined });
    expect(runEnhancementCommand(root, 'print-figures')).toBe(false);
    expect(runEnhancementCommand(document.createElement('div'), 'print-figures')).toBe(false);
  });

  it('changes nothing on screen: the root is byte-equal before and after, and the stage is gone', async () => {
    const { root, got } = await setup(3);
    const figures = (): string => Array.from(root.querySelectorAll('figure.mermaid-figure')).map((f) => f.outerHTML).join('\n');
    const before = figures();
    const rootChildren = root.children.length;
    runEnhancementCommand(root, 'print-figures');
    await vi.waitFor(() => {
      expect(got).toHaveLength(3);
    });
    await settled(10);
    expect(figures()).toBe(before);
    expect(root.children.length).toBe(rootChildren);
    expect(root.querySelector('.print-stage')).toBeNull();
    expect(root.querySelectorAll('figure.mermaid-figure.drawn')).toHaveLength(0);
  });

  it('stops once the instance is destroyed: nothing more is drawn or handed over', async () => {
    const { root, got, fake } = await setup(4, {}, true, (f) => {
      f.hold = true;
    });
    runEnhancementCommand(root, 'print-figures');
    await vi.waitFor(() => {
      expect(fake.prints()).toHaveLength(1);
    });
    await destroyEnhancement(root);
    fake.hold = false;
    fake.release();
    await settled(40);
    expect(got).toEqual([]);
    expect(fake.prints()).toHaveLength(1);
  });

  it('a host callback that throws costs the run nothing: the next figure goes on', async () => {
    const seen: number[] = [];
    const { root } = await setup(3, {
      onPrintFigure: (f: PrintFigure) => {
        seen.push(f.i);
        throw new Error('host');
      },
    });
    runEnhancementCommand(root, 'print-figures');
    await vi.waitFor(() => {
      expect(seen).toEqual([0, 1, 2]);
    });
  });
});

describe('the runner on its own', () => {
  const draws = (n: number, text = '<svg viewBox="0 0 10 10"></svg>'): ((stale: () => boolean) => Promise<string | null>)[] => Array.from({ length: n }, () => () => Promise.resolve(text));

  it('cuts a list of more than 64 figures to 64: n is 64 and no 65th is drawn', async () => {
    const asked: number[] = [];
    const got: PrintFigure[] = [];
    const figures = Array.from({ length: 80 }, (_, i) => () => {
      asked.push(i);
      return Promise.resolve('<svg viewBox="0 0 10 10"></svg>');
    });
    createPrintRunner({ live: () => true, figures: () => figures, rasterize: () => Promise.resolve(pngOf(20)), hand: (f) => Promise.resolve(void got.push(f)) }).start();
    await vi.waitFor(() => {
      expect(got).toHaveLength(64);
    });
    expect(asked).toHaveLength(64);
    expect(got[63]).toMatchObject({ i: 63, n: 64 });
  });

  it('hands over no figure whose PNG is no PNG or too large, and skips an undefined entry', async () => {
    const got: PrintFigure[] = [];
    const pngs = [pngOf(10), 'QQ==', pngOf(PNG_MAX_BYTES + 1), '', pngOf(11)];
    let k = 0;
    const list = [...draws(3), undefined, ...draws(1)];
    createPrintRunner({
      live: () => true,
      figures: () => list,
      rasterize: () => Promise.resolve(pngs[k++] ?? null),
      hand: (f) => Promise.resolve(void got.push(f)),
    }).start();
    await vi.waitFor(() => {
      expect(got.length).toBeGreaterThan(0);
    });
    await settled(10);
    expect(got.map((f) => [f.i, f.n, f.png.length])).toEqual([[0, 5, pngOf(10).length]]);
  });

  it('a draw that throws, or a rasterize that throws or answers null, skips that figure only', async () => {
    const got: PrintFigure[] = [];
    const list: ((stale: () => boolean) => Promise<string | null>)[] = [
      () => Promise.reject(new Error('x')),
      () => Promise.resolve('<svg viewBox="0 0 10 10"></svg>'),
      () => Promise.resolve('<svg viewBox="0 0 10 10"></svg>'),
      () => Promise.resolve(null),
      () => Promise.resolve('<svg viewBox="0 0 10 10"></svg>'),
    ];
    let k = 0;
    createPrintRunner({
      live: () => true,
      figures: () => list,
      rasterize: () => {
        k += 1;
        return k === 1 ? Promise.reject(new Error('r')) : k === 2 ? Promise.resolve(null) : Promise.resolve(pngOf(30));
      },
      hand: (f) => Promise.resolve(void got.push(f)),
    }).start();
    await vi.waitFor(() => {
      expect(got).toHaveLength(1);
    });
    expect(got[0]).toMatchObject({ i: 4, n: 5 });
  });

  it('stops at once when the instance is not live: nothing more is drawn, rasterised or handed over', async () => {
    let alive = true;
    const got: PrintFigure[] = [];
    const drawn: number[] = [];
    const figures = Array.from({ length: 3 }, (_, i) => () => {
      drawn.push(i);
      if (i === 1) alive = false;
      return Promise.resolve('<svg viewBox="0 0 10 10"></svg>');
    });
    const rasterized: number[] = [];
    createPrintRunner({
      live: () => alive,
      figures: () => figures,
      rasterize: () => {
        rasterized.push(rasterized.length);
        return Promise.resolve(pngOf(30));
      },
      hand: (f) => Promise.resolve(void got.push(f)),
    }).start();
    await settled(30);
    expect(got.map((f) => f.i)).toEqual([0]);
    expect(drawn).toEqual([0, 1]);
    expect(rasterized).toHaveLength(1);
  });

  it('skips a drawing whose SVG has no size, and Mermaid\'s error drawing', async () => {
    const got: PrintFigure[] = [];
    const texts = ['<svg width="10"></svg>', '<svg aria-roledescription="error" viewBox="0 0 10 10"></svg>', '<svg viewBox="0 0 10 10"></svg>'];
    createPrintRunner({
      live: () => true,
      figures: () => texts.map((t) => () => Promise.resolve(t)),
      rasterize: () => Promise.resolve(pngOf(30)),
      hand: (f) => Promise.resolve(void got.push(f)),
    }).start();
    await vi.waitFor(() => {
      expect(got).toHaveLength(1);
    });
    expect(got[0]).toMatchObject({ i: 2, n: 3 });
  });
});
