// The verdict of a hostile or generated corpus case (docserver L1; architecture sections D, E and F, Task 11).
// A verdict states what must hold of a render without pinning its exact output: the outcome, structural
// bounds, strings that must or must not appear, and a time bound. Verdicts live in conformance/hostile.json
// and only ever tighten: scripts/ratchet.mjs compares every change with its base and refuses a weaker one.
//
// How each arm is read (evaluateVerdict), all on the raw html render() returned:
// - outcome: equal; an over-limit render must also have empty html.
// - maxMs: the render call's wall-clock time is at most maxMs x timeScale (runCorpus's option, default 1).
// - maxOutputRatio: UTF-8 bytes of html / UTF-8 bytes of input (an empty input counts as one byte).
// - maxTagDepth: per element name, the deepest nesting of its own tags (other elements do not count).
// - forbid: none of the strings occurs, compared with ASCII letters folded, so `<SCRIPT` is `<script`.
//   Every `<` and `"` that is text is escaped, so `<x` and `x="` only ever match real markup.
// - require: every string occurs exactly as written.
// - balanced: per element name, as many closing tags as opening ones, and no closing tag before its opener.
// - headingIds: the h1-h6 ids in the html are exactly base, base-1, ..., base-(count-1), in order.
// - scan: scanRefs(input) (runCorpus's `scanRefs` option) returns at most maxImages images, says
//   imagesTruncated exactly as stated, and its outcome matches render()'s.
// - nullPrototypeFront: meta.front is a record whose prototype is null.
// - exact: the case also has a golden under conformance/expected/, which runCorpus compares; this arm is
//   bookkeeping, checked by loadCorpus (hostile.ts crossCheck) rather than here.
import { Buffer } from 'node:buffer';
import type { RenderOutcome, RenderResult, ScanRefsResult } from '../render/types.js';

export interface Verdict {
  /** The outcome the render must have. */
  outcome: RenderOutcome;
  /** Wall-clock bound in milliseconds, before runCorpus's time scale. */
  maxMs?: number;
  /** Bound on UTF-8 output bytes divided by UTF-8 input bytes. */
  maxOutputRatio?: number;
  /** Bound on the nesting depth of each named element. */
  maxTagDepth?: Readonly<Record<string, number>>;
  /** Strings the output must not contain (ASCII letters folded). */
  forbid?: readonly string[];
  /** Strings the output must contain (exactly). */
  require?: readonly string[];
  /** Elements whose opening and closing tags must balance. */
  balanced?: readonly string[];
  /** The case also has an exact golden under conformance/expected/. */
  exact?: true;
  /** The headings' ids must be `base`, `base-1`, … `base-(count-1)`, in order. */
  headingIds?: { readonly base: string; readonly count: number };
  /** What scanRefs must report for the same input. */
  scan?: { readonly maxImages: number; readonly imagesTruncated: boolean };
  /** meta.front must be a null-prototype record. */
  nullPrototypeFront?: true;
}

/** What evaluateVerdict needs besides the result: how long the render took, and the scan if one was made. */
export interface VerdictContext {
  /** Wall-clock milliseconds of the render call. */
  readonly ms: number;
  /** Multiplies maxMs, for slower machines; default 1. */
  readonly timeScale?: number;
  /** scanRefs' result for the input; null when no scanRefs function was given. Read only by a scan arm. */
  readonly scan?: ScanRefsResult | null;
}

/** Every key a verdict may have; the type makes this list complete (scripts/ratchet.mjs keeps its own copy). */
const KEYS: { readonly [K in keyof Required<Verdict>]: true } = {
  outcome: true,
  maxMs: true,
  maxOutputRatio: true,
  maxTagDepth: true,
  forbid: true,
  require: true,
  balanced: true,
  exact: true,
  headingIds: true,
  scan: true,
  nullPrototypeFront: true,
};
export const VERDICT_KEYS: readonly (keyof Verdict)[] = Object.freeze(Object.keys(KEYS) as (keyof Verdict)[]);

/** Every outcome a verdict may name; the type makes this list complete, so a new render outcome is named here. */
const OUTCOME_WORDS: { readonly [K in RenderOutcome]: true } = {
  rendered: true,
  'over-limit': true,
  'output-over-limit': true,
  failed: true,
};
const OUTCOMES: ReadonlySet<string> = new Set(Object.keys(OUTCOME_WORDS));
const TAG_NAME = /^[a-z][a-z0-9]*$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

function stringList(v: unknown, where: string, tags: boolean): void {
  if (!Array.isArray(v) || v.some((s) => typeof s !== 'string' || s === '' || (tags && !TAG_NAME.test(s)))) {
    throw new TypeError(`${where} must be a list of non-empty ${tags ? 'tag names' : 'strings'}`);
  }
  if (new Set(v).size !== v.length) throw new TypeError(`${where} lists a value twice`);
}

/** Read a verdict from JSON; throws a TypeError naming `where` on anything this version cannot evaluate. */
export function parseVerdict(raw: unknown, where: string): Verdict {
  if (!isRecord(raw)) throw new TypeError(`${where}: the verdict is not an object`);
  const unknown = Object.keys(raw).filter((k) => !Object.hasOwn(KEYS, k));
  if (unknown.length > 0) throw new TypeError(`${where}: unknown verdict keys: ${unknown.join(', ')}`);
  const v = raw;
  if (typeof v['outcome'] !== 'string' || !OUTCOMES.has(v['outcome'])) {
    throw new TypeError(`${where}: outcome must be rendered, over-limit, output-over-limit or failed`);
  }
  if (v['maxMs'] !== undefined && (!isCount(v['maxMs']) || v['maxMs'] === 0)) {
    throw new TypeError(`${where}: maxMs must be a positive integer`);
  }
  const ratio = v['maxOutputRatio'];
  if (ratio !== undefined && !(typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0)) {
    throw new TypeError(`${where}: maxOutputRatio must be a positive number`);
  }
  const depth = v['maxTagDepth'];
  if (depth !== undefined) {
    if (!isRecord(depth) || Object.entries(depth).some(([k, n]) => !TAG_NAME.test(k) || !isCount(n))) {
      throw new TypeError(`${where}: maxTagDepth must map tag names to counts`);
    }
  }
  if (v['forbid'] !== undefined) stringList(v['forbid'], `${where}: forbid`, false);
  if (v['require'] !== undefined) stringList(v['require'], `${where}: require`, false);
  if (v['balanced'] !== undefined) stringList(v['balanced'], `${where}: balanced`, true);
  for (const flag of ['exact', 'nullPrototypeFront']) {
    if (v[flag] !== undefined && v[flag] !== true) throw new TypeError(`${where}: ${flag} is true or absent`);
  }
  const ids = v['headingIds'];
  if (ids !== undefined) {
    if (!isRecord(ids) || Object.keys(ids).sort().join() !== 'base,count' || typeof ids['base'] !== 'string' ||
      !isCount(ids['count']) || ids['count'] === 0) {
      throw new TypeError(`${where}: headingIds must be {base, count} with a positive count`);
    }
  }
  const scan = v['scan'];
  if (scan !== undefined) {
    if (!isRecord(scan) || Object.keys(scan).sort().join() !== 'imagesTruncated,maxImages' ||
      !isCount(scan['maxImages']) || typeof scan['imagesTruncated'] !== 'boolean') {
      throw new TypeError(`${where}: scan must be {maxImages, imagesTruncated}`);
    }
  }
  return raw as unknown as Verdict;
}

/** ASCII letters to lower case; nothing else changes. */
function asciiLower(s: string): string {
  return s.replace(/[A-Z]+/g, (m) => m.toLowerCase());
}

/** Every tag of the html, in order. Text never holds a raw `<`, so each match is markup the renderer wrote. */
function* tags(html: string): Generator<{ close: boolean; name: string; selfClosing: boolean }> {
  for (const m of html.matchAll(/<(\/?)([a-z][a-z0-9]*)(?=[\s/>])[^>]*>/g)) {
    yield { close: m[1] === '/', name: m[2] ?? '', selfClosing: m[0].endsWith('/>') };
  }
}

/** The deepest nesting of one element's own tags. */
export function tagDepth(html: string, name: string): number {
  let depth = 0;
  let max = 0;
  for (const t of tags(html)) {
    if (t.name !== name || t.selfClosing) continue;
    if (t.close) {
      depth -= 1;
    } else {
      depth += 1;
      if (depth > max) max = depth;
    }
  }
  return max;
}

/** Why one element's tags do not balance, or null when they do. */
export function imbalance(html: string, name: string): string | null {
  let opens = 0;
  let closes = 0;
  for (const t of tags(html)) {
    if (t.name !== name || t.selfClosing) continue;
    if (t.close) {
      closes += 1;
      if (closes > opens) return `</${name}> number ${closes} comes before its opening tag`;
    } else {
      opens += 1;
    }
  }
  return opens === closes ? null : `${name} opens ${opens} times and closes ${closes} times`;
}

/** The four entities markdown-it writes into an attribute value, decoded. */
function attrText(s: string): string {
  return s.replace(/&(?:amp|lt|gt|quot);/g, (e) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' })[e] ?? e);
}

function checkHeadingIds(html: string, want: { base: string; count: number }): string[] {
  const ids = [...html.matchAll(/<h[1-6] id="([^"]*)"/g)].map((m) => attrText(m[1] ?? ''));
  if (ids.length !== want.count) return [`headingIds: expected ${want.count} headings, found ${ids.length}`];
  const at = ids.findIndex((id, i) => id !== (i === 0 ? want.base : `${want.base}-${i}`));
  if (at < 0) return [];
  const expected = at === 0 ? want.base : `${want.base}-${at}`;
  return [`headingIds: heading ${at} has id ${JSON.stringify(ids[at])}, expected ${JSON.stringify(expected)}`];
}

function checkScan(verdict: Verdict, want: NonNullable<Verdict['scan']>, scan: ScanRefsResult | null | undefined): string[] {
  if (scan === undefined || scan === null) {
    return ['scan: no scanRefs function was given; pass runCorpus(render, { scanRefs })'];
  }
  const out: string[] = [];
  const outcome = verdict.outcome === 'over-limit' ? 'over-limit' : 'scanned';
  if (scan.outcome !== outcome) out.push(`scan: outcome expected "${outcome}", got ${JSON.stringify(scan.outcome)}`);
  if (scan.images.length > want.maxImages) out.push(`scan: ${scan.images.length} images, bound ${want.maxImages}`);
  if (scan.imagesTruncated !== want.imagesTruncated) {
    out.push(`scan: imagesTruncated expected ${String(want.imagesTruncated)}, got ${String(scan.imagesTruncated)}`);
  }
  return out;
}

/** Every way `result` breaks `verdict`, one line per failed arm; empty when the verdict holds. */
export function evaluateVerdict(result: RenderResult, input: string, verdict: Verdict, ctx: VerdictContext): string[] {
  const out: string[] = [];
  const html = result.html;
  if (result.outcome !== verdict.outcome) {
    out.push(`outcome: expected "${verdict.outcome}", got ${JSON.stringify(result.outcome)}`);
  }
  if (verdict.outcome === 'over-limit' && html !== '') {
    out.push(`outcome: an over-limit render has empty html, got ${html.length} characters`);
  }
  if (verdict.maxMs !== undefined) {
    const bound = verdict.maxMs * (ctx.timeScale ?? 1);
    if (!(ctx.ms <= bound)) out.push(`maxMs: took ${ctx.ms.toFixed(1)} ms, bound ${bound} ms`);
  }
  if (verdict.maxOutputRatio !== undefined) {
    const ratio = Buffer.byteLength(html, 'utf8') / Math.max(1, Buffer.byteLength(input, 'utf8'));
    if (ratio > verdict.maxOutputRatio) {
      out.push(`maxOutputRatio: output is ${ratio.toFixed(3)} times the input, bound ${verdict.maxOutputRatio}`);
    }
  }
  for (const [name, max] of Object.entries(verdict.maxTagDepth ?? {})) {
    const depth = tagDepth(html, name);
    if (depth > max) out.push(`maxTagDepth: ${name} nests ${depth} deep, bound ${max}`);
  }
  if (verdict.forbid !== undefined) {
    const folded = asciiLower(html);
    for (const s of verdict.forbid) {
      if (folded.includes(asciiLower(s))) out.push(`forbid: the html contains ${JSON.stringify(s)}`);
    }
  }
  for (const s of verdict.require ?? []) {
    if (!html.includes(s)) out.push(`require: the html lacks ${JSON.stringify(s)}`);
  }
  for (const name of verdict.balanced ?? []) {
    const why = imbalance(html, name);
    if (why !== null) out.push(`balanced: ${why}`);
  }
  if (verdict.headingIds !== undefined) out.push(...checkHeadingIds(html, verdict.headingIds));
  if (verdict.scan !== undefined) out.push(...checkScan(verdict, verdict.scan, ctx.scan));
  if (verdict.nullPrototypeFront === true) {
    const front = result.meta.front;
    if (front === null || Object.getPrototypeOf(front) !== null) {
      out.push('nullPrototypeFront: meta.front is not a null-prototype record');
    }
  }
  return out;
}
