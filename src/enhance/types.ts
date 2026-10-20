// The types of `./enhance`: the public ones (re-exported by index.ts) and the context every feature builds with.
// Import-inert: declarations only.
import type { BarSlots } from './bar.js';
import type { Cancel, Env } from './env.js';
import type { Folds } from './folds.js';
import type { HeadCtl } from './headctl.js';
import type { Host } from './host.js';
import type { Journal } from './journal.js';
import type { Keys } from './keys.js';
import type { Nav, Position } from './nav.js';
import type { FeatureOptions } from './options.js';
import type { Overlays } from './overlays.js';
import type { Block, Events, Figures, IdIndex, PageSlot, PlanSlot, RelayoutReason, Terms } from './registry.js';
import type { ReaderState } from './state.js';
import type { TextTools } from './text.js';
import type { Vocab } from './vocab.js';

/** The reader's settings, reader-wide (not per document). */
export interface Prefs {
  /** 'auto' follows the system's colour scheme; 'light' and 'dark' force one. */
  theme: 'auto' | 'light' | 'dark';
  /** The text column's width. */
  width: 'standard' | 'wide';
  /** The body face. */
  font: 'serif' | 'sans';
  /** The reading lens: 'all' shows everything; 'product' quiets implementation detail, never removing it. */
  lens: 'all' | 'product';
}

/** The host's storage, seen through two calls. The library never touches a storage API itself. */
export interface ReaderStorage {
  /**
   * What the host already has stored under this reader's keys. Read during startup only: the object once, then
   * each key this document needs once (`<namespace>:prefs`, then, as features ask, `<namespace>:doc:<storageKey>:<name>`,
   * the reading position's `<namespace>:pos:<posKey>` and the reader-wide `<namespace>:ui`; the namespace is the
   * `namespace` option, `docreader` by default).
   */
  readonly snapshot?: Readonly<Record<string, string>>;
  /**
   * Write-behind: called after a local change; null deletes. A rejected or throwing call is swallowed and does
   * not change local state. Calls for one key are serialized per storage object, across every enhance() given the
   * same object: a newer value is never overtaken by an older one.
   */
  set?(key: string, value: string | null): void | Promise<void>;
}

/** One front-matter entry, as render()'s meta.frontList holds it. */
export interface FrontListEntry {
  key: string;
  list: boolean;
  vals: string[];
}

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

/** What the host knows about the document. The library never reads document.title, location or a JSON script. */
export interface DocumentInfo {
  /** render()'s meta.title or null. */
  readonly title?: string | null;
  /** render()'s meta.frontList or null. */
  readonly frontList?: readonly FrontListEntry[] | null;
  /** The commit of the version shown, or null. */
  readonly sha?: string | null;
  /** True when the version shown is not a commit (a working copy): no "what changed" then. Default false. */
  readonly draft?: boolean;
  /**
   * The document's commits, newest first, or null; only the first 100 are read. (Named `commits`, not `history`:
   * the reader never names the page's history, and its source walls refuse that name.)
   */
  readonly commits?: readonly CommitEntry[] | null;
  /** The base commit of a one-day view: the version shown is `sha`, with the changes since `only` marked. */
  readonly only?: string | null;
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

/** Drawing Mermaid figures. The host passes the module, never a URL. */
export interface MermaidOptions {
  /** Resolve with Mermaid's module; called when drawing starts, never while the options are read. */
  load(): Promise<unknown>;
  /** The largest diagram source, in characters: an integer from 1 to 1048576. Default: the library's pinned value. */
  readonly maxTextSize?: number;
  /** The most edges a diagram may draw: an integer from 1 to 50000. Default: the library's pinned value. */
  readonly maxEdges?: number;
  /** Configuration keys a diagram's own directive may not set, added to the library's list (never removing one). */
  readonly secure?: readonly string[];
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

/** The options of enhance(). Read once, as plain data (own data properties only), when enhance() is called. */
export interface EnhanceOptions {
  /** Explicit starting prefs; they override stored ones. */
  prefs?: Partial<Prefs>;
  /** Absent: nothing persists, and the reader still works. */
  storage?: ReaderStorage;
  /** The per-document key namespace, such as "project-a:specs:x.md". Absent: no per-document state persists. */
  storageKey?: string;
  /** Explicit metadata. Absent: the title comes from the root's first h1. */
  info?: DocumentInfo;
  /** Section folding; default true. */
  folds?: boolean;
  /** Aborting it during startup is destroyEnhancement(root); once enhance() has resolved, it does nothing. */
  signal?: AbortSignal;
  /** The reading position's key; default storageKey. Absent with storageKey: the position does not persist. */
  posKey?: string;
  /** Single-key shortcuts; default true. */
  keyboard?: boolean;
  /** Which parts of its own chrome the reader builds; each defaults to true. */
  chrome?: ChromeOptions;
  /** Rule paragraphs and the rules index; default false. */
  rules?: boolean;
  /** The id to open the document at, without '#' (a heading id or a defined ID); empty or null for none. */
  initialHash?: string | null;
  /** A link the reader was asked to follow. Absent: the browser follows it. */
  onLink?(href: string, how: { readonly newTab: boolean }): void;
  /**
   * The reader went to `id` (null: back to no section). `push` asks for a new entry in the host's own navigation
   * history; `from` is an opaque token for the place being left, which the host hands back when it returns there.
   */
  onHash?(id: string | null, entry: { readonly push: boolean; readonly from: string | null }): void;
  /** Copy text for the reader. Absent: no Copy buttons. A throw or a rejection shows as a failed copy. */
  copy?(text: string): void | Promise<void>;
  /** The document's changes since commit `sha`, for "what changed". Absent: no comparison. */
  changes?(sha: string): Promise<unknown>;
  /** Show another version: `{ sha, only }` a day's version; `{ sha: null, only: null }` back to the latest. */
  openVersion?(v: { readonly sha: string | null; readonly only: string | null }): void;
  /**
   * The link for an item key the document names (`AB-12`: a capital, 1 to 9 capitals or digits, a dash, a number), or
   * null for none. Absent: no item links. The keys are read where `vocabulary.itemFields` and `itemHeadings` say;
   * without either, it is never called. At most 16 keys are asked for and at most 64 links written in a document; a
   * key past either stays text. A link that is not a string of 1 to 2048 code units, holds white space (any of
   * Unicode's, a byte-order mark included) or a control character (C0, DEL or C1), or names a scheme other than http
   * or https, is ignored.
   */
  itemLink?(key: string): string | null;
  /** Drawing Mermaid figures. Absent: no drawing; a figure shows its source. */
  mermaid?: MermaidOptions;
  /** The words the host's documents use; each list given replaces its default. */
  vocabulary?: VocabularyOptions;
  /**
   * The prefix of every storage key: a lower-case letter, then up to 31 lower-case letters, digits or dashes. Default
   * `docreader`: `<namespace>:prefs`, `<namespace>:ui`, `<namespace>:pos:<posKey>`, `<namespace>:doc:<storageKey>:<name>`.
   */
  namespace?: string;
}

/** Why enhance() (or setEnhancementPrefs) refused or failed. */
export type EnhanceErrorCode = 'invalid-options' | 'ownership' | 'aborted' | 'initialization';

export class EnhanceError extends Error {
  readonly code: EnhanceErrorCode;

  constructor(code: EnhanceErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'EnhanceError';
    this.code = code;
  }
}

/** The document's metadata as features see it: explicit info first, the DOM second. */
export interface ResolvedInfo {
  /** info.title when given (a string, or null); otherwise the text of the root's first h1, or null. */
  readonly title: string | null;
  /** info.frontList when given; otherwise null (the DOM's front-matter strip is not parsed back). */
  readonly frontList: readonly FrontListEntry[] | null;
  /** info.sha, or null. */
  readonly sha: string | null;
  /** info.draft, or false. */
  readonly draft: boolean;
  /** info.commits (at most 100), or null. */
  readonly commits: readonly CommitEntry[] | null;
  /** info.only, or null. */
  readonly only: string | null;
  /**
   * Port of the reference's document check, measured before any feature moves a node: a level-1 heading among
   * the root's children, and either three or more level-2 headings, or at least one level-2 and four level-3
   * headings, all children of the root. Folds only apply to a document.
   */
  readonly isDocument: boolean;
}

/**
 * One level-2 section of the document (the reference layout's section 0), measured before any feature moves a node:
 * a heading with an id among the root's children, and the root's children after it up to the next h1 or h2.
 */
export interface SectionUnit {
  readonly heading: HTMLElement;
  /** The blocks of the section, in order (frozen). */
  readonly members: readonly Element[];
  /** Its reading time, in minutes, as reading.ts measures it (script and dl blocks left out). */
  readonly minutes: number;
  /**
   * The hash (text.ts) of its source text: the heading's text, then each block's after a U+0001 separator, script and
   * dl blocks left out. Taken before any chrome exists, so chrome text never changes it; a read mark compares it.
   */
  readonly fingerprint: string;
}

/**
 * What a feature (editorial.ts, folds.ts, and later ones) receives during startup. Every DOM write goes through
 * `journal`, so destroyEnhancement can undo it; every handler goes through `journal.listen`, so it runs inside an
 * operation and does nothing once the instance is not live.
 */
export interface FeatureContext {
  /** The element enhance() was given. A feature writes inside it and nowhere else, and walks it (no id lookups). */
  readonly root: HTMLElement;
  /** The undo log of this instance: attribute and class writes, chrome inserts, wraps, listeners, cleanups. */
  readonly journal: Journal;
  /** Prefs and per-document state, with the host's storage behind them. */
  readonly state: ReaderState;
  /** Title, front matter and the document check. */
  readonly info: ResolvedInfo;
  /** The options, normalized. The host's functions are not here: they are reached through `host`. */
  readonly options: FeatureOptions;
  /** The host's callbacks, one wrapper each: safe when absent, silent once not live, called inside an operation. */
  readonly host: Host;
  /**
   * False once the instance is being destroyed. Check it after anything that can call out (a host callback, a
   * storage read or write, a dispatched event) and stop early when it is false.
   */
  live(): boolean;
  /**
   * Run `fn` as one operation of this instance: a no-op returning undefined once the instance is not live; a
   * destroy requested inside it defers its teardown until the outermost operation unwinds. Handlers registered
   * through `journal.listen` already run this way.
   */
  operate<T>(fn: () => T): T | undefined;
  /**
   * The root's window, behind one module (env.ts): timers, frames, idle callbacks, media queries, the viewport,
   * scrolling, window events, the fonts, observers, text widths, the clock. Callbacks run inside operations, and
   * destroy cancels every one still pending.
   */
  readonly env: Env;
  /** The document's level-2 sections, in order, measured before any node moved (frozen). */
  readonly sections: readonly SectionUnit[];
  /** Every word list, compiled (vocab.ts): a feature reads its words here, never from a list of its own. */
  readonly vocab: Vocab;
  /**
   * A new id for an element of this instance's chrome (a listbox option, a dialog's label): `name` is 1 to 32
   * lower-case letters, digits and dashes, starting with a letter. The id is `docreader.<n>.<name>`, n this instance's
   * number in the document: no other instance issues it, and no root render() makes can carry it (its ids have no
   * dots). It skips every id the document held when this instance first asked, and every id this instance issued;
   * each call answers a new one. Throws once the instance is not live.
   */
  chromeId(name: string): string;
  /** Text helpers (text.ts): clip, hash, document order, and the colour key. */
  readonly text: TextTools;

  // ── The shared services (docserver L2, Task 7b; LD1): made before the first feature builds. Each module's header is
  //    its contract; a feature reads another's work here, never from that feature's module, with two exceptions the
  //    plan names: changes.ts exports showChanges (Task 20, for Task 22) and cards.ts exports cards.show (Task 17, for
  //    Task 23). Each is an export of its module that takes the context and finds its own instance's state through a
  //    WeakMap keyed by the context, so it never reaches another root's.
  /** Every defined ID (registry.ts; LD6): the first definition wins; all() in document order. */
  readonly index: IdIndex;
  /** The glossary's terms (registry.ts; defined by glossary.ts). */
  readonly terms: Terms;
  /** The document's tables and code blocks, in document order, each with the flags features set (registry.ts; frozen). */
  readonly blocks: readonly Block[];
  /** The numbered figures (registry.ts; added by figures.ts). */
  readonly figures: Figures;
  /** Tasks, steps and the outline's threshold (registry.ts; published by plans.ts). */
  readonly plan: PlanSlot;
  /** The byline, the facts panel's seam and what waits on the reader (registry.ts; published by editorial.ts). */
  readonly page: PageSlot;
  /** prefs, relayout, spy, marks, changes, reveal (registry.ts). */
  readonly events: Events;
  /** Show an element whatever hides it: the author's details, then each revealer (reveal.ts). */
  reveal(el: Element): void;
  /** Register a revealer for what this feature hides (reveal.ts). */
  onReveal(fn: (el: Element) => void): Cancel;
  /** The reader's popups and panels, and the Escape order (overlays.ts). */
  readonly overlays: Overlays;
  /** The keyboard layer: bind a key; the keys that apply now (keys.ts). */
  readonly keys: Keys;
  /** byId, idOf and goTo, and the delegated click (nav.ts). */
  readonly nav: Nav;
  /** keep(fn), holdBar(), barHeld() (nav.ts; Task 14 completes keep). */
  readonly position: Position;
  /** Ask for a relayout: coalesced to one run at the next frame (relayout.ts). */
  relayout(reason: RelayoutReason): void;
  /** Measure again on every relayout (relayout.ts). */
  onRelayout(fn: (reasons: ReadonlySet<RelayoutReason>) => void): Cancel;
  /** Put a control in a heading's `.h-ctl`, slots in fixed order (headctl.ts). */
  readonly headCtl: HeadCtl;
  /** The bar's skeleton: bar, tools, running head, progress, skip link (bar.ts); null without chrome.bar. */
  readonly slots: BarSlots | null;
  /** The folds' members API (folds.ts): empty without folds. */
  readonly folds: Folds;
  /**
   * Change the prefs, as setEnhancementPrefs does: put them on the root, write them behind, emit 'prefs', and ask for
   * a relayout ('prefs' for the width or face, 'lens' for the lens). Throws EnhanceError('invalid-options') for a bad
   * value; does nothing once the instance is not live.
   */
  setPrefs(change: Partial<Prefs>): void;
}
