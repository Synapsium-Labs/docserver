// frameDocument: the srcdoc of the sealed reader frame (docserver L3; plan Reference §1 to §4). Validates its inputs,
// verifies every asset against the generated manifest, cross-checks the policy, and joins the fixed skeleton, on one
// line, with no whitespace or comment between elements:
//
//   <meta http-equiv="Content-Security-Policy" content="{csp}">
//   <script>{guard.js}</script>
//   <script type="application/json">{seed}</script>
//   <script>{bootstrap.js}</script>
//   <style>{frame/reader.css}{STYLE_JOIN}{layout stylesheet}</style>   the join and the layout's stylesheet only for a layout that has one
//   <script>{enhance.js}</script>              the chosen layout's enhance bundle (FrameOptions.layout, default 'default')
//   <script>{mermaid.frame.js}</script>        only when FrameOptions.mermaid is non-null and its draw is not 'after-ready'
//
// A frame carries one layout (docserver parity Task 9; src/frame/layouts.ts): its enhance bundle in place of the default's, and
// its own stylesheet, when it has one, inside the same style element after reader.css, so the element order the guard and the
// bootstrap expect does not change. For the default layout nothing differs from a frame with no layout.
//
// No doctype (a srcdoc document is never in quirks mode), no html, head or body tag: every element lands in the
// implied head, and the implied body stays empty until the bootstrap appends the content root at DOMContentLoaded. The
// rendered html travels only as text inside the seed. Pure: no DOM, no clock, no randomness, no I/O.
//
// Host data is untrusted. The options and their assets must be objects, and the policy is read once. Every value a host
// hands in for the seed (the title, the front list, the version, the images and the snapshot, the lang, the prefs, the
// features, Mermaid's settings, the bridge switches) is copied once, as plain data, before anything judges it: own data
// properties only (a getter is refused unread, an inherited property is never read), arrays read by index, a property
// whose value is undefined left out, at most 512 entries in any list or record, no deeper than the seed's own depth cap,
// and at most HOST_VALUES_MAX values in all. The seed is then assembled from the copies and judged by the one validator the bootstrap runs
// (seed.ts's validateSeed), so frameDocument never emits a seed its own bootstrap refuses. On top of it, the frame's own
// rules: Mermaid's maxTextSize and maxEdges at most MERMAID_LIMIT_CEILINGS (a host may only lower them), the html within
// SEED_HTML_MAX_CHARS as the seed carries it, the whole string within maxSrcdocChars (at most MAX_SRCDOC_CHARS_DEFAULT),
// and an initialHash outside FRAGMENT_ID_GRAMMAR seeded as null, never refused (ruling R1). The appearance contract adds two
// optional seed fields: `FrameOptions.appearance` is taken through parseAppearance and its verdict seeded (a bad slot never
// throws), and `FrameAssets.fonts` is read for its faces (a `fonts` that is not a plain object, has a key but `sans` and
// `mono`, or holds a face that is not a string is a TypeError, a host's programming error; a face outside the base64
// alphabet, without the wOF2 signature or over 131 072 decoded bytes is dropped silently, and with no good face the seed
// has no `fonts` key). Every supplied asset is
// verified, Mermaid's too when Mermaid is off or its draw is 'after-ready' (Reference §4: "any supplied asset"); in
// 'after-ready' no script of Mermaid's is emitted and assets.mermaid is not required, while the policy must still list
// its hash (the frame inserts the build over the port after ready, ledger C107). The skeleton is written in one place
// (srcdoc), and MAX_SRCDOC_CHARS_DEFAULT counts it at its longest (ruling C92).
import { parseAppearance } from '../enhance/appearance.js';
import type { FrontEntry, RenderOutcome } from '../render/types.js';
import { cssHazards, scriptHazards } from './bytes.js';
import { checkFrameCsp } from './csp.js';
import { CSP_MAX_CHARS } from './csp-rules.js';
import { MERMAID_LIMIT_CEILINGS } from './gate.js';
import { FRAME_MANIFEST } from './manifest.generated.js';
import { isFragmentId } from './fragment.js';
import { ITEM_LIMITS, itemsWhy, type ItemLink } from './items.js';
import { isFrameLayout, LAYOUT_ENTRIES, type FrameLayout } from './layouts.js';
import { vocabularyOk } from './vocabulary.js';
import { FRAME_PREF_VALUES, isFullSha, type BridgeStoreKey } from './protocol.js';
import {
  BASE64_FACE,
  BRIDGE_KEYS,
  escapedHtmlLength,
  FEATURE_KEYS,
  FONT_ROLES,
  IMAGE_BUDGET_CHARS,
  isNonce,
  OPTIONAL_SEED_KEYS,
  SEED_FIELDS_MAX_CHARS,
  SEED_HTML_MAX_CHARS,
  SEED_LIMITS,
  serializeSeed,
  validateSeed,
  type MermaidDraw,
  type Seed,
  type SeedAppearance,
  type SeedFonts,
  type SeedItem,
  type SeedMermaid,
} from './seed.js';
import { hex, sha256Text } from './sha256.js';
import type { ChromeOptions, CommitEntry, FramePrefs, VocabularyOptions } from './wire-types.js';

/** Why frameDocument refused (Reference §4). */
export type FrameErrorCode = 'not-rendered' | 'invalid-input' | 'nonce' | 'asset-mismatch' | 'unsafe-asset' | 'csp' | 'missing-asset' | 'too-large';

export class FrameError extends Error {
  readonly code: FrameErrorCode;

  constructor(code: FrameErrorCode, message: string) {
    super(message);
    this.name = 'FrameError';
    this.code = code;
  }
}

export interface RenderInput {
  readonly result: {
    /** frameDocument refuses anything but 'rendered' (not-rendered). */
    readonly outcome: RenderOutcome;
    /** render().html verbatim; at most SEED_HTML_MAX_CHARS as the seed carries it (too-large). */
    readonly html: string;
    /** `items` is render()'s `meta.items`: the item values the document names, which ./host hands its `items` adapter. Not seeded. */
    readonly meta: { readonly title: string | null; readonly frontList: readonly FrontEntry[] | null; readonly items?: readonly string[] };
  };
  /** sha, commits[].sha, commits[].parents and only are full 40- or 64-hex (stricter than enhance's 7 to 40). */
  readonly version?: {
    readonly sha?: string | null;
    readonly draft?: boolean;
    /** At most 100. */
    readonly commits?: readonly CommitEntry[] | null;
    readonly only?: string | null;
  };
  /**
   * img src exactly as scanRefs().images lists it, mapped to a data:image/(png|jpeg|gif|webp|avif|svg+xml);base64 URL.
   * At most 512 entries, refs at most 2048 code units, the decoded bytes within 5 MiB. Seeded as [ref, url] pairs.
   */
  readonly images?: Readonly<Record<string, string>>;
  /** The id to open at, without '#'. Outside FRAGMENT_ID_GRAMMAR it is seeded as null, never refused. */
  readonly initialHash?: string | null;
  /** Default 'en'. */
  readonly lang?: string;
  /** scanRefs().mermaid; read only by mermaidGate and ./host, never by frameDocument. The *Chars fields are UTF-16 code units. */
  readonly scan?: {
    readonly mermaid: {
      readonly fences: number;
      readonly largestBytes: number;
      readonly totalBytes: number;
      readonly largestChars: number;
      readonly totalChars: number;
    };
  };
}

/** The exact texts of the shipped files; each is verified against FRAME_MANIFEST. */
export interface FrameAssets {
  readonly guard: string;
  readonly bootstrap: string;
  /** The enhance bundle of the chosen layout (FrameOptions.layout): assets/frame/enhance.js for `default`, else assets/frame/enhance-<name>.js. */
  readonly enhance: string;
  readonly css: string;
  /**
   * assets/frame/layout-<name>.css, the chosen layout's own stylesheet: required (else `missing-asset`) when that layout has
   * one, and refused (`asset-mismatch`) when it has none, `default` included. Verified against the layout's manifest entry.
   */
  readonly layoutCss?: string;
  /** assets/mermaid/mermaid.frame.js; required when FrameOptions.mermaid is non-null, unless its draw is 'after-ready'. */
  readonly mermaid?: string;
  /**
   * The host's own faces, base64 woff2, for the frame's sans (and chrome) and mono roles. A `fonts` that is not a plain
   * object, a key other than `sans` and `mono`, or a face that is not a string throws TypeError. A face outside the base64
   * alphabet, without the `wOF2` signature or over 131 072 decoded bytes is dropped silently, and that role keeps the
   * library's own face.
   */
  readonly fonts?: { readonly sans?: string; readonly mono?: string };
}

/** The layout's feature switches and word lists, as plain data. */
export interface FrameFeatures {
  readonly rules?: boolean;
  readonly folds?: boolean;
  readonly keyboard?: boolean;
  /** The "Headlines | Full" switch of the "In short" box (parity Task 5); default false: the box as it always was. */
  readonly inShort?: boolean;
  readonly chrome?: ChromeOptions;
  readonly vocabulary?: VocabularyOptions;
}

export interface FrameOptions {
  /** Must pass checkFrameCsp with every inlined script's hash (use frameCsp(layout) for the layout chosen below). */
  readonly csp: string;
  /**
   * The layout this frame carries (one of FRAME_LAYOUTS), default `'default'`: `assets.enhance` is that layout's bundle,
   * and `assets.layoutCss` its stylesheet when it has one. A name that is not a layout is refused as invalid-input.
   */
  readonly layout?: FrameLayout;
  /** 32 lower-case hex digits, fresh per mount; it lives only in the seed. */
  readonly nonce: string;
  readonly assets: FrameAssets;
  readonly prefs?: Partial<FramePrefs>;
  /** The parent's stored state at mount: each value JSON text of at most 64 KiB, the total at most 1 MiB. */
  readonly snapshot?: Readonly<Partial<Record<BridgeStoreKey, string>>>;
  /**
   * null or absent: no Mermaid script; figures show their source. maxTextSize and maxEdges above
   * MERMAID_LIMIT_CEILINGS are refused as invalid-input: a host may only tighten them. `secure` defaults to [];
   * `draw` defaults to 'auto' (every figure drawn after enhance), 'on-request' draws a figure only on its Render tap, and 'after-ready' draws every figure once Mermaid has loaded after ready (ledger C107).
   */
  readonly mermaid?: {
    readonly maxTextSize?: number;
    readonly maxEdges?: number;
    readonly secure?: readonly string[];
    readonly draw?: MermaidDraw;
  } | null;
  readonly features?: FrameFeatures;
  /**
   * The host's appearance (the appearance contract, src/enhance/appearance.ts): any value, taken through parseAppearance,
   * whose verdict is seeded, so a bad slot never throws. Absent: no `appearance` key in the seed and an unhosted frame.
   */
  readonly appearance?: unknown;
  /**
   * Which ops the parent answers; each defaults to true except `progress`, `places` and `printFigures`, which default to
   * false (the frame sends `progress`, `place` and `print-figure` only to a parent that asked for them, and `hash`'s `push`
   * and `from` only under `places`). A false leaves that enhance callback absent.
   */
  readonly bridge?: {
    readonly links?: boolean;
    readonly hash?: boolean;
    readonly copy?: boolean;
    readonly changes?: boolean;
    readonly versions?: boolean;
    readonly progress?: boolean;
    readonly places?: boolean;
    readonly printFigures?: boolean;
  };
  /**
   * The resolved item links (parity Task 4): at most 50 `{ value, href }`, `value` 1 to 100 code units (an item value of
   * render()'s `meta.items`) and `href` an absolute `https:` URL of at most 4096 code units. The reader draws a link for a
   * value it asks for that is listed here, exactly, and leaves any other as text; a click goes the way every link goes
   * (`navigate`, the host decides). Anything else is refused as invalid-input. Absent or empty: no `items` key in the seed.
   */
  readonly items?: readonly ItemLink[];
  /**
   * The comparison base (parity Task 5): a full sha (40 or 64 lower-case hex), the commit of the last comparison the reader picked,
   * which the host recorded from a `changes` request (README, "Which request to record"). With the bridge's `changes` on, the reader asks `changes` for it once when it
   * starts and shows the comparison as "Changes since" shows one, labelled by that commit when `commits` names it, else "Since
   * your comparison". Anything else than a full sha is refused as invalid-input. Absent: no `changesBase` key in the seed.
   */
  readonly changesBase?: string;
  /** Default maxSrcdocChars(layout) (MAX_SRCDOC_CHARS_DEFAULT for `default`); a host may only lower it. */
  readonly maxSrcdocChars?: number;
}

/** The parts frameDocument writes into the skeleton, each exactly as it is emitted; Mermaid's is null when it is off. */
interface SrcdocParts {
  readonly policy: string;
  readonly guard: string;
  readonly seed: string;
  readonly bootstrap: string;
  readonly css: string;
  /** The chosen layout's own stylesheet, or null (`default`, which has none): joined to `css` by STYLE_JOIN. */
  readonly layoutCss: string | null;
  readonly enhance: string;
  readonly mermaid: string | null;
}

/** What joins reader.css and a layout's own stylesheet inside the one style element (scripts/build-frame.mjs's STYLE_JOIN). */
const STYLE_JOIN = '\n';

/** The srcdoc: Reference §2's fixed skeleton around its parts, on one line. The one place the skeleton is written. */
function srcdoc(p: SrcdocParts): string {
  return (
    `<meta http-equiv="Content-Security-Policy" content="${p.policy}">` +
    `<script>${p.guard}</script>` +
    `<script type="application/json">${p.seed}</script>` +
    `<script>${p.bootstrap}</script>` +
    `<style>${p.css}${p.layoutCss === null ? '' : `${STYLE_JOIN}${p.layoutCss}`}</style>` +
    `<script>${p.enhance}</script>` +
    (p.mermaid === null ? '' : `<script>${p.mermaid}</script>`)
  );
}

/**
 * The longest the skeleton around the parts can be (ruling C92): srcdoc's own fixed tags and attributes, measured by
 * writing it with every part empty and Mermaid's element present, plus the longest policy the floor admits
 * (CSP_MAX_CHARS, the floor's single definition). Derived, never written as a number, so a change to the skeleton or
 * to the floor's bound moves it. Internal: Reference §1 does not name it.
 */
const SKELETON_MAX_CHARS = srcdoc({ policy: '', guard: '', seed: '', bootstrap: '', css: '', layoutCss: null, enhance: '', mermaid: '' }).length + CSP_MAX_CHARS;

/**
 * The longest srcdoc frameDocument writes for `layout` (default `'default'`; Reference §3, FD17, parity Task 9): the html
 * cap, every asset that layout's frame inlines as FRAME_MANIFEST records its length (the guard, the bootstrap, the layout's
 * enhance bundle, reader.css, Mermaid's, and, for a layout that has one, its own stylesheet with the one character that joins
 * it to reader.css), the image URLs' share, every other seed field at its cap, and the skeleton around them at its longest
 * (C92). Derived from those sources, never written as a number, so a rebuild that moves an asset moves it (FD20), and so does
 * a change to the skeleton or to the policy's bound. A name that is not a layout is a TypeError.
 */
export function maxSrcdocChars(layout: FrameLayout = 'default'): number {
  if (!isFrameLayout(layout)) throw new TypeError('maxSrcdocChars: the layout is not one of FRAME_LAYOUTS');
  const own = LAYOUT_ENTRIES[layout];
  return (
    SEED_HTML_MAX_CHARS +
    FRAME_MANIFEST.guard.chars +
    FRAME_MANIFEST.bootstrap.chars +
    FRAME_MANIFEST[own.enhance].chars +
    FRAME_MANIFEST.css.chars +
    (own.css === null ? 0 : STYLE_JOIN.length + FRAME_MANIFEST[own.css].chars) +
    FRAME_MANIFEST.mermaid.chars +
    IMAGE_BUDGET_CHARS +
    SEED_FIELDS_MAX_CHARS +
    SKELETON_MAX_CHARS
  );
}

/** The longest srcdoc frameDocument writes by default: `maxSrcdocChars('default')`, whose value is what it was before layouts. */
export const MAX_SRCDOC_CHARS_DEFAULT = /* @__PURE__ */ maxSrcdocChars('default');

/** The most entries any list or record of the seed holds (images, 512): a longer host list is refused unread. */
const MAX_ENTRIES = SEED_LIMITS.images;

/**
 * The most values a seed the validator accepts holds outside its html, each string, number, boolean, null, list and
 * record counting one (Reference §3's caps, as SEED_LIMITS and the seed's key lists state them): the title and the lang;
 * the front list and the commits at their caps with every inner list full; one value per image and per snapshot entry;
 * every pref; every feature flag, chrome switch and vocabulary list full; Mermaid's secure keys and its other settings;
 * every bridge switch. Derived, never a literal. The host-data copy counts every value it visits, across one call,
 * against it: a host value that reaches one record down many paths is copied once per path, so without this count a
 * few dozen shared arrays under the depth cap would cost exponential time before any field is judged.
 */
export const HOST_VALUES_MAX = /* @__PURE__ */ hostValuesMax();

function hostValuesMax(): number {
  const L = SEED_LIMITS;
  const K = FEATURE_KEYS;
  const sum = (ns: readonly number[]): number => ns.reduce((a, b) => a + b, 0);
  const rec = (members: readonly number[]): number => 1 + sum(members);
  const list = (n: number, each: number): number => 1 + n * each;
  const words = list(L.words, 1);
  const vocabulary = rec([
    ...Object.values(K.groups).map((keys) => rec(keys.map(() => words))),
    ...K.grammars.map(() => rec([words])),
    ...K.lists.map(() => words),
  ]);
  return sum([
    1, // title
    list(L.frontEntries, rec([1, 1, list(L.frontItems, 1)])),
    rec([1, 1, list(L.commits, rec([1, 1, 1, list(L.parents, 1)])), 1]), // version
    L.images,
    MAX_ENTRIES, // snapshot values
    1, // lang
    rec(Object.keys(FRAME_PREF_VALUES).map(() => 1)),
    rec([...K.flags.map(() => 1), rec(K.chrome.map(() => 1)), vocabulary]), // features
    rec([1, 1, list(L.secureKeys, 1), 1]), // mermaid
    rec(BRIDGE_KEYS.map(() => 1)),
    list(ITEM_LIMITS.max, rec([1, 1])), // items
  ]);
}

/** Keys refused in host data at any depth, as the seed's validator refuses them. */
const PROTO_KEYS: readonly string[] = ['__proto__', 'constructor', 'prototype'];

function invalid(what: string): never {
  throw new FrameError('invalid-input', `frameDocument: ${what}`);
}

const isPlainObject = (v: unknown): v is object => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const p: unknown = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
};

/** The own data properties of a plain object, by name, enumerable or not; a getter refused unread; undefined left out. */
function ownEntries(v: object, what: string): [string, unknown][] {
  const names = Object.getOwnPropertyNames(v);
  if (names.length > MAX_ENTRIES) invalid(`${what} has more than ${String(MAX_ENTRIES)} entries`);
  const out: [string, unknown][] = [];
  for (const k of names) {
    const d = Object.getOwnPropertyDescriptor(v, k);
    if (d === undefined) continue;
    if (!('value' in d)) invalid(`${what}.${k} must be a plain value, not a getter`);
    if (d.value !== undefined) out.push([k, d.value as unknown]);
  }
  return out;
}

/** What is left of one frameDocument call's HOST_VALUES_MAX. */
interface Budget {
  left: number;
}

/**
 * A copy of host data as plain data, read once: strings, numbers, booleans and null as they are; arrays item by item,
 * by own index; plain objects by their own data properties. Anything else (a getter, a hole, a class instance, a Map, a
 * function, a symbol, a proto key, more than MAX_ENTRIES entries, deeper than the seed's depth cap, more values in the
 * call than HOST_VALUES_MAX) is invalid-input naming `what`. The depth cap is the seed validator's own, checked here
 * first so a deeper value is never walked; the value count is taken before a value is read, so a value past it is not.
 */
function dataOf(b: Budget, v: unknown, what: string, depth: number): unknown {
  b.left -= 1;
  if (b.left < 0) invalid(`the host data holds more than ${String(HOST_VALUES_MAX)} values, more than any seed carries (at ${what})`);
  // A number passes as it is: the seed's validator judges every number by its field.
  if (v === null || typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number') return v;
  if (depth > SEED_LIMITS.depth) invalid(`${what} is nested too deeply`);
  if (Array.isArray(v)) {
    const n: unknown = v.length;
    if (typeof n !== 'number' || n > MAX_ENTRIES) invalid(`${what} has more than ${String(MAX_ENTRIES)} entries`);
    const out: unknown[] = [];
    for (let i = 0; i < n; i += 1) {
      // A hole or a getter (never called) reads as undefined, which is not plain data.
      const d = Object.getOwnPropertyDescriptor(v, String(i));
      out.push(dataOf(b, d !== undefined && 'value' in d ? d.value : undefined, `${what}[${String(i)}]`, depth + 1));
    }
    return out;
  }
  if (!isPlainObject(v)) invalid(`${what} must be plain data`);
  const out: Record<string, unknown> = {};
  for (const [k, x] of ownEntries(v, what)) {
    if (PROTO_KEYS.includes(k)) invalid(`${what} holds the key ${k}`);
    out[k] = dataOf(b, x, `${what}.${k}`, depth + 1);
  }
  return out;
}

/**
 * A plain object of host data, copied; with `keys`, holding only those (the seed's validator judges the keys of the
 * others). Absent (undefined) gives an empty one.
 */
function fieldsOf(b: Budget, v: unknown, what: string, keys: readonly string[] | null = null): Record<string, unknown> {
  if (v === undefined) return {};
  const out = dataOf(b, v, what, 1);
  if (!isPlainObject(out)) invalid(`${what} must be a plain object`);
  const unknown = keys === null ? [] : Object.keys(out).filter((k) => !keys.includes(k));
  if (unknown.length > 0) invalid(`${what} has unknown keys: ${unknown.join(', ')}`);
  return out as Record<string, unknown>;
}

/** Field `k` of copied host data, or `fallback` when the host left it out (a null is kept, for the validator to judge). */
const field = (f: Record<string, unknown>, k: string, fallback: unknown): unknown => (Object.hasOwn(f, k) ? f[k] : fallback);

/**
 * A record of host data, as [key, value] pairs, each value copied: its keys are data (an image ref may be any string,
 * `__proto__` included), and the seed's validator judges every pair.
 */
function pairsOf(b: Budget, v: unknown, what: string): [string, unknown][] {
  if (v === undefined) return [];
  if (!isPlainObject(v)) invalid(`${what} must be a plain object`);
  return ownEntries(v, what).map(([k, x]) => [k, dataOf(b, x, `${what}[${JSON.stringify(k)}]`, 1)]);
}

/** A base64 character's six bits, or -1: the first six characters of a face are decoded to read its signature. */
const sextet = (c: string): number => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.indexOf(c);

/** Base64 as `atob` reads it: whole quanta, then an optional final quantum of two or three characters with its padding. */
const STRICT_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}(?:==)?|[A-Za-z0-9+/]{3}=?)?$/;

/** True for a face the frame may load: the base64 alphabet, at most the cap in characters and in decoded bytes, and the woff2 signature `wOF2`. */
function goodFace(b64: string): boolean {
  if (b64.length > SEED_LIMITS.fontFaceMaxChars || b64.length < 6 || !BASE64_FACE.test(b64) || !STRICT_BASE64.test(b64)) return false;
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  if (Math.floor(((b64.length - pad) * 3) / 4) > SEED_LIMITS.fontFaceMaxBytes) return false;
  const [a, b, c, d, e, f] = Array.from({ length: 6 }, (_, i) => sextet(b64.charAt(i)));
  if ([a, b, c, d, e, f].some((x) => x === undefined || x < 0)) return false;
  // The first four decoded bytes, 'w' 'O' 'F' '2'.
  const bytes = [((a as number) << 2) | ((b as number) >> 4), (((b as number) & 15) << 4) | ((c as number) >> 2), (((c as number) & 3) << 6) | (d as number), ((e as number) << 2) | ((f as number) >> 4)];
  return bytes.join(',') === '119,79,70,50';
}

/**
 * The faces of `assets.fonts`, or undefined when there is none to seed. A `fonts` that is not a plain object, a key other
 * than `sans` and `mono` (a symbol too), a getter or a face that is not a string is a TypeError; a face that fails goodFace
 * is dropped. A property whose value is undefined is left out, as every host value is. Written in role order.
 */
export function fontsOf(f: unknown): SeedFonts | undefined {
  if (f === undefined) return undefined;
  if (!isPlainObject(f)) throw new TypeError('frameDocument: assets.fonts must be a plain object');
  const faces: Record<string, unknown> = {};
  for (const k of Reflect.ownKeys(f)) {
    if (typeof k !== 'string' || !(FONT_ROLES as readonly string[]).includes(k)) throw new TypeError('frameDocument: assets.fonts has a key other than sans and mono');
    const d = Object.getOwnPropertyDescriptor(f, k);
    if (d === undefined || !('value' in d)) throw new TypeError(`frameDocument: assets.fonts.${k} must be a plain value, not a getter`);
    if (d.value !== undefined && typeof d.value !== 'string') throw new TypeError(`frameDocument: assets.fonts.${k} must be a string`);
    faces[k] = d.value;
  }
  const out: Record<string, string> = {};
  for (const role of FONT_ROLES) {
    const face = faces[role];
    if (typeof face === 'string' && goodFace(face)) out[role] = face;
  }
  return Object.keys(out).length === 0 ? undefined : (out as SeedFonts);
}

/** The resolved item links, copied as plain data and judged in full (src/frame/items.ts); undefined when there are none to seed. */
function itemsOf(b: Budget, v: unknown): SeedItem[] | undefined {
  if (v === undefined) return undefined;
  const copy = dataOf(b, v, 'items', 1);
  const why = itemsWhy(copy);
  if (why !== null) invalid(why);
  return (copy as SeedItem[]).length === 0 ? undefined : (copy as SeedItem[]);
}

/** Mermaid's settings, copied and completed with `secure: []` and `draw: 'auto'`; above a ceiling is refused. */
function mermaidOf(b: Budget, m: unknown): SeedMermaid | null {
  if (m === undefined || m === null) return null;
  const f = fieldsOf(b, m, 'mermaid', ['maxTextSize', 'maxEdges', 'secure', 'draw']);
  for (const k of ['maxTextSize', 'maxEdges'] as const) {
    const v = f[k];
    if (typeof v === 'number' && v > MERMAID_LIMIT_CEILINGS[k]) invalid(`mermaid.${k} above ${String(MERMAID_LIMIT_CEILINGS[k])}: a host may only lower it`);
  }
  const caps = Object.fromEntries((['maxTextSize', 'maxEdges'] as const).filter((k) => Object.hasOwn(f, k)).map((k) => [k, f[k]]));
  return { ...caps, secure: field(f, 'secure', []), draw: field(f, 'draw', 'auto') } as SeedMermaid;
}

/** The bridge switches that are off unless the host asks for them; the others default to true. Held here, not in seed.ts: only the host side reads it, and seed.ts is bundled into the bootstrap. */
const BRIDGE_OFF_BY_DEFAULT: readonly (typeof BRIDGE_KEYS)[number][] = ['progress', 'places', 'printFigures'];

/** The bridge switches, copied, each absent one true, except `progress`, `places` and `printFigures`: absent, each is false. */
function bridgeOf(budget: Budget, b: unknown): Seed['bridge'] {
  const f = fieldsOf(budget, b, 'bridge', BRIDGE_KEYS);
  return Object.fromEntries(BRIDGE_KEYS.map((k) => [k, field(f, k, !BRIDGE_OFF_BY_DEFAULT.includes(k))])) as Seed['bridge'];
}

/**
 * The asset text, verified: the byte rules first (unsafe-asset), so a planted hazard is named as itself, then its sha256
 * against FRAME_MANIFEST (asset-mismatch). The build already holds every shipped asset to the byte rules; this is the
 * second check behind it (Reference §4).
 */
function verify(name: keyof typeof FRAME_MANIFEST, text: unknown, as: string = name): string {
  if (typeof text !== 'string') throw new FrameError('asset-mismatch', `frameDocument: assets.${as} is not a string`);
  const hazards = name.startsWith('css') ? cssHazards(text) : scriptHazards(text);
  if (hazards.length > 0) throw new FrameError('unsafe-asset', `frameDocument: assets.${as} holds ${hazards.join(', ')}`);
  const m = FRAME_MANIFEST[name];
  if (hex(sha256Text(text)) !== m.sha256) throw new FrameError('asset-mismatch', `frameDocument: assets.${as} differs from ${m.path}`);
  return text;
}

/** The srcdoc for one mount of the sealed reader frame. Throws FrameError on any refusal (Reference §4). */
export function frameDocument(r: RenderInput, o: FrameOptions): string {
  const result: unknown = typeof r === 'object' && r !== null ? r.result : undefined;
  if (typeof result !== 'object' || result === null) invalid('result');
  const { outcome, html, meta } = result as RenderInput['result'];
  if (outcome !== 'rendered') throw new FrameError('not-rendered', `frameDocument: the document did not render (${String(outcome)})`);
  if (typeof o !== 'object' || o === null) invalid('options');
  if (!isNonce(o.nonce)) throw new FrameError('nonce', 'frameDocument: the nonce must be 32 lower-case hex digits');
  if (typeof html !== 'string') invalid('result.html');
  // The html as the seed carries it (FD17): a string longer than the cap is over it whatever it holds, so it is never
  // measured.
  if (html.length > SEED_HTML_MAX_CHARS || escapedHtmlLength(html) > SEED_HTML_MAX_CHARS) {
    throw new FrameError('too-large', `frameDocument: the html is over ${String(SEED_HTML_MAX_CHARS)} characters as the seed carries it`);
  }
  // The layout, read once: the default when absent; any other name that is not a layout is refused.
  const layoutName: unknown = o.layout === undefined ? 'default' : o.layout;
  if (!isFrameLayout(layoutName)) invalid(`layout must be one of the frame's layouts`);
  const layout: FrameLayout = layoutName as FrameLayout;
  const layoutCap = maxSrcdocChars(layout);
  const maxChars: unknown = o.maxSrcdocChars === undefined ? layoutCap : o.maxSrcdocChars;
  if (!Number.isInteger(maxChars) || (maxChars as number) < 1 || (maxChars as number) > layoutCap) {
    invalid(`maxSrcdocChars must be an integer from 1 to ${String(layoutCap)}: a host may only lower it`);
  }
  if (typeof meta !== 'object' || meta === null) invalid('result.meta');
  // An initialHash outside FRAGMENT_ID_GRAMMAR is ignored (seeded as null), never refused (ruling R1): a host may
  // forward a user's URL fragment as it found it.
  const hash: unknown = r.initialHash ?? null;
  const b: Budget = { left: HOST_VALUES_MAX };
  const version = fieldsOf(b, r.version, 'version', ['sha', 'draft', 'commits', 'only']);
  const mermaidOptions = mermaidOf(b, o.mermaid);
  // The two optional fields of the appearance contract: the host's verdict, and the faces that pass.
  const assetsRaw: unknown = o.assets;
  // The faces are seeded whenever a host gives them; the frame loads them, and its stylesheet uses them only while hosted.
  const fonts = typeof assetsRaw === 'object' && assetsRaw !== null ? fontsOf((assetsRaw as FrameAssets).fonts) : undefined;
  const items = itemsOf(b, o.items);
  const changesBase: unknown = o.changesBase;
  if (changesBase !== undefined && !isFullSha(changesBase)) invalid('changesBase must be a full sha: 40 or 64 lower-case hex digits');
  const appearance = o.appearance === undefined ? undefined : (parseAppearance(o.appearance).appearance as SeedAppearance);
  const fields: Seed = {
    s: 1,
    nonce: o.nonce,
    html: '',
    title: dataOf(b, meta.title, 'meta.title', 1) as string | null,
    frontList: dataOf(b, meta.frontList, 'meta.frontList', 1) as Seed['frontList'],
    version: {
      sha: field(version, 'sha', null) as string | null,
      draft: field(version, 'draft', false) as boolean,
      commits: field(version, 'commits', null) as Seed['version']['commits'],
      only: field(version, 'only', null) as string | null,
    },
    images: pairsOf(b, r.images, 'images') as [string, string][],
    initialHash: isFragmentId(hash) ? hash : null,
    lang: r.lang === undefined ? 'en' : (dataOf(b, r.lang, 'lang', 1) as string),
    prefs: fieldsOf(b, o.prefs, 'prefs') as Seed['prefs'],
    snapshot: pairsOf(b, o.snapshot, 'snapshot') as [BridgeStoreKey, string][],
    features: fieldsOf(b, o.features, 'features') as Seed['features'],
    mermaid: mermaidOptions,
    bridge: bridgeOf(b, o.bridge),
    ...(appearance === undefined ? {} : { appearance }),
    ...(fonts === undefined ? {} : { fonts }),
    ...(items === undefined ? {} : { items }),
    ...(changesBase === undefined ? {} : { changesBase }),
  };
  // Every field but the html (judged above, by its own cap) through the bootstrap's own validator.
  const check = validateSeed(fields);
  // The vocabulary's words are judged here in full (the bootstrap's validator holds the field to a plain object, src/frame/vocabulary.ts),
  // and refused as the validator's own check did before the split, in its place in the order: a seed with two faults names the first
  // the old validator reached. It judged `features` after the fields up to `prefs` and `snapshot`, and before `mermaid`, `bridge` and
  // the optional keys, so a refusal of those later fields gives way to a vocabulary that is not whole.
  const later = !check.ok && (check.why === 'bridge' || check.why.startsWith('mermaid') || OPTIONAL_SEED_KEYS.includes(check.why));
  if ((check.ok || later) && fields.features.vocabulary !== undefined && !vocabularyOk(fields.features.vocabulary)) invalid('the seed is refused (features.vocabulary)');
  if (!check.ok) invalid(`the seed is refused (${check.why})`);
  const a: unknown = o.assets;
  if (typeof a !== 'object' || a === null) invalid('assets');
  const supplied = a as FrameAssets;
  const guard = verify('guard', supplied.guard);
  const bootstrap = verify('bootstrap', supplied.bootstrap);
  const own = LAYOUT_ENTRIES[layout];
  const enhance = verify(own.enhance, supplied.enhance, 'enhance');
  const css = verify('css', supplied.css);
  // The layout's own stylesheet: required when the layout has one, refused when it has none (`default` has none).
  const layoutCssAsset: unknown = supplied.layoutCss;
  let layoutCss: string | null = null;
  if (own.css === null) {
    if (layoutCssAsset !== undefined) throw new FrameError('asset-mismatch', `frameDocument: assets.layoutCss is given, but the ${layout} layout has no stylesheet of its own`);
  } else {
    if (layoutCssAsset === undefined) throw new FrameError('missing-asset', `frameDocument: the ${layout} layout needs assets.layoutCss`);
    layoutCss = verify(own.css, layoutCssAsset, 'layoutCss');
  }
  // Any supplied asset is verified (Reference §4), Mermaid's whether or not this mount inlines it.
  const mermaidAsset: unknown = supplied.mermaid;
  const mermaidText = mermaidAsset === undefined ? null : verify('mermaid', mermaidAsset);
  // 'after-ready': the build is never inlined and never required here (the host sends it over the port after ready, and
  // the frame inserts it), but the policy must still list its hash, or the late script is blocked (C107).
  const late = mermaidOptions !== null && mermaidOptions.draw === 'after-ready';
  if (mermaidOptions !== null && !late && mermaidText === null) throw new FrameError('missing-asset', 'frameDocument: mermaid is on but assets.mermaid is absent');
  const mermaid = mermaidOptions === null || late ? null : mermaidText;
  // The chosen layout's hashes: the guard, the bootstrap and that layout's enhance bundle (never another layout's).
  const required: string[] = [FRAME_MANIFEST.guard.csp, FRAME_MANIFEST.bootstrap.csp, FRAME_MANIFEST[own.enhance].csp];
  if (mermaidOptions !== null) required.push(FRAME_MANIFEST.mermaid.csp);
  // The policy is read once: the string checked is the string emitted.
  const policy: unknown = o.csp;
  const csp = checkFrameCsp(policy as string, required);
  if (!csp.ok) throw new FrameError('csp', `frameDocument: the policy is refused (${csp.why})`);
  const seed = serializeSeed({ ...fields, html });
  const out = srcdoc({ policy: policy as string, guard, seed, bootstrap, css, layoutCss, enhance, mermaid });
  if (out.length > (maxChars as number)) throw new FrameError('too-large', `frameDocument: the srcdoc is over ${String(maxChars)} characters`);
  return out;
}
