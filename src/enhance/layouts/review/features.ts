// The `review` layout's feature list (docserver parity Task 12): the reference review workbench, over the shared modules in
// their standard relative order (the header of src/enhance/features.ts says why each step comes where it does). The layout
// is the default reader's rail (Contents and Index tabs with read marks), ID chips and their previews, review strip,
// running head, quick jump and keys, with two things of its own: a header card around the title block, with the reader's
// progress, and a read-mark toggle in the bar. It leaves out section folding and the "changes since" menu, which the
// reference workbench does not have (the change stepper stays, as the reference's `n` key does).
//
// scripts/build-frame.mjs bundles this layout by resolving the lifecycle's import of `./features.js` to this file, so the
// module exports the same `features()` the shared list does. Import-inert: declarations only; the list is made when the
// lifecycle asks for it.
import { build as buildAttention } from '../../attention.js';
import { build as buildCards } from '../../cards.js';
import { after as afterChanges, build as buildChanges } from '../../changes.js';
import { build as buildCode } from '../../code.js';
import { build as buildDiagramTools } from '../../diagram-tools.js';
import { after as afterDiagrams, build as buildDiagrams } from '../../diagrams.js';
import { buildEditorial } from '../../editorial.js';
import type { Feature } from '../../features.js';
import { build as buildFigures } from '../../figures.js';
import { build as buildGlossary } from '../../glossary.js';
import { build as buildIds } from '../../ids.js';
import { build as buildJump } from '../../jump.js';
import { build as buildKeysheet } from '../../keysheet.js';
import { build as buildMarks } from '../../marks.js';
import { build as buildPlans } from '../../plans.js';
import { build as buildPosition } from '../../position.js';
import { build as buildRail } from '../../rail.js';
import { build as buildRules } from '../../rules.js';
import { build as buildScroll } from '../../scroll.js';
import { build as buildSettings } from '../../settings.js';
import { buildStatusMarks } from '../../status.js';
import { build as buildStrip } from '../../strip.js';
import { build as buildTables } from '../../tables.js';
import { build as buildXrefs } from '../../xrefs.js';
import { markFeature } from '../mark.js';
import { build as buildContext } from './context.js';
import { build as buildHeader } from './header.js';

/** The review layout's features, in build order. */
export function features(): readonly Feature[] {
  return Object.freeze([
    markFeature('review'),
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
    // After the strip (it is in the title block by now) and the marks (their controls exist).
    { name: 'review-header', build: buildHeader },
    { name: 'scroll', build: buildScroll },
    { name: 'cards', build: buildCards },
    { name: 'jump', build: buildJump },
    { name: 'review-context', build: buildContext },
    { name: 'settings', build: buildSettings },
    { name: 'changes', build: buildChanges, after: afterChanges },
    { name: 'keysheet', build: buildKeysheet },
    { name: 'diagrams', build: buildDiagrams, after: afterDiagrams },
    { name: 'diagram-tools', build: buildDiagramTools },
    { name: 'position', build: buildPosition },
  ]);
}
