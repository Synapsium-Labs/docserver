// Types for scripts/public-shapes.mjs, which runs under plain Node and is imported by scripts/history-scan.mjs,
// test/public-ready.test.ts and test/history-scan.test.ts.

/** One shape of private detail: a global regex and, where a match needs a second look, a predicate on it. */
export interface Shape {
  readonly name: string;
  readonly re: RegExp;
  readonly keep?: (m: RegExpMatchArray) => boolean;
}

/** One match: its line (from 1), its shape's name and the matched text. */
export interface ShapeMatch {
  readonly line: number;
  readonly shape: string;
  readonly match: string;
}

export declare const SHAPES: readonly Shape[];
export declare const LISTED_NAME: string;
export declare function namesShape(names: readonly string[]): Shape;
export declare function parseNames(text: string): string[];
export declare function findShapes(text: string, shapes?: readonly Shape[]): ShapeMatch[];
