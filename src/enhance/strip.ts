// The review strip under the byline: what waits on the reader, decision and plan counts (the reference layout,
// section 16). Built by L2 Task 20; until then a stub that builds nothing.
//
// Consumes ctx.page (byline, waiting, waitBox), ctx.blocks, ctx.plan, ctx.vocab (the decisions table's header word),
// nav.goTo and slots.tools. Produces section 16's
// classes. A link to a waiting item is a chrome anchor handled by goTo; no `waiting-N` ids.
//
// Standard files, slug `changes`: test/enhance-changes.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 20: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}
