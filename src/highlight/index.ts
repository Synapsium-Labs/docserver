// The public entry of `@synapsium-labs/docserver/highlight` (docserver L3, Task 11; the first consumer's request (a)):
// the code highlighter render() itself uses, ruling C24 included, re-exported unchanged from src/render/highlight.ts,
// with the highlight.js version it runs. Pure and worker-safe: no DOM, no clock, no randomness, no I/O, and nothing
// runs at import but building the private highlight.js instance. One highlighter per document gives render()'s code
// html for each fence passed to it in order.
export {
  createHighlighter,
  HIGHLIGHT_ENGINE,
  LANGUAGES,
  MAX_DOCUMENT_CHARS,
  MAX_LINE_CHARS,
  MAX_WHOLE_BLOCK_CHARS,
  resolveLanguage,
} from '../render/highlight.js';
export type { Highlighter, HighlighterOptions, HighlightMode, HighlightResult } from '../render/highlight.js';
