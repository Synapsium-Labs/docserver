// Types for scripts/gen-doc-fields.mjs, which runs under plain Node and is imported by test/frame-doc-fields.test.ts.

/** One call whose field did not resolve: its file (from the root, forward slashes), its line (1-based), and why. */
export interface DocFieldFailure {
  readonly file: string;
  readonly line: number;
  readonly reason: string;
}

export interface DocFieldScan {
  /** The resolved fields, sorted and unique; `pos` is not among them (docFieldsModule adds it). */
  readonly fields: string[];
  readonly failures: DocFieldFailure[];
}

export declare const ENHANCE_DIR: string;
export declare const DOC_FIELDS_TS: string;
export declare const MAX_WRAPPERS: number;
export declare const FIELD: RegExp;
export declare function scanDocFields(options?: { dir?: string; root?: string }): DocFieldScan;
export declare function docFieldsModule(fields: readonly string[]): string;
