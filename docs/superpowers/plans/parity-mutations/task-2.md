# Parity Task 2: mutation rows (the host)

Each row was measured in place on this wave's branch: the bytes of the file saved with their sha256, one edit applied, the tests named in the row run through the fleet test wrapper as `./node_modules/.bin/vitest run --maxWorkers=1 --reporter=json`, then the file restored from the saved bytes (`cp`) and its sha256 compared. The restore sha256 of each file is `src/host/mount.ts` `dbfa37202304b516cf5eb16f71fa3ce58a1b1f964eaad7ed513b1abee3582fed` and `src/host/parse.ts` `552ee593e01d53f498654b50733f9fd276c11832d34ac70bed86f100d29624e7`. Every failed test is an AssertionError. The rows of P2 are measured against both `test/host-parse.test.ts` and `test/host-mount.test.ts` (372 tests).

| Row | Guard | Edit | File | Result |
|---|---|---|---|---|
| P2a | bridge.places is set only by onPlace | `bridge.places` is seeded true whether or not `onPlace` is given | `src/host/mount.ts` | red: 4 failed \| 368 passed (372). L3.D5 host half, the Mermaid gate and the bridge switches (Reference §11.1 steps 2 and 5) the bridge switches follow which adapters exist; L3.D5 host half, the Mermaid gate and the bridge switches (Reference §11.1 steps 2 and 5) B7.2: progress is switched on by onProgress alone, and by nothing else (B7i); docserver parity T2: the adapters, the seed and the three commands the seed a 1.1-shaped host (neither new adapter) seeds both switches false, and its onHash is called with one argument; docserver parity T2: the adapters, the seed and the three commands the seed onPlace switches places on and by itself; onPrintFigure switches printFigures on and by itself; both together |
| P2b | push needs bridge.places | a hash's `push` is accepted without `bridge.places` (only `from` is gated) | `src/host/parse.ts` | red: 3 failed \| 369 passed (372). docserver parity T2: the adapters, the seed and the three commands place and the hash entry without onPlace a hash with push or from is refused and counted, and a plain hash still reaches onHash with the id alone; L3.H3 every frame-to-parent case of conformance/bridge-cases.json hash with push and without bridge.places; docserver parity T2: place, and a hash's push and from, are the mount's request (bridge.places) without bridge.places either key is a 'keys' refusal, a valid value included (and with no context at all) |
| P2c | from is a position token | a hash's `from` is not checked against `isAnchorToken` | `src/host/parse.ts` | red: 4 failed \| 368 passed (372). docserver parity T2: the adapters, the seed and the three commands place and the hash entry a push or a from that is not valid is refused, never handed on; L3.H3 every frame-to-parent case of conformance/bridge-cases.json hash with a from that is no token; L3.H3 every frame-to-parent case of conformance/bridge-cases.json hash with a from whose y is below zero; docserver parity T2: place, and a hash's push and from, are the mount's request (bridge.places) push is the literal 'true' (a type refusal otherwise) and from is a position token (type), at most 4096 code units (oversize) |
| P2d | size is read with its padding | the figure's size is taken from the text's length alone, `length / 4 * 3`, without the padding | `src/host/parse.ts` | red: 7 failed \| 365 passed (372). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 1048575 and 1048576 decoded bytes are handed on, 1048577 is refused and never handed on; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run sixteen figures of 1048576 bytes pass; one more byte is refused by the total while within its own cap, and is not handed on; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a refused figure takes none of the total: a refused big figure leaves room for the next; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure of 1048576 decoded bytes; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure that brings a run to exactly 16777216 decoded bytes; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded 1048575 and 1048576 decoded bytes pass, 1048577 is oversize: the size is read from the length and the padding; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the run total: the run plus the figure may reach 16777216 and not one byte more |
| P2e | the run total is capped | the check of the run's total plus the figure is removed | `src/host/parse.ts` | red: 5 failed \| 367 passed (372). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run sixteen figures of 1048576 bytes pass; one more byte is refused by the total while within its own cap, and is not handed on; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a refused figure takes none of the total: a refused big figure leaves room for the next; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure that takes a run one byte over 16777216 decoded bytes; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the order of the checks: the index before the text, the text before its size, the size before the total; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the run total: the run plus the figure may reach 16777216 and not one byte more |
| P2f | at most 64 figures | `n` is no longer bounded by `printFiguresMax`, so a 65th figure of a run of 65 is accepted | `src/host/parse.ts` | red: 3 failed \| 369 passed (372). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 64 figures are handed on and a 65th is refused (n of 65, and a figure past the end of a run of 64), under the buckets: 16 a second, none refused by the rate; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure n of 65; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded 0 <= i < n <= 64: n of 64 and i of 63 pass; n of 65, n of 0, i equal to n and i above n are refused |
| P2g | an index is taken once | an `i` already seen in the run is accepted again | `src/host/parse.ts` | red: 4 failed \| 368 passed (372). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run an index seen in the run, an n that changes and an index at or above n are refused and never handed on; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure i already seen; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded an index seen in the run is refused, however many figures follow; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the order of the checks: the index before the text, the text before its size, the size before the total |
| P2h | a figure needs an open run | a figure with no open run is judged against an empty run and accepted | `src/host/parse.ts` | red: 6 failed \| 366 passed (372). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run before ready it posts nothing, queues nothing and opens no run: a figure after ready is refused; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a figure with no run is refused, never handed on, and counted (the sixteenth closes the frame); docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a figure reaches onPrintFigure as {i, n, png}: i and n numbers, the text unchanged; the run ends at its last index; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run the run belongs to its mount: after update() a figure with no new call is refused; L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure with no open run; docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded no open run is the first refusal, before the index, the size or the total are looked at |
| P2i | a refused figure is not handed on | a refused `print-figure` is still handed to `onPrintFigure` before the refusal is counted | `src/host/mount.ts` | red: 9 failed \| 363 passed (372). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run before ready it posts nothing, queues nothing and opens no run: a figure after ready is refused; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a figure with no run is refused, never handed on, and counted (the sixteenth closes the frame); docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a figure reaches onPrintFigure as {i, n, png}: i and n numbers, the text unchanged; the run ends at its last index; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run an index seen in the run, an n that changes and an index at or above n are refused and never handed on; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run the run belongs to its mount: after update() a figure with no new call is refused; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 1048575 and 1048576 decoded bytes are handed on, 1048577 is refused and never handed on; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run sixteen figures of 1048576 bytes pass; one more byte is refused by the total while within its own cap, and is not handed on; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a refused figure takes none of the total: a refused big figure leaves room for the next; docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 64 figures are handed on and a 65th is refused (n of 65, and a figure past the end of a run of 64), under the buckets: 16 a second, none refused by the rate |
| P2j | printFigures waits for ready | `printFigures()` posts, and opens its run, before the frame is ready | `src/host/mount.ts` | red: 1 failed \| 371 passed (372). docserver parity T2: the adapters, the seed and the three commands printFigures() and the run before ready it posts nothing, queues nothing and opens no run: a figure after ready is refused |

## Choices

- **Where the verdicts that depend on state live.** `parseBridgeMessage` takes an optional fourth argument, a `ParseContext` (`places`, and the open print run: `n`, the indexes seen, the bytes taken). It stays pure and keeps nothing; the mount keeps the run and passes it in. Without a context the parser is a mount that asked for neither, which is what a 1.1 caller is. `conformance/bridge-cases.json` records the same state per case as an optional `given`.
- **Reasons.** No new reason: a `place` or `print-figure` the mount did not ask for is `unknown-op`; a hash's `push` or `from` without `bridge.places` is `keys`; a value outside its grammar or its run is `type`; a `from` over 4096 code units, a figure over 1 MiB and a run over 16 MiB are `oversize`.
- **The run.** It opens at `printFigures()` once ready, takes its `n` from its first accepted figure, and is updated only for a figure that passed the limiter and is handed on (before the adapter is called); it ends at `i = n - 1`, at the next `printFigures()` and with the mount. The brief's "the host's deadline" has no adapter or option in this task, so a run the frame never finishes stays open until one of the other three.
- **Focus.** `closeOverlay()`, `goto()` and `printFigures()` move no focus (`command()` still does).

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
    "passed": 368,
    "total": 372,
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
    "passed": 369,
    "total": 372,
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
    "passed": 368,
    "total": 372,
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
    "failed": 7,
    "passed": 365,
    "total": 372,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run 1048575 and 1048576 decoded bytes are handed on, 1048577 is refused and never handed on",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run sixteen figures of 1048576 bytes pass; one more byte is refused by the total while within its own cap, and is not handed on",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a refused figure takes none of the total: a refused big figure leaves room for the next",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure of 1048576 decoded bytes",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure that brings a run to exactly 16777216 decoded bytes",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded 1048575 and 1048576 decoded bytes pass, 1048577 is oversize: the size is read from the length and the padding",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded the run total: the run plus the figure may reach 16777216 and not one byte more"
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
    "passed": 367,
    "total": 372,
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
    "passed": 369,
    "total": 372,
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
    "passed": 368,
    "total": 372,
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
    "failed": 6,
    "passed": 366,
    "total": 372,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run before ready it posts nothing, queues nothing and opens no run: a figure after ready is refused",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a figure with no run is refused, never handed on, and counted (the sixteenth closes the frame)",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run a figure reaches onPrintFigure as {i, n, png}: i and n numbers, the text unchanged; the run ends at its last index",
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run the run belongs to its mount: after update() a figure with no new call is refused",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json print-figure with no open run",
      "docserver parity T2: a print-figure is judged against the open run, in the brief's order, and its text is never decoded no open run is the first refusal, before the index, the size or the total are looked at"
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
    "passed": 363,
    "total": 372,
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
    "passed": 371,
    "total": 372,
    "red": [
      "docserver parity T2: the adapters, the seed and the three commands printFigures() and the run before ready it posts nothing, queues nothing and opens no run: a figure after ready is refused"
    ]
  }
]
```
