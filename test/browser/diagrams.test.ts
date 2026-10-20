// Diagrams in a real browser (docserver L2, Task 21), with the package's own Mermaid file (Task 15), served to the page
// by the harness and imported through the options' load (page/bootstrap.ts), under the `reader` policy: what jsdom
// cannot show, the drawing itself and the figure rules.
//
// - The limits and Mermaid's own secure keys are what 12.1.0 declares, read from the file's defaultConfig (and its
//   default layout is ELK, which the file leaves out: hence the reader's `dagre`, C53).
// - The Level 2 cases of conformance/layout/diagrams/ are opened again here, for what a structural snapshot cannot
//   hold: no style the diagram injects (no element of the figure is fixed, the drawing's style text holds none of its
//   directive's CSS, font or colour), no handler (no `on…` attribute, a click runs nothing, no link runs script), and
//   the fallback where it applies, with its note.
// - The figure rules: under the gate, the source is a transparent placeholder on the plate while its figure is drawn,
//   then hidden; the drawing is laid out but unseen while Mermaid draws into it; a drawn figure shows no source plate
//   and a failed one no blank plate, its note in their place; without Mermaid the source is text on its plate. Two of
//   these need a module that holds the drawing back, so the public entry is bundled here on its own and evaluated in
//   the page, as the services' browser case does, and enhance() is given that module.
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { MAX_EDGES, MAX_TEXT_SIZE, MERMAID_SECURE, NOTES } from '../../src/enhance/diagrams.js';
import { closeBrowsers, describeBrowsers, MERMAID_PATH, mermaidFile, openDoc, type BrowserName, type OpenedDoc } from './harness.js';
import { loadLayoutCases, type LayoutCase } from './layout-cases.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const CASES = new Map(loadLayoutCases().filter((c) => c.id.startsWith('diagrams/')).map((c) => [c.id, c]));

const ENTRY = [
  "import { destroyEnhancement, enhance } from './src/enhance/index.ts';",
  '(window as unknown as { __dg: unknown }).__dg = { enhance, destroyEnhancement };',
].join('\n');

let script = '';

beforeAll(async () => {
  await mermaidFile();
  const r = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'diagrams-entry.ts', loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
  });
  script = r.outputFiles[0]?.text ?? '';
}, 300_000);

afterAll(closeBrowsers);

function caseOf(id: string): LayoutCase {
  const c = CASES.get(id);
  if (c === undefined) throw new Error(`no Level 2 case ${id}`);
  return c;
}

interface FigureReport {
  readonly cls: string;
  readonly figW: string;
  readonly source: { readonly display: string; readonly color: string; readonly minHeight: string; readonly background: string; readonly processed: boolean };
  readonly drawing: {
    readonly display: string;
    readonly visibility: string;
    readonly position: string;
    readonly background: string;
    readonly svg: { readonly role: string | null; readonly label: string | null; readonly width: number; readonly height: number } | null;
  } | null;
  readonly note: { readonly text: string; readonly summary: string; readonly code: string; readonly display: string; readonly height: number } | null;
}

interface Report {
  readonly state: string | null;
  readonly gate: boolean;
  readonly figures: readonly FigureReport[];
  /** Every attribute under the root whose name starts with `on`, as `tag@name`. */
  readonly handlers: readonly string[];
  readonly scripts: number;
  /** Every element of a figure whose computed position is fixed. */
  readonly fixed: readonly string[];
  /** The text of every style element in a drawing. */
  readonly styles: readonly string[];
  /** The href (or xlink:href) of every link in a drawing. */
  readonly links: readonly string[];
  /** The computed font family of every node label in a drawing. */
  readonly labelFonts: readonly string[];
  /** The computed fill of every node's shape in a flowchart drawing. */
  readonly fills: readonly string[];
  /** Every style attribute on an element of a label's own markup (inside a label's p). */
  readonly labelStyles: readonly string[];
}

/** What the page shows of its diagrams now. */
function report(page: Page): Promise<Report> {
  return page.evaluate(() => {
    const root = document.querySelector('main[data-harness-root]') as HTMLElement;
    const figs = Array.from(root.querySelectorAll('figure.mermaid-figure')) as HTMLElement[];
    const chromeAttr = 'data-docreader-chrome';
    const cs = (e: Element): CSSStyleDeclaration => getComputedStyle(e);
    const figures = figs.map((f) => {
      const kids = Array.from(f.children);
      const source = kids.find((k) => k.localName === 'pre' && !k.hasAttribute(chromeAttr)) as HTMLElement;
      const drawing = (kids.find((k) => k.localName === 'pre' && k.hasAttribute(chromeAttr)) as HTMLElement | undefined) ?? null;
      const svg = drawing?.querySelector(':scope > svg') ?? null;
      const note = (kids.find((k) => k.classList.contains('fig-error')) as HTMLElement | undefined) ?? null;
      const box = svg?.getBoundingClientRect();
      return {
        cls: f.className,
        figW: f.style.getPropertyValue('--fig-w'),
        source: { display: cs(source).display, color: cs(source).color, minHeight: cs(source).minHeight, background: cs(source).backgroundColor, processed: source.hasAttribute('data-processed') },
        drawing:
          drawing === null
            ? null
            : {
                display: cs(drawing).display,
                visibility: cs(drawing).visibility,
                position: cs(drawing).position,
                background: cs(drawing).backgroundColor,
                svg: svg === null ? null : { role: svg.getAttribute('role'), label: svg.getAttribute('aria-label'), width: box?.width ?? 0, height: box?.height ?? 0 },
              },
        note:
          note === null
            ? null
            : {
                text: note.querySelector(':scope > p')?.textContent ?? '',
                summary: note.querySelector(':scope > details > summary')?.textContent ?? '',
                code: note.querySelector(':scope > details > pre.fig-src > code')?.textContent ?? '',
                display: cs(note).display,
                height: note.getBoundingClientRect().height,
              },
      };
    });
    const all = Array.from(root.querySelectorAll('*'));
    const drawings = figs.flatMap((f) => Array.from(f.querySelectorAll('pre[data-docreader-chrome] > svg')));
    return {
      state: root.getAttribute('data-docreader-diagrams'),
      gate: root.hasAttribute('data-docreader-mermaid'),
      figures,
      handlers: all.flatMap((e) => Array.from(e.attributes).filter((a) => /^on/i.test(a.name)).map((a) => `${e.localName}@${a.name}`)),
      scripts: root.querySelectorAll('script').length,
      fixed: figs.flatMap((f) => Array.from(f.querySelectorAll('*')).filter((e) => cs(e).position === 'fixed').map((e) => e.localName)),
      styles: drawings.flatMap((s) => Array.from(s.querySelectorAll('style')).map((st) => st.textContent ?? '')),
      links: drawings.flatMap((s) => Array.from(s.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? a.getAttribute('xlink:href') ?? a.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? '')),
      labelFonts: drawings.flatMap((s) => Array.from(s.querySelectorAll('.nodeLabel')).map((l) => cs(l).fontFamily)),
      fills: drawings.flatMap((s) => Array.from(s.querySelectorAll('g.node > rect, g.node > polygon')).map((r) => cs(r).fill)),
      labelStyles: drawings.flatMap((s) => Array.from(s.querySelectorAll('.nodeLabel p *, .edgeLabel p *')).filter((e) => e.hasAttribute('style')).map((e) => e.getAttribute('style') ?? '')),
    };
  });
}

/** Open a Level 2 case as its runner does, drawn (the bootstrap waits for the diagrams), and report. */
async function openCase(browser: BrowserName, id: string): Promise<{ doc: OpenedDoc; got: Report }> {
  const c = caseOf(id);
  const doc = await openDoc(c.markdown, c.options, { browser, csp: c.csp ?? 'strict' });
  try {
    expect(await doc.violations()).toEqual([]);
    expect({ aborted: doc.aborted, missing: doc.missing }).toEqual({ aborted: [], missing: [] });
    return { doc, got: await report(doc.page) };
  } catch (e) {
    await doc.close();
    throw e;
  }
}

/** The warm theme's primary colour (THEME_VARIABLES.primaryColor), as a computed fill. */
const PRIMARY = 'rgb(243, 240, 233)';

/** A computed transparent colour. */
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

/** The plate's colour in the light theme (--plate). */
const PLATE = 'rgb(255, 255, 255)';

/** A figure that failed shows its note, and neither its source nor a drawing. */
function expectFallback(f: FigureReport | undefined, note: string): void {
  if (f === undefined) throw new Error('no figure');
  expect(f.cls).toBe('mermaid-figure draw-failed');
  expect(f.source.display).toBe('none');
  expect(f.drawing === null || f.drawing.display === 'none').toBe(true);
  expect(f.note?.text).toBe(note);
  expect(f.note?.summary).toBe('Show its Mermaid source');
  expect(f.note?.display).toBe('block');
  expect(f.note?.height ?? 0).toBeGreaterThan(20);
  expect(f.figW).toBe('');
}

/** In the page: the public entry, bundled on its own, then enhance() with a Mermaid module the page makes. */
async function enhanceWith(page: Page, module: 'never-loads' | 'never-draws'): Promise<void> {
  await page.evaluate(script);
  await page.evaluate(async (m) => {
    const w = window as unknown as { __dg: { enhance(root: HTMLElement, o: unknown): Promise<void> } };
    const root = document.querySelector('main[data-harness-root]') as HTMLElement;
    // never-draws: Mermaid's API whose run never settles, so the drawing stays where it is while Mermaid draws.
    const api = { initialize: () => undefined, run: () => new Promise(() => undefined) };
    const load = m === 'never-loads' ? () => new Promise(() => undefined) : () => Promise.resolve({ default: api });
    await w.__dg.enhance(root, { mermaid: { load } });
    await document.fonts.ready;
  }, module);
}

/** Two frames and a settle in the page. */
async function frames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 50)));
      }),
  );
}

const FLOW = ['# One figure', '', '```mermaid', 'flowchart LR', '  A[Start] --> B[Stop]', '```', '', '*Figure 1. Start to stop.*', ''].join('\n');

describeBrowsers((browser) => {
  it('pins the limits and Mermaid\'s own secure keys at what 12.1.0 declares, read from the file; its default layout is ELK', async () => {
    const doc = await openDoc(FLOW, {}, { browser, csp: 'reader', mermaid: true });
    try {
      // A string, so the test runner leaves the page's import() alone.
      const got: unknown = await doc.page.evaluate(
        `import(${JSON.stringify(MERMAID_PATH)}).then((m) => { const d = m.default.mermaidAPI.defaultConfig; ` +
          'return { maxTextSize: d.maxTextSize, maxEdges: d.maxEdges, secure: d.secure, layout: d.layout }; })',
      );
      expect(got).toEqual({ maxTextSize: MAX_TEXT_SIZE, maxEdges: MAX_EDGES, secure: [...MERMAID_SECURE], layout: 'elk' });
    } finally {
      await doc.close();
    }
  });

  it('draws a flowchart and a sequence diagram: the drawing on the plate, named, the figure as wide as it, no source plate', async () => {
    const { doc, got } = await openCase(browser, 'diagrams/drawn');
    try {
      expect([got.state, got.gate]).toEqual(['drawn', true]);
      expect(got.figures).toHaveLength(2);
      got.figures.forEach((f, i) => {
        expect(f.cls).toBe('mermaid-figure drawn');
        expect(f.source).toMatchObject({ display: 'none', processed: false });
        expect(f.drawing).toMatchObject({ display: 'block', visibility: 'visible', position: 'static', background: PLATE });
        expect(f.drawing?.svg?.role).toBe('img');
        expect(f.drawing?.svg?.label).toBe(['Figure 1. The flow of one request.', 'Figure 2. One exchange.'][i]);
        expect(f.drawing?.svg?.width ?? 0).toBeGreaterThan(100);
        expect(f.drawing?.svg?.height ?? 0).toBeGreaterThan(50);
        // The drawing's own width, its plate's padding and border: wider than the svg, by at most the plate and a pixel.
        const w = Number.parseFloat(f.figW);
        expect(w - (f.drawing?.svg?.width ?? 0)).toBeGreaterThanOrEqual(50);
        expect(w - (f.drawing?.svg?.width ?? 0)).toBeLessThanOrEqual(53);
        expect(f.note).toBe(null);
      });
      expect(got.handlers).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  it('a directive that restyles is ignored: no fixed element, none of its CSS, font or colours, the reader\'s theme', async () => {
    const { doc, got } = await openCase(browser, 'diagrams/theme-css');
    try {
      expect(got.state).toBe('drawn');
      expect(got.figures[0]?.cls).toBe('mermaid-figure drawn');
      expect(got.fixed).toEqual([]);
      expect(got.styles.length).toBeGreaterThan(0);
      for (const text of got.styles) {
        expect(text).not.toMatch(/fixed|monospace|#ff0000/i);
        expect(text).toContain('Docreader Sans');
      }
      expect(got.labelFonts.length).toBe(2);
      for (const font of got.labelFonts) expect(font).toMatch(/^"?Docreader Sans/);
      expect(got.fills).toEqual([PRIMARY, PRIMARY]);
    } finally {
      await doc.close();
    }
  });

  it('a directive that binds clicks binds nothing: no handler, a click runs nothing, no link runs script', async () => {
    const { doc, got } = await openCase(browser, 'diagrams/click');
    try {
      expect(got.state).toBe('drawn');
      expect(got.handlers).toEqual([]);
      expect(got.links.filter((l) => /^\s*javascript:/i.test(l))).toEqual([]);
      await doc.page.evaluate(() => {
        (window as unknown as { hit: () => void }).hit = () => {
          (window as unknown as { __hit: number }).__hit = 1;
        };
      });
      for (const n of await doc.page.locator('main[data-harness-root] figure g.node').all()) await n.click();
      await frames(doc.page);
      expect(await doc.page.evaluate(() => (window as unknown as { __hit?: number }).__hit)).toBe(undefined);
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  });

  it('an HTML label keeps its text and loses its handler, its script, its style element and its style attribute', async () => {
    const { doc, got } = await openCase(browser, 'diagrams/html-label');
    try {
      expect(got.state).toBe('drawn');
      expect(got.handlers).toEqual([]);
      expect(got.scripts).toBe(0);
      expect(got.fixed).toEqual([]);
      expect(got.labelStyles).toEqual([]);
      const labels = await doc.page.evaluate(() =>
        Array.from(document.querySelectorAll('main[data-harness-root] .nodeLabel')).map((l) => (l.textContent ?? '').replace(/\s+/g, ' ').trim()),
      );
      expect(labels).toEqual(['bold text', 'after', 'styled', 'last']);
      await doc.page.locator('main[data-harness-root] .nodeLabel b').first().hover();
      expect(await doc.page.evaluate(() => (window as unknown as { __hit?: number }).__hit)).toBe(undefined);
    } finally {
      await doc.close();
    }
  });

  it('a source over maxTextSize is never handed to Mermaid: the fallback says it is too long', async () => {
    const { doc, got } = await openCase(browser, 'diagrams/too-long');
    try {
      expect(got.state).toBe('failed');
      expectFallback(got.figures[0], NOTES.long);
      expect(got.figures[0]?.drawing).toBe(null);
      expect(got.figures[0]?.note?.code).toBe(caseOf('diagrams/too-long').markdown.split('```mermaid\n')[1]?.split('```')[0]);
    } finally {
      await doc.close();
    }
  });

  it('edges over maxEdges fail, a directive cannot raise the limit, and the fallback shows', async () => {
    const { doc, got } = await openCase(browser, 'diagrams/edges');
    try {
      expect(got.state).toBe('failed');
      expectFallback(got.figures[0], NOTES.error);
      expect(got.figures[0]?.drawing?.svg ?? null).toBe(null);
    } finally {
      await doc.close();
    }
  });

  it('a diagram that asks for ELK fails, the file leaving it out, and the fallback shows', async () => {
    const { doc, got } = await openCase(browser, 'diagrams/elk');
    try {
      expect(got.state).toBe('failed');
      expectFallback(got.figures[0], NOTES.error);
    } finally {
      await doc.close();
    }
  });

  it('while Mermaid loads, the source is the transparent placeholder on its plate, and nothing is drawn yet', async () => {
    const doc = await openDoc(FLOW, {}, { browser, csp: 'reader', enhance: false });
    try {
      await enhanceWith(doc.page, 'never-loads');
      await frames(doc.page);
      const got = await report(doc.page);
      expect([got.state, got.gate]).toEqual(['drawing', true]);
      expect(got.figures[0]?.cls).toBe('mermaid-figure');
      expect(got.figures[0]?.source).toMatchObject({ display: 'block', color: TRANSPARENT, minHeight: '180px', background: PLATE });
      expect(got.figures[0]?.drawing).toBe(null);
    } finally {
      await doc.close();
    }
  });

  it('while Mermaid draws, the drawing is laid out but unseen, and the source is still the placeholder', async () => {
    const doc = await openDoc(FLOW, {}, { browser, csp: 'reader', enhance: false });
    try {
      await enhanceWith(doc.page, 'never-draws');
      await doc.page.waitForFunction(() => document.querySelector('main[data-harness-root] figure > pre[data-docreader-chrome]') !== null);
      await frames(doc.page);
      const got = await report(doc.page);
      expect(got.state).toBe('drawing');
      expect(got.figures[0]?.source).toMatchObject({ display: 'block', color: TRANSPARENT, minHeight: '180px' });
      expect(got.figures[0]?.drawing).toMatchObject({ display: 'block', visibility: 'hidden', position: 'absolute' });
    } finally {
      await doc.close();
    }
  });

  it('without Mermaid, a figure\'s source is text on its plate: no gate, no state', async () => {
    const doc = await openDoc(FLOW, {}, { browser, csp: 'reader' });
    try {
      const got = await report(doc.page);
      expect([got.state, got.gate]).toEqual([null, false]);
      expect(got.figures[0]?.source.color).not.toBe(TRANSPARENT);
      expect(got.figures[0]?.source).toMatchObject({ display: 'block', background: PLATE });
      expect(got.figures[0]?.drawing).toBe(null);
    } finally {
      await doc.close();
    }
  });
});
