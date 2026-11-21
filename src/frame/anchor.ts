// The anchor grammar the bridge carries (docserver parity T1; ruling R2), and the size of a canonical base64 text.
//
// A `from` token is the opaque position text a `hash` op carries and a `goto` command returns: an anchor as JSON text,
// `{ "line", "offset", "y" }`, written and read by the reader (src/enhance/nav.ts: `TOKEN`, `checkAnchor`, `parseToken`).
// `./host` needs the same judgement to refuse a token before it reaches an adapter, and the pure `./frame` entry cannot
// import the reader, so this file holds the grammar word for word. test/frame-anchor.test.ts owns the equality of the two:
// `isAnchorToken(s)` is true exactly when nav's `parseToken(s)` is not null, for every token nav writes and every shape
// nav's check rejects. The frame's bootstrap bundles `isAnchorToken` (docserver parity T3): its `hash` adapter sends a
// `from` only when the token passes, as `./host` refuses one that does not; the port parser reads only the length of a
// `from`, `ANCHOR_LIMITS.from`, and the reader judges a token it is handed back itself.
//
// Pure: constants and two predicates, no import.

/** The bounds of a position token: its `line`, its whole text, and `offset` and `y` (nav's `TOKEN`). */
export const ANCHOR_LIMITS = Object.freeze({ line: 1024, from: 4096, coord: 10_000_000 } as const);

/** What a token's `line` may hold: a block's data-line (`12-14`) or an id of letters, digits, `_` and `-`, never a selector character. */
const LINE_OR_ID = /^[\p{L}\p{N}_-]+$/u;

/**
 * True for a token of the shape the reader writes: at most ANCHOR_LIMITS.from code units of JSON text of an object with
 * `line` null, or a string of at most ANCHOR_LIMITS.line code units of letters, digits, `_` and `-` (so `12`, `12-14` or an
 * id); `offset` a finite number within ANCHOR_LIMITS.coord either way; and `y` a finite number from 0 to ANCHOR_LIMITS.coord.
 * Other members are ignored, as nav ignores them. False for anything else, a non-string included; never a throw.
 */
export function isAnchorToken(s: unknown): boolean {
  if (typeof s !== 'string' || s.length > ANCHOR_LIMITS.from) return false;
  let v: unknown;
  try {
    v = JSON.parse(s);
  } catch {
    return false;
  }
  if (v === null || typeof v !== 'object') return false;
  const { line, offset, y } = v as Record<string, unknown>;
  if (line !== null && !(typeof line === 'string' && line.length <= ANCHOR_LIMITS.line && LINE_OR_ID.test(line))) return false;
  // NaN and the infinities fail each bound
  if (typeof offset !== 'number' || !(Math.abs(offset) <= ANCHOR_LIMITS.coord)) return false;
  if (typeof y !== 'number' || !(y >= 0 && y <= ANCHOR_LIMITS.coord)) return false;
  return true;
}

const BASE64 = /^[A-Za-z0-9+/]*$/;
const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * The number of bytes a canonical base64 text decodes to, from its length and its padding, or null for anything else.
 * Canonical: the standard alphabet, a length that is a multiple of four, `=` only as the last one or two characters
 * (two or three characters of data in the last group) and the unused bits of the last character zero, so a text has one
 * spelling per byte string. Nothing is decoded; the empty text is zero bytes.
 */
export function pngBytesOfBase64(b64: string): number | null {
  if (typeof b64 !== 'string' || b64.length % 4 !== 0) return null;
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const data = b64.slice(0, b64.length - pad);
  if (!BASE64.test(data)) return null;
  if (pad !== 0) {
    // The last character of data carries two (pad 2) or four (pad 1) bits that no byte uses: canonical text has them zero.
    const unused = pad === 2 ? 0b1111 : 0b11;
    const last = B64_ALPHABET.indexOf(data.charAt(data.length - 1));
    if ((last & unused) !== 0) return null;
  }
  return (b64.length / 4) * 3 - pad;
}
