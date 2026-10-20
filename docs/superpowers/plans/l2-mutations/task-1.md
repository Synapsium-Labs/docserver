# L2 Task 1: mutation rows (items carried from L1)

The guards Task 1 adds around the key under which the front-matter loader hides its merge refusal (ruling C39): the
key restored, shortened or rebuilt once, with the tests that go red. Measured 2026-10-20 on branch `l2-t1-carried`,
against the working tree that the fix round's commit records (the rows of the first Task 1 commit, re-measured and
extended by the review's fix round, below).

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8), with the two changes that plan's "L1 results" section records
(a `maxBuffer` of 512 MiB, and a run with no exit status reported as KILLED, never as red): each row is applied to its
own throwaway copy of the working tree (tracked and untracked files, never ignored ones, `node_modules` linked from the
checkout), its test file runs there with the local `vitest`, and the copy is deleted. Each `old` occurs exactly once in
its file. The checkout was never edited: `git status --porcelain` read the same before and after. All four rows went
red (`rc=1`), and the run exited 0.

The same tree re-measured L1's six rows for ruling C39 and the R7 collision (`L1-R464-C39-M1` to `M5` and
`L1-R464-R7-M1`, defined in the L1 plan's results section): all six are still red.

Items 2 and 3 of Task 1 add no guard. Item 2 pins the reference's `frontList` beside C38's departure (test only), and
item 3 corrects a comment's wording, so neither has a row.

**Fix round.** The review found two gaps in the first commit's guards, and both are closed here.

- The boundary case spelled a key of 9992 NULs with the value ` 1`. With a null value the shortest block is `"` + n
  escapes + `":⏎<<: [[]]`, and the content may be 19999 code points long (the cap is strict), so a block spells 9993.
  The case now builds that block, and one more escape would reach the cap. A key of exactly 9993 NULs passed the old
  case. M2 now shortens the key to 9993; measured with only the block-level part of the case kept (the two lines that
  read the key removed, on a scratch copy), the block is loaded and the case is red there too.
- A block spells one NUL key per length, so a block-level case only catches a key of exactly that length: a key of
  5000 NULs passed every case. `MERGE_REFUSAL` is now exported, and the boundary case also reads it: all NULs, and
  longer than the 9993 a block can spell. M3 is that mutation.
- The timing case bounded one render at 1000 ms against a median of about 7 ms, so a tenfold rise passed it. It now
  compares the median of 11 renders of a block of 6000 sequences with the same block of 6000 mappings, timed in turn,
  and requires the sequences' median under 3 times the mappings'. Measured on Node 24 with a probe of the same shape
  (three runs each): with the key before this task (`'\u0000merge source is a sequence'`) the ratio was 0.75, 0.59 and
  0.60; with the long key 0.75, 0.61 and 0.80; with a key built afresh for each sequence 7.48, 7.50 and 7.85. M4 is
  that last mutation, applied to the definition only (the removal after the load uses the same value, so nothing else
  changes). The 1000 ms bound stays as a loose ceiling.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T1-M1 | the merge refusal's key is one no block can spell (C39's three routes) | `src/render/frontMatter.ts` | `export const MERGE_REFUSAL = '\u0000'.repeat(2 * FM_MAX_CHARS);` → `export const MERGE_REFUSAL = '\u0000merge source is a sequence';` (the key before this task) | `test/frontmatter.test.ts`: 4 failed \| 91 passed (95). "route 1: a key spelt with a YAML escape before the `<<` (\0, \u0000, \x00)"; "route 2: a key brought in by an earlier source of the same merge list"; "route 3: a key brought in by a separate earlier `<<` pair, inline or through an alias"; "a NUL key as long as a block under the cap can make it, before the `<<`, is still refused" |
| L2-T1-M2 | the merge refusal's key is longer than the longest NUL key a block under the cap can spell (9993 NULs) | `src/render/frontMatter.ts` | `export const MERGE_REFUSAL = '\u0000'.repeat(2 * FM_MAX_CHARS);` → `export const MERGE_REFUSAL = '\u0000'.repeat(9993);` | `test/frontmatter.test.ts`: 1 failed \| 94 passed (95). "a NUL key as long as a block under the cap can make it, before the `<<`, is still refused" (expected 9993 to be greater than 9993; with the key-reading lines removed, the block-level assertion reds instead) |
| L2-T1-M3 | the merge refusal's key is all NULs and longer than any a block can spell, whatever its length below that | `src/render/frontMatter.ts` | `export const MERGE_REFUSAL = '\u0000'.repeat(2 * FM_MAX_CHARS);` → `export const MERGE_REFUSAL = '\u0000'.repeat(5000);` | `test/frontmatter.test.ts`: 1 failed \| 94 passed (95). "a NUL key as long as a block under the cap can make it, before the `<<`, is still refused" (expected 5000 to be greater than 9993) |
| L2-T1-M4 | the long key is built once, so a sequence costs no more than a mapping | `src/render/frontMatter.ts` | `Object.defineProperty(a, MERGE_REFUSAL, {` → `Object.defineProperty(a, '\u0000'.repeat(2 * FM_MAX_CHARS + (a.length & 0)), {` | `test/frontmatter.test.ts`: 1 failed \| 94 passed (95). "a block of 6000 sequences costs no more than the same block of mappings: the long key is built once" (a median of 54.0 ms against a bound of 28.2 ms) |

## The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T1-M1",
    "guard": "the merge refusal's key is one no block can spell (C39's three routes)",
    "file": "src/render/frontMatter.ts",
    "old": "export const MERGE_REFUSAL = '\\u0000'.repeat(2 * FM_MAX_CHARS);",
    "new": "export const MERGE_REFUSAL = '\\u0000merge source is a sequence';",
    "tests": "test/frontmatter.test.ts"
  },
  {
    "id": "L2-T1-M2",
    "guard": "the merge refusal's key is longer than the longest NUL key a block under the cap can spell (9993 NULs)",
    "file": "src/render/frontMatter.ts",
    "old": "export const MERGE_REFUSAL = '\\u0000'.repeat(2 * FM_MAX_CHARS);",
    "new": "export const MERGE_REFUSAL = '\\u0000'.repeat(9993);",
    "tests": "test/frontmatter.test.ts"
  },
  {
    "id": "L2-T1-M3",
    "guard": "the merge refusal's key is all NULs and longer than any a block can spell, whatever its length below that",
    "file": "src/render/frontMatter.ts",
    "old": "export const MERGE_REFUSAL = '\\u0000'.repeat(2 * FM_MAX_CHARS);",
    "new": "export const MERGE_REFUSAL = '\\u0000'.repeat(5000);",
    "tests": "test/frontmatter.test.ts"
  },
  {
    "id": "L2-T1-M4",
    "guard": "the long key is built once, so a sequence costs no more than a mapping",
    "file": "src/render/frontMatter.ts",
    "old": "Object.defineProperty(a, MERGE_REFUSAL, {",
    "new": "Object.defineProperty(a, '\\u0000'.repeat(2 * FM_MAX_CHARS + (a.length & 0)), {",
    "tests": "test/frontmatter.test.ts"
  }
]
```
