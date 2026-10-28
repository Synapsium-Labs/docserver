# L3 Task 8: mutation rows (frame browser rows on both engines)

Each guard Task 8's rows stand on, changed once, with the row that goes red: the free-global pin (`src/frame-runtime/pin.ts`, `src/frame-runtime/bootstrap.ts`), the seed's snapshot (`src/frame/document.ts`), the missing-image rewrite (`src/frame-runtime/content.ts`), the frame's storage-free boot (`src/frame-runtime/enhance-entry.ts`), the reader's secure keys and Mermaid limits (`src/enhance/diagrams.ts`), and the on-request ready rule and seed field (`src/frame-runtime/adapters.ts`, `src/frame-runtime/bootstrap.ts`, `src/frame/document.ts`). Measured 2026-10-28 (UTC) on branch `l3-t08-frame-browser` (base `b40a554`, the Task 8 changes not yet committed), first on the test files of the first round (`test/browser/frame-csp.test.ts` `2d515f8edd87…`, `frame-mermaid.test.ts` `71d24234f838…`, `frame-pins.test.ts` `eaa7d12ba1a9…`, `frame-shared.ts` `2b50bc73b8fd…`; the first round's record named `frame-mermaid.test.ts` as `743a10e469ec…`, bytes rewrapped after the runs that no run used and that were not kept), then, after the review's fix round, every row again on the final test files (`frame-boot.test.ts` `64dc55b4b22e…`, `frame-csp.test.ts` `07d0d716fa18…`, `frame-host-page.ts` `175987e5ab20…`, `frame-mermaid.test.ts` `936c34760f31…`, `frame-pins.test.ts` `eaa7d12ba1a9…`, `frame-shared.ts` `d326f25e1e97…`), with the same outcome for every row (the section "Fix round" below). The tables and JSON below are the first round's runs. Every row ran on Chromium only (C69: WebKit cannot start on this box; CI runs every row on both engines).

**Result.** 16 runs: the plan's 10 rows (L3.B3p-a, L3.B3p-b, L3.B8s-a, L3.B2-a, L3.B13-a, L3.B15-a, L3.B15-b, L3.B15-c, L3.D5-a, L3.D5-b), their 2 planted controls, and 4 information runs. 9 of the plan's 10 rows are red, each through an `AssertionError` (every red run exits 1); both controls are green. One row, L3.B3p-b ("pin only absent names"), stays green and is recorded as an **equivalent mutant pending a C-ruling** (its section says why and what was measured); it is not counted red and not dropped. B1 (a control row) and B16 (a measurement row) are recorded, not mutated (the plan's mutation list); L3.B12's shipped-bytes check is a re-run row, not mutated. **L3.B14 is red and awaits the coordinator's ruling** ("Recorded, not mutated" below): the plan's criterion fails in every case once the anchored drawing gets the ids the anchors name, the id prefix the plan prescribes for a red row is not in this change, and so there is no prefix row yet.

**Method** (Global Constraints, "Low disk"; C69, C75). One row at a time, in place in the task's own worktree, never in parallel and never in a copy of the repository, by a runner outside the worktree. For each row: the original bytes of each file it changes, and for a rebuilding row the eight generated outputs (`assets/assets.json`, `src/frame/manifest.generated.ts`, `assets/frame/{guard,bootstrap,enhance}.js`, `assets/frame/reader.css`, `assets/mermaid/{mermaid.frame.js,mermaid.mjs}`), were saved outside the worktree with their sha256; each `old` was checked to occur exactly once and replaced by `new`; a row whose change is a frame build input rebuilt the frame (`node scripts/build-frame.mjs`, because frameDocument verifies every asset against the committed manifest); the thread count was measured (`ps -L -u "$(id -u)" --no-headers | wc -l`, 1550 to 1735 over the runs) and the row ran as the command in its JSON (`ulimit -u <threads + 1500>; timeout -k 10 600 …`), its output captured to a log; every saved file was then restored from the saved bytes and its sha256 checked equal (never `git checkout`). Every restore matched. After the last row, `sha256sum -c` over the changed sources, the generated outputs and the test files matched the hashes taken before the first, and `node scripts/build-frame.mjs --check` exited 0. A run whose failure was not an assertion would have been recorded as environment and run again; none occurred. In the Change column a line break is shown as ⏎ and a backtick as ˋ; the JSON fence holds the exact text.


## L3.B3p: the free-global pins on the integrated build (src/frame-runtime/bootstrap.ts, pin.ts; planted reader in enhance-entry.ts)

Reference §5.5, ruling R2, FD6. The plan's two rows, each measured with a planted lazy reader put into the enhance source (`src/frame-runtime/enhance-entry.ts`) and rebuilt, so the scan lists the name and only the pin decides the row: the reader reads the name when `enhance()` is called (after the content, and so the anchors, exist) and rejects when it reads anything but what the global held, which the bootstrap reports as `error{why:'render'}`. The planted name is `cytoscape`, a name the frame's global lacks, which Mermaid probes and the scan lists; a second set of runs plants a reader of `addEventListener`, a name the global inherits (`-i`). Then the two mutations without any planted reader (`0`), for what the shipped scripts alone show.

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| L3.B3p-control | the planted lazy reader of cytoscape (absent from the frame's global; Mermaid probes it) with the pin intact: the control, green | `src/frame-runtime/enhance-entry.ts`: `const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });` → `const api = Object.freeze({ enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]): Promise<void> => (typeof globalThis.cytoscape === 'undefined' ? enhance(root, options) : Promise.reject(new Error('clobbered'))), setEnhancementPrefs, destroyEnhancement, goToHash });` | rc 0, 0 failed \| 1 passed \| 3 skipped (4) | `src/frame-runtime/enhance-entry.ts` 6651efeb2b6e restored, equal; the generated outputs restored, equal |
| L3.B3p-a | skip pinFreeGlobals, with the planted lazy reader of cytoscape | `src/frame-runtime/enhance-entry.ts`: `const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });` → `const api = Object.freeze({ enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]): Promise<void> => (typeof globalThis.cytoscape === 'undefined' ? enhance(root, options) : Promise.reject(new Error('clobbered'))), setEnhancementPrefs, destroyEnhancement, goToHash });`; `src/frame-runtime/bootstrap.ts`: `pinFreeGlobals(win, DOCSERVER_FREE_GLOBALS); ⏎` → `void DOCSERVER_FREE_GLOBALS; ⏎` | rc 1, 1 failed \| 0 passed \| 3 skipped (4). "L3.B3p: one anchor for every name of the built bootstrap's free-global list: ready with the right nonce, every diagram kind draws as in the clean document, a link routes". AssertionError: expected { …(3) } to deeply equal { …(3) } | `src/frame-runtime/enhance-entry.ts` 6651efeb2b6e, `src/frame-runtime/bootstrap.ts` a6f088df0d7b restored, equal; the generated outputs restored, equal |
| L3.B3p-b | pin only absent names, with the planted lazy reader of cytoscape | `src/frame-runtime/enhance-entry.ts`: `const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });` → `const api = Object.freeze({ enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]): Promise<void> => (typeof globalThis.cytoscape === 'undefined' ? enhance(root, options) : Promise.reject(new Error('clobbered'))), setEnhancementPrefs, destroyEnhancement, goToHash });`; `src/frame-runtime/pin.ts`: `if (hasOwn.call(win, name)) continue; ⏎` → `if (name in win) continue; ⏎` | rc 0, 0 failed \| 1 passed \| 3 skipped (4) | `src/frame-runtime/enhance-entry.ts` 6651efeb2b6e, `src/frame-runtime/pin.ts` f206b0e379ab restored, equal; the generated outputs restored, equal |
| L3.B3p-control-i | the planted lazy reader of addEventListener (inherited) with the pin intact: control | `src/frame-runtime/enhance-entry.ts`: `const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });` → `const api = Object.freeze({ enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]): Promise<void> => (typeof globalThis.addEventListener === 'function' ? enhance(root, options) : Promise.reject(new Error('clobbered'))), setEnhancementPrefs, destroyEnhancement, goToHash });` | rc 0, 0 failed \| 1 passed \| 3 skipped (4) | `src/frame-runtime/enhance-entry.ts` 6651efeb2b6e restored, equal; the generated outputs restored, equal |
| L3.B3p-a-i | skip pinFreeGlobals, with the planted lazy reader of addEventListener (inherited) | `src/frame-runtime/enhance-entry.ts`: `const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });` → `const api = Object.freeze({ enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]): Promise<void> => (typeof globalThis.addEventListener === 'function' ? enhance(root, options) : Promise.reject(new Error('clobbered'))), setEnhancementPrefs, destroyEnhancement, goToHash });`; `src/frame-runtime/bootstrap.ts`: `pinFreeGlobals(win, DOCSERVER_FREE_GLOBALS); ⏎` → `void DOCSERVER_FREE_GLOBALS; ⏎` | rc 1, 1 failed \| 0 passed \| 3 skipped (4). "L3.B3p: one anchor for every name of the built bootstrap's free-global list: ready with the right nonce, every diagram kind draws as in the clean document, a link routes". AssertionError: expected [ 'yes\|no\|Start\|Choice\|Done', …(8) ] to deeply equal [ 'yes\|no\|Start\|Choice\|Done', …(10) ] | `src/frame-runtime/enhance-entry.ts` 6651efeb2b6e, `src/frame-runtime/bootstrap.ts` a6f088df0d7b restored, equal; the generated outputs restored, equal |
| L3.B3p-b-i | pin only absent names, with the planted lazy reader of addEventListener (inherited) | `src/frame-runtime/enhance-entry.ts`: `const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });` → `const api = Object.freeze({ enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]): Promise<void> => (typeof globalThis.addEventListener === 'function' ? enhance(root, options) : Promise.reject(new Error('clobbered'))), setEnhancementPrefs, destroyEnhancement, goToHash });`; `src/frame-runtime/pin.ts`: `if (hasOwn.call(win, name)) continue; ⏎` → `if (name in win) continue; ⏎` | rc 0, 0 failed \| 1 passed \| 3 skipped (4) | `src/frame-runtime/enhance-entry.ts` 6651efeb2b6e, `src/frame-runtime/pin.ts` f206b0e379ab restored, equal; the generated outputs restored, equal |
| L3.B3p-a0 | skip pinFreeGlobals, no planted reader (information: what the shipped scripts alone show) | `src/frame-runtime/bootstrap.ts`: `pinFreeGlobals(win, DOCSERVER_FREE_GLOBALS); ⏎` → `void DOCSERVER_FREE_GLOBALS; ⏎` | rc 1, 1 failed \| 0 passed \| 3 skipped (4). "L3.B3p: one anchor for every name of the built bootstrap's free-global list: ready with the right nonce, every diagram kind draws as in the clean document, a link routes". AssertionError: expected [ 'yes\|no\|Start\|Choice\|Done', …(8) ] to deeply equal [ 'yes\|no\|Start\|Choice\|Done', …(10) ] | `src/frame-runtime/bootstrap.ts` a6f088df0d7b restored, equal; the generated outputs restored, equal |
| L3.B3p-b0 | pin only absent names, no planted reader (information) | `src/frame-runtime/pin.ts`: `if (hasOwn.call(win, name)) continue; ⏎` → `if (name in win) continue; ⏎` | rc 0, 0 failed \| 1 passed \| 3 skipped (4) | `src/frame-runtime/pin.ts` f206b0e379ab restored, equal; the generated outputs restored, equal |

**L3.B3p-b is an equivalent mutant on Chromium (pending a C-ruling).** "Pin only absent names" (`name in win` in place of `hasOwn.call(win, name)`) leaves the inherited names unpinned, and nothing an id can do reaches them: by the HTML standard's named-property visibility rule, an element id names a property of the window only when no object on the window's prototype chain holds that name, so an id `addEventListener` leaves `window.addEventListener` the method (L3.B3p-b-i, measured: green with the inherited reader planted). L3.B3p-a-i shows the same thing from the other side: with no pin at all, the reader of `addEventListener` still never rejected, since its failure is byte for byte L3.B3p-a0's (no reader planted: the pie and the git graph stop drawing), so an id `addEventListener` did not shadow the inherited method. That the planted-reader path runs at all is shown by L3.B3p-a, whose `cytoscape` reader does reject (`error{why:'render'}`); L3.B3p-control-i, with the pin intact, shows only that the reader leaves a clean mount green, not that it is live. Every name an id can shadow is one the global lacks, and that mutation pins every one of those (L3.B3p-b with the `cytoscape` reader, and L3.B3p-b0, both green). Reference §5.3's premise that an id can shadow "anything the global inherits" is therefore not what Chromium does. On WebKit the equivalence is unmeasured, and stays unmeasured after CI: CI's WebKit leg runs the unmutated row only, so the mutant's behaviour there needs someone to run these mutations on a host where WebKit starts. Both points go to the C-ruling request. The pin's own-property check stays as it is. L3.B3p-a (skip the pin) is red with the planted reader through the ready-then-error the reader causes, and red without it (L3.B3p-a0) through two diagram kinds (the pie and the git graph) that no longer draw once Mermaid reads a name an anchor holds.

```json
[
  {
    "id": "L3.B3p-control",
    "guard": "the planted lazy reader of cytoscape (absent from the frame's global; Mermaid probes it) with the pin intact: the control, green",
    "changes": [
      {
        "file": "src/frame-runtime/enhance-entry.ts",
        "old": "  const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });",
        "new": "  const api = Object.freeze({ enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]): Promise<void> => (typeof globalThis.cytoscape === 'undefined' ? enhance(root, options) : Promise.reject(new Error('clobbered'))), setEnhancementPrefs, destroyEnhancement, goToHash });"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-pins.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B3p\"",
    "threads": 1581,
    "rc": 0,
    "result": "0 failed | 1 passed | 3 skipped (4)",
    "failing": [],
    "assertions": [],
    "sha256": {
      "src/frame-runtime/enhance-entry.ts": "6651efeb2b6e7a83fe8b674b6a42ecf2ecf0ae80e1c252d24280505eba90d0df"
    },
    "generated": {
      "assets/assets.json": "b25cd13c81c0886a9652354918f615349f6e6d454df731fe87d9b375bb0a3b9d",
      "src/frame/manifest.generated.ts": "194cb0abb11f0b67d08b4ab192649c26a4a01fa100e8d2367977e5ecf368d8ff",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "8510e846dac491b74d02063f1cda09a55bc84f481833017d4378edbcaceaeb6f",
      "assets/frame/enhance.js": "43a54fdac0a7f8639591651f1d5c3216f3ebcbd05469e2e31ee8bf21e1cad76a",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  },
  {
    "id": "L3.B3p-a",
    "guard": "skip pinFreeGlobals, with the planted lazy reader of cytoscape",
    "changes": [
      {
        "file": "src/frame-runtime/enhance-entry.ts",
        "old": "  const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });",
        "new": "  const api = Object.freeze({ enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]): Promise<void> => (typeof globalThis.cytoscape === 'undefined' ? enhance(root, options) : Promise.reject(new Error('clobbered'))), setEnhancementPrefs, destroyEnhancement, goToHash });"
      },
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "    pinFreeGlobals(win, DOCSERVER_FREE_GLOBALS);\n",
        "new": "    void DOCSERVER_FREE_GLOBALS;\n"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-pins.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B3p\"",
    "threads": 1577,
    "rc": 1,
    "result": "1 failed | 0 passed | 3 skipped (4)",
    "failing": [
      "test/browser/frame-pins.test.ts > chromium > L3.B3p: one anchor for every name of the built bootstrap's free-global list: ready with the right nonce, every diagram kind draws as in the clean document, a link routes"
    ],
    "assertions": [
      "AssertionError: expected { …(3) } to deeply equal { …(3) }"
    ],
    "sha256": {
      "src/frame-runtime/enhance-entry.ts": "6651efeb2b6e7a83fe8b674b6a42ecf2ecf0ae80e1c252d24280505eba90d0df",
      "src/frame-runtime/bootstrap.ts": "a6f088df0d7b815c80b183a9d790710c9edcb945884b925869d5f37901039c68"
    },
    "generated": {
      "assets/assets.json": "b25cd13c81c0886a9652354918f615349f6e6d454df731fe87d9b375bb0a3b9d",
      "src/frame/manifest.generated.ts": "194cb0abb11f0b67d08b4ab192649c26a4a01fa100e8d2367977e5ecf368d8ff",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "8510e846dac491b74d02063f1cda09a55bc84f481833017d4378edbcaceaeb6f",
      "assets/frame/enhance.js": "43a54fdac0a7f8639591651f1d5c3216f3ebcbd05469e2e31ee8bf21e1cad76a",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  },
  {
    "id": "L3.B3p-b",
    "guard": "pin only absent names, with the planted lazy reader of cytoscape",
    "changes": [
      {
        "file": "src/frame-runtime/enhance-entry.ts",
        "old": "  const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });",
        "new": "  const api = Object.freeze({ enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]): Promise<void> => (typeof globalThis.cytoscape === 'undefined' ? enhance(root, options) : Promise.reject(new Error('clobbered'))), setEnhancementPrefs, destroyEnhancement, goToHash });"
      },
      {
        "file": "src/frame-runtime/pin.ts",
        "old": "    if (hasOwn.call(win, name)) continue;\n",
        "new": "    if (name in win) continue;\n"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-pins.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B3p\"",
    "threads": 1580,
    "rc": 0,
    "result": "0 failed | 1 passed | 3 skipped (4)",
    "failing": [],
    "assertions": [],
    "sha256": {
      "src/frame-runtime/enhance-entry.ts": "6651efeb2b6e7a83fe8b674b6a42ecf2ecf0ae80e1c252d24280505eba90d0df",
      "src/frame-runtime/pin.ts": "f206b0e379ab23c83e8dae7a1a7253f618aab1eb11692178563a235e22a2e031"
    },
    "generated": {
      "assets/assets.json": "b25cd13c81c0886a9652354918f615349f6e6d454df731fe87d9b375bb0a3b9d",
      "src/frame/manifest.generated.ts": "194cb0abb11f0b67d08b4ab192649c26a4a01fa100e8d2367977e5ecf368d8ff",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "8510e846dac491b74d02063f1cda09a55bc84f481833017d4378edbcaceaeb6f",
      "assets/frame/enhance.js": "43a54fdac0a7f8639591651f1d5c3216f3ebcbd05469e2e31ee8bf21e1cad76a",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  },
  {
    "id": "L3.B3p-control-i",
    "guard": "the planted lazy reader of addEventListener (inherited) with the pin intact: control",
    "changes": [
      {
        "file": "src/frame-runtime/enhance-entry.ts",
        "old": "  const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });",
        "new": "  const api = Object.freeze({ enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]): Promise<void> => (typeof globalThis.addEventListener === 'function' ? enhance(root, options) : Promise.reject(new Error('clobbered'))), setEnhancementPrefs, destroyEnhancement, goToHash });"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-pins.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B3p\"",
    "threads": 1581,
    "rc": 0,
    "result": "0 failed | 1 passed | 3 skipped (4)",
    "failing": [],
    "assertions": [],
    "sha256": {
      "src/frame-runtime/enhance-entry.ts": "6651efeb2b6e7a83fe8b674b6a42ecf2ecf0ae80e1c252d24280505eba90d0df"
    },
    "generated": {
      "assets/assets.json": "b25cd13c81c0886a9652354918f615349f6e6d454df731fe87d9b375bb0a3b9d",
      "src/frame/manifest.generated.ts": "194cb0abb11f0b67d08b4ab192649c26a4a01fa100e8d2367977e5ecf368d8ff",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "8510e846dac491b74d02063f1cda09a55bc84f481833017d4378edbcaceaeb6f",
      "assets/frame/enhance.js": "43a54fdac0a7f8639591651f1d5c3216f3ebcbd05469e2e31ee8bf21e1cad76a",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  },
  {
    "id": "L3.B3p-a-i",
    "guard": "skip pinFreeGlobals, with the planted lazy reader of addEventListener (inherited)",
    "changes": [
      {
        "file": "src/frame-runtime/enhance-entry.ts",
        "old": "  const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });",
        "new": "  const api = Object.freeze({ enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]): Promise<void> => (typeof globalThis.addEventListener === 'function' ? enhance(root, options) : Promise.reject(new Error('clobbered'))), setEnhancementPrefs, destroyEnhancement, goToHash });"
      },
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "    pinFreeGlobals(win, DOCSERVER_FREE_GLOBALS);\n",
        "new": "    void DOCSERVER_FREE_GLOBALS;\n"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-pins.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B3p\"",
    "threads": 1635,
    "rc": 1,
    "result": "1 failed | 0 passed | 3 skipped (4)",
    "failing": [
      "test/browser/frame-pins.test.ts > chromium > L3.B3p: one anchor for every name of the built bootstrap's free-global list: ready with the right nonce, every diagram kind draws as in the clean document, a link routes"
    ],
    "assertions": [
      "AssertionError: expected [ 'yes|no|Start|Choice|Done', …(8) ] to deeply equal [ 'yes|no|Start|Choice|Done', …(10) ]"
    ],
    "sha256": {
      "src/frame-runtime/enhance-entry.ts": "6651efeb2b6e7a83fe8b674b6a42ecf2ecf0ae80e1c252d24280505eba90d0df",
      "src/frame-runtime/bootstrap.ts": "a6f088df0d7b815c80b183a9d790710c9edcb945884b925869d5f37901039c68"
    },
    "generated": {
      "assets/assets.json": "b25cd13c81c0886a9652354918f615349f6e6d454df731fe87d9b375bb0a3b9d",
      "src/frame/manifest.generated.ts": "194cb0abb11f0b67d08b4ab192649c26a4a01fa100e8d2367977e5ecf368d8ff",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "8510e846dac491b74d02063f1cda09a55bc84f481833017d4378edbcaceaeb6f",
      "assets/frame/enhance.js": "43a54fdac0a7f8639591651f1d5c3216f3ebcbd05469e2e31ee8bf21e1cad76a",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  },
  {
    "id": "L3.B3p-b-i",
    "guard": "pin only absent names, with the planted lazy reader of addEventListener (inherited)",
    "changes": [
      {
        "file": "src/frame-runtime/enhance-entry.ts",
        "old": "  const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });",
        "new": "  const api = Object.freeze({ enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]): Promise<void> => (typeof globalThis.addEventListener === 'function' ? enhance(root, options) : Promise.reject(new Error('clobbered'))), setEnhancementPrefs, destroyEnhancement, goToHash });"
      },
      {
        "file": "src/frame-runtime/pin.ts",
        "old": "    if (hasOwn.call(win, name)) continue;\n",
        "new": "    if (name in win) continue;\n"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-pins.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B3p\"",
    "threads": 1585,
    "rc": 0,
    "result": "0 failed | 1 passed | 3 skipped (4)",
    "failing": [],
    "assertions": [],
    "sha256": {
      "src/frame-runtime/enhance-entry.ts": "6651efeb2b6e7a83fe8b674b6a42ecf2ecf0ae80e1c252d24280505eba90d0df",
      "src/frame-runtime/pin.ts": "f206b0e379ab23c83e8dae7a1a7253f618aab1eb11692178563a235e22a2e031"
    },
    "generated": {
      "assets/assets.json": "b25cd13c81c0886a9652354918f615349f6e6d454df731fe87d9b375bb0a3b9d",
      "src/frame/manifest.generated.ts": "194cb0abb11f0b67d08b4ab192649c26a4a01fa100e8d2367977e5ecf368d8ff",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "8510e846dac491b74d02063f1cda09a55bc84f481833017d4378edbcaceaeb6f",
      "assets/frame/enhance.js": "43a54fdac0a7f8639591651f1d5c3216f3ebcbd05469e2e31ee8bf21e1cad76a",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  },
  {
    "id": "L3.B3p-a0",
    "guard": "skip pinFreeGlobals, no planted reader (information: what the shipped scripts alone show)",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "    pinFreeGlobals(win, DOCSERVER_FREE_GLOBALS);\n",
        "new": "    void DOCSERVER_FREE_GLOBALS;\n"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-pins.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B3p\"",
    "threads": 1550,
    "rc": 1,
    "result": "1 failed | 0 passed | 3 skipped (4)",
    "failing": [
      "test/browser/frame-pins.test.ts > chromium > L3.B3p: one anchor for every name of the built bootstrap's free-global list: ready with the right nonce, every diagram kind draws as in the clean document, a link routes"
    ],
    "assertions": [
      "AssertionError: expected [ 'yes|no|Start|Choice|Done', …(8) ] to deeply equal [ 'yes|no|Start|Choice|Done', …(10) ]"
    ],
    "sha256": {
      "src/frame-runtime/bootstrap.ts": "a6f088df0d7b815c80b183a9d790710c9edcb945884b925869d5f37901039c68"
    },
    "generated": {
      "assets/assets.json": "b25cd13c81c0886a9652354918f615349f6e6d454df731fe87d9b375bb0a3b9d",
      "src/frame/manifest.generated.ts": "194cb0abb11f0b67d08b4ab192649c26a4a01fa100e8d2367977e5ecf368d8ff",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "8510e846dac491b74d02063f1cda09a55bc84f481833017d4378edbcaceaeb6f",
      "assets/frame/enhance.js": "43a54fdac0a7f8639591651f1d5c3216f3ebcbd05469e2e31ee8bf21e1cad76a",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  },
  {
    "id": "L3.B3p-b0",
    "guard": "pin only absent names, no planted reader (information)",
    "changes": [
      {
        "file": "src/frame-runtime/pin.ts",
        "old": "    if (hasOwn.call(win, name)) continue;\n",
        "new": "    if (name in win) continue;\n"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-pins.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B3p\"",
    "threads": 1635,
    "rc": 0,
    "result": "0 failed | 1 passed | 3 skipped (4)",
    "failing": [],
    "assertions": [],
    "sha256": {
      "src/frame-runtime/pin.ts": "f206b0e379ab23c83e8dae7a1a7253f618aab1eb11692178563a235e22a2e031"
    },
    "generated": {
      "assets/assets.json": "b25cd13c81c0886a9652354918f615349f6e6d454df731fe87d9b375bb0a3b9d",
      "src/frame/manifest.generated.ts": "194cb0abb11f0b67d08b4ab192649c26a4a01fa100e8d2367977e5ecf368d8ff",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "8510e846dac491b74d02063f1cda09a55bc84f481833017d4378edbcaceaeb6f",
      "assets/frame/enhance.js": "43a54fdac0a7f8639591651f1d5c3216f3ebcbd05469e2e31ee8bf21e1cad76a",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  }
]
```

## L3.B8s: the snapshot round trip (src/frame/document.ts)

Reference §3, §8.3. The plan's row: drop the snapshot from the seed. `src/frame/document.ts` is not a frame build input (the bootstrap bundles `seed.ts` only), so no rebuild.

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| L3.B8s-a | drop the snapshot from the seed | `src/frame/document.ts`: `snapshot: pairsOf(b, o.snapshot, 'snapshot') as [BridgeStoreKey, string][],` → `snapshot: (pairsOf(b, o.snapshot, 'snapshot') as [BridgeStoreKey, string][]).slice(0, 0),` | rc 1, 1 failed \| 0 passed \| 3 skipped (4). "L3.B8s: pref:prefs, pref:ui and doc:folds written in one mount come back through the snapshot on the next, and the reader starts from them". AssertionError: expected { Object (theme, indexTab, ...) } to deeply equal { theme: 'dark', …(3) } | `src/frame/document.ts` 6b2664885fca restored, equal |

```json
[
  {
    "id": "L3.B8s-a",
    "guard": "drop the snapshot from the seed",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "    snapshot: pairsOf(b, o.snapshot, 'snapshot') as [BridgeStoreKey, string][],",
        "new": "    snapshot: (pairsOf(b, o.snapshot, 'snapshot') as [BridgeStoreKey, string][]).slice(0, 0),"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (frameDocument runs from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-pins.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B8s\"",
    "threads": 1620,
    "rc": 1,
    "result": "1 failed | 0 passed | 3 skipped (4)",
    "failing": [
      "test/browser/frame-pins.test.ts > chromium > L3.B8s: pref:prefs, pref:ui and doc:folds written in one mount come back through the snapshot on the next, and the reader starts from them"
    ],
    "assertions": [
      "AssertionError: expected { Object (theme, indexTab, ...) } to deeply equal { theme: 'dark', …(3) }"
    ],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "generated": {},
    "restored": true
  }
]
```

## L3.B2: no request leaves the frame (src/frame-runtime/content.ts)

Reference §2, §6.2 step 2, the Global Constraint "No network". The plan's row: keep an unmapped `img src`. Red through the row's violation and error checks, not its request log: the frame's own policy (`img-src data:`) refuses each image before any request is made, the parent hears the refusal, and the bootstrap's violation listener fails the boot (`error{why:'boot'}`) in the three corpus documents that hold an image (`h-attr-smuggle`, `heading-ids-edge`, `links-images`); the request log stays empty, which is the policy doing its part.

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| L3.B2-a | keep an unmapped img src (no missing-image chip) | `src/frame-runtime/content.ts`: `img.replaceWith(chip(parsed, img)); ⏎` → `void chip; ⏎` | rc 1, 1 failed \| 0 passed \| 7 skipped (8). "L3.B2: no request leaves the frame over every golden and hostile corpus document and the hostile Mermaid cases, each with Mermaid on: ready, no error, no violation". AssertionError: expected { 'heading-ids-edge': { …(5) }, …(2) } to deeply equal {} | `src/frame-runtime/content.ts` 49a4ebd98e34 restored, equal; the generated outputs restored, equal |

```json
[
  {
    "id": "L3.B2-a",
    "guard": "keep an unmapped img src (no missing-image chip)",
    "changes": [
      {
        "file": "src/frame-runtime/content.ts",
        "old": "      img.replaceWith(chip(parsed, img));\n",
        "new": "      void chip;\n"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-csp.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B2\"",
    "threads": 1630,
    "rc": 1,
    "result": "1 failed | 0 passed | 7 skipped (8)",
    "failing": [
      "test/browser/frame-csp.test.ts > chromium > L3.B2: no request leaves the frame over every golden and hostile corpus document and the hostile Mermaid cases, each with Mermaid on: ready, no error, no violation"
    ],
    "assertions": [
      "AssertionError: expected { 'heading-ids-edge': { …(5) }, …(2) } to deeply equal {}"
    ],
    "sha256": {
      "src/frame-runtime/content.ts": "49a4ebd98e34743c89a920a1c334c2c317c7b88407b0b60782f650a5c5330239"
    },
    "generated": {
      "assets/assets.json": "b25cd13c81c0886a9652354918f615349f6e6d454df731fe87d9b375bb0a3b9d",
      "src/frame/manifest.generated.ts": "194cb0abb11f0b67d08b4ab192649c26a4a01fa100e8d2367977e5ecf368d8ff",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "8510e846dac491b74d02063f1cda09a55bc84f481833017d4378edbcaceaeb6f",
      "assets/frame/enhance.js": "43a54fdac0a7f8639591651f1d5c3216f3ebcbd05469e2e31ee8bf21e1cad76a",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  }
]
```

## L3.B13: no storage in the frame (src/frame-runtime/enhance-entry.ts)

The plan's row: an unguarded storage read, planted in the enhance source as it evaluates. The opaque origin throws `SecurityError`, which surfaces as an uncaught error at boot and, with enhance never registered, as ready then `error{why:'assets'}`.

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| L3.B13-a | an unguarded storage read (enhance reads localStorage as it evaluates) | `src/frame-runtime/enhance-entry.ts`: `const me = document.currentScript; ⏎` → `const me = document.currentScript; ⏎ const kept = window.localStorage.length; ⏎ void kept; ⏎` | rc 1, 1 failed \| 0 passed \| 7 skipped (8). "L3.B13: Web Storage, IndexedDB, the cookie and the Cache API throw or are empty in the frame, and booting raised no uncaught error". AssertionError: expected { …(3) } to deeply equal { …(3) } | `src/frame-runtime/enhance-entry.ts` 6651efeb2b6e restored, equal; the generated outputs restored, equal |

```json
[
  {
    "id": "L3.B13-a",
    "guard": "an unguarded storage read (enhance reads localStorage as it evaluates)",
    "changes": [
      {
        "file": "src/frame-runtime/enhance-entry.ts",
        "old": "const me = document.currentScript;\n",
        "new": "const me = document.currentScript;\nconst kept = window.localStorage.length;\nvoid kept;\n"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-csp.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B13\"",
    "threads": 1595,
    "rc": 1,
    "result": "1 failed | 0 passed | 7 skipped (8)",
    "failing": [
      "test/browser/frame-csp.test.ts > chromium > L3.B13: Web Storage, IndexedDB, the cookie and the Cache API throw or are empty in the frame, and booting raised no uncaught error"
    ],
    "assertions": [
      "AssertionError: expected { …(3) } to deeply equal { …(3) }"
    ],
    "sha256": {
      "src/frame-runtime/enhance-entry.ts": "6651efeb2b6e7a83fe8b674b6a42ecf2ecf0ae80e1c252d24280505eba90d0df"
    },
    "generated": {
      "assets/assets.json": "b25cd13c81c0886a9652354918f615349f6e6d454df731fe87d9b375bb0a3b9d",
      "src/frame/manifest.generated.ts": "194cb0abb11f0b67d08b4ab192649c26a4a01fa100e8d2367977e5ecf368d8ff",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "8510e846dac491b74d02063f1cda09a55bc84f481833017d4378edbcaceaeb6f",
      "assets/frame/enhance.js": "43a54fdac0a7f8639591651f1d5c3216f3ebcbd05469e2e31ee8bf21e1cad76a",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  }
]
```

## L3.B15: the hostile Mermaid cases (src/enhance/diagrams.ts)

The plan's rows: drop a secure key (`themeCSS`), and raise the limits past the ceilings, measured as two rows (maxTextSize, maxEdges), each red through the figure over that ceiling, which then draws instead of showing its source.

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| L3.B15-a | drop a secure key (themeCSS) | `src/enhance/diagrams.ts`: `theme: ['theme', 'themeVariables', 'themeCSS', 'darkMode', 'look'],` → `theme: ['theme', 'themeVariables', 'darkMode', 'look'],` | rc 1, 1 failed \| 0 passed \| 7 skipped (8). "L3.B15: the hostile Mermaid cases under frameCsp(): no injected style, no handler, zero violations, ready with no error, each over-limit diagram shown as its source". AssertionError: at the ceilings: expected [ 'span', 'span' ] to deeply equal [] | `src/enhance/diagrams.ts` 2df6eb6e927f restored, equal; the generated outputs restored, equal |
| L3.B15-b | raise maxTextSize past its ceiling (50,000 to 100,000) | `src/enhance/diagrams.ts`: `export const MAX_TEXT_SIZE = 50_000;` → `export const MAX_TEXT_SIZE = 100_000;` | rc 1, 1 failed \| 0 passed \| 7 skipped (8). "L3.B15: the hostile Mermaid cases under frameCsp(): no injected style, no handler, zero violations, ready with no error, each over-limit diagram shown as its source". AssertionError: at the ceilings: expected { figure: 3, svg: true, …(2) } to deeply equal { figure: 3, svg: false, …(2) } | `src/enhance/diagrams.ts` 2df6eb6e927f restored, equal; the generated outputs restored, equal |
| L3.B15-c | raise maxEdges past its ceiling (500 to 1,000) | `src/enhance/diagrams.ts`: `export const MAX_EDGES = 500;` → `export const MAX_EDGES = 1000;` | rc 1, 1 failed \| 0 passed \| 7 skipped (8). "L3.B15: the hostile Mermaid cases under frameCsp(): no injected style, no handler, zero violations, ready with no error, each over-limit diagram shown as its source". AssertionError: at the ceilings: expected { figure: 4, svg: true, …(2) } to deeply equal { figure: 4, svg: false, …(2) } | `src/enhance/diagrams.ts` 2df6eb6e927f restored, equal; the generated outputs restored, equal |

```json
[
  {
    "id": "L3.B15-a",
    "guard": "drop a secure key (themeCSS)",
    "changes": [
      {
        "file": "src/enhance/diagrams.ts",
        "old": "    theme: ['theme', 'themeVariables', 'themeCSS', 'darkMode', 'look'],",
        "new": "    theme: ['theme', 'themeVariables', 'darkMode', 'look'],"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-mermaid.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B15\"",
    "threads": 1735,
    "rc": 1,
    "result": "1 failed | 0 passed | 7 skipped (8)",
    "failing": [
      "test/browser/frame-mermaid.test.ts > chromium > L3.B15: the hostile Mermaid cases under frameCsp(): no injected style, no handler, zero violations, ready with no error, each over-limit diagram shown as its source"
    ],
    "assertions": [
      "AssertionError: at the ceilings: expected [ 'span', 'span' ] to deeply equal []"
    ],
    "sha256": {
      "src/enhance/diagrams.ts": "2df6eb6e927f4785830897b586ccd07d681ca746c8efe529bdca007dc17d5e56"
    },
    "generated": {
      "assets/assets.json": "b25cd13c81c0886a9652354918f615349f6e6d454df731fe87d9b375bb0a3b9d",
      "src/frame/manifest.generated.ts": "194cb0abb11f0b67d08b4ab192649c26a4a01fa100e8d2367977e5ecf368d8ff",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "8510e846dac491b74d02063f1cda09a55bc84f481833017d4378edbcaceaeb6f",
      "assets/frame/enhance.js": "43a54fdac0a7f8639591651f1d5c3216f3ebcbd05469e2e31ee8bf21e1cad76a",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  },
  {
    "id": "L3.B15-b",
    "guard": "raise maxTextSize past its ceiling (50,000 to 100,000)",
    "changes": [
      {
        "file": "src/enhance/diagrams.ts",
        "old": "export const MAX_TEXT_SIZE = 50_000;",
        "new": "export const MAX_TEXT_SIZE = 100_000;"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-mermaid.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B15\"",
    "threads": 1625,
    "rc": 1,
    "result": "1 failed | 0 passed | 7 skipped (8)",
    "failing": [
      "test/browser/frame-mermaid.test.ts > chromium > L3.B15: the hostile Mermaid cases under frameCsp(): no injected style, no handler, zero violations, ready with no error, each over-limit diagram shown as its source"
    ],
    "assertions": [
      "AssertionError: at the ceilings: expected { figure: 3, svg: true, …(2) } to deeply equal { figure: 3, svg: false, …(2) }"
    ],
    "sha256": {
      "src/enhance/diagrams.ts": "2df6eb6e927f4785830897b586ccd07d681ca746c8efe529bdca007dc17d5e56"
    },
    "generated": {
      "assets/assets.json": "b25cd13c81c0886a9652354918f615349f6e6d454df731fe87d9b375bb0a3b9d",
      "src/frame/manifest.generated.ts": "194cb0abb11f0b67d08b4ab192649c26a4a01fa100e8d2367977e5ecf368d8ff",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "8510e846dac491b74d02063f1cda09a55bc84f481833017d4378edbcaceaeb6f",
      "assets/frame/enhance.js": "43a54fdac0a7f8639591651f1d5c3216f3ebcbd05469e2e31ee8bf21e1cad76a",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  },
  {
    "id": "L3.B15-c",
    "guard": "raise maxEdges past its ceiling (500 to 1,000)",
    "changes": [
      {
        "file": "src/enhance/diagrams.ts",
        "old": "export const MAX_EDGES = 500;",
        "new": "export const MAX_EDGES = 1000;"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-mermaid.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B15\"",
    "threads": 1559,
    "rc": 1,
    "result": "1 failed | 0 passed | 7 skipped (8)",
    "failing": [
      "test/browser/frame-mermaid.test.ts > chromium > L3.B15: the hostile Mermaid cases under frameCsp(): no injected style, no handler, zero violations, ready with no error, each over-limit diagram shown as its source"
    ],
    "assertions": [
      "AssertionError: at the ceilings: expected { figure: 4, svg: true, …(2) } to deeply equal { figure: 4, svg: false, …(2) }"
    ],
    "sha256": {
      "src/enhance/diagrams.ts": "2df6eb6e927f4785830897b586ccd07d681ca746c8efe529bdca007dc17d5e56"
    },
    "generated": {
      "assets/assets.json": "b25cd13c81c0886a9652354918f615349f6e6d454df731fe87d9b375bb0a3b9d",
      "src/frame/manifest.generated.ts": "194cb0abb11f0b67d08b4ab192649c26a4a01fa100e8d2367977e5ecf368d8ff",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "8510e846dac491b74d02063f1cda09a55bc84f481833017d4378edbcaceaeb6f",
      "assets/frame/enhance.js": "43a54fdac0a7f8639591651f1d5c3216f3ebcbd05469e2e31ee8bf21e1cad76a",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  }
]
```

## L3.D5: Mermaid on request in the frame (src/frame-runtime/adapters.ts, bootstrap.ts; src/frame/document.ts)

FD13, FD18. The plan's rows: ready waits for drawing in on-request mode (both halves of the wait changed, so the bootstrap waits for a drawing that never starts: no ready), and drop the seed field (`draw` seeded as `'auto'` whatever the option says: every figure draws before ready).

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| L3.D5-a | ready waits for drawing in on-request mode | `src/frame-runtime/adapters.ts`: `return m !== null && m.draw === 'auto';` → `return m !== null;`; `src/frame-runtime/bootstrap.ts`: `const drawing = (): boolean => getAttribute.call(r, 'data-docreader-diagrams') === 'drawing';` → `const drawing = (): boolean => getAttribute.call(r, 'data-docreader-diagrams') === 'drawing' \|\| getAttribute.call(r, 'data-docreader-diagrams') === 'on-request';` | rc 1, 1 failed \| 0 passed \| 7 skipped (8). "L3.D5 (frame half): with mermaid.draw 'on-request', a document heavy with diagrams readies before anything is drawn; a tap draws that figure alone under frameCsp() with zero violations". AssertionError: expected [] to deeply equal [ { t: 'ready', v: 1, …(1) } ] | `src/frame-runtime/adapters.ts` 5e812784112a, `src/frame-runtime/bootstrap.ts` a6f088df0d7b restored, equal; the generated outputs restored, equal |
| L3.D5-b | drop the seed field (draw seeded as 'auto' whatever the option says) | `src/frame/document.ts`: `draw: field(f, 'draw', 'auto') } as SeedMermaid;` → `draw: 'auto' } as SeedMermaid;` | rc 1, 1 failed \| 0 passed \| 7 skipped (8). "L3.D5 (frame half): with mermaid.draw 'on-request', a document heavy with diagrams readies before anything is drawn; a tap draws that figure alone under frameCsp() with zero violations". AssertionError: expected { state: 'drawn', svgs: 16, …(2) } to deeply equal { state: 'on-request', svgs: +0, …(2) } | `src/frame/document.ts` 6b2664885fca restored, equal |

```json
[
  {
    "id": "L3.D5-a",
    "guard": "ready waits for drawing in on-request mode",
    "changes": [
      {
        "file": "src/frame-runtime/adapters.ts",
        "old": "  return m !== null && m.draw === 'auto';",
        "new": "  return m !== null;"
      },
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "      const drawing = (): boolean => getAttribute.call(r, 'data-docreader-diagrams') === 'drawing';",
        "new": "      const drawing = (): boolean => getAttribute.call(r, 'data-docreader-diagrams') === 'drawing' || getAttribute.call(r, 'data-docreader-diagrams') === 'on-request';"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run; the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-mermaid.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.D5\"",
    "threads": 1586,
    "rc": 1,
    "result": "1 failed | 0 passed | 7 skipped (8)",
    "failing": [
      "test/browser/frame-mermaid.test.ts > chromium > L3.D5 (frame half): with mermaid.draw 'on-request', a document heavy with diagrams readies before anything is drawn; a tap draws that figure alone under frameCsp() with zero violations"
    ],
    "assertions": [
      "AssertionError: expected [] to deeply equal [ { t: 'ready', v: 1, …(1) } ]"
    ],
    "sha256": {
      "src/frame-runtime/adapters.ts": "5e812784112af3603ad9919195525e3752a081588cdd0a76b335b81c4b013058",
      "src/frame-runtime/bootstrap.ts": "a6f088df0d7b815c80b183a9d790710c9edcb945884b925869d5f37901039c68"
    },
    "generated": {
      "assets/assets.json": "b25cd13c81c0886a9652354918f615349f6e6d454df731fe87d9b375bb0a3b9d",
      "src/frame/manifest.generated.ts": "194cb0abb11f0b67d08b4ab192649c26a4a01fa100e8d2367977e5ecf368d8ff",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "8510e846dac491b74d02063f1cda09a55bc84f481833017d4378edbcaceaeb6f",
      "assets/frame/enhance.js": "43a54fdac0a7f8639591651f1d5c3216f3ebcbd05469e2e31ee8bf21e1cad76a",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true
  },
  {
    "id": "L3.D5-b",
    "guard": "drop the seed field (draw seeded as 'auto' whatever the option says)",
    "changes": [
      {
        "file": "src/frame/document.ts",
        "old": "draw: field(f, 'draw', 'auto') } as SeedMermaid;",
        "new": "draw: 'auto' } as SeedMermaid;"
      }
    ],
    "rebuild": "none: the changed file is not a frame build input (frameDocument runs from source)",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-mermaid.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.D5\"",
    "threads": 1560,
    "rc": 1,
    "result": "1 failed | 0 passed | 7 skipped (8)",
    "failing": [
      "test/browser/frame-mermaid.test.ts > chromium > L3.D5 (frame half): with mermaid.draw 'on-request', a document heavy with diagrams readies before anything is drawn; a tap draws that figure alone under frameCsp() with zero violations"
    ],
    "assertions": [
      "AssertionError: expected { state: 'drawn', svgs: 16, …(2) } to deeply equal { state: 'on-request', svgs: +0, …(2) }"
    ],
    "sha256": {
      "src/frame/document.ts": "6b2664885fcaed85c98e2e066f51f1bae21017ee33853fa76a1751e08476b0b2"
    },
    "generated": {},
    "restored": true
  }
]
```


## Fix round (review findings T8-C1, T8-C2, S1, S2, S3, E1, E2, E3, E4)

Measured 2026-10-28 (UTC) on Chromium, on the final test files named at the top, by the same method (saved bytes and sha256, `ulimit -u <threads + 1500>`, `timeout -k 10 600`, restore checked; `node scripts/build-frame.mjs --check` exited 0 after the last row). The review asked for checks that cannot pass on a deaf collector, a vacuous store probe, an unbounded wait or a collision that never happens; each new check is shown red here by a change to the test side that removes what it stands on (no source file is the guard in these rows, so they change test files only).

| Row | What it shows | Change | Result | Restore |
|---|---|---|---|---|
| F-collector-deaf | the request log hears the page's own load (L3.B1's positive check) | `test/browser/frame-host-page.ts`: `requests.push({ url: req.url(), main });` → `void main;` | rc 1, 1 failed \| 13 skipped (14). AssertionError: expected [] to deeply equal [ { …(2) } ] | test/browser/frame-host-page.ts 175987e5ab20 restored, equal |
| F-collector-subframe-deaf | the request log hears the frame's requests (L3.B2 control) | `test/browser/frame-host-page.ts`: `requests.push({ url: req.url(), main });` → `if (main) requests.push({ url: req.url(), main });` | rc 1, 1 failed \| 13 skipped (14). AssertionError: expected [] to deeply equal [ { …(2) } ] | test/browser/frame-host-page.ts 175987e5ab20 restored, equal |
| F-idb-lenient | IndexedDB must refuse (L3.B13 and its control) | `test/browser/frame-csp.test.ts`: `const idbRefused = (v: string): boolean => /^(threw:\|value:"refused:)/.test(v);` → `const idbRefused = (v: string): boolean => /^(threw:\|value:"refused:\|value:"opened:)/.test(v);` | rc 1, 1 failed \| 1 passed \| 12 skipped (14). AssertionError: expected true to be false // Object.is equality | test/browser/frame-csp.test.ts 07d0d716fa18 restored, equal |
| F-wait-busy-unbounded | a busy poll stretches the stall only by the allowance (the wait's control) | `test/browser/frame-shared.ts`: `stallMs + Math.min(busy, busyMs)` → `stallMs + busy` | rc 1, 1 failed \| 13 skipped (14). AssertionError: expected 48056 to be less than 25000 | test/browser/frame-shared.ts d326f25e1e97 restored, equal |
| F-B10-budget | L3.B10 names a document it gave up on or never reached (no hello, so no frame readies; budget 60 s) | `test/browser/frame-boot.test.ts`: `const B10_BUDGET_MS = 540_000;` → `const B10_BUDGET_MS = 60_000;`; `test/browser/frame-boot.test.ts`: `await h.mount(frameDocument(input(d.markdown), { csp: frameCsp(), nonce, assets }), frameCsp());` → `await h.mount(frameDocument(input(d.markdown), { csp: frameCsp(), nonce, assets }), frameCsp(), 'none');` | rc 1, 1 failed \| 71 skipped (72). AssertionError: expected [ …(54) ] to deeply equal [] | test/browser/frame-boot.test.ts 64dc55b4b22e restored, equal |
| F-B14-clock | L3.B14 cannot pass by missing: the anchored drawing gets the anchored ids (the clock fixed) | `test/browser/frame-mermaid.test.ts`: `await host.page.clock.setFixedTime(NOW);` → `(removed)` | rc 1, 1 failed \| 7 skipped (8). AssertionError: corpus figure-captions.md graph: the frame's clock: expected 1793150223290 to be 1768478400000 // Object.is equality | test/browser/frame-mermaid.test.ts 936c34760f31 restored, equal |

F-B10-budget names 3 documents the wait gave up on (`headings: no message before the wait gave up, []`, and two more) and 51 the budget no longer reached: a frame that hangs on every document is a red row that names them, not a test timeout. F-wait-busy-unbounded is the wait as it was (a busy poll counted as progress without limit): it waits until the frame frees itself, 48 s, where the bounded wait gives up at 15 s.

**The plan's rows again, on the final bytes.** Every row of the first round was run again after the fix round (the review found that no run had used the committed bytes of `frame-mermaid.test.ts`, and the fix round changed `frame-shared.ts`'s wait, which every row uses). Every outcome is the first round's:

| Row | Threads | Result | First assertion |
|---|---|---|---|
| L3.B3p-control | 1774 | rc 0, 1 passed \| 3 skipped (4); restored equal | (green) |
| L3.B3p-a | 1581 | rc 1, 1 failed \| 3 skipped (4); restored equal | AssertionError: expected { …(3) } to deeply equal { …(3) } |
| L3.B3p-b | 1541 | rc 0, 1 passed \| 3 skipped (4); restored equal | (green) |
| L3.B3p-control-i | 1551 | rc 0, 1 passed \| 3 skipped (4); restored equal | (green) |
| L3.B3p-a-i | 1571 | rc 1, 1 failed \| 3 skipped (4); restored equal | AssertionError: expected [ 'yes\|no\|Start\|Choice\|Done', …(8) ] to deeply equal [ 'yes\|no\|Start\|Choice\|Done', …(10) ] |
| L3.B3p-b-i | 1667 | rc 0, 1 passed \| 3 skipped (4); restored equal | (green) |
| L3.B3p-a0 | 1593 | rc 1, 1 failed \| 3 skipped (4); restored equal | AssertionError: expected [ 'yes\|no\|Start\|Choice\|Done', …(8) ] to deeply equal [ 'yes\|no\|Start\|Choice\|Done', …(10) ] |
| L3.B3p-b0 | 1610 | rc 0, 1 passed \| 3 skipped (4); restored equal | (green) |
| L3.B8s-a | 1673 | rc 1, 1 failed \| 3 skipped (4); restored equal | AssertionError: expected { Object (theme, indexTab, ...) } to deeply equal { theme: 'dark', …(3) } |
| L3.B2-a | 1721 | rc 1, 1 failed \| 1 passed \| 12 skipped (14); restored equal | AssertionError: expected { 'heading-ids-edge': { …(5) }, …(2) } to deeply equal {} |
| L3.B13-a | 1559 | rc 1, 1 failed \| 1 passed \| 12 skipped (14); restored equal | AssertionError: expected { …(3) } to deeply equal { …(3) } |
| L3.B15-a | 1584 | rc 1, 1 failed \| 7 skipped (8); restored equal | AssertionError: at the ceilings: expected [ 'span', 'span' ] to deeply equal [] |
| L3.B15-b | 1647 | rc 1, 1 failed \| 7 skipped (8); restored equal | AssertionError: at the ceilings: expected { figure: 3, svg: true, …(2) } to deeply equal { figure: 3, svg: false, …(2) } |
| L3.B15-c | 1667 | rc 1, 1 failed \| 7 skipped (8); restored equal | AssertionError: at the ceilings: expected { figure: 4, svg: true, …(2) } to deeply equal { figure: 4, svg: false, …(2) } |
| L3.D5-a | 1587 | rc 1, 1 failed \| 7 skipped (8); restored equal | AssertionError: expected [] to deeply equal [ { t: 'ready', v: 1, …(1) } ] |
| L3.D5-b | 1632 | rc 1, 1 failed \| 7 skipped (8); restored equal | AssertionError: expected { state: 'drawn', svgs: 16, …(2) } to deeply equal { state: 'on-request', svgs: +0, …(2) } |

L3.B13-a now meets the stricter L3.B13 (IndexedDB must refuse) and is red as before, through the boot error; L3.B13's control row stays green beside it. L3.B2-a now runs L3.B2's control too (green); the corpus row is red, as before, through violations and `error{why:'boot'}`, with the request log empty, and the control shows that log hears a frame's request when there is one.

```json
[
  {
    "id": "F-collector-deaf",
    "guard": "the request log hears the page's own load (L3.B1's positive check)",
    "changes": [
      {
        "file": "test/browser/frame-host-page.ts",
        "old": "requests.push({ url: req.url(), main });",
        "new": "void main;"
      }
    ],
    "rebuild": "none: test files only",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-csp.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B1: under\"",
    "threads": 1501,
    "rc": 1,
    "result": "1 failed | 13 skipped (14)",
    "failing": [
      "test/browser/frame-csp.test.ts > chromium > L3.B1: under frameCsp() with Mermaid on, zero violations, CSS1Compat, enhance resolved, a flowchart, a sequence and a gantt drawn with no unsafe-eval, the fonts from data: URLs"
    ],
    "assertions": [
      "AssertionError: expected [] to deeply equal [ { …(2) } ]"
    ],
    "sha256": {
      "test/browser/frame-host-page.ts": "175987e5ab20b2be02f28bbad9ffc54863aaac157698aadc276f3ad9a16647ae"
    },
    "restored": true
  },
  {
    "id": "F-collector-subframe-deaf",
    "guard": "the request log hears the frame's requests (L3.B2 control)",
    "changes": [
      {
        "file": "test/browser/frame-host-page.ts",
        "old": "requests.push({ url: req.url(), main });",
        "new": "if (main) requests.push({ url: req.url(), main });"
      }
    ],
    "rebuild": "none: test files only",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-csp.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B2 control\"",
    "threads": 1509,
    "rc": 1,
    "result": "1 failed | 13 skipped (14)",
    "failing": [
      "test/browser/frame-csp.test.ts > chromium > L3.B2 control: the request log hears a frame's request (with no policy, an image the frame loads from another origin is logged as the frame's), and under frameCsp() the same image makes no request and the parent hears the refusal"
    ],
    "assertions": [
      "AssertionError: expected [] to deeply equal [ { …(2) } ]"
    ],
    "sha256": {
      "test/browser/frame-host-page.ts": "175987e5ab20b2be02f28bbad9ffc54863aaac157698aadc276f3ad9a16647ae"
    },
    "restored": true
  },
  {
    "id": "F-idb-lenient",
    "guard": "IndexedDB must refuse (L3.B13 and its control)",
    "changes": [
      {
        "file": "test/browser/frame-csp.test.ts",
        "old": "const idbRefused = (v: string): boolean => /^(threw:|value:\"refused:)/.test(v);",
        "new": "const idbRefused = (v: string): boolean => /^(threw:|value:\"refused:|value:\"opened:)/.test(v);"
      }
    ],
    "rebuild": "none: test files only",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-csp.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B13\"",
    "threads": 1549,
    "rc": 1,
    "result": "1 failed | 1 passed | 12 skipped (14)",
    "failing": [
      "test/browser/frame-csp.test.ts > chromium > L3.B13 control: the same probe in the parent page (an ordinary origin) opens IndexedDB, which the row's check reads as a usable store"
    ],
    "assertions": [
      "AssertionError: expected true to be false // Object.is equality"
    ],
    "sha256": {
      "test/browser/frame-csp.test.ts": "07d0d716fa18219fe262bae96aa105000b863affa49855bb6f19d902db344baf"
    },
    "restored": true
  },
  {
    "id": "F-wait-busy-unbounded",
    "guard": "a busy poll stretches the stall only by the allowance (the wait's control)",
    "changes": [
      {
        "file": "test/browser/frame-shared.ts",
        "old": "stallMs + Math.min(busy, busyMs)",
        "new": "stallMs + busy"
      }
    ],
    "rebuild": "none: test files only",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-csp.test.ts --maxWorkers=1 --fileParallelism=false -t \"progress wait's control\"",
    "threads": 1493,
    "rc": 1,
    "result": "1 failed | 13 skipped (14)",
    "failing": [
      "test/browser/frame-csp.test.ts > chromium > the progress wait's control: a frame whose thread never yields is given up on once its busy allowance is spent, long before the frame frees itself"
    ],
    "assertions": [
      "AssertionError: expected 48056 to be less than 25000"
    ],
    "sha256": {
      "test/browser/frame-shared.ts": "d326f25e1e972a042b20115febf5600023316da0ff5ad6f6caf89fdac1f5a135"
    },
    "restored": true
  },
  {
    "id": "F-B10-budget",
    "guard": "L3.B10 names a document it gave up on or never reached (no hello, so no frame readies; budget 60 s)",
    "changes": [
      {
        "file": "test/browser/frame-boot.test.ts",
        "old": "const B10_BUDGET_MS = 540_000;",
        "new": "const B10_BUDGET_MS = 60_000;"
      },
      {
        "file": "test/browser/frame-boot.test.ts",
        "old": "        await h.mount(frameDocument(input(d.markdown), { csp: frameCsp(), nonce, assets }), frameCsp());",
        "new": "        await h.mount(frameDocument(input(d.markdown), { csp: frameCsp(), nonce, assets }), frameCsp(), 'none');"
      }
    ],
    "rebuild": "none: test files only",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-boot.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B10: every golden\"",
    "threads": 1582,
    "rc": 1,
    "result": "1 failed | 71 skipped (72)",
    "failing": [
      "test/browser/frame-boot.test.ts > chromium > L3.B10: every golden and hostile corpus output readies with no error, `<details open>` among them"
    ],
    "assertions": [
      "AssertionError: expected [ …(54) ] to deeply equal []"
    ],
    "sha256": {
      "test/browser/frame-boot.test.ts": "64dc55b4b22e59913c4ef65562d8280a580204331033cd8b4a9f78a3d4d82b57"
    },
    "restored": true
  },
  {
    "id": "F-B14-clock",
    "guard": "L3.B14 cannot pass by missing: the anchored drawing gets the anchored ids (the clock fixed)",
    "changes": [
      {
        "file": "test/browser/frame-mermaid.test.ts",
        "old": "        await host.page.clock.setFixedTime(NOW);\n",
        "new": ""
      }
    ],
    "rebuild": "none: test files only",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-mermaid.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B14 \\\\(measurement\"",
    "threads": 1551,
    "rc": 1,
    "result": "1 failed | 7 skipped (8)",
    "failing": [
      "test/browser/frame-mermaid.test.ts > chromium > L3.B14 (measurement row): an anchor for every id of each diagram kind's drawing, the frame's clock fixed so the anchored drawing gets the same ids: every anchor meets its id, and the frame still readies with no violation, no request and one load"
    ],
    "assertions": [
      "AssertionError: corpus figure-captions.md graph: the frame's clock: expected 1793150223290 to be 1768478400000 // Object.is equality"
    ],
    "sha256": {
      "test/browser/frame-mermaid.test.ts": "936c34760f31894335337912a2cd35182e9678270e7d88b531cf083672033153"
    },
    "restored": true
  }
]
```

## Recorded, not mutated

- **L3.B1** is the policy's control row; its own control (a policy without the bootstrap's hash gives no port message, and the parent hears the refusal) is part of the row and green on the final code.
- **L3.B14 is RED, awaiting the coordinator's ruling** (review findings T8-C1, S1, E1). What was measured, on Chromium, 2026-10-28, Mermaid 12.1.0 (`test/browser/frame-mermaid.test.ts`, final bytes `936c34760f31…`):
  - **How Mermaid names a drawing.** The reader draws through Mermaid's `run()` (`src/enhance/diagrams.ts`), which takes no id: it names each drawing `mermaid-${idGenerator.next()}` (`node_modules/mermaid/dist/mermaid.core.mjs` line 1546, generator built at line 1537), and with `deterministicIds` off (the reader's setting) the generator answers `Date.now()` (`InitIDGenerator`, `node_modules/mermaid/dist/chunks/mermaid.core/chunk-3YJQHVM4.mjs`). Every other id of the drawing begins with that name (its working elements `d<name>` and `i<name>`, its markers, gradients and node ids). While it draws, Mermaid looks the name up in the whole document, so an authored element that carries it is found in place of Mermaid's own.
  - **Why the first round's green row proved nothing.** That row drew the clean document, collected its 214 ids, and anchored them in a second mount on the page's own clock, whose drawing therefore had a later millisecond in its name: 206 of the 214 anchors (every id naming the time) could not meet the drawing they were checked against, and `casesDamaged=0` followed from that. The 8 ids that name no time (the sequence diagram's `actor0`, `actor1`, `root-0`, `root-1`, twice over) do no harm.
  - **The row now.** L3.B14 fixes the page's clock (Playwright's page clock; it reaches the frame, which the row asserts in every mount), so the anchored drawing gets the clean one's ids, and it asserts that the collision is certain: the drawing is named `mermaid-<NOW>` and its own three names are among the anchors. With the clock left alone that assertion goes red (row F-B14-clock below). What it holds whatever the ids do is green: one ready with the mount's nonce and nothing else, no violation, no request, one load. Figures (`frame-figure: L3.B14 chromium …`): 14 cases, 214 ids collected and anchored, none outside the anchor grammar, 206 naming the drawing's time; **14 of 14 cases damaged**: the drawing taken by the anchor that carries its name (14), the `d<name>` anchor removed in place of Mermaid's working element (14), and 8 marker or gradient references resolved to an authored anchor.
  - **The plan's criterion** (the figure draws with the clean SVG text, every reference resolves as in the clean drawing, every anchor stays) is its own row, `it.fails('L3.B14 (KNOWN RED, …)')`: red in every case, kept visible without failing CI. When a fix lands that row passes, which vitest reports as a failure, so it must then become a plain `it`; run alone, with nothing measured, it also fails.
  - **Exposure.** An anchor must name the millisecond the reader draws in. A 2 MiB hostile document holds about 56,000 such anchors, about a minute of draw times. The damage measured stays inside the frame: no violation, no request, no second load.
  - **The plan's answer, and what the ruling must pick.** The plan says a red L3.B14 gets an id prefix `render()` cannot emit, in `src/enhance/diagrams.ts`, with its own mutation row (L3.B14: drop the prefix), and a `Layout-moved:` trailer for any Level 2 case it moves. Mermaid 12.1.0's `run()` takes no id, so the prefix needs one of these, which is the ruling's to choose: (a) draw through `mermaid.render(id, text)` with a reader-issued id carrying a prefix `render()` cannot emit, and insert the returned SVG string through an inert `DOMParser` parse (the sink the frame already uses), not `innerHTML` (note: `run()` itself inserts with `element.innerHTML = svg`, `mermaid.core.mjs` line 1555, so the reader's current path already ends in that sink inside Mermaid); (b) rename the drawing's ids after it draws, which meets the diagram tools' reading of `flowchart-<token>-<n>` node ids and the rule that the reader writes no ids on the document; (c) make `render()` refuse `[di]?mermaid-<digits>` ids, which is Task 11's area and needs a corpus ruling. Turning on `deterministicIds` is no answer: it names drawings `mermaid-0`, `mermaid-1`, …, which a document names with no effort at all.
  - Until the ruling, the PR body records L3.B14 as red, awaiting the ruling, not as green.
- **L3.B16** and the SHA-256 and 2 MiB figures are measurement rows.
- **L3.B12**: the parity row re-run on the integrated build (green), plus a Node row holding that the two files drawn are the shipped bytes (the classic file's sha256 is `FRAME_MANIFEST.mermaid.sha256`, the module's is `assets/assets.json`'s).
