# Batch Task 2: mutation rows (the `'after-ready'` draw mode)

Each row was measured in place on branch `ws/docserver-release-1-1` by the batch method: the bytes of the target file saved with their sha256, one edit applied, the named test files run as `./node_modules/.bin/vitest run --maxWorkers=2 <files>` behind `timeout -k 10 600` and a `ulimit -u` of the measured thread count plus 1500, then the file restored from the saved bytes (`cp`) and its sha256 compared. Every row exited 1. The rows act on unit tests that read sources, so no generated output was touched; `node scripts/build-frame.mjs --check` was run on the committed tree after the last row. The draw mode is ledger C107. B2f is the row the brief calls B3d in an earlier numbering.

## The new rows (B2a to B2f)

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| B2a | no gate while waiting | `src/enhance/diagrams.ts` | `    ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'waiting'); ⏎     const module = await load(ctx, config);` → `    ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'waiting'); ⏎     ctx.journal.setAttribute(ctx.root, 'data-docreader-mermaid', ''); ⏎     const module = await load(ctx, config);` | test/enhance-mermaid-after-ready.test.ts: 1 failed \| 5 passed (6). AssertionError: expected true to be false (the gate is present while waiting). | sha256 `324938935e97…` restored, equal |
| B2b | automatic draw | `src/enhance/diagrams.ts` | `    ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'drawing'); ⏎   } else {` → `    ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'drawing'); ⏎     return; ⏎   } else {` | test/enhance-mermaid-after-ready.test.ts: 4 failed \| 2 passed (6). AssertionError: expected 'drawing' to be 'drawn' (or 'failed', 'partial'). | sha256 `324938935e97…` restored, equal |
| B2c | nearest first | `src/enhance/diagrams.ts` | `.sort((a, b) => a.d - b.d \|\| a.i - b.i);` → `.sort((a, b) => a.i - b.i);` | test/enhance-mermaid-after-ready.test.ts: 1 failed \| 5 passed (6). AssertionError on the recorded render order. | sha256 `324938935e97…` restored, equal |
| B2d | null module path | `src/enhance/diagrams.ts` | `  if (api === null) { ⏎     for (const f of figs) finish(ctx, f, null, 'load');` → `  if (api === null && settings.draw !== 'after-ready') { ⏎     for (const f of figs) finish(ctx, f, null, 'load');` | test/enhance-mermaid-after-ready.test.ts: 1 failed \| 5 passed (6). AssertionError: expected 'drawing' to be 'failed'. | sha256 `324938935e97…` restored, equal |
| B2e | option accepted | `src/enhance/options.ts` | `['auto', 'on-request', 'after-ready'] as const` → `['auto', 'on-request'] as const` | test/enhance-mermaid-after-ready.test.ts: 6 failed (6); test/enhance-options.test.ts: 1 failed (7 failed \| 150 passed (157) in all). Six of the seven failures are the refusal EnhanceError 'mermaid.draw must be one of auto, on-request' thrown by normalizeOptions, which is the guard's own effect; B2.6 fails by AssertionError (the list no longer equals the seed's). | sha256 `39cf4f0fa3c1…` restored, equal |
| B2f | draw lists equal | `src/frame/seed.ts` | `Object.freeze(['auto', 'on-request', 'after-ready'] as const)` → `Object.freeze(['auto', 'on-request'] as const)` | 4 failed \| 186 passed (190) across the three files. AssertionErrors on list equality and on the seed's acceptance. | sha256 `834b80ee30c6…` restored, equal |

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
    "red": "test/enhance-mermaid-after-ready.test.ts: 1 failed | 5 passed (6)",
    "failing": [
      "test/enhance-mermaid-after-ready.test.ts: B2.1 before load() answers, the root waits with no gate and every source readable"
    ],
    "assertionErrorsOnly": true,
    "sha256": "324938935e979d6c05eed99b157f2b36ab0aac4ee0082a5f924147b88771c35e",
    "restored": true
  },
  {
    "id": "B2b",
    "guard": "automatic draw",
    "file": "src/enhance/diagrams.ts",
    "old": "    ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'drawing');\n  } else {",
    "new": "    ctx.journal.setAttribute(ctx.root, 'data-docreader-diagrams', 'drawing');\n    return;\n  } else {",
    "tests": "test/enhance-mermaid-after-ready.test.ts",
    "rc": 1,
    "red": "test/enhance-mermaid-after-ready.test.ts: 4 failed | 2 passed (6)",
    "failing": [
      "test/enhance-mermaid-after-ready.test.ts: B2.1",
      "test/enhance-mermaid-after-ready.test.ts: B2.2",
      "test/enhance-mermaid-after-ready.test.ts: B2.3",
      "test/enhance-mermaid-after-ready.test.ts: B2.4"
    ],
    "assertionErrorsOnly": true,
    "sha256": "324938935e979d6c05eed99b157f2b36ab0aac4ee0082a5f924147b88771c35e",
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
    "red": "test/enhance-mermaid-after-ready.test.ts: 1 failed | 5 passed (6)",
    "failing": [
      "test/enhance-mermaid-after-ready.test.ts: B2.2 once load() answers, every figure is drawn with no tap, nearest first"
    ],
    "assertionErrorsOnly": true,
    "sha256": "324938935e979d6c05eed99b157f2b36ab0aac4ee0082a5f924147b88771c35e",
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
    "red": "test/enhance-mermaid-after-ready.test.ts: 1 failed | 5 passed (6)",
    "failing": [
      "test/enhance-mermaid-after-ready.test.ts: B2.3 a module that is not Mermaid"
    ],
    "assertionErrorsOnly": true,
    "sha256": "324938935e979d6c05eed99b157f2b36ab0aac4ee0082a5f924147b88771c35e",
    "restored": true
  },
  {
    "id": "B2e",
    "guard": "option accepted",
    "file": "src/enhance/options.ts",
    "old": "['auto', 'on-request', 'after-ready'] as const",
    "new": "['auto', 'on-request'] as const",
    "tests": "test/enhance-mermaid-after-ready.test.ts test/enhance-options.test.ts",
    "rc": 1,
    "red": "test/enhance-mermaid-after-ready.test.ts: 6 failed (6); test/enhance-options.test.ts: 1 failed (7 failed | 150 passed (157) in all)",
    "failing": [
      "test/enhance-mermaid-after-ready.test.ts: B2.1 to B2.5, B2.6",
      "test/enhance-options.test.ts: chrome fields default to true one by one; a mermaid object without limits leaves them to the library"
    ],
    "assertionErrorsOnly": false,
    "sha256": "39cf4f0fa3c140c0326b8e97df87184000d2368ae6f09c3468961979e037b8be",
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
    "red": "4 failed | 186 passed (190) across the three files",
    "failing": [
      "test/enhance-mermaid-after-ready.test.ts: B2.6 the draw lists",
      "test/enhance-mermaid-on-request.test.ts: L3.D4 the type and the values are the seed's, held equal",
      "test/frame-seed.test.ts: mermaid: secure and draw alone pass; the caps at their maxima pass",
      "test/frame-seed.test.ts: the prefs are FRAME_PREF_VALUES, and the draw values are auto, on-request and after-ready"
    ],
    "assertionErrorsOnly": true,
    "sha256": "834b80ee30c658550daa19c88c398a5e870a2769c8b5a6805f7ac34659f721c4",
    "restored": true
  }
]
```
