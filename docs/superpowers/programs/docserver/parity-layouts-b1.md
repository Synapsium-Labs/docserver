# X2 layout additions, landing B1: notes for the plan and ledger

This note supplements the [landing A notes](parity-additions.md). Use it for Design §3 and Results of the [library plan](../../plans/2026-11-20-docserver-parity-additions.md); the existing plan and ledger are not edited by this landing.

## Design §3: split and frame construction

- **Split.** B1 carries the build-check fix (Task 0), layout infrastructure (Task 9), `classic` (Task 10), `editorial` (Task 11), and the first size and documentation closeout (Task 14). B2 starts at merged B1 and adds `review` and `guided` (Tasks 12 and 13), with its own Task 14 closeout. The infrastructure alone originally touched 41 files; adding all four layouts adds 216 snapshots. Two real layouts exercise the infrastructure without shipping placeholders. Each landing has one `x2` growth row. No release or version change here.
- **One entry, one feature list.** Each alternate bundle uses the same entry as `default`. The layout plugin substitutes only the lifecycle's `./features.js` import and requires exactly one substitution. The default build uses no plugin. The bootstrap global list comes from the four base scripts; the final scan includes the alternate bundles and fails if a layout reads a name the base did not pin.
- **One layout per document.** The frame validates the chosen script and, where required, the layout stylesheet against their own manifest entries before inlining either. The stylesheet follows the shared reader CSS after one newline within the existing style element. The default gains no newline; the guard and bootstrap see the same element order. Only scripts have CSP hashes. The existing `style-src 'unsafe-inline'` is unchanged; there is no layout stylesheet hash in the policy. The sandbox, bridge version, operations and channels are unchanged.
- **Pins.** `frameCsp()` and `frameCsp('default')` match the previous default policy byte for byte. Two fixtures pin the entire default srcdoc against hashes measured at landing A before the change. Each alternate layout inlines only its own enhance bundle and layout stylesheet. `maxSrcdocChars(layout)` uses the selected assets along with the unchanged seed and hosted face bounds. `MAX_SRCDOC_CHARS_DEFAULT` remains 116,224,259.

## Results through Task 9

- **Task 0.** The two bootstrap scans compare sorted free-global reads and writes, not local alias spellings. No change to the exact-once embedding check, list comparison, allowlist or byte cap. The [mutation record](../../plans/parity-mutations/task-0.md) contains four red rows. The 48-test file passed once under the heap cap; subsequent restored-byte runs killed without assertion mismatches yielded no verdict. The restored build passed its reproducibility check.
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
- **Evidence at `1a6091a`.** Chromium generated 54 Editorial snapshots and read back all 172 selected rows across the three layouts. No existing default or Classic snapshot moved in this task. Chromium passed 10 Editorial and 19 Classic interaction rows, 12 Editorial hosted appearances (including Headlines), and 38 cue rows. Layout unit tests (14), walls (16), type checking and build reproducibility passed. The [mutation record](../../plans/parity-mutations/task-11.md) contains seven red rows. The per-layout size judge accepts the control and rejects an in-memory Editorial padding of 59,484 characters, at 225,710 against 225,709.

The held-out review at `1a6091a` independently passed the 10 Editorial and 19 Classic interaction rows but requested four fixes: a discoverable modal Close control, hidden headings excluded from the active location, ordinary versus modified fragment activation distinguished, and ordered checklist steps counted in Editorial task labels.

The fix at `b66c242` leaves hidden headings linked while refreshing the spy's visible candidates on relayout. The Close control restores focus and remains part of the modal's focus trap; a modified link activation no longer dismisses it. Chromium measured seven red cases before the fixes, then passed all 19 rows in the Editorial file and 19 in the Classic file. Six new rail snapshots per layout gained only a hidden Close control. No base golden moved. The final Editorial cap probe used 58,440 characters of padding and again rejected 225,710 against 225,709. The held-out reviewer approved `b66c242` after independently passing both 19-row Chromium files.

## Task 14 size closeout

The committed manifests at `b66c242` and landing A have the same five default entries. New entries are listed below; sizes are in UTF-16 code units unless marked bytes.

| New frame asset | Characters added | Bytes added |
|---|---:|---:|
| Classic script | 142,503 | 142,512 |
| Classic stylesheet | 4,409 | 4,409 |
| Editorial script | 163,263 | 163,281 |
| Editorial stylesheet | 4,007 | 4,007 |
| **Total added** | **314,182** | **314,209** |

| Measure | Landing A | Landing B1 | B1 growth | X2 cumulative use | X2 share | X2 remaining |
|---|---:|---:|---:|---:|---:|---:|
| All assets | 4,571,331 | 4,885,513 | 314,182 | 327,511 | 1,166,336 | 838,825 |
| Largest single frame | 4,571,331 | 4,571,331 | 0 | 13,329 | 72,704 | 59,375 |

Classic uses 146,912 characters and Editorial 167,270, respectively 78,797 and 58,439 below the default enhance bundle's 225,709. The default frame is still the largest. The bootstrap remains at 118 global names and 32,740 of 32,768 bytes, leaving 28 bytes. Print mode is unchanged and is not part of these frame totals.

**Old-cap checks.** The 1.1.0 default cap is 114,569,828. The same fixture counts 114,554,779 at 1.1.0 asset lengths and 114,598,090 with current assets; with both maximum faces and the largest accepted appearance it is 114,949,117, below the unchanged derived cap of 116,224,259. The default row passed, and both alternate old-cap rows passed in the 47-test frame-layout run. The uncapped run of that file had 40 passes and an OOM kill with no assertion mismatch; the isolated bounded-heap retry passed. The sealed boot run passed 43 Chromium rows, with 43 WebKit rows skipped. Its wrapper also reported a slice-wide kill during an overlapping test run; the boot command itself exited zero.

**P14a.** Move the Classic stylesheet's 4,409 characters into the shared stylesheet in an in-memory manifest, keeping the measured landing row. The production size judge accepts the control. It computes the same `total` of 4,885,513 but a `frame` of 4,575,740 and rejects the mutant: "the rule: the newest growth row is not the recomputation from the judged commit" (exit 1). No shipped asset or table is changed by the probe.

## Process notes

- Task 0 and Task 9 each had an edit applied through a script instead of a file-editing tool. Task 9's split cleanup repeated this on mechanical deletions in ten files before switching to the file tools. The changes were checked in the diffs. A Task 9 commit message was corrected before pushing. The pack test's allowlist and count had not been checked in the first infrastructure pass; the review fix corrected them and ran the test.
- The graph gate initially refused a search pending one read-only graph query. The coordinator confirmed that query was the gate's own route. Later, an account guard refused an environment-listing attempt; the implementer stopped, and the call did not run. Two attempts to report it were also refused because the mail text was embedded in the shell command. On the coordinator's instruction, no command lists the environment and prose is passed from files, not embedded in shell commands.
- A session restart stopped the first classic implementer before any edits or measurements. The replacement continued from the same checked Task 9 tip; no committed work was lost.
- During classic's corpus pass, the role guard refused a subagent's attempt to load a worker skill. Nothing ran and the subagent stopped. The coordinator directed the work to resume with skills and mail in the main session only; the refused call was not retried.
- A later claim-list usage error stopped locally, without a server request. The coordinator clarified that a local syntax error is not a refusal; the documented read-only list confirmed both existing claims before Editorial.
