// The wire between the sealed reader frame and its parent (docserver L3; design §3, §6 and §8). The single definition
// of the bridge's message shapes, its version and its closed error reasons; the frame runtime and the pure srcdoc
// builder both import it. Pure: declarations and constants only.
//
// Prototype scope: the limits are constants only. Nothing in the prototype enforces them yet (the frame-side outbox and
// the parent's limiter are the plan's).

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
 * Constants only in the prototype: no limiter enforces them yet.
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

/** What the parent sends: hello on the window (once, exactly one port), everything else on the port. */
export type ParentToFrame =
  | { t: 'hello'; v: number }
  | { t: 'prefs'; theme?: 'auto' | 'light' | 'dark'; width?: 'standard' | 'wide'; font?: 'serif' | 'sans' }
  | { t: 'changes.result'; sha: string; ranges: readonly (readonly [number, number])[]; removedAfter?: readonly number[] }
  | { t: 'changes.result'; sha: string; unavailable: true };

/** What the frame sends, on the port only. Flat; every value a string except v. */
export type FrameToParent =
  | { t: 'ready'; v: 1; nonce: string }
  | { t: 'error'; why: ErrorWhy }
  | { t: 'store.set'; key: string; value: string }
  | { t: 'navigate'; href: string }
  | { t: 'copy'; text: string }
  | { t: 'changes'; sha: string }
  | { t: 'hash'; id: string }
  | { t: 'version'; sha?: string; only?: string };
