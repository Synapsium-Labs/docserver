// The figcaption core rule (docserver L1; architecture section C, the "Caption" row; contract section 2.7).
// The reference renderer finds a caption with a regular expression over its finished HTML: a Mermaid
// figure, whitespace, then a paragraph that is exactly `<em>Figure N. …</em>`. This rule makes the same
// decision on the token stream, before anything is rendered:
// - a fence that renders a Mermaid figure (fence.ts's own test: fenceName(info) === MERMAID);
// - its next block, stepping over blocks that render as whitespace (skipBlank), is a paragraph that is
//   not hidden: a tight list's paragraph renders no <p>, and the reference's pattern needs one;
// - the paragraph's inline content, rendered by this engine, is `<em>`, `Figure`, Python whitespace, a
//   decimal digit run (Python's \d: any Unicode decimal digit), `.`, anything, then `</em>` at its end.
// The caption is the rendered HTML between that first `<em>` and that last `</em>`, so its text is escaped
// exactly as the paragraph's would have been, and `*Figure 1. a* *b*` keeps the reference's unbalanced
// `Figure 1. a</em> <em>b`. The paragraph's three tokens are dropped (with its data-line), and renderFence
// writes `<figcaption>{caption}</figcaption>` before `</figure>`. The inline tokens are kept on the fence
// (FenceMeta.inline): every image among them is inside the caption, and scanRefs reads them there.
//
// The reference's pattern also forbids `</p>` inside the caption; rendered inline content never holds one
// (markdown-it escapes `<` in text, and the allowlist emits only br, sup, sub and kbd), so the paragraph's
// own close is the only `</p>` it could meet, and the `$` anchor below stands for it.
import type { StateCore } from 'markdown-it';
import { fenceName, MERMAID, type FenceMeta } from './fence.js';
import { PY_WS } from './pyText.js';
import { removeTokens, skipBlank } from './tokens.js';

/** A caption paragraph's rendered inline content; group 1 is the caption. */
export const CAPTION = new RegExp(`^<em>(Figure[${PY_WS}]+\\p{Nd}+\\.[\\s\\S]*?)</em>$`, 'u');

export function figcaption(state: StateCore): void {
  const tokens = state.tokens;
  const drop = new Set<number>();
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
    const m = CAPTION.exec(state.md.renderer.renderInline(inline.children ?? [], state.md.options, state.env));
    if (m === null) continue;
    fence.meta = { caption: m[1] ?? '', inline: inline.children ?? [] } satisfies FenceMeta;
    drop.add(k).add(k + 1).add(k + 2);
    i = k + 2;
  }
  removeTokens(tokens, drop);
}
