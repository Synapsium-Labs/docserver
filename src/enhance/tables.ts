// Tables: bullet cells, the filter and the measured widths (the reference layout, section 8, after its status marks).
// Built by L2 Task 10; until then a stub that builds nothing.
//
// Consumes ctx.blocks, env (textWidth, timeout, idle, viewport), onRelayout, journal.setStyle (`--thead-h`) and
// chromeId. Produces section 8's classes (`fits`, the filter on a table of 12 rows or more), `--thead-h` and a
// labelled role="region" on an overflowing element. A filtered row gets a journaled `hidden`; a bullet cell's `<br>`
// is hidden by a class, never removed. The 700 and 1,240 px thresholds read env.viewport().w, as the stylesheet's
// @media rules do.
//
// Standard files, slug `blocks`: test/enhance-blocks.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 10: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}
