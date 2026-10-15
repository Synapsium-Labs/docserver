// Python text semantics for the rules ported from the reference renderer (docserver L1; architecture
// section C, global constraint 6). Wherever the reference used Python's `\s`, `str.strip()`, `str.lower()`,
// `len()` or `[:n]`, the port calls these and never JS's `\s`, `trim()`, `.length` or `.slice()`:
// - Python's whitespace is not JS's: Python counts \x1c-\x1f and \x85 and not U+FEFF; JS the reverse.
// - Python's len() and slices count code points; JS's count UTF-16 code units and can split a surrogate pair.
// Every function here is linear in its input: no regular expression that can backtrack over a long run.

/**
 * The characters Python 3.12's `str.isspace()` accepts (its `\s` and `strip()` set), as the body of a
 * regular-expression character class, for rules that build their own patterns (`new RegExp(`[${PY_WS}]`)`).
 * All are in the Basic Multilingual Plane, so each is one UTF-16 code unit.
 */
export const PY_WS = '\\t\\n\\v\\f\\r \\x1c-\\x1f\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';

const PY_WS_CHAR = new RegExp(`^[${PY_WS}]$`);

/** True when the one-code-unit string `ch` is Python whitespace. */
export function isPyWs(ch: string): boolean {
  return PY_WS_CHAR.test(ch);
}

/** Python's `str.strip()` with no argument: removes leading and trailing Python whitespace. */
export function pyStrip(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && isPyWs(s.charAt(start))) start += 1;
  while (end > start && isPyWs(s.charAt(end - 1))) end -= 1;
  return start === 0 && end === s.length ? s : s.substring(start, end);
}

/**
 * Python's `str.lower()`. Both Python and JS apply Unicode's full lower-case mapping to the whole string,
 * including the context-sensitive final sigma ('ΟΔΟΣ' gives 'οδος' in both), so this is `toLowerCase()`
 * on the whole string. Lowering one code point at a time would give 'οδοσ', which Python never does.
 * Python 3.12 uses Unicode 15.0 and Node's ICU a later version; characters assigned since 15.0 may differ.
 */
export function pyLower(s: string): string {
  return s.toLowerCase();
}

/** Python's `len()`: the number of code points; a lone surrogate counts as one. */
export function cpLength(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) i += 1;
    }
    n += 1;
  }
  return n;
}

/** Python's `s[:n]` for n >= 0: the first `n` code points. Never splits a surrogate pair. */
export function cpSlice(s: string, n: number): string {
  let i = 0;
  let taken = 0;
  while (i < s.length && taken < n) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) i += 1;
    }
    i += 1;
    taken += 1;
  }
  return i === s.length ? s : s.substring(0, i);
}

/**
 * The UTF-8 length of `s` (a lone surrogate counts 3 bytes, as an encoder writes U+FFFD for it), counting
 * no further than `cap`: once the count passes `cap` it returns `cap + 1`, so a caller gating on
 * `utf8Length(s, cap) > cap` never walks the rest of an oversized input.
 */
export function utf8Length(s: string, cap: number): number {
  let bytes = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        bytes += 4;
        i += 1;
      } else bytes += 3;
    } else bytes += 3;
    if (bytes > cap) return cap + 1;
  }
  return bytes;
}
