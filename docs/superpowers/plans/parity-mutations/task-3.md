# Parity Task 3: mutation rows (the frame and the reader report places and obey close-overlay and goto)

Each row was measured in place on this wave's branch: the bytes of the file saved with their sha256, one edit applied, the tests named in the row run through the fleet test wrapper as `./node_modules/.bin/vitest run --maxWorkers=1 --reporter=json`, then the file restored from the saved bytes (`cp`) and its sha256 compared (each matched). The sha256 of each file as restored: `src/frame-runtime/adapters.ts` `640391ffea3cbfee94678fd7d20b6ccebb4028b4f3613487c3b15e3e7fb8af83`, `src/enhance/overlays.ts` `22cc64581bab66884cb0eeb9874a7c8a2efb251d1f26fc13ad372d3607984eb5`, `src/enhance/lifecycle.ts` `4d7cda752817dde750501507643cf273cd967a6e03cd341efc83744a6216cb0a`, `src/enhance/diagram-tools.ts` `f5d189239a4ff3b612408c13e0ea3e75976c1ba460ab7c0139628513604b57bf`, `src/frame-runtime/outbox.ts` `dbe5fd47a7694a47be86a46c2aece6667d6046775fdf22a262d72b23a9e74621`. Every row exited 1. Every row runs `test/enhance-frame-wire.test.ts`, `test/enhance-nav.test.ts` and `test/frame-outbox.test.ts` (96 tests); P3d also runs `test/browser/frame-places.test.ts` in Chromium (98 tests). The brief's rows are P3a to P3e; P3f to P3n are the other guards this task adds.

| Row | Guard | Edit | File | Result |
|---|---|---|---|---|
| P3a | the place adapter exists only with bridge.places | `onPlace` is built whether or not the seed's `bridge.places` is on | `src/frame-runtime/adapters.ts` | red: 1 failed \| 95 passed (96). with bridge.places false: hash is exactly batch 1.1's, and there is no place adapter |
| P3b | a close the host asked for is not reported | the registry reports an `overlay-closed` for a close made by `closeQuiet` as well | `src/enhance/overlays.ts` | red: 2 failed \| 94 passed (96). the overlay registry reports a place for the figure only closeQuiet() closes the figure without a report of its own; not live, it reports nothing; through the reader (jsdom) open, close-overlay: overlay and nothing more; the overlay is closed; a second close-overlay is false |
| P3c | only a push carries push and from | a hash carries `push` (and its `from`) for any move that has an entry, scroll-spy and the section keys included | `src/frame-runtime/adapters.ts` | red: 1 failed \| 95 passed (96). with bridge.places: a jump sends push and a from the reader accepts; a move that is not a push sends neither |
| P3d | goto passes its from on | `goto` ignores `from` and goes to `id` alone | `src/enhance/lifecycle.ts` | red: 2 failed \| 95 passed (98). a real jump's from, passed back through goto, lands on the place left within a pixel; a rejected from lands on the id; a real jump's from, passed back through goto, lands on the place left and calls no onHash |
| P3e | only the figure is a place | the registry's place kinds are the figure and the keys sheet | `src/enhance/overlays.ts` | red: 1 failed \| 95 passed (96). the overlay registry reports a place for the figure only report() tells the host for the figure, once per change, and for no other kind |
| P3f | from is a position token | a hash's `from` is sent without the `isAnchorToken` check | `src/frame-runtime/adapters.ts` | red: 1 failed \| 95 passed (96). with bridge.places: a jump sends push and a from the reader accepts; a move that is not a push sends neither |
| P3g | the place kind is one of the two | `onPlace` sends any kind it is given | `src/frame-runtime/adapters.ts` | red: 1 failed \| 95 passed (96). with bridge.places: onPlace sends the two kinds and nothing else |
| P3h | one report per change | the registry reports every open and every close it is told of, repeats included | `src/enhance/overlays.ts` | red: 1 failed \| 95 passed (96). the overlay registry reports a place for the figure only report() tells the host for the figure, once per change, and for no other kind |
| P3i | goto's from is a string | `goto` accepts a `from` of any type (an array, a number) | `src/enhance/lifecycle.ts` | red: 1 failed \| 95 passed (96). a malformed argument, a missing one and a root that is not enhanced answer false and move nothing |
| P3j | a place is never coalesced before ready | the pre-ready queue coalesces a place with the one before it, as it does a hash | `src/frame-runtime/outbox.ts` | red: 1 failed \| 95 passed (96). before ready two places both survive the queue, in order, with the hash between them |
| P3k | close-overlay is the host's own close | `close-overlay` closes through `close`, which reports, instead of `closeQuiet` | `src/enhance/diagram-tools.ts` | red: 1 failed \| 95 passed (96). through the reader (jsdom) open, close-overlay: overlay and nothing more; the overlay is closed; a second close-overlay is false |
| P3l | the figure's close is reported | the figure overlay's close no longer reports `overlay-closed` | `src/enhance/diagram-tools.ts` | red: 2 failed \| 94 passed (96). through the reader (jsdom) open, Esc: overlay, then one overlay-closed; through the reader (jsdom) open, the Close button: one overlay-closed; opened again, reported again |
| P3m | the figure's open is reported | the figure overlay's open no longer reports `overlay` | `src/enhance/diagram-tools.ts` | red: 3 failed \| 93 passed (96). through the reader (jsdom) open, Esc: overlay, then one overlay-closed; through the reader (jsdom) open, the Close button: one overlay-closed; opened again, reported again; through the reader (jsdom) open, close-overlay: overlay and nothing more; the overlay is closed; a second close-overlay is false |
| P3n | a place leaves the pre-ready queue through the pacer | open() sends a queued place to a coalescing lane that does not exist for it | `src/frame-runtime/outbox.ts` | red: 1 failed \| 95 passed (96). before ready two places both survive the queue, in order, with the hash between them |

## Choices

- **The registry reports; the figure tells it.** `Overlays` gains `report(kind, opened)` and `closeQuiet(kind)`. A feature calls `report` when its overlay opens or closes, by any path (Esc, Close, a reveal, an appearance refresh that closes it); the registry tells the host only for `PLACE_OVERLAYS` (the figure), once per change, and not once the instance is not live. Only the figure calls it today; the keys sheet, quick jump and the rest are not wired, so the P3e row is held by a registry unit case that reports every other kind, and a jsdom case that opens and closes the keys sheet.
- **close-overlay and goto are commands.** `COMMAND_NAMES` gains both (the wire's twin test now has `print-figures` alone in `WIRE_ONLY`), `run(name, args?)` passes the arguments through, `runEnhancementCommand(root, name, args?)` takes them. `close-overlay` is registered where the figure overlay is built, so before the first open it answers false; `goto` is registered by the lifecycle once the context exists, and checks `{ id: string, from?: string }`.
- **onPlace is a reader option** (`HOST_CALLBACKS`, `OPTION_KEYS`, `EnhanceOptions.onPlace`, `PlaceKind`), so the frame's adapter is the reader's only route to the bridge.
- **The hash op.** With `bridge.places` a push adds `push: 'true'` and a `from` that passes `isAnchorToken`; a move that is not a push (`j` and `k`) sends the id alone. The bootstrap now bundles `isAnchorToken`.
- **The outbox.** `place` joins `QueuedOp`: it is never coalesced before ready (a place kept in order with the hash) and goes through the pacer after.

```json

[
  {
    "id": "P3a",
    "guard": "the place adapter exists only with bridge.places",
    "edit": "`onPlace` is built whether or not the seed's `bridge.places` is on",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/enhance-nav.test.ts, test/frame-outbox.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 95,
    "total": 96,
    "red": [
      "with bridge.places false: hash is exactly batch 1.1's, and there is no place adapter"
    ]
  },
  {
    "id": "P3b",
    "guard": "a close the host asked for is not reported",
    "edit": "the registry reports an `overlay-closed` for a close made by `closeQuiet` as well",
    "file": "src/enhance/overlays.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/enhance-nav.test.ts, test/frame-outbox.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 94,
    "total": 96,
    "red": [
      "the overlay registry reports a place for the figure only closeQuiet() closes the figure without a report of its own; not live, it reports nothing",
      "through the reader (jsdom) open, close-overlay: overlay and nothing more; the overlay is closed; a second close-overlay is false"
    ]
  },
  {
    "id": "P3c",
    "guard": "only a push carries push and from",
    "edit": "a hash carries `push` (and its `from`) for any move that has an entry, scroll-spy and the section keys included",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/enhance-nav.test.ts, test/frame-outbox.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 95,
    "total": 96,
    "red": [
      "with bridge.places: a jump sends push and a from the reader accepts; a move that is not a push sends neither"
    ]
  },
  {
    "id": "P3d",
    "guard": "goto passes its from on",
    "edit": "`goto` ignores `from` and goes to `id` alone",
    "file": "src/enhance/lifecycle.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/enhance-nav.test.ts, test/frame-outbox.test.ts, test/browser/frame-places.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 95,
    "total": 98,
    "red": [
      "a real jump's from, passed back through goto, lands on the place left within a pixel; a rejected from lands on the id",
      "a real jump's from, passed back through goto, lands on the place left and calls no onHash"
    ]
  },
  {
    "id": "P3e",
    "guard": "only the figure is a place",
    "edit": "the registry's place kinds are the figure and the keys sheet",
    "file": "src/enhance/overlays.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/enhance-nav.test.ts, test/frame-outbox.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 95,
    "total": 96,
    "red": [
      "the overlay registry reports a place for the figure only report() tells the host for the figure, once per change, and for no other kind"
    ]
  },
  {
    "id": "P3f",
    "guard": "from is a position token",
    "edit": "a hash's `from` is sent without the `isAnchorToken` check",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/enhance-nav.test.ts, test/frame-outbox.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 95,
    "total": 96,
    "red": [
      "with bridge.places: a jump sends push and a from the reader accepts; a move that is not a push sends neither"
    ]
  },
  {
    "id": "P3g",
    "guard": "the place kind is one of the two",
    "edit": "`onPlace` sends any kind it is given",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/enhance-nav.test.ts, test/frame-outbox.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 95,
    "total": 96,
    "red": [
      "with bridge.places: onPlace sends the two kinds and nothing else"
    ]
  },
  {
    "id": "P3h",
    "guard": "one report per change",
    "edit": "the registry reports every open and every close it is told of, repeats included",
    "file": "src/enhance/overlays.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/enhance-nav.test.ts, test/frame-outbox.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 95,
    "total": 96,
    "red": [
      "the overlay registry reports a place for the figure only report() tells the host for the figure, once per change, and for no other kind"
    ]
  },
  {
    "id": "P3i",
    "guard": "goto's from is a string",
    "edit": "`goto` accepts a `from` of any type (an array, a number)",
    "file": "src/enhance/lifecycle.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/enhance-nav.test.ts, test/frame-outbox.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 95,
    "total": 96,
    "red": [
      "a malformed argument, a missing one and a root that is not enhanced answer false and move nothing"
    ]
  },
  {
    "id": "P3j",
    "guard": "a place is never coalesced before ready",
    "edit": "the pre-ready queue coalesces a place with the one before it, as it does a hash",
    "file": "src/frame-runtime/outbox.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/enhance-nav.test.ts, test/frame-outbox.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 95,
    "total": 96,
    "red": [
      "before ready two places both survive the queue, in order, with the hash between them"
    ]
  },
  {
    "id": "P3k",
    "guard": "close-overlay is the host's own close",
    "edit": "`close-overlay` closes through `close`, which reports, instead of `closeQuiet`",
    "file": "src/enhance/diagram-tools.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/enhance-nav.test.ts, test/frame-outbox.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 95,
    "total": 96,
    "red": [
      "through the reader (jsdom) open, close-overlay: overlay and nothing more; the overlay is closed; a second close-overlay is false"
    ]
  },
  {
    "id": "P3l",
    "guard": "the figure's close is reported",
    "edit": "the figure overlay's close no longer reports `overlay-closed`",
    "file": "src/enhance/diagram-tools.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/enhance-nav.test.ts, test/frame-outbox.test.ts",
    "rc": 1,
    "failed": 2,
    "passed": 94,
    "total": 96,
    "red": [
      "through the reader (jsdom) open, Esc: overlay, then one overlay-closed",
      "through the reader (jsdom) open, the Close button: one overlay-closed; opened again, reported again"
    ]
  },
  {
    "id": "P3m",
    "guard": "the figure's open is reported",
    "edit": "the figure overlay's open no longer reports `overlay`",
    "file": "src/enhance/diagram-tools.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/enhance-nav.test.ts, test/frame-outbox.test.ts",
    "rc": 1,
    "failed": 3,
    "passed": 93,
    "total": 96,
    "red": [
      "through the reader (jsdom) open, Esc: overlay, then one overlay-closed",
      "through the reader (jsdom) open, the Close button: one overlay-closed; opened again, reported again",
      "through the reader (jsdom) open, close-overlay: overlay and nothing more; the overlay is closed; a second close-overlay is false"
    ]
  },
  {
    "id": "P3n",
    "guard": "a place leaves the pre-ready queue through the pacer",
    "edit": "open() sends a queued place to a coalescing lane that does not exist for it",
    "file": "src/frame-runtime/outbox.ts",
    "tests": "test/enhance-frame-wire.test.ts, test/enhance-nav.test.ts, test/frame-outbox.test.ts",
    "rc": 1,
    "failed": 1,
    "passed": 95,
    "total": 96,
    "red": [
      "before ready two places both survive the queue, in order, with the hash between them"
    ]
  }
]
```
