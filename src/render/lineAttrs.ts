// The line_attrs core rule (docserver L1; architecture section C, the `data-line` row; contract section
// 2.4). Each block token of the types below that has a source map gets data-line="{first}-{last}", 1-based
// and inclusive, set with attrSet so it comes after any attribute an earlier rule set (a heading's id, a
// list's start, a task item's class). It runs last in the core chain; a rule that must come before it is
// inserted with `md.core.ruler.before('line_attrs', …)`. Fences, Mermaid figures and front matter carry
// data-line through their own render rules, not through this one.
import type { StateCore } from 'markdown-it';
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

export function lineAttrs(state: StateCore): void {
  const env = state.env as RenderEnv;
  if (!env.lineAttrs) return;
  for (const t of state.tokens) {
    if (t.map && LINE_TOKENS.has(t.type)) t.attrSet('data-line', `${t.map[0] + 1}-${t.map[1]}`);
  }
}
