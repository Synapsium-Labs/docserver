// The per-render state (docserver L1; architecture section C, rule 3 of render(), global constraint 2).
// One RenderEnv is created for each render() call and handed to markdown-it as its `env`; every rule that
// needs state for the length of one document keeps it here, never at module scope, so two renders cannot
// see each other. Later tasks add their fields (the figure and table counters, the front-matter result) to
// this interface and to createEnv together.
import { createCommentScan, type CommentScan } from './allowlist.js';
import { createSlugState, type SlugState } from './slug.js';
import type { Heading } from './types.js';

export interface RenderEnv {
  /** Emit data-line="a-b" on block elements (RenderOptions.lineAttrs, default true). */
  readonly lineAttrs: boolean;
  /** The heading ids this document has handed out (the anchors rule). */
  readonly slugs: SlugState;
  /** Every heading in document order, as the anchors rule set its id (meta.headings). */
  readonly headings: Heading[];
  /** Where the allowlist's comment rules last searched for `-->` (allowlist.ts). */
  readonly comments: CommentScan;
  /** Mermaid figures the fence rule has emitted so far (meta.figures; fence.ts). */
  figures: number;
  /** Their distinct diagram keywords, in document order, at most 32 (meta.mermaidKinds; fence.ts). */
  readonly mermaidKinds: string[];
  /** Code units the fence rule has highlighted so far, at most MAX_HIGHLIGHT_CHARS (fence.ts). */
  highlighted: number;
}

/** A fresh env for one render. */
export function createEnv(o: { lineAttrs: boolean }): RenderEnv {
  return {
    lineAttrs: o.lineAttrs,
    slugs: createSlugState(),
    headings: [],
    comments: createCommentScan(),
    figures: 0,
    mermaidKinds: [],
    highlighted: 0,
  };
}
