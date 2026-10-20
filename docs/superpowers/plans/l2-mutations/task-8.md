# L2 Task 8: mutation rows (vocabulary and namespace options)

Each guard of Task 8, deleted or inverted once, with the tests that go red: the `vocabulary` option
(`src/enhance/options.ts`), the namespace and the four storage keys (`src/enhance/options.ts`, `src/enhance/state.ts`),
the merge and the format contract (`src/enhance/vocab.ts`), the item link and editorial.ts's reading of the format
contract (`src/enhance/editorial.ts`), the README's two rows, and the guards of the review round's fixes. Measured
2026-10-20 on branch `l2-t8-vocab`, on commit `f2f5569`, every row, L2-T8-M1 to L2-T8-M187. 184 were measured red
(`rc=1`); three are reported (below), green with their guard kept.

**Method.** The L1 plan's `mutate.mjs` (Task 1, Step 8) with the two changes its results section records (a 512 MiB
output buffer, and a run that ends with no exit status reported as KILLED and counted as no verdict). Each row is
applied to its own throwaway copy of the working tree (tracked and untracked files, never ignored ones, `node_modules`
linked from the checkout), its test file runs there with the local `vitest`, and the copy is deleted. Each `old`
occurs exactly once in its file. Every row's tests are `test/enhance-vocab.test.ts` (142 cases): Task 8 has no browser
tests and no Level 2 cases, and the rows ran with `DOCREADER_BROWSERS=chromium` all the same. They ran one at a time,
in batches: the 143 rows the review round left as they were in eight batches of at most 20, its 42 new or reworked
rows in six batches of at most 8, and the three reported rows once more. The checkout was never edited: `git status --porcelain` read the same (empty) before and
after, and so did `HEAD` and the hash of `git diff`. The Red column gives the count line and the failing tests the run
printed (at most five here, with the number of others; the run prints at most 20 failing lines). Every count line
adds up to its total.

Notes on the measurement.
- A first pass over the rows, on the tree before the last commit, left three green. L2-T8-M119 (the delta route reads
  the first line that is not blank) was green because its case's block, once rendered, opened on its `item:` line
  (`render()` drops an empty first line), which a first-line reading finds too: the block now opens with a line of
  spaces, which `render()` keeps, and the row is red here. L2-T8-M123 and L2-T8-M124 are the two reported rows.
- The same commit removed the byline route's check that no delta was found: with a delta the item fact shows the
  delta's link and keeps no nodes of its own to link, so no case could tell the check from its absence. No row names
  it.
- The two reported rows are the `live()` checks right after the item link's host calls. The host wrapper (Task 5)
  answers null for a call that destroyed the instance and makes no call once it is not live, and the journal refuses
  every write after a destroy (a split by throwing, which the lifecycle reports as the same abort), so no case can
  observe either check. Each is kept for the plan's rule that
  `live()` is checked after each call-out, and is reported here rather than dropped. Neither is in its section's JSON
  fence, so a run of the fences reports no green row.
- L2-T8-M153 and M154 mutate the README, which is not this task's file (see the PR): they pin the two rows the options
  table had to gain.
- The review round reworked nine rows in place, because the lines they mutate changed: L2-T8-M35 to M37 (the word
  check, which now refuses white space at either end; M37 is now the empty word alone, and L2-T8-M155 the edges),
  L2-T8-M135 (the bounds gained `links`), L2-T8-M140 and M141 (the link check now names C0, C1 and `\s`; M140 is
  now white space), and L2-T8-M148 to M150 (the click handler is now the byline's one delegated listener). Their ids
  are kept; their changes and results are this commit's.
- In the review round's first pass two of its rows were green. L2-T8-M170 (a blocking word is whole) because its
  case's word ended in "!", so no letter could follow it: the case now holds a word ending in a letter. L2-T8-M182 (a
  click routes the link it is in) because its only case clicked the arrow with Ctrl held, which the root's own link
  listener (nav.ts) answers with the same new-tab call: a plain click on the arrow, which nav.ts would answer without
  the new tab, is now its case. Both are red here.
- The review round's L2-T8-M185 (the item link only with `itemLink`) was green before it: the wrapper answers null for
  an absent callback. It is red here because the byline's click listener is now made whenever the item link is, and
  a case asserts that a reader given no `itemLink` puts none on the byline. L2-T8-M186, the early return after the
  byline route, is the third reported row (in its section).

## The `vocabulary` option: `src/enhance/options.ts` (L2-T8-M1 to L2-T8-M41)

The two option keys; the vocabulary read as own data fields (an unknown key, a getter or a wrong type refused,
inherited properties ignored); each list and group kept when given, and only the lists vocab.ts calls options
(`rulingHeaders` and `attention.openStatus` among them, C48); `ids: false`; a list as an array of at most 200 words,
refused over its bound before any item is read, read by index; a word as a string of 1 to 64 code units, not all white
space; duplicates dropped; and every list, group and grammar frozen.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T8-M1 | vocabulary is an option | `src/enhance/options.ts` | `  'vocabulary', 'namespace', ⏎ ];` → `  'namespace', ⏎ ];` | `test/enhance-vocab.test.ts`: 114 failed \| 28 passed (142). "left out, or empty, the vocabulary is the defaults"; "each field given replaces its default whole; every other list keeps its own"; "a group given in part keeps the default of each list it leaves out"; "ids: false is no IDs at all; an empty object is the default grammar; prefixes replace the capitals"; "the rulings of C48: rulingHeaders and attention.openStatus are options; decisionHeaders is the format contract" (and 15 more printed) |
| L2-T8-M2 | namespace is an option | `src/enhance/options.ts` | `  'vocabulary', 'namespace', ⏎ ];` → `  'vocabulary', ⏎ ];` | `test/enhance-vocab.test.ts`: 18 failed \| 124 passed (142). "the default is docreader, and the four keys are its"; "through enhance(): the prefs and the folds come from the namespace's keys, and every key read or written carries it"; "two roots on one storage object under two namespaces keep two queues and never merge their prefs"; "a namespace refused: empty"; "a namespace refused: a capital" (and 13 more printed) |
| L2-T8-M3 | vocabulary: an object | `src/enhance/options.ts` | `  if (!isRecord(v)) throw invalid('vocabulary must be an object'); ⏎ ` → (deleted) | `test/enhance-vocab.test.ts`: 3 failed \| 139 passed (142). "refused: vocabulary an array"; "refused: vocabulary null"; "refused: vocabulary a string" |
| L2-T8-M4 | vocabulary: own data fields (unknown keys and getters refused, inherited ignored) | `src/enhance/options.ts` | `  const fields = ownFields('vocabulary', v, VOCABULARY_KEYS);` → `  const fields = v as Record<string, unknown>;` | `test/enhance-vocab.test.ts`: 7 failed \| 135 passed (142). "the rulings of C48: rulingHeaders and attention.openStatus are options; decisionHeaders is the format contract"; "refused: an unknown key"; "refused: a format-contract list"; "refused: a glossary list"; "a getter is refused unread, on the vocabulary, a group, a list and a word" (and 2 more printed) |
| L2-T8-M5 | vocabulary: rulingHeaders is an option (C48) | `src/enhance/options.ts` | `  'status', 'statusHeaders', 'rulingHeaders', 'attention',` → `  'status', 'statusHeaders', 'attention',` | `test/enhance-vocab.test.ts`: 4 failed \| 138 passed (142). "each field given replaces its default whole; every other list keeps its own"; "the rulings of C48: rulingHeaders and attention.openStatus are options; decisionHeaders is the format contract"; "the defaults reproduce the prototype's marks, given or left out"; "custom status-column headers, and ruling headers" |
| L2-T8-M6 | vocabulary: frozen | `src/enhance/options.ts` | `    if (f !== undefined) out[k] = wordList(`vocabulary.${k}`, f); ⏎   } ⏎   return Object.freeze(out…` → `    if (f !== undefined) out[k] = wordList(`vocabulary.${k}`, f); ⏎   } ⏎   return out;` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "left out, or empty, the vocabulary is the defaults"; "a list is copied, its duplicates dropped, and frozen with every group around it" |
| L2-T8-M7 | vocabulary: left out, an empty frozen object | `src/enhance/options.ts` | `  if (v === undefined) return Object.freeze({}); ⏎   if (!isRecord(v)) throw invalid('vocabulary mus…` → `  if (v === undefined) return {}; ⏎   if (!isRecord(v)) throw invalid('vocabulary must be an object'…` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "left out, or empty, the vocabulary is the defaults" |
| L2-T8-M8 | vocabulary: read from the options | `src/enhance/options.ts` | `    vocabulary: normalizeVocabulary(fields['vocabulary']),` → `    vocabulary: Object.freeze({}),` | `test/enhance-vocab.test.ts`: 84 failed \| 58 passed (142). "each field given replaces its default whole; every other list keeps its own"; "a group given in part keeps the default of each list it leaves out"; "ids: false is no IDs at all; an empty object is the default grammar; prefixes replace the capitals"; "the rulings of C48: rulingHeaders and attention.openStatus are options; decisionHeaders is the format contract"; "a list is copied, its duplicates dropped, and frozen with every group around it" (and 15 more printed) |
| L2-T8-M9 | vocabulary.status: kept | `src/enhance/options.ts` | `  if (fields['status'] !== undefined) out.status = wordGroup('vocabulary.status', fields['status'], …` → (deleted) | `test/enhance-vocab.test.ts`: 16 failed \| 126 passed (142). "each field given replaces its default whole; every other list keeps its own"; "a group given in part keeps the default of each list it leaves out"; "a list is copied, its duplicates dropped, and frozen with every group around it"; "every list is bounded: 200 words of 64 code units, the bounds inclusive"; "refused: status not an object" (and 11 more printed) |
| L2-T8-M10 | vocabulary.attention: kept | `src/enhance/options.ts` | `  if (fields['attention'] !== undefined) out.attention = wordGroup('vocabulary.attention', fields['a…` → (deleted) | `test/enhance-vocab.test.ts`: 7 failed \| 135 passed (142). "each field given replaces its default whole; every other list keeps its own"; "a group given in part keeps the default of each list it leaves out"; "a list is copied, its duplicates dropped, and frozen with every group around it"; "refused: attention not an object"; "refused: attention.open (named openAnswers)" (and 2 more printed) |
| L2-T8-M11 | vocabulary.plan: kept | `src/enhance/options.ts` | `  if (fields['plan'] !== undefined) out.plan = wordGroup('vocabulary.plan', fields['plan'], PLAN_KEY…` → (deleted) | `test/enhance-vocab.test.ts`: 6 failed \| 136 passed (142). "each field given replaces its default whole; every other list keeps its own"; "a group given in part keeps the default of each list it leaves out"; "a list is copied, its duplicates dropped, and frozen with every group around it"; "refused: plan not an object"; "refused: an unknown plan word" (and 1 more printed) |
| L2-T8-M12 | vocabulary.ids: kept | `src/enhance/options.ts` | `  if (ids !== undefined) out.ids = ids === false ? false : grammar('vocabulary.ids', ids, 'false or …` → (deleted) | `test/enhance-vocab.test.ts`: 13 failed \| 129 passed (142). "each field given replaces its default whole; every other list keeps its own"; "ids: false is no IDs at all; an empty object is the default grammar; prefixes replace the capitals"; "a list is copied, its duplicates dropped, and frozen with every group around it"; "refused: ids true"; "refused: ids null" (and 8 more printed) |
| L2-T8-M13 | vocabulary.ids: false is no IDs | `src/enhance/options.ts` | `out.ids = ids === false ? false : grammar('vocabulary.ids', ids, 'false or an object');` → `out.ids = grammar('vocabulary.ids', ids, 'false or an object');` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "ids: false is no IDs at all; an empty object is the default grammar; prefixes replace the capitals" |
| L2-T8-M14 | vocabulary.ruleIds: kept | `src/enhance/options.ts` | `  if (ruleIds !== undefined) out.ruleIds = grammar('vocabulary.ruleIds', ruleIds, 'an object'); ⏎ ` → (deleted) | `test/enhance-vocab.test.ts`: 7 failed \| 135 passed (142). "each field given replaces its default whole; every other list keeps its own"; "ids: false is no IDs at all; an empty object is the default grammar; prefixes replace the capitals"; "a list is copied, its duplicates dropped, and frozen with every group around it"; "refused: ruleIds false"; "refused: an unknown ruleIds key" (and 2 more printed) |
| L2-T8-M15 | vocabulary.statusHeaders: kept | `src/enhance/options.ts` | `const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemFields', 'item…` → `const LIST_KEYS = ['rulingHeaders', 'qualifiers', 'addressees', 'itemFields', 'itemHeadings'] as con…` | `test/enhance-vocab.test.ts`: 5 failed \| 137 passed (142). "each field given replaces its default whole; every other list keeps its own"; "refused: an empty word"; "refused: a word ending on a tab"; "custom status-column headers, and ruling headers"; "status-column headers: whole, in any script and any case; one ending in "?" needs no boundary after" |
| L2-T8-M16 | vocabulary.rulingHeaders: kept | `src/enhance/options.ts` | `const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemFields', 'item…` → `const LIST_KEYS = ['statusHeaders', 'qualifiers', 'addressees', 'itemFields', 'itemHeadings'] as con…` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "each field given replaces its default whole; every other list keeps its own"; "custom status-column headers, and ruling headers" |
| L2-T8-M17 | vocabulary.qualifiers: kept | `src/enhance/options.ts` | `const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemFields', 'item…` → `const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'addressees', 'itemFields', 'itemHeadings'] as …` | `test/enhance-vocab.test.ts`: 5 failed \| 137 passed (142). "each field given replaces its default whole; every other list keeps its own"; "a list is copied, its duplicates dropped, and frozen with every group around it"; "every list is bounded: 200 words of 64 code units, the bounds inclusive"; "refused: a list a string"; "addressees, qualifiers and the attention words: whole, in any script" |
| L2-T8-M18 | vocabulary.addressees: kept | `src/enhance/options.ts` | `const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemFields', 'item…` → `const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'itemFields', 'itemHeadings'] as …` | `test/enhance-vocab.test.ts`: 6 failed \| 136 passed (142). "each field given replaces its default whole; every other list keeps its own"; "a list over its bound is refused before any of its items is read"; "refused: a list an array-like object"; "refused: a word opening on a no-break space"; "a getter is refused unread, on the vocabulary, a group, a list and a word" (and 1 more printed) |
| L2-T8-M19 | vocabulary.itemFields: kept | `src/enhance/options.ts` | `const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemFields', 'item…` → `const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemHeadings'] as …` | `test/enhance-vocab.test.ts`: 30 failed \| 112 passed (142). "each field given replaces its default whole; every other list keeps its own"; "refused: a word a number"; "the key's own text moves into a link: href from itemLink, opened in a new tab, an arrow after it"; "every key in the fact: in its text, in its own code; never an author's link, a lower-case or a run-on key"; "a key named twice is asked for once and linked twice" (and 15 more printed) |
| L2-T8-M20 | vocabulary.itemHeadings: kept | `src/enhance/options.ts` | `const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemFields', 'item…` → `const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemFields'] as co…` | `test/enhance-vocab.test.ts`: 9 failed \| 133 passed (142). "each field given replaces its default whole; every other list keeps its own"; "refused: a heading ending on an ideographic space"; "refused: a hole"; "the delta's key replaces the item fact's value; the fact's own nodes stay in the hidden meta line"; "without an item fact the delta's key is a fact of its own, labelled by the first item field, before the wide ones" (and 4 more printed) |
| L2-T8-M21 | status: the four roles | `src/enhance/options.ts` | `const STATUS_KEYS = ['ok', 'wait', 'no', 'info'] as const;` → `const STATUS_KEYS = ['ok', 'wait', 'no'] as const;` | `test/enhance-vocab.test.ts`: 3 failed \| 139 passed (142). "each field given replaces its default whole; every other list keeps its own"; "the defaults reproduce the prototype's marks, given or left out"; "empty lists mark nothing" |
| L2-T8-M22 | attention: openStatus is an option (C48) | `src/enhance/options.ts` | `'blocking', 'risk', 'openStatus'] as const;` → `'blocking', 'risk'] as const;` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "each field given replaces its default whole; every other list keeps its own"; "the rulings of C48: rulingHeaders and attention.openStatus are options; decisionHeaders is the format contract" |
| L2-T8-M23 | plan: the owner label | `src/enhance/options.ts` | `const PLAN_KEYS = ['task', 'step', 'who'] as const;` → `const PLAN_KEYS = ['task', 'step'] as const;` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "each field given replaces its default whole; every other list keeps its own"; "a group given in part keeps the default of each list it leaves out" |
| L2-T8-M24 | a group: an object | `src/enhance/options.ts` | `  if (!isRecord(v)) throw invalid(`${where} must be an object`); ⏎   const fields = ownFields(where,…` → `  const fields = ownFields(where, v, keys);` | `test/enhance-vocab.test.ts`: 4 failed \| 138 passed (142). "refused: status not an object"; "refused: status null"; "refused: attention not an object"; "refused: plan not an object" |
| L2-T8-M25 | a group: own data fields | `src/enhance/options.ts` | `  const fields = ownFields(where, v, keys);` → `  const fields = v as Record<string, unknown>;` | `test/enhance-vocab.test.ts`: 5 failed \| 137 passed (142). "refused: an unknown status role"; "refused: attention.open (named openAnswers)"; "refused: an unknown plan word"; "a getter is refused unread, on the vocabulary, a group, a list and a word"; "inherited properties are not read: not the vocabulary's, a group's or a list's" |
| L2-T8-M26 | a group: a list left out keeps its default | `src/enhance/options.ts` | `    if (f !== undefined) out[k] = wordList(`${where}.${k}`, f);` → `    out[k] = wordList(`${where}.${k}`, f);` | `test/enhance-vocab.test.ts`: 11 failed \| 131 passed (142). "a group given in part keeps the default of each list it leaves out"; "the rulings of C48: rulingHeaders and attention.openStatus are options; decisionHeaders is the format contract"; "a list is copied, its duplicates dropped, and frozen with every group around it"; "refused: a word of white space"; "refused: a word null" (and 6 more printed) |
| L2-T8-M27 | a group: frozen | `src/enhance/options.ts` | `    if (f !== undefined) out[k] = wordList(`${where}.${k}`, f); ⏎   } ⏎   return Object.freeze(out);` → `    if (f !== undefined) out[k] = wordList(`${where}.${k}`, f); ⏎   } ⏎   return out;` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "a list is copied, its duplicates dropped, and frozen with every group around it" |
| L2-T8-M28 | an ID grammar: an object | `src/enhance/options.ts` | `  if (!isRecord(v)) throw invalid(`${where} must be ${shape}`); ⏎ ` → (deleted) | `test/enhance-vocab.test.ts`: 4 failed \| 138 passed (142). "refused: ids true"; "refused: ids null"; "refused: ids a list"; "refused: ruleIds false" |
| L2-T8-M29 | an ID grammar: own data fields | `src/enhance/options.ts` | `  const { prefixes } = ownFields(where, v, ['prefixes']);` → `  const { prefixes } = v as Record<string, unknown>;` | `test/enhance-vocab.test.ts`: 4 failed \| 138 passed (142). "refused: an unknown ids key"; "refused: an unknown ruleIds key"; "a getter is refused unread, on the vocabulary, a group, a list and a word"; "inherited properties are not read: not the vocabulary's, a group's or a list's" |
| L2-T8-M30 | an ID grammar: frozen | `src/enhance/options.ts` | `  return Object.freeze(prefixes === undefined ? {} : { prefixes: wordList(`${where}.prefixes`, prefi…` → `  return (prefixes === undefined ? {} : { prefixes: wordList(`${where}.prefixes`, prefixes) });` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "a list is copied, its duplicates dropped, and frozen with every group around it" |
| L2-T8-M31 | a list: an array | `src/enhance/options.ts` | `  if (!Array.isArray(v)) throw invalid(`${where} must be an array of words`); ⏎ ` → (deleted) | `test/enhance-vocab.test.ts`: 4 failed \| 138 passed (142). "refused: a list a string"; "refused: a list an array-like object"; "refused: ids.prefixes a string"; "refused: ruleIds.prefixes a number" |
| L2-T8-M32 | a list: at most 200 words, refused before any is read | `src/enhance/options.ts` | `  if (v.length > LIMITS.words) throw invalid(`${where} holds at most ${String(LIMITS.words)} words`)…` → (deleted) | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "every list is bounded: 200 words of 64 code units, the bounds inclusive"; "a list over its bound is refused before any of its items is read" |
| L2-T8-M33 | a list: the bound is 200 | `src/enhance/options.ts` | `  if (v.length > LIMITS.words) throw` → `  if (v.length > LIMITS.words + 1) throw` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "every list is bounded: 200 words of 64 code units, the bounds inclusive"; "a list over its bound is refused before any of its items is read" |
| L2-T8-M34 | a list: read by index, a hole a wrong value | `src/enhance/options.ts` | `  firstItems(v, LIMITS.words).forEach((w, i) => {` → `  (v as unknown[]).forEach((w, i) => {` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "refused: a hole"; "a getter is refused unread, on the vocabulary, a group, a list and a word" |
| L2-T8-M35 | a word: a string | `src/enhance/options.ts` | `    if (typeof w !== 'string' \|\| w.length > LIMITS.word \|\| w === '' \|\| w.trim() !== w) {` → `    if (w.length > LIMITS.word \|\| w === '' \|\| w.trim() !== w) {` | `test/enhance-vocab.test.ts`: 4 failed \| 138 passed (142). "refused: a word a number"; "refused: a hole"; "refused: a word null"; "a getter is refused unread, on the vocabulary, a group, a list and a word" |
| L2-T8-M36 | a word: at most 64 code units | `src/enhance/options.ts` | `    if (typeof w !== 'string' \|\| w.length > LIMITS.word \|\| w === '' \|\| w.trim() !== w) {` → `    if (typeof w !== 'string' \|\| w.length > LIMITS.word + 1 \|\| w === '' \|\| w.trim() !== w) {` | `test/enhance-vocab.test.ts`: 3 failed \| 139 passed (142). "every list is bounded: 200 words of 64 code units, the bounds inclusive"; "refused: a plan word over 64"; "refused: a rule prefix over 64" |
| L2-T8-M37 | a word: not empty | `src/enhance/options.ts` | `    if (typeof w !== 'string' \|\| w.length > LIMITS.word \|\| w === '' \|\| w.trim() !== w) {` → `    if (typeof w !== 'string' \|\| w.length > LIMITS.word \|\| w.trim() !== w) {` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "refused: an empty word" |
| L2-T8-M38 | a list: duplicates dropped | `src/enhance/options.ts` | `    if (!out.includes(w)) out.push(w);` → `    out.push(w);` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "a list is copied, its duplicates dropped, and frozen with every group around it" |
| L2-T8-M39 | a list: frozen | `src/enhance/options.ts` | `    if (!out.includes(w)) out.push(w); ⏎   }); ⏎   return Object.freeze(out);` → `    if (!out.includes(w)) out.push(w); ⏎   }); ⏎   return out;` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "a list is copied, its duplicates dropped, and frozen with every group around it" |
| L2-T8-M40 | the bounds: 200 words | `src/enhance/options.ts` | `  words: 200,` → `  words: 201,` | `test/enhance-vocab.test.ts`: 3 failed \| 139 passed (142). "every list is bounded: 200 words of 64 code units, the bounds inclusive"; "a list over its bound is refused before any of its items is read"; "each row states the default and the bounds the code holds" |
| L2-T8-M41 | the bounds: 64 code units | `src/enhance/options.ts` | `  word: 64,` → `  word: 65,` | `test/enhance-vocab.test.ts`: 6 failed \| 136 passed (142). "every list is bounded: 200 words of 64 code units, the bounds inclusive"; "refused: a word a number"; "refused: a word opening on a space"; "refused: a plan word over 64"; "refused: a rule prefix over 64" (and 1 more printed) |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T8-M1",
    "guard": "vocabulary is an option",
    "file": "src/enhance/options.ts",
    "old": "  'vocabulary', 'namespace',\n];",
    "new": "  'namespace',\n];",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M2",
    "guard": "namespace is an option",
    "file": "src/enhance/options.ts",
    "old": "  'vocabulary', 'namespace',\n];",
    "new": "  'vocabulary',\n];",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M3",
    "guard": "vocabulary: an object",
    "file": "src/enhance/options.ts",
    "old": "  if (!isRecord(v)) throw invalid('vocabulary must be an object');\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M4",
    "guard": "vocabulary: own data fields (unknown keys and getters refused, inherited ignored)",
    "file": "src/enhance/options.ts",
    "old": "  const fields = ownFields('vocabulary', v, VOCABULARY_KEYS);",
    "new": "  const fields = v as Record<string, unknown>;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M5",
    "guard": "vocabulary: rulingHeaders is an option (C48)",
    "file": "src/enhance/options.ts",
    "old": "  'status', 'statusHeaders', 'rulingHeaders', 'attention',",
    "new": "  'status', 'statusHeaders', 'attention',",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M6",
    "guard": "vocabulary: frozen",
    "file": "src/enhance/options.ts",
    "old": "    if (f !== undefined) out[k] = wordList(`vocabulary.${k}`, f);\n  }\n  return Object.freeze(out);",
    "new": "    if (f !== undefined) out[k] = wordList(`vocabulary.${k}`, f);\n  }\n  return out;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M7",
    "guard": "vocabulary: left out, an empty frozen object",
    "file": "src/enhance/options.ts",
    "old": "  if (v === undefined) return Object.freeze({});\n  if (!isRecord(v)) throw invalid('vocabulary must be an object');",
    "new": "  if (v === undefined) return {};\n  if (!isRecord(v)) throw invalid('vocabulary must be an object');",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M8",
    "guard": "vocabulary: read from the options",
    "file": "src/enhance/options.ts",
    "old": "    vocabulary: normalizeVocabulary(fields['vocabulary']),",
    "new": "    vocabulary: Object.freeze({}),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M9",
    "guard": "vocabulary.status: kept",
    "file": "src/enhance/options.ts",
    "old": "  if (fields['status'] !== undefined) out.status = wordGroup('vocabulary.status', fields['status'], STATUS_KEYS);\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M10",
    "guard": "vocabulary.attention: kept",
    "file": "src/enhance/options.ts",
    "old": "  if (fields['attention'] !== undefined) out.attention = wordGroup('vocabulary.attention', fields['attention'], ATTENTION_KEYS);\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M11",
    "guard": "vocabulary.plan: kept",
    "file": "src/enhance/options.ts",
    "old": "  if (fields['plan'] !== undefined) out.plan = wordGroup('vocabulary.plan', fields['plan'], PLAN_KEYS);\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M12",
    "guard": "vocabulary.ids: kept",
    "file": "src/enhance/options.ts",
    "old": "  if (ids !== undefined) out.ids = ids === false ? false : grammar('vocabulary.ids', ids, 'false or an object');\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M13",
    "guard": "vocabulary.ids: false is no IDs",
    "file": "src/enhance/options.ts",
    "old": "out.ids = ids === false ? false : grammar('vocabulary.ids', ids, 'false or an object');",
    "new": "out.ids = grammar('vocabulary.ids', ids, 'false or an object');",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M14",
    "guard": "vocabulary.ruleIds: kept",
    "file": "src/enhance/options.ts",
    "old": "  if (ruleIds !== undefined) out.ruleIds = grammar('vocabulary.ruleIds', ruleIds, 'an object');\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M15",
    "guard": "vocabulary.statusHeaders: kept",
    "file": "src/enhance/options.ts",
    "old": "const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemFields', 'itemHeadings'] as const;",
    "new": "const LIST_KEYS = ['rulingHeaders', 'qualifiers', 'addressees', 'itemFields', 'itemHeadings'] as const;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M16",
    "guard": "vocabulary.rulingHeaders: kept",
    "file": "src/enhance/options.ts",
    "old": "const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemFields', 'itemHeadings'] as const;",
    "new": "const LIST_KEYS = ['statusHeaders', 'qualifiers', 'addressees', 'itemFields', 'itemHeadings'] as const;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M17",
    "guard": "vocabulary.qualifiers: kept",
    "file": "src/enhance/options.ts",
    "old": "const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemFields', 'itemHeadings'] as const;",
    "new": "const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'addressees', 'itemFields', 'itemHeadings'] as const;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M18",
    "guard": "vocabulary.addressees: kept",
    "file": "src/enhance/options.ts",
    "old": "const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemFields', 'itemHeadings'] as const;",
    "new": "const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'itemFields', 'itemHeadings'] as const;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M19",
    "guard": "vocabulary.itemFields: kept",
    "file": "src/enhance/options.ts",
    "old": "const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemFields', 'itemHeadings'] as const;",
    "new": "const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemHeadings'] as const;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M20",
    "guard": "vocabulary.itemHeadings: kept",
    "file": "src/enhance/options.ts",
    "old": "const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemFields', 'itemHeadings'] as const;",
    "new": "const LIST_KEYS = ['statusHeaders', 'rulingHeaders', 'qualifiers', 'addressees', 'itemFields'] as const;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M21",
    "guard": "status: the four roles",
    "file": "src/enhance/options.ts",
    "old": "const STATUS_KEYS = ['ok', 'wait', 'no', 'info'] as const;",
    "new": "const STATUS_KEYS = ['ok', 'wait', 'no'] as const;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M22",
    "guard": "attention: openStatus is an option (C48)",
    "file": "src/enhance/options.ts",
    "old": "'blocking', 'risk', 'openStatus'] as const;",
    "new": "'blocking', 'risk'] as const;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M23",
    "guard": "plan: the owner label",
    "file": "src/enhance/options.ts",
    "old": "const PLAN_KEYS = ['task', 'step', 'who'] as const;",
    "new": "const PLAN_KEYS = ['task', 'step'] as const;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M24",
    "guard": "a group: an object",
    "file": "src/enhance/options.ts",
    "old": "  if (!isRecord(v)) throw invalid(`${where} must be an object`);\n  const fields = ownFields(where, v, keys);",
    "new": "  const fields = ownFields(where, v, keys);",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M25",
    "guard": "a group: own data fields",
    "file": "src/enhance/options.ts",
    "old": "  const fields = ownFields(where, v, keys);",
    "new": "  const fields = v as Record<string, unknown>;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M26",
    "guard": "a group: a list left out keeps its default",
    "file": "src/enhance/options.ts",
    "old": "    if (f !== undefined) out[k] = wordList(`${where}.${k}`, f);",
    "new": "    out[k] = wordList(`${where}.${k}`, f);",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M27",
    "guard": "a group: frozen",
    "file": "src/enhance/options.ts",
    "old": "    if (f !== undefined) out[k] = wordList(`${where}.${k}`, f);\n  }\n  return Object.freeze(out);",
    "new": "    if (f !== undefined) out[k] = wordList(`${where}.${k}`, f);\n  }\n  return out;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M28",
    "guard": "an ID grammar: an object",
    "file": "src/enhance/options.ts",
    "old": "  if (!isRecord(v)) throw invalid(`${where} must be ${shape}`);\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M29",
    "guard": "an ID grammar: own data fields",
    "file": "src/enhance/options.ts",
    "old": "  const { prefixes } = ownFields(where, v, ['prefixes']);",
    "new": "  const { prefixes } = v as Record<string, unknown>;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M30",
    "guard": "an ID grammar: frozen",
    "file": "src/enhance/options.ts",
    "old": "  return Object.freeze(prefixes === undefined ? {} : { prefixes: wordList(`${where}.prefixes`, prefixes) });",
    "new": "  return (prefixes === undefined ? {} : { prefixes: wordList(`${where}.prefixes`, prefixes) });",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M31",
    "guard": "a list: an array",
    "file": "src/enhance/options.ts",
    "old": "  if (!Array.isArray(v)) throw invalid(`${where} must be an array of words`);\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M32",
    "guard": "a list: at most 200 words, refused before any is read",
    "file": "src/enhance/options.ts",
    "old": "  if (v.length > LIMITS.words) throw invalid(`${where} holds at most ${String(LIMITS.words)} words`);\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M33",
    "guard": "a list: the bound is 200",
    "file": "src/enhance/options.ts",
    "old": "  if (v.length > LIMITS.words) throw",
    "new": "  if (v.length > LIMITS.words + 1) throw",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M34",
    "guard": "a list: read by index, a hole a wrong value",
    "file": "src/enhance/options.ts",
    "old": "  firstItems(v, LIMITS.words).forEach((w, i) => {",
    "new": "  (v as unknown[]).forEach((w, i) => {",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M35",
    "guard": "a word: a string",
    "file": "src/enhance/options.ts",
    "old": "    if (typeof w !== 'string' || w.length > LIMITS.word || w === '' || w.trim() !== w) {",
    "new": "    if (w.length > LIMITS.word || w === '' || w.trim() !== w) {",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M36",
    "guard": "a word: at most 64 code units",
    "file": "src/enhance/options.ts",
    "old": "    if (typeof w !== 'string' || w.length > LIMITS.word || w === '' || w.trim() !== w) {",
    "new": "    if (typeof w !== 'string' || w.length > LIMITS.word + 1 || w === '' || w.trim() !== w) {",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M37",
    "guard": "a word: not empty",
    "file": "src/enhance/options.ts",
    "old": "    if (typeof w !== 'string' || w.length > LIMITS.word || w === '' || w.trim() !== w) {",
    "new": "    if (typeof w !== 'string' || w.length > LIMITS.word || w.trim() !== w) {",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M38",
    "guard": "a list: duplicates dropped",
    "file": "src/enhance/options.ts",
    "old": "    if (!out.includes(w)) out.push(w);",
    "new": "    out.push(w);",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M39",
    "guard": "a list: frozen",
    "file": "src/enhance/options.ts",
    "old": "    if (!out.includes(w)) out.push(w);\n  });\n  return Object.freeze(out);",
    "new": "    if (!out.includes(w)) out.push(w);\n  });\n  return out;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M40",
    "guard": "the bounds: 200 words",
    "file": "src/enhance/options.ts",
    "old": "  words: 200,",
    "new": "  words: 201,",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M41",
    "guard": "the bounds: 64 code units",
    "file": "src/enhance/options.ts",
    "old": "  word: 64,",
    "new": "  word: 65,",
    "tests": "test/enhance-vocab.test.ts"
  }
]
```

## The namespace: `src/enhance/options.ts` and `src/enhance/state.ts` (L2-T8-M42 to L2-T8-M63)

The default `docreader`; the namespace read from the options and checked (a string, a lower-case letter first, then up
to 31 lower-case letters, digits or dashes, anchored at both ends); each of the four storage keys built from it; the
state reading and writing every key under it; and the scrub of the fixed prefix and of the "Open before v1" note.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T8-M42 | namespace: the default is docreader | `src/enhance/options.ts` | `export const DEFAULT_NAMESPACE = 'docreader';` → `export const DEFAULT_NAMESPACE = 'reader';` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "the default is docreader, and the four keys are its"; "each row states the default and the bounds the code holds" |
| L2-T8-M43 | namespace: left out, the default | `src/enhance/options.ts` | `  if (v === undefined) return DEFAULT_NAMESPACE;` → `  if (v === undefined) return 'docreader-x';` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "the default is docreader, and the four keys are its" |
| L2-T8-M44 | namespace: read from the options | `src/enhance/options.ts` | `    namespace: normalizeNamespace(fields['namespace']),` → `    namespace: DEFAULT_NAMESPACE,` | `test/enhance-vocab.test.ts`: 17 failed \| 125 passed (142). "the default is docreader, and the four keys are its"; "through enhance(): the prefs and the folds come from the namespace's keys, and every key read or written carries it"; "two roots on one storage object under two namespaces keep two queues and never merge their prefs"; "a namespace refused: empty"; "a namespace refused: a capital" (and 12 more printed) |
| L2-T8-M45 | namespace: a string | `src/enhance/options.ts` | `  if (typeof v !== 'string' \|\| !NAMESPACE.test(v)) {` → `  if (!NAMESPACE.test(v as string)) {` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "a namespace refused: null"; "a namespace refused: an object" |
| L2-T8-M46 | namespace: anchored at the start | `src/enhance/options.ts` | `const NAMESPACE = /^[a-z][a-z0-9-]{0,31}$/;` → `const NAMESPACE = /[a-z][a-z0-9-]{0,31}$/;` | `test/enhance-vocab.test.ts`: 8 failed \| 134 passed (142). "a namespace refused: a capital"; "a namespace refused: a digit first"; "a namespace refused: a dash first"; "a namespace refused: an underscore"; "a namespace refused: a colon" (and 3 more printed) |
| L2-T8-M47 | namespace: anchored at the end | `src/enhance/options.ts` | `const NAMESPACE = /^[a-z][a-z0-9-]{0,31}$/;` → `const NAMESPACE = /^[a-z][a-z0-9-]{0,31}/;` | `test/enhance-vocab.test.ts`: 6 failed \| 136 passed (142). "a namespace refused: an underscore"; "a namespace refused: a colon"; "a namespace refused: a space"; "a namespace refused: a dot"; "a namespace refused: 33 characters" (and 1 more printed) |
| L2-T8-M48 | namespace: a letter first | `src/enhance/options.ts` | `const NAMESPACE = /^[a-z][a-z0-9-]{0,31}$/;` → `const NAMESPACE = /^[a-z0-9-][a-z0-9-]{0,31}$/;` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "a namespace refused: a digit first"; "a namespace refused: a dash first" |
| L2-T8-M49 | namespace: at most 32 characters | `src/enhance/options.ts` | `const NAMESPACE = /^[a-z][a-z0-9-]{0,31}$/;` → `const NAMESPACE = /^[a-z][a-z0-9-]{0,32}$/;` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "a namespace refused: 33 characters" |
| L2-T8-M50 | namespace: letters, digits and dashes only | `src/enhance/options.ts` | `const NAMESPACE = /^[a-z][a-z0-9-]{0,31}$/;` → `const NAMESPACE = /^[a-z][a-z0-9_:. -]{0,31}$/;` | `test/enhance-vocab.test.ts`: 4 failed \| 138 passed (142). "a namespace refused: an underscore"; "a namespace refused: a colon"; "a namespace refused: a space"; "a namespace refused: a dot" |
| L2-T8-M51 | namespace: lower case only | `src/enhance/options.ts` | `const NAMESPACE = /^[a-z][a-z0-9-]{0,31}$/;` → `const NAMESPACE = /^[a-z][a-z0-9-]{0,31}$/i;` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "a namespace refused: a capital" |
| L2-T8-M52 | the prefs key carries the namespace | `src/enhance/state.ts` | `  return `${ns}:prefs`;` → `  return 'docreader:prefs';` | `test/enhance-vocab.test.ts`: 5 failed \| 137 passed (142). "the default is docreader, and the four keys are its"; "the state reads and writes each key under the namespace, and none under another"; "through enhance(): the prefs and the folds come from the namespace's keys, and every key read or written carries it"; "two roots on one storage object under two namespaces keep two queues and never merge their prefs"; "no source in src/enhance holds a storage key with a fixed prefix: every key is built from the namespace" |
| L2-T8-M53 | the UI key carries the namespace | `src/enhance/state.ts` | `  return `${ns}:ui`;` → `  return 'docreader:ui';` | `test/enhance-vocab.test.ts`: 3 failed \| 139 passed (142). "the default is docreader, and the four keys are its"; "the state reads and writes each key under the namespace, and none under another"; "no source in src/enhance holds a storage key with a fixed prefix: every key is built from the namespace" |
| L2-T8-M54 | a per-document key carries the namespace | `src/enhance/state.ts` | `  return `${ns}:doc:${storageKey}:${name}`;` → `  return `docreader:doc:${storageKey}:${name}`;` | `test/enhance-vocab.test.ts`: 4 failed \| 138 passed (142). "the default is docreader, and the four keys are its"; "the state reads and writes each key under the namespace, and none under another"; "through enhance(): the prefs and the folds come from the namespace's keys, and every key read or written carries it"; "no source in src/enhance holds a storage key with a fixed prefix: every key is built from the namespace" |
| L2-T8-M55 | a position key carries the namespace | `src/enhance/state.ts` | `  return `${ns}:pos:${posKey}`;` → `  return `docreader:pos:${posKey}`;` | `test/enhance-vocab.test.ts`: 4 failed \| 138 passed (142). "the default is docreader, and the four keys are its"; "the state reads and writes each key under the namespace, and none under another"; "through enhance(): the prefs and the folds come from the namespace's keys, and every key read or written carries it"; "no source in src/enhance holds a storage key with a fixed prefix: every key is built from the namespace" |
| L2-T8-M56 | the state reads and writes the prefs under the namespace | `src/enhance/state.ts` | `  const storedPrefs = shared(prefsKey(ns));` → `  const storedPrefs = shared(PREFS_KEY);` | `test/enhance-vocab.test.ts`: 3 failed \| 139 passed (142). "the state reads and writes each key under the namespace, and none under another"; "through enhance(): the prefs and the folds come from the namespace's keys, and every key read or written carries it"; "two roots on one storage object under two namespaces keep two queues and never merge their prefs" |
| L2-T8-M57 | the state reads and writes the UI memory under the namespace | `src/enhance/state.ts` | `  const ui = shared(uiKey(ns));` → `  const ui = shared(UI_KEY);` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "the state reads and writes each key under the namespace, and none under another" |
| L2-T8-M58 | the state reads a per-document value under the namespace | `src/enhance/state.ts` | `      return parseJson(readRaw(docKey(storageKey, name, ns)));` → `      return parseJson(readRaw(docKey(storageKey, name)));` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "the state reads and writes each key under the namespace, and none under another"; "through enhance(): the prefs and the folds come from the namespace's keys, and every key read or written carries it" |
| L2-T8-M59 | the state writes a per-document value under the namespace | `src/enhance/state.ts` | `      writeBehind(docKey(storageKey, name, ns), value` → `      writeBehind(docKey(storageKey, name), value` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "the state reads and writes each key under the namespace, and none under another"; "through enhance(): the prefs and the folds come from the namespace's keys, and every key read or written carries it" |
| L2-T8-M60 | the state reads a position under the namespace | `src/enhance/state.ts` | `      return parseJson(readRaw(posKeyOf(posKey, ns)));` → `      return parseJson(readRaw(posKeyOf(posKey)));` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "the state reads and writes each key under the namespace, and none under another" |
| L2-T8-M61 | the state writes a position under the namespace | `src/enhance/state.ts` | `      writeBehind(posKeyOf(posKey, ns), value` → `      writeBehind(posKeyOf(posKey), value` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "the state reads and writes each key under the namespace, and none under another"; "through enhance(): the prefs and the folds come from the namespace's keys, and every key read or written carries it" |
| L2-T8-M62 | no key has a fixed prefix (the scrub) | `src/enhance/state.ts` | `export const PREFS_KEY = `${DEFAULT_NAMESPACE}:prefs`;` → `export const PREFS_KEY = 'docreader:prefs';` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "no source in src/enhance holds a storage key with a fixed prefix: every key is built from the namespace" |
| L2-T8-M63 | no "Open before v1" note is left (the scrub) | `src/enhance/state.ts` | `/** The storage key of the reader-wide prefs: <ns>:prefs. */` → `// Open before v1: the `docreader:` prefix is fixed. ⏎ /** The storage key of the reader-wide prefs:…` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "no "Open before v1" note is left in src/enhance" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T8-M42",
    "guard": "namespace: the default is docreader",
    "file": "src/enhance/options.ts",
    "old": "export const DEFAULT_NAMESPACE = 'docreader';",
    "new": "export const DEFAULT_NAMESPACE = 'reader';",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M43",
    "guard": "namespace: left out, the default",
    "file": "src/enhance/options.ts",
    "old": "  if (v === undefined) return DEFAULT_NAMESPACE;",
    "new": "  if (v === undefined) return 'docreader-x';",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M44",
    "guard": "namespace: read from the options",
    "file": "src/enhance/options.ts",
    "old": "    namespace: normalizeNamespace(fields['namespace']),",
    "new": "    namespace: DEFAULT_NAMESPACE,",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M45",
    "guard": "namespace: a string",
    "file": "src/enhance/options.ts",
    "old": "  if (typeof v !== 'string' || !NAMESPACE.test(v)) {",
    "new": "  if (!NAMESPACE.test(v as string)) {",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M46",
    "guard": "namespace: anchored at the start",
    "file": "src/enhance/options.ts",
    "old": "const NAMESPACE = /^[a-z][a-z0-9-]{0,31}$/;",
    "new": "const NAMESPACE = /[a-z][a-z0-9-]{0,31}$/;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M47",
    "guard": "namespace: anchored at the end",
    "file": "src/enhance/options.ts",
    "old": "const NAMESPACE = /^[a-z][a-z0-9-]{0,31}$/;",
    "new": "const NAMESPACE = /^[a-z][a-z0-9-]{0,31}/;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M48",
    "guard": "namespace: a letter first",
    "file": "src/enhance/options.ts",
    "old": "const NAMESPACE = /^[a-z][a-z0-9-]{0,31}$/;",
    "new": "const NAMESPACE = /^[a-z0-9-][a-z0-9-]{0,31}$/;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M49",
    "guard": "namespace: at most 32 characters",
    "file": "src/enhance/options.ts",
    "old": "const NAMESPACE = /^[a-z][a-z0-9-]{0,31}$/;",
    "new": "const NAMESPACE = /^[a-z][a-z0-9-]{0,32}$/;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M50",
    "guard": "namespace: letters, digits and dashes only",
    "file": "src/enhance/options.ts",
    "old": "const NAMESPACE = /^[a-z][a-z0-9-]{0,31}$/;",
    "new": "const NAMESPACE = /^[a-z][a-z0-9_:. -]{0,31}$/;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M51",
    "guard": "namespace: lower case only",
    "file": "src/enhance/options.ts",
    "old": "const NAMESPACE = /^[a-z][a-z0-9-]{0,31}$/;",
    "new": "const NAMESPACE = /^[a-z][a-z0-9-]{0,31}$/i;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M52",
    "guard": "the prefs key carries the namespace",
    "file": "src/enhance/state.ts",
    "old": "  return `${ns}:prefs`;",
    "new": "  return 'docreader:prefs';",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M53",
    "guard": "the UI key carries the namespace",
    "file": "src/enhance/state.ts",
    "old": "  return `${ns}:ui`;",
    "new": "  return 'docreader:ui';",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M54",
    "guard": "a per-document key carries the namespace",
    "file": "src/enhance/state.ts",
    "old": "  return `${ns}:doc:${storageKey}:${name}`;",
    "new": "  return `docreader:doc:${storageKey}:${name}`;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M55",
    "guard": "a position key carries the namespace",
    "file": "src/enhance/state.ts",
    "old": "  return `${ns}:pos:${posKey}`;",
    "new": "  return `docreader:pos:${posKey}`;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M56",
    "guard": "the state reads and writes the prefs under the namespace",
    "file": "src/enhance/state.ts",
    "old": "  const storedPrefs = shared(prefsKey(ns));",
    "new": "  const storedPrefs = shared(PREFS_KEY);",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M57",
    "guard": "the state reads and writes the UI memory under the namespace",
    "file": "src/enhance/state.ts",
    "old": "  const ui = shared(uiKey(ns));",
    "new": "  const ui = shared(UI_KEY);",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M58",
    "guard": "the state reads a per-document value under the namespace",
    "file": "src/enhance/state.ts",
    "old": "      return parseJson(readRaw(docKey(storageKey, name, ns)));",
    "new": "      return parseJson(readRaw(docKey(storageKey, name)));",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M59",
    "guard": "the state writes a per-document value under the namespace",
    "file": "src/enhance/state.ts",
    "old": "      writeBehind(docKey(storageKey, name, ns), value",
    "new": "      writeBehind(docKey(storageKey, name), value",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M60",
    "guard": "the state reads a position under the namespace",
    "file": "src/enhance/state.ts",
    "old": "      return parseJson(readRaw(posKeyOf(posKey, ns)));",
    "new": "      return parseJson(readRaw(posKeyOf(posKey)));",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M61",
    "guard": "the state writes a position under the namespace",
    "file": "src/enhance/state.ts",
    "old": "      writeBehind(posKeyOf(posKey, ns), value",
    "new": "      writeBehind(posKeyOf(posKey), value",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M62",
    "guard": "no key has a fixed prefix (the scrub)",
    "file": "src/enhance/state.ts",
    "old": "export const PREFS_KEY = `${DEFAULT_NAMESPACE}:prefs`;",
    "new": "export const PREFS_KEY = 'docreader:prefs';",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M63",
    "guard": "no \"Open before v1\" note is left (the scrub)",
    "file": "src/enhance/state.ts",
    "old": "/** The storage key of the reader-wide prefs: <ns>:prefs. */",
    "new": "// Open before v1: the `docreader:` prefix is fixed.\n/** The storage key of the reader-wide prefs: <ns>:prefs. */",
    "tests": "test/enhance-vocab.test.ts"
  }
]
```

## The merge and the format contract: `src/enhance/vocab.ts` (L2-T8-M64 to L2-T8-M102)

createVocab reading the option; each list given replacing its default (every status role, every list, every plan and
attention word list, both ID grammars, `ids: false`, a grammar given without prefixes); the format contract kept from
the defaults; the format-contract words moved from editorial.ts (the box headings whole and in any case, the callout
kinds at the start of a heading, the front-matter kind keys whole, all frozen); and the item key scan and the delta
block's item line.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T8-M64 | createVocab reads the vocabulary option | `src/enhance/vocab.ts` | `  return compileVocab(mergeVocabulary(defaultVocabulary(), options.vocabulary));` → `  return compileVocab(defaultVocabulary());` | `test/enhance-vocab.test.ts`: 41 failed \| 101 passed (142). "each field given replaces its default whole; every other list keeps its own"; "a group given in part keeps the default of each list it leaves out"; "ids: false is no IDs at all; an empty object is the default grammar; prefixes replace the capitals"; "a custom status list changes the marks: it replaces its role's words, the other roles keep theirs"; "a word is matched literally: a pattern character in it is only itself" (and 15 more printed) |
| L2-T8-M65 | merge: status.ok given replaces its default | `src/enhance/vocab.ts` | `ok: list(o.status?.ok, w.status.ok)` → `ok: list(undefined, w.status.ok)` | `test/enhance-vocab.test.ts`: 6 failed \| 136 passed (142). "each field given replaces its default whole; every other list keeps its own"; "a group given in part keeps the default of each list it leaves out"; "a custom status list changes the marks: it replaces its role's words, the other roles keep theirs"; "a word is matched literally: a pattern character in it is only itself"; "empty lists mark nothing" (and 1 more printed) |
| L2-T8-M66 | merge: status.wait given replaces its default | `src/enhance/vocab.ts` | `wait: list(o.status?.wait, w.status.wait)` → `wait: list(undefined, w.status.wait)` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "each field given replaces its default whole; every other list keeps its own"; "empty lists mark nothing" |
| L2-T8-M67 | merge: status.no given replaces its default | `src/enhance/vocab.ts` | `no: list(o.status?.no, w.status.no)` → `no: list(undefined, w.status.no)` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "each field given replaces its default whole; every other list keeps its own"; "empty lists mark nothing" |
| L2-T8-M68 | merge: status.info given replaces its default | `src/enhance/vocab.ts` | `info: list(o.status?.info, w.status.info)` → `info: list(undefined, w.status.info)` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "each field given replaces its default whole; every other list keeps its own" |
| L2-T8-M69 | merge: statusHeaders given replaces its default | `src/enhance/vocab.ts` | `    statusHeaders: list(o.statusHeaders, w.statusHeaders),` → `    statusHeaders: list(undefined, w.statusHeaders),` | `test/enhance-vocab.test.ts`: 3 failed \| 139 passed (142). "each field given replaces its default whole; every other list keeps its own"; "custom status-column headers, and ruling headers"; "status-column headers: whole, in any script and any case; one ending in "?" needs no boundary after" |
| L2-T8-M70 | merge: rulingHeaders given replaces its default | `src/enhance/vocab.ts` | `    rulingHeaders: list(o.rulingHeaders, w.rulingHeaders),` → `    rulingHeaders: list(undefined, w.rulingHeaders),` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "each field given replaces its default whole; every other list keeps its own"; "custom status-column headers, and ruling headers" |
| L2-T8-M71 | merge: qualifiers given replaces its default | `src/enhance/vocab.ts` | `    qualifiers: list(o.qualifiers, w.qualifiers),` → `    qualifiers: list(undefined, w.qualifiers),` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "each field given replaces its default whole; every other list keeps its own"; "addressees, qualifiers and the attention words: whole, in any script" |
| L2-T8-M72 | merge: addressees given replaces its default | `src/enhance/vocab.ts` | `    addressees: list(o.addressees, w.addressees),` → `    addressees: list(undefined, w.addressees),` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "each field given replaces its default whole; every other list keeps its own"; "addressees, qualifiers and the attention words: whole, in any script" |
| L2-T8-M73 | merge: itemFields given replaces its default | `src/enhance/vocab.ts` | `    itemFields: list(o.itemFields, w.itemFields),` → `    itemFields: list(undefined, w.itemFields),` | `test/enhance-vocab.test.ts`: 29 failed \| 113 passed (142). "each field given replaces its default whole; every other list keeps its own"; "the key's own text moves into a link: href from itemLink, opened in a new tab, an arrow after it"; "every key in the fact: in its text, in its own code; never an author's link, a lower-case or a run-on key"; "a key named twice is asked for once and linked twice"; "at most 16 keys are asked for and linked; the rest stay text" (and 15 more printed) |
| L2-T8-M74 | merge: itemHeadings given replaces its default | `src/enhance/vocab.ts` | `    itemHeadings: list(o.itemHeadings, w.itemHeadings),` → `    itemHeadings: list(undefined, w.itemHeadings),` | `test/enhance-vocab.test.ts`: 7 failed \| 135 passed (142). "each field given replaces its default whole; every other list keeps its own"; "the delta's key replaces the item fact's value; the fact's own nodes stay in the hidden meta line"; "without an item fact the delta's key is a fact of its own, labelled by the first item field, before the wide ones"; "a section whose first code block names no key passes to the next section with an item heading"; "the heading: an optional section number, then the words whole, a space or a dash between them; literal" (and 2 more printed) |
| L2-T8-M75 | merge: plan.task given replaces its default | `src/enhance/vocab.ts` | `task: list(o.plan?.task, w.plan.task)` → `task: list(undefined, w.plan.task)` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "each field given replaces its default whole; every other list keeps its own" |
| L2-T8-M76 | merge: plan.step given replaces its default | `src/enhance/vocab.ts` | `step: list(o.plan?.step, w.plan.step)` → `step: list(undefined, w.plan.step)` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "each field given replaces its default whole; every other list keeps its own" |
| L2-T8-M77 | merge: plan.who given replaces its default | `src/enhance/vocab.ts` | `who: list(o.plan?.who, w.plan.who)` → `who: list(undefined, w.plan.who)` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "each field given replaces its default whole; every other list keeps its own"; "a group given in part keeps the default of each list it leaves out" |
| L2-T8-M78 | merge: attention.status given replaces its default | `src/enhance/vocab.ts` | `      status: list(o.attention?.status, w.attention.status),` → `      status: list(undefined, w.attention.status),` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "each field given replaces its default whole; every other list keeps its own" |
| L2-T8-M79 | merge: attention.who given replaces its default | `src/enhance/vocab.ts` | `      who: list(o.attention?.who, w.attention.who),` → `      who: list(undefined, w.attention.who),` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "each field given replaces its default whole; every other list keeps its own"; "addressees, qualifiers and the attention words: whole, in any script" |
| L2-T8-M80 | merge: attention.question given replaces its default | `src/enhance/vocab.ts` | `      question: list(o.attention?.question, w.attention.question),` → `      question: list(undefined, w.attention.question),` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "each field given replaces its default whole; every other list keeps its own" |
| L2-T8-M81 | merge: attention.openAnswers given replaces its default | `src/enhance/vocab.ts` | `      openAnswers: list(o.attention?.openAnswers, w.attention.openAnswers),` → `      openAnswers: list(undefined, w.attention.openAnswers),` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "each field given replaces its default whole; every other list keeps its own"; "addressees, qualifiers and the attention words: whole, in any script" |
| L2-T8-M82 | merge: attention.blocking given replaces its default | `src/enhance/vocab.ts` | `      blocking: list(o.attention?.blocking, w.attention.blocking),` → `      blocking: list(undefined, w.attention.blocking),` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "each field given replaces its default whole; every other list keeps its own"; "addressees, qualifiers and the attention words: whole, in any script" |
| L2-T8-M83 | merge: attention.risk given replaces its default | `src/enhance/vocab.ts` | `      risk: list(o.attention?.risk, w.attention.risk),` → `      risk: list(undefined, w.attention.risk),` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "each field given replaces its default whole; every other list keeps its own"; "a group given in part keeps the default of each list it leaves out" |
| L2-T8-M84 | merge: attention.openStatus given replaces its default | `src/enhance/vocab.ts` | `      openStatus: list(o.attention?.openStatus, w.attention.openStatus),` → `      openStatus: list(undefined, w.attention.openStatus),` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "each field given replaces its default whole; every other list keeps its own" |
| L2-T8-M85 | merge: ids given replaces the default grammar | `src/enhance/vocab.ts` | `    ids: o.ids === undefined ? w.ids : o.ids === false ? false : grammar(o.ids),` → `    ids: w.ids,` | `test/enhance-vocab.test.ts`: 3 failed \| 139 passed (142). "each field given replaces its default whole; every other list keeps its own"; "ids: false is no IDs at all; an empty object is the default grammar; prefixes replace the capitals"; "an ID is whole in any script: a prefix of another script, and the default grammar with a letter on either side" |
| L2-T8-M86 | merge: ids false is no IDs | `src/enhance/vocab.ts` | `o.ids === false ? false : grammar(o.ids)` → `grammar(o.ids as { readonly prefixes?: readonly string[] })` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "ids: false is no IDs at all; an empty object is the default grammar; prefixes replace the capitals" |
| L2-T8-M87 | merge: ruleIds given replaces the default grammar | `src/enhance/vocab.ts` | `    ruleIds: o.ruleIds === undefined ? w.ruleIds : grammar(o.ruleIds),` → `    ruleIds: w.ruleIds,` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "each field given replaces its default whole; every other list keeps its own" |
| L2-T8-M88 | merge: a grammar without prefixes is the default grammar | `src/enhance/vocab.ts` | `({ prefixes: g.prefixes === undefined ? null : [...g.prefixes] })` → `({ prefixes: [...(g.prefixes ?? [])] })` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "ids: false is no IDs at all; an empty object is the default grammar; prefixes replace the capitals"; "a field whose value is undefined is left out, at each level" |
| L2-T8-M89 | merge: the format contract is the default's | `src/enhance/vocab.ts` | `  return { ⏎     ...w, ⏎     status: {` → `  return { ⏎     status: {` | `test/enhance-vocab.test.ts`: 75 failed \| 67 passed (142). "left out, or empty, the vocabulary is the defaults"; "each field given replaces its default whole; every other list keeps its own"; "a group given in part keeps the default of each list it leaves out"; "ids: false is no IDs at all; an empty object is the default grammar; prefixes replace the capitals"; "a field whose value is undefined is left out, at each level" (and 15 more printed) |
| L2-T8-M90 | format contract: the "In short" heading, whole | `src/enhance/vocab.ts` | `short: new RegExp(`^${anyOf(w.boxes.short)}$`, 'i')` → `short: new RegExp(`^${anyOf(w.boxes.short)}`, 'i')` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "their defaults, compiled" |
| L2-T8-M91 | format contract: the "Where things stand" heading, whole | `src/enhance/vocab.ts` | `stand: new RegExp(`^${anyOf(w.boxes.stand)}$`, 'i')` → `stand: new RegExp(`^${anyOf(w.boxes.stand)}`, 'i')` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "their defaults, compiled" |
| L2-T8-M92 | format contract: a box heading in any case | `src/enhance/vocab.ts` | ``, 'i'), stand: new RegExp(` → ``, ''), stand: new RegExp(` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "their defaults, compiled"; "editorial.ts reads them from the vocabulary, never from words of its own" |
| L2-T8-M93 | format contract: the agreed callout opens with its word | `src/enhance/vocab.ts` | `      agreed: new RegExp(`^${anyOf(w.callouts.agreed)}`, 'i'),` → `      agreed: new RegExp(`${anyOf(w.callouts.agreed)}`, 'i'),` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "their defaults, compiled" |
| L2-T8-M94 | format contract: the waiting callout opens with its word | `src/enhance/vocab.ts` | `      waiting: new RegExp(`^${anyOf(w.callouts.waiting)}`, 'i'),` → `      waiting: new RegExp(`${anyOf(w.callouts.waiting)}`, 'i'),` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "their defaults, compiled" |
| L2-T8-M95 | format contract: the later callout opens with its word | `src/enhance/vocab.ts` | `      later: new RegExp(`^${anyOf(w.callouts.later)}`, 'i'),` → `      later: new RegExp(`${anyOf(w.callouts.later)}`, 'i'),` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "their defaults, compiled" |
| L2-T8-M96 | format contract: a callout word in any case | `src/enhance/vocab.ts` | `      agreed: new RegExp(`^${anyOf(w.callouts.agreed)}`, 'i'),` → `      agreed: new RegExp(`^${anyOf(w.callouts.agreed)}`),` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "their defaults, compiled"; "editorial.ts reads them from the vocabulary, never from words of its own" |
| L2-T8-M97 | format contract: a kind key, whole | `src/enhance/vocab.ts` | `    kindKey: new RegExp(`^${anyOf(w.kindKeys)}$`, 'i'),` → `    kindKey: new RegExp(`${anyOf(w.kindKeys)}`, 'i'),` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "their defaults, compiled" |
| L2-T8-M98 | format contract: the words frozen | `src/enhance/vocab.ts` | `    boxes: Object.freeze({ short: list(w.boxes.short), stand: list(w.boxes.stand) }),` → `    boxes: ({ short: list(w.boxes.short), stand: list(w.boxes.stand) }),` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "their defaults, compiled" |
| L2-T8-M99 | the item-key scan: no word character or dash before | `src/enhance/vocab.ts` | `(?<![\\w-])(${ITEM_KEY})` → `(${ITEM_KEY})` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "every key in the fact: in its text, in its own code; never an author's link, a lower-case or a run-on key" |
| L2-T8-M100 | the item-key scan: no word character or dash after | `src/enhance/vocab.ts` | `(${ITEM_KEY})(?![\\w-])` → `(${ITEM_KEY})` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "every key in the fact: in its text, in its own code; never an author's link, a lower-case or a run-on key" |
| L2-T8-M101 | the item line: anchored at the start | `src/enhance/vocab.ts` | `    itemLine: /^item:\s*(\S+)$/,` → `    itemLine: /item:\s*(\S+)$/,` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "an item line whose value is no key is no delta, and the byline route applies" |
| L2-T8-M102 | the item line: anchored at the end | `src/enhance/vocab.ts` | `    itemLine: /^item:\s*(\S+)$/,` → `    itemLine: /^item:\s*(\S+)/,` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "an item line whose value is no key is no delta, and the byline route applies" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T8-M64",
    "guard": "createVocab reads the vocabulary option",
    "file": "src/enhance/vocab.ts",
    "old": "  return compileVocab(mergeVocabulary(defaultVocabulary(), options.vocabulary));",
    "new": "  return compileVocab(defaultVocabulary());",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M65",
    "guard": "merge: status.ok given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "ok: list(o.status?.ok, w.status.ok)",
    "new": "ok: list(undefined, w.status.ok)",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M66",
    "guard": "merge: status.wait given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "wait: list(o.status?.wait, w.status.wait)",
    "new": "wait: list(undefined, w.status.wait)",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M67",
    "guard": "merge: status.no given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "no: list(o.status?.no, w.status.no)",
    "new": "no: list(undefined, w.status.no)",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M68",
    "guard": "merge: status.info given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "info: list(o.status?.info, w.status.info)",
    "new": "info: list(undefined, w.status.info)",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M69",
    "guard": "merge: statusHeaders given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "    statusHeaders: list(o.statusHeaders, w.statusHeaders),",
    "new": "    statusHeaders: list(undefined, w.statusHeaders),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M70",
    "guard": "merge: rulingHeaders given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "    rulingHeaders: list(o.rulingHeaders, w.rulingHeaders),",
    "new": "    rulingHeaders: list(undefined, w.rulingHeaders),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M71",
    "guard": "merge: qualifiers given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "    qualifiers: list(o.qualifiers, w.qualifiers),",
    "new": "    qualifiers: list(undefined, w.qualifiers),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M72",
    "guard": "merge: addressees given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "    addressees: list(o.addressees, w.addressees),",
    "new": "    addressees: list(undefined, w.addressees),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M73",
    "guard": "merge: itemFields given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "    itemFields: list(o.itemFields, w.itemFields),",
    "new": "    itemFields: list(undefined, w.itemFields),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M74",
    "guard": "merge: itemHeadings given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "    itemHeadings: list(o.itemHeadings, w.itemHeadings),",
    "new": "    itemHeadings: list(undefined, w.itemHeadings),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M75",
    "guard": "merge: plan.task given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "task: list(o.plan?.task, w.plan.task)",
    "new": "task: list(undefined, w.plan.task)",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M76",
    "guard": "merge: plan.step given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "step: list(o.plan?.step, w.plan.step)",
    "new": "step: list(undefined, w.plan.step)",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M77",
    "guard": "merge: plan.who given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "who: list(o.plan?.who, w.plan.who)",
    "new": "who: list(undefined, w.plan.who)",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M78",
    "guard": "merge: attention.status given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "      status: list(o.attention?.status, w.attention.status),",
    "new": "      status: list(undefined, w.attention.status),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M79",
    "guard": "merge: attention.who given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "      who: list(o.attention?.who, w.attention.who),",
    "new": "      who: list(undefined, w.attention.who),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M80",
    "guard": "merge: attention.question given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "      question: list(o.attention?.question, w.attention.question),",
    "new": "      question: list(undefined, w.attention.question),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M81",
    "guard": "merge: attention.openAnswers given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "      openAnswers: list(o.attention?.openAnswers, w.attention.openAnswers),",
    "new": "      openAnswers: list(undefined, w.attention.openAnswers),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M82",
    "guard": "merge: attention.blocking given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "      blocking: list(o.attention?.blocking, w.attention.blocking),",
    "new": "      blocking: list(undefined, w.attention.blocking),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M83",
    "guard": "merge: attention.risk given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "      risk: list(o.attention?.risk, w.attention.risk),",
    "new": "      risk: list(undefined, w.attention.risk),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M84",
    "guard": "merge: attention.openStatus given replaces its default",
    "file": "src/enhance/vocab.ts",
    "old": "      openStatus: list(o.attention?.openStatus, w.attention.openStatus),",
    "new": "      openStatus: list(undefined, w.attention.openStatus),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M85",
    "guard": "merge: ids given replaces the default grammar",
    "file": "src/enhance/vocab.ts",
    "old": "    ids: o.ids === undefined ? w.ids : o.ids === false ? false : grammar(o.ids),",
    "new": "    ids: w.ids,",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M86",
    "guard": "merge: ids false is no IDs",
    "file": "src/enhance/vocab.ts",
    "old": "o.ids === false ? false : grammar(o.ids)",
    "new": "grammar(o.ids as { readonly prefixes?: readonly string[] })",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M87",
    "guard": "merge: ruleIds given replaces the default grammar",
    "file": "src/enhance/vocab.ts",
    "old": "    ruleIds: o.ruleIds === undefined ? w.ruleIds : grammar(o.ruleIds),",
    "new": "    ruleIds: w.ruleIds,",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M88",
    "guard": "merge: a grammar without prefixes is the default grammar",
    "file": "src/enhance/vocab.ts",
    "old": "({ prefixes: g.prefixes === undefined ? null : [...g.prefixes] })",
    "new": "({ prefixes: [...(g.prefixes ?? [])] })",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M89",
    "guard": "merge: the format contract is the default's",
    "file": "src/enhance/vocab.ts",
    "old": "  return {\n    ...w,\n    status: {",
    "new": "  return {\n    status: {",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M90",
    "guard": "format contract: the \"In short\" heading, whole",
    "file": "src/enhance/vocab.ts",
    "old": "short: new RegExp(`^${anyOf(w.boxes.short)}$`, 'i')",
    "new": "short: new RegExp(`^${anyOf(w.boxes.short)}`, 'i')",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M91",
    "guard": "format contract: the \"Where things stand\" heading, whole",
    "file": "src/enhance/vocab.ts",
    "old": "stand: new RegExp(`^${anyOf(w.boxes.stand)}$`, 'i')",
    "new": "stand: new RegExp(`^${anyOf(w.boxes.stand)}`, 'i')",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M92",
    "guard": "format contract: a box heading in any case",
    "file": "src/enhance/vocab.ts",
    "old": "`, 'i'), stand: new RegExp(",
    "new": "`, ''), stand: new RegExp(",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M93",
    "guard": "format contract: the agreed callout opens with its word",
    "file": "src/enhance/vocab.ts",
    "old": "      agreed: new RegExp(`^${anyOf(w.callouts.agreed)}`, 'i'),",
    "new": "      agreed: new RegExp(`${anyOf(w.callouts.agreed)}`, 'i'),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M94",
    "guard": "format contract: the waiting callout opens with its word",
    "file": "src/enhance/vocab.ts",
    "old": "      waiting: new RegExp(`^${anyOf(w.callouts.waiting)}`, 'i'),",
    "new": "      waiting: new RegExp(`${anyOf(w.callouts.waiting)}`, 'i'),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M95",
    "guard": "format contract: the later callout opens with its word",
    "file": "src/enhance/vocab.ts",
    "old": "      later: new RegExp(`^${anyOf(w.callouts.later)}`, 'i'),",
    "new": "      later: new RegExp(`${anyOf(w.callouts.later)}`, 'i'),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M96",
    "guard": "format contract: a callout word in any case",
    "file": "src/enhance/vocab.ts",
    "old": "      agreed: new RegExp(`^${anyOf(w.callouts.agreed)}`, 'i'),",
    "new": "      agreed: new RegExp(`^${anyOf(w.callouts.agreed)}`),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M97",
    "guard": "format contract: a kind key, whole",
    "file": "src/enhance/vocab.ts",
    "old": "    kindKey: new RegExp(`^${anyOf(w.kindKeys)}$`, 'i'),",
    "new": "    kindKey: new RegExp(`${anyOf(w.kindKeys)}`, 'i'),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M98",
    "guard": "format contract: the words frozen",
    "file": "src/enhance/vocab.ts",
    "old": "    boxes: Object.freeze({ short: list(w.boxes.short), stand: list(w.boxes.stand) }),",
    "new": "    boxes: ({ short: list(w.boxes.short), stand: list(w.boxes.stand) }),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M99",
    "guard": "the item-key scan: no word character or dash before",
    "file": "src/enhance/vocab.ts",
    "old": "(?<![\\\\w-])(${ITEM_KEY})",
    "new": "(${ITEM_KEY})",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M100",
    "guard": "the item-key scan: no word character or dash after",
    "file": "src/enhance/vocab.ts",
    "old": "(${ITEM_KEY})(?![\\\\w-])",
    "new": "(${ITEM_KEY})",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M101",
    "guard": "the item line: anchored at the start",
    "file": "src/enhance/vocab.ts",
    "old": "    itemLine: /^item:\\s*(\\S+)$/,",
    "new": "    itemLine: /item:\\s*(\\S+)$/,",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M102",
    "guard": "the item line: anchored at the end",
    "file": "src/enhance/vocab.ts",
    "old": "    itemLine: /^item:\\s*(\\S+)$/,",
    "new": "    itemLine: /^item:\\s*(\\S+)/,",
    "tests": "test/enhance-vocab.test.ts"
  }
]
```

## Editorial: the format contract read, and the item link (`src/enhance/editorial.ts`) (L2-T8-M103 to L2-T8-M152)

editorial.ts reading the box headings, the callout kinds and the kind keys from the vocabulary; the item link by its
byline route (the first item fact only, its keys in text and in code, an author's link left alone, the text split
around a key, the arrow hidden from speech) and its delta route (a level-2 child heading of the root, the section up
to the next h2, its first code block, highlighted or not, its first line that is not blank, a value that is a key, a
key with no link is no delta, the fact it fills or adds, and where); the host asked once per key, for at most 16 keys;
the host's link checked (a string of 1 to 2048 code units, no white space or control character, http or https when it
names a scheme, in any case); the link's target, rel and label; and a click through onLink (only with it, the main
button only, not one already prevented, the default prevented, newTab true).

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T8-M103 | format contract read: the "In short" box | `src/enhance/editorial.ts` | `  const short = h2s.find((h) => ctx.vocab.box.short.test(labelOf(h)));` → `  const short = h2s.find((h) => /^in short$/i.test(labelOf(h)));` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "editorial.ts reads them from the vocabulary, never from words of its own"; "editorial.ts matches no word of its own: no pattern in it names a box heading or a front-matter kind key" |
| L2-T8-M104 | format contract read: the "Where things stand" box | `src/enhance/editorial.ts` | `  const stand = h2s.find((h) => ctx.vocab.box.stand.test(labelOf(h)));` → `  const stand = h2s.find((h) => /^where things stand$/i.test(labelOf(h)));` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "editorial.ts reads them from the vocabulary, never from words of its own"; "editorial.ts matches no word of its own: no pattern in it names a box heading or a front-matter kind key" |
| L2-T8-M105 | format contract read: the callout kinds | `src/enhance/editorial.ts` | `      const c = callout.agreed.test(k) ? 'agreed' : callout.waiting.test(k) ? 'waiting' : callout.la…` → `      const c = k.toLowerCase().startsWith('agreed') ? 'agreed' : k.toLowerCase().startsWith('waitin…` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "editorial.ts reads them from the vocabulary, never from words of its own" |
| L2-T8-M106 | format contract read: the kind keys | `src/enhance/editorial.ts` | `if (!f.list && ctx.vocab.kindKey.test(f.key))` → `if (!f.list && /^(?:type\|area\|status\|kind)$/i.test(f.key))` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "editorial.ts reads them from the vocabulary, never from words of its own"; "editorial.ts matches no word of its own: no pattern in it names a box heading or a front-matter kind key" |
| L2-T8-M107 | byline route: the first item fact only | `src/enhance/editorial.ts` | `      const isItem: boolean = !itemFact && vocab.itemField.test(dt);` → `      const isItem: boolean = vocab.itemField.test(dt);` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "only the first fact with an item label is read, and a label is matched whole and literally" |
| L2-T8-M108 | byline route: an item fact is remembered | `src/enhance/editorial.ts` | `      itemFact \|\|= isItem; ⏎ ` → (deleted) | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "only the first fact with an item label is read, and a label is matched whole and literally"; "the delta's key replaces the item fact's value; the fact's own nodes stay in the hidden meta line" |
| L2-T8-M109 | byline route: the item fact's nodes are read | `src/enhance/editorial.ts` | `      if (isItem) item = moved; ⏎ ` → (deleted) | `test/enhance-vocab.test.ts`: 25 failed \| 117 passed (142). "the key's own text moves into a link: href from itemLink, opened in a new tab, an arrow after it"; "every key in the fact: in its text, in its own code; never an author's link, a lower-case or a run-on key"; "a key named twice is asked for once and linked twice"; "at most 16 keys are asked for and linked; the rest stay text"; "at most 64 links are written: one key repeated past them stays text, and the host is asked once" (and 15 more printed) |
| L2-T8-M110 | delta route: the item fact shows the delta's link, its own nodes left in place | `src/enhance/editorial.ts` | `      if (isItem && delta !== null && links !== null) { ⏎         facts.push(fact(dt, deltaValue(del…` → (deleted) | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "the delta's key replaces the item fact's value; the fact's own nodes stay in the hidden meta line"; "a section whose first code block names no key passes to the next section with an item heading" |
| L2-T8-M111 | delta route: a fact of its own without an item fact | `src/enhance/editorial.ts` | `  if (delta !== null && links !== null && !itemFact) facts.splice(beforeWide(), 0, fact(vocab.words.…` → (deleted) | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "without an item fact the delta's key is a fact of its own, labelled by the first item field, before the wide ones" |
| L2-T8-M112 | delta route: that fact labelled with the first item field | `src/enhance/editorial.ts` | `fact(vocab.words.itemFields[0] ?? '', deltaValue(delta, links), false)` → `fact('', deltaValue(delta, links), false)` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "without an item fact the delta's key is a fact of its own, labelled by the first item field, before the wide ones" |
| L2-T8-M113 | delta route: that fact before the wide ones | `src/enhance/editorial.ts` | `  if (delta !== null && links !== null && !itemFact) facts.splice(beforeWide(), 0, ` → `  if (delta !== null && links !== null && !itemFact) facts.splice(facts.length, 0, ` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "without an item fact the delta's key is a fact of its own, labelled by the first item field, before the wide ones" |
| L2-T8-M114 | delta route: a child heading of the root | `src/enhance/editorial.ts` | `  for (const h of Array.from(root.children)) {` → `  for (const h of Array.from(root.querySelectorAll('h2'))) {` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "a heading that is not a child of the root, or a section past its next h2, is not read" |
| L2-T8-M115 | delta route: a level-2 heading | `src/enhance/editorial.ts` | `    if (h.localName !== 'h2' \|\| !vocab.itemHeading.test(txt(h))) continue;` → `    if (!vocab.itemHeading.test(txt(h))) continue;` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "a level-3 heading of those words is not read" |
| L2-T8-M116 | delta route: an item heading | `src/enhance/editorial.ts` | `    if (h.localName !== 'h2' \|\| !vocab.itemHeading.test(txt(h))) continue;` → `    if (h.localName !== 'h2') continue;` | `test/enhance-vocab.test.ts`: 8 failed \| 134 passed (142). "with itemLink but no route (the defaults name none), itemLink is never called"; "the key's own text moves into a link: href from itemLink, opened in a new tab, an arrow after it"; "the heading: an optional section number, then the words whole, a space or a dash between them; literal"; "a level-3 heading of those words is not read"; "a heading that is not a child of the root, or a section past its next h2, is not read" (and 3 more printed) |
| L2-T8-M117 | delta route: the section ends at the next h2 | `src/enhance/editorial.ts` | `    for (let n = h.nextElementSibling; n !== null && n.localName !== 'h2'; n = n.nextElementSibling)…` → `    for (let n = h.nextElementSibling; n !== null; n = n.nextElementSibling) { ⏎       const pre` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "a heading that is not a child of the root, or a section past its next h2, is not read" |
| L2-T8-M118 | delta route: a highlighted block's pre | `src/enhance/editorial.ts` | `n.classList.contains('codehilite') ? n.querySelector('pre') : null;` → `null;` | `test/enhance-vocab.test.ts`: 6 failed \| 136 passed (142). "the delta's key replaces the item fact's value; the fact's own nodes stay in the hidden meta line"; "without an item fact the delta's key is a fact of its own, labelled by the first item field, before the wide ones"; "a section whose first code block names no key passes to the next section with an item heading"; "the heading: an optional section number, then the words whole, a space or a dash between them; literal"; "an itemLink that destroys the reader on the delta's key stops the build before the byline" (and 1 more printed) |
| L2-T8-M119 | delta route: the first line that is not blank | `src/enhance/editorial.ts` | `.split('\n').find((l) => l.trim() !== '') ?? '';` → `.split('\n')[0] ?? '';` | `test/enhance-vocab.test.ts`: 6 failed \| 136 passed (142). "the delta's key replaces the item fact's value; the fact's own nodes stay in the hidden meta line"; "without an item fact the delta's key is a fact of its own, labelled by the first item field, before the wide ones"; "a section whose first code block names no key passes to the next section with an item heading"; "the heading: an optional section number, then the words whole, a space or a dash between them; literal"; "an itemLink that destroys the reader on the delta's key stops the build before the byline" (and 1 more printed) |
| L2-T8-M120 | delta route: the value is a key | `src/enhance/editorial.ts` | `      if (key !== undefined && vocab.itemKey.test(key)) return key;` → `      if (key !== undefined) return key;` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "an item line whose value is no key is no delta, and the byline route applies" |
| L2-T8-M121 | delta route: only the first code block | `src/enhance/editorial.ts` | `      break; // the section's first code block is its delta ⏎ ` → (deleted) | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "only the section's first code block counts, its first line that is not blank, as `item: <key>`"; "an item line whose value is no key is no delta, and the byline route applies" |
| L2-T8-M122 | delta route: a key with no link is no delta | `src/enhance/editorial.ts` | `      if (href !== null) delta = { key, href };` → `      delta = { key, href: href as string };` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "a delta key the host gives no link for is no delta: the byline route applies" |
| L2-T8-M123 | delta route: stop when the host destroyed the reader | `src/enhance/editorial.ts` | `      const href = links.hrefOf(key); ⏎       if (!ctx.live()) return; ⏎ ` → `      const href = links.hrefOf(key); ⏎ ` | Reported (green, guard kept): once the host has destroyed the instance inside `itemLink`, its wrapper (Task 5) answers null for that call and makes no further one, so there is no delta; without the check the build goes on into the byline, whose first `journal.split` throws once the instance is not live, and the lifecycle reports the startup as aborted all the same. The case "an itemLink that destroys the reader on the delta's key stops the build before the byline" passes either way. The check stays for the plan's rule that live() is checked after each call-out (host.ts says the same), so the build stops at once rather than through that throw. |
| L2-T8-M124 | byline route: stop when the host destroyed the reader | `src/enhance/editorial.ts` | `    const href = links.hrefOf(spot.key); ⏎     if (!ctx.live()) return false; ⏎ ` → `    const href = links.hrefOf(spot.key); ⏎ ` | Reported (green, guard kept): as L2-T8-M123, for the byline route. The wrapper answers null for the call that destroyed the instance and makes no further call, so without the check no key has a link and the write loop writes nothing; the case "an itemLink that destroys the reader stops the build: no more calls, and the root comes back whole" passes either way. The check stays for the plan's rule (live() after each call-out). |
| L2-T8-M125 | byline route: an author's link left alone | `src/enhance/editorial.ts` | `    if (el.localName === 'a') return; // an author's link stays the author's ⏎ ` → (deleted) | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "every key in the fact: in its text, in its own code; never an author's link, a lower-case or a run-on key" |
| L2-T8-M126 | byline route: a code element linked whole | `src/enhance/editorial.ts` | `    if (el.localName === 'code') { ⏎       if (vocab.itemKey.test(txt(el))) spots.push({ key: txt(el…` → (deleted) | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "every key in the fact: in its text, in its own code; never an author's link, a lower-case or a run-on key" |
| L2-T8-M127 | byline route: a code element only when its text is a key | `src/enhance/editorial.ts` | `      if (vocab.itemKey.test(txt(el))) spots.push({ key: txt(el), code: el });` → `      spots.push({ key: txt(el), code: el });` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "every key in the fact: in its text, in its own code; never an author's link, a lower-case or a run-on key" |
| L2-T8-M128 | byline route: the last key of a text first | `src/enhance/editorial.ts` | `  for (const spot of [...spots].reverse()) {` → `  for (const spot of spots) {` | `test/enhance-vocab.test.ts`: 5 failed \| 137 passed (142). "every key in the fact: in its text, in its own code; never an author's link, a lower-case or a run-on key"; "a key named twice is asked for once and linked twice"; "at most 16 keys are asked for and linked; the rest stay text"; "at most 64 links are written: one key repeated past them stays text, and the host is asked once"; "one click listener for every item link of the byline, never one per link" |
| L2-T8-M129 | byline route: the text after the key split off | `src/enhance/editorial.ts` | `      if (end < spot.text.data.length) journal.split(spot.text, end); ⏎ ` → (deleted) | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "every key in the fact: in its text, in its own code; never an author's link, a lower-case or a run-on key"; "at most 16 keys are asked for and linked; the rest stay text" |
| L2-T8-M130 | byline route: the text before the key split off | `src/enhance/editorial.ts` | `      node = spot.at > 0 ? journal.split(spot.text, spot.at) : spot.text;` → `      node = spot.text;` | `test/enhance-vocab.test.ts`: 4 failed \| 138 passed (142). "the key's own text moves into a link: href from itemLink, opened in a new tab, an arrow after it"; "every key in the fact: in its text, in its own code; never an author's link, a lower-case or a run-on key"; "at most 16 keys are asked for and linked; the rest stay text"; "a throwing itemLink leaves that key as text and the others linked" |
| L2-T8-M131 | the arrow after the key | `src/enhance/editorial.ts` | `    journal.insert(links.arrow(), a, null); ⏎ ` → (deleted) | `test/enhance-vocab.test.ts`: 6 failed \| 136 passed (142). "the key's own text moves into a link: href from itemLink, opened in a new tab, an arrow after it"; "every key in the fact: in its text, in its own code; never an author's link, a lower-case or a run-on key"; "a delta key the host gives no link for is no delta: the byline route applies"; "with onLink: the host gets the link and newTab true, and the default is prevented"; "a click whose default something inside the link already prevented is left alone" (and 1 more printed) |
| L2-T8-M132 | the arrow hidden from speech | `src/enhance/editorial.ts` | `text: ' ↗', attrs: { 'aria-hidden': 'true' } })` → `text: ' ↗' })` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "the key's own text moves into a link: href from itemLink, opened in a new tab, an arrow after it" |
| L2-T8-M133 | the host asked once per key | `src/enhance/editorial.ts` | `      if (asked.has(key)) return asked.get(key) ?? null; ⏎ ` → (deleted) | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "a key named twice is asked for once and linked twice"; "at most 64 links are written: one key repeated past them stays text, and the host is asked once" |
| L2-T8-M134 | at most 16 keys asked | `src/enhance/editorial.ts` | `      if (asked.size >= ITEM_LINKS.keys) return null; ⏎ ` → (deleted) | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "at most 16 keys are asked for and linked; the rest stay text" |
| L2-T8-M135 | the bound is 16 keys | `src/enhance/editorial.ts` | `export const ITEM_LINKS = { keys: 16, links: 64, href: 2048 } as const;` → `export const ITEM_LINKS = { keys: 17, links: 64, href: 2048 } as const;` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "at most 16 keys are asked for and linked; the rest stay text" |
| L2-T8-M136 | the link: a string | `src/enhance/editorial.ts` | `  if (typeof v !== 'string' \|\| v.length === 0 \|\|` → `  if (v.length === 0 \|\|` | `test/enhance-vocab.test.ts`: 5 failed \| 137 passed (142). "no link: null"; "no link: undefined"; "no link: a number"; "a throwing itemLink leaves that key as text and the others linked"; "a delta key the host gives no link for is no delta: the byline route applies" |
| L2-T8-M137 | the link: not empty | `src/enhance/editorial.ts` | `  if (typeof v !== 'string' \|\| v.length === 0 \|\|` → `  if (typeof v !== 'string' \|\|` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "no link: empty" |
| L2-T8-M138 | the link: at most 2048 code units | `src/enhance/editorial.ts` | `v.length > ITEM_LINKS.href \|\|` → `v.length > ITEM_LINKS.href + 1 \|\|` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "no link: a link over 2048 code units" |
| L2-T8-M139 | the link: no white space or control character | `src/enhance/editorial.ts` | ` \|\| HREF_REFUSED.test(v)) return null;` → `) return null;` | `test/enhance-vocab.test.ts`: 13 failed \| 129 passed (142). "no link: a tab inside the scheme"; "no link: a leading space"; "no link: a new line"; "no link: a control character"; "no link: a delete character" (and 8 more printed) |
| L2-T8-M140 | the link: white space is refused | `src/enhance/editorial.ts` | `const HREF_REFUSED = /[\u0000-\u001f\u007f-\u009f\s]/;` → `const HREF_REFUSED = /[\u0000-\u001f\u007f-\u009f]/;` | `test/enhance-vocab.test.ts`: 7 failed \| 135 passed (142). "no link: a leading space"; "no link: a no-break space"; "no link: a line separator"; "no link: an ideographic space"; "no link: an ogham space mark" (and 2 more printed) |
| L2-T8-M141 | the link: a delete character is refused | `src/enhance/editorial.ts` | `const HREF_REFUSED = /[\u0000-\u001f\u007f-\u009f\s]/;` → `const HREF_REFUSED = /[\u0000-\u001f\u0080-\u009f\s]/;` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "no link: a delete character" |
| L2-T8-M142 | the link: http or https when it names a scheme | `src/enhance/editorial.ts` | `  return scheme === undefined \|\| scheme === 'http' \|\| scheme === 'https' ? v : null;` → `  return v;` | `test/enhance-vocab.test.ts`: 4 failed \| 138 passed (142). "no link: a script link"; "no link: a script link in capitals"; "no link: a data link"; "no link: a mail link" |
| L2-T8-M143 | the link: a scheme in any case | `src/enhance/editorial.ts` | `  const scheme = SCHEME.exec(v)?.[1]?.toLowerCase();` → `  const scheme = SCHEME.exec(v)?.[1];` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "linked: an http link, any case" |
| L2-T8-M144 | the link: a scheme read in any case | `src/enhance/editorial.ts` | `const SCHEME = /^([a-z][a-z0-9+.-]*):/i;` → `const SCHEME = /^([a-z][a-z0-9+.-]*):/;` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "no link: a script link in capitals" |
| L2-T8-M145 | the link opens in a new tab | `src/enhance/editorial.ts` | `attrs: { href, target: '_blank', rel:` → `attrs: { href, rel:` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "the key's own text moves into a link: href from itemLink, opened in a new tab, an arrow after it" |
| L2-T8-M146 | the link carries no opener or referrer | `src/enhance/editorial.ts` | ` rel: 'noopener noreferrer',` → (deleted) | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "the key's own text moves into a link: href from itemLink, opened in a new tab, an arrow after it" |
| L2-T8-M147 | the link names its key and its new tab | `src/enhance/editorial.ts` | `, 'aria-label': `${key} (opens in a new tab)` },` → ` },` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "the key's own text moves into a link: href from itemLink, opened in a new tab, an arrow after it" |
| L2-T8-M148 | a click: only with onLink | `src/enhance/editorial.ts` | `        if (href === undefined \|\| e.defaultPrevented \|\| e.button !== 0 \|\| !ctx.host.present.has('onLink')) return;` → `        if (href === undefined \|\| e.defaultPrevented \|\| e.button !== 0) return;` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "without onLink the browser follows it (into a new tab, by its target)" |
| L2-T8-M149 | a click: the main button only | `src/enhance/editorial.ts` | `        if (href === undefined \|\| e.defaultPrevented \|\| e.button !== 0 \|\| !ctx.host.present.has('onLink')) return;` → `        if (href === undefined \|\| e.defaultPrevented \|\| !ctx.host.present.has('onLink')) return;` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "a click with another button is left to the browser" |
| L2-T8-M150 | a click: not one already prevented | `src/enhance/editorial.ts` | `        if (href === undefined \|\| e.defaultPrevented \|\| e.button !== 0 \|\| !ctx.host.present.has('onLink')) return;` → `        if (href === undefined \|\| e.button !== 0 \|\| !ctx.host.present.has('onLink')) return;` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "a click whose default something inside the link already prevented is left alone" |
| L2-T8-M151 | a click: the default prevented | `src/enhance/editorial.ts` | `        e.preventDefault(); ⏎         ctx.host.onLink(href, { newTab: true });` → `        ctx.host.onLink(href, { newTab: true });` | `test/enhance-vocab.test.ts`: 3 failed \| 139 passed (142). "with onLink: the host gets the link and newTab true, and the default is prevented"; "a plain click on the arrow inside the link is the link's: newTab true"; "a click whose target is the link's own text node goes to onLink too" |
| L2-T8-M152 | a click: in a new tab | `src/enhance/editorial.ts` | `        ctx.host.onLink(href, { newTab: true });` → `        ctx.host.onLink(href, { newTab: e.ctrlKey });` | `test/enhance-vocab.test.ts`: 4 failed \| 138 passed (142). "with onLink: the host gets the link and newTab true, and the default is prevented"; "a click on an author's link in the byline is not the item link's: it reaches onLink as written, without newTab"; "a plain click on the arrow inside the link is the link's: newTab true"; "a click whose target is the link's own text node goes to onLink too" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T8-M103",
    "guard": "format contract read: the \"In short\" box",
    "file": "src/enhance/editorial.ts",
    "old": "  const short = h2s.find((h) => ctx.vocab.box.short.test(labelOf(h)));",
    "new": "  const short = h2s.find((h) => /^in short$/i.test(labelOf(h)));",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M104",
    "guard": "format contract read: the \"Where things stand\" box",
    "file": "src/enhance/editorial.ts",
    "old": "  const stand = h2s.find((h) => ctx.vocab.box.stand.test(labelOf(h)));",
    "new": "  const stand = h2s.find((h) => /^where things stand$/i.test(labelOf(h)));",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M105",
    "guard": "format contract read: the callout kinds",
    "file": "src/enhance/editorial.ts",
    "old": "      const c = callout.agreed.test(k) ? 'agreed' : callout.waiting.test(k) ? 'waiting' : callout.later.test(k) ? 'later' : 'other';",
    "new": "      const c = k.toLowerCase().startsWith('agreed') ? 'agreed' : k.toLowerCase().startsWith('waiting') ? 'waiting' : k.toLowerCase().startsWith('later') ? 'later' : 'other';",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M106",
    "guard": "format contract read: the kind keys",
    "file": "src/enhance/editorial.ts",
    "old": "if (!f.list && ctx.vocab.kindKey.test(f.key))",
    "new": "if (!f.list && /^(?:type|area|status|kind)$/i.test(f.key))",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M107",
    "guard": "byline route: the first item fact only",
    "file": "src/enhance/editorial.ts",
    "old": "      const isItem: boolean = !itemFact && vocab.itemField.test(dt);",
    "new": "      const isItem: boolean = vocab.itemField.test(dt);",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M108",
    "guard": "byline route: an item fact is remembered",
    "file": "src/enhance/editorial.ts",
    "old": "      itemFact ||= isItem;\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M109",
    "guard": "byline route: the item fact's nodes are read",
    "file": "src/enhance/editorial.ts",
    "old": "      if (isItem) item = moved;\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M110",
    "guard": "delta route: the item fact shows the delta's link, its own nodes left in place",
    "file": "src/enhance/editorial.ts",
    "old": "      if (isItem && delta !== null && links !== null) {\n        facts.push(fact(dt, deltaValue(delta, links), len > 70)); // its own nodes stay in the hidden paragraph\n        continue;\n      }\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M111",
    "guard": "delta route: a fact of its own without an item fact",
    "file": "src/enhance/editorial.ts",
    "old": "  if (delta !== null && links !== null && !itemFact) facts.splice(beforeWide(), 0, fact(vocab.words.itemFields[0] ?? '', deltaValue(delta, links), false));\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M112",
    "guard": "delta route: that fact labelled with the first item field",
    "file": "src/enhance/editorial.ts",
    "old": "fact(vocab.words.itemFields[0] ?? '', deltaValue(delta, links), false)",
    "new": "fact('', deltaValue(delta, links), false)",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M113",
    "guard": "delta route: that fact before the wide ones",
    "file": "src/enhance/editorial.ts",
    "old": "  if (delta !== null && links !== null && !itemFact) facts.splice(beforeWide(), 0, ",
    "new": "  if (delta !== null && links !== null && !itemFact) facts.splice(facts.length, 0, ",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M114",
    "guard": "delta route: a child heading of the root",
    "file": "src/enhance/editorial.ts",
    "old": "  for (const h of Array.from(root.children)) {",
    "new": "  for (const h of Array.from(root.querySelectorAll('h2'))) {",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M115",
    "guard": "delta route: a level-2 heading",
    "file": "src/enhance/editorial.ts",
    "old": "    if (h.localName !== 'h2' || !vocab.itemHeading.test(txt(h))) continue;",
    "new": "    if (!vocab.itemHeading.test(txt(h))) continue;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M116",
    "guard": "delta route: an item heading",
    "file": "src/enhance/editorial.ts",
    "old": "    if (h.localName !== 'h2' || !vocab.itemHeading.test(txt(h))) continue;",
    "new": "    if (h.localName !== 'h2') continue;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M117",
    "guard": "delta route: the section ends at the next h2",
    "file": "src/enhance/editorial.ts",
    "old": "    for (let n = h.nextElementSibling; n !== null && n.localName !== 'h2'; n = n.nextElementSibling) {\n      const pre",
    "new": "    for (let n = h.nextElementSibling; n !== null; n = n.nextElementSibling) {\n      const pre",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M118",
    "guard": "delta route: a highlighted block's pre",
    "file": "src/enhance/editorial.ts",
    "old": "n.classList.contains('codehilite') ? n.querySelector('pre') : null;",
    "new": "null;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M119",
    "guard": "delta route: the first line that is not blank",
    "file": "src/enhance/editorial.ts",
    "old": ".split('\\n').find((l) => l.trim() !== '') ?? '';",
    "new": ".split('\\n')[0] ?? '';",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M120",
    "guard": "delta route: the value is a key",
    "file": "src/enhance/editorial.ts",
    "old": "      if (key !== undefined && vocab.itemKey.test(key)) return key;",
    "new": "      if (key !== undefined) return key;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M121",
    "guard": "delta route: only the first code block",
    "file": "src/enhance/editorial.ts",
    "old": "      break; // the section's first code block is its delta\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M122",
    "guard": "delta route: a key with no link is no delta",
    "file": "src/enhance/editorial.ts",
    "old": "      if (href !== null) delta = { key, href };",
    "new": "      delta = { key, href: href as string };",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M125",
    "guard": "byline route: an author's link left alone",
    "file": "src/enhance/editorial.ts",
    "old": "    if (el.localName === 'a') return; // an author's link stays the author's\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M126",
    "guard": "byline route: a code element linked whole",
    "file": "src/enhance/editorial.ts",
    "old": "    if (el.localName === 'code') {\n      if (vocab.itemKey.test(txt(el))) spots.push({ key: txt(el), code: el });\n      return;\n    }\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M127",
    "guard": "byline route: a code element only when its text is a key",
    "file": "src/enhance/editorial.ts",
    "old": "      if (vocab.itemKey.test(txt(el))) spots.push({ key: txt(el), code: el });",
    "new": "      spots.push({ key: txt(el), code: el });",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M128",
    "guard": "byline route: the last key of a text first",
    "file": "src/enhance/editorial.ts",
    "old": "  for (const spot of [...spots].reverse()) {",
    "new": "  for (const spot of spots) {",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M129",
    "guard": "byline route: the text after the key split off",
    "file": "src/enhance/editorial.ts",
    "old": "      if (end < spot.text.data.length) journal.split(spot.text, end);\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M130",
    "guard": "byline route: the text before the key split off",
    "file": "src/enhance/editorial.ts",
    "old": "      node = spot.at > 0 ? journal.split(spot.text, spot.at) : spot.text;",
    "new": "      node = spot.text;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M131",
    "guard": "the arrow after the key",
    "file": "src/enhance/editorial.ts",
    "old": "    journal.insert(links.arrow(), a, null);\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M132",
    "guard": "the arrow hidden from speech",
    "file": "src/enhance/editorial.ts",
    "old": "text: ' ↗', attrs: { 'aria-hidden': 'true' } })",
    "new": "text: ' ↗' })",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M133",
    "guard": "the host asked once per key",
    "file": "src/enhance/editorial.ts",
    "old": "      if (asked.has(key)) return asked.get(key) ?? null;\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M134",
    "guard": "at most 16 keys asked",
    "file": "src/enhance/editorial.ts",
    "old": "      if (asked.size >= ITEM_LINKS.keys) return null;\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M135",
    "guard": "the bound is 16 keys",
    "file": "src/enhance/editorial.ts",
    "old": "export const ITEM_LINKS = { keys: 16, links: 64, href: 2048 } as const;",
    "new": "export const ITEM_LINKS = { keys: 17, links: 64, href: 2048 } as const;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M136",
    "guard": "the link: a string",
    "file": "src/enhance/editorial.ts",
    "old": "  if (typeof v !== 'string' || v.length === 0 ||",
    "new": "  if (v.length === 0 ||",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M137",
    "guard": "the link: not empty",
    "file": "src/enhance/editorial.ts",
    "old": "  if (typeof v !== 'string' || v.length === 0 ||",
    "new": "  if (typeof v !== 'string' ||",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M138",
    "guard": "the link: at most 2048 code units",
    "file": "src/enhance/editorial.ts",
    "old": "v.length > ITEM_LINKS.href ||",
    "new": "v.length > ITEM_LINKS.href + 1 ||",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M139",
    "guard": "the link: no white space or control character",
    "file": "src/enhance/editorial.ts",
    "old": " || HREF_REFUSED.test(v)) return null;",
    "new": ") return null;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M140",
    "guard": "the link: white space is refused",
    "file": "src/enhance/editorial.ts",
    "old": "const HREF_REFUSED = /[\\u0000-\\u001f\\u007f-\\u009f\\s]/;",
    "new": "const HREF_REFUSED = /[\\u0000-\\u001f\\u007f-\\u009f]/;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M141",
    "guard": "the link: a delete character is refused",
    "file": "src/enhance/editorial.ts",
    "old": "const HREF_REFUSED = /[\\u0000-\\u001f\\u007f-\\u009f\\s]/;",
    "new": "const HREF_REFUSED = /[\\u0000-\\u001f\\u0080-\\u009f\\s]/;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M142",
    "guard": "the link: http or https when it names a scheme",
    "file": "src/enhance/editorial.ts",
    "old": "  return scheme === undefined || scheme === 'http' || scheme === 'https' ? v : null;",
    "new": "  return v;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M143",
    "guard": "the link: a scheme in any case",
    "file": "src/enhance/editorial.ts",
    "old": "  const scheme = SCHEME.exec(v)?.[1]?.toLowerCase();",
    "new": "  const scheme = SCHEME.exec(v)?.[1];",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M144",
    "guard": "the link: a scheme read in any case",
    "file": "src/enhance/editorial.ts",
    "old": "const SCHEME = /^([a-z][a-z0-9+.-]*):/i;",
    "new": "const SCHEME = /^([a-z][a-z0-9+.-]*):/;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M145",
    "guard": "the link opens in a new tab",
    "file": "src/enhance/editorial.ts",
    "old": "attrs: { href, target: '_blank', rel:",
    "new": "attrs: { href, rel:",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M146",
    "guard": "the link carries no opener or referrer",
    "file": "src/enhance/editorial.ts",
    "old": " rel: 'noopener noreferrer',",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M147",
    "guard": "the link names its key and its new tab",
    "file": "src/enhance/editorial.ts",
    "old": ", 'aria-label': `${key} (opens in a new tab)` },",
    "new": " },",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M148",
    "guard": "a click: only with onLink",
    "file": "src/enhance/editorial.ts",
    "old": "        if (href === undefined || e.defaultPrevented || e.button !== 0 || !ctx.host.present.has('onLink')) return;",
    "new": "        if (href === undefined || e.defaultPrevented || e.button !== 0) return;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M149",
    "guard": "a click: the main button only",
    "file": "src/enhance/editorial.ts",
    "old": "        if (href === undefined || e.defaultPrevented || e.button !== 0 || !ctx.host.present.has('onLink')) return;",
    "new": "        if (href === undefined || e.defaultPrevented || !ctx.host.present.has('onLink')) return;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M150",
    "guard": "a click: not one already prevented",
    "file": "src/enhance/editorial.ts",
    "old": "        if (href === undefined || e.defaultPrevented || e.button !== 0 || !ctx.host.present.has('onLink')) return;",
    "new": "        if (href === undefined || e.button !== 0 || !ctx.host.present.has('onLink')) return;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M151",
    "guard": "a click: the default prevented",
    "file": "src/enhance/editorial.ts",
    "old": "        e.preventDefault();\n        ctx.host.onLink(href, { newTab: true });",
    "new": "        ctx.host.onLink(href, { newTab: true });",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M152",
    "guard": "a click: in a new tab",
    "file": "src/enhance/editorial.ts",
    "old": "        ctx.host.onLink(href, { newTab: true });",
    "new": "        ctx.host.onLink(href, { newTab: e.ctrlKey });",
    "tests": "test/enhance-vocab.test.ts"
  }
]
```

## The README's two rows (L2-T8-M153 to L2-T8-M154)

The `vocabulary` and `namespace` rows, which Task 5's options table must hold (see the PR): each states the default
and the bounds the code holds.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T8-M153 | README: the vocabulary row states the bounds | `README.md` | `A list holds at most 200 words, each 1 to 64 code units` → `A list holds at most 100 words, each 1 to 64 code units` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "each row states the default and the bounds the code holds" |
| L2-T8-M154 | README: the namespace row states the default | `README.md` | `\| `namespace` \| `docreader` \|` → `\| `namespace` \| `reader` \|` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "each row states the default and the bounds the code holds" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T8-M153",
    "guard": "README: the vocabulary row states the bounds",
    "file": "README.md",
    "old": "A list holds at most 200 words, each 1 to 64 code units",
    "new": "A list holds at most 100 words, each 1 to 64 code units",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M154",
    "guard": "README: the namespace row states the default",
    "file": "README.md",
    "old": "| `namespace` | `docreader` |",
    "new": "| `namespace` | `reader` |",
    "tests": "test/enhance-vocab.test.ts"
  }
]
```

## The review round (L2-T8-M155 to L2-T8-M187)

The guards the review round's fixes added: a word with white space at either end refused (`src/enhance/options.ts`);
the whole word in any script, `whole()`, at each pattern that reads one, and the ruling header's "?" rule standing with
an empty list (`src/enhance/vocab.ts`); and in the item link (`src/enhance/editorial.ts`), the link check's C0 and C1
controls, the delta route passing to a later section, at most 64 links written, the one delegated click listener on the
byline, and the item link only with `itemLink`. L2-T8-M187 pins the README row's word rule. L2-T8-M186 is reported,
green with its guard kept, and is not in the fence.

| Row | Guard | File | Change | Red (tests in the named file) |
|---|---|---|---|---|
| L2-T8-M155 | a word: no white space at either end | `src/enhance/options.ts` | `    if (typeof w !== 'string' \|\| w.length > LIMITS.word \|\| w === '' \|\| w.trim() !== w) {` → `    if (typeof w !== 'string' \|\| w.length > LIMITS.word \|\| w === '') {` | `test/enhance-vocab.test.ts`: 6 failed \| 136 passed (142). "refused: a word of white space"; "refused: a word opening on a space"; "refused: a word ending on a tab"; "refused: a word opening on a no-break space"; "refused: a heading ending on an ideographic space" (and 1 more printed) |
| L2-T8-M156 | whole word: bounded before, on a word-character edge | `src/enhance/vocab.ts` | `    const lead = before && isWordChar(cps[0]) ? NOT_AFTER_WORD : '';` → `    const lead = '';` | `test/enhance-vocab.test.ts`: 3 failed \| 139 passed (142). "status-column headers: whole, in any script and any case; one ending in "?" needs no boundary after"; "addressees, qualifiers and the attention words: whole, in any script"; "an ID is whole in any script: a prefix of another script, and the default grammar with a letter on either side" |
| L2-T8-M157 | whole word: bounded after, on a word-character edge | `src/enhance/vocab.ts` | `    const tail = after && isWordChar(cps[cps.length - 1]) ? NOT_BEFORE_WORD : '';` → `    const tail = '';` | `test/enhance-vocab.test.ts`: 7 failed \| 135 passed (142). "the defaults reproduce the prototype's marks, given or left out"; "a custom status list changes the marks: it replaces its role's words, the other roles keep theirs"; "custom status-column headers, and ruling headers"; "a status word opens a status in any script, or ending in punctuation or a symbol; a letter, digit or mark after a letter edge stops it"; "the default words keep their whole-word rule, now by every script: a letter after an ASCII word stops it too" (and 2 more printed) |
| L2-T8-M158 | whole word: an edge that is no word character asks nothing after it | `src/enhance/vocab.ts` | `const tail = after && isWordChar(cps[cps.length - 1]) ?` → `const tail = after ?` | `test/enhance-vocab.test.ts`: 3 failed \| 139 passed (142). "a status word opens a status in any script, or ending in punctuation or a symbol; a letter, digit or mark after a letter edge stops it"; "status-column headers: whole, in any script and any case; one ending in "?" needs no boundary after"; "addressees, qualifiers and the attention words: whole, in any script" |
| L2-T8-M159 | whole word: an edge that is no word character asks nothing before it | `src/enhance/vocab.ts` | `const lead = before && isWordChar(cps[0]) ?` → `const lead = before ?` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "addressees, qualifiers and the attention words: whole, in any script" |
| L2-T8-M160 | whole word: a word's edge is a word character of any script | `src/enhance/vocab.ts` | `/^[\p{L}\p{N}\p{M}_]$/u.test(c)` → `/^[A-Za-z0-9_]$/u.test(c)` | `test/enhance-vocab.test.ts`: 4 failed \| 138 passed (142). "a status word opens a status in any script, or ending in punctuation or a symbol; a letter, digit or mark after a letter edge stops it"; "status-column headers: whole, in any script and any case; one ending in "?" needs no boundary after"; "addressees, qualifiers and the attention words: whole, in any script"; "an ID is whole in any script: a prefix of another script, and the default grammar with a letter on either side" |
| L2-T8-M161 | whole word: the text beyond is a word character of any script | `src/enhance/vocab.ts` | `const WORD_CHAR = '[\\p{L}\\p{N}\\p{M}_]';` → `const WORD_CHAR = '[A-Za-z0-9_]';` | `test/enhance-vocab.test.ts`: 5 failed \| 137 passed (142). "a status word opens a status in any script, or ending in punctuation or a symbol; a letter, digit or mark after a letter edge stops it"; "the default words keep their whole-word rule, now by every script: a letter after an ASCII word stops it too"; "status-column headers: whole, in any script and any case; one ending in "?" needs no boundary after"; "addressees, qualifiers and the attention words: whole, in any script"; "an ID is whole in any script: a prefix of another script, and the default grammar with a letter on either side" |
| L2-T8-M162 | whole word: a combining mark continues a word | `src/enhance/vocab.ts` | `const WORD_CHAR = '[\\p{L}\\p{N}\\p{M}_]';` → `const WORD_CHAR = '[\\p{L}\\p{N}_]';` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "a status word opens a status in any script, or ending in punctuation or a symbol; a letter, digit or mark after a letter edge stops it" |
| L2-T8-M163 | whole word: a digit continues a word | `src/enhance/vocab.ts` | `const WORD_CHAR = '[\\p{L}\\p{N}\\p{M}_]';` → `const WORD_CHAR = '[\\p{L}\\p{M}_]';` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "a status word opens a status in any script, or ending in punctuation or a symbol; a letter, digit or mark after a letter edge stops it"; "an ID is whole in any script: a prefix of another script, and the default grammar with a letter on either side" |
| L2-T8-M164 | status roles: a whole word | `src/enhance/vocab.ts` | ``^(${whole(w.status[r], false, true)})`` → ``^(${anyOf(w.status[r])})`` | `test/enhance-vocab.test.ts`: 5 failed \| 137 passed (142). "the defaults reproduce the prototype's marks, given or left out"; "a custom status list changes the marks: it replaces its role's words, the other roles keep theirs"; "custom status-column headers, and ruling headers"; "a status word opens a status in any script, or ending in punctuation or a symbol; a letter, digit or mark after a letter edge stops it"; "the default words keep their whole-word rule, now by every script: a letter after an ASCII word stops it too" |
| L2-T8-M165 | status header: a whole word | `src/enhance/vocab.ts` | `statusHeader: new RegExp(whole(w.statusHeaders, true, true), 'iu'),` → `statusHeader: new RegExp(anyOf(w.statusHeaders), 'iu'),` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "status-column headers: whole, in any script and any case; one ending in "?" needs no boundary after" |
| L2-T8-M166 | qualifier: a whole word before the mention | `src/enhance/vocab.ts` | ``${whole(w.qualifiers, true, false)}\\s+$`` → ``${anyOf(w.qualifiers)}\\s+$`` | `test/enhance-vocab.test.ts`: no tests.  |
| L2-T8-M167 | addressee: a whole word | `src/enhance/vocab.ts` | `addressee: new RegExp(whole(w.addressees, true, true), 'iu'),` → `addressee: new RegExp(anyOf(w.addressees), 'iu'),` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "addressees, qualifiers and the attention words: whole, in any script" |
| L2-T8-M168 | attention: an owner header's word is whole | `src/enhance/vocab.ts` | ``^${whole(w.attention.who, false, true)}`` → ``^${anyOf(w.attention.who)}`` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "addressees, qualifiers and the attention words: whole, in any script" |
| L2-T8-M169 | attention: an open answer is a whole word | `src/enhance/vocab.ts` | ``^${whole(w.attention.openAnswers, false, true)}`` → ``^${anyOf(w.attention.openAnswers)}`` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "addressees, qualifiers and the attention words: whole, in any script" |
| L2-T8-M170 | attention: a blocking word is whole | `src/enhance/vocab.ts` | ``^\\s*${whole(w.attention.blocking, false, true)}`` → ``^\\s*${anyOf(w.attention.blocking)}`` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "addressees, qualifiers and the attention words: whole, in any script" |
| L2-T8-M171 | ID scan: the default grammar is bounded before | `src/enhance/vocab.ts` | ``${NOT_AFTER_WORD}[A-Z]{1,4}`` → `'[A-Z]{1,4}'` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "an ID is whole in any script: a prefix of another script, and the default grammar with a letter on either side" |
| L2-T8-M172 | ID scan: a prefix is bounded before | `src/enhance/vocab.ts` | `whole(w.ids.prefixes, true, false)` → `anyOf(w.ids.prefixes)` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "an ID is whole in any script: a prefix of another script, and the default grammar with a letter on either side" |
| L2-T8-M173 | ID scan: bounded after | `src/enhance/vocab.ts` | ``(${idScanBody})${NOT_BEFORE_WORD}`` → ``(${idScanBody})`` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "an ID is whole in any script: a prefix of another script, and the default grammar with a letter on either side" |
| L2-T8-M174 | ruling header: a header ending in "?" with an empty list | `src/enhance/vocab.ts` | `w.rulingHeaders.length === 0 ? '\\?$' :` → `w.rulingHeaders.length === 0 ? NEVER :` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "an empty rulingHeaders names no ruling word, and a header that ends in "?" still asks a question" |
| L2-T8-M175 | the link: a C1 control is refused | `src/enhance/editorial.ts` | `const HREF_REFUSED = /[\u0000-\u001f\u007f-\u009f\s]/;` → `const HREF_REFUSED = /[\u0000-\u001f\u007f\s]/;` | `test/enhance-vocab.test.ts`: 2 failed \| 140 passed (142). "no link: a next-line control (C1)"; "no link: a C1 control" |
| L2-T8-M176 | the link: a C0 control is refused | `src/enhance/editorial.ts` | `const HREF_REFUSED = /[\u0000-\u001f\u007f-\u009f\s]/;` → `const HREF_REFUSED = /[\u0001-\u001f\u007f-\u009f\s]/;` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "no link: a control character" |
| L2-T8-M177 | delta route: a section whose first block names no key passes to the next | `src/enhance/editorial.ts` | `      break; // the section's first code block is its delta` → `      return null;` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "a section whose first code block names no key passes to the next section with an item heading" |
| L2-T8-M178 | at most 64 links are written | `src/enhance/editorial.ts` | `    if (hrefs.size >= ITEM_LINKS.links) break; ⏎ ` → `` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "at most 64 links are written: one key repeated past them stays text, and the host is asked once" |
| L2-T8-M179 | the bound is 64 links | `src/enhance/editorial.ts` | `export const ITEM_LINKS = { keys: 16, links: 64, href: 2048 } as const;` → `export const ITEM_LINKS = { keys: 16, links: 65, href: 2048 } as const;` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "at most 64 links are written: one key repeated past them stays text, and the host is asked once" |
| L2-T8-M180 | one listener on the byline routes the links | `src/enhance/editorial.ts` | `    links?.route(byline); ⏎ ` → `` | `test/enhance-vocab.test.ts`: 5 failed \| 137 passed (142). "one click listener for every item link of the byline, never one per link"; "with onLink: the host gets the link and newTab true, and the default is prevented"; "a click on an author's link in the byline is not the item link's: it reaches onLink as written, without newTab"; "a plain click on the arrow inside the link is the link's: newTab true"; "a click whose target is the link's own text node goes to onLink too" |
| L2-T8-M181 | a link made is routed | `src/enhance/editorial.ts` | `      made.set(a, href); ⏎ ` → `` | `test/enhance-vocab.test.ts`: 4 failed \| 138 passed (142). "with onLink: the host gets the link and newTab true, and the default is prevented"; "a click on an author's link in the byline is not the item link's: it reaches onLink as written, without newTab"; "a plain click on the arrow inside the link is the link's: newTab true"; "a click whose target is the link's own text node goes to onLink too" |
| L2-T8-M182 | a click routes the link it is in | `src/enhance/editorial.ts` | `        const a = el?.closest('a') ?? null;` → `        const a = el;` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "a plain click on the arrow inside the link is the link's: newTab true" |
| L2-T8-M183 | a click on a text node is its parent's | `src/enhance/editorial.ts` | `(n?.parentElement ?? null)` → `null` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "a click whose target is the link's own text node goes to onLink too" |
| L2-T8-M184 | a click: only on an item link | `src/enhance/editorial.ts` | `        if (href === undefined \|\| e.defaultPrevented \|\| e.button !== 0 \|\| !ctx.host.present.has('onLink')) return;` → `        if (e.defaultPrevented \|\| e.button !== 0 \|\| !ctx.host.present.has('onLink')) return;` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "a click on an author's link in the byline is not the item link's: it reaches onLink as written, without newTab" |
| L2-T8-M185 | the item link only with itemLink | `src/enhance/editorial.ts` | `    const links = ctx.host.present.has('itemLink') ? itemLinks(ctx) : null;` → `    const links = itemLinks(ctx);` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "without itemLink the byline carries no click listener of the item link" |
| L2-T8-M186 | byline route: stop when the host destroyed the reader (the build) | `src/enhance/editorial.ts` | `    if (links !== null && item !== null && !linkKeys(ctx, item, links)) return;` → `    if (links !== null && item !== null) linkKeys(ctx, item, links);` | Reported (green, guard kept): as L2-T8-M124, for the build. When `itemLink` destroys the instance during the byline route, linkKeys answers false and this check returns; without it the build goes on, but the journal makes no write once the instance is not live (an insert, a wrap or a listener does nothing, and a split throws), and the lifecycle reports the startup as aborted all the same, so the case "an itemLink that destroys the reader stops the build: no more calls, and the root comes back whole" passes either way. The check stays for the plan's rule (live() after each call-out), so the build stops at once. |
| L2-T8-M187 | README: the vocabulary row states the word rule | `README.md` | `each 1 to 64 code units with no white space at either end` → `each 1 to 64 code units and not all white space` | `test/enhance-vocab.test.ts`: 1 failed \| 141 passed (142). "each row states the default and the bounds the code holds" |

### The rows, as `mutate.mjs` reads them

```json
[
  {
    "id": "L2-T8-M155",
    "guard": "a word: no white space at either end",
    "file": "src/enhance/options.ts",
    "old": "    if (typeof w !== 'string' || w.length > LIMITS.word || w === '' || w.trim() !== w) {",
    "new": "    if (typeof w !== 'string' || w.length > LIMITS.word || w === '') {",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M156",
    "guard": "whole word: bounded before, on a word-character edge",
    "file": "src/enhance/vocab.ts",
    "old": "    const lead = before && isWordChar(cps[0]) ? NOT_AFTER_WORD : '';",
    "new": "    const lead = '';",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M157",
    "guard": "whole word: bounded after, on a word-character edge",
    "file": "src/enhance/vocab.ts",
    "old": "    const tail = after && isWordChar(cps[cps.length - 1]) ? NOT_BEFORE_WORD : '';",
    "new": "    const tail = '';",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M158",
    "guard": "whole word: an edge that is no word character asks nothing after it",
    "file": "src/enhance/vocab.ts",
    "old": "const tail = after && isWordChar(cps[cps.length - 1]) ?",
    "new": "const tail = after ?",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M159",
    "guard": "whole word: an edge that is no word character asks nothing before it",
    "file": "src/enhance/vocab.ts",
    "old": "const lead = before && isWordChar(cps[0]) ?",
    "new": "const lead = before ?",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M160",
    "guard": "whole word: a word's edge is a word character of any script",
    "file": "src/enhance/vocab.ts",
    "old": "/^[\\p{L}\\p{N}\\p{M}_]$/u.test(c)",
    "new": "/^[A-Za-z0-9_]$/u.test(c)",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M161",
    "guard": "whole word: the text beyond is a word character of any script",
    "file": "src/enhance/vocab.ts",
    "old": "const WORD_CHAR = '[\\\\p{L}\\\\p{N}\\\\p{M}_]';",
    "new": "const WORD_CHAR = '[A-Za-z0-9_]';",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M162",
    "guard": "whole word: a combining mark continues a word",
    "file": "src/enhance/vocab.ts",
    "old": "const WORD_CHAR = '[\\\\p{L}\\\\p{N}\\\\p{M}_]';",
    "new": "const WORD_CHAR = '[\\\\p{L}\\\\p{N}_]';",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M163",
    "guard": "whole word: a digit continues a word",
    "file": "src/enhance/vocab.ts",
    "old": "const WORD_CHAR = '[\\\\p{L}\\\\p{N}\\\\p{M}_]';",
    "new": "const WORD_CHAR = '[\\\\p{L}\\\\p{M}_]';",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M164",
    "guard": "status roles: a whole word",
    "file": "src/enhance/vocab.ts",
    "old": "`^(${whole(w.status[r], false, true)})`",
    "new": "`^(${anyOf(w.status[r])})`",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M165",
    "guard": "status header: a whole word",
    "file": "src/enhance/vocab.ts",
    "old": "statusHeader: new RegExp(whole(w.statusHeaders, true, true), 'iu'),",
    "new": "statusHeader: new RegExp(anyOf(w.statusHeaders), 'iu'),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M166",
    "guard": "qualifier: a whole word before the mention",
    "file": "src/enhance/vocab.ts",
    "old": "`${whole(w.qualifiers, true, false)}\\\\s+$`",
    "new": "`${anyOf(w.qualifiers)}\\\\s+$`",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M167",
    "guard": "addressee: a whole word",
    "file": "src/enhance/vocab.ts",
    "old": "addressee: new RegExp(whole(w.addressees, true, true), 'iu'),",
    "new": "addressee: new RegExp(anyOf(w.addressees), 'iu'),",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M168",
    "guard": "attention: an owner header's word is whole",
    "file": "src/enhance/vocab.ts",
    "old": "`^${whole(w.attention.who, false, true)}`",
    "new": "`^${anyOf(w.attention.who)}`",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M169",
    "guard": "attention: an open answer is a whole word",
    "file": "src/enhance/vocab.ts",
    "old": "`^${whole(w.attention.openAnswers, false, true)}`",
    "new": "`^${anyOf(w.attention.openAnswers)}`",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M170",
    "guard": "attention: a blocking word is whole",
    "file": "src/enhance/vocab.ts",
    "old": "`^\\\\s*${whole(w.attention.blocking, false, true)}`",
    "new": "`^\\\\s*${anyOf(w.attention.blocking)}`",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M171",
    "guard": "ID scan: the default grammar is bounded before",
    "file": "src/enhance/vocab.ts",
    "old": "`${NOT_AFTER_WORD}[A-Z]{1,4}`",
    "new": "'[A-Z]{1,4}'",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M172",
    "guard": "ID scan: a prefix is bounded before",
    "file": "src/enhance/vocab.ts",
    "old": "whole(w.ids.prefixes, true, false)",
    "new": "anyOf(w.ids.prefixes)",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M173",
    "guard": "ID scan: bounded after",
    "file": "src/enhance/vocab.ts",
    "old": "`(${idScanBody})${NOT_BEFORE_WORD}`",
    "new": "`(${idScanBody})`",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M174",
    "guard": "ruling header: a header ending in \"?\" with an empty list",
    "file": "src/enhance/vocab.ts",
    "old": "w.rulingHeaders.length === 0 ? '\\\\?$' :",
    "new": "w.rulingHeaders.length === 0 ? NEVER :",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M175",
    "guard": "the link: a C1 control is refused",
    "file": "src/enhance/editorial.ts",
    "old": "const HREF_REFUSED = /[\\u0000-\\u001f\\u007f-\\u009f\\s]/;",
    "new": "const HREF_REFUSED = /[\\u0000-\\u001f\\u007f\\s]/;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M176",
    "guard": "the link: a C0 control is refused",
    "file": "src/enhance/editorial.ts",
    "old": "const HREF_REFUSED = /[\\u0000-\\u001f\\u007f-\\u009f\\s]/;",
    "new": "const HREF_REFUSED = /[\\u0001-\\u001f\\u007f-\\u009f\\s]/;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M177",
    "guard": "delta route: a section whose first block names no key passes to the next",
    "file": "src/enhance/editorial.ts",
    "old": "      break; // the section's first code block is its delta",
    "new": "      return null;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M178",
    "guard": "at most 64 links are written",
    "file": "src/enhance/editorial.ts",
    "old": "    if (hrefs.size >= ITEM_LINKS.links) break;\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M179",
    "guard": "the bound is 64 links",
    "file": "src/enhance/editorial.ts",
    "old": "export const ITEM_LINKS = { keys: 16, links: 64, href: 2048 } as const;",
    "new": "export const ITEM_LINKS = { keys: 16, links: 65, href: 2048 } as const;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M180",
    "guard": "one listener on the byline routes the links",
    "file": "src/enhance/editorial.ts",
    "old": "    links?.route(byline);\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M181",
    "guard": "a link made is routed",
    "file": "src/enhance/editorial.ts",
    "old": "      made.set(a, href);\n",
    "new": "",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M182",
    "guard": "a click routes the link it is in",
    "file": "src/enhance/editorial.ts",
    "old": "        const a = el?.closest('a') ?? null;",
    "new": "        const a = el;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M183",
    "guard": "a click on a text node is its parent's",
    "file": "src/enhance/editorial.ts",
    "old": "(n?.parentElement ?? null)",
    "new": "null",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M184",
    "guard": "a click: only on an item link",
    "file": "src/enhance/editorial.ts",
    "old": "        if (href === undefined || e.defaultPrevented || e.button !== 0 || !ctx.host.present.has('onLink')) return;",
    "new": "        if (e.defaultPrevented || e.button !== 0 || !ctx.host.present.has('onLink')) return;",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M185",
    "guard": "the item link only with itemLink",
    "file": "src/enhance/editorial.ts",
    "old": "    const links = ctx.host.present.has('itemLink') ? itemLinks(ctx) : null;",
    "new": "    const links = itemLinks(ctx);",
    "tests": "test/enhance-vocab.test.ts"
  },
  {
    "id": "L2-T8-M187",
    "guard": "README: the vocabulary row states the word rule",
    "file": "README.md",
    "old": "each 1 to 64 code units with no white space at either end",
    "new": "each 1 to 64 code units and not all white space",
    "tests": "test/enhance-vocab.test.ts"
  }
]
```

## Visual check

Task 8 names none. What it changes on a page is the item link, which is off unless a host gives `itemLink` and names a
route; with the defaults the layout is the one before it, and the Level 2 cases (`conformance/layout/`) did not move.
