// The "Changes since" menu grouped by day, the notice of changes since the last visit, and the day view (the
// reference layout, section 24b). Built by L2 Task 22; until then a stub that builds nothing.
//
// Consumes info.sha, info.draft, info.commits (C47) and info.only; host.changes and host.openVersion; Task 20's
// showChanges; state (`<ns>:doc:<key>:seen`, { sha, at }, written once per load); overlays; chromeId; ctx.vocab's
// merge subjects and commit-prefix rule; journal.setStyle (`left`, `top`, `right`, `max-height`); env.now, the
// clock behind the day keys. "Only this day" and "Back to the latest" call openVersion; it builds no URL.
//
// Standard files, slug `since`: test/enhance-since.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 22: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}

/** The second phase (LD5): the host's reply to changes() for the notice. A stub until L2 Task 22: it waits on nothing. */
export async function after(ctx: FeatureContext): Promise<void> {
  void ctx;
}
