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
import { isFragmentId } from '../frame/fragment.js';
import {
  BRIDGE_LIMITS,
  BRIDGE_PROTOCOL,
  ERROR_WHY,
  FRAME_OPS,
  isBridgeStoreKey,
  isFullSha,
  OP_KEYS,
  type ErrorWhy,
  type FrameToParent,
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

export type ParsedBridgeMessage = { readonly ok: true; readonly msg: FrameToParent } | { readonly ok: false; readonly reason: BridgeRefusal };

type FrameOp = FrameToParent['t'];

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
 * any other op; dropping every other op before a valid ready, and the limits after it, are the caller's.
 */
export function parseBridgeMessage(data: unknown, ports: unknown, nonce: string): ParsedBridgeMessage {
  if (!Array.isArray(ports) || ports.length !== 0) return refuse('port');
  try {
    return judge(data, nonce);
  } catch {
    // A revoked proxy or a throwing trap: never a plain message.
    return refuse('not-plain');
  }
}

function judge(data: unknown, nonce: string): ParsedBridgeMessage {
  if (!isPlainObject(data)) return refuse('not-plain');
  const keys = Reflect.ownKeys(data);
  for (const k of PROTO_KEYS) if (keys.includes(k)) return refuse('proto-key');

  const tDesc = Object.getOwnPropertyDescriptor(data, 't');
  const t: unknown = tDesc !== undefined && 'value' in tDesc ? tDesc.value : undefined;
  if (typeof t !== 'string' || !(FRAME_OPS as readonly string[]).includes(t)) return refuse('unknown-op');
  const op = t as FrameOp;

  const allowed: readonly string[] = OP_KEYS[op];
  for (const k of keys) if (typeof k !== 'string' || !allowed.includes(k)) return refuse('keys');
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
      return isFragmentId(id) ? { ok: true, msg: { t: 'hash', id } } : refuse('hash');
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
