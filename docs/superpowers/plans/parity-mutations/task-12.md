# Parity Task 12: review layout mutation rows

The review layout adds no state of its own (no document field, no store key, no pref; its read marks, Index fold and tab are the shared modules' existing fields), so the per-layout-state row of the design's section 6 reads true for it (condition 3 of ccrc D-8881).

Every row was measured in place, one at a time, on the review layout's sources as committed at `deb8d3c` (the stylesheet unchanged since `ccff02f`), through the test wrapper, one test file per call, with Chromium selected for browser files. For each file edit the file's bytes were saved first, the edit applied, the test run, and the saved bytes copied back and their SHA-256 checked equal to the one recorded before the edit; no `git checkout` was used. The unmodified files pass every row's test file. The browser rows read the working stylesheet and bundle sources through the layout harness, so no frame rebuild was needed. Lr-d is a pure judge row: a scratch script (outside the tree) pads the review bundle's manifest characters in memory and runs `judge` from `test/size-rules.ts`, as Le-d did; no runtime asset is padded.

Counts: this first table has 30 rows and its JSON fence 31 entries (Lr-d2 is the re-measurement of Lr-d, which has no table row of its own); the fix round's table and fence have 21 each; fix round 2's have 16 each; fix round 3's have 13 each; fix round 4's have 3 each.

| Row | Guard | Mutation | Measured result |
|---|---|---|---|
| Lr-a | No literal colour in the stylesheet; text sits on a closed ground | `.rv-n { color: #123456 }` in `assets/layouts/review.css` | Red: the hosted review rows 12 failed of the 12 selected ("text on a ground that is not closed", `b.rv-n` on the card's surface, every fixture); the unit scan 1 failed, 19 passed |
| Lr-b | No direct browser storage in a layout's sources | `localStorage.getItem(...)` in `header.ts` | Red: `enhance-walls` 2 failed, 14 passed (the identifier wall and the DOM-global wall) |
| Lr-c | No horizontal scroll at 412 px | `min-width: 500px` on the card in the phone rule | Red: `layout-review` 1 failed (the 412x915 row), 12 passed |
| Lr-d | The layout's assets are at most the default enhance bundle (test 8's layout row) | Pad the review bundle's manifest characters by 12,895 in memory | Red: control has no violation (212,815 against 225,709); mutant 225,710 reds "layouts: review is 225710 characters, over the default enhance bundle's 225709" |
| Lr-e | The hosted control row applies under a fine pointer only | `@media (pointer: fine)` of the card button's rule becomes `@media all` | Red: `appearance-cues` 1 failed, 45 passed (the review controlRow row); `layout-review` 1 failed, 12 passed (touch measures 56, not 44) |
| Lr-f | `frameCsp('review')` carries only its own bundle's hash | Add `enhanceClassic`'s hash to the review policy | Red: `frame-layouts` 1 failed, `frame-boundaries` 3 failed, `frame-csp` 1 failed |
| Lr-g | `checkFrameCsp` knows review's hash | Drop `enhanceReview.csp` from the known list | Red: `frame-csp` 3 failed, `frame-layouts` 7 failed; `frame-boundaries` stays green (22), as it reads emitted policies |
| Lr-h | The newest policy entry names every shipped layout | Drop `review` from the newest entry of `conformance/frame-boundaries.json` | Red: `frame-boundaries` 4 failed, 18 passed |
| Lr-i | An appended entry has its delta row | Drop entry 4's delta row | Red: `frame-boundaries` 1 failed, 21 passed |
| Lr-j | `review` is a layout the library and `./host` accept | Drop `review` from `FRAME_LAYOUTS` | Red: `host-mount` 1 failed, 209 passed; `frame-layouts` 4 failed, 43 passed |
| Lr-k | The package ships the compiled review modules | Remove the review modules from the pack test's allowlist | Red: `pack` 1 failed, 14 passed (the packed files are no longer all allowed) |
| Lr-l | A review snapshot is pinned | Flip one `aria-selected` in `conformance/layouts/review/rail/marks-index.dom.txt` | Red: the review corpus 1 failed, 53 passed (`rail/marks-index`) |
| Lr-m | Review's modules import only siblings and `src/enhance` | `import '../../../frame/seed.js'` in `context.ts` | Red: `enhance-walls` 1 failed, 15 passed |
| Lr-n | No private-detail shape or URL in its sources or stylesheet | An absolute home path in a comment of `header.ts` | Red: `enhance-layouts` 1 failed, 20 passed (the scrub row) |
| Lr-o | The card is built for a document only | Drop `ctx.info.isDocument ?` from `header.ts` | Red: `enhance-layouts` 1 failed, 19 passed (a titled page with no sections gets a card) |
| Lr-p | Hidden source nodes between the title and the byline stay in the card's run | Drop `hasAttribute('hidden') ||` | Red: `layout-review` 1 failed, 12 passed (the byline is left outside the card) |
| Lr-q | The eyebrow is part of the card | Drop the eyebrow from the run's start | Red: `layout-review` 1 failed, 12 passed (front-matter row) |
| Lr-r1 | The byline is moved into the card | Drop `dl.byline` from the run's parts | Red: `layout-review` 2 failed, 11 passed |
| Lr-r2 | The review strip is moved into the card | Drop `section.review-strip` from the run's parts | Red: `layout-review` 2 failed, 11 passed |
| Lr-r3 | The facts panel is moved into the card | Drop `details.doc-facts` from the run's parts | Red: `layout-review` 1 failed, 12 passed (front-matter row) |
| Lr-s1 | The toggle needs the bar (superseded, re-measured, kept: Lr2-s1 on the final line) | Drop `slots === null ||` from `context.ts` | Red: `enhance-layouts` 1 failed, 19 passed (a document with no bar) |
| Lr-s2 | The toggle is for a document only (superseded: with the read-mark check restored the check was unreachable and was removed; Lr2-s2 measured it green first) | Drop `!ctx.info.isDocument` from `context.ts` | Was red before the read-mark check came back; green after it (27 passed), so the check is gone |
| Lr-s3 | A click presses the unit's own mark control (superseded, re-measured, kept: the click line lost its null branch; Lr2-s3) | Drop the click listener | Red: `layout-review` 1 failed, 12 passed |
| Lr-s4 | The toggle follows the marks | Drop the `marks` listener | Red: `layout-review` 1 failed, 12 passed |
| Lr-s5 | The toggle follows the scroll spy | Drop the `spy` listener | Red: `layout-review` 1 failed, 12 passed |
| Lr-t1 | The card button keeps the 44 px touch floor | Drop `.rv-next` from the coarse-pointer rule | Red: `layout-review` 1 failed, 12 passed |
| Lr-t2 | The bar toggle keeps the touch floor | Drop `.bar-tools .rv-mark` from the coarse-pointer rule | Red: `layout-review` 1 failed, 12 passed |
| Lr-t3 | The drawer's Contents links keep the touch floor | Drop `.toc-contents a` from the drawer's coarse-pointer rule | Red: `layout-review` 1 failed, 12 passed |
| Lr-t4 | The drawer's Index rows keep the touch floor | Drop `.toc-index a.ix` from the drawer's coarse-pointer rule | Red: `layout-review` 1 failed, 12 passed (an Index row measures 24.9 px) |
| Lr-t5 | The drawer's tabs keep the touch floor | Drop `.toc-tabs button` from the drawer's coarse-pointer rule | Red: `layout-review` 1 failed, 12 passed (a tab measures 24.8 px) |

Guards that deb8d3c removed as unreachable were wrong for the card's and the toggle's early returns: a document whose "In short" box takes every sub-heading has no marks, so a document can reach them. Both are back (the fix round below), with rows on that input.

```json
[
  {"id":"Lr-a","file":"assets/layouts/review.css","savedSha256":"6869803e47eb26da03f8c668c39b3bb01ab755401789a5b4549c51e4a0804eb2","restoredSha256":"6869803e47eb26da03f8c668c39b3bb01ab755401789a5b4549c51e4a0804eb2","runs":[{"tests":"test/browser/appearance-style.test.ts -t \"review: \"","rc":1,"failed":12,"skipped":416},{"tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":19}]},
  {"id":"Lr-b","file":"src/enhance/layouts/review/header.ts","savedSha256":"9292e4d4a818981725985d599a1e7917c5b9acac446fef56bccad832e271dcd2","restoredSha256":"9292e4d4a818981725985d599a1e7917c5b9acac446fef56bccad832e271dcd2","tests":"test/enhance-walls.test.ts","rc":1,"failed":2,"passed":14},
  {"id":"Lr-c","file":"assets/layouts/review.css","savedSha256":"6869803e47eb26da03f8c668c39b3bb01ab755401789a5b4549c51e4a0804eb2","restoredSha256":"6869803e47eb26da03f8c668c39b3bb01ab755401789a5b4549c51e4a0804eb2","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":12,"skipped":13,"red":["412x915: the contents are reachable, the card shows, and nothing scrolls sideways"]},
  {"id":"Lr-d","file":"src/frame/manifest.generated.ts","tests":"test/size-rules.ts (pure judge, scratch script)","rc":0,"control":{"review":212815,"defaults":225709,"violations":[]},"paddingChars":12895,"mutantChars":225710,"capChars":225709,"red":["layouts: review is 225710 characters, over the default enhance bundle's 225709"]},
  {"id":"Lr-d2","file":"src/frame/manifest.generated.ts","tests":"test/size-rules.ts (pure judge, scratch script)","rc":0,"supersedes":"Lr-d","control":{"review":195631,"defaults":225709,"violations":[]},"paddingChars":30079,"mutantChars":225710,"capChars":225709,"red":["layouts: review is 225710 characters, over the default enhance bundle's 225709"]},
  {"id":"Lr-e","file":"assets/layouts/review.css","savedSha256":"6869803e47eb26da03f8c668c39b3bb01ab755401789a5b4549c51e4a0804eb2","restoredSha256":"6869803e47eb26da03f8c668c39b3bb01ab755401789a5b4549c51e4a0804eb2","runs":[{"tests":"test/browser/appearance-cues.test.ts","rc":1,"failed":1,"passed":45,"skipped":46},{"tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":12,"skipped":13}]},
  {"id":"Lr-f","file":"src/frame/csp.ts","savedSha256":"9a4344fe86a6c65cc69934768b0525a87c9873d7be39c088a374e96507c31ded","restoredSha256":"9a4344fe86a6c65cc69934768b0525a87c9873d7be39c088a374e96507c31ded","runs":[{"tests":"test/frame-layouts.test.ts","rc":1,"failed":1,"passed":52},{"tests":"test/frame-boundaries.test.ts","rc":1,"failed":3,"passed":19},{"tests":"test/frame-csp.test.ts","rc":1,"failed":1,"passed":153}]},
  {"id":"Lr-g","file":"src/frame/csp.ts","savedSha256":"9a4344fe86a6c65cc69934768b0525a87c9873d7be39c088a374e96507c31ded","restoredSha256":"9a4344fe86a6c65cc69934768b0525a87c9873d7be39c088a374e96507c31ded","runs":[{"tests":"test/frame-csp.test.ts","rc":1,"failed":3,"passed":151},{"tests":"test/frame-layouts.test.ts","rc":1,"failed":7,"passed":46},{"tests":"test/frame-boundaries.test.ts","rc":0,"passed":22}]},
  {"id":"Lr-h","file":"conformance/frame-boundaries.json","savedSha256":"b555973c96f52600cc8ac8d7e8850f3f6d73716a48c9732155215645e897ff75","restoredSha256":"b555973c96f52600cc8ac8d7e8850f3f6d73716a48c9732155215645e897ff75","tests":"test/frame-boundaries.test.ts","rc":1,"failed":4,"passed":18},
  {"id":"Lr-i","file":"test/frame-boundaries.test.ts","savedSha256":"e3f692ac0b903ec5f575213056b9e772112b2e607eabdacae431e8707fccea7d","restoredSha256":"e3f692ac0b903ec5f575213056b9e772112b2e607eabdacae431e8707fccea7d","tests":"test/frame-boundaries.test.ts","rc":1,"failed":1,"passed":21},
  {"id":"Lr-j","file":"src/frame/layouts.ts","savedSha256":"d8e1c3a23c439de1c3eb379fa07b780674ee80ff4fb59d762890eb675d80260e","restoredSha256":"d8e1c3a23c439de1c3eb379fa07b780674ee80ff4fb59d762890eb675d80260e","runs":[{"tests":"test/host-mount.test.ts","rc":1,"failed":1,"passed":209},{"tests":"test/frame-layouts.test.ts","rc":1,"failed":4,"passed":43}]},
  {"id":"Lr-k","file":"test/pack.test.ts","savedSha256":"27490b3d1bb9b8619995143a3f09a93150f0a30042229731b390c9524886b20d","restoredSha256":"27490b3d1bb9b8619995143a3f09a93150f0a30042229731b390c9524886b20d","tests":"test/pack.test.ts","rc":1,"failed":1,"passed":14},
  {"id":"Lr-l","file":"conformance/layouts/review/rail/marks-index.dom.txt","savedSha256":"f1cfd1fe3e0be65f57cc6ea59ba039b369ccc0549e5ae1c769cae91a5ddf5bf0","restoredSha256":"f1cfd1fe3e0be65f57cc6ea59ba039b369ccc0549e5ae1c769cae91a5ddf5bf0","tests":"test/browser/layout-corpus.test.ts -t \"layout review\"","rc":1,"failed":1,"passed":53,"skipped":391,"red":["layout review > chromium > rail/marks-index"]},
  {"id":"Lr-m","file":"src/enhance/layouts/review/context.ts","savedSha256":"1877d4b105de834cd660c83e7debc3b979dc2fe15f4dad673fb51aba4fa2c7cb","restoredSha256":"1877d4b105de834cd660c83e7debc3b979dc2fe15f4dad673fb51aba4fa2c7cb","tests":"test/enhance-walls.test.ts","rc":1,"failed":1,"passed":15},
  {"id":"Lr-n","file":"src/enhance/layouts/review/header.ts","savedSha256":"9292e4d4a818981725985d599a1e7917c5b9acac446fef56bccad832e271dcd2","restoredSha256":"9292e4d4a818981725985d599a1e7917c5b9acac446fef56bccad832e271dcd2","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":20},
  {"id":"Lr-o","file":"src/enhance/layouts/review/header.ts","savedSha256":"9292e4d4a818981725985d599a1e7917c5b9acac446fef56bccad832e271dcd2","restoredSha256":"9292e4d4a818981725985d599a1e7917c5b9acac446fef56bccad832e271dcd2","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":19},
  {"id":"Lr-p","file":"src/enhance/layouts/review/header.ts","savedSha256":"9292e4d4a818981725985d599a1e7917c5b9acac446fef56bccad832e271dcd2","restoredSha256":"9292e4d4a818981725985d599a1e7917c5b9acac446fef56bccad832e271dcd2","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":12,"skipped":13},
  {"id":"Lr-q","file":"src/enhance/layouts/review/header.ts","savedSha256":"9292e4d4a818981725985d599a1e7917c5b9acac446fef56bccad832e271dcd2","restoredSha256":"9292e4d4a818981725985d599a1e7917c5b9acac446fef56bccad832e271dcd2","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":12,"skipped":13},
  {"id":"Lr-r1","file":"src/enhance/layouts/review/header.ts","savedSha256":"9292e4d4a818981725985d599a1e7917c5b9acac446fef56bccad832e271dcd2","restoredSha256":"9292e4d4a818981725985d599a1e7917c5b9acac446fef56bccad832e271dcd2","tests":"test/browser/layout-review.test.ts","rc":1,"failed":2,"passed":11,"skipped":13},
  {"id":"Lr-r2","file":"src/enhance/layouts/review/header.ts","savedSha256":"9292e4d4a818981725985d599a1e7917c5b9acac446fef56bccad832e271dcd2","restoredSha256":"9292e4d4a818981725985d599a1e7917c5b9acac446fef56bccad832e271dcd2","tests":"test/browser/layout-review.test.ts","rc":1,"failed":2,"passed":11,"skipped":13},
  {"id":"Lr-r3","file":"src/enhance/layouts/review/header.ts","savedSha256":"9292e4d4a818981725985d599a1e7917c5b9acac446fef56bccad832e271dcd2","restoredSha256":"9292e4d4a818981725985d599a1e7917c5b9acac446fef56bccad832e271dcd2","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":12,"skipped":13},
  {"id":"Lr-s1","file":"src/enhance/layouts/review/context.ts","savedSha256":"1877d4b105de834cd660c83e7debc3b979dc2fe15f4dad673fb51aba4fa2c7cb","restoredSha256":"1877d4b105de834cd660c83e7debc3b979dc2fe15f4dad673fb51aba4fa2c7cb","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":19},
  {"id":"Lr-s2","file":"src/enhance/layouts/review/context.ts","savedSha256":"1877d4b105de834cd660c83e7debc3b979dc2fe15f4dad673fb51aba4fa2c7cb","restoredSha256":"1877d4b105de834cd660c83e7debc3b979dc2fe15f4dad673fb51aba4fa2c7cb","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":19,"note":"red at this measurement; superseded by Lr2-s2, green once the read-mark check returned"},
  {"id":"Lr-s3","file":"src/enhance/layouts/review/context.ts","savedSha256":"1877d4b105de834cd660c83e7debc3b979dc2fe15f4dad673fb51aba4fa2c7cb","restoredSha256":"1877d4b105de834cd660c83e7debc3b979dc2fe15f4dad673fb51aba4fa2c7cb","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":12,"skipped":13},
  {"id":"Lr-s4","file":"src/enhance/layouts/review/context.ts","savedSha256":"1877d4b105de834cd660c83e7debc3b979dc2fe15f4dad673fb51aba4fa2c7cb","restoredSha256":"1877d4b105de834cd660c83e7debc3b979dc2fe15f4dad673fb51aba4fa2c7cb","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":12,"skipped":13},
  {"id":"Lr-s5","file":"src/enhance/layouts/review/context.ts","savedSha256":"1877d4b105de834cd660c83e7debc3b979dc2fe15f4dad673fb51aba4fa2c7cb","restoredSha256":"1877d4b105de834cd660c83e7debc3b979dc2fe15f4dad673fb51aba4fa2c7cb","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":12,"skipped":13},
  {"id":"Lr-t1","file":"assets/layouts/review.css","savedSha256":"6869803e47eb26da03f8c668c39b3bb01ab755401789a5b4549c51e4a0804eb2","restoredSha256":"6869803e47eb26da03f8c668c39b3bb01ab755401789a5b4549c51e4a0804eb2","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":12,"skipped":13},
  {"id":"Lr-t2","file":"assets/layouts/review.css","savedSha256":"6869803e47eb26da03f8c668c39b3bb01ab755401789a5b4549c51e4a0804eb2","restoredSha256":"6869803e47eb26da03f8c668c39b3bb01ab755401789a5b4549c51e4a0804eb2","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":12,"skipped":13},
  {"id":"Lr-t3","file":"assets/layouts/review.css","savedSha256":"6869803e47eb26da03f8c668c39b3bb01ab755401789a5b4549c51e4a0804eb2","restoredSha256":"6869803e47eb26da03f8c668c39b3bb01ab755401789a5b4549c51e4a0804eb2","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":12,"skipped":13},
  {"id":"Lr-t4","file":"assets/layouts/review.css","savedSha256":"6869803e47eb26da03f8c668c39b3bb01ab755401789a5b4549c51e4a0804eb2","restoredSha256":"6869803e47eb26da03f8c668c39b3bb01ab755401789a5b4549c51e4a0804eb2","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":12,"skipped":13},
  {"id":"Lr-t5","file":"assets/layouts/review.css","savedSha256":"6869803e47eb26da03f8c668c39b3bb01ab755401789a5b4549c51e4a0804eb2","restoredSha256":"6869803e47eb26da03f8c668c39b3bb01ab755401789a5b4549c51e4a0804eb2","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":12,"skipped":13}
]
```

## Review fix round: direction B, and the guards the review asked for

`18264c6` changed `header.ts` after the Lr2 header rows were measured: a type cast on the title's focus call, the bundle byte-identical, so those rows' saved hashes name the file as measured, not as committed. Measured in the same way on the fix round's sources (each row's JSON records the file's saved and restored SHA-256). Rows of the first table not listed here keep their original measurement, taken at `deb8d3c`: their guards are unchanged by the fix round, though the stylesheet and `header.ts` bytes moved elsewhere in the file, which is stated rather than re-run. Lr-d is superseded, re-measured, kept: the review layout was then 195,631 characters (190,199 and 5,432) against 225,709; padding 30,079 gives 225,710 and the judge rejects it, the control has no violation (JSON entry Lr-d2).

| Row | Guard | Mutation | Measured result |
|---|---|---|---|
| Lr2-f | The list holds direction B's features and none the default has that B lacks | Add a `settings` feature to the list | Red: `enhance-layouts` 12 failed, 15 passed (the exclusion row among them) |
| Lr2-n1 | `n` is bound to the next unread section and listed | Remove the binding | Red: `enhance-layouts` 1 failed, 26 passed |
| Lr2-n2 | `n` applies only when a section is unread | Drop `when` | Red: `enhance-layouts` 1 failed, 26 passed |
| Lr2-i4h | The card builds no progress for a document with no marks | Drop the early return in `header.ts` | Red: `enhance-layouts` 1 failed, 26 passed (the In-short-takes-all input) |
| Lr2-i4c | The toggle needs read marks | Drop the read-mark check in `context.ts` | Red: `enhance-layouts` 1 failed, 26 passed |
| Lr2-i4r | The rail's read count needs read marks | Drop the early return in `rail.ts` | Red: `enhance-layouts` 1 failed, 26 passed |
| Lr2-s1 | The toggle needs the bar | Drop `slots === null` | Red: `enhance-layouts` 1 failed, 26 passed |
| Lr2-s2 | Unreachable check | Drop `!ctx.info.isDocument` from `context.ts` | Green (27 passed): the check was unreachable and was removed |
| Lr2-s3 | A click presses the unit's own control | Drop the click listener | Red: `layout-review` 1 failed, 15 passed |
| Lr2-m1 | The skip link lands on the card's title | Drop the skip listener | Red: `layout-review` 1 failed, 15 passed |
| Lr2-m2 | The toggle goes through the bar's tool method | `journal.insert` into the tray instead | Red: `enhance-layouts` 1 failed, 26 passed (a bar holding only the toggle keeps `role="none"`) |
| Lr2-m4a | A source node classed eyebrow stays out of the card | Drop the chrome check | Red: `enhance-layouts` 1 failed, 26 passed |
| Lr2-m4b | The card's changed text is hidden when empty | Replace `.rv-changed:empty { display: none }` | Red: `layout-review` 1 failed, 15 passed |
| Lr2-w1 | The Contents tab leads with the waiting link | Drop the link's insertion | Red: `enhance-layouts` 1 failed, 26 passed |
| Lr2-w2 | The rail addition needs a rail | Drop the `rail === null` return | Red: `enhance-layouts` 2 failed, 25 passed (a page with no rail) |
| Lr2-h | An ID link takes a hover tint | Drop the tint | Red: `layout-review` 1 failed, 15 passed |
| Lr2-i1 | An ID link keeps the hosted dashed underline on hover (I1) | `text-decoration: none` on the hovered link | Red: `appearance-cues` 1 failed, 50 passed (the review link row) |
| Lr2-w3 | The waiting link's touch floor | Drop `.rv-wait` from the drawer's coarse rule | Green (16 passed): the Contents links' rule covers it, so the entry was removed |
| Lr2-5a | The card's changed text sits on a closed ground | Literal colour on `.rv-changed` | Red: `appearance-style` review Nord, 1 failed (rest, toc-drawer and rv-changed states) |
| Lr2-5b | The bar toggle's changed state sits on a closed ground | Literal colour on `.rv-mark.changed` | Red: `appearance-style` review Nord, 1 failed (`rv-changed` state) |
| Lr2-5c | The bar toggle's pressed state sits on a closed ground | Literal colour on `.rv-mark[aria-pressed="true"]` | Red: `appearance-style` review Nord, 1 failed (`rv-pressed` state) |

Features review lacks run no cue row for it: the changed and attention geometry rows, the Aa menu rows and the glossary table row are default rows; the marks, status-dot, link, drawer, quick-jump, switch, filter, callout and literals rows run for review through `sharedCue`.

```json
[
  {"id":"Lr2-f","file":"src/enhance/layouts/review/features.ts","savedSha256":"647af39402e6c783a89b25640e6330220781595130704df9d29208547d483695","restoredSha256":"647af39402e6c783a89b25640e6330220781595130704df9d29208547d483695","tests":"test/enhance-layouts.test.ts","rc":1,"failed":12,"passed":15},
  {"id":"Lr2-n1","file":"src/enhance/layouts/review/header.ts","savedSha256":"ec6621d242d29f9dbe1d16d1607ff55b2d9f6440a031597de81ce2f57efc44cb","restoredSha256":"ec6621d242d29f9dbe1d16d1607ff55b2d9f6440a031597de81ce2f57efc44cb","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":26},
  {"id":"Lr2-n2","file":"src/enhance/layouts/review/header.ts","savedSha256":"ec6621d242d29f9dbe1d16d1607ff55b2d9f6440a031597de81ce2f57efc44cb","restoredSha256":"ec6621d242d29f9dbe1d16d1607ff55b2d9f6440a031597de81ce2f57efc44cb","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":26},
  {"id":"Lr2-i4h","file":"src/enhance/layouts/review/header.ts","savedSha256":"ec6621d242d29f9dbe1d16d1607ff55b2d9f6440a031597de81ce2f57efc44cb","restoredSha256":"ec6621d242d29f9dbe1d16d1607ff55b2d9f6440a031597de81ce2f57efc44cb","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":26},
  {"id":"Lr2-i4c","file":"src/enhance/layouts/review/context.ts","savedSha256":"931bf3a7b6445eb5ee2027b0a2673046722af53218804bbd6a0f470699f0de20","restoredSha256":"931bf3a7b6445eb5ee2027b0a2673046722af53218804bbd6a0f470699f0de20","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":26},
  {"id":"Lr2-i4r","file":"src/enhance/layouts/review/rail.ts","savedSha256":"f37dc2f7e6de487fd73b90b62659a6f03f8b8b8b185014d1287c069640d09896","restoredSha256":"f37dc2f7e6de487fd73b90b62659a6f03f8b8b8b185014d1287c069640d09896","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":26},
  {"id":"Lr2-s1","file":"src/enhance/layouts/review/context.ts","savedSha256":"931bf3a7b6445eb5ee2027b0a2673046722af53218804bbd6a0f470699f0de20","restoredSha256":"931bf3a7b6445eb5ee2027b0a2673046722af53218804bbd6a0f470699f0de20","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":26},
  {"id":"Lr2-s2","file":"src/enhance/layouts/review/context.ts","savedSha256":"931bf3a7b6445eb5ee2027b0a2673046722af53218804bbd6a0f470699f0de20","restoredSha256":"931bf3a7b6445eb5ee2027b0a2673046722af53218804bbd6a0f470699f0de20","tests":"test/enhance-layouts.test.ts","rc":0,"passed":27,"note":"equivalent mutant: unreachable once the read-mark check is back; the check was removed"},
  {"id":"Lr2-s3","file":"src/enhance/layouts/review/context.ts","savedSha256":"133f71a01e0373487786b99418557f9f0afb0e33684a03e714490558c1839a02","restoredSha256":"133f71a01e0373487786b99418557f9f0afb0e33684a03e714490558c1839a02","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":15,"skipped":16},
  {"id":"Lr2-m1","file":"src/enhance/layouts/review/header.ts","savedSha256":"ec6621d242d29f9dbe1d16d1607ff55b2d9f6440a031597de81ce2f57efc44cb","restoredSha256":"ec6621d242d29f9dbe1d16d1607ff55b2d9f6440a031597de81ce2f57efc44cb","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":15,"skipped":16},
  {"id":"Lr2-m2","file":"src/enhance/layouts/review/context.ts","savedSha256":"931bf3a7b6445eb5ee2027b0a2673046722af53218804bbd6a0f470699f0de20","restoredSha256":"931bf3a7b6445eb5ee2027b0a2673046722af53218804bbd6a0f470699f0de20","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":26},
  {"id":"Lr2-m4a","file":"src/enhance/layouts/review/header.ts","savedSha256":"ec6621d242d29f9dbe1d16d1607ff55b2d9f6440a031597de81ce2f57efc44cb","restoredSha256":"ec6621d242d29f9dbe1d16d1607ff55b2d9f6440a031597de81ce2f57efc44cb","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":26},
  {"id":"Lr2-m4b","file":"assets/layouts/review.css","savedSha256":"e3874d86922d3cf630b67ab0b5c8450d0a85097f91e68ffc0f284f270f2ade2e","restoredSha256":"e3874d86922d3cf630b67ab0b5c8450d0a85097f91e68ffc0f284f270f2ade2e","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":15,"skipped":16},
  {"id":"Lr2-w1","file":"src/enhance/layouts/review/rail.ts","savedSha256":"f37dc2f7e6de487fd73b90b62659a6f03f8b8b8b185014d1287c069640d09896","restoredSha256":"f37dc2f7e6de487fd73b90b62659a6f03f8b8b8b185014d1287c069640d09896","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":26},
  {"id":"Lr2-w2","file":"src/enhance/layouts/review/rail.ts","savedSha256":"f37dc2f7e6de487fd73b90b62659a6f03f8b8b8b185014d1287c069640d09896","restoredSha256":"f37dc2f7e6de487fd73b90b62659a6f03f8b8b8b185014d1287c069640d09896","tests":"test/enhance-layouts.test.ts","rc":1,"failed":2,"passed":25},
  {"id":"Lr2-h","file":"assets/layouts/review.css","savedSha256":"e3874d86922d3cf630b67ab0b5c8450d0a85097f91e68ffc0f284f270f2ade2e","restoredSha256":"e3874d86922d3cf630b67ab0b5c8450d0a85097f91e68ffc0f284f270f2ade2e","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":15,"skipped":16},
  {"id":"Lr2-i1","file":"assets/layouts/review.css","savedSha256":"e3874d86922d3cf630b67ab0b5c8450d0a85097f91e68ffc0f284f270f2ade2e","restoredSha256":"e3874d86922d3cf630b67ab0b5c8450d0a85097f91e68ffc0f284f270f2ade2e","tests":"test/browser/appearance-cues.test.ts","rc":1,"failed":1,"passed":50,"skipped":51},
  {"id":"Lr2-w3","file":"assets/layouts/review.css","savedSha256":"e3874d86922d3cf630b67ab0b5c8450d0a85097f91e68ffc0f284f270f2ade2e","restoredSha256":"e3874d86922d3cf630b67ab0b5c8450d0a85097f91e68ffc0f284f270f2ade2e","tests":"test/browser/layout-review.test.ts","rc":0,"passed":16,"skipped":16,"note":"equivalent mutant: covered by the Contents links' rule; the entry was removed"},
  {"id":"Lr2-5a","file":"assets/layouts/review.css","savedSha256":"a4cce015756e2d65c512cd1f044f902d6a6d19289f82a10e9222d3e246cdb7b3","restoredSha256":"a4cce015756e2d65c512cd1f044f902d6a6d19289f82a10e9222d3e246cdb7b3","tests":"test/browser/appearance-style.test.ts -t \"review: Nord\"","rc":1,"failed":1,"skipped":427},
  {"id":"Lr2-5b","file":"assets/layouts/review.css","savedSha256":"a4cce015756e2d65c512cd1f044f902d6a6d19289f82a10e9222d3e246cdb7b3","restoredSha256":"a4cce015756e2d65c512cd1f044f902d6a6d19289f82a10e9222d3e246cdb7b3","tests":"test/browser/appearance-style.test.ts -t \"review: Nord\"","rc":1,"failed":1,"skipped":427},
  {"id":"Lr2-5c","file":"assets/layouts/review.css","savedSha256":"a4cce015756e2d65c512cd1f044f902d6a6d19289f82a10e9222d3e246cdb7b3","restoredSha256":"a4cce015756e2d65c512cd1f044f902d6a6d19289f82a10e9222d3e246cdb7b3","tests":"test/browser/appearance-style.test.ts -t \"review: Nord\"","rc":1,"failed":1,"skipped":427}
]
```

## Fix round 2: compact rows and the rail's waiting link

Measured on the committed sources (the file bytes are in each row's JSON); one test file per call, Chromium for browser files, except the last fine-pointer row, whose two runs shared a call.

| Row | Guard | Mutation | Measured result |
|---|---|---|---|
| Lr3-d | The layout stays under the default bundle (supersedes Lr-d and Lr2 size notes) | Pad the review bundle's characters by 25,691 in memory | Red: control 200,019 against 225,709 has no violation; 225,710 is rejected |
| Lr3-c1 | A table is compact from six rows | `ROWS_MIN` 5 | Red: `enhance-layouts` 1 failed, 66 passed |
| Lr3-c2 | A table is compact over 240 characters a row | `AVERAGE_MIN` 200 | Red: `enhance-layouts` 1 failed, 66 passed |
| Lr3-c3 | An empty cell is not wrapped | Drop the skip | Red: `enhance-layouts` 1 failed, 66 passed |
| Lr3-c4 | The buttons go in the filter's tools when the table has a filter | Always make a bar of its own | Red: `enhance-layouts` 1 failed, 66 passed |
| Lr3-c5 | A row's button opens and closes it | Drop the class toggle | Red: `enhance-layouts` 1 failed, 66 passed |
| Lr3-c6 | Open all rows opens every row | Drop the row loop | Red: `enhance-layouts` 1 failed, 66 passed |
| Lr3-c7 | The relayout measures overflow | Never overflowing | Red: `layout-review` 2 failed, 19 passed |
| Lr3-c8 | The hidden-root check (superseded: the "equivalent" finding was wrong: without the check a relayout while the root is hidden strips the marks for the frame after it is shown again, a one-frame flash of cut rows; Lr4-h measured it red) | Dropped | Was recorded equivalent and removed in `d779c8f`; restored in fix round 3 |
| Lr3-w1 | The waiting link needs a list | Drop `waiting.length > 0` | Red: `enhance-layouts` 1 failed, 66 passed |
| Lr3-w2 | The waiting link beats the shared rail's link rule | Revert to the bare `.rv-wait` selector | Red: `layout-review` 1 failed, 20 passed (computed border and padding) |
| Lr3-p | Nothing is clipped on a phone | Drop the phone rule | Red: `layout-review` 1 failed, 20 passed |
| Lr3-t1 | Open all rows keeps the 44 px floor | `min-height: 20px` | Red: `layout-review` 1 failed, 20 passed |
| Lr3-t2 | A row button keeps the 44 px floor | `min-height` and `min-width` 20px | Red: `layout-review` 1 failed, 20 passed |
| Lr3-f | The control-row rule is under a fine pointer | `@media all` | Red: `layout-review` 1 failed, 20 passed and `appearance-cues` 1 failed, 57 passed |
| Lr3-5 | The compact states sit on closed grounds | Literal colour on Open all rows | Red: `appearance-style` review Nord 1 failed (rest, rv-pressed and other states of the synthetic compact fixture) |

```json
[
  {"id":"Lr3-d","file":"src/frame/manifest.generated.ts","tests":"test/size-rules.ts (pure judge, scratch script)","rc":0,"control":{"review":200019,"defaults":225709,"violations":[]},"paddingChars":25691,"mutantChars":225710,"capChars":225709,"red":["layouts: review is 225710 characters, over the default enhance bundle's 225709"]},
  {"id":"Lr3-c1","file":"src/enhance/layouts/review/compact.ts","savedSha256":"bf12fb97f3dc9644bdeb9a625b62893c1fa64d67f67dc0e63c3990d7363c3d04","restoredSha256":"bf12fb97f3dc9644bdeb9a625b62893c1fa64d67f67dc0e63c3990d7363c3d04","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":66},
  {"id":"Lr3-c2","file":"src/enhance/layouts/review/compact.ts","savedSha256":"bf12fb97f3dc9644bdeb9a625b62893c1fa64d67f67dc0e63c3990d7363c3d04","restoredSha256":"bf12fb97f3dc9644bdeb9a625b62893c1fa64d67f67dc0e63c3990d7363c3d04","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":66},
  {"id":"Lr3-c3","file":"src/enhance/layouts/review/compact.ts","savedSha256":"bf12fb97f3dc9644bdeb9a625b62893c1fa64d67f67dc0e63c3990d7363c3d04","restoredSha256":"bf12fb97f3dc9644bdeb9a625b62893c1fa64d67f67dc0e63c3990d7363c3d04","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":66},
  {"id":"Lr3-c4","file":"src/enhance/layouts/review/compact.ts","savedSha256":"bf12fb97f3dc9644bdeb9a625b62893c1fa64d67f67dc0e63c3990d7363c3d04","restoredSha256":"bf12fb97f3dc9644bdeb9a625b62893c1fa64d67f67dc0e63c3990d7363c3d04","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":66},
  {"id":"Lr3-c5","file":"src/enhance/layouts/review/compact.ts","savedSha256":"bf12fb97f3dc9644bdeb9a625b62893c1fa64d67f67dc0e63c3990d7363c3d04","restoredSha256":"bf12fb97f3dc9644bdeb9a625b62893c1fa64d67f67dc0e63c3990d7363c3d04","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":66},
  {"id":"Lr3-c6","file":"src/enhance/layouts/review/compact.ts","savedSha256":"bf12fb97f3dc9644bdeb9a625b62893c1fa64d67f67dc0e63c3990d7363c3d04","restoredSha256":"bf12fb97f3dc9644bdeb9a625b62893c1fa64d67f67dc0e63c3990d7363c3d04","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":66},
  {"id":"Lr3-c7","file":"src/enhance/layouts/review/compact.ts","savedSha256":"bf12fb97f3dc9644bdeb9a625b62893c1fa64d67f67dc0e63c3990d7363c3d04","restoredSha256":"bf12fb97f3dc9644bdeb9a625b62893c1fa64d67f67dc0e63c3990d7363c3d04","tests":"test/browser/layout-review.test.ts","rc":1,"failed":2,"passed":19,"skipped":21},
  {"id":"Lr3-c8","file":"src/enhance/layouts/review/compact.ts","rc":0,"note":"superseded: the equivalent finding was wrong; see Lr4-h"},
  {"id":"Lr3-w1","file":"src/enhance/layouts/review/rail.ts","savedSha256":"f3a39cbb4f9543a689af964f0fd1d5c29934f561234d1a4e8daad38ede7df29b","restoredSha256":"f3a39cbb4f9543a689af964f0fd1d5c29934f561234d1a4e8daad38ede7df29b","tests":"test/enhance-layouts.test.ts","rc":1,"failed":1,"passed":66},
  {"id":"Lr3-w2","file":"assets/layouts/review.css","savedSha256":"11fa119685d24a3aed10f2f4ac53f963581218dd913648a18af28835a7871448","restoredSha256":"11fa119685d24a3aed10f2f4ac53f963581218dd913648a18af28835a7871448","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":20,"skipped":21},
  {"id":"Lr3-p","file":"assets/layouts/review.css","savedSha256":"11fa119685d24a3aed10f2f4ac53f963581218dd913648a18af28835a7871448","restoredSha256":"11fa119685d24a3aed10f2f4ac53f963581218dd913648a18af28835a7871448","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":20,"skipped":21},
  {"id":"Lr3-t1","file":"assets/layouts/review.css","savedSha256":"11fa119685d24a3aed10f2f4ac53f963581218dd913648a18af28835a7871448","restoredSha256":"11fa119685d24a3aed10f2f4ac53f963581218dd913648a18af28835a7871448","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":20,"skipped":21},
  {"id":"Lr3-t2","file":"assets/layouts/review.css","savedSha256":"11fa119685d24a3aed10f2f4ac53f963581218dd913648a18af28835a7871448","restoredSha256":"11fa119685d24a3aed10f2f4ac53f963581218dd913648a18af28835a7871448","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":20,"skipped":21},
  {"id":"Lr3-f","file":"assets/layouts/review.css","savedSha256":"11fa119685d24a3aed10f2f4ac53f963581218dd913648a18af28835a7871448","restoredSha256":"11fa119685d24a3aed10f2f4ac53f963581218dd913648a18af28835a7871448","runs":[{"tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":20},{"tests":"test/browser/appearance-cues.test.ts","rc":1,"failed":1,"passed":57}]},
  {"id":"Lr3-5","file":"assets/layouts/review.css","savedSha256":"11fa119685d24a3aed10f2f4ac53f963581218dd913648a18af28835a7871448","restoredSha256":"11fa119685d24a3aed10f2f4ac53f963581218dd913648a18af28835a7871448","tests":"test/browser/appearance-style.test.ts -t \"review: Nord\"","rc":1,"failed":1,"skipped":455}
]
```

## Fix round 3: the hidden root, print and the open row

Same method; `compact.ts` rows were measured on the committed sources (the file's saved hash is in each JSON entry; `Lr4-c1` to `Lr4-c3` on the uncommitted bytes whose sha256 is `12fb6249a55c90ee592079ab9d44c77a59f9a06f071e7499da0af4f9437f8cda`, which differ from `3e46438`'s `compact.ts` (`9c730ee1...`, the version `Lr4-e` was measured on) only in its header comment; `Lr4-h` and `Lr4-c4` on `840450a`'s version, `a3f7ee6a...`). Rows: 13 in the table and 13 JSON entries below. `Lr3-c8` above is superseded by `Lr4-h`. 

| Row | Guard | Mutation | Measured result |
|---|---|---|---|
| Lr4-h | The hidden root is not measured (the reason is a one-frame flash of cut rows, since showing the root asks for a relayout; measured on the version of `840450a`, and superseded by Lr5-h) | Drop `getClientRects().length === 0` | Red: `layout-review` 1 failed, 25 passed (a relayout run on a fake clock while the root is hidden) |
| Lr4-p1 | In print the row is not clipped | Drop `max-height: none` from the print rule | Red: `layout-review` 1 failed, 25 passed |
| Lr4-p2 | In print the fade is off | Drop the mask resets from the print rule | Red: `layout-review` 1 failed, 25 passed |
| Lr4-p3 | In print the row button is hidden | Drop `!important` from its print rule | Red: `layout-review` 1 failed, 25 passed |
| Lr4-b | An open row has the surface for its ground | Drop `!important` from the open-row rule | Red: `layout-review` 1 failed, 25 passed |
| Lr4-t | The first cell clears the 44 px button under touch | Padding 20px | Red: `layout-review` 1 failed, 25 passed |
| Lr4-m1 | The hint is hidden on a phone | Drop its phone rule | Red: `layout-review` 1 failed, 25 passed |
| Lr4-m2 | Open all rows is hidden on a phone | Drop its phone rule | Red: `layout-review` 1 failed, 25 passed |
| Lr4-c1 | Rows Open all rows closes are measured | Drop the measure after a close | Red: `layout-review` 1 failed, 25 passed (deterministic resize row) |
| Lr4-c2 | An open row gets its mark back when the window is wide again | Drop the restore | Red: `layout-review` 1 failed, 25 passed |
| Lr4-c3 | A phone relayout takes the mark off an open row | Drop the strip | Red: `layout-review` 1 failed, 25 passed |
| Lr4-e | An empty first cell names its button "row" | Drop the fallback | Red: `enhance-layouts` 1 failed, 71 passed |
| Lr4-c4 | A row the button closes is measured (superseded by Lr5-c4: the "unreachable" finding is withdrawn, a width change while the row is open makes it reachable) | Drop the measure after the button closes a row | Green on a fixture with no width change (26 passed), measured on `840450a`'s version; red with the width row of fix round 4 |

```json
[
  {"id": "Lr4-h", "file": "src/enhance/layouts/review/compact.ts", "savedSha256": "a3f7ee6a2d7b8e357f05d2ab7a3907063e21adfc4f8de645c53a06169cb8b3a7", "restoredSha256": "a3f7ee6a2d7b8e357f05d2ab7a3907063e21adfc4f8de645c53a06169cb8b3a7", "tests": "test/browser/layout-review.test.ts", "rc": 1, "failed": 1, "passed": 25},
  {"id": "Lr4-p1", "file": "assets/layouts/review.css", "savedSha256": "920780aaeccf034223d33179d0f1a77fab74663d317825f75960b7920a7def68", "restoredSha256": "920780aaeccf034223d33179d0f1a77fab74663d317825f75960b7920a7def68", "tests": "test/browser/layout-review.test.ts", "rc": 1, "failed": 1, "passed": 25},
  {"id": "Lr4-p2", "file": "assets/layouts/review.css", "savedSha256": "920780aaeccf034223d33179d0f1a77fab74663d317825f75960b7920a7def68", "restoredSha256": "920780aaeccf034223d33179d0f1a77fab74663d317825f75960b7920a7def68", "tests": "test/browser/layout-review.test.ts", "rc": 1, "failed": 1, "passed": 25},
  {"id": "Lr4-p3", "file": "assets/layouts/review.css", "savedSha256": "920780aaeccf034223d33179d0f1a77fab74663d317825f75960b7920a7def68", "restoredSha256": "920780aaeccf034223d33179d0f1a77fab74663d317825f75960b7920a7def68", "tests": "test/browser/layout-review.test.ts", "rc": 1, "failed": 1, "passed": 25},
  {"id": "Lr4-b", "file": "assets/layouts/review.css", "savedSha256": "920780aaeccf034223d33179d0f1a77fab74663d317825f75960b7920a7def68", "restoredSha256": "920780aaeccf034223d33179d0f1a77fab74663d317825f75960b7920a7def68", "tests": "test/browser/layout-review.test.ts", "rc": 1, "failed": 1, "passed": 25},
  {"id": "Lr4-t", "file": "assets/layouts/review.css", "savedSha256": "920780aaeccf034223d33179d0f1a77fab74663d317825f75960b7920a7def68", "restoredSha256": "920780aaeccf034223d33179d0f1a77fab74663d317825f75960b7920a7def68", "tests": "test/browser/layout-review.test.ts", "rc": 1, "failed": 1, "passed": 25},
  {"id": "Lr4-m1", "file": "assets/layouts/review.css", "savedSha256": "920780aaeccf034223d33179d0f1a77fab74663d317825f75960b7920a7def68", "restoredSha256": "920780aaeccf034223d33179d0f1a77fab74663d317825f75960b7920a7def68", "tests": "test/browser/layout-review.test.ts", "rc": 1, "failed": 1, "passed": 25},
  {"id": "Lr4-m2", "file": "assets/layouts/review.css", "savedSha256": "920780aaeccf034223d33179d0f1a77fab74663d317825f75960b7920a7def68", "restoredSha256": "920780aaeccf034223d33179d0f1a77fab74663d317825f75960b7920a7def68", "tests": "test/browser/layout-review.test.ts", "rc": 1, "failed": 1, "passed": 25},
  {"id": "Lr4-c1", "file": "src/enhance/layouts/review/compact.ts", "savedSha256": "12fb6249a55c90ee592079ab9d44c77a59f9a06f071e7499da0af4f9437f8cda", "restoredSha256": "12fb6249a55c90ee592079ab9d44c77a59f9a06f071e7499da0af4f9437f8cda", "tests": "test/browser/layout-review.test.ts", "rc": 1, "failed": 1, "passed": 25},
  {"id": "Lr4-c2", "file": "src/enhance/layouts/review/compact.ts", "savedSha256": "12fb6249a55c90ee592079ab9d44c77a59f9a06f071e7499da0af4f9437f8cda", "restoredSha256": "12fb6249a55c90ee592079ab9d44c77a59f9a06f071e7499da0af4f9437f8cda", "tests": "test/browser/layout-review.test.ts", "rc": 1, "failed": 1, "passed": 25},
  {"id": "Lr4-c3", "file": "src/enhance/layouts/review/compact.ts", "savedSha256": "12fb6249a55c90ee592079ab9d44c77a59f9a06f071e7499da0af4f9437f8cda", "restoredSha256": "12fb6249a55c90ee592079ab9d44c77a59f9a06f071e7499da0af4f9437f8cda", "tests": "test/browser/layout-review.test.ts", "rc": 1, "failed": 1, "passed": 25},
  {"id": "Lr4-e", "file": "src/enhance/layouts/review/compact.ts", "savedSha256": "9c730ee15baeaf7ce38d9d1c40b7b8aabfc67ddf444158424bf5b2749a971abc", "restoredSha256": "9c730ee15baeaf7ce38d9d1c40b7b8aabfc67ddf444158424bf5b2749a971abc", "tests": "test/enhance-layouts.test.ts", "rc": 1, "failed": 1, "passed": 71},
  {"id": "Lr4-c4", "file": "src/enhance/layouts/review/compact.ts", "savedSha256": "a3f7ee6a2d7b8e357f05d2ab7a3907063e21adfc4f8de645c53a06169cb8b3a7", "restoredSha256": "a3f7ee6a2d7b8e357f05d2ab7a3907063e21adfc4f8de645c53a06169cb8b3a7", "tests": "test/browser/layout-review.test.ts", "rc": 0, "passed": 26, "note": "superseded by Lr5-c4: the unreachable finding is withdrawn"}
]
```

## Fix round 4: the closing row and the filtered rows

Measured on `df1986a`'s `compact.ts` (sha256 `3b8e77c16c62a3b5e18aacfcbc0d6ec741377ff4a7e8a5c4c71cba2b5aa0d3ac`), Chromium, one file per call. Rows: 3 in the table and 3 JSON entries.

| Row | Guard | Mutation | Measured result |
|---|---|---|---|
| Lr5-c4 | A row closed by its button is measured at the width it is closed at | Drop the measure after the button closes a row | Red: `layout-review` 1 failed, 27 passed (fake clock: open at 1300 px, resize to 900, close, compare with an untouched row) |
| Lr5-f | Rows with no box keep their marks | Measure every row | Red: `layout-review` 1 failed, 27 passed (filter, Open all rows twice, clear: 12 clipped rows with their buttons) |
| Lr5-h | The root-level hidden check | Drop it | Green (28 passed): the row-level check covers a hidden root, so the root check was removed; Lr4-h's red result was on the version without the row check |

```json
[
  {"id":"Lr5-c4","file":"src/enhance/layouts/review/compact.ts","savedSha256":"3b8e77c16c62a3b5e18aacfcbc0d6ec741377ff4a7e8a5c4c71cba2b5aa0d3ac","restoredSha256":"3b8e77c16c62a3b5e18aacfcbc0d6ec741377ff4a7e8a5c4c71cba2b5aa0d3ac","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":27,"skipped":28},
  {"id":"Lr5-f","file":"src/enhance/layouts/review/compact.ts","savedSha256":"3b8e77c16c62a3b5e18aacfcbc0d6ec741377ff4a7e8a5c4c71cba2b5aa0d3ac","restoredSha256":"3b8e77c16c62a3b5e18aacfcbc0d6ec741377ff4a7e8a5c4c71cba2b5aa0d3ac","tests":"test/browser/layout-review.test.ts","rc":1,"failed":1,"passed":27,"skipped":28},
  {"id":"Lr5-h","file":"src/enhance/layouts/review/compact.ts","savedSha256":"3b8e77c16c62a3b5e18aacfcbc0d6ec741377ff4a7e8a5c4c71cba2b5aa0d3ac","restoredSha256":"3b8e77c16c62a3b5e18aacfcbc0d6ec741377ff4a7e8a5c4c71cba2b5aa0d3ac","tests":"test/browser/layout-review.test.ts","rc":0,"passed":28,"skipped":28,"note":"equivalent: the row-level check covers a hidden root; the root check was removed"}
]
```
