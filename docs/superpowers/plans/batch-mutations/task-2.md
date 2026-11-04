# Batch Task 2: mutation rows (the `'after-ready'` draw mode)

Each row was measured in place on branch `ws/docserver-release-1-1` by the batch method: the bytes of the target file saved with their sha256, one edit applied, the named test files run as `./node_modules/.bin/vitest run --maxWorkers=2 <files>` behind `timeout -k 10 600` and a `ulimit -u` of the measured thread count plus 1500 (measured counts 2809 to 3022 across the rows, so limits of 4309 to 4522), then the file restored from the saved bytes (`cp`) and its sha256 compared. The draw mode is ledger C107. B2f is the row the brief calls B3d in an earlier numbering. All rows were measured on the fix-round tree, with the 'after-ready' branch writing the gate and `drawing` inside `ctx.operate`; the rows B2a to B2f were first measured on the first commit and again here with the same results.

The rows edit sources that feed the frame build, but the unit tests read sources, so no build ran and no generated output moved. The outputs were saved before the first row and compared after the last: `assets/assets.json` sha256 `0c2a12f838da6a78ab1115c58058eb29bbf4bec7e58d463a19653892917f67cf` and `src/frame/manifest.generated.ts` sha256 `9fdf205502069a7dd820514cba0f1de807745b19013754c9c96f3b67df94f172`, equal before and after; `node scripts/build-frame.mjs --check` is green on the committed tree.

Verdicts. B2a to B2d and B2f to B2h went red through `AssertionError` only (no unhandled error). B2e is measured on `test/enhance-options.test.ts` alone, where it goes red through one assertion (`verdict(...)` is not `accepted`); the same edit also fails the enhance()-level cases of `test/enhance-mermaid-after-ready.test.ts` through the refusal `EnhanceError` that `enhance()` throws, which is the guard's own effect, so that run is not counted for B2e. B2i and B2j stay green on every file and are recorded below as equivalent mutants for the controller's ruling. One run of B2b in the first round reported an out-of-memory kill of a test worker; its failures were assertions and its verdict is unaffected.

## The new rows (B2a to B2j)

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| B2a | no gate while waiting | `src/enhance/diagrams.ts` | `    ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'waiting'); ⏎     const module = await load(ctx, config);` → `    ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'waiting'); ⏎     ctx.journal.setAttribute(ctx.root, 'data-docreader-mermaid', ''); ⏎     const module = await load(ctx, config);` | test/enhance-mermaid-after-ready.test.ts: 2 failed \| 8 passed (10). test/enhance-mermaid-after-ready.test.ts: load() has answered and the fonts are pending: still waiting, no gate; the fonts end: gate and drawing; the fi; test/enhance-mermaid-after-ready.test.ts: waiting, no gate, a visible code block per figure, no SVG; load() called once | sha256 `1c4af510b165…` restored, equal |
| B2b | automatic draw | `src/enhance/diagrams.ts` | `      ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'drawing'); ⏎     }); ⏎   } else {` → `      ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'drawing'); ⏎     }); ⏎     return; ⏎   } else {` | test/enhance-mermaid-after-ready.test.ts: 7 failed \| 3 passed (10). test/enhance-mermaid-after-ready.test.ts: an over-maxTextSize figure takes the long note through draw(), and the others are drawn (partial); test/enhance-mermaid-after-ready.test.ts: destroyed before load() answers: the state is gone at once; a later answer leaves no gate, no state, no drawin; test/enhance-mermaid-after-ready.test.ts: draws all, in the near-first order, and the root settles drawn with the gate set; test/enhance-mermaid-after-ready.test.ts: every figure shows the load note and the root reads failed; test/enhance-mermaid-after-ready.test.ts: load() has answered and the fonts are pending: still waiting, no gate; the fonts end: gate and drawing; the fi; test/enhance-mermaid-after-ready.test.ts: takes draw-failed with its note and source, and the root reads partial; test/enhance-mermaid-after-ready.test.ts: waiting, no gate, a visible code block per figure, no SVG; load() called once | sha256 `1c4af510b165…` restored, equal |
| B2c | nearest first | `src/enhance/diagrams.ts` | `.sort((a, b) => a.d - b.d \|\| a.i - b.i);` → `.sort((a, b) => a.i - b.i);` | test/enhance-mermaid-after-ready.test.ts: 1 failed \| 9 passed (10). test/enhance-mermaid-after-ready.test.ts: draws all, in the near-first order, and the root settles drawn with the gate set | sha256 `1c4af510b165…` restored, equal |
| B2d | null module path | `src/enhance/diagrams.ts` | `  if (api === null) { ⏎     for (const f of figs) finish(ctx, f, null, 'load');` → `  if (api === null && settings.draw !== 'after-ready') { ⏎     for (const f of figs) finish(ctx, f, null, 'load');` | test/enhance-mermaid-after-ready.test.ts: 1 failed \| 9 passed (10). test/enhance-mermaid-after-ready.test.ts: every figure shows the load note and the root reads failed | sha256 `1c4af510b165…` restored, equal |
| B2e | option accepted | `src/enhance/options.ts` | `['auto', 'on-request', 'after-ready'] as const` → `['auto', 'on-request'] as const` | test/enhance-options.test.ts: 1 failed \| 151 passed (152). test/enhance-options.test.ts: mermaid.draw: 'after-ready' is accepted and kept, and the values are the seed's list, held equal | sha256 `39cf4f0fa3c1…` restored, equal |
| B2g | fonts wait before the gate | `src/enhance/diagrams.ts` | `    if (!ctx.live()) return; ⏎     await ctx.env.fonts(FONT_WAIT_MS); ⏎     if (!ctx.live()) return; ⏎     api = mermaidOf(module);` → `    if (!ctx.live()) return; ⏎     ctx.journal.setAttribute(ctx.root, 'data-docreader-mermaid', ''); ⏎     await ctx.env.fonts(FONT_WAIT_MS); ⏎     if (!ctx.live()) return; ⏎     api = mermaidOf(module);` | test/enhance-mermaid-after-ready.test.ts: 1 failed \| 9 passed (10). test/enhance-mermaid-after-ready.test.ts: load() has answered and the fonts are pending: still waiting, no gate; the fonts end: gate and drawing; the fi | sha256 `1c4af510b165…` restored, equal |
| B2h | the `drawing` state | `src/enhance/diagrams.ts` | `      ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'drawing'); ⏎     }); ⏎   } else {` → `    }); ⏎   } else {` | test/enhance-mermaid-after-ready.test.ts: 1 failed \| 9 passed (10). test/enhance-mermaid-after-ready.test.ts: load() has answered and the fonts are pending: still waiting, no gate; the fonts end: gate and drawing; the fi | sha256 `1c4af510b165…` restored, equal |
| B2i | live check after load() | `src/enhance/diagrams.ts` | `    const module = await load(ctx, config); ⏎     if (!ctx.live()) return; ⏎ ` → `    const module = await load(ctx, config); ⏎ ` | stays green: 10 passed (10) (equivalent mutant, see below) | sha256 `1c4af510b165…` restored, equal |
| B2j | live check after the fonts wait | `src/enhance/diagrams.ts` | `    await ctx.env.fonts(FONT_WAIT_MS); ⏎     if (!ctx.live()) return; ⏎     api = mermaidOf(module);` → `    await ctx.env.fonts(FONT_WAIT_MS); ⏎     api = mermaidOf(module);` | stays green: 10 passed (10) (equivalent mutant, see below) | sha256 `1c4af510b165…` restored, equal |
| B2f | draw lists equal | `src/frame/seed.ts` | `Object.freeze(['auto', 'on-request', 'after-ready'] as const)` → `Object.freeze(['auto', 'on-request'] as const)` | test/enhance-mermaid-after-ready.test.ts test/frame-seed.test.ts test/enhance-mermaid-on-request.test.ts: 4 failed \| 190 passed (194). test/enhance-mermaid-after-ready.test.ts: the seed's and L2's are equal (C94(2)) and hold 'after-ready'; test/enhance-mermaid-on-request.test.ts: the type and the values are the seed's (src/frame/seed.ts), held equal; test/frame-seed.test.ts: mermaid: secure and draw alone pass; the caps at their maxima pass; test/frame-seed.test.ts: the prefs are FRAME_PREF_VALUES, and the draw values are auto, on-request and after-ready | sha256 `834b80ee30c6…` restored, equal |

## Equivalent mutants (B2i, B2j) (ruled equivalent)

Ruled equivalent mutants (ledger C107): after a destroy the journal refuses every write, load() answers null and the destroyed instance's fonts wait never settles, so no observable state differs; the checks stay as defence in depth.

The two `if (!ctx.live()) return;` checks in the new branch (after `load()` and after the fonts wait) cannot be reddened from outside the instance, so no case can go red on their removal; cases for both destroy windows are committed (B2.8) and pass with and without the checks. Argument: once an instance is destroyed (1) the journal refuses every write (`setAttribute` returns at once when the instance is not live), so the gate and state are never written; (2) `host.loadMermaid` answers null when the instance is not live, so the module is null and the null path's `finish()` calls write nothing; (3) the fonts wait never settles after destroy (`env.fonts` returns a promise that is never resolved once not live, and resolves only if live at the moment it settles), so nothing after it runs. The checks are kept as defence in depth and to stop the function early.

```json
[
  {
    "id": "B2a",
    "guard": "no gate while waiting",
    "file": "src/enhance/diagrams.ts",
    "old": "    ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'waiting');\n    const module = await load(ctx, config);",
    "new": "    ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'waiting');\n    ctx.journal.setAttribute(ctx.root, 'data-docreader-mermaid', '');\n    const module = await load(ctx, config);",
    "tests": "test/enhance-mermaid-after-ready.test.ts",
    "rc": 1,
    "red": "2 failed | 8 passed (10)",
    "failing": [
      "test/enhance-mermaid-after-ready.test.ts: load() has answered and the fonts are pending: still waiting, no gate; the fonts end: gate and drawing; the fi",
      "test/enhance-mermaid-after-ready.test.ts: waiting, no gate, a visible code block per figure, no SVG; load() called once"
    ],
    "assertionErrorsOnly": true,
    "sha256": "1c4af510b1652605bef39e93dda58e12e1814e2b9f9b6dc1a75d9a55689021e3",
    "restored": true
  },
  {
    "id": "B2b",
    "guard": "automatic draw",
    "file": "src/enhance/diagrams.ts",
    "old": "      ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'drawing');\n    });\n  } else {",
    "new": "      ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'drawing');\n    });\n    return;\n  } else {",
    "tests": "test/enhance-mermaid-after-ready.test.ts",
    "rc": 1,
    "red": "7 failed | 3 passed (10)",
    "failing": [
      "test/enhance-mermaid-after-ready.test.ts: an over-maxTextSize figure takes the long note through draw(), and the others are drawn (partial)",
      "test/enhance-mermaid-after-ready.test.ts: destroyed before load() answers: the state is gone at once; a later answer leaves no gate, no state, no drawin",
      "test/enhance-mermaid-after-ready.test.ts: draws all, in the near-first order, and the root settles drawn with the gate set",
      "test/enhance-mermaid-after-ready.test.ts: every figure shows the load note and the root reads failed",
      "test/enhance-mermaid-after-ready.test.ts: load() has answered and the fonts are pending: still waiting, no gate; the fonts end: gate and drawing; the fi",
      "test/enhance-mermaid-after-ready.test.ts: takes draw-failed with its note and source, and the root reads partial",
      "test/enhance-mermaid-after-ready.test.ts: waiting, no gate, a visible code block per figure, no SVG; load() called once"
    ],
    "assertionErrorsOnly": true,
    "sha256": "1c4af510b1652605bef39e93dda58e12e1814e2b9f9b6dc1a75d9a55689021e3",
    "restored": true
  },
  {
    "id": "B2c",
    "guard": "nearest first",
    "file": "src/enhance/diagrams.ts",
    "old": ".sort((a, b) => a.d - b.d || a.i - b.i);",
    "new": ".sort((a, b) => a.i - b.i);",
    "tests": "test/enhance-mermaid-after-ready.test.ts",
    "rc": 1,
    "red": "1 failed | 9 passed (10)",
    "failing": [
      "test/enhance-mermaid-after-ready.test.ts: draws all, in the near-first order, and the root settles drawn with the gate set"
    ],
    "assertionErrorsOnly": true,
    "sha256": "1c4af510b1652605bef39e93dda58e12e1814e2b9f9b6dc1a75d9a55689021e3",
    "restored": true
  },
  {
    "id": "B2d",
    "guard": "null module path",
    "file": "src/enhance/diagrams.ts",
    "old": "  if (api === null) {\n    for (const f of figs) finish(ctx, f, null, 'load');",
    "new": "  if (api === null && settings.draw !== 'after-ready') {\n    for (const f of figs) finish(ctx, f, null, 'load');",
    "tests": "test/enhance-mermaid-after-ready.test.ts",
    "rc": 1,
    "red": "1 failed | 9 passed (10)",
    "failing": [
      "test/enhance-mermaid-after-ready.test.ts: every figure shows the load note and the root reads failed"
    ],
    "assertionErrorsOnly": true,
    "sha256": "1c4af510b1652605bef39e93dda58e12e1814e2b9f9b6dc1a75d9a55689021e3",
    "restored": true
  },
  {
    "id": "B2e",
    "guard": "option accepted",
    "file": "src/enhance/options.ts",
    "old": "['auto', 'on-request', 'after-ready'] as const",
    "new": "['auto', 'on-request'] as const",
    "tests": "test/enhance-options.test.ts",
    "rc": 1,
    "red": "1 failed | 151 passed (152)",
    "failing": [
      "test/enhance-options.test.ts: mermaid.draw: 'after-ready' is accepted and kept, and the values are the seed's list, held equal"
    ],
    "assertionErrorsOnly": true,
    "sha256": "39cf4f0fa3c140c0326b8e97df87184000d2368ae6f09c3468961979e037b8be",
    "restored": true
  },
  {
    "id": "B2g",
    "guard": "fonts wait before the gate",
    "file": "src/enhance/diagrams.ts",
    "old": "    if (!ctx.live()) return;\n    await ctx.env.fonts(FONT_WAIT_MS);\n    if (!ctx.live()) return;\n    api = mermaidOf(module);",
    "new": "    if (!ctx.live()) return;\n    ctx.journal.setAttribute(ctx.root, 'data-docreader-mermaid', '');\n    await ctx.env.fonts(FONT_WAIT_MS);\n    if (!ctx.live()) return;\n    api = mermaidOf(module);",
    "tests": "test/enhance-mermaid-after-ready.test.ts",
    "rc": 1,
    "red": "1 failed | 9 passed (10)",
    "failing": [
      "test/enhance-mermaid-after-ready.test.ts: load() has answered and the fonts are pending: still waiting, no gate; the fonts end: gate and drawing; the fi"
    ],
    "assertionErrorsOnly": true,
    "sha256": "1c4af510b1652605bef39e93dda58e12e1814e2b9f9b6dc1a75d9a55689021e3",
    "restored": true
  },
  {
    "id": "B2h",
    "guard": "the `drawing` state",
    "file": "src/enhance/diagrams.ts",
    "old": "      ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'drawing');\n    });\n  } else {",
    "new": "    });\n  } else {",
    "tests": "test/enhance-mermaid-after-ready.test.ts",
    "rc": 1,
    "red": "1 failed | 9 passed (10)",
    "failing": [
      "test/enhance-mermaid-after-ready.test.ts: load() has answered and the fonts are pending: still waiting, no gate; the fonts end: gate and drawing; the fi"
    ],
    "assertionErrorsOnly": true,
    "sha256": "1c4af510b1652605bef39e93dda58e12e1814e2b9f9b6dc1a75d9a55689021e3",
    "restored": true
  },
  {
    "id": "B2i",
    "guard": "live check after load()",
    "file": "src/enhance/diagrams.ts",
    "old": "    const module = await load(ctx, config);\n    if (!ctx.live()) return;\n",
    "new": "    const module = await load(ctx, config);\n",
    "tests": "test/enhance-mermaid-after-ready.test.ts",
    "rc": 0,
    "red": "green: 10 passed (10)",
    "failing": [],
    "assertionErrorsOnly": null,
    "sha256": "1c4af510b1652605bef39e93dda58e12e1814e2b9f9b6dc1a75d9a55689021e3",
    "restored": true
  },
  {
    "id": "B2j",
    "guard": "live check after the fonts wait",
    "file": "src/enhance/diagrams.ts",
    "old": "    await ctx.env.fonts(FONT_WAIT_MS);\n    if (!ctx.live()) return;\n    api = mermaidOf(module);",
    "new": "    await ctx.env.fonts(FONT_WAIT_MS);\n    api = mermaidOf(module);",
    "tests": "test/enhance-mermaid-after-ready.test.ts",
    "rc": 0,
    "red": "green: 10 passed (10)",
    "failing": [],
    "assertionErrorsOnly": null,
    "sha256": "1c4af510b1652605bef39e93dda58e12e1814e2b9f9b6dc1a75d9a55689021e3",
    "restored": true
  },
  {
    "id": "B2f",
    "guard": "draw lists equal",
    "file": "src/frame/seed.ts",
    "old": "Object.freeze(['auto', 'on-request', 'after-ready'] as const)",
    "new": "Object.freeze(['auto', 'on-request'] as const)",
    "tests": "test/enhance-mermaid-after-ready.test.ts test/frame-seed.test.ts test/enhance-mermaid-on-request.test.ts",
    "rc": 1,
    "red": "4 failed | 190 passed (194)",
    "failing": [
      "test/enhance-mermaid-after-ready.test.ts: the seed's and L2's are equal (C94(2)) and hold 'after-ready'",
      "test/enhance-mermaid-on-request.test.ts: the type and the values are the seed's (src/frame/seed.ts), held equal",
      "test/frame-seed.test.ts: mermaid: secure and draw alone pass; the caps at their maxima pass",
      "test/frame-seed.test.ts: the prefs are FRAME_PREF_VALUES, and the draw values are auto, on-request and after-ready"
    ],
    "assertionErrorsOnly": true,
    "sha256": "834b80ee30c658550daa19c88c398a5e870a2769c8b5a6805f7ac34659f721c4",
    "restored": true
  }
]
```
