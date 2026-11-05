# Batch Task 5: mutation rows (browser rows for drawing after ready)

Step 1 of the task had no earlier red, because the harness already had `send` (the parent's port end), so there was no state before the harness could post the op; row B5a (the harness posts the text with one character changed) stands for it.

## Method

Each row was measured in place on branch `ws/docserver-release-1-1`, one at a time, by one driver run over all rows (after the fix round: every row measured again on the tree of the fix-round commit). For each row: the bytes of every edited file were saved with their sha256 (and, for a row that edits a frame build input, the generated outputs `assets/assets.json`, `src/frame/manifest.generated.ts` and `assets/frame/*`); the edits were applied; `npm run build:frame` ran for such a row; the named file ran on Chromium (`DOCREADER_BROWSERS=chromium`) as `./node_modules/.bin/vitest run --maxWorkers=2 --reporter=json <file>` behind `timeout -k 10 600` and a `ulimit -u` of the measured thread count plus 1500; then every saved file was written back from its saved bytes (a byte copy, never a VCS restore) and its sha256 compared with the saved one (`restored`, and `sha256After` equals `sha256` in the JSON). `node scripts/build-frame.mjs --check` ran after EVERY row, after the restore (field `checkAfterRestore`, 0 in every row), and the generated outputs equal their hashes from before the first row after every row (field `generatedOutputsUnchanged`; the hashes of the generated outputs are the `generatedOutputs` object at the top of the JSON). WebKit runs in CI only. The item is ledger C107. The test file is `test/browser/mermaid-after-ready.test.ts` unless a row names another. A row that edits only a test file (B5a) built nothing.

Rows B5a to B5g are the brief's. B5g is the brief's edit alone (`src/enhance/diagrams.ts`: the gate and `drawing` set before `load()` answers); B5g3 is the compound of that edit and `waitsForDrawing` true for `'after-ready'`. The brief's reading, "so the bootstrap's `diagramsSettled` holds `ready`", needs the second edit: the bootstrap awaits `diagramsSettled` only under `waitsForDrawing` (`bootstrap.ts`), so the L2 edit alone leaves `ready` coming at once and changes only what the root reads at that instant (`drawing` for `waiting`): red through B5.2 and B2.1 of `test/enhance-mermaid-after-ready.test.ts`. The compound makes the bootstrap wait for a build that only comes after ready, so no ready arrives at all. B5g2 (`waitsForDrawing` alone) is an equivalent mutant: `diagramsSettled` resolves at once unless the root reads exactly `drawing`, and the op cannot be accepted before `settled`, so the root still reads `waiting`.

Added by the the wave's rulings and the fix round: B5i (the count check of `lateApi`, red through the second construction of B5.5, a forged register on the inserted element), B5c2 (the document listener taking the first registration of any target, so the forged one wins), B5k (the target check of `lateApi` alone, red through the third construction of B5.5: the real register stopped, a bubbling forged one on the inserted script's Text child, one registration of another target), B5h and B5h2 (the `unavailable` early return), B5j (the settled-state check of the port handler, held by the `holdSettled` instrumentation), B5l (B3g's edit, `if (seed.mermaid !== null) {`, red through frame-boot's B5.C: `error mermaid` instead of `ready` only).

## Verdicts

Every row is red through assertions except as noted:

- B5g2 stays green: an equivalent mutant (above).
- B5b3 and B5b4 stay green on this path (superseded: fix round FR1 gave B5b3 a case of its own and recorded B5b4 as an equivalent mutant on Chromium, B5b5 and B5b6 below). The blocked script's violation arrives after `ready`, and `onViolation` has two guards that each keep it from failing the frame there: `if (done) return` and the exception for a blocked inline script. Dropping either alone leaves the other, so each survives because the other guard also holds after ready. The guards' own jobs lie elsewhere: B5b3's `done` guard also stops a non-inline violation after ready from failing the frame, and B5b4's exception's job is before ready. No row in this batch measures either; parked (ledger C107). B5b drops both (the brief's first form, "fail the frame on that violation"), and goes red through B5.4's prefs op: the failed frame drops it (`data-font` stays `serif`).
- B5h is red by a renderer crash, not an assertion: the test's `frame.evaluate` rejected with `Target crashed`. It reproduced on a second run (row B5h-rerun). The cause is not established; the plain drop inserts a script whose text is the empty string (the `textContent` setter makes `undefined` empty, as in B5h2), and no further explanation is claimed. B5h2 reads the unavailable op's missing text as an empty script explicitly, and is the assertion red for the guard (B5.U's script count, 5 against 4).
- B5b2 is the form that leaves the figures `waiting` when the blocked script registers nothing (B5.4's state assertion).

Known and parked (ledger C107): a forger that runs in the frame before the handover can stop the real register event in a document capture listener and then dispatch a forged one on the inserted element itself; `lateApi` then sees one registration from the right target. No test covers it, and none is added: the frame's hash-only policy leaves no script in the frame but its own, so the construction is not reachable from document content. B5.5's third construction (on the Text child) shows the target check refusing the nearest neighbour of it.

## The rows

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| B5a | exact text | `test/browser/mermaid-after-ready.test.ts` | `const mermaidOp = (text: string): { t: 'mermaid'; text: string } => ({ t: 'mermaid', text });` → `const mermaidOp = (text: string): { t: 'mermaid'; text: string } => ({ t: 'mermaid', text: `${text.slice(0, 2000)}\u0001${text.slice(2001)}` });` | `test/browser/mermaid-after-ready.test.ts`: 7 failed | 4 passed (11). Red tests: B5.1; B5.2; B5.5; B5.5; B5.5; B5.6; B5.7 | `mermaid-after-ready.test.ts` sha256 `33725f28d7e1cbb662fa71b49f1003af3a7878939064903133a24715d78daa6c` restored, equal; generated outputs unchanged; `--check` green |
| B5b | wrong text degrades: the frame is not failed by the blocked script's violation (the `if (done) return` and the blocked-inline exception both dropped, so the violation fails the frame after ready) | `src/frame-runtime/bootstrap.ts` | `if (done) return; ⏎     const directive: unknown = directiveOf?.call(e); ⏎     const blocked: unknown = blockedOf?.call(e); ⏎     if ((directive === 'script-src-elem' \|\| directive === 'script-src') && (blocked === 'inline' \|\| blocked === '')) return; ⏎     fail('boot');` → `fail('boot');` | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 10 passed (11). Red tests: B5.4 | `bootstrap.ts` sha256 `ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85` restored, equal; generated outputs unchanged; `--check` green |
| B5b2 | wrong text degrades (the figures are left waiting when the blocked script registers nothing) | `src/frame-runtime/bootstrap.ts` | `settleLate(lateApi(seen, inserted));` → `if (seen.length > 0) settleLate(lateApi(seen, inserted));` | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 10 passed (11). Red tests: B5.4 | `bootstrap.ts` sha256 `ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85` restored, equal; generated outputs unchanged; `--check` green |
| B5b3 | the `if (done) return` of onViolation alone (the blocked-inline exception still holds) | `src/frame-runtime/bootstrap.ts` | `if (done) return; ⏎     const directive` → `const directive` | `test/browser/mermaid-after-ready.test.ts`: 0 failed | 11 passed (11). Stays green on this path: the other guard also holds after ready; the guard's own job lies elsewhere and is parked (argued above) | `bootstrap.ts` sha256 `ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85` restored, equal; generated outputs unchanged; `--check` green |
| B5b4 | the blocked-inline exception of onViolation alone (`if (done) return` still holds) | `src/frame-runtime/bootstrap.ts` | `if ((directive === 'script-src-elem' \|\| directive === 'script-src') && (blocked === 'inline' \|\| blocked === '')) return;` → (removed) | `test/browser/mermaid-after-ready.test.ts`: 0 failed | 11 passed (11). Stays green on this path: the other guard also holds after ready; the guard's own job lies elsewhere and is parked (argued above) | `bootstrap.ts` sha256 `ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85` restored, equal; generated outputs unchanged; `--check` green |
| B5c | element identity (the register listener on the document, capture phase, not on the inserted element) | `src/frame-runtime/bootstrap.ts` | `add.call(el, 'docserver:register', onBuild, false);` → `add.call(doc, 'docserver:register', onBuild, true);`; `remove.call(el, 'docserver:register', onBuild, false);` → `remove.call(doc, 'docserver:register', onBuild, true);` | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 10 passed (11). Red tests: B5.5 | `bootstrap.ts` sha256 `ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85` restored, equal; generated outputs unchanged; `--check` green |
| B5c2 | element identity, and the one-registration and target checks of lateApi (the document listener accepting the first registration of any target: the forged one wins) | `src/frame-runtime/adapters.ts`, `src/frame-runtime/bootstrap.ts` | `add.call(el, 'docserver:register', onBuild, false);` → `add.call(doc, 'docserver:register', onBuild, true);`; `remove.call(el, 'docserver:register', onBuild, false);` → `remove.call(doc, 'docserver:register', onBuild, true);`; `if (seen.length !== 1 \|\| only === undefined) return null; ⏎   if (only.target !== inserted) return null;` → `if (only === undefined) return null;` | `test/browser/mermaid-after-ready.test.ts`: 3 failed | 8 passed (11). Red tests: B5.5; B5.5; B5.5 | `adapters.ts` sha256 `ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc`; `bootstrap.ts` sha256 `ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85` restored, equal; generated outputs unchanged; `--check` green |
| B5d | once | `src/frame-runtime/bootstrap.ts` | `if (!arrivesLate(seed.mermaid) \|\| offered) return;` → `if (!arrivesLate(seed.mermaid)) return;` | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 10 passed (11). Red tests: B5.6 | `bootstrap.ts` sha256 `ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85` restored, equal; generated outputs unchanged; `--check` green |
| B5e | mode check | `src/frame-runtime/bootstrap.ts` | `if (!arrivesLate(seed.mermaid) \|\| offered) return;` → `if (offered) return;` | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 10 passed (11). Red tests: B5.7 | `bootstrap.ts` sha256 `ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85` restored, equal; generated outputs unchanged; `--check` green |
| B5f | reservation of fastdom and injected (Phase S) | `src/frame-runtime/bootstrap.ts` | `reserveGlobals(win, RESERVED_GLOBALS);` → (removed) | `test/browser/frame-pins.test.ts` (`-t "B5.8"`): 1 failed | 0 passed (1). Red tests: B5.8 | `bootstrap.ts` sha256 `ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85` restored, equal; generated outputs unchanged; `--check` green |
| B5g | ready does not wait, the brief's edit alone (L2 sets the gate and `drawing` before load() answers; the bootstrap still awaits diagramsSettled only under waitsForDrawing) | `src/enhance/diagrams.ts` | `ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'waiting'); ⏎     const module = await load(ctx, config);` → `ctx.journal.setAttribute(ctx.root, 'data-docreader-mermaid', ''); ⏎     ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'drawing'); ⏎     const module = await load(ctx, config);` | `test/browser/mermaid-after-ready.test.ts` and `test/enhance-mermaid-after-ready.test.ts` (`-t "B5.2|B2.1"`): 2 failed | 0 passed (2). Red tests: B5.2; waiting, no gate, a visible code block p | `diagrams.ts` sha256 `1c4af510b1652605bef39e93dda58e12e1814e2b9f9b6dc1a75d9a55689021e3` restored, equal; generated outputs unchanged; `--check` green |
| B5g2 | ready does not wait: waitsForDrawing true for 'after-ready' alone (expected: an equivalent mutant) | `src/frame-runtime/adapters.ts` | `return m !== null && m.draw === 'auto'; ⏎ } ⏎  ⏎ /** ⏎  * Whether the bootstrap asks` → `return m !== null && m.draw !== 'on-request'; ⏎ } ⏎  ⏎ /** ⏎  * Whether the bootstrap asks` | `test/browser/mermaid-after-ready.test.ts`: 0 failed | 11 passed (11). Stays green (equivalent mutant, argued above) | `adapters.ts` sha256 `ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc` restored, equal; generated outputs unchanged; `--check` green |
| B5g3 | ready does not wait, the compound (the brief's edit and `waitsForDrawing` true for 'after-ready': the bootstrap then awaits diagramsSettled) | `src/enhance/diagrams.ts`, `src/frame-runtime/adapters.ts` | `ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'waiting'); ⏎     const module = await load(ctx, config);` → `ctx.journal.setAttribute(ctx.root, 'data-docreader-mermaid', ''); ⏎     ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'drawing'); ⏎     const module = await load(ctx, config);`; `return m !== null && m.draw === 'auto'; ⏎ } ⏎  ⏎ /** ⏎  * Whether the bootstrap asks` → `return m !== null && m.draw !== 'on-request'; ⏎ } ⏎  ⏎ /** ⏎  * Whether the bootstrap asks` | `test/browser/mermaid-after-ready.test.ts` and `test/enhance-mermaid-after-ready.test.ts` (`-t "B5.2|B2.1"`): 2 failed | 0 passed (2). Red tests: B5.2; waiting, no gate, a visible code block p | `diagrams.ts` sha256 `1c4af510b1652605bef39e93dda58e12e1814e2b9f9b6dc1a75d9a55689021e3`; `adapters.ts` sha256 `ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc` restored, equal; generated outputs unchanged; `--check` green |
| B5h | the unavailable branch inserts no script: the early return dropped (plain) | `src/frame-runtime/bootstrap.ts` | `if ('unavailable' in m) { ⏎       settleLate(null); ⏎       return; ⏎     }` → (removed) | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 10 passed (11). Red by a RENDERER CRASH, not an assertion: B5.U's `frame.evaluate` rejected with `Target crashed` | `bootstrap.ts` sha256 `ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85` restored, equal; generated outputs unchanged; `--check` green |
| B5h-rerun | B5h run a second time (does the renderer crash reproduce?) | `src/frame-runtime/bootstrap.ts` | `if ('unavailable' in m) { ⏎       settleLate(null); ⏎       return; ⏎     }` → (removed) | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 10 passed (11). Red by a RENDERER CRASH, not an assertion: B5.U's `frame.evaluate` rejected with `Target crashed`; reproduced on this second run | `bootstrap.ts` sha256 `ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85` restored, equal; generated outputs unchanged; `--check` green |
| B5h2 | the unavailable branch inserts no script (the early return dropped, the empty text of the unavailable op taken as an empty script) | `src/frame-runtime/bootstrap.ts` | `if ('unavailable' in m) { ⏎       settleLate(null); ⏎       return; ⏎     }` → (removed); `styles.setText?.call(el, m.text);` → `styles.setText?.call(el, 'text' in m ? m.text : '');` | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 10 passed (11). Red tests: B5.U | `bootstrap.ts` sha256 `ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85` restored, equal; generated outputs unchanged; `--check` green |
| B5i | one registration (the count check of lateApi dropped: the first registration is taken) | `src/frame-runtime/adapters.ts` | `if (seen.length !== 1 \|\| only === undefined) return null;` → `if (only === undefined) return null;` | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 10 passed (11). Red tests: B5.5 | `adapters.ts` sha256 `ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc` restored, equal; generated outputs unchanged; `--check` green |
| B5j | settled state (the op is taken before the frame has settled) | `src/frame-runtime/bootstrap.ts` | `if (state !== 'settled' \|\| mismatch) return; ⏎     const m = parseParentMessage` → `if (mismatch) return; ⏎     const m = parseParentMessage` | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 10 passed (11). Red tests: B5.7 | `bootstrap.ts` sha256 `ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85` restored, equal; generated outputs unchanged; `--check` green |
| B5k | the target check of lateApi (`only.target !== inserted`) dropped: a forged register on the script's Text child, the only registration after the real one is stopped, is taken | `src/frame-runtime/adapters.ts` | `if (only.target !== inserted) return null;` → (removed) | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 10 passed (11). Red tests: B5.5 | `adapters.ts` sha256 `ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc` restored, equal; generated outputs unchanged; `--check` green |
| B5l | no boot requirement: the boot asks for a Mermaid registration in 'after-ready' too (B3g's edit) | `src/frame-runtime/bootstrap.ts` | `if (seed.mermaid !== null && !arrivesLate(seed.mermaid)) {` → `if (seed.mermaid !== null) {` | `test/browser/frame-boot.test.ts` (`-t "B5.C"`): 1 failed | 0 passed (1). Red tests: L3.B6/B3.6 | `bootstrap.ts` sha256 `ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85` restored, equal; generated outputs unchanged; `--check` green |

```json
{
  "generatedOutputs": {
    "assets/assets.json": "3cbff634e82783fa01af6d003c4f4431dab6d9ce6e74563065ef5f91e97cd19b",
    "src/frame/manifest.generated.ts": "eec77a967162fecb6402ef0efc63b2b142e492d0cda5d9cb71a890257270b505",
    "assets/frame/bootstrap.js": "113baa8825eb8259a00f07baf0295adb4cf89d08bf6aa2e0152e45ecc6b04b99",
    "assets/frame/enhance.js": "925093e9e7a3825d6947a520ea60253590cd31b331a2148a65978c1b140ab304",
    "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
    "assets/frame/reader.css": "99c87d57f9e2a944e2cec431705e5aa6004a4daf9af9738b32e1ed9d45a97489"
  },
  "rows": [
    {
      "id": "B5a",
      "guard": "exact text",
      "edits": [
        {
          "file": "test/browser/mermaid-after-ready.test.ts",
          "old": "const mermaidOp = (text: string): { t: 'mermaid'; text: string } => ({ t: 'mermaid', text });",
          "new": "const mermaidOp = (text: string): { t: 'mermaid'; text: string } => ({ t: 'mermaid', text: `${text.slice(0, 2000)}\\u0001${text.slice(2001)}` });"
        }
      ],
      "tests": [
        "test/browser/mermaid-after-ready.test.ts"
      ],
      "rc": 1,
      "red": "7 failed | 4 passed (11)",
      "failing": [
        "B5.1: the exact text posted after ready draws every figure under the hash-only policy, with no violation, no e",
        "B5.2 (instrumented: `diagramsAtReady` reads the root's state at the ready post): at the instant ready is poste",
        "B5.5 (instrumented: `forgeRegister` dispatches a forged register on another element from inside the real one):",
        "B5.5 (instrumented: `forgeRegister` dispatches the forged register on the inserted element itself): two regist",
        "B5.5 (instrumented: `forgeRegister` stops the real register and forges on the inserted script's Text child, bu",
        "B5.6: a second mermaid op inserts no second script (the build is accepted once)",
        "B5.7 (instrumented: `holdSettled` keeps the frame unsettled; the op is posted in the same task as the hello): "
      ],
      "sha256": {
        "test/browser/mermaid-after-ready.test.ts": "33725f28d7e1cbb662fa71b49f1003af3a7878939064903133a24715d78daa6c"
      },
      "sha256After": {
        "test/browser/mermaid-after-ready.test.ts": "33725f28d7e1cbb662fa71b49f1003af3a7878939064903133a24715d78daa6c"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B5b",
      "guard": "wrong text degrades: the frame is not failed by the blocked script's violation (the `if (done) return` and the blocked-inline exception both dropped, so the violation fails the frame after ready)",
      "edits": [
        {
          "file": "src/frame-runtime/bootstrap.ts",
          "old": "    if (done) return;\n    const directive: unknown = directiveOf?.call(e);\n    const blocked: unknown = blockedOf?.call(e);\n    if ((directive === 'script-src-elem' || directive === 'script-src') && (blocked === 'inline' || blocked === '')) return;\n    fail('boot');",
          "new": "    fail('boot');"
        }
      ],
      "tests": [
        "test/browser/mermaid-after-ready.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 10 passed (11)",
      "failing": [
        "B5.4: a text with one character changed is blocked: every figure shows the load note, the frame stays mounted "
      ],
      "sha256": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "sha256After": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B5b2",
      "guard": "wrong text degrades (the figures are left waiting when the blocked script registers nothing)",
      "edits": [
        {
          "file": "src/frame-runtime/bootstrap.ts",
          "old": "    settleLate(lateApi(seen, inserted));",
          "new": "    if (seen.length > 0) settleLate(lateApi(seen, inserted));"
        }
      ],
      "tests": [
        "test/browser/mermaid-after-ready.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 10 passed (11)",
      "failing": [
        "B5.4: a text with one character changed is blocked: every figure shows the load note, the frame stays mounted "
      ],
      "sha256": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "sha256After": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B5b3",
      "guard": "the `if (done) return` of onViolation alone (the blocked-inline exception still holds)",
      "edits": [
        {
          "file": "src/frame-runtime/bootstrap.ts",
          "old": "    if (done) return;\n    const directive",
          "new": "    const directive"
        }
      ],
      "tests": [
        "test/browser/mermaid-after-ready.test.ts"
      ],
      "rc": 0,
      "red": "0 failed | 11 passed (11)",
      "failing": [],
      "sha256": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "sha256After": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0,
      "verdict": "stays green on this path: the other guard also holds after ready; the guard's own job lies elsewhere, parked (ledger C107)"
    },
    {
      "id": "B5b4",
      "guard": "the blocked-inline exception of onViolation alone (`if (done) return` still holds)",
      "edits": [
        {
          "file": "src/frame-runtime/bootstrap.ts",
          "old": "    if ((directive === 'script-src-elem' || directive === 'script-src') && (blocked === 'inline' || blocked === '')) return;\n",
          "new": ""
        }
      ],
      "tests": [
        "test/browser/mermaid-after-ready.test.ts"
      ],
      "rc": 0,
      "red": "0 failed | 11 passed (11)",
      "failing": [],
      "sha256": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "sha256After": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0,
      "verdict": "stays green on this path: the other guard also holds after ready; the guard's own job lies elsewhere, parked (ledger C107)"
    },
    {
      "id": "B5c",
      "guard": "element identity (the register listener on the document, capture phase, not on the inserted element)",
      "edits": [
        {
          "file": "src/frame-runtime/bootstrap.ts",
          "old": "      add.call(el, 'docserver:register', onBuild, false);",
          "new": "      add.call(doc, 'docserver:register', onBuild, true);"
        },
        {
          "file": "src/frame-runtime/bootstrap.ts",
          "old": "        remove.call(el, 'docserver:register', onBuild, false);",
          "new": "        remove.call(doc, 'docserver:register', onBuild, true);"
        }
      ],
      "tests": [
        "test/browser/mermaid-after-ready.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 10 passed (11)",
      "failing": [
        "B5.5 (instrumented: `forgeRegister` dispatches a forged register on another element from inside the real one):"
      ],
      "sha256": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "sha256After": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B5c2",
      "guard": "element identity, and the one-registration and target checks of lateApi (the document listener accepting the first registration of any target: the forged one wins)",
      "edits": [
        {
          "file": "src/frame-runtime/bootstrap.ts",
          "old": "      add.call(el, 'docserver:register', onBuild, false);",
          "new": "      add.call(doc, 'docserver:register', onBuild, true);"
        },
        {
          "file": "src/frame-runtime/bootstrap.ts",
          "old": "        remove.call(el, 'docserver:register', onBuild, false);",
          "new": "        remove.call(doc, 'docserver:register', onBuild, true);"
        },
        {
          "file": "src/frame-runtime/adapters.ts",
          "old": "  if (seen.length !== 1 || only === undefined) return null;\n  if (only.target !== inserted) return null;",
          "new": "  if (only === undefined) return null;"
        }
      ],
      "tests": [
        "test/browser/mermaid-after-ready.test.ts"
      ],
      "rc": 1,
      "red": "3 failed | 8 passed (11)",
      "failing": [
        "B5.5 (instrumented: `forgeRegister` dispatches a forged register on another element from inside the real one):",
        "B5.5 (instrumented: `forgeRegister` dispatches the forged register on the inserted element itself): two regist",
        "B5.5 (instrumented: `forgeRegister` stops the real register and forges on the inserted script's Text child, bu"
      ],
      "sha256": {
        "src/frame-runtime/adapters.ts": "ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc",
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "sha256After": {
        "src/frame-runtime/adapters.ts": "ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc",
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B5d",
      "guard": "once",
      "edits": [
        {
          "file": "src/frame-runtime/bootstrap.ts",
          "old": "    if (!arrivesLate(seed.mermaid) || offered) return;",
          "new": "    if (!arrivesLate(seed.mermaid)) return;"
        }
      ],
      "tests": [
        "test/browser/mermaid-after-ready.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 10 passed (11)",
      "failing": [
        "B5.6: a second mermaid op inserts no second script (the build is accepted once)"
      ],
      "sha256": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "sha256After": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B5e",
      "guard": "mode check",
      "edits": [
        {
          "file": "src/frame-runtime/bootstrap.ts",
          "old": "    if (!arrivesLate(seed.mermaid) || offered) return;",
          "new": "    if (offered) return;"
        }
      ],
      "tests": [
        "test/browser/mermaid-after-ready.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 10 passed (11)",
      "failing": [
        "B5.7: the op is ignored in 'auto' and 'on-request' seeds and in a seed with Mermaid off: no script is inserted"
      ],
      "sha256": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "sha256After": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B5f",
      "guard": "reservation of fastdom and injected (Phase S)",
      "edits": [
        {
          "file": "src/frame-runtime/bootstrap.ts",
          "old": "    reserveGlobals(win, RESERVED_GLOBALS);",
          "new": ""
        }
      ],
      "tests": [
        "test/browser/frame-pins.test.ts"
      ],
      "grep": "B5.8",
      "rc": 1,
      "red": "1 failed | 0 passed (1)",
      "failing": [
        "B5.8 (extends L3.B3p): a document with anchors `fastdom`, `injected` and every name of the free-global list dr"
      ],
      "sha256": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "sha256After": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B5g",
      "guard": "ready does not wait, the brief's edit alone (L2 sets the gate and `drawing` before load() answers; the bootstrap still awaits diagramsSettled only under waitsForDrawing)",
      "edits": [
        {
          "file": "src/enhance/diagrams.ts",
          "old": "    ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'waiting');\n    const module = await load(ctx, config);",
          "new": "    ctx.journal.setAttribute(ctx.root, 'data-docreader-mermaid', '');\n    ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'drawing');\n    const module = await load(ctx, config);"
        }
      ],
      "tests": [
        "test/browser/mermaid-after-ready.test.ts",
        "test/enhance-mermaid-after-ready.test.ts"
      ],
      "grep": "B5.2|B2.1",
      "rc": 1,
      "red": "2 failed | 0 passed (2)",
      "failing": [
        "B5.2 (instrumented: `diagramsAtReady` reads the root's state at the ready post): at the instant ready is poste",
        "waiting, no gate, a visible code block per figure, no SVG; load() called once"
      ],
      "sha256": {
        "src/enhance/diagrams.ts": "1c4af510b1652605bef39e93dda58e12e1814e2b9f9b6dc1a75d9a55689021e3"
      },
      "sha256After": {
        "src/enhance/diagrams.ts": "1c4af510b1652605bef39e93dda58e12e1814e2b9f9b6dc1a75d9a55689021e3"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B5g2",
      "guard": "ready does not wait: waitsForDrawing true for 'after-ready' alone (expected: an equivalent mutant)",
      "edits": [
        {
          "file": "src/frame-runtime/adapters.ts",
          "old": "  return m !== null && m.draw === 'auto';\n}\n\n/**\n * Whether the bootstrap asks",
          "new": "  return m !== null && m.draw !== 'on-request';\n}\n\n/**\n * Whether the bootstrap asks"
        }
      ],
      "tests": [
        "test/browser/mermaid-after-ready.test.ts"
      ],
      "rc": 0,
      "red": "0 failed | 11 passed (11)",
      "failing": [],
      "sha256": {
        "src/frame-runtime/adapters.ts": "ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc"
      },
      "sha256After": {
        "src/frame-runtime/adapters.ts": "ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0,
      "verdict": "stays green: equivalent mutant"
    },
    {
      "id": "B5g3",
      "guard": "ready does not wait, the compound (the brief's edit and `waitsForDrawing` true for 'after-ready': the bootstrap then awaits diagramsSettled)",
      "edits": [
        {
          "file": "src/enhance/diagrams.ts",
          "old": "    ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'waiting');\n    const module = await load(ctx, config);",
          "new": "    ctx.journal.setAttribute(ctx.root, 'data-docreader-mermaid', '');\n    ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'drawing');\n    const module = await load(ctx, config);"
        },
        {
          "file": "src/frame-runtime/adapters.ts",
          "old": "  return m !== null && m.draw === 'auto';\n}\n\n/**\n * Whether the bootstrap asks",
          "new": "  return m !== null && m.draw !== 'on-request';\n}\n\n/**\n * Whether the bootstrap asks"
        }
      ],
      "tests": [
        "test/browser/mermaid-after-ready.test.ts",
        "test/enhance-mermaid-after-ready.test.ts"
      ],
      "grep": "B5.2|B2.1",
      "rc": 1,
      "red": "2 failed | 0 passed (2)",
      "failing": [
        "B5.2 (instrumented: `diagramsAtReady` reads the root's state at the ready post): at the instant ready is poste",
        "waiting, no gate, a visible code block per figure, no SVG; load() called once"
      ],
      "sha256": {
        "src/enhance/diagrams.ts": "1c4af510b1652605bef39e93dda58e12e1814e2b9f9b6dc1a75d9a55689021e3",
        "src/frame-runtime/adapters.ts": "ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc"
      },
      "sha256After": {
        "src/enhance/diagrams.ts": "1c4af510b1652605bef39e93dda58e12e1814e2b9f9b6dc1a75d9a55689021e3",
        "src/frame-runtime/adapters.ts": "ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B5h",
      "guard": "the unavailable branch inserts no script: the early return dropped (plain)",
      "edits": [
        {
          "file": "src/frame-runtime/bootstrap.ts",
          "old": "    if ('unavailable' in m) {\n      settleLate(null);\n      return;\n    }\n",
          "new": ""
        }
      ],
      "tests": [
        "test/browser/mermaid-after-ready.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 10 passed (11)",
      "failing": [
        "B5.U: {t:\"mermaid\", unavailable:true} inserts no script element and every figure shows the load note"
      ],
      "sha256": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "sha256After": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0,
      "verdict": "red by renderer crash (Target crashed), not an assertion"
    },
    {
      "id": "B5h-rerun",
      "guard": "B5h run a second time (does the renderer crash reproduce?)",
      "edits": [
        {
          "file": "src/frame-runtime/bootstrap.ts",
          "old": "    if ('unavailable' in m) {\n      settleLate(null);\n      return;\n    }\n",
          "new": ""
        }
      ],
      "tests": [
        "test/browser/mermaid-after-ready.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 10 passed (11)",
      "failing": [
        "B5.U: {t:\"mermaid\", unavailable:true} inserts no script element and every figure shows the load note"
      ],
      "sha256": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "sha256After": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0,
      "verdict": "red by renderer crash (Target crashed), not an assertion"
    },
    {
      "id": "B5h2",
      "guard": "the unavailable branch inserts no script (the early return dropped, the empty text of the unavailable op taken as an empty script)",
      "edits": [
        {
          "file": "src/frame-runtime/bootstrap.ts",
          "old": "    if ('unavailable' in m) {\n      settleLate(null);\n      return;\n    }\n",
          "new": ""
        },
        {
          "file": "src/frame-runtime/bootstrap.ts",
          "old": "styles.setText?.call(el, m.text);",
          "new": "styles.setText?.call(el, 'text' in m ? m.text : '');"
        }
      ],
      "tests": [
        "test/browser/mermaid-after-ready.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 10 passed (11)",
      "failing": [
        "B5.U: {t:\"mermaid\", unavailable:true} inserts no script element and every figure shows the load note"
      ],
      "sha256": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "sha256After": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B5i",
      "guard": "one registration (the count check of lateApi dropped: the first registration is taken)",
      "edits": [
        {
          "file": "src/frame-runtime/adapters.ts",
          "old": "  if (seen.length !== 1 || only === undefined) return null;",
          "new": "  if (only === undefined) return null;"
        }
      ],
      "tests": [
        "test/browser/mermaid-after-ready.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 10 passed (11)",
      "failing": [
        "B5.5 (instrumented: `forgeRegister` dispatches the forged register on the inserted element itself): two regist"
      ],
      "sha256": {
        "src/frame-runtime/adapters.ts": "ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc"
      },
      "sha256After": {
        "src/frame-runtime/adapters.ts": "ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B5j",
      "guard": "settled state (the op is taken before the frame has settled)",
      "edits": [
        {
          "file": "src/frame-runtime/bootstrap.ts",
          "old": "    if (state !== 'settled' || mismatch) return;\n    const m = parseParentMessage",
          "new": "    if (mismatch) return;\n    const m = parseParentMessage"
        }
      ],
      "tests": [
        "test/browser/mermaid-after-ready.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 10 passed (11)",
      "failing": [
        "B5.7 (instrumented: `holdSettled` keeps the frame unsettled; the op is posted in the same task as the hello): "
      ],
      "sha256": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "sha256After": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B5k",
      "guard": "the target check of lateApi (`only.target !== inserted`) dropped: a forged register on the script's Text child, the only registration after the real one is stopped, is taken",
      "edits": [
        {
          "file": "src/frame-runtime/adapters.ts",
          "old": "  if (only.target !== inserted) return null;\n",
          "new": ""
        }
      ],
      "tests": [
        "test/browser/mermaid-after-ready.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 10 passed (11)",
      "failing": [
        "B5.5 (instrumented: `forgeRegister` stops the real register and forges on the inserted script's Text child, bu"
      ],
      "sha256": {
        "src/frame-runtime/adapters.ts": "ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc"
      },
      "sha256After": {
        "src/frame-runtime/adapters.ts": "ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B5l",
      "guard": "no boot requirement: the boot asks for a Mermaid registration in 'after-ready' too (B3g's edit)",
      "edits": [
        {
          "file": "src/frame-runtime/bootstrap.ts",
          "old": "if (seed.mermaid !== null && !arrivesLate(seed.mermaid)) {",
          "new": "if (seed.mermaid !== null) {"
        }
      ],
      "tests": [
        "test/browser/frame-boot.test.ts"
      ],
      "grep": "B5.C",
      "rc": 1,
      "red": "1 failed | 0 passed (1)",
      "failing": [
        "L3.B6/B3.6 (batch B5.C): an 'after-ready' seed with Mermaid on carries no Mermaid script and boots to ready, w"
      ],
      "sha256": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "sha256After": {
        "src/frame-runtime/bootstrap.ts": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    }
  ]
}
```

## Fix round FR1: each pre-existing `onViolation` guard alone (review 1480, A9)

Plan line 170 asks that each guard the batch left in place carry a case that goes red when that guard alone is removed, or a recorded equivalent mutant. B5b dropped the two guards of `onViolation` (`if (done) return;` and the exception for a blocked inline script) together, and B5b3 and B5b4 each stayed green alone on the after-ready path, because each of the two holds that path by itself. Fix round FR1 gives the first its own case and records the second as an equivalent mutant on Chromium. Method as above: one row at a time, on Chromium, the bytes and full sha256 of `src/frame-runtime/bootstrap.ts` saved, the generated outputs (`assets/assets.json`, `src/frame/manifest.generated.ts`, `assets/frame/*`, `assets/reader.css`) saved, `npm run build:frame` run after the edit, the named files run behind `timeout -k 10 600` with `ulimit -u` at the measured thread count plus 1500, every saved file written back by byte copy, the source's sha256 compared equal, and `node scripts/build-frame.mjs --check` run after the restore ("the outputs equal a fresh build" for both rows); the working tree then showed no change to any generated output. The source's sha256 before and after both rows: `9b78ce600933eeb92cc6e6719d12c09fbee4ab7d4d7db7cd54d561dc9e32ea63`.

| Row | Guard | Change | Tests | Verdict |
|---|---|---|---|---|
| B5b5 | the `done` guard alone (the exception stays) | `    if (done) return;` removed from `onViolation` | `test/browser/mermaid-after-ready.test.ts`: 1 failed \| 13 passed \| 14 skipped (28) | red through B5.4b (new): `AssertionError: expected 'serif' to be 'sans'`. A violation of another kind after ready (an image from another origin, img-src) is not a blocked inline script, so only this guard keeps it from ending the boot (state failed), after which the port's handler ignores the prefs op |
| B5b6 | the blocked-inline exception alone (the `done` guard stays) | the `if ((directive === 'script-src-elem' \|\| directive === 'script-src') && (blocked === 'inline' \|\| blocked === '')) return;` line removed | `test/browser/mermaid-after-ready.test.ts` and `test/browser/frame-boot.test.ts`: 0 failed \| 53 passed \| 53 skipped (106) | green: an equivalent mutant on Chromium (ledger C107, with the reason below) |

B5b6, the reason. After ready, the `done` guard returns first, so the exception has no work there. Before ready the exception is for a blocked inline script of the frame's own (a tampered enhance script, a Mermaid build the policy refuses), whose failure the check that owns it reports with its own reason (`assets`, `mermaid`). On Chromium, as the code reads and the green rows below bear out (the ordering itself was not instrumented), that violation is delivered after the DOMContentLoaded handler has already run `start`, which settles the boot as failed with the owning reason, and a failed state is final (`fail` returns at once when the state is already failed), so a later `fail('boot')` changes nothing. The rows that would show it, frame-boot's flipped-enhance rows (error `assets`, not `boot`), stay green without the exception. This rests on Chromium's ordering; a case that needs the violation to arrive before DOMContentLoaded would need another engine's ordering, and WebKit is run in CI only. The guard stays as defence in depth against that ordering.

```json
[
  {
    "id": "B5b5",
    "guard": "the `if (done) return` of onViolation alone (the blocked-inline exception still holds)",
    "edits": [{"file": "src/frame-runtime/bootstrap.ts", "old": "    if (done) return;\n    const directive", "new": "    const directive"}],
    "tests": ["test/browser/mermaid-after-ready.test.ts"],
    "rc": 1,
    "red": "1 failed | 13 passed | 14 skipped (28)",
    "failing": ["test/browser/mermaid-after-ready.test.ts > chromium > B5.4b: a policy violation of another kind after ready (an image from another origin) leaves the frame alive: the bootstrap's `done` guard of onViolation, alone"],
    "assertionErrorsOnly": true,
    "sha256": {"src/frame-runtime/bootstrap.ts": "9b78ce600933eeb92cc6e6719d12c09fbee4ab7d4d7db7cd54d561dc9e32ea63"},
    "sha256After": {"src/frame-runtime/bootstrap.ts": "9b78ce600933eeb92cc6e6719d12c09fbee4ab7d4d7db7cd54d561dc9e32ea63"},
    "restored": true,
    "generatedOutputsUnchanged": true,
    "checkAfterRestore": 0
  },
  {
    "id": "B5b6",
    "guard": "the blocked-inline exception of onViolation alone (`if (done) return` still holds)",
    "edits": [{"file": "src/frame-runtime/bootstrap.ts", "old": "    if ((directive === 'script-src-elem' || directive === 'script-src') && (blocked === 'inline' || blocked === '')) return;\n", "new": ""}],
    "tests": ["test/browser/mermaid-after-ready.test.ts", "test/browser/frame-boot.test.ts"],
    "rc": 0,
    "red": "0 failed | 53 passed | 53 skipped (106)",
    "failing": [],
    "sha256": {"src/frame-runtime/bootstrap.ts": "9b78ce600933eeb92cc6e6719d12c09fbee4ab7d4d7db7cd54d561dc9e32ea63"},
    "sha256After": {"src/frame-runtime/bootstrap.ts": "9b78ce600933eeb92cc6e6719d12c09fbee4ab7d4d7db7cd54d561dc9e32ea63"},
    "restored": true,
    "generatedOutputsUnchanged": true,
    "checkAfterRestore": 0,
    "verdict": "equivalent mutant on Chromium: the violation of a blocked inline script arrives after the boot has failed with its owner's reason, and a failed state is final (ledger C107)"
  }
]
```

## Fix round FR1: B5b6 measured on the policy row that pins the exception before ready (review minor 2)

The record of B5b6 above ran the blocked-inline exception of `onViolation` alone against `test/browser/mermaid-after-ready.test.ts` and `test/browser/frame-boot.test.ts` and called it an equivalent mutant on Chromium. The row that pins the exception before ready is L3.HB6 (`test/browser/host-policy.test.ts`: a page whose script-src lists the frame's hashes but one: ready, then error with the owning reason). B5b6x is B5b6 run on that file, Chromium only, by the same method (bytes and full sha256 of `src/frame-runtime/bootstrap.ts` saved, the generated outputs saved, `npm run build:frame` after the edit, a bounded run behind a `ulimit -u` of the measured thread count (1832) plus 1500, everything written back by byte copy, the sha256 compared equal, `node scripts/build-frame.mjs --check` green after).

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| B5b6x | the blocked-inline exception alone (the `done` guard stays) | `src/frame-runtime/bootstrap.ts` | the line `if ((directive === 'script-src-elem' \| directive === 'script-src') && (blocked === 'inline' \| blocked === '')) return;` removed | `test/browser/host-policy.test.ts`: 0 failed \| 9 passed \| 9 skipped (18). Stays green: B5b6 is still an equivalent mutant on Chromium, now measured on L3.HB6 as well as on the two files above | `bootstrap.ts` sha256 `9b78ce600933eeb92cc6e6719d12c09fbee4ab7d4d7db7cd54d561dc9e32ea63` restored, equal; generated outputs restored from the saved bytes, `--check` green |

```json
[
  {
    "id": "B5b6x",
    "guard": "the blocked-inline exception alone (the done guard stays)",
    "file": "src/frame-runtime/bootstrap.ts",
    "tests": "test/browser/host-policy.test.ts (Chromium)",
    "rc": 0,
    "red": "green: 0 failed | 9 passed | 9 skipped (18)",
    "failing": [],
    "assertionErrorsOnly": null,
    "sha256": "9b78ce600933eeb92cc6e6719d12c09fbee4ab7d4d7db7cd54d561dc9e32ea63",
    "restored": true
  }
]
```

## Fix round FR2: B5b6 separated (review F2)

Fix round FR2, review F2: the blocked-inline exception of `onViolation` is not an equivalent mutant. A blocked inline script's violation delivered before the bootstrap's DOMContentLoaded handler runs `start` reaches `onViolation` while the state is still `boot`, `fail('boot')` runs first and `start` then returns at `state !== 'boot'`, so the frame posts `error boot` instead of the owning reason. Case B5.4c (`test/browser/frame-boot.test.ts`, next to the L3.B5 rows; it opens its frame through `openFrameHost` with one new `InitHow` flag, `violationBeforeStart`, in `test/browser/frame-host-page.ts`) mounts the srcdoc with one enhance byte flipped, and the init script adds a DOMContentLoaded listener before the bootstrap's, which dispatches `new SecurityPolicyViolationEvent('securitypolicyviolation', { effectiveDirective: 'script-src-elem', blockedURI: 'inline' })` on the document. At the tip: ready, then `error assets` (green). With the exception line removed alone (the `done` guard stays): ready, then `error boot` (red). B5b6 and B5b6x above are the earlier records of the same edit, measured on rows that do not deliver the violation before the start; they are left as written.

Method: the bytes and full sha256 of `src/frame-runtime/bootstrap.ts` saved, the generated outputs saved, `npm run build:frame` after the edit, a bounded run behind a `ulimit -u` of the measured thread count (2217) plus 1500, `timeout -k 10 600`, everything written back by byte copy, the sha256 compared equal, `node scripts/build-frame.mjs --check` green after.

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| B5b6s | the blocked-inline exception alone (the `done` guard stays), on the case that delivers the violation before the start | `src/frame-runtime/bootstrap.ts` | the line `if ((directive === 'script-src-elem' \|\| directive === 'script-src') && (blocked === 'inline' \|\| blocked === '')) return;` removed, then `npm run build:frame` | `test/browser/frame-boot.test.ts -t B5.4c` (Chromium): 1 failed \| 79 skipped (80). B5.4c: a blocked-inline violation delivered before the bootstrap's DOMContentLoaded handler leaves the owning reason: ready, then error assets, not boot (received `error boot`) | sha256 `9b78ce600933eeb92cc6e6719d12c09fbee4ab7d4d7db7cd54d561dc9e32ea63` restored, equal; the generated outputs (assets/assets.json, src/frame/manifest.generated.ts, assets/frame/*) saved before and restored from the saved bytes after, each sha256 equal, then `node scripts/build-frame.mjs --check` green |

```json
[
  {
    "id": "B5b6s",
    "guard": "the blocked-inline exception alone (the done guard stays), on the case that delivers the violation before the start",
    "file": "src/frame-runtime/bootstrap.ts",
    "tests": "test/browser/frame-boot.test.ts -t B5.4c (Chromium)",
    "rc": 1,
    "red": "1 failed | 79 skipped (80)",
    "failing": [
      "test/browser/frame-boot.test.ts: L3.B5 (B5.4c): a blocked-inline violation delivered before the bootstrap's DOMContentLoaded handler leaves the owning reason: ready, then error assets, not boot (received error boot)"
    ],
    "assertionErrorsOnly": true,
    "sha256": "9b78ce600933eeb92cc6e6719d12c09fbee4ab7d4d7db7cd54d561dc9e32ea63",
    "restored": true
  }
]
```
