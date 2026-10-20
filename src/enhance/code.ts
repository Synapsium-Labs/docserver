// Code blocks: Copy buttons and widths (the reference layout, section 9). Built by L2 Task 10; until then a stub that
// builds nothing.
//
// Consumes ctx.blocks, host.copy and host.present (no `copy`, no buttons), env.textWidth (a 7.5 px fallback),
// env.timeout, onRelayout and chromeId. Produces section 9's classes (`long`), the second Copy button on a tall
// block and a labelled role="region" on a block that scrolls sideways. Copy passes the block's textContent.
//
// Standard files, slug `blocks`: test/enhance-blocks.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 10: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}
