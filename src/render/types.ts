// The public types of `./render` and its two default limits (docserver L1; architecture section C as amended
// by rulings C2, C3 and C20). Imports nothing, so every module of src/render can import it without a cycle.

/**
 * What `render()` did: parsed and rendered; refused by the byte gate (`over-limit`); stopped because its html
 * would pass `maxHtmlBytes` (`output-over-limit`); or fell back after an internal error.
 */
export type RenderOutcome = 'rendered' | 'over-limit' | 'output-over-limit' | 'failed';

export interface RenderOptions {
  /**
   * UTF-8 byte cap on the input; above it nothing is parsed. Default DEFAULT_MAX_BYTES. It bounds the input
   * only; `maxHtmlBytes` bounds the html.
   */
  maxBytes?: number;
  /**
   * UTF-8 byte cap on the html; a render whose html would pass it stops with outcome 'output-over-limit'.
   * Default 16777216 (16 MiB, four times DEFAULT_MAX_BYTES).
   */
  maxHtmlBytes?: number;
  /** Emit data-line="a-b" on block elements. Default true. */
  lineAttrs?: boolean;
  /**
   * Colour code fences with highlight.js. Default true. With false every fence keeps its wrapper, its data-line and
   * its `language-<name>` class and holds the code as escaped text, with no span; nothing else changes (request (b)).
   * Any other value than a boolean is a TypeError.
   */
  highlight?: boolean;
}

export interface Heading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  /** the heading's id in the html; authors control it and it may equal another element's id: never look up by it */
  id: string;
  /** plain text as the author wrote it, not escaped HTML: insert it with textContent, or escape it */
  text: string;
}

/**
 * One front-matter key, in source order. The same shape as the reference renderer's front matter entries. `key` and `vals`
 * are plain text as the author wrote them, not escaped HTML: insert them with textContent, or escape them.
 */
export interface FrontEntry {
  key: string;
  list: boolean;
  vals: string[];
}

export interface RenderMeta {
  /**
   * null-prototype record derived from frontList: list ? vals : vals[0]. null when there is no front-matter
   * mapping. Its keys and values are plain text, not escaped HTML.
   */
  front: Readonly<Record<string, string | readonly string[]>> | null;
  frontList: readonly FrontEntry[] | null;
  /** text of the first level-1 heading in document order, else null; plain text, not escaped HTML */
  title: string | null;
  headings: readonly Heading[];
  /** count of figure.mermaid-figure emitted */
  figures: number;
  /** count of tables emitted */
  tables: number;
  /** distinct diagram keywords of rendered mermaid fences, document order, max 32 */
  mermaidKinds: readonly string[];
}

export interface RenderResult {
  /** '' when over-limit; the escaped fallback block, cut to maxHtmlBytes, when output-over-limit or failed */
  html: string;
  outcome: RenderOutcome;
  /** measured UTF-8 length (when over-limit: the cap + 1 at which counting stopped) */
  bytes: number;
  /** the frozen empty meta unless outcome === 'rendered' */
  meta: RenderMeta;
}

export interface ScanRefsOptions {
  /** UTF-8 byte cap on the input, as for render(). Default DEFAULT_MAX_BYTES. */
  maxBytes?: number;
  /** most distinct image sources returned. Default DEFAULT_MAX_IMAGES. */
  maxImages?: number;
}

export interface ScanRefsResult {
  outcome: 'scanned' | 'over-limit';
  /** distinct img src values exactly as render() emits them (post normalizeLink), document order */
  images: string[];
  /** true when more than maxImages distinct images exist */
  imagesTruncated: boolean;
  /**
   * only fences render() turns into figures: their content's size in UTF-8 bytes, and in UTF-16 code units (`Chars`,
   * the unit of the layout's Mermaid `maxTextSize` check, `text.length`)
   */
  mermaid: { fences: number; largestBytes: number; totalBytes: number; largestChars: number; totalChars: number };
}

/** Default UTF-8 byte cap for render() and scanRefs(): 4 MiB (ruling C3). Hosts pass their own. */
export const DEFAULT_MAX_BYTES = 4_194_304;

/** Default cap on distinct images returned by scanRefs() (ruling C3). Hosts pass their own. */
export const DEFAULT_MAX_IMAGES = 512;
