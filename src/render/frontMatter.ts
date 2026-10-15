// Front matter (docserver L1; architecture section C, the "Front matter" row; contract section 2.12;
// ruling C1's departures PD2 and PD3). Three parts:
// - frontMatterRule, the block rule. It is the reference's plugin (a port of markdown-it-front-matter),
//   step for step, quirks included: it fires only for line 0 of a block run whose source starts with `-`
//   (state.src[0], not the line's own first character, so a bullet list item that starts the document can
//   hold one); three or more dashes open it and the rest of that line is not read; it closes on a line of
//   at least as many dashes followed by spaces only, or right after a `...` line (which stays inside the
//   content); a document with no closing line has no front matter. So `---` thematic breaks around text
//   at the top of a document make front matter of the text between them, as in the reference.
//   The token is hidden: markdown-it writes a line feed before the next block, as the reference's does.
// - renderFrontMatter, the render rule: the content, when under FM_MAX_CHARS code points, is read as YAML
//   by js-yaml in JSON mode with FM_SCHEMA: the failsafe schema (strings, sequences, mappings) plus YAML
//   1.2's null and bool and the merge key, and no int or float (PD2, ruling C16: `null` renders '',
//   booleans `true`/`false`, and every other scalar renders its source text, so `1.0`, `.inf`, `0o17`, a
//   20-digit integer, `yes`/`no`/`on`/`off` and timestamps stay as the author wrote them; no other tags,
//   so `!!int`, `!!float`, `!!js/function`, `!!python/...`, `!!binary` and `!!set` fail the load). The
//   merge key `<<` is there because PyYAML's safe_load reads it and without it a common
//   `<<: *defaults` would render as a key. JSON mode lets a later duplicate key win, as PyYAML's does.
//   A non-empty mapping renders
//     <dl class="doc-meta"{ data-line}><div><dt>{key}</dt><dd>{value}</dd></div>…</dl>\n
//   for its first FM_MAX_KEYS keys, key and value escaped with Python's html.escape (pyEscape); anything
//   else (a load error, a list, a scalar, an empty mapping) renders ''.
// - frontEntries and frontRecord: meta.frontList and meta.front, read from the SAME parsed mapping
//   (PD3), so the strip and the meta can never disagree; the reference read meta from the raw text with a
//   second, stricter pattern, which missed CRLF files, `----` and `--- x` openers and `...` closers.
// Python's len() and [:n] are cpLength and cpSlice (global constraint 6).
import { FAILSAFE_SCHEMA, load, Type } from 'js-yaml';
import type { StateBlock, Token } from 'markdown-it';
import type { RenderEnv } from './env.js';
import { pyEscape } from './escape.js';
import { lineAttr } from './lineAttrs.js';
import { cpLength, cpSlice } from './pyText.js';
import type { FrontEntry } from './types.js';

/** Content of this many code points or more is not read as YAML at all. */
export const FM_MAX_CHARS = 20000;
/** Keys shown in the strip and listed in meta.frontList, the first in document order. */
export const FM_MAX_KEYS = 40;
/** Code points of a scalar value, and of a key, in the strip and in meta (ruling C31). */
export const FM_MAX_VALUE = 500;
/** Items of a list value the strip reads (nested lists and mappings among them are then skipped). */
export const FM_MAX_ITEMS = 50;
/** Items of a list value meta.frontList reads, and code points of each item. */
export const FM_LIST_MAX_ITEMS = 300;
export const FM_LIST_MAX_ITEM = 300;

const DASH = 0x2d;
const MIN_MARKERS = 3;

/** YAML 1.2's null, as js-yaml defines it (an empty value is null before any type is asked). */
const NULL = new Type('tag:yaml.org,2002:null', {
  kind: 'scalar',
  resolve: (data: unknown) => data === null || data === '~' || data === 'null' || data === 'Null' || data === 'NULL',
  construct: () => null,
});

const TRUE = new Set(['true', 'True', 'TRUE']);
const FALSE = new Set(['false', 'False', 'FALSE']);

/** YAML 1.2's bool, as js-yaml defines it: three spellings of each value, nothing else (not yes/no/on/off). */
const BOOL = new Type('tag:yaml.org,2002:bool', {
  kind: 'scalar',
  resolve: (data: unknown) => typeof data === 'string' && (TRUE.has(data) || FALSE.has(data)),
  construct: (data: string) => TRUE.has(data),
});

/** YAML's merge key, as js-yaml defines it for its default schema (the loader acts on this tag). */
const MERGE = new Type('tag:yaml.org,2002:merge', {
  kind: 'scalar',
  resolve: (data: unknown) => data === '<<' || data === null,
});

/**
 * The schema front matter is read with (PD2, ruling C16): failsafe plus null, bool and the merge key. It has
 * no int or float type, so a number stays the text the author wrote.
 */
export const FM_SCHEMA = FAILSAFE_SCHEMA.extend({ implicit: [NULL, BOOL, MERGE] });

/** A parsed front-matter block: the mapping, or null when the content is not a mapping. */
export type FrontMapping = Readonly<Record<string, unknown>>;

/** The front_matter block rule (the reference's plugin, ported line for line). */
export function frontMatterRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const src = state.src;
  let start = (state.bMarks[startLine] ?? 0) + (state.tShift[startLine] ?? 0);
  let max = state.eMarks[startLine] ?? 0;

  // Only the first line of a block run, and only when the whole source starts with a dash.
  if (startLine !== 0 || src.charCodeAt(0) !== DASH) return false;

  // The opening run of dashes; the rest of the line is not read.
  let pos = start + 1;
  while (pos <= max && pos < src.length) {
    if (src.charCodeAt(pos) !== DASH) break;
    pos += 1;
  }
  const markerCount = pos - start;
  if (markerCount < MIN_MARKERS) return false;
  if (silent) return true;

  let nextLine = startLine;
  let autoClosed = false;
  for (;;) {
    nextLine += 1;
    // No closing line: not front matter.
    if (nextLine >= endLine) return false;
    // The line read in the previous turn was `...`: close after it, keeping it in the content.
    if (src.slice(start, max) === '...') break;

    start = (state.bMarks[nextLine] ?? 0) + (state.tShift[nextLine] ?? 0);
    max = state.eMarks[nextLine] ?? 0;

    if (start < max && (state.sCount[nextLine] ?? 0) < state.blkIndent) break;
    if (src.charCodeAt(start) !== DASH) continue;
    if ((state.sCount[nextLine] ?? 0) - state.blkIndent >= 4) continue;

    pos = start + 1;
    while (pos < max) {
      if (src.charCodeAt(pos) !== DASH) break;
      pos += 1;
    }
    if (pos - start < markerCount) continue;
    pos = state.skipSpaces(pos);
    if (pos < max) continue;

    autoClosed = true;
    break;
  }

  const oldParent = state.parentType;
  const oldLineMax = state.lineMax;
  state.parentType = 'container' as typeof state.parentType;
  state.lineMax = nextLine;

  const token = state.push('front_matter', '', 0);
  token.hidden = true;
  token.markup = '---';
  token.content = src.slice(state.bMarks[startLine + 1] ?? 0, state.eMarks[nextLine - 1] ?? 0);
  token.block = true;

  state.parentType = oldParent;
  state.lineMax = oldLineMax;
  state.line = nextLine + (autoClosed ? 1 : 0);
  token.map = [startLine, state.line];
  return true;
}

function isNested(v: unknown): boolean {
  return typeof v === 'object' && v !== null;
}

function isMapping(v: unknown): v is FrontMapping {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Throws when a marked mapping is turned into text: the one place js-yaml does that is a mapping key. */
function refuseMappingKey(): never {
  throw new TypeError('a mapping cannot be a key');
}

/** Throws when a sequence is read as a mapping: the one place js-yaml does that is a `<<` merge source. */
function refuseMergeSource(): never {
  throw new TypeError('expected a mapping for merging');
}

/**
 * The name of the property that makes a sequence unmergeable (ruling C39). It is a string because js-yaml
 * merges a source by the string keys of Object.keys; no author's text reaches it except by writing it.
 */
const MERGE_REFUSAL = '\u0000merge source is a sequence';

/**
 * The YAML of a front-matter block as a mapping, or null (too long, a load error, or not a mapping).
 *
 * A mapping used as a key, or a sequence key holding one, fails the load (ruling C33, part of PD2), through
 * the same `null` as a tag outside the schema. The reference (PyYAML) cannot hash a mapping, so it refuses
 * the whole block; js-yaml would read the key as the text `[object Object]`. js-yaml turns a key into text
 * with String(), and it never turns a value into text. So while loading, the listener marks every mapping a
 * node ends with, and the mappings inside a sequence, with two symbol properties: a class that is not
 * `[object Object]` (which js-yaml would replace by that text before converting) and a conversion to text
 * that throws. The throw happens exactly where a mapping is a key, at any depth, and nowhere else.
 * - The mappings a sequence holds are marked as well: inside a flow sequence, `a: 1` is a single-pair
 *   mapping that js-yaml pushes straight into the array and that is never a node's own result, so only the
 *   sequence's close shows it to the listener. A sequence that holds an alias of itself is heard before it
 *   is finished, so the listener keeps how many elements it has looked at and reads the rest at each hearing.
 *   The sequence itself is not marked this way: js-yaml copies a sequence key before it converts it, so a
 *   mark on the sequence would never be read (the C17 (c) control loads such a key).
 * - A `<<` merge source that is a sequence fails the load too (ruling C39, parity with PyYAML, which expects a
 *   mapping for merging; js-yaml would merge the sequence in as a mapping with the keys 0, 1, ...). Every
 *   sequence the listener hears gets an enumerable own property whose getter throws. js-yaml reads a merge
 *   source's keys and values, so the throw happens there, for a list item or a bare alias of a sequence of
 *   sequences, and nowhere else: a list of mappings, a mapping and a sequence key are read without it.
 * - The symbols cannot clash with an author's key, and they are removed again before the mapping is
 *   returned, so what the caller gets is a plain object. (The refusal's property is a string, and
 *   is removed in the same place; an author who wrote that exact key before the `<<` could hide it.)
 */
export function parseFrontMatter(content: string): FrontMapping | null {
  if (cpLength(content) >= FM_MAX_CHARS) return null;
  const marked = new Set<object>();
  const refusing = new Set<unknown[]>();
  const mark = (m: object): void => {
    marked.add(m);
    Object.defineProperty(m, Symbol.toStringTag, { value: 'FrontMatterMapping', configurable: true });
    Object.defineProperty(m, Symbol.toPrimitive, { value: refuseMappingKey, configurable: true });
  };
  // Ruling C39: js-yaml merges a sequence in as a mapping with the keys 0, 1, ..., where PyYAML refuses the
  // load. It reads every key of a `<<` source and its value (Object.keys, then source[key]), so a sequence
  // that has an enumerable own property whose getter throws is refused exactly there, empty or not. js-yaml
  // reads a sequence's own keys nowhere else: it copies a sequence key before converting it.
  const refuseMerge = (a: unknown[]): void => {
    refusing.add(a);
    Object.defineProperty(a, MERGE_REFUSAL, { get: refuseMergeSource, enumerable: true, configurable: true });
  };
  // For each sequence the listener has heard: how many of its elements it has already looked at.
  const scanned = new Map<unknown[], number>();
  // Called as each node opens and closes. At open it still sees the previous node's result (js-yaml resets
  // it after the call), which can be a sequence that is not finished: an alias inside a flow sequence
  // returns the array being read, because its anchor is stored when it opens. A mapping that is a node's
  // result is marked the first time it is heard. A sequence is made unmergeable the first time it is heard,
  // and marks the mappings it holds, which may never have been a node's result; it is heard again (an alias,
  // or its own close after an alias inside it), so the count above makes each hearing look only at the
  // elements added since the last. A mapping held by a sequence is marked again at each scan that reaches
  // it, once per element position (the same properties, so nothing changes). An alias of a finished
  // sequence costs one lookup, and a block that aliases one large sequence many times never rescans it.
  const listener = (_event: string, state: { result: unknown }): void => {
    const m = state.result;
    if (typeof m !== 'object' || m === null) return;
    if (Array.isArray(m)) {
      const seen = scanned.get(m);
      if (seen === undefined) refuseMerge(m);
      for (let i = seen ?? 0; i < m.length; i += 1) {
        const el: unknown = m[i];
        if (typeof el === 'object' && el !== null && !Array.isArray(el)) mark(el);
      }
      scanned.set(m, m.length);
    } else if (!marked.has(m)) {
      mark(m);
    }
  };
  let data: unknown;
  try {
    data = load(content, { schema: FM_SCHEMA, json: true, listener });
  } catch {
    return null;
  } finally {
    for (const m of marked) {
      Reflect.deleteProperty(m, Symbol.toStringTag);
      Reflect.deleteProperty(m, Symbol.toPrimitive);
    }
    for (const a of refusing) Reflect.deleteProperty(a, MERGE_REFUSAL);
  }
  return isMapping(data) ? data : null;
}

/** A scalar as text (PD2: null is the empty string, a boolean true or false; the schema reads no numbers). */
function scalarText(v: unknown): string {
  return v === null ? '' : String(v);
}

/** The strip's text for one value: a list's first FM_MAX_ITEMS items, nested ones skipped, joined by `, `. */
export function fmValue(v: unknown): string {
  if (Array.isArray(v)) {
    return v
      .slice(0, FM_MAX_ITEMS)
      .filter((x) => !isNested(x))
      .map(fmValue)
      .join(', ');
  }
  if (isNested(v)) return '\u2026';
  return cpSlice(scalarText(v), FM_MAX_VALUE);
}

/**
 * The first FM_MAX_KEYS pairs of a mapping, in document order, each key cut to FM_MAX_VALUE code points
 * as a value is (ruling C31, part of PD8). This is the one cut: the strip escapes the cut key and meta
 * records it, so the two agree, and nothing past the cut is ever escaped or copied. A sequence key built
 * from aliases can load as millions of characters; the loader builds it once, and nothing here touches
 * more than the first 500 code points. Two keys that share those code points collide after the cut: the
 * strip and meta.frontList list both, in document order, and meta.front keeps the later (frontRecord).
 */
function firstPairs(data: FrontMapping): Array<readonly [key: string, value: unknown]> {
  return Object.keys(data)
    .slice(0, FM_MAX_KEYS)
    .map((k) => [cpSlice(k, FM_MAX_VALUE), data[k]] as const);
}

/** meta.frontList: after the key cut (firstPairs), a list gives its items, a scalar its text; a mapping or null is skipped. */
export function frontEntries(data: FrontMapping): FrontEntry[] {
  const out: FrontEntry[] = [];
  for (const [key, v] of firstPairs(data)) {
    if (Array.isArray(v)) {
      const vals = v
        .slice(0, FM_LIST_MAX_ITEMS)
        .filter((x) => !isNested(x))
        .map((x) => cpSlice(scalarText(x), FM_LIST_MAX_ITEM));
      out.push({ key, list: true, vals });
    } else if (!isNested(v) && v !== null) {
      out.push({ key, list: false, vals: [cpSlice(scalarText(v), FM_MAX_VALUE)] });
    }
  }
  return out;
}

/** meta.front: a null-prototype record of frontList, each key to its list or its one value. */
export function frontRecord(list: readonly FrontEntry[]): Readonly<Record<string, string | readonly string[]>> {
  const out = Object.create(null) as Record<string, string | readonly string[]>;
  for (const e of list) {
    Object.defineProperty(out, e.key, {
      value: e.list ? e.vals : (e.vals[0] ?? ''),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out;
}

/**
 * The front_matter render rule. Its mapping also gives the document's meta (PD3). A document has at most
 * one front_matter token: the rule fires only at line 0, and the first block that takes line 0 consumes it.
 */
export function renderFrontMatter(tokens: Token[], idx: number, _options: unknown, env: RenderEnv): string {
  const token = tokens[idx];
  if (token === undefined) return '';
  const data = parseFrontMatter(token.content);
  env.frontList = data === null ? null : frontEntries(data);
  if (data === null) return '';
  const pairs = firstPairs(data);
  if (pairs.length === 0) return '';
  const items = pairs
    .map(([k, v]) => `<div><dt>${pyEscape(k)}</dt><dd>${pyEscape(fmValue(v))}</dd></div>`)
    .join('');
  return `<dl class="doc-meta"${lineAttr(token, env)}>${items}</dl>\n`;
}
