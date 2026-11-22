// Types for scripts/layout-plugin.mjs, which runs under plain Node and is imported by scripts/build-frame.mjs and
// test/browser/harness.ts.
import type { Plugin } from 'esbuild';

/** The lifecycle's own path, from the package root: the one importer whose `./features.js` is replaced. */
export declare const LIFECYCLE: string;
/** The plugin that replaces the lifecycle's feature list with the module `featuresFile`; `root` is the package root. */
export declare function layoutPlugin(root: string, featuresFile: string): Plugin;
