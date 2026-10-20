# docserver L2 — the layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task by task. The coordinator runs each task through its own workflow: an implementer subagent, a held-out review panel, then a fix round ("How this wave runs"). The plan is lean by design (C40): it holds no implementation code. Each task is built as running code, tests, mutation rows and a visual comparison, as the prototype on PR #13 was.

**Goal:** Ship `@synapsium-labs/docserver/enhance` as the whole reading layout, embeddable in any host. Every ambient API of the reference layout becomes a host adapter or a stated option, and operator-specific vocabulary becomes options, off or neutral by default. L2 also ships the self-hosted single-file Mermaid with pinned limits and its notices, and Level 2 of the corpus: `enhance()` to a structural DOM in a real browser.

**Architecture:** The prototype (PR #13) built the core, and C43 makes its design binding: the lifecycle, the journal, reader state behind the host's storage, the first features (editorial core, status marks, folds) and `assets/reader.css` (the reference stylesheet, scoped to `[data-docreader-root]`). L2 adds options and host adapters (Task 5); seams and shared services (Tasks 7a, 7b): the root's window behind one module, feature registration in the final build order, every word list, the registries, reveal, overlays, keys, navigation, relayout, heading controls and the bar skeleton; and the features (Tasks 8-23), each filling its own stub so parallel tasks touch disjoint files. Real sizes are tested in Chromium and WebKit through a pinned `playwright-core` (Task 6). L3 owns `frameDocument()`, the frame bootstrap and click guard, `mountDocFrame()`, `assets.json`, publishing and the public flip.

**Tech Stack:** Node `>=22`; CI runs Node 22 and 24. L1's exact pins stay (`package.json`). L2 adds `playwright-core` 1.63.0 (published 2026-09-04, Task 6; it pins the Chromium and WebKit builds) and `mermaid` 12.1.0 (published 2026-10-02, Task 15; the reference's version, a dev dependency because the package ships the file built from it). New pins install with `--before=2026-10-06T00:00:00Z`, 14 days before this plan (C6, C7); a later task uses a cutoff 14 days before its own date and keeps these versions. Fonts: Fontsource 5.3.0, faces named Docreader Serif and Docreader Sans (C43). **One-time local setup** for the browser tests: `npx playwright-core install chromium webkit`, plus WebKit's system libraries (`npx playwright-core install-deps webkit`, as root); CI runs both.

**Spec:** [Rich Docs reader and a shared renderer](https://github.com/Synapsium-Labs/ccrc-pwa/blob/main/docs/superpowers/specs/2026-10-12-rich-docs-reader-and-shared-renderer-design.md): §3.2 the API and options, §3.3 what the library excludes, §3.4 the rules (Mermaid configuration), §3.5 the corpus (Level 2), §3.6 packaging, §3.7 the scrub list.

**Ledger:** [`docs/superpowers/programs/docserver.md`](../programs/docserver.md). C1-C39 and PD1-PD9 stay binding; C40-C44 are L2's rulings.

## Global Constraints

- **Public-ready** text in every tracked file, commit and PR body (`CLAUDE.md`). The reference layout is never named: call it "the reference layout", cite its numbered sections, and never copy its private vocabulary, examples or comments. It is passed by argument only (C5): the coordinator runs it on a temporary copy of the same neutral sample.
- **Pure.** No network, `fetch`, storage API, `location`, `history`, cookies or URLs of the library's own.
- **CSP-safe.** No `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `Function`, inline handlers, style attributes or `cssText`. Styles go only through `journal.setStyle` (LD11).
- **Import-inert** (the walls test). **Root-scoped:** a feature writes inside the root, reaches the window only through `ctx.env`, and finds elements by walking, never by a document id or a selector built at run time.
- **No ids on the document's nodes.** Chrome ids are per instance and checked against the document's ids (C22).
- **Every write is journaled.** Source nodes are only moved or split. Listeners use `journal.listen`, timers `ctx.env`, host calls `ctx.host`, and `live()` is checked after each call-out.
- **Several roots per page.** No module-level state but WeakMap registries; a keydown, overlay or generated id never crosses roots.
- **Host data is untrusted.** Every value from a host call or from storage is checked for shape, type, count and length.
- **No network in tests.** The no-network setup stays for the test process. Pages load only from `https://docreader.test/`, which `page.route` fulfils from disk; every other routed request is aborted, and the browser processes resolve no host (Task 6).
- **Tests** run as `./node_modules/.bin/vitest run [file]`, in the foreground; `npm run typecheck` covers all three projects. Exact pins, 14 days old (C6, C7), a committed lockfile, `npm ci` in CI.
- **Mutation discipline.** Every guard ships with a case that goes red without it. Rows are `L2-T<n>-M<k>` in `docs/superpowers/plans/l2-mutations/task-<n>.md`, in the prototype's format (a table, then its JSON fence, per section), measured with the L1 plan's `mutate.mjs` (Task 1, Step 8). A green row gets a new case or is reported, never dropped. `mutate.mjs` copies tracked and untracked files but never ignored ones, and counts any non-zero exit as red, so a row whose tests load the built Mermaid file runs `npm run build:mermaid && ./node_modules/.bin/vitest run …`, and its task records one green control run of that command in an unmutated copy.
- **The corpus is the contract.** No L2 task moves a golden without a C-ruling first and a `Goldens-moved:` trailer. Level 2 cases are under the ratchet (Task 6): a moved case is named in a `Layout-moved:` trailer, and a hostile case is never removed and its input never edited.
- **Visual parity.** On the neutral sample, what a task builds has the reference's computed values and boxes, to 0.1 px, in each state the task names. A difference that LD10 makes is listed by its task as expected and reported by name; the reading column and each component's inner boxes are still held to 0.1 px.
- **Commits.** Files staged by name; subject `<area>: <what> (docserver L2 T<n>)`; the writer's `Co-Authored-By:` trailer. No task pushes. Never `git stash`, `reset --hard` or `checkout --`. No Docker.

## Review Focus

Conditions likely to bite a reader that no test exercises yet, each given a test in the task named.

| # | Condition | Risk | Test in |
|---|---|---|---|
| RF1 | Document ids `__proto__`, `constructor`, `toString`, or a chrome class name (`jump`, `keys`, `xcard`, `toc-contents`). | State keyed by id pollutes a prototype or loses a mark; a hash lookup returns chrome. | 14 (`initialHash`, `goToHash`); 18 (marks round-trip) |
| RF2 | Two enhanced roots in one document. | A keydown, the Escape order, a radio group or a generated id reaches the other root. | 7a (`chromeId`); 16 (`/` and Escape); 19 (radio groups) |
| RF3 | A 1.5 MB plan with 2,000 IDs, 300 terms and 1,000 steps (7b's fixture). | The xref walk, the glossary pattern, the outline and the scroll spy grow with it. | 11 (outline); 13 (startup; 2× document ≤ 2.5× time); 12 (rect reads per frame O(log n)) |
| RF4 | Hostile host data: `changes()` with NaN, inverted or 10^6 ranges; 10^5 commits with 1 MB subjects; a stored position or marks value of the wrong shape, oversized, or with selector characters. | Unbounded loops, or a host value reaching a selector or the DOM. | 20; 22; 14 (position); 18 (marks) |
| RF5 | An async completion after destroy: `copy()`, `changes()`, Mermaid `load()` or a render, a font wait, a timer, a frame or an idle callback. | A write or a host call after teardown. | 7a (`env`); 7b (fonts); 10, 23 (`copy`); 20; 21 |

## Decisions this plan makes (LD1-LD12)

The coordinator rules these by merging this plan. Changing one later needs a C-ruling.

| ID | Decision | Why | Cost if wrong |
|---|---|---|---|
| LD1 | **Seams first.** Task 5 declares every remaining §3.2 option; Task 7a stubs each later feature's file in the final build order (`features.ts`) and holds every word list; Task 7b builds the shared services. A feature task touches only its own files and those the writers list gives it. | Nine feature tasks run side by side, and the build order is decided once. | A seam can prove wrong before its feature exists. The fix is additive, in the feature's PR. |
| LD2 | **Real-browser tests drive `playwright-core` from vitest**: a fourth project, `layout`, run last, Chromium and WebKit, in the default run. A missing browser is a red naming the install command, never a skip. | jsdom has no layout; the first consumer's readers use Safari. A pipe, not a socket, drives the browser. | Minutes of CI time, and a one-time browser install. |
| LD3 | **The library bundles Mermaid** with esbuild into one uncommitted ESM file, `assets/mermaid/mermaid.mjs`, at build time; `elkjs` becomes a stub, and the metafile names every package for the notices. | Mermaid 12.1.0 depends on `elkjs` (EPL-2.0), which §3.6 excludes. | A diagram that asks for the ELK layout shows the failure note. |
| LD4 | **The host passes the file, never a URL:** `mermaid.load(): Promise<module>`. | The library holds no URLs. | Other hosts write a one-line loader. |
| LD5 | **`enhance()` resolves when the layout is built.** Diagrams and `changes()` replies come in a second phase, inside operations, `live()` checked after each await; `data-docreader-diagrams` on the root reads `drawing`, `drawn`, `partial` or `failed`. Showing the root is the host's call; relayout re-measures when the fonts arrive. | Startup stays one synchronous operation. | A host waiting for diagrams reads an attribute. |
| LD6 | **Deep links without ids.** `nav.byId(id)` resolves a document id, then an ID in `ctx.index`. | Links to rules and rows work with no ids written. | A document id equal to a defined ID wins. |
| LD7 | **Back goes through the host.** `onHash(id, { push, from })` hands over an opaque position token for the entry being left; when its history moves, the host calls the new export `goToHash(root, id, from?)`. The full-screen figure makes no history entry. | The frame must not own history (§3.2), and Back still returns to where you were. | The full-screen figure has no Back gesture until an option adds one. |
| LD8 | **One storage: the host's.** Position under `docreader:pos:<posKey>`, reader-wide UI memory under `docreader:ui`, beside C43's two shapes (C43 records all four). Per-document state gains `marks`, `outline`, `ixfold`, `seen`. The comparison in view stays in memory. | §3.2 gives one storage; a host can route `docreader:pos:` keys to session storage. | A reload drops the comparison in view. |
| LD9 | **Vocabulary options are words, never a RegExp:** bounded lists of strings, escaped when compiled. | A host pattern can backtrack without bound. | An unusual ID shape waits for an additive option. |
| LD10 | **`chrome` is `{ bar?, rail?, settings? }`, booleans, default true.** The bar is the root's first child, sticky; the rail is a sticky column from 1,240 px of viewport width and a drawer below it, both inside the root. | It replaces the layout's own bar (§3.2), and the root owns its box (C43). | Tools in a host's own bar need an additive option (the ledger's Question 1). |
| LD11 | **Styles through CSSOM only.** `journal.setStyle(el, prop, value, important?)` is the only `.style` access and restores conditionally. Its closed list, from every style write in the reference: `--thead-h`, `--fig-w`, `--bar-h`, `left`, `top`, `right`, `width`, `max-height`, `transform`, `opacity`, `stroke-dasharray`, `stroke-dashoffset`, and, only with `important`, `fill`, `stroke` and `stroke-width` (the definition dot and ring). A new name is a one-line change with its test, by the task that needs it, under a C-ruling. | A strict CSP allows CSSOM writes but not a style attribute. A class rule cannot beat Mermaid's id-scoped `!important` classDef rules; an `important` CSSOM write can. | One more journal entry kind. |
| LD12 | **`lens` is a fourth pref** (`all` or `product`), reader-wide, shown as the root class `lens-product`. | The reference kept it reader-wide. | An additive change to `Prefs`. |

## Not ported

Reference parts L2 drops on purpose; Task 24's audit covers this table as well as §3.7.

| Reference part | Why | Pinned by |
|---|---|---|
| The classic layout and the design-prototype variants | §3.3: only the default layout ships. | No code exists. |
| The `?variant=` and `?ref=` rewrite of sibling links | §3.3: routing is the host's; `onLink` gets the `href` as written. | Task 14's sibling-link case. |
| Hosted-font CSP allowances | §3.7: the fonts are package files. | Task 6's policies. |
| Performance marks | A host concern. | Task 24's scrub test. |
| The shown, laid-out and ready gates (hidden until fonts, at most 0.7 s) | LD5; relayout re-measures on fonts (7b). | Task 10's font-delay case. |
| The auto-run bootstrap on import | Import-inert. | The walls test. |

## How this wave runs

- **Branches.** One branch and one PR per task. Task 1 branches from `main` (it touches only `src/render/`, its tests and its rows file) and can merge before #13. Every other task stacks on `l2-prototype`, #13's branch, in a stack linear in merge order. A group's tasks are built at the same time from their common parent; before review, each is rebased onto the task before it, which disjoint files keep mechanical. A PR's base is the previous PR's branch, retargeted to `main` when that merges. The coordinator merges after review (C4).
- **Per task.** An implementer subagent builds code, tests first, mutation rows and the visual check; feature tasks put their README text in the PR body. A held-out panel of three Opus lenses reviews (spec and parity; safety and lifecycle; tests, rows and visual evidence), a Sonnet refute pass checks each finding, and one fix round follows.
- **Merge order and parallel groups** are the task table's order and Group column. Tasks in one group run in parallel; a task starts once its "Depends on" have merged or are rebased below it.
- **Shared files and their only writers.** `package.json`, the lockfile, `.gitignore`: 6, then 15. `vitest.config.ts`, `ci.yml`, `public-ready.test.ts`, `scripts/ratchet.mjs` and its test, `scripts/demo/build.mjs`, `scripts/visual/compare.mjs`: 6. `types.ts`, `options.ts`: 5, 7a, 7b, 8. `state.ts`: 5, 7a, 8. `journal.ts`, `features.ts`, `env.ts`, `text.ts`, `status.ts`, the walls test: 7a. `vocab.ts`: 7a, 8. `folds.ts` and the other services: 7b. `bar.ts`: 7b, 12. `nav.ts`: 7b, 14. `editorial.ts`: 7b, 8. `lifecycle.ts`: 5, 7a, 7b, 14. `index.ts`: 14. `README.md`: 5 (options), 6 (setup line), 14 (one line naming `goToHash`), 24. `assets/reader.css`: 7b adds three marker comments; 12 and 18 insert after their own; 21 edits the figure rules. `THIRD-PARTY-NOTICES`, `pack.test.ts`, `consumer-smoke.mjs`: 15, 24. A feature task owns its `src/enhance/<feature>.ts` and **standard files**, by its slug: `test/enhance-<slug>.test.ts`; `test/browser/<slug>.test.ts`; Level 2 cases in `conformance/layout/<slug>/` unless it says none; `scripts/demo/samples/<slug>.md` when no sample shows the feature; `l2-mutations/task-<n>.md`.

## Tasks

| # | Title | Depends on | Group |
|---|---|---|---|
| 1 | Items carried from L1 | `main` at or after `89a9db6f4` | A |
| 2 | The reader stylesheet and fonts (DONE, #13) | none | — |
| 3 | Lifecycle, reader state and folds (DONE, #13) | 2 | — |
| 4 | The editorial core (DONE, #13) | 3 | — |
| 5 | Options and host adapters | #13 | A |
| 6 | Real-browser harness, Level 2 runner, visual compare | #13 | A |
| 7a | Seams: window, registration, state, vocabulary | 5, 6 | B1 |
| 7b | Shared services | 7a | B2 |
| 8 | Vocabulary and namespace options | 7b | C |
| 9 | IDs: rule paragraphs, rules index, ID rows | 7b | C |
| 10 | Tables and code blocks | 7b | C |
| 11 | Plans and outline mode | 7b | C |
| 12 | The bar and scrolling | 7b | C |
| 13 | Cross-references and the glossary | 7b | C |
| 14 | Navigation and reading position | 7b | C |
| 15 | Figures and the Mermaid file | 7b | C |
| 16 | Quick jump and the keys sheet | 7b | C |
| 17 | Preview cards | 13 | D |
| 18 | Read marks and the contents rail | 12 | D |
| 19 | Settings menu, lens and attention marks | 9, 10, 11 | D |
| 20 | Review strip and what changed | 9, 11 | D |
| 21 | Diagrams: drawing | 15 | D |
| 22 | Changes since, and the day view | 20 | E |
| 23 | Diagram tools | 17, 21 | E |
| 24 | Scrub audit, docs, parity and whole-branch review | all | F |

---

### Task 1: Items carried from L1

**Goal.** Close the three items from run 469, L1's last review, closing C39's parity gap first. Branches from `main` at or after `89a9db6f4`; its own PR, merged first.
**Files.** Modify `src/render/frontMatter.ts` and `test/frontmatter.test.ts`. Create `docs/superpowers/plans/l2-mutations/task-1.md`.
**Work.**
1. **C39's gap.** The refusal sits under a key that a block can spell itself: through a YAML escape, an earlier source of the same merge list, or a separate earlier `<<` pair. Make it a key no block under `FM_MAX_CHARS` can spell, such as `'\u0000'.repeat(2 * FM_MAX_CHARS)`, as the reviewer measured. Run the reference renderer by argument (C5) on the three routes and confirm it refuses each.
2. **C38's case** also pins the reference's `frontList` (test only).
3. **The key-cut comment** beside C31's cases says that the reference keeps the uncut key (wording only).

**Tests.** One case per route, each asserting the reference's output; a timing case shows the cost has not risen. The corpus and the ratchet are unchanged.
**Mutation rows.** Restoring the short key reddens the three route cases.
**Done when.** Green on Node 22 and 24, the rows are red, and the PR states that no golden moves.

### Tasks 2-4 — DONE on #13

- **Task 2, the stylesheet and fonts**: the reference stylesheet, ported whole and scoped to `[data-docreader-root]`, sizes in `calc(N * var(--rem))`, the warm palette in light and dark (C41); fonts with `OFL.txt`, hashes and notices. Bar and rail placement are Tasks 12 and 18.
- **Task 3, lifecycle, reader state and folds**: registry, ownership, `enhance`, `destroyEnhancement` (C42), `setEnhancementPrefs`, the journal, write-behind state, folds with `hidden="until-found"`.
- **Task 4, the editorial core**: reading time, title block and byline, the facts panel (list keys only), "In short", "Where things stand", section numbers, status marks, group rows, `cols-2` and stacked tables, the demo. Compared at 1440×1000 and 390×844 in light, dark, and sans with wide.

Rows in `docs/superpowers/plans/l2-prototype-mutations.md`: L2P-M1 to M25 (Task 3); L2P-M26 to M41 and L2P-V1 to V3 (Task 4); the review-fix rows L2P-M42 to M88 cover Tasks 2-4 jointly.

### Task 5: Options and host adapters

**Goal.** Declare, normalise and document every remaining §3.2 option once, and give features one wrapper per host call. Ports the reference prelude's options, as adapters.
**Files.** Modify `src/enhance/types.ts`, `options.ts`, `state.ts` (the `lens` pref), `lifecycle.ts` and `README.md` (options table, storage keys). Create `src/enhance/host.ts`, `test/enhance-options.test.ts`, `l2-mutations/task-5.md`.
**Produces.** New `EnhanceOptions` fields:
- `onLink?(href: string, how: { newTab: boolean }): void`. Absent: the browser follows the link.
- `onHash?(id: string | null, entry: { push: boolean; from: string | null }): void` and `initialHash?: string | null` (LD7).
- `copy?(text: string): void | Promise<void>`. Absent: no Copy buttons.
- `changes?(sha: string): Promise<unknown>` and `openVersion?(v: { sha: string | null; only: string | null }): void`.
- `posKey?: string`, default `storageKey`. `keyboard?: boolean`, default true. `chrome?: { bar?, rail?, settings?: boolean }` (LD10).
- `mermaid?: { load(): Promise<unknown>; maxTextSize?: number; maxEdges?: number; secure?: readonly string[] }`; `secure` only adds keys. Absent: no drawing.
- `rules?: boolean`, default false. `itemLink?(key: string): string | null`.
- `info` gains `sha?`, `draft?`, `history?: readonly { sha; subject; date; parents }[] | null` and `only?`.
- `Prefs` gains `lens: 'all' | 'product'` (LD12).

`FeatureContext.host` wraps `copy`, `changes`, `openVersion`, `onLink`, `onHash` and `itemLink`: safe when absent, a throw or rejection becomes `null`, no call once not live, every result `unknown`. `host.present` is a frozen set of the callbacks given, so a feature decides synchronously whether to build a Copy button or to call `preventDefault` for `onLink`; a `null` result never stands for absence.
**Rules.** A function option is an own data property holding a function, never called while options are read, and called only inside an operation. Numbers are finite and bounded. `history` keeps 100 entries; a sha is 7 to 40 hex characters, or exactly 64 (a SHA-256 repository, which the first consumer's bridge accepts); a subject is cut to 200 code units. Vocabulary options are Task 8's (C44).
**Tests (jsdom).** Each option accepted, and refused for a wrong type, a getter (unread) or an unknown key; inherited properties ignored; no function option runs during the read; each wrapper's swallow, silence after destroy and operation; `host.present`, a callback returning `null` still present; a 64-hex sha accepted, 41 and 63 refused; `lens` stored, restored and checked.
**Mutation rows.** One per guard above.
**Done when.** The demo is pixel-identical; the README lists every option with its default; typecheck, the suite and the walls are green.

### Task 6: Real-browser harness, Level 2 runner, visual compare

**Goal.** A pinned real browser in the suite and CI, the Level 2 runner (§3.5) under the ratchet, and a compare script that takes the reference page by argument (C5).
**Files.**
- Modify `package.json`, the lockfile; `vitest.config.ts`, `test/vitest-config.test.ts` (project `layout`: `test/browser/**/*.test.ts`, `groupOrder` 3, excluded from `unit`); `ci.yml`, `test/ci-workflow.test.ts` (`npx playwright-core install --with-deps chromium webkit`); `.gitignore`, `test/public-ready.test.ts` (`visual-out/`, a named scratch directory, C27); `scripts/ratchet.mjs`, `test/ratchet.test.ts`; `scripts/demo/build.mjs` (`--sample <file>`; `sample.md` moves to `samples/core.md`); `README.md` (the setup line).
- Create `test/browser/harness.ts`, `test/browser/layout-corpus.test.ts`, `conformance/layout/core/*`, `scripts/visual/compare.mjs`, `l2-mutations/task-6.md`.

**Produces.**
- `openDoc(markdown, options, { browser, viewport, csp: 'strict' | 'reader' })` → `{ page, close }`: `render()`, `./enhance` bundled by esbuild, the page, `reader.css` and fonts served from `https://docreader.test/` by `page.route`; any other routed request is aborted. Chromium launches with `--host-resolver-rules=MAP * ~NOTFOUND` and WebKit through a proxy at a closed loopback port, so the browser's own fetches reach no network either. Both policies are `default-src 'none'`, no `'unsafe-eval'`, scripts and fonts from that origin; `strict` refuses inline styles, `reader` allows them (§4.2, for Mermaid).
- `snapshot(root, scope)`: every source node's tag and text (cut to 40 characters), with classes, the chrome mark, role, `aria-*`, `hidden` and `data-docreader-*` recorded only for nodes in the case's `scope` (a class list). Chrome outside the scope is transparent: its children stand in its place and adjacent text joins. So a later feature's chrome never moves an earlier case. No sizes or style values.
- Level 2 cases: `conformance/layout/<slug>/<id>.md`, `<id>.options.json` (the options, the `scope`, and `hostile: true` where it applies) and `<id>.dom.txt`. `UPDATE_LAYOUT=1` writes expected files; CI never sets it. L3 decides whether they ship.
- **The ratchet** covers `conformance/layout/`: a changed `.dom.txt` needs a `Layout-moved: <id>, <id>` trailer naming exactly the moved cases, and a hostile case is never removed and its `.md` and options never change.
- `node scripts/visual/compare.mjs --ours <page> --reference <page> [--states <list>] [--expected <file>]`: screenshots at 1440×1000 and 390×844 in light, dark, and sans with wide, plus named states; computed styles and boxes compared per `data-line` block; output in `visual-out/`; exit 1 on a difference over 0.1 px or in a computed value that `--expected` does not name, which it reports by name.

**Tests.** A page opens in each browser; a routed request to another origin is aborted and counted; one made with routing off for that name fails to resolve; a missing browser fails with the install command; the test process opens no socket. The ratchet's two rules, on fixture histories. First Level 2 cases: the core sample's editorial core, folds and tables. DOM clobbering: headings and `<!-- id:X -->` anchors named `jump`, `keys`, `xcard`, `toc-contents`, `__proto__` and `data-docreader-root` change no snapshot and no lookup.
**Mutation rows.** One per guard above; the `unit` exclusion, the `layout` order, the CI step, and the `visual-out` skip with its nested-name case.
**Visual check.** On the core sample, the script reproduces the prototype's result: an equal reading column, differing only in parts not yet built.
**Done when.** Four projects run, green in both browsers locally and in CI; the report is in the PR.

### Task 7a: Seams: window, registration, state, vocabulary

**Goal.** The seams every later task uses and no feature owns. Ports the prelude helpers (clip, a hash, document order) and section 0's fingerprints.
**Files.**
- Create `src/enhance/env.ts`, `text.ts`, `vocab.ts`, `features.ts`, and a stub with its header and final export for each of `ids`, `rules`, `tables`, `code`, `plans`, `scroll`, `xrefs`, `glossary`, `position`, `figures`, `jump`, `keysheet`, `cards`, `marks`, `rail`, `settings`, `attention`, `strip`, `changes`, `diagrams`, `since` and `diagram-tools`.
- Modify `lifecycle.ts` (build through `features.ts`; the second phase, LD5; fingerprints before any node moves), `journal.ts` (`setStyle`), `state.ts`, `types.ts`, `status.ts` (reads `ctx.vocab`), the walls test.
- Create `test/enhance-seams.test.ts`, `test/browser/seams.test.ts`, `l2-mutations/task-7a.md`.

**Produces (new `FeatureContext` fields).**
- `env`: `frame`, `timeout`, `idle` (journaled, each returning a cancel); `matches`; `reducedMotion`; `viewport()` → `{ w, h, scrollY }`; `scrollTo`; `onScroll`, `onResize`, `onPrint`; `fonts(maxMs)`; `observeResize`, `observeIntersection`; `textWidth` (`null` without a canvas). Callbacks run inside operations; only `env.ts` reaches `defaultView`.
- `state.readPos(posKey)`, `writePos`, `readUi(name)`, `writeUi`: LD8's two keys, read from the snapshot during startup like C43's, written behind, returned as `unknown`.
- `sections`: h2 units `{ heading, members, minutes, fingerprint }`, hashed from the source text before any chrome.
- `vocab` (below); `chromeId(name)`, unique against the document's ids and every other root's; `text`: clip, hash, document order, and `colourKey(doc)`, the one colour-key builder (neutral examples only), shown by Tasks 16 and 19; `journal.setStyle` (LD11). A feature module exports `build(ctx)`, plus `after(ctx)` when it waits on the host; `features.ts` lists them in order, its header giving the reference dependency behind each step.

**Word lists.** Every list lives in `vocab.ts` with its default, options and format contract alike, so Task 24's check has one legal home. Task 7a ports them all; Task 8 makes the option ones options; feature tasks only consume.

| List | Ref. § | Becomes |
|---|---|---|
| Status words (`ok`, `wait`, `no`, `info`) and status-column header words (now in `status.ts`) | 4, 8 | Options (§3.7) |
| ID grammar: 1-4 capitals, optional dash, a number with dotted or dashed parts, optional lower-case letter | 8, 12 | Option `ids` |
| Rule-ID grammar: by default two or more capitals, then dash-separated parts of capitals or digits; no product prefix | 3 | Option `ruleIds` |
| Qualifiers (default none); addressees (default `you`); plan words (task and step grammars, the owner label) | 7, 12 | Options |
| Attention words: status, owner and question headers; open and blocking answers; risk and open statuses | 12c | Options |
| Technical header words; title-column header words | 12c, 8 | Format contract |
| Glossary headers and section names ("Words used here", "Glossary", "Terms used") | 12b | Format contract (§3.7) |
| Merge-commit subjects and the commit-prefix rule | 24b | Format contract (git's forms) |
| Byline item fields; delta-section heading words (both default none) | 2 | Options (Task 8) |

**Tests (jsdom).** Destroy cancels every `env` callback, and one already queued does nothing (RF5). `setStyle` restores conditionally, refuses a name off the list, and takes `important` only for its three names. LD8's keys are read in startup only and written behind. RF2: two roots get disjoint `chromeId`s. The defaults reproduce the prototype's status marks. A fingerprint ignores chrome text. Earlier tests stay green.
**Tests (browser).** `setStyle`, `important` included, applies under the `strict` policy in both browsers.
**Walls.** `defaultView` only in `env.ts`, `.style` only in `journal.ts`; timer, observer and `document.fonts` globals refused elsewhere.
**Mutation rows.** One per guard above, and the new wall sites.
**Done when.** Every stub is registered in `features.ts`; the seams tests (jsdom and browser) and the walls are green; every row in `task-7a.md` is red; the demo is pixel-identical.

### Task 7b: Shared services

**Goal.** The services features share, so group C runs in parallel (LD1). Ports section 13's skeleton (skip link, bar, tool tray, progress, running head), unstyled.
**Files.**
- Create `src/enhance/registry.ts`, `reveal.ts`, `overlays.ts`, `keys.ts`, `nav.ts`, `relayout.ts`, `headctl.ts`, `bar.ts`, and `test/fixtures/large-plan.ts` (RF3's document, for Tasks 11-13).
- Modify `lifecycle.ts`, `types.ts`, `folds.ts` (heading controls, reveal, relayout, a members API), `editorial.ts` (publishes `ctx.page`), `assets/reader.css` (three marker comments).
- Create `test/enhance-services.test.ts`, `test/browser/services.test.ts`, `l2-mutations/task-7b.md`.

**Produces (new `FeatureContext` fields).**
- `index`: `define(e)` (first wins), `get(id)`, `all()` in document order. Entry: `{ id, kind: 'rule' | 'row' | 'section' | 'figure', title, status, group, target: Element, row: Element | null, heads }`.
- `terms`; `blocks` (tables and code, with `isIndex`, `glossary`, `tech`, optional `filter`); `figures`; `plan` (`{ tasks, steps, yours, outlineable }`, set by Task 11).
- `page` (`{ byline, facts, waiting, waitBox }`). `page.facts` is a seam: `take(key)` drops a list key's `dt`, `dd` and summary part (chrome only) and returns its entries; `summary(part)` and `body(node)` put a plugin's part first in the summary and its block before the `dl`, the reference's order for the rules index (Task 9).
- `events`: `on`, `emit`, for `prefs`, `relayout`, `spy`, `marks`, `changes`, `reveal`.
- `reveal(el)`, `onReveal(fn)`: folds and the author's `<details>` register first.
- `overlays`: `open`, `close`, `top`, `any`. Escape order: figure, keys, jump, settings, changes menu, drawer, card.
- `keys`: `bind({ key, label, when?, run })`, `bindings()`. One keydown listener per document ignores editable targets, modifiers (but Ctrl or Cmd with K), an open overlay and `keyboard: false`. A key goes to the root holding its target; a key on the body only to a document's sole live root.
- `nav`: `byId(id)` (the document's ids by a walk, never chrome; then `index`), `idOf(el)`, `goTo(el, { push, focus })` (reveal, scroll, focus, `onHash`), and one delegated click listener (hash link → `goTo`; other link → `onLink` when `host.present` has it). Task 14 completes it.
- `position`: `keep(fn)` (here it calls `fn`), `holdBar()`, `barHeld()`. `relayout(reason)`, debounced, and `onRelayout(fn)`, triggered by resize, prefs, folds, lens, outline and fonts (`env.fonts` with a bounded wait, then `relayout('fonts')`, so sizes measured on fallback metrics are measured again).
- `headCtl(h, slot: 'anchor' | 'mark' | 'fold')`: one `.h-ctl` per heading, slots in fixed order. `slots`: `{ bar, tools, running, progress, skip }` with `chrome.bar`, else `null`; the skip link focuses the root.

**Ambient APIs replaced.** `getElementById` → `nav.byId`; `CSS.escape` and built selectors → walks; expandos → WeakMaps (7a moved timers, frames, `matchMedia`, listeners, fonts and `el.style`).
**Tests (jsdom).** `index`: first-wins, document order, an id `__proto__`. `byId` skips chrome and falls back to `index`. The delegated click: hash, sibling document, modified click, no `onLink`. The Escape order; the key guards, a second root included. `page.facts.take` and the slot order. The skeleton only with `chrome.bar`. A late fonts promise triggers one relayout, and one after destroy none. The fixture's counts.
**Tests (browser).** Relayout runs once the fonts load, in both browsers.
**Mutation rows.** One per guard above.
**Done when.** The services tests (jsdom and browser) are green, every row in `task-7b.md` is red, and the demo is pixel-identical.

### Task 8: Vocabulary and namespace options

The §3.7 scrub task that C44 names.
**Goal.** Every option list in `vocab.ts` becomes an option with its neutral, documented default (LD9); storage keys get a namespace; the item-link plugin is added (section 2, by both routes).
**Files.** Modify `types.ts`, `options.ts`, `vocab.ts`, `state.ts` and `editorial.ts` (the item link). Standard files (slug `vocab`, no Level 2 cases).
**Produces.**
- `vocabulary?: { status?: { ok?, wait?, no?, info? }; statusHeaders?; attention?: { status?, who?, question?, open?, blocking?, risk? }; ids?: false | { prefixes? }; ruleIds?: { prefixes? }; qualifiers?; plan?: { task?, step?, who? }; addressees?; itemFields?; itemHeadings? }`, each list `string[]`, each field replacing its default.
- `namespace?: string`, matching `[a-z][a-z0-9-]{0,31}`, default `docreader`: `<ns>:prefs`, `<ns>:ui`, `<ns>:pos:<posKey>`, `<ns>:doc:<storageKey>:<name>`.

**Defaults.** Task 7a's table. Status words keep the general ones; the PR lists any word moved out of the default for the coordinator to rule. The item link is off unless `itemLink` is given and a route is: a byline fact whose label is in `itemFields`, or the first code block under a section whose heading is in `itemHeadings` (the delta route). A value with an item-key shape becomes a link, routed through `onLink`.
**Scrub.** The reference's private qualifier words and rule-ID prefix, the unprefixed storage keys, the fixed `docreader:` prefix. This closes both "Open before v1" notes.
**Tests (jsdom).** The defaults reproduce the prototype's marks; a custom list changes them; metacharacters are literal; bounds of 200 words of 64 characters; every key carries the namespace, and a bad one is refused; the item link by each route, and only with `itemLink`.
**Mutation rows.** One per guard above.
**Done when.** Every option row of Task 7a's table is an option, documented in the PR's README text.

### Task 9: IDs: rule paragraphs, rules index, ID rows

**Goal.** Fill `ctx.index` from rule paragraphs (the rules plugin, off by default), lettered sections and ID rows, and add the rules index to the facts panel.
**Ports.** Sections 3 (rule paragraphs), 4 (rules index, open rule), 6 (lettered sections) and 8 (ID rows: `idcell`, row definitions, the group from the nearest h2 or h3).
**Files.** Fill `ids.ts` (ID rows and lettered sections, on by default) and `rules.ts` (rule paragraphs, the rules index, the plugin's document kinds; `rules: true`). Standard files (slug `ids`).
**Interfaces.** Consumes `options.rules`, `ctx.vocab`, `statusOf`, `ctx.blocks` and `ctx.page.facts` (`take` for the rule-ID list keys; the "Rules index · N rules" part first; the rules `ol` before the `dl`). Produces `index` entries (`rule`, `row`, `section`), `blocks[].isIndex` and section 3, 4 and 8's classes. It writes no ids (LD6). A rule's dash and status text are split off into a hidden chrome span, and the status word moves into the pill.
**Ambient APIs replaced.** The id-collision probe goes. `innerWidth` in the open rule → `env.matches('(min-width: 700px)')`.
**Scrub.** The rule-ID grammar and document kinds sit behind the plugin; its default is Task 7a's generic shape, documented. The "Rules" label is documented. No reference example IDs.
**Tests (jsdom).** One ID, two, and IDs joined by "and"; a status with a note of 40 characters or fewer; `rules: true` alone recognises the default shape; a paragraph whose first node is white space is not a rule (pinned); destroy restores the text byte for byte; the ID-row threshold; lettered sections; first-wins; the rules index opens at 6 rules or fewer and comes first; `rules: false` builds none of the plugin.
**Mutation rows.** One per guard above, and the hidden separator through the journal.
**Visual check.** A rules list in front matter and an ID table: the facts panel open and closed, light and dark, both viewports.
**Done when.** Level 2 cases cover a rule document and an ID table.

### Task 10: Tables and code blocks

**Goal.** Finish tables; give code blocks their Copy buttons and widths.
**Ports.** The rest of section 8 (bullet cells, the filter on tables of 12 rows or more, `measure`: `fits`, `--thead-h`, the scroll region) and section 9 (Copy, the second Copy on a tall block, `long`, the code scroll region).
**Files.** Fill `tables.ts` and `code.ts`. Standard files (slug `blocks`, with browser tests).
**Interfaces.** Consumes `ctx.blocks`, `host.copy`, `host.present`, `env.textWidth`, `env.timeout`, `onRelayout`, `setStyle` and `chromeId`. Produces section 8 and 9's classes, `--thead-h`, and a labelled `role="region"` on an overflowing element. A filtered row gets a journaled `hidden`. A bullet cell's `<br>` is hidden by a class, not removed.
**Ambient APIs replaced.** `navigator.clipboard` → `host.copy`, given `textContent`. Canvas `measureText` → `env.textWidth`, with the reference's 7.5 px fallback. The 700 and 1,240 px thresholds read `env.viewport().w`, as the stylesheet's `@media` rules do; the room for a wide block is the root's content-box width, less the rail's `--rail-w` when the root has `has-toc` (Task 18). Resize → `onRelayout`; `requestIdleCallback` → `env.idle`.
**Tests (jsdom).** Copy passes `textContent`; a rejection shows "Failed"; destroy clears the label timer; RF5: a `copy()` settling after destroy writes nothing; no `copy` present, no buttons. The filter's count and hidden rows, restored by destroy. Bullet cells.
**Tests (browser, both).** `fits` on a narrow table; `long` at 1440 and not at 390; `long` and the region label at 699, 700, 1,239 and 1,240 px; `--thead-h` equals the head's height; relayout after a width change; with the font response delayed, `--thead-h` and `long` are measured again once the fonts load.
**Mutation rows.** One per guard above, the filter through the journal, and the 44 rem column against `reader.css`.
**Visual check.** Copy buttons, a long code block, a wide and a filtered table; both viewports, light and dark.
**Done when.** Both browsers are green.

### Task 11: Plans and outline mode

**Goal.** Task badges, step numbers and owners, "yours" marks, and an outline mode for long plans.
**Ports.** Sections 7 (tasks, steps, outline setup) and 23 (outline mode).
**Files.** Fill `plans.ts`. Standard files (slug `plans`).
**Interfaces.** Consumes `ctx.vocab` (plan words, addressees), `slots.tools`, `keys` (`o`), `onReveal`, `position.keep`, `relayout`, `state.readDoc` and `writeDoc('outline')`. Produces `ctx.plan`, section 7's classes, the root class `outline` and the Outline button. Text changes only by `split` and `wrap`; steps get no ids; a stored outline is applied during the build, so the full plan never flashes.
**Ambient APIs replaced.** The id probe goes; `CSS.escape` and `[data-task]` become a walk; storage goes through `state`.
**Scrub.** "operator" (an addressee option) and "Who:" (`vocab.plan.who`). The 20-step threshold is documented.
**Tests (jsdom).** Both task grammars; steps with and without an owner; "yours" by addressee; the 20-step threshold; the outline stored and applied in the build; `o`; reveal opens a collapsed task; destroy restores the text byte for byte; the Outline button never inside the fold's label. RF3: on the large plan, the build and an outline toggle stay within a measured budget, and a 2× plan takes at most 2.5× the time.
**Mutation rows.** One per guard above, and the split through the journal.
**Visual check.** A plan sample, full and in outline, both viewports.
**Done when.** `ctx.plan` is published for Tasks 19 and 20.

### Task 12: The bar and scrolling

**Goal.** Style the bar inside the root; drive the progress bar, running head, phone bar and scroll spy.
**Ports.** Sections 13 (bar, skip link, progress, running head) and 17 (scroll handler, spy, phone bar).
**Files.** Fill `bar.ts` (beyond the skeleton) and `scroll.ts`. Insert the bar block into `reader.css` at its marker: the bar sticky in the root, the root classes `scrolled` and `bar-hidden`. Standard files (slug `scroll`, with browser tests).
**Interfaces.** Consumes `slots`, `sections`, `env.onScroll`, `env.frame`, `position.barHeld()`, `setStyle` (the progress width). Produces `events.emit('spy')` with `{ section, unit }`; `--bar-h`, measured; the root classes.
**Ambient APIs replaced.** The window scroll listener, `scrollY`, `innerHeight` and `matchMedia` → `env`; `Date.now` → `position`; body classes → root classes. A host that scrolls an inner element is out of scope for L2; the PR's README text says so.
**Tests (jsdom, stubbed rects).** The current section at the reading line; before the first section; the running head's text.
**Tests (browser).** The progress width at three positions. At 390 px the phone bar hides when scrolling down past 300 px, returns on scrolling up, and stays while an overlay is open or the bar is held. RF3: on the large plan, rect reads per frame stay at or below 2⌈log₂ n⌉ + 4, counted in the page.
**Mutation rows.** One per guard above, and the live check on the frame.
**Visual check.** The bar at the top; scrolled with the running head; the phone bar hidden and shown; light and dark. Expected (LD10): the bar's position and width (in the root, sticky, against the reference's page-level bar); its inner boxes are held to 0.1 px.
**Done when.** `spy` events reach a fixture listener through `events`.

### Task 13: Cross-references and the glossary

Its tests seed `index` and `terms` with fixtures, so it does not wait for Task 9.
**Goal.** Link the first mention of a defined ID in each block; underline the first mention of each glossary term in each section.
**Ports.** Sections 12 (ID cross-references) and 12b (glossary).
**Files.** Fill `xrefs.ts` and `glossary.ts`. Standard files (slug `links`).
**Interfaces.** Consumes `index`, `blocks`, `ctx.vocab` (IDs, qualifiers, the glossary contract) and `ctx.page`. Produces `a.xref[data-ref]` and `a.term[data-term]`, each with `aria-haspopup="dialog"` and `aria-expanded`, as chrome around split text, `href="#<ID>"` resolved by `nav` (LD6); `terms` entries; `glossary`, `termcell`, `term`. A glossary table is a two-column `Term | Meaning` table, or one under "Words used here", "Glossary" or "Terms used".
**Ambient APIs replaced.** `replaceWith` on text → `split` and `wrap`; row ids → `terms` entries holding the row.
**Scrub.** The reference's qualifier words; the default is empty.
**Tests (jsdom).** The skip list (code, links, headings, `th`, figures, byline, facts, rule head, eyebrow, step numbers, a mention inside its own target); first mention per block and per section; plurals; exact terms case-sensitive; aliases ("A (B)", "A, B and C", "A / B"); an xref and a term never overlap; destroy restores every text node; RF3: the large plan within the measured budget, a 2× document at most 2.5× the time.
**Mutation rows.** One per guard above.
**Visual check.** Xref and term styles, light and dark.
**Done when.** Level 2 cases pin first-mention and plurals.

### Task 14: Navigation and reading position

**Goal.** In-page links that reveal, scroll, focus and flash; Back through the host (LD7); the reading position across reloads; the section `#` link; the `j` and `k` keys.
**Ports.** Sections 11 (sibling links: a click guard replaces the URL rewrite), 18 (going places), 25's `j` and `k`, 27 (reading position) and 19's `#` link.
**Files.** Complete `nav.ts`; fill `position.ts`. Modify `index.ts` (export `goToHash`), `lifecycle.ts` (route it) and `README.md` (one line naming `goToHash`, which the walls test requires). Standard files (slug `nav`, with browser tests).
**Interfaces.** The export `goToHash(root, id: string | null, from?: string): void`. Consumes `host.onHash`, `host.onLink`, `host.present`, `initialHash`, `posKey`, `state.readPos`/`writePos` (a checked token `{ line, offset, y }`, `line` matching `/^\d+(-\d+)?$/` or naming an id), `sections`, `events` (`spy`), `keys`, `env`, `reveal`, `headCtl('anchor')`. Produces `position.keep(fn)` (anchor now, restore after), the pin and hold, `flash`, a journaled `tabindex="-1"` on a focused target, and `j` (next section) and `k` (this section's start, or the previous section within 40 px of the bar), through `goTo` with `push: false`. The current section is the last `spy` event's, else found at the reading line.
**Ambient APIs replaced.** `pushState`/`replaceState` → `onHash(id, { push, from })`; `popstate` → `goToHash`; `location.hash` → `initialHash`. `history.scrollRestoration` and navigation types are dropped: `initialHash` wins when given, else the stored position. `elementFromPoint`, `scrollTo` and reduced motion → `env`.
**Scrub.** The reference's history-state keys and position-key prefix.
**Tests (jsdom).** A hash click reveals, calls `onHash` with `push` and `from`, and focuses. A modified click, and a sibling `.md` link, call `onLink` with `newTab`; with no `onLink`, no `preventDefault`. `initialHash` resolves a heading id and an index ID. RF1: `__proto__`, `constructor`, an id equal to a chrome class. RF4: a stored token of the wrong shape, or with selector characters, is ignored. `j` and `k` (stubbed rects): next, start, previous, nothing past the ends, no push. Destroy cancels the pin and the debounce.
**Tests (browser).** The initial hash lands under the bar; `goToHash` with `from` restores the offset within 2 px; the position survives a reload; the pin holds while a block above grows; reduced motion jumps at once.
**Mutation rows.** One per guard above, and the pin's release on wheel, key and pointer.
**Visual check.** The flash, and the `#` link on hover.
**Done when.** The README text for the Back recipe is in the PR body.

### Task 15: Figures and the Mermaid file

**Goal.** Book captions for figures, and the self-hosted single-file Mermaid with its notices and no `elkjs` (LD3, LD4; §3.4, §3.6).
**Files.**
- Fill `figures.ts`. Create `scripts/build-mermaid.mjs`, `scripts/mermaid-elk-stub.mjs`, `test/mermaid-bundle.test.ts`, `test/enhance-figures.test.ts`, `test/browser/mermaid-file.test.ts`, `l2-mutations/task-15.md`.
- Modify `package.json` and the lockfile (`mermaid` as a dev dependency; `build` runs `build:mermaid`), `.gitignore` (`assets/mermaid/`), `THIRD-PARTY-NOTICES` (a generated section), `test/pack.test.ts` and `consumer-smoke.mjs` (the file resolves through `./assets/*`).

**Interfaces.** Produces `assets/mermaid/mermaid.mjs`: one ESM file, no `import()`, no chunks, default export the Mermaid API. Also `ctx.figures` entries `{ no, caption, figure }`, `index` entries of kind `figure`, and `span.fig-no` and `span.cap-text` by `split` and `wrap`. The caption grammar `Figure N.` comes from `render()` (PD7), the format contract.
**Work.** First measure whether Mermaid's own single file carries `elkjs`; record it in the PR. Then esbuild over the pinned package, `elkjs` aliased to the stub; every input package from the metafile, its notice from its `LICENSE`.
**Tests.** Node: one file; no `elkjs` input and no ELK signature; every bundled package in the notices with its licence; two builds, one sha256; the size within a stated bound. Browser: the file loads under the `reader` policy and draws a flowchart in both browsers. jsdom: the caption split, restored by destroy; the figure entries.
**Mutation rows.** The `elkjs` alias; a missing notice; the CSP page; the caption split through the journal; rows on the built file with a control run.
**Visual check.** The caption, light and dark.
**Done when.** The pack test and the consumer smoke resolve the file, and the notices match the metafile exactly.

### Task 16: Quick jump and the keys sheet

**Goal.** The `/` and Ctrl or Cmd+K finder over sections, tasks, IDs and figures, and the `?` sheet of the keys features bind.
**Ports.** Sections 21 (quick jump) and 25 (the sheet; the keyboard layer is 7b's `keys`).
**Files.** Fill `jump.ts` and `keysheet.ts`. Standard files (slug `jump`, with browser tests).
**Interfaces.** Consumes `sections`, `plan`, `index`, `figures`, `slots.tools`, `overlays`, `keys`, `nav.goTo`, `chromeId`, `text.colourKey`. Produces `.jump-btn`; `.jump`, a combobox with a listbox and `aria-activedescendant` on per-instance ids; `.keys`, a dialog of the `keys.bindings()` that apply now, with the colour key.
**Ambient APIs replaced.** `document.activeElement` → the root document's; `scrollIntoView` guarded; body classes → `overlays.any()`.
**Scrub.** Neutral ID examples in the placeholder.
**Tests (jsdom).** The ranking (exact ID 100, section number 95, ID prefix 80, and so on); an empty query lists the headings; four entries or fewer build no jump; a hostile query (metacharacters, 10^5 characters) stays bounded; focus returns to the opener; the sheet lists only the bindings that apply; RF2: with two roots, `/` opens the focused root's jump, and Escape closes only its overlay.
**Tests (browser).** The sheet traps focus; the selected row stays in view.
**Mutation rows.** One per guard above.
**Visual check.** The jump with results and the keys sheet, light, dark and on a phone.
**Done when.** A key bound by a later task appears in the sheet with no edit to `keysheet.ts`.

### Task 17: Preview cards

**Goal.** A preview on hover, focus or first tap for an ID mention, a term or a diagram block.
**Ports.** Section 20.
**Files.** Fill `cards.ts`. Standard files (slug `cards`, with browser tests).
**Interfaces.** Consumes `index`, `terms`, `a.xref`, `a.term`, `overlays`, `env`, `setStyle` (`left`, `top`, `max-height`), `nav.goTo`. Produces `.xcard`, a dialog in the root, with `.open` and `.is-term`, and `cards.show(trigger)` for Task 23. A clone drops ids and form controls and turns `a.xref` and `a.term` into text.
**Ambient APIs replaced.** The card moves from the body into the root; the README text says an ancestor with `transform`, `filter` or `contain` moves it. Its eleven timers → `env`; the bar height → `--bar-h`.
**Tests (jsdom).** Content for a row, a rule, a section and a term; ARIA; Escape returns focus without reopening; on touch the first tap previews and the second goes; Tab into the card and out; after destroy no timer fires.
**Tests (browser).** Placement below, above and clamped; never over the trigger; follows scroll.
**Mutation rows.** One per guard above, and id stripping in clones.
**Visual check.** A card on a row ID and on a term, light and dark, both viewports.
**Done when.** `cards.show` is ready for diagram blocks.

### Task 18: Read marks and the contents rail

**Goal.** Read marks per section, with "changed since you read it", and the two-tab rail (Contents, Index), a drawer on a narrow screen.
**Ports.** Sections 14 (read marks), 15 (rail and drawer) and 19's read-mark button.
**Files.** Fill `marks.ts` and `rail.ts`. Insert the rail block into `reader.css` at its marker: the sticky column from 1,240 px of viewport width, its width as `--rail-w`; below that the drawer, scrim and Contents button; the root classes `has-toc` and `toc-open`. Standard files (slug `rail`, with browser tests).
**Interfaces.** Consumes `sections` (source-text fingerprints, so chrome text never flips a mark), `plan`, `index`, `events` (`spy`, `changes`), `headCtl('mark')`, `keys` (`m`, `i`), `overlays`, `chromeId`, `slots.tools`. Stores `<ns>:doc:<key>:marks` (heading id to hash; read into a `Map`, written with a null prototype, pruned of ids that no longer exist), `<ns>:doc:<key>:ixfold` and `<ns>:ui` (`sidetab`, via `readUi`/`writeUi`). Produces section 14 and 15's classes.
**Ambient APIs replaced.** Body classes → root classes; `scrollIntoView` and `getClientRects` guarded.
**Tests (jsdom).** Unread, read and changed; a task unit on a long plan; RF1: marks for `__proto__` and `constructor` round-trip with no prototype change; RF4: a marks value of the wrong type, with selector characters in its keys, or oversized (more entries than headings, values over the hash length) is ignored or pruned; the remembered tab; index groups and their folds; `m` and `i`; a fixture `changes` emit lights the changed sections.
**Tests (browser).** The rail at 1440 and the drawer at 390; the focus trap; the active link follows the spy into view; Task 10's `long` boundary at 1,240 px with the rail shown.
**Mutation rows.** One per guard above, the drawer's overlay registration and the roving `aria-selected`.
**Visual check.** Both tabs at 1440, the drawer at 390, read and changed marks; light and dark. Expected (LD10): the rail's position (a column in the root, against a viewport-fixed rail) and the column's offset beside it; the rail's inner boxes and the column's width are held to 0.1 px.
**Done when.** The rail block is the only placement CSS added, and the root still owns its box (C43).

### Task 19: Settings menu, lens and attention marks

**Goal.** The Aa menu (theme, typeface, width, lens, collapse and expand all, colour key); the Product lens with its "Show engineering detail" bars; the marks for what needs the reader.
**Ports.** Sections 22 (reading settings) and 12c (attention, file-path tone, Product lens).
**Files.** Fill `settings.ts` and `attention.ts`. Standard files (slug `settings`, with browser tests).
**Interfaces.** Consumes `state.prefs`, `setPrefs`, `events` (`prefs`, so `setEnhancementPrefs` updates the radios), the folds members API, `position.keep`, `relayout`, `blocks`, `plan` (`yours`), `index`, `ctx.vocab` (attention, addressees, status), `text.colourKey`, `overlays`, `chromeId`, `slots.tools`. Produces section 22 and 12c's classes and the root class `lens-product`. The menu is built only with `chrome.settings`.
**Ambient APIs replaced.** The menu's storage keys → prefs (LD12); `html.dataset` → the root's attributes; `body.lens-product` → the root class.
**Tests (jsdom).** The radios follow host-set prefs; Escape, an outside pointer and focus leaving close the menu; collapse all writes once; the first lens use builds peek bars that join folds; each attention rule; RF2: two roots keep separate radio groups.
**Tests (browser).** A font or width change keeps the reader's place within 2 px.
**Mutation rows.** One per guard above, and per-instance names.
**Visual check.** The menu open, light and dark; the lens on and off; attention rows.
**Done when.** `lens` drives the root class and is stored with the prefs.

### Task 20: Review strip and what changed

**Goal.** The strip under the byline (waiting items, decision counts, plan counts), and the marks and stepper for what changed since a commit.
**Ports.** Sections 16 (review strip) and 24 (what changed).
**Files.** Fill `strip.ts` and `changes.ts` (with `after`). Standard files (slug `changes`, with browser tests).
**Interfaces.** Consumes `page` (`byline`, `waiting`, `waitBox`), `blocks`, `plan`, `host.changes`, `nav.goTo`, `reveal`, `keys` (`n`, `p`, `w`), `slots.tools`; emits `changes`. Produces section 16 and 24's classes, `chg` and `chg-del` journaled on blocks with `data-line`. Links to waiting items are chrome anchors handled by `goTo`; no `waiting-N` ids. A change set is `{ changed: [from, to][]; removedAfter: number[] }`. Exports `showChanges` for Task 22.
**Checks (RF4).** Pairs of finite integers, `from` at most `to`; at most 10,000 ranges and 10,000 deletions; lines clamped to the last `data-line`. Anything else reads as no changes.
**Tests (jsdom).** The largest status table wins, a tie to the first (pinned); one hunk across two rows is one stop; nested hits keep the innermost; stepping starts from the reader's position; hide clears every mark; RF5: a reply after destroy writes nothing.
**Tests (browser).** A step brings the next change under the bar and flashes it.
**Mutation rows.** One per guard above, and the live check after the await.
**C44 (c).** Report in the PR whether the strip should show the scalars C44 leaves hidden (an `owner`, say), for the coordinator to rule. No change by default.
**Visual check.** The strip; change marks and the stepper; light and dark.
**Done when.** A shown change set emits `changes` with its marked sections, and a hidden one an empty set, through `events` alone (Task 18 tests the listener).

### Task 21: Diagrams: drawing

**Goal.** Draw each Mermaid figure in the second phase (LD5), safely configured, with a readable fallback on failure.
**Ports.** The drawing part of section 26, and the first-paint steps that concern diagrams.
**Files.** Fill `diagrams.ts` (with `after`). Edit the existing figure rules in `reader.css` (the plate, and the gated source rule). Standard files (slug `diagrams`, with browser tests).
**Interfaces.** Consumes `options.mermaid`, `figures`, `env` (`fonts`, `frame`, `observeIntersection`), `setStyle` (`--fig-w`). Produces the root attributes `data-docreader-mermaid` (the gate, set only when drawing starts) and `data-docreader-diagrams`; the drawing, a chrome `pre.mermaid` beside the document's own `pre`, which is never written into; the figure's journaled class `drawn` or `draw-failed`; `.fig-error`, holding the source in a `details`; `svg[role=img][aria-label]`.
**The figure rules.** The source never gets `data-processed`, so the rules key on the figure's class: under the gate, the source `pre` is the transparent placeholder until its figure is `drawn` or `draw-failed`, and hidden after; the chrome `pre.mermaid` takes the plate; a failed figure shows `.fig-error`, never a blank plate (C43's Mermaid item).
**Configuration (§3.4).** `securityLevel: 'strict'`. `maxTextSize` and `maxEdges` pinned at Mermaid 12.1.0's defaults, measured and stated. `secure` lists every style-bearing key of 12.1.0's configuration, enumerated from its schema, plus the host's additions. The warm theme variables and `fontFamily` (Docreader Sans) are set through `initialize`, so no directive changes them. Calls are serialised in one queue per Mermaid module, across roots, with `initialize` before each. Drawing uses `mermaid.run` on the chrome node, with no id lookup.
**Tests (jsdom, a fake Mermaid).** The queue order; near figures first; the fallback and its class; a destroy during a pass stops it; RF5: a `load()` resolving after destroy draws nothing.
**Tests (browser, the real file).** Hostile Level 2 cases under `reader`: `themeCSS` holding `position:fixed` in an init directive; a `click` directive; an HTML label; text over `maxTextSize`; edges over `maxEdges`; `layout: elk`. Each expects no injected style, no handler, and the fallback where it applies. A drawn figure shows no source plate, a failed one no blank plate.
**Mutation rows.** `securityLevel`; each group of `secure` keys; the limits; the queue; each live check; each figure rule; rows on the built file with a control run.
**Visual check.** A flowchart, a sequence diagram and a failed diagram, light and dark (the plate filter).
**Done when.** Every hostile case passes in both browsers, and the PR body documents the diagram states.

### Task 22: Changes since, and the day view

**Goal.** The "Changes since…" menu grouped by day, the notice of changes since the last visit, and the banner for one day's version.
**Ports.** Section 24b.
**Files.** Fill `since.ts` (with `after`). Standard files (slug `since`, with browser tests).
**Interfaces.** Consumes `info.sha`, `draft`, `history`, `only`; `host.changes`, `host.openVersion`; Task 20's `showChanges`; `state` (`<ns>:doc:<key>:seen`, `{ sha, at }`, written once per load); `overlays`; `chromeId`; `ctx.vocab`'s merge and commit-prefix rules; `setStyle` (`left`, `top`, `right`, `max-height`). Produces section 24b's menu (roving `tabindex`, type-ahead), notice and banner (in the bar). "Only this day" calls `openVersion({ sha, only })`, "Back to the latest" `openVersion({ sha: null, only: null })`; both are buttons. Day keys use local time through an injected clock; tests pin the zone.
**Scrub.** No routing parameters. The merge and commit-prefix rules are documented as the format contract.
**Tests (jsdom).** Day grouping across midnight in a pinned zone; quick ranges dropped when empty or equal to a row above; the last-visit notice; keyboard navigation; RF4: 10^5 entries and 1 MB subjects stay bounded; a reply after destroy writes nothing.
**Tests (browser).** The menu scrolls to make room and is clamped.
**Mutation rows.** One per guard above, and the live check after each await.
**Visual check.** The menu, the notice and the day banner; light and dark.
**Done when.** `since.ts` builds no URL.

### Task 23: Diagram tools

**Goal.** Copy Mermaid, Play, Animate edges, full screen, and definitions on diagram blocks.
**Ports.** The tools and definitions of section 26.
**Files.** Fill `diagram-tools.ts`. Standard files (slug `diagram-tools`, with browser tests), with a Level 2 case per Mermaid internal id shape: `g.node` ids, `path.flowchart-link[data-id]`, `g.edgeLabel`, `g.cluster`.
**Interfaces.** Consumes the drawn SVGs, `host.copy`, `host.present`, `terms`, `index`, `cards.show`, `overlays`, `env` (`timeout`, `frame`, `observeResize`), `setStyle` (`transform`; `opacity` on clusters for Play; `stroke-dasharray` and `stroke-dashoffset` per edge; `fill`, `stroke`, `stroke-width` with `important` on the dot and ring). Produces section 26's tools and `.fig-overlay` in the root (zoom, pan, pinch, keys; the clone's ids renamed with their `url(#…)` and `href` references); the definition dots. Full screen makes no history entry (LD7) and locks scrolling with a root class, never on `html`.
**Tests (jsdom).** Graph order on a fixture SVG; term and ID matching on labels; destroy cancels Play's timers; RF5: a `copy()` settling after destroy writes nothing; the overlay's trap and Escape.
**Tests (browser).** Fit, zoom and pan; dots placed by `getBBox` and painted over a `!important` classDef; the drag and tap thresholds.
**Mutation rows.** One per guard above, id renaming, and the dot's `important`; rows on the built file with a control run.
**Visual check.** The toolbar, Play part way, full screen light and dark, the dots.
**Done when.** A Mermaid upgrade that moves an internal id shape reddens a Level 2 case (§3.5).

### Task 24: Scrub audit, docs, parity and whole-branch review

**Goal.** Close L2 and stage it for L3.
**Files.** Modify `README.md`, `test/readme.test.ts`, `THIRD-PARTY-NOTICES`, `consumer-smoke.mjs`. Standard files (slug `scrub`, no Level 2 cases).
**Work.**
1. **README.** `./enhance` in full: every option, export, storage key, root attribute and class contract; the format-contract headings and word lists; where the layout differs from the reference (no ids written, deep links through the index, Back through `goToHash`, drawing beside the source, no history entry for a figure, a persistent position, the lens on the root). Assembled from each task's PR-body README text.
2. **The audit.** For each row of §3.7 and of "Not ported", name where it was handled and the test that pins it. `enhance-scrub.test.ts` checks shapes, never a list of private names: no URL literal, no `performance` call and no unprefixed storage key in `src/enhance`, no word list outside `vocab.ts`, no "Open before v1" note.
3. **Level 2 coverage.** Every feature has cases. The clobbering names, as heading ids and as `<!-- id:X -->` anchors, cover every chrome class and the seed names L3 will use. Every hostile Mermaid case is present.
4. **Full visual parity.** The compare script on every neutral sample, both viewports, the three pref states and each task's interactive states, with Tasks 12 and 18's expected differences named. Attach the report.
5. **Whole-branch review.** A held-out panel over `main..HEAD`, run as for each task, then a fix round.
6. **The consumer smoke** imports every export, `goToHash` included, and resolves the Mermaid file.

**Done when.** Green on Node 22 and 24 and in both browsers; every L2 row is red as recorded; the parity report has no unexplained difference.
