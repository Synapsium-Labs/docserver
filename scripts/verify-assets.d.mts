// Types for scripts/verify-assets.mjs, which runs under plain Node (npm's prepack) and is imported by
// test/frame-build.test.ts.

/** Every reason the package's assets/ does not match assets/assets.json; empty when it does. */
export declare function verifyAssets(root?: string): string[];
