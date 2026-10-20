// Option normalization for enhance() and setEnhancementPrefs(): pure, touching no DOM and calling no host code
// that a plain data object would not run. The options, `prefs`, `info`, `chrome`, `mermaid`, each `info.frontList`
// and `info.commits` entry, and the arrays inside them are read as own data properties only: an inherited property
// is not an option (it comes from a prototype, not from the host's object), an own property is read whether it is
// enumerable or not, and a getter is refused without being called (a getter on an entry or an array item reads as
// absent, which its shape check then refuses). An array is read item by item, by index (firstItems), never through
// a method or an iterator of its own, so a host array's own `map`, `every` or Symbol.iterator is never called, and
// a hole reads as absent rather than as an inherited index. Unknown own keys (in the options, `prefs`, `info`, `chrome` and
// `mermaid`) and wrong types throw EnhanceError('invalid-options'); enhance() calls this before it reserves
// anything, so a refused call leaves no trace. A key whose value is undefined counts as absent. The storage object
// is only checked to be an object here: its snapshot and set are read during startup, inside the startup operation
// (state.ts), so a storage hook can never run before the instance is reserved. The signal is a host object read
// through its own interface (`aborted`, its listeners).
//
// A function option (onLink, onHash, copy, changes, openVersion, itemLink, and mermaid.load) is an own data property
// holding a function. It is only checked with `typeof` here, never called, and no property of it is read, so no host
// code runs; it is kept with the object it came from (its receiver) in `callbacks`, which only host.ts calls, inside
// the instance's operations. Features never see the functions: they use `ctx.host`.
//
// Host data is bounded as it is read: numbers are finite integers within LIMITS; `info.commits` keeps its first
// LIMITS.commits entries and reads none past them; a subject is cut to LIMITS.subject code units (never inside a
// surrogate pair); a parents list keeps its first LIMITS.parents; `info.frontList` keeps its first LIMITS.frontList
// entries and each `vals` its first LIMITS.frontVals items (render()'s own bounds on meta.frontList, so its output is
// never cut); a key (`storageKey`, `posKey`) is at most LIMITS.key code units; a sha is 7 to 40 hex characters, or
// exactly 64 (a SHA-256 repository), in either case, and is kept in lower case, so two spellings of one commit
// compare equal. `info.commits` is the document's version history; it is not named `history`, a name the
// source walls refuse in src/enhance because it is the page's. Vocabulary options are a later version's (word
// lists, never patterns).
import type { BoundCallback, HostCallbacks } from './host.js';
import { EnhanceError, type CommitEntry, type FrontListEntry, type Prefs, type ReaderStorage } from './types.js';

/** Which parts of the chrome the reader builds (LD10). */
export interface ChromeFlags {
  readonly bar: boolean;
  readonly rail: boolean;
  readonly settings: boolean;
}

/** options.mermaid without its load (which is a host callback): null limits are the library's pinned defaults. */
export interface MermaidSettings {
  readonly maxTextSize: number | null;
  readonly maxEdges: number | null;
  /** Configuration keys a diagram's directive may not set, added to the library's own list. */
  readonly secure: readonly string[];
}

/** The options after normalization: every field present, absent ones as null or their default. */
export interface NormalizedOptions {
  readonly prefs: Readonly<Partial<Prefs>>;
  readonly storage: ReaderStorage | null;
  readonly storageKey: string | null;
  readonly info: NormalizedInfo | null;
  readonly folds: boolean;
  readonly signal: AbortSignal | null;
  /** The reading position's key: options.posKey, else storageKey, else null (no position persists). */
  readonly posKey: string | null;
  readonly keyboard: boolean;
  readonly chrome: ChromeFlags;
  readonly rules: boolean;
  /** The id to open the document at, without '#'; null for none. */
  readonly initialHash: string | null;
  /** Null: no drawing. */
  readonly mermaid: MermaidSettings | null;
  /** The host's functions, for host.ts alone: the lifecycle never puts them on a feature's context. */
  readonly callbacks: HostCallbacks;
}

/** The options as a feature reads them: the host's functions are reached only through `ctx.host`. */
export type FeatureOptions = Omit<NormalizedOptions, 'callbacks'>;

/** options.info, copied: undefined means the host left that field out. */
export interface NormalizedInfo {
  readonly title: string | null | undefined;
  readonly frontList: readonly FrontListEntry[] | null | undefined;
  readonly sha: string | null | undefined;
  readonly draft: boolean | undefined;
  readonly commits: readonly CommitEntry[] | null | undefined;
  readonly only: string | null | undefined;
}

/** The values each pref accepts, the first being its default. */
export const PREF_VALUES = {
  theme: ['auto', 'light', 'dark'],
  width: ['standard', 'wide'],
  font: ['serif', 'sans'],
  lens: ['all', 'product'],
} as const;

/** The names of the prefs, in PREF_VALUES order. */
export function prefNames(): (keyof Prefs)[] {
  return Object.keys(PREF_VALUES) as (keyof Prefs)[];
}

/** Every option enhance() accepts. */
export const OPTION_KEYS: readonly string[] = [
  'prefs', 'storage', 'storageKey', 'info', 'folds', 'signal',
  'posKey', 'keyboard', 'chrome', 'rules', 'initialHash',
  'onLink', 'onHash', 'copy', 'changes', 'openVersion', 'itemLink', 'mermaid',
];
const INFO_KEYS: readonly string[] = ['title', 'frontList', 'sha', 'draft', 'commits', 'only'];
const CHROME_KEYS: readonly string[] = ['bar', 'rail', 'settings'];
const MERMAID_KEYS: readonly string[] = ['load', 'maxTextSize', 'maxEdges', 'secure'];

/** The bounds on host data read from the options. */
export const LIMITS = {
  /** info.commits entries kept. */
  commits: 100,
  /** Code units of a commit subject. */
  subject: 200,
  /** Code units of a commit date. */
  date: 64,
  /** Parents kept per commit. */
  parents: 16,
  /** Code units of initialHash; a longer one is ignored. */
  hash: 1024,
  /** The largest mermaid.maxTextSize. */
  maxTextSize: 1_048_576,
  /** The largest mermaid.maxEdges. */
  maxEdges: 50_000,
  /** Keys in mermaid.secure. */
  secure: 64,
  /** info.frontList entries kept: render()'s count of front-matter keys. */
  frontList: 40,
  /** Items of one info.frontList entry's vals kept: render()'s count of list items. */
  frontVals: 300,
  /** Code units of storageKey and of posKey. */
  key: 1024,
} as const;

/** A sha: 7 to 40 hex characters (a short or full SHA-1 name), or exactly 64 (SHA-256), in either case (kept lower). */
const SHA = /^(?:[0-9a-f]{7,40}|[0-9a-f]{64})$/i;

/** A key of Mermaid's configuration, as `secure` lists them: a top-level name, 1 to 64 characters. */
const CONFIG_KEY = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

function invalid(message: string): EnhanceError {
  return new EnhanceError('invalid-options', `docreader: ${message}`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** True for a sha (see SHA). */
export function isSha(v: unknown): v is string {
  return typeof v === 'string' && SHA.test(v);
}

/**
 * The own data properties of `v`, by name: unknown names refused (enumerable or not), getters refused unread, and
 * inherited properties never read.
 */
function ownFields(where: string, v: object, allowed: readonly string[]): Record<string, unknown> {
  const names = Object.getOwnPropertyNames(v);
  const unknown = names.filter((k) => !allowed.includes(k));
  if (unknown.length > 0) throw invalid(`${where} has unknown keys: ${unknown.join(', ')}`);
  const out: Record<string, unknown> = {};
  for (const k of names) {
    const d = Object.getOwnPropertyDescriptor(v, k);
    if (d === undefined) continue;
    if (!('value' in d)) throw invalid(`${where}.${k} must be a plain value, not a getter`);
    out[k] = d.value;
  }
  return out;
}

/** One own data property of `v`, or undefined (absent, inherited or a getter, which is never called). */
function ownValue(v: object, k: string): unknown {
  const d = Object.getOwnPropertyDescriptor(v, k);
  return d !== undefined && 'value' in d ? d.value : undefined;
}

function isPrefName(k: string): k is keyof Prefs {
  return Object.hasOwn(PREF_VALUES, k);
}

/** True when `v` is one of the values pref `name` accepts. */
export function isPrefValue<K extends keyof Prefs>(name: K, v: unknown): v is Prefs[K] {
  return (PREF_VALUES[name] as readonly unknown[]).includes(v);
}

/** A Partial<Prefs> from host input, or EnhanceError('invalid-options'). Undefined fields are left out. */
export function normalizePrefs(prefs: unknown, where = 'prefs'): Partial<Prefs> {
  if (!isRecord(prefs)) throw invalid(`${where} must be an object`);
  const fields = ownFields(where, prefs, Object.keys(PREF_VALUES));
  const out: Partial<Prefs> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || !isPrefName(k)) continue;
    if (!isPrefValue(k, v)) throw invalid(`${where}.${k} must be one of ${PREF_VALUES[k].join(', ')}`);
    Object.assign(out, { [k]: v });
  }
  return out;
}

/** One info.frontList entry, copied: its vals read by index, the first LIMITS.frontVals of them. */
function frontEntry(e: unknown, i: number): FrontListEntry {
  const [key, list, vals] = isRecord(e) ? [ownValue(e, 'key'), ownValue(e, 'list'), ownValue(e, 'vals')] : [];
  const items = Array.isArray(vals) ? firstItems(vals, LIMITS.frontVals) : null;
  const strings: string[] = [];
  for (const s of items ?? []) if (typeof s === 'string') strings.push(s);
  if (typeof key !== 'string' || typeof list !== 'boolean' || items === null || strings.length !== items.length) {
    throw invalid(`info.frontList[${String(i)}] must be { key: string, list: boolean, vals: string[] }`);
  }
  return { key, list, vals: strings };
}

function normalizeFrontList(v: unknown): readonly FrontListEntry[] | null | undefined {
  if (v === undefined || v === null) return v;
  if (!Array.isArray(v)) throw invalid('info.frontList must be an array or null');
  return firstItems(v, LIMITS.frontList).map(frontEntry);
}

/** A sha, null, or undefined (left out); anything else is refused. A sha is kept in lower case. */
function shaOrNull(where: string, v: unknown): string | null | undefined {
  if (v === undefined || v === null) return v;
  if (!isSha(v)) throw invalid(`${where} must be 7 to 40 hex characters, or 64, or null`);
  return v.toLowerCase();
}

/** At most `n` code units of `s`, without cutting a surrogate pair in two. */
function cut(s: string, n: number): string {
  if (s.length <= n) return s;
  const last = s.charCodeAt(n - 1);
  return s.slice(0, last >= 0xd800 && last <= 0xdbff ? n - 1 : n);
}

/** The first `max` items of an array, by own data property: an index past them is never read. */
function firstItems(v: readonly unknown[], max: number): unknown[] {
  const out: unknown[] = [];
  const n = Math.min(v.length, max);
  for (let i = 0; i < n; i += 1) out.push(ownValue(v, String(i)));
  return out;
}

function commitEntry(e: unknown, i: number): CommitEntry {
  const where = `info.commits[${String(i)}]`;
  if (!isRecord(e)) throw invalid(`${where} must be { sha, subject, date, parents }`);
  const sha = ownValue(e, 'sha');
  const subject = ownValue(e, 'subject');
  const date = ownValue(e, 'date');
  const parents = ownValue(e, 'parents');
  if (!isSha(sha)) throw invalid(`${where}.sha must be 7 to 40 hex characters, or 64`);
  if (typeof subject !== 'string') throw invalid(`${where}.subject must be a string`);
  if (typeof date !== 'string' || date.length > LIMITS.date) {
    throw invalid(`${where}.date must be a string of at most ${String(LIMITS.date)} characters`);
  }
  if (!Array.isArray(parents)) throw invalid(`${where}.parents must be an array of shas`);
  const kept = firstItems(parents, LIMITS.parents).map((p, k) => {
    if (!isSha(p)) throw invalid(`${where}.parents[${String(k)}] must be 7 to 40 hex characters, or 64`);
    return p.toLowerCase();
  });
  return Object.freeze({ sha: sha.toLowerCase(), subject: cut(subject, LIMITS.subject), date, parents: Object.freeze(kept) });
}

function normalizeCommits(v: unknown): readonly CommitEntry[] | null | undefined {
  if (v === undefined || v === null) return v;
  if (!Array.isArray(v)) throw invalid('info.commits must be an array or null');
  return Object.freeze(firstItems(v, LIMITS.commits).map(commitEntry));
}

function normalizeInfo(v: unknown): NormalizedInfo {
  if (!isRecord(v)) throw invalid('info must be an object');
  const fields = ownFields('info', v, INFO_KEYS);
  const title = fields['title'];
  if (title !== undefined && title !== null && typeof title !== 'string') throw invalid('info.title must be a string or null');
  const draft = fields['draft'];
  if (draft !== undefined && typeof draft !== 'boolean') throw invalid('info.draft must be a boolean');
  return {
    title,
    frontList: normalizeFrontList(fields['frontList']),
    sha: shaOrNull('info.sha', fields['sha']),
    draft,
    commits: normalizeCommits(fields['commits']),
    only: shaOrNull('info.only', fields['only']),
  };
}

/** A storage key namespace: a non-empty string of at most LIMITS.key code units. */
function isKey(v: unknown): v is string {
  return typeof v === 'string' && v !== '' && v.length <= LIMITS.key;
}

function isSignal(v: unknown): v is AbortSignal {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { aborted?: unknown }).aborted === 'boolean' &&
    typeof (v as { addEventListener?: unknown }).addEventListener === 'function' &&
    typeof (v as { removeEventListener?: unknown }).removeEventListener === 'function'
  );
}

/** A boolean option: its default when left out. */
function flag(where: string, v: unknown, fallback: boolean): boolean {
  if (v === undefined) return fallback;
  if (typeof v !== 'boolean') throw invalid(`${where} must be a boolean`);
  return v;
}

/** A function option and its receiver, or null when left out. Only `typeof` touches it: it is never called here. */
function callback(where: string, v: unknown, self: object): BoundCallback | null {
  if (v === undefined) return null;
  if (typeof v !== 'function') throw invalid(`${where} must be a function`);
  return Object.freeze({ fn: v as (...args: never[]) => unknown, self });
}

function normalizeChrome(v: unknown): ChromeFlags {
  if (v === undefined) return Object.freeze({ bar: true, rail: true, settings: true });
  if (!isRecord(v)) throw invalid('chrome must be an object');
  const { bar, rail, settings } = ownFields('chrome', v, CHROME_KEYS);
  return Object.freeze({ bar: flag('chrome.bar', bar, true), rail: flag('chrome.rail', rail, true), settings: flag('chrome.settings', settings, true) });
}

/** A finite integer from 1 to `max`, or null when left out. */
function limit(where: string, v: unknown, max: number): number | null {
  if (v === undefined) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > max) {
    throw invalid(`${where} must be an integer from 1 to ${String(max)}`);
  }
  return v;
}

function normalizeSecure(v: unknown): readonly string[] {
  if (v === undefined) return Object.freeze([]);
  if (!Array.isArray(v)) throw invalid('mermaid.secure must be an array of configuration key names');
  if (v.length > LIMITS.secure) throw invalid(`mermaid.secure holds at most ${String(LIMITS.secure)} keys`);
  const out: string[] = [];
  firstItems(v, LIMITS.secure).forEach((k, i) => {
    if (typeof k !== 'string' || !CONFIG_KEY.test(k)) {
      throw invalid(`mermaid.secure[${String(i)}] must be a configuration key name of 1 to 64 letters, digits or _`);
    }
    if (!out.includes(k)) out.push(k);
  });
  return Object.freeze(out);
}

/** options.mermaid: its settings, and its load as a callback. */
function normalizeMermaid(v: unknown): { settings: MermaidSettings; load: BoundCallback } {
  if (!isRecord(v)) throw invalid('mermaid must be an object');
  const fields = ownFields('mermaid', v, MERMAID_KEYS);
  const load = callback('mermaid.load', fields['load'], v);
  if (load === null) throw invalid('mermaid.load must be a function');
  const settings = Object.freeze({
    maxTextSize: limit('mermaid.maxTextSize', fields['maxTextSize'], LIMITS.maxTextSize),
    maxEdges: limit('mermaid.maxEdges', fields['maxEdges'], LIMITS.maxEdges),
    secure: normalizeSecure(fields['secure']),
  });
  return { settings, load };
}

/** initialHash: the id, without '#'; empty or left out is none, and one over LIMITS.hash code units is ignored. */
function normalizeHash(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') throw invalid('initialHash must be a string or null');
  return v.length > LIMITS.hash ? null : v;
}

/** enhance()'s options, normalized, or EnhanceError('invalid-options'). */
export function normalizeOptions(options: unknown): NormalizedOptions {
  if (options === undefined) return normalizeOptions({});
  if (!isRecord(options)) throw invalid('options must be an object');
  const fields = ownFields('options', options, OPTION_KEYS);
  const { prefs, storage, storageKey, info, folds, signal, posKey } = fields;
  if (storage !== undefined && (typeof storage !== 'object' || storage === null)) throw invalid('storage must be an object');
  if (storageKey !== undefined && !isKey(storageKey)) throw invalid(`storageKey must be a non-empty string of at most ${String(LIMITS.key)} code units`);
  if (posKey !== undefined && !isKey(posKey)) throw invalid(`posKey must be a non-empty string of at most ${String(LIMITS.key)} code units`);
  if (folds !== undefined && typeof folds !== 'boolean') throw invalid('folds must be a boolean');
  if (signal !== undefined && !isSignal(signal)) throw invalid('signal must be an AbortSignal');
  const mermaid = fields['mermaid'] === undefined ? null : normalizeMermaid(fields['mermaid']);
  const callbacks: HostCallbacks = Object.freeze({
    copy: callback('copy', fields['copy'], options),
    changes: callback('changes', fields['changes'], options),
    openVersion: callback('openVersion', fields['openVersion'], options),
    onLink: callback('onLink', fields['onLink'], options),
    onHash: callback('onHash', fields['onHash'], options),
    itemLink: callback('itemLink', fields['itemLink'], options),
    mermaid: mermaid?.load ?? null,
  });
  return {
    prefs: prefs === undefined ? {} : normalizePrefs(prefs),
    storage: storage === undefined ? null : (storage as ReaderStorage),
    storageKey: storageKey === undefined ? null : storageKey,
    info: info === undefined ? null : normalizeInfo(info),
    folds: folds ?? true,
    signal: signal ?? null,
    posKey: posKey ?? storageKey ?? null,
    keyboard: flag('keyboard', fields['keyboard'], true),
    chrome: normalizeChrome(fields['chrome']),
    rules: flag('rules', fields['rules'], false),
    initialHash: normalizeHash(fields['initialHash']),
    mermaid: mermaid?.settings ?? null,
    callbacks,
  };
}
