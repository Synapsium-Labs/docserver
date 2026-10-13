// The per-render state (docserver L1; architecture section C, rule 3 of render(), global constraint 2).
// One RenderEnv is created for each render() call and handed to markdown-it as its `env`; every rule that
// needs state for the length of one document keeps it here, never at module scope, so two renders cannot
// see each other. Later tasks add their fields (the figure and table counters, the front-matter result) to
// this interface and to createEnv together.
import { createSlugState, type SlugState } from './slug.js';
import type { Heading } from './types.js';

export interface RenderEnv {
  /** Emit data-line="a-b" on block elements (RenderOptions.lineAttrs, default true). */
  readonly lineAttrs: boolean;
  /** The heading ids this document has handed out (the anchors rule). */
  readonly slugs: SlugState;
  /** Every heading in document order, as the anchors rule set its id (meta.headings). */
  readonly headings: Heading[];
}

/** A fresh env for one render. */
export function createEnv(o: { lineAttrs: boolean }): RenderEnv {
  return { lineAttrs: o.lineAttrs, slugs: createSlugState(), headings: [] };
}
