// The esbuild plugin that gives a bundle of the reader one layout's feature list (docserver parity Task 9; plan Design B11).
//
// The reader's lifecycle (src/enhance/lifecycle.ts) imports `./features.js`, whose `features()` is the default layout's list.
// A layout's bundle is built from the same entry as the default, with this plugin, which resolves that one import, and only
// when it is made from the lifecycle, to the layout's own module (src/enhance/layouts/<name>/features.ts, which exports the
// same `features()`). Nothing else changes: every other import resolves as it does for the default, so a layout bundle is the
// default's, less the features its list leaves out and plus its own. The default bundle is built with no plugin at all.
//
// scripts/build-frame.mjs builds each layout's frame bundle with it, and test/browser/harness.ts bundles the reader for a
// named layout with it. The plugin fails the build when it did not substitute exactly once, so a lifecycle that no longer
// imports the list cannot give a layout the default's. Dev tooling, never shipped.
import path from 'node:path';

/** The lifecycle's own path, from the package root: the one importer whose `./features.js` is replaced. */
export const LIFECYCLE = 'src/enhance/lifecycle.ts';

/**
 * The plugin for the layout whose feature list is the module `featuresFile` (a path from the package root, or absolute).
 * `root` is the package root.
 */
export function layoutPlugin(root, featuresFile) {
  const lifecycle = path.resolve(root, LIFECYCLE);
  const target = path.resolve(root, featuresFile);
  return {
    name: 'pinax-layout-features',
    setup(build) {
      let hits = 0;
      build.onStart(() => {
        hits = 0;
      });
      build.onResolve({ filter: /^\.\/features\.js$/ }, (args) => {
        if (path.resolve(args.importer) !== lifecycle) return undefined;
        hits += 1;
        return { path: target };
      });
      build.onEnd(() => {
        if (hits !== 1) return { errors: [{ text: `layout-plugin: ${LIFECYCLE}'s import of ./features.js was replaced ${String(hits)} times, not once` }] };
        return undefined;
      });
    },
  };
}
