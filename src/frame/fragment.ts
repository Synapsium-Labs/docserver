// The one fragment grammar (docserver L3; plan Reference §9, ruling R1, FD9). The frame sends a `hash` only for an id
// inside it, `./host` refuses a `hash` outside it, frameDocument seeds an initialHash outside it as null, and
// conformance/bridge-cases.json judges hashes by it. This file is the pattern's only home (row L3.M10 scans for a copy).
// Pure: a constant and a predicate.
//
// It accepts every id the layout can go to: heading slugs (Unicode letters and numbers, `_` and `-`; src/render/slug.ts),
// anchor ids (`[A-Za-z0-9_-]{1,100}`; src/render/allowlist.ts), footnote ids with a colon (`fn1`, `fnref1:1`), defined
// IDs of L2's default ID grammar with a dot (`D2.1a`) and rule IDs (`AB-12-C`). Combining marks are admitted with the
// letters they follow. An id outside it arises only from an exotic custom ID prefix or an unassigned code point in a
// slug: it is never sent and never thrown on.

/**
 * The grammar: 1 to 256 UTF-16 code units of Unicode letters, marks and numbers, `_`, `.`, `:` and `-`. The length is
 * counted in code units (`s.length`), apart from the pattern, so 129 astral letters (258 code units) are refused.
 */
export const FRAGMENT_ID_GRAMMAR = Object.freeze({
  source: '^[\\p{L}\\p{M}\\p{N}_.:-]+$',
  flags: 'u',
  maxCodeUnits: 256,
} as const);

const FRAGMENT_ID = new RegExp(FRAGMENT_ID_GRAMMAR.source, FRAGMENT_ID_GRAMMAR.flags);

/** True for a string inside FRAGMENT_ID_GRAMMAR; false for anything else, never a throw. */
export function isFragmentId(s: unknown): s is string {
  return typeof s === 'string' && s.length >= 1 && s.length <= FRAGMENT_ID_GRAMMAR.maxCodeUnits && FRAGMENT_ID.test(s);
}
