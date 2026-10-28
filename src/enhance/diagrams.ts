// Diagrams: each Mermaid figure drawn in the second phase, safely configured, with a readable fallback on failure (the
// reference layout, section 26, its drawing, and the first-paint steps that concern diagrams; docserver L2, Task 21;
// LD3, LD4, LD5; spec §3.4).
//
// Nothing happens at startup. In the second phase, when the host gave `mermaid` (C47: its load is reached only
// through ctx.host.loadMermaid(), its settings are ctx.options.mermaid) and the document has a figure with a source
// (figures.ts's entries, each `figure.mermaid-figure` with render()'s `pre.mermaid`):
//   1. the root takes the gate, `data-docreader-mermaid`, and the state `data-docreader-diagrams="drawing"`, at once,
//      before any drawing succeeds (C43): the stylesheet then shows each source as a transparent placeholder;
//   2. the host's load() is called, once, and its module awaited while the reader's faces load (env.fonts, at most
//      FONT_WAIT_MS: Mermaid measures its labels with them). As soon as the module is here, before that wait ends, it
//      is given the configuration once, through its queue: stock Mermaid listens for the window's load event and,
//      while its start-on-load is on (its default), draws every `.mermaid` of the document then, with its own defaults
//      and into the document's own `pre`; the package's file has it off already;
//   3. a module whose default export (or which itself) has Mermaid's `initialize` and `render` is Mermaid's; anything
//      else (one with `run` and no `render` too), a rejection included, leaves every figure to its fallback, with the
//      load note;
//   4. after a frame, the figures near the viewport (less than NEAR screens away) are drawn first, in document order;
//      then, after a timeout of 0, the rest, nearest first (each distance measured then);
//   5. each figure is one call, serialised in one queue per Mermaid module across every root of the page (a module's
//      configuration is global to it): a chrome `pre.mermaid` holding the source's text, marked `data-processed` as
//      Mermaid marks what it draws, goes in right after the document's own `pre` (which is never written into, so it
//      never gets that mark), or first in the figure when the host has moved that `pre` out of it, then
//      `initialize(config)` and the drawing, unless initialize destroyed the instance. The drawing is what Mermaid's
//      `run({ nodes: [that pre], suppressErrors: true })` does, step by step, with one change: the reader names it
//      (drawingId, below). Mermaid's `render(id, text, that pre)` draws the source's text prepared as run() prepares
//      it (mermaidText); the SVG text it answers goes into that pre through an inert parse (env.parseHtml, the
//      window's DOMParser; run() writes innerHTML, which the reader never names), and its `bindFunctions`, when it
//      has one, is called with that pre. A rejection, or a throw of bindFunctions, is kept from the page as run()
//      keeps it with suppressErrors (the pre then holds what Mermaid left in it). No id is looked up: the drawing is
//      the svg in that node;
//   6. a figure is drawn when its chrome `pre` holds an svg that is not Mermaid's error drawing: the figure takes the
//      journaled class `drawn`, the svg `role="img"` and an `aria-label` ("Figure N. " and the caption, else the
//      drawing's own title, else the first line of its source), and the figure `--fig-w`, the drawing's own width
//      with its plate's padding and border. The first line of the source skips a leading front-matter block whole,
//      where the reference skipped only its `---` fences. Otherwise the figure takes `draw-failed` and a chrome
//      `.fig-error` before its source (first in the figure when the source has left it): a note saying why, and a
//      `details` holding the source. A source longer than maxTextSize is never handed to Mermaid (which would draw a
//      box saying so): its note says it is too long;
//   7. once every figure is done, the state reads `drawn`, `partial` (some failed) or `failed` (all did).
// Each change of a figure runs through position.keep and asks for a relayout ('content').
//
// That is `mermaid.draw: 'auto'`, the default. With `'on-request'` (docserver L3, Task 16; FD13) the second phase
// neither calls load() nor sets the gate or `drawing`: the root reads `data-docreader-diagrams="on-request"` for good, a
// figure longer than maxTextSize takes its fallback with the long note at once, and every other figure gets one Render
// button (chrome, a native button) and the per-figure state `data-docreader-draw`: `on-request`, `busy` once tapped,
// then `drawn` or `failed`. The first tap calls load() once, after which steps 2, 3, 5 and 6 run for the tapped figure
// alone, through the same queue, so a second tap waits (its button `aria-busy`) until the draw before it settles, and a
// failure is that figure's only (onRequest, below).
//
// The drawing's name (docserver L3, Task 8; ledger C95(1); plan risk R3, row L3.B14). Mermaid writes a drawing's
// name into the svg's id, into every id it derives for the drawing (`<name>-…` markers, gradients, clip paths and
// nodes, and the working elements `d<name>` and `i<name>`), into the selectors of the drawing's stylesheet
// (`#<name> …`) and into the `url(#…)` references between them, and while it draws it looks the name up in the whole
// document (`[id="<name>"]`, `#d<name>`). Its run() names each drawing `mermaid-<Date.now()>` and takes no name, and an
// authored anchor holding that name took the drawing, lost its `d…` twin to Mermaid's cleanup, and took the drawing's
// references (measured on Chromium, task-8.md). So the reader calls render() with a name of its own, drawingId():
// DRAWING_ID_PREFIX, then `mermaid-` and a number this copy of the library counts up. The prefix holds U+00B7 MIDDLE DOT,
// which render() never writes into an id: not an anchor (`<!-- id:X -->` takes `[A-Za-z0-9_-]`), not a heading slug
// (letters, numbers, `_`, `-` and CJK ideographs; the dot is punctuation, `Po`), not a footnote's id (`fn` and
// `fnref` with digits and `:`), so no document can author an id that meets a drawing's. CSS takes the dot unescaped in
// an id selector (an ident code point in CSS Syntax 3, as every code point from U+0080 was before), and an SVG takes it
// in `url(#…)`; L3.B14p (test/browser/frame-mermaid.test.ts) holds both on each engine CI runs. The full-screen
// copy rebinds these ids too (journal.ts, cloneSvg).
//
// The configuration (§3.4), passed to initialize() before every run, so another root's never applies: startOnLoad
// false, securityLevel 'strict' (no click handler is bound, labels are sanitised), suppressErrorRendering, the layout
// 'dagre' (Mermaid 12.1.0 defaults to ELK, which the file leaves out, LD3 and C53: a diagram that asks for ELK fails
// and shows its note), maxTextSize and maxEdges (the host's, else Mermaid 12.1.0's defaults, measured in
// test/browser/diagrams.test.ts), the warm theme (`base` with THEME_VARIABLES) and the font family: the root's
// `--sans` when it is a plain list of families, else FONT_FALLBACK. `secure` is secureKeys(), then the host's
// additions: Mermaid's own six, and every style-bearing key of 12.1.0's configuration schema (a name that names a
// theme, CSS, a style, a font, a colour, a fill, a stroke, the look or dark mode), enumerated from the schema by
// test/enhance-diagrams.test.ts. Mermaid deletes a secure key from a diagram's own directives (an init directive or
// front matter) at any depth, so no directive changes the theme, fonts or colours, injects CSS, lifts the security
// level or the limits. A diagram's own `classDef`, `style` and `linkStyle` statements are not directives: they still
// style its nodes and edges inside the drawing (Mermaid scopes their rules to the drawing's id), as in the reference.
// And `dompurifyConfig`, with which Mermaid sanitises each label: a label's own markup loses its `style` elements
// (Mermaid's default) and its `style` and `class` attributes, so no label styles itself or borrows one of the reader's
// rules. Mermaid passes the markup it makes inside a label through the same sanitiser, so that loses them too: a math
// label's KaTeX wrapper, an `fa:` icon's `<i class>`, a registered icon's `label-icon` class.
//
// The second phase writes only inside operations, checks live() after every await (the font wait and env's frame
// and timeout never settle once the instance is not live; the host's load answers null), and a queued call of a
// destroyed instance is never made. The drawing is Mermaid's own writing inside a chrome node the journal inserted,
// so destroy removes it with that node. One thing Mermaid writes outside it: its flowchart, state and class drawings
// put a tooltip, `div.mermaidTooltip`, in the document's body the first time (it reuses the document's first
// `.mermaidTooltip` after), and show it over a hovered node that has a tooltip. One a library call made is tracked
// per document with the live instances that drew while it stood (Tip): the last one's teardown removes it, and each
// earlier one's sends a node of its own that Mermaid shows the tooltip over the mouseout Mermaid closes it on (the
// node goes, so none would come); one a call made after its instance was destroyed goes at once. A tooltip the page
// already had is the page's: never changed.
//
// Standard files, slug `diagrams`: test/enhance-diagrams.test.ts, test/browser/diagrams.test.ts,
// conformance/layout/diagrams/ and scripts/demo/samples/diagrams.md. The figure rules are assets/reader.css's.
// Registered in features.ts, whose header says where in the build order and why.
import { chrome } from './journal.js';
import type { MermaidSettings } from './options.js';
import type { FigureEntry } from './registry.js';
import type { FeatureContext } from './types.js';

/** Mermaid 12.1.0's default `maxTextSize`, the library's when the host gives none. */
export const MAX_TEXT_SIZE = 50_000;

/** Mermaid 12.1.0's default `maxEdges`, the library's when the host gives none. */
export const MAX_EDGES = 500;

/** How long drawing waits for the reader's faces, in milliseconds (the reference's). */
const FONT_WAIT_MS = 1500;

/** A figure less than this many screens from the viewport is near: drawn in the first pass. */
const NEAR = 1.5;

/** A drawing's plate: 24 px of padding and 1 px of border on each side, and 2 px to spare (the reference's). */
const PLATE = 52;

/** The widest drawing whose width the figure takes, in px. */
const WIDTH_MAX = 100_000;

/** How much of a source's first line names a drawing that has no caption and no title. */
const LABEL_LINE_MAX = 80;

/** Why a figure was not drawn: its note. */
export const NOTES = {
  load: 'The diagram renderer did not load, so this figure is shown as its Mermaid source.',
  error: 'This diagram has an error, so it is shown as its Mermaid source.',
  long: 'This diagram is too long to draw, so it is shown as its Mermaid source.',
} as const;

type Why = keyof typeof NOTES;

/** The text of a figure's Render button, in 'on-request' mode (docserver L3, Task 16). */
export const RENDER = 'Render';

/** The note's disclosure. */
const SHOW_SOURCE = 'Show its Mermaid source';

/** The font family when the root's `--sans` is not a plain list of families. */
export const FONT_FALLBACK = '"Docreader Sans", sans-serif';

/** A plain list of font families: names, quoted or not, separated by commas; nothing that can end a CSS rule. */
const FAMILIES = /^[A-Za-z0-9 ,"'_-]{1,400}$/;

/** The warm theme (C41), Mermaid's `base` theme with these variables; the font family is added per instance. */
export const THEME_VARIABLES = {
  fontSize: '14px',
  primaryColor: '#f3f0e9',
  primaryBorderColor: '#a39b8d',
  primaryTextColor: '#1d1c1a',
  secondaryColor: '#eef2f8',
  tertiaryColor: '#f7f5f0',
  lineColor: '#7b7468',
  textColor: '#1d1c1a',
  clusterBkg: '#faf8f4',
  clusterBorder: '#d6d0c4',
  edgeLabelBackground: '#ffffff',
  noteBkgColor: '#fbf3e4',
  noteBorderColor: '#d9b77c',
  actorBkg: '#f3f0e9',
  actorBorder: '#a39b8d',
} as const;

/**
 * What a label's own markup loses, beyond what Mermaid's strict level removes (handlers, scripts): the elements and
 * attributes that style. Mermaid sanitises each label with `dompurifyConfig` when one is given (its default refuses
 * `style` elements only). It sets its own classes on the label's wrappers after, so its shapes and their classes are
 * unchanged; but the markup it makes inside a label is sanitised with the author's, so a math label's KaTeX wrapper
 * loses its class and style, and an `fa:` icon's `<i>` or a registered icon its class. A `class` would let a label
 * borrow one of the reader's own rules.
 */
const LABEL_TAGS_REFUSED = ['style'] as const;
const LABEL_ATTRS_REFUSED = ['style', 'class'] as const;

/** Mermaid 12.1.0's own secure keys (its default `secure`), which a list given to initialize() replaces. */
export const MERMAID_SECURE = ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'suppressErrorRendering', 'maxEdges'] as const;

/** The C4 diagram's shapes, each also `external_<shape>`: each has four font keys and two colour keys. */
const C4_SHAPES = ['person', 'system', 'system_db', 'system_queue', 'container', 'container_db', 'container_queue', 'component', 'component_db', 'component_queue'] as const;

export type SecureGroup = 'mermaid' | 'theme' | 'styles' | 'fonts' | 'colours' | 'c4';

/**
 * The library's secure keys, by group: Mermaid's own, then every style-bearing key of Mermaid 12.1.0's configuration
 * schema. A diagram's directive may set none of them.
 */
export function secureGroups(): Readonly<Record<SecureGroup, readonly string[]>> {
  const c4 = C4_SHAPES.flatMap((s) => [s, `external_${s}`]);
  return Object.freeze({
    mermaid: [...MERMAID_SECURE],
    theme: ['theme', 'themeVariables', 'themeCSS', 'darkMode', 'look'],
    styles: ['labelStyle', 'numberSectionStyles'],
    fonts: [
      'fontFamily', 'altFontFamily', 'fontSize', 'fontSizeFactor', 'fontWeight',
      'actorFont', 'actorFontFamily', 'actorFontSize', 'actorFontWeight',
      'boundaryFont', 'boundaryFontFamily', 'boundaryFontSize', 'boundaryFontWeight',
      'messageFont', 'messageFontFamily', 'messageFontSize', 'messageFontWeight',
      'noteFont', 'noteFontFamily', 'noteFontSize', 'noteFontWeight',
      'usecaseFontFamily', 'usecaseFontSize', 'usecaseFontWeight',
      'taskFontFamily', 'taskFontSize', 'titleFontFamily', 'titleFontSize',
      'axisFontSize', 'labelFontSize', 'legendFontSize', 'pointLabelFontSize', 'quadrantLabelFontSize', 'sectionFontSize',
      'xAxisLabelFontSize', 'yAxisLabelFontSize',
    ],
    colours: [
      'fill', 'stroke', 'strokeWidth', 'lineColor', 'linkColor', 'titleColor', 'text_color', 'colorScheme', 'disableMulticolor',
      'actorColours', 'sectionColours', 'sectionFills', 'nodeColors', 'markerFill', 'rect_fill', 'rect_border_color', 'ruleNameColor',
      'commentFill', 'commentStroke', 'commentTextColor', 'nonTerminalFill', 'nonTerminalStroke', 'nonTerminalTextColor',
      'terminalFill', 'terminalStroke', 'terminalTextColor', 'specialFill', 'specialStroke',
      'quadrantExternalBorderStrokeWidth', 'quadrantInternalBorderStrokeWidth',
    ],
    c4: [
      ...c4.flatMap((s) => [`${s}Font`, `${s}FontFamily`, `${s}FontSize`, `${s}FontWeight`]),
      ...c4.flatMap((s) => [`${s}_bg_color`, `${s}_border_color`]),
    ],
  });
}

/** Every secure key of the library, in its groups' order. */
export function secureKeys(): readonly string[] {
  return Object.freeze(Object.values(secureGroups()).flat());
}

/** Mermaid's API, as the reader uses it. */
interface MermaidApi {
  initialize(config: Record<string, unknown>): unknown;
  /** Draw `text` under the name `id`, in `container`: answers (a promise of) the SVG text and its bindFunctions. */
  render(id: string, text: string, container: Element): unknown;
}

/**
 * What every drawing's name starts with: `docreader`, then U+00B7 MIDDLE DOT, a code point render() never writes into
 * an id (header, "The drawing's name"; test/enhance-diagrams.test.ts holds it).
 */
export const DRAWING_ID_PREFIX = 'docreader\u00b7';

/** How many drawings this copy of the library has named: each takes the next number. */
let drawingCount = 0;

/** The next drawing's name: the prefix, then `mermaid-` and a number never handed out before by this copy. */
function drawingId(): string {
  const n = drawingCount;
  drawingCount += 1;
  return `${DRAWING_ID_PREFIX}mermaid-${String(n)}`;
}

/**
 * ts-dedent 2.3.0's `dedent` of one string, as Mermaid 12.1.0's run() calls it: a final line break and the blanks after
 * it go; then every line loses the smallest indentation of the lines after a line break (a blank-only line's count, a
 * line that starts with text counts 0); then one line break at the start goes. The smallest is found by a loop where
 * the package spreads the counts into Math.min (the same number).
 */
function dedent(text: string): string {
  let s = text.replace(/\r?\n([\t ]*)$/, '');
  const indents = s.match(/\n([\t ]+|(?!\s).)/g);
  if (indents !== null) {
    let min = Number.POSITIVE_INFINITY;
    for (const m of indents) min = Math.min(min, m.match(/[\t ]/g)?.length ?? 0);
    s = s.replace(new RegExp(`\n[\t ]{${String(min)}}`, 'g'), '\n');
  }
  return s.replace(/^\r?\n/, '');
}

/**
 * A source's text as Mermaid 12.1.0's run() hands it to render(): run() reads the pre's innerHTML and decodes its
 * entities (utils' entityDecode), which gives back the text a pre holding only that text was made with; then dedent,
 * trim, and every `<br>`, `<br/>` or `<br />` (any case) written `<br/>`. test/enhance-diagrams.test.ts holds the
 * equality with run()'s own steps.
 */
export function mermaidText(text: string): string {
  return dedent(text)
    .trim()
    .replace(/<br\s*\/?>/gi, '<br/>');
}

/** One figure to draw. */
interface Fig {
  readonly entry: FigureEntry;
  /** render()'s `pre.mermaid`: the source, never written into. */
  readonly source: HTMLElement;
  /** Its text, read when drawing starts. */
  readonly text: string;
}

/** One queue per Mermaid module, across roots: the last call asked for, settled either way. */
let queues: WeakMap<object, Promise<void>> | undefined;

/** Run `task` once every call asked for on `api` before it has settled. */
function enqueue<T>(api: object, task: () => Promise<T>): Promise<T> {
  queues ??= new WeakMap();
  const next = (queues.get(api) ?? Promise.resolve()).then(task);
  queues.set(
    api,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

/** Mermaid's tooltip, which a library call put in a document's body, and the live instances that drew while it stood. */
interface Tip {
  readonly el: Element;
  readonly users: Set<FeatureContext>;
}

/** The tooltip a library call made, per document. */
let tips: WeakMap<Document, Tip> | undefined;

/** The document's tooltip as Mermaid finds it: its first `.mermaidTooltip`. */
function tooltipIn(doc: Document): Element | null {
  return doc.querySelector('.mermaidTooltip');
}

/**
 * One drawing's teardown, before the drawing goes: its instance no longer draws with `tip`, which goes once no live
 * instance does. While another still does, a tooltip shown over a node of this drawing would stay shown once the node
 * is gone, as no mouseout comes: Mermaid marks that node `hover`, and is sent the mouseout it closes the tooltip on.
 */
function releaseTip(tip: Tip, ctx: FeatureContext, drawing: Element): void {
  tip.users.delete(ctx);
  if (tip.users.size === 0) {
    tip.el.remove();
    return;
  }
  for (const node of drawing.querySelectorAll('g.hover')) {
    const out = drawing.ownerDocument.createEvent('Event');
    out.initEvent('mouseout', false, false);
    node.dispatchEvent(out);
  }
}

/** After a call: note a tooltip the call made, and that this instance and its drawing draw with the library's. */
function noteTip(ctx: FeatureContext, doc: Document, had: Element | null, drawing: Element): void {
  const now = tooltipIn(doc);
  if (now === null) return;
  tips ??= new WeakMap();
  let tip = tips.get(doc);
  if (tip?.el !== now) {
    if (had !== null) return; // the page's own, or one that stood before: not the library's
    tip = { el: now, users: new Set() };
    tips.set(doc, tip);
  }
  if (!ctx.live()) {
    // The call ran on after a destroy: a tooltip it made has no instance left to go with.
    if (tip.users.size === 0) releaseTip(tip, ctx, drawing);
    return;
  }
  const held = tip;
  ctx.operate(() => {
    held.users.add(ctx);
    ctx.journal.defer(() => {
      releaseTip(held, ctx, drawing);
    });
  });
}

/**
 * Whether `v` has Mermaid's initialize and render, the two calls the reader makes. A module without render (one with
 * run alone included) is not Mermaid's: every figure keeps its fallback.
 */
function isApi(v: unknown): v is MermaidApi {
  if ((typeof v !== 'object' && typeof v !== 'function') || v === null) return false;
  const m = v as { initialize?: unknown; render?: unknown };
  return typeof m.initialize === 'function' && typeof m.render === 'function';
}

/** Mermaid's API in what the host's load() answered: its default export, or the module itself; else null. */
function mermaidOf(mod: unknown): MermaidApi | null {
  try {
    if ((typeof mod === 'object' || typeof mod === 'function') && mod !== null) {
      const d: unknown = (mod as { default?: unknown }).default;
      if (isApi(d)) return d;
    }
    return isApi(mod) ? mod : null;
  } catch {
    return null; // a getter of the host's that throws
  }
}

/**
 * The figures to draw: figures.ts's entries, in document order, each with render()'s source `pre.mermaid` (its first
 * child of that kind: read before any drawing goes in beside it).
 */
function drawable(ctx: FeatureContext): Fig[] {
  const out: Fig[] = [];
  for (const entry of ctx.figures.all()) {
    let source: HTMLElement | null = null;
    for (let n = entry.figure.firstElementChild; n !== null; n = n.nextElementSibling) {
      if (n.localName === 'pre' && n.classList.contains('mermaid')) {
        source = n as HTMLElement;
        break;
      }
    }
    if (source !== null) out.push({ entry, source, text: source.textContent ?? '' });
  }
  return out;
}

/** The configuration for one call: a new object each time, since Mermaid keeps what it is given. */
function configOf(settings: MermaidSettings, fontFamily: string): () => Record<string, unknown> {
  const secure = [...secureKeys()];
  for (const k of settings.secure) if (!secure.includes(k)) secure.push(k);
  return () => ({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    layout: 'dagre',
    maxTextSize: settings.maxTextSize ?? MAX_TEXT_SIZE,
    maxEdges: settings.maxEdges ?? MAX_EDGES,
    secure: [...secure],
    theme: 'base',
    fontFamily,
    themeVariables: { ...THEME_VARIABLES, fontFamily },
    dompurifyConfig: { FORBID_TAGS: [...LABEL_TAGS_REFUSED], FORBID_ATTR: [...LABEL_ATTRS_REFUSED] },
  });
}

/** The root's `--sans` when it is a plain list of font families; FONT_FALLBACK otherwise. */
function fontOf(ctx: FeatureContext): string {
  const v = ctx.env.computed(ctx.root, '--sans');
  return FAMILIES.test(v) ? v : FONT_FALLBACK;
}

/** How far `el` is from the viewport, in px: 0 when it is in view. */
function distance(el: Element, h: number): number {
  const r = el.getBoundingClientRect();
  return r.bottom < 0 ? -r.bottom : r.top > h ? r.top - h : 0;
}

/** The drawing in `drawing`: its svg, unless there is none or it is Mermaid's error drawing. */
function drawnSvg(drawing: HTMLElement): SVGSVGElement | null {
  for (let n = drawing.firstElementChild; n !== null; n = n.nextElementSibling) {
    if (n.localName === 'svg') return n.getAttribute('aria-roledescription') === 'error' ? null : (n as SVGSVGElement);
  }
  return null;
}

/** The drawing's own width, in px: the max-width Mermaid gives it, else its viewBox's; null when neither is usable. */
function naturalWidth(svg: SVGSVGElement): number | null {
  const m = /(?:^|;)\s*max-width\s*:\s*([0-9]+(?:\.[0-9]+)?)px/i.exec(svg.getAttribute('style') ?? '');
  let w = m === null ? Number.NaN : Number.parseFloat(m[1] ?? '');
  if (!(w > 0)) {
    try {
      w = svg.viewBox.baseVal.width;
    } catch {
      w = Number.NaN;
    }
  }
  return Number.isFinite(w) && w > 0 && w <= WIDTH_MAX ? w : null;
}

/** A source's first line: past a leading front-matter block (from a first `---` line to the next), and past comments. */
function firstLine(text: string): string {
  const lines = text.split('\n').map((l) => l.trim());
  // An unclosed block skips nothing: indexOf answers -1, and the slice starts at 0.
  const body = lines[0] === '---' ? lines.slice(lines.indexOf('---', 1) + 1) : lines;
  return body.find((l) => l !== '' && !l.startsWith('%%')) ?? '';
}

/** Where a figure's chrome goes beside its source: right after it (or before it), or first once the host moved it out. */
function besideSource(f: Fig, after: boolean): Node | null {
  if (f.source.parentNode !== f.entry.figure) return f.entry.figure.firstChild;
  return after ? f.source.nextSibling : f.source;
}

/** The drawing's name: "Figure N. " and the caption, else its own title, else the first line of its source. */
function labelOf(ctx: FeatureContext, f: Fig, svg: SVGSVGElement): string {
  let title = '';
  for (let n = svg.firstElementChild; n !== null; n = n.nextElementSibling) {
    if (n.localName === 'title') {
      title = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
      break;
    }
  }
  const name = f.entry.caption !== '' ? f.entry.caption : title !== '' ? title : ctx.text.clip(firstLine(f.text), LABEL_LINE_MAX);
  return `Figure ${f.entry.no}. ${name}`;
}

/** Mark a figure drawn: its class, the drawing's role and name, and the figure's width. */
function markDrawn(ctx: FeatureContext, f: Fig, svg: SVGSVGElement): void {
  const { journal } = ctx;
  journal.toggleClass(f.entry.figure, 'drawn', true);
  journal.setAttribute(svg, 'role', 'img');
  journal.setAttribute(svg, 'aria-label', labelOf(ctx, f, svg));
  const w = naturalWidth(svg);
  if (w !== null) journal.setStyle(f.entry.figure, '--fig-w', `${String(Math.ceil(w + PLATE))}px`);
}

/** Leave a figure to its fallback: its class, and the note with its source before the source. */
function markFailed(ctx: FeatureContext, f: Fig, why: Why): void {
  const doc = ctx.root.ownerDocument;
  ctx.journal.toggleClass(f.entry.figure, 'draw-failed', true);
  const note = chrome(doc, 'div', { className: 'fig-error', attrs: { role: 'note' } }, [
    chrome(doc, 'p', { text: NOTES[why] }),
    chrome(doc, 'details', {}, [
      chrome(doc, 'summary', { text: SHOW_SOURCE }),
      chrome(doc, 'pre', { className: 'fig-src', attrs: { tabindex: '0' } }, [chrome(doc, 'code', { text: f.text })]),
    ]),
  ]);
  ctx.journal.insert(note, f.entry.figure, besideSource(f, false));
}

/** Write one figure's outcome, keeping the reader's place, and ask for a relayout. */
function finish(ctx: FeatureContext, f: Fig, svg: SVGSVGElement | null, why: Why): void {
  ctx.operate(() => {
    ctx.position.keep(() => {
      if (svg === null) markFailed(ctx, f, why);
      else markDrawn(ctx, f, svg);
    });
    ctx.relayout('content');
  });
}

/**
 * Put what render() answered into `drawing`, as run() does after its render: the SVG text in place of whatever the pre
 * holds (run() writes innerHTML; here an inert parse, env.parseHtml), then bindFunctions(drawing) when there is one.
 * An answer without SVG text, or a window without a parser, leaves the pre as Mermaid left it. A throw (of
 * bindFunctions, or of a getter of the answer's) is the caller's to keep from the page.
 */
function place(ctx: FeatureContext, drawing: HTMLElement, out: unknown): void {
  if ((typeof out !== 'object' && typeof out !== 'function') || out === null) return;
  const { svg, bindFunctions } = out as { svg?: unknown; bindFunctions?: unknown };
  if (typeof svg !== 'string') return;
  const nodes = ctx.env.parseHtml(svg);
  if (nodes === null) return;
  drawing.replaceChildren(...nodes);
  if (typeof bindFunctions === 'function') (bindFunctions as (el: Element) => unknown)(drawing);
}

/**
 * One call, inside the module's queue: the chrome pre beside the source, initialize, then the drawing as run() makes it
 * (header, step 5), under a name of the reader's (drawingId). Answers the chrome pre (whatever Mermaid left in it), or
 * null when the instance is no longer live and nothing was asked.
 */
async function call(ctx: FeatureContext, api: MermaidApi, config: () => Record<string, unknown>, f: Fig): Promise<HTMLElement | null> {
  if (!ctx.live()) return null;
  const doc = ctx.root.ownerDocument;
  // Marked as run() marks a node it draws, before it reads the node's text.
  const drawing = chrome(doc, 'pre', { className: 'mermaid', text: f.text, attrs: { 'data-processed': 'true' } });
  let had: Element | null = null;
  let rendering: unknown;
  try {
    rendering = ctx.operate(() => {
      ctx.journal.insert(drawing, f.entry.figure, besideSource(f, true));
      had = tooltipIn(doc);
      api.initialize(config());
      if (!ctx.live()) return undefined; // initialize destroyed the instance: its drawing is never asked for
      return { out: api.render(drawingId(), mermaidText(f.text), drawing) };
    });
  } catch {
    return drawing; // a throw of the module's: the drawing is what it left, checked by the caller
  }
  if (rendering === undefined) return null;
  try {
    place(ctx, drawing, await (rendering as { out: unknown }).out);
  } catch {
    // A rejection, or a throw of bindFunctions: kept from the page, as run() keeps it with suppressErrors. The drawing
    // is checked by the caller.
  }
  noteTip(ctx, doc, had, drawing);
  return drawing;
}

/** Draw one figure through the module's queue; answers how it ended, or null once the instance is not live. */
async function draw(ctx: FeatureContext, api: MermaidApi, config: () => Record<string, unknown>, settings: MermaidSettings, f: Fig): Promise<boolean | null> {
  if (f.text.length > (settings.maxTextSize ?? MAX_TEXT_SIZE)) {
    finish(ctx, f, null, 'long');
    return false;
  }
  const drawing = await enqueue(api, () => call(ctx, api, config, f));
  if (!ctx.live() || drawing === null) return null;
  const svg = drawing.parentNode === f.entry.figure ? drawnSvg(drawing) : null;
  finish(ctx, f, svg, 'error');
  return svg !== null;
}

/** Build this feature during startup: nothing; diagrams are drawn in the second phase (LD5). */
export function build(ctx: FeatureContext): void {
  void ctx;
}

/**
 * Call the host's load(), and, as soon as the module is here, before the font wait ends, give it its configuration
 * once: its start-on-load off, before a window load event can find it on (header, step 2).
 */
function load(ctx: FeatureContext, config: () => Record<string, unknown>): Promise<unknown> {
  const loading = ctx.host.loadMermaid();
  void loading.then((mod) => {
    const early = mermaidOf(mod);
    if (early === null) return;
    // A throw of the module's is the queue's to absorb: each call initialises again.
    void enqueue(early, () => {
      ctx.operate(() => early.initialize(config()));
      return Promise.resolve();
    });
  });
  return loading;
}

/**
 * The second phase in 'on-request' mode (docserver L3, Task 16; FD13): nothing is loaded and nothing drawn. The root
 * reads `on-request` (never `drawing`, and without the gate, so every source stays readable text); a figure longer than
 * maxTextSize is left to its fallback at once, with the long note; every other figure gets one Render button, in a
 * chrome `div.fig-render` right after its source, and the state `data-docreader-draw="on-request"`. A tap marks the
 * button busy and the figure `busy`, and draws that figure only: the first tap calls load() once (with the font wait,
 * as in 'auto'), and every draw goes through draw() and so through the module's one queue, one call at a time. Once
 * the figure is drawn or has failed (the load note when the module is not Mermaid's, the error note otherwise), its
 * Render control is hidden and its state reads `drawn` or `failed`; a later tap does nothing.
 */
function onRequest(ctx: FeatureContext, settings: MermaidSettings, figs: readonly Fig[]): void {
  ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'on-request');
  const config = configOf(settings, fontOf(ctx));
  let module: Promise<MermaidApi | null> | null = null;
  const api = (): Promise<MermaidApi | null> =>
    (module ??= (async () => {
      const loading = load(ctx, config);
      await ctx.env.fonts(FONT_WAIT_MS);
      return mermaidOf(await loading);
    })());
  const doc = ctx.root.ownerDocument;
  const tap = async (f: Fig, bar: HTMLElement, button: HTMLButtonElement): Promise<void> => {
    const a = await api();
    if (!ctx.live()) return;
    let drawn: boolean | null = false;
    if (a === null) finish(ctx, f, null, 'load');
    else drawn = await draw(ctx, a, config, settings, f);
    if (drawn === null) return;
    const ok = drawn;
    ctx.operate(() => {
      ctx.journal.setAttribute(button, 'aria-busy', null);
      ctx.journal.setAttribute(bar, 'hidden', '');
      ctx.journal.setAttribute(f.entry.figure, 'data-docreader-draw', ok ? 'drawn' : 'failed');
    });
  };
  const max = settings.maxTextSize ?? MAX_TEXT_SIZE;
  ctx.position.keep(() => {
    for (const f of figs) {
      if (f.text.length > max) {
        markFailed(ctx, f, 'long');
        ctx.journal.setAttribute(f.entry.figure, 'data-docreader-draw', 'failed');
        continue;
      }
      const button = chrome(doc, 'button', { className: 'fig-render-btn', text: RENDER, attrs: { type: 'button', 'aria-label': `${RENDER} figure ${f.entry.no}` } });
      const bar = chrome(doc, 'div', { className: 'fig-render' }, [button]);
      let tapped = false;
      ctx.journal.listen(button, 'click', () => {
        if (tapped) return;
        tapped = true;
        ctx.journal.setAttribute(button, 'aria-busy', 'true');
        ctx.journal.setAttribute(f.entry.figure, 'data-docreader-draw', 'busy');
        void tap(f, bar, button);
      });
      ctx.journal.insert(bar, f.entry.figure, besideSource(f, true));
      ctx.journal.setAttribute(f.entry.figure, 'data-docreader-draw', 'on-request');
    }
  });
  ctx.relayout('content');
}

/**
 * The second phase (LD5): load Mermaid through the host, then draw every figure, near ones first; in 'on-request'
 * mode, only what a reader asks for (onRequest).
 */
export async function after(ctx: FeatureContext): Promise<void> {
  const settings = ctx.options.mermaid;
  if (settings === null) return; // no mermaid option, so no load to call (normalizeOptions keeps the two together)
  const figs = drawable(ctx);
  if (figs.length === 0) return;
  if (settings.draw === 'on-request') {
    onRequest(ctx, settings, figs);
    return;
  }
  ctx.journal.setAttribute(ctx.root, 'data-docreader-mermaid', ''); // the gate (C43)
  ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'drawing'); // the state (LD5)
  const config = configOf(settings, fontOf(ctx));
  const loading = load(ctx, config);
  await ctx.env.fonts(FONT_WAIT_MS);
  if (!ctx.live()) return;
  const api = mermaidOf(await loading);
  if (!ctx.live()) return;
  let failed = 0;
  const settle = (): void => {
    ctx.operate(() => {
      ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', failed === 0 ? 'drawn' : failed === figs.length ? 'failed' : 'partial');
    });
  };
  if (api === null) {
    for (const f of figs) finish(ctx, f, null, 'load');
    failed = figs.length;
    settle();
    return;
  }
  await new Promise<void>((resolve) => {
    ctx.env.frame(resolve);
  });
  if (!ctx.live()) return;
  const h = ctx.env.viewport().h;
  const near = figs.filter((f) => distance(f.source, h) < h * NEAR);
  for (const f of near) {
    const drawn = await draw(ctx, api, config, settings, f);
    if (drawn === null) return;
    if (!drawn) failed += 1;
  }
  await new Promise<void>((resolve) => {
    ctx.env.timeout(resolve, 0);
  });
  if (!ctx.live()) return;
  const h2 = ctx.env.viewport().h;
  const rest = figs
    .filter((f) => !near.includes(f))
    .map((f, i) => ({ f, d: distance(f.source, h2), i }))
    .sort((a, b) => a.d - b.d || a.i - b.i);
  for (const { f } of rest) {
    const drawn = await draw(ctx, api, config, settings, f);
    if (drawn === null) return;
    if (!drawn) failed += 1;
  }
  settle();
}
