# Parity Task 2: mutation rows (the host)

Each row was measured in place on this wave's branch: the bytes of the file saved with their sha256, one edit applied, the tests named in the row run through the fleet test wrapper as `./node_modules/.bin/vitest run --maxWorkers=1 --reporter=json`, then the file restored from the saved bytes (`cp`) and its sha256 compared. The restore sha256 of each file is `src/host/mount.ts` `54f51b31311b11430fb8e80a0f95218025181f849ec33a0cb56a7222b0bccba5` and `src/host/parse.ts` `838c693934b38ef2356c8768602ad358ef2e8caea9cc7adf85176821ad355cfa` (the source of the review-minors commit; P2a to P2j were measured again on it). Every row exited 1 and every failed test is an AssertionError. All rows run `test/host-parse.test.ts` and `test/host-mount.test.ts` (378 tests). The mutation row of the canonical-bits guard of `pngBytesOfBase64`, P1i, is in task-1.md.

| Row | Guard | Edit | File | Result |
|---|---|---|---|---|
| P2a | bridge.places is set only by onPlace | `bridge.places` is seeded true whether or not `onPlace` is given | `src/host/mount.ts` | red: 4 failed \| 374 passed (378). L3.D5 host half, the Mermaid gate and the bridge switches (Reference §11.1 steps 2 and 5) the bridge switches follow which adapters exist; L3.D5 host half, the Mermaid gate and the bridge switches (Reference §11.1 steps 2 and 5) B7.2: progress is switched on by onProgress alone, and by nothing else (B7i); docserver parity T2: the adapters, the seed and the three commands the seed a 1.1-shaped host (neither new adapter) seeds both switches false, and its onHash is called with one argument; docserver parity T2: the adapters, the seed and the three commands the seed onPlace switches places on and by itself; onPrintFigure switches printFigures on and by itself; both together |
| P2b | push needs bridge.places | a hash's `push` is accepted without `bridge.places` (only `from` is gated) | `src/host/parse.ts` | red: 3 failed \| 375 passed (378). docserver parity T2: the adapters, the seed and the three commands place and the hash entry without onPlace a hash with push or from is refused and counted, and a plain hash still reaches onHash with the id alone; L3.H3 every frame-to-parent case of conformance/bridge-cases.json hash with push and without bridge.places; docserver parity T2: place, and a hash's push and from, are the mount's request (bridge.places) without bridge.places either key is a 'keys' refusal, a valid value included (and with no context at all) |
| P2c | from is a position token | a hash's `from` is not checked against `isAnchorToken` | `src/host/parse.ts` | red: 4 failed \| 374 passed (378). docserver parity T2: the adapters, the seed and the three commands place and the hash entry a push or a from that is not valid is refused, never handed on; L3.H3 every frame-to-parent case of conformance/bridge-cases.json hash with a from that is no token; L3.H3 every frame-to-parent case of conformance/bridge-cases.json hash with a from whose y is below zero; docserver parity T2: place, and a hash's push and from, are the mount's request (bridge.places) push is the literal 'true' (a type refusal otherwise) and from is a position token (type), at most 4096 code units (oversize) |
| P2d | size is read with its padding | the figure's size is taken from the text's length alone, `length / 4 * 3`, without the padding | `src/host/parse.ts` | red: 16 failed \| 362 passed (378). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 1048575 and 1048576 decoded bytes are handed on, 1048577 is refused and never handed on; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run sixteen figures of 1048576 bytes pass; one more byte is refused by the total while within its own cap, and is not handed on; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a refused figure takes none of the total: a refused big figure leaves room for the next; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure the first of three; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure the second of three; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure the last of three; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure an index other than 0 first; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure the only one; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure the 64th of 64; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure without bridge.places is judged by its run alone; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure of 1048576 decoded bytes; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure that brings a run to exactly 16777216 decoded bytes; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded an index seen in the run is refused, however many figures follow; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded 1048575 and 1048576 decoded bytes pass, 1048577 is oversize: the size is read from the length and the padding; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the run total: the run plus the figure may reach 16777216 and not one byte more; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded an accepted figure reports its decoded size, read once from its text; no other op carries a size |
| P2e | the run total is capped | the check of the run's total plus the figure is removed | `src/host/parse.ts` | red: 5 failed \| 373 passed (378). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run sixteen figures of 1048576 bytes pass; one more byte is refused by the total while within its own cap, and is not handed on; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a refused figure takes none of the total: a refused big figure leaves room for the next; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure that takes a run one byte over 16777216 decoded bytes; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the order of the checks: the index before the text, the text before its size, the size before the total; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the run total: the run plus the figure may reach 16777216 and not one byte more |
| P2f | at most 64 figures | `n` is no longer bounded by `printFiguresMax`, so a 65th figure of a run of 65 is accepted | `src/host/parse.ts` | red: 3 failed \| 375 passed (378). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 64 figures are handed on and a 65th is refused (n of 65, and a figure past the end of a run of 64), under the buckets: 16 a second, none refused by the rate; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure n of 65; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded 0 <= i < n <= 64: n of 64 and i of 63 pass; n of 65, n of 0, i equal to n and i above n are refused |
| P2g | an index is taken once | an `i` already seen in the run is accepted again | `src/host/parse.ts` | red: 4 failed \| 374 passed (378). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run an index seen in the run, an n that changes and an index at or above n are refused and never handed on; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure i already seen; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded an index seen in the run is refused, however many figures follow; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the order of the checks: the index before the text, the text before its size, the size before the total |
| P2h | a figure needs an open run | a figure with no open run is judged against an empty run and accepted | `src/host/parse.ts` | red: 7 failed \| 371 passed (378). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run before ready it posts nothing, queues nothing and opens no run: a figure after ready is refused; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a figure with no run is refused, never handed on, and counted (the sixteenth closes the frame); docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a figure reaches onPrintFigure as {i, n, png}: i and n numbers, the text unchanged; the run ends at its last index; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run the run belongs to its mount: after update() a figure with no new call is refused; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure with no open run; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded no open run is the first refusal, before the index, the size or the total are looked at; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded an empty text is no PNG: a 'type' refusal, after the run and the index and before any size |
| P2i | a refused figure is not handed on | a refused `print-figure` is still handed to `onPrintFigure` before the refusal is counted | `src/host/mount.ts` | red: 9 failed \| 369 passed (378). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run before ready it posts nothing, queues nothing and opens no run: a figure after ready is refused; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a figure with no run is refused, never handed on, and counted (the sixteenth closes the frame); docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a figure reaches onPrintFigure as {i, n, png}: i and n numbers, the text unchanged; the run ends at its last index; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run an index seen in the run, an n that changes and an index at or above n are refused and never handed on; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run the run belongs to its mount: after update() a figure with no new call is refused; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 1048575 and 1048576 decoded bytes are handed on, 1048577 is refused and never handed on; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run sixteen figures of 1048576 bytes pass; one more byte is refused by the total while within its own cap, and is not handed on; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a refused figure takes none of the total: a refused big figure leaves room for the next; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 64 figures are handed on and a 65th is refused (n of 65, and a figure past the end of a run of 64), under the buckets: 16 a second, none refused by the rate |
| P2j | printFigures waits for ready | `printFigures()` posts, and opens its run, before the frame is ready | `src/host/mount.ts` | red: 1 failed \| 377 passed (378). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run before ready it posts nothing, queues nothing and opens no run: a figure after ready is refused |
| P2k | n is the run's | an `n` that differs from the run's is accepted | `src/host/parse.ts` | red: 3 failed \| 375 passed (378). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run an index seen in the run, an n that changes and an index at or above n are refused and never handed on; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure n different from its run; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded n must equal the run's once the run has one, and a run with no figure yet takes any n |
| P2l | i and n are canonical decimals | `i` and `n` may carry leading zeros (the grammar is any one to three digits) | `src/host/parse.ts` | red: 3 failed \| 375 passed (378). L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure i with a leading zero; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure n with a leading zero; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded i and n are canonical decimals: a leading zero, a sign, a point, an exponent, a space, a fourth digit and the empty text are 'type' |
| P2m | place needs bridge.places | a `place` is accepted by a mount that did not ask for places | `src/host/parse.ts` | red: 3 failed \| 375 passed (378). docserver parity T2: the adapters, the seed and the three commands place and the hash entry a place sent to a host with no onPlace is refused and counted, never handed on (a frame that was not asked); L3.H3 every frame-to-parent case of conformance/bridge-cases.json place when the parent did not ask for places; docserver parity T2: place, and a hash's push and from, are the mount's request (bridge.places) without bridge.places a place is 'unknown-op', whatever the context's run, and with no context at all |
| P2n | place kind is in the list | a `place` of any kind is accepted | `src/host/parse.ts` | red: 3 failed \| 375 passed (378). docserver parity T2: the adapters, the seed and the three commands place and the hash entry a kind outside the list is refused and never handed on; sixteen refusals close the frame; L3.H3 every frame-to-parent case of conformance/bridge-cases.json place with a kind outside the list; docserver parity T2: place, and a hash's push and from, are the mount's request (bridge.places) a place with a bad key set is a keys refusal before the gate, and a kind outside the list is a type refusal |
| P2o | command() runs the four tools only | `command()` also accepts `close-overlay`, `goto` and `print-figures` at run time | `src/host/mount.ts` | red: 1 failed \| 377 passed (378). docserver parity T2: the adapters, the seed and the three commands DocFrame.command is the four tools only goto, close-overlay and print-figures throw a TypeError whose message lists the four, whatever the state, and post nothing |
| P2p | closeOverlay needs onPlace | `closeOverlay()` does not throw without `onPlace` | `src/host/mount.ts` | red: 1 failed \| 377 passed (378). docserver parity T2: the adapters, the seed and the three commands closeOverlay() a host with no onPlace gets a TypeError, before ready, after ready and after destroy() |
| P2q | goto id is in the fragment grammar | `goto()` does not check its id | `src/host/mount.ts` | red: 1 failed \| 377 passed (378). docserver parity T2: the adapters, the seed and the three commands goto(id, from?) an id outside the fragment grammar, or a from that is no token, throws a TypeError in every state and posts nothing |
| P2r | goto from is a position token | `goto()` does not check its from | `src/host/mount.ts` | red: 1 failed \| 377 passed (378). docserver parity T2: the adapters, the seed and the three commands goto(id, from?) an id outside the fragment grammar, or a from that is no token, throws a TypeError in every state and posts nothing |
| P2s | goto needs onPlace | `goto()` does not throw without `onPlace` | `src/host/mount.ts` | red: 1 failed \| 377 passed (378). docserver parity T2: the adapters, the seed and the three commands goto(id, from?) does nothing before ready (not queued), after destroy() and after a fallback; a host with no onPlace gets a TypeError |
| P2t | printFigures needs onPrintFigure | `printFigures()` does not throw without `onPrintFigure` | `src/host/mount.ts` | red: 1 failed \| 377 passed (378). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run needs onPrintFigure: a TypeError in every state, and nothing posted |
| P2u | the text is bounded before it is scanned | the length bound before the alphabet scan is removed (any length is read) | `src/host/parse.ts` | red: 2 failed \| 376 passed (378). L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure png of 1398105 characters that is not base64; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded a text longer than the longest a 1 MiB figure can have is oversize before its alphabet is read; up to that length it is read |
| P2v | an empty text is no figure | an empty `png` is accepted as zero bytes | `src/host/parse.ts` | red: 2 failed \| 376 passed (378). L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure with an empty png; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded an empty text is no PNG: a 'type' refusal, after the run and the index and before any size |
| P2w | the mount keeps the size the parser read | the mount's run total takes 0 for every figure instead of the parser's byte count | `src/host/mount.ts` | red: 2 failed \| 376 passed (378). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run sixteen figures of 1048576 bytes pass; one more byte is refused by the total while within its own cap, and is not handed on; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a refused figure takes none of the total: a refused big figure leaves room for the next |

## Choices

- **Where the verdicts that depend on state live.** `parseBridgeMessage` takes an optional fourth argument, a `ParseContext` (`places`, and the open print run: `n`, the indexes seen, the bytes taken). It stays pure and keeps nothing; the mount keeps the run and passes it in. Without a context the parser is a mount that asked for neither, which is what a 1.1 caller is. `conformance/bridge-cases.json` records the same state per case as an optional `given`.
- **Reasons.** No new reason: a `place` or `print-figure` the mount did not ask for is `unknown-op`; a hash's `push` or `from` without `bridge.places` is `keys`; a value outside its grammar or its run is `type`; a `from` over 4096 code units, a figure over 1 MiB and a run over 16 MiB are `oversize`.
- **The run.** It opens at `printFigures()` once ready, takes its `n` from its first accepted figure, and is updated only for a figure that passed the limiter and is handed on (before the adapter is called); it ends at `i = n - 1`, at the next `printFigures()` and with the mount (revised at Task 6's review: the run no longer ends at `i = n - 1`; see plan choice B5). The brief's "the host's deadline" has no adapter or option in this task, so a run the frame never finishes stays open until one of the other three.
- **Focus.** `closeOverlay()`, `goto()` and `printFigures()` move no focus (`command()` still does).
- **Review minors.** The figure's text is refused as `oversize` when longer than 4 * ceil(1048576 / 3) = 1398104 characters, before the alphabet scan (after the index checks, so the order of the brief stands for the rest); an empty text is a `type` refusal; an accepted figure's parse result carries `bytes` (the size the parser read), which the mount adds to the run, so the text is scanned once. A run still ends at `i = n - 1` (B5 as written).

```json
[
  {
    "id": "P2a",
    "guard": "bridge.places is set only by onPlace",
    "edit": "`bridge.places` is seeded true whether or not `onPlace` is given",
    "file": "src/host/mount.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 4,
    "passed": 374,
    "total": 378,
    "red": [
      "L3.D5 host half, the Mermaid gate and the bridge switches (Reference \u00a711.1 steps 2 and 5) the bridge switches follow which adapters exist",
      "L3.D5 host half, the Mermaid gate and the bridge switches (Reference \u00a711.1 steps 2 and 5) B7.2: progress is switched on by onProgress alone, and by nothing else (B7i)",
      "docserver parity T2: the adapters, the seed and the three commands the seed a 1.1-shaped host (neither new adapter) seeds both switches false, and its onHash is called with one argument",
      "docserver parity T2: the adapters, the seed and the three commands the seed onPlace switches places on and by itself; onPrintFigure switches printFigures on and by itself; both together"
    ]
  },
  {
    "id": "P2b",
    "guard": "push needs bridge.places",
    "edit": "a hash's `push` is accepted without `bridge.places` (only `from` is gated)",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 375,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands place and the hash entry without onPlace a hash with push or from is refused and counted, and a plain hash still reaches onHash with the id alone",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json hash with push and without bridge.places",
      "docserver parity T2: place, and a hash's push and from, are the mount's request (bridge.places) without bridge.places either key is a 'keys' refusal, a valid value included (and with no context at all)"
    ]
  },
  {
    "id": "P2c",
    "guard": "from is a position token",
    "edit": "a hash's `from` is not checked against `isAnchorToken`",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 4,
    "passed": 374,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands place and the hash entry a push or a from that is not valid is refused, never handed on",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json hash with a from that is no token",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json hash with a from whose y is below zero",
      "docserver parity T2: place, and a hash's push and from, are the mount's request (bridge.places) push is the literal 'true' (a type refusal otherwise) and from is a position token (type), at most 4096 code units (oversize)"
    ]
  },
  {
    "id": "P2d",
    "guard": "size is read with its padding",
    "edit": "the figure's size is taken from the text's length alone, `length / 4 * 3`, without the padding",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 16,
    "passed": 362,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 1048575 and 1048576 decoded bytes are handed on, 1048577 is refused and never handed on",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run sixteen figures of 1048576 bytes pass; one more byte is refused by the total while within its own cap, and is not handed on",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a refused figure takes none of the total: a refused big figure leaves room for the next",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure the first of three",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure the second of three",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure the last of three",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure an index other than 0 first",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure the only one",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure the 64th of 64",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure without bridge.places is judged by its run alone",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure of 1048576 decoded bytes",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure that brings a run to exactly 16777216 decoded bytes",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded an index seen in the run is refused, however many figures follow",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded 1048575 and 1048576 decoded bytes pass, 1048577 is oversize: the size is read from the length and the padding",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the run total: the run plus the figure may reach 16777216 and not one byte more",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded an accepted figure reports its decoded size, read once from its text; no other op carries a size"
    ]
  },
  {
    "id": "P2e",
    "guard": "the run total is capped",
    "edit": "the check of the run's total plus the figure is removed",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 5,
    "passed": 373,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run sixteen figures of 1048576 bytes pass; one more byte is refused by the total while within its own cap, and is not handed on",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a refused figure takes none of the total: a refused big figure leaves room for the next",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure that takes a run one byte over 16777216 decoded bytes",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the order of the checks: the index before the text, the text before its size, the size before the total",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the run total: the run plus the figure may reach 16777216 and not one byte more"
    ]
  },
  {
    "id": "P2f",
    "guard": "at most 64 figures",
    "edit": "`n` is no longer bounded by `printFiguresMax`, so a 65th figure of a run of 65 is accepted",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 375,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 64 figures are handed on and a 65th is refused (n of 65, and a figure past the end of a run of 64), under the buckets: 16 a second, none refused by the rate",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure n of 65",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded 0 <= i < n <= 64: n of 64 and i of 63 pass; n of 65, n of 0, i equal to n and i above n are refused"
    ]
  },
  {
    "id": "P2g",
    "guard": "an index is taken once",
    "edit": "an `i` already seen in the run is accepted again",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 4,
    "passed": 374,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run an index seen in the run, an n that changes and an index at or above n are refused and never handed on",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure i already seen",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded an index seen in the run is refused, however many figures follow",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the order of the checks: the index before the text, the text before its size, the size before the total"
    ]
  },
  {
    "id": "P2h",
    "guard": "a figure needs an open run",
    "edit": "a figure with no open run is judged against an empty run and accepted",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 7,
    "passed": 371,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run before ready it posts nothing, queues nothing and opens no run: a figure after ready is refused",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a figure with no run is refused, never handed on, and counted (the sixteenth closes the frame)",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a figure reaches onPrintFigure as {i, n, png}: i and n numbers, the text unchanged; the run ends at its last index",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run the run belongs to its mount: after update() a figure with no new call is refused",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure with no open run",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded no open run is the first refusal, before the index, the size or the total are looked at",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded an empty text is no PNG: a 'type' refusal, after the run and the index and before any size"
    ]
  },
  {
    "id": "P2i",
    "guard": "a refused figure is not handed on",
    "edit": "a refused `print-figure` is still handed to `onPrintFigure` before the refusal is counted",
    "file": "src/host/mount.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 9,
    "passed": 369,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run before ready it posts nothing, queues nothing and opens no run: a figure after ready is refused",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a figure with no run is refused, never handed on, and counted (the sixteenth closes the frame)",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a figure reaches onPrintFigure as {i, n, png}: i and n numbers, the text unchanged; the run ends at its last index",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run an index seen in the run, an n that changes and an index at or above n are refused and never handed on",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run the run belongs to its mount: after update() a figure with no new call is refused",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 1048575 and 1048576 decoded bytes are handed on, 1048577 is refused and never handed on",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run sixteen figures of 1048576 bytes pass; one more byte is refused by the total while within its own cap, and is not handed on",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a refused figure takes none of the total: a refused big figure leaves room for the next",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 64 figures are handed on and a 65th is refused (n of 65, and a figure past the end of a run of 64), under the buckets: 16 a second, none refused by the rate"
    ]
  },
  {
    "id": "P2j",
    "guard": "printFigures waits for ready",
    "edit": "`printFigures()` posts, and opens its run, before the frame is ready",
    "file": "src/host/mount.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 377,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run before ready it posts nothing, queues nothing and opens no run: a figure after ready is refused"
    ]
  },
  {
    "id": "P2k",
    "guard": "n is the run's",
    "edit": "an `n` that differs from the run's is accepted",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 375,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run an index seen in the run, an n that changes and an index at or above n are refused and never handed on",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure n different from its run",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded n must equal the run's once the run has one, and a run with no figure yet takes any n"
    ]
  },
  {
    "id": "P2l",
    "guard": "i and n are canonical decimals",
    "edit": "`i` and `n` may carry leading zeros (the grammar is any one to three digits)",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 375,
    "total": 378,
    "red": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure i with a leading zero",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure n with a leading zero",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded i and n are canonical decimals: a leading zero, a sign, a point, an exponent, a space, a fourth digit and the empty text are 'type'"
    ]
  },
  {
    "id": "P2m",
    "guard": "place needs bridge.places",
    "edit": "a `place` is accepted by a mount that did not ask for places",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 375,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands place and the hash entry a place sent to a host with no onPlace is refused and counted, never handed on (a frame that was not asked)",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json place when the parent did not ask for places",
      "docserver parity T2: place, and a hash's push and from, are the mount's request (bridge.places) without bridge.places a place is 'unknown-op', whatever the context's run, and with no context at all"
    ]
  },
  {
    "id": "P2n",
    "guard": "place kind is in the list",
    "edit": "a `place` of any kind is accepted",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 375,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands place and the hash entry a kind outside the list is refused and never handed on; sixteen refusals close the frame",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json place with a kind outside the list",
      "docserver parity T2: place, and a hash's push and from, are the mount's request (bridge.places) a place with a bad key set is a keys refusal before the gate, and a kind outside the list is a type refusal"
    ]
  },
  {
    "id": "P2o",
    "guard": "command() runs the four tools only",
    "edit": "`command()` also accepts `close-overlay`, `goto` and `print-figures` at run time",
    "file": "src/host/mount.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 377,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands DocFrame.command is the four tools only goto, close-overlay and print-figures throw a TypeError whose message lists the four, whatever the state, and post nothing"
    ]
  },
  {
    "id": "P2p",
    "guard": "closeOverlay needs onPlace",
    "edit": "`closeOverlay()` does not throw without `onPlace`",
    "file": "src/host/mount.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 377,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands closeOverlay() a host with no onPlace gets a TypeError, before ready, after ready and after destroy()"
    ]
  },
  {
    "id": "P2q",
    "guard": "goto id is in the fragment grammar",
    "edit": "`goto()` does not check its id",
    "file": "src/host/mount.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 377,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands goto(id, from?) an id outside the fragment grammar, or a from that is no token, throws a TypeError in every state and posts nothing"
    ]
  },
  {
    "id": "P2r",
    "guard": "goto from is a position token",
    "edit": "`goto()` does not check its from",
    "file": "src/host/mount.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 377,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands goto(id, from?) an id outside the fragment grammar, or a from that is no token, throws a TypeError in every state and posts nothing"
    ]
  },
  {
    "id": "P2s",
    "guard": "goto needs onPlace",
    "edit": "`goto()` does not throw without `onPlace`",
    "file": "src/host/mount.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 377,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands goto(id, from?) does nothing before ready (not queued), after destroy() and after a fallback; a host with no onPlace gets a TypeError"
    ]
  },
  {
    "id": "P2t",
    "guard": "printFigures needs onPrintFigure",
    "edit": "`printFigures()` does not throw without `onPrintFigure`",
    "file": "src/host/mount.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 377,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run needs onPrintFigure: a TypeError in every state, and nothing posted"
    ]
  },
  {
    "id": "P2u",
    "guard": "the text is bounded before it is scanned",
    "edit": "the length bound before the alphabet scan is removed (any length is read)",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 376,
    "total": 378,
    "red": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure png of 1398105 characters that is not base64",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded a text longer than the longest a 1 MiB figure can have is oversize before its alphabet is read; up to that length it is read"
    ]
  },
  {
    "id": "P2v",
    "guard": "an empty text is no figure",
    "edit": "an empty `png` is accepted as zero bytes",
    "file": "src/host/parse.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 376,
    "total": 378,
    "red": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure with an empty png",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded an empty text is no PNG: a 'type' refusal, after the run and the index and before any size"
    ]
  },
  {
    "id": "P2w",
    "guard": "the mount keeps the size the parser read",
    "edit": "the mount's run total takes 0 for every figure instead of the parser's byte count",
    "file": "src/host/mount.ts",
    "tests": "test/host-parse.test.ts, test/host-mount.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 376,
    "total": 378,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run sixteen figures of 1048576 bytes pass; one more byte is refused by the total while within its own cap, and is not handed on",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a refused figure takes none of the total: a refused big figure leaves room for the next"
    ]
  }
]
```
