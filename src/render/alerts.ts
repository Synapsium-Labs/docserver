// The alerts core rule and its two render rules (docserver L1; architecture section C, the "Alerts" row;
// contract section 2.8). The reference renderer turns a blockquote into a GitHub alert with a regular
// expression over its finished HTML; this rule makes the same decision on the token stream:
// - a blockquote whose first block (stepping over blocks that render as whitespace, skipBlank) is a
//   paragraph whose inline content starts with the text `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`
//   or `[!CAUTION]`, upper case only. (A blockquote's paragraph is never hidden: markdown-it hides only a
//   tight list item's own paragraphs.) The text is read after text_join, so `\[!NOTE]` and `&#91;!NOTE]`
//   count, as they render the same characters; a link `[!NOTE](x)` does not, as it renders `<a`.
// - The marker is removed, then spaces and tabs, then one line break: a `\n` in the text itself, or else
//   a softbreak or hardbreak token right after the text (the reference's `(?:\n|<br\s*/?>\n?)?`).
// - The blockquote becomes alert_open/alert_close, rendered
//     <div class="gh-alert gh-{kind}"{ data-line}><p class="gh-alert-title">{Kind}</p>…</div>\n
//   with the blockquote's data-line on the div. The first paragraph loses its data-line (the reference
//   rebuilt it as a bare <p>); a paragraph left empty is dropped, and the line feed its `</p>\n` left in
//   the reference's output is written after the title instead.
// - No alert is made inside an alert: the reference skips a match that starts inside a replacement, so
//   the rule resumes after the alert's closing token. An alert inside a plain blockquote is still made.
import type { StateCore, Token } from 'markdown-it';
import type { RenderEnv } from './env.js';
import { lineAttr, type LineMeta } from './lineAttrs.js';
import { pyLower } from './pyText.js';
import { removeTokens, skipBlank } from './tokens.js';

/** The five alert kinds, upper case as they are written, each with its title (Python's `kind.capitalize()`). */
export const ALERT_TITLES: Readonly<Record<string, string>> = Object.freeze({
  NOTE: 'Note',
  TIP: 'Tip',
  IMPORTANT: 'Important',
  WARNING: 'Warning',
  CAUTION: 'Caution',
});

/** The marker at the start of the first paragraph's text, and the spaces and tabs after it. */
export const MARKER = new RegExp(`^\\[!(${Object.keys(ALERT_TITLES).join('|')})\\][ \\t]*`);

/** What the alerts rule records on an alert_open token. */
export interface AlertMeta {
  /** The kind, lower case (the class gh-{kind}). */
  readonly kind: string;
  /** The title shown in the alert. */
  readonly title: string;
  /** True when the first paragraph held only the marker and was dropped. */
  readonly bare: boolean;
}

const BREAKS: ReadonlySet<string> = new Set(['softbreak', 'hardbreak']);

/**
 * The index of the blockquote_close that closes the blockquote_open at `open` (the first one after it at
 * the same nesting level), or -1. markdown-it always closes what it opens, so -1 never comes back from a
 * parsed stream; the rule treats it as "no alert" all the same.
 */
function closeOf(tokens: readonly Token[], open: number): number {
  const level = tokens[open]?.level;
  for (let j = open + 1; j < tokens.length; j += 1) {
    const t = tokens[j];
    if (t?.type === 'blockquote_close' && t.level === level) return j;
  }
  return -1;
}

export function alerts(state: StateCore): void {
  const tokens = state.tokens;
  const drop = new Set<number>();
  for (let i = 0; i < tokens.length; i += 1) {
    const open = tokens[i];
    if (open?.type !== 'blockquote_open') continue;
    const k = skipBlank(tokens, i + 1);
    const para = tokens[k];
    const inline = tokens[k + 1];
    if (para?.type !== 'paragraph_open' || inline?.type !== 'inline') continue;
    const children = inline.children ?? [];
    const text = children[0];
    if (text?.type !== 'text') continue;
    const m = MARKER.exec(text.content);
    if (m === null) continue;
    const close = closeOf(tokens, i);
    const end = tokens[close];
    if (end === undefined) continue;
    let rest = text.content.slice(m[0].length);
    if (rest.startsWith('\n')) rest = rest.slice(1);
    else if (rest === '' && BREAKS.has(children[1]?.type ?? '')) children.splice(1, 1);
    text.content = rest;
    if (rest === '') children.splice(0, 1);
    const bare = children.length === 0;
    if (bare) drop.add(k).add(k + 1).add(k + 2);
    else para.meta = { noLine: true } satisfies LineMeta;
    const kind = m[1] ?? '';
    open.type = 'alert_open';
    open.tag = 'div';
    open.meta = { kind: pyLower(kind), title: ALERT_TITLES[kind] ?? '', bare } satisfies AlertMeta;
    end.type = 'alert_close';
    end.tag = 'div';
    i = close;
  }
  removeTokens(tokens, drop);
}

/** The alert_open render rule. */
export function renderAlertOpen(tokens: Token[], idx: number, _options: unknown, env: RenderEnv): string {
  const token = tokens[idx];
  if (token === undefined) return '';
  const meta = token.meta as AlertMeta;
  const title = `<p class="gh-alert-title">${meta.title}</p>`;
  return `<div class="gh-alert gh-${meta.kind}"${lineAttr(token, env)}>${title}${meta.bare ? '\n' : ''}`;
}

/** The alert_close render rule. */
export function renderAlertClose(): string {
  return '</div>\n';
}
