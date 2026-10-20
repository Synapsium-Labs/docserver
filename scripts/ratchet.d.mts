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

/** One change under conformance/layout/, from `git diff --name-status`. */
export interface LayoutChange {
  readonly status: string;
  readonly path: string;
  readonly id: string;
  readonly kind: 'md' | 'options.json' | 'dom.txt';
}

export declare function layoutChanges(nameStatus: string): LayoutChange[];
export declare function movedLayoutIds(changes: readonly LayoutChange[]): string[];
export declare function checkLayoutMoves(movedIds: readonly string[], trailerIds: readonly string[]): string[];
export declare function hostileLayoutIds(files: readonly { readonly path: string; readonly text: string }[]): string[];
export declare function checkLayoutHostile(hostileIds: readonly string[], changes: readonly LayoutChange[]): string[];
