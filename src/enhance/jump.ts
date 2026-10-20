// The quick jump: "/" or Ctrl or Cmd+K, over sections, tasks, IDs and figures (the reference layout, section 21).
// Built by L2 Task 16; until then a stub that builds nothing.
//
// Consumes ctx.sections, ctx.plan, ctx.index, ctx.figures, slots.tools, overlays, keys, nav.goTo and chromeId.
// Produces `.jump-btn`, and `.jump`, a combobox with a listbox and aria-activedescendant on per-instance ids
// (chromeId).
//
// Standard files, slug `jump`: test/enhance-jump.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 16: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}
