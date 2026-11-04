# Batch Task 3: mutation rows (the frame: no inline Mermaid, the `mermaid` op, late insertion)

Each row was measured in place on branch `ws/docserver-release-1-1` by the batch method: the bytes of the target file saved with their sha256, one edit applied, the named test files run as `./node_modules/.bin/vitest run --maxWorkers=<n> <files>` behind `timeout -k 10 600` and a `ulimit -u` of the measured thread count plus 1500 (limits of 4634 to 4955), then the file restored from the saved bytes (`cp`) and its sha256 compared. The item is ledger C107. Rows B3a to B3k are the brief's. Rows B3l to B3p cover the guards this task wrote beyond the brief's list (the Phase-S reservation of `fastdom` and `injected`, BD5, and the allowlist reasons). Rows B3q to B3v are the fix round's (ruling BX-3): the late registration is accepted only as exactly one `docserver:register` whose target is the inserted element, Mermaid's own, carrying `initialize` and `render` functions, decided by the pure `lateApi` in `src/frame-runtime/adapters.ts` from what the bootstrap's listener recorded. All rows were measured again on the final tree.

The rows edit sources that feed the frame build, but the unit tests read sources (the walls test builds in memory), so no build ran and no generated output moved: `assets/assets.json` and `src/frame/manifest.generated.ts` were saved before each row and compared after it, equal every time; `node scripts/build-frame.mjs --check` is green on the committed tree. Rows B3a to B3c and B3p run only the describe blocks named in their `-t` filter (`"L3.M8 Mermaid in the skeleton"` and `"L3.M17"`), because a whole `test/frame-document.test.ts` or `test/frame-build.test.ts` run loses its worker to the memory cap on a shared box (`test/frame-document.test.ts` did so on its unchanged text too); a row whose run lost its worker is run again. `test/frame-runtime.test.ts`, `test/frame-protocol.test.ts` and `test/enhance-mermaid-on-request.test.ts` run in jsdom or Node at the default two workers.

Verdicts. Every row went red through `AssertionError` in at least one named test, and none stayed green. Row B3i (a `waitsForDrawing` that is true for `'after-ready'` too) reds exactly the two predicate cases: B3.5's and Task 2's `waitsForDrawing` line in the pass-through block. At the behaviour level the same edit is an equivalent mutant (`ready` waiting for drawings the mode never starts; see B5g, measured in Task 5), as the brief says. Row B3e is five edits in turn on `src/frame-runtime/inbound.ts`: the brief's four (drop the cap; accept a non-string `text`; accept both keys; accept neither) and a fifth that accepts an `unavailable` other than `true`. Row B3s is three edits in turn: no function check, only `render` checked, only `initialize` checked. Row B3u restores the omission at the bootstrap's call site (no option for an `'after-ready'` seed without a module), which the source pin in `test/enhance-mermaid-on-request.test.ts` reddens; B3j is the same omission inside `mermaidOption`, reddened by the unit case. Row B3l's second case writes the reserved names inside `expect(...).not.toThrow()`, so a read-only reservation reds through assertions only.

The browser half of these guards (once-only, the mode check, the reservation on real engines, the hash match, `ready` not waiting, and the `unavailable` branch) is measured in Task 5.

## The rows (B3a to B3v)

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| B3a | no inline script | `src/frame/document.ts` | `const mermaid = mermaidOptions === null \|\| late ? null : mermaidText;` → `const mermaid = mermaidOptions === null ? null : mermaidText;` | `test/frame-document.test.ts -t "L3.M8 Mermaid in the skeleton"`: 1 failed \| 5 passed \| 211 skipped (217). L3.M8 Mermaid in the skeleton (the prototype's P7) > 'after-ready' (B3.1): no Mermaid script, no assets.mermai | sha256 `3d798b4f18f8…` restored, equal |
| B3b | no asset required | `src/frame/document.ts` | `if (mermaidOptions !== null && !late && mermaidText === null) throw` → `if (mermaidOptions !== null && mermaidText === null) throw` | `test/frame-document.test.ts -t "L3.M8 Mermaid in the skeleton"`: 2 failed \| 4 passed \| 211 skipped (217). L3.M8 Mermaid in the skeleton (the prototype's P7) > 'after-ready' (B3.1): no Mermaid script, no assets.mermai; L3.M8 Mermaid in the skeleton (the prototype's P7) > 'after-ready' (B3.2): a policy lacking Mermaid's hash is  | sha256 `3d798b4f18f8…` restored, equal |
| B3c | hash still required | `src/frame/document.ts` | `if (mermaidOptions !== null) required.push(FRAME_MANIFEST.mermaid.csp);` → `if (mermaid !== null) required.push(FRAME_MANIFEST.mermaid.csp);` | `test/frame-document.test.ts -t "L3.M8 Mermaid in the skeleton"`: 1 failed \| 5 passed \| 211 skipped (217). L3.M8 Mermaid in the skeleton (the prototype's P7) > 'after-ready' (B3.2): a policy lacking Mermaid's hash is  | sha256 `3d798b4f18f8…` restored, equal |
| B3e | the op's shape | `src/frame-runtime/inbound.ts` | in turn, (1) `typeof text === 'string' && text.length <= BRIDGE_LIMITS.mermaidMaxChars ? { t: 'mermaid', text } : null;` → `typeof text === 'string' ? { t: 'mermaid', text } : null;` ; (2) `typeof text === 'string' && text.length <= BRIDGE_LIMITS.mermaidMaxChars ? { t: 'mermaid', text } : null;` → `String(text).length <= BRIDGE_LIMITS.mermaidMaxChars ? { t: 'mermaid', text: text as string } : null;` ; (3) `if (hasText === m.has('unavailable')) return null;` → `if (!hasText && !m.has('unavailable')) return null;` ; (4) `if (hasText === m.has('unavailable')) return null;` → `if (hasText && m.has('unavailable')) return null; ⏎     if (!hasText && !m.has('unavailable')) return { t: 'mermaid', unavailable: true };` ; (5) `return m.get('unavailable') === true ? { t: 'mermaid', unavailable: true } : null;` → `return m.get('unavailable') !== undefined ? { t: 'mermaid', unavailable: true } : null;` | (1) `test/frame-runtime.test.ts`: 2 failed \| 57 passed (59). parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: every parent-to-frame; parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: the text is capped at (2) `test/frame-runtime.test.ts`: 2 failed \| 57 passed (59). parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: every parent-to-frame; parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: exactly one of text ( (3) `test/frame-runtime.test.ts`: 2 failed \| 57 passed (59). parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: every parent-to-frame; parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: exactly one of text ( (4) `test/frame-runtime.test.ts`: 2 failed \| 57 passed (59). parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: every parent-to-frame; parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: exactly one of text ( (5) `test/frame-runtime.test.ts`: 2 failed \| 57 passed (59). parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: every parent-to-frame; parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: exactly one of text ( | sha256 `63c194126d61…` restored, equal |
| B3f | PARENT_OPS | `src/frame/protocol.ts` | `['hello', 'prefs', 'changes.result', 'mermaid'] as const` → `['hello', 'prefs', 'changes.result'] as const` | `test/frame-protocol.test.ts`: 1 failed \| 177 passed (178). OP_KEYS: the op key sets per t, one table for both parsers > FRAME_OPS and PARENT_OPS split it by direction, w | sha256 `104c671c9afe…` restored, equal |
| B3g | no boot requirement | `src/frame-runtime/bootstrap.ts` | `if (seed.mermaid !== null && !arrivesLate(seed.mermaid)) {` → `if (seed.mermaid !== null) {` | `test/enhance-mermaid-on-request.test.ts`: 1 failed \| 33 passed (34). the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > th | sha256 `ecb948395860…` restored, equal |
| B3h | probe | `src/frame-runtime/adapters.ts` | `return m !== null && m.draw !== 'auto'; ⏎ }` → `return m !== null && m.draw === 'on-request'; ⏎ }` | `test/enhance-mermaid-on-request.test.ts`: 1 failed \| 33 passed (34). L3.D6: on request, the bootstrap asks for inline style before ready (fix round, review S1; Reference §11.5,  | sha256 `ddb59cd5bbd6…` restored, equal |
| B3i | predicate only | `src/frame-runtime/adapters.ts` | `return m !== null && m.draw === 'auto'; ⏎ }` → `return m !== null && (m.draw === 'auto' \|\| m.draw === 'after-ready'); ⏎ }` | `test/enhance-mermaid-on-request.test.ts`: 2 failed \| 32 passed (34). L3.D6: on request, the bootstrap asks for inline style before ready (fix round, review S1; Reference §11.5, ; the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > re | sha256 `ddb59cd5bbd6…` restored, equal |
| B3j | option always passed | `src/frame-runtime/adapters.ts` | `if (arrivesLate(m)) return { mermaid: enhanceMermaid(m, late) };` → (removed) | `test/enhance-mermaid-on-request.test.ts`: 1 failed \| 33 passed (34). the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > th | sha256 `ddb59cd5bbd6…` restored, equal |
| B3k | one script-creation site | `src/frame-runtime/bootstrap.ts` | `const seen: LateRegistration[] = [];` → `const seen: LateRegistration[] = []; ⏎     void styles.createElement.call(doc, 'script');` | `test/frame-runtime-walls.test.ts`: 8 failed \| 49 passed (57). L3.M19: the built guard.js, bootstrap.js and enhance.js > a planted second script creation in the built bootst; L3.M19: the built guard.js, bootstrap.js and enhance.js > guard.js and bootstrap.js pass the same scan, with t; L3.M19: the built guard.js, bootstrap.js and enhance.js > the loss of the one script creation from the built b; L3.M19: the frame runtime sources > a planted extra use in bootstrap.ts goes red: createElement(script) x2, al; L3.M19: the frame runtime sources > a planted extra use in bootstrap.ts goes red: createElement(script) x2, al; L3.M19: the frame runtime sources > a planted extra use in bootstrap.ts goes red: createElement(script) x2, al; L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from str; L3.M19: the frame runtime sources > the allowed sites are measured, not assumed: the counts above are what the | sha256 `ecb948395860…` restored, equal |
| B3l | reservation is writable | `src/frame-runtime/pin.ts` | `define(win, name, { value: undefined, writable: true, configurable: false });` → `define(win, name, { value: undefined, writable: false, configurable: false });` | `test/frame-runtime.test.ts`: 2 failed \| 57 passed (59). BD5: reserveGlobals, the names Mermaid writes while it evaluates > an element with that id cannot stand in for; BD5: reserveGlobals, the names Mermaid writes while it evaluates > defines an absent name as an own, writable, | sha256 `2482f493cabc…` restored, equal |
| B3m | reservation runs in Phase S | `src/frame-runtime/bootstrap.ts` | `reserveGlobals(win, RESERVED_GLOBALS);` → (removed) | `test/frame-runtime.test.ts`: 1 failed \| 58 passed (59). BD5: reserveGlobals, the names Mermaid writes while it evaluates > the bootstrap reserves RESERVED_GLOBALS in  | sha256 `ecb948395860…` restored, equal |
| B3n | both names reserved | `src/frame-runtime/pin.ts` | `Object.freeze(['fastdom', 'injected'])` → `Object.freeze(['fastdom'])` | `test/frame-runtime.test.ts`: 1 failed \| 58 passed (59). BD5: reserveGlobals, the names Mermaid writes while it evaluates > reserves the two names, in every mode (the  | sha256 `2482f493cabc…` restored, equal |
| B3o | reservation is non-configurable | `src/frame-runtime/pin.ts` | `define(win, name, { value: undefined, writable: true, configurable: false });` → `define(win, name, { value: undefined, writable: true, configurable: true });` | `test/frame-runtime.test.ts`: 1 failed \| 58 passed (59). BD5: reserveGlobals, the names Mermaid writes while it evaluates > defines an absent name as an own, writable, | sha256 `2482f493cabc…` restored, equal |
| B3p | allowlist reasons cite the reservation | `scripts/build-frame.mjs` | `'that write. The name is reserved in Phase S as an own, writable, non-configurable property (BD5), so no element id '` → `'that write. It lands before the bootstrap adds any content, so no element id '` | `test/frame-build.test.ts -t "L3.M17"`: 1 failed \| 8 passed \| 36 skipped (45). L3.M17: the free-global list > C90 (5): Mermaid's two lazily read globals are pinned; the two names it writes  | sha256 `1f33970f8e39…` restored, equal |
| B3q | exactly one registration | `src/frame-runtime/adapters.ts` | `if (seen.length !== 1 \|\| only === undefined) return null;` → `if (only === undefined) return null;` | `test/enhance-mermaid-on-request.test.ts`: 1 failed \| 33 passed (34). the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > la | sha256 `ddb59cd5bbd6…` restored, equal |
| B3r | target is the inserted element | `src/frame-runtime/adapters.ts` | `if (only.target !== inserted) return null;` → (removed) | `test/enhance-mermaid-on-request.test.ts`: 1 failed \| 33 passed (34). the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > la | sha256 `ddb59cd5bbd6…` restored, equal |
| B3s | initialize and render are functions | `src/frame-runtime/adapters.ts` | in turn, (1) `return typeof m['initialize'] === 'function' && typeof m['render'] === 'function' ? m : null;` → `return m;` ; (2) `return typeof m['initialize'] === 'function' && typeof m['render'] === 'function' ? m : null;` → `return typeof m['render'] === 'function' ? m : null;` ; (3) `return typeof m['initialize'] === 'function' && typeof m['render'] === 'function' ? m : null;` → `return typeof m['initialize'] === 'function' ? m : null;` | (1) `test/enhance-mermaid-on-request.test.ts`: 1 failed \| 33 passed (34). the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > la (2) `test/enhance-mermaid-on-request.test.ts`: 1 failed \| 33 passed (34). the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > la (3) `test/enhance-mermaid-on-request.test.ts`: 1 failed \| 33 passed (34). the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > la | sha256 `ddb59cd5bbd6…` restored, equal |
| B3t | the registration is Mermaid's | `src/frame-runtime/adapters.ts` | `if (detail['name'] !== 'mermaid') return null;` → (removed) | `test/enhance-mermaid-on-request.test.ts`: 1 failed \| 33 passed (34). the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > la | sha256 `ddb59cd5bbd6…` restored, equal |
| B3u | option passed at the call site | `src/frame-runtime/bootstrap.ts` | `...mermaidOption(seed.mermaid, mermaidModule, () => lateBuild),` → `...(seed.mermaid === null \|\| mermaidModule === null ? {} : mermaidOption(seed.mermaid, mermaidModule, () => lateBuild)),` | `test/enhance-mermaid-on-request.test.ts`: 1 failed \| 33 passed (34). the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > th | sha256 `ecb948395860…` restored, equal |
| B3v | target through the captured accessor | `src/frame-runtime/bootstrap.ts` | `seen.push({ target: target.call(e), detail:` → `seen.push({ target: e.target, detail:` | `test/enhance-mermaid-on-request.test.ts`: 1 failed \| 33 passed (34). the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > th | sha256 `ecb948395860…` restored, equal |

```json
[
  {
    "id": "B3a",
    "guard": "no inline script",
    "file": "src/frame/document.ts",
    "tests": "test/frame-document.test.ts -t \"L3.M8 Mermaid in the skeleton\"",
    "old": "  const mermaid = mermaidOptions === null || late ? null : mermaidText;",
    "new": "  const mermaid = mermaidOptions === null ? null : mermaidText;",
    "rc": 1,
    "red": "1 failed | 5 passed | 211 skipped (217)",
    "failing": [
      "test/frame-document.test.ts > L3.M8 Mermaid in the skeleton (the prototype's P7) > 'after-ready' (B3.1): no Mermaid script, no assets.mermaid needed, "
    ],
    "assertionErrorsOnly": true,
    "sha256": "3d798b4f18f8505f07b05cd2fd29d78c9c294d3698080432d273435dd275420f",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3b",
    "guard": "no asset required",
    "file": "src/frame/document.ts",
    "tests": "test/frame-document.test.ts -t \"L3.M8 Mermaid in the skeleton\"",
    "old": "  if (mermaidOptions !== null && !late && mermaidText === null) throw",
    "new": "  if (mermaidOptions !== null && mermaidText === null) throw",
    "rc": 1,
    "red": "2 failed | 4 passed | 211 skipped (217)",
    "failing": [
      "test/frame-document.test.ts > L3.M8 Mermaid in the skeleton (the prototype's P7) > 'after-ready' (B3.1): no Mermaid script, no assets.mermaid needed, ",
      "test/frame-document.test.ts > L3.M8 Mermaid in the skeleton (the prototype's P7) > 'after-ready' (B3.2): a policy lacking Mermaid's hash is refused wi"
    ],
    "assertionErrorsOnly": true,
    "sha256": "3d798b4f18f8505f07b05cd2fd29d78c9c294d3698080432d273435dd275420f",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3c",
    "guard": "hash still required",
    "file": "src/frame/document.ts",
    "tests": "test/frame-document.test.ts -t \"L3.M8 Mermaid in the skeleton\"",
    "old": "  if (mermaidOptions !== null) required.push(FRAME_MANIFEST.mermaid.csp);",
    "new": "  if (mermaid !== null) required.push(FRAME_MANIFEST.mermaid.csp);",
    "rc": 1,
    "red": "1 failed | 5 passed | 211 skipped (217)",
    "failing": [
      "test/frame-document.test.ts > L3.M8 Mermaid in the skeleton (the prototype's P7) > 'after-ready' (B3.2): a policy lacking Mermaid's hash is refused wi"
    ],
    "assertionErrorsOnly": true,
    "sha256": "3d798b4f18f8505f07b05cd2fd29d78c9c294d3698080432d273435dd275420f",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3e",
    "guard": "the op's shape",
    "file": "src/frame-runtime/inbound.ts",
    "tests": "test/frame-runtime.test.ts",
    "variants": [
      {
        "old": "typeof text === 'string' && text.length <= BRIDGE_LIMITS.mermaidMaxChars ? { t: 'mermaid', text } : null;",
        "new": "typeof text === 'string' ? { t: 'mermaid', text } : null;",
        "rc": 1,
        "red": "2 failed | 57 passed (59)",
        "failing": [
          "test/frame-runtime.test.ts > parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: every parent-to-frame fixture of",
          "test/frame-runtime.test.ts > parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: the text is capped at mermaidMax"
        ],
        "assertionErrorsOnly": true
      },
      {
        "old": "typeof text === 'string' && text.length <= BRIDGE_LIMITS.mermaidMaxChars ? { t: 'mermaid', text } : null;",
        "new": "String(text).length <= BRIDGE_LIMITS.mermaidMaxChars ? { t: 'mermaid', text: text as string } : null;",
        "rc": 1,
        "red": "2 failed | 57 passed (59)",
        "failing": [
          "test/frame-runtime.test.ts > parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: every parent-to-frame fixture of",
          "test/frame-runtime.test.ts > parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: exactly one of text (a string wi"
        ],
        "assertionErrorsOnly": true
      },
      {
        "old": "    if (hasText === m.has('unavailable')) return null;",
        "new": "    if (!hasText && !m.has('unavailable')) return null;",
        "rc": 1,
        "red": "2 failed | 57 passed (59)",
        "failing": [
          "test/frame-runtime.test.ts > parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: every parent-to-frame fixture of",
          "test/frame-runtime.test.ts > parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: exactly one of text (a string wi"
        ],
        "assertionErrorsOnly": true
      },
      {
        "old": "    if (hasText === m.has('unavailable')) return null;",
        "new": "    if (hasText && m.has('unavailable')) return null;\n    if (!hasText && !m.has('unavailable')) return { t: 'mermaid', unavailable: true };",
        "rc": 1,
        "red": "2 failed | 57 passed (59)",
        "failing": [
          "test/frame-runtime.test.ts > parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: every parent-to-frame fixture of",
          "test/frame-runtime.test.ts > parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: exactly one of text (a string wi"
        ],
        "assertionErrorsOnly": true
      },
      {
        "old": "return m.get('unavailable') === true ? { t: 'mermaid', unavailable: true } : null;",
        "new": "return m.get('unavailable') !== undefined ? { t: 'mermaid', unavailable: true } : null;",
        "rc": 1,
        "red": "2 failed | 57 passed (59)",
        "failing": [
          "test/frame-runtime.test.ts > parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: every parent-to-frame fixture of",
          "test/frame-runtime.test.ts > parseParentMessage: what the frame accepts on the port (Reference §6.5, §8.2) > mermaid: exactly one of text (a string wi"
        ],
        "assertionErrorsOnly": true
      }
    ],
    "sha256": "63c194126d61d0be17dca2e4b5a69850dfb8d07a29909193c3ab63c18086745e",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3f",
    "guard": "PARENT_OPS",
    "file": "src/frame/protocol.ts",
    "tests": "test/frame-protocol.test.ts",
    "old": "['hello', 'prefs', 'changes.result', 'mermaid'] as const",
    "new": "['hello', 'prefs', 'changes.result'] as const",
    "rc": 1,
    "red": "1 failed | 177 passed (178)",
    "failing": [
      "test/frame-protocol.test.ts > OP_KEYS: the op key sets per t, one table for both parsers > FRAME_OPS and PARENT_OPS split it by direction, with no op "
    ],
    "assertionErrorsOnly": true,
    "sha256": "104c671c9afe6e8573986c9774fc0503e99ed74302d74181c49ebaf612a44046",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3g",
    "guard": "no boot requirement",
    "file": "src/frame-runtime/bootstrap.ts",
    "tests": "test/enhance-mermaid-on-request.test.ts",
    "old": "if (seed.mermaid !== null && !arrivesLate(seed.mermaid)) {",
    "new": "if (seed.mermaid !== null) {",
    "rc": 1,
    "red": "1 failed | 33 passed (34)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > th"
    ],
    "assertionErrorsOnly": true,
    "sha256": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3h",
    "guard": "probe",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-mermaid-on-request.test.ts",
    "old": "  return m !== null && m.draw !== 'auto';\n}",
    "new": "  return m !== null && m.draw === 'on-request';\n}",
    "rc": 1,
    "red": "1 failed | 33 passed (34)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > L3.D6: on request, the bootstrap asks for inline style before ready (fix round, review S1; Reference §11.5, "
    ],
    "assertionErrorsOnly": true,
    "sha256": "ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3i",
    "guard": "predicate only",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-mermaid-on-request.test.ts",
    "old": "  return m !== null && m.draw === 'auto';\n}",
    "new": "  return m !== null && (m.draw === 'auto' || m.draw === 'after-ready');\n}",
    "rc": 1,
    "red": "2 failed | 32 passed (34)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > L3.D6: on request, the bootstrap asks for inline style before ready (fix round, review S1; Reference §11.5, ",
      "test/enhance-mermaid-on-request.test.ts > the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > re"
    ],
    "assertionErrorsOnly": true,
    "sha256": "ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3j",
    "guard": "option always passed",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-mermaid-on-request.test.ts",
    "old": "  if (arrivesLate(m)) return { mermaid: enhanceMermaid(m, late) };\n",
    "new": "",
    "rc": 1,
    "red": "1 failed | 33 passed (34)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > th"
    ],
    "assertionErrorsOnly": true,
    "sha256": "ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3k",
    "guard": "one script-creation site",
    "file": "src/frame-runtime/bootstrap.ts",
    "tests": "test/frame-runtime-walls.test.ts",
    "old": "    const seen: LateRegistration[] = [];",
    "new": "    const seen: LateRegistration[] = [];\n    void styles.createElement.call(doc, 'script');",
    "rc": 1,
    "red": "8 failed | 49 passed (57)",
    "failing": [
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > a planted second script creation in the built bootstrap g",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > guard.js and bootstrap.js pass the same scan, with the si",
      "test/frame-runtime-walls.test.ts > L3.M19: the built guard.js, bootstrap.js and enhance.js > the loss of the one script creation from the built bootst",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted extra use in bootstrap.ts goes red: createElement(script) x2, allowed",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted extra use in bootstrap.ts goes red: createElement(script) x2, allowed",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > a planted extra use in bootstrap.ts goes red: createElement(script) x2, allowed",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > no source names a forbidden name, a page name of the global, code from strings,",
      "test/frame-runtime-walls.test.ts > L3.M19: the frame runtime sources > the allowed sites are measured, not assumed: the counts above are what the sour"
    ],
    "assertionErrorsOnly": true,
    "sha256": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3l",
    "guard": "reservation is writable",
    "file": "src/frame-runtime/pin.ts",
    "tests": "test/frame-runtime.test.ts",
    "old": "define(win, name, { value: undefined, writable: true, configurable: false });",
    "new": "define(win, name, { value: undefined, writable: false, configurable: false });",
    "rc": 1,
    "red": "2 failed | 57 passed (59)",
    "failing": [
      "test/frame-runtime.test.ts > BD5: reserveGlobals, the names Mermaid writes while it evaluates > an element with that id cannot stand in for it, and Me",
      "test/frame-runtime.test.ts > BD5: reserveGlobals, the names Mermaid writes while it evaluates > defines an absent name as an own, writable, non-config"
    ],
    "assertionErrorsOnly": true,
    "sha256": "2482f493cabc9b59651705f5a07414a4ed4d33cac0ee1f4c80247418d4bb3914",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3m",
    "guard": "reservation runs in Phase S",
    "file": "src/frame-runtime/bootstrap.ts",
    "tests": "test/frame-runtime.test.ts",
    "old": "    reserveGlobals(win, RESERVED_GLOBALS);\n",
    "new": "",
    "rc": 1,
    "red": "1 failed | 58 passed (59)",
    "failing": [
      "test/frame-runtime.test.ts > BD5: reserveGlobals, the names Mermaid writes while it evaluates > the bootstrap reserves RESERVED_GLOBALS in Phase S: on"
    ],
    "assertionErrorsOnly": true,
    "sha256": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3n",
    "guard": "both names reserved",
    "file": "src/frame-runtime/pin.ts",
    "tests": "test/frame-runtime.test.ts",
    "old": "Object.freeze(['fastdom', 'injected'])",
    "new": "Object.freeze(['fastdom'])",
    "rc": 1,
    "red": "1 failed | 58 passed (59)",
    "failing": [
      "test/frame-runtime.test.ts > BD5: reserveGlobals, the names Mermaid writes while it evaluates > reserves the two names, in every mode (the build's all"
    ],
    "assertionErrorsOnly": true,
    "sha256": "2482f493cabc9b59651705f5a07414a4ed4d33cac0ee1f4c80247418d4bb3914",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3o",
    "guard": "reservation is non-configurable",
    "file": "src/frame-runtime/pin.ts",
    "tests": "test/frame-runtime.test.ts",
    "old": "define(win, name, { value: undefined, writable: true, configurable: false });",
    "new": "define(win, name, { value: undefined, writable: true, configurable: true });",
    "rc": 1,
    "red": "1 failed | 58 passed (59)",
    "failing": [
      "test/frame-runtime.test.ts > BD5: reserveGlobals, the names Mermaid writes while it evaluates > defines an absent name as an own, writable, non-config"
    ],
    "assertionErrorsOnly": true,
    "sha256": "2482f493cabc9b59651705f5a07414a4ed4d33cac0ee1f4c80247418d4bb3914",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3p",
    "guard": "allowlist reasons cite the reservation",
    "file": "scripts/build-frame.mjs",
    "tests": "test/frame-build.test.ts -t \"L3.M17\"",
    "old": "'that write. The name is reserved in Phase S as an own, writable, non-configurable property (BD5), so no element id '",
    "new": "'that write. It lands before the bootstrap adds any content, so no element id '",
    "rc": 1,
    "red": "1 failed | 8 passed | 36 skipped (45)",
    "failing": [
      "test/frame-build.test.ts > L3.M17: the free-global list > C90 (5): Mermaid's two lazily read globals are pinned; the two names it writes are left unpi"
    ],
    "assertionErrorsOnly": true,
    "sha256": "1f33970f8e39c45cccf1a3dfff41c82b1028f5a53e52504ccf4eea5a595ce9b2",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3q",
    "guard": "exactly one registration",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-mermaid-on-request.test.ts",
    "old": "  if (seen.length !== 1 || only === undefined) return null;",
    "new": "  if (only === undefined) return null;",
    "rc": 1,
    "red": "1 failed | 33 passed (34)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > la"
    ],
    "assertionErrorsOnly": true,
    "sha256": "ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3r",
    "guard": "target is the inserted element",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-mermaid-on-request.test.ts",
    "old": "  if (only.target !== inserted) return null;\n",
    "new": "",
    "rc": 1,
    "red": "1 failed | 33 passed (34)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > la"
    ],
    "assertionErrorsOnly": true,
    "sha256": "ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3s",
    "guard": "initialize and render are functions",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-mermaid-on-request.test.ts",
    "variants": [
      {
        "old": "  return typeof m['initialize'] === 'function' && typeof m['render'] === 'function' ? m : null;",
        "new": "  return m;",
        "rc": 1,
        "red": "1 failed | 33 passed (34)",
        "failing": [
          "test/enhance-mermaid-on-request.test.ts > the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > la"
        ],
        "assertionErrorsOnly": true
      },
      {
        "old": "  return typeof m['initialize'] === 'function' && typeof m['render'] === 'function' ? m : null;",
        "new": "  return typeof m['render'] === 'function' ? m : null;",
        "rc": 1,
        "red": "1 failed | 33 passed (34)",
        "failing": [
          "test/enhance-mermaid-on-request.test.ts > the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > la"
        ],
        "assertionErrorsOnly": true
      },
      {
        "old": "  return typeof m['initialize'] === 'function' && typeof m['render'] === 'function' ? m : null;",
        "new": "  return typeof m['initialize'] === 'function' ? m : null;",
        "rc": 1,
        "red": "1 failed | 33 passed (34)",
        "failing": [
          "test/enhance-mermaid-on-request.test.ts > the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > la"
        ],
        "assertionErrorsOnly": true
      }
    ],
    "sha256": "ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3t",
    "guard": "the registration is Mermaid's",
    "file": "src/frame-runtime/adapters.ts",
    "tests": "test/enhance-mermaid-on-request.test.ts",
    "old": "  if (detail['name'] !== 'mermaid') return null;\n",
    "new": "",
    "rc": 1,
    "red": "1 failed | 33 passed (34)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > la"
    ],
    "assertionErrorsOnly": true,
    "sha256": "ddb59cd5bbd6c2e09c81b822486e02a2c90a0b89ac37a4324cc8cfc43caba9cc",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3u",
    "guard": "option passed at the call site",
    "file": "src/frame-runtime/bootstrap.ts",
    "tests": "test/enhance-mermaid-on-request.test.ts",
    "old": "...mermaidOption(seed.mermaid, mermaidModule, () => lateBuild),",
    "new": "...(seed.mermaid === null || mermaidModule === null ? {} : mermaidOption(seed.mermaid, mermaidModule, () => lateBuild)),",
    "rc": 1,
    "red": "1 failed | 33 passed (34)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > th"
    ],
    "assertionErrorsOnly": true,
    "sha256": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85",
    "restored": true,
    "generatedOutputsUnchanged": true
  },
  {
    "id": "B3v",
    "guard": "target through the captured accessor",
    "file": "src/frame-runtime/bootstrap.ts",
    "tests": "test/enhance-mermaid-on-request.test.ts",
    "old": "seen.push({ target: target.call(e), detail:",
    "new": "seen.push({ target: e.target, detail:",
    "rc": 1,
    "red": "1 failed | 33 passed (34)",
    "failing": [
      "test/enhance-mermaid-on-request.test.ts > the bootstrap's pass-through of the seed's draw (src/frame-runtime/adapters.ts; the unit half of L3.D5) > th"
    ],
    "assertionErrorsOnly": true,
    "sha256": "ecb948395860ae15ae794240d1266d48400911506c69828c270904901d7dca85",
    "restored": true,
    "generatedOutputsUnchanged": true
  }
]
```
