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
// The limits are enforced on both sides: the frame paces itself by them (src/frame-runtime/outbox.ts) and `./host`'s
// limiter reads them as token buckets (src/host/limits.ts).
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
  /** The window in which the frame sends one `progress` (leading edge: the first at once, the latest of the window at its end), batch 1.1. */
  progressWindowMs: 250,
  refusalsToClose: 16,
  valueMaxBytes: 65536,
  copyMaxBytes: 65536,
  hashMaxCodeUnits: 256,
  hrefMaxChars: 4096,
  storeBudgetBytes: 1048576,
  /** The most UTF-16 code units a `mermaid` message's `text` may carry (twice the 4 MiB budget of the build itself, in code units). */
  mermaidMaxChars: 8388608,
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
  /** The most figures one print run may carry, and so the largest `n` of a `print-figure` (docserver parity T1). */
  printFiguresMax: 64,
  /** The most bytes one figure's PNG may decode to. */
  printFigurePngMaxBytes: 1048576,
  /** The most bytes all the figures of one run may decode to, together. */
  printFiguresTotalMaxBytes: 16777216,
  /** The most pixels either side of a figure's image may have (the frame draws within it; the host reads no pixels). */
  printFigureSideMaxPx: 2048,
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

/** The kinds of a `place` op: the full-screen figure opened, or closed (the only place: the keys sheet, the quick jump, the settings and the like are not). */
export const PLACE_KINDS = Object.freeze(['overlay', 'overlay-closed'] as const);
export type PlaceKind = (typeof PLACE_KINDS)[number];

/**
 * The command names a parent may send in a `command` op (batch 1.1, C108): the twin of L2's `COMMAND_NAMES`
 * (src/enhance/commands.ts), which L2 cannot import from here (it may import only its own siblings). Held equal by
 * test/enhance-mermaid-on-request.test.ts, beside the draw lists (C94(2)): L2's names first, in order, then the parity
 * wire's `close-overlay`, `goto` and `print-figures`, which the reader gets handlers for in its own tasks (a reader that
 * does not know a name answers false).
 */
export const COMMAND_OPS = Object.freeze(['jump', 'settings', 'contents', 'outline', 'close-overlay', 'goto', 'print-figures'] as const);
export type CommandOp = (typeof COMMAND_OPS)[number];

/**
 * A `progress` op's `p`: the share read so far in thousandths, a string of the whole numbers 0 to 1000 with no sign,
 * point, exponent, white space or leading zero. The parent hands its adapter `Number(p) / 1000`.
 */
export const PROGRESS_SOURCE = '^(?:0|[1-9][0-9]{0,2}|1000)$';
const PROGRESS = new RegExp(PROGRESS_SOURCE);

/** True for a `progress` value: a string inside PROGRESS_SOURCE. */
export function isProgressThousandths(p: unknown): p is string {
  return typeof p === 'string' && PROGRESS.test(p);
}

/** The reader prefs the bridge carries, each optional. */
export type FramePrefValues = { -readonly [K in keyof typeof FRAME_PREF_VALUES]?: (typeof FRAME_PREF_VALUES)[K][number] };

/** What the parent sends: hello on the window (once, exactly one port), everything else on the port. */
export type ParentToFrame =
  | { t: 'hello'; v: number }
  | ({ t: 'prefs' } & FramePrefValues)
  | { t: 'changes.result'; sha: string; ranges: readonly (readonly [number, number])[]; removedAfter?: readonly number[] }
  | { t: 'changes.result'; sha: string; unavailable: true }
  /** The diagram engine's build (an 'after-ready' frame only, once, after ready), or the host's "no build". */
  | { t: 'mermaid'; text: string }
  | { t: 'mermaid'; unavailable: true }
  /** A reader tool to toggle, by name (batch 1.1, C108): a frame older than this release ignores it, as it ignores every op it does not know. */
  | { t: 'command'; name: Exclude<CommandOp, 'goto'> }
  /** Go to a place of the document: `id` by the fragment grammar, `from` the opaque token of a `hash` op (at most ANCHOR_LIMITS.from code units); the reader judges the token. */
  | { t: 'command'; name: 'goto'; id: string; from?: string }
  /**
   * The host's appearance while the frame is open (the appearance contract, src/enhance/appearance.ts): `{mode, colour?,
   * skin?, label?}`. The port parser checks only the outer shape; the reader script runs `parseAppearance` on the value. A
   * frame older than this release ignores the op, as it ignores every op it does not know.
   */
  | { t: 'appearance'; v: 1; appearance: object };

/** What the frame sends, on the port only. Flat; every value a string except v. */
export type FrameToParent =
  | { t: 'ready'; v: 1; nonce: string }
  | { t: 'error'; why: ErrorWhy }
  /** JSON text; the literal 'null' deletes. */
  | { t: 'store.set'; key: BridgeStoreKey; value: string }
  | { t: 'navigate'; href: string }
  | { t: 'copy'; text: string }
  | { t: 'changes'; sha: string }
  /**
   * isFragmentId(id); never ''. `push` (only the string 'true') and `from` (a position token, at most ANCHOR_LIMITS.from
   * code units) are sent only to a parent whose seed has `bridge.places`; every value stays a flat string.
   */
  | { t: 'hash'; id: string; push?: 'true'; from?: string }
  /** No keys: back to the latest. */
  | { t: 'version'; sha?: string; only?: string }
  /** How far the document has been read, in thousandths (isProgressThousandths); sent only when the seed's bridge asks for it. */
  | { t: 'progress'; p: string }
  /** The frame's full-screen figure opened or closed; sent only when the seed's bridge asks for places. */
  | { t: 'place'; kind: PlaceKind }
  /** One figure of a print run as a PNG, in base64: `i` of `n`, both canonical decimal strings; sent only when the seed's bridge asks for print figures. */
  | { t: 'print-figure'; i: string; n: string; png: string };

/**
 * Every key each op may carry, `t` included, by its `t`: the one table both parsers read. A key outside its op's set
 * is a refusal; which keys are required, and each value's grammar, are Reference §6.3, §6.5 and §11.3 (and the
 * fixtures of conformance/bridge-cases.json).
 */
export const OP_KEYS = Object.freeze({
  hello: Object.freeze(['t', 'v'] as const),
  prefs: Object.freeze(['t', 'theme', 'width', 'font'] as const),
  'changes.result': Object.freeze(['t', 'sha', 'ranges', 'removedAfter', 'unavailable'] as const),
  mermaid: Object.freeze(['t', 'text', 'unavailable'] as const),
  command: Object.freeze(['t', 'name', 'id', 'from'] as const),
  appearance: Object.freeze(['t', 'v', 'appearance'] as const),
  ready: Object.freeze(['t', 'v', 'nonce'] as const),
  error: Object.freeze(['t', 'why'] as const),
  'store.set': Object.freeze(['t', 'key', 'value'] as const),
  navigate: Object.freeze(['t', 'href'] as const),
  copy: Object.freeze(['t', 'text'] as const),
  changes: Object.freeze(['t', 'sha'] as const),
  hash: Object.freeze(['t', 'id', 'push', 'from'] as const),
  version: Object.freeze(['t', 'sha', 'only'] as const),
  progress: Object.freeze(['t', 'p'] as const),
  place: Object.freeze(['t', 'kind'] as const),
  'print-figure': Object.freeze(['t', 'i', 'n', 'png'] as const),
} satisfies Record<FrameToParent['t'] | ParentToFrame['t'], readonly string[]>);

/** The ops the frame sends (`./host` reads only these). */
export const FRAME_OPS = Object.freeze(['ready', 'error', 'store.set', 'navigate', 'copy', 'changes', 'hash', 'version', 'progress', 'place', 'print-figure'] as const satisfies readonly FrameToParent['t'][]);

/** The ops the parent sends (the frame reads only these: hello on the window, the others on the port). */
export const PARENT_OPS = Object.freeze(['hello', 'prefs', 'changes.result', 'mermaid', 'command', 'appearance'] as const satisfies readonly ParentToFrame['t'][]);

/**
 * The parent-to-frame op names the frame's port parser accepts (src/frame-runtime/inbound.ts reads this one list, built into
 * the bootstrap). It is not PARENT_OPS, which the frame does not read: `hello` is in PARENT_OPS, comes on the window and is the
 * bootstrap's own check, and the port parser refuses it. 1.1.0 hard-coded the first four here; the appearance contract adds
 * `appearance`. conformance/frame-boundaries.json records the list at every landing that changes it (test/frame-boundaries.test.ts).
 */
export const FRAME_ACCEPTS = Object.freeze(['prefs', 'changes.result', 'mermaid', 'command', 'appearance'] as const satisfies readonly ParentToFrame['t'][]);
