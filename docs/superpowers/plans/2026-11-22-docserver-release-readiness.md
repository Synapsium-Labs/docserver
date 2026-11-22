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
- **No asset, golden or snapshot moves.** No layout stylesheet, `src/` file or frame asset changes for a test-only carry. `node scripts/build-frame.mjs --check` stays green and `assets/assets.json` and `src/frame/manifest.generated.ts` do not move. A move is a stop-and-ask.
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

### Task 6: The byline's live Range, Selection and observer, and its cost in WebKit

**Files:** `test/browser/byline-many.test.ts` and a browser row of its own if needed.

**Contract:** measure, in a real browser, what a live `Range` and a `Selection` inside the meta paragraph, and a `MutationObserver` on its parent, see across the off-document byline build and its undo; pin the measured behaviour, with the text unchanged. Print build and undo times separately for like fixtures (4 000 separators in 5 text nodes, 10 000 in 2, and Chromium's large case), so CI's WebKit legs give a line to set against landing A's table. Any repair needs evidence that it keeps the text, the selection behaviour as specified, and the design and wire; otherwise the record names the consequence and the smallest next step.

### Task 7: Classic's phone chips and the tap floor

**Files:** a browser measurement row or a scratch measurement; the record.

**Contract:** measure Classic's chips at a phone size under a coarse pointer, in the corpus documents that draw them, and trace which tap-floor contract covers them: X1 §9's 44 px floor (the host's head and frame rows), the layout's own rows, or none. Do not promote the host/frame rule into a rule for every in-document control. The record states the measured sizes, the covering contract or its absence, and the user-visible consequence.

### Task 8: The gate measured, and the record

**Files:** this plan's Results, `docs/superpowers/programs/docserver/release-readiness.md`, README and CHANGELOG only where a known limit's text changes.

**Contract:** the gate is dispatched on the pushed tip, both legs; the record holds the run and job links, the exact tested tip, the browser versions, the `old-cap figures:` and `frame-figure:` lines (old-base and built counts, the applicable cap, `srcdocChars`, time to `ready`), and which layout mounted. A leg that is skipped or killed is unmeasured; a leg that completes without `ready`, or with a fallback, fails the gate. Each carry is written up as fixed, measured with no change, still open or blocked. The pull request carries one `Size-Design: none` line.

## Results

Filled in as the tasks land.
