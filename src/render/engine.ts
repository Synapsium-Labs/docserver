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
// Fences render through this library's own rule (fence.ts), not markdown-it's: a Mermaid figure or a
// highlighted code block, with options.highlight left unset.
// alerts and figcaption follow balance_details. They stand in for the reference's HTML post-passes (its
// caption pass ran first, then its alert pass; the two never touch the same tokens, so their order here
// changes nothing). alerts turns blockquotes into alert_open/alert_close, which render through this
// library's own two rules; figcaption puts a caption's tokens after its fence (figcaption_open, the inline
// token, figcaption_close), which render through this library's two rules and renderFence.
// Tables, task lists and footnotes, as the reference renders them:
// - the table block rule is this library's port of markdown-it's (tables.ts), set in its place under the
//   same name and with the same alternatives, so it strips the Python way; table_code goes after
//   figcaption, and tables render through this library's two wrapper rules;
// - the footnote plugin is markdown-it-footnote, used as it ships (its output matches the reference's
//   plugin, xhtmlOut included); it adds footnote_def before reference, footnote_inline and footnote_ref
//   after image, and footnote_tail right after inline; footnote_tail is then replaced in place by a
//   linear port of the plugin's rule, with the same output (footnotes.ts, ruling C26); a plugin upgrade
//   must re-run test/footnote-cost.test.ts, its differential above all;
// - task_lists goes before text_join, so after footnote_tail, as the reference's does (tasklists.ts).
// Front matter is the reference's plugin, ported (frontMatter.ts): front_matter goes first in the block
// chain (before table), with the plugin's alternatives, and renders through this library's own rule.
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import { footnoteTail } from './footnotes.js';
import { alerts, renderAlertClose, renderAlertOpen } from './alerts.js';
import { safeBlockHtml, safeInlineHtml } from './allowlist.js';
import { blockStrip } from './blockStrip.js';
import { balanceDetails } from './details.js';
import { renderFence } from './fence.js';
import { figcaption, renderFigcaptionClose, renderFigcaptionOpen } from './figcaption.js';
import { frontMatterRule, renderFrontMatter } from './frontMatter.js';
import { lineAttrs } from './lineAttrs.js';
import { anchors } from './slug.js';
import { pyTable, renderTableClose, renderTableOpen, tableCode } from './tables.js';
import { taskLists } from './tasklists.js';

export function createEngine(): MarkdownIt {
  const md = new MarkdownIt('commonmark', {
    html: false,
    xhtmlOut: true,
    breaks: false,
    linkify: false,
    typographer: false,
  });
  md.enable(['table', 'strikethrough']);
  md.block.ruler.at('table', pyTable, { alt: ['paragraph', 'reference'] });
  md.use(footnote);
  md.core.ruler.at('footnote_tail', footnoteTail);
  md.core.ruler.push('line_attrs', lineAttrs);
  md.core.ruler.after('block', 'block_strip', blockStrip);
  md.core.ruler.before('line_attrs', 'anchors', anchors);
  md.block.ruler.before('html_block', 'safe_block_html', safeBlockHtml, {
    alt: ['paragraph', 'reference', 'blockquote'],
  });
  md.inline.ruler.before('html_inline', 'safe_inline_html', safeInlineHtml);
  md.core.ruler.before('line_attrs', 'balance_details', balanceDetails);
  md.core.ruler.before('line_attrs', 'alerts', alerts);
  md.core.ruler.before('line_attrs', 'figcaption', figcaption);
  md.core.ruler.before('text_join', 'task_lists', taskLists);
  md.core.ruler.before('line_attrs', 'table_code', tableCode);
  md.block.ruler.before('table', 'front_matter', frontMatterRule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });
  md.renderer.rules.fence = renderFence;
  md.renderer.rules.figcaption_open = renderFigcaptionOpen;
  md.renderer.rules.figcaption_close = renderFigcaptionClose;
  md.renderer.rules.alert_open = renderAlertOpen;
  md.renderer.rules.alert_close = renderAlertClose;
  md.renderer.rules.table_open = renderTableOpen;
  md.renderer.rules.table_close = renderTableClose;
  md.renderer.rules.front_matter = renderFrontMatter;
  return md;
}
