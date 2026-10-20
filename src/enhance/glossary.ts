// The glossary: the first mention of each term in each section is underlined (the reference layout, section 12b).
// Built by L2 Task 13; until then a stub that builds nothing.
//
// Consumes ctx.blocks, ctx.vocab (the glossary contract: its headers and section names) and ctx.page. Produces
// ctx.terms entries, the `glossary` and `termcell` classes and `a.term[data-term]` with aria-haspopup="dialog" and
// aria-expanded, as chrome around split text. A term never overlaps an xref.
//
// Standard files, slug `links`: test/enhance-links.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 13: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}
