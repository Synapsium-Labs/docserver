// Reader state: the prefs and the UI memory (reader-wide), the reading position (per position key), and per-document
// state (folds today), kept locally and written behind to the host's storage. The library never touches a storage
// API; it reads the host's snapshot during startup and calls the host's set() after each local change.
//
// Storage keys (the README states them; LD8 adds the two in the middle):
//   docreader:prefs                      a JSON object { theme, width, font, lens }, reader-wide
//   docreader:ui                         a JSON object of UI memory fields (which rail tab, say), reader-wide
//   docreader:pos:<posKey>               the reading position of one document, as its feature stores it
//   docreader:doc:<storageKey>:<name>    per-document JSON, such as docreader:doc:project-a:specs:x.md:folds
// Invalid stored JSON, or a stored value of the wrong shape, is ignored, never thrown. A stored value is returned as
// `unknown`: the feature that reads it checks its shape, type, count and length.
//
// Reading: the snapshot object is read once, when the state is created, and the prefs key with it; every other key
// is read at most once after that, the first time it is needed, and only during startup (`seal()` closes the
// snapshot). Only this reader's keys are read, so a host may pass its whole store. A UI field or a position read
// after startup, with its key never read during it, reads as absent.
//
// Writing: the local value changes first, synchronously; set() is called after. Calls for one key are serialized
// per storage object, across every instance that shares it (two roots on one page, or a root enhanced again after
// a destroy): while a call is in flight, a newer value waits (only the newest waiting value is sent), so an older
// value can never land after a newer one. The slot is claimed before set() is called, so a set() that calls back
// into the reader queues its nested write instead of issuing it inside the outer call. A throwing or rejecting
// set() is swallowed and leaves local state as it is. A waiting value is issued inside the operation of the
// instance that queued it, so once that instance is not live it is dropped; destroy does not wait for a pending
// call. A write asked for once the instance is not live is neither sent nor queued. A reader-wide object (the prefs,
// the UI memory) is written whole: this instance's snapshot of it, merged with the newest value queued on that
// storage object when that value is one the snapshot cannot hold (queued after this instance read it, or still in
// flight then), so a root never drops a field another root wrote, and never writes back a value its host's store has
// since replaced. A UI field written after startup, with the UI key never read during it, stays local: the stored
// fields it cannot see are never overwritten. A host that shares one store between several enhance() calls passes
// the same storage object to each; two objects are two queues.
import type { Journal } from './journal.js';
import { isPrefValue, PREF_VALUES, prefNames, type FeatureOptions } from './options.js';
import type { Prefs } from './types.js';

// Open before v1: the `docreader:` prefix is fixed; the public release gives it a namespace option or states why not.
export const PREFS_KEY = 'docreader:prefs';

/** The storage key of the reader-wide UI memory (LD8). */
export const UI_KEY = 'docreader:ui';

/** The storage key of a per-document value: docreader:doc:<storageKey>:<name>. */
export function docKey(storageKey: string, name: string): string {
  return `docreader:doc:${storageKey}:${name}`;
}

/** The storage key of a reading position: docreader:pos:<posKey> (LD8). */
export function posKeyOf(posKey: string): string {
  return `docreader:pos:${posKey}`;
}

/** The defaults: the first value each pref accepts. */
export function defaultPrefs(): Prefs {
  return { theme: PREF_VALUES.theme[0], width: PREF_VALUES.width[0], font: PREF_VALUES.font[0], lens: PREF_VALUES.lens[0] };
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
  /**
   * The reading position stored under `posKey` (the options' posKey): the local one if written since startup, else
   * the stored one parsed (read during startup only), else undefined.
   */
  readPos(posKey: string): unknown;
  /** Change the position under `posKey` locally (null clears it), then write it behind. */
  writePos(posKey: string, value: unknown): void;
  /**
   * One field of the reader-wide UI memory, an own field of the stored object (never an inherited name): the local
   * one if written since startup, else the stored one (the key read during startup only), else undefined.
   */
  readUi(name: string): unknown;
  /**
   * Change one UI field (null deletes it), then write the whole object behind, merged as the prefs are. A write after
   * startup, with the UI key never read during it, is kept locally and not written.
   */
  writeUi(name: string, value: unknown): void;
  /** Close the snapshot: after startup no key is read from it again. */
  seal(): void;
}

/** The instance a write belongs to: its host set(), its live check and its operation. */
interface Writer {
  readonly set: (key: string, value: string | null) => unknown;
  readonly live: () => boolean;
  readonly operate: (fn: () => void) => void;
}

/** One key of one storage object: whether a call is in flight, the newest value waiting, the newest value queued. */
interface Slot {
  busy: boolean;
  waiting: { readonly value: string | null; readonly writer: Writer; readonly seq: number } | null;
  /** The newest value queued for this key, by any instance; undefined until there is one. */
  latest: string | null | undefined;
  /** How many values have been queued for this key: `latest` is number `queued`. */
  queued: number;
  /** The number of the newest value whose call has completed (landed, failed, or was refused). */
  landed: number;
}

/** The slots of each storage object, shared by every instance given that object. Created on first use. */
let stores: WeakMap<object, Map<string, Slot>> | undefined;

function slotOf(storage: object, key: string): Slot {
  stores ??= new WeakMap();
  let slots = stores.get(storage);
  if (slots === undefined) stores.set(storage, (slots = new Map()));
  let slot = slots.get(key);
  if (slot === undefined) slots.set(key, (slot = { busy: false, waiting: null, latest: undefined, queued: 0, landed: 0 }));
  return slot;
}

/** Call the writer's set() for value number `seq`. The slot is claimed first, so a write queued from inside set() waits. */
function issue(key: string, slot: Slot, value: string | null, writer: Writer, seq: number): void {
  if (!writer.live()) return;
  slot.busy = true;
  let result: unknown;
  try {
    result = writer.set(key, value);
  } catch {
    result = undefined; // swallowed: local state stays as it is
  }
  if (!isThenable(result)) {
    release(key, slot, seq);
    return;
  }
  const done = (): void => {
    release(key, slot, seq);
  };
  Promise.resolve(result).then(done, done);
}

/** Call `seq` is over: send the newest waiting value, inside the operation of the instance that queued it. */
function release(key: string, slot: Slot, seq: number): void {
  slot.busy = false;
  slot.landed = Math.max(slot.landed, seq);
  const next = slot.waiting;
  slot.waiting = null;
  if (next !== null) {
    next.writer.operate(() => {
      issue(key, slot, next.value, next.writer, next.seq);
    });
  }
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

/** The options the state reads: the storage, the per-document key and the explicit prefs (options.prefs). */
export type StateOptions = Pick<FeatureOptions, 'storage' | 'storageKey' | 'prefs'>;

export interface StateArgs {
  /** The normalized options; options.prefs override stored values, and are not themselves written back. */
  readonly options: StateOptions;
  /** Run a queued write as an operation of the instance (refused once it is not live). */
  readonly operate: (fn: () => void) => void;
  /** Whether the instance is still live. */
  readonly live: () => boolean;
}

/** Create the state. Reads the snapshot object and the prefs key: host code may run (and may destroy). */
export function createReaderState(args: StateArgs): ReaderState {
  const { operate, live } = args;
  const { storage, storageKey, prefs: explicit } = args.options;
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
  let sealed = false;
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

  const writer: Writer | null = set === null ? null : { set, live, operate };
  const writeBehind = (key: string, value: string | null): void => {
    if (storage === null || writer === null) return;
    // Asked for once the instance is not live (a teardown cleanup, say): never written, and never queued either, so
    // no later instance on this storage takes it for the newest value and writes it for this one.
    if (!writer.live()) return;
    const slot = slotOf(storage, key);
    slot.queued += 1;
    slot.latest = value;
    if (slot.busy) slot.waiting = { value, writer, seq: slot.queued };
    else issue(key, slot, value, writer, slot.queued);
  };
  /**
   * A reader-wide JSON object under `key`, written whole. `seen` is what this instance's snapshot can hold: every value
   * of the key whose call had completed when the snapshot was taken (at the state's creation).
   */
  const shared = (key: string) => {
    const slot = storage === null || writer === null ? null : slotOf(storage, key);
    const seen = slot?.landed ?? 0;
    /** The stored object as this instance holds it: its snapshot's, then its own changes; null until read. */
    let held: Record<string, unknown> | null = null;
    return {
      /** Read the stored object from the snapshot, once (an absent or invalid value reads as empty). */
      load(): Record<string, unknown> {
        if (held === null) {
          const r = parseJson(readRaw(key));
          held = isPlainRecord(r) ? { ...r } : {};
        }
        return held;
      },
      get loaded(): boolean {
        return held !== null;
      },
      /**
       * Merge `change` into the stored object (a field set to undefined is deleted) and write it behind when it
       * changed: this instance's object, with the newest value queued on this storage object over it when the
       * snapshot cannot hold that value.
       */
      update(change: Readonly<Record<string, unknown>>): void {
        let base = this.load();
        if (slot !== null && slot.queued > seen && typeof slot.latest === 'string') {
          const r = parseJson(slot.latest);
          if (isPlainRecord(r)) base = { ...base, ...r };
        }
        const before = JSON.stringify(base);
        let next: Record<string, unknown> = { ...base };
        for (const [k, v] of Object.entries(change)) {
          if (v === undefined) delete next[k];
          else next = { ...next, [k]: v };
        }
        held = next;
        const after = JSON.stringify(next);
        if (after !== before) writeBehind(key, after);
      },
    };
  };

  // Prefs: the stored object (unknown fields are kept when it is written back), its valid fields, then explicit.
  const storedPrefs = shared(PREFS_KEY);
  const persisted = storedPrefs.load();
  let prefs: Prefs = defaultPrefs();
  for (const name of prefNames()) {
    const v = persisted[name];
    if (isPrefValue(name, v)) prefs = { ...prefs, [name]: v };
  }
  prefs = { ...prefs, ...explicit };

  const ui = shared(UI_KEY);
  /** UI fields written after startup with the UI key never read: kept here, never written. */
  const uiLocal = new Map<string, unknown>();
  const posLocal = new Map<string, unknown>();

  const docLocal = new Map<string, unknown>();

  return {
    get prefs() {
      return prefs;
    },

    setPrefs(change) {
      const next: Prefs = { ...prefs, ...change };
      const changed = prefNames().some((name) => next[name] !== prefs[name]);
      prefs = next;
      storedPrefs.update(change);
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

    readPos(posKey) {
      if (posLocal.has(posKey)) return posLocal.get(posKey);
      return parseJson(readRaw(posKeyOf(posKey)));
    },

    writePos(posKey, value) {
      posLocal.set(posKey, value);
      writeBehind(posKeyOf(posKey), value === null ? null : JSON.stringify(value));
    },

    readUi(name) {
      if (uiLocal.has(name)) return uiLocal.get(name);
      if (!ui.loaded && sealed) return undefined;
      const held = ui.load();
      return Object.hasOwn(held, name) ? held[name] : undefined;
    },

    writeUi(name, value) {
      if (!ui.loaded && sealed) {
        uiLocal.set(name, value === null ? undefined : value);
        return;
      }
      ui.update({ [name]: value === null ? undefined : value });
    },

    seal() {
      snapshot = null;
      sealed = true;
    },
  };
}

/**
 * Put the prefs on the root: data-theme (absent for 'auto', so the stylesheet's system rule applies), data-width,
 * data-font. The lens is stored and restored with them; the feature that shows it puts its class on the root.
 */
export function applyPrefs(journal: Journal, root: Element, prefs: Readonly<Prefs>): void {
  journal.setAttribute(root, 'data-theme', prefs.theme === 'auto' ? null : prefs.theme);
  journal.setAttribute(root, 'data-width', prefs.width);
  journal.setAttribute(root, 'data-font', prefs.font);
}
