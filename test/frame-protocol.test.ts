// The bridge protocol's single definition and its fixtures (docserver L3, Task 1; plan Reference §8, FD8, FD11; rows U9
// and the bridge cases). src/frame/protocol.ts is the one table both parsers read: the frame's (parent-to-frame) and
// `./host`'s (frame-to-parent). conformance/bridge-cases.json is the wire as fixtures, for the first consumer's own parser:
// labelled messages with a verdict each, and timed sequences for the bucket reading of the parent's limits (ruling R5).
//
// This file holds two references written here, independent of any shipped parser: a parser of Reference §6.3, §6.5 and
// §11.3 that must agree with every message verdict, and a token bucket that must agree with every timed sequence. Task 9's
// limiter and parser must agree with the same fixtures. Every non-ASCII character in a string is written as an escape
// (ruling R6), the section sign of a title excepted (test/frame-fragment.test.ts scans for one written raw).
import { readFileSync } from 'node:fs';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  BRIDGE_LIMITS,
  BRIDGE_PROTOCOL,
  DOC_FIELDS,
  ERROR_WHY,
  isFragmentId,
  OP_KEYS,
  PREF_KEYS,
  type BridgeStoreKey,
  type FrameToParent,
  type ParentToFrame,
} from '../src/frame/index.js';
// The wire helpers the frame runtime and `./host` read inside the package: never part of `./frame`'s public surface.
import { FRAME_OPS, FRAME_PREF_VALUES, isBridgeStoreKey, isFullSha, PARENT_OPS } from '../src/frame/protocol.js';

const ROOT = new URL('../', import.meta.url);
const readText = (rel: string): string => readFileSync(new URL(rel, ROOT), 'utf8');

describe('tsconfig.frame.json: ./frame and ./highlight typecheck with no DOM (Reference §12)', () => {
  it('extends the base, includes src/frame and src/highlight, and has lib ES2022 alone and no ambient types', () => {
    const cfg = JSON.parse(readText('tsconfig.frame.json')) as { extends: string; compilerOptions: Record<string, unknown>; include: string[] };
    expect(cfg.extends).toBe('./tsconfig.json');
    expect(cfg.include).toEqual(['src/frame', 'src/highlight']);
    expect(cfg.compilerOptions['lib']).toEqual(['ES2022']);
    expect(cfg.compilerOptions['types']).toEqual([]);
  });
});

describe("./frame's entry: the wire names of Reference §1 and Task 1's Produces, and no internal helper (FD20)", () => {
  // Every export of the entry is semver surface from v1 (FD20: removing or reshaping one is a major). The helpers below
  // serve the frame runtime and `./host`, which import them from protocol.ts inside the package.
  const INTERNAL = ['FRAME_OPS', 'PARENT_OPS', 'FRAME_PREF_VALUES', 'FULL_SHA_SOURCE', 'isBridgeStoreKey', 'isFullSha', 'FramePrefValues', 'PrefKey'];

  it('exports the wire constants and the grammar that Reference §1 and Produces name', async () => {
    const entry = (await import('../src/frame/index.js')) as Record<string, unknown>;
    for (const name of ['BRIDGE_PROTOCOL', 'SEED_SCHEMA', 'BRIDGE_LIMITS', 'PREF_KEYS', 'DOC_FIELDS', 'OP_KEYS', 'FRAGMENT_ID_GRAMMAR', 'isFragmentId']) {
      expect(Object.keys(entry), name).toContain(name);
    }
  });

  it('exports none of the internal wire helpers, as a value or as a type', async () => {
    const entry = (await import('../src/frame/index.js')) as Record<string, unknown>;
    expect(Object.keys(entry).filter((k) => INTERNAL.includes(k))).toEqual([]);
    const text = readText('src/frame/index.ts').replace(/^\/\/.*$/gm, '');
    expect(INTERNAL.filter((name) => new RegExp(`\\b${name}\\b`).test(text))).toEqual([]);
  });

  it('the scan sees a name the entry does export (its control)', () => {
    expect(/\bOP_KEYS\b/.test(readText('src/frame/index.ts'))).toBe(true);
  });
});

describe('U9 BRIDGE_LIMITS: exactly Reference §8.4 (ruling R5)', () => {
  it('the parent reads its limits as token buckets, and the frame paces by a sliding window that neither reading refuses', () => {
    expect(BRIDGE_LIMITS).toEqual({
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
      changesTimeoutMs: 30000,
      frameWindowMs: 1000,
      frameMaxPerWindow: 16,
      frameStoreSetMaxPerWindow: 8,
      frameCopyMaxPerWindow: 4,
      frameChangesTimeoutMs: 35000,
    });
    expect(Object.isFrozen(BRIDGE_LIMITS)).toBe(true);
  });

  it('the frame window fits under the strict reading of both parent limits, and the frame outlasts the parent on changes', () => {
    const L = BRIDGE_LIMITS;
    expect(L.frameWindowMs).toBe(1000);
    expect(L.frameMaxPerWindow).toBeLessThanOrEqual(Math.min(L.bucketCapacity, L.bucketRefillPerSecond));
    expect(L.frameStoreSetMaxPerWindow).toBeLessThanOrEqual(Math.min(L.storeSetBucketCapacity, L.storeSetRefillPerSecond));
    expect(L.frameCopyMaxPerWindow).toBeLessThanOrEqual(L.frameMaxPerWindow);
    expect(L.frameChangesTimeoutMs).toBeGreaterThan(L.changesTimeoutMs);
  });

  it('the hash cap is the fragment grammar\'s', () => {
    expect(BRIDGE_LIMITS.hashMaxCodeUnits).toBe(256);
    expect(isFragmentId('x'.repeat(BRIDGE_LIMITS.hashMaxCodeUnits))).toBe(true);
    expect(isFragmentId('x'.repeat(BRIDGE_LIMITS.hashMaxCodeUnits + 1))).toBe(false);
  });
});

describe('the store key allow-list (Reference §8.3, FD8)', () => {
  it("PREF_KEYS is exactly ['prefs', 'ui'], frozen", () => {
    expect(PREF_KEYS).toEqual(['prefs', 'ui']);
    expect(Object.isFrozen(PREF_KEYS)).toBe(true);
  });

  it("DOC_FIELDS holds 'pos', is sorted, unique and frozen", () => {
    expect(DOC_FIELDS).toContain('pos');
    expect([...DOC_FIELDS].sort()).toEqual([...DOC_FIELDS]);
    expect(new Set(DOC_FIELDS).size).toBe(DOC_FIELDS.length);
    expect(Object.isFrozen(DOC_FIELDS)).toBe(true);
  });

  it('isBridgeStoreKey admits pref:<PREF_KEYS> and doc:<DOC_FIELDS> only', () => {
    for (const k of PREF_KEYS) expect(isBridgeStoreKey(`pref:${k}`)).toBe(true);
    for (const f of DOC_FIELDS) expect(isBridgeStoreKey(`doc:${f}`)).toBe(true);
    for (const k of ['pref:', 'pref:lens', 'doc:', 'doc:nope', 'prefs', 'pos', 'docreader:prefs', 'pref:prefs ', 'PREF:prefs', 'doc:pos:x']) {
      expect(isBridgeStoreKey(k), k).toBe(false);
    }
    for (const v of [null, undefined, 1, {}, ['pref:prefs']]) expect(isBridgeStoreKey(v)).toBe(false);
  });

  it("the types: BridgeStoreKey is pref:<name> or doc:<field>; store.set's key is one", () => {
    expectTypeOf<'pref:prefs'>().toExtend<BridgeStoreKey>();
    expectTypeOf<'pref:ui'>().toExtend<BridgeStoreKey>();
    expectTypeOf<'doc:pos'>().toExtend<BridgeStoreKey>();
    expectTypeOf<'pref:lens'>().not.toExtend<BridgeStoreKey>();
    expectTypeOf<'docreader:prefs'>().not.toExtend<BridgeStoreKey>();
    // doc:<field> is closed at compile time too: only a DOC_FIELDS member (the generated list is `as const`).
    expectTypeOf<'doc:folds'>().toExtend<BridgeStoreKey>();
    expectTypeOf<'doc:nope'>().not.toExtend<BridgeStoreKey>();
    expectTypeOf<'doc:'>().not.toExtend<BridgeStoreKey>();
    expectTypeOf<`doc:${(typeof DOC_FIELDS)[number]}`>().toExtend<BridgeStoreKey>();
    expectTypeOf<Extract<FrameToParent, { t: 'store.set' }>['key']>().toEqualTypeOf<BridgeStoreKey>();
  });
});

describe('isFullSha: full 40 or 64 lower-case hex (FD8, Reference §8.1)', () => {
  it('accepts 40 and 64 lower-case hex, refuses every other length, upper case and non-strings', () => {
    expect(isFullSha('a'.repeat(40))).toBe(true);
    expect(isFullSha('0'.repeat(64))).toBe(true);
    for (const s of ['', 'a'.repeat(7), 'a'.repeat(39), 'a'.repeat(41), 'a'.repeat(63), 'a'.repeat(65), 'A'.repeat(40), `${'a'.repeat(39)}g`, ` ${'a'.repeat(40)}`]) {
      expect(isFullSha(s), s).toBe(false);
    }
    for (const v of [null, 1, {}]) expect(isFullSha(v)).toBe(false);
  });
});

describe('OP_KEYS: the op key sets per t, one table for both parsers', () => {
  it('is exactly the key set of each op of Reference §1, frozen', () => {
    expect(OP_KEYS).toEqual({
      hello: ['t', 'v'],
      prefs: ['t', 'theme', 'width', 'font'],
      'changes.result': ['t', 'sha', 'ranges', 'removedAfter', 'unavailable'],
      ready: ['t', 'v', 'nonce'],
      error: ['t', 'why'],
      'store.set': ['t', 'key', 'value'],
      navigate: ['t', 'href'],
      copy: ['t', 'text'],
      changes: ['t', 'sha'],
      hash: ['t', 'id'],
      version: ['t', 'sha', 'only'],
    });
    expect(Object.isFrozen(OP_KEYS)).toBe(true);
    for (const keys of Object.values(OP_KEYS)) expect(Object.isFrozen(keys)).toBe(true);
  });

  it('FRAME_OPS and PARENT_OPS split it by direction, with no op in both', () => {
    expect([...FRAME_OPS]).toEqual(['ready', 'error', 'store.set', 'navigate', 'copy', 'changes', 'hash', 'version']);
    expect([...PARENT_OPS]).toEqual(['hello', 'prefs', 'changes.result']);
    expect([...FRAME_OPS, ...PARENT_OPS].sort()).toEqual(Object.keys(OP_KEYS).sort());
  });

  it("the table agrees with the message types: each op's keys are exactly its type's keys", () => {
    type Keys<U> = U extends unknown ? keyof U : never;
    expectTypeOf<keyof typeof OP_KEYS>().toEqualTypeOf<FrameToParent['t'] | ParentToFrame['t']>();
    expectTypeOf<(typeof OP_KEYS)['version'][number]>().toEqualTypeOf<Keys<Extract<FrameToParent, { t: 'version' }>>>();
    expectTypeOf<(typeof OP_KEYS)['changes.result'][number]>().toEqualTypeOf<Keys<Extract<ParentToFrame, { t: 'changes.result' }>>>();
    expectTypeOf<(typeof OP_KEYS)['prefs'][number]>().toEqualTypeOf<Keys<Extract<ParentToFrame, { t: 'prefs' }>>>();
    expectTypeOf<(typeof OP_KEYS)['ready'][number]>().toEqualTypeOf<Keys<Extract<FrameToParent, { t: 'ready' }>>>();
  });

  it("FRAME_PREF_VALUES: the prefs op's enums (theme, width, font; the lens stays frame-local)", () => {
    expect(FRAME_PREF_VALUES).toEqual({ theme: ['auto', 'light', 'dark'], width: ['standard', 'wide'], font: ['serif', 'sans'] });
    expect(Object.isFrozen(FRAME_PREF_VALUES)).toBe(true);
    expect(OP_KEYS.prefs.filter((k) => k !== 't')).toEqual(Object.keys(FRAME_PREF_VALUES));
  });
});

// ───────── conformance/bridge-cases.json ─────────

type Verdict = { verdict: 'accept' } | { verdict: 'refuse'; reason: string };
interface Fill {
  readonly prefix?: string;
  readonly unit: string;
  readonly times: number;
  readonly suffix?: string;
}
interface MessageCase {
  readonly label: string;
  readonly direction: 'frame-to-parent' | 'parent-to-frame';
  readonly channel?: 'window' | 'port';
  readonly ports?: number;
  readonly message: unknown;
  readonly fill?: Readonly<Record<string, Fill>>;
  readonly verdict: 'accept' | 'refuse';
  readonly reason?: string;
  readonly note?: string;
}
interface Step {
  readonly at: number;
  readonly count?: number;
  readonly message: Record<string, unknown>;
  readonly verdict: 'accept' | 'refuse';
  readonly reason?: string;
  readonly closes?: boolean;
}
interface Sequence {
  readonly label: string;
  readonly steps: readonly Step[];
}
interface BridgeCases {
  readonly bridgeProtocol: number;
  readonly about: readonly string[];
  readonly reasons: readonly string[];
  readonly context: { readonly nonce: string; readonly inFlightSha: string };
  readonly messages: readonly MessageCase[];
  readonly sequenceRules: readonly string[];
  readonly sequences: readonly Sequence[];
}

const RAW = readText('conformance/bridge-cases.json');
const CASES = JSON.parse(RAW) as BridgeCases;

/** The closed list of refusal reasons, as Reference §6.3, §6.5, §8.1 and §11.3 name the faults. */
const REASONS = [
  'not-plain',
  'proto-key',
  'port',
  'unknown-op',
  'keys',
  'type',
  'oversize',
  'store-key',
  'json',
  'sha',
  'hash',
  'href',
  'why',
  'pref',
  'nonce',
  'protocol',
  'rate',
];

/** A case's message with its fills applied: each filled key gets prefix + unit repeated `times` + suffix. */
function messageOf(c: MessageCase): unknown {
  if (c.fill === undefined) return c.message;
  const m = { ...(c.message as Record<string, unknown>) };
  for (const [k, f] of Object.entries(c.fill)) m[k] = `${f.prefix ?? ''}${f.unit.repeat(f.times)}${f.suffix ?? ''}`;
  return m;
}

const utf8Bytes = (s: string): number => Buffer.byteLength(s, 'utf8');

const isPlain = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const p: unknown = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
};

const REQUIRED: Readonly<Record<string, readonly string[]>> = {
  ready: ['v', 'nonce'],
  error: ['why'],
  'store.set': ['key', 'value'],
  navigate: ['href'],
  copy: ['text'],
  changes: ['sha'],
  hash: ['id'],
  version: [],
  hello: ['v'],
  prefs: [],
};

const refuse = (reason: string): Verdict => ({ verdict: 'refuse', reason });
const ACCEPT: Verdict = { verdict: 'accept' };

/** The common checks of both parsers: plain, no proto key, an op of this direction, its keys, its required keys. */
function common(m: unknown, ops: readonly string[]): { fail: Verdict } | { msg: Record<string, unknown> } {
  if (!isPlain(m)) return { fail: refuse('not-plain') };
  for (const k of ['__proto__', 'constructor', 'prototype']) if (Object.hasOwn(m, k)) return { fail: refuse('proto-key') };
  const t = m['t'];
  if (typeof t !== 'string' || !ops.includes(t)) return { fail: refuse('unknown-op') };
  const allowed = (OP_KEYS as Readonly<Record<string, readonly string[]>>)[t] ?? [];
  if (Object.keys(m).some((k) => !allowed.includes(k))) return { fail: refuse('keys') };
  if ((REQUIRED[t] ?? []).some((k) => !Object.hasOwn(m, k))) return { fail: refuse('keys') };
  return { msg: m };
}

const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;

/** `./host`'s reading of a frame-to-parent message (Reference §8.1, §11.3), once a valid ready is held. */
function parentReads(m: unknown, ports: number, ctx: BridgeCases['context']): Verdict {
  if (ports !== 0) return refuse('port');
  const c = common(m, FRAME_OPS);
  if ('fail' in c) return c.fail;
  const msg = c.msg;
  const t = msg['t'];
  if (t === 'ready') {
    if (typeof msg['v'] !== 'number') return refuse('type');
    if (typeof msg['nonce'] !== 'string') return refuse('type');
    if (msg['v'] !== BRIDGE_PROTOCOL) return refuse('protocol');
    return msg['nonce'] === ctx.nonce ? ACCEPT : refuse('nonce');
  }
  for (const v of Object.values(msg)) if (typeof v !== 'string') return refuse('type');
  switch (t) {
    case 'error':
      return (ERROR_WHY as readonly string[]).includes(msg['why'] as string) ? ACCEPT : refuse('why');
    case 'store.set': {
      if (!isBridgeStoreKey(msg['key'])) return refuse('store-key');
      const value = msg['value'] as string;
      if (utf8Bytes(value) > BRIDGE_LIMITS.valueMaxBytes) return refuse('oversize');
      try {
        JSON.parse(value);
      } catch {
        return refuse('json');
      }
      return ACCEPT;
    }
    case 'navigate': {
      const href = msg['href'] as string;
      return href.length >= 1 && href.length <= BRIDGE_LIMITS.hrefMaxChars && !CONTROL.test(href) ? ACCEPT : refuse('href');
    }
    case 'copy':
      return utf8Bytes(msg['text'] as string) <= BRIDGE_LIMITS.copyMaxBytes ? ACCEPT : refuse('oversize');
    case 'changes':
      return isFullSha(msg['sha']) ? ACCEPT : refuse('sha');
    case 'hash':
      return isFragmentId(msg['id']) ? ACCEPT : refuse('hash');
    case 'version':
      for (const k of ['sha', 'only']) if (Object.hasOwn(msg, k) && !isFullSha(msg[k])) return refuse('sha');
      return ACCEPT;
    default:
      return refuse('unknown-op');
  }
}

/** The frame's reading of a parent-to-frame message (Reference §6.3 on the window, §6.5 on the port). */
function frameReads(m: unknown, ports: number, channel: 'window' | 'port', ctx: BridgeCases['context']): Verdict {
  const c = common(m, channel === 'window' ? ['hello'] : ['prefs', 'changes.result']);
  if ('fail' in c) return c.fail;
  const o = c.msg;
  const t = o['t'];
  if (t === 'hello') {
    const v = o['v'];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return refuse('type');
    return ports === 1 ? ACCEPT : refuse('port');
  }
  if (ports !== 0) return refuse('port');
  if (t === 'prefs') {
    for (const [k, v] of Object.entries(o)) {
      if (k === 't') continue;
      const allowed = (FRAME_PREF_VALUES as Readonly<Record<string, readonly string[]>>)[k] ?? [];
      if (!allowed.includes(v as string)) return refuse('pref');
    }
    return ACCEPT;
  }
  // changes.result: {sha, ranges, removedAfter?} or {sha, unavailable: true}, never both shapes.
  if (!Object.hasOwn(o, 'sha')) return refuse('keys');
  if (typeof o['sha'] !== 'string') return refuse('type');
  const hasRanges = Object.hasOwn(o, 'ranges');
  const hasUnavailable = Object.hasOwn(o, 'unavailable');
  if (hasRanges === hasUnavailable) return refuse('keys');
  if (hasUnavailable && Object.hasOwn(o, 'removedAfter')) return refuse('keys');
  if (hasUnavailable && o['unavailable'] !== true) return refuse('type');
  if (hasRanges && !Array.isArray(o['ranges'])) return refuse('type');
  if (Object.hasOwn(o, 'removedAfter') && !Array.isArray(o['removedAfter'])) return refuse('type');
  return o['sha'] === ctx.inFlightSha ? ACCEPT : refuse('sha');
}

describe('conformance/bridge-cases.json: its shape', () => {
  it('parses as JSON, names protocol 1, and is written with ASCII only (non-ASCII as visible escapes, ruling R6)', () => {
    expect(CASES.bridgeProtocol).toBe(BRIDGE_PROTOCOL);
    expect([...RAW].filter((ch) => ch.charCodeAt(0) > 0x7e)).toEqual([]);
    expect(RAW.endsWith('\n')).toBe(true);
  });

  it('declares exactly the closed list of reasons, and every verdict names one of them', () => {
    expect(CASES.reasons).toEqual(REASONS);
    const named = [...CASES.messages.map((c) => c), ...CASES.sequences.flatMap((s) => s.steps)];
    for (const c of named) {
      if (c.verdict === 'accept') expect(c.reason, JSON.stringify(c).slice(0, 120)).toBeUndefined();
      else {
        expect(c.verdict).toBe('refuse');
        expect(REASONS, JSON.stringify(c).slice(0, 120)).toContain(c.reason);
      }
    }
  });

  it('every message case has a unique label, a direction, and a channel exactly when it goes parent to frame', () => {
    const labels = CASES.messages.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const c of CASES.messages) {
      expect(['frame-to-parent', 'parent-to-frame']).toContain(c.direction);
      if (c.direction === 'parent-to-frame') expect(['window', 'port'], c.label).toContain(c.channel);
      else expect(c.channel, c.label).toBeUndefined();
      if (c.fill !== undefined) {
        for (const [k, f] of Object.entries(c.fill)) {
          expect(Object.hasOwn(c.message as object, k), `${c.label}: a filled key is absent from the message`).toBe(false);
          expect(Number.isInteger(f.times) && f.times > 0, c.label).toBe(true);
        }
      }
    }
  });

  it('a label that states a size states the size of the value it carries (UTF-8 bytes, code units)', () => {
    let stated = 0;
    for (const c of CASES.messages) {
      const bytes = /(\d+) UTF-8 bytes/.exec(c.label);
      const units = /(\d+) code units/.exec(c.label);
      if (bytes === null && units === null) continue;
      stated += 1;
      const m = messageOf(c) as Record<string, unknown>;
      const values = Object.entries(m).filter(([k, v]) => k !== 't' && typeof v === 'string').map(([, v]) => v as string);
      const fits = values.some((v) => (bytes === null || Buffer.byteLength(v, 'utf8') === Number(bytes[1])) && (units === null || v.length === Number(units[1])));
      expect(fits, c.label).toBe(true);
    }
    expect(stated).toBeGreaterThanOrEqual(10);
  });

  it('every timed sequence is monotone in time, with integer times from 0', () => {
    expect(CASES.sequences.length).toBeGreaterThanOrEqual(5);
    for (const s of CASES.sequences) {
      let last = 0;
      for (const step of s.steps) {
        expect(Number.isInteger(step.at) && step.at >= last, `${s.label} at ${step.at}`).toBe(true);
        expect(step.count === undefined || (Number.isInteger(step.count) && step.count >= 1), s.label).toBe(true);
        last = step.at;
      }
    }
  });

  it("the context's nonce and in-flight sha are in their grammars", () => {
    expect(CASES.context.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(isFullSha(CASES.context.inFlightSha)).toBe(true);
  });
});

describe('conformance/bridge-cases.json: the M8.5 battery is present', () => {
  const f2p = CASES.messages.filter((c) => c.direction === 'frame-to-parent');
  const has = (pred: (c: MessageCase, m: Record<string, unknown>) => boolean): boolean =>
    CASES.messages.some((c) => isPlain(messageOf(c)) && pred(c, messageOf(c) as Record<string, unknown>));

  it('hashes: a footnote, a slug, an anchor and D2.1a accepted; the empty id and each Reference §9 refusal refused', () => {
    for (const id of ['fnref1:1', 'fn1', 'heading-two', 'anchor_1', 'D2.1a', '\u4e2d\u6587']) {
      expect(has((c, m) => m['t'] === 'hash' && m['id'] === id && c.verdict === 'accept'), id).toBe(true);
    }
    for (const id of ['', '#x', 'a b', 'a/b', 'x'.repeat(257), '\u{1D400}'.repeat(129)]) {
      expect(has((c, m) => m['t'] === 'hash' && m['id'] === id && c.reason === 'hash'), JSON.stringify(id.slice(0, 8))).toBe(true);
    }
    expect(has((c, m) => m['t'] === 'hash' && m['id'] === 'x'.repeat(256) && c.verdict === 'accept')).toBe(true);
  });

  it("a delete is the store.set value 'null'; both pref:<name> keys and a doc:<field> key are accepted; others refused", () => {
    expect(has((c, m) => m['t'] === 'store.set' && m['value'] === 'null' && c.verdict === 'accept')).toBe(true);
    for (const k of PREF_KEYS) expect(has((c, m) => m['key'] === `pref:${k}` && c.verdict === 'accept'), k).toBe(true);
    expect(has((c, m) => m['key'] === 'doc:pos' && c.verdict === 'accept')).toBe(true);
    expect(has((c, m) => typeof m['key'] === 'string' && (m['key'] as string).startsWith('doc:') && m['key'] !== 'doc:pos' && c.verdict === 'accept')).toBe(true);
    expect(f2p.filter((c) => c.reason === 'store-key').length).toBeGreaterThanOrEqual(3);
  });

  it('changes.result with and without removedAfter, and unavailable, are accepted', () => {
    expect(has((c, m) => m['t'] === 'changes.result' && Object.hasOwn(m, 'removedAfter') && c.verdict === 'accept')).toBe(true);
    expect(has((c, m) => m['t'] === 'changes.result' && Object.hasOwn(m, 'ranges') && !Object.hasOwn(m, 'removedAfter') && c.verdict === 'accept')).toBe(true);
    expect(has((c, m) => m['t'] === 'changes.result' && m['unavailable'] === true && c.verdict === 'accept')).toBe(true);
  });

  it('each frame-to-parent op has an accepted case, and every reason but rate has a refused message case', () => {
    for (const t of FRAME_OPS) expect(has((c, m) => m['t'] === t && c.verdict === 'accept'), t).toBe(true);
    for (const t of PARENT_OPS) expect(has((c, m) => m['t'] === t && c.verdict === 'accept'), t).toBe(true);
    const used = new Set(CASES.messages.map((c) => c.reason));
    expect(REASONS.filter((r) => r !== 'rate' && !used.has(r))).toEqual([]);
  });

  it('a value cap is measured in UTF-8 bytes, not code units (a multi-byte case on each side of it)', () => {
    const copies = CASES.messages.filter((c) => isPlain(c.message) && c.message['t'] === 'copy' && c.fill !== undefined);
    const sizes = copies.map((c) => [utf8Bytes((messageOf(c) as { text: string }).text), (messageOf(c) as { text: string }).text.length, c.verdict] as const);
    expect(sizes.some(([b, u, v]) => b === BRIDGE_LIMITS.copyMaxBytes && u < b && v === 'accept')).toBe(true);
    expect(sizes.some(([b, u, v]) => b > BRIDGE_LIMITS.copyMaxBytes && u < BRIDGE_LIMITS.copyMaxBytes && v === 'refuse')).toBe(true);
  });
});

describe('conformance/bridge-cases.json: every message verdict agrees with the reference parser written here', () => {
  for (const c of CASES.messages) {
    it(c.label, () => {
      const m = messageOf(c);
      const got =
        c.direction === 'frame-to-parent'
          ? parentReads(m, c.ports ?? 0, CASES.context)
          : frameReads(m, c.ports ?? 0, c.channel ?? 'port', CASES.context);
      expect(got).toEqual(c.verdict === 'accept' ? ACCEPT : refuse(c.reason ?? ''));
    });
  }
});

// ───────── the reference bucket ─────────

/**
 * The parent's limits as token buckets (ruling R5), in integer milli-tokens so no rounding enters: a general bucket of
 * 40 refilled at 20 a second and a store.set bucket of 10 refilled at 10 a second, both full at ready (time 0), each
 * refilled continuously by the whole milliseconds elapsed. Every message takes one general token; a store.set also takes
 * one store token; a message is accepted only when every bucket it draws on holds a whole token, and a refused message
 * takes none. Each refusal counts toward refusalsToClose; the one that reaches it closes the bridge.
 */
function createBucket(): (at: number, t: string) => { accepted: boolean; closes: boolean } {
  const L = BRIDGE_LIMITS;
  let general = L.bucketCapacity * 1000;
  let store = L.storeSetBucketCapacity * 1000;
  let last = 0;
  let refusals = 0;
  return (at, t) => {
    const dt = at - last;
    last = at;
    general = Math.min(L.bucketCapacity * 1000, general + dt * L.bucketRefillPerSecond);
    store = Math.min(L.storeSetBucketCapacity * 1000, store + dt * L.storeSetRefillPerSecond);
    const isStore = t === 'store.set';
    if (general >= 1000 && (!isStore || store >= 1000)) {
      general -= 1000;
      if (isStore) store -= 1000;
      return { accepted: true, closes: false };
    }
    refusals += 1;
    return { accepted: false, closes: refusals === L.refusalsToClose };
  };
}

/** The strict sliding-window reading: at most bucketRefillPerSecond messages and storeSetRefillPerSecond store.set in any 1000 ms. */
function createStrictWindow(): (at: number, t: string) => boolean {
  const all: number[] = [];
  const stores: number[] = [];
  return (at, t) => {
    const recent = (xs: number[]): number => xs.filter((x) => at - x < 1000).length;
    if (recent(all) >= BRIDGE_LIMITS.bucketRefillPerSecond) return false;
    if (t === 'store.set' && recent(stores) >= BRIDGE_LIMITS.storeSetRefillPerSecond) return false;
    all.push(at);
    if (t === 'store.set') stores.push(at);
    return true;
  };
}

describe('conformance/bridge-cases.json: every timed sequence replays through the reference bucket', () => {
  it('states the bucket rules the reference implements', () => {
    const rules = CASES.sequenceRules.join(' ');
    for (const word of ['milli', 'continuous', 'refused message takes no token', 'refusalsToClose', 'store.set also takes']) {
      expect(rules, word).toContain(word);
    }
  });

  for (const s of CASES.sequences) {
    it(s.label, () => {
      const bucket = createBucket();
      for (const step of s.steps) {
        for (let i = 0; i < (step.count ?? 1); i += 1) {
          const t = String(step.message['t']);
          const r = bucket(step.at, t);
          const where = `${s.label}: ${t} at ${step.at} (#${i + 1})`;
          expect(r.accepted ? 'accept' : 'refuse', where).toBe(step.verdict);
          if (!r.accepted) expect(step.reason, where).toBe('rate');
          expect(r.closes, where).toBe(step.closes === true && i === (step.count ?? 1) - 1);
        }
      }
    });
  }

  it('every message of every sequence is itself an accepted message (only the rate refuses)', () => {
    for (const s of CASES.sequences) {
      for (const step of s.steps) expect(parentReads(step.message, 0, CASES.context), s.label).toEqual(ACCEPT);
    }
  });

  it("the frame's pacing sequence is accepted under the strict sliding-window reading too (FD11)", () => {
    const pacing = CASES.sequences.filter((s) => s.label.startsWith('frame pacing'));
    expect(pacing.length).toBeGreaterThanOrEqual(1);
    for (const s of pacing) {
      const strict = createStrictWindow();
      for (const step of s.steps) {
        expect(step.verdict).toBe('accept');
        for (let i = 0; i < (step.count ?? 1); i += 1) expect(strict(step.at, String(step.message['t'])), `${s.label} at ${step.at}`).toBe(true);
      }
    }
  });
});

describe("U9 16 in a window fits under both readings: the frame's worst case, simulated", () => {
  // The pacer (Reference §8.4) sends the next message as soon as the oldest of the last 16 is more than 1000 ms old, and
  // a store.set as soon as the oldest of the last 8 store.set is. Its densest legal output: 16 messages, 8 of them
  // store.set, every 1001 ms, all at one instant. Ten windows of that never meet a refusal under either reading.
  it('ten saturated windows: no refusal from the bucket or the strict window', () => {
    const L = BRIDGE_LIMITS;
    const bucket = createBucket();
    const strict = createStrictWindow();
    for (let w = 0; w < 10; w += 1) {
      const at = w * (L.frameWindowMs + 1);
      for (let i = 0; i < L.frameMaxPerWindow; i += 1) {
        const t = i < L.frameStoreSetMaxPerWindow ? 'store.set' : 'hash';
        expect(bucket(at, t).accepted, `window ${w} message ${i}`).toBe(true);
        expect(strict(at, t), `window ${w} message ${i}`).toBe(true);
      }
    }
  });

  it('the strict reading accepts a 17th message and a 9th store.set at one instant, and refuses the 21st and the 11th', () => {
    // The control: the frame's limits sit strictly below the parent's refusal points, so the margin above is real, not an
    // artefact of a simulation that refuses nothing.
    const L = BRIDGE_LIMITS;
    expect(L.frameMaxPerWindow).toBeLessThan(L.bucketRefillPerSecond);
    expect(L.frameStoreSetMaxPerWindow).toBeLessThan(L.storeSetRefillPerSecond);

    const messages = createStrictWindow();
    for (let i = 0; i < L.frameMaxPerWindow + 1; i += 1) expect(messages(0, 'hash'), `message ${i + 1}`).toBe(true);
    for (let i = L.frameMaxPerWindow + 1; i < L.bucketRefillPerSecond; i += 1) expect(messages(0, 'hash'), `message ${i + 1}`).toBe(true);
    expect(messages(0, 'hash'), `message ${L.bucketRefillPerSecond + 1}`).toBe(false);

    const stores = createStrictWindow();
    for (let i = 0; i < L.frameStoreSetMaxPerWindow + 1; i += 1) expect(stores(0, 'store.set'), `store.set ${i + 1}`).toBe(true);
    for (let i = L.frameStoreSetMaxPerWindow + 1; i < L.storeSetRefillPerSecond; i += 1) expect(stores(0, 'store.set'), `store.set ${i + 1}`).toBe(true);
    expect(stores(0, 'store.set'), `store.set ${L.storeSetRefillPerSecond + 1}`).toBe(false);
  });
});
