// Rule paragraphs and the rules index (the reference layout, sections 3 and 4): a plugin, built only with `rules:
// true`. Built by L2 Task 9; until then a stub that builds nothing.
//
// Consumes options.rules, ctx.vocab (the rule-ID grammar and a list's joins), statusOf (status.ts), ctx.blocks and
// ctx.page.facts (`take` for the rule-ID list keys; the "Rules index · N rules" part first in the summary; the rules
// `ol` before the `dl`). Produces index entries of kind 'rule' and section 3 and 4's classes. Writes no ids (LD6): a rule is
// found through the index. A rule's dash and status text are split off into a hidden chrome span, and the status
// word moves into the pill. Its document kinds belong to the plugin; its default ID shape is the vocabulary's.
//
// Standard files, slug `ids`: test/enhance-ids.test.ts, and the browser tests and Level 2 cases its task names.
// Registered in features.ts, whose header says where in the build order and why.
import type { FeatureContext } from './types.js';

/** Build this feature during startup. A stub until L2 Task 9: it builds nothing. */
export function build(ctx: FeatureContext): void {
  void ctx;
}
