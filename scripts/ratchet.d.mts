// Types for scripts/ratchet.mjs, which runs under plain Node in CI and is imported by test/ratchet.test.ts.

/** One entry of conformance/hostile.json as the ratchet reads it. */
export interface RatchetEntry {
  readonly id: string;
  readonly input?: unknown;
  readonly verdict: Readonly<Record<string, unknown>>;
}

export declare const VERDICT_KEYS: readonly string[];
export declare function compareVerdicts(base: readonly RatchetEntry[], head: readonly RatchetEntry[]): string[];
export declare function checkGoldenMoves(changedIds: readonly string[], trailerIds: readonly string[]): string[];
export declare function checkHostileInputs(base: readonly RatchetEntry[], changedPaths: readonly string[]): string[];
export declare function parseTrailerIds(log: string): string[];
export declare function expectedIds(paths: readonly string[]): string[];
