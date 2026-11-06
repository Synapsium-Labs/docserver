---
type: Decision log
---

# Decision log

## In short

Every ruling on docserver's design, its conformance contract, its build and its release, one Markdown file each, named by its ID (`C84.md`). This page is the index. Read it on GitHub, in any host that renders Markdown with docserver, or locally as a rich page: `npm run decisions`, then open `decisions-out/index.html`.

The rulings C1 to C114 were moved here from the programme ledger (`docs/superpowers/programs/docserver.md`) with their wording kept. The ledger keeps the waves and the checkpoints.

## Areas and statuses

| Area | Covers |
|---|---|
| render | `./render`: the Markdown rules and the engine |
| corpus | `./conformance`: the golden corpus, the hostile cases and the departures (PD1 to PD8) |
| layout | `./enhance` and `assets/reader.css`: the rich reading layout |
| frame | `./frame`, `./host` and `./highlight`: the sealed reader frame and its parent |
| build | Dependencies, CI and the build box |
| release | Publishing, signing, provenance and versions |
| process | How waves, reviews and merges run |

| Status | When it applies |
|---|---|
| Accepted | In force as written |
| Amended | In force, with parts changed by a later decision (`amended-by`) |
| Open | In force, with work still owed |
| Deferred | Ruled, not yet carried out |
| Withdrawn | No longer in force (`superseded-by`) |

## Decisions

Newest first. Status counts and filters are in the reader's Index (`i`).

| ID | Decision | Date | By | Wave | Area | Status |
|---|---|---|---|---|---|---|
| C114 | [The 1.1 wave is accepted and merged; review 1499's items are owed to the first 1.1.x patch](C114.md) | 2026-11-05 | coordinator | 1.1 | process | Open |
| C113 | [Review 1494: the findings and how each was ruled](C113.md) | 2026-11-05 | coordinator | 1.1 | process | Accepted |
| C112 | [Review 1480: the findings and how each was ruled](C112.md) | 2026-11-05 | coordinator | 1.1 | process | Accepted |
| C111 | [A push went out before its public-text check was read, fixed forward](C111.md) | 2026-11-05 | coordinator | 1.1 | process | Accepted |
| C110 | [How the wave pushed, and Task 6's fix rounds](C110.md) | 2026-11-05 | coordinator | 1.1 | process | Accepted |
| C109 | [The version is 1.1.0, superseding C103 (6)](C109.md) | 2026-11-05 | coordinator | 1.1 | release | Accepted |
| C108 | [Item C, one header bar for a host that has its own](C108.md) | 2026-11-05 | coordinator | 1.1 | layout | Accepted |
| C107 | [Item B, Mermaid drawn after `ready`](C107.md) | 2026-11-05 | coordinator | 1.1 | layout | Accepted |
| C106 | [Item A, U+2028 and U+2029 join the copy check, superseding C103 (4)](C106.md) | 2026-11-05 | coordinator | 1.1 | frame | Accepted |
| C105 | [The batch runs as one wave on one branch and one PR](C105.md) | 2026-11-04 | coordinator | 1.1 | process | Accepted |
| C104 | [The batch release plan is approved, every question as recommended](C104.md) | 2026-11-04 | operator | 1.1 | process | Accepted |
| C103 | [The copy check flags the directional marks and the tag characters](C103.md) | 2026-11-02 | operator | 1.1 | frame | Amended |
| C102 | [v1.0.0 is released](C102.md) | 2026-10-31 | coordinator | L3 | release | Accepted |
| C101 | [Task 15 steps 1 to 3, and the operator's answers](C101.md) | 2026-10-29 | operator | L3 | release | Accepted |
| C100 | [After Task 14, the release preparation](C100.md) | 2026-10-28 | coordinator | L3 | build | Accepted |
| C99 | [Task 14's rulings](C99.md) | 2026-10-28 | coordinator | L3 | release | Accepted |
| C98 | [Task 12's rulings](C98.md) | 2026-10-28 | coordinator | L3 | release | Accepted |
| C97 | [Task 10's rulings](C97.md) | 2026-10-28 | coordinator | L3 | frame | Accepted |
| C96 | [Task 8 part 2's rulings, after C95](C96.md) | 2026-10-28 | coordinator | L3 | frame | Accepted |
| C95 | [Task 8's rulings](C95.md) | 2026-10-28 | coordinator | L3 | frame | Accepted |
| C94 | [Task 16's rulings](C94.md) | 2026-10-28 | coordinator | L3 | frame | Accepted |
| C93 | [Task 13 (Mermaid 12.2.0) is deferred past v1](C93.md) | 2026-10-27 | coordinator | L3 | frame | Deferred |
| C92 | [Task 11's and Task 7's rulings](C92.md) | 2026-10-27 | coordinator | L3 | frame | Accepted |
| C91 | [Task 2's and Task 6's rulings](C91.md) | 2026-10-27 | coordinator | L3 | frame | Accepted |
| C90 | [Task 5's rulings](C90.md) | 2026-10-27 | coordinator | L3 | frame | Accepted |
| C89 | [The browser install's apt cache refreshes weekly](C89.md) | 2026-10-27 | coordinator | L3 | build | Accepted |
| C88 | [Task 9's rulings](C88.md) | 2026-10-27 | coordinator | L3 | frame | Accepted |
| C87 | [The seed's html cap follows the plan's formula](C87.md) | 2026-10-27 | coordinator | L3 | frame | Accepted |
| C86 | [Task 1's three rulings](C86.md) | 2026-10-27 | coordinator | L3 | frame | Accepted |
| C85 | [L3 runs on the plan as written](C85.md) | 2026-10-26 | coordinator | L3 | process | Accepted |
| C84 | [The repository becomes public after all; C83 is withdrawn](C84.md) | 2026-10-26 | operator | L3 | release | Accepted |
| C83 | [The library's repository stays private](C83.md) | 2026-10-26 | operator | L3 | release | Withdrawn |
| C82 | [The click guard prevents a link's activation whatever the button](C82.md) | 2026-10-26 | coordinator | L3 | frame | Accepted |
| C81 | [The L3 design rulings](C81.md) | 2026-10-26 | coordinator | L3 | frame | Accepted |
| C80 | [Accept the completed reviews whatever runtime model ran them](C80.md) | 2026-10-26 | operator | L2 | process | Accepted |
| C79 | [Allow one integration squash while preserving the original feature history](C79.md) | 2026-10-26 | operator | L2 | process | Accepted |
| C78 | [Distinguish redundant post-await conjuncts from independently required guards](C78.md) | 2026-10-25 | coordinator | L2 | layout | Accepted |
| C77 | [Interactive parity corrects overlay and rail sizing, not the comparison contract](C77.md) | 2026-10-25 | coordinator | L2 | layout | Accepted |
| C76 | [Preserve normal prose flow when placing the desktop rail](C76.md) | 2026-10-25 | coordinator | L2 | layout | Accepted |
| C75 | [Retain the breached evidence and raise the cumulative acceptance-artifact ceiling from 5 MiB to 6 MiB](C75.md) | 2026-10-25 | operator | L2 | build | Accepted |
| C74 | [Snapshot review records every approved change, while trailers name only actual ratchet moves](C74.md) | 2026-10-25 | coordinator | L2 | corpus | Accepted |
| C73 | [The progressive edge rule must win the figure cascade](C73.md) | 2026-10-25 | coordinator | L2 | layout | Accepted |
| C72 | [Fullscreen owns pointer qualification for its diagram blocks](C72.md) | 2026-10-25 | coordinator | L2 | layout | Accepted |
| C71 | [The feature-registration control accepts the completed layout, not a permanent stub](C71.md) | 2026-10-25 | coordinator | L2 | layout | Accepted |
| C70 | [Fullscreen SVG cloning may rebind existing clone-local references through one internal journal operation](C70.md) | 2026-10-25 | coordinator | L2 | layout | Accepted |
| C69 | [Acceptance uses bounded existing tools, not another repository-copy campaign](C69.md) | 2026-10-25 | coordinator | L2 | build | Accepted |
| C68 | [The final corpus records the completed reader controls, not the earlier stubs](C68.md) | 2026-10-25 | coordinator | L2 | corpus | Accepted |
| C67 | [Rail follow and reader work may use separate frames](C67.md) | 2026-10-23 | operator | L2 | layout | Accepted |
| C66 | [Service probes disable the real settings owner only when supplying its stand-in](C66.md) | 2026-10-22 | coordinator | L2 | process | Accepted |
| C65 | [Attention may complete its pre-fold joins synchronously at the settings boundary](C65.md) | 2026-10-21 | coordinator | L2 | layout | Accepted |
| C64 | [A scrim close may restore focus from its exact reader root](C64.md) | 2026-10-21 | coordinator | L2 | layout | Accepted |
| C63 | [Relayout may distinguish an already-measured startup width from a genuine first root-width change](C63.md) | 2026-10-21 | coordinator | L2 | layout | Accepted |
| C62 | [The source-only fold correction has a bounded core writer scope under C60](C62.md) | 2026-10-21 | coordinator | L2 | layout | Accepted |
| C61 | [Task 18 may correct two physical-input premises in `test/browser/rail-interaction.test.ts`, without accepting rail behavior](C61.md) | 2026-10-21 | coordinator | L2 | process | Accepted |
| C60 | [Fold reading counts use pre-feature source, and stored folds are validated before controls are created](C60.md) | 2026-10-21 | operator | L2 | layout | Accepted |
| C59 | [Task 19 may correct only the Aa colour-key heading selector in `assets/reader.css`](C59.md) | 2026-10-21 | coordinator | L2 | layout | Accepted |
| C58 | [Task 18's recovery correction is a bounded C54 shared-test exception, not implementation approval or Task 18/group D acceptance](C58.md) | 2026-10-21 | coordinator | L2 | process | Accepted |
| C57 | [Task 19 may correct only the Product-lens path and table-code selectors in `assets/reader.css`](C57.md) | 2026-10-21 | coordinator | L2 | layout | Accepted |
| C56 | [Task 18's narrow scroll-oracle correction is an explicit C54 shared-test exception, not Task 18 or group D acceptance](C56.md) | 2026-10-21 | coordinator | L2 | process | Accepted |
| C55 | [The group D handoffs](C55.md) | 2026-10-21 | coordinator | L2 | process | Accepted |
| C54 | [The second group C merges](C54.md) | 2026-10-21 | coordinator | L2 | process | Accepted |
| C53 | [The first group C merges](C53.md) | 2026-10-20 | coordinator | L2 | process | Accepted |
| C52 | [Task 8 as built, and the merge order within a group](C52.md) | 2026-10-20 | coordinator | L2 | layout | Amended |
| C51 | [WebKit runs on the build box after all, in the Playwright image; C45 is narrowed](C51.md) | 2026-10-20 | coordinator | L2 | build | Accepted |
| C50 | [The coordinator merges L2 without waiting, and Question 1 takes its default](C50.md) | 2026-10-20 | operator | L2 | process | Amended |
| C49 | [The shared services as built](C49.md) | 2026-10-20 | coordinator | L2 | layout | Accepted |
| C48 | [The seams as built](C48.md) | 2026-10-20 | coordinator | L2 | layout | Accepted |
| C47 | [Task 5's interface, as built, replaces the plan's wording](C47.md) | 2026-10-20 | coordinator | L2 | layout | Accepted |
| C46 | [PD8 covers PyYAML's simple-key limit](C46.md) | 2026-10-20 | coordinator | L2 | corpus | Accepted |
| C45 | [The build box runs the browser tests in Chromium only, by explicit selection; CI runs Chromium and WebKit](C45.md) | 2026-10-20 | coordinator | L2 | build | Amended |
| C44 | [Defaults for the four questions the operator has not answered](C44.md) | 2026-10-20 | coordinator | L2 | layout | Accepted |
| C43 | [The prototype's design, as shipped on #13, is binding for the rest of L2](C43.md) | 2026-10-20 | coordinator | L2 | layout | Accepted |
| C42 | [`destroyEnhancement(root)` returns `Promise<void>`, which settles after cleanup](C42.md) | 2026-10-19 | operator | L2 | layout | Accepted |
| C41 | [The reference's warm colour palette is kept exactly, in light and dark](C41.md) | 2026-10-19 | operator | L2 | layout | Accepted |
| C40 | [Prototype first](C40.md) | 2026-10-19 | operator | L2 | process | Accepted |
| C39 | [A sequence as a merge source fails the load](C39.md) | 2026-10-15 | coordinator | L1 | corpus | Accepted |
| C38 | [PD2's C17(e) covers the order within a multi-source merge list](C38.md) | 2026-10-14 | coordinator | L1 | corpus | Accepted |
| C31 | [The coordinator's review of L1, run 458](C31.md) | 2026-10-14 | coordinator | L1 | render | Accepted |
| C28 | [L1's whole-branch review](C28.md) | 2026-10-14 | operator | L1 | render | Accepted |
| C27 | [The public-readiness walk skips a `.git` file and named root scratch directories](C27.md) | 2026-10-14 | coordinator | L1 | build | Accepted |
| C26 | [`footnote_tail` is ported so that its cost is linear](C26.md) | 2026-10-14 | coordinator | L1 | render | Accepted |
| C25 | [PD7 also covers a caption that is not one emphasis span](C25.md) | 2026-10-14 | coordinator | L1 | corpus | Accepted |
| C24 | [Highlighting is bounded line by line](C24.md) | 2026-10-14 | coordinator | L1 | render | Accepted |
| C23 | [PD6 covers reference-label normalisation](C23.md) | 2026-10-12 | coordinator | L1 | corpus | Accepted |
| C22 | [Ids keep parity in L1](C22.md) | 2026-10-12 | coordinator | L1 | render | Accepted |
| C21 | [Allowlisted tags nest at most 64 deep](C21.md) | 2026-10-12 | coordinator | L1 | render | Accepted |
| C20 | [An output bound](C20.md) | 2026-10-12 | coordinator | L1 | render | Accepted |
| C19 | [PD8, resource bounds that only hostile documents reach](C19.md) | 2026-10-12 | coordinator | L1 | corpus | Accepted |
| C18 | [A purity finding](C18.md) | 2026-10-12 | coordinator | L1 | render | Accepted |
| C15 | [PD2 restated](C15.md) | 2026-10-12 | coordinator | L1 | corpus | Accepted |
| C14 | [A corpus defect](C14.md) | 2026-10-12 | coordinator | L1 | corpus | Accepted |
| C13 | [A bug found in planning](C13.md) | 2026-10-12 | coordinator | L1 | render | Accepted |
| C12 | [PD7, captions never cross the end of a tight list](C12.md) | 2026-10-12 | coordinator | L1 | corpus | Accepted |
| C11 | [Timing backstops](C11.md) | 2026-10-12 | coordinator | L1 | corpus | Accepted |
| C10 | [PD6, whitespace that markdown-it trims before a rule can see it](C10.md) | 2026-10-12 | coordinator | L1 | corpus | Accepted |
| C9 | [PD5, tag-name case folding](C9.md) | 2026-10-12 | coordinator | L1 | corpus | Accepted |
| C8 | [The engine's rule chain](C8.md) | 2026-10-12 | coordinator | L1 | render | Accepted |
| C6 | [Dependency pins](C6.md) | 2026-10-12 | coordinator | L1 | build | Accepted |
| C5 | [The reference renderer is passed by argument only](C5.md) | 2026-10-12 | coordinator | L1 | corpus | Accepted |
| C4 | [Repository settings](C4.md) | 2026-10-12 | coordinator | L1 | process | Accepted |
| C3 | [Defaults](C3.md) | 2026-10-12 | coordinator | L1 | render | Accepted |
| C2 | [Shape](C2.md) | 2026-10-12 | coordinator | L1 | render | Accepted |
| C1 | [PD1-PD4 accepted](C1.md) | 2026-10-12 | coordinator | L1 | corpus | Accepted |

## Adding a decision

1. Take the next free number: one more than the highest ID in the table above.
2. Write `docs/decisions/C<n>.md` with this front matter, then a level-1 heading `# C<n>: <title>` and the sections `## Decision`, `## Why` and `## Cost if wrong`:

   ```yaml
   ---
   type: Decision
   id: C115
   date: 2026-11-06
   by: coordinator        # or operator
   wave: "1.1"
   area: layout           # one of the areas above
   status: accepted       # one of the statuses above
   supersedes: [C83]      # optional; also superseded-by, amends, amended-by
   ---
   ```

3. Add its row at the top of the table, and give every decision it supersedes or amends the reverse key (`superseded-by` or `amended-by`) and the new status.
4. Link other decisions with relative links (`[C84](C84.md)`), so the links work on GitHub, in a host and in the local build.

`test/decisions.test.ts` checks every file against this page: ids, keys, statuses, relations both ways, the table's rows and links.
