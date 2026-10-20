// Feature registration, in the final build order (docserver L2, Task 7a; LD1). The lifecycle builds every feature
// through this list, one after another, inside the startup operation, and stops when the instance is no longer live.
// A feature's module exports `build(ctx)`; one that waits on the host (a reply to changes(), Mermaid's module) also
// exports `after(ctx)`, the second phase (LD5).
//
// The order is the reference layout's, section by section, and each step says what it needs from the steps before:
//   editorial   1, 2, 4, 5 and 6: the title block, the facts panel, the boxes, section numbers. First: it marks the
//               root (`data-docreader-root`) and reads the headings before anything changes them.
//   rules       3 and 4's rules index: rule paragraphs, then the index in the facts panel editorial built. Before
//               ids, so a rule defines its ID first (the index keeps the first definition).
//   tables      8's bullet cells and the filter, built here; the measured widths come in relayout. Before status, as
//               the reference split a cell's lines before it marked them.
//   status      8's status marks, the group rows and the phone cards' labels (status.ts): after tables, so a cell's
//               first bullet line is read without its bullet.
//   ids         6's lettered sections and 8's ID rows: after status, as an ID row takes its status from the row's
//               mark. Before plans (7, which the reference runs before 8): the heading an ID row is grouped under
//               still holds no plan chrome, so its text is the heading's own, as the reference read it (a label
//               taken before section 7 ran).
//   plans       7 and 23: tasks, steps and owners; a stored outline is applied here, so the full plan never flashes.
//               After tables, which reads no plan chrome (the reference's 7 then 8 shares nothing between them).
//   code        9: Copy buttons and widths.
//   figures     10: book captions; the figure entries the index and the quick jump list.
//   xrefs       12: the first mention of each defined ID links to it: after rules, ids and figures defined them.
//   glossary    12b: the first mention of each term: after xrefs, so a term never overlaps a link.
//   attention   12c: what needs the reader, and the lens's classes: after ids, plans and tables.
//   marks       14: read marks per section (the fingerprints) or per task on a long plan: after plans.
//   rail        15: contents and index: after ids, plans and marks.
//   strip       16: the review strip under the byline: after ids and plans.
//   scroll      17: progress, the running head, the phone bar and the spy: after the rail it keeps in step.
//   folds       19: section folding, with its control in each heading's controls: after the read marks, whose control
//               comes before it there.
//   cards       20: previews of IDs and terms: after xrefs and glossary made their links.
//   jump        21: the quick jump over sections, tasks, IDs and figures: after all of them.
//   settings    22: the reading settings and the lens: after folds (collapse all) and attention.
//   changes     24: what changed since a commit (its reply in the second phase): after strip.
//   since       24b: the "changes since" menu and the day view: after changes, whose display it drives.
//   keysheet    25: the keys sheet, listing every key bound when it opens: after the features that bind keys.
//   diagrams    26: drawing (in the second phase): after figures.
//   diagram-tools  26: the tools of a drawn diagram: after diagrams and cards.
//   position    27: the reading position: last, once every block is where it will be.
// The shared services (the index, reveal, overlays, keys, navigation, relayout, heading controls, the bar) are not
// features: the lifecycle makes them before the first build (Task 7b).
//
// Import-inert: declarations only; the list is made when the lifecycle asks for it.
import { build as buildAttention } from './attention.js';
import { build as buildCards } from './cards.js';
import { after as afterChanges, build as buildChanges } from './changes.js';
import { build as buildCode } from './code.js';
import { build as buildDiagramTools } from './diagram-tools.js';
import { after as afterDiagrams, build as buildDiagrams } from './diagrams.js';
import { buildEditorial } from './editorial.js';
import { build as buildFigures } from './figures.js';
import { buildFolds } from './folds.js';
import { build as buildGlossary } from './glossary.js';
import { build as buildIds } from './ids.js';
import { build as buildJump } from './jump.js';
import { build as buildKeysheet } from './keysheet.js';
import { build as buildMarks } from './marks.js';
import { build as buildPlans } from './plans.js';
import { build as buildPosition } from './position.js';
import { build as buildRail } from './rail.js';
import { build as buildRules } from './rules.js';
import { build as buildScroll } from './scroll.js';
import { build as buildSettings } from './settings.js';
import { after as afterSince, build as buildSince } from './since.js';
import { buildStatusMarks } from './status.js';
import { build as buildStrip } from './strip.js';
import { build as buildTables } from './tables.js';
import type { FeatureContext } from './types.js';
import { build as buildXrefs } from './xrefs.js';

export interface Feature {
  /** The feature's name: its module's file name. */
  readonly name: string;
  /** Build the feature during startup, inside the startup operation. Writes go through ctx.journal. */
  readonly build: (ctx: FeatureContext) => void;
  /**
   * The second phase (LD5), for a feature that waits on the host: started once every feature is built, inside an
   * operation, in this list's order, all of them at once. enhance() does not wait for it. After each await the
   * feature checks ctx.live() and runs its writes through ctx.operate; a rejection is the feature's to show (the
   * lifecycle only keeps it from going unhandled).
   */
  readonly after?: (ctx: FeatureContext) => Promise<void>;
}

/** Every feature, in build order (see the header). */
export function features(): readonly Feature[] {
  return Object.freeze([
    { name: 'editorial', build: buildEditorial },
    { name: 'rules', build: buildRules },
    { name: 'tables', build: buildTables },
    { name: 'status', build: buildStatusMarks },
    { name: 'ids', build: buildIds },
    { name: 'plans', build: buildPlans },
    { name: 'code', build: buildCode },
    { name: 'figures', build: buildFigures },
    { name: 'xrefs', build: buildXrefs },
    { name: 'glossary', build: buildGlossary },
    { name: 'attention', build: buildAttention },
    { name: 'marks', build: buildMarks },
    { name: 'rail', build: buildRail },
    { name: 'strip', build: buildStrip },
    { name: 'scroll', build: buildScroll },
    { name: 'folds', build: buildFolds },
    { name: 'cards', build: buildCards },
    { name: 'jump', build: buildJump },
    { name: 'settings', build: buildSettings },
    { name: 'changes', build: buildChanges, after: afterChanges },
    { name: 'since', build: buildSince, after: afterSince },
    { name: 'keysheet', build: buildKeysheet },
    { name: 'diagrams', build: buildDiagrams, after: afterDiagrams },
    { name: 'diagram-tools', build: buildDiagramTools },
    { name: 'position', build: buildPosition },
  ]);
}
