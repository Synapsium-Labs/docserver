// Preview cards for an ID mention, a term or a diagram block (the reference layout, section 20). Built by L2 Task 17;
// until then a stub that builds nothing.
//
// Consumes ctx.index, ctx.terms, `a.xref` and `a.term`, overlays, env (its timers), journal.setStyle (`left`, `top`,
// `max-height`) and nav.goTo. Produces `.xcard`, a dialog in the root, with `.open` and `.is-term`, and
// cards.show(trigger) for diagram blocks (Task 23). A clone drops ids and form controls and turns `a.xref` and
// `a.term` into text.
//
// Standard files, slug `cards`: test/enhance-cards.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 17: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}
