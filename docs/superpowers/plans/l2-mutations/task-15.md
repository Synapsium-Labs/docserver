# L2 Task 15: mutation rows (figures and the Mermaid file)

Each guard of Task 15, deleted or inverted once, with the tests that go red: the captions, figure entries and index
entries (`src/enhance/figures.ts`), the Mermaid file's build and its notices (`scripts/build-mermaid.mjs`,
`THIRD-PARTY-NOTICES`, `.gitignore`, `package.json`), the file in a real browser, and the packed package with its
consumer smoke. Measured 2026-10-20 on branch `l2-t15-figures` at commit `ed2adea`, every row, L2-T15-M1 to
L2-T15-M53: all 53 red (`rc=1`), L2-T15-M36 on its second mutation (below).

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8), as Task 7b ran it. Each row is applied to its own throwaway
copy of the working tree (tracked and untracked files, never ignored ones, `node_modules` linked from the checkout),
its test file runs there with the local `vitest`, and the copy is deleted. Each `old` occurs exactly once in its file.
The rows ran with `DOCREADER_BROWSERS=chromium` (C45): the browser rows ran in Chromium, and WebKit was reported as
excluded. They ran in two batches side by side. The checkout was never edited: `git status --porcelain` read the same
(empty) before and after, and so did `HEAD` and the hash of `git diff`. The Red column gives the count line and the
failing tests the run printed (at most five here).

Notes on the measurement.
- **Rows on the built file, and their control runs.** The tests build the Mermaid file themselves, in memory, with
  `scripts/build-mermaid.mjs` (CI runs the tests before `npm run build`), so a row whose tests read the built file runs
  plain `vitest`, not `npm run build:mermaid && vitest`: the copy has no `assets/mermaid/` (it is ignored), and the
  test builds the file from the copy's own script. The rows whose tests build the file are L2-T15-M23 to M47 (the
  bundle test) and L2-T15-M48 to M50 (in the browser). Each command was run once in an unmutated copy,
  the same way, as a control: L2-T15-C1 to L2-T15-C4, all green (the last section). A control is a row whose `new`
  equals its `old`, so `mutate.mjs` reports it `NOT RED`, which is what a control should be.
- **L2-T15-M36** (a nested package is its own directory) was green on its first mutation, a lazy quantifier, which
  is equivalent for these inputs: the optional prefix still matches up to the nested `node_modules`. The row now reads
  only the top-level directory, and is red.
- **L2-T15-M28** (symlinks kept as written) is red because the copy's `node_modules` is a link, as `mutate.mjs` makes
  it: 2,110 inputs then name the linked tree's path. In a checkout with a real `node_modules` directory the mutant
  is equivalent; a linked one is the case the option exists for (the pack test's clean copy links it too).
- **L2-T15-M25** (no code splitting) is red in the file's hook: esbuild refuses `splitting` with one `outfile`, so
  every case of the file is skipped and the file fails.

## Captions, figure entries and index entries: `src/enhance/figures.ts` (L2-T15-M1 to L2-T15-M22)

The caption grammar, the split through the journal, the spans and the separator, the bounds, the position number, the figure entries and the index entries; two rows read the Level 2 case.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T15-M1 | a caption number ends in a dot | `src/enhance/figures.ts` | `(Figure\s+(\d+[a-z]?)\.)` → `(Figure\s+(\d+[a-z]?)\.?)` | `test/enhance-figures.test.ts`: 1 failed \| 21 passed (22). "leaves a caption alone when its number has no dot after it" |
| L2-T15-M2 | a caption number is ASCII digits, as the reference reads it | `src/enhance/figures.ts` | `(Figure\s+(\d+[a-z]?)\.)` → `(Figure\s+([^.\s]+)\.)` | `test/enhance-figures.test.ts`: 4 failed \| 18 passed (22). "leaves a caption alone when it does not open with "Figure", digits and a dot"; "destroy puts every caption back: the same nodes, with the same text, in the same order"; "one per figure, in document order: the caption's number, else the figure's position; the caption's text after the number"; "an index entry of kind figure, `figure-<no>`, titled by its caption, so byId reaches the figure" |
| L2-T15-M3 | a caption number may end in a lower-case letter | `src/enhance/figures.ts` | `(Figure\s+(\d+[a-z]?)\.)` → `(Figure\s+(\d+)\.)` | `test/enhance-figures.test.ts`: 1 failed \| 21 passed (22). "reads a lettered number, as the reference's pattern does" |
| L2-T15-M4 | white space before "Figure" stays before the number | `src/enhance/figures.ts` | `  const no = lead.length > 0 ? journal.split(first, lead.length) : first;` → `  const no = first;` | `test/enhance-figures.test.ts`: 1 failed \| 21 passed (22). "keeps white space before "Figure" where it was" |
| L2-T15-M5 | a caption that is its number alone is not split after the number | `src/enhance/figures.ts` | `  if (label.length < no.data.length) {` → `  if (true) {` | `test/enhance-figures.test.ts`: 2 failed \| 20 passed (22). "gives a caption that is its number alone an empty text span"; "destroy puts every caption back: the same nodes, with the same text, in the same order" |
| L2-T15-M6 | the white space after the number stays between the spans | `src/enhance/figures.ts` | `    if (gap.length > 0) {` → `    if (false) {` | `test/enhance-figures.test.ts`: 6 failed \| 16 passed (22). "splits "Figure N." into a chrome span.fig-no and the rest into a chrome span.cap-text, the space left between"; "keeps the markup of a caption inside its text"; "keeps white space before "Figure" where it was"; "reads a lettered number, as the reference's pattern does"; "wraps markup that follows the number's white space straight away"; and 1 more |
| L2-T15-M7 | white space that ends the text node is not split again | `src/enhance/figures.ts` | `      if (gap.length < after.data.length) journal.split(after, gap.length);` → `      journal.split(after, gap.length);` | `test/enhance-figures.test.ts`: 1 failed \| 21 passed (22). "wraps markup that follows the number's white space straight away" |
| L2-T15-M8 | a chrome space goes between when the caption has none | `src/enhance/figures.ts` | `    sep = doc.createTextNode(' ');` → `    sep = doc.createTextNode('');` | `test/enhance-figures.test.ts`: 2 failed \| 20 passed (22). "puts a space between the number and the text when the caption has none"; "gives a caption that is its number alone an empty text span" |
| L2-T15-M9 | a caption that is its number alone gets an empty span.cap-text | `src/enhance/figures.ts` | `  if (rest === null) journal.insert(text, cap, null);` → `  if (rest === null) return text;` | `test/enhance-figures.test.ts`: 1 failed \| 21 passed (22). "gives a caption that is its number alone an empty text span" |
| L2-T15-M10 | the caption is split through the journal | `src/enhance/figures.ts` | `    const after = journal.split(no, label.length);` → `    const after = no.splitText(label.length);` | `test/enhance-figures.test.ts`: 2 failed \| 20 passed (22). "destroy puts every caption back: the same nodes, with the same text, in the same order"; "destroy puts back a caption with white space before "Figure"" |
| L2-T15-M11 | the number is wrapped through the journal | `src/enhance/figures.ts` | `  journal.wrap([no], number);` → `  cap.insertBefore(number, no); ⏎   number.appendChild(no);` | `test/enhance-figures.test.ts`: 2 failed \| 20 passed (22). "destroy puts every caption back: the same nodes, with the same text, in the same order"; "destroy puts back a caption with white space before "Figure"" |
| L2-T15-M12 | a caption number longer than NO_MAX leaves the caption alone | `src/enhance/figures.ts` | `n.length <= NO_MAX` → `true` | `test/enhance-figures.test.ts`: 1 failed \| 21 passed (22). "leaves a caption alone when its number is longer than 32 characters" |
| L2-T15-M13 | a caption number of NO_MAX characters is read | `src/enhance/figures.ts` | `n.length <= NO_MAX` → `n.length < NO_MAX` | `test/enhance-figures.test.ts`: 1 failed \| 21 passed (22). "takes a number of 32 characters" |
| L2-T15-M14 | only a text node is read as the caption's start | `src/enhance/figures.ts` | `first.nodeType === 3` → `true` | `test/enhance-figures.test.ts`: 1 failed \| 21 passed (22). "reads only a text node: a comment that reads like a caption is left alone" |
| L2-T15-M15 | a figure with no number of its own takes its position, from 1 | `src/enhance/figures.ts` | `    let no = String(i + 1);` → `    let no = String(i);` | `test/enhance-figures.test.ts`: 6 failed \| 16 passed (22). "reads only a text node: a comment that reads like a caption is left alone"; "leaves a caption alone when its number has no dot after it"; "leaves a caption alone when its number is longer than 32 characters"; "one per figure, in document order: the caption's number, else the figure's position; the caption's text after the number"; "an index entry of kind figure, `figure-<no>`, titled by its caption, so byId reaches the figure"; and 1 more |
| L2-T15-M16 | an index entry only when nothing answers its id | `src/enhance/figures.ts` | `    if (ctx.nav.byId(id) === null) {` → `    if (true) {` | `test/enhance-figures.test.ts`: 1 failed \| 21 passed (22). "a document id wins: a heading "Figure 2" keeps `#figure-2`, and the figure gets no index entry" |
| L2-T15-M17 | the index title is clipped | `src/enhance/figures.ts` | `title: ctx.text.clip(caption, TITLE_MAX)` → `title: caption` | `test/enhance-figures.test.ts`: 1 failed \| 21 passed (22). "clips a long caption for the index title, and keeps it whole in the figure entry" |
| L2-T15-M18 | one figure entry per figure | `src/enhance/figures.ts` | `    ctx.figures.add({ no, caption, figure }); ⏎ ` → (deleted) | `test/enhance-figures.test.ts`: 11 failed \| 11 passed (22). "reads a lettered number, as the reference's pattern does"; "reads only a text node: a comment that reads like a caption is left alone"; "leaves a caption alone when its number has no dot after it"; "leaves a caption alone when its number is longer than 32 characters"; "takes a number of 32 characters" |
| L2-T15-M19 | the figure entry's caption is the text after the number | `src/enhance/figures.ts` | `    const caption = text === null ? '' : txt(text);` → `    const caption = cap === null ? '' : txt(cap);` | `test/enhance-figures.test.ts`: 5 failed \| 17 passed (22). "one per figure, in document order: the caption's number, else the figure's position; the caption's text after the number"; "an index entry of kind figure, `figure-<no>`, titled by its caption, so byId reaches the figure"; "clips a long caption for the index title, and keeps it whole in the figure entry"; "the first figure of a number keeps its id; a later one of the same number still has its figure entry"; "a long caption builds in bounded time" |
| L2-T15-M20 | the index id is figure-<no> | `src/enhance/figures.ts` | ``     const id = `figure-${no}`; `` → ``     const id = `fig-${no}`; `` | `test/enhance-figures.test.ts`: 5 failed \| 17 passed (22). "takes a number of 32 characters"; "an index entry of kind figure, `figure-<no>`, titled by its caption, so byId reaches the figure"; "clips a long caption for the index title, and keeps it whole in the figure entry"; "the first figure of a number keeps its id; a later one of the same number still has its figure entry"; "an index entry for a figure with no caption, and none of its own for a figure outside the root" |
| L2-T15-M21 | the number span's class (the Level 2 case) | `src/enhance/figures.ts` | `className: 'fig-no'` → `className: 'fig-num'` | `test/browser/layout-corpus.test.ts`: 1 failed \| 13 passed \| 9 skipped (23). "figures/captions" |
| L2-T15-M22 | the text span's class (the Level 2 case) | `src/enhance/figures.ts` | `className: 'cap-text'` → `className: 'caption-text'` | `test/browser/layout-corpus.test.ts`: 1 failed \| 13 passed \| 9 skipped (23). "figures/captions" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T15-M1",
    "guard": "a caption number ends in a dot",
    "file": "src/enhance/figures.ts",
    "old": "(Figure\\s+(\\d+[a-z]?)\\.)",
    "new": "(Figure\\s+(\\d+[a-z]?)\\.?)",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M2",
    "guard": "a caption number is ASCII digits, as the reference reads it",
    "file": "src/enhance/figures.ts",
    "old": "(Figure\\s+(\\d+[a-z]?)\\.)",
    "new": "(Figure\\s+([^.\\s]+)\\.)",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M3",
    "guard": "a caption number may end in a lower-case letter",
    "file": "src/enhance/figures.ts",
    "old": "(Figure\\s+(\\d+[a-z]?)\\.)",
    "new": "(Figure\\s+(\\d+)\\.)",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M4",
    "guard": "white space before \"Figure\" stays before the number",
    "file": "src/enhance/figures.ts",
    "old": "  const no = lead.length > 0 ? journal.split(first, lead.length) : first;",
    "new": "  const no = first;",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M5",
    "guard": "a caption that is its number alone is not split after the number",
    "file": "src/enhance/figures.ts",
    "old": "  if (label.length < no.data.length) {",
    "new": "  if (true) {",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M6",
    "guard": "the white space after the number stays between the spans",
    "file": "src/enhance/figures.ts",
    "old": "    if (gap.length > 0) {",
    "new": "    if (false) {",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M7",
    "guard": "white space that ends the text node is not split again",
    "file": "src/enhance/figures.ts",
    "old": "      if (gap.length < after.data.length) journal.split(after, gap.length);",
    "new": "      journal.split(after, gap.length);",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M8",
    "guard": "a chrome space goes between when the caption has none",
    "file": "src/enhance/figures.ts",
    "old": "    sep = doc.createTextNode(' ');",
    "new": "    sep = doc.createTextNode('');",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M9",
    "guard": "a caption that is its number alone gets an empty span.cap-text",
    "file": "src/enhance/figures.ts",
    "old": "  if (rest === null) journal.insert(text, cap, null);",
    "new": "  if (rest === null) return text;",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M10",
    "guard": "the caption is split through the journal",
    "file": "src/enhance/figures.ts",
    "old": "    const after = journal.split(no, label.length);",
    "new": "    const after = no.splitText(label.length);",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M11",
    "guard": "the number is wrapped through the journal",
    "file": "src/enhance/figures.ts",
    "old": "  journal.wrap([no], number);",
    "new": "  cap.insertBefore(number, no);\n  number.appendChild(no);",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M12",
    "guard": "a caption number longer than NO_MAX leaves the caption alone",
    "file": "src/enhance/figures.ts",
    "old": "n.length <= NO_MAX",
    "new": "true",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M13",
    "guard": "a caption number of NO_MAX characters is read",
    "file": "src/enhance/figures.ts",
    "old": "n.length <= NO_MAX",
    "new": "n.length < NO_MAX",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M14",
    "guard": "only a text node is read as the caption's start",
    "file": "src/enhance/figures.ts",
    "old": "first.nodeType === 3",
    "new": "true",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M15",
    "guard": "a figure with no number of its own takes its position, from 1",
    "file": "src/enhance/figures.ts",
    "old": "    let no = String(i + 1);",
    "new": "    let no = String(i);",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M16",
    "guard": "an index entry only when nothing answers its id",
    "file": "src/enhance/figures.ts",
    "old": "    if (ctx.nav.byId(id) === null) {",
    "new": "    if (true) {",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M17",
    "guard": "the index title is clipped",
    "file": "src/enhance/figures.ts",
    "old": "title: ctx.text.clip(caption, TITLE_MAX)",
    "new": "title: caption",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M18",
    "guard": "one figure entry per figure",
    "file": "src/enhance/figures.ts",
    "old": "    ctx.figures.add({ no, caption, figure });\n",
    "new": "",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M19",
    "guard": "the figure entry's caption is the text after the number",
    "file": "src/enhance/figures.ts",
    "old": "    const caption = text === null ? '' : txt(text);",
    "new": "    const caption = cap === null ? '' : txt(cap);",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M20",
    "guard": "the index id is figure-<no>",
    "file": "src/enhance/figures.ts",
    "old": "    const id = `figure-${no}`;",
    "new": "    const id = `fig-${no}`;",
    "tests": "test/enhance-figures.test.ts"
  },
  {
    "id": "L2-T15-M21",
    "guard": "the number span's class (the Level 2 case)",
    "file": "src/enhance/figures.ts",
    "old": "className: 'fig-no'",
    "new": "className: 'fig-num'",
    "tests": "test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T15-M22",
    "guard": "the text span's class (the Level 2 case)",
    "file": "src/enhance/figures.ts",
    "old": "className: 'cap-text'",
    "new": "className: 'caption-text'",
    "tests": "test/browser/layout-corpus.test.ts"
  }
]
```

## The Mermaid file and its notices: `scripts/build-mermaid.mjs`, THIRD-PARTY-NOTICES, `.gitignore`, `package.json` (L2-T15-M23 to L2-T15-M47)

One ESM file, the elkjs stand-in, the build options the file depends on, the licence files and packages the notices list, and the pins and scripts.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T15-M23 | elkjs resolves to the stand-in | `scripts/build-mermaid.mjs` | `    plugins: [elkStub(root)],` → `    plugins: [],` | `test/mermaid-bundle.test.ts`: 4 failed \| 13 passed (17). "bundles no elkjs: no input from it, the stub in its place, and no ELK code in the file"; "stays within 4 MiB (about 3.75 MB measured for Mermaid 12.1.0 without elkjs)"; "names every package the file bundles, and only those, exactly as the metafile gives them"; "gives each package its licence and the text of each of its LICENSE files" |
| L2-T15-M24 | every path inside elkjs resolves to the stand-in | `scripts/build-mermaid.mjs` | `{ filter: /^elkjs(?:\/\|$)/ }` → `{ filter: /^elkjs$/ }` | `test/mermaid-bundle.test.ts`: 4 failed \| 13 passed (17). "bundles no elkjs: no input from it, the stub in its place, and no ELK code in the file"; "stays within 4 MiB (about 3.75 MB measured for Mermaid 12.1.0 without elkjs)"; "names every package the file bundles, and only those, exactly as the metafile gives them"; "gives each package its licence and the text of each of its LICENSE files" |
| L2-T15-M25 | no code splitting: one file | `scripts/build-mermaid.mjs` | `    splitting: false,` → `    splitting: true,` | `test/mermaid-bundle.test.ts`: 17 skipped (17). The file failed in its hook: esbuild refused the build (splitting needs an outdir), so no case ran |
| L2-T15-M26 | an ESM file | `scripts/build-mermaid.mjs` | `    format: 'esm',` → `    format: 'cjs',` | `test/mermaid-bundle.test.ts`: 1 failed \| 16 passed (17). "is one ESM file, its only export the default, with no import() and no import left" |
| L2-T15-M27 | the entry exports the default alone | `scripts/build-mermaid.mjs` | `const ENTRY = "export { default } from 'mermaid';\n";` → `const ENTRY = "export { default } from 'mermaid';\nexport const extra = 1;\n";` | `test/mermaid-bundle.test.ts`: 1 failed \| 16 passed (17). "is one ESM file, its only export the default, with no import() and no import left" |
| L2-T15-M28 | symlinks kept as written: every input inside the package | `scripts/build-mermaid.mjs` | `    preserveSymlinks: true, ⏎ ` → (deleted) | `test/mermaid-bundle.test.ts`: 1 failed \| 16 passed (17). "reads every input from inside the package: node_modules, the stub, or the entry" |
| L2-T15-M29 | minified: within the size bound | `scripts/build-mermaid.mjs` | `    minify: true,` → `    minify: false,` | `test/mermaid-bundle.test.ts`: 1 failed \| 16 passed (17). "stays within 4 MiB (about 3.75 MB measured for Mermaid 12.1.0 without elkjs)" |
| L2-T15-M30 | upstream legal comments kept, at the end | `scripts/build-mermaid.mjs` | `    legalComments: 'eof',` → `    legalComments: 'none',` | `test/mermaid-bundle.test.ts`: 1 failed \| 16 passed (17). "keeps the upstream legal comments, gathered at its end" |
| L2-T15-M31 | the size bound is 4 MiB | `scripts/build-mermaid.mjs` | `export const MAX_BYTES = 4 * 1024 * 1024;` → `export const MAX_BYTES = 64 * 1024 * 1024;` | `test/mermaid-bundle.test.ts`: 1 failed \| 16 passed (17). "stays within 4 MiB (about 3.75 MB measured for Mermaid 12.1.0 without elkjs)" |
| L2-T15-M32 | the ELK signature is elkjs's own | `scripts/build-mermaid.mjs` | `export const ELK_SIGNATURE = 'org.eclipse.elk';` → `export const ELK_SIGNATURE = 'org.eclipse.elk.absent';` | `test/mermaid-bundle.test.ts`: 1 failed \| 16 passed (17). "the ELK signature is elkjs's own: the package's bundled file holds it" |
| L2-T15-M33 | a licence file is LICENSE and the like, never a script | `scripts/build-mermaid.mjs` | `const LICENCE_FILE = /^(?:licen[cs]e\|copying)(?:-[a-z0-9]+)?(?:\.(?:md\|txt\|markdown))?$/i;` → `const LICENCE_FILE = /^(?:licen[cs]e\|copying)/i;` | `test/mermaid-bundle.test.ts`: 3 failed \| 14 passed (17). "names every package the file bundles, and only those, exactly as the metafile gives them"; "gives each package its licence and the text of each of its LICENSE files"; "reads a package's licence files only: LICENSE, LICENSE.md, license.txt, LICENSE-MPL, COPYING; never a script" |
| L2-T15-M34 | a licence file may carry a -word suffix (LICENSE-MPL) | `scripts/build-mermaid.mjs` | `const LICENCE_FILE = /^(?:licen[cs]e\|copying)(?:-[a-z0-9]+)?(?:\.(?:md\|txt\|markdown))?$/i;` → `const LICENCE_FILE = /^(?:licen[cs]e\|copying)(?:\.(?:md\|txt\|markdown))?$/i;` | `test/mermaid-bundle.test.ts`: 2 failed \| 15 passed (17). "names every package the file bundles, and only those, exactly as the metafile gives them"; "reads a package's licence files only: LICENSE, LICENSE.md, license.txt, LICENSE-MPL, COPYING; never a script" |
| L2-T15-M35 | a package with no licence file stops the notices | `scripts/build-mermaid.mjs` | ``   if (names.length === 0) throw new Error(`build-mermaid: ${label}: no LICENSE file`); ⏎  `` → (deleted) | `test/mermaid-bundle.test.ts`: 1 failed \| 16 passed (17). "a package with no LICENSE file stops the build, naming it" |
| L2-T15-M36 | a nested package is its own directory (the last node_modules in the path) | `scripts/build-mermaid.mjs` | `const PACKAGE_DIR = /^((?:.*\/)?node_modules\/(?:@[^/]+\/)?[^/]+)\//;` → `const PACKAGE_DIR = /^(node_modules\/(?:@[^/]+\/)?[^/]+)\//;` | `test/mermaid-bundle.test.ts`: 1 failed \| 16 passed (17). "names every package the file bundles, and only those, exactly as the metafile gives them" |
| L2-T15-M37 | a scoped package is its own directory | `scripts/build-mermaid.mjs` | `const PACKAGE_DIR = /^((?:.*\/)?node_modules\/(?:@[^/]+\/)?[^/]+)\//;` → `const PACKAGE_DIR = /^((?:.*\/)?node_modules\/[^/]+)\//;` | `test/mermaid-bundle.test.ts`: 3 failed \| 14 passed (17). "names every package the file bundles, and only those, exactly as the metafile gives them"; "gives each package its licence and the text of each of its LICENSE files"; "a package.json with no licence string is listed as such, its licence file following" |
| L2-T15-M38 | a package.json with no licence string is named as such | `scripts/build-mermaid.mjs` | `  return typeof pkg.license === 'string' ? pkg.license : NO_LICENCE_FIELD;` → `  return String(pkg.license);` | `test/mermaid-bundle.test.ts`: 3 failed \| 14 passed (17). "names every package the file bundles, and only those, exactly as the metafile gives them"; "gives each package its licence and the text of each of its LICENSE files"; "a package.json with no licence string is listed as such, its licence file following" |
| L2-T15-M39 | packages are sorted by name | `scripts/build-mermaid.mjs` | `order(a.name, b.name) \|\| order(a.version, b.version)` → `order(b.name, a.name) \|\| order(a.version, b.version)` | `test/mermaid-bundle.test.ts`: 1 failed \| 16 passed (17). "names every package the file bundles, and only those, exactly as the metafile gives them" |
| L2-T15-M40 | packages of one name are sorted by version | `scripts/build-mermaid.mjs` | `order(a.name, b.name) \|\| order(a.version, b.version)` → `order(a.name, b.name) \|\| order(b.version, a.version)` | `test/mermaid-bundle.test.ts`: 1 failed \| 16 passed (17). "names every package the file bundles, and only those, exactly as the metafile gives them" |
| L2-T15-M41 | licence texts lose trailing white space | `scripts/build-mermaid.mjs` | `    .map((l) => l.replace(/[ \t]+$/, '')) ⏎ ` → (deleted) | `test/mermaid-bundle.test.ts`: 2 failed \| 15 passed (17). "names every package the file bundles, and only those, exactly as the metafile gives them"; "gives each package its licence and the text of each of its LICENSE files" |
| L2-T15-M42 | the section needs its end marker | `scripts/build-mermaid.mjs` | `  if (begin < 0 \|\| end < 0) return null;` → `  if (begin < 0) return null;` | `test/mermaid-bundle.test.ts`: 1 failed \| 16 passed (17). "the section is replaced in place, or appended after a heading when the file has none" |
| L2-T15-M43 | the section is written as it is, with no replacement patterns | `scripts/build-mermaid.mjs` | `  if (held !== null) return text.replace(held, () => section);` → `  if (held !== null) return text.replace(held, section);` | `test/mermaid-bundle.test.ts`: 1 failed \| 16 passed (17). "the section is replaced in place, or appended after a heading when the file has none" |
| L2-T15-M44 | a missing notice (one package's entry deleted from THIRD-PARTY-NOTICES) | `THIRD-PARTY-NOTICES` | ` ⏎ ================================================================================ ⏎ ts-dedent 2.3.…` → (deleted) | `test/mermaid-bundle.test.ts`: 2 failed \| 15 passed (17). "names every package the file bundles, and only those, exactly as the metafile gives them"; "gives each package its licence and the text of each of its LICENSE files" |
| L2-T15-M45 | .gitignore keeps the built file out of git | `.gitignore` | `assets/mermaid/ ⏎ ` → (deleted) | `test/mermaid-bundle.test.ts`: 1 failed \| 16 passed (17). "is kept out of git: .gitignore names its directory" |
| L2-T15-M46 | build runs build:mermaid | `package.json` | `"build": "tsc -p tsconfig.build.json && npm run build:mermaid",` → `"build": "tsc -p tsconfig.build.json",` | `test/mermaid-bundle.test.ts`: 1 failed \| 16 passed (17). "builds the Mermaid file as part of the build" |
| L2-T15-M47 | mermaid is pinned exactly | `package.json` | `"mermaid": "12.1.0",` → `"mermaid": "^12.1.0",` | `test/mermaid-bundle.test.ts`: 1 failed \| 16 passed (17). "pins mermaid exactly at 12.1.0 as a dev dependency: the package ships the file built from it, and no runtime dependency" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T15-M23",
    "guard": "elkjs resolves to the stand-in",
    "file": "scripts/build-mermaid.mjs",
    "old": "    plugins: [elkStub(root)],",
    "new": "    plugins: [],",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M24",
    "guard": "every path inside elkjs resolves to the stand-in",
    "file": "scripts/build-mermaid.mjs",
    "old": "{ filter: /^elkjs(?:\\/|$)/ }",
    "new": "{ filter: /^elkjs$/ }",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M25",
    "guard": "no code splitting: one file",
    "file": "scripts/build-mermaid.mjs",
    "old": "    splitting: false,",
    "new": "    splitting: true,",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M26",
    "guard": "an ESM file",
    "file": "scripts/build-mermaid.mjs",
    "old": "    format: 'esm',",
    "new": "    format: 'cjs',",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M27",
    "guard": "the entry exports the default alone",
    "file": "scripts/build-mermaid.mjs",
    "old": "const ENTRY = \"export { default } from 'mermaid';\\n\";",
    "new": "const ENTRY = \"export { default } from 'mermaid';\\nexport const extra = 1;\\n\";",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M28",
    "guard": "symlinks kept as written: every input inside the package",
    "file": "scripts/build-mermaid.mjs",
    "old": "    preserveSymlinks: true,\n",
    "new": "",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M29",
    "guard": "minified: within the size bound",
    "file": "scripts/build-mermaid.mjs",
    "old": "    minify: true,",
    "new": "    minify: false,",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M30",
    "guard": "upstream legal comments kept, at the end",
    "file": "scripts/build-mermaid.mjs",
    "old": "    legalComments: 'eof',",
    "new": "    legalComments: 'none',",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M31",
    "guard": "the size bound is 4 MiB",
    "file": "scripts/build-mermaid.mjs",
    "old": "export const MAX_BYTES = 4 * 1024 * 1024;",
    "new": "export const MAX_BYTES = 64 * 1024 * 1024;",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M32",
    "guard": "the ELK signature is elkjs's own",
    "file": "scripts/build-mermaid.mjs",
    "old": "export const ELK_SIGNATURE = 'org.eclipse.elk';",
    "new": "export const ELK_SIGNATURE = 'org.eclipse.elk.absent';",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M33",
    "guard": "a licence file is LICENSE and the like, never a script",
    "file": "scripts/build-mermaid.mjs",
    "old": "const LICENCE_FILE = /^(?:licen[cs]e|copying)(?:-[a-z0-9]+)?(?:\\.(?:md|txt|markdown))?$/i;",
    "new": "const LICENCE_FILE = /^(?:licen[cs]e|copying)/i;",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M34",
    "guard": "a licence file may carry a -word suffix (LICENSE-MPL)",
    "file": "scripts/build-mermaid.mjs",
    "old": "const LICENCE_FILE = /^(?:licen[cs]e|copying)(?:-[a-z0-9]+)?(?:\\.(?:md|txt|markdown))?$/i;",
    "new": "const LICENCE_FILE = /^(?:licen[cs]e|copying)(?:\\.(?:md|txt|markdown))?$/i;",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M35",
    "guard": "a package with no licence file stops the notices",
    "file": "scripts/build-mermaid.mjs",
    "old": "  if (names.length === 0) throw new Error(`build-mermaid: ${label}: no LICENSE file`);\n",
    "new": "",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M36",
    "guard": "a nested package is its own directory (the last node_modules in the path)",
    "file": "scripts/build-mermaid.mjs",
    "old": "const PACKAGE_DIR = /^((?:.*\\/)?node_modules\\/(?:@[^/]+\\/)?[^/]+)\\//;",
    "new": "const PACKAGE_DIR = /^(node_modules\\/(?:@[^/]+\\/)?[^/]+)\\//;",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M37",
    "guard": "a scoped package is its own directory",
    "file": "scripts/build-mermaid.mjs",
    "old": "const PACKAGE_DIR = /^((?:.*\\/)?node_modules\\/(?:@[^/]+\\/)?[^/]+)\\//;",
    "new": "const PACKAGE_DIR = /^((?:.*\\/)?node_modules\\/[^/]+)\\//;",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M38",
    "guard": "a package.json with no licence string is named as such",
    "file": "scripts/build-mermaid.mjs",
    "old": "  return typeof pkg.license === 'string' ? pkg.license : NO_LICENCE_FIELD;",
    "new": "  return String(pkg.license);",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M39",
    "guard": "packages are sorted by name",
    "file": "scripts/build-mermaid.mjs",
    "old": "order(a.name, b.name) || order(a.version, b.version)",
    "new": "order(b.name, a.name) || order(a.version, b.version)",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M40",
    "guard": "packages of one name are sorted by version",
    "file": "scripts/build-mermaid.mjs",
    "old": "order(a.name, b.name) || order(a.version, b.version)",
    "new": "order(a.name, b.name) || order(b.version, a.version)",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M41",
    "guard": "licence texts lose trailing white space",
    "file": "scripts/build-mermaid.mjs",
    "old": "    .map((l) => l.replace(/[ \\t]+$/, ''))\n",
    "new": "",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M42",
    "guard": "the section needs its end marker",
    "file": "scripts/build-mermaid.mjs",
    "old": "  if (begin < 0 || end < 0) return null;",
    "new": "  if (begin < 0) return null;",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M43",
    "guard": "the section is written as it is, with no replacement patterns",
    "file": "scripts/build-mermaid.mjs",
    "old": "  if (held !== null) return text.replace(held, () => section);",
    "new": "  if (held !== null) return text.replace(held, section);",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M44",
    "guard": "a missing notice (one package's entry deleted from THIRD-PARTY-NOTICES)",
    "file": "THIRD-PARTY-NOTICES",
    "old": "\n================================================================================\nts-dedent 2.3.0 (MIT)\n--------------------------------------------------------------------------------\nLICENSE:\n\nMIT License\n\nCopyright (c) 2018 Tamino Martinius\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n",
    "new": "",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M45",
    "guard": ".gitignore keeps the built file out of git",
    "file": ".gitignore",
    "old": "assets/mermaid/\n",
    "new": "",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M46",
    "guard": "build runs build:mermaid",
    "file": "package.json",
    "old": "\"build\": \"tsc -p tsconfig.build.json && npm run build:mermaid\",",
    "new": "\"build\": \"tsc -p tsconfig.build.json\",",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-M47",
    "guard": "mermaid is pinned exactly",
    "file": "package.json",
    "old": "\"mermaid\": \"12.1.0\",",
    "new": "\"mermaid\": \"^12.1.0\",",
    "tests": "test/mermaid-bundle.test.ts"
  }
]
```

## The Mermaid file in a real browser: `test/browser/mermaid-file.test.ts` (L2-T15-M48 to L2-T15-M50)

The CSP page, and two rows on the built file (the stand-in, its message). Measured with `DOCREADER_BROWSERS=chromium` (C45): WebKit was reported as excluded.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T15-M48 | the CSP page: the test page is served under the policy | `test/browser/mermaid-file.test.ts` | `        if (url.pathname === '/') headers['content-security-policy'] = POLICIES[policy]; ⏎ ` → (deleted) | `test/browser/mermaid-file.test.ts`: 2 failed \| 1 passed \| 3 skipped (6). "loads under the reader policy and draws a flowchart: one file, nothing else fetched, no violation but the probe's"; "under the strict policy the drawing's injected styles are refused: diagrams need the reader policy" |
| L2-T15-M49 | the built file: elkjs left out (the default layout fails to draw) | `scripts/build-mermaid.mjs` | `    plugins: [elkStub(root)],` → `    plugins: [],` | `test/browser/mermaid-file.test.ts`: 1 failed \| 2 passed \| 3 skipped (6). "with Mermaid's default layout, ELK, the drawing fails with the stand-in's message: elkjs is not in the file" |
| L2-T15-M50 | the built file: the stand-in refuses with its message | `scripts/mermaid-elk-stub.mjs` | `    return Promise.reject(new Error(ELK_LEFT_OUT));` → `    return Promise.reject(new Error('refused'));` | `test/browser/mermaid-file.test.ts`: 1 failed \| 2 passed \| 3 skipped (6). "with Mermaid's default layout, ELK, the drawing fails with the stand-in's message: elkjs is not in the file" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T15-M48",
    "guard": "the CSP page: the test page is served under the policy",
    "file": "test/browser/mermaid-file.test.ts",
    "old": "        if (url.pathname === '/') headers['content-security-policy'] = POLICIES[policy];\n",
    "new": "",
    "tests": "test/browser/mermaid-file.test.ts"
  },
  {
    "id": "L2-T15-M49",
    "guard": "the built file: elkjs left out (the default layout fails to draw)",
    "file": "scripts/build-mermaid.mjs",
    "old": "    plugins: [elkStub(root)],",
    "new": "    plugins: [],",
    "tests": "test/browser/mermaid-file.test.ts"
  },
  {
    "id": "L2-T15-M50",
    "guard": "the built file: the stand-in refuses with its message",
    "file": "scripts/mermaid-elk-stub.mjs",
    "old": "    return Promise.reject(new Error(ELK_LEFT_OUT));",
    "new": "    return Promise.reject(new Error('refused'));",
    "tests": "test/browser/mermaid-file.test.ts"
  }
]
```

## The packed package and the consumer smoke: `test/pack.test.ts`, `scripts/consumer-smoke.mjs` (L2-T15-M51 to L2-T15-M53)

The clean copy builds the file, the tarball may hold it, and the smoke imports it.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T15-M51 | the packed package is built with the Mermaid file | `test/pack.test.ts` | `  const mermaid = spawnSync(process.execPath, [path.join('scripts', 'build-mermaid.mjs')], { cwd: st…` → (deleted) | `test/pack.test.ts`: 3 failed \| 7 passed (10). "holds the three entries with their types, the corpus files, the licence, the readme, the assets and their notices"; "passes the whole corpus through the consumer smoke"; "fails, naming the case, when the packed corpus does not pass" |
| L2-T15-M52 | the Mermaid file is allowed in the tarball | `test/pack.test.ts` | `  /^assets\/mermaid\/mermaid\.mjs$/, ⏎ ` → (deleted) | `test/pack.test.ts`: 1 failed \| 9 passed (10). "holds nothing else: no references, scripts, sources, tests, CI files or working papers" |
| L2-T15-M53 | the consumer smoke imports the Mermaid file and checks its one export | `scripts/consumer-smoke.mjs` | `  if (names === 'default' && ['initialize', 'run', 'render'].every((f) => typeof api?.[f] === 'funct…` → `  if (false) {` | `test/pack.test.ts`: 2 failed \| 8 passed (10). "passes the whole corpus through the consumer smoke"; "fails, naming the case, when the packed corpus does not pass" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T15-M51",
    "guard": "the packed package is built with the Mermaid file",
    "file": "test/pack.test.ts",
    "old": "  const mermaid = spawnSync(process.execPath, [path.join('scripts', 'build-mermaid.mjs')], { cwd: stage, encoding: 'utf8' });\n  if (mermaid.status !== 0) throw new Error(`the Mermaid build failed: ${mermaid.stdout}${mermaid.stderr}`);\n",
    "new": "",
    "tests": "test/pack.test.ts"
  },
  {
    "id": "L2-T15-M52",
    "guard": "the Mermaid file is allowed in the tarball",
    "file": "test/pack.test.ts",
    "old": "  /^assets\\/mermaid\\/mermaid\\.mjs$/,\n",
    "new": "",
    "tests": "test/pack.test.ts"
  },
  {
    "id": "L2-T15-M53",
    "guard": "the consumer smoke imports the Mermaid file and checks its one export",
    "file": "scripts/consumer-smoke.mjs",
    "old": "  if (names === 'default' && ['initialize', 'run', 'render'].every((f) => typeof api?.[f] === 'function')) {",
    "new": "  if (false) {",
    "tests": "test/pack.test.ts"
  }
]
```
## Control runs (L2-T15-C1 to L2-T15-C4)

Each command the rows above use, run once in an unmutated copy the same way: green (`rc=0`).

| Row | Command | Result |
|---|---|---|
| L2-T15-C1 | `vitest run test/mermaid-bundle.test.ts` | 17 passed (17) |
| L2-T15-C2 | `vitest run test/browser/mermaid-file.test.ts` | 3 passed \| 3 skipped (6): WebKit excluded |
| L2-T15-C3 | `vitest run test/enhance-figures.test.ts test/browser/layout-corpus.test.ts` | 36 passed \| 9 skipped (45): WebKit excluded |
| L2-T15-C4 | `vitest run test/pack.test.ts` | 10 passed (10) |

### The controls, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T15-C1",
    "guard": "control: the bundle test, unmutated",
    "file": "scripts/build-mermaid.mjs",
    "old": "export const OUT_FILE = 'assets/mermaid/mermaid.mjs';",
    "new": "export const OUT_FILE = 'assets/mermaid/mermaid.mjs';",
    "tests": "test/mermaid-bundle.test.ts"
  },
  {
    "id": "L2-T15-C2",
    "guard": "control: the browser test, unmutated",
    "file": "scripts/build-mermaid.mjs",
    "old": "export const OUT_FILE = 'assets/mermaid/mermaid.mjs';",
    "new": "export const OUT_FILE = 'assets/mermaid/mermaid.mjs';",
    "tests": "test/browser/mermaid-file.test.ts"
  },
  {
    "id": "L2-T15-C3",
    "guard": "control: the figures and Level 2 tests, unmutated",
    "file": "src/enhance/figures.ts",
    "old": "const NO_MAX = 32;",
    "new": "const NO_MAX = 32;",
    "tests": "test/enhance-figures.test.ts test/browser/layout-corpus.test.ts"
  },
  {
    "id": "L2-T15-C4",
    "guard": "control: the pack test, unmutated",
    "file": "test/pack.test.ts",
    "old": "/^assets\\/mermaid\\/mermaid\\.mjs$/,",
    "new": "/^assets\\/mermaid\\/mermaid\\.mjs$/,",
    "tests": "test/pack.test.ts"
  }
]
```
