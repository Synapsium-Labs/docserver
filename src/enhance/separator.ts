// The byline separator scan of the screen's title block (review 3081 F1). The render's print and item routes have a twin of
// this file, src/render/separator.ts, with the same code from the line below on: the reader's import graph stays inside
// src/enhance and ./render stays pure, so one file cannot serve both. test/print-agreement.test.ts holds the two byte-equal
// from the marker line and holds the scan equal to the pattern it replaced.
// --- twin: byte-equal from here on
/** One byline separator found in a text: where it starts and how long it is, in code units. */
export interface Separator {
  readonly index: number;
  readonly length: number;
}

/** True for a code unit the ECMAScript `\s` class holds (held equal to the pattern by test/print-agreement.test.ts). */
function isSpace(c: number): boolean {
  if (c < 0x80) return c === 0x20 || (c >= 0x09 && c <= 0x0d);
  return c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) || c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f || c === 0x3000 || c === 0xfeff;
}

/**
 * The first byline separator of `text`: a middle dot with white space on both sides, the white space before it and after it
 * taken whole; null when there is none. It is what `/\s+·\s+/.exec(text)` finds, by a scan: that pattern backtracks over a run
 * of white space from every start inside it (quadratic, review 3081 F1). A dot is tried once, its runs are read once, and a
 * dot that is not a separator costs the two code units beside it.
 */
export function findSeparator(text: string): Separator | null {
  const n = text.length;
  for (let p = text.indexOf('·'); p >= 0; p = text.indexOf('·', p + 1)) {
    if (p === 0 || p + 1 >= n || !isSpace(text.charCodeAt(p - 1)) || !isSpace(text.charCodeAt(p + 1))) continue;
    let from = p - 1;
    while (from > 0 && isSpace(text.charCodeAt(from - 1))) from -= 1;
    let to = p + 2;
    while (to < n && isSpace(text.charCodeAt(to))) to += 1;
    return { index: from, length: to - from };
  }
  return null;
}
