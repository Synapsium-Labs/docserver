// The `guided` layout's feature list (docserver parity Task 13): the reference's direction C, guided layers, over the shared
// modules in their standard relative order (the header of src/enhance/features.ts says why each step comes where it does).
// It has what direction C has: the title block as a hero with a glance, every section's opening intro with the rest folded
// behind one button, reading time per section and in the Contents, glossary terms defined on hover, focus or tap, a Product
// and Engineering lens that quiets implementation detail without hiding it, tables that become cards on a phone, the quick
// jump, code copy, reveal on scroll and diagrams with their tools. It leaves out what direction C does not have: the Index
// tab, ID chips and their previews, the review strip, read marks, the change stepper and "changes since" menu, the keys sheet
// and the reading settings menu.
//
// Three modules are its own: a hero around the title block (hero.ts), the layers with the bar's reading tools (layers.ts)
// and the times in the shared Contents (contents.ts).
//
// scripts/build-frame.mjs bundles this layout by resolving the lifecycle's import of `./features.js` to this file, so the
// module exports the same `features()` the shared list does. Import-inert: declarations only; the list is made when the
// lifecycle asks for it.
import { build as buildAttention } from '../../attention.js';
import { build as buildCards } from '../../cards.js';
import { build as buildCode } from '../../code.js';
import { build as buildDiagramTools } from '../../diagram-tools.js';
import { after as afterDiagrams, build as buildDiagrams } from '../../diagrams.js';
import { buildEditorial } from '../../editorial.js';
import type { Feature } from '../../features.js';
import { build as buildFigures } from '../../figures.js';
import { build as buildGlossary } from '../../glossary.js';
import { build as buildJump } from '../../jump.js';
import { build as buildPosition } from '../../position.js';
import { createIndex } from '../../registry.js';
import { build as buildScroll } from '../../scroll.js';
import { buildStatusMarks } from '../../status.js';
import { build as buildTables } from '../../tables.js';
import { markFeature } from '../mark.js';
import { build as buildReveal } from '../reveal.js';
import { build as buildContents } from './contents.js';
import { build as buildHero } from './hero.js';
import { build as buildLayers } from './layers.js';

/** The guided layout's features, in build order. */
export function features(): readonly Feature[] {
  return Object.freeze([
    markFeature('guided'),
    { name: 'editorial', build: buildEditorial },
    { name: 'tables', build: buildTables },
    { name: 'status', build: buildStatusMarks },
    { name: 'code', build: buildCode },
    { name: 'figures', build: buildFigures },
    { name: 'glossary', build: buildGlossary },
    { name: 'attention', build: buildAttention },
    { name: 'guided-contents', build: buildContents },
    { name: 'scroll', build: buildScroll },
    { name: 'guided-hero', build: buildHero },
    { name: 'guided-layers', build: buildLayers },
    { name: 'cards', build: buildCards },
    { name: 'jump', build: buildJump },
    { name: 'diagrams', build: buildDiagrams, after: afterDiagrams },
    // No ID index in this layout, so no definition dialog the tools could not open: as editorial's.
    { name: 'guided-diagram-tools', build: (ctx) => buildDiagramTools({ ...ctx, index: createIndex(ctx.root) }) },
    { name: 'guided-reveal', build: (ctx) => buildReveal(ctx, 'classic') },
    { name: 'position', build: buildPosition },
  ]);
}
