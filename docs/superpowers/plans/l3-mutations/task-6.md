# L3 Task 6: mutation rows (the frame build, manifests, `--check`, prepack, budgets)

Each guard of Task 6, changed once, with the tests that go red: the byte and HTML-like comment rules the build runs (`src/frame/bytes.ts`, `scripts/comment-tokens.mjs`), the build's reproducibility and its CI steps, the two manifests and npm's prepack (`scripts/verify-assets.mjs`), the free-global scan and list (`scripts/free-globals.mjs`, `scripts/build-frame.mjs`), the size budgets and the OFL notice. Measured 2026-10-27 (UTC) on branch `l3-t06-frame-build` (base `9f14c25`, the Task 6 changes not yet committed), on the final code and test files; the rows the review's fix round added or touched were measured again the same day, after its fixes (the note below).

**Result.** 49 rows: 48 red and 1 green, the green one an equivalent mutant named and explained below (L3.M14b), not counted for the plan's row it first stood for. Every red row exits 1 through failing assertions only (every failing test failed with an `AssertionError`; none through a file that failed to load, a hook error or a timeout). The plan's L3.M16 ("stays green on the integrated build") is not a mutation row: `test/mermaid-frame.test.ts` passes on the final build.

**Method** (Global Constraints, "Low disk"; C69, C75). One row at a time, in place in the task's own worktree, never in parallel and never in a copy of the repository. For each row: the original bytes of each file it changes were saved outside the worktree with their sha256; each `old` was checked to occur exactly once and replaced by `new` (a row whose `old` is null creates the file); the thread count was measured (`ps -L -u "$(id -u)" --no-headers | wc -l`, 2296 to 2667 over the runs) and the row ran as `ulimit -u <threads + 1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 <tests>`, its output captured to a log; every saved file was then restored from the saved bytes and its sha256 checked equal (a created file was removed), never `git checkout`. No row rebuilt the committed outputs: every build these rows exercise is the tests' own in-memory one. Every restore matched; after the last row `sha256sum -c` over the Task 6 sources, tests, committed manifests and git-ignored outputs matched the hashes taken before the first, and `node scripts/build-frame.mjs --check` exited 0. The Red column gives the count line and the failing tests (at most five). In the Change column a line break is shown as ⏎ and a backtick inside code as ˋ; the JSON fence holds the exact text.

Notes on the measurement.
- **Rows that needed a test before they could go red.** L3.M15e (prepack's sha256 check dropped) stayed green against the first fixture, whose one-byte edit was to a script that also carries a CSP hash source, which prepack checks separately; a same-length edit of the fixture's stylesheet, which carries none, makes it red. The absolute-path row (L3.M14b2) needed the path row to read the checkout's path with and without its leading slash and to require every input to be named from `src/` or `node_modules/` (or esbuild's virtual `<define:NAME>` input).
- **The plan's row "an absolute path in an input name" is counted through L3.M14b2, which is red.** L3.M14b, the absolute entry spelling alone, is an equivalent mutant: it changes no byte, because esbuild names inputs from its working directory whatever the entry's spelling. It is recorded, never counted red. No ruling yet covers this kind of equivalence: C86 (3) covers type-level reds and defensive checks no input can reach, not a spelling the tool normalises away, so this record no longer cites it (review T6-C2), and the equivalence waits on the coordinator's ruling.
- **Fix round (the Task 6 review).** Added: L3.M14f (`buildFrame({ check: true })` without `out` skips the check: T6-C1); L3.M15c2-pack (prepack prints its problems but exits 0: E1); L3.M15g to L3.M15l (prepack's package-name, path-escape, sort-order, duplicate-path, byte-count and CSP hash-source checks, each with a fixture case that only it can refuse: E2); L3.M17j (the bootstrap's exactly-once embedding check: E3); L3.OFLb to L3.OFLd (fontNotice's three refusals: E3). Measured again: L3.M15c-pack (its refused packs now write into destinations that exist), L3.M15e and L3.M15f (their describe gained a row) and L3.M17i (its describe gained a row). Before E1's fix, L3.M15c2-pack was measured against the unfixed pack test and stayed green (12 passed): npm failed on the missing destination either way, so only the stderr assertions could see prepack. After it, the pack row's claims are soft assertions, so each log names every claim that fails: under L3.M15c-pack all six (both exits, both reasons, both empty destinations), under L3.M15c2-pack the four that do not read stderr (both exits and both empty destinations), its stderr claims passing.


## L3.M13: the byte rules and the HTML-like comment rule (src/frame/bytes.ts, scripts/comment-tokens.mjs, scripts/build-frame.mjs)

Reference §5.4. The plan's rows: drop each hazard check, drop the token scanner. Each script and stylesheet rule of `src/frame/bytes.ts` is dropped once (they are the functions frameDocument also runs), then the build's call of the comment rule (L3.M13k) and the rule's own refusal (L3.M13l). Each is red through the planted-hazard rows of `test/frame-build.test.ts`, which plant into a copy of the built text and hand it to `checkOutputs()`, the check `buildFrame()` runs on every bundle.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.M13a | the script byte rule: '<script' and '</script' | `src/frame/bytes.ts`: `if (/<\/?script/i.test(text)) out.push('script tag'); ⏎` → (removed) | `test/frame-build.test.ts`: 1 failed \| 13 passed \| 27 skipped (41). "a script tag planted in a runtime string of guard.js fails the build, named" | `src/frame/bytes.ts` 2396808208e4 restored, equal |
| L3.M13b | the script byte rule: NUL | `src/frame/bytes.ts`: `if (/<\/?script/i.test(text)) out.push('script tag'); ⏎   if (text.includes('\0')) out.push('NUL'); ⏎` → `if (/<\/?script/i.test(text)) out.push('script tag'); ⏎` | `test/frame-build.test.ts`: 1 failed \| 13 passed \| 27 skipped (41). "a NUL planted in a runtime string of guard.js fails the build, named" | `src/frame/bytes.ts` 2396808208e4 restored, equal |
| L3.M13c | the script byte rule: CR | `src/frame/bytes.ts`: `if (text.includes('\0')) out.push('NUL'); ⏎   if (text.includes('\r')) out.push('CR'); ⏎   if (text.includes('\uFEFF')) out.push('BOM'); ⏎   return out;` → `if (text.includes('\0')) out.push('NUL'); ⏎   if (text.includes('\uFEFF')) out.push('BOM'); ⏎   return out;` | `test/frame-build.test.ts`: 1 failed \| 13 passed \| 27 skipped (41). "a CR planted in a runtime string of guard.js fails the build, named" | `src/frame/bytes.ts` 2396808208e4 restored, equal |
| L3.M13d | the script byte rule: BOM | `src/frame/bytes.ts`: `if (text.includes('\0')) out.push('NUL'); ⏎   if (text.includes('\r')) out.push('CR'); ⏎   if (text.includes('\uFEFF')) out.push('BOM'); ⏎   return out;` → `if (text.includes('\0')) out.push('NUL'); ⏎   if (text.includes('\r')) out.push('CR'); ⏎   return out;` | `test/frame-build.test.ts`: 1 failed \| 13 passed \| 27 skipped (41). "a BOM planted in a runtime string of guard.js fails the build, named" | `src/frame/bytes.ts` 2396808208e4 restored, equal |
| L3.M13e | the CSS byte rule: '</style' | `src/frame/bytes.ts`: `if (/<\/style/i.test(text)) out.push('style end tag'); ⏎` → (removed) | `test/frame-build.test.ts`: 1 failed \| 13 passed \| 27 skipped (41). "a style end tag planted in frame/reader.css fails the build, named" | `src/frame/bytes.ts` 2396808208e4 restored, equal |
| L3.M13f | the CSS byte rule: @import | `src/frame/bytes.ts`: `if (/@import/i.test(text)) out.push('@import'); ⏎` → (removed) | `test/frame-build.test.ts`: 1 failed \| 13 passed \| 27 skipped (41). "a @import planted in frame/reader.css fails the build, named" | `src/frame/bytes.ts` 2396808208e4 restored, equal |
| L3.M13g | the CSS byte rule: NUL | `src/frame/bytes.ts`: `out.push('@import'); ⏎   if (text.includes('\0')) out.push('NUL'); ⏎` → `out.push('@import'); ⏎` | `test/frame-build.test.ts`: 1 failed \| 13 passed \| 27 skipped (41). "a NUL planted in frame/reader.css fails the build, named" | `src/frame/bytes.ts` 2396808208e4 restored, equal |
| L3.M13h | the CSS byte rule: CR | `src/frame/bytes.ts`: `if (text.includes('\r')) out.push('CR'); ⏎   if (text.includes('\uFEFF')) out.push('BOM'); ⏎   const urls` → `if (text.includes('\uFEFF')) out.push('BOM'); ⏎   const urls` | `test/frame-build.test.ts`: 1 failed \| 13 passed \| 27 skipped (41). "a CR planted in frame/reader.css fails the build, named" | `src/frame/bytes.ts` 2396808208e4 restored, equal |
| L3.M13i | the CSS byte rule: BOM | `src/frame/bytes.ts`: `if (text.includes('\r')) out.push('CR'); ⏎   if (text.includes('\uFEFF')) out.push('BOM'); ⏎   const urls` → `if (text.includes('\r')) out.push('CR'); ⏎   const urls` | `test/frame-build.test.ts`: 1 failed \| 13 passed \| 27 skipped (41). "a BOM planted in frame/reader.css fails the build, named" | `src/frame/bytes.ts` 2396808208e4 restored, equal |
| L3.M13j | the CSS byte rule: a url( other than an inlined woff2 font | `src/frame/bytes.ts`: `if (urls.length !== ok) out.push('url( other than an inlined woff2 font'); ⏎` → (removed) | `test/frame-build.test.ts`: 1 failed \| 13 passed \| 27 skipped (41). "a url( other than an inlined woff2 font planted in frame/reader.css fails the build, named" | `src/frame/bytes.ts` 2396808208e4 restored, equal |
| L3.M13k | the HTML-like comment rule (the token scanner) in the build | `scripts/build-frame.mjs`: `[...scriptHazards(text), ...commentTokenHazards(text).map((h) => ˋHTML comment token (${h})ˋ)]` → `[...scriptHazards(text)]` | `test/frame-build.test.ts`: 1 failed \| 13 passed \| 27 skipped (41). "a `<!--` or a `-->` outside a literal token in enhance.js fails the build; the same inside a string, a template or a regex passes" | `scripts/build-frame.mjs` 8a4f57554899 restored, equal |
| L3.M13l | the token scanner itself: every occurrence counted inside a literal | `scripts/comment-tokens.mjs`: `if (!inside) out.push(` → `if (!inside && false) out.push(` | `test/frame-build.test.ts`: 2 failed \| 12 passed \| 27 skipped (41). "a `<!--` or a `-->` outside a literal token in enhance.js fails the build; the same inside a string, a template or a regex passes"; "the Mermaid frame file holds exactly 3 `<!--`, every one inside a literal, and passes the rule" | `scripts/comment-tokens.mjs` 1b0b454ebad9 restored, equal |

```json
[
  {
    "id": "L3.M13a",
    "guard": "the script byte rule: '<script' and '</script'",
    "changes": [
      {
        "file": "src/frame/bytes.ts",
        "old": "  if (/<\\/?script/i.test(text)) out.push('script tag');\n",
        "new": ""
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M13'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M13'",
    "rc": 1,
    "red": "1 failed | 13 passed | 27 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M13: the byte rules and the HTML-like comment rule fail the build > a script tag planted in a runtime string of guard.js fails the build, named"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame/bytes.ts": "2396808208e4 restored, equal"
    }
  },
  {
    "id": "L3.M13b",
    "guard": "the script byte rule: NUL",
    "changes": [
      {
        "file": "src/frame/bytes.ts",
        "old": "  if (/<\\/?script/i.test(text)) out.push('script tag');\n  if (text.includes('\\0')) out.push('NUL');\n",
        "new": "  if (/<\\/?script/i.test(text)) out.push('script tag');\n"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M13'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M13'",
    "rc": 1,
    "red": "1 failed | 13 passed | 27 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M13: the byte rules and the HTML-like comment rule fail the build > a NUL planted in a runtime string of guard.js fails the build, named"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame/bytes.ts": "2396808208e4 restored, equal"
    }
  },
  {
    "id": "L3.M13c",
    "guard": "the script byte rule: CR",
    "changes": [
      {
        "file": "src/frame/bytes.ts",
        "old": "  if (text.includes('\\0')) out.push('NUL');\n  if (text.includes('\\r')) out.push('CR');\n  if (text.includes('\\uFEFF')) out.push('BOM');\n  return out;",
        "new": "  if (text.includes('\\0')) out.push('NUL');\n  if (text.includes('\\uFEFF')) out.push('BOM');\n  return out;"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M13'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M13'",
    "rc": 1,
    "red": "1 failed | 13 passed | 27 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M13: the byte rules and the HTML-like comment rule fail the build > a CR planted in a runtime string of guard.js fails the build, named"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame/bytes.ts": "2396808208e4 restored, equal"
    }
  },
  {
    "id": "L3.M13d",
    "guard": "the script byte rule: BOM",
    "changes": [
      {
        "file": "src/frame/bytes.ts",
        "old": "  if (text.includes('\\0')) out.push('NUL');\n  if (text.includes('\\r')) out.push('CR');\n  if (text.includes('\\uFEFF')) out.push('BOM');\n  return out;",
        "new": "  if (text.includes('\\0')) out.push('NUL');\n  if (text.includes('\\r')) out.push('CR');\n  return out;"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M13'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M13'",
    "rc": 1,
    "red": "1 failed | 13 passed | 27 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M13: the byte rules and the HTML-like comment rule fail the build > a BOM planted in a runtime string of guard.js fails the build, named"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame/bytes.ts": "2396808208e4 restored, equal"
    }
  },
  {
    "id": "L3.M13e",
    "guard": "the CSS byte rule: '</style'",
    "changes": [
      {
        "file": "src/frame/bytes.ts",
        "old": "  if (/<\\/style/i.test(text)) out.push('style end tag');\n",
        "new": ""
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M13'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M13'",
    "rc": 1,
    "red": "1 failed | 13 passed | 27 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M13: the byte rules and the HTML-like comment rule fail the build > a style end tag planted in frame/reader.css fails the build, named"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame/bytes.ts": "2396808208e4 restored, equal"
    }
  },
  {
    "id": "L3.M13f",
    "guard": "the CSS byte rule: @import",
    "changes": [
      {
        "file": "src/frame/bytes.ts",
        "old": "  if (/@import/i.test(text)) out.push('@import');\n",
        "new": ""
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M13'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M13'",
    "rc": 1,
    "red": "1 failed | 13 passed | 27 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M13: the byte rules and the HTML-like comment rule fail the build > a @import planted in frame/reader.css fails the build, named"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame/bytes.ts": "2396808208e4 restored, equal"
    }
  },
  {
    "id": "L3.M13g",
    "guard": "the CSS byte rule: NUL",
    "changes": [
      {
        "file": "src/frame/bytes.ts",
        "old": "out.push('@import');\n  if (text.includes('\\0')) out.push('NUL');\n",
        "new": "out.push('@import');\n"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M13'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M13'",
    "rc": 1,
    "red": "1 failed | 13 passed | 27 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M13: the byte rules and the HTML-like comment rule fail the build > a NUL planted in frame/reader.css fails the build, named"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame/bytes.ts": "2396808208e4 restored, equal"
    }
  },
  {
    "id": "L3.M13h",
    "guard": "the CSS byte rule: CR",
    "changes": [
      {
        "file": "src/frame/bytes.ts",
        "old": "  if (text.includes('\\r')) out.push('CR');\n  if (text.includes('\\uFEFF')) out.push('BOM');\n  const urls",
        "new": "  if (text.includes('\\uFEFF')) out.push('BOM');\n  const urls"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M13'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M13'",
    "rc": 1,
    "red": "1 failed | 13 passed | 27 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M13: the byte rules and the HTML-like comment rule fail the build > a CR planted in frame/reader.css fails the build, named"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame/bytes.ts": "2396808208e4 restored, equal"
    }
  },
  {
    "id": "L3.M13i",
    "guard": "the CSS byte rule: BOM",
    "changes": [
      {
        "file": "src/frame/bytes.ts",
        "old": "  if (text.includes('\\r')) out.push('CR');\n  if (text.includes('\\uFEFF')) out.push('BOM');\n  const urls",
        "new": "  if (text.includes('\\r')) out.push('CR');\n  const urls"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M13'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M13'",
    "rc": 1,
    "red": "1 failed | 13 passed | 27 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M13: the byte rules and the HTML-like comment rule fail the build > a BOM planted in frame/reader.css fails the build, named"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame/bytes.ts": "2396808208e4 restored, equal"
    }
  },
  {
    "id": "L3.M13j",
    "guard": "the CSS byte rule: a url( other than an inlined woff2 font",
    "changes": [
      {
        "file": "src/frame/bytes.ts",
        "old": "  if (urls.length !== ok) out.push('url( other than an inlined woff2 font');\n",
        "new": ""
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M13'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M13'",
    "rc": 1,
    "red": "1 failed | 13 passed | 27 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M13: the byte rules and the HTML-like comment rule fail the build > a url( other than an inlined woff2 font planted in frame/reader.css fails the build, named"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame/bytes.ts": "2396808208e4 restored, equal"
    }
  },
  {
    "id": "L3.M13k",
    "guard": "the HTML-like comment rule (the token scanner) in the build",
    "changes": [
      {
        "file": "scripts/build-frame.mjs",
        "old": "[...scriptHazards(text), ...commentTokenHazards(text).map((h) => `HTML comment token (${h})`)]",
        "new": "[...scriptHazards(text)]"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M13'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M13'",
    "rc": 1,
    "red": "1 failed | 13 passed | 27 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M13: the byte rules and the HTML-like comment rule fail the build > a `<!--` or a `-->` outside a literal token in enhance.js fails the build; the same inside a string, a template or a regex passes"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/build-frame.mjs": "8a4f57554899 restored, equal"
    }
  },
  {
    "id": "L3.M13l",
    "guard": "the token scanner itself: every occurrence counted inside a literal",
    "changes": [
      {
        "file": "scripts/comment-tokens.mjs",
        "old": "    if (!inside) out.push(",
        "new": "    if (!inside && false) out.push("
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M13'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M13'",
    "rc": 1,
    "red": "2 failed | 12 passed | 27 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M13: the byte rules and the HTML-like comment rule fail the build > a `<!--` or a `-->` outside a literal token in enhance.js fails the build; the same inside a string, a template or a regex passes",
      "test/frame-build.test.ts > L3.M13: the byte rules and the HTML-like comment rule fail the build > the Mermaid frame file holds exactly 3 `<!--`, every one inside a literal, and passes the rule"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/comment-tokens.mjs": "1b0b454ebad9 restored, equal"
    }
  }
]
```

## L3.M14: one reproducible build, --check, and the CI steps (scripts/build-frame.mjs, .github/workflows/ci.yml)

The plan's rows: a timestamp banner; an absolute path in an input name. L3.M14b, the absolute entry path alone, is an equivalent mutant, measured: esbuild names every input and every path comment relative to `absWorkingDir`, however the entry is spelled, so the output bytes and the metafile do not change (recorded, never counted red; no ruling yet covers this kind of equivalence, see the note above). L3.M14b2 is the form that does move the bytes: the same absolute entry with the working directory at the filesystem root, which writes the checkout's path (without its leading slash) into guard.js's path comments; it is red through the path row, which reads both spellings. L3.M14c to L3.M14e are the CI half (`test/ci-workflow.test.ts`): each of the two checks after `npm run build` dropped, and the pack step handing over a spelled name instead of npm's. L3.M14f (fix round, T6-C1): `buildFrame({ check: true })` without `out` returning before the check, so `differ` was never set; red through the row that asks it to check the package root as the CLI does.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.M14a | reproducible: no timestamp in a banner | `scripts/build-frame.mjs`: `banner: { js: '"use strict";' },` → `banner: { js: ˋ"use strict";/* built ${String(Date.now())} */ˋ },` | `test/frame-build.test.ts`: 2 failed \| 2 passed \| 37 skipped (41). "two in-memory builds are byte-identical"; "`node scripts/build-frame.mjs --check --out <dir>` exits 0 on a written tree and 1 once a byte of an output changes" | `scripts/build-frame.mjs` 8a4f57554899 restored, equal |
| L3.M14b | reproducible: inputs named from the package root, never by an absolute path | `scripts/build-frame.mjs`: `entryPoints: [ENTRIES[name]],` → `entryPoints: [path.join(root, ENTRIES[name])],` | green: 4 passed \| 37 skipped (41) (equivalent, see the note) | `scripts/build-frame.mjs` 8a4f57554899 restored, equal |
| L3.M14b2 | reproducible: inputs named from the package root (an absolute entry named from the filesystem root) | `scripts/build-frame.mjs`: `entryPoints: [ENTRIES[name]], ⏎     absWorkingDir: root,` → `entryPoints: [path.join(root, ENTRIES[name])], ⏎     absWorkingDir: path.parse(root).root,` | `test/frame-build.test.ts`: 1 failed \| 3 passed \| 37 skipped (41). "no output names the checkout or the home directory, and every input is named from the package root" | `scripts/build-frame.mjs` 8a4f57554899 restored, equal |
| L3.M14c | CI: `node scripts/build-frame.mjs --check` after the build | `.github/workflows/ci.yml`: `- run: node scripts/build-frame.mjs --check ⏎` → (removed) | `test/ci-workflow.test.ts`: 2 failed \| 57 passed (59). "installs from the lock, reads the playwright-core pin, configures apt and makes its archive directory, restores the browser cache and the apt archive cache, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "right after `npm run build`, a fresh frame build equals what it wrote, and git sees no moved manifest" | `.github/workflows/ci.yml` a57d0c730fc6 restored, equal |
| L3.M14d | CI: `git diff --exit-code` over the two committed manifests after the build | `.github/workflows/ci.yml`: `- run: git diff --exit-code -- assets/assets.json src/frame/ ⏎` → (removed) | `test/ci-workflow.test.ts`: 2 failed \| 57 passed (59). "installs from the lock, reads the playwright-core pin, configures apt and makes its archive directory, restores the browser cache and the apt archive cache, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball"; "right after `npm run build`, a fresh frame build equals what it wrote, and git sees no moved manifest" | `.github/workflows/ci.yml` a57d0c730fc6 restored, equal |
| L3.M14e | CI: the tarball's name is the one npm pack --json gives | `.github/workflows/ci.yml`: `process.stdout.write(String(p.filename))` → `process.stdout.write("synapsium-labs-docserver-0.1.0.tgz")` | `test/ci-workflow.test.ts`: 2 failed \| 57 passed (59). "the pack step runs `npm pack --json` once, after the ratchet, and the smoke step reads the name it hands over; no step spells a tarball name or a version"; "hands over the filename `npm pack --json` gives, whatever the version" | `.github/workflows/ci.yml` a57d0c730fc6 restored, equal |
| L3.M14f | buildFrame({check: true}) without `out` checks the package root (review T6-C1: the check skipped) | `scripts/build-frame.mjs`: `if (check) return { ...built, differ: checkFrame(built, out ?? root) }; ⏎   if (out === undefined) return built; ⏎` → `if (out === undefined) return built; ⏎   if (check) return { ...built, differ: checkFrame(built, out) }; ⏎` | `test/frame-build.test.ts`: 1 failed \| 4 passed \| 40 skipped (45). "buildFrame({ check: true }) without `out` checks the package root, as the CLI does: `differ` is always set (review T6-C1)" | `scripts/build-frame.mjs` 27a6e741501a restored, equal |

```json
[
  {
    "id": "L3.M14a",
    "guard": "reproducible: no timestamp in a banner",
    "changes": [
      {
        "file": "scripts/build-frame.mjs",
        "old": "    banner: { js: '\"use strict\";' },",
        "new": "    banner: { js: `\"use strict\";/* built ${String(Date.now())} */` },"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M14'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M14'",
    "rc": 1,
    "red": "2 failed | 2 passed | 37 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M14: one reproducible build, and --check > two in-memory builds are byte-identical",
      "test/frame-build.test.ts > L3.M14: one reproducible build, and --check > `node scripts/build-frame.mjs --check --out <dir>` exits 0 on a written tree and 1 once a byte of an output changes"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/build-frame.mjs": "8a4f57554899 restored, equal"
    }
  },
  {
    "id": "L3.M14b",
    "guard": "reproducible: inputs named from the package root, never by an absolute path",
    "changes": [
      {
        "file": "scripts/build-frame.mjs",
        "old": "    entryPoints: [ENTRIES[name]],",
        "new": "    entryPoints: [path.join(root, ENTRIES[name])],"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M14'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M14'",
    "rc": 0,
    "red": "4 passed | 37 skipped (41)",
    "failing": [],
    "errors": [],
    "restore": {
      "scripts/build-frame.mjs": "8a4f57554899 restored, equal"
    }
  },
  {
    "id": "L3.M14b2",
    "guard": "reproducible: inputs named from the package root (an absolute entry named from the filesystem root)",
    "changes": [
      {
        "file": "scripts/build-frame.mjs",
        "old": "    entryPoints: [ENTRIES[name]],\n    absWorkingDir: root,",
        "new": "    entryPoints: [path.join(root, ENTRIES[name])],\n    absWorkingDir: path.parse(root).root,"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M14'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M14'",
    "rc": 1,
    "red": "1 failed | 3 passed | 37 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M14: one reproducible build, and --check > no output names the checkout or the home directory, and every input is named from the package root"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/build-frame.mjs": "8a4f57554899 restored, equal"
    }
  },
  {
    "id": "L3.M14c",
    "guard": "CI: `node scripts/build-frame.mjs --check` after the build",
    "changes": [
      {
        "file": ".github/workflows/ci.yml",
        "old": "      - run: node scripts/build-frame.mjs --check\n",
        "new": ""
      }
    ],
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "rc": 1,
    "red": "2 failed | 57 passed (59)",
    "failing": [
      "test/ci-workflow.test.ts > ci.yml: the test job > installs from the lock, reads the playwright-core pin, configures apt and makes its archive directory, restores the browser cache and the apt archive cache, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball",
      "test/ci-workflow.test.ts > ci.yml: the frame build is checked and the packed tarball is the one npm names (L3 Task 6) > right after `npm run build`, a fresh frame build equals what it wrote, and git sees no moved manifest"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      ".github/workflows/ci.yml": "a57d0c730fc6 restored, equal"
    }
  },
  {
    "id": "L3.M14d",
    "guard": "CI: `git diff --exit-code` over the two committed manifests after the build",
    "changes": [
      {
        "file": ".github/workflows/ci.yml",
        "old": "      - run: git diff --exit-code -- assets/assets.json src/frame/\n",
        "new": ""
      }
    ],
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "rc": 1,
    "red": "2 failed | 57 passed (59)",
    "failing": [
      "test/ci-workflow.test.ts > ci.yml: the test job > installs from the lock, reads the playwright-core pin, configures apt and makes its archive directory, restores the browser cache and the apt archive cache, installs the browsers, makes the apt archive cache readable, typechecks, tests, checks the tests wrote no layout snapshot, builds, runs the ratchet, then packs and smokes the tarball",
      "test/ci-workflow.test.ts > ci.yml: the frame build is checked and the packed tarball is the one npm names (L3 Task 6) > right after `npm run build`, a fresh frame build equals what it wrote, and git sees no moved manifest"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      ".github/workflows/ci.yml": "a57d0c730fc6 restored, equal"
    }
  },
  {
    "id": "L3.M14e",
    "guard": "CI: the tarball's name is the one npm pack --json gives",
    "changes": [
      {
        "file": ".github/workflows/ci.yml",
        "old": "process.stdout.write(String(p.filename))",
        "new": "process.stdout.write(\"synapsium-labs-docserver-0.1.0.tgz\")"
      }
    ],
    "tests": "test/ci-workflow.test.ts",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/ci-workflow.test.ts",
    "rc": 1,
    "red": "2 failed | 57 passed (59)",
    "failing": [
      "test/ci-workflow.test.ts > ci.yml: the frame build is checked and the packed tarball is the one npm names (L3 Task 6) > the pack step runs `npm pack --json` once, after the ratchet, and the smoke step reads the name it hands over; no step spells a tarball name or a version",
      "test/ci-workflow.test.ts > ci.yml: the frame build is checked and the packed tarball is the one npm names (L3 Task 6) > hands over the filename `npm pack --json` gives, whatever the version"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      ".github/workflows/ci.yml": "a57d0c730fc6 restored, equal"
    }
  },
  {
    "id": "L3.M14f",
    "guard": "buildFrame({check: true}) without `out` checks the package root (review T6-C1: the check skipped)",
    "changes": [
      {
        "file": "scripts/build-frame.mjs",
        "old": "  if (check) return { ...built, differ: checkFrame(built, out ?? root) };\n  if (out === undefined) return built;\n",
        "new": "  if (out === undefined) return built;\n  if (check) return { ...built, differ: checkFrame(built, out) };\n"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M14'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M14'",
    "rc": 1,
    "red": "1 failed | 4 passed | 40 skipped (45)",
    "failing": [
      "test/frame-build.test.ts > L3.M14: one reproducible build, and --check > buildFrame({ check: true }) without `out` checks the package root, as the CLI does: `differ` is always set (review T6-C1)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/build-frame.mjs": "27a6e741501a restored, equal"
    }
  }
]
```

## L3.M15: assets.json, FRAME_MANIFEST and prepack (assets/assets.json, scripts/build-frame.mjs, scripts/verify-assets.mjs, package.json)

The plan's rows: edit one byte; add an unlisted file; skip prepack; write `chars` as the byte count. Skipping prepack is measured twice: against the unit rows that pin the script (L3.M15c) and against the packed tarball (L3.M15c-pack, `test/pack.test.ts`, whose stage packs with npm's scripts on and must be refused after a one-byte edit and after a stray file). L3.M15e and L3.M15f drop prepack's own sha256 and unlisted-file checks. Fix round: the pack test's refused packs write into destinations that exist, so npm would pack but for prepack (E1), and L3.M15c2-pack has prepack print its problems and exit 0; L3.M15g to L3.M15l drop each of prepack's other checks, each red through a fixture case that only it refuses and that then exits 0 (E2).

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.M15a | the committed assets.json equals a fresh build (one byte edited) | `assets/assets.json`: `"ff3c25da5703` → `"ff3c25da5704` | `test/frame-build.test.ts`: 1 failed \| 9 passed \| 31 skipped (41). "the committed assets.json and manifest.generated.ts equal a fresh build" | `assets/assets.json` 8fa2cbf505e2 restored, equal |
| L3.M15b | every file under assets/ is listed (an unlisted file added) | `assets/fonts/stray.txt`: created, holding `stray` | `test/frame-build.test.ts`: 1 failed \| 9 passed \| 31 skipped (41). "the committed assets.json and manifest.generated.ts equal a fresh build" | `assets/fonts/stray.txt` removed |
| L3.M15c | prepack is scripts/verify-assets.mjs (prepack skipped) | `package.json`: `"prepack": "node scripts/verify-assets.mjs", ⏎` → (removed) | `test/frame-build.test.ts`: 2 failed \| 9 passed \| 30 skipped (41). "is the package prepack"; "build runs the Mermaid build, the frame build, then tsc; build:frame and prepack name their scripts" | `package.json` d058891dab27 restored, equal |
| L3.M15c-pack | prepack runs at npm pack (prepack skipped), measured on the packed tarball, its destinations created (review E1) | `package.json`: `"prepack": "node scripts/verify-assets.mjs", ⏎` → (removed) | `test/pack.test.ts (project pack)`: 1 failed \| 11 passed (12). "L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed"; "L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed"; "L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed"; "L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed"; "L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed" | `package.json` d058891dab27 restored, equal |
| L3.M15c2-pack | prepack's refusal exits non-zero (main returns 0 after printing its problems), measured on the packed tarball (review E1) | `scripts/verify-assets.mjs`: `for (const p of problems) console.error(ˋverify-assets: ${p}ˋ); ⏎     return 1;` → `for (const p of problems) console.error(ˋverify-assets: ${p}ˋ); ⏎     return 0;` | `test/pack.test.ts (project pack)`: 1 failed \| 11 passed (12). "L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed"; "L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed"; "L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed"; "L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed" | `scripts/verify-assets.mjs` d765a4e8f75c restored, equal |
| L3.M15d | FRAME_MANIFEST's chars is the UTF-16 length (written as the byte count) | `scripts/build-frame.mjs`: `chars: text.length,` → `chars: Buffer.byteLength(text, 'utf8'),` | `test/frame-build.test.ts`: 2 failed \| 8 passed \| 31 skipped (41). "the committed assets.json and manifest.generated.ts equal a fresh build"; "FRAME_MANIFEST is the frame subset, and each entry's chars is its text's UTF-16 length, Mermaid's non-ASCII included" | `scripts/build-frame.mjs` 8a4f57554899 restored, equal |
| L3.M15e | prepack's sha256 check (a one-byte edit of the same length) | `scripts/verify-assets.mjs`: `if (digest.toString('hex') !== f.sha256) problems.push(ˋassets/${f.path}: its sha256 is not the listed oneˋ); ⏎` → (removed) | `test/frame-build.test.ts`: 1 failed \| 11 passed \| 33 skipped (45). "refuses a one-byte edit, an unlisted file, a missing listed file, and a version that is not the package version" | `scripts/verify-assets.mjs` d765a4e8f75c restored, equal |
| L3.M15f | prepack's unlisted-file check | `scripts/verify-assets.mjs`: `if (rel !== 'assets.json' && !listed.has(rel)) problems.push(ˋassets/${rel}: not listed in assets/assets.jsonˋ); ⏎` → (removed) | `test/frame-build.test.ts`: 1 failed \| 11 passed \| 33 skipped (45). "refuses a one-byte edit, an unlisted file, a missing listed file, and a version that is not the package version" | `scripts/verify-assets.mjs` d765a4e8f75c restored, equal |
| L3.M15g | prepack's package-name check (review E2) | `scripts/verify-assets.mjs`: `if (manifest.package !== pkg.name) problems.push(ˋassets/assets.json: package ${String(manifest.package)}, not ${String(pkg.name)}ˋ); ⏎` → (removed) | `test/frame-build.test.ts`: 1 failed \| 11 passed \| 33 skipped (45). "refuses, each through its own check and nothing else: another package name, a path outside assets/, an unsorted listing, a path listed twice, a wrong byte count, a wrong CSP hash source (review E2)" | `scripts/verify-assets.mjs` d765a4e8f75c restored, equal |
| L3.M15h | prepack's refusal of a listed path outside assets/ (review E2) | `scripts/verify-assets.mjs`: `if (paths.some((p) => typeof p !== 'string' \|\| p === '' \|\| p.startsWith('/') \|\| p.split('/').includes('..'))) { ⏎     return [...problems, 'assets/assets.json: a listed path is not a relative path under assets/']; ⏎   } ⏎` → (removed) | `test/frame-build.test.ts`: 1 failed \| 11 passed \| 33 skipped (45). "refuses, each through its own check and nothing else: another package name, a path outside assets/, an unsorted listing, a path listed twice, a wrong byte count, a wrong CSP hash source (review E2)" | `scripts/verify-assets.mjs` d765a4e8f75c restored, equal |
| L3.M15i | prepack's sort-order check (review E2) | `scripts/verify-assets.mjs`: `if (paths.join('\n') !== [...paths].sort(order).join('\n')) problems.push('assets/assets.json: the files are not sorted by path'); ⏎` → (removed) | `test/frame-build.test.ts`: 1 failed \| 11 passed \| 33 skipped (45). "refuses, each through its own check and nothing else: another package name, a path outside assets/, an unsorted listing, a path listed twice, a wrong byte count, a wrong CSP hash source (review E2)" | `scripts/verify-assets.mjs` d765a4e8f75c restored, equal |
| L3.M15j | prepack's duplicate-path check (review E2) | `scripts/verify-assets.mjs`: `if (new Set(paths).size !== paths.length) problems.push('assets/assets.json: a path is listed twice'); ⏎` → (removed) | `test/frame-build.test.ts`: 1 failed \| 11 passed \| 33 skipped (45). "refuses, each through its own check and nothing else: another package name, a path outside assets/, an unsorted listing, a path listed twice, a wrong byte count, a wrong CSP hash source (review E2)" | `scripts/verify-assets.mjs` d765a4e8f75c restored, equal |
| L3.M15k | prepack's byte-count check (review E2) | `scripts/verify-assets.mjs`: `if (data.length !== f.bytes) problems.push(ˋassets/${f.path}: ${String(data.length)} bytes, listed as ${String(f.bytes)}ˋ); ⏎` → (removed) | `test/frame-build.test.ts`: 1 failed \| 11 passed \| 33 skipped (45). "refuses, each through its own check and nothing else: another package name, a path outside assets/, an unsorted listing, a path listed twice, a wrong byte count, a wrong CSP hash source (review E2)" | `scripts/verify-assets.mjs` d765a4e8f75c restored, equal |
| L3.M15l | prepack's CSP hash-source check (review E2) | `scripts/verify-assets.mjs`: `if (f.csp !== undefined && f.csp !== ˋ'sha256-${digest.toString('base64')}'ˋ) problems.push(ˋassets/${f.path}: its CSP hash source is not the listed oneˋ); ⏎` → (removed) | `test/frame-build.test.ts`: 1 failed \| 11 passed \| 33 skipped (45). "refuses, each through its own check and nothing else: another package name, a path outside assets/, an unsorted listing, a path listed twice, a wrong byte count, a wrong CSP hash source (review E2)" | `scripts/verify-assets.mjs` d765a4e8f75c restored, equal |

```json
[
  {
    "id": "L3.M15a",
    "guard": "the committed assets.json equals a fresh build (one byte edited)",
    "changes": [
      {
        "file": "assets/assets.json",
        "old": "\"ff3c25da5703",
        "new": "\"ff3c25da5704"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M15'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M15'",
    "rc": 1,
    "red": "1 failed | 9 passed | 31 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M15: assets.json, FRAME_MANIFEST and prepack > the committed assets.json and manifest.generated.ts equal a fresh build"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "assets/assets.json": "8fa2cbf505e2 restored, equal"
    }
  },
  {
    "id": "L3.M15b",
    "guard": "every file under assets/ is listed (an unlisted file added)",
    "changes": [
      {
        "file": "assets/fonts/stray.txt",
        "old": null,
        "new": "stray\n"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M15'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M15'",
    "rc": 1,
    "red": "1 failed | 9 passed | 31 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M15: assets.json, FRAME_MANIFEST and prepack > the committed assets.json and manifest.generated.ts equal a fresh build"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "assets/fonts/stray.txt": "removed"
    }
  },
  {
    "id": "L3.M15c",
    "guard": "prepack is scripts/verify-assets.mjs (prepack skipped)",
    "changes": [
      {
        "file": "package.json",
        "old": "    \"prepack\": \"node scripts/verify-assets.mjs\",\n",
        "new": ""
      }
    ],
    "tests": "test/frame-build.test.ts -t 'prepack|wiring'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'prepack|wiring'",
    "rc": 1,
    "red": "2 failed | 9 passed | 30 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M15: assets.json, FRAME_MANIFEST and prepack > prepack: scripts/verify-assets.mjs > is the package prepack",
      "test/frame-build.test.ts > package.json: the build wiring > build runs the Mermaid build, the frame build, then tsc; build:frame and prepack name their scripts"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "package.json": "d058891dab27 restored, equal"
    }
  },
  {
    "id": "L3.M15c-pack",
    "guard": "prepack runs at npm pack (prepack skipped), measured on the packed tarball, its destinations created (review E1)",
    "changes": [
      {
        "file": "package.json",
        "old": "    \"prepack\": \"node scripts/verify-assets.mjs\",\n",
        "new": ""
      }
    ],
    "tests": "--project pack",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 --project pack",
    "rc": 1,
    "red": "1 failed | 11 passed (12)",
    "failing": [
      "test/pack.test.ts > npm pack > L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed",
      "test/pack.test.ts > npm pack > L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed",
      "test/pack.test.ts > npm pack > L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed",
      "test/pack.test.ts > npm pack > L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed",
      "test/pack.test.ts > npm pack > L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed",
      "test/pack.test.ts > npm pack > L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "package.json": "d058891dab27 restored, equal"
    }
  },
  {
    "id": "L3.M15c2-pack",
    "guard": "prepack's refusal exits non-zero (main returns 0 after printing its problems), measured on the packed tarball (review E1)",
    "changes": [
      {
        "file": "scripts/verify-assets.mjs",
        "old": "    for (const p of problems) console.error(`verify-assets: ${p}`);\n    return 1;",
        "new": "    for (const p of problems) console.error(`verify-assets: ${p}`);\n    return 0;"
      }
    ],
    "tests": "--project pack",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 --project pack",
    "rc": 1,
    "red": "1 failed | 11 passed (12)",
    "failing": [
      "test/pack.test.ts > npm pack > L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed",
      "test/pack.test.ts > npm pack > L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed",
      "test/pack.test.ts > npm pack > L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed",
      "test/pack.test.ts > npm pack > L3.M15: prepack refuses a one-byte edit of a frame file and an unlisted file under assets/, and nothing is packed"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/verify-assets.mjs": "d765a4e8f75c restored, equal"
    }
  },
  {
    "id": "L3.M15d",
    "guard": "FRAME_MANIFEST's chars is the UTF-16 length (written as the byte count)",
    "changes": [
      {
        "file": "scripts/build-frame.mjs",
        "old": "      chars: text.length,",
        "new": "      chars: Buffer.byteLength(text, 'utf8'),"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M15'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M15'",
    "rc": 1,
    "red": "2 failed | 8 passed | 31 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M15: assets.json, FRAME_MANIFEST and prepack > the committed assets.json and manifest.generated.ts equal a fresh build",
      "test/frame-build.test.ts > L3.M15: assets.json, FRAME_MANIFEST and prepack > FRAME_MANIFEST is the frame subset, and each entry's chars is its text's UTF-16 length, Mermaid's non-ASCII included"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/build-frame.mjs": "8a4f57554899 restored, equal"
    }
  },
  {
    "id": "L3.M15e",
    "guard": "prepack's sha256 check (a one-byte edit of the same length)",
    "changes": [
      {
        "file": "scripts/verify-assets.mjs",
        "old": "    if (digest.toString('hex') !== f.sha256) problems.push(`assets/${f.path}: its sha256 is not the listed one`);\n",
        "new": ""
      }
    ],
    "tests": "test/frame-build.test.ts -t 'prepack'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'prepack'",
    "rc": 1,
    "red": "1 failed | 11 passed | 33 skipped (45)",
    "failing": [
      "test/frame-build.test.ts > L3.M15: assets.json, FRAME_MANIFEST and prepack > prepack: scripts/verify-assets.mjs > refuses a one-byte edit, an unlisted file, a missing listed file, and a version that is not the package version"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/verify-assets.mjs": "d765a4e8f75c restored, equal"
    }
  },
  {
    "id": "L3.M15f",
    "guard": "prepack's unlisted-file check",
    "changes": [
      {
        "file": "scripts/verify-assets.mjs",
        "old": "    if (rel !== 'assets.json' && !listed.has(rel)) problems.push(`assets/${rel}: not listed in assets/assets.json`);\n",
        "new": ""
      }
    ],
    "tests": "test/frame-build.test.ts -t 'prepack'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'prepack'",
    "rc": 1,
    "red": "1 failed | 11 passed | 33 skipped (45)",
    "failing": [
      "test/frame-build.test.ts > L3.M15: assets.json, FRAME_MANIFEST and prepack > prepack: scripts/verify-assets.mjs > refuses a one-byte edit, an unlisted file, a missing listed file, and a version that is not the package version"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/verify-assets.mjs": "d765a4e8f75c restored, equal"
    }
  },
  {
    "id": "L3.M15g",
    "guard": "prepack's package-name check (review E2)",
    "changes": [
      {
        "file": "scripts/verify-assets.mjs",
        "old": "  if (manifest.package !== pkg.name) problems.push(`assets/assets.json: package ${String(manifest.package)}, not ${String(pkg.name)}`);\n",
        "new": ""
      }
    ],
    "tests": "test/frame-build.test.ts -t 'prepack'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'prepack'",
    "rc": 1,
    "red": "1 failed | 11 passed | 33 skipped (45)",
    "failing": [
      "test/frame-build.test.ts > L3.M15: assets.json, FRAME_MANIFEST and prepack > prepack: scripts/verify-assets.mjs > refuses, each through its own check and nothing else: another package name, a path outside assets/, an unsorted listing, a path listed twice, a wrong byte count, a wrong CSP hash source (review E2)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/verify-assets.mjs": "d765a4e8f75c restored, equal"
    }
  },
  {
    "id": "L3.M15h",
    "guard": "prepack's refusal of a listed path outside assets/ (review E2)",
    "changes": [
      {
        "file": "scripts/verify-assets.mjs",
        "old": "  if (paths.some((p) => typeof p !== 'string' || p === '' || p.startsWith('/') || p.split('/').includes('..'))) {\n    return [...problems, 'assets/assets.json: a listed path is not a relative path under assets/'];\n  }\n",
        "new": ""
      }
    ],
    "tests": "test/frame-build.test.ts -t 'prepack'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'prepack'",
    "rc": 1,
    "red": "1 failed | 11 passed | 33 skipped (45)",
    "failing": [
      "test/frame-build.test.ts > L3.M15: assets.json, FRAME_MANIFEST and prepack > prepack: scripts/verify-assets.mjs > refuses, each through its own check and nothing else: another package name, a path outside assets/, an unsorted listing, a path listed twice, a wrong byte count, a wrong CSP hash source (review E2)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/verify-assets.mjs": "d765a4e8f75c restored, equal"
    }
  },
  {
    "id": "L3.M15i",
    "guard": "prepack's sort-order check (review E2)",
    "changes": [
      {
        "file": "scripts/verify-assets.mjs",
        "old": "  if (paths.join('\\n') !== [...paths].sort(order).join('\\n')) problems.push('assets/assets.json: the files are not sorted by path');\n",
        "new": ""
      }
    ],
    "tests": "test/frame-build.test.ts -t 'prepack'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'prepack'",
    "rc": 1,
    "red": "1 failed | 11 passed | 33 skipped (45)",
    "failing": [
      "test/frame-build.test.ts > L3.M15: assets.json, FRAME_MANIFEST and prepack > prepack: scripts/verify-assets.mjs > refuses, each through its own check and nothing else: another package name, a path outside assets/, an unsorted listing, a path listed twice, a wrong byte count, a wrong CSP hash source (review E2)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/verify-assets.mjs": "d765a4e8f75c restored, equal"
    }
  },
  {
    "id": "L3.M15j",
    "guard": "prepack's duplicate-path check (review E2)",
    "changes": [
      {
        "file": "scripts/verify-assets.mjs",
        "old": "  if (new Set(paths).size !== paths.length) problems.push('assets/assets.json: a path is listed twice');\n",
        "new": ""
      }
    ],
    "tests": "test/frame-build.test.ts -t 'prepack'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'prepack'",
    "rc": 1,
    "red": "1 failed | 11 passed | 33 skipped (45)",
    "failing": [
      "test/frame-build.test.ts > L3.M15: assets.json, FRAME_MANIFEST and prepack > prepack: scripts/verify-assets.mjs > refuses, each through its own check and nothing else: another package name, a path outside assets/, an unsorted listing, a path listed twice, a wrong byte count, a wrong CSP hash source (review E2)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/verify-assets.mjs": "d765a4e8f75c restored, equal"
    }
  },
  {
    "id": "L3.M15k",
    "guard": "prepack's byte-count check (review E2)",
    "changes": [
      {
        "file": "scripts/verify-assets.mjs",
        "old": "    if (data.length !== f.bytes) problems.push(`assets/${f.path}: ${String(data.length)} bytes, listed as ${String(f.bytes)}`);\n",
        "new": ""
      }
    ],
    "tests": "test/frame-build.test.ts -t 'prepack'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'prepack'",
    "rc": 1,
    "red": "1 failed | 11 passed | 33 skipped (45)",
    "failing": [
      "test/frame-build.test.ts > L3.M15: assets.json, FRAME_MANIFEST and prepack > prepack: scripts/verify-assets.mjs > refuses, each through its own check and nothing else: another package name, a path outside assets/, an unsorted listing, a path listed twice, a wrong byte count, a wrong CSP hash source (review E2)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/verify-assets.mjs": "d765a4e8f75c restored, equal"
    }
  },
  {
    "id": "L3.M15l",
    "guard": "prepack's CSP hash-source check (review E2)",
    "changes": [
      {
        "file": "scripts/verify-assets.mjs",
        "old": "    if (f.csp !== undefined && f.csp !== `'sha256-${digest.toString('base64')}'`) problems.push(`assets/${f.path}: its CSP hash source is not the listed one`);\n",
        "new": ""
      }
    ],
    "tests": "test/frame-build.test.ts -t 'prepack'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'prepack'",
    "rc": 1,
    "red": "1 failed | 11 passed | 33 skipped (45)",
    "failing": [
      "test/frame-build.test.ts > L3.M15: assets.json, FRAME_MANIFEST and prepack > prepack: scripts/verify-assets.mjs > refuses, each through its own check and nothing else: another package name, a path outside assets/, an unsorted listing, a path listed twice, a wrong byte count, a wrong CSP hash source (review E2)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/verify-assets.mjs": "d765a4e8f75c restored, equal"
    }
  }
]
```

## L3.M17: the free-global list (scripts/free-globals.mjs, scripts/build-frame.mjs)

The plan's rows: scan `typeof` operands only (L3.M17a); skip member reads (L3.M17b); skip one bundled file (L3.M17c, Mermaid's); skip the alias rule (L3.M17d). Added: the allowlist not honoured, so `injected` is pinned (L3.M17e: red also through the jsdom row, where Mermaid's own `globalThis.injected ??=` then throws `TypeError: Cannot assign to read only property 'injected'`, the C90 (5) hazard measured); a written name not refused (L3.M17f); the second-scan comparison dropped (L3.M17g); the 512 cap dropped (L3.M17h); the bootstrap built with the interim empty list (L3.M17i); fix round (E3): the exactly-once embedding check dropped (L3.M17j), red through a row that hands checkOutputs() a bootstrap holding the list no times and twice, whose only problem must be that check's. L3.M17e's log carries the word TypeError only as jsdom's report of the script error and inside an assertion's diff; every failing test failed with an AssertionError.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.M17a | the scan reads every unbound reference (typeof operands only) | `scripts/free-globals.mjs`: `if (ts.isIdentifier(n) && isReference(n)) ids.push(n);` → `if (ts.isIdentifier(n) && isReference(n) && ts.isTypeOfExpression(n.parent)) ids.push(n);` | `test/frame-build.test.ts`: 7 failed \| 1 passed \| 33 skipped (41). "scans all four bundled scripts, holds at most 512 names, and is what the bootstrap pins"; "C90 (5): Mermaid's two lazily read globals are pinned; the two names it writes are left unpinned, through the reviewed allowlist"; "a planted bare read, globalThis.__probeName, window["showProbe"] and a read through `const g = globalThis` each appear; locals, parameters, computed keys, indices and a rewritten alias do not"; "a planted assignment of a free name or of a member of the global is reported, and fails the build unless allowlisted"; "more than 512 names fail the build" | `scripts/free-globals.mjs` 5e349a9d4887 restored, equal |
| L3.M17b | the scan reads static member reads on the global (skipped) | `scripts/free-globals.mjs`: `member(source); ⏎` → (removed) | `test/frame-build.test.ts`: 5 failed \| 3 passed \| 33 skipped (41). "scans all four bundled scripts, holds at most 512 names, and is what the bootstrap pins"; "C90 (5): Mermaid's two lazily read globals are pinned; the two names it writes are left unpinned, through the reviewed allowlist"; "a planted bare read, globalThis.__probeName, window["showProbe"] and a read through `const g = globalThis` each appear; locals, parameters, computed keys, indices and a rewritten alias do not"; "a planted assignment of a free name or of a member of the global is reported, and fails the build unless allowlisted"; "in a document, with the list pinned first, the Mermaid frame file evaluates and registers (no pinned name is one it writes)" | `scripts/free-globals.mjs` 5e349a9d4887 restored, equal |
| L3.M17c | the scan covers all four bundled files (Mermaid skipped) | `scripts/build-frame.mjs`: `const scanned = (texts) => ({ guard: texts.guard, bootstrap: texts.bootstrap, enhance: texts.enhance, mermaid: texts.mermaid });` → `const scanned = (texts) => ({ guard: texts.guard, bootstrap: texts.bootstrap, enhance: texts.enhance });` | `test/frame-build.test.ts`: 3 failed \| 5 passed \| 33 skipped (41). "scans all four bundled scripts, holds at most 512 names, and is what the bootstrap pins"; "C90 (5): Mermaid's two lazily read globals are pinned; the two names it writes are left unpinned, through the reviewed allowlist"; "in a document, with the list pinned first, the Mermaid frame file evaluates and registers (no pinned name is one it writes)" | `scripts/build-frame.mjs` 8a4f57554899 restored, equal |
| L3.M17d | the alias rule (`const g = globalThis; g.x`) | `scripts/free-globals.mjs`: `return sym !== undefined && aliases.has(sym);` → `return false;` | `test/frame-build.test.ts`: 1 failed \| 7 passed \| 33 skipped (41). "a planted bare read, globalThis.__probeName, window["showProbe"] and a read through `const g = globalThis` each appear; locals, parameters, computed keys, indices and a rewritten alias do not" | `scripts/free-globals.mjs` 5e349a9d4887 restored, equal |
| L3.M17e | an allowlisted name is never pinned | `scripts/free-globals.mjs`: `const names = scan.reads.filter((r) => !allowed.has(r));` → `const names = [...scan.reads];` | `test/frame-build.test.ts`: 4 failed \| 4 passed \| 33 skipped (41). "scans all four bundled scripts, holds at most 512 names, and is what the bootstrap pins"; "C90 (5): Mermaid's two lazily read globals are pinned; the two names it writes are left unpinned, through the reviewed allowlist"; "a planted assignment of a free name or of a member of the global is reported, and fails the build unless allowlisted"; "in a document, with the list pinned first, the Mermaid frame file evaluates and registers (no pinned name is one it writes)" | `scripts/free-globals.mjs` 5e349a9d4887 restored, equal |
| L3.M17f | a written global name fails the build unless allowlisted | `scripts/free-globals.mjs`: `for (const w of s.writes) if (!allowed.has(w)) problems.push(ˋ${name} writes the global name ${w}ˋ); ⏎` → (removed) | `test/frame-build.test.ts`: 1 failed \| 7 passed \| 33 skipped (41). "a planted assignment of a free name or of a member of the global is reported, and fails the build unless allowlisted" | `scripts/free-globals.mjs` 5e349a9d4887 restored, equal |
| L3.M17g | the final bootstrap's second scan equals the first | `scripts/build-frame.mjs`: `problems.push("free-globals: the final bootstrap's second scan differs from its first");` → `void 0;` | `test/frame-build.test.ts`: 1 failed \| 7 passed \| 33 skipped (41). "the final bootstrap embeds the list once, its second scan equals the first, and a bootstrap the list does not match fails the build" | `scripts/build-frame.mjs` 8a4f57554899 restored, equal |
| L3.M17h | at most 512 names | `scripts/free-globals.mjs`: `if (names.length > MAX_FREE_GLOBALS) problems.push(` → `if (false) problems.push(` | `test/frame-build.test.ts`: 1 failed \| 7 passed \| 33 skipped (41). "more than 512 names fail the build" | `scripts/free-globals.mjs` 5e349a9d4887 restored, equal |
| L3.M17i | the bootstrap carries the scanned list (the interim empty list kept) | `scripts/build-frame.mjs`: `const bootstrap = await script(root, 'bootstrap', names);` → `const bootstrap = await script(root, 'bootstrap');` | `test/frame-build.test.ts`: 7 failed \| 2 passed \| 36 skipped (45). "scans all four bundled scripts, holds at most 512 names, and is what the bootstrap pins"; "C90 (5): Mermaid's two lazily read globals are pinned; the two names it writes are left unpinned, through the reviewed allowlist"; "process, module, exports, global and define are on the list or defined away; require is never defined away"; "a planted assignment of a free name or of a member of the global is reported, and fails the build unless allowlisted"; "the final bootstrap embeds the list once, its second scan equals the first, and a bootstrap the list does not match fails the build" | `scripts/build-frame.mjs` 27a6e741501a restored, equal |
| L3.M17j | the bootstrap carries the list exactly once (the embedding check dropped; review E3) | `scripts/build-frame.mjs`: `problems.push('free-globals: the bootstrap does not carry the list exactly once');` → `void 0;` | `test/frame-build.test.ts`: 1 failed \| 8 passed \| 36 skipped (45). "a bootstrap that carries the list no times, or twice, fails the build through the embedding check alone (review E3)" | `scripts/build-frame.mjs` 27a6e741501a restored, equal |

```json
[
  {
    "id": "L3.M17a",
    "guard": "the scan reads every unbound reference (typeof operands only)",
    "changes": [
      {
        "file": "scripts/free-globals.mjs",
        "old": "    if (ts.isIdentifier(n) && isReference(n)) ids.push(n);",
        "new": "    if (ts.isIdentifier(n) && isReference(n) && ts.isTypeOfExpression(n.parent)) ids.push(n);"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M17'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M17'",
    "rc": 1,
    "red": "7 failed | 1 passed | 33 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M17: the free-global list > scans all four bundled scripts, holds at most 512 names, and is what the bootstrap pins",
      "test/frame-build.test.ts > L3.M17: the free-global list > C90 (5): Mermaid's two lazily read globals are pinned; the two names it writes are left unpinned, through the reviewed allowlist",
      "test/frame-build.test.ts > L3.M17: the free-global list > a planted bare read, globalThis.__probeName, window[\"showProbe\"] and a read through `const g = globalThis` each appear; locals, parameters, computed keys, indices and a rewritten alias do not",
      "test/frame-build.test.ts > L3.M17: the free-global list > a planted assignment of a free name or of a member of the global is reported, and fails the build unless allowlisted",
      "test/frame-build.test.ts > L3.M17: the free-global list > more than 512 names fail the build",
      "test/frame-build.test.ts > L3.M17: the free-global list > the final bootstrap embeds the list once, its second scan equals the first, and a bootstrap the list does not match fails the build",
      "test/frame-build.test.ts > L3.M17: the free-global list > in a document, with the list pinned first, the Mermaid frame file evaluates and registers (no pinned name is one it writes)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/free-globals.mjs": "5e349a9d4887 restored, equal"
    }
  },
  {
    "id": "L3.M17b",
    "guard": "the scan reads static member reads on the global (skipped)",
    "changes": [
      {
        "file": "scripts/free-globals.mjs",
        "old": "  member(source);\n",
        "new": ""
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M17'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M17'",
    "rc": 1,
    "red": "5 failed | 3 passed | 33 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M17: the free-global list > scans all four bundled scripts, holds at most 512 names, and is what the bootstrap pins",
      "test/frame-build.test.ts > L3.M17: the free-global list > C90 (5): Mermaid's two lazily read globals are pinned; the two names it writes are left unpinned, through the reviewed allowlist",
      "test/frame-build.test.ts > L3.M17: the free-global list > a planted bare read, globalThis.__probeName, window[\"showProbe\"] and a read through `const g = globalThis` each appear; locals, parameters, computed keys, indices and a rewritten alias do not",
      "test/frame-build.test.ts > L3.M17: the free-global list > a planted assignment of a free name or of a member of the global is reported, and fails the build unless allowlisted",
      "test/frame-build.test.ts > L3.M17: the free-global list > in a document, with the list pinned first, the Mermaid frame file evaluates and registers (no pinned name is one it writes)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/free-globals.mjs": "5e349a9d4887 restored, equal"
    }
  },
  {
    "id": "L3.M17c",
    "guard": "the scan covers all four bundled files (Mermaid skipped)",
    "changes": [
      {
        "file": "scripts/build-frame.mjs",
        "old": "const scanned = (texts) => ({ guard: texts.guard, bootstrap: texts.bootstrap, enhance: texts.enhance, mermaid: texts.mermaid });",
        "new": "const scanned = (texts) => ({ guard: texts.guard, bootstrap: texts.bootstrap, enhance: texts.enhance });"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M17'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M17'",
    "rc": 1,
    "red": "3 failed | 5 passed | 33 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M17: the free-global list > scans all four bundled scripts, holds at most 512 names, and is what the bootstrap pins",
      "test/frame-build.test.ts > L3.M17: the free-global list > C90 (5): Mermaid's two lazily read globals are pinned; the two names it writes are left unpinned, through the reviewed allowlist",
      "test/frame-build.test.ts > L3.M17: the free-global list > in a document, with the list pinned first, the Mermaid frame file evaluates and registers (no pinned name is one it writes)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/build-frame.mjs": "8a4f57554899 restored, equal"
    }
  },
  {
    "id": "L3.M17d",
    "guard": "the alias rule (`const g = globalThis; g.x`)",
    "changes": [
      {
        "file": "scripts/free-globals.mjs",
        "old": "    return sym !== undefined && aliases.has(sym);",
        "new": "    return false;"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M17'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M17'",
    "rc": 1,
    "red": "1 failed | 7 passed | 33 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M17: the free-global list > a planted bare read, globalThis.__probeName, window[\"showProbe\"] and a read through `const g = globalThis` each appear; locals, parameters, computed keys, indices and a rewritten alias do not"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/free-globals.mjs": "5e349a9d4887 restored, equal"
    }
  },
  {
    "id": "L3.M17e",
    "guard": "an allowlisted name is never pinned",
    "changes": [
      {
        "file": "scripts/free-globals.mjs",
        "old": "  const names = scan.reads.filter((r) => !allowed.has(r));",
        "new": "  const names = [...scan.reads];"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M17'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M17'",
    "rc": 1,
    "red": "4 failed | 4 passed | 33 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M17: the free-global list > scans all four bundled scripts, holds at most 512 names, and is what the bootstrap pins",
      "test/frame-build.test.ts > L3.M17: the free-global list > C90 (5): Mermaid's two lazily read globals are pinned; the two names it writes are left unpinned, through the reviewed allowlist",
      "test/frame-build.test.ts > L3.M17: the free-global list > a planted assignment of a free name or of a member of the global is reported, and fails the build unless allowlisted",
      "test/frame-build.test.ts > L3.M17: the free-global list > in a document, with the list pinned first, the Mermaid frame file evaluates and registers (no pinned name is one it writes)"
    ],
    "errors": [
      "AssertionError",
      "TypeError"
    ],
    "restore": {
      "scripts/free-globals.mjs": "5e349a9d4887 restored, equal"
    }
  },
  {
    "id": "L3.M17f",
    "guard": "a written global name fails the build unless allowlisted",
    "changes": [
      {
        "file": "scripts/free-globals.mjs",
        "old": "    for (const w of s.writes) if (!allowed.has(w)) problems.push(`${name} writes the global name ${w}`);\n",
        "new": ""
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M17'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M17'",
    "rc": 1,
    "red": "1 failed | 7 passed | 33 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M17: the free-global list > a planted assignment of a free name or of a member of the global is reported, and fails the build unless allowlisted"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/free-globals.mjs": "5e349a9d4887 restored, equal"
    }
  },
  {
    "id": "L3.M17g",
    "guard": "the final bootstrap's second scan equals the first",
    "changes": [
      {
        "file": "scripts/build-frame.mjs",
        "old": "      problems.push(\"free-globals: the final bootstrap's second scan differs from its first\");",
        "new": "      void 0;"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M17'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M17'",
    "rc": 1,
    "red": "1 failed | 7 passed | 33 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M17: the free-global list > the final bootstrap embeds the list once, its second scan equals the first, and a bootstrap the list does not match fails the build"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/build-frame.mjs": "8a4f57554899 restored, equal"
    }
  },
  {
    "id": "L3.M17h",
    "guard": "at most 512 names",
    "changes": [
      {
        "file": "scripts/free-globals.mjs",
        "old": "  if (names.length > MAX_FREE_GLOBALS) problems.push(",
        "new": "  if (false) problems.push("
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M17'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M17'",
    "rc": 1,
    "red": "1 failed | 7 passed | 33 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M17: the free-global list > more than 512 names fail the build"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/free-globals.mjs": "5e349a9d4887 restored, equal"
    }
  },
  {
    "id": "L3.M17i",
    "guard": "the bootstrap carries the scanned list (the interim empty list kept)",
    "changes": [
      {
        "file": "scripts/build-frame.mjs",
        "old": "  const bootstrap = await script(root, 'bootstrap', names);",
        "new": "  const bootstrap = await script(root, 'bootstrap');"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M17'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M17'",
    "rc": 1,
    "red": "7 failed | 2 passed | 36 skipped (45)",
    "failing": [
      "test/frame-build.test.ts > L3.M17: the free-global list > scans all four bundled scripts, holds at most 512 names, and is what the bootstrap pins",
      "test/frame-build.test.ts > L3.M17: the free-global list > C90 (5): Mermaid's two lazily read globals are pinned; the two names it writes are left unpinned, through the reviewed allowlist",
      "test/frame-build.test.ts > L3.M17: the free-global list > process, module, exports, global and define are on the list or defined away; require is never defined away",
      "test/frame-build.test.ts > L3.M17: the free-global list > a planted assignment of a free name or of a member of the global is reported, and fails the build unless allowlisted",
      "test/frame-build.test.ts > L3.M17: the free-global list > the final bootstrap embeds the list once, its second scan equals the first, and a bootstrap the list does not match fails the build",
      "test/frame-build.test.ts > L3.M17: the free-global list > a bootstrap that carries the list no times, or twice, fails the build through the embedding check alone (review E3)",
      "test/frame-build.test.ts > L3.M17: the free-global list > in a document, with the list pinned first, the Mermaid frame file evaluates and registers (no pinned name is one it writes)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/build-frame.mjs": "27a6e741501a restored, equal"
    }
  },
  {
    "id": "L3.M17j",
    "guard": "the bootstrap carries the list exactly once (the embedding check dropped; review E3)",
    "changes": [
      {
        "file": "scripts/build-frame.mjs",
        "old": "      problems.push('free-globals: the bootstrap does not carry the list exactly once');",
        "new": "      void 0;"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M17'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M17'",
    "rc": 1,
    "red": "1 failed | 8 passed | 36 skipped (45)",
    "failing": [
      "test/frame-build.test.ts > L3.M17: the free-global list > a bootstrap that carries the list no times, or twice, fails the build through the embedding check alone (review E3)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/build-frame.mjs": "27a6e741501a restored, equal"
    }
  }
]
```

## L3.M18 and the OFL notice (src/frame-runtime/enhance-entry.ts, scripts/build-frame.mjs)

The plan's row: bundle an unused large module into enhance (L3.M18a). Its first form, `import 'mermaid'`, failed the build for a different reason (the enhance build of Mermaid writes the global `onmessage`, which the free-global check refuses before the budgets are read), so the measured form imports `@mermaid-js/parser`, which writes no global: enhance.js grows to 844,759 bytes and the build names it over its 524,288-byte budget. Added: the budget check dropped (L3.M18b), and the OFL notice dropped from the frame stylesheet (L3.OFLa). Fix round (E3): each of fontNotice's three refusals dropped (L3.OFLb, not exactly two font lines; L3.OFLc, a line naming no reserved font name; L3.OFLd, a line holding `*/`), each red through a row that hands it a notices file in a temporary root.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.M18a | enhance.js's 512 KiB budget (an unused large module bundled into enhance) | `src/frame-runtime/enhance-entry.ts`: `import { destroyEnhancement, enhance, goToHash, setEnhancementPrefs } from '../enhance/index.js'; ⏎` → `import { destroyEnhancement, enhance, goToHash, setEnhancementPrefs } from '../enhance/index.js'; ⏎ import '@mermaid-js/parser'; ⏎` | `test/frame-build.test.ts`: 2 failed \| 1 passed \| 38 skipped (41). "each asset is within its budget"; "an asset one byte over its budget fails the build, named" | `src/frame-runtime/enhance-entry.ts` 6651efeb2b6e restored, equal |
| L3.M18b | the budget check in the build | `scripts/build-frame.mjs`: `if (bytes > ASSET_BUDGETS[name]) problems.push(` → `if (false) problems.push(` | `test/frame-build.test.ts`: 1 failed \| 2 passed \| 38 skipped (41). "an asset one byte over its budget fails the build, named" | `scripts/build-frame.mjs` 8a4f57554899 restored, equal |
| L3.OFLa | the OFL notice opens frame/reader.css | `scripts/build-frame.mjs`: `return fontNotice(root) + PRELUDE + inlined;` → `return PRELUDE + inlined;` | `test/frame-build.test.ts`: 1 failed \| 40 skipped (41). "opens the stylesheet as a `/*!` comment holding both fonts' copyright lines from THIRD-PARTY-NOTICES, their reserved font name and the licence sentence" | `scripts/build-frame.mjs` 8a4f57554899 restored, equal |
| L3.OFLb | fontNotice: exactly two font copyright lines (review E3) | `scripts/build-frame.mjs`: `if (lines.length !== 2) throw new Error(` → `if (false) throw new Error(` | `test/frame-build.test.ts`: 1 failed \| 1 passed \| 43 skipped (45). "fontNotice refuses a notices file without exactly two font lines, a font line naming no reserved font name, and one that would end the comment (review E3)" | `scripts/build-frame.mjs` 27a6e741501a restored, equal |
| L3.OFLc | fontNotice: each font line names its reserved font name (review E3) | `scripts/build-frame.mjs`: `if (!l.includes('Reserved Font Name')) throw new Error(` → `if (false) throw new Error(` | `test/frame-build.test.ts`: 1 failed \| 1 passed \| 43 skipped (45). "fontNotice refuses a notices file without exactly two font lines, a font line naming no reserved font name, and one that would end the comment (review E3)" | `scripts/build-frame.mjs` 27a6e741501a restored, equal |
| L3.OFLd | fontNotice: no font line holds '*/' (review E3) | `scripts/build-frame.mjs`: `if (l.includes('*/')) throw new Error(` → `if (false) throw new Error(` | `test/frame-build.test.ts`: 1 failed \| 1 passed \| 43 skipped (45). "fontNotice refuses a notices file without exactly two font lines, a font line naming no reserved font name, and one that would end the comment (review E3)" | `scripts/build-frame.mjs` 27a6e741501a restored, equal |

```json
[
  {
    "id": "L3.M18a",
    "guard": "enhance.js's 512 KiB budget (an unused large module bundled into enhance)",
    "changes": [
      {
        "file": "src/frame-runtime/enhance-entry.ts",
        "old": "import { destroyEnhancement, enhance, goToHash, setEnhancementPrefs } from '../enhance/index.js';\n",
        "new": "import { destroyEnhancement, enhance, goToHash, setEnhancementPrefs } from '../enhance/index.js';\nimport '@mermaid-js/parser';\n"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M18'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M18'",
    "rc": 1,
    "red": "2 failed | 1 passed | 38 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M18: the size budgets > each asset is within its budget",
      "test/frame-build.test.ts > L3.M18: the size budgets > an asset one byte over its budget fails the build, named"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "src/frame-runtime/enhance-entry.ts": "6651efeb2b6e restored, equal"
    }
  },
  {
    "id": "L3.M18b",
    "guard": "the budget check in the build",
    "changes": [
      {
        "file": "scripts/build-frame.mjs",
        "old": "    if (bytes > ASSET_BUDGETS[name]) problems.push(",
        "new": "    if (false) problems.push("
      }
    ],
    "tests": "test/frame-build.test.ts -t 'L3.M18'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'L3.M18'",
    "rc": 1,
    "red": "1 failed | 2 passed | 38 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > L3.M18: the size budgets > an asset one byte over its budget fails the build, named"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/build-frame.mjs": "8a4f57554899 restored, equal"
    }
  },
  {
    "id": "L3.OFLa",
    "guard": "the OFL notice opens frame/reader.css",
    "changes": [
      {
        "file": "scripts/build-frame.mjs",
        "old": "  return fontNotice(root) + PRELUDE + inlined;",
        "new": "  return PRELUDE + inlined;"
      }
    ],
    "tests": "test/frame-build.test.ts -t 'OFL'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'OFL'",
    "rc": 1,
    "red": "1 failed | 40 skipped (41)",
    "failing": [
      "test/frame-build.test.ts > the OFL notice in frame/reader.css > opens the stylesheet as a `/*!` comment holding both fonts' copyright lines from THIRD-PARTY-NOTICES, their reserved font name and the licence sentence"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/build-frame.mjs": "8a4f57554899 restored, equal"
    }
  },
  {
    "id": "L3.OFLb",
    "guard": "fontNotice: exactly two font copyright lines (review E3)",
    "changes": [
      {
        "file": "scripts/build-frame.mjs",
        "old": "  if (lines.length !== 2) throw new Error(",
        "new": "  if (false) throw new Error("
      }
    ],
    "tests": "test/frame-build.test.ts -t 'OFL'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'OFL'",
    "rc": 1,
    "red": "1 failed | 1 passed | 43 skipped (45)",
    "failing": [
      "test/frame-build.test.ts > the OFL notice in frame/reader.css > fontNotice refuses a notices file without exactly two font lines, a font line naming no reserved font name, and one that would end the comment (review E3)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/build-frame.mjs": "27a6e741501a restored, equal"
    }
  },
  {
    "id": "L3.OFLc",
    "guard": "fontNotice: each font line names its reserved font name (review E3)",
    "changes": [
      {
        "file": "scripts/build-frame.mjs",
        "old": "    if (!l.includes('Reserved Font Name')) throw new Error(",
        "new": "    if (false) throw new Error("
      }
    ],
    "tests": "test/frame-build.test.ts -t 'OFL'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'OFL'",
    "rc": 1,
    "red": "1 failed | 1 passed | 43 skipped (45)",
    "failing": [
      "test/frame-build.test.ts > the OFL notice in frame/reader.css > fontNotice refuses a notices file without exactly two font lines, a font line naming no reserved font name, and one that would end the comment (review E3)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/build-frame.mjs": "27a6e741501a restored, equal"
    }
  },
  {
    "id": "L3.OFLd",
    "guard": "fontNotice: no font line holds '*/' (review E3)",
    "changes": [
      {
        "file": "scripts/build-frame.mjs",
        "old": "    if (l.includes('*/')) throw new Error(",
        "new": "    if (false) throw new Error("
      }
    ],
    "tests": "test/frame-build.test.ts -t 'OFL'",
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/frame-build.test.ts -t 'OFL'",
    "rc": 1,
    "red": "1 failed | 1 passed | 43 skipped (45)",
    "failing": [
      "test/frame-build.test.ts > the OFL notice in frame/reader.css > fontNotice refuses a notices file without exactly two font lines, a font line naming no reserved font name, and one that would end the comment (review E3)"
    ],
    "errors": [
      "AssertionError"
    ],
    "restore": {
      "scripts/build-frame.mjs": "27a6e741501a restored, equal"
    }
  }
]
```
