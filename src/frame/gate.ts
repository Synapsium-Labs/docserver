// The Mermaid gate and the frame's Mermaid ceilings (docserver L3, Task 7; plan Reference §1, FD12; the first consumer's
// spec §4.6 and its row M8.20). Pure: constants and one function of plain numbers.
//
// The gate decides whether a host inlines the Mermaid frame script at all, from scanRefs()'s counts of a document's
// Mermaid fences, in UTF-16 code units: the unit of L2's own per-diagram check (`text.length > maxTextSize`,
// src/enhance/diagrams.ts), so the gate and the layout judge a fence alike (FD12). A document gets Mermaid only with
// at least one fence, at most `maxFences` of them and at most `maxTotalChars` in all; over the count or the total, every
// figure shows its source. The per-fence cap is not a whole-document verdict: it travels as `maxTextSize`, so the layout
// shows only the fence over it as its source, with its note, and draws the others (spec §4.6: "A fence over the
// per-fence cap shows as its source with a note").
//
// Caps only tighten: a cap above its default, and a frame Mermaid limit above its ceiling, are refused.

/** The gate's caps: 24 fences, 16 KiB of code units per fence, 128 KiB in all (the first consumer's spec §4.6). */
export const MERMAID_GATE_DEFAULTS = Object.freeze({ maxFences: 24, maxFenceChars: 16384, maxTotalChars: 131072 } as const);

/**
 * The most a host may pass as FrameOptions.mermaid's `maxTextSize` and `maxEdges`: Mermaid's own defaults, which are the
 * layout's MAX_TEXT_SIZE and MAX_EDGES (src/enhance/diagrams.ts; test/frame-document.test.ts holds them equal). A host
 * may only lower them; frameDocument refuses a value above as invalid-input.
 */
export const MERMAID_LIMIT_CEILINGS = Object.freeze({ maxTextSize: 50000, maxEdges: 500 } as const);

/** The counts the gate reads: scanRefs().mermaid's code-unit fields. */
export interface MermaidCounts {
  readonly fences: number;
  readonly largestChars: number;
  readonly totalChars: number;
}

/** A host's own caps, each at most its default. */
export interface MermaidGateCaps {
  readonly maxFences?: number;
  readonly maxFenceChars?: number;
  readonly maxTotalChars?: number;
}

const CAP_NAMES = Object.keys(MERMAID_GATE_DEFAULTS) as readonly (keyof typeof MERMAID_GATE_DEFAULTS)[];
const COUNT_NAMES: readonly (keyof MermaidCounts)[] = ['fences', 'largestChars', 'totalChars'];

/**
 * The own data property `k` of `v`, never a getter (refused) or an inherited one (absent). A `v` of null or undefined
 * is the TypeError Object.getOwnPropertyDescriptor throws.
 */
function own(v: unknown, k: string, where: string): unknown {
  const d = Object.getOwnPropertyDescriptor(v as object, k);
  if (d === undefined) return undefined;
  if (!('value' in d)) throw new TypeError(`mermaidGate: ${where}.${k} must be a plain value, not a getter`);
  return d.value as unknown;
}

/**
 * Whether to inline Mermaid for a document with these counts, and the `maxTextSize` to pass with it (the per-fence cap,
 * so the layout shows a longer fence as its source). Counts are UTF-16 code units. Counts or caps that are not an object,
 * a count that is not a non-negative integer, a cap that is not a number and an unknown cap are a TypeError; a cap that
 * is not an integer from 1 to its default is a RangeError: caps only tighten.
 */
export function mermaidGate(m: MermaidCounts, caps: MermaidGateCaps = {}): { inline: boolean; maxTextSize: number } {
  const counts: Record<string, number> = {};
  for (const k of COUNT_NAMES) {
    const v = own(m, k, 'counts');
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw new TypeError(`mermaidGate: counts.${k} must be a non-negative integer`);
    counts[k] = v;
  }
  if (typeof caps !== 'object' || caps === null) throw new TypeError('mermaidGate: caps must be an object');
  const unknown = Object.getOwnPropertyNames(caps).filter((k) => !(CAP_NAMES as readonly string[]).includes(k));
  if (unknown.length > 0) throw new TypeError(`mermaidGate: unknown caps: ${unknown.join(', ')}`);
  const c: Record<string, number> = {};
  for (const k of CAP_NAMES) {
    const v = own(caps, k, 'caps');
    if (v === undefined) {
      c[k] = MERMAID_GATE_DEFAULTS[k];
      continue;
    }
    if (typeof v !== 'number') throw new TypeError(`mermaidGate: caps.${k} must be a number`);
    if (!Number.isInteger(v) || v < 1 || v > MERMAID_GATE_DEFAULTS[k]) {
      throw new RangeError(`mermaidGate: caps.${k} must be an integer from 1 to ${String(MERMAID_GATE_DEFAULTS[k])}: caps only tighten`);
    }
    c[k] = v;
  }
  const fences = counts['fences'] as number;
  const inline = fences >= 1 && fences <= (c['maxFences'] as number) && (counts['totalChars'] as number) <= (c['maxTotalChars'] as number);
  return { inline, maxTextSize: c['maxFenceChars'] as number };
}
