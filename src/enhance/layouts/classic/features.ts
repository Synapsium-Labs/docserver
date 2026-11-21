// Classic's independent feature selection, built over the shared reader services.
import { build as buildCode } from '../../code.js';
import { build as buildDiagramTools } from '../../diagram-tools.js';
import { after as afterDiagrams, build as buildDiagrams } from '../../diagrams.js';
import type { Feature } from '../../features.js';
import { build as buildFigures } from '../../figures.js';
import { build as buildJump } from '../../jump.js';
import { build as buildPosition } from '../../position.js';
import { build as buildScroll } from '../../scroll.js';
import { buildStatusMarks } from '../../status.js';
import { build as buildTables } from '../../tables.js';
import { markFeature } from '../mark.js';
import { build as buildContents } from './contents.js';
import { build as buildEditorial } from './editorial.js';
import { build as buildReveal } from './reveal.js';

export function features(): readonly Feature[] {
  return Object.freeze([
    markFeature('classic'),
    { name: 'classic-editorial', build: buildEditorial },
    { name: 'tables', build: buildTables },
    { name: 'status', build: buildStatusMarks },
    { name: 'code', build: buildCode },
    { name: 'figures', build: buildFigures },
    { name: 'classic-contents', build: buildContents },
    { name: 'scroll', build: buildScroll },
    { name: 'jump', build: buildJump },
    { name: 'diagrams', build: buildDiagrams, after: afterDiagrams },
    { name: 'diagram-tools', build: buildDiagramTools },
    { name: 'classic-reveal', build: buildReveal },
    { name: 'position', build: buildPosition },
  ]);
}
