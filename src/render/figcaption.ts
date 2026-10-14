// The figcaption core rule (docserver L1; architecture section C, the "Caption" row; contract section 2.7;
// ruling C28). The reference renderer finds a caption with a regular expression over its finished HTML: a
// Mermaid figure, whitespace, then a paragraph that is exactly `<em>Figure N. …</em>`. This rule makes the
// same decision on the token stream, rendering at most a short prefix of the span and keeping none of it:
// - a fence that renders a Mermaid figure (fence.ts's own test: fenceName(info) === MERMAID);
// - its next block, stepping over blocks that render as whitespace (skipBlank), is a paragraph that is
//   not hidden: a tight list's paragraph renders no <p>, and the reference's pattern needs one;
// - the paragraph's inline children are ONE emphasis span (ruling C25, PD7): the `em_open` the paragraph
//   starts with is closed by its last child and by no earlier one, so the HTML stays balanced. The reference's
//   pattern also took `*Figure 1. a* *b*`, whose first `<em>` is not the one that closes it, and emitted the
//   unbalanced `Figure 1. a</em> <em>b`; here that paragraph stays an ordinary paragraph after the figure.
//   The mechanism is token pairing (oneSpan): a depth counter that must first return to zero at the LAST
//   child. Emphasis nested inside the span (`*Figure 1. a *b* c*`) raises the depth and back, so it counts;
// - the span's rendered start is `<em>`, `Figure`, Python whitespace, a decimal digit run (Python's \d: any
//   Unicode decimal digit), then `.` (startsCaption). That is CAPTION's acceptance set, decided on a PREFIX:
//   the decision reads the rendered html of the span's `em_open` and of its leading `text` and `softbreak`
//   children, one token at a time and only until it is made. That is bounded by the caption prefix it reads,
//   which is text the paragraph already holds; any other token is not rendered (renderedPieces), so a link
//   or image right after the `<em>` costs nothing at parse time. CAPTION itself, the
//   reference's pattern on a finished paragraph, stays as the oracle that test/figcaption.test.ts compares
//   startsCaption with.
// Ruling C28: nothing here renders the caption. The decision renders only what renderedPieces yields (the
// span's opening `<em>` and its leading text and softbreak children) and keeps none of it. An earlier version
// rendered the whole paragraph at parse time (outside render()'s html bound, and inside scanRefs, which has
// no bound) and kept the string; a caption
// whose links each repeat one long destination built a gigabyte string (a fatal out-of-memory error, or
// outcome 'failed' for a document that should be 'output-over-limit', or a RangeError out of scanRefs).
// Now the caption stays tokens, so the render phase renders it piece by piece through the same bound as any
// paragraph. The bytes are the same as before:
//   <figure …><pre class="mermaid">…</pre>  <figcaption>  {the span's inner children}  </figcaption></figure>\n
// The rule drops the paragraph's open and close tokens, drops the span's em_open and em_close, and puts three
// tokens right after the fence: `figcaption_open`, the paragraph's `inline` token (its children are now the
// span's inner ones) and `figcaption_close`. Blank blocks that were between the fence and the paragraph
// follow the caption, as they followed the figure before. renderFence leaves `</figure>` to figcaption_close
// when the next token is figcaption_open, and the two render rules below write the figcaption's tags. The
// caption's images are now inline tokens in the stream, so scanRefs reads them like any other.
//
// The reference's pattern also forbids `</p>` inside the caption; rendered inline content never holds one
// (markdown-it escapes `<` in text, and the allowlist emits only br, sup, sub and kbd), so the paragraph's
// own close is the only `</p>` it could meet, and the `$` anchor of CAPTION stands for it.
import type { StateCore, Token } from 'markdown-it';
import { fenceName, MERMAID } from './fence.js';
import { isPyWs, PY_WS } from './pyText.js';
import { skipBlank } from './tokens.js';

/** The reference's caption pattern on a finished paragraph; group 1 is the caption. The oracle of startsCaption. */
export const CAPTION = new RegExp(`^<em>(Figure[${PY_WS}]+\\p{Nd}+\\.[\\s\\S]*?)</em>$`, 'u');

/** What a caption's rendered html begins with, before its Python whitespace. */
const HEAD = '<em>Figure';

/** One decimal digit, in any script (Python's `\d`). */
const DIGIT = /^\p{Nd}$/u;

/** True when the inline children are one emphasis span: the `em_open` first opens is closed by the last child only. */
function oneSpan(children: readonly Token[]): boolean {
  if (children[0]?.type !== 'em_open') return false;
  let depth = 0;
  for (let i = 0; i < children.length; i += 1) {
    const type = children[i]?.type;
    if (type === 'em_open') depth += 1;
    else if (type === 'em_close') depth -= 1;
    if (depth === 0) return i === children.length - 1;
  }
  return false;
}

/**
 * Whether the html `pieces` (one inline token's render each, in order) begin the way CAPTION's group does:
 * `<em>Figure`, one or more Python whitespace characters, one or more decimal digits, then `.`. It reads one
 * character at a time and stops at the first that decides, so it never reads, or asks for, more than that.
 */
export function startsCaption(pieces: Iterable<string>): boolean {
  let state = 0; // 0: inside HEAD; 1: the first whitespace; 2: more whitespace or the first digit; 3: more digits or the dot
  let head = 0;
  for (const piece of pieces) {
    for (const ch of piece) {
      if (state === 0) {
        if (ch !== HEAD.charAt(head)) return false;
        head += 1;
        if (head === HEAD.length) state = 1;
      } else if (state === 1) {
        if (!isPyWs(ch)) return false;
        state = 2;
      } else if (state === 2) {
        if (isPyWs(ch)) continue;
        if (!DIGIT.test(ch)) return false;
        state = 3;
      } else {
        if (DIGIT.test(ch)) continue;
        return ch === '.';
      }
    }
  }
  return false;
}

/**
 * The html the caption decision reads, one inline child at a time and only on demand: the first child (the
 * span's `em_open`) as renderer.renderInline would write it, then the html of each `text` and `softbreak`
 * child. Any other token (a link, an image, code, emphasis, a tag) is NOT rendered: it yields the sentinel
 * '<' instead, which startsCaption rejects in every state past `<em>`, so the decision is the one rendering
 * it would give, and a link or image right after the `<em>` (or after `Figure `) costs nothing at parse time
 * (review 458, F2). Every character startsCaption accepts after `<em>` is text, and a softbreak renders as
 * a newline, which is Python whitespace.
 */
function* renderedPieces(state: StateCore, children: Token[]): Generator<string> {
  const renderer = state.md.renderer;
  for (let j = 0; j < children.length; j += 1) {
    const type = children[j]?.type ?? '';
    if (j > 0 && type !== 'text' && type !== 'softbreak') {
      yield '<';
      continue;
    }
    const rule = renderer.rules[type];
    yield rule === undefined
      ? renderer.renderToken(children, j, state.md.options)
      : rule(children, j, state.md.options, state.env, renderer);
  }
}

export function figcaption(state: StateCore): void {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i += 1) {
    const fence = tokens[i];
    if (fence?.type !== 'fence' || fenceName(fence.info) !== MERMAID) continue;
    const k = skipBlank(tokens, i + 1);
    const open = tokens[k];
    const inline = tokens[k + 1];
    if (open?.type !== 'paragraph_open' || open.hidden || inline?.type !== 'inline') continue;
    // A footnote's last paragraph also holds its back-references, after the inline content and before
    // paragraph_close (markdown-it-footnote's footnote_tail); the reference's caption pattern needs `</p>`
    // right after `</em>`, so that paragraph is never a caption.
    if (tokens[k + 2]?.type !== 'paragraph_close') continue;
    const children = inline.children ?? [];
    if (!oneSpan(children) || !startsCaption(renderedPieces(state, children))) continue;
    const figcaptionOpen = new state.Token('figcaption_open', 'figcaption', 1);
    figcaptionOpen.block = true;
    figcaptionOpen.level = fence.level;
    const figcaptionClose = new state.Token('figcaption_close', 'figcaption', -1);
    figcaptionClose.block = true;
    figcaptionClose.level = fence.level;
    inline.children = children.slice(1, -1);
    // The blank blocks between the fence and the paragraph move behind the caption; the caption takes their place.
    const blanks = tokens.slice(i + 1, k);
    tokens[i + 1] = figcaptionOpen;
    tokens[i + 2] = inline;
    tokens[i + 3] = figcaptionClose;
    for (let b = 0; b < blanks.length; b += 1) tokens[i + 4 + b] = blanks[b] as Token;
    i = k + 2;
  }
}

/** The render rule for `figcaption_open`: the figure's caption starts (its `</figure>` is figcaption_close's). */
export function renderFigcaptionOpen(): string {
  return '<figcaption>';
}

/** The render rule for `figcaption_close`: the caption ends, and so does the figure renderFence left open. */
export function renderFigcaptionClose(): string {
  return '</figcaption></figure>\n';
}
