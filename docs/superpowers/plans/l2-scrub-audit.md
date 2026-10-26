# L2 Task 24 Scrub Audit

## In short

This is the bounded documentation and structural-scrub portion of Task 24. It records the implemented L2 contract without claiming the final browser, consumer, parity, or whole-branch checks. Task 23's diagram-tools coverage remains owned elsewhere and is pending here.

## 1. Scope

The public `./enhance` contract is documented from the frozen option, state, lifecycle and vocabulary modules. The scrub test checks structural properties only: URL literals (including literal interpolated-template parts), direct and root-window `performance` calls, namespace construction/comparison context, the single vocabulary home and obsolete release wording. A focused state behavior case supplies the semantic proof that a caller namespace reaches prefs, UI, document and position seams; the scrub key-template assertions alone do not prove those calls. Neither test carries a private-name blacklist or loosens existing source walls.

## 2. Section 3.7 Audit Matrix

The package's scrub constraints map to code and tests as follows. File pointers are implementation evidence; they are not a statement that the pending final verification has passed.

| §3.7 concern | Implementation pointer | Existing or authored pin |
|---|---|---|
| No network, fetch, routing or library URL | `src/enhance/host.ts`, `src/enhance/nav.ts` | `test/enhance-walls.test.ts`; `test/enhance-scrub.test.ts` URL and literal-template shape |
| No ambient storage API | `src/enhance/state.ts` | `test/enhance-walls.test.ts`; `test/enhance-scrub.test.ts` storage shape |
| Host storage only, with reader namespace | `src/enhance/options.ts`, `src/enhance/state.ts` | `test/enhance-state.test.ts` non-default namespace behavior; `test/enhance-scrub.test.ts` key-template structure |
| No performance marks | `src/enhance/env.ts` | `test/enhance-scrub.test.ts` direct and root-window AST call shapes |
| Import inertness and root-scoped access | `src/enhance/index.ts`, `src/enhance/lifecycle.ts`, `src/enhance/env.ts` | `test/enhance-walls.test.ts` |
| CSP-safe DOM writes and no document-id lookup | `src/enhance/journal.ts`, `src/enhance/nav.ts` | `test/enhance-walls.test.ts` |
| Every word list has one library home | `src/enhance/vocab.ts` | `test/enhance-vocab.test.ts`; `test/enhance-scrub.test.ts` |
| Package fonts and warm root-scoped palette | `assets/reader.css`, `assets/fonts/` | `test/enhance-styles.test.ts`; final visual verification pending |

## 3. Not Ported Matrix

| Reference-layout part not ported | Current boundary | Pin |
|---|---|---|
| Classic and prototype variants | No variant option or feature registration | `test/enhance-walls.test.ts`; authored scrub wording check |
| Sibling-link query rewriting | `src/enhance/nav.ts` passes the original `href` to `onLink` | `test/enhance-nav.test.ts` |
| Hosted-font CSP allowances | Package CSS and package fonts; host chooses its policy | `test/enhance-styles.test.ts`; browser-policy verification pending |
| Performance marks | No performance API in reader source | `test/enhance-scrub.test.ts` |
| Hidden-until-ready gate | `src/enhance/relayout.ts` remeasures after fonts; visibility remains host-owned | `test/enhance-relayout-baseline.test.ts` |
| Auto-run bootstrap on import | `src/enhance/index.ts` exports declarations only | `test/enhance-walls.test.ts` |

## 4. Contract Notes

- `enhance`, `destroyEnhancement`, `setEnhancementPrefs`, `goToHash` and `EnhanceError` are the runtime exports. `goToHash` is the host-history return path, not a router.
- Reader state uses `<namespace>:prefs`, `<namespace>:ui`, `<namespace>:pos:<posKey>` and `<namespace>:doc:<storageKey>:<name>`. The default namespace is `docreader`; a caller's namespace controls every key.
- The root marker is `data-docreader-root`; all reader-created nodes carry `data-docreader-chrome`. Preference state is `data-theme`, `data-width`, `data-font` and, for the product lens, `lens-product`.
- The source nodes are moved or split under a journal and are restored on destroy. Root ownership, generated chrome IDs and storage write queues are scoped per root or per supplied storage object, so roots share neither chrome nor queues by accident.
- `vocab.ts` owns both host-configurable vocabulary and the fixed format contract. Callers supply literal words only; no parallel run-time word list is maintained in documentation or tests.
- Drawings are host-module based and keep readable source fallback. Final Task 23 and Task 24 behavioral verification is still pending.

## 5. Verified Locally - 2026-10-26

The frozen feature input completes 2,637 non-layout assertions in 79 files and 273 Chromium layout assertions in 34 files, with 233 WebKit cases explicitly excluded. All three TypeScript checks pass. After exact guard reversals and byte restoration, the complete six-file affected selection passes 133 assertions with 36 excluded. These results precede main reconciliation; the integration tip needs fresh verification.

All thirteen neutral source samples complete both viewports and three preference states with no unexplained measured difference. Core, rail, since and diagram tools are checked again on the final production input. Twenty named interactive states complete light/dark comparisons at both viewports. Exact reviewed differences concern only desktop computed horizontal margins, desktop rail placement and the bar's equivalent background-paint ownership; none waives inner geometry, phone figure margins or playback timing. Reference figures use an explicitly backend-aligned omitted-layout default because the pinned bundle excludes ELK. This is not an unmodified-default ELK parity claim.

Task 23 records seventeen finite source guard assertion reds. Task 22 records split semantic reversals and preserves two independently measured redundant outer-live conjuncts as greens, not invented failures. Read-mark residuals directly establish non-document exclusion, valid-unit routing exclusion and successful startup on malformed stored records. Mutation journals retain earlier weak, incomplete and setup-error receipts with their limitations.

## 6. Integration Fix Round - 2026-10-26

The approved main-based integration preserves the original feature history and verified-input snapshot. Its first Node 22 and 24 CI run passes 3,143 assertions per job but fails the same ten WebKit cases: clone capture under strict CSP, pinch geometry and touch/card interactions. Later build and packed-consumer steps do not run. These failures are not dismissed as Chromium passes.

The whole-branch panel identifies ten confirmed behavior and documentation findings. Regression assertions first reproduce radio grouping, stale bulk-fold controls, prior-visit comparison without history, a useful singleton day action, missing host contracts, post-destroy card focus, interrupted source playback and a detached clone ID write. The scoped fixes preserve immediate nonliveness, conditional restoration and the closed style vocabulary. Exact reversals of the card liveness check, clone-enumeration check and playback visibility ownership each produce a complete assertion failure, then restore the source bytes.

The corrected local non-layout suite passes 2,647 assertions in 79 files. After test-only TypeScript narrowing corrections, the complete six-file affected control passes 264 assertions; all three TypeScript projects and the unchanged ratchet pass. The complete Chromium layout run passes 275 assertions in 34 files, with 235 WebKit cases excluded. An earlier callback-scope error and its output-limited run remain failed/incomplete evidence, not a pass.

Browser corrections retain native Chromium touch and native WebKit taps, label unsupported WebKit gestures as a stage-local synthetic capture model, and assert actual input delivery. Strict-CSP clone paint uses a pinned, fail-closed WebKit capture transport that avoids Playwright's inline synchronization stylesheet; policy and pixel assertions remain intact. Corrected-tip WebKit CI must still prove these paths. Synthetic gesture coverage is not native gesture acceptance.

The corrected run at `38f2ae87c430c65e3412d2f8668fb0cbbbea8869` completes the Node 22 job: all 3,167 tests in 114 files pass, including both browsers; typechecks, unchanged snapshots, build, ratchet, packaging and the strict packed-consumer smoke also pass (82 of 82 corpus cases). Node 24 exceeds the job's 30-minute limit during browser installation and is cancelled before typechecks or tests. That is an incomplete Node 24 gate, not a test failure or a green matrix. Both scoped re-review lenses close the original ten findings. The current built-Mermaid integration control and its exact M7 reversal are recorded separately in Task 23's journal; they do not imply packed-enhancement mutation coverage. No final-tip or release acceptance is inferred.

## 7. Remaining Verification

- Complete corrected-tip Node 22/24 CI, both browsers, packed consumer smoke, built-artifact checks and scoped whole-branch fix closure. Local Chromium results do not stand in for these gates.
- Complete the actual requested-model review gate; differently reported runtime identities do not satisfy it.
- Finish L3's frame, host adapters, asset manifest and provenance/release work before claiming the published shared library or consumer integration is complete.
