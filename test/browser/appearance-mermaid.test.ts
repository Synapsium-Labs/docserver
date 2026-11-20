// Mermaid while hosted, in a real browser (docserver appearance plan, Task 7; the first consumer's design, section 10,
// "Mermaid while hosted", and its test 5). The fixtures are conformance/appearance/mermaid/: one figure per covered kind,
// each drawing every feature its kind colours, the author-styled spellings, a `journey`, the sequence `box` case, and the
// document with a glossary (document.txt) that the figures sit in. The palettes are the twelve fixture appearances
// (conformance/appearance/fixtures.json).
//
// Rows, in the order of test 5: the constant; every key assigned; drawn pairs in all twelve palettes (text against the
// composite of the shapes behind its box, read from the drawing; commit labels and crossed sequence labels from pixels of
// a screenshot with the text hidden; lines, marks inside a commit, the gaps and edges with no floor); closed colours (every
// painted colour, every computed filter, the tooltip shown in turn); the definition cues and the tooltip, pairs; the stick
// arrowheads; author-styled (with its full-screen check and the covered twin); each spelling; outside the constant; init
// directives; a newer appearance cancelling queued redraws.
//
// Measuring. A drawing is measured in the page by one function (measureDrawing): it reads computed values only. The
// "ground" of a text is the composite of the fills painted behind its box: the geometry elements that come before it in
// document order and hold the sample point in their fill (isPointInFill), over the plate behind the drawing, then the
// backgrounds of an HTML label's own ancestors. A label drawn on a translucent box over lines (a gitGraph commit label,
// a crossed sequence label) is read from pixels instead: a screenshot of the drawing with its text visible, and one with
// its text's fill made transparent (the halo stroke stays), and a glyph pixel is one the text covers by 90% or more.
// The tests of one kind and palette share one measurement (a memo per page), so the twelve palettes of a fixture are one
// page whose appearance changes by setEnhancementAppearance.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { build } from 'esbuild';
import type { Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { MERMAID_HOSTED_KINDS, mermaidThemeOf } from '../../src/enhance/appearance-mermaid.js';
import { THEME_VARIABLES } from '../../src/enhance/diagrams.js';
import { closeBrowsers, describeBrowsers, MERMAID_PATH, mermaidFile, openDoc, type BrowserName } from './harness.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIR = path.join(ROOT, 'conformance', 'appearance', 'mermaid');

interface Palette {
  readonly name: string;
  readonly mode: 'light' | 'dark';
  readonly colour: Record<string, string>;
}
const PALETTES = JSON.parse(readFileSync(path.join(ROOT, 'conformance', 'appearance', 'fixtures.json'), 'utf8')) as Palette[];
const DARK = PALETTES.filter((p) => p.mode === 'dark');
const PHOSPHOR = PALETTES[0] as Palette;

const fixture = (name: string): string => readFileSync(path.join(DIR, `${name}.mmd`), 'utf8');
const styledDir = path.join(DIR, 'author-styled');
const STYLED = readdirSync(styledDir)
  .filter((f) => f.endsWith('.mmd'))
  .sort()
  .map((f) => ({ name: f.slice(0, -4), text: readFileSync(path.join(styledDir, f), 'utf8') }));

/** One fixture per covered kind (the flowchart twice), by the file's name. */
const COVERED = ['flowchart', 'flowchart-svg-labels', 'sequence', 'class', 'state', 'gantt', 'pie', 'er', 'gitgraph'] as const;
type CoveredName = (typeof COVERED)[number];

const TEMPLATE = readFileSync(path.join(DIR, 'document.txt'), 'utf8');
const FIGURE_BLOCK = /```mermaid\n@@FIGURE@@\n```\n\n\*Figure 1\. [^\n]*\*\n/;
/** The fixture document with these figures in place of its one. */
function docOf(figures: readonly string[]): string {
  if (!FIGURE_BLOCK.test(TEMPLATE)) throw new Error('document.txt lost its figure block');
  const blocks = figures.map((f, i) => `\`\`\`mermaid\n${f.trimEnd()}\n\`\`\`\n\n*Figure ${String(i + 1)}. Figure number ${String(i + 1)}.*\n`);
  return TEMPLATE.replace(FIGURE_BLOCK, () => blocks.join('\n'));
}

// ───────── colours ─────────

type RGB = readonly [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lin = (v: number): number => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (c: readonly number[]): number => 0.2126 * lin(c[0] as number) + 0.7152 * lin(c[1] as number) + 0.0722 * lin(c[2] as number);
const ratio = (a: readonly number[], b: readonly number[]): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const rgbCss = (c: RGB): string => `rgb(${String(c[0])}, ${String(c[1])}, ${String(c[2])})`;

/** The values of mermaidThemeOf's output that are colours, as lower-case `#rrggbb`. */
const themeColours = (p: Palette): string[] => [...new Set(Object.values(mermaidThemeOf(p.colour as never)).filter((v) => /^#[0-9a-f]{6}$/.test(v)))];

/** The colours a figure's lines may be: `text-muted`, `accent`, `no` and the series, which have a 3:1 floor on `surface` and `surface2`. */
function lineColours(p: Palette): string[] {
  const t = mermaidThemeOf(p.colour as never);
  const series = Array.from({ length: 12 }, (_, i) => t['pie' + String(i + 1)] as string);
  return [...new Set([p.colour['text-muted'], p.colour['accent'], p.colour['no'], ...series].map((c) => (c as string).toLowerCase()))];
}

// ───────── PNG, read as an image ─────────

interface Img {
  readonly w: number;
  readonly h: number;
  readonly d: Uint8Array;
}

/** An 8-bit RGB or RGBA PNG, every row unfiltered, as RGBA. */
function decodePng(png: Buffer): Img {
  let at = 8;
  let w = 0;
  let h = 0;
  let channels = 0;
  const chunks: Buffer[] = [];
  while (at < png.length) {
    const size = png.readUInt32BE(at);
    const type = png.toString('ascii', at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + size);
    if (type === 'IHDR') {
      w = body.readUInt32BE(0);
      h = body.readUInt32BE(4);
      if (body[8] !== 8) throw new Error('PNG: only 8-bit');
      channels = body[9] === 6 ? 4 : body[9] === 2 ? 3 : 0;
    }
    if (type === 'IDAT') chunks.push(body);
    at += 12 + size;
  }
  if (channels === 0) throw new Error('PNG: only RGB and RGBA');
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = w * channels;
  const out = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y += 1) {
    const f = raw[y * (stride + 1)] ?? 0;
    const cur = new Uint8Array(raw.buffer, raw.byteOffset + y * (stride + 1) + 1, stride).slice();
    for (let i = 0; i < stride; i += 1) {
      const a = i < channels ? 0 : (cur[i - channels] as number);
      const b = prev[i] as number;
      const c = i < channels ? 0 : (prev[i - channels] as number);
      let add = 0;
      if (f === 1) add = a;
      else if (f === 2) add = b;
      else if (f === 3) add = Math.floor((a + b) / 2);
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (f !== 0) throw new Error(`PNG: filter ${String(f)}`);
      cur[i] = ((cur[i] as number) + add) & 255;
    }
    for (let x = 0; x < w; x += 1) {
      for (let k = 0; k < 3; k += 1) out[(y * w + x) * 4 + k] = cur[x * channels + k] as number;
      out[(y * w + x) * 4 + 3] = channels === 4 ? (cur[x * channels + 3] as number) : 255;
    }
    prev = cur;
  }
  return { w, h, d: out };
}

interface GlyphRead {
  /** Glyph pixels read. */
  readonly n: number;
  /** The least contrast of a glyph pixel against the same pixel of the text-hidden image. */
  readonly min: number;
}

/**
 * The glyph pixels of `box` (in image pixels) and their worst contrast against the ground. `shown` has the text, `hidden`
 * the same place with the text's fill made transparent (its halo stroke stays). A pixel's coverage by the text is its
 * distance from the ground projected on the text colour's distance from it. The text colour is given, or the pixel of the
 * box farthest from the ground.
 */
function glyphs(shown: Img, hidden: Img, box: { x: number; y: number; w: number; h: number }, text: RGB | null): GlyphRead {
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(shown.w, Math.ceil(box.x + box.w));
  const y1 = Math.min(shown.h, Math.ceil(box.y + box.h));
  const px = (img: Img, x: number, y: number): RGB => [img.d[(y * img.w + x) * 4] as number, img.d[(y * img.w + x) * 4 + 1] as number, img.d[(y * img.w + x) * 4 + 2] as number];
  let t = text;
  if (t === null) {
    let far = 0;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const a = px(shown, x, y);
        const b = px(hidden, x, y);
        const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
        if (d > far) {
          far = d;
          t = a;
        }
      }
    }
  }
  if (t === null) return { n: 0, min: Infinity };
  let n = 0;
  let min = Infinity;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const a = px(shown, x, y);
      const b = px(hidden, x, y);
      const dt = [t[0] - b[0], t[1] - b[1], t[2] - b[2]];
      const den = dt[0]! ** 2 + dt[1]! ** 2 + dt[2]! ** 2;
      if (den < 400) continue;
      const cov = ((a[0] - b[0]) * dt[0]! + (a[1] - b[1]) * dt[1]! + (a[2] - b[2]) * dt[2]!) / den;
      // With the text colour known, a pixel the text inks by 40% or more is a glyph pixel, and what it is judged on is the
      // text colour against the ground under it (thin strokes of small, rotated text never reach 90%); with it unknown
      // (a drawing under a filter) a glyph pixel is one inked by 90% or more, and the pixel itself is judged.
      if (text !== null ? cov < 0.4 || cov > 1.3 : cov < 0.9 || cov > 1.2) continue;
      n += 1;
      min = Math.min(min, text !== null ? ratio(t, b) : ratio(a, b));
    }
  }
  return { n, min };
}

// ───────── a page ─────────

// The page's reader API. The frame's own entry (src/frame-runtime/enhance-entry.ts) also marks the `html` element and sets
// `--dr-tip-bg`, `--dr-tip-fg` and `--dr-tip-edge` for Mermaid's tooltip, which sits in `body` outside the reader's root;
// this page has no frame, so the entry below does the same from the same verdict (the rule that reads them is the library's).
const ENTRY = `
import { hostedVerdict } from './src/enhance/appearance.ts';
import { destroyEnhancement, enhance, setEnhancementAppearance } from './src/enhance/index.ts';
const mark = (value) => {
  const verdict = hostedVerdict(value);
  if (verdict === null) return;
  const html = document.documentElement;
  const { colour } = verdict;
  if (colour === undefined) {
    html.removeAttribute('data-docreader-hosted');
    for (const n of ['--dr-tip-bg', '--dr-tip-fg', '--dr-tip-edge']) html.style.removeProperty(n);
    return;
  }
  html.setAttribute('data-docreader-hosted', '');
  for (const [n, slot] of [['--dr-tip-bg', 'surface'], ['--dr-tip-fg', 'text'], ['--dr-tip-edge', 'border']]) html.style.setProperty(n, colour[slot]);
};
window.__dg = {
  enhance: (root, options) => { const done = enhance(root, options); mark(options && options.appearance); return done; },
  setEnhancementAppearance: (root, value) => { setEnhancementAppearance(root, value); mark(value); },
  destroyEnhancement,
};
`;
let script = '';

/** The page's Mermaid load: the package's file, wrapped so each initialize and render is recorded. */
const INSTALL_LOAD = `
window.__calls = [];
window.__loadM = () => import(${JSON.stringify(MERMAID_PATH)}).then((m) => {
  const api = m.default;
  const wrapped = new Proxy(api, { get(t, k) {
    const v = Reflect.get(t, k, t);
    if (k === 'initialize') return (c) => { const tv = (c && c.themeVariables) || {}; window.__calls.push({ type: 'initialize', primary: tv.primaryColor === undefined ? null : String(tv.primaryColor), hosted: tv.dropShadow === 'none' }); return v.call(t, c); };
    if (k === 'render') return (...a) => { window.__calls.push({ type: 'render' }); return v.apply(t, a); };
    return typeof v === 'function' ? v.bind(t) : v;
  } });
  return { default: wrapped };
});
`;

const ROOT_SEL = 'main[data-harness-root]';
const DRAWING_SEL = `${ROOT_SEL} figure.mermaid-figure > pre[data-docreader-chrome] > svg`;
const APPEARANCE = (p: Palette): { mode: string; colour: Record<string, string> } => ({ mode: p.mode, colour: p.colour });

interface Opened {
  readonly page: Page;
  close(): Promise<void>;
  /** setEnhancementAppearance, then wait for every drawing to be redrawn (or, with `redraw: false`, a quiet moment). */
  set(value: unknown, redraw?: boolean): Promise<void>;
}

/** Wait until no figure is being drawn, and two frames have passed. */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelector('main[data-harness-root]')?.getAttribute('data-docreader-diagrams') !== 'drawing', null, { timeout: 60_000 });
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  // the figure tools paint a definition node's ring and dot once its drawing is in view
  await page
    .waitForFunction(() => Array.from(document.querySelectorAll('main[data-harness-root] svg .dnode')).every((g) => g.querySelector(':scope > .dn-ring') !== null && g.querySelector(':scope > .dn-dot') !== null), null, { timeout: 8000 })
    .catch(() => undefined);
}

/** The figures of `figures`, drawn by the reader in a page, with the clock fixed inside the gantt's range. */
async function openFigures(browser: BrowserName, figures: readonly string[], appearance?: unknown): Promise<Opened> {
  const doc = await openDoc(docOf(figures), {}, { browser, csp: 'reader', enhance: false, mermaid: true });
  const { page } = doc;
  try {
    await page.evaluate(script);
    await page.evaluate(INSTALL_LOAD);
    await page.clock.setFixedTime('2026-02-10T12:00:00Z');
    await page.addStyleTag({ content: `${ROOT_SEL} :is(.topbar, .tools, .doc-progress, .aa-wrap, .toc-rail) { visibility: hidden !important; }` });
    await page.evaluate(
      async (a: { appearance: unknown }) => {
        const w = window as unknown as { __dg: { enhance(root: HTMLElement, o: unknown): Promise<void> }; __loadM: () => Promise<unknown> };
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        const options: Record<string, unknown> = { mermaid: { load: () => w.__loadM() } };
        if (a.appearance !== null) options['appearance'] = a.appearance;
        await w.__dg.enhance(root, options);
        const started = performance.now();
        while (root.getAttribute('data-docreader-diagrams') !== 'drawn') {
          if (performance.now() - started > 90_000) throw new Error(`the figures did not draw: ${String(root.getAttribute('data-docreader-diagrams'))}`);
          await new Promise((r) => setTimeout(r, 25));
        }
        await document.fonts.ready;
      },
      { appearance: appearance ?? null },
    );
    await settled(page);
  } catch (e) {
    await doc.close().catch(() => undefined);
    throw e;
  }
  return {
    page,
    close: () => doc.close(),
    async set(value, redraw = true) {
      await page.evaluate((v) => {
        const root = document.querySelector('main[data-harness-root]') as HTMLElement;
        for (const s of Array.from(root.querySelectorAll('figure.mermaid-figure > pre[data-docreader-chrome] > svg'))) (s as unknown as { __old: boolean }).__old = true;
        (window as unknown as { __dg: { setEnhancementAppearance(r: HTMLElement, v: unknown): void } }).__dg.setEnhancementAppearance(root, v);
      }, value);
      if (redraw) {
        await page.waitForFunction(
          () => Array.from(document.querySelectorAll('main[data-harness-root] figure.mermaid-figure > pre[data-docreader-chrome] > svg')).every((s) => !(s as unknown as { __old?: boolean }).__old),
          null,
          { timeout: 90_000 },
        );
      } else await page.waitForTimeout(500);
      await settled(page);
    },
  };
}

beforeAll(async () => {
  await mermaidFile();
  const r = await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, sourcefile: 'appearance-mermaid-entry.ts', loader: 'js' },
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

// ───────── the measurement, in the page ─────────

interface Part {
  checked: number;
  failures: string[];
}
interface Measured {
  missing?: true;
  hosted: boolean;
  texts: Part;
  lines: Part;
  marks: Part;
  closed: Part;
  filters: Part;
  sticks: Part;
}
interface MeasureArg {
  svgSel: string;
  index: number;
  surface: string;
  surface2: string;
  lineSet: string[];
  allowed: string[];
  focus: string;
  accent: string;
  bg: string;
  textMuted: string;
  /** A pie label of a slice at or under this percentage is Mermaid's crowded layout (section 10, "Crossings"). */
  crowdedPieMax: number;
}

/** The drawing `index` of `svgSel`, measured: texts, lines, marks, closed colours, filters and stick arrowheads. */
function measureDrawing(arg: MeasureArg): Measured {
  const part = (): Part => ({ checked: 0, failures: [] });
  const svg = document.querySelectorAll(arg.svgSel)[arg.index] as SVGSVGElement | undefined;
  if (svg === undefined) return { missing: true, hosted: false, texts: part(), lines: part(), marks: part(), closed: part(), filters: part(), sticks: part() };
  type RGB = [number, number, number];
  const out: Measured = { hosted: svg.hasAttribute('data-docreader-hosted-figure'), texts: part(), lines: part(), marks: part(), closed: part(), filters: part(), sticks: part() };
  const cs = (e: Element): CSSStyleDeclaration => getComputedStyle(e);
  const hexOf = (c: readonly number[]): string => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const parse = (s: string): [number, number, number, number] | null => {
    const t = s.trim();
    if (t === 'transparent') return [0, 0, 0, 0];
    const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(t);
    if (m !== null) {
      const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return [Number(m[1]), Number(m[2]), Number(m[3]), a];
    }
    const n = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/.exec(t);
    if (n !== null) return [Number(n[1]) * 255, Number(n[2]) * 255, Number(n[3]) * 255, n[4] === undefined ? 1 : Number(n[4])];
    return null;
  };
  const lin = (v: number): number => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lum = (c: readonly number[]): number => 0.2126 * lin(c[0] as number) + 0.7152 * lin(c[1] as number) + 0.0722 * lin(c[2] as number);
  const ratio = (a: readonly number[], b: readonly number[]): number => {
    const x = lum(a);
    const y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const over = (c: readonly number[], below: RGB): RGB => [0, 1, 2].map((i) => (c[i] as number) * (c[3] as number) + below[i]! * (1 - (c[3] as number))) as RGB;
  const hexRgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const SKIP = 'defs, marker, clipPath, mask, pattern, symbol, style, title, desc, filter, linearGradient, radialGradient';
  const holder = svg.parentElement as Element;
  const rendered = (e: Element): boolean => {
    if (e.closest(SKIP) !== null) return false;
    const s = cs(e);
    if (s.visibility === 'hidden' || s.visibility === 'collapse') return false;
    for (let n: Element | null = e; n !== null && n !== holder; n = n.parentElement) if (cs(n).display === 'none') return false;
    return true;
  };
  const opacityOf = (e: Element): number => {
    let o = 1;
    for (let n: Element | null = e; n !== null && n !== holder; n = n.parentElement) o *= parseFloat(cs(n).opacity);
    return o;
  };
  const label = (e: Element): string => `${e.localName}.${(e.getAttribute('class') ?? '').trim().replace(/\s+/g, '.')}`;
  const surface = hexRgb(arg.surface);
  const surface2 = hexRgb(arg.surface2);
  const lineSet = new Set(arg.lineSet);
  const allowed = new Set(arg.allowed);

  // the plate behind the drawing
  let base: RGB = [255, 255, 255];
  const chain: Element[] = [];
  for (let n: Element | null = holder; n !== null; n = n.parentElement) chain.push(n);
  for (const n of chain.reverse()) {
    const c = parse(cs(n).backgroundColor);
    if (c !== null && c[3] > 0) base = over(c, base);
  }

  // the painted geometry, in document order
  interface Geom {
    el: SVGGeometryElement;
    rect: DOMRect;
    rgb: RGB;
    alpha: number;
    inv: DOMMatrix;
  }
  const geoms: Geom[] = [];
  for (const el of Array.from(svg.querySelectorAll('rect, circle, ellipse, polygon, polyline, path'))) {
    if (!rendered(el)) continue;
    const s = cs(el);
    const c = parse(s.fill);
    if (c === null) continue;
    const alpha = c[3] * parseFloat(s.fillOpacity) * opacityOf(el);
    const ctm = (el as unknown as SVGGraphicsElement).getScreenCTM();
    if (alpha <= 0 || ctm === null) continue;
    geoms.push({ el: el as unknown as SVGGeometryElement, rect: el.getBoundingClientRect(), rgb: [c[0], c[1], c[2]], alpha, inv: ctm.inverse() });
  }
  const groundAt = (t: Element, x: number, y: number): RGB => {
    let g = base;
    for (const q of geoms) {
      if ((q.el.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING) === 0) continue;
      if (x < q.rect.left || x > q.rect.right || y < q.rect.top || y > q.rect.bottom) continue;
      if (!q.el.isPointInFill(new DOMPoint(x, y).matrixTransform(q.inv))) continue;
      g = over([q.rgb[0], q.rgb[1], q.rgb[2], q.alpha], g);
    }
    return g;
  };

  // used markers
  const usedMarkers = new Set<string>();
  for (const e of Array.from(svg.querySelectorAll('*'))) {
    if (!rendered(e)) continue;
    const s = cs(e);
    for (const k of [s.markerStart, s.markerMid, s.markerEnd]) {
      const m = /url\("?#([^")]+)"?\)/.exec(k);
      if (m !== null) usedMarkers.add(m[1] as string);
    }
  }
  const markerKids: Element[] = [];
  for (const id of usedMarkers) {
    const mk = document.getElementById(id);
    if (mk !== null) markerKids.push(...Array.from(mk.querySelectorAll('path, circle, ellipse, rect, polygon, polyline, line')));
  }

  // texts
  const holders: Element[] = [];
  const walker = document.createTreeWalker(svg, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    const p = n.parentElement;
    if (p === null || (n.nodeValue ?? '').trim() === '' || p.closest(SKIP) !== null || holders.includes(p)) continue;
    holders.push(p);
  }
  for (const h of holders) {
    if (!rendered(h)) continue;
    const r = h.getBoundingClientRect();
    const op = opacityOf(h);
    if (r.width <= 0 || r.height <= 0 || op < 0.05) continue;
    if (h.matches('.commit-label')) continue; // from pixels
    const text = (h.textContent ?? '').trim();
    if (h.classList.contains('slice') && parseFloat(text) <= arg.crowdedPieMax) continue; // Mermaid's crowded pie labels
    const isSvg = h instanceof SVGElement;
    const s = cs(h);
    const c = parse(isSvg ? s.fill : s.color);
    if (c === null) continue;
    const alpha = c[3] * op * (isSvg ? parseFloat(s.fillOpacity) : 1);
    const htmlBg: [number, number, number, number][] = [];
    if (!isSvg) {
      for (let n: Element | null = h; n !== null && n.localName !== 'foreignobject'; n = n.parentElement) {
        const b = parse(cs(n).backgroundColor);
        if (b !== null && b[3] > 0) htmlBg.unshift(b);
      }
    }
    const points: [number, number][] = [[0.5, 0.5], [0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.5, 0.75]].map(([fx, fy]) => [r.left + r.width * (fx as number), r.top + r.height * (fy as number)]);
    let worst = Infinity;
    let worstGround: RGB = base;
    for (const [x, y] of points as [number, number][]) {
      let g = groundAt(h, x, y);
      if (h.classList.contains('sequenceNumber')) {
        const mk = svg.querySelector('marker[id$="-sequencenumber"] circle');
        const f = mk === null ? null : parse(cs(mk).fill);
        if (f !== null) g = [f[0], f[1], f[2]];
      }
      for (const b of htmlBg) g = over(b, g);
      const v = ratio(over([c[0], c[1], c[2], alpha], g), g);
      if (v < worst) {
        worst = v;
        worstGround = g;
      }
    }
    out.texts.checked += 1;
    if (worst < 4.5) out.texts.failures.push(`${label(h)} "${text.slice(0, 24)}" ${worst.toFixed(2)}:1 on ${hexOf(worstGround)}`);
  }

  // lines, closed colours, filters
  const markSel = '.commit-highlight-inner, .commit-highlight-outer, .commit-reverse, .commit-merge, .commit-cherry-pick';
  const painters = [...Array.from(svg.querySelectorAll('rect, circle, ellipse, line, polygon, polyline, path')).filter((e) => rendered(e)), ...markerKids];
  const closed = (e: Element, prop: string, value: string, alphaMul = 1): void => {
    const c = parse(value);
    if (c === null) return;
    if (c[3] * alphaMul <= 0) return;
    out.closed.checked += 1;
    const h = hexOf(c);
    // The cherry-pick (ccrc D-8816): its disc is text-muted and its dots and stems bg, each an explicit allowance and
    // nothing else, so a disc left black or a rule reaching the marks (or the disc) reds here.
    if (e.matches('.commit-cherry-pick')) {
      const disc = e.matches('circle') && e.getAttribute('r') === '10';
      const want = disc ? arg.textMuted : arg.bg;
      if (h !== want) out.closed.failures.push(`${label(e)} ${prop}=${h}, want ${disc ? 'text-muted' : 'bg'} on the cherry-pick ${disc ? 'disc' : 'mark'}`);
      return;
    }
    const okay = allowed.has(h) || (e.matches('.dn-ring') && prop === 'stroke' && h === arg.focus) || (e.matches('.dn-dot') && ((prop === 'fill' && h === arg.accent) || (prop === 'stroke' && h === arg.bg)));
    if (!okay) out.closed.failures.push(`${label(e)} ${prop}=${h}`);
  };
  for (const e of painters) {
    const s = cs(e);
    if (e.localName !== 'line') closed(e, 'fill', s.fill, parseFloat(s.fillOpacity));
    const width = parseFloat(s.strokeWidth);
    if (s.stroke !== 'none' && width > 0) {
      closed(e, 'stroke', s.stroke, parseFloat(s.strokeOpacity));
      const c = parse(s.stroke);
      if (c !== null && c[3] > 0 && lineSet.has(hexOf(c)) && !e.matches(markSel) && !e.matches('.dn-ring, .dn-dot')) {
        out.lines.checked += 1;
        const on1 = ratio(c, surface);
        const on2 = ratio(c, surface2);
        if (on1 < 3 || on2 < 3) out.lines.failures.push(`${label(e)} ${hexOf(c)} ${on1.toFixed(2)}:1 on surface, ${on2.toFixed(2)}:1 on surface2`);
      }
    }
  }
  for (const h of holders) {
    if (!rendered(h)) continue;
    const s = cs(h);
    if (h instanceof SVGElement) {
      closed(h, 'fill', s.fill, parseFloat(s.fillOpacity));
      if (s.stroke !== 'none' && parseFloat(s.strokeWidth) > 0) closed(h, 'stroke', s.stroke, parseFloat(s.strokeOpacity));
    } else closed(h, 'color', s.color);
  }
  for (const e of Array.from(svg.querySelectorAll('foreignObject *'))) {
    if (!rendered(e)) continue;
    const s = cs(e);
    closed(e, 'background-color', s.backgroundColor);
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const st = s.getPropertyValue(`border-${side.toLowerCase()}-style`);
      if (st !== 'none' && st !== 'hidden' && parseFloat(s.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0) closed(e, `border-${side.toLowerCase()}-color`, s.getPropertyValue(`border-${side.toLowerCase()}-color`));
    }
  }
  for (const e of [svg as Element, ...Array.from(svg.querySelectorAll('*'))]) {
    if (e !== svg && !rendered(e)) continue;
    out.filters.checked += 1;
    const f = cs(e).filter;
    if (f !== 'none') out.filters.failures.push(`${label(e)} filter=${f}`);
  }

  // Marks inside a commit: on the series colour of their commit, at 3:1. The cherry-pick is the coordinator's ruling (ccrc D-8816), which
  // replaces the spec's "on its commit's series colour" (the disc carries no series class in Mermaid 12.1.0): while hosted
  // the disc (circle.commit-cherry-pick with no fill attribute) is painted text-muted, its dots and stems stay bg, and the
  // marks are measured against the disc's colour at 4.5:1; the disc itself is a line, at 3:1 on surface and surface2.
  // (a cherry-pick commit's own disc, the circle of radius 10, is its bullet; its two dots and two stems are the marks)
  const isDisc = (e: Element): boolean => e.matches('circle.commit-cherry-pick') && e.getAttribute('r') === '10';
  const bullets = Array.from(svg.querySelectorAll('.commit-bullets > *')).filter((e) => e.matches('circle, rect, path') && !e.matches('.commit-reverse, .commit-merge, .commit-highlight-inner') && (!e.matches('.commit-cherry-pick') || isDisc(e)));
  for (const mark of Array.from(svg.querySelectorAll(markSel))) {
    if (mark.matches('.commit-highlight-outer') || isDisc(mark)) continue;
    const r = mark.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let ground: RGB | null = null;
    for (const b of bullets) {
      if ((b.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING) === 0) continue;
      const br = b.getBoundingClientRect();
      if (cx < br.left || cx > br.right || cy < br.top || cy > br.bottom) continue;
      const f = parse(cs(b).fill);
      if (f !== null && f[3] > 0) ground = [f[0], f[1], f[2]];
    }
    const s = cs(mark);
    const f = parse(s.fill);
    const st = parse(s.stroke);
    // (a line has no area: its fill is not painted)
    const colours = [f !== null && f[3] > 0 && mark.localName !== 'line' ? f : null, st !== null && st[3] > 0 && parseFloat(s.strokeWidth) > 0 ? st : null].filter((c) => c !== null) as number[][];
    out.marks.checked += 1;
    if (ground === null) {
      out.marks.failures.push(`${label(mark)} has no commit under it`);
      continue;
    }
    const floor = mark.matches('.commit-cherry-pick') ? 4.5 : 3;
    for (const c of colours) {
      const v = ratio(c, ground);
      if (v < floor) out.marks.failures.push(`${label(mark)} ${hexOf(c)} on ${hexOf(ground)} ${v.toFixed(2)}:1 (floor ${String(floor)})`);
    }
  }
  for (const disc of Array.from(svg.querySelectorAll('circle.commit-cherry-pick')).filter(isDisc)) {
    const s = cs(disc);
    out.marks.checked += 1;
    if (disc.hasAttribute('fill')) out.marks.failures.push(`${label(disc)} carries a fill attribute`);
    for (const [prop, value] of [['fill', s.fill], ['stroke', s.stroke]] as const) {
      const c = parse(value);
      if (c === null || c[3] === 0) continue;
      if (hexOf(c) !== arg.textMuted) out.marks.failures.push(`${label(disc)} ${prop}=${hexOf(c)}, not text-muted`);
      const on1 = ratio(c, surface);
      const on2 = ratio(c, surface2);
      if (on1 < 3 || on2 < 3) out.marks.failures.push(`${label(disc)} ${prop} ${on1.toFixed(2)}:1 on surface, ${on2.toFixed(2)}:1 on surface2`);
    }
  }

  // stick arrowheads: each path of a used marker is text-muted, at 3:1 on both grounds
  for (const id of usedMarkers) {
    if (!/-stick(Top|Bottom)ArrowHead$/.test(id)) continue;
    for (const p of Array.from(document.getElementById(id)?.querySelectorAll('path') ?? [])) {
      out.sticks.checked += 1;
      const c = parse(cs(p).stroke);
      if (c === null || hexOf(c) !== arg.textMuted) out.sticks.failures.push(`${id} path stroke=${cs(p).stroke}`);
      else if (ratio(c, surface) < 3 || ratio(c, surface2) < 3) out.sticks.failures.push(`${id} path ${hexOf(c)} under 3:1`);
    }
  }
  return out;
}

function argFor(p: Palette, over: Partial<MeasureArg> = {}): MeasureArg {
  const c = p.colour;
  return {
    svgSel: DRAWING_SEL,
    index: 0,
    surface: (c['surface'] as string).toLowerCase(),
    surface2: (c['surface2'] as string).toLowerCase(),
    lineSet: lineColours(p),
    allowed: themeColours(p),
    focus: (c['focus'] as string).toLowerCase(),
    accent: (c['accent'] as string).toLowerCase(),
    bg: (c['bg'] as string).toLowerCase(),
    textMuted: (c['text-muted'] as string).toLowerCase(),
    crowdedPieMax: 3,
    ...over,
  };
}

// ───────── pixels ─────────

/** Texts of `selector` in the drawing at `index`, read from pixels: glyph pixels at 4.5:1 against the text-hidden ground. */
async function pixelTexts(page: Page, selector: string, index = 0, svgSel = DRAWING_SEL): Promise<{ checked: number; failures: string[] }> {
  const svg = page.locator(svgSel).nth(index);
  await svg.scrollIntoViewIfNeeded();
  const info = await svg.evaluate((s, sel) => {
    const box = s.getBoundingClientRect();
    return {
      box: { x: box.left, y: box.top },
      items: Array.from(s.querySelectorAll(sel)).map((t) => {
        const r = t.getBoundingClientRect();
        const c = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(getComputedStyle(t).fill);
        return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height, text: (t.textContent ?? '').trim().slice(0, 24), fill: c === null ? null : [Number(c[1]), Number(c[2]), Number(c[3])] };
      }),
    };
  }, selector);
  const shown = decodePng(await svg.screenshot());
  const style = await page.addStyleTag({ content: `${svgSel} text, ${svgSel} tspan { fill: transparent !important; }` });
  const hidden = decodePng(await svg.screenshot());
  await style.evaluate((e) => (e as Element).remove());
  const out = { checked: 0, failures: [] as string[] };
  for (const it of info.items) {
    if (it.w <= 0 || it.h <= 0) continue;
    const g = glyphs(shown, hidden, { x: it.x - 2, y: it.y - 2, w: it.w + 4, h: it.h + 4 }, it.fill === null ? null : (it.fill as unknown as RGB));
    out.checked += 1;
    if (g.n === 0) out.failures.push(`"${it.text}": no glyph pixel read`);
    else if (g.min < 4.5) out.failures.push(`"${it.text}": ${g.min.toFixed(2)}:1 over ${String(g.n)} glyph pixels`);
  }
  return out;
}

/** The tooltip of the click node `Tip node`, shown: its computed colours, and its text's glyph pixels at 4.5:1. */
async function tooltipOf(page: Page): Promise<{ background: string; color: string; border: string; glyph: GlyphRead } | null> {
  const node = page.locator(`${DRAWING_SEL} g.node`, { hasText: 'Tip node' }).first();
  await node.scrollIntoViewIfNeeded();
  await node.hover();
  try {
    await page.waitForFunction(() => {
      const t = document.querySelector('body > div.mermaidTooltip');
      return t !== null && parseFloat(getComputedStyle(t).opacity) >= 0.85 && (t.textContent ?? '').includes('tip');
    }, null, { timeout: 10_000 });
  } catch {
    await page.mouse.move(0, 0);
    return null;
  }
  const tip = page.locator('body > div.mermaidTooltip');
  const css = await tip.evaluate((t) => {
    const s = getComputedStyle(t);
    return { background: s.backgroundColor, color: s.color, border: s.borderTopColor };
  });
  const shown = decodePng(await tip.screenshot());
  await tip.evaluate((t) => ((t as HTMLElement).style.setProperty('color', 'transparent', 'important')));
  const hidden = decodePng(await tip.screenshot());
  await tip.evaluate((t) => (t as HTMLElement).style.removeProperty('color'));
  await page.mouse.move(0, 0);
  const t = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(css.color);
  return { ...css, glyph: glyphs(shown, hidden, { x: 0, y: 0, w: shown.w, h: shown.h }, t === null ? null : [Number(t[1]), Number(t[2]), Number(t[3])]) };
}

/** Where two texts first differ, as a short quote of each ('' when equal). */
const firstDiff = (a: string, b: string): string => {
  if (a === b) return '';
  let i = 0;
  while (i < a.length && a[i] === b[i]) i += 1;
  return `at ${String(i)}: ${JSON.stringify(a.slice(Math.max(0, i - 40), i + 80))} against ${JSON.stringify(b.slice(Math.max(0, i - 40), i + 80))}`;
};

const toRgb = (css: string): string => {
  const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(css);
  return m === null ? css : `rgb(${m[1] as string}, ${m[2] as string}, ${m[3] as string})`;
};
const hexCss = (h: string): string => rgbCss(hex(h));

// ───────── one fixture, in the twelve palettes ─────────

interface PaletteRead {
  readonly palette: string;
  readonly measured: Measured;
  readonly pixels: { checked: number; failures: string[] };
  readonly tooltip: Awaited<ReturnType<typeof tooltipOf>> | undefined;
}

const PIXEL_TARGETS: Partial<Record<CoveredName, string>> = {
  gitgraph: 'text.commit-label',
  sequence: 'text.messageText, text.loopText',
};

async function readFixture(browser: BrowserName, name: CoveredName): Promise<PaletteRead[]> {
  const o = await openFigures(browser, [fixture(name)], APPEARANCE(PALETTES[0] as Palette));
  const reads: PaletteRead[] = [];
  try {
    for (const [i, p] of PALETTES.entries()) {
      if (i > 0) await o.set(APPEARANCE(p));
      const measured = await o.page.evaluate(measureDrawing, argFor(p));
      const target = PIXEL_TARGETS[name];
      const pixels = target === undefined ? { checked: 0, failures: [] } : await pixelTexts(o.page, target);
      const tooltip = name === 'flowchart' || name === 'flowchart-svg-labels' ? await tooltipOf(o.page) : undefined;
      reads.push({ palette: p.name, measured, pixels, tooltip });
    }
  } finally {
    await o.close();
  }
  return reads;
}

const failures = (reads: readonly PaletteRead[], pick: (r: PaletteRead) => string[]): string[] => reads.flatMap((r) => pick(r).map((f) => `${r.palette}: ${f}`));

const SLOW = 600_000;

describeBrowsers((browser) => {
  const memo = new Map<CoveredName, Promise<PaletteRead[]>>();
  const reads = (name: CoveredName): Promise<PaletteRead[]> => {
    let m = memo.get(name);
    if (m === undefined) {
      m = readFixture(browser, name);
      memo.set(name, m);
    }
    return m;
  };

  // ── the constant ──
  it('the constant: MERMAID_HOSTED_KINDS is the eight ids the bundled parse answers for the eight kinds, and a journey answers another', async () => {
    const doc = await openDoc('# x\n', {}, { browser, csp: 'reader', mermaid: true, enhance: false });
    try {
      await doc.page.evaluate(INSTALL_LOAD);
      const parsed = await doc.page.evaluate(async (texts: Record<string, string>) => {
        const m = ((await (window as unknown as { __loadM: () => Promise<{ default: { initialize(c: unknown): void; parse(t: string): Promise<{ diagramType: string }> } }> }).__loadM()).default);
        m.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base' });
        const res: Record<string, string> = {};
        for (const [k, v] of Object.entries(texts)) {
          try {
            res[k] = (await m.parse(v)).diagramType;
          } catch (e) {
            res[k] = `error: ${String(e).slice(0, 120)}`;
          }
        }
        return res;
      }, Object.fromEntries([...COVERED.map((n) => [n, fixture(n)]), ['sequence-box', fixture('sequence-box')], ['journey', fixture('journey')], ['directives', fixture('directives')], ['directives-front-matter', fixture('directives-front-matter')], ...STYLED.map((s) => [`styled/${s.name}`, s.text])]));
      const ids = new Set(COVERED.map((n) => parsed[n]));
      expect(ids.size).toBe(8);
      expect([...ids].sort()).toEqual([...MERMAID_HOSTED_KINDS].sort());
      for (const [k, v] of Object.entries(parsed)) {
        if (k === 'journey') expect(v).toBe('journey');
        else expect(MERMAID_HOSTED_KINDS as readonly string[], `${k} answered ${v}`).toContain(v);
      }
      expect(MERMAID_HOSTED_KINDS as readonly string[]).not.toContain('journey');
    } finally {
      await doc.close();
    }
  });

  // ── every key assigned ──
  it('every key assigned: a key whose sentinel the drawing shows is a key mermaidThemeOf assigns, and the output holds every key of 1.1.0\'s THEME_VARIABLES', async () => {
    const assigned = new Set(Object.keys(mermaidThemeOf(PHOSPHOR.colour as never)));
    for (const k of Object.keys(THEME_VARIABLES)) if (k !== 'fontFamily') expect(assigned.has(k), `THEME_VARIABLES key ${k}`).toBe(true);
    const doc = await openDoc('# x\n', {}, { browser, csp: 'reader', mermaid: true, enhance: false });
    try {
      await doc.page.evaluate(INSTALL_LOAD);
      await doc.page.clock.setFixedTime('2026-02-10T12:00:00Z');
      const texts = Object.fromEntries(COVERED.map((n) => [n, fixture(n)]));
      const res = await doc.page.evaluate(async (files: Record<string, string>) => {
        type Api = { initialize(c: unknown): void; render(id: string, t: string, el?: Element): Promise<{ svg: string }>; mermaidAPI: { getConfig(): { themeVariables: Record<string, unknown> } } };
        const m = (await (window as unknown as { __loadM: () => Promise<{ default: Api }> }).__loadM()).default;
        m.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', layout: 'dagre' });
        const keys = Object.entries(m.mermaidAPI.getConfig().themeVariables)
          .filter(([, v]) => typeof v === 'string' && CSS.supports('color', v))
          .map(([k]) => k);
        const sentinel = (i: number): string => `#${(i + 1).toString(16).padStart(2, '0')}4d0d`;
        const themeVariables: Record<string, string> = {};
        const bySentinel = new Map<string, string>();
        keys.forEach((k, i) => {
          themeVariables[k] = sentinel(i);
          bySentinel.set(sentinel(i), k);
        });
        const rgbOf = (h: string): string => `rgb(${String(parseInt(h.slice(1, 3), 16))}, ${String(parseInt(h.slice(3, 5), 16))}, ${String(parseInt(h.slice(5, 7), 16))})`;
        const byRgb = new Map([...bySentinel].map(([h, k]) => [rgbOf(h), k]));
        const used: Record<string, string[]> = {};
        for (const [name, text] of Object.entries(files)) {
          m.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', layout: 'dagre', themeVariables });
          const holder = document.createElement('div');
          document.body.append(holder);
          const r = await m.render(`k${name.replace(/\W/g, '')}`, text, holder);
          holder.innerHTML = r.svg;
          const svg = holder.querySelector('svg') as SVGSVGElement;
          const found = new Set<string>();
          const styleText = Array.from(svg.querySelectorAll('style'), (s) => s.textContent ?? '').join('\n').toLowerCase();
          for (const [h, k] of bySentinel) if (styleText.includes(h)) found.add(k);
          for (const e of Array.from(svg.querySelectorAll('*'))) {
            const inDefs = e.closest('defs') !== null && e.closest('marker') === null;
            if (inDefs) continue;
            const s = getComputedStyle(e);
            for (const v of [s.fill, s.stroke, s.color, s.backgroundColor, s.borderTopColor, s.borderLeftColor, s.stopColor, s.floodColor]) {
              const k = byRgb.get(toRgbText(v));
              if (k !== undefined) found.add(k);
            }
          }
          used[name] = [...found].sort();
          holder.remove();
        }
        return { count: keys.length, used };
        function toRgbText(v: string): string {
          const x = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(v);
          return x === null ? v : `rgb(${x[1] as string}, ${x[2] as string}, ${x[3] as string})`;
        }
      }, texts);
      expect(res.count).toBeGreaterThan(200);
      for (const name of COVERED) {
        const missing = (res.used[name] as string[]).filter((k) => !assigned.has(k));
        expect(missing, `${name}: keys drawn but not assigned`).toEqual([]);
        expect((res.used[name] as string[]).length, `${name} drew no sentinel`).toBeGreaterThan(4);
      }
    } finally {
      await doc.close();
    }
  }, SLOW);

  // ── drawn pairs, in every palette ──
  for (const name of COVERED) {
    it(`drawn pairs: ${name}, in the twelve palettes: texts at 4.5:1 on the composite behind their box, lines at 3:1, commit and crossed sequence labels from pixels`, async () => {
      const r = await reads(name);
      expect(r).toHaveLength(12);
      for (const x of r) {
        expect(x.measured.missing, `${x.palette}: no drawing`).toBeUndefined();
        expect(x.measured.hosted, `${x.palette}: the drawing is not marked hosted`).toBe(true);
        expect(x.measured.texts.checked, `${x.palette}: texts read`).toBeGreaterThan(2);
      }
      expect(failures(r, (x) => x.measured.texts.failures)).toEqual([]);
      expect(failures(r, (x) => x.measured.lines.failures)).toEqual([]);
      if (PIXEL_TARGETS[name] !== undefined) {
        for (const x of r) expect(x.pixels.checked, `${x.palette}: labels read from pixels`).toBeGreaterThan(5);
        expect(failures(r, (x) => x.pixels.failures)).toEqual([]);
      }
    }, SLOW);

    if (name === 'gitgraph') {
      it('drawn pairs: gitgraph, the marks inside a commit (the highlight\'s inner square, the reverse cross, the merge ring at 3:1 on their commit; the cherry-pick dots and stems at 4.5:1 on its text-muted disc, which is a line at 3:1), in the twelve palettes', async () => {
        const r = await reads(name);
        for (const x of r) expect(x.measured.marks.checked, `${x.palette}: marks read`).toBeGreaterThanOrEqual(8);
        expect(failures(r, (x) => x.measured.marks.failures)).toEqual([]);
      }, SLOW);
    }

    it(`closed colours: ${name}, in the twelve palettes: every painted colour is a value of mermaidThemeOf's output, every computed filter is none${name === 'flowchart' || name === 'flowchart-svg-labels' ? ', the tooltip is surface, text, border' : ''}`, async () => {
      const r = await reads(name);
      expect(failures(r, (x) => x.measured.closed.failures)).toEqual([]);
      expect(failures(r, (x) => x.measured.filters.failures)).toEqual([]);
      for (const x of r) expect(x.measured.closed.checked, `${x.palette}: colours read`).toBeGreaterThan(10);
      if (name === 'flowchart' || name === 'flowchart-svg-labels') {
        for (const [i, x] of r.entries()) {
          const p = PALETTES[i] as Palette;
          expect(x.tooltip, `${x.palette}: the tooltip did not show`).toBeTruthy();
          expect(toRgb((x.tooltip as { background: string }).background), `${x.palette}: tooltip background`).toBe(hexCss(p.colour['surface'] as string));
          expect(toRgb((x.tooltip as { color: string }).color), `${x.palette}: tooltip colour`).toBe(hexCss(p.colour['text'] as string));
          expect(toRgb((x.tooltip as { border: string }).border), `${x.palette}: tooltip border`).toBe(hexCss(p.colour['border'] as string));
        }
      }
    }, SLOW);
  }

  // ── the cues and the tooltip, pairs ──
  it('the definition cues and the tooltip: the Tab-focused ring is focus at 3:1 on surface and surface2, the dot is accent, the tooltip\'s text is 4.5:1 on its ground from pixels', async () => {
    const o = await openFigures(browser, [fixture('flowchart')], APPEARANCE(PHOSPHOR));
    try {
      for (const [i, p] of PALETTES.entries()) {
        if (i > 0) await o.set(APPEARANCE(p));
        const c = p.colour;
        const focused = await tabToTerm(o.page);
        expect(focused, `${p.name}: Tab never reached the defined-term node`).not.toBeNull();
        const f = focused as { stroke: string; opacity: string; dasharray: string; dot: string };
        expect(toRgb(f.stroke), `${p.name}: ring stroke`).toBe(hexCss(c['focus'] as string));
        expect(Number(f.opacity), `${p.name}: the focused ring is shown`).toBe(1);
        for (const g of ['surface', 'surface2']) expect(ratio(hex(c['focus'] as string), hex(c[g] as string)), `${p.name}: ring on ${g}`).toBeGreaterThanOrEqual(3);
        expect(toRgb(f.dot), `${p.name}: dot fill`).toBe(hexCss(c['accent'] as string));
        const tip = await tooltipOf(o.page);
        expect(tip, `${p.name}: the tooltip did not show`).toBeTruthy();
        const shownTip = tip as { background: string; color: string; border: string; glyph: GlyphRead };
        expect(toRgb(shownTip.background), `${p.name}: tooltip background`).toBe(hexCss(c['surface'] as string));
        expect(toRgb(shownTip.color), `${p.name}: tooltip colour`).toBe(hexCss(c['text'] as string));
        const g = shownTip.glyph;
        expect(g.n, `${p.name}: tooltip glyph pixels`).toBeGreaterThan(5);
        expect(g.min, `${p.name}: tooltip text from pixels`).toBeGreaterThanOrEqual(4.5);
      }
    } finally {
      await o.close();
    }
  }, SLOW);

  // ── the stick arrowheads ──
  it('the stick arrowheads: each path of a used stick marker is text-muted, at 3:1 on surface and surface2, in the twelve palettes', async () => {
    const r = await reads('sequence');
    expect(failures(r, (x) => x.measured.sticks.failures)).toEqual([]);
    for (const x of r) expect(x.measured.sticks.checked, `${x.palette}: stick marker paths used (the top and bottom markers)`).toBeGreaterThanOrEqual(2);
  }, SLOW);

  // ── author-styled ──
  it('author-styled: a fill-only classDef figure takes 1.1.0\'s theme, plate and filter in each dark palette, its label is 4.5:1 from pixels, and full screen shows the same', async () => {
    const text = STYLED.find((s) => s.name === 'fill-only-classdef')?.text as string;
    const plain = await openFigures(browser, [text]);
    const baseline = (await plain.page.evaluate(plateOf, DRAWING_SEL)).html;
    await plain.close();
    const o = await openFigures(browser, [text], APPEARANCE(DARK[0] as Palette));
    try {
      for (const [i, p] of DARK.entries()) {
        if (i > 0) await o.set(APPEARANCE(p), false);
        const drawn = await o.page.evaluate(plateOf, DRAWING_SEL);
        expect(drawn.hosted, `${p.name}: marked hosted`).toBe(false);
        expect(drawn.filter, `${p.name}: filter`).toBe(DARK_FILTER);
        expect(drawn.plate, `${p.name}: plate`).toBe(DARK_PLATE);
        expect(firstDiff(drawn.html, baseline), `${p.name}: drawn as 1.1.0 draws it`).toBe('');
        const label = await o.page.evaluate(labelBox, { svgSel: DRAWING_SEL, text: 'Painted' });
        const inFigure = await pixelsOfLabel(o.page, DRAWING_SEL, label);
        expect(inFigure.n, `${p.name}: label glyph pixels`).toBeGreaterThan(10);
        expect(inFigure.min, `${p.name}: label from pixels`).toBeGreaterThanOrEqual(4.5);
        await openFullScreen(o.page);
        const stageSel = `${ROOT_SEL} .fig-overlay.open .fo-stage svg`;
        await o.page.waitForSelector(stageSel);
        const staged = await o.page.evaluate(plateOf, stageSel);
        expect(staged.filter, `${p.name}: full-screen filter`).toBe(DARK_FILTER);
        expect(staged.stage, `${p.name}: full-screen plate`).toBe(DARK_PLATE);
        expect(staged.hosted, `${p.name}: full-screen copy marked hosted`).toBe(false);
        const fsLabel = await o.page.evaluate(labelBox, { svgSel: stageSel, text: 'Painted' });
        const inStage = await pixelsOfLabel(o.page, stageSel, fsLabel);
        expect(inStage.min, `${p.name}: full-screen label from pixels`).toBeGreaterThanOrEqual(4.5);
        await o.page.keyboard.press('Escape');
        await o.page.waitForFunction(() => document.querySelector('.fig-overlay.open') === null);
      }
    } finally {
      await o.close();
    }
  }, SLOW);

  it('author-styled, the covered twin: the full-screen copy of a hosted figure has closed colours, no filter, and a focus ring at 3:1', async () => {
    const o = await openFigures(browser, [fixture('flowchart')], APPEARANCE(PHOSPHOR));
    try {
      for (const [i, p] of PALETTES.entries()) {
        if (i > 0) await o.set(APPEARANCE(p));
        await openFullScreen(o.page);
        const stageSel = `${ROOT_SEL} .fig-overlay.open .fo-stage svg`;
        await o.page.waitForSelector(stageSel);
        const m = await o.page.evaluate(measureDrawing, argFor(p, { svgSel: stageSel }));
        expect(m.missing, `${p.name}: no copy`).toBeUndefined();
        expect(m.hosted, `${p.name}: the copy is marked hosted`).toBe(true);
        expect(m.closed.failures, `${p.name}: closed colours`).toEqual([]);
        expect(m.filters.failures, `${p.name}: filters`).toEqual([]);
        const ring = await o.page.evaluate((sel) => {
          const rings = Array.from(document.querySelectorAll(`${sel} .dn-ring`));
          return rings.map((r) => getComputedStyle(r).stroke);
        }, stageSel);
        expect(ring.length, `${p.name}: rings in the copy`).toBeGreaterThan(0);
        for (const s of ring) {
          expect(toRgb(s), `${p.name}: copy ring`).toBe(hexCss(p.colour['focus'] as string));
          for (const g of ['surface', 'surface2']) expect(ratio(hex(p.colour['focus'] as string), hex(p.colour[g] as string))).toBeGreaterThanOrEqual(3);
        }
        const stage = await o.page.evaluate(plateOf, stageSel);
        expect(stage.filter, `${p.name}: copy filter`).toBe('none');
        await o.page.keyboard.press('Escape');
        await o.page.waitForFunction(() => document.querySelector('.fig-overlay.open') === null);
      }
    } finally {
      await o.close();
    }
  }, SLOW);

  it('each author-styled spelling draws as 1.1.0 draws it; <<interface>> and <<fork>> alone, and every covered fixture, draw hosted', async () => {
    const names = [...STYLED.map((s) => `styled/${s.name}`), 'sequence-box', ...COVERED];
    const texts = [...STYLED.map((s) => s.text), fixture('sequence-box'), ...COVERED.map((n) => fixture(n))];
    const o = await openFigures(browser, texts, APPEARANCE(PHOSPHOR));
    try {
      const got = await o.page.evaluate(() =>
        Array.from(document.querySelectorAll('main[data-harness-root] figure.mermaid-figure')).map((f) => ({
          drawn: f.classList.contains('drawn'),
          hosted: f.querySelector(':scope > pre[data-docreader-chrome] > svg')?.hasAttribute('data-docreader-hosted-figure') ?? null,
        })),
      );
      expect(got).toHaveLength(names.length);
      names.forEach((n, i) => {
        const g = got[i] as { drawn: boolean; hosted: boolean | null };
        expect(g.drawn, `${n} drew`).toBe(true);
        const covered = n.startsWith('styled/plain-') || (COVERED as readonly string[]).includes(n);
        expect(g.hosted, `${n} ${covered ? 'is hosted' : 'is author-styled'}`).toBe(covered);
      });
    } finally {
      await o.close();
    }
  }, SLOW);

  // ── outside the constant ──
  it('outside the constant: a journey keeps 1.1.0\'s theme, plate and filter in every palette', async () => {
    const text = fixture('journey');
    const plain = await openFigures(browser, [text]);
    const baseline = (await plain.page.evaluate(plateOf, DRAWING_SEL)).html;
    await plain.close();
    const o = await openFigures(browser, [text], APPEARANCE(PHOSPHOR));
    try {
      for (const [i, p] of PALETTES.entries()) {
        if (i > 0) await o.set(APPEARANCE(p), false);
        const d = await o.page.evaluate(plateOf, DRAWING_SEL);
        expect(d.hosted, `${p.name}: marked hosted`).toBe(false);
        expect(d.filter, `${p.name}: filter`).toBe(p.mode === 'dark' ? DARK_FILTER : 'none');
        expect(d.plate, `${p.name}: plate`).toBe(p.mode === 'dark' ? DARK_PLATE : 'rgb(255, 255, 255)');
        expect(firstDiff(d.html, baseline), `${p.name}: drawn as 1.1.0 draws it`).toBe('');
      }
    } finally {
      await o.close();
    }
  }, SLOW);

  // ── init directives ──
  it('a document\'s init directive and front matter still cannot set themeVariables, themeCSS or darkMode on a hosted figure', async () => {
    const o = await openFigures(browser, [fixture('directives'), fixture('directives-front-matter')], APPEARANCE(PHOSPHOR));
    try {
      for (const index of [0, 1]) {
        const m = await o.page.evaluate(measureDrawing, argFor(PHOSPHOR, { index }));
        expect(m.hosted, `figure ${String(index)} is hosted`).toBe(true);
        expect(m.closed.failures, `figure ${String(index)}: closed colours`).toEqual([]);
        const html = (await o.page.evaluate((i) => (document.querySelectorAll('main[data-harness-root] figure.mermaid-figure > pre[data-docreader-chrome] > svg')[i] as SVGSVGElement).outerHTML.toLowerCase(), index));
        for (const s of ['#123456', '#ff0000', '#00ff00']) expect(html.includes(s), `figure ${String(index)} holds ${s}`).toBe(false);
      }
    } finally {
      await o.close();
    }
  }, SLOW);

  // ── a newer appearance cancels queued redraws ──
  it('a newer appearance cancels the redraws queued for an older one', async () => {
    const figs = Array.from({ length: 6 }, (_, i) => `flowchart LR\n  A${String(i)}[Start] --> B${String(i)}[Stop]`);
    const o = await openFigures(browser, figs, APPEARANCE(PALETTES[1] as Palette));
    try {
      const a = PALETTES[2] as Palette;
      const b = PALETTES[3] as Palette;
      const mark = await o.page.evaluate(() => (window as unknown as { __calls: unknown[] }).__calls.length);
      await o.page.evaluate(
        (v) => {
          const root = document.querySelector('main[data-harness-root]') as HTMLElement;
          for (const s of Array.from(root.querySelectorAll('figure.mermaid-figure > pre[data-docreader-chrome] > svg'))) (s as unknown as { __old: boolean }).__old = true;
          const api = (window as unknown as { __dg: { setEnhancementAppearance(r: HTMLElement, v: unknown): void } }).__dg;
          api.setEnhancementAppearance(root, v.a);
          api.setEnhancementAppearance(root, v.b);
        },
        { a: APPEARANCE(a), b: APPEARANCE(b) },
      );
      await o.page.waitForFunction(
        () => Array.from(document.querySelectorAll('main[data-harness-root] figure.mermaid-figure > pre[data-docreader-chrome] > svg')).every((s) => !(s as unknown as { __old?: boolean }).__old),
        null,
        { timeout: 90_000 },
      );
      await settled(o.page);
      const calls = (await o.page.evaluate((m) => (window as unknown as { __calls: { type: string; primary: string | null }[] }).__calls.slice(m), mark));
      const inits = calls.filter((c) => c.type === 'initialize').map((c) => c.primary);
      const primaryA = mermaidThemeOf(a.colour as never)['primaryColor'];
      const primaryB = mermaidThemeOf(b.colour as never)['primaryColor'];
      expect(primaryA).not.toBe(primaryB);
      expect(inits.filter((p) => p === primaryA).length, 'redraws made with the older appearance').toBeLessThanOrEqual(1);
      expect(inits.filter((p) => p === primaryB).length, 'redraws made with the newer appearance').toBeGreaterThanOrEqual(6);
      const fills = await o.page.evaluate(() => Array.from(document.querySelectorAll('main[data-harness-root] figure.mermaid-figure > pre[data-docreader-chrome] > svg g.node rect'), (r) => getComputedStyle(r).fill));
      expect(fills.length).toBeGreaterThanOrEqual(12);
      for (const f of fills) expect(toRgb(f)).toBe(hexCss(b.colour['surface2'] as string));
    } finally {
      await o.close();
    }
  }, SLOW);
});

// ───────── helpers that run in the page ─────────

const DARK_FILTER = 'invert(0.88) hue-rotate(180deg)';
const DARK_PLATE = 'rgb(31, 31, 31)';

/**
 * The drawing at `sel`: its mark, computed filter, plate (the chrome pre's background), stage (an overlay's), and its markup
 * with the library's drawing ids made alike and nothing the figure tools add (self-contained: it runs in the page).
 */
function plateOf(sel: string): { hosted: boolean; filter: string; plate: string; stage: string; html: string } {
  const svg = document.querySelector(sel) as SVGSVGElement;
  const pre = svg.closest('pre');
  const stage = svg.closest('.fo-stage');
  const copy = svg.cloneNode(true) as SVGSVGElement;
  for (const e of Array.from(copy.querySelectorAll('.dn-ring, .dn-dot'))) e.remove();
  return {
    hosted: svg.hasAttribute('data-docreader-hosted-figure'),
    filter: getComputedStyle(svg).filter,
    plate: pre === null ? '' : getComputedStyle(pre).backgroundColor,
    stage: stage === null ? '' : getComputedStyle(stage).backgroundColor,
    html: copy.outerHTML.replace(/mermaid-\d+/g, 'mermaid-N').replaceAll('"Docreader Host Sans",', '').replaceAll('"Docreader Host Mono",', ''),
  };
}

/** The box of the label holding `text` in the drawing at `svgSel`, relative to the drawing, and its element's colour. */
function labelBox(arg: { svgSel: string; text: string }): { x: number; y: number; w: number; h: number } {
  const svg = document.querySelector(arg.svgSel) as SVGSVGElement;
  const box = svg.getBoundingClientRect();
  const all = Array.from(svg.querySelectorAll('span, p, text, tspan, div')).filter((e) => Array.from(e.childNodes).some((n) => n.nodeType === 3 && (n.nodeValue ?? '').trim() === arg.text));
  const el = all[0] as Element;
  const r = el.getBoundingClientRect();
  return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
}

/** Glyph pixels of the label at `box` of the drawing at `svgSel`, from a screenshot of the drawing with every text hidden. */
async function pixelsOfLabel(page: Page, svgSel: string, box: { x: number; y: number; w: number; h: number }): Promise<GlyphRead> {
  const svg = page.locator(svgSel);
  const shown = decodePng(await svg.screenshot());
  const style = await page.addStyleTag({ content: `${svgSel} text, ${svgSel} tspan { fill: transparent !important; } ${svgSel} foreignObject * { color: transparent !important; }` });
  const hidden = decodePng(await svg.screenshot());
  await style.evaluate((e) => (e as Element).remove());
  return glyphs(shown, hidden, { x: box.x - 2, y: box.y - 2, w: box.w + 4, h: box.h + 4 }, null);
}

/** Open the figure's full-screen overlay (its tool button, whatever the tools' visibility). */
async function openFullScreen(page: Page): Promise<void> {
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('main[data-harness-root] figure.mermaid-figure .tools button')).find((x) => x.textContent === 'Full screen') as HTMLElement | undefined;
    if (b === undefined) throw new Error('no Full screen button');
    b.click();
  });
}

/** Press Tab until the node naming a glossary term has focus; its ring's and dot's computed paint, or null. */
async function tabToTerm(page: Page): Promise<{ stroke: string; opacity: string; dasharray: string; dot: string } | null> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.locator(DRAWING_SEL).first().scrollIntoViewIfNeeded();
  for (let i = 0; i < 80; i += 1) {
    await page.keyboard.press('Tab');
    if (!(await page.evaluate(() => document.activeElement?.closest?.('.dnode')?.hasAttribute('data-term') ?? false))) continue;
    await page.waitForTimeout(350); // the ring fades in over .15s
    const got = await page.evaluate(() => {
      const a = document.activeElement;
      const g = a?.closest?.('.dnode') ?? null;
      if (g === null || !g.hasAttribute('data-term')) return null;
      const ring = g.querySelector('.dn-ring') as Element;
      const dot = g.querySelector('.dn-dot') as Element;
      return { stroke: getComputedStyle(ring).stroke, opacity: getComputedStyle(ring).opacity, dasharray: getComputedStyle(ring).strokeDasharray, dot: getComputedStyle(dot).fill };
    });
    if (got !== null) return got;
  }
  return null;
}
