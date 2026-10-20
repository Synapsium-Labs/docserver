# L2 Task 1: mutation rows (items carried from L1)

The guard Task 1 changes, the key under which the front-matter loader hides its merge refusal (ruling C39), restored
or shortened once, with the tests that go red. Measured 2026-10-20 on branch `l2-t1-carried`, against the working tree
that the Task 1 commit records.

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8), with the two changes that plan's "L1 results" section records
(a `maxBuffer` of 512 MiB, and a run with no exit status reported as KILLED, never as red): each row is applied to its
own throwaway copy of the working tree (tracked and untracked files, never ignored ones, `node_modules` linked from the
checkout), its test file runs there with the local `vitest`, and the copy is deleted. Each `old` occurs exactly once in
its file. The checkout was never edited: `git status --porcelain` read the same before and after. Both rows went red
(`rc=1`), and the run exited 0.

The same run re-measured L1's six rows for ruling C39 and the R7 collision (`L1-R464-C39-M1` to `M5` and
`L1-R464-R7-M1`, defined in the L1 plan's results section) against this code: all six are still red.

Items 2 and 3 of Task 1 add no guard. Item 2 pins the reference's `frontList` beside C38's departure (test only), and
item 3 corrects a comment's wording, so neither has a row.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T1-M1 | the merge refusal's key is one no block can spell (C39's three routes) | `src/render/frontMatter.ts` | `const MERGE_REFUSAL = '\u0000'.repeat(2 * FM_MAX_CHARS);` → `const MERGE_REFUSAL = '\u0000merge source is a sequence';` (the key before this task) | `test/frontmatter.test.ts`: 3 failed \| 92 passed (95). "route 1: a key spelt with a YAML escape before the `<<` (\0, \u0000, \x00)"; "route 2: a key brought in by an earlier source of the same merge list"; "route 3: a key brought in by a separate earlier `<<` pair, inline or through an alias" |
| L2-T1-M2 | the merge refusal's key is longer than any NUL key a block under the cap can spell | `src/render/frontMatter.ts` | `const MERGE_REFUSAL = '\u0000'.repeat(2 * FM_MAX_CHARS);` → `const MERGE_REFUSAL = '\u0000'.repeat(9992);` (the longest NUL key the boundary case spells) | `test/frontmatter.test.ts`: 1 failed \| 94 passed (95). "a NUL key as long as a block under the cap can make it, before the `<<`, is still refused" |

## The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T1-M1",
    "guard": "the merge refusal's key is one no block can spell (C39's three routes)",
    "file": "src/render/frontMatter.ts",
    "old": "const MERGE_REFUSAL = '\\u0000'.repeat(2 * FM_MAX_CHARS);",
    "new": "const MERGE_REFUSAL = '\\u0000merge source is a sequence';",
    "tests": "test/frontmatter.test.ts"
  },
  {
    "id": "L2-T1-M2",
    "guard": "the merge refusal's key is longer than any NUL key a block under the cap can spell",
    "file": "src/render/frontMatter.ts",
    "old": "const MERGE_REFUSAL = '\\u0000'.repeat(2 * FM_MAX_CHARS);",
    "new": "const MERGE_REFUSAL = '\\u0000'.repeat(9992);",
    "tests": "test/frontmatter.test.ts"
  }
]
```
