// The public types of `./render` and its two default limits (docserver L1; architecture section C as amended
// by rulings C2 and C3). Imports nothing, so every module of src/render can import it without a cycle.

/** What `render()` did: parsed and rendered, refused by the byte gate, or fell back after an internal error. */
export type RenderOutcome = 'rendered' | 'over-limit' | 'failed';

export interface RenderOptions {
  /** UTF-8 byte cap on the input; above it nothing is parsed. Default DEFAULT_MAX_BYTES. */
  maxBytes?: number;
  /** Emit data-line="a-b" on block elements. Default true. */
  lineAttrs?: boolean;
}

export interface Heading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  id: string;
  text: string;
}

/** One front-matter key, in source order. Same shape as the standalone server's meta.front. */
export interface FrontEntry {
  key: string;
  list: boolean;
  vals: string[];
}

export interface RenderMeta {
  /** null-prototype record derived from frontList: list ? vals : vals[0]. null when there is no front-matter mapping. */
  front: Readonly<Record<string, string | readonly string[]>> | null;
  frontList: readonly FrontEntry[] | null;
  /** text of the first level-1 heading in document order, else null */
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
  /** '' when over-limit; the escaped fallback block when failed */
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
  /** only fences render() turns into figures; UTF-8 bytes of their content */
  mermaid: { fences: number; largestBytes: number; totalBytes: number };
}

/** Default UTF-8 byte cap for render() and scanRefs(): 4 MiB (ruling C3). Hosts pass their own. */
export const DEFAULT_MAX_BYTES = 4_194_304;

/** Default cap on distinct images returned by scanRefs() (ruling C3). Hosts pass their own. */
export const DEFAULT_MAX_IMAGES = 512;
