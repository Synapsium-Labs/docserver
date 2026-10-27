// The per-render state (docserver L1; architecture section C, rule 3 of render(), global constraint 2).
// One RenderEnv is created for each render() call and handed to markdown-it as its `env`; every rule that
// needs state for the length of one document keeps it here, never at module scope, so two renders cannot
// see each other. A later task adds its fields to this interface and to createEnv together. The footnote
// plugin (markdown-it-footnote) keeps its own per-document state on the same object, under `footnotes`,
// which it creates when a document defines a footnote.
import { createCommentScan, type CommentScan } from './allowlist.js';
import { createHighlighter, MAX_DOCUMENT_CHARS, type Highlighter } from './highlight.js';
import { createSlugState, type SlugState } from './slug.js';
import type { FrontEntry, Heading } from './types.js';

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
  /**
   * The document's code highlighter (fence.ts; highlight.ts's createHighlighter, `./highlight`'s): its budget is
   * MAX_DOCUMENT_CHARS code units, or none when RenderOptions.highlight is false.
   */
  readonly highlighter: Highlighter;
  /** Tables the table_open rule has emitted so far (meta.tables; tables.ts). */
  tables: number;
  /** Empty cells the table rule has added to short rows in this document, at most 65536 (tables.ts). */
  emptyCells: number;
  /**
   * The front matter's entries (meta.frontList; frontMatter.ts): undefined until a front_matter token is
   * rendered, then null when its content is not a mapping. collectMeta reads both as no mapping.
   */
  frontList: FrontEntry[] | null | undefined;
}

/** A fresh env for one render. `highlight` (default true) is RenderOptions.highlight. */
export function createEnv(o: { lineAttrs: boolean; highlight?: boolean }): RenderEnv {
  return {
    lineAttrs: o.lineAttrs,
    slugs: createSlugState(),
    headings: [],
    comments: createCommentScan(),
    figures: 0,
    mermaidKinds: [],
    highlighter: createHighlighter({ maxDocumentChars: o.highlight === false ? 0 : MAX_DOCUMENT_CHARS }),
    tables: 0,
    emptyCells: 0,
    frontList: undefined,
  };
}
