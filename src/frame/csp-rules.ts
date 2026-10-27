// The frame policy's floor (docserver L3; plan Reference §10): the tokeniser and every rule of checkFrameCsp except the
// hash set. Kept apart from csp.ts, which reads the generated manifest, because the bootstrap bundles this file for its
// own self-check and must not carry the hashes (its own among them). It imports nothing. Pure.

/**
 * Every reason a frame policy is refused for, one per rule of Reference §10, in the order the rules are checked: the
 * policy is not a string; it is over 4096 characters; it holds a character outside printable ASCII or one of `"<>&`; a
 * directive outside FRAME_DIRECTIVES; a directive given twice; then each directive's own rule; then, in
 * checkFrameCsp only, a required hash missing and a hash unknown to this version. A refusal names its reason, never a
 * message, so a test names the rule that refused.
 */
export const CSP_REFUSALS = /* @__PURE__ */ Object.freeze([
  'type',
  'length',
  'character',
  'directive',
  'duplicate',
  'default-src',
  'script-src',
  'style-src',
  'font-src',
  'img-src',
  'base-uri',
  'form-action',
  'missing-hash',
  'unknown-hash',
] as const);

/** A reason from CSP_REFUSALS. */
export type CspRefusal = (typeof CSP_REFUSALS)[number];

/** The reasons the floor itself gives: all but the hash set's two. */
export type FloorRefusal = Exclude<CspRefusal, 'missing-hash' | 'unknown-hash'>;

/** The directives a frame policy may hold. */
export const FRAME_DIRECTIVES: readonly string[] = ['default-src', 'script-src', 'style-src', 'font-src', 'img-src', 'base-uri', 'form-action'];

/** One script-src source: a SHA-256 hash, the only kind the frame policy admits. */
export const HASH_SOURCE = /^'sha256-[A-Za-z0-9+/]{43}='$/;

/** The longest policy accepted, in characters (4096 passes). */
export const CSP_MAX_CHARS = 4096;

const ONLY = (allowed: readonly string[]) => (tokens: readonly string[]): boolean => tokens.every((t) => allowed.includes(t));

export type FloorCheck = { readonly ok: true; readonly scriptHashes: readonly string[] } | { readonly ok: false; readonly why: FloorRefusal };

/**
 * Check `csp` against the frame policy's floor: a string of at most CSP_MAX_CHARS printable ASCII characters without
 * `"<>&`; split on `;` into directives and each on ASCII whitespace into tokens; only FRAME_DIRECTIVES, each once;
 * default-src 'none'; script-src hash sources only, at least one; style-src only 'unsafe-inline' and data:; font-src
 * and img-src only data: (each of those three may be left out: default-src 'none' then applies, which only tightens);
 * base-uri and form-action present and 'none'. Answers the script-src hashes, in order. This is the one tokeniser of a
 * policy (test/frame-csp.test.ts pins it).
 */
export function cspFloor(csp: string): FloorCheck {
  if (typeof csp !== 'string') return { ok: false, why: 'type' };
  if (csp.length > CSP_MAX_CHARS) return { ok: false, why: 'length' };
  if (!/^[\x20-\x7e]*$/.test(csp) || /["<>&]/.test(csp)) return { ok: false, why: 'character' };
  const seen = new Map<string, string[]>();
  for (const part of csp.split(';')) {
    const tokens = part.split(/[\t\n\f\r ]+/).filter((t) => t !== '');
    const [name, ...values] = tokens;
    if (name === undefined) continue;
    if (!FRAME_DIRECTIVES.includes(name)) return { ok: false, why: 'directive' };
    if (seen.has(name)) return { ok: false, why: 'duplicate' };
    seen.set(name, values);
  }
  const is = (name: string, test: (t: readonly string[]) => boolean): boolean => {
    const v = seen.get(name);
    return v !== undefined && test(v);
  };
  const none = (v: readonly string[]): boolean => v.length === 1 && v[0] === "'none'";
  if (!is('default-src', none)) return { ok: false, why: 'default-src' };
  if (!is('script-src', (v) => v.length > 0 && v.every((t) => HASH_SOURCE.test(t)))) return { ok: false, why: 'script-src' };
  if (seen.has('style-src') && !is('style-src', ONLY(["'unsafe-inline'", 'data:']))) return { ok: false, why: 'style-src' };
  if (seen.has('font-src') && !is('font-src', ONLY(['data:']))) return { ok: false, why: 'font-src' };
  if (seen.has('img-src') && !is('img-src', ONLY(['data:']))) return { ok: false, why: 'img-src' };
  if (!is('base-uri', none)) return { ok: false, why: 'base-uri' };
  if (!is('form-action', none)) return { ok: false, why: 'form-action' };
  return { ok: true, scriptHashes: seen.get('script-src') ?? [] };
}
