// The line_attrs core rule (docserver L1; architecture section C, the `data-line` row; contract section
// 2.4). Each block token of the types below that has a source map gets data-line="{first}-{last}", 1-based
// and inclusive, set with attrSet so it comes after any attribute an earlier rule set (a heading's id, a
// list's start, a task item's class). It runs last in the core chain; a rule that must come before it is
// inserted with `md.core.ruler.before('line_attrs', …)`. Fences, Mermaid figures, alerts and front matter
// carry data-line through their own render rules, not through this one: those rules write lineAttr(token,
// env). A token whose meta says `noLine` gets none either way: the alerts rule marks the paragraph it
// rebuilds, which the reference rendered as a bare <p>.
import type { StateCore, Token } from 'markdown-it';
import type { RenderEnv } from './env.js';

/** The token types the reference renderer marks, exactly (its _LINE_TOKENS). */
export const LINE_TOKENS: ReadonlySet<string> = new Set([
  'paragraph_open',
  'heading_open',
  'list_item_open',
  'tr_open',
  'blockquote_open',
  'table_open',
  'hr',
  'code_block',
  'bullet_list_open',
  'ordered_list_open',
]);

/** What a rule records on a token's meta to keep data-line off it (alerts.ts). */
export interface LineMeta {
  readonly noLine?: boolean;
}

/** True when the token has a source map and no rule has marked it `noLine`. */
function lined(t: Token): t is Token & { map: [number, number] } {
  return t.map !== null && (t.meta as LineMeta | null)?.noLine !== true;
}

/** The data-line value of a source map: its first and last line, 1-based and inclusive. */
function lineValue(map: [number, number]): string {
  return `${map[0] + 1}-${map[1]}`;
}

export function lineAttrs(state: StateCore): void {
  const env = state.env as RenderEnv;
  if (!env.lineAttrs) return;
  for (const t of state.tokens) {
    if (LINE_TOKENS.has(t.type) && lined(t)) t.attrSet('data-line', lineValue(t.map));
  }
}

/**
 * The data-line attribute a render rule writes into its own markup (fence.ts; front matter in Task 9):
 * ` data-line="{first}-{last}"`, or '' when the env has lineAttrs off, the token has no source map or its
 * meta says `noLine`.
 */
export function lineAttr(token: Token, env: RenderEnv): string {
  return env.lineAttrs && lined(token) ? ` data-line="${lineValue(token.map)}"` : '';
}
