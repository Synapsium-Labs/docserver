// The one feature every non-default layout builds first (docserver parity Task 9): it marks the root with
// `data-docreader-layout="<name>"`, through the journal, so teardown takes the mark off again. The layout's own stylesheet
// scopes every rule under `[data-docreader-root][data-docreader-layout="<name>"]`, so it styles nothing until this runs.
// The default layout never builds it: its root has no layout mark and `frame/reader.css` alone styles it.
//
// Import-inert: declarations only.
import type { Feature } from '../features.js';
import type { FeatureContext } from '../types.js';

/** The marking feature of the layout `layout`. */
export function markFeature(layout: string): Feature {
  return Object.freeze({
    name: 'layout-mark',
    build: (ctx: FeatureContext): void => {
      ctx.journal.setAttribute(ctx.root, 'data-docreader-layout', layout);
    },
  });
}
