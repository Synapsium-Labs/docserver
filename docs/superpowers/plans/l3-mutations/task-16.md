# L3 Task 16: mutation rows (Mermaid on request)

Each guard of Task 16, changed once, with the tests that go red: the enhance option `mermaid.draw` (`src/enhance/options.ts`), the on-request path of the diagrams feature (`src/enhance/diagrams.ts`), its stylesheet rule (`assets/reader.css`) and the bootstrap's pass-through helpers (`src/frame-runtime/adapters.ts`). Measured 2026-10-27 (UTC) on branch `l3-t16-mermaid-on-request` (base `a67556a`, the Task 16 changes not yet committed), on the final source and the final test files: the sha256 in each row's JSON is the mutated file's bytes before the mutation (`src/enhance/diagrams.ts` `2df6eb6e927f…`, `src/enhance/options.ts` `21624d6b8800…`, `src/frame-runtime/adapters.ts` `67c636a8dcae…`, `assets/reader.css` `901ccd09d337…`), and every row ran against the same test files (`test/enhance-mermaid-on-request.test.ts` `0038383221eb…`, 23 tests; `test/browser/mermaid-on-request.test.ts` `42891dceddb5…`, 1 test per engine).

**Result.** 8 rows (the plan's four, L3.D1a to L3.D4a, and four added), all red, none equivalent. Every red run exits 1 and every failing test fails through an `AssertionError`. No row mutates a frame build input that a test reads through the built files: the jsdom rows import the sources, and the browser row's page is served `assets/reader.css` itself, so no row rebuilt the assets. The last logged `node scripts/build-frame.mjs --check` of this first measurement exited 0 before the rows ran, not after them (review E3); every row's restore was then checked by sha256, and the fix round below runs `--check` after its own last row, logged, and it exits 0. The fix round re-measures every row of this record on the fix round's files and adds seven; its section is the current record, and the sections above stand as the first measurement.

**Method** (Global Constraints, "Low disk"; C69, C75). One row at a time, in place in the task's own worktree, never in parallel and never in a copy of the repository. For each row, the file's original bytes and their sha256 were saved outside the worktree; the `old` text was checked to occur exactly once and replaced by its `new`. The thread count was measured (`ps -L -u "$(id -u)" --no-headers | wc -l`) and the row ran as the command in its JSON, with its output captured to a log named by the row id. The file was then restored from the saved bytes and its sha256 checked equal (never `git checkout`); every restore matched. The browser row ran on Chromium only (C69: WebKit cannot start locally; CI runs the row on both engines). An attempt with no assertion failure would be recorded as environment and run again, never counted; none occurred.

In the Change column a line break is shown as ` ⏎ ` and a backtick as `ˋ`; the JSON fence holds the exact text.

## L3.D1: On request, nothing loads or draws at startup (src/enhance/diagrams.ts, assets/reader.css)

The plan's row: ignore the option (L3.D1a). Added: the stylesheet rule that hides a drawn figure's source on request (L3.D1css, red in the new browser row on Chromium; CI runs it on WebKit too).

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.D1a | on request the second phase loads and draws nothing (ignore the option) | `src/enhance/diagrams.ts`: `  if (settings.draw === 'on-request') { ⏎     onRequest(ctx, settings, figs); ⏎     return; ⏎   } ⏎ ` → (removed) | rc 1, 7 failed \| 16 passed (23). "after enhance() resolves: no load, no SVG, the root reads on-request, one Render button per drawable figure, and the over-long figure has none and shows its note"; "a destroy removes the buttons and the state; a tap made after it draws nothing"; "a tap on the second figure loads once and draws it alone; a later tap on the first draws it with no second load"; "a second tap on the same figure draws it once"; "a module that is not Mermaid leaves the tapped figure to its load note; the others keep their buttons"; "two quick taps: the second draw starts only after the first settles, its button busy meanwhile"; "a failing figure shows its note and source, and does not block the next" | `src/enhance/diagrams.ts` 2df6eb6e927f restored, equal |
| L3.D1css | a drawn figure's source is hidden on request (drop the rule's `.drawn` selector only; its `.draw-failed` selector is the fix round's L3.D1css-f) | `assets/reader.css`: `[data-docreader-root][data-docreader-root][data-docreader-diagrams="on-request"]:not(i) figure.mermaid-figure.drawn > pre.mermaid:not([data-docreader-chrome]), ⏎ ` → (removed) | rc 1, 1 failed \| 1 skipped (2). "on request: no Mermaid request at enhance, readable sources with Render buttons; a tap, then Enter, each draws its figure alone, with no violation" | `assets/reader.css` 901ccd09d337 restored, equal |

```json
[
  {
    "id": "L3.D1a",
    "guard": "on request the second phase loads and draws nothing (ignore the option)",
    "changes": [
      {
        "file": "src/enhance/diagrams.ts",
        "old": "  if (settings.draw === 'on-request') {\n    onRequest(ctx, settings, figs);\n    return;\n  }\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "7 failed | 16 passed (23)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > L3.D1: on request, the second phase loads nothing and draws nothing > after enhance() resolves: no load, no SVG, the root reads on-request, one Render button per drawable figure, and the over-long figure has none and shows its note",
      "test/enhance-mermaid-on-request.test.ts > L3.D1: on request, the second phase loads nothing and draws nothing > a destroy removes the buttons and the state; a tap made after it draws nothing",
      "test/enhance-mermaid-on-request.test.ts > L3.D2: a tap draws that figure only, and loads once > a tap on the second figure loads once and draws it alone; a later tap on the first draws it with no second load",
      "test/enhance-mermaid-on-request.test.ts > L3.D2: a tap draws that figure only, and loads once > a second tap on the same figure draws it once",
      "test/enhance-mermaid-on-request.test.ts > L3.D2: a tap draws that figure only, and loads once > a module that is not Mermaid leaves the tapped figure to its load note; the others keep their buttons",
      "test/enhance-mermaid-on-request.test.ts > L3.D3: draws run one at a time > two quick taps: the second draw starts only after the first settles, its button busy meanwhile",
      "test/enhance-mermaid-on-request.test.ts > L3.D3: draws run one at a time > a failing figure shows its note and source, and does not block the next"
    ],
    "assertions": [
      "AssertionError: expected 1 to be +0 // Object.is equality",
      "AssertionError: the figure's one Render button: expected [] to have a length of 1 but got +0",
      "AssertionError: the figure's one Render button: expected [] to have a length of 1 but got +0",
      "AssertionError: the figure's one Render button: expected [] to have a length of 1 but got +0",
      "AssertionError: the figure's one Render button: expected [] to have a length of 1 but got +0",
      "AssertionError: the figure's one Render button: expected [] to have a length of 1 but got +0",
      "AssertionError: the figure's one Render button: expected [] to have a length of 1 but got +0"
    ],
    "sha256": "2df6eb6e927f4785830897b586ccd07d681ca746c8efe529bdca007dc17d5e56",
    "restored": true
  },
  {
    "id": "L3.D1css",
    "guard": "a drawn figure's source is hidden on request (drop the rule's .drawn selector only; its .draw-failed selector is the fix round's L3.D1css-f)",
    "changes": [
      {
        "file": "assets/reader.css",
        "old": "[data-docreader-root][data-docreader-root][data-docreader-diagrams=\"on-request\"]:not(i) figure.mermaid-figure.drawn > pre.mermaid:not([data-docreader-chrome]),\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "1 failed | 1 skipped (2)",
    "failing": [
      "test/browser/mermaid-on-request.test.ts > chromium > on request: no Mermaid request at enhance, readable sources with Render buttons; a tap, then Enter, each draws its figure alone, with no violation"
    ],
    "assertions": [
      "AssertionError: expected 'block' to be 'none' // Object.is equality"
    ],
    "sha256": "901ccd09d3377419f7db51e97ce336bfacb3a22d89030d72d604d61e7d12bca2",
    "restored": true
  }
]
```

## L3.D2: A tap draws its figure only (src/enhance/diagrams.ts)

The plan's row: draw every figure on the first tap.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.D2a | a tap draws that figure only (draw every figure on the first tap) | `src/enhance/diagrams.ts`: `    else drawn = await draw(ctx, a, config, settings, f);` → `    else for (const g of figs) drawn = await draw(ctx, a, config, settings, g);` | rc 1, 4 failed \| 19 passed (23). "a tap on the second figure loads once and draws it alone; a later tap on the first draws it with no second load"; "a second tap on the same figure draws it once"; "two quick taps: the second draw starts only after the first settles, its button busy meanwhile"; "a failing figure shows its note and source, and does not block the next" | `src/enhance/diagrams.ts` 2df6eb6e927f restored, equal |

```json
[
  {
    "id": "L3.D2a",
    "guard": "a tap draws that figure only (draw every figure on the first tap)",
    "changes": [
      {
        "file": "src/enhance/diagrams.ts",
        "old": "    else drawn = await draw(ctx, a, config, settings, f);",
        "new": "    else for (const g of figs) drawn = await draw(ctx, a, config, settings, g);"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "4 failed | 19 passed (23)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > L3.D2: a tap draws that figure only, and loads once > a tap on the second figure loads once and draws it alone; a later tap on the first draws it with no second load",
      "test/enhance-mermaid-on-request.test.ts > L3.D2: a tap draws that figure only, and loads once > a second tap on the same figure draws it once",
      "test/enhance-mermaid-on-request.test.ts > L3.D3: draws run one at a time > two quick taps: the second draw starts only after the first settles, its button busy meanwhile",
      "test/enhance-mermaid-on-request.test.ts > L3.D3: draws run one at a time > a failing figure shows its note and source, and does not block the next"
    ],
    "assertions": [
      "AssertionError: expected [ 'run one', 'run two', 'run three' ] to deeply equal [ 'run two' ]",
      "AssertionError: expected [ 'run one', 'run two', 'run three' ] to deeply equal [ 'run one' ]",
      "AssertionError: expected [ 'run one', 'run one' ] to deeply equal [ 'run one', 'run two' ]",
      "AssertionError: expected [ 'run one' ] to deeply equal [ 'run two' ]"
    ],
    "sha256": "2df6eb6e927f4785830897b586ccd07d681ca746c8efe529bdca007dc17d5e56",
    "restored": true
  }
]
```

## L3.D3: One draw at a time (src/enhance/diagrams.ts)

The plan's row: draw concurrently (the tap runs Mermaid's call directly, outside L2's per-module queue; the auto path is unchanged by the mutant). Added: drop the busy state of a waiting tap's button (L3.D3b).

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.D3a | draws run one at a time through the module's queue (draw concurrently: the tap calls Mermaid outside the queue) | `src/enhance/diagrams.ts`: `    else drawn = await draw(ctx, a, config, settings, f);` → `    else drawn = await (async (): Promise<boolean \| null> => { ⏎       const d = await call(ctx, a, config, f); ⏎       if (!ctx.live() \|\| d === null) return null; ⏎       const svg = d.parentNode === f.entry.figure ? drawnSvg(d) : null; ⏎       finish(ctx, f, svg, 'error'); ⏎       return svg !== null; ⏎     })();` | rc 1, 2 failed \| 21 passed (23). "two quick taps: the second draw starts only after the first settles, its button busy meanwhile"; "a failing figure shows its note and source, and does not block the next" | `src/enhance/diagrams.ts` 2df6eb6e927f restored, equal |
| L3.D3b | a waiting tap's button is busy (drop the aria-busy write) | `src/enhance/diagrams.ts`: `        ctx.journal.setAttribute(button, 'aria-busy', 'true'); ⏎ ` → (removed) | rc 1, 1 failed \| 22 passed (23). "two quick taps: the second draw starts only after the first settles, its button busy meanwhile" | `src/enhance/diagrams.ts` 2df6eb6e927f restored, equal |

```json
[
  {
    "id": "L3.D3a",
    "guard": "draws run one at a time through the module's queue (draw concurrently: the tap calls Mermaid outside the queue)",
    "changes": [
      {
        "file": "src/enhance/diagrams.ts",
        "old": "    else drawn = await draw(ctx, a, config, settings, f);",
        "new": "    else drawn = await (async (): Promise<boolean | null> => {\n      const d = await call(ctx, a, config, f);\n      if (!ctx.live() || d === null) return null;\n      const svg = d.parentNode === f.entry.figure ? drawnSvg(d) : null;\n      finish(ctx, f, svg, 'error');\n      return svg !== null;\n    })();"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "2 failed | 21 passed (23)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > L3.D3: draws run one at a time > two quick taps: the second draw starts only after the first settles, its button busy meanwhile",
      "test/enhance-mermaid-on-request.test.ts > L3.D3: draws run one at a time > a failing figure shows its note and source, and does not block the next"
    ],
    "assertions": [
      "AssertionError: expected [ 'run one', 'run two' ] to deeply equal [ 'run one' ]",
      "AssertionError: expected [ 'run two', 'run three' ] to deeply equal [ 'run two' ]"
    ],
    "sha256": "2df6eb6e927f4785830897b586ccd07d681ca746c8efe529bdca007dc17d5e56",
    "restored": true
  },
  {
    "id": "L3.D3b",
    "guard": "a waiting tap's button is busy (drop the aria-busy write)",
    "changes": [
      {
        "file": "src/enhance/diagrams.ts",
        "old": "        ctx.journal.setAttribute(button, 'aria-busy', 'true');\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "1 failed | 22 passed (23)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > L3.D3: draws run one at a time > two quick taps: the second draw starts only after the first settles, its button busy meanwhile"
    ],
    "assertions": [
      "AssertionError: expected null to be 'true' // Object.is equality"
    ],
    "sha256": "2df6eb6e927f4785830897b586ccd07d681ca746c8efe529bdca007dc17d5e56",
    "restored": true
  }
]
```

## L3.D4: Only two values (src/enhance/options.ts)

The plan's row: accept any value.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.D4a | normalizeOptions refuses any draw but 'auto' and 'on-request' (accept any value) | `src/enhance/options.ts`: `  const found = MERMAID_DRAW_VALUES.find((d) => d === v);` → `  const found = v as MermaidDraw;` | rc 1, 8 failed \| 15 passed (23). "refuses lazy as invalid-options"; "refuses true as invalid-options"; "refuses null as invalid-options"; "refuses an empty string as invalid-options"; "refuses On-Request as invalid-options"; "refuses a number as invalid-options"; "refuses an object as invalid-options"; "a refused draw rejects enhance() and leaves the root untouched" | `src/enhance/options.ts` 21624d6b8800 restored, equal |

```json
[
  {
    "id": "L3.D4a",
    "guard": "normalizeOptions refuses any draw but 'auto' and 'on-request' (accept any value)",
    "changes": [
      {
        "file": "src/enhance/options.ts",
        "old": "  const found = MERMAID_DRAW_VALUES.find((d) => d === v);",
        "new": "  const found = v as MermaidDraw;"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "8 failed | 15 passed (23)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > L3.D4: draw absent is 'auto'; only 'auto' and 'on-request' are accepted > refuses lazy as invalid-options",
      "test/enhance-mermaid-on-request.test.ts > L3.D4: draw absent is 'auto'; only 'auto' and 'on-request' are accepted > refuses true as invalid-options",
      "test/enhance-mermaid-on-request.test.ts > L3.D4: draw absent is 'auto'; only 'auto' and 'on-request' are accepted > refuses null as invalid-options",
      "test/enhance-mermaid-on-request.test.ts > L3.D4: draw absent is 'auto'; only 'auto' and 'on-request' are accepted > refuses an empty string as invalid-options",
      "test/enhance-mermaid-on-request.test.ts > L3.D4: draw absent is 'auto'; only 'auto' and 'on-request' are accepted > refuses On-Request as invalid-options",
      "test/enhance-mermaid-on-request.test.ts > L3.D4: draw absent is 'auto'; only 'auto' and 'on-request' are accepted > refuses a number as invalid-options",
      "test/enhance-mermaid-on-request.test.ts > L3.D4: draw absent is 'auto'; only 'auto' and 'on-request' are accepted > refuses an object as invalid-options",
      "test/enhance-mermaid-on-request.test.ts > L3.D4: draw absent is 'auto'; only 'auto' and 'on-request' are accepted > a refused draw rejects enhance() and leaves the root untouched"
    ],
    "assertions": [
      "AssertionError: expected 'accepted' to match /^invalid-options: docreader: mermaid\\…/",
      "AssertionError: promise resolved \"undefined\" instead of rejecting"
    ],
    "sha256": "21624d6b8800e3c486d3abcea109898285c9ad2a760ada3784f552c550ab721b",
    "restored": true
  }
]
```

## L3.D5u: The bootstrap pass-through, unit half (src/frame-runtime/adapters.ts)

Not a plan row: the frame's half of L3.D5 is Task 8's browser row (its mutations: ready waits for drawing in on-request mode; drop the seed field). These two rows pin the same two guards at unit level, on the helpers the bootstrap calls.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.D5u-a | the bootstrap passes the seed's draw to enhance (drop the field from enhanceMermaid) | `src/frame-runtime/adapters.ts`: `    draw: m.draw, ⏎ ` → (removed) | rc 1, 2 failed \| 21 passed (23). "enhanceMermaid passes the seed's caps, secure keys and draw, with a load that answers the registered API"; "what it builds is what L2 accepts: each seed draw reaches the normalized options unchanged" | `src/frame-runtime/adapters.ts` 67c636a8dcae restored, equal |
| L3.D5u-b | ready waits for drawing only in 'auto' mode (wait whenever Mermaid is on) | `src/frame-runtime/adapters.ts`: `  return m !== null && m.draw === 'auto';` → `  return m !== null;` | rc 1, 1 failed \| 22 passed (23). "ready waits for drawing only in 'auto' mode with Mermaid on" | `src/frame-runtime/adapters.ts` 67c636a8dcae restored, equal |

```json
[
  {
    "id": "L3.D5u-a",
    "guard": "the bootstrap passes the seed's draw to enhance (drop the field from enhanceMermaid)",
    "changes": [
      {
        "file": "src/frame-runtime/adapters.ts",
        "old": "    draw: m.draw,\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "2 failed | 21 passed (23)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > enhanceMermaid passes the seed's caps, secure keys and draw, with a load that answers the registered API",
      "test/enhance-mermaid-on-request.test.ts > the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > what it builds is what L2 accepts: each seed draw reaches the normalized options unchanged"
    ],
    "assertions": [
      "AssertionError: expected { maxTextSize: 16384, …(3) } to deeply equal { maxTextSize: 16384, …(4) }",
      "AssertionError: expected { maxTextSize: 100, …(3) } to deeply equal { maxTextSize: 100, …(3) }"
    ],
    "sha256": "67c636a8dcaed1f7a75c5d1515364a261b84ed00c628b9d1f3ac3648ff5ff475",
    "restored": true
  },
  {
    "id": "L3.D5u-b",
    "guard": "ready waits for drawing only in 'auto' mode (wait whenever Mermaid is on)",
    "changes": [
      {
        "file": "src/frame-runtime/adapters.ts",
        "old": "  return m !== null && m.draw === 'auto';",
        "new": "  return m !== null;"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "1 failed | 22 passed (23)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > ready waits for drawing only in 'auto' mode with Mermaid on"
    ],
    "assertions": [
      "AssertionError: expected true to be false // Object.is equality"
    ],
    "sha256": "67c636a8dcaed1f7a75c5d1515364a261b84ed00c628b9d1f3ac3648ff5ff475",
    "restored": true
  }
]
```

## Fix round (reviews S1, S2, E1, E2, E3): every row re-measured, seven added

Measured 2026-10-27 (UTC) after the review panel's findings, on the same branch and base, one row at a time with the method above, on the fix round's final files: `src/enhance/diagrams.ts` `2df6eb6e927f…`, `src/enhance/options.ts` `21624d6b8800…`, `src/frame-runtime/adapters.ts` `5e812784112a…`, `src/frame-runtime/bootstrap.ts` `a6f088df0d7b…`, `src/frame-runtime/styles.ts` `b45774c99d8d…`, `assets/reader.css` `901ccd09d337…`; tests `test/enhance-mermaid-on-request.test.ts` `7cee456f6c9f…` (27 tests) and `test/browser/mermaid-on-request.test.ts` `541994a8e8aa…` (4 tests per engine), with `test/browser/harness.ts` `0b2297205cf7…` and `test/browser/frame-host-page.ts` `175987e5ab20…`.

What changed since the first measurement:
- **S1.** On request the bootstrap asks for inline style before ready (`src/frame-runtime/styles.ts`, called when `probesInlineStyle(seed.mermaid)`), so a host page policy that would break a drawing after ready ends the boot instead (ready, then error boot). Rows L3.D6a to L3.D6e. Its behavioural witness is the browser file's frame block; before the fix, its first row was red on Chromium (`expected [ready] to deeply equal [ready, error]`), with its two controls green.
- **S2.** The browser row counts the Mermaid file's requests at the harness's route (`OpenedDoc.served`), not through Resource Timing. Row L3.D1b shows the count has teeth on Chromium.
- **E1.** The browser row's document gains a figure longer than its `maxTextSize`; it asserts that figure's raw source computes `display: none` and its note shows. L3.D1css now names the `.drawn` selector only, and L3.D1css-f covers the `.draw-failed` selector, each with its own witness line (156 and 136).

**Method additions.** A row whose witness builds the frame (the browser file's frame block builds the assets in memory, and `frameDocument` checks them against the committed manifest) also saved the build outputs' bytes and sha256 (`assets/assets.json`, `src/frame/manifest.generated.ts`, `assets/frame/*`, `assets/mermaid/*`), rebuilt them from the mutant with `node scripts/build-frame.mjs` before the test run, and restored them from the saved bytes afterwards, each sha256 checked equal. So every frame row ran on a manifest that matched its mutant, and only the guard decided the row. `node scripts/build-frame.mjs --check` exited 0 after the last row (logged). Browser rows ran on Chromium only (C69); CI runs them on both engines.

**Result.** 15 rows, all red, none equivalent: the first measurement's eight, with the same failing tests as before, and seven new ones. Every red run exits 1 and every failing test fails through an `AssertionError`. Where only a jsdom row is red, the browser rows stayed green on Chromium, and the jsdom row is the witness:
- **L3.D6c.** Under the hash-only page policy the `<style>` element's check alone already fails the boot.
- **L3.D6d.** A style attribute on a detached element still raises a violation that reaches the document.
- **L3.D6e.** On Chromium the violation still reaches the document after an early removal. The order is pinned by the source scan.

| Row | Guard | Change | Red | Restore |
|---|---|---|---|---|
| L3.D1a | on request the second phase loads and draws nothing (ignore the option) | `src/enhance/diagrams.ts`: `  if (settings.draw === 'on-request') { ⏎     onRequest(ctx, settings, figs); ⏎     return; ⏎   } ⏎ ` → (removed) | rc 1, 7 failed \| 20 passed (27). "a destroy removes the buttons and the state; a tap made after it draws nothing"; "after enhance() resolves: no load, no SVG, the root reads on-request, one Render button per drawable figure, and the over-long figure has none and shows its note"; "a module that is not Mermaid leaves the tapped figure to its load note; the others keep their buttons"; "a second tap on the same figure draws it once"; "a tap on the second figure loads once and draws it alone; a later tap on the first draws it with no second load"; "a failing figure shows its note and source, and does not block the next"; "two quick taps: the second draw starts only after the first settles, its button busy meanwhile" | `src/enhance/diagrams.ts` 2df6eb6e927f restored, equal |
| L3.D1css | a drawn figure's source is hidden on request (drop the rule's .drawn selector only) | `assets/reader.css`: `[data-docreader-root][data-docreader-root][data-docreader-diagrams="on-request"]:not(i) figure.mermaid-figure.drawn > pre.mermaid:not([data-docreader-chrome]), ⏎ ` → (removed) | rc 1, 1 failed \| 3 passed \| 4 skipped (8). "on request: no Mermaid request at enhance, readable sources with Render buttons, the over-long figure's note and not its source; a tap, then Enter, each draws its figure alone, with no violation" | `assets/reader.css` 901ccd09d337 restored, equal; build outputs restored, equal |
| L3.D1css-f | a failed figure's source is hidden on request, its note shown (drop the rule's .draw-failed selector) | `assets/reader.css`: `, ⏎ [data-docreader-root][data-docreader-root][data-docreader-diagrams="on-request"]:not(i) figure.mermaid-figure.draw-failed > pre.mermaid:not([data-docreader-chrome])` → (removed) | rc 1, 1 failed \| 3 passed \| 4 skipped (8). "on request: no Mermaid request at enhance, readable sources with Render buttons, the over-long figure's note and not its source; a tap, then Enter, each draws its figure alone, with no violation" | `assets/reader.css` 901ccd09d337 restored, equal; build outputs restored, equal |
| L3.D1b | on request nothing asks for the Mermaid file before a tap, counted at the harness's route (load at enhance) | `src/enhance/diagrams.ts`: `  const max = settings.maxTextSize ?? MAX_TEXT_SIZE; ⏎ ` → `  void api(); ⏎   const max = settings.maxTextSize ?? MAX_TEXT_SIZE; ⏎ ` | rc 1, 1 failed \| 3 passed \| 4 skipped (8). "on request: no Mermaid request at enhance, readable sources with Render buttons, the over-long figure's note and not its source; a tap, then Enter, each draws its figure alone, with no violation" | `src/enhance/diagrams.ts` 2df6eb6e927f restored, equal; build outputs restored, equal |
| L3.D2a | a tap draws that figure only (draw every figure on the first tap) | `src/enhance/diagrams.ts`: `    else drawn = await draw(ctx, a, config, settings, f);` → `    else for (const g of figs) drawn = await draw(ctx, a, config, settings, g);` | rc 1, 4 failed \| 23 passed (27). "a second tap on the same figure draws it once"; "a tap on the second figure loads once and draws it alone; a later tap on the first draws it with no second load"; "a failing figure shows its note and source, and does not block the next"; "two quick taps: the second draw starts only after the first settles, its button busy meanwhile" | `src/enhance/diagrams.ts` 2df6eb6e927f restored, equal |
| L3.D3a | draws run one at a time through the module's queue (draw concurrently: the tap calls Mermaid outside the queue) | `src/enhance/diagrams.ts`: `    else drawn = await draw(ctx, a, config, settings, f);` → `    else drawn = await (async (): Promise<boolean \| null> => { ⏎       const d = await call(ctx, a, config, f); ⏎       if (!ctx.live() \|\| d === null) return null; ⏎       const svg = d.parentNode === f.entry.figure ? drawnSvg(d) : null; ⏎       finish(ctx, f, svg, 'error'); ⏎       return svg !== null; ⏎     })();` | rc 1, 2 failed \| 25 passed (27). "a failing figure shows its note and source, and does not block the next"; "two quick taps: the second draw starts only after the first settles, its button busy meanwhile" | `src/enhance/diagrams.ts` 2df6eb6e927f restored, equal |
| L3.D3b | a waiting tap's button is busy (drop the aria-busy write) | `src/enhance/diagrams.ts`: `        ctx.journal.setAttribute(button, 'aria-busy', 'true'); ⏎ ` → (removed) | rc 1, 1 failed \| 26 passed (27). "two quick taps: the second draw starts only after the first settles, its button busy meanwhile" | `src/enhance/diagrams.ts` 2df6eb6e927f restored, equal |
| L3.D4a | normalizeOptions refuses any draw but 'auto' and 'on-request' (accept any value) | `src/enhance/options.ts`: `  const found = MERMAID_DRAW_VALUES.find((d) => d === v);` → `  const found = v as MermaidDraw;` | rc 1, 8 failed \| 19 passed (27). "a refused draw rejects enhance() and leaves the root untouched"; "refuses On-Request as invalid-options"; "refuses a number as invalid-options"; "refuses an empty string as invalid-options"; "refuses an object as invalid-options"; "refuses lazy as invalid-options"; "refuses null as invalid-options"; "refuses true as invalid-options" | `src/enhance/options.ts` 21624d6b8800 restored, equal |
| L3.D5u-a | the bootstrap passes the seed's draw to enhance (drop the field from enhanceMermaid) | `src/frame-runtime/adapters.ts`: `    draw: m.draw, ⏎ ` → (removed) | rc 1, 2 failed \| 25 passed (27). "enhanceMermaid passes the seed's caps, secure keys and draw, with a load that answers the registered API"; "what it builds is what L2 accepts: each seed draw reaches the normalized options unchanged" | `src/frame-runtime/adapters.ts` 5e812784112a restored, equal |
| L3.D5u-b | ready waits for drawing only in 'auto' mode (wait whenever Mermaid is on) | `src/frame-runtime/adapters.ts`: `  return m !== null && m.draw === 'auto';` → `  return m !== null;` | rc 1, 1 failed \| 26 passed (27). "ready waits for drawing only in 'auto' mode with Mermaid on" | `src/frame-runtime/adapters.ts` 5e812784112a restored, equal |
| L3.D6a | on request the bootstrap asks for inline style before ready (drop the probe) | `src/frame-runtime/bootstrap.ts`: `probesInlineStyle(seed.mermaid) ? probeInlineStyle(doc, styles) : null;` → `null as (() => void) \| null;` | rc 1, 2 failed \| 29 passed \| 4 skipped (35). "frame, on request, under a host page policy that allows inline style only by the frame stylesheet's hash: ready, then error boot, nothing drawn"; "the bootstrap reads the built-ins in Phase S, probes when probesInlineStyle(seed.mermaid) after enhance and before the face probe, and takes the probe out only after the last tick, before the state settles" | `src/frame-runtime/bootstrap.ts` a6f088df0d7b restored, equal; build outputs restored, equal |
| L3.D6b | the probe runs with Mermaid on request (probesInlineStyle answers false) | `src/frame-runtime/adapters.ts`: `  return m !== null && m.draw === 'on-request'; ⏎ ` → `  return false; ⏎ ` | rc 1, 2 failed \| 29 passed \| 4 skipped (35). "frame, on request, under a host page policy that allows inline style only by the frame stylesheet's hash: ready, then error boot, nothing drawn"; "probesInlineStyle: only with Mermaid on and drawn on request" | `src/frame-runtime/adapters.ts` 5e812784112a restored, equal; build outputs restored, equal |
| L3.D6c | the probe asks for a style attribute too, the style-src-attr check (drop the attribute) | `src/frame-runtime/styles.ts`: `      i.setAttribute.call(el, 'style', STYLE_PROBE_ATTR); ⏎ ` → (removed) | rc 1, 1 failed \| 30 passed \| 4 skipped (35). "probeInlineStyle connects one <style> element with a comment for text and a style attribute (both checks a drawing makes); its remover takes it out once" | `src/frame-runtime/styles.ts` b45774c99d8d restored, equal; build outputs restored, equal |
| L3.D6d | the probe's style element is connected, the style-src-elem check (leave it detached) | `src/frame-runtime/styles.ts`: `      i.appendChild.call(parent, el); ⏎ ` → (removed) | rc 1, 1 failed \| 30 passed \| 4 skipped (35). "probeInlineStyle connects one <style> element with a comment for text and a style attribute (both checks a drawing makes); its remover takes it out once" | `src/frame-runtime/styles.ts` b45774c99d8d restored, equal; build outputs restored, equal |
| L3.D6e | the probe's element stays until the state is decided (take it out right after the probe) | `src/frame-runtime/bootstrap.ts`: `probesInlineStyle(seed.mermaid) ? probeInlineStyle(doc, styles) : null; ⏎ ` → `probesInlineStyle(seed.mermaid) ? probeInlineStyle(doc, styles) : null; ⏎     if (unprobe !== null) unprobe(); ⏎ ` | rc 1, 1 failed \| 30 passed \| 4 skipped (35). "the bootstrap reads the built-ins in Phase S, probes when probesInlineStyle(seed.mermaid) after enhance and before the face probe, and takes the probe out only after the last tick, before the state settles" | `src/frame-runtime/bootstrap.ts` a6f088df0d7b restored, equal; build outputs restored, equal |

```json
[
  {
    "id": "L3.D1a",
    "guard": "on request the second phase loads and draws nothing (ignore the option)",
    "changes": [
      {
        "file": "src/enhance/diagrams.ts",
        "old": "  if (settings.draw === 'on-request') {\n    onRequest(ctx, settings, figs);\n    return;\n  }\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "7 failed | 20 passed (27)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > L3.D1: on request, the second phase loads nothing and draws nothing > a destroy removes the buttons and the state; a tap made after it draws nothing",
      "test/enhance-mermaid-on-request.test.ts > L3.D1: on request, the second phase loads nothing and draws nothing > after enhance() resolves: no load, no SVG, the root reads on-request, one Render button per drawable figure, and the over-long figure has none and shows its note",
      "test/enhance-mermaid-on-request.test.ts > L3.D2: a tap draws that figure only, and loads once > a module that is not Mermaid leaves the tapped figure to its load note; the others keep their buttons",
      "test/enhance-mermaid-on-request.test.ts > L3.D2: a tap draws that figure only, and loads once > a second tap on the same figure draws it once",
      "test/enhance-mermaid-on-request.test.ts > L3.D2: a tap draws that figure only, and loads once > a tap on the second figure loads once and draws it alone; a later tap on the first draws it with no second load",
      "test/enhance-mermaid-on-request.test.ts > L3.D3: draws run one at a time > a failing figure shows its note and source, and does not block the next",
      "test/enhance-mermaid-on-request.test.ts > L3.D3: draws run one at a time > two quick taps: the second draw starts only after the first settles, its button busy meanwhile"
    ],
    "assertions": [
      "AssertionError: expected 1 to be +0 // Object.is equality",
      "AssertionError: the figure's one Render button: expected [] to have a length of 1 but got +0",
      "AssertionError: the figure's one Render button: expected [] to have a length of 1 but got +0",
      "AssertionError: the figure's one Render button: expected [] to have a length of 1 but got +0",
      "AssertionError: the figure's one Render button: expected [] to have a length of 1 but got +0",
      "AssertionError: the figure's one Render button: expected [] to have a length of 1 but got +0",
      "AssertionError: the figure's one Render button: expected [] to have a length of 1 but got +0"
    ],
    "sha256": "2df6eb6e927f4785830897b586ccd07d681ca746c8efe529bdca007dc17d5e56",
    "restored": true
  },
  {
    "id": "L3.D1css",
    "guard": "a drawn figure's source is hidden on request (drop the rule's .drawn selector only)",
    "changes": [
      {
        "file": "assets/reader.css",
        "old": "[data-docreader-root][data-docreader-root][data-docreader-diagrams=\"on-request\"]:not(i) figure.mermaid-figure.drawn > pre.mermaid:not([data-docreader-chrome]),\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 node scripts/build-frame.mjs && DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "1 failed | 3 passed | 4 skipped (8)",
    "failing": [
      "test/browser/mermaid-on-request.test.ts > chromium > on request: no Mermaid request at enhance, readable sources with Render buttons, the over-long figure's note and not its source; a tap, then Enter, each draws its figure alone, with no violation"
    ],
    "assertions": [
      "AssertionError: expected 'block' to be 'none' // Object.is equality"
    ],
    "sha256": "901ccd09d3377419f7db51e97ce336bfacb3a22d89030d72d604d61e7d12bca2",
    "restored": true,
    "outputsRestored": true
  },
  {
    "id": "L3.D1css-f",
    "guard": "a failed figure's source is hidden on request, its note shown (drop the rule's .draw-failed selector)",
    "changes": [
      {
        "file": "assets/reader.css",
        "old": ",\n[data-docreader-root][data-docreader-root][data-docreader-diagrams=\"on-request\"]:not(i) figure.mermaid-figure.draw-failed > pre.mermaid:not([data-docreader-chrome])",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 node scripts/build-frame.mjs && DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "1 failed | 3 passed | 4 skipped (8)",
    "failing": [
      "test/browser/mermaid-on-request.test.ts > chromium > on request: no Mermaid request at enhance, readable sources with Render buttons, the over-long figure's note and not its source; a tap, then Enter, each draws its figure alone, with no violation"
    ],
    "assertions": [
      "AssertionError: expected 'block' to be 'none' // Object.is equality"
    ],
    "sha256": "901ccd09d3377419f7db51e97ce336bfacb3a22d89030d72d604d61e7d12bca2",
    "restored": true,
    "outputsRestored": true
  },
  {
    "id": "L3.D1b",
    "guard": "on request nothing asks for the Mermaid file before a tap, counted at the harness's route (load at enhance)",
    "changes": [
      {
        "file": "src/enhance/diagrams.ts",
        "old": "  const max = settings.maxTextSize ?? MAX_TEXT_SIZE;\n",
        "new": "  void api();\n  const max = settings.maxTextSize ?? MAX_TEXT_SIZE;\n"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 node scripts/build-frame.mjs && DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/browser/mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "1 failed | 3 passed | 4 skipped (8)",
    "failing": [
      "test/browser/mermaid-on-request.test.ts > chromium > on request: no Mermaid request at enhance, readable sources with Render buttons, the over-long figure's note and not its source; a tap, then Enter, each draws its figure alone, with no violation"
    ],
    "assertions": [
      "AssertionError: expected [ 'on-request', false, 1 ] to deeply equal [ 'on-request', false, +0 ]"
    ],
    "sha256": "2df6eb6e927f4785830897b586ccd07d681ca746c8efe529bdca007dc17d5e56",
    "restored": true,
    "outputsRestored": true
  },
  {
    "id": "L3.D2a",
    "guard": "a tap draws that figure only (draw every figure on the first tap)",
    "changes": [
      {
        "file": "src/enhance/diagrams.ts",
        "old": "    else drawn = await draw(ctx, a, config, settings, f);",
        "new": "    else for (const g of figs) drawn = await draw(ctx, a, config, settings, g);"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "4 failed | 23 passed (27)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > L3.D2: a tap draws that figure only, and loads once > a second tap on the same figure draws it once",
      "test/enhance-mermaid-on-request.test.ts > L3.D2: a tap draws that figure only, and loads once > a tap on the second figure loads once and draws it alone; a later tap on the first draws it with no second load",
      "test/enhance-mermaid-on-request.test.ts > L3.D3: draws run one at a time > a failing figure shows its note and source, and does not block the next",
      "test/enhance-mermaid-on-request.test.ts > L3.D3: draws run one at a time > two quick taps: the second draw starts only after the first settles, its button busy meanwhile"
    ],
    "assertions": [
      "AssertionError: expected [ 'run one', 'run two', 'run three' ] to deeply equal [ 'run two' ]",
      "AssertionError: expected [ 'run one', 'run two', 'run three' ] to deeply equal [ 'run one' ]",
      "AssertionError: expected [ 'run one', 'run one' ] to deeply equal [ 'run one', 'run two' ]",
      "AssertionError: expected [ 'run one' ] to deeply equal [ 'run two' ]"
    ],
    "sha256": "2df6eb6e927f4785830897b586ccd07d681ca746c8efe529bdca007dc17d5e56",
    "restored": true
  },
  {
    "id": "L3.D3a",
    "guard": "draws run one at a time through the module's queue (draw concurrently: the tap calls Mermaid outside the queue)",
    "changes": [
      {
        "file": "src/enhance/diagrams.ts",
        "old": "    else drawn = await draw(ctx, a, config, settings, f);",
        "new": "    else drawn = await (async (): Promise<boolean | null> => {\n      const d = await call(ctx, a, config, f);\n      if (!ctx.live() || d === null) return null;\n      const svg = d.parentNode === f.entry.figure ? drawnSvg(d) : null;\n      finish(ctx, f, svg, 'error');\n      return svg !== null;\n    })();"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "2 failed | 25 passed (27)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > L3.D3: draws run one at a time > a failing figure shows its note and source, and does not block the next",
      "test/enhance-mermaid-on-request.test.ts > L3.D3: draws run one at a time > two quick taps: the second draw starts only after the first settles, its button busy meanwhile"
    ],
    "assertions": [
      "AssertionError: expected [ 'run one', 'run two' ] to deeply equal [ 'run one' ]",
      "AssertionError: expected [ 'run two', 'run three' ] to deeply equal [ 'run two' ]"
    ],
    "sha256": "2df6eb6e927f4785830897b586ccd07d681ca746c8efe529bdca007dc17d5e56",
    "restored": true
  },
  {
    "id": "L3.D3b",
    "guard": "a waiting tap's button is busy (drop the aria-busy write)",
    "changes": [
      {
        "file": "src/enhance/diagrams.ts",
        "old": "        ctx.journal.setAttribute(button, 'aria-busy', 'true');\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "1 failed | 26 passed (27)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > L3.D3: draws run one at a time > two quick taps: the second draw starts only after the first settles, its button busy meanwhile"
    ],
    "assertions": [
      "AssertionError: expected null to be 'true' // Object.is equality"
    ],
    "sha256": "2df6eb6e927f4785830897b586ccd07d681ca746c8efe529bdca007dc17d5e56",
    "restored": true
  },
  {
    "id": "L3.D4a",
    "guard": "normalizeOptions refuses any draw but 'auto' and 'on-request' (accept any value)",
    "changes": [
      {
        "file": "src/enhance/options.ts",
        "old": "  const found = MERMAID_DRAW_VALUES.find((d) => d === v);",
        "new": "  const found = v as MermaidDraw;"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "8 failed | 19 passed (27)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > L3.D4: draw absent is 'auto'; only 'auto' and 'on-request' are accepted > a refused draw rejects enhance() and leaves the root untouched",
      "test/enhance-mermaid-on-request.test.ts > L3.D4: draw absent is 'auto'; only 'auto' and 'on-request' are accepted > refuses On-Request as invalid-options",
      "test/enhance-mermaid-on-request.test.ts > L3.D4: draw absent is 'auto'; only 'auto' and 'on-request' are accepted > refuses a number as invalid-options",
      "test/enhance-mermaid-on-request.test.ts > L3.D4: draw absent is 'auto'; only 'auto' and 'on-request' are accepted > refuses an empty string as invalid-options",
      "test/enhance-mermaid-on-request.test.ts > L3.D4: draw absent is 'auto'; only 'auto' and 'on-request' are accepted > refuses an object as invalid-options",
      "test/enhance-mermaid-on-request.test.ts > L3.D4: draw absent is 'auto'; only 'auto' and 'on-request' are accepted > refuses lazy as invalid-options",
      "test/enhance-mermaid-on-request.test.ts > L3.D4: draw absent is 'auto'; only 'auto' and 'on-request' are accepted > refuses null as invalid-options",
      "test/enhance-mermaid-on-request.test.ts > L3.D4: draw absent is 'auto'; only 'auto' and 'on-request' are accepted > refuses true as invalid-options"
    ],
    "assertions": [
      "AssertionError: expected 'accepted' to match /^invalid-options: docreader: mermaid\\…/",
      "AssertionError: promise resolved \"undefined\" instead of rejecting"
    ],
    "sha256": "21624d6b8800e3c486d3abcea109898285c9ad2a760ada3784f552c550ab721b",
    "restored": true
  },
  {
    "id": "L3.D5u-a",
    "guard": "the bootstrap passes the seed's draw to enhance (drop the field from enhanceMermaid)",
    "changes": [
      {
        "file": "src/frame-runtime/adapters.ts",
        "old": "    draw: m.draw,\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "2 failed | 25 passed (27)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > enhanceMermaid passes the seed's caps, secure keys and draw, with a load that answers the registered API",
      "test/enhance-mermaid-on-request.test.ts > the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > what it builds is what L2 accepts: each seed draw reaches the normalized options unchanged"
    ],
    "assertions": [
      "AssertionError: expected { maxTextSize: 16384, …(3) } to deeply equal { maxTextSize: 16384, …(4) }",
      "AssertionError: expected { maxTextSize: 100, …(3) } to deeply equal { maxTextSize: 100, …(3) }"
    ],
    "sha256": "5e812784112af3603ad9919195525e3752a081588cdd0a76b335b81c4b013058",
    "restored": true
  },
  {
    "id": "L3.D5u-b",
    "guard": "ready waits for drawing only in 'auto' mode (wait whenever Mermaid is on)",
    "changes": [
      {
        "file": "src/frame-runtime/adapters.ts",
        "old": "  return m !== null && m.draw === 'auto';",
        "new": "  return m !== null;"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "1 failed | 26 passed (27)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > ready waits for drawing only in 'auto' mode with Mermaid on"
    ],
    "assertions": [
      "AssertionError: expected true to be false // Object.is equality"
    ],
    "sha256": "5e812784112af3603ad9919195525e3752a081588cdd0a76b335b81c4b013058",
    "restored": true
  },
  {
    "id": "L3.D6a",
    "guard": "on request the bootstrap asks for inline style before ready (drop the probe)",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "probesInlineStyle(seed.mermaid) ? probeInlineStyle(doc, styles) : null;",
        "new": "null as (() => void) | null;"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 node scripts/build-frame.mjs && DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts test/browser/mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "2 failed | 29 passed | 4 skipped (35)",
    "failing": [
      "test/browser/mermaid-on-request.test.ts > chromium > frame, on request, under a host page policy that allows inline style only by the frame stylesheet's hash: ready, then error boot, nothing drawn",
      "test/enhance-mermaid-on-request.test.ts > L3.D6: on request, the bootstrap asks for inline style before ready (fix round, review S1; Reference §11.5, ruling R7) > the bootstrap reads the built-ins in Phase S, probes when probesInlineStyle(seed.mermaid) after enhance and before the face probe, and takes the probe out only after the last tick, before the state settles"
    ],
    "assertions": [
      "AssertionError: expected [ { t: 'ready', v: 1, …(1) } ] to deeply equal [ { t: 'ready', v: 1, …(1) }, …(1) ]",
      "AssertionError: /const unprobe = probesInlineStyle\\(seed\\.mermaid\\) \\? probeInlineStyle\\(doc, styles\\) : null;/: expected [] to have a length of 1 but got +0"
    ],
    "sha256": "a6f088df0d7b815c80b183a9d790710c9edcb945884b925869d5f37901039c68",
    "restored": true,
    "outputsRestored": true
  },
  {
    "id": "L3.D6b",
    "guard": "the probe runs with Mermaid on request (probesInlineStyle answers false)",
    "changes": [
      {
        "file": "src/frame-runtime/adapters.ts",
        "old": "  return m !== null && m.draw === 'on-request';\n",
        "new": "  return false;\n"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 node scripts/build-frame.mjs && DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts test/browser/mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "2 failed | 29 passed | 4 skipped (35)",
    "failing": [
      "test/browser/mermaid-on-request.test.ts > chromium > frame, on request, under a host page policy that allows inline style only by the frame stylesheet's hash: ready, then error boot, nothing drawn",
      "test/enhance-mermaid-on-request.test.ts > L3.D6: on request, the bootstrap asks for inline style before ready (fix round, review S1; Reference §11.5, ruling R7) > probesInlineStyle: only with Mermaid on and drawn on request"
    ],
    "assertions": [
      "AssertionError: expected [ { t: 'ready', v: 1, …(1) } ] to deeply equal [ { t: 'ready', v: 1, …(1) }, …(1) ]",
      "AssertionError: expected false to be true // Object.is equality"
    ],
    "sha256": "5e812784112af3603ad9919195525e3752a081588cdd0a76b335b81c4b013058",
    "restored": true,
    "outputsRestored": true
  },
  {
    "id": "L3.D6c",
    "guard": "the probe asks for a style attribute too, the style-src-attr check (drop the attribute)",
    "changes": [
      {
        "file": "src/frame-runtime/styles.ts",
        "old": "      i.setAttribute.call(el, 'style', STYLE_PROBE_ATTR);\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 node scripts/build-frame.mjs && DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts test/browser/mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "1 failed | 30 passed | 4 skipped (35)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > L3.D6: on request, the bootstrap asks for inline style before ready (fix round, review S1; Reference §11.5, ruling R7) > probeInlineStyle connects one <style> element with a comment for text and a style attribute (both checks a drawing makes); its remover takes it out once"
    ],
    "assertions": [
      "AssertionError: expected null to be 'display:none' // Object.is equality"
    ],
    "sha256": "b45774c99d8dda8ada5b1665a65e8000dcfb28ebb2d610991830fcb8d64c97c4",
    "restored": true,
    "outputsRestored": true
  },
  {
    "id": "L3.D6d",
    "guard": "the probe's style element is connected, the style-src-elem check (leave it detached)",
    "changes": [
      {
        "file": "src/frame-runtime/styles.ts",
        "old": "      i.appendChild.call(parent, el);\n",
        "new": ""
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 node scripts/build-frame.mjs && DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts test/browser/mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "1 failed | 30 passed | 4 skipped (35)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > L3.D6: on request, the bootstrap asks for inline style before ready (fix round, review S1; Reference §11.5, ruling R7) > probeInlineStyle connects one <style> element with a comment for text and a style attribute (both checks a drawing makes); its remover takes it out once"
    ],
    "assertions": [
      "AssertionError: expected [] to have a length of 1 but got +0"
    ],
    "sha256": "b45774c99d8dda8ada5b1665a65e8000dcfb28ebb2d610991830fcb8d64c97c4",
    "restored": true,
    "outputsRestored": true
  },
  {
    "id": "L3.D6e",
    "guard": "the probe's element stays until the state is decided (take it out right after the probe)",
    "changes": [
      {
        "file": "src/frame-runtime/bootstrap.ts",
        "old": "probesInlineStyle(seed.mermaid) ? probeInlineStyle(doc, styles) : null;\n",
        "new": "probesInlineStyle(seed.mermaid) ? probeInlineStyle(doc, styles) : null;\n    if (unprobe !== null) unprobe();\n"
      }
    ],
    "command": "ulimit -u <threads+1500>; timeout -k 10 600 node scripts/build-frame.mjs && DOCREADER_BROWSERS=chromium timeout -k 10 600 ./node_modules/.bin/vitest run test/enhance-mermaid-on-request.test.ts test/browser/mermaid-on-request.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "red": "1 failed | 30 passed | 4 skipped (35)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > L3.D6: on request, the bootstrap asks for inline style before ready (fix round, review S1; Reference §11.5, ruling R7) > the bootstrap reads the built-ins in Phase S, probes when probesInlineStyle(seed.mermaid) after enhance and before the face probe, and takes the probe out only after the last tick, before the state settles"
    ],
    "assertions": [
      "AssertionError: /if \\(unprobe !== null\\) unprobe\\(\\);/: expected [ …(2) ] to have a length of 1 but got 2"
    ],
    "sha256": "a6f088df0d7b815c80b183a9d790710c9edcb945884b925869d5f37901039c68",
    "restored": true,
    "outputsRestored": true
  }
]
```
