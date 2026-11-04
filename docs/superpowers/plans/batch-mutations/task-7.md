# Batch Task 7: mutation rows (the bridge for one bar: `command`, `progress`, `DocFrame.command`, `onProgress`)

Step 1 of the task wrote the tests before the code. The RED run was made against the code as it stood before the task (the sources of the previous commit with the new tests and fixtures laid over them) in a scratch copy of the tree: `./node_modules/.bin/vitest run --maxWorkers=2 test/frame-protocol.test.ts test/frame-runtime.test.ts test/frame-outbox.test.ts test/host-parse.test.ts test/host-mount.test.ts` gave `61 failed | 463 passed (524)`, every file red. The GREEN run is the Verify list of the brief plus the package, pack, manifest, build, purity and consumer-smoke rows, `22 passed (22)` files, 1208 tests; `test/frame-document.test.ts` and `test/frame-mutants.test.ts` ran alone at one worker (`--maxWorkers=1`) and are green (249 tests).

## Method

Each row was measured in place on branch `ws/docserver-release-1-1`, one at a time, by a driver. For each row: the bytes of the edited file were saved and hashed; the edit was applied (its old text found exactly once); the named tests ran in a bounded run (`timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 <files>`, with `ulimit -u` set to the measured thread count plus 1500; row B7l ran at `--maxWorkers=1`); the edited file was restored from the saved bytes (byte copy) and its sha256 checked against the saved one; the generated outputs (`assets/assets.json`, `src/frame/manifest.generated.ts`, `assets/frame/*`) were hashed before and after (a row edits sources but never rebuilds, so they must be unchanged) and `node scripts/build-frame.mjs --check` ran after each restore. A row is red only through test assertions (no compile or import failure, no suite failure).

Row B7k (the `iframe.focus()` call dropped) is visible in a unit case: jsdom moves the active element and fires `focus` on an iframe, so `test/host-mount.test.ts` sees both the focus and its order before the post. It is also measured on the engines in Task 8's B8.3.

## Verdicts

Every row is red through assertions; none stayed green.

## The rows

| Row | Guard | File | Change | Red |
|---|---|---|---|---|
| B7a | command accepted | `src/frame-runtime/inbound.ts` | ` && t !== 'mermaid' && t !== 'command') return null;` → ` && t !== 'mermaid') return null;` | `test/frame-runtime.test.ts`: 2 failed | 65 passed (67) |
| B7b | known names only | `src/frame-runtime/inbound.ts` | `typeof name === 'string' && (COMMAND_OPS as readonly string[]).include…` → `typeof name === 'string' ?` | `test/frame-runtime.test.ts`: 2 failed | 65 passed (67) |
| B7c | PARENT_OPS | `src/frame/protocol.ts` | `['hello', 'prefs', 'changes.result', 'mermaid', 'command'] as const sa…` → `['hello', 'prefs', 'changes.result', 'mermaid'] as const satisfies` | `test/frame-protocol.test.ts`: 1 failed | 204 passed (205) |
| B7d | progress keys | `src/host/parse.ts` | `progress: Object.freeze(['p']),` → `progress: Object.freeze([]),` | `test/host-parse.test.ts`: 2 failed | 132 passed (134) |
| B7e | progress grammar | `src/frame/protocol.ts` | `export const PROGRESS_SOURCE = '^(?:0\|[1-9][0-9]{0,2}\|1000)$';` → `export const PROGRESS_SOURCE = '^(?:0\|[1-9][0-9]{0,2}\|100[01])$';` | `test/frame-protocol.test.ts (+1)`: 3 failed | 336 passed (339) |
| B7f | coalescing | `src/frame/protocol.ts` | `  progressWindowMs: 250,` → `  progressWindowMs: 0,` | `test/frame-outbox.test.ts (+1)`: 6 failed | 219 passed (225) |
| B7g | trailing edge | `src/frame-runtime/outbox.ts` | `        if (held === null \|\| disposed) {` → `        if (held === null \|\| disposed \|\| held.t === 'progress') {` | `test/frame-outbox.test.ts`: 3 failed | 17 passed (20) |
| B7h | switch-gated in the frame | `src/frame-runtime/adapters.ts` | `    ...(b.progress === true ⏎ ` → `    ...(true ⏎ ` | `test/frame-runtime.test.ts`: 3 failed | 64 passed (67) |
| B7i | switch-gated in the host | `src/host/mount.ts` | `          progress: c.callbacks.onProgress !== undefined,` → `          progress: true,` | `test/host-mount.test.ts`: 2 failed | 96 passed (98) |
| B7j | not before ready | `src/host/mount.ts` | `      if (!live \|\| !ready) return; ⏎       // The focus first` → `      if (!live) return; ⏎       // The focus first` | `test/host-mount.test.ts`: 2 failed | 96 passed (98) |
| B7k | focus | `src/host/mount.ts` | `      iframe.focus(); ⏎       post({ t: 'command', name });` → `      post({ t: 'command', name });` | `test/host-mount.test.ts`: 3 failed | 95 passed (98) |
| B7l | progress defaults off | `src/frame/document.ts` | `field(f, k, k !== 'progress')` → `field(f, k, true)` | `test/frame-document.test.ts`: 7 failed | 216 passed (223) |
| B7m | command lists equal | `src/frame/protocol.ts` | `Object.freeze(['jump', 'settings', 'contents', 'outline'] as const); ⏎…` → `Object.freeze(['settings', 'contents', 'outline'] as const); ⏎ export …` | `test/enhance-mermaid-on-request.test.ts (+1)`: 2 failed | 238 passed (240) |
| B7n | two focus sites | `src/host/mount.ts` | `    let loads = 0; ⏎     let ready = false;` → `    let loads = 0; ⏎     if (loads < 0) iframe.focus(); ⏎     let read…` | `test/host-walls.test.ts`: 3 failed | 65 passed (68) |

```json
{
  "generatedOutputs": {
    "assets/assets.json": "a0e1e947f52a0b8e31afe5d48034fc785c9716097cf8d5578976e8a227d3bfee",
    "src/frame/manifest.generated.ts": "a65e53de5b6c7570ad8808dcd09d53f403f5b573caadfd56af3ccea5f141e6fe",
    "assets/frame/bootstrap.js": "99d7acf5267291edaf3f210168580362dbb799434f4bcbb268462b41f30cfb5e",
    "assets/frame/enhance.js": "0d7d257f7803669f9812d1e0422f093a2cd087d564b7df5731e5781ff2edf320",
    "assets/frame/guard.js": "ff3c25da5703bc06d40ca0412b2e760c619a73a4153306f4d0f3b662bda65c4d",
    "assets/frame/reader.css": "83176e0055183256fdd131a602f847a16a17a8944812071672550e64c8dc9e9f"
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
      "red": "2 failed | 65 passed (67)",
      "failing": [
        "command: exactly {name}, one of the four command names (B7a, B7b)",
        "command: every parent-to-frame fixture of the op is judged as its verdict says, by the frame's own parser (B7."
      ],
      "verdict": "red",
      "sha256": {
        "src/frame-runtime/inbound.ts": "fc05992c6daca571f03e996b5af9413f5f98157fa0e21724ea9408b87c1cc204"
      },
      "sha256After": {
        "src/frame-runtime/inbound.ts": "fc05992c6daca571f03e996b5af9413f5f98157fa0e21724ea9408b87c1cc204"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
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
      "red": "2 failed | 65 passed (67)",
      "failing": [
        "command: exactly {name}, one of the four command names (B7a, B7b)",
        "command: every parent-to-frame fixture of the op is judged as its verdict says, by the frame's own parser (B7."
      ],
      "verdict": "red",
      "sha256": {
        "src/frame-runtime/inbound.ts": "fc05992c6daca571f03e996b5af9413f5f98157fa0e21724ea9408b87c1cc204"
      },
      "sha256After": {
        "src/frame-runtime/inbound.ts": "fc05992c6daca571f03e996b5af9413f5f98157fa0e21724ea9408b87c1cc204"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
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
      "generatedOutputsUnchanged": true,
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
      "generatedOutputsUnchanged": true,
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
      "generatedOutputsUnchanged": true,
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
      "red": "6 failed | 219 passed (225)",
      "failing": [
        "the first value goes at once; the latest of the window goes when it ends, which opens the next window",
        "a scroll burst of one value a millisecond for 3 seconds sends at most 4 a second, and the final value always a",
        "a navigate asked in the middle of a progress burst leaves within 250 ms, and the frame stays within 16 message",
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
      "generatedOutputsUnchanged": true,
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
      "red": "3 failed | 17 passed (20)",
      "failing": [
        "the first value goes at once; the latest of the window goes when it ends, which opens the next window",
        "a scroll burst of one value a millisecond for 3 seconds sends at most 4 a second, and the final value always a",
        "before ready the queue keeps the latest progress only, and open() sends it at once, as the first of its window"
      ],
      "verdict": "red",
      "sha256": {
        "src/frame-runtime/outbox.ts": "0403f92eeb0b6f9ebcba6733da792c7a660aa71d5bcc88e57d46cee1d8d6ee62"
      },
      "sha256After": {
        "src/frame-runtime/outbox.ts": "0403f92eeb0b6f9ebcba6733da792c7a660aa71d5bcc88e57d46cee1d8d6ee62"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
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
      "red": "3 failed | 64 passed (67)",
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
      "generatedOutputsUnchanged": true,
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
      "red": "2 failed | 96 passed (98)",
      "failing": [
        "the bridge switches follow which adapters exist",
        "B7.2: progress is switched on by onProgress alone, and by nothing else (B7i)"
      ],
      "verdict": "red",
      "sha256": {
        "src/host/mount.ts": "4ba970f2b16e655abd1955c218f755bdfa98fe8ec7a6c07a4a885f219d68ef06"
      },
      "sha256After": {
        "src/host/mount.ts": "4ba970f2b16e655abd1955c218f755bdfa98fe8ec7a6c07a4a885f219d68ef06"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
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
      "red": "2 failed | 96 passed (98)",
      "failing": [
        "before ready it posts nothing and moves no focus (B7j)",
        "after update() the new mount is not ready: it posts nothing, on the old port or the new one, until its own rea"
      ],
      "verdict": "red",
      "sha256": {
        "src/host/mount.ts": "4ba970f2b16e655abd1955c218f755bdfa98fe8ec7a6c07a4a885f219d68ef06"
      },
      "sha256After": {
        "src/host/mount.ts": "4ba970f2b16e655abd1955c218f755bdfa98fe8ec7a6c07a4a885f219d68ef06"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
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
      "red": "3 failed | 95 passed (98)",
      "failing": [
        "after ready it posts the exact op, once, after focusing the iframe (B7k)",
        "it focuses the iframe even when the mount was made with focus: false (the host asked for the command)",
        "host code that runs at the focus (a focusout that destroys the frame) leaves the command unposted, and nothing"
      ],
      "verdict": "red",
      "sha256": {
        "src/host/mount.ts": "4ba970f2b16e655abd1955c218f755bdfa98fe8ec7a6c07a4a885f219d68ef06"
      },
      "sha256After": {
        "src/host/mount.ts": "4ba970f2b16e655abd1955c218f755bdfa98fe8ec7a6c07a4a885f219d68ef06"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
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
      "generatedOutputsUnchanged": true,
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
      "generatedOutputsUnchanged": true,
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
        "src/host/mount.ts": "4ba970f2b16e655abd1955c218f755bdfa98fe8ec7a6c07a4a885f219d68ef06"
      },
      "sha256After": {
        "src/host/mount.ts": "4ba970f2b16e655abd1955c218f755bdfa98fe8ec7a6c07a4a885f219d68ef06"
      },
      "restored": true,
      "generatedOutputsUnchanged": true,
      "checkAfterRestore": 0
    }
  ]
}
```
