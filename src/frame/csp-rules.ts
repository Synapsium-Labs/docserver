// The frame policy's floor (docserver L3; design §9): the tokeniser and every rule of checkFrameCsp except the hash
// set. Kept apart from csp.ts, which reads the generated manifest, because the bootstrap bundles this file for its own
// self-check and must not carry the hashes (its own among them). Pure.

/** The directives a frame policy may hold. */
export const FRAME_DIRECTIVES: readonly string[] = ['default-src', 'script-src', 'style-src', 'font-src', 'img-src', 'base-uri', 'form-action'];

/** One script-src source: a SHA-256 hash, the only kind the frame policy admits. */
export const HASH_SOURCE = /^'sha256-[A-Za-z0-9+/]{43}='$/;

const ONLY = (allowed: readonly string[]) => (tokens: readonly string[]): boolean => tokens.every((t) => allowed.includes(t));

export type FloorCheck = { readonly ok: true; readonly scriptHashes: readonly string[] } | { readonly ok: false; readonly why: string };

/**
 * Check `csp` against the frame policy's floor: printable ASCII without `"<>&`; only FRAME_DIRECTIVES, each once;
 * default-src 'none'; script-src hash sources only; style-src only 'unsafe-inline' and data:; font-src and img-src only
 * data:; base-uri and form-action present and 'none'. Answers the script-src hashes.
 */
export function cspFloor(csp: string): FloorCheck {
  if (typeof csp !== 'string' || csp.length === 0 || csp.length > 4096) return { ok: false, why: 'not a policy' };
  if (!/^[\x20-\x7e]*$/.test(csp) || /["<>&]/.test(csp)) return { ok: false, why: 'a character outside printable ASCII, or one of "<>&' };
  const seen = new Map<string, string[]>();
  for (const part of csp.split(';')) {
    const tokens = part.split(/[\t\n\f\r ]+/).filter((t) => t !== '');
    const [name, ...values] = tokens;
    if (name === undefined) continue;
    if (!FRAME_DIRECTIVES.includes(name)) return { ok: false, why: `directive ${name}` };
    if (seen.has(name)) return { ok: false, why: `duplicate ${name}` };
    seen.set(name, values);
  }
  const is = (name: string, test: (t: readonly string[]) => boolean): boolean => {
    const v = seen.get(name);
    return v !== undefined && test(v);
  };
  if (!is('default-src', (v) => v.length === 1 && v[0] === "'none'")) return { ok: false, why: "default-src must be 'none'" };
  if (!is('script-src', (v) => v.length > 0 && v.every((t) => HASH_SOURCE.test(t)))) return { ok: false, why: 'script-src must hold hash sources only' };
  if (seen.has('style-src') && !is('style-src', ONLY(["'unsafe-inline'", 'data:']))) return { ok: false, why: 'style-src' };
  if (seen.has('font-src') && !is('font-src', ONLY(['data:']))) return { ok: false, why: 'font-src' };
  if (seen.has('img-src') && !is('img-src', ONLY(['data:']))) return { ok: false, why: 'img-src' };
  if (!is('base-uri', (v) => v.length === 1 && v[0] === "'none'")) return { ok: false, why: "base-uri must be 'none'" };
  if (!is('form-action', (v) => v.length === 1 && v[0] === "'none'")) return { ok: false, why: "form-action must be 'none'" };
  return { ok: true, scriptHashes: seen.get('script-src') ?? [] };
}
