// The harness bundles the reader for a named layout (docserver parity Task 9; test/browser/harness.ts, `layout` in OpenHow): the
// same page script, built with the plugin the frame build uses, so a layout's feature list runs in a real browser; the layout's own
// stylesheet is served beside reader.css. This file proves the infrastructure the four layout tasks build on; the corpus per layout
// is test/browser/layout-corpus.test.ts's, once a layout has a snapshot directory.
import { afterAll, expect, it } from 'vitest';
import { LAYOUT_TABLE } from '../../scripts/build-frame.mjs';
import { closeBrowsers, describeBrowsers, openDoc } from './harness.js';
import { holdClean } from './layout-cases.js';

afterAll(closeBrowsers);

const DOC = '# A title\n\nSome words.\n\n## First\n\nText with `code`.\n';

describeBrowsers((browser) => {
  it('the default layout\'s root is marked data-docreader-root and never data-docreader-layout, and no layout stylesheet is served', async () => {
    const doc = await openDoc(DOC, {}, { browser });
    try {
      const marks = await doc.page.evaluate(() => {
        const root = document.querySelector('[data-docreader-root]');
        return { root: root !== null, layout: root?.getAttribute('data-docreader-layout') ?? null, sheets: document.querySelectorAll('link[href="/assets/layout.css"]').length };
      });
      expect(marks).toEqual({ root: true, layout: null, sheets: 0 });
      expect(doc.served).not.toContain('/assets/layout.css');
      holdClean('default', { violations: await doc.violations(), aborted: doc.aborted, missing: doc.missing });
    } finally {
      await doc.close();
    }
  });

  for (const layout of ['classic', 'editorial', 'review'] as const) {
    it(`${layout}: the page runs that layout's bundle (its mark is on the root), serves its stylesheet, applies its rule, and is clean under the strict policy`, async () => {
      expect(LAYOUT_TABLE[layout].source).toBe(`assets/layouts/${layout}.css`);
      const doc = await openDoc(DOC, {}, { browser, layout });
      try {
        const got = await doc.page.evaluate(() => {
          const root = document.querySelector('[data-docreader-root]');
          return {
            layout: root?.getAttribute('data-docreader-layout') ?? null,
            // The layout's one provisional rule is scoped under its mark, so it applies only once the mark is there.
            property: root === null ? '' : getComputedStyle(root).getPropertyValue('--docreader-layout').trim(),
          };
        });
        expect(got).toEqual({ layout, property: layout });
        expect(doc.served).toContain('/assets/layout.css');
        holdClean(layout, { violations: await doc.violations(), aborted: doc.aborted, missing: doc.missing });
      } finally {
        await doc.close();
      }
    });
  }
});
