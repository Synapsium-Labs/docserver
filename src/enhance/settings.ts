// The reading settings menu: theme, typeface, width, lens, collapse and expand all, the colour key (the reference
// layout, section 22). Built by L2 Task 19; until then a stub that builds nothing.
//
// Built only with chrome.settings. Consumes state.prefs and setPrefs, events (`prefs`, so setEnhancementPrefs moves
// the radios), the folds' members, position.keep, relayout, text.colourKey, overlays, chromeId and slots.tools.
// Produces section 22's classes and the root class `lens-product` (LD12).
//
// Standard files, slug `settings`: test/enhance-settings.test.ts, and the browser tests and Level 2 cases its task
// names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 19: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}
