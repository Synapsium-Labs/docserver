// The lifecycle of an enhancement: ownership, startup, operations, destroy and teardown.
//
// Registry: one WeakMap from a document to the instances whose roots live in it, created on first use, and one from
// a root to its instances that are not yet torn down, so a root is found by itself even after it moved to another
// document. An instance is live while it is initializing or active; destroying and destroyed instances are not.
//
// enhance(root, options):
//   1. A live instance on `root` itself: the same options object (or both omitted) returns that instance's
//      original promise; anything else rejects 'ownership'.
//   2. A live instance whose root contains `root`, or lies inside it: rejects 'ownership'. (A root moved to another
//      document while enhanced is still seen around a new root, through its ancestors, but not inside one: keep an
//      enhanced root in its document, or destroy it before moving it.)
//   3. The options are normalized (own data properties only, so no host getter runs; a Proxy's traps still can);
//      a refusal rejects 'invalid-options' and reserves nothing. An options signal that is already aborted rejects
//      'aborted', reserving nothing. Steps 1 and 2 then run again, because reading the options may have run host
//      code that enhanced this root, or one around or inside it.
//   4. The instance is reserved (added to the registry) before any DOM write, host callback or await.
//   5. Startup runs as one operation: measure the sections (section 0, before any node moves), read state, apply
//      prefs, then build every feature through features.ts, in order, stopping once the instance is not live; then
//      the instance is active, and the second phase starts: each feature's `after`, inside an operation, in order
//      (LD5; enhance() does not wait for it, and its failures are the feature's to show). If an instance on an
//      overlapping root is still being torn down (a destroy requested inside one of its operations), startup first
//      waits for that teardown.
//   6. A throw rolls back (teardown) and then rejects 'initialization', or with the EnhanceError thrown. A destroy
//      or abort during startup rolls back and then rejects 'aborted'. A rejection always follows the rollback.
//   enhance itself is not async: it returns the promise it stored on the instance, so step 1 can return it again.
//
// Operations: startup, every handler (journal.listen), setEnhancementPrefs, every storage completion and every
// call to a host callback (host.ts) run through operate(). operate refuses once the instance is not live and counts
// its depth; a destroy requested while the depth is above zero defers the teardown until the outermost operation
// unwinds.
//
// The host's callbacks: normalizeOptions keeps the functions apart (`callbacks`), and build() hands them to
// createHost alone, so a feature's context carries the options without them and reaches the host only through
// `ctx.host`.
//
// The shared services (Task 7b; LD1), made before the first feature builds, in this order: the registries (index,
// terms, blocks, figures, plan, page; registry.ts) and events; reveal (reveal.ts); overlays (overlays.ts); the
// keyboard layer (keys.ts, which joins its document's one keydown listener); the bar's skeleton (bar.ts, only with
// chrome.bar), whose tray features fill during their build, put in the root once every feature is built; navigation
// and the position seam (nav.ts: it reads the document's ids and lines now, before any chrome exists, listens for
// clicks on the root, and measures the bar for the reader's place); relayout (relayout.ts: the resize listener and the
// fonts wait start here); heading controls (headctl.ts); and the folds' API (folds.ts). Then, once every feature is
// built, the first relayout ('start') is asked for. Prefs changes, from setEnhancementPrefs or a feature's ctx.setPrefs, go through one path: the state,
// the root's attributes, the 'prefs' event, and a relayout ('prefs' for the width or face, 'lens' for the lens).
//
// The seams every feature builds with (Task 7a): `env` (the root's window, env.ts), `sections`, `vocab` (vocab.ts),
// `chromeId` and `text` (text.ts). Chrome ids are per instance: `docreader.<n>.<name>`, where n counts the instances
// of the document, so two instances never issue the same id. The dots keep them out of render()'s id alphabet
// (letters, digits, `_` and `-`, for anchors and heading slugs alike), so no root rendered into the document later
// can carry one; an id the document held at the instance's first call, or one the instance issued, is skipped by a
// `.<k>` suffix. An instance's ids are released at its teardown, and it issues none once it is not live.
//
// goToHash(root, id, from?): the host's history moved to an entry of this document (LD7). For an active instance on
// `root`, one operation runs nav.goToHash: back to the place `from` names when it is a token this library gave (onHash's
// `from`), else to the element `id` names, else, for a null or empty id, to the top. An id that is neither a string
// nor null, and a call for a root not enhanced or still starting, do nothing; a `from` that is not a string is no
// token.
//
// destroyEnhancement(root): marks the instance destroying and bumps its generation first, so no further write
// happens (the journal refuses writes, and features check live() after every call-out), then tears down now, or
// when the outermost operation unwinds. The promise settles after the teardown; every call for that root returns
// the same promise until the root is enhanced again. A root never enhanced resolves at once.
import { createBar } from './bar.js';
import { createEnv } from './env.js';
import { features, type Feature } from './features.js';
import { createFolds } from './folds.js';
import { createHeadCtl } from './headctl.js';
import { createHost } from './host.js';
import { createJournal, type Journal, type JournalControl } from './journal.js';
import { createKeys } from './keys.js';
import { createNavigation } from './nav.js';
import { normalizeOptions, normalizePrefs, type NormalizedInfo, type NormalizedOptions } from './options.js';
import { createOverlays } from './overlays.js';
import { sectionMinutes } from './reading.js';
import { collectBlocks, createEvents, createFigures, createIndex, createPage, createPlan, createTerms } from './registry.js';
import { createRelayout } from './relayout.js';
import { createReveal } from './reveal.js';
import { applyPrefs, createReaderState, type ReaderState } from './state.js';
import { hash, textTools } from './text.js';
import { EnhanceError, type EnhanceOptions, type FeatureContext, type Prefs, type ResolvedInfo, type SectionUnit } from './types.js';
import { createVocab } from './vocab.js';

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
  /** setEnhancementPrefs changes made before startup created the state; applied as soon as it exists. */
  pendingPrefs: Partial<Prefs> | null;
  /** The context features were built with, once startup made it. */
  ctx: FeatureContext | null;
  /** The features startup builds, in order: the second phase starts their `after`s once startup succeeded. */
  built: readonly Feature[];
  /** destroyEnhancement's promise, once a destroy was requested. */
  destroyed: Promise<void> | null;
  settle: ((faults: unknown[]) => void) | null;
}

let registry: WeakMap<Document, Set<Instance>> | undefined;
/** The instances on each root that are not yet torn down (live, or still destroying), wherever the root is now. */
let byRoot: WeakMap<Element, Set<Instance>> | undefined;
/** The last destroy promise of each root, so repeated calls return the same promise. */
let lastDestroy: WeakMap<Element, Promise<void>> | undefined;
/** Per document: how many instances asked for chrome ids, and every chrome id its live instances issued. */
let chromeIds: WeakMap<Document, { next: number; readonly issued: Set<string> }> | undefined;

/** A chrome id's name: 1 to 32 lower-case letters, digits and dashes, starting with a letter. */
const CHROME_ID_NAME = /^[a-z][a-z0-9-]{0,31}$/;

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
function findByRoot(root: Node): Instance | undefined {
  const on = byRoot?.get(root as Element);
  if (on === undefined) return undefined;
  let tearing: Instance | undefined;
  for (const inst of on) {
    if (isLive(inst)) return inst;
    tearing = inst;
  }
  return tearing;
}

/** For tests: how many instances the registry holds for a document (teardown releases each one). */
export function registrySize(doc: Document): number {
  return registry?.get(doc)?.size ?? 0;
}

/** For tests: the context of the instance on `root` (live, or still tearing down), once startup made it. */
export function contextOf(root: Element): FeatureContext | undefined {
  return findByRoot(root)?.ctx ?? undefined;
}

/** For tests: how many chrome ids are issued, and not yet released, in a document. */
export function chromeIdsIssued(doc: Document): number {
  return chromeIds?.get(doc)?.issued.size ?? 0;
}

/**
 * Steps 1 and 2 of enhance(): the promise to answer with when `root` is taken (the same promise, or a refusal),
 * or null when it is free.
 */
function claimed(root: HTMLElement, options: EnhanceOptions | undefined): Promise<void> | null {
  const same = findByRoot(root);
  if (same !== undefined && isLive(same)) {
    if (same.identity === options) return same.promise;
    return Promise.reject(new EnhanceError('ownership', 'docreader: this root is already enhanced, with other options'));
  }
  const refuse = (): Promise<void> =>
    Promise.reject(new EnhanceError('ownership', 'docreader: an enhanced root contains this one, or lies inside it'));
  for (let n: Node | null = root.parentNode; n !== null; n = n.parentNode) {
    const up = findByRoot(n);
    if (up !== undefined && isLive(up)) return refuse();
  }
  for (const other of registry?.get(root.ownerDocument) ?? []) {
    if (isLive(other) && overlaps(other.root, root)) return refuse();
  }
  return null;
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
  const on = byRoot?.get(inst.root);
  if (on !== undefined) {
    on.delete(inst);
    if (on.size === 0) byRoot?.delete(inst.root);
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

/**
 * The document's level-2 sections (the reference layout's section 0), measured before any feature moves a node: for
 * each h2 with an id among the root's children, the children after it up to the next h1 or h2, their reading time
 * and the fingerprint of their source text. An h2 without an id ends the section before it and starts none.
 */
function measureSections(root: Element): readonly SectionUnit[] {
  const out: SectionUnit[] = [];
  let heading: HTMLElement | null = null;
  let members: Element[] = [];
  const flush = (): void => {
    if (heading === null) return;
    let text = heading.textContent ?? '';
    for (const m of members) if (m.localName !== 'script' && m.localName !== 'dl') text += `\u0001${m.textContent ?? ''}`;
    out.push(Object.freeze({ heading, members: Object.freeze(members), minutes: sectionMinutes(heading, members), fingerprint: hash(text) }));
  };
  for (const c of Array.from(root.children)) {
    if (c.localName === 'h1' || c.localName === 'h2') {
      flush();
      heading = c.localName === 'h2' && c.id !== '' ? (c as HTMLElement) : null;
      members = [];
    } else members.push(c);
  }
  flush();
  return Object.freeze(out);
}

/** The chrome ids of one instance: a new id per call, unique in the document; all released when the instance is torn down. */
function chromeIdsOf(inst: Instance, journal: Journal, live: () => boolean): (name: string) => string {
  chromeIds ??= new WeakMap();
  let reg = chromeIds.get(inst.doc);
  if (reg === undefined) chromeIds.set(inst.doc, (reg = { next: 1, issued: new Set() }));
  const { issued } = reg;
  const no = reg.next;
  reg.next += 1;
  const mine: string[] = [];
  journal.defer(() => {
    for (const id of mine) issued.delete(id);
  });
  /** The document's ids, read at the first call (by attribute, never by a lookup). */
  let taken: Set<string> | null = null;
  return (name) => {
    if (typeof name !== 'string' || !CHROME_ID_NAME.test(name)) {
      throw new Error('docreader: chromeId takes a name of 1 to 32 lower-case letters, digits and dashes, starting with a letter');
    }
    // Its release has run, or will run before anything could insert the element: an id issued now would stay issued.
    if (!live()) throw new Error('docreader: chromeId after a destroy');
    if (taken === null) {
      taken = new Set();
      for (const el of Array.from(inst.root.ownerDocument.querySelectorAll('[id]'))) taken.add(el.id);
    }
    const base = `docreader.${String(no)}.${name}`;
    let id = base;
    for (let k = 2; taken.has(id) || issued.has(id); k += 1) id = `${base}.${String(k)}`;
    issued.add(id);
    mine.push(id);
    return id;
  };
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
  return {
    title,
    frontList: info?.frontList ?? null,
    isDocument: isDocument(root),
    sha: info?.sha ?? null,
    draft: info?.draft ?? false,
    commits: info?.commits ?? null,
    only: info?.only ?? null,
  };
}

/** The startup build, run inside the startup operation. */
function build(inst: Instance, opts: NormalizedOptions): void {
  const { root } = inst;
  const generation = inst.generation;
  const live = (): boolean => inst.generation === generation && isLive(inst);
  // Section 0: before any node moves, and before any host code can run.
  const sections = measureSections(root);
  const state = createReaderState({
    options: opts,
    operate: (fn) => {
      operate(inst, fn);
    },
    live,
  });
  inst.state = state;
  if (!live()) return; // the snapshot is host code
  // setEnhancementPrefs calls made before the state existed (while startup waited, or from the snapshot's code)
  const pending = inst.pendingPrefs;
  inst.pendingPrefs = null;
  if (pending !== null) {
    state.setPrefs(pending); // may call the host's set()
    if (!live()) return;
  }
  const operateHere = <T>(fn: () => T): T | undefined => operate(inst, fn);
  const journal = inst.control.journal;
  // The host's functions stay out of the context: features call them through `host` alone.
  const { callbacks, ...options } = opts;
  const vocab = createVocab(options);
  const info = resolveInfo(root, opts.info);
  const host = createHost(callbacks, live, operateHere);
  const env = createEnv(root, journal, live, operateHere);
  // The shared services (see the header), before the first feature builds.
  const events = createEvents(live);
  const index = createIndex(root);
  const revealer = createReveal({ root, journal, events, live });
  const overlays = createOverlays(live);
  const keys = createKeys({ root, journal, overlays, keyboard: options.keyboard, live, operate: operateHere });
  const bar = options.chrome.bar ? createBar({ root, journal, isDocument: info.isDocument }) : null;
  const { nav, position } = createNavigation({
    root,
    journal,
    host,
    env,
    index,
    reveal: revealer.reveal,
    live,
    operate: operateHere,
    bar: bar?.slots.bar ?? null,
  });
  const relayout = createRelayout({ env, events, position, live });
  const ctx: FeatureContext = {
    root,
    journal,
    state,
    info,
    options,
    host,
    live,
    operate: operateHere,
    env,
    sections,
    vocab,
    chromeId: chromeIdsOf(inst, journal, live),
    text: textTools(vocab),
    index,
    terms: createTerms(root),
    blocks: collectBlocks(root),
    figures: createFigures(root),
    plan: createPlan(),
    page: createPage(),
    events,
    reveal: revealer.reveal,
    onReveal: revealer.onReveal,
    overlays,
    keys,
    nav,
    position,
    relayout: relayout.relayout,
    onRelayout: relayout.onRelayout,
    headCtl: createHeadCtl({ root, journal }),
    slots: bar?.slots ?? null,
    folds: createFolds(),
    setPrefs: (change) => {
      const checked = normalizePrefs(change);
      operate(inst, () => {
        changePrefs(inst, checked);
      });
    },
  };
  inst.ctx = ctx;
  applyPrefs(journal, root, state.prefs);
  const list = features();
  inst.built = list;
  for (const f of list) {
    f.build(ctx);
    if (!live()) return;
  }
  // Once every feature is built: the bar's skeleton goes in, and the first measure is asked for.
  bar?.attach();
  ctx.relayout('start');
}

/**
 * Change the prefs of an instance whose state exists: the state (written behind; the host's set() may run, and may
 * destroy), then, still live, the root's attributes; then, when they changed and the context exists, the 'prefs' event
 * and a relayout for what moves the layout. Runs inside an operation of the instance.
 */
function changePrefs(inst: Instance, change: Partial<Prefs>): void {
  const state = inst.state;
  if (state === null) return;
  const was = state.prefs;
  const changed = state.setPrefs(change); // may call the host's set(), which may destroy the instance
  // Once it is not live, the journal refuses the attributes, the events emit nothing and no relayout runs.
  applyPrefs(inst.control.journal, inst.root, state.prefs);
  const ctx = inst.ctx;
  if (!changed || ctx === null) return;
  const now = state.prefs;
  ctx.events.emit('prefs', Object.freeze({ ...now }));
  if (now.width !== was.width || now.font !== was.font) ctx.relayout('prefs');
  if (now.lens !== was.lens) ctx.relayout('lens');
}

/**
 * The second phase (LD5): each feature's `after`, inside an operation, in order; enhance() does not wait. Called only
 * once startup has succeeded and the instance is active.
 */
function secondPhase(inst: Instance): void {
  const ctx = inst.ctx;
  if (ctx === null) return;
  for (const f of inst.built) {
    const after = f.after;
    if (after === undefined) continue;
    operate(inst, () => {
      try {
        // A rejection is the feature's to show (its own failed mark); here it only must not go unhandled.
        Promise.resolve(after(ctx)).catch(() => undefined);
      } catch {
        // a throw before its first await, likewise
      }
    });
  }
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
    secondPhase(inst);
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
  const taken = claimed(root, options);
  if (taken !== null) return taken;
  let opts: NormalizedOptions;
  try {
    opts = normalizeOptions(options);
  } catch (e) {
    return Promise.reject(e);
  }
  if (opts.signal?.aborted === true) {
    return Promise.reject(new EnhanceError('aborted', 'docreader: the signal was already aborted', { cause: opts.signal.reason as unknown }));
  }
  // Reading the options can run host code (a Proxy's traps, a signal's getters) that enhanced this root, or one
  // around or inside it, since the check above: check again, right before the reservation.
  const takenSince = claimed(root, options);
  if (takenSince !== null) return takenSince;

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
    pendingPrefs: null,
    ctx: null,
    built: [],
    destroyed: null,
    settle: null,
  };
  const set = instancesOf(inst.doc);
  const blockers: Promise<void>[] = [];
  for (const other of set) {
    if (other.phase === 'destroying' && other.destroyed !== null && overlaps(other.root, root)) blockers.push(other.destroyed);
  }
  const tearing = findByRoot(root); // the same root, moved here from another document while it tears down
  if (tearing !== undefined && tearing.destroyed !== null && !blockers.includes(tearing.destroyed)) blockers.push(tearing.destroyed);
  set.add(inst);
  byRoot ??= new WeakMap();
  let on = byRoot.get(root);
  if (on === undefined) byRoot.set(root, (on = new Set()));
  on.add(inst);
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
 * The host's history moved to an entry of the document on `root` (LD7): back to the place `from` names (a token the
 * host was given as onHash's `from`), else to `id` (a heading id or a defined ID, without '#'), else, for null, to the
 * top. Calls no onHash. Does nothing for a root that is not enhanced, or still starting; see the header of this file.
 */
export function goToHash(root: HTMLElement, id: string | null, from?: string | null): void {
  if (!isElement(root)) return;
  if (id !== null && typeof id !== 'string') return;
  const inst = findByRoot(root);
  const ctx = inst?.ctx ?? null;
  if (inst === undefined || inst.phase !== 'active' || ctx === null) return;
  const token = typeof from === 'string' ? from : null;
  operate(inst, () => {
    ctx.nav.goToHash(id, token);
  });
}

/**
 * Change the reader's prefs on an enhanced root: applied at once, then written behind to storage. Throws
 * EnhanceError('invalid-options') for a bad value; does nothing for a root that is not enhanced (or no longer). A
 * change made while enhance() is still starting is kept and applied as soon as the reader state exists.
 */
export function setEnhancementPrefs(root: HTMLElement, prefs: Partial<Prefs>): void {
  const change = normalizePrefs(prefs);
  if (!isElement(root)) return;
  const inst = findByRoot(root);
  if (inst === undefined) return;
  operate(inst, () => {
    const state = inst.state;
    if (state === null) {
      // Startup has not created the state yet (it waits for an earlier teardown, or the snapshot's own code called
      // back): the change is kept and applied as soon as the state exists.
      inst.pendingPrefs = { ...inst.pendingPrefs, ...change };
      return;
    }
    changePrefs(inst, change);
  });
}
