// Diagrams: each Mermaid figure drawn in the second phase, with a readable fallback (the reference layout, section
// 26, its drawing). Built by L2 Task 21; until then a stub that builds nothing.
//
// Consumes options.mermaid (the limits and the secure keys) and ctx.host.loadMermaid() (C47), ctx.figures, env
// (fonts, frame, observeIntersection) and journal.setStyle (`--fig-w`). Produces the root attributes
// `data-docreader-mermaid` (set when drawing starts) and `data-docreader-diagrams` (`drawing`, `drawn`, `partial`
// or `failed`, LD5); the drawing, a chrome `pre.mermaid` beside the document's own `pre`, which is never written
// into; the figure's journaled class `drawn` or `draw-failed`; `.fig-error`, holding the source in a `details`;
// and `svg[role=img][aria-label]`.
//
// Standard files, slug `diagrams`: test/enhance-diagrams.test.ts, and the browser tests and Level 2 cases its task
// names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 21: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}

/** The second phase (LD5): Mermaid's module and the drawing. A stub until L2 Task 21: it waits on nothing. */
export async function after(ctx: FeatureContext): Promise<void> {
  void ctx;
}
