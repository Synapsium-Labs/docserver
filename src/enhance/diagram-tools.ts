// Diagram tools: Copy Mermaid, Play, Animate edges, full screen and definitions (the reference layout, section 26,
// its tools). Built by L2 Task 23; until then a stub that builds nothing.
//
// Consumes the drawn SVGs, host.copy and host.present, ctx.terms, ctx.index, cards.show, overlays, env (timeout,
// frame, observeResize) and journal.setStyle (`transform`; `opacity` on clusters; `stroke-dasharray` and
// `stroke-dashoffset` per edge; `fill`, `stroke` and `stroke-width` with important on the dot and ring). Produces
// section 26's tools and `.fig-overlay` in the root (the clone's ids renamed with their references); full screen
// makes no history entry (LD7) and locks scrolling with a root class.
//
// Standard files, slug `diagram-tools`: test/enhance-diagram-tools.test.ts, and the browser tests and Level 2 cases
// its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 23: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}
