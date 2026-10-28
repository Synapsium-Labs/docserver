# L3 Task 12: mutation rows (exports, README, consumer smoke)

Each guard of Task 12, changed once, with what goes red: the README's Hosting section, its hash list and its stylesheet-hash rule (L3.H9), the "Hosting on your own origin" recipes (L3.H10), the bridge's wire grammar and the release verification commands (L3.BR1, L3.RV1), the packed-consumer smoke's frame-layer checks (the plan's four smoke rows, L3.SMa to L3.SMd, with L3.SMc2), and the guards the task added (L3.SMe, L3.SMf and L3.SMh, import-inertness; L3.SMg, the no-DOM typecheck; L3.BC1, `bridgeCases()`'s protocol check; L3.PK1 and L3.PK2, the package rows for the build and `files`).

**Result.** 20 rows, 20 red, every one through failing vitest assertions (`AssertionError`); no row counts a setup, type or timeout error, and every log ends with the command's exit code. Measured on the code of this task after its fix round, 2026-10-28, Node 24.14.1; none of these rows drives a browser. L3.BC1, L3.PK1 and L3.PK2 are the first round's measurements: the fix round changed neither their files nor their tests.

**Method** (Global Constraints, "Low disk"; C69, C75). One row at a time, in place in the task's own worktree, never in parallel and never in a copy of the repository (the pack project's own staging copy, made and deleted by `test/pack.test.ts` in the system temporary directory, is the test's). For each row: the file's original bytes and their sha256 were saved in the scratch directory outside the worktree; the `old` text was checked to occur exactly once and replaced by `new`; the thread count was measured (`ps -L -u "$(id -u)" --no-headers | wc -l`, the `threads` field) and the command ran under `ulimit -u` that count plus 1500 and `timeout -k 10 600`, its output and then its exit code captured to a log; the file was then restored from the saved bytes and its sha256 compared (never `git checkout`).

Notes on the measurement.
- Fix round (reviews EV1, EV2): the first round measured L3.SMb, L3.SMe and L3.SMf by running the smoke by hand on tarball variants, and no standing test reproduced them. `test/pack.test.ts` now packs a defective tarball beside the passing one, with four defects: `assets.json` leaves `fonts/README.md` out, `meta-appended.html` is the clean template (a mutant its own M8.3 scan passes), `dist/render/highlight.js` starts a timer at import (only `./highlight` reaches it) and `dist/frame/protocol.js` reads `document` at import (`./frame` and `./host` reach it). Its row asserts the smoke's whole output and exit 1. Each smoke check is now a row here that deletes or weakens the check in `scripts/consumer-smoke.mjs` and goes red through that assertion. Before the fix, that row was red against the old smoke (its in-process probe printed the passing line, because `dist/render/highlight.js` and `dist/frame/protocol.js` were already in the module cache when its traps went in); that red is in the fix round's report.
- L3.SMh mutates the fix itself: the fresh-process probe loads `./render` before its traps, as the in-process check did, and the timer in `dist/render/highlight.js` goes unseen.
- L3.SMc mutates `scripts/frame-scans.mjs`, the one implementation of the srcdoc scans; `test/frame-mutants.test.ts` would go red on the same change, and the row records the pack project's red only.
- L3.H10b's typecheck row fails with `Object literal may only specify known properties, but 'onLinks' does not exist in type 'EnhanceOptions'`; the pairing row fails too, because `onLink:` no longer appears in that recipe. L3.H10c fails only the pairing row: the recipe still typechecks.
- L3.SMa makes the smoke print two failing lines: the exports map that is not exactly the public surface, and `frame-runtime`'s import failing with `ERR_MODULE_NOT_FOUND` instead of `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- L3.SMd's only difference in the smoke's output is the font-notice line: the stage built, hashed and packed the notice-less stylesheet consistently, so every other check holds.

## L3.H9: the Hosting section, its hash list and its stylesheet-hash rule (`README.md`)

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.H9a | delete the paragraph: the host-page policy, its policy block and its three fallback outcomes | `README.md` | `**The host page's own policy binds the frame.** A srcdoc frame inherits its embedder's Con…` → (removed) | `test/readme.test.ts`: exit 1, 3 failed \| 38 passed (41). "README: Hosting (./host) > L3.H9: states the host-page requirement for scripts, style, fonts and images, and the three fallback outcomes"; "README: Hosting (./host) > L3.H9: its hash list is frameCsp()'s four script hashes of this version, in order, and the policy is quoted whole" (+1 more) | sha256 94a673aa9ca111f91d43e64f35828b98765ccac1e6ab164f7d13e3f8fea96e44 restored, equal |
| L3.H9b | a stale hash list: one character of enhance.js's hash source changed in the README only | `README.md` | `'sha256-AHliXMMKVzo2lZ+/k1c9XKUOws1uJUE5FRfbbMqvKSk='` → `'sha256-AHljXMMKVzo2lZ+/k1c9XKUOws1uJUE5FRfbbMqvKSk='` | `test/readme.test.ts`: exit 1, 1 failed \| 40 passed (41). "README: Hosting (./host) > L3.H9: its hash list is frameCsp()'s four script hashes of this version, in order, and the policy is quoted whole" | sha256 94a673aa9ca111f91d43e64f35828b98765ccac1e6ab164f7d13e3f8fea96e44 restored, equal |
| L3.H9c | the stylesheet-hash rule widened back to every document without Mermaid (review S3) | `README.md` | `which serves only documents with neither Mermaid nor an aligned table: Mermaid's drawings …` → `which serves only documents without Mermaid (Mermaid's drawings carry inline styles of the…` | `test/readme.test.ts`: exit 1, 1 failed \| 40 passed (41). "README: Hosting (./host) > states the Mermaid duties handed to the README: no stock Mermaid with start-on-load on, and a stylesheet-hash policy only without Mermaid (ledger C94(3))" | sha256 94a673aa9ca111f91d43e64f35828b98765ccac1e6ab164f7d13e3f8fea96e44 restored, equal |

```json
[
  {
    "id": "L3.H9a",
    "guard": "delete the paragraph: the host-page policy, its policy block and its three fallback outcomes",
    "file": "README.md",
    "old": "**The host page's own policy binds the frame.** A srcdoc frame inherits its embedder's Content Security Policy, so the page that uses `mountDocFrame` must not block what the frame needs:\n\n- scripts: set no `script-src` (and no `default-src` that governs scripts), or list all four of `frameCsp()`'s hash sources in the page's own `script-src` (a nonce for the page's own scripts may sit beside them);\n- style: allow inline style, with `'unsafe-inline'`, or with the hash of `frame/reader.css`'s exact text, which serves only documents with neither Mermaid nor an aligned table: Mermaid's drawings carry inline styles of their own, and an aligned table cell carries its alignment (`text-align:left`, `right` or `center`) in a `style` attribute, which no stylesheet hash admits;\n- fonts and images: allow `data:` in `font-src` and `img-src` (or in `default-src`).\n\nThis version's frame policy, whose four hash sources a page's `script-src` lists:\n\n```text\ndefault-src 'none'; script-src 'sha256-/zwl2lcDvAbUDKBBKy52DGGac6QVMwb00PO2Yr2mXE0=' 'sha256-dmDWLV7cSNtSAgX9LSQEH0CbNScLJznV9DSXq+8GMQw=' 'sha256-AHliXMMKVzo2lZ+/k1c9XKUOws1uJUE5FRfbbMqvKSk=' 'sha256-dYWyBVujhrms/3G5yKDECzbex5whBqSqVgSMj+WYMsM='; style-src 'unsafe-inline' data:; font-src data:; img-src data:; base-uri 'none'; form-action 'none'\n```\n\nA page that blocks any of them gets a fallback; the frame is never left partly working:\n\n1. scripts blocked, or the bootstrap's hash missing: no ready, and `onFallback('timeout')` when the watchdog runs out;\n2. enhance's, the guard's or Mermaid's hash missing: ready, then the frame's error, then `onFallback('error')`;\n3. style, fonts or images blocked: ready, then the frame's error, then `onFallback('error')`.\n\n",
    "new": "(removed)",
    "tests": "test/readme.test.ts",
    "command": "./node_modules/.bin/vitest run test/readme.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1497,
    "red": "3 failed | 38 passed (41)",
    "failing": [
      "README: Hosting (./host) > L3.H9: states the host-page requirement for scripts, style, fonts and images, and the three fallback outcomes",
      "README: Hosting (./host) > L3.H9: its hash list is frameCsp()'s four script hashes of this version, in order, and the policy is quoted whole",
      "README: Hosting (./host) > states the Mermaid duties handed to the README: no stock Mermaid with start-on-load on, and a stylesheet-hash policy only without Mermaid (ledger C94(3))"
    ],
    "restore": "sha256 94a673aa9ca111f91d43e64f35828b98765ccac1e6ab164f7d13e3f8fea96e44 restored, equal"
  },
  {
    "id": "L3.H9b",
    "guard": "a stale hash list: one character of enhance.js's hash source changed in the README only",
    "file": "README.md",
    "old": "'sha256-AHliXMMKVzo2lZ+/k1c9XKUOws1uJUE5FRfbbMqvKSk='",
    "new": "'sha256-AHljXMMKVzo2lZ+/k1c9XKUOws1uJUE5FRfbbMqvKSk='",
    "tests": "test/readme.test.ts",
    "command": "./node_modules/.bin/vitest run test/readme.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1501,
    "red": "1 failed | 40 passed (41)",
    "failing": [
      "README: Hosting (./host) > L3.H9: its hash list is frameCsp()'s four script hashes of this version, in order, and the policy is quoted whole"
    ],
    "restore": "sha256 94a673aa9ca111f91d43e64f35828b98765ccac1e6ab164f7d13e3f8fea96e44 restored, equal"
  },
  {
    "id": "L3.H9c",
    "guard": "the stylesheet-hash rule widened back to every document without Mermaid (review S3)",
    "file": "README.md",
    "old": "which serves only documents with neither Mermaid nor an aligned table: Mermaid's drawings carry inline styles of their own, and an aligned table cell carries its alignment (`text-align:left`, `right` or `center`) in a `style` attribute, which no stylesheet hash admits;",
    "new": "which serves only documents without Mermaid (Mermaid's drawings carry inline styles of their own);",
    "tests": "test/readme.test.ts",
    "command": "./node_modules/.bin/vitest run test/readme.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1498,
    "red": "1 failed | 40 passed (41)",
    "failing": [
      "README: Hosting (./host) > states the Mermaid duties handed to the README: no stock Mermaid with start-on-load on, and a stylesheet-hash policy only without Mermaid (ledger C94(3))"
    ],
    "restore": "sha256 94a673aa9ca111f91d43e64f35828b98765ccac1e6ab164f7d13e3f8fea96e44 restored, equal"
  }
]
```

## L3.H10: the "Hosting on your own origin" recipes (`README.md`)

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.H10a | delete one recipe (bar → chrome.bar) | `README.md` | `` ```ts⏎ // bar → chrome.bar⏎ import type { EnhanceOptions } from '@synapsium-labs/docserver/enhance';⏎ … ``` `` → (removed) | `test/readme.test.ts`: exit 1, 2 failed \| 39 passed (41). "README: Hosting on your own origin (ledger C50, plan Q13) > L3.H10: names each of the five URL options beside the adapter that replaces it, one recipe each"; "README: Hosting on your own origin (ledger C50, plan Q13) > L3.H10: every recipe typechecks against EnhanceOptions under the strict settings" | sha256 94a673aa9ca111f91d43e64f35828b98765ccac1e6ab164f7d13e3f8fea96e44 restored, equal |
| L3.H10b | rename an adapter in a recipe (onLink → onLinks): red by the typecheck | `README.md` | `  onLink: (href, how) => {` → `  onLinks: (href, how) => {` | `test/readme.test.ts`: exit 1, 2 failed \| 39 passed (41). "README: Hosting on your own origin (ledger C50, plan Q13) > L3.H10: names each of the five URL options beside the adapter that replaces it, one recipe each"; "README: Hosting on your own origin (ledger C50, plan Q13) > L3.H10: every recipe typechecks against EnhanceOptions under the strict settings" | sha256 94a673aa9ca111f91d43e64f35828b98765ccac1e6ab164f7d13e3f8fea96e44 restored, equal |
| L3.H10c | delete the recipe's first line, the only place the old option bar is named (review EV4) | `README.md` | `` ```ts⏎ // bar → chrome.bar⏎  `` → `` ```ts⏎  `` | `test/readme.test.ts`: exit 1, 1 failed \| 40 passed (41). "README: Hosting on your own origin (ledger C50, plan Q13) > L3.H10: names each of the five URL options beside the adapter that replaces it, one recipe each" | sha256 94a673aa9ca111f91d43e64f35828b98765ccac1e6ab164f7d13e3f8fea96e44 restored, equal |

```json
[
  {
    "id": "L3.H10a",
    "guard": "delete one recipe (bar → chrome.bar)",
    "file": "README.md",
    "old": "```ts\n// bar → chrome.bar\nimport type { EnhanceOptions } from '@synapsium-labs/docserver/enhance';\n\n// The host keeps its own bar above the document, so the reader builds none; its rail and settings menu stay.\nexport const options: EnhanceOptions = {\n  chrome: { bar: false },\n};\n```\n\n",
    "new": "(removed)",
    "tests": "test/readme.test.ts",
    "command": "./node_modules/.bin/vitest run test/readme.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1529,
    "red": "2 failed | 39 passed (41)",
    "failing": [
      "README: Hosting on your own origin (ledger C50, plan Q13) > L3.H10: names each of the five URL options beside the adapter that replaces it, one recipe each",
      "README: Hosting on your own origin (ledger C50, plan Q13) > L3.H10: every recipe typechecks against EnhanceOptions under the strict settings"
    ],
    "restore": "sha256 94a673aa9ca111f91d43e64f35828b98765ccac1e6ab164f7d13e3f8fea96e44 restored, equal"
  },
  {
    "id": "L3.H10b",
    "guard": "rename an adapter in a recipe (onLink → onLinks): red by the typecheck",
    "file": "README.md",
    "old": "  onLink: (href, how) => {",
    "new": "  onLinks: (href, how) => {",
    "tests": "test/readme.test.ts",
    "command": "./node_modules/.bin/vitest run test/readme.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1524,
    "red": "2 failed | 39 passed (41)",
    "failing": [
      "README: Hosting on your own origin (ledger C50, plan Q13) > L3.H10: names each of the five URL options beside the adapter that replaces it, one recipe each",
      "README: Hosting on your own origin (ledger C50, plan Q13) > L3.H10: every recipe typechecks against EnhanceOptions under the strict settings"
    ],
    "restore": "sha256 94a673aa9ca111f91d43e64f35828b98765ccac1e6ab164f7d13e3f8fea96e44 restored, equal"
  },
  {
    "id": "L3.H10c",
    "guard": "delete the recipe's first line, the only place the old option bar is named (review EV4)",
    "file": "README.md",
    "old": "```ts\n// bar → chrome.bar\n",
    "new": "```ts\n",
    "tests": "test/readme.test.ts",
    "command": "./node_modules/.bin/vitest run test/readme.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1480,
    "red": "1 failed | 40 passed (41)",
    "failing": [
      "README: Hosting on your own origin (ledger C50, plan Q13) > L3.H10: names each of the five URL options beside the adapter that replaces it, one recipe each"
    ],
    "restore": "sha256 94a673aa9ca111f91d43e64f35828b98765ccac1e6ab164f7d13e3f8fea96e44 restored, equal"
  }
]
```

## The bridge and Release verification (`README.md`)

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.BR1 | the flat-string rule widened back to every message, changes.result included (reviews T12-C1, S2) | `README.md` | `` Every message the frame sends is a flat object whose values are strings, except `v`; the p… `` → `` Every message is a flat object whose values are strings, except `v`; anything else is refu… `` | `test/readme.test.ts`: exit 1, 1 failed \| 40 passed (41). "README: the bridge > scopes the flat rule to what the frame sends, and states the shapes changes.result carries, which the accepted fixtures hold (review T12-C1)" | sha256 94a673aa9ca111f91d43e64f35828b98765ccac1e6ab164f7d13e3f8fea96e44 restored, equal |
| L3.RV1 | drop the command that fetches the tarball the integrity and attestation commands read (reviews T12-C2, S1) | `README.md` | `npm pack @synapsium-labs/docserver@$VERSION⏎ ` → (removed) | `test/readme.test.ts`: exit 1, 2 failed \| 39 passed (41). "README: Release verification > states the release lane's post-verify commands, verbatim, one per line (plan Reference §13 step 7)"; "README: Release verification > every file a command reads is made by an earlier command: npm pack names the tarball the later two read (reviews T12-C2, S1)" | sha256 94a673aa9ca111f91d43e64f35828b98765ccac1e6ab164f7d13e3f8fea96e44 restored, equal |

```json
[
  {
    "id": "L3.BR1",
    "guard": "the flat-string rule widened back to every message, changes.result included (reviews T12-C1, S2)",
    "file": "README.md",
    "old": "Every message the frame sends is a flat object whose values are strings, except `v`; the parent refuses anything else. Of the parent's messages, `hello` and `prefs` are flat in the same way, and `changes.result` carries `sha` and either `ranges`, a list of `[from, to]` pairs of integers, with or without `removedAfter`, a list of integers, or `unavailable: true` alone; the frame ignores anything else.",
    "new": "Every message is a flat object whose values are strings, except `v`; anything else is refused.",
    "tests": "test/readme.test.ts",
    "command": "./node_modules/.bin/vitest run test/readme.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1504,
    "red": "1 failed | 40 passed (41)",
    "failing": [
      "README: the bridge > scopes the flat rule to what the frame sends, and states the shapes changes.result carries, which the accepted fixtures hold (review T12-C1)"
    ],
    "restore": "sha256 94a673aa9ca111f91d43e64f35828b98765ccac1e6ab164f7d13e3f8fea96e44 restored, equal"
  },
  {
    "id": "L3.RV1",
    "guard": "drop the command that fetches the tarball the integrity and attestation commands read (reviews T12-C2, S1)",
    "file": "README.md",
    "old": "npm pack @synapsium-labs/docserver@$VERSION\n",
    "new": "(removed)",
    "tests": "test/readme.test.ts",
    "command": "./node_modules/.bin/vitest run test/readme.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1495,
    "red": "2 failed | 39 passed (41)",
    "failing": [
      "README: Release verification > states the release lane's post-verify commands, verbatim, one per line (plan Reference §13 step 7)",
      "README: Release verification > every file a command reads is made by an earlier command: npm pack names the tarball the later two read (reviews T12-C2, S1)"
    ],
    "restore": "sha256 94a673aa9ca111f91d43e64f35828b98765ccac1e6ab164f7d13e3f8fea96e44 restored, equal"
  }
]
```

## The smoke (`scripts/consumer-smoke.mjs`, the packed package)

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.SMa | export ./frame-runtime (an exports entry for the frame runtime) | `package.json` | `    "./highlight": {` → `    "./frame-runtime": {⏎       "types": "./dist/frame-runtime/index.d.ts",⏎       "import…` | `test/pack.test.ts (the pack project)`: exit 1, 3 failed \| 12 passed (15). "the packed package, imported by name > passes the whole corpus through the consumer smoke"; "the packed package, imported by name > fails, naming the case, when the packed corpus does not pass" (+1 more) | sha256 7240f27d8661b348f40533d0b6702923d261e6daf37045871f6a19fe664905b5 restored, equal |
| L3.SMb | drop the check that every installed asset is listed in assets.json (the listing loop never reports) | `scripts/consumer-smoke.mjs` | `for (const p of onDisk) if (!listed.has(p)) assetProblems.push(` → `for (const p of onDisk) if (false) assetProblems.push(` | `test/pack.test.ts (the pack project; the defective tarball)`: exit 1, 1 failed \| 14 passed (15). "the packed package with a defect for each frame-layer check (reviews EV1, EV2) > fails, naming each defect, and prints every other line as the passing run does" | sha256 e8c0742e89bbb43b97707c6b550de60b9713135af7432ef9493bb5d4c274c8a9 restored, equal |
| L3.SMc | ship a mutant-tolerant scan: the M8.4 URL scan answers no problem whatever it finds | `scripts/frame-scans.mjs` | `  return out;⏎ }⏎ ⏎ /** M8.8: the seed` → `  return out.length >= 0 ? [] : out;⏎ }⏎ ⏎ /** M8.8: the seed` | `test/pack.test.ts (the pack project)`: exit 1, 3 failed \| 12 passed (15). "the packed package, imported by name > passes the whole corpus through the consumer smoke"; "the packed package, imported by name > fails, naming the case, when the packed corpus does not pass" (+1 more) | sha256 8278698af835dececbce78c289cb838aa364f4f34ead585f61597fee1b82a76f restored, equal |
| L3.SMc2 | drop the check that each shipped mutant fails its own row's scan (the mutant loop never reports) | `scripts/consumer-smoke.mjs` | `  if (scan(expand(readFileSync(path.join(mutantsDir, m.file), 'utf8'))).length === 0) scan…` → `  if (false) scanProblems.push(` | `test/pack.test.ts (the pack project; the defective tarball)`: exit 1, 1 failed \| 14 passed (15). "the packed package with a defect for each frame-layer check (reviews EV1, EV2) > fails, naming each defect, and prints every other line as the passing run does" | sha256 e8c0742e89bbb43b97707c6b550de60b9713135af7432ef9493bb5d4c274c8a9 restored, equal |
| L3.SMd | strip the OFL comment: the frame stylesheet is built without its font notice | `scripts/build-frame.mjs` | `  return fontNotice(root) + PRELUDE + inlined;` → `  return PRELUDE + inlined;` | `test/pack.test.ts (the pack project; the stage builds the frame with the mutated script)`: exit 1, 3 failed \| 12 passed (15). "the packed package, imported by name > passes the whole corpus through the consumer smoke"; "the packed package, imported by name > fails, naming the case, when the packed corpus does not pass" (+1 more) | sha256 27a6e741501aa7f249d11bc77609a17415f0666922ac61eeb95e2fc5285b632e restored, equal; node scripts/build-frame.mjs --check green afterwards |

```json
[
  {
    "id": "L3.SMa",
    "guard": "export ./frame-runtime (an exports entry for the frame runtime)",
    "file": "package.json",
    "old": "    \"./highlight\": {",
    "new": "    \"./frame-runtime\": {\n      \"types\": \"./dist/frame-runtime/index.d.ts\",\n      \"import\": \"./dist/frame-runtime/index.js\"\n    },\n    \"./highlight\": {",
    "tests": "test/pack.test.ts (the pack project)",
    "command": "./node_modules/.bin/vitest run --project pack --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1494,
    "red": "3 failed | 12 passed (15)",
    "failing": [
      "the packed package, imported by name > passes the whole corpus through the consumer smoke",
      "the packed package, imported by name > fails, naming the case, when the packed corpus does not pass",
      "the packed package with a defect for each frame-layer check (reviews EV1, EV2) > fails, naming each defect, and prints every other line as the passing run does"
    ],
    "restore": "sha256 7240f27d8661b348f40533d0b6702923d261e6daf37045871f6a19fe664905b5 restored, equal"
  },
  {
    "id": "L3.SMb",
    "guard": "drop the check that every installed asset is listed in assets.json (the listing loop never reports)",
    "file": "scripts/consumer-smoke.mjs",
    "old": "for (const p of onDisk) if (!listed.has(p)) assetProblems.push(",
    "new": "for (const p of onDisk) if (false) assetProblems.push(",
    "tests": "test/pack.test.ts (the pack project; the defective tarball)",
    "command": "./node_modules/.bin/vitest run --project pack --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1526,
    "red": "1 failed | 14 passed (15)",
    "failing": [
      "the packed package with a defect for each frame-layer check (reviews EV1, EV2) > fails, naming each defect, and prints every other line as the passing run does"
    ],
    "restore": "sha256 e8c0742e89bbb43b97707c6b550de60b9713135af7432ef9493bb5d4c274c8a9 restored, equal"
  },
  {
    "id": "L3.SMc",
    "guard": "ship a mutant-tolerant scan: the M8.4 URL scan answers no problem whatever it finds",
    "file": "scripts/frame-scans.mjs",
    "old": "  return out;\n}\n\n/** M8.8: the seed",
    "new": "  return out.length >= 0 ? [] : out;\n}\n\n/** M8.8: the seed",
    "tests": "test/pack.test.ts (the pack project)",
    "command": "./node_modules/.bin/vitest run --project pack --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1509,
    "red": "3 failed | 12 passed (15)",
    "failing": [
      "the packed package, imported by name > passes the whole corpus through the consumer smoke",
      "the packed package, imported by name > fails, naming the case, when the packed corpus does not pass",
      "the packed package with a defect for each frame-layer check (reviews EV1, EV2) > fails, naming each defect, and prints every other line as the passing run does"
    ],
    "restore": "sha256 8278698af835dececbce78c289cb838aa364f4f34ead585f61597fee1b82a76f restored, equal"
  },
  {
    "id": "L3.SMc2",
    "guard": "drop the check that each shipped mutant fails its own row's scan (the mutant loop never reports)",
    "file": "scripts/consumer-smoke.mjs",
    "old": "  if (scan(expand(readFileSync(path.join(mutantsDir, m.file), 'utf8'))).length === 0) scanProblems.push(",
    "new": "  if (false) scanProblems.push(",
    "tests": "test/pack.test.ts (the pack project; the defective tarball)",
    "command": "./node_modules/.bin/vitest run --project pack --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1487,
    "red": "1 failed | 14 passed (15)",
    "failing": [
      "the packed package with a defect for each frame-layer check (reviews EV1, EV2) > fails, naming each defect, and prints every other line as the passing run does"
    ],
    "restore": "sha256 e8c0742e89bbb43b97707c6b550de60b9713135af7432ef9493bb5d4c274c8a9 restored, equal"
  },
  {
    "id": "L3.SMd",
    "guard": "strip the OFL comment: the frame stylesheet is built without its font notice",
    "file": "scripts/build-frame.mjs",
    "old": "  return fontNotice(root) + PRELUDE + inlined;",
    "new": "  return PRELUDE + inlined;",
    "tests": "test/pack.test.ts (the pack project; the stage builds the frame with the mutated script)",
    "command": "./node_modules/.bin/vitest run --project pack --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1501,
    "red": "3 failed | 12 passed (15)",
    "failing": [
      "the packed package, imported by name > passes the whole corpus through the consumer smoke",
      "the packed package, imported by name > fails, naming the case, when the packed corpus does not pass",
      "the packed package with a defect for each frame-layer check (reviews EV1, EV2) > fails, naming each defect, and prints every other line as the passing run does"
    ],
    "restore": "sha256 27a6e741501aa7f249d11bc77609a17415f0666922ac61eeb95e2fc5285b632e restored, equal; node scripts/build-frame.mjs --check green afterwards"
  }
]
```

## Guards the task added

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.SMe | the import probe sets no DOM trap for ./host | `scripts/consumer-smoke.mjs` | `if (dom === 'dom') {` → `if (dom === 'never') {` | `test/pack.test.ts (the pack project; the defective tarball)`: exit 1, 1 failed \| 14 passed (15). "the packed package with a defect for each frame-layer check (reviews EV1, EV2) > fails, naming each defect, and prints every other line as the passing run does" | sha256 e8c0742e89bbb43b97707c6b550de60b9713135af7432ef9493bb5d4c274c8a9 restored, equal |
| L3.SMf | the import probe sets no timer trap | `scripts/consumer-smoke.mjs` | `trap(TIMERS, (name, fn) => (...args) => {` → `trap([], (name, fn) => (...args) => {` | `test/pack.test.ts (the pack project; the defective tarball)`: exit 1, 1 failed \| 14 passed (15). "the packed package with a defect for each frame-layer check (reviews EV1, EV2) > fails, naming each defect, and prints every other line as the passing run does" | sha256 e8c0742e89bbb43b97707c6b550de60b9713135af7432ef9493bb5d4c274c8a9 restored, equal |
| L3.SMh | the import probe loads ./render before its traps, as the old in-process check had (review EV1): a module an entry shares is judged from the cache | `scripts/consumer-smoke.mjs` | `const [spec, dom] = process.argv.slice(2);⏎ ` → `const [spec, dom] = process.argv.slice(2);⏎ await import('@synapsium-labs/docserver/render…` | `test/pack.test.ts (the pack project; the defective tarball)`: exit 1, 1 failed \| 14 passed (15). "the packed package with a defect for each frame-layer check (reviews EV1, EV2) > fails, naming each defect, and prints every other line as the passing run does" | sha256 e8c0742e89bbb43b97707c6b550de60b9713135af7432ef9493bb5d4c274c8a9 restored, equal |
| L3.SMg | drop the no-DOM typecheck of ./frame and ./highlight | `scripts/consumer-smoke.mjs` | `    run(process.execPath, [TSC, '-p', 'tsconfig.pure.json'], dir);⏎ ` → (removed) | `test/consumer-smoke.test.ts`: exit 1, 1 failed \| 12 passed (13). "scripts/consumer-smoke.mjs: the strict consumer typecheck > fails the smoke when a ./frame declaration names a DOM type, which the DOM project alone cannot see" | sha256 e8c0742e89bbb43b97707c6b550de60b9713135af7432ef9493bb5d4c274c8a9 restored, equal |
| L3.BC1 | bridgeCases() accepts fixtures of another protocol | `src/conformance/bridge.ts` | `  if (o['bridgeProtocol'] !== BRIDGE_PROTOCOL) {` → `  if (o['bridgeProtocol'] !== BRIDGE_PROTOCOL && false) {` | `test/api.test.ts`: exit 1, 1 failed \| 13 passed (14). "./conformance: bridgeCases() > refuses a fixtures file of another protocol, or one missing a part, as loadCorpus refuses a corpus it cannot load" | sha256 e0ead332977bced283ce96b95b2547fa3f8463a16b2e702d17ffa5a19ac85f59 restored, equal |
| L3.PK1 | the package build leaves src/host out again (C88(6)'s row, updated) | `tsconfig.build.json` | `"exclude": ["test", "src/frame-runtime"]` → `"exclude": ["test", "src/frame-runtime", "src/host"]` | `test/package.test.ts`: exit 1, 2 failed \| 19 passed (21). "package.json: identity > the package build includes src/frame and src/host, which ./frame and ./host export (Task 12), and leaves src/frame-runtime out"; "package.json: identity > the package build includes src/highlight, which ./highlight exports (Task 12); it excludes only the tests and the frame runtime" | sha256 c474148f09c560ac232dd7750cfc9495eaaee5312972edf39cb3089b43828b71 restored, equal |
| L3.PK2 | files leaves out the labelled frame mutants | `package.json` | `    "conformance/frame-mutants",⏎ ` → (removed) | `test/package.test.ts`: exit 1, 1 failed \| 20 passed (21). "package.json: exports keys > ships the bridge fixtures and the labelled frame mutants (plan Reference §12)" | sha256 7240f27d8661b348f40533d0b6702923d261e6daf37045871f6a19fe664905b5 restored, equal |

```json
[
  {
    "id": "L3.SMe",
    "guard": "the import probe sets no DOM trap for ./host",
    "file": "scripts/consumer-smoke.mjs",
    "old": "if (dom === 'dom') {",
    "new": "if (dom === 'never') {",
    "tests": "test/pack.test.ts (the pack project; the defective tarball)",
    "command": "./node_modules/.bin/vitest run --project pack --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1528,
    "red": "1 failed | 14 passed (15)",
    "failing": [
      "the packed package with a defect for each frame-layer check (reviews EV1, EV2) > fails, naming each defect, and prints every other line as the passing run does"
    ],
    "restore": "sha256 e8c0742e89bbb43b97707c6b550de60b9713135af7432ef9493bb5d4c274c8a9 restored, equal"
  },
  {
    "id": "L3.SMf",
    "guard": "the import probe sets no timer trap",
    "file": "scripts/consumer-smoke.mjs",
    "old": "trap(TIMERS, (name, fn) => (...args) => {",
    "new": "trap([], (name, fn) => (...args) => {",
    "tests": "test/pack.test.ts (the pack project; the defective tarball)",
    "command": "./node_modules/.bin/vitest run --project pack --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1454,
    "red": "1 failed | 14 passed (15)",
    "failing": [
      "the packed package with a defect for each frame-layer check (reviews EV1, EV2) > fails, naming each defect, and prints every other line as the passing run does"
    ],
    "restore": "sha256 e8c0742e89bbb43b97707c6b550de60b9713135af7432ef9493bb5d4c274c8a9 restored, equal"
  },
  {
    "id": "L3.SMh",
    "guard": "the import probe loads ./render before its traps, as the old in-process check had (review EV1): a module an entry shares is judged from the cache",
    "file": "scripts/consumer-smoke.mjs",
    "old": "const [spec, dom] = process.argv.slice(2);\n",
    "new": "const [spec, dom] = process.argv.slice(2);\nawait import('@synapsium-labs/docserver/render');\n",
    "tests": "test/pack.test.ts (the pack project; the defective tarball)",
    "command": "./node_modules/.bin/vitest run --project pack --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1500,
    "red": "1 failed | 14 passed (15)",
    "failing": [
      "the packed package with a defect for each frame-layer check (reviews EV1, EV2) > fails, naming each defect, and prints every other line as the passing run does"
    ],
    "restore": "sha256 e8c0742e89bbb43b97707c6b550de60b9713135af7432ef9493bb5d4c274c8a9 restored, equal"
  },
  {
    "id": "L3.SMg",
    "guard": "drop the no-DOM typecheck of ./frame and ./highlight",
    "file": "scripts/consumer-smoke.mjs",
    "old": "    run(process.execPath, [TSC, '-p', 'tsconfig.pure.json'], dir);\n",
    "new": "(removed)",
    "tests": "test/consumer-smoke.test.ts",
    "command": "./node_modules/.bin/vitest run test/consumer-smoke.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1479,
    "red": "1 failed | 12 passed (13)",
    "failing": [
      "scripts/consumer-smoke.mjs: the strict consumer typecheck > fails the smoke when a ./frame declaration names a DOM type, which the DOM project alone cannot see"
    ],
    "restore": "sha256 e8c0742e89bbb43b97707c6b550de60b9713135af7432ef9493bb5d4c274c8a9 restored, equal"
  },
  {
    "id": "L3.BC1",
    "guard": "bridgeCases() accepts fixtures of another protocol",
    "file": "src/conformance/bridge.ts",
    "old": "  if (o['bridgeProtocol'] !== BRIDGE_PROTOCOL) {",
    "new": "  if (o['bridgeProtocol'] !== BRIDGE_PROTOCOL && false) {",
    "tests": "test/api.test.ts",
    "command": "./node_modules/.bin/vitest run test/api.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1488,
    "red": "1 failed | 13 passed (14)",
    "failing": [
      "./conformance: bridgeCases() > refuses a fixtures file of another protocol, or one missing a part, as loadCorpus refuses a corpus it cannot load"
    ],
    "restore": "sha256 e0ead332977bced283ce96b95b2547fa3f8463a16b2e702d17ffa5a19ac85f59 restored, equal"
  },
  {
    "id": "L3.PK1",
    "guard": "the package build leaves src/host out again (C88(6)'s row, updated)",
    "file": "tsconfig.build.json",
    "old": "\"exclude\": [\"test\", \"src/frame-runtime\"]",
    "new": "\"exclude\": [\"test\", \"src/frame-runtime\", \"src/host\"]",
    "tests": "test/package.test.ts",
    "command": "./node_modules/.bin/vitest run test/package.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1425,
    "red": "2 failed | 19 passed (21)",
    "failing": [
      "package.json: identity > the package build includes src/frame and src/host, which ./frame and ./host export (Task 12), and leaves src/frame-runtime out",
      "package.json: identity > the package build includes src/highlight, which ./highlight exports (Task 12); it excludes only the tests and the frame runtime"
    ],
    "restore": "sha256 c474148f09c560ac232dd7750cfc9495eaaee5312972edf39cb3089b43828b71 restored, equal"
  },
  {
    "id": "L3.PK2",
    "guard": "files leaves out the labelled frame mutants",
    "file": "package.json",
    "old": "    \"conformance/frame-mutants\",\n",
    "new": "(removed)",
    "tests": "test/package.test.ts",
    "command": "./node_modules/.bin/vitest run test/package.test.ts --maxWorkers=1 --fileParallelism=false",
    "rc": 1,
    "threads": 1432,
    "red": "1 failed | 20 passed (21)",
    "failing": [
      "package.json: exports keys > ships the bridge fixtures and the labelled frame mutants (plan Reference §12)"
    ],
    "restore": "sha256 7240f27d8661b348f40533d0b6702923d261e6daf37045871f6a19fe664905b5 restored, equal"
  }
]
```
