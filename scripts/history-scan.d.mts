// Types for scripts/history-scan.mjs, which runs under plain Node: the history scan Task 15 runs before the
// repository goes public. test/history-scan.test.ts runs its command line.
import type { Shape } from './public-shapes.mjs';

/** One hit: where it is (never the matched text) and its shape class. */
export interface Hit {
  readonly where: string;
  readonly shape: string;
}

/** What a gh call printed, as JSON values (one per page with --paginate). */
export type Gh = (args: readonly string[]) => unknown[];

export declare const USAGE: string;
export declare function fetchRefspecs(remote: string): string[];
export declare const OTHER_REFS: string;
export declare function otherRefspecs(lsRemote: string): string[];
export declare function scanHistory(options: { cwd: string; remote?: string; shapes: readonly Shape[]; fetch?: boolean }): Promise<{ hits: Hit[]; counts: Record<string, number> }>;
export declare function parseJsonStream(text: string): unknown[];
export declare function ghCli(cwd: string): Gh;
export declare function scanGithub(options: { repo: string; gh: Gh; shapes: readonly Shape[] }): Promise<{ hits: Hit[]; counts: Record<string, number> }>;
export declare function githubRepoOf(url: string): string | null;
export declare function parseArgs(argv: readonly string[]): { all: boolean; github: boolean; repo: string | null; remote: string; namesFile: string } | null;
