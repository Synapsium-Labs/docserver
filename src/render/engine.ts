// The markdown-it instance behind render() (docserver L1; architecture section C, "Engine"; contract
// section 1). The CommonMark preset with raw HTML off, plus tables and strikethrough, configured once.
// The instance carries no per-document state: everything one render needs lives in its RenderEnv (env.ts).
//
// Pinned on purpose:
// - `html: false` is the raw-HTML wall: markdown-it escapes every tag, and only this library's own rules
//   (Task 5's allowlist) ever emit markup.
// - `maxNesting` stays the preset's 20, as in the reference: deeper blockquotes and lists stop nesting.
// - `validateLink` and `normalizeLink` are markdown-it's own: javascript:, vbscript:, file: and non-image
//   data: links stay text, and destinations are percent-encoded. Never override them.
//
// markdown-it is 14.3.2, not 15: 15 puts a code span's text into an image's alt (`![a `c`](x)` gives
// alt="a c"), where markdown-it-py, a port of 14, gives alt="a " (decision gate D1, measured on the corpus).
//
// The core chain ends with line_attrs; later rules go `before('line_attrs', …)` so data-line stays last.
import MarkdownIt from 'markdown-it';
import { lineAttrs } from './lineAttrs.js';

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
  return md;
}
