// Types for scripts/old-cap-gate.mjs, which runs under plain Node in CI and is imported by test/old-cap-gate.test.ts.

/** The measured row's title, as test/browser/frame-appearance.test.ts spells it. */
export declare const ROW_TITLE: string;
/** The browsers the gate runs. */
export declare const BROWSERS: readonly string[];
/** The reason a parsed vitest JSON report does not show the row passing under `browser`, or null when it does. */
export declare function judgeReport(report: unknown, browser: string): string | null;
/** The reason the report file does not show the row passing under `browser`, or null when it does. */
export declare function judgeFile(file: string, browser: string): string | null;
/** The command line after the script: the report path, then the browser. Answers the exit code. */
export declare function main(args: readonly string[]): number;
