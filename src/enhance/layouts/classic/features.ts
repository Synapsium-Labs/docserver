// The `classic` layout's feature list. PROVISIONAL until the layout's own task ports it (docserver parity Task 10): for
// now it is the default list in the default order, less `attention`, `strip` and `since`, behind the layout mark, so
// that the bundle differs from every other layout's and from the default's. Every feature is a shared module of
// src/enhance, imported and never copied.
//
// scripts/build-frame.mjs bundles this layout by resolving the lifecycle's import of `./features.js` to this file, so the
// module exports the same `features()` the shared list does. Import-inert: declarations only; the list is made when the
// lifecycle asks for it.
import { build as buildCards } from '../../cards.js';
import { after as afterChanges, build as buildChanges } from '../../changes.js';
import { build as buildCode } from '../../code.js';
import { build as buildDiagramTools } from '../../diagram-tools.js';
import { after as afterDiagrams, build as buildDiagrams } from '../../diagrams.js';
import { buildEditorial } from '../../editorial.js';
import type { Feature } from '../../features.js';
import { build as buildFigures } from '../../figures.js';
import { buildFolds } from '../../folds.js';
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
import { build as buildTables } from '../../tables.js';
import { build as buildXrefs } from '../../xrefs.js';
import { markFeature } from '../mark.js';

/** The classic layout's features, in build order. */
export function features(): readonly Feature[] {
  return Object.freeze([
    markFeature('classic'),
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
    { name: 'marks', build: buildMarks },
    { name: 'rail', build: buildRail },
    { name: 'scroll', build: buildScroll },
    { name: 'folds', build: buildFolds },
    { name: 'cards', build: buildCards },
    { name: 'jump', build: buildJump },
    { name: 'settings', build: buildSettings },
    { name: 'changes', build: buildChanges, after: afterChanges },
    { name: 'keysheet', build: buildKeysheet },
    { name: 'diagrams', build: buildDiagrams, after: afterDiagrams },
    { name: 'diagram-tools', build: buildDiagramTools },
    { name: 'position', build: buildPosition },
  ]);
}
