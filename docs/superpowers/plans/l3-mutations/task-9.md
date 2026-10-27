# L3 Task 9: mutation rows (`./host` internals: parser, buckets, store, links, copy)

Each guard of Task 9, changed once, with the tests that go red: the parser (`src/host/parse.ts`), the limiter (`src/host/limits.ts`), the store (`src/host/store.ts`), the link classifier (`src/host/links.ts`) and the hidden-character check (`src/host/copy.ts`). Measured 2026-10-27 (UTC) on branch `l3-t09-host-internals` (base `af42b96`, the Task 9 changes not yet committed), on the code and test files after the review's fix round; the first measurement's 56 rows were measured again, L3.H4k was reversed with the code (it now restores the `error` exemption the fix round removed), and seven rows are new (L3.H4n, L3.H5g, L3.H5h, L3.H6j to L3.H6m).

**Result.** 63 rows, 63 red: every row exits 1 through failing assertions only (every failing test failed with an `AssertionError`; none through a file that failed to load, an unhandled error or a timeout). No row is an equivalent mutant.

**Method** (Global Constraints, "Low disk"; C69, C75). One row at a time, in place in the task's own worktree, never in parallel and never in a copy of the repository. For each row: the file's original bytes and their sha256 were saved outside the worktree; each `old` was checked to occur exactly once and replaced by `new`; the thread count was measured (`ps -L -u "$(id -u)" --no-headers | wc -l`, 1844 to 1995 over the runs) and the row ran as `ulimit -u <threads + 1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 <tests>`, its output captured to a log; the file was then restored from the saved bytes and its sha256 checked equal to the saved one (never `git checkout`). Every restore matched, and after the last row `sha256sum -c` over the ten Task 9 files and the frame build's two committed outputs matched the hashes taken before the first. No row mutates an input of the frame build, so none needs a rebuild; `node scripts/build-frame.mjs --check` is green on the restored tree. The Red column gives the count line and the failing tests (at most five). In the Change column a line break is shown as ⏎; the JSON fence holds the exact text.

Notes on the measurement.
- Several mutants fail closed through another guard and are red through the verdict's reason, not its acceptance: without the op check (L3.H3b) an unknown op reaches the key table, throws, and the parser's catch answers `not-plain` where `unknown-op` is expected. The reason is part of the contract (`bridge-cases.json` names one per refusal), so the row is red.
- L3.H4h needed a test of its own: refilling by fractional milliseconds gives the same verdicts as whole ones whenever the clock starts on a whole millisecond. The row "counts the whole milliseconds the clock has passed: from 0.6 ms to 50.4 ms is 50" was added for it before this measurement.
- L3.H5f needed a fuller budget: with room to spare, evicting the writer's own document is never reached. Its test fills the prefix with a key of the host's own so that the writer's sixth field forces an eviction.
- With the bidi and zero-width refusal in the link classifier, its control check is partly covered twice: the copy table holds the C0 controls but tab and newline, and DEL, so L3.H6b (drop the control check) is red through the C1 controls alone; tab and newline are also white space.

## The parser: `src/host/parse.ts` (L3.H3a to L3.H3u)

Reference §11.3 and every frame-to-parent case of `conformance/bridge-cases.json`. The plan's rows map as: accept any op (L3.H3a, and L3.H3b for the op check alone); skip a cap (L3.H3c value, L3.H3d copy, L3.H3e href); skip the key list (L3.H3f the store key allow-list, L3.H3g the op key set, L3.H3h the required keys); skip the nonce (L3.H3i); skip the JSON value check (L3.H3k); check `hash` against the ID grammar alone (L3.H3l). The other rows cover the parser's remaining guards: protocol, ports, prototype keys, value types, the error reasons, controls in an href, both sha grammars, getters, and caps counted in UTF-8 bytes.

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.H3a | accept any op: every message passes | `src/host/parse.ts` | `  if (!isPlainObject(data)) return refuse('not-plain'); ⏎   const keys` → `  return { ok: true, msg: data as FrameToParent }; ⏎   if (!isPlainObject(data)) return refuse('not-plain'); ⏎   const keys` | `test/host-parse.test.ts`: 68 failed \| 53 passed (121). "a key outside the op set"; "a missing required key: hash without id"; "a missing required key: ready without nonce"; "a missing required key: store.set without value"; "a parent op from the frame"; and 63 more | sha256 `86526658ab14…` restored, equal |
| L3.H3b | accept any op name: the op check is a string check only | `src/host/parse.ts` | `if (typeof t !== 'string' \|\| !(FRAME_OPS as readonly string[]).includes(t)) return refuse('unknown-op');` → `if (typeof t !== 'string') return refuse('unknown-op');` | `test/host-parse.test.ts`: 3 failed \| 118 passed (121). "a parent op from the frame"; "an unknown op"; "a parent op, a frame op of another case and an inherited t are unknown ops" | sha256 `86526658ab14…` restored, equal |
| L3.H3c | skip a cap: the store.set value cap (64 KiB) | `src/host/parse.ts` | `      if (utf8Bytes(value) > BRIDGE_LIMITS.valueMaxBytes) return refuse('oversize'); ⏎ ` → (removed) | `test/host-parse.test.ts`: 2 failed \| 119 passed (121). "store.set a value of 65537 UTF-8 bytes"; "a store.set value of exactly 65536 UTF-8 bytes in two-byte characters passes, one more byte is oversize" | sha256 `86526658ab14…` restored, equal |
| L3.H3d | skip a cap: the copy cap (64 KiB) | `src/host/parse.ts` | `return utf8Bytes(text) <= BRIDGE_LIMITS.copyMaxBytes ? { ok: true, msg: { t: 'copy', text } } : refuse('oversize');` → `return { ok: true, msg: { t: 'copy', text } };` | `test/host-parse.test.ts`: 3 failed \| 118 passed (121). "copy of 65537 UTF-8 bytes"; "copy of 65538 UTF-8 bytes in 21846 code units"; "a lone surrogate counts as three UTF-8 bytes, as a TextEncoder writes it" | sha256 `86526658ab14…` restored, equal |
| L3.H3e | skip a cap: the href cap (4096 code units) | `src/host/parse.ts` | `href.length < 1 \|\| href.length > BRIDGE_LIMITS.hrefMaxChars \|\| hasControl(href)` → `href.length < 1 \|\| hasControl(href)` | `test/host-parse.test.ts`: 1 failed \| 120 passed (121). "navigate 4097 code units" | sha256 `86526658ab14…` restored, equal |
| L3.H3f | skip the key list: the store key allow-list | `src/host/parse.ts` | `      if (!isBridgeStoreKey(key)) return refuse('store-key'); ⏎ ` → (removed) | `test/host-parse.test.ts`: 7 failed \| 114 passed (121). "store.set key doc: outside the allow-list"; "store.set key doc:nope outside the allow-list"; "store.set key doc:pos:doc outside the allow-list"; "store.set key docreader:prefs outside the allow-list"; "store.set key pref: outside the allow-list"; and 2 more | sha256 `86526658ab14…` restored, equal |
| L3.H3g | skip the key list: each op's key set | `src/host/parse.ts` | `  for (const k of keys) if (typeof k !== 'string' \|\| !allowed.includes(k)) return refuse('keys'); ⏎ ` → (removed) | `test/host-parse.test.ts`: 2 failed \| 119 passed (121). "a key outside the op set"; "a getter is refused unread, a symbol key and a hidden key are outside the key set" | sha256 `86526658ab14…` restored, equal |
| L3.H3h | skip the key list: each op's required keys | `src/host/parse.ts` | `  for (const k of REQUIRED_KEYS[op]) if (!keys.includes(k)) return refuse('keys'); ⏎ ` → (removed) | `test/host-parse.test.ts`: 3 failed \| 118 passed (121). "a missing required key: hash without id"; "a missing required key: ready without nonce"; "a missing required key: store.set without value" | sha256 `86526658ab14…` restored, equal |
| L3.H3i | skip the nonce check of ready | `src/host/parse.ts` | `    if (got !== nonce) return refuse('nonce'); ⏎ ` → (removed) | `test/host-parse.test.ts`: 3 failed \| 118 passed (121). "ready with another nonce"; "a ready is accepted only with this mount's nonce: another nonce, a shorter one or the same in upper case is refused"; "the expected nonce is an argument: the same ready is refused against another mount's nonce" | sha256 `86526658ab14…` restored, equal |
| L3.H3j | skip the protocol check of ready | `src/host/parse.ts` | `    if (v !== BRIDGE_PROTOCOL) return refuse('protocol'); ⏎ ` → (removed) | `test/host-parse.test.ts`: 2 failed \| 119 passed (121). "ready with protocol 2"; "a ready of any version but 1 is a protocol refusal, whatever its nonce" | sha256 `86526658ab14…` restored, equal |
| L3.H3k | skip the JSON value check of store.set | `src/host/parse.ts` | `      if (!isJsonText(value)) return refuse('json'); ⏎ ` → (removed) | `test/host-parse.test.ts`: 3 failed \| 118 passed (121). "store.set a value that is not JSON"; "store.set an empty value"; "JSON text with surrounding white space is JSON; a bare word, a trailing comma and NaN are not" | sha256 `86526658ab14…` restored, equal |
| L3.H3l | check hash against the ID grammar alone | `src/host/parse.ts` | `return isFragmentId(id) ? { ok: true, msg: { t: 'hash', id } } : refuse('hash');` → `return /^[A-Z]{1,4}-?\d+(?:[.-]\d+)*[a-z]?$/.test(id) ? { ok: true, msg: { t: 'hash', id } } : refuse('hash');` | `test/host-parse.test.ts`: 12 failed \| 109 passed (121). "every message of every timed sequence is accepted by the parser (only the limiter refuses them)"; "hash "AB-12-C""; "hash "\u4e2d\u6587""; "hash "anchor_1""; "hash "cafe\u0301""; and 7 more | sha256 `86526658ab14…` restored, equal |
| L3.H3m | skip the port check: a message carrying a port passes | `src/host/parse.ts` | `if (!Array.isArray(ports) \|\| ports.length !== 0) return refuse('port');` → `if (!Array.isArray(ports)) return refuse('port');` | `test/host-parse.test.ts`: 2 failed \| 119 passed (121). "a message carrying a port"; "a message with ports is refused before it is read, and ports that are not an array refuse too" | sha256 `86526658ab14…` restored, equal |
| L3.H3n | skip the prototype-key check | `src/host/parse.ts` | `  for (const k of PROTO_KEYS) if (keys.includes(k)) return refuse('proto-key'); ⏎ ` → (removed) | `test/host-parse.test.ts`: 3 failed \| 118 passed (121). "an own __proto__ key"; "an own constructor key"; "an own prototype key" | sha256 `86526658ab14…` restored, equal |
| L3.H3o | skip the value type check (every value a string) | `src/host/parse.ts` | `  for (const v of values.values()) if (typeof v !== 'string') return refuse('type'); ⏎ ` → (removed) | `test/host-parse.test.ts`: 4 failed \| 117 passed (121). "a value not a string: error why null"; "a value not a string: hash id a number"; "a value not a string: store.set value an object"; "a value not a string: version sha null (null keys are omitted)" | sha256 `86526658ab14…` restored, equal |
| L3.H3p | skip the error's closed set of reasons | `src/host/parse.ts` | `return (ERROR_WHY as readonly string[]).includes(why) ? { ok: true, msg: { t: 'error', why: why as ErrorWhy } } : refuse('why');` → `return { ok: true, msg: { t: 'error', why: why as ErrorWhy } };` | `test/host-parse.test.ts`: 2 failed \| 119 passed (121). "error why in another case"; "error why outside the closed set" | sha256 `86526658ab14…` restored, equal |
| L3.H3q | skip navigate's control check | `src/host/parse.ts` | `href.length > BRIDGE_LIMITS.hrefMaxChars \|\| hasControl(href)) return refuse('href');` → `href.length > BRIDGE_LIMITS.hrefMaxChars) return refuse('href');` | `test/host-parse.test.ts`: 4 failed \| 117 passed (121). "navigate with DEL"; "navigate with a C0 control"; "navigate with a C1 control"; "navigate refuses every C0, DEL and C1 code unit and accepts the characters beside them" | sha256 `86526658ab14…` restored, equal |
| L3.H3r | skip changes' sha grammar | `src/host/parse.ts` | `return isFullSha(sha) ? { ok: true, msg: { t: 'changes', sha } } : refuse('sha');` → `return { ok: true, msg: { t: 'changes', sha } };` | `test/host-parse.test.ts`: 3 failed \| 118 passed (121). "changes 41 hex digits"; "changes a short sha"; "changes an upper-case sha" | sha256 `86526658ab14…` restored, equal |
| L3.H3s | skip version's sha grammar | `src/host/parse.ts` | `        if (!isFullSha(v)) return refuse('sha'); ⏎ ` → (removed) | `test/host-parse.test.ts`: 2 failed \| 119 passed (121). "version a 39-hex sha"; "version only a short commit" | sha256 `86526658ab14…` restored, equal |
| L3.H3t | read a value by property access (a getter is called) | `src/host/parse.ts` | `    if (d === undefined \|\| !('value' in d)) return refuse('type'); ⏎     values.set(k, d.value);` → `    if (d === undefined) return refuse('type'); ⏎     values.set(k, (data as Record<string, unknown>)[k]);` | `test/host-parse.test.ts`: 1 failed \| 120 passed (121). "a getter is refused unread, a symbol key and a hidden key are outside the key set" | sha256 `86526658ab14…` restored, equal |
| L3.H3u | count a cap in UTF-16 code units, not UTF-8 bytes | `src/host/parse.ts` | `export function utf8Bytes(s: string): number { ⏎   let n = 0;` → `export function utf8Bytes(s: string): number { ⏎   return s.length; ⏎   let n = 0;` | `test/host-parse.test.ts`: 3 failed \| 118 passed (121). "copy of 65538 UTF-8 bytes in 21846 code units"; "a lone surrogate counts as three UTF-8 bytes, as a TextEncoder writes it"; "a store.set value of exactly 65536 UTF-8 bytes in two-byte characters passes, one more byte is oversize" | sha256 `86526658ab14…` restored, equal |

```json
[
  {
    "id": "L3.H3a",
    "guard": "accept any op: every message passes",
    "file": "src/host/parse.ts",
    "old": "  if (!isPlainObject(data)) return refuse('not-plain');\n  const keys",
    "new": "  return { ok: true, msg: data as FrameToParent };\n  if (!isPlainObject(data)) return refuse('not-plain');\n  const keys",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "68 failed | 53 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a key outside the op set",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a missing required key: hash without id",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a missing required key: ready without nonce",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a missing required key: store.set without value",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a parent op from the frame",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a value not a string: error why null",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a value not a string: hash id a number",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a value not a string: store.set value an object",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a value not a string: version sha null (null keys are omitted)",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > an own __proto__ key",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > an own constructor key",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > an own prototype key",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > an unknown op",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > changes 41 hex digits",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > changes a short sha",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > changes an upper-case sha",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > copy of 65537 UTF-8 bytes",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > copy of 65538 UTF-8 bytes in 21846 code units",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > error why in another case",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > error why outside the closed set",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > hash \"#x\"",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > hash \"a b\"",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > hash \"a%20b\"",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > hash \"a/b\"",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > hash \"a\\u200bb\"",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > hash ''",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > hash 129 astral letters (258 code units)",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > hash 257 code units",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > navigate ''",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > navigate 4097 code units",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > navigate with DEL",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > navigate with a C0 control",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > navigate with a C1 control",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > no t",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > not a plain object: a number",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > not a plain object: a string",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > not a plain object: an array",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > not a plain object: null",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > ready nonce not a string",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > ready v not a number",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > ready with another nonce",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > ready with protocol 2",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set a value of 65537 UTF-8 bytes",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set a value that is not JSON",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set an empty value",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set key doc: outside the allow-list",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set key doc:nope outside the allow-list",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set key doc:pos:doc outside the allow-list",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set key docreader:prefs outside the allow-list",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set key pref: outside the allow-list",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set key pref:lens outside the allow-list",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set key prefs outside the allow-list",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > t not a string",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > version a 39-hex sha",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > version only a short commit",
      "L3.H3 hash goes through isFragmentId, never the ID grammar alone > agrees with isFragmentId on every id of a battery, the grammar's edges included",
      "L3.H3 the nonce and the protocol of ready > a ready is accepted only with this mount's nonce: another nonce, a shorter one or the same in upper case is refused",
      "L3.H3 the nonce and the protocol of ready > a ready of any version but 1 is a protocol refusal, whatever its nonce",
      "L3.H3 the nonce and the protocol of ready > the expected nonce is an argument: the same ready is refused against another mount's nonce",
      "L3.H3 the parser reads a message once, as plain data > JSON text with surrounding white space is JSON; a bare word, a trailing comma and NaN are not",
      "L3.H3 the parser reads a message once, as plain data > a getter is refused unread, a symbol key and a hidden key are outside the key set",
      "L3.H3 the parser reads a message once, as plain data > a lone surrogate counts as three UTF-8 bytes, as a TextEncoder writes it",
      "L3.H3 the parser reads a message once, as plain data > a null-prototype object is plain; an instance of a class, a Date and a Map are not",
      "L3.H3 the parser reads a message once, as plain data > a parent op, a frame op of another case and an inherited t are unknown ops",
      "L3.H3 the parser reads a message once, as plain data > a store.set value of exactly 65536 UTF-8 bytes in two-byte characters passes, one more byte is oversize",
      "L3.H3 the parser reads a message once, as plain data > navigate refuses every C0, DEL and C1 code unit and accepts the characters beside them",
      "L3.H3 the parser reads a message once, as plain data > never throws, whatever it is given",
      "L3.H3 the parser reads a message once, as plain data > returns a fresh object, never the one it was given"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3b",
    "guard": "accept any op name: the op check is a string check only",
    "file": "src/host/parse.ts",
    "old": "if (typeof t !== 'string' || !(FRAME_OPS as readonly string[]).includes(t)) return refuse('unknown-op');",
    "new": "if (typeof t !== 'string') return refuse('unknown-op');",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "3 failed | 118 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a parent op from the frame",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > an unknown op",
      "L3.H3 the parser reads a message once, as plain data > a parent op, a frame op of another case and an inherited t are unknown ops"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3c",
    "guard": "skip a cap: the store.set value cap (64 KiB)",
    "file": "src/host/parse.ts",
    "old": "      if (utf8Bytes(value) > BRIDGE_LIMITS.valueMaxBytes) return refuse('oversize');\n",
    "new": "",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "2 failed | 119 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set a value of 65537 UTF-8 bytes",
      "L3.H3 the parser reads a message once, as plain data > a store.set value of exactly 65536 UTF-8 bytes in two-byte characters passes, one more byte is oversize"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3d",
    "guard": "skip a cap: the copy cap (64 KiB)",
    "file": "src/host/parse.ts",
    "old": "return utf8Bytes(text) <= BRIDGE_LIMITS.copyMaxBytes ? { ok: true, msg: { t: 'copy', text } } : refuse('oversize');",
    "new": "return { ok: true, msg: { t: 'copy', text } };",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "3 failed | 118 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > copy of 65537 UTF-8 bytes",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > copy of 65538 UTF-8 bytes in 21846 code units",
      "L3.H3 the parser reads a message once, as plain data > a lone surrogate counts as three UTF-8 bytes, as a TextEncoder writes it"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3e",
    "guard": "skip a cap: the href cap (4096 code units)",
    "file": "src/host/parse.ts",
    "old": "href.length < 1 || href.length > BRIDGE_LIMITS.hrefMaxChars || hasControl(href)",
    "new": "href.length < 1 || hasControl(href)",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "1 failed | 120 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > navigate 4097 code units"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3f",
    "guard": "skip the key list: the store key allow-list",
    "file": "src/host/parse.ts",
    "old": "      if (!isBridgeStoreKey(key)) return refuse('store-key');\n",
    "new": "",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "7 failed | 114 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set key doc: outside the allow-list",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set key doc:nope outside the allow-list",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set key doc:pos:doc outside the allow-list",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set key docreader:prefs outside the allow-list",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set key pref: outside the allow-list",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set key pref:lens outside the allow-list",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set key prefs outside the allow-list"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3g",
    "guard": "skip the key list: each op's key set",
    "file": "src/host/parse.ts",
    "old": "  for (const k of keys) if (typeof k !== 'string' || !allowed.includes(k)) return refuse('keys');\n",
    "new": "",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "2 failed | 119 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a key outside the op set",
      "L3.H3 the parser reads a message once, as plain data > a getter is refused unread, a symbol key and a hidden key are outside the key set"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3h",
    "guard": "skip the key list: each op's required keys",
    "file": "src/host/parse.ts",
    "old": "  for (const k of REQUIRED_KEYS[op]) if (!keys.includes(k)) return refuse('keys');\n",
    "new": "",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "3 failed | 118 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a missing required key: hash without id",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a missing required key: ready without nonce",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a missing required key: store.set without value"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3i",
    "guard": "skip the nonce check of ready",
    "file": "src/host/parse.ts",
    "old": "    if (got !== nonce) return refuse('nonce');\n",
    "new": "",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "3 failed | 118 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > ready with another nonce",
      "L3.H3 the nonce and the protocol of ready > a ready is accepted only with this mount's nonce: another nonce, a shorter one or the same in upper case is refused",
      "L3.H3 the nonce and the protocol of ready > the expected nonce is an argument: the same ready is refused against another mount's nonce"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3j",
    "guard": "skip the protocol check of ready",
    "file": "src/host/parse.ts",
    "old": "    if (v !== BRIDGE_PROTOCOL) return refuse('protocol');\n",
    "new": "",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "2 failed | 119 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > ready with protocol 2",
      "L3.H3 the nonce and the protocol of ready > a ready of any version but 1 is a protocol refusal, whatever its nonce"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3k",
    "guard": "skip the JSON value check of store.set",
    "file": "src/host/parse.ts",
    "old": "      if (!isJsonText(value)) return refuse('json');\n",
    "new": "",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "3 failed | 118 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set a value that is not JSON",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > store.set an empty value",
      "L3.H3 the parser reads a message once, as plain data > JSON text with surrounding white space is JSON; a bare word, a trailing comma and NaN are not"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3l",
    "guard": "check hash against the ID grammar alone",
    "file": "src/host/parse.ts",
    "old": "return isFragmentId(id) ? { ok: true, msg: { t: 'hash', id } } : refuse('hash');",
    "new": "return /^[A-Z]{1,4}-?\\d+(?:[.-]\\d+)*[a-z]?$/.test(id) ? { ok: true, msg: { t: 'hash', id } } : refuse('hash');",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "12 failed | 109 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > every message of every timed sequence is accepted by the parser (only the limiter refuses them)",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > hash \"AB-12-C\"",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > hash \"\\u4e2d\\u6587\"",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > hash \"anchor_1\"",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > hash \"cafe\\u0301\"",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > hash \"fn1\"",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > hash \"fnref1:1\"",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > hash \"heading-two\"",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > hash an id of exactly 256 code units",
      "L3.H3 hash goes through isFragmentId, never the ID grammar alone > agrees with isFragmentId on every id of a battery, the grammar's edges included",
      "L3.H3 hash goes through isFragmentId, never the ID grammar alone > heading slugs, footnote ids and anchors that the ID grammar refuses are accepted",
      "L3.H3 the parser reads a message once, as plain data > a null-prototype object is plain; an instance of a class, a Date and a Map are not"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3m",
    "guard": "skip the port check: a message carrying a port passes",
    "file": "src/host/parse.ts",
    "old": "if (!Array.isArray(ports) || ports.length !== 0) return refuse('port');",
    "new": "if (!Array.isArray(ports)) return refuse('port');",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "2 failed | 119 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a message carrying a port",
      "L3.H3 the parser reads a message once, as plain data > a message with ports is refused before it is read, and ports that are not an array refuse too"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3n",
    "guard": "skip the prototype-key check",
    "file": "src/host/parse.ts",
    "old": "  for (const k of PROTO_KEYS) if (keys.includes(k)) return refuse('proto-key');\n",
    "new": "",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "3 failed | 118 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > an own __proto__ key",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > an own constructor key",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > an own prototype key"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3o",
    "guard": "skip the value type check (every value a string)",
    "file": "src/host/parse.ts",
    "old": "  for (const v of values.values()) if (typeof v !== 'string') return refuse('type');\n",
    "new": "",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "4 failed | 117 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a value not a string: error why null",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a value not a string: hash id a number",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a value not a string: store.set value an object",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > a value not a string: version sha null (null keys are omitted)"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3p",
    "guard": "skip the error's closed set of reasons",
    "file": "src/host/parse.ts",
    "old": "return (ERROR_WHY as readonly string[]).includes(why) ? { ok: true, msg: { t: 'error', why: why as ErrorWhy } } : refuse('why');",
    "new": "return { ok: true, msg: { t: 'error', why: why as ErrorWhy } };",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "2 failed | 119 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > error why in another case",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > error why outside the closed set"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3q",
    "guard": "skip navigate's control check",
    "file": "src/host/parse.ts",
    "old": "href.length > BRIDGE_LIMITS.hrefMaxChars || hasControl(href)) return refuse('href');",
    "new": "href.length > BRIDGE_LIMITS.hrefMaxChars) return refuse('href');",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "4 failed | 117 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > navigate with DEL",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > navigate with a C0 control",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > navigate with a C1 control",
      "L3.H3 the parser reads a message once, as plain data > navigate refuses every C0, DEL and C1 code unit and accepts the characters beside them"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3r",
    "guard": "skip changes' sha grammar",
    "file": "src/host/parse.ts",
    "old": "return isFullSha(sha) ? { ok: true, msg: { t: 'changes', sha } } : refuse('sha');",
    "new": "return { ok: true, msg: { t: 'changes', sha } };",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "3 failed | 118 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > changes 41 hex digits",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > changes a short sha",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > changes an upper-case sha"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3s",
    "guard": "skip version's sha grammar",
    "file": "src/host/parse.ts",
    "old": "        if (!isFullSha(v)) return refuse('sha');\n",
    "new": "",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "2 failed | 119 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > version a 39-hex sha",
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > version only a short commit"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3t",
    "guard": "read a value by property access (a getter is called)",
    "file": "src/host/parse.ts",
    "old": "    if (d === undefined || !('value' in d)) return refuse('type');\n    values.set(k, d.value);",
    "new": "    if (d === undefined) return refuse('type');\n    values.set(k, (data as Record<string, unknown>)[k]);",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "1 failed | 120 passed (121)",
    "failing": [
      "L3.H3 the parser reads a message once, as plain data > a getter is refused unread, a symbol key and a hidden key are outside the key set"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  },
  {
    "id": "L3.H3u",
    "guard": "count a cap in UTF-16 code units, not UTF-8 bytes",
    "file": "src/host/parse.ts",
    "old": "export function utf8Bytes(s: string): number {\n  let n = 0;",
    "new": "export function utf8Bytes(s: string): number {\n  return s.length;\n  let n = 0;",
    "tests": "test/host-parse.test.ts",
    "rc": 1,
    "red": "3 failed | 118 passed (121)",
    "failing": [
      "L3.H3 every frame-to-parent case of conformance/bridge-cases.json > copy of 65538 UTF-8 bytes in 21846 code units",
      "L3.H3 the parser reads a message once, as plain data > a lone surrogate counts as three UTF-8 bytes, as a TextEncoder writes it",
      "L3.H3 the parser reads a message once, as plain data > a store.set value of exactly 65536 UTF-8 bytes in two-byte characters passes, one more byte is oversize"
    ],
    "sha256": "86526658ab143a1ba267b3650252ee095624286b6b47cb30c22f680ab6a53d15",
    "restored": true
  }
]
```

## The limiter: `src/host/limits.ts` (L3.H4a to L3.H4n)

Reference §8.4 and §11.3, ruling R5, and every timed sequence of `conformance/bridge-cases.json`, on a fake clock. The plan's rows map as: skip each limit (L3.H4a the general bucket, L3.H4b the store.set bucket, L3.H4c one changes in flight, L3.H4d coalescing, L3.H4e the 16-refusal close); a fixed 1 s window in place of a bucket (L3.H4f). The other rows cover the bucket's reading in `sequenceRules` (the capacity cap, whole milliseconds, a refused message takes no token, a backwards clock), an `error` drawing on the buckets like every op (L3.H4k), and coalescing's latest-wins, window reopening and the drop of a held message once the bridge closes (L3.H4n).

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.H4a | skip a limit: the general bucket | `src/host/limits.ts` | `const hasTokens = general >= MILLI && (!isStore \|\| store >= MILLI);` → `const hasTokens = !isStore \|\| store >= MILLI;` | `test/host-limits.test.ts`: 22 failed \| 17 passed (39). "an error with a token left is delivered at once and takes that token"; "changes at an empty general bucket is refused for rate, counts one refusal and is not delivered"; "copy at an empty general bucket is refused for rate, counts one refusal and is not delivered"; "error at an empty general bucket is refused for rate, counts one refusal and is not delivered"; "hash at an empty general bucket is refused for rate, counts one refusal and is not delivered"; and 17 more | sha256 `9b56dda5fffa…` restored, equal |
| L3.H4b | skip a limit: the store.set bucket | `src/host/limits.ts` | `const hasTokens = general >= MILLI && (!isStore \|\| store >= MILLI);` → `const hasTokens = general >= MILLI;` | `test/host-limits.test.ts`: 4 failed \| 35 passed (39). "store.set bucket: 10 at once, the 11th refused, other ops still pass; one store token every 100 ms"; "10 store.set at one instant pass and the 11th is refused, then one more passes every 100 ms"; "a refused message takes no token"; "other ops still pass while the store.set bucket is empty" | sha256 `9b56dda5fffa…` restored, equal |
| L3.H4c | skip a limit: one changes in flight | `src/host/limits.ts` | `      if (msg.t === 'changes' && changesInFlight >= L.changesInFlight) return rate(); ⏎ ` → (removed) | `test/host-limits.test.ts`: 2 failed \| 37 passed (39). "a second changes while one is in flight is refused, and passes once the first is done"; "changesDone with nothing in flight lends no second slot" | sha256 `9b56dda5fffa…` restored, equal |
| L3.H4d | skip a limit: navigate and version coalescing | `src/host/limits.ts` | `      if (msg.t === 'navigate' \|\| msg.t === 'version') {` → `      if (false as boolean) {` | `test/host-limits.test.ts`: 5 failed \| 34 passed (39). "a stream is delivered at most once per 250 ms, the latest each time; after a quiet window the next goes at once"; "dispose drops a held message and its timer: nothing is delivered after it"; "the first is delivered at once, later ones within 250 ms coalesce into one trailing delivery of the latest"; "version coalesces in its own lane: a navigate does not hold a version back"; "a navigate held for its window is dropped when the bridge closes before the window ends" | sha256 `9b56dda5fffa…` restored, equal |
| L3.H4e | skip a limit: 16 refusals close | `src/host/limits.ts` | `    if (refusals >= L.refusalsToClose && !closed) {` → `    if (false as boolean) {` | `test/host-limits.test.ts`: 6 failed \| 33 passed (39). "the 16th refusal closes the bridge"; "16 refusals from the parser (refuse()) close; 15 do not"; "a navigate held for its window is dropped when the bridge closes before the window ends"; "an accepted message never resets the count"; "once closed, nothing passes and nothing is delivered"; and 1 more | sha256 `9b56dda5fffa…` restored, equal |
| L3.H4f | a fixed 1 s window in place of a bucket | `src/host/limits.ts` | `    const now = Math.floor(clock.now()); ⏎     if (!(now > last)) return; ⏎     const dt = now - last; ⏎     last = now; ⏎     general = Math.min(generalMax, general + dt * L.bucketRefillPerSecond); ⏎     store = Math.min(storeMax, store + dt * L.storeSetRefillPerSecond);` → `    const now = Math.floor(clock.now()); ⏎     if (Math.floor(now / 1000) > Math.floor(last / 1000)) { ⏎       general = generalMax; ⏎       store = storeMax; ⏎     } ⏎     if (now > last) last = now;` | `test/host-limits.test.ts`: 8 failed \| 31 passed (39). "general bucket: refilled continuously at 20 a second, one token every 50 ms"; "store.set bucket: 10 at once, the 11th refused, other ops still pass; one store token every 100 ms"; "a clock that runs backwards adds no token"; "after 500 ms, 10 more pass and the 11th is refused"; "counts the whole milliseconds the clock has passed: from 0.6 ms to 50.4 ms is 50, one token"; and 3 more | sha256 `9b56dda5fffa…` restored, equal |
| L3.H4g | a refill past the capacity | `src/host/limits.ts` | `    general = Math.min(generalMax, general + dt * L.bucketRefillPerSecond);` → `    general = general + dt * L.bucketRefillPerSecond;` | `test/host-limits.test.ts`: 2 failed \| 37 passed (39). "a clock that runs backwards adds no token"; "a refill never goes past the capacity: after a long quiet spell, 40 pass and the 41st is refused" | sha256 `9b56dda5fffa…` restored, equal |
| L3.H4h | refill by fractional milliseconds, not whole ones | `src/host/limits.ts` | `    const now = Math.floor(clock.now()); ⏎     if (!(now > last)) return;` → `    const now = clock.now(); ⏎     if (!(now > last)) return;` | `test/host-limits.test.ts`: 1 failed \| 38 passed (39). "counts the whole milliseconds the clock has passed: from 0.6 ms to 50.4 ms is 50, one token" | sha256 `9b56dda5fffa…` restored, equal |
| L3.H4i | a refused store.set takes a general token | `src/host/limits.ts` | `      if (!hasTokens) return rate();` → `      if (!hasTokens) { ⏎         if (general >= MILLI) general -= MILLI; ⏎         return rate(); ⏎       }` | `test/host-limits.test.ts`: 1 failed \| 38 passed (39). "a refused message takes no token" | sha256 `9b56dda5fffa…` restored, equal |
| L3.H4j | a clock that runs backwards adds tokens | `src/host/limits.ts` | `    if (!(now > last)) return; ⏎     const dt = now - last;` → `    const dt = Math.abs(now - last);` | `test/host-limits.test.ts`: 1 failed \| 38 passed (39). "a clock that runs backwards adds no token" | sha256 `9b56dda5fffa…` restored, equal |
| L3.H4k | exempt error from the buckets: an error passes an empty bucket | `src/host/limits.ts` | `      if (!hasTokens) return rate(); ⏎ ` → `      if (!hasTokens && msg.t !== 'error') return rate(); ⏎ ` | `test/host-limits.test.ts`: 1 failed \| 38 passed (39). "error at an empty general bucket is refused for rate, counts one refusal and is not delivered" | sha256 `9b56dda5fffa…` restored, equal |
| L3.H4l | coalescing keeps the first held message, not the latest | `src/host/limits.ts` | `          lane.held = msg;` → `          lane.held ??= msg;` | `test/host-limits.test.ts`: 2 failed \| 37 passed (39). "a stream is delivered at most once per 250 ms, the latest each time; after a quiet window the next goes at once"; "the first is delivered at once, later ones within 250 ms coalesce into one trailing delivery of the latest" | sha256 `9b56dda5fffa…` restored, equal |
| L3.H4m | a trailing delivery does not open the next window | `src/host/limits.ts` | `      openWindow(lane); ⏎       deliver(held);` → `      lane.open = false; ⏎       deliver(held);` | `test/host-limits.test.ts`: 1 failed \| 38 passed (39). "a stream is delivered at most once per 250 ms, the latest each time; after a quiet window the next goes at once" | sha256 `9b56dda5fffa…` restored, equal |
| L3.H4n | a held navigate or version is still delivered after the bridge closes | `src/host/limits.ts` | `      if (held === undefined \|\| disposed \|\| closed) {` → `      if (held === undefined \|\| disposed) {` | `test/host-limits.test.ts`: 1 failed \| 38 passed (39). "a navigate held for its window is dropped when the bridge closes before the window ends" | sha256 `9b56dda5fffa…` restored, equal |

```json
[
  {
    "id": "L3.H4a",
    "guard": "skip a limit: the general bucket",
    "file": "src/host/limits.ts",
    "old": "const hasTokens = general >= MILLI && (!isStore || store >= MILLI);",
    "new": "const hasTokens = !isStore || store >= MILLI;",
    "tests": "test/host-limits.test.ts",
    "rc": 1,
    "red": "22 failed | 17 passed (39)",
    "failing": [
      "L3.H4 every op draws on the buckets, error included (sequenceRules: \"every message takes one general token\") > an error with a token left is delivered at once and takes that token",
      "L3.H4 every op draws on the buckets, error included (sequenceRules: \"every message takes one general token\") > changes at an empty general bucket is refused for rate, counts one refusal and is not delivered",
      "L3.H4 every op draws on the buckets, error included (sequenceRules: \"every message takes one general token\") > copy at an empty general bucket is refused for rate, counts one refusal and is not delivered",
      "L3.H4 every op draws on the buckets, error included (sequenceRules: \"every message takes one general token\") > error at an empty general bucket is refused for rate, counts one refusal and is not delivered",
      "L3.H4 every op draws on the buckets, error included (sequenceRules: \"every message takes one general token\") > hash at an empty general bucket is refused for rate, counts one refusal and is not delivered",
      "L3.H4 every op draws on the buckets, error included (sequenceRules: \"every message takes one general token\") > navigate at an empty general bucket is refused for rate, counts one refusal and is not delivered",
      "L3.H4 every op draws on the buckets, error included (sequenceRules: \"every message takes one general token\") > store.set at an empty general bucket is refused for rate, counts one refusal and is not delivered",
      "L3.H4 every op draws on the buckets, error included (sequenceRules: \"every message takes one general token\") > version at an empty general bucket is refused for rate, counts one refusal and is not delivered",
      "L3.H4 every timed sequence of conformance/bridge-cases.json > general bucket: 40 at once, the 41st refused",
      "L3.H4 every timed sequence of conformance/bridge-cases.json > general bucket: refilled continuously at 20 a second, one token every 50 ms",
      "L3.H4 every timed sequence of conformance/bridge-cases.json > store.set takes a general token too: refused when the general bucket is empty",
      "L3.H4 every timed sequence of conformance/bridge-cases.json > the 16th refusal closes the bridge",
      "L3.H4 navigate and version: coalesced over 250 ms > a coalesced message still takes a token",
      "L3.H4 refusals: the 16th closes > rate refusals and parser refusals count together",
      "L3.H4 the general bucket: 40 at once, then 20 a second > a clock that runs backwards adds no token",
      "L3.H4 the general bucket: 40 at once, then 20 a second > a refill never goes past the capacity: after a long quiet spell, 40 pass and the 41st is refused",
      "L3.H4 the general bucket: 40 at once, then 20 a second > after 500 ms, 10 more pass and the 11th is refused",
      "L3.H4 the general bucket: 40 at once, then 20 a second > counts the whole milliseconds the clock has passed: from 0.6 ms to 50.4 ms is 50, one token",
      "L3.H4 the general bucket: 40 at once, then 20 a second > counts whole milliseconds: 49.9 ms after an empty bucket is still empty, 50 ms is one token",
      "L3.H4 the general bucket: 40 at once, then 20 a second > from a full bucket 40 messages at one instant pass and the 41st is refused",
      "L3.H4 the store.set bucket: 10 at once, then one every 100 ms > a refused message takes no token",
      "L3.H4 the store.set bucket: 10 at once, then one every 100 ms > a store.set takes a general token too"
    ],
    "sha256": "9b56dda5fffaae4434667d3edabdefb312a1950b413c0ccbaf79e679cbf2d167",
    "restored": true
  },
  {
    "id": "L3.H4b",
    "guard": "skip a limit: the store.set bucket",
    "file": "src/host/limits.ts",
    "old": "const hasTokens = general >= MILLI && (!isStore || store >= MILLI);",
    "new": "const hasTokens = general >= MILLI;",
    "tests": "test/host-limits.test.ts",
    "rc": 1,
    "red": "4 failed | 35 passed (39)",
    "failing": [
      "L3.H4 every timed sequence of conformance/bridge-cases.json > store.set bucket: 10 at once, the 11th refused, other ops still pass; one store token every 100 ms",
      "L3.H4 the store.set bucket: 10 at once, then one every 100 ms > 10 store.set at one instant pass and the 11th is refused, then one more passes every 100 ms",
      "L3.H4 the store.set bucket: 10 at once, then one every 100 ms > a refused message takes no token",
      "L3.H4 the store.set bucket: 10 at once, then one every 100 ms > other ops still pass while the store.set bucket is empty"
    ],
    "sha256": "9b56dda5fffaae4434667d3edabdefb312a1950b413c0ccbaf79e679cbf2d167",
    "restored": true
  },
  {
    "id": "L3.H4c",
    "guard": "skip a limit: one changes in flight",
    "file": "src/host/limits.ts",
    "old": "      if (msg.t === 'changes' && changesInFlight >= L.changesInFlight) return rate();\n",
    "new": "",
    "tests": "test/host-limits.test.ts",
    "rc": 1,
    "red": "2 failed | 37 passed (39)",
    "failing": [
      "L3.H4 one changes in flight > a second changes while one is in flight is refused, and passes once the first is done",
      "L3.H4 one changes in flight > changesDone with nothing in flight lends no second slot"
    ],
    "sha256": "9b56dda5fffaae4434667d3edabdefb312a1950b413c0ccbaf79e679cbf2d167",
    "restored": true
  },
  {
    "id": "L3.H4d",
    "guard": "skip a limit: navigate and version coalescing",
    "file": "src/host/limits.ts",
    "old": "      if (msg.t === 'navigate' || msg.t === 'version') {",
    "new": "      if (false as boolean) {",
    "tests": "test/host-limits.test.ts",
    "rc": 1,
    "red": "5 failed | 34 passed (39)",
    "failing": [
      "L3.H4 navigate and version: coalesced over 250 ms > a stream is delivered at most once per 250 ms, the latest each time; after a quiet window the next goes at once",
      "L3.H4 navigate and version: coalesced over 250 ms > dispose drops a held message and its timer: nothing is delivered after it",
      "L3.H4 navigate and version: coalesced over 250 ms > the first is delivered at once, later ones within 250 ms coalesce into one trailing delivery of the latest",
      "L3.H4 navigate and version: coalesced over 250 ms > version coalesces in its own lane: a navigate does not hold a version back",
      "L3.H4 refusals: the 16th closes > a navigate held for its window is dropped when the bridge closes before the window ends"
    ],
    "sha256": "9b56dda5fffaae4434667d3edabdefb312a1950b413c0ccbaf79e679cbf2d167",
    "restored": true
  },
  {
    "id": "L3.H4e",
    "guard": "skip a limit: 16 refusals close",
    "file": "src/host/limits.ts",
    "old": "    if (refusals >= L.refusalsToClose && !closed) {",
    "new": "    if (false as boolean) {",
    "tests": "test/host-limits.test.ts",
    "rc": 1,
    "red": "6 failed | 33 passed (39)",
    "failing": [
      "L3.H4 every timed sequence of conformance/bridge-cases.json > the 16th refusal closes the bridge",
      "L3.H4 refusals: the 16th closes > 16 refusals from the parser (refuse()) close; 15 do not",
      "L3.H4 refusals: the 16th closes > a navigate held for its window is dropped when the bridge closes before the window ends",
      "L3.H4 refusals: the 16th closes > an accepted message never resets the count",
      "L3.H4 refusals: the 16th closes > once closed, nothing passes and nothing is delivered",
      "L3.H4 refusals: the 16th closes > rate refusals and parser refusals count together"
    ],
    "sha256": "9b56dda5fffaae4434667d3edabdefb312a1950b413c0ccbaf79e679cbf2d167",
    "restored": true
  },
  {
    "id": "L3.H4f",
    "guard": "a fixed 1 s window in place of a bucket",
    "file": "src/host/limits.ts",
    "old": "    const now = Math.floor(clock.now());\n    if (!(now > last)) return;\n    const dt = now - last;\n    last = now;\n    general = Math.min(generalMax, general + dt * L.bucketRefillPerSecond);\n    store = Math.min(storeMax, store + dt * L.storeSetRefillPerSecond);",
    "new": "    const now = Math.floor(clock.now());\n    if (Math.floor(now / 1000) > Math.floor(last / 1000)) {\n      general = generalMax;\n      store = storeMax;\n    }\n    if (now > last) last = now;",
    "tests": "test/host-limits.test.ts",
    "rc": 1,
    "red": "8 failed | 31 passed (39)",
    "failing": [
      "L3.H4 every timed sequence of conformance/bridge-cases.json > general bucket: refilled continuously at 20 a second, one token every 50 ms",
      "L3.H4 every timed sequence of conformance/bridge-cases.json > store.set bucket: 10 at once, the 11th refused, other ops still pass; one store token every 100 ms",
      "L3.H4 the general bucket: 40 at once, then 20 a second > a clock that runs backwards adds no token",
      "L3.H4 the general bucket: 40 at once, then 20 a second > after 500 ms, 10 more pass and the 11th is refused",
      "L3.H4 the general bucket: 40 at once, then 20 a second > counts the whole milliseconds the clock has passed: from 0.6 ms to 50.4 ms is 50, one token",
      "L3.H4 the general bucket: 40 at once, then 20 a second > counts whole milliseconds: 49.9 ms after an empty bucket is still empty, 50 ms is one token",
      "L3.H4 the store.set bucket: 10 at once, then one every 100 ms > 10 store.set at one instant pass and the 11th is refused, then one more passes every 100 ms",
      "L3.H4 the store.set bucket: 10 at once, then one every 100 ms > a refused message takes no token"
    ],
    "sha256": "9b56dda5fffaae4434667d3edabdefb312a1950b413c0ccbaf79e679cbf2d167",
    "restored": true
  },
  {
    "id": "L3.H4g",
    "guard": "a refill past the capacity",
    "file": "src/host/limits.ts",
    "old": "    general = Math.min(generalMax, general + dt * L.bucketRefillPerSecond);",
    "new": "    general = general + dt * L.bucketRefillPerSecond;",
    "tests": "test/host-limits.test.ts",
    "rc": 1,
    "red": "2 failed | 37 passed (39)",
    "failing": [
      "L3.H4 the general bucket: 40 at once, then 20 a second > a clock that runs backwards adds no token",
      "L3.H4 the general bucket: 40 at once, then 20 a second > a refill never goes past the capacity: after a long quiet spell, 40 pass and the 41st is refused"
    ],
    "sha256": "9b56dda5fffaae4434667d3edabdefb312a1950b413c0ccbaf79e679cbf2d167",
    "restored": true
  },
  {
    "id": "L3.H4h",
    "guard": "refill by fractional milliseconds, not whole ones",
    "file": "src/host/limits.ts",
    "old": "    const now = Math.floor(clock.now());\n    if (!(now > last)) return;",
    "new": "    const now = clock.now();\n    if (!(now > last)) return;",
    "tests": "test/host-limits.test.ts",
    "rc": 1,
    "red": "1 failed | 38 passed (39)",
    "failing": [
      "L3.H4 the general bucket: 40 at once, then 20 a second > counts the whole milliseconds the clock has passed: from 0.6 ms to 50.4 ms is 50, one token"
    ],
    "sha256": "9b56dda5fffaae4434667d3edabdefb312a1950b413c0ccbaf79e679cbf2d167",
    "restored": true
  },
  {
    "id": "L3.H4i",
    "guard": "a refused store.set takes a general token",
    "file": "src/host/limits.ts",
    "old": "      if (!hasTokens) return rate();",
    "new": "      if (!hasTokens) {\n        if (general >= MILLI) general -= MILLI;\n        return rate();\n      }",
    "tests": "test/host-limits.test.ts",
    "rc": 1,
    "red": "1 failed | 38 passed (39)",
    "failing": [
      "L3.H4 the store.set bucket: 10 at once, then one every 100 ms > a refused message takes no token"
    ],
    "sha256": "9b56dda5fffaae4434667d3edabdefb312a1950b413c0ccbaf79e679cbf2d167",
    "restored": true
  },
  {
    "id": "L3.H4j",
    "guard": "a clock that runs backwards adds tokens",
    "file": "src/host/limits.ts",
    "old": "    if (!(now > last)) return;\n    const dt = now - last;",
    "new": "    const dt = Math.abs(now - last);",
    "tests": "test/host-limits.test.ts",
    "rc": 1,
    "red": "1 failed | 38 passed (39)",
    "failing": [
      "L3.H4 the general bucket: 40 at once, then 20 a second > a clock that runs backwards adds no token"
    ],
    "sha256": "9b56dda5fffaae4434667d3edabdefb312a1950b413c0ccbaf79e679cbf2d167",
    "restored": true
  },
  {
    "id": "L3.H4k",
    "guard": "exempt error from the buckets: an error passes an empty bucket",
    "file": "src/host/limits.ts",
    "old": "      if (!hasTokens) return rate();\n",
    "new": "      if (!hasTokens && msg.t !== 'error') return rate();\n",
    "tests": "test/host-limits.test.ts",
    "rc": 1,
    "red": "1 failed | 38 passed (39)",
    "failing": [
      "L3.H4 every op draws on the buckets, error included (sequenceRules: \"every message takes one general token\") > error at an empty general bucket is refused for rate, counts one refusal and is not delivered"
    ],
    "sha256": "9b56dda5fffaae4434667d3edabdefb312a1950b413c0ccbaf79e679cbf2d167",
    "restored": true
  },
  {
    "id": "L3.H4l",
    "guard": "coalescing keeps the first held message, not the latest",
    "file": "src/host/limits.ts",
    "old": "          lane.held = msg;",
    "new": "          lane.held ??= msg;",
    "tests": "test/host-limits.test.ts",
    "rc": 1,
    "red": "2 failed | 37 passed (39)",
    "failing": [
      "L3.H4 navigate and version: coalesced over 250 ms > a stream is delivered at most once per 250 ms, the latest each time; after a quiet window the next goes at once",
      "L3.H4 navigate and version: coalesced over 250 ms > the first is delivered at once, later ones within 250 ms coalesce into one trailing delivery of the latest"
    ],
    "sha256": "9b56dda5fffaae4434667d3edabdefb312a1950b413c0ccbaf79e679cbf2d167",
    "restored": true
  },
  {
    "id": "L3.H4m",
    "guard": "a trailing delivery does not open the next window",
    "file": "src/host/limits.ts",
    "old": "      openWindow(lane);\n      deliver(held);",
    "new": "      lane.open = false;\n      deliver(held);",
    "tests": "test/host-limits.test.ts",
    "rc": 1,
    "red": "1 failed | 38 passed (39)",
    "failing": [
      "L3.H4 navigate and version: coalesced over 250 ms > a stream is delivered at most once per 250 ms, the latest each time; after a quiet window the next goes at once"
    ],
    "sha256": "9b56dda5fffaae4434667d3edabdefb312a1950b413c0ccbaf79e679cbf2d167",
    "restored": true
  },
  {
    "id": "L3.H4n",
    "guard": "a held navigate or version is still delivered after the bridge closes",
    "file": "src/host/limits.ts",
    "old": "      if (held === undefined || disposed || closed) {",
    "new": "      if (held === undefined || disposed) {",
    "tests": "test/host-limits.test.ts",
    "rc": 1,
    "red": "1 failed | 38 passed (39)",
    "failing": [
      "L3.H4 refusals: the 16th closes > a navigate held for its window is dropped when the bridge closes before the window ends"
    ],
    "sha256": "9b56dda5fffaae4434667d3edabdefb312a1950b413c0ccbaf79e679cbf2d167",
    "restored": true
  }
]
```

## The store: `src/host/store.ts` (L3.H5a to L3.H5h)

Reference §8.3 and §11.3, mirroring M8.15. The plan's rows map as: store the raw key (L3.H5a); trust a frame-supplied doc key (L3.H5b, two edits: the allow-list widened to `doc:<doc>:<field>` and that key stored as sent); skip the budget (L3.H5c, two edits). The other rows: the store's own 64 KiB cap (L3.H5d), the eviction order (L3.H5e), the current document's exemption (L3.H5f), an order index that names a document twice (L3.H5g) and the scan's prefix filter (L3.H5h).

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.H5a | store the raw key (the bridge key as the frame sent it) | `src/host/store.ts` | ``     if (key.startsWith('pref:')) return `${prefix}${key}`; ⏎     return docKey === undefined ? null : docStorageKey(docKey, key.slice('doc:'.length)); `` → `    return key;` | `test/host-store.test.ts`: 15 failed \| 10 passed (25). "a frame-supplied doc key for another document is refused; doc:<field> lands under the current doc"; "two documents' stores never write each other's keys"; "with no docKey, a doc write is refused and writes nothing; prefs still land"; "a host prefix is used as given"; "pref:<name> lands at <prefix>pref:<name>; doc:<field> at <prefix>doc:<docKey>:<field>"; and 10 more | sha256 `b41c85c83c91…` restored, equal |
| L3.H5b | trust a frame-supplied doc key | `src/host/store.ts` | `      if (!isBridgeStoreKey(key)) return fail('store-key');` → `      if (!isBridgeStoreKey(key) && !/^doc:[^:]+:[^:]+$/.test(key)) return fail('store-key');`; `    return docKey === undefined ? null : docStorageKey(docKey, key.slice('doc:'.length));` → ``     return key.split(':').length > 2 ? `${prefix}${key}` : docKey === undefined ? null : docStorageKey(docKey, key.slice('doc:'.length)); `` | `test/host-store.test.ts`: 2 failed \| 23 passed (25). "a frame-supplied doc key for another document is refused; doc:<field> lands under the current doc"; "a key outside the allow-list is refused and writes nothing anywhere" | sha256 `b41c85c83c91…` restored, equal |
| L3.H5c | skip the budget | `src/host/store.ts` | `      if (projected() <= BRIDGE_LIMITS.storeBudgetBytes) break;` → `      break;`; `    if (projected() > BRIDGE_LIMITS.storeBudgetBytes) return fail('budget'); ⏎ ` → (removed) | `test/host-store.test.ts`: 6 failed \| 19 passed (25). "a damaged index of write order is rebuilt, never trusted or thrown on"; "a document written again is kept over one written in between"; "a document written least recently keeps its other fields when it writes again past the budget: another goes"; "a flood across documents stays within the budget, evicts only the prefix's doc keys, and leaves the host's key writable"; "a write that cannot fit without evicting keys it may not touch is refused, and evicts nothing"; and 1 more | sha256 `b41c85c83c91…` restored, equal |
| L3.H5d | skip the store's own 64 KiB cap | `src/host/store.ts` | `      if (utf8Bytes(value) > BRIDGE_LIMITS.valueMaxBytes) return fail('oversize'); ⏎ ` → (removed) | `test/host-store.test.ts`: 2 failed \| 23 passed (25). "a value of exactly 65536 UTF-8 bytes is written; 65537 is refused and leaves the old value"; "the cap counts UTF-8 bytes, not code units" | sha256 `b41c85c83c91…` restored, equal |
| L3.H5e | evict the most recently written document first | `src/host/store.ts` | `    for (const doc of order) {` → `    for (const doc of [...order].reverse()) {` | `test/host-store.test.ts`: 3 failed \| 22 passed (25). "a document written again is kept over one written in between"; "a flood across documents stays within the budget, evicts only the prefix's doc keys, and leaves the host's key writable"; "an index that names a stored document twice is ignored: that document is not counted as freed twice" | sha256 `b41c85c83c91…` restored, equal |
| L3.H5f | evict the current document to make room for its own write | `src/host/store.ts` | `      if (doc === docKey) continue; ⏎ ` → (removed) | `test/host-store.test.ts`: 1 failed \| 24 passed (25). "a document written least recently keeps its other fields when it writes again past the budget: another goes" | sha256 `b41c85c83c91…` restored, equal |
| L3.H5g | trust an index that names a document twice | `src/host/store.ts` | `parsed.every(isDocKey) && new Set(parsed).size === parsed.length` → `parsed.every(isDocKey)` | `test/host-store.test.ts`: 1 failed \| 24 passed (25). "an index that names a stored document twice is ignored: that document is not counted as freed twice" | sha256 `b41c85c83c91…` restored, equal |
| L3.H5h | scan every key, not only those under the prefix | `src/host/store.ts` | `typeof k === 'string' && k.startsWith(prefix)` → `typeof k === 'string'` | `test/host-store.test.ts`: 1 failed \| 24 passed (25). "a large key outside the prefix counts nothing against the budget and is never read for its value" | sha256 `b41c85c83c91…` restored, equal |

```json
[
  {
    "id": "L3.H5a",
    "guard": "store the raw key (the bridge key as the frame sent it)",
    "file": "src/host/store.ts",
    "old": "    if (key.startsWith('pref:')) return `${prefix}${key}`;\n    return docKey === undefined ? null : docStorageKey(docKey, key.slice('doc:'.length));",
    "new": "    return key;",
    "tests": "test/host-store.test.ts",
    "rc": 1,
    "red": "15 failed | 10 passed (25)",
    "failing": [
      "L3.H5 doc keys only for the current docKey > a frame-supplied doc key for another document is refused; doc:<field> lands under the current doc",
      "L3.H5 doc keys only for the current docKey > two documents' stores never write each other's keys",
      "L3.H5 doc keys only for the current docKey > with no docKey, a doc write is refused and writes nothing; prefs still land",
      "L3.H5 keys land under the prefix, built by the store > a host prefix is used as given",
      "L3.H5 keys land under the prefix, built by the store > pref:<name> lands at <prefix>pref:<name>; doc:<field> at <prefix>doc:<docKey>:<field>",
      "L3.H5 snapshot(): this reader's keys only, in bridge-key space > every allow-listed key at its cap still fits the budget the seed allows",
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > a damaged index of write order is rebuilt, never trusted or thrown on",
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > a document written again is kept over one written in between",
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > a document written least recently keeps its other fields when it writes again past the budget: another goes",
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > a flood across documents stays within the budget, evicts only the prefix's doc keys, and leaves the host's key writable",
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > a large key outside the prefix counts nothing against the budget and is never read for its value",
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > a write that cannot fit without evicting keys it may not touch is refused, and evicts nothing",
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > an index that names a stored document twice is ignored: that document is not counted as freed twice",
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > the current document is never evicted to make room for itself, and prefs are never evicted",
      "L3.H5 the 64 KiB cap > a value of exactly 65536 UTF-8 bytes is written; 65537 is refused and leaves the old value"
    ],
    "sha256": "b41c85c83c912cb94537bd6a9ddc810139b88f70108027a16692f784bf071008",
    "restored": true
  },
  {
    "id": "L3.H5b",
    "guard": "trust a frame-supplied doc key",
    "file": "src/host/store.ts",
    "edits": [
      {
        "old": "      if (!isBridgeStoreKey(key)) return fail('store-key');",
        "new": "      if (!isBridgeStoreKey(key) && !/^doc:[^:]+:[^:]+$/.test(key)) return fail('store-key');"
      },
      {
        "old": "    return docKey === undefined ? null : docStorageKey(docKey, key.slice('doc:'.length));",
        "new": "    return key.split(':').length > 2 ? `${prefix}${key}` : docKey === undefined ? null : docStorageKey(docKey, key.slice('doc:'.length));"
      }
    ],
    "tests": "test/host-store.test.ts",
    "rc": 1,
    "red": "2 failed | 23 passed (25)",
    "failing": [
      "L3.H5 doc keys only for the current docKey > a frame-supplied doc key for another document is refused; doc:<field> lands under the current doc",
      "L3.H5 keys land under the prefix, built by the store > a key outside the allow-list is refused and writes nothing anywhere"
    ],
    "sha256": "b41c85c83c912cb94537bd6a9ddc810139b88f70108027a16692f784bf071008",
    "restored": true
  },
  {
    "id": "L3.H5c",
    "guard": "skip the budget",
    "file": "src/host/store.ts",
    "edits": [
      {
        "old": "      if (projected() <= BRIDGE_LIMITS.storeBudgetBytes) break;",
        "new": "      break;"
      },
      {
        "old": "    if (projected() > BRIDGE_LIMITS.storeBudgetBytes) return fail('budget');\n",
        "new": ""
      }
    ],
    "tests": "test/host-store.test.ts",
    "rc": 1,
    "red": "6 failed | 19 passed (25)",
    "failing": [
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > a damaged index of write order is rebuilt, never trusted or thrown on",
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > a document written again is kept over one written in between",
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > a document written least recently keeps its other fields when it writes again past the budget: another goes",
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > a flood across documents stays within the budget, evicts only the prefix's doc keys, and leaves the host's key writable",
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > a write that cannot fit without evicting keys it may not touch is refused, and evicts nothing",
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > an index that names a stored document twice is ignored: that document is not counted as freed twice"
    ],
    "sha256": "b41c85c83c912cb94537bd6a9ddc810139b88f70108027a16692f784bf071008",
    "restored": true
  },
  {
    "id": "L3.H5d",
    "guard": "skip the store's own 64 KiB cap",
    "file": "src/host/store.ts",
    "old": "      if (utf8Bytes(value) > BRIDGE_LIMITS.valueMaxBytes) return fail('oversize');\n",
    "new": "",
    "tests": "test/host-store.test.ts",
    "rc": 1,
    "red": "2 failed | 23 passed (25)",
    "failing": [
      "L3.H5 the 64 KiB cap > a value of exactly 65536 UTF-8 bytes is written; 65537 is refused and leaves the old value",
      "L3.H5 the 64 KiB cap > the cap counts UTF-8 bytes, not code units"
    ],
    "sha256": "b41c85c83c912cb94537bd6a9ddc810139b88f70108027a16692f784bf071008",
    "restored": true
  },
  {
    "id": "L3.H5e",
    "guard": "evict the most recently written document first",
    "file": "src/host/store.ts",
    "old": "    for (const doc of order) {",
    "new": "    for (const doc of [...order].reverse()) {",
    "tests": "test/host-store.test.ts",
    "rc": 1,
    "red": "3 failed | 22 passed (25)",
    "failing": [
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > a document written again is kept over one written in between",
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > a flood across documents stays within the budget, evicts only the prefix's doc keys, and leaves the host's key writable",
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > an index that names a stored document twice is ignored: that document is not counted as freed twice"
    ],
    "sha256": "b41c85c83c912cb94537bd6a9ddc810139b88f70108027a16692f784bf071008",
    "restored": true
  },
  {
    "id": "L3.H5f",
    "guard": "evict the current document to make room for its own write",
    "file": "src/host/store.ts",
    "old": "      if (doc === docKey) continue;\n",
    "new": "",
    "tests": "test/host-store.test.ts",
    "rc": 1,
    "red": "1 failed | 24 passed (25)",
    "failing": [
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > a document written least recently keeps its other fields when it writes again past the budget: another goes"
    ],
    "sha256": "b41c85c83c912cb94537bd6a9ddc810139b88f70108027a16692f784bf071008",
    "restored": true
  },
  {
    "id": "L3.H5g",
    "guard": "trust an index that names a document twice",
    "file": "src/host/store.ts",
    "old": "parsed.every(isDocKey) && new Set(parsed).size === parsed.length",
    "new": "parsed.every(isDocKey)",
    "tests": "test/host-store.test.ts",
    "rc": 1,
    "red": "1 failed | 24 passed (25)",
    "failing": [
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > an index that names a stored document twice is ignored: that document is not counted as freed twice"
    ],
    "sha256": "b41c85c83c912cb94537bd6a9ddc810139b88f70108027a16692f784bf071008",
    "restored": true
  },
  {
    "id": "L3.H5h",
    "guard": "scan every key, not only those under the prefix",
    "file": "src/host/store.ts",
    "old": "typeof k === 'string' && k.startsWith(prefix)",
    "new": "typeof k === 'string'",
    "tests": "test/host-store.test.ts",
    "rc": 1,
    "red": "1 failed | 24 passed (25)",
    "failing": [
      "L3.H5 the 1 MiB budget: least recently written documents go first, inside the prefix only > a large key outside the prefix counts nothing against the budget and is never read for its value"
    ],
    "sha256": "b41c85c83c912cb94537bd6a9ddc810139b88f70108027a16692f784bf071008",
    "restored": true
  }
]
```

## The links: `src/host/links.ts` (L3.H6a to L3.H6m)

Reference §11.3. The plan's row "drop each refusal" is one row per refusal: the length cap (L3.H6a), controls (L3.H6b), white space (L3.H6c), backslash forms (L3.H6d), protocol-relative (L3.H6e), `javascript:`, `data:`, `vbscript:` and every other scheme (L3.H6f, one check), http and https without `//` or a host (L3.H6h), a fragment outside the grammar (L3.H6i), the copy check's bidi controls and zero-width characters (L3.H6j), and the mailto domain read by the URL parser (L3.H6k), holding nothing but a host (L3.H6l) and, when ASCII, reading as itself (L3.H6m); L3.H6g keeps the query the row must drop.

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.H6a | drop a refusal: the 4096 code-unit cap | `src/host/links.ts` | `  if (href.length < 1 \|\| href.length > BRIDGE_LIMITS.hrefMaxChars) return null;` → `  if (href.length < 1) return null;` | `test/host-links.test.ts`: 1 failed \| 19 passed (20). "4097 code units are refused; 4096 pass" | sha256 `6640619e3133…` restored, equal |
| L3.H6b | drop a refusal: controls | `src/host/links.ts` | `  if (hasControl(href) \|\| hasHiddenChar(href) \|\| WHITE_SPACE.test(href) \|\| BACKSLASH.test(href)) return null;` → `  if (hasHiddenChar(href) \|\| WHITE_SPACE.test(href) \|\| BACKSLASH.test(href)) return null;` | `test/host-links.test.ts`: 1 failed \| 19 passed (20). "every C0 control, DEL and every C1 control, anywhere" | sha256 `6640619e3133…` restored, equal |
| L3.H6c | drop a refusal: white space | `src/host/links.ts` | `  if (hasControl(href) \|\| hasHiddenChar(href) \|\| WHITE_SPACE.test(href) \|\| BACKSLASH.test(href)) return null;` → `  if (hasControl(href) \|\| hasHiddenChar(href) \|\| BACKSLASH.test(href)) return null;` | `test/host-links.test.ts`: 1 failed \| 19 passed (20). "white space of any kind, leading, inside or trailing" | sha256 `6640619e3133…` restored, equal |
| L3.H6d | drop a refusal: backslash forms | `src/host/links.ts` | `  if (hasControl(href) \|\| hasHiddenChar(href) \|\| WHITE_SPACE.test(href) \|\| BACKSLASH.test(href)) return null;` → `  if (hasControl(href) \|\| hasHiddenChar(href) \|\| WHITE_SPACE.test(href)) return null;` | `test/host-links.test.ts`: 2 failed \| 18 passed (20). "//h/x, and every slash-and-backslash spelling of it"; "a backslash anywhere, raw or percent-encoded in either case" | sha256 `6640619e3133…` restored, equal |
| L3.H6e | drop a refusal: protocol-relative | `src/host/links.ts` | `  if (href.startsWith('//')) return null; ⏎ ` → (removed) | `test/host-links.test.ts`: 1 failed \| 19 passed (20). "//h/x, and every slash-and-backslash spelling of it" | sha256 `6640619e3133…` restored, equal |
| L3.H6f | drop a refusal: javascript:, data:, vbscript: and every other scheme | `src/host/links.ts` | `  if (scheme !== undefined) return null; ⏎ ` → (removed) | `test/host-links.test.ts`: 2 failed \| 18 passed (20). "every other scheme: file, ftp, blob, intent, about, chrome, a made-up one, and a scheme with a dot or a plus"; "javascript:, data: and vbscript:, in any case" | sha256 `6640619e3133…` restored, equal |
| L3.H6g | keep the query of a relative link | `src/host/links.ts` | `  const path = queryAt < 0 ? before : before.slice(0, queryAt);` → `  const path = before;` | `test/host-links.test.ts`: 4 failed \| 16 passed (20). "a fragment-only link is a fragment, in the fragment grammar"; "a fragment-only link outside the grammar, or empty, is refused"; "a colon after the first slash, query or fragment is no scheme"; "a relative path keeps its path and fragment; its query is dropped" | sha256 `6640619e3133…` restored, equal |
| L3.H6h | drop a refusal: http or https without its two slashes or host | `src/host/links.ts` | `  if (!rest.startsWith('//') \|\| rest.length === 2 \|\| rest[2] === '/') return null; ⏎ ` → (removed) | `test/host-links.test.ts`: 1 failed \| 19 passed (20). "an http or https link without its two slashes, or with no host" | sha256 `6640619e3133…` restored, equal |
| L3.H6i | drop a refusal: a fragment outside the fragment grammar | `src/host/links.ts` | `  return isFragmentId(id) ? id : null;` → `  return id === '' ? null : id;` | `test/host-links.test.ts`: 2 failed \| 18 passed (20). "a fragment-only link outside the grammar, or empty, is refused"; "a fragment outside the fragment grammar is dropped, a percent-encoded one inside it is decoded" | sha256 `6640619e3133…` restored, equal |
| L3.H6j | drop a refusal: the copy check's bidi controls and zero-width characters | `src/host/links.ts` | `hasControl(href) \|\| hasHiddenChar(href) \|\| WHITE_SPACE` → `hasControl(href) \|\| WHITE_SPACE` | `test/host-links.test.ts`: 1 failed \| 19 passed (20). "the copy check's bidi controls and zero-width characters, anywhere, in every kind of link" | sha256 `6640619e3133…` restored, equal |
| L3.H6k | a mailto host taken from the raw text, unparsed | `src/host/links.ts` | `mailHost(at.slice(at.lastIndexOf('@') + 1))` → `at.slice(at.lastIndexOf('@') + 1).toLowerCase()` | `test/host-links.test.ts`: 2 failed \| 18 passed (20). "a mailto domain the URL parser refuses, or one that holds more than a host or reads as another host, is refused"; "a mailto host is the domain as the URL parser reads it: an international name in its ASCII form" | sha256 `6640619e3133…` restored, equal |
| L3.H6l | a mailto domain may carry more than a host | `src/host/links.ts` | `  if (!bare \|\| url.hostname === '') return null;` → `  if (url.hostname === '') return null;` | `test/host-links.test.ts`: 1 failed \| 19 passed (20). "a mailto domain the URL parser refuses, or one that holds more than a host or reads as another host, is refused" | sha256 `6640619e3133…` restored, equal |
| L3.H6m | an ASCII mailto domain may read as another host | `src/host/links.ts` | `  if (/^[\x00-\x7f]*$/.test(domain) && url.hostname !== domain.toLowerCase()) return null; ⏎ ` → (removed) | `test/host-links.test.ts`: 1 failed \| 19 passed (20). "a mailto domain the URL parser refuses, or one that holds more than a host or reads as another host, is refused" | sha256 `6640619e3133…` restored, equal |

```json
[
  {
    "id": "L3.H6a",
    "guard": "drop a refusal: the 4096 code-unit cap",
    "file": "src/host/links.ts",
    "old": "  if (href.length < 1 || href.length > BRIDGE_LIMITS.hrefMaxChars) return null;",
    "new": "  if (href.length < 1) return null;",
    "tests": "test/host-links.test.ts",
    "rc": 1,
    "red": "1 failed | 19 passed (20)",
    "failing": [
      "L3.H6 refused: controls, white space and length > 4097 code units are refused; 4096 pass"
    ],
    "sha256": "6640619e3133097e1557933adc11d70c1862739b7cf0edf9e2e686b5b1e52c1a",
    "restored": true
  },
  {
    "id": "L3.H6b",
    "guard": "drop a refusal: controls",
    "file": "src/host/links.ts",
    "old": "  if (hasControl(href) || hasHiddenChar(href) || WHITE_SPACE.test(href) || BACKSLASH.test(href)) return null;",
    "new": "  if (hasHiddenChar(href) || WHITE_SPACE.test(href) || BACKSLASH.test(href)) return null;",
    "tests": "test/host-links.test.ts",
    "rc": 1,
    "red": "1 failed | 19 passed (20)",
    "failing": [
      "L3.H6 refused: controls, white space and length > every C0 control, DEL and every C1 control, anywhere"
    ],
    "sha256": "6640619e3133097e1557933adc11d70c1862739b7cf0edf9e2e686b5b1e52c1a",
    "restored": true
  },
  {
    "id": "L3.H6c",
    "guard": "drop a refusal: white space",
    "file": "src/host/links.ts",
    "old": "  if (hasControl(href) || hasHiddenChar(href) || WHITE_SPACE.test(href) || BACKSLASH.test(href)) return null;",
    "new": "  if (hasControl(href) || hasHiddenChar(href) || BACKSLASH.test(href)) return null;",
    "tests": "test/host-links.test.ts",
    "rc": 1,
    "red": "1 failed | 19 passed (20)",
    "failing": [
      "L3.H6 refused: controls, white space and length > white space of any kind, leading, inside or trailing"
    ],
    "sha256": "6640619e3133097e1557933adc11d70c1862739b7cf0edf9e2e686b5b1e52c1a",
    "restored": true
  },
  {
    "id": "L3.H6d",
    "guard": "drop a refusal: backslash forms",
    "file": "src/host/links.ts",
    "old": "  if (hasControl(href) || hasHiddenChar(href) || WHITE_SPACE.test(href) || BACKSLASH.test(href)) return null;",
    "new": "  if (hasControl(href) || hasHiddenChar(href) || WHITE_SPACE.test(href)) return null;",
    "tests": "test/host-links.test.ts",
    "rc": 1,
    "red": "2 failed | 18 passed (20)",
    "failing": [
      "L3.H6 refused: protocol-relative and backslash forms > //h/x, and every slash-and-backslash spelling of it",
      "L3.H6 refused: protocol-relative and backslash forms > a backslash anywhere, raw or percent-encoded in either case"
    ],
    "sha256": "6640619e3133097e1557933adc11d70c1862739b7cf0edf9e2e686b5b1e52c1a",
    "restored": true
  },
  {
    "id": "L3.H6e",
    "guard": "drop a refusal: protocol-relative",
    "file": "src/host/links.ts",
    "old": "  if (href.startsWith('//')) return null;\n",
    "new": "",
    "tests": "test/host-links.test.ts",
    "rc": 1,
    "red": "1 failed | 19 passed (20)",
    "failing": [
      "L3.H6 refused: protocol-relative and backslash forms > //h/x, and every slash-and-backslash spelling of it"
    ],
    "sha256": "6640619e3133097e1557933adc11d70c1862739b7cf0edf9e2e686b5b1e52c1a",
    "restored": true
  },
  {
    "id": "L3.H6f",
    "guard": "drop a refusal: javascript:, data:, vbscript: and every other scheme",
    "file": "src/host/links.ts",
    "old": "  if (scheme !== undefined) return null;\n",
    "new": "",
    "tests": "test/host-links.test.ts",
    "rc": 1,
    "red": "2 failed | 18 passed (20)",
    "failing": [
      "L3.H6 refused: script-bearing and unknown schemes > every other scheme: file, ftp, blob, intent, about, chrome, a made-up one, and a scheme with a dot or a plus",
      "L3.H6 refused: script-bearing and unknown schemes > javascript:, data: and vbscript:, in any case"
    ],
    "sha256": "6640619e3133097e1557933adc11d70c1862739b7cf0edf9e2e686b5b1e52c1a",
    "restored": true
  },
  {
    "id": "L3.H6g",
    "guard": "keep the query of a relative link",
    "file": "src/host/links.ts",
    "old": "  const path = queryAt < 0 ? before : before.slice(0, queryAt);",
    "new": "  const path = before;",
    "tests": "test/host-links.test.ts",
    "rc": 1,
    "red": "4 failed | 16 passed (20)",
    "failing": [
      "L3.H6 accepted: fragments > a fragment-only link is a fragment, in the fragment grammar",
      "L3.H6 accepted: fragments > a fragment-only link outside the grammar, or empty, is refused",
      "L3.H6 accepted: relative links, with the query dropped > a colon after the first slash, query or fragment is no scheme",
      "L3.H6 accepted: relative links, with the query dropped > a relative path keeps its path and fragment; its query is dropped"
    ],
    "sha256": "6640619e3133097e1557933adc11d70c1862739b7cf0edf9e2e686b5b1e52c1a",
    "restored": true
  },
  {
    "id": "L3.H6h",
    "guard": "drop a refusal: http or https without its two slashes or host",
    "file": "src/host/links.ts",
    "old": "  if (!rest.startsWith('//') || rest.length === 2 || rest[2] === '/') return null;\n",
    "new": "",
    "tests": "test/host-links.test.ts",
    "rc": 1,
    "red": "1 failed | 19 passed (20)",
    "failing": [
      "L3.H6 refused: protocol-relative and backslash forms > an http or https link without its two slashes, or with no host"
    ],
    "sha256": "6640619e3133097e1557933adc11d70c1862739b7cf0edf9e2e686b5b1e52c1a",
    "restored": true
  },
  {
    "id": "L3.H6i",
    "guard": "drop a refusal: a fragment outside the fragment grammar",
    "file": "src/host/links.ts",
    "old": "  return isFragmentId(id) ? id : null;",
    "new": "  return id === '' ? null : id;",
    "tests": "test/host-links.test.ts",
    "rc": 1,
    "red": "2 failed | 18 passed (20)",
    "failing": [
      "L3.H6 accepted: fragments > a fragment-only link outside the grammar, or empty, is refused",
      "L3.H6 accepted: relative links, with the query dropped > a fragment outside the fragment grammar is dropped, a percent-encoded one inside it is decoded"
    ],
    "sha256": "6640619e3133097e1557933adc11d70c1862739b7cf0edf9e2e686b5b1e52c1a",
    "restored": true
  },
  {
    "id": "L3.H6j",
    "guard": "drop a refusal: the copy check's bidi controls and zero-width characters",
    "file": "src/host/links.ts",
    "old": "hasControl(href) || hasHiddenChar(href) || WHITE_SPACE",
    "new": "hasControl(href) || WHITE_SPACE",
    "tests": "test/host-links.test.ts",
    "rc": 1,
    "red": "1 failed | 19 passed (20)",
    "failing": [
      "L3.H6 refused: controls, white space and length > the copy check's bidi controls and zero-width characters, anywhere, in every kind of link"
    ],
    "sha256": "6640619e3133097e1557933adc11d70c1862739b7cf0edf9e2e686b5b1e52c1a",
    "restored": true
  },
  {
    "id": "L3.H6k",
    "guard": "a mailto host taken from the raw text, unparsed",
    "file": "src/host/links.ts",
    "old": "mailHost(at.slice(at.lastIndexOf('@') + 1))",
    "new": "at.slice(at.lastIndexOf('@') + 1).toLowerCase()",
    "tests": "test/host-links.test.ts",
    "rc": 1,
    "red": "2 failed | 18 passed (20)",
    "failing": [
      "L3.H6 accepted: external links > a mailto domain the URL parser refuses, or one that holds more than a host or reads as another host, is refused",
      "L3.H6 accepted: external links > a mailto host is the domain as the URL parser reads it: an international name in its ASCII form"
    ],
    "sha256": "6640619e3133097e1557933adc11d70c1862739b7cf0edf9e2e686b5b1e52c1a",
    "restored": true
  },
  {
    "id": "L3.H6l",
    "guard": "a mailto domain may carry more than a host",
    "file": "src/host/links.ts",
    "old": "  if (!bare || url.hostname === '') return null;",
    "new": "  if (url.hostname === '') return null;",
    "tests": "test/host-links.test.ts",
    "rc": 1,
    "red": "1 failed | 19 passed (20)",
    "failing": [
      "L3.H6 accepted: external links > a mailto domain the URL parser refuses, or one that holds more than a host or reads as another host, is refused"
    ],
    "sha256": "6640619e3133097e1557933adc11d70c1862739b7cf0edf9e2e686b5b1e52c1a",
    "restored": true
  },
  {
    "id": "L3.H6m",
    "guard": "an ASCII mailto domain may read as another host",
    "file": "src/host/links.ts",
    "old": "  if (/^[\\x00-\\x7f]*$/.test(domain) && url.hostname !== domain.toLowerCase()) return null;\n",
    "new": "",
    "tests": "test/host-links.test.ts",
    "rc": 1,
    "red": "1 failed | 19 passed (20)",
    "failing": [
      "L3.H6 accepted: external links > a mailto domain the URL parser refuses, or one that holds more than a host or reads as another host, is refused"
    ],
    "sha256": "6640619e3133097e1557933adc11d70c1862739b7cf0edf9e2e686b5b1e52c1a",
    "restored": true
  }
]
```

## Copy: `src/host/copy.ts` (L3.H7a to L3.H7g)

Reference §11.3, mirroring M8.19. The plan's row "drop a class" is one row per class: the C0 controls with ESC (L3.H7a), DEL (L3.H7b), the bidi embeddings and overrides (L3.H7c), the bidi isolates (L3.H7d) and the zero-width characters (L3.H7e). L3.H7f reports tab and newline, and L3.H7g counts indices in code points.

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.H7a | drop a class: C0 controls (ESC among them) | `src/host/copy.ts` | `  if (c < 0x20) return c === TAB \|\| c === NEWLINE ? null : (C0_NAMES[c] ?? null);` → `  if (c < 0x20) return null;` | `test/host-copy.test.ts`: 4 failed \| 17 passed (21). "DEL, NUL, BEL, BACKSPACE, VT, FF and CR"; "ESC"; "every C0 control but tab and newline, each with a name of its own"; "every hidden character of a mixed text, in order" | sha256 `c56eb9ee5809…` restored, equal |
| L3.H7b | drop a class: DEL | `src/host/copy.ts` | `  0x7f: 'DELETE', ⏎ ` → (removed) | `test/host-copy.test.ts`: 1 failed \| 20 passed (21). "DEL, NUL, BEL, BACKSPACE, VT, FF and CR" | sha256 `c56eb9ee5809…` restored, equal |
| L3.H7c | drop a class: the bidi embeddings and overrides (U+202A to U+202E) | `src/host/copy.ts` | `  0x202a: 'LEFT-TO-RIGHT EMBEDDING', ⏎   0x202b: 'RIGHT-TO-LEFT EMBEDDING', ⏎   0x202c: 'POP DIRECTIONAL FORMATTING', ⏎   0x202d: 'LEFT-TO-RIGHT OVERRIDE', ⏎   0x202e: 'RIGHT-TO-LEFT OVERRIDE', ⏎ ` → (removed) | `test/host-copy.test.ts`: 6 failed \| 15 passed (21). "the bidi control U+202A LEFT-TO-RIGHT EMBEDDING"; "the bidi control U+202B RIGHT-TO-LEFT EMBEDDING"; "the bidi control U+202C POP DIRECTIONAL FORMATTING"; "the bidi control U+202D LEFT-TO-RIGHT OVERRIDE"; "the bidi control U+202E RIGHT-TO-LEFT OVERRIDE"; and 1 more | sha256 `c56eb9ee5809…` restored, equal |
| L3.H7d | drop a class: the bidi isolates (U+2066 to U+2069) | `src/host/copy.ts` | `  0x2066: 'LEFT-TO-RIGHT ISOLATE', ⏎   0x2067: 'RIGHT-TO-LEFT ISOLATE', ⏎   0x2068: 'FIRST STRONG ISOLATE', ⏎   0x2069: 'POP DIRECTIONAL ISOLATE', ⏎ ` → (removed) | `test/host-copy.test.ts`: 5 failed \| 16 passed (21). "the bidi control U+2066 LEFT-TO-RIGHT ISOLATE"; "the bidi control U+2067 RIGHT-TO-LEFT ISOLATE"; "the bidi control U+2068 FIRST STRONG ISOLATE"; "the bidi control U+2069 POP DIRECTIONAL ISOLATE"; "every hidden character of a mixed text, in order" | sha256 `c56eb9ee5809…` restored, equal |
| L3.H7e | drop a class: the zero-width characters | `src/host/copy.ts` | `  0x200b: 'ZERO WIDTH SPACE', ⏎   0x200c: 'ZERO WIDTH NON-JOINER', ⏎   0x200d: 'ZERO WIDTH JOINER', ⏎   0x2060: 'WORD JOINER', ⏎   0xfeff: 'ZERO WIDTH NO-BREAK SPACE', ⏎ ` → (removed) | `test/host-copy.test.ts`: 7 failed \| 14 passed (21). "the zero-width character U+200B ZERO WIDTH SPACE"; "the zero-width character U+200C ZERO WIDTH NON-JOINER"; "the zero-width character U+200D ZERO WIDTH JOINER"; "the zero-width character U+2060 WORD JOINER"; "the zero-width character U+FEFF ZERO WIDTH NO-BREAK SPACE"; and 2 more | sha256 `c56eb9ee5809…` restored, equal |
| L3.H7f | report tab and newline as hidden | `src/host/copy.ts` | `return c === TAB \|\| c === NEWLINE ? null : (C0_NAMES[c] ?? null);` → `return C0_NAMES[c] ?? null;` | `test/host-copy.test.ts`: 2 failed \| 19 passed (21). "every C0 control but tab and newline, each with a name of its own"; "clean text, tab, newline, ordinary non-ASCII and the marks beside the listed ranges give nothing" | sha256 `c56eb9ee5809…` restored, equal |
| L3.H7g | index by code points, not UTF-16 code units | `src/host/copy.ts` | `  for (let i = 0; i < text.length; i += 1) { ⏎     const c = text.charCodeAt(i);` → `  let i = -1; ⏎   for (const ch of text) { ⏎     i += 1; ⏎     const c = ch.codePointAt(0) ?? 0;` | `test/host-copy.test.ts`: 1 failed \| 20 passed (21). "an astral character before a hidden one counts two" | sha256 `c56eb9ee5809…` restored, equal |

```json
[
  {
    "id": "L3.H7a",
    "guard": "drop a class: C0 controls (ESC among them)",
    "file": "src/host/copy.ts",
    "old": "  if (c < 0x20) return c === TAB || c === NEWLINE ? null : (C0_NAMES[c] ?? null);",
    "new": "  if (c < 0x20) return null;",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "4 failed | 17 passed (21)",
    "failing": [
      "L3.H7 each hidden character is reported with its index and name > DEL, NUL, BEL, BACKSPACE, VT, FF and CR",
      "L3.H7 each hidden character is reported with its index and name > ESC",
      "L3.H7 each hidden character is reported with its index and name > every C0 control but tab and newline, each with a name of its own",
      "L3.H7 indices are UTF-16 code units, in order > every hidden character of a mixed text, in order"
    ],
    "sha256": "c56eb9ee58090f70d35770adcf99246573ad3bd6e55231ad604a1572fca23a8b",
    "restored": true
  },
  {
    "id": "L3.H7b",
    "guard": "drop a class: DEL",
    "file": "src/host/copy.ts",
    "old": "  0x7f: 'DELETE',\n",
    "new": "",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "1 failed | 20 passed (21)",
    "failing": [
      "L3.H7 each hidden character is reported with its index and name > DEL, NUL, BEL, BACKSPACE, VT, FF and CR"
    ],
    "sha256": "c56eb9ee58090f70d35770adcf99246573ad3bd6e55231ad604a1572fca23a8b",
    "restored": true
  },
  {
    "id": "L3.H7c",
    "guard": "drop a class: the bidi embeddings and overrides (U+202A to U+202E)",
    "file": "src/host/copy.ts",
    "old": "  0x202a: 'LEFT-TO-RIGHT EMBEDDING',\n  0x202b: 'RIGHT-TO-LEFT EMBEDDING',\n  0x202c: 'POP DIRECTIONAL FORMATTING',\n  0x202d: 'LEFT-TO-RIGHT OVERRIDE',\n  0x202e: 'RIGHT-TO-LEFT OVERRIDE',\n",
    "new": "",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "6 failed | 15 passed (21)",
    "failing": [
      "L3.H7 each hidden character is reported with its index and name > the bidi control U+202A LEFT-TO-RIGHT EMBEDDING",
      "L3.H7 each hidden character is reported with its index and name > the bidi control U+202B RIGHT-TO-LEFT EMBEDDING",
      "L3.H7 each hidden character is reported with its index and name > the bidi control U+202C POP DIRECTIONAL FORMATTING",
      "L3.H7 each hidden character is reported with its index and name > the bidi control U+202D LEFT-TO-RIGHT OVERRIDE",
      "L3.H7 each hidden character is reported with its index and name > the bidi control U+202E RIGHT-TO-LEFT OVERRIDE",
      "L3.H7 indices are UTF-16 code units, in order > every hidden character of a mixed text, in order"
    ],
    "sha256": "c56eb9ee58090f70d35770adcf99246573ad3bd6e55231ad604a1572fca23a8b",
    "restored": true
  },
  {
    "id": "L3.H7d",
    "guard": "drop a class: the bidi isolates (U+2066 to U+2069)",
    "file": "src/host/copy.ts",
    "old": "  0x2066: 'LEFT-TO-RIGHT ISOLATE',\n  0x2067: 'RIGHT-TO-LEFT ISOLATE',\n  0x2068: 'FIRST STRONG ISOLATE',\n  0x2069: 'POP DIRECTIONAL ISOLATE',\n",
    "new": "",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "5 failed | 16 passed (21)",
    "failing": [
      "L3.H7 each hidden character is reported with its index and name > the bidi control U+2066 LEFT-TO-RIGHT ISOLATE",
      "L3.H7 each hidden character is reported with its index and name > the bidi control U+2067 RIGHT-TO-LEFT ISOLATE",
      "L3.H7 each hidden character is reported with its index and name > the bidi control U+2068 FIRST STRONG ISOLATE",
      "L3.H7 each hidden character is reported with its index and name > the bidi control U+2069 POP DIRECTIONAL ISOLATE",
      "L3.H7 indices are UTF-16 code units, in order > every hidden character of a mixed text, in order"
    ],
    "sha256": "c56eb9ee58090f70d35770adcf99246573ad3bd6e55231ad604a1572fca23a8b",
    "restored": true
  },
  {
    "id": "L3.H7e",
    "guard": "drop a class: the zero-width characters",
    "file": "src/host/copy.ts",
    "old": "  0x200b: 'ZERO WIDTH SPACE',\n  0x200c: 'ZERO WIDTH NON-JOINER',\n  0x200d: 'ZERO WIDTH JOINER',\n  0x2060: 'WORD JOINER',\n  0xfeff: 'ZERO WIDTH NO-BREAK SPACE',\n",
    "new": "",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "7 failed | 14 passed (21)",
    "failing": [
      "L3.H7 each hidden character is reported with its index and name > the zero-width character U+200B ZERO WIDTH SPACE",
      "L3.H7 each hidden character is reported with its index and name > the zero-width character U+200C ZERO WIDTH NON-JOINER",
      "L3.H7 each hidden character is reported with its index and name > the zero-width character U+200D ZERO WIDTH JOINER",
      "L3.H7 each hidden character is reported with its index and name > the zero-width character U+2060 WORD JOINER",
      "L3.H7 each hidden character is reported with its index and name > the zero-width character U+FEFF ZERO WIDTH NO-BREAK SPACE",
      "L3.H7 indices are UTF-16 code units, in order > an astral character before a hidden one counts two",
      "L3.H7 indices are UTF-16 code units, in order > every hidden character of a mixed text, in order"
    ],
    "sha256": "c56eb9ee58090f70d35770adcf99246573ad3bd6e55231ad604a1572fca23a8b",
    "restored": true
  },
  {
    "id": "L3.H7f",
    "guard": "report tab and newline as hidden",
    "file": "src/host/copy.ts",
    "old": "return c === TAB || c === NEWLINE ? null : (C0_NAMES[c] ?? null);",
    "new": "return C0_NAMES[c] ?? null;",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "2 failed | 19 passed (21)",
    "failing": [
      "L3.H7 each hidden character is reported with its index and name > every C0 control but tab and newline, each with a name of its own",
      "L3.H7 what is not hidden > clean text, tab, newline, ordinary non-ASCII and the marks beside the listed ranges give nothing"
    ],
    "sha256": "c56eb9ee58090f70d35770adcf99246573ad3bd6e55231ad604a1572fca23a8b",
    "restored": true
  },
  {
    "id": "L3.H7g",
    "guard": "index by code points, not UTF-16 code units",
    "file": "src/host/copy.ts",
    "old": "  for (let i = 0; i < text.length; i += 1) {\n    const c = text.charCodeAt(i);",
    "new": "  let i = -1;\n  for (const ch of text) {\n    i += 1;\n    const c = ch.codePointAt(0) ?? 0;",
    "tests": "test/host-copy.test.ts",
    "rc": 1,
    "red": "1 failed | 20 passed (21)",
    "failing": [
      "L3.H7 indices are UTF-16 code units, in order > an astral character before a hidden one counts two"
    ],
    "sha256": "c56eb9ee58090f70d35770adcf99246573ad3bd6e55231ad604a1572fca23a8b",
    "restored": true
  }
]
```

## Coordinator addition: the C1 controls are hidden (ledger C88)

After the fix round the coordinator widened the copy check to the C1 controls, U+0080 to U+009F (a terminal reads
U+009B, CSI, as the start of an escape sequence), with their Unicode name aliases. The test moved U+0080 and U+009F out
of the "not hidden" row (U+007E, U+00A0 and U+00A1 now border the range there) and added two rows; against the fix
round's `copy.ts` they failed (2 failed | 21 passed (23), assertion failures), then passed with the C1 branch added
(with `test/host-links.test.ts`, 43 passed).

| Row | Guard | File | Change | Exit | Red | Restore |
|---|---|---|---|---|---|---|
| L3.H7c1 (coordinator) | the C1 controls are hidden | `src/host/copy.ts` | `  if (c >= 0x80 && c <= 0x9f) return C1_NAMES[c - 0x80] ?? null;` → (deleted) | 1 | `test/host-copy.test.ts`: 2 failed \| 21 passed (23). "CSI, the one-code-point form of ESC [, is reported by name"; "every C1 control, U+0080 to U+009F, each with a name of its own". | sha256 `230141e4…` matched |

Measured under `ulimit -u 3476` (threads 1976 plus 1500) and `timeout -k 10 600`. The earlier rows were measured on
`copy.ts` before this addition; the only later change is the C1 table, its branch and the header comment, which none of
their edits touch.
