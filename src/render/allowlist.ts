// The raw-HTML allowlist (docserver L1; architecture section C, "The raw-HTML allowlist and its rules";
// contract sections 2.1 and 2.2). Raw HTML stays off (`html: false`); these two rules recognise the few
// pieces of HTML a document may use and emit their own fixed markup, never the author's text:
//   <br>, <br/>, <br />            a hard break (inline)
//   <sup> <sub> <kbd> and closers  without attributes, unbalanced allowed, lower-cased (inline)
//   <!-- ... -->                   dropped; alone on its line, `<!-- id:X -->` becomes an anchor span
//   <details>, <details open>, </details>, <summary>text</summary>, each alone on its line (block)
// Everything else stays text, which markdown-it escapes.
//
// Ported from the reference renderer with two deliberate differences, neither visible in its corpus:
// - Tag names match ASCII letters case-insensitively and nothing else (the `i` flag without `u`). The
//   reference's Python `re.I` also lets U+0130 and U+0131 stand for `i`, U+212A for `k` and U+017F for
//   `s`, so it writes the author's `<U+017Fup>` as a raw tag and reads `<U+017Fummary>x</U+017Fummary>`
//   as a `<details>` line. Here those stay escaped text.
// - Finding a comment's `-->` is linear in the document. The reference rescans from each `<!--` to the
//   end of the text, so a document of unterminated `<!--` lines takes quadratic time. The answers are
//   the same; CommentScan (below) remembers where each search ended, per inline text and per line.
import type { StateBlock, StateInline } from 'markdown-it';
import type { RenderEnv } from './env.js';
import { pyEscape } from './escape.js';
import { PY_WS, pyLower, pyStrip } from './pyText.js';

/** What the two rules accept. The rules build their patterns from these values, never from copies. */
export const ALLOWLIST: Readonly<{
  inlineTags: readonly ['br', 'sup', 'sub', 'kbd'];
  blockLines: readonly ['<details>', '<details open>', '</details>', '<summary>…</summary>'];
  anchorId: '[A-Za-z0-9_-]{1,100}';
}> = Object.freeze({
  inlineTags: Object.freeze(['br', 'sup', 'sub', 'kbd'] as const),
  blockLines: Object.freeze(['<details>', '<details open>', '</details>', '<summary>…</summary>'] as const),
  anchorId: '[A-Za-z0-9_-]{1,100}' as const,
});

const [BR, ...PAIRED] = ALLOWLIST.inlineTags;

/**
 * An inline tag at the current position: `<br>` with Python whitespace and an optional `/` before the
 * `>`, or a bare `<sup>`, `<sub>`, `<kbd>` or its closer. Sticky: it matches only where lastIndex points,
 * and the rule sets lastIndex before every use. Case-insensitive for ASCII letters only (no `u` flag).
 * Group 1 is the closer's slash ('' or '/'), group 2 the tag name; both are undefined for `<br>`.
 */
export const INLINE_TAG = new RegExp(`<(?:${BR}[${PY_WS}]*\\/?|(\\/?)(${PAIRED.join('|')}))>`, 'iy');

/** A whole stripped comment that names an anchor: `<!--`, Python whitespace, `id:X`, whitespace, `-->`. */
export const COMMENT_ID = new RegExp(`^<!--[${PY_WS}]*id:(${ALLOWLIST.anchorId})[${PY_WS}]*-->$`);

/**
 * A whole stripped details line. Group 1 is the whitespace and `open` of an opener; group 2 the summary
 * text, which may hold any character but a line feed (`[^\n]`, as Python's `.`; JS's `.` would also
 * stop at U+2028 and U+2029). Case-insensitive for ASCII letters only.
 */
export const DETAILS_LINE = new RegExp(
  `^(?:<details([${PY_WS}]+open)?>|<\\/details>|<summary>([^\\n]*)<\\/summary>)$`,
  'i',
);

const LT = 0x3c;
const COMMENT_OPEN = '<!--';
const COMMENT_CLOSE = '-->';

/** One inline text's last search: `at` is the first `-->` at or after `from` in that text (-1: none). */
interface InlineSearch {
  from: number;
  at: number;
}

/**
 * Per-render memory of the comment searches, kept in the RenderEnv (never at module scope):
 * - `block`/`next`: for the document's block state, next[k] is the first line at or after k whose
 *   physical source line holds `-->` (the document's line count when none), built once per document over
 *   ALL its lines, whatever nested rule first asks;
 * - `from`/`close`/`tail`, for that block state and per line k: the source offset the line's text was last
 *   read from (-1: never), the offset of the first `-->` in that text (-1: none), and whether anything but
 *   Python whitespace follows it (1) or not (0). A closing line that many `<!--` lines reach is read once,
 *   not once per `<!--`;
 * - `inline`: the last search of each inline text, which answers every later search in that text from a
 *   position between `from` and `at`. A text nested in another (an image's alt text, a footnote's inline
 *   text) is parsed in a state of its own, so each keeps its own entry and neither evicts the other's.
 */
export interface CommentScan {
  block: StateBlock | null;
  next: Int32Array | null;
  from: Int32Array | null;
  close: Int32Array | null;
  tail: Uint8Array | null;
  readonly inline: WeakMap<StateInline, InlineSearch>;
}

export function createCommentScan(): CommentScan {
  return { block: null, next: null, from: null, close: null, tail: null, inline: new WeakMap() };
}

/** The index of the first `-->` at or after `from` in this inline text, or -1. */
function inlineClose(state: StateInline, from: number): number {
  const memo = (state.env as RenderEnv).comments.inline;
  const last = memo.get(state);
  if (last !== undefined && from >= last.from && (last.at === -1 || from <= last.at)) return last.at;
  const at = state.src.indexOf(COMMENT_CLOSE, from);
  memo.set(state, { from, at });
  return at;
}

/**
 * The safe_inline_html rule, before markdown-it's html_inline. A comment is consumed with no token, in
 * silent mode too (so a comment can hide a `]` from a link label, as in the reference); `<br>` pushes a
 * hardbreak; `<sup>`, `<sub>`, `<kbd>` and their closers push an html_inline token holding the bare,
 * lower-cased tag. Anything else returns false, and markdown-it escapes it as text.
 */
export function safeInlineHtml(state: StateInline, silent: boolean): boolean {
  const pos = state.pos;
  if (state.src.charCodeAt(pos) !== LT) return false;
  if (state.src.startsWith(COMMENT_OPEN, pos)) {
    const at = inlineClose(state, pos + COMMENT_OPEN.length);
    if (at === -1) return false;
    state.pos = at + COMMENT_CLOSE.length;
    return true;
  }
  INLINE_TAG.lastIndex = pos;
  const m = INLINE_TAG.exec(state.src);
  if (m === null) return false;
  if (!silent) {
    const name = m[2];
    if (name === undefined) state.push('hardbreak', 'br', 0);
    else state.push('html_inline', '', 0).content = `<${m[1] ?? ''}${pyLower(name)}>`;
  }
  state.pos = pos + m[0].length;
  return true;
}

/** Line k of the block state as the reference reads it: from after its indent to its end. */
function srcLine(state: StateBlock, k: number): string {
  return state.src.slice((state.bMarks[k] ?? 0) + (state.tShift[k] ?? 0), state.eMarks[k] ?? 0);
}

/**
 * For each line k, the first line at or after k whose physical source line holds `-->` (else the line
 * count). The count is the document's (bMarks holds one entry per line plus a final one), never
 * state.lineMax: a blockquote narrows lineMax to its own end while its content is parsed, and the index
 * is built on the first ask, which may come from inside one; built from that, it would end at the quote
 * and every later line would read as having no `-->` (ruling C13). The per-line memory of closeAt is
 * created with it.
 */
function closeIndex(state: StateBlock): Int32Array {
  const scan = (state.env as RenderEnv).comments;
  if (scan.block === state && scan.next !== null) return scan.next;
  const lines = state.bMarks.length - 1;
  const next = new Int32Array(lines + 1).fill(lines);
  let line = 0;
  for (let i = state.src.indexOf(COMMENT_CLOSE); i !== -1; i = state.src.indexOf(COMMENT_CLOSE, i + 1)) {
    while (line < lines && (state.eMarks[line] ?? 0) < i) line += 1;
    if (line < lines) next[line] = line;
  }
  for (let k = lines - 1; k >= 0; k -= 1) if (next[k] !== k) next[k] = next[k + 1] ?? lines;
  scan.block = state;
  scan.next = next;
  scan.from = new Int32Array(lines).fill(-1);
  scan.close = new Int32Array(lines);
  scan.tail = new Uint8Array(lines);
  return next;
}

/**
 * The offset of the first `-->` in line k's text as srcLine reads it (from after its indent to its end),
 * or -1, and with it whether text follows that `-->`; remembered per line and read start (closeIndex has
 * run for this state, and k is below the document's line count).
 */
function closeAt(state: StateBlock, k: number): number {
  const scan = (state.env as RenderEnv).comments;
  const from = scan.from as Int32Array;
  const close = scan.close as Int32Array;
  const start = (state.bMarks[k] ?? 0) + (state.tShift[k] ?? 0);
  if (from[k] === start) return close[k] ?? -1;
  const end = state.eMarks[k] ?? 0;
  const found = state.src.slice(start, end).indexOf(COMMENT_CLOSE);
  const at = found === -1 ? -1 : start + found;
  from[k] = start;
  close[k] = at;
  (scan.tail as Uint8Array)[k] = at !== -1 && pyStrip(state.src.slice(at + COMMENT_CLOSE.length, end)) !== '' ? 1 : 0;
  return at;
}

/**
 * The first line in [from, endLine) whose text (as srcLine reads it) holds `-->`, or -1: where the
 * reference's `while "-->" not in text` loop stops. A line's text is part of its physical line, so lines
 * whose physical line has no `-->` are skipped without being read.
 */
function closeLine(state: StateBlock, from: number, endLine: number): number {
  const next = closeIndex(state);
  for (let k = next[from] ?? endLine; k < endLine; k = next[k + 1] ?? endLine) {
    if (closeAt(state, k) !== -1) return k;
  }
  return -1;
}

/** A block comment starting at startLine: an anchor, a silently dropped comment, or not a block (false). */
function blockComment(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const last = closeLine(state, startLine, endLine);
  if (last === -1) return false; // unterminated: it stays paragraph text
  // text after the comment: the inline rule drops the comment (closeAt read it once for this line)
  if ((state.env as RenderEnv).comments.tail?.[last] === 1) return false;
  if (silent) return true;
  const lines: string[] = [];
  for (let k = startLine; k <= last; k += 1) lines.push(srcLine(state, k));
  const m = COMMENT_ID.exec(pyStrip(lines.join('\n')));
  if (m !== null) {
    const tok = state.push('html_block', '', 0);
    tok.content = `<span class="doc-anchor" id="${m[1] ?? ''}"></span>\n`;
    tok.map = [startLine, last + 1];
  }
  state.line = last + 1;
  return true;
}

/**
 * The safe_block_html rule, before markdown-it's html_block, with alt paragraph, reference and
 * blockquote (so these lines interrupt a paragraph; they do not end a list item). Not at an indent of
 * four or more (that is indented code).
 */
export function safeBlockHtml(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  if ((state.sCount[startLine] ?? 0) - state.blkIndent >= 4) return false;
  const first = srcLine(state, startLine);
  if (first.startsWith(COMMENT_OPEN)) return blockComment(state, startLine, endLine, silent);
  const m = DETAILS_LINE.exec(pyStrip(first));
  if (m === null) return false;
  if (silent) return true;
  const tok = state.push('html_block', '', 0);
  if (m[2] !== undefined) tok.content = `<summary>${pyEscape(m[2])}</summary>\n`;
  else if (m[0].charAt(1) === '/') tok.content = '</details>\n';
  else tok.content = m[1] === undefined ? '<details>\n' : '<details open>\n';
  tok.map = [startLine, startLine + 1];
  state.line = startLine + 1;
  return true;
}
