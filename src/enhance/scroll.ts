// Scrolling: the progress bar, the running head, the phone bar and the scroll spy (the reference layout, section 17).
// Built by L2 Task 12; until then a stub that builds nothing.
//
// Consumes slots (the bar's skeleton), ctx.sections, env.onScroll, env.frame, env.viewport, env.now, position.barHeld()
// and journal.setStyle (the progress width). Produces events.emit('spy', { section, unit }), the measured `--bar-h`,
// and the root classes `scrolled` and `bar-hidden`. A host that scrolls an inner element is out of scope for L2.
//
// Standard files, slug `scroll`: test/enhance-scroll.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 12: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}
