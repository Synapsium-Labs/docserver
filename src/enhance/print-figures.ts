// Print figures (docserver parity T6; the first consumer's parity design, section 4.6 stage 2, under section 6's caps): the
// `print-figures` command hands a host that prints the document its Mermaid figures as PNGs, one at a time, in document order.
// Pure but for the calls it is given: the Mermaid drawing is diagrams.ts's (it shares the module's queue and the secure keys), the
// picture is env.rasterize's, the hand-over is the host's `onPrintFigure`; this file holds what is neither, so a test can
// drive it with fakes.
//
// A run, for each figure of the document (every `figure.mermaid-figure`, `n` of them, at most FIGURES_MAX):
//   1. draw it for print (diagrams.ts printCall): in an offscreen container, with `htmlLabels` off (a label as SVG text, not
//      a `foreignObject`, which would taint the canvas), the screen's theme (the host's colours or 1.1's) and the one font
//      an image can use, and answer Mermaid's SVG text;
//   2. give the SVG an absolute size (sizedSvg) and draw it on a canvas scaled to fit SIDE_MAX px a side at PRINT_SCALE
//      (printSize), as a PNG in base64 (env.rasterize);
//   3. hand it over, `{ i, n, png }` (only for a place the wire has: figurePlace; only for a PNG within its cap: isPrintPng; the
//      frame's adapter and the host's parser judge both again; and only while the run's PNGs together stay within RUN_MAX_BYTES,
//      a figure that would pass it being skipped and adding nothing), and wait for the host's callback (its promise, if any) before the next figure: so the
//      frame's pacer holds at most one figure at a time and a cancelled run leaves at most that one behind.
// A figure that does not draw (no source, a source too long for Mermaid, an error), whose SVG has no size, whose canvas is
// tainted or unavailable, or whose PNG is over PNG_MAX_BYTES, is skipped: its `i` is never handed over, and the figures after
// it go on. Figures are handed over in ascending `i`. A second run cancels the first: every await of a run checks that it is
// still the latest, so the first hands over nothing more, draws nothing more and (for a drawing queued behind another call)
// asks Mermaid for nothing. No figure on screen changes.
//
// The caps are the frame wire's (BRIDGE_LIMITS.printFigure*, src/frame/protocol.ts); L2 may import only its own siblings,
// so this file keeps its own copies, held equal by test/enhance-print-figures.test.ts.
//
// Import-inert: declarations only.
import type { PrintFigure } from './types.js';

/** The most figures one run carries, and so the largest `n` (the wire's printFiguresMax). */
export const FIGURES_MAX = 64;

/** The most the PNGs of one run may decode to, together (the wire's printFiguresTotalMaxBytes). */
export const RUN_MAX_BYTES = 16_777_216;

/** The longest side of a figure's PNG, in px (the wire's printFigureSideMaxPx). */
export const SIDE_MAX = 2048;

/** The largest PNG, in bytes (the wire's printFigurePngMaxBytes). */
export const PNG_MAX_BYTES = 1_048_576;

/** How many pixels a figure takes per CSS pixel of its drawing, before the side cap: print wants more than a screen does. */
export const PRINT_SCALE = 2;

/** The one font family an SVG image can use: it sees no web font of the page, so Mermaid measures with the family it is drawn in. */
export const PRINT_FONT = 'sans-serif';

/** The secure key a print drawing adds: a diagram's own directive may not turn HTML labels back on. */
const SECURE_ADDED = 'htmlLabels';

/** A PNG file's first eight bytes, as base64 text. */
const PNG_SIGNATURE = 'iVBORw0KGgo';

/**
 * The configuration of a print drawing: the screen's, with HTML labels off (at the top and in the flowchart's own switch),
 * the one font an image can use, and `htmlLabels` among the secure keys so no directive turns the labels back on.
 */
export function printConfigOf(screen: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const theme = screen['themeVariables'];
  const secure = screen['secure'];
  return {
    ...screen,
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    fontFamily: PRINT_FONT,
    themeVariables: { ...(typeof theme === 'object' && theme !== null ? theme : {}), fontFamily: PRINT_FONT },
    secure: [...(Array.isArray(secure) ? (secure as string[]) : []), SECURE_ADDED],
  };
}

/**
 * The canvas for a drawing of `w` by `h` CSS px: PRINT_SCALE times each side, shrunk (both sides alike) until the longer fits
 * SIDE_MAX, and at least 1 px a side; null for a drawing with no usable size.
 */
export function printSize(w: number, h: number): { readonly w: number; readonly h: number } | null {
  if (!(w > 0) || !(h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
  const s = Math.min(PRINT_SCALE, SIDE_MAX / w, SIDE_MAX / h);
  return { w: Math.min(SIDE_MAX, Math.max(1, Math.round(w * s))), h: Math.min(SIDE_MAX, Math.max(1, Math.round(h * s))) };
}

/** The opening tag of an SVG text: its first `<svg ...>` (the tags Mermaid writes keep every `>` of a value out of it). */
const SVG_TAG = /^\s*(?:<\?xml[^>]*>\s*)?<svg\b([^>]*)>/;

/** The numbers of a `viewBox` value: four finite numbers, the last two above zero. */
function viewBoxOf(attrs: string): { readonly w: number; readonly h: number } | null {
  const m = /\sviewBox\s*=\s*"([^"]*)"/.exec(attrs);
  if (m === null) return null;
  const v = (m[1] ?? '').trim().split(/[\s,]+/).map(Number);
  const w = v[2];
  const h = v[3];
  return v.length === 4 && v.every(Number.isFinite) && w !== undefined && h !== undefined && w > 0 && h > 0 ? { w, h } : null;
}

/**
 * Mermaid's SVG text with an absolute size: the opening tag's `width`, `height` and the style's `max-width` (Mermaid writes
 * `width="100%"`, which an image has no size for) are replaced by the canvas size that printSize gives its viewBox. Answers
 * the text and the canvas size, or null for a text that does not open as an SVG, has no usable viewBox or is Mermaid's error
 * drawing.
 */
export function sizedSvg(text: string): { readonly svg: string; readonly w: number; readonly h: number } | null {
  const m = SVG_TAG.exec(text);
  if (m === null) return null;
  const attrs = m[1] ?? '';
  if (/\saria-roledescription\s*=\s*"error"/.test(attrs)) return null;
  const box = viewBoxOf(attrs);
  const size = box === null ? null : printSize(box.w, box.h);
  if (size === null) return null;
  const kept = attrs
    .replace(/\s(?:width|height)\s*=\s*"[^"]*"/g, '')
    .replace(/(\sstyle\s*=\s*")([^"]*)"/, (_all, open: string, css: string) => `${open}${css.replace(/(?:^|;)\s*max-(?:width|height)\s*:[^;]*/gi, '')}"`);
  const tag = `<svg width="${String(size.w)}" height="${String(size.h)}"${kept}>`;
  return { svg: tag + text.slice(m[0].length), w: size.w, h: size.h };
}

/** The decoded size of base64 text, in bytes (padding counted off); -1 for text that is not base64. */
export function base64Bytes(b64: string): number {
  if (b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) return -1;
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return (b64.length / 4) * 3 - pad;
}

/** Whether `i` of `n` is a place a figure may have on the wire: both integers, 0 <= i < n <= FIGURES_MAX (the host's parser judges it again). */
export function figurePlace(i: number, n: number): boolean {
  return Number.isInteger(i) && Number.isInteger(n) && i >= 0 && i < n && n <= FIGURES_MAX;
}

/** Whether `png` is a PNG's base64 text (its signature) of at most PNG_MAX_BYTES. */
export function isPrintPng(png: string): boolean {
  if (!png.startsWith(PNG_SIGNATURE)) return false;
  const n = base64Bytes(png);
  return n > 0 && n <= PNG_MAX_BYTES;
}

/** What a run needs from its reader: each figure's drawing, the picture, and the host's hand-over. */
export interface PrintDeps {
  /** False once the instance is not live: a run stops. */
  live(): boolean;
  /**
   * The document's figures in order, at most FIGURES_MAX of them (more are cut here): a draw that answers the figure's SVG
   * text, or null when it did not draw, and given `stale()` (true once a later run began) so a call still queued answers null
   * unasked; `undefined` for a figure with nothing to draw (no source, too long for Mermaid).
   */
  figures(): readonly (((stale: () => boolean) => Promise<string | null>) | undefined)[];
  /** The picture: the SVG text, drawn on a canvas of `w` by `h` px, as the PNG's base64 text, or null. */
  rasterize(svg: string, w: number, h: number): Promise<string | null>;
  /** Hand one figure to the host: settles once its callback returned and what it returned settled. */
  hand(f: PrintFigure): Promise<unknown>;
}

/** A print run's starter: each call begins a run and cancels the one before it. */
export interface PrintRunner {
  start(): void;
}

/** The runner of one instance (see the header). */
export function createPrintRunner(d: PrintDeps): PrintRunner {
  /** The latest run's number: a run that finds another there has been cancelled. */
  let latest = 0;
  const run = async (mine: number): Promise<void> => {
    const stale = (): boolean => latest !== mine || !d.live();
    const list = d.figures().slice(0, FIGURES_MAX);
    const n = list.length;
    /** What the figures handed over so far decode to: a figure that would take it past RUN_MAX_BYTES is skipped and adds nothing. */
    let total = 0;
    for (let i = 0; i < n; i++) {
      const draw = list[i];
      if (draw === undefined || !figurePlace(i, n)) continue;
      if (stale()) return;
      let text: string | null = null;
      try {
        text = await draw(stale);
      } catch {
        text = null; // a figure that fails to draw is skipped
      }
      if (stale()) return;
      const size = text === null ? null : sizedSvg(text);
      if (size === null) continue;
      let png: string | null = null;
      try {
        png = await d.rasterize(size.svg, size.w, size.h);
      } catch {
        png = null;
      }
      if (stale()) return;
      if (png === null || !isPrintPng(png)) continue;
      const bytes = base64Bytes(png);
      if (total + bytes > RUN_MAX_BYTES) continue;
      total += bytes;
      await d.hand({ i, n, png });
    }
  };
  return {
    start(): void {
      latest += 1;
      void run(latest);
    },
  };
}
