// Figures: book captions (the reference layout, section 10). Built by L2 Task 15; until then a stub that builds
// nothing.
//
// Produces ctx.figures entries ({ no, caption, figure }), index entries of kind 'figure', and `span.fig-no` and
// `span.cap-text` by split and wrap. The caption grammar, `Figure N.`, is render()'s (PD7), the format contract.
// The self-hosted Mermaid file is built by the same task (scripts/build-mermaid.mjs).
//
// Standard files, slug `figures`: test/enhance-figures.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 15: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}
