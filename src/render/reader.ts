// The checked form of `RenderOptions.reader` (docserver parity, Tasks 4 and 7): a ReaderVocabulary read as data and
// validated by the rules the reader applies to `features.vocabulary` (src/enhance/options.ts: ownFields, wordList,
// wordGroup, grammar). A TypeError names the first thing wrong. test/render-print.test.ts holds the two validators equal
// on a table of good and bad shapes. Pure: it reads own data properties only, never a getter, and calls nothing of the host's.
import type { ReaderVocabulary } from './types.js';

/** The most words in a list, and the longest word: src/enhance/options.ts's LIMITS.words and LIMITS.word. */
export const LIST_MAX = 200;
export const WORD_MAX = 64;

/** A vocabulary as checked: each list or group the host gave, copied (duplicates dropped); `rules` as given. */
export interface CheckedReader {
  readonly status?: Readonly<Partial<Record<'ok' | 'wait' | 'no' | 'info', readonly string[]>>>;
  readonly attention?: Readonly<Partial<Record<'status' | 'who' | 'question' | 'openAnswers' | 'blocking' | 'risk' | 'openStatus', readonly string[]>>>;
  readonly plan?: Readonly<Partial<Record<'task' | 'step' | 'who', readonly string[]>>>;
  readonly ids?: false | { readonly prefixes?: readonly string[] };
  readonly ruleIds?: { readonly prefixes?: readonly string[] };
  readonly statusHeaders?: readonly string[];
  readonly rulingHeaders?: readonly string[];
  readonly qualifiers?: readonly string[];
  readonly addressees?: readonly string[];
  readonly itemFields?: readonly string[];
  readonly itemHeadings?: readonly string[];
  /** Print mode prints rule paragraphs and the rules index only when true. Default false. */
  readonly rules: boolean;
}

const KEYS: readonly string[] = [
  'status', 'statusHeaders', 'rulingHeaders', 'attention', 'ids', 'ruleIds', 'qualifiers', 'plan', 'addressees', 'itemFields', 'itemHeadings', 'rules',
];
const STATUS_KEYS = ['ok', 'wait', 'no', 'info'] as const;
const ATTENTION_KEYS = ['status', 'who', 'question', 'openAnswers', 'blocking', 'risk', 'openStatus'] as const;
const PLAN_KEYS = ['task', 'step', 'who'] as const;
const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemFields', 'itemHeadings'] as const;

const bad = (message: string): TypeError => new TypeError(`render: ${message}`);

/** A plain object: an ordinary prototype or none. */
function isPlain(v: unknown): v is object {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** The own data properties of `v`: an unknown name or a getter is refused unread. */
function ownFields(where: string, v: object, allowed: readonly string[]): Record<string, unknown> {
  const names = Object.getOwnPropertyNames(v);
  const unknown = names.filter((k) => !allowed.includes(k));
  if (unknown.length > 0) throw bad(`${where} has an unknown key ${unknown.join(', ')}`);
  const out: Record<string, unknown> = {};
  for (const k of names) {
    const d = Object.getOwnPropertyDescriptor(v, k);
    if (d === undefined) continue;
    if (!('value' in d)) throw bad(`${where}.${k} must be a plain value, not a getter`);
    out[k] = d.value;
  }
  return out;
}

/** One word list: at most LIST_MAX words of 1 to WORD_MAX code units with no outer white space, read by index; duplicates dropped. */
function wordList(where: string, v: unknown): readonly string[] {
  if (!Array.isArray(v) || v.length > LIST_MAX) throw bad(`${where} must be a list of at most ${String(LIST_MAX)} words`);
  const out: string[] = [];
  for (let i = 0; i < v.length; i += 1) {
    const w: unknown = Object.getOwnPropertyDescriptor(v, String(i))?.value;
    if (typeof w !== 'string' || w.length < 1 || w.length > WORD_MAX || w.trim() !== w) {
      throw bad(`${where} holds a word that is not 1 to ${String(WORD_MAX)} code units without outer white space`);
    }
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

function wordGroup<K extends string>(where: string, v: unknown, keys: readonly K[]): Partial<Record<K, readonly string[]>> {
  if (!isPlain(v)) throw bad(`${where} must be an object`);
  const fields = ownFields(where, v, keys);
  const out: Partial<Record<K, readonly string[]>> = {};
  for (const k of keys) {
    const f = fields[k];
    if (f !== undefined) out[k] = wordList(`${where}.${k}`, f);
  }
  return out;
}

function grammar(where: string, v: unknown): { readonly prefixes?: readonly string[] } {
  if (!isPlain(v)) throw bad(`${where} must be an object`);
  const { prefixes } = ownFields(where, v, ['prefixes']);
  return prefixes === undefined ? {} : { prefixes: wordList(`${where}.prefixes`, prefixes) };
}

/** The reader option, checked: a TypeError for a shape that is not a ReaderVocabulary; `undefined` is no vocabulary. */
export function checkReader(reader: ReaderVocabulary | undefined): CheckedReader {
  if (reader === undefined) return { rules: false };
  if (!isPlain(reader)) throw bad('reader must be a plain object');
  const fields = ownFields('reader', reader, KEYS);
  const out: { -readonly [K in keyof CheckedReader]: CheckedReader[K] } = { rules: false };
  if (fields['status'] !== undefined) out.status = wordGroup('reader.status', fields['status'], STATUS_KEYS);
  if (fields['attention'] !== undefined) out.attention = wordGroup('reader.attention', fields['attention'], ATTENTION_KEYS);
  if (fields['plan'] !== undefined) out.plan = wordGroup('reader.plan', fields['plan'], PLAN_KEYS);
  const { ids, ruleIds, rules } = fields;
  if (ids !== undefined) out.ids = ids === false ? false : grammar('reader.ids', ids);
  if (ruleIds !== undefined) out.ruleIds = grammar('reader.ruleIds', ruleIds);
  for (const k of LIST_KEYS) {
    const f = fields[k];
    if (f !== undefined) out[k] = wordList(`reader.${k}`, f);
  }
  if (rules !== undefined) {
    if (typeof rules !== 'boolean') throw bad('reader.rules must be a boolean');
    out.rules = rules;
  }
  return out;
}
