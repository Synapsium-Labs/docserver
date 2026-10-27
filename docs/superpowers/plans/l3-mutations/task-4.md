# L3 Task 4: mutation rows (the Mermaid frame build)

Each guard Task 4 adds, deleted, inverted or moved once, with the tests that go red. Measured 2026-10-27 on branch
`l3-t04-mermaid-frame`, on its final code (after the review's fix round): `scripts/build-mermaid.mjs` sha256
`41a05456579490271d06f3ad0bae3370322b56046602d53880850f131b84f0a5`, `scripts/mermaid-frame-entry.mjs`
`3143d7a5ef00fe7244380cce9cb687314a3e33d65c42b554b6462558a6c97c98`, `scripts/build-frame.mjs`
`8cd1b1aaa8240e3656dd0c27cba7e3c448057c18cb554180fdb8f26454407295`, `test/mermaid-frame.test.ts`
`9658f5ea47b9b6088a4ff8f10cdc967b1a31a3399af66163de46e5fd88949c91` and `test/browser/mermaid-parity.test.ts`
`0736f484385691c4b6a0e0dbfdbeecd8b799e71baeb1b7502d4135482659cbf7`. Neither the scripts nor the tests changed
between the first row and the last. Every row but L3.B12a went red (exit 1), and in each the failing tests fail on
an assertion: no row failed on setup, a type error or a timeout. Each row's JSON names the failing assertions and
their lines (`at`). Two rows also log errors beside their assertion failures, from the mutant itself: L3.M16b's file
throws `(void 0) is not a function` when it evaluates, and L3.M16m's `mermaid.run()` goes on drawing after the test
has closed its window, which vitest reports as two unhandled rejections.

**Method** (C69, C75, the plan's "Low disk" constraint). In place in the task's worktree, one row at a time: the
original bytes of the three mutated scripts and their sha256 were saved in a scratch directory outside the
worktree first; each row checked that its file still matched the saved sha256, replaced its `old` text (which
occurs exactly once) with its `new` text, and ran

```
ulimit -u <threads + 1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 <tests>
```

with `DOCREADER_BROWSERS=chromium` for the browser rows, where `<threads>` is `ps -L -u "$(id -u)" --no-headers |
wc -l`, measured before each row (the value is in each row's JSON). The file was then rewritten from the saved
bytes, never `git checkout`, and its sha256 compared with the saved one: all 17 restores matched. No row writes a
generated file: both Mermaid builds run in memory inside the tests, so no row needed a rebuild.
`node scripts/build-frame.mjs --check` was green before the first row and after the last.

Rows L3.M16a to L3.M16e and L3.B12b are the plan's; the others are added guards (nothing drawn on the load event
by any route, the frame build's legal comments, the two hazards and the build's refusal of either, the event's
element, frozen detail and bubbling, and `build-frame.mjs` taking the checked build). Locally only Chromium runs
(C69); the browser row is written for both engines through `describeBrowsers`, and WebKit's half is CI's to prove.

## L3.M16: the Mermaid frame file

The plan's five: drop the defines (L3.M16a); put `require` back into the define set (L3.M16b, red because the file
throws on evaluation, `(void 0) is not a function`, as P7 measured, so the jsdom rows see no register event); drop
`startOnLoad = false` (L3.M16c); build as ESM (L3.M16d); and a different `minify` setting on one build (L3.M16e,
red through the read-back of the shared option object).

L3.M16c goes red on the read-back of the API's property, `expect(detail.api.startOnLoad).toBe(false)`, not on a
drawing: that assertion fails first and ends the test before its load-event check runs. The load-event check,
"draws nothing on the load event", has a row of its own, L3.M16m: the entry keeps `startOnLoad = false` but calls
`mermaid.run()` when the window's load event comes, and the test goes red on that check alone
(`waitFor(() => diagrams.some(touched), 1000)` resolves true). The control test shows the same observation sees a
drawing when start-on-load is switched back on.

The two hazards and the build's refusal of either take four rows. L3.M16g and L3.M16h delete one line each from the
predicate `mermaidFrameHazards()`; each goes red twice: in the predicate's own test, and in the build's refusal test,
which builds a fixture root (one frame entry of its own, holding elkjs's signature or a string past 4 MiB) through
the real `buildMermaidFrame()` and expects it to reject. L3.M16n drops the throw from `buildMermaidFrame()` and
L3.M16o weakens it to two hazards; both leave the predicate whole and go red only in the refusal test.

| Row | Guard | File | Change | Exit | Red (tests in the named file) | Restore |
|---|---|---|---|---|---|---|
| L3.M16a | the define set | `scripts/build-mermaid.mjs` | `    define: { ...FREE_DEFINES }, ⏎ ` → (deleted) | 1 | `test/mermaid-frame.test.ts`: 2 failed \| 10 passed (12). "has the define set applied: no `typeof` of a defined-away name is left, where mermaid.mjs has each of five"; "shares one option object with mermaid.mjs: input settings, elk stand-in, target, minification, legal comments and symlinks, read back from both builds". | sha256 matched |
| L3.M16b | `require` stays out of the define set (P-1) | `scripts/build-mermaid.mjs` | `  Bun: 'undefined', ⏎ });` → `  Bun: 'undefined', ⏎   require: 'undefined', ⏎ });` | 1 | `test/mermaid-frame.test.ts`: 4 failed \| 8 passed (12). "defines away exactly the seven names, never `require`, and no `(void 0)(` call is left in the file"; "bundles the same pinned input as mermaid.mjs: the same files but each build's own entry, so the same packages and notices"; "registers once by event on its own script element, start-on-load off, and draws nothing on the load event"; "control: with start-on-load switched back on before the load event, the same file does draw then". | sha256 matched |
| L3.M16c | start-on-load off | `scripts/mermaid-frame-entry.mjs` | `mermaid.startOnLoad = false; ⏎ ` → (deleted) | 1 | `test/mermaid-frame.test.ts`: 1 failed \| 11 passed (12). "registers once by event on its own script element, start-on-load off, and draws nothing on the load event". | sha256 matched |
| L3.M16d | the IIFE format | `scripts/build-mermaid.mjs` | `    format: 'iife', ⏎ ` → `    format: 'esm', ⏎ ` | 1 | `test/mermaid-frame.test.ts`: 3 failed \| 9 passed (12). "is one classic IIFE: the banner, then one call of a function that is not async; no import, export, import.meta or top-level await"; "shares one option object with mermaid.mjs: input settings, elk stand-in, target, minification, legal comments and symlinks, read back from both builds"; "registers once by event on its own script element, start-on-load off, and draws nothing on the load event". | sha256 matched |
| L3.M16e | one shared option object (minify on one build) | `scripts/build-mermaid.mjs` | `    format: 'esm', ⏎ ` → `    format: 'esm', ⏎     minify: false, ⏎ ` | 1 | `test/mermaid-frame.test.ts`: 1 failed \| 11 passed (12). "shares one option object with mermaid.mjs: input settings, elk stand-in, target, minification, legal comments and symlinks, read back from both builds". | sha256 matched |
| L3.M16f (added) | one shared option object (legal comments on the frame build) | `scripts/build-mermaid.mjs` | `    format: 'iife', ⏎ ` → `    format: 'iife', ⏎     legalComments: 'inline', ⏎ ` | 1 | `test/mermaid-frame.test.ts`: 2 failed \| 10 passed (12). "keeps the same legal comments as mermaid.mjs, gathered at its end"; "shares one option object with mermaid.mjs: input settings, elk stand-in, target, minification, legal comments and symlinks, read back from both builds". | sha256 matched |
| L3.M16g (added) | the 4 MiB hazard, in the predicate mermaidFrameHazards() | `scripts/build-mermaid.mjs` | ``   if (bytes > MAX_BYTES) out.push(`${String(bytes)} bytes, over ${String(MAX_BYTES)}`); ⏎  `` → (deleted) | 1 | `test/mermaid-frame.test.ts`: 2 failed \| 10 passed (12). "bundles no elkjs and stays within 4 MiB, and the hazard check names either"; "buildMermaidFrame() refuses a build that bundles elkjs or passes 4 MiB, and resolves a clean one (a fixture root)". | sha256 matched |
| L3.M16h (added) | the elkjs hazard, in the predicate mermaidFrameHazards() | `scripts/build-mermaid.mjs` | `  if (text.includes(ELK_SIGNATURE)) out.push('elkjs is bundled'); ⏎ ` → (deleted) | 1 | `test/mermaid-frame.test.ts`: 2 failed \| 10 passed (12). "bundles no elkjs and stays within 4 MiB, and the hazard check names either"; "buildMermaidFrame() refuses a build that bundles elkjs or passes 4 MiB, and resolves a clean one (a fixture root)". | sha256 matched |
| L3.M16i (added) | the event is dispatched on the file's own element | `scripts/mermaid-frame-entry.mjs` | `  me.dispatchEvent(` → `  document.dispatchEvent(` | 1 | `test/mermaid-frame.test.ts`: 1 failed \| 11 passed (12). "registers once by event on its own script element, start-on-load off, and draws nothing on the load event". | sha256 matched |
| L3.M16j (added) | the detail is frozen | `scripts/mermaid-frame-entry.mjs` | `detail: Object.freeze({ name: 'mermaid', api: mermaid })` → `detail: { name: 'mermaid', api: mermaid }` | 1 | `test/mermaid-frame.test.ts`: 1 failed \| 11 passed (12). "registers once by event on its own script element, start-on-load off, and draws nothing on the load event". | sha256 matched |
| L3.M16k (added) | the event bubbles | `scripts/mermaid-frame-entry.mjs` | `{ bubbles: true, detail:` → `{ bubbles: false, detail:` | 1 | `test/mermaid-frame.test.ts`: 1 failed \| 11 passed (12). "registers once by event on its own script element, start-on-load off, and draws nothing on the load event". | sha256 matched |
| L3.M16l (added) | build-frame takes Mermaid from the checked buildMermaidFrame() | `scripts/build-frame.mjs` | `    mermaid: await buildMermaidFrame(root), ⏎ ` → `    mermaid: (await (await import('./build-mermaid.mjs')).bundleMermaidFrame({ root })).text, ⏎ ` | 1 | `test/mermaid-frame.test.ts`: 1 failed \| 11 passed (12). "is the same text from buildMermaidFrame(), from a second build, and from scripts/build-frame.mjs, which re-exports the define set". | sha256 matched |
| L3.M16m (added) | nothing draws on the load event (start-on-load stays off, the file draws anyway) | `scripts/mermaid-frame-entry.mjs` | `mermaid.startOnLoad = false; ⏎ ` → `mermaid.startOnLoad = false; ⏎ window.addEventListener('load', () => { ⏎   void mermaid.run(); ⏎ }); ⏎ ` | 1 | `test/mermaid-frame.test.ts`: 1 failed \| 11 passed (12). "registers once by event on its own script element, start-on-load off, and draws nothing on the load event". | sha256 matched |
| L3.M16n (added) | buildMermaidFrame() refuses a hazard (the throw dropped) | `scripts/build-mermaid.mjs` | ``   if (hazards.length > 0) throw new Error(`build-mermaid: ${FRAME_OUT_FILE}: ${hazards.join(', ')}`); ⏎  `` → (deleted) | 1 | `test/mermaid-frame.test.ts`: 1 failed \| 11 passed (12). "buildMermaidFrame() refuses a build that bundles elkjs or passes 4 MiB, and resolves a clean one (a fixture root)". | sha256 matched |
| L3.M16o (added) | buildMermaidFrame() refuses a single hazard (the throw weakened to two) | `scripts/build-mermaid.mjs` | `  if (hazards.length > 0) throw` → `  if (hazards.length > 1) throw` | 1 | `test/mermaid-frame.test.ts`: 1 failed \| 11 passed (12). "buildMermaidFrame() refuses a build that bundles elkjs or passes 4 MiB, and resolves a clean one (a fixture root)". | sha256 matched |

```json
[
  {
    "id": "L3.M16a",
    "guard": "the define set",
    "file": "scripts/build-mermaid.mjs",
    "old": "    define: { ...FREE_DEFINES },\n",
    "new": "",
    "tests": "test/mermaid-frame.test.ts",
    "command": "ulimit -u 3349; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/mermaid-frame.test.ts",
    "threads": 1849,
    "exit": 1,
    "result": "2 failed | 10 passed (12)",
    "failed": [
      "has the define set applied: no `typeof` of a defined-away name is left, where mermaid.mjs has each of five",
      "shares one option object with mermaid.mjs: input settings, elk stand-in, target, minification, legal comments and symlinks, read back from both builds"
    ],
    "assertions": [
      "AssertionError: expected { process: 2, global: 4, …(5) } to deeply equal { process: +0, global: +0, …(5) }",
      "AssertionError: expected undefined to deeply equal { process: 'undefined', …(6) }"
    ],
    "at": [
      "test/mermaid-frame.test.ts:167",
      "test/mermaid-frame.test.ts:235"
    ],
    "restored_sha256": "41a05456579490271d06f3ad0bae3370322b56046602d53880850f131b84f0a5",
    "restore_matches": true
  },
  {
    "id": "L3.M16b",
    "guard": "`require` stays out of the define set (P-1)",
    "file": "scripts/build-mermaid.mjs",
    "old": "  Bun: 'undefined',\n});",
    "new": "  Bun: 'undefined',\n  require: 'undefined',\n});",
    "tests": "test/mermaid-frame.test.ts",
    "command": "ulimit -u 3386; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/mermaid-frame.test.ts",
    "threads": 1886,
    "exit": 1,
    "result": "4 failed | 8 passed (12)",
    "failed": [
      "defines away exactly the seven names, never `require`, and no `(void 0)(` call is left in the file",
      "bundles the same pinned input as mermaid.mjs: the same files but each build's own entry, so the same packages and notices",
      "registers once by event on its own script element, start-on-load off, and draws nothing on the load event",
      "control: with start-on-load switched back on before the load event, the same file does draw then"
    ],
    "assertions": [
      "AssertionError: expected [ 'Bun', 'Deno', 'define', …(5) ] to deeply equal [ 'Bun', 'Deno', 'define', …(4) ]",
      "AssertionError: expected [ …(2106) ] to deeply equal [ …(2111) ]",
      "AssertionError: expected +0 to be 1 // Object.is equality",
      "AssertionError: expected +0 to be 1 // Object.is equality"
    ],
    "at": [
      "test/mermaid-frame.test.ts:173",
      "test/mermaid-frame.test.ts:243",
      "test/mermaid-frame.test.ts:375",
      "test/mermaid-frame.test.ts:407"
    ],
    "restored_sha256": "41a05456579490271d06f3ad0bae3370322b56046602d53880850f131b84f0a5",
    "restore_matches": true
  },
  {
    "id": "L3.M16c",
    "guard": "start-on-load off",
    "file": "scripts/mermaid-frame-entry.mjs",
    "old": "mermaid.startOnLoad = false;\n",
    "new": "",
    "tests": "test/mermaid-frame.test.ts",
    "command": "ulimit -u 3387; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/mermaid-frame.test.ts",
    "threads": 1887,
    "exit": 1,
    "result": "1 failed | 11 passed (12)",
    "failed": [
      "registers once by event on its own script element, start-on-load off, and draws nothing on the load event"
    ],
    "assertions": [
      "AssertionError: expected true to be false // Object.is equality"
    ],
    "at": [
      "test/mermaid-frame.test.ts:386"
    ],
    "restored_sha256": "3143d7a5ef00fe7244380cce9cb687314a3e33d65c42b554b6462558a6c97c98",
    "restore_matches": true
  },
  {
    "id": "L3.M16d",
    "guard": "the IIFE format",
    "file": "scripts/build-mermaid.mjs",
    "old": "    format: 'iife',\n",
    "new": "    format: 'esm',\n",
    "tests": "test/mermaid-frame.test.ts",
    "command": "ulimit -u 3351; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/mermaid-frame.test.ts",
    "threads": 1851,
    "exit": 1,
    "result": "3 failed | 9 passed (12)",
    "failed": [
      "is one classic IIFE: the banner, then one call of a function that is not async; no import, export, import.meta or top-level await",
      "shares one option object with mermaid.mjs: input settings, elk stand-in, target, minification, legal comments and symlinks, read back from both builds",
      "registers once by event on its own script element, start-on-load off, and draws nothing on the load event"
    ],
    "assertions": [
      "AssertionError: expected [ 'FirstStatement', …(3536) ] to deeply equal [ 'iife' ]",
      "AssertionError: expected { bundle: true, …(16) } to match object { format: 'iife', …(3) }",
      "AssertionError: expected [ '$$', '$$e', '$0', '$0e', …(8784) ] to deeply equal [ 'fastdom', 'injected' ]"
    ],
    "at": [
      "test/mermaid-frame.test.ts:151",
      "test/mermaid-frame.test.ts:234",
      "test/mermaid-frame.test.ts:392"
    ],
    "restored_sha256": "41a05456579490271d06f3ad0bae3370322b56046602d53880850f131b84f0a5",
    "restore_matches": true
  },
  {
    "id": "L3.M16e",
    "guard": "one shared option object (minify on one build)",
    "file": "scripts/build-mermaid.mjs",
    "old": "    format: 'esm',\n",
    "new": "    format: 'esm',\n    minify: false,\n",
    "tests": "test/mermaid-frame.test.ts",
    "command": "ulimit -u 3377; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/mermaid-frame.test.ts",
    "threads": 1877,
    "exit": 1,
    "result": "1 failed | 11 passed (12)",
    "failed": [
      "shares one option object with mermaid.mjs: input settings, elk stand-in, target, minification, legal comments and symlinks, read back from both builds"
    ],
    "assertions": [
      "AssertionError: assets/mermaid/mermaid.mjs minify: expected false to deeply equal true"
    ],
    "at": [
      "test/mermaid-frame.test.ts:227"
    ],
    "restored_sha256": "41a05456579490271d06f3ad0bae3370322b56046602d53880850f131b84f0a5",
    "restore_matches": true
  },
  {
    "id": "L3.M16f",
    "guard": "one shared option object (legal comments on the frame build)",
    "file": "scripts/build-mermaid.mjs",
    "old": "    format: 'iife',\n",
    "new": "    format: 'iife',\n    legalComments: 'inline',\n",
    "tests": "test/mermaid-frame.test.ts",
    "command": "ulimit -u 3345; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/mermaid-frame.test.ts",
    "threads": 1845,
    "exit": 1,
    "result": "2 failed | 10 passed (12)",
    "failed": [
      "keeps the same legal comments as mermaid.mjs, gathered at its end",
      "shares one option object with mermaid.mjs: input settings, elk stand-in, target, minification, legal comments and symlinks, read back from both builds"
    ],
    "assertions": [
      "AssertionError: expected '' to match /^\\/…/\\*! Bundled license information:\\n",
      "AssertionError: assets/mermaid/mermaid.frame.js legalComments: expected 'inline' to deeply equal 'eof'"
    ],
    "at": [
      "test/mermaid-frame.test.ts:218",
      "test/mermaid-frame.test.ts:227"
    ],
    "restored_sha256": "41a05456579490271d06f3ad0bae3370322b56046602d53880850f131b84f0a5",
    "restore_matches": true
  },
  {
    "id": "L3.M16g",
    "guard": "the 4 MiB hazard, in the predicate mermaidFrameHazards()",
    "file": "scripts/build-mermaid.mjs",
    "old": "  if (bytes > MAX_BYTES) out.push(`${String(bytes)} bytes, over ${String(MAX_BYTES)}`);\n",
    "new": "",
    "tests": "test/mermaid-frame.test.ts",
    "command": "ulimit -u 3433; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/mermaid-frame.test.ts",
    "threads": 1933,
    "exit": 1,
    "result": "2 failed | 10 passed (12)",
    "failed": [
      "bundles no elkjs and stays within 4 MiB, and the hazard check names either",
      "buildMermaidFrame() refuses a build that bundles elkjs or passes 4 MiB, and resolves a clean one (a fixture root)"
    ],
    "assertions": [
      "AssertionError: expected [] to deeply equal [ '4194305 bytes, over 4194304' ]",
      "AssertionError: promise resolved \"'\"use strict\";\\n(()=>{globalThis.x=\"aa…'\" instead of rejecting"
    ],
    "at": [
      "test/mermaid-frame.test.ts:189",
      "test/mermaid-frame.test.ts:208"
    ],
    "restored_sha256": "41a05456579490271d06f3ad0bae3370322b56046602d53880850f131b84f0a5",
    "restore_matches": true
  },
  {
    "id": "L3.M16h",
    "guard": "the elkjs hazard, in the predicate mermaidFrameHazards()",
    "file": "scripts/build-mermaid.mjs",
    "old": "  if (text.includes(ELK_SIGNATURE)) out.push('elkjs is bundled');\n",
    "new": "",
    "tests": "test/mermaid-frame.test.ts",
    "command": "ulimit -u 3394; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/mermaid-frame.test.ts",
    "threads": 1894,
    "exit": 1,
    "result": "2 failed | 10 passed (12)",
    "failed": [
      "bundles no elkjs and stays within 4 MiB, and the hazard check names either",
      "buildMermaidFrame() refuses a build that bundles elkjs or passes 4 MiB, and resolves a clean one (a fixture root)"
    ],
    "assertions": [
      "AssertionError: expected [] to deeply equal [ 'elkjs is bundled' ]",
      "AssertionError: promise resolved \"'\"use strict\";\\n(()=>{globalThis.x=\"or…'\" instead of rejecting"
    ],
    "at": [
      "test/mermaid-frame.test.ts:187",
      "test/mermaid-frame.test.ts:207"
    ],
    "restored_sha256": "41a05456579490271d06f3ad0bae3370322b56046602d53880850f131b84f0a5",
    "restore_matches": true
  },
  {
    "id": "L3.M16i",
    "guard": "the event is dispatched on the file's own element",
    "file": "scripts/mermaid-frame-entry.mjs",
    "old": "  me.dispatchEvent(",
    "new": "  document.dispatchEvent(",
    "tests": "test/mermaid-frame.test.ts",
    "command": "ulimit -u 3437; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/mermaid-frame.test.ts",
    "threads": 1937,
    "exit": 1,
    "result": "1 failed | 11 passed (12)",
    "failed": [
      "registers once by event on its own script element, start-on-load off, and draws nothing on the load event"
    ],
    "assertions": [
      "AssertionError: expected false to be true // Object.is equality"
    ],
    "at": [
      "test/mermaid-frame.test.ts:380"
    ],
    "restored_sha256": "3143d7a5ef00fe7244380cce9cb687314a3e33d65c42b554b6462558a6c97c98",
    "restore_matches": true
  },
  {
    "id": "L3.M16j",
    "guard": "the detail is frozen",
    "file": "scripts/mermaid-frame-entry.mjs",
    "old": "detail: Object.freeze({ name: 'mermaid', api: mermaid })",
    "new": "detail: { name: 'mermaid', api: mermaid }",
    "tests": "test/mermaid-frame.test.ts",
    "command": "ulimit -u 3336; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/mermaid-frame.test.ts",
    "threads": 1836,
    "exit": 1,
    "result": "1 failed | 11 passed (12)",
    "failed": [
      "registers once by event on its own script element, start-on-load off, and draws nothing on the load event"
    ],
    "assertions": [
      "AssertionError: expected false to be true // Object.is equality"
    ],
    "at": [
      "test/mermaid-frame.test.ts:382"
    ],
    "restored_sha256": "3143d7a5ef00fe7244380cce9cb687314a3e33d65c42b554b6462558a6c97c98",
    "restore_matches": true
  },
  {
    "id": "L3.M16k",
    "guard": "the event bubbles",
    "file": "scripts/mermaid-frame-entry.mjs",
    "old": "{ bubbles: true, detail:",
    "new": "{ bubbles: false, detail:",
    "tests": "test/mermaid-frame.test.ts",
    "command": "ulimit -u 3364; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/mermaid-frame.test.ts",
    "threads": 1864,
    "exit": 1,
    "result": "1 failed | 11 passed (12)",
    "failed": [
      "registers once by event on its own script element, start-on-load off, and draws nothing on the load event"
    ],
    "assertions": [
      "AssertionError: expected +0 to be 1 // Object.is equality"
    ],
    "at": [
      "test/mermaid-frame.test.ts:376"
    ],
    "restored_sha256": "3143d7a5ef00fe7244380cce9cb687314a3e33d65c42b554b6462558a6c97c98",
    "restore_matches": true
  },
  {
    "id": "L3.M16l",
    "guard": "build-frame takes Mermaid from the checked buildMermaidFrame()",
    "file": "scripts/build-frame.mjs",
    "old": "    mermaid: await buildMermaidFrame(root),\n",
    "new": "    mermaid: (await (await import('./build-mermaid.mjs')).bundleMermaidFrame({ root })).text,\n",
    "tests": "test/mermaid-frame.test.ts",
    "command": "ulimit -u 3356; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/mermaid-frame.test.ts",
    "threads": 1856,
    "exit": 1,
    "result": "1 failed | 11 passed (12)",
    "failed": [
      "is the same text from buildMermaidFrame(), from a second build, and from scripts/build-frame.mjs, which re-exports the define set"
    ],
    "assertions": [
      "AssertionError: expected '// The sealed reader frame\\'s assets …' to contain 'buildMermaidFrame(root)'"
    ],
    "at": [
      "test/mermaid-frame.test.ts:256"
    ],
    "restored_sha256": "8cd1b1aaa8240e3656dd0c27cba7e3c448057c18cb554180fdb8f26454407295",
    "restore_matches": true
  },
  {
    "id": "L3.M16m",
    "guard": "nothing draws on the load event (start-on-load stays off, the file draws anyway)",
    "file": "scripts/mermaid-frame-entry.mjs",
    "old": "mermaid.startOnLoad = false;\n",
    "new": "mermaid.startOnLoad = false;\nwindow.addEventListener('load', () => {\n  void mermaid.run();\n});\n",
    "tests": "test/mermaid-frame.test.ts",
    "command": "ulimit -u 3421; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/mermaid-frame.test.ts",
    "threads": 1921,
    "exit": 1,
    "result": "1 failed | 11 passed (12)",
    "failed": [
      "registers once by event on its own script element, start-on-load off, and draws nothing on the load event"
    ],
    "assertions": [
      "AssertionError: expected true to be false // Object.is equality"
    ],
    "at": [
      "test/mermaid-frame.test.ts:394"
    ],
    "restored_sha256": "3143d7a5ef00fe7244380cce9cb687314a3e33d65c42b554b6462558a6c97c98",
    "restore_matches": true
  },
  {
    "id": "L3.M16n",
    "guard": "buildMermaidFrame() refuses a hazard (the throw dropped)",
    "file": "scripts/build-mermaid.mjs",
    "old": "  if (hazards.length > 0) throw new Error(`build-mermaid: ${FRAME_OUT_FILE}: ${hazards.join(', ')}`);\n",
    "new": "",
    "tests": "test/mermaid-frame.test.ts",
    "command": "ulimit -u 3326; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/mermaid-frame.test.ts",
    "threads": 1826,
    "exit": 1,
    "result": "1 failed | 11 passed (12)",
    "failed": [
      "buildMermaidFrame() refuses a build that bundles elkjs or passes 4 MiB, and resolves a clean one (a fixture root)"
    ],
    "assertions": [
      "AssertionError: promise resolved \"'\"use strict\";\\n(()=>{globalThis.x=\"or…'\" instead of rejecting"
    ],
    "at": [
      "test/mermaid-frame.test.ts:207"
    ],
    "restored_sha256": "41a05456579490271d06f3ad0bae3370322b56046602d53880850f131b84f0a5",
    "restore_matches": true
  },
  {
    "id": "L3.M16o",
    "guard": "buildMermaidFrame() refuses a single hazard (the throw weakened to two)",
    "file": "scripts/build-mermaid.mjs",
    "old": "  if (hazards.length > 0) throw",
    "new": "  if (hazards.length > 1) throw",
    "tests": "test/mermaid-frame.test.ts",
    "command": "ulimit -u 3333; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/mermaid-frame.test.ts",
    "threads": 1833,
    "exit": 1,
    "result": "1 failed | 11 passed (12)",
    "failed": [
      "buildMermaidFrame() refuses a build that bundles elkjs or passes 4 MiB, and resolves a clean one (a fixture root)"
    ],
    "assertions": [
      "AssertionError: promise resolved \"'\"use strict\";\\n(()=>{globalThis.x=\"or…'\" instead of rejecting"
    ],
    "at": [
      "test/mermaid-frame.test.ts:207"
    ],
    "restored_sha256": "41a05456579490271d06f3ad0bae3370322b56046602d53880850f131b84f0a5",
    "restore_matches": true
  }
]
```

## L3.B12: the two builds draw the same SVG

The plan's B12 mutant is a drawing difference on one build only, made in the frame entry. It names two ways, the
second for when the reader's own `initialize` call overrides the first; the task records which it used.

- **L3.B12a, the first way, stays green, and is not counted as a red row.** The frame entry called
  `mermaid.initialize({ flowchart: { htmlLabels: false } })` after `startOnLoad = false`. Mermaid's `initialize`
  rebuilds the site configuration from Mermaid's defaults before applying its argument (`setSiteConfig` in the
  pinned `mermaid`: `siteConfig = assignWithDepth({}, defaultConfig)`, then the argument), and the reader calls
  `initialize(config)` before every run (`src/enhance/diagrams.ts`), as the parity page does before every diagram.
  So the entry's changed default never reaches a drawing: the reader's call overrides it, which is the plan's
  stated condition for the second way.
- **L3.B12b, the second way, is the row used.** The frame entry wraps `render` so that the SVG text it returns has
  one attribute changed (`aria-roledescription="flowchart-v2"` becomes `aria-roledescription="frame-flowchart-v2"`,
  and likewise for each diagram type). The row goes red: all 20 drawn corpus diagrams differ between the builds,
  each named by its corpus file and position.

A different `minify` setting is not a B12 mutant (minification keeps behaviour); it is L3.M16e.

| Row | Guard | File | Change | Exit | Red (tests in the named file) | Restore |
|---|---|---|---|---|---|---|
| L3.B12a (the plan's first way; green, not counted) | SVG parity (a changed default through initialize) | `scripts/mermaid-frame-entry.mjs` | `mermaid.startOnLoad = false; ⏎ ` → `mermaid.startOnLoad = false; ⏎ mermaid.initialize({ flowchart: { htmlLabels: false } }); ⏎ ` | 0 | `test/browser/mermaid-parity.test.ts`: 1 passed \| 1 skipped (2). Green: see the note below. | sha256 matched |
| L3.B12b | SVG parity (one attribute of the returned SVG changed) | `scripts/mermaid-frame-entry.mjs` | `mermaid.startOnLoad = false; ⏎ ` → `mermaid.startOnLoad = false; ⏎ const draw = mermaid.render; ⏎ mermaid.render = async (...args) => { ⏎   const out = …` | 1 | `test/browser/mermaid-parity.test.ts`: 1 failed \| 1 skipped (2). "L3.B12: the ES module and the classic frame file give equal SVG text for every corpus diagram". | sha256 matched |

```json
[
  {
    "id": "L3.B12a",
    "guard": "SVG parity (a changed default through initialize)",
    "file": "scripts/mermaid-frame-entry.mjs",
    "old": "mermaid.startOnLoad = false;\n",
    "new": "mermaid.startOnLoad = false;\nmermaid.initialize({ flowchart: { htmlLabels: false } });\n",
    "tests": "test/browser/mermaid-parity.test.ts",
    "command": "ulimit -u 3360; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/browser/mermaid-parity.test.ts",
    "threads": 1860,
    "exit": 0,
    "result": "1 passed | 1 skipped (2)",
    "failed": [],
    "assertions": [],
    "at": [],
    "restored_sha256": "3143d7a5ef00fe7244380cce9cb687314a3e33d65c42b554b6462558a6c97c98",
    "restore_matches": true
  },
  {
    "id": "L3.B12b",
    "guard": "SVG parity (one attribute of the returned SVG changed)",
    "file": "scripts/mermaid-frame-entry.mjs",
    "old": "mermaid.startOnLoad = false;\n",
    "new": "mermaid.startOnLoad = false;\nconst draw = mermaid.render;\nmermaid.render = async (...args) => {\n  const out = await draw(...args);\n  return { ...out, svg: out.svg.replace(' aria-roledescription=\"', ' aria-roledescription=\"frame-') };\n};\n",
    "tests": "test/browser/mermaid-parity.test.ts",
    "command": "ulimit -u 3343; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 test/browser/mermaid-parity.test.ts",
    "threads": 1843,
    "exit": 1,
    "result": "1 failed | 1 skipped (2)",
    "failed": [
      "L3.B12: the ES module and the classic frame file give equal SVG text for every corpus diagram"
    ],
    "assertions": [
      "AssertionError: expected [ { …(3) }, { …(3) }, { …(3) }, …(17) ] to deeply equal []"
    ],
    "at": [
      "test/browser/mermaid-parity.test.ts:227"
    ],
    "restored_sha256": "3143d7a5ef00fe7244380cce9cb687314a3e33d65c42b554b6462558a6c97c98",
    "restore_matches": true
  }
]
```
