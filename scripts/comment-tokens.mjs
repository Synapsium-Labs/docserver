// The HTML-like comment rule of an inlined script (docserver L3, Task 6; plan Reference §5.4, the fourth byte rule).
//
// In a classic script `<!--` starts a single-line comment, and so does `-->` at the start of a line (ECMAScript Annex
// B.1.1), so either one outside a literal changes what the script means once it is inlined. `<!--` inside a script
// element can also move the HTML tokenizer into its script-data escape states. So each built script may hold `<!--` and
// `-->` only inside a string, template or regular expression literal: the script is parsed with the TypeScript parser
// (as JavaScript), the source range of every literal token is collected, and every occurrence of either sequence must
// lie wholly inside one of them. One in a comment, an identifier, an operator sequence (`a-->b`) or anywhere else is a
// hazard.
//
// It needs the TypeScript parser, a devDependency, so it runs at build time (scripts/build-frame.mjs) and in tests
// only; src/frame/bytes.ts, which `./frame` ships and frameDocument runs, holds the other three byte rules, and
// frameDocument's sha256 check against FRAME_MANIFEST binds the exact bytes this rule passed. Dev tooling, never
// shipped; types in comment-tokens.d.mts.
import ts from 'typescript';

/** The two sequences the rule watches. */
export const HTML_COMMENT_TOKENS = Object.freeze(['<!--', '-->']);

/** The literal kinds inside which the sequences are allowed. */
const LITERALS = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.RegularExpressionLiteral,
]);

/** The [start, end) source ranges of every literal token of `text`, parsed as JavaScript, in source order. */
export function literalRanges(text) {
  const source = ts.createSourceFile('script.js', text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const ranges = [];
  const visit = (n) => {
    if (LITERALS.has(n.kind)) ranges.push([n.getStart(source), n.end]);
    ts.forEachChild(n, visit);
  };
  visit(source);
  ranges.sort((a, b) => a[0] - b[0]);
  return ranges;
}

/**
 * The hazards of `text` under the rule: one entry per `<!--` or `-->` that is not wholly inside a literal token, with
 * its offset. Empty when the script may be inlined.
 */
export function commentTokenHazards(text) {
  const hits = [];
  for (const token of HTML_COMMENT_TOKENS) {
    for (let at = text.indexOf(token); at >= 0; at = text.indexOf(token, at + 1)) hits.push([at, token]);
  }
  if (hits.length === 0) return [];
  hits.sort((a, b) => a[0] - b[0]);
  const ranges = literalRanges(text);
  const out = [];
  let r = 0;
  for (const [at, token] of hits) {
    while (r < ranges.length && (ranges[r]?.[1] ?? 0) <= at) r++;
    const range = ranges[r];
    const inside = range !== undefined && range[0] <= at && at + token.length <= range[1];
    if (!inside) out.push(`${token} outside a literal at offset ${String(at)}`);
  }
  return out;
}

/** How many occurrences of `<!--` and `-->` `text` holds, each inside a literal or not (for the build's report). */
export function commentTokenCount(text) {
  let n = 0;
  for (const token of HTML_COMMENT_TOKENS) for (let at = text.indexOf(token); at >= 0; at = text.indexOf(token, at + 1)) n++;
  return n;
}
