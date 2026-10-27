// The plain-data shapes of L2's options that the frame contract names (docserver L3, Task 1; plan Reference §1; review
// finding C1): CommitEntry (RenderInput.version.commits), ChromeOptions and VocabularyOptions (FrameFeatures). They are
// copies of src/enhance/types.ts's, because src/frame typechecks with no DOM lib (tsconfig.frame.json, Reference §12) and
// src/enhance/types.ts reaches DOM types through its imports. test/enhance-frame-wire.test.ts holds each copy equal to
// L2's own in the one typecheck project where both sides compile, so a drift on either side is a red `npm run typecheck`.
// The reader prefs the bridge carries are FRAME_PREF_VALUES in protocol.ts, held equal to L2's PREF_VALUES the same way,
// and FramePrefs below is derived from them. Import-inert: declarations only. A later task names these from here, never
// from ../enhance/types.js: Reference §1's `import type { ChromeOptions, CommitEntry, Prefs as EnhancePrefs,
// VocabularyOptions } from '../enhance/types.js'` reads `import type { ChromeOptions, CommitEntry, FramePrefs,
// VocabularyOptions } from './wire-types.js'` in src/frame.
import type { FramePrefValues } from './protocol.js';

/**
 * The reader prefs the frame takes: theme, width and font, each required (Reference §1's `FramePrefs`, L2's `Prefs`
 * without the lens, which stays frame-local, Q1). Hosts pass `Partial<FramePrefs>`.
 */
export type FramePrefs = Required<FramePrefValues>;

/**
 * One commit of the document, as the host's version control lists it. A sha is 7 to 40 hex characters, or exactly
 * 64 (a SHA-256 repository).
 */
export interface CommitEntry {
  readonly sha: string;
  /** The commit's subject line, cut to 200 code units. */
  readonly subject: string;
  /** When it was made, as an ISO 8601 date and time; at most 64 characters. */
  readonly date: string;
  /** Its parents' shas, first parent first; the first 16 are kept. */
  readonly parents: readonly string[];
}

/** Which parts of the reader's own chrome it builds; each defaults to true (a host may build its own bar). */
export interface ChromeOptions {
  /** The bar at the top of the root: tools, progress and the running head. */
  readonly bar?: boolean;
  /** The contents rail, or its drawer on a narrow screen. */
  readonly rail?: boolean;
  /** The reading settings menu. */
  readonly settings?: boolean;
}

/**
 * The words a host's documents use, for the parts of the layout that read them (docserver L2, Task 8; LD9). Each list
 * is plain words, never a pattern: every character is matched as itself (in any case, where the field says so), an
 * empty list matches no word, and a list given replaces its default whole (a list left out keeps it). A list holds at
 * most 200 words, each 1 to 64 code units with no white space at either end; duplicates are dropped. How each list
 * is matched (a whole word, the start of a text, anywhere) is the library's, as its field says. A whole word is
 * whole in any script: where the word ends in a letter, a digit, a combining mark or `_`, the text has none of those
 * right beyond it ("готово" and "validé" are words as "done" is); where it ends in anything else ("done!", "✓"),
 * that edge needs nothing of the text.
 */
export interface VocabularyOptions {
  /**
   * Status words by colour role: a status cell or a rule's status that opens with one, as a whole word and in any
   * case, takes its role. Default: the general words of each role (agreed, done, pending, open, rejected, deferred, …).
   */
  readonly status?: {
    readonly ok?: readonly string[];
    readonly wait?: readonly string[];
    readonly no?: readonly string[];
    readonly info?: readonly string[];
  };
  /** Header words that name a status column, each as a whole word. Default: status, state, result, verdict, outcome (each also plural), stands, fate. */
  readonly statusHeaders?: readonly string[];
  /**
   * Header words that name a ruling, anywhere in the header: such a column, or one whose header ends in "?", is a
   * status column when half its filled cells open on a status word. Default: ruling, ruled, answer. The "?" rule is
   * no word: it stands with an empty list.
   */
  readonly rulingHeaders?: readonly string[];
  /** What needs the reader. */
  readonly attention?: {
    /** A status column's header holds one, anywhere. Default: status, state, stands, verdict. */
    readonly status?: readonly string[];
    /** An owner column's header opens with one, as a whole word. Default: who, owner, by whom, who acts. */
    readonly who?: readonly string[];
    /** A question table's first header opens with one. Default: question. */
    readonly question?: readonly string[];
    /** An answer still open opens with one, as a whole word. Default: open, unanswered, tbd, to be decided, waiting. */
    readonly openAnswers?: readonly string[];
    /** A cell that blocks opens with one, as a whole word. Default: blocking, blocker, blocks. */
    readonly blocking?: readonly string[];
    /** A status that is a risk holds one, anywhere. Default: diverge. */
    readonly risk?: readonly string[];
    /** A rule's status still open opens with one. Default: open, proposed, awaiting. */
    readonly openStatus?: readonly string[];
  };
  /**
   * The ID grammar: 1 to 4 capitals, an optional dash, a number with dotted or dashed parts and an optional lower-case
   * letter (R14, F3, OP-6, D2.1a). `prefixes` replaces the capitals with these words; false: no IDs at all.
   */
  readonly ids?: false | { readonly prefixes?: readonly string[] };
  /** The rule-ID grammar: two or more capitals, then dash-separated parts of capitals or digits; `prefixes` replaces the capitals. */
  readonly ruleIds?: { readonly prefixes?: readonly string[] };
  /** Words that, right before a mention of an ID, make it another document's ("the annex R3"). Default: none. */
  readonly qualifiers?: readonly string[];
  /** A task heading's word, a step title's word and an owner line's label. Default: Task, Step, Who. */
  readonly plan?: { readonly task?: readonly string[]; readonly step?: readonly string[]; readonly who?: readonly string[] };
  /** Words that name the reader, in an owner line, an owner cell or a step's owner. Default: you. */
  readonly addressees?: readonly string[];
  /** Byline labels whose value names an item key, exactly, in any case ("Tracker: AB-12"), for `itemLink`. Default: none. */
  readonly itemFields?: readonly string[];
  /**
   * Level-2 headings, after an optional section number, whose section's first code block names an item key on an
   * `item:` line, for `itemLink`. Default: none.
   */
  readonly itemHeadings?: readonly string[];
}
