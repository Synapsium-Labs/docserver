# L3 Task 7: mutation rows (frameDocument and the frame mutants)

Each guard of Task 7, changed once, with the tests that go red: `frameDocument`'s skeleton, its asset verification,
each refusal code at its boundary, the derived `MAX_SRCDOC_CHARS_DEFAULT`, the seeded fields and the host-data copy
(`src/frame/document.ts`), the Mermaid gate (`src/frame/gate.ts`), purity and the `./frame` import graph, and the
frame mutants' index (`conformance/frame-mutants/index.json`). Measured 2026-10-27 (UTC) on branch
`l3-t07-frame-document` (base `4e9127d`, the Task 7 changes not yet committed), after the review's fix round and the coordinator's ruling C92 (the skeleton term, last section), on the
final source and the final test files, every row: the sha256 in each row's JSON is the file's bytes before the
mutation, and every row ran against the same files (`src/frame/document.ts` `6b2664885fca…`, `src/frame/gate.ts` `3f6e7f2e186d…`, `src/frame/bytes.ts` `2396808208e4…`, `conformance/frame-mutants/index.json` `45dcf73b5691…`) and the same test files (`test/frame-document.test.ts` `025e3e36fe86…`, `test/frame-pure.test.ts` `5b243b14bc4e…`, `test/frame-mutants.test.ts` `75cc47bedf80…`, `test/frame-scans.ts` `cb7cf715425b…`).

**Result.** 79 rows, all red, none equivalent. Every red run exits 1 and its failing tests fail through an `AssertionError` (the frame build in `beforeAll` completed in each). Five rows also carry one non-assertion failure beside their assertion reds, named here: L3.M1a to L3.M1d (the mutants row's own `templateOf` refuses a srcdoc whose guard or bootstrap anchor moved), and L3.M7l (one row of the initialHash describe calls frameDocument outside `refusal()`). The row the plan names "an ASCII-only rule" and the TypeScript-import row are planted in the closest place an assertion can see them (see their sections). Every row ran after the last edit to every test file (212 tests in `test/frame-document.test.ts`, 12 in `test/frame-pure.test.ts`, 26 in `test/frame-mutants.test.ts`); the fix round's 78 rows were all run again after the ruling's change to `src/frame/document.ts` and `test/frame-document.test.ts`, and each gave the same red count and the same failing tests as in the fix round, except L3.M7o, whose two failing tests that change renamed.

**Method** (Global Constraints, "Low disk"; C69, C75). One row at a time, in place in the task's own worktree, never in
parallel and never in a copy of the repository. For each row, the file's original bytes and their sha256 were saved
outside the worktree; each `old` text was checked to occur exactly once and replaced by its `new`. The thread count was
measured (`ps -L -u "$(id -u)" --no-headers | wc -l`) and the row ran as the shell command in its JSON,
`ulimit -u <threads + 1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false <test file> -t "<describes>"`,
exactly as written (the variable is set on the command it applies to), with its output captured to a log named by the
row id. The file was then restored from the saved bytes and its sha256 checked equal (never `git checkout`), and every
file the rows touch was checked against its recorded sha256 after each row; every restore matched. No row mutates a
frame build input, so no row rebuilt the assets; `node scripts/build-frame.mjs --check` exited 0 after the last row.

`-t` selects the describes that hold the row's tests (named in each row's command), so a run does not spend the whole
file (the gate's and the purity rows run `test/frame-pure.test.ts`, which needs no build; the index row runs
`test/frame-mutants.test.ts`); every red is an `AssertionError` in a selected test. The box was loaded (load average
30 to 115 in the fix round, 35 to 38 when measured during this run); an attempt with no assertion failure (a worker killed for memory, a timeout) would be recorded as
environment in the row's JSON (`environment_attempts`) and run again, never counted as red or green. None occurred in
this run.

In the Change column a line break is shown as ` ⏎ ` and a backtick as `ˋ`; the JSON fence holds the exact text.

## L3.M1: the prefix and the skeleton (src/frame/document.ts)

Reference §2. The plan's rows: append the meta; drop the guard; style before the guard; anything between seed and bootstrap; emit content markup. Each is red through `test/frame-document.test.ts`'s L3.M1 skeleton rows and through the frame-mutants describe, whose clean template must still equal a fresh frameDocument output (the library's own M8.3-equivalent scan, `scanPrefix` in `test/frame-scans.ts`). Added by the review's fix round: index.json's sentence telling a consumer to run each mutant against its own row's check (L3.M1f, red through `test/frame-mutants.test.ts`): `seed-raw-line-separators.html` passes the M8.3 and M8.4 checks, so a smoke that runs only those two over every mutant cannot pass (finding C4, Task 12's handoff).

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.M1a | the CSP meta comes first (append the meta) | `src/frame/document.ts`: `return ( ⏎     ˋ<meta http-equiv="Content-Security-Policy" content="${p.policy}">ˋ + ⏎     ˋ<script>${p.guard}</script>ˋ +` → `return ( ⏎     ˋ<script>${p.guard}</script>ˋ +`<br>`src/frame/document.ts`: `(p.mermaid === null ? '' : ˋ<script>${p.mermaid}</script>ˋ) ⏎   );` → `(p.mermaid === null ? '' : ˋ<script>${p.mermaid}</script>ˋ) + ⏎     ˋ<meta http-equiv="Content-Security-Policy" content="${p.policy}">ˋ ⏎   );` | rc 1, 6 failed \| 1 passed \| 205 skipped (212). "plain: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body"; "links and images: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body"; "details and footnotes: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body"; "Mermaid on: the same prefix, then style, enhance and Mermaid, each once" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M1b | the guard is emitted (drop the guard) | `src/frame/document.ts`: `ˋ<script>${p.guard}</script>ˋ + ⏎` → (removed) | rc 1, 6 failed \| 1 passed \| 205 skipped (212). "plain: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body"; "links and images: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body"; "details and footnotes: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body"; "Mermaid on: the same prefix, then style, enhance and Mermaid, each once" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M1c | the guard precedes the style (style before the guard) | `src/frame/document.ts`: `ˋ<script>${p.guard}</script>ˋ + ⏎` → `ˋ<style>${p.css}</style>ˋ + ⏎     ˋ<script>${p.guard}</script>ˋ + ⏎`<br>`src/frame/document.ts`: `ˋ<script>${p.bootstrap}</script>ˋ + ⏎     ˋ<style>${p.css}</style>ˋ + ⏎` → `ˋ<script>${p.bootstrap}</script>ˋ + ⏎` | rc 1, 6 failed \| 1 passed \| 205 skipped (212). "plain: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body"; "links and images: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body"; "details and footnotes: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body"; "Mermaid on: the same prefix, then style, enhance and Mermaid, each once" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M1d | nothing between the seed and the bootstrap | `src/frame/document.ts`: `ˋ<script type="application/json">${p.seed}</script>ˋ + ⏎` → `ˋ<script type="application/json">${p.seed}</script>ˋ + ⏎     '<template></template>' + ⏎` | rc 1, 6 failed \| 1 passed \| 205 skipped (212). "plain: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body"; "links and images: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body"; "details and footnotes: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body"; "Mermaid on: the same prefix, then style, enhance and Mermaid, each once" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M1e | no content markup in the srcdoc (emit content markup) | `src/frame/document.ts`: `const out = srcdoc({ policy: policy as string, guard, seed, bootstrap, css, enhance, mermaid });` → `const out = srcdoc({ policy: policy as string, guard, seed, bootstrap, css, enhance, mermaid }) + ˋ<article lang="${fields.lang}"></article>ˋ;` | rc 1, 6 failed \| 1 passed \| 205 skipped (212). "plain: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body"; "links and images: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body"; "details and footnotes: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body"; "Mermaid on: the same prefix, then style, enhance and Mermaid, each once" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M1f | index.json tells a consumer to run each mutant against its own row's check (drop the sentence) | `conformance/frame-mutants/index.json`: `Check each mutant with its own row's check: a mutant need not fail the other rows' checks (seed-raw-line-separators.html passes the M8.3 and M8.4 checks and fails only M8.8's).` → (removed) | rc 1, 1 failed \| 4 passed \| 21 skipped (26). "a mutant fails its own row's check, not every check: the one that passes M8.3's and M8.4's is named, and index.json tells a consumer to run each mutant against its row's check" | `conformance/frame-mutants/index.json` 45dcf73b5691 restored, equal |

```json
[
  {
    "id": "L3.M1a",
    "guard": "the CSP meta comes first (append the meta)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  return (\n    `<meta http-equiv=\"Content-Security-Policy\" content=\"${p.policy}\">` +\n    `<script>${p.guard}</script>` +",
        "new": "  return (\n    `<script>${p.guard}</script>` +"
      },
      {
        "file": "src/frame/document.ts",
        "old": "    (p.mermaid === null ? '' : `<script>${p.mermaid}</script>`)\n  );",
        "new": "    (p.mermaid === null ? '' : `<script>${p.mermaid}</script>`) +\n    `<meta http-equiv=\"Content-Security-Policy\" content=\"${p.policy}\">`\n  );"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M1 skeleton|^L3\\.M1/M2 the frame mutants\"",
    "rc": 1,
    "red": "6 failed | 1 passed | 205 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M1 skeleton > plain: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body",
      "test/frame-document.test.ts > L3.M1 skeleton > links and images: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body",
      "test/frame-document.test.ts > L3.M1 skeleton > details and footnotes: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body",
      "test/frame-document.test.ts > L3.M1 skeleton > Mermaid on: the same prefix, then style, enhance and Mermaid, each once",
      "test/frame-document.test.ts > L3.M1/M2 the frame mutants: the clean template is this version's frameDocument output, and every mutant fails its row with the real texts > clean.html is the fixture's srcdoc with the policy and each asset as its placeholder (UPDATE_FRAME_MUTANTS=1 rewrites it)",
      "test/frame-document.test.ts > L3.M1/M2 the frame mutants: the clean template is this version's frameDocument output, and every mutant fails its row with the real texts > the fixture's srcdoc, the real clean output, passes every scan"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M1b",
    "guard": "the guard is emitted (drop the guard)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "    `<script>${p.guard}</script>` +\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M1 skeleton|^L3\\.M1/M2 the frame mutants\"",
    "rc": 1,
    "red": "6 failed | 1 passed | 205 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M1 skeleton > plain: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body",
      "test/frame-document.test.ts > L3.M1 skeleton > links and images: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body",
      "test/frame-document.test.ts > L3.M1 skeleton > details and footnotes: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body",
      "test/frame-document.test.ts > L3.M1 skeleton > Mermaid on: the same prefix, then style, enhance and Mermaid, each once",
      "test/frame-document.test.ts > L3.M1/M2 the frame mutants: the clean template is this version's frameDocument output, and every mutant fails its row with the real texts > clean.html is the fixture's srcdoc with the policy and each asset as its placeholder (UPDATE_FRAME_MUTANTS=1 rewrites it)",
      "test/frame-document.test.ts > L3.M1/M2 the frame mutants: the clean template is this version's frameDocument output, and every mutant fails its row with the real texts > the fixture's srcdoc, the real clean output, passes every scan"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M1c",
    "guard": "the guard precedes the style (style before the guard)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "    `<script>${p.guard}</script>` +\n",
        "new": "    `<style>${p.css}</style>` +\n    `<script>${p.guard}</script>` +\n"
      },
      {
        "file": "src/frame/document.ts",
        "old": "    `<script>${p.bootstrap}</script>` +\n    `<style>${p.css}</style>` +\n",
        "new": "    `<script>${p.bootstrap}</script>` +\n"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M1 skeleton|^L3\\.M1/M2 the frame mutants\"",
    "rc": 1,
    "red": "6 failed | 1 passed | 205 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M1 skeleton > plain: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body",
      "test/frame-document.test.ts > L3.M1 skeleton > links and images: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body",
      "test/frame-document.test.ts > L3.M1 skeleton > details and footnotes: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body",
      "test/frame-document.test.ts > L3.M1 skeleton > Mermaid on: the same prefix, then style, enhance and Mermaid, each once",
      "test/frame-document.test.ts > L3.M1/M2 the frame mutants: the clean template is this version's frameDocument output, and every mutant fails its row with the real texts > clean.html is the fixture's srcdoc with the policy and each asset as its placeholder (UPDATE_FRAME_MUTANTS=1 rewrites it)",
      "test/frame-document.test.ts > L3.M1/M2 the frame mutants: the clean template is this version's frameDocument output, and every mutant fails its row with the real texts > the fixture's srcdoc, the real clean output, passes every scan"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M1d",
    "guard": "nothing between the seed and the bootstrap",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "    `<script type=\"application/json\">${p.seed}</script>` +\n",
        "new": "    `<script type=\"application/json\">${p.seed}</script>` +\n    '<template></template>' +\n"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M1 skeleton|^L3\\.M1/M2 the frame mutants\"",
    "rc": 1,
    "red": "6 failed | 1 passed | 205 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M1 skeleton > plain: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body",
      "test/frame-document.test.ts > L3.M1 skeleton > links and images: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body",
      "test/frame-document.test.ts > L3.M1 skeleton > details and footnotes: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body",
      "test/frame-document.test.ts > L3.M1 skeleton > Mermaid on: the same prefix, then style, enhance and Mermaid, each once",
      "test/frame-document.test.ts > L3.M1/M2 the frame mutants: the clean template is this version's frameDocument output, and every mutant fails its row with the real texts > clean.html is the fixture's srcdoc with the policy and each asset as its placeholder (UPDATE_FRAME_MUTANTS=1 rewrites it)",
      "test/frame-document.test.ts > L3.M1/M2 the frame mutants: the clean template is this version's frameDocument output, and every mutant fails its row with the real texts > the fixture's srcdoc, the real clean output, passes every scan"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M1e",
    "guard": "no content markup in the srcdoc (emit content markup)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  const out = srcdoc({ policy: policy as string, guard, seed, bootstrap, css, enhance, mermaid });",
        "new": "  const out = srcdoc({ policy: policy as string, guard, seed, bootstrap, css, enhance, mermaid }) + `<article lang=\"${fields.lang}\"></article>`;"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M1 skeleton|^L3\\.M1/M2 the frame mutants\"",
    "rc": 1,
    "red": "6 failed | 1 passed | 205 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M1 skeleton > plain: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body",
      "test/frame-document.test.ts > L3.M1 skeleton > links and images: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body",
      "test/frame-document.test.ts > L3.M1 skeleton > details and footnotes: the CSP meta first, then guard, seed, bootstrap, style and enhance in the head; an empty body",
      "test/frame-document.test.ts > L3.M1 skeleton > Mermaid on: the same prefix, then style, enhance and Mermaid, each once",
      "test/frame-document.test.ts > L3.M1/M2 the frame mutants: the clean template is this version's frameDocument output, and every mutant fails its row with the real texts > clean.html is the fixture's srcdoc with the policy and each asset as its placeholder (UPDATE_FRAME_MUTANTS=1 rewrites it)",
      "test/frame-document.test.ts > L3.M1/M2 the frame mutants: the clean template is this version's frameDocument output, and every mutant fails its row with the real texts > the fixture's srcdoc, the real clean output, passes every scan"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M1f",
    "guard": "index.json tells a consumer to run each mutant against its own row's check (drop the sentence)",
    "changes": [
      {
        "file": "conformance/frame-mutants/index.json",
        "old": " Check each mutant with its own row's check: a mutant need not fail the other rows' checks (seed-raw-line-separators.html passes the M8.3 and M8.4 checks and fails only M8.8's).",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-mutants.test.ts -t \"^L3\\.M1/M2 mutants: index.json\"",
    "rc": 1,
    "red": "1 failed | 4 passed | 21 skipped (26)",
    "failing": [
      "test/frame-mutants.test.ts > L3.M1/M2 mutants: index.json lists every file, each with the row it must trip > a mutant fails its own row's check, not every check: the one that passes M8.3's and M8.4's is named, and index.json tells a consumer to run each mutant against its row's check"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "conformance/frame-mutants/index.json": "45dcf73b5691a8a8256b81444d137f5f4b934136295a3a4568e8123a9aebb249"
    },
    "restored": true
  }
]
```

## L3.M2: no URL and no authored markup (src/frame/document.ts)

The plan's row: emit the html as markup. Red through the L3.M2 rows (the stripped-body check and `scanUrls`, the library's M8.4-equivalent scan, on documents full of external links and images).

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.M2a | the html travels only in the seed (emit the html as markup) | `src/frame/document.ts`: `const out = srcdoc({ policy: policy as string, guard, seed, bootstrap, css, enhance, mermaid });` → `const out = srcdoc({ policy: policy as string, guard, seed, bootstrap, css, enhance, mermaid }) + html;` | rc 1, 6 failed \| 1 passed \| 205 skipped (212). "plain: with script and style bodies removed, no src, href, srcset, link, base or @import"; "links and images: with script and style bodies removed, no src, href, srcset, link, base or @import"; "details and footnotes: with script and style bodies removed, no src, href, srcset, link, base or @import"; "a document full of external links and images, with its images seeded: no URL outside the script bodies" | `src/frame/document.ts` 6b2664885fca restored, equal |

```json
[
  {
    "id": "L3.M2a",
    "guard": "the html travels only in the seed (emit the html as markup)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  const out = srcdoc({ policy: policy as string, guard, seed, bootstrap, css, enhance, mermaid });",
        "new": "  const out = srcdoc({ policy: policy as string, guard, seed, bootstrap, css, enhance, mermaid }) + html;"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M2|^L3\\.M1/M2 the frame mutants\"",
    "rc": 1,
    "red": "6 failed | 1 passed | 205 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M2 no URL and no authored markup > plain: with script and style bodies removed, no src, href, srcset, link, base or @import",
      "test/frame-document.test.ts > L3.M2 no URL and no authored markup > links and images: with script and style bodies removed, no src, href, srcset, link, base or @import",
      "test/frame-document.test.ts > L3.M2 no URL and no authored markup > details and footnotes: with script and style bodies removed, no src, href, srcset, link, base or @import",
      "test/frame-document.test.ts > L3.M2 no URL and no authored markup > a document full of external links and images, with its images seeded: no URL outside the script bodies",
      "test/frame-document.test.ts > L3.M1/M2 the frame mutants: the clean template is this version's frameDocument output, and every mutant fails its row with the real texts > clean.html is the fixture's srcdoc with the policy and each asset as its placeholder (UPDATE_FRAME_MUTANTS=1 rewrites it)",
      "test/frame-document.test.ts > L3.M1/M2 the frame mutants: the clean template is this version's frameDocument output, and every mutant fails its row with the real texts > the fixture's srcdoc, the real clean output, passes every scan"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  }
]
```

## L3.M5: asset verification (src/frame/document.ts)

The plan's rows: remove the hash check; an ASCII-only rule (red against the real Mermaid file, which holds non-ASCII inside literals). The ASCII-only rule is planted in frameDocument's `verify`, not in `src/frame/bytes.ts`: `bytes.ts` is also bundled by the frame build (`byteRules`), so a rule there fails the in-memory build in `beforeAll` before any row runs, which is a hook error, not an assertion. The byte rules now run before the hash (see the report), so a planted CR, NUL, BOM, `</script` or `<SCRIPT` is named `unsafe-asset` as Reference §4 and the acceptance row ask. Added by the fix round: a supplied `assets.mermaid` is verified with Mermaid off (L3.M5c: verify it only when Mermaid is on; finding C1).

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.M5a | the sha256 check against FRAME_MANIFEST (remove the hash check) | `src/frame/document.ts`: `if (hex(sha256Text(text)) !== m.sha256) throw new FrameError('asset-mismatch', ˋframeDocument: assets.${name} differs from ${m.path}ˋ); ⏎` → `void m; ⏎` | rc 1, 7 failed \| 16 passed \| 189 skipped (212). "one flipped byte in assets.guard: asset-mismatch"; "one flipped byte in assets.bootstrap: asset-mismatch"; "one flipped byte in assets.enhance: asset-mismatch"; "one flipped byte in assets.css: asset-mismatch" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M5b | non-ASCII is allowed in an asset (an ASCII-only rule) | `src/frame/document.ts`: `const hazards = name === 'css' ? cssHazards(text) : scriptHazards(text); ⏎` → `const hazards = name === 'css' ? cssHazards(text) : scriptHazards(text); ⏎   if (/[^\x00-\x7f]/.test(text)) hazards.push('non-ASCII'); ⏎` | rc 1, 5 failed \| 9 passed \| 198 skipped (212). "one flipped byte in assets.enhance: asset-mismatch"; "one flipped byte in assets.css: asset-mismatch"; "one flipped byte in assets.mermaid: asset-mismatch"; "with Mermaid off (absent or null), a supplied assets.mermaid is verified all the same: a flipped byte or a non-string is asset-mismatch" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M5c | a supplied Mermaid asset is verified with Mermaid off (verify it only when Mermaid is on) | `src/frame/document.ts`: `const mermaidText = mermaidAsset === undefined ? null : verify('mermaid', mermaidAsset);` → `const mermaidText = mermaidAsset === undefined ? null : mermaidOptions === null ? (mermaidAsset as string) : verify('mermaid', mermaidAsset);` | rc 1, 1 failed \| 13 passed \| 198 skipped (212). "with Mermaid off (absent or null), a supplied assets.mermaid is verified all the same: a flipped byte or a non-string is asset-mismatch" | `src/frame/document.ts` 6b2664885fca restored, equal |

```json
[
  {
    "id": "L3.M5a",
    "guard": "the sha256 check against FRAME_MANIFEST (remove the hash check)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (hex(sha256Text(text)) !== m.sha256) throw new FrameError('asset-mismatch', `frameDocument: assets.${name} differs from ${m.path}`);\n",
        "new": "  void m;\n"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M5|^L3\\.M7 every refusal code\"",
    "rc": 1,
    "red": "7 failed | 16 passed | 189 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M5 asset verification > one flipped byte in assets.guard: asset-mismatch",
      "test/frame-document.test.ts > L3.M5 asset verification > one flipped byte in assets.bootstrap: asset-mismatch",
      "test/frame-document.test.ts > L3.M5 asset verification > one flipped byte in assets.enhance: asset-mismatch",
      "test/frame-document.test.ts > L3.M5 asset verification > one flipped byte in assets.css: asset-mismatch",
      "test/frame-document.test.ts > L3.M5 asset verification > one flipped byte in assets.mermaid: asset-mismatch",
      "test/frame-document.test.ts > L3.M5 asset verification > with Mermaid off (absent or null), a supplied assets.mermaid is verified all the same: a flipped byte or a non-string is asset-mismatch",
      "test/frame-document.test.ts > L3.M7 every refusal code, each by its own input > asset-mismatch"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M5b",
    "guard": "non-ASCII is allowed in an asset (an ASCII-only rule)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  const hazards = name === 'css' ? cssHazards(text) : scriptHazards(text);\n",
        "new": "  const hazards = name === 'css' ? cssHazards(text) : scriptHazards(text);\n  if (/[^\\x00-\\x7f]/.test(text)) hazards.push('non-ASCII');\n"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M5\"",
    "rc": 1,
    "red": "5 failed | 9 passed | 198 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M5 asset verification > one flipped byte in assets.enhance: asset-mismatch",
      "test/frame-document.test.ts > L3.M5 asset verification > one flipped byte in assets.css: asset-mismatch",
      "test/frame-document.test.ts > L3.M5 asset verification > one flipped byte in assets.mermaid: asset-mismatch",
      "test/frame-document.test.ts > L3.M5 asset verification > with Mermaid off (absent or null), a supplied assets.mermaid is verified all the same: a flipped byte or a non-string is asset-mismatch",
      "test/frame-document.test.ts > L3.M5 asset verification > non-ASCII inside a literal passes: the real Mermaid file holds some and is accepted"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M5c",
    "guard": "a supplied Mermaid asset is verified with Mermaid off (verify it only when Mermaid is on)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  const mermaidText = mermaidAsset === undefined ? null : verify('mermaid', mermaidAsset);",
        "new": "  const mermaidText = mermaidAsset === undefined ? null : mermaidOptions === null ? (mermaidAsset as string) : verify('mermaid', mermaidAsset);"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M5\"",
    "rc": 1,
    "red": "1 failed | 13 passed | 198 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M5 asset verification > with Mermaid off (absent or null), a supplied assets.mermaid is verified all the same: a flipped byte or a non-string is asset-mismatch"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  }
]
```

## L3.M6: the policy (src/frame/document.ts)

Added by the fix round: the policy is read once, and the string checked is the string emitted (L3.M6a: emit a second read of `o.csp`; finding S1). Red through an accessor `csp` that answers the canonical policy on its first read and a markup string on its second.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.M6a | the policy is read once (emit a second read of it) | `src/frame/document.ts`: `policy: policy as string,` → `policy: o.csp,` | rc 1, 1 failed \| 5 passed \| 206 skipped (212). "the policy is read once: a csp that answers otherwise on a second read is emitted exactly as it was checked" | `src/frame/document.ts` 6b2664885fca restored, equal |

```json
[
  {
    "id": "L3.M6a",
    "guard": "the policy is read once (emit a second read of it)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "policy: policy as string,",
        "new": "policy: o.csp,"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M6 policy cross-check\"",
    "rc": 1,
    "red": "1 failed | 5 passed | 206 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M6 policy cross-check > the policy is read once: a csp that answers otherwise on a second read is emitted exactly as it was checked"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  }
]
```

## L3.M7: each refusal code at its boundary, the derived default, the seeded fields and the host-data copy (src/frame/document.ts)

The plan's rows: drop each code's check (L3.M7a to L3.M7i, one per code of Reference §4, L3.M7d the type half of asset-mismatch whose hash half is L3.M5a); accept a limit above the ceiling (L3.M7j Mermaid, L3.M7k maxSrcdocChars); throw on a bad initialHash (L3.M7l); refuse an over-cap html with invalid-input (L3.M7m); accept one escaped character over the cap (L3.M7n); a hand-written literal for MAX_SRCDOC_CHARS_DEFAULT that misses one asset (L3.M7o: 110810133, the derived 114557073 less Mermaid's 3746940 characters; the skeleton term of ruling C92 has its own row, L3.M7ax, in the last section). Added, one per guard this task wrote: maxSrcdocChars' lower bound and integer rule (L3.M7p, L3.M7q); the host-data copy's getter, array-item, plain-object, proto-key, entry-count, length, depth and record rules (L3.M7r to L3.M7x, L3.M7aa, L3.M7aj); the copied field's shape and unknown keys (L3.M7y, L3.M7z); a null kept for the validator rather than folded into a default (L3.M7ab, L3.M7ac); the result, meta and html type checks (L3.M7ad, L3.M7ad2, L3.M7ae); the Mermaid hash required when Mermaid is inlined (L3.M7af); the html cap's unmeasured shortcut (L3.M7ag, observed through a recording wrapper of `escapedHtmlLength`); the bridge's and draw's defaults (L3.M7ah, L3.M7ai). Rows dropping a check that ends in a JavaScript error (a TypeError or a stack overflow) are red as assertions: the test's `refusal()` names any non-FrameError and the row expects a code. Added by the fix round: the copy's count against HOST_VALUES_MAX (L3.M7ak: dropped, a shared-reference structure of 19 arrays is walked down all 2^19 paths; finding S2), the count's derivation (L3.M7al: the front list left out of it, so the largest legal host data is refused), the copy of image and snapshot values, the title and the lang (L3.M7am, L3.M7an, L3.M7ao: passed on uncopied, so the validator walks the shared structure); options and assets that are not objects (L3.M7ap, L3.M7aq: a TypeError where the row expects invalid-input; finding E3); and the guards the first record left unmeasured (finding E5): an undefined value left out of the copy (L3.M7ar), `mermaid.secure`'s default (L3.M7as) and each version default (L3.M7at to L3.M7aw), each mutated to another value the validator accepts so the red is the seeded value, not a refusal.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.M7a | not-rendered | `src/frame/document.ts`: `if (outcome !== 'rendered') throw new FrameError('not-rendered', ˋframeDocument: the document did not render (${String(outcome)})ˋ); ⏎` → (removed) | rc 1, 2 failed \| 66 passed \| 144 skipped (212). "not-rendered"; "outcome 'over-limit', 'output-over-limit' and 'failed': not-rendered" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7b | nonce | `src/frame/document.ts`: `if (!isNonce(o.nonce)) throw new FrameError('nonce', 'frameDocument: the nonce must be 32 lower-case hex digits'); ⏎` → (removed) | rc 1, 2 failed \| 66 passed \| 144 skipped (212). "nonce"; "the nonce: 32 lower-case hex digits pass; 31, 33 and upper-case digits are refused nonce" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7c | invalid-input: the seed through the bootstrap's validator | `src/frame/document.ts`: `if (!check.ok) invalid(ˋthe seed is refused (${check.why})ˋ); ⏎` → `void check; ⏎` | rc 1, 30 failed \| 38 passed \| 144 skipped (212). "invalid-input"; "Mermaid's maxTextSize 50000 and maxEdges 500 pass; 50001 and 501 are invalid-input (a host may only lower them)"; "mermaid.draw: 'on-request' is seeded as given, absent is 'auto', and 'lazy' is invalid-input"; "mermaid.secure is seeded as given; a key outside its grammar or an unknown mermaid key is invalid-input" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7d | asset-mismatch: an asset that is not a string | `src/frame/document.ts`: `if (typeof text !== 'string') throw new FrameError('asset-mismatch', ˋframeDocument: assets.${name} is not a stringˋ); ⏎` → `if (typeof text !== 'string') return text as string; ⏎` | rc 1, 2 failed \| 12 passed \| 198 skipped (212). "an asset that is not a string: asset-mismatch"; "with Mermaid off (absent or null), a supplied assets.mermaid is verified all the same: a flipped byte or a non-string is asset-mismatch" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7e | unsafe-asset | `src/frame/document.ts`: `if (hazards.length > 0) throw new FrameError('unsafe-asset', ˋframeDocument: assets.${name} holds ${hazards.join(', ')}ˋ); ⏎` → (removed) | rc 1, 7 failed \| 16 passed \| 189 skipped (212). "a CR in a script: unsafe-asset, before the hash is read"; "a NUL in a script: unsafe-asset, before the hash is read"; "a BOM in a script: unsafe-asset, before the hash is read"; "</script in a script: unsafe-asset, before the hash is read" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7f | csp | `src/frame/document.ts`: `if (!csp.ok) throw new FrameError('csp', ˋframeDocument: the policy is refused (${csp.why})ˋ); ⏎` → (removed) | rc 1, 16 failed \| 11 passed \| 185 skipped (212). "the enhance hash removed from the policy: csp"; "the Mermaid hash removed while Mermaid is inlined: csp; while it is not: no refusal"; "connect-src * added: csp"; "'unsafe-eval' added: csp" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7g | missing-asset | `src/frame/document.ts`: `if (mermaidOptions !== null && mermaidText === null) throw new FrameError('missing-asset', 'frameDocument: mermaid is on but assets.mermaid is absent'); ⏎` → (removed) | rc 1, 2 failed \| 10 passed \| 200 skipped (212). "missing-asset"; "mermaid on without assets.mermaid: missing-asset; with a flipped byte: asset-mismatch" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7h | too-large: the html cap | `src/frame/document.ts`: `if (html.length > SEED_HTML_MAX_CHARS \|\| escapedHtmlLength(html) > SEED_HTML_MAX_CHARS) {` → `if (false as boolean) {` | rc 1, 2 failed \| 210 skipped (212). "SEED_HTML_MAX_CHARS: an html at the cap as the seed carries it is framed; one escaped character over it, too-large"; "SEED_HTML_MAX_CHARS: an html longer than the cap before escaping is refused too-large without being measured" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7i | too-large: maxSrcdocChars | `src/frame/document.ts`: `if (out.length > (maxSrcdocChars as number)) throw` → `if (false as boolean) throw` | rc 1, 2 failed \| 66 passed \| 144 skipped (212). "too-large"; "maxSrcdocChars: at the output length the string is returned; one under it, too-large" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7j | a Mermaid limit at most its ceiling (accept a limit above the ceiling) | `src/frame/document.ts`: `v > MERMAID_LIMIT_CEILINGS[k]) invalid(` → `v > MERMAID_LIMIT_CEILINGS[k] + 1) invalid(` | rc 1, 1 failed \| 211 skipped (212). "Mermaid's maxTextSize 50000 and maxEdges 500 pass; 50001 and 501 are invalid-input (a host may only lower them)" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7k | maxSrcdocChars at most its default (accept a limit above the ceiling) | `src/frame/document.ts`: `(maxSrcdocChars as number) > MAX_SRCDOC_CHARS_DEFAULT) {` → `(maxSrcdocChars as number) > MAX_SRCDOC_CHARS_DEFAULT + 1) {` | rc 1, 1 failed \| 1 passed \| 210 skipped (212). "maxSrcdocChars: the default passes; above it, or not a positive integer, invalid-input" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7l | an initialHash outside the grammar is seeded as null (throw on a bad initialHash) | `src/frame/document.ts`: `initialHash: isFragmentId(hash) ? hash : null,` → `initialHash: isFragmentId(hash) \|\| hash === null ? hash : invalid('initialHash'),` | rc 1, 3 failed \| 1 passed \| 208 skipped (212). "an initialHash of 'a b' is not refused and is seeded as null; 'D2.1a' and 'fnref1:1' are seeded as given"; "300 code units, the empty string and a non-string give a seed with initialHash null"; "an id outside FRAGMENT_ID_GRAMMAR (a space, a #, a slash, 129 astral letters) is seeded as null, and the seed validates" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7m | an over-cap html is too-large (refuse it with invalid-input) | `src/frame/document.ts`: `throw new FrameError('too-large', ˋframeDocument: the html is over` → `throw new FrameError('invalid-input', ˋframeDocument: the html is over` | rc 1, 2 failed \| 210 skipped (212). "SEED_HTML_MAX_CHARS: an html at the cap as the seed carries it is framed; one escaped character over it, too-large"; "SEED_HTML_MAX_CHARS: an html longer than the cap before escaping is refused too-large without being measured" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7n | the html cap is exact (accept one escaped character over it) | `src/frame/document.ts`: `escapedHtmlLength(html) > SEED_HTML_MAX_CHARS) {` → `escapedHtmlLength(html) > SEED_HTML_MAX_CHARS + 1) {` | rc 1, 1 failed \| 1 passed \| 210 skipped (212). "SEED_HTML_MAX_CHARS: an html at the cap as the seed carries it is framed; one escaped character over it, too-large" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7o | MAX_SRCDOC_CHARS_DEFAULT is derived (a hand-written literal that misses one asset) | `src/frame/document.ts`: `export const MAX_SRCDOC_CHARS_DEFAULT = ⏎   SEED_HTML_MAX_CHARS + ⏎   FRAME_MANIFEST.guard.chars + ⏎   FRAME_MANIFEST.bootstrap.chars + ⏎   FRAME_MANIFEST.enhance.chars + ⏎   FRAME_MANIFEST.css.chars + ⏎   FRAME_MANIFEST.mermaid.chars + ⏎   IMAGE_BUDGET_CHARS + ⏎   SEED_FIELDS_MAX_CHARS + ⏎   SKELETON_MAX_CHARS;` → `export const MAX_SRCDOC_CHARS_DEFAULT = 110810133; ⏎ void [IMAGE_BUDGET_CHARS, SEED_FIELDS_MAX_CHARS, SKELETON_MAX_CHARS];` | rc 1, 2 failed \| 210 skipped (212). "MAX_SRCDOC_CHARS_DEFAULT is SEED_HTML_MAX_CHARS + the five assets' chars + IMAGE_BUDGET_CHARS + SEED_FIELDS_MAX_CHARS + the skeleton at its longest (C92)"; "MAX_SRCDOC_CHARS_DEFAULT and its skeleton term are derived in src/frame/document.ts: neither initialiser holds a numeric literal" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7p | maxSrcdocChars at least 1 | `src/frame/document.ts`: `(maxSrcdocChars as number) < 1 \|\|` → `(maxSrcdocChars as number) < 0 \|\|` | rc 1, 1 failed \| 1 passed \| 210 skipped (212). "maxSrcdocChars: the default passes; above it, or not a positive integer, invalid-input" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7q | maxSrcdocChars an integer | `src/frame/document.ts`: `if (!Number.isInteger(maxSrcdocChars) \|\| (maxSrcdocChars` → `if (typeof maxSrcdocChars !== 'number' \|\| (maxSrcdocChars` | rc 1, 1 failed \| 1 passed \| 210 skipped (212). "maxSrcdocChars: the default passes; above it, or not a positive integer, invalid-input" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7r | a getter in host data is refused unread | `src/frame/document.ts`: `if (!('value' in d)) invalid(ˋ${what}.${k} must be a plain value, not a getterˋ); ⏎` → (removed) | rc 1, 2 failed \| 36 passed \| 174 skipped (212). "host data is read once, as plain data: a getter, a Map, a class instance, a hole and a function are invalid-input"; "a host value whose getter would answer differently on a second read cannot reach the seed: the copy is the seed's" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7s | an array item is read by its own data property, a getter never called | `src/frame/document.ts`: `out.push(dataOf(b, d !== undefined && 'value' in d ? d.value : undefined,` → `out.push(dataOf(b, v[i],` | rc 1, 2 failed \| 36 passed \| 174 skipped (212). "host data is read once, as plain data: a getter, a Map, a class instance, a hole and a function are invalid-input"; "host data that reaches one value down many paths is refused within HOST_VALUES_MAX reads, never copied once per path" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7t | only plain objects are copied (a Map, a class instance) | `src/frame/document.ts`: `if (!isPlainObject(v)) invalid(ˋ${what} must be plain dataˋ); ⏎` → (removed) | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "host data is read once, as plain data: a getter, a Map, a class instance, a hole and a function are invalid-input" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7u | a proto key in structured host data is refused | `src/frame/document.ts`: `if (PROTO_KEYS.includes(k)) invalid(ˋ${what} holds the key ${k}ˋ); ⏎` → (removed) | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "a __proto__, constructor or prototype key in structured host data is invalid-input (an image ref of that name is data)" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7v | a record of more than 512 entries is refused unread | `src/frame/document.ts`: `if (names.length > MAX_ENTRIES) invalid(ˋ${what} has more than ${String(MAX_ENTRIES)} entriesˋ); ⏎` → (removed) | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "a list or record of more than 512 entries is refused before any entry is read" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7w | a list of more than 512 entries, or of no numeric length, is refused unread | `src/frame/document.ts`: `if (typeof n !== 'number' \|\| n > MAX_ENTRIES) invalid(` → `if (typeof n !== 'number') invalid(` | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "a list or record of more than 512 entries is refused before any entry is read" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7w2 | a list whose length is not a number is refused | `src/frame/document.ts`: `if (typeof n !== 'number' \|\| n > MAX_ENTRIES) invalid(` → `if ((n as number) > MAX_ENTRIES) invalid(` | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "a proxy that lists a key it has no property for reads it as absent, and one whose length is not a number is refused" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7x | the depth cap is checked before walking | `src/frame/document.ts`: `if (depth > SEED_LIMITS.depth) invalid(ˋ${what} is nested too deeplyˋ); ⏎` → (removed) | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "a value nested deeper than the seed allows is refused, however deep, without being walked to its end" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7y | a structured field is a plain object after the copy | `src/frame/document.ts`: `if (!isPlainObject(out)) invalid(ˋ${what} must be a plain objectˋ); ⏎   const unknown` → `const unknown` | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "a malformed RenderInput or FrameOptions value is invalid-input, never a crash" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7z | unknown keys of version, mermaid and bridge are refused | `src/frame/document.ts`: `if (unknown.length > 0) invalid(ˋ${what} has unknown keys: ${unknown.join(', ')}ˋ); ⏎` → (removed) | rc 1, 2 failed \| 36 passed \| 174 skipped (212). "an unknown version key: invalid-input"; "an unknown bridge key: invalid-input" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7aa | a record (images, snapshot) is a plain object | `src/frame/document.ts`: `if (v === undefined) return []; ⏎   if (!isPlainObject(v)) invalid(ˋ${what} must be a plain objectˋ); ⏎` → `if (v === undefined) return []; ⏎` | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "host data is read once, as plain data: a getter, a Map, a class instance, a hole and a function are invalid-input" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7ab | a null the host wrote is kept for the validator, never folded into the default | `src/frame/document.ts`: `(Object.hasOwn(f, k) ? f[k] : fallback)` → `(f[k] ?? fallback)` | rc 1, 2 failed \| 36 passed \| 174 skipped (212). "version.draft not a boolean: invalid-input"; "a malformed RenderInput or FrameOptions value is invalid-input, never a crash" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7ac | a null lang is kept for the validator | `src/frame/document.ts`: `lang: r.lang === undefined ? 'en'` → `lang: r.lang == null ? 'en'` | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "a malformed RenderInput or FrameOptions value is invalid-input, never a crash" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7ad | a missing result is invalid-input | `src/frame/document.ts`: `if (typeof result !== 'object' \|\| result === null) invalid('result'); ⏎` → (removed) | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "a malformed RenderInput or FrameOptions value is invalid-input, never a crash" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7ad2 | a missing meta is invalid-input | `src/frame/document.ts`: `if (typeof meta !== 'object' \|\| meta === null) invalid('result.meta'); ⏎` → (removed) | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "a malformed RenderInput or FrameOptions value is invalid-input, never a crash" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7ae | the html is a string | `src/frame/document.ts`: `if (typeof html !== 'string') invalid('result.html'); ⏎` → (removed) | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "a malformed RenderInput or FrameOptions value is invalid-input, never a crash" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7af | the Mermaid hash is required when Mermaid is inlined | `src/frame/document.ts`: `if (mermaid !== null) required.push(FRAME_MANIFEST.mermaid.csp); ⏎` → (removed) | rc 1, 1 failed \| 17 passed \| 194 skipped (212). "the Mermaid hash removed while Mermaid is inlined: csp; while it is not: no refusal" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7ag | the html cap's unmeasured shortcut (a longer string is over whatever it holds) | `src/frame/document.ts`: `if (html.length > SEED_HTML_MAX_CHARS \|\| escapedHtmlLength(html) > SEED_HTML_MAX_CHARS) {` → `if (escapedHtmlLength(html) > SEED_HTML_MAX_CHARS) {` | rc 1, 1 failed \| 1 passed \| 210 skipped (212). "SEED_HTML_MAX_CHARS: an html longer than the cap before escaping is refused too-large without being measured" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7ah | an absent bridge switch is true | `src/frame/document.ts`: `field(f, k, true)` → `field(f, k, false)` | rc 1, 3 failed \| 35 passed \| 174 skipped (212). "every field at a real value is seeded as given, and the seed passes the bootstrap's validator"; "absent fields are seeded at their defaults"; "a value whose key is undefined counts as absent, as JSON writes it" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7ai | an absent draw is auto | `src/frame/document.ts`: `draw: field(f, 'draw', 'auto')` → `draw: field(f, 'draw', 'on-request')` | rc 1, 2 failed \| 41 passed \| 169 skipped (212). "mermaid.draw: 'on-request' is seeded as given, absent is 'auto', and 'lazy' is invalid-input"; "mermaid on: the Mermaid script follows enhance, and the seed carries the caps" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7aj | a listed key with no property reads as absent | `src/frame/document.ts`: `if (d === undefined) continue; ⏎` → (removed) | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "a proxy that lists a key it has no property for reads it as absent, and one whose length is not a number is refused" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7ak | the host-data copy counts values against HOST_VALUES_MAX (drop the count) | `src/frame/document.ts`: `if (b.left < 0) invalid(ˋthe host data holds more than ${String(HOST_VALUES_MAX)} values, more than any seed carries (at ${what})ˋ); ⏎` → (removed) | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "host data that reaches one value down many paths is refused within HOST_VALUES_MAX reads, never copied once per path" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7al | HOST_VALUES_MAX admits the largest legal host data (leave the front list out of it) | `src/frame/document.ts`: `list(L.frontEntries, rec([1, 1, list(L.frontItems, 1)])), ⏎` → (removed) | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "HOST_VALUES_MAX admits the largest host data a seed carries: every list at its cap, copied whole and seeded" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7am | image and snapshot values are copied, and counted (pass them on uncopied) | `src/frame/document.ts`: `return ownEntries(v, what).map(([k, x]) => [k, dataOf(b, x, ˋ${what}[${JSON.stringify(k)}]ˋ, 1)]);` → `return ownEntries(v, what);` | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "host data that reaches one value down many paths is refused within HOST_VALUES_MAX reads, never copied once per path" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7an | the title is copied, and counted (pass it on uncopied) | `src/frame/document.ts`: `title: dataOf(b, meta.title, 'meta.title', 1) as string \| null,` → `title: meta.title,` | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "host data that reaches one value down many paths is refused within HOST_VALUES_MAX reads, never copied once per path" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7ao | the lang is copied, and counted (pass it on uncopied) | `src/frame/document.ts`: `(dataOf(b, r.lang, 'lang', 1) as string)` → `r.lang` | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "host data that reaches one value down many paths is refused within HOST_VALUES_MAX reads, never copied once per path" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7ap | options that are not an object are invalid-input (drop the check) | `src/frame/document.ts`: `if (typeof o !== 'object' \|\| o === null) invalid('options'); ⏎` → (removed) | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "a malformed RenderInput or FrameOptions value is invalid-input, never a crash" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7aq | assets that are not an object are invalid-input (drop the check) | `src/frame/document.ts`: `if (typeof a !== 'object' \|\| a === null) invalid('assets'); ⏎` → (removed) | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "a malformed RenderInput or FrameOptions value is invalid-input, never a crash" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7ar | a property whose value is undefined is left out of the copy (keep it) | `src/frame/document.ts`: `if (d.value !== undefined) out.push([k, d.value as unknown]);` → `out.push([k, d.value as unknown]);` | rc 1, 1 failed \| 37 passed \| 174 skipped (212). "a value whose key is undefined counts as absent, as JSON writes it" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7as | an absent mermaid.secure is [] (another valid default) | `src/frame/document.ts`: `secure: field(f, 'secure', [])` → `secure: field(f, 'secure', ['securityLevel'])` | rc 1, 1 failed \| 41 passed \| 170 skipped (212). "mermaid on: the mermaid object is completed with secure [] and draw 'auto', and the seed passes validateSeed" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7at | an absent version.sha is null (another valid default) | `src/frame/document.ts`: `sha: field(version, 'sha', null) as string \| null,` → `sha: field(version, 'sha', '0'.repeat(40)) as string \| null,` | rc 1, 3 failed \| 39 passed \| 170 skipped (212). "absent fields are seeded at their defaults"; "a value whose key is undefined counts as absent, as JSON writes it"; "mermaid off: exactly SEED_KEYS, each new key at its default, and the seed passes validateSeed" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7au | an absent version.draft is false | `src/frame/document.ts`: `draft: field(version, 'draft', false) as boolean,` → `draft: field(version, 'draft', true) as boolean,` | rc 1, 2 failed \| 40 passed \| 170 skipped (212). "absent fields are seeded at their defaults"; "mermaid off: exactly SEED_KEYS, each new key at its default, and the seed passes validateSeed" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7av | an absent version.commits is null (another valid default) | `src/frame/document.ts`: `commits: field(version, 'commits', null) as Seed['version']['commits'],` → `commits: field(version, 'commits', []) as Seed['version']['commits'],` | rc 1, 3 failed \| 39 passed \| 170 skipped (212). "absent fields are seeded at their defaults"; "a value whose key is undefined counts as absent, as JSON writes it"; "mermaid off: exactly SEED_KEYS, each new key at its default, and the seed passes validateSeed" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M7aw | an absent version.only is null (another valid default) | `src/frame/document.ts`: `only: field(version, 'only', null) as string \| null,` → `only: field(version, 'only', '0'.repeat(40)) as string \| null,` | rc 1, 3 failed \| 39 passed \| 170 skipped (212). "absent fields are seeded at their defaults"; "a value whose key is undefined counts as absent, as JSON writes it"; "mermaid off: exactly SEED_KEYS, each new key at its default, and the seed passes validateSeed" | `src/frame/document.ts` 6b2664885fca restored, equal |

```json
[
  {
    "id": "L3.M7a",
    "guard": "not-rendered",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (outcome !== 'rendered') throw new FrameError('not-rendered', `frameDocument: the document did not render (${String(outcome)})`);\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7\"",
    "rc": 1,
    "red": "2 failed | 66 passed | 144 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 every refusal code, each by its own input > not-rendered",
      "test/frame-document.test.ts > L3.M7 each code at its boundary > outcome 'over-limit', 'output-over-limit' and 'failed': not-rendered"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7b",
    "guard": "nonce",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (!isNonce(o.nonce)) throw new FrameError('nonce', 'frameDocument: the nonce must be 32 lower-case hex digits');\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7\"",
    "rc": 1,
    "red": "2 failed | 66 passed | 144 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 every refusal code, each by its own input > nonce",
      "test/frame-document.test.ts > L3.M7 each code at its boundary > the nonce: 32 lower-case hex digits pass; 31, 33 and upper-case digits are refused nonce"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7c",
    "guard": "invalid-input: the seed through the bootstrap's validator",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (!check.ok) invalid(`the seed is refused (${check.why})`);\n",
        "new": "  void check;\n"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7\"",
    "rc": 1,
    "red": "30 failed | 38 passed | 144 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 every refusal code, each by its own input > invalid-input",
      "test/frame-document.test.ts > L3.M7 each code at its boundary > Mermaid's maxTextSize 50000 and maxEdges 500 pass; 50001 and 501 are invalid-input (a host may only lower them)",
      "test/frame-document.test.ts > L3.M7 each code at its boundary > mermaid.draw: 'on-request' is seeded as given, absent is 'auto', and 'lazy' is invalid-input",
      "test/frame-document.test.ts > L3.M7 each code at its boundary > mermaid.secure is seeded as given; a key outside its grammar or an unknown mermaid key is invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a short version.sha (7 hex): invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > an upper-case version.only: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > version.draft not a boolean: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > 101 commits: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a commit with a short sha: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a commit with a short parent: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > an image that is not a data URL: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > an image of another type: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > an image ref of 2049 code units: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > an image value that is not a string: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a lang outside its grammar: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a pref outside its values: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > an unknown pref: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a snapshot key outside the allow-list: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a snapshot value that is not JSON: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a snapshot value over 64 KiB: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > an unknown feature: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a feature flag that is not a boolean: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > an unknown chrome key: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a vocabulary word list of 201 words: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a bridge switch that is not a boolean: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a title that is not a string: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a frontList entry of the wrong shape: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a malformed RenderInput or FrameOptions value is invalid-input, never a crash",
      "test/frame-document.test.ts > L3.M7 Task 3 the default keys: frameDocument's seed holds every schema 1 key at its default > a lang over 64 code units (grammar-valid) is refused invalid-input, never seeded for the validator to refuse",
      "test/frame-document.test.ts > L3.M7 Task 3 the default keys: frameDocument's seed holds every schema 1 key at its default > meta.title: SEED_LIMITS.titleMaxCodeUnits passes and validates, one more is refused"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7d",
    "guard": "asset-mismatch: an asset that is not a string",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (typeof text !== 'string') throw new FrameError('asset-mismatch', `frameDocument: assets.${name} is not a string`);\n",
        "new": "  if (typeof text !== 'string') return text as string;\n"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M5\"",
    "rc": 1,
    "red": "2 failed | 12 passed | 198 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M5 asset verification > an asset that is not a string: asset-mismatch",
      "test/frame-document.test.ts > L3.M5 asset verification > with Mermaid off (absent or null), a supplied assets.mermaid is verified all the same: a flipped byte or a non-string is asset-mismatch"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7e",
    "guard": "unsafe-asset",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (hazards.length > 0) throw new FrameError('unsafe-asset', `frameDocument: assets.${name} holds ${hazards.join(', ')}`);\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M5|^L3\\.M7 every refusal code\"",
    "rc": 1,
    "red": "7 failed | 16 passed | 189 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M5 asset verification > a CR in a script: unsafe-asset, before the hash is read",
      "test/frame-document.test.ts > L3.M5 asset verification > a NUL in a script: unsafe-asset, before the hash is read",
      "test/frame-document.test.ts > L3.M5 asset verification > a BOM in a script: unsafe-asset, before the hash is read",
      "test/frame-document.test.ts > L3.M5 asset verification > </script in a script: unsafe-asset, before the hash is read",
      "test/frame-document.test.ts > L3.M5 asset verification > <SCRIPT in a script: unsafe-asset, before the hash is read",
      "test/frame-document.test.ts > L3.M5 asset verification > a CR, @import or a remote url( in the stylesheet: unsafe-asset",
      "test/frame-document.test.ts > L3.M7 every refusal code, each by its own input > unsafe-asset"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7f",
    "guard": "csp",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (!csp.ok) throw new FrameError('csp', `frameDocument: the policy is refused (${csp.why})`);\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M6|^L3\\.M7 every refusal code\"",
    "rc": 1,
    "red": "16 failed | 11 passed | 185 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M6 policy cross-check > the enhance hash removed from the policy: csp",
      "test/frame-document.test.ts > L3.M6 policy cross-check > the Mermaid hash removed while Mermaid is inlined: csp; while it is not: no refusal",
      "test/frame-document.test.ts > L3.M6 policy cross-check > connect-src * added: csp",
      "test/frame-document.test.ts > L3.M6 policy cross-check > 'unsafe-eval' added: csp",
      "test/frame-document.test.ts > L3.M6 policy refusals: each rule of checkFrameCsp refuses on its own > img-src https:: refused by its own rule, and frameDocument throws csp",
      "test/frame-document.test.ts > L3.M6 policy refusals: each rule of checkFrameCsp refuses on its own > font-src *: refused by its own rule, and frameDocument throws csp",
      "test/frame-document.test.ts > L3.M6 policy refusals: each rule of checkFrameCsp refuses on its own > style-src https:: refused by its own rule, and frameDocument throws csp",
      "test/frame-document.test.ts > L3.M6 policy refusals: each rule of checkFrameCsp refuses on its own > default-src 'self': refused by its own rule, and frameDocument throws csp",
      "test/frame-document.test.ts > L3.M6 policy refusals: each rule of checkFrameCsp refuses on its own > base-uri missing: refused by its own rule, and frameDocument throws csp",
      "test/frame-document.test.ts > L3.M6 policy refusals: each rule of checkFrameCsp refuses on its own > form-action missing: refused by its own rule, and frameDocument throws csp",
      "test/frame-document.test.ts > L3.M6 policy refusals: each rule of checkFrameCsp refuses on its own > a duplicate script-src: refused by its own rule, and frameDocument throws csp",
      "test/frame-document.test.ts > L3.M6 policy refusals: each rule of checkFrameCsp refuses on its own > an unknown hash of the right form: refused by its own rule, and frameDocument throws csp",
      "test/frame-document.test.ts > L3.M6 policy refusals: each rule of checkFrameCsp refuses on its own > a double quote in a value: refused by its own rule, and frameDocument throws csp",
      "test/frame-document.test.ts > L3.M6 policy refusals: each rule of checkFrameCsp refuses on its own > a character outside printable ASCII: refused by its own rule, and frameDocument throws csp",
      "test/frame-document.test.ts > L3.M6 policy refusals: each rule of checkFrameCsp refuses on its own > over 4096 characters (trailing spaces only): refused by its own rule, and frameDocument throws csp",
      "test/frame-document.test.ts > L3.M7 every refusal code, each by its own input > csp"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7g",
    "guard": "missing-asset",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (mermaidOptions !== null && mermaidText === null) throw new FrameError('missing-asset', 'frameDocument: mermaid is on but assets.mermaid is absent');\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 every refusal code|^L3\\.M8 Mermaid in the skeleton\"",
    "rc": 1,
    "red": "2 failed | 10 passed | 200 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 every refusal code, each by its own input > missing-asset",
      "test/frame-document.test.ts > L3.M8 Mermaid in the skeleton (the prototype's P7) > mermaid on without assets.mermaid: missing-asset; with a flipped byte: asset-mismatch"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7h",
    "guard": "too-large: the html cap",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (html.length > SEED_HTML_MAX_CHARS || escapedHtmlLength(html) > SEED_HTML_MAX_CHARS) {",
        "new": "  if (false as boolean) {"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 each code at its boundary SEED_HTML_MAX_CHARS\"",
    "rc": 1,
    "red": "2 failed | 210 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 each code at its boundary > SEED_HTML_MAX_CHARS: an html at the cap as the seed carries it is framed; one escaped character over it, too-large",
      "test/frame-document.test.ts > L3.M7 each code at its boundary > SEED_HTML_MAX_CHARS: an html longer than the cap before escaping is refused too-large without being measured"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7i",
    "guard": "too-large: maxSrcdocChars",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (out.length > (maxSrcdocChars as number)) throw",
        "new": "  if (false as boolean) throw"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7\"",
    "rc": 1,
    "red": "2 failed | 66 passed | 144 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 every refusal code, each by its own input > too-large",
      "test/frame-document.test.ts > L3.M7 each code at its boundary > maxSrcdocChars: at the output length the string is returned; one under it, too-large"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7j",
    "guard": "a Mermaid limit at most its ceiling (accept a limit above the ceiling)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "v > MERMAID_LIMIT_CEILINGS[k]) invalid(",
        "new": "v > MERMAID_LIMIT_CEILINGS[k] + 1) invalid("
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 each code at its boundary Mermaid\"",
    "rc": 1,
    "red": "1 failed | 211 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 each code at its boundary > Mermaid's maxTextSize 50000 and maxEdges 500 pass; 50001 and 501 are invalid-input (a host may only lower them)"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7k",
    "guard": "maxSrcdocChars at most its default (accept a limit above the ceiling)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "(maxSrcdocChars as number) > MAX_SRCDOC_CHARS_DEFAULT) {",
        "new": "(maxSrcdocChars as number) > MAX_SRCDOC_CHARS_DEFAULT + 1) {"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 each code at its boundary maxSrcdocChars\"",
    "rc": 1,
    "red": "1 failed | 1 passed | 210 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 each code at its boundary > maxSrcdocChars: the default passes; above it, or not a positive integer, invalid-input"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7l",
    "guard": "an initialHash outside the grammar is seeded as null (throw on a bad initialHash)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "    initialHash: isFragmentId(hash) ? hash : null,",
        "new": "    initialHash: isFragmentId(hash) || hash === null ? hash : invalid('initialHash'),"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 each code at its boundary an initialHash|^L3\\.M7 initialHash\"",
    "rc": 1,
    "red": "3 failed | 1 passed | 208 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 each code at its boundary > an initialHash of 'a b' is not refused and is seeded as null; 'D2.1a' and 'fnref1:1' are seeded as given",
      "test/frame-document.test.ts > L3.M7 initialHash: outside FRAGMENT_ID_GRAMMAR it is seeded as null, never refused (ruling R1) > 300 code units, the empty string and a non-string give a seed with initialHash null",
      "test/frame-document.test.ts > L3.M7 initialHash: outside FRAGMENT_ID_GRAMMAR it is seeded as null, never refused (ruling R1) > an id outside FRAGMENT_ID_GRAMMAR (a space, a #, a slash, 129 astral letters) is seeded as null, and the seed validates"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7m",
    "guard": "an over-cap html is too-large (refuse it with invalid-input)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "    throw new FrameError('too-large', `frameDocument: the html is over",
        "new": "    throw new FrameError('invalid-input', `frameDocument: the html is over"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 each code at its boundary SEED_HTML_MAX_CHARS\"",
    "rc": 1,
    "red": "2 failed | 210 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 each code at its boundary > SEED_HTML_MAX_CHARS: an html at the cap as the seed carries it is framed; one escaped character over it, too-large",
      "test/frame-document.test.ts > L3.M7 each code at its boundary > SEED_HTML_MAX_CHARS: an html longer than the cap before escaping is refused too-large without being measured"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7n",
    "guard": "the html cap is exact (accept one escaped character over it)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "escapedHtmlLength(html) > SEED_HTML_MAX_CHARS) {",
        "new": "escapedHtmlLength(html) > SEED_HTML_MAX_CHARS + 1) {"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 each code at its boundary SEED_HTML_MAX_CHARS\"",
    "rc": 1,
    "red": "1 failed | 1 passed | 210 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 each code at its boundary > SEED_HTML_MAX_CHARS: an html at the cap as the seed carries it is framed; one escaped character over it, too-large"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7o",
    "guard": "MAX_SRCDOC_CHARS_DEFAULT is derived (a hand-written literal that misses one asset)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "export const MAX_SRCDOC_CHARS_DEFAULT =\n  SEED_HTML_MAX_CHARS +\n  FRAME_MANIFEST.guard.chars +\n  FRAME_MANIFEST.bootstrap.chars +\n  FRAME_MANIFEST.enhance.chars +\n  FRAME_MANIFEST.css.chars +\n  FRAME_MANIFEST.mermaid.chars +\n  IMAGE_BUDGET_CHARS +\n  SEED_FIELDS_MAX_CHARS +\n  SKELETON_MAX_CHARS;",
        "new": "export const MAX_SRCDOC_CHARS_DEFAULT = 110810133;\nvoid [IMAGE_BUDGET_CHARS, SEED_FIELDS_MAX_CHARS, SKELETON_MAX_CHARS];"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 each code at its boundary MAX_SRCDOC\"",
    "rc": 1,
    "red": "2 failed | 210 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 each code at its boundary > MAX_SRCDOC_CHARS_DEFAULT is SEED_HTML_MAX_CHARS + the five assets' chars + IMAGE_BUDGET_CHARS + SEED_FIELDS_MAX_CHARS + the skeleton at its longest (C92)",
      "test/frame-document.test.ts > L3.M7 each code at its boundary > MAX_SRCDOC_CHARS_DEFAULT and its skeleton term are derived in src/frame/document.ts: neither initialiser holds a numeric literal"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7p",
    "guard": "maxSrcdocChars at least 1",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "(maxSrcdocChars as number) < 1 ||",
        "new": "(maxSrcdocChars as number) < 0 ||"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 each code at its boundary maxSrcdocChars\"",
    "rc": 1,
    "red": "1 failed | 1 passed | 210 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 each code at its boundary > maxSrcdocChars: the default passes; above it, or not a positive integer, invalid-input"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7q",
    "guard": "maxSrcdocChars an integer",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (!Number.isInteger(maxSrcdocChars) || (maxSrcdocChars",
        "new": "  if (typeof maxSrcdocChars !== 'number' || (maxSrcdocChars"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 each code at its boundary maxSrcdocChars\"",
    "rc": 1,
    "red": "1 failed | 1 passed | 210 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 each code at its boundary > maxSrcdocChars: the default passes; above it, or not a positive integer, invalid-input"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7r",
    "guard": "a getter in host data is refused unread",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "    if (!('value' in d)) invalid(`${what}.${k} must be a plain value, not a getter`);\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "2 failed | 36 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > host data is read once, as plain data: a getter, a Map, a class instance, a hole and a function are invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a host value whose getter would answer differently on a second read cannot reach the seed: the copy is the seed's"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7s",
    "guard": "an array item is read by its own data property, a getter never called",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "out.push(dataOf(b, d !== undefined && 'value' in d ? d.value : undefined,",
        "new": "out.push(dataOf(b, v[i],"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "2 failed | 36 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > host data is read once, as plain data: a getter, a Map, a class instance, a hole and a function are invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > host data that reaches one value down many paths is refused within HOST_VALUES_MAX reads, never copied once per path"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7t",
    "guard": "only plain objects are copied (a Map, a class instance)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (!isPlainObject(v)) invalid(`${what} must be plain data`);\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > host data is read once, as plain data: a getter, a Map, a class instance, a hole and a function are invalid-input"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7u",
    "guard": "a proto key in structured host data is refused",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "    if (PROTO_KEYS.includes(k)) invalid(`${what} holds the key ${k}`);\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a __proto__, constructor or prototype key in structured host data is invalid-input (an image ref of that name is data)"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7v",
    "guard": "a record of more than 512 entries is refused unread",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (names.length > MAX_ENTRIES) invalid(`${what} has more than ${String(MAX_ENTRIES)} entries`);\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a list or record of more than 512 entries is refused before any entry is read"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7w",
    "guard": "a list of more than 512 entries, or of no numeric length, is refused unread",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "    if (typeof n !== 'number' || n > MAX_ENTRIES) invalid(",
        "new": "    if (typeof n !== 'number') invalid("
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a list or record of more than 512 entries is refused before any entry is read"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7w2",
    "guard": "a list whose length is not a number is refused",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "    if (typeof n !== 'number' || n > MAX_ENTRIES) invalid(",
        "new": "    if ((n as number) > MAX_ENTRIES) invalid("
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a proxy that lists a key it has no property for reads it as absent, and one whose length is not a number is refused"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7x",
    "guard": "the depth cap is checked before walking",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (depth > SEED_LIMITS.depth) invalid(`${what} is nested too deeply`);\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a value nested deeper than the seed allows is refused, however deep, without being walked to its end"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7y",
    "guard": "a structured field is a plain object after the copy",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (!isPlainObject(out)) invalid(`${what} must be a plain object`);\n  const unknown",
        "new": "  const unknown"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a malformed RenderInput or FrameOptions value is invalid-input, never a crash"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7z",
    "guard": "unknown keys of version, mermaid and bridge are refused",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (unknown.length > 0) invalid(`${what} has unknown keys: ${unknown.join(', ')}`);\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "2 failed | 36 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > an unknown version key: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > an unknown bridge key: invalid-input"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7aa",
    "guard": "a record (images, snapshot) is a plain object",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (v === undefined) return [];\n  if (!isPlainObject(v)) invalid(`${what} must be a plain object`);\n",
        "new": "  if (v === undefined) return [];\n"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > host data is read once, as plain data: a getter, a Map, a class instance, a hole and a function are invalid-input"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7ab",
    "guard": "a null the host wrote is kept for the validator, never folded into the default",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "(Object.hasOwn(f, k) ? f[k] : fallback)",
        "new": "(f[k] ?? fallback)"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "2 failed | 36 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > version.draft not a boolean: invalid-input",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a malformed RenderInput or FrameOptions value is invalid-input, never a crash"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7ac",
    "guard": "a null lang is kept for the validator",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "    lang: r.lang === undefined ? 'en'",
        "new": "    lang: r.lang == null ? 'en'"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a malformed RenderInput or FrameOptions value is invalid-input, never a crash"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7ad",
    "guard": "a missing result is invalid-input",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (typeof result !== 'object' || result === null) invalid('result');\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a malformed RenderInput or FrameOptions value is invalid-input, never a crash"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7ad2",
    "guard": "a missing meta is invalid-input",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (typeof meta !== 'object' || meta === null) invalid('result.meta');\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a malformed RenderInput or FrameOptions value is invalid-input, never a crash"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7ae",
    "guard": "the html is a string",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (typeof html !== 'string') invalid('result.html');\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a malformed RenderInput or FrameOptions value is invalid-input, never a crash"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7af",
    "guard": "the Mermaid hash is required when Mermaid is inlined",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (mermaid !== null) required.push(FRAME_MANIFEST.mermaid.csp);\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M6\"",
    "rc": 1,
    "red": "1 failed | 17 passed | 194 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M6 policy cross-check > the Mermaid hash removed while Mermaid is inlined: csp; while it is not: no refusal"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7ag",
    "guard": "the html cap's unmeasured shortcut (a longer string is over whatever it holds)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (html.length > SEED_HTML_MAX_CHARS || escapedHtmlLength(html) > SEED_HTML_MAX_CHARS) {",
        "new": "  if (escapedHtmlLength(html) > SEED_HTML_MAX_CHARS) {"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 each code at its boundary SEED_HTML_MAX_CHARS\"",
    "rc": 1,
    "red": "1 failed | 1 passed | 210 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 each code at its boundary > SEED_HTML_MAX_CHARS: an html longer than the cap before escaping is refused too-large without being measured"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7ah",
    "guard": "an absent bridge switch is true",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "field(f, k, true)",
        "new": "field(f, k, false)"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "3 failed | 35 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > every field at a real value is seeded as given, and the seed passes the bootstrap's validator",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > absent fields are seeded at their defaults",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a value whose key is undefined counts as absent, as JSON writes it"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7ai",
    "guard": "an absent draw is auto",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "draw: field(f, 'draw', 'auto')",
        "new": "draw: field(f, 'draw', 'on-request')"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version|^L3\\.M7 each code at its boundary mermaid.draw|^L3\\.M8\"",
    "rc": 1,
    "red": "2 failed | 41 passed | 169 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 each code at its boundary > mermaid.draw: 'on-request' is seeded as given, absent is 'auto', and 'lazy' is invalid-input",
      "test/frame-document.test.ts > L3.M8 Mermaid in the skeleton (the prototype's P7) > mermaid on: the Mermaid script follows enhance, and the seed carries the caps"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7aj",
    "guard": "a listed key with no property reads as absent",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "    if (d === undefined) continue;\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a proxy that lists a key it has no property for reads it as absent, and one whose length is not a number is refused"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7ak",
    "guard": "the host-data copy counts values against HOST_VALUES_MAX (drop the count)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (b.left < 0) invalid(`the host data holds more than ${String(HOST_VALUES_MAX)} values, more than any seed carries (at ${what})`);\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > host data that reaches one value down many paths is refused within HOST_VALUES_MAX reads, never copied once per path"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7al",
    "guard": "HOST_VALUES_MAX admits the largest legal host data (leave the front list out of it)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "    list(L.frontEntries, rec([1, 1, list(L.frontItems, 1)])),\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > HOST_VALUES_MAX admits the largest host data a seed carries: every list at its cap, copied whole and seeded"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7am",
    "guard": "image and snapshot values are copied, and counted (pass them on uncopied)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  return ownEntries(v, what).map(([k, x]) => [k, dataOf(b, x, `${what}[${JSON.stringify(k)}]`, 1)]);",
        "new": "  return ownEntries(v, what);"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > host data that reaches one value down many paths is refused within HOST_VALUES_MAX reads, never copied once per path"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7an",
    "guard": "the title is copied, and counted (pass it on uncopied)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "    title: dataOf(b, meta.title, 'meta.title', 1) as string | null,",
        "new": "    title: meta.title,"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > host data that reaches one value down many paths is refused within HOST_VALUES_MAX reads, never copied once per path"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7ao",
    "guard": "the lang is copied, and counted (pass it on uncopied)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "(dataOf(b, r.lang, 'lang', 1) as string)",
        "new": "r.lang"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > host data that reaches one value down many paths is refused within HOST_VALUES_MAX reads, never copied once per path"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7ap",
    "guard": "options that are not an object are invalid-input (drop the check)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (typeof o !== 'object' || o === null) invalid('options');\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a malformed RenderInput or FrameOptions value is invalid-input, never a crash"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7aq",
    "guard": "assets that are not an object are invalid-input (drop the check)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  if (typeof a !== 'object' || a === null) invalid('assets');\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a malformed RenderInput or FrameOptions value is invalid-input, never a crash"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7ar",
    "guard": "a property whose value is undefined is left out of the copy (keep it)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "    if (d.value !== undefined) out.push([k, d.value as unknown]);",
        "new": "    out.push([k, d.value as unknown]);"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 37 passed | 174 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a value whose key is undefined counts as absent, as JSON writes it"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7as",
    "guard": "an absent mermaid.secure is [] (another valid default)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "secure: field(f, 'secure', [])",
        "new": "secure: field(f, 'secure', ['securityLevel'])"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 Task 3 the default keys|^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "1 failed | 41 passed | 170 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 Task 3 the default keys: frameDocument's seed holds every schema 1 key at its default > mermaid on: the mermaid object is completed with secure [] and draw 'auto', and the seed passes validateSeed"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7at",
    "guard": "an absent version.sha is null (another valid default)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "      sha: field(version, 'sha', null) as string | null,",
        "new": "      sha: field(version, 'sha', '0'.repeat(40)) as string | null,"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 Task 3 the default keys|^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "3 failed | 39 passed | 170 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > absent fields are seeded at their defaults",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a value whose key is undefined counts as absent, as JSON writes it",
      "test/frame-document.test.ts > L3.M7 Task 3 the default keys: frameDocument's seed holds every schema 1 key at its default > mermaid off: exactly SEED_KEYS, each new key at its default, and the seed passes validateSeed"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7au",
    "guard": "an absent version.draft is false",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "      draft: field(version, 'draft', false) as boolean,",
        "new": "      draft: field(version, 'draft', true) as boolean,"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 Task 3 the default keys|^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "2 failed | 40 passed | 170 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > absent fields are seeded at their defaults",
      "test/frame-document.test.ts > L3.M7 Task 3 the default keys: frameDocument's seed holds every schema 1 key at its default > mermaid off: exactly SEED_KEYS, each new key at its default, and the seed passes validateSeed"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7av",
    "guard": "an absent version.commits is null (another valid default)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "      commits: field(version, 'commits', null) as Seed['version']['commits'],",
        "new": "      commits: field(version, 'commits', []) as Seed['version']['commits'],"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 Task 3 the default keys|^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "3 failed | 39 passed | 170 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > absent fields are seeded at their defaults",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a value whose key is undefined counts as absent, as JSON writes it",
      "test/frame-document.test.ts > L3.M7 Task 3 the default keys: frameDocument's seed holds every schema 1 key at its default > mermaid off: exactly SEED_KEYS, each new key at its default, and the seed passes validateSeed"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M7aw",
    "guard": "an absent version.only is null (another valid default)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "      only: field(version, 'only', null) as string | null,",
        "new": "      only: field(version, 'only', '0'.repeat(40)) as string | null,"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 Task 3 the default keys|^L3\\.M7 the real version\"",
    "rc": 1,
    "red": "3 failed | 39 passed | 170 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > absent fields are seeded at their defaults",
      "test/frame-document.test.ts > L3.M7 the real version, images, snapshot, features and bridge: seeded as given, refused invalid-input outside their caps > a value whose key is undefined counts as absent, as JSON writes it",
      "test/frame-document.test.ts > L3.M7 Task 3 the default keys: frameDocument's seed holds every schema 1 key at its default > mermaid off: exactly SEED_KEYS, each new key at its default, and the seed passes validateSeed"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  }
]
```

## L3.M8: Mermaid off and the Mermaid gate (src/frame/document.ts, src/frame/gate.ts)

The plan's rows: emit an empty Mermaid script (L3.M8a); gate on the byte counts (L3.M8b: the total read from `totalBytes`, red through eight fences of 16384 three-byte characters, 131072 code units and 393216 bytes); allow a looser cap (L3.M8c). Added, one per gate guard: at least one fence (L3.M8d), at most maxFences (L3.M8e), the counts' type (L3.M8f), unknown caps (L3.M8g), a cap's type (L3.M8h), a getter (L3.M8i), a cap's integer and lower bound (L3.M8j), caps not an object (L3.M8k). Added by the fix round: the verdict ignores the largest fence (L3.M8l: judge it too, which is the plan's other reading of L3.M8; findings C3 and E4, deviation 1 awaiting the coordinator's ruling). If the ruling takes that reading, this mutation becomes the code and the row's assertion flips.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.M8a | no Mermaid script when Mermaid is off (emit an empty Mermaid script) | `src/frame/document.ts`: `(p.mermaid === null ? '' : ˋ<script>${p.mermaid}</script>ˋ)` → `(p.mermaid === null ? '<script></script>' : ˋ<script>${p.mermaid}</script>ˋ)` | rc 1, 1 failed \| 3 passed \| 208 skipped (212). "mermaid null or absent: no Mermaid script (no empty one either), and the seed says null" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M8b | the gate counts code units (gate on the byte counts) | `src/frame/gate.ts`: `(counts['totalChars'] as number) <= (c['maxTotalChars'] as number)` → `((m as unknown as Record<string, number>)['totalBytes'] as number) <= (c['maxTotalChars'] as number)` | rc 1, 1 failed \| 7 passed \| 4 skipped (12). "counts in code units: 8 fences of 16384 three-byte characters (393216 bytes, 131072 code units) inline; one code unit more does not" | `src/frame/gate.ts` 3f6e7f2e186d restored, equal |
| L3.M8c | a gate cap at most its default (allow a looser cap) | `src/frame/gate.ts`: `v > MERMAID_GATE_DEFAULTS[k]) {` → `v > 2 * MERMAID_GATE_DEFAULTS[k]) {` | rc 1, 1 failed \| 7 passed \| 4 skipped (12). "a host cap only tightens: below its default it binds; above it is a RangeError; not an integer from 1, RangeError" | `src/frame/gate.ts` 3f6e7f2e186d restored, equal |
| L3.M8d | no Mermaid without a fence | `src/frame/gate.ts`: `const inline = fences >= 1 && fences` → `const inline = fences` | rc 1, 1 failed \| 7 passed \| 4 skipped (12). "inlines nothing without a fence, and nothing over 24 fences" | `src/frame/gate.ts` 3f6e7f2e186d restored, equal |
| L3.M8e | at most maxFences fences | `src/frame/gate.ts`: `fences <= (c['maxFences'] as number)` → `fences < (c['maxFences'] as number)` | rc 1, 2 failed \| 6 passed \| 4 skipped (12). "inlines nothing without a fence, and nothing over 24 fences"; "a host cap only tightens: below its default it binds; above it is a RangeError; not an integer from 1, RangeError" | `src/frame/gate.ts` 3f6e7f2e186d restored, equal |
| L3.M8f | the counts are non-negative integers | `src/frame/gate.ts`: `if (typeof v !== 'number' \|\| !Number.isSafeInteger(v) \|\| v < 0) throw new TypeError(ˋmermaidGate: counts.${k} must be a non-negative integerˋ); ⏎` → (removed) | rc 1, 1 failed \| 7 passed \| 4 skipped (12). "counts that are not non-negative integers are a TypeError" | `src/frame/gate.ts` 3f6e7f2e186d restored, equal |
| L3.M8g | an unknown cap is a TypeError | `src/frame/gate.ts`: `if (unknown.length > 0) throw new TypeError(ˋmermaidGate: unknown caps: ${unknown.join(', ')}ˋ); ⏎` → (removed) | rc 1, 2 failed \| 6 passed \| 4 skipped (12). "a host cap only tightens: below its default it binds; above it is a RangeError; not an integer from 1, RangeError"; "counts that are not non-negative integers are a TypeError" | `src/frame/gate.ts` 3f6e7f2e186d restored, equal |
| L3.M8h | a cap that is not a number is a TypeError | `src/frame/gate.ts`: `if (typeof v !== 'number') throw new TypeError(ˋmermaidGate: caps.${k} must be a numberˋ); ⏎` → (removed) | rc 1, 1 failed \| 7 passed \| 4 skipped (12). "a host cap only tightens: below its default it binds; above it is a RangeError; not an integer from 1, RangeError" | `src/frame/gate.ts` 3f6e7f2e186d restored, equal |
| L3.M8i | a gate value behind a getter is refused unread | `src/frame/gate.ts`: `if (!('value' in d)) throw new TypeError(ˋmermaidGate: ${where}.${k} must be a plain value, not a getterˋ); ⏎` → (removed) | rc 1, 1 failed \| 7 passed \| 4 skipped (12). "a count or a cap behind a getter is a TypeError, the getter never called" | `src/frame/gate.ts` 3f6e7f2e186d restored, equal |
| L3.M8j | a cap of at least 1, an integer | `src/frame/gate.ts`: `if (!Number.isInteger(v) \|\| v < 1 \|\| v > MERMAID_GATE_DEFAULTS[k]) {` → `if (v > MERMAID_GATE_DEFAULTS[k]) {` | rc 1, 1 failed \| 7 passed \| 4 skipped (12). "a host cap only tightens: below its default it binds; above it is a RangeError; not an integer from 1, RangeError" | `src/frame/gate.ts` 3f6e7f2e186d restored, equal |
| L3.M8k | caps that are not an object are a TypeError | `src/frame/gate.ts`: `if (typeof caps !== 'object' \|\| caps === null) throw new TypeError('mermaidGate: caps must be an object'); ⏎` → (removed) | rc 1, 1 failed \| 7 passed \| 4 skipped (12). "counts that are not non-negative integers are a TypeError" | `src/frame/gate.ts` 3f6e7f2e186d restored, equal |
| L3.M8l | the gate's verdict ignores the largest fence (judge it too, the plan's other reading) | `src/frame/gate.ts`: `(counts['totalChars'] as number) <= (c['maxTotalChars'] as number);` → `(counts['totalChars'] as number) <= (c['maxTotalChars'] as number) && (counts['largestChars'] as number) <= (c['maxFenceChars'] as number);` | rc 1, 2 failed \| 6 passed \| 4 skipped (12). "the verdict ignores the largest fence: a document whose one fence is over the per-fence cap still inlines Mermaid, and the layout shows that fence as its source (deviation 1, the first consumer's spec §4.6)"; "a host cap only tightens: below its default it binds; above it is a RangeError; not an integer from 1, RangeError" | `src/frame/gate.ts` 3f6e7f2e186d restored, equal |

```json
[
  {
    "id": "L3.M8a",
    "guard": "no Mermaid script when Mermaid is off (emit an empty Mermaid script)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "    (p.mermaid === null ? '' : `<script>${p.mermaid}</script>`)",
        "new": "    (p.mermaid === null ? '<script></script>' : `<script>${p.mermaid}</script>`)"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M8\"",
    "rc": 1,
    "red": "1 failed | 3 passed | 208 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M8 Mermaid off > mermaid null or absent: no Mermaid script (no empty one either), and the seed says null"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M8b",
    "guard": "the gate counts code units (gate on the byte counts)",
    "changes": [
      {
        "file": "src/frame/gate.ts",
        "old": "(counts['totalChars'] as number) <= (c['maxTotalChars'] as number)",
        "new": "((m as unknown as Record<string, number>)['totalBytes'] as number) <= (c['maxTotalChars'] as number)"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-pure.test.ts -t \"^L3\\.M8 the Mermaid gate\"",
    "rc": 1,
    "red": "1 failed | 7 passed | 4 skipped (12)",
    "failing": [
      "test/frame-pure.test.ts > L3.M8 the Mermaid gate > counts in code units: 8 fences of 16384 three-byte characters (393216 bytes, 131072 code units) inline; one code unit more does not"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/gate.ts": "3f6e7f2e186d9ec5bca5f094acc6e1d563ebbeba0ded03edbcd122cae85197fe"
    },
    "restored": true
  },
  {
    "id": "L3.M8c",
    "guard": "a gate cap at most its default (allow a looser cap)",
    "changes": [
      {
        "file": "src/frame/gate.ts",
        "old": "v > MERMAID_GATE_DEFAULTS[k]) {",
        "new": "v > 2 * MERMAID_GATE_DEFAULTS[k]) {"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-pure.test.ts -t \"^L3\\.M8 the Mermaid gate\"",
    "rc": 1,
    "red": "1 failed | 7 passed | 4 skipped (12)",
    "failing": [
      "test/frame-pure.test.ts > L3.M8 the Mermaid gate > a host cap only tightens: below its default it binds; above it is a RangeError; not an integer from 1, RangeError"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/gate.ts": "3f6e7f2e186d9ec5bca5f094acc6e1d563ebbeba0ded03edbcd122cae85197fe"
    },
    "restored": true
  },
  {
    "id": "L3.M8d",
    "guard": "no Mermaid without a fence",
    "changes": [
      {
        "file": "src/frame/gate.ts",
        "old": "const inline = fences >= 1 && fences",
        "new": "const inline = fences"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-pure.test.ts -t \"^L3\\.M8 the Mermaid gate\"",
    "rc": 1,
    "red": "1 failed | 7 passed | 4 skipped (12)",
    "failing": [
      "test/frame-pure.test.ts > L3.M8 the Mermaid gate > inlines nothing without a fence, and nothing over 24 fences"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/gate.ts": "3f6e7f2e186d9ec5bca5f094acc6e1d563ebbeba0ded03edbcd122cae85197fe"
    },
    "restored": true
  },
  {
    "id": "L3.M8e",
    "guard": "at most maxFences fences",
    "changes": [
      {
        "file": "src/frame/gate.ts",
        "old": "fences <= (c['maxFences'] as number)",
        "new": "fences < (c['maxFences'] as number)"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-pure.test.ts -t \"^L3\\.M8 the Mermaid gate\"",
    "rc": 1,
    "red": "2 failed | 6 passed | 4 skipped (12)",
    "failing": [
      "test/frame-pure.test.ts > L3.M8 the Mermaid gate > inlines nothing without a fence, and nothing over 24 fences",
      "test/frame-pure.test.ts > L3.M8 the Mermaid gate > a host cap only tightens: below its default it binds; above it is a RangeError; not an integer from 1, RangeError"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/gate.ts": "3f6e7f2e186d9ec5bca5f094acc6e1d563ebbeba0ded03edbcd122cae85197fe"
    },
    "restored": true
  },
  {
    "id": "L3.M8f",
    "guard": "the counts are non-negative integers",
    "changes": [
      {
        "file": "src/frame/gate.ts",
        "old": "    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw new TypeError(`mermaidGate: counts.${k} must be a non-negative integer`);\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-pure.test.ts -t \"^L3\\.M8 the Mermaid gate\"",
    "rc": 1,
    "red": "1 failed | 7 passed | 4 skipped (12)",
    "failing": [
      "test/frame-pure.test.ts > L3.M8 the Mermaid gate > counts that are not non-negative integers are a TypeError"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/gate.ts": "3f6e7f2e186d9ec5bca5f094acc6e1d563ebbeba0ded03edbcd122cae85197fe"
    },
    "restored": true
  },
  {
    "id": "L3.M8g",
    "guard": "an unknown cap is a TypeError",
    "changes": [
      {
        "file": "src/frame/gate.ts",
        "old": "  if (unknown.length > 0) throw new TypeError(`mermaidGate: unknown caps: ${unknown.join(', ')}`);\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-pure.test.ts -t \"^L3\\.M8 the Mermaid gate\"",
    "rc": 1,
    "red": "2 failed | 6 passed | 4 skipped (12)",
    "failing": [
      "test/frame-pure.test.ts > L3.M8 the Mermaid gate > a host cap only tightens: below its default it binds; above it is a RangeError; not an integer from 1, RangeError",
      "test/frame-pure.test.ts > L3.M8 the Mermaid gate > counts that are not non-negative integers are a TypeError"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/gate.ts": "3f6e7f2e186d9ec5bca5f094acc6e1d563ebbeba0ded03edbcd122cae85197fe"
    },
    "restored": true
  },
  {
    "id": "L3.M8h",
    "guard": "a cap that is not a number is a TypeError",
    "changes": [
      {
        "file": "src/frame/gate.ts",
        "old": "    if (typeof v !== 'number') throw new TypeError(`mermaidGate: caps.${k} must be a number`);\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-pure.test.ts -t \"^L3\\.M8 the Mermaid gate\"",
    "rc": 1,
    "red": "1 failed | 7 passed | 4 skipped (12)",
    "failing": [
      "test/frame-pure.test.ts > L3.M8 the Mermaid gate > a host cap only tightens: below its default it binds; above it is a RangeError; not an integer from 1, RangeError"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/gate.ts": "3f6e7f2e186d9ec5bca5f094acc6e1d563ebbeba0ded03edbcd122cae85197fe"
    },
    "restored": true
  },
  {
    "id": "L3.M8i",
    "guard": "a gate value behind a getter is refused unread",
    "changes": [
      {
        "file": "src/frame/gate.ts",
        "old": "  if (!('value' in d)) throw new TypeError(`mermaidGate: ${where}.${k} must be a plain value, not a getter`);\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-pure.test.ts -t \"^L3\\.M8 the Mermaid gate\"",
    "rc": 1,
    "red": "1 failed | 7 passed | 4 skipped (12)",
    "failing": [
      "test/frame-pure.test.ts > L3.M8 the Mermaid gate > a count or a cap behind a getter is a TypeError, the getter never called"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/gate.ts": "3f6e7f2e186d9ec5bca5f094acc6e1d563ebbeba0ded03edbcd122cae85197fe"
    },
    "restored": true
  },
  {
    "id": "L3.M8j",
    "guard": "a cap of at least 1, an integer",
    "changes": [
      {
        "file": "src/frame/gate.ts",
        "old": "    if (!Number.isInteger(v) || v < 1 || v > MERMAID_GATE_DEFAULTS[k]) {",
        "new": "    if (v > MERMAID_GATE_DEFAULTS[k]) {"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-pure.test.ts -t \"^L3\\.M8 the Mermaid gate\"",
    "rc": 1,
    "red": "1 failed | 7 passed | 4 skipped (12)",
    "failing": [
      "test/frame-pure.test.ts > L3.M8 the Mermaid gate > a host cap only tightens: below its default it binds; above it is a RangeError; not an integer from 1, RangeError"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/gate.ts": "3f6e7f2e186d9ec5bca5f094acc6e1d563ebbeba0ded03edbcd122cae85197fe"
    },
    "restored": true
  },
  {
    "id": "L3.M8k",
    "guard": "caps that are not an object are a TypeError",
    "changes": [
      {
        "file": "src/frame/gate.ts",
        "old": "  if (typeof caps !== 'object' || caps === null) throw new TypeError('mermaidGate: caps must be an object');\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-pure.test.ts -t \"^L3\\.M8 the Mermaid gate\"",
    "rc": 1,
    "red": "1 failed | 7 passed | 4 skipped (12)",
    "failing": [
      "test/frame-pure.test.ts > L3.M8 the Mermaid gate > counts that are not non-negative integers are a TypeError"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/gate.ts": "3f6e7f2e186d9ec5bca5f094acc6e1d563ebbeba0ded03edbcd122cae85197fe"
    },
    "restored": true
  },
  {
    "id": "L3.M8l",
    "guard": "the gate's verdict ignores the largest fence (judge it too, the plan's other reading)",
    "changes": [
      {
        "file": "src/frame/gate.ts",
        "old": "(counts['totalChars'] as number) <= (c['maxTotalChars'] as number);",
        "new": "(counts['totalChars'] as number) <= (c['maxTotalChars'] as number) && (counts['largestChars'] as number) <= (c['maxFenceChars'] as number);"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-pure.test.ts -t \"^L3\\.M8 the Mermaid gate\"",
    "rc": 1,
    "red": "2 failed | 6 passed | 4 skipped (12)",
    "failing": [
      "test/frame-pure.test.ts > L3.M8 the Mermaid gate > the verdict ignores the largest fence: a document whose one fence is over the per-fence cap still inlines Mermaid, and the layout shows that fence as its source (deviation 1, the first consumer's spec \u00a74.6)",
      "test/frame-pure.test.ts > L3.M8 the Mermaid gate > a host cap only tightens: below its default it binds; above it is a RangeError; not an integer from 1, RangeError"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/gate.ts": "3f6e7f2e186d9ec5bca5f094acc6e1d563ebbeba0ded03edbcd122cae85197fe"
    },
    "restored": true
  }
]
```

## L3.M9 and L3.M9b: purity and the ./frame import graph (src/frame/document.ts, src/frame/bytes.ts)

The plan's rows: read `Date`, `Math.random` or a global (L3.M9a, L3.M9b2, L3.M9c), each red through the identifier scan of every file in the ./frame import graph; import the TypeScript scanner in `src/frame/bytes.ts` (L3.M9b). L3.M9b plants the import as `import type`: a value import is kept by esbuild under the repository's `verbatimModuleSyntax`, so the frame build, which bundles `bytes.ts` for its byte rules, would fail in `beforeAll` (a hook error, not an assertion); the graph wall reads type-only imports too, so the type form is the import it must catch.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.M9a | no clock (read Date) | `src/frame/document.ts`: `const seed = serializeSeed({ ...fields, html });` → `const seed = serializeSeed({ ...fields, html }); ⏎   void Date.now();` | rc 1, 1 failed \| 1 passed \| 10 skipped (12). "no file of the ./frame import graph names a host, clock, random or locale identifier, or a dynamic import()" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M9b2 | no randomness (read Math.random) | `src/frame/document.ts`: `const seed = serializeSeed({ ...fields, html });` → `const seed = serializeSeed({ ...fields, html }); ⏎   void Math.random();` | rc 1, 1 failed \| 1 passed \| 10 skipped (12). "no file of the ./frame import graph names a host, clock, random or locale identifier, or a dynamic import()" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M9c | no global (read globalThis) | `src/frame/document.ts`: `const seed = serializeSeed({ ...fields, html });` → `const seed = serializeSeed({ ...fields, html }); ⏎   void (globalThis as Record<string, unknown>)['process'];` | rc 1, 1 failed \| 1 passed \| 10 skipped (12). "no file of the ./frame import graph names a host, clock, random or locale identifier, or a dynamic import()" | `src/frame/document.ts` 6b2664885fca restored, equal |
| L3.M9b | ./frame imports no typescript (import the TypeScript scanner in src/frame/bytes.ts, as a type: a value import breaks the frame build itself, which bundles bytes.ts) | `src/frame/bytes.ts`: `/** The hazards of a script's text, by name; empty when it may be inlined. */` → `import type ts from 'typescript'; ⏎  ⏎ /** The hazards of a script's text, by name; empty when it may be inlined. */` | rc 1, 1 failed \| 1 passed \| 10 skipped (12). "every bare specifier names a package of package.json's dependencies; none is typescript or a Node built-in" | `src/frame/bytes.ts` 2396808208e4 restored, equal |

```json
[
  {
    "id": "L3.M9a",
    "guard": "no clock (read Date)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  const seed = serializeSeed({ ...fields, html });",
        "new": "  const seed = serializeSeed({ ...fields, html });\n  void Date.now();"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-pure.test.ts -t \"^L3\\.M9 pure\"",
    "rc": 1,
    "red": "1 failed | 1 passed | 10 skipped (12)",
    "failing": [
      "test/frame-pure.test.ts > L3.M9 pure: no file of the ./frame import graph reads a host, the clock or randomness > no file of the ./frame import graph names a host, clock, random or locale identifier, or a dynamic import()"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M9b2",
    "guard": "no randomness (read Math.random)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  const seed = serializeSeed({ ...fields, html });",
        "new": "  const seed = serializeSeed({ ...fields, html });\n  void Math.random();"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-pure.test.ts -t \"^L3\\.M9 pure\"",
    "rc": 1,
    "red": "1 failed | 1 passed | 10 skipped (12)",
    "failing": [
      "test/frame-pure.test.ts > L3.M9 pure: no file of the ./frame import graph reads a host, the clock or randomness > no file of the ./frame import graph names a host, clock, random or locale identifier, or a dynamic import()"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M9c",
    "guard": "no global (read globalThis)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  const seed = serializeSeed({ ...fields, html });",
        "new": "  const seed = serializeSeed({ ...fields, html });\n  void (globalThis as Record<string, unknown>)['process'];"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-pure.test.ts -t \"^L3\\.M9 pure\"",
    "rc": 1,
    "red": "1 failed | 1 passed | 10 skipped (12)",
    "failing": [
      "test/frame-pure.test.ts > L3.M9 pure: no file of the ./frame import graph reads a host, the clock or randomness > no file of the ./frame import graph names a host, clock, random or locale identifier, or a dynamic import()"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  },
  {
    "id": "L3.M9b",
    "guard": "./frame imports no typescript (import the TypeScript scanner in src/frame/bytes.ts, as a type: a value import breaks the frame build itself, which bundles bytes.ts)",
    "changes": [
      {
        "file": "src/frame/bytes.ts",
        "old": "/** The hazards of a script's text, by name; empty when it may be inlined. */",
        "new": "import type ts from 'typescript';\n\n/** The hazards of a script's text, by name; empty when it may be inlined. */"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-pure.test.ts -t \"^L3\\.M9b\"",
    "rc": 1,
    "red": "1 failed | 1 passed | 10 skipped (12)",
    "failing": [
      "test/frame-pure.test.ts > L3.M9b the ./frame import graph: no typescript, and no bare specifier outside the dependencies > every bare specifier names a package of package.json's dependencies; none is typescript or a Node built-in"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/bytes.ts": "2396808208e4bc6061a672e6dfd64937972185f3c1da0bfaa20c63b9e912bb5e"
    },
    "restored": true
  }
]
```

## Coordinator ruling: the skeleton term (C92)

FD17 promises that no legal document is refused by the default, but `MAX_SRCDOC_CHARS_DEFAULT` left out the skeleton frameDocument writes around its parts: the CSP meta, whose policy may be as long as the floor's bound allows, and the fixed tags and attributes of the guard, seed, bootstrap, style, enhance and Mermaid elements. The ruling adds a named term, derived, never written as a number. `src/frame/document.ts` now writes the skeleton in one place, `srcdoc()`, which frameDocument calls, and `SKELETON_MAX_CHARS` is `srcdoc()` written with every part empty and Mermaid's element present (178 characters today) plus `CSP_MAX_CHARS` (4096, `src/frame/csp-rules.ts`, the floor's own bound): 4274. `MAX_SRCDOC_CHARS_DEFAULT` adds it, so the default moves from 114,552,799 to 114,557,073. The term is internal to `document.ts`: Reference §1 does not name it, and the `./frame` export set is unchanged.

The test (L3.M7, `test/frame-document.test.ts`) does not repeat the implementation: it frames the empty document with Mermaid on under the longest policy the floor admits (`frameCsp()` padded with spaces to `CSP_MAX_CHARS`; one more character is refused `csp`), and subtracts every element's text as parse5 reads it (each asset text checked to be the asset as given, and the seed). What is left is the skeleton at its longest, and the default must equal the five sources with it. A second row scans `document.ts`: neither initialiser holds a numeric literal, the default names `SKELETON_MAX_CHARS`, and the term names `CSP_MAX_CHARS`. Red before the implementation, both through an `AssertionError`: "expected 114552799 to be 114557073" and "SKELETON_MAX_CHARS: expected [ 'SEED_HTML_MAX_CHARS', …(9) ] to include 'SKELETON_MAX_CHARS'".

Moving the skeleton into `srcdoc()` moved the anchors of nine earlier rows, so their changes are restated on the new text, each the same mutation as before: L3.M1a to L3.M1d and L3.M8a plant in `srcdoc()`; L3.M1e and L3.M2a append the same markup and html as before to frameDocument's call of `srcdoc()` (`fields` and `html` are not in `srcdoc()`'s scope); L3.M6a emits `o.csp` in that call; L3.M7o's literal is now 110810133. Each gave the same red count and failing tests as in the fix round.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.M7ax | the default counts the skeleton at its longest (drop the skeleton term, C92) | `src/frame/document.ts`: `SEED_FIELDS_MAX_CHARS + ⏎   SKELETON_MAX_CHARS;` → `SEED_FIELDS_MAX_CHARS;` | rc 1, 2 failed \| 210 skipped (212). "MAX_SRCDOC_CHARS_DEFAULT is SEED_HTML_MAX_CHARS + the five assets' chars + IMAGE_BUDGET_CHARS + SEED_FIELDS_MAX_CHARS + the skeleton at its longest (C92)"; "MAX_SRCDOC_CHARS_DEFAULT and its skeleton term are derived in src/frame/document.ts: neither initialiser holds a numeric literal" | `src/frame/document.ts` 6b2664885fca restored, equal |

```json
[
  {
    "id": "L3.M7ax",
    "guard": "the default counts the skeleton at its longest (drop the skeleton term, C92)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "  SEED_FIELDS_MAX_CHARS +\n  SKELETON_MAX_CHARS;",
        "new": "  SEED_FIELDS_MAX_CHARS;"
      }
    ],
    "command": "ulimit -u <threads+1500>; NODE_OPTIONS=--max-old-space-size=768 timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=1 --fileParallelism=false test/frame-document.test.ts -t \"^L3\\.M7 each code at its boundary MAX_SRCDOC\"",
    "rc": 1,
    "red": "2 failed | 210 skipped (212)",
    "failing": [
      "test/frame-document.test.ts > L3.M7 each code at its boundary > MAX_SRCDOC_CHARS_DEFAULT is SEED_HTML_MAX_CHARS + the five assets' chars + IMAGE_BUDGET_CHARS + SEED_FIELDS_MAX_CHARS + the skeleton at its longest (C92)",
      "test/frame-document.test.ts > L3.M7 each code at its boundary > MAX_SRCDOC_CHARS_DEFAULT and its skeleton term are derived in src/frame/document.ts: neither initialiser holds a numeric literal"
    ],
    "assertion": true,
    "attempts": 1,
    "environment_attempts": [],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "restored": true
  }
]
```
