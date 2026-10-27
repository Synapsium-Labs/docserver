// Types for scripts/comment-tokens.mjs, which runs under plain Node and is imported by scripts/build-frame.mjs and
// test/frame-build.test.ts.

export declare const HTML_COMMENT_TOKENS: readonly string[];
export declare function literalRanges(text: string): [number, number][];
export declare function commentTokenHazards(text: string): string[];
export declare function commentTokenCount(text: string): number;
