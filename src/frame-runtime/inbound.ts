// What the frame accepts on its port (docserver L3, Task 5; plan Reference §6.5 and §8.2): `prefs`,
// `changes.result`, `mermaid` and `command`. Anything else, or anything malformed, is ignored (null): the frame keeps no refusal count. `hello`
// comes on the window, never on the port, and is the bootstrap's own check. Bundled into the bootstrap; DOM-free.
//
// A message is read as `./host`'s parser reads one: a plain object (prototype Object.prototype or null), own string
// keys only, each read once by its descriptor (a getter refuses it unread), no `__proto__`, `constructor` or
// `prototype` key, every key inside its op's set (OP_KEYS, the one table both sides read):
//   prefs           theme, width and font, each optional, each one of its values (FRAME_PREF_VALUES)
//   changes.result  a full sha, and either `ranges` (an array of [from, to] integer pairs) with an optional
//                   `removedAfter` (an array of integers), or `unavailable: true` alone. The counts are checked first,
//                   against L2's own caps (MAX_RANGES and MAX_DELETIONS in src/enhance/changes.ts, 10,000 each; a
//                   unit row pins the equality), so a huge or sparse array costs nothing; then each element, by index,
//                   so a hole (which a structured clone keeps) is refused. L2's readChangeSet checks the ranges again
//                   when the answer reaches it.
//   mermaid         exactly one of `text` (a string of at most BRIDGE_LIMITS.mermaidMaxChars UTF-16 code units, counted
//                   by length) or `unavailable: true`; both, neither, another key, a non-string text or any other
//                   `unavailable` is ignored. Whether the frame acts on it (its seed draws 'after-ready', it has
//                   settled, it is the first) is the bootstrap's own check; this file judges the shape only (C107).
//   command         exactly `name`, a string that is one of COMMAND_OPS; any other name, a non-string or another key is
//                   ignored (batch 1.1, C108). Whether the reader has that tool is the reader's own answer.
import { BRIDGE_LIMITS, COMMAND_OPS, FRAME_PREF_VALUES, isFullSha, OP_KEYS, type CommandOp, type ParentToFrame } from '../frame/protocol.js';

const getProto = Object.getPrototypeOf;
const ownKeys = Reflect.ownKeys;
const describe = Object.getOwnPropertyDescriptor;
const isArray = Array.isArray;
const isInteger = Number.isInteger;
const ObjectProto = Object.prototype;

const PROTO_KEYS: readonly string[] = ['__proto__', 'constructor', 'prototype'];

/** The most ranges, and the most removedAfter entries, a changes.result may carry: L2's caps (see the header). */
export const CHANGES_MAX_RANGES = 10_000;
export const CHANGES_MAX_DELETIONS = 10_000;
const PREF_VALUES: Readonly<Record<string, readonly string[]>> = FRAME_PREF_VALUES;

/** The own data values of a plain object, by key; null when it is not one. */
function own(data: unknown): Map<string, unknown> | null {
  if (typeof data !== 'object' || data === null || isArray(data)) return null;
  const p: unknown = getProto(data);
  if (p !== ObjectProto && p !== null) return null;
  const out = new Map<string, unknown>();
  for (const k of ownKeys(data)) {
    if (typeof k !== 'string' || PROTO_KEYS.includes(k)) return null;
    const d = describe(data, k);
    if (d === undefined || !('value' in d)) return null;
    out.set(k, d.value);
  }
  return out;
}

/** An array of at most `max` integers, read by index: a hole reads as undefined, which is not one. */
function intList(v: unknown, max: number): v is number[] {
  if (!isArray(v) || v.length > max) return false;
  for (let i = 0; i < v.length; i++) {
    if (!isInteger(v[i])) return false;
  }
  return true;
}

/** The parent's message as the frame acts on it, or null to ignore it (see the header). */
export function parseParentMessage(data: unknown): ParentToFrame | null {
  const m = own(data);
  if (m === null) return null;
  const t = m.get('t');
  if (t !== 'prefs' && t !== 'changes.result' && t !== 'mermaid' && t !== 'command') return null;
  const allowed: readonly string[] = OP_KEYS[t];
  for (const k of m.keys()) if (!allowed.includes(k)) return null;
  if (t === 'command') {
    const name = m.get('name');
    return m.size === 2 && typeof name === 'string' && (COMMAND_OPS as readonly string[]).includes(name) ? { t: 'command', name: name as CommandOp } : null;
  }
  if (t === 'mermaid') {
    const hasText = m.has('text');
    if (hasText === m.has('unavailable')) return null;
    if (!hasText) return m.get('unavailable') === true ? { t: 'mermaid', unavailable: true } : null;
    const text = m.get('text');
    return typeof text === 'string' && text.length <= BRIDGE_LIMITS.mermaidMaxChars ? { t: 'mermaid', text } : null;
  }
  if (t === 'prefs') {
    const out: Record<string, string> = { t: 'prefs' };
    for (const [k, v] of m) {
      if (k === 't') continue;
      const values = PREF_VALUES[k];
      if (values === undefined || typeof v !== 'string' || !values.includes(v)) return null;
      out[k] = v;
    }
    return out as ParentToFrame;
  }
  const sha = m.get('sha');
  if (!isFullSha(sha)) return null;
  if (m.has('unavailable')) {
    return m.get('unavailable') === true && !m.has('ranges') && !m.has('removedAfter') ? { t: 'changes.result', sha, unavailable: true } : null;
  }
  const ranges = m.get('ranges');
  if (!isArray(ranges) || ranges.length > CHANGES_MAX_RANGES) return null;
  for (let i = 0; i < ranges.length; i++) {
    const pair: unknown = ranges[i];
    if (!intList(pair, 2) || pair.length !== 2) return null;
  }
  const pairs = ranges as [number, number][];
  if (!m.has('removedAfter')) return { t: 'changes.result', sha, ranges: pairs };
  const removedAfter = m.get('removedAfter');
  return intList(removedAfter, CHANGES_MAX_DELETIONS) ? { t: 'changes.result', sha, ranges: pairs, removedAfter } : null;
}
