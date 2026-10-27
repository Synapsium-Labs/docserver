# L3 Task 2: mutation rows (the pure SHA-256, the CSP builder and checker)

Each guard of Task 2, changed once, with the tests that go red: every rule of the frame policy's floor
(`src/frame/csp-rules.ts`), the hash set of `checkFrameCsp` (`src/frame/csp.ts`), the pure SHA-256 and its memo
(`src/frame/sha256.ts`), the closed list of refusal reasons, the one-tokeniser pin and the no-host-crypto wall. Measured
2026-10-27 (UTC) on branch `l3-t02-sha-csp` (base `4600619`, the Task 2 changes not yet committed), on the final code:
every row was measured after the last edit to the files it mutates and to the test files it runs.

**Result.** 34 rows: 33 red and one equivalent mutant, L3.M6q. Every red run exits 1, and every failing test failed
through an `AssertionError` (none through a file that failed to load, an unhandled error or a timeout).

**The equivalent mutant (L3.M6q), under ledger C86 (an unreachable defensive check, kept).** The plan's row "tokenise
on space only" has two readings, and both are measured. Read as "split a directive on the space alone instead of on
ASCII whitespace" (L3.M6q, `part.split(/[\t\n\f\r ]+/)` → `part.split(' ')`), it leaves the suite green, because no
policy that reaches the tokeniser holds a tab, a line feed, a form feed or a carriage return: Reference §10 refuses
"any character outside printable ASCII" first, and those four are outside it (`[\x20-\x7e]`). Runs of spaces were
already dropped by the empty-token filter, so the space alone and ASCII whitespace split every reachable policy the
same way. The rows "a tab between a directive and its value", "a line feed …", "a carriage return …" and "a form feed
…" pin the order that makes it unreachable: each is refused as `character`, before any tokenising, so the day the
character rule admits whitespace, those rows go red and this mutant becomes reachable. The tokeniser keeps the
Reference's ASCII-whitespace split. Read as "tokenise on the space only, `;` no longer a separator" (L3.M6r), the
mutant is red: 103 rows.

**Method** (Global Constraints, "Low disk"; C69, C75). One row at a time, in place in the task's own worktree, never in
parallel and never in a copy of the repository. For each row, the file's original bytes and their sha256 were saved
outside the worktree. Each `old` text was checked to occur exactly once and replaced by its `new`. The thread count was
measured (`ps -L -u "$(id -u)" --no-headers | wc -l`, 2216 to 2418 over the runs) and the row ran as
`ulimit -u <threads + 1500>; timeout -k 10 600 ./node_modules/.bin/vitest run --maxWorkers=2 <tests>`, with its output
captured to a log named by the row id. The file was then restored from the saved bytes and its sha256 checked equal to
the saved one (never `git checkout`). Every restore matched, and after the last row `sha256sum -c` over the three
mutated files matched the hashes taken before the first.

A row that mutates `src/frame/csp-rules.ts` runs `test/frame-csp.test.ts` only: the bootstrap bundles that file, so
`test/frame-document.test.ts` and `test/frame-sha256.test.ts`, which build the frame in memory, would also see a
bootstrap that no longer matches the committed manifest. No row needs a rebuild: every mutated file is read from source
by the tests a row runs. `node scripts/build-frame.mjs --check` is green on the restored tree.

The Red column gives the count line and the failing tests the run printed (at most five here; the JSON fence lists
all). In the Change column a line break is shown as ` ⏎ ` and a raw character a row writes as `<U+XXXX>`; the JSON
fence holds the exact text.

Notes on the measurement.
- The policy rows name reasons, not messages (`CSP_REFUSALS`), so a rule that is dropped is red even where another rule
  still refuses the policy: without the character rule's second half (L3.M6d), a `"` in `img-src` is refused as
  `img-src`, and the row that expects `character` goes red.
- L3.M6a (the `type` rule) is red through the check throwing on a number, `null` or an array (`csp.split is not a
  function`, `Cannot read properties of null`): every row calls the check inside `expect(...).not.toThrow()`, so a crash
  is an assertion failure, and a `String` object, which does not throw, is accepted by the mutant and red as well.
- L3.M6f (the duplicate rule) is red through the browser's reading as well as the rule's: browsers obey the first of two
  directives, and the row "a first script-src of 'unsafe-inline', then the valid one" is accepted by the mutant, which
  reads the second.
- L3.M6p is the plan's "accept `'self'` in `script-src`"; L3.M6k and L3.M6o are the prototype's `imgsrc-drop` and
  `unknownhash-drop`.
- L3.M6v and L3.M6w drop the anchors of `HASH_SOURCE` (`^`, then `$`). Before the review's fix round both were green:
  no row put a real hash with something before or after it in `script-src`. Four rows now do (the guard hash followed
  by a letter or a second quote, and after one), and each mutant is red through two of them and the floor's agreement
  row; `checkFrameCsp` alone would still refuse such a policy, later, as `unknown-hash`.
- The review's fix round (2026-10-27) changed both test files, so every row, old and new, was measured again on the
  final files; the counts here are that run's.

## The policy: `cspFloor` and `checkFrameCsp` (L3.M6a to L3.M6w)


| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.M6a | a policy that is not a string is refused (type) | `src/frame/csp-rules.ts` | `if (typeof csp !== 'string') return { ok: false, why: 'type' }; ⏎` removed | `test/frame-csp.test.ts`: 7 failed \| 132 passed (139). "every reason is the answer of at least one row below, and every row answers a reason on the list"; "a number: refused as type"; "an array holding the policy: refused as type"; "null: refused as type"; "undefined: refused as type" | sha256 `2102921cd426…` restored, equal |
| L3.M6b | at most 4096 characters (length) | `src/frame/csp-rules.ts` | `if (csp.length > CSP_MAX_CHARS) return { ok: false, why: 'length' }; ⏎` removed | `test/frame-csp.test.ts`: 4 failed \| 135 passed (139). "every reason is the answer of at least one row below, and every row answers a reason on the list"; "4097 characters (trailing spaces only): refused as length"; "4097 characters (a long valid-looking script-src): refused as length"; "agrees with checkFrameCsp on every floor row, and never answers a hash reason" | sha256 `2102921cd426…` restored, equal |
| L3.M6c | printable ASCII only (character, first half) | `src/frame/csp-rules.ts` | `if (!/^[\x20-\x7e]*$/.test(csp) \|\| /["<>&]/.test(csp)) return` → `if (/["<>&]/.test(csp)) return` | `test/frame-csp.test.ts`: 11 failed \| 128 passed (139). "every reason is the answer of at least one row below, and every row answers a reason on the list"; "a tab between a directive and its value: refused as character"; "a line feed between directives: refused as character"; "a carriage return between directives: refused as character"; "a form feed between directives: refused as character" | sha256 `2102921cd426…` restored, equal |
| L3.M6d | none of "<>& (character, second half) | `src/frame/csp-rules.ts` | `if (!/^[\x20-\x7e]*$/.test(csp) \|\| /["<>&]/.test(csp)) return` → `if (!/^[\x20-\x7e]*$/.test(csp)) return` | `test/frame-csp.test.ts`: 5 failed \| 134 passed (139). "a double quote in a value: refused as character"; "a less-than sign in a value: refused as character"; "a greater-than sign in a value: refused as character"; "an ampersand in a value: refused as character"; "agrees with checkFrameCsp on every floor row, and never answers a hash reason" | sha256 `2102921cd426…` restored, equal |
| L3.M6e | only FRAME_DIRECTIVES (directive) | `src/frame/csp-rules.ts` | `if (!FRAME_DIRECTIVES.includes(name)) return { ok: false, why: 'directive' }; ⏎` removed | `test/frame-csp.test.ts`: 22 failed \| 117 passed (139). "every reason is the answer of at least one row below, and every row answers a reason on the list"; "an added connect-src *: refused as directive"; "an added connect-src 'none': refused as directive"; "an added frame-src 'none': refused as directive"; "an added child-src 'none': refused as directive" | sha256 `2102921cd426…` restored, equal |
| L3.M6f | each directive once (duplicate) | `src/frame/csp-rules.ts` | `if (seen.has(name)) return { ok: false, why: 'duplicate' }; ⏎` removed | `test/frame-csp.test.ts`: 5 failed \| 134 passed (139). "every reason is the answer of at least one row below, and every row answers a reason on the list"; "img-src twice, both valid: refused as duplicate"; "a first script-src of 'unsafe-inline', then the valid one: refused as duplicate"; "a first default-src '*', then the valid one: refused as duplicate"; "agrees with checkFrameCsp on every floor row, and never answers a hash reason" | sha256 `2102921cd426…` restored, equal |
| L3.M6g | default-src 'none' (default-src) | `src/frame/csp-rules.ts` | `if (!is('default-src', none)) return { ok: false, why: 'default-src' }; ⏎` removed | `test/frame-csp.test.ts`: 8 failed \| 131 passed (139). "every reason is the answer of at least one row below, and every row answers a reason on the list"; "default-src missing: refused as default-src"; "default-src 'self': refused as default-src"; "default-src *: refused as default-src"; "default-src 'none' 'self': refused as default-src" | sha256 `2102921cd426…` restored, equal |
| L3.M6h | script-src hash sources only (script-src) | `src/frame/csp-rules.ts` | `if (!is('script-src', (v) => v.length > 0 && v.every((t) => HASH_SOURCE.test(t)))) return { ok: false, why: 'script-src' }; ⏎` removed | `test/frame-csp.test.ts`: 30 failed \| 109 passed (139). "every reason is the answer of at least one row below, and every row answers a reason on the list"; "script-src missing: refused as script-src"; "script-src with no source: refused as script-src"; "script-src with 'self' beside the hashes: refused as script-src"; "script-src with 'none' beside the hashes: refused as script-src" | sha256 `2102921cd426…` restored, equal |
| L3.M6i | style-src within {'unsafe-inline', data:} (style-src) | `src/frame/csp-rules.ts` | `if (seen.has('style-src') && !is('style-src', ONLY(["'unsafe-inline'", 'data:']))) return { ok: false, why: 'style-src' }; ⏎` removed | `test/frame-csp.test.ts`: 10 failed \| 129 passed (139). "every reason is the answer of at least one row below, and every row answers a reason on the list"; "style-src with 'self': refused as style-src"; "style-src with *: refused as style-src"; "style-src with https:: refused as style-src"; "style-src with blob:: refused as style-src" | sha256 `2102921cd426…` restored, equal |
| L3.M6j | font-src within {data:} (font-src) | `src/frame/csp-rules.ts` | `if (seen.has('font-src') && !is('font-src', ONLY(['data:']))) return { ok: false, why: 'font-src' }; ⏎` removed | `test/frame-csp.test.ts`: 8 failed \| 131 passed (139). "every reason is the answer of at least one row below, and every row answers a reason on the list"; "font-src with 'self': refused as font-src"; "font-src with *: refused as font-src"; "font-src with https:: refused as font-src"; "font-src with blob:: refused as font-src" | sha256 `2102921cd426…` restored, equal |
| L3.M6k | img-src within {data:} (img-src; the prototype's imgsrc-drop) | `src/frame/csp-rules.ts` | `if (seen.has('img-src') && !is('img-src', ONLY(['data:']))) return { ok: false, why: 'img-src' }; ⏎` removed | `test/frame-csp.test.ts`: 8 failed \| 131 passed (139). "every reason is the answer of at least one row below, and every row answers a reason on the list"; "img-src with 'self': refused as img-src"; "img-src with *: refused as img-src"; "img-src with https:: refused as img-src"; "img-src with blob:: refused as img-src" | sha256 `2102921cd426…` restored, equal |
| L3.M6l | base-uri present and 'none' (base-uri) | `src/frame/csp-rules.ts` | `if (!is('base-uri', none)) return { ok: false, why: 'base-uri' }; ⏎` removed | `test/frame-csp.test.ts`: 6 failed \| 133 passed (139). "every reason is the answer of at least one row below, and every row answers a reason on the list"; "base-uri missing: refused as base-uri"; "base-uri 'self': refused as base-uri"; "base-uri 'none' 'self': refused as base-uri"; "base-uri with no value: refused as base-uri" | sha256 `2102921cd426…` restored, equal |
| L3.M6m | form-action present and 'none' (form-action) | `src/frame/csp-rules.ts` | `if (!is('form-action', none)) return { ok: false, why: 'form-action' }; ⏎` removed | `test/frame-csp.test.ts`: 6 failed \| 133 passed (139). "every reason is the answer of at least one row below, and every row answers a reason on the list"; "form-action missing: refused as form-action"; "form-action 'self': refused as form-action"; "form-action *: refused as form-action"; "form-action with no value: refused as form-action" | sha256 `2102921cd426…` restored, equal |
| L3.M6n | every required hash present (missing-hash) | `src/frame/csp.ts` | `for (const h of requiredHashes) if (!floor.scriptHashes.includes(h)) return { ok: false, why: 'missing-hash' }; ⏎` removed | `test/frame-csp.test.ts`: 6 failed \| 133 passed (139). "every reason is the answer of at least one row below, and every row answers a reason on the list"; "the guard hash removed while guard is inlined: refused as missing-hash"; "the bootstrap hash removed while bootstrap is inlined: refused as missing-hash"; "the enhance hash removed while enhance is inlined: refused as missing-hash"; "the mermaid hash removed while mermaid is inlined: refused as missing-hash" | sha256 `967381279670…` restored, equal |
| L3.M6o | no hash unknown to this version (unknown-hash; the prototype's unknownhash-drop) | `src/frame/csp.ts` | `for (const h of floor.scriptHashes) if (!KNOWN.includes(h)) return { ok: false, why: 'unknown-hash' }; ⏎` removed | `test/frame-csp.test.ts`: 4 failed \| 135 passed (139). "every reason is the answer of at least one row below, and every row answers a reason on the list"; "an unknown hash of the right form: refused as unknown-hash"; "the hash of a script that is not an asset: refused as unknown-hash"; "an unknown hash in place of the Mermaid hash, Mermaid not inlined: refused as unknown-hash" | sha256 `967381279670…` restored, equal |
| L3.M6p | script-src refuses 'self' (the mutant accepts it beside the hashes) | `src/frame/csp-rules.ts` | `v.every((t) => HASH_SOURCE.test(t))` → `v.every((t) => HASH_SOURCE.test(t) \|\| t === "'self'")` | `test/frame-csp.test.ts`: 2 failed \| 137 passed (139). "script-src with 'self' beside the hashes: refused as script-src"; "agrees with checkFrameCsp on every floor row, and never answers a hash reason" | sha256 `2102921cd426…` restored, equal |
| L3.M6q | tokenise on ASCII whitespace (the mutant splits a directive on the space alone) | `src/frame/csp-rules.ts` | `const tokens = part.split(/[\t\n\f\r ]+/).filter((t) => t !== '');` → `const tokens = part.split(' ').filter((t) => t !== '');` | `test/frame-csp.test.ts`: 139 passed (139) (green: equivalent mutant). | sha256 `2102921cd426…` restored, equal |
| L3.M6r | tokenise on ';' as well (the mutant splits the whole policy on the space alone) | `src/frame/csp-rules.ts` | `for (const part of csp.split(';')) {` → `for (const part of [csp]) {`; `const tokens = part.split(/[\t\n\f\r ]+/).filter((t) => t !== '');` → `const tokens = part.split(' ').filter((t) => t !== '');` | `test/frame-csp.test.ts`: 103 failed \| 36 passed (139). "every reason is the answer of at least one row below, and every row answers a reason on the list"; "an added connect-src *: refused as directive"; "an added connect-src 'none': refused as directive"; "an added frame-src 'none': refused as directive"; "an added child-src 'none': refused as directive" | sha256 `2102921cd426…` restored, equal |
| L3.M6s | script-src holds at least one source | `src/frame/csp-rules.ts` | `(v) => v.length > 0 && v.every((t) => HASH_SOURCE.test(t))` → `(v) => v.every((t) => HASH_SOURCE.test(t))` | `test/frame-csp.test.ts`: 2 failed \| 137 passed (139). "script-src with no source: refused as script-src"; "agrees with checkFrameCsp on every floor row, and never answers a hash reason" | sha256 `2102921cd426…` restored, equal |
| L3.M6t | a hash source is SHA-256 of 43 base64 characters and one '=' (the mutant admits sha384 and sha512) | `src/frame/csp-rules.ts` | `export const HASH_SOURCE = /^'sha256-[A-Za-z0-9+/]{43}='$/;` → `export const HASH_SOURCE = /^'sha(256\|384\|512)-[A-Za-z0-9+/]+={0,2}'$/;` | `test/frame-csp.test.ts`: 5 failed \| 134 passed (139). "script-src with 'sha384-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' beside the hashes: refused as script-src"; "script-src with 'sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==' beside the hashes: refused as script-src"; "script-src with 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' beside the hashes: refused as script-src"; "script-src with 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' beside the hashes: refused as script-src"; "agrees with checkFrameCsp on every floor row, and never answers a hash reason" | sha256 `2102921cd426…` restored, equal |
| L3.M6u | 'none' alone (the mutant accepts 'none' followed by other sources) | `src/frame/csp-rules.ts` | `const none = (v: readonly string[]): boolean => v.length === 1 && v[0] === "'none'";` → `const none = (v: readonly string[]): boolean => v[0] === "'none'";` | `test/frame-csp.test.ts`: 4 failed \| 135 passed (139). "every reason is the answer of at least one row below, and every row answers a reason on the list"; "default-src 'none' 'self': refused as default-src"; "base-uri 'none' 'self': refused as base-uri"; "agrees with checkFrameCsp on every floor row, and never answers a hash reason" | sha256 `2102921cd426…` restored, equal |
| L3.M6v | a hash source is anchored at its start (the mutant drops the ^ of HASH_SOURCE) | `src/frame/csp-rules.ts` | `export const HASH_SOURCE = /^'sha256-[A-Za-z0-9+/]{43}='$/;` → `export const HASH_SOURCE = /'sha256-[A-Za-z0-9+/]{43}='$/;` | `test/frame-csp.test.ts`: 3 failed \| 136 passed (139). "script-src with the guard hash after a letter beside the hashes: refused as script-src"; "script-src with the guard hash after a second quote beside the hashes: refused as script-src"; "agrees with checkFrameCsp on every floor row, and never answers a hash reason" | sha256 `2102921cd426…` restored, equal |
| L3.M6w | a hash source is anchored at its end (the mutant drops the $ of HASH_SOURCE) | `src/frame/csp-rules.ts` | `export const HASH_SOURCE = /^'sha256-[A-Za-z0-9+/]{43}='$/;` → `export const HASH_SOURCE = /^'sha256-[A-Za-z0-9+/]{43}='/;` | `test/frame-csp.test.ts`: 3 failed \| 136 passed (139). "script-src with the guard hash followed by a letter beside the hashes: refused as script-src"; "script-src with the guard hash followed by a second quote beside the hashes: refused as script-src"; "agrees with checkFrameCsp on every floor row, and never answers a hash reason" | sha256 `2102921cd426…` restored, equal |

```json
[
  {
    "id": "L3.M6a",
    "guard": "a policy that is not a string is refused (type)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "  if (typeof csp !== 'string') return { ok: false, why: 'type' };\n",
        "new": ""
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "7 failed | 132 passed (139)",
    "failing": [
      "every reason is the answer of at least one row below, and every row answers a reason on the list",
      "a number: refused as type",
      "an array holding the policy: refused as type",
      "null: refused as type",
      "undefined: refused as type",
      "a String object: refused as type",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6b",
    "guard": "at most 4096 characters (length)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "  if (csp.length > CSP_MAX_CHARS) return { ok: false, why: 'length' };\n",
        "new": ""
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "4 failed | 135 passed (139)",
    "failing": [
      "every reason is the answer of at least one row below, and every row answers a reason on the list",
      "4097 characters (trailing spaces only): refused as length",
      "4097 characters (a long valid-looking script-src): refused as length",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6c",
    "guard": "printable ASCII only (character, first half)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "  if (!/^[\\x20-\\x7e]*$/.test(csp) || /[\"<>&]/.test(csp)) return",
        "new": "  if (/[\"<>&]/.test(csp)) return"
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "11 failed | 128 passed (139)",
    "failing": [
      "every reason is the answer of at least one row below, and every row answers a reason on the list",
      "a tab between a directive and its value: refused as character",
      "a line feed between directives: refused as character",
      "a carriage return between directives: refused as character",
      "a form feed between directives: refused as character",
      "a NUL in a value: refused as character",
      "DEL (U+007F) in a value: refused as character",
      "U+00E9 in a value: refused as character",
      "an astral character in a value: refused as character",
      "U+2028 between directives: refused as character",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6d",
    "guard": "none of \"<>& (character, second half)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "  if (!/^[\\x20-\\x7e]*$/.test(csp) || /[\"<>&]/.test(csp)) return",
        "new": "  if (!/^[\\x20-\\x7e]*$/.test(csp)) return"
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "5 failed | 134 passed (139)",
    "failing": [
      "a double quote in a value: refused as character",
      "a less-than sign in a value: refused as character",
      "a greater-than sign in a value: refused as character",
      "an ampersand in a value: refused as character",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6e",
    "guard": "only FRAME_DIRECTIVES (directive)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "    if (!FRAME_DIRECTIVES.includes(name)) return { ok: false, why: 'directive' };\n",
        "new": ""
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "22 failed | 117 passed (139)",
    "failing": [
      "every reason is the answer of at least one row below, and every row answers a reason on the list",
      "an added connect-src *: refused as directive",
      "an added connect-src 'none': refused as directive",
      "an added frame-src 'none': refused as directive",
      "an added child-src 'none': refused as directive",
      "an added worker-src 'none': refused as directive",
      "an added object-src 'none': refused as directive",
      "an added manifest-src 'none': refused as directive",
      "an added media-src 'none': refused as directive",
      "an added frame-ancestors 'none': refused as directive",
      "an added script-src-elem 'none': refused as directive",
      "an added script-src-attr 'none': refused as directive",
      "an added style-src-elem 'none': refused as directive",
      "an added report-uri /r: refused as directive",
      "an added report-to r: refused as directive",
      "an added sandbox allow-scripts: refused as directive",
      "an added upgrade-insecure-requests: refused as directive",
      "an added require-trusted-types-for 'script': refused as directive",
      "an added trusted-types none: refused as directive",
      "an added webrtc 'block': refused as directive",
      "DEFAULT-SRC in upper case (directive names are matched exactly): refused as directive",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6f",
    "guard": "each directive once (duplicate)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "    if (seen.has(name)) return { ok: false, why: 'duplicate' };\n",
        "new": ""
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "5 failed | 134 passed (139)",
    "failing": [
      "every reason is the answer of at least one row below, and every row answers a reason on the list",
      "img-src twice, both valid: refused as duplicate",
      "a first script-src of 'unsafe-inline', then the valid one: refused as duplicate",
      "a first default-src '*', then the valid one: refused as duplicate",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6g",
    "guard": "default-src 'none' (default-src)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "  if (!is('default-src', none)) return { ok: false, why: 'default-src' };\n",
        "new": ""
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "8 failed | 131 passed (139)",
    "failing": [
      "every reason is the answer of at least one row below, and every row answers a reason on the list",
      "default-src missing: refused as default-src",
      "default-src 'self': refused as default-src",
      "default-src *: refused as default-src",
      "default-src 'none' 'self': refused as default-src",
      "default-src with no value: refused as default-src",
      "the empty policy: refused as default-src",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6h",
    "guard": "script-src hash sources only (script-src)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "  if (!is('script-src', (v) => v.length > 0 && v.every((t) => HASH_SOURCE.test(t)))) return { ok: false, why: 'script-src' };\n",
        "new": ""
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "30 failed | 109 passed (139)",
    "failing": [
      "every reason is the answer of at least one row below, and every row answers a reason on the list",
      "script-src missing: refused as script-src",
      "script-src with no source: refused as script-src",
      "script-src with 'self' beside the hashes: refused as script-src",
      "script-src with 'none' beside the hashes: refused as script-src",
      "script-src with * beside the hashes: refused as script-src",
      "script-src with https: beside the hashes: refused as script-src",
      "script-src with https://docreader.test beside the hashes: refused as script-src",
      "script-src with docreader.test beside the hashes: refused as script-src",
      "script-src with 'unsafe-inline' beside the hashes: refused as script-src",
      "script-src with 'unsafe-eval' beside the hashes: refused as script-src",
      "script-src with 'unsafe-hashes' beside the hashes: refused as script-src",
      "script-src with 'wasm-unsafe-eval' beside the hashes: refused as script-src",
      "script-src with 'strict-dynamic' beside the hashes: refused as script-src",
      "script-src with 'report-sample' beside the hashes: refused as script-src",
      "script-src with 'nonce-abcdefghijklmnop' beside the hashes: refused as script-src",
      "script-src with data: beside the hashes: refused as script-src",
      "script-src with blob: beside the hashes: refused as script-src",
      "script-src with 'sha384-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' beside the hashes: refused as script-src",
      "script-src with 'sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==' beside the hashes: refused as script-src",
      "script-src with 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' beside the hashes: refused as script-src",
      "script-src with 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' beside the hashes: refused as script-src",
      "script-src with sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= beside the hashes: refused as script-src",
      "script-src with 'SHA256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' beside the hashes: refused as script-src",
      "script-src with 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA-=' beside the hashes: refused as script-src",
      "script-src with the guard hash followed by a letter beside the hashes: refused as script-src",
      "script-src with the guard hash followed by a second quote beside the hashes: refused as script-src",
      "script-src with the guard hash after a letter beside the hashes: refused as script-src",
      "script-src with the guard hash after a second quote beside the hashes: refused as script-src",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6i",
    "guard": "style-src within {'unsafe-inline', data:} (style-src)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "  if (seen.has('style-src') && !is('style-src', ONLY([\"'unsafe-inline'\", 'data:']))) return { ok: false, why: 'style-src' };\n",
        "new": ""
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "10 failed | 129 passed (139)",
    "failing": [
      "every reason is the answer of at least one row below, and every row answers a reason on the list",
      "style-src with 'self': refused as style-src",
      "style-src with *: refused as style-src",
      "style-src with https:: refused as style-src",
      "style-src with blob:: refused as style-src",
      "style-src with 'unsafe-eval': refused as style-src",
      "style-src with 'nonce-abcdefghijklmnop': refused as style-src",
      "style-src with 'sha256-/zwl2lcDvAbUDKBBKy52DGGac6QVMwb00PO2Yr2mXE0=': refused as style-src",
      "style-src with 'none': refused as style-src",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6j",
    "guard": "font-src within {data:} (font-src)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "  if (seen.has('font-src') && !is('font-src', ONLY(['data:']))) return { ok: false, why: 'font-src' };\n",
        "new": ""
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "8 failed | 131 passed (139)",
    "failing": [
      "every reason is the answer of at least one row below, and every row answers a reason on the list",
      "font-src with 'self': refused as font-src",
      "font-src with *: refused as font-src",
      "font-src with https:: refused as font-src",
      "font-src with blob:: refused as font-src",
      "font-src with 'unsafe-inline': refused as font-src",
      "font-src with 'none': refused as font-src",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6k",
    "guard": "img-src within {data:} (img-src; the prototype's imgsrc-drop)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "  if (seen.has('img-src') && !is('img-src', ONLY(['data:']))) return { ok: false, why: 'img-src' };\n",
        "new": ""
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "8 failed | 131 passed (139)",
    "failing": [
      "every reason is the answer of at least one row below, and every row answers a reason on the list",
      "img-src with 'self': refused as img-src",
      "img-src with *: refused as img-src",
      "img-src with https:: refused as img-src",
      "img-src with blob:: refused as img-src",
      "img-src with 'unsafe-inline': refused as img-src",
      "img-src with 'none': refused as img-src",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6l",
    "guard": "base-uri present and 'none' (base-uri)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "  if (!is('base-uri', none)) return { ok: false, why: 'base-uri' };\n",
        "new": ""
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "6 failed | 133 passed (139)",
    "failing": [
      "every reason is the answer of at least one row below, and every row answers a reason on the list",
      "base-uri missing: refused as base-uri",
      "base-uri 'self': refused as base-uri",
      "base-uri 'none' 'self': refused as base-uri",
      "base-uri with no value: refused as base-uri",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6m",
    "guard": "form-action present and 'none' (form-action)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "  if (!is('form-action', none)) return { ok: false, why: 'form-action' };\n",
        "new": ""
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "6 failed | 133 passed (139)",
    "failing": [
      "every reason is the answer of at least one row below, and every row answers a reason on the list",
      "form-action missing: refused as form-action",
      "form-action 'self': refused as form-action",
      "form-action *: refused as form-action",
      "form-action with no value: refused as form-action",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6n",
    "guard": "every required hash present (missing-hash)",
    "file": "src/frame/csp.ts",
    "changes": [
      {
        "old": "  for (const h of requiredHashes) if (!floor.scriptHashes.includes(h)) return { ok: false, why: 'missing-hash' };\n",
        "new": ""
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "6 failed | 133 passed (139)",
    "failing": [
      "every reason is the answer of at least one row below, and every row answers a reason on the list",
      "the guard hash removed while guard is inlined: refused as missing-hash",
      "the bootstrap hash removed while bootstrap is inlined: refused as missing-hash",
      "the enhance hash removed while enhance is inlined: refused as missing-hash",
      "the mermaid hash removed while mermaid is inlined: refused as missing-hash",
      "a required hash this version does not know: refused as missing-hash"
    ],
    "sha256": "96738127967088f83045b46e1fd0b4dfcd9883f0f251af0ed387c4c2a38e4d3f",
    "restored": true
  },
  {
    "id": "L3.M6o",
    "guard": "no hash unknown to this version (unknown-hash; the prototype's unknownhash-drop)",
    "file": "src/frame/csp.ts",
    "changes": [
      {
        "old": "  for (const h of floor.scriptHashes) if (!KNOWN.includes(h)) return { ok: false, why: 'unknown-hash' };\n",
        "new": ""
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "4 failed | 135 passed (139)",
    "failing": [
      "every reason is the answer of at least one row below, and every row answers a reason on the list",
      "an unknown hash of the right form: refused as unknown-hash",
      "the hash of a script that is not an asset: refused as unknown-hash",
      "an unknown hash in place of the Mermaid hash, Mermaid not inlined: refused as unknown-hash"
    ],
    "sha256": "96738127967088f83045b46e1fd0b4dfcd9883f0f251af0ed387c4c2a38e4d3f",
    "restored": true
  },
  {
    "id": "L3.M6p",
    "guard": "script-src refuses 'self' (the mutant accepts it beside the hashes)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "v.every((t) => HASH_SOURCE.test(t))",
        "new": "v.every((t) => HASH_SOURCE.test(t) || t === \"'self'\")"
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "2 failed | 137 passed (139)",
    "failing": [
      "script-src with 'self' beside the hashes: refused as script-src",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6q",
    "guard": "tokenise on ASCII whitespace (the mutant splits a directive on the space alone)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "    const tokens = part.split(/[\\t\\n\\f\\r ]+/).filter((t) => t !== '');",
        "new": "    const tokens = part.split(' ').filter((t) => t !== '');"
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 0,
    "red": "139 passed (139)",
    "failing": [],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6r",
    "guard": "tokenise on ';' as well (the mutant splits the whole policy on the space alone)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "  for (const part of csp.split(';')) {",
        "new": "  for (const part of [csp]) {"
      },
      {
        "old": "    const tokens = part.split(/[\\t\\n\\f\\r ]+/).filter((t) => t !== '');",
        "new": "    const tokens = part.split(' ').filter((t) => t !== '');"
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "103 failed | 36 passed (139)",
    "failing": [
      "every reason is the answer of at least one row below, and every row answers a reason on the list",
      "an added connect-src *: refused as directive",
      "an added connect-src 'none': refused as directive",
      "an added frame-src 'none': refused as directive",
      "an added child-src 'none': refused as directive",
      "an added worker-src 'none': refused as directive",
      "an added object-src 'none': refused as directive",
      "an added manifest-src 'none': refused as directive",
      "an added media-src 'none': refused as directive",
      "an added frame-ancestors 'none': refused as directive",
      "an added script-src-elem 'none': refused as directive",
      "an added script-src-attr 'none': refused as directive",
      "an added style-src-elem 'none': refused as directive",
      "an added report-uri /r: refused as directive",
      "an added report-to r: refused as directive",
      "an added sandbox allow-scripts: refused as directive",
      "an added upgrade-insecure-requests: refused as directive",
      "an added require-trusted-types-for 'script': refused as directive",
      "an added trusted-types none: refused as directive",
      "an added webrtc 'block': refused as directive",
      "img-src twice, both valid: refused as duplicate",
      "a first script-src of 'unsafe-inline', then the valid one: refused as duplicate",
      "a first default-src '*', then the valid one: refused as duplicate",
      "default-src with no value: refused as default-src",
      "script-src missing: refused as script-src",
      "script-src with no source: refused as script-src",
      "script-src with 'self' beside the hashes: refused as script-src",
      "script-src with 'none' beside the hashes: refused as script-src",
      "script-src with * beside the hashes: refused as script-src",
      "script-src with https: beside the hashes: refused as script-src",
      "script-src with https://docreader.test beside the hashes: refused as script-src",
      "script-src with docreader.test beside the hashes: refused as script-src",
      "script-src with 'unsafe-inline' beside the hashes: refused as script-src",
      "script-src with 'unsafe-eval' beside the hashes: refused as script-src",
      "script-src with 'unsafe-hashes' beside the hashes: refused as script-src",
      "script-src with 'wasm-unsafe-eval' beside the hashes: refused as script-src",
      "script-src with 'strict-dynamic' beside the hashes: refused as script-src",
      "script-src with 'report-sample' beside the hashes: refused as script-src",
      "script-src with 'nonce-abcdefghijklmnop' beside the hashes: refused as script-src",
      "script-src with data: beside the hashes: refused as script-src",
      "script-src with blob: beside the hashes: refused as script-src",
      "script-src with 'sha384-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' beside the hashes: refused as script-src",
      "script-src with 'sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==' beside the hashes: refused as script-src",
      "script-src with 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' beside the hashes: refused as script-src",
      "script-src with 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' beside the hashes: refused as script-src",
      "script-src with sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= beside the hashes: refused as script-src",
      "script-src with 'SHA256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' beside the hashes: refused as script-src",
      "script-src with 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA-=' beside the hashes: refused as script-src",
      "script-src with the guard hash followed by a letter beside the hashes: refused as script-src",
      "script-src with the guard hash followed by a second quote beside the hashes: refused as script-src",
      "script-src with the guard hash after a letter beside the hashes: refused as script-src",
      "script-src with the guard hash after a second quote beside the hashes: refused as script-src",
      "style-src with 'self': refused as style-src",
      "style-src with *: refused as style-src",
      "style-src with https:: refused as style-src",
      "style-src with blob:: refused as style-src",
      "style-src with 'unsafe-eval': refused as style-src",
      "style-src with 'nonce-abcdefghijklmnop': refused as style-src",
      "style-src with 'sha256-/zwl2lcDvAbUDKBBKy52DGGac6QVMwb00PO2Yr2mXE0=': refused as style-src",
      "style-src with 'none': refused as style-src",
      "font-src with 'self': refused as font-src",
      "font-src with *: refused as font-src",
      "font-src with https:: refused as font-src",
      "font-src with blob:: refused as font-src",
      "font-src with 'unsafe-inline': refused as font-src",
      "font-src with 'none': refused as font-src",
      "img-src with 'self': refused as img-src",
      "img-src with *: refused as img-src",
      "img-src with https:: refused as img-src",
      "img-src with blob:: refused as img-src",
      "img-src with 'unsafe-inline': refused as img-src",
      "img-src with 'none': refused as img-src",
      "base-uri missing: refused as base-uri",
      "base-uri 'self': refused as base-uri",
      "base-uri 'none' 'self': refused as base-uri",
      "base-uri with no value: refused as base-uri",
      "form-action missing: refused as form-action",
      "form-action 'self': refused as form-action",
      "form-action *: refused as form-action",
      "form-action with no value: refused as form-action",
      "the guard hash removed while guard is inlined: refused as missing-hash",
      "the bootstrap hash removed while bootstrap is inlined: refused as missing-hash",
      "the enhance hash removed while enhance is inlined: refused as missing-hash",
      "the mermaid hash removed while mermaid is inlined: refused as missing-hash",
      "a required hash this version does not know: refused as missing-hash",
      "an unknown hash of the right form: refused as unknown-hash",
      "the hash of a script that is not an asset: refused as unknown-hash",
      "an unknown hash in place of the Mermaid hash, Mermaid not inlined: refused as unknown-hash",
      "frameCsp(), every hash required: accepted",
      "frameCsp(), Mermaid not inlined: accepted",
      "frameCsp(), nothing required: accepted",
      "frameCsp() without the Mermaid hash, Mermaid not inlined: accepted",
      "exactly 4096 characters (the bound is inclusive): accepted",
      "the directives in reverse order: accepted",
      "style-src, font-src and img-src omitted (default-src applies, which only tightens): accepted",
      "style-src, font-src and img-src narrowed: accepted",
      "a hash repeated in script-src: accepted",
      "runs of spaces, a trailing semicolon and empty directives: accepted",
      "answers the script-src hashes of frameCsp() in order",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason",
      "accepts an unknown hash of the right form: the hash set is not the floor's (the bootstrap bundles no manifest)",
      "no file that reads a policy writes a semicolon but csp-rules.ts, once (the floor's split; frameCsp, the writer, aside)",
      "the source tree splits on a semicolon in src/frame/csp-rules.ts alone, once"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6s",
    "guard": "script-src holds at least one source",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "(v) => v.length > 0 && v.every((t) => HASH_SOURCE.test(t))",
        "new": "(v) => v.every((t) => HASH_SOURCE.test(t))"
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "2 failed | 137 passed (139)",
    "failing": [
      "script-src with no source: refused as script-src",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6t",
    "guard": "a hash source is SHA-256 of 43 base64 characters and one '=' (the mutant admits sha384 and sha512)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "export const HASH_SOURCE = /^'sha256-[A-Za-z0-9+/]{43}='$/;",
        "new": "export const HASH_SOURCE = /^'sha(256|384|512)-[A-Za-z0-9+/]+={0,2}'$/;"
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "5 failed | 134 passed (139)",
    "failing": [
      "script-src with 'sha384-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' beside the hashes: refused as script-src",
      "script-src with 'sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==' beside the hashes: refused as script-src",
      "script-src with 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' beside the hashes: refused as script-src",
      "script-src with 'sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' beside the hashes: refused as script-src",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6u",
    "guard": "'none' alone (the mutant accepts 'none' followed by other sources)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "  const none = (v: readonly string[]): boolean => v.length === 1 && v[0] === \"'none'\";",
        "new": "  const none = (v: readonly string[]): boolean => v[0] === \"'none'\";"
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "4 failed | 135 passed (139)",
    "failing": [
      "every reason is the answer of at least one row below, and every row answers a reason on the list",
      "default-src 'none' 'self': refused as default-src",
      "base-uri 'none' 'self': refused as base-uri",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6v",
    "guard": "a hash source is anchored at its start (the mutant drops the ^ of HASH_SOURCE)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "export const HASH_SOURCE = /^'sha256-[A-Za-z0-9+/]{43}='$/;",
        "new": "export const HASH_SOURCE = /'sha256-[A-Za-z0-9+/]{43}='$/;"
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "3 failed | 136 passed (139)",
    "failing": [
      "script-src with the guard hash after a letter beside the hashes: refused as script-src",
      "script-src with the guard hash after a second quote beside the hashes: refused as script-src",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.M6w",
    "guard": "a hash source is anchored at its end (the mutant drops the $ of HASH_SOURCE)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "export const HASH_SOURCE = /^'sha256-[A-Za-z0-9+/]{43}='$/;",
        "new": "export const HASH_SOURCE = /^'sha256-[A-Za-z0-9+/]{43}='/;"
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "3 failed | 136 passed (139)",
    "failing": [
      "script-src with the guard hash followed by a letter beside the hashes: refused as script-src",
      "script-src with the guard hash followed by a second quote beside the hashes: refused as script-src",
      "agrees with checkFrameCsp on every floor row, and never answers a hash reason"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  }
]
```

## SHA-256, its memo, the one tokeniser, the closed list, ruling R6 (L3.T2a to L3.T2l)

The plan names two SHA-256 rows ("drop the final block padding", "skip the memo bound"); the padding has two parts, the
`0x80` byte (L3.T2a) and the extra block when the length does not fit after the message (L3.T2b), and each is a row. The
other rows guard what the task adds besides: UTF-8 of a lone surrogate (L3.T2d), the no-host-crypto wall (L3.T2e),
`cspFloor` as the only tokeniser (L3.T2f, L3.T2i to L3.T2k), the closed refusal list (L3.T2g), the memo's
first-in first-out order (L3.T2h) and ruling R6 over Task 2's files (L3.T2l).

- L3.T2c is observed through identity: a memo hit answers the very array it stored, so with the bound skipped the
  oldest of nine strings answers its first array again, where the bounded memo hashes it afresh.
- L3.T2e imports `node:crypto` into `src/frame/sha256.ts`. It is red three ways: the bundle for a platform with no host
  modules does not build (so the empty-realm rows fail their "the bundle built and ran" assertion), the import scan
  finds a specifier outside the frame, and the identifier scan finds `createHash`.
- L3.T2f reads the policy a second time in `checkFrameCsp` (`csp.split(';')`): the source scan finds a second
  semicolon split and the use of the policy parameter outside `cspFloor`; the rows for a policy that is not a string go
  red as well, because the second read runs before the floor's type rule.
- L3.T2h refreshes a string on a memo hit (least recently used). Before the review's fix round it was green: the
  row hit the oldest string while it was the only one held. The row now hits the oldest while seven newer are held, so
  the mutant evicts the second string on the ninth, and the row reads the second first.
- L3.T2i to L3.T2k add a second tokeniser to `src/frame/csp.ts` outside `checkFrameCsp`, in the three forms the review
  named: a `match(/[^;]+/g)`, a `split` on a named constant `';'`, and an `indexOf(';')`. Before the fix round all three
  were green (the scan saw only a `split` over a literal). The scan now refuses any literal holding `;` in a file that
  reads a policy (it imports `cspFloor`, `checkFrameCsp` or `frameCsp`), the floor's split and `frameCsp`, the writer,
  aside; and every read of a meta's `content` attribute under `src/` must go straight to `cspFloor`. The bootstrap is
  Task 5's file, so no row mutates it; a control row runs each scan over a written source holding every form, a
  content read that bypasses `cspFloor` among them.
- L3.T2l writes a raw U+00E9 into a string of `src/frame/sha256.ts`: the R6 scan, which reads Task 2's five files whole
  as `test/host-parse.test.ts` reads the host's, names it.

| Row | Guard | File | Change | Red | Restore |
|---|---|---|---|---|---|
| L3.T2a | SHA-256's final block padding: the 0x80 byte after the message | `src/frame/sha256.ts` | `m[len] = 0x80; ⏎` removed | `test/frame-sha256.test.ts`: 31 failed \| 17 passed (48). "the empty string: the published digest, and node:crypto's"; ""abc" (one block): the published digest, and node:crypto's"; "the 448-bit message (56 bytes: the length moves to a second block): the published digest, and node:crypto's"; "the 896-bit message: the published digest, and node:crypto's"; "one million "a": the published digest, and node:crypto's" | sha256 `ec3980672636…` restored, equal |
| L3.T2b | SHA-256's final block padding: an extra block when the length does not fit after the message | `src/frame/sha256.ts` | `const blocks = Math.ceil((len + 9) / 64);` → `const blocks = Math.ceil((len + 1) / 64);` | `test/frame-sha256.test.ts`: 6 failed \| 42 passed (48). "the 448-bit message (56 bytes: the length moves to a second block): the published digest, and node:crypto's"; "every length from 0 to 200 bytes (each padding boundary: 55, 56, 63, 64, 119, 120, 127, 128)"; "every byte length from 50 to 70 reached by three-byte characters, and sha256Bytes over raw bytes 0 to 255"; "guard: the pure digest equals node:crypto's over the same text, and the build's"; "the fonts under assets/fonts: sha256Bytes over the file equals node:crypto" | sha256 `ec3980672636…` restored, equal |
| L3.T2c | the memo holds at most 8 strings (the mutant skips the bound) | `src/frame/sha256.ts` | `if (memo.size >= MEMO_MAX) { ⏎     const first = memo.keys().next(); ⏎     if (first.done !== true) memo.delete(first.value); ⏎   } ⏎` removed | `test/frame-sha256.test.ts`: 2 failed \| 46 passed (48). "a ninth string evicts the oldest: the other eight are still held, the oldest is hashed again to equal bytes"; "a memo hit does not refresh a string: the oldest is hit while seven newer are held, and a ninth still evicts it, not the second" | sha256 `ec3980672636…` restored, equal |
| L3.T2d | a lone low surrogate is U+FFFD's bytes | `src/frame/sha256.ts` | `} else if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd;` → `}` | `test/frame-sha256.test.ts`: 8 failed \| 40 passed (48). "a lone high surrogate: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives"; "a lone low surrogate: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives"; "a high surrogate at the end: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives"; "a low surrogate first: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives"; "a reversed pair: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives" | sha256 `ec3980672636…` restored, equal |
| L3.T2e | no host crypto in the pure files (the mutant imports node:crypto into sha256.ts) | `src/frame/sha256.ts` | `const K = new Uint32Array([` → `import { createHash } from 'node:crypto'; ⏎ export const nodeHash = createHash; ⏎  ⏎ const K = new Uint32Array([` | `test/frame-sha256.test.ts`: 6 failed \| 42 passed (48). "the three files bundle for a platform with no host modules"; "the realm has no host API: no crypto, TextEncoder, Buffer, process or require"; "the NIST vectors and every Unicode case give node:crypto's digest there"; "frameCsp() is the same string there, and checkFrameCsp gives the same verdicts"; "src/frame/sha256.ts: imports only frame files, and names none of crypto, subtle, webcrypto, createHash, require, Buffer, TextEncoder, process, globalThis, window, self" | sha256 `ec3980672636…` restored, equal |
| L3.T2f | cspFloor is the only tokeniser (the mutant reads the policy a second time in checkFrameCsp) | `src/frame/csp.ts` | `const floor = cspFloor(csp); ⏎` → `if (csp.split(';').length > 64) return { ok: false, why: 'length' }; ⏎   const floor = cspFloor(csp); ⏎` | `test/frame-csp.test.ts`: 8 failed \| 131 passed (139). "every reason is the answer of at least one row below, and every row answers a reason on the list"; "a number: refused as type"; "an array holding the policy: refused as type"; "null: refused as type"; "undefined: refused as type" | sha256 `967381279670…` restored, equal |
| L3.T2g | the refusal list is closed (the mutant adds a reason no rule gives) | `src/frame/csp-rules.ts` | `'unknown-hash', ⏎ ] as const);` → `'unknown-hash', ⏎   'connect-src', ⏎ ] as const);` | `test/frame-csp.test.ts`: 2 failed \| 137 passed (139). "is exactly the rules of Reference §10, once each, in the order they are checked, and frozen"; "every reason is the answer of at least one row below, and every row answers a reason on the list" | sha256 `2102921cd426…` restored, equal |
| L3.T2h | a memo hit does not refresh a string: the memo evicts the oldest inserted, not the least recently used (the mutant refreshes on a hit) | `src/frame/sha256.ts` | `if (hit !== undefined) return hit; ⏎` → `if (hit !== undefined) { ⏎     memo.delete(text); ⏎     memo.set(text, hit); ⏎     return hit; ⏎   } ⏎` | `test/frame-sha256.test.ts`: 1 failed \| 47 passed (48). "a memo hit does not refresh a string: the oldest is hit while seven newer are held, and a ninth still evicts it, not the second" | sha256 `ec3980672636…` restored, equal |
| L3.T2i | cspFloor is the only tokeniser (the mutant adds a second one in csp.ts, a match over a regular expression) | `src/frame/csp.ts` | `export function frameCsp(): string {` → `/** The directives of a policy, one string each. */ ⏎ export function policyDirectives(policy: string): string[] { ⏎   return policy.match(/[^;]+/g) ?? []; ⏎ } ⏎  ⏎ export function frameCsp(): string {` | `test/frame-csp.test.ts`: 1 failed \| 138 passed (139). "no file that reads a policy writes a semicolon but csp-rules.ts, once (the floor's split; frameCsp, the writer, aside)" | sha256 `967381279670…` restored, equal |
| L3.T2j | cspFloor is the only tokeniser (the mutant adds a second one in csp.ts, a split on a named constant) | `src/frame/csp.ts` | `export function frameCsp(): string {` → `const SEMI = ';'; ⏎  ⏎ /** The directives of a policy, one string each. */ ⏎ export function policyDirectives(policy: string): string[] { ⏎   return policy.split(SEMI); ⏎ } ⏎  ⏎ export function frameCsp(): string {` | `test/frame-csp.test.ts`: 1 failed \| 138 passed (139). "no file that reads a policy writes a semicolon but csp-rules.ts, once (the floor's split; frameCsp, the writer, aside)" | sha256 `967381279670…` restored, equal |
| L3.T2k | cspFloor is the only tokeniser (the mutant adds a second one in csp.ts, an indexOf loop) | `src/frame/csp.ts` | `export function frameCsp(): string {` → `/** The first directive of a policy. */ ⏎ export function firstDirective(policy: string): string { ⏎   const at = policy.indexOf(';'); ⏎   return at < 0 ? policy : policy.slice(0, at); ⏎ } ⏎  ⏎ export function frameCsp(): string {` | `test/frame-csp.test.ts`: 1 failed \| 138 passed (139). "no file that reads a policy writes a semicolon but csp-rules.ts, once (the floor's split; frameCsp, the writer, aside)" | sha256 `967381279670…` restored, equal |
| L3.T2l | ruling R6: Task 2's files hold no raw non-ASCII character (the mutant writes a raw U+00E9 into a string of sha256.ts) | `src/frame/sha256.ts` | `return `'sha256-${base64(sha256Text(text))}'`; ⏎` → `if (text === 'caf<U+00E9>') return ''; ⏎   return `'sha256-${base64(sha256Text(text))}'`; ⏎` | `test/frame-sha256.test.ts`: 1 failed \| 47 passed (48). "src/frame/sha256.ts" | sha256 `ec3980672636…` restored, equal |

```json
[
  {
    "id": "L3.T2a",
    "guard": "SHA-256's final block padding: the 0x80 byte after the message",
    "file": "src/frame/sha256.ts",
    "changes": [
      {
        "old": "  m[len] = 0x80;\n",
        "new": ""
      }
    ],
    "tests": "test/frame-sha256.test.ts",
    "rc": 1,
    "red": "31 failed | 17 passed (48)",
    "failing": [
      "the empty string: the published digest, and node:crypto's",
      "\"abc\" (one block): the published digest, and node:crypto's",
      "the 448-bit message (56 bytes: the length moves to a second block): the published digest, and node:crypto's",
      "the 896-bit message: the published digest, and node:crypto's",
      "one million \"a\": the published digest, and node:crypto's",
      "every length from 0 to 200 bytes (each padding boundary: 55, 56, 63, 64, 119, 120, 127, 128)",
      "every byte length from 50 to 70 reached by three-byte characters, and sha256Bytes over raw bytes 0 to 255",
      "U+007F and U+0080 (one byte, then two): UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "U+07FF and U+0800 (two bytes, then three): UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "U+FFFF (three bytes): UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "an astral letter (four bytes): UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "an astral emoji between ASCII: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "U+10FFFF: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "a lone high surrogate: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "a lone low surrogate: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "U+FFFD itself: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "a high surrogate at the end: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "a low surrogate first: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "a reversed pair: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "two high surrogates: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "a high surrogate, then a valid pair: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "NUL: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "cspHash is 'sha256-' and the digest in base64, quoted",
      "guard: the pure digest equals node:crypto's over the same text, and the build's",
      "bootstrap: the pure digest equals node:crypto's over the same text, and the build's",
      "enhance: the pure digest equals node:crypto's over the same text, and the build's",
      "css: the pure digest equals node:crypto's over the same text, and the build's",
      "mermaid: the pure digest equals node:crypto's over the same text, and the build's",
      "the fonts under assets/fonts: sha256Bytes over the file equals node:crypto",
      "a ninth string evicts the oldest: the other eight are still held, the oldest is hashed again to equal bytes",
      "the NIST vectors and every Unicode case give node:crypto's digest there"
    ],
    "sha256": "ec398067263614ca6af1fe01bbef4e16b0c056df3ca9f34819d9e21de14b3915",
    "restored": true
  },
  {
    "id": "L3.T2b",
    "guard": "SHA-256's final block padding: an extra block when the length does not fit after the message",
    "file": "src/frame/sha256.ts",
    "changes": [
      {
        "old": "  const blocks = Math.ceil((len + 9) / 64);",
        "new": "  const blocks = Math.ceil((len + 1) / 64);"
      }
    ],
    "tests": "test/frame-sha256.test.ts",
    "rc": 1,
    "red": "6 failed | 42 passed (48)",
    "failing": [
      "the 448-bit message (56 bytes: the length moves to a second block): the published digest, and node:crypto's",
      "every length from 0 to 200 bytes (each padding boundary: 55, 56, 63, 64, 119, 120, 127, 128)",
      "every byte length from 50 to 70 reached by three-byte characters, and sha256Bytes over raw bytes 0 to 255",
      "guard: the pure digest equals node:crypto's over the same text, and the build's",
      "the fonts under assets/fonts: sha256Bytes over the file equals node:crypto",
      "the NIST vectors and every Unicode case give node:crypto's digest there"
    ],
    "sha256": "ec398067263614ca6af1fe01bbef4e16b0c056df3ca9f34819d9e21de14b3915",
    "restored": true
  },
  {
    "id": "L3.T2c",
    "guard": "the memo holds at most 8 strings (the mutant skips the bound)",
    "file": "src/frame/sha256.ts",
    "changes": [
      {
        "old": "  if (memo.size >= MEMO_MAX) {\n    const first = memo.keys().next();\n    if (first.done !== true) memo.delete(first.value);\n  }\n",
        "new": ""
      }
    ],
    "tests": "test/frame-sha256.test.ts",
    "rc": 1,
    "red": "2 failed | 46 passed (48)",
    "failing": [
      "a ninth string evicts the oldest: the other eight are still held, the oldest is hashed again to equal bytes",
      "a memo hit does not refresh a string: the oldest is hit while seven newer are held, and a ninth still evicts it, not the second"
    ],
    "sha256": "ec398067263614ca6af1fe01bbef4e16b0c056df3ca9f34819d9e21de14b3915",
    "restored": true
  },
  {
    "id": "L3.T2d",
    "guard": "a lone low surrogate is U+FFFD's bytes",
    "file": "src/frame/sha256.ts",
    "changes": [
      {
        "old": "    } else if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd;",
        "new": "    }"
      }
    ],
    "tests": "test/frame-sha256.test.ts",
    "rc": 1,
    "red": "8 failed | 40 passed (48)",
    "failing": [
      "a lone high surrogate: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "a lone low surrogate: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "a high surrogate at the end: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "a low surrogate first: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "a reversed pair: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "two high surrogates: UTF-8 as TextEncoder and Buffer write it, and the digest node:crypto gives",
      "a lone surrogate hashes as U+FFFD's three bytes",
      "the NIST vectors and every Unicode case give node:crypto's digest there"
    ],
    "sha256": "ec398067263614ca6af1fe01bbef4e16b0c056df3ca9f34819d9e21de14b3915",
    "restored": true
  },
  {
    "id": "L3.T2e",
    "guard": "no host crypto in the pure files (the mutant imports node:crypto into sha256.ts)",
    "file": "src/frame/sha256.ts",
    "changes": [
      {
        "old": "const K = new Uint32Array([",
        "new": "import { createHash } from 'node:crypto';\nexport const nodeHash = createHash;\n\nconst K = new Uint32Array(["
      }
    ],
    "tests": "test/frame-sha256.test.ts",
    "rc": 1,
    "red": "6 failed | 42 passed (48)",
    "failing": [
      "the three files bundle for a platform with no host modules",
      "the realm has no host API: no crypto, TextEncoder, Buffer, process or require",
      "the NIST vectors and every Unicode case give node:crypto's digest there",
      "frameCsp() is the same string there, and checkFrameCsp gives the same verdicts",
      "src/frame/sha256.ts: imports only frame files, and names none of crypto, subtle, webcrypto, createHash, require, Buffer, TextEncoder, process, globalThis, window, self",
      "src/frame/sha256.ts imports nothing at all"
    ],
    "sha256": "ec398067263614ca6af1fe01bbef4e16b0c056df3ca9f34819d9e21de14b3915",
    "restored": true
  },
  {
    "id": "L3.T2f",
    "guard": "cspFloor is the only tokeniser (the mutant reads the policy a second time in checkFrameCsp)",
    "file": "src/frame/csp.ts",
    "changes": [
      {
        "old": "  const floor = cspFloor(csp);\n",
        "new": "  if (csp.split(';').length > 64) return { ok: false, why: 'length' };\n  const floor = cspFloor(csp);\n"
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "8 failed | 131 passed (139)",
    "failing": [
      "every reason is the answer of at least one row below, and every row answers a reason on the list",
      "a number: refused as type",
      "an array holding the policy: refused as type",
      "null: refused as type",
      "undefined: refused as type",
      "no file that reads a policy writes a semicolon but csp-rules.ts, once (the floor's split; frameCsp, the writer, aside)",
      "the source tree splits on a semicolon in src/frame/csp-rules.ts alone, once",
      "src/frame/csp.ts reads checkFrameCsp's policy only through cspFloor"
    ],
    "sha256": "96738127967088f83045b46e1fd0b4dfcd9883f0f251af0ed387c4c2a38e4d3f",
    "restored": true
  },
  {
    "id": "L3.T2g",
    "guard": "the refusal list is closed (the mutant adds a reason no rule gives)",
    "file": "src/frame/csp-rules.ts",
    "changes": [
      {
        "old": "  'unknown-hash',\n] as const);",
        "new": "  'unknown-hash',\n  'connect-src',\n] as const);"
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "2 failed | 137 passed (139)",
    "failing": [
      "is exactly the rules of Reference \u00a710, once each, in the order they are checked, and frozen",
      "every reason is the answer of at least one row below, and every row answers a reason on the list"
    ],
    "sha256": "2102921cd426923f22aae6e6c339e12e7c51e9fac943c84e9be9661f656c2226",
    "restored": true
  },
  {
    "id": "L3.T2h",
    "guard": "a memo hit does not refresh a string: the memo evicts the oldest inserted, not the least recently used (the mutant refreshes on a hit)",
    "file": "src/frame/sha256.ts",
    "changes": [
      {
        "old": "  if (hit !== undefined) return hit;\n",
        "new": "  if (hit !== undefined) {\n    memo.delete(text);\n    memo.set(text, hit);\n    return hit;\n  }\n"
      }
    ],
    "tests": "test/frame-sha256.test.ts",
    "rc": 1,
    "red": "1 failed | 47 passed (48)",
    "failing": [
      "a memo hit does not refresh a string: the oldest is hit while seven newer are held, and a ninth still evicts it, not the second"
    ],
    "sha256": "ec398067263614ca6af1fe01bbef4e16b0c056df3ca9f34819d9e21de14b3915",
    "restored": true
  },
  {
    "id": "L3.T2i",
    "guard": "cspFloor is the only tokeniser (the mutant adds a second one in csp.ts, a match over a regular expression)",
    "file": "src/frame/csp.ts",
    "changes": [
      {
        "old": "export function frameCsp(): string {",
        "new": "/** The directives of a policy, one string each. */\nexport function policyDirectives(policy: string): string[] {\n  return policy.match(/[^;]+/g) ?? [];\n}\n\nexport function frameCsp(): string {"
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "1 failed | 138 passed (139)",
    "failing": [
      "no file that reads a policy writes a semicolon but csp-rules.ts, once (the floor's split; frameCsp, the writer, aside)"
    ],
    "sha256": "96738127967088f83045b46e1fd0b4dfcd9883f0f251af0ed387c4c2a38e4d3f",
    "restored": true
  },
  {
    "id": "L3.T2j",
    "guard": "cspFloor is the only tokeniser (the mutant adds a second one in csp.ts, a split on a named constant)",
    "file": "src/frame/csp.ts",
    "changes": [
      {
        "old": "export function frameCsp(): string {",
        "new": "const SEMI = ';';\n\n/** The directives of a policy, one string each. */\nexport function policyDirectives(policy: string): string[] {\n  return policy.split(SEMI);\n}\n\nexport function frameCsp(): string {"
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "1 failed | 138 passed (139)",
    "failing": [
      "no file that reads a policy writes a semicolon but csp-rules.ts, once (the floor's split; frameCsp, the writer, aside)"
    ],
    "sha256": "96738127967088f83045b46e1fd0b4dfcd9883f0f251af0ed387c4c2a38e4d3f",
    "restored": true
  },
  {
    "id": "L3.T2k",
    "guard": "cspFloor is the only tokeniser (the mutant adds a second one in csp.ts, an indexOf loop)",
    "file": "src/frame/csp.ts",
    "changes": [
      {
        "old": "export function frameCsp(): string {",
        "new": "/** The first directive of a policy. */\nexport function firstDirective(policy: string): string {\n  const at = policy.indexOf(';');\n  return at < 0 ? policy : policy.slice(0, at);\n}\n\nexport function frameCsp(): string {"
      }
    ],
    "tests": "test/frame-csp.test.ts",
    "rc": 1,
    "red": "1 failed | 138 passed (139)",
    "failing": [
      "no file that reads a policy writes a semicolon but csp-rules.ts, once (the floor's split; frameCsp, the writer, aside)"
    ],
    "sha256": "96738127967088f83045b46e1fd0b4dfcd9883f0f251af0ed387c4c2a38e4d3f",
    "restored": true
  },
  {
    "id": "L3.T2l",
    "guard": "ruling R6: Task 2's files hold no raw non-ASCII character (the mutant writes a raw U+00E9 into a string of sha256.ts)",
    "file": "src/frame/sha256.ts",
    "changes": [
      {
        "old": "  return `'sha256-${base64(sha256Text(text))}'`;\n",
        "new": "  if (text === 'caf\u00e9') return '';\n  return `'sha256-${base64(sha256Text(text))}'`;\n"
      }
    ],
    "tests": "test/frame-sha256.test.ts",
    "rc": 1,
    "red": "1 failed | 47 passed (48)",
    "failing": [
      "src/frame/sha256.ts"
    ],
    "sha256": "ec398067263614ca6af1fe01bbef4e16b0c056df3ca9f34819d9e21de14b3915",
    "restored": true
  }
]
```
