# X2 layout additions, landing B1: notes for the plan and ledger

This note supplements the [landing A notes](parity-additions.md) and the B1 Results of the [library plan](../../plans/2026-11-20-docserver-parity-additions.md).

## Design §3: split and frame construction

- **Split.** B1 carries the build-check fix (Task 0), layout infrastructure (Task 9), `classic` (Task 10), `editorial` (Task 11), and the first size and documentation closeout (Task 14). B2 starts at merged B1 and adds `review` and `guided` (Tasks 12 and 13), with its own Task 14 closeout. The infrastructure alone originally touched 41 files; adding all four layouts adds 216 snapshots. Two real layouts exercise the infrastructure without shipping placeholders. Each landing has one `x2` growth row. No release or version change here.
- **One entry, one feature list.** Each alternate bundle uses the same entry as `default`. The layout plugin substitutes only the lifecycle's `./features.js` import and requires exactly one substitution. The default build uses no plugin. The bootstrap global list comes from the four base scripts; the final scan includes the alternate bundles and fails if a layout reads a name the base did not pin.
- **One layout per document.** The frame validates the chosen script and, where required, the layout stylesheet against their own manifest entries before inlining either. The stylesheet follows the shared reader CSS after one newline within the existing style element. The default gains no newline; the guard and bootstrap see the same element order. Only scripts have CSP hashes. The existing `style-src 'unsafe-inline'` is unchanged; there is no layout stylesheet hash in the policy. The sandbox, bridge version, operations and channels are unchanged.
- **Pins.** `frameCsp()` and `frameCsp('default')` match the previous default policy byte for byte. Two fixtures pin the entire default srcdoc against hashes measured at landing A before the change. Each alternate layout inlines only its own enhance bundle and layout stylesheet. `maxSrcdocChars(layout)` uses the selected assets along with the unchanged seed and hosted face bounds. `MAX_SRCDOC_CHARS_DEFAULT` remains 116,224,259.

## Results through Task 9

- **Task 0.** The two bootstrap scans compare sorted free-global reads and writes, not local alias spellings. No change to the exact-once embedding check, list comparison, allowlist or byte cap. The [mutation record](../../plans/parity-mutations/task-0.md) has eight JSON rows: T0a–T0d and their first-review re-measurements. T0c is superseded by T0c-FR1 and kept as a historical result. T0b-FR1 observed its expected failing assertion before a memory kill left the remaining selected rows unmeasured. The 48-test file passed once under the heap cap; subsequent restored-byte runs killed without assertion mismatches yielded no verdict. The restored build passed its reproducibility check.
- **Task 9.** Per-layout manifests, policy and document limits, package assets, the corpus harness and ratchet, and the host layout adapter. The [mutation record](../../plans/parity-mutations/task-9.md) has 23 JSON rows, all red. Some early rows measure the provisional five-entry version. The duplicate static-import probe initially stayed green because the bundler resolved it once; the static-plus-dynamic probe produced two resolutions and went red. Two mutated document-path rows fail before the browser; the unmutated sealed frames separately reached `ready` in Chromium, with policy and port-spy rows for each layout.
- **Checks at the Task 9 review fix.** Frame layouts 47, CSP 150, boundaries 22, document 269, host mount 209, ratchet 55, frame build 49, README 47, CI workflow 63, pack 15, size rules 62, enhance layouts 11, walls 16: all passed. Type checking and frame reproducibility passed. Chromium passed 43 boot, 11 frame appearance, 3 layout harness and 64 layout corpus rows; remaining rows were skipped, including the still-provisional layout corpora. The growth test was intentionally incomplete at Task 9: only the row and append-count assertions failed, since Task 14 supplies the row.
- **Local commands.** Run single files through the test wrapper. The boundary and size checks use `origin/main` as base, rather than a development commit. Local browsers are restricted to Chromium. If a file is killed before reporting any assertion mismatch, retry once in isolation with `NODE_OPTIONS=--max-old-space-size=1200` assigned inside the wrapper and record a second kill as unmeasured. The frame-document old-cap row, initially unmeasured at Task 9, passed in the isolated capped run at the review fix.

## Task 10 checkpoint (before the held-out review)

- **Classic.** The classic graph leaves out the default review and settings chrome. The port has its own summary and status boxes, contents with an H2/H3 spy and local rail follow, phone chips and reveal. It uses the shared navigation, progress, table, code, jump and figure services. The [scrub audit](../../plans/parity-scrub-classic.md) records the differences from the reference and the [mutation record](../../plans/parity-mutations/task-10.md) records 11 red measurements, including one earlier storage probe superseded by its ambient-read probe.
- **Bytes and tests.** At the pre-review tip, classic uses 141,109 script and 2,775 stylesheet characters, 143,884 combined, 81,825 under the default bundle. The five default assets match landing A. Chromium read back 54 new classic snapshots in the 118-test corpus pass, with no default corpus change. Local Chromium also passed 12 hosted appearance fixtures, 32 cue tests, 10 interaction rows and 43 browser frame-boot rows. The uncapped frame-boot run at this tip was killed with no failed assertion; the one capped retry was clean. A prior transient classic snapshot mismatch is recorded in the audit, not treated as a golden move.

## Task 10 held-out review fix

- The reviewer reproduced the transient plan-marks rail mismatch and found that keyboard focus could leave the narrow drawer. The fix updates the spy on reader relayout, traps Tab, ends the modal state on widening, restores focus on dismissal and follows the current heading when reopening. Drawer type and row sizes use host slots; coarse-pointer controls meet the 44px floor. Numbered heading labels are retained in chips and rail links.
- The Classic plan-marks case uses a shorter viewport and waits for the neutral rail state with the first heading below the reading line. The new Classic corpus remains 54 snapshots; six of those additions changed only to include numbered labels. No existing default snapshot or golden moved. Chromium passed the full 118-row read-back and a subsequent isolated plan-marks run. Classic interaction checks passed 18, feature/lifecycle checks 13, cue checks 4, hosted colour checks 12, and filtered sealed frame checks 2. WebKit remains a CI check.
- The re-review reproduced the green corpus read-back and found one remaining focus gap: pointer activation need not focus the triggering button. Passing that button explicitly is verified by a red-first regression covering Escape and scrim dismissal. The host command still restores the host's original focus. The full interaction file then passed 19 Chromium rows.
- The final focus fix brought Classic to 141,657 script + 4,054 stylesheet characters = 145,711 (145,720 bytes), 79,998 characters under the layout cap. Default assets and the bootstrap global list still match landing A. The [mutation record](../../plans/parity-mutations/task-10.md) now has 15 red measurements, including the later-selector, numbered-label, drawer-skin and pointer-focus probes. The held-out reviewer approved Task 10 at `a24df7a` after independently repeating the 19 interaction and 13 unit rows.

## Task 11 Editorial checkpoint

- **Editorial.** The layout draws the shared title and standing blocks, numbered headings, Contents, the running head, rules, table tools and quick jump. Its plan labels do not enable an outline. It shares the alternate Contents and reveal implementations with Classic, with no phone chips and a narrower reveal scope. Figure controls stay available, but no preview control is drawn without a preview dialog. The [scrub audit](../../plans/parity-scrub-editorial.md) records the differences from the reference.
- **Evidence at `1a6091a`.** Chromium generated 54 Editorial snapshots and read back all 172 selected rows across the three layouts. No existing default or Classic snapshot moved in this task. Chromium passed 10 Editorial and 19 Classic interaction rows, 12 Editorial hosted appearances (including Headlines), and 38 cue rows. Layout unit tests (14), walls (16), type checking and build reproducibility passed. The [mutation record](../../plans/parity-mutations/task-11.md) has eight red JSON rows: Le-a through Le-g at this checkpoint and Le-d-review for the later cap re-measurement. The per-layout size judge accepts the control and rejects an in-memory Editorial padding of 59,484 characters, at 225,710 against 225,709.

The held-out review at `1a6091a` independently passed the 10 Editorial and 19 Classic interaction rows but requested four fixes: a discoverable modal Close control, hidden headings excluded from the active location, ordinary versus modified fragment activation distinguished, and ordered checklist steps counted in Editorial task labels.

The fix at `b66c242` leaves hidden headings linked while refreshing the spy's visible candidates on relayout. The Close control restores focus and remains part of the modal's focus trap; a modified link activation no longer dismisses it. Chromium measured seven red cases before the fixes, then passed all 19 rows in the Editorial file and 19 in the Classic file. Six new rail snapshots per layout gained only a hidden Close control. No base golden moved. The final Editorial cap probe used 58,440 characters of padding and again rejected 225,710 against 225,709. The held-out reviewer approved `b66c242` after independently passing both 19-row Chromium files.

## Task 14 size closeout

Landing A's merge (`1c2120d`) and B1 have the same five default frame entries. The table gives the new entries after B1's first review fix; sizes are in UTF-16 code units unless marked bytes.

| New frame asset | Characters added | Bytes added |
|---|---:|---:|
| Classic script | 142,503 | 142,512 |
| Classic stylesheet | 4,205 | 4,205 |
| Editorial script | 163,263 | 163,281 |
| Editorial stylesheet | 3,801 | 3,801 |
| **Total added** | **313,772** | **313,799** |

| Measure | Landing A | Landing B1 | B1 growth | X2 cumulative use | X2 share | X2 remaining |
|---|---:|---:|---:|---:|---:|---:|
| All assets | 4,571,331 | 4,885,103 | 313,772 | 327,101 | 1,166,336 | 839,235 |
| Largest single frame | 4,571,331 | 4,571,331 | 0 | 13,329 | 72,704 | 59,375 |

Classic uses 146,708 characters and Editorial 167,064, respectively 79,001 and 58,645 below the default enhance bundle's 225,709. Before the review fix the total was 4,885,513; the two stylesheet corrections remove 410 characters. The default frame is still the largest. The bootstrap remains at 118 global names and 32,740 of 32,768 bytes, leaving 28 bytes. Print mode is unchanged and is not part of these frame totals.

**Old-cap checks.** The 1.1.0 default cap is 114,569,828. The same fixture counts 114,554,779 at 1.1.0 asset lengths and 114,598,090 with current assets; with both maximum faces and the largest accepted appearance it is 114,949,117, below the unchanged derived cap of 116,224,259. The default row passed, and both alternate old-cap rows passed in the 47-test frame-layout run. The uncapped run of that file had 40 passes and an OOM kill with no assertion mismatch; the isolated bounded-heap retry passed. The sealed boot run passed 43 Chromium rows, with 43 WebKit rows skipped. Its wrapper also reported a slice-wide kill during an overlapping test run; the boot command itself exited zero.

**P14a.** Move the Classic stylesheet's 4,205 characters into the shared stylesheet in an in-memory manifest, keeping the measured landing row. The size judge accepts the control. It computes the same `total` of 4,885,103 but a `frame` of 4,575,536 and rejects the mutant: "the rule: the newest growth row is not the recomputation from the judged commit" (exit 1). No shipped asset or table is changed by the probe. The [Task 14 mutation record](../../plans/parity-mutations/task-14.md) holds the table and machine-readable rows.

## Whole-suite and package gate

- First full local Chromium run: exit 137 after the test slice hit its memory cap, with no reported assertion mismatch. This landing's first-suite signal is `red`; the run gave no complete suite verdict.
- The single bounded-heap retry also exited nonzero: 6,642 passed, one assertion failed, 805 skipped, eleven worker errors, and a failed frame-items setup (`esbuild` EPIPE). The wrapper reported memory kills and a worker also exhausted its bounded heap. No third full local run was attempted.
- The assertion failure was `test/pack.test.ts` → “holds nothing else: no references, scripts, sources, tests, CI files or working papers”. The list permitted the alternate feature graphs and mark but not eight compiled files for the implemented layout modules. The fix names the files' exact module stems; it makes no change to build output or public exports. All 15 isolated package and installed-consumer tests passed after the fix. The first-suite signal remains `red`.
- The measured growth row passed all five size-contract checks against landing A. The conformance ratchet kept all 47 verdicts and 18 hostile layout cases, with no golden or existing layout snapshot moves. Type checking and frame build reproduction passed after the review fix.
- Final isolated Chromium checks passed: frame items 3 (no setup error), selected sealed frame boot 3, corpus read-back 172, hosted appearances 24 across Classic and Editorial, and non-colour cues 38. WebKit remains a CI check.

## Task 14 CI fix round: waiting-callout cue

At `9f4bee4`, [both CI jobs](https://github.com/Synapsium-Labs/docserver/actions/runs/44945053429) failed only the two new WebKit waiting-callout pixel assertions; each job reported 7,693 passed and five skipped. The rule and the exact expected pixel result were both 3 px.

| CI job | Classic measured → rounded | Editorial measured → rounded |
|---|---:|---:|
| Node 22 | 2.582 → 2.5 px | 1.126 → 1 px |
| Node 24 | 1.268 → 1.5 px | no detectable run |

The sampler scrolled the callout into view and captured it after two animation frames, without waiting for the 550 ms reveal to finish. In a controlled Chromium probe the real border computed to 3 px throughout. At opacity 0.185 the sampler found no run; at opacity 0.683 it measured 2.036 px; at opacity 1 with no transform it measured exactly 3 px in both layouts. That reproduces the early-sampling mechanism, not the exact WebKit timing: local WebKit could not launch because host libraries were missing.

Only the two alternate-layout assertions now scroll the callout into view and wait for any pending reveal to enter, the callout's own animations to settle, and computed opacity 1 with no transform. The test still measures painted pixels with the original sampler and exact `[3]` assertion. No cue rule or production reveal changed.

| Chromium probe | Classic | Editorial |
|---|---|---|
| Five-second reveal, omit the settle wait | No run; red at `[3]` | No run; red at `[3]` |
| Settled reveal, narrow the border to 2 px | 2 px; red at `[3]` | 2 px; red at `[3]` |
| Unchanged border with settle wait | 3 px; green | 3 px; green |

With the wait restored, both cases also passed with the five-second reveal. Both temporary mutations were removed. The Chromium file selection passed all 38 tests. On `4330023`, all 76 cue tests passed in both browser engines on Node 22 and Node 24, and passed again in the Node 22 rerun.

## Task 14 CI fix round: B8.2 scroll reset

The [first CI attempt on `4330023`](https://github.com/Synapsium-Labs/docserver/actions/runs/44948883424/attempts/1) passed Node 24 (7,695 passed, five skipped), but Node 22 failed WebKit B8.2 in `test/browser/frame-one-bar.test.ts`. The [unchanged-head Node 22 rerun](https://github.com/Synapsium-Labs/docserver/actions/runs/44948883424/attempts/2) had the same sole failure (7,694 passed, five skipped). In both attempts, after the initial hash landed, `scrollTo` was supposed to put the target more than 300 px below the top before the test clicked its link. Instead the wait timed out after 30 seconds at `top: 13.828125` with `barH: 0px`. The test had also failed intermittently in the rename's main-line run and Landing A at `3268fcd`.

The cue file completed before the frame file in both Node 22 attempts and in the passing Node 24 job. The two files passed in that order in local Chromium (38 and 14 tests, respectively, on local Node 24). The cue harness opens and closes a fresh browser context for every document; each B8.2 mount has its own fresh context too. The settle wait adds no listener and does not change `scroll-behavior`. The measured order and those isolation boundaries do not support a scroll-state leak between the files.

The initial hash installs a temporary pin so that layout changes keep the target aligned. The test's programmatic scroll does not release this pin, so a resize or relayout can reapply the hash landing. In a controlled Chromium run, temporarily adding 100 px of bottom padding to the reader root just after the reset triggered this sequence:

| Sample | Window scroll Y | Target top |
|---|---:|---:|
| Initial hash landing | 5,214 px | 13.71875 px |
| Immediately after reset | 0 px | 5,227.71875 px |
| After resize callbacks | 5,214 px | 13.71875 px |

The original B8.2 assertion timed out at the last position. With Home sent to the focused frame before the reset, the same probe passed: the reader action releases the pin before the programmatic scroll. This reproduces the failure shape in Chromium, not the exact WebKit scheduling. The temporary padding and instrumentation were removed. The test now waits for actual window scroll position zero and keeps every previous assertion, including the target threshold and both link landing positions. No production source, style, or cue test changed in that round. [CI at `7e0e60c`](https://github.com/Synapsium-Labs/docserver/actions/runs/44956945495) passed B8.2 and both exact painted cues in Chromium and WebKit on Node 22 and Node 24 (7,695 passed and five skipped on each job).

## B1 review fix round 1

Both alternate drawers now use the hosted Close control-row size only for a fine pointer. Chromium with a coarse pointer measured 56 px before the fix and 44 px after it; with a fine pointer the same Close button followed the hosted 40 px and 56 px values. The stylesheet walk now checks the rule in each alternate's own CSS. Neither this fix nor the stricter corpus guards changed a snapshot.

The per-layout corpus no longer skips a shipped layout whose snapshot directory is missing. The ratchet refuses deletion of a per-layout hostile snapshot even with a correctly named trailer; an edit still needs its exact per-layout trailer. In the boundary check an unreachable condition was removed: the immediate parent already belongs to the set of earlier entries. The newest entry must equal the values computed now, which records every shipped layout; no parent-policy comparison is made for a layout without a parent.

The review found earlier snapshot additions and regenerations without precise trailers. History was not rewritten; the plan's B1 Results lists the gaps. The round's changes do not move any existing golden or snapshot.

The first review fix re-measured T0a–T0d. The writes-only regression uses real scans with equal reads and different writes, at both helper and build level; it replaced the synthetic assertion. The [Task 0 record](../../plans/parity-mutations/task-0.md) retains both measurements and notes the incomplete T0b-FR1 run.

The round's local gate passed 40 cue, 21 Editorial-file, 19 Classic-file and 173 corpus rows in Chromium. The corpus command exited zero, though the test wrapper also reported memory kills in the shared test slice. The frame build (49 tests), frame layouts (47), frame boundaries (22), ratchet (56), README (47), type check and frame reproducibility check passed. Both CI jobs at `7b3ce78` failed only the stale changelog hash assertion. Updating the two stylesheet hash bullets, without changing a test or asset, passed all 23 package checks locally. [CI at `c1d085f`](https://github.com/Synapsium-Labs/docserver/actions/runs/44966384939/attempts/1) then passed 7,705 tests with five skipped on each Node leg, including the pointer cases, the exact 3 px painted cues and B8.2 in Chromium and WebKit.

## B1 review fix round 2

The ratchet stayed green with its redundant shared-case filter removed: the two-part shared ID cannot match a three-part alternate ID. The per-layout hostile-deletion loop and exact-trailer check remain. The corpus test that repeated the module-load result was removed; its missing-directory failure case remains. The boundary file relies on "the newest entry equals the values computed now" to require every shipped layout in the newest entry. The parent-policy comparisons for established layouts are unchanged.

The three affected files stayed green with the deletions: ratchet 56, frame boundaries 22, and the Chromium corpus 172 with 165 WebKit rows skipped. The five file-edit probes in the [Task 14 record](../../plans/parity-mutations/task-14.md) reproduced their expected assertion failures before the deletions; the saved and restored SHA-256s matched for each. The round changes no shipped asset, conformance record or growth row.
