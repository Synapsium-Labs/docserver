// The wire between the sealed reader frame and its parent (docserver L3; plan Reference §1, §8 and §9). The single
// definition of the bridge's message shapes, its version, its closed error reasons, its limits, the op key sets per `t`
// (the one table the frame's parser and `./host`'s parser both read), the store key allow-list and the sha grammar. The
// pure srcdoc builder, the frame runtime and `./host` all import it; conformance/bridge-cases.json is the same wire as
// fixtures, for the first consumer's own parser. The fragment grammar lives in fragment.ts, DOC_FIELDS in the generated
// doc-fields.generated.ts, and the DOM-free copies of L2's plain-data option shapes in wire-types.ts. Pure: declarations,
// constants and predicates only.
//
// `./frame` (index.ts) re-exports only what Reference §1 and Task 1's Produces name. The other exports here (the store
// key and sha predicates, the prefs' values, the ops per direction) are the package's own: the frame runtime and `./host`
// import them from this file, and they are never semver surface (FD20).
//
// Scope until Tasks 5 and 9: the limits are constants only. Nothing enforces them yet (the frame-side outbox is Task 5's,
// the parent's limiter Task 9's); this note goes when they consume them.
import { DOC_FIELDS } from './doc-fields.generated.js';

export { DOC_FIELDS };

/** The bridge's protocol version, separate from the package's semver; additive changes only. */
export const BRIDGE_PROTOCOL = 1;

/** The seed's schema version. frameDocument and the bootstrap always ship together, so it never travels alone. */
export const SEED_SCHEMA = 1;

/** Why a frame failed, as `error{why}` carries it: a closed set. */
export const ERROR_WHY = ['boot', 'render', 'mermaid', 'assets', 'protocol'] as const;
export type ErrorWhy = (typeof ERROR_WHY)[number];

/**
 * The bridge's limits (design §3, ruling R5). The parent reads its limits as token buckets: 40 messages refilled at
 * 20 a second, and store.set 10 refilled at 10 a second; `./host` implements exactly that reading. The frame paces
 * itself by a sliding window instead, so it is never refused under EITHER reading of the parent's limits (a bucket, or a
 * strict 1-second window): at most 16 messages and at most 8 store.set in any 1000 ms, the post-ready flush included.
 * conformance/bridge-cases.json's timed sequences fix the bucket reading exactly.
 */
export const BRIDGE_LIMITS = Object.freeze({
  // The parent's limits, read as token buckets.
  bucketCapacity: 40,
  bucketRefillPerSecond: 20,
  storeSetBucketCapacity: 10,
  storeSetRefillPerSecond: 10,
  changesInFlight: 1,
  coalesceMs: 250,
  refusalsToClose: 16,
  valueMaxBytes: 65536,
  copyMaxBytes: 65536,
  hashMaxCodeUnits: 256,
  hrefMaxChars: 4096,
  storeBudgetBytes: 1048576,
  /** The parent's own deadline for answering a `changes`. */
  changesTimeoutMs: 30000,
  // The frame's pacing: a sliding window, never refused under a bucket or a strict-window reading of the above.
  frameWindowMs: 1000,
  frameMaxPerWindow: 16,
  frameStoreSetMaxPerWindow: 8,
  /** copy's own share of the 16, never delayed by the pacer. */
  frameCopyMaxPerWindow: 4,
  /** Longer than changesTimeoutMs: the frame releases its one `changes` slot after this. */
  frameChangesTimeoutMs: 35000,
} as const);

/**
 * The store's reader-wide keys (L2's `<ns>:prefs` and `<ns>:ui`, src/enhance/state.ts), as the bridge names them:
 * `pref:prefs` and `pref:ui`.
 */
export const PREF_KEYS = Object.freeze(['prefs', 'ui'] as const);
export type PrefKey = (typeof PREF_KEYS)[number];

/**
 * A key of the bridge's store (Reference §8.3, FD8): a closed allow-list, at compile time and at run time
 * (isBridgeStoreKey). `pref:<name>` for a PREF_KEYS member; `doc:<field>` for a DOC_FIELDS member (`doc:pos` is L2's
 * `<ns>:pos:<posKey>`, every other field L2's `<ns>:doc:<storageKey>:<field>`). Any other L2 key is dropped by the frame
 * and refused by the parent. (Reference §1 writes `doc:${string}`; the generated list is `as const`, so this is narrower.)
 */
export type BridgeStoreKey = `pref:${PrefKey}` | `doc:${(typeof DOC_FIELDS)[number]}`;

/** True for a key on the store allow-list: `pref:` and a PREF_KEYS member, or `doc:` and a DOC_FIELDS member. */
export function isBridgeStoreKey(k: unknown): k is BridgeStoreKey {
  if (typeof k !== 'string') return false;
  if (k.startsWith('pref:')) return (PREF_KEYS as readonly string[]).includes(k.slice(5));
  if (k.startsWith('doc:')) return (DOC_FIELDS as readonly string[]).includes(k.slice(4));
  return false;
}

/** A full commit sha as the bridge carries it: 40 or 64 lower-case hex digits (shorter ones never cross). */
export const FULL_SHA_SOURCE = '^(?:[0-9a-f]{40}|[0-9a-f]{64})$';
const FULL_SHA = new RegExp(FULL_SHA_SOURCE);

/** True for a full sha: 40 or 64 lower-case hex digits. */
export function isFullSha(s: unknown): s is string {
  return typeof s === 'string' && FULL_SHA.test(s);
}

/** The values each pref of the `prefs` op takes: theme, width and font (the lens stays frame-local, Q1). */
export const FRAME_PREF_VALUES = Object.freeze({
  theme: Object.freeze(['auto', 'light', 'dark'] as const),
  width: Object.freeze(['standard', 'wide'] as const),
  font: Object.freeze(['serif', 'sans'] as const),
});

/** The reader prefs the bridge carries, each optional. */
export type FramePrefValues = { -readonly [K in keyof typeof FRAME_PREF_VALUES]?: (typeof FRAME_PREF_VALUES)[K][number] };

/** What the parent sends: hello on the window (once, exactly one port), everything else on the port. */
export type ParentToFrame =
  | { t: 'hello'; v: number }
  | ({ t: 'prefs' } & FramePrefValues)
  | { t: 'changes.result'; sha: string; ranges: readonly (readonly [number, number])[]; removedAfter?: readonly number[] }
  | { t: 'changes.result'; sha: string; unavailable: true };

/** What the frame sends, on the port only. Flat; every value a string except v. */
export type FrameToParent =
  | { t: 'ready'; v: 1; nonce: string }
  | { t: 'error'; why: ErrorWhy }
  /** JSON text; the literal 'null' deletes. */
  | { t: 'store.set'; key: BridgeStoreKey; value: string }
  | { t: 'navigate'; href: string }
  | { t: 'copy'; text: string }
  | { t: 'changes'; sha: string }
  /** isFragmentId(id); never ''. */
  | { t: 'hash'; id: string }
  /** No keys: back to the latest. */
  | { t: 'version'; sha?: string; only?: string };

/**
 * Every key each op may carry, `t` included, by its `t`: the one table both parsers read. A key outside its op's set
 * is a refusal; which keys are required, and each value's grammar, are Reference §6.3, §6.5 and §11.3 (and the
 * fixtures of conformance/bridge-cases.json).
 */
export const OP_KEYS = Object.freeze({
  hello: Object.freeze(['t', 'v'] as const),
  prefs: Object.freeze(['t', 'theme', 'width', 'font'] as const),
  'changes.result': Object.freeze(['t', 'sha', 'ranges', 'removedAfter', 'unavailable'] as const),
  ready: Object.freeze(['t', 'v', 'nonce'] as const),
  error: Object.freeze(['t', 'why'] as const),
  'store.set': Object.freeze(['t', 'key', 'value'] as const),
  navigate: Object.freeze(['t', 'href'] as const),
  copy: Object.freeze(['t', 'text'] as const),
  changes: Object.freeze(['t', 'sha'] as const),
  hash: Object.freeze(['t', 'id'] as const),
  version: Object.freeze(['t', 'sha', 'only'] as const),
} satisfies Record<FrameToParent['t'] | ParentToFrame['t'], readonly string[]>);

/** The ops the frame sends (`./host` reads only these). */
export const FRAME_OPS = Object.freeze(['ready', 'error', 'store.set', 'navigate', 'copy', 'changes', 'hash', 'version'] as const satisfies readonly FrameToParent['t'][]);

/** The ops the parent sends (the frame reads only these: hello on the window, the others on the port). */
export const PARENT_OPS = Object.freeze(['hello', 'prefs', 'changes.result'] as const satisfies readonly ParentToFrame['t'][]);
