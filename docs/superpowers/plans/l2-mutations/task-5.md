# L2 Task 5: mutation rows (options and host adapters)

Each guard of Task 5 (`src/enhance/options.ts`, `host.ts`, its wiring in `lifecycle.ts`, the `lens` pref in `state.ts`, and
the README pins), deleted or inverted once, with the tests that go red. Measured 2026-10-20 on branch `l2-t5-options`,
against the tree of its code commit, `enhance: options and host adapters (docserver L2 T5)`.

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8), unchanged: each row is applied to its own throwaway copy of
the working tree (tracked and untracked files, never ignored ones, `node_modules` linked from the checkout), its test file
runs there with the local `vitest`, and the copy is deleted. Each `old` occurs exactly once in its file; rows that share
an `old` were applied to separate copies. The checkout was never edited: `git status --porcelain` read the same before
and after. All 98 rows went red (`rc=1`). The Red column gives the count line and the failing tests the run printed
(at most five here; the run prints at most 20 failing lines).

The box was heavily loaded while these were measured, and its memory pressure killed some runs part way (`rc=137`, a
signal, not a test result). Every row was then measured again, on the final tree, in chunks of eight, and the table
records that complete run. One earlier run of L2-T5-M39 was killed while printing a failed comparison of a 1 MB string;
the test now compares the length first.

Two rows are paired on purpose. L2-T5-M58 replaces the own-name list with a `for...in` list: the inherited-property case
stays green, because the descriptor read is own as well, and only the non-enumerable case goes red. L2-T5-M98 removes
both layers (names and descriptors through the prototype) and reddens the inherited case.

## Options: `src/enhance/options.ts`

Reading, checking and bounding every option, and keeping the host functions apart.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T5-M1 | posKey: a non-empty string | `src/enhance/options.ts` | `if (posKey !== undefined && (typeof posKey !== 'string' \|\| posKey === '')) throw invalid('posKey must be a no…` → (deleted) | `test/enhance-options.test.ts`: 4 failed \| 129 passed (133). "posKey empty"; "posKey a number"; "posKey null"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M2 | posKey: defaults to storageKey | `src/enhance/options.ts` | `posKey: posKey ?? storageKey ?? null,` → `posKey: posKey ?? null,` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "posKey defaults to storageKey; without either it is null" |
| L2-T5-M3 | a boolean option is a boolean (keyboard, rules, chrome fields) | `src/enhance/options.ts` | `` if (typeof v !== 'boolean') throw invalid(`${where} must be a boolean`); `` → (deleted) | `test/enhance-options.test.ts`: 7 failed \| 126 passed (133). "keyboard a string"; "keyboard null"; "rules a string"; "chrome.bar a string"; "chrome.rail a number"; and 2 more |
| L2-T5-M4 | keyboard: default true | `src/enhance/options.ts` | `keyboard: flag('keyboard', fields['keyboard'], true),` → `keyboard: flag('keyboard', fields['keyboard'], false),` | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "the defaults, with no options at all and with an empty object"; "inherited properties are not options: not read, not refused" |
| L2-T5-M5 | rules: default false | `src/enhance/options.ts` | `rules: flag('rules', fields['rules'], false),` → `rules: flag('rules', fields['rules'], true),` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "the defaults, with no options at all and with an empty object" |
| L2-T5-M6 | chrome: left out, every part on | `src/enhance/options.ts` | `if (v === undefined) return Object.freeze({ bar: true, rail: true, settings: true });` → `if (v === undefined) return Object.freeze({ bar: true, rail: false, settings: true });` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "the defaults, with no options at all and with an empty object" |
| L2-T5-M7 | chrome: each field defaults to true | `src/enhance/options.ts` | `flag('chrome.bar', bar, true)` → `flag('chrome.bar', bar, false)` | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "chrome fields default to true one by one; a mermaid object without limits leaves them to the library"; "inherited properties are not options: not read, not refused" |
| L2-T5-M8 | chrome: an object | `src/enhance/options.ts` | `if (!isRecord(v)) throw invalid('chrome must be an object');` → (deleted) | `test/enhance-options.test.ts`: 3 failed \| 130 passed (133). "chrome a boolean"; "chrome null"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M9 | chrome: own data fields (unknown keys and getters refused, inherited ignored) | `src/enhance/options.ts` | `const { bar, rail, settings } = ownFields('chrome', v, CHROME_KEYS);` → `const { bar, rail, settings } = { bar: v['bar'], rail: v['rail'], settings: v['settings'] };` | `test/enhance-options.test.ts`: 3 failed \| 130 passed (133). "a getter on chrome.bar"; "unknown keys are refused, at the top, in chrome, in mermaid and in info; a commit entry may carry more"; "inherited properties are not options: not read, not refused" |
| L2-T5-M10 | chrome: frozen | `src/enhance/options.ts` | `return Object.freeze({ bar: flag('chrome.bar', bar, true),` → `return ({ bar: flag('chrome.bar', bar, true),` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "what features read is frozen: chrome, the mermaid limits and keys, commits and their entries" |
| L2-T5-M11 | a function option is a function | `src/enhance/options.ts` | `` if (typeof v !== 'function') throw invalid(`${where} must be a function`); `` → (deleted) | `test/enhance-options.test.ts`: 20 failed \| 113 passed (133). "onLink a string"; "onLink null"; "onLink an object"; "onHash a string"; "onHash null"; and 15 more |
| L2-T5-M12 | a function option is never touched while read | `src/enhance/options.ts` | `return Object.freeze({ fn: v as (...args: never[]) => unknown, self });` → `return Object.freeze({ fn: (v as (...args: never[]) => unknown).bind(self), self });` | `test/enhance-options.test.ts`: 3 failed \| 130 passed (133). "each option given, each normalized"; "a non-enumerable own option is still read"; "neither normalizeOptions nor the whole startup touches a function option, mermaid.load included" |
| L2-T5-M13 | a function option keeps its receiver | `src/enhance/options.ts` | `return Object.freeze({ fn: v as (...args: never[]) => unknown, self });` → `return Object.freeze({ fn: v as (...args: never[]) => unknown, self: {} });` | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "each option given, each normalized"; "a callback is called as a method of the options object" |
| L2-T5-M14 | a bound callback is frozen | `src/enhance/options.ts` | `return Object.freeze({ fn: v as (...args: never[]) => unknown, self });` → `return ({ fn: v as (...args: never[]) => unknown, self });` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "what features read is frozen: chrome, the mermaid limits and keys, commits and their entries" |
| L2-T5-M15 | the callbacks record is frozen | `src/enhance/options.ts` | `const callbacks: HostCallbacks = Object.freeze({` → `const callbacks: HostCallbacks = ({` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "what features read is frozen: chrome, the mermaid limits and keys, commits and their entries" |
| L2-T5-M16 | initialHash: a string or null | `src/enhance/options.ts` | `if (typeof v !== 'string') throw invalid('initialHash must be a string or null');` → (deleted) | `test/enhance-options.test.ts`: 3 failed \| 130 passed (133). "initialHash a number"; "initialHash an object"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M17 | initialHash: empty is none | `src/enhance/options.ts` | `if (v === undefined \|\| v === null \|\| v === '') return null;` → `if (v === undefined \|\| v === null) return null;` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "initialHash: an id; empty is no hash, and one over 1024 code units is ignored, not cut" |
| L2-T5-M18 | initialHash: over 1024 code units is ignored | `src/enhance/options.ts` | `return v.length > LIMITS.hash ? null : v;` → `return v;` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "initialHash: an id; empty is no hash, and one over 1024 code units is ignored, not cut" |
| L2-T5-M19 | sha: at most 40 hex characters for a SHA-1 name | `src/enhance/options.ts` | `const SHA = /^(?:[0-9a-f]{7,40}\|[0-9a-f]{64})$/i;` → `const SHA = /^(?:[0-9a-f]{7,41}\|[0-9a-f]{64})$/i;` | `test/enhance-options.test.ts`: 4 failed \| 129 passed (133). "info.sha of 41 hex"; "info.only of 41 hex"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a sha is 7 to 40 hex characters, or exactly 64, in either case" |
| L2-T5-M20 | sha: at least 7 hex characters | `src/enhance/options.ts` | `const SHA = /^(?:[0-9a-f]{7,40}\|[0-9a-f]{64})$/i;` → `const SHA = /^(?:[0-9a-f]{6,40}\|[0-9a-f]{64})$/i;` | `test/enhance-options.test.ts`: 4 failed \| 129 passed (133). "info.sha of 6 hex"; "commit parents holding a short sha"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a sha is 7 to 40 hex characters, or exactly 64, in either case" |
| L2-T5-M21 | sha: a SHA-256 name is exactly 64 | `src/enhance/options.ts` | `const SHA = /^(?:[0-9a-f]{7,40}\|[0-9a-f]{64})$/i;` → `const SHA = /^(?:[0-9a-f]{7,40}\|[0-9a-f]{63,64})$/i;` | `test/enhance-options.test.ts`: 4 failed \| 129 passed (133). "info.sha of 63 hex"; "a commit sha of 63 hex"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a sha is 7 to 40 hex characters, or exactly 64, in either case" |
| L2-T5-M22 | sha: a SHA-256 name is accepted | `src/enhance/options.ts` | `const SHA = /^(?:[0-9a-f]{7,40}\|[0-9a-f]{64})$/i;` → `const SHA = /^(?:[0-9a-f]{7,40})$/i;` | `test/enhance-options.test.ts`: 5 failed \| 128 passed (133). "each option given, each normalized"; "enhance() takes every option at once and resolves"; "a sha is 7 to 40 hex characters, or exactly 64, in either case"; "info.commits keeps its first 100 entries, and no entry past them is read"; "ctx.info carries sha, draft, commits and only, with their defaults" |
| L2-T5-M23 | sha: anchored at the start | `src/enhance/options.ts` | `const SHA = /^(?:[0-9a-f]{7,40}\|[0-9a-f]{64})$/i;` → `const SHA = /(?:[0-9a-f]{7,40}\|[0-9a-f]{64})$/i;` | `test/enhance-options.test.ts`: 7 failed \| 126 passed (133). "info.sha of 41 hex"; "info.sha of 63 hex"; "info.sha of 65 hex"; "info.only of 41 hex"; "a commit sha of 63 hex"; and 2 more |
| L2-T5-M24 | sha: hex digits only | `src/enhance/options.ts` | `const SHA = /^(?:[0-9a-f]{7,40}\|[0-9a-f]{64})$/i;` → `const SHA = /^(?:[0-9a-g]{7,40}\|[0-9a-f]{64})$/i;` | `test/enhance-options.test.ts`: 3 failed \| 130 passed (133). "info.sha not hex"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a sha is 7 to 40 hex characters, or exactly 64, in either case" |
| L2-T5-M25 | info.sha: checked | `src/enhance/options.ts` | `sha: shaOrNull('info.sha', fields['sha']),` → `sha: fields['sha'] as string \| undefined,` | `test/enhance-options.test.ts`: 8 failed \| 125 passed (133). "info.sha a number"; "info.sha of 6 hex"; "info.sha of 41 hex"; "info.sha of 63 hex"; "info.sha of 65 hex"; and 3 more |
| L2-T5-M26 | info.only: checked | `src/enhance/options.ts` | `only: shaOrNull('info.only', fields['only']),` → `only: fields['only'] as string \| undefined,` | `test/enhance-options.test.ts`: 3 failed \| 130 passed (133). "info.only of 41 hex"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a sha is 7 to 40 hex characters, or exactly 64, in either case" |
| L2-T5-M27 | info.draft: a boolean | `src/enhance/options.ts` | `if (draft !== undefined && typeof draft !== 'boolean') throw invalid('info.draft must be a boolean');` → (deleted) | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "info.draft a string"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M28 | info.commits: an array | `src/enhance/options.ts` | `if (!Array.isArray(v)) throw invalid('info.commits must be an array or null');` → (deleted) | `test/enhance-options.test.ts`: 3 failed \| 130 passed (133). "info.commits an object"; "info.commits an array-like object"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M29 | info.commits: the first 100, none past them read | `src/enhance/options.ts` | `return Object.freeze(firstItems(v, LIMITS.commits).map(commitEntry));` → `return Object.freeze(firstItems(v, v.length).map(commitEntry));` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "info.commits keeps its first 100 entries, and no entry past them is read" |
| L2-T5-M30 | info.commits: frozen | `src/enhance/options.ts` | `return Object.freeze(firstItems(v, LIMITS.commits).map(commitEntry));` → `return firstItems(v, LIMITS.commits).map(commitEntry);` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "what features read is frozen: chrome, the mermaid limits and keys, commits and their entries" |
| L2-T5-M31 | a commit: an object | `src/enhance/options.ts` | `` if (!isRecord(e)) throw invalid(`${where} must be { sha, subject, date, parents }`); `` → (deleted) | `test/enhance-options.test.ts`: 4 failed \| 129 passed (133). "info.commits holding null"; "info.commits holding a hole"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a getter on a commit entry, its parents or a secure key is never called: the entry is refused" |
| L2-T5-M32 | a commit: its sha | `src/enhance/options.ts` | `` if (!isSha(sha)) throw invalid(`${where}.sha must be 7 to 40 hex characters, or 64`); `` → (deleted) | `test/enhance-options.test.ts`: 4 failed \| 129 passed (133). "a commit sha of 63 hex"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a getter on a commit entry, its parents or a secure key is never called: the entry is refused"; "a sha is 7 to 40 hex characters, or exactly 64, in either case" |
| L2-T5-M33 | a commit: its subject a string | `src/enhance/options.ts` | `` if (typeof subject !== 'string') throw invalid(`${where}.subject must be a string`); `` → (deleted) | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "a commit subject that is a number"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M34 | a commit: its date a string | `src/enhance/options.ts` | `if (typeof date !== 'string' \|\| date.length > LIMITS.date) {` → `if (date.length > LIMITS.date) {` | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "a commit date that is a number"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M35 | a commit: its date at most 64 characters | `src/enhance/options.ts` | `if (typeof date !== 'string' \|\| date.length > LIMITS.date) {` → `if (typeof date !== 'string') {` | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "a commit date over its bound"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M36 | a commit: its parents an array | `src/enhance/options.ts` | `` if (!Array.isArray(parents)) throw invalid(`${where}.parents must be an array of shas`); `` → (deleted) | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "commit parents an array-like object"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M37 | a commit: the first 16 parents, none past them read | `src/enhance/options.ts` | `const kept = firstItems(parents, LIMITS.parents).map((p, k) => {` → `const kept = firstItems(parents, parents.length).map((p, k) => {` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "a date of 64 characters is kept; parents keep their first 16, and read none past them" |
| L2-T5-M38 | a commit: each parent a sha | `src/enhance/options.ts` | `` if (!isSha(p)) throw invalid(`${where}.parents[${String(k)}] must be 7 to 40 hex characters, or 64`); `` → (deleted) | `test/enhance-options.test.ts`: 3 failed \| 130 passed (133). "commit parents holding a short sha"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a getter on a commit entry, its parents or a secure key is never called: the entry is refused" |
| L2-T5-M39 | a commit: the subject cut to 200 code units | `src/enhance/options.ts` | `return Object.freeze({ sha, subject: cut(subject, LIMITS.subject), date, parents: Object.freeze(kept) });` → `return Object.freeze({ sha, subject, date, parents: Object.freeze(kept) });` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "a subject is cut to 200 code units, never inside a surrogate pair; a 1 MB subject stays bounded" |
| L2-T5-M40 | a commit: frozen | `src/enhance/options.ts` | `return Object.freeze({ sha, subject: cut(subject, LIMITS.subject), date, parents: Object.freeze(kept) });` → `return ({ sha, subject: cut(subject, LIMITS.subject), date, parents: Object.freeze(kept) });` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "what features read is frozen: chrome, the mermaid limits and keys, commits and their entries" |
| L2-T5-M41 | a commit: its parents frozen | `src/enhance/options.ts` | `return Object.freeze({ sha, subject: cut(subject, LIMITS.subject), date, parents: Object.freeze(kept) });` → `return Object.freeze({ sha, subject: cut(subject, LIMITS.subject), date, parents: kept });` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "what features read is frozen: chrome, the mermaid limits and keys, commits and their entries" |
| L2-T5-M42 | a cut never splits a surrogate pair | `src/enhance/options.ts` | `return s.slice(0, last >= 0xd800 && last <= 0xdbff ? n - 1 : n);` → `return s.slice(0, n);` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "a subject is cut to 200 code units, never inside a surrogate pair; a 1 MB subject stays bounded" |
| L2-T5-M43 | mermaid: an object | `src/enhance/options.ts` | `if (!isRecord(v)) throw invalid('mermaid must be an object');` → (deleted) | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "mermaid null"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M44 | mermaid: own data fields (unknown keys and getters refused) | `src/enhance/options.ts` | `const fields = ownFields('mermaid', v, MERMAID_KEYS);` → `const fields = { load: v['load'], maxTextSize: v['maxTextSize'], maxEdges: v['maxEdges'], secure: v['secure']…` | `test/enhance-options.test.ts`: 4 failed \| 129 passed (133). "a getter on mermaid.load"; "a getter on mermaid.maxEdges"; "a getter on mermaid.secure"; "unknown keys are refused, at the top, in chrome, in mermaid and in info; a commit entry may carry more" |
| L2-T5-M45 | mermaid.load: required | `src/enhance/options.ts` | `if (load === null) throw invalid('mermaid.load must be a function');` → (deleted) | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "mermaid without load"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M46 | mermaid limits: integers (no fraction, NaN) | `src/enhance/options.ts` | `if (typeof v !== 'number' \|\| !Number.isInteger(v) \|\| v < 1 \|\| v > max) {` → `if (typeof v !== 'number' \|\| v < 1 \|\| v > max) {` | `test/enhance-options.test.ts`: 4 failed \| 129 passed (133). "mermaid.maxTextSize a fraction"; "mermaid.maxTextSize NaN"; "mermaid.maxEdges NaN"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M47 | mermaid limits: at least 1 | `src/enhance/options.ts` | `if (typeof v !== 'number' \|\| !Number.isInteger(v) \|\| v < 1 \|\| v > max) {` → `if (typeof v !== 'number' \|\| !Number.isInteger(v) \|\| v > max) {` | `test/enhance-options.test.ts`: 4 failed \| 129 passed (133). "mermaid.maxTextSize zero"; "mermaid.maxTextSize negative"; "mermaid.maxEdges zero"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M48 | mermaid limits: at most their bound | `src/enhance/options.ts` | `if (typeof v !== 'number' \|\| !Number.isInteger(v) \|\| v < 1 \|\| v > max) {` → `if (typeof v !== 'number' \|\| !Number.isInteger(v) \|\| v < 1) {` | `test/enhance-options.test.ts`: 3 failed \| 130 passed (133). "mermaid.maxTextSize over its bound"; "mermaid.maxEdges over its bound"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M49 | mermaid settings: frozen | `src/enhance/options.ts` | `const settings = Object.freeze({` → `const settings = ({` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "what features read is frozen: chrome, the mermaid limits and keys, commits and their entries" |
| L2-T5-M50 | mermaid.secure: an array | `src/enhance/options.ts` | `if (!Array.isArray(v)) throw invalid('mermaid.secure must be an array of configuration key names');` → (deleted) | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "mermaid.secure a string"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M51 | mermaid.secure: at most 64 keys | `src/enhance/options.ts` | `` if (v.length > LIMITS.secure) throw invalid(`mermaid.secure holds at most ${String(LIMITS.secure)} keys`); `` → (deleted) | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "mermaid.secure over its count"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M52 | mermaid.secure: each a configuration key name | `src/enhance/options.ts` | `if (typeof k !== 'string' \|\| !CONFIG_KEY.test(k)) {` → `if (typeof k !== 'string') {` | `test/enhance-options.test.ts`: 4 failed \| 129 passed (133). "mermaid.secure holding a dotted key"; "mermaid.secure holding an empty key"; "mermaid.secure holding a key over 64 characters"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M53 | mermaid.secure: a key of at most 64 characters | `src/enhance/options.ts` | `const CONFIG_KEY = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;` → `const CONFIG_KEY = /^[A-Za-z][A-Za-z0-9_]{0,64}$/;` | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "mermaid.secure holding a key over 64 characters"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M54 | mermaid.secure: a top-level key, no dotted path | `src/enhance/options.ts` | `const CONFIG_KEY = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;` → `const CONFIG_KEY = /^[A-Za-z][A-Za-z0-9_.]{0,63}$/;` | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "mermaid.secure holding a dotted key"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M55 | mermaid.secure: each key once | `src/enhance/options.ts` | `if (!out.includes(k)) out.push(k);` → `out.push(k);` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "each option given, each normalized" |
| L2-T5-M56 | mermaid.secure: frozen | `src/enhance/options.ts` | `return Object.freeze(out);` → `return out;` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "what features read is frozen: chrome, the mermaid limits and keys, commits and their entries" |
| L2-T5-M57 | lens: its values | `src/enhance/options.ts` | `lens: ['all', 'product'],` → `lens: ['all', 'product', 'loud'],` | `test/enhance-options.test.ts`: 3 failed \| 130 passed (133). "defaults to all, the first of its values"; "a stored lens is restored; an invalid one is ignored; an explicit one wins"; "setEnhancementPrefs stores it with the prefs, and refuses a bad value" |
| L2-T5-M58 | options: every own property is read, a non-enumerable one too | `src/enhance/options.ts` | `const names = Object.getOwnPropertyNames(v);` → `const names: string[] = []; ⏎   for (const k in v) names.push(k);` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "a non-enumerable own option is still read" |
| L2-T5-M59 | options: a getter refused unread (new keys and nested objects) | `src/enhance/options.ts` | `` if (!('value' in d)) throw invalid(`${where}.${k} must be a plain value, not a getter`); `` → `if (!('value' in d)) { ⏎       out[k] = d.get?.call(v); ⏎       continue; ⏎     }` | `test/enhance-options.test.ts`: 20 failed \| 113 passed (133). "a getter for posKey"; "a getter for keyboard"; "a getter for chrome"; "a getter for rules"; "a getter for initialHash"; and 15 more |
| L2-T5-M98 | options: an inherited property is never read (own names and own descriptors both) | `src/enhance/options.ts` | `const names = Object.getOwnPropertyNames(v); ⏎   const unknown = names.filter((k) => !allowed.includes(k)); ⏎…` → `const names: string[] = []; ⏎   for (const k in v) names.push(k); ⏎   const unknown = names.filter((k) => !al…` | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "inherited properties are not options: not read, not refused"; "a non-enumerable own option is still read" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T5-M1",
    "guard": "posKey: a non-empty string",
    "file": "src/enhance/options.ts",
    "old": "  if (posKey !== undefined && (typeof posKey !== 'string' || posKey === '')) throw invalid('posKey must be a non-empty string');\n",
    "new": "",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M2",
    "guard": "posKey: defaults to storageKey",
    "file": "src/enhance/options.ts",
    "old": "    posKey: posKey ?? storageKey ?? null,",
    "new": "    posKey: posKey ?? null,",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M3",
    "guard": "a boolean option is a boolean (keyboard, rules, chrome fields)",
    "file": "src/enhance/options.ts",
    "old": "  if (typeof v !== 'boolean') throw invalid(`${where} must be a boolean`);\n",
    "new": "",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M4",
    "guard": "keyboard: default true",
    "file": "src/enhance/options.ts",
    "old": "    keyboard: flag('keyboard', fields['keyboard'], true),",
    "new": "    keyboard: flag('keyboard', fields['keyboard'], false),",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M5",
    "guard": "rules: default false",
    "file": "src/enhance/options.ts",
    "old": "    rules: flag('rules', fields['rules'], false),",
    "new": "    rules: flag('rules', fields['rules'], true),",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M6",
    "guard": "chrome: left out, every part on",
    "file": "src/enhance/options.ts",
    "old": "  if (v === undefined) return Object.freeze({ bar: true, rail: true, settings: true });",
    "new": "  if (v === undefined) return Object.freeze({ bar: true, rail: false, settings: true });",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M7",
    "guard": "chrome: each field defaults to true",
    "file": "src/enhance/options.ts",
    "old": "flag('chrome.bar', bar, true)",
    "new": "flag('chrome.bar', bar, false)",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M8",
    "guard": "chrome: an object",
    "file": "src/enhance/options.ts",
    "old": "  if (!isRecord(v)) throw invalid('chrome must be an object');\n",
    "new": "",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M9",
    "guard": "chrome: own data fields (unknown keys and getters refused, inherited ignored)",
    "file": "src/enhance/options.ts",
    "old": "  const { bar, rail, settings } = ownFields('chrome', v, CHROME_KEYS);",
    "new": "  const { bar, rail, settings } = { bar: v['bar'], rail: v['rail'], settings: v['settings'] };",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M10",
    "guard": "chrome: frozen",
    "file": "src/enhance/options.ts",
    "old": "  return Object.freeze({ bar: flag('chrome.bar', bar, true),",
    "new": "  return ({ bar: flag('chrome.bar', bar, true),",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M11",
    "guard": "a function option is a function",
    "file": "src/enhance/options.ts",
    "old": "  if (typeof v !== 'function') throw invalid(`${where} must be a function`);\n",
    "new": "",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M12",
    "guard": "a function option is never touched while read",
    "file": "src/enhance/options.ts",
    "old": "  return Object.freeze({ fn: v as (...args: never[]) => unknown, self });",
    "new": "  return Object.freeze({ fn: (v as (...args: never[]) => unknown).bind(self), self });",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M13",
    "guard": "a function option keeps its receiver",
    "file": "src/enhance/options.ts",
    "old": "  return Object.freeze({ fn: v as (...args: never[]) => unknown, self });",
    "new": "  return Object.freeze({ fn: v as (...args: never[]) => unknown, self: {} });",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M14",
    "guard": "a bound callback is frozen",
    "file": "src/enhance/options.ts",
    "old": "  return Object.freeze({ fn: v as (...args: never[]) => unknown, self });",
    "new": "  return ({ fn: v as (...args: never[]) => unknown, self });",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M15",
    "guard": "the callbacks record is frozen",
    "file": "src/enhance/options.ts",
    "old": "  const callbacks: HostCallbacks = Object.freeze({",
    "new": "  const callbacks: HostCallbacks = ({",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M16",
    "guard": "initialHash: a string or null",
    "file": "src/enhance/options.ts",
    "old": "  if (typeof v !== 'string') throw invalid('initialHash must be a string or null');\n",
    "new": "",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M17",
    "guard": "initialHash: empty is none",
    "file": "src/enhance/options.ts",
    "old": "  if (v === undefined || v === null || v === '') return null;",
    "new": "  if (v === undefined || v === null) return null;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M18",
    "guard": "initialHash: over 1024 code units is ignored",
    "file": "src/enhance/options.ts",
    "old": "  return v.length > LIMITS.hash ? null : v;",
    "new": "  return v;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M19",
    "guard": "sha: at most 40 hex characters for a SHA-1 name",
    "file": "src/enhance/options.ts",
    "old": "const SHA = /^(?:[0-9a-f]{7,40}|[0-9a-f]{64})$/i;",
    "new": "const SHA = /^(?:[0-9a-f]{7,41}|[0-9a-f]{64})$/i;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M20",
    "guard": "sha: at least 7 hex characters",
    "file": "src/enhance/options.ts",
    "old": "const SHA = /^(?:[0-9a-f]{7,40}|[0-9a-f]{64})$/i;",
    "new": "const SHA = /^(?:[0-9a-f]{6,40}|[0-9a-f]{64})$/i;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M21",
    "guard": "sha: a SHA-256 name is exactly 64",
    "file": "src/enhance/options.ts",
    "old": "const SHA = /^(?:[0-9a-f]{7,40}|[0-9a-f]{64})$/i;",
    "new": "const SHA = /^(?:[0-9a-f]{7,40}|[0-9a-f]{63,64})$/i;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M22",
    "guard": "sha: a SHA-256 name is accepted",
    "file": "src/enhance/options.ts",
    "old": "const SHA = /^(?:[0-9a-f]{7,40}|[0-9a-f]{64})$/i;",
    "new": "const SHA = /^(?:[0-9a-f]{7,40})$/i;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M23",
    "guard": "sha: anchored at the start",
    "file": "src/enhance/options.ts",
    "old": "const SHA = /^(?:[0-9a-f]{7,40}|[0-9a-f]{64})$/i;",
    "new": "const SHA = /(?:[0-9a-f]{7,40}|[0-9a-f]{64})$/i;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M24",
    "guard": "sha: hex digits only",
    "file": "src/enhance/options.ts",
    "old": "const SHA = /^(?:[0-9a-f]{7,40}|[0-9a-f]{64})$/i;",
    "new": "const SHA = /^(?:[0-9a-g]{7,40}|[0-9a-f]{64})$/i;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M25",
    "guard": "info.sha: checked",
    "file": "src/enhance/options.ts",
    "old": "    sha: shaOrNull('info.sha', fields['sha']),",
    "new": "    sha: fields['sha'] as string | undefined,",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M26",
    "guard": "info.only: checked",
    "file": "src/enhance/options.ts",
    "old": "    only: shaOrNull('info.only', fields['only']),",
    "new": "    only: fields['only'] as string | undefined,",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M27",
    "guard": "info.draft: a boolean",
    "file": "src/enhance/options.ts",
    "old": "  if (draft !== undefined && typeof draft !== 'boolean') throw invalid('info.draft must be a boolean');\n",
    "new": "",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M28",
    "guard": "info.commits: an array",
    "file": "src/enhance/options.ts",
    "old": "  if (!Array.isArray(v)) throw invalid('info.commits must be an array or null');\n",
    "new": "",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M29",
    "guard": "info.commits: the first 100, none past them read",
    "file": "src/enhance/options.ts",
    "old": "  return Object.freeze(firstItems(v, LIMITS.commits).map(commitEntry));",
    "new": "  return Object.freeze(firstItems(v, v.length).map(commitEntry));",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M30",
    "guard": "info.commits: frozen",
    "file": "src/enhance/options.ts",
    "old": "  return Object.freeze(firstItems(v, LIMITS.commits).map(commitEntry));",
    "new": "  return firstItems(v, LIMITS.commits).map(commitEntry);",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M31",
    "guard": "a commit: an object",
    "file": "src/enhance/options.ts",
    "old": "  if (!isRecord(e)) throw invalid(`${where} must be { sha, subject, date, parents }`);\n",
    "new": "",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M32",
    "guard": "a commit: its sha",
    "file": "src/enhance/options.ts",
    "old": "  if (!isSha(sha)) throw invalid(`${where}.sha must be 7 to 40 hex characters, or 64`);\n",
    "new": "",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M33",
    "guard": "a commit: its subject a string",
    "file": "src/enhance/options.ts",
    "old": "  if (typeof subject !== 'string') throw invalid(`${where}.subject must be a string`);\n",
    "new": "",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M34",
    "guard": "a commit: its date a string",
    "file": "src/enhance/options.ts",
    "old": "  if (typeof date !== 'string' || date.length > LIMITS.date) {",
    "new": "  if (date.length > LIMITS.date) {",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M35",
    "guard": "a commit: its date at most 64 characters",
    "file": "src/enhance/options.ts",
    "old": "  if (typeof date !== 'string' || date.length > LIMITS.date) {",
    "new": "  if (typeof date !== 'string') {",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M36",
    "guard": "a commit: its parents an array",
    "file": "src/enhance/options.ts",
    "old": "  if (!Array.isArray(parents)) throw invalid(`${where}.parents must be an array of shas`);\n",
    "new": "",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M37",
    "guard": "a commit: the first 16 parents, none past them read",
    "file": "src/enhance/options.ts",
    "old": "  const kept = firstItems(parents, LIMITS.parents).map((p, k) => {",
    "new": "  const kept = firstItems(parents, parents.length).map((p, k) => {",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M38",
    "guard": "a commit: each parent a sha",
    "file": "src/enhance/options.ts",
    "old": "    if (!isSha(p)) throw invalid(`${where}.parents[${String(k)}] must be 7 to 40 hex characters, or 64`);\n",
    "new": "",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M39",
    "guard": "a commit: the subject cut to 200 code units",
    "file": "src/enhance/options.ts",
    "old": "  return Object.freeze({ sha, subject: cut(subject, LIMITS.subject), date, parents: Object.freeze(kept) });",
    "new": "  return Object.freeze({ sha, subject, date, parents: Object.freeze(kept) });",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M40",
    "guard": "a commit: frozen",
    "file": "src/enhance/options.ts",
    "old": "  return Object.freeze({ sha, subject: cut(subject, LIMITS.subject), date, parents: Object.freeze(kept) });",
    "new": "  return ({ sha, subject: cut(subject, LIMITS.subject), date, parents: Object.freeze(kept) });",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M41",
    "guard": "a commit: its parents frozen",
    "file": "src/enhance/options.ts",
    "old": "  return Object.freeze({ sha, subject: cut(subject, LIMITS.subject), date, parents: Object.freeze(kept) });",
    "new": "  return Object.freeze({ sha, subject: cut(subject, LIMITS.subject), date, parents: kept });",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M42",
    "guard": "a cut never splits a surrogate pair",
    "file": "src/enhance/options.ts",
    "old": "  return s.slice(0, last >= 0xd800 && last <= 0xdbff ? n - 1 : n);",
    "new": "  return s.slice(0, n);",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M43",
    "guard": "mermaid: an object",
    "file": "src/enhance/options.ts",
    "old": "  if (!isRecord(v)) throw invalid('mermaid must be an object');\n",
    "new": "",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M44",
    "guard": "mermaid: own data fields (unknown keys and getters refused)",
    "file": "src/enhance/options.ts",
    "old": "  const fields = ownFields('mermaid', v, MERMAID_KEYS);",
    "new": "  const fields = { load: v['load'], maxTextSize: v['maxTextSize'], maxEdges: v['maxEdges'], secure: v['secure'] };",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M45",
    "guard": "mermaid.load: required",
    "file": "src/enhance/options.ts",
    "old": "  if (load === null) throw invalid('mermaid.load must be a function');\n",
    "new": "",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M46",
    "guard": "mermaid limits: integers (no fraction, NaN)",
    "file": "src/enhance/options.ts",
    "old": "  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > max) {",
    "new": "  if (typeof v !== 'number' || v < 1 || v > max) {",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M47",
    "guard": "mermaid limits: at least 1",
    "file": "src/enhance/options.ts",
    "old": "  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > max) {",
    "new": "  if (typeof v !== 'number' || !Number.isInteger(v) || v > max) {",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M48",
    "guard": "mermaid limits: at most their bound",
    "file": "src/enhance/options.ts",
    "old": "  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > max) {",
    "new": "  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M49",
    "guard": "mermaid settings: frozen",
    "file": "src/enhance/options.ts",
    "old": "  const settings = Object.freeze({",
    "new": "  const settings = ({",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M50",
    "guard": "mermaid.secure: an array",
    "file": "src/enhance/options.ts",
    "old": "  if (!Array.isArray(v)) throw invalid('mermaid.secure must be an array of configuration key names');\n",
    "new": "",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M51",
    "guard": "mermaid.secure: at most 64 keys",
    "file": "src/enhance/options.ts",
    "old": "  if (v.length > LIMITS.secure) throw invalid(`mermaid.secure holds at most ${String(LIMITS.secure)} keys`);\n",
    "new": "",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M52",
    "guard": "mermaid.secure: each a configuration key name",
    "file": "src/enhance/options.ts",
    "old": "    if (typeof k !== 'string' || !CONFIG_KEY.test(k)) {",
    "new": "    if (typeof k !== 'string') {",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M53",
    "guard": "mermaid.secure: a key of at most 64 characters",
    "file": "src/enhance/options.ts",
    "old": "const CONFIG_KEY = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;",
    "new": "const CONFIG_KEY = /^[A-Za-z][A-Za-z0-9_]{0,64}$/;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M54",
    "guard": "mermaid.secure: a top-level key, no dotted path",
    "file": "src/enhance/options.ts",
    "old": "const CONFIG_KEY = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;",
    "new": "const CONFIG_KEY = /^[A-Za-z][A-Za-z0-9_.]{0,63}$/;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M55",
    "guard": "mermaid.secure: each key once",
    "file": "src/enhance/options.ts",
    "old": "    if (!out.includes(k)) out.push(k);",
    "new": "    out.push(k);",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M56",
    "guard": "mermaid.secure: frozen",
    "file": "src/enhance/options.ts",
    "old": "  return Object.freeze(out);",
    "new": "  return out;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M57",
    "guard": "lens: its values",
    "file": "src/enhance/options.ts",
    "old": "  lens: ['all', 'product'],",
    "new": "  lens: ['all', 'product', 'loud'],",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M58",
    "guard": "options: every own property is read, a non-enumerable one too",
    "file": "src/enhance/options.ts",
    "old": "  const names = Object.getOwnPropertyNames(v);",
    "new": "  const names: string[] = [];\n  for (const k in v) names.push(k);",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M59",
    "guard": "options: a getter refused unread (new keys and nested objects)",
    "file": "src/enhance/options.ts",
    "old": "    if (!('value' in d)) throw invalid(`${where}.${k} must be a plain value, not a getter`);",
    "new": "    if (!('value' in d)) {\n      out[k] = d.get?.call(v);\n      continue;\n    }",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M98",
    "guard": "options: an inherited property is never read (own names and own descriptors both)",
    "file": "src/enhance/options.ts",
    "old": "  const names = Object.getOwnPropertyNames(v);\n  const unknown = names.filter((k) => !allowed.includes(k));\n  if (unknown.length > 0) throw invalid(`${where} has unknown keys: ${unknown.join(', ')}`);\n  const out: Record<string, unknown> = {};\n  for (const k of names) {\n    const d = Object.getOwnPropertyDescriptor(v, k);",
    "new": "  const names: string[] = [];\n  for (const k in v) names.push(k);\n  const unknown = names.filter((k) => !allowed.includes(k));\n  if (unknown.length > 0) throw invalid(`${where} has unknown keys: ${unknown.join(', ')}`);\n  const out: Record<string, unknown> = {};\n  for (const k of names) {\n    const d = Object.getOwnPropertyDescriptor(v, k) ?? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(v) as object, k);",
    "tests": "test/enhance-options.test.ts"
  }
]
```

## Host adapters: `src/enhance/host.ts`

One wrapper per host callback. The test harness's `operate` only counts depth and never refuses, so a row on the wrapper's own live check is seen there; the lifecycle rows below cover the wrapper and the instance's own `operate` together.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T5-M60 | absent: no call (synchronous) | `src/enhance/host.ts` | `if (bound === null \|\| !live()) return null;` → `if (!live()) return null;` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "absent: present is empty, each wrapper calls nothing and answers null" |
| L2-T5-M61 | not live: no call (synchronous) | `src/enhance/host.ts` | `if (bound === null \|\| !live()) return null;` → `if (bound === null) return null;` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "once not live, nothing is called and every wrapper answers null" |
| L2-T5-M62 | absent: no call (asynchronous) | `src/enhance/host.ts` | `if (bound === null \|\| !live()) return Promise.resolve(null);` → `if (!live()) return Promise.resolve(null);` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "absent: present is empty, each wrapper calls nothing and answers null" |
| L2-T5-M63 | not live: no call (asynchronous) | `src/enhance/host.ts` | `if (bound === null \|\| !live()) return Promise.resolve(null);` → `if (bound === null) return Promise.resolve(null);` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "once not live, nothing is called and every wrapper answers null" |
| L2-T5-M64 | inside an operation (synchronous) | `src/enhance/host.ts` | `const out = operate((): Called => {` → `const out = ((f: () => Called): Called => f())((): Called => {` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "each callback runs inside an operation" |
| L2-T5-M65 | inside an operation (asynchronous) | `src/enhance/host.ts` | `const pending = operate((): Promise<unknown> \| null => {` → `const pending = ((f: () => Promise<unknown> \| null) => f())((): Promise<unknown> \| null => {` | `test/enhance-options.test.ts`: 3 failed \| 130 passed (133). "each callback runs inside an operation"; "the then of a thenable the host returned is read inside the operation"; "a destroy from inside a callback waits for the call to return, then tears down; its reply is silenced" |
| L2-T5-M66 | a throw becomes null (synchronous) | `src/enhance/host.ts` | `return null; // swallowed: the host's failure is the feature's null` → `throw new Error('rethrown');` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "a throw becomes null, for every callback" |
| L2-T5-M67 | a throw becomes null (asynchronous) | `src/enhance/host.ts` | `return null; ⏎       } ⏎     }); ⏎     if (pending === undefined` → `throw new Error('rethrown'); ⏎       } ⏎     }); ⏎     if (pending === undefined` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "a throw becomes null, for every callback" |
| L2-T5-M68 | a rejection becomes null | `src/enhance/host.ts` | `(v) => (live() ? (keep ? v : undefined) : null), ⏎       () => null,` → `(v) => (live() ? (keep ? v : undefined) : null),` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "a rejection becomes null; so does a thenable whose then throws, or whose then getter throws; nothing rejects" |
| L2-T5-M69 | a thenable's then read inside the operation | `src/enhance/host.ts` | `return new Promise<unknown>((resolve) => { ⏎           resolve(value); ⏎         });` → `return Promise.resolve().then(() => value);` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "the then of a thenable the host returned is read inside the operation" |
| L2-T5-M70 | a reply after the instance stopped being live is silenced | `src/enhance/host.ts` | `(v) => (live() ? (keep ? v : undefined) : null),` → `(v) => (keep ? v : undefined),` | `test/enhance-options.test.ts`: 3 failed \| 130 passed (133). "a reply that settles after the instance stopped being live is silenced: null"; "a destroy from inside a callback waits for the call to return, then tears down; its reply is silenced"; "a reply after destroy is silenced on the real instance too" |
| L2-T5-M71 | copy answers undefined, not the host value | `src/enhance/host.ts` | `copy: (text: string) => callAsync('copy', [text], false),` → `copy: (text: string) => callAsync('copy', [text], true),` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "results are unknown: a value callback answers what the host returned, a void one undefined" |
| L2-T5-M72 | a void callback answers undefined, not the host value | `src/enhance/host.ts` | `const done = (c: Called): unknown => (c === null ? null : undefined);` → `const done = (c: Called): unknown => (c === null ? null : c.value);` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "results are unknown: a value callback answers what the host returned, a void one undefined" |
| L2-T5-M73 | itemLink answers the host's value | `src/enhance/host.ts` | `return c === null ? null : c.value;` → `return c === null ? null : undefined;` | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "present is a frozen set of the callbacks given, in a fixed order; one that returns null is still present"; "results are unknown: a value callback answers what the host returned, a void one undefined" |
| L2-T5-M74 | the receiver (synchronous) | `src/enhance/host.ts` | `return { value: fn.call(bound.self, ...args) };` → `return { value: fn(...args) };` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "each callback gets its arguments, as fresh frozen objects, and the object it was read from as its receiver" |
| L2-T5-M75 | the receiver (asynchronous) | `src/enhance/host.ts` | `const value = fn.call(bound.self, ...args);` → `const value = fn(...args);` | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "each callback gets its arguments, as fresh frozen objects, and the object it was read from as its receiver"; "a callback is called as a method of the options object" |
| L2-T5-M76 | openVersion gets a fresh frozen copy | `src/enhance/host.ts` | `done(call('openVersion', [Object.freeze({ sha: v.sha, only: v.only })])),` → `done(call('openVersion', [v])),` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "each callback gets its arguments, as fresh frozen objects, and the object it was read from as its receiver" |
| L2-T5-M77 | onLink gets a fresh frozen copy | `src/enhance/host.ts` | `[href, Object.freeze({ newTab: how.newTab })]` → `[href, how]` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "each callback gets its arguments, as fresh frozen objects, and the object it was read from as its receiver" |
| L2-T5-M78 | onHash gets a fresh frozen copy | `src/enhance/host.ts` | `[id, Object.freeze({ push: entry.push, from: entry.from })]` → `[id, entry]` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "each callback gets its arguments, as fresh frozen objects, and the object it was read from as its receiver" |
| L2-T5-M79 | present: only the callbacks given | `src/enhance/host.ts` | `const names = Object.freeze(HOST_CALLBACKS.filter((n) => callbacks[n] !== null));` → `const names = Object.freeze(HOST_CALLBACKS.filter(() => true));` | `test/enhance-options.test.ts`: 3 failed \| 130 passed (133). "absent: present is empty, each wrapper calls nothing and answers null"; "present is a frozen set of the callbacks given, in a fixed order; one that returns null is still present"; "ctx.host.present names the callbacks given; ctx.options holds no host function" |
| L2-T5-M80 | present: its names frozen | `src/enhance/host.ts` | `const names = Object.freeze(HOST_CALLBACKS.filter((n) => callbacks[n] !== null));` → `const names = HOST_CALLBACKS.filter((n) => callbacks[n] !== null);` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "present is a frozen set of the callbacks given, in a fixed order; one that returns null is still present" |
| L2-T5-M81 | present: has() answers from the names | `src/enhance/host.ts` | `has: (name: HostCallback): boolean => names.includes(name)` → `has: (): boolean => true` | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "absent: present is empty, each wrapper calls nothing and answers null"; "present is a frozen set of the callbacks given, in a fixed order; one that returns null is still present" |
| L2-T5-M82 | present: frozen | `src/enhance/host.ts` | `const present: Present = Object.freeze({` → `const present: Present = ({` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "present is a frozen set of the callbacks given, in a fixed order; one that returns null is still present" |
| L2-T5-M83 | the host: frozen | `src/enhance/host.ts` | `return Object.freeze({ ⏎     present,` → `return ({ ⏎     present,` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "present is a frozen set of the callbacks given, in a fixed order; one that returns null is still present" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T5-M60",
    "guard": "absent: no call (synchronous)",
    "file": "src/enhance/host.ts",
    "old": "    if (bound === null || !live()) return null;",
    "new": "    if (!live()) return null;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M61",
    "guard": "not live: no call (synchronous)",
    "file": "src/enhance/host.ts",
    "old": "    if (bound === null || !live()) return null;",
    "new": "    if (bound === null) return null;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M62",
    "guard": "absent: no call (asynchronous)",
    "file": "src/enhance/host.ts",
    "old": "    if (bound === null || !live()) return Promise.resolve(null);",
    "new": "    if (!live()) return Promise.resolve(null);",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M63",
    "guard": "not live: no call (asynchronous)",
    "file": "src/enhance/host.ts",
    "old": "    if (bound === null || !live()) return Promise.resolve(null);",
    "new": "    if (bound === null) return Promise.resolve(null);",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M64",
    "guard": "inside an operation (synchronous)",
    "file": "src/enhance/host.ts",
    "old": "    const out = operate((): Called => {",
    "new": "    const out = ((f: () => Called): Called => f())((): Called => {",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M65",
    "guard": "inside an operation (asynchronous)",
    "file": "src/enhance/host.ts",
    "old": "    const pending = operate((): Promise<unknown> | null => {",
    "new": "    const pending = ((f: () => Promise<unknown> | null) => f())((): Promise<unknown> | null => {",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M66",
    "guard": "a throw becomes null (synchronous)",
    "file": "src/enhance/host.ts",
    "old": "        return null; // swallowed: the host's failure is the feature's null",
    "new": "        throw new Error('rethrown');",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M67",
    "guard": "a throw becomes null (asynchronous)",
    "file": "src/enhance/host.ts",
    "old": "        return null;\n      }\n    });\n    if (pending === undefined",
    "new": "        throw new Error('rethrown');\n      }\n    });\n    if (pending === undefined",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M68",
    "guard": "a rejection becomes null",
    "file": "src/enhance/host.ts",
    "old": "      (v) => (live() ? (keep ? v : undefined) : null),\n      () => null,",
    "new": "      (v) => (live() ? (keep ? v : undefined) : null),",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M69",
    "guard": "a thenable's then read inside the operation",
    "file": "src/enhance/host.ts",
    "old": "        return new Promise<unknown>((resolve) => {\n          resolve(value);\n        });",
    "new": "        return Promise.resolve().then(() => value);",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M70",
    "guard": "a reply after the instance stopped being live is silenced",
    "file": "src/enhance/host.ts",
    "old": "      (v) => (live() ? (keep ? v : undefined) : null),",
    "new": "      (v) => (keep ? v : undefined),",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M71",
    "guard": "copy answers undefined, not the host value",
    "file": "src/enhance/host.ts",
    "old": "    copy: (text: string) => callAsync('copy', [text], false),",
    "new": "    copy: (text: string) => callAsync('copy', [text], true),",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M72",
    "guard": "a void callback answers undefined, not the host value",
    "file": "src/enhance/host.ts",
    "old": "  const done = (c: Called): unknown => (c === null ? null : undefined);",
    "new": "  const done = (c: Called): unknown => (c === null ? null : c.value);",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M73",
    "guard": "itemLink answers the host's value",
    "file": "src/enhance/host.ts",
    "old": "      return c === null ? null : c.value;",
    "new": "      return c === null ? null : undefined;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M74",
    "guard": "the receiver (synchronous)",
    "file": "src/enhance/host.ts",
    "old": "        return { value: fn.call(bound.self, ...args) };",
    "new": "        return { value: fn(...args) };",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M75",
    "guard": "the receiver (asynchronous)",
    "file": "src/enhance/host.ts",
    "old": "        const value = fn.call(bound.self, ...args);",
    "new": "        const value = fn(...args);",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M76",
    "guard": "openVersion gets a fresh frozen copy",
    "file": "src/enhance/host.ts",
    "old": "      done(call('openVersion', [Object.freeze({ sha: v.sha, only: v.only })])),",
    "new": "      done(call('openVersion', [v])),",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M77",
    "guard": "onLink gets a fresh frozen copy",
    "file": "src/enhance/host.ts",
    "old": "[href, Object.freeze({ newTab: how.newTab })]",
    "new": "[href, how]",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M78",
    "guard": "onHash gets a fresh frozen copy",
    "file": "src/enhance/host.ts",
    "old": "[id, Object.freeze({ push: entry.push, from: entry.from })]",
    "new": "[id, entry]",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M79",
    "guard": "present: only the callbacks given",
    "file": "src/enhance/host.ts",
    "old": "  const names = Object.freeze(HOST_CALLBACKS.filter((n) => callbacks[n] !== null));",
    "new": "  const names = Object.freeze(HOST_CALLBACKS.filter(() => true));",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M80",
    "guard": "present: its names frozen",
    "file": "src/enhance/host.ts",
    "old": "  const names = Object.freeze(HOST_CALLBACKS.filter((n) => callbacks[n] !== null));",
    "new": "  const names = HOST_CALLBACKS.filter((n) => callbacks[n] !== null);",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M81",
    "guard": "present: has() answers from the names",
    "file": "src/enhance/host.ts",
    "old": "has: (name: HostCallback): boolean => names.includes(name)",
    "new": "has: (): boolean => true",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M82",
    "guard": "present: frozen",
    "file": "src/enhance/host.ts",
    "old": "  const present: Present = Object.freeze({",
    "new": "  const present: Present = ({",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M83",
    "guard": "the host: frozen",
    "file": "src/enhance/host.ts",
    "old": "  return Object.freeze({\n    present,",
    "new": "  return ({\n    present,",
    "tests": "test/enhance-options.test.ts"
  }
]
```

## Lifecycle, state, README and walls

The wiring into the instance, the `lens` pref, the README pins, and the wall that refuses the plan's name `history` (why the field is `info.commits`).

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T5-M84 | the host functions stay off ctx.options | `src/enhance/lifecycle.ts` | `const { callbacks, ...options } = opts;` → `const { callbacks } = opts; ⏎   const options = opts;` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "ctx.host.present names the callbacks given; ctx.options holds no host function" |
| L2-T5-M85 | the host's live check is the instance's | `src/enhance/lifecycle.ts` | `host: createHost(callbacks, live, operateHere),` → `host: createHost(callbacks, () => true, operateHere),` | `test/enhance-options.test.ts`: 2 failed \| 131 passed (133). "a destroy from inside a callback waits for the call to return, then tears down; its reply is silenced"; "a reply after destroy is silenced on the real instance too" |
| L2-T5-M86 | the host's operation is the instance's | `src/enhance/lifecycle.ts` | `host: createHost(callbacks, live, operateHere),` → `host: createHost(callbacks, live, (fn) => fn()),` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "a destroy from inside a callback waits for the call to return, then tears down; its reply is silenced" |
| L2-T5-M87 | ctx.info.sha | `src/enhance/lifecycle.ts` | `sha: info?.sha ?? null,` → `sha: null,` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "ctx.info carries sha, draft, commits and only, with their defaults" |
| L2-T5-M88 | ctx.info.draft: default false | `src/enhance/lifecycle.ts` | `draft: info?.draft ?? false,` → `draft: info?.draft ?? true,` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "ctx.info carries sha, draft, commits and only, with their defaults" |
| L2-T5-M89 | ctx.info.commits | `src/enhance/lifecycle.ts` | `commits: info?.commits ?? null,` → `commits: null,` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "ctx.info carries sha, draft, commits and only, with their defaults" |
| L2-T5-M90 | ctx.info.only | `src/enhance/lifecycle.ts` | `only: info?.only ?? null,` → `only: null,` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "ctx.info carries sha, draft, commits and only, with their defaults" |
| L2-T5-M91 | lens: restored from the stored prefs | `src/enhance/state.ts` | `for (const name of prefNames()) {` → `for (const name of ['theme', 'width', 'font'] as const) {` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "a stored lens is restored; an invalid one is ignored; an explicit one wins" |
| L2-T5-M92 | lens: a change of the prefs in force | `src/enhance/state.ts` | `const changed = prefNames().some((name) => next[name] !== prefs[name]);` → `const changed = next.theme !== prefs.theme \|\| next.width !== prefs.width \|\| next.font !== prefs.font;` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "a lens change is a change of the prefs in force" |
| L2-T5-M93 | lens: default all | `src/enhance/state.ts` | `lens: PREF_VALUES.lens[0] };` → `lens: PREF_VALUES.lens[1] };` | `test/enhance-options.test.ts`: 3 failed \| 130 passed (133). "defaults to all, the first of its values"; "a stored lens is restored; an invalid one is ignored; an explicit one wins"; "a lens change is a change of the prefs in force" |
| L2-T5-M94 | README: every option listed, each with its default | `README.md` | `` \| `posKey` \| `storageKey` \| `` → `` \| posKey \| `storageKey` \| `` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "lists every option once, each with a default" |
| L2-T5-M95 | README: the reserved position and UI keys | `README.md` | `` \| `docreader:pos:<posKey>` \| `` → `` \| `docreader:position:<posKey>` \| `` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "names the lens pref and its values, and the reserved position and UI keys" |
| L2-T5-M96 | README: the lens pref and its values | `README.md` | `` `lens`: `all` or `product` `` → `` `lens`: one of `all` and `product` `` | `test/enhance-options.test.ts`: 1 failed \| 132 passed (133). "names the lens pref and its values, and the reserved position and UI keys" |
| L2-T5-M97 | walls: the field is not named history (why info.commits) | `src/enhance/types.ts` | `readonly commits?: readonly CommitEntry[] \| null;` → `readonly history?: readonly CommitEntry[] \| null;` | `test/enhance-walls.test.ts`: 1 failed \| 10 passed (11). "no source file names a forbidden identifier, a selector with # or built at run time, or a style string" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T5-M84",
    "guard": "the host functions stay off ctx.options",
    "file": "src/enhance/lifecycle.ts",
    "old": "  const { callbacks, ...options } = opts;",
    "new": "  const { callbacks } = opts;\n  const options = opts;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M85",
    "guard": "the host's live check is the instance's",
    "file": "src/enhance/lifecycle.ts",
    "old": "    host: createHost(callbacks, live, operateHere),",
    "new": "    host: createHost(callbacks, () => true, operateHere),",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M86",
    "guard": "the host's operation is the instance's",
    "file": "src/enhance/lifecycle.ts",
    "old": "    host: createHost(callbacks, live, operateHere),",
    "new": "    host: createHost(callbacks, live, (fn) => fn()),",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M87",
    "guard": "ctx.info.sha",
    "file": "src/enhance/lifecycle.ts",
    "old": "    sha: info?.sha ?? null,",
    "new": "    sha: null,",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M88",
    "guard": "ctx.info.draft: default false",
    "file": "src/enhance/lifecycle.ts",
    "old": "    draft: info?.draft ?? false,",
    "new": "    draft: info?.draft ?? true,",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M89",
    "guard": "ctx.info.commits",
    "file": "src/enhance/lifecycle.ts",
    "old": "    commits: info?.commits ?? null,",
    "new": "    commits: null,",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M90",
    "guard": "ctx.info.only",
    "file": "src/enhance/lifecycle.ts",
    "old": "    only: info?.only ?? null,",
    "new": "    only: null,",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M91",
    "guard": "lens: restored from the stored prefs",
    "file": "src/enhance/state.ts",
    "old": "  for (const name of prefNames()) {",
    "new": "  for (const name of ['theme', 'width', 'font'] as const) {",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M92",
    "guard": "lens: a change of the prefs in force",
    "file": "src/enhance/state.ts",
    "old": "      const changed = prefNames().some((name) => next[name] !== prefs[name]);",
    "new": "      const changed = next.theme !== prefs.theme || next.width !== prefs.width || next.font !== prefs.font;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M93",
    "guard": "lens: default all",
    "file": "src/enhance/state.ts",
    "old": "lens: PREF_VALUES.lens[0] };",
    "new": "lens: PREF_VALUES.lens[1] };",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M94",
    "guard": "README: every option listed, each with its default",
    "file": "README.md",
    "old": "| `posKey` | `storageKey` | ",
    "new": "| posKey | `storageKey` | ",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M95",
    "guard": "README: the reserved position and UI keys",
    "file": "README.md",
    "old": "| `docreader:pos:<posKey>` |",
    "new": "| `docreader:position:<posKey>` |",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M96",
    "guard": "README: the lens pref and its values",
    "file": "README.md",
    "old": "`lens`: `all` or `product`",
    "new": "`lens`: one of `all` and `product`",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M97",
    "guard": "walls: the field is not named history (why info.commits)",
    "file": "src/enhance/types.ts",
    "old": "  readonly commits?: readonly CommitEntry[] | null;",
    "new": "  readonly history?: readonly CommitEntry[] | null;",
    "tests": "test/enhance-walls.test.ts"
  }
]
```
