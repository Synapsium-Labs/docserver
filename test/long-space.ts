// The hostile byline of review 3081 F1, shared by the print, item and screen cases: a meta line whose last fact holds a run
// of white space. The old separator pattern backtracked over the whole run from every start inside it (quadratic): 2.8 s at
// 80 000 spaces, minutes at 1 MiB. Each case bounds the work two ways. The deterministic one counts the calls of the separator
// helper (a `vi.mock` wrapper on its module in the test file): the pattern restored in a caller means the helper is never
// called, so the count is 0 and the case is red with no clock. The other is a stopwatch backstop on the SAME 1 MiB input,
// `render(md)` against `render(md, opts)` (or the screen's run against the same run outside the byline), with a generous
// factor and a floor, that catches a quadratic helper; the sizes run smallest first so a regression fails in about a second.

export const RUN_SIZES: readonly number[] = [1 << 16, 1 << 20];

/** A document whose byline holds `n` spaces between two words. */
export const bylineWith = (n: number): string => `# T\n\n**Spec** · a${' '.repeat(n)}b\n\n## Body\n\nText.\n`;

/** The same run in the three places a separator pattern meets it: apart from the dot (the review's), after the dot, and before it. */
export const bylinesWith = (n: number): readonly string[] => [
  bylineWith(n),
  `# T\n\n**Spec** ·${' '.repeat(n)}b\n\n## Body\n\nText.\n`,
  `# T\n\n**Spec** a${' '.repeat(n)}· b\n\n## Body\n\nText.\n`,
];

/** The most a run may cost, in ms, given the cost of the same input without the feature: 100 times it, and never under 600. */
export const boundMs = (baselineMs: number): number => Math.max(600, 100 * baselineMs);

/** Milliseconds `fn` takes. */
export function timed(fn: () => void): number {
  const t = performance.now();
  fn();
  return performance.now() - t;
}

/** The calls of Array's `splice` on an array longer than 500 during `fn` (a plain patch, restored in `finally`): a deterministic bound on a tree's moves, not a clock. */
export function longSplices(fn: () => void): { calls: number; moved: number } {
  const out = { calls: 0, moved: 0 };
  const proto = Array.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
  const original = proto['splice'] as (...a: unknown[]) => unknown;
  proto['splice'] = function (this: unknown[], ...a: unknown[]): unknown {
    if (this.length > 500) {
      out.calls += 1;
      out.moved += this.length;
    }
    return original.apply(this, a);
  };
  try {
    fn();
  } finally {
    proto['splice'] = original;
  }
  return out;
}

/** What `sliceWork` counts: the calls of a string cut on a receiver of at least `LONG_TEXT` code units, and the code units those calls returned. */
export const LONG_TEXT = 4096;

/** The most the long cuts of a build may return, as a multiple of the document's length: see each case for how it was chosen. */
export const LONG_CUT_FACTOR = 8;

/**
 * The cuts of long strings during `fn`, by a plain patch of `String.prototype.slice`, `substring` and `substr` (restored in
 * `finally`): the number of calls whose receiver is at least LONG_TEXT code units, and the total length they return. A build that
 * cuts the text left once per separator returns about k times half the text; one that cuts each piece once returns about the text
 * (review 3088 F3, WebKit cycle 1: V8 shares the bytes of a cut, JavaScriptCore may copy them, so the count is what is held,
 * not a clock). A structural bound, equal on every engine.
 */
export function sliceWork(fn: () => void): { calls: number; returned: number } {
  const { out, restore } = patchSlices();
  try {
    fn();
  } finally {
    restore();
  }
  return out;
}

/** `sliceWork` for a build that awaits (the screen's enhance). */
export async function sliceWorkAsync(fn: () => Promise<void>): Promise<{ calls: number; returned: number }> {
  const { out, restore } = patchSlices();
  try {
    await fn();
  } finally {
    restore();
  }
  return out;
}

function patchSlices(): { out: { calls: number; returned: number }; restore: () => void } {
  const out = { calls: 0, returned: 0 };
  const proto = String.prototype as unknown as Record<string, (...a: unknown[]) => string>;
  const saved: Record<string, (...a: unknown[]) => string> = {};
  for (const name of ['slice', 'substring', 'substr'] as const) {
    const original = proto[name] as (...a: unknown[]) => string;
    saved[name] = original;
    proto[name] = function (this: string, ...a: unknown[]): string {
      const r = original.apply(this, a);
      if (this.length >= LONG_TEXT) {
        out.calls += 1;
        out.returned += r.length;
      }
      return r;
    };
  }
  return {
    out,
    restore: () => {
      for (const name of ['slice', 'substring', 'substr'] as const) proto[name] = saved[name] as (...a: unknown[]) => string;
    },
  };
}

/** A byline of `k` separators: "**Spec** · a · a · …", about 4 code units each. */
export const manySeparators = (k: number): string => `# T\n\n**Spec** · ${'a · '.repeat(k)}z\n\n## Body\n\nText.\n`;

/** A byline of `k` facts with a bold value: "**Spec** · Owner: **a** · Owner: **a** · …", so the meta paragraph holds about 3k child nodes, `k` of them elements a fact takes. */
export const manyFacts = (k: number): string => `# T\n\n**Spec** · ${'Owner: **a** · '.repeat(k)}Owner: **z**\n\n## Body\n\nText.\n`;
