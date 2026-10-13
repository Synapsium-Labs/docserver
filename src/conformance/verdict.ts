// The verdict of a hostile or generated corpus case (docserver L1; architecture sections D, E and F).
// A verdict states what must hold of a render without pinning its exact output: the outcome, structural
// bounds and time bounds. This version declares the shape only; Task 11 adds conformance/hostile.json,
// evaluateVerdict and the ratchet that keeps every verdict from weakening.
import type { RenderOutcome } from '../render/types.js';

export interface Verdict {
  /** The outcome the render must have. */
  outcome: RenderOutcome;
  /** Wall-clock bound in milliseconds, before runCorpus's time scale. */
  maxMs?: number;
  /** Bound on output length divided by input length. */
  maxOutputRatio?: number;
  /** Bound on the nesting depth of each named element. */
  maxTagDepth?: Readonly<Record<string, number>>;
  /** Strings the output must not contain. */
  forbid?: readonly string[];
  /** Strings the output must contain. */
  require?: readonly string[];
  /** Elements whose opening and closing tags must balance. */
  balanced?: readonly string[];
  /** The case also has an exact golden under conformance/expected/. */
  exact?: boolean;
  /** The headings' ids must be `base`, `base-1`, … `base-(count-1)`, in order. */
  headingIds?: { base: string; count: number };
}
