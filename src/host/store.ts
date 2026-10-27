// `./host`'s store (docserver L3, Task 9; plan Reference §8.3 and §11.3, FD8; the first consumer's spec §4.4 and M8.15).
// The frame names a key only in bridge-key space, from the closed allow-list (`pref:<name>`, `doc:<field>`); the store
// builds every stored key itself, so the frame can name neither the prefix nor a document:
//   <prefix>pref:<name>               a reader-wide pref (PREF_KEYS)
//   <prefix>doc:<docKey>:<field>      a field of the current document only (DOC_FIELDS; `doc:pos` included)
//   <prefix>meta:written              the documents in the order they were last written, oldest first (JSON)
// A value is JSON text of at most BRIDGE_LIMITS.valueMaxBytes (64 KiB) UTF-8 bytes; the JSON literal 'null' deletes.
// Everything under the prefix (keys and values, in UTF-8 bytes) stays within storeBudgetBytes (1 MiB): past it, the
// least recently written documents' keys are evicted, inside the prefix only. The prefs, the current document and any
// other key under the prefix are never evicted; a write that cannot fit without touching them is refused and evicts
// nothing. A key outside the prefix is never read for its value, written or removed.
//
// The host's storage is untrusted: a value of the wrong type, a value that is not JSON or is over the cap, and a damaged
// order index are ignored, never thrown on; a storage method that throws makes that write fail (`store-error`) and that
// read absent. Import-inert: a factory only; each store keeps nothing but its prefix and docKey.
import { BRIDGE_LIMITS, DOC_FIELDS, isBridgeStoreKey, PREF_KEYS, type BridgeStoreKey } from '../frame/protocol.js';
import { hasControl, isJsonText, utf8Bytes } from './parse.js';

/** The part of the Web Storage interface the store uses. */
export interface HostStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

export type StoreRefusal = 'store-key' | 'oversize' | 'json' | 'no-doc' | 'budget' | 'store-error';
export type StoreWrite = { readonly ok: true } | { readonly ok: false; readonly reason: StoreRefusal };

export interface HostStore {
  /** Writes one `store.set`: `key` a bridge key, `value` JSON text; the literal 'null' deletes. */
  set(key: string, value: string): StoreWrite;
  /** This reader's stored values, in bridge-key space: both prefs, and the current document's fields. For the seed. */
  snapshot(): Partial<Record<BridgeStoreKey, string>>;
}

/** The prefix a host gets when it names none. */
export const DEFAULT_STORE_PREFIX = 'docreader:';

/** The longest prefix and document key, in UTF-16 code units. */
const PREFIX_MAX = 256;
const DOC_KEY_MAX = 1024;

/** The order index's name under the prefix: outside both bridge-key spaces (`pref:`, `doc:`). */
const INDEX_NAME = 'meta:written';

const ok: StoreWrite = Object.freeze({ ok: true });
const fail = (reason: StoreRefusal): StoreWrite => ({ ok: false, reason });

/** A document key: 1 to 1024 code units, no control. */
function isDocKey(v: unknown): v is string {
  return typeof v === 'string' && v.length >= 1 && v.length <= DOC_KEY_MAX && !hasControl(v);
}

/** What a scan of the storage finds under the prefix. */
interface Scan {
  /** UTF-8 bytes of every key and value under the prefix. */
  readonly usage: number;
  /** Each document's stored keys and their bytes, in the order the storage lists them. */
  readonly docs: Map<string, { readonly keys: string[]; bytes: number }>;
  /** The order index's stored text, or null. */
  readonly indexText: string | null;
  /** The bytes of one stored key and value, by key (for the key being replaced). */
  readonly entry: (key: string) => number;
}

/**
 * A store for one mount (Reference §11.1 step 4, §11.3). `prefix` defaults to 'docreader:'; `docKey` is the current
 * document's identity, and without it no per-document state is read or written. Throws TypeError or RangeError for a
 * prefix or docKey outside its grammar, before the storage is touched.
 */
export function createHostStore(storage: HostStorage, prefix: string = DEFAULT_STORE_PREFIX, docKey?: string): HostStore {
  if (typeof prefix !== 'string') throw new TypeError('docserver host: storePrefix must be a string');
  if (prefix.length < 1 || prefix.length > PREFIX_MAX || hasControl(prefix)) {
    throw new RangeError(`docserver host: storePrefix must be 1 to ${PREFIX_MAX} code units with no control character`);
  }
  if (docKey !== undefined && typeof docKey !== 'string') throw new TypeError('docserver host: docKey must be a string');
  if (docKey !== undefined && !isDocKey(docKey)) {
    throw new RangeError(`docserver host: docKey must be 1 to ${DOC_KEY_MAX} code units with no control character`);
  }

  const docPrefix = `${prefix}doc:`;
  const indexKey = `${prefix}${INDEX_NAME}`;
  const docStorageKey = (doc: string, field: string): string => `${docPrefix}${doc}:${field}`;

  /** The stored key of a bridge key; null for a document field when there is no current document. */
  const storageKeyOf = (key: BridgeStoreKey): string | null => {
    if (key.startsWith('pref:')) return `${prefix}${key}`;
    return docKey === undefined ? null : docStorageKey(docKey, key.slice('doc:'.length));
  };

  /** A stored key under docPrefix, read back as its document and field; null when it is no document field. */
  const docOf = (k: string): string | null => {
    const rest = k.slice(docPrefix.length);
    const cut = rest.lastIndexOf(':');
    if (cut < 1) return null;
    const doc = rest.slice(0, cut);
    return (DOC_FIELDS as readonly string[]).includes(rest.slice(cut + 1)) && isDocKey(doc) ? doc : null;
  };

  const scan = (): Scan => {
    const n = storage.length;
    if (!Number.isSafeInteger(n) || n < 0) throw new TypeError('docserver host: storage length');
    const keys: string[] = [];
    for (let i = 0; i < n; i += 1) {
      const k = storage.key(i);
      if (typeof k === 'string' && k.startsWith(prefix)) keys.push(k);
    }
    let usage = 0;
    let indexText: string | null = null;
    const docs = new Map<string, { keys: string[]; bytes: number }>();
    const entries = new Map<string, number>();
    for (const k of keys) {
      const v = storage.getItem(k);
      if (typeof v !== 'string') continue;
      const bytes = utf8Bytes(k) + utf8Bytes(v);
      usage += bytes;
      entries.set(k, bytes);
      if (k === indexKey) indexText = v;
      else if (k.startsWith(docPrefix)) {
        const doc = docOf(k);
        if (doc === null) continue;
        const d = docs.get(doc) ?? { keys: [], bytes: 0 };
        d.keys.push(k);
        d.bytes += bytes;
        docs.set(doc, d);
      }
    }
    return { usage, docs, indexText, entry: (k) => entries.get(k) ?? 0 };
  };

  /**
   * The stored documents, least recently written first. Documents the index does not name (it is damaged, or they
   * were written without it) come first, in the storage's order; then the index's, in its order. An index that is not
   * a JSON array of distinct document keys is ignored.
   */
  const recency = (s: Scan): string[] => {
    let listed: string[] = [];
    if (s.indexText !== null) {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(s.indexText);
      } catch {
        parsed = null;
      }
      if (Array.isArray(parsed) && parsed.every(isDocKey) && new Set(parsed).size === parsed.length) listed = parsed;
    }
    const present = listed.filter((d) => s.docs.has(d));
    const unlisted = [...s.docs.keys()].filter((d) => !present.includes(d));
    return [...unlisted, ...present];
  };

  const indexBytes = (order: readonly string[]): number =>
    order.length === 0 ? 0 : utf8Bytes(indexKey) + utf8Bytes(JSON.stringify(order));

  /** Stores the order index (or removes it when no document is left), only when its text changes. */
  const writeIndex = (s: Scan, order: readonly string[]): void => {
    if (order.length === 0) {
      if (s.indexText !== null) storage.removeItem(indexKey);
      return;
    }
    const text = JSON.stringify(order);
    if (text !== s.indexText) storage.setItem(indexKey, text);
  };

  const remove = (sk: string): StoreWrite => {
    storage.removeItem(sk);
    const s = scan();
    writeIndex(s, recency(s));
    return ok;
  };

  const write = (sk: string, value: string, isDoc: boolean): StoreWrite => {
    const s = scan();
    const order = recency(s);
    const nextOrder = (evicted: ReadonlySet<string>): string[] => {
      const kept = order.filter((d) => !evicted.has(d));
      return isDoc && docKey !== undefined ? [...kept.filter((d) => d !== docKey), docKey] : kept;
    };
    const base = s.usage - s.entry(sk) + utf8Bytes(sk) + utf8Bytes(value) - s.entry(indexKey);
    const evicted = new Set<string>();
    let freed = 0;
    const projected = (): number => base - freed + indexBytes(nextOrder(evicted));
    for (const doc of order) {
      if (projected() <= BRIDGE_LIMITS.storeBudgetBytes) break;
      if (doc === docKey) continue;
      evicted.add(doc);
      freed += s.docs.get(doc)?.bytes ?? 0;
    }
    if (projected() > BRIDGE_LIMITS.storeBudgetBytes) return fail('budget');
    for (const doc of evicted) for (const k of s.docs.get(doc)?.keys ?? []) storage.removeItem(k);
    storage.setItem(sk, value);
    if (isDoc || evicted.size > 0 || s.indexText !== null) writeIndex(s, nextOrder(evicted));
    return ok;
  };

  /** One stored value of this reader, or null: absent, not a string, over the cap, not JSON, or unreadable. */
  const read = (sk: string): string | null => {
    try {
      const v = storage.getItem(sk);
      if (typeof v !== 'string' || utf8Bytes(v) > BRIDGE_LIMITS.valueMaxBytes || !isJsonText(v)) return null;
      return v;
    } catch {
      return null;
    }
  };

  return {
    set(key, value) {
      if (!isBridgeStoreKey(key)) return fail('store-key');
      if (typeof value !== 'string') return fail('json');
      if (utf8Bytes(value) > BRIDGE_LIMITS.valueMaxBytes) return fail('oversize');
      if (!isJsonText(value)) return fail('json');
      const sk = storageKeyOf(key);
      if (sk === null) return fail('no-doc');
      try {
        return value === 'null' ? remove(sk) : write(sk, value, key.startsWith('doc:'));
      } catch {
        return fail('store-error');
      }
    },
    snapshot() {
      const out: Partial<Record<BridgeStoreKey, string>> = {};
      for (const name of PREF_KEYS) {
        const v = read(`${prefix}pref:${name}`);
        if (v !== null) out[`pref:${name}`] = v;
      }
      if (docKey !== undefined) {
        for (const field of DOC_FIELDS) {
          const v = read(docStorageKey(docKey, field));
          if (v !== null) out[`doc:${field}`] = v;
        }
      }
      return out;
    },
  };
}
