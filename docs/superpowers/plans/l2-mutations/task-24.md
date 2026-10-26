# L2 Task 24: whole-branch fix regressions

## In short

The single whole-branch fix round starts from integration commit `0ee577bb8bbcbf3e54f973b517f576b8096d977d`. Tests reproduce the original failures before production changes. The final six-file control passes 264 assertions; all three TypeScript projects and the unchanged ratchet pass. The full non-layout run passes 2,647 assertions, and Chromium passes 275 with 235 WebKit cases excluded. These are not corrected-tip WebKit, native gesture, built-artifact or release acceptance.

## Measured source reversals

Each reversal below runs serially in place through the bounded runner, produces a complete assertion failure and restores the exact original bytes in `finally`. No repository or dependency copy is made. The test command is `./node_modules/.bin/vitest run --project unit <test> --maxWorkers=1 --fileParallelism=false -t <filter>`.

| ID | Source and exact reversal | Test and filter | Result | Receipt |
|---|---|---|---|---|
| L2-T24-M1 | `cards.ts`: `return ctx.live() && shown === a;` becomes `return shown === a;` | `test/enhance-cards.test.ts`, `leaves an Enter key` | Assertion red: key consumed, one card-link focus, outside focus lost | `task24-fix1-reversal-cards-20261026.log` |
| L2-T24-M2 | `journal.ts`: delete the immediate `if (!live()) throw new Error('docreader: journal.cloneSvg after clone enumeration');` | `test/enhance-lifecycle.test.ts`, `does not rewrite a clone ID` | Assertion red: clone root ID changes after liveness invalidation | `task24-fix1-reversal-clone-20261026.log` |
| L2-T24-M3 | `diagram-tools.ts`: replace all nine `playback.visibility.journal.toggleClass` calls with `ctx.journal.toggleClass` | `test/enhance-diagram-tools.test.ts`, `restores authored source visibility` | Assertion red: authored visibility is not restored | `task24-fix1-reversal-visibility-20261026.log` |
| L2-T24-M4 | `settings.ts`: delete the `ctx.onRelayout` subscription whose callback checks `reasons.has('folds')` and calls `update()` | `test/enhance-settings.test.ts`, `recomputes bulk` | Assertion red: open bulk controls retain the prior partial-fold state | `task24-fix1-reversal-fold-refresh-20261026.log` |

```json
[
  {"id":"L2-T24-M1","source":"src/enhance/cards.ts","count":1,"result":"assertion-red","exit":1},
  {"id":"L2-T24-M2","source":"src/enhance/journal.ts","count":1,"result":"assertion-red","exit":1},
  {"id":"L2-T24-M3","source":"src/enhance/diagram-tools.ts","count":9,"result":"assertion-red","exit":1},
  {"id":"L2-T24-M4","source":"src/enhance/settings.ts","count":1,"result":"assertion-red","exit":1}
]
```

M3 measures the ownership group, not nine independently deleted guards. M4's original control is part of the 264-test selection; the restored settings file also passes all 29 assertions independently. M1 and M2 have both initial reproductions and exact post-fix deletion measurements. Earlier output-limited or setup-error attempts are not counted as assertion-red evidence.

## Other test-first findings

`task24-fix1-initial-red-20261026.log` reproduces stale fold controls, a missing connected singleton day picker, the absent history-free prior-visit host call and three missing README contracts. Its radio witness first fails because the matcher is unavailable; after correction to `Set.size`, `task24-fix1-lifecycle-assertion-red-20261026.log` directly measures three names rather than one. The actual Chromium radio case also fails before the fix (`task24-fix1-radio-browser-red-20261026.log`). These are initial regression failures, not additional independent mutation rows.

`task24-fix1-playback-clone-red-20261026.log` directly observes two hidden source elements and a stuck `Playing...` control after fullscreen cancellation, and the clone root's changed ID after enumeration invalidates liveness. The clone test asserts DOM identity independently of error wording. The cards test records focus identity as a boolean to keep failure output bounded.

## Browser qualifications

The first actual Node 22/24 run fails ten WebKit cases per job, each with 3,143 passing assertions. The corrected harness does not silently skip unsupported transports: Chromium keeps native CDP touch; WebKit uses native touchscreen taps and an explicitly labeled synthetic stage-local capture model for unsupported gestures. Actual delivered events and unchanged numeric/card assertions remain required. Native capture rejection for an inactive synthetic pointer has its own control. Synthetic model coverage never establishes native multi-touch acceptance.

Strict-CSP clone paint keeps zero-violation checks before and after capture and its pixel/source-independence assertions. WebKit capture uses the pinned protocol path without Playwright's inline synchronization stylesheet; it fails closed if that transport changes. Corrected-tip CI, not local Chromium, must validate that path. No CSP relaxation or violation filtering is introduced.
