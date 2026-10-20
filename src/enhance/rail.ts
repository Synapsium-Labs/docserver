// The contents rail, with its Contents and Index tabs, and its drawer on a narrow screen (the reference layout,
// section 15). Built by L2 Task 18; until then a stub that builds nothing.
//
// Consumes ctx.sections, ctx.plan, ctx.index, events (`spy`), keys (`i`), overlays, chromeId and slots.tools. Stores
// `<ns>:doc:<key>:ixfold`, and the tab in the UI memory (state.readUi/writeUi('sidetab')). Inserts the rail block
// into assets/reader.css at its marker: a sticky column in the root from 1,240 px of viewport width (`--rail-w`),
// a drawer below it; the root classes `has-toc` and `toc-open`.
//
// Standard files, slug `rail`: test/enhance-rail.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 18: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}
