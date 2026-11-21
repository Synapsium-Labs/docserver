// `./host`'s parser of what the frame sends (docserver L3, Task 9; plan Reference §8.1 and §11.3, FD8). One message from
// the frame's port is judged here before anything acts on it: a plain object of the op's own keys, each value a string
// (a ready's `v` a number), inside its grammar and cap. The op table, the store key allow-list, the sha grammar, the
// error reasons and the limits are Task 1's single definitions (src/frame/protocol.ts); the hash grammar is the one
// fragment grammar (src/frame/fragment.ts). conformance/bridge-cases.json holds the verdicts as fixtures.
//
// Pure and import-inert: no DOM, no clock, no state between calls. The parser reads each own property once, by its
// descriptor, so a getter is refused unread; it never throws, whatever it is given. An accepted message is returned as a
// fresh object holding only the keys it was sent. Refusals are checked in a fixed order, the fixtures' order: ports,
// plain object, a prototype key, the op, the key set, the value types, then each op's own grammar.
//
// The parity wire (docserver parity T2) makes three verdicts depend on what the mount holds, which the caller passes as a
// `ParseContext` (the parser still keeps nothing): `bridge.places` (a `place` op, and a `hash`'s `push` and `from`, are
// refused without it) and the open print run (a `print-figure` is refused with none; plan choices B2 and B5). The reasons
// are the closed list's: a `place` or `print-figure` the mount did not ask for is `unknown-op`, a `push` or `from` the
// mount did not ask for is `keys`, a value outside its grammar or its run is `type` (a `from` over its cap, a figure or a
// run over a byte cap, `oversize`).
import { ANCHOR_LIMITS, isAnchorToken, pngBytesOfBase64 } from '../frame/anchor.js';
import { isFragmentId } from '../frame/fragment.js';
import {
  BRIDGE_LIMITS,
  BRIDGE_PROTOCOL,
  ERROR_WHY,
  FRAME_OPS,
  isBridgeStoreKey,
  isFullSha,
  isProgressThousandths,
  OP_KEYS,
  PLACE_KINDS,
  type ErrorWhy,
  type FrameToParent,
  type PlaceKind,
} from '../frame/protocol.js';

/** Why a frame-to-parent message is refused: the parser's part of bridge-cases.json's closed list of reasons. */
export type BridgeRefusal =
  | 'not-plain'
  | 'proto-key'
  | 'port'
  | 'unknown-op'
  | 'keys'
  | 'type'
  | 'oversize'
  | 'store-key'
  | 'json'
  | 'sha'
  | 'hash'
  | 'href'
  | 'why'
  | 'nonce'
  | 'protocol';

/**
 * The verdict on one message. An accepted `print-figure` also carries `bytes`, what its text decodes to (read once, from the
 * text's length and padding), so the caller keeps the run's total without scanning the text again.
 */
export type ParsedBridgeMessage =
  | { readonly ok: true; readonly msg: FrameToParent; readonly bytes?: number }
  | { readonly ok: false; readonly reason: BridgeRefusal };

type FrameOp = FrameToParent['t'];

/**
 * What the mount holds of one print run (plan choice B5): `n` is the run's figure count, set by its first accepted figure
 * (null before it); `seen` the indexes accepted; `bytes` what they decode to, together. `replaceable` is held only by a reopened
 * run (one `printFigures()` opened while the previous run was unfinished): each index it accepted once and may still replace
 * once, mapped to the bytes of the copy a replacement would drop; absent or empty, a repeated index is refused. `handed` is
 * what every figure the run accepted decoded to, replaced copies included (absent: none yet); the cap on it is
 * PRINT_RUN_HANDED_MAX_BYTES.
 */
export interface PrintRunView {
  readonly n: number | null;
  readonly seen: ReadonlySet<number>;
  readonly bytes: number;
  readonly replaceable?: ReadonlyMap<number, number>;
  readonly handed?: number;
}

/**
 * The most one run may hand to `onPrintFigure` in all, replaced copies counted: twice the run's live total. In an ordinary run
 * the live total (16 MiB) already bounds it; in a reopened run each index may be replaced once, so the live cap alone would
 * leave n figures of up to 1 MiB each, twice (about 80 MiB at n = 64). A run with a full earlier run's figures queued ahead of
 * its own (16 MiB, then 16 MiB again, each index replaced once) is exactly this cap and passes whole.
 */
export const PRINT_RUN_HANDED_MAX_BYTES = 2 * BRIDGE_LIMITS.printFiguresTotalMaxBytes;

/** The mount's state a verdict may depend on: `bridge.places` as seeded, and the open print run (null: none is open). */
export interface ParseContext {
  readonly places: boolean;
  readonly run: PrintRunView | null;
}

/** A mount with no `onPlace`, no `onPrintFigure` and no open run: what a 1.1 host is. */
const NO_CONTEXT: ParseContext = Object.freeze({ places: false, run: null });

/** A canonical decimal of one to three digits: no sign, no leading zero, no point (a figure's `i` and `n`). */
const FIGURE_NUMBER = /^(?:0|[1-9][0-9]{0,2})$/;

/** The base64 text every PNG file starts with (its eight signature bytes and the zero top bits of the next byte). */
const PNG_SIGNATURE_BASE64 = 'iVBORw0KGgo';

/** The keys each frame op must carry, beside `t` (OP_KEYS lists the keys it may carry). */
const REQUIRED_KEYS: Readonly<Record<FrameOp, readonly string[]>> = Object.freeze({
  ready: Object.freeze(['v', 'nonce']),
  error: Object.freeze(['why']),
  'store.set': Object.freeze(['key', 'value']),
  navigate: Object.freeze(['href']),
  copy: Object.freeze(['text']),
  changes: Object.freeze(['sha']),
  hash: Object.freeze(['id']),
  version: Object.freeze([]),
  progress: Object.freeze(['p']),
  place: Object.freeze(['kind']),
  'print-figure': Object.freeze(['i', 'n', 'png']),
});

/** Own keys no message may carry: an own `__proto__`, `constructor` or `prototype` (checked before the key set). */
const PROTO_KEYS: readonly string[] = Object.freeze(['__proto__', 'constructor', 'prototype']);

/**
 * The UTF-8 length of `s` in bytes, as a TextEncoder writes it: a lone surrogate is written as U+FFFD, three bytes.
 * Counted without allocating, so a 64 KiB value costs one pass.
 */
export function utf8Bytes(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        n += 4;
        i += 1;
      } else n += 3;
    } else n += 3;
  }
  return n;
}

/** True when `s` is one JSON text (white space around it allowed), as JSON.parse reads it. */
export function isJsonText(s: string): boolean {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

/** True when `s` holds a C0 control, DEL or a C1 control (U+0000 to U+001F, U+007F to U+009F). */
export function hasControl(s: string): boolean {
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) return true;
  }
  return false;
}

/** A plain object: its prototype is Object.prototype or null (never an array, a class instance or a host object). */
function isPlainObject(v: unknown): v is object {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

const refuse = (reason: BridgeRefusal): ParsedBridgeMessage => ({ ok: false, reason });

/**
 * Judges one message from the frame's port (Reference §11.3). `ports` is the event's `ports`: any transferred port is a
 * refusal. `nonce` is this mount's seed nonce, which a `ready` must echo with protocol 1. A ready is judged here like
 * any other op; dropping every other op before a valid ready, and the limits after it, are the caller's. `ctx` is the
 * mount's state (see ParseContext); absent, it is a mount that asked for no place and no print figure.
 */
export function parseBridgeMessage(data: unknown, ports: unknown, nonce: string, ctx: ParseContext = NO_CONTEXT): ParsedBridgeMessage {
  if (!Array.isArray(ports) || ports.length !== 0) return refuse('port');
  try {
    return judge(data, nonce, ctx);
  } catch {
    // A revoked proxy or a throwing trap: never a plain message.
    return refuse('not-plain');
  }
}

function judge(data: unknown, nonce: string, ctx: ParseContext): ParsedBridgeMessage {
  if (!isPlainObject(data)) return refuse('not-plain');
  const keys = Reflect.ownKeys(data);
  for (const k of PROTO_KEYS) if (keys.includes(k)) return refuse('proto-key');

  const tDesc = Object.getOwnPropertyDescriptor(data, 't');
  const t: unknown = tDesc !== undefined && 'value' in tDesc ? tDesc.value : undefined;
  if (typeof t !== 'string' || !(FRAME_OPS as readonly string[]).includes(t)) return refuse('unknown-op');
  const op = t as FrameOp;

  const allowed: readonly string[] = OP_KEYS[op];
  for (const k of keys) if (typeof k !== 'string' || !allowed.includes(k)) return refuse('keys');
  // A hash's `push` and `from` are the mount's own request (bridge.places): without it they are keys the op does not have.
  if (op === 'hash' && !ctx.places && (keys.includes('push') || keys.includes('from'))) return refuse('keys');
  for (const k of REQUIRED_KEYS[op]) if (!keys.includes(k)) return refuse('keys');

  // Every value, read once by its descriptor: a getter is never called.
  const values = new Map<string, unknown>();
  for (const k of keys as string[]) {
    const d = Object.getOwnPropertyDescriptor(data, k);
    if (d === undefined || !('value' in d)) return refuse('type');
    values.set(k, d.value);
  }

  if (op === 'ready') {
    const v = values.get('v');
    const got = values.get('nonce');
    if (typeof v !== 'number' || typeof got !== 'string') return refuse('type');
    if (v !== BRIDGE_PROTOCOL) return refuse('protocol');
    if (got !== nonce) return refuse('nonce');
    return { ok: true, msg: { t: 'ready', v: BRIDGE_PROTOCOL, nonce: got } };
  }

  for (const v of values.values()) if (typeof v !== 'string') return refuse('type');
  const str = (k: string): string => values.get(k) as string;

  switch (op) {
    case 'error': {
      const why = str('why');
      return (ERROR_WHY as readonly string[]).includes(why) ? { ok: true, msg: { t: 'error', why: why as ErrorWhy } } : refuse('why');
    }
    case 'store.set': {
      const key = str('key');
      const value = str('value');
      if (!isBridgeStoreKey(key)) return refuse('store-key');
      if (utf8Bytes(value) > BRIDGE_LIMITS.valueMaxBytes) return refuse('oversize');
      if (!isJsonText(value)) return refuse('json');
      return { ok: true, msg: { t: 'store.set', key, value } };
    }
    case 'navigate': {
      const href = str('href');
      if (href.length < 1 || href.length > BRIDGE_LIMITS.hrefMaxChars || hasControl(href)) return refuse('href');
      return { ok: true, msg: { t: 'navigate', href } };
    }
    case 'copy': {
      const text = str('text');
      return utf8Bytes(text) <= BRIDGE_LIMITS.copyMaxBytes ? { ok: true, msg: { t: 'copy', text } } : refuse('oversize');
    }
    case 'changes': {
      const sha = str('sha');
      return isFullSha(sha) ? { ok: true, msg: { t: 'changes', sha } } : refuse('sha');
    }
    case 'hash': {
      const id = str('id');
      if (!isFragmentId(id)) return refuse('hash');
      const msg: { t: 'hash'; id: string; push?: 'true'; from?: string } = { t: 'hash', id };
      if (values.has('push')) {
        if (str('push') !== 'true') return refuse('type');
        msg.push = 'true';
      }
      if (values.has('from')) {
        const from = str('from');
        if (from.length > ANCHOR_LIMITS.from) return refuse('oversize');
        if (!isAnchorToken(from)) return refuse('type');
        msg.from = from;
      }
      return { ok: true, msg };
    }
    case 'place': {
      if (!ctx.places) return refuse('unknown-op');
      const kind = str('kind');
      return (PLACE_KINDS as readonly string[]).includes(kind) ? { ok: true, msg: { t: 'place', kind: kind as PlaceKind } } : refuse('type');
    }
    case 'print-figure': {
      // In this order, each failure a refusal and nothing decoded before the last: an open run (B5); the index and the
      // count, inside the grammar and the run; the text's length against the longest a figure's cap allows (so the scan
      // below is bounded) and the text not empty; the text starting as a PNG's does; the PNG's size from its text, within its own
      // cap; the run's total; what the run has handed on in all, replaced copies included.
      const run = ctx.run;
      if (run === null) return refuse('unknown-op');
      const iText = str('i');
      const nText = str('n');
      if (!FIGURE_NUMBER.test(iText) || !FIGURE_NUMBER.test(nText)) return refuse('type');
      const i = Number(iText);
      const n = Number(nText);
      if (!(i < n && n <= BRIDGE_LIMITS.printFiguresMax)) return refuse('type');
      if (run.n !== null && n !== run.n) return refuse('type');
      // A repeated index is refused, but for the first repeat in a reopened run, which replaces the earlier copy (that copy's
      // bytes leave the run's total below, before the cap is checked).
      let replaced = 0;
      if (run.seen.has(i)) {
        const held = run.replaceable?.get(i);
        if (held === undefined) return refuse('type');
        replaced = held;
      }
      const png = str('png');
      // The longest base64 text a figure of at most printFigurePngMaxBytes can have: four characters per started group of three bytes.
      if (png.length > 4 * Math.ceil(BRIDGE_LIMITS.printFigurePngMaxBytes / 3)) return refuse('oversize');
      if (png.length === 0) return refuse('type');
      // A PNG file starts with the eight bytes 89 50 4E 47 0D 0A 1A 0A, whose base64 text is this prefix (the next byte of a PNG, the
      // first of its IHDR chunk's length, is zero, which the eleventh character requires): read from the text, nothing decoded.
      if (!png.startsWith(PNG_SIGNATURE_BASE64)) return refuse('type');
      const bytes = pngBytesOfBase64(png);
      if (bytes === null) return refuse('type');
      if (bytes > BRIDGE_LIMITS.printFigurePngMaxBytes) return refuse('oversize');
      if (run.bytes - replaced + bytes > BRIDGE_LIMITS.printFiguresTotalMaxBytes) return refuse('oversize');
      if ((run.handed ?? 0) + bytes > PRINT_RUN_HANDED_MAX_BYTES) return refuse('oversize');
      return { ok: true, msg: { t: 'print-figure', i: iText, n: nText, png }, bytes };
    }
    case 'progress': {
      // The share in thousandths, a string inside PROGRESS_SOURCE; a string outside it is refused as `type` (no new reason, batch 1.1).
      const p = str('p');
      return isProgressThousandths(p) ? { ok: true, msg: { t: 'progress', p } } : refuse('type');
    }
    case 'version': {
      const msg: { t: 'version'; sha?: string; only?: string } = { t: 'version' };
      for (const k of ['sha', 'only'] as const) {
        if (!values.has(k)) continue;
        const v = str(k);
        if (!isFullSha(v)) return refuse('sha');
        msg[k] = v;
      }
      return { ok: true, msg };
    }
  }
}
