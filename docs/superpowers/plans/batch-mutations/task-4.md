# Batch Task 4: mutation rows (`./host`: `mermaidDraw: 'after-ready'` and `loadMermaid`)

Each row was measured in place on branch `ws/docserver-release-1-1` by the batch method: the bytes of `src/host/mount.ts` saved with their sha256, one edit applied (row B4f is two edits, B4j one edit that moves a line), `test/host-mount.test.ts` run as `./node_modules/.bin/vitest run --maxWorkers=2 --reporter=json test/host-mount.test.ts` behind `timeout -k 10 600` and a `ulimit -u` of the measured thread count plus 1500 (limits of 4900 to 5300), then the file restored from the saved bytes (`cp`) and its sha256 compared. The item is ledger C107. `src/host/mount.ts` is not bundled into a frame asset, so no generated output moved and no build ran.

Verdicts. Every row exited 1 and went red through assertions in at least one named test; none stayed green. Row B4e is red through the RangeError that a mount of an `'after-ready'` adapter throws in ten tests and through B4.0's own `not.toThrow()` assertion. Two rows needed a case beyond the brief's wording to be measurable. B4c: `post` is the only place the mount's `live` flag guards the mermaid op (the op goes through `post`, which keeps `postMessage` to the two sites `test/host-walls.test.ts` allows), and the tests record `postMessage` calls on the parent's end of a closed port too (the fake port drops them), so a replaced or destroyed mount that posts is seen. B4i: a `String` object has the right length and the right characters, so the hash alone does not refuse it; only the `typeof` check does, and B4.9 has that case. Mermaid-sized texts in the tests are summarised before an assertion formats them: a first version of the file put the 3.7 MB build in a failing diff and a row went red by losing its worker, not by an assertion; those rows were run again after the fix.

## The rows (B4a to B4j)

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| B4a | post after ready | `src/host/mount.ts` | `if (!ready \|\| sent \|\| answer === null) return;` → `if (sent \|\| answer === null) return;` | `test/host-mount.test.ts`: 2 failed | 70 passed (72). B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted af; B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted af | sha256 `d89a3fafb40d…` restored, equal |
| B4b | hash check | `src/host/mount.ts` | `if (hex(sha256Text(text)) !== FRAME_MANIFEST.mermaid.sha256) return none('the build is not the shipped one');` → (removed) | `test/host-mount.test.ts`: 1 failed | 71 passed (72). B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted af | sha256 `d89a3fafb40d…` restored, equal |
| B4c | replaced mount silent | `src/host/mount.ts` | `if (live) port.postMessage(m);` → `port.postMessage(m);` | `test/host-mount.test.ts`: 3 failed | 69 passed (72). B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted af; B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted af; B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted af | sha256 `d89a3fafb40d…` restored, equal |
| B4d | a source is required | `src/host/mount.ts` | `else throw new TypeError("docserver host: mermaidDraw 'after-ready' needs adapters.loadMermaid or adapters.assets.mermaid");` → `else mermaidSource = null;` | `test/host-mount.test.ts`: 1 failed | 71 passed (72). B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted af | sha256 `d89a3fafb40d…` restored, equal |
| B4e | mode accepted | `src/host/mount.ts` | `Object.freeze(['auto', 'on-request', 'after-ready'])` → `Object.freeze(['auto', 'on-request'])` | `test/host-mount.test.ts`: 11 failed | 61 passed (72). B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted af; B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted af; B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted af; and 8 more | sha256 `d89a3fafb40d…` restored, equal |
| B4f | other modes untouched | `src/host/mount.ts` | `if (draw === 'after-ready') { ⏎     // Exactly one` → `if (draw === 'after-ready' \|\| typeof loader === 'function') { ⏎     // Exactly one` ; `late = c.draw === 'after-ready' && gated !== null && gated.inline;` → `late = gated !== null && gated.inline;` | `test/host-mount.test.ts`: 1 failed | 71 passed (72). B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted af | sha256 `d89a3fafb40d…` restored, equal |
| B4g | re-delivery on update | `src/host/mount.ts` | `if (live && late && c.mermaidSource !== null) {` → `if (live && late && c.mermaidSource !== null && build === null) {` | `test/host-mount.test.ts`: 1 failed | 71 passed (72). B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted af | sha256 `d89a3fafb40d…` restored, equal |
| B4h | gate first | `src/host/mount.ts` | `late = c.draw === 'after-ready' && gated !== null && gated.inline;` → `late = c.draw === 'after-ready';` | `test/host-mount.test.ts`: 1 failed | 71 passed (72). B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted af | sha256 `d89a3fafb40d…` restored, equal |
| B4i | untrusted answer | `src/host/mount.ts` | `if (typeof text !== 'string') return none('the loader did not answer a string');` → (removed) | `test/host-mount.test.ts`: 1 failed | 71 passed (72). B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted af | sha256 `d89a3fafb40d…` restored, equal |
| B4j | sync throw contained | `src/host/mount.ts` | `let answer: Promise<unknown>; ⏎     try { ⏎       const asked: unknown = typeof source === 'string' ? source : Reflect.apply(source, c.raw, []);` → `let answer: Promise<unknown>; ⏎     const before: unknown = typeof source === 'string' ? source : Reflect.apply(source, c.raw, []); ⏎     try { ⏎       const asked: unknown = before;` | `test/host-mount.test.ts`: 1 failed | 71 passed (72). B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted af | sha256 `d89a3fafb40d…` restored, equal |

```json
[
  {
    "id": "B4a",
    "guard": "post after ready",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "    if (!ready || sent || answer === null) return;",
        "new": "    if (sent || answer === null) return;"
      }
    ],
    "rc": 1,
    "red": "2 failed | 70 passed (72)",
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.1: for a document the gate admits, the loader is called at mount, before ready; nothing is posted before ready; the op follows a valid ready",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.5: 'after-ready' with neither source is a TypeError; with assets.mermaid only, that text is posted after ready"
    ],
    "assertionErrorsOnly": true,
    "sha256": "d89a3fafb40d2697ef2b12b6cf85d15f7565877bcc562ffa7e4dfb1e2fbf5c47",
    "restored": true
  },
  {
    "id": "B4b",
    "guard": "hash check",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "          if (hex(sha256Text(text)) !== FRAME_MANIFEST.mermaid.sha256) return none('the build is not the shipped one');\n",
        "new": ""
      }
    ],
    "rc": 1,
    "red": "1 failed | 71 passed (72)",
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.3: a wrong text posts unavailable and warns; so does a rejection"
    ],
    "assertionErrorsOnly": true,
    "sha256": "d89a3fafb40d2697ef2b12b6cf85d15f7565877bcc562ffa7e4dfb1e2fbf5c47",
    "restored": true
  },
  {
    "id": "B4c",
    "guard": "replaced mount silent",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "    if (live) port.postMessage(m);",
        "new": "    port.postMessage(m);"
      }
    ],
    "rc": 1,
    "red": "3 failed | 69 passed (72)",
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.4: an answer that arrives after destroy() posts nothing",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.7: an update before the loader resolves: the new mount gets exactly one op, the replaced mount none, the loader one call; a later update re-posts without a call",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.7b: a replaced mount that is not replaced by a Mermaid mount still posts nothing when the answer arrives"
    ],
    "assertionErrorsOnly": true,
    "sha256": "d89a3fafb40d2697ef2b12b6cf85d15f7565877bcc562ffa7e4dfb1e2fbf5c47",
    "restored": true
  },
  {
    "id": "B4d",
    "guard": "a source is required",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "    else throw new TypeError(\"docserver host: mermaidDraw 'after-ready' needs adapters.loadMermaid or adapters.assets.mermaid\");",
        "new": "    else mermaidSource = null;"
      }
    ],
    "rc": 1,
    "red": "1 failed | 71 passed (72)",
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.5: 'after-ready' with neither source is a TypeError; with assets.mermaid only, that text is posted after ready"
    ],
    "assertionErrorsOnly": true,
    "sha256": "d89a3fafb40d2697ef2b12b6cf85d15f7565877bcc562ffa7e4dfb1e2fbf5c47",
    "restored": true
  },
  {
    "id": "B4e",
    "guard": "mode accepted",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "Object.freeze(['auto', 'on-request', 'after-ready'])",
        "new": "Object.freeze(['auto', 'on-request'])"
      }
    ],
    "rc": 1,
    "red": "11 failed | 61 passed (72)",
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.0: 'after-ready' is an accepted mode: a mount with a loader does not throw, and the srcdoc seeds it",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.1: for a document the gate admits, the loader is called at mount, before ready; nothing is posted before ready; the op follows a valid ready",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.2: an answer that arrives after ready is posted at once",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.3: a wrong text posts unavailable and warns; so does a rejection",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.4: an answer that arrives after destroy() posts nothing",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.5: 'after-ready' with neither source is a TypeError; with assets.mermaid only, that text is posted after ready",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.7: an update before the loader resolves: the new mount gets exactly one op, the replaced mount none, the loader one call; a later update re-posts without a call",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.7b: a replaced mount that is not replaced by a Mermaid mount still posts nothing when the answer arrives",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.8: a document with no fences never calls loadMermaid and posts no op; an update that brings figures calls it once",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9: a loader that throws, resolves to a non-string, or resolves over the cap posts unavailable and warns; nothing throws out of mountDocFrame",
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9b: a loader that calls update() or destroy() from inside itself never loops, never throws and is called once"
    ],
    "assertionErrorsOnly": false,
    "sha256": "d89a3fafb40d2697ef2b12b6cf85d15f7565877bcc562ffa7e4dfb1e2fbf5c47",
    "restored": true
  },
  {
    "id": "B4f",
    "guard": "other modes untouched",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "  if (draw === 'after-ready') {\n    // Exactly one",
        "new": "  if (draw === 'after-ready' || typeof loader === 'function') {\n    // Exactly one"
      },
      {
        "old": "      late = c.draw === 'after-ready' && gated !== null && gated.inline;",
        "new": "      late = gated !== null && gated.inline;"
      }
    ],
    "rc": 1,
    "red": "1 failed | 71 passed (72)",
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.6: 'auto' and 'on-request' never call loadMermaid and post no mermaid op"
    ],
    "assertionErrorsOnly": true,
    "sha256": "d89a3fafb40d2697ef2b12b6cf85d15f7565877bcc562ffa7e4dfb1e2fbf5c47",
    "restored": true
  },
  {
    "id": "B4g",
    "guard": "re-delivery on update",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "    if (live && late && c.mermaidSource !== null) {",
        "new": "    if (live && late && c.mermaidSource !== null && build === null) {"
      }
    ],
    "rc": 1,
    "red": "1 failed | 71 passed (72)",
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.7: an update before the loader resolves: the new mount gets exactly one op, the replaced mount none, the loader one call; a later update re-posts without a call"
    ],
    "assertionErrorsOnly": true,
    "sha256": "d89a3fafb40d2697ef2b12b6cf85d15f7565877bcc562ffa7e4dfb1e2fbf5c47",
    "restored": true
  },
  {
    "id": "B4h",
    "guard": "gate first",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "      late = c.draw === 'after-ready' && gated !== null && gated.inline;",
        "new": "      late = c.draw === 'after-ready';"
      }
    ],
    "rc": 1,
    "red": "1 failed | 71 passed (72)",
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.8: a document with no fences never calls loadMermaid and posts no op; an update that brings figures calls it once"
    ],
    "assertionErrorsOnly": true,
    "sha256": "d89a3fafb40d2697ef2b12b6cf85d15f7565877bcc562ffa7e4dfb1e2fbf5c47",
    "restored": true
  },
  {
    "id": "B4i",
    "guard": "untrusted answer",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "          if (typeof text !== 'string') return none('the loader did not answer a string');\n",
        "new": ""
      }
    ],
    "rc": 1,
    "red": "1 failed | 71 passed (72)",
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9: a loader that throws, resolves to a non-string, or resolves over the cap posts unavailable and warns; nothing throws out of mountDocFrame"
    ],
    "assertionErrorsOnly": true,
    "sha256": "d89a3fafb40d2697ef2b12b6cf85d15f7565877bcc562ffa7e4dfb1e2fbf5c47",
    "restored": true
  },
  {
    "id": "B4j",
    "guard": "sync throw contained",
    "file": "src/host/mount.ts",
    "tests": "test/host-mount.test.ts",
    "edits": [
      {
        "old": "    let answer: Promise<unknown>;\n    try {\n      const asked: unknown = typeof source === 'string' ? source : Reflect.apply(source, c.raw, []);",
        "new": "    let answer: Promise<unknown>;\n    const before: unknown = typeof source === 'string' ? source : Reflect.apply(source, c.raw, []);\n    try {\n      const asked: unknown = before;"
      }
    ],
    "rc": 1,
    "red": "1 failed | 71 passed (72)",
    "failing": [
      "B4 mermaidDraw 'after-ready': the build is fetched in parallel with the boot and posted after ready (ledger C107) B4.9: a loader that throws, resolves to a non-string, or resolves over the cap posts unavailable and warns; nothing throws out of mountDocFrame"
    ],
    "assertionErrorsOnly": true,
    "sha256": "d89a3fafb40d2697ef2b12b6cf85d15f7565877bcc562ffa7e4dfb1e2fbf5c47",
    "restored": true
  }
]
```
