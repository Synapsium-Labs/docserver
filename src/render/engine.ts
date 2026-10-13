// The markdown-it instance behind render() (docserver L1; architecture section C, "Engine"; contract
// section 1). The CommonMark preset with raw HTML off, plus tables and strikethrough, configured once.
// The instance carries no per-document state: everything one render needs lives in its RenderEnv (env.ts).
//
// Pinned on purpose:
// - `html: false` is the raw-HTML wall: markdown-it escapes every tag, and only this library's own rules
//   (the allowlist, allowlist.ts) ever emit markup.
// - `maxNesting` stays the preset's 20, as in the reference: deeper blockquotes and lists stop nesting.
// - `validateLink` and `normalizeLink` are markdown-it's own: javascript:, vbscript:, file: and non-image
//   data: links stay text, and destinations are percent-encoded. Never override them.
//
// markdown-it is 14.3.2, not 15: 15 puts a code span's text into an image's alt (`![a `c`](x)` gives
// alt="a c"), where markdown-it-py, a port of 14, gives alt="a " (decision gate D1, measured on the corpus).
//
// The core chain ends with line_attrs; later rules go `before('line_attrs', …)` so data-line stays last.
// block_strip goes right after block, before inline parsing reads the text it strips (blockStrip.ts).
// The allowlist's rules go right before markdown-it's own raw-HTML rules, which html: false disables:
// safe_block_html with alt paragraph, reference and blockquote (it interrupts those, as in the reference,
// and is not a list terminator), safe_inline_html in the inline chain. balance_details runs after anchors.
import MarkdownIt from 'markdown-it';
import { safeBlockHtml, safeInlineHtml } from './allowlist.js';
import { blockStrip } from './blockStrip.js';
import { balanceDetails } from './details.js';
import { lineAttrs } from './lineAttrs.js';
import { anchors } from './slug.js';

export function createEngine(): MarkdownIt {
  const md = new MarkdownIt('commonmark', {
    html: false,
    xhtmlOut: true,
    breaks: false,
    linkify: false,
    typographer: false,
  });
  md.enable(['table', 'strikethrough']);
  md.core.ruler.push('line_attrs', lineAttrs);
  md.core.ruler.after('block', 'block_strip', blockStrip);
  md.core.ruler.before('line_attrs', 'anchors', anchors);
  md.block.ruler.before('html_block', 'safe_block_html', safeBlockHtml, {
    alt: ['paragraph', 'reference', 'blockquote'],
  });
  md.inline.ruler.before('html_inline', 'safe_inline_html', safeInlineHtml);
  md.core.ruler.before('line_attrs', 'balance_details', balanceDetails);
  return md;
}
