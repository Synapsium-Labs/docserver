# docserver release readiness: the old-cap gate and the carried follow-ups: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task by task. Each task is an implementer subagent (tests first where a test is the deliverable), then one review over the task's diff. The plan is lean: it holds no implementation code, only the contract each task must meet, its evidence and its mutation rows.

**Status:** Written 2026-11-22, from the library's `main` at `8165292` (landing B2, [PR #90](https://github.com/Synapsium-Labs/docserver/pull/90)). One pull request; no version bump, tag, publish, repository setting or user-facing setting. The release and its signed tag are the operator's separate step.

**Goal:** The evidence the library's contract release waits on: the old-cap browser mount measured on Chromium and WebKit (the release gate), the test-only carries closed (the layout colour scan, RF3's timing ratio), and a measured disposition for each remaining product and contract carry of landings A, B1 and B2.

**Spec:** the first consumer's public designs: [appearance continuity](https://github.com/Synapsium-Labs/ccrc-pwa/blob/main/docs/superpowers/specs/2026-11-18-native-docs-appearance-continuity-design.md) §9 (budgets) and §10 tests 7 and 8, as amended by ccrc D-8824; [parity](https://github.com/Synapsium-Labs/ccrc-pwa/blob/main/docs/superpowers/specs/2026-11-18-native-docs-parity-design.md) §6. The carries are listed in the landing notes: [`appearance-contract.md`](../programs/docserver/appearance-contract.md), [`parity-additions.md`](../programs/docserver/parity-additions.md), [`parity-layouts-b1.md`](../programs/docserver/parity-layouts-b1.md) and [`parity-layouts-b2.md`](../programs/docserver/parity-layouts-b2.md). Those records are baselines, not new measurements.

**Ledger:** this wave writes no ledger entry. Its notes go to a new file, [`docs/superpowers/programs/docserver/release-readiness.md`](../programs/docserver/release-readiness.md), which the coordinator folds in.

---

## Design

### In short

- **The gate is an opt-in input of `ci.yml`, off by default.** `workflow_dispatch` gains one boolean input; a separate job runs only on a dispatch of `ci.yml` itself with that input true. Pull requests, pushes to `main` and the release workflow's call never start it, and the `test` job, its matrix, its steps and the token stay as they are.
- **The gate job runs the existing measured row and nothing weaker.** One leg per browser (Chromium and WebKit) on a GitHub-hosted runner, `DOCREADER_MEASURE=1`, the row in `test/browser/frame-appearance.test.ts` unchanged. A checker reads the run's JSON report and fails the leg unless that row ran in that browser and passed: a skip, a filter that matched nothing or a missing report is unmeasured, never a pass.
- **Test-only carries are closed in the tests, not in the sheets.** The colour scan reads every block's own declarations, nesting parents included, values only, and knows the deprecated system colours. RF3 is reproduced before anything changes.
- **Product and contract carries get evidence, not new contracts.** Each is fixed only where a measurement backs a change that keeps the text, the selection behaviour and the wire; otherwise its record names the user-visible consequence, the evidence and the smallest next step.

### 1. Where the gate runs

The shared test slice of the box that builds this library has a 6 GB memory cap, and the old-cap mount was killed there twice (ccrc D-8824). WebKit does not launch on that box at all. A GitHub-hosted runner gives each job its own machine, so both browsers run there, one job each, in parallel. A dispatch of `ci.yml` also runs the ordinary `test` job on both Node legs, so the same run carries the always-on 1.4 MiB browser row and the full-size Node framing row at the same tip; neither stands in for the gated mount.

### 2. What the gate does not cover

The measured row is the one D-8824 defines: the default layout, mounted through the library page's `./host`, without the snapshot and the 64 Mermaid secure keys. It is not a full mount at the cap. The four other layouts frame the same document in Node (`test/frame-layouts.test.ts`) and are not mounted at this size in a browser. The record says so.

## Global Constraints

Binding on every task:

- **Public-ready** text in every tracked file, commit message and PR body: no product, host, person, account or private repository names, no local paths, no tracker ids. The consumer is "the first consumer", its design cited by its public GitHub path, its departures as "ccrc D-n" only.
- **No asset, golden or snapshot moves.** No layout stylesheet, `src/` file or frame asset changes for a test-only carry. The one exception is Task 5's repair, as amended (the coordinator's ruling). `node scripts/build-frame.mjs --check` stays green and `assets/assets.json` and `src/frame/manifest.generated.ts` do not move. A move is a stop-and-ask.
- **Required CI stays as it is:** the `test` job's name, matrix, timeout, steps and env; the `workflow_call` with no inputs and no secrets; `permissions: contents: read` with no job widening it; every remote action pinned by full commit sha with its tag in a trailing comment; no local `uses:` in `ci.yml`.
- **Tests** run through the fleet's test wrapper, `ccrc test -- ./node_modules/.bin/vitest run --maxWorkers=2 <file>`, one file at a time, foreground. Browser rows locally with `DOCREADER_BROWSERS=chromium`; WebKit runs only on GitHub's runners. Never `DOCREADER_MEASURE=1` on the shared slice.
- **No timing gates added, no threshold widened, no blind retry.** A new browser row waits on a deterministic condition. Timing figures are printed, not asserted, unless an existing bound is kept as it is.
- **Mutation discipline.** Every new guard ships with a case that goes red without it, measured in place one row at a time (bytes saved and sha256 checked on restore; never `git checkout`, `git stash` or `reset --hard`). Rows go in `docs/superpowers/plans/readiness-mutations/task-<n>.md` (a table, then its JSON fence). A row that stays green gets a new case or is recorded as an equivalent mutant with its reason.
- **Commits.** Files staged by name; subject `<area>: <what> (docserver readiness T<n>)`; `Goldens-moved: none` and `Layout-moved: none` trailers when nothing moved; the writer's `Co-Authored-By:` trailer.

## Tasks

### Task 1: The release gate's opt-in input

**Files:** `.github/workflows/ci.yml`, a gate checker under `scripts/`, its unit test, `test/ci-workflow.test.ts` (and `test/release-workflow.test.ts` only if a pin there reads `ci.yml`'s triggers).

**Contract:**

1. `on.workflow_dispatch.inputs` gains one boolean input, default `false`, whose description says it runs the old-cap browser mount (ccrc D-8824) on Chromium and WebKit. `workflow_call` keeps no inputs and no secrets.
2. A new job, separate from `test`, runs only when all hold: the event is `workflow_dispatch`, the running workflow is `ci` (a called run reports the caller's), and the input is true. Its matrix is the two browsers, `fail-fast: false`. It names no `permissions` of its own, so it keeps the read-only token.
3. Its steps: checkout and Node setup with the same pinned actions as `test` (Node 22); `npm ci`; the pinned playwright-core's install of that leg's browser with its system libraries, bounded by `timeout`; then the measured row alone, `DOCREADER_MEASURE=1` and `DOCREADER_BROWSERS=<leg>`, through `./node_modules/.bin/vitest run test/browser/frame-appearance.test.ts` filtered to that row's name, writing a JSON report; then the checker. A heap ceiling for the test process is set high enough for the runner (the row holds the srcdoc several times). Timeout minutes cover the install and the row's own 20-minute test timeout with headroom.
4. The checker (a script with no dependency) reads the JSON report and the browser name and exits non-zero, with a one-line reason, unless exactly one test whose name is the measured row's, under that browser, has status `passed`. A skipped, pending, todo or failed row, no such row, more than one, or a missing or unreadable report is refused, and the reason says "unmeasured" for every case that is not a completed failure.
5. Pins in `test/ci-workflow.test.ts`: the input exists, is boolean and defaults to false; the job's condition is exactly the three-part one; the job runs the row with the measure switch and that one test file, then the checker on the report; no step of the new job is a bare `npx vitest`; the token is not widened; existing pins that said "the only job" or "never narrows the browsers" are scoped to the `test` job and still hold for it.
6. Unit cases for the checker cover each refusal and the one pass, each red when its branch of the checker is removed (mutation rows).

**Evidence:** the pins and checker tests pass; `release-workflow.test.ts` passes unchanged.

### Task 2: The colour scan reads nesting parents and knows the deprecated system colours

**Files:** `test/enhance-layouts.test.ts` only (and its mutation record).

**Contract:** the scan in "the layouts' stylesheets" block finds a literal colour in every declaration of the sheet, at any nesting depth: a nesting parent's own declarations before, between and after its nested rules are read. A prelude (a selector, `&`-selector or at-rule before `{`) is never read. Only a declaration's value is read, never its property name. The list gains the deprecated CSS system colours of CSS Color 4 (`ActiveBorder` to `WindowText`), with a pinned count. The existing behaviour stays pinned: comments, strings and `url()` are no colour; a custom property's name or a `var()` reference is none; a custom property's value and a `var()` fallback are read; the 148 named colours and the current system colours are matched without regard to case. New plants: a nesting parent's colour turns the row red; a deprecated system colour turns it red; a colour word in a nested selector, an `&` prelude or a comment is not reported; a property whose name is a deprecated system colour's word is not reported. Every real layout sheet passes unchanged. If a real sheet's value uses one of the new words as a non-colour keyword (a property name in `transition`, say), that is reported to the controller, not hidden.

**Evidence:** mutation rows for each new guard; the real sheets' hashes unchanged.

### Task 3: RF3's timing oracle

**Files:** `test/enhance-plans-rf3.test.ts` only if a change is shown robust; scratch harnesses outside the tree.

**Contract:** find which comparison of the oracle fails (the build budget, the toggle budget, the build ratio or the toggle ratio) from the CI logs of the recorded failures and from repeated local runs on Node 24 and Node 22, and why (warm-up order, collection, batch length, the minimum's sample count). Change nothing before that is measured. A change keeps the signal (a cost that grows faster than the plan reds; an absolute budget that catches a slow build stays) and is accepted only when repeated runs show the drift gone and a planted superlinear cost still red. No threshold widened, no retry. If no robust change is shown, the record holds the disposition with the measurements.

### Task 4: Print runs and the refusal budget

**Files:** host-side tests (`test/host-*.test.ts`), possibly `conformance/bridge-cases.json` and its readers; no `src/` change unless a contract failure is found, which goes to the controller first.

**Contract:** (a) decide, from the corpus's own grammar, whether the bridge-case sequences can state the host-side print-run state (a reopened run's replacement of a stale copy, and the 2 x 16 MiB handed cap) without a second protocol; if they can, add the sequences and their reader's checks; if not, record why, and point at the host unit tests that are the contract. (b) A test that drives the parser through a host-caused stale delivery (a run interrupted by `printFigures()` while figures are in flight) and pins what it does to the refusal budget: which deliveries are counted, when the sixteenth closes the frame, and that an honest run that is not interrupted counts none. No run token is added to the wire.

### Task 5: `changesBase` and `changes`

**Files:** the existing seam's tests and the docs that describe it (README, `src/` doc comments only if they state the rule).

**Contract:** at the existing seam, tests show which `changes` request records the comparison base and which do not (the last-visit measure and the day views), so the rule is no longer ambiguous on the wire as the landing A record says. No new op, key or payload field; if one turns out necessary, stop and report.

**Amended 2026-11-22 (the coordinator's ruling on this wave's finding):** in the sealed frame, a seeded `changesBase` plus a prior visit lost the last-visit measure: both requests were made before `ready`, and the outbox before it opens keeps only the newer, so the host received only the base and the "Changed since your last visit" notice never appeared (measured in Chromium; `./enhance` alone sends both). The repair is built in this wave: the reader asks for the seeded base only once the last-visit measure has settled, and a pick the reader made in the meantime keeps its place. It is the one exception to "no asset moves": the default, `classic` and `editorial` enhance bundles move, with the manifests, their policy hashes, the derived srcdoc caps, the CHANGELOG's hash bullets and one `x2` growth row, and the pull request's line is `Size-Design: x2`. The bootstrap, the outbox's pre-ready rule, the wire and every golden and snapshot stay as they are.

**Files (amended):** `src/enhance/since.ts`; its unit tests and a sealed-frame browser row; the regenerated `assets/assets.json` and `src/frame/manifest.generated.ts`; `conformance/size/growth.json`; README and CHANGELOG.

### Task 6: The byline's live Range, Selection and observer, and its cost in WebKit

**Files:** `test/browser/byline-many.test.ts` and a browser row of its own if needed.

**Contract:** measure, in a real browser, what a live `Range` and a `Selection` inside the meta paragraph, and a `MutationObserver` on its parent, see across the off-document byline build and its undo; pin the measured behaviour, with the text unchanged. Print build and undo times separately for like fixtures (4 000 separators in 5 text nodes, 10 000 in 2, and Chromium's large case), so CI's WebKit legs give a line to set against landing A's table. Any repair needs evidence that it keeps the text, the selection behaviour as specified, and the design and wire; otherwise the record names the consequence and the smallest next step.

### Task 7: Classic's phone chips and the tap floor

**Files:** a browser measurement row or a scratch measurement; the record.

**Contract:** measure Classic's chips at a phone size under a coarse pointer, in the corpus documents that draw them, and trace which tap-floor contract covers them: X1 §9's 44 px floor (the host's head and frame rows), the layout's own rows, or none. Do not promote the host/frame rule into a rule for every in-document control. The record states the measured sizes, the covering contract or its absence, and the user-visible consequence.

### Task 8: The gate measured, and the record

**Files:** this plan's Results, `docs/superpowers/programs/docserver/release-readiness.md`, README and CHANGELOG only where a known limit's text changes.

**Contract:** the gate is dispatched on the pushed tip, both legs; the record holds the run and job links, the exact tested tip, the browser versions, the `old-cap figures:` and `frame-figure:` lines (old-base and built counts, the applicable cap, `srcdocChars`, time to `ready`), and which layout mounted. A leg that is skipped or killed is unmeasured; a leg that completes without `ready`, or with a fallback, fails the gate. Each carry is written up as fixed, measured with no change, still open or blocked. The pull request carries one `Size-Design: x2` line (Task 5's repair moves the default, `classic` and `editorial` enhance bundles).

## Results

Every sha is a commit of `git log --oneline 5a81730..HEAD` on this branch. The wave changed no version, tag, publication, repository setting or user-facing setting. "Fixed", "measured, no change", "open" and "blocked" are the dispositions.

| Item | Task | Disposition |
|---|---|---|
| 1: the release gate | 1, 8 | Built and dispatched three times; both legs passed once the fixture was fixed (fixed). The gate's measurement on the release candidate's exact tip is still owed (see below). |
| 2: the colour scan | 2 | Fixed (test-only). |
| 2: RF3's timing oracle | 3 | Cause measured; a test-only change ruled (see the Task 3 entry for its state). |
| 3: print runs, 4(a) | 4 | Measured, no change: the corpus cannot state a print run. |
| 3: print runs, 4(b) | 4 | Fixed (eight rows added; no `src/` change). |
| 3: `changesBase` | 5 | Fixed (a product repair, the coordinator's ruling; one `x2` row). |
| 3: the byline's live Range, Selection and observer | 6 | Measured and pinned, no change (cosmetic). |
| 3: the byline's WebKit cost | 6 | Re-measured; still open. |
| 3: Classic's phone chips | 7 | Measured, no change. |

### Task 1: the release gate (Item 1)

Commits: `8b553c5` (the input, the job, the checker, the pins), `a4a5491` (the diagnostic print, below), `7f3325f` (a static job name and the remaining pin rows), `fffc908` (the fixture fix and its guard).

**What was built.** `ci.yml` gains one `workflow_dispatch` input, `old_cap` (boolean, default false), and one job, named `old-cap gate`, with one leg per browser (Chromium, WebKit; `fail-fast: false`) on a GitHub-hosted runner. The job runs only when the event is a dispatch, the running workflow is `ci` and the input is true, so pull requests, pushes to `main` and the release workflow's call never start it. It names no `permissions`, so the token stays read-only; the `test` job, its matrix, steps and env are unchanged. Each leg installs that browser with its system libraries (bounded by `timeout`), then runs the measured row of `test/browser/frame-appearance.test.ts` alone (`DOCREADER_MEASURE=1`, `DOCREADER_BROWSERS=<leg>`, a heap ceiling of 8192 MB, a JSON report), then `scripts/old-cap-gate.mjs`. The checker has no dependency and exits non-zero unless exactly one test with the row's title, under that browser, has status `passed`: a skipped, pending, todo or missing row, a filter that matched nothing, more than one row, and a missing or unreadable report are all "unmeasured", and a completed failure says "failed". 53 mutation rows plus one for the fixture guard, all red (`readiness-mutations/task-1.md`).

**Three dispatched runs.**

| Run | Tip | Leg | Job | Result |
|---|---|---|---|---|
| [45073445645](https://github.com/Synapsium-Labs/docserver/actions/runs/45073445645) | `8b553c5` | Chromium | [137365343963](https://github.com/Synapsium-Labs/docserver/actions/runs/45073445645/job/137365343963) | failed: events `ready` then `fallback`; `srcdocChars` 111 799 051, mount call 3 764 ms, waited 2 045 ms, ready at 6 062 ms |
| | | WebKit | [137365343898](https://github.com/Synapsium-Labs/docserver/actions/runs/45073445645/job/137365343898) | failed the same way; 111 799 051, 2 885 ms, 2 042 ms, 4 422 ms |
| [45073981117](https://github.com/Synapsium-Labs/docserver/actions/runs/45073981117) | `a4a5491` | Chromium | [137374307097](https://github.com/Synapsium-Labs/docserver/actions/runs/45073981117/job/137374307097) | the diagnostic: `ready` at 5 110 ms, then `fallback` with reason `error`; one load; the frame's console line `docserver frame: render`; 111 799 051, 3 207 ms, 1 668 ms |
| | | WebKit | [137374306890](https://github.com/Synapsium-Labs/docserver/actions/runs/45073981117/job/137374306890) | the same: `ready` at 3 326 ms then `fallback` `error`; one load; `render`; 111 799 051, 2 197 ms, 1 571 ms |
| [45080292573](https://github.com/Synapsium-Labs/docserver/actions/runs/45080292573) | `fffc908` | Chromium | [137390490961](https://github.com/Synapsium-Labs/docserver/actions/runs/45080292573/job/137390490961) | passed: events `ready` only, one load; `srcdocChars` 111 799 051, mount call 4 815 ms, waited 5 232 ms, ready at 10 446 ms; the checker "passed under chromium" (1 passed, 27 skipped) |
| | | WebKit | [137390491222](https://github.com/Synapsium-Labs/docserver/actions/runs/45080292573/job/137390491222) | passed: `ready` only, one load; 111 799 051, 2 957 ms, 10 250 ms, 12 664 ms |

The first run was cancelled after its gate legs failed (its `test` legs held the concurrency group). Run 45073981117 was at `a4a5491`, a commit that only made the row print each adapter event with its value and time, each load of the frame, and the host's and the frame's own console warnings; no check changed (the scoped re-review found the diagnostic sound).

**The cause of the first two failures: the fixture, not the product.** `htmlAtCap` in `test/frame-old-cap.ts` put the padding letters of its last paragraph after the run of raw `<` characters. The HTML tokenizer reads a `<` followed by a letter as the start of a tag, so `<aaaa...a</p>` became one element whose name was seven thousand letters and a `<`, which is outside the frame's closed vocabulary. The frame refuses the whole document in that case, by design (the frame's `materialise` step refuses; `render()` itself can never emit a raw `<` in text, it writes `&lt;`). The frame therefore posted `ready` and then a fallback with the reason `error`, about 1.7 s after the mount. The fix (option F1, ruled) puts the padding letters before the `<` run: the html has the same characters, so every length is unchanged (`srcdocChars` stays 111 799 051 and the escaped html is exactly `SEED_HTML_MAX_CHARS`). The guard, in `test/frame-document.test.ts` beside test 7's old-cap row, takes the escaped html for 2 000 paragraphs and for 1, replaces each `<p>` and `</p>` with a space and requires that no `<` is followed by an ASCII letter, `/`, `!` or `?`; restoring the old padding order turns it red (mutation row F1). The first version of the guard deleted the tags instead of replacing them and was a false positive on the fixed fixture, which the second version corrected. The parser's refusal was kept intact.

**Browser builds** (GitHub-hosted runners, run 45080292573): Chrome Headless Shell 153.0.8010.12 (Playwright chromium v1243) and WebKit 26.6 (Playwright webkit v2359).

**Which layout mounted.** The default layout only, through the library page's `./host`, without the snapshot and the 64 Mermaid secure keys (the row ccrc D-8824 defines, and the design's section 2). The four other layouts frame the same document in Node only (`test/frame-layouts.test.ts`); they are not mounted at this size in a browser, and a per-layout browser mount was not added (it would cost about four times the runner time; a follow-up if wanted).

**Figures, and what moved with Task 5.** The fixture's inputs are unchanged by F1 and by Task 5 (its html at the cap, the 512 images at the budget, version 1.1.0's asset lengths 114 554 779 and old cap 114 569 828). The derived built counts moved with Task 5's rebuilt default enhance bundle (`old-cap figures:` lines of `test/frame-document.test.ts` test 7, measured before and after, and after Task 5's fix round):

| Figure | Before Task 5 | After Task 5's first commit | After its fix round (the tip) |
|---|---:|---:|---:|
| at-cap srcdoc length | 114 598 090 | 114 598 170 | 114 598 184 |
| at 1.1.0's asset lengths (input, unchanged) | 114 554 779 | 114 554 779 | 114 554 779 |
| 1.1.0's old cap (input, unchanged) | 114 569 828 | 114 569 828 | 114 569 828 |
| derived `MAX_SRCDOC_CHARS_DEFAULT` (the applicable cap) | 116 224 259 | 116 224 339 | 116 224 353 |
| assets now (derived) | 4 571 331 | 4 571 411 | 4 571 425 |
| with both faces and the largest appearance | 114 949 117 | 114 949 197 | 114 949 211 |

The browser row's `srcdocChars` (111 799 051) is the document the row mounts, which is below the cap, and is the same in every run.

**What the gate has and has not measured.** Run 45080292573 passed both legs at `fffc908`, whose `src/` and `assets/` equal the library's `main`: it measures the main line's bytes with the fixed fixture. Task 5 then moved the default enhance bundle by 94 characters, so the gate on the release candidate's own bytes is a further dispatch, on the exact tip that will be released. That measurement is recorded in the pull request's description, because a commit that recorded it would change the tip it measured. The release stays blocked until both legs pass on that tip, as well as required CI and an independent review.

**A dispatched run's ordinary `test` legs are not required-CI evidence.** A dispatch has no pull request description and its branch commit carries no `Size-Design` line, so the `test` legs of run 45073981117 failed only the size contract's two text-reading checks (8 261 tests passed; job [137374307070](https://github.com/Synapsium-Labs/docserver/actions/runs/45073981117/job/137374307070)), as the landing B2 record states for a run without the description. The gate legs are the evidence a dispatch gives.

**Dispositions.** Fixed. Deferred minors (recorded, no change): no apt retry hardening in the gate's install (a stalling mirror wastes a dispatch, never a false pass); a dispatch shares the concurrency group with pushes to its ref (seen once: run 45073981117 waited behind run 45073445645; on `main` a push could cancel a queued dispatch); mutation row W7's recorded edit names the old templated job name (not replayable, the result stands); the pin for the row's timeout reads the first `}, N);` after the title, so an inner callback with a timeout of 60 000 or more could be read instead.

### Task 2: the colour scan (Item 2)

Commits: `fe4e46a`, `e0238cb`. Test-only, in `test/enhance-layouts.test.ts`; the four layout stylesheets are byte for byte unchanged (their sha256 values were compared before and after).

The scan now walks the braces after one pass that blanks comments, strings (escape-aware, both quote kinds, an escaped newline, an unterminated string ends at its newline) and `url()` (quoted or unquoted argument). Text ending at `{` is a prelude and is never read; text ending at `;` or `}` inside a block is a declaration of which only the value is read, at any nesting depth, so a nesting parent's own declarations before, between and after nested rules are read. The 23 deprecated CSS system colours (`ActiveBorder` to `WindowText`, checked against the CSS Color 4 list) join the list with a pinned count (23, unique; 148 + 19 + 23). The older behaviour stays pinned (custom property names and `var()` references are no colour, a custom property's value and a `var()` fallback are read, case does not matter). 89 tests pass; 36 mutation rows, all red (`readiness-mutations/task-2.md`; two first came back green, got a case each and were re-measured). The review found one Important defect (an escaped newline inside a string hid the rest of the rule from the scan) and three minors; all four were fixed in one round.

**A decision to know about.** `transition: background .2s` is reported, because the scan cannot know which properties take a colour and `background` is a deprecated system colour as well as a property name. A per-property allow-list would be code that is itself unguarded; a false positive is a red row that names the word, and the author writes `background-color` or a custom property. The real sheets have no such value (`background` appears 28 times, all as a property name; their `transition` values name only `opacity` and `transform`). Any value word that is a colour keyword is reported the same way (`grid-area: menu`, `container-name: window`); the scan's comment says so.

**Dispositions.** Fixed. Deferred minors: the `url()` pattern has cubic backtracking on `url(` followed by a long run of spaces with no `)` (unreachable: the real-sheet row refuses `url()`; a hang, not a pass); an escaped CRLF inside a string ends it at the LF (unreachable: the real-sheet row refuses a carriage return).

### Task 3: RF3's timing oracle (Item 2)

Commit: the task's own commit, subject ending `(docserver readiness T3)`, with its measurements in [`readiness-mutations/task-3.md`](readiness-mutations/task-3.md); this record does not repeat the per-run numbers. (RF3 is the plans feature's superlinear-cost test, `test/enhance-plans-rf3.test.ts`.)

**What failed.** Only the toggle ratio (`b.toggle <= 2.5 * a.toggle`), and only on the Node 24 leg: 8 failures in 197 completed `test (24)` jobs since RF3 landed (4.1 %), none in 198 `test (22)` jobs. The received ratios were 2.60 to 3.26 and every failure had the same signature: `a.toggle` low (0.38 to 0.47 ms) and `b.toggle` ordinary. The build budget, the toggle budget and the build ratio never failed (0 of 395 jobs for the build ratio). A passing run prints none of the four numbers, so CI's typical values are unknown.

**Why.** About 98 % of an outline toggle's time in jsdom is jsdom rebuilding the root's live `children` list, which it does eagerly on every attribute change of the root once anything has read `root.children` (the features read `Array.from(root.children)`). That walk is linear in the root's children (1 709 and 3 385 in the two plans) but memory-bound, and its cost per child depends on where that copy of the DOM sits in memory: up to 1.8 times between two copies of the same plan on Node 24, and the test mounts one copy of each plan per process, so each CI job draws one pair. A fast copy of the small plan against an ordinary copy of the large one gives a ratio near 3.4. Ruled out: garbage collection (never in a quickest batch), warm-up order, batch length and the budgets. Not proved: why one copy's layout is fast and another's slow (the evidence points at V8's allocation decisions). The failure itself did not reproduce on the box that measured it (maximum local ratio 1.82); the mechanism reproduced in an isolated model at CI's magnitude, and the link to CI rests on the failure signature and the Node 24 only pattern.

**What did not help.** None of the protocol or estimator changes the task listed (a warm-up round, alternating the order, longer batches, medians of the ratios) moved the drift model's ratio, because the drift is a property of the copies; cold caches dilute any planted cost; and fresh copies per round hid the plant that the current protocol catches.

**The change (the coordinator-visible ruling).** The test's root gets an own `children` getter that returns a fresh array of its element children, so jsdom never makes the live list. Measured: toggle ratio 0.93 to 1.08 against 1.13 to 1.82 for the test as it is on the same box, the toggle plant red 3 of 3 against 2 of 3, the build path untouched and its plant caught as before. No threshold is widened, no retry or timing gate is added, and no `src/` file, asset or golden moves. What it costs if wrong: it hides a jsdom-only linear cost, and a future read that keeps the live collection would behave differently in this test only; the alternative is a `src/` change (read the root's children by `firstElementChild` and `nextElementSibling`), a separate task.

**Dispositions.** Fixed if the change lands with a green Node 24 leg, to be confirmed on CI where a toggle ratio near 1 is expected. The build ratio is now the tightest comparison (up to 2.34 against the bound 2.5 locally); it has never failed on CI and is worth watching. Sample counts were bounded by the shared test slice's memory cap (the real file ran to completion four times locally).

### Task 4: print runs and the refusal budget (Item 3)

Commit: `14ab157` (test-only; `test/host-mount.test.ts`, eight mutation rows, no `src/` or corpus change).

**4(a): the corpus cannot state a print run (measured, no change).** The record sentence: the conformance corpus cannot state a print run. A sequence's steps are frame-to-parent messages that the parent's token buckets alone judge (every refusal `rate`, every message parsed with no state). A run is opened by the parent's own `printFigures()` call, which is no message the parent receives. So a reopened run's replacement and the handed cap would need a step for a parent action and run-dependent verdicts, which is a host-side state machine and not a fixture of the wire. A message case's `given` could state the parser's half only by changing the shipped `about` text, the public `BridgeGiven` type and two readers' pinned shape, a `src/` edit that the plan forbids for a test-only carry. The contract rows are the host's unit tests: in `test/host-mount.test.ts`, the "reopened run" block (the first repeat of an index replaces the earlier copy and counts no refusal, a second repeat is refused and counted, each index has its own one replacement, a previous run that received nothing leaves the next reopened, a complete run leaves the next ordinary, a third call while the second run's figures are in the port reopens too) and "the refusal budget across a host-caused stale delivery"; `test/host-parse.test.ts` (the handed cap); and `test/host-print-run.test.ts`.

**4(b): the refusal budget (fixed, rows added).** Eight rows (R1 to R8) drive the parser through host-caused stale deliveries and pin what they do to the budget:

| Row | Pins |
|---|---|
| R1 | an honest run that is not interrupted counts no refusal, and a complete-run successor counts none |
| R2 | one interruption with six figures in flight counts nothing; the latest copy of every index wins (20 indexes) |
| R3 | the oversize edge: stale copies still counted make four new copies refused as oversize and counted |
| R4 | in an extreme skew the sixteenth refusal closes the frame (fallback `refusals`) |
| R5 | three runs in flight: five third copies are refused and counted, each refused copy the run's own |
| R6 | sixteen such third copies close the frame |
| R7 | figure sizes that change between runs: the 2 x 16 MiB handed cap refuses an honest copy (counted 9) |
| R8 | constant figure sizes: a run hands on exactly 32 MiB and counts 5 |

Every expected value held exactly as the investigation measured it; 8 mutants (the reopened-run test, the replaceable table, the third-copy refusal, the live-total adjustment, the handed-cap check and its accumulation, the replaced copy leaving the total, `>=` against `>` at the sixteenth) are all red. No run token was added to the wire. The host-mount file now has 221 tests (213 plus 8). The landing A known limits stay as written; README and CHANGELOG now name these rows beside them.

### Task 5: `changesBase` (Item 3)

Commits: `036494f` (the plan amended by the coordinator's ruling), `e41e1be` (the repair), `83122ff` (its fix round).

**The finding.** The investigation (confirmed in real Chromium) found that in the sealed frame a seeded `changesBase` plus a prior visit lost the last-visit measure: both `changes` requests were made before `ready`, and the outbox before it opens keeps only the newer, so the host received only the base and the "Changed since your last visit" notice and the menu's row never appeared. `./enhance` alone sent both, and the controls (prior visit only, base only) were correct. The README's sentence on which request records the base was wrong for that case.

**The ruling.** The coordinator ruled that the repair is built in this wave: sequence the two startup comparisons inside the feature; keep the outbox semantics, the bridge, the options and the bootstrap bytes; never block `ready` on a host reply; a null, empty or slow measure must not strand the base; a late answer must not overwrite a newer reader choice or cause an opening scroll jump; sealed-frame rows red first for prior plus base, prior only, base only, the day view, a null or delayed measure and an intervening choice; stop if an `x2` share is exceeded, the bootstrap moves, or the wire or settings change. The pull request carries one `Size-Design: x2` line.

**The repair.** `src/enhance/since.ts` asks the base only after the last-visit measure has settled (`.finally`, so any outcome asks it), and not when the reader has picked a comparison in the meantime (a `picked` flag set only by the menu's pick, so a hidden pick also keeps the late base away); the late base is shown without a jump. Nothing else changed in `src/enhance`; the outbox, bootstrap, wire, ops and payload fields are untouched. The "which request records the base" rule is now stated in the README: unprompted `changes` requests are only for shas the host seeded (the last visit's, the `changesBase`, a day view's `only`), asked in that order, so any other sha in a non-day mount is the reader's pick; the one lossy edge is stated.

**Evidence.** Unit rows in `test/enhance-inshort.test.ts` (36) and sealed-frame rows in `test/browser/frame-inshort.test.ts` (14 in Chromium), red against the unrepaired code and green after; each guard has a mutant (15 rows in `readiness-mutations/task-5.md`, all red, restored byte for byte). A hidden pick has no browser row that goes red, because the sealed frame keeps one `changes` request in flight and the Hide button does not exist before the measure answers; the unit row and mutant R8 carry it, and the browser row pins the observable. WebKit is not run locally (CI is its evidence).

**What moved: only `assets/frame/enhance.js`** (the default layout's enhance bundle) in `assets/assets.json` and `src/frame/manifest.generated.ts`: 225 709 to 225 803 characters (225 727 to 225 821 bytes), a new sha256 and csp. The brief and the investigation expected the `classic` and `editorial` bundles to move too; they do not, because their feature lists do not include `since`. The bootstrap (32 740 of 32 768 bytes) and the other layouts' entries are byte for byte as before, and no file under `conformance/expected`, `conformance/layout` or `conformance/layouts` moved. `MAX_SRCDOC_CHARS_DEFAULT` follows the bundle (see the table above), and `test/frame-layouts.test.ts`'s pinned default-frame literals were updated, each named in a comment.

**The growth row and the headroom.** One row appended to `conformance/size/growth.json`: `{"design":"x2","total":5279480,"frame":4571425}` (landing B2's 5 279 386 and 4 571 331 plus 94; the default frame is still the largest). The `x2` use is 721 478 of the 1 166 336 share for all assets (444 858 left) and 13 423 of 72 704 for the largest frame (59 281 left); neither share is exceeded. The size contract passes 5 of 5 with `DOCSERVER_SIZE_TEXT='Size-Design: x2'`.

**Review.** The review found two Important defects (a pick hidden before the measure settles let the late base show; the README's cap was stale) and five minors, all fixed in one round and approved on the scoped re-review. Deferred minors: no row for a pick that comes back skipped (covered by construction), and one test comment says "Re-measured once".

**Disposition.** Fixed.

### Task 6: the byline (Item 3)

Commits: `21cd949` (the rows), `4f0cde4` (the fix round). Tests only: the new `test/browser/byline-live.test.ts` (two sizes per engine) and one added case in `test/browser/byline-many.test.ts`; no `src/` change; six mutation rows.

**What a live Range, the Selection and an observer see** (Chromium, 40 and 4 000 separators; the text and the root's html are identical to before after the undo). A live Range with both boundaries inside the byline paragraph, and the Selection on it, collapse to a caret in the paragraph's parent when the build takes the paragraph out and puts it back (the standard moves a removed node's descendant boundaries to the parent at its index), and are not restored by the undo (the caret stays in the parent, at the paragraph's original index). A `MutationObserver` on the parent sees the paragraph removed and inserted once each in the build and once each in the undo, the removal first, plus the chrome's own records and transient records whose number depends on the engine. Asserted in both engines: the Range's boundaries are outside the paragraph and collapsed, the removal and insertion counts and order, and that enhance resolves, the paragraph is back, and destroy restores the text and the html. Printed only: the Selection and the transient records (engine-specific). After the review, the asserted Range is one that is never added to the Selection, so the assertion does not depend on how an engine adjusts a Selection. **Consequence:** a reader's selection over the byline's text collapses to a caret when the byline is built; cosmetic, no loss of text, and no repair built or recommended.

**The WebKit timings, re-measured** at `a4a5491` (the library's source equal to `main`'s; run [45073981117](https://github.com/Synapsium-Labs/docserver/actions/runs/45073981117), `test (24)` leg, job [137374307070](https://github.com/Synapsium-Labs/docserver/actions/runs/45073981117/job/137374307070)), against landing A's table:

| Fixture (WebKit) | Build | Undo | Landing A: build | Landing A: undo |
|---|---:|---:|---:|---:|
| 4 000 separators in 5 text nodes | 0.36 s | 0.39 s | 0.33 to 0.59 s | 0.32 to 0.72 s |
| 10 000 in 2 | 1.17 s | 1.60 s | 1.5 to 2.4 s | 1.8 to 5.2 s |

Both are within or under landing A's ranges; against Chromium (32 000 in one node: 1.14 s and 0.05 s; 4 000 in 5: 0.18 s and 0.01 s) WebKit is still superlinear. The cause inside WebKit is still not identified (it needs a WebKit profile), so the limit stays; README and CHANGELOG gain these figures beside it. **Disposition: still open.** Deferred, none. (The new 10 000 in 2 case reads close to the large case in WebKit, because the parser already cuts 10 000 separators into two nodes; it is kept so that the like-for-like line prints under its own label.)

### Task 7: Classic's phone chips (Item 3)

No tree change; a scratch measurement in Chromium (412 by 915, a coarse pointer, light and dark, the layout's own test document, a realistic spec with long headings and the corpus's headings document; 35 chips). WebKit does not launch on the measuring box and is unmeasured.

- **Sizes.** A one-line chip is 38.86 px high (5.14 px under 44) and a two-line chip 65.72 px; widths 29 to 380 px for real headings (20 px for an empty heading); 6 px gaps in both directions. Light and dark measure the same. The chips keep the heading number in their accessible names.
- **No covering contract.** The first consumer's 44 px tap floor is measured on the host's own head and frame rows; its `--row-h` slot governs the host's control row, which the chips do not read; the parity design's "every layout keeps the tap budget" points at that same row and names no in-document control; the earlier landing notes and the layout's own rows speak only of the drawer. Nothing measures a chip. Every real-text chip is above the 24 px minimum of WCAG 2.2 success criterion 2.5.8; the empty-heading chip (20 px wide) is under it but has 6 px gaps, and exists only in the corpus case.
- **The smallest choice, if one is wanted.** One coarse-pointer rule, `min-height: 44px` (with a flex centring) on Classic's chips inside its phone media block, plus a coarse-pointer row beside the drawer's, red without the rule. It moves `assets/layouts/classic.css`, so Classic's frame asset and the CHANGELOG's stylesheet-hash bullets. It would be Classic's own rule, not the host's rule promoted. Not built.
- **An observation recorded with no change.** The Contents button that opens Classic's drawer is 28 px high under a coarse pointer, in Classic and in the default layout; only the open drawer's rows and head buttons are floored in Classic (the guided and review layouts carry their own coarse rules). The layout's "coarse floor" is a drawer-only rule, so the landing B1 sentence "coarse-pointer controls meet the 44px floor" is true of the drawer. A rule for the default reader's in-document controls is a wider question and was not proposed.

**Disposition.** Measured, no change.

### The rulings of the wave, in public terms

| Ruling | Why | What it costs if wrong |
|---|---|---|
| The branch is pushed without a pull request to dispatch the gate, and the gate's final dispatch is on the final code tip; a docs-only record commit follows and its diff against the tested tip is stated. | The gate needs GitHub runners and a push; CI on pull requests is what costs runs, and a push of a branch with no pull request starts none. | One extra push of the work branch. |
| The gate measures the existing row (the default layout only); per-layout browser mounts are not added. | The design defines one measured row. | A follow-up row, about four times the runner time. |
| Fix the old-cap fixture with option F1 (padding letters before the `<` run; every length unchanged) and add a string guard with a mutation row, keeping the parser's refusal intact. | The refusal is correct and intended; the fixture's intent was text; F1 keeps every count and every assertion of the row, so it weakens nothing. The coordinator approved it ("keep the parser rejection intact and pin the bad padding with a red-first check") and asked that unchanged fixture lengths be distinguished from derived built counts. | The coordinator may prefer a `render()`-shaped html (option F2): a further fixture change and one more dispatch. |
| Fix the `changesBase` loss in this wave (the coordinator's ruling, above); the pull request carries `Size-Design: x2`. | A lost notice is a user-visible defect, and the repair is small, keeps the wire and the bootstrap, and fits the `x2` share. | A product change in a readiness wave; the `x2` headroom is 59 281 characters on the largest frame. |
| Hold Task 5's fix round until Task 6's implementer reported. | Both tasks mutate `src/` in place for their mutation rows, so concurrent runs would cross-contaminate the measurements. | About 20 to 30 minutes of wall clock. |
| Adopt the investigation's test-only shim for RF3 (the root's own `children` array). | Toggle ratio 0.93 to 1.08 against 1.13 to 1.82, the toggle plant red 3 of 3 against 2 of 3, the build plant unchanged; no threshold, retry or `src/` change. | The shim hides a jsdom-only linear cost, and a future live-collection read would differ in this test only; the coordinator may prefer the `src/` alternative, a separate task. |
| Run this record's task in parallel with Task 3's change. | The files are disjoint, and the record's tests never load the plans feature that Task 3 mutates. | A retry of a git index lock, or a text test seeing a plant (none reads `src/enhance`). |

### Deferred minor findings

Eight, each recorded above with its task and none changed: Task 1 (four: no apt retry hardening; a dispatch shares the concurrency group with pushes; mutation row W7's recorded edit is not replayable; the row-timeout pin reads the first `}, N);`), Task 2 (two: the `url()` pattern's cubic backtracking on a long run of spaces; an escaped CRLF inside a string), and Task 5 (two: no row for a pick that comes back skipped; one test comment's wording).

### Still open, and what waits on the operator

- **The gate on the release candidate's exact tip,** both legs, recorded in the pull request's description; and required CI, and an independent review, before the release.
- **WebKit's superlinear cost in the byline** (Task 6): needs a WebKit profile.
- **A browser mount of the four other layouts at the old cap** (Task 1): not added; a follow-up if wanted.
- **Classic's chips and the Contents button's tap floor** (Task 7): a choice, with its one-rule form stated.
- **RF3's build ratio** is the tightest comparison after Task 3's shim and is worth watching on the Node 24 leg.
- **The landing commit's message** must carry the pull request description's one `Size-Design: x2` line, or the main-line run of the size contract fails. The release and its signed tag are the operator's separate step; this wave publishes nothing.
