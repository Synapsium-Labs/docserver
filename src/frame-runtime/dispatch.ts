// What the frame does with one parent message that inbound.ts accepted (docserver batch 1.1, C108; before it was inline in
// the bootstrap's port handler, and moved here so a unit case can drive it). Bundled into the bootstrap; DOM-free, and
// generic over the reader's root, which it only passes on.
//
//   changes.result  to the outbox's changes slot
//   mermaid         to the bootstrap's offer (it judges the seed's mode, the state and "once" itself)
//   command         the reader's runEnhancementCommand(root, name), only when both the root and the reader's API are held;
//                   its answer is ignored (there is no reply op) and a throw is contained: the port keeps working. `goto`
//                   adds a third argument, `{ id, from? }` (`from` absent when the message had none); every other name,
//                   `close-overlay` and `print-figures` included, passes the root and the name only (ruling R1). A reader
//                   that does not know a name answers false, as it does for any name it lacks.
//   reading         the reader's setEnhancementReading(root, mode), under the same rule, with a throw contained (reader mode, LX6.1)
//   prefs           the reader's setEnhancementPrefs(root, prefs), under the same rule; a refused change leaves the prefs
//   appearance      the reader's setEnhancementAppearance(root, value), under the same rule and with a throw contained;
//                   the reader runs the contract's validator on the value, this file only passes it on
//
// The state check (settled, no protocol mismatch) is the caller's.
import type { ParentToFrame } from '../frame/protocol.js';
import type { ChangesResult } from './outbox.js';

/** What the frame holds of the reader: enhance-entry.ts's API, as far as the parent's messages reach it. */
export interface ReaderApi<R> {
  setEnhancementPrefs(root: R, prefs: unknown): void;
  /** Absent from a reader script that predates the commands; the frame and the script ship together, so it is there. */
  runEnhancementCommand?(root: R, name: string, args?: { readonly id: string; readonly from?: string }): unknown;
  /** The appearance contract's two entries (the reader script ships with the frame, so both are there; optional so a reader script that predates them still registers). */
  setEnhancementAppearance?(root: R, value: unknown): void;
  loadHostFonts?(fonts: unknown): void;
  /** Reader mode (LX6.1); optional so a reader script that predates it still registers. */
  setEnhancementReading?(root: R, mode: string): void;
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
        if (m.name === 'goto') api.runEnhancementCommand?.(root, m.name, m.from === undefined ? { id: m.id } : { id: m.id, from: m.from });
        else api.runEnhancementCommand?.(root, m.name);
      } catch {
        // a command that throws changes nothing for the parent, which gets no reply either way
      }
    }
  } else if (m.t === 'appearance' || m.t === 'reading') {
    // One branch for the two in-place switches (a byte saving: the bootstrap's budget is tight).
    if (root !== null && api !== null) {
      try {
        if (m.t === 'reading') api.setEnhancementReading?.(root, m.mode);
        else api.setEnhancementAppearance?.(root, m.appearance);
      } catch {
        // a value or mode the reader cannot apply changes nothing for the parent, which gets no reply either way
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
