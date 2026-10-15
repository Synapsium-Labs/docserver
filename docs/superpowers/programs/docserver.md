# Program: docserver

Spec: [Rich Docs reader and a shared renderer](https://github.com/Synapsium-Labs/ccrc-pwa/blob/main/docs/superpowers/specs/2026-10-12-rich-docs-reader-and-shared-renderer-design.md), §3 (the library) and §8 (sequencing). It was approved by the operator on 2026-10-12 (R-g).
Plan: one plan per wave, under `docs/superpowers/plans/`.
Coordinator: ccrc session `ccrc-pwa-calm-canyon`. It also coordinates ccrc's `native-docs-reader` programme, which is this library's first consumer.

## Waves

| # | scope | PRs | state |
|---|---|---|---|
| L1 | Scaffold and rules. A TypeScript package with ESM entry points and `.d.ts`. `render()` on markdown-it with the raw-HTML allowlist, alerts, figure captions, front matter, heading ids, `data-line` attributes and `meta`. The conformance corpus: golden HTML generated from today's renderer, hostile cases, and `runCorpus()`. CI. Plan: [`2026-10-12-docserver-l1-rules-and-corpus.md`](../plans/2026-10-12-docserver-l1-rules-and-corpus.md), 12 tasks. | plan: #1; work: #8 | **merged** 2026-10-15 as `89a9db6f4`, with one `Goldens-moved:` trailer naming the 52 cases. Run 414 dispatched 2026-10-13, and PR #8 opened 2026-10-14. The coordinator's reviews were runs 458, 464 and 469, with two fix rounds (C31-C39). The suite is green on Node 22 and 24, and the mutation table holds 494 rows: 461 red, 33 superseded or not applied, each with a stand-in, and 0 not red |
| L2 | The layout. `enhance(root, options)` made embeddable: host adapters, namespaced storage keys, operator-specific defaults scrubbed into off-by-default options, CSP-safe. The styles, and the fonts with `OFL.txt`. A self-hosted single-file Mermaid with pinned limits. `THIRD-PARTY-NOTICES`. | — | next: plan to be written |
| L3 | The frame and the release. `frameDocument()`, the frame bootstrap and click guard as hashed assets, `mountDocFrame()` for other hosts, and `assets.json`. Then v1: the repo goes public, and the package is published to npm with provenance as `@synapsium-labs/docserver`. | — | after L2 |

## Decisions & deviations

- **2026-10-12: the programme (operator).** Each product keeps its own docs server. The rendering is this one library: MIT, pinned by exact version, named `docserver`, scope `@synapsium-labs`. It starts now, and it is private until v1, which goes public. ccrc's spec is approved as written (R-a, R-c, R-f, R-g).
- **2026-10-12: consumers' needs.** ccrc's needs are its spec's §3-§4. Another viewer, which pins the library for its own phase, sent eight needs. They are met by §3.2 as written, and that viewer's coordinator confirmed it the same day. A first release before that viewer's phase is the date that matters. Interim builds are fine for its development.
- **Deviation numbers.** This repo's specs and plans name no allocator-issued numbers, so the ccrc allocator has nothing to seed from. Coordinator rulings are recorded here as `C<n>`, each with what, why and what it costs if wrong.
- **2026-10-12: how the L1 plan was made.** Twelve writers each wrote one task against a scratch build of the package, so every code block in the plan is the bytes of a commit that passed its own tests. A three-lens review (spec, safety, tests) then found 24 issues, four of them blockers: inputs that made rendering slow or used too much memory. All four are fixed inside the tasks that own them, and the plan's former Task 13 was folded into those tasks. A final pass applied C19-C23, and a verifier checked it.

### Coordinator rulings for L1 (C1-C23)

Each ruling binds the L1 plan. The plan's header carries the full text; this list is the record.

**Departures from the reference renderer.** A departure is a ruled difference between this library's HTML and the renderer it replaces. The list is closed: PD1-PD8, in the plan header and in `conformance/DEPARTURES.json`. Cost if any is wrong: the goldens it names move back, each with a `Goldens-moved:` trailer.

- **C1: PD1-PD4 accepted.** PD1: code highlighting is normalised when comparing. PD2: front-matter scalars follow YAML 1.2 core, so `null` renders as empty and booleans render as `true` or `false`. PD3: the front-matter list comes from the same block that is stripped. PD4: a leading BOM is stripped. Why: a public library should not print Python's `None` or `True`, and one parser keeps the strip and `meta` consistent.
- **C9: PD5, tag-name case folding.** Allowlisted tag names fold ASCII letters only. The reference also folded four non-ASCII letters, and so emitted raw tags that were not on the allowlist. The port keeps them as escaped text, which is safer. No golden moves.
- **C10: PD6, whitespace that markdown-it trims before a rule can see it.** It applies only where no rule hook can restore the reference's behaviour. Each residue has its own case.
- **C12: PD7, captions never cross the end of a tight list.** The reference could pull closing list tags into a caption and leave the HTML unbalanced. The port keeps the output balanced. No golden moves.
- **C16 and C17: PD2 restated.** Front-matter scalars render their source text: `version: 1.0` shows `1.0`, and a 20-digit integer keeps every digit. `null` renders as empty and booleans as `true` or `false`. The YAML schema is FAILSAFE plus null, bool and merge (C15: the merge key is accepted). PD2 also covers eight named loader differences, each pinned by a unit case. Why: a display library shows what the author wrote. Cost: the PD2 departure files are re-derived.
- **C19: PD8, resource bounds that only hostile documents reach.** These are the document-wide limit on empty table cells (65,536) and the bounds in C20 and C21. Each bound has a generated hostile case and a mutation row. Every golden case is unchanged, which shows that ordinary documents never reach one.
- **C23: PD6 covers reference-label normalisation.** A few rare whitespace characters (`\x1c`-`\x1f`, U+0085 and U+FEFF) behave differently in reference labels. Each is pinned by a unit case. Three more parser rules are not ported for this. Cost if wrong: those rules are ported later and the cases move.

**The API.**

- **C2: shape.** `render()` returns `{html, outcome, bytes, meta}`, with no overloaded empty value. `meta` holds the front matter, its list, the title, headings, figures, tables and Mermaid kinds. `scanRefs()` gains `outcome` and `imagesTruncated`. This refines a comment in ccrc's spec §3.2, and ccrc's ledger records that.
- **C3: defaults.** `maxBytes` is 4 MiB and the image limit is 512. Hosts pass their own.
- **C20: an output bound.** A new option, `maxHtmlBytes`, defaults to 16 MiB, four times `maxBytes`. When the HTML would exceed it, `render()` stops and returns outcome `output-over-limit`. That outcome is never folded into `rendered` or into the input-size outcome. The HTML is then the escaped-source fallback, truncated to stay within the bound. Why: one 304 KB input produced 200 MB of HTML. Cost if wrong: a host sees a fallback where it expected a page; it can raise the bound.
- **C21: allowlisted tags nest at most 64 deep.** This applies to each of `details`, `sup`, `sub` and `kbd`. An opener beyond the cap renders as escaped text, and so does its closer, so the output stays balanced.
- **C22: ids keep parity in L1.** Ids get no prefix and no de-duplication across kinds. The README says ids may collide, and that hosts must never look up their own elements by a document's id. Revisit in L2 if the layout needs unique ids.

**Building the package.**

- **C4: repository settings.** L1 changes no repository settings, branch protection or rulesets; that needs the operator's go. CI runs on PRs and on `main`. The coordinator merges after review.
- **C5: the reference renderer is passed by argument only.** No tracked file holds its path. Once it retires, `reference/` is frozen provenance and `expected/` is the contract.
- **C6 and C7: dependency pins.** Every pin is at least 14 days old, and installs use `--before` so transitive dependencies obey that too. The pins are markdown-it 14.3.2, js-yaml 4.3.2, typescript 6.0.3 and vitest 4.1.11. markdown-it 15 was rejected because it changes image alt text, and js-yaml 5 because it changes the loader API.
- **C8: the engine's rule chain.** The core chain is `normalize, block, block_strip, inline, text_join, anchors, line_attrs`, plus the plugin rules later tasks add, each named where it is added. `block_strip` gives heading and paragraph text Python's `str.strip` semantics.
- **C11: timing backstops.** The comment-scan tests keep their 5-second backstops, and a generated comment-bomb case has a verdict.
- **C13: a bug found in planning.** An id comment after a `summary` line inside a nested quote rendered as an empty paragraph. It is fixed in Task 5, with a corpus case and a mutation row.
- **C14: a corpus defect.** One input hid two of its probes behind an earlier one. The input was reordered before any golden was generated.
- **C18: a purity finding.** highlight.js's type declarations pulled the DOM types into the pure entry's typecheck. Task 1's typecheck config maps them to local declarations from the start, so the pure entry never sees `lib.dom`.
- **C24 (2026-10-14, during L1 Task 6): highlighting is bounded line by line.** The worker measured that Task 6's per-line and per-document bounds do not bound cost inside one highlight.js call:
  - a shell or Dockerfile fence of `$ ${` lines makes the output grow with the square of the line count, and a 128 KiB fence exhausts the heap;
  - an `ini` or `toml` fence of `\"` runs takes about 187 s at the 256 KiB budget;
  - `js`, `ts` and `xml` reach about 3.4 s.

  Ruled:
  - A fence over a measured threshold is highlighted one line at a time, each line on its own, under the existing per-line and per-document caps. Cost and output are then linear in the number of lines for every grammar, not only the ones found.
  - Ordinary fences at or below the threshold keep whole-block highlighting, so multi-line constructs such as block comments stay correct.
  - The worker measures the threshold so that the worst hostile case on either path stays within the plan's render budget, and states it.
  - Each path gets cases, including the three shapes above as generated hostile cases, plus mutation rows.

  Why: grammar patches fix only the grammars found, and dropping grammars loses features and still leaves the 3.4 s case. No golden moves, because highlighting is normalised in comparison (PD1). Cost if wrong: multi-line highlighting is lost on fences over the threshold. That is cosmetic, and the threshold can be raised on a later measurement.

- **C25 (2026-10-14, during L1 Task 7): PD7 also covers a caption that is not one emphasis span.** The reference's caption pattern reads `*Figure 1. a* *b*` as a caption and emits `<figcaption>Figure 1. a</em> <em>b</figcaption>`. That is a stray closer, then an opener that never closes. The plan kept it for parity: Task 7's decision 2, and section H's risk 6, which allowed the fix later at the cost of a golden. The review raised it as Important.

  Ruled:
  - A paragraph after a figure becomes its caption only when the paragraph is one emphasis span, meaning the `<em>` that opens it is the one that closes it. Otherwise it stays an ordinary paragraph after the figure, and the HTML stays balanced. Emphasis nested inside that one span (`*Figure 1. a *b* c*`) is still a caption.
  - This widens PD7 rather than adding a ninth departure, so the list stays PD1-PD8. PD7 now reads: a figure caption keeps the HTML balanced. It never comes from a hidden (tight-list) paragraph, never reaches past the block after its figure, and is made only from one emphasis span. The README's PD7 row says so.
  - The golden `figure-captions` moves. Its expected HTML is edited by hand and recorded in `conformance/DEPARTURES.json` under PD7, the way PD2-PD4 record theirs. The commit that moves it, and the merge, carry `Goldens-moved: figure-captions`.
  - `figcaption.test.ts`'s block of differences pins both outputs for this input. A mutation row that drops the one-span check turns it red.

  Why: PD7's own reason applies to this shape too, because parity would mean emitting unbalanced HTML. A library that hosts render must not carry emphasis into the rest of their page. Cost if wrong: one rare line shape renders as a paragraph instead of a caption.

- **C26 (2026-10-14, during L1 Task 8): `footnote_tail` is ported so that its cost is linear.** markdown-it-footnote's `footnote_tail` runs `state.tokens = state.tokens.concat(tokens)` once per note, so render time grows with the square of the note count. The worker measured 32.6 s for 20,000 ordinary notes and 427 s for 100,000 inline `^[a]` notes in a 400 KB input; a 4 MiB input would take hours. This happens at parse time, so `maxHtmlBytes` cannot stop it. Task 8's decision 6 had taken the plugin as it ships.

  Ruled:
  - `footnote_tail` is ported with output identical to the plugin's and a cost linear in the note count. The plugin stays pinned at 4.0.0, and every other rule is used as it ships.
  - This is not a departure. The corpus, a differential run against the plugin's own tail over note-heavy inputs, and a unit case all show the same output. Any difference is a stop and a question.
  - A bound case with a mutation row, plus two generated hostile cases (20,000 notes and 100,000 inline notes), each with a verdict.
  - The plugin's other rules are measured for the same pattern, and anything superlinear comes back as a question.
  - A plugin upgrade must re-run the differential.

  Why: the plan's constraint is that cost is bounded, not only input. A note cap would be a departure that no ordinary document needs, and deferring would leave Tasks 9-12 building on a quadratic path. Cost if wrong: the port drifts from a future plugin release; the differential catches that at upgrade time.

- **C27 (2026-10-14, during L1 Task 12): the public-readiness walk skips a `.git` file and named root scratch directories.** Task 12's tree scan skipped `.git` only as a directory. In a linked git worktree, `.git` is a file that holds an absolute path, and the walk also read local scratch that git ignores through `info/exclude`. So the scan failed in any worktree, where this wave's final gate runs, but passed in CI's clean checkout.

  Ruled:
  - Keep the walk. Task 12's decision 4 chose it over `git ls-files` because a mutation copy has no `.git`.
  - At the root, skip `.git` whether it is a file or a directory, plus a short fixed list of named scratch directories that workflows create and git never tracks. Each name is generic and gives its reason.
  - Where a `.git` exists, a case asserts that `git ls-files` lists nothing under a named directory, so the list cannot hide tracked content.
  - The test states what it actually scans.
  - Cases: a hit in a `.git` file is skipped; a hit in a named root directory is skipped; a hit anywhere else, including a nested directory with the same name, still fails. Each has mutation rows.

  Why: the walk is what lets the scan run in mutation copies. Cost if wrong: a named directory hides a file someone later tracks, which the `ls-files` case catches in CI.

- **C28-C30 (2026-10-14, L1's whole-branch review).** The worker put the review's open questions as one batched question. The operator answered it in the worker's own dialog at 12:49Z and chose the recommended option each time. It is recorded here after the fact, because the question never reached the coordinator's ask lane.
  - **C28: the figure caption is bounded, with no change to the output.** The caption rule rendered the whole candidate paragraph at parse time. That was outside `render()`'s html bound, and also inside `scanRefs()`, which has no bound. A caption of links that repeat one long destination built a 1 GB string: a fatal out-of-memory error at 3.0 MB of input, and a `failed` outcome plus a thrown `RangeError` at 3.9 MB, which is under `maxBytes`. The rule now decides from tokens: one emphasis span (C25), then the `Figure N.` test on a bounded prefix. The caption renders in the render phase, under the html bound. Every golden is byte-identical. The corpus and 39 caption shapes agree (corrected 2026-10-15: an earlier version of this entry said 41 shapes, and named a 60,000-document fuzz run that was never committed as a test). The fix round's differential over 1,439 candidates found no difference. There is no generated corpus case: the 9,238 bytes left under the corpus's 8 MiB cap cannot reach the 16 MiB html bound. Unit cases and 25 mutation rows pin it instead.
  - **C29: PD9, heading ids follow the runtime's Unicode tables.** The slug keeps `\p{L}` and `\p{N}` and lower-cases the way the runtime does. So a code point that was unassigned in Unicode 15.0, the reference's version, can appear in an id where the reference dropped it, and two runtimes with different Unicode versions can disagree. It is documented in the README, with a unit case gated on the runtime's Unicode version, and no code change. No golden reaches it. This makes the departure list PD1-PD9.
  - **C30: highlight span depth is accepted and documented.** A single highlighted line of 256 units can nest highlight.js spans up to about 170 deep. That is above C21's 64, but C21 covers the allowlisted tags only. The line cap and the whole-block threshold bound it, well under browsers' parse limits. The README states the bound.
  - **Fixed within existing constraints:** the CI consumer smoke installs with a 14-day `--before`, and its checkout keeps no credentials. The whole-block threshold is pinned by its literal size. A comment in the shipped types is reworded. The README tells hosts to size `maxBytes` to their heap.
- **Coordinator notes for L1 (2026-10-14).**
  - C26's generated cases ship at 7,000 references and definitions and at 8,000 inline notes, not the sizes C26 names. The 8 MiB corpus cap leaves no room for the larger ones. The deterministic linearity test is the primary guard.
  - The browser-parity sandbox is created with a null prototype, so no host `Function` is reachable from inside it. This is a test-only hardening.

- **C31-C37 (2026-10-14, the coordinator's review of L1, run 458).** The held-out panel confirmed 17 findings. The run goes back for one fix round.
  - **Two critical findings, fixed within existing rulings, so they get no new number:**
    - C21's inline cap counted the task-list checkbox, so from the 65th task item on, every checkbox rendered as escaped text. That is a parity bug that ordinary checklists reach. The cap counts only the allowlist's own tags.
    - C28's caption decision still rendered a whole link or image at parse time, so figures that share one long reference destination cost figures times length: 9.6 s in `render()` and 12.3 s in `scanRefs()` from 114 KB. After the first child, the decision reads only text, and it rejects any other token without rendering it. Output is identical, and a deterministic count of parse-time renders pins it.
  - **C31: front-matter keys are capped like values.** A key built from aliases grew to millions of characters from 20 KB, taking 4-6 s and up to about 0.9 GB. Keys are cut to the value cap before escaping. This is part of PD8, because only hostile documents reach it. Cost if wrong: a key over the cap renders cut, where the reference renders it whole.
  - **C32: PD2 also covers U+2028 and U+2029.** PyYAML treats them as line breaks and js-yaml does not, which is the same loader class as U+0085 under C17. A unit case pins both outputs.
  - **C33: a mapping used as a key fails the load.** It loaded as the key `[object Object]`, which no author wrote. PyYAML refuses the block, so this restores parity, through the same path as a tag outside the schema. No departure.
  - **C34: the published types resolve under a strict consumer.** The packed declarations import types from `@types/markdown-it` and `@types/js-yaml`, which were devDependencies, so a consumer that does not set `skipLibCheck` failed to typecheck. Both become dependencies, exact-pinned under C6 and C7, and CI's consumer smoke gains a strict `tsc` check.
  - **C35: PD9 covers every Unicode table that follows the runtime.** That is heading ids, caption digits (`\p{Nd}`) and reference-label case folding, with a case per surface, gated on the runtime's Unicode version. This follows C29's choice to document rather than freeze.
  - **C36: PD6 covers markdown-it's own Unicode tables.** Emphasis flanking uses uc.micro's punctuation and symbol tables, in which five Unicode 15.1 symbols differ from Python 3.12. This is engine residue like PD6's labels, and it does not depend on the runtime. Five unit cases pin both outputs.
  - **C37: the rulings' mutation rows are recorded in the repository.** The 81 rows that C24-C30 and the review added lived only in the workspace's untracked files. They are appended to the L1 plan in a results section on the branch, so `main` keeps every row's definition after the merge.
  - **Smaller items, fixed:**
    - the comments that said no parse rule renders, or that a token's html is a few times its source;
    - PD8's "64 levels" wording, since a footnote reference's `<sup>` is the plugin's;
    - the README's PD2 row, which now lists C17's loader items;
    - the `frontmatter-types` pin text.
  - **The worker's own rulings stand.** The null-prototype sandbox stands. C28 needs no corpus case once the render-count case exists. The downsized generated cases are secondary to the deterministic guards. The threshold of 256 stands. The consumer-smoke header stays as it is.

- **C38 (2026-10-14, during L1's fix round 1): PD2's C17(e) covers the order within a multi-source merge list.** With `<<: [{a: 1, c: 1}, {a: 2, b: 2}]`, the reference lists a, b, c, and `render()` lists a, c, b. With `x: 0` then `<<: [{a: 1}, {b: 2}]`, the reference lists b, a, x, and `render()` lists x, a, b. The values are identical; only the order differs. PyYAML reverses a merge list's sources and puts merged keys first. Ruled: C17(e) now reads that merged keys follow JavaScript's object order. A late `<<` puts them last, and a multi-source list keeps its sources' order. Unit cases pin both outputs, and the README's PD2 row lists it. Why: this is the same class C17 accepted, from js-yaml and the object order rather than from a guard. Cost if wrong: front-matter key order differs from the reference for merge lists, which no golden reaches.

- **C39 (2026-10-15, the coordinator's re-review of L1's fix round, run 464): a sequence as a merge source fails the load.** A `<<` merge list that held a sequence merged it as a mapping with keys `0`, `1` and so on. For example, `tags: &t [alpha, beta]` then `<<: [*t]` rendered `0: alpha` and `1: beta`. PyYAML refuses that block ("expected a mapping for merging"), so the reference renders nothing. Ruled: a merge source that is not a mapping fails the load, through the same path as C33. That restores parity, so it is no departure. A unit case pins both outputs. Why: C33 chose parity over documenting for a key shape that no author means, and this is the same kind of shape. Cost if wrong: such a block renders nothing, as it does in the reference.
- **Notes on the same re-review (2026-10-15).**
  - The remaining findings are minor and fixed in a short second round: comment and record wording; a guard that no case reddened, which is removed; the C32, C36 and C38 cases now hold the reference's output in their assertions, not in comments; and the C37 record now states the mutation runner's two changes (a large output buffer, and a killed run reported as not red).
  - Stock xml `<script>` and `<style>` content under C24 rendered in 0.3 to 1.5 s at the 256 KiB budget with highlight.js 11.12.0. That is within budget and needs no ruling. No generated case covers xml, because the corpus cap leaves too little room.

- **L1 merged (2026-10-15).** The last review (run 469) found three minor items, and they are carried into L2's first task rather than held for another round:
  - Close C39's parity gap. The refusal sits under a key that a block can spell itself, through a YAML escape, an earlier merge source or a separate earlier `<<` pair. The reviewer measured a one-line fix: a key no block under `FM_MAX_CHARS` can spell, such as `'\u0000'.repeat(2 * FM_MAX_CHARS)`, closes every route. With it the reference matches, the front-matter tests pass and the cost does not rise.
  - C38's case also pins the reference's `frontList` (test-only).
  - The R7 comment says the reference keeps the uncut key (wording).

## Carried constraints (reviewers get these)

- Public-ready text from the first commit (`CLAUDE.md`): no hosts, users, private paths, project lists, issue-tracker workspaces, private product names or operator defaults.
- Pure library: no network, storage backend, auth, git or hosting.
- One raw-HTML allowlist, identical in Node and the browser.
- Browser code is CSP-safe: no `innerHTML`, `eval` or inline handlers.
- The corpus is the contract: a golden change is stated, and a hostile verdict never weakens.

## Next-wave brief (L2)

L1 merged on 2026-10-15 as `89a9db6f4`. L2's run is opened before L1's closes, and its plan is written next. The plan must:
- start with the three items carried from L1's last review, closing C39's parity gap first;
- keep C1-C39 and PD1-PD9 binding;
- build on `main` at or after `89a9db6f4`.

The reference renderer, departures and repository-settings rules are the same as L1's: C5, C-numbers before any file moves, and C4. Routing is set when the plan is written.
