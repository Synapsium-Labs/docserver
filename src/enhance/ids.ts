// IDs: lettered sections and ID rows (the reference layout, sections 6 and 8), on by default. Built by L2 Task 9;
// until then a stub that builds nothing.
//
// Consumes ctx.vocab (the ID grammar), statusOf (status.ts) and ctx.blocks. Produces index entries of kinds 'row'
// and 'section', blocks[].isIndex, and section 6 and 8's classes (`idcell`, a row's group from the nearest h2 or
// h3). Writes no ids (LD6). The open-rule width test reads env.matches('(min-width: 700px)'), not the window.
//
// Standard files, slug `ids`: test/enhance-ids.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 9: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}
