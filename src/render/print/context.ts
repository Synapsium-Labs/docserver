// What the printed blocks share while one document is transformed (print mode, docserver parity Task 7): the words in force,
// the document's tree, and what the title block hands to the review strip, as the reader's ctx.page does.
import type { FrontEntry } from '../types.js';
import type { ElN } from './tree.js';
import type { PrintVocab } from './vocab.js';

/** The facts panel a plugin builds into (src/enhance/registry.ts's FactsSeam), written statically. */
export interface FactsSeam {
  /** Takes list key `key` out of the panel; its values, or null when the panel does not show it. */
  take(key: string): readonly string[] | null;
  /** Puts `part` first in the summary, after earlier plugin parts. */
  summary(part: ElN): void;
  /** Puts `node` in the panel's body before the list, after earlier plugin blocks. */
  block(node: ElN): void;
}

export interface PrintCtx {
  readonly vocab: PrintVocab;
  /** reader.rules. */
  readonly rules: boolean;
  /** A virtual root: its children are what the reader's root holds. */
  readonly root: ElN;
  /** meta.frontList, or null. */
  readonly front: readonly FrontEntry[] | null;
  /** Each h2 and h3's text as the document wrote it, white space as one space, taken before anything moves. */
  readonly label: Map<ElN, string>;
  /** The reader's document check (ResolvedInfo.isDocument), measured before anything moves. */
  readonly isDocument: boolean;
  /** Set by the title block: the byline, or null. */
  byline: ElN | null;
  /** Set by the title block: the facts seam, a no-op without a panel. */
  facts: FactsSeam;
  /** Set by the boxes: the texts of the first "Waiting" callout's items (whole, white space as one space), and that box. */
  waiting: string[];
  waitBox: ElN | null;
  /** Set by the plan marks. */
  plan: { tasks: number; steps: number; yours: number };
}
