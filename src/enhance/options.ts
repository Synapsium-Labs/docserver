// Option normalization for enhance() and setEnhancementPrefs(): pure, touching no DOM and calling no host code
// that a plain data object would not run. Unknown keys and wrong types throw EnhanceError('invalid-options');
// enhance() calls this before it reserves anything, so a refused call leaves no trace. A key whose value is
// undefined counts as absent. The storage object is only checked to be an object here: its snapshot and set are
// read during startup, inside the startup operation (state.ts), so a storage hook can never run before the
// instance is reserved.
import { EnhanceError, type FrontListEntry, type Prefs, type ReaderStorage } from './types.js';

/** The options after normalization: every field present, absent ones as null or their default. */
export interface NormalizedOptions {
  readonly prefs: Readonly<Partial<Prefs>>;
  readonly storage: ReaderStorage | null;
  readonly storageKey: string | null;
  readonly info: NormalizedInfo | null;
  readonly folds: boolean;
  readonly signal: AbortSignal | null;
}

/** options.info, copied: undefined means the host left that field out. */
export interface NormalizedInfo {
  readonly title: string | null | undefined;
  readonly frontList: readonly FrontListEntry[] | null | undefined;
}

/** The values each pref accepts, the first being its default. */
export const PREF_VALUES = {
  theme: ['auto', 'light', 'dark'],
  width: ['standard', 'wide'],
  font: ['serif', 'sans'],
} as const;

const OPTION_KEYS: readonly string[] = ['prefs', 'storage', 'storageKey', 'info', 'folds', 'signal'];
const INFO_KEYS: readonly string[] = ['title', 'frontList'];

function invalid(message: string): EnhanceError {
  return new EnhanceError('invalid-options', `docreader: ${message}`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function checkKeys(where: string, v: Record<string, unknown>, allowed: readonly string[]): void {
  const unknown = Object.keys(v).filter((k) => !allowed.includes(k));
  if (unknown.length > 0) throw invalid(`${where} has unknown keys: ${unknown.join(', ')}`);
}

function isPrefName(k: string): k is keyof Prefs {
  return k === 'theme' || k === 'width' || k === 'font';
}

/** True when `v` is one of the values pref `name` accepts. */
export function isPrefValue<K extends keyof Prefs>(name: K, v: unknown): v is Prefs[K] {
  return (PREF_VALUES[name] as readonly unknown[]).includes(v);
}

/** A Partial<Prefs> from host input, or EnhanceError('invalid-options'). Undefined fields are left out. */
export function normalizePrefs(prefs: unknown, where = 'prefs'): Partial<Prefs> {
  if (!isRecord(prefs)) throw invalid(`${where} must be an object`);
  checkKeys(where, prefs, Object.keys(PREF_VALUES));
  const out: Partial<Prefs> = {};
  for (const [k, v] of Object.entries(prefs)) {
    if (v === undefined || !isPrefName(k)) continue;
    if (!isPrefValue(k, v)) throw invalid(`${where}.${k} must be one of ${PREF_VALUES[k].join(', ')}`);
    Object.assign(out, { [k]: v });
  }
  return out;
}

function normalizeFrontList(v: unknown): readonly FrontListEntry[] | null | undefined {
  if (v === undefined || v === null) return v;
  if (!Array.isArray(v)) throw invalid('info.frontList must be an array or null');
  return v.map((e: unknown, i) => {
    const ok =
      isRecord(e) &&
      typeof e['key'] === 'string' &&
      typeof e['list'] === 'boolean' &&
      Array.isArray(e['vals']) &&
      (e['vals'] as unknown[]).every((s) => typeof s === 'string');
    if (!ok) throw invalid(`info.frontList[${String(i)}] must be { key: string, list: boolean, vals: string[] }`);
    return { key: e['key'] as string, list: e['list'] as boolean, vals: [...(e['vals'] as string[])] };
  });
}

function normalizeInfo(v: unknown): NormalizedInfo {
  if (!isRecord(v)) throw invalid('info must be an object');
  checkKeys('info', v, INFO_KEYS);
  const title = v['title'];
  if (title !== undefined && title !== null && typeof title !== 'string') throw invalid('info.title must be a string or null');
  return { title, frontList: normalizeFrontList(v['frontList']) };
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

/** enhance()'s options, normalized, or EnhanceError('invalid-options'). */
export function normalizeOptions(options: unknown): NormalizedOptions {
  if (options === undefined) {
    return { prefs: {}, storage: null, storageKey: null, info: null, folds: true, signal: null };
  }
  if (!isRecord(options)) throw invalid('options must be an object');
  checkKeys('options', options, OPTION_KEYS);
  const { prefs, storage, storageKey, info, folds, signal } = options;
  if (storage !== undefined && (typeof storage !== 'object' || storage === null)) throw invalid('storage must be an object');
  if (storageKey !== undefined && (typeof storageKey !== 'string' || storageKey === '')) {
    throw invalid('storageKey must be a non-empty string');
  }
  if (folds !== undefined && typeof folds !== 'boolean') throw invalid('folds must be a boolean');
  if (signal !== undefined && !isSignal(signal)) throw invalid('signal must be an AbortSignal');
  return {
    prefs: prefs === undefined ? {} : normalizePrefs(prefs),
    storage: storage === undefined ? null : (storage as ReaderStorage),
    storageKey: storageKey === undefined ? null : storageKey,
    info: info === undefined ? null : normalizeInfo(info),
    folds: folds ?? true,
    signal: signal ?? null,
  };
}
