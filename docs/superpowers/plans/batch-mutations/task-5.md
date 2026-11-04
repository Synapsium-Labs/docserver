# Batch Task 5: mutation rows (browser rows for drawing after ready)

Each row was measured in place on branch `ws/docserver-release-1-1` by the batch method: the bytes of every edited file saved with their sha256, one edit set applied, `npm run build:frame` run for a row that edits a frame build input (the generated outputs `assets/assets.json`, `src/frame/manifest.generated.ts` and `assets/frame/*` saved first and restored after, then `node scripts/build-frame.mjs --check` green), the named browser file run on Chromium (`DOCREADER_BROWSERS=chromium`) as `./node_modules/.bin/vitest run --maxWorkers=2 --reporter=json <file>` behind `timeout -k 10 600` and a `ulimit -u` of the measured thread count plus 1500, then every file restored from its saved bytes (`cp`) and its sha256 compared. WebKit runs in CI only. The item is ledger C107. The test file is `test/browser/mermaid-after-ready.test.ts` unless a row names another.

Rows B5a to B5g are the brief's. Added by the controller's rulings: B5i (ruling a: the count check of `lateApi`, red through the second construction of B5.5, a forged register on the inserted element) and B5c2 (the document listener that takes the first registration of any target: the forged one then wins, `fakeCalls` above zero); B5h and B5h2 (ruling b: the `unavailable` early return). Row B5j guards the settled-state check of the port handler (B5.7's early op, held by the `holdSettled` instrumentation).

Verdicts. Every row is red through assertions except as noted. B5g2 (`waitsForDrawing` true for `'after-ready'` alone) stays green and is recorded as an equivalent mutant, as the brief says: `diagramsSettled` resolves at once unless the root reads exactly `drawing`, and the op cannot be accepted before `settled`, so the root still reads `waiting` at ready. B5g itself sets the gate and `drawing` in L2 before `load()` answers as well, so ready waits for a build that only comes after ready: no ready arrives (B5.2 red, and B2.1 of `test/enhance-mermaid-after-ready.test.ts`). B5h, the plain drop of the early return, makes the frame insert a script whose text is `undefined` and the Chromium renderer of the frame crashed, so the row's red was a `Target crashed` error from the test's evaluate, not an assertion; B5h2 reads the unavailable op's missing text as an empty script and goes red through B5.U's script count (5 against 4). The edit of B5b leaves the figures `waiting` when the blocked script registers nothing; failing the frame at that violation has no observable effect (the violation comes after ready, where `fail` can no longer post), so the brief's other wording was not measured. Row B5f is measured through `test/browser/frame-pins.test.ts` (B5.8).

## The rows

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| B5a | exact text | `test/browser/mermaid-after-ready.test.ts` | `const mermaidOp = (text: string): { t: 'mermaid'; text: string } => ({ t: 'mermaid', text });` → `const mermaidOp = (text: string): { t: 'mermaid'; text: string } => ({ t: 'mermaid', text: `${text.slice(0, 2000)}\u0001${text.slice(2001)}` });` | `test/browser/mermaid-after-ready.test.ts`: 6 failed | 4 passed (10). Red tests: B5.1; B5.2; B5.5; B5.5; B5.6; B5.7 | `mermaid-after-ready.test.ts` sha256 `a9e316537c7d…` restored, equal |
| B5b | wrong text degrades (the figures are left waiting when the blocked script registers nothing) | `src/frame-runtime/bootstrap.ts` | `settleLate(lateApi(seen, inserted));` → `if (seen.length > 0) settleLate(lateApi(seen, inserted));` | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 9 passed (10). Red tests: B5.4 | `bootstrap.ts` sha256 `ecb948395860…` restored, equal; generated outputs restored, `--check` green |
| B5c | element identity (the register listener on the document, capture phase, not on the inserted element) | `src/frame-runtime/bootstrap.ts` | `add.call(el, 'docserver:register', onBuild, false);` → `add.call(doc, 'docserver:register', onBuild, true);`; `remove.call(el, 'docserver:register', onBuild, false);` → `remove.call(doc, 'docserver:register', onBuild, true);` | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 9 passed (10). Red tests: B5.5 | `bootstrap.ts` sha256 `ecb948395860…` restored, equal; generated outputs restored, `--check` green |
| B5c2 | element identity, and the one-registration and target checks of lateApi (the document listener accepting the first registration of any target: the forged one wins) | `src/frame-runtime/adapters.ts`, `src/frame-runtime/bootstrap.ts` | `add.call(el, 'docserver:register', onBuild, false);` → `add.call(doc, 'docserver:register', onBuild, true);`; `remove.call(el, 'docserver:register', onBuild, false);` → `remove.call(doc, 'docserver:register', onBuild, true);`; `if (seen.length !== 1 \|\| only === undefined) return null; ⏎   if (only.target !== inserted) return null;` → `if (only === undefined) return null;` | `test/browser/mermaid-after-ready.test.ts`: 2 failed | 8 passed (10). Red tests: B5.5; B5.5 | `adapters.ts` sha256 `ddb59cd5bbd6…`; `bootstrap.ts` sha256 `ecb948395860…` restored, equal; generated outputs restored, `--check` green |
| B5d | once | `src/frame-runtime/bootstrap.ts` | `if (!arrivesLate(seed.mermaid) \|\| offered) return;` → `if (!arrivesLate(seed.mermaid)) return;` | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 9 passed (10). Red tests: B5.6 | `bootstrap.ts` sha256 `ecb948395860…` restored, equal; generated outputs restored, `--check` green |
| B5e | mode check | `src/frame-runtime/bootstrap.ts` | `if (!arrivesLate(seed.mermaid) \|\| offered) return;` → `if (offered) return;` | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 9 passed (10). Red tests: B5.7 | `bootstrap.ts` sha256 `ecb948395860…` restored, equal; generated outputs restored, `--check` green |
| B5f | reservation of fastdom and injected (Phase S) | `src/frame-runtime/bootstrap.ts` | `reserveGlobals(win, RESERVED_GLOBALS);` → `(removed)` | `test/browser/frame-pins.test.ts`: 1 failed | 0 passed (1). Red tests: B5.8 | `bootstrap.ts` sha256 `ecb948395860…` restored, equal; generated outputs restored, `--check` green |
| B5g | ready does not wait (L2 sets the gate and drawing before load() answers, and the bootstrap waits for drawing in 'after-ready') | `src/enhance/diagrams.ts`, `src/frame-runtime/adapters.ts` | `ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'waiting'); ⏎     const module = await load(ctx, config);` → `ctx.journal.setAttribute(ctx.root, 'data-docreader-mermaid', ''); ⏎     ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'drawing'); ⏎     const module = await load(ctx, config);`; `return m !== null && m.draw === 'auto'; ⏎ } ⏎  ⏎ /** ⏎  * Whether the bootstrap asks` → `return m !== null && m.draw !== 'on-request'; ⏎ } ⏎  ⏎ /** ⏎  * Whether the bootstrap asks` | `test/browser/mermaid-after-ready.test.ts and test/enhance-mermaid-after-ready.test.ts`: 2 failed | 0 passed (2). Red tests: B5.2; waiting, no gate, a visible code block p | `diagrams.ts` sha256 `1c4af510b165…`; `adapters.ts` sha256 `ddb59cd5bbd6…` restored, equal; generated outputs restored, `--check` green |
| B5g2 | ready does not wait: waitsForDrawing true for 'after-ready' alone (expected: an equivalent mutant) | `src/frame-runtime/adapters.ts` | `return m !== null && m.draw === 'auto'; ⏎ } ⏎  ⏎ /** ⏎  * Whether the bootstrap asks` → `return m !== null && m.draw !== 'on-request'; ⏎ } ⏎  ⏎ /** ⏎  * Whether the bootstrap asks` | `test/browser/mermaid-after-ready.test.ts`: 0 failed | 10 passed (10). Stays green (equivalent mutant, argued above) | `adapters.ts` sha256 `ddb59cd5bbd6…` restored, equal; generated outputs restored, `--check` green |
| B5h | the unavailable branch inserts no script | `src/frame-runtime/bootstrap.ts` | `if ('unavailable' in m) { ⏎       settleLate(null); ⏎       return; ⏎     }` → `(removed)` | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 9 passed (10). Red tests: B5.U | `bootstrap.ts` sha256 `ecb948395860…` restored, equal; generated outputs restored, `--check` green |
| B5i | one registration (the count check of lateApi dropped: the first registration is taken) | `src/frame-runtime/adapters.ts` | `if (seen.length !== 1 \|\| only === undefined) return null;` → `if (only === undefined) return null;` | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 9 passed (10). Red tests: B5.5 | `adapters.ts` sha256 `ddb59cd5bbd6…` restored, equal; generated outputs restored, `--check` green |
| B5j | settled state (the op is taken before the frame has settled) | `src/frame-runtime/bootstrap.ts` | `if (state !== 'settled' \|\| mismatch) return; ⏎     const m = parseParentMessage` → `if (mismatch) return; ⏎     const m = parseParentMessage` | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 9 passed (10). Red tests: B5.7 | `bootstrap.ts` sha256 `ecb948395860…` restored, equal; generated outputs restored, `--check` green |
| B5h2 | the unavailable branch inserts no script (the early return dropped, the empty text of the unavailable op taken as an empty script) | `src/frame-runtime/bootstrap.ts` | `if ('unavailable' in m) { ⏎       settleLate(null); ⏎       return; ⏎     }` → `(removed)`; `styles.setText?.call(el, m.text);` → `styles.setText?.call(el, 'text' in m ? m.text : '');` | `test/browser/mermaid-after-ready.test.ts`: 1 failed | 9 passed (10). Red tests: B5.U | `bootstrap.ts` sha256 `ecb948395860…` restored, equal; generated outputs restored, `--check` green |

```json
[
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
    "red": "6 failed | 4 passed (10)",
    "failing": [
      "B5.1: the exact text posted after ready draws every figure under the hash-only policy, with no violation, no e",
      "B5.2 (instrumented: `diagramsAtReady` reads the root's state at the ready post): at the instant ready is poste",
      "B5.5 (instrumented: `forgeRegister` dispatches a forged register on another element from inside the real one):",
      "B5.5 (instrumented: `forgeRegister` dispatches the forged register on the inserted element itself): two regist",
      "B5.6: a second mermaid op inserts no second script (the build is accepted once)",
      "B5.7 (instrumented: `holdSettled` keeps the frame unsettled; the op is posted in the same task as the hello): "
    ],
    "sha256": {
      "test/browser/mermaid-after-ready.test.ts": "a9e316537c7d"
    },
    "restored": true
  },
  {
    "id": "B5b",
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
    "red": "1 failed | 9 passed (10)",
    "failing": [
      "B5.4: a text with one character changed is blocked: every figure shows the load note, the frame stays mounted "
    ],
    "sha256": {
      "src/frame-runtime/bootstrap.ts": "ecb948395860"
    },
    "restored": true
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
    "red": "1 failed | 9 passed (10)",
    "failing": [
      "B5.5 (instrumented: `forgeRegister` dispatches a forged register on another element from inside the real one):"
    ],
    "sha256": {
      "src/frame-runtime/bootstrap.ts": "ecb948395860"
    },
    "restored": true
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
    "red": "2 failed | 8 passed (10)",
    "failing": [
      "B5.5 (instrumented: `forgeRegister` dispatches a forged register on another element from inside the real one):",
      "B5.5 (instrumented: `forgeRegister` dispatches the forged register on the inserted element itself): two regist"
    ],
    "sha256": {
      "src/frame-runtime/adapters.ts": "ddb59cd5bbd6",
      "src/frame-runtime/bootstrap.ts": "ecb948395860"
    },
    "restored": true
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
    "red": "1 failed | 9 passed (10)",
    "failing": [
      "B5.6: a second mermaid op inserts no second script (the build is accepted once)"
    ],
    "sha256": {
      "src/frame-runtime/bootstrap.ts": "ecb948395860"
    },
    "restored": true
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
    "red": "1 failed | 9 passed (10)",
    "failing": [
      "B5.7: the op is ignored in 'auto' and 'on-request' seeds and in a seed with Mermaid off: no script is inserted"
    ],
    "sha256": {
      "src/frame-runtime/bootstrap.ts": "ecb948395860"
    },
    "restored": true
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
    "rc": 1,
    "red": "1 failed | 0 passed (1)",
    "failing": [
      "B5.8 (extends L3.B3p): a document with anchors `fastdom`, `injected` and every name of the free-global list dr"
    ],
    "sha256": {
      "src/frame-runtime/bootstrap.ts": "ecb948395860"
    },
    "restored": true
  },
  {
    "id": "B5g",
    "guard": "ready does not wait (L2 sets the gate and drawing before load() answers, and the bootstrap waits for drawing in 'after-ready')",
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
    "rc": 1,
    "red": "2 failed | 0 passed (2)",
    "failing": [
      "B5.2 (instrumented: `diagramsAtReady` reads the root's state at the ready post): at the instant ready is poste",
      "waiting, no gate, a visible code block per figure, no SVG; load() called once"
    ],
    "sha256": {
      "src/enhance/diagrams.ts": "1c4af510b165",
      "src/frame-runtime/adapters.ts": "ddb59cd5bbd6"
    },
    "restored": true
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
    "red": "0 failed | 10 passed (10)",
    "failing": [],
    "sha256": {
      "src/frame-runtime/adapters.ts": "ddb59cd5bbd6"
    },
    "restored": true
  },
  {
    "id": "B5h",
    "guard": "the unavailable branch inserts no script",
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
    "red": "1 failed | 9 passed (10)",
    "failing": [
      "B5.U: {t:\"mermaid\", unavailable:true} inserts no script element and every figure shows the load note"
    ],
    "sha256": {
      "src/frame-runtime/bootstrap.ts": "ecb948395860"
    },
    "restored": true
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
    "red": "1 failed | 9 passed (10)",
    "failing": [
      "B5.5 (instrumented: `forgeRegister` dispatches the forged register on the inserted element itself): two regist"
    ],
    "sha256": {
      "src/frame-runtime/adapters.ts": "ddb59cd5bbd6"
    },
    "restored": true
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
    "red": "1 failed | 9 passed (10)",
    "failing": [
      "B5.7 (instrumented: `holdSettled` keeps the frame unsettled; the op is posted in the same task as the hello): "
    ],
    "sha256": {
      "src/frame-runtime/bootstrap.ts": "ecb948395860"
    },
    "restored": true
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
    "red": "1 failed | 9 passed (10)",
    "failing": [
      "B5.U: {t:\"mermaid\", unavailable:true} inserts no script element and every figure shows the load note"
    ],
    "sha256": {
      "src/frame-runtime/bootstrap.ts": "ecb948395860"
    },
    "restored": true
  }
]
```
