# Parity Task 6: mutation rows (print figures in the frame, the host parser's walls, the lost jump push)

Each row was measured in place on this wave's branch: the bytes of the file saved with their sha256, one edit applied, the tests named in the row run through the fleet test wrapper as `./node_modules/.bin/vitest run --reporter=json` (with `--maxWorkers=1` or `2`), then the file restored from the saved bytes (`cp`) and its sha256 compared (each matched). The sha256 of each file as restored: `src/enhance/diagrams.ts` `762f61950974ed0caf14dbb3e4d092ac274371ffc82963223ca503eeb29b66bd`; `src/enhance/env.ts` `618a82d7c5001e669069a5e61e9b18ee9a4f8215485ef82d4d6dc10adc42d413`; `src/enhance/print-figures.ts` `2914ed43ad874b1875789a04a464edd287fe3e0295b0f49b4817bb2b2b0e3f92`; `src/frame-runtime/adapters.ts` `419cfaf44812f3bbf1a5328844b3553cb1b01ad7898e7ffdcbe6a95c642e178b`; `src/frame-runtime/outbox.ts` `664c9fb404e5555aebb8497648d534798388a1d5d6e4b333f5aa23cbcb746177`; `src/host/mount.ts` `bc5762efa4a53a5446f7833078f19eff49d1d26e171d85a9efbd459b362ed79d`; `src/host/parse.ts` `b70e659255da7493daf660c6bcafa60d36b98869681cdc07727c2a36d9b9b6b8`. Every row exited 1 except two that stay green, each with its reason: P6l, an equivalent mutant, and B6b, a mutant Chromium cannot kill (its red cases are named in its row). Rows J6a to J6e are the lost jump push (commit 1c52e5f); H6a to H6h are the host parser's own walls, each judged with no reader in front of it; R6a to R6g and P6a to P6n are the reader's; F6a to F6h are the frame adapter's and O6a to O6e the outbox's; B6a and B6b run in Chromium; I1 and R6h to R6k are review round 1 (the run's end, and the reader's 16 MiB total). The brief's P6a to P6f are P6a (HTML labels), P6b (side cap), P6c (a skipped figure sent empty), P6d (no cancel), O6a (sends bypass the pacer) and F6a (sent without the flag). Notes on method: the rows of `src/host/parse.ts` run `test/host-parse.test.ts` and `test/host-mount.test.ts` (412 tests); the frame-side rows (F, O) run `test/enhance-frame-wire.test.ts`, `test/frame-outbox.test.ts` and `test/host-print-run.test.ts`, whose host reads the frame's assets from the files the build wrote, so a mutation of the frame's source changes what the frame side does and nothing else (the first measurement of F6a and F6b through `test/host-mount.test.ts` broke the build of the frame under test and was discarded); the two Chromium rows rebuilt the frame (`npm run build:frame`) after the edit, because the page's policy pins the enhance script's hash, and rebuilt it again after the restore (the generated files were byte-equal to their saved copies). Rows P6d2 and P6d3 first stayed green and got a new case (a runner whose instance stops being live; a call still queued behind another when the run is cancelled); they were measured again, and the later rows ran on that file (34 tests), the earlier rows on 33.

| Row | Guard | Edit | File | Result |
|---|---|---|---|---|
| J6a | a jump push survives a following move | trail keeps only the latest hash op, as before | `src/frame-runtime/outbox.ts` | red: 3 failed \| 23 passed (26). the outbox after ready: the pacer a push followed within the window by a move that is not a push still posts one hash with push, and the place the reader left (docserver parity T6) ; the outbox after ready: the pacer two pushes in one window post one hash: the latest id, the first from ; the outbox after ready: the pacer a first push with no from stays a push with none, a later push's from is not borrowed; moves alone stay moves |
| J6b | the from of a merged push is the first push's | the merged hash takes the latest op's from | `src/frame-runtime/outbox.ts` | red: 3 failed \| 23 passed (26). the outbox after ready: the pacer a push followed within the window by a move that is not a push still posts one hash with push, and the place the reader left (docserver parity T6) ; the outbox after ready: the pacer two pushes in one window post one hash: the latest id, the first from ; the outbox after ready: the pacer a first push with no from stays a push with none, a later push's from is not borrowed; moves alone stay moves |
| J6c | the merged hash goes to the latest id | the merged hash keeps the first op's id | `src/frame-runtime/outbox.ts` | red: 3 failed \| 23 passed (26). the outbox after ready: the pacer a push followed within the window by a move that is not a push still posts one hash with push, and the place the reader left (docserver parity T6) ; the outbox after ready: the pacer two pushes in one window post one hash: the latest id, the first from ; the outbox after ready: the pacer a first push with no from stays a push with none, a later push's from is not borrowed; moves alone stay moves |
| J6d | the first push's from survives a second push | a push arriving over a held push replaces it whole | `src/frame-runtime/outbox.ts` | red: 2 failed \| 24 passed (26). the outbox after ready: the pacer two pushes in one window post one hash: the latest id, the first from ; the outbox after ready: the pacer a first push with no from stays a push with none, a later push's from is not borrowed; moves alone stay moves |
| J6e | a move after a move stays a move | any held hash makes the merged one a push | `src/frame-runtime/outbox.ts` | red: 2 failed \| 24 passed (26). the outbox after ready: the pacer hash coalesces over 100 ms: the latest id once the window ends ; the outbox after ready: the pacer a first push with no from stays a push with none, a later push's from is not borrowed; moves alone stay moves |
| H6a | the parser refuses an i at or above n | the i < n test is dropped (n at most 64 stays) | `src/host/parse.ts` | red: 9 failed \| 403 passed (412). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run an index seen in the run, an n that changes and an index at or above n are refused and never handed on ; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 64 figures are handed on and a 65th is refused (n of 65, and a figure past the end of a run of 64), under the buckets: 16 a second, none refused by the rate ; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) an i equal to or above n ; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure n of 0 ; and 5 more |
| H6b | the parser refuses an n above 64 | the n <= 64 test is dropped (i < n stays) | `src/host/parse.ts` | red: 5 failed \| 407 passed (412). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 64 figures are handed on and a 65th is refused (n of 65, and a figure past the end of a run of 64), under the buckets: 16 a second, none refused by the rate ; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) an n above 64, whatever the run holds ; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) sixteen forged figures in a row close the frame, and none of them reached the host ; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure n of 65 ; and 1 more |
| H6c | the parser refuses a PNG over 1 MiB | the decoded-size cap of one figure is dropped | `src/host/parse.ts` | red: 5 failed \| 407 passed (412). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 1048575 and 1048576 decoded bytes are handed on, 1048577 is refused and never handed on ; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) a PNG over 1 MiB, however its text is long ; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure of 1048577 decoded bytes ; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the order of the checks: the index before the text, the text before its size, the size before the total ; and 1 more |
| H6c2 | the parser reads no text longer than a 1 MiB PNG can be | the longest-text cap before the scan is dropped | `src/host/parse.ts` | red: 2 failed \| 410 passed (412). L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure png of 1398105 characters that is not base64 ; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded a text longer than the longest a 1 MiB figure can have is oversize before its alphabet is read; up to that length it is read |
| H6d | the parser refuses a text that is not a PNG | the signature test is dropped | `src/host/parse.ts` | red: 7 failed \| 405 passed (412). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) a text that is not a PNG: base64 of anything else, a cut signature, an empty text, a number ; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure png that is base64 but not a PNG ; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure png with the signature cut short ; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure png of a JPEG's first bytes ; and 3 more |
| H6d2 | the parser takes the whole signature | the signature prefix is cut by one character | `src/host/parse.ts` | red: 3 failed \| 409 passed (412). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) a text that is not a PNG: base64 of anything else, a cut signature, an empty text, a number ; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure png with the signature cut short ; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the text must start as a PNG's does (the base64 of its eight signature bytes), judged from the text and never decoded: any other start is 'type' |
| H6e | the parser refuses a repeated i | the seen-index test is dropped | `src/host/parse.ts` | red: 5 failed \| 407 passed (412). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run an index seen in the run, an n that changes and an index at or above n are refused and never handed on ; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) an i already seen in the run ; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure i already seen ; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded an index seen in the run is refused, however many figures follow ; and 1 more |
| H6f | the parser refuses a figure that takes the run over its total | the run total test is dropped | `src/host/parse.ts` | red: 6 failed \| 406 passed (412). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run sixteen figures of 1048576 bytes pass; one more byte is refused by the total while within its own cap, and is not handed on ; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a refused figure takes none of the total: a refused big figure leaves room for the next ; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) a figure that takes the run over its total, while within its own cap ; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure that takes a run one byte over 16777216 decoded bytes ; and 2 more |
| H6g | the parser refuses an i or n that is not an integer | the canonical-decimal grammar admits a fraction | `src/host/parse.ts` | red: 6 failed \| 406 passed (412). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) an i or an n that is not an integer, or no canonical decimal: a point, a fraction, an exponent, a sign, a number ; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure i with a point ; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure i not an integer ; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure n not an integer ; and 2 more |
| H6h | the parser refuses an n other than the run's | the run's n test is dropped | `src/host/parse.ts` | red: 4 failed \| 408 passed (412). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run an index seen in the run, an n that changes and an index at or above n are refused and never handed on ; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) a n that is not the run's ; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure n different from its run ; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded n must equal the run's once the run has one, and a run with no figure yet takes any n |
| R6a | the reader hands over only an i below n | figurePlace drops i < n | `src/enhance/print-figures.ts` | red: 1 failed \| 32 passed (33). PNG text: size and signature figurePlace takes integers with 0 <= i < n <= 64 |
| R6b | the reader hands over only an n of at most 64 | figurePlace drops n <= 64 | `src/enhance/print-figures.ts` | red: 1 failed \| 32 passed (33). PNG text: size and signature figurePlace takes integers with 0 <= i < n <= 64 |
| R6c | the reader hands over only integers i and n | figurePlace drops the integer tests | `src/enhance/print-figures.ts` | red: 1 failed \| 32 passed (33). PNG text: size and signature figurePlace takes integers with 0 <= i < n <= 64 |
| R6d | the reader hands over only an i from 0 | figurePlace drops i >= 0 | `src/enhance/print-figures.ts` | red: 1 failed \| 32 passed (33). PNG text: size and signature figurePlace takes integers with 0 <= i < n <= 64 |
| R6e | a run is cut to 64 figures | the runner takes the whole list | `src/enhance/print-figures.ts` | red: 1 failed \| 32 passed (33). the runner on its own cuts a list of more than 64 figures to 64: n is 64 and no 65th is drawn |
| R6f | the reader hands over a PNG of at most 1 MiB | isPrintPng drops the size cap | `src/enhance/print-figures.ts` | red: 3 failed \| 30 passed (33). PNG text: size and signature isPrintPng takes the signature and at most 1 MiB ; the print-figures command through the reader skips a figure whose image fails to load, whose canvas is tainted, or whose PNG is over 1 MiB, and one that is no PNG ; the runner on its own hands over no figure whose PNG is no PNG or too large, and skips an undefined entry |
| R6g | the reader hands over only a PNG | isPrintPng drops the signature test | `src/enhance/print-figures.ts` | red: 3 failed \| 30 passed (33). PNG text: size and signature isPrintPng takes the signature and at most 1 MiB ; the print-figures command through the reader skips a figure whose image fails to load, whose canvas is tainted, or whose PNG is over 1 MiB, and one that is no PNG ; the runner on its own hands over no figure whose PNG is no PNG or too large, and skips an undefined entry |
| P6a | HTML labels are off in a print drawing | the top-level htmlLabels: false is dropped | `src/enhance/print-figures.ts` | red: 2 failed \| 31 passed (33). printConfigOf: the screen's configuration, made print's turns HTML labels off at the top and in the flowchart, puts the one usable font on, and makes htmlLabels secure ; the print-figures command through the reader draws for print apart from the screen: HTML labels off, the one font, htmlLabels secure, in the offscreen stage |
| P6a2 | HTML labels are off in the flowchart too | flowchart.htmlLabels: false is dropped | `src/enhance/print-figures.ts` | red: 2 failed \| 31 passed (33). printConfigOf: the screen's configuration, made print's turns HTML labels off at the top and in the flowchart, puts the one usable font on, and makes htmlLabels secure ; the print-figures command through the reader draws for print apart from the screen: HTML labels off, the one font, htmlLabels secure, in the offscreen stage |
| P6a3 | a diagram's own directive cannot turn HTML labels back on | htmlLabels is not added to the secure keys | `src/enhance/print-figures.ts` | red: 2 failed \| 31 passed (33). printConfigOf: the screen's configuration, made print's turns HTML labels off at the top and in the flowchart, puts the one usable font on, and makes htmlLabels secure ; the print-figures command through the reader draws for print apart from the screen: HTML labels off, the one font, htmlLabels secure, in the offscreen stage |
| P6a4 | a print drawing uses the one font an image can use | the screen's font family is kept | `src/enhance/print-figures.ts` | red: 2 failed \| 31 passed (33). printConfigOf: the screen's configuration, made print's turns HTML labels off at the top and in the flowchart, puts the one usable font on, and makes htmlLabels secure ; the print-figures command through the reader draws for print apart from the screen: HTML labels off, the one font, htmlLabels secure, in the offscreen stage |
| P6b | a figure's PNG is at most 2048 px a side | the scale is not shrunk to fit and the side clamp is dropped | `src/enhance/print-figures.ts` | red: 2 failed \| 31 passed (33). printSize: print scale 2, shrunk to fit 2048 px a side doubles an ordinary drawing, keeps its proportions and never passes SIDE_MAX ; the print-figures command through the reader rasterises each drawing at print scale: an absolute-size SVG as a data URL, on a canvas of its size |
| P6b2 | a shrunk figure keeps its proportions | the scale is not shrunk to fit (the clamp alone cuts a side) | `src/enhance/print-figures.ts` | red: 2 failed \| 31 passed (33). printSize: print scale 2, shrunk to fit 2048 px a side doubles an ordinary drawing, keeps its proportions and never passes SIDE_MAX ; the print-figures command through the reader rasterises each drawing at print scale: an absolute-size SVG as a data URL, on a canvas of its size |
| P6c | a figure that does not draw is never sent | a figure with no usable drawing is handed over with an empty text | `src/enhance/print-figures.ts` | red: 3 failed \| 30 passed (33). the print-figures command through the reader skips a figure that does not draw: its i is never handed over, and the figures after it go on ; the runner on its own a draw that throws, or a rasterize that throws or answers null, skips that figure only ; the runner on its own skips a drawing whose SVG has no size, and Mermaid's error drawing |
| P6c2 | a figure whose picture is null is skipped, and the run goes on | a null picture is handed to the PNG test | `src/enhance/print-figures.ts` | red: 3 failed \| 30 passed (33). the print-figures command through the reader skips a figure whose image fails to load, whose canvas is tainted, or whose PNG is over 1 MiB, and one that is no PNG ; the print-figures command through the reader skips a figure whose canvas answers no PNG data URL (a canvas of no size answers data:,) ; the runner on its own a draw that throws, or a rasterize that throws or answers null, skips that figure only |
| P6d | a second command cancels the first run | a run is stale only when the instance is not live | `src/enhance/print-figures.ts` | red: 3 failed \| 30 passed (33). the print-figures command through the reader a second print-figures cancels the first run: its remaining figures are neither drawn nor handed over ; the print-figures command through the reader a figure of the cancelled run still queued behind another call is never drawn: Mermaid is asked for nothing on its behalf ; the print-figures command through the reader a second command cancels a run waiting on the host: the figure after the one handed over is never drawn for it |
| P6d2 | a run stops once the instance is not live | a run is stale only when a newer run began | `src/enhance/print-figures.ts` | red: 1 failed \| 33 passed (34). the runner on its own stops at once when the instance is not live: nothing more is drawn, rasterised or handed over |
| P6d3 | a cancelled run asks Mermaid for nothing more | a call still queued behind another is made although its run is cancelled | `src/enhance/diagrams.ts` | red: 1 failed \| 33 passed (34). the print-figures command through the reader a figure of the cancelled run still queued behind another call is never drawn: Mermaid is asked for nothing on its behalf |
| P6g | without the host's onPrintFigure the command does nothing | the command is registered whether or not the host gave the callback | `src/enhance/diagrams.ts` | red: 1 failed \| 33 passed (34). the print-figures command through the reader answers false and does nothing without onPrintFigure: no print render, no image, no canvas |
| P6h | the offscreen stage goes with its call | the stage is not removed | `src/enhance/diagrams.ts` | red: 1 failed \| 33 passed (34). the print-figures command through the reader changes nothing on screen: the root is byte-equal before and after, and the stage is gone |
| P6i | a source longer than Mermaid takes is never drawn | the length test is dropped | `src/enhance/diagrams.ts` | red: 1 failed \| 33 passed (34). the print-figures command through the reader skips a source longer than Mermaid takes (the host's maxTextSize), and asks Mermaid nothing for it |
| P6j | a canvas the image tainted skips its figure | the canvas read's failure is not caught | `src/enhance/env.ts` | red: 1 failed \| 33 passed (34). the print-figures command through the reader skips a figure whose image fails to load, whose canvas is tainted, or whose PNG is over 1 MiB, and one that is no PNG |
| P6k | an image that fails to load skips its figure at once | the image's error event is not heard | `src/enhance/env.ts` | red: 1 failed \| 33 passed (34). the print-figures command through the reader skips a figure whose image fails to load, whose canvas is tainted, or whose PNG is over 1 MiB, and one that is no PNG |
| P6l | only a PNG data URL is a picture | any data URL is taken for the PNG | `src/enhance/env.ts` | stays green (34 passed of 34): an equivalent mutant. the text after a wrong data URL's prefix is no PNG either, and isPrintPng (row R6g) refuses it: two guards on one case; no input reaches the first alone |
| P6m | an SVG with an error drawing is not rasterised | the error drawing is not refused | `src/enhance/print-figures.ts` | red: 2 failed \| 32 passed (34). sizedSvg: Mermaid's text with an absolute size is null for text that is no SVG, has no usable viewBox, or is Mermaid's error drawing ; the runner on its own skips a drawing whose SVG has no size, and Mermaid's error drawing |
| P6n | the image has an absolute size and no max-width | max-width is left in the style | `src/enhance/print-figures.ts` | red: 2 failed \| 32 passed (34). sizedSvg: Mermaid's text with an absolute size replaces width="100%", height and max-width by the canvas size of the viewBox, and keeps the rest ; the print-figures command through the reader rasterises each drawing at print scale: an absolute-size SVG as a data URL, on a canvas of its size |
| F6a | the adapter forwards nothing without bridge.printFigures (P6f) | the print option is built whatever the seed says | `src/frame-runtime/adapters.ts` | red: 2 failed \| 60 passed (62). the print wire: the adapter forwards a figure only under bridge.printFigures (docserver parity T6) without bridge.printFigures there is no print option: the reader builds no print-figures command, and nothing is sent ; a second print-figures command, with the frame's real outbox, adapter and runner in front of the host's real parser the frame sends nothing when the seed did not set bridge.printFigures: no option, so no figure ever reaches the host |
| F6b | the adapter sends only an i from 0 | the i >= 0 test is dropped | `src/frame-runtime/adapters.ts` | red: 1 failed \| 61 passed (62). the print wire: the adapter forwards a figure only under bridge.printFigures (docserver parity T6) a figure the wire has no place for is not sent, and its promise settles at once: i at or above n, a negative i, n above 64, a PNG text longer than 1 MiB can be, a text that is no string |
| F6c | the adapter sends only an i below n | the i < n test is dropped | `src/frame-runtime/adapters.ts` | red: 1 failed \| 61 passed (62). the print wire: the adapter forwards a figure only under bridge.printFigures (docserver parity T6) a figure the wire has no place for is not sent, and its promise settles at once: i at or above n, a negative i, n above 64, a PNG text longer than 1 MiB can be, a text that is no string |
| F6d | the adapter sends only an n of at most 64 | the n test is dropped | `src/frame-runtime/adapters.ts` | red: 1 failed \| 61 passed (62). the print wire: the adapter forwards a figure only under bridge.printFigures (docserver parity T6) a figure the wire has no place for is not sent, and its promise settles at once: i at or above n, a negative i, n above 64, a PNG text longer than 1 MiB can be, a text that is no string |
| F6e | the adapter sends only a text | the string test is dropped | `src/frame-runtime/adapters.ts` | red: 1 failed \| 61 passed (62). the print wire: the adapter forwards a figure only under bridge.printFigures (docserver parity T6) a figure the wire has no place for is not sent, and its promise settles at once: i at or above n, a negative i, n above 64, a PNG text longer than 1 MiB can be, a text that is no string |
| F6f | the adapter sends no text longer than a 1 MiB PNG can be | the length test is dropped | `src/frame-runtime/adapters.ts` | red: 1 failed \| 61 passed (62). the print wire: the adapter forwards a figure only under bridge.printFigures (docserver parity T6) a figure the wire has no place for is not sent, and its promise settles at once: i at or above n, a negative i, n above 64, a PNG text longer than 1 MiB can be, a text that is no string |
| F6g | the longest text is a 1 MiB PNG's | the constant is four characters too long | `src/frame-runtime/adapters.ts` | red: 1 failed \| 61 passed (62). the print wire: the adapter forwards a figure only under bridge.printFigures (docserver parity T6) a figure the wire has no place for is not sent, and its promise settles at once: i at or above n, a negative i, n above 64, a PNG text longer than 1 MiB can be, a text that is no string |
| F6h | a figure not sent still settles its promise | the promise of a figure not sent never settles | `src/frame-runtime/adapters.ts` | red: 1 failed \| 61 passed (62). the print wire: the adapter forwards a figure only under bridge.printFigures (docserver parity T6) a figure the wire has no place for is not sent, and its promise settles at once: i at or above n, a negative i, n above 64, a PNG text longer than 1 MiB can be, a text that is no string |
| O6a | print-figure goes through the pacer (P6e) | a print-figure is posted at once, past the pacer | `src/frame-runtime/outbox.ts` | red: 5 failed \| 57 passed (62). print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted goes through the pacer: a burst of 40 posts at most 12 in any 1000 ms (plus the transit margin), in order, none lost ; print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted shares the pacer with the other ops: 14 figures and three store.set together post all 17, at most 12 in any window ; print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted calls `done` once the op is posted, not before: a figure waiting in the pacer's line is not done ; print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted after dispose() an op is not posted and its `done` is never called ; and 1 more |
| O6b | the reader's next figure waits for the post (done) | done is never called | `src/frame-runtime/outbox.ts` | red: 4 failed \| 58 passed (62). print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted calls `done` once the op is posted, not before: a figure waiting in the pacer's line is not done ; print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted a figure sent before ready is posted by open() and then done ; a second print-figures command, with the frame's real outbox, adapter and runner in front of the host's real parser leaves at most one stale figure in the host's second run: one refusal, never the sixteen that close the frame ; a second print-figures command, with the frame's real outbox, adapter and runner in front of the host's real parser a single run is accepted whole, at the pacer's rate: 30 figures, no refusal, every index once |
| O6c | a stale run leaves at most one figure (done when posted) | done is called when the op is queued, not when it is posted | `src/frame-runtime/outbox.ts` | red: 3 failed \| 59 passed (62). print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted calls `done` once the op is posted, not before: a figure waiting in the pacer's line is not done ; print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted after dispose() an op is not posted and its `done` is never called ; a second print-figures command, with the frame's real outbox, adapter and runner in front of the host's real parser leaves at most one stale figure in the host's second run: one refusal, never the sixteen that close the frame |
| O6d | a figure sent before ready does not break open() | open() sends a queued print-figure to a coalescing lane that does not exist for it | `src/frame-runtime/outbox.ts` | red: 1 failed \| 61 passed (62). print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted a figure sent before ready is posted by open() and then done |
| O6e | a figure sent before ready keeps its done | the pre-ready queue forgets done | `src/frame-runtime/outbox.ts` | red: 1 failed \| 61 passed (62). print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted a figure sent before ready is posted by open() and then done |
| B6b | HTML labels are off in a real drawing (Chromium) | the print configuration is the screen's unchanged | `src/enhance/print-figures.ts` | stays green in Chromium (2 passed of 4): not an equivalent mutant: Chromium cannot kill it. A real canvas draws an SVG image with HTML labels (foreignObject) without tainting, so the real-browser case cannot tell the two configurations apart. Its red cases are rows P6a, P6a2 and P6a3 (the configuration itself); on WebKit, where a canvas that drew foreignObject taints and the figure is skipped, the browser case would turn it red, but CI runs only the unmutated tree and no WebKit build runs locally, so this row is unmeasured |
| B6a | the print drawing is the hosted one for a covered figure (Chromium) | a print drawing ignores the host's colours | `src/enhance/diagrams.ts` | red: 1 failed \| 1 passed (4). chromium a figure drawn hosted prints in the host's colours; the same document without colours prints in 1.1's |
| I1 | a run ends only at the next printFigures() or at unmount | a run ends at i = n - 1 again | `src/host/mount.ts` | red: 3 failed \| 189 passed (192). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run the last index may come first, and the run goes on: a stale figure with i = n - 1 closes nothing (review I1) ; a second print-figures command, with the frame's real outbox, adapter and runner in front of the host's real parser a reprint while the last index waits in the pacer (n = 25, i = 24 in the line): the new run is not closed by it, and every one of its figures is handed to the host (review I1) ; a second print-figures command, with the frame's real outbox, adapter and runner in front of the host's real parser an interrupted reprint costs exactly one refusal: the copy of the stale index that the new run sends (review I1) |
| R6h | the run's PNGs together stay within 16 MiB (review I2) | the running total is not checked | `src/enhance/print-figures.ts` | red: 2 failed \| 40 passed (42). the runner on its own keeps the run's total at or under 16 MiB: a figure that would pass it is skipped and adds nothing, and a later smaller one is still sent (review I2) ; a second print-figures command, with the frame's real outbox, adapter and runner in front of the host's real parser a figure the runner skips for the 16 MiB total is never sent, so the host refuses nothing for it (review I2) |
| R6i | a skipped figure adds nothing to the run's total | the total counts a figure before it is judged | `src/enhance/print-figures.ts` | red: 1 failed \| 35 passed (36). the runner on its own keeps the run's total at or under 16 MiB: a figure that would pass it is skipped and adds nothing, and a later smaller one is still sent (review I2) |
| R6j | a figure that brings the run to exactly 16 MiB is sent | the total test is >= instead of > | `src/enhance/print-figures.ts` | red: 2 failed \| 34 passed (36). the runner on its own keeps the run's total at or under 16 MiB: a figure that would pass it is skipped and adds nothing, and a later smaller one is still sent (review I2) ; the runner on its own a new run starts its total again |
| R6k | the reader's copy of the run cap is the wire's | the cap is one byte over | `src/enhance/print-figures.ts` | red: 2 failed \| 34 passed (36). the constants are the wire's FIGURES_MAX, SIDE_MAX and PNG_MAX_BYTES equal BRIDGE_LIMITS ; the runner on its own keeps the run's total at or under 16 MiB: a figure that would pass it is skipped and adds nothing, and a later smaller one is still sent (review I2) |

## Choices

- **The lost jump push (J6a to J6e).** `trail()` kept only the latest `hash` op of its 100 ms window. The window that holds a push now posts the latest `id` with `push: 'true'` and the `from` of the first push.
- **The bootstrap, by option** (bytes of `frame/bootstrap.js`; the budget is 32 768): the first build, adapter with every check and `done`: 32 789 (over, not committed); option (2), checks kept and `done` dropped: 32 763; option (3), a thin pass-through adapter with `done` kept: 32 624; option (3'), thin and no `done`: 32 581; option (A), the adapter keeps its range, type and size checks, drops the integer test, keeps `done`: 32 747, then 32 740 with the 1 MiB text length written as a number and the pre-ready queue made safe for a figure (below). (3) and (3') were measured from the in-memory bundle and never built. **The reason for (A):** no thin adapter passed the build's free-globals scan in about 75 attempts (the window/document alias tie: the minifier's name for the `window` alias flips between the scan's two passes, and only a body that keeps most of the old checks moves it back), and (A) checks more in the bootstrap, never less. The integer test stays out of the frame because the host's grammar refuses a decimal point (row H6g) and the reader refuses it first (rows R6c).
- **`done`.** `send(op, done)` takes an optional callback the outbox calls once the op is posted; the adapter returns a promise that settles then, and the reader waits for it before it draws the next figure. A cancelled run leaves at most one figure in the pacer (`test/host-print-run.test.ts`: a reprint costs the host one refusal, not sixteen; rows O6b and O6c). Without it up to 63 queued PNGs would arrive in the host's second run.
- **A defect found on the way, in my own first draft.** A figure sent before ready crashed `open()` (it reached a lane it has none for). `open()` now enqueues it, and the pre-ready queue keeps its `done` (rows O6d and O6e).
- **The host parser's signature test.** `png` must start with `iVBORw0KGgo` (a PNG's eight signature bytes and the zero top bits of the next), read from the text and refused as `type`, after the empty-text test and before the size (so a non-PNG of any size is `type`). The size fixtures of `conformance/bridge-cases.json` now start with the signature; it gains seven fixtures (a PNG with more after the signature, base64 that is no PNG, a cut signature, a JPEG's start, an oversize non-PNG, a fractional `i` and a fractional `n`). `test/frame-protocol.test.ts`'s reference parser got the same test.
- **Chromium and HTML labels (B6b), a mutant Chromium cannot kill.** In Chromium the real canvas draws an SVG image with HTML labels (`foreignObject`) without tainting, so the real-browser case does not separate the two configurations; the guard is killed by the configuration rows (P6a, P6a2, P6a3); on an engine that taints the browser case would turn it red, which no run here or in CI has measured (CI runs the unmutated tree).
- **Double guards.** The runner's slice to 64 and `registerPrint`'s slice to 64 guard one thing twice (a run of 64): removing either alone stays green, so R6e removes the runner's and is red through the runner's own test, which hands it 80 draws directly. The data-URL prefix test of `env.rasterize` and `isPrintPng` guard one case twice (P6l, recorded as equivalent).
- **Not measured locally.** `test/frame-build.test.ts` and `test/frame-document.test.ts` are killed by the shared test slice's memory cap when run whole; run in parts they pass (frame-build: 16 and 29 of 45; frame-document: 130 and 88 of 269, with the 44 cases of "each code at its boundary", of which 7 ran before the kill, unmeasured). `test/size-contract.test.ts` judges a landing's message and growth tables and reads no `Size-Design` line on a task commit.

- **A run ends only at the next `printFigures()` or at unmount (review I1; plan choice B5 revised).** The parser's run no longer closes at `i = n - 1`, so a stale figure of a cancelled run lands in the new run as its index and the real copy of that index is the one refusal (row I1 restores the old end and reds both cases: `test/host-print-run.test.ts`, n = 25 with i = 24 waiting in the pacer, and the exact-one-refusal case; `test/host-mount.test.ts`).
- **The reader keeps the run's total (review I2; rows R6h to R6k).** A figure that would take the run's PNGs past 16 MiB is skipped and adds nothing; its `i` is never sent, so the host prints its source with its missing note and counts no refusal (`test/host-print-run.test.ts`: 17 figures of 1 MiB, sixteen sent, none refused).

```json

[
  {
    "id": "J6a",
    "guard": "a jump push survives a following move",
    "edit": "trail keeps only the latest hash op, as before",
    "file": "src/frame-runtime/outbox.ts",
    "tests": "test/frame-outbox.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 23,
    "total": 26,
    "red": [
      "the outbox after ready: the pacer a push followed within the window by a move that is not a push still posts one hash with push, and the place the reader left (docserver parity T6)",
      "the outbox after ready: the pacer two pushes in one window post one hash: the latest id, the first from",
      "the outbox after ready: the pacer a first push with no from stays a push with none, a later push's from is not borrowed; moves alone stay moves"
    ]
  },
  {
    "id": "J6b",
    "guard": "the from of a merged push is the first push's",
    "edit": "the merged hash takes the latest op's from",
    "file": "src/frame-runtime/outbox.ts",
    "tests": "test/frame-outbox.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 23,
    "total": 26,
    "red": [
      "the outbox after ready: the pacer a push followed within the window by a move that is not a push still posts one hash with push, and the place the reader left (docserver parity T6)",
      "the outbox after ready: the pacer two pushes in one window post one hash: the latest id, the first from",
      "the outbox after ready: the pacer a first push with no from stays a push with none, a later push's from is not borrowed; moves alone stay moves"
    ]
  },
  {
    "id": "J6c",
    "guard": "the merged hash goes to the latest id",
    "edit": "the merged hash keeps the first op's id",
    "file": "src/frame-runtime/outbox.ts",
    "tests": "test/frame-outbox.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 23,
    "total": 26,
    "red": [
      "the outbox after ready: the pacer a push followed within the window by a move that is not a push still posts one hash with push, and the place the reader left (docserver parity T6)",
      "the outbox after ready: the pacer two pushes in one window post one hash: the latest id, the first from",
      "the outbox after ready: the pacer a first push with no from stays a push with none, a later push's from is not borrowed; moves alone stay moves"
    ]
  },
  {
    "id": "J6d",
    "guard": "the first push's from survives a second push",
    "edit": "a push arriving over a held push replaces it whole",
    "file": "src/frame-runtime/outbox.ts",
    "tests": "test/frame-outbox.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 24,
    "total": 26,
    "red": [
      "the outbox after ready: the pacer two pushes in one window post one hash: the latest id, the first from",
      "the outbox after ready: the pacer a first push with no from stays a push with none, a later push's from is not borrowed; moves alone stay moves"
    ]
  },
  {
    "id": "J6e",
    "guard": "a move after a move stays a move",
    "edit": "any held hash makes the merged one a push",
    "file": "src/frame-runtime/outbox.ts",
    "tests": "test/frame-outbox.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 24,
    "total": 26,
    "red": [
      "the outbox after ready: the pacer hash coalesces over 100 ms: the latest id once the window ends",
      "the outbox after ready: the pacer a first push with no from stays a push with none, a later push's from is not borrowed; moves alone stay moves"
    ]
  },
  {
    "id": "H6a",
    "guard": "the parser refuses an i at or above n",
    "edit": "the i < n test is dropped (n at most 64 stays)",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 9,
    "passed": 403,
    "total": 412,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run an index seen in the run, an n that changes and an index at or above n are refused and never handed on",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 64 figures are handed on and a 65th is refused (n of 65, and a figure past the end of a run of 64), under the buckets: 16 a second, none refused by the rate",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) an i equal to or above n",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure n of 0",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure i equal to n",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure i above n",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure i of 64 in a run of 64",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded 0 <= i < n <= 64: n of 64 and i of 63 pass; n of 65, n of 0, i equal to n and i above n are refused",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded a text longer than the longest a 1 MiB figure can have is oversize before its alphabet is read; up to that length it is read"
    ]
  },
  {
    "id": "H6b",
    "guard": "the parser refuses an n above 64",
    "edit": "the n <= 64 test is dropped (i < n stays)",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 5,
    "passed": 407,
    "total": 412,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 64 figures are handed on and a 65th is refused (n of 65, and a figure past the end of a run of 64), under the buckets: 16 a second, none refused by the rate",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) an n above 64, whatever the run holds",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) sixteen forged figures in a row close the frame, and none of them reached the host",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure n of 65",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded 0 <= i < n <= 64: n of 64 and i of 63 pass; n of 65, n of 0, i equal to n and i above n are refused"
    ]
  },
  {
    "id": "H6c",
    "guard": "the parser refuses a PNG over 1 MiB",
    "edit": "the decoded-size cap of one figure is dropped",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 5,
    "passed": 407,
    "total": 412,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 1048575 and 1048576 decoded bytes are handed on, 1048577 is refused and never handed on",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) a PNG over 1 MiB, however its text is long",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure of 1048577 decoded bytes",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the order of the checks: the index before the text, the text before its size, the size before the total",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded 1048575 and 1048576 decoded bytes pass, 1048577 is oversize: the size is read from the length and the padding"
    ]
  },
  {
    "id": "H6c2",
    "guard": "the parser reads no text longer than a 1 MiB PNG can be",
    "edit": "the longest-text cap before the scan is dropped",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 410,
    "total": 412,
    "red": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure png of 1398105 characters that is not base64",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded a text longer than the longest a 1 MiB figure can have is oversize before its alphabet is read; up to that length it is read"
    ]
  },
  {
    "id": "H6d",
    "guard": "the parser refuses a text that is not a PNG",
    "edit": "the signature test is dropped",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 7,
    "passed": 405,
    "total": 412,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) a text that is not a PNG: base64 of anything else, a cut signature, an empty text, a number",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure png that is base64 but not a PNG",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure png with the signature cut short",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure png of a JPEG's first bytes",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure of 1048577 decoded bytes that is not a PNG",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the order of the checks: the index before the text, the text before its size, the size before the total",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the text must start as a PNG's does (the base64 of its eight signature bytes), judged from the text and never decoded: any other start is 'type'"
    ]
  },
  {
    "id": "H6d2",
    "guard": "the parser takes the whole signature",
    "edit": "the signature prefix is cut by one character",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 409,
    "total": 412,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) a text that is not a PNG: base64 of anything else, a cut signature, an empty text, a number",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure png with the signature cut short",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the text must start as a PNG's does (the base64 of its eight signature bytes), judged from the text and never decoded: any other start is 'type'"
    ]
  },
  {
    "id": "H6e",
    "guard": "the parser refuses a repeated i",
    "edit": "the seen-index test is dropped",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 5,
    "passed": 407,
    "total": 412,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run an index seen in the run, an n that changes and an index at or above n are refused and never handed on",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) an i already seen in the run",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure i already seen",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded an index seen in the run is refused, however many figures follow",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the order of the checks: the index before the text, the text before its size, the size before the total"
    ]
  },
  {
    "id": "H6f",
    "guard": "the parser refuses a figure that takes the run over its total",
    "edit": "the run total test is dropped",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 6,
    "passed": 406,
    "total": 412,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run sixteen figures of 1048576 bytes pass; one more byte is refused by the total while within its own cap, and is not handed on",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a refused figure takes none of the total: a refused big figure leaves room for the next",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) a figure that takes the run over its total, while within its own cap",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure that takes a run one byte over 16777216 decoded bytes",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the order of the checks: the index before the text, the text before its size, the size before the total",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the run total: the run plus the figure may reach 16777216 and not one byte more"
    ]
  },
  {
    "id": "H6g",
    "guard": "the parser refuses an i or n that is not an integer",
    "edit": "the canonical-decimal grammar admits a fraction",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 6,
    "passed": 406,
    "total": 412,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) an i or an n that is not an integer, or no canonical decimal: a point, a fraction, an exponent, a sign, a number",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure i with a point",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure i not an integer",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure n not an integer",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded i and n are canonical decimals: a leading zero, a sign, a point, an exponent, a space, a fourth digit and the empty text are 'type'",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded an i or n that is not an integer, or not a canonical decimal, is 'type': a point, a fraction, a sign, an exponent, a number"
    ]
  },
  {
    "id": "H6h",
    "guard": "the parser refuses an n other than the run's",
    "edit": "the run's n test is dropped",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 4,
    "passed": 408,
    "total": 412,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run an index seen in the run, an n that changes and an index at or above n are refused and never handed on",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a forged figure, posted straight down the port with no reader in front of it, is refused by the host alone (docserver parity T6) a n that is not the run's",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure n different from its run",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded n must equal the run's once the run has one, and a run with no figure yet takes any n"
    ]
  },
  {
    "id": "R6a",
    "guard": "the reader hands over only an i below n",
    "edit": "figurePlace drops i < n",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 32,
    "total": 33,
    "red": [
      "PNG text: size and signature figurePlace takes integers with 0 <= i < n <= 64"
    ]
  },
  {
    "id": "R6b",
    "guard": "the reader hands over only an n of at most 64",
    "edit": "figurePlace drops n <= 64",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 32,
    "total": 33,
    "red": [
      "PNG text: size and signature figurePlace takes integers with 0 <= i < n <= 64"
    ]
  },
  {
    "id": "R6c",
    "guard": "the reader hands over only integers i and n",
    "edit": "figurePlace drops the integer tests",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 32,
    "total": 33,
    "red": [
      "PNG text: size and signature figurePlace takes integers with 0 <= i < n <= 64"
    ]
  },
  {
    "id": "R6d",
    "guard": "the reader hands over only an i from 0",
    "edit": "figurePlace drops i >= 0",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 32,
    "total": 33,
    "red": [
      "PNG text: size and signature figurePlace takes integers with 0 <= i < n <= 64"
    ]
  },
  {
    "id": "R6e",
    "guard": "a run is cut to 64 figures",
    "edit": "the runner takes the whole list",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 32,
    "total": 33,
    "red": [
      "the runner on its own cuts a list of more than 64 figures to 64: n is 64 and no 65th is drawn"
    ]
  },
  {
    "id": "R6f",
    "guard": "the reader hands over a PNG of at most 1 MiB",
    "edit": "isPrintPng drops the size cap",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 30,
    "total": 33,
    "red": [
      "PNG text: size and signature isPrintPng takes the signature and at most 1 MiB",
      "the print-figures command through the reader skips a figure whose image fails to load, whose canvas is tainted, or whose PNG is over 1 MiB, and one that is no PNG",
      "the runner on its own hands over no figure whose PNG is no PNG or too large, and skips an undefined entry"
    ]
  },
  {
    "id": "R6g",
    "guard": "the reader hands over only a PNG",
    "edit": "isPrintPng drops the signature test",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 30,
    "total": 33,
    "red": [
      "PNG text: size and signature isPrintPng takes the signature and at most 1 MiB",
      "the print-figures command through the reader skips a figure whose image fails to load, whose canvas is tainted, or whose PNG is over 1 MiB, and one that is no PNG",
      "the runner on its own hands over no figure whose PNG is no PNG or too large, and skips an undefined entry"
    ]
  },
  {
    "id": "P6a",
    "guard": "HTML labels are off in a print drawing",
    "edit": "the top-level htmlLabels: false is dropped",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 31,
    "total": 33,
    "red": [
      "printConfigOf: the screen's configuration, made print's turns HTML labels off at the top and in the flowchart, puts the one usable font on, and makes htmlLabels secure",
      "the print-figures command through the reader draws for print apart from the screen: HTML labels off, the one font, htmlLabels secure, in the offscreen stage"
    ]
  },
  {
    "id": "P6a2",
    "guard": "HTML labels are off in the flowchart too",
    "edit": "flowchart.htmlLabels: false is dropped",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 31,
    "total": 33,
    "red": [
      "printConfigOf: the screen's configuration, made print's turns HTML labels off at the top and in the flowchart, puts the one usable font on, and makes htmlLabels secure",
      "the print-figures command through the reader draws for print apart from the screen: HTML labels off, the one font, htmlLabels secure, in the offscreen stage"
    ]
  },
  {
    "id": "P6a3",
    "guard": "a diagram's own directive cannot turn HTML labels back on",
    "edit": "htmlLabels is not added to the secure keys",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 31,
    "total": 33,
    "red": [
      "printConfigOf: the screen's configuration, made print's turns HTML labels off at the top and in the flowchart, puts the one usable font on, and makes htmlLabels secure",
      "the print-figures command through the reader draws for print apart from the screen: HTML labels off, the one font, htmlLabels secure, in the offscreen stage"
    ]
  },
  {
    "id": "P6a4",
    "guard": "a print drawing uses the one font an image can use",
    "edit": "the screen's font family is kept",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 31,
    "total": 33,
    "red": [
      "printConfigOf: the screen's configuration, made print's turns HTML labels off at the top and in the flowchart, puts the one usable font on, and makes htmlLabels secure",
      "the print-figures command through the reader draws for print apart from the screen: HTML labels off, the one font, htmlLabels secure, in the offscreen stage"
    ]
  },
  {
    "id": "P6b",
    "guard": "a figure's PNG is at most 2048 px a side",
    "edit": "the scale is not shrunk to fit and the side clamp is dropped",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 31,
    "total": 33,
    "red": [
      "printSize: print scale 2, shrunk to fit 2048 px a side doubles an ordinary drawing, keeps its proportions and never passes SIDE_MAX",
      "the print-figures command through the reader rasterises each drawing at print scale: an absolute-size SVG as a data URL, on a canvas of its size"
    ]
  },
  {
    "id": "P6b2",
    "guard": "a shrunk figure keeps its proportions",
    "edit": "the scale is not shrunk to fit (the clamp alone cuts a side)",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 31,
    "total": 33,
    "red": [
      "printSize: print scale 2, shrunk to fit 2048 px a side doubles an ordinary drawing, keeps its proportions and never passes SIDE_MAX",
      "the print-figures command through the reader rasterises each drawing at print scale: an absolute-size SVG as a data URL, on a canvas of its size"
    ]
  },
  {
    "id": "P6c",
    "guard": "a figure that does not draw is never sent",
    "edit": "a figure with no usable drawing is handed over with an empty text",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 30,
    "total": 33,
    "red": [
      "the print-figures command through the reader skips a figure that does not draw: its i is never handed over, and the figures after it go on",
      "the runner on its own a draw that throws, or a rasterize that throws or answers null, skips that figure only",
      "the runner on its own skips a drawing whose SVG has no size, and Mermaid's error drawing"
    ]
  },
  {
    "id": "P6c2",
    "guard": "a figure whose picture is null is skipped, and the run goes on",
    "edit": "a null picture is handed to the PNG test",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 30,
    "total": 33,
    "red": [
      "the print-figures command through the reader skips a figure whose image fails to load, whose canvas is tainted, or whose PNG is over 1 MiB, and one that is no PNG",
      "the print-figures command through the reader skips a figure whose canvas answers no PNG data URL (a canvas of no size answers data:,)",
      "the runner on its own a draw that throws, or a rasterize that throws or answers null, skips that figure only"
    ]
  },
  {
    "id": "P6d",
    "guard": "a second command cancels the first run",
    "edit": "a run is stale only when the instance is not live",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 30,
    "total": 33,
    "red": [
      "the print-figures command through the reader a second print-figures cancels the first run: its remaining figures are neither drawn nor handed over",
      "the print-figures command through the reader a figure of the cancelled run still queued behind another call is never drawn: Mermaid is asked for nothing on its behalf",
      "the print-figures command through the reader a second command cancels a run waiting on the host: the figure after the one handed over is never drawn for it"
    ]
  },
  {
    "id": "P6d2",
    "guard": "a run stops once the instance is not live",
    "edit": "a run is stale only when a newer run began",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 33,
    "total": 34,
    "red": [
      "the runner on its own stops at once when the instance is not live: nothing more is drawn, rasterised or handed over"
    ]
  },
  {
    "id": "P6d3",
    "guard": "a cancelled run asks Mermaid for nothing more",
    "edit": "a call still queued behind another is made although its run is cancelled",
    "file": "src/enhance/diagrams.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 33,
    "total": 34,
    "red": [
      "the print-figures command through the reader a figure of the cancelled run still queued behind another call is never drawn: Mermaid is asked for nothing on its behalf"
    ]
  },
  {
    "id": "P6g",
    "guard": "without the host's onPrintFigure the command does nothing",
    "edit": "the command is registered whether or not the host gave the callback",
    "file": "src/enhance/diagrams.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 33,
    "total": 34,
    "red": [
      "the print-figures command through the reader answers false and does nothing without onPrintFigure: no print render, no image, no canvas"
    ]
  },
  {
    "id": "P6h",
    "guard": "the offscreen stage goes with its call",
    "edit": "the stage is not removed",
    "file": "src/enhance/diagrams.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 33,
    "total": 34,
    "red": [
      "the print-figures command through the reader changes nothing on screen: the root is byte-equal before and after, and the stage is gone"
    ]
  },
  {
    "id": "P6i",
    "guard": "a source longer than Mermaid takes is never drawn",
    "edit": "the length test is dropped",
    "file": "src/enhance/diagrams.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 33,
    "total": 34,
    "red": [
      "the print-figures command through the reader skips a source longer than Mermaid takes (the host's maxTextSize), and asks Mermaid nothing for it"
    ]
  },
  {
    "id": "P6j",
    "guard": "a canvas the image tainted skips its figure",
    "edit": "the canvas read's failure is not caught",
    "file": "src/enhance/env.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 33,
    "total": 34,
    "red": [
      "the print-figures command through the reader skips a figure whose image fails to load, whose canvas is tainted, or whose PNG is over 1 MiB, and one that is no PNG"
    ]
  },
  {
    "id": "P6k",
    "guard": "an image that fails to load skips its figure at once",
    "edit": "the image's error event is not heard",
    "file": "src/enhance/env.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 33,
    "total": 34,
    "red": [
      "the print-figures command through the reader skips a figure whose image fails to load, whose canvas is tainted, or whose PNG is over 1 MiB, and one that is no PNG"
    ]
  },
  {
    "id": "P6l",
    "guard": "only a PNG data URL is a picture",
    "edit": "any data URL is taken for the PNG",
    "file": "src/enhance/env.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 0,
    "failed": 0,
    "passed": 34,
    "total": 34,
    "red": [],
    "equivalent": "the text after a wrong data URL's prefix is no PNG either, and isPrintPng (row R6g) refuses it: two guards on one case; no input reaches the first alone"
  },
  {
    "id": "P6m",
    "guard": "an SVG with an error drawing is not rasterised",
    "edit": "the error drawing is not refused",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 32,
    "total": 34,
    "red": [
      "sizedSvg: Mermaid's text with an absolute size is null for text that is no SVG, has no usable viewBox, or is Mermaid's error drawing",
      "the runner on its own skips a drawing whose SVG has no size, and Mermaid's error drawing"
    ]
  },
  {
    "id": "P6n",
    "guard": "the image has an absolute size and no max-width",
    "edit": "max-width is left in the style",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 32,
    "total": 34,
    "red": [
      "sizedSvg: Mermaid's text with an absolute size replaces width=\"100%\", height and max-width by the canvas size of the viewBox, and keeps the rest",
      "the print-figures command through the reader rasterises each drawing at print scale: an absolute-size SVG as a data URL, on a canvas of its size"
    ]
  },
  {
    "id": "F6a",
    "guard": "the adapter forwards nothing without bridge.printFigures (P6f)",
    "edit": "the print option is built whatever the seed says",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/frame-outbox.test.ts, test/host-print-run.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 60,
    "total": 62,
    "red": [
      "the print wire: the adapter forwards a figure only under bridge.printFigures (docserver parity T6) without bridge.printFigures there is no print option: the reader builds no print-figures command, and nothing is sent",
      "a second print-figures command, with the frame's real outbox, adapter and runner in front of the host's real parser the frame sends nothing when the seed did not set bridge.printFigures: no option, so no figure ever reaches the host"
    ]
  },
  {
    "id": "F6b",
    "guard": "the adapter sends only an i from 0",
    "edit": "the i >= 0 test is dropped",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/frame-outbox.test.ts, test/host-print-run.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 61,
    "total": 62,
    "red": [
      "the print wire: the adapter forwards a figure only under bridge.printFigures (docserver parity T6) a figure the wire has no place for is not sent, and its promise settles at once: i at or above n, a negative i, n above 64, a PNG text longer than 1 MiB can be, a text that is no string"
    ]
  },
  {
    "id": "F6c",
    "guard": "the adapter sends only an i below n",
    "edit": "the i < n test is dropped",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/frame-outbox.test.ts, test/host-print-run.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 61,
    "total": 62,
    "red": [
      "the print wire: the adapter forwards a figure only under bridge.printFigures (docserver parity T6) a figure the wire has no place for is not sent, and its promise settles at once: i at or above n, a negative i, n above 64, a PNG text longer than 1 MiB can be, a text that is no string"
    ]
  },
  {
    "id": "F6d",
    "guard": "the adapter sends only an n of at most 64",
    "edit": "the n test is dropped",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/frame-outbox.test.ts, test/host-print-run.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 61,
    "total": 62,
    "red": [
      "the print wire: the adapter forwards a figure only under bridge.printFigures (docserver parity T6) a figure the wire has no place for is not sent, and its promise settles at once: i at or above n, a negative i, n above 64, a PNG text longer than 1 MiB can be, a text that is no string"
    ]
  },
  {
    "id": "F6e",
    "guard": "the adapter sends only a text",
    "edit": "the string test is dropped",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/frame-outbox.test.ts, test/host-print-run.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 61,
    "total": 62,
    "red": [
      "the print wire: the adapter forwards a figure only under bridge.printFigures (docserver parity T6) a figure the wire has no place for is not sent, and its promise settles at once: i at or above n, a negative i, n above 64, a PNG text longer than 1 MiB can be, a text that is no string"
    ]
  },
  {
    "id": "F6f",
    "guard": "the adapter sends no text longer than a 1 MiB PNG can be",
    "edit": "the length test is dropped",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/frame-outbox.test.ts, test/host-print-run.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 61,
    "total": 62,
    "red": [
      "the print wire: the adapter forwards a figure only under bridge.printFigures (docserver parity T6) a figure the wire has no place for is not sent, and its promise settles at once: i at or above n, a negative i, n above 64, a PNG text longer than 1 MiB can be, a text that is no string"
    ]
  },
  {
    "id": "F6g",
    "guard": "the longest text is a 1 MiB PNG's",
    "edit": "the constant is four characters too long",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/frame-outbox.test.ts, test/host-print-run.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 61,
    "total": 62,
    "red": [
      "the print wire: the adapter forwards a figure only under bridge.printFigures (docserver parity T6) a figure the wire has no place for is not sent, and its promise settles at once: i at or above n, a negative i, n above 64, a PNG text longer than 1 MiB can be, a text that is no string"
    ]
  },
  {
    "id": "F6h",
    "guard": "a figure not sent still settles its promise",
    "edit": "the promise of a figure not sent never settles",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/frame-outbox.test.ts, test/host-print-run.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 61,
    "total": 62,
    "red": [
      "the print wire: the adapter forwards a figure only under bridge.printFigures (docserver parity T6) a figure the wire has no place for is not sent, and its promise settles at once: i at or above n, a negative i, n above 64, a PNG text longer than 1 MiB can be, a text that is no string"
    ]
  },
  {
    "id": "O6a",
    "guard": "print-figure goes through the pacer (P6e)",
    "edit": "a print-figure is posted at once, past the pacer",
    "file": "src/frame-runtime/outbox.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/frame-outbox.test.ts, test/host-print-run.test.ts",
    "rc": 1,
    "failed": 5,
    "passed": 57,
    "total": 62,
    "red": [
      "print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted goes through the pacer: a burst of 40 posts at most 12 in any 1000 ms (plus the transit margin), in order, none lost",
      "print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted shares the pacer with the other ops: 14 figures and three store.set together post all 17, at most 12 in any window",
      "print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted calls `done` once the op is posted, not before: a figure waiting in the pacer's line is not done",
      "print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted after dispose() an op is not posted and its `done` is never called",
      "a second print-figures command, with the frame's real outbox, adapter and runner in front of the host's real parser leaves at most one stale figure in the host's second run: one refusal, never the sixteen that close the frame"
    ]
  },
  {
    "id": "O6b",
    "guard": "the reader's next figure waits for the post (done)",
    "edit": "done is never called",
    "file": "src/frame-runtime/outbox.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/frame-outbox.test.ts, test/host-print-run.test.ts",
    "rc": 1,
    "failed": 4,
    "passed": 58,
    "total": 62,
    "red": [
      "print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted calls `done` once the op is posted, not before: a figure waiting in the pacer's line is not done",
      "print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted a figure sent before ready is posted by open() and then done",
      "a second print-figures command, with the frame's real outbox, adapter and runner in front of the host's real parser leaves at most one stale figure in the host's second run: one refusal, never the sixteen that close the frame",
      "a second print-figures command, with the frame's real outbox, adapter and runner in front of the host's real parser a single run is accepted whole, at the pacer's rate: 30 figures, no refusal, every index once"
    ]
  },
  {
    "id": "O6c",
    "guard": "a stale run leaves at most one figure (done when posted)",
    "edit": "done is called when the op is queued, not when it is posted",
    "file": "src/frame-runtime/outbox.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/frame-outbox.test.ts, test/host-print-run.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 59,
    "total": 62,
    "red": [
      "print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted calls `done` once the op is posted, not before: a figure waiting in the pacer's line is not done",
      "print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted after dispose() an op is not posted and its `done` is never called",
      "a second print-figures command, with the frame's real outbox, adapter and runner in front of the host's real parser leaves at most one stale figure in the host's second run: one refusal, never the sixteen that close the frame"
    ]
  },
  {
    "id": "O6d",
    "guard": "a figure sent before ready does not break open()",
    "edit": "open() sends a queued print-figure to a coalescing lane that does not exist for it",
    "file": "src/frame-runtime/outbox.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/frame-outbox.test.ts, test/host-print-run.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 61,
    "total": 62,
    "red": [
      "print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted a figure sent before ready is posted by open() and then done"
    ]
  },
  {
    "id": "O6e",
    "guard": "a figure sent before ready keeps its done",
    "edit": "the pre-ready queue forgets done",
    "file": "src/frame-runtime/outbox.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/frame-outbox.test.ts, test/host-print-run.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 61,
    "total": 62,
    "red": [
      "print-figure ops (docserver parity T6): through the pacer, never coalesced, and `done` when posted a figure sent before ready is posted by open() and then done"
    ]
  },
  {
    "id": "B6b",
    "guard": "HTML labels are off in a real drawing (Chromium)",
    "edit": "the print configuration is the screen's unchanged",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/browser/print-figures.test.ts",
    "rc": 0,
    "failed": 0,
    "passed": 2,
    "total": 4,
    "red": [],
    "unkillable": "not an equivalent mutant: Chromium cannot kill it. A real canvas draws an SVG image with HTML labels (foreignObject) without tainting, so the real-browser case cannot tell the two configurations apart. Its red cases are rows P6a, P6a2 and P6a3 (the configuration itself); on WebKit, where a canvas that drew foreignObject taints and the figure is skipped, the browser case would turn it red, but CI runs only the unmutated tree and no WebKit build runs locally, so this row is unmeasured"
  },
  {
    "id": "B6a",
    "guard": "the print drawing is the hosted one for a covered figure (Chromium)",
    "edit": "a print drawing ignores the host's colours",
    "file": "src/enhance/diagrams.ts",
    "tests": "test/browser/print-figures.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 1,
    "total": 4,
    "red": [
      "chromium a figure drawn hosted prints in the host's colours; the same document without colours prints in 1.1's"
    ]
  },
  {
    "id": "I1",
    "guard": "a run ends only at the next printFigures() or at unmount",
    "edit": "a run ends at i = n - 1 again",
    "file": "src/host/mount.ts",
    "tests": "test/host-print-run.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 189,
    "total": 192,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run the last index may come first, and the run goes on: a stale figure with i = n - 1 closes nothing (review I1)",
      "a second print-figures command, with the frame's real outbox, adapter and runner in front of the host's real parser a reprint while the last index waits in the pacer (n = 25, i = 24 in the line): the new run is not closed by it, and every one of its figures is handed to the host (review I1)",
      "a second print-figures command, with the frame's real outbox, adapter and runner in front of the host's real parser an interrupted reprint costs exactly one refusal: the copy of the stale index that the new run sends (review I1)"
    ]
  },
  {
    "id": "R6h",
    "guard": "the run's PNGs together stay within 16 MiB (review I2)",
    "edit": "the running total is not checked",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts, test/host-print-run.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 40,
    "total": 42,
    "red": [
      "the runner on its own keeps the run's total at or under 16 MiB: a figure that would pass it is skipped and adds nothing, and a later smaller one is still sent (review I2)",
      "a second print-figures command, with the frame's real outbox, adapter and runner in front of the host's real parser a figure the runner skips for the 16 MiB total is never sent, so the host refuses nothing for it (review I2)"
    ]
  },
  {
    "id": "R6i",
    "guard": "a skipped figure adds nothing to the run's total",
    "edit": "the total counts a figure before it is judged",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 35,
    "total": 36,
    "red": [
      "the runner on its own keeps the run's total at or under 16 MiB: a figure that would pass it is skipped and adds nothing, and a later smaller one is still sent (review I2)"
    ]
  },
  {
    "id": "R6j",
    "guard": "a figure that brings the run to exactly 16 MiB is sent",
    "edit": "the total test is >= instead of >",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 34,
    "total": 36,
    "red": [
      "the runner on its own keeps the run's total at or under 16 MiB: a figure that would pass it is skipped and adds nothing, and a later smaller one is still sent (review I2)",
      "the runner on its own a new run starts its total again"
    ]
  },
  {
    "id": "R6k",
    "guard": "the reader's copy of the run cap is the wire's",
    "edit": "the cap is one byte over",
    "file": "src/enhance/print-figures.ts",
    "tests": "test/enhance-print-figures.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 34,
    "total": 36,
    "red": [
      "the constants are the wire's FIGURES_MAX, SIDE_MAX and PNG_MAX_BYTES equal BRIDGE_LIMITS",
      "the runner on its own keeps the run's total at or under 16 MiB: a figure that would pass it is skipped and adds nothing, and a later smaller one is still sent (review I2)"
    ]
  }
]
```
