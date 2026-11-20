// A hosted drawing, with the real bundled Mermaid, in a real browser (docserver appearance plan, Task 7; the first consumer's
// design, section 10, "Mermaid while hosted" and "Mermaid on a change"): the reader's half of test 5 that jsdom's fake
// Mermaid cannot show. With colours, a flowchart and a sequence diagram are classified by the bundled `parse`, drawn with
// the derived theme and marked on their svg (`data-docreader-hosted-figure`); a `journey` (outside the constant) and an
// author-styled flowchart keep 1.1.0's drawing and carry no mark. A drawn hosted flowchart has no computed filter on any
// element and its nodes are filled `surface2`; its definition cues take the verdict's focus and accent. An appearance
// op then redraws it in place in the new colours (one chrome pre, a new svg), and an op with no colours redraws it as
// 1.1.0 draws it. The driver is the public entry, bundled on its own, as test/browser/diagrams.test.ts does.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { closeBrowsers, describeBrowsers, MERMAID_PATH, mermaidFile, openDoc, type BrowserName } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FIXTURES = JSON.parse(readFileSync(path.join(ROOT, 'conformance', 'appearance', 'fixtures.json'), 'utf8')) as { name: string; mode: 'light' | 'dark'; colour: Record<string, string> }[];
const fixture = (name: string): { mode: 'light' | 'dark'; colour: Record<string, string> } => FIXTURES.find((f) => f.name === name)!;
const DARK = fixture('Phosphor & Ink');
const LIGHT = fixture('Phosphor Daylight');

/** `#rrggbb` as the browser reports a computed colour. */
const rgb = (hex: string): string => `rgb(${[1, 3, 5].map((i) => String(parseInt(hex.slice(i, i + 2), 16))).join(', ')})`;

const DOC = [
  '# Hosted drawings',
  '',
  '## 1. Words used here',
  '',
  '| Term | Meaning |',
  '|---|---|',
  '| Widget | A neutral thing |',
  '',
  '```mermaid',
  'flowchart LR',
  '  A[Widget] --> B[Plain]',
  '```',
  '',
  '*Figure 1. A plain flowchart.*',
  '',
  '```mermaid',
  'sequenceDiagram',
  '  participant Alice',
  '  participant Bob',
  '  loop Every minute',
  '    Alice->>Bob: ping',
  '  end',
  '  Alice-\\\\Bob: stick',
  '```',
  '',
  '*Figure 2. A sequence diagram.*',
  '',
  '```mermaid',
  'journey',
  '  title A day',
  '  section Work',
  '    Task: 3: Me',
  '```',
  '',
  '*Figure 3. A journey, outside the constant.*',
  '',
  '```mermaid',
  'flowchart LR',
  '  C --> D',
  '  style C fill:#D4EDDA',
  '```',
  '',
  '*Figure 4. An author-styled flowchart.*',
  '',
].join('\n');

const ENTRY = [
  "import { destroyEnhancement, enhance, setEnhancementAppearance } from './src/enhance/index.ts';",
  '(window as unknown as { __dg: unknown }).__dg = { enhance, destroyEnhancement, setEnhancementAppearance };',
].join('\n');

let script = '';

beforeAll(async () => {
  await mermaidFile();
  const r = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'appearance-mermaid-entry.ts', loader: 'ts' },
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

interface Seen {
  /** Per figure: the svg's id, its mark, its chrome pre count, and a node's computed fill (the first node or rect). */
  readonly figures: readonly { readonly id: string; readonly mark: boolean; readonly pres: number; readonly fill: string }[];
  /** Every rendered element of a marked drawing whose computed filter is not `none`. */
  readonly filters: readonly string[];
  /** The first definition ring and dot's computed paint, when painted. */
  readonly cue: { readonly stroke: string; readonly fill: string; readonly dotStroke: string } | null;
  readonly state: string | null;
  /** The sequence figure's first message text: its computed stroke and stroke width (the halo). */
  readonly halo: { readonly stroke: string; readonly width: string } | null;
  /** The computed stroke of every marker path that Mermaid strokes `black` (the stick half arrowheads), in the figure. */
  readonly sticks: readonly string[];
  /** The full-screen overlay's stage background and its svg's mark, computed filter and sticks, when open. */
  readonly overlay: { readonly plate: string; readonly mark: boolean; readonly filter: string; readonly sticks: readonly string[] } | null;
}

const read = (page: Page): Promise<Seen> =>
  page.evaluate(() => {
    const root = document.querySelector('main[data-harness-root]') as HTMLElement;
    const figs = Array.from(root.querySelectorAll('figure.mermaid-figure'));
    const chrome = 'data-docreader-chrome';
    const figures = figs.map((f) => {
      const pres = Array.from(f.children).filter((c) => c.localName === 'pre' && c.hasAttribute(chrome));
      const svg = pres[0]?.querySelector('svg') ?? null;
      const node = svg?.querySelector('g.node rect, g.node path, rect.actor, .actor, rect') ?? null;
      return { id: svg?.id ?? '', mark: svg?.hasAttribute('data-docreader-hosted-figure') ?? false, pres: pres.length, fill: node === null ? '' : getComputedStyle(node).fill };
    });
    const filters: string[] = [];
    for (const svg of Array.from(root.querySelectorAll('svg[data-docreader-hosted-figure]'))) {
      for (const el of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
        const filter = getComputedStyle(el).filter;
        if (filter !== 'none' && getComputedStyle(el).display !== 'none') filters.push(`${el.localName}:${filter}`);
      }
    }
    const ring = root.querySelector('.dn-ring');
    const dot = root.querySelector('.dn-dot');
    const cue = ring === null || dot === null ? null : { stroke: getComputedStyle(ring).stroke, fill: getComputedStyle(dot).fill, dotStroke: getComputedStyle(dot).stroke };
    const text = root.querySelector('figure.mermaid-figure svg .messageText');
    const sticks = (scope: Element): string[] => Array.from(scope.querySelectorAll('marker path[stroke="black"]')).map((p) => getComputedStyle(p).stroke);
    const stage = root.querySelector('.fig-overlay.open .fo-stage');
    const staged = stage?.querySelector('svg') ?? null;
    return {
      figures,
      filters,
      cue,
      state: root.getAttribute('data-docreader-diagrams'),
      halo: text === null ? null : { stroke: getComputedStyle(text).stroke, width: getComputedStyle(text).strokeWidth },
      sticks: sticks(figs[1] as Element),
      overlay: stage === null || staged === null ? null : { plate: getComputedStyle(stage).backgroundColor, mark: staged.hasAttribute('data-docreader-hosted-figure'), filter: getComputedStyle(staged).filter, sticks: sticks(staged) },
    };
  });

describeBrowsers((browser: BrowserName) => {
  it('draws a covered, plain figure in the host\'s colours with the mark, and no other; an op redraws it in place, then back', async () => {
    const doc = await openDoc(DOC, {}, { browser, csp: 'reader', enhance: false, mermaid: true });
    try {
      await doc.page.evaluate(script);
      await doc.page.evaluate(
        `(async () => {
          const root = document.querySelector('main[data-harness-root]');
          const load = () => import(${JSON.stringify(MERMAID_PATH)});
          await window.__dg.enhance(root, { mermaid: { load }, appearance: ${JSON.stringify({ mode: DARK.mode, colour: DARK.colour })} });
          while (root.getAttribute('data-docreader-diagrams') !== 'drawn') await new Promise((r) => setTimeout(r, 20));
        })()`,
      );
      const first = await read(doc.page);
      // The kinds are the bundled parse's: flowchart and sequence are covered, a journey and an author-styled flowchart are not.
      expect(first.figures.map((f) => f.mark)).toEqual([true, true, false, false]);
      expect(first.figures.map((f) => f.pres)).toEqual([1, 1, 1, 1]);
      expect(first.figures[0]!.fill).toBe(rgb(DARK.colour['surface2']!));
      expect(first.filters).toEqual([]);
      // The rules no theme key reaches: the stick arrowheads in text-muted, the 3px surface halo on the crossed labels.
      expect(first.sticks.length).toBeGreaterThan(0);
      expect(new Set(first.sticks)).toEqual(new Set([rgb(DARK.colour['text-muted']!)]));
      expect(first.halo).toEqual({ stroke: rgb(DARK.colour['surface']!), width: '3px' });
      await doc.page.waitForFunction(() => document.querySelector('.dn-ring') !== null && document.querySelector('.dn-dot') !== null);
      const cues = (await read(doc.page)).cue!;
      expect(cues).toEqual({ stroke: rgb(DARK.colour['focus']!), fill: rgb(DARK.colour['accent']!), dotStroke: rgb(DARK.colour['bg']!) });

      // An op in the daylight palette: each covered figure is redrawn in place, nearest first, one per task.
      await doc.page.evaluate((a) => (window as unknown as { __dg: { setEnhancementAppearance(r: Element, a: unknown): void } }).__dg.setEnhancementAppearance(document.querySelector('main[data-harness-root]') as Element, a), {
        mode: LIGHT.mode,
        colour: LIGHT.colour,
      });
      await doc.page.waitForFunction(
        (ids) => {
          const svgs = Array.from(document.querySelectorAll('figure.mermaid-figure pre[data-docreader-chrome] > svg'));
          return svgs.length === 4 && svgs.slice(0, 2).every((s, i) => s.id !== ids[i]);
        },
        first.figures.map((f) => f.id),
      );
      await doc.page.waitForFunction((fill) => {
        const svg = document.querySelector('figure.mermaid-figure pre[data-docreader-chrome] > svg');
        const node = svg?.querySelector('g.node rect, g.node path');
        return node !== null && node !== undefined && getComputedStyle(node).fill === fill;
      }, rgb(LIGHT.colour['surface2']!));
      await doc.page.waitForFunction(() => {
        const ring = document.querySelector('.dn-ring');
        return ring !== null;
      });
      const second = await read(doc.page);
      expect(second.figures.map((f) => f.mark)).toEqual([true, true, false, false]);
      expect(second.figures.map((f) => f.pres)).toEqual([1, 1, 1, 1]); // in place: no second chrome node
      expect(second.figures[0]!.id).not.toBe(first.figures[0]!.id);
      expect(second.figures[2]!.id).toBe(first.figures[2]!.id); // the figures outside the constant are not redrawn
      expect(second.figures[3]!.id).toBe(first.figures[3]!.id);
      expect(second.filters).toEqual([]);
      await doc.page.waitForFunction((stroke) => getComputedStyle(document.querySelector('.dn-ring') as Element).stroke === stroke, rgb(LIGHT.colour['focus']!));
      expect(await doc.page.evaluate(() => document.querySelectorAll('figure.mermaid-figure.drawn').length)).toBe(4);
      expect(await doc.page.evaluate(() => document.querySelectorAll('figure .tools').length)).toBe(4);

      // An op with no colours: the covered figures are redrawn as 1.1.0 draws them, with no mark.
      await doc.page.evaluate((a) => (window as unknown as { __dg: { setEnhancementAppearance(r: Element, a: unknown): void } }).__dg.setEnhancementAppearance(document.querySelector('main[data-harness-root]') as Element, a), { mode: 'light' });
      await doc.page.waitForFunction(() => document.querySelectorAll('svg[data-docreader-hosted-figure]').length === 0 && document.querySelectorAll('figure.mermaid-figure pre[data-docreader-chrome] > svg').length === 4);
      const third = await read(doc.page);
      expect(third.figures.map((f) => f.pres)).toEqual([1, 1, 1, 1]);
      expect(third.figures[0]!.fill).toBe('rgb(243, 240, 233)'); // 1.1.0's primaryColor, #f3f0e9
      expect(await doc.violations()).toEqual([]);
    } finally {
      await doc.close();
    }
  }, 180_000);

  it('the full-screen copy of a hosted figure keeps the mark: the surface plate, no filter, the stick arrowheads in text-muted', async () => {
    const doc = await openDoc(DOC, {}, { browser, csp: 'reader', enhance: false, mermaid: true });
    try {
      await doc.page.evaluate(script);
      await doc.page.evaluate(
        `(async () => {
          const root = document.querySelector('main[data-harness-root]');
          const load = () => import(${JSON.stringify(MERMAID_PATH)});
          await window.__dg.enhance(root, { mermaid: { load }, appearance: ${JSON.stringify({ mode: DARK.mode, colour: DARK.colour })} });
          while (root.getAttribute('data-docreader-diagrams') !== 'drawn') await new Promise((r) => setTimeout(r, 20));
        })()`,
      );
      await doc.page.locator('main[data-harness-root] figure.mermaid-figure').nth(1).locator('.tools button', { hasText: 'Full screen' }).click();
      await doc.page.waitForSelector('.fig-overlay.open .fo-stage svg');
      const seen = (await read(doc.page)).overlay!;
      expect(seen.mark).toBe(true);
      expect(seen.plate).toBe(rgb(DARK.colour['surface']!));
      expect(seen.filter).toBe('none');
      expect(seen.sticks.length).toBeGreaterThan(0);
      expect(new Set(seen.sticks)).toEqual(new Set([rgb(DARK.colour['text-muted']!)]));
    } finally {
      await doc.close();
    }
  }, 120_000);

  /** Four flowcharts a long way apart, so only the one the reader is at is in view. */
  const FAR = [
    '# Far apart',
    '',
    ...[1, 2, 3, 4].flatMap((n) => [
      ...Array.from({ length: 36 }, (_, i) => `Paragraph ${String(n)}.${String(i)}: some text to take up the height between the figures, long enough to wrap on a narrow page and so to fill it.\n`),
      '```mermaid',
      'flowchart LR',
      `  F${String(n)} --> X${String(n)}`,
      '```',
      '',
      `*Figure ${String(n)}. Figure ${String(n)}.*`,
      '',
    ]),
  ].join('\n');

  /** The page's load: the bundled Mermaid, whose `render` is held while `window.__hold` is set (released by `window.__release()`). */
  const HOLDING_LOAD = `async () => {
    const m = (await import(${JSON.stringify(MERMAID_PATH)})).default;
    return { default: {
      initialize: (c) => m.initialize(c),
      parse: (t) => m.parse(t),
      render: (...a) => window.__hold ? new Promise((res) => { window.__release = () => { window.__release = undefined; res(m.render(...a)); }; }) : m.render(...a),
    } };
  }`;

  const boot = async (doc: Awaited<ReturnType<typeof openDoc>>, appearance: unknown): Promise<void> => {
    await doc.page.evaluate(script);
    await doc.page.evaluate(
      `(async () => {
        const root = document.querySelector('main[data-harness-root]');
        await window.__dg.enhance(root, { mermaid: { load: ${HOLDING_LOAD} }, appearance: ${JSON.stringify(appearance)} });
        while (root.getAttribute('data-docreader-diagrams') !== 'drawn') await new Promise((r) => setTimeout(r, 20));
      })()`,
    );
  };
  const op = (page: Page, a: unknown): Promise<void> =>
    page.evaluate((v) => (window as unknown as { __dg: { setEnhancementAppearance(r: Element, a: unknown): void } }).__dg.setEnhancementAppearance(document.querySelector('main[data-harness-root]') as Element, v), a);

  it('redraws nearest first in a real browser: the figure the reader is at first, then outward', async () => {
    const doc = await openDoc(FAR, {}, { browser, csp: 'reader', enhance: false, mermaid: true, viewport: { width: 1200, height: 700 } });
    try {
      await boot(doc, { mode: DARK.mode, colour: DARK.colour });
      await doc.page.evaluate(() => {
        const w = window as unknown as { __order: number[] };
        w.__order = [];
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const figs = Array.from(root.querySelectorAll('figure.mermaid-figure'));
        // A new drawing lands in a figure's own pre (a replacement's temporary pre is not the figure's).
        new MutationObserver((records) => {
          for (const r of records) for (const n of Array.from(r.addedNodes)) {
            const pre = (n as Element).localName === 'svg' && r.target.nodeType === 1 ? (r.target as Element) : null;
            if (pre !== null && pre.localName === 'pre' && !pre.hasAttribute('data-docreader-redraw')) w.__order.push(figs.indexOf(pre.parentElement as Element));
          }
        }).observe(root, { childList: true, subtree: true });
        window.scrollTo(0, document.documentElement.scrollHeight);
      });
      // The reader is at the last figure; wait for the scroll to settle, and for the figures' drawings to be where they are.
      await doc.page.waitForFunction(() => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2);
      await op(doc.page, { mode: LIGHT.mode, colour: LIGHT.colour });
      await doc.page.waitForFunction(() => (window as unknown as { __order: number[] }).__order.length >= 4);
      await new Promise((r) => setTimeout(r, 500));
      expect(await doc.page.evaluate(() => (window as unknown as { __order: number[] }).__order)).toEqual([3, 2, 1, 0]);
    } finally {
      await doc.close();
    }
  }, 180_000);

  it('a redraw in flight is not seen: the temporary pre is hidden and nothing below it moves', async () => {
    const doc = await openDoc(DOC, {}, { browser, csp: 'reader', enhance: false, mermaid: true });
    try {
      await boot(doc, { mode: DARK.mode, colour: DARK.colour });
      const geometry = (): Promise<{ tops: number[]; temp: { visibility: string; position: string; pointer: string } | null }> =>
        doc.page.evaluate(() => {
          const figs = Array.from(document.querySelectorAll('main[data-harness-root] figure.mermaid-figure'));
          const temp = document.querySelector('figure.mermaid-figure > pre[data-docreader-redraw]');
          const cs = temp === null ? null : getComputedStyle(temp);
          return { tops: figs.map((f) => f.getBoundingClientRect().top + window.scrollY), temp: cs === null ? null : { visibility: cs.visibility, position: cs.position, pointer: cs.pointerEvents } };
        });
      const before = await geometry();
      await doc.page.evaluate(() => ((window as unknown as { __hold: boolean }).__hold = true));
      await op(doc.page, { mode: LIGHT.mode, colour: LIGHT.colour });
      await doc.page.waitForFunction(() => (window as unknown as { __release?: unknown }).__release !== undefined && document.querySelector('pre[data-docreader-redraw]') !== null);
      const during = await geometry();
      expect(during.temp).toEqual({ visibility: 'hidden', position: 'absolute', pointer: 'none' });
      expect(during.tops).toEqual(before.tops);
      await doc.page.evaluate(() => {
        (window as unknown as { __hold: boolean; __release: () => void }).__hold = false;
        (window as unknown as { __release: () => void }).__release();
      });
      await doc.page.waitForFunction(() => document.querySelector('pre[data-docreader-redraw]') === null);
    } finally {
      await doc.close();
    }
  }, 180_000);

  // Chromium only: it counts live objects through the DevTools protocol's heap, which WebKit's driver does not offer. The
  // engine-independent half is test/enhance-appearance-mermaid.test.ts, where every replaced svg is collected after gc.
  it.skipIf(browser !== 'chromium')('keeps no replaced drawing alive: the live svg objects stay bounded across many changes', async () => {
    const doc = await openDoc(DOC, {}, { browser, csp: 'reader', enhance: false, mermaid: true, viewport: { width: 1200, height: 700 } });
    try {
      await boot(doc, { mode: DARK.mode, colour: DARK.colour });
      const cdp = await doc.page.context().newCDPSession(doc.page);
      const count = async (): Promise<number> => {
        await cdp.send('HeapProfiler.collectGarbage');
        const proto = await cdp.send('Runtime.evaluate', { expression: 'SVGSVGElement.prototype' });
        const objs = await cdp.send('Runtime.queryObjects', { prototypeObjectId: proto.result.objectId as string });
        const n = await cdp.send('Runtime.callFunctionOn', { objectId: objs.objects.objectId as string, functionDeclaration: 'function(){return this.length}', returnByValue: true });
        return n.result.value as number;
      };
      const ids = (): Promise<string[]> => doc.page.evaluate(() => Array.from(document.querySelectorAll('figure.mermaid-figure pre[data-docreader-chrome] > svg')).map((s) => s.id));
      await doc.page.waitForFunction(() => document.querySelector('.dn-ring') !== null);
      await new Promise((r) => setTimeout(r, 1000));
      const before = await count();
      for (let i = 0; i < 8; i += 1) {
        const was = await ids();
        await op(doc.page, i % 2 === 0 ? { mode: LIGHT.mode, colour: LIGHT.colour } : { mode: DARK.mode, colour: DARK.colour });
        await doc.page.waitForFunction((old) => {
          const now = Array.from(document.querySelectorAll('figure.mermaid-figure pre[data-docreader-chrome] > svg')).map((s) => s.id);
          return now.length === old.length && now.slice(0, 2).every((x, j) => x !== old[j]);
        }, was, { timeout: 60_000 });
        await new Promise((r) => setTimeout(r, 300));
      }
      await new Promise((r) => setTimeout(r, 1000));
      const after = await count();
      // Each op replaces two drawings: kept ones would add about sixteen; a few objects of slack for what the page itself holds.
      expect(after - before).toBeLessThanOrEqual(3);
    } finally {
      await doc.close();
    }
  }, 240_000);
});
