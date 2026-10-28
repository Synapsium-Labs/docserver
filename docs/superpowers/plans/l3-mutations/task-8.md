# L3 Task 8: mutation rows (frame browser rows on both engines)

Each guard Task 8's rows stand on, changed once, with the row that goes red: the free-global pin (`src/frame-runtime/pin.ts`, `src/frame-runtime/bootstrap.ts`), the seed's snapshot (`src/frame/document.ts`), the missing-image rewrite (`src/frame-runtime/content.ts`), the frame's storage-free boot (`src/frame-runtime/enhance-entry.ts`), the reader's secure keys and Mermaid limits (`src/enhance/diagrams.ts`), and the on-request ready rule and seed field (`src/frame-runtime/adapters.ts`, `src/frame-runtime/bootstrap.ts`, `src/frame/document.ts`). Measured 2026-10-28 (UTC) on branch `l3-t08-frame-browser` (base `b40a554`, the Task 8 changes not yet committed), first on the test files of the first round (`test/browser/frame-csp.test.ts` `2d515f8edd87…`, `frame-mermaid.test.ts` `71d24234f838…`, `frame-pins.test.ts` `eaa7d12ba1a9…`, `frame-shared.ts` `2b50bc73b8fd…`; the first round's record named `frame-mermaid.test.ts` as `743a10e469ec…`, bytes rewrapped after the runs that no run used and that were not kept), then, after the review's fix round, every row again on the final test files (`frame-boot.test.ts` `64dc55b4b22e…`, `frame-csp.test.ts` `07d0d716fa18…`, `frame-host-page.ts` `175987e5ab20…`, `frame-mermaid.test.ts` `936c34760f31…`, `frame-pins.test.ts` `eaa7d12ba1a9…`, `frame-shared.ts` `d326f25e1e97…`), with the same outcome for every row (the section "Fix round" below). The tables and JSON below are the first round's runs. Every row ran on Chromium only (C69: WebKit cannot start on this box; CI runs every row on both engines).

**Result.** 16 runs: the plan's 10 rows (L3.B3p-a, L3.B3p-b, L3.B8s-a, L3.B2-a, L3.B13-a, L3.B15-a, L3.B15-b, L3.B15-c, L3.D5-a, L3.D5-b), their 2 planted controls, and 4 information runs. 9 of the plan's 10 rows are red, each through an `AssertionError` (every red run exits 1); both controls are green. One row, L3.B3p-b ("pin only absent names"), stays green and is recorded as an **equivalent mutant**, measured again under ledger C95(2) with a planted reader of `valueOf` (inherited from `Object.prototype`) and still green on Chromium, WebKit unmeasured ("Second round" below); it is not counted red and not dropped. B1 (a control row) and B16 (a measurement row) are recorded, not mutated (the plan's mutation list); L3.B12's shipped-bytes check is a re-run row, not mutated. **L3.B14 was red, and the id prefix now ships** (ledger C95(1); "Second round" and "Recorded, not mutated" below): with the prefix the plan's criterion is green in all 14 cases, and the prefix's own row (L3.B14-a, drop the prefix) is red. The second round's fix round adds 7 rows, all red ("Second round, fix round" below): the full-screen copy's dotted ids, the frame's shape check on `render`, and L3.B14-a again.

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

**L3.B3p-b is an equivalent mutant on Chromium** (first round; ledger C95(2) asked for a second measurement with a name inherited from `Object.prototype`, which is in "Second round" below: still green, and the direct probe there corrects one detail of this paragraph's reading, since on Chromium `addEventListener` is `EventTarget.prototype`'s, not the window's own). "Pin only absent names" (`name in win` in place of `hasOwn.call(win, name)`) leaves the inherited names unpinned, and nothing an id can do reaches them: by the HTML standard's named-property visibility rule, an element id names a property of the window only when no object on the window's prototype chain holds that name, so an id `addEventListener` leaves `window.addEventListener` the method (L3.B3p-b-i, measured: green with the inherited reader planted). L3.B3p-a-i shows the same thing from the other side: with no pin at all, the reader of `addEventListener` still never rejected, since its failure is byte for byte L3.B3p-a0's (no reader planted: the pie and the git graph stop drawing), so an id `addEventListener` did not shadow the inherited method. That the planted-reader path runs at all is shown by L3.B3p-a, whose `cytoscape` reader does reject (`error{why:'render'}`); L3.B3p-control-i, with the pin intact, shows only that the reader leaves a clean mount green, not that it is live. Every name an id can shadow is one the global lacks, and that mutation pins every one of those (L3.B3p-b with the `cytoscape` reader, and L3.B3p-b0, both green). Reference §5.3's premise that an id can shadow "anything the global inherits" is therefore not what Chromium does. On WebKit the equivalence is unmeasured, and stays unmeasured after CI: CI's WebKit leg runs the unmutated row only, so the mutant's behaviour there needs someone to run these mutations on a host where WebKit starts. Both points go to the C-ruling request. The pin's own-property check stays as it is. L3.B3p-a (skip the pin) is red with the planted reader through the ready-then-error the reader causes, and red without it (L3.B3p-a0) through two diagram kinds (the pie and the git graph) that no longer draw once Mermaid reads a name an anchor holds.

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

## Second round (ledger C95): the drawing's id prefix, and L3.B3p-b again

Measured 2026-10-28 (UTC) on Chromium (C69), on branch `l3-t08-frame-browser` at `be4324f` with the second round's changes not yet committed, by the method above, each row through one runner that saves the bytes and sha256 of every file the row changes (and, for a rebuilding row, the eight generated outputs), applies each `old` → `new` once, rebuilds where the change is a frame build input, measures the thread count, runs the row's command, restores every saved file and checks its sha256, and after a rebuilding row runs `node scripts/build-frame.mjs --check`. Final files the rows ran on (sha256 prefix): `src/enhance/diagrams.ts` `eaaa55526460…`, `src/enhance/env.ts` `2a1753da2322…`, `test/enhance-diagrams.test.ts` `221fae625ac8…`, `test/browser/frame-mermaid.test.ts` `107b817dd624…`, `test/browser/frame-pins.test.ts` `eaa7d12ba1a9…`, `src/frame-runtime/pin.ts` `f206b0e379ab…`, `src/frame-runtime/enhance-entry.ts` `6651efeb2b6e…`, `src/frame-runtime/bootstrap.ts` `a6f088df0d7b…`. Every restore matched; every rebuilding row's `--check` exited 0.

**C95(1): the prefix ships, and it is a guard.** The reader now draws each figure as Mermaid's `run()` does, step by step, with one change: it calls Mermaid's `render(id, text, container)` itself, under a name of its own, `docreader·mermaid-<n>` (`DRAWING_ID_PREFIX` in `src/enhance/diagrams.ts`, then a number each drawing takes in turn). U+00B7 MIDDLE DOT is a code point `render()` writes into no id: the anchor grammar is `[A-Za-z0-9_-]`, a heading slug keeps letters, numbers, `_`, `-` and CJK ideographs (the dot is `Po`), and a footnote's ids are `fn`/`fnref` with digits and `:`; the unit guard measures it over every code point through the slug, over a crafted document (headings, anchors, footnotes and raw HTML holding the dot) and over every corpus document's ids. CSS takes the dot unescaped (an ident code point in CSS Syntax 3, and every code point from U+0080 was one before), measured in the frame by L3.B14p: `querySelector('#docreader·mermaid-0')` finds the drawing, the drawing's own `#docreader·mermaid-0 …` rules style it (the node fill is the warm theme's), and a `clip-path: url(#docreader·probe-clip)` clips a hit test, beside an unclipped control. The text handed to `render()` is `run()`'s (innerHTML read and entities decoded, which gives back the pre's text; ts-dedent's dedent; trim; `<br>` forms written `<br/>`), held equal to `run()`'s own steps by a unit row; the SVG text goes in through an inert `DOMParser` parse (`env.parseHtml`, the window's one parser site in `src/enhance`, one counted allowed site in `test/enhance-walls.test.ts`), which a unit row holds equal to what `run()`'s `innerHTML` would put there; `bindFunctions` is called with the drawing as `run()` calls it; a rejection or a throw of `bindFunctions` is kept from the page as `run()` keeps it with `suppressErrors`. The shape check now asks for `initialize` and `render`: a module without `render` (one with `run` alone included) leaves every figure to its fallback with the load note. The frame's own check in the bootstrap asked for `run` until the fix round below, which aligns it on `initialize` and `render`.

- **L3.B14 is green with the prefix** (plain `it` now; its `it.fails` form is gone). Figures, Chromium: 14 cases; 214 ids collected; 8 anchored as they are (the sequence diagram's `actor0`, `actor1`, `root-0`, `root-1`, twice over); 206 hold the drawing's name and so the dot, outside the anchor grammar; 412 twins anchored (each of those 206 with the drawing's name replaced by `run()`'s name on the fixed clock, `mermaid-<NOW>`, and by the prefix-less name, `mermaid-<n>`); **0 cases damaged**, 0 drawings taken, 0 anchors removed, 0 references taken.
- **L3.B14-a (drop the prefix) is red** through the criterion: the drawing is named `mermaid-0`, its twin is the same name and is anchored, and the 14 cases are damaged exactly as before the prefix (14 drawings taken, 14 anchors removed, 8 references taken). The same mutation is red in the unit guard (L3.B14-a-unit) and in L3.B14p.
- The unit guard is itself shown to bite: a slug that keeps the dot (L3.B14-slug) and an anchor grammar that admits it (L3.B14-anchor) are both red; so are skipping `run()`'s dedent (L3.B14-text) and a shape check that asks for `run` in place of `render` (L3.B14-shape).
- F-B14-clock, re-measured on the rewritten row: with the clock left alone, the measurement row is red (the frame's clock) and the criterion row is red too, since it refuses to pass with nothing measured.
- No Level 2 case moved: `test/browser/layout-corpus.test.ts` is green on Chromium with no expected file written (no `Layout-moved:` names). L3.B12 (`test/browser/mermaid-parity.test.ts`) now draws both builds under the reader's own names (`docreader·mermaid-<i>`) and is green: 29 corpus diagrams, 20 drawn equal, the 9 pinned failures equal.

**C95(2): L3.B3p-b measured again with a name the window inherits from `Object.prototype`.** The planted lazy reader reads `valueOf` as a free identifier (`typeof valueOf === 'function'`, else the reader's `enhance` rejects); the build's scan lists it (118 names pinned, one more than the shipped 117), so L3.B3p puts an anchor `valueOf` ahead of the document. The control (pin intact, L3.B3p-control-v) is green. **The mutant (pin only absent names, L3.B3p-b-v) is still green: recorded as an equivalent mutant, measured on Chromium; WebKit unmeasured.** The evidence:
- L3.B3p-a-v (no pin at all, the same reader) fails exactly as L3.B3p-a0 did with no reader (the pie and the git graph stop drawing); the frame still readied with its nonce and no error, so the `valueOf` reader never rejected: the anchor `valueOf` did not reach `valueOf` even unpinned.
- A direct probe outside the repository (a scratch script with the pinned playwright-core and the cached Chromium 153.0.8010.12), in a plain page and in an opaque sandboxed srcdoc frame, each with an element id for each of `valueOf`, `toString`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString`, `addEventListener` and `cytoscape`: `typeof <name>` read freely and `window[name]` answer `function` for the first seven and the element (`object`) for `cytoscape` only. The window's chain is `Window` → `WindowProperties` → `EventTarget.prototype` → `Object.prototype`; `addEventListener` is not an own property of the window there (it is `EventTarget.prototype`'s), so C95(2)'s reason for the first measurement's green does not hold on Chromium either. What does hold is WebIDL's named-property visibility: the named properties object answers for an id only when no object on the window's prototype chain (other than the named properties object) has the name, `Object.prototype` included. An id therefore shadows only names the window lacks altogether, and "pin only absent names" (`name in win` false) pins exactly those.
- So the row cannot go red on Chromium with any inherited name the anchor grammar can author; it stays in this record as an equivalent mutant on Chromium. On WebKit it is unmeasured, here and in CI (CI's WebKit leg runs the unmutated row only).

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| L3.B14-a | drop the prefix: the reader names each drawing ˋmermaid-<n>ˋ, which an anchor can hold (the plan's row; frame build input, rebuilt) | `src/enhance/diagrams.ts`: `export const DRAWING_ID_PREFIX = 'docreader\u00b7';` → `export const DRAWING_ID_PREFIX = '';` | rc 1, 3 failed \| 7 skipped (10). The criterion: AssertionError: expected { …(14) } to deeply equal {} (14 cases damaged); the measurement row: AssertionError: expected 206 to be greater than or equal to 412 (each drawing id's prefix-less twin is the id itself); L3.B14p: AssertionError: expected { id: 'mermaid-0', dot: false, …(7) } to deeply equal { id: 'mermaid-0', dot: true, …(7) } | src/enhance/diagrams.ts eaaa55526460 restored, equal; the generated outputs restored, equal; `--check` 0 |
| L3.B14-a-unit | drop the prefix, read by the unit guard (no rebuild: the unit project imports the source) | `src/enhance/diagrams.ts`: `export const DRAWING_ID_PREFIX = 'docreader\u00b7';` → `export const DRAWING_ID_PREFIX = '';` | rc 1, 1 failed \| 49 passed (50). AssertionError: expected '' to be 'docreader·' // Object.is equality | src/enhance/diagrams.ts eaaa55526460 restored, equal |
| L3.B14-slug | the unit guard against render() writing the dot: a heading slug that keeps U+00B7 | `src/render/slug.ts`: `const SLUG_DROP = /[^\p{L}\p{N}_\u4e00-\u9fff\- ]/gu;` → `const SLUG_DROP = /[^\p{L}\p{N}_\u4e00-\u9fff\u00b7\- ]/gu;` | rc 1, 2 failed \| 5 passed \| 43 skipped (50). AssertionError: expected true to be false // Object.is equality | src/render/slug.ts 07b84bbf97d2 restored, equal |
| L3.B14-anchor | the unit guard against render() writing the dot: an anchor grammar that admits U+00B7 | `src/render/allowlist.ts`: `  anchorId: '[A-Za-z0-9_-]{1,100}';` → `  anchorId: '[A-Za-z0-9_\u00b7-]{1,100}';`; `src/render/allowlist.ts`: `  anchorId: '[A-Za-z0-9_-]{1,100}' as const,` → `  anchorId: '[A-Za-z0-9_\u00b7-]{1,100}' as const,` | rc 1, 2 failed \| 5 passed \| 43 skipped (50). AssertionError: expected true to be false // Object.is equality | src/render/allowlist.ts 91df9e99a18c restored, equal |
| L3.B14-text | the text render() is handed is run()'s: skip dedent | `src/enhance/diagrams.ts`: `  return dedent(text)` → `  return text` | rc 1, 1 failed \| 49 passed (50). AssertionError: "flowchart LR\n  A --> B\n": expected 'flowchart LR\n  A --> B' to be 'flowchart LR\nA --> B' // Object.is equality | src/enhance/diagrams.ts eaaa55526460 restored, equal |
| L3.B14-shape | fail closed on a module without render: the shape check asks for run in place of render | `src/enhance/diagrams.ts`: `  return typeof m.initialize === 'function' && typeof m.render === 'function';` → `  return typeof m.initialize === 'function' && typeof (m as { run?: unknown }).run === 'function';` | rc 1, 38 failed \| 12 passed (50). AssertionError: expected 'failed' to be 'drawn' // Object.is equality | src/enhance/diagrams.ts eaaa55526460 restored, equal |
| F-B14-clock | L3.B14 runs on the fixed clock (run()'s name for the drawing is then known, and anchored as a twin) | `test/browser/frame-mermaid.test.ts`: `        await host.page.clock.setFixedTime(NOW);` → `(removed)` | rc 1, 2 failed \| 1 passed \| 7 skipped (10). AssertionError: corpus figure-captions.md graph: the frame's clock: expected 1793153382828 to be 1768478400000 // Object.is equality | test/browser/frame-mermaid.test.ts 107b817dd624 restored, equal |
| L3.B3p-control-v | the planted lazy reader of valueOf (inherited from Object.prototype, read as a free identifier, so the scan lists it) with the pin intact: the control, green | `src/frame-runtime/enhance-entry.ts`: `  const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });` → `  const api = Object.freeze({ enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]): Promise<void> => (typeof valueOf === 'function' ? enhance(root, options) : Promise.reject(new Error('clobbered'))), setEnhancementPrefs, destroyEnhancement, goToHash });` | rc 0, 1 passed \| 3 skipped (4) | src/frame-runtime/enhance-entry.ts 6651efeb2b6e restored, equal; the generated outputs restored, equal; `--check` 0 |
| L3.B3p-b-v | pin only absent names, with the planted lazy reader of valueOf | `src/frame-runtime/enhance-entry.ts`: `  const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });` → `  const api = Object.freeze({ enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]): Promise<void> => (typeof valueOf === 'function' ? enhance(root, options) : Promise.reject(new Error('clobbered'))), setEnhancementPrefs, destroyEnhancement, goToHash });`; `src/frame-runtime/pin.ts`: `    if (hasOwn.call(win, name)) continue;` → `    if (name in win) continue;` | rc 0, 1 passed \| 3 skipped (4) | src/frame-runtime/enhance-entry.ts 6651efeb2b6e, src/frame-runtime/pin.ts f206b0e379ab restored, equal; the generated outputs restored, equal; `--check` 0 |
| L3.B3p-a-v | skip pinFreeGlobals, with the planted lazy reader of valueOf (information: does an id ˋvalueOfˋ reach the reader at all?) | `src/frame-runtime/enhance-entry.ts`: `  const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });` → `  const api = Object.freeze({ enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]): Promise<void> => (typeof valueOf === 'function' ? enhance(root, options) : Promise.reject(new Error('clobbered'))), setEnhancementPrefs, destroyEnhancement, goToHash });`; `src/frame-runtime/bootstrap.ts`: `pinFreeGlobals(win, DOCSERVER_FREE_GLOBALS);` → `void DOCSERVER_FREE_GLOBALS;` | rc 1, 1 failed \| 3 skipped (4). AssertionError: expected [ 'yes\|no\|Start\|Choice\|Done', …(8) ] to deeply equal [ 'yes\|no\|Start\|Choice\|Done', …(10) ] | src/frame-runtime/bootstrap.ts a6f088df0d7b, src/frame-runtime/enhance-entry.ts 6651efeb2b6e restored, equal; the generated outputs restored, equal; `--check` 0 |

```json
[
  {
    "id": "L3.B14-a",
    "guard": "drop the prefix: the reader names each drawing `mermaid-<n>`, which an anchor can hold (the plan's row; frame build input, rebuilt)",
    "changes": [
      {
        "file": "src/enhance/diagrams.ts",
        "old": "export const DRAWING_ID_PREFIX = 'docreader\\u00b7';",
        "new": "export const DRAWING_ID_PREFIX = '';"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run (rc 0); the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-mermaid.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B14\"",
    "threads": 1433,
    "rc": 1,
    "result": "3 failed | 7 skipped (10)",
    "failing": [
      "test/browser/frame-mermaid.test.ts > chromium > L3.B14 (measurement row): an anchor for every id of each diagram kind's drawing the grammar admits and for each id's twins (run()'s name, the prefix-less name), the frame's clock fixed: the frame still readies with no violation, no request and one load",
      "test/browser/frame-mermaid.test.ts > chromium > L3.B14: every diagram draws with SVG text equal to the clean one, every reference resolves as in the clean drawing, and every anchor stays",
      "test/browser/frame-mermaid.test.ts > chromium > L3.B14p: the prefix's code point in the frame: a drawing's id finds it as an unescaped id selector, its own stylesheet styles it, and a url(#…) naming an id with the dot resolves"
    ],
    "assertions": [
      "AssertionError: expected 206 to be greater than or equal to 412",
      "AssertionError: expected { …(14) } to deeply equal {}",
      "AssertionError: expected { id: 'mermaid-0', dot: false, …(7) } to deeply equal { id: 'mermaid-0', dot: true, …(7) }"
    ],
    "sha256": {
      "src/enhance/diagrams.ts": "eaaa5552646018208d71487baa8b05586440b4ed8d3a8e13e310411219f88762"
    },
    "generated": {
      "assets/assets.json": "ee2edf3e76077808d69ae784ecb7fa34a05d17a0b806d8d10940c23e61771740",
      "src/frame/manifest.generated.ts": "fe293dacd68a439c43ccae70baafe75d801478a9dbe019dd22a20afbf6cf0dea",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "8510e846dac491b74d02063f1cda09a55bc84f481833017d4378edbcaceaeb6f",
      "assets/frame/enhance.js": "c6e99284d522e90b56fa5512504bf2eb3e47bc7ace5736308f85ba103f781d83",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true,
    "check": "node scripts/build-frame.mjs --check exited 0 after the restore"
  },
  {
    "id": "L3.B14-a-unit",
    "guard": "drop the prefix, read by the unit guard (no rebuild: the unit project imports the source)",
    "changes": [
      {
        "file": "src/enhance/diagrams.ts",
        "old": "export const DRAWING_ID_PREFIX = 'docreader\\u00b7';",
        "new": "export const DRAWING_ID_PREFIX = '';"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-diagrams.test.ts --maxWorkers=1 --fileParallelism=false",
    "threads": 1495,
    "rc": 1,
    "result": "1 failed | 49 passed (50)",
    "failing": [
      "test/enhance-diagrams.test.ts > diagrams: the drawing's name and how it is drawn (docserver L3, Task 8; ledger C95(1)) > the prefix is `docreader` and U+00B7 MIDDLE DOT, a punctuation code point, outside the anchor grammar and the slug alphabet"
    ],
    "assertions": [
      "AssertionError: expected '' to be 'docreader·' // Object.is equality"
    ],
    "sha256": {
      "src/enhance/diagrams.ts": "eaaa5552646018208d71487baa8b05586440b4ed8d3a8e13e310411219f88762"
    },
    "restored": true
  },
  {
    "id": "L3.B14-slug",
    "guard": "the unit guard against render() writing the dot: a heading slug that keeps U+00B7",
    "changes": [
      {
        "file": "src/render/slug.ts",
        "old": "const SLUG_DROP = /[^\\p{L}\\p{N}_\\u4e00-\\u9fff\\- ]/gu;",
        "new": "const SLUG_DROP = /[^\\p{L}\\p{N}_\\u4e00-\\u9fff\\u00b7\\- ]/gu;"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-diagrams.test.ts --maxWorkers=1 --fileParallelism=false -t \"drawing's name\"",
    "threads": 1477,
    "rc": 1,
    "result": "2 failed | 5 passed | 43 skipped (50)",
    "failing": [
      "test/enhance-diagrams.test.ts > diagrams: the drawing's name and how it is drawn (docserver L3, Task 8; ledger C95(1)) > the prefix is `docreader` and U+00B7 MIDDLE DOT, a punctuation code point, outside the anchor grammar and the slug alphabet",
      "test/enhance-diagrams.test.ts > diagrams: the drawing's name and how it is drawn (docserver L3, Task 8; ledger C95(1)) > render() writes the dot into no id: not by a heading, an anchor, a footnote or raw HTML, nor in any corpus document"
    ],
    "assertions": [
      "AssertionError: expected true to be false // Object.is equality",
      "AssertionError: crafted: expected [ 'docreader·mermaid-0', '·', …(1) ] to deeply equal []"
    ],
    "sha256": {
      "src/render/slug.ts": "07b84bbf97d2725e3843a87a6a7a2fa0e237218bcbf2ea1e9af61387eb6c0fe3"
    },
    "restored": true
  },
  {
    "id": "L3.B14-anchor",
    "guard": "the unit guard against render() writing the dot: an anchor grammar that admits U+00B7",
    "changes": [
      {
        "file": "src/render/allowlist.ts",
        "old": "  anchorId: '[A-Za-z0-9_-]{1,100}';",
        "new": "  anchorId: '[A-Za-z0-9_\\u00b7-]{1,100}';"
      },
      {
        "file": "src/render/allowlist.ts",
        "old": "  anchorId: '[A-Za-z0-9_-]{1,100}' as const,",
        "new": "  anchorId: '[A-Za-z0-9_\\u00b7-]{1,100}' as const,"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-diagrams.test.ts --maxWorkers=1 --fileParallelism=false -t \"drawing's name\"",
    "threads": 1460,
    "rc": 1,
    "result": "2 failed | 5 passed | 43 skipped (50)",
    "failing": [
      "test/enhance-diagrams.test.ts > diagrams: the drawing's name and how it is drawn (docserver L3, Task 8; ledger C95(1)) > the prefix is `docreader` and U+00B7 MIDDLE DOT, a punctuation code point, outside the anchor grammar and the slug alphabet",
      "test/enhance-diagrams.test.ts > diagrams: the drawing's name and how it is drawn (docserver L3, Task 8; ledger C95(1)) > render() writes the dot into no id: not by a heading, an anchor, a footnote or raw HTML, nor in any corpus document"
    ],
    "assertions": [
      "AssertionError: expected true to be false // Object.is equality",
      "AssertionError: crafted: expected [ 'docreader·mermaid-0', 'a·b' ] to deeply equal []"
    ],
    "sha256": {
      "src/render/allowlist.ts": "91df9e99a18cca8b151f37952078424dd2038473b507d889e49a6769f7edd6e3"
    },
    "restored": true
  },
  {
    "id": "L3.B14-text",
    "guard": "the text render() is handed is run()'s: skip dedent",
    "changes": [
      {
        "file": "src/enhance/diagrams.ts",
        "old": "  return dedent(text)\n",
        "new": "  return text\n"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-diagrams.test.ts --maxWorkers=1 --fileParallelism=false",
    "threads": 1473,
    "rc": 1,
    "result": "1 failed | 49 passed (50)",
    "failing": [
      "test/enhance-diagrams.test.ts > diagrams: the drawing's name and how it is drawn (docserver L3, Task 8; ledger C95(1)) > hands render() the source's text exactly as Mermaid's run() does: innerHTML, entities decoded, dedent, trim, <br/>"
    ],
    "assertions": [
      "AssertionError: \"flowchart LR\\n  A --> B\\n\": expected 'flowchart LR\\n  A --> B' to be 'flowchart LR\\nA --> B' // Object.is equality"
    ],
    "sha256": {
      "src/enhance/diagrams.ts": "eaaa5552646018208d71487baa8b05586440b4ed8d3a8e13e310411219f88762"
    },
    "restored": true
  },
  {
    "id": "L3.B14-shape",
    "guard": "fail closed on a module without render: the shape check asks for run in place of render",
    "changes": [
      {
        "file": "src/enhance/diagrams.ts",
        "old": "  return typeof m.initialize === 'function' && typeof m.render === 'function';",
        "new": "  return typeof m.initialize === 'function' && typeof (m as { run?: unknown }).run === 'function';"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-diagrams.test.ts --maxWorkers=1 --fileParallelism=false",
    "threads": 1477,
    "rc": 1,
    "result": "38 failed | 12 passed (50)",
    "failing": [
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > asks the host for the module once, as drawing starts, with the gate and the state set before anything is drawn",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > a module that is the API itself draws as well as one whose default export is the API",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > initialises before each drawing, with the reader's configuration: strict, dagre, the pinned limits, the warm theme, the secure keys and the host's",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > the host's limits replace the pinned defaults",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > takes the font family from the root's --sans when it is a plain list of families, and its own otherwise",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > draws into a chrome pre.mermaid beside the source, which is never written into, then marks the figure drawn and names the drawing",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > draws nothing before the next frame, so the page is painted first",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > lets the page run a task between the near figures and the rest",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > names a drawing by its caption, else by its own title, else by the first line of its source",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > a drawing named by its source skips a leading front-matter block whole, not only its fences",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > a drawing named by its source takes at most 80 characters of its first line",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > draws the figures near the viewport first, in document order, then the rest, nearest first",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > two Mermaid modules have a queue each: a call on one never waits for the other",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > takes the figure's width from the drawing's viewBox when Mermaid gave it no max-width, and none past 100000 px",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > a source of exactly maxTextSize characters is drawn",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > an initialize that throws as the module arrives: every figure still draws",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > the feature's second phase, run for an instance that is no longer live, asks for nothing and writes nothing",
      "test/enhance-diagrams.test.ts > diagrams: Mermaid's tooltip, which its drawings put in the body, outside every root > goes with the last instance that drew while it stood: the body is as it was",
      "test/enhance-diagrams.test.ts > diagrams: Mermaid's tooltip, which its drawings put in the body, outside every root > one shown over a node of a root that goes, while another root still draws with it, is closed by Mermaid's own mouseout",
      "test/enhance-diagrams.test.ts > diagrams: Mermaid's tooltip, which its drawings put in the body, outside every root > one the page already had is never removed nor changed",
      "test/enhance-diagrams.test.ts > diagrams: the drawing's name and how it is drawn (docserver L3, Task 8; ledger C95(1)) > puts the answered SVG text in the drawing as run()'s innerHTML would, and calls bindFunctions once with the drawing after",
      "test/enhance-diagrams.test.ts > diagrams: the drawing's name and how it is drawn (docserver L3, Task 8; ledger C95(1)) > a throw of bindFunctions is kept from the page, as run() keeps it: the drawing stays and the figure is drawn",
      "test/enhance-diagrams.test.ts > diagrams: the drawing's name and how it is drawn (docserver L3, Task 8; ledger C95(1)) > each drawing gets a name no drawing of this copy had before, across roots",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > marks each figure inside position.keep, so the reader keeps their place, and asks for a relayout for its content",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > a figure Mermaid could not draw falls back: draw-failed, and a note holding its source in a details",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > a drawing that left its figure (the host moved it) counts as failed",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > a source longer than maxTextSize is never handed to Mermaid: its note says it is too long",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > a module whose initialize throws leaves that figure to its fallback, and the others draw",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > a source the host moved out of its figure: the note or the drawing goes first in the figure, and the pass goes on",
      "test/enhance-diagrams.test.ts > diagrams: the drawing's name and how it is drawn (docserver L3, Task 8; ledger C95(1)) > an answer that holds no SVG text leaves its figure to its fallback, with the error note",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > serialises the calls per Mermaid module across roots: one root's drawing ends before the next initialize",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > a module that does not load, or is not Mermaid's, leaves every figure to its fallback with the load note",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > an initialize that destroys the instance: the drawing it was made for is never asked for",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > tells the module not to start on load as soon as it is here, before the fonts wait ends",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > the initialize made as a module arrives, queued behind another root's call, is never made once its instance is destroyed",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > a destroy during a pass stops it: the call in flight ends, no other is made, nothing is written",
      "test/enhance-diagrams.test.ts > diagrams: drawing (a fake Mermaid) > a destroyed root's queued call is never made, and the queue moves on to the next root",
      "test/enhance-diagrams.test.ts > diagrams: Mermaid's tooltip, which its drawings put in the body, outside every root > one a call made after its instance was destroyed goes at once"
    ],
    "assertions": [
      "AssertionError: expected 'failed' to be 'drawn' // Object.is equality",
      "AssertionError: expected 'failed' to be 'partial' // Object.is equality",
      "AssertionError: expected [] to deeply equal [ 'init tagA', 'render one' ]",
      "AssertionError: expected [ …(3) ] to deeply equal [ …(3) ]",
      "AssertionError: expected +0 to be 2 // Object.is equality",
      "AssertionError: expected [] to deeply equal [ 'init tagA' ]"
    ],
    "sha256": {
      "src/enhance/diagrams.ts": "eaaa5552646018208d71487baa8b05586440b4ed8d3a8e13e310411219f88762"
    },
    "restored": true
  },
  {
    "id": "F-B14-clock",
    "guard": "L3.B14 runs on the fixed clock (run()'s name for the drawing is then known, and anchored as a twin)",
    "changes": [
      {
        "file": "test/browser/frame-mermaid.test.ts",
        "old": "        await host.page.clock.setFixedTime(NOW);\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-mermaid.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B14\"",
    "threads": 1466,
    "rc": 1,
    "result": "2 failed | 1 passed | 7 skipped (10)",
    "failing": [
      "test/browser/frame-mermaid.test.ts > chromium > L3.B14 (measurement row): an anchor for every id of each diagram kind's drawing the grammar admits and for each id's twins (run()'s name, the prefix-less name), the frame's clock fixed: the frame still readies with no violation, no request and one load",
      "test/browser/frame-mermaid.test.ts > chromium > L3.B14: every diagram draws with SVG text equal to the clean one, every reference resolves as in the clean drawing, and every anchor stays"
    ],
    "assertions": [
      "AssertionError: corpus figure-captions.md graph: the frame's clock: expected 1793153382828 to be 1768478400000 // Object.is equality",
      "AssertionError: the measurement row ran: expected undefined to be defined"
    ],
    "sha256": {
      "test/browser/frame-mermaid.test.ts": "107b817dd62485f79a816f7db26765af45ee13a0cb10b6e7091aad970bf09391"
    },
    "restored": true
  },
  {
    "id": "L3.B3p-control-v",
    "guard": "the planted lazy reader of valueOf (inherited from Object.prototype, read as a free identifier, so the scan lists it) with the pin intact: the control, green",
    "changes": [
      {
        "file": "src/frame-runtime/enhance-entry.ts",
        "old": "  const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });",
        "new": "  const api = Object.freeze({ enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]): Promise<void> => (typeof valueOf === 'function' ? enhance(root, options) : Promise.reject(new Error('clobbered'))), setEnhancementPrefs, destroyEnhancement, goToHash });"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run (rc 0); the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-pins.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B3p\"",
    "threads": 1488,
    "rc": 0,
    "result": "1 passed | 3 skipped (4)",
    "failing": [],
    "assertions": [],
    "sha256": {
      "src/frame-runtime/enhance-entry.ts": "6651efeb2b6e7a83fe8b674b6a42ecf2ecf0ae80e1c252d24280505eba90d0df"
    },
    "generated": {
      "assets/assets.json": "ee2edf3e76077808d69ae784ecb7fa34a05d17a0b806d8d10940c23e61771740",
      "src/frame/manifest.generated.ts": "fe293dacd68a439c43ccae70baafe75d801478a9dbe019dd22a20afbf6cf0dea",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "8510e846dac491b74d02063f1cda09a55bc84f481833017d4378edbcaceaeb6f",
      "assets/frame/enhance.js": "c6e99284d522e90b56fa5512504bf2eb3e47bc7ace5736308f85ba103f781d83",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true,
    "check": "node scripts/build-frame.mjs --check exited 0 after the restore"
  },
  {
    "id": "L3.B3p-b-v",
    "guard": "pin only absent names, with the planted lazy reader of valueOf",
    "changes": [
      {
        "file": "src/frame-runtime/enhance-entry.ts",
        "old": "  const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });",
        "new": "  const api = Object.freeze({ enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]): Promise<void> => (typeof valueOf === 'function' ? enhance(root, options) : Promise.reject(new Error('clobbered'))), setEnhancementPrefs, destroyEnhancement, goToHash });"
      },
      {
        "file": "src/frame-runtime/pin.ts",
        "old": "    if (hasOwn.call(win, name)) continue;\n",
        "new": "    if (name in win) continue;\n"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run (rc 0); the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-pins.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B3p\"",
    "threads": 1521,
    "rc": 0,
    "result": "1 passed | 3 skipped (4)",
    "failing": [],
    "assertions": [],
    "sha256": {
      "src/frame-runtime/enhance-entry.ts": "6651efeb2b6e7a83fe8b674b6a42ecf2ecf0ae80e1c252d24280505eba90d0df",
      "src/frame-runtime/pin.ts": "f206b0e379ab23c83e8dae7a1a7253f618aab1eb11692178563a235e22a2e031"
    },
    "generated": {
      "assets/assets.json": "ee2edf3e76077808d69ae784ecb7fa34a05d17a0b806d8d10940c23e61771740",
      "src/frame/manifest.generated.ts": "fe293dacd68a439c43ccae70baafe75d801478a9dbe019dd22a20afbf6cf0dea",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "8510e846dac491b74d02063f1cda09a55bc84f481833017d4378edbcaceaeb6f",
      "assets/frame/enhance.js": "c6e99284d522e90b56fa5512504bf2eb3e47bc7ace5736308f85ba103f781d83",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true,
    "check": "node scripts/build-frame.mjs --check exited 0 after the restore"
  },
  {
    "id": "L3.B3p-a-v",
    "guard": "skip pinFreeGlobals, with the planted lazy reader of valueOf (information: does an id `valueOf` reach the reader at all?)",
    "changes": [
      {
        "file": "src/frame-runtime/enhance-entry.ts",
        "old": "  const api = Object.freeze({ enhance, setEnhancementPrefs, destroyEnhancement, goToHash });",
        "new": "  const api = Object.freeze({ enhance: (root: HTMLElement, options?: Parameters<typeof enhance>[1]): Promise<void> => (typeof valueOf === 'function' ? enhance(root, options) : Promise.reject(new Error('clobbered'))), setEnhancementPrefs, destroyEnhancement, goToHash });"
      },
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "pinFreeGlobals(win, DOCSERVER_FREE_GLOBALS);\n",
        "new": "void DOCSERVER_FREE_GLOBALS;\n"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run (rc 0); the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-pins.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B3p\"",
    "threads": 1481,
    "rc": 1,
    "result": "1 failed | 3 skipped (4)",
    "failing": [
      "test/browser/frame-pins.test.ts > chromium > L3.B3p: one anchor for every name of the built bootstrap's free-global list: ready with the right nonce, every diagram kind draws as in the clean document, a link routes"
    ],
    "assertions": [
      "AssertionError: expected [ 'yes|no|Start|Choice|Done', …(8) ] to deeply equal [ 'yes|no|Start|Choice|Done', …(10) ]"
    ],
    "sha256": {
      "src/frame-runtime/bootstrap.ts": "a6f088df0d7b815c80b183a9d790710c9edcb945884b925869d5f37901039c68",
      "src/frame-runtime/enhance-entry.ts": "6651efeb2b6e7a83fe8b674b6a42ecf2ecf0ae80e1c252d24280505eba90d0df"
    },
    "generated": {
      "assets/assets.json": "ee2edf3e76077808d69ae784ecb7fa34a05d17a0b806d8d10940c23e61771740",
      "src/frame/manifest.generated.ts": "fe293dacd68a439c43ccae70baafe75d801478a9dbe019dd22a20afbf6cf0dea",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "8510e846dac491b74d02063f1cda09a55bc84f481833017d4378edbcaceaeb6f",
      "assets/frame/enhance.js": "c6e99284d522e90b56fa5512504bf2eb3e47bc7ace5736308f85ba103f781d83",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true,
    "check": "node scripts/build-frame.mjs --check exited 0 after the restore"
  }
]
```

## Second round, fix round (review findings T8b-C1, T8b-C2, S1, S2, E1, E2, E3, E4, E5)

Measured 2026-10-28 (UTC) on Chromium (C69), on the same branch and base with the fix round's changes not yet committed, by the runner and method of the second round. Final files the rows ran on (sha256 prefix): `src/enhance/journal.ts` `a5b7474a7886…`, `src/frame-runtime/bootstrap.ts` `64a0c426ca5c…`, `src/enhance/diagrams.ts` `54e4aa65860a…`, `test/enhance-svg-clone.test.ts` `db72f40678cf…`, `test/browser/diagram-tools.test.ts` `99b39a569568…`, `test/browser/frame-boot.test.ts` `016c891f7762…`, `test/browser/frame-mermaid.test.ts` `06a48ead05b7…`. Every restore matched; every rebuilding row's `--check` exited 0.

- **The full-screen copy under the drawing's new name (T8b-C1, S1, E1).** The full-screen viewer copies a drawing through `journal.cloneSvg`, which rebinds the drawing's ids to the copy's own: in its stylesheet's selectors, in `url(#…)` and in `href`. Its three id patterns read ASCII only, so on a drawing named `docreader·mermaid-<n>` none of them matched: the copy kept `#docreader·mermaid-0 …` rules that no longer matched it (its root is renamed), so its nodes lost the theme's fill (black, measured), and its markers and gradients still named the inline drawing's. `src/enhance/journal.ts` (outside Task 8's Files line, named here as the prefix's consequence) now takes every code point from U+0080 in the three id tokens, as a CSS ident does. New rows: a unit row in `test/enhance-svg-clone.test.ts` (a Mermaid-shaped drawing named with `DRAWING_ID_PREFIX`: the copy's style text names the copy, every reference resolves inside it, no U+00B7 left) and a browser row in `test/browser/diagram-tools.test.ts` on both engines through `describeBrowsers` (a real flowchart opened full screen: the copy's references all resolve inside it, its style names the copy and not the drawing, and its node fill is the theme's `primaryColor`, as the drawing's). Both were red before the change (TDD), and each of the three patterns narrowed back to ASCII is red alone (T8b-clone-url, -href, -selector), all three together red in the browser (T8b-clone-browser).
- **The frame's Mermaid shape check (T8b-C2, S2, E3).** The bootstrap asked for `initialize` and `run`, while the reader calls `initialize` and `render`. It now asks for `initialize` and `render` (`src/frame-runtime/bootstrap.ts`, Task 5's file; the bootstrap's bytes and hash move, 27,686 to 27,689 bytes against its 32 KiB budget), and the plan's Reference §6 step 1 and its B6b text are amended. Two new L3.B6b rows in `test/browser/frame-boot.test.ts`, both engines: an API with `initialize` and `run` but no `render` gives ready, then `error{why:'mermaid'}`; an API with `initialize` and `render` but no `run` boots and fails per figure (ready, no error, `failed`). Both were red before the change; the old check restored (T8b-B6b-run) reds both, and a check asking for `run` as well (T8b-B6b-both) reds the second. The existing row "an API without run" registers neither function and stays green.
- **L3.B14's coverage assertion (E2).** The measurement row's `anchored + unproducible === collected` held by construction. It is replaced by a per-case assertion that every id outside the anchor grammar names the drawing (so it is anchored as its twins), and by `unproducible === timed` over the cases. Green on the final code; under the drop-the-prefix mutant (L3.B14-a-r2, re-measured) the measurement row now fails on that line first (`expected +0 to be 206`: with no prefix every id is in the grammar), and the criterion row is red as before, with the same damage (14 cases, 14 drawings taken, 14 anchors removed, 8 references taken).
- **The comment on the engines (E4).** `src/enhance/diagrams.ts` now says L3.B14p holds the dot on each engine CI runs; locally only Chromium measured it, WebKit is CI's.
- E5 corrected the second round's report only (the WebKit copies were the skipped rows).

Figures after the fix round, Chromium: L3.B14 14 cases, 214 ids collected, 8 anchored as they are, 206 outside the anchor grammar (each naming the drawing), 412 twins anchored, **0 cases damaged**; L3.B14p `docreader·mermaid-0`; L3.B1 insertion to ready 543.1 ms (srcdoc 4,522,012 characters); L3.B16 DOMContentLoaded to the root median 12 ms, max 16.9 ms, insertion to ready median 186.7 ms, max 200.7 ms (srcdoc 1,161,247 characters); first SHA-256 hash: Mermaid 56.5 ms, enhance 3, css 6.9, bootstrap 0.4, guard 0.3; L3.D5 insertion to ready 418.8 ms, tap to drawn 1118 ms; L3.B3p 117 names pinned.

| Row | Guard | Change | Result | Restore |
|---|---|---|---|---|
| T8b-clone-url | the full-screen copy's url(#…) id token takes U+0080 and up: narrowed back to ASCII | `src/enhance/journal.ts`: `const LOCAL_URL = /^url\(\s*(?:['"])?#([A-Za-z][\w:.\u0080-\uffff-]*)(?:['"])?\s*\)$/i;` → `const LOCAL_URL = /^url\(\s*(?:['"])?#([A-Za-z][\w:.-]*)(?:['"])?\s*\)$/i;` | rc 1, 1 failed \| 8 passed (9). AssertionError: expected '#docreader\.1\.figure{font-family:ser…' to be '#docreader\.1\.figure{font-family:ser…' // Object.is equality | src/enhance/journal.ts a5b7474a7886 restored, equal |
| T8b-clone-href | the full-screen copy's href id token takes U+0080 and up: narrowed back to ASCII | `src/enhance/journal.ts`: `const LOCAL_HREF = /^#([A-Za-z][\w:.\u0080-\uffff-]*)$/;` → `const LOCAL_HREF = /^#([A-Za-z][\w:.-]*)$/;` | rc 1, 1 failed \| 8 passed (9). AssertionError: expected '#docreader·mermaid-0-flowchart-A-0' to be '#docreader.1.figure.3' // Object.is equality | src/enhance/journal.ts a5b7474a7886 restored, equal |
| T8b-clone-selector | the full-screen copy's stylesheet selector id takes U+0080 and up: narrowed back to ASCII | `src/enhance/journal.ts`: `const escaped = /^#((?:[A-Za-z0-9_\u0080-\uffff-]+\|\\.)+)/.exec(value.slice(at));` → `const escaped = /^#((?:[A-Za-z0-9_-]+\|\\.)+)/.exec(value.slice(at));` | rc 1, 1 failed \| 8 passed (9). AssertionError: expected '#docreader·mermaid-0{font-family:seri…' to be '#docreader\.1\.figure{font-family:ser…' // Object.is equality | src/enhance/journal.ts a5b7474a7886 restored, equal |
| T8b-clone-browser | all three id tokens narrowed back to ASCII (be4324f's journal.ts), a real drawing in the browser | `src/enhance/journal.ts`: `const LOCAL_URL = /^url\(\s*(?:['"])?#([A-Za-z][\w:.\u0080-\uffff-]*)(?:['"])?\s*\)$/i;` → `const LOCAL_URL = /^url\(\s*(?:['"])?#([A-Za-z][\w:.-]*)(?:['"])?\s*\)$/i;`; `src/enhance/journal.ts`: `const LOCAL_HREF = /^#([A-Za-z][\w:.\u0080-\uffff-]*)$/;` → `const LOCAL_HREF = /^#([A-Za-z][\w:.-]*)$/;`; `src/enhance/journal.ts`: `const escaped = /^#((?:[A-Za-z0-9_\u0080-\uffff-]+\|\\.)+)/.exec(value.slice(at));` → `const escaped = /^#((?:[A-Za-z0-9_-]+\|\\.)+)/.exec(value.slice(at));` | rc 1, 1 failed \| 25 skipped (26). AssertionError: expected { dotted: true, refs: 6, …(5) } to deeply equal { dotted: true, …(6) } | src/enhance/journal.ts a5b7474a7886 restored, equal |
| T8b-B6b-run | the frame's shape check asks for initialize and render: asks for run instead (be4324f's check; rebuilt) | `src/frame-runtime/bootstrap.ts`: `typeof mermaidModule['render'] !== 'function') {` → `typeof mermaidModule['run'] !== 'function') {` | rc 1, 2 failed \| 2 passed \| 72 skipped (76). AssertionError: expected [ { t: 'ready', v: 1, …(1) } ] to deeply equal [ { t: 'ready', v: 1, …(1) }, …(1) ]; AssertionError: expected [ { t: 'ready', v: 1, …(1) }, …(1) ] to deeply equal [ { t: 'ready', v: 1, …(1) } ] | src/frame-runtime/bootstrap.ts 64a0c426ca5c restored, equal; the generated outputs restored, equal; `--check` 0 |
| T8b-B6b-both | the frame's shape check asks for nothing the reader does not call: asks for run as well (rebuilt) | `src/frame-runtime/bootstrap.ts`: `typeof mermaidModule['render'] !== 'function') {` → `typeof mermaidModule['render'] !== 'function' \|\| typeof mermaidModule['run'] !== 'function') {` | rc 1, 1 failed \| 3 passed \| 72 skipped (76). AssertionError: expected [ { t: 'ready', v: 1, …(1) }, …(1) ] to deeply equal [ { t: 'ready', v: 1, …(1) } ] | src/frame-runtime/bootstrap.ts 64a0c426ca5c restored, equal; the generated outputs restored, equal; `--check` 0 |
| L3.B14-a-r2 | drop the prefix: the reader names each drawing ˋmermaid-<n>ˋ, which an anchor can hold (the plan's row; re-measured on the fix round's rows; rebuilt) | `src/enhance/diagrams.ts`: `export const DRAWING_ID_PREFIX = 'docreader\u00b7';` → `export const DRAWING_ID_PREFIX = '';` | rc 1, 3 failed \| 7 skipped (10). AssertionError: expected +0 to be 206 // Object.is equality; AssertionError: expected { …(14) } to deeply equal {}; AssertionError: expected { id: 'mermaid-0', dot: false, …(7) } to deeply equal { id: 'mermaid-0', dot: true, …(7) } | src/enhance/diagrams.ts 54e4aa65860a restored, equal; the generated outputs restored, equal; `--check` 0 |

The T8b-clone-url row's message is cut where both strings agree: the difference is the `.marker` rule's `url(#docreader·mermaid-0_grad)`, left unmapped.

```json
[
  {
    "id": "T8b-clone-url",
    "guard": "the full-screen copy's url(#…) id token takes U+0080 and up: narrowed back to ASCII",
    "changes": [
      {
        "file": "src/enhance/journal.ts",
        "old": "const LOCAL_URL = /^url\\(\\s*(?:['\"])?#([A-Za-z][\\w:.\\u0080-\\uffff-]*)(?:['\"])?\\s*\\)$/i;",
        "new": "const LOCAL_URL = /^url\\(\\s*(?:['\"])?#([A-Za-z][\\w:.-]*)(?:['\"])?\\s*\\)$/i;"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-svg-clone.test.ts --maxWorkers=1 --fileParallelism=false --reporter=default",
    "threads": 1487,
    "rc": 1,
    "result": "1 failed | 8 passed (9)",
    "failing": [
      "|unit| test/enhance-svg-clone.test.ts > journal SVG clone > rebinds a drawing named with the reader's prefix: its own stylesheet, url(#…) and href references move to the copy"
    ],
    "assertions": [
      "AssertionError: expected '#docreader\\.1\\.figure{font-family:ser…' to be '#docreader\\.1\\.figure{font-family:ser…' // Object.is equality"
    ],
    "sha256": {
      "src/enhance/journal.ts": "a5b7474a7886d020c14fb76080fa934e4edff63bd636718c9ea331d9abab9563"
    },
    "restored": true
  },
  {
    "id": "T8b-clone-href",
    "guard": "the full-screen copy's href id token takes U+0080 and up: narrowed back to ASCII",
    "changes": [
      {
        "file": "src/enhance/journal.ts",
        "old": "const LOCAL_HREF = /^#([A-Za-z][\\w:.\\u0080-\\uffff-]*)$/;",
        "new": "const LOCAL_HREF = /^#([A-Za-z][\\w:.-]*)$/;"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-svg-clone.test.ts --maxWorkers=1 --fileParallelism=false --reporter=default",
    "threads": 1450,
    "rc": 1,
    "result": "1 failed | 8 passed (9)",
    "failing": [
      "|unit| test/enhance-svg-clone.test.ts > journal SVG clone > rebinds a drawing named with the reader's prefix: its own stylesheet, url(#…) and href references move to the copy"
    ],
    "assertions": [
      "AssertionError: expected '#docreader·mermaid-0-flowchart-A-0' to be '#docreader.1.figure.3' // Object.is equality"
    ],
    "sha256": {
      "src/enhance/journal.ts": "a5b7474a7886d020c14fb76080fa934e4edff63bd636718c9ea331d9abab9563"
    },
    "restored": true
  },
  {
    "id": "T8b-clone-selector",
    "guard": "the full-screen copy's stylesheet selector id takes U+0080 and up: narrowed back to ASCII",
    "changes": [
      {
        "file": "src/enhance/journal.ts",
        "old": "const escaped = /^#((?:[A-Za-z0-9_\\u0080-\\uffff-]+|\\\\.)+)/.exec(value.slice(at));",
        "new": "const escaped = /^#((?:[A-Za-z0-9_-]+|\\\\.)+)/.exec(value.slice(at));"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-svg-clone.test.ts --maxWorkers=1 --fileParallelism=false --reporter=default",
    "threads": 1442,
    "rc": 1,
    "result": "1 failed | 8 passed (9)",
    "failing": [
      "|unit| test/enhance-svg-clone.test.ts > journal SVG clone > rebinds a drawing named with the reader's prefix: its own stylesheet, url(#…) and href references move to the copy"
    ],
    "assertions": [
      "AssertionError: expected '#docreader·mermaid-0{font-family:seri…' to be '#docreader\\.1\\.figure{font-family:ser…' // Object.is equality"
    ],
    "sha256": {
      "src/enhance/journal.ts": "a5b7474a7886d020c14fb76080fa934e4edff63bd636718c9ea331d9abab9563"
    },
    "restored": true
  },
  {
    "id": "T8b-clone-browser",
    "guard": "all three id tokens narrowed back to ASCII (be4324f's journal.ts), a real drawing in the browser",
    "changes": [
      {
        "file": "src/enhance/journal.ts",
        "old": "const LOCAL_URL = /^url\\(\\s*(?:['\"])?#([A-Za-z][\\w:.\\u0080-\\uffff-]*)(?:['\"])?\\s*\\)$/i;",
        "new": "const LOCAL_URL = /^url\\(\\s*(?:['\"])?#([A-Za-z][\\w:.-]*)(?:['\"])?\\s*\\)$/i;"
      },
      {
        "file": "src/enhance/journal.ts",
        "old": "const LOCAL_HREF = /^#([A-Za-z][\\w:.\\u0080-\\uffff-]*)$/;",
        "new": "const LOCAL_HREF = /^#([A-Za-z][\\w:.-]*)$/;"
      },
      {
        "file": "src/enhance/journal.ts",
        "old": "const escaped = /^#((?:[A-Za-z0-9_\\u0080-\\uffff-]+|\\\\.)+)/.exec(value.slice(at));",
        "new": "const escaped = /^#((?:[A-Za-z0-9_-]+|\\\\.)+)/.exec(value.slice(at));"
      }
    ],
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/diagram-tools.test.ts --maxWorkers=1 --fileParallelism=false -t \"under the reader's drawing name\" --reporter=default",
    "threads": 1428,
    "rc": 1,
    "result": "1 failed | 25 skipped (26)",
    "failing": [
      "|layout| test/browser/diagram-tools.test.ts > chromium > rebinds a real drawing's own stylesheet and references to its fullscreen copy, under the reader's drawing name"
    ],
    "assertions": [
      "AssertionError: expected { dotted: true, refs: 6, …(5) } to deeply equal { dotted: true, …(6) }"
    ],
    "sha256": {
      "src/enhance/journal.ts": "a5b7474a7886d020c14fb76080fa934e4edff63bd636718c9ea331d9abab9563"
    },
    "restored": true
  },
  {
    "id": "T8b-B6b-run",
    "guard": "the frame's shape check asks for initialize and render: asks for run instead (be4324f's check; rebuilt)",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "typeof mermaidModule['render'] !== 'function') {",
        "new": "typeof mermaidModule['run'] !== 'function') {"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run (rc 0); the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-boot.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B6b\" --reporter=default",
    "threads": 1418,
    "rc": 1,
    "result": "2 failed | 2 passed | 72 skipped (76)",
    "failing": [
      "|layout| test/browser/frame-boot.test.ts > chromium > L3.B6b: a Mermaid script replaced by one that registers an API with initialize and run but no render (its hash re-pinned) gives ready, then error mermaid",
      "|layout| test/browser/frame-boot.test.ts > chromium > L3.B6b: a Mermaid script replaced by one that registers an API with initialize and render but no run (its hash re-pinned) gives ready and no error, every figure failed"
    ],
    "assertions": [
      "AssertionError: expected [ { t: 'ready', v: 1, …(1) } ] to deeply equal [ { t: 'ready', v: 1, …(1) }, …(1) ]",
      "AssertionError: expected [ { t: 'ready', v: 1, …(1) }, …(1) ] to deeply equal [ { t: 'ready', v: 1, …(1) } ]"
    ],
    "sha256": {
      "src/frame-runtime/bootstrap.ts": "64a0c426ca5cd8d61968c951b99484f0c86d14c736ccd38c0c0acbef490ee8a2"
    },
    "generated": {
      "assets/assets.json": "0ff290c4762f909013912d5cedada95106f39cee61e2398b36e598fed636084d",
      "src/frame/manifest.generated.ts": "7efe6c75a2d51cd423c8682391fe28197110ac41c4997adce2b36d0b40d36cbb",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "7660d62d5edc48db520205fd2d24041f409b35270b2739d5f43497abef06310c",
      "assets/frame/enhance.js": "0079625cc30a573a36959fbf93573d5ca50ec2cd6e2541391517db6ccaaf2929",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true,
    "check": "node scripts/build-frame.mjs --check exited 0 after the restore"
  },
  {
    "id": "T8b-B6b-both",
    "guard": "the frame's shape check asks for nothing the reader does not call: asks for run as well (rebuilt)",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "typeof mermaidModule['render'] !== 'function') {",
        "new": "typeof mermaidModule['render'] !== 'function' || typeof mermaidModule['run'] !== 'function') {"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run (rc 0); the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-boot.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B6b\" --reporter=default",
    "threads": 1447,
    "rc": 1,
    "result": "1 failed | 3 passed | 72 skipped (76)",
    "failing": [
      "|layout| test/browser/frame-boot.test.ts > chromium > L3.B6b: a Mermaid script replaced by one that registers an API with initialize and render but no run (its hash re-pinned) gives ready and no error, every figure failed"
    ],
    "assertions": [
      "AssertionError: expected [ { t: 'ready', v: 1, …(1) }, …(1) ] to deeply equal [ { t: 'ready', v: 1, …(1) } ]"
    ],
    "sha256": {
      "src/frame-runtime/bootstrap.ts": "64a0c426ca5cd8d61968c951b99484f0c86d14c736ccd38c0c0acbef490ee8a2"
    },
    "generated": {
      "assets/assets.json": "0ff290c4762f909013912d5cedada95106f39cee61e2398b36e598fed636084d",
      "src/frame/manifest.generated.ts": "7efe6c75a2d51cd423c8682391fe28197110ac41c4997adce2b36d0b40d36cbb",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "7660d62d5edc48db520205fd2d24041f409b35270b2739d5f43497abef06310c",
      "assets/frame/enhance.js": "0079625cc30a573a36959fbf93573d5ca50ec2cd6e2541391517db6ccaaf2929",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true,
    "check": "node scripts/build-frame.mjs --check exited 0 after the restore"
  },
  {
    "id": "L3.B14-a-r2",
    "guard": "drop the prefix: the reader names each drawing `mermaid-<n>`, which an anchor can hold (the plan's row; re-measured on the fix round's rows; rebuilt)",
    "changes": [
      {
        "file": "src/enhance/diagrams.ts",
        "old": "export const DRAWING_ID_PREFIX = 'docreader\\u00b7';",
        "new": "export const DRAWING_ID_PREFIX = '';"
      }
    ],
    "rebuild": "node scripts/build-frame.mjs before the run (rc 0); the generated outputs restored after it",
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/frame-mermaid.test.ts --maxWorkers=1 --fileParallelism=false -t \"L3.B14\" --reporter=default",
    "threads": 1454,
    "rc": 1,
    "result": "3 failed | 7 skipped (10)",
    "failing": [
      "|layout| test/browser/frame-mermaid.test.ts > chromium > L3.B14 (measurement row): an anchor for every id of each diagram kind's drawing the grammar admits and for each id's twins (run()'s name, the prefix-less name), the frame's clock fixed: the frame still readies with no violation, no request and one load",
      "|layout| test/browser/frame-mermaid.test.ts > chromium > L3.B14: every diagram draws with SVG text equal to the clean one, every reference resolves as in the clean drawing, and every anchor stays",
      "|layout| test/browser/frame-mermaid.test.ts > chromium > L3.B14p: the prefix's code point in the frame: a drawing's id finds it as an unescaped id selector, its own stylesheet styles it, and a url(#…) naming an id with the dot resolves"
    ],
    "assertions": [
      "AssertionError: expected +0 to be 206 // Object.is equality",
      "AssertionError: expected { …(14) } to deeply equal {}",
      "AssertionError: expected { id: 'mermaid-0', dot: false, …(7) } to deeply equal { id: 'mermaid-0', dot: true, …(7) }"
    ],
    "sha256": {
      "src/enhance/diagrams.ts": "54e4aa65860a8846e8e537ac1e7b309145d56bb6315515ffdba9fa43446e52ec"
    },
    "generated": {
      "assets/assets.json": "0ff290c4762f909013912d5cedada95106f39cee61e2398b36e598fed636084d",
      "src/frame/manifest.generated.ts": "7efe6c75a2d51cd423c8682391fe28197110ac41c4997adce2b36d0b40d36cbb",
      "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
      "assets/frame/bootstrap.js": "7660d62d5edc48db520205fd2d24041f409b35270b2739d5f43497abef06310c",
      "assets/frame/enhance.js": "0079625cc30a573a36959fbf93573d5ca50ec2cd6e2541391517db6ccaaf2929",
      "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489",
      "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
      "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
    },
    "restored": true,
    "check": "node scripts/build-frame.mjs --check exited 0 after the restore"
  }
]
```

## Recorded, not mutated

- **L3.B1** is the policy's control row; its own control (a policy without the bootstrap's hash gives no port message, and the parent hears the refusal) is part of the row and green on the final code.
- **L3.B14 is green with the id prefix** (ledger C95(1); corrected entry, second round above). History, kept because it explains the guard: on the first round's code the reader drew through Mermaid's `run()`, which names each drawing `mermaid-<Date.now()>` (`node_modules/mermaid/dist/mermaid.core.mjs` line 1546; `InitIDGenerator` in `chunk-3YJQHVM4.mjs`) and looks that name up in the whole document while it draws. The first round's green row anchored ids on the page's own clock, so its anchors never met the drawing; with the page's clock fixed (Playwright's page clock, asserted in every mount) the plan's criterion was red in 14 of 14 cases (the drawing taken by the anchor carrying its name 14 times, the `d<name>` anchor removed 14 times, 8 marker or gradient references resolved to an anchor), the damage staying inside the frame (no violation, no request, no second load). Ledger C95(1) ruled option (a): the reader draws through `render(id, text, container)` under `docreader·mermaid-<n>` and inserts the SVG through an inert `DOMParser` parse; (b) renaming after the draw and (c) narrowing `render()`'s ids were rejected, and `deterministicIds` is no answer (`mermaid-0` is authorable). Now: L3.B14 (measurement) and L3.B14 (criterion) are plain rows, green, with run()'s name and the prefix-less name of every drawing id anchored as twins (0 of 14 cases damaged); L3.B14p measures the dot in the frame; the prefix's mutation row L3.B14-a is red. F-B14-clock (the fix round's row) was re-measured on the rewritten row: red. In the second round's fix round the measurement row's coverage check became real (every id outside the grammar names the drawing), the drop-the-prefix row was measured again (L3.B14-a-r2: red), and the full-screen copy was made to rebind the dotted ids (T8b-clone rows: red).
- **L3.B16** and the SHA-256 and 2 MiB figures are measurement rows.
- **L3.B12**: the parity row re-run on the integrated build (green), plus a Node row holding that the two files drawn are the shipped bytes (the classic file's sha256 is `FRAME_MANIFEST.mermaid.sha256`, the module's is `assets/assets.json`'s).
