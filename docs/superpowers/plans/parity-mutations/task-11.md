# Parity Task 11: Editorial mutation rows

The local browser was Chromium. The wrapper ran one file at a time. The layout harness bundles the working sources without a sealed-frame rebuild. No inserted storage read was bundled or executed. After restoration, `assets/layouts/editorial.css` had SHA-256 `4a45a2d4b62d0c19e6f66e9e5c6bc5f0e8cd90f9917878c1e1fda538991e0a92` and `src/enhance/layouts/editorial/plans.ts` had `1f66f0b7ba83436ba1f2d1a9d087521062cb96d5b0109ca0d2218696838335e1`.

| Row | Change | Observed failure |
|---|---|---|
| Le-a | Use literal `#123456` instead of the text slot on Collapse | The hosted sweep flags inadmissible foregrounds on `surface` in both docked and open Contents. |
| Le-b | Read browser storage directly in plan marks | The identifier wall and global-use wall each flag the new read. |
| Le-c | Set a 500px minimum width at the phone breakpoint | The 412×915 row measures 88px of horizontal overflow. |
| Le-e | Use the shared plan builder with outline enabled on long plans | The 20-step fixture sees outline controls instead of having only labels. |
| Le-f | Reveal the Classic block classes in Editorial | The below-fold table is marked for reveal; only figures and callouts should be. |
| Le-g | Let diagram tools read Editorial's rule and row definitions | The node-ID fixture draws a focusable definition control, ring and dot even though Editorial has no preview. |

The earlier drawer regression ran red before Editorial registered its Contents builder (one failure, one other browser excluded). The original corpus update also measured two timeouts waiting for glossary-edge cues that Editorial does not draw; see the [scrub audit](../parity-scrub-editorial.md). These initial update failures are separate from the mutation totals.

```json
[
  {"id":"Le-a","file":"assets/layouts/editorial.css","tests":"test/browser/appearance-style.test.ts","rc":1,"failed":1,"skipped":403,"red":["editorial: Phosphor Daylight"]},
  {"id":"Le-b","file":"src/enhance/layouts/editorial/plans.ts","tests":"test/enhance-walls.test.ts","rc":1,"failed":2,"passed":14,"red":["no source file names a forbidden identifier, a selector with # or built at run time, or a style string","no source file names a DOM-library global beyond the language's own objects"]},
  {"id":"Le-c","file":"assets/layouts/editorial.css","tests":"test/browser/layout-editorial.test.ts","rc":1,"failed":1,"skipped":17,"red":["412×915: contents is reachable without horizontal overflow"]},
  {"id":"Le-e","file":"src/enhance/layouts/editorial/features.ts","tests":"test/browser/layout-editorial.test.ts","rc":1,"failed":1,"skipped":15,"red":["labels long plans without outline controls or state"]},
  {"id":"Le-f","file":"src/enhance/layouts/editorial/features.ts","tests":"test/browser/layout-editorial.test.ts","rc":1,"failed":1,"skipped":17,"red":["reveals below-fold callouts without hiding tables"]},
  {"id":"Le-g","file":"src/enhance/layouts/editorial/features.ts","tests":"test/browser/layout-corpus.test.ts","rc":1,"failed":1,"skipped":336,"red":["layout editorial > chromium > diagram-tools/node-id"]}
]
```
