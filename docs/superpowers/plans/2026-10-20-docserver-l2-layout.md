# docserver L2 — the layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task by task. The coordinator runs each task through its own workflow: an implementer subagent, a held-out review panel, then a fix round ("How this wave runs"). The plan is lean by design (C40): it holds no implementation code. Each task is built as running code, tests, mutation rows and a visual comparison, as the prototype on PR #13 was.

**Goal:** Ship `@synapsium-labs/docserver/enhance` as the whole reading layout, embeddable in any host. Every ambient API of the reference layout becomes a host adapter or a stated option, and operator-specific vocabulary becomes options, off or neutral by default. L2 also ships the self-hosted single-file Mermaid with pinned limits and its notices, and Level 2 of the corpus: `enhance()` to a structural DOM in a real browser.

**Architecture:** The prototype (PR #13) built the core, and C43 makes its design binding: the lifecycle (registry, ownership, destroy), the journal (every write, undone by destroy), reader state behind the host's storage, the first features (editorial core, status marks, folds) and `assets/reader.css` (the reference stylesheet, scoped to `[data-docreader-root]`). L2 adds three layers:
1. **Options and host adapters** (Task 5): every remaining §3.2 option, declared and documented once.
2. **Shared services** (Task 7): the root's window behind one module, the ID and term registries, reveal, overlays, keys, navigation, relayout, heading controls, the bar skeleton, and a stub file per later feature in the final build order.
3. **Features** (Tasks 8-23): each fills its own stub and tests, so parallel tasks touch disjoint files.

Real sizes are tested in Chromium and WebKit through a pinned `playwright-core` (Task 6). L3 owns `frameDocument()`, the frame bootstrap and click guard, `mountDocFrame()`, `assets.json`, publishing and the public flip.

**Tech Stack:**
- Node `>=22`; CI runs Node 22 and 24.
- Dependencies, exact pins, unchanged from L1: `markdown-it` 14.3.2, `markdown-it-footnote` 4.0.0, `js-yaml` 4.3.2, `highlight.js` 11.12.0, `@types/js-yaml` 4.0.9, `@types/markdown-it` 14.2.0.
- Dev dependencies, exact pins: `typescript` 6.0.3, `vitest` 4.1.11, `@types/node` 22.20.4, `esbuild` 0.28.2, `jsdom` 29.1.1 (the prototype's). L2 adds:
  - `playwright-core` 1.63.0 (published 2026-09-04), Task 6. It pins the Chromium and WebKit builds the browser tests run.
  - `mermaid` 12.1.0 (published 2026-10-02), Task 15: the version the reference layout draws with. A dev dependency, because the package ships the file built from it.
- New pins install with `--before=2026-10-06T00:00:00Z`, 14 days before this plan, so transitive dependencies obey the age rule (C6, C7). A later task uses a cutoff 14 days before its own date and keeps these versions.
- Fonts: Source Serif 4 and Source Sans 3, Fontsource 5.3.0, unmodified, faces named Docreader Serif and Docreader Sans (C43).

**Spec:** [Rich Docs reader and a shared renderer](https://github.com/Synapsium-Labs/ccrc-pwa/blob/main/docs/superpowers/specs/2026-10-12-rich-docs-reader-and-shared-renderer-design.md): §3.2 the API and options, §3.4 the rules (Mermaid configuration), §3.5 the corpus (Level 2), §3.6 packaging, §3.7 the scrub list.

**Ledger:** [`docs/superpowers/programs/docserver.md`](../programs/docserver.md). C1-C39 and PD1-PD9 stay binding; C40-C44 are L2's rulings.

## Global Constraints

- **Public-ready** text in every tracked file, commit and PR body (`CLAUDE.md`): no hosts, users, private paths, private product or programme names, tracker names or operator defaults.
- **The reference layout is never named in tracked text.** Call it "the reference layout", cite its numbered sections, and never copy its private vocabulary, examples or comments.
- **The reference is passed by argument only (C5).** The coordinator runs it on a temporary copy of the same neutral sample and passes that page to the compare script.
- **Pure.** No network, `fetch`, storage API, `location`, `history`, cookies or URLs of the library's own: options in, host calls out.
- **CSP-safe.** No `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `Function`, inline handlers, style attributes or `cssText`. Styles go only through `journal.setStyle` (LD11).
- **Import-inert.** No top-level code (`test/enhance-walls.test.ts`).
- **Root-scoped.** A feature writes inside the root, reaches the root's window only through `ctx.env`, and finds elements by walking: never by a document id, never with a selector built at run time.
- **No ids on the document's nodes.** Chrome ids are per instance and checked against the document's ids. C22 holds.
- **Every write is journaled.** Source nodes are only moved or split. Listeners use `journal.listen`, timers `ctx.env`, host calls `ctx.host`, and `live()` is checked after each call-out.
- **Several roots per page.** No module-level state but WeakMap registries; a keydown, overlay or generated id never crosses roots.
- **Host data is untrusted.** Every value from a host call or from storage is checked for shape, type, count and length.
- **Exact pins, 14 days old (C6, C7)**, a committed lockfile, `npm ci` in CI.
- **No network in tests.** The no-network setup stays. Browser pages load only from the harness's own origin, `https://docreader.test/`, which `page.route` fulfils from disk; every other request is aborted.
- **Tests** run as `./node_modules/.bin/vitest run [file]`, in the foreground. `npm run typecheck` covers all three projects.
- **Mutation discipline.** Every guard ships with a case that goes red without it. Rows are `L2-T<n>-M<k>` in `docs/superpowers/plans/l2-mutations/task-<n>.md`, in the prototype's format (a table, then one JSON fence), measured with the L1 plan's `mutate.mjs` (Task 1, Step 8). A green row gets a new case or is reported, never dropped.
- **The corpus is the contract.** No L2 task moves a golden without a C-ruling first and a `Goldens-moved:` trailer.
- **Visual parity.** On the neutral sample, what a task builds has the reference layout's computed values and boxes, to 0.1 px, in each state the task names.
- **Commits.** Files staged by name; subject `<area>: <what> (docserver L2 T<n>)`; the writer's `Co-Authored-By:` trailer. No task pushes. Never `git stash`, `reset --hard` or `checkout --`. No Docker.

## Review Focus

Five conditions likely to bite a reader that no task's tests exercise yet, each given a test in the task named.

| # | Condition | Risk | Test in |
|---|---|---|---|
| RF1 | Document ids `__proto__`, `constructor`, `toString`, or a chrome class name (`jump`, `keys`, `xcard`, `toc-contents`). | State keyed by id pollutes a prototype or loses a mark; a hash lookup returns chrome. | 14 (`initialHash`, `goToHash`); 18 (read marks round-trip; no prototype changes) |
| RF2 | Two enhanced roots in one document. | A keydown, the Escape order, a radio group or a generated id reaches the other root. | 16 (`/` and Escape act on one root); 19 (separate radio groups) |
| RF3 | A 1.5 MB plan with 2,000 IDs, 300 terms and 1,000 steps. | The xref walk, the glossary pattern and the scroll spy grow with it. | 13 (startup budget; 2× document ≤ 2.5× time); 12 (rect reads per frame O(log n)) |
| RF4 | Hostile host data: `changes()` with NaN, inverted or 10^6 ranges; 10^5 commits with 1 MB subjects; a stored position or marks value of the wrong shape, with selector characters. | Unbounded loops, or a host value reaching a selector or the DOM. | 20 (changes); 22 (history); 14 (position) |
| RF5 | An async completion after destroy: `copy()`, `changes()`, Mermaid `load()` or a render, a font wait, a timer, a frame or an idle callback. | A write or a host call after teardown. | 7 (`ctx.env`); 20 (`changes`); 21 (Mermaid) |

## Decisions this plan makes (LD1-LD12)

The coordinator rules these by merging this plan. Changing one later needs a C-ruling.

| ID | Decision | Why | Cost if wrong |
|---|---|---|---|
| LD1 | **Seams first.** Task 5 declares every remaining §3.2 option. Task 7 builds the shared services and creates each later feature's file as a stub, in the final build order (`src/enhance/features.ts`). A feature task fills its own file and touches no shared file. | Nine feature tasks run side by side without conflicts, and the build order is decided once. | A seam can prove wrong before its feature exists. The fix is additive, in the feature's PR. |
| LD2 | **Real-browser tests drive `playwright-core` 1.63.0 from vitest**, in a fourth project, `layout`, run last, in Chromium and WebKit. It is part of the default run. A missing browser is a red that prints the install command, never a skip. | jsdom has no layout, and the first consumer's readers use Safari. A pipe, not a socket, drives the browser, so the no-network setup stays. | Minutes of CI time, and a one-time browser install. |
| LD3 | **The library bundles Mermaid** with esbuild into one ESM file, `assets/mermaid/mermaid.mjs`, at build time, uncommitted. `elkjs` is replaced by a stub, and the metafile names every bundled package for the notices. | Mermaid 12.1.0 depends on `elkjs` (EPL-2.0), which §3.6 excludes. | A diagram that asks for the ELK layout shows the failure note. |
| LD4 | **The host passes the file, never a URL:** `mermaid.load(): Promise<module>`. | The library holds no URLs. | Other hosts write a one-line loader. |
| LD5 | **`enhance()` resolves when the layout is built.** Diagrams and `changes()` replies come in a second phase, inside operations, with `live()` checked after each await. The root's `data-docreader-diagrams` reads `drawing`, `drawn`, `partial` or `failed`. | Startup stays one synchronous operation, as the lifecycle requires. | A host waiting for diagrams reads an attribute. |
| LD6 | **Deep links without ids.** `nav.byId(id)` resolves a document id, then an ID in `ctx.index` (a rule `R14`, a row `F3`). | Links to rules and rows keep working with no ids written. | A document id equal to a defined ID wins. |
| LD7 | **Back goes through the host.** `onHash(id, { push, from })` hands over an opaque position token for the entry being left. When its history moves, the host calls the new export `goToHash(root, id, from?)`. The full-screen figure makes no history entry. | The frame must not own history (§3.2), and the token keeps "Back returns to where you were". | The full-screen figure has no Back gesture until an option adds one. |
| LD8 | **One storage: the host's.** Position goes under `docreader:pos:<posKey>` and reader-wide UI memory under `docreader:ui`. Per-document state gains `marks`, `outline`, `ixfold` and `seen`. The comparison in view stays in memory. | §3.2 gives one storage. A host that wants per-tab positions routes `docreader:pos:` keys to session storage. | A reload drops the comparison in view. |
| LD9 | **Vocabulary options are words, never a RegExp:** bounded lists of strings, escaped when compiled (Task 8). | A host pattern can backtrack without bound. | An unusual ID shape waits for an additive option. |
| LD10 | **`chrome` is `{ bar?, rail?, settings? }`, booleans, default true.** The bar is the root's first child, sticky. The rail is a sticky column from 1,240 px of viewport width and a drawer below it, both inside the root. | It replaces the layout's own bar (§3.2), and the root owns its box (C43). | Tools in a host's own bar need an additive option (the ledger's Question 1). |
| LD11 | **Styles through CSSOM only.** `journal.setStyle(el, prop, value)` takes a fixed list of names (`--thead-h`, `--fig-w`, `--bar-h`, `left`, `top`, `width`, `max-height`, `transform`), restores conditionally, and is the only `.style` access. | A strict CSP allows CSSOM writes but not a style attribute. | One more journal entry kind. |
| LD12 | **`lens` is a fourth pref** (`all` or `product`), reader-wide, shown as the root class `lens-product`. | The reference kept it reader-wide. | An additive change to `Prefs`. |

## How this wave runs

- **Branches.** One branch and one PR per task. Task 1 branches from `main` (it touches only `src/render/` and its tests) and can merge before #13. Every other task stacks on `l2-prototype`, #13's branch, in a stack that is linear in the merge order below. A group's tasks are built at the same time from their common parent; before review, each is rebased onto the task before it, which disjoint files keep mechanical. A PR's base is the previous PR's branch, retargeted to `main` when that merges. The coordinator merges after review (C4).
- **Per task.** An implementer subagent builds code, tests first, mutation rows and the visual check. Feature tasks put their README text in the PR body; Task 24 writes the README. A held-out panel of three Opus lenses reviews (spec and parity; safety and lifecycle; tests, rows and visual evidence), a Sonnet refute pass checks each finding, and one fix round follows.
- **Merge order and parallel groups** are the task table's order and Group column. Tasks in one group run in parallel; a task starts once the tasks in its "Depends on" have merged or are rebased below it.
- **Shared files and their only writers.** `package.json`, the lockfile and `.gitignore`: 6, then 15. `vitest.config.ts`, `ci.yml`, `public-ready.test.ts`, `scripts/demo/build.mjs`: 6. `types.ts`, `options.ts`, `state.ts`: 5, 7, 8 in turn. `journal.ts`, `features.ts`, `folds.ts`, `status.ts`, the services and the walls test: 7. `editorial.ts`: 7, 8. `lifecycle.ts`: 5, 7, 14. `index.ts`: 14. `README.md`: 5 (options), 14 (one line naming `goToHash`, which the walls test requires), 24. `assets/reader.css`: 7 adds three marker comments, well apart, and 12, 18 and 21 each insert after their own. `THIRD-PARTY-NOTICES`, `pack.test.ts`, `consumer-smoke.mjs`: 15, 24. Each feature task owns its `src/enhance/<feature>.ts` and its **standard files**, named by the slug its task gives: `test/enhance-<slug>.test.ts`; `test/browser/<slug>.test.ts` when it has browser tests; Level 2 cases in `conformance/layout/<slug>/` unless it says none; a sample `scripts/demo/samples/<slug>.md` when no existing sample shows the feature; and its rows, `docs/superpowers/plans/l2-mutations/task-<n>.md`.

## Tasks

| # | Title | Depends on | Group | State |
|---|---|---|---|---|
| 1 | Items carried from L1 | `main` at or after `89a9db6f4` | A | open |
| 2 | The reader stylesheet and fonts | none | — | DONE (#13) |
| 3 | Lifecycle, reader state and folds | 2 | — | DONE (#13) |
| 4 | The editorial core | 3 | — | DONE (#13) |
| 5 | Options and host adapters | #13 | A | open |
| 6 | Real-browser harness, Level 2 runner, visual compare | #13 | A | open |
| 7 | Shared services and feature slots | 5, 6 | B | open |
| 8 | Vocabulary and namespace options | 7 | C | open |
| 9 | IDs: rule paragraphs, rules index, ID rows | 7 | C | open |
| 10 | Tables and code blocks | 6, 7 | C | open |
| 11 | Plans and outline mode | 7 | C | open |
| 12 | The bar and scrolling | 6, 7 | C | open |
| 13 | Cross-references and the glossary | 7 | C | open |
| 14 | Navigation and reading position | 6, 7 | C | open |
| 15 | Figures and the Mermaid file | 6, 7 | C | open |
| 16 | Quick jump and the keys sheet | 7 | C | open |
| 17 | Preview cards | 13 | D | open |
| 18 | Read marks and the contents rail | 12 | D | open |
| 19 | Settings menu, lens and attention marks | 9, 10, 11 | D | open |
| 20 | Review strip and what changed | 9, 11 | D | open |
| 21 | Diagrams: drawing | 15 | D | open |
| 22 | Changes since, and the day view | 20 | E | open |
| 23 | Diagram tools | 17, 21 | E | open |
| 24 | Scrub audit, docs, parity and whole-branch review | all | F | open |

---

### Task 1: Items carried from L1

**Branch:** from `main` at or after `89a9db6f4`. Its own PR, merged first.
**Goal.** Close the three items from run 469, L1's last review, closing C39's parity gap first.
**Files.** Modify `src/render/frontMatter.ts` and `test/frontmatter.test.ts`. Create `docs/superpowers/plans/l2-mutations/task-1.md`.
**Work.**
1. **C39's gap.** The refusal sits under a key that a block can spell itself: through a YAML escape, through an earlier source of the same merge list, or through a separate earlier `<<` pair. Make the key one that no block under `FM_MAX_CHARS` can spell, such as `'\u0000'.repeat(2 * FM_MAX_CHARS)`, as the reviewer measured. Run the reference renderer by argument (C5) on the three routes and confirm it refuses each.
2. **C38's case** also pins the reference's `frontList` (test only).
3. **The key-cut comment** beside C31's cases says that the reference keeps the uncut key (wording only).

**Tests.** One case per route, each asserting the reference's output. A timing case shows the cost has not risen. The corpus and the ratchet are unchanged.
**Mutation rows.** Restoring the short key reddens the three route cases.
**Done when.** Green on Node 22 and 24, the rows are red, and the PR states that no golden moves.

### Task 2: The reader stylesheet and fonts — DONE

PR #13: `618d1bd`, `84568b3`, fixed in `661956b`. The reference stylesheet, ported whole: every rule scoped to `[data-docreader-root]`, popups keyed on classes, sizes in `calc(N * var(--rem))`, the warm palette kept in light and dark (C41). Fonts with `OFL.txt`, hashes in `assets/fonts/README.md`, and `THIRD-PARTY-NOTICES`. Bar and rail placement were left out on purpose (Tasks 12, 18).

### Task 3: Lifecycle, reader state and folds — DONE

PR #13: `f85d3a2`, fixed in `fe6f481`, `176f87b` and `8e3836e`. The registry and ownership, `enhance`, `destroyEnhancement` returning `Promise<void>` (C42), `setEnhancementPrefs`, the journal, write-behind state, and folds with `hidden="until-found"`. Rows L2P-M1 to L2P-M25 and L2P-M42 to L2P-M88, in `docs/superpowers/plans/l2-prototype-mutations.md`.

### Task 4: The editorial core — DONE

PR #13: `58847af`, `70c736d`, fixed in `661956b`; rows in `f51340d` and `6e3d5cf`; README in `91fd3bb`. Reading time, title block and byline, the facts panel (list keys only), "In short", "Where things stand", hanging section numbers, status marks, group rows, `cols-2` and stacked tables, and the demo page. Rows L2P-M26 to L2P-M41 and L2P-V1 to L2P-V3. Compared with the reference layout at 1440×1000 and 390×844 in light, dark, and sans with wide.

### Task 5: Options and host adapters

**Branch:** on `l2-prototype`, beside Task 6.
**Goal.** Declare, normalise and document every remaining §3.2 option once, and give features one wrapper per host call. Ports the reference prelude's options, as adapters.
**Files.** Modify `src/enhance/types.ts`, `options.ts`, `state.ts` (the `lens` pref), `lifecycle.ts` and `README.md` (options table, storage keys). Create `src/enhance/host.ts`, `test/enhance-options.test.ts`, `docs/superpowers/plans/l2-mutations/task-5.md`.
**Produces.** New `EnhanceOptions` fields:
- `onLink?(href: string, how: { newTab: boolean }): void`. Absent: the browser follows the link.
- `onHash?(id: string | null, entry: { push: boolean; from: string | null }): void` and `initialHash?: string | null` (LD7).
- `copy?(text: string): void | Promise<void>`. Absent: no Copy buttons.
- `changes?(sha: string): Promise<unknown>` and `openVersion?(v: { sha: string | null; only: string | null }): void`.
- `posKey?: string`, default `storageKey`. `keyboard?: boolean`, default true. `chrome?: { bar?: boolean; rail?: boolean; settings?: boolean }` (LD10).
- `mermaid?: { load(): Promise<unknown>; maxTextSize?: number; maxEdges?: number; secure?: readonly string[] }`; `secure` only adds keys. Absent: no drawing.
- `rules?: boolean`, default false (the rules plugin). `itemLink?(key: string): string | null`.
- `info` gains `sha?: string | null`, `draft?: boolean`, `history?: readonly { sha: string; subject: string; date: string; parents: readonly string[] }[] | null` and `only?: string | null`.
- `Prefs` gains `lens: 'all' | 'product'` (LD12).

`FeatureContext.host` wraps `copy`, `changes`, `openVersion`, `onLink`, `onHash` and `itemLink`: safe when absent, a throw or rejection becomes `null`, no call once not live, and every result is `unknown` for the feature to check.
**Rules.** A function option is an own data property holding a function, stored, never called while options are read, and called only inside an operation. Numbers are finite and bounded. `history` keeps 100 entries at most; a sha matches `/^[0-9a-f]{7,40}$/i`; a subject is cut to 200 code units. Vocabulary options are Task 8's (C44).
**Tests (jsdom).** Each option accepted, and refused for a wrong type, a getter (unread) or an unknown key; inherited properties ignored; no function option runs during the read; each wrapper's swallow, its silence after destroy, and its operation; `lens` stored, restored and checked.
**Mutation rows.** Each refusal; the function check; the getter refusal; the `history` bounds; each wrapper's swallow and live check.
**Visual check.** The demo is pixel-identical before and after.
**Done when.** The README lists every option with its default; typecheck, the suite and the walls are green.

### Task 6: Real-browser harness, Level 2 runner, visual compare

**Branch:** on `l2-prototype`, beside Task 5.
**Goal.** A pinned real browser in the suite and CI, the Level 2 runner (§3.5), and a tracked compare script that takes the reference page by argument (C5).
**Files.**
- Modify `package.json` and the lockfile (`playwright-core` 1.63.0); `vitest.config.ts` and `test/vitest-config.test.ts` (a fourth project, `layout`: `test/browser/**/*.test.ts`, `groupOrder` 3; `unit` excludes `test/browser/**`); `.github/workflows/ci.yml` and `test/ci-workflow.test.ts` (`npx playwright-core install --with-deps chromium webkit` before the tests); `.gitignore` and `test/public-ready.test.ts` (`visual-out/` as a named root scratch directory, per C27); `scripts/demo/build.mjs` (`--sample <file>`; `sample.md` moves to `scripts/demo/samples/core.md`).
- Create `test/browser/harness.ts`, `test/browser/layout-corpus.test.ts`, `conformance/layout/core/*`, `scripts/visual/compare.mjs`, `docs/superpowers/plans/l2-mutations/task-6.md`.

**Produces.**
- `openDoc(markdown, options, { browser: 'chromium' | 'webkit', viewport, csp: 'strict' | 'reader' })` returns `{ page, close }`. It renders with `render()`, bundles `./enhance` with esbuild, and serves the page, `reader.css` and the fonts from `https://docreader.test/` (a reserved name) by `page.route` fulfilment, so nothing reaches a network; any other request is aborted. Both policies are `default-src 'none'` with no `'unsafe-eval'`, scripts and fonts from that origin only. `strict` also refuses inline styles; `reader` allows them, as §4.2's reader policy does for Mermaid's injected styles.
- `snapshot(root)`: a structural tree of tag, sorted classes, the chrome mark, role, `aria-*`, `hidden`, `data-docreader-*`, and text cut to 40 characters. No sizes, no inline style values.
- Level 2 cases: `conformance/layout/<feature>/<id>.md`, `<id>.options.json`, `<id>.dom.txt`. `UPDATE_LAYOUT=1` writes expected files; CI never sets it. They stay in the repository in L2; L3 decides whether they ship.
- `node scripts/visual/compare.mjs --ours <page> --reference <page> [--states <list>]`: screenshots at 1440×1000 and 390×844 in light, dark, and sans with wide, plus named states; computed styles and boxes compared block by block, matched by `data-line` (both pages carry it); output in `visual-out/`; exit 1 on any difference over 0.1 px or in a computed value.

**Tests.** A page opens in each browser; a request to any other origin is aborted and counted; a missing browser fails with the install command; the test process opens no socket (measured). First Level 2 cases: the core sample's editorial core, folds and tables. DOM clobbering: headings with ids `jump`, `keys`, `xcard`, `toc-contents`, `__proto__` and `data-docreader-root` change no snapshot and no lookup.
**Mutation rows.** The `unit` exclusion; the `layout` order; the CI step; the request abort; the missing-browser failure; the `visual-out` skip and its nested-name case.
**Visual check.** On the core sample against the coordinator's reference page, the script reproduces the prototype's result: an equal reading column, differing only in parts not yet built.
**Done when.** Four projects run, green in both browsers locally and in CI; the report is in the PR.

### Task 7: Shared services and feature slots

**Branch:** stacked after Tasks 5 and 6.
**Goal.** The services features share, and a file per later feature in the final build order, so group C runs in parallel (LD1). Ports the prelude helpers (clip, a hash, document order), section 0's fingerprints, and section 13's skeleton (skip link, bar, tool tray, progress, running head), unstyled.
**Files.**
- Create `src/enhance/env.ts`, `registry.ts`, `reveal.ts`, `overlays.ts`, `keys.ts`, `nav.ts`, `relayout.ts`, `headctl.ts`, `bar.ts`, `text.ts`, `vocab.ts`, `features.ts`; and a stub with its header and final export for each of `ids`, `rules`, `tables`, `code`, `plans`, `scroll`, `xrefs`, `glossary`, `position`, `figures`, `jump`, `keysheet`, `cards`, `marks`, `rail`, `settings`, `attention`, `strip`, `changes`, `diagrams`, `since` and `diagram-tools` (`.ts`).
- Modify `lifecycle.ts` (build through `features.ts`; the second phase, LD5; fingerprints before any node moves), `journal.ts` (`setStyle`), `types.ts`, `folds.ts` (heading controls, reveal, relayout, a members API), `editorial.ts` (publishes `ctx.page`), `status.ts` (reads `ctx.vocab`), `assets/reader.css` (three marker comments), `test/enhance-walls.test.ts`.
- Create `test/enhance-services.test.ts`, `test/browser/services.test.ts`, `docs/superpowers/plans/l2-mutations/task-7.md`.

**Produces (new `FeatureContext` fields).**
- `env`: `frame`, `timeout` and `idle`, journaled, each returning a cancel function; `matches(query)` (false without `matchMedia`); `reducedMotion()`; `viewport()` → `{ w, h, scrollY }`; `scrollTo(y, smooth)`; `onScroll`, `onResize`, `onPrint(before, after)`; `fonts(maxMs)`; `observeResize`, `observeIntersection`; `textWidth(text, font)` (`null` without a canvas). Callbacks run inside operations. Only `env.ts` reaches `defaultView`; the print listener moves here.
- `index`: `define(e)` (first wins), `get(id)`, `all()` in document order, in a `Map`. Entry: `{ id, kind: 'rule' | 'row' | 'section' | 'figure', title, status: 'ok' | 'wait' | 'no' | 'info' | null, group, target: Element, row: Element | null, heads: readonly string[] }`.
- `terms`; `blocks` (tables and code, with `isIndex`, `glossary`, `tech`, optional `filter`); `figures`; `plan` (`{ tasks, steps, yours, outlineable }`, set by Task 11); `sections`, the h2 units `{ heading, members, minutes, fingerprint }`, hashed from the source text before any chrome; `page` (`{ byline, facts, waiting, waitBox }`, from `editorial.ts`).
- `events`: `on(name, fn)`, `emit(name)`, for `prefs`, `relayout`, `spy`, `marks`, `changes`, `reveal`.
- `reveal(el)`, `onReveal(fn)`: folds and the author's `<details>` register first (opening one is journaled).
- `overlays`: `open`, `close`, `top`, `any`. The Escape order is fixed: figure, keys, jump, settings, changes menu, drawer, card.
- `keys`: `bind({ key, label, when?, run })`, `bindings()`. One keydown listener per document ignores editable targets, modifiers (but Ctrl or Cmd with K), an open overlay and `keyboard: false`. A key goes to the root holding its target, and a key on the body only to a document's sole live root.
- `nav`: `byId(id)` (the document's ids, mapped by a walk, never chrome; then `index`, LD6), `idOf(el)`, `goTo(el, { push, focus })` (reveal, scroll, focus, `onHash`), and one delegated click listener (hash link → `goTo`; other link → `onLink`). Task 14 completes it.
- `position`: `keep(fn)` (here it just calls `fn`), `holdBar()`, `barHeld()`. `relayout(reason)`, debounced, and `onRelayout(fn)`, triggered by resize, prefs, folds, lens and outline.
- `headCtl(h, slot: 'anchor' | 'mark' | 'fold')`: one `.h-ctl` per heading, slots in fixed order. `slots`: `{ bar, tools, running, progress, skip }` for a document with `chrome.bar`, else `null`; the skip link focuses the root.
- `vocab` (the built-in word lists, moved from `status.ts`); `chromeId(name)` (per-instance, unique against the document's ids); `journal.setStyle` (LD11). A feature module exports `build(ctx)`, plus `after(ctx)` when it waits on the host.

**Ambient APIs replaced.** Timers, `requestAnimationFrame`, `requestIdleCallback`, `matchMedia`, scroll and resize listeners and `document.fonts` → `env`; `getElementById` → `nav.byId`; `CSS.escape` and built selectors → walks; `el.style` → `journal.setStyle`; expandos → WeakMaps.
**Tests (jsdom).** Destroy cancels every `env` callback, and one already queued does nothing (RF5). `index`: first-wins, document order, an id `__proto__`. `byId` skips chrome and falls back to `index`. The delegated click: hash, sibling document, modified click. The Escape order; the key guards, a second root included. `setStyle` restores conditionally. The skeleton only for a document with `chrome.bar`. Every earlier test stays green.
**Tests (browser).** `setStyle` applies under the `strict` policy, which refuses inline styles, in both browsers.
**Walls.** `defaultView` only in `env.ts`, `.style` only in `journal.ts`; timer and observer globals refused elsewhere.
**Mutation rows.** Each cancel; `env`'s not-live refusal; first-wins; chrome skipped; each key guard; the single-root rule; `setStyle`'s restore and name list; the new wall sites.
**Visual check.** The demo is pixel-identical.
**Done when.** Every stub is in `features.ts`, whose header gives the reference dependency behind each step of the order.

### Task 8: Vocabulary and namespace options

This is the §3.7 scrub task that C44 names.
**Goal.** Every built-in word list becomes an option with a neutral, documented default (LD9); storage keys get a namespace; the item-link plugin is added.
**Ports.** The reference's status table, ID and rule-ID grammars, qualifier words, plan words and addressees, and the byline's item link (section 2).
**Files.** Modify `src/enhance/types.ts`, `options.ts`, `vocab.ts`, `state.ts` and `editorial.ts` (the byline's item link). Standard files (slug `vocab`, no Level 2 cases).
**Produces.**
- `vocabulary?: { status?: { ok?, wait?, no?, info?: string[] }; statusHeaders?: string[]; ids?: false | { prefixes?: string[] }; ruleIds?: { prefixes: string[] }; qualifiers?: string[]; plan?: { task?: string; step?: string; who?: string }; addressees?: string[]; itemFields?: string[] }`. Each field replaces its default.
- `namespace?: string`, matching `[a-z][a-z0-9-]{0,31}`, default `docreader`. The keys become `<ns>:prefs`, `<ns>:ui`, `<ns>:pos:<posKey>` and `<ns>:doc:<storageKey>:<name>`.

**Defaults.** Qualifiers: none. Addressees: `["you"]`; a host adds others, such as `"operator"`. Status words keep the general ones, and the PR lists any word moved out of the default for the coordinator to rule. The ID grammar is documented: 1-4 capital letters, an optional dash, a number with dotted or dashed parts, and an optional lower-case letter. The item link is off unless both `itemLink` and `itemFields` are given; then a byline fact whose label is in `itemFields` and whose value has an item-key shape becomes a link, routed through `onLink`.
**Scrub.** The reference's private qualifier words and rule-ID prefix, the unprefixed storage keys, and the fixed `docreader:` prefix. This closes both "Open before v1" notes (`status.ts`, `state.ts`).
**Tests (jsdom).** The defaults reproduce the prototype's marks. A custom list changes them. Metacharacters in a word are literal. Bounds: 200 words of 64 characters. Every key carries the namespace, and a bad namespace is refused. The item link appears only with both options.
**Mutation rows.** Escaping; each bound; the namespace check; the item link's two conditions.
**Done when.** No word list remains in `src/enhance` outside `vocab.ts`'s defaults.

### Task 9: IDs: rule paragraphs, rules index, ID rows

**Goal.** Fill `ctx.index` from rule paragraphs (the rules plugin, off by default), lettered sections and ID table rows, and add the rules index to the facts panel.
**Ports.** Reference sections 3 (rule paragraphs), 4 (the rules index and its open rule), 6 (lettered sections as definitions) and 8 (ID rows: `idcell`, row definitions, the group from the nearest h2 or h3).
**Files.** Fill `src/enhance/ids.ts` (ID rows and lettered sections, on by default) and `src/enhance/rules.ts` (rule paragraphs, the rules index and the plugin's document kinds, on with `rules: true`). Standard files (slug `ids`).
**Interfaces.** Consumes `options.rules`, `ctx.vocab`, `statusOf`, `ctx.page.facts` and `ctx.blocks`. Produces `index` entries of kinds `rule`, `row` and `section`; `blocks[].isIndex`; and the classes `rule`, `rule-head`, `pill.<role>`, `idcell`, `rlink`, `rid` and `rtitle`. It writes no ids (LD6). A rule's dash and status text are split off and wrapped in a hidden chrome span, and the status word moves into the pill.
**Ambient APIs replaced.** The id-collision probe goes, because targets are elements. `innerWidth` in the open rule becomes `env.matches('(min-width: 700px)')`.
**Scrub.** The rule-ID grammar and document kinds sit behind the plugin. The "Rules" label is documented. The reference's example IDs are never copied.
**Tests (jsdom).** One ID, two IDs and IDs joined by "and"; a status with a note of 40 characters or fewer. A paragraph whose first node is white space is not a rule (pinned). Destroy restores the text byte for byte. The ID-row threshold. A lettered section is defined. First-wins. The rules index opens at 6 rules or fewer. `rules: false` builds none of the plugin.
**Mutation rows.** The first-node rule; the hidden separator going through the journal; the row threshold; first-wins; the plugin switch; the open rule.
**Visual check.** A sample with a rules list in its front matter and an ID table: the facts panel open and closed, light and dark, at both viewports.
**Done when.** Level 2 cases cover a rule document and an ID table.

### Task 10: Tables and code blocks

**Goal.** Finish tables, and give code blocks their Copy buttons and widths.
**Ports.** The rest of reference section 8 (bullet cells, the filter on tables of 12 rows or more, and `measure`: `fits`, `--thead-h`, the scroll region) and section 9 (Copy, the second Copy on a tall block, `long`, the code scroll region).
**Files.** Fill `src/enhance/tables.ts` and `src/enhance/code.ts`. Standard files (slug `blocks`, with browser tests).
**Interfaces.** Consumes `ctx.blocks`, `host.copy`, `env.textWidth` and `env.timeout`, `onRelayout`, `journal.setStyle` and `chromeId`. Produces the classes `cell-line`, `tbl-block`, `tbl-tools`, `fits`, `code-copy`, `tall` and `long`; `--thead-h`; and a labelled `role="region"` on an element that overflows. A filtered row gets a journaled `hidden`, never `style.display`. A bullet cell's `<br>` is hidden by a class, not removed.
**Ambient APIs replaced.** `navigator.clipboard` becomes `host.copy`, given `textContent` (not `innerText`). Canvas `measureText` becomes `env.textWidth`, with the reference's 7.5 px fallback. `innerWidth` becomes the root's width, since the column belongs to the root. The resize listener becomes `onRelayout`, and `requestIdleCallback` becomes `env.idle`.
**Tests (jsdom).** Copy passes `textContent`; a rejection shows "Failed"; destroy clears the label timer; no `copy`, no buttons. The filter's count and hidden rows, which destroy restores. Bullet cells.
**Tests (browser, both).** `fits` on a narrow table; `long` on a wide code block at 1440 and not at 390; `--thead-h` equals the head's height; relayout after a width change; the region label.
**Mutation rows.** The rejection; the timer clear; the filter through the journal; the 12-row and 36-line thresholds; the column constant against `reader.css` (changing 44 rem reddens `long` in the browser).
**Visual check.** Copy buttons, a long code block, a wide table and a filtered table, at both viewports, light and dark.
**Done when.** Both browsers are green.

### Task 11: Plans and outline mode

**Goal.** Scannable plans: task badges, step numbers and owners, "yours" marks, and an outline mode for long plans.
**Ports.** Reference sections 7 (tasks, steps, the outline setup) and 23 (outline mode).
**Files.** Fill `src/enhance/plans.ts`. Standard files (slug `plans`).
**Interfaces.** Consumes `ctx.vocab` (plan words and addressees), `slots.tools`, `keys` (`o`), `onReveal`, `position.keep`, `relayout`, and `state.readDoc` and `writeDoc('outline')`. Produces `ctx.plan`; the classes `task`, `task-id`, `tmeta`, `yours`, `step-no`, `who`, `step-rest`, `loose`, `attn`, `task-part`, `task-open` and `t-open`; the root class `outline`; and the Outline button. Text is changed only by `split` and `wrap`. Steps get no ids. A stored outline is applied during the build, so the full plan never flashes.
**Ambient APIs replaced.** The id probe goes. `CSS.escape` and the `[data-task]` selector become a walk. Storage goes through `state`.
**Scrub.** The word "operator" (an addressee option now) and the "Who:" label (`vocab.plan.who`). The 20-step threshold is documented.
**Tests (jsdom).** Both task grammars; steps with and without an owner; "yours" by addressee; the 20-step threshold; the outline stored and applied in the build; the `o` key; reveal opens a collapsed task; destroy restores the text byte for byte; the Outline button is never inside the fold's label.
**Mutation rows.** The threshold; build-time application; the reveal registration; the split through the journal; the addressee list.
**Visual check.** A plan sample, in full and in outline, at both viewports.
**Done when.** `ctx.plan` is published for Tasks 19 and 20.

### Task 12: The bar and scrolling

**Goal.** Style the bar inside the root, and drive the progress bar, the running head, the phone bar and the scroll spy.
**Ports.** Reference sections 13 (bar, skip link, progress, running head) and 17 (the scroll handler, spy and phone bar).
**Files.** Fill `src/enhance/bar.ts` (beyond the skeleton) and `src/enhance/scroll.ts`. Insert the bar block into `assets/reader.css` at its marker: the bar sticky inside the root, and the root classes `scrolled` and `bar-hidden`. Standard files (slug `scroll`, with browser tests).
**Interfaces.** Consumes `slots`, `sections`, `env.onScroll` and `env.frame`, `position.barHeld()` and `journal.setStyle` (the progress width). Produces `events.emit('spy')` with `{ section, unit }`; `--bar-h` on the root, measured; and the root classes `scrolled` and `bar-hidden`.
**Ambient APIs replaced.** The window scroll listener, `scrollY`, `innerHeight` and `matchMedia` go through `env`, and `Date.now` through `position`. Body classes become root classes. A host that scrolls an inner element is out of scope for L2, and the PR's README text says so.
**Tests (jsdom, stubbed rects).** The current section at the reading line; before the first section; the running head's text.
**Tests (browser).** The progress width at three positions. At 390 px the phone bar hides when scrolling down past 300 px, returns on scrolling up, and stays while an overlay is open or the bar is held. RF3: on the large plan, rect reads per frame stay at or below 2⌈log₂ n⌉ + 4, counted in the page.
**Mutation rows.** The live check on the frame; the overlay suppression; the hold; the binary search (a linear scan breaks the bound).
**Visual check.** The bar at the top; scrolled, with the running head; the phone bar hidden and shown; light and dark.
**Done when.** `spy` events reach Task 18 through `events`.

### Task 13: Cross-references and the glossary

Its tests seed `index` and `terms` with fixtures, so it does not wait for Task 9.
**Goal.** Link the first mention of a defined ID in each block, and underline the first mention of each glossary term in each section.
**Ports.** Reference sections 12 (ID cross-references) and 12b (glossary terms).
**Files.** Fill `src/enhance/xrefs.ts` and `src/enhance/glossary.ts`. Standard files (slug `links`).
**Interfaces.** Consumes `index`, `blocks`, `ctx.vocab` (IDs and qualifiers) and `ctx.page`. Produces `a.xref[data-ref]` and `a.term[data-term]`, each with `aria-haspopup="dialog"` and `aria-expanded`, as chrome around split text, with `href="#<ID>"` resolved by `nav` (LD6). Also `terms` entries, and the classes `glossary`, `termcell` and `term`. A glossary table is a two-column `Term | Meaning` table, or one under "Words used here", "Glossary" or "Terms used" (the format contract).
**Ambient APIs replaced.** A text node's `replaceWith` becomes `journal.split` and `wrap`. Row ids become `terms` entries that hold the row.
**Scrub.** The reference's qualifier words; the option's default is empty.
**Tests (jsdom).** The skip list (code, links, headings, `th`, figures, the byline, facts, the rule head, the eyebrow, step numbers, a mention inside its own target). First mention per block and per section. Plurals. Exact terms are case-sensitive. Aliases ("A (B)", "A, B and C", "A / B"). An xref and a term never overlap. Destroy restores every text node. RF3: the large plan starts within the measured budget, and a 2× document takes at most 2.5× the time.
**Mutation rows.** Each skip; first-mention; the case rule; the qualifier check; linearity.
**Visual check.** Xref and term styles, light and dark.
**Done when.** Level 2 cases pin first-mention and plurals.

### Task 14: Navigation and reading position

**Goal.** In-page links that reveal, scroll, focus and flash; Back through the host (LD7); the reading position across reloads; and the section `#` link.
**Ports.** Reference sections 11 (sibling links: a click guard replaces the URL rewrite), 18 (going places), 27 (reading position) and section 19's `#` link.
**Files.** Complete `src/enhance/nav.ts`, and fill `src/enhance/position.ts`. Modify `src/enhance/index.ts` (export `goToHash`), `lifecycle.ts` (route it to the instance) and `README.md` (one line naming `goToHash`, which the walls test requires). Standard files (slug `nav`, with browser tests).
**Interfaces.** The new export `goToHash(root, id: string | null, from?: string): void`. Consumes `host.onHash`, `host.onLink`, `initialHash`, `posKey`, `state` (`<ns>:pos:<posKey>`, a checked token `{ line, offset, y }` whose `line` matches `/^\d+(-\d+)?$/` or names an id), `env`, `reveal` and `headCtl('anchor')`. Produces `position.keep(fn)` (anchor now, restore after), the pin and hold, the `flash` class, and a journaled `tabindex="-1"` on a focused target.
**Ambient APIs replaced.** `pushState` and `replaceState` become `onHash(id, { push, from })`. `popstate` becomes `goToHash`. `location.hash` becomes `initialHash`. `history.scrollRestoration` is dropped, as the host's concern. Navigation types are dropped: `initialHash` wins when given, else the stored position. `elementFromPoint`, `scrollTo` and reduced motion go through `env`.
**Scrub.** The reference's history-state keys and its position-key prefix.
**Tests (jsdom).** A hash click reveals, calls `onHash` with `push` and `from`, and focuses. A modified click calls `onLink` with `newTab`, and so does a sibling `.md` link without the modifier. `initialHash` resolves a heading id and an index ID. RF1: `__proto__`, `constructor`, and an id equal to a chrome class. RF4: a stored token of the wrong shape, or holding selector characters, is ignored. Destroy cancels the pin and the debounce.
**Tests (browser).** The initial hash lands under the bar. `goToHash` with a `from` token restores the offset within 2 px. The position survives a reload. The pin holds the target while a block above grows. Reduced motion jumps at once.
**Mutation rows.** Each check of the token; the pin's release on wheel, key and pointer input; reveal before scroll; `initialHash` precedence; the `from` restore.
**Visual check.** The flash on a target, and the `#` link on hover.
**Done when.** The README text for the Back recipe is in the PR body.

### Task 15: Figures and the Mermaid file

**Goal.** Book captions for figures, and the self-hosted single-file Mermaid with its notices and no `elkjs` (LD3, LD4).
**Ports.** Reference section 10, and §3.4 and §3.6 (Mermaid, `THIRD-PARTY-NOTICES`, elkjs).
**Files.**
- Fill `src/enhance/figures.ts`.
- Create `scripts/build-mermaid.mjs`, `scripts/mermaid-elk-stub.mjs`, `test/mermaid-bundle.test.ts`, `test/enhance-figures.test.ts`, `test/browser/mermaid-file.test.ts` and `docs/superpowers/plans/l2-mutations/task-15.md`.
- Modify `package.json` and the lockfile (`mermaid` 12.1.0 as a dev dependency; `build` runs `build:mermaid`), `.gitignore` (`assets/mermaid/`), `THIRD-PARTY-NOTICES` (a generated section), `test/pack.test.ts` and `scripts/consumer-smoke.mjs` (the file resolves through `./assets/*`).

**Interfaces.** Produces `assets/mermaid/mermaid.mjs`: one ESM file with no `import()` and no chunks, whose default export is the Mermaid API. Also `ctx.figures` entries `{ no, caption, figure }`, `index` entries of kind `figure`, and `span.fig-no` and `span.cap-text`, made by `split` and `wrap`. The caption grammar `Figure N.` comes from `render()` (PD7) and is the format contract.
**Work.** First measure whether Mermaid's own single file carries `elkjs`, and record the answer in the PR. Then build: esbuild over the pinned package, with `elkjs` aliased to the stub. Take every input package from the metafile, and write its notice from the package's `LICENSE` text.
**Tests (node).** One file; no `elkjs` input in the metafile and no ELK signature in the file; every bundled package named in the notices with its licence; two builds give the same sha256; the size is within a stated bound.
**Tests (browser).** The file loads under the `reader` policy (no `'unsafe-eval'`) and draws a flowchart in both browsers.
**Tests (jsdom).** The caption split; destroy restores it; the figure entries.
**Mutation rows.** The `elkjs` alias; a missing notice; the CSP page; the caption split through the journal.
**Visual check.** The caption ("Figure 1." and its text), light and dark.
**Done when.** The pack test and the consumer smoke resolve the file, and the notices match the metafile exactly.

### Task 16: Quick jump and the keys sheet

**Goal.** The `/` and Ctrl or Cmd+K finder over sections, tasks, IDs and figures, and the `?` sheet of the keys that features bind.
**Ports.** Reference sections 21 (quick jump) and 25 (the keys sheet; the keyboard layer is Task 7's `keys`).
**Files.** Fill `src/enhance/jump.ts` and `src/enhance/keysheet.ts`. Standard files (slug `jump`, with browser tests).
**Interfaces.** Consumes `sections`, `plan`, `index`, `figures`, `slots.tools`, `overlays`, `keys`, `nav.goTo` and `chromeId`. Produces `.jump-btn`; `.jump`, a combobox with a listbox and `aria-activedescendant` on per-instance ids; and `.keys`, a dialog listing the `keys.bindings()` that apply now, with the colour key.
**Ambient APIs replaced.** `document.activeElement` becomes the root document's. `scrollIntoView` is guarded. Body classes become `overlays.any()`.
**Scrub.** The placeholder and the colour key use neutral ID examples only.
**Tests (jsdom).** The ranking (exact ID 100, section number 95, ID prefix 80, and so on). An empty query lists the headings. Four entries or fewer build no jump. A hostile query (metacharacters, 10^5 characters) stays bounded. Focus returns to the opener. The sheet lists only the bindings that apply. RF2: with two roots, `/` opens the jump of the root holding focus, and Escape closes only that root's overlay.
**Tests (browser).** The keys sheet traps focus, and the selected row stays in view.
**Mutation rows.** The threshold; escaping; the editable-target guard; the one-root rule; focus return.
**Visual check.** The jump with results, and the keys sheet, in light, dark and on a phone.
**Done when.** A key bound by a later task appears in the sheet without an edit to `keysheet.ts`.

### Task 17: Preview cards

**Goal.** A preview on hover, focus or first tap for an ID mention, a term or a diagram block.
**Ports.** Reference section 20.
**Files.** Fill `src/enhance/cards.ts`. Standard files (slug `cards`, with browser tests).
**Interfaces.** Consumes `index`, `terms`, `a.xref`, `a.term`, `overlays`, `env`, `journal.setStyle` (`left`, `top`, `max-height`) and `nav.goTo`. Produces `.xcard`, a dialog inside the root, with `.open` and `.is-term`, and `cards.show(trigger)` for Task 23. A clone drops ids and form controls, and turns `a.xref` and `a.term` into plain text.
**Ambient APIs replaced.** The card moves from the page body into the root; the PR's README text says that an ancestor with `transform`, `filter` or `contain` moves it. The card's eleven timers go through `env`, and the bar height through `--bar-h`.
**Tests (jsdom).** Content for a row, a rule, a section and a term. ARIA. Escape returns focus without reopening. On touch, the first tap previews and the second goes (pointer-event fakes). Tab moves into the card and out. After destroy no timer fires (fake timers).
**Tests (browser).** Placement below, above and clamped; it never covers the trigger, and it follows scroll.
**Mutation rows.** Id stripping in clones; each close path; the timer cleanup; tap-then-go.
**Visual check.** A card on a row ID and on a term, light and dark, at both viewports.
**Done when.** `cards.show` is ready for diagram blocks.

### Task 18: Read marks and the contents rail

**Goal.** Read marks per section, with "changed since you read it", and the two-tab rail (Contents, Index) beside the text, which becomes a drawer on a narrow screen.
**Ports.** Reference sections 14 (read marks) and 15 (the rail and drawer), and section 19's read-mark button.
**Files.** Fill `src/enhance/marks.ts` and `src/enhance/rail.ts`. Insert the rail block into `assets/reader.css` at its marker: the sticky column at 1,240 px of viewport width; below that the drawer, scrim and Contents button; and the root classes `has-toc` and `toc-open`. Standard files (slug `rail`, with browser tests).
**Interfaces.** Consumes `sections` (source-text fingerprints, so the library's own chrome text never flips a mark), `plan`, `index`, `events` (`spy`, `changes`), `headCtl('mark')`, `keys` (`m`, `i`), `overlays`, `chromeId` and `slots.tools`. Stores `<ns>:doc:<key>:marks` (heading id to hash; read into a `Map`, written with a null prototype, and pruned of ids that no longer exist), `<ns>:doc:<key>:ixfold` and `<ns>:ui` (`sidetab`). Produces `.doc-toc`, `.toc-tabs`, `.toc-contents`, `.toc-index`, `.h-mark`, `.mk` and `.toc-foot`.
**Ambient APIs replaced.** Body classes become root classes. `scrollIntoView` and `getClientRects` are guarded where jsdom lacks them.
**Tests (jsdom).** Unread, read and changed; a task unit on a long plan; RF1: marks for `__proto__` and `constructor` round-trip, and no prototype changes; pruning; the remembered tab; index groups and their folds; `m` and `i`.
**Tests (browser).** The rail at 1440 and the drawer at 390; the focus trap; the active link follows the spy, and the panel scrolls it into view.
**Mutation rows.** Source-text fingerprints; the null prototype; pruning; the drawer's overlay registration; the roving `aria-selected`.
**Visual check.** Both tabs at 1440, the drawer open at 390, and read and changed marks; light and dark.
**Done when.** The rail block is the only placement CSS added, and the root still owns its box (C43).

### Task 19: Settings menu, lens and attention marks

**Goal.** The Aa menu (theme, typeface, width, lens, collapse and expand all, colour key); the Product lens with its "Show engineering detail" bars; and the marks for what needs the reader.
**Ports.** Reference sections 22 (reading settings) and 12c (attention, file-path tone, Product lens).
**Files.** Fill `src/enhance/settings.ts` and `src/enhance/attention.ts`. Standard files (slug `settings`, with browser tests).
**Interfaces.** Consumes `state.prefs` and `setPrefs`; `events` (`prefs`, so a change made through `setEnhancementPrefs` updates the radios); the folds members API; `position.keep`; `relayout`; `blocks`; `plan` (`yours`); `index`; `ctx.vocab`; `overlays`; `chromeId`; and `slots.tools`. Produces `.aa-wrap`, `.aa-btn`, `.aa-menu`, `.peek-bar`, `.peek-btn`, `.peek-open`, `tr.attn`, `tr.risk`, `p.rule.attn`, `p.rule.risk`, `code.path`, `.tech`, and the root class `lens-product`. The menu is built only with `chrome.settings`.
**Ambient APIs replaced.** The menu's storage keys become prefs (LD12). `html.dataset` becomes the root's attributes, and `body.lens-product` the root class.
**Scrub.** Neutral ID examples in the colour key. Addressees and status words come from `ctx.vocab`.
**Tests (jsdom).** The radios follow prefs set by the host. Escape, an outside pointer and focus leaving close the menu. Collapse all writes once. The first use of the lens builds peek bars that join folds. Each attention rule. RF2: two roots keep separate radio groups.
**Tests (browser).** A font or width change keeps the reader's place within 2 px.
**Mutation rows.** The radio subscription; the batched fold-all; peeks joining folds; each attention rule; per-instance names.
**Visual check.** The menu open, light and dark; the lens on and off; attention rows.
**Done when.** `lens` drives the root class and is stored with the prefs.

### Task 20: Review strip and what changed

**Goal.** The strip under the byline (waiting items, decision counts, plan counts), and the marks and stepper for what changed since a commit.
**Ports.** Reference sections 16 (review strip) and 24 (what changed).
**Files.** Fill `src/enhance/strip.ts` and `src/enhance/changes.ts` (with `after`). Standard files (slug `changes`, with browser tests).
**Interfaces.** Consumes `page` (`byline`, `waiting`, `waitBox`), `blocks`, `plan`, `host.changes`, `nav.goTo`, `reveal`, `keys` (`n`, `p`, `w`) and `slots.tools`, and emits `changes`. Produces `.review-strip`, `.rs-wait`, `.rs-facts`, `.cnt.<role>` and `.chg-nav`, and the classes `chg` and `chg-del`, journaled, on blocks with `data-line`. Links to waiting items are chrome anchors handled by `goTo`, so no `waiting-N` ids are written. A change set is `{ changed: [from, to][]; removedAfter: number[] }`. Exports `showChanges` for Task 22.
**Checks (RF4).** Pairs of finite integers with `from` at most `to`; at most 10,000 ranges and 10,000 deletions; lines clamped to the document's last `data-line`. Anything else reads as no changes.
**Tests (jsdom).** The largest status table wins, and a tie goes to the first in document order (pinned). One hunk across two rows is one stop. Nested hits keep the innermost. Stepping starts from the reader's position (stubbed rects). Hide clears every mark. RF5: a reply after destroy writes nothing.
**Tests (browser).** A step brings the next change under the bar and flashes it.
**Mutation rows.** Each bound; the tie rule; the innermost rule; the live check after the await.
**C44 (c).** Report in the PR whether the strip should show the front-matter scalars that C44 leaves hidden (an `owner`, say), for the coordinator to rule. No change by default.
**Visual check.** The strip with waiting items and facts; change marks and the stepper; light and dark.
**Done when.** `changes` events light the rail's sections (Task 18) through `events`, with no import between the two.

### Task 21: Diagrams: drawing

**Goal.** Draw each Mermaid figure in the second phase (LD5), safely configured, with a readable fallback on failure.
**Ports.** The drawing part of reference section 26, and the first-paint steps that concern diagrams.
**Files.** Fill `src/enhance/diagrams.ts` (with `after`). Insert the drawn-state rule into `assets/reader.css` at its marker (the source `pre` is hidden once its drawing exists). Standard files (slug `diagrams`, with browser tests).
**Interfaces.** Consumes `options.mermaid`, `figures`, `env` (`fonts`, `frame`, `observeIntersection`) and `journal.setStyle` (`--fig-w`). Produces the root attributes `data-docreader-mermaid` (the gate, set only when drawing starts) and `data-docreader-diagrams`; a chrome drawing beside the document's own `pre`, which is never written into; `.fig-error`, holding the source in a `details`; and `svg[role=img][aria-label]`.
**Configuration (§3.4).**
- `securityLevel: 'strict'`.
- `maxTextSize` and `maxEdges` are pinned at Mermaid 12.1.0's defaults, measured and stated.
- `secure` lists every style-bearing key of Mermaid 12.1.0's configuration, enumerated from its schema, plus the host's additions.
- The library sets the warm theme variables and `fontFamily` (Docreader Sans) through `initialize`, so no directive can change them.
- Calls are serialised in one queue per Mermaid module, across roots, and `initialize` runs before each call.
- Drawing uses `mermaid.run` on the chrome node, with no id lookup.

**Tests (jsdom, a fake Mermaid).** The queue order; near figures first; the failure fallback; a destroy during a pass stops it; RF5: a `load()` that resolves after destroy draws nothing.
**Tests (browser, the real file).** The hostile Level 2 cases, under the `reader` policy: an init directive with `themeCSS` holding `position:fixed`; a `click` directive; an HTML label; text over `maxTextSize`; edges over `maxEdges`; and a `layout: elk` directive. Each expects no injected style, no handler, and the fallback where it applies.
**Mutation rows.** `securityLevel`; each group of `secure` keys; the limits; the queue; the live check after each await; the source `pre` left untouched.
**Visual check.** A flowchart, a sequence diagram and a failed diagram, light and dark (the plate filter).
**Done when.** Every hostile case passes in both browsers, and the PR body documents the diagram states.

### Task 22: Changes since, and the day view

**Goal.** The "Changes since…" menu grouped by day, the notice of changes since the last visit, and the banner for the version of one day.
**Ports.** Reference section 24b.
**Files.** Fill `src/enhance/since.ts` (with `after`). Standard files (slug `since`, with browser tests).
**Interfaces.** Consumes `info.sha`, `draft`, `history` and `only`; `host.changes` and `host.openVersion`; `showChanges`, which Task 20 exports; `state` (`<ns>:doc:<key>:seen`, `{ sha, at }`, written once per load); `overlays`; and `chromeId`. Produces `.chg-pick`, `.chg-menu` (a menu with roving `tabindex` and type-ahead), `.rs-notice`, and `.ver-banner` in the root's bar. "Only this day" calls `openVersion({ sha, only })`, and "Back to the latest" calls `openVersion({ sha: null, only: null })`; both are buttons, not links. Day keys use local time through an injected clock, so tests pin the time zone.
**Scrub.** No routing parameters. The merge-commit and commit-prefix rules are documented as the format contract.
**Tests (jsdom).** Day grouping across midnight in a pinned zone; quick ranges dropped when empty or equal to a row above; the last-visit notice; keyboard navigation; RF4: 10^5 history entries and 1 MB subjects stay bounded; a reply after destroy writes nothing.
**Tests (browser).** The menu scrolls to make room and is clamped.
**Mutation rows.** Each bound; the dedupe; the `seen` write; the live check after each await.
**Visual check.** The menu open, the notice, and the day banner; light and dark.
**Done when.** `since.ts` builds no URL.

### Task 23: Diagram tools

**Goal.** Copy Mermaid, Play, Animate edges, full screen, and definitions on diagram blocks.
**Ports.** The tools and definitions of reference section 26.
**Files.** Fill `src/enhance/diagram-tools.ts`. Standard files (slug `diagram-tools`, with browser tests), with one Level 2 case per Mermaid internal id shape: `g.node` ids, `path.flowchart-link[data-id]`, `g.edgeLabel`, `g.cluster`.
**Interfaces.** Consumes the drawn SVGs, `host.copy`, `terms`, `index`, `cards.show`, `overlays`, `env` (`timeout`, `frame`, `observeResize`) and `journal.setStyle`. Produces `.tools[role=toolbar]`; `svg.flowing`, `rv-hide` and `rv-draw`; `.fig-overlay` inside the root (zoom, pan, pinch and keys, with the clone's ids renamed together with their `url(#…)` and `href` references); and `.dnode` with `.dn-dot` and `.dn-ring`. Full screen makes no history entry (LD7), and it locks scrolling with a root class, never on `html`.
**Tests (jsdom).** Graph order on a fixture SVG; term and ID matching on labels; destroy cancels Play's timers; the overlay's focus trap and Escape.
**Tests (browser).** Fit, zoom and pan; dots placed by `getBBox`; the drag and tap thresholds.
**Mutation rows.** Id renaming in the clone; each timer cleanup; the trap; the id-shape guards.
**Visual check.** The toolbar, Play part way, full screen in light and dark, and the dots.
**Done when.** A Mermaid upgrade that moves an internal id shape reddens a Level 2 case (§3.5).

### Task 24: Scrub audit, docs, parity and whole-branch review

**Goal.** Close L2 and stage it for L3.
**Files.** Modify `README.md` and `test/readme.test.ts`, `THIRD-PARTY-NOTICES` and `scripts/consumer-smoke.mjs`. Standard files (slug `scrub`, no Level 2 cases).
**Work.**
1. **README.** `./enhance` in full: every option, export, storage key, root attribute and class contract; the format-contract headings; and where the layout differs from the reference (no ids written, deep links through the index, Back through `goToHash`, drawing beside the source, no history entry for a figure, a persistent position, the lens on the root). It is assembled from the README text in each task's PR body.
2. **The §3.7 audit.** For each row of the scrub list, name where it was handled and the test that pins it. `enhance-scrub.test.ts` checks shapes, never a list of private names: no URL literal and no unprefixed storage key in `src/enhance`, word lists only among `vocab.ts`'s defaults, and no "Open before v1" note.
3. **Level 2 coverage.** Every feature has cases. The DOM-clobbering ids cover every chrome class and the seed names that L3 will use. Every hostile Mermaid case is present.
4. **Full visual parity.** The compare script on every neutral sample, at both viewports, in the three pref states, plus each task's interactive states. Attach the report.
5. **Whole-branch review.** A held-out panel over `main..HEAD`, run as for each task, then a fix round.
6. **The consumer smoke** imports every export, `goToHash` included, and resolves the Mermaid file.

**Done when.** Green on Node 22 and 24 and in both browsers; every L2 row is red as recorded; the parity report has no unexplained difference.
