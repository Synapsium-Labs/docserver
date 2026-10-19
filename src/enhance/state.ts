// Reader state: the prefs (reader-wide) and per-document state (folds today), kept locally and written behind to
// the host's storage. The library never touches a storage API; it reads the host's snapshot during startup and
// calls the host's set() after each local change.
//
// Storage keys (the README states them):
//   docreader:prefs                      a JSON object { theme, width, font }, reader-wide
//   docreader:doc:<storageKey>:<name>    per-document JSON, such as docreader:doc:project-a:specs:x.md:folds
// Invalid stored JSON, or a stored value of the wrong shape, is ignored, never thrown.
//
// Reading: the snapshot object is read once, when the state is created; each key is read at most once after
// that, the first time it is needed, and only during startup (`seal()` closes the snapshot). Only this reader's
// keys are read, so a host may pass its whole store.
//
// Writing: the local value changes first, synchronously; set() is called after. Calls for one key are serialized:
// while a call's promise is pending, a newer value waits (only the newest waiting value is sent), so an older
// value can never land after a newer one. A throwing or rejecting set() is swallowed and leaves local state as it
// is. Completions run inside the instance's operation, so once the instance is not live no new call is issued;
// destroy does not wait for a pending one.
import type { Journal } from './journal.js';
import { isPrefValue, PREF_VALUES } from './options.js';
import type { Prefs, ReaderStorage } from './types.js';

export const PREFS_KEY = 'docreader:prefs';

/** The storage key of a per-document value: docreader:doc:<storageKey>:<name>. */
export function docKey(storageKey: string, name: string): string {
  return `docreader:doc:${storageKey}:${name}`;
}

/** The defaults: the first value each pref accepts. */
export function defaultPrefs(): Prefs {
  return { theme: PREF_VALUES.theme[0], width: PREF_VALUES.width[0], font: PREF_VALUES.font[0] };
}

export interface ReaderState {
  /** The prefs in force: defaults < valid stored values < explicit options.prefs < later changes. */
  readonly prefs: Readonly<Prefs>;
  /** Change prefs locally, then write the stored prefs behind. Returns whether the prefs in force changed. */
  setPrefs(change: Partial<Prefs>): boolean;
  /**
   * A per-document value: the local one if set since startup, else the stored one parsed (read during startup
   * only), else undefined. Always undefined without a storageKey.
   */
  readDoc(name: string): unknown;
  /** Change a per-document value locally (null clears it), then write it behind. Local only without a storageKey. */
  writeDoc(name: string, value: unknown): void;
  /** Close the snapshot: after startup no key is read from it again. */
  seal(): void;
}

interface Slot {
  busy: boolean;
  waiting: { value: string | null } | null;
}

function isThenable(v: unknown): v is PromiseLike<unknown> {
  try {
    return (typeof v === 'object' || typeof v === 'function') && v !== null && typeof (v as { then?: unknown }).then === 'function';
  } catch {
    return false;
  }
}

function parseJson(raw: string | undefined): unknown {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export interface StateArgs {
  readonly storage: ReaderStorage | null;
  readonly storageKey: string | null;
  /** options.prefs: they override stored values, and are not themselves written back. */
  readonly explicit: Readonly<Partial<Prefs>>;
  /** Run a storage completion as an operation of the instance (refused once it is not live). */
  readonly operate: (fn: () => void) => void;
  /** Whether the instance is still live. */
  readonly live: () => boolean;
}

/** Create the state. Reads the snapshot object and the prefs key: host code may run (and may destroy). */
export function createReaderState(args: StateArgs): ReaderState {
  const { storage, storageKey, explicit, operate, live } = args;
  let snapshot: Readonly<Record<string, unknown>> | null = null;
  let set: ((key: string, value: string | null) => unknown) | null = null;
  if (storage !== null) {
    try {
      const s: unknown = storage.snapshot;
      if (typeof s === 'object' && s !== null) snapshot = s as Record<string, unknown>;
    } catch {
      snapshot = null; // a throwing snapshot reads as an empty one
    }
    try {
      const f: unknown = storage.set;
      if (typeof f === 'function') set = (key, value) => (f as (k: string, v: string | null) => unknown).call(storage, key, value);
    } catch {
      set = null;
    }
  }

  /** Each key's stored text, read at most once. */
  const read = new Map<string, string | undefined>();
  const readRaw = (key: string): string | undefined => {
    if (read.has(key)) return read.get(key);
    let raw: string | undefined;
    if (snapshot !== null) {
      try {
        const v = snapshot[key];
        raw = typeof v === 'string' ? v : undefined;
      } catch {
        raw = undefined;
      }
    }
    read.set(key, raw);
    return raw;
  };

  const slots = new Map<string, Slot>();
  const issue = (key: string, slot: Slot, value: string | null): void => {
    if (set === null || !live()) return;
    let result: unknown;
    try {
      result = set(key, value);
    } catch {
      return; // swallowed: local state stays as it is
    }
    if (!isThenable(result)) return;
    slot.busy = true;
    const done = (): void => {
      operate(() => {
        slot.busy = false;
        const next = slot.waiting;
        slot.waiting = null;
        if (next !== null) issue(key, slot, next.value);
      });
    };
    Promise.resolve(result).then(done, done);
  };
  const writeBehind = (key: string, value: string | null): void => {
    if (set === null) return;
    let slot = slots.get(key);
    if (slot === undefined) slots.set(key, (slot = { busy: false, waiting: null }));
    if (slot.busy) slot.waiting = { value };
    else issue(key, slot, value);
  };

  // Prefs: the stored object (unknown fields are kept when it is written back), its valid fields, then explicit.
  const storedRecord = parseJson(readRaw(PREFS_KEY));
  let persisted: Record<string, unknown> = isPlainRecord(storedRecord) ? { ...storedRecord } : {};
  let prefs: Prefs = defaultPrefs();
  for (const name of ['theme', 'width', 'font'] as const) {
    const v = persisted[name];
    if (isPrefValue(name, v)) prefs = { ...prefs, [name]: v };
  }
  prefs = { ...prefs, ...explicit };

  const docLocal = new Map<string, unknown>();

  return {
    get prefs() {
      return prefs;
    },

    setPrefs(change) {
      const next: Prefs = { ...prefs, ...change };
      const changed = next.theme !== prefs.theme || next.width !== prefs.width || next.font !== prefs.font;
      prefs = next;
      const before = JSON.stringify(persisted);
      persisted = { ...persisted, ...change };
      const after = JSON.stringify(persisted);
      if (after !== before) writeBehind(PREFS_KEY, after);
      return changed;
    },

    readDoc(name) {
      if (storageKey === null) return undefined;
      if (docLocal.has(name)) return docLocal.get(name);
      // After seal() the snapshot is gone: a key read during startup keeps its text, any other reads as absent.
      return parseJson(readRaw(docKey(storageKey, name)));
    },

    writeDoc(name, value) {
      docLocal.set(name, value);
      if (storageKey === null) return;
      writeBehind(docKey(storageKey, name), value === null ? null : JSON.stringify(value));
    },

    seal() {
      snapshot = null;
    },
  };
}

/** Put the prefs on the root: data-theme (absent for 'auto', so the stylesheet's system rule applies), data-width, data-font. */
export function applyPrefs(journal: Journal, root: Element, prefs: Readonly<Prefs>): void {
  journal.setAttribute(root, 'data-theme', prefs.theme === 'auto' ? null : prefs.theme);
  journal.setAttribute(root, 'data-width', prefs.width);
  journal.setAttribute(root, 'data-font', prefs.font);
}
