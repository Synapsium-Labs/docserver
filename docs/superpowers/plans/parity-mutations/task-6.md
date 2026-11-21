# Parity Task 6: mutation rows (the lost jump push in the outbox)

Each row was measured in place on this wave's branch: the bytes of the file saved with their sha256, one edit applied, the tests named in the row run through the fleet test wrapper as `./node_modules/.bin/vitest run --maxWorkers=1 --reporter=json`, then the file restored from the saved bytes (`cp`) and its sha256 compared (each matched). The sha256 of each file as restored: `src/frame-runtime/outbox.ts` `b5d048360d5cea7b49203857fce5c2515d400254ee80fa1947465960bf13db46`. Every row exited 1. The coordinator's ruling added the lost jump push to this task (a real defect, fixed red-first with its own rows J6a to J6e); the print-figures rows follow in the task's own commit.

| Row | Guard | Edit | File | Result |
|---|---|---|---|---|
| J6a | a jump push survives a following move | trail keeps only the latest hash op, as before | `src/frame-runtime/outbox.ts` | red: 3 failed \| 23 passed (26). the outbox after ready: the pacer a push followed within the window by a move that is not a push still posts one hash with push, and the place the reader left (docserver parity T6) ; the outbox after ready: the pacer two pushes in one window post one hash: the latest id, the first from ; the outbox after ready: the pacer a first push with no from stays a push with none, a later push's from is not borrowed; moves alone stay moves |
| J6b | the from of a merged push is the first push's | the merged hash takes the latest op's from | `src/frame-runtime/outbox.ts` | red: 3 failed \| 23 passed (26). the outbox after ready: the pacer a push followed within the window by a move that is not a push still posts one hash with push, and the place the reader left (docserver parity T6) ; the outbox after ready: the pacer two pushes in one window post one hash: the latest id, the first from ; the outbox after ready: the pacer a first push with no from stays a push with none, a later push's from is not borrowed; moves alone stay moves |
| J6c | the merged hash goes to the latest id | the merged hash keeps the first op's id | `src/frame-runtime/outbox.ts` | red: 3 failed \| 23 passed (26). the outbox after ready: the pacer a push followed within the window by a move that is not a push still posts one hash with push, and the place the reader left (docserver parity T6) ; the outbox after ready: the pacer two pushes in one window post one hash: the latest id, the first from ; the outbox after ready: the pacer a first push with no from stays a push with none, a later push's from is not borrowed; moves alone stay moves |
| J6d | the first push's from survives a second push | a push arriving over a held push replaces it whole | `src/frame-runtime/outbox.ts` | red: 2 failed \| 24 passed (26). the outbox after ready: the pacer two pushes in one window post one hash: the latest id, the first from ; the outbox after ready: the pacer a first push with no from stays a push with none, a later push's from is not borrowed; moves alone stay moves |
| J6e | a move after a move stays a move | any held hash makes the merged one a push | `src/frame-runtime/outbox.ts` | red: 2 failed \| 24 passed (26). the outbox after ready: the pacer hash coalesces over 100 ms: the latest id once the window ends ; the outbox after ready: the pacer a first push with no from stays a push with none, a later push's from is not borrowed; moves alone stay moves |

## Choices

- **The defect.** `trail()` kept only the latest `hash` op of its 100 ms window, so a jump's `hash { id, push: 'true', from }` followed within 100 ms by a move that is not a push (the `j` and `k` keys, the changes stepper) was dropped, and the host pushed no history entry.
- **The fix.** When the window already holds a push, the one op posted is the latest `id` with `push: 'true'` and the `from` of the first push (the place the reader left); a push with no `from` stays a push with none. A window of moves alone is as before: the latest op. The pre-ready queue still coalesces a hash by replacing it (a jump is not asked for before ready).

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
  }
]
```
