# Parity Task 10: classic mutation rows

Chromium was the only local browser. The test wrapper ran one file at a time. Layout harness rows bundle the source and serve the layout stylesheet directly, so they did not need a sealed-frame rebuild. Static walls scanned the source without executing the inserted read. All in-place edits were restored exactly. The pre-review SHA-256 values after restoration were `ce517f67bfd3390063656fbb31b99aabb52245a9b1719f89ea77c1c0c2c29024` for `assets/layouts/classic.css`, `10120383aa1396e17282c4b272f2bacf018da834d2f40e0ee0c5a82c57e97a96` for `src/enhance/layouts/classic/contents.ts`, `e2d130e5a4aef96ce7a5d3ab12214641deb98dd137d670c8bc98d93c99f26c7a` for `src/enhance/layouts/classic/features.ts`, and `91ff62d3e28868bcd0fcda16cc8e5360031030a0e144afbc7b4356892bb5dd16` for the appearance harness in Lc-g.

| Row | Change | Evidence |
|---|---|---|
| Lc-a | Collapse button uses literal `#123456` instead of `var(--text)` | Phosphor Daylight reports two offending paths, one in the docked rail and one in the drawer: the computed foreground is not admitted on `surface`. |
| Lc-b | Read the ambient browser storage from the classic contents builder | The source walls report the identifier and its global read. An earlier trial using the document's window reached the identifier check too, but also tripped the `defaultView` rule. |
| Lc-c | Give the classic root `min-width: 500px` in its phone media query | The 412×915 row reports 88 px of horizontal overflow rather than zero. |
| Lc-d | Add 81,826 characters to classic's enhance entry in an in-memory copy of the committed manifest | The production size judge accepts the control and rejects the edited state for classic's 225,710 characters against the 225,709 cap. Each state's in-memory growth row is recalculated independently, so a stale growth row cannot account for the rejection. No bundle or manifest was edited. |
| Lc-e | Remove the classic scope from the phone media rule for `.chips` | The stylesheet check descends into the responsive rule and refuses the unscoped selector. |
| Lc-f | Give classic's independent editorial builder the shared feature name `editorial` | The shared-feature identity check refuses the different build function. |
| Lc-g | Leave the layout argument out of the hosted harness call | The selected fixture reports the default marker on all eight classic test documents. |
| Lc-h | Leave the classic root marker out of the box builder | The selected fixture cannot find the shared reader root in any classic test document. |
| Lc-i | Before the classic H3 spy, rely on the shared H2-only section event | The subsection regression reports no active link for the H3 in view. |
| Lc-j | Keep H3 activation but remove rail follow | The rail regression fails because the active link remains beyond the visible rail. |
| Lc-k | In a synthetic responsive rule, keep the first selector scoped and remove the scope from the second selector | The original prefix check accepts both selectors as a unit. The new guard accepts the control and rejects the unscoped second selector. The regression fails with the old check (1 failed, 11 passed); the restored per-selector check passed all 12 at that point. No shipped CSS changed for this probe. |
| Lc-l | Ignore the retained accessible heading labels when building links | Two distinct numbered chips become `Repeat` and `Repeat`. The restored link builder retains both labels in the chips, drawer and docked rail. |
| Lc-m | Make the scoped open-drawer skin and touch rules stop matching | The open drawer gets the docked title styles under the host skin, and the coarse-pointer link drops to 28.22px. Both rows pass with the stylesheet restored. |

The review-round label and stylesheet probes were restored to `0ee767284168a1586365b36a55ac9f6d40c6c4b9be9076fa2a2be814a8148f53` (`contents.ts`) and `67dae53095f20244422d56f4ad4bc6dc0b8111b528f8f350c7928601d8387132` (`classic.css`). The drawer keyboard-wrap test also failed in the review fix before the Tab handler was added, then passed with the handler; this red-first check is not counted as a separate mutation run.

The `red` fields for Lc-i and Lc-j contain the assertion messages from the subsection-spy test, not its test title.

The first four classic figure-corpus rows also went red before the test recognized that classic has no definition index. They now require an actual drawing and a wired Full screen button, then assert that definition cues are absent. The default cases still require the cues. See the [scrub audit](../parity-scrub-classic.md) for both failed generator runs and the later clean read-back.

```json
[
  {"id":"Lc-a","file":"assets/layouts/classic.css","tests":"test/browser/appearance-style.test.ts","rc":1,"failed":1,"passed":0,"skipped":379,"red":["classic: Phosphor Daylight"]},
  {"id":"Lc-b-first","file":"src/enhance/layouts/classic/contents.ts","tests":"test/enhance-walls.test.ts","rc":1,"failed":1,"passed":15,"red":["no source file names a forbidden identifier, a selector with # or built at run time, or a style string"]},
  {"id":"Lc-b","file":"src/enhance/layouts/classic/contents.ts","tests":"test/enhance-walls.test.ts","rc":1,"failed":2,"passed":14,"red":["no source file names a forbidden identifier, a selector with # or built at run time, or a style string","no source file names a DOM-library global beyond the language's own objects"]},
  {"id":"Lc-c","file":"assets/layouts/classic.css","tests":"test/browser/layout-classic.test.ts","rc":1,"failed":1,"passed":0,"skipped":19,"red":["412×915: contents is reachable without horizontal page scroll"]},
  {"id":"Lc-d","file":"in-memory committed manifest","tests":"test/size-rules.ts judge","rc":1,"red":["layouts: classic is 225710 characters, over the default enhance bundle's 225709"]},
  {"id":"Lc-e","file":"assets/layouts/classic.css","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":10,"red":["classic: every rule is scoped under the root's two marks, with no literal colour, no font and no url"]},
  {"id":"Lc-f","file":"src/enhance/layouts/classic/features.ts","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":10,"red":["reuse shared features by identity and give layout-specific features distinct names"]},
  {"id":"Lc-g","file":"test/browser/appearance-style.test.ts","tests":"test/browser/appearance-style.test.ts","rc":1,"failed":1,"passed":0,"skipped":379,"red":["classic: Phosphor Daylight"]},
  {"id":"Lc-h","file":"src/enhance/layouts/classic/editorial.ts","tests":"test/browser/appearance-style.test.ts","rc":1,"failed":1,"passed":0,"skipped":379,"red":["classic: Phosphor Daylight"]},
  {"id":"Lc-i","file":"src/enhance/layouts/classic/contents.ts","tests":"test/browser/layout-classic.test.ts","rc":1,"failed":1,"passed":9,"skipped":10,"red":["the contents spy does not activate the subsection"]},
  {"id":"Lc-j","file":"src/enhance/layouts/classic/contents.ts","tests":"test/browser/layout-classic.test.ts","rc":1,"failed":1,"passed":9,"skipped":10,"red":["the contents rail does not follow the active link"]},
  {"id":"Lc-k","file":"synthetic responsive rule","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":11,"red":["refuses a later unscoped selector in a comma-separated rule inside a media query"]},
  {"id":"Lc-l","file":"src/enhance/layouts/classic/contents.ts","tests":"test/browser/layout-classic.test.ts","rc":1,"failed":1,"skipped":35,"red":["preserves numbered accessible names in contents and chips"]},
  {"id":"Lc-m","file":"assets/layouts/classic.css","tests":"test/browser/layout-classic.test.ts","rc":1,"failed":2,"skipped":34,"red":["applies hosted type and row slots to the drawer but not the docked rail","keeps coarse-pointer drawer controls at least 44px without skin slots"]}
]
```
