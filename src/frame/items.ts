// The resolved item links of a frame (docserver parity, Task 4; the first consumer's design, section 6): the full checks of
// what the seed's `items` carries. The bootstrap's validator (seed.ts) judges only the outer shape, to keep its 32 KiB; the
// rest is judged here, by frameDocument before the seed is written and by the reader before it draws a link
// (src/frame-runtime/enhance-entry.ts). Pure, import-free, so neither the bootstrap nor the reader bundles anything else:
// the caps are copies of SEED_LIMITS' and BRIDGE_LIMITS', held equal by test/frame-seed.test.ts.

/** One resolved item link: an item value the document names (render()'s `meta.items`), and the absolute `https:` URL it opens. */
export interface ItemLink {
  readonly value: string;
  readonly href: string;
}

/** The bounds: how many links, a value's length and an href's length, in code units. */
export const ITEM_LIMITS = Object.freeze({ max: 50, valueMax: 100, hrefMax: 4096 } as const);

/**
 * What an item href must not hold, matching `./host`'s `classifyLink` (test/host-links.test.ts holds the two equal). Two things
 * are refused anywhere in the href, the host part included: white space of any kind (`\s`, which takes U+2028, U+2029 and
 * U+FEFF), the C0 controls, DEL and the C1 controls, the Arabic letter mark, the zero-width characters and directional marks
 * U+200B to U+200F, the bidi controls U+202A to U+202E and U+2066 to U+2069, the word joiner U+2060, and the tag characters
 * U+E0000 to U+E007F; and a backslash, raw or percent-encoded (`%5c` in any case, `classifyLink`'s `BACKSLASH`). This file
 * imports nothing, so the character table is a copy of `./host`'s hidden-character table (src/host/copy.ts). The equality is
 * of these refusals, in the host part, the path, the query and the fragment alike, and nothing more: the rest of the host
 * part's grammar (a bad percent escape, a forbidden host code point, say) is `classifyLink`'s alone, and its click is dropped
 * there. Two differences in the host part are known and pinned by that test: a lone surrogate (the frame admits it, the host's
 * URL parser refuses it) and `%255c` (the frame admits it; the host decodes the `%25` and refuses it); in the path, the query
 * and the fragment both grammars admit each. So a character or escape of those the frame refuses is refused by the host too, and what the frame admits in the path,
 * the query and the fragment the host reads as an external https link; a host part the frame admits the host may still refuse.
 *
 * The scheme is spelled `[Hh][Tt][Tt][Pp][Ss]` and the pattern has no `i` flag: with `u` beside `i` the engine folds U+017F (long
 * s) to `s`, so `http` + U+017F + `://` would pass here while `classifyLink` reads it as a relative path (review 3081 round 2, I1).
 * The escape's two cases are spelled out the same way (`%5[cC]`, no `i`); its lookahead reads the href once, so it is linear.
 */
const HTTPS_URL =
  /^(?![^]*%5[cC])[Hh][Tt][Tt][Pp][Ss]:\/\/[^\s\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\u{e0000}-\u{e007f}\\/?#@]+(?:[/?#][^\s\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\u{e0000}-\u{e007f}\\]*)?$/u;

/** True for an href a frame may draw: 1 to ITEM_LIMITS.hrefMax code units and an absolute `https:` URL. */
export function isItemHref(href: unknown): href is string {
  return typeof href === 'string' && href.length <= ITEM_LIMITS.hrefMax && HTTPS_URL.test(href);
}

const isPlain = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const p: unknown = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
};

/**
 * Why `v`, host data already copied as plain data, is not a list of item links; null when it is one. At most ITEM_LIMITS.max
 * plain `{ value, href }` objects, each `value` a string of 1 to ITEM_LIMITS.valueMax code units and each `href` an absolute
 * `https:` URL of at most ITEM_LIMITS.hrefMax. The reason names the entry and its field, and never repeats a value.
 */
export function itemsWhy(v: unknown): string | null {
  if (!Array.isArray(v)) return 'items must be a list';
  if (v.length > ITEM_LIMITS.max) return `items has more than ${String(ITEM_LIMITS.max)} entries`;
  for (let i = 0; i < v.length; i += 1) {
    const e: unknown = v[i];
    if (!isPlain(e) || Object.keys(e).length !== 2 || !Object.hasOwn(e, 'value') || !Object.hasOwn(e, 'href')) return `items[${String(i)}] must be { value, href }`;
    const value = e['value'];
    if (typeof value !== 'string' || value.length < 1 || value.length > ITEM_LIMITS.valueMax) {
      return `items[${String(i)}].value must be a string of 1 to ${String(ITEM_LIMITS.valueMax)} code units`;
    }
    if (!isItemHref(e['href'])) return `items[${String(i)}].href must be an absolute https: URL of at most ${String(ITEM_LIMITS.hrefMax)} code units`;
  }
  return null;
}
