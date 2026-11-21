// The hostile byline of review 3081 F1, shared by the print, item and screen cases: a meta line whose last fact holds a run
// of white space. The old separator pattern backtracked over the whole run from every start inside it (quadratic): 2.8 s at
// 80 000 spaces, minutes at 1 MiB. The bound is the ratio to the same document with a short gap, with a generous factor and a
// floor, so a slow machine passes and a quadratic scan cannot; the sizes run smallest first so a regression fails in about a
// second, before the 1 MiB case could run for minutes.

export const RUN_SIZES: readonly number[] = [1 << 16, 1 << 20];

/** A document whose byline holds `n` spaces between two words. */
export const bylineWith = (n: number): string => `# T\n\n**Spec** · a${' '.repeat(n)}b\n\n## Body\n\nText.\n`;

/** The most a run of `n` spaces may cost, in ms, given the cost of the short-gap document: 200 times it, and never under 600. */
export const boundMs = (plainMs: number): number => Math.max(600, 200 * plainMs);

/** Milliseconds `fn` takes. */
export function timed(fn: () => void): number {
  const t = performance.now();
  fn();
  return performance.now() - t;
}
