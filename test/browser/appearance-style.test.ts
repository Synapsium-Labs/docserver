// Test 4 of the appearance contract (docserver appearance plan, Task 6; design A4 and A6; the first consumer's
// appearance-continuity design, sections 5 and 10, test 4), in a real browser. Three rows:
//
//  (a) NO APPEARANCE, EQUAL TO 1.1.0. For every corpus document (the golden and hostile documents of
//      conformance/corpus, the cases of conformance/layout, and one document with a drawn figure) and for the
//      representative interactive states (each popover open in turn: Aa, the changes menu, a cross-reference card, a
//      term card, quick jump, the keys sheet and the contents drawer; the figure overlay open; a figure tool pressed;
//      text selected; a narrow window; and, on Chromium, `:hover` and `:focus-visible` forced on every control and table
//      row), the computed values of a fixed property list (PROPS) on every element, and on its `::before` and `::after`
//      that draw content (and on `::selection` while text is selected), are read in two pages that differ only in the
//      stylesheet they are served: the current one, and `git show v1.1.0:assets/reader.css`, read at test time. The
//      DOM is the same with no appearance, so the elements are compared in document order. A missing tag FAILS (A6).
//      A self-test row proves the comparison goes red on a stylesheet that differs.
//  (b) PAIRS. With each of the twelve fixture appearances (conformance/appearance/fixtures.json), applied through the
//      `appearance` option: every pair of APPEARANCE_PAIRS meets its floor, on the fixture's slot values with the
//      stylesheet's `color-mix` arithmetic (8-bit rounding) in this file, and every pair the rendered documents draw (a
//      text element's computed colour on its nearest painted ground) meets its floor on computed values.
//  (c) CLOSED GROUNDS. With a fixture applied, under the same states: every element that holds text has a nearest
//      painted background that is one of section 5's grounds (`bg`, `surface`, `surface2`, the five tints, `code-block-bg`,
//      `accent`), computed from the fixture's slot values, and a computed `color` that ground admits (APPEARANCE_PAIRS,
//      checked against an independent product of section 5's table). Selected text is `accent-ink` on `accent`. A failure
//      names each offending element: its selector path, colour and ground. DOCREADER_STYLE_REPORT=<file> also writes the
//      whole list there.
//
// What is left out, and why:
//  - Text inside an SVG (a Mermaid drawing's labels): test 5 covers those. The figure's own chrome (tools, overlay, bar)
//    is checked.
//  - The forced `:hover` and `:focus-visible` states run on Chromium only: they use the DevTools protocol's
//    CSS.forcePseudoState, which WebKit has no equivalent of here.
//  - Layout cases that draw Mermaid (options hold `mermaid`) are left out of the sweeps, for cost: they load the
//    Mermaid bundle per page. The drawn figure's chrome is covered by the one document with a static drawing.
//  - (b) and (c) read every document under two appearances (a dark and a light one) at rest and with text selected, and the
//    representative documents (REPRESENTATIVE) in every state under all twelve; the full sweep of every state over every
//    document is (a)'s, which does not depend on a fixture.
//  - The changes menu needs a `changes` callback: the harness page turns a `changes` option given as data into one
//    (page/bootstrap.ts), and one synthetic document uses it.
//  - Opacity above an element is read as shown or not shown (a product of zero is skipped); a partial opacity is not
//    blended into the pair. Text under an ancestor `background-image` is reported as an image ground.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { CDPSession, Page } from 'playwright-core';
import { afterAll, describe, expect, it } from 'vitest';
import { APPEARANCE_PAIRS, type AppearanceColourSlot } from '../../src/enhance/appearance.js';
import { render } from '../../src/render/index.js';
import { corpusDocuments, ROOT } from './frame-shared.js';
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName, type OpenedDoc } from './harness.js';
import { loadLayoutCases } from './layout-cases.js';

afterAll(closeBrowsers);

// ───────── the stylesheets ─────────

const TAG = 'v1.1.0';
let tagged: string | undefined;

/** The 1.1.0 stylesheet, `git show v1.1.0:assets/reader.css`. A checkout without the tag throws: the row fails, never skips. */
function v110(): string {
  if (tagged !== undefined) return tagged;
  try {
    tagged = execFileSync('git', ['show', `${TAG}:assets/reader.css`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    throw new Error(`the ${TAG} tag is not in this checkout (CI fetches full history with tags; locally: git fetch --tags): ${e instanceof Error ? e.message : String(e)}`);
  }
  return tagged;
}

// ───────── the documents ─────────

interface Doc {
  readonly id: string;
  readonly markdown: string;
  readonly options: Readonly<Record<string, unknown>>;
  readonly viewport: { readonly width: number; readonly height: number } | undefined;
  readonly csp: 'strict' | 'reader' | undefined;
  readonly html: ((html: string) => string) | undefined;
}

/** A static drawing, as the viewer tests inject one: the figure's tools, its overlay and a pressable tool need an SVG. */
const FIGURE_MARKDOWN = ['# Figure', '', '## Decisions', '', '| ID | Decision | Status |', '|---|---|---|', '| D1 | Keep the diagram definition available | Agreed |', ''].join('\n');
const DRAWING = '<figure class="mermaid-figure"><pre class="mermaid">flowchart LR\n  A --> B</pre><pre class="mermaid" data-docreader-chrome><svg id="viewer-source" viewBox="0 0 240 100"><g class="node dnode" id="flowchart-A-0" data-ref="D1" tabindex="0" role="button"><rect width="80" height="30"/><text>D1</text></g><g class="node" id="flowchart-B-1"><rect x="140" width="80" height="30"/></g><path class="flowchart-link" data-id="L_A_B_0" d="M80 15H140"/></svg></pre><figcaption>Figure 1. Diagram.</figcaption></figure>';

function allDocs(): Doc[] {
  const corpus: Doc[] = corpusDocuments()
    .filter((d) => render(d.markdown).outcome === 'rendered')
    .map((d) => ({ id: `corpus/${d.id}`, markdown: d.markdown, options: {}, viewport: undefined, csp: undefined, html: undefined }));
  const layout: Doc[] = loadLayoutCases()
    .filter((c) => !Object.hasOwn(c.options, 'mermaid'))
    .map((c) => ({ id: `layout/${c.id}`, markdown: c.markdown, options: c.options, viewport: c.viewport, csp: c.csp, html: undefined }));
  const since = layout.find((d) => d.id === 'layout/since/menu') as Doc;
  // The changes menu needs a `changes` callback; the harness page turns a `changes` given as data into one (page/bootstrap.ts).
  const menu: Doc = { ...since, id: 'synthetic/changes-menu', options: { ...since.options, changes: { changed: [[1, 1]] } } };
  const figure: Doc = { id: 'synthetic/figure', markdown: FIGURE_MARKDOWN, options: {}, viewport: undefined, csp: 'strict', html: (h) => `${h}${DRAWING}` };
  return [...corpus, ...layout, menu, figure];
}

/** The documents every fixture appearance is run on: between them every chrome piece, mark, card, table and code block. */
const REPRESENTATIVE: readonly string[] = [
  'corpus/spec-template', 'corpus/tables', 'corpus/alerts', 'corpus/lists-tasks', 'corpus/footnotes',
  'layout/changes/rules', 'layout/changes/strip', 'synthetic/changes-menu', 'layout/cards/xrefs', 'layout/rail/marks-index',
  'layout/rail/drawer', 'layout/plans/plan', 'layout/ids/id-table', 'layout/blocks/code', 'layout/settings/attention',
  'layout/jump/dialogs', 'layout/blocks/filter', 'layout/figures/captions', 'synthetic/figure',
];

// ───────── the browser side ─────────

interface St {
  els: Element[];
  pathOf(e: Element, depth?: number): string;
  parse(s: string): number[] | null;
  over(top: number[], bottom: number[]): number[];
  /** Finish every transition and animation, in the task that then reads: nothing starts one between. */
  finish(): void;
}

/** Install the helpers every in-page function below shares, once per page. */
async function helpers(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __st?: St };
    if (w.__st !== undefined) return;
    const tok = (s: string, scale: number): number => (s.endsWith('%') ? (parseFloat(s) / 100) * scale : parseFloat(s));
    const parse = (s: string): number[] | null => {
      const m = /^(rgba?|color)\((.*)\)$/.exec(s.trim());
      if (m === null) return null;
      let body = m[2] ?? '';
      const srgb = m[1] === 'color';
      if (srgb) {
        if (!body.startsWith('srgb ')) return null;
        body = body.slice(5);
      }
      const p = body.split(/[\s,/]+/).filter(Boolean);
      if (p.length < 3) return null;
      const rgb = p.slice(0, 3).map((t) => (srgb ? tok(t, 1) * 255 : tok(t, 255)));
      const a = p.length > 3 ? tok(p[3] as string, 1) : 1;
      return [...rgb, a].some((n) => Number.isNaN(n)) ? null : [...rgb, a];
    };
    const over = (t: number[], b: number[]): number[] => {
      const at = t[3] as number;
      const ab = b[3] as number;
      const ao = at + ab * (1 - at);
      if (ao === 0) return [0, 0, 0, 0];
      return [0, 1, 2].map((i) => ((t[i] as number) * at + (b[i] as number) * ab * (1 - at)) / ao).concat([ao]);
    };
    const seg = (e: Element): string => {
      const c = (e.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
      return e.localName + (c.length > 0 ? `.${c.join('.')}` : '');
    };
    const pathOf = (e: Element, depth = 4): string => {
      const parts: string[] = [];
      for (let x: Element | null = e; x !== null && parts.length < depth; x = x.parentElement) parts.unshift(seg(x));
      return parts.join(' > ');
    };
    const finish = (): void => {
      void document.body.offsetWidth;
      for (const a of document.getAnimations()) {
        try {
          a.finish();
        } catch {
          /* an infinite animation cannot finish */
        }
      }
    };
    // No transition or animation runs in a page this file reads (the same rule in both pages of a comparison, adopted
    // through the CSSOM, which the strict policy allows): Chromium keeps a highlight pseudo-element's colour from the
    // moment it was styled, so a transition under a selection would make two pages disagree for no stylesheet's fault.
    const quiet = new CSSStyleSheet();
    quiet.replaceSync('*, *::before, *::after, *::selection { transition: none !important; animation: none !important; }');
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, quiet];
    w.__st = { els: [], pathOf, parse, over, finish };
  });
}

// ───────── (a) the computed styles ─────────

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
/** The fixed property list of test 4 (a). `background-image` is added: a gradient or an image is a ground too. */
const PROPS: readonly string[] = [
  'color', 'background-color', 'background-image',
  ...SIDES.flatMap((s) => [`border-${s}-color`, `border-${s}-style`, `border-${s}-width`]),
  'outline-color', 'outline-style', 'outline-width', 'outline-offset', 'box-shadow',
  'text-decoration-line', 'text-decoration-style', 'text-decoration-color',
  'font-family', 'font-weight', 'font-style', 'filter', 'opacity',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'letter-spacing', 'text-transform',
];

type Variant = '::before' | '::after' | '::selection';

interface StyleRead {
  /** The distinct style strings; each element's is `table[idx[i]]`. */
  readonly table: readonly string[];
  readonly idx: readonly number[];
}

/** Wait two frames, so scroll-driven and observer-driven class changes have run before a read. */
async function settle(page: Page): Promise<void> {
  await frames(page);
}

/** Every element's computed values for PROPS, and its pseudo-elements' (only the ones that draw content). */
async function readStyles(page: Page, variants: readonly Variant[]): Promise<StyleRead> {
  await helpers(page);
  await settle(page);
  return page.evaluate(
    ([props, vars]) => {
      const st = (window as unknown as { __st: St }).__st;
      st.finish();
      const skip = new Set(['script', 'style', 'link', 'meta', 'title', 'head', 'template', 'noscript', 'base']);
      const els = [document.documentElement, document.body, ...Array.from(document.body.querySelectorAll('*'))].filter((e) => !skip.has(e.localName));
      st.els = els;
      const table: string[] = [];
      const seen = new Map<string, number>();
      const idx: number[] = [];
      for (const el of els) {
        const cs = getComputedStyle(el);
        let s = `${el.localName}|${props.map((p) => cs.getPropertyValue(p)).join('|')}`;
        for (const v of vars) {
          const pc = getComputedStyle(el, v);
          if (v !== '::selection') {
            const c = pc.content;
            if (c === 'none' || c === 'normal') {
              s += `~${v}=-`;
              continue;
            }
          }
          s += `~${v}=${props.map((p) => pc.getPropertyValue(p)).join('|')}`;
        }
        let i = seen.get(s);
        if (i === undefined) {
          i = table.length;
          table.push(s);
          seen.set(s, i);
        }
        idx.push(i);
      }
      return { table, idx };
    },
    [PROPS, variants] as const,
  );
}

/** What differs between two reads: a line for the first elements that do, with the properties that differ. */
async function differences(label: string, ra: StyleRead, rb: StyleRead, pa: Page, limit = 6): Promise<string[]> {
  if (ra.idx.length !== rb.idx.length) return [`${label}: the pages have ${String(ra.idx.length)} and ${String(rb.idx.length)} elements`];
  const bad: number[] = [];
  for (let i = 0; i < ra.idx.length; i += 1) if (ra.table[ra.idx[i] as number] !== rb.table[rb.idx[i] as number]) bad.push(i);
  if (bad.length === 0) return [];
  const out = [`${label}: ${String(bad.length)} element(s) differ`];
  /** One element's string, split: the element's own values, then each pseudo-element's, by name. */
  const split = (s: string): Map<string, string[]> => {
    const m = new Map<string, string[]>();
    s.split('~').forEach((chunk, k) => {
      if (k === 0) m.set('', chunk.split('|').slice(1));
      else {
        const at = chunk.indexOf('=');
        m.set(chunk.slice(0, at), chunk.slice(at + 1) === '-' ? [] : chunk.slice(at + 1).split('|'));
      }
    });
    return m;
  };
  for (const i of bad.slice(0, limit)) {
    const a = split(ra.table[ra.idx[i] as number] as string);
    const b = split(rb.table[rb.idx[i] as number] as string);
    const where = await pa.evaluate((n) => (window as unknown as { __st: St }).__st.pathOf((window as unknown as { __st: St }).__st.els[n] as Element, 6), i);
    const parts: string[] = [];
    for (const [name, xs] of a) {
      const ys = b.get(name) ?? [];
      if (xs.length !== ys.length) parts.push(`${name} content differs`);
      else PROPS.forEach((prop, j) => (xs[j] !== ys[j] ? parts.push(`${name}${name === '' ? '' : ' '}${prop}: ${xs[j] as string} -> ${ys[j] as string}`) : undefined));
    }
    out.push(`    ${where}: ${parts.slice(0, 4).join('; ')}`);
  }
  return out;
}

// ───────── the states ─────────

interface State {
  readonly name: string;
  readonly chromiumOnly?: true;
  readonly variants?: readonly Variant[];
  /** Put the page in the state; true when it is in it (the trigger exists and the thing is shown). */
  apply(page: Page): Promise<boolean>;
  clear(page: Page): Promise<void>;
}

const frames = (page: Page): Promise<void> => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

/** A state reached by one element's `click()` (no pointer moves), shown when `shown` is. */
const clicked = (name: string, trigger: string, shown: string): State => ({
  name,
  async apply(page) {
    const found = await page.evaluate((t) => {
      const el = document.querySelector(t);
      if (!(el instanceof HTMLElement)) return false;
      el.click();
      return true;
    }, trigger);
    if (!found) return false;
    await frames(page);
    return page.evaluate((s) => {
      const el = document.querySelector(s);
      return el !== null && el.getClientRects().length > 0;
    }, shown);
  },
  clear: closeAll,
});

async function closeAll(page: Page): Promise<void> {
  await page.evaluate(() => {
    const a = document.activeElement;
    if (a instanceof HTMLElement) a.blur();
  });
  await page.keyboard.press('Escape');
  await frames(page);
}

const sessions = new WeakMap<Page, { session: CDPSession; ids: number[] }>();
const sizes = new WeakMap<Page, { width: number; height: number }>();
const CONTROLS = 'button, a, input, select, textarea, summary, label, [tabindex], [role="button"], [role="menuitem"], [role="option"], [role="tab"], tr';
const FORCE_CAP = 700;

/** CSS.forcePseudoState on every control and table row (Chromium). */
const forced = (name: string, classes: string[]): State => ({
  name,
  chromiumOnly: true,
  async apply(page) {
    const session = await page.context().newCDPSession(page);
    await session.send('DOM.enable');
    await session.send('CSS.enable');
    const { root } = await session.send('DOM.getDocument', { depth: 0 });
    const { nodeIds } = await session.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: CONTROLS });
    const ids = nodeIds.slice(0, FORCE_CAP);
    sessions.set(page, { session, ids });
    for (let i = 0; i < ids.length; i += 100) {
      await Promise.all(ids.slice(i, i + 100).map((nodeId) => session.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: classes })));
    }
    await frames(page);
    return ids.length > 0;
  },
  async clear(page) {
    const held = sessions.get(page);
    if (held === undefined) return;
    sessions.delete(page);
    for (let i = 0; i < held.ids.length; i += 100) {
      await Promise.all(held.ids.slice(i, i + 100).map((nodeId) => held.session.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] })));
    }
    await held.session.detach();
    await frames(page);
  },
});

const narrow = async (page: Page): Promise<void> => {
  const was = page.viewportSize();
  if (was !== null) sizes.set(page, was);
  await page.setViewportSize({ width: 390, height: 844 });
  await frames(page);
};
const restore = async (page: Page): Promise<void> => {
  const was = sizes.get(page);
  if (was !== undefined) await page.setViewportSize(was);
  sizes.delete(page);
  await frames(page);
};

const STATES: readonly State[] = [
  { name: 'rest', apply: () => Promise.resolve(true), clear: () => Promise.resolve() },
  {
    name: 'selection',
    variants: ['::before', '::after', '::selection'],
    async apply(page) {
      await helpers(page);
      await frames(page);
      await page.evaluate(() => {
        (window as unknown as { __st: St }).__st.finish();
        const root = document.querySelector('[data-docreader-root]');
        if (root === null) return;
        const range = document.createRange();
        range.selectNodeContents(root);
        const sel = getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      });
      return true;
    },
    async clear(page) {
      await page.evaluate(() => getSelection()?.removeAllRanges());
    },
  },
  clicked('aa', '.aa-btn', '.aa-menu'),
  clicked('changes', '.chg-trig', '.chg-menu'),
  {
    name: 'xcard',
    async apply(page) {
      const found = await page.evaluate(() => {
        const a = document.querySelector('a.xref');
        if (!(a instanceof HTMLElement)) return false;
        a.focus({ preventScroll: true });
        return true;
      });
      if (!found) return false;
      await frames(page);
      return page.evaluate(() => document.querySelector('.xcard.open') !== null);
    },
    clear: closeAll,
  },
  {
    name: 'tcard',
    async apply(page) {
      const found = await page.evaluate(() => {
        const a = document.querySelector('a.term');
        if (!(a instanceof HTMLElement)) return false;
        a.focus({ preventScroll: true });
        return true;
      });
      if (!found) return false;
      await frames(page);
      return page.evaluate(() => document.querySelector('.xcard.open') !== null);
    },
    clear: closeAll,
  },
  clicked('jump', '.jump-btn', '.jump.open'),
  {
    name: 'keys',
    async apply(page) {
      await page.keyboard.press('?');
      await frames(page);
      return page.evaluate(() => document.querySelector('.keys.open') !== null);
    },
    clear: closeAll,
  },
  {
    name: 'figure-overlay',
    async apply(page) {
      const found = await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('.tools button')).find((x) => x.textContent === 'Full screen');
        if (!(b instanceof HTMLElement)) return false;
        b.click();
        return true;
      });
      if (!found) return false;
      await frames(page);
      return page.evaluate(() => document.querySelector('.fig-overlay.open') !== null);
    },
    clear: closeAll,
  },
  {
    name: 'figure-tool',
    async apply(page) {
      const found = await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('.tools button')).find((x) => x.getAttribute('aria-pressed') === 'false');
        if (!(b instanceof HTMLElement)) return false;
        b.click();
        return true;
      });
      if (!found) return false;
      await frames(page);
      return page.evaluate(() => document.querySelector('.tools button[aria-pressed="true"]') !== null);
    },
    async clear(page) {
      await page.evaluate(() => {
        const b = document.querySelector('.tools button[aria-pressed="true"]');
        if (b instanceof HTMLElement) b.click();
      });
      await frames(page);
    },
  },
  forced('hover', ['hover']),
  forced('focus-visible', ['focus', 'focus-visible']),
  {
    name: 'narrow',
    async apply(page) {
      await narrow(page);
      return true;
    },
    clear: restore,
  },
  {
    name: 'toc-drawer',
    async apply(page) {
      await narrow(page);
      const found = await page.evaluate(() => {
        const b = document.querySelector('.toc-btn');
        if (!(b instanceof HTMLElement)) return false;
        b.click();
        return true;
      });
      if (!found) return false;
      await frames(page);
      return page.evaluate(() => document.querySelector('[data-docreader-root].toc-open, .toc-open') !== null);
    },
    async clear(page) {
      await closeAll(page);
      await restore(page);
    },
  },
];

/** Which states some document reached, so a state no document reaches is a red, not a silent absence. */
const reached = new Map<string, number>();

/**
 * Open a document with the harness, and check that its stylesheet loaded: a page whose stylesheet request failed would be
 * unstyled in both pages of a comparison, and look like an equal pair. It is opened again (twice at most) before a failure.
 */
async function open(doc: Doc, browser: BrowserName, extra: { options?: Readonly<Record<string, unknown>>; stylesheet?: string }): Promise<OpenedDoc> {
  let last = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const opened = await openDoc(doc.markdown, extra.options ?? doc.options, {
      browser,
      ...(doc.viewport === undefined ? {} : { viewport: doc.viewport }),
      ...(doc.csp === undefined ? {} : { csp: doc.csp }),
      ...(doc.html === undefined ? {} : { html: doc.html }),
      ...(extra.stylesheet === undefined ? {} : { stylesheet: extra.stylesheet }),
    });
    const rules = await opened.page.evaluate(() => Array.from(document.styleSheets).reduce((n, sheet) => n + sheet.cssRules.length, 0));
    if (rules > 200 && opened.missing.length === 0 && opened.aborted.length === 0) return opened;
    last = `${doc.id}: ${String(rules)} rules loaded, missing ${JSON.stringify(opened.missing)}, aborted ${JSON.stringify(opened.aborted)}`;
    await opened.close();
  }
  throw new Error(`the stylesheet did not load in three tries: ${last}`);
}

/** One document, current stylesheet against `other`, in every state: the lines that differ. */
async function compareDoc(doc: Doc, browser: BrowserName, other: string, count = true): Promise<string[]> {
  const a = await open(doc, browser, {});
  const b = await open(doc, browser, { stylesheet: other });
  const out: string[] = [];
  try {
    for (const st of STATES) {
      if (st.chromiumOnly === true && browser !== 'chromium') continue;
      const began = Date.now();
      const ok = [await st.apply(a.page), await st.apply(b.page)];
      if (ok[0] !== ok[1]) out.push(`${doc.id} / ${st.name}: the state is reached on one page only`);
      else if (ok[0] === true) {
        if (count) reached.set(st.name, (reached.get(st.name) ?? 0) + 1);
        const vars = st.variants ?? (['::before', '::after'] as const);
        const ra = await readStyles(a.page, vars);
        const rb = await readStyles(b.page, vars);
        out.push(...(await differences(`${doc.id} / ${st.name}`, ra, rb, a.page)));
      }
      await st.clear(a.page);
      await st.clear(b.page);
      if (process.env['DOCREADER_STYLE_TIMING'] === '1') console.log(`timing ${doc.id} ${st.name} ${String(Date.now() - began)} ms`);
    }
  } finally {
    await a.close();
    await b.close();
  }
  return out;
}

// ───────── colours ─────────

type RGB = readonly [number, number, number];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** `color-mix(in srgb, a pct%, b)`, opaque, each channel rounded to 8 bits as a browser paints it. */
const mix = (a: RGB, pct: number, b: RGB): RGB => [0, 1, 2].map((i) => Math.round((a[i] as number) * pct + (b[i] as number) * (1 - pct))) as unknown as RGB;
const lin = (v: number): number => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (c: readonly number[]): number => 0.2126 * lin(c[0] as number) + 0.7152 * lin(c[1] as number) + 0.0722 * lin(c[2] as number);
const ratio = (a: readonly number[], b: readonly number[]): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const near = (a: readonly number[], b: readonly number[], tol = 1.01): boolean => [0, 1, 2].every((i) => Math.abs((a[i] as number) - (b[i] as number)) <= tol);

interface Fixture {
  readonly name: string;
  readonly mode: 'light' | 'dark';
  readonly colour: Record<AppearanceColourSlot, string>;
}

const FIXTURES = JSON.parse(readFileSync(path.join(ROOT, 'conformance', 'appearance', 'fixtures.json'), 'utf8')) as Fixture[];

/** Every colour the library's pairs name, from a fixture's slot values: the 33 slots, `accent-hover`, the five tints. */
function colours(f: Fixture): Record<string, RGB> {
  const c = (k: AppearanceColourSlot): RGB => hex(f.colour[k]);
  const out: Record<string, RGB> = {};
  for (const k of Object.keys(f.colour) as AppearanceColourSlot[]) out[k] = c(k);
  out['derived:accent-hover'] = mix(c('accent'), 0.8, c('text'));
  for (const [slot, ground] of [['chg', 'bg'], ['wait', 'bg'], ['no', 'bg'], ['accent', 'bg'], ['chg', 'surface']] as const) {
    out[`tint:${slot}@${ground}`] = mix(c(slot), 0.04, c(ground));
  }
  return out;
}

/** Section 5's table, written out independently of APPEARANCE_PAIRS: the grounds, and the text each admits. */
const TEXT14 = ['text', 'text-muted', 'text-faint', 'accent', 'derived:accent-hover', 'ok', 'wait', 'no', 'info', 'chg', 'term', 'id', 'violet', 'path'];
const SYN = ['syn-comment', 'syn-keyword', 'syn-string', 'syn-number', 'syn-function', 'syn-type', 'syn-tag', 'syn-attr', 'syn-punct', 'syn-deleted', 'syn-inserted'];
const TEXT_GROUNDS = ['bg', 'surface', 'surface2', 'tint:chg@bg', 'tint:wait@bg', 'tint:no@bg', 'tint:accent@bg', 'tint:chg@surface'];
const GROUNDS = [...TEXT_GROUNDS, 'code-block-bg', 'accent'];

function section5(): Set<string> {
  const out = new Set<string>();
  for (const g of TEXT_GROUNDS) for (const t of TEXT14) out.add(`${t}|${g}|4.5`);
  for (const t of ['code-ink', ...SYN]) out.add(`${t}|code-block-bg|4.5`);
  out.add('accent-ink|accent|4.5');
  for (const g of TEXT_GROUNDS) out.add(`focus|${g}|3`);
  return out;
}

const PAIR_KEYS = new Set(APPEARANCE_PAIRS.map((p) => `${p.fg}|${p.bg}|${String(p.floor)}`));
/** True when the library's list admits this text colour on this ground (4.5 pairs only: text, not the focus ring). */
const admits = (ground: string, text: string): boolean => PAIR_KEYS.has(`${text}|${ground}|4.5`);

describe('the pairs (b): the library gate, on every fixture', () => {
  it('APPEARANCE_PAIRS is section 5\'s product: every text colour on every ground it admits, the well, accent, the ring', () => {
    expect([...PAIR_KEYS].sort()).toEqual([...section5()].sort());
    expect(APPEARANCE_PAIRS).toHaveLength(14 * 8 + 12 + 1 + 8);
  });

  it('the colour arithmetic of this file: a ratio, a mix with 8-bit rounding, the tolerance of a match', () => {
    expect(ratio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(ratio([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 5);
    expect(mix([255, 0, 0], 0.04, [0, 0, 0])).toEqual([10, 0, 0]);
    expect(mix([0, 0, 0], 0.04, [255, 255, 255])).toEqual([245, 245, 245]);
    expect(near([10, 0, 0], [10.9, 0, 0])).toBe(true);
    expect(near([10, 0, 0], [11.5, 0, 0])).toBe(false);
  });

  it('the twelve fixtures are present, each with every slot', () => {
    expect(FIXTURES).toHaveLength(12);
    for (const f of FIXTURES) expect(Object.keys(f.colour), f.name).toHaveLength(33);
  });

  it('every pair of APPEARANCE_PAIRS meets its floor in every fixture, with the stylesheet\'s own mixes (8-bit rounding)', () => {
    const below: string[] = [];
    for (const f of FIXTURES) {
      const c = colours(f);
      for (const p of APPEARANCE_PAIRS) {
        const fg = c[p.fg];
        const bg = c[p.bg];
        if (fg === undefined || bg === undefined) {
          below.push(`${f.name}: ${p.fg} on ${p.bg} names a colour no fixture supplies`);
          continue;
        }
        const r = ratio(fg, bg);
        if (r < p.floor) below.push(`${f.name}: ${p.fg} on ${p.bg} is ${r.toFixed(3)}:1, floor ${String(p.floor)}`);
      }
    }
    expect(below).toEqual([]);
  });
});

// ───────── (a) rows ─────────

const DOCS = allDocs();

describeBrowsers((browser) => {
  it('the v1.1.0 tag is in the checkout and its stylesheet is the 1.1.0 one', () => {
    const css = v110();
    expect(css.length).toBeGreaterThan(10_000);
    expect(css).toContain('[data-docreader-root]');
    expect(css).not.toContain('data-docreader-hosted');
  });

  it('the comparison goes red on a stylesheet that differs (the comparator is live)', async () => {
    const doc = DOCS.find((d) => d.id === 'corpus/headings') as Doc;
    const changed = `${v110()}\n[data-docreader-root] p { color: rgb(1, 2, 3); }\n[data-docreader-root] a { outline: 2px solid rgb(4, 5, 6); }\n`;
    const out = await compareDoc(doc, browser, changed, false);
    expect(out.length).toBeGreaterThan(0);
    expect(out.join('\n')).toContain('color:');
  }, 120_000);

  describe('(a) no appearance: the computed styles equal 1.1.0\'s', () => {
    for (const doc of DOCS) {
      it.concurrent(doc.id, async () => {
        const out = await compareDoc(doc, browser, v110());
        if (out.length > 0) throw new Error(`computed styles moved from ${TAG}:\n${out.join('\n')}`);
      }, 180_000);
    }

    it('every state was reached by some document', () => {
      if (reached.size === 0) return; // this row was run alone
      const missing = STATES.filter((s) => (s.chromiumOnly !== true || browser === 'chromium') && (reached.get(s.name) ?? 0) === 0).map((s) => s.name);
      expect(missing).toEqual([]);
    });
  });

  // ───────── (b) and (c): the rendered documents under an appearance ─────────

  interface Offender {
    count: number;
    where: string;
    line: string;
  }
  interface Collected {
    readonly closed: Map<string, Offender>;
    readonly contrast: Map<string, Offender>;
    readonly notHosted: string[];
    readonly stats: { documents: number; states: Record<string, number>; elements: number };
  }

  interface Entry {
    readonly path: string;
    readonly pseudo: string;
    readonly fg: number[] | null;
    readonly fgCss: string;
    readonly ground: number[];
    readonly canvas: boolean;
    readonly image: string;
    readonly text: string;
    readonly n: number;
  }
  interface SelectionEntry {
    readonly path: string;
    readonly bg: string;
    readonly color: string;
  }
  interface Reading {
    readonly entries: Entry[];
    readonly selection: SelectionEntry[];
    readonly total: number;
  }

  /** Every text-holding element's computed colour and nearest painted ground (the in-page half of (b) and (c)). */
  async function readGrounds(page: Page, withSelection: boolean): Promise<Reading> {
    await helpers(page);
    await settle(page);
    return page.evaluate((sel) => {
      const st = (window as unknown as { __st: St }).__st;
      st.finish();
      const skip = new Set(['script', 'style', 'link', 'meta', 'title', 'head', 'template', 'noscript', 'base']);
      const els = [document.documentElement, document.body, ...Array.from(document.body.querySelectorAll('*'))].filter((e) => !skip.has(e.localName));
      const out = new Map<string, Entry>();
      let total = 0;
      const shown = (el: Element, cs: CSSStyleDeclaration): boolean => {
        if (cs.visibility !== 'visible') return false;
        const r = el.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) return false;
        let o = 1;
        for (let x: Element | null = el; x !== null; x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity);
        return o > 0;
      };
      const groundOf = (start: Element, own: CSSStyleDeclaration | null): { rgb: number[]; canvas: boolean; image: string } => {
        const layers: number[][] = [];
        let image = '';
        let stopped = false;
        const consider = (c: CSSStyleDeclaration): boolean => {
          const bi = c.backgroundImage;
          if (bi !== '' && bi !== 'none' && image === '') image = bi.slice(0, 70);
          const col = st.parse(c.backgroundColor);
          if (col !== null && (col[3] as number) > 0) {
            layers.push(col);
            return (col[3] as number) >= 0.999;
          }
          return false;
        };
        if (own !== null) stopped = consider(own);
        for (let x: Element | null = start; !stopped && x !== null; x = x.parentElement) stopped = consider(getComputedStyle(x));
        const bottom = stopped ? (layers.pop() as number[]) : [255, 255, 255, 1];
        let acc = bottom;
        for (let i = layers.length - 1; i >= 0; i -= 1) acc = st.over(layers[i] as number[], acc);
        return { rgb: acc.slice(0, 3), canvas: !stopped, image };
      };
      const record = (el: Element, pseudo: string, cs: CSSStyleDeclaration, own: CSSStyleDeclaration | null, text: string): void => {
        total += 1;
        const g = groundOf(el, own);
        const fgp = st.parse(cs.color);
        const fg = fgp === null ? null : st.over(fgp, [...g.rgb, 1]).slice(0, 3);
        const r2 = (v: number[] | null): string => (v === null ? 'null' : v.map((n) => n.toFixed(1)).join(','));
        const p = st.pathOf(el);
        const key = `${p}|${pseudo}|${r2(fg)}|${r2(g.rgb)}|${g.canvas ? 'canvas' : ''}|${g.image}`;
        const e = out.get(key);
        if (e !== undefined) {
          out.set(key, { ...e, n: e.n + 1 });
          return;
        }
        out.set(key, { path: p, pseudo, fg, fgCss: cs.color, ground: g.rgb, canvas: g.canvas, image: g.image, text: text.slice(0, 28), n: 1 });
      };
      for (const el of els) {
        if (el.closest('svg') !== null) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none') continue;
        const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && /\S/.test(n.nodeValue ?? '')).map((n) => (n.nodeValue ?? '').trim()).join(' ');
        const field = el instanceof HTMLInputElement ? !['checkbox', 'radio', 'button', 'submit', 'hidden', 'range', 'color', 'file'].includes(el.type) : el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
        const before = getComputedStyle(el, '::before');
        const after = getComputedStyle(el, '::after');
        const drawn = (c: CSSStyleDeclaration): boolean => c.content !== 'none' && c.content !== 'normal' && c.content !== '""' && c.content !== "''" && c.display !== 'none';
        if (own === '' && !field && !drawn(before) && !drawn(after)) continue;
        if (!shown(el, cs)) continue;
        if (own !== '' || field) record(el, '', cs, null, own);
        if (drawn(before)) record(el, '::before', before, before, before.content);
        if (drawn(after)) record(el, '::after', after, after, after.content);
      }
      const selection: SelectionEntry[] = [];
      if (sel) {
        const root = document.querySelector('[data-docreader-root]');
        for (const s of ['p', 'a', 'code', 'pre', 'td', 'th', 'li', 'h2', 'h3', 'button']) {
          const el = root?.querySelector(s);
          if (el === null || el === undefined) continue;
          const sc = getComputedStyle(el, '::selection');
          selection.push({ path: st.pathOf(el), bg: sc.backgroundColor, color: sc.color });
        }
      }
      return { entries: Array.from(out.values()), selection, total };
    }, withSelection);
  }

  const css = (c: readonly number[] | null): string => (c === null ? 'unparsed' : `rgb(${c.map((n) => String(Math.round(n * 10) / 10)).join(', ')})`);

  /** The slot names a colour matches in a fixture's table (within one 8-bit step). */
  const namesOf = (rgb: readonly number[], table: Record<string, RGB>, only: readonly string[] | null = null): string[] =>
    Object.keys(table).filter((k) => (only === null || only.includes(k)) && near(table[k] as RGB, rgb));

  const collected = new Map<string, Promise<Collected>>();

  /** `docs` under `fixture`, in every state: the elements whose ground is not closed, and the pairs below their floor. */
  function collect(fixture: Fixture, docs: readonly Doc[], only: readonly string[] | null = null): Promise<Collected> {
    const key = `${fixture.name}|${docs.length}|${docs[0]?.id ?? ''}|${only === null ? 'all' : only.join(',')}`;
    const got = collected.get(key);
    if (got !== undefined) return got;
    const run = (async (): Promise<Collected> => {
      const table = colours(fixture);
      const result: Collected = { closed: new Map(), contrast: new Map(), notHosted: [], stats: { documents: 0, states: {}, elements: 0 } };
      const note = (into: Map<string, Offender>, k: string, where: string, line: string): void => {
        const e = into.get(k);
        if (e === undefined) into.set(k, { count: 1, where, line });
        else e.count += 1;
      };
      for (const doc of docs) {
        const d = await open(doc, browser, { options: { ...doc.options, appearance: { mode: fixture.mode, colour: fixture.colour } } });
        try {
          const hosted = await d.page.evaluate(() => {
            const r = document.querySelector('[data-docreader-root]');
            return r === null ? null : { hosted: r.hasAttribute('data-docreader-hosted'), colours: r.hasAttribute('data-docreader-colours'), bg: getComputedStyle(r).getPropertyValue('--bg').trim().toLowerCase() };
          });
          if (hosted === null || !hosted.hosted || !hosted.colours || hosted.bg !== fixture.colour.bg.toLowerCase()) {
            result.notHosted.push(`${doc.id}: the appearance was not applied (${JSON.stringify(hosted)})`);
            continue;
          }
          result.stats.documents += 1;
          for (const st of STATES) {
            if (st.chromiumOnly === true && browser !== 'chromium') continue;
            if (only !== null && !only.includes(st.name)) continue;
            if (!(await st.apply(d.page))) {
              await st.clear(d.page);
              continue;
            }
            result.stats.states[st.name] = (result.stats.states[st.name] ?? 0) + 1;
            const reading = await readGrounds(d.page, st.name === 'selection');
            result.stats.elements += reading.total;
            const where = `${doc.id} / ${st.name}`;
            for (const e of reading.entries) {
              const fgNames = e.fg === null ? [] : namesOf(e.fg, table);
              const clear = !e.canvas && e.image === '';
              const gNames = clear ? namesOf(e.ground, table, GROUNDS) : [];
              const mapped = fgNames.flatMap((f) => gNames.filter((g) => admits(g, f)).map((g) => `${f} on ${g}`));
              const fgLabel = e.fg === null ? `unparsed(${e.fgCss})` : fgNames.length > 0 ? fgNames.join('=') : `?${css(e.fg)}`;
              const groundLabel = e.canvas ? 'canvas (no painted ground)' : e.image !== '' ? `image ${e.image}` : gNames.length > 0 ? gNames.join('=') : `?${css(e.ground)}`;
              const spot = `${e.path}${e.pseudo}`;
              const detail = `${spot} :: ${fgLabel} on ${groundLabel}`;
              const snippet = e.text === '' ? '' : ` "${e.text}"`;
              if (mapped.length === 0) {
                // The key leaves out raw values that differ per fixture, so one gap is one line.
                const k = `${spot}|${e.fg === null ? 'unparsed' : fgNames.length > 0 ? fgNames.join('=') : '?'}|${e.canvas ? 'canvas' : e.image !== '' ? 'image' : gNames.length > 0 ? gNames.join('=') : '?'}`;
                note(result.closed, k, where, `${detail} (${css(e.fg)} on ${css(e.ground)}, first in ${where}${snippet})`);
              } else if (e.fg !== null && ratio(e.fg, e.ground) < 4.5) {
                note(result.contrast, `${spot}|${mapped.join(',')}`, where, `${detail} is ${ratio(e.fg, e.ground).toFixed(2)}:1, floor 4.5 (${css(e.fg)} on ${css(e.ground)}, first in ${where}${snippet})`);
              }
            }
            const accent = table['accent'] as RGB;
            const ink = table['accent-ink'] as RGB;
            for (const s of reading.selection) {
              const bg = hexOf(s.bg);
              const fg = hexOf(s.color);
              if (bg === null || fg === null || !near(bg, accent) || !near(fg, ink)) {
                note(result.closed, `${s.path}::selection`, where, `${s.path}::selection :: ${s.color} on ${s.bg}, expected accent-ink ${css(ink)} on accent ${css(accent)} (first in ${where})`);
              } else if (ratio(fg, bg) < 4.5) {
                note(result.contrast, `${s.path}::selection`, where, `${s.path}::selection is ${ratio(fg, bg).toFixed(2)}:1, floor 4.5`);
              }
            }
            await st.clear(d.page);
          }
        } finally {
          await d.close();
        }
      }
      return result;
    })();
    collected.set(key, run);
    return run;
  }

  const hexOf = (s: string): number[] | null => {
    const m = /^(?:rgba?|color)\((?:srgb )?([^)]*)\)$/.exec(s.trim());
    if (m === null) return null;
    const srgb = s.trim().startsWith('color(');
    const p = (m[1] ?? '').split(/[\s,/]+/).filter(Boolean).map((t) => (t.endsWith('%') ? parseFloat(t) / 100 : parseFloat(t)));
    if (p.length < 3 || p.some((n) => Number.isNaN(n))) return null;
    if ((p[3] ?? 1) === 0) return null;
    return p.slice(0, 3).map((n) => (srgb ? n * 255 : n));
  };

  const report = (title: string, found: Map<string, Offender>): string => {
    const lines = Array.from(found.values()).map((o) => `  [${String(o.count)}] ${o.line}`);
    const shown = lines.slice(0, 120);
    return `${title}: ${String(lines.length)} distinct offending element(s)\n${shown.join('\n')}${lines.length > shown.length ? `\n  ... ${String(lines.length - shown.length)} more` : ''}`;
  };

  const FILE = process.env['DOCREADER_STYLE_REPORT'];
  const keep = (label: string, text: string): void => {
    if (FILE !== undefined && FILE !== '') writeFileSync(FILE, `\n== ${label} (${browser}) ==\n${text}\n`, { flag: 'a' });
  };

  /** The documents of a row: the representative ones in every state, under all twelve fixtures; every document at rest, under two. */
  const reps = DOCS.filter((d) => REPRESENTATIVE.includes(d.id));
  const SWEEP = ['Phosphor & Ink', 'Phosphor Daylight'];
  const AT_REST = ['rest', 'selection'];

  describe('(c) closed grounds: every text element is on one of section 5\'s grounds, in a colour it admits', () => {
    it('the representative documents all exist', () => {
      expect(reps.map((d) => d.id).sort()).toEqual([...REPRESENTATIVE].sort());
    });

    const fail = (f: Fixture, got: Collected, what: string): void => {
      expect(got.notHosted, 'the appearance applies to every document').toEqual([]);
      expect(got.stats.documents).toBeGreaterThan(0);
      if (got.closed.size > 0) {
        const text = report(`${f.name}, ${what}: text on a ground that is not closed, or in a colour its ground does not admit (${String(got.stats.documents)} documents, ${String(got.stats.elements)} text elements read)`, got.closed);
        keep(`${f.name}, ${what}`, text);
        throw new Error(text);
      }
    };

    for (const f of FIXTURES) {
      it.concurrent(`${f.name}: the representative documents, every state`, async () => {
        fail(f, await collect(f, reps), 'representative documents, every state');
      }, 1_200_000);
    }
    for (const f of FIXTURES.filter((x) => SWEEP.includes(x.name))) {
      it.concurrent(`${f.name}: every document, at rest and with text selected`, async () => {
        fail(f, await collect(f, DOCS, AT_REST), 'every document, at rest and selected');
      }, 1_200_000);
    }
  });

  describe('(b) pairs: every pair the documents draw meets its floor, on computed values', () => {
    const fail = (f: Fixture, got: Collected, what: string): void => {
      expect(got.notHosted, 'the appearance applies to every document').toEqual([]);
      if (got.contrast.size > 0) {
        const text = report(`${f.name}, ${what}: a drawn pair is below its floor`, got.contrast);
        keep(`${f.name}, ${what} (contrast)`, text);
        throw new Error(text);
      }
    };
    for (const f of FIXTURES) {
      it(`${f.name}: the representative documents, every state`, async () => {
        fail(f, await collect(f, reps), 'representative documents, every state');
      }, 1_200_000);
    }
    for (const f of FIXTURES.filter((x) => SWEEP.includes(x.name))) {
      it(`${f.name}: every document, at rest and with text selected`, async () => {
        fail(f, await collect(f, DOCS, AT_REST), 'every document, at rest and selected');
      }, 1_200_000);
    }
  });
});
