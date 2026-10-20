// What changed since a commit: marks and a stepper (the reference layout, section 24). Built by L2 Task 20; until
// then a stub that builds nothing.
//
// Consumes ctx.page, ctx.blocks, ctx.plan, host.changes (its reply, in the second phase), nav.goTo, reveal, keys
// (`n`, `p`, `w`) and slots.tools; emits `changes`. Produces section 24's classes, `chg` and `chg-del` journaled on
// blocks with data-line, and exports showChanges for Task 22. A change set is { changed: [from, to][];
// removedAfter: number[] }, checked (RF4): pairs of finite integers, from at most to, at most 10,000 of each,
// lines clamped to the last data-line; anything else reads as no changes.
//
// Standard files, slug `changes`: test/enhance-changes.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 20: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}

/** The second phase (LD5): the host's reply to changes(). A stub until L2 Task 20: it waits on nothing. */
export async function after(ctx: FeatureContext): Promise<void> {
  void ctx;
}
