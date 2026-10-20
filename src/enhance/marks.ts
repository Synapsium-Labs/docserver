// Read marks per section, and "changed since you read it" (the reference layout, section 14). Built by L2 Task 18;
// until then a stub that builds nothing.
//
// Consumes ctx.sections (source-text fingerprints, so chrome text never flips a mark), ctx.plan (a task unit on a
// long plan), events (`spy`, `changes`), headCtl('mark') and keys (`m`). Stores `<ns>:doc:<key>:marks` (heading id
// to fingerprint: read into a Map, written with a null prototype, pruned of ids that no longer exist). Produces
// section 14's classes.
//
// Standard files, slug `rail`: test/enhance-rail.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 18: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}
