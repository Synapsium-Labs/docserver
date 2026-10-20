// Types for scripts/visual/compare.mjs, which runs under plain Node and is imported by test/visual-compare.test.ts.

export interface Prefs {
  readonly theme: string;
  readonly width: string;
  readonly font: string;
}

export interface Block {
  readonly key: string;
  readonly box: { readonly x: number; readonly width: number; readonly height: number };
  readonly style: Readonly<Record<string, string>>;
}

export interface Difference {
  readonly block: string;
  readonly prop: string;
  readonly ours: unknown;
  readonly reference: unknown;
}

export interface ExpectedEntry {
  readonly name: string;
  readonly blocks: readonly string[];
  readonly props: readonly string[];
  readonly combos: readonly string[];
}

export interface Args {
  readonly ours: string;
  readonly reference: string;
  readonly states: readonly string[];
  readonly expected: string | undefined;
  readonly setup: string | undefined;
}

export declare const VIEWPORTS: Readonly<Record<'desktop' | 'phone', { readonly width: number; readonly height: number }>>;
export declare const STATES: Readonly<Record<'light' | 'dark' | 'sans-wide', Prefs>>;
export declare const PROPS: readonly string[];
export declare const TOLERANCE: number;
export declare const USAGE: string;
export declare function parseArgs(argv: readonly string[]): Args;
export declare function pageUrl(arg: string): string;
export declare function sameValue(prop: string, a: unknown, b: unknown): boolean;
export declare function diffBlocks(ours: readonly Block[], reference: readonly Block[]): Difference[];
export declare function parseExpected(text: string): ExpectedEntry[];
export declare function classify(
  combo: string,
  differences: readonly Difference[],
  entries: readonly ExpectedEntry[],
): { unexpected: Difference[]; expected: [string, Difference[]][]; used: Set<string> };
export declare function describeDifference(d: Difference): string;
