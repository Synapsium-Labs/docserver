// Editorial selects shared builders in their standard relative order.
import { build as buildCode } from '../../code.js';
import { build as buildDiagramTools } from '../../diagram-tools.js';
import { after as afterDiagrams, build as buildDiagrams } from '../../diagrams.js';
import { buildEditorial } from '../../editorial.js';
import type { Feature } from '../../features.js';
import { build as buildFigures } from '../../figures.js';
import { build as buildIds } from '../../ids.js';
import { build as buildJump } from '../../jump.js';
import { build as buildPlans } from './plans.js';
import { build as buildPosition } from '../../position.js';
import { createIndex } from '../../registry.js';
import { build as buildRules } from '../../rules.js';
import { build as buildScroll } from '../../scroll.js';
import { buildStatusMarks } from '../../status.js';
import { build as buildTables } from '../../tables.js';
import { build as buildContents } from '../contents.js';
import { build as buildReveal } from '../reveal.js';
import { markFeature } from '../mark.js';

export function features(): readonly Feature[] {
  return Object.freeze([
    markFeature('editorial'),
    { name: 'editorial', build: buildEditorial },
    { name: 'rules', build: buildRules },
    { name: 'tables', build: buildTables },
    { name: 'status', build: buildStatusMarks },
    { name: 'ids', build: buildIds },
    { name: 'editorial-plans', build: buildPlans },
    { name: 'code', build: buildCode },
    { name: 'figures', build: buildFigures },
    { name: 'editorial-contents', build: (ctx) => buildContents(ctx, 'editorial') },
    { name: 'scroll', build: buildScroll },
    { name: 'jump', build: buildJump },
    { name: 'diagrams', build: buildDiagrams, after: afterDiagrams },
    // Rules and rows remain jump targets, but this layout does not advertise definition dialogs it cannot open.
    { name: 'editorial-diagram-tools', build: (ctx) => buildDiagramTools({ ...ctx, index: createIndex(ctx.root) }) },
    { name: 'editorial-reveal', build: (ctx) => buildReveal(ctx, 'editorial') },
    { name: 'position', build: buildPosition },
  ]);
}
