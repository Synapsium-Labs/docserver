# L2 Task 23: mutation rows (diagram tools)

These rows name finite guards in `src/enhance/diagram-tools.ts`: definition cues, playback, copy liveness, clone identity, viewer input, and pointer thresholds. A row is PENDING UNRUN unless its measured receipt below says otherwise; targeted regression tests alone are not mutation results.

| Row | Guard | File | Test | Status |
|---|---|---|---|---|
| L2-T23-M1 | label boundaries preserve terms split across SVG text nodes | `src/enhance/diagram-tools.ts` | `test/enhance-diagram-tools.test.ts` `marks terms, IDs, edge labels, and cluster labels with accessible definition controls` | ASSERTION RED |
| L2-T23-M2 | terms sort longest-first before IDs are considered | `src/enhance/diagram-tools.ts` | `test/enhance-diagram-tools.test.ts` `marks terms, IDs, edge labels, and cluster labels with accessible definition controls` | ASSERTION RED |
| L2-T23-M3 | IDs use `ctx.vocab.idScan()` and its qualifier window | `src/enhance/diagram-tools.ts` | `test/enhance-diagram-tools.test.ts` `uses configured nondefault IDs, rejects qualifiers, and leaves IDs disabled` | ASSERTION RED |
| L2-T23-M4 | a definition block has dialog keyboard semantics | `src/enhance/diagram-tools.ts` | `test/enhance-diagram-tools.test.ts` `marks terms, IDs, edge labels, and cluster labels with accessible definition controls` | ASSERTION RED |
| L2-T23-M5 | all cue geometry reads complete before cue writes | `src/enhance/diagram-tools.ts` | `test/enhance-diagram-tools.test.ts` `reads the exact definition candidate set before the first cue insertion` | ASSERTION RED |
| L2-T23-M5a | cue writes re-check ownership before inserting chrome | `src/enhance/diagram-tools.ts` | `test/enhance-diagram-tools.test.ts` `skips a moved measured candidate while painting a later valid candidate` | ASSERTION RED |
| L2-T23-M6 | cue chrome is independently journalled and removed after a move | `src/enhance/diagram-tools.ts` | `test/enhance-diagram-tools.test.ts` `removes definition chrome from a moved node during teardown` | ASSERTION RED |
| L2-T23-M7 | generated Mermaid node, edge-label, and cluster-label shapes remain discoverable | `src/enhance/diagram-tools.ts` | `test/browser/diagram-tools.test.ts` internal structures | ASSERTION RED |
| L2-T23-M8 | graph order begins at zero-incoming nodes before cyclic remainder | `src/enhance/diagram-tools.ts` | `test/enhance-diagram-tools.test.ts` `normalizes prefixed fallback edge IDs before graph ordering` | ASSERTION RED |
| L2-T23-M9 | Copy Mermaid ignores a settled reply after destroy or detached-button loss | `src/enhance/diagram-tools.ts` | `test/enhance-diagram-tools.test.ts` both Copy Mermaid late-settlement tests | ASSERTION RED |
| L2-T23-M10 | replay and fullscreen cancel live playback reset and frame handles | `src/enhance/diagram-tools.ts` | `test/enhance-diagram-tools.test.ts` `cancels allocated edge reset and frame handles on replay and fullscreen` | ASSERTION RED |
| L2-T23-M11 | fullscreen clones receive remapped ids and references without changing source | `src/enhance/diagram-tools.ts` | `test/enhance-diagram-tools.test.ts` `gives an overlay clone root-issued IDs without changing its drawing source` | ASSERTION RED |
| L2-T23-M12 | Escape on a fullscreen definition node closes its card before its viewer | `src/enhance/diagram-tools.ts` | `test/enhance-diagram-tools.test.ts` `routes Escape from a fullscreen definition node to its card before the viewer` | ASSERTION RED |
| L2-T23-M13 | plain-wheel pan applies the input delta to the clone transform | `src/enhance/diagram-tools.ts` | `test/browser/diagram-tools.test.ts` `fits, zooms, wheels, and drags the fullscreen figure through browser input` | ASSERTION RED |
| L2-T23-M14a | definition-card synthetic pointer-up travel is strictly less than 8px | `src/enhance/diagram-tools.ts` | `test/browser/diagram-viewer.test.ts` `accepts a 7.9px synthetic pointer-up endpoint and rejects 8px without a move` | ASSERTION RED |
| L2-T23-M14b | definition-card synthetic pointer-up duration is strictly less than 600ms | `src/enhance/diagram-tools.ts` | `test/browser/diagram-viewer.test.ts` `uses the production Date.now clock to reject 600ms and accept 599ms synthetic taps` | ASSERTION RED |
| L2-T23-M15 | cue dot fill is journalled with important priority over Mermaid classDef paint | `src/enhance/diagram-tools.ts` | `test/browser/diagram-tools.test.ts` `centers a painted definition cue inside a transformed Mermaid diamond` | ASSERTION RED |

## Finite pending substitutions

Each row is an exact, one-occurrence source replacement for a later in-place mutation check. `PENDING UNRUN` records the intended discriminator only; no regression or browser green result is a mutation result. Run the listed test command only after an unmutated control from the same bytes, restore the file after every row, and refuse an anchor count other than one.

| Row | Exact `FROM` | Exact `TO` | Targeted command |
|---|---|---|---|
| L2-T23-M1 | `const breaks = ['br', 'p', 'div', 'tspan', 'text'].includes(el.localName);\n    if (breaks && text !== '' && !/\s$/.test(text)) text += ' ';\n    for (const child of Array.from(el.childNodes)) walk(child);\n    if (breaks && text !== '' && !/\s$/.test(text)) text += ' ';` | `const breaks = ['br', 'p', 'div', 'tspan', 'text'].includes(el.localName);\n    if (false) text += ' ';\n    for (const child of Array.from(el.childNodes)) walk(child);\n    if (false) text += ' ';` | `./node_modules/.bin/vitest run test/enhance-diagram-tools.test.ts --maxWorkers=1 --fileParallelism=false` |
| L2-T23-M2 | `const terms = [...ctx.terms.all()].sort((a, b) => b.name.length - a.name.length);` | `const terms = [...ctx.terms.all()];` | `./node_modules/.bin/vitest run test/enhance-diagram-tools.test.ts --maxWorkers=1 --fileParallelism=false` |
| L2-T23-M3 | `const scan = ctx.vocab.idScan();` | `const scan = /$^/gu;` | `./node_modules/.bin/vitest run test/enhance-diagram-tools.test.ts --maxWorkers=1 --fileParallelism=false` |
| L2-T23-M4 | `ctx.journal.setAttribute(group, 'aria-haspopup', 'dialog');` | `ctx.journal.setAttribute(group, 'aria-haspopup', 'menu');` | `./node_modules/.bin/vitest run test/enhance-diagram-tools.test.ts --maxWorkers=1 --fileParallelism=false` |
| L2-T23-M5 | Contextual algorithm: after `const measured ... = [];`, define `paintMeasured` around the original tail write loop; remove that tail invocation; call `paintMeasured()` immediately after every `measured.push(...)`, preserving both read loops and the original write body. | Interleave each candidate's write after its read rather than after all reads. | `./node_modules/.bin/vitest run test/enhance-diagram-tools.test.ts --maxWorkers=1 --fileParallelism=false` |
| L2-T23-M5a | `for (const { svg, group, box, whole, corner } of measured) {\n      if (!owned(svg, group) || group.querySelector(':scope > .dn-ring') !== null) continue;` | `for (const { svg, group, box, whole, corner } of measured) {\n      if (group.querySelector(':scope > .dn-ring') !== null) continue;` | `./node_modules/.bin/vitest run test/enhance-diagram-tools.test.ts --maxWorkers=1 --fileParallelism=false` |
| L2-T23-M6 | `ctx.journal.insert(ring, group, null);` | `group.append(ring);` | `./node_modules/.bin/vitest run test/enhance-diagram-tools.test.ts --maxWorkers=1 --fileParallelism=false` |
| L2-T23-M7 | `svg.querySelectorAll<SVGGElement>('g.edgeLabel, g.cluster-label')` | `svg.querySelectorAll<SVGGElement>('g.edgeLabel')` | `DOCREADER_BROWSERS=chromium ./node_modules/.bin/vitest run test/browser/diagram-tools.test.ts --maxWorkers=1 --fileParallelism=false` |
| L2-T23-M8 | `const raw = path.getAttribute('data-id') ?? path.id.replace(/^.*?-(L_)/, '$1');` | `const raw = path.getAttribute('data-id') ?? path.id;` | `./node_modules/.bin/vitest run test/enhance-diagram-tools.test.ts --maxWorkers=1 --fileParallelism=false` |
| L2-T23-M9 | `if (!ctx.live() || !ctx.root.contains(copy)) return;` | `if (false) return;` | `./node_modules/.bin/vitest run test/enhance-diagram-tools.test.ts --maxWorkers=1 --fileParallelism=false` |
| L2-T23-M10 | `for (const cancel of playback.cancels) cancel();` | `for (const cancel of playback.cancels) void cancel;` | `./node_modules/.bin/vitest run test/enhance-diagram-tools.test.ts --maxWorkers=1 --fileParallelism=false` |
| L2-T23-M11 | `const clone = ctx.journal.cloneSvg(svg, mapped);` | `const clone = svg.cloneNode(true) as SVGSVGElement;` | `./node_modules/.bin/vitest run test/enhance-diagram-tools.test.ts --maxWorkers=1 --fileParallelism=false` (clone id/reference remapping only; source-preservation remains a separate behavior) |
| L2-T23-M12 | `if (e.key === 'Escape') {` | `if (false) {` | `./node_modules/.bin/vitest run test/enhance-diagram-tools.test.ts --maxWorkers=1 --fileParallelism=false` |
| L2-T23-M13 | `x -= e.deltaX * unit;` | `x += e.deltaX * unit;` | `DOCREADER_BROWSERS=chromium ./node_modules/.bin/vitest run test/browser/diagram-tools.test.ts --maxWorkers=1 --fileParallelism=false` |
| L2-T23-M14a | `Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 8` | `Math.hypot(e.clientX - tap.x, e.clientY - tap.y) <= 8` | `DOCREADER_BROWSERS=chromium ./node_modules/.bin/vitest run test/browser/diagram-viewer.test.ts --maxWorkers=1 --fileParallelism=false` (`7.9/8px` and multipointer controls) |
| L2-T23-M14b | `ctx.env.now() - tap.at < 600` | `ctx.env.now() - tap.at <= 600` | `DOCREADER_BROWSERS=chromium ./node_modules/.bin/vitest run test/browser/diagram-viewer.test.ts --maxWorkers=1 --fileParallelism=false` (`599/600ms` controls) |
| L2-T23-M15 | `ctx.journal.setStyle(dot, 'fill', '#0b6b66', true);` | `ctx.journal.setStyle(dot, 'fill', '#0b6b66', false);` | `DOCREADER_BROWSERS=chromium ./node_modules/.bin/vitest run test/browser/diagram-tools.test.ts --maxWorkers=1 --fileParallelism=false` |

All 17 named rows have a qualified assertion-red receipt below. M5 is ordering-only; M5a is its separately measured owned-write check. M12 covers card-first Escape, not all Tab or destroy guarantees. M14a and M14b cover synthetic pointer-up thresholds, not all native gesture behavior.

## Finite guard receipts (2026-10-25)

The original seven targeted rows ran sequentially against a green 43-test unit control. Strengthened M5a, M9, M10 and M12 ran against `task24-guard-playback-isolated-control-20261025.log` (47 tests); M5 and M7 used `task24-order-and-shapes-control`; M13, M14a, M14b and M15 used `task24-browser-guard-control`. All reversals restored source SHA `c685eceb`; the M5 mutated input SHA was `8b0f8c64ab190ca941f8d86936af59d5cce43655c4b0130685e934950eb04f19`. Each listed reversal produced an assertion failure. These receipts cover only the named source/test conditions, not built-file, whole-branch, WebKit, or model gates.

| Row | Result | Intended assertion | Receipt |
|---|---|---|---|
| L2-T23-M1 | ASSERTION RED | `marks terms, IDs, edge labels, and cluster labels with accessible definition controls`: removing both fragment-boundary separators loses the `Longform` node definition. | `task24-guard-M1-targeted-20261025.log` |
| L2-T23-M2 | ASSERTION RED | `marks terms, IDs, edge labels, and cluster labels with accessible definition controls`: unsorted terms select `form` instead of `long form`. | `task24-guard-M2-targeted-20261025.log` |
| L2-T23-M3 | ASSERTION RED | `uses configured nondefault IDs, rejects qualifiers, and leaves IDs disabled`: empty ID scan leaves `REQ-777` undefined. The earlier output-truncated attempt is superseded by this complete receipt. | `task24-guard-M3-targeted-20261025.log` |
| L2-T23-M4 | ASSERTION RED | `marks terms, IDs, edge labels, and cluster labels with accessible definition controls`: `aria-haspopup` becomes `menu`, not `dialog`. | `task24-guard-M4-targeted-20261025.log` |
| L2-T23-M6 | ASSERTION RED | `removes definition chrome from a moved node during teardown`: an unjournalled ring remains after destroy. | `task24-guard-M6-targeted-20261025.log` |
| L2-T23-M8 | ASSERTION RED | `normalizes prefixed fallback edge IDs before graph ordering`: the source node remains hidden. | `task24-guard-M8-targeted-20261025.log` |
| L2-T23-M11 | ASSERTION RED | `gives an overlay clone root-issued IDs without changing its drawing source`: clone and source retain the same ID. | `task24-guard-M11-targeted-20261025.log` |
| L2-T23-M5a | ASSERTION RED | `skips a moved measured candidate while painting a later valid candidate`: removing the owned write check paints moved A. Earlier survivor green was a weaker same-candidate move. | `task24-guard-M5a-strengthened-20261025.log` |
| L2-T23-M9 | ASSERTION RED | Both Copy Mermaid late replies: removing the live/root containment guard changes the destroyed or detached button after the full promise chain settles. Earlier survivor green awaited too little. | `task24-guard-M9-strengthened-20261025.log` |
| L2-T23-M10 | ASSERTION RED | `cancels allocated edge reset and frame handles on replay and fullscreen`: no-op playback cancellation leaves identified live reset/frame handles pending. Earlier survivor green mixed startup handles. | `task24-guard-M10-strengthened-20261025.log` |
| L2-T23-M12 | ASSERTION RED | `routes Escape from a fullscreen definition node to its card before the viewer`: disabling the viewer Escape branch closes the viewer on the first press instead of closing only its card. Earlier survivor green did not target that route. | `task24-guard-M12-strengthened-20261025.log` |
| L2-T23-M5 | ASSERTION RED | `reads the exact definition candidate set before the first cue insertion`: interleaving writes after each `measured.push` captures one read instead of all four. The earlier asynchronous interceptor throw is retained as limited history, not this receipt. | `task24-guard-M5-assertion-20261025.log` |
| L2-T23-M7 | ASSERTION RED | Real generated cluster cue discovery: removing cluster labels leaves its `data-ref` undefined instead of `R1`. The earlier readiness timeout is retained as limited history, not this receipt. | `task24-guard-M7-assertion-20261025.log` |
| L2-T23-M13 | ASSERTION RED | Reversed plain-wheel pan makes the live clone translation increase rather than decrease by the input delta. The later receipt waits for Ctrl-wheel processing before capturing the plain-pan baseline. | `task24-guard-M13-browser-20261025.log`; final `task24-final-guard-M13-settled-20261025.log` |
| L2-T23-M14a | ASSERTION RED | Replacing `< 8` with `<= 8` opens a card at the synthetic 8px pointer-up endpoint. | `task24-guard-M14a-browser-20261025.log` |
| L2-T23-M14b | ASSERTION RED | Replacing `< 600` with `<= 600` opens a card at the synthetic 600ms pointer-up endpoint. | `task24-guard-M14b-browser-20261025.log` |
| L2-T23-M15 | ASSERTION RED | Removing important priority leaves the definition dot fill priority absent. | `task24-guard-M15-browser-20261025.log` |

## Current built-Mermaid integration control (2026-10-26)

At `38f2ae87c430c65e3412d2f8668fb0cbbbea8869`, a fresh control, exact M7 reversal and restored control run in three separate Vitest processes. The command selects `discovers Mermaid internal` from `test/browser/diagram-tools.test.ts`, with `--project layout --maxWorkers=1 --fileParallelism=false` and `DOCREADER_BROWSERS=chromium`. Both controls pass one assertion case; the complete reversal fails at the generated cluster-label expectation, where text `R1` remains but its `ref` is undefined instead of `R1`. Receipts: `task24-built-M7-control-20261026.log`, `task24-built-M7-reversal-20261026.log`, `task24-built-M7-restored-20261026.log`.

The harness calls `buildMermaid()` in memory, routes its exact returned module bytes to the page and imports that module in its bootstrap. The test therefore consumes real generated Mermaid output, not only a hand-authored SVG. This is the same built-Mermaid integration interpretation recorded in Task 21's notes. It closes this current integration-row qualification only: the enhancement bundle is separately built from source, and packed/released enhancement output, all other rows, both browsers and the requested-model gate are not proved by it. The earlier exclusions remain correct for their historical receipts.

Frozen inputs (SHA-256):

| Input | SHA-256 |
|---|---|
| `src/enhance/diagram-tools.ts` | `2292561d71cfc88d19b31e49626f659c6cfc5bb5ec96c22260fd736ac5fe0d3b` |
| `scripts/build-mermaid.mjs` | `770d11b0ab2622d8f9e6cdb0f9324fa95767152f832012d0d720d09329b72011` |
| `scripts/mermaid-elk-stub.mjs` | `31acb415b48e14d8cb80ec8d14f79b4bac8f541b549db16537917bd5c5c8d50c` |
| `package-lock.json` | `e3fa9d2d0abba64fa53fb0171b9ab40fc0778bbfd8e078ed5e4e45270bcb1f02` |
| `test/browser/harness.ts` | `00b3297fb3aa9c29e1c6443493c7194fb9dbc4344a66ab04787e2aed72ede834` |
| `test/browser/page/bootstrap.ts` | `904ca1da973004471ba5b638f596318c2c3dec58d0782ed3d9af4d333b4e826b` |
| `test/browser/diagram-tools.test.ts` | `899564abb17442f9816ac8198ee5dcb09baec41d71fc101a049f38eea8562cd8` |

Source bytes restore exactly before the final control. No repository copy, install, disk build or new browser harness is used.

Earlier M1 pre-child-boundary-only and M2 prior-fixture greens remain historical limitations; the complete two-boundary M1 witness and reordered-term M2 fixture supersede them for the listed exact reversals, not by deletion. Earlier M5a, M9, M10 and M12 survivor greens remain historical weaker probes, not redundancy rulings. The earlier M5 asynchronous interceptor and M7 readiness timeout remain limited historical receipts; the test-body M5 and completed-shape M7 assertion receipts above supersede them.
