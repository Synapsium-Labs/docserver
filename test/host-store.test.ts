// `./host`'s store (docserver L3, Task 9; plan Reference §8.3 and §11.3, row L3.H5; mirrors the first consumer's M8.15).
// createHostStore builds every stored key itself: `<prefix>pref:<name>` for a reader-wide pref, and
// `<prefix>doc:<docKey>:<field>` for the current document only. A value is JSON of at most 64 KiB; the JSON literal
// 'null' deletes. Everything under the prefix stays within a 1 MiB budget: past it, the least recently written
// documents' keys are evicted, inside the prefix only, so a key of the host's own stays where it is and writable.
// The order of last writes is kept under the prefix too, as `<prefix>meta:written`. snapshot() reads back only this
// reader's keys, in bridge-key space, for the seed.
import { describe, expect, it } from 'vitest';
import { BRIDGE_LIMITS, DOC_FIELDS, PREF_KEYS } from '../src/frame/protocol.js';
import { createHostStore, DEFAULT_STORE_PREFIX, type HostStorage } from '../src/host/store.js';

/** A Storage stand-in: insertion-ordered keys, and an optional quota in UTF-16 code units (as browsers count it). */
class FakeStorage implements HostStorage {
  readonly map = new Map<string, string>();
  private readonly quota: number;
  constructor(quota = Number.POSITIVE_INFINITY) {
    this.quota = quota;
  }
  get length(): number {
    return this.map.size;
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    const used = [...this.map].reduce((n, [key, val]) => n + (key === k ? 0 : key.length + val.length), 0);
    if (used + k.length + v.length > this.quota) throw new Error('QuotaExceededError');
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

const utf8 = (s: string): number => Buffer.byteLength(s, 'utf8');

/** The UTF-8 bytes of every key and value under `prefix`. */
const usage = (s: FakeStorage, prefix: string): number =>
  [...s.map].filter(([k]) => k.startsWith(prefix)).reduce((n, [k, v]) => n + utf8(k) + utf8(v), 0);

/** A JSON string value of exactly `bytes` UTF-8 bytes. */
const jsonOf = (bytes: number, unit = 'a'): string => `"${unit.repeat(bytes - 2)}"`;

const P = DEFAULT_STORE_PREFIX;

describe('L3.H5 keys land under the prefix, built by the store', () => {
  it("the default prefix is 'docreader:'", () => {
    expect(P).toBe('docreader:');
  });

  it('pref:<name> lands at <prefix>pref:<name>; doc:<field> at <prefix>doc:<docKey>:<field>', () => {
    const s = new FakeStorage();
    const store = createHostStore(s, P, 'project-a:specs:x.md');
    expect(store.set('pref:prefs', '{"theme":"dark"}')).toEqual({ ok: true });
    expect(store.set('pref:ui', '{"tab":"index"}')).toEqual({ ok: true });
    expect(store.set('doc:pos', '{"id":"a"}')).toEqual({ ok: true });
    expect(store.set('doc:folds', '["a"]')).toEqual({ ok: true });
    expect(s.getItem('docreader:pref:prefs')).toBe('{"theme":"dark"}');
    expect(s.getItem('docreader:pref:ui')).toBe('{"tab":"index"}');
    expect(s.getItem('docreader:doc:project-a:specs:x.md:pos')).toBe('{"id":"a"}');
    expect(s.getItem('docreader:doc:project-a:specs:x.md:folds')).toBe('["a"]');
    expect([...s.map.keys()].filter((k) => !k.startsWith(P))).toEqual([]);
    expect([...s.map.keys()].filter((k) => k === 'pref:prefs' || k === 'doc:pos')).toEqual([]);
  });

  it('a host prefix is used as given', () => {
    const s = new FakeStorage();
    createHostStore(s, 'app.reader.', 'd').set('pref:prefs', '{}');
    createHostStore(s, 'app.reader.', 'd').set('doc:marks', '[]');
    expect([...s.map.keys()].sort()).toEqual(['app.reader.doc:d:marks', 'app.reader.meta:written', 'app.reader.pref:prefs']);
    expect(s.getItem('app.reader.meta:written')).toBe('["d"]');
  });

  it("'null' deletes the key; deleting an absent key is no error", () => {
    const s = new FakeStorage();
    const store = createHostStore(s, P, 'd');
    store.set('doc:marks', '[1]');
    store.set('pref:ui', '{}');
    expect(store.set('doc:marks', 'null')).toEqual({ ok: true });
    expect(store.set('pref:ui', 'null')).toEqual({ ok: true });
    expect(s.getItem('docreader:doc:d:marks')).toBeNull();
    expect(s.getItem('docreader:pref:ui')).toBeNull();
    expect(store.set('doc:seen', 'null')).toEqual({ ok: true });
  });

  it('a key outside the allow-list is refused and writes nothing anywhere', () => {
    const s = new FakeStorage();
    const store = createHostStore(s, P, 'd');
    for (const key of ['pref:lens', 'pref:', 'doc:', 'doc:nope', 'docreader:prefs', 'prefs', 'doc:pos:doc', 'doc:other-doc:pos', 'pref:prefs ', '__proto__']) {
      expect(store.set(key, '{}'), key).toEqual({ ok: false, reason: 'store-key' });
    }
    expect(s.map.size).toBe(0);
  });

  it('a value that is not JSON is refused and writes nothing', () => {
    const s = new FakeStorage();
    const store = createHostStore(s, P, 'd');
    for (const v of ['', '{tab: 1}', 'undefined', '{"a":1,}']) expect(store.set('pref:ui', v), v).toEqual({ ok: false, reason: 'json' });
    expect(s.map.size).toBe(0);
  });
});

describe('L3.H5 the 64 KiB cap', () => {
  it('a value of exactly 65536 UTF-8 bytes is written; 65537 is refused and leaves the old value', () => {
    const s = new FakeStorage();
    const store = createHostStore(s, P, 'd');
    expect(store.set('doc:seen', jsonOf(BRIDGE_LIMITS.valueMaxBytes))).toEqual({ ok: true });
    expect(store.set('doc:seen', jsonOf(BRIDGE_LIMITS.valueMaxBytes + 1))).toEqual({ ok: false, reason: 'oversize' });
    expect(s.getItem('docreader:doc:d:seen')).toBe(jsonOf(BRIDGE_LIMITS.valueMaxBytes));
  });

  it('the cap counts UTF-8 bytes, not code units', () => {
    const s = new FakeStorage();
    const store = createHostStore(s, P, 'd');
    const v = `"${'\u20ac'.repeat(21845)}"`;
    expect(v.length).toBeLessThan(BRIDGE_LIMITS.valueMaxBytes);
    expect(utf8(v)).toBe(65537);
    expect(store.set('pref:prefs', v)).toEqual({ ok: false, reason: 'oversize' });
    expect(s.map.size).toBe(0);
  });
});

describe('L3.H5 doc keys only for the current docKey', () => {
  it("two documents' stores never write each other's keys", () => {
    const s = new FakeStorage();
    createHostStore(s, P, 'doc-a').set('doc:pos', '{"a":1}');
    createHostStore(s, P, 'doc-b').set('doc:pos', '{"b":1}');
    expect(s.getItem('docreader:doc:doc-a:pos')).toBe('{"a":1}');
    expect(s.getItem('docreader:doc:doc-b:pos')).toBe('{"b":1}');
  });

  it('a frame-supplied doc key for another document is refused; doc:<field> lands under the current doc', () => {
    const s = new FakeStorage();
    const store = createHostStore(s, P, 'doc-a');
    expect(store.set('doc:doc-b:pos', '{}')).toEqual({ ok: false, reason: 'store-key' });
    expect(store.set('doc:doc-b', '{}')).toEqual({ ok: false, reason: 'store-key' });
    expect(store.set('doc:pos', '{"x":1}')).toEqual({ ok: true });
    expect([...s.map.keys()].sort()).toEqual(['docreader:doc:doc-a:pos', 'docreader:meta:written']);
  });

  it('with no docKey, a doc write is refused and writes nothing; prefs still land', () => {
    const s = new FakeStorage();
    const store = createHostStore(s, P);
    for (const f of DOC_FIELDS) expect(store.set(`doc:${f}`, '{}'), f).toEqual({ ok: false, reason: 'no-doc' });
    expect(store.set('pref:prefs', '{}')).toEqual({ ok: true });
    expect([...s.map.keys()]).toEqual(['docreader:pref:prefs']);
  });

  it('a prefix or docKey outside its grammar throws before anything is read', () => {
    const s = new FakeStorage();
    expect(() => createHostStore(s, '')).toThrow(RangeError);
    expect(() => createHostStore(s, 'x'.repeat(257))).toThrow(RangeError);
    expect(() => createHostStore(s, 'a\nb')).toThrow(RangeError);
    expect(() => createHostStore(s, 1 as unknown as string)).toThrow(TypeError);
    expect(() => createHostStore(s, P, '')).toThrow(RangeError);
    expect(() => createHostStore(s, P, 'x'.repeat(1025))).toThrow(RangeError);
    expect(() => createHostStore(s, P, 'a\u0000b')).toThrow(RangeError);
    expect(() => createHostStore(s, P, {} as unknown as string)).toThrow(TypeError);
    expect(() => createHostStore(s, P, 'x'.repeat(1024))).not.toThrow();
  });
});

describe('L3.H5 snapshot(): this reader\'s keys only, in bridge-key space', () => {
  it('reads both prefs and every field of the current document, and nothing else', () => {
    const s = new FakeStorage();
    s.setItem('docreader:pref:prefs', '{"theme":"dark"}');
    s.setItem('docreader:pref:ui', '{}');
    s.setItem('docreader:pref:lens', '"x"');
    s.setItem('docreader:doc:doc-a:pos', '{"id":"a"}');
    s.setItem('docreader:doc:doc-a:folds', '[]');
    s.setItem('docreader:doc:doc-a:nope', '1');
    s.setItem('docreader:doc:doc-b:pos', '{"id":"b"}');
    s.setItem('docreader:doc:doc-a:x:pos', '{"id":"ax"}');
    s.setItem('app.snapshot.v1', '{}');
    s.setItem('docreader:prefs', '{}');
    expect(createHostStore(s, P, 'doc-a').snapshot()).toEqual({
      'pref:prefs': '{"theme":"dark"}',
      'pref:ui': '{}',
      'doc:pos': '{"id":"a"}',
      'doc:folds': '[]',
    });
    expect(createHostStore(s, P).snapshot()).toEqual({ 'pref:prefs': '{"theme":"dark"}', 'pref:ui': '{}' });
  });

  it('skips a stored value that is not JSON, is over the cap, or is not a string', () => {
    const s = new FakeStorage();
    s.setItem('docreader:pref:prefs', '{bad');
    s.setItem('docreader:pref:ui', jsonOf(BRIDGE_LIMITS.valueMaxBytes + 1));
    s.setItem('docreader:doc:d:pos', jsonOf(BRIDGE_LIMITS.valueMaxBytes));
    const odd: HostStorage = { ...s, length: 0, key: () => null, getItem: (k) => (k.endsWith(':seen') ? (1 as unknown as string) : s.getItem(k)), setItem: () => undefined, removeItem: () => undefined };
    expect(createHostStore(s, P, 'd').snapshot()).toEqual({ 'doc:pos': jsonOf(BRIDGE_LIMITS.valueMaxBytes) });
    expect(createHostStore(odd, P, 'd').snapshot()).toEqual({ 'doc:pos': jsonOf(BRIDGE_LIMITS.valueMaxBytes) });
  });

  it('every allow-listed key at its cap still fits the budget the seed allows', () => {
    const s = new FakeStorage();
    const store = createHostStore(s, P, 'd');
    for (const k of PREF_KEYS) expect(store.set(`pref:${k}`, jsonOf(BRIDGE_LIMITS.valueMaxBytes))).toEqual({ ok: true });
    for (const f of DOC_FIELDS) expect(store.set(`doc:${f}`, jsonOf(BRIDGE_LIMITS.valueMaxBytes))).toEqual({ ok: true });
    const snap = createHostStore(s, P, 'd').snapshot();
    expect(Object.keys(snap).length).toBe(PREF_KEYS.length + DOC_FIELDS.length);
    expect(Object.values(snap).reduce((n, v) => n + utf8(v ?? ''), 0)).toBeLessThanOrEqual(BRIDGE_LIMITS.storeBudgetBytes);
  });

  it('a store that throws reads as empty, never as a throw', () => {
    const broken: HostStorage = {
      length: 0,
      key: () => null,
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(createHostStore(broken, P, 'd').snapshot()).toEqual({});
  });
});

describe('L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only', () => {
  it("a flood across documents stays within the budget, evicts only the prefix's doc keys, and leaves the host's key writable", () => {
    const s = new FakeStorage(5 * 1024 * 1024);
    s.setItem('app.snapshot.v1', jsonOf(200_000));
    s.setItem('docreader-other', '"kept"');
    const prefs = createHostStore(s, P);
    expect(prefs.set('pref:prefs', jsonOf(60_000))).toEqual({ ok: true });
    for (let d = 0; d < 60; d += 1) {
      const store = createHostStore(s, P, `doc-${d}`);
      for (const f of ['pos', 'folds', 'marks']) expect(store.set(`doc:${f}`, jsonOf(BRIDGE_LIMITS.valueMaxBytes)), `doc-${d} ${f}`).toEqual({ ok: true });
      expect(usage(s, P), `after doc-${d}`).toBeLessThanOrEqual(BRIDGE_LIMITS.storeBudgetBytes);
    }
    expect(s.getItem('app.snapshot.v1')).toBe(jsonOf(200_000));
    expect(s.getItem('docreader-other')).toBe('"kept"');
    expect(s.getItem('docreader:pref:prefs')).toBe(jsonOf(60_000));
    expect(() => s.setItem('app.snapshot.v1', jsonOf(300_000))).not.toThrow();
    const docs = new Set([...s.map.keys()].filter((k) => k.startsWith('docreader:doc:')).map((k) => k.split(':')[2]));
    expect(docs.has('doc-59')).toBe(true);
    expect(docs.has('doc-0')).toBe(false);
    expect([...docs].every((d) => Number(d?.slice(4)) >= 50)).toBe(true);
  });

  it('a document written again is kept over one written in between', () => {
    const s = new FakeStorage();
    const big = jsonOf(BRIDGE_LIMITS.valueMaxBytes);
    const a = createHostStore(s, P, 'a');
    const b = createHostStore(s, P, 'b');
    for (const f of DOC_FIELDS) expect(a.set(`doc:${f}`, big), `a ${f}`).toEqual({ ok: true });
    for (const f of DOC_FIELDS) expect(b.set(`doc:${f}`, big), `b ${f}`).toEqual({ ok: true });
    a.set('doc:pos', '{"again":1}');
    const c = createHostStore(s, P, 'c');
    for (const f of DOC_FIELDS) expect(c.set(`doc:${f}`, big), `c ${f}`).toEqual({ ok: true });
    const docs = new Set([...s.map.keys()].filter((k) => k.startsWith('docreader:doc:')).map((k) => k.split(':')[2]));
    expect([...docs].sort()).toEqual(['a', 'c']);
    expect(usage(s, P)).toBeLessThanOrEqual(BRIDGE_LIMITS.storeBudgetBytes);
  });

  it('the current document is never evicted to make room for itself, and prefs are never evicted', () => {
    const s = new FakeStorage();
    const big = jsonOf(BRIDGE_LIMITS.valueMaxBytes);
    const store = createHostStore(s, P, 'only');
    for (const k of PREF_KEYS) store.set(`pref:${k}`, big);
    for (const f of DOC_FIELDS) expect(store.set(`doc:${f}`, big), f).toEqual({ ok: true });
    for (const f of DOC_FIELDS) expect(s.getItem(`docreader:doc:only:${f}`)).toBe(big);
    for (const k of PREF_KEYS) expect(s.getItem(`docreader:pref:${k}`)).toBe(big);
  });

  it("a document written least recently keeps its other fields when it writes again past the budget: another goes", () => {
    const s = new FakeStorage();
    const big = jsonOf(BRIDGE_LIMITS.valueMaxBytes);
    s.setItem('docreader:host-own', jsonOf(280_000));
    const a = createHostStore(s, P, 'a');
    const b = createHostStore(s, P, 'b');
    for (const f of ['pos', 'folds', 'marks', 'seen', 'outline']) a.set(`doc:${f}`, big);
    for (const f of DOC_FIELDS) b.set(`doc:${f}`, big);
    expect(usage(s, P)).toBeGreaterThan(BRIDGE_LIMITS.storeBudgetBytes - BRIDGE_LIMITS.valueMaxBytes);
    expect(a.set('doc:ixfold', big)).toEqual({ ok: true });
    for (const f of DOC_FIELDS) expect(s.getItem(`docreader:doc:a:${f}`), f).toBe(big);
    for (const f of DOC_FIELDS) expect(s.getItem(`docreader:doc:b:${f}`), f).toBeNull();
    expect(usage(s, P)).toBeLessThanOrEqual(BRIDGE_LIMITS.storeBudgetBytes);
  });

  it('a write that cannot fit without evicting keys it may not touch is refused, and evicts nothing', () => {
    const s = new FakeStorage();
    const big = jsonOf(BRIDGE_LIMITS.valueMaxBytes);
    for (let i = 0; i < 15; i += 1) s.setItem(`docreader:host-own-${i}`, big);
    const other = createHostStore(s, P, 'other');
    s.removeItem('docreader:host-own-14');
    expect(other.set('doc:pos', '{}')).toEqual({ ok: true });
    s.setItem('docreader:host-own-14', big);
    const store = createHostStore(s, P, 'd');
    expect(store.set('doc:seen', big)).toEqual({ ok: false, reason: 'budget' });
    expect(s.getItem('docreader:doc:other:pos')).toBe('{}');
    expect(s.getItem('docreader:doc:d:seen')).toBeNull();
    for (let i = 0; i < 15; i += 1) expect(s.getItem(`docreader:host-own-${i}`)).toBe(big);
  });

  it('a damaged index of write order is rebuilt, never trusted or thrown on', () => {
    const big = jsonOf(BRIDGE_LIMITS.valueMaxBytes);
    for (const bad of ['{', '"x"', '[1,2]', '{"__proto__":1}', JSON.stringify(['ghost', 'ghost']), 'null']) {
      const s = new FakeStorage();
      for (let d = 0; d < 20; d += 1) {
        const store = createHostStore(s, P, `doc-${d}`);
        for (const f of ['pos', 'folds']) expect(store.set(`doc:${f}`, big), `${bad} doc-${d}`).toEqual({ ok: true });
        if (d === 5) {
          const idx = [...s.map.keys()].filter((k) => k.startsWith(P) && !k.startsWith(`${P}doc:`) && !k.startsWith(`${P}pref:`));
          for (const k of idx) s.setItem(k, bad);
        }
        expect(usage(s, P), `${bad} doc-${d}`).toBeLessThanOrEqual(BRIDGE_LIMITS.storeBudgetBytes);
      }
      expect(s.getItem('docreader:doc:doc-19:pos')).toBe(big);
    }
  });

  it('an index that names a stored document twice is ignored: that document is not counted as freed twice', () => {
    const s = new FakeStorage();
    createHostStore(s, P, 'a').set('doc:pos', jsonOf(40_000));
    createHostStore(s, P, 'b').set('doc:pos', jsonOf(BRIDGE_LIMITS.valueMaxBytes));
    s.setItem(`${P}meta:written`, JSON.stringify(['a', 'a', 'b']));
    const pad = BRIDGE_LIMITS.storeBudgetBytes - 500 - usage(s, P) - utf8(`${P}host-own`);
    s.setItem(`${P}host-own`, 'x'.repeat(pad));
    expect(usage(s, P)).toBe(BRIDGE_LIMITS.storeBudgetBytes - 500);
    expect(createHostStore(s, P, 'c').set('doc:pos', jsonOf(BRIDGE_LIMITS.valueMaxBytes))).toEqual({ ok: true });
    expect(usage(s, P)).toBeLessThanOrEqual(BRIDGE_LIMITS.storeBudgetBytes);
    expect(s.getItem(`${P}doc:a:pos`)).toBeNull();
    expect(s.getItem(`${P}doc:b:pos`)).toBeNull();
    expect(s.getItem(`${P}host-own`)).toBe('x'.repeat(pad));
  });

  it("a large key outside the prefix counts nothing against the budget and is never read for its value", () => {
    const s = new FakeStorage();
    s.setItem('app.big', jsonOf(900_000));
    const read: string[] = [];
    const getItem = s.getItem.bind(s);
    s.getItem = (k: string): string | null => {
      read.push(k);
      return getItem(k);
    };
    const store = createHostStore(s, P, 'd');
    for (const f of ['pos', 'folds', 'marks', 'seen']) expect(store.set(`doc:${f}`, jsonOf(BRIDGE_LIMITS.valueMaxBytes)), f).toEqual({ ok: true });
    for (const f of ['pos', 'folds', 'marks', 'seen']) expect(getItem(`${P}doc:d:${f}`), f).toBe(jsonOf(BRIDGE_LIMITS.valueMaxBytes));
    expect(store.snapshot()['doc:pos']).toBe(jsonOf(BRIDGE_LIMITS.valueMaxBytes));
    expect(read.length).toBeGreaterThan(0);
    expect(read.filter((k) => !k.startsWith(P))).toEqual([]);
    expect(getItem('app.big')).toBe(jsonOf(900_000));
  });

  it('a storage that throws on write gives store-error, never a throw', () => {
    const s = new FakeStorage(10);
    expect(createHostStore(s, P, 'd').set('doc:pos', jsonOf(100))).toEqual({ ok: false, reason: 'store-error' });
    const throwing: HostStorage = {
      get length(): number {
        throw new Error('x');
      },
      key: () => null,
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => {
        throw new Error('x');
      },
    };
    expect(createHostStore(throwing, P, 'd').set('doc:pos', '{}')).toEqual({ ok: false, reason: 'store-error' });
    expect(createHostStore(throwing, P, 'd').set('doc:pos', 'null')).toEqual({ ok: false, reason: 'store-error' });
  });
});
