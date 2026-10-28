// @vitest-environment jsdom
// Mermaid on request (docserver L3, Task 16; FD13, ruling R4): the enhance option `mermaid.draw`, 'auto' (the default)
// or 'on-request'. In 'on-request' the second phase neither loads Mermaid nor sets `drawing`: the root reads
// `data-docreader-diagrams="on-request"`, each drawable figure gets one Render button (library chrome, a native button),
// and a figure over maxTextSize gets none and shows its source with L2's note. The first tap calls the host's load()
// once; that figure only is drawn, through L2's per-figure path and its one queue per module, so draws run one at a
// time (a second tap waits, its button busy) and a failure shows L2's note and source for that figure only. Rows L3.D1
// to L3.D4, with a fake Mermaid; L3.D5 (the frame and host halves, in real browsers) is Tasks 8 and 10's. The last block
// is the bootstrap's pass-through of the seed's `draw` (src/frame-runtime/adapters.ts), the unit half of L3.D5. Then
// L3.D6 (fix round, review S1): on request the bootstrap asks for inline style before ready (src/frame-runtime/styles.ts),
// so a host policy that would break a drawing after ready fails the boot instead; its browser half is the frame block of
// test/browser/mermaid-on-request.test.ts.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { NOTES } from '../src/enhance/diagrams.js';
import { destroyEnhancement, enhance, EnhanceError, type EnhanceOptions } from '../src/enhance/index.js';
import { CHROME_ATTR } from '../src/enhance/journal.js';
import { MERMAID_DRAW_VALUES, normalizeOptions } from '../src/enhance/options.js';
import { MERMAID_DRAW, type MermaidDraw, type SeedMermaid } from '../src/frame/seed.js';
import { enhanceMermaid, probesInlineStyle, waitsForDrawing } from '../src/frame-runtime/adapters.js';
import { probeInlineStyle, STYLE_PROBE_ATTR, STYLE_PROBE_TEXT, styleIntrinsics } from '../src/frame-runtime/styles.js';
import { render } from '../src/render/index.js';

const ROOT = path.join(import.meta.dirname, '..');
const SVG_NS = 'http://www.w3.org/2000/svg';
const GATE = 'data-docreader-mermaid';
const STATE = 'data-docreader-diagrams';
const FIG_STATE = 'data-docreader-draw';

/** A Mermaid fence, then its caption line. */
const fence = (source: string, caption: string): string => ['```mermaid', source, '```', '', caption, ''].join('\n');

/** Three short flowcharts, each naming its first node. */
const THREE = [
  '# Diagrams',
  '',
  'Intro.',
  '',
  fence('flowchart LR\n  one --> A', '*Figure 1. The first.*'),
  fence('flowchart LR\n  two --> B', '*Figure 2. The second.*'),
  fence('flowchart LR\n  three --> C', '*Figure 3. The third.*'),
].join('\n');

/** The same, but the third is longer than LONG_CAP characters. */
const LONG_CAP = 40;
const LONG_SOURCE = `flowchart LR\n${Array.from({ length: 6 }, (_, i) => `  n${String(i)} --> m${String(i)}`).join('\n')}`;
const WITH_LONG = [
  '# Diagrams',
  '',
  fence('flowchart LR\n  one --> A', '*Figure 1. The first.*'),
  fence('flowchart LR\n  two --> B', '*Figure 2. The second.*'),
  fence(LONG_SOURCE, '*Figure 3. The long one.*'),
].join('\n');

const mounted: HTMLElement[] = [];

function mount(md: string = THREE): HTMLElement {
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

/** The first word of a diagram's second line: the name each fixture gives its first node. */
const wordOf = (text: string): string => /\n\s*(\S+)/.exec(text)?.[1] ?? text;

interface Fake {
  readonly api: { initialize(config: Record<string, unknown>): void; render(id: string, text: string, container: Element): Promise<{ svg: string }> };
  /** `run <word>` as each drawing starts, `done <word>` as it finishes. */
  readonly log: string[];
  /** Hold every drawing until release(). */
  hold: boolean;
  release(): boolean;
}

/**
 * A fake Mermaid: each render empties its container and answers an svg's text (or, for a word in `fail`, Mermaid's error
 * drawing), which the reader puts in that container.
 */
function fakeMermaid(fail: readonly string[] = []): Fake {
  const log: string[] = [];
  const held: (() => void)[] = [];
  const fake: Fake = {
    api: {
      initialize() {},
      render(id, text, container) {
        const word = wordOf(text);
        log.push(`run ${word}`);
        container.textContent = '';
        const finish = (): { svg: string } => {
          const svg = document.createElementNS(SVG_NS, 'svg');
          svg.setAttribute('id', id);
          svg.setAttribute('viewBox', '0 0 300 120');
          if (fail.includes(word)) svg.setAttribute('aria-roledescription', 'error');
          log.push(`done ${word}`);
          return { svg: svg.outerHTML };
        };
        if (!fake.hold) return Promise.resolve(finish());
        return new Promise<{ svg: string }>((resolve) => {
          held.push(() => {
            resolve(finish());
          });
        });
      },
    },
    log,
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

/** Options that draw on request with `fake`, counting the host's load() calls. */
function onRequest(fake: Fake, extra: Partial<NonNullable<EnhanceOptions['mermaid']>> = {}): { options: EnhanceOptions; loads: () => number } {
  let loads = 0;
  return {
    options: {
      mermaid: {
        load: () => {
          loads += 1;
          return Promise.resolve({ default: fake.api });
        },
        draw: 'on-request',
        ...extra,
      },
    },
    loads: () => loads,
  };
}

const figuresOf = (root: Element): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>('figure.mermaid-figure'));
const buttonsOf = (figure: Element): HTMLButtonElement[] => Array.from(figure.querySelectorAll<HTMLButtonElement>('button')).filter((b) => b.textContent === 'Render');
const buttonOf = (figure: Element): HTMLButtonElement => {
  const buttons = buttonsOf(figure);
  expect(buttons, 'the figure\'s one Render button').toHaveLength(1);
  return buttons[0] as HTMLButtonElement;
};
const svgsIn = (el: Element): number => el.querySelectorAll('svg').length;
const runs = (log: readonly string[]): string[] => log.filter((l) => l.startsWith('run '));
const tick = (ms = 30): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('L3.D1: on request, the second phase loads nothing and draws nothing', () => {
  it('after enhance() resolves: no load, no SVG, the root reads on-request, one Render button per drawable figure, and the over-long figure has none and shows its note', async () => {
    const root = mount(WITH_LONG);
    const fake = fakeMermaid();
    const { options, loads } = onRequest(fake, { maxTextSize: LONG_CAP });
    await enhance(root, options);
    await tick(80);
    expect(loads()).toBe(0);
    expect(fake.log).toEqual([]);
    expect(svgsIn(root)).toBe(0);
    expect(root.getAttribute(STATE)).toBe('on-request');
    // No gate: an untapped figure's source stays readable text, never the transparent placeholder (C43).
    expect(root.hasAttribute(GATE)).toBe(false);
    const [a, b, long] = figuresOf(root) as [HTMLElement, HTMLElement, HTMLElement];
    for (const f of [a, b]) {
      const buttons = buttonsOf(f);
      expect(buttons).toHaveLength(1);
      const button = buttons[0] as HTMLButtonElement;
      // Library chrome, a native button: keyboard reachable, not a link (the frame's click guard leaves it alone).
      expect(button.localName).toBe('button');
      expect(button.type).toBe('button');
      expect(button.hasAttribute(CHROME_ATTR)).toBe(true);
      expect(button.disabled).toBe(false);
      expect(button.tabIndex).toBe(0);
      expect(button.closest('a')).toBeNull();
      expect(f.getAttribute(FIG_STATE)).toBe('on-request');
      expect(f.classList.contains('drawn') || f.classList.contains('draw-failed')).toBe(false);
    }
    expect(buttonOf(a).getAttribute('aria-label')).toBe('Render figure 1');
    expect(buttonsOf(long)).toEqual([]);
    expect(long.querySelectorAll('button')).toHaveLength(0);
    expect(long.classList.contains('draw-failed')).toBe(true);
    expect(long.getAttribute(FIG_STATE)).toBe('failed');
    const note = long.querySelector('.fig-error');
    expect(note?.querySelector('p')?.textContent).toBe(NOTES.long);
    expect(note?.querySelector('pre.fig-src code')?.textContent).toBe(`${LONG_SOURCE}\n`);
  });

  it('control: the same document with draw "auto" loads at once and draws every figure', async () => {
    const root = mount(THREE);
    const fake = fakeMermaid();
    const { options, loads } = onRequest(fake, { draw: 'auto' });
    await enhance(root, options);
    await vi.waitFor(() => {
      expect(root.getAttribute(STATE)).toBe('drawn');
    });
    expect(loads()).toBe(1);
    expect(runs(fake.log)).toHaveLength(3);
    expect(figuresOf(root).map((f) => buttonsOf(f).length)).toEqual([0, 0, 0]);
  });

  it('a destroy removes the buttons and the state; a tap made after it draws nothing', async () => {
    const root = mount(THREE);
    const before = root.outerHTML;
    const fake = fakeMermaid();
    const { options, loads } = onRequest(fake);
    await enhance(root, options);
    const button = buttonOf(figuresOf(root)[0] as HTMLElement);
    await destroyEnhancement(root);
    button.click();
    await tick();
    expect(loads()).toBe(0);
    expect(root.outerHTML).toBe(before);
  });
});

describe('L3.D2: a tap draws that figure only, and loads once', () => {
  it('a tap on the second figure loads once and draws it alone; a later tap on the first draws it with no second load', async () => {
    const root = mount(THREE);
    const fake = fakeMermaid();
    const { options, loads } = onRequest(fake);
    await enhance(root, options);
    const [one, two, three] = figuresOf(root) as [HTMLElement, HTMLElement, HTMLElement];
    buttonOf(two).click();
    await vi.waitFor(() => {
      expect(two.classList.contains('drawn')).toBe(true);
    });
    await tick();
    expect(loads()).toBe(1);
    expect(runs(fake.log)).toEqual(['run two']);
    expect([svgsIn(one), svgsIn(two), svgsIn(three)]).toEqual([0, 1, 0]);
    expect(two.getAttribute(FIG_STATE)).toBe('drawn');
    // The drawn figure's Render control goes; the others keep theirs.
    expect(buttonOf(two).closest('[hidden]')).not.toBeNull();
    expect(buttonOf(one).closest('[hidden]')).toBeNull();
    expect(root.getAttribute(STATE)).toBe('on-request');
    buttonOf(one).click();
    await vi.waitFor(() => {
      expect(one.classList.contains('drawn')).toBe(true);
    });
    await tick();
    expect(loads()).toBe(1);
    expect(runs(fake.log)).toEqual(['run two', 'run one']);
    expect([svgsIn(one), svgsIn(two), svgsIn(three)]).toEqual([1, 1, 0]);
    expect(three.getAttribute(FIG_STATE)).toBe('on-request');
  });

  it('a second tap on the same figure draws it once', async () => {
    const root = mount(THREE);
    const fake = fakeMermaid();
    const { options } = onRequest(fake);
    await enhance(root, options);
    const one = figuresOf(root)[0] as HTMLElement;
    buttonOf(one).click();
    buttonOf(one).click();
    await vi.waitFor(() => {
      expect(one.classList.contains('drawn')).toBe(true);
    });
    buttonOf(one).click();
    await tick();
    expect(runs(fake.log)).toEqual(['run one']);
  });

  it('a module that is not Mermaid leaves the tapped figure to its load note; the others keep their buttons', async () => {
    const root = mount(THREE);
    let loads = 0;
    await enhance(root, { mermaid: { load: () => ((loads += 1), Promise.resolve({ default: {} })), draw: 'on-request' } });
    const [one, two] = figuresOf(root) as [HTMLElement, HTMLElement];
    buttonOf(one).click();
    await vi.waitFor(() => {
      expect(one.classList.contains('draw-failed')).toBe(true);
    });
    expect(one.querySelector('.fig-error p')?.textContent).toBe(NOTES.load);
    expect(one.getAttribute(FIG_STATE)).toBe('failed');
    expect(two.classList.contains('draw-failed')).toBe(false);
    expect(buttonOf(two).closest('[hidden]')).toBeNull();
    expect(loads).toBe(1);
  });
});

describe('L3.D3: draws run one at a time', () => {
  it('two quick taps: the second draw starts only after the first settles, its button busy meanwhile', async () => {
    const root = mount(THREE);
    const fake = fakeMermaid();
    fake.hold = true;
    const { options } = onRequest(fake);
    await enhance(root, options);
    const [one, two] = figuresOf(root) as [HTMLElement, HTMLElement];
    buttonOf(one).click();
    buttonOf(two).click();
    await vi.waitFor(() => {
      expect(runs(fake.log)).toEqual(['run one']);
    });
    await tick(80);
    // The first is held: the second has not started, and its button says it is busy.
    expect(runs(fake.log)).toEqual(['run one']);
    expect(buttonOf(two).getAttribute('aria-busy')).toBe('true');
    expect(two.getAttribute(FIG_STATE)).toBe('busy');
    expect(buttonOf(one).getAttribute('aria-busy')).toBe('true');
    expect(fake.release()).toBe(true);
    await vi.waitFor(() => {
      expect(runs(fake.log)).toEqual(['run one', 'run two']);
    });
    expect(fake.log.indexOf('done one')).toBeLessThan(fake.log.indexOf('run two'));
    expect(one.classList.contains('drawn')).toBe(true);
    expect(buttonOf(two).getAttribute('aria-busy')).toBe('true');
    expect(fake.release()).toBe(true);
    await vi.waitFor(() => {
      expect(two.classList.contains('drawn')).toBe(true);
    });
    expect(buttonOf(two).hasAttribute('aria-busy')).toBe(false);
  });

  it('a failing figure shows its note and source, and does not block the next', async () => {
    const root = mount(THREE);
    const fake = fakeMermaid(['two']);
    fake.hold = true;
    const { options } = onRequest(fake);
    await enhance(root, options);
    const [, two, three] = figuresOf(root) as [HTMLElement, HTMLElement, HTMLElement];
    buttonOf(two).click();
    buttonOf(three).click();
    await vi.waitFor(() => {
      expect(runs(fake.log)).toEqual(['run two']);
    });
    expect(fake.release()).toBe(true);
    await vi.waitFor(() => {
      expect(runs(fake.log)).toEqual(['run two', 'run three']);
    });
    expect(two.classList.contains('draw-failed')).toBe(true);
    expect(two.getAttribute(FIG_STATE)).toBe('failed');
    expect(two.querySelector('.fig-error p')?.textContent).toBe(NOTES.error);
    expect(two.querySelector('.fig-error pre.fig-src code')?.textContent).toBe('flowchart LR\n  two --> B\n');
    expect(fake.release()).toBe(true);
    await vi.waitFor(() => {
      expect(three.classList.contains('drawn')).toBe(true);
    });
    expect(root.getAttribute(STATE)).toBe('on-request');
  });
});

describe("L3.D4: draw absent is 'auto'; only 'auto' and 'on-request' are accepted", () => {
  it("normalizeOptions: absent and 'auto' give 'auto', 'on-request' is kept", () => {
    const load = (): Promise<unknown> => Promise.resolve(null);
    expect(normalizeOptions({ mermaid: { load } }).mermaid?.draw).toBe('auto');
    expect(normalizeOptions({ mermaid: { load, draw: undefined } }).mermaid?.draw).toBe('auto');
    expect(normalizeOptions({ mermaid: { load, draw: 'auto' } }).mermaid?.draw).toBe('auto');
    expect(normalizeOptions({ mermaid: { load, draw: 'on-request' } }).mermaid?.draw).toBe('on-request');
  });

  it.each([
    ['lazy', 'lazy'],
    ['true', true],
    ['null', null],
    ['an empty string', ''],
    ['On-Request', 'On-Request'],
    ['a number', 1],
    ['an object', { toString: () => 'auto' }],
  ] as [string, unknown][])('refuses %s as invalid-options', (_name, draw) => {
    const load = (): Promise<unknown> => Promise.resolve(null);
    let code = 'accepted';
    try {
      normalizeOptions({ mermaid: { load, draw } });
    } catch (e) {
      code = e instanceof EnhanceError ? `${e.code}: ${e.message}` : `other: ${String(e)}`;
    }
    expect(code).toMatch(/^invalid-options: docreader: mermaid\.draw /);
  });

  it('a refused draw rejects enhance() and leaves the root untouched', async () => {
    const root = mount(THREE);
    const before = root.outerHTML;
    const load = vi.fn(() => Promise.resolve(null));
    await expect(enhance(root, { mermaid: { load, draw: 'lazy' as never } })).rejects.toMatchObject({ code: 'invalid-options' });
    expect(root.outerHTML).toBe(before);
    expect(load).not.toHaveBeenCalled();
  });

  it("draw absent and draw 'auto' draw the same: one load, every figure, the gate and a final state", async () => {
    const outcomes: unknown[] = [];
    for (const extra of [{}, { draw: 'auto' as const }]) {
      const root = mount(THREE);
      const fake = fakeMermaid(['three']);
      let loads = 0;
      await enhance(root, { mermaid: { load: () => ((loads += 1), Promise.resolve(fake.api)), ...extra } });
      expect(root.getAttribute(STATE)).toBe('drawing');
      await vi.waitFor(() => {
        expect(root.getAttribute(STATE)).toBe('partial');
      });
      outcomes.push({
        loads,
        log: fake.log,
        gate: root.hasAttribute(GATE),
        figures: figuresOf(root).map((f) => [f.className, f.getAttribute(FIG_STATE), buttonsOf(f).length]),
      });
      await destroyEnhancement(root);
    }
    expect(outcomes[0]).toEqual(outcomes[1]);
    expect(outcomes[0]).toMatchObject({ loads: 1, gate: true });
  });

  it('the type and the values are the seed\'s (src/frame/seed.ts), held equal', () => {
    expectTypeOf<NonNullable<EnhanceOptions['mermaid']>['draw']>().toEqualTypeOf<MermaidDraw | undefined>();
    expect([...MERMAID_DRAW_VALUES]).toEqual([...MERMAID_DRAW]);
  });
});

describe("the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5)", () => {
  const api = { initialize: (): void => {}, run: (): Promise<void> => Promise.resolve() };

  it("enhanceMermaid passes the seed's caps, secure keys and draw, with a load that answers the registered API", async () => {
    const seed: SeedMermaid = { maxTextSize: 16384, maxEdges: 200, secure: ['themeCSS'], draw: 'on-request' };
    const m = enhanceMermaid(seed, api);
    expect({ ...m, load: typeof m.load }).toEqual({ maxTextSize: 16384, maxEdges: 200, secure: ['themeCSS'], draw: 'on-request', load: 'function' });
    expect(await m.load()).toBe(api);
    const bare = enhanceMermaid({ secure: [], draw: 'auto' }, api);
    expect(Object.keys(bare).sort()).toEqual(['draw', 'load', 'secure']);
  });

  it('what it builds is what L2 accepts: each seed draw reaches the normalized options unchanged', () => {
    for (const draw of MERMAID_DRAW) {
      const n = normalizeOptions({ mermaid: enhanceMermaid({ maxTextSize: 100, secure: ['look'], draw }, api) });
      expect(n.mermaid).toEqual({ maxTextSize: 100, maxEdges: null, secure: ['look'], draw });
    }
  });

  it("ready waits for drawing only in 'auto' mode with Mermaid on", () => {
    expect(waitsForDrawing(null)).toBe(false);
    expect(waitsForDrawing({ secure: [], draw: 'auto' })).toBe(true);
    expect(waitsForDrawing({ secure: [], draw: 'on-request' })).toBe(false);
  });

  it('the bootstrap builds its mermaid option with enhanceMermaid and gates its drawing wait on waitsForDrawing', () => {
    const src = readFileSync(path.join(ROOT, 'src', 'frame-runtime', 'bootstrap.ts'), 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
    expect(src).toMatch(/mermaid:\s*enhanceMermaid\(seed\.mermaid,\s*mermaidModule\)/);
    expect(src).toMatch(/if\s*\(waitsForDrawing\(seed\.mermaid\)\)\s*await diagramsSettled\(root\)/);
    expect(src.match(/diagramsSettled\(root\)/g)).toHaveLength(1);
  });
});

describe('L3.D6: on request, the bootstrap asks for inline style before ready (fix round, review S1; Reference §11.5, ruling R7)', () => {
  it('probesInlineStyle: only with Mermaid on and drawn on request', () => {
    expect(probesInlineStyle(null)).toBe(false);
    expect(probesInlineStyle({ secure: [], draw: 'auto' })).toBe(false);
    expect(probesInlineStyle({ secure: [], draw: 'on-request' })).toBe(true);
  });

  it('probeInlineStyle connects one <style> element with a comment for text and a style attribute (both checks a drawing makes); its remover takes it out once', () => {
    const doc = document.implementation.createHTMLDocument('probe');
    const undo = probeInlineStyle(doc, styleIntrinsics());
    const styles = Array.from(doc.querySelectorAll('style'));
    expect(styles).toHaveLength(1);
    const el = styles[0] as HTMLStyleElement;
    expect(el.isConnected).toBe(true);
    expect(el.parentElement).toBe(doc.documentElement);
    expect(el.textContent).toBe(STYLE_PROBE_TEXT);
    expect(el.getAttribute('style')).toBe(STYLE_PROBE_ATTR);
    // It styles nothing: its text is one comment, and a style element is not rendered.
    expect(STYLE_PROBE_TEXT).toMatch(/^\/\*[^*]*\*\/$/);
    expect(STYLE_PROBE_ATTR).toBe('display:none');
    undo();
    expect(doc.querySelectorAll('style')).toHaveLength(0);
    expect(() => undo()).not.toThrow();
  });

  it('never throws: a built-in that throws probes nothing more, and the remover is still callable', () => {
    const doc = document.implementation.createHTMLDocument('probe');
    const throwing = { ...styleIntrinsics(), createElement: (): Element => { throw new Error('refused'); } };
    let undo: (() => void) | null = null;
    expect(() => {
      undo = probeInlineStyle(doc, throwing);
    }).not.toThrow();
    expect(doc.querySelectorAll('style')).toHaveLength(0);
    expect(() => undo?.()).not.toThrow();
  });

  it('the bootstrap reads the built-ins in Phase S, probes when probesInlineStyle(seed.mermaid) after enhance and before the face probe, and takes the probe out only after the last tick, before the state settles', () => {
    const src = readFileSync(path.join(ROOT, 'src', 'frame-runtime', 'bootstrap.ts'), 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
    const once = (re: RegExp): number => {
      const all = [...src.matchAll(new RegExp(re.source, 'g'))];
      expect(all, String(re)).toHaveLength(1);
      return all[0]?.index ?? -1;
    };
    const intrinsics = once(/const styles = styleIntrinsics\(\);/);
    const phaseS = once(/if \(bs === null\) return;/);
    const enhanced = once(/await enhanceApi\.enhance\(/);
    const probe = once(/const unprobe = probesInlineStyle\(seed\.mermaid\) \? probeInlineStyle\(doc, styles\) : null;/);
    const faces = once(/await probeFaces\(/);
    const tick = once(/later\(resolve, 0\);/);
    const removed = once(/if \(unprobe !== null\) unprobe\(\);/);
    const settles = once(/state = 'settled';/);
    expect(intrinsics).toBeLessThan(phaseS);
    expect(enhanced).toBeLessThan(probe);
    expect(probe).toBeLessThan(faces);
    expect(tick).toBeLessThan(removed);
    expect(removed).toBeLessThan(settles);
  });
});
