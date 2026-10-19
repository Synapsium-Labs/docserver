// The types of `./enhance`: the public ones (re-exported by index.ts) and the context every feature builds with.
// Import-inert: declarations only.
import type { Journal } from './journal.js';
import type { NormalizedOptions } from './options.js';
import type { ReaderState } from './state.js';

/** The reader's settings, reader-wide (not per document). */
export interface Prefs {
  /** 'auto' follows the system's colour scheme; 'light' and 'dark' force one. */
  theme: 'auto' | 'light' | 'dark';
  /** The text column's width. */
  width: 'standard' | 'wide';
  /** The body face. */
  font: 'serif' | 'sans';
}

/** The host's storage, seen through two calls. The library never touches a storage API itself. */
export interface ReaderStorage {
  /**
   * What the host already has stored under this reader's keys. Read during startup only: the object once, then
   * each key this document needs once (`docreader:prefs`, then `docreader:doc:<storageKey>:<name>`).
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

/** What the host knows about the document. The library never reads document.title, location or a JSON script. */
export interface DocumentInfo {
  /** render()'s meta.title or null. */
  readonly title?: string | null;
  /** render()'s meta.frontList or null. */
  readonly frontList?: readonly FrontListEntry[] | null;
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
  /**
   * Port of the reference's document check, measured before any feature moves a node: a level-1 heading among
   * the root's children, and either three or more level-2 headings, or at least one level-2 and four level-3
   * headings, all children of the root. Folds only apply to a document.
   */
  readonly isDocument: boolean;
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
  /** The options, normalized. */
  readonly options: NormalizedOptions;
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
}
