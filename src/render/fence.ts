// The fence render rule (docserver L1; architecture section C, the "Fence info" and "Meta" rows; contract
// sections 2.5 and 2.6). A fence's name is the first word of its info string as the reference reads it:
// stripped the Python way, then split on a space only (a tab does not separate), never entity-decoded.
// - Exactly `mermaid` (case-sensitive) makes a figure. Its source is the raw fence content, escaped with
//   Python's html.escape (pyEscape: `'` becomes &#x27;), not stripped:
//     <figure class="mermaid-figure"{ data-line}><pre class="mermaid">{source}</pre></figure>\n
//   The figure is counted for meta.figures and its diagram keyword recorded for meta.mermaidKinds.
// - Anything else is code:
//     <div class="codehilite"{ data-line}><pre><code class="hljs{ language-NAME}">{code}</code></pre></div>\n
//   NAME is a canonical name from the registry (highlight.ts), never the author's text. The code is the
//   text the reference's highlighter (Pygments) shows: one leading U+FEFF removed, leading and trailing
//   line feeds removed, one line feed added. A registered language is highlighted by highlight.js; any
//   other name gets the text escaped as markdown-it escapes text.
// - Highlighting is bounded, not only the input: several registered grammars (ini, java, javascript and
//   typescript among them) take time quadratic in a line's length, so a 30000-character line took 5-10 s.
//   A fence with a line longer than MAX_HIGHLIGHT_LINE code units, or one that would take the document past
//   MAX_HIGHLIGHT_CHARS highlighted code units, keeps its language class and gets the escaped text, as an
//   unregistered name does. The corpus compares the text inside the wrapper (PD1), so no golden depends
//   on which fences were highlighted.
// A figure's caption is found by the figcaption core rule (figcaption.ts), which records it on the fence
// token's meta (FenceMeta); this rule writes it as <figcaption>…</figcaption> right before </figure>.
// scanRefs (scan.ts) reads fenceName and MERMAID, and the caption's inline tokens on FenceMeta.
import type { Token } from 'markdown-it';
import type { RenderEnv } from './env.js';
import { escapeHtml, pyEscape } from './escape.js';
import { highlightCode, resolveLanguage } from './highlight.js';
import { lineAttr } from './lineAttrs.js';
import { pyStrip } from './pyText.js';

/** The fence name that makes a Mermaid figure. */
export const MERMAID = 'mermaid';

/** What the figcaption rule records on a Mermaid fence token. */
export interface FenceMeta {
  /** The caption, as rendered HTML. */
  readonly caption: string;
  /**
   * The caption paragraph's inline tokens, which the rule took out of the stream: render() writes their
   * images inside the figure's <figcaption>, so scanRefs reads them here.
   */
  readonly inline: readonly Token[];
}

/** At most this many distinct diagram keywords in meta.mermaidKinds. */
export const MAX_MERMAID_KINDS = 32;

/** A fence is highlighted only when none of its lines is longer than this, in code units. */
export const MAX_HIGHLIGHT_LINE = 256;

/** At most this many code units of one document are highlighted; a fence that would pass it is escaped text. */
export const MAX_HIGHLIGHT_CHARS = 262_144;

/** A diagram keyword: an ASCII letter, then up to 39 ASCII letters, digits, `_` or `-`, at a line's start. */
const KIND = /^[A-Za-z][A-Za-z0-9_-]{0,39}/;

const BOM = 0xfeff;
const LF = 0x0a;

/** The first word of a fence's info string: Python's `info.strip().split(" ")[0]`. */
export function fenceName(info: string): string {
  return pyStrip(info).split(' ')[0] ?? '';
}

/**
 * The code text of a fence, as the reference's highlighter reads it (Pygments' lexer preprocessing): one
 * leading U+FEFF removed, then every leading and trailing line feed, then one line feed added.
 */
export function codeText(content: string): string {
  let start = content.charCodeAt(0) === BOM ? 1 : 0;
  let end = content.length;
  while (start < end && content.charCodeAt(start) === LF) start += 1;
  while (end > start && content.charCodeAt(end - 1) === LF) end -= 1;
  return `${content.substring(start, end)}\n`;
}

/**
 * The diagram keyword of a Mermaid source, or null. Lines are read stripped the Python way: blank lines and
 * `%%` lines are skipped; then a `---` line opens a block skipped through the next `---` (no closing line:
 * null); then blank and `%%` lines again; the keyword is the KIND at the start of the next line.
 */
export function mermaidKind(source: string): string | null {
  const lines = source.split('\n').map(pyStrip);
  const skip = (from: number): number => {
    let i = from;
    while (i < lines.length && (lines[i] === '' || (lines[i] ?? '').startsWith('%%'))) i += 1;
    return i;
  };
  let i = skip(0);
  if (lines[i] === '---') {
    i += 1;
    while (i < lines.length && lines[i] !== '---') i += 1;
    if (i >= lines.length) return null;
    i = skip(i + 1);
  }
  const line = lines[i];
  return line === undefined ? null : (KIND.exec(line)?.[0] ?? null);
}

/** Whether no line of `text` is longer than MAX_HIGHLIGHT_LINE code units. */
function shortLines(text: string): boolean {
  for (let from = 0; from < text.length; ) {
    const end = text.indexOf('\n', from);
    const stop = end === -1 ? text.length : end;
    if (stop - from > MAX_HIGHLIGHT_LINE) return false;
    from = stop + 1;
  }
  return true;
}

/** Count one rendered figure and record its keyword: distinct, in document order, at most MAX_MERMAID_KINDS. */
function recordFigure(env: RenderEnv, source: string): void {
  env.figures += 1;
  const kind = mermaidKind(source);
  if (kind !== null && !env.mermaidKinds.includes(kind) && env.mermaidKinds.length < MAX_MERMAID_KINDS) {
    env.mermaidKinds.push(kind);
  }
}

/** The fence render rule (markdown-it's `renderer.rules.fence`). */
export function renderFence(tokens: Token[], idx: number, _options: unknown, env: RenderEnv): string {
  const token = tokens[idx];
  if (token === undefined) return '';
  const name = fenceName(token.info);
  const dl = lineAttr(token, env);
  if (name === MERMAID) {
    recordFigure(env, token.content);
    const caption = (token.meta as FenceMeta | null)?.caption;
    const cap = caption === undefined ? '' : `<figcaption>${caption}</figcaption>`;
    return `<figure class="mermaid-figure"${dl}><pre class="mermaid">${pyEscape(token.content)}</pre>${cap}</figure>\n`;
  }
  const text = codeText(token.content);
  const language = resolveLanguage(name);
  const highlight = language !== null && env.highlighted + text.length <= MAX_HIGHLIGHT_CHARS && shortLines(text);
  if (highlight) env.highlighted += text.length;
  const code = highlight ? highlightCode(text, language) : escapeHtml(text);
  const cls = language === null ? 'hljs' : `hljs language-${language}`;
  return `<div class="codehilite"${dl}><pre><code class="${cls}">${code}</code></pre></div>\n`;
}
