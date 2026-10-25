# L2 Task 18: partial marks mutation journal

This is a partial journal, measured 2026-10-21 against the frozen working snapshot. It records only the independently measured guards in `src/enhance/marks.ts`; it is not a Task 18 completion claim.

## Method and frozen input

The documented Task 1 Step 8 runner is not present in this checkout. The historical M1--M15 runner made a fresh copy per row, but linked the checkout's live `node_modules` and recopied the live tree for each invocation. Its `17 passed` control and recorded outcomes remain historical measurements, not a proof that every row shared one frozen dependency snapshot. The link/copy limitation is provenance only; it is not evidence of interference. A run with no exit status would be `KILLED`, neither red nor green; none was killed.

For this correction, one complete snapshot was frozen before the control: source, tests, configuration, lockfiles, and a copied `node_modules` tree (the package manager's relative `.bin` links remained internal to that copied tree). The manifest covers 15,112 regular files. Each control or exact one-occurrence mutant was copied from that one snapshot, run in the foreground with `timeout 600 ./node_modules/.bin/vitest run test/enhance-marks.test.ts --maxWorkers=2`, logged, then removed. The mechanically compatible local runner and full private logs are retained outside the repository. The updated control was green: `1 passed`, `21 passed`. The frozen source, assigned test, package metadata, lockfile, Vitest configuration, and TypeScript configuration hashes are recorded with that evidence; no test downloads or network access were used.

The historical source was an uncommitted `marks.ts` snapshot and the assigned test was untracked. Its watched source/test hashes and status fingerprints were unchanged after the historical copies were removed. The correction adds permanent narrow tests, so its 21-test control is a new measurement, not a retroactive repair of the historical 17-test provenance.

## Measured marks guards

A red result below means an observed behavioral regression. Most are ordinary assertion failures. M2 is separately classified because it reaches a runtime `TypeError`; M10 is separately classified because duplicate mark-slot registration aborts `enhance()` with `EnhanceError` before the test assertion. Neither is a runner or import failure. Test names are abbreviated only in this table; private evidence retains each complete log.

| Row | Guard | Outcome |
|---|---|---|
| L2-T18-M1 | document roots build marks | RED: 17 failed; ordinary mark-count assertions failed. The inverse mutation does not directly exercise a non-document root, so that branch remains scoped pending. |
| L2-T18-M2 | malformed stored shape is rejected | Fresh applied replay: the exact substitution reaches `Object.entries(null/undefined)`, producing a runtime `TypeError` wrapped in startup `EnhanceError`: 11 failed, 10 passed. This is neither an ordinary assertion red nor a runner/import failure. |
| L2-T18-M3 | stored entries are bounded by measured units | RED: 1 failed, `rejects restored records with more entries than its measured units`. |
| L2-T18-M4 | stored fingerprints are strings | Historical RED: 3 failed after the inverse `string` -> `number`; this is not removal coverage. The exact removal is measured separately as M16. |
| L2-T18-M5 | stored fingerprints do not exceed the hash bound | Historical RED: 2 failed after a stricter-than-production bound; this is not removal coverage. The exact removal is measured separately as M18. |
| L2-T18-M6 | unknown ids are excluded | Historical RED: 3 failed after rejecting every id; this is not removal coverage. The exact removal is measured separately as M19. |
| L2-T18-M7 | only outlineable plans supply task units | RED: 1 failed, `keeps section marks when short task plans do not take outline mode`. |
| L2-T18-M8 | non-holder sections remain beside long-plan task marks | RED: 1 failed, `keeps non-holder sections alongside task marks on a long plan`. |
| L2-T18-M9 | the `.short` walk is bounded by this root | RED: 1 failed, `does not let a host short class suppress marks inside its root`. |
| L2-T18-M10 | a task heading is deduplicated and kept in document order | RED: duplicate mark-slot registration raises `EnhanceError` during `enhance()`; this is a genuine behavioral startup regression, not an assertion failure. |
| L2-T18-M11 | equal stored and source fingerprints mean read | RED: 5 failed, including read/changed, pruning, special ids, source fingerprint, and long-plan reload assertions. |
| L2-T18-M12 | an empty mark map writes null | Historical RED: 4 failed after reversing the branch condition; this is not removal coverage. The exact removal is measured separately as M17. |
| L2-T18-M13 | persisted records use a null prototype | RED: 1 failed, `round-trips own __proto__ and constructor ids without changing a prototype or interpolating ids`. |
| L2-T18-M14 | refresh follows storage only while live | Historical GREEN: 17 passed; retained as history. The updated direct liveness witness is measured separately. |
| L2-T18-M15 | `m` acts only on the current marked spy unit | Historical GREEN: 17 passed; retained as history. The updated spy-plus-key witness is measured separately. |
| L2-T18-M16 | stored fingerprints must be strings | RED: exact removal (`typeof fingerprint === 'string'` -> `true`) makes a `{ length: 1 }` record value display Changed rather than ignore it. |
| L2-T18-M17 | empty mark map writes null | RED: exact removal (`if (marks.size === 0)` -> `if (false)`) persists `{}` after toggling the last mark off. |
| L2-T18-M18 | restored fingerprint length is bounded | RED: exact removal (`fingerprint.length <= FINGERPRINT_MAX_LENGTH` -> `true`) restores an over-bound fingerprint as Changed. |
| L2-T18-M19 | restored ids must name measured units | RED: exact removal (`units.has(id)` -> `true`) preserves unknown ids on write. |
| L2-T18-M14-retest | refresh follows storage only while live | RED: the permanent test's synchronous storage callback makes `ctx.live()` false; removal refreshes the stale control to Read. |
| L2-T18-M15-retest | `m` routes to the current valid marked spy unit | RED: after a real spy event selects the second heading, `condition` -> `false` leaves it unread and does not prevent the key's default. This proves positive valid-unit routing only. |

## Rows for the isolated mechanical runner

```json
[
  {
    "id": "L2-T18-M1",
    "guard": "marks build only for a document root",
    "file": "src/enhance/marks.ts",
    "old": "  if (!ctx.info.isDocument) return;",
    "new": "  if (ctx.info.isDocument) return;",
    "tests": "test/enhance-marks.test.ts"
  },
  {
    "id": "L2-T18-M2",
    "guard": "a stored mark record must be a non-null non-array object",
    "file": "src/enhance/marks.ts",
    "old": "  if (typeof value !== 'object' || value === null || Array.isArray(value)) return marks;",
    "new": "  if (false) return marks;",
    "tests": "test/enhance-marks.test.ts"
  },
  {
    "id": "L2-T18-M3",
    "guard": "a restored mark record cannot exceed its measured units",
    "file": "src/enhance/marks.ts",
    "old": "  if (entries.length > units.size) return marks;",
    "new": "  if (false) return marks;",
    "tests": "test/enhance-marks.test.ts"
  },
  {
    "id": "L2-T18-M4",
    "guard": "a restored fingerprint must be a string",
    "file": "src/enhance/marks.ts",
    "old": "typeof fingerprint === 'string'",
    "new": "typeof fingerprint === 'number'",
    "tests": "test/enhance-marks.test.ts"
  },
  {
    "id": "L2-T18-M5",
    "guard": "a restored fingerprint is no longer than a uint32 base-36 hash",
    "file": "src/enhance/marks.ts",
    "old": "fingerprint.length <= FINGERPRINT_MAX_LENGTH",
    "new": "fingerprint.length < FINGERPRINT_MAX_LENGTH",
    "tests": "test/enhance-marks.test.ts"
  },
  {
    "id": "L2-T18-M6",
    "guard": "only marks for current unit ids are restored",
    "file": "src/enhance/marks.ts",
    "old": "units.has(id)",
    "new": "false",
    "tests": "test/enhance-marks.test.ts"
  },
  {
    "id": "L2-T18-M7",
    "guard": "task units exist only when the plan is outlineable",
    "file": "src/enhance/marks.ts",
    "old": "ctx.plan.outlineable\n    ?",
    "new": "true\n    ?",
    "tests": "test/enhance-marks.test.ts"
  },
  {
    "id": "L2-T18-M8",
    "guard": "long-plan task-holder sections do not take an additional section mark",
    "file": "src/enhance/marks.ts",
    "old": " && !holders.has(section.heading)",
    "new": "",
    "tests": "test/enhance-marks.test.ts"
  },
  {
    "id": "L2-T18-M9",
    "guard": "the short-box ancestor walk stops at this enhancement root",
    "file": "src/enhance/marks.ts",
    "old": "parent !== null && parent !== root",
    "new": "parent !== null",
    "tests": "test/enhance-marks.test.ts"
  },
  {
    "id": "L2-T18-M10",
    "guard": "a heading shared by a task and section gets one mark in document order",
    "file": "src/enhance/marks.ts",
    "old": "[...new Set([...sectionByHeading.keys(), ...taskByHeading.keys()])]",
    "new": "[...sectionByHeading.keys(), ...taskByHeading.keys()]",
    "tests": "test/enhance-marks.test.ts"
  },
  {
    "id": "L2-T18-M11",
    "guard": "a stored fingerprint equal to the current source fingerprint is read",
    "file": "src/enhance/marks.ts",
    "old": "mark === fingerprints.get(heading.id)",
    "new": "mark !== fingerprints.get(heading.id)",
    "tests": "test/enhance-marks.test.ts"
  },
  {
    "id": "L2-T18-M12",
    "guard": "an empty mark map is pruned by storing null",
    "file": "src/enhance/marks.ts",
    "old": "if (marks.size === 0)",
    "new": "if (marks.size !== 0)",
    "tests": "test/enhance-marks.test.ts"
  },
  {
    "id": "L2-T18-M13",
    "guard": "persisted mark records use a null prototype for special heading ids",
    "file": "src/enhance/marks.ts",
    "old": "Object.create(null)",
    "new": "{}",
    "tests": "test/enhance-marks.test.ts"
  },
  {
    "id": "L2-T18-M14",
    "guard": "a toggle refreshes only while the enhancement remains live after storage",
    "file": "src/enhance/marks.ts",
    "old": "if (ctx.live()) refresh();",
    "new": "if (true) refresh();",
    "tests": "test/enhance-marks.test.ts"
  },
  {
    "id": "L2-T18-M15",
    "guard": "the m key routes only the active marked spy unit",
    "file": "src/enhance/marks.ts",
    "old": "unit !== null && controls.has(unit)",
    "new": "false",
    "tests": "test/enhance-marks.test.ts"
  },
  {
    "id": "L2-T18-M16",
    "guard": "a restored fingerprint must be a string",
    "file": "src/enhance/marks.ts",
    "old": "typeof fingerprint === 'string'",
    "new": "true",
    "tests": "test/enhance-marks.test.ts"
  },
  {
    "id": "L2-T18-M17",
    "guard": "an empty mark map is pruned by storing null",
    "file": "src/enhance/marks.ts",
    "old": "if (marks.size === 0)",
    "new": "if (false)",
    "tests": "test/enhance-marks.test.ts"
  },
  {
    "id": "L2-T18-M18",
    "guard": "a restored fingerprint is no longer than a uint32 base-36 hash",
    "file": "src/enhance/marks.ts",
    "old": "fingerprint.length <= FINGERPRINT_MAX_LENGTH",
    "new": "true",
    "tests": "test/enhance-marks.test.ts"
  },
  {
    "id": "L2-T18-M19",
    "guard": "only marks for current unit ids are restored",
    "file": "src/enhance/marks.ts",
    "old": "units.has(id)",
    "new": "true",
    "tests": "test/enhance-marks.test.ts"
  }
]
```

## Scoped unmeasured and gaps

- The direct non-document-root branch is not covered by the assigned marks tests; M1 only proves that suppressing normal document construction is observable.
- M2's fresh exact substitution reaches `Object.entries(null/undefined)` and produces a runtime `TypeError` wrapped in startup `EnhanceError` (11 failed, 10 passed), not a runner/import failure or ordinary assertion red. This crashing result is not non-crashing malformed-record removal coverage.
- M14 and M15's historical greens are retained as historical results. The new M14 witness establishes its stated liveness case. M15's `condition` -> `false` retest establishes positive routing to a valid current marked unit, but does not establish the `controls.has(unit)` exclusion: exact deletion to `unit !== null` and whole-condition -> `true` each leave all 21 tests green. The older 17-test runs are not rebranded.
- The `changes` event listener is absent from the frozen `marks.ts` snapshot; there is no actual marks changes-event implementation or guard to mutate, so this journal makes no such claim.
- Rail, drawer, overlay, roving-selection, browser, visual, and performance guards are intentionally pending to their active owners and are not measured here.

## Correction evidence

The correction's one-snapshot control and six focused mutants all used the same copied dependency tree. The control is green at 21/21. M16--M19 and the new M14 witness each fail one or more behavioral assertions when their exact guard is removed. M15's `condition` -> `false` mutant fails its positive-routing assertion; the independently replayed `controls.has(unit)` deletion and whole-condition -> `true` mutant each remain green at 21/21, so this journal does not claim exclusion-guard removal coverage. These logs, the exact runner, input hashes, and whole-journal public scan are private evidence outside this repository. The public journal contains only the reproducible command, substitutions, outcomes, and the limitation of the older per-case live-copy/link method.
