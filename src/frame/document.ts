// frameDocument: the srcdoc of the sealed reader frame (docserver L3; plan Reference §1 to §4). Validates its inputs,
// verifies every asset against the generated manifest, cross-checks the policy, and joins the fixed skeleton, on one
// line, with no whitespace or comment between elements:
//
//   <meta http-equiv="Content-Security-Policy" content="{csp}">
//   <script>{guard.js}</script>
//   <script type="application/json">{seed}</script>
//   <script>{bootstrap.js}</script>
//   <style>{frame/reader.css}</style>
//   <script>{enhance.js}</script>
//   <script>{mermaid.frame.js}</script>        only when FrameOptions.mermaid is non-null
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
// and an initialHash outside FRAGMENT_ID_GRAMMAR seeded as null, never refused (ruling R1). Every supplied asset is
// verified, Mermaid's too when Mermaid is off (Reference §4: "any supplied asset"). The skeleton is written in one place
// (srcdoc), and MAX_SRCDOC_CHARS_DEFAULT counts it at its longest (ruling C92).
import type { FrontEntry, RenderOutcome } from '../render/types.js';
import { cssHazards, scriptHazards } from './bytes.js';
import { checkFrameCsp } from './csp.js';
import { CSP_MAX_CHARS } from './csp-rules.js';
import { MERMAID_LIMIT_CEILINGS } from './gate.js';
import { FRAME_MANIFEST } from './manifest.generated.js';
import { isFragmentId } from './fragment.js';
import { FRAME_PREF_VALUES, type BridgeStoreKey } from './protocol.js';
import {
  BRIDGE_KEYS,
  escapedHtmlLength,
  FEATURE_KEYS,
  IMAGE_BUDGET_CHARS,
  isNonce,
  SEED_FIELDS_MAX_CHARS,
  SEED_HTML_MAX_CHARS,
  SEED_LIMITS,
  serializeSeed,
  validateSeed,
  type MermaidDraw,
  type Seed,
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
    readonly meta: { readonly title: string | null; readonly frontList: readonly FrontEntry[] | null };
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
  readonly enhance: string;
  readonly css: string;
  /** assets/mermaid/mermaid.frame.js; required when FrameOptions.mermaid is non-null. */
  readonly mermaid?: string;
}

/** The layout's feature switches and word lists, as plain data. */
export interface FrameFeatures {
  readonly rules?: boolean;
  readonly folds?: boolean;
  readonly keyboard?: boolean;
  readonly chrome?: ChromeOptions;
  readonly vocabulary?: VocabularyOptions;
}

export interface FrameOptions {
  /** Must pass checkFrameCsp with every inlined script's hash. */
  readonly csp: string;
  /** 32 lower-case hex digits, fresh per mount; it lives only in the seed. */
  readonly nonce: string;
  readonly assets: FrameAssets;
  readonly prefs?: Partial<FramePrefs>;
  /** The parent's stored state at mount: each value JSON text of at most 64 KiB, the total at most 1 MiB. */
  readonly snapshot?: Readonly<Partial<Record<BridgeStoreKey, string>>>;
  /**
   * null or absent: no Mermaid script; figures show their source. maxTextSize and maxEdges above
   * MERMAID_LIMIT_CEILINGS are refused as invalid-input: a host may only tighten them. `secure` defaults to [];
   * `draw` defaults to 'auto' (every figure drawn after enhance), and 'on-request' draws a figure only on its Render tap.
   */
  readonly mermaid?: {
    readonly maxTextSize?: number;
    readonly maxEdges?: number;
    readonly secure?: readonly string[];
    readonly draw?: MermaidDraw;
  } | null;
  readonly features?: FrameFeatures;
  /** Which ops the parent answers; each defaults to true. A false leaves that enhance callback absent. */
  readonly bridge?: {
    readonly links?: boolean;
    readonly hash?: boolean;
    readonly copy?: boolean;
    readonly changes?: boolean;
    readonly versions?: boolean;
  };
  /** Default MAX_SRCDOC_CHARS_DEFAULT; a host may only lower it. */
  readonly maxSrcdocChars?: number;
}

/** The parts frameDocument writes into the skeleton, each exactly as it is emitted; Mermaid's is null when it is off. */
interface SrcdocParts {
  readonly policy: string;
  readonly guard: string;
  readonly seed: string;
  readonly bootstrap: string;
  readonly css: string;
  readonly enhance: string;
  readonly mermaid: string | null;
}

/** The srcdoc: Reference §2's fixed skeleton around its parts, on one line. The one place the skeleton is written. */
function srcdoc(p: SrcdocParts): string {
  return (
    `<meta http-equiv="Content-Security-Policy" content="${p.policy}">` +
    `<script>${p.guard}</script>` +
    `<script type="application/json">${p.seed}</script>` +
    `<script>${p.bootstrap}</script>` +
    `<style>${p.css}</style>` +
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
const SKELETON_MAX_CHARS = srcdoc({ policy: '', guard: '', seed: '', bootstrap: '', css: '', enhance: '', mermaid: '' }).length + CSP_MAX_CHARS;

/**
 * The longest srcdoc frameDocument writes by default (Reference §3, FD17): the html cap, every frame asset's length
 * (Mermaid's included) as FRAME_MANIFEST records it, the image URLs' share, every other seed field at its cap, and the
 * skeleton around them at its longest (C92). Derived from those five sources, never written as a number, so a rebuild
 * that moves an asset moves it (FD20), and so does a change to the skeleton or to the policy's bound.
 */
export const MAX_SRCDOC_CHARS_DEFAULT =
  SEED_HTML_MAX_CHARS +
  FRAME_MANIFEST.guard.chars +
  FRAME_MANIFEST.bootstrap.chars +
  FRAME_MANIFEST.enhance.chars +
  FRAME_MANIFEST.css.chars +
  FRAME_MANIFEST.mermaid.chars +
  IMAGE_BUDGET_CHARS +
  SEED_FIELDS_MAX_CHARS +
  SKELETON_MAX_CHARS;

const SCRIPTS = ['guard', 'bootstrap', 'enhance'] as const;

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

/** The bridge switches, copied, each absent one true. */
function bridgeOf(budget: Budget, b: unknown): Seed['bridge'] {
  const f = fieldsOf(budget, b, 'bridge', BRIDGE_KEYS);
  return Object.fromEntries(BRIDGE_KEYS.map((k) => [k, field(f, k, true)])) as Seed['bridge'];
}

/**
 * The asset text, verified: the byte rules first (unsafe-asset), so a planted hazard is named as itself, then its sha256
 * against FRAME_MANIFEST (asset-mismatch). The build already holds every shipped asset to the byte rules; this is the
 * second check behind it (Reference §4).
 */
function verify(name: keyof typeof FRAME_MANIFEST, text: unknown): string {
  if (typeof text !== 'string') throw new FrameError('asset-mismatch', `frameDocument: assets.${name} is not a string`);
  const hazards = name === 'css' ? cssHazards(text) : scriptHazards(text);
  if (hazards.length > 0) throw new FrameError('unsafe-asset', `frameDocument: assets.${name} holds ${hazards.join(', ')}`);
  const m = FRAME_MANIFEST[name];
  if (hex(sha256Text(text)) !== m.sha256) throw new FrameError('asset-mismatch', `frameDocument: assets.${name} differs from ${m.path}`);
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
  const maxSrcdocChars: unknown = o.maxSrcdocChars === undefined ? MAX_SRCDOC_CHARS_DEFAULT : o.maxSrcdocChars;
  if (!Number.isInteger(maxSrcdocChars) || (maxSrcdocChars as number) < 1 || (maxSrcdocChars as number) > MAX_SRCDOC_CHARS_DEFAULT) {
    invalid(`maxSrcdocChars must be an integer from 1 to ${String(MAX_SRCDOC_CHARS_DEFAULT)}: a host may only lower it`);
  }
  if (typeof meta !== 'object' || meta === null) invalid('result.meta');
  // An initialHash outside FRAGMENT_ID_GRAMMAR is ignored (seeded as null), never refused (ruling R1): a host may
  // forward a user's URL fragment as it found it.
  const hash: unknown = r.initialHash ?? null;
  const b: Budget = { left: HOST_VALUES_MAX };
  const version = fieldsOf(b, r.version, 'version', ['sha', 'draft', 'commits', 'only']);
  const mermaidOptions = mermaidOf(b, o.mermaid);
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
  };
  // Every field but the html (judged above, by its own cap) through the bootstrap's own validator.
  const check = validateSeed(fields);
  if (!check.ok) invalid(`the seed is refused (${check.why})`);
  const a: unknown = o.assets;
  if (typeof a !== 'object' || a === null) invalid('assets');
  const supplied = a as FrameAssets;
  const guard = verify('guard', supplied.guard);
  const bootstrap = verify('bootstrap', supplied.bootstrap);
  const enhance = verify('enhance', supplied.enhance);
  const css = verify('css', supplied.css);
  // Any supplied asset is verified (Reference §4), Mermaid's whether or not this mount inlines it.
  const mermaidAsset: unknown = supplied.mermaid;
  const mermaidText = mermaidAsset === undefined ? null : verify('mermaid', mermaidAsset);
  if (mermaidOptions !== null && mermaidText === null) throw new FrameError('missing-asset', 'frameDocument: mermaid is on but assets.mermaid is absent');
  const mermaid = mermaidOptions === null ? null : mermaidText;
  const required: string[] = SCRIPTS.map((k) => FRAME_MANIFEST[k].csp);
  if (mermaid !== null) required.push(FRAME_MANIFEST.mermaid.csp);
  // The policy is read once: the string checked is the string emitted.
  const policy: unknown = o.csp;
  const csp = checkFrameCsp(policy as string, required);
  if (!csp.ok) throw new FrameError('csp', `frameDocument: the policy is refused (${csp.why})`);
  const seed = serializeSeed({ ...fields, html });
  const out = srcdoc({ policy: policy as string, guard, seed, bootstrap, css, enhance, mermaid });
  if (out.length > (maxSrcdocChars as number)) throw new FrameError('too-large', `frameDocument: the srcdoc is over ${String(maxSrcdocChars)} characters`);
  return out;
}
