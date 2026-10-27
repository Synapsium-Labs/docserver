// Types for scripts/gen-frame-vocabulary.mjs, which runs under plain Node and is imported by test/frame-runtime.test.ts.
import type { RenderOptions, RenderResult } from '../src/render/types.js';

/** One corpus case, as the generator renders it. */
export interface VocabularyCase {
  readonly id: string;
  readonly markdown: string;
  readonly options: RenderOptions;
}

export interface VocabularyScan {
  /** The tags, sorted: the corpus's joined with the oracle's TAGS. */
  readonly tags: string[];
  /** The attribute names, sorted. */
  readonly attributes: string[];
  /** Every output that broke a rule, and every list entry the vocabulary must never hold; the generator fails on any. */
  readonly problems: string[];
}

export declare const VOCABULARY_TS: string;
export declare const STYLE_VALUE_SOURCE: string;
export declare const NEVER_TAGS: readonly string[];
export declare const INPUT_ATTRIBUTES: readonly string[];
export declare function loadTools(root?: string): Promise<{
  render: (markdown: string, o?: RenderOptions) => RenderResult;
  TAGS: ReadonlySet<string>;
}>;
export declare function corpusInputs(tools: unknown, root?: string): VocabularyCase[];
export declare function scanVocabulary(
  cases: readonly VocabularyCase[],
  render: (markdown: string, o?: RenderOptions) => RenderResult,
  oracleTags: ReadonlySet<string>,
): VocabularyScan;
export declare function vocabularyModule(tags: readonly string[], attributes: readonly string[]): string;
export declare function generate(root?: string): Promise<{ text: string; problems: string[]; scan: VocabularyScan }>;
