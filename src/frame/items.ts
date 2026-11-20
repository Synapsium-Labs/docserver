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
 * An absolute `https:` URL: the scheme, `//`, a host with no user information, white space, control character (C0, DEL or C1)
 * or backslash, then optionally a path, query and fragment with none of those either. The reader draws no other link.
 */
const HTTPS_URL = /^https:\/\/[^\s\u0000-\u001f\u007f-\u009f\\/?#@]+(?:[/?#][^\s\u0000-\u001f\u007f-\u009f\\]*)?$/i;

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
