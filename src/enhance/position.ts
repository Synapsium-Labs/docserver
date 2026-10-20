// The reading position, kept across reloads, and the `j` and `k` keys (the reference layout, sections 27 and 25).
// Built by L2 Task 14; until then a stub that builds nothing.
//
// Consumes host.onHash, initialHash, options.posKey and state.readPos/writePos (a checked token { line, offset, y }),
// ctx.sections, events (`spy`), keys (`j`, `k`), env (scrollTo, elementFromPoint, reducedMotion, onScroll,
// onPageHide, timeout), reveal and headCtl('anchor'). Produces position.keep(fn) (anchor now, restore after), the
// pin and its hold, the flash, and `j` (next section) and `k` (this section's start, or the previous one), through
// goTo with push false. Built last, once every block is where it will be.
//
// Standard files, slug `nav`: test/enhance-nav.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 14: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}
