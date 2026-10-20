// Cross-references: the first mention of a defined ID in each block links to it (the reference layout, section 12).
// Built by L2 Task 13; until then a stub that builds nothing.
//
// Consumes ctx.index, ctx.blocks, ctx.vocab (the ID grammar, the qualifiers) and ctx.page. Produces `a.xref[data-ref]`
// with aria-haspopup="dialog" and aria-expanded, chrome around split text, its href "#<ID>" resolved by nav (LD6).
//
// Standard files, slug `links`: test/enhance-links.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 13: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}
