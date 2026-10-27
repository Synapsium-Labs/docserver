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
export declare function freeGlobalList(scan: FreeGlobalScan, allowlist: readonly string[]): string[];
