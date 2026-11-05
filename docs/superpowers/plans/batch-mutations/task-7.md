# Batch Task 7: mutation rows (the bridge for one bar: `command`, `progress`, `DocFrame.command`, `onProgress`)

## History of the evidence

1. RED. Step 1 wrote the tests before the code. The RED run used the code as it stood before the task (the sources of the previous commit, with the new tests and fixtures laid over them) in a scratch copy of the tree: `./node_modules/.bin/vitest run --maxWorkers=2 test/frame-protocol.test.ts test/frame-runtime.test.ts test/frame-outbox.test.ts test/host-parse.test.ts test/host-mount.test.ts` gave `61 failed | 463 passed (524)`, every file red, on assertions (the new exports read as undefined). Only those five files were run red: the new cases of `test/frame-document.test.ts` (B7.2), `test/frame-seed.test.ts` (B7.6), `test/enhance-mermaid-on-request.test.ts` (B7.8), `test/host-walls.test.ts` and `test/readme.test.ts` have no separate RED run; rows B7l, B7m and B7n are red evidence for B7.2, B7.8 and the walls.
2. First GREEN run (the Verify list without `frame-document`): `2 failed | 891 passed (893)`. Both were faults of two new cases, not of the code, and both tests were edited, each stronger or no weaker: `test/frame-outbox.test.ts`, the pre-ready case, whose `clock.advance(250)` was an absolute time already passed (now `advance(1249)` asserting nothing yet, then `advance(1250)` asserting the second value); `test/frame-protocol.test.ts`, the B7.5 regex, which did not match the fixture's own wording. A third edit followed the typecheck (`as never` on a deliberately unknown adapter key in `test/host-mount.test.ts`). After that the Verify list, the package, pack, manifest, build, purity and consumer-smoke tests and a last check of five files (`442 passed`) were green.
3. Fix round 1 (this record's second measurement): the frame's routing of a parent message moved to `src/frame-runtime/dispatch.ts` so that a unit case drives it (a command that throws, a missing reader, a missing root); a progress waiting in the pacer's line is replaced in place (ruling T7-b); the redundant `m.size === 2` check was removed (another key is refused by the key set above it, a missing `name` is not a string); README and the `onProgress` docstring say the frame, not the host, keeps four reports a second (ruling T7-c); the README `command` row no longer names `COMMAND_OPS`. Rows B7o to B7af were added for every guard beyond the brief's table, and every row was measured again.

## Method

Each row was measured in place on branch `ws/docserver-release-1-1`, one at a time, by a driver. For each row: the bytes of every edited file were saved and hashed; the edit (or edits, for a row that drops a chain of guards) was applied, each old text found exactly once; the named tests ran in a bounded run (`timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 <files>`, with `ulimit -u` set to the measured thread count plus 1500; row B7l ran at `--maxWorkers=1`); the edited files were restored from the saved bytes (byte copy) and each sha256 checked against the saved one. The generated outputs (`assets/assets.json`, `src/frame/manifest.generated.ts`, `assets/frame/*` and `assets/mermaid/*`) were saved once before the first row (no row rebuilds) and copied back from those bytes after every row, then hashed and compared (the JSON fence lists their sha256); `node scripts/build-frame.mjs --check` ran after each restore. A row is red only through test assertions (no compile or import failure, no suite failure). In the first measurement of rows B7a to B7n the driver only hashed the generated outputs and did not save or restore them; the outcome was the same, and this second measurement does what the rule says.

Row B7k (the `iframe.focus()` call dropped) is visible in a unit case: jsdom moves the active element and fires `focus` on an iframe, so `test/host-mount.test.ts` sees both the focus and its order before the post. It is also measured on the engines in Task 8's B8.3.

`test/frame-document.test.ts` (with `test/frame-mutants.test.ts`) runs alone at `--maxWorkers=1`: at two workers the box's memory cap can take a worker. The earlier green run of it (249 tests, exit 0) logged one out-of-memory kill in the test slice during that run; the run in the fix round (249 tests, exit 0) logged none.

## Verdicts

Rows B7a to B7p, B7r, B7t, B7u to B7y and B7aa to B7af are red through assertions. Three rows stay green and are reported as equivalent mutants (the controller rules on them; none was dropped):

- B7q: The optional call `api.runEnhancementCommand?.(…)` against a plain call: a reader without the function throws a TypeError, which the try/catch of the same function contains, so the observable result (nothing happens, the port goes on) is the same. B7o (the try/catch dropped) is red, and with it the plain call would be too.
- B7s: `if (destroyed) return;` in `command()` against none: after `destroy()` the handle `sendCommand` has been reset to a no-op (B7t is red through the retention case, B7w drops the whole chain and is red), and the mount it came from is not live, so the second check is unreachable.
- B7z: The `typeof share !== 'number'` check beside `!Number.isFinite(share)`: `Number.isFinite` does not coerce, so it is already false for a string, null or undefined, and the typeof check never decides anything alone. B7y (the isFinite check dropped) is red.

B7t and B7u (the two resets of `sendCommand`) are not equivalent: without them the `DocFrame` keeps the stopped mount's handle, and so its iframe, alive; the retention cases catch it (B4.10 for a destroy, and the new case for a destroy or an update whose document is refused). B7w and B7x drop each chain of overlapping guards together (destroyed return, destroy reset and `live`; update reset and `live`) and are red through the focus spy.

## The rows

| Row | Guard | File | Change | Red |
|---|---|---|---|---|
| B7a | command accepted | `src/frame-runtime/inbound.ts` | ` && t !== 'mermaid' && t !== 'command') return null;` → ` && t !== 'mermaid') return null;` | `test/frame-runtime.test.ts`: 2 failed \| 70 passed (72) (red) |
| B7b | known names only | `src/frame-runtime/inbound.ts` | `typeof name === 'string' && (COMMAND_OPS as readonly string[]).includes(nam…` → `typeof name === 'string' ?` | `test/frame-runtime.test.ts`: 2 failed \| 70 passed (72) (red) |
| B7c | PARENT_OPS | `src/frame/protocol.ts` | `['hello', 'prefs', 'changes.result', 'mermaid', 'command'] as const satisfi…` → `['hello', 'prefs', 'changes.result', 'mermaid'] as const satisfies` | `test/frame-protocol.test.ts`: 1 failed \| 204 passed (205) (red) |
| B7d | progress keys | `src/host/parse.ts` | `progress: Object.freeze(['p']),` → `progress: Object.freeze([]),` | `test/host-parse.test.ts`: 2 failed \| 132 passed (134) (red) |
| B7e | progress grammar | `src/frame/protocol.ts` | `export const PROGRESS_SOURCE = '^(?:0\|[1-9][0-9]{0,2}\|1000)$';` → `export const PROGRESS_SOURCE = '^(?:0\|[1-9][0-9]{0,2}\|100[01])$';` | `test/frame-protocol.test.ts (+1)`: 3 failed \| 336 passed (339) (red) |
| B7f | coalescing | `src/frame/protocol.ts` | `  progressWindowMs: 250,` → `  progressWindowMs: 0,` | `test/frame-outbox.test.ts (+1)`: 5 failed \| 221 passed (226) (red) |
| B7g | trailing edge | `src/frame-runtime/outbox.ts` | `        if (held === null \|\| disposed) {` → `        if (held === null \|\| disposed \|\| held.t === 'progress') {` | `test/frame-outbox.test.ts`: 4 failed \| 17 passed (21) (red) |
| B7h | switch-gated in the frame | `src/frame-runtime/adapters.ts` | `    ...(b.progress === true ⏎ ` → `    ...(true ⏎ ` | `test/frame-runtime.test.ts`: 3 failed \| 69 passed (72) (red) |
| B7i | switch-gated in the host | `src/host/mount.ts` | `          progress: c.callbacks.onProgress !== undefined,` → `          progress: true,` | `test/host-mount.test.ts`: 2 failed \| 98 passed (100) (red) |
| B7j | not before ready | `src/host/mount.ts` | `      if (!live \|\| !ready) return; ⏎       // The focus first` → `      if (!live) return; ⏎       // The focus first` | `test/host-mount.test.ts`: 2 failed \| 98 passed (100) (red) |
| B7k | focus | `src/host/mount.ts` | `      iframe.focus(); ⏎       post({ t: 'command', name });` → `      post({ t: 'command', name });` | `test/host-mount.test.ts`: 3 failed \| 97 passed (100) (red) |
| B7l | progress defaults off | `src/frame/document.ts` | `field(f, k, k !== 'progress')` → `field(f, k, true)` | `test/frame-document.test.ts`: 7 failed \| 216 passed (223) (red) |
| B7m | command lists equal | `src/frame/protocol.ts` | `Object.freeze(['jump', 'settings', 'contents', 'outline'] as const); ⏎ expo…` → `Object.freeze(['settings', 'contents', 'outline'] as const); ⏎ export type …` | `test/enhance-mermaid-on-request.test.ts (+1)`: 2 failed \| 238 passed (240) (red) |
| B7n | two focus sites | `src/host/mount.ts` | `    let loads = 0; ⏎     let ready = false;` → `    let loads = 0; ⏎     if (loads < 0) iframe.focus(); ⏎     let ready = f…` | `test/host-walls.test.ts`: 3 failed \| 65 passed (68) (red) |
| B7o | command call contained in the frame | `src/frame-runtime/dispatch.ts` | `      try { ⏎         api.runEnhancementCommand?.(root, m.name); ⏎       } …` → `      api.runEnhancementCommand?.(root, m.name); ⏎ ` | `test/frame-runtime.test.ts`: 1 failed \| 71 passed (72) (red) |
| B7p | command needs a root and a reader | `src/frame-runtime/dispatch.ts` | `  } else if (m.t === 'command') { ⏎     if (root !== null && api !== null) …` → `  } else if (m.t === 'command') { ⏎     if (true as boolean) {` | `test/frame-runtime.test.ts`: 1 failed \| 71 passed (72) (red) |
| B7q | command: a reader without the function (optional call) | `src/frame-runtime/dispatch.ts` | `api.runEnhancementCommand?.(root, m.name);` → `api.runEnhancementCommand(root, m.name);` | `test/frame-runtime.test.ts`: 0 failed \| 72 passed (72) (green, equivalent) |
| B7r | host: an unknown name throws a TypeError | `src/host/mount.ts` | `      if (typeof name !== 'string' \|\| !(COMMAND_OPS as readonly string[])…` → `(removed)` | `test/host-mount.test.ts`: 2 failed \| 98 passed (100) (red) |
| B7s | host: `if (destroyed) return` in command | `src/host/mount.ts` | `      if (destroyed) return; ⏎       sendCommand(name);` → `      sendCommand(name);` | `test/host-mount.test.ts`: 0 failed \| 100 passed (100) (green, equivalent) |
| B7t | host: destroy() resets sendCommand | `src/host/mount.ts` | `      sendPrefs = () => undefined; ⏎       sendCommand = () => undefined; ⏎…` → `      sendPrefs = () => undefined; ⏎     },` | `test/host-mount.test.ts`: 2 failed \| 98 passed (100) (red) |
| B7u | host: update() resets sendCommand | `src/host/mount.ts` | `      sendCommand = () => undefined; ⏎       mount(d);` → `      mount(d);` | `test/host-mount.test.ts`: 1 failed \| 99 passed (100) (red) |
| B7v | host: sendCommand checks live | `src/host/mount.ts` | `      if (!live \|\| !ready) return; ⏎       // The focus first` → `      if (!ready) return; ⏎       // The focus first` | `test/host-mount.test.ts`: 1 failed \| 99 passed (100) (red) |
| B7w | host: the after-destroy chain (destroyed return, destroy reset and the live check) dropped together | `src/host/mount.ts` | `      if (destroyed) return; ⏎       sendCommand(name);` → `      sendCommand(name);` ; `      sendPrefs = () => undefined; ⏎       sendCommand = () => undefined; ⏎…` → `      sendPrefs = () => undefined; ⏎     },` ; `      if (!live \|\| !ready) return; ⏎       // The focus first` → `      if (!ready) return; ⏎       // The focus first` | `test/host-mount.test.ts`: 4 failed \| 96 passed (100) (red) |
| B7x | host: the after-update chain (update reset and the live check) dropped together | `src/host/mount.ts` | `      sendCommand = () => undefined; ⏎       mount(d);` → `      mount(d);` ; `      if (!live \|\| !ready) return; ⏎       // The focus first` → `      if (!ready) return; ⏎       // The focus first` | `test/host-mount.test.ts`: 3 failed \| 97 passed (100) (red) |
| B7y | frame: a non-finite share sends nothing | `src/frame-runtime/adapters.ts` | `if (typeof share !== 'number' \|\| !Number.isFinite(share)) return;` → `if (typeof share !== 'number') return;` | `test/frame-runtime.test.ts`: 1 failed \| 71 passed (72) (red) |
| B7z | frame: the typeof check beside isFinite | `src/frame-runtime/adapters.ts` | `if (typeof share !== 'number' \|\| !Number.isFinite(share)) return;` → `if (!Number.isFinite(share)) return;` | `test/frame-runtime.test.ts`: 0 failed \| 72 passed (72) (green, equivalent) |
| B7aa | frame: the clamp's floor | `src/frame-runtime/adapters.ts` | `Math.min(1000, Math.max(0, Math.round(share * 1000)))` → `Math.min(1000, Math.round(share * 1000))` | `test/frame-runtime.test.ts`: 1 failed \| 71 passed (72) (red) |
| B7ab | frame: the clamp's ceiling | `src/frame-runtime/adapters.ts` | `Math.min(1000, Math.max(0, Math.round(share * 1000)))` → `Math.max(0, Math.round(share * 1000))` | `test/frame-runtime.test.ts`: 1 failed \| 71 passed (72) (red) |
| B7ac | frame: the key set of an op (an extra key on a command) | `src/frame-runtime/inbound.ts` | `  for (const k of m.keys()) if (!allowed.includes(k)) return null; ⏎   if (…` → `  if (t === 'command') {` | `test/frame-runtime.test.ts`: 5 failed \| 67 passed (72) (red) |
| B7ad | frame: dispose clears the progress timer | `src/frame-runtime/outbox.ts` | `lanes.version.timer, lanes.progress.timer, hashLane.timer]` → `lanes.version.timer, hashLane.timer]` | `test/frame-outbox.test.ts`: 1 failed \| 20 passed (21) (red) |
| B7ae | frame: the pre-ready queue keeps the latest progress | `src/frame-runtime/outbox.ts` | `x.op.t === op.t && (op.t !== 'store.set'` → `x.op.t === op.t && op.t !== 'progress' && (op.t !== 'store.set'` | `test/frame-outbox.test.ts`: 1 failed \| 20 passed (21) (red) |
| B7af | frame: a waiting progress is replaced in place in the pacer's line (ruling T7-b) | `src/frame-runtime/outbox.ts` | `if (e.kind === 'op' && (e.op.t === 'store.set' \|\| e.op.t === 'progress'))…` → `if (e.kind === 'op' && e.op.t === 'store.set') {` | `test/frame-outbox.test.ts`: 1 failed \| 20 passed (21) (red) |

```json
{
  "generatedOutputs": {
    "assets/assets.json": "1a529bbc490520bc4cc68ff1877fa97be211bf7635ca45a4f267d1506ddf102c",
    "src/frame/manifest.generated.ts": "4ce5be976c768157cdcebdb2f82ac74c05b279b5710665831e34f2327b295c71",
    "assets/frame/bootstrap.js": "dc49ce7dffeb1d2f9ebba065ec6a53ecbdf3ab1439f67c63c17763dda459c424",
    "assets/frame/enhance.js": "fc34703da82c0222c2679935defadc76d0aab72ccbbe79ee9ade558998fb86a4",
    "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
    "assets/frame/reader.css": "83176e0055183256fdd131a602f847a16a17a8944812071672550e64c8dc9e9f",
    "assets/mermaid/mermaid.frame.js": "7585b2055ba386b9acff71b9c8a0c40b36dec79c2106a4aa56048c8fe59832c3",
    "assets/mermaid/mermaid.mjs": "dfba66fc5c75e030c35bf16d5e7a62bbee7be5496cabec94ec93f85d626b38df"
  },
  "rows": [
    {
      "id": "B7a",
      "guard": "command accepted",
      "edits": [
        {
          "file": "src/frame-runtime/inbound.ts",
          "old": " && t !== 'mermaid' && t !== 'command') return null;",
          "new": " && t !== 'mermaid') return null;"
        }
      ],
      "tests": [
        "test/frame-runtime.test.ts"
      ],
      "rc": 1,
      "red": "2 failed | 70 passed (72)",
      "failing": [
        "command: exactly {name}, one of the four command names (B7a, B7b)",
        "command: every parent-to-frame fixture of the op is judged as its verdict says, by the frame's own parser (B7."
      ],
      "verdict": "red",
      "sha256": {
        "src/frame-runtime/inbound.ts": "098abeb908c9e7d88348caba522d7f66c5634b6cae8f1092c26c05da2190a814"
      },
      "sha256After": {
        "src/frame-runtime/inbound.ts": "098abeb908c9e7d88348caba522d7f66c5634b6cae8f1092c26c05da2190a814"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7b",
      "guard": "known names only",
      "edits": [
        {
          "file": "src/frame-runtime/inbound.ts",
          "old": "typeof name === 'string' && (COMMAND_OPS as readonly string[]).includes(name) ?",
          "new": "typeof name === 'string' ?"
        }
      ],
      "tests": [
        "test/frame-runtime.test.ts"
      ],
      "rc": 1,
      "red": "2 failed | 70 passed (72)",
      "failing": [
        "command: exactly {name}, one of the four command names (B7a, B7b)",
        "command: every parent-to-frame fixture of the op is judged as its verdict says, by the frame's own parser (B7."
      ],
      "verdict": "red",
      "sha256": {
        "src/frame-runtime/inbound.ts": "098abeb908c9e7d88348caba522d7f66c5634b6cae8f1092c26c05da2190a814"
      },
      "sha256After": {
        "src/frame-runtime/inbound.ts": "098abeb908c9e7d88348caba522d7f66c5634b6cae8f1092c26c05da2190a814"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7c",
      "guard": "PARENT_OPS",
      "edits": [
        {
          "file": "src/frame/protocol.ts",
          "old": "['hello', 'prefs', 'changes.result', 'mermaid', 'command'] as const satisfies",
          "new": "['hello', 'prefs', 'changes.result', 'mermaid'] as const satisfies"
        }
      ],
      "tests": [
        "test/frame-protocol.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 204 passed (205)",
      "failing": [
        "FRAME_OPS and PARENT_OPS split it by direction, with no op in both"
      ],
      "verdict": "red",
      "sha256": {
        "src/frame/protocol.ts": "2902ff3ed0b66480d13b9956076c84288f6d951a3f83e533679a83e0c7d859e5"
      },
      "sha256After": {
        "src/frame/protocol.ts": "2902ff3ed0b66480d13b9956076c84288f6d951a3f83e533679a83e0c7d859e5"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7d",
      "guard": "progress keys",
      "edits": [
        {
          "file": "src/host/parse.ts",
          "old": "progress: Object.freeze(['p']),",
          "new": "progress: Object.freeze([]),"
        }
      ],
      "tests": [
        "test/host-parse.test.ts"
      ],
      "rc": 1,
      "red": "2 failed | 132 passed (134)",
      "failing": [
        "progress without p",
        "a missing p and an extra key are 'keys'; a number, null and an array are 'type'"
      ],
      "verdict": "red",
      "sha256": {
        "src/host/parse.ts": "2ac360070d0044cd377ef00803d985d7e804b0d7c27e3bdf1871de3a6c76212c"
      },
      "sha256After": {
        "src/host/parse.ts": "2ac360070d0044cd377ef00803d985d7e804b0d7c27e3bdf1871de3a6c76212c"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7e",
      "guard": "progress grammar",
      "edits": [
        {
          "file": "src/frame/protocol.ts",
          "old": "export const PROGRESS_SOURCE = '^(?:0|[1-9][0-9]{0,2}|1000)$';",
          "new": "export const PROGRESS_SOURCE = '^(?:0|[1-9][0-9]{0,2}|100[01])$';"
        }
      ],
      "tests": [
        "test/frame-protocol.test.ts",
        "test/host-parse.test.ts"
      ],
      "rc": 1,
      "red": "3 failed | 336 passed (339)",
      "failing": [
        "the progress grammar: a string of thousandths, '0' to '1000', no sign, point, exponent, space or leading zero",
        "progress 1001",
        "every '0' to '1000' is accepted, and each string outside the grammar is a 'type' refusal"
      ],
      "verdict": "red",
      "sha256": {
        "src/frame/protocol.ts": "2902ff3ed0b66480d13b9956076c84288f6d951a3f83e533679a83e0c7d859e5"
      },
      "sha256After": {
        "src/frame/protocol.ts": "2902ff3ed0b66480d13b9956076c84288f6d951a3f83e533679a83e0c7d859e5"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7f",
      "guard": "coalescing",
      "edits": [
        {
          "file": "src/frame/protocol.ts",
          "old": "  progressWindowMs: 250,",
          "new": "  progressWindowMs: 0,"
        }
      ],
      "tests": [
        "test/frame-outbox.test.ts",
        "test/frame-protocol.test.ts"
      ],
      "rc": 1,
      "red": "5 failed | 221 passed (226)",
      "failing": [
        "the first value goes at once; the latest of the window goes when it ends, which opens the next window",
        "a scroll burst of one value a millisecond for 3 seconds sends at most 4 a second, and the final value always a",
        "before ready the queue keeps the latest progress only, and open() sends it at once, as the first of its window",
        "the parent reads its limits as token buckets, and the frame paces by a sliding window that neither reading ref",
        "the progress window is 250 ms, beside coalesceMs, and a progress share is at most 4 messages a second"
      ],
      "verdict": "red",
      "sha256": {
        "src/frame/protocol.ts": "2902ff3ed0b66480d13b9956076c84288f6d951a3f83e533679a83e0c7d859e5"
      },
      "sha256After": {
        "src/frame/protocol.ts": "2902ff3ed0b66480d13b9956076c84288f6d951a3f83e533679a83e0c7d859e5"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7g",
      "guard": "trailing edge",
      "edits": [
        {
          "file": "src/frame-runtime/outbox.ts",
          "old": "        if (held === null || disposed) {",
          "new": "        if (held === null || disposed || held.t === 'progress') {"
        }
      ],
      "tests": [
        "test/frame-outbox.test.ts"
      ],
      "rc": 1,
      "red": "4 failed | 17 passed (21)",
      "failing": [
        "the first value goes at once; the latest of the window goes when it ends, which opens the next window",
        "a scroll burst of one value a millisecond for 3 seconds sends at most 4 a second, and the final value always a",
        "ruling T7-b: with the pacer saturated by other ops, at most one progress waits in the line, and a navigate ask",
        "before ready the queue keeps the latest progress only, and open() sends it at once, as the first of its window"
      ],
      "verdict": "red",
      "sha256": {
        "src/frame-runtime/outbox.ts": "df1ce8eee1cb128a81a945e8f4c5354666931a987a039bcb3323b2ba485566ef"
      },
      "sha256After": {
        "src/frame-runtime/outbox.ts": "df1ce8eee1cb128a81a945e8f4c5354666931a987a039bcb3323b2ba485566ef"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7h",
      "guard": "switch-gated in the frame",
      "edits": [
        {
          "file": "src/frame-runtime/adapters.ts",
          "old": "    ...(b.progress === true\n",
          "new": "    ...(true\n"
        }
      ],
      "tests": [
        "test/frame-runtime.test.ts"
      ],
      "rc": 1,
      "red": "3 failed | 69 passed (72)",
      "failing": [
        "each callback exists only when the seed's bridge allows it; storage always does",
        "progress false: no onProgress, whatever else the bridge allows (B7h)",
        "a seed that predates the switch (no progress key) builds no onProgress"
      ],
      "verdict": "red",
      "sha256": {
        "src/frame-runtime/adapters.ts": "b33f08b44cd0a6757e2359c1a49bfb828890a0f58c74fa864c7a03351c112dd6"
      },
      "sha256After": {
        "src/frame-runtime/adapters.ts": "b33f08b44cd0a6757e2359c1a49bfb828890a0f58c74fa864c7a03351c112dd6"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7i",
      "guard": "switch-gated in the host",
      "edits": [
        {
          "file": "src/host/mount.ts",
          "old": "          progress: c.callbacks.onProgress !== undefined,",
          "new": "          progress: true,"
        }
      ],
      "tests": [
        "test/host-mount.test.ts"
      ],
      "rc": 1,
      "red": "2 failed | 98 passed (100)",
      "failing": [
        "the bridge switches follow which adapters exist",
        "B7.2: progress is switched on by onProgress alone, and by nothing else (B7i)"
      ],
      "verdict": "red",
      "sha256": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "sha256After": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7j",
      "guard": "not before ready",
      "edits": [
        {
          "file": "src/host/mount.ts",
          "old": "      if (!live || !ready) return;\n      // The focus first",
          "new": "      if (!live) return;\n      // The focus first"
        }
      ],
      "tests": [
        "test/host-mount.test.ts"
      ],
      "rc": 1,
      "red": "2 failed | 98 passed (100)",
      "failing": [
        "before ready it posts nothing and moves no focus (B7j)",
        "after update() the new mount is not ready: it posts nothing, on the old port or the new one, until its own rea"
      ],
      "verdict": "red",
      "sha256": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "sha256After": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7k",
      "guard": "focus",
      "edits": [
        {
          "file": "src/host/mount.ts",
          "old": "      iframe.focus();\n      post({ t: 'command', name });",
          "new": "      post({ t: 'command', name });"
        }
      ],
      "tests": [
        "test/host-mount.test.ts"
      ],
      "rc": 1,
      "red": "3 failed | 97 passed (100)",
      "failing": [
        "after ready it posts the exact op, once, after focusing the iframe (B7k)",
        "it focuses the iframe even when the mount was made with focus: false (the host asked for the command)",
        "host code that runs at the focus (a focusout that destroys the frame) leaves the command unposted, and nothing"
      ],
      "verdict": "red",
      "sha256": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "sha256After": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7l",
      "guard": "progress defaults off",
      "edits": [
        {
          "file": "src/frame/document.ts",
          "old": "field(f, k, k !== 'progress')",
          "new": "field(f, k, true)"
        }
      ],
      "tests": [
        "test/frame-document.test.ts"
      ],
      "rc": 1,
      "red": "7 failed | 216 passed (223)",
      "failing": [
        "every field at a real value is seeded as given, and the seed passes the bootstrap's validator",
        "absent fields are seeded at their defaults",
        "a value whose key is undefined counts as absent, as JSON writes it",
        "no bridge at all seeds progress false and the other switches true",
        "a bridge that leaves progress out seeds it false, whatever it sets of the others",
        "mermaid off: exactly SEED_KEYS, each new key at its default, and the seed passes validateSeed",
        "clean.html is the fixture's srcdoc with the policy and each asset as its placeholder (UPDATE_FRAME_MUTANTS=1 r"
      ],
      "verdict": "red",
      "sha256": {
        "src/frame/document.ts": "2765f0bc257324060eac6482bbabcf86d49a287b53b12f9cfadb5a611b4a0d1d"
      },
      "sha256After": {
        "src/frame/document.ts": "2765f0bc257324060eac6482bbabcf86d49a287b53b12f9cfadb5a611b4a0d1d"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7m",
      "guard": "command lists equal",
      "edits": [
        {
          "file": "src/frame/protocol.ts",
          "old": "Object.freeze(['jump', 'settings', 'contents', 'outline'] as const);\nexport type CommandOp",
          "new": "Object.freeze(['settings', 'contents', 'outline'] as const);\nexport type CommandOp"
        }
      ],
      "tests": [
        "test/enhance-mermaid-on-request.test.ts",
        "test/frame-protocol.test.ts"
      ],
      "rc": 1,
      "red": "2 failed | 238 passed (240)",
      "failing": [
        "B7.8: the wire's COMMAND_OPS (src/frame/protocol.ts) equals L2's COMMAND_NAMES (src/enhance/commands.ts), valu",
        "COMMAND_OPS is the four command names in the bar's order, frozen; the type follows it"
      ],
      "verdict": "red",
      "sha256": {
        "src/frame/protocol.ts": "2902ff3ed0b66480d13b9956076c84288f6d951a3f83e533679a83e0c7d859e5"
      },
      "sha256After": {
        "src/frame/protocol.ts": "2902ff3ed0b66480d13b9956076c84288f6d951a3f83e533679a83e0c7d859e5"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7n",
      "guard": "two focus sites",
      "edits": [
        {
          "file": "src/host/mount.ts",
          "old": "    let loads = 0;\n    let ready = false;",
          "new": "    let loads = 0;\n    if (loads < 0) iframe.focus();\n    let ready = false;"
        }
      ],
      "tests": [
        "test/host-walls.test.ts"
      ],
      "rc": 1,
      "red": "3 failed | 65 passed (68)",
      "failing": [
        "no src/host file names a forbidden name, opens a window, sets an attribute outside the list, or listens for me",
        "the allowed sites are measured, not assumed: mount.ts holds exactly them",
        "a planted extra site in mount.ts goes red: a third postMessage, a second contentWindow, a third focus() (DocFr"
      ],
      "verdict": "red",
      "sha256": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "sha256After": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7o",
      "guard": "command call contained in the frame",
      "edits": [
        {
          "file": "src/frame-runtime/dispatch.ts",
          "old": "      try {\n        api.runEnhancementCommand?.(root, m.name);\n      } catch {\n        // a command that throws changes nothing for the parent, which gets no reply either way\n      }\n",
          "new": "      api.runEnhancementCommand?.(root, m.name);\n"
        }
      ],
      "tests": [
        "test/frame-runtime.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 71 passed (72)",
      "failing": [
        "a command that throws is contained, and the port keeps working: a later prefs, answer and mermaid still apply,"
      ],
      "verdict": "red",
      "sha256": {
        "src/frame-runtime/dispatch.ts": "5e1ae09178f0d92eb668b49807bdc2c38bdb0db02bb3f369cc772a7374e6efe3"
      },
      "sha256After": {
        "src/frame-runtime/dispatch.ts": "5e1ae09178f0d92eb668b49807bdc2c38bdb0db02bb3f369cc772a7374e6efe3"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7p",
      "guard": "command needs a root and a reader",
      "edits": [
        {
          "file": "src/frame-runtime/dispatch.ts",
          "old": "  } else if (m.t === 'command') {\n    if (root !== null && api !== null) {",
          "new": "  } else if (m.t === 'command') {\n    if (true as boolean) {"
        }
      ],
      "tests": [
        "test/frame-runtime.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 71 passed (72)",
      "failing": [
        "before the reader enhanced (no root) a command and a prefs reach nothing, and the reader is not called with a "
      ],
      "verdict": "red",
      "sha256": {
        "src/frame-runtime/dispatch.ts": "5e1ae09178f0d92eb668b49807bdc2c38bdb0db02bb3f369cc772a7374e6efe3"
      },
      "sha256After": {
        "src/frame-runtime/dispatch.ts": "5e1ae09178f0d92eb668b49807bdc2c38bdb0db02bb3f369cc772a7374e6efe3"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7q",
      "guard": "command: a reader without the function (optional call)",
      "edits": [
        {
          "file": "src/frame-runtime/dispatch.ts",
          "old": "api.runEnhancementCommand?.(root, m.name);",
          "new": "api.runEnhancementCommand(root, m.name);"
        }
      ],
      "tests": [
        "test/frame-runtime.test.ts"
      ],
      "rc": 0,
      "red": "0 failed | 72 passed (72)",
      "failing": [],
      "verdict": "equivalent (stays green)",
      "sha256": {
        "src/frame-runtime/dispatch.ts": "5e1ae09178f0d92eb668b49807bdc2c38bdb0db02bb3f369cc772a7374e6efe3"
      },
      "sha256After": {
        "src/frame-runtime/dispatch.ts": "5e1ae09178f0d92eb668b49807bdc2c38bdb0db02bb3f369cc772a7374e6efe3"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7r",
      "guard": "host: an unknown name throws a TypeError",
      "edits": [
        {
          "file": "src/host/mount.ts",
          "old": "      if (typeof name !== 'string' || !(COMMAND_OPS as readonly string[]).includes(name)) {\n        throw new TypeError(`docserver host: command name must be one of ${COMMAND_OPS.join(', ')}`);\n      }\n",
          "new": ""
        }
      ],
      "tests": [
        "test/host-mount.test.ts"
      ],
      "rc": 1,
      "red": "2 failed | 98 passed (100)",
      "failing": [
        "an unknown name throws a TypeError and posts and focuses nothing: another name, another case, an inherited nam",
        "the name is checked before the state: an unknown name throws before ready and after destroy too"
      ],
      "verdict": "red",
      "sha256": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "sha256After": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7s",
      "guard": "host: `if (destroyed) return` in command",
      "edits": [
        {
          "file": "src/host/mount.ts",
          "old": "      if (destroyed) return;\n      sendCommand(name);",
          "new": "      sendCommand(name);"
        }
      ],
      "tests": [
        "test/host-mount.test.ts"
      ],
      "rc": 0,
      "red": "0 failed | 100 passed (100)",
      "failing": [],
      "verdict": "equivalent (stays green)",
      "sha256": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "sha256After": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7t",
      "guard": "host: destroy() resets sendCommand",
      "edits": [
        {
          "file": "src/host/mount.ts",
          "old": "      sendPrefs = () => undefined;\n      sendCommand = () => undefined;\n    },",
          "new": "      sendPrefs = () => undefined;\n    },"
        }
      ],
      "tests": [
        "test/host-mount.test.ts"
      ],
      "rc": 1,
      "red": "2 failed | 98 passed (100)",
      "failing": [
        "B7.4: DocFrame.command's handle does not retain a mount: after a destroy, or an update whose document is refus",
        "B4.10: while the loader stays pending, a replaced or destroyed mount is not retained: only the current mount c"
      ],
      "verdict": "red",
      "sha256": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "sha256After": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7u",
      "guard": "host: update() resets sendCommand",
      "edits": [
        {
          "file": "src/host/mount.ts",
          "old": "      sendCommand = () => undefined;\n      mount(d);",
          "new": "      mount(d);"
        }
      ],
      "tests": [
        "test/host-mount.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 99 passed (100)",
      "failing": [
        "B7.4: DocFrame.command's handle does not retain a mount: after a destroy, or an update whose document is refus"
      ],
      "verdict": "red",
      "sha256": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "sha256After": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7v",
      "guard": "host: sendCommand checks live",
      "edits": [
        {
          "file": "src/host/mount.ts",
          "old": "      if (!live || !ready) return;\n      // The focus first",
          "new": "      if (!ready) return;\n      // The focus first"
        }
      ],
      "tests": [
        "test/host-mount.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 99 passed (100)",
      "failing": [
        "after a fallback it posts nothing"
      ],
      "verdict": "red",
      "sha256": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "sha256After": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7w",
      "guard": "host: the after-destroy chain (destroyed return, destroy reset and the live check) dropped together",
      "edits": [
        {
          "file": "src/host/mount.ts",
          "old": "      if (destroyed) return;\n      sendCommand(name);",
          "new": "      sendCommand(name);"
        },
        {
          "file": "src/host/mount.ts",
          "old": "      sendPrefs = () => undefined;\n      sendCommand = () => undefined;\n    },",
          "new": "      sendPrefs = () => undefined;\n    },"
        },
        {
          "file": "src/host/mount.ts",
          "old": "      if (!live || !ready) return;\n      // The focus first",
          "new": "      if (!ready) return;\n      // The focus first"
        }
      ],
      "tests": [
        "test/host-mount.test.ts"
      ],
      "rc": 1,
      "red": "4 failed | 96 passed (100)",
      "failing": [
        "after destroy() it posts and focuses nothing, and calls no adapter",
        "after a fallback it posts nothing",
        "B7.4: DocFrame.command's handle does not retain a mount: after a destroy, or an update whose document is refus",
        "B4.10: while the loader stays pending, a replaced or destroyed mount is not retained: only the current mount c"
      ],
      "verdict": "red",
      "sha256": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "sha256After": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7x",
      "guard": "host: the after-update chain (update reset and the live check) dropped together",
      "edits": [
        {
          "file": "src/host/mount.ts",
          "old": "      sendCommand = () => undefined;\n      mount(d);",
          "new": "      mount(d);"
        },
        {
          "file": "src/host/mount.ts",
          "old": "      if (!live || !ready) return;\n      // The focus first",
          "new": "      if (!ready) return;\n      // The focus first"
        }
      ],
      "tests": [
        "test/host-mount.test.ts"
      ],
      "rc": 1,
      "red": "3 failed | 97 passed (100)",
      "failing": [
        "after an update whose document is refused there is no mount: a command posts nothing on the old port and focus",
        "after a fallback it posts nothing",
        "B7.4: DocFrame.command's handle does not retain a mount: after a destroy, or an update whose document is refus"
      ],
      "verdict": "red",
      "sha256": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "sha256After": {
        "src/host/mount.ts": "a15dbfae176a8be53d57201d6fcd8d697438a57374bd67666390a2bf029fcc0f"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7y",
      "guard": "frame: a non-finite share sends nothing",
      "edits": [
        {
          "file": "src/frame-runtime/adapters.ts",
          "old": "if (typeof share !== 'number' || !Number.isFinite(share)) return;",
          "new": "if (typeof share !== 'number') return;"
        }
      ],
      "tests": [
        "test/frame-runtime.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 71 passed (72)",
      "failing": [
        "a share that is not a finite number sends nothing"
      ],
      "verdict": "red",
      "sha256": {
        "src/frame-runtime/adapters.ts": "b33f08b44cd0a6757e2359c1a49bfb828890a0f58c74fa864c7a03351c112dd6"
      },
      "sha256After": {
        "src/frame-runtime/adapters.ts": "b33f08b44cd0a6757e2359c1a49bfb828890a0f58c74fa864c7a03351c112dd6"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7z",
      "guard": "frame: the typeof check beside isFinite",
      "edits": [
        {
          "file": "src/frame-runtime/adapters.ts",
          "old": "if (typeof share !== 'number' || !Number.isFinite(share)) return;",
          "new": "if (!Number.isFinite(share)) return;"
        }
      ],
      "tests": [
        "test/frame-runtime.test.ts"
      ],
      "rc": 0,
      "red": "0 failed | 72 passed (72)",
      "failing": [],
      "verdict": "equivalent (stays green)",
      "sha256": {
        "src/frame-runtime/adapters.ts": "b33f08b44cd0a6757e2359c1a49bfb828890a0f58c74fa864c7a03351c112dd6"
      },
      "sha256After": {
        "src/frame-runtime/adapters.ts": "b33f08b44cd0a6757e2359c1a49bfb828890a0f58c74fa864c7a03351c112dd6"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7aa",
      "guard": "frame: the clamp's floor",
      "edits": [
        {
          "file": "src/frame-runtime/adapters.ts",
          "old": "Math.min(1000, Math.max(0, Math.round(share * 1000)))",
          "new": "Math.min(1000, Math.round(share * 1000))"
        }
      ],
      "tests": [
        "test/frame-runtime.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 71 passed (72)",
      "failing": [
        "progress true: onProgress(share) sends the share in thousandths as a string, rounded and clamped to 0..1000"
      ],
      "verdict": "red",
      "sha256": {
        "src/frame-runtime/adapters.ts": "b33f08b44cd0a6757e2359c1a49bfb828890a0f58c74fa864c7a03351c112dd6"
      },
      "sha256After": {
        "src/frame-runtime/adapters.ts": "b33f08b44cd0a6757e2359c1a49bfb828890a0f58c74fa864c7a03351c112dd6"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7ab",
      "guard": "frame: the clamp's ceiling",
      "edits": [
        {
          "file": "src/frame-runtime/adapters.ts",
          "old": "Math.min(1000, Math.max(0, Math.round(share * 1000)))",
          "new": "Math.max(0, Math.round(share * 1000))"
        }
      ],
      "tests": [
        "test/frame-runtime.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 71 passed (72)",
      "failing": [
        "progress true: onProgress(share) sends the share in thousandths as a string, rounded and clamped to 0..1000"
      ],
      "verdict": "red",
      "sha256": {
        "src/frame-runtime/adapters.ts": "b33f08b44cd0a6757e2359c1a49bfb828890a0f58c74fa864c7a03351c112dd6"
      },
      "sha256After": {
        "src/frame-runtime/adapters.ts": "b33f08b44cd0a6757e2359c1a49bfb828890a0f58c74fa864c7a03351c112dd6"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7ac",
      "guard": "frame: the key set of an op (an extra key on a command)",
      "edits": [
        {
          "file": "src/frame-runtime/inbound.ts",
          "old": "  for (const k of m.keys()) if (!allowed.includes(k)) return null;\n  if (t === 'command') {",
          "new": "  if (t === 'command') {"
        }
      ],
      "tests": [
        "test/frame-runtime.test.ts"
      ],
      "rc": 1,
      "red": "5 failed | 67 passed (72)",
      "failing": [
        "changes.result: ranges with an optional removedAfter, or unavailable; a full sha",
        "mermaid: exactly one of text (a string within the cap) or unavailable: true (B3.4)",
        "mermaid: every parent-to-frame fixture of the op is judged as its verdict says, by the frame's own parser",
        "command: exactly {name}, one of the four command names (B7a, B7b)",
        "command: every parent-to-frame fixture of the op is judged as its verdict says, by the frame's own parser (B7."
      ],
      "verdict": "red",
      "sha256": {
        "src/frame-runtime/inbound.ts": "098abeb908c9e7d88348caba522d7f66c5634b6cae8f1092c26c05da2190a814"
      },
      "sha256After": {
        "src/frame-runtime/inbound.ts": "098abeb908c9e7d88348caba522d7f66c5634b6cae8f1092c26c05da2190a814"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7ad",
      "guard": "frame: dispose clears the progress timer",
      "edits": [
        {
          "file": "src/frame-runtime/outbox.ts",
          "old": "lanes.version.timer, lanes.progress.timer, hashLane.timer]",
          "new": "lanes.version.timer, hashLane.timer]"
        }
      ],
      "tests": [
        "test/frame-outbox.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 20 passed (21)",
      "failing": [
        "dispose drops the held value and its timer"
      ],
      "verdict": "red",
      "sha256": {
        "src/frame-runtime/outbox.ts": "df1ce8eee1cb128a81a945e8f4c5354666931a987a039bcb3323b2ba485566ef"
      },
      "sha256After": {
        "src/frame-runtime/outbox.ts": "df1ce8eee1cb128a81a945e8f4c5354666931a987a039bcb3323b2ba485566ef"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7ae",
      "guard": "frame: the pre-ready queue keeps the latest progress",
      "edits": [
        {
          "file": "src/frame-runtime/outbox.ts",
          "old": "x.op.t === op.t && (op.t !== 'store.set'",
          "new": "x.op.t === op.t && op.t !== 'progress' && (op.t !== 'store.set'"
        }
      ],
      "tests": [
        "test/frame-outbox.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 20 passed (21)",
      "failing": [
        "before ready the queue keeps the latest progress only, and open() sends it at once, as the first of its window"
      ],
      "verdict": "red",
      "sha256": {
        "src/frame-runtime/outbox.ts": "df1ce8eee1cb128a81a945e8f4c5354666931a987a039bcb3323b2ba485566ef"
      },
      "sha256After": {
        "src/frame-runtime/outbox.ts": "df1ce8eee1cb128a81a945e8f4c5354666931a987a039bcb3323b2ba485566ef"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    },
    {
      "id": "B7af",
      "guard": "frame: a waiting progress is replaced in place in the pacer's line (ruling T7-b)",
      "edits": [
        {
          "file": "src/frame-runtime/outbox.ts",
          "old": "if (e.kind === 'op' && (e.op.t === 'store.set' || e.op.t === 'progress')) {",
          "new": "if (e.kind === 'op' && e.op.t === 'store.set') {"
        }
      ],
      "tests": [
        "test/frame-outbox.test.ts"
      ],
      "rc": 1,
      "red": "1 failed | 20 passed (21)",
      "failing": [
        "ruling T7-b: with the pacer saturated by other ops, at most one progress waits in the line, and a navigate ask"
      ],
      "verdict": "red",
      "sha256": {
        "src/frame-runtime/outbox.ts": "df1ce8eee1cb128a81a945e8f4c5354666931a987a039bcb3323b2ba485566ef"
      },
      "sha256After": {
        "src/frame-runtime/outbox.ts": "df1ce8eee1cb128a81a945e8f4c5354666931a987a039bcb3323b2ba485566ef"
      },
      "restored": true,
      "generatedOutputsRestored": true,
      "checkAfterRestore": 0
    }
  ]
}
```
