// The block_strip core rule (docserver L1, Task 4; contract section 2). The reference's parser, a Python
// port of markdown-it, trims a heading's, a setext heading's and a paragraph's text with Python's
// `str.strip()`; markdown-it trims the same text of spaces, tabs and line ends only. So a heading or
// paragraph that starts or ends with any other Python whitespace (\v, \f, \x1c-\x1f, \x85, no-break space,
// U+3000, U+2028 and the rest of PY_WS) keeps it here and loses it there. This rule runs between block and
// inline parsing and strips those inline tokens' text the Python way; since every character markdown-it
// trimmed is Python whitespace too, the result is exactly the reference's. U+FEFF is not Python whitespace,
// so it stays, as it does there. Table cells are not touched here (markdown-it trims them with JS trim()).
import type { StateCore } from 'markdown-it';
import { pyStrip } from './pyText.js';

/** The block tokens whose inline content the reference strips with Python's str.strip(). */
const STRIPPED_PARENTS: ReadonlySet<string> = new Set(['heading_open', 'paragraph_open']);

export function blockStrip(state: StateCore): void {
  const tokens = state.tokens;
  for (const [i, t] of tokens.entries()) {
    if (t.type === 'inline' && STRIPPED_PARENTS.has(tokens[i - 1]?.type ?? '')) t.content = pyStrip(t.content);
  }
}
