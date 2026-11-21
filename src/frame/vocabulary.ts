// The full check of `features.vocabulary` (docserver parity, Task 5, the bootstrap split). The bootstrap's validator (seed.ts)
// holds the field to a plain object, to keep its 32 KiB; the words are judged here, by frameDocument before the seed is
// written, and again by the reader's own normalizeOptions (src/enhance/options.ts) when the frame runs the layout: a seed
// whose vocabulary was changed after frameDocument fails the render there, and the host falls back as for any failed render.
// Host side only: nothing in the bootstrap, the guard or the reader's bundle imports this file.
import { FEATURE_KEYS, SEED_LIMITS } from './seed.js';

const isPlain = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const p: unknown = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
};

const onlyKeys = (o: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(o).every((k) => keys.includes(k));

/** A vocabulary word list: L2's wordList (src/enhance/options.ts), duplicates kept (L2 drops them). */
const isWordList = (v: unknown): boolean =>
  Array.isArray(v) &&
  v.length <= SEED_LIMITS.words &&
  v.every((w) => typeof w === 'string' && w.length >= 1 && w.length <= SEED_LIMITS.wordMaxCodeUnits && w.trim() === w);

/** An object of own word lists, only these keys. */
const isWordGroup = (v: unknown, keys: readonly string[]): boolean => isPlain(v) && onlyKeys(v, keys) && Object.values(v).every(isWordList);

/** True for a `features.vocabulary` the reader takes: a plain object of the vocabulary's own keys, each a word list or group. */
export function vocabularyOk(v: unknown): boolean {
  if (!isPlain(v)) return false;
  const groups: Readonly<Record<string, readonly string[]>> = FEATURE_KEYS.groups;
  const known = [...Object.keys(groups), ...FEATURE_KEYS.grammars, ...FEATURE_KEYS.lists];
  if (!onlyKeys(v, known)) return false;
  for (const [k, x] of Object.entries(v)) {
    const group = Object.hasOwn(groups, k) ? groups[k] : undefined;
    if (group !== undefined) {
      if (!isWordGroup(x, group)) return false;
    } else if ((FEATURE_KEYS.grammars as readonly string[]).includes(k)) {
      if (!(k === 'ids' && x === false) && !isWordGroup(x, ['prefixes'])) return false;
    } else if (!isWordList(x)) return false;
  }
  return true;
}
