# L2 Task 5: mutation rows (options and host adapters)

Each guard of Task 5 (`src/enhance/options.ts`, `host.ts`, its wiring in `lifecycle.ts`, the `lens` pref in `state.ts`, and
the README pins), deleted or inverted once, with the tests that go red. Measured 2026-10-20 on branch `l2-t5-options`,
against the working tree of its review-fix commit, `enhance: review fixes for options and host adapters (docserver L2 T5)`.

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8), unchanged: each row is applied to its own throwaway copy of
the working tree (tracked and untracked files, never ignored ones, `node_modules` linked from the checkout), its test files
run there with the local `vitest`, and the copy is deleted. Each `old` occurs exactly once in its file; rows that share
an `old` were applied to separate copies. The checkout was never edited: its `git status --porcelain` and the hash of its
`git diff` read the same before and after each run. All 141 rows went red (`rc=1`), measured in three runs of 47 rows on
the final tree. The Red column gives the count line and the failing tests the run printed (at most five here; the run
prints at most 20 failing lines).

**The review round.** Rows L2-T5-M1 to M98 are the first round's. Six of them were re-anchored on the code the review
changed, with the same mutation: M1 (the posKey check, now bounded), M39 to M41 (the commit entry, now with its sha in
lower case), and M74 and M75 (the receiver, now passed through the captured call). M14 and M15 are relabelled: the
callbacks record is not seen by a feature or a host (the lifecycle keeps it off `ctx.options` and hands it to
`createHost` alone), so its freeze is defence in depth, pinned by a case of its own. M60 and M62 went green after the
review's change to the call (a null record's TypeError is now inside the `try`, so it reads as null either way); a new
assertion that an absent callback enters no operation reddens them again. Rows M99 to M141 are the review's: key bounds,
`info.frontList` read by index and bounded, shas kept in lower case, each commit field and each array item read as own
data, the captured call, the synchronous reply after a self-requested destroy, and the README's stated defaults, bounds
and notes.

Two rows are paired on purpose. L2-T5-M58 replaces the own-name list with a `for...in` list: the inherited-property case
stays green, because the descriptor read is own as well, and only the non-enumerable case goes red. L2-T5-M98 removes
both layers (names and descriptors through the prototype) and reddens the inherited case.

## Options: `src/enhance/options.ts`

Reading, checking and bounding every option, and keeping the host functions apart.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T5-M1 | posKey: a non-empty string | `src/enhance/options.ts` | `` if (posKey !== undefined && !isKey(posKey)) throw invalid(`posKey must be a non-empty string of at most ${Str… `` → (deleted) | `test/enhance-options.test.ts`: 5 failed \| 146 passed (151). "posKey and storageKey: at most 1024 code units, the bound inclusive; a longer key is refused"; "posKey empty"; "posKey a number"; "posKey null"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M2 | posKey: defaults to storageKey | `src/enhance/options.ts` | `posKey: posKey ?? storageKey ?? null,` → `posKey: posKey ?? null,` | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "posKey defaults to storageKey; without either it is null"; "each stated default is the one normalizeOptions applies" |
| L2-T5-M3 | a boolean option is a boolean (keyboard, rules, chrome fields) | `src/enhance/options.ts` | `` if (typeof v !== 'boolean') throw invalid(`${where} must be a boolean`); `` → (deleted) | `test/enhance-options.test.ts`: 7 failed \| 144 passed (151). "keyboard a string"; "keyboard null"; "rules a string"; "chrome.bar a string"; "chrome.rail a number"; and 2 more |
| L2-T5-M4 | keyboard: default true | `src/enhance/options.ts` | `keyboard: flag('keyboard', fields['keyboard'], true),` → `keyboard: flag('keyboard', fields['keyboard'], false),` | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "the defaults, with no options at all and with an empty object"; "inherited properties are not options: not read, not refused"; "each stated default is the one normalizeOptions applies" |
| L2-T5-M5 | rules: default false | `src/enhance/options.ts` | `rules: flag('rules', fields['rules'], false),` → `rules: flag('rules', fields['rules'], true),` | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "the defaults, with no options at all and with an empty object"; "each stated default is the one normalizeOptions applies" |
| L2-T5-M6 | chrome: left out, every part on | `src/enhance/options.ts` | `if (v === undefined) return Object.freeze({ bar: true, rail: true, settings: true });` → `if (v === undefined) return Object.freeze({ bar: true, rail: false, settings: true });` | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "the defaults, with no options at all and with an empty object"; "each stated default is the one normalizeOptions applies" |
| L2-T5-M7 | chrome: each field defaults to true | `src/enhance/options.ts` | `flag('chrome.bar', bar, true)` → `flag('chrome.bar', bar, false)` | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "chrome fields default to true one by one; a mermaid object without limits leaves them to the library"; "inherited properties are not options: not read, not refused" |
| L2-T5-M8 | chrome: an object | `src/enhance/options.ts` | `if (!isRecord(v)) throw invalid('chrome must be an object');` → (deleted) | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "chrome a boolean"; "chrome null"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M9 | chrome: own data fields (unknown keys and getters refused, inherited ignored) | `src/enhance/options.ts` | `const { bar, rail, settings } = ownFields('chrome', v, CHROME_KEYS);` → `const { bar, rail, settings } = { bar: v['bar'], rail: v['rail'], settings: v['settings'] };` | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "a getter on chrome.bar"; "unknown keys are refused, at the top, in chrome, in mermaid and in info; a commit entry may carry more"; "inherited properties are not options: not read, not refused" |
| L2-T5-M10 | chrome: frozen | `src/enhance/options.ts` | `return Object.freeze({ bar: flag('chrome.bar', bar, true),` → `return ({ bar: flag('chrome.bar', bar, true),` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "what features read is frozen: chrome, the mermaid limits and keys, commits and their entries" |
| L2-T5-M11 | a function option is a function | `src/enhance/options.ts` | `` if (typeof v !== 'function') throw invalid(`${where} must be a function`); `` → (deleted) | `test/enhance-options.test.ts`: 20 failed \| 131 passed (151). "onLink a string"; "onLink null"; "onLink an object"; "onHash a string"; "onHash null"; and 15 more |
| L2-T5-M12 | a function option is never touched while read | `src/enhance/options.ts` | `return Object.freeze({ fn: v as (...args: never[]) => unknown, self });` → `return Object.freeze({ fn: (v as (...args: never[]) => unknown).bind(self), self });` | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "each option given, each normalized"; "a non-enumerable own option is still read"; "neither normalizeOptions nor the whole startup touches a function option, mermaid.load included" |
| L2-T5-M13 | a function option keeps its receiver | `src/enhance/options.ts` | `return Object.freeze({ fn: v as (...args: never[]) => unknown, self });` → `return Object.freeze({ fn: v as (...args: never[]) => unknown, self: {} });` | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "each option given, each normalized"; "a callback is called as a method of the options object" |
| L2-T5-M14 | defence in depth, not seen by a feature: a bound callback is frozen | `src/enhance/options.ts` | `return Object.freeze({ fn: v as (...args: never[]) => unknown, self });` → `return ({ fn: v as (...args: never[]) => unknown, self });` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "defence in depth, not seen by a feature: the callbacks record handed to the host wrappers is frozen" |
| L2-T5-M15 | defence in depth, not seen by a feature: the callbacks record is frozen | `src/enhance/options.ts` | `const callbacks: HostCallbacks = Object.freeze({` → `const callbacks: HostCallbacks = ({` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "defence in depth, not seen by a feature: the callbacks record handed to the host wrappers is frozen" |
| L2-T5-M16 | initialHash: a string or null | `src/enhance/options.ts` | `if (typeof v !== 'string') throw invalid('initialHash must be a string or null');` → (deleted) | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "initialHash a number"; "initialHash an object"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M17 | initialHash: empty is none | `src/enhance/options.ts` | `if (v === undefined \|\| v === null \|\| v === '') return null;` → `if (v === undefined \|\| v === null) return null;` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "initialHash: an id; empty is no hash, and one over 1024 code units is ignored, not cut" |
| L2-T5-M18 | initialHash: over 1024 code units is ignored | `src/enhance/options.ts` | `return v.length > LIMITS.hash ? null : v;` → `return v;` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "initialHash: an id; empty is no hash, and one over 1024 code units is ignored, not cut" |
| L2-T5-M19 | sha: at most 40 hex characters for a SHA-1 name | `src/enhance/options.ts` | `const SHA = /^(?:[0-9a-f]{7,40}\|[0-9a-f]{64})$/i;` → `const SHA = /^(?:[0-9a-f]{7,41}\|[0-9a-f]{64})$/i;` | `test/enhance-options.test.ts`: 4 failed \| 147 passed (151). "info.sha of 41 hex"; "info.only of 41 hex"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a sha is 7 to 40 hex characters, or exactly 64, in either case" |
| L2-T5-M20 | sha: at least 7 hex characters | `src/enhance/options.ts` | `const SHA = /^(?:[0-9a-f]{7,40}\|[0-9a-f]{64})$/i;` → `const SHA = /^(?:[0-9a-f]{6,40}\|[0-9a-f]{64})$/i;` | `test/enhance-options.test.ts`: 4 failed \| 147 passed (151). "info.sha of 6 hex"; "commit parents holding a short sha"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a sha is 7 to 40 hex characters, or exactly 64, in either case" |
| L2-T5-M21 | sha: a SHA-256 name is exactly 64 | `src/enhance/options.ts` | `const SHA = /^(?:[0-9a-f]{7,40}\|[0-9a-f]{64})$/i;` → `const SHA = /^(?:[0-9a-f]{7,40}\|[0-9a-f]{63,64})$/i;` | `test/enhance-options.test.ts`: 4 failed \| 147 passed (151). "info.sha of 63 hex"; "a commit sha of 63 hex"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a sha is 7 to 40 hex characters, or exactly 64, in either case" |
| L2-T5-M22 | sha: a SHA-256 name is accepted | `src/enhance/options.ts` | `const SHA = /^(?:[0-9a-f]{7,40}\|[0-9a-f]{64})$/i;` → `const SHA = /^(?:[0-9a-f]{7,40})$/i;` | `test/enhance-options.test.ts`: 6 failed \| 145 passed (151). "each option given, each normalized"; "enhance() takes every option at once and resolves"; "a sha given in upper case is kept in lower case, wherever it is read"; "a sha is 7 to 40 hex characters, or exactly 64, in either case"; "info.commits keeps its first 100 entries, and no entry past them is read"; and 1 more |
| L2-T5-M23 | sha: anchored at the start | `src/enhance/options.ts` | `const SHA = /^(?:[0-9a-f]{7,40}\|[0-9a-f]{64})$/i;` → `const SHA = /(?:[0-9a-f]{7,40}\|[0-9a-f]{64})$/i;` | `test/enhance-options.test.ts`: 7 failed \| 144 passed (151). "info.sha of 41 hex"; "info.sha of 63 hex"; "info.sha of 65 hex"; "info.only of 41 hex"; "a commit sha of 63 hex"; and 2 more |
| L2-T5-M24 | sha: hex digits only | `src/enhance/options.ts` | `const SHA = /^(?:[0-9a-f]{7,40}\|[0-9a-f]{64})$/i;` → `const SHA = /^(?:[0-9a-g]{7,40}\|[0-9a-f]{64})$/i;` | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "info.sha not hex"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a sha is 7 to 40 hex characters, or exactly 64, in either case" |
| L2-T5-M25 | info.sha: checked | `src/enhance/options.ts` | `sha: shaOrNull('info.sha', fields['sha']),` → `sha: fields['sha'] as string \| undefined,` | `test/enhance-options.test.ts`: 9 failed \| 142 passed (151). "info.sha a number"; "info.sha of 6 hex"; "info.sha of 41 hex"; "info.sha of 63 hex"; "info.sha of 65 hex"; and 4 more |
| L2-T5-M26 | info.only: checked | `src/enhance/options.ts` | `only: shaOrNull('info.only', fields['only']),` → `only: fields['only'] as string \| undefined,` | `test/enhance-options.test.ts`: 4 failed \| 147 passed (151). "info.only of 41 hex"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a sha given in upper case is kept in lower case, wherever it is read"; "a sha is 7 to 40 hex characters, or exactly 64, in either case" |
| L2-T5-M27 | info.draft: a boolean | `src/enhance/options.ts` | `if (draft !== undefined && typeof draft !== 'boolean') throw invalid('info.draft must be a boolean');` → (deleted) | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "info.draft a string"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M28 | info.commits: an array | `src/enhance/options.ts` | `if (!Array.isArray(v)) throw invalid('info.commits must be an array or null');` → (deleted) | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "info.commits an object"; "info.commits an array-like object"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M29 | info.commits: the first 100, none past them read | `src/enhance/options.ts` | `return Object.freeze(firstItems(v, LIMITS.commits).map(commitEntry));` → `return Object.freeze(firstItems(v, v.length).map(commitEntry));` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "info.commits keeps its first 100 entries, and no entry past them is read" |
| L2-T5-M30 | info.commits: frozen | `src/enhance/options.ts` | `return Object.freeze(firstItems(v, LIMITS.commits).map(commitEntry));` → `return firstItems(v, LIMITS.commits).map(commitEntry);` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "what features read is frozen: chrome, the mermaid limits and keys, commits and their entries" |
| L2-T5-M31 | a commit: an object | `src/enhance/options.ts` | `` if (!isRecord(e)) throw invalid(`${where} must be { sha, subject, date, parents }`); `` → (deleted) | `test/enhance-options.test.ts`: 4 failed \| 147 passed (151). "info.commits holding null"; "info.commits holding a hole"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a getter on a commit entry, its parents or a secure key is never called: the entry is refused" |
| L2-T5-M32 | a commit: its sha | `src/enhance/options.ts` | `` if (!isSha(sha)) throw invalid(`${where}.sha must be 7 to 40 hex characters, or 64`); `` → (deleted) | `test/enhance-options.test.ts`: 4 failed \| 147 passed (151). "a commit sha of 63 hex"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a getter on a commit entry, its parents or a secure key is never called: the entry is refused"; "a sha is 7 to 40 hex characters, or exactly 64, in either case" |
| L2-T5-M33 | a commit: its subject a string | `src/enhance/options.ts` | `` if (typeof subject !== 'string') throw invalid(`${where}.subject must be a string`); `` → (deleted) | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "a commit subject that is a number"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a getter on a commit entry's subject is never called: the entry is refused" |
| L2-T5-M34 | a commit: its date a string | `src/enhance/options.ts` | `if (typeof date !== 'string' \|\| date.length > LIMITS.date) {` → `if (date.length > LIMITS.date) {` | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "a commit date that is a number"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a getter on a commit entry's date is never called: the entry is refused" |
| L2-T5-M35 | a commit: its date at most 64 characters | `src/enhance/options.ts` | `if (typeof date !== 'string' \|\| date.length > LIMITS.date) {` → `if (typeof date !== 'string') {` | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "a commit date over its bound"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M36 | a commit: its parents an array | `src/enhance/options.ts` | `` if (!Array.isArray(parents)) throw invalid(`${where}.parents must be an array of shas`); `` → (deleted) | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "commit parents an array-like object"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a getter on a commit entry's parents is never called: the entry is refused" |
| L2-T5-M37 | a commit: the first 16 parents, none past them read | `src/enhance/options.ts` | `const kept = firstItems(parents, LIMITS.parents).map((p, k) => {` → `const kept = firstItems(parents, parents.length).map((p, k) => {` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a date of 64 characters is kept; parents keep their first 16, and read none past them" |
| L2-T5-M38 | a commit: each parent a sha | `src/enhance/options.ts` | `` if (!isSha(p)) throw invalid(`${where}.parents[${String(k)}] must be 7 to 40 hex characters, or 64`); `` → (deleted) | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "commit parents holding a short sha"; "through enhance(), every one rejects invalid-options and the root is untouched"; "a getter on a commit entry, its parents or a secure key is never called: the entry is refused" |
| L2-T5-M39 | a commit: the subject cut to 200 code units | `src/enhance/options.ts` | `return Object.freeze({ sha: sha.toLowerCase(), subject: cut(subject, LIMITS.subject), date, parents: Object.f…` → `return Object.freeze({ sha: sha.toLowerCase(), subject, date, parents: Object.freeze(kept) });` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a subject is cut to 200 code units, never inside a surrogate pair; a 1 MB subject stays bounded" |
| L2-T5-M40 | a commit: frozen | `src/enhance/options.ts` | `return Object.freeze({ sha: sha.toLowerCase(), subject: cut(subject, LIMITS.subject), date, parents: Object.f…` → `return ({ sha: sha.toLowerCase(), subject: cut(subject, LIMITS.subject), date, parents: Object.freeze(kept) }…` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "what features read is frozen: chrome, the mermaid limits and keys, commits and their entries" |
| L2-T5-M41 | a commit: its parents frozen | `src/enhance/options.ts` | `return Object.freeze({ sha: sha.toLowerCase(), subject: cut(subject, LIMITS.subject), date, parents: Object.f…` → `return Object.freeze({ sha: sha.toLowerCase(), subject: cut(subject, LIMITS.subject), date, parents: kept });` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "what features read is frozen: chrome, the mermaid limits and keys, commits and their entries" |
| L2-T5-M42 | a cut never splits a surrogate pair | `src/enhance/options.ts` | `return s.slice(0, last >= 0xd800 && last <= 0xdbff ? n - 1 : n);` → `return s.slice(0, n);` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a subject is cut to 200 code units, never inside a surrogate pair; a 1 MB subject stays bounded" |
| L2-T5-M43 | mermaid: an object | `src/enhance/options.ts` | `if (!isRecord(v)) throw invalid('mermaid must be an object');` → (deleted) | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "mermaid null"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M44 | mermaid: own data fields (unknown keys and getters refused) | `src/enhance/options.ts` | `const fields = ownFields('mermaid', v, MERMAID_KEYS);` → `const fields = { load: v['load'], maxTextSize: v['maxTextSize'], maxEdges: v['maxEdges'], secure: v['secure']…` | `test/enhance-options.test.ts`: 4 failed \| 147 passed (151). "a getter on mermaid.load"; "a getter on mermaid.maxEdges"; "a getter on mermaid.secure"; "unknown keys are refused, at the top, in chrome, in mermaid and in info; a commit entry may carry more" |
| L2-T5-M45 | mermaid.load: required | `src/enhance/options.ts` | `if (load === null) throw invalid('mermaid.load must be a function');` → (deleted) | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "mermaid without load"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M46 | mermaid limits: integers (no fraction, NaN) | `src/enhance/options.ts` | `if (typeof v !== 'number' \|\| !Number.isInteger(v) \|\| v < 1 \|\| v > max) {` → `if (typeof v !== 'number' \|\| v < 1 \|\| v > max) {` | `test/enhance-options.test.ts`: 4 failed \| 147 passed (151). "mermaid.maxTextSize a fraction"; "mermaid.maxTextSize NaN"; "mermaid.maxEdges NaN"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M47 | mermaid limits: at least 1 | `src/enhance/options.ts` | `if (typeof v !== 'number' \|\| !Number.isInteger(v) \|\| v < 1 \|\| v > max) {` → `if (typeof v !== 'number' \|\| !Number.isInteger(v) \|\| v > max) {` | `test/enhance-options.test.ts`: 4 failed \| 147 passed (151). "mermaid.maxTextSize zero"; "mermaid.maxTextSize negative"; "mermaid.maxEdges zero"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M48 | mermaid limits: at most their bound | `src/enhance/options.ts` | `if (typeof v !== 'number' \|\| !Number.isInteger(v) \|\| v < 1 \|\| v > max) {` → `if (typeof v !== 'number' \|\| !Number.isInteger(v) \|\| v < 1) {` | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "mermaid.maxTextSize over its bound"; "mermaid.maxEdges over its bound"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M49 | mermaid settings: frozen | `src/enhance/options.ts` | `const settings = Object.freeze({` → `const settings = ({` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "what features read is frozen: chrome, the mermaid limits and keys, commits and their entries" |
| L2-T5-M50 | mermaid.secure: an array | `src/enhance/options.ts` | `if (!Array.isArray(v)) throw invalid('mermaid.secure must be an array of configuration key names');` → (deleted) | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "mermaid.secure a string"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M51 | mermaid.secure: at most 64 keys | `src/enhance/options.ts` | `` if (v.length > LIMITS.secure) throw invalid(`mermaid.secure holds at most ${String(LIMITS.secure)} keys`); `` → (deleted) | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "mermaid.secure over its count"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M52 | mermaid.secure: each a configuration key name | `src/enhance/options.ts` | `if (typeof k !== 'string' \|\| !CONFIG_KEY.test(k)) {` → `if (typeof k !== 'string') {` | `test/enhance-options.test.ts`: 4 failed \| 147 passed (151). "mermaid.secure holding a dotted key"; "mermaid.secure holding an empty key"; "mermaid.secure holding a key over 64 characters"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M53 | mermaid.secure: a key of at most 64 characters | `src/enhance/options.ts` | `const CONFIG_KEY = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;` → `const CONFIG_KEY = /^[A-Za-z][A-Za-z0-9_]{0,64}$/;` | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "mermaid.secure holding a key over 64 characters"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M54 | mermaid.secure: a top-level key, no dotted path | `src/enhance/options.ts` | `const CONFIG_KEY = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;` → `const CONFIG_KEY = /^[A-Za-z][A-Za-z0-9_.]{0,63}$/;` | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "mermaid.secure holding a dotted key"; "through enhance(), every one rejects invalid-options and the root is untouched" |
| L2-T5-M55 | mermaid.secure: each key once | `src/enhance/options.ts` | `if (!out.includes(k)) out.push(k);` → `out.push(k);` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each option given, each normalized" |
| L2-T5-M56 | mermaid.secure: frozen | `src/enhance/options.ts` | `return Object.freeze(out);` → `return out;` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "what features read is frozen: chrome, the mermaid limits and keys, commits and their entries" |
| L2-T5-M57 | lens: its values | `src/enhance/options.ts` | `lens: ['all', 'product'],` → `lens: ['all', 'product', 'loud'],` | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "defaults to all, the first of its values"; "a stored lens is restored; an invalid one is ignored; an explicit one wins"; "setEnhancementPrefs stores it with the prefs, and refuses a bad value" |
| L2-T5-M58 | options: every own property is read, a non-enumerable one too | `src/enhance/options.ts` | `const names = Object.getOwnPropertyNames(v);` → `const names: string[] = []; ⏎   for (const k in v) names.push(k);` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a non-enumerable own option is still read" |
| L2-T5-M59 | options: a getter refused unread (new keys and nested objects) | `src/enhance/options.ts` | `` if (!('value' in d)) throw invalid(`${where}.${k} must be a plain value, not a getter`); `` → `if (!('value' in d)) { ⏎       out[k] = d.get?.call(v); ⏎       continue; ⏎     }` | `test/enhance-options.test.ts`: 20 failed \| 131 passed (151). "a getter for posKey"; "a getter for keyboard"; "a getter for chrome"; "a getter for rules"; "a getter for initialHash"; and 15 more |
| L2-T5-M98 | options: an inherited property is never read (own names and own descriptors both) | `src/enhance/options.ts` | `const names = Object.getOwnPropertyNames(v); ⏎   const unknown = names.filter((k) => !allowed.includes(k)); ⏎…` → `const names: string[] = []; ⏎   for (const k in v) names.push(k); ⏎   const unknown = names.filter((k) => !al…` | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "inherited properties are not options: not read, not refused"; "a non-enumerable own option is still read" |
| L2-T5-M99 | a key: at most 1024 code units (storageKey, posKey) | `src/enhance/options.ts` | `return typeof v === 'string' && v !== '' && v.length <= LIMITS.key;` → `return typeof v === 'string' && v !== '';` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "posKey and storageKey: at most 1024 code units, the bound inclusive; a longer key is refused" |
| L2-T5-M100 | a key: the 1024 bound is inclusive | `src/enhance/options.ts` | `v.length <= LIMITS.key;` → `v.length < LIMITS.key;` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "posKey and storageKey: at most 1024 code units, the bound inclusive; a longer key is refused" |
| L2-T5-M101 | storageKey: a non-empty string, bounded | `src/enhance/options.ts` | `` if (storageKey !== undefined && !isKey(storageKey)) throw invalid(`storageKey must be a non-empty string of a… `` → (deleted) | `test/enhance-options.test.ts` + `test/enhance-lifecycle.test.ts`: 2 failed \| 192 passed (194). "posKey and storageKey: at most 1024 code units, the bound inclusive; a longer key is refused"; "bad options reject invalid-options and reserve nothing: the root is untouched, and enhance(root) then works" |
| L2-T5-M102 | a key: the bound is 1024 | `src/enhance/options.ts` | `key: 1024,` → `key: 2048,` | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "posKey and storageKey: at most 1024 code units, the bound inclusive; a longer key is refused"; "each stated bound is the one LIMITS holds" |
| L2-T5-M103 | info.frontList: read by index, never through the list's own methods | `src/enhance/options.ts` | `return firstItems(v, LIMITS.frontList).map(frontEntry);` → `return v.map(frontEntry);` | `test/enhance-options.test.ts`: 4 failed \| 147 passed (151). "an own map on the list is never called: its entries are read by index"; "a getter at an index of the list or of vals is never called: the entry is refused"; "a hole is refused, not filled from Array.prototype"; "the list keeps its first 40 entries and each vals its first 300 items, as render() bounds them; none past is read" |
| L2-T5-M104 | info.frontList: its first 40 entries, none past them read | `src/enhance/options.ts` | `return firstItems(v, LIMITS.frontList).map(frontEntry);` → `return firstItems(v, v.length).map(frontEntry);` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "the list keeps its first 40 entries and each vals its first 300 items, as render() bounds them; none past is read" |
| L2-T5-M105 | info.frontList: vals read by index, never through its own iterator or methods | `src/enhance/options.ts` | `const items = Array.isArray(vals) ? firstItems(vals, LIMITS.frontVals) : null;` → `const items = Array.isArray(vals) ? [...(vals as unknown[])] : null;` | `test/enhance-options.test.ts`: 4 failed \| 147 passed (151). "an own iterator or every on vals is never called: its items are read by index"; "a getter at an index of the list or of vals is never called: the entry is refused"; "a hole is refused, not filled from Array.prototype"; "the list keeps its first 40 entries and each vals its first 300 items, as render() bounds them; none past is read" |
| L2-T5-M106 | info.frontList: vals keeps its first 300 items, none past them read | `src/enhance/options.ts` | `const items = Array.isArray(vals) ? firstItems(vals, LIMITS.frontVals) : null;` → `const items = Array.isArray(vals) ? firstItems(vals, vals.length) : null;` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "the list keeps its first 40 entries and each vals its first 300 items, as render() bounds them; none past is read" |
| L2-T5-M107 | info.frontList: every vals item a string | `src/enhance/options.ts` | `\|\| strings.length !== items.length) {` → `) {` | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "an own iterator or every on vals is never called: its items are read by index"; "a getter at an index of the list or of vals is never called: the entry is refused"; "a hole is refused, not filled from Array.prototype" |
| L2-T5-M108 | info.frontList: the entry bound is render()'s, 40 | `src/enhance/options.ts` | `frontList: 40,` → `frontList: 41,` | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "the list keeps its first 40 entries and each vals its first 300 items, as render() bounds them; none past is read"; "each stated bound is the one LIMITS holds" |
| L2-T5-M109 | info.frontList: the vals bound is render()'s, 300 | `src/enhance/options.ts` | `frontVals: 300,` → `frontVals: 301,` | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "the list keeps its first 40 entries and each vals its first 300 items, as render() bounds them; none past is read"; "each stated bound is the one LIMITS holds" |
| L2-T5-M110 | a sha in lower case: info.sha and info.only | `src/enhance/options.ts` | `return v.toLowerCase(); ⏎ }` → `return v; ⏎ }` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a sha given in upper case is kept in lower case, wherever it is read" |
| L2-T5-M111 | a sha in lower case: a commit's sha | `src/enhance/options.ts` | `return Object.freeze({ sha: sha.toLowerCase(), subject: cut(subject, LIMITS.subject), date, parents: Object.f…` → `return Object.freeze({ sha, subject: cut(subject, LIMITS.subject), date, parents: Object.freeze(kept) });` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a sha given in upper case is kept in lower case, wherever it is read" |
| L2-T5-M112 | a sha in lower case: a commit's parents | `src/enhance/options.ts` | `return p.toLowerCase();` → `return p;` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a sha given in upper case is kept in lower case, wherever it is read" |
| L2-T5-M113 | a commit: its sha read as own data, a getter never called | `src/enhance/options.ts` | `const sha = ownValue(e, 'sha');` → `const sha = e['sha'];` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a getter on a commit entry, its parents or a secure key is never called: the entry is refused" |
| L2-T5-M114 | a commit: its subject read as own data, a getter never called | `src/enhance/options.ts` | `const subject = ownValue(e, 'subject');` → `const subject = e['subject'];` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a getter on a commit entry's subject is never called: the entry is refused" |
| L2-T5-M115 | a commit: its date read as own data, a getter never called | `src/enhance/options.ts` | `const date = ownValue(e, 'date');` → `const date = e['date'];` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a getter on a commit entry's date is never called: the entry is refused" |
| L2-T5-M116 | a commit: its parents read as own data, a getter never called | `src/enhance/options.ts` | `const parents = ownValue(e, 'parents');` → `const parents = e['parents'];` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a getter on a commit entry's parents is never called: the entry is refused" |
| L2-T5-M117 | an array item read as own data: a getter never called, a hole never inherited | `src/enhance/options.ts` | `for (let i = 0; i < n; i += 1) out.push(ownValue(v, String(i)));` → `for (let i = 0; i < n; i += 1) out.push(v[i]);` | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "a getter on a commit entry, its parents or a secure key is never called: the entry is refused"; "a getter at an index of the list or of vals is never called: the entry is refused"; "a hole is refused, not filled from Array.prototype" |
| L2-T5-M118 | an array read to its bound only | `src/enhance/options.ts` | `const n = Math.min(v.length, max);` → `const n = v.length;` | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "the list keeps its first 40 entries and each vals its first 300 items, as render() bounds them; none past is read"; "info.commits keeps its first 100 entries, and no entry past them is read"; "a date of 64 characters is kept; parents keep their first 16, and read none past them" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T5-M1",
    "guard": "posKey: a non-empty string",
    "file": "src/enhance/options.ts",
    "old": "  if (posKey !== undefined && !isKey(posKey)) throw invalid(`posKey must be a non-empty string of at most ${String(LIMITS.key)} code units`);\n",
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
    "guard": "defence in depth, not seen by a feature: a bound callback is frozen",
    "file": "src/enhance/options.ts",
    "old": "  return Object.freeze({ fn: v as (...args: never[]) => unknown, self });",
    "new": "  return ({ fn: v as (...args: never[]) => unknown, self });",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M15",
    "guard": "defence in depth, not seen by a feature: the callbacks record is frozen",
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
    "old": "  return Object.freeze({ sha: sha.toLowerCase(), subject: cut(subject, LIMITS.subject), date, parents: Object.freeze(kept) });",
    "new": "  return Object.freeze({ sha: sha.toLowerCase(), subject, date, parents: Object.freeze(kept) });",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M40",
    "guard": "a commit: frozen",
    "file": "src/enhance/options.ts",
    "old": "  return Object.freeze({ sha: sha.toLowerCase(), subject: cut(subject, LIMITS.subject), date, parents: Object.freeze(kept) });",
    "new": "  return ({ sha: sha.toLowerCase(), subject: cut(subject, LIMITS.subject), date, parents: Object.freeze(kept) });",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M41",
    "guard": "a commit: its parents frozen",
    "file": "src/enhance/options.ts",
    "old": "  return Object.freeze({ sha: sha.toLowerCase(), subject: cut(subject, LIMITS.subject), date, parents: Object.freeze(kept) });",
    "new": "  return Object.freeze({ sha: sha.toLowerCase(), subject: cut(subject, LIMITS.subject), date, parents: kept });",
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
  },
  {
    "id": "L2-T5-M99",
    "guard": "a key: at most 1024 code units (storageKey, posKey)",
    "file": "src/enhance/options.ts",
    "old": "  return typeof v === 'string' && v !== '' && v.length <= LIMITS.key;",
    "new": "  return typeof v === 'string' && v !== '';",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M100",
    "guard": "a key: the 1024 bound is inclusive",
    "file": "src/enhance/options.ts",
    "old": "v.length <= LIMITS.key;",
    "new": "v.length < LIMITS.key;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M101",
    "guard": "storageKey: a non-empty string, bounded",
    "file": "src/enhance/options.ts",
    "old": "  if (storageKey !== undefined && !isKey(storageKey)) throw invalid(`storageKey must be a non-empty string of at most ${String(LIMITS.key)} code units`);\n",
    "new": "",
    "tests": "test/enhance-options.test.ts test/enhance-lifecycle.test.ts"
  },
  {
    "id": "L2-T5-M102",
    "guard": "a key: the bound is 1024",
    "file": "src/enhance/options.ts",
    "old": "  key: 1024,",
    "new": "  key: 2048,",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M103",
    "guard": "info.frontList: read by index, never through the list's own methods",
    "file": "src/enhance/options.ts",
    "old": "  return firstItems(v, LIMITS.frontList).map(frontEntry);",
    "new": "  return v.map(frontEntry);",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M104",
    "guard": "info.frontList: its first 40 entries, none past them read",
    "file": "src/enhance/options.ts",
    "old": "  return firstItems(v, LIMITS.frontList).map(frontEntry);",
    "new": "  return firstItems(v, v.length).map(frontEntry);",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M105",
    "guard": "info.frontList: vals read by index, never through its own iterator or methods",
    "file": "src/enhance/options.ts",
    "old": "  const items = Array.isArray(vals) ? firstItems(vals, LIMITS.frontVals) : null;",
    "new": "  const items = Array.isArray(vals) ? [...(vals as unknown[])] : null;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M106",
    "guard": "info.frontList: vals keeps its first 300 items, none past them read",
    "file": "src/enhance/options.ts",
    "old": "  const items = Array.isArray(vals) ? firstItems(vals, LIMITS.frontVals) : null;",
    "new": "  const items = Array.isArray(vals) ? firstItems(vals, vals.length) : null;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M107",
    "guard": "info.frontList: every vals item a string",
    "file": "src/enhance/options.ts",
    "old": " || strings.length !== items.length) {",
    "new": ") {",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M108",
    "guard": "info.frontList: the entry bound is render()'s, 40",
    "file": "src/enhance/options.ts",
    "old": "  frontList: 40,",
    "new": "  frontList: 41,",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M109",
    "guard": "info.frontList: the vals bound is render()'s, 300",
    "file": "src/enhance/options.ts",
    "old": "  frontVals: 300,",
    "new": "  frontVals: 301,",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M110",
    "guard": "a sha in lower case: info.sha and info.only",
    "file": "src/enhance/options.ts",
    "old": "  return v.toLowerCase();\n}",
    "new": "  return v;\n}",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M111",
    "guard": "a sha in lower case: a commit's sha",
    "file": "src/enhance/options.ts",
    "old": "  return Object.freeze({ sha: sha.toLowerCase(), subject: cut(subject, LIMITS.subject), date, parents: Object.freeze(kept) });",
    "new": "  return Object.freeze({ sha, subject: cut(subject, LIMITS.subject), date, parents: Object.freeze(kept) });",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M112",
    "guard": "a sha in lower case: a commit's parents",
    "file": "src/enhance/options.ts",
    "old": "    return p.toLowerCase();",
    "new": "    return p;",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M113",
    "guard": "a commit: its sha read as own data, a getter never called",
    "file": "src/enhance/options.ts",
    "old": "  const sha = ownValue(e, 'sha');",
    "new": "  const sha = e['sha'];",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M114",
    "guard": "a commit: its subject read as own data, a getter never called",
    "file": "src/enhance/options.ts",
    "old": "  const subject = ownValue(e, 'subject');",
    "new": "  const subject = e['subject'];",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M115",
    "guard": "a commit: its date read as own data, a getter never called",
    "file": "src/enhance/options.ts",
    "old": "  const date = ownValue(e, 'date');",
    "new": "  const date = e['date'];",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M116",
    "guard": "a commit: its parents read as own data, a getter never called",
    "file": "src/enhance/options.ts",
    "old": "  const parents = ownValue(e, 'parents');",
    "new": "  const parents = e['parents'];",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M117",
    "guard": "an array item read as own data: a getter never called, a hole never inherited",
    "file": "src/enhance/options.ts",
    "old": "  for (let i = 0; i < n; i += 1) out.push(ownValue(v, String(i)));",
    "new": "  for (let i = 0; i < n; i += 1) out.push(v[i]);",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M118",
    "guard": "an array read to its bound only",
    "file": "src/enhance/options.ts",
    "old": "  const n = Math.min(v.length, max);",
    "new": "  const n = v.length;",
    "tests": "test/enhance-options.test.ts"
  }
]
```

## Host adapters: `src/enhance/host.ts`

One wrapper per host callback. The test harness's `operate` only counts depth and operations and never refuses, so a row on the wrapper's own live check is seen there; the lifecycle rows below cover the wrapper and the instance's own `operate` together.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T5-M60 | absent: no call (synchronous) | `src/enhance/host.ts` | `if (bound === null \|\| !live()) return null;` → `if (!live()) return null;` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "absent: present is empty, each wrapper calls nothing, enters no operation and answers null" |
| L2-T5-M61 | not live: no call (synchronous) | `src/enhance/host.ts` | `if (bound === null \|\| !live()) return null;` → `if (bound === null) return null;` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "once not live, nothing is called and every wrapper answers null" |
| L2-T5-M62 | absent: no call (asynchronous) | `src/enhance/host.ts` | `if (bound === null \|\| !live()) return Promise.resolve(null);` → `if (!live()) return Promise.resolve(null);` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "absent: present is empty, each wrapper calls nothing, enters no operation and answers null" |
| L2-T5-M63 | not live: no call (asynchronous) | `src/enhance/host.ts` | `if (bound === null \|\| !live()) return Promise.resolve(null);` → `if (bound === null) return Promise.resolve(null);` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "once not live, nothing is called and every wrapper answers null" |
| L2-T5-M64 | inside an operation (synchronous) | `src/enhance/host.ts` | `const out = operate((): Called => {` → `const out = ((f: () => Called): Called => f())((): Called => {` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each callback runs inside an operation" |
| L2-T5-M65 | inside an operation (asynchronous) | `src/enhance/host.ts` | `const pending = operate((): Promise<unknown> \| null => {` → `const pending = ((f: () => Promise<unknown> \| null) => f())((): Promise<unknown> \| null => {` | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "each callback runs inside an operation"; "the then of a thenable the host returned is read inside the operation"; "a destroy from inside a callback waits for the call to return, then tears down; its reply is silenced" |
| L2-T5-M66 | a throw becomes null (synchronous) | `src/enhance/host.ts` | `return null; // swallowed: the host's failure is the feature's null` → `throw new Error('rethrown');` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a throw becomes null, for every callback" |
| L2-T5-M67 | a throw becomes null (asynchronous) | `src/enhance/host.ts` | `return null; ⏎       } ⏎     }); ⏎     if (pending === undefined` → `throw new Error('rethrown'); ⏎       } ⏎     }); ⏎     if (pending === undefined` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a throw becomes null, for every callback" |
| L2-T5-M68 | a rejection becomes null | `src/enhance/host.ts` | `(v) => (live() ? (keep ? v : undefined) : null), ⏎       () => null,` → `(v) => (live() ? (keep ? v : undefined) : null),` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a rejection becomes null; so does a thenable whose then throws, or whose then getter throws; nothing rejects" |
| L2-T5-M69 | a thenable's then read inside the operation | `src/enhance/host.ts` | `return new Promise<unknown>((resolve) => { ⏎           resolve(value); ⏎         });` → `return Promise.resolve().then(() => value);` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "the then of a thenable the host returned is read inside the operation" |
| L2-T5-M70 | a reply after the instance stopped being live is silenced | `src/enhance/host.ts` | `(v) => (live() ? (keep ? v : undefined) : null),` → `(v) => (keep ? v : undefined),` | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "a reply that settles after the instance stopped being live is silenced: null"; "a destroy from inside a callback waits for the call to return, then tears down; its reply is silenced"; "a reply after destroy is silenced on the real instance too" |
| L2-T5-M71 | copy answers undefined, not the host value | `src/enhance/host.ts` | `copy: (text: string) => callAsync('copy', [text], false),` → `copy: (text: string) => callAsync('copy', [text], true),` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "results are unknown: a value callback answers what the host returned, a void one undefined" |
| L2-T5-M72 | a void callback answers undefined, not the host value | `src/enhance/host.ts` | `const done = (c: Called): unknown => (c === null ? null : undefined);` → `const done = (c: Called): unknown => (c === null ? null : c.value);` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "results are unknown: a value callback answers what the host returned, a void one undefined" |
| L2-T5-M73 | itemLink answers the host's value | `src/enhance/host.ts` | `return c === null ? null : c.value;` → `return c === null ? null : undefined;` | `test/enhance-options.test.ts`: 4 failed \| 147 passed (151). "present is a frozen set of the callbacks given, in a fixed order; one that returns null is still present"; "a host function is called itself: its own call property is never read or run"; "a Function.prototype.call patched once the host is built sees none of its calls"; "results are unknown: a value callback answers what the host returned, a void one undefined" |
| L2-T5-M74 | the receiver (synchronous) | `src/enhance/host.ts` | `return { value: invoke(bound.fn, bound.self, ...args) };` → `return { value: invoke(bound.fn, undefined as never, ...args) };` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each callback gets its arguments, as fresh frozen objects, and the object it was read from as its receiver" |
| L2-T5-M75 | the receiver (asynchronous) | `src/enhance/host.ts` | `const value = invoke(bound.fn, bound.self, ...args);` → `const value = invoke(bound.fn, undefined as never, ...args);` | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "each callback gets its arguments, as fresh frozen objects, and the object it was read from as its receiver"; "a callback is called as a method of the options object" |
| L2-T5-M76 | openVersion gets a fresh frozen copy | `src/enhance/host.ts` | `done(call('openVersion', [Object.freeze({ sha: v.sha, only: v.only })])),` → `done(call('openVersion', [v])),` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each callback gets its arguments, as fresh frozen objects, and the object it was read from as its receiver" |
| L2-T5-M77 | onLink gets a fresh frozen copy | `src/enhance/host.ts` | `[href, Object.freeze({ newTab: how.newTab })]` → `[href, how]` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each callback gets its arguments, as fresh frozen objects, and the object it was read from as its receiver" |
| L2-T5-M78 | onHash gets a fresh frozen copy | `src/enhance/host.ts` | `[id, Object.freeze({ push: entry.push, from: entry.from })]` → `[id, entry]` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each callback gets its arguments, as fresh frozen objects, and the object it was read from as its receiver" |
| L2-T5-M79 | present: only the callbacks given | `src/enhance/host.ts` | `const names = Object.freeze(HOST_CALLBACKS.filter((n) => callbacks[n] !== null));` → `const names = Object.freeze(HOST_CALLBACKS.filter(() => true));` | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "absent: present is empty, each wrapper calls nothing, enters no operation and answers null"; "present is a frozen set of the callbacks given, in a fixed order; one that returns null is still present"; "ctx.host.present names the callbacks given; ctx.options holds no host function" |
| L2-T5-M80 | present: its names frozen | `src/enhance/host.ts` | `const names = Object.freeze(HOST_CALLBACKS.filter((n) => callbacks[n] !== null));` → `const names = HOST_CALLBACKS.filter((n) => callbacks[n] !== null);` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "present is a frozen set of the callbacks given, in a fixed order; one that returns null is still present" |
| L2-T5-M81 | present: has() answers from the names | `src/enhance/host.ts` | `has: (name: HostCallback): boolean => names.includes(name)` → `has: (): boolean => true` | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "absent: present is empty, each wrapper calls nothing, enters no operation and answers null"; "present is a frozen set of the callbacks given, in a fixed order; one that returns null is still present" |
| L2-T5-M82 | present: frozen | `src/enhance/host.ts` | `const present: Present = Object.freeze({` → `const present: Present = ({` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "present is a frozen set of the callbacks given, in a fixed order; one that returns null is still present" |
| L2-T5-M83 | the host: frozen | `src/enhance/host.ts` | `return Object.freeze({ ⏎     present,` → `return ({ ⏎     present,` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "present is a frozen set of the callbacks given, in a fixed order; one that returns null is still present" |
| L2-T5-M119 | the host's function is called itself, never its own call property (synchronous) | `src/enhance/host.ts` | `return { value: invoke(bound.fn, bound.self, ...args) };` → `return { value: (bound.fn as (...a: unknown[]) => unknown).call(bound.self, ...args) };` | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "a host function is called itself: its own call property is never read or run"; "a Function.prototype.call patched once the host is built sees none of its calls" |
| L2-T5-M120 | the host's function is called itself, never its own call property (asynchronous) | `src/enhance/host.ts` | `const value = invoke(bound.fn, bound.self, ...args);` → `const value = (bound.fn as (...a: unknown[]) => unknown).call(bound.self, ...args);` | `test/enhance-options.test.ts`: 2 failed \| 149 passed (151). "a host function is called itself: its own call property is never read or run"; "a Function.prototype.call patched once the host is built sees none of its calls" |
| L2-T5-M121 | the language's call is captured when the host is built, not read at each call | `src/enhance/host.ts` | `const invoke = intrinsicCall.bind(intrinsicCall);` → `const invoke = (fn: BoundCallback['fn'], self: object, ...args: readonly unknown[]): unknown => intrinsicCall…` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a Function.prototype.call patched once the host is built sees none of its calls" |
| L2-T5-M122 | a synchronous reply from a callback that destroyed the instance is silenced | `src/enhance/host.ts` | `return out === undefined \|\| !live() ? null : out;` → `return out ?? null;` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a synchronous callback that destroys the instance itself answers null, as an asynchronous one does" |

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
    "old": "        return { value: invoke(bound.fn, bound.self, ...args) };",
    "new": "        return { value: invoke(bound.fn, undefined as never, ...args) };",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M75",
    "guard": "the receiver (asynchronous)",
    "file": "src/enhance/host.ts",
    "old": "        const value = invoke(bound.fn, bound.self, ...args);",
    "new": "        const value = invoke(bound.fn, undefined as never, ...args);",
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
  },
  {
    "id": "L2-T5-M119",
    "guard": "the host's function is called itself, never its own call property (synchronous)",
    "file": "src/enhance/host.ts",
    "old": "        return { value: invoke(bound.fn, bound.self, ...args) };",
    "new": "        return { value: (bound.fn as (...a: unknown[]) => unknown).call(bound.self, ...args) };",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M120",
    "guard": "the host's function is called itself, never its own call property (asynchronous)",
    "file": "src/enhance/host.ts",
    "old": "        const value = invoke(bound.fn, bound.self, ...args);",
    "new": "        const value = (bound.fn as (...a: unknown[]) => unknown).call(bound.self, ...args);",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M121",
    "guard": "the language's call is captured when the host is built, not read at each call",
    "file": "src/enhance/host.ts",
    "old": "  const invoke = intrinsicCall.bind(intrinsicCall);",
    "new": "  const invoke = (fn: BoundCallback['fn'], self: object, ...args: readonly unknown[]): unknown => intrinsicCall.call(fn, self, ...args);",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M122",
    "guard": "a synchronous reply from a callback that destroyed the instance is silenced",
    "file": "src/enhance/host.ts",
    "old": "    return out === undefined || !live() ? null : out;",
    "new": "    return out ?? null;",
    "tests": "test/enhance-options.test.ts"
  }
]
```

## Lifecycle, state, README and walls

The wiring into the instance, the `lens` pref, the README pins (each option listed, and each stated default, bound and note checked against the code), and the wall that refuses the plan's name `history` (why the field is `info.commits`).

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T5-M84 | the host functions stay off ctx.options | `src/enhance/lifecycle.ts` | `const { callbacks, ...options } = opts;` → `const { callbacks } = opts; ⏎   const options = opts;` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "ctx.host.present names the callbacks given; ctx.options holds no host function" |
| L2-T5-M85 | the host's live check is the instance's | `src/enhance/lifecycle.ts` | `host: createHost(callbacks, live, operateHere),` → `host: createHost(callbacks, () => true, operateHere),` | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "a destroy from inside a callback waits for the call to return, then tears down; its reply is silenced"; "a synchronous callback that destroys the instance itself answers null, as an asynchronous one does"; "a reply after destroy is silenced on the real instance too" |
| L2-T5-M86 | the host's operation is the instance's | `src/enhance/lifecycle.ts` | `host: createHost(callbacks, live, operateHere),` → `host: createHost(callbacks, live, (fn) => fn()),` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a destroy from inside a callback waits for the call to return, then tears down; its reply is silenced" |
| L2-T5-M87 | ctx.info.sha | `src/enhance/lifecycle.ts` | `sha: info?.sha ?? null,` → `sha: null,` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "ctx.info carries sha, draft, commits and only, with their defaults" |
| L2-T5-M88 | ctx.info.draft: default false | `src/enhance/lifecycle.ts` | `draft: info?.draft ?? false,` → `draft: info?.draft ?? true,` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "ctx.info carries sha, draft, commits and only, with their defaults" |
| L2-T5-M89 | ctx.info.commits | `src/enhance/lifecycle.ts` | `commits: info?.commits ?? null,` → `commits: null,` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "ctx.info carries sha, draft, commits and only, with their defaults" |
| L2-T5-M90 | ctx.info.only | `src/enhance/lifecycle.ts` | `only: info?.only ?? null,` → `only: null,` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "ctx.info carries sha, draft, commits and only, with their defaults" |
| L2-T5-M91 | lens: restored from the stored prefs | `src/enhance/state.ts` | `for (const name of prefNames()) {` → `for (const name of ['theme', 'width', 'font'] as const) {` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a stored lens is restored; an invalid one is ignored; an explicit one wins" |
| L2-T5-M92 | lens: a change of the prefs in force | `src/enhance/state.ts` | `const changed = prefNames().some((name) => next[name] !== prefs[name]);` → `const changed = next.theme !== prefs.theme \|\| next.width !== prefs.width \|\| next.font !== prefs.font;` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "a lens change is a change of the prefs in force" |
| L2-T5-M93 | lens: default all | `src/enhance/state.ts` | `lens: PREF_VALUES.lens[0] };` → `lens: PREF_VALUES.lens[1] };` | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "defaults to all, the first of its values"; "a stored lens is restored; an invalid one is ignored; an explicit one wins"; "a lens change is a change of the prefs in force" |
| L2-T5-M94 | README: every option listed, each with its default | `README.md` | `` \| `posKey` \| `storageKey` \| `` → `` \| posKey \| `storageKey` \| `` | `test/enhance-options.test.ts`: 3 failed \| 148 passed (151). "lists every option once, each with a default"; "each stated default is the one normalizeOptions applies"; "each stated bound is the one LIMITS holds" |
| L2-T5-M95 | README: the reserved position and UI keys | `README.md` | `` \| `docreader:pos:<posKey>` \| `` → `` \| `docreader:position:<posKey>` \| `` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "names the lens pref and its values, and the reserved position and UI keys" |
| L2-T5-M96 | README: the lens pref and its values | `README.md` | `` `lens`: `all` or `product` `` → `` `lens`: one of `all` and `product` `` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "names the lens pref and its values, and the reserved position and UI keys" |
| L2-T5-M97 | walls: the field is not named history (why info.commits) | `src/enhance/types.ts` | `readonly commits?: readonly CommitEntry[] \| null;` → `readonly history?: readonly CommitEntry[] \| null;` | `test/enhance-walls.test.ts`: 1 failed \| 10 passed (11). "no source file names a forbidden identifier, a selector with # or built at run time, or a style string" |
| L2-T5-M123 | README: the stated default of keyboard | `README.md` | `` \| `keyboard` \| `true` \| `` → `` \| `keyboard` \| `false` \| `` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each stated default is the one normalizeOptions applies" |
| L2-T5-M124 | README: the stated default of rules | `README.md` | `` \| `rules` \| `false` \| `` → `` \| `rules` \| `true` \| `` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each stated default is the one normalizeOptions applies" |
| L2-T5-M125 | README: the stated default of folds | `README.md` | `` \| `folds` \| `true` \| `` → `` \| `folds` \| `false` \| `` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each stated default is the one normalizeOptions applies" |
| L2-T5-M126 | README: the stated default of chrome | `README.md` | `` \| `chrome` \| each `true` \| `` → `` \| `chrome` \| each `false` \| `` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each stated default is the one normalizeOptions applies" |
| L2-T5-M127 | README: the stated default of posKey | `README.md` | `` \| `posKey` \| `storageKey` \| `` → `` \| `posKey` \| none \| `` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each stated default is the one normalizeOptions applies" |
| L2-T5-M128 | README: the stated bound, commits kept | `README.md` | `Only the first 100 commits` → `Only the first 101 commits` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each stated bound is the one LIMITS holds" |
| L2-T5-M129 | README: the stated bound, the subject's cut | `README.md` | `a subject is cut to 200 code units` → `a subject is cut to 201 code units` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each stated bound is the one LIMITS holds" |
| L2-T5-M130 | README: the stated bound, parents kept | `README.md` | `the first 16 parents are kept` → `the first 17 parents are kept` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each stated bound is the one LIMITS holds" |
| L2-T5-M131 | README: the stated bound, the date's bound | `README.md` | `a date over 64 code units` → `a date over 65 code units` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each stated bound is the one LIMITS holds" |
| L2-T5-M132 | README: the stated bound, frontList entries kept | `README.md` | `` `frontList` keeps its first 40 entries `` → `` `frontList` keeps its first 41 entries `` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each stated bound is the one LIMITS holds" |
| L2-T5-M133 | README: the stated bound, vals items kept | `README.md` | `` each `vals` its first 300 items `` → `` each `vals` its first 301 items `` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each stated bound is the one LIMITS holds" |
| L2-T5-M134 | README: the stated bound, maxTextSize's bound | `README.md` | `(an integer from 1 to 1048576)` → `(an integer from 1 to 1048575)` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each stated bound is the one LIMITS holds" |
| L2-T5-M135 | README: the stated bound, maxEdges's bound | `README.md` | `(from 1 to 50000)` → `(from 1 to 5000)` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each stated bound is the one LIMITS holds" |
| L2-T5-M136 | README: the stated bound, secure's count | `README.md` | `` `secure` lists up to 64 configuration keys `` → `` `secure` lists up to 32 configuration keys `` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each stated bound is the one LIMITS holds" |
| L2-T5-M137 | README: the stated bound, initialHash's bound | `README.md` | `and one over 1024 code units is ignored` → `and one over 2048 code units is ignored` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each stated bound is the one LIMITS holds" |
| L2-T5-M138 | README: the stated bound, posKey's bound | `README.md` | `(per tab, say): a non-empty string of at most 1024 code units` → `(per tab, say): a non-empty string of at most 4096 code units` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each stated bound is the one LIMITS holds" |
| L2-T5-M139 | README: the stated bound, storageKey's bound | `README.md` | `` `project-a:specs:example.md`: a non-empty string of at most 1024 code units `` → `` `project-a:specs:example.md`: a non-empty string of at most 4096 code units `` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "each stated bound is the one LIMITS holds" |
| L2-T5-M140 | README: the note names each option not acted on yet | `README.md` | `` `posKey`, `keyboard`, `chrome`, `rules`, `initialHash`, `mermaid`, the host callbacks `` → `` `posKey`, `chrome`, `rules`, `initialHash`, `mermaid`, the host callbacks `` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "says which options this version reads and checks but does not act on yet" |
| L2-T5-M141 | README: the ownership rules stand apart from the host callbacks | `README.md` | `and the reply is ignored. ⏎  ⏎ One root has one owner:` → `and the reply is ignored. One root has one owner:` | `test/enhance-options.test.ts`: 1 failed \| 150 passed (151). "keeps the ownership rules out of the host callbacks paragraph" |

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
  },
  {
    "id": "L2-T5-M123",
    "guard": "README: the stated default of keyboard",
    "file": "README.md",
    "old": "| `keyboard` | `true` |",
    "new": "| `keyboard` | `false` |",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M124",
    "guard": "README: the stated default of rules",
    "file": "README.md",
    "old": "| `rules` | `false` |",
    "new": "| `rules` | `true` |",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M125",
    "guard": "README: the stated default of folds",
    "file": "README.md",
    "old": "| `folds` | `true` |",
    "new": "| `folds` | `false` |",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M126",
    "guard": "README: the stated default of chrome",
    "file": "README.md",
    "old": "| `chrome` | each `true` |",
    "new": "| `chrome` | each `false` |",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M127",
    "guard": "README: the stated default of posKey",
    "file": "README.md",
    "old": "| `posKey` | `storageKey` |",
    "new": "| `posKey` | none |",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M128",
    "guard": "README: the stated bound, commits kept",
    "file": "README.md",
    "old": "Only the first 100 commits",
    "new": "Only the first 101 commits",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M129",
    "guard": "README: the stated bound, the subject's cut",
    "file": "README.md",
    "old": "a subject is cut to 200 code units",
    "new": "a subject is cut to 201 code units",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M130",
    "guard": "README: the stated bound, parents kept",
    "file": "README.md",
    "old": "the first 16 parents are kept",
    "new": "the first 17 parents are kept",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M131",
    "guard": "README: the stated bound, the date's bound",
    "file": "README.md",
    "old": "a date over 64 code units",
    "new": "a date over 65 code units",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M132",
    "guard": "README: the stated bound, frontList entries kept",
    "file": "README.md",
    "old": "`frontList` keeps its first 40 entries",
    "new": "`frontList` keeps its first 41 entries",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M133",
    "guard": "README: the stated bound, vals items kept",
    "file": "README.md",
    "old": "each `vals` its first 300 items",
    "new": "each `vals` its first 301 items",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M134",
    "guard": "README: the stated bound, maxTextSize's bound",
    "file": "README.md",
    "old": "(an integer from 1 to 1048576)",
    "new": "(an integer from 1 to 1048575)",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M135",
    "guard": "README: the stated bound, maxEdges's bound",
    "file": "README.md",
    "old": "(from 1 to 50000)",
    "new": "(from 1 to 5000)",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M136",
    "guard": "README: the stated bound, secure's count",
    "file": "README.md",
    "old": "`secure` lists up to 64 configuration keys",
    "new": "`secure` lists up to 32 configuration keys",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M137",
    "guard": "README: the stated bound, initialHash's bound",
    "file": "README.md",
    "old": "and one over 1024 code units is ignored",
    "new": "and one over 2048 code units is ignored",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M138",
    "guard": "README: the stated bound, posKey's bound",
    "file": "README.md",
    "old": "(per tab, say): a non-empty string of at most 1024 code units",
    "new": "(per tab, say): a non-empty string of at most 4096 code units",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M139",
    "guard": "README: the stated bound, storageKey's bound",
    "file": "README.md",
    "old": "`project-a:specs:example.md`: a non-empty string of at most 1024 code units",
    "new": "`project-a:specs:example.md`: a non-empty string of at most 4096 code units",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M140",
    "guard": "README: the note names each option not acted on yet",
    "file": "README.md",
    "old": "`posKey`, `keyboard`, `chrome`, `rules`, `initialHash`, `mermaid`, the host callbacks",
    "new": "`posKey`, `chrome`, `rules`, `initialHash`, `mermaid`, the host callbacks",
    "tests": "test/enhance-options.test.ts"
  },
  {
    "id": "L2-T5-M141",
    "guard": "README: the ownership rules stand apart from the host callbacks",
    "file": "README.md",
    "old": "and the reply is ignored.\n\nOne root has one owner:",
    "new": "and the reply is ignored. One root has one owner:",
    "tests": "test/enhance-options.test.ts"
  }
]
```
