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

## Fix round FR1: the handover keeps the reader's place (finding F1)

Fix round FR1, item F1 (the review's finding F1, the coordinator's ruling): in 'after-ready' the gate (`data-docreader-mermaid`) and the state `drawing` were written by a bare `ctx.operate`, outside `ctx.position.keep` and with no relayout, so the placeholders' height (`min-height: 180px`) moved every block below a short fence above the reading line. The fix writes both inside `ctx.position.keep` and asks for `ctx.relayout('content')`, as the file's header says every change of a figure does. Measured on the fixed tree.

Red before the fix: `test/enhance-mermaid-after-ready.test.ts` B2.9 failed (`expected [] to have a length of 1`, the keep that wrote the gate), and `test/browser/mermaid-after-ready.test.ts` B5.8, both of its rows, failed on Chromium on the unfixed frame: the reading block moved from 149.78 px to 507 px under the frame's top (a limit of 2 px), with native scroll anchoring on as well as off. Green after: both files pass (13 passed | 13 skipped in the browser file, the WebKit rows skipped). B5.8 reads the reading block's top before the op is posted and again after every figure has settled; its tolerance is 2 px.

Method as above: bytes saved with the sha256 of the fixed file, one edit, a bounded run behind a `ulimit -u` of the measured thread count plus 1500 (2820 to 2870 threads, limits 4320 to 4370), the file restored by `cp` and its sha256 compared. B2m is a rebuild row: the generated outputs were saved before, the frame rebuilt with the mutation, and the outputs restored after.

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| B2k | the handover writes the gate inside the keep | `src/enhance/diagrams.ts` | the two writes (the gate and `drawing`) moved out of `ctx.position.keep(() => { ... })`, the relayout kept | test/enhance-mermaid-after-ready.test.ts: 1 failed \| 10 passed (11). test/enhance-mermaid-after-ready.test.ts: the gate and `drawing` are written inside one position.keep, and a relayout (content) is asked for before any figure is drawn | sha256 `a37947c6c91d54028c827bd35e806b2df4f1636f8131c2abab8cabfd25d631bc` restored, equal |
| B2l | the handover asks for a relayout | `src/enhance/diagrams.ts` | `ctx.relayout('content');` removed after the keep, in the same branch | test/enhance-mermaid-after-ready.test.ts: 1 failed \| 10 passed (11). test/enhance-mermaid-after-ready.test.ts: the gate and `drawing` are written inside one position.keep, and a relayout (content) is asked for before any figure is drawn | sha256 `a37947c6c91d54028c827bd35e806b2df4f1636f8131c2abab8cabfd25d631bc` restored, equal |
| B2m | the handover keeps the reader's place (Chromium) | `src/enhance/diagrams.ts` | as B2k; the frame is rebuilt for the row (`node scripts/build-frame.mjs`) | test/browser/mermaid-after-ready.test.ts -t B5.8 (Chromium): 3 failed \| 27 skipped (30). test/browser/mermaid-after-ready.test.ts: B5.8: the reading block stays where it was across the handover, within 2 px (the block moved from 149.78125 to 508); test/browser/mermaid-after-ready.test.ts: B5.8 (instrumented: `overflow-anchor: none` on the frame's root, the engine without scroll anchoring): the same; test/browser/mermaid-after-ready.test.ts: B5.8 (instrumented: `overflow-anchor: none` on the frame's root and the frame's `scrollTo` dropping a position's fraction of a pixel, the engine that keeps whole pixels): the reading block stays where it was across the handover, within 2 px (the block moved from 150.78125 to 509) | sha256 `a37947c6c91d54028c827bd35e806b2df4f1636f8131c2abab8cabfd25d631bc` restored, equal ; the generated outputs (assets/assets.json, src/frame/manifest.generated.ts, assets/frame/*) saved before and restored from the saved bytes after, each sha256 equal, then `node scripts/build-frame.mjs --check` green |

Re-run at fix round FR2 on the tip's bytes (review 1494, F5): B2m, with `src/enhance/diagrams.ts` at the sha256 above (3 failed | 27 skipped (30), the third B5.8 row having been added since; 2713 threads, limit 4213). The counts of the table row are those of this re-run.

```json
[
  {
    "id": "B2k",
    "guard": "the handover writes the gate inside the keep",
    "file": "src/enhance/diagrams.ts",
    "change": "the two writes (the gate and `drawing`) moved out of `ctx.position.keep(() => { ... })`, the relayout kept",
    "tests": "test/enhance-mermaid-after-ready.test.ts",
    "rc": 1,
    "red": "1 failed | 10 passed (11)",
    "failing": [
      "test/enhance-mermaid-after-ready.test.ts: the gate and `drawing` are written inside one position.keep, and a relayout (content) is asked for before any figure is drawn"
    ],
    "assertionErrorsOnly": true,
    "sha256": "a37947c6c91d54028c827bd35e806b2df4f1636f8131c2abab8cabfd25d631bc",
    "restored": true
  },
  {
    "id": "B2l",
    "guard": "the handover asks for a relayout",
    "file": "src/enhance/diagrams.ts",
    "change": "`ctx.relayout('content');` removed after the keep, in the same branch",
    "tests": "test/enhance-mermaid-after-ready.test.ts",
    "rc": 1,
    "red": "1 failed | 10 passed (11)",
    "failing": [
      "test/enhance-mermaid-after-ready.test.ts: the gate and `drawing` are written inside one position.keep, and a relayout (content) is asked for before any figure is drawn"
    ],
    "assertionErrorsOnly": true,
    "sha256": "a37947c6c91d54028c827bd35e806b2df4f1636f8131c2abab8cabfd25d631bc",
    "restored": true
  },
  {
    "id": "B2m",
    "guard": "the handover keeps the reader's place (Chromium)",
    "file": "src/enhance/diagrams.ts",
    "change": "as B2k; the frame is rebuilt for the row (`node scripts/build-frame.mjs`)",
    "tests": "test/browser/mermaid-after-ready.test.ts -t B5.8 (Chromium)",
    "rc": 1,
    "red": "3 failed | 27 skipped (30)",
    "failing": [
      "test/browser/mermaid-after-ready.test.ts: B5.8: the reading block stays where it was across the handover, within 2 px (the block moved from 149.78125 to 508)",
      "test/browser/mermaid-after-ready.test.ts: B5.8 (instrumented: `overflow-anchor: none` on the frame's root, the engine without scroll anchoring): the same",
      "test/browser/mermaid-after-ready.test.ts: B5.8 (instrumented: `overflow-anchor: none` on the frame's root and the frame's `scrollTo` dropping a position's fraction of a pixel, the engine that keeps whole pixels): the reading block stays where it was across the handover, within 2 px (the block moved from 150.78125 to 509)"
    ],
    "assertionErrorsOnly": true,
    "sha256": "a37947c6c91d54028c827bd35e806b2df4f1636f8131c2abab8cabfd25d631bc",
    "restored": true
  }
]
```

## Fix round FR1: on WebKit the keeps added up a fraction of a pixel each (finding F1, the CI failure of B5.8)

CI (both Node legs, WebKit only) failed both B5.8 rows: the reading block moved from 150.671875 to 153.453125 px, 2.78 px over a limit of 2. The gate's keep held; the cause is in `position.keep` (`src/enhance/nav.ts`). An engine keeps a scroll position in whole pixels, and WebKit drops the fraction it is asked for (the row's own first scroll, asked to put the block at 150, left it at 150.67: more than half a pixel, and below, so the fraction was dropped, not rounded). Each kept change of a fractional height (the gate, then six drawings) left the block up to a pixel lower, and the next keep anchored it where it was left, so the fractions added up. Chromium rounds to the nearest pixel, which hid it (0.78 px over the same seven changes). The fix: a keep that anchors the block the last keep put back, less than a pixel from the offset that keep aimed at, with the page not scrolled since, aims at that offset again. The tolerance stays 2 px: with the fix the error stays under one engine step, whatever the number of changes, on an engine whose scroll step is at most one CSS pixel; at browser zoom below 100% (a step above one CSS pixel) the drift adds up as it did before the fix, no worse (review 1494, F3, ledger C113).

Red before the fix: `test/enhance-nav.test.ts` (new case, a stage whose `scrollTo` drops the fraction: 4.5 px over six keeps) and a third B5.8 row with the frame's `scrollTo` wrapped to drop the fraction (5.22 px on Chromium). Green after: `test/enhance-nav.test.ts` 53 passed; `test/browser/mermaid-after-ready.test.ts` 15 passed | 15 skipped on Chromium (WebKit rows skipped; WebKit is proved in CI).

Method as above: `src/enhance/nav.ts` saved with its sha256, one edit, a bounded run behind a `ulimit -u` of the measured thread count plus 1500 (2416 to 2501 threads), the file restored by `cp` and its sha256 compared. B2o is a rebuild row: the generated outputs were saved before, the frame rebuilt with the mutation, and the outputs restored after, each sha256 equal, then `node scripts/build-frame.mjs --check` green.

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| B2n | a keep aims at the offset the last keep aimed at, so whole-pixel fractions do not add up | `src/enhance/nav.ts` | `at = Object.freeze({ line: at.line, offset: aimed.offset, y: at.y });` → `void 0;` | test/enhance-nav.test.ts: 1 failed \| 53 passed (54). test/enhance-nav.test.ts: position.keep > an engine that keeps whole pixels and drops the fraction of a scroll (as WebKit does): a run of keeps leaves the block within 1 px of where it was, never a fraction lost per keep (fix round FR1, F1) (expected 4.5 to be less than 1) | sha256 `8645cac2225073b6671cbc0a118bad7317a7d5c78cf8ffd3e03f6936fba3234d` restored, equal |
| B2o | the same, in the frame (Chromium) | `src/enhance/nav.ts` | as B2n; the frame is rebuilt for the row (`node scripts/build-frame.mjs`) | test/browser/mermaid-after-ready.test.ts -t B5.8 (Chromium): 1 failed \| 2 passed \| 27 skipped (30). test/browser/mermaid-after-ready.test.ts: B5.8 (instrumented: `overflow-anchor: none` on the frame's root and the frame's `scrollTo` dropping a position's fraction of a pixel, the engine that keeps whole pixels): the reading block stays where it was across the handover, within 2 px (the block moved from 150.78125 to 156) | sha256 `8645cac2225073b6671cbc0a118bad7317a7d5c78cf8ffd3e03f6936fba3234d` restored, equal ; the generated outputs (assets/assets.json, src/frame/manifest.generated.ts, assets/frame/*) saved before and restored from the saved bytes after, each sha256 equal, then `node scripts/build-frame.mjs --check` green |
| B2p | only while the page has not scrolled since | `src/enhance/nav.ts` | `at.y === aimed.y && ` removed from the condition | test/enhance-nav.test.ts: 1 failed \| 53 passed (54). test/enhance-nav.test.ts: position.keep > an engine that keeps whole pixels and drops the fraction of a scroll (as WebKit does): a run of keeps leaves the block within 1 px of where it was, never a fraction lost per keep (fix round FR1, F1) (expected 150.75 to be 151) | sha256 `8645cac2225073b6671cbc0a118bad7317a7d5c78cf8ffd3e03f6936fba3234d` restored, equal |
| B2q | only for a fraction: less than a pixel off | `src/enhance/nav.ts` | ` && Math.abs(at.offset - aimed.offset) < 1` removed from the condition | test/enhance-nav.test.ts: 1 failed \| 53 passed (54). test/enhance-nav.test.ts: position.keep > an engine that keeps whole pixels and drops the fraction of a scroll (as WebKit does): a run of keeps leaves the block within 1 px of where it was, never a fraction lost per keep (fix round FR1, F1) (expected 151 to be 181) | sha256 `8645cac2225073b6671cbc0a118bad7317a7d5c78cf8ffd3e03f6936fba3234d` restored, equal |
| B2r | only for the same block | `src/enhance/nav.ts` | `at.line === aimed.line && ` removed from the condition | test/enhance-nav.test.ts: 1 failed \| 53 passed (54). test/enhance-nav.test.ts: position.keep > an engine that keeps whole pixels and drops the fraction of a scroll (as WebKit does): a run of keeps leaves the block within 1 px of where it was, never a fraction lost per keep (fix round FR1, F1) (expected 181 to be 181.5) | sha256 `8645cac2225073b6671cbc0a118bad7317a7d5c78cf8ffd3e03f6936fba3234d` restored, equal |

Re-run at fix round FR2 on the tip's bytes (review 1494, F5): `src/enhance/nav.ts` at sha256 `8645cac2225073b6671cbc0a118bad7317a7d5c78cf8ffd3e03f6936fba3234d`; B2n, B2p, B2q and B2r on `test/enhance-nav.test.ts` (1 failed | 53 passed (54) each; 2961, 2996, 2587 and 2587 threads, limits 1500 above), B2o on the frame rebuilt (1 failed | 2 passed | 27 skipped (30); 2803 threads, limit 4303). Each file restored by byte copy with the sha256 equal, the generated outputs of B2o restored from the saved bytes, and `node scripts/build-frame.mjs --check` green after each. The sha256 and the counts of the rows are these; the earlier ones (`ab3857928c514e20e4923fca83d94318f49fa36aa6d8fec38259192e4041b22f`, 53 cases) were those of the file before a later comment edit and the cases added since.

```json
[
  {
    "id": "B2n",
    "guard": "a keep aims at the offset the last keep aimed at, so whole-pixel fractions do not add up",
    "file": "src/enhance/nav.ts",
    "change": "`at = Object.freeze({ line: at.line, offset: aimed.offset, y: at.y });` → `void 0;`",
    "tests": "test/enhance-nav.test.ts",
    "rc": 1,
    "red": "1 failed | 53 passed (54)",
    "failing": [
      "test/enhance-nav.test.ts: position.keep > an engine that keeps whole pixels and drops the fraction of a scroll (as WebKit does): a run of keeps leaves the block within 1 px of where it was, never a fraction lost per keep (fix round FR1, F1) (expected 4.5 to be less than 1)"
    ],
    "assertionErrorsOnly": true,
    "sha256": "8645cac2225073b6671cbc0a118bad7317a7d5c78cf8ffd3e03f6936fba3234d",
    "restored": true
  },
  {
    "id": "B2o",
    "guard": "the same, in the frame (Chromium)",
    "file": "src/enhance/nav.ts",
    "change": "as B2n; the frame is rebuilt for the row (`node scripts/build-frame.mjs`)",
    "tests": "test/browser/mermaid-after-ready.test.ts -t B5.8 (Chromium)",
    "rc": 1,
    "red": "1 failed | 2 passed | 27 skipped (30)",
    "failing": [
      "test/browser/mermaid-after-ready.test.ts: B5.8 (instrumented: `overflow-anchor: none` on the frame's root and the frame's `scrollTo` dropping a position's fraction of a pixel, the engine that keeps whole pixels): the reading block stays where it was across the handover, within 2 px (the block moved from 150.78125 to 156)"
    ],
    "assertionErrorsOnly": true,
    "sha256": "8645cac2225073b6671cbc0a118bad7317a7d5c78cf8ffd3e03f6936fba3234d",
    "restored": true
  },
  {
    "id": "B2p",
    "guard": "only while the page has not scrolled since",
    "file": "src/enhance/nav.ts",
    "change": "`at.y === aimed.y && ` removed from the condition",
    "tests": "test/enhance-nav.test.ts",
    "rc": 1,
    "red": "1 failed | 53 passed (54)",
    "failing": [
      "test/enhance-nav.test.ts: position.keep > an engine that keeps whole pixels and drops the fraction of a scroll (as WebKit does): a run of keeps leaves the block within 1 px of where it was, never a fraction lost per keep (fix round FR1, F1) (expected 150.75 to be 151)"
    ],
    "assertionErrorsOnly": true,
    "sha256": "8645cac2225073b6671cbc0a118bad7317a7d5c78cf8ffd3e03f6936fba3234d",
    "restored": true
  },
  {
    "id": "B2q",
    "guard": "only for a fraction: less than a pixel off",
    "file": "src/enhance/nav.ts",
    "change": "` && Math.abs(at.offset - aimed.offset) < 1` removed from the condition",
    "tests": "test/enhance-nav.test.ts",
    "rc": 1,
    "red": "1 failed | 53 passed (54)",
    "failing": [
      "test/enhance-nav.test.ts: position.keep > an engine that keeps whole pixels and drops the fraction of a scroll (as WebKit does): a run of keeps leaves the block within 1 px of where it was, never a fraction lost per keep (fix round FR1, F1) (expected 151 to be 181)"
    ],
    "assertionErrorsOnly": true,
    "sha256": "8645cac2225073b6671cbc0a118bad7317a7d5c78cf8ffd3e03f6936fba3234d",
    "restored": true
  },
  {
    "id": "B2r",
    "guard": "only for the same block",
    "file": "src/enhance/nav.ts",
    "change": "`at.line === aimed.line && ` removed from the condition",
    "tests": "test/enhance-nav.test.ts",
    "rc": 1,
    "red": "1 failed | 53 passed (54)",
    "failing": [
      "test/enhance-nav.test.ts: position.keep > an engine that keeps whole pixels and drops the fraction of a scroll (as WebKit does): a run of keeps leaves the block within 1 px of where it was, never a fraction lost per keep (fix round FR1, F1) (expected 181 to be 181.5)"
    ],
    "assertionErrorsOnly": true,
    "sha256": "8645cac2225073b6671cbc0a118bad7317a7d5c78cf8ffd3e03f6936fba3234d",
    "restored": true
  }
]
```
