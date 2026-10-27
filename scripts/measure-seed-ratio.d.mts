// Types for scripts/measure-seed-ratio.mjs, which runs under plain Node and is imported by test/frame-seed.test.ts.
import type { RenderOptions, RenderResult } from '../src/render/types.js';

/** One golden corpus document, read as loadCorpus() reads it. */
export interface GoldenDocument {
  readonly id: string;
  readonly markdown: string;
  readonly options: RenderOptions;
}

/** One document's ratio: escaped html characters over markdown UTF-8 bytes. */
export interface SeedRatio {
  readonly id: string;
  readonly bytes: number;
  readonly escaped: number;
  readonly ratio: number;
}

/** The spec's document cap, in markdown UTF-8 bytes (2097152). */
export declare const DOC_BYTES: number;
export declare function goldenDocuments(root?: string): GoldenDocument[];
export declare function seedRatios(
  docs: readonly GoldenDocument[],
  render: (markdown: string, o?: RenderOptions) => RenderResult,
  escapedHtmlLength: (html: string) => number,
): SeedRatio[];
export declare function htmlCap(r: number): number;
export declare function loadSeedTools(root?: string): Promise<{
  render: (markdown: string, o?: RenderOptions) => RenderResult;
  escapedHtmlLength: (html: string) => number;
  SEED_HTML_MAX_CHARS: number;
}>;
