// Two token-stream helpers for the core rules that stand in for the reference's HTML post-passes
// (docserver L1; architecture section C, the "Caption" and "Alerts" rows). The reference rewrote the
// rendered HTML with regular expressions; this library rewrites the token stream before it is rendered,
// so these helpers say what the reference's patterns saw between two blocks and how a rule drops tokens.
import type { Token } from 'markdown-it';
import { pyStrip } from './pyText.js';

/**
 * The index of the first token at or after `from` that renders more than whitespace. The reference's
 * patterns step over whitespace (Python's `\s*`) between one block's HTML and the next; the only block
 * token here that renders as whitespace alone is an html_block emptied by balance_details (a stray
 * `</details>`). A comment the allowlist drops leaves no token at all.
 */
export function skipBlank(tokens: readonly Token[], from: number): number {
  let k = from;
  while (isBlank(tokens[k])) k += 1;
  return k;
}

function isBlank(t: Token | undefined): boolean {
  return t !== undefined && t.type === 'html_block' && pyStrip(t.content) === '';
}

/** Removes the tokens at the given indexes in one pass, keeping the array and the order of the rest. */
export function removeTokens(tokens: Token[], drop: ReadonlySet<number>): void {
  if (drop.size === 0) return;
  let w = 0;
  for (const [r, t] of tokens.entries()) {
    if (drop.has(r)) continue;
    tokens[w] = t;
    w += 1;
  }
  tokens.length = w;
}
