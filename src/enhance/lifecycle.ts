// The lifecycle of an enhancement: ownership, startup, operations, destroy and teardown.
//
// Registry: one WeakMap from a document to the instances whose roots live in it, created on first use. An
// instance is live while it is initializing or active; destroying and destroyed instances are not.
//
// enhance(root, options):
//   1. A live instance on `root` itself: the same options object (or both omitted) returns that instance's
//      original promise; anything else rejects 'ownership'.
//   2. A live instance whose root contains `root`, or lies inside it: rejects 'ownership'.
//   3. The options are normalized (pure); a refusal rejects 'invalid-options' and reserves nothing. An options
//      signal that is already aborted rejects 'aborted', reserving nothing.
//   4. The instance is reserved (added to the registry) before any DOM write, host callback or await.
//   5. Startup runs as one operation: read state, apply prefs, the editorial core, folds; then the instance is
//      active. If an instance on an overlapping root is still being torn down (a destroy requested inside one of
//      its operations), startup first waits for that teardown.
//   6. A throw rolls back (teardown) and then rejects 'initialization', or with the EnhanceError thrown. A destroy
//      or abort during startup rolls back and then rejects 'aborted'. A rejection always follows the rollback.
//   enhance itself is not async: it returns the promise it stored on the instance, so step 1 can return it again.
//
// Operations: startup, every handler (journal.listen), setEnhancementPrefs and every storage completion run
// through operate(). operate refuses once the instance is not live and counts its depth; a destroy requested
// while the depth is above zero defers the teardown until the outermost operation unwinds.
//
// destroyEnhancement(root): marks the instance destroying and bumps its generation first, so no further write
// happens (the journal refuses writes, and features check live() after every call-out), then tears down now, or
// when the outermost operation unwinds. The promise settles after the teardown; every call for that root returns
// the same promise until the root is enhanced again. A root never enhanced resolves at once.
import { buildEditorial } from './editorial.js';
import { buildFolds } from './folds.js';
import { createJournal, type JournalControl } from './journal.js';
import { normalizeOptions, normalizePrefs, type NormalizedInfo, type NormalizedOptions } from './options.js';
import { applyPrefs, createReaderState, type ReaderState } from './state.js';
import { EnhanceError, type EnhanceOptions, type FeatureContext, type Prefs, type ResolvedInfo } from './types.js';

type Phase = 'initializing' | 'active' | 'destroying' | 'destroyed';

interface Instance {
  readonly root: HTMLElement;
  readonly doc: Document;
  /** The options object enhance() was given (undefined when omitted): what step 1 compares. */
  readonly identity: EnhanceOptions | undefined;
  /** enhance()'s promise for this instance. */
  readonly promise: Promise<void>;
  readonly control: JournalControl;
  phase: Phase;
  /** Bumped once, when a destroy is requested; a context captured before then is no longer live. */
  generation: number;
  /** How many operations of this instance are on the stack. */
  depth: number;
  /** A destroy was requested inside an operation: the outermost one tears down as it unwinds. */
  teardownPending: boolean;
  state: ReaderState | null;
  /** destroyEnhancement's promise, once a destroy was requested. */
  destroyed: Promise<void> | null;
  settle: ((faults: unknown[]) => void) | null;
}

let registry: WeakMap<Document, Set<Instance>> | undefined;
/** The last destroy promise of each root, so repeated calls return the same promise. */
let lastDestroy: WeakMap<Element, Promise<void>> | undefined;

function isElement(v: unknown): v is HTMLElement {
  return typeof v === 'object' && v !== null && (v as { nodeType?: unknown }).nodeType === 1 && (v as Node).ownerDocument !== null;
}

function isLive(inst: Instance): boolean {
  return inst.phase === 'initializing' || inst.phase === 'active';
}

function overlaps(a: Element, b: Element): boolean {
  return a.contains(b) || b.contains(a);
}

function instancesOf(doc: Document): Set<Instance> {
  registry ??= new WeakMap();
  let set = registry.get(doc);
  if (set === undefined) registry.set(doc, (set = new Set()));
  return set;
}

/** The instance on exactly this root: the live one if any, else one still tearing down. */
function findByRoot(root: Element): Instance | undefined {
  const all = registry?.get(root.ownerDocument);
  if (all === undefined) return undefined;
  let tearing: Instance | undefined;
  for (const inst of all) {
    if (inst.root !== root) continue;
    if (isLive(inst)) return inst;
    tearing = inst;
  }
  return tearing;
}

function operate<T>(inst: Instance, fn: () => T): T | undefined {
  if (!isLive(inst)) return undefined;
  inst.depth += 1;
  try {
    return fn();
  } finally {
    inst.depth -= 1;
    if (inst.depth === 0 && inst.teardownPending) {
      inst.teardownPending = false;
      teardown(inst);
    }
  }
}

function teardown(inst: Instance): void {
  const faults = inst.control.undoAll();
  // Known open point: the reservation is released even when a cleanup step failed, so the root can be enhanced
  // again over whatever that step left behind. The destroy promise's AggregateError is the only report of it.
  const all = registry?.get(inst.doc);
  if (all !== undefined) {
    all.delete(inst);
    if (all.size === 0) registry?.delete(inst.doc);
  }
  inst.phase = 'destroyed';
  inst.settle?.(faults);
}

function destroyInstance(inst: Instance): Promise<void> {
  if (inst.destroyed !== null) return inst.destroyed;
  // First: no write may follow the request.
  inst.phase = 'destroying';
  inst.generation += 1;
  const destroyed = new Promise<void>((resolve, reject) => {
    inst.settle = (faults) => {
      if (faults.length === 0) resolve();
      else reject(new AggregateError(faults, 'docreader: cleanup failed'));
    };
  });
  // Marked handled here, so a cleanup fault nobody asked about is no unhandled rejection; callers still see it.
  destroyed.catch(() => undefined);
  inst.destroyed = destroyed;
  (lastDestroy ??= new WeakMap()).set(inst.root, destroyed);
  if (inst.depth > 0) inst.teardownPending = true;
  else teardown(inst);
  return destroyed;
}

/** The document check, measured before any feature moves a node (see ResolvedInfo.isDocument). */
function isDocument(root: Element): boolean {
  let h1 = 0;
  let h2 = 0;
  let h3 = 0;
  for (const c of Array.from(root.children)) {
    if (c.localName === 'h1') h1 += 1;
    else if (c.localName === 'h2') h2 += 1;
    else if (c.localName === 'h3') h3 += 1;
  }
  return h1 > 0 && (h2 > 2 || (h2 > 0 && h3 >= 4));
}

function resolveInfo(root: Element, info: NormalizedInfo | null): ResolvedInfo {
  let title = info?.title;
  if (title === undefined) {
    const h1 = root.querySelector('h1');
    const text = h1 === null ? '' : (h1.textContent ?? '').replace(/\s+/g, ' ').trim();
    title = text === '' ? null : text;
  }
  return { title, frontList: info?.frontList ?? null, isDocument: isDocument(root) };
}

/** The startup build, run inside the startup operation. */
function build(inst: Instance, opts: NormalizedOptions): void {
  const { root } = inst;
  const generation = inst.generation;
  const live = (): boolean => inst.generation === generation && isLive(inst);
  const state = createReaderState({
    storage: opts.storage,
    storageKey: opts.storageKey,
    explicit: opts.prefs,
    operate: (fn) => {
      operate(inst, fn);
    },
    live,
  });
  inst.state = state;
  if (!live()) return; // the snapshot is host code
  const ctx: FeatureContext = {
    root,
    journal: inst.control.journal,
    state,
    info: resolveInfo(root, opts.info),
    options: opts,
    live,
    operate: (fn) => operate(inst, fn),
  };
  applyPrefs(ctx.journal, root, state.prefs);
  buildEditorial(ctx);
  if (!live()) return;
  if (opts.folds) buildFolds(ctx);
}

/** Wait for a destroy promise without rejecting: the cleanup error, or undefined when it was clean. */
async function settled(p: Promise<void>): Promise<unknown> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e;
  }
}

async function startup(inst: Instance, opts: NormalizedOptions, blockers: readonly Promise<void>[]): Promise<void> {
  const { signal } = opts;
  const onAbort = (): void => {
    void destroyInstance(inst);
  };
  try {
    signal?.addEventListener('abort', onAbort);
    if (blockers.length > 0) await Promise.allSettled(blockers);
    const outcome: { threw: boolean; error: unknown } = { threw: false, error: undefined };
    operate(inst, () => {
      try {
        build(inst, opts);
      } catch (e) {
        outcome.threw = true;
        outcome.error = e;
      }
    });
    if (!isLive(inst)) {
      const cleanup = await settled(destroyInstance(inst));
      const cause = cleanup ?? (signal?.aborted === true ? (signal.reason as unknown) : undefined);
      throw new EnhanceError('aborted', 'docreader: destroyed during startup', { cause });
    }
    if (outcome.threw) {
      await settled(destroyInstance(inst));
      if (outcome.error instanceof EnhanceError) throw outcome.error;
      throw new EnhanceError('initialization', 'docreader: startup failed', { cause: outcome.error });
    }
    inst.phase = 'active';
    inst.state?.seal();
  } catch (e) {
    // Whatever went wrong (a host signal that throws, say), the reservation never outlives a rejection: roll back
    // first. After the two refusals above this finds the teardown done and returns at once.
    await settled(destroyInstance(inst));
    throw e instanceof EnhanceError ? e : new EnhanceError('initialization', 'docreader: startup failed', { cause: e });
  } finally {
    try {
      signal?.removeEventListener('abort', onAbort);
    } catch {
      // a host signal that throws here has nothing left to stop
    }
  }
}

/**
 * Enhance `root` (the container of a rendered document) into the reading layout. Resolves once the layout is
 * built; see the header of this file for every refusal.
 */
export function enhance(root: HTMLElement, options?: EnhanceOptions): Promise<void> {
  if (!isElement(root)) return Promise.reject(new EnhanceError('invalid-options', 'docreader: root must be an element'));
  const all = registry?.get(root.ownerDocument);
  if (all !== undefined) {
    for (const other of all) {
      if (other.root !== root || !isLive(other)) continue;
      if (other.identity === options) return other.promise;
      return Promise.reject(new EnhanceError('ownership', 'docreader: this root is already enhanced, with other options'));
    }
    for (const other of all) {
      if (isLive(other) && overlaps(other.root, root)) {
        return Promise.reject(new EnhanceError('ownership', 'docreader: an enhanced root contains this one, or lies inside it'));
      }
    }
  }
  let opts: NormalizedOptions;
  try {
    opts = normalizeOptions(options);
  } catch (e) {
    return Promise.reject(e);
  }
  if (opts.signal?.aborted === true) {
    return Promise.reject(new EnhanceError('aborted', 'docreader: the signal was already aborted', { cause: opts.signal.reason as unknown }));
  }

  // Reserve, before any write, host callback or await.
  let resolve: () => void = () => undefined;
  let reject: (e: unknown) => void = () => undefined;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const inst: Instance = {
    root,
    doc: root.ownerDocument,
    identity: options,
    promise,
    control: createJournal(
      () => isLive(inst),
      (fn) => {
        operate(inst, fn);
      },
    ),
    phase: 'initializing',
    generation: 0,
    depth: 0,
    teardownPending: false,
    state: null,
    destroyed: null,
    settle: null,
  };
  const set = instancesOf(inst.doc);
  const blockers: Promise<void>[] = [];
  for (const other of set) {
    if (other.phase === 'destroying' && other.destroyed !== null && overlaps(other.root, root)) blockers.push(other.destroyed);
  }
  set.add(inst);
  lastDestroy?.delete(root);
  startup(inst, opts, blockers).then(resolve, reject);
  return promise;
}

/** Undo everything enhance() did to `root`. Settles once the teardown has run; see the header of this file. */
export function destroyEnhancement(root: HTMLElement): Promise<void> {
  if (!isElement(root)) return Promise.resolve();
  const inst = findByRoot(root);
  if (inst !== undefined) return destroyInstance(inst);
  return lastDestroy?.get(root) ?? Promise.resolve();
}

/**
 * Change the reader's prefs on an enhanced root: applied at once, then written behind to storage. Throws
 * EnhanceError('invalid-options') for a bad value; does nothing for a root that is not enhanced (or no longer).
 */
export function setEnhancementPrefs(root: HTMLElement, prefs: Partial<Prefs>): void {
  const change = normalizePrefs(prefs);
  if (!isElement(root)) return;
  const inst = findByRoot(root);
  if (inst === undefined) return;
  operate(inst, () => {
    const state = inst.state;
    if (state === null) return; // called back from inside the state's own startup read: nothing to change yet
    const generation = inst.generation;
    state.setPrefs(change); // may call the host's set()
    if (inst.generation !== generation || !isLive(inst)) return;
    applyPrefs(inst.control.journal, root, state.prefs);
  });
}
