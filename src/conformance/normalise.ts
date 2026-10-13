// Comparison normalisation for the conformance corpus (docserver L1; architecture section D, departure PD1).
// The reference renderer highlights fences with Pygments and this library with highlight.js; the two tokenise
// differently, so their span markup can never be byte-equal. What a reader sees, and what the reading layout
// reads (the text of `.codehilite > pre`), is the wrapper and the text, and those stay byte-exact: inside each
// highlighted block the markup is reduced to its text, escaped the way markdown-it escapes text. Nothing
// outside such a block is touched: not `pre.mermaid`, not indented `<pre><code>`, not any other element.

/** One highlighted fence as both renderers emit it: the wrapper (with or without data-line), then one <pre>.
 * Inside it every literal `<` is escaped, so the first `</pre></div>` is the block's own end. */
const CODE_BLOCK = /(<div class="codehilite"(?: data-line="[^"]*")?><pre>)([\s\S]*?)(<\/pre><\/div>)/g;

/** Any tag inside a block: Pygments' and highlight.js' spans, highlight.js' <code> wrapper. */
const TAG = /<[^>]*>/g;

/** The entities either highlighter writes, decoded in ONE pass so `&amp;lt;` stays the text `&lt;`. */
const ENTITY = /&(?:lt|gt|amp|quot|#39|#x27);/g;
const DECODED: Readonly<Record<string, string>> = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
};

/** markdown-it's escapeHtml: & < > " (an apostrophe stays as it is). */
const SPECIAL = /[&<>"]/g;
const ESCAPED: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** The canonical text of one block's inner HTML: tags removed, entities decoded once, re-escaped. */
function canonicalText(inner: string): string {
  const text = inner.replace(TAG, '').replace(ENTITY, (e) => DECODED[e] ?? e);
  return text.replace(SPECIAL, (c) => ESCAPED[c] ?? c);
}

/**
 * Reduce every highlighted code block to `<div class="codehilite"{ data-line}><pre>{escaped text}</pre></div>`
 * and return everything else unchanged. Idempotent. The corpus compares `normaliseForCompare(actual.html)`
 * with `conformance/expected/<id>.html`, which is `normaliseForCompare(reference.html)` unless a departure
 * is listed.
 */
export function normaliseForCompare(html: string): string {
  return html.replace(CODE_BLOCK, (_block, open: string, inner: string, close: string) => open + canonicalText(inner) + close);
}
