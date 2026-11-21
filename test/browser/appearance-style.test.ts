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
//      The property list holds colours, borders, outline, shadow, text decoration, font, filter, opacity, radius and the sizes
//      (width, height, min-height, font-size, margins). Twelve of the representative documents (DARKENED) are also read in 1.1.0's other
//      colour modes (see Mode): the system's dark scheme and the stored theme `dark`, in every state, and four documents under print
//      media, at rest and with text selected. One synthetic document renders all four status dots in the contents index.
//      A self-test row proves the comparison goes red on a stylesheet that differs. DOCREADER_STYLE_UNDER_TEST=<file>
//      serves a scratch copy of the stylesheet in place of the package's, to measure a mutation row without editing it.
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
//  - Layout cases that draw Mermaid (options hold `mermaid`) are in (a), and left out of the (b) and (c) sweeps, for cost:
//    they load the Mermaid bundle per page, and the text inside a drawing is test 5's. The drawn figure's chrome is covered
//    by the one document with a static drawing.
//  - (b) and (c) read every document, but those that draw Mermaid, in every state under two appearances (a dark and a light
//    one), and the representative documents (REPRESENTATIVE) in every state under all twelve (the widening of both from a sweep
//    at rest and with text selected, once the full sweep's added time was measured: 83 s for the two rows on Chromium, 249 s
//    a CI leg at the 2x WebKit factor, under the 5 minutes allowed).
//  - Test 4 (a) reads lengths within 0.1 px, not exactly (ccrc D-8827: the tolerance is a departure from "equal to 1.1.0's");
//    the unit rows of `same` pin its width. An element whose tag differs from its pair's at the same index is a difference.
//    When more than 2 000 elements differ, they are reported as differing without being read (READ_LIMIT).
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
import { closeBrowsers, describeBrowsers, openDoc, type BrowserName, type HarnessLayout, type OpenedDoc } from './harness.js';
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
  /** A layout case whose options hold `mermaid`: its page loads the Mermaid bundle and draws (row (a) reads it; (b) and (c) sweeps leave it out). */
  readonly mermaid?: true;
}

/** A static drawing, as the viewer tests inject one: the figure's tools, its overlay and a pressable tool need an SVG. */
const FIGURE_MARKDOWN = ['# Figure', '', '## Decisions', '', '| ID | Decision | Status |', '|---|---|---|', '| D1 | Keep the diagram definition available | Agreed |', ''].join('\n');
const DRAWING = '<figure class="mermaid-figure"><pre class="mermaid">flowchart LR\n  A --> B</pre><pre class="mermaid" data-docreader-chrome><svg id="viewer-source" viewBox="0 0 240 100"><g class="node dnode" id="flowchart-A-0" data-ref="D1" tabindex="0" role="button"><rect width="80" height="30"/><text>D1</text></g><g class="node" id="flowchart-B-1"><rect x="140" width="80" height="30"/></g><path class="flowchart-link" data-id="L_A_B_0" d="M80 15H140"/></svg></pre><figcaption>Figure 1. Diagram.</figcaption></figure>';

function allDocs(): Doc[] {
  const corpus: Doc[] = corpusDocuments()
    .filter((d) => render(d.markdown).outcome === 'rendered')
    .map((d) => ({ id: `corpus/${d.id}`, markdown: d.markdown, options: {}, viewport: undefined, csp: undefined, html: undefined }));
  const layout: Doc[] = loadLayoutCases().map((c) => ({
    id: `layout/${c.id}`,
    markdown: c.markdown,
    options: c.options,
    viewport: c.viewport,
    csp: c.csp,
    html: undefined,
    ...(Object.hasOwn(c.options, 'mermaid') ? { mermaid: true as const } : {}),
  }));
  const since = layout.find((d) => d.id === 'layout/since/menu') as Doc;
  // The changes menu needs a `changes` callback; the harness page turns a `changes` given as data into one (page/bootstrap.ts).
  const menu: Doc = { ...since, id: 'synthetic/changes-menu', options: { ...since.options, changes: { changed: [[1, 1]] } } };
  // The contents index draws a status dot for each ID row that ends in a status word: one table, one row of each role, in a
  // document the rail is drawn for (a title and three sections). The index tab is the stored one, so the dots are shown.
  const dots: Doc = {
    id: 'synthetic/status-dots',
    markdown: ['# Status dots', '', '## 1. Decisions', '', '| ID | Decision | Status |', '|---|---|---|', '| D1 | A kept one | Agreed |', '| D2 | A waiting one | Pending |', '| D3 | A refused one | Rejected |', '| D4 | A later one | Deferred |', '', '## 2. Scope', '', 'The rail is drawn for a document: one title and three sections.', '', '## 3. Plan', '', 'Nothing more.', ''].join('\n'),
    options: { storageKey: 'dots', storage: { snapshot: { 'docreader:ui': '{"sidetab":"index"}' } } },
    viewport: { width: 1440, height: 900 },
    csp: undefined,
    html: undefined,
  };
  const figure: Doc = { id: 'synthetic/figure', markdown: FIGURE_MARKDOWN, options: {}, viewport: undefined, csp: 'strict', html: (h) => `${h}${DRAWING}` };
  return [...corpus, ...layout, menu, dots, figure];
}

/** The documents every fixture appearance is run on: between them every chrome piece, mark, card, table and code block. */
const REPRESENTATIVE: readonly string[] = [
  'corpus/spec-template', 'corpus/tables', 'corpus/alerts', 'corpus/lists-tasks', 'corpus/footnotes',
  'layout/changes/rules', 'layout/changes/strip', 'synthetic/changes-menu', 'layout/cards/xrefs', 'layout/rail/marks-index',
  'layout/rail/drawer', 'layout/plans/plan', 'layout/ids/id-table', 'layout/blocks/code', 'layout/settings/attention',
  'layout/jump/dialogs', 'layout/blocks/filter', 'layout/figures/captions', 'synthetic/figure', 'synthetic/status-dots',
  'corpus/fences/main',
];

// ───────── the browser side ─────────

interface St {
  els: Element[];
  /** The style string of each element of the last read (readStyles). */
  rows: string[];
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
    w.__st = { els: [], rows: [], pathOf, parse, over, finish };
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
  // Size: a rule that leaks into the no-appearance output moves a box before it moves a colour.
  'width', 'height', 'min-height', 'font-size', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
];

type Variant = '::before' | '::after' | '::selection';

interface StyleRead {
  /**
   * A hash of each element's style string, in document order. The strings stay in the page (St.rows) and are fetched for the
   * elements that differ only: the largest documents have tens of thousands of elements, and a string each (sizes make most of
   * them unique) held in two pages at once, five documents at a time, is what the test slice's memory cap cut short.
   */
  readonly hashes: readonly string[];
}

/**
 * Wait until the reader has finished its figures, then two frames, so scroll-driven and observer-driven class changes have
 * run before a read. A figure's tools and its definition cues (a ring and a dot on each defined node) are added after it is
 * drawn: CI's WebKit run at the third round's tip read one page before its cues were painted (198 against 196 elements). The
 * condition is the reader's own marks, on each page by itself and never compared between the two: no figure is drawing; every
 * drawn figure that is shown has its tools marked `data-diagram-tools="true"`; and every defined node (`.dnode`) of a shown
 * drawing holds its `.dn-ring` and `.dn-dot`. Bounded at 10 s; a page that does not get there fails, named.
 */
async function settle(page: Page): Promise<void> {
  const done = await page
    .waitForFunction(
      () => {
        const root = document.querySelector('[data-docreader-root]');
        const st = root?.getAttribute('data-docreader-diagrams');
        if (st === 'drawing' || st === 'waiting') return false;
        for (const fig of Array.from(document.querySelectorAll('figure.mermaid-figure.drawn'))) {
          const svg = fig.querySelector('pre.mermaid > svg');
          if (svg === null || svg.getClientRects().length === 0) continue;
          if (fig.querySelector('.tools[data-diagram-tools="true"]') === null) return false;
          for (const g of Array.from(svg.querySelectorAll('.dnode'))) {
            if (g.querySelector(':scope > .dn-ring') === null || g.querySelector(':scope > .dn-dot') === null) return false;
          }
        }
        return true;
      },
      undefined,
      { polling: 'raf', timeout: 10_000 },
    )
    .then(() => true, () => false);
  if (!done) throw new Error("test 4 (a): the reader did not finish its figures within 10 s (a figure drawing, a shown figure's tools unmarked, or a defined node without its ring and dot)");
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
      const hash = (text: string): string => {
        let h1 = 0x811c9dc5;
        let h2 = 5381;
        for (let k = 0; k < text.length; k += 1) {
          const c = text.charCodeAt(k);
          h1 = Math.imul(h1 ^ c, 16777619);
          h2 = (Math.imul(h2, 33) + c) | 0;
        }
        return `${(h1 >>> 0).toString(36)}.${(h2 >>> 0).toString(36)}.${text.length.toString(36)}`;
      };
      const rows: string[] = [];
      const hashes: string[] = [];
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
        rows.push(s);
        hashes.push(hash(s));
      }
      st.rows = rows;
      return { hashes };
    },
    [PROPS, variants] as const,
  );
}

/** One element's row string, split: its tag, then its own values, then each pseudo-element's by name. */
function splitRow(s: string): { readonly tag: string; readonly values: Map<string, string[]> } {
  const values = new Map<string, string[]>();
  let tag = '';
  s.split('~').forEach((chunk, k) => {
    if (k === 0) {
      const fields = chunk.split('|');
      tag = fields[0] as string;
      values.set('', fields.slice(1));
    } else {
      const at = chunk.indexOf('=');
      values.set(chunk.slice(0, at), chunk.slice(at + 1) === '-' ? [] : chunk.slice(at + 1).split('|'));
    }
  });
  return { tag, values };
}

/**
 * The tolerance (ccrc D-8827): a length, a value that is a number of px, is the same as another within 0.1 px, which is
 * scripts/visual/compare.mjs's TOLERANCE. A box the reader sizes from measured text (a definition ring's rect) can land a
 * sub-pixel apart between two pages that differ in nothing a rule sets (0.0625 px on WebKit). Every other value, and a px
 * value against a value that is not one, is the same only when it is equal. The unit rows below pin the width: 0.25 px and
 * 0.5 px apart differ, so a tolerance widened to 0.5 px is red.
 */
const PX = /^-?\d+(?:\.\d+)?px$/;
function same(x: string, y: string): boolean {
  return x === y || (PX.test(x) && PX.test(y) && Math.abs(parseFloat(x) - parseFloat(y)) <= 0.1 + 1e-9);
}

/**
 * What differs between two elements' row strings: a part for a different tag (a different element at the same index is a
 * difference even when every computed value is equal) and one for each property, per pseudo-element, that is not `same`.
 */
function rowDiff(ta: string, tb: string): string[] {
  const a = splitRow(ta);
  const b = splitRow(tb);
  const parts: string[] = [];
  if (a.tag !== b.tag) parts.push(`tag: ${a.tag} -> ${b.tag}`);
  for (const [name, xs] of a.values) {
    const ys = b.values.get(name) ?? [];
    if (xs.length !== ys.length) parts.push(`${name} content differs`);
    else PROPS.forEach((prop, j) => (!same(xs[j] as string, ys[j] as string) ? parts.push(`${name}${name === '' ? '' : ' '}${prop}: ${xs[j] as string} -> ${ys[j] as string}`) : undefined));
  }
  return parts;
}

/** The most elements of a differing pair whose values are read: past it the elements are reported as differing, unread. */
const READ_LIMIT = 2000;

/**
 * What differs between two reads: a line for the first elements that do, with the properties that differ. The rule: an
 * element whose hash differs is read, and reported when a property is not `same` (a sub-pixel move is not reported); at
 * most READ_LIMIT (2 000) such elements are read, and when more than that differ the count is reported as differing,
 * whatever their values.
 */
async function differences(label: string, ra: StyleRead, rb: StyleRead, pa: Page, pb: Page, limit = 6): Promise<string[]> {
  if (ra.hashes.length !== rb.hashes.length) return [`${label}: the pages have ${String(ra.hashes.length)} and ${String(rb.hashes.length)} elements`];
  const bad: number[] = [];
  for (let i = 0; i < ra.hashes.length; i += 1) if (ra.hashes[i] !== rb.hashes[i]) bad.push(i);
  if (bad.length === 0) return [];
  const lines: string[] = [];
  for (const i of bad.slice(0, READ_LIMIT)) {
    const [ta, tb] = await Promise.all([pa, pb].map((pg) => pg.evaluate((n) => (window as unknown as { __st: St }).__st.rows[n] as string, i)));
    const parts = rowDiff(ta as string, tb as string);
    if (parts.length === 0) continue;
    const where = await pa.evaluate((n) => (window as unknown as { __st: St }).__st.pathOf((window as unknown as { __st: St }).__st.els[n] as Element, 6), i);
    lines.push(`    ${where}: ${parts.slice(0, 4).join('; ')}`);
  }
  if (lines.length === 0 && bad.length <= READ_LIMIT) return [];
  return [`${label}: ${String(bad.length > READ_LIMIT ? bad.length : lines.length)} element(s) differ`, ...lines.slice(0, limit)];
}

// ───────── the states ─────────

interface State {
  readonly name: string;
  readonly chromiumOnly?: true;
  readonly variants?: readonly Variant[];
  /** A state of the In short switch (parity Task 5): read by (b) and (c), which open each document with `inShort` on; (a) opens none that way. */
  readonly needsSwitch?: true;
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
  {
    name: 'short-headlines',
    needsSwitch: true,
    async apply(page) {
      const found = await page.evaluate(() => {
        const b = document.querySelector('.short-view button');
        if (!(b instanceof HTMLElement)) return false;
        b.click();
        return true;
      });
      if (!found) return false;
      await frames(page);
      return page.evaluate(() => document.querySelector('.short.headlines .rest') !== null && document.querySelector('.short-view button[aria-pressed="true"]')?.textContent === 'Headlines');
    },
    async clear(page) {
      await page.evaluate(() => {
        const b = document.querySelectorAll('.short-view button')[1];
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
 * A scratch copy of the stylesheet to read in place of the package's (DOCREADER_STYLE_UNDER_TEST=<file>), for measuring a
 * mutation row without editing assets/reader.css: every page that is not given a stylesheet of its own is served this one.
 */
const STYLE_UNDER_TEST = process.env['DOCREADER_STYLE_UNDER_TEST'] === undefined || process.env['DOCREADER_STYLE_UNDER_TEST'] === '' ? undefined : readFileSync(process.env['DOCREADER_STYLE_UNDER_TEST'], 'utf8');

/**
 * Open a document with the harness, and check that its stylesheet loaded: a page whose stylesheet request failed would be
 * unstyled in both pages of a comparison, and look like an equal pair. It is opened again (twice at most) before a failure.
 */
async function open(doc: Doc, browser: BrowserName, extra: { options?: Readonly<Record<string, unknown>>; stylesheet?: string; layout?: HarnessLayout }): Promise<OpenedDoc> {
  let last = '';
  const stylesheet = extra.stylesheet ?? STYLE_UNDER_TEST;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const opened = await openDoc(doc.markdown, extra.options ?? doc.options, {
      browser,
      ...(doc.viewport === undefined ? {} : { viewport: doc.viewport }),
      ...(doc.csp === undefined ? {} : { csp: doc.csp }),
      ...(doc.html === undefined ? {} : { html: doc.html }),
      ...(stylesheet === undefined ? {} : { stylesheet }),
      ...(extra.layout === undefined ? {} : { layout: extra.layout }),
    });
    const rules = await opened.page.evaluate(() => Array.from(document.styleSheets).reduce((n, sheet) => n + sheet.cssRules.length, 0));
    if (rules > 200 && opened.missing.length === 0 && opened.aborted.length === 0) return opened;
    last = `${doc.id}: ${String(rules)} rules loaded, missing ${JSON.stringify(opened.missing)}, aborted ${JSON.stringify(opened.aborted)}`;
    await opened.close();
  }
  throw new Error(`the stylesheet did not load in three tries: ${last}`);
}

/**
 * The colour modes 1.1.0's stylesheet answers to, which (a) reads each of: the light default, the system's dark scheme (its
 * `prefers-color-scheme: dark` block, with the theme left on auto), the stored theme `dark` (`data-theme="dark"`, a second
 * copy of the dark rules) and print.
 */
type Mode = 'light' | 'scheme-dark' | 'theme-dark' | 'print';

/** The options of a document with the stored theme set to dark (its other stored values kept). */
function withDarkTheme(options: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const storage = (options['storage'] ?? {}) as { snapshot?: Record<string, string> };
  const prefs = JSON.parse(storage.snapshot?.['docreader:prefs'] ?? '{}') as Record<string, unknown>;
  return { ...options, storage: { ...storage, snapshot: { ...storage.snapshot, 'docreader:prefs': JSON.stringify({ ...prefs, theme: 'dark' }) } } };
}

/** Put an opened page in a mode, and check that it is in it: a mode that did not take would compare two light pages. */
async function inMode(opened: OpenedDoc, mode: Mode, id: string): Promise<void> {
  const page = opened.page;
  if (mode === 'scheme-dark') await page.emulateMedia({ colorScheme: 'dark' });
  if (mode === 'print') await page.emulateMedia({ media: 'print' });
  await frames(page);
  const got = await page.evaluate(() => ({
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
    print: matchMedia('print').matches,
    theme: document.querySelector('[data-docreader-root]')?.getAttribute('data-theme') ?? null,
  }));
  const want = { dark: mode === 'scheme-dark', print: mode === 'print', theme: mode === 'theme-dark' ? 'dark' : null };
  if (got.dark !== want.dark || got.print !== want.print || got.theme !== want.theme) throw new Error(`${id}: the page is not in mode ${mode}: ${JSON.stringify(got)}`);
}

/** One document, current stylesheet against `other`, in the given states and mode: the lines that differ. */
async function compareDoc(doc: Doc, browser: BrowserName, other: string, count = true, mode: Mode = 'light', only: readonly string[] | null = null): Promise<string[]> {
  const options = mode === 'theme-dark' ? withDarkTheme(doc.options) : doc.options;
  const a = await open(doc, browser, { options });
  const b = await open(doc, browser, { options, stylesheet: other });
  const out: string[] = [];
  try {
    await inMode(a, mode, doc.id);
    await inMode(b, mode, doc.id);
    for (const st of STATES) {
      if (st.chromiumOnly === true && browser !== 'chromium') continue;
      if (st.needsSwitch === true) continue;
      if (only !== null && !only.includes(st.name)) continue;
      const began = Date.now();
      const ok = [await st.apply(a.page), await st.apply(b.page)];
      const label = `${doc.id}${mode === 'light' ? '' : ` [${mode}]`} / ${st.name}`;
      if (ok[0] !== ok[1]) out.push(`${label}: the state is reached on one page only`);
      else if (ok[0] === true) {
        if (count && mode === 'light') reached.set(st.name, (reached.get(st.name) ?? 0) + 1);
        const vars = st.variants ?? (['::before', '::after'] as const);
        const ra = await readStyles(a.page, vars);
        const rb = await readStyles(b.page, vars);
        out.push(...(await differences(label, ra, rb, a.page, b.page)));
      }
      await st.clear(a.page);
      await st.clear(b.page);
      if (process.env['DOCREADER_STYLE_TIMING'] === '1') console.log(`timing ${label} ${String(Date.now() - began)} ms`);
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

/** Every document, the layout cases that draw Mermaid included: row (a)'s. */
const DOCS_A = allDocs();
/** The documents the (b) and (c) sweeps read: those that draw no Mermaid, for cost (they load the Mermaid bundle per page). */
const DOCS = DOCS_A.filter((d) => d.mermaid !== true);
/** The documents read under print media: one of prose and tables, one of code, one of changed marks, one with a figure. */
/** The representative documents read in the dark modes: those with highlighted code, chrome, marks, cards, tables and the dots. */
const DARKENED: readonly string[] = [
  'corpus/fences/main', 'corpus/spec-template', 'corpus/tables', 'layout/blocks/code', 'layout/changes/rules', 'layout/cards/xrefs',
  'layout/jump/dialogs', 'layout/rail/marks-index', 'layout/plans/plan', 'layout/settings/attention', 'synthetic/status-dots', 'synthetic/figure',
];
const PRINTED: readonly string[] = ['corpus/spec-template', 'layout/blocks/code', 'layout/changes/rules', 'synthetic/figure'];
const reps = DOCS.filter((d) => REPRESENTATIVE.includes(d.id));

describe('test 4 (a): the comparison predicate and the per-element line', () => {
  it('differences(): more than READ_LIMIT differing hashes report the count line, unread (third review F11)', async () => {
    // 2 001 elements whose hashes differ but whose rows read the same: within the limit they would be read and dropped; past it
    // the count is reported as differing, whatever the values.
    const n = READ_LIMIT + 1;
    const ra = { hashes: Array.from({ length: n }, (_, i) => `a${String(i)}`) } as unknown as StyleRead;
    const rb = { hashes: Array.from({ length: n }, (_, i) => `b${String(i)}`) } as unknown as StyleRead;
    const page = { evaluate: async (): Promise<string> => Promise.resolve('p|0px') } as unknown as Page;
    const out = await differences('two reads', ra, rb, page, page);
    expect(out[0]).toBe(`two reads: ${String(n)} element(s) differ`);
  });
  it('same(): px values within 0.1 px are equal; 0.25 px and 0.5 px apart differ (a tolerance widened to 0.5 px is red)', () => {
    expect(same('3px', '3px')).toBe(true);
    expect(same('3px', '3.05px')).toBe(true);
    expect(same('3px', '3.1px')).toBe(true);
    expect(same('3.1px', '3px')).toBe(true);
    expect(same('3px', '3.25px')).toBe(false);
    expect(same('3px', '3.5px')).toBe(false);
    expect(same('3.5px', '3px')).toBe(false);
    expect(same('-0.5px', '0px')).toBe(false);
    expect(same('0px', '-0.0625px')).toBe(true);
  });

  it('same(): a value that is not a px length is compared exactly, and a px value never equals one that is not', () => {
    expect(same('rgb(1, 2, 3)', 'rgb(1, 2, 3)')).toBe(true);
    expect(same('rgb(1, 2, 3)', 'rgb(1, 2, 4)')).toBe(false);
    expect(same('1.05em', '1em')).toBe(false);
    expect(same('0.05', '0')).toBe(false);
    expect(same('3.05%', '3%')).toBe(false);
    expect(same('normal', '0px')).toBe(false);
    expect(same('0.05px solid', '0px solid')).toBe(false);
  });

  it('rowDiff(): a sub-pixel length is not reported, a half-pixel one is, and a different tag at the same index is', () => {
    const row = (tag: string, w: string): string => `${tag}|${PROPS.map((p) => (p === 'width' ? w : 'x')).join('|')}`;
    expect(rowDiff(row('p', '100px'), row('p', '100.05px'))).toEqual([]);
    expect(rowDiff(row('p', '100px'), row('p', '100.5px'))).toEqual(['width: 100px -> 100.5px']);
    // Every computed value equal, the tag not: the old split dropped the tag and returned no line.
    expect(rowDiff(row('p', '100px'), row('div', '100px'))).toEqual(['tag: p -> div']);
    // A pseudo-element's values are read the same way.
    const withBefore = (w: string): string => `${row('p', '1px')}~::before=${PROPS.map((p) => (p === 'width' ? w : 'x')).join('|')}`;
    expect(rowDiff(withBefore('10px'), withBefore('10.5px'))).toEqual(['::before width: 10px -> 10.5px']);
    expect(rowDiff(withBefore('10px'), withBefore('10.05px'))).toEqual([]);
  });
});

describeBrowsers((browser) => {
  it('the v1.1.0 tag is in the checkout and its stylesheet is the 1.1.0 one', () => {
    const css = v110();
    expect(css.length).toBeGreaterThan(10_000);
    expect(css).toContain('[data-docreader-root]');
    expect(css).not.toContain('data-docreader-hosted');
  });

  it('the status-dots document shows the four dots of the contents index', async () => {
    const d = await open(DOCS.find((x) => x.id === 'synthetic/status-dots') as Doc, browser, {});
    try {
      const shown = await d.page.evaluate(() =>
        ['ok', 'wait', 'no', 'info'].map((role) => Array.from(document.querySelectorAll(`.toc-index .dot.${role}`)).filter((e) => e.getClientRects().length > 0).length),
      );
      expect(shown).toEqual([1, 1, 1, 1]);
    } finally {
      await d.close();
    }
  }, 60_000);

  it('the comparison goes red on a stylesheet that differs (the comparator is live)', async () => {
    const doc = DOCS.find((d) => d.id === 'corpus/headings') as Doc;
    const changed = `${v110()}\n[data-docreader-root] p { color: rgb(1, 2, 3); }\n[data-docreader-root] a { outline: 2px solid rgb(4, 5, 6); }\n`;
    const out = await compareDoc(doc, browser, changed, false);
    expect(out.length).toBeGreaterThan(0);
    expect(out.join('\n')).toContain('color:');
  }, 120_000);

  it('the comparison reports a 0.5 px leak (the tolerance is 0.1 px: a tolerance widened to 0.5 px is red)', async () => {
    // 1.1.0's stylesheet plus one rule that adds half a pixel to a margin of a known element: not within the tolerance, so
    // the comparison must name it. (A margin is not snapped to device pixels, as a border width is.)
    const doc = DOCS.find((d) => d.id === 'corpus/headings') as Doc;
    const changed = `${v110()}\n[data-docreader-root] p { margin-left: 0.5px !important; }\n`;
    const out = await compareDoc(doc, browser, changed, false);
    expect(out.join('\n')).toContain('margin-left: 0px -> 0.5px');
  }, 120_000);

  describe('(a) no appearance: the computed styles equal 1.1.0\'s', () => {
    for (const doc of DOCS_A) {
      it.concurrent(doc.id, async () => {
        const out = await compareDoc(doc, browser, v110());
        if (out.length > 0) throw new Error(`computed styles moved from ${TAG}:\n${out.join('\n')}`);
      }, 180_000);
    }

    for (const mode of ['scheme-dark', 'theme-dark'] as const) {
      for (const doc of reps.filter((d) => DARKENED.includes(d.id))) {
        it.concurrent(`${doc.id} [${mode}]`, async () => {
          const out = await compareDoc(doc, browser, v110(), true, mode);
          if (out.length > 0) throw new Error(`computed styles moved from ${TAG} in ${mode}:\n${out.join('\n')}`);
        }, 180_000);
      }
    }

    for (const id of PRINTED) {
      it.concurrent(`${id} [print]`, async () => {
        const out = await compareDoc(DOCS.find((d) => d.id === id) as Doc, browser, v110(), true, 'print', ['rest', 'selection']);
        if (out.length > 0) throw new Error(`computed styles moved from ${TAG} in print:\n${out.join('\n')}`);
      }, 180_000);
    }

    it('every state was reached by some document', () => {
      if (reached.size === 0) return; // this row was run alone
      const missing = STATES.filter((s) => s.needsSwitch !== true && (s.chromiumOnly !== true || browser === 'chromium') && (reached.get(s.name) ?? 0) === 0).map((s) => s.name);
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
  function collect(fixture: Fixture, docs: readonly Doc[], only: readonly string[] | null = null, layout: HarnessLayout = 'default'): Promise<Collected> {
    const key = `${layout}|${fixture.name}|${docs.map((doc) => doc.id).join(',')}|${only === null ? 'all' : only.join(',')}`;
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
        const d = await open(doc, browser, { layout, options: { ...doc.options, inShort: true, appearance: { mode: fixture.mode, colour: fixture.colour } } });
        try {
          const hosted = await d.page.evaluate(() => {
            const r = document.querySelector('[data-docreader-root]');
            return r === null ? null : {
              hosted: r.hasAttribute('data-docreader-hosted'),
              colours: r.hasAttribute('data-docreader-colours'),
              bg: getComputedStyle(r).getPropertyValue('--bg').trim().toLowerCase(),
              layout: r.getAttribute('data-docreader-layout') ?? 'default',
            };
          });
          if (hosted === null || !hosted.hosted || !hosted.colours || hosted.bg !== fixture.colour.bg.toLowerCase() || hosted.layout !== layout) {
            result.notHosted.push(`${layout}/${doc.id}: the requested layout and appearance were not applied (${JSON.stringify(hosted)})`);
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

  /** The documents of a row: the representative ones in every state, under all twelve fixtures; every document (Mermaid's layout cases apart) in every state, under two. */
  const SWEEP = ['Phosphor & Ink', 'Phosphor Daylight'];

  describe('(c) closed grounds: every text element is on one of section 5\'s grounds, in a colour it admits', () => {
    it('the representative documents all exist', () => {
      expect(reps.map((d) => d.id).sort()).toEqual([...REPRESENTATIVE].sort());
    });

    it('the In short switch\'s states are read: some representative document is in Headlines, and some with the switch at rest (Full)', async () => {
      const got = await collect(FIXTURES[0] as Fixture, reps);
      expect(got.stats.states['short-headlines'] ?? 0).toBeGreaterThan(0);
      expect(got.stats.states['rest'] ?? 0).toBeGreaterThan(0);
    }, 1_200_000);

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
      it.concurrent(`${f.name}: every document, every state`, async () => {
        fail(f, await collect(f, DOCS), 'every document, every state');
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
      it(`${f.name}: every document, every state`, async () => {
        fail(f, await collect(f, DOCS), 'every document, every state');
      }, 1_200_000);
    }
  });

  describe('(b) and (c): classic hosted appearance', () => {
    // Between these cases: boxes and badges, status pills, a filter, code copy, contents and jump, and figure chrome.
    const ids = [
      'corpus/spec-template', 'layout/core/editorial', 'layout/rail/drawer', 'layout/jump/dialogs',
      'layout/core/tables', 'layout/blocks/filter', 'layout/blocks/code', 'synthetic/figure',
    ];
    const docs = DOCS.filter((doc) => ids.includes(doc.id));
    const required = ['rest', 'selection', 'jump', 'figure-overlay', 'figure-tool', 'narrow', 'toc-drawer'];
    const states = [...required, 'hover', 'focus-visible'];

    for (const fixture of FIXTURES) {
      it(`classic: ${fixture.name}`, async () => {
        expect(docs.map((doc) => doc.id).sort()).toEqual([...ids].sort());
        const got = await collect(fixture, docs, states, 'classic');
        expect(got.notHosted).toEqual([]);
        expect(got.stats.documents).toBe(docs.length);
        const expected = browser === 'chromium' ? states : required;
        expect(expected.filter((state) => (got.stats.states[state] ?? 0) === 0), 'required classic states not reached').toEqual([]);
        const failures = [
          ...(got.closed.size === 0 ? [] : [report(`${fixture.name}: classic text on a ground that is not closed`, got.closed)]),
          ...(got.contrast.size === 0 ? [] : [report(`${fixture.name}: a classic pair is below its floor`, got.contrast)]),
        ];
        if (failures.length > 0) throw new Error(failures.join('\n'));
      }, 180_000);
    }
  });
});
