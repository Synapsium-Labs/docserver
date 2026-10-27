// The seed: the one data block of the srcdoc (docserver L3, Task 3; plan Reference 3, FD7, FD17, ruling R3).
// frameDocument writes it with serializeSeed, and the bootstrap, which bundles this file, reads it back with
// validateSeed. Pure: no DOM, no clock, no randomness, no I/O. The bootstrap bundles it, so it imports only the frame's
// own pure files (never manifest.generated.ts or document.ts, Reference 3) and holds no import of render() or L2.
//
// Schema 1 has closed keys: s, nonce, html, title, frontList, version, images, initialHash, lang, prefs, snapshot,
// features, mermaid and bridge. Records (images, snapshot) are [key, value] pair arrays, so no `__proto__` key can exist.
// Every field has its grammar and its cap (SEED_LIMITS). Several caps are copies of L2's (src/enhance/options.ts) and
// render()'s (src/render/frontMatter.ts, src/render/types.ts): this file typechecks with no DOM library and the bootstrap
// must not bundle those modules, so it cannot import them; test/frame-seed.test.ts holds each copy equal to its original.
//
// The caps of FD17 live here: SEED_HTML_MAX_CHARS (the html as the seed carries it), IMAGE_BUDGET_CHARS and
// SEED_FIELDS_MAX_CHARS. MAX_SRCDOC_CHARS_DEFAULT is not defined here: it needs the built assets' lengths, so
// src/frame/document.ts derives it (Task 7). The last two are size formulas only frameDocument and the tests read: each
// is a `/* @__PURE__ */` call of a function, so esbuild drops it from the bootstrap, which uses only validateSeed (the
// bootstrap's 32 KiB budget, Reference 12; test/frame-document.test.ts checks the built bootstrap for their names).
import type { FrontEntry } from '../render/types.js';
import { FRAGMENT_ID_GRAMMAR, isFragmentId } from './fragment.js';
import {
  BRIDGE_LIMITS,
  DOC_FIELDS,
  FRAME_PREF_VALUES,
  isBridgeStoreKey,
  isFullSha,
  PREF_KEYS,
  SEED_SCHEMA,
  type BridgeStoreKey,
  type FramePrefValues,
} from './protocol.js';
import type { ChromeOptions, CommitEntry, VocabularyOptions } from './wire-types.js';

/** The spec's document cap, in markdown UTF-8 bytes (2 MiB). */
const DOC_MAX_BYTES = 2097152;

/**
 * Every cap of the seed's fields. Code units are UTF-16 code units (`s.length`); code points are what render() cuts the
 * front matter by (`cpSlice`). The copies of L2's and render()'s caps are held equal to their originals by
 * test/frame-seed.test.ts.
 */
export const SEED_LIMITS = Object.freeze({
  /** The spec's document cap, in markdown UTF-8 bytes. */
  docMaxBytes: DOC_MAX_BYTES,
  /** The title: the text of a heading of the document, so never more code units than the document has bytes. */
  titleMaxCodeUnits: DOC_MAX_BYTES,
  /** frontList entries: render()'s FM_MAX_KEYS, L2's LIMITS.frontList. */
  frontEntries: 40,
  /** A front-matter key, and a scalar's one value: render()'s FM_MAX_VALUE. */
  frontKeyMaxCodePoints: 500,
  frontValueMaxCodePoints: 500,
  /** A list's items, and each item: render()'s FM_LIST_MAX_ITEMS and FM_LIST_MAX_ITEM, L2's LIMITS.frontVals. */
  frontItems: 300,
  frontItemMaxCodePoints: 300,
  /** version.commits: L2's LIMITS.commits, subject, date and parents. */
  commits: 100,
  subjectMaxCodeUnits: 200,
  dateMaxCodeUnits: 64,
  parents: 16,
  /** images: render()'s DEFAULT_MAX_IMAGES pairs, each ref at most 2048 code units (the empty ref included, as scanRefs
   *  lists `![a]()`'s). */
  images: 512,
  imageRefMaxCodeUnits: 2048,
  /** The spec's image budget: every image's decoded bytes together (5 MiB). Its base64 length is the URLs' srcdoc share. */
  imageBudgetBytes: 5242880,
  /** lang: its grammar admits any number of subtags, so it is capped here. */
  langMaxCodeUnits: 64,
  /** mermaid.secure: L2's LIMITS.secure keys, each of SECURE_KEY_SOURCE (1 to 64 code units). */
  secureKeys: 64,
  secureKeyMaxCodeUnits: 64,
  /** mermaid.maxTextSize and maxEdges: L2's LIMITS (frameDocument refuses the values above the frame's ceilings). */
  maxTextSize: 1048576,
  maxEdges: 50000,
  /** A vocabulary list: L2's LIMITS.words words, each 1 to LIMITS.word code units. */
  words: 200,
  wordMaxCodeUnits: 64,
  /** The deepest any value of the seed may sit; the seed itself is depth 0. */
  depth: 32,
} as const);

/** The image types the seed carries, as the data-URL grammar names them. */
export const IMAGE_TYPES = Object.freeze(['png', 'jpeg', 'gif', 'webp', 'avif', 'svg+xml'] as const);

/** An image's value: a base64 data URL of one of IMAGE_TYPES (Reference 3). */
export const IMAGE_DATA_URL_SOURCE = `^data:image/(${IMAGE_TYPES.map((t) => t.replace('+', '\\+')).join('|')});base64,[A-Za-z0-9+/]*={0,2}$`;
const IMAGE_DATA_URL = new RegExp(IMAGE_DATA_URL_SOURCE);

/** A key of Mermaid's configuration, as mermaid.secure lists them: L2's CONFIG_KEY (src/enhance/options.ts). */
export const SECURE_KEY_SOURCE = '^[A-Za-z][A-Za-z0-9_]{0,63}$';
const SECURE_KEY = new RegExp(SECURE_KEY_SOURCE);

/** How Mermaid draws: every figure after enhance, or one figure on its Render tap (FD13). */
export const MERMAID_DRAW = Object.freeze(['auto', 'on-request'] as const);
export type MermaidDraw = (typeof MERMAID_DRAW)[number];

/** The ops the parent answers, each a boolean in the seed (FrameOptions.bridge, default all true). */
export const BRIDGE_KEYS = Object.freeze(['links', 'hash', 'copy', 'changes', 'versions'] as const);

/**
 * The keys of `features`: three flags, `chrome`'s flags and `vocabulary`'s word lists, in groups (`status`,
 * `attention`, `plan`), in ID grammars (`ids`, which may also be false, and `ruleIds`, each `{ prefixes }`) and alone.
 * The same lists as L2's normalizeOptions reads (src/enhance/options.ts; held equal by test/frame-seed.test.ts).
 */
export const FEATURE_KEYS = Object.freeze({
  flags: Object.freeze(['rules', 'folds', 'keyboard'] as const),
  chrome: Object.freeze(['bar', 'rail', 'settings'] as const),
  groups: Object.freeze({
    status: Object.freeze(['ok', 'wait', 'no', 'info'] as const),
    attention: Object.freeze(['status', 'who', 'question', 'openAnswers', 'blocking', 'risk', 'openStatus'] as const),
    plan: Object.freeze(['task', 'step', 'who'] as const),
  }),
  grammars: Object.freeze(['ids', 'ruleIds'] as const),
  lists: Object.freeze(['statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemFields', 'itemHeadings'] as const),
});

/** The reader prefs the bridge carries: theme, width and font, each optional (FRAME_PREF_VALUES). */
export type SeedPrefs = FramePrefValues;

/** The document's version, as the reader's version tools read it; every sha full (40 or 64 lower-case hex). */
export interface SeedVersion {
  readonly sha: string | null;
  readonly draft: boolean;
  readonly commits: readonly CommitEntry[] | null;
  readonly only: string | null;
}

/** L2's feature switches and word lists, as plain data. */
export interface SeedFeatures {
  readonly rules?: boolean;
  readonly folds?: boolean;
  readonly keyboard?: boolean;
  readonly chrome?: ChromeOptions;
  readonly vocabulary?: VocabularyOptions;
}

/** Mermaid's settings when the frame inlines its script; null when it does not. */
export interface SeedMermaid {
  readonly maxTextSize?: number;
  readonly maxEdges?: number;
  readonly secure: readonly string[];
  readonly draw: MermaidDraw;
}

/** Which ops the parent answers. */
export type SeedBridge = { readonly [K in (typeof BRIDGE_KEYS)[number]]: boolean };

export interface Seed {
  readonly s: 1;
  readonly nonce: string;
  readonly html: string;
  readonly title: string | null;
  readonly frontList: readonly FrontEntry[] | null;
  readonly version: SeedVersion;
  /** [img src as scanRefs lists it, its data URL]. */
  readonly images: readonly (readonly [string, string])[];
  readonly initialHash: string | null;
  readonly lang: string;
  readonly prefs: SeedPrefs;
  /** [bridge store key, its JSON text]: the parent's stored state at mount. */
  readonly snapshot: readonly (readonly [BridgeStoreKey, string])[];
  readonly features: SeedFeatures;
  readonly mermaid: SeedMermaid | null;
  readonly bridge: SeedBridge;
}

/** A nonce: 128 bits as 32 lower-case hex digits. */
export const NONCE_SOURCE = '^[0-9a-f]{32}$';
const NONCE = new RegExp(NONCE_SOURCE);

/** A language tag, loosely BCP 47: a 2 to 8 letter primary tag, then subtags of 1 to 8 letters or digits. */
export const LANG = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

/** The seed's keys, sorted: schema 1 has exactly these. */
export const SEED_KEYS: readonly string[] = Object.freeze([
  'bridge', 'features', 'frontList', 'html', 'images', 'initialHash', 'lang', 'mermaid', 'nonce', 'prefs', 's', 'snapshot', 'title', 'version',
]);

/** Keys refused at any depth: they could reach a prototype through a careless merge. */
const PROTO_KEYS: readonly string[] = ['__proto__', 'constructor', 'prototype'];

/** True for a nonce of the grammar NONCE_SOURCE. */
export function isNonce(v: unknown): v is string {
  return typeof v === 'string' && NONCE.test(v);
}

/** True for a language tag of the grammar LANG, at most SEED_LIMITS.langMaxCodeUnits code units. */
export function isLang(v: unknown): v is string {
  return typeof v === 'string' && v.length <= SEED_LIMITS.langMaxCodeUnits && LANG.test(v);
}

/**
 * JSON text as the seed writes it: `<`, `>`, `&`, U+2028 and U+2029 as their ASCII backslash-u escapes, never the raw
 * character. JSON.stringify already escapes the C0 controls, `"`, `\` and lone surrogates.
 */
function escapeSeedJson(json: string): string {
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * The seed as the text of a `<script type="application/json">`: JSON, with `<`, `>`, `&`, U+2028 and U+2029 written as
 * backslash-u escapes. The text therefore holds no `<`, so it can neither end its element nor enter a script-data
 * escape state, and JSON.parse gives back exactly the value written.
 */
export function serializeSeed(seed: Seed): string {
  return escapeSeedJson(JSON.stringify(seed));
}

/** The length of `html` as the seed carries it: its escaped JSON string body, without the quotes. */
export function escapedHtmlLength(html: string): number {
  return escapeSeedJson(JSON.stringify(html)).length - 2;
}

/**
 * The html cap, in escaped seed characters (ruling R3, FD17): ceil(2097152 x r) = 57265090, where r = 27.3061
 * (1338 / 49, measured on nesting-limit.md) is the largest ratio, over every golden corpus document of at least one byte,
 * of the html's escaped length (escapedHtmlLength of render().html) to the document's markdown UTF-8 bytes, the seed's
 * fixed keys left out. `node scripts/measure-seed-ratio.mjs` prints r, its document and the top three; row L3.M20
 * recomputes all three. A document whose escaped html is longer is refused `too-large`.
 */
export const SEED_HTML_MAX_CHARS = 57265090;

function imageBudgetChars(): number {
  // The longest a data-URL prefix of IMAGE_TYPES is (`data:image/svg+xml;base64,`).
  const prefixMax = Math.max(...IMAGE_TYPES.map((t) => `data:image/${t};base64,`.length));
  return 4 * Math.ceil(SEED_LIMITS.imageBudgetBytes / 3) + SEED_LIMITS.images * prefixMax;
}

/**
 * The image URLs' share of the srcdoc: the base64 length of the spec's image budget, 4 x ceil(5242880 / 3), plus a
 * data-URL prefix for each of 512 images (Reference 3). Base64 never escapes, so a URL's seed length is its length.
 */
export const IMAGE_BUDGET_CHARS = /* @__PURE__ */ imageBudgetChars();

/** The most characters one character takes in the seed text: `\u003c`, `\u2028`, `\ud800`, `\u0000` (six). */
const ESC = 6;
/** The longest JSON string of `n` code points (or code units) in the seed text, quotes included. */
const str = (n: number): number => ESC * n + 2;
/** A JSON string of `n` characters none of which escape (hex, base64, an ASCII grammar), quotes included. */
const raw = (n: number): number => n + 2;
/** `"name":` and its value. */
const member = (name: string, value: number): number => name.length + 3 + value;
const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
/** An object of these members. */
const obj = (members: readonly number[]): number => 2 + sum(members) + Math.max(0, members.length - 1);
/** An array of `count` items of `item` characters. */
const arr = (count: number, item: number): number => 2 + count * item + Math.max(0, count - 1);
const longest = (vals: readonly string[]): number => Math.max(...vals.map((v) => v.length));
/** `false` (longer than `true` and than `null`). */
const FALSE = 5;

/** The longest seed text of the snapshot: every allow-listed key carrying a value at its cap, as far as the budget goes. */
function snapshotMaxChars(): number {
  const keys = [...PREF_KEYS.map((k) => `pref:${k}`), ...DOC_FIELDS.map((f) => `doc:${f}`)];
  const { valueMaxBytes, storeBudgetBytes } = BRIDGE_LIMITS;
  // A value of b bytes writes longest as a JSON string of b - 2 `<`: `"\"` + 6 per `<` + `\""`, so 6b - 6.
  const values = keys.length * valueMaxBytes <= storeBudgetBytes ? keys.length * (ESC * valueMaxBytes - 6) : ESC * storeBudgetBytes;
  return 2 + sum(keys.map((k) => 1 + raw(k.length) + 1 + 1)) + values + Math.max(0, keys.length - 1);
}

/** The longest seed text of `features`: every flag false and every word list full of the longest word. */
function featuresMaxChars(): number {
  const L = SEED_LIMITS;
  const list = arr(L.words, str(L.wordMaxCodeUnits));
  const vocabulary = obj([
    ...Object.entries(FEATURE_KEYS.groups).map(([g, keys]) => member(g, obj(keys.map((k) => member(k, list))))),
    ...FEATURE_KEYS.grammars.map((k) => member(k, obj([member('prefixes', list)]))),
    ...FEATURE_KEYS.lists.map((k) => member(k, list)),
  ]);
  return obj([
    ...FEATURE_KEYS.flags.map((k) => member(k, FALSE)),
    member('chrome', obj(FEATURE_KEYS.chrome.map((k) => member(k, FALSE)))),
    member('vocabulary', vocabulary),
  ]);
}

function seedFieldsMaxChars(): number {
  const L = SEED_LIMITS;
  const frontKey = member('key', str(L.frontKeyMaxCodePoints));
  const frontEntry = Math.max(
    obj([frontKey, member('list', 4), member('vals', arr(L.frontItems, str(L.frontItemMaxCodePoints)))]),
    obj([frontKey, member('list', FALSE), member('vals', arr(1, str(L.frontValueMaxCodePoints)))]),
  );
  const sha = raw(64);
  const commit = obj([member('sha', sha), member('subject', str(L.subjectMaxCodeUnits)), member('date', str(L.dateMaxCodeUnits)), member('parents', arr(L.parents, sha))]);
  // An image pair: `[`, the ref, `,`, the URL's two quotes (its characters are IMAGE_BUDGET_CHARS'), `]`.
  const imagePair = 1 + str(L.imageRefMaxCodeUnits) + 1 + 2 + 1;
  // Base64 padded one image at a time: each image beyond the first adds at most 4 characters to 4 x ceil(total / 3).
  const imagePadding = 4 * (L.images - 1);
  const fields = obj([
    member('s', String(SEED_SCHEMA).length),
    member('nonce', raw(32)),
    member('html', 2),
    member('title', str(L.titleMaxCodeUnits)),
    member('frontList', arr(L.frontEntries, frontEntry)),
    member('version', obj([member('sha', sha), member('draft', FALSE), member('commits', arr(L.commits, commit)), member('only', sha)])),
    member('images', arr(L.images, imagePair)),
    // A fragment id's characters (letters, marks, numbers, `_.:-`) never escape.
    member('initialHash', raw(FRAGMENT_ID_GRAMMAR.maxCodeUnits)),
    member('lang', raw(L.langMaxCodeUnits)),
    member('prefs', obj(Object.entries(FRAME_PREF_VALUES).map(([k, v]) => member(k, raw(longest(v)))))),
    member('snapshot', snapshotMaxChars()),
    member('features', featuresMaxChars()),
    member(
      'mermaid',
      obj([
        member('maxTextSize', String(L.maxTextSize).length),
        member('maxEdges', String(L.maxEdges).length),
        member('secure', arr(L.secureKeys, raw(L.secureKeyMaxCodeUnits))),
        member('draw', raw(longest(MERMAID_DRAW))),
      ]),
    ),
    member('bridge', obj(BRIDGE_KEYS.map((k) => member(k, FALSE)))),
  ]);
  return fields + imagePadding;
}

/**
 * Every other seed field's share of the srcdoc (Reference 3): the longest seed text the validator admits, the html's
 * body and the image URLs' characters left out (SEED_HTML_MAX_CHARS and IMAGE_BUDGET_CHARS count those), each field at
 * its cap and each string of the character that escapes longest. Derived from SEED_LIMITS, never a literal; row L3.M20
 * rebuilds it from a maximal seed.
 */
export const SEED_FIELDS_MAX_CHARS = /* @__PURE__ */ seedFieldsMaxChars();

const isPlain = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const p: unknown = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
};

/** Why `v` is hostile at any depth: a value deeper than SEED_LIMITS.depth, a proto key or a non-plain object; or null. */
function hostile(v: unknown, depth: number): 'depth' | 'proto' | null {
  if (depth > SEED_LIMITS.depth) return 'depth';
  if (Array.isArray(v)) {
    for (const x of v) {
      const h = hostile(x, depth + 1);
      if (h !== null) return h;
    }
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  if (!isPlain(v)) return 'proto';
  for (const k of Object.keys(v)) {
    if (PROTO_KEYS.includes(k)) return 'proto';
    const h = hostile(v[k], depth + 1);
    if (h !== null) return h;
  }
  return null;
}

const sameKeys = (o: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(o).sort();
  const want = [...keys].sort();
  return own.length === want.length && own.every((k, i) => k === want[i]);
};

const onlyKeys = (o: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(o).every((k) => keys.includes(k));

/** Code points of `s`: a surrogate pair counts once, a lone surrogate once. */
function codePoints(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) i += 1;
    }
    n += 1;
  }
  return n;
}

/** UTF-8 bytes of `s`, a lone surrogate written as U+FFFD (three bytes). */
function utf8Bytes(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && s.charCodeAt(i + 1) >= 0xdc00 && s.charCodeAt(i + 1) <= 0xdfff) {
      n += 4;
      i += 1;
    } else n += 3;
  }
  return n;
}

const isString = (v: unknown, max: number, min = 0): v is string => typeof v === 'string' && v.length >= min && v.length <= max;
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const shaOrNull = (v: unknown): boolean => v === null || isFullSha(v);

/** An array of at most `max` items, each passing `item`. */
const listOf = (v: unknown, max: number, item: (x: unknown) => boolean): v is unknown[] => Array.isArray(v) && v.length <= max && v.every(item);

/** A [string, string] pair. */
const isPair = (v: unknown): v is [string, string] => Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'string';

function frontEntryOk(e: unknown): boolean {
  const L = SEED_LIMITS;
  if (!isPlain(e) || !sameKeys(e, ['key', 'list', 'vals'])) return false;
  const { key, list, vals } = e;
  if (typeof key !== 'string' || codePoints(key) > L.frontKeyMaxCodePoints || !isBool(list) || !Array.isArray(vals)) return false;
  if (!vals.every((x) => typeof x === 'string')) return false;
  if (list) return vals.length <= L.frontItems && vals.every((x: string) => codePoints(x) <= L.frontItemMaxCodePoints);
  return vals.length === 1 && codePoints(vals[0] as string) <= L.frontValueMaxCodePoints;
}

function commitOk(c: unknown): boolean {
  const L = SEED_LIMITS;
  if (!isPlain(c) || !sameKeys(c, ['sha', 'subject', 'date', 'parents'])) return false;
  return (
    isFullSha(c['sha']) &&
    isString(c['subject'], L.subjectMaxCodeUnits) &&
    isString(c['date'], L.dateMaxCodeUnits) &&
    listOf(c['parents'], L.parents, isFullSha)
  );
}

/** The version's own failure: its key set, then each field by name. */
function versionWhy(v: unknown): string | null {
  if (!isPlain(v) || !sameKeys(v, ['sha', 'draft', 'commits', 'only'])) return 'version';
  if (!shaOrNull(v['sha'])) return 'version.sha';
  if (!isBool(v['draft'])) return 'version.draft';
  const commits = v['commits'];
  if (commits !== null && !listOf(commits, SEED_LIMITS.commits, commitOk)) return 'version.commits';
  if (!shaOrNull(v['only'])) return 'version.only';
  return null;
}

/**
 * The bytes a data URL of IMAGE_DATA_URL_SOURCE decodes to: its base64 body's characters less the `=` padding, three
 * bytes for every four (an unpadded partial group counts its whole bytes, as a decoder reads it).
 */
export function imageDecodedBytes(url: string): number {
  const body = url.length - url.indexOf(',') - 1;
  const pad = url.endsWith('==') ? 2 : url.endsWith('=') ? 1 : 0;
  return Math.floor(((body - pad) * 3) / 4);
}

/** At most 512 [ref, data URL] pairs, refs unique and at most 2048 code units, decoded bytes within the image budget. */
function imagesOk(v: unknown): boolean {
  const L = SEED_LIMITS;
  if (!Array.isArray(v) || v.length > L.images) return false;
  const refs = new Set<string>();
  let bytes = 0;
  for (const p of v) {
    if (!isPair(p)) return false;
    const [ref, url] = p;
    if (ref.length > L.imageRefMaxCodeUnits || refs.has(ref) || !IMAGE_DATA_URL.test(url)) return false;
    refs.add(ref);
    bytes += imageDecodedBytes(url);
  }
  return bytes <= L.imageBudgetBytes;
}

/**
 * The html within SEED_HTML_MAX_CHARS as the seed carries it (escaped, FD17), not by its parsed length: one character
 * takes at most ESC seed characters, so an html of at most a sixth of the cap is within it without being measured.
 */
function htmlOk(v: unknown): boolean {
  if (!isString(v, SEED_HTML_MAX_CHARS)) return false;
  return v.length * ESC <= SEED_HTML_MAX_CHARS || escapedHtmlLength(v) <= SEED_HTML_MAX_CHARS;
}

const isJsonText = (s: string): boolean => {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
};

function snapshotOk(v: unknown): boolean {
  if (!Array.isArray(v)) return false;
  const keys = new Set<string>();
  let total = 0;
  for (const p of v) {
    if (!isPair(p)) return false;
    const [key, value] = p;
    if (!isBridgeStoreKey(key) || keys.has(key)) return false;
    keys.add(key);
    const bytes = utf8Bytes(value);
    if (bytes > BRIDGE_LIMITS.valueMaxBytes || !isJsonText(value)) return false;
    total += bytes;
  }
  // Reference 3's 1 MiB total. Unreachable while the allow-list's 8 keys x 64 KiB stay within it (an equivalent mutant,
  // row L3.M4d); test/frame-seed.test.ts goes red the day the allow-list outgrows the budget.
  return total <= BRIDGE_LIMITS.storeBudgetBytes;
}

/** A vocabulary word list: L2's wordList (src/enhance/options.ts), duplicates kept (L2 drops them). */
const isWordList = (v: unknown): boolean =>
  listOf(v, SEED_LIMITS.words, (w) => isString(w, SEED_LIMITS.wordMaxCodeUnits, 1) && w.trim() === w);

/** An object of own word lists, only these keys. */
const isWordGroup = (v: unknown, keys: readonly string[]): boolean => isPlain(v) && onlyKeys(v, keys) && Object.values(v).every(isWordList);

function vocabularyOk(v: unknown): boolean {
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

/** The features' own failure: its key set, then each key by name. */
function featuresWhy(v: unknown): string | null {
  if (!isPlain(v) || !onlyKeys(v, [...FEATURE_KEYS.flags, 'chrome', 'vocabulary'])) return 'features';
  for (const k of FEATURE_KEYS.flags) if (Object.hasOwn(v, k) && !isBool(v[k])) return `features.${k}`;
  const chrome = v['chrome'];
  if (chrome !== undefined && !(isPlain(chrome) && onlyKeys(chrome, FEATURE_KEYS.chrome) && Object.values(chrome).every(isBool))) return 'features.chrome';
  const vocabulary = v['vocabulary'];
  if (vocabulary !== undefined && !vocabularyOk(vocabulary)) return 'features.vocabulary';
  return null;
}

const capOk = (v: unknown, max: number): boolean => v === undefined || (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= max);

/** Mermaid's own failure: its key set (secure and draw required), then each key by name. */
function mermaidWhy(v: unknown): string | null {
  if (!isPlain(v) || !onlyKeys(v, ['maxTextSize', 'maxEdges', 'secure', 'draw']) || !Object.hasOwn(v, 'secure') || !Object.hasOwn(v, 'draw')) return 'mermaid';
  if (!capOk(v['maxTextSize'], SEED_LIMITS.maxTextSize)) return 'mermaid.maxTextSize';
  if (!capOk(v['maxEdges'], SEED_LIMITS.maxEdges)) return 'mermaid.maxEdges';
  if (!listOf(v['secure'], SEED_LIMITS.secureKeys, (k) => typeof k === 'string' && SECURE_KEY.test(k))) return 'mermaid.secure';
  if (!(MERMAID_DRAW as readonly unknown[]).includes(v['draw'])) return 'mermaid.draw';
  return null;
}

/** The prefs' own failure: an object, each key a pref with one of its values. */
function prefsWhy(v: unknown): string | null {
  if (!isPlain(v)) return 'prefs';
  const values: Readonly<Record<string, readonly string[]>> = FRAME_PREF_VALUES;
  for (const k of Object.keys(v)) {
    const allowed = Object.hasOwn(values, k) ? values[k] : undefined;
    if (allowed === undefined || !allowed.includes(v[k] as string)) return `prefs.${k}`;
  }
  return null;
}

export type SeedCheck =
  | { readonly ok: true; readonly seed: Seed }
  /** `nonce` is the seed's nonce when it was readable (the frame can then report the failure), else null. */
  | { readonly ok: false; readonly nonce: string | null; readonly why: string };

/**
 * Check a parsed seed: a plain object; its nonce (a failure keeps it only when it was readable); no value deeper than
 * SEED_LIMITS.depth, and no proto key or non-plain object at any depth; exactly schema 1's keys; then each field's type,
 * grammar and cap, a failure naming its field.
 */
export function validateSeed(v: unknown): SeedCheck {
  if (!isPlain(v)) return { ok: false, nonce: null, why: 'not a plain object' };
  const nonce = Object.hasOwn(v, 'nonce') && isNonce(v['nonce']) ? v['nonce'] : null;
  const fail = (why: string): SeedCheck => ({ ok: false, nonce, why });
  if (nonce === null) return fail('nonce');
  const h = hostile(v, 0);
  if (h !== null) return fail(h);
  if (!sameKeys(v, SEED_KEYS)) return fail('keys');
  if (v['s'] !== SEED_SCHEMA) return fail('schema');
  if (!htmlOk(v['html'])) return fail('html');
  const title = v['title'];
  if (title !== null && !isString(title, SEED_LIMITS.titleMaxCodeUnits)) return fail('title');
  const front = v['frontList'];
  if (front !== null && !listOf(front, SEED_LIMITS.frontEntries, frontEntryOk)) return fail('frontList');
  const version = versionWhy(v['version']);
  if (version !== null) return fail(version);
  if (!imagesOk(v['images'])) return fail('images');
  const hash = v['initialHash'];
  if (hash !== null && !isFragmentId(hash)) return fail('initialHash');
  if (!isLang(v['lang'])) return fail('lang');
  const prefs = prefsWhy(v['prefs']);
  if (prefs !== null) return fail(prefs);
  if (!snapshotOk(v['snapshot'])) return fail('snapshot');
  const features = featuresWhy(v['features']);
  if (features !== null) return fail(features);
  const mermaid = v['mermaid'];
  if (mermaid !== null) {
    const m = mermaidWhy(mermaid);
    if (m !== null) return fail(m);
  }
  const bridge = v['bridge'];
  if (!isPlain(bridge) || !sameKeys(bridge, BRIDGE_KEYS) || !Object.values(bridge).every(isBool)) return fail('bridge');
  return { ok: true, seed: v as unknown as Seed };
}
