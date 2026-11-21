// Types for scripts/free-globals.mjs, which runs under plain Node and is imported by scripts/build-frame.mjs and
// test/frame-build.test.ts.

/** What one script reads from the global and writes there, each sorted, and the aliases of the global it proved. */
export interface ScriptScan {
  readonly reads: readonly string[];
  readonly writes: readonly string[];
  readonly aliases: readonly string[];
}

/** The scan of several scripts: each one's, and the union of the names read and written, sorted. */
export interface FreeGlobalScan {
  readonly scripts: Readonly<Record<string, ScriptScan>>;
  readonly reads: readonly string[];
  readonly writes: readonly string[];
}

export declare const GLOBAL_NAMES: readonly string[];
export declare const MAX_FREE_GLOBALS: number;
export declare function scanScript(name: string, text: string): ScriptScan;
export declare function scanFreeGlobals(texts: Readonly<Record<string, string>>): FreeGlobalScan;
/** True when two scans of one script read the same names and write the same names; the aliases' spellings are ignored. */
export declare function sameGlobalNames(a: ScriptScan, b: ScriptScan): boolean;
export declare function freeGlobalList(scan: FreeGlobalScan, allowlist: readonly string[]): string[];
