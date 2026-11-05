// What the frame does with one parent message that inbound.ts accepted (docserver batch 1.1, C108; before it was inline in
// the bootstrap's port handler, and moved here so a unit case can drive it). Bundled into the bootstrap; DOM-free, and
// generic over the reader's root, which it only passes on.
//
//   changes.result  to the outbox's changes slot
//   mermaid         to the bootstrap's offer (it judges the seed's mode, the state and "once" itself)
//   command         the reader's runEnhancementCommand(root, name), only when both the root and the reader's API are held;
//                   its answer is ignored (there is no reply op) and a throw is contained: the port keeps working
//   prefs           the reader's setEnhancementPrefs(root, prefs), under the same rule; a refused change leaves the prefs
//
// The state check (settled, no protocol mismatch) is the caller's.
import type { ParentToFrame } from '../frame/protocol.js';
import type { ChangesResult } from './outbox.js';

/** What the frame holds of the reader: enhance-entry.ts's API, as far as the parent's messages reach it. */
export interface ReaderApi<R> {
  setEnhancementPrefs(root: R, prefs: unknown): void;
  /** Absent from a reader script that predates the commands; the frame and the script ship together, so it is there. */
  runEnhancementCommand?(root: R, name: string): unknown;
}

/** The parts a parent message reaches. */
export interface DispatchTargets<R> {
  /** The root the reader enhanced, or null before it did. */
  readonly root: R | null;
  /** The reader's API, or null when it never registered. */
  readonly api: ReaderApi<R> | null;
  answer(m: ChangesResult): void;
  offerMermaid(m: Extract<ParentToFrame, { t: 'mermaid' }>): void;
}

/** Acts on one accepted parent message (see the header). */
export function dispatchParentMessage<R>(m: ParentToFrame, to: DispatchTargets<R>): void {
  const { root, api } = to;
  if (m.t === 'changes.result') {
    to.answer(m);
  } else if (m.t === 'mermaid') {
    to.offerMermaid(m);
  } else if (m.t === 'command') {
    if (root !== null && api !== null) {
      try {
        api.runEnhancementCommand?.(root, m.name);
      } catch {
        // a command that throws changes nothing for the parent, which gets no reply either way
      }
    }
  } else if (m.t === 'prefs' && root !== null && api !== null) {
    const { t: _t, ...prefs } = m;
    try {
      api.setEnhancementPrefs(root, prefs);
    } catch {
      // a refused change leaves the prefs as they were
    }
  }
}
