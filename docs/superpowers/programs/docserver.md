# Program: docserver

Spec: [Rich Docs reader and a shared renderer](https://github.com/Synapsium-Labs/ccrc-pwa/blob/main/docs/superpowers/specs/2026-10-12-rich-docs-reader-and-shared-renderer-design.md), §3 (the library) and §8 (sequencing). It was approved by the operator on 2026-10-12 (R-g).
Plan: one plan per wave, under `docs/superpowers/plans/`.
Coordinator: ccrc session `ccrc-pwa-calm-canyon`. It also coordinates ccrc's `native-docs-reader` programme, which is this library's first consumer.

## Waves

| # | scope | PRs | state |
|---|---|---|---|
| L1 | Scaffold and rules. A TypeScript package with ESM entry points and `.d.ts`. `render()` on markdown-it with the raw-HTML allowlist, alerts, figure captions, front matter, heading ids, `data-line` attributes and `meta`. The conformance corpus: golden HTML generated from today's renderer, hostile cases, and `runCorpus()`. CI. Plan: [`2026-10-12-docserver-l1-rules-and-corpus.md`](../plans/2026-10-12-docserver-l1-rules-and-corpus.md), 12 tasks. | plan: #1 | **plan merged** 2026-10-13 (`00fa66cb2`), approved by the operator. Run 414 is open; its dispatch waits for a fleet slot |
| L2 | The layout. `enhance(root, options)` made embeddable: host adapters, namespaced storage keys, operator-specific defaults scrubbed into off-by-default options, CSP-safe. The styles, and the fonts with `OFL.txt`. A self-hosted single-file Mermaid with pinned limits. `THIRD-PARTY-NOTICES`. | — | after L1 |
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

## Carried constraints (reviewers get these)

- Public-ready text from the first commit (`CLAUDE.md`): no hosts, users, private paths, project lists, issue-tracker workspaces, private product names or operator defaults.
- Pure library: no network, storage backend, auth, git or hosting.
- One raw-HTML allowlist, identical in Node and the browser.
- Browser code is CSP-safe: no `innerHTML`, `eval` or inline handlers.
- The corpus is the contract: a golden change is stated, and a hostile verdict never weakens.

## Next-wave brief (L1)

For run 414. The brief carries the wave's specifics only; the standing protocol is the worker skill's.
- **Plan:** `docs/superpowers/plans/2026-10-12-docserver-l1-rules-and-corpus.md` at `00fa66cb2`. Run Tasks 1-12 in order, then the held-out whole-branch review, the final gate and the whole mutation table, then the close.
- **Base:** `main` at `00fa66cb2`, a fresh workspace.
- **Routing:** an Opus·high main loop with Sonnet·high implementers. Opus·high task reviewers and the whole-branch review. Workflows off. Never Fable.
- **The reference renderer** is supplied on command lines only (C5). Its pins were measured equal to the plan's on 2026-10-13. If a hash or version differs, the worker stops and asks.
- **Departures:** no D-numbers here. The allocator for this project is not seeded by design (2026-10-13, the allocator answered `not-seeded`). A departure comes to the coordinator as a question and becomes C24 onward in this ledger before any file moves.
- **Repository settings:** none changed (C4). The merge is the coordinator's, with the `Goldens-moved:` body the plan describes.
