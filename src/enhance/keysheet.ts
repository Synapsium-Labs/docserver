// The keys sheet: "?" lists the keys that apply now, with the colour key (the reference layout, section 25). Built by
// L2 Task 16; until then a stub that builds nothing.
//
// Consumes keys.bindings() (read when the sheet opens, so a key bound by a later feature appears with no edit
// here), overlays, chromeId and text.colourKey. Produces `.keys`, a dialog.
//
// Standard files, slug `jump`: test/enhance-jump.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 16: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}
