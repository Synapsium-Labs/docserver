// Plans: tasks, steps and owners, and outline mode on long plans (the reference layout, sections 7 and 23). Built by
// L2 Task 11; until then a stub that builds nothing.
//
// Consumes ctx.vocab (the plan words; the addressees, as `addressee` in an owner line and `addresseeAnywhere` in a
// step's bracketed owner), slots.tools, keys (`o`), onReveal, position.keep, relayout,
// state.readDoc and writeDoc('outline'). Produces ctx.plan ({ tasks, steps, yours, outlineable }), section 7's
// classes, the root class `outline` and the Outline button. Text changes only by split and wrap; steps get no ids;
// a stored outline is applied during the build, so the full plan never flashes. Outline mode starts at 20 steps.
//
// Standard files, slug `plans`: test/enhance-plans.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 11: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}
