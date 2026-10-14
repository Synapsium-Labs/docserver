// The balance_details core rule (docserver L1; architecture section C, the `balance_details` row; contract
// section 2.3; ruling C21). The allowlist's rules emit details lines and inline sup, sub and kbd tags one by
// one, so a document can close one it never opened, leave one open, or nest them without end. This rule walks
// the whole token stream (every nesting level; markdown-it's block tokens are one flat list, and each inline
// token holds its own tags) and, as the reference does:
// - empties a `</details>` with no open `<details>` before it, so it renders nothing;
// - rewrites every `<details>` still open at the end to `<details open>`, so an unclosed one can never fold
//   the rest of the document out of sight, and appends one `</details>` for each at the very end of the
//   token list, after the footnotes (footnote_tail runs before this rule).
// Unlike the reference (departure PD8, ruling C21), it also caps the nesting of each of the four tag kinds at
// MAX_TAG_DEPTH open levels in the whole document: an opener past the cap renders as escaped text, and so
// does the closer that pairs with it, so the html stays balanced and a consumer's recursive walk never meets
// more than 64 levels of one kind. An inline closer with nothing open stays a tag, as before. The tags of an
// image's alt text render as attribute text, never as tags, so they are not counted.
// It runs after the anchors rule and before line_attrs; html_block tokens carry no data-line.
import type { StateCore, Token } from 'markdown-it';
import { pyEscape } from './escape.js';

/** Most open levels of each allowlisted tag kind (details, sup, sub, kbd) in one document (ruling C21). */
export const MAX_TAG_DEPTH = 64;

const OPEN = '<details';
const CLOSE = '</details';

/** One inline tag kind's open levels, and the openers past the cap whose closers have not come yet. */
interface Depth {
  open: number;
  over: number;
}

/** Caps one inline token's sup, sub and kbd tags (the allowlist's only html_inline tokens) against `depths`. */
function capInline(children: readonly Token[], depths: Map<string, Depth>): void {
  for (const t of children) {
    if (t.type !== 'html_inline') continue;
    const closer = t.content.charAt(1) === '/';
    const name = t.content.slice(closer ? 2 : 1, -1);
    let d = depths.get(name);
    if (d === undefined) {
      d = { open: 0, over: 0 };
      depths.set(name, d);
    }
    if (!closer) {
      if (d.open < MAX_TAG_DEPTH) d.open += 1;
      else {
        d.over += 1;
        t.type = 'text';
      }
    } else if (d.over > 0) {
      d.over -= 1;
      t.type = 'text';
    } else if (d.open > 0) d.open -= 1;
  }
}

export function balanceDetails(state: StateCore): void {
  const tokens = state.tokens;
  const open: Token[] = [];
  let over = 0;
  const depths = new Map<string, Depth>();
  for (const t of tokens) {
    if (t.type === 'inline') capInline(t.children ?? [], depths);
    if (t.type !== 'html_block') continue;
    if (t.content.startsWith(OPEN)) {
      if (open.length < MAX_TAG_DEPTH) open.push(t);
      else {
        over += 1;
        t.content = pyEscape(t.content);
      }
    } else if (t.content.startsWith(CLOSE)) {
      if (over > 0) {
        over -= 1;
        t.content = pyEscape(t.content);
      } else if (open.length === 0) t.content = '';
      else open.pop();
    }
  }
  for (const t of open) {
    t.content = '<details open>\n';
    const close = new state.Token('html_block', '', 0);
    close.content = '</details>\n';
    tokens.push(close);
  }
}
