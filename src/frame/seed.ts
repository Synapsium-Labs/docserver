// The seed: the one data block of the srcdoc (docserver L3; design §4.2). frameDocument writes it with serializeSeed,
// and the bootstrap, which bundles this file, reads it back with validateSeed. Pure: no DOM, no clock, no I/O.
//
// Prototype scope: schema 1's subset {s, nonce, html, title, lang, initialHash, prefs, mermaid}. The plan adds frontList,
// version, images, snapshot, features, mermaid and bridge, each as a closed key.
import { SEED_SCHEMA } from './protocol.js';

/** The reader prefs the bridge carries: theme, width and font (the lens stays frame-local). */
export interface SeedPrefs {
  readonly theme?: 'auto' | 'light' | 'dark';
  readonly width?: 'standard' | 'wide';
  readonly font?: 'serif' | 'sans';
}

/** Mermaid's caps when the frame draws diagrams; null when no Mermaid script is inlined. */
export interface SeedMermaid {
  readonly maxTextSize?: number;
  readonly maxEdges?: number;
}

export interface Seed {
  readonly s: 1;
  readonly nonce: string;
  readonly html: string;
  readonly title: string | null;
  readonly lang: string;
  readonly initialHash: string | null;
  readonly prefs: SeedPrefs;
  readonly mermaid: SeedMermaid | null;
}

/** A nonce: 128 bits as 32 lower-case hex digits. */
export const NONCE_SOURCE = '^[0-9a-f]{32}$';
const NONCE = new RegExp(NONCE_SOURCE);

/** A language tag, loosely BCP 47: a 2 to 8 letter primary tag, then subtags of 1 to 8 letters or digits. */
export const LANG = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

/** The seed's keys, sorted: schema 1 has exactly these. */
export const SEED_KEYS: readonly string[] = ['html', 'initialHash', 'lang', 'mermaid', 'nonce', 'prefs', 's', 'title'];

/** Keys refused at any depth: they could reach a prototype through a careless merge. */
const PROTO_KEYS: readonly string[] = ['__proto__', 'constructor', 'prototype'];

const PREF_VALUES: Readonly<Record<string, readonly string[]>> = {
  theme: ['auto', 'light', 'dark'],
  width: ['standard', 'wide'],
  font: ['serif', 'sans'],
};

/** The longest initialHash, in code units (BRIDGE_LIMITS.hashMaxCodeUnits). frameDocument seeds a longer one as null. */
export const HASH_MAX_CODE_UNITS = 256;

/** True for a nonce of the grammar NONCE_SOURCE. */
export function isNonce(v: unknown): v is string {
  return typeof v === 'string' && NONCE.test(v);
}

/**
 * The seed as the text of a `<script type="application/json">`: JSON, with `<`, `>`, `&`, U+2028 and U+2029 written as
 * backslash-u escapes. The text therefore holds no `<`, so it can neither end its element nor enter a script-data
 * escape state, and JSON.parse gives back exactly the value written.
 */
export function serializeSeed(seed: Seed): string {
  return JSON.stringify(seed)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const isPlain = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const p: unknown = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
};

/** True when `v` holds a proto key, or a non-plain object, at any depth. */
function hostile(v: unknown, depth: number): boolean {
  if (depth > 32) return true;
  if (Array.isArray(v)) return v.some((x) => hostile(x, depth + 1));
  if (typeof v !== 'object' || v === null) return false;
  if (!isPlain(v)) return true;
  for (const k of Object.keys(v)) {
    if (PROTO_KEYS.includes(k) || hostile(v[k], depth + 1)) return true;
  }
  return false;
}

const sameKeys = (o: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(o).sort();
  return own.length === keys.length && own.every((k, i) => k === keys[i]);
};

export type SeedCheck =
  | { readonly ok: true; readonly seed: Seed }
  /** `nonce` is the seed's nonce when it was readable (the frame can then report the failure), else null. */
  | { readonly ok: false; readonly nonce: string | null; readonly why: string };

/**
 * Check a parsed seed: plain objects only, no proto key at any depth, exactly schema 1's keys, the nonce grammar, and
 * each field's type and grammar.
 */
export function validateSeed(v: unknown): SeedCheck {
  if (!isPlain(v)) return { ok: false, nonce: null, why: 'not a plain object' };
  const nonce = Object.hasOwn(v, 'nonce') && isNonce(v['nonce']) ? v['nonce'] : null;
  const fail = (why: string): SeedCheck => ({ ok: false, nonce, why });
  if (nonce === null) return fail('nonce');
  if (hostile(v, 0)) return fail('a proto key or a non-plain object');
  if (!sameKeys(v, SEED_KEYS)) return fail('keys');
  if (v['s'] !== SEED_SCHEMA) return fail('schema');
  if (typeof v['html'] !== 'string') return fail('html');
  const title = v['title'];
  if (title !== null && typeof title !== 'string') return fail('title');
  const lang = v['lang'];
  if (typeof lang !== 'string' || !LANG.test(lang)) return fail('lang');
  const hash = v['initialHash'];
  if (hash !== null && (typeof hash !== 'string' || hash.length === 0 || hash.length > HASH_MAX_CODE_UNITS)) return fail('initialHash');
  const prefs = v['prefs'];
  if (!isPlain(prefs)) return fail('prefs');
  for (const k of Object.keys(prefs)) {
    const allowed = Object.hasOwn(PREF_VALUES, k) ? PREF_VALUES[k] : undefined;
    if (allowed === undefined || !allowed.includes(prefs[k] as string)) return fail(`prefs.${k}`);
  }
  const mermaid = v['mermaid'];
  if (mermaid !== null) {
    if (!isPlain(mermaid)) return fail('mermaid');
    for (const k of Object.keys(mermaid)) {
      const n = mermaid[k];
      if ((k !== 'maxTextSize' && k !== 'maxEdges') || typeof n !== 'number' || !Number.isInteger(n) || n < 1) return fail(`mermaid.${k}`);
    }
  }
  return {
    ok: true,
    seed: { s: 1, nonce, html: v['html'], title, lang, initialHash: hash, prefs: prefs as SeedPrefs, mermaid: mermaid as SeedMermaid | null },
  };
}
